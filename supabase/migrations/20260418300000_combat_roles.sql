-- Add combat_role to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS combat_role TEXT DEFAULT 'DPS';

-- Update Heartbeat to include health and role
ALTER TABLE bots ADD COLUMN IF NOT EXISTS current_hp NUMERIC DEFAULT 20;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS max_hp NUMERIC DEFAULT 20;
