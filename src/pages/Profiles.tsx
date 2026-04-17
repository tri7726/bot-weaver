import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, ScrollText } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  id: string;
  name: string;
  system_prompt: string;
  personality: string;
  created_at: string;
};

export default function Profiles() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    document.title = "Bot Profiles · Mindcraft Manager";
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: profs, error: pErr } = await supabase.from("agent_profiles").select("*").order("created_at", { ascending: false });
    const { data: bots, error: bErr } = await supabase.from("bots").select("profile_id");

    if (pErr) toast.error(pErr.message);
    else if (bErr) toast.error(bErr.message);
    else {
      setProfiles(profs || []);
      const mapping: Record<string, number> = {};
      bots?.forEach(b => {
        if (b.profile_id) mapping[b.profile_id] = (mapping[b.profile_id] || 0) + 1;
      });
      setCounts(mapping);
    }
    setLoading(false);
  }

  async function remove(p: Profile) {
    if (!confirm(`Delete profile "${p.name}"? This will not delete bots using it, but they might lose their personality settings.`)) return;
    const { error } = await supabase.from("agent_profiles").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bot Profiles</h1>
          <p className="text-sm text-muted-foreground">Reusable personalities and system prompts for your agents.</p>
        </div>
        <Button asChild><Link to="/profiles/new"><Plus className="h-4 w-4 mr-1" />New Profile</Link></Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : profiles.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 grid place-items-center mb-3">
            <ScrollText className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium">No profiles yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create a reusable personality like "Builder" or "Explorer".</p>
          <Button asChild><Link to="/profiles/new">Create profile</Link></Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <Card key={p.id} className="p-5 flex flex-col justify-between hover:border-primary/30 transition-colors group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    {counts[p.id] > 0 && (
                        <div className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-primary/20">
                            {counts[p.id]} BOTS
                        </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <Link to={`/profiles/${p.id}`}><Pencil className="h-4 w-4" /></Link>
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 italic mb-3">
                    {p.personality || "No personality description"}
                </p>
                <div className="text-[10px] uppercase font-bold text-muted-foreground/50 tracking-widest mb-4">
                    System Prompt
                </div>
                <div className="bg-muted/30 rounded p-3 text-xs font-mono line-clamp-4 h-24 overflow-hidden">
                    {p.system_prompt}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
