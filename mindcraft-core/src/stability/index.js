/**
 * @fileoverview Minecraft Bot Stability Module
 * @description Core stability system for maintaining reliable connections to Minecraft servers
 * @version 1.0.0
 */

// Core Components
export { ConnectionManager } from './connection/ConnectionManager.js';
export { PortScanner } from './network/PortScanner.js';
export { ErrorHandler } from './error/ErrorHandler.js';
export { SupabaseSync } from './sync/SupabaseSync.js';
export { ConfigurationManager } from './config/ConfigurationManager.js';
export { StabilityMonitor } from './monitoring/StabilityMonitor.js';
export { NetworkOptimizer } from './network/NetworkOptimizer.js';

// Types and Interfaces
export * from './types/index.js';

// Configuration Schema
export { ConfigSchema } from './config/schema.js';

// Utilities
export { createStabilitySystem } from './utils/factory.js';

// Main System Class
export class StabilitySystem {
    constructor(agent, settings) {
        this.agent = agent;
        this.settings = settings;
        this.connectionManager = null;
        this.errorHandler = null;
        this.stabilityMonitor = null;
        this.supabaseSync = null;
        this.configManager = null;
    }

    async initialize() {
        const { createStabilitySystem } = await import('./utils/factory.js');
        const system = createStabilitySystem(this.agent, this.settings);
        
        this.connectionManager = system.connectionManager;
        this.errorHandler = system.errorHandler;
        this.stabilityMonitor = system.stabilityMonitor;
        this.supabaseSync = system.supabaseSync;
        this.configManager = system.configManager;
        
        console.log('Stability system initialized successfully');
    }
}