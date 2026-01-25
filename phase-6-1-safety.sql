-- Create flow_snapshots table
-- (Renamed from script_versions to avoid collision with existing per-node table)
CREATE TABLE IF NOT EXISTS flow_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    label TEXT NOT NULL,
    data JSONB NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE flow_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all snapshots" ON flow_snapshots
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert snapshots" ON flow_snapshots
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Index for faster sorting/filtering
CREATE INDEX idx_flow_snapshots_created_at ON flow_snapshots(created_at DESC);
