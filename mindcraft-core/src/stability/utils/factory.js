/**
 * @fileoverview Factory for creating stability system components
 * @description Provides a convenient way to create and configure the stability system
 */

import { ConnectionManager } from '../connection/ConnectionManager.js';
import { PortScanner } from '../network/PortScanner.js';
import { ErrorHandler } from '../error/ErrorHandler.js';
import { SupabaseSync } from '../sync/SupabaseSync.js';
import { ConfigurationManager } from '../config/ConfigurationManager.js';
import { StabilityMonitor } from '../monitoring/StabilityMonitor.js';
import { NetworkOptimizer } from '../network/NetworkOptimizer.js';
import { ConfigSchema, createDefaultConfiguration } from '../config/schema.js';

/**
 * Create a complete stability system with all components
 * @param {Object} agent - The mindcraft agent instance
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Stability system components
 */
export async function createStabilitySystem(agent, options = {}) {
    // Create configuration manager
    const configManager = new ConfigurationManager(options.config);
    
    // Load configuration
    await configManager.loadConfiguration();
    
    // Get configuration for each component
    const connectionConfig = configManager.getModuleConfig('connection');
    const portScanConfig = configManager.getModuleConfig('portScanning');
    const supabaseConfig = {
        ...configManager.getModuleConfig('supabase'),
        url: process.env.SUPABASE_URL || null,
        key: process.env.SUPABASE_ANON_KEY || null
    };
    const monitoringConfig = configManager.getModuleConfig('monitoring');
    const networkConfig = configManager.getModuleConfig('networkOptimization');
    
    // Create core components
    const connectionManager = new ConnectionManager(agent, {
        connection: connectionConfig,
        monitoring: monitoringConfig
    });
    
    const portScanner = new PortScanner(portScanConfig);
    const errorHandler = new ErrorHandler(connectionManager);
    const supabaseSync = new SupabaseSync(supabaseConfig);
    const stabilityMonitor = new StabilityMonitor(connectionManager, monitoringConfig);
    const networkOptimizer = new NetworkOptimizer(connectionManager, networkConfig);
    
    // Wire up components
    _wireComponents({
        connectionManager,
        portScanner,
        errorHandler,
        supabaseSync,
        stabilityMonitor,
        networkOptimizer,
        configManager
    });
    
    // Initialize components
    await _initializeComponents({
        supabaseSync,
        stabilityMonitor,
        networkOptimizer
    });
    
    return {
        connectionManager,
        portScanner,
        errorHandler,
        supabaseSync,
        configManager,
        stabilityMonitor,
        networkOptimizer,
        
        // Convenience methods
        async start() {
            stabilityMonitor.startMonitoring();
            networkOptimizer.startOptimization();
        },
        
        async stop() {
            stabilityMonitor.stopMonitoring();
            networkOptimizer.stopOptimization();
            await supabaseSync.shutdown();
        },
        
        getStatus() {
            return {
                connection: connectionManager.state,
                monitoring: stabilityMonitor.getRealtimeStatus(),
                optimization: networkOptimizer.getOptimizationStatus(),
                supabase: supabaseSync.getSyncStatus()
            };
        }
    };
}

/**
 * Create a minimal stability system for testing
 * @param {Object} agent - The mindcraft agent instance
 * @returns {Object} Minimal stability system
 */
export function createMinimalStabilitySystem(agent) {
    const config = createDefaultConfiguration();
    
    const connectionManager = new ConnectionManager(agent, {
        connection: config.connection,
        monitoring: config.monitoring
    });
    
    const errorHandler = new ErrorHandler(connectionManager);
    
    // Wire minimal components
    connectionManager.on('error', (error) => {
        errorHandler.handleError(error, { source: 'connection' });
    });
    
    return {
        connectionManager,
        errorHandler
    };
}

/**
 * Wire up component interactions
 * @private
 * @param {Object} components - All system components
 */
function _wireComponents(components) {
    const {
        connectionManager,
        portScanner,
        errorHandler,
        supabaseSync,
        stabilityMonitor,
        networkOptimizer,
        configManager
    } = components;
    
    // Connection Manager <-> Error Handler
    connectionManager.on('error', (error) => {
        errorHandler.handleError(error, { source: 'connection' });
    });
    
    connectionManager.on('connectionFailed', (data) => {
        errorHandler.handleError(new Error('Connection failed'), { 
            source: 'connection',
            host: data.host,
            port: data.port,
            attempt: data.attempt
        });
    });
    
    // Error Handler -> Port Scanner (for connection failures)
    errorHandler.on('recoveryAttempt', async (data) => {
        if (data.errorType === 'ECONNREFUSED' && data.attempt === 1) {
            // Try port scanning on first recovery attempt
            try {
                const result = await portScanner.scanForMinecraftServer(connectionManager.state.host);
                if (result && result.port !== connectionManager.state.port) {
                    configManager.set('connection.port', result.port);
                    connectionManager.state.port = result.port;
                }
            } catch (error) {
                // Port scanning failed, continue with normal recovery
            }
        }
    });
    
    // Connection Manager -> Supabase Sync
    connectionManager.on('connected', () => {
        supabaseSync.sync().catch(() => {
            // Sync failure is handled internally by SupabaseSync
        });
    });
    
    // Stability Monitor -> Supabase Sync (for metrics)
    stabilityMonitor.on('metricsCollected', (data) => {
        supabaseSync.queueForSync({
            type: 'metrics',
            data: data.metrics,
            timestamp: Date.now()
        }).catch(() => {
            // Queue failure is handled internally
        });
    });
    
    // Network Optimizer -> Connection Manager
    networkOptimizer.on('timeoutsAdjusted', (data) => {
        // In a full implementation, this would adjust connection timeouts
        connectionManager.emit('timeoutsUpdated', data);
    });
    
    // Configuration Manager -> All Components
    configManager.on('configurationChanged', (data) => {
        // Notify components of configuration changes
        connectionManager.emit('configChanged', data);
        portScanner.emit('configChanged', data);
        supabaseSync.emit('configChanged', data);
        stabilityMonitor.emit('configChanged', data);
        networkOptimizer.emit('configChanged', data);
    });
    
    // Port Scanner -> Configuration Manager
    portScanner.on('scanCompleted', (data) => {
        if (data.result && data.result.port) {
            portScanner.setLastKnownPort(data.result.port);
        }
    });
    
    // Error Handler -> Stability Monitor (for error tracking)
    errorHandler.on('errorReport', (report) => {
        stabilityMonitor.emit('errorReported', report);
    });
}

/**
 * Initialize components that require async setup
 * @private
 * @param {Object} components - Components to initialize
 */
async function _initializeComponents(components) {
    const { supabaseSync, stabilityMonitor, networkOptimizer } = components;
    
    try {
        // Initialize Supabase connection
        await supabaseSync.initialize();
    } catch (error) {
        console.warn('[StabilitySystem] Supabase initialization failed:', error.message);
    }
    
    // Start monitoring (if enabled)
    if (stabilityMonitor.config.enabled) {
        stabilityMonitor.startMonitoring();
    }
    
    // Network optimizer will start when connection is established
}

/**
 * Create configuration for specific use cases
 * @param {string} useCase - Use case name
 * @returns {Object} Configuration object
 */
export function createConfigForUseCase(useCase) {
    const baseConfig = createDefaultConfiguration();
    
    switch (useCase) {
        case 'development':
            return {
                ...baseConfig,
                'connection.maxReconnectAttempts': 3,
                'connection.reconnectDelay': 500,
                'monitoring.metricsInterval': 1000,
                'portScanning.scanTimeout': 10000
            };
            
        case 'production':
            return {
                ...baseConfig,
                'connection.maxReconnectAttempts': 10,
                'connection.reconnectDelay': 2000,
                'monitoring.metricsInterval': 10000,
                'supabase.syncInterval': 60000
            };
            
        case 'testing':
            return {
                ...baseConfig,
                'connection.maxReconnectAttempts': 1,
                'connection.reconnectDelay': 100,
                'monitoring.enabled': false,
                'portScanning.enabled': false,
                'supabase.offlineMode': true
            };
            
        default:
            return baseConfig;
    }
}

/**
 * Validate system requirements
 * @param {Object} agent - The mindcraft agent instance
 * @returns {Object} Validation result
 */
export function validateSystemRequirements(agent) {
    const errors = [];
    const warnings = [];
    
    // Check agent requirements
    if (!agent) {
        errors.push('Agent instance is required');
    } else {
        if (typeof agent.start !== 'function') {
            warnings.push('Agent does not have start() method');
        }
        
        if (typeof agent.end !== 'function') {
            warnings.push('Agent does not have end() method');
        }
    }
    
    // Check environment variables
    if (!process.env.SUPABASE_URL) {
        warnings.push('SUPABASE_URL environment variable not set - Supabase sync will run in offline mode');
    }
    
    if (!process.env.SUPABASE_ANON_KEY) {
        warnings.push('SUPABASE_ANON_KEY environment variable not set - Supabase sync will run in offline mode');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}