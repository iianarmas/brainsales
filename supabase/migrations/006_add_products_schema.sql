-- ============================================================
-- Multi-Product Support - Phase 1: Schema Foundation
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PRODUCTS TABLE
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. PRODUCT USERS (membership with roles)
-- ============================================================
CREATE TABLE product_users (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  is_default BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (product_id, user_id)
);

CREATE INDEX idx_product_users_user ON product_users(user_id);
CREATE INDEX idx_product_users_default ON product_users(user_id, is_default) WHERE is_default = true;

-- Ensure only one default product per user
CREATE OR REPLACE FUNCTION ensure_single_default_product()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE product_users
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND product_id != NEW.product_id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_default_product
  BEFORE INSERT OR UPDATE ON product_users
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_product();

-- ============================================================
-- 3. PRODUCT QUICK REFERENCE (dynamic per-product content)
-- ============================================================
CREATE TABLE product_quick_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('differentiators', 'competitors', 'metrics', 'tips')),
  data JSONB NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quick_ref_product ON product_quick_reference(product_id);
CREATE INDEX idx_quick_ref_section ON product_quick_reference(product_id, section);

CREATE TRIGGER trg_quick_ref_updated_at
  BEFORE UPDATE ON product_quick_reference
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. PRODUCT OBJECTION SHORTCUTS (configurable 0-9 keys)
-- ============================================================
CREATE TABLE product_objection_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  shortcut_key TEXT NOT NULL CHECK (shortcut_key IN ('0','1','2','3','4','5','6','7','8','9')),
  label TEXT, -- Optional display label override
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, shortcut_key),
  UNIQUE(product_id, node_id)
);

CREATE INDEX idx_objection_shortcuts_product ON product_objection_shortcuts(product_id);

-- ============================================================
-- 5. ADD NULLABLE product_id TO EXISTING TABLES
-- These will be made NOT NULL in a later migration after data migration
-- ============================================================

-- Call Nodes (scripts)
ALTER TABLE call_nodes ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
CREATE INDEX IF NOT EXISTS idx_call_nodes_product ON call_nodes(product_id);

-- Call Node related tables
ALTER TABLE call_node_keypoints ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE call_node_warnings ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE call_node_listen_for ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE call_node_responses ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

-- Topic Groups
ALTER TABLE topic_groups ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
CREATE INDEX IF NOT EXISTS idx_topic_groups_product ON topic_groups(product_id);

-- Knowledge Base Updates
ALTER TABLE kb_updates ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
CREATE INDEX IF NOT EXISTS idx_kb_updates_product ON kb_updates(product_id);

-- KB Categories (product-specific categories)
ALTER TABLE kb_categories ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_product ON kb_categories(product_id);

-- ============================================================
-- 6. TEAM UPDATES - Add broadcast capability
-- ============================================================
ALTER TABLE team_updates ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN DEFAULT false;
ALTER TABLE team_updates ADD COLUMN IF NOT EXISTS target_product_id UUID REFERENCES products(id);

CREATE INDEX IF NOT EXISTS idx_team_updates_broadcast ON team_updates(is_broadcast) WHERE is_broadcast = true;
CREATE INDEX IF NOT EXISTS idx_team_updates_target_product ON team_updates(target_product_id);

-- ============================================================
-- 7. ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================

-- Helper function: Check if user is super_admin in any product
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM product_users
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: Check if user is admin for a specific product
CREATE OR REPLACE FUNCTION is_product_admin(p_product_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM product_users
    WHERE user_id = auth.uid()
    AND product_id = p_product_id
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: Check if user belongs to a product
CREATE OR REPLACE FUNCTION user_in_product(p_product_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM product_users
    WHERE user_id = auth.uid()
    AND product_id = p_product_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: Get user's product IDs
CREATE OR REPLACE FUNCTION get_user_products()
RETURNS SETOF UUID AS $$
  SELECT product_id FROM product_users WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Products RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their products" ON products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM product_users WHERE product_id = products.id AND user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "Super admin create products" ON products
  FOR INSERT WITH CHECK (is_super_admin() OR is_admin());

CREATE POLICY "Super admin update products" ON products
  FOR UPDATE USING (is_super_admin() OR is_admin());

CREATE POLICY "Super admin delete products" ON products
  FOR DELETE USING (is_super_admin() OR is_admin());

-- Product Users RLS
ALTER TABLE product_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own memberships" ON product_users
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Admin manage memberships" ON product_users
  FOR INSERT WITH CHECK (is_product_admin(product_id) OR is_admin());

CREATE POLICY "Admin update memberships" ON product_users
  FOR UPDATE USING (is_product_admin(product_id) OR is_admin());

CREATE POLICY "Admin delete memberships" ON product_users
  FOR DELETE USING (is_product_admin(product_id) OR is_admin());

-- Quick Reference RLS
ALTER TABLE product_quick_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read product quick ref" ON product_quick_reference
  FOR SELECT USING (user_in_product(product_id) OR is_admin());

CREATE POLICY "Admin manage quick ref" ON product_quick_reference
  FOR INSERT WITH CHECK (is_product_admin(product_id) OR is_admin());

CREATE POLICY "Admin update quick ref" ON product_quick_reference
  FOR UPDATE USING (is_product_admin(product_id) OR is_admin());

CREATE POLICY "Admin delete quick ref" ON product_quick_reference
  FOR DELETE USING (is_product_admin(product_id) OR is_admin());

-- Objection Shortcuts RLS
ALTER TABLE product_objection_shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read product shortcuts" ON product_objection_shortcuts
  FOR SELECT USING (user_in_product(product_id) OR is_admin());

CREATE POLICY "Admin manage shortcuts" ON product_objection_shortcuts
  FOR INSERT WITH CHECK (is_product_admin(product_id) OR is_admin());

CREATE POLICY "Admin update shortcuts" ON product_objection_shortcuts
  FOR UPDATE USING (is_product_admin(product_id) OR is_admin());

CREATE POLICY "Admin delete shortcuts" ON product_objection_shortcuts
  FOR DELETE USING (is_product_admin(product_id) OR is_admin());

-- ============================================================
-- 8. ENABLE REALTIME FOR NEW TABLES
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE product_users;

-- ============================================================
-- 9. GET DEFAULT PRODUCT FOR USER
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_default_product(p_user_id UUID)
RETURNS UUID AS $$
  SELECT product_id
  FROM product_users
  WHERE user_id = p_user_id
  ORDER BY is_default DESC, joined_at ASC
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
