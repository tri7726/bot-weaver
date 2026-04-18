import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import * as mindcraft from './mindcraft.js';
import { readFileSync } from 'fs';
import { testApiKey } from '../utils/apiTester.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mindserver is:
// - central hub for communication between all agent processes
// - api to control from other languages and remote users 
// - host for webapp

let io;
let server;
const agent_connections = {};
const agent_listeners = [];

const settings_spec = JSON.parse(readFileSync(path.join(__dirname, 'public/settings_spec.json'), 'utf8'));

class AgentConnection {
    constructor(settings, viewer_port) {
        this.socket = null;
        this.settings = settings;
        this.in_game = false;
        this.full_state = null;
        this.viewer_port = viewer_port;
    }
    setSettings(settings) {
        this.settings = settings;
    }
}

export function registerAgent(settings, viewer_port) {
    let agentConnection = new AgentConnection(settings, viewer_port);
    agent_connections[settings.profile.name] = agentConnection;
}

export function logoutAgent(agentName) {
    if (agent_connections[agentName]) {
        agent_connections[agentName].in_game = false;
        agentsStatusUpdate();
    }
}

// Initialize the server
export function createMindServer(host_public = false, port = 8080) {
    const app = express();
    
    // Enable CORS for Express
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    server = http.createServer(app);
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Serve static files
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(path.join(__dirname, 'public')));

    // Socket.io connection handling
    io.on('connection', (socket) => {
        let curAgentName = null;
        console.log('Client connected');

        agentsStatusUpdate(socket);

        socket.on('create-agent', async (settings, callback) => {
            // If profile is a string (path), load it
            if (typeof settings.profile === 'string') {
                try {
                    const profilePath = path.join(process.cwd(), settings.profile);
                    const profileData = JSON.parse(readFileSync(profilePath, 'utf8'));
                    settings.profile = profileData;
                } catch (err) {
                    callback({ success: false, error: `Failed to load profile: ${err.message}` });
                    return;
                }
            }

            // Prioritize the name passed from the UI
            if (settings.name) {
                if (!settings.profile) settings.profile = {};
                settings.profile.name = settings.name;
            }

            if (settings.profile?.name) {
                if (settings.profile.name in agent_connections) {
                    callback({ success: false, error: 'Agent already exists' });
                    return;
                }
                for (let key in settings_spec) {
                    if (!(key in settings)) {
                        if (settings_spec[key].required) {
                            callback({ success: false, error: `Setting ${key} is required` });
                            return;
                        }
                        else {
                            settings[key] = settings_spec[key].default;
                        }
                    }
                }
                for (let key in settings) {
                    if (!(key in settings_spec)) {
                        delete settings[key];
                    }
                }
                let returned = await mindcraft.createAgent(settings);
                callback({ success: returned.success, error: returned.error });
                let name = settings.profile.name;
                if (!returned.success && agent_connections[name]) {
                    mindcraft.destroyAgent(name);
                    delete agent_connections[name];
                }
                agentsStatusUpdate();
            }
            else {
                console.error('Agent name is required in profile');
                callback({ success: false, error: 'Agent name is required in profile' });
            }
        });

        socket.on('launch-bot', async (botId, callback) => {
            try {
                const { supabase } = await import('../utils/supabase.js');
                console.log(`[LaunchGuard] Received launch request for botId: "${botId}"`);
                
                // 1. Fetch Bot Config
                const { data: bot, error: botErr } = await supabase.from('bots').select('*').eq('id', botId).maybeSingle();
                
                if (botErr) {
                    console.error(`[LaunchGuard] Supabase Error:`, botErr.message);
                    throw new Error(`Database Error: ${botErr.message}`);
                }
                
                if (!bot) {
                    console.error(`[LaunchGuard] Bot not found for ID: ${botId}. Make sure the bot exists in Supabase.`);
                    throw new Error(`Bot not found in database (ID: ${botId}).`);
                }

                console.log(`[LaunchGuard] Found bot: "${bot.name}". Preparing to start...`);

                // 2. Fetch Profile if exists
                let system_prompt = bot.system_prompt;
                let personality = bot.personality;
                if (bot.profile_id) {
                    const { data: prof } = await supabase.from('agent_profiles').select('*').eq('id', bot.profile_id).maybeSingle();
                    if (prof) {
                        if (!system_prompt) system_prompt = prof.system_prompt;
                        if (!personality) personality = prof.personality;
                    }
                }

                // 3. Prepare Settings Object
                const settings = {
                    host: bot.host,
                    port: bot.port,
                    minecraft_username: bot.minecraft_username,
                    auth: bot.auth_type,
                    profile: {
                        name: bot.name,
                        systemPrompt: system_prompt,
                        personality: personality,
                        ...(bot.model_config || {})
                    },
                    load_memory: true,
                    init_message: "Hello, I am back online.",
                    user_id: bot.user_id,
                    bot_id: bot.id,
                    use_global_keys: bot.use_global_keys,
                    custom_api_keys: bot.custom_api_keys
                };

                console.log(`Launching bot ${bot.name} from Supabase config...`);
                
                // 4. Update status in DB
                await supabase.from('bots').update({ status: 'starting' }).eq('id', botId);
                agentsStatusUpdate();

                // 5. Create Agent
                let res = await mindcraft.createAgent(settings);
                
                if (res.success) {
                    await supabase.from('bots').update({ status: 'running' }).eq('id', botId);
                    callback({ success: true });
                } else {
                    await supabase.from('bots').update({ status: 'error' }).eq('id', botId);
                    callback({ success: false, error: res.error });
                }
                agentsStatusUpdate();

            } catch (err) {
                console.error('Launch Error:', err);
                callback({ success: false, error: err.message });
            }
        });

        socket.on('get-settings', (agentName, callback) => {
            if (agent_connections[agentName]) {
                callback({ settings: agent_connections[agentName].settings });
            } else {
                callback({ error: `Agent '${agentName}' not found.` });
            }
        });

        socket.on('connect-agent-process', (agentName) => {
            if (agent_connections[agentName]) {
                agent_connections[agentName].socket = socket;
                agentsStatusUpdate();
            }
        });

        socket.on('login-agent', (agentName) => {
            if (agent_connections[agentName]) {
                agent_connections[agentName].socket = socket;
                agent_connections[agentName].in_game = true;
                curAgentName = agentName;
                agentsStatusUpdate();
            }
            else {
                console.warn(`Unregistered agent ${agentName} tried to login`);
            }
        });

        socket.on('disconnect', () => {
            if (agent_connections[curAgentName]) {
                console.log(`Agent ${curAgentName} disconnected`);
                agent_connections[curAgentName].in_game = false;
                agent_connections[curAgentName].socket = null;
                agentsStatusUpdate();
            }
            if (agent_listeners.includes(socket)) {
                removeListener(socket);
            }
        });

        socket.on('chat-message', (agentName, json) => {
            const agent = agent_connections[agentName];
            if (!agent) {
                console.warn(`Agent ${agentName} tried to receive a message but is not logged in`);
                return;
            }
            if (!agent.socket) {
                console.warn(`Agent ${agentName} exists but has no active socket connection`);
                return;
            }
            console.log(`${curAgentName} sending message to ${agentName}: ${json.message}`);
            agent.socket.emit('chat-message', curAgentName, json);
        });

        socket.on('set-agent-settings', (agentName, settings) => {
            const agent = agent_connections[agentName];
            if (agent) {
                agent.setSettings(settings);
                if (agent.socket) {
                    agent.socket.emit('restart-agent');
                } else {
                    console.warn(`Settings updated for ${agentName}, but agent socket is not connected for restart.`);
                }
            }
        });

        socket.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            const agent = agent_connections[agentName];
            if (agent && agent.socket) {
                agent.socket.emit('restart-agent');
            } else {
                console.warn(`Cannot restart ${agentName}: socket not connected`);
            }
        });

        socket.on('stop-agent', (agentName) => {
            mindcraft.stopAgent(agentName);
        });

        socket.on('start-agent', (agentName) => {
            mindcraft.startAgent(agentName);
        });

        socket.on('destroy-agent', (agentName) => {
            if (agent_connections[agentName]) {
                mindcraft.destroyAgent(agentName);
                delete agent_connections[agentName];
            }
            agentsStatusUpdate();
        });

        socket.on('stop-all-agents', () => {
            console.log('Killing all agents');
            for (let agentName in agent_connections) {
                mindcraft.stopAgent(agentName);
            }
        });

        socket.on('shutdown', () => {
            console.log('Shutting down');
            for (let agentName in agent_connections) {
                mindcraft.stopAgent(agentName);
            }
            // wait 2 seconds
            setTimeout(() => {
                console.log('Exiting MindServer');
                process.exit(0);
            }, 2000);
            
        });

		socket.on('send-message', (agentName, data) => {
			if (!agent_connections[agentName]) {
				console.warn(`Agent ${agentName} not in game, cannot send message via MindServer.`);
				return
			}
			try {
				agent_connections[agentName].socket.emit('send-message', data)
			} catch (error) {
				console.error('Error: ', error);
			}
		});

        socket.on('bot-output', (agentName, message) => {
            io.emit('bot-output', agentName, message);
        });

        socket.on('test-api-key', async (data, callback) => {
            console.log(`Testing API key for provider: ${data.provider}`);
            const result = await testApiKey(data.provider, data.apiKey);
            callback(result);
        });

        socket.on('listen-to-agents', () => {
            addListener(socket);
        });

        socket.on('trigger-reflection', (agentName, callback) => {
            if (agent_connections[agentName] && agent_connections[agentName].socket) {
                console.log(`Triggering reflection for ${agentName}...`);
                agent_connections[agentName].socket.emit('trigger-reflection', (res) => {
                   if (callback) callback(res);
                });
            } else {
                if (callback) callback({ success: false, error: 'Agent not online' });
            }
        });
    });

    if (host_public) {
        console.log('Public hosting not supported yet. Using localhost.');
    }
    const host = 'localhost';
    server.listen(port, host, () => {
        console.log(`MindServer running on port ${port} on host ${host}`);
    });

    return server;
}

