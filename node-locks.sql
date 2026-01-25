-- Create node_locks table for collaboration features
-- This prevents two admins from editing the same node simultaneously.

CREATE TABLE IF NOT EXISTS node_locks (
    node_id TEXT PRIMARY KEY REFERENCES call_nodes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS
ALTER TABLE node_locks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view locks" ON node_locks
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own locks" ON node_locks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS node_locks_expires_at_idx ON node_locks(expires_at);

-- Function to clean up expired locks (can be called via RPC or cron)
CREATE OR REPLACE FUNCTION cleanup_expired_node_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM node_locks WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
