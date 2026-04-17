-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- AGENT MEMORIES (Vector storage)
CREATE TABLE public.agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- Default for OpenAI, adjust if needed
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own memories" ON public.agent_memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own memories" ON public.agent_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own memories" ON public.agent_memories FOR DELETE USING (auth.uid() = user_id);

-- Gist or HNSW index for vector search (HNSW is generally faster for Supabase)
CREATE INDEX ON public.agent_memories USING hnsw (embedding vector_cosine_ops);

-- AGENT SESSIONS
CREATE TABLE public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
  session_data JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own sessions" ON public.agent_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own sessions" ON public.agent_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own sessions" ON public.agent_sessions FOR UPDATE USING (auth.uid() = user_id);

-- AGENT PROFILES (Overrideable configs)
CREATE TABLE public.agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profile_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own agent profiles" ON public.agent_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own agent profiles" ON public.agent_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own agent profiles" ON public.agent_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own agent profiles" ON public.agent_profiles FOR DELETE USING (auth.uid() = user_id);
