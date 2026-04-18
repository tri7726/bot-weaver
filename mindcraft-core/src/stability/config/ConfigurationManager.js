/**
 * @fileoverview Configuration Manager for Minecraft Bot Stability
 * @description Manages system configuration with validation and backup capabilities
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * @class ConfigurationManager
 * @extends EventEmitter
 * @description Manages configuration loading, validation, and backup
 */
export class ConfigurationManager extends EventEmitter {
    /**
     * @param {Object} options - Configuration options
     * @param {string} options.configPath - Path to configuration file
     * @param {string} options.backupPath - Path for configuration backups
     */
    constructor(options = {}) {
        super();
        
        /** @type {Map<string, any>} */
        this.config = new Map();
        
        /** @type {Map<string, Function>} */
        this.validators = new Map();
        
        /** @type {Array<Object>} */
        this.backups = [];
        
        /** @type {number} */
        this.maxBackups = 10;
        
        /** @type {string} */
        this.configPath = options.configPath || './config.json';
        
        /** @type {string} */
        this.backupPath = options.backupPath || './config-backups';
        
        /** @type {boolean} */
        this.isLoaded = false;
        
        this._initializeValidators();
    }
    
    /**
     * Load configuration from multiple sources
     * @returns {Promise<boolean>} Success status
     */
    async loadConfiguration() {
        try {
            // Load from environment variables first
            this.loadFromEnvironment();
            
            // Load from settings.js if it exists
            await this._loadFromSettingsFile();
            
            // Load from .env file
            await this._loadFromEnvFile();
            
            // Load from JSON config file
            await this._loadFromConfigFile();
            
            // Apply default values for missing configurations
            this._applyDefaults();
            
            // Validate all configuration
            const isValid = await this._validateAllConfig();
            
            if (isValid) {
                this.isLoaded = true;
                this.emit('configurationLoaded', this.getAllConfig());
                return true;
            } else {
                this.emit('configurationInvalid');
                return false;
            }
            
        } catch (error) {
            this.emit('configurationError', error);
            return false;
        }
    }
    
    /**
     * Save current configuration
     * @returns {Promise<boolean>} Success status
     */
    async saveConfiguration() {
        try {
            // Create backup before saving
            await this.createBackup();
            
            const configData = Object.fromEntries(this.config);
            const configJson = JSON.stringify(configData, null, 2);
            
            await fs.writeFile(this.configPath, configJson, 'utf8');
            
            this.emit('configurationSaved', { path: this.configPath });
            return true;
            
        } catch (error) {
            this.emit('saveError', error);
            return false;
        }
    }
    
    /**
     * Get configuration value
     * @param {string} key - Configuration key
     * @param {any} defaultValue - Default value if key not found
     * @returns {any} Configuration value
     */
    get(key, defaultValue = undefined) {
        return this.config.get(key) ?? defaultValue;
    }
    
    /**
     * Set configuration value
     * @param {string} key - Configuration key
     * @param {any} value - Configuration value
     * @returns {boolean} Success status
     */
    set(key, value) {
        try {
            // Validate the new value
            if (this.validators.has(key)) {
                const validator = this.validators.get(key);
                const isValid = validator(value);
                
                if (!isValid) {
                    this.emit('validationFailed', { key, value });
                    return false;
                }
            }
            
            const oldValue = this.config.get(key);
            this.config.set(key, value);
            
            this.emit('configurationChanged', { key, oldValue, newValue: value });
            return true;
            
        } catch (error) {
            this.emit('setError', { key, value, error });
            return false;
        }
    }
    
    /**
     * Validate configuration value
     * @param {string} key - Configuration key
     * @param {any} value - Value to validate
     * @returns {boolean} Validation result
     */
    validateConfig(key, value) {
        if (!this.validators.has(key)) {
            return true; // No validator means any value is valid
        }
        
        try {
            const validator = this.validators.get(key);
            return validator(value);
        } catch (error) {
            this.emit('validationError', { key, value, error });
            return false;
        }
    }
    
    /**
     * Register a configuration validator
     * @param {string} key - Configuration key
     * @param {Function} validator - Validation function
     */
    registerValidator(key, validator) {
        this.validators.set(key, validator);
        this.emit('validatorRegistered', { key });
    }
    
    /**
     * Create configuration backup
     * @returns {Promise<string>} Backup ID
     */
    async createBackup() {
        const backupId = `backup-${Date.now()}`;
        const backup = {
            id: backupId,
            timestamp: new Date(),
            config: new Map(this.config)
        };
        
        this.backups.push(backup);
        
        // Trim old backups
        if (this.backups.length > this.maxBackups) {
            this.backups.shift();
        }
        
        // Save backup to file
        try {
            await fs.mkdir(this.backupPath, { recursive: true });
            const backupFile = path.join(this.backupPath, `${backupId}.json`);
            const backupData = Object.fromEntries(backup.config);
            
            await fs.writeFile(backupFile, JSON.stringify({
                id: backupId,
                timestamp: backup.timestamp.toISOString(),
                config: backupData
            }, null, 2));
            
            this.emit('backupCreated', { id: backupId, file: backupFile });
            
        } catch (error) {
            this.emit('backupError', { id: backupId, error });
        }
        
        return backupId;
    }
    
    /**
     * Restore from backup
     * @param {string} backupId - Backup ID to restore
     * @returns {Promise<boolean>} Success status
     */
    async restoreFromBackup(backupId) {
        try {
            const backup = this.backups.find(b => b.id === backupId);
            
            if (!backup) {
                // Try to load from backup file
                const backupFile = path.join(this.backupPath, `${backupId}.json`);
                const backupData = await fs.readFile(backupFile, 'utf8');
                const parsedBackup = JSON.parse(backupData);
                
                this.config = new Map(Object.entries(parsedBackup.config));
            } else {
                this.config = new Map(backup.config);
            }
            
            this.emit('configurationRestored', { backupId });
            return true;
            
        } catch (error) {
            this.emit('restoreError', { backupId, error });
            return false;
        }
    }
    
    /**
     * Load configuration from environment variables
     */
    loadFromEnvironment() {
        const envMappings = {
            'SUPABASE_URL': 'supabase.url',
            'SUPABASE_ANON_KEY': 'supabase.key',
            'MINECRAFT_HOST': 'connection.host',
            'MINECRAFT_PORT': 'connection.port',
            'BOT_USERNAME': 'auth.username',
            'CONNECTION_TIMEOUT': 'connection.timeout',
            'RECONNECT_ATTEMPTS': 'connection.maxReconnectAttempts',
            'KEEP_ALIVE_INTERVAL': 'connection.keepAliveInterval',
            'PORT_SCAN_ENABLED': 'portScanning.enabled',
            'MONITORING_ENABLED': 'monitoring.enabled'
        };
        
        for (const [envVar, configKey] of Object.entries(envMappings)) {
            const value = process.env[envVar];
            if (value !== undefined) {
                this._setNestedConfig(configKey, this._parseEnvValue(value));
            }
        }
        
        this.emit('environmentLoaded', { count: Object.keys(envMappings).length });
    }
    
    /**
     * Override configuration with environment variables
     * @param {Array<string>} envVars - Environment variables to check
     */
    overrideFromEnv(envVars) {
        let overrideCount = 0;
        
        for (const envVar of envVars) {
            const value = process.env[envVar];
            if (value !== undefined) {
                const configKey = this._envVarToConfigKey(envVar);
                if (configKey) {
                    this._setNestedConfig(configKey, this._parseEnvValue(value));
                    overrideCount++;
                }
            }
        }
        
        this.emit('environmentOverride', { count: overrideCount });
    }
    
    /**
     * Get all configuration as plain object
     * @returns {Object} All configuration
     */
    getAllConfig() {
        return Object.fromEntries(this.config);
    }
    
    /**
     * Get configuration for a specific module
     * @param {string} module - Module name (e.g., 'connection', 'supabase')
     * @returns {Object} Module configuration
     */
    getModuleConfig(module) {
        const moduleConfig = {};
        
        for (const [key, value] of this.config) {
            if (key.startsWith(`${module}.`)) {
                const subKey = key.substring(module.length + 1);
                moduleConfig[subKey] = value;
            }
        }
        
        return moduleConfig;
    }
    
    /**
     * Load from settings.js file
     * @private
     * @returns {Promise<void>}
     */
    async _loadFromSettingsFile() {
        try {
            // In a real implementation, this would import the settings.js file
            // For now, we'll simulate loading some default settings
            const defaultSettings = {
                'connection.host': 'localhost',
                'connection.port': 25565,
                'connection.timeout': 10000,
                'auth.mode': 'offline'
            };
            
            for (const [key, value] of Object.entries(defaultSettings)) {
                if (!this.config.has(key)) {
                    this.config.set(key, value);
                }
            }
            
            this.emit('settingsFileLoaded');
            
        } catch (error) {
            // Settings file is optional
            this.emit('settingsFileNotFound', error);
        }
    }
    
