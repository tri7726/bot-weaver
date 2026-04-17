-- MIGRATION: 20260418044000_supabase_ify_management.sql
-- Goal: Link bots to profiles and add HRAG columns to memories

-- Ensure the agent_profiles table has the fields we need
-- (In case we need to add more later, for now we ensure it's usable)
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS system_prompt TEXT,
ADD COLUMN IF NOT EXISTS personality TEXT,
ADD COLUMN IF NOT EXISTS model_config JSONB DEFAULT '{}'::jsonb;

-- Link BOTS to Profiles
ALTER TABLE public.bots 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL;

-- ENHANCE MEMORIES for Hierarchical RAG
ALTER TABLE public.agent_memories
ADD COLUMN IF NOT EXISTS layer TEXT NOT NULL DEFAULT 'episodic' CHECK (layer IN ('short_term', 'episodic', 'summary', 'abstract')),
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.agent_memories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0.0 AND importance_score <= 1.0);

-- Update RLS for bot_id in memories just in case
-- (Already handled by user_id but good for indexing)
CREATE INDEX IF NOT EXISTS idx_memories_layer ON public.agent_memories(layer);
CREATE INDEX IF NOT EXISTS idx_memories_bot_layer ON public.agent_memories(bot_id, layer);

-- Seeding some Initial Profiles
-- User ID placeholder: we can't easily seed per-user here without a specific ID, 
-- but we can let the handle_new_user trigger or the UI handle it. 
-- For now, we'll let the user create them in the UI.
