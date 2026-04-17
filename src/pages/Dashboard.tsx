import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, ListChecks, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [stats, setStats] = useState({ bots: 0, running: 0, tasks: 0 });

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

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your bot fleet.</p>
        </div>
        <Button asChild><Link to="/bots/new">New bot</Link></Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Bot} label="Total bots" value={stats.bots} />
        <StatCard icon={Activity} label="Running" value={stats.running} accent />
        <StatCard icon={ListChecks} label="Open tasks" value={stats.tasks} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>Configure global API keys, then create your first bot.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild><Link to="/settings">Set API keys</Link></Button>
          <Button asChild><Link to="/bots/new">Create a bot</Link></Button>
        </CardContent>
      </Card>
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
