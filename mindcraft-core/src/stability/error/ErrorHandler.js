/**
 * @fileoverview Error Handler for Minecraft Bot Stability
 * @description Intelligent error classification and recovery strategies
 */

import { EventEmitter } from 'events';

/**
 * @class ErrorHandler
 * @extends EventEmitter
 * @description Handles and recovers from various types of connection errors
 */
export class ErrorHandler extends EventEmitter {
    /**
     * @param {import('../connection/ConnectionManager.js').ConnectionManager} connectionManager - Connection manager instance
     */
    constructor(connectionManager) {
        super();
        
        /** @type {import('../connection/ConnectionManager.js').ConnectionManager} */
        this.connectionManager = connectionManager;
        
        /** @type {Map<string, import('../types/index.js').RecoveryStrategy>} */
        this.recoveryStrategies = new Map();
        
        /** @type {Array<import('../types/index.js').ErrorContext>} */
        this.errorHistory = [];
        
        /** @type {number} */
        this.maxHistorySize = 100;
        
        this._initializeDefaultStrategies();
    }
    
    /**
     * Handle an error with appropriate recovery strategy
     * @param {Error} error - The error to handle
     * @param {Object} context - Additional context about the error
     * @returns {Promise<boolean>} Whether recovery was successful
     */
    async handleError(error, context = {}) {
        const errorContext = this._createErrorContext(error, context);
        this.errorHistory.push(errorContext);
        
        // Trim history if it gets too large
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
        
        this.emit('errorDetected', errorContext);
        
        const errorType = this.classifyError(error);
        errorContext.type = errorType;
        errorContext.recoverable = this._isRecoverable(errorType);
        
        this.reportError(error, context, 'detected');
        
        if (errorContext.recoverable) {
            return await this.executeRecoveryStrategy(errorType, errorContext);
        } else {
            this.reportError(error, context, 'non-recoverable');
            this.emit('nonRecoverableError', errorContext);
            return false;
        }
    }
    
    /**
     * Classify an error into a specific type
     * @param {Error} error - The error to classify
     * @returns {string} Error type classification
     */
    classifyError(error) {
        const message = error.message?.toLowerCase() || '';
        const code = error.code?.toUpperCase() || '';
        
        // Network connection errors
        if (code === 'ECONNREFUSED' || message.includes('connection refused')) {
            return 'ECONNREFUSED';
        }
        
        if (code === 'ETIMEDOUT' || message.includes('timeout')) {
            return 'ETIMEDOUT';
        }
        
        if (code === 'ENOTFOUND' || message.includes('not found')) {
            return 'ENOTFOUND';
        }
        
        if (code === 'ECONNRESET' || message.includes('connection reset')) {
            return 'ECONNRESET';
        }
        
        // Authentication errors
        if (message.includes('authentication') || message.includes('login')) {
            return 'AUTHENTICATION_ERROR';
        }
        
        if (message.includes('token') && message.includes('expired')) {
            return 'TOKEN_EXPIRED';
        }
        
        // Version compatibility errors
        if (message.includes('version') || message.includes('protocol')) {
            return 'VERSION_MISMATCH';
        }
        
        // Supabase API errors
        if (message.includes('supabase') || message.includes('api')) {
            return 'SUPABASE_API_ERROR';
        }
        
        // Configuration errors
        if (message.includes('config') || message.includes('setting')) {
            return 'CONFIGURATION_ERROR';
        }
        
        // Generic network error
        if (code.startsWith('E') && (message.includes('network') || message.includes('socket'))) {
            return 'NETWORK_ERROR';
        }
        
        // Unknown error type
        return 'UNKNOWN_ERROR';
    }
    
    /**
     * Execute recovery strategy for a specific error type
     * @param {string} errorType - Type of error
     * @param {import('../types/index.js').ErrorContext} context - Error context
     * @returns {Promise<boolean>} Whether recovery was successful
     */
    async executeRecoveryStrategy(errorType, context) {
        const strategy = this.recoveryStrategies.get(errorType);
        
        if (!strategy) {
            this.emit('noRecoveryStrategy', { errorType, context });
            return false;
        }
        
        if (context.attempts >= strategy.maxAttempts) {
            this.emit('maxAttemptsExceeded', { errorType, context, strategy });
            return false;
        }
        
        context.attempts++;
        context.lastAttempt = new Date();
        
        this.emit('recoveryAttempt', { errorType, context, strategy, attempt: context.attempts });
        
        try {
            const delay = this._calculateDelay(strategy, context.attempts);
            
            if (delay > 0) {
                await this._sleep(delay);
            }
            
            const success = await strategy.execute(context, this.connectionManager);
            
            if (success) {
                context.resolved = true;
                this.emit('recoverySuccess', { errorType, context, strategy });
                this.reportError(context.error, context, 'recovered');
            } else {
                this.emit('recoveryFailed', { errorType, context, strategy, attempt: context.attempts });
            }
            
            return success;
            
        } catch (recoveryError) {
            this.emit('recoveryError', { errorType, context, strategy, recoveryError });
            return false;
        }
    }
    
    /**
     * Register a custom recovery strategy
     * @param {string} errorType - Error type to handle
     * @param {import('../types/index.js').RecoveryStrategy} strategy - Recovery strategy
     */
    registerRecoveryStrategy(errorType, strategy) {
        this.recoveryStrategies.set(errorType, strategy);
        this.emit('strategyRegistered', { errorType, strategy });
    }
    
    /**
     * Report error details for logging and monitoring
     * @param {Error} error - The error
     * @param {Object} context - Error context
     * @param {string} action - Action taken
     */
    reportError(error, context, action) {
        const report = {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                code: error.code,
                stack: error.stack
            },
            context,
            action,
            classification: this.classifyError(error)
        };
        
        this.emit('errorReport', report);
        
        // In a full implementation, this would integrate with logging system
        console.error(`[ErrorHandler] ${action.toUpperCase()}: ${error.message}`, {
            type: report.classification,
            context: context,
            action: action
        });
    }
    
    /**
     * Get error history
     * @returns {Array<import('../types/index.js').ErrorContext>}
     */
    getErrorHistory() {
        return [...this.errorHistory];
    }
    
    /**
     * Clear error history
     */
    clearErrorHistory() {
        this.errorHistory.length = 0;
        this.emit('historyCleared');
    }
    
    /**
     * Get recovery statistics
     * @returns {Object} Recovery statistics
     */
    getRecoveryStats() {
        const total = this.errorHistory.length;
        const recovered = this.errorHistory.filter(ctx => ctx.resolved).length;
        const byType = {};
        
        this.errorHistory.forEach(ctx => {
            if (!byType[ctx.type]) {
                byType[ctx.type] = { total: 0, recovered: 0 };
            }
            byType[ctx.type].total++;
            if (ctx.resolved) {
                byType[ctx.type].recovered++;
            }
        });
        
        return {
            total,
            recovered,
            recoveryRate: total > 0 ? recovered / total : 0,
            byType
        };
    }
    
    /**
     * Create error context object
     * @private
     * @param {Error} error - The error
     * @param {Object} additionalContext - Additional context
     * @returns {import('../types/index.js').ErrorContext}
     */
    _createErrorContext(error, additionalContext) {
        return {
            error,
            timestamp: Date.now(),
            type: null,
            recoverable: null,
            attempts: 0,
            lastAttempt: null,
            resolved: false,
            ...additionalContext
        };
    }
    
    /**
     * Check if an error type is recoverable
     * @private
     * @param {string} errorType - Error type
     * @returns {boolean}
     */
    _isRecoverable(errorType) {
        const recoverableTypes = [
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ECONNRESET',
            'NETWORK_ERROR',
            'TOKEN_EXPIRED',
            'SUPABASE_API_ERROR',
            'VERSION_MISMATCH'
        ];
        
        return recoverableTypes.includes(errorType);
    }
    
    /**
     * Calculate delay for recovery attempt with exponential backoff
     * @private
     * @param {import('../types/index.js').RecoveryStrategy} strategy - Recovery strategy
     * @param {number} attempt - Attempt number
     * @returns {number} Delay in milliseconds
     */
    _calculateDelay(strategy, attempt) {
        const exponentialDelay = strategy.baseDelay * Math.pow(2, attempt - 1);
        return Math.min(exponentialDelay, strategy.maxDelay);
    }
    
    /**
     * Sleep for specified duration
     * @private
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Initialize default recovery strategies
     * @private
     */
    _initializeDefaultStrategies() {
        // ECONNREFUSED recovery strategy
        this.registerRecoveryStrategy('ECONNREFUSED', {
            name: 'Connection Refused Recovery',
            maxAttempts: 5,
            baseDelay: 1000,
            maxDelay: 30000,
            execute: async (context, connectionManager) => {
                // Try to reconnect with exponential backoff
                return await connectionManager.reconnect('ECONNREFUSED recovery');
            }
        });
        
        // Timeout recovery strategy
        this.registerRecoveryStrategy('ETIMEDOUT', {
            name: 'Timeout Recovery',
            maxAttempts: 3,
            baseDelay: 2000,
            maxDelay: 10000,
            execute: async (context, connectionManager) => {
                return await connectionManager.reconnect('timeout recovery');
            }
        });
        
        // Network error recovery strategy
        this.registerRecoveryStrategy('NETWORK_ERROR', {
            name: 'Network Error Recovery',
            maxAttempts: 4,
            baseDelay: 1500,
            maxDelay: 20000,
            execute: async (context, connectionManager) => {
                return await connectionManager.reconnect('network error recovery');
            }
        });
        
        // Supabase API error recovery strategy
        this.registerRecoveryStrategy('SUPABASE_API_ERROR', {
            name: 'Supabase API Recovery',
            maxAttempts: 5,
            baseDelay: 1000,
            maxDelay: 30000,
            execute: async (context, connectionManager) => {
                // This will be implemented when SupabaseSync is integrated
                return true;
            }
        });
    }
}