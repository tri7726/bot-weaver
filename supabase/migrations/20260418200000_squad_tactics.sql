-- Squad Intelligence Table for tactical coordination
CREATE TABLE IF NOT EXISTS squad_intel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_ip TEXT NOT NULL,
    type TEXT NOT NULL, -- 'focus_target', 'retreat_signal'
    data JSONB NOT NULL, -- { entityId: '...', entityName: '...' }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- Index for fast lookup by server
CREATE INDEX IF NOT EXISTS idx_squad_intel_server ON squad_intel(server_ip);

-- Clean up expired intel automatically (can be called by janitor)
CREATE OR REPLACE FUNCTION clean_expired_squad_intel() RETURNS void AS $$
BEGIN
    DELETE FROM squad_intel WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
