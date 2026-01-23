-- Fix existing user_presence table
-- Run this in your Supabase SQL Editor

-- Drop the trigger that's causing the error
DROP TRIGGER IF EXISTS update_user_presence_updated_at_trigger ON user_presence;

-- Add the missing updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_presence' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_presence ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Recreate the trigger function
CREATE OR REPLACE FUNCTION update_user_presence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER update_user_presence_updated_at_trigger
  BEFORE UPDATE ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_user_presence_updated_at();

-- Verify the fix
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_presence'
ORDER BY ordinal_position;
