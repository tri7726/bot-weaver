import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, ListChecks, Activity, ShieldCheck, ShieldAlert, Play, Square, Terminal, Plus, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useBotControl } from "@/hooks/useBotControl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Dashboard() {
  const [stats, setStats] = useState({ bots: 0, running: 0, tasks: 0 });
  const { agents, logs, isConnected, startAgent, stopAgent, createAgent } = useBotControl();
  
  // Bot Config Form State
  const [serverIp, setServerIp] = useState("127.0.0.1");
  const [serverPort, setServerPort] = useState("25565");
  const [username, setUsername] = useState("Steve");
  const [profile, setProfile] = useState("./andy.json");
  const [isSpawning, setIsSpawning] = useState(false);

  useEffect(() => {
    document.title = "Dashboard · Mindcraft Manager";
    (async () => {
      const [{ count: bots }, { count: running }, { count: tasks }] = await Promise.all([
        supabase.from("bots").select("*", { count: "exact", head: true }),
        supabase.from("bots").select("*", { count: "exact", head: true }).eq("status", "running"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done"),
      ]);
      setStats({ bots: bots ?? 0, running: running ?? 0, tasks: tasks ?? 0 });
    })();
  }, []);

  const handleSpawn = async () => {
    if (!isConnected) {
      toast.error("MindServer is offline. Please run 'npm run bot' first.");
      return;
    }
    
    setIsSpawning(true);
    try {
      const result: any = await createAgent({
        host: serverIp,
        port: parseInt(serverPort),
        auth: "offline",
        profile: profile, // This is the path
        name: username,   // Pass the name explicitly
        init_message: "Hello, I am ready to help!",
      });

      if (result.success) {
        toast.success(`Agent ${username} is spawning...`);
      } else {
        toast.error(`Spawn failed: ${result.error}`);
      }
    } catch (err) {
      toast.error("An unexpected error occurred.");
      console.error(err);
    } finally {
      setIsSpawning(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            {isConnected ? (
              <span className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20 font-medium uppercase tracking-wider">
                <ShieldCheck className="h-3 w-3" /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20 font-medium uppercase tracking-wider">
                <ShieldAlert className="h-3 w-3" /> Offline
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Overview of your bot fleet.</p>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" asChild><Link to="/settings"><Settings2 className="h-4 w-4 mr-2" /> Settings</Link></Button>
            <Button asChild><Link to="/bots/new"><Plus className="h-4 w-4 mr-2" /> Multi-Agent</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Bot} label="Total bots" value={stats.bots} />
        <StatCard icon={Activity} label="Running" value={agents.filter(a => a.in_game).length || stats.running} accent />
        <StatCard icon={ListChecks} label="Open tasks" value={stats.tasks} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* QUICK SPAWN FORM */}
        <Card className="lg:col-span-1 border-primary/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Quick Spawn
            </CardTitle>
            <CardDescription>Launch a new agent instance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ip">Server IP</Label>
              <Input id="ip" value={serverIp} onChange={(e) => setServerIp(e.target.value)} placeholder="127.0.0.1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input id="port" value={serverPort} onChange={(e) => setServerPort(e.target.value)} placeholder="25565" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Bot Name</Label>
                <Input id="name" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Steve" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>AI Profile</Label>
              <Select value={profile} onValueChange={setProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="./andy.json">Andy (Default)</SelectItem>
                  <SelectItem value="./andy-4.json">Andy-4 (Smart)</SelectItem>
                  <SelectItem value="./grok.json">Grok 3 (xAI)</SelectItem>
                  <SelectItem value="./gpt.json">GPT-4o</SelectItem>
                  <SelectItem value="./claude.json">Claude 3.5</SelectItem>
                  <SelectItem value="./gemini.json">Gemini 1.5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full mt-2" onClick={handleSpawn} disabled={isSpawning || !isConnected}>
              {isSpawning ? "Spawning..." : "Launch Agent"}
            </Button>
          </CardContent>
        </Card>

        {/* LIVE CONTROL */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Active Agents
            </CardTitle>
            <CardDescription>Real-time session status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            {agents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic text-sm border-2 border-dashed rounded-xl bg-muted/30">
                No active agents found.
              </div>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div key={agent.name} className="flex items-center justify-between p-3 rounded-xl border bg-card/50 hover:bg-card transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${agent.in_game ? "bg-green-500 animate-pulse" : "bg-muted"}`} />
                      <div>
                        <div className="font-semibold text-sm">{agent.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Internal Port: {agent.viewerPort}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {agent.in_game ? (
                        <Button size="sm" variant="destructive" className="h-8 px-3" onClick={() => stopAgent(agent.name)}>
                          <Square className="h-3 w-3 mr-1.5" /> Stop
                        </Button>
                      ) : (
                        <Button size="sm" className="h-8 px-3" onClick={() => startAgent(agent.name)}>
                          <Play className="h-3 w-3 mr-1.5" /> Start
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* LOGS */}
        <Card className="lg:col-span-1 flex flex-col bg-slate-950 text-slate-100 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-100">
              <Terminal className="h-5 w-5 text-primary" />
              Live Stream
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 border-t border-slate-800 flex-1 overflow-hidden">
            <ScrollArea className="h-[360px] w-full p-4 font-mono text-[11px] leading-relaxed">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic py-4">Waiting for agent logs...</div>
              ) : (
                <div className="space-y-1.5">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-2 group">
                      <span className="text-primary font-bold shrink-0">[{log.agent}]</span>
                      <span className="text-slate-300 group-hover:text-white transition-colors">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-10 w-10 rounded-md grid place-items-center ${accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="text-sm text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
