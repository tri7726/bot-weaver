/**
 * @fileoverview Port Scanner for Minecraft Server Detection
 * @description Automatically detects Minecraft server ports on LAN
 */

import { EventEmitter } from 'events';
import net from 'net';

/**
 * @class PortScanner
 * @extends EventEmitter
 * @description Scans for available Minecraft servers on the network
 */
export class PortScanner extends EventEmitter {
    /**
     * @param {import('../types/index.js').PortScanConfig} config - Port scanning configuration
     */
    constructor(config) {
        super();
        
        /** @type {import('../types/index.js').PortScanConfig} */
        this.config = config;
        
        /** @type {number|null} */
        this.lastKnownPort = null;
        
        /** @type {Object} */
        this.scanRange = {
            min: this.config.minPort || 25565,
            max: this.config.maxPort || 65535
        };
        
        /** @type {boolean} */
        this.isScanning = false;
        
        /** @type {AbortController|null} */
        this.scanController = null;
    }
    
    /**
     * Scan for Minecraft servers on the specified host
     * @param {string} host - Host to scan (default: localhost)
     * @returns {Promise<import('../types/index.js').PortScanResult|null>}
     */
    async scanForMinecraftServer(host = 'localhost') {
        if (this.isScanning) {
            throw new Error('Scan already in progress');
        }
        
        this.isScanning = true;
        this.scanController = new AbortController();
        
        try {
            this.emit('scanStarted', { host });
            
            // First try quick scan with priority ports
            let result = await this.quickScan(host);
            
            // If quick scan fails, try full scan
            if (!result && this.config.enabled) {
                result = await this.fullScan(host);
            }
            
            this.emit('scanCompleted', { host, result });
            return result;
            
        } catch (error) {
            this.emit('scanError', { host, error });
            throw error;
        } finally {
            this.isScanning = false;
            this.scanController = null;
        }
    }
    
    /**
     * Quick scan of priority ports
     * @param {string} host - Host to scan
     * @returns {Promise<import('../types/index.js').PortScanResult|null>}
     */
    async quickScan(host = 'localhost') {
        const priorityPorts = [
            this.lastKnownPort,
            ...this.config.priorityPorts
        ].filter(port => port !== null && port !== undefined);
        
        this.emit('quickScanStarted', { host, ports: priorityPorts });
        
        for (const port of priorityPorts) {
            if (this.scanController?.signal.aborted) {
                break;
            }
            
            const result = await this.validatePort(host, port);
            if (result && result.isMinecraft) {
                this.lastKnownPort = port;
                return result;
            }
        }
        
        return null;
    }
    
    /**
     * Full range scan for Minecraft servers
     * @param {string} host - Host to scan
     * @returns {Promise<import('../types/index.js').PortScanResult|null>}
     */
    async fullScan(host = 'localhost') {
        this.emit('fullScanStarted', { host, range: this.scanRange });
        
        const batchSize = 100;
        const timeout = this.config.scanTimeout;
        const startTime = Date.now();
        
        for (let port = this.scanRange.min; port <= this.scanRange.max; port += batchSize) {
            if (this.scanController?.signal.aborted) {
                break;
            }
            
            // Check timeout
            if (Date.now() - startTime > timeout) {
                throw new Error('Scan timeout exceeded');
            }
            
            const endPort = Math.min(port + batchSize - 1, this.scanRange.max);
            const batch = await this._scanPortBatch(host, port, endPort);
            
            const minecraftPort = batch.find(result => result && result.isMinecraft);
            if (minecraftPort) {
                this.lastKnownPort = minecraftPort.port;
                return minecraftPort;
            }
            
            // Emit progress
            const progress = ((port - this.scanRange.min) / (this.scanRange.max - this.scanRange.min)) * 100;
            this.emit('scanProgress', { host, progress: Math.min(progress, 100) });
        }
        
        return null;
    }
    
    /**
     * Validate if a specific port hosts a Minecraft server
     * @param {string} host - Host to check
     * @param {number} port - Port to validate
     * @returns {Promise<import('../types/index.js').PortScanResult|null>}
     */
    async validatePort(host, port) {
        if (!port || port < 1 || port > 65535) {
            return null;
        }
        
        const startTime = Date.now();
        
        try {
            const isOpen = await this._checkPortOpen(host, port);
            if (!isOpen) {
                return null;
            }
            
            const isMinecraft = await this.isMinecraftServer(host, port);
            const responseTime = Date.now() - startTime;
            
            return {
                port,
                isMinecraft,
                version: null, // Will be detected in future versions
                responseTime
            };
            
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Check if a port hosts a Minecraft server
     * @param {string} host - Host to check
     * @param {number} port - Port to check
     * @returns {Promise<boolean>}
     */
    async isMinecraftServer(host, port) {
        // This is a simplified check - in a full implementation,
        // we would send a Minecraft server list ping packet
        // For now, we just check if the port is open and responsive
        return this._checkPortOpen(host, port);
    }
    
    /**
     * Abort current scan operation
     */
    abortScan() {
        if (this.scanController) {
            this.scanController.abort();
        }
    }
    
    /**
     * Get the last known working port
     * @returns {number|null}
     */
    getLastKnownPort() {
        return this.lastKnownPort;
    }
    
    /**
     * Set the last known working port
     * @param {number} port - Port number
     */
    setLastKnownPort(port) {
        if (port && port >= 1 && port <= 65535) {
            this.lastKnownPort = port;
        }
    }
    
    /**
     * Check if a port is open and responsive
     * @private
     * @param {string} host - Host to check
     * @param {number} port - Port to check
     * @returns {Promise<boolean>}
     */
    _checkPortOpen(host, port) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const timeout = 1000; // 1 second timeout per port
            
            socket.setTimeout(timeout);
            
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.on('error', () => {
                resolve(false);
            });
            
            try {
                socket.connect(port, host);
            } catch (error) {
                resolve(false);
            }
        });
    }
    
    /**
     * Scan a batch of ports concurrently
     * @private
     * @param {string} host - Host to scan
     * @param {number} startPort - Starting port
     * @param {number} endPort - Ending port
     * @returns {Promise<Array<import('../types/index.js').PortScanResult|null>>}
     */
    async _scanPortBatch(host, startPort, endPort) {
        const promises = [];
        
        for (let port = startPort; port <= endPort; port++) {
            promises.push(this.validatePort(host, port));
        }
        
        return Promise.all(promises);
    }
}