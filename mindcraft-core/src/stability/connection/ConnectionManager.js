/**
 * @fileoverview Connection Manager for Minecraft Bot Stability
 * @description Manages connections to Minecraft servers with enhanced stability features
 */

import { EventEmitter } from 'events';

/**
 * @class ConnectionManager
 * @extends EventEmitter
 * @description Manages stable connections to Minecraft servers with automatic reconnection
 */
export class ConnectionManager extends EventEmitter {
    /**
     * @param {Object} agent - The mindcraft agent instance
     * @param {import('../types/index.js').StabilityConfig} config - Configuration object
     */
    constructor(agent, config) {
        super();
        
        /** @type {Object} */
        this.agent = agent;
        
        /** @type {import('../types/index.js').StabilityConfig} */
        this.config = config;
        
        /** @type {import('../types/index.js').ConnectionState} */
        this.state = {
            status: 'disconnected',
            host: null,
            port: null,
            lastConnected: null,
            connectionAttempts: 0,
            quality: {
                latency: 0,
                packetLoss: 0,
                uptime: 0
            }
        };
        
        /** @type {NodeJS.Timeout|null} */
        this.keepAliveTimer = null;
        
        /** @type {NodeJS.Timeout|null} */
        this.reconnectTimer = null;
        
        /** @type {Date|null} */
        this.connectionStartTime = null;
        
        /** @type {boolean} */
        this.shouldReconnect = true;
    }
    
    /**
     * Connect to a Minecraft server
     * @param {string} host - Server hostname or IP
     * @param {number} port - Server port
     * @param {Object} options - Connection options
     * @returns {Promise<boolean>} Success status
     */
    async connect(host, port, options = {}) {
        this.state.status = 'connecting';
        this.state.host = host;
        this.state.port = port;
        this.state.connectionAttempts++;
        
        this.emit('connecting', { host, port, attempt: this.state.connectionAttempts });
        
        try {
            // This will be integrated with the actual agent connection logic
            // For now, we define the interface
            const success = await this._performConnection(host, port, options);
            
            if (success) {
                this.state.status = 'connected';
                this.state.lastConnected = new Date();
                this.connectionStartTime = new Date();
                this.startKeepAlive();
                this.emit('connected', { host, port });
                return true;
            } else {
                this.state.status = 'disconnected';
                this.emit('connectionFailed', { host, port, attempt: this.state.connectionAttempts });
                return false;
            }
        } catch (error) {
            this.state.status = 'disconnected';
            this.emit('error', error);
            return false;
        }
    }
    
    /**
     * Disconnect from the server
     * @param {boolean} graceful - Whether to disconnect gracefully
     * @returns {Promise<void>}
     */
    async disconnect(graceful = true) {
        this.shouldReconnect = false;
        this.stopKeepAlive();
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.state.status === 'connected') {
            try {
                await this._performDisconnection(graceful);
            } catch (error) {
                this.emit('error', error);
            }
        }
        
        this.state.status = 'disconnected';
        this.emit('disconnected', { graceful });
    }
    
    /**
     * Reconnect to the server
     * @param {string} reason - Reason for reconnection
     * @returns {Promise<boolean>}
     */
    async reconnect(reason) {
        if (!this.shouldReconnect) {
            return false;
        }
        
        this.state.status = 'reconnecting';
        this.emit('reconnecting', { reason, attempt: this.state.connectionAttempts + 1 });
        
        const delay = this._calculateReconnectDelay();
        
        return new Promise((resolve) => {
            this.reconnectTimer = setTimeout(async () => {
                const success = await this.connect(this.state.host, this.state.port);
                resolve(success);
            }, delay);
        });
    }
    
    /**
     * Start keep-alive mechanism
     */
    startKeepAlive() {
        if (this.keepAliveTimer) {
            return;
        }
        
        const interval = this.config.connection.keepAliveInterval;
        this.keepAliveTimer = setInterval(() => {
            this._sendKeepAlive();
        }, interval);
    }
    
    /**
     * Stop keep-alive mechanism
     */
    stopKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }
    
    /**
     * Get current connection quality metrics
     * @returns {import('../types/index.js').ConnectionQuality}
     */
    getConnectionQuality() {
        if (this.connectionStartTime && this.state.status === 'connected') {
            this.state.quality.uptime = Date.now() - this.connectionStartTime.getTime();
        }
        return { ...this.state.quality };
    }
    
    /**
     * Check if connection is stable
     * @returns {boolean}
     */
    isConnectionStable() {
        const quality = this.getConnectionQuality();
        const { alertThresholds } = this.config.monitoring;
        
        return quality.latency < alertThresholds.latency && 
               quality.packetLoss < alertThresholds.packetLoss &&
               this.state.status === 'connected';
    }
    
    /**
     * Get current uptime in milliseconds
     * @returns {number}
     */
    getUptime() {
        return this.getConnectionQuality().uptime;
    }
    
    /**
     * Check if keep-alive is active
     * @returns {boolean}
     */
    isKeepAliveActive() {
        return this.keepAliveTimer !== null;
    }
    
    /**
     * Perform the actual connection (to be integrated with agent)
     * @private
     * @param {string} host - Server hostname
     * @param {number} port - Server port
     * @param {Object} options - Connection options
     * @returns {Promise<boolean>}
     */
    async _performConnection(host, port, options) {
        // This will be integrated with agent.start() method
        // For now, return a placeholder
        return new Promise((resolve) => {
            setTimeout(() => resolve(true), 100);
        });
    }
    
    /**
     * Perform the actual disconnection
     * @private
     * @param {boolean} graceful - Whether to disconnect gracefully
     * @returns {Promise<void>}
     */
    async _performDisconnection(graceful) {
        // This will be integrated with agent disconnect logic
        return Promise.resolve();
    }
    
    /**
     * Send keep-alive packet
     * @private
     */
    _sendKeepAlive() {
        if (this.state.status === 'connected') {
            // This will send actual keep-alive packets through the agent
            this.emit('keepAlive');
        }
    }
    
    /**
     * Calculate reconnection delay with exponential backoff
     * @private
     * @returns {number} Delay in milliseconds
     */
    _calculateReconnectDelay() {
        const baseDelay = this.config.connection.reconnectDelay;
        const attempt = Math.min(this.state.connectionAttempts, 5);
        return Math.min(baseDelay * Math.pow(2, attempt), 30000);
    }
}