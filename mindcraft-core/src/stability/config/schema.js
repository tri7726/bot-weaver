/**
 * @fileoverview Configuration Schema for Minecraft Bot Stability
 * @description Defines the complete configuration schema with validation rules
 */

/**
 * Configuration schema with validation rules and default values
 * @type {import('../types/index.js').StabilityConfig}
 */
export const ConfigSchema = {
    connection: {
        maxReconnectAttempts: {
            type: 'number',
            default: 5,
            min: 1,
            max: 10,
            description: 'Maximum number of reconnection attempts before giving up'
        },
        reconnectDelay: {
            type: 'number',
            default: 1000,
            min: 500,
            max: 30000,
            description: 'Base delay between reconnection attempts in milliseconds'
        },
        keepAliveInterval: {
            type: 'number',
            default: 30000,
            min: 10000,
            max: 60000,
            description: 'Interval for sending keep-alive packets in milliseconds'
        },
        connectionTimeout: {
            type: 'number',
            default: 10000,
            min: 5000,
            max: 30000,
            description: 'Connection timeout in milliseconds'
        },
        host: {
            type: 'string',
            default: 'localhost',
            description: 'Minecraft server hostname or IP address'
        },
        port: {
            type: 'number',
            default: 25565,
            min: 1,
            max: 65535,
            description: 'Minecraft server port number'
        }
    },
    
    portScanning: {
        enabled: {
            type: 'boolean',
            default: true,
            description: 'Enable automatic port scanning for Minecraft servers'
        },
        scanTimeout: {
            type: 'number',
            default: 30000,
            min: 10000,
            max: 60000,
            description: 'Maximum time to spend scanning for ports in milliseconds'
        },
        priorityPorts: {
            type: 'array',
            default: [25565, 25566, 25567],
            description: 'Ports to check first during scanning'
        },
        minPort: {
            type: 'number',
            default: 25565,
            min: 1,
            max: 65535,
            description: 'Minimum port number in scan range'
        },
        maxPort: {
            type: 'number',
            default: 65535,
            min: 1,
            max: 65535,
            description: 'Maximum port number in scan range'
        }
    },
    
    supabase: {
        syncInterval: {
            type: 'number',
            default: 30000,
            min: 10000,
            max: 300000,
            description: 'Data synchronization interval in milliseconds'
        },
        offlineMode: {
            type: 'boolean',
            default: true,
            description: 'Enable offline mode when Supabase is unavailable'
        },
        maxQueueSize: {
            type: 'number',
            default: 1000,
            min: 100,
            max: 5000,
            description: 'Maximum number of items in offline sync queue'
        },
        url: {
            type: 'string',
            default: null,
            description: 'Supabase project URL (from environment variable)'
        },
        key: {
            type: 'string',
            default: null,
            description: 'Supabase API key (from environment variable)'
        }
    },
    
    monitoring: {
        enabled: {
            type: 'boolean',
            default: true,
            description: 'Enable connection monitoring and metrics collection'
        },
        metricsInterval: {
            type: 'number',
            default: 5000,
            min: 1000,
            max: 30000,
            description: 'Metrics collection interval in milliseconds'
        },
        alertThresholds: {
            latency: {
                type: 'number',
                default: 1000,
                min: 100,
                max: 5000,
                description: 'Latency threshold for alerts in milliseconds'
            },
            packetLoss: {
                type: 'number',
                default: 0.05,
                min: 0.01,
                max: 0.5,
                description: 'Packet loss threshold for alerts (0-1)'
            }
        }
    },
    
    authentication: {
        mode: {
            type: 'string',
            default: 'offline',
            enum: ['offline', 'microsoft'],
            description: 'Authentication mode for Minecraft login'
        },
        username: {
            type: 'string',
            default: 'Bot',
            description: 'Bot username for Minecraft'
        },
        validateUsername: {
            type: 'boolean',
            default: true,
            description: 'Validate username format before connection'
        }
    },
    
    errorHandling: {
        maxRetryAttempts: {
            type: 'number',
            default: 5,
            min: 1,
            max: 10,
            description: 'Maximum retry attempts for recoverable errors'
        },
        baseRetryDelay: {
            type: 'number',
            default: 1000,
            min: 500,
            max: 10000,
            description: 'Base delay for retry attempts in milliseconds'
        },
        maxRetryDelay: {
            type: 'number',
            default: 30000,
            min: 5000,
            max: 60000,
            description: 'Maximum delay for retry attempts in milliseconds'
        },
        logErrors: {
            type: 'boolean',
            default: true,
            description: 'Enable error logging'
        }
    },
    
    networkOptimization: {
        enabled: {
            type: 'boolean',
            default: true,
            description: 'Enable network optimization features'
        },
        adaptivePacketRate: {
            type: 'boolean',
            default: true,
            description: 'Adjust packet send rate based on network conditions'
        },
        compressionEnabled: {
            type: 'boolean',
            default: true,
            description: 'Enable packet compression when available'
        },
        packetPrioritization: {
            type: 'boolean',
            default: true,
            description: 'Prioritize critical packets over non-critical ones'
        },
        dynamicTimeouts: {
            type: 'boolean',
            default: true,
            description: 'Use dynamic timeouts based on network conditions'
        }
    }
};

/**
 * Validate a configuration value against the schema
 * @param {string} key - Configuration key in dot notation
 * @param {any} value - Value to validate
 * @returns {boolean} Whether the value is valid
 */
export function validateConfigValue(key, value) {
    const schema = getSchemaForKey(key);
    
    if (!schema) {
        return true; // No schema means any value is valid
    }
    
    // Type validation
    if (schema.type && typeof value !== schema.type) {
        return false;
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
        return false;
    }
    
    // Range validation for numbers
    if (schema.type === 'number') {
        if (schema.min !== undefined && value < schema.min) {
            return false;
        }
        if (schema.max !== undefined && value > schema.max) {
            return false;
        }
    }
    
    // Array validation
    if (schema.type === 'array' && !Array.isArray(value)) {
        return false;
    }
    
    return true;
}

/**
 * Get schema definition for a configuration key
 * @param {string} key - Configuration key in dot notation
 * @returns {Object|null} Schema definition or null if not found
 */
export function getSchemaForKey(key) {
    const parts = key.split('.');
    let current = ConfigSchema;
    
    for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            return null;
        }
    }
    
    return current && current.type ? current : null;
}

/**
 * Get default value for a configuration key
 * @param {string} key - Configuration key in dot notation
 * @returns {any} Default value or undefined
 */
export function getDefaultValue(key) {
    const schema = getSchemaForKey(key);
    return schema ? schema.default : undefined;
}

/**
 * Get all default configuration values
 * @returns {Object} Object with all default values
 */
export function getAllDefaults() {
    const defaults = {};
    
    function extractDefaults(obj, prefix = '') {
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (value && typeof value === 'object' && value.type) {
                // This is a schema definition
                if (value.default !== undefined) {
                    defaults[fullKey] = value.default;
                }
            } else if (value && typeof value === 'object') {
                // This is a nested object
                extractDefaults(value, fullKey);
            }
        }
    }
    
    extractDefaults(ConfigSchema);
    return defaults;
}

/**
 * Validate an entire configuration object
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result with errors
 */
export function validateConfiguration(config) {
    const errors = [];
    const warnings = [];
    
    // Check all provided values
    for (const [key, value] of Object.entries(config)) {
        if (!validateConfigValue(key, value)) {
            const schema = getSchemaForKey(key);
            errors.push({
                key,
                value,
                expected: schema ? schema.type : 'unknown',
                message: `Invalid value for ${key}: expected ${schema?.type || 'valid value'}`
            });
        }
    }
    
    // Check for missing required values (none currently required)
    // This could be extended to mark certain config values as required
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Create a configuration object with all default values
 * @returns {Object} Configuration with defaults
 */
export function createDefaultConfiguration() {
    return getAllDefaults();
}

/**
 * Merge user configuration with defaults
 * @param {Object} userConfig - User-provided configuration
 * @returns {Object} Merged configuration
 */
export function mergeWithDefaults(userConfig) {
    const defaults = getAllDefaults();
    return { ...defaults, ...userConfig };
}