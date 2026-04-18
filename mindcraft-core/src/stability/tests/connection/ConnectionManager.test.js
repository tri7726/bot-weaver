/**
 * @fileoverview Tests for ConnectionManager
 * @description Unit and property-based tests for connection management
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ConnectionManager } from '../../connection/ConnectionManager.js';
import { createMockAgent, createTestConfig, simulateTime } from '../setup.js';

describe('ConnectionManager', () => {
    test('should initialize with correct default state', () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        assert.strictEqual(connectionManager.state.status, 'disconnected');
        assert.strictEqual(connectionManager.state.host, null);
        assert.strictEqual(connectionManager.state.port, null);
        assert.strictEqual(connectionManager.state.connectionAttempts, 0);
    });
    
    test('should update state when connecting', async () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        // Mock the connection to succeed
        connectionManager._performConnection = async () => true;
        
        const result = await connectionManager.connect('localhost', 25565);
        
        assert.strictEqual(result, true);
        assert.strictEqual(connectionManager.state.status, 'connected');
        assert.strictEqual(connectionManager.state.host, 'localhost');
        assert.strictEqual(connectionManager.state.port, 25565);
        assert.strictEqual(connectionManager.state.connectionAttempts, 1);
    });
    
    test('should start keep-alive when connected', async () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        connectionManager._performConnection = async () => true;
        
        await connectionManager.connect('localhost', 25565);
        
        assert.strictEqual(connectionManager.isKeepAliveActive(), true);
    });
    
    test('should calculate exponential backoff delay', () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig({
            connection: { reconnectDelay: 1000 }
        });
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        connectionManager.state.connectionAttempts = 1;
        const delay1 = connectionManager._calculateReconnectDelay();
        
        connectionManager.state.connectionAttempts = 2;
        const delay2 = connectionManager._calculateReconnectDelay();
        
        connectionManager.state.connectionAttempts = 3;
        const delay3 = connectionManager._calculateReconnectDelay();
        
        assert.ok(delay2 > delay1, 'Delay should increase exponentially');
        assert.ok(delay3 > delay2, 'Delay should continue increasing');
        assert.ok(delay3 <= 30000, 'Delay should be capped at 30 seconds');
    });
    
    test('should emit events during connection lifecycle', async () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        const events = [];
        connectionManager.on('connecting', (data) => events.push({ type: 'connecting', data }));
        connectionManager.on('connected', (data) => events.push({ type: 'connected', data }));
        
        connectionManager._performConnection = async () => true;
        
        await connectionManager.connect('localhost', 25565);
        
        assert.strictEqual(events.length, 2);
        assert.strictEqual(events[0].type, 'connecting');
        assert.strictEqual(events[1].type, 'connected');
    });
    
    test('should handle connection failure gracefully', async () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        const events = [];
        connectionManager.on('connectionFailed', (data) => events.push({ type: 'connectionFailed', data }));
        
        connectionManager._performConnection = async () => false;
        
        const result = await connectionManager.connect('localhost', 25565);
        
        assert.strictEqual(result, false);
        assert.strictEqual(connectionManager.state.status, 'disconnected');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'connectionFailed');
    });
    
    test('should stop keep-alive when disconnecting', async () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        connectionManager._performConnection = async () => true;
        connectionManager._performDisconnection = async () => {};
        
        await connectionManager.connect('localhost', 25565);
        assert.strictEqual(connectionManager.isKeepAliveActive(), true);
        
        await connectionManager.disconnect();
        assert.strictEqual(connectionManager.isKeepAliveActive(), false);
        assert.strictEqual(connectionManager.state.status, 'disconnected');
    });
    
    test('should track connection quality metrics', async () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        connectionManager._performConnection = async () => true;
        
        await connectionManager.connect('localhost', 25565);
        
        // Simulate some time passing
        await simulateTime(1000);
        
        const quality = connectionManager.getConnectionQuality();
        
        assert.ok(quality.uptime >= 0, 'Uptime should be tracked');
        assert.strictEqual(typeof quality.latency, 'number');
        assert.strictEqual(typeof quality.packetLoss, 'number');
    });
});

// Property-based test examples (would use fast-check in real implementation)
describe('ConnectionManager Properties', () => {
    test('Property: Connection attempts should always increment', async () => {
        // This would be a proper property test with fast-check
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        connectionManager._performConnection = async () => Math.random() > 0.5;
        
        const initialAttempts = connectionManager.state.connectionAttempts;
        
        await connectionManager.connect('localhost', 25565);
        
        assert.ok(connectionManager.state.connectionAttempts > initialAttempts,
            'Connection attempts should always increment');
    });
    
    test('Property: Keep-alive should be active only when connected', async () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        // Initially disconnected
        assert.strictEqual(connectionManager.isKeepAliveActive(), false);
        
        connectionManager._performConnection = async () => true;
        await connectionManager.connect('localhost', 25565);
        
        // Should be active when connected
        assert.strictEqual(connectionManager.isKeepAliveActive(), true);
        
        connectionManager._performDisconnection = async () => {};
        await connectionManager.disconnect();
        
        // Should be inactive when disconnected
        assert.strictEqual(connectionManager.isKeepAliveActive(), false);
    });
    
    test('Property: Uptime should increase while connected', async () => {
        const mockAgent = createMockAgent();
        const config = createTestConfig();
        const connectionManager = new ConnectionManager(mockAgent, config);
        
        connectionManager._performConnection = async () => true;
        
        await connectionManager.connect('localhost', 25565);
        
        const uptime1 = connectionManager.getUptime();
        
        await simulateTime(100);
        
        const uptime2 = connectionManager.getUptime();
        
        assert.ok(uptime2 >= uptime1, 'Uptime should increase while connected');
    });
});

/**
 * Example of how property tests would look with fast-check
 * 
 * import fc from 'fast-check';
 * 
 * test('Property 1: Connection Stability Maintenance', () => {
 *     fc.assert(fc.property(
 *         fc.record({
 *             host: fc.string(),
 *             port: fc.integer(1024, 65535),
 *             networkConditions: fc.record({
 *                 latency: fc.integer(0, 500),
 *                 packetLoss: fc.float(0, 0.01)
 *             })
 *         }),
 *         async (config) => {
 *             const connectionManager = new ConnectionManager(mockAgent, config);
 *             const startTime = Date.now();
 *             
 *             await connectionManager.connect(config.host, config.port);
 *             
 *             // Simulate 5+ minutes of operation
 *             await simulateTime(5 * 60 * 1000, config.networkConditions);
 *             
 *             const uptime = connectionManager.getUptime();
 *             assert.ok(uptime >= 5 * 60 * 1000);
 *             assert.strictEqual(connectionManager.isKeepAliveActive(), true);
 *         }
 *     ), { numRuns: 100 });
 * });
 */