-- Add server_ip to agent_memories for squad-wide sharing
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS server_ip TEXT;

-- Index for fast squad memory lookup
CREATE INDEX IF NOT EXISTS idx_memories_server ON agent_memories(server_ip);

-- Backfill server_ip from bots table (optional, but helpful)
UPDATE agent_memories am
SET server_ip = b.server_ip
FROM bots b
WHERE am.bot_id = b.id;
