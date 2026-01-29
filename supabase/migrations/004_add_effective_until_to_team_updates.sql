-- ============================================================
-- Add effective_until column to team_updates
-- This allows admins to set how long a team update should be followed
-- ============================================================

-- Add the effective_until column
ALTER TABLE team_updates
ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN team_updates.effective_until IS 'Optional expiry date for the team update. NULL means the update should be followed indefinitely.';

-- Create an index for efficient queries on active updates
CREATE INDEX IF NOT EXISTS idx_team_updates_effective_until
ON team_updates(effective_until)
WHERE effective_until IS NOT NULL;
