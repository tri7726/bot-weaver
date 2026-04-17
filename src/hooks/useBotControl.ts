import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface AgentStatus {
  name: string;
  in_game: boolean;
  viewerPort?: number;
  socket_connected: boolean;
}

export interface BotLog {
  agent: string;
  message: string;
  timestamp: number;
}

export const useBotControl = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:8080');
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('agents-status', (status: AgentStatus[]) => {
      setAgents(status);
    });

    newSocket.on('bot-output', (agentName: string, message: string) => {
      setLogs(prev => [
        ...prev, 
        { agent: agentName, message, timestamp: Date.now() }
      ].slice(-200));
    });

    newSocket.emit('listen-to-agents');

    return () => {
      newSocket.close();
    };
  }, []);

  const startAgent = useCallback((name: string) => {
    socket?.emit('start-agent', name);
  }, [socket]);

  const stopAgent = useCallback((name: string) => {
    socket?.emit('stop-agent', name);
  }, [socket]);

  const createAgent = useCallback((settings: any) => {
    return new Promise((resolve) => {
      socket?.emit('create-agent', settings, (res: any) => resolve(res));
    });
  }, [socket]);

  const testApiKey = useCallback((provider: string, apiKey: string) => {
    return new Promise<{success: boolean, message: string}>((resolve) => {
      socket?.emit('test-api-key', { provider, apiKey }, (res: any) => resolve(res));
    });
  }, [socket]);

  const launchBot = useCallback((botId: string) => {
    return new Promise((resolve) => {
      socket?.emit('launch-bot', botId, (res: any) => resolve(res));
    });
  }, [socket]);

  const triggerReflection = useCallback((agentName: string) => {
    return new Promise((resolve) => {
      socket?.emit('trigger-reflection', agentName, (res: any) => resolve(res));
    });
  }, [socket]);

  return { agents, logs, isConnected, startAgent, stopAgent, createAgent, testApiKey, launchBot, triggerReflection };
};
