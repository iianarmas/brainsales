-- ============================================================
-- Fix Team Updates Product Foreign Key
-- ============================================================

-- Ensure the foreign key constraint exists for target_product_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_updates_target_product_id_fkey'
  ) THEN
    ALTER TABLE team_updates
    ADD CONSTRAINT team_updates_target_product_id_fkey
    FOREIGN KEY (target_product_id)
    REFERENCES products(id)
    ON DELETE SET NULL;
  END IF;
END $$;
