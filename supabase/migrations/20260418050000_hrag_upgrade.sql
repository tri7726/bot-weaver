-- HRAG Upgrade Migration
-- Add HRAG columns to agent_memories
ALTER TABLE public.agent_memories 
ADD COLUMN IF NOT EXISTS layer TEXT DEFAULT 'episodic',
ADD COLUMN IF NOT EXISTS server_id TEXT,
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.agent_memories(id) ON DELETE SET NULL;

-- Index for layer filtering
CREATE INDEX IF NOT EXISTS idx_memories_layer ON public.agent_memories(layer);
CREATE INDEX IF NOT EXISTS idx_memories_server_id ON public.agent_memories(server_id);
CREATE INDEX IF NOT EXISTS idx_memories_bot_id ON public.agent_memories(bot_id);

-- RPC for hierarchical vector search
CREATE OR REPLACE FUNCTION public.match_agent_memories (
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  p_user_id UUID,
  p_bot_id UUID
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  layer TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.layer,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memories m
  WHERE m.user_id = p_user_id
    AND (
      m.bot_id = p_bot_id -- Own memories
      OR m.layer = 'abstract' -- Shared global knowledge
    )
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
