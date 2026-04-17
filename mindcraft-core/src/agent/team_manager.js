import { supabase } from '../utils/supabase.js';
import { executeCommand } from './commands/index.js';
import { isBetterOrEqual } from '../utils/tool_tiers.js';

export class TeamManager {
    constructor(agent) {
        this.agent = agent;
        this.currentTaskId = null;
        this.currentAdminUuid = null; // Track who authorized this task
        this.heartbeatInterval = null;
        this.serverIp = (agent.bot?.proxy?.host || 'localhost') + ':' + (agent.bot?.proxy?.port || '25565');
        
        this.janitorInterval = setInterval(() => this.runMaintenance(), 60000);
        this.activeFocusTarget = null;
        this.squadChannel = null;
        this.leaderUuid = null;
        this.depotLocation = null;
        this.activeSupplyRequests = new Map();
    }

    async initSession() {
        console.log(`[Team] Initializing session & Realtime...`);
        await supabase.from('tasks').delete().eq('server_ip', this.serverIp).in('status', ['pending', 'in_progress']);
        await supabase.from('coordination_locks').delete().eq('server_ip', this.serverIp);
        
        // Setup Realtime Squad Channel
        this.squadChannel = supabase.channel(`squad:${this.serverIp}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'squad_intel',
                filter: `server_ip=eq.${this.serverIp}`
            }, (payload) => {
                if (payload.new.type === 'focus_target') {
                    console.log(`[Team] Realtime focus received: ${payload.new.data.entityName}`);
                    this.activeFocusTarget = payload.new.data;
                } else if (payload.new.type === 'supply_request') {
                    console.log(`[Team] Realtime supply request: ${payload.new.data.itemName}`);
                    this.activeSupplyRequests.set(payload.new.data.botId, payload.new.data);
                } else if (payload.new.type === 'depot_set') {
                    console.log(`[Team] Depot updated:`, payload.new.data);
                    this.depotLocation = payload.new.data;
                }
            })
            .subscribe();
    }

    async verifyOwnership() {
        if (!this.currentTaskId) return false;
        const { data } = await supabase.from('tasks').select('bot_id').eq('id', this.currentTaskId).single();
        if (data && data.bot_id === this.agent.bot_id) return true;
        
        this.stopHeartbeat();
        this.agent.actions.stop();
        return false;
    }

    async checkRequirements(requirements) {
        if (!requirements || requirements.length === 0) return true;
        const inventory = this.agent.bot.inventory.items();
        for (const req of requirements) {
            // Fuzzy match: check if we have the specific item OR a better/equal tier one
            const hasBetter = inventory.some(i => isBetterOrEqual(i.name, req));
            if (!hasBetter) return false;
        }
        return true;
    }

    async claimTask(taskId, adminUuid = null) {
        const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
        if (!task) return false;

        if (!(await this.checkRequirements(task.requirements))) return false;

        const { data, error } = await supabase.from('tasks').update({ 
            bot_id: this.agent.bot_id, status: 'in_progress', last_ping: new Date().toISOString()
        }).eq('id', taskId).is('bot_id', null).select();

        if (error || !data || data.length === 0) return false;

        this.currentTaskId = taskId;
        this.currentAdminUuid = adminUuid || task.user_id; // Default to task owner
        this.startHeartbeat();
        await executeCommand(this.agent, `!goal("${task.description}")`);
        return true;
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(async () => {
            if (!this.currentTaskId) return;

            // 1. Verify Ownership
            if (!(await this.verifyOwnership())) return;

            // 2. Verify Auth (Continuous Protection)
            if (this.currentAdminUuid) {
                const isAuth = await this.agent.security_manager.isAuthorized(this.currentAdminUuid);
                if (!isAuth) {
                    console.warn(`[Team] Admin session expired! Stopping task...`);
                    await supabase.from('tasks').update({ status: 'pending', bot_id: null }).eq('id', this.currentTaskId);
                    this.stopHeartbeat();
                    this.agent.actions.stop();
                    return;
                }
            }

            // 3. Verify Requirements
            const { data: task } = await supabase.from('tasks').select('requirements').eq('id', this.currentTaskId).single();
            if (!(await this.checkRequirements(task?.requirements))) {
                await supabase.from('tasks').update({ status: 'pending', bot_id: null }).eq('id', this.currentTaskId);
                this.stopHeartbeat();
                this.agent.actions.stop();
                return;
            }

            await supabase.from('tasks').update({ last_ping: new Date().toISOString() }).eq('id', this.currentTaskId);
        }, 30000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.currentTaskId = null;
        this.currentAdminUuid = null;
    }

    async setThinking(isThinking) {
        if (!this.currentTaskId) return;
        await supabase.from('tasks').update({
            metadata: { thinking: isThinking }
        }).eq('id', this.currentTaskId);
    }

    async runMaintenance() {
        await this.runJanitor();
        await this.agent.security_manager.handleHandshakes();
    }

    async runJanitor() {
        const thresholdNormal = new Date(Date.now() - 120000).toISOString();
        const thresholdThinking = new Date(Date.now() - 300000).toISOString(); // 5 mins for thinking tasks

        // Reset normal zombies
        await supabase.from('tasks').update({ status: 'pending', bot_id: null })
            .eq('server_ip', this.serverIp)
            .eq('status', 'in_progress')
            .lt('last_ping', thresholdNormal)
            .or('metadata->>thinking.is.null,metadata->>thinking.eq.false');

        // Reset thinking zombies (longer timeout)
        await supabase.from('tasks').update({ status: 'pending', bot_id: null })
            .eq('server_ip', this.serverIp)
            .eq('status', 'in_progress')
            .lt('last_ping', thresholdThinking)
            .eq('metadata->>thinking', 'true');
    }

    async syncTeamBoard() {
        const { data } = await supabase.from('tasks').select('*').eq('server_ip', this.serverIp).eq('status', 'pending').is('bot_id', null);
        return data || [];
    }

    async broadcastFocusTarget(entityId, entityName) {
        console.log(`[Team] Broadcasting focus target: ${entityName} (${entityId})`);
        await supabase.from('squad_intel').insert({
            server_ip: this.serverIp,
            type: 'focus_target',
            data: { entityId, entityName },
            expires_at: new Date(Date.now() + 30000).toISOString() // Valid for 30s
        });
    }

    async getActiveFocusTarget() {
        // Return local cached target from Realtime if possible
        if (this.activeFocusTarget) return this.activeFocusTarget;

        const { data } = await supabase.from('squad_intel')
            .select('*')
            .eq('server_ip', this.serverIp)
            .eq('type', 'focus_target')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);
        
        return data?.[0]?.data || null;
    }

    async updateStatus() {
        const bot = this.agent.bot;
        const inventory = bot.inventory.items();
        
        let role = 'DPS';
        if (inventory.some(i => i.name.includes('splash_potion'))) role = 'HEALER';
        else if (inventory.some(i => i.name.includes('shield'))) role = 'TANK';

        await supabase.from('bots').update({
            current_hp: bot.health,
            max_hp: bot.maxHealth,
            combat_role: role,
            last_ping: new Date().toISOString()
        }).eq('id', this.agent.bot_id);
    }

    async getTeammates() {
        const { data } = await supabase.from('bots')
            .select('*')
            .neq('id', this.agent.bot_id)
            .gt('last_ping', new Date(Date.now() - 60000).toISOString()); // Active in last minute
        return data || [];
    }

    async getLeader() {
        // Option A: The bot with the oldest 'created_at' on this server is the leader.
        const { data } = await supabase.from('bots')
            .select('*')
            .eq('server_ip', this.serverIp)
            .gt('last_ping', new Date(Date.now() - 60000).toISOString())
            .order('created_at', { ascending: true })
            .limit(1);
        
        return data?.[0] || null;
    }

    async isLeader() {
        const leader = await this.getLeader();
        return leader && leader.id === this.agent.bot_id;
    }

    async getSquadIndex() {
        const { data } = await supabase.from('bots')
            .select('id')
            .eq('server_ip', this.serverIp)
            .gt('last_ping', new Date(Date.now() - 60000).toISOString())
            .order('created_at', { ascending: true });
        
        return data?.findIndex(b => b.id === this.agent.bot_id) ?? 0;
    }

    async setDepot(pos) {
        await supabase.from('squad_intel').insert({
            server_ip: this.serverIp,
            type: 'depot_set',
            data: { x: pos.x, y: pos.y, z: pos.z }
        });
    }

    async broadcastSupplyRequest(itemName, quantity) {
        await supabase.from('squad_intel').insert({
            server_ip: this.serverIp,
            type: 'supply_request',
            data: { 
                botId: this.agent.bot_id, 
                botName: this.agent.name,
                itemName, 
                quantity,
                pos: this.agent.bot.entity.position
            }
        });
    }

    async checkSupplies() {
        const bot = this.agent.bot;
        const inventory = bot.inventory.items();
        
        const thresholds = {
            'splash_potion': 1,
            'ender_pearl': 1,
            'cooked_beef': 8
        };

        for (const [item, count] of Object.entries(thresholds)) {
            const has = inventory.filter(i => i.name.includes(item)).reduce((acc, i) => acc + i.count, 0);
            if (has < count) {
                console.log(`[Team] Low on ${item} (${has}/${count}). Requesting...`);
                await this.broadcastSupplyRequest(item, count - has);
            }
        }
    }
}
