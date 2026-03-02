-- ============================================================
-- Migration 032: Add call_flow_id scoping to AI Navigation Cache
-- ============================================================
-- Fixes cross-call-flow cache contamination: previously all cache
-- entries were scoped only by product_id, so training from Call
-- Flow A would bleed into Call Flow B when the same phrase was heard.
--
-- After this migration:
--   - New entries store the call_flow_id they were trained in.
--   - Lookups filter to the active call_flow_id OR universal entries
--     (call_flow_id IS NULL — backward-compat for existing rows).
--   - The match_intents RPC gains an optional query_call_flow_id param.
-- ============================================================

-- 1. Add nullable call_flow_id column (NULL = universal, visible from any flow)
ALTER TABLE ai_navigation_cache
  ADD COLUMN IF NOT EXISTS call_flow_id TEXT;

-- 2. Index for efficient call_flow_id filtering
CREATE INDEX IF NOT EXISTS idx_ai_nav_cache_call_flow_id
  ON ai_navigation_cache(organization_id, product_id, call_flow_id);

-- 3. Rebuild unique index to include call_flow_id so the same phrase→node
--    pair can be stored independently per call flow.
--    COALESCE(call_flow_id, '') treats NULL (universal) as a single bucket
--    so duplicate universal entries are still prevented.
DROP INDEX IF EXISTS idx_ai_nav_cache_unique_phrase_node;
CREATE UNIQUE INDEX idx_ai_nav_cache_unique_phrase_node
  ON ai_navigation_cache(
    organization_id,
    product_id,
    phrase_hash,
    node_id,
    COALESCE(call_flow_id, '')
  );

-- 4. Update match_intents RPC to support optional call_flow_id filtering.
--    When query_call_flow_id is provided, only entries matching that flow
--    OR universal entries (call_flow_id IS NULL) are returned.
--
--    Drop the old 4-parameter version first to avoid ambiguity — PostgreSQL
--    treats different parameter lists as distinct overloads, so CREATE OR
--    REPLACE alone would create a second function rather than replace it.
DROP FUNCTION IF EXISTS match_intents(vector, uuid, float, int);

CREATE OR REPLACE FUNCTION match_intents(
  query_embedding    vector(1536),
  query_product_id   uuid,
  match_threshold    float  DEFAULT 0.90,
  match_count        int    DEFAULT 1,
  query_call_flow_id text   DEFAULT NULL
)
RETURNS TABLE (
  id             uuid,
  node_id        text,
  phrase_snippet text,
  status         text,
  similarity     float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.node_id,
    c.phrase_snippet,
    c.status,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM ai_navigation_cache c
  WHERE
    c.product_id = query_product_id
    AND c.status IN ('confirmed', 'corrected')
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
    -- Scope to the active call flow, or return universal entries (NULL)
    AND (
      query_call_flow_id IS NULL
      OR c.call_flow_id = query_call_flow_id
      OR c.call_flow_id IS NULL
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION match_intents TO authenticated, service_role;
