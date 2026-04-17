import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const API_KEY_FIELDS = [
  { key: "OPENAI_API_KEY", label: "OpenAI" },
  { key: "GEMINI_API_KEY", label: "Gemini" },
  { key: "XAI_API_KEY", label: "xAI / Grok" },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic" },
  { key: "DEEPSEEK_API_KEY", label: "DeepSeek" },
  { key: "GROQ_API_KEY", label: "Groq" },
  { key: "MISTRAL_API_KEY", label: "Mistral" },
  { key: "OPENROUTER_API_KEY", label: "OpenRouter" },
];

const MODEL_PROVIDERS = ["openai", "gemini", "xai", "anthropic", "deepseek", "groq", "mistral", "openrouter", "ollama"];

type FormState = {
  name: string;
  minecraft_username: string;
  host: string;
  port: number;
  auth_type: "microsoft" | "offline";
  profile_id: string | null;
  system_prompt: string;
  personality: string;
  model_config: { provider: string; model: string; temperature: number };
  custom_api_keys: Record<string, string>;
  use_global_keys: boolean;
};

const empty: FormState = {
  name: "", minecraft_username: "", host: "localhost", port: 25565, auth_type: "offline",
  profile_id: null,
  system_prompt: "", personality: "",
  model_config: { provider: "openai", model: "gpt-4o-mini", temperature: 0.7 },
  custom_api_keys: {}, use_global_keys: true,
};

export default function BotEdit() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(empty);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `${isNew ? "New bot" : "Edit bot"} · Mindcraft Manager`;
    (async () => {
      // Load Profiles for selection
      const { data: profs } = await supabase.from("agent_profiles").select("id, name");
      setProfiles(profs ?? []);

      if (!isNew && id) {
        const { data, error } = await supabase.from("bots").select("*").eq("id", id).maybeSingle();
        if (error) toast.error(error.message);
        else if (data) {
          setForm({
            name: data.name,
            minecraft_username: data.minecraft_username,
            host: data.host,
            port: data.port,
            auth_type: data.auth_type as any,
            profile_id: data.profile_id,
            system_prompt: data.system_prompt ?? "",
            personality: data.personality ?? "",
            model_config: { ...empty.model_config, ...(data.model_config as any) },
            custom_api_keys: (data.custom_api_keys as any) ?? {},
            use_global_keys: data.use_global_keys,
          });
        }
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const payload = { ...form, user_id: user.id };
    const res = isNew
      ? await supabase.from("bots").insert(payload as any).select().single()
      : await supabase.from("bots").update(payload as any).eq("id", id!).select().single();
    setBusy(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success(isNew ? "Bot created" : "Saved"); nav("/bots"); }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/bots"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{isNew ? "Create bot" : "Edit bot"}</h1>
        <p className="text-sm text-muted-foreground">Configure connection, personality, model, and API keys.</p>
      </div>

      <form onSubmit={save} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Basic</CardTitle><CardDescription>Connection details</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Bot name"><Input value={form.name} onChange={(e) => update("name", e.target.value)} required /></Field>
            <Field label="Minecraft username"><Input value={form.minecraft_username} onChange={(e) => update("minecraft_username", e.target.value)} required /></Field>
            <Field label="Host"><Input value={form.host} onChange={(e) => update("host", e.target.value)} required /></Field>
            <Field label="Port"><Input type="number" value={form.port} onChange={(e) => update("port", parseInt(e.target.value) || 25565)} required /></Field>
            <Field label="Auth type">
              <Select value={form.auth_type} onValueChange={(v) => update("auth_type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="microsoft">Microsoft</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Personality & Profile</CardTitle><CardDescription>Select a base template or override settings</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Base Profile">
              <Select value={form.profile_id ?? "none"} onValueChange={(v) => update("profile_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select a profile template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Profile (Use Overrides Only)</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            
            <div className="pt-2 border-t">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Overrides</div>
                <Field label="Custom System Prompt (Optional)">
                    <Textarea rows={4} value={form.system_prompt} onChange={(e) => update("system_prompt", e.target.value)} placeholder="If empty, uses base profile prompt..." />
                </Field>
                <Field label="Custom Personality Description (Optional)">
                    <Textarea rows={2} value={form.personality} onChange={(e) => update("personality", e.target.value)} placeholder="If empty, uses base profile description..." />
                </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Model</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="Provider">
              <Select value={form.model_config.provider} onValueChange={(v) => update("model_config", { ...form.model_config, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODEL_PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Model"><Input value={form.model_config.model} onChange={(e) => update("model_config", { ...form.model_config, model: e.target.value })} /></Field>
            <Field label="Temperature">
              <Input type="number" step="0.1" min="0" max="2" value={form.model_config.temperature}
                onChange={(e) => update("model_config", { ...form.model_config, temperature: parseFloat(e.target.value) || 0 })} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Use your global keys or set custom keys for this bot only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Use global keys</div>
                <div className="text-xs text-muted-foreground">Inherit keys from Global Settings.</div>
              </div>
              <Switch checked={form.use_global_keys} onCheckedChange={(v) => update("use_global_keys", v)} />
            </div>
            {!form.use_global_keys && (
              <div className="grid gap-3 md:grid-cols-2">
                {API_KEY_FIELDS.map((k) => (
                  <Field key={k.key} label={k.label}>
                    <Input type="password" autoComplete="off" placeholder={k.key}
                      value={form.custom_api_keys[k.key] ?? ""}
                      onChange={(e) => update("custom_api_keys", { ...form.custom_api_keys, [k.key]: e.target.value })} />
                  </Field>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" asChild><Link to="/bots">Cancel</Link></Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : isNew ? "Create bot" : "Save changes"}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
