import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Map as MapIcon, ZoomIn, ZoomOut, RotateCcw, Target, MousePointer2 } from "lucide-react";
import { toast } from "sonner";

type MapMemory = {
  id: string;
  bot_id: string;
  content: string;
  layer: string;
  metadata: any;
  created_at: string;
  bots?: { name: string };
  server_id?: string;
};

export default function VisualMap() {
  const [memories, setMemories] = useState<MapMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBot, setFilterBot] = useState<string>("all");
  const [filterServer, setFilterServer] = useState<string>("all");
  const [bots, setBots] = useState<any[]>([]);
  const [servers, setServers] = useState<string[]>([]);
  
  // Map state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredMemory, setHoveredMemory] = useState<MapMemory | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Visual Map · Mindcraft Manager";
    loadInitialData();
  }, []);

  useEffect(() => {
    loadMemories();
  }, [filterBot, filterServer]);

  async function loadInitialData() {
    const { data: bData } = await supabase.from("bots").select("id, name");
    setBots(bData || []);
    
    // Use any casting for server_id as types might be stale
    const { data: mData } = await (supabase.from("agent_memories") as any).select("server_id");
    const uniqueServers = Array.from(new Set((mData as any[])?.map(m => m.server_id).filter(Boolean))) as string[];
    setServers(uniqueServers);
  }

  async function loadMemories() {
    setLoading(true);
    // Cast to any to handle server_id and complex select
    let q = (supabase.from("agent_memories") as any).select("*, bots(name)").order("created_at", { ascending: true });
    
    if (filterBot !== "all") q = q.eq("bot_id", filterBot);
    if (filterServer !== "all") q = q.eq("server_id", filterServer);
    
    const { data, error } = await q;
    
    if (error) {
      toast.error(error.message);
    } else {
      // Filter only those with coordinates
      const withCoords = (data as any[] || []).filter(m => {
        const metadata = m.metadata as any;
        const coords = metadata?.coordinates || metadata?.coords;
        return coords && (Array.isArray(coords) || (typeof coords === 'object' && coords.x !== undefined));
      });
      setMemories(withCoords as any);
    }
    setLoading(false);
  }

  const normalizeCoords = (metadata: any) => {
    const c = metadata?.coordinates || metadata?.coords;
    if (Array.isArray(c)) return { x: c[0], y: c[1], z: c[2] };
    if (typeof c === 'object') return { x: c.x, y: c.y, z: c.z };
    return null;
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight uppercase flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-primary" />
            Visual World Map
          </h1>
          <p className="text-sm text-muted-foreground italic">Phân tích hành trình và các cứ điểm của Bot trong không gian.</p>
        </div>

        <div className="flex gap-2 items-center">
            <Select value={filterServer} onValueChange={setFilterServer}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="All Servers" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Realms</SelectItem>
                    {servers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
            </Select>

            <Select value={filterBot} onValueChange={setFilterBot}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="All Agents" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {bots.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
            </Select>

            <div className="h-6 w-px bg-white/10 mx-1" />
            
            <div className="flex bg-muted/30 rounded-lg p-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(prev => Math.min(prev + 0.2, 5))}>
                    <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.1))}>
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView}>
                    <RotateCcw className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </div>

      <Card 
        ref={containerRef}
        className="relative flex-grow overflow-hidden bg-[#0a0a0b] border-white/5 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid Background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle, #3b82f6 1px, transparent 1px)`,
            backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
            backgroundPosition: `${offset.x}px ${offset.y}px`
          }}
        />

        {/* Map Center Indicator */}
        <div 
           className="absolute w-2 h-2 rounded-full bg-white/10 border border-white/20 -translate-x-1/2 -translate-y-1/2"
           style={{ left: `calc(50% + ${offset.x}px)`, top: `calc(50% + ${offset.y}px)` }}
        />

        {/* SVG Drawing Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <g transform={`translate(${containerRef.current?.clientWidth || 0 / 2 + offset.x}, ${containerRef.current?.clientHeight || 0 / 2 + offset.y}) scale(${zoom})`}>
                
                {/* Draw Paths for each bot */}
                {Object.entries(
                    memories.reduce((acc, m) => {
                        if (!acc[m.bot_id]) acc[m.bot_id] = [];
                        acc[m.bot_id].push(m);
                        return acc;
                    }, {} as Record<string, MapMemory[]>)
                ).map(([botId, botMems]) => {
                    const points = botMems
                        .map(m => normalizeCoords(m.metadata))
                        .filter(Boolean) as { x: number, y: number, z: number }[];
                    
                    if (points.length < 2) return null;
                    
                    const pathD = `M ${points[0].x} ${points[0].z} ` + 
                                 points.slice(1).map(p => `L ${p.x} ${p.z}`).join(' ');
                    
                    return (
                        <path 
                            key={`path-${botId}`}
                            d={pathD}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth={2 / zoom}
                            strokeOpacity={0.3}
                            strokeDasharray="4 2"
                        />
                    );
                })}

                {/* Draw Markers */}
                {memories.map((m, idx) => {
                    const coords = normalizeCoords(m.metadata);
                    if (!coords) return null;
                    const isLast = idx === memories.length - 1;
                    const isFailure = m.content.toLowerCase().includes('death') || m.content.toLowerCase().includes('died');
                    
                    return (
                        <g key={m.id} transform={`translate(${coords.x}, ${coords.z})`}>
                                <circle 
                                    r={isLast ? 6 : 3} 
                                    className={`${isLast ? 'fill-primary animate-pulse' : isFailure ? 'fill-destructive' : 'fill-white/40'} pointer-events-auto cursor-help hover:fill-primary transition-colors`}
                                    onMouseEnter={() => setHoveredMemory(m)}
                                    onMouseLeave={() => setHoveredMemory(null)}
                                />
                            {isLast && (
                                <text y="-10" textAnchor="middle" className="fill-primary text-[8px] font-bold uppercase tracking-tighter">{m.bots?.name}</text>
                            )}
                        </g>
                    );
                })}
            </g>
        </svg>

        {loading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-primary uppercase tracking-widest font-bold">
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    Scanning World Data...
                </div>
            </div>
        )}

        <div className="absolute bottom-4 right-4 flex items-center gap-3 bg-black/60 backdrop-blur-md px-3 py-2 rounded-full border border-white/5 text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">
            <MousePointer2 className="h-3 w-3 text-primary" />
            Drag to pan · Scroll to zoom · Hover dots for info
        </div>

        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
            <Badge variant="outline" className="bg-black/60 backdrop-blur-md border-white/5 px-2 py-1 text-[10px] text-muted-foreground uppercase">
                {memories.length} Markers Captured
            </Badge>
            {filterServer !== "all" && (
                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary px-2 py-1 text-[10px] uppercase">
                    Realm: {filterServer}
                </Badge>
            )}

            {hoveredMemory && (
                <Card className="mt-4 p-3 bg-black/80 backdrop-blur-xl border-primary/20 w-64 shadow-2xl animate-in fade-in slide-in-from-left-2 pointer-events-auto">
                    <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-primary/30 text-primary">
                            {hoveredMemory.bots?.name}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground font-mono">
                            {new Date(hoveredMemory.created_at).toLocaleTimeString()}
                        </span>
                    </div>
                    <p className="text-xs leading-snug line-clamp-4 text-white/90 mb-3">
                        {hoveredMemory.content}
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground bg-white/5 p-1 rounded">
                        <Target className="h-3 w-3 text-primary" />
                        X: {normalizeCoords(hoveredMemory.metadata)?.x.toFixed(0)} 
                        Z: {normalizeCoords(hoveredMemory.metadata)?.z.toFixed(0)}
                    </div>
                </Card>
            )}
        </div>
      </Card>
    </div>
  );
}
