import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const FIELDS = [
  { key: "OPENAI_API_KEY", label: "OpenAI" },
  { key: "GEMINI_API_KEY", label: "Gemini" },
  { key: "XAI_API_KEY", label: "xAI / Grok" },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic" },
  { key: "DEEPSEEK_API_KEY", label: "DeepSeek" },
  { key: "GROQ_API_KEY", label: "Groq" },
  { key: "MISTRAL_API_KEY", label: "Mistral" },
  { key: "OPENROUTER_API_KEY", label: "OpenRouter" },
];

export default function Settings() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Global Settings · Mindcraft Manager";
    (async () => {
      const { data } = await supabase.from("global_settings").select("api_keys").maybeSingle();
      setKeys(((data?.api_keys as any) ?? {}) as Record<string, string>);
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("global_settings")
      .upsert({ user_id: user.id, api_keys: keys }, { onConflict: "user_id" });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Global Settings</h1>
        <p className="text-sm text-muted-foreground">API keys shared by all bots that have "Use global keys" enabled.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Stored securely per user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</Label>
                  <Input type="password" autoComplete="off" placeholder={f.key}
                    value={keys[f.key] ?? ""}
                    onChange={(e) => setKeys((k) => ({ ...k, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={busy || loading}>{busy ? "Saving…" : "Save settings"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
