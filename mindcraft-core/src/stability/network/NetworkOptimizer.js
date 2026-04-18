/**
 * @fileoverview Network Optimizer for Minecraft Bot Stability
 * @description Optimizes network usage and adapts to changing conditions
 */

import { EventEmitter } from 'events';

/**
 * @class NetworkOptimizer
 * @extends EventEmitter
 * @description Optimizes network performance and adapts to conditions
 */
export class NetworkOptimizer extends EventEmitter {
    /**
     * @param {import('../connection/ConnectionManager.js').ConnectionManager} connectionManager - Connection manager instance
     * @param {Object} config - Network optimization configuration
     */
    constructor(connectionManager, config = {}) {
        super();
        
        /** @type {import('../connection/ConnectionManager.js').ConnectionManager} */
        this.connectionManager = connectionManager;
        
        /** @type {Object} */
        this.config = {
            enabled: true,
            adaptivePacketRate: true,
            compressionEnabled: true,
            packetPrioritization: true,
            dynamicTimeouts: true,
            ...config
        };
        
        /** @type {import('../types/index.js').NetworkConditions} */
        this.networkConditions = {
            latency: 0,
            bandwidth: 0,
            packetLoss: 0,
            stable: true
        };
        
        /** @type {Object} */
        this.adaptiveSettings = {
            packetRate: 20, // packets per second
            compressionLevel: 1,
            timeoutMultiplier: 1.0,
            priorityMode: false
        };
        
        /** @type {Array<string>} */
        this.criticalPacketTypes = [
            'movement',
            'chat',
            'player_action',
            'keep_alive'
        ];
        
        /** @type {Array<string>} */
        this.nonCriticalPacketTypes = [
            'chunk_data',
            'entity_metadata',
            'sound_effect',
            'particle'
        ];
        
        /** @type {NodeJS.Timeout|null} */
        this.optimizationTimer = null;
        
        /** @type {boolean} */
        this.isOptimizing = false;
        
        this._setupConnectionListeners();
    }
    
    /**
     * Start network optimization
     */
    startOptimization() {
        if (this.isOptimizing || !this.config.enabled) {
            return;
        }
        
        this.isOptimizing = true;
        
        // Start periodic optimization
        this.optimizationTimer = setInterval(() => {
            this.adaptToNetworkConditions();
        }, 5000); // Check every 5 seconds
        
        this.emit('optimizationStarted');
    }
    
    /**
     * Stop network optimization
     */
    stopOptimization() {
        if (!this.isOptimizing) {
            return;
        }
        
        this.isOptimizing = false;
        
        if (this.optimizationTimer) {
            clearInterval(this.optimizationTimer);
            this.optimizationTimer = null;
        }
        
        this.emit('optimizationStopped');
    }
    
    /**
     * Adapt to current network conditions
     */
    adaptToNetworkConditions() {
        if (!this.isOptimizing) {
            return;
        }
        
        // Update network conditions
        this._updateNetworkConditions();
        
        // Adjust settings based on conditions
        if (this.config.adaptivePacketRate) {
            this.adjustPacketRate(this.networkConditions);
        }
        
        if (this.config.compressionEnabled) {
            this.enableCompression();
        }
        
        if (this.config.dynamicTimeouts) {
            this.calculateOptimalTimeouts();
        }
        
        if (this.config.packetPrioritization) {
            this.handleHighLatency();
        }
        
        this.emit('networkAdapted', {
            conditions: this.networkConditions,
            settings: this.adaptiveSettings
        });
    }
    
    /**
     * Adjust packet send rate based on network conditions
     * @param {import('../types/index.js').NetworkConditions} conditions - Current network conditions
     */
    adjustPacketRate(conditions) {
        let newRate = 20; // Default rate
        
        if (conditions.latency > 500) {
            // High latency - reduce packet rate
            newRate = Math.max(5, 20 - Math.floor(conditions.latency / 100));
        } else if (conditions.latency < 100 && conditions.stable) {
            // Low latency and stable - can increase rate
            newRate = Math.min(50, 20 + Math.floor((100 - conditions.latency) / 20));
        }
        
        // Adjust for packet loss
        if (conditions.packetLoss > 0.02) {
            newRate = Math.max(5, newRate * (1 - conditions.packetLoss));
        }
        
        if (newRate !== this.adaptiveSettings.packetRate) {
            this.adaptiveSettings.packetRate = newRate;
            this.emit('packetRateAdjusted', { 
                oldRate: this.adaptiveSettings.packetRate,
                newRate,
                reason: 'network_conditions'
            });
        }
    }
    
    /**
     * Enable compression based on network conditions
     */
    enableCompression() {
        let compressionLevel = 1;
        
        if (this.networkConditions.bandwidth < 1000000) { // Less than 1 Mbps
            compressionLevel = 3; // Higher compression for low bandwidth
        } else if (this.networkConditions.latency > 200) {
            compressionLevel = 2; // Medium compression for high latency
        }
        
        if (compressionLevel !== this.adaptiveSettings.compressionLevel) {
            this.adaptiveSettings.compressionLevel = compressionLevel;
            this.emit('compressionAdjusted', { 
                level: compressionLevel,
                reason: 'bandwidth_optimization'
            });
        }
    }
    
    /**
     * Handle high latency situations
     */
    handleHighLatency() {
        const highLatencyThreshold = 300;
        const wasInPriorityMode = this.adaptiveSettings.priorityMode;
        
        if (this.networkConditions.latency > highLatencyThreshold) {
            if (!this.adaptiveSettings.priorityMode) {
                this.adaptiveSettings.priorityMode = true;
                this.emit('priorityModeEnabled', { 
                    latency: this.networkConditions.latency,
                    threshold: highLatencyThreshold
                });
            }
        } else if (this.networkConditions.latency < highLatencyThreshold * 0.8) {
            if (this.adaptiveSettings.priorityMode) {
                this.adaptiveSettings.priorityMode = false;
                this.emit('priorityModeDisabled', { 
                    latency: this.networkConditions.latency
                });
            }
        }
    }
    
    /**
     * Prioritize packets based on importance
     * @param {Array<Object>} packets - Packets to prioritize
     * @returns {Array<Object>} Prioritized packets
     */
    prioritizePackets(packets) {
        if (!this.config.packetPrioritization || !this.adaptiveSettings.priorityMode) {
            return packets;
        }
        
        const critical = [];
        const normal = [];
        const nonCritical = [];
        
        for (const packet of packets) {
            if (this.criticalPacketTypes.includes(packet.type)) {
                critical.push(packet);
            } else if (this.nonCriticalPacketTypes.includes(packet.type)) {
                nonCritical.push(packet);
            } else {
                normal.push(packet);
            }
        }
        
        // Return in priority order
        const prioritized = [...critical, ...normal, ...nonCritical];
        
        if (prioritized.length !== packets.length) {
            this.emit('packetsPrioritized', {
                total: packets.length,
                critical: critical.length,
                normal: normal.length,
                nonCritical: nonCritical.length
            });
        }
        
        return prioritized;
    }
    
    /**
     * Calculate optimal timeouts based on network conditions
     */
    calculateOptimalTimeouts() {
        let multiplier = 1.0;
        
        // Increase timeouts for high latency
        if (this.networkConditions.latency > 200) {
            multiplier = 1 + (this.networkConditions.latency - 200) / 1000;
        }
        
        // Increase timeouts for packet loss
        if (this.networkConditions.packetLoss > 0.01) {
            multiplier *= (1 + this.networkConditions.packetLoss * 2);
        }
        
        // Cap the multiplier
        multiplier = Math.min(multiplier, 3.0);
        
        if (Math.abs(multiplier - this.adaptiveSettings.timeoutMultiplier) > 0.1) {
            this.adaptiveSettings.timeoutMultiplier = multiplier;
            this.emit('timeoutsAdjusted', { 
                multiplier,
                baseTimeout: 10000,
                adjustedTimeout: 10000 * multiplier
            });
        }
    }
    
    /**
     * Set dynamic timeouts for network operations
     * @param {number} baseTimeout - Base timeout in milliseconds
     * @returns {number} Adjusted timeout
     */
    setDynamicTimeouts(baseTimeout) {
        return Math.floor(baseTimeout * this.adaptiveSettings.timeoutMultiplier);
    }
    
    /**
     * Get current network optimization status
     * @returns {Object} Optimization status
     */
    getOptimizationStatus() {
        return {
            isOptimizing: this.isOptimizing,
            networkConditions: { ...this.networkConditions },
            adaptiveSettings: { ...this.adaptiveSettings },
            config: { ...this.config }
        };
    }
    
    /**
     * Force network conditions update
     */
    updateNetworkConditions() {
        this._updateNetworkConditions();
        this.emit('networkConditionsUpdated', this.networkConditions);
    }
    
    /**
     * Get recommended settings for current conditions
     * @returns {Object} Recommended settings
     */
    getRecommendedSettings() {
        const conditions = this.networkConditions;
        
        return {
            packetRate: this.adaptiveSettings.packetRate,
            compressionLevel: this.adaptiveSettings.compressionLevel,
            timeoutMultiplier: this.adaptiveSettings.timeoutMultiplier,
            priorityMode: this.adaptiveSettings.priorityMode,
            recommendations: {
                reduceNonCriticalTraffic: conditions.latency > 300 || conditions.packetLoss > 0.05,
                enableAggression: conditions.latency < 50 && conditions.stable,
                useCompression: conditions.bandwidth < 2000000,
                increaseBatchSize: conditions.latency > 100
            }
        };
    }
    
    /**
     * Update network conditions based on connection quality
     * @private
     */
    _updateNetworkConditions() {
        const quality = this.connectionManager.getConnectionQuality();
        
        this.networkConditions.latency = quality.latency;
        this.networkConditions.packetLoss = quality.packetLoss;
        
        // Estimate bandwidth (simplified)
        this.networkConditions.bandwidth = this._estimateBandwidth();
        
        // Determine stability
        this.networkConditions.stable = this._isNetworkStable();
    }
    
    /**
     * Estimate available bandwidth
     * @private
     * @returns {number} Estimated bandwidth in bits per second
     */
    _estimateBandwidth() {
        // Simplified bandwidth estimation based on latency and packet loss
        let estimatedBandwidth = 10000000; // 10 Mbps default
        
        if (this.networkConditions.latency > 100) {
            estimatedBandwidth *= 0.8;
        }
        
        if (this.networkConditions.packetLoss > 0.01) {
            estimatedBandwidth *= (1 - this.networkConditions.packetLoss);
        }
        
        return Math.max(estimatedBandwidth, 1000000); // Minimum 1 Mbps
    }
    
    /**
     * Determine if network is stable
     * @private
     * @returns {boolean} Network stability
     */
    _isNetworkStable() {
        return this.networkConditions.latency < 200 && 
               this.networkConditions.packetLoss < 0.02 &&
               this.connectionManager.isConnectionStable();
    }
    
    /**
     * Setup connection event listeners
     * @private
     */
    _setupConnectionListeners() {
        this.connectionManager.on('connected', () => {
            this.startOptimization();
        });
        
        this.connectionManager.on('disconnected', () => {
            this.stopOptimization();
        });
        
        this.connectionManager.on('reconnecting', () => {
            // Reset adaptive settings on reconnection
            this.adaptiveSettings = {
                packetRate: 20,
                compressionLevel: 1,
                timeoutMultiplier: 1.0,
                priorityMode: false
            };
        });
    }
}