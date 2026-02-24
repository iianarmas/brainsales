-- ============================================================
-- Migration 026: Fix Multi-Tenancy Data Leaks
-- ============================================================
-- Specifically addresses:
-- 1. Online users visible across organizations
-- 2. Teams/Updates visible across organizations
-- 3. Products/Scripts visible via "is_active" flag bypassing org check
-- ============================================================

-- 1. Add organization_id to missing tables
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE team_updates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE kb_updates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE kb_categories ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE call_nodes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE call_node_keypoints ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE call_node_warnings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE call_node_listen_for ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE call_node_responses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 2. Seed organization_id for existing data
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  SELECT id INTO default_org_id FROM organizations WHERE slug = '314e-corp' LIMIT 1;

  IF default_org_id IS NOT NULL THEN
    -- Teams and User Presence (assume 314e for legacy)
    UPDATE teams SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE user_presence SET organization_id = default_org_id WHERE organization_id IS NULL;
    
    -- team_updates: try to get org from team, then from product, then default to 314e
    UPDATE team_updates tu
    SET organization_id = COALESCE(
      (SELECT organization_id FROM teams WHERE id = tu.team_id),
      (SELECT organization_id FROM products WHERE id = tu.target_product_id),
      default_org_id
    )
    WHERE organization_id IS NULL;

    -- kb_updates: get org from product
    UPDATE kb_updates ku
    SET organization_id = COALESCE(
      (SELECT organization_id FROM products WHERE id = ku.product_id),
      default_org_id
    )
    WHERE organization_id IS NULL;

    -- competitors: get org from product
    UPDATE competitors c
    SET organization_id = COALESCE(
      (SELECT organization_id FROM products WHERE id = c.product_id),
      default_org_id
    )
    WHERE organization_id IS NULL;

    -- kb_categories: get org from product (or default if null)
    UPDATE kb_categories kc
    SET organization_id = COALESCE(
      (SELECT organization_id FROM products WHERE id = kc.product_id),
      default_org_id
    )
    WHERE organization_id IS NULL;

    -- call_nodes and related: get org from product
    UPDATE call_nodes cn
    SET organization_id = COALESCE(
      (SELECT organization_id FROM products WHERE id = cn.product_id),
      default_org_id
    )
    WHERE organization_id IS NULL;

    UPDATE call_node_keypoints k SET organization_id = (SELECT organization_id FROM call_nodes WHERE id = k.node_id) WHERE organization_id IS NULL;
    UPDATE call_node_warnings w SET organization_id = (SELECT organization_id FROM call_nodes WHERE id = w.node_id) WHERE organization_id IS NULL;
    UPDATE call_node_listen_for l SET organization_id = (SELECT organization_id FROM call_nodes WHERE id = l.node_id) WHERE organization_id IS NULL;
    UPDATE call_node_responses r SET organization_id = (SELECT organization_id FROM call_nodes WHERE id = r.node_id) WHERE organization_id IS NULL;
  END IF;
END $$;

-- 3. Strengthen RLS for products
-- Remove the overly permissive 'OR is_active = true' which allowed cross-org viewing
DROP POLICY IF EXISTS "Users can view products in their organizations" ON products;
DROP POLICY IF EXISTS "Users see their products" ON products;
CREATE POLICY "Users can view products in their organizations"
  ON products FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()));

-- 4. Strengthen RLS for teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own teams" ON teams;
DROP POLICY IF EXISTS "Users read organization teams" ON teams;
CREATE POLICY "Users read organization teams"
  ON teams FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()) OR is_admin());

DROP POLICY IF EXISTS "Admin manage teams" ON teams;
DROP POLICY IF EXISTS "Org admins manage teams" ON teams;
CREATE POLICY "Org admins manage teams"
  ON teams FOR ALL
  USING (is_org_admin(organization_id) OR is_admin());

-- 5. Strengthen RLS for team_updates
ALTER TABLE team_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read team updates" ON team_updates;
DROP POLICY IF EXISTS "Users read organization team updates" ON team_updates;
CREATE POLICY "Users read organization team updates"
  ON team_updates FOR SELECT
  USING (
    (status = 'published' AND organization_id IN (SELECT get_user_orgs()))
    OR is_admin()
  );

-- 6. Add RLS for user_presence
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view presence in their org" ON user_presence;
CREATE POLICY "Users can view presence in their org"
  ON user_presence FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()) OR is_admin());

DROP POLICY IF EXISTS "Users can manage own presence" ON user_presence;
CREATE POLICY "Users can manage own presence"
  ON user_presence FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 7. Strengthen RLS for kb_updates
DROP POLICY IF EXISTS "Users read product kb_updates" ON kb_updates;
DROP POLICY IF EXISTS "Public read published updates" ON kb_updates;
DROP POLICY IF EXISTS "Users read organization kb_updates" ON kb_updates;
CREATE POLICY "Users read organization kb_updates"
  ON kb_updates FOR SELECT
  USING (
    (status = 'published' AND organization_id IN (SELECT get_user_orgs()))
    OR is_admin()
  );

-- 8. Ensure organization_id is NOT NULL for future teams
-- (presence and updates stay nullable for migration safety, but app code will set them)
ALTER TABLE teams ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE team_updates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE kb_updates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE competitors ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE kb_categories ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE call_nodes ALTER COLUMN organization_id SET NOT NULL;

-- 9. Strengthen RLS for competitors
DROP POLICY IF EXISTS "Users read product competitors" ON competitors;
DROP POLICY IF EXISTS "Users read organization competitors" ON competitors;
CREATE POLICY "Users read organization competitors"
  ON competitors FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()) OR is_admin());

-- 10. Strengthen RLS for kb_categories
DROP POLICY IF EXISTS "Public read categories" ON kb_categories;
DROP POLICY IF EXISTS "Users read product categories" ON kb_categories;
DROP POLICY IF EXISTS "Users read organization categories" ON kb_categories;
CREATE POLICY "Users read organization categories"
  ON kb_categories FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()) OR is_admin());

-- 11. Strengthen RLS for call_nodes
DROP POLICY IF EXISTS "Users read product nodes" ON call_nodes;
DROP POLICY IF EXISTS "Users read organization nodes" ON call_nodes;
CREATE POLICY "Users read organization nodes"
  ON call_nodes FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()) OR is_admin());

-- 10. Redefine search_kb_updates to be organization-aware
DROP FUNCTION IF EXISTS search_kb_updates(TEXT, UUID);
CREATE OR REPLACE FUNCTION search_kb_updates(search_query TEXT, p_organization_id UUID DEFAULT NULL)
RETURNS SETOF kb_updates AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM kb_updates
  WHERE status = 'published'
    AND (p_organization_id IS NULL OR organization_id = p_organization_id)
    AND search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', search_query)) DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
