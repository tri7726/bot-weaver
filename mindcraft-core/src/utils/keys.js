import { readFileSync } from 'fs';
import { supabase } from './supabase.js';

let localKeys = {};
try {
    const data = readFileSync('./keys.json', 'utf8');
    localKeys = JSON.parse(data);
} catch (err) {
    // console.warn('keys.json not found. Defaulting to environment variables or Supabase.');
}

const keyStore = {}; // { KEY_NAME: ["key1", "key2"] }
const keyIndices = {}; // { KEY_NAME: 0 }

/**
 * Initializes keys from local files, environment variables, and Supabase.
 */
export async function initKeys(user_id = null, customKeys = null) {
    // 1. Start with env variables
    const envVars = [
        'OPENAI_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 
        'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY',
        'GROQCLOUD_API_KEY', 'MISTRAL_API_KEY', 'OPENROUTER_API_KEY'
    ];

    for (const name of envVars) {
        keyStore[name] = [];
        // Check for indexed env vars like XAI_API_KEY_1, XAI_API_KEY_2
        let i = 1;
        while (process.env[`${name}_${i}`]) {
            keyStore[name].push(process.env[`${name}_${i}`]);
            i++;
        }
        // Then check fallback single env var
        if (process.env[name] && !keyStore[name].includes(process.env[name])) {
            keyStore[name].push(process.env[name]);
        }
        // Then check localKeys
        if (localKeys[name] && !keyStore[name].includes(localKeys[name])) {
            keyStore[name].push(localKeys[name]);
        }
        keyIndices[name] = 0;
    }

    // 2. Fetch from Supabase global_settings
    if (user_id) {
        try {
            const { data, error } = await supabase
                .from('global_settings')
                .select('api_keys')
                .eq('user_id', user_id)
                .maybeSingle();

            if (!error && data?.api_keys) {
                const dbKeys = data.api_keys;
                for (const name in dbKeys) {
                    const val = dbKeys[name];
                    if (!keyStore[name]) keyStore[name] = [];
                    
                    if (Array.isArray(val)) {
                        val.forEach(k => {
                            if (k && !keyStore[name].includes(k)) keyStore[name].push(k);
                        });
                    } else if (typeof val === 'string' && val && !keyStore[name].includes(val)) {
                        keyStore[name].push(val);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch keys from Supabase:', e.message);
        }
    }

    // 3. Merge Custom Keys (Highest priority, provided by bot config)
    if (customKeys) {
        for (const name in customKeys) {
            const val = customKeys[name];
            if (!val) continue;

            if (!keyStore[name]) keyStore[name] = [];
            
            if (Array.isArray(val)) {
                // Prepend custom keys to prioritize them
                val.reverse().forEach(k => {
                    if (k && !keyStore[name].includes(k)) keyStore[name].unshift(k);
                });
            } else if (typeof val === 'string' && val) {
                if (!keyStore[name].includes(val)) keyStore[name].unshift(val);
            }
        }
    }

    console.log('API Keys initialized. Pools:', Object.keys(keyStore).filter(n => keyStore[n].length > 0).map(n => `${n}(${keyStore[n].length})`).join(', '));
}

export function getKey(name) {
    const pool = keyStore[name];
    if (!pool || pool.length === 0) {
        // Fallback to direct env check for unexpected keys
        if (process.env[name]) return process.env[name];
        throw new Error(`API key "${name}" not found!`);
    }
    const idx = keyIndices[name] % pool.length;
    return pool[idx];
}

export function getAllKeys(name) {
    return keyStore[name] || [];
}

export function rotateKey(name) {
    const pool = keyStore[name];
    if (pool && pool.length > 1) {
        keyIndices[name] = (keyIndices[name] + 1) % pool.length;
        console.log(`Rotated key for ${name}. New index: ${keyIndices[name]}`);
        return true;
    }
    return false;
}

export function hasKey(name) {
    return (keyStore[name] && keyStore[name].length > 0) || !!process.env[name];
}
