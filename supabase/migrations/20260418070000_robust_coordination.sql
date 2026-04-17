-- 1. Create coordination_locks table to prevent duplicate decomposition
CREATE TABLE IF NOT EXISTS public.coordination_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_ip TEXT NOT NULL,
    goal_title TEXT NOT NULL,
    locked_by UUID REFERENCES public.bots(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(server_ip, goal_title)
);
ALTER TABLE public.coordination_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can view locks" ON public.coordination_locks FOR SELECT USING (true);
CREATE POLICY "anyone can insert locks" ON public.coordination_locks FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can delete locks" ON public.coordination_locks FOR DELETE USING (true);

-- 2. Add robust columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_ping TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Trigger to clean up old locks (optional, but good for hygiene)
-- For now, we'll manually handle lock cleanup or just rely on the UNIQUE constraint per session.
