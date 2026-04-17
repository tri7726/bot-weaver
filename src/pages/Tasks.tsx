import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";

type Task = { 
  id: string; 
  title: string; 
  description: string; 
  status: string; 
  bot_id: string | null; 
  parent_id: string | null; 
  server_ip: string | null;
  last_ping: string | null;
  requirements: string[];
};
type Bot = { id: string; name: string };

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [botId, setBotId] = useState<string>("none");

  useEffect(() => { 
    document.title = "Tasks · Mindcraft Manager"; 
    load();
    const interval = setInterval(load, 5000); // Poll every 5s for heartbeats
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const [t, b] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("bots").select("id,name"),
    ]);
    setTasks((t.data ?? []) as any[]);
    setBots((b.data ?? []) as Bot[]);
  }

  async function create() {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id, title, description, bot_id: botId === "none" ? null : botId,
    });
    if (error) return toast.error(error.message);
    setTitle(""); setDescription(""); setBotId("none"); setOpen(false);
    toast.success("Task created"); load();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  const rootTasks = tasks.filter(t => !t.parent_id);
  const getSubtasks = (parentId: string) => tasks.filter(t => t.parent_id === parentId);

  const isCold = (lastPing: string | null) => {
    if (!lastPing) return false;
    const diff = Date.now() - new Date(lastPing).getTime();
    return diff > 120000; // 2 minutes
  };

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Task Board</h1>
          <p className="text-sm text-muted-foreground">Robust coordination with crash recovery and heartbeat monitoring.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Team Goal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Team Goal</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Main Goal (e.g. Build a Farm)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Instructions for the bots..." rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              <Select value={botId} onValueChange={setBotId}>
                <SelectTrigger><SelectValue placeholder="Assign to specific bot (Optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Shared (Unassigned)</SelectItem>
                  {bots.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={create} className="w-full">Initialize Goal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rootTasks.length === 0 ? (
        <Card className="p-12 text-center border-dashed bg-white/5 truncate">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mb-4">
            <ListChecks className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-medium">No active team goals</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Create a goal to see bots decompose it into sub-tasks and collaborate in real-time.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {rootTasks.map((t) => (
            <div key={t.id} className="space-y-3">
              <Card className="p-4 bg-primary/5 border-primary/20 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-bold text-lg flex items-center gap-2">
                      {t.title}
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px]">Team Goal</Badge>
                    </div>
                    {t.description && <p className="text-sm text-foreground/80 mt-1">{t.description}</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>

              {/* Render Subtasks */}
              <div className="grid gap-2 pl-6 border-l-2 border-primary/20 ml-4">
                {getSubtasks(t.id).map(st => {
                  const cold = st.status === 'in_progress' && isCold(st.last_ping);
                  return (
                    <Card key={st.id} className={`p-3 flex items-center gap-4 group transition-all ${cold ? 'border-destructive/50 bg-destructive/5 animate-pulse' : 'hover:bg-white/5'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate flex items-center gap-2">
                          {st.title}
                          {cold && <Badge variant="destructive" className="h-4 text-[8px]">CRASHED / ZOMBIE</Badge>}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4">
                            {st.status.replace("_", " ")}
                          </Badge>
                          
                          {st.bot_id && (
                              <Badge variant="secondary" className="text-[9px] h-4">
                                  🤖 {bots.find(b => b.id === st.bot_id)?.name}
                              </Badge>
                          )}
                          
                          {st.requirements && st.requirements.length > 0 && (
                            <div className="flex gap-1 items-center">
                              <span className="text-[9px] text-muted-foreground">Needs:</span>
                              {st.requirements.map(r => (
                                <Badge key={r} variant="outline" className="text-[8px] h-3 px-1 border-blue-500/30 text-blue-400 bg-blue-500/5">{r}</Badge>
                              ))}
                            </div>
                          )}

                          {st.server_ip && (
                            <span className="text-[9px] text-muted-foreground/60 font-mono">
                              📍 {st.server_ip}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {st.status === 'in_progress' && !cold && (
                           <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-2" title="Heartbeat active" />
                        )}
                        <Select value={st.status} onValueChange={(v) => setStatus(st.id, v)}>
                          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">Working</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => remove(st.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
