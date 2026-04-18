import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBotControl } from "@/hooks/useBotControl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Play, Square, Pencil, Trash2, Bot as BotIcon, Activity, Shield, Copy, Key, Terminal as TerminalIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Console } from "@/components/Console";

type Bot = {
  id: string; name: string; minecraft_username: string; host: string; port: number;
  auth_type: string; status: string; use_global_keys: boolean;
  minecraft_uuid?: string; public_key?: string;
};

export default function Bots() {
  const { user } = useAuth();
  const [dbBots, setDbBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
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

  async function generateToken(bot: Bot) {
    if (!user) return;
    const rawToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    const nonce = Math.random().toString(36).substring(7);
    
    const { error } = await supabase.from("admin_auth_sessions").insert({
        user_id: user.id,
        admin_name: "Admin",
        token_hash: rawToken, 
        nonce: nonce,
        expires_at: new Date(Date.now() + 30 * 60000).toISOString()
    });

    if (error) toast.error(error.message);
    else {
        setToken(rawToken);
        toast.success("One-time token generated!");
    }
  }

  async function revokeSessions() {
    if (!user) return;
    const { error } = await supabase
        .from("admin_auth_sessions")
        .update({ expires_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("is_used", true);

    if (error) toast.error(error.message);
    else {
        setToken(null);
        toast.success("All admin sessions revoked!");
    }
  }

  async function toggleStatus(b: Bot) {
    if (!isConnected) {
        toast.error("MindServer not connected.");
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
        if (res.success) toast.success(`${b.name} launched!`);
        else toast.error(`Failed to launch: ${res.error}`);
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
          <p className="text-sm text-muted-foreground">Manage your Mindcraft bots and their security identities.</p>
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
          <Button asChild className="mt-4"><Link to="/bots/new">Create bot</Link></Button>
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
                        {b.minecraft_uuid && <Badge variant="outline" className="text-[9px] h-3 px-1 text-blue-400 border-blue-400/20">UUID: {b.minecraft_uuid.substring(0,8)}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                        {b.minecraft_username} · {b.host}:{b.port}
                    </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10">
                                <Shield className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-blue-400" />
                                    Security Identity: {b.name}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Bot Minecraft UUID</label>
                                    <div className="bg-black/20 p-2 rounded border font-mono text-xs flex justify-between items-center">
                                        {b.minecraft_uuid || "Not yet spawned"}
                                        {b.minecraft_uuid && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(b.minecraft_uuid!); toast.success("UUID Copied"); }}><Copy className="h-3 w-3" /></Button>}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground uppercase">Admin Authentication</label>
                                    <p className="text-[11px] text-muted-foreground">Generate a one-time token to authorize yourself as an administrator in Minecraft chat.</p>
                                    <Button onClick={() => generateToken(b)} className="w-full gap-2">
                                        <Key className="h-4 w-4" />
                                        Generate One-Time Token
                                    </Button>
                                    {token && (
                                        <div className="mt-3 p-3 border border-emerald-500/30 bg-emerald-500/5 rounded text-center">
                                            <div className="text-xs text-muted-foreground mb-1">Whisper this to the bot:</div>
                                            <div className="text-xl font-bold tracking-widest text-emerald-400 font-mono">
                                                !auth {token}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-2 italic">Expires in 30 minutes. Single use only.</p>
                                        </div>
                                    )}
                                </div>
                                <div className="pt-2 border-t border-border">
                                    <Button variant="outline" size="sm" onClick={revokeSessions} className="w-full text-destructive hover:bg-destructive/10 border-destructive/20 gap-2">
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Emergency Revoke All Sessions
                                    </Button>
                                    <p className="text-[9px] text-center text-muted-foreground mt-2 px-4">
                                        Use this if your token is compromised. It will immediately disconnect any active admin sessions across all bots.
                                    </p>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10" disabled={!isRunning}>
                                <TerminalIcon className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl p-0 border-none bg-transparent">
                            <Console botId={b.id} botName={b.name} serverIp={b.host} />
                        </DialogContent>
                    </Dialog>

                    <div className="w-px h-6 bg-border mx-1" />

                    <Badge variant={isRunning ? "default" : "outline"} className="capitalize">
                        {isRunning ? "Running" : "Stopped"}
                    </Badge>
                    
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
