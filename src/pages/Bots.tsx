import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Square, Pencil, Trash2, Bot as BotIcon } from "lucide-react";
import { toast } from "sonner";

type Bot = {
  id: string; name: string; minecraft_username: string; host: string; port: number;
  auth_type: string; status: string; use_global_keys: boolean;
};

export default function Bots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "My Bots · Mindcraft Manager"; load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("bots").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setBots((data ?? []) as Bot[]);
    setLoading(false);
  }

  async function toggleStatus(b: Bot) {
    const next = b.status === "running" ? "stopped" : "running";
    const { error } = await supabase.from("bots").update({ status: next }).eq("id", b.id);
    if (error) toast.error(error.message);
    else { toast.success(next === "running" ? "Bot started (placeholder)" : "Bot stopped"); load(); }
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
          <h1 className="text-2xl font-semibold tracking-tight">My Bots</h1>
          <p className="text-sm text-muted-foreground">Manage your Mindcraft bots and their configurations.</p>
        </div>
        <Button asChild><Link to="/bots/new"><Plus className="h-4 w-4 mr-1" />New bot</Link></Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : bots.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 grid place-items-center mb-3">
            <BotIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium">No bots yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first bot to get started.</p>
          <Button asChild><Link to="/bots/new">Create bot</Link></Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {bots.map((b) => (
            <Card key={b.id} className="p-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`status-dot status-${b.status}`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{b.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {b.minecraft_username} · {b.host}:{b.port} · {b.auth_type}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize">{b.status}</Badge>
                {b.use_global_keys ? <Badge variant="secondary">Global keys</Badge> : <Badge>Custom keys</Badge>}
                <Button size="sm" variant="outline" onClick={() => toggleStatus(b)}>
                  {b.status === "running" ? <><Square className="h-3.5 w-3.5 mr-1" />Stop</> : <><Play className="h-3.5 w-3.5 mr-1" />Start</>}
                </Button>
                <Button size="sm" variant="ghost" asChild><Link to={`/bots/${b.id}`}><Pencil className="h-3.5 w-3.5" /></Link></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(b)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
