-- Add product_id to flow_snapshots
ALTER TABLE flow_snapshots ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

-- Update existing snapshots with Dexit product ID (assuming Dexit is the default)
DO $$
DECLARE
  dexit_id UUID;
BEGIN
  SELECT id INTO dexit_id FROM products WHERE slug = 'dexit';
  IF dexit_id IS NOT NULL THEN
    UPDATE flow_snapshots SET product_id = dexit_id WHERE product_id IS NULL;
  END IF;
END $$;

-- Make it NOT NULL after migration
ALTER TABLE flow_snapshots ALTER COLUMN product_id SET NOT NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_flow_snapshots_product ON flow_snapshots(product_id);
