-- Add server_ip column to agent_memories
ALTER TABLE public.agent_memories ADD COLUMN IF NOT EXISTS server_ip TEXT;

-- Create a unique constraint for squad-wide unique locations [Server + Content]
ALTER TABLE public.agent_memories DROP CONSTRAINT IF EXISTS agent_memories_server_ip_content_key;
ALTER TABLE public.agent_memories ADD CONSTRAINT agent_memories_server_ip_content_key UNIQUE (server_ip, content);

-- Update RLS policies to include the new column (implied by table-wide access)
