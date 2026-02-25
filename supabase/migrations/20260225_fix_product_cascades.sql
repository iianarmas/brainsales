-- Migration to fix product deletion issues and team visibility
-- 1. Cleanup orphaned records before adding constraints
-- This handles data left behind from previous non-cascading deletions
-- We must delete in an order that respects existing foreign key constraints

-- 1a. Delete satellite records for objects that will be orphaned
-- (Mostly handled by existing cascades, but good to be explicit for safety)
DELETE FROM kb_update_features WHERE update_id IN (SELECT id FROM kb_updates WHERE product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = kb_updates.product_id));
DELETE FROM kb_update_metrics WHERE update_id IN (SELECT id FROM kb_updates WHERE product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = kb_updates.product_id));

-- 1b. Delete updates referencing orphaned categories
DELETE FROM kb_updates WHERE category_id IN (
    SELECT id FROM kb_categories WHERE product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = kb_categories.product_id)
);

-- 1c. Delete orphaned main records
DELETE FROM kb_updates WHERE product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = kb_updates.product_id);
DELETE FROM call_nodes WHERE product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = call_nodes.product_id);
DELETE FROM topic_groups WHERE product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = topic_groups.product_id);
DELETE FROM kb_categories WHERE product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = kb_categories.product_id);
DELETE FROM competitors WHERE product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = competitors.product_id);

-- 1d. Delete orphaned teams (where product was already deleted)
-- Specifically targeting teams that look like auto-created product teams
DELETE FROM teams 
WHERE product_id IS NULL 
AND (
    name IN ('neew', 'test') -- Specifically requested by user
    OR description LIKE 'Default team for % product' -- Pattern matching for auto-created teams
)
AND NOT EXISTS (SELECT 1 FROM products WHERE name = teams.name);

-- 2. Fix foreign key constraints on existing tables to use ON DELETE CASCADE

-- Update call_nodes FK
ALTER TABLE IF EXISTS call_nodes 
DROP CONSTRAINT IF EXISTS call_nodes_product_id_fkey,
ADD CONSTRAINT call_nodes_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Update kb_updates FK
ALTER TABLE IF EXISTS kb_updates
DROP CONSTRAINT IF EXISTS kb_updates_product_id_fkey,
ADD CONSTRAINT kb_updates_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Update topic_groups FK
ALTER TABLE IF EXISTS topic_groups
DROP CONSTRAINT IF EXISTS topic_groups_product_id_fkey,
ADD CONSTRAINT topic_groups_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Update kb_categories FK
ALTER TABLE IF EXISTS kb_categories
DROP CONSTRAINT IF EXISTS kb_categories_product_id_fkey,
ADD CONSTRAINT kb_categories_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Update competitors FK
ALTER TABLE IF EXISTS competitors
DROP CONSTRAINT IF EXISTS competitors_product_id_fkey,
ADD CONSTRAINT competitors_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- 3. Link Teams to Products
-- Add product_id to teams table
ALTER TABLE IF EXISTS teams 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_teams_product ON teams(product_id);

-- Try to backfill product_id for existing teams based on name match (best effort)
UPDATE teams t
SET product_id = p.id
FROM products p
WHERE t.name = p.name
AND t.product_id IS NULL;
