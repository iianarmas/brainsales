-- User Presence Tracking Table
-- Run this in your Supabase SQL Editor

-- Drop existing table if you need to recreate it (use with caution!)
-- DROP TABLE IF EXISTS user_presence CASCADE;

-- Create user_presence table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_online BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_presence_user_id_unique UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_presence
-- Users can manage their own presence
CREATE POLICY "Users can insert own presence"
  ON user_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON user_presence FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view all presence"
  ON user_presence FOR SELECT
  USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS user_presence_user_id_idx ON user_presence(user_id);
CREATE INDEX IF NOT EXISTS user_presence_last_seen_idx ON user_presence(last_seen);
CREATE INDEX IF NOT EXISTS user_presence_is_online_idx ON user_presence(is_online);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_presence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_presence_updated_at_trigger
  BEFORE UPDATE ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_user_presence_updated_at();

-- Verify the table exists
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'user_presence'
ORDER BY ordinal_position;

-- ====================================================================================
-- SCRIPT EDITOR TABLES
-- Tables for managing call flow scripts dynamically
-- ====================================================================================

-- call_nodes: stores all script nodes
CREATE TABLE IF NOT EXISTS call_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- opening, discovery, pitch, objection, close, success, end
  title TEXT NOT NULL,
  script TEXT NOT NULL,
  context TEXT,
  metadata JSONB,      -- {competitorInfo, greenFlags, redFlags}
  position_x FLOAT,    -- For React Flow positioning
  position_y FLOAT,
  topic_group_id TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- call_node_keypoints: normalized keypoints
CREATE TABLE IF NOT EXISTS call_node_keypoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id TEXT NOT NULL REFERENCES call_nodes(id) ON DELETE CASCADE,
  keypoint TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- call_node_warnings: normalized warnings/avoid items
CREATE TABLE IF NOT EXISTS call_node_warnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id TEXT NOT NULL REFERENCES call_nodes(id) ON DELETE CASCADE,
  warning TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- call_node_listen_for: normalized listen for items
CREATE TABLE IF NOT EXISTS call_node_listen_for (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id TEXT NOT NULL REFERENCES call_nodes(id) ON DELETE CASCADE,
  listen_item TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- call_node_responses: stores response options and connections
CREATE TABLE IF NOT EXISTS call_node_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id TEXT NOT NULL REFERENCES call_nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  next_node_id TEXT NOT NULL REFERENCES call_nodes(id),
  note TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- topic_groups: stores topic organization
CREATE TABLE IF NOT EXISTS topic_groups (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,   -- Lucide icon name
  color TEXT NOT NULL,  -- Tailwind color
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- script_versions: version history for audit trail
CREATE TABLE IF NOT EXISTS script_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id TEXT NOT NULL REFERENCES call_nodes(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  script TEXT NOT NULL,
  title TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS call_nodes_type_idx ON call_nodes(type);
CREATE INDEX IF NOT EXISTS call_nodes_topic_group_idx ON call_nodes(topic_group_id);
CREATE INDEX IF NOT EXISTS call_nodes_is_active_idx ON call_nodes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS call_node_keypoints_node_id_idx ON call_node_keypoints(node_id);
CREATE INDEX IF NOT EXISTS call_node_warnings_node_id_idx ON call_node_warnings(node_id);
CREATE INDEX IF NOT EXISTS call_node_listen_for_node_id_idx ON call_node_listen_for(node_id);
CREATE INDEX IF NOT EXISTS call_node_responses_node_id_idx ON call_node_responses(node_id);
CREATE INDEX IF NOT EXISTS call_node_responses_next_node_idx ON call_node_responses(next_node_id);
CREATE INDEX IF NOT EXISTS script_versions_node_id_idx ON script_versions(node_id);

-- Enable RLS on all script editor tables
ALTER TABLE call_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_node_keypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_node_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_node_listen_for ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_node_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;

-- Create is_admin() function for RLS policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public read access for all users (active nodes only)
CREATE POLICY "Public read access to call_nodes" ON call_nodes FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access to keypoints" ON call_node_keypoints FOR SELECT USING (true);
CREATE POLICY "Public read access to warnings" ON call_node_warnings FOR SELECT USING (true);
CREATE POLICY "Public read access to listen_for" ON call_node_listen_for FOR SELECT USING (true);
CREATE POLICY "Public read access to responses" ON call_node_responses FOR SELECT USING (true);
CREATE POLICY "Public read access to topic_groups" ON topic_groups FOR SELECT USING (true);
CREATE POLICY "Public read access to versions" ON script_versions FOR SELECT USING (true);

-- Admin-only write access
CREATE POLICY "Admins can insert nodes" ON call_nodes FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update nodes" ON call_nodes FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete nodes" ON call_nodes FOR DELETE USING (is_admin());

CREATE POLICY "Admins can insert keypoints" ON call_node_keypoints FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update keypoints" ON call_node_keypoints FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete keypoints" ON call_node_keypoints FOR DELETE USING (is_admin());

CREATE POLICY "Admins can insert warnings" ON call_node_warnings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update warnings" ON call_node_warnings FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete warnings" ON call_node_warnings FOR DELETE USING (is_admin());

CREATE POLICY "Admins can insert listen_for" ON call_node_listen_for FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update listen_for" ON call_node_listen_for FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete listen_for" ON call_node_listen_for FOR DELETE USING (is_admin());

CREATE POLICY "Admins can insert responses" ON call_node_responses FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update responses" ON call_node_responses FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete responses" ON call_node_responses FOR DELETE USING (is_admin());

CREATE POLICY "Admins can insert topic_groups" ON topic_groups FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update topic_groups" ON topic_groups FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete topic_groups" ON topic_groups FOR DELETE USING (is_admin());

CREATE POLICY "Admins can insert versions" ON script_versions FOR INSERT WITH CHECK (is_admin());

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_call_nodes_updated_at
  BEFORE UPDATE ON call_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_node_responses_updated_at
  BEFORE UPDATE ON call_node_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
