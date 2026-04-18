/**
 * @fileoverview Stability Monitor for Minecraft Bot Connection
 * @description Real-time monitoring and alerting for connection stability
 */

import { EventEmitter } from 'events';

/**
 * @class StabilityMonitor
 * @extends EventEmitter
 * @description Monitors connection stability and provides real-time metrics
 */
export class StabilityMonitor extends EventEmitter {
    /**
     * @param {import('../connection/ConnectionManager.js').ConnectionManager} connectionManager - Connection manager instance
     * @param {import('../types/index.js').MonitoringConfig} config - Monitoring configuration
     */
    constructor(connectionManager, config) {
        super();
        
        /** @type {import('../connection/ConnectionManager.js').ConnectionManager} */
        this.connectionManager = connectionManager;
        
        /** @type {import('../types/index.js').MonitoringConfig} */
        this.config = config;
        
        /** @type {import('../types/index.js').ConnectionMetrics} */
        this.metrics = {
            uptime: 0,
            totalConnections: 0,
            successfulConnections: 0,
            failedConnections: 0,
            averageLatency: 0,
            packetLoss: 0,
            lastUpdate: Date.now(),
            history: []
        };
        
        /** @type {NodeJS.Timeout|null} */
        this.metricsTimer = null;
        
        /** @type {Array<number>} */
        this.latencyHistory = [];
        
        /** @type {number} */
        this.maxHistorySize = 1000;
        
        /** @type {Date|null} */
        this.monitoringStartTime = null;
        
        /** @type {boolean} */
        this.isMonitoring = false;
        
        this._setupConnectionListeners();
    }
    
    /**
     * Start monitoring connection stability
     */
    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = true;
        this.monitoringStartTime = new Date();
        
        if (this.config.enabled) {
            this.metricsTimer = setInterval(() => {
                this.collectMetrics();
            }, this.config.metricsInterval);
        }
        
        this.emit('monitoringStarted', { startTime: this.monitoringStartTime });
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
            this.metricsTimer = null;
        }
        
        this.emit('monitoringStopped', { 
            duration: this.monitoringStartTime ? Date.now() - this.monitoringStartTime.getTime() : 0 
        });
    }
    
    /**
     * Collect current metrics
     */
    collectMetrics() {
        if (!this.isMonitoring) {
            return;
        }
        
        const connectionQuality = this.connectionManager.getConnectionQuality();
        const currentTime = Date.now();
        
        // Update metrics
        this.metrics.uptime = connectionQuality.uptime;
        this.metrics.lastUpdate = currentTime;
        
        // Update latency metrics
        if (connectionQuality.latency > 0) {
            this.latencyHistory.push(connectionQuality.latency);
            
            // Trim history if too large
            if (this.latencyHistory.length > this.maxHistorySize) {
                this.latencyHistory.shift();
            }
            
            // Calculate average latency
            this.metrics.averageLatency = this.latencyHistory.reduce((sum, lat) => sum + lat, 0) / this.latencyHistory.length;
        }
        
        // Update packet loss
        this.metrics.packetLoss = connectionQuality.packetLoss;
        
        // Create historical data point
        const dataPoint = {
            timestamp: currentTime,
            latency: connectionQuality.latency,
            packetLoss: connectionQuality.packetLoss,
            connected: this.connectionManager.state.status === 'connected'
        };
        
        this.metrics.history.push(dataPoint);
        
        // Trim history if too large
        if (this.metrics.history.length > this.maxHistorySize) {
            this.metrics.history.shift();
        }
        
        // Check thresholds and send alerts
        this.checkThresholds();
        
        this.emit('metricsCollected', { metrics: this.getRealtimeStatus() });
    }
    
    /**
     * Calculate total uptime since monitoring started
     * @returns {number} Uptime in milliseconds
     */
    calculateUptime() {
        if (!this.monitoringStartTime) {
            return 0;
        }
        
        return Date.now() - this.monitoringStartTime.getTime();
    }
    
    /**
     * Measure current latency to the server
     * @returns {Promise<number>} Latency in milliseconds
     */
    async measureLatency() {
        if (this.connectionManager.state.status !== 'connected') {
            return -1;
        }
        
        const startTime = Date.now();
        
        try {
            // In a real implementation, this would send a ping packet
            // For now, we simulate latency measurement
            await this._simulatePing();
            
            const latency = Date.now() - startTime;
            this.emit('latencyMeasured', { latency });
            
            return latency;
            
        } catch (error) {
            this.emit('latencyMeasurementFailed', { error });
            return -1;
        }
    }
    
    /**
     * Detect packet loss percentage
     * @returns {number} Packet loss percentage (0-1)
     */
    detectPacketLoss() {
        // In a real implementation, this would analyze actual packet statistics
        // For now, we return the current packet loss from connection quality
        return this.connectionManager.getConnectionQuality().packetLoss;
    }
    
    /**
     * Check alert thresholds and send alerts
     */
    checkThresholds() {
        const { alertThresholds } = this.config;
        const quality = this.connectionManager.getConnectionQuality();
        
        // Check latency threshold
        if (quality.latency > alertThresholds.latency) {
            this.sendAlert('high_latency', {
                current: quality.latency,
                threshold: alertThresholds.latency,
                message: `High latency detected: ${quality.latency}ms (threshold: ${alertThresholds.latency}ms)`
            });
        }
        
        // Check packet loss threshold
        if (quality.packetLoss > alertThresholds.packetLoss) {
            this.sendAlert('high_packet_loss', {
                current: quality.packetLoss,
                threshold: alertThresholds.packetLoss,
                message: `High packet loss detected: ${(quality.packetLoss * 100).toFixed(2)}% (threshold: ${(alertThresholds.packetLoss * 100).toFixed(2)}%)`
            });
        }
        
        // Check connection stability
        if (!this.connectionManager.isConnectionStable()) {
            this.sendAlert('unstable_connection', {
                message: 'Connection is unstable',
                quality: quality
            });
        }
    }
    
    /**
     * Send an alert
     * @param {string} type - Alert type
     * @param {Object} data - Alert data
     */
    sendAlert(type, data) {
        const alert = {
            type,
            timestamp: new Date(),
            data,
            severity: this._getAlertSeverity(type)
        };
        
        this.emit('alert', alert);
        
        // In a real implementation, this could send notifications
        // via email, Slack, Discord, etc.
        console.warn(`[StabilityMonitor] ALERT [${type.toUpperCase()}]: ${data.message}`);
    }
    
    /**
     * Get real-time connection status
     * @returns {Object} Current status information
     */
    getRealtimeStatus() {
        const connectionState = this.connectionManager.state;
        const quality = this.connectionManager.getConnectionQuality();
        
        return {
            status: connectionState.status,
            host: connectionState.host,
            port: connectionState.port,
            uptime: quality.uptime,
            latency: quality.latency,
            packetLoss: quality.packetLoss,
            averageLatency: this.metrics.averageLatency,
            totalConnections: this.metrics.totalConnections,
            successfulConnections: this.metrics.successfulConnections,
            failedConnections: this.metrics.failedConnections,
            successRate: this.metrics.totalConnections > 0 ? 
                this.metrics.successfulConnections / this.metrics.totalConnections : 0,
            lastUpdate: this.metrics.lastUpdate,
            isStable: this.connectionManager.isConnectionStable()
        };
    }
    
    /**
     * Get historical data for charts and analysis
     * @param {number} timeRange - Time range in milliseconds (default: 1 hour)
     * @returns {Array<import('../types/index.js').MetricsDataPoint>} Historical data
     */
    getHistoricalData(timeRange = 3600000) {
        const cutoffTime = Date.now() - timeRange;
        
        return this.metrics.history.filter(point => point.timestamp >= cutoffTime);
    }
    
    /**
     * Get connection statistics summary
     * @returns {Object} Statistics summary
     */
    getConnectionStats() {
        const totalUptime = this.calculateUptime();
        const recentHistory = this.getHistoricalData(3600000); // Last hour
        
        const connectedTime = recentHistory.reduce((total, point, index) => {
            if (point.connected && index > 0) {
                const prevPoint = recentHistory[index - 1];
                return total + (point.timestamp - prevPoint.timestamp);
            }
            return total;
        }, 0);
        
        const uptimePercentage = recentHistory.length > 0 ? 
            (connectedTime / (recentHistory[recentHistory.length - 1]?.timestamp - recentHistory[0]?.timestamp)) * 100 : 0;
        
        return {
            totalUptime,
            uptimePercentage,
            totalConnections: this.metrics.totalConnections,
            successfulConnections: this.metrics.successfulConnections,
            failedConnections: this.metrics.failedConnections,
            averageLatency: this.metrics.averageLatency,
            currentPacketLoss: this.metrics.packetLoss,
            dataPoints: this.metrics.history.length
        };
    }
    
    /**
     * Reset all metrics and history
     */
    resetMetrics() {
        this.metrics = {
            uptime: 0,
            totalConnections: 0,
            successfulConnections: 0,
            failedConnections: 0,
            averageLatency: 0,
            packetLoss: 0,
            lastUpdate: Date.now(),
            history: []
        };
        
        this.latencyHistory = [];
        this.monitoringStartTime = new Date();
        
        this.emit('metricsReset');
    }
    
    /**
     * Setup connection event listeners
     * @private
     */
    _setupConnectionListeners() {
        this.connectionManager.on('connecting', () => {
            this.metrics.totalConnections++;
        });
        
        this.connectionManager.on('connected', () => {
            this.metrics.successfulConnections++;
            this.emit('connectionEstablished');
        });
        
        this.connectionManager.on('connectionFailed', () => {
            this.metrics.failedConnections++;
            this.emit('connectionFailed');
        });
        
        this.connectionManager.on('disconnected', (data) => {
            this.emit('connectionLost', data);
        });
        
        this.connectionManager.on('reconnecting', () => {
            this.emit('reconnectionAttempt');
        });
        
        this.connectionManager.on('error', (error) => {
            this.emit('connectionError', error);
        });
    }
    
    /**
     * Simulate ping for latency measurement
     * @private
     * @returns {Promise<void>}
     */
    async _simulatePing() {
        // In a real implementation, this would send actual ping packets
        return new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
    }
    
    /**
     * Get alert severity level
     * @private
     * @param {string} type - Alert type
     * @returns {string} Severity level
     */
    _getAlertSeverity(type) {
        const severityMap = {
            'high_latency': 'warning',
            'high_packet_loss': 'warning',
            'unstable_connection': 'error',
            'connection_lost': 'critical',
            'connection_failed': 'error'
        };
        
        return severityMap[type] || 'info';
    }
}