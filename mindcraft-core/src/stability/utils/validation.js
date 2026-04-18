/**
 * @fileoverview Configuration validation utilities
 * @description Utilities for validating stability system configuration
 */

import { validateConfigValue, getSchemaForKey, getAllDefaults } from '../config/schema.js';

/**
 * Validate a complete stability configuration
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result
 */
export function validateStabilityConfig(config) {
    const errors = [];
    const warnings = [];
    const info = [];
    
    // Check required configuration sections
    const requiredSections = ['connection', 'portScanning', 'supabase', 'monitoring'];
    
    for (const section of requiredSections) {
        if (!config[section]) {
            warnings.push({
                section,
                message: `Missing configuration section: ${section}. Using defaults.`
            });
        }
    }
    
    // Validate individual configuration values
    for (const [key, value] of Object.entries(flattenConfig(config))) {
        if (!validateConfigValue(key, value)) {
            const schema = getSchemaForKey(key);
            errors.push({
                key,
                value,
                expected: schema ? `${schema.type} (${schema.min}-${schema.max})` : 'valid value',
                message: `Invalid value for ${key}: ${value}`
            });
        }
    }
    
    // Check for deprecated or unknown configuration keys
    const knownKeys = Object.keys(getAllDefaults());
    const providedKeys = Object.keys(flattenConfig(config));
    
    for (const key of providedKeys) {
        if (!knownKeys.includes(key)) {
            warnings.push({
                key,
                message: `Unknown configuration key: ${key}. This may be ignored.`
            });
        }
    }
    
    // Validate cross-field dependencies
    const crossFieldErrors = validateCrossFieldDependencies(config);
    errors.push(...crossFieldErrors);
    
    // Performance recommendations
    const recommendations = generatePerformanceRecommendations(config);
    info.push(...recommendations);
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        info,
        summary: {
            totalChecks: providedKeys.length,
            errors: errors.length,
            warnings: warnings.length,
            recommendations: info.length
        }
    };
}

/**
 * Validate cross-field dependencies in configuration
 * @param {Object} config - Configuration object
 * @returns {Array} Array of validation errors
 */
export function validateCrossFieldDependencies(config) {
    const errors = [];
    
    // Port scanning range validation
    if (config.portScanning) {
        const { minPort, maxPort } = config.portScanning;
        if (minPort && maxPort && minPort >= maxPort) {
            errors.push({
                keys: ['portScanning.minPort', 'portScanning.maxPort'],
                message: 'Port scanning minPort must be less than maxPort'
            });
        }
    }
    
    // Connection timeout vs keep-alive interval
    if (config.connection) {
        const { connectionTimeout, keepAliveInterval } = config.connection;
        if (connectionTimeout && keepAliveInterval && connectionTimeout >= keepAliveInterval) {
            errors.push({
                keys: ['connection.connectionTimeout', 'connection.keepAliveInterval'],
                message: 'Connection timeout should be less than keep-alive interval'
            });
        }
    }
    
    // Monitoring interval vs metrics collection
    if (config.monitoring) {
        const { metricsInterval } = config.monitoring;
        const { syncInterval } = config.supabase || {};
        
        if (metricsInterval && syncInterval && metricsInterval > syncInterval) {
            errors.push({
                keys: ['monitoring.metricsInterval', 'supabase.syncInterval'],
                message: 'Metrics collection interval should not exceed sync interval'
            });
        }
    }
    
    // Supabase configuration consistency
    if (config.supabase) {
        const { url, key, offlineMode } = config.supabase;
        if (!offlineMode && (!url || !key)) {
            errors.push({
                keys: ['supabase.url', 'supabase.key', 'supabase.offlineMode'],
                message: 'Supabase URL and key are required when offline mode is disabled'
            });
        }
    }
    
    return errors;
}

/**
 * Generate performance recommendations based on configuration
 * @param {Object} config - Configuration object
 * @returns {Array} Array of recommendations
 */
export function generatePerformanceRecommendations(config) {
    const recommendations = [];
    
    // Connection configuration recommendations
    if (config.connection) {
        const { maxReconnectAttempts, reconnectDelay, keepAliveInterval } = config.connection;
        
        if (maxReconnectAttempts > 7) {
            recommendations.push({
                section: 'connection',
                type: 'performance',
                message: 'Consider reducing maxReconnectAttempts for faster failure detection'
            });
        }
        
        if (reconnectDelay < 1000) {
            recommendations.push({
                section: 'connection',
                type: 'stability',
                message: 'Very low reconnect delay may cause excessive server load'
            });
        }
        
        if (keepAliveInterval < 15000) {
            recommendations.push({
                section: 'connection',
                type: 'network',
                message: 'Frequent keep-alive packets may increase network overhead'
            });
        }
    }
    
    // Port scanning recommendations
    if (config.portScanning) {
        const { scanTimeout, minPort, maxPort } = config.portScanning;
        const scanRange = maxPort - minPort;
        
        if (scanRange > 10000) {
            recommendations.push({
                section: 'portScanning',
                type: 'performance',
                message: 'Large port scan range may cause slow server detection'
            });
        }
        
        if (scanTimeout < 15000 && scanRange > 1000) {
            recommendations.push({
                section: 'portScanning',
                type: 'reliability',
                message: 'Increase scan timeout for large port ranges'
            });
        }
    }
    
    // Monitoring recommendations
    if (config.monitoring) {
        const { metricsInterval } = config.monitoring;
        
        if (metricsInterval < 2000) {
            recommendations.push({
                section: 'monitoring',
                type: 'performance',
                message: 'Very frequent metrics collection may impact performance'
            });
        }
        
        if (metricsInterval > 30000) {
            recommendations.push({
                section: 'monitoring',
                type: 'responsiveness',
                message: 'Infrequent metrics collection may delay problem detection'
            });
        }
    }
    
    // Supabase recommendations
    if (config.supabase) {
        const { syncInterval, maxQueueSize } = config.supabase;
        
        if (syncInterval < 10000) {
            recommendations.push({
                section: 'supabase',
                type: 'api_limits',
                message: 'Frequent sync may hit Supabase API rate limits'
            });
        }
        
        if (maxQueueSize > 2000) {
            recommendations.push({
                section: 'supabase',
                type: 'memory',
                message: 'Large offline queue may consume significant memory'
            });
        }
    }
    
    return recommendations;
}

/**
 * Validate environment variables for stability system
 * @returns {Object} Environment validation result
 */
export function validateEnvironment() {
    const errors = [];
    const warnings = [];
    const info = [];
    
    // Check required environment variables
    const requiredEnvVars = {
        'SUPABASE_URL': 'Supabase project URL',
        'SUPABASE_ANON_KEY': 'Supabase anonymous API key'
    };
    
    for (const [envVar, description] of Object.entries(requiredEnvVars)) {
        if (!process.env[envVar]) {
            warnings.push({
                variable: envVar,
                message: `${description} not set - Supabase will run in offline mode`
            });
        } else {
            info.push({
                variable: envVar,
                message: `${description} is configured`
            });
        }
    }
    
    // Check optional environment variables
    const optionalEnvVars = {
        'MINECRAFT_HOST': 'Default Minecraft server host',
        'MINECRAFT_PORT': 'Default Minecraft server port',
        'BOT_USERNAME': 'Bot username',
        'CONNECTION_TIMEOUT': 'Connection timeout override',
        'MONITORING_ENABLED': 'Enable/disable monitoring'
    };
    
    for (const [envVar, description] of Object.entries(optionalEnvVars)) {
        if (process.env[envVar]) {
            info.push({
                variable: envVar,
                message: `${description} is configured`
            });
        }
    }
    
    // Validate environment variable formats
    if (process.env.MINECRAFT_PORT) {
        const port = parseInt(process.env.MINECRAFT_PORT);
        if (isNaN(port) || port < 1 || port > 65535) {
            errors.push({
                variable: 'MINECRAFT_PORT',
                value: process.env.MINECRAFT_PORT,
                message: 'Invalid port number format'
            });
        }
    }
    
    if (process.env.CONNECTION_TIMEOUT) {
        const timeout = parseInt(process.env.CONNECTION_TIMEOUT);
        if (isNaN(timeout) || timeout < 1000) {
            errors.push({
                variable: 'CONNECTION_TIMEOUT',
                value: process.env.CONNECTION_TIMEOUT,
                message: 'Connection timeout must be at least 1000ms'
            });
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        info,
        summary: {
            required: Object.keys(requiredEnvVars).length,
            optional: Object.keys(optionalEnvVars).length,
            configured: info.length,
            missing: warnings.length,
            invalid: errors.length
        }
    };
}

/**
 * Flatten nested configuration object to dot notation
 * @param {Object} obj - Object to flatten
 * @param {string} prefix - Key prefix
 * @returns {Object} Flattened object
 */
function flattenConfig(obj, prefix = '') {
    const flattened = {};
    
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(flattened, flattenConfig(value, fullKey));
        } else {
            flattened[fullKey] = value;
        }
    }
    
    return flattened;
}

