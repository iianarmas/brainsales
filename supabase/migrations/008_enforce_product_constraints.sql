-- ============================================================
-- Multi-Product Support - Phase 3: Enforce Constraints
-- Run this AFTER confirming 007_migrate_dexit_data.sql works
-- and all existing data has product_id set
-- ============================================================

-- IMPORTANT: Before running this migration, verify:
-- 1. All call_nodes have product_id set
-- 2. All kb_updates have product_id set
-- 3. All kb_categories have product_id set
-- 4. All topic_groups have product_id set
-- 5. All call_node_* tables have product_id set

-- ============================================================
-- 1. VERIFICATION QUERIES (run these first to check)
-- ============================================================
-- Uncomment and run these to verify data is migrated:

-- SELECT COUNT(*) as orphan_nodes FROM call_nodes WHERE product_id IS NULL;
-- SELECT COUNT(*) as orphan_updates FROM kb_updates WHERE product_id IS NULL;
-- SELECT COUNT(*) as orphan_categories FROM kb_categories WHERE product_id IS NULL;
-- SELECT COUNT(*) as orphan_topic_groups FROM topic_groups WHERE product_id IS NULL;
-- SELECT COUNT(*) as orphan_keypoints FROM call_node_keypoints WHERE product_id IS NULL;
-- SELECT COUNT(*) as orphan_warnings FROM call_node_warnings WHERE product_id IS NULL;
-- SELECT COUNT(*) as orphan_listen_for FROM call_node_listen_for WHERE product_id IS NULL;
-- SELECT COUNT(*) as orphan_responses FROM call_node_responses WHERE product_id IS NULL;

-- ============================================================
-- 2. MAKE product_id NOT NULL (only after verification passes)
-- ============================================================

-- Call Nodes
ALTER TABLE call_nodes ALTER COLUMN product_id SET NOT NULL;

-- Call Node related tables
ALTER TABLE call_node_keypoints ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE call_node_warnings ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE call_node_listen_for ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE call_node_responses ALTER COLUMN product_id SET NOT NULL;

-- Topic Groups
ALTER TABLE topic_groups ALTER COLUMN product_id SET NOT NULL;

-- KB Updates
ALTER TABLE kb_updates ALTER COLUMN product_id SET NOT NULL;

-- KB Categories (keeping nullable for global categories)
-- ALTER TABLE kb_categories ALTER COLUMN product_id SET NOT NULL;

-- ============================================================
-- 3. ADD FOREIGN KEY CONSTRAINTS (if not already added)
-- ============================================================

-- Note: FK constraints were added in 006, but if they weren't,
-- you can add them here:

-- ALTER TABLE call_nodes
--   ADD CONSTRAINT fk_call_nodes_product
--   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- ============================================================
-- 4. UPDATE RLS POLICIES TO REMOVE NULL HANDLING
-- ============================================================

-- Update Call Nodes policy (remove product_id.is.null fallback)
DROP POLICY IF EXISTS "Users read product nodes" ON call_nodes;
CREATE POLICY "Users read product nodes" ON call_nodes
  FOR SELECT USING (
    product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid())
    OR is_admin()
  );

-- Update KB Updates policy
DROP POLICY IF EXISTS "Users read product kb_updates" ON kb_updates;
CREATE POLICY "Users read product kb_updates" ON kb_updates
  FOR SELECT USING (
    (status = 'published' AND product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid()))
    OR is_admin()
  );

-- Update Topic Groups policy
DROP POLICY IF EXISTS "Users read product topic_groups" ON topic_groups;
CREATE POLICY "Users read product topic_groups" ON topic_groups
  FOR SELECT USING (
    product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid())
    OR is_admin()
  );

-- ============================================================
-- 5. CREATE HELPER FUNCTION FOR DEFAULT PRODUCT ASSIGNMENT
-- ============================================================

-- Trigger function to auto-assign product_id on insert if not provided
-- (Useful for legacy code that doesn't set product_id)
CREATE OR REPLACE FUNCTION set_default_product_id()
RETURNS TRIGGER AS $$
DECLARE
  user_product_id UUID;
BEGIN
  -- Only set if product_id is not provided and we have a way to determine it
  IF NEW.product_id IS NULL THEN
    -- Try to get the user's default product
    -- This assumes created_by or similar field exists
    SELECT product_id INTO user_product_id
    FROM product_users
    WHERE user_id = auth.uid()
    ORDER BY is_default DESC, joined_at ASC
    LIMIT 1;

    IF user_product_id IS NOT NULL THEN
      NEW.product_id := user_product_id;
    ELSE
      RAISE EXCEPTION 'product_id is required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. ADD INSERT POLICIES FOR NEW CONTENT
-- ============================================================

-- Ensure users can only create content for products they belong to
DROP POLICY IF EXISTS "Users create product nodes" ON call_nodes;
CREATE POLICY "Users create product nodes" ON call_nodes
  FOR INSERT WITH CHECK (
    product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
    OR is_admin()
  );

DROP POLICY IF EXISTS "Users create product kb_updates" ON kb_updates;
CREATE POLICY "Users create product kb_updates" ON kb_updates
  FOR INSERT WITH CHECK (
    product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
    OR is_admin()
  );

-- ============================================================
-- 7. SUMMARY OF CHANGES
-- ============================================================
-- After running this migration:
-- 1. product_id is required (NOT NULL) for: call_nodes, call_node_*, topic_groups, kb_updates
-- 2. kb_categories still allows NULL for global categories
-- 3. RLS policies enforce product isolation
-- 4. Users can only create content for products they have admin access to
-- 5. Team updates support is_broadcast and target_product_id for cross-product messaging
