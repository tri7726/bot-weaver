-- Timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- GLOBAL SETTINGS (one row per user)
CREATE TABLE public.global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  api_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own settings" ON public.global_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own settings" ON public.global_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own settings" ON public.global_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own settings" ON public.global_settings FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.global_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BOTS
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  minecraft_username TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT 'localhost',
  port INTEGER NOT NULL DEFAULT 25565,
  auth_type TEXT NOT NULL DEFAULT 'offline' CHECK (auth_type IN ('microsoft','offline')),
  system_prompt TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_api_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
  use_global_keys BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('stopped','starting','running','error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own bots" ON public.bots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own bots" ON public.bots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own bots" ON public.bots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own bots" ON public.bots FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_bots_updated BEFORE UPDATE ON public.bots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_bots_user ON public.bots(user_id);

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_tasks_user ON public.tasks(user_id);

-- BOT LOGS
CREATE TABLE public.bot_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error','debug')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own logs" ON public.bot_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own logs" ON public.bot_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own logs" ON public.bot_logs FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_logs_bot ON public.bot_logs(bot_id, created_at DESC);