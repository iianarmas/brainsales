-- ============================================================
-- User Sandboxes + Community Library for Scripts Editor
-- Adds scope-based node ownership for sandbox/community features
-- ============================================================

-- 1. Add new columns to call_nodes
-- scope: 'official' (admin-managed), 'sandbox' (user-owned), 'community' (published by user)
ALTER TABLE call_nodes ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'official';

-- owner_user_id: null for official nodes, set for sandbox/community nodes
ALTER TABLE call_nodes ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- published_at: timestamp when a sandbox node was published to community
ALTER TABLE call_nodes ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- forked_from_node_id: tracks which official/community node was forked from
ALTER TABLE call_nodes ADD COLUMN IF NOT EXISTS forked_from_node_id TEXT;

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS call_nodes_scope_idx ON call_nodes(scope);
CREATE INDEX IF NOT EXISTS call_nodes_owner_user_id_idx ON call_nodes(owner_user_id);
CREATE INDEX IF NOT EXISTS call_nodes_scope_product_idx ON call_nodes(scope, product_id);
CREATE INDEX IF NOT EXISTS call_nodes_scope_owner_idx ON call_nodes(scope, owner_user_id);

-- 3. Constraint: sandbox/community nodes MUST have an owner
ALTER TABLE call_nodes ADD CONSTRAINT chk_scope_owner
  CHECK (
    (scope = 'official') OR
    (scope IN ('sandbox', 'community') AND owner_user_id IS NOT NULL)
  );

-- 4. Update RLS policies for sandbox/community support
-- Note: API routes use supabaseAdmin (service role) which bypasses RLS,
-- but these policies provide defense-in-depth.

-- Update the read policy to allow all product members to see sandbox/community nodes
DROP POLICY IF EXISTS "Users read product nodes" ON call_nodes;
CREATE POLICY "Users read product nodes" ON call_nodes
  FOR SELECT USING (
    is_admin()
    OR product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid())
  );

-- Update the insert policy to allow users to create sandbox/community nodes
DROP POLICY IF EXISTS "Users create product nodes" ON call_nodes;
CREATE POLICY "Users create product nodes" ON call_nodes
  FOR INSERT WITH CHECK (
    is_admin()
    OR (
      scope IN ('sandbox', 'community')
      AND owner_user_id = auth.uid()
      AND product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid())
    )
  );

-- Add update policy for sandbox/community node owners
DROP POLICY IF EXISTS "Admins can update nodes" ON call_nodes;
CREATE POLICY "Users can update own or admin nodes" ON call_nodes
  FOR UPDATE USING (
    is_admin()
    OR (scope IN ('sandbox', 'community') AND owner_user_id = auth.uid())
  );

-- Add delete policy for sandbox/community node owners
DROP POLICY IF EXISTS "Admins can delete nodes" ON call_nodes;
CREATE POLICY "Users can delete own or admin nodes" ON call_nodes
  FOR DELETE USING (
    is_admin()
    OR (scope IN ('sandbox', 'community') AND owner_user_id = auth.uid())
  );

-- ============================================================
-- All existing nodes auto-default to scope='official' with
-- owner_user_id=NULL. No data migration needed.
-- ============================================================
