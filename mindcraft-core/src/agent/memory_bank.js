import { supabase } from '../utils/supabase.js';

export class MemoryBank {
	constructor(agent) {
		this.agent = agent;
		this.memory = {};
	}

	async sync() {
		try {
			const { data, error } = await supabase
				.from('agent_memories')
				.select('content, metadata')
				.eq('bot_id', this.agent.bot_id)
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
					content: name,
					metadata: { type: 'location', coords: [x, y, z] }
				}, { onConflict: 'bot_id, content' });
			
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