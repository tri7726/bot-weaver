import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Terminal as TerminalIcon } from "lucide-react";
import { toast } from "sonner";

type Log = {
  timestamp: string;
  botName: string;
  message: string;
  level: 'info' | 'error' | 'chat' | 'bot_chat' | 'system';
};

export function Console({ botId, botName, serverIp }: { botId: string; botName: string; serverIp: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase.channel('squad_logs', {
      config: { broadcast: { self: true } }
    })
    .on('broadcast', { event: 'log' }, (payload) => {
      const data = payload.payload;
      if (data.botId === botId) {
        setLogs((prev) => [...prev, data].slice(-100)); // Keep last 100
      }
    })
    .subscribe();

    return () => { channel.unsubscribe(); };
  }, [botId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const sendCommand = async () => {
    if (!inputValue.trim()) return;

    const { error } = await (supabase as any).from('squad_intel').insert({
        server_ip: serverIp,
        type: 'web_command',
        data: {
            botId: botId,
            command: inputValue
        }
    });

    if (error) {
        toast.error("Failed to send command: " + error.message);
    } else {
        setLogs(prev => [...prev, {
            timestamp: new Date().toISOString(),
            botName: "Web",
            message: `Command sent: ${inputValue}`,
            level: 'system'
        }]);
        setInputValue("");
    }
  };

  return (
    <div className="flex flex-col h-[400px] bg-black/90 rounded-lg border border-white/10 overflow-hidden font-mono text-xs">
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/10 text-muted-foreground">
            <TerminalIcon className="h-3 w-3" />
            <span>Tactical Console: {botName}</span>
        </div>
        
        <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            <div className="space-y-1">
                {logs.length === 0 && <div className="text-muted-foreground italic">Waiting for logs...</div>}
                {logs.map((log, i) => {
                    const colors = {
                        info: "text-blue-400",
                        error: "text-red-400",
                        chat: "text-indigo-300",
                        bot_chat: "text-emerald-400",
                        system: "text-amber-400"
                    };
                    return (
                        <div key={i} className="flex gap-2">
                            <span className="text-white/30">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                            <span className={colors[log.level]}>{log.message}</span>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>

        <div className="p-2 bg-white/5 border-t border-white/10 flex gap-2">
            <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
                placeholder="Type a command (e.g. !focus target)..."
                className="h-8 bg-black/40 border-white/10 text-[11px]"
            />
            <Button size="icon" className="h-8 w-8" onClick={sendCommand}>
                <Send className="h-3 w-3" />
            </Button>
        </div>
    </div>
  );
}
