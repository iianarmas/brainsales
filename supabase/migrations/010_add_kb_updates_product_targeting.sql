-- ============================================================
-- Add Product Targeting to KB Updates
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. ADD target_product_id COLUMN TO kb_updates
-- ============================================================
ALTER TABLE kb_updates ADD COLUMN IF NOT EXISTS target_product_id UUID REFERENCES products(id);

-- Add index for product targeting
CREATE INDEX IF NOT EXISTS idx_kb_updates_target_product ON kb_updates(target_product_id);

-- ============================================================
-- 2. UPDATE RLS POLICY TO HANDLE PRODUCT-SPECIFIC KB UPDATES
-- ============================================================
-- Drop and recreate the read policy to include product-based access
DROP POLICY IF EXISTS "Public read published updates" ON kb_updates;

CREATE POLICY "Public read published updates" ON kb_updates
  FOR SELECT USING (
    -- Published updates for all users (no product specified)
    (status = 'published' AND target_product_id IS NULL)
    -- Published updates for user's products
    OR (status = 'published' AND target_product_id IS NOT NULL AND target_product_id IN (
      SELECT product_id FROM product_users WHERE user_id = auth.uid()
    ))
    -- Admins can see all
    OR is_admin()
  );

-- ============================================================
-- 3. UPDATE notify_kb_update_published TRIGGER
-- ============================================================
-- Update the trigger to handle product-specific KB updates
DROP TRIGGER IF EXISTS trg_notify_kb_update ON kb_updates;
DROP FUNCTION IF EXISTS notify_kb_update_published();

CREATE OR REPLACE FUNCTION notify_kb_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    IF NEW.target_product_id IS NOT NULL THEN
      -- Product-specific KB update - notify product users
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT
        pu.user_id,
        'new_update',
        'Product Update: ' || NEW.title,
        coalesce(NEW.summary, left(NEW.content, 200)),
        'kb_update',
        NEW.id
      FROM product_users pu
      WHERE pu.product_id = NEW.target_product_id
        AND pu.user_id != coalesce(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
    ELSE
      -- Global KB update - notify all users
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT
        u.id,
        'new_update',
        'New Update: ' || NEW.title,
        coalesce(NEW.summary, left(NEW.content, 200)),
        'kb_update',
        NEW.id
      FROM auth.users u
      WHERE u.id != coalesce(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_kb_update
  AFTER INSERT OR UPDATE ON kb_updates
  FOR EACH ROW EXECUTE FUNCTION notify_kb_update_published();

-- ============================================================
-- 4. UPDATE get_unread_count FUNCTION
-- ============================================================
-- Update the function to handle product-specific KB updates
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id UUID)
RETURNS INT AS $$
  SELECT count(*)::int
  FROM kb_updates ku
  WHERE ku.status = 'published'
    AND (
      -- Global updates (no product specified)
      ku.target_product_id IS NULL
      -- Product-specific updates for user's products
      OR (ku.target_product_id IS NOT NULL AND ku.target_product_id IN (
        SELECT product_id FROM product_users WHERE user_id = p_user_id
      ))
    )
    AND NOT EXISTS (
      SELECT 1 FROM update_acknowledgments ua
      WHERE ua.update_id = ku.id AND ua.user_id = p_user_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
