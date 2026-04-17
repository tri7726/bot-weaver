import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useBotControl } from "@/hooks/useBotControl";
import { Plus, Trash2, CheckCircle2, XCircle, RotateCw, FlaskConical } from "lucide-react";

const PROVIDERS = [
  { id: "openai", key: "OPENAI_API_KEY", label: "OpenAI" },
  { id: "xai", key: "XAI_API_KEY", label: "xAI / Grok" },
  { id: "gemini", key: "GEMINI_API_KEY", label: "Google Gemini" },
  { id: "anthropic", key: "ANTHROPIC_API_KEY", label: "Anthropic" },
  { id: "deepseek", key: "DEEPSEEK_API_KEY", label: "DeepSeek" },
  { id: "groq", key: "GROQ_API_KEY", label: "Groq" },
  { id: "mistral", key: "MISTRAL_API_KEY", label: "Mistral" },
];

export default function Settings() {
  const { user } = useAuth();
  const { testApiKey } = useBotControl();
  // keys: { PROVIDER_KEY: ["val1", "val2"] }
  const [keysPool, setKeysPool] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { status: "success" | "error" | "testing", message?: string }>>({});

  useEffect(() => {
    document.title = "Global Settings · Mindcraft Manager";
    (async () => {
      const { data } = await supabase.from("global_settings").select("api_keys").maybeSingle();
      const rawKeys = ((data?.api_keys as any) ?? {}) as Record<string, string | string[]>;
      
      // Normalize to arrays
      const normalized: Record<string, string[]> = {};
      PROVIDERS.forEach(p => {
        const val = rawKeys[p.key];
        if (Array.isArray(val)) normalized[p.key] = val.filter(v => !!v);
        else if (typeof val === 'string' && val) normalized[p.key] = [val];
        else normalized[p.key] = [""]; // Start with one empty slot
      });
      setKeysPool(normalized);
      setLoading(false);
    })();
  }, []);

  const addKey = (providerKey: string) => {
    setKeysPool(prev => ({
      ...prev,
      [providerKey]: [...(prev[providerKey] || []), ""]
    }));
  };

  const removeKey = (providerKey: string, index: number) => {
    setKeysPool(prev => {
      const current = [...prev[providerKey]];
      current.splice(index, 1);
      if (current.length === 0) current.push("");
      return { ...prev, [providerKey]: current };
    });
  };

  const updateKey = (providerKey: string, index: number, value: string) => {
    setKeysPool(prev => {
      const current = [...prev[providerKey]];
      current[index] = value;
      return { ...prev, [providerKey]: current };
    });
  };

  const handleTest = async (providerId: string, providerKey: string, index: number) => {
    const keyVal = keysPool[providerKey][index];
    if (!keyVal) return;

    const testId = `${providerKey}-${index}`;
    setTestResults(prev => ({ ...prev, [testId]: { status: "testing" } }));

    const res = await testApiKey(providerId, keyVal);
    
    setTestResults(prev => ({ 
      ...prev, 
      [testId]: { 
        status: res.success ? "success" : "error", 
        message: res.message 
      } 
    }));

    if (res.success) toast.success(`Key ${index + 1} for ${providerId} is valid!`);
    else toast.error(`Key ${index + 1} for ${providerId} failed: ${res.message}`);
  };

  async function save() {
    if (!user) return;
    setBusy(true);
    
    // Clean empty keys before saving
    const cleaned: Record<string, string[]> = {};
    for (const k in keysPool) {
      cleaned[k] = keysPool[k].filter(v => !!v);
    }

    const { error } = await supabase.from("global_settings")
      .upsert({ user_id: user.id, api_keys: cleaned }, { onConflict: "user_id" });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved successfully");
  }

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading settings...</div>;

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Global Settings</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Manage your API keys pool. The system will automatically rotate and failover if a key is exhausted or invalid.
          </p>
        </div>
        <Button onClick={save} disabled={busy} className="shadow-lg shadow-primary/20">
          {busy ? "Saving…" : "Save All Keys"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((p) => (
          <Card key={p.key} className="border-primary/10 hover:border-primary/30 transition-colors shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-md font-bold">{p.label}</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">{p.key}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => addKey(p.key)}>
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {keysPool[p.key]?.map((keyVal, idx) => (
                <div key={`${p.key}-${idx}`} className="space-y-2 relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input 
                        type="password" 
                        placeholder={`Key ${idx + 1}`}
                        value={keyVal}
                        onChange={(e) => updateKey(p.key, idx, e.target.value)}
                        className="pr-10"
                        />
                        <div className="absolute right-2 top-2">
                             {testResults[`${p.key}-${idx}`]?.status === "testing" && <RotateCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                             {testResults[`${p.key}-${idx}`]?.status === "success" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                             {testResults[`${p.key}-${idx}`]?.status === "error" && <XCircle className="h-5 w-5 text-red-500" />}
                        </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="shrink-0 h-10 w-10 hover:bg-red-50 hover:text-red-500 transition-colors" 
                      onClick={() => removeKey(p.key, idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <button 
                        onClick={() => handleTest(p.id, p.key, idx)}
                        disabled={!keyVal}
                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 disabled:opacity-30"
                    >
                        <FlaskConical className="h-3 w-3" /> TEST CONNECTION
                    </button>
                    {testResults[`${p.key}-${idx}`]?.message && (
                        <span className={`text-[9px] font-medium truncate max-w-[150px] ${testResults[`${p.key}-${idx}`].status === "error" ? "text-red-500" : "text-green-600"}`}>
                            {testResults[`${p.key}-${idx}`].message}
                        </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
