-- ============================================================
-- Migration 019: Add Organizations (Multi-Tenancy Foundation)
-- ============================================================
-- Adds an organizations layer above products for SaaS multi-tenancy.
-- Each organization has its own domain whitelist and member roles.
-- Products belong to organizations. Users belong to organizations.
-- ============================================================

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  allowed_domains TEXT[] DEFAULT '{}',
  allowed_emails TEXT[] DEFAULT '{}',
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(id) WHERE is_active = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();

-- 2. Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);

-- 3. Add organization_id to products (nullable initially for migration)
ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_products_organization ON products(organization_id);

-- 4. Seed 314e Corp organization
INSERT INTO organizations (name, slug, allowed_domains, allowed_emails)
VALUES (
  '314e Corporation',
  '314e-corp',
  ARRAY['314ecorp.com', '314ecorp.us'],
  ARRAY['armas.cav@gmail.com']
)
ON CONFLICT (slug) DO NOTHING;

-- 5. Assign all existing users to the 314e org
INSERT INTO organization_members (organization_id, user_id, role)
SELECT
  (SELECT id FROM organizations WHERE slug = '314e-corp'),
  au.id,
  CASE
    WHEN EXISTS (SELECT 1 FROM admins WHERE admins.user_id = au.id) THEN 'admin'
    ELSE 'member'
  END
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM organization_members om
  WHERE om.user_id = au.id
    AND om.organization_id = (SELECT id FROM organizations WHERE slug = '314e-corp')
);

-- 6. Set all existing products to the 314e org
UPDATE products
SET organization_id = (SELECT id FROM organizations WHERE slug = '314e-corp')
WHERE organization_id IS NULL;

-- 7. Make organization_id NOT NULL on products (now that all rows have values)
ALTER TABLE products ALTER COLUMN organization_id SET NOT NULL;

-- 8. RLS helper functions for organizations

-- Check if user belongs to an org
CREATE OR REPLACE FUNCTION user_in_org(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND organization_id = p_org_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is org admin or owner
CREATE OR REPLACE FUNCTION is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND organization_id = p_org_id
    AND role IN ('admin', 'owner')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get all org IDs for current user
CREATE OR REPLACE FUNCTION get_user_orgs()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 9. RLS policies for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT get_user_orgs()));

CREATE POLICY "Org admins can update their organization"
  ON organizations FOR UPDATE
  USING (is_org_admin(id));

-- 10. RLS policies for organization_members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Org admins can manage members"
  ON organization_members FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Org admins can update members"
  ON organization_members FOR UPDATE
  USING (is_org_admin(organization_id));

CREATE POLICY "Org admins can remove members"
  ON organization_members FOR DELETE
  USING (is_org_admin(organization_id));

-- 11. Update products RLS to also check org membership
-- Drop existing permissive policies if they exist and recreate with org scoping
-- (Only add new policy - existing product_users policies remain as additional check)
CREATE POLICY "Users can view products in their organizations"
  ON products FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()) OR is_active = true);
