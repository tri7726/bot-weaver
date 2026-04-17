
-- agent_profiles
CREATE TABLE public.agent_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  personality TEXT DEFAULT '',
  system_prompt TEXT DEFAULT '',
  model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own profiles" ON public.agent_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own profiles" ON public.agent_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own profiles" ON public.agent_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own profiles" ON public.agent_profiles FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_agent_profiles_updated BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent_memories
CREATE TABLE public.agent_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
  layer TEXT NOT NULL DEFAULT 'short_term',
  content TEXT NOT NULL,
  importance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  server_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_memories_bot ON public.agent_memories(bot_id);
CREATE INDEX idx_agent_memories_layer ON public.agent_memories(layer);
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own memories" ON public.agent_memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own memories" ON public.agent_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own memories" ON public.agent_memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own memories" ON public.agent_memories FOR DELETE USING (auth.uid() = user_id);

-- admin_auth_sessions
CREATE TABLE public.admin_auth_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_name TEXT NOT NULL DEFAULT 'Admin',
  token_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_sessions_user ON public.admin_auth_sessions(user_id);
ALTER TABLE public.admin_auth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own sessions" ON public.admin_auth_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own sessions" ON public.admin_auth_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own sessions" ON public.admin_auth_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own sessions" ON public.admin_auth_sessions FOR DELETE USING (auth.uid() = user_id);

-- bots: thêm cột
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS minecraft_uuid TEXT,
  ADD COLUMN IF NOT EXISTS public_key TEXT;
