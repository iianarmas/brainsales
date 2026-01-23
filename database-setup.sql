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
