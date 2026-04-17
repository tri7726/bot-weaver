import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

type FormState = {
  name: string;
  system_prompt: string;
  personality: string;
  model_config: { provider: string; model: string; temperature: number };
};

const empty: FormState = {
  name: "",
  system_prompt: "You are a helpful Minecraft bot.",
  personality: "Helpful, curious, and friendly.",
  model_config: { provider: "openai", model: "gpt-4o-mini", temperature: 0.7 }
};

export default function ProfileEdit() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    document.title = `${isNew ? "New Profile" : "Edit Profile"} · Mindcraft Manager`;
    if (!isNew && id) {
      (async () => {
        const { data, error } = await supabase.from("agent_profiles").select("*").eq("id", id).maybeSingle();
        if (error) toast.error(error.message);
        else if (data) {
          setForm({
            name: data.name,
            system_prompt: data.system_prompt ?? "",
            personality: data.personality ?? "",
            model_config: { ...empty.model_config, ...(data.model_config as any) },
          });
        }
        setLoading(false);
      })();
    }
  }, [id, isNew]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    
    const payload = { 
        name: form.name,
        system_prompt: form.system_prompt,
        personality: form.personality,
        model_config: form.model_config as any,
        user_id: user.id
    };

    const res = isNew
      ? await supabase.from("agent_profiles").insert(payload as any).select().single()
      : await supabase.from("agent_profiles").update(payload as any).eq("id", id!).select().single();
    
    setBusy(false);
    if (res.error) toast.error(res.error.message);
    else {
      toast.success(isNew ? "Profile created" : "Profile saved");
      nav("/profiles");
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/profiles"><ArrowLeft className="h-4 w-4 mr-1" />Back to list</Link></Button>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isNew ? "Create Profile" : "Edit Profile"}</h1>
          <p className="text-sm text-muted-foreground">Define a personality template that can be used by multiple bots.</p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card className="border-primary/10 shadow-sm">
          <CardHeader>
            <CardTitle>Profile Identity</CardTitle>
            <CardDescription>Give this personality a name and a brief description.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Profile Name</Label>
              <Input id="name" placeholder="e.g. Master Builder, Fierce Warrior..." value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="personality">Personality Tagline</Label>
                <Textarea id="personality" placeholder="Short description of behavior..." value={form.personality} onChange={(e) => update("personality", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/10 shadow-sm">
          <CardHeader>
            <CardTitle>Core Programming (System Prompt)</CardTitle>
            <CardDescription>This is the primary instruction set the AI will follow.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea 
                className="min-h-[300px] font-mono text-sm leading-relaxed" 
                value={form.system_prompt} 
                onChange={(e) => update("system_prompt", e.target.value)} 
                required
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" asChild><Link to="/profiles">Cancel</Link></Button>
          <Button type="submit" disabled={busy}>
            <Save className="h-4 w-4 mr-2" />
            {busy ? "Saving…" : isNew ? "Create Profile" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
