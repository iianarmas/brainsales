-- Create call_analytics table for usage heatmaps
CREATE TABLE IF NOT EXISTS call_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id TEXT NOT NULL REFERENCES call_nodes(id) ON DELETE CASCADE,
    session_id UUID NOT NULL, -- To group nodes in a single call
    navigated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE call_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all analytics" ON call_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can insert analytics" ON call_analytics
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Index for heatmap queries
CREATE INDEX IF NOT EXISTS call_analytics_node_id_idx ON call_analytics(node_id);
CREATE INDEX IF NOT EXISTS call_analytics_session_id_idx ON call_analytics(session_id);