function agentsStatusUpdate(socket) {
    if (!socket) {
        socket = io;
    }
    let agents = [];
    for (let agentName in agent_connections) {
        const conn = agent_connections[agentName];
        agents.push({
            name: agentName, 
            in_game: conn.in_game,
            viewerPort: conn.viewer_port,
            socket_connected: !!conn.socket
        });
    };
    socket.emit('agents-status', agents);
}


let listenerInterval = null;
function addListener(listener_socket) {
    agent_listeners.push(listener_socket);
    if (agent_listeners.length === 1) {
        listenerInterval = setInterval(async () => {
            const states = {};
            for (let agentName in agent_connections) {
                let agent = agent_connections[agentName];
                if (agent.in_game) {
                    try {
                        const state = await new Promise((resolve) => {
                            agent.socket.emit('get-full-state', (s) => resolve(s));
                        });
                        states[agentName] = state;
                    } catch (e) {
                        states[agentName] = { error: String(e) };
                    }
                }
            }
            for (let listener of agent_listeners) {
                listener.emit('state-update', states);
            }
        }, 1000);
    }
}

function removeListener(listener_socket) {
    agent_listeners.splice(agent_listeners.indexOf(listener_socket), 1);
    if (agent_listeners.length === 0) {
        clearInterval(listenerInterval);
        listenerInterval = null;
    }
}

// Optional: export these if you need access to them from other files
export const getIO = () => io;
export const getServer = () => server;
export const numStateListeners = () => agent_listeners.length;