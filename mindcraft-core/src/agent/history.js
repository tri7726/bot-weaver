import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { supabase } from '../utils/supabase.js';
import settings from './settings.js';


export class History {
    constructor(agent) {
        this.agent = agent;
        this.name = agent.name;
        this.memory_fp = `./bots/${this.name}/memory.json`;
        this.full_history_fp = undefined;

        mkdirSync(`./bots/${this.name}/histories`, { recursive: true });

        this.turns = [];

        // Natural language memory as a summary of recent messages + previous memory
        this.memory = '';

        // Maximum number of messages to keep in context before saving chunk to memory
        this.max_messages = settings.max_messages;

        // Number of messages to remove from current history and save into memory
        this.summary_chunk_size = 5; 
    }

    getHistory() { // expects an Examples object
        return JSON.parse(JSON.stringify(this.turns));
    }

    async summarizeMemories(turns, layer = 'summary', parent_id = null, importance = 0.5, extraMetadata = {}) {
        console.log(`Refining memories -> Layer: ${layer}...`);
        
        let content;
        if (extraMetadata.directContent) {
            content = extraMetadata.directContent;
        } else {
            content = await this.agent.prompter.promptMemSaving(turns);
        }

        let refinedContent = content;
        if (refinedContent.length > 500) {
            refinedContent = refinedContent.slice(0, 500);
            refinedContent += '...(Memory truncated)';
        }

        console.log(`Memory updated (${layer}): `, refinedContent);

        // Store as vector memory in Supabase
        if (this.agent.user_id && this.agent.bot_id) {
            try {
                const embedding = await this.agent.prompter.embedding_model.embed(refinedContent);
                const { data, error } = await supabase
                    .from('agent_memories')
                    .insert({
                        user_id: this.agent.user_id,
                        bot_id: this.agent.bot_id,
                        content: refinedContent,
                        embedding,
                        layer: layer,
                        importance_score: importance,
                        server_id: this.server_id,
                        parent_id: parent_id,
                        metadata: { 
                            turns: turns.length,
                            timestamp: new Date().toISOString(),
                            ...extraMetadata
                        }
                    })
                    .select('id')
                    .single();
                
                if (error) throw error;
                this.memory = refinedContent; 
                return data?.id;
            } catch (err) {
                console.error('Failed to store vector memory:', err);
            }
        }
        return null;
    }

    async appendFullHistory(to_store) {
        if (this.full_history_fp === undefined) {
            const string_timestamp = new Date().toLocaleString().replace(/[/:]/g, '-').replace(/ /g, '').replace(/,/g, '_');
            this.full_history_fp = `./bots/${this.name}/histories/${string_timestamp}.json`;
            writeFileSync(this.full_history_fp, '[]', 'utf8');
        }
        try {
            const data = readFileSync(this.full_history_fp, 'utf8');
            let full_history = JSON.parse(data);
            full_history.push(...to_store);
            writeFileSync(this.full_history_fp, JSON.stringify(full_history, null, 4), 'utf8');
        } catch (err) {
            console.error(`Error reading ${this.name}'s full history file: ${err.message}`);
        }
    }

    async add(name, content) {
        let role = 'assistant';
        if (name === 'system') {
            role = 'system';
        }
        else if (name !== this.name) {
            role = 'user';
            content = `${name}: ${content}`;
        }
        this.turns.push({role, content});

        if (this.turns.length >= this.max_messages) {
            let chunk = this.turns.splice(0, this.summary_chunk_size);
            while (this.turns.length > 0 && this.turns[0].role === 'assistant')
                chunk.push(this.turns.shift()); // remove until turns starts with system/user message

            await this.summarizeMemories(chunk);
            await this.appendFullHistory(chunk);
        }
    }

    async save() {
        try {
            const data = {
                memory: this.memory,
                turns: this.turns,
                self_prompting_state: this.agent.self_prompter.state,
                self_prompt: this.agent.self_prompter.isStopped() ? null : this.agent.self_prompter.prompt,
                taskStart: this.agent.task.taskStartTime,
                last_sender: this.agent.last_sender
            };
            
            // Local file fallback
            writeFileSync(this.memory_fp, JSON.stringify(data, null, 2));
            
            // Supabase persistence
            if (this.agent.user_id && this.agent.bot_id) {
                const { error } = await supabase
                    .from('agent_sessions')
                    .upsert({
                        user_id: this.agent.user_id,
                        bot_id: this.agent.bot_id,
                        session_data: data,
                        updated_at: new Date()
                    }, { onConflict: 'user_id, bot_id' });
                if (error) throw error;
            }

            console.log('Saved memory to local and Supabase');
        } catch (error) {
            console.error('Failed to save history:', error);
            throw error;
        }
    }

    async load() {
        try {
            let data = null;
            
            // Try Supabase first
            if (this.agent.user_id && this.agent.bot_id) {
                const { data: dbData, error } = await supabase
                    .from('agent_sessions')
                    .select('session_data')
                    .eq('bot_id', this.agent.bot_id)
                    .single();
                if (!error && dbData) {
                    data = dbData.session_data;
                    console.log('Loaded memory from Supabase');
                }
            }

            // Fallback to local file
            if (!data && existsSync(this.memory_fp)) {
                data = JSON.parse(readFileSync(this.memory_fp, 'utf8'));
                console.log('Loaded memory from local file');
            }

            if (data) {
                this.memory = data.memory || '';
                this.turns = data.turns || [];
                return data;
            }
            
            console.log('No memory found.');
            return null;
        } catch (error) {
            console.error('Failed to load history:', error);
            throw error;
        }
    }

    async getRelevantContext(query) {
        if (!this.agent.user_id || !this.agent.bot_id) return '';
        
        try {
            console.log(`Searching hierarchical memories for: "${query.substring(0, 50)}..."`);
            const embedding = await this.agent.prompter.embedding_model.embed(query);
            
            // RPC call for vector similarity search (requires a custom Postgres function)
            // Or use a standard select if supabase-js supports it with filters
            // For now, we'll try a flexible filtering approach
            
            const { data, error } = await supabase.rpc('match_agent_memories', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: 5,
                p_user_id: this.agent.user_id,
                p_bot_id: this.agent.bot_id
            });

            if (error) throw error;
            if (!data || data.length === 0) return '';

            let context = "\nRelevant memories from your past:\n";
            data.forEach(m => {
                const layerTag = m.layer === 'abstract' ? '[GLOBAL KNOWLEDGE]' : `[${m.layer.toUpperCase()}]`;
                context += `- ${layerTag}: ${m.content}\n`;
            });
            return context;
        } catch (err) {
            console.error('Vector search failed:', err);
            return '';
        }
    }

    clear() {
        this.turns = [];
        this.memory = '';
    }
}