-- ============================================================
-- Competitors Schema - Product-specific competitor intelligence
-- ============================================================

-- ============================================================
-- 1. COMPETITORS TABLE
-- ============================================================
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  description TEXT,
  -- Structured comparison data
  strengths TEXT[] DEFAULT '{}',
  limitations TEXT[] DEFAULT '{}',
  our_advantage TEXT,
  -- Rich content fields
  positioning TEXT,
  target_market TEXT,
  pricing_info TEXT,
  -- Metadata
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Ensure unique competitor slug per product
  UNIQUE(product_id, slug)
);

-- Indexes
CREATE INDEX idx_competitors_product ON competitors(product_id);
CREATE INDEX idx_competitors_status ON competitors(product_id, status) WHERE status = 'active';
CREATE INDEX idx_competitors_slug ON competitors(product_id, slug);

-- Trigger for updated_at
CREATE TRIGGER trg_competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. ADD competitor_id TO kb_updates
-- Links competitive intelligence updates to specific competitors
-- ============================================================
ALTER TABLE kb_updates ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_kb_updates_competitor ON kb_updates(competitor_id) WHERE competitor_id IS NOT NULL;

-- ============================================================
-- 3. ROW LEVEL SECURITY FOR COMPETITORS
-- ============================================================
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- Users can read competitors for products they belong to
CREATE POLICY "Users read product competitors" ON competitors
  FOR SELECT USING (user_in_product(product_id) OR is_admin());

-- Product admins can create competitors
CREATE POLICY "Admin create competitors" ON competitors
  FOR INSERT WITH CHECK (is_product_admin(product_id) OR is_admin());

-- Product admins can update competitors
CREATE POLICY "Admin update competitors" ON competitors
  FOR UPDATE USING (is_product_admin(product_id) OR is_admin());

-- Product admins can delete competitors
CREATE POLICY "Admin delete competitors" ON competitors
  FOR DELETE USING (is_product_admin(product_id) OR is_admin());

-- ============================================================
-- 4. ENABLE REALTIME FOR COMPETITORS
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE competitors;
