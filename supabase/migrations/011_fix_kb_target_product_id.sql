-- ============================================================
-- Backfill target_product_id from product_id
-- ============================================================

-- Fix any inconsistent data where target_product_id is missing but product_id is present
UPDATE kb_updates
SET target_product_id = product_id
WHERE target_product_id IS NULL 
  AND product_id IS NOT NULL
  AND product_id IN (SELECT id FROM products);
