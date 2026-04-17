import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

type Log = { id: string; level: string; message: string; created_at: string; bot_id: string | null };

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    document.title = "Logs · Mindcraft Manager";
    supabase.from("bot_logs").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setLogs((data ?? []) as Log[]));
  }, []);

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">Recent activity from your bots.</p>
      </div>
      {logs.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 grid place-items-center mb-3">
            <ScrollText className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium">No logs yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Bot activity will appear here.</p>
        </Card>
      ) : (
        <Card className="divide-y">
          {logs.map((l) => (
            <div key={l.id} className="p-3 flex items-start gap-3 text-sm font-mono">
              <Badge variant={l.level === "error" ? "destructive" : "outline"} className="capitalize">{l.level}</Badge>
              <div className="text-xs text-muted-foreground w-40 shrink-0">{new Date(l.created_at).toLocaleString()}</div>
              <div className="flex-1 break-all">{l.message}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
