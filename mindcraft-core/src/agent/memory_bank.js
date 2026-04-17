import { supabase } from '../utils/supabase.js';

export class MemoryBank {
	constructor(agent) {
		this.agent = agent;
		this.memory = {};
		this.serverIp = (agent.bot?.proxy?.host || 'localhost') + ':' + (agent.bot?.proxy?.port || '25565');
	}

	async sync() {
		try {
			const { data, error } = await supabase
				.from('agent_memories')
				.select('content, metadata')
				.eq('server_ip', this.serverIp) // Pull all squad memories
				.eq('metadata->type', 'location');
			
			if (error) throw error;
			
			if (data) {
				data.forEach(item => {
					this.memory[item.content] = item.metadata.coords;
				});
			}
		} catch (err) {
			console.error('Failed to sync memory bank:', err);
		}
	}

	async rememberPlace(name, x, y, z) {
		this.memory[name] = [x, y, z];
		try {
			const { error } = await supabase
				.from('agent_memories')
				.upsert({
					user_id: this.agent.user_id,
					bot_id: this.agent.bot_id,
					server_ip: this.serverIp,
					content: name,
					metadata: { type: 'location', coords: [x, y, z] }
				}, { onConflict: 'server_ip, content' }); // Squad-wide uniqueness
			
			if (error) throw error;
		} catch (err) {
			console.error('Failed to persist memory:', err);
		}
	}

	recallPlace(name) {
		return this.memory[name];
	}

	getJson() {
		return this.memory
	}

	loadJson(json) {
		this.memory = json;
	}

	getKeys() {
		return Object.keys(this.memory).join(', ')
	}
}