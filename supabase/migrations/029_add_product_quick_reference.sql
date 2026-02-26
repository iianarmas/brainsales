-- ============================================================
-- Product Quick Reference Table
-- Stores section-based quick reference data per product
-- (differentiators, competitors, metrics, tips)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_quick_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('differentiators', 'competitors', 'metrics', 'tips')),
  data JSONB NOT NULL DEFAULT '[]',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- One row per section per product
  UNIQUE(product_id, section)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_quick_reference_product ON product_quick_reference(product_id);
CREATE INDEX IF NOT EXISTS idx_product_quick_reference_section ON product_quick_reference(product_id, section);

-- Trigger for updated_at
CREATE TRIGGER trg_product_quick_reference_updated_at
  BEFORE UPDATE ON product_quick_reference
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE product_quick_reference ENABLE ROW LEVEL SECURITY;

-- Users can read quick reference for products they belong to
CREATE POLICY "Users read product quick reference" ON product_quick_reference
  FOR SELECT USING (user_in_product(product_id) OR is_admin());

-- Product admins can insert
CREATE POLICY "Admin insert product quick reference" ON product_quick_reference
  FOR INSERT WITH CHECK (is_product_admin(product_id) OR is_admin());

-- Product admins can update
CREATE POLICY "Admin update product quick reference" ON product_quick_reference
  FOR UPDATE USING (is_product_admin(product_id) OR is_admin());

-- Product admins can delete
CREATE POLICY "Admin delete product quick reference" ON product_quick_reference
  FOR DELETE USING (is_product_admin(product_id) OR is_admin());
