-- ============================================================
-- Fix Team Updates Schema - Allow NULL team_id for broadcasts
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. ALTER team_id TO BE NULLABLE
-- ============================================================
-- This allows product-specific and global broadcasts to exist without a team_id
ALTER TABLE team_updates ALTER COLUMN team_id DROP NOT NULL;

-- ============================================================
-- 2. ADD CONSTRAINT TO ENSURE DATA INTEGRITY
-- ============================================================
-- Ensure that at least one of the following is true:
-- - team_id is set (normal team update)
-- - target_product_id is set (product-specific broadcast)
-- - is_broadcast is true (global broadcast to all users)
ALTER TABLE team_updates ADD CONSTRAINT team_updates_target_check
  CHECK (
    team_id IS NOT NULL OR
    target_product_id IS NOT NULL OR
    is_broadcast = true
  );

-- ============================================================
-- 3. UPDATE EXISTING TRIGGER TO HANDLE NULL team_id
-- ============================================================
-- The existing notify_team_update_published trigger already handles
-- is_broadcast and target_product_id cases, but we need to ensure
-- it doesn't fail when team_id is NULL

-- Drop and recreate the trigger function to be more defensive
DROP TRIGGER IF EXISTS trg_notify_team_update ON team_updates;
DROP FUNCTION IF EXISTS notify_team_update_published();

CREATE OR REPLACE FUNCTION notify_team_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    IF NEW.is_broadcast = true THEN
      -- Broadcast to all users
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT
        p.user_id,
        'new_team_update',
        'Broadcast: ' || NEW.title,
        left(NEW.content, 200),
        'team_update',
        NEW.id
      FROM profiles p
      WHERE p.user_id != NEW.created_by;
    ELSIF NEW.target_product_id IS NOT NULL THEN
      -- Broadcast to product users
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT
        pu.user_id,
        'new_team_update',
        'Product Update: ' || NEW.title,
        left(NEW.content, 200),
        'team_update',
        NEW.id
      FROM product_users pu
      WHERE pu.product_id = NEW.target_product_id
        AND pu.user_id != NEW.created_by;
    ELSIF NEW.team_id IS NOT NULL THEN
      -- Normal team update
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT
        tm.user_id,
        'new_team_update',
        'Team Update: ' || NEW.title,
        left(NEW.content, 200),
        'team_update',
        NEW.id
      FROM team_members tm
      WHERE tm.team_id = NEW.team_id
        AND tm.user_id != NEW.created_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_team_update
  AFTER INSERT OR UPDATE ON team_updates
  FOR EACH ROW EXECUTE FUNCTION notify_team_update_published();

-- ============================================================
-- 4. UPDATE RLS POLICY TO HANDLE NULL team_id
-- ============================================================
-- The existing policy already handles broadcasts and product updates,
-- but we need to ensure it doesn't fail with NULL team_id

DROP POLICY IF EXISTS "Users read team updates" ON team_updates;
CREATE POLICY "Users read team updates" ON team_updates
  FOR SELECT USING (
    -- User's team updates (normal) - only check if team_id is not null
    (status = 'published' AND team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members WHERE team_id = team_updates.team_id AND user_id = auth.uid()
    ))
    -- Broadcast to all teams
    OR (status = 'published' AND is_broadcast = true)
    -- Broadcast to user's product
    OR (status = 'published' AND target_product_id IS NOT NULL AND target_product_id IN (
      SELECT product_id FROM product_users WHERE user_id = auth.uid()
    ))
    OR is_admin()
  );

-- ============================================================
-- 5. UPDATE get_team_unread_count FUNCTION
-- ============================================================
-- Update the function to handle broadcasts and product updates

CREATE OR REPLACE FUNCTION get_team_unread_count(p_user_id UUID)
RETURNS INT AS $$
  SELECT count(*)::int
  FROM team_updates tu
  WHERE tu.status = 'published'
    AND (
      -- User's team updates
      (tu.team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members tm 
        WHERE tm.team_id = tu.team_id AND tm.user_id = p_user_id
      ))
      -- Global broadcasts
      OR tu.is_broadcast = true
      -- Product-specific broadcasts
      OR (tu.target_product_id IS NOT NULL AND tu.target_product_id IN (
        SELECT product_id FROM product_users WHERE user_id = p_user_id
      ))
    )
    AND NOT EXISTS (
      SELECT 1 FROM team_update_acknowledgments tua
      WHERE tua.team_update_id = tu.id AND tua.user_id = p_user_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
