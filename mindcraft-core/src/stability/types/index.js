/**
 * @fileoverview TypeScript-style JSDoc type definitions for Minecraft Bot Stability
 * @description Core interfaces and type definitions for all stability components
 */

/**
 * @typedef {Object} ConnectionState
 * @property {'disconnected'|'connecting'|'connected'|'reconnecting'} status - Current connection status
 * @property {string|null} host - Server hostname or IP
 * @property {number|null} port - Server port number
 * @property {Date|null} lastConnected - Timestamp of last successful connection
 * @property {number} connectionAttempts - Number of connection attempts made
 * @property {ConnectionQuality} quality - Connection quality metrics
 */

/**
 * @typedef {Object} ConnectionQuality
 * @property {number} latency - Current latency in milliseconds
 * @property {number} packetLoss - Packet loss percentage (0-1)
 * @property {number} uptime - Connection uptime in milliseconds
 */

/**
 * @typedef {Object} ErrorContext
 * @property {Error} error - The original error object
 * @property {number} timestamp - Error timestamp
 * @property {'recoverable'|'non-recoverable'|null} type - Error classification
 * @property {boolean|null} recoverable - Whether error is recoverable
 * @property {number} attempts - Number of recovery attempts
 * @property {Date|null} lastAttempt - Timestamp of last recovery attempt
 * @property {boolean} resolved - Whether error has been resolved
 */

/**
 * @typedef {Object} ConnectionMetrics
 * @property {number} uptime - Total uptime in milliseconds
 * @property {number} totalConnections - Total connection attempts
 * @property {number} successfulConnections - Successful connections
 * @property {number} failedConnections - Failed connections
 * @property {number} averageLatency - Average latency in milliseconds
 * @property {number} packetLoss - Current packet loss percentage
 * @property {number} lastUpdate - Last metrics update timestamp
 * @property {Array<MetricsDataPoint>} history - Historical metrics data
 */

/**
 * @typedef {Object} MetricsDataPoint
 * @property {number} timestamp - Data point timestamp
 * @property {number} latency - Latency at this point
 * @property {number} packetLoss - Packet loss at this point
 * @property {boolean} connected - Connection status at this point
 */

/**
 * @typedef {Object} PortScanResult
 * @property {number} port - Discovered port number
 * @property {boolean} isMinecraft - Whether port hosts a Minecraft server
 * @property {string|null} version - Minecraft version if detected
 * @property {number} responseTime - Port response time in milliseconds
 */

/**
 * @typedef {Object} StabilityConfig
 * @property {ConnectionConfig} connection - Connection-related configuration
 * @property {PortScanConfig} portScanning - Port scanning configuration
 * @property {SupabaseConfig} supabase - Supabase integration configuration
 * @property {MonitoringConfig} monitoring - Monitoring and alerting configuration
 */

/**
 * @typedef {Object} ConnectionConfig
 * @property {number} maxReconnectAttempts - Maximum reconnection attempts
 * @property {number} reconnectDelay - Base reconnection delay in milliseconds
 * @property {number} keepAliveInterval - Keep-alive packet interval
 * @property {number} connectionTimeout - Connection timeout in milliseconds
 */

/**
 * @typedef {Object} PortScanConfig
 * @property {boolean} enabled - Whether port scanning is enabled
 * @property {number} scanTimeout - Port scan timeout in milliseconds
 * @property {Array<number>} priorityPorts - Ports to check first
 * @property {number} minPort - Minimum port in scan range
 * @property {number} maxPort - Maximum port in scan range
 */

/**
 * @typedef {Object} SupabaseConfig
 * @property {number} syncInterval - Data sync interval in milliseconds
 * @property {boolean} offlineMode - Whether offline mode is enabled
 * @property {number} maxQueueSize - Maximum offline queue size
 * @property {string|null} url - Supabase URL from environment
 * @property {string|null} key - Supabase API key from environment
 */

/**
 * @typedef {Object} MonitoringConfig
 * @property {boolean} enabled - Whether monitoring is enabled
 * @property {number} metricsInterval - Metrics collection interval
 * @property {AlertThresholds} alertThresholds - Alert threshold configuration
 */

/**
 * @typedef {Object} AlertThresholds
 * @property {number} latency - Latency threshold in milliseconds
 * @property {number} packetLoss - Packet loss threshold (0-1)
 */

/**
 * @typedef {Object} RecoveryStrategy
 * @property {string} name - Strategy name
 * @property {number} maxAttempts - Maximum recovery attempts
 * @property {number} baseDelay - Base delay between attempts
 * @property {number} maxDelay - Maximum delay between attempts
 * @property {Function} execute - Strategy execution function
 */

/**
 * @typedef {Object} NetworkConditions
 * @property {number} latency - Current network latency
 * @property {number} bandwidth - Available bandwidth
 * @property {number} packetLoss - Current packet loss rate
 * @property {boolean} stable - Whether network is stable
 */

/**
 * @typedef {Object} AuthenticationContext
 * @property {'offline'|'microsoft'} mode - Authentication mode
 * @property {string} username - Player username
 * @property {string|null} accessToken - Microsoft access token
 * @property {Date|null} tokenExpiry - Token expiration date
 * @property {boolean} validated - Whether username is validated
 */

export {
    // Re-export all types for external use
    // Types are defined above as JSDoc typedefs
};