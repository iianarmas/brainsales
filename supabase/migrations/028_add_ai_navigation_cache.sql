-- ============================================================
-- Migration 028: AI Navigation Cache
-- ============================================================
-- Adds a cache table to store AI navigation decisions ("intents")
-- based on prospect speech. Supports provisional learning,
-- confirmed learning (post 3+ hits), and manual human corrections.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_navigation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  phrase_hash TEXT NOT NULL,                     -- SHA-256 of normalized phrase
  phrase_snippet TEXT NOT NULL,                  -- Original raw snippet for display
  node_id TEXT NOT NULL,                         -- Target script node ID
  status TEXT NOT NULL DEFAULT 'provisional',    -- 'provisional', 'confirmed', 'corrected', 'blacklisted'
  hit_count INTEGER NOT NULL DEFAULT 1,          -- Auto-promotes to confirmed at 3
  corrected_node_id TEXT,                        -- Only used when status='corrected'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraint mapping: Ensure one active status rule per phrase per product
-- Because a phrase could be 'blacklisted' for one node but 'corrected' to another,
-- we use a unique index primarily on the hash + node_id to avoid duplication of the exact same event.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_nav_cache_unique_phrase_node 
  ON ai_navigation_cache(organization_id, product_id, phrase_hash, node_id);

-- Lookup index for finding active cache hits
CREATE INDEX IF NOT EXISTS idx_ai_nav_cache_lookup 
  ON ai_navigation_cache(organization_id, product_id, phrase_hash);

-- Allow triggers to Auto-Update timestamp
CREATE OR REPLACE FUNCTION update_ai_nav_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_nav_cache_updated_at ON ai_navigation_cache;
CREATE TRIGGER trigger_update_ai_nav_cache_updated_at
BEFORE UPDATE ON ai_navigation_cache
FOR EACH ROW
EXECUTE FUNCTION update_ai_nav_cache_updated_at();

-- Enable RLS
ALTER TABLE ai_navigation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view AI cache in their org" ON ai_navigation_cache;
CREATE POLICY "Org members can view AI cache in their org"
  ON ai_navigation_cache FOR SELECT
  USING (organization_id IN (SELECT public.get_user_orgs()));

DROP POLICY IF EXISTS "Org members can insert into AI cache in their org" ON ai_navigation_cache;
CREATE POLICY "Org members can insert into AI cache in their org"
  ON ai_navigation_cache FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_orgs()));

DROP POLICY IF EXISTS "Org members can update AI cache in their org" ON ai_navigation_cache;
CREATE POLICY "Org members can update AI cache in their org"
  ON ai_navigation_cache FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_orgs()))
  WITH CHECK (organization_id IN (SELECT public.get_user_orgs()));
