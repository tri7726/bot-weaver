-- 1. Update bots table for identity
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS minecraft_uuid UUID;

-- 2. Create admin_auth_sessions table for one-time tokens
CREATE TABLE IF NOT EXISTS public.admin_auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_name TEXT NOT NULL, -- The Minecraft username of the admin
    admin_uuid UUID, -- The UUID of the admin (filled after successful auth)
    token_hash TEXT NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    is_used BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for admin_auth_sessions
ALTER TABLE public.admin_auth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own auth sessions" ON public.admin_auth_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own auth sessions" ON public.admin_auth_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own auth sessions" ON public.admin_auth_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Create index for token lookup
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON public.admin_auth_sessions(token_hash) WHERE (NOT is_used);