/**
 * Create a configuration health report
 * @param {Object} config - Configuration to analyze
 * @returns {Object} Health report
 */
export function createConfigHealthReport(config) {
    const configValidation = validateStabilityConfig(config);
    const envValidation = validateEnvironment();
    
    const overallHealth = calculateOverallHealth(configValidation, envValidation);
    
    return {
        timestamp: new Date().toISOString(),
        overallHealth,
        configuration: configValidation,
        environment: envValidation,
        recommendations: [
            ...configValidation.info,
            ...generateSecurityRecommendations(config),
            ...generateMaintenanceRecommendations(config)
        ]
    };
}

/**
 * Calculate overall configuration health score
 * @param {Object} configValidation - Configuration validation result
 * @param {Object} envValidation - Environment validation result
 * @returns {Object} Health score and status
 */
function calculateOverallHealth(configValidation, envValidation) {
    let score = 100;
    
    // Deduct points for errors
    score -= configValidation.errors.length * 20;
    score -= envValidation.errors.length * 15;
    
    // Deduct points for warnings
    score -= configValidation.warnings.length * 5;
    score -= envValidation.warnings.length * 3;
    
    score = Math.max(0, score);
    
    let status = 'excellent';
    if (score < 90) status = 'good';
    if (score < 70) status = 'fair';
    if (score < 50) status = 'poor';
    if (score < 30) status = 'critical';
    
    return {
        score,
        status,
        description: getHealthDescription(status)
    };
}

/**
 * Get health status description
 * @param {string} status - Health status
 * @returns {string} Description
 */
function getHealthDescription(status) {
    const descriptions = {
        excellent: 'Configuration is optimal with no issues detected',
        good: 'Configuration is solid with minor recommendations',
        fair: 'Configuration has some issues that should be addressed',
        poor: 'Configuration has significant issues affecting reliability',
        critical: 'Configuration has critical errors that must be fixed'
    };
    
    return descriptions[status] || 'Unknown health status';
}

/**
 * Generate security recommendations
 * @param {Object} config - Configuration object
 * @returns {Array} Security recommendations
 */
function generateSecurityRecommendations(config) {
    const recommendations = [];
    
    // Check for hardcoded credentials
    if (config.supabase && (config.supabase.url || config.supabase.key)) {
        recommendations.push({
            type: 'security',
            priority: 'high',
            message: 'Ensure Supabase credentials are stored in environment variables, not configuration files'
        });
    }
    
    // Check authentication mode
    if (config.authentication && config.authentication.mode === 'offline') {
        recommendations.push({
            type: 'security',
            priority: 'medium',
            message: 'Consider using Microsoft authentication for better security'
        });
    }
    
    return recommendations;
}

/**
 * Generate maintenance recommendations
 * @param {Object} config - Configuration object
 * @returns {Array} Maintenance recommendations
 */
function generateMaintenanceRecommendations(config) {
    const recommendations = [];
    
    recommendations.push({
        type: 'maintenance',
        priority: 'low',
        message: 'Regularly review and update configuration based on system performance'
    });
    
    recommendations.push({
        type: 'maintenance',
        priority: 'low',
        message: 'Monitor connection metrics to optimize timeout and retry settings'
    });
    
    return recommendations;
}