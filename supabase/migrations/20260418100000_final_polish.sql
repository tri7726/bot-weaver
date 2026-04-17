-- Create agent_handshakes table for secure inter-agent verification
CREATE TABLE IF NOT EXISTS public.agent_handshakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
    challenge TEXT NOT NULL,
    signature TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for agent_handshakes
ALTER TABLE public.agent_handshakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can view handshakes" ON public.agent_handshakes FOR SELECT USING (true);
CREATE POLICY "anyone can insert handshakes" ON public.agent_handshakes FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update handshakes" ON public.agent_handshakes FOR UPDATE USING (true);

-- Index for pruning
CREATE INDEX IF NOT EXISTS idx_handshakes_status ON public.agent_handshakes(status);
