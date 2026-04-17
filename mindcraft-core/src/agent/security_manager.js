import { generateKeyPairSync, createHash, sign, verify } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { supabase } from '../utils/supabase.js';
import path from 'path';

export class SecurityManager {
    constructor(agent) {
        this.agent = agent;
        this.privateKey = null;
        this.publicKey = null;
        this.trustedUuids = new Set(); // Local cache
        this.verifiedTeammates = new Set(); // Bots verified via RSA
        this.keysDir = path.join(process.cwd(), 'keys');
        
        if (!existsSync(this.keysDir)) {
            mkdirSync(this.keysDir);
        }
    }

    async initKeys() {
        const keyPath = path.join(this.keysDir, `${this.agent.name}_private.pem`);
        const pubPath = path.join(this.keysDir, `${this.agent.name}_public.pem`);

        if (existsSync(keyPath)) {
            this.privateKey = readFileSync(keyPath, 'utf8');
            this.publicKey = readFileSync(pubPath, 'utf8');
            console.log(`[Security] Loaded existing keys for ${this.agent.name}`);
        } else {
            console.log(`[Security] Generating new RSA key pair for ${this.agent.name}...`);
            const { publicKey, privateKey } = generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });
            this.privateKey = privateKey;
            this.publicKey = publicKey;
            writeFileSync(keyPath, privateKey);
            writeFileSync(pubPath, publicKey);
        }
    }

    async registerIdentity() {
        if (!this.agent.bot) return;
        const uuid = this.agent.bot.player.uuid;
        const { error } = await supabase
            .from('bots')
            .update({ 
                public_key: this.publicKey,
                minecraft_uuid: uuid
            })
            .eq('id', this.agent.bot_id);

        if (error) console.error("[Security] identity registration failed:", error);
    }

    async authenticateAdmin(token, senderName, senderUuid) {
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const { data, error } = await supabase
            .from('admin_auth_sessions')
            .update({ 
                is_used: true,
                admin_uuid: senderUuid,
                admin_name: senderName
            })
            .eq('token_hash', tokenHash)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString())
            .select();

        if (error || !data || data.length === 0) return false;
        this.trustedUuids.add(senderUuid); // Cache locally
        return true;
    }

    async isAuthorized(senderUuid) {
        if (this.trustedUuids.has(senderUuid)) return true;

        const { data } = await supabase
            .from('admin_auth_sessions')
            .select('id')
            .eq('admin_uuid', senderUuid)
            .eq('is_used', true)
            .gt('expires_at', new Date().toISOString())
            .limit(1);

        if (data && data.length > 0) {
            this.trustedUuids.add(senderUuid);
            return true;
        }
        return false;
    }

    async revokeAllSessions() {
        console.log(`[Security] Revoking ALL admin sessions for this user...`);
        const { error } = await supabase
            .from('admin_auth_sessions')
            .update({ expires_at: new Date().toISOString() })
            .eq('user_id', this.agent.user_id) // This is hypothetical user_id on agent
            .is('is_used', true);
            
        this.trustedUuids.clear();
        this.verifiedTeammates.clear(); 
        return !error;
    }

    // --- RSA Challenge Handshake ---

    async initiateHandshake(targetUuid) {
        if (this.verifiedTeammates.has(targetUuid)) return true;

        // Lexicographical Priority: Only the "smaller" UUID initiates to avoid database clutter
        const myUuid = this.agent.bot.player.uuid;
        if (myUuid >= targetUuid) return false; 

        // Find target bot record
        const { data: targetBot } = await supabase
            .from('bots')
            .select('id, public_key')
            .eq('minecraft_uuid', targetUuid)
            .maybeSingle();

        if (!targetBot) return false;

        const challenge = Math.random().toString(36).substring(7);
        const { data: handshake } = await supabase
            .from('agent_handshakes')
            .insert({
                sender_id: this.agent.bot_id,
                receiver_id: targetBot.id,
                challenge: challenge,
                status: 'pending'
            })
            .select()
            .single();

        // Wait for response (short poll for prototype)
        for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const { data: check } = await supabase
                .from('agent_handshakes')
                .select('*')
                .eq('id', handshake.id)
                .single();

            if (check.status === 'completed' && check.signature) {
                // Verify signature
                const isVerified = verify(
                    "sha256",
                    Buffer.from(challenge),
                    targetBot.public_key,
                    Buffer.from(check.signature, 'base64')
                );
                if (isVerified) {
                    this.verifiedTeammates.add(targetUuid);
                    return true;
                }
            }
        }
        return false;
    }

    async handleHandshakes() {
        // Look for pending challenges addressed to me
        const { data } = await supabase
            .from('agent_handshakes')
            .select('*')
            .eq('receiver_id', this.agent.bot_id)
            .eq('status', 'pending');

        if (!data) return;

        for (const h of data) {
            const signature = sign("sha256", Buffer.from(h.challenge), this.privateKey);
            await supabase
                .from('agent_handshakes')
                .update({
                    signature: signature.toString('base64'),
                    status: 'completed'
                })
                .eq('id', h.id);
        }
    }
}
