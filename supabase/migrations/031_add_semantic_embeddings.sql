-- ============================================================
-- Migration 031: Semantic Embeddings for AI Navigation Cache
-- ============================================================
-- Upgrades the ai_navigation_cache to support vector similarity
-- search via pgvector. Phrases are now stored as mathematical
-- embeddings (1536-dimensional vectors) enabling the system to
-- recognize semantically equivalent phrases it has never seen
-- before, bypassing Claude entirely with near-instant matching.
-- ============================================================

-- Enable the pgvector extension (pre-installed on Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to existing cache table
-- Nullable so existing rows are not broken by this migration
ALTER TABLE ai_navigation_cache
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for fast approximate nearest-neighbor search
-- m=16 and ef_construction=64 are well-balanced defaults:
--   m            → number of bi-directional links per node (higher = better recall, more memory)
--   ef_construction → candidate list size during build (higher = better quality, slower build)
-- vector_cosine_ops → optimise for cosine distance, which is ideal for text embeddings
CREATE INDEX IF NOT EXISTS idx_ai_nav_cache_embedding_hnsw
  ON ai_navigation_cache
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- RPC: match_intents
-- ============================================================
-- Finds the best semantically matching cache entry for a given
-- embedding. Strictly scoped by product_id. Only returns
-- confirmed or corrected entries that have an embedding stored
-- and whose cosine similarity exceeds the threshold.
--
-- Parameters:
--   query_embedding  → the embedding of the incoming phrase
--   query_product_id → scopes the search to this product only
--   match_threshold  → minimum cosine similarity (default 0.90)
--   match_count      → maximum results to return (default 1)
--
-- Returns rows ordered by highest similarity first.
-- ============================================================
CREATE OR REPLACE FUNCTION match_intents(
  query_embedding  vector(1536),
  query_product_id uuid,
  match_threshold  float DEFAULT 0.90,
  match_count      int   DEFAULT 1
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
  ORDER BY c.embedding <=> query_embedding  -- closest first
  LIMIT match_count;
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION match_intents TO authenticated, service_role;