    /**
     * Load from .env file
     * @private
     * @returns {Promise<void>}
     */
    async _loadFromEnvFile() {
        try {
            const envPath = '.env';
            const envContent = await fs.readFile(envPath, 'utf8');
            
            const lines = envContent.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                        process.env[key] = value;
                    }
                }
            }
            
            // Reload from environment after parsing .env
            this.loadFromEnvironment();
            
            this.emit('envFileLoaded', { path: envPath });
            
        } catch (error) {
            // .env file is optional
            this.emit('envFileNotFound', error);
        }
    }
    
    /**
     * Load from JSON configuration file
     * @private
     * @returns {Promise<void>}
     */
    async _loadFromConfigFile() {
        try {
            const configContent = await fs.readFile(this.configPath, 'utf8');
            const configData = JSON.parse(configContent);
            
            for (const [key, value] of Object.entries(configData)) {
                if (!this.config.has(key)) {
                    this.config.set(key, value);
                }
            }
            
            this.emit('configFileLoaded', { path: this.configPath });
            
        } catch (error) {
            // Config file is optional
            this.emit('configFileNotFound', error);
        }
    }
    
    /**
     * Apply default configuration values
     * @private
     */
    _applyDefaults() {
        const defaults = {
            'connection.maxReconnectAttempts': 5,
            'connection.reconnectDelay': 1000,
            'connection.keepAliveInterval': 30000,
            'connection.connectionTimeout': 10000,
            'portScanning.enabled': true,
            'portScanning.scanTimeout': 30000,
            'portScanning.priorityPorts': [25565, 25566, 25567],
            'portScanning.minPort': 25565,
            'portScanning.maxPort': 65535,
            'supabase.syncInterval': 30000,
            'supabase.offlineMode': true,
            'supabase.maxQueueSize': 1000,
            'monitoring.enabled': true,
            'monitoring.metricsInterval': 5000,
            'monitoring.alertThresholds.latency': 1000,
            'monitoring.alertThresholds.packetLoss': 0.05
        };
        
        for (const [key, value] of Object.entries(defaults)) {
            if (!this.config.has(key)) {
                this.config.set(key, value);
            }
        }
        
        this.emit('defaultsApplied', { count: Object.keys(defaults).length });
    }
    
    /**
     * Validate all configuration
     * @private
     * @returns {Promise<boolean>}
     */
    async _validateAllConfig() {
        let isValid = true;
        const errors = [];
        
        for (const [key, value] of this.config) {
            if (!this.validateConfig(key, value)) {
                isValid = false;
                errors.push({ key, value });
            }
        }
        
        if (!isValid) {
            this.emit('validationErrors', errors);
        }
        
        return isValid;
    }
    
    /**
     * Set nested configuration value
     * @private
     * @param {string} key - Dot-notation key
     * @param {any} value - Value to set
     */
    _setNestedConfig(key, value) {
        this.config.set(key, value);
    }
    
    /**
     * Parse environment variable value
     * @private
     * @param {string} value - Raw environment value
     * @returns {any} Parsed value
     */
    _parseEnvValue(value) {
        // Try to parse as JSON first
        try {
            return JSON.parse(value);
        } catch {
            // If not JSON, return as string
            return value;
        }
    }
    
    /**
     * Convert environment variable name to config key
     * @private
     * @param {string} envVar - Environment variable name
     * @returns {string|null} Config key or null
     */
    _envVarToConfigKey(envVar) {
        const mappings = {
            'SUPABASE_URL': 'supabase.url',
            'SUPABASE_ANON_KEY': 'supabase.key',
            'MINECRAFT_HOST': 'connection.host',
            'MINECRAFT_PORT': 'connection.port'
        };
        
        return mappings[envVar] || null;
    }
    
    /**
     * Initialize configuration validators
     * @private
     */
    _initializeValidators() {
        // Connection validators
        this.registerValidator('connection.maxReconnectAttempts', (value) => {
            return typeof value === 'number' && value >= 1 && value <= 10;
        });
        
        this.registerValidator('connection.reconnectDelay', (value) => {
            return typeof value === 'number' && value >= 500 && value <= 30000;
        });
        
        this.registerValidator('connection.keepAliveInterval', (value) => {
            return typeof value === 'number' && value >= 10000 && value <= 60000;
        });
        
        this.registerValidator('connection.connectionTimeout', (value) => {
            return typeof value === 'number' && value >= 5000 && value <= 30000;
        });
        
        // Port scanning validators
        this.registerValidator('portScanning.scanTimeout', (value) => {
            return typeof value === 'number' && value >= 10000 && value <= 60000;
        });
        
        this.registerValidator('portScanning.minPort', (value) => {
            return typeof value === 'number' && value >= 1 && value <= 65535;
        });
        
        this.registerValidator('portScanning.maxPort', (value) => {
            return typeof value === 'number' && value >= 1 && value <= 65535;
        });
        
        // Supabase validators
        this.registerValidator('supabase.syncInterval', (value) => {
            return typeof value === 'number' && value >= 10000 && value <= 300000;
        });
        
        this.registerValidator('supabase.maxQueueSize', (value) => {
            return typeof value === 'number' && value >= 100 && value <= 5000;
        });
        
        // Monitoring validators
        this.registerValidator('monitoring.metricsInterval', (value) => {
            return typeof value === 'number' && value >= 1000 && value <= 30000;
        });
        
        this.registerValidator('monitoring.alertThresholds.latency', (value) => {
            return typeof value === 'number' && value >= 100 && value <= 5000;
        });
        
        this.registerValidator('monitoring.alertThresholds.packetLoss', (value) => {
            return typeof value === 'number' && value >= 0.01 && value <= 0.5;
        });
    }
}