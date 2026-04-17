import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Clock, Trash2, Brain, History, Target, AlertTriangle, Layers } from "lucide-react";
import { toast } from "sonner";
import { useBotControl } from "@/hooks/useBotControl";

type Memory = {
  id: string;
  bot_id: string;
  layer: "short_term" | "episodic" | "summary" | "abstract";
  content: string;
  importance_score: number;
  metadata: any;
  created_at: string;
  bots?: { name: string };
};

export default function Memories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBot, setFilterBot] = useState<string>("all");
  const [filterLayer, setFilterLayer] = useState<string>("all");
  const [bots, setBots] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const { triggerReflection, isConnected, agents } = useBotControl();
  const [reflecting, setReflecting] = useState(false);

  useEffect(() => {
    document.title = "Ký ức & Tri thức (RAG) · Mindcraft Manager";
    loadBots();
    loadMemories();
  }, [filterBot, filterLayer]);

  async function loadBots() {
    const { data } = await supabase.from("bots").select("id, name");
    setBots(data ?? []);
  }

  async function loadMemories() {
    setLoading(true);
    let q = supabase.from("agent_memories").select("*, bots(name)").order("created_at", { ascending: false }) as any;
    
    if (filterBot !== "all") q = q.eq("bot_id", filterBot);
    if (filterLayer !== "all") q = q.eq("layer", filterLayer);
    
    if (search) q = q.ilike("content", `%${search}%`);

    const { data, error } = await q.limit(100);
    if (error) toast.error(error.message);
    else setMemories((data || []) as unknown as Memory[]);
    setLoading(false);
  }

  async function handleReflection() {
    if (filterBot === "all") {
        toast.warning("Vui lòng chọn một bot cụ thể để thực hiện duy xét.");
        return;
    }
    const b = bots.find(x => x.id === filterBot);
    const agent = agents.find(a => a.name === b?.name);
    if (!agent?.in_game) {
        toast.error("Bot phải đang online để duy xét ký ức.");
        return;
    }

    setReflecting(true);
    toast.promise(triggerReflection(b.name) as Promise<any>, {
        loading: `Đang yêu cầu ${b.name} duy xét lại các ký ức...`,
        success: "Đã yêu cầu thành công. Bot sẽ bắt đầu tóm tắt ký ức trong vài giây.",
        error: "Thất bại khi yêu cầu duy xét.",
    });
    setReflecting(false);
  }

  async function remove(id: string) {
    if (!confirm("Xóa ký ức này?")) return;
    const { error } = await supabase.from("agent_memories" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Đã xóa"); loadMemories(); }
  }

  const getLayerColor = (layer: string) => {
    switch(layer) {
      case 'short_term': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'episodic': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'summary': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'abstract': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default: return '';
    }
  }

  const getLayerIcon = (layer: string) => {
    switch(layer) {
      case 'short_term': return <Clock className="h-3 w-3 mr-1" />;
      case 'episodic': return <History className="h-3 w-3 mr-1" />;
      case 'summary': return <Layers className="h-3 w-3 mr-1" />;
      case 'abstract': return <Brain className="h-3 w-3 mr-1" />;
      default: return null;
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6 border-white/5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight uppercase">Ký ức & Tri thức (RAG)</h1>
          <p className="text-sm text-muted-foreground">Phân tích hệ thống bộ nhớ phân cấp (Hierarchical RAG) của Steve AI.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
            <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 h-10 px-4 border-amber-500/20 hover:bg-amber-500/10 text-amber-500"
                onClick={handleReflection}
                disabled={reflecting || filterBot === "all" || !isConnected}
            >
                <Brain className="h-4 w-4" />
                Duy xét lại (Reflect)
            </Button>

            <div className="h-8 w-px bg-white/10 mx-1 hidden md:block" />

            <div className="w-48">
                <Select value={filterBot} onValueChange={setFilterBot}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="All Bots" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
                        {bots.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-40">
                <Select value={filterLayer} onValueChange={setFilterLayer}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Filter Layer" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Mọi tầng bộ nhớ</SelectItem>
                        <SelectItem value="short_term">Sau 30 giây (Short-term)</SelectItem>
                        <SelectItem value="episodic">Sự kiện (Episodic)</SelectItem>
                        <SelectItem value="summary">Tóm tắt (Summary)</SelectItem>
                        <SelectItem value="abstract">Trí thức (Abstract)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="relative w-64">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Tìm trong ký ức..." className="pl-9 h-10" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadMemories()} />
            </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">Loading memories...</div>
      ) : memories.length === 0 ? (
        <Card className="p-20 text-center border-dashed bg-card/50">
           <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
           <p className="text-muted-foreground">No memories found. Launch a bot and perform actions to see them appear here.</p>
        </Card>
      ) : (
        <div className="relative space-y-4">
          {/* Timeline Vertical Line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border md:left-[107px]" />

          {memories.map((m) => {
            const isFailure = m.metadata?.type === 'failure' || m.content.toLowerCase().includes('dead') || m.content.toLowerCase().includes('died');
            
            return (
                <div key={m.id} className="relative pl-10 md:pl-0 md:grid md:grid-cols-[100px_1fr] gap-8 group">
                    {/* Time Dot */}
                    <div className="absolute left-[3.5px] top-6 w-2 h-2 rounded-full bg-border group-hover:bg-primary transition-colors z-10 md:left-[103px]" />
                    
                    {/* Timestamp */}
                    <div className="hidden md:block pt-5 text-right">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(m.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground/60">{new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>

                    <Card className={`p-4 hover:shadow-md transition-all ${isFailure ? 'border-destructive/30 bg-destructive/5' : 'hover:border-primary/20'}`}>
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`h-5 text-[10px] uppercase tracking-wider ${getLayerColor(m.layer)}`}>
                                    {getLayerIcon(m.layer)}
                                    {m.layer.replace('_', ' ')}
                                </Badge>
                                <Badge variant="secondary" className="h-5 text-[10px]">{m.bots?.name || 'Unknown Bot'}</Badge>
                                {isFailure && <Badge variant="destructive" className="h-5 text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> Failure</Badge>}
                                {m.importance_score > 0.7 && <Badge variant="secondary" className="h-5 text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/20">Important</Badge>}
                            </div>
                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => remove(m.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {m.content}
                        </div>

                        {m.metadata?.coordinates && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono bg-muted/50 w-fit px-1.5 py-0.5 rounded">
                                <Target className="h-3 w-3" />
                                {m.metadata.coordinates.x}, {m.metadata.coordinates.y}, {m.metadata.coordinates.z}
                            </div>
                        )}
                    </Card>
                </div>
            )
          })}
        </div>
      )}
    </div>
  );
}
