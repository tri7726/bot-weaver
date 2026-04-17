-- Add parent_id for hierarchical tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Add server_ip to filter tasks by the current Minecraft server
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS server_ip TEXT;

-- Add index for performance when fetching unassigned tasks per server
CREATE INDEX IF NOT EXISTS idx_tasks_server_unassigned ON public.tasks(server_ip, status) WHERE (bot_id IS NULL);

-- Add index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_id);

-- Update RLS if necessary (existing policies should cover new columns as long as user_id is correct)
