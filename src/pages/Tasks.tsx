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

type Task = { id: string; title: string; description: string; status: string; bot_id: string | null };
type Bot = { id: string; name: string };

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [botId, setBotId] = useState<string>("none");

  useEffect(() => { document.title = "Tasks · Mindcraft Manager"; load(); }, []);

  async function load() {
    const [t, b] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("bots").select("id,name"),
    ]);
    setTasks((t.data ?? []) as Task[]);
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

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Track work assigned to your bots.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New task</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Description (optional)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              <Select value={botId} onValueChange={setBotId}>
                <SelectTrigger><SelectValue placeholder="Assign to bot" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {bots.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 grid place-items-center mb-3">
            <ListChecks className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium">No tasks yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create one to start tracking work.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className="p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{t.title}</div>
                {t.description && <div className="text-sm text-muted-foreground mt-1">{t.description}</div>}
                <div className="mt-2"><Badge variant="outline" className="capitalize">{t.status.replace("_", " ")}</Badge></div>
              </div>
              <Select value={t.status} onValueChange={(v) => setStatus(t.id, v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
