import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBotControl } from "@/hooks/useBotControl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Square, Pencil, Trash2, Bot as BotIcon, Activity } from "lucide-react";
import { toast } from "sonner";

type Bot = {
  id: string; name: string; minecraft_username: string; host: string; port: number;
  auth_type: string; status: string; use_global_keys: boolean;
};

export default function Bots() {
  const [dbBots, setDbBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const { agents, launchBot, stopAgent, isConnected } = useBotControl();

  useEffect(() => { 
    document.title = "My Bots · Mindcraft Manager"; 
    load(); 
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("bots").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setDbBots((data ?? []) as Bot[]);
    setLoading(false);
  }

  async function toggleStatus(b: Bot) {
    if (!isConnected) {
        toast.error("MindServer not connected. Make sure the backend is running.");
        return;
    }

    const agent = agents.find(a => a.name === b.name);
    const isRunning = agent?.in_game || b.status === "running";

    if (isRunning) {
        stopAgent(b.name);
        await supabase.from("bots").update({ status: "stopped" }).eq("id", b.id);
        toast.success(`${b.name} stopped`);
    } else {
        toast.info(`Launching ${b.name}...`);
        const res: any = await launchBot(b.id);
        if (res.success) {
            toast.success(`${b.name} launched!`);
        } else {
            toast.error(`Failed to launch: ${res.error}`);
        }
    }
    load();
  }

  async function remove(b: Bot) {
    if (!confirm(`Delete "${b.name}"?`)) return;
    const { error } = await supabase.from("bots").delete().eq("id", b.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight">My Bots</h1>
            <Badge variant={isConnected ? "outline" : "destructive"} className="gap-1 px-1.5 h-5 !bg-transparent">
                <Activity className={`h-3 w-3 ${isConnected ? "text-emerald-500" : "text-destructive"}`} />
                {isConnected ? "Server Online" : "Server Offline"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Manage your Mindcraft bots and their configurations.</p>
        </div>
        <Button asChild><Link to="/bots/new"><Plus className="h-4 w-4 mr-1" />New bot</Link></Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : dbBots.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 grid place-items-center mb-3">
            <BotIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium">No bots yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first bot to get started.</p>
          <Button asChild><Link to="/bots/new">Create bot</Link></Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {dbBots.map((b) => {
            const agent = agents.find(a => a.name === b.name);
            const isRunning = agent?.in_game || b.status === "running";
            
            return (
                <Card key={b.id} className="p-4 flex items-center gap-4 flex-wrap hover:border-primary/20 transition-all">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`status-dot status-${isRunning ? 'running' : 'stopped'}`} />
                    <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                        {b.name}
                        {agent?.viewerPort && <Badge variant="secondary" className="text-[10px] h-4">Port: {agent.viewerPort}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                        {b.minecraft_username} · {b.host}:{b.port} · {b.auth_type}
                    </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={isRunning ? "default" : "outline"} className="capitalize">
                        {isRunning ? "Running" : "Stopped"}
                    </Badge>
                    {b.use_global_keys ? <Badge variant="secondary">Global keys</Badge> : <Badge>Custom keys</Badge>}
                    
                    <div className="w-px h-6 bg-border mx-1" />

                    <Button size="sm" variant={isRunning ? "destructive" : "default"} onClick={() => toggleStatus(b)} disabled={!isConnected}>
                    {isRunning ? <><Square className="h-3.5 w-3.5 mr-1" />Stop</> : <><Play className="h-3.5 w-3.5 mr-1" />Start</>}
                    </Button>
                    <Button size="sm" variant="ghost" asChild><Link to={`/bots/${b.id}`}><Pencil className="h-3.5 w-3.5" /></Link></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(b)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
