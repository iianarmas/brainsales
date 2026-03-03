-- ============================================================
-- Migration 033: AI Training System
-- ============================================================
-- Adds two training mechanisms so admins can pre-seed the AI
-- navigation cache before live calls:
--
-- 1. Simulation Sessions — admin walks through a call flow step
--    by step, typing prospect utterances, reviewing AI navigation
--    results, and approving/correcting each one before applying
--    to the shared ai_navigation_cache.
--
-- 2. Conversation Upload — admin pastes a text transcript;
--    Claude batch-processes all prospect turns, maps each to the
--    correct navigation node, and flags "gaps" (utterances with
--    no matching node, suggesting a new script should be created).
--
-- All training artifacts are scoped to:
--   organization_id + product_id + call_flow_id
-- ============================================================

-- ─── Simulation ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_simulation_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  product_id       UUID NOT NULL,
  call_flow_id     TEXT NOT NULL,         -- required: specific call flow being trained
  created_by       UUID,
  title            TEXT NOT NULL,
  opening_node_id  TEXT NOT NULL,         -- starting node of the walkthrough
  current_node_id  TEXT NOT NULL,         -- tracks current position in the call flow
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'completed')),
  step_count       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_sessions_org_product
  ON ai_simulation_sessions(organization_id, product_id, call_flow_id);

CREATE TABLE IF NOT EXISTS ai_simulation_steps (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES ai_simulation_sessions(id) ON DELETE CASCADE,
  organization_id      UUID NOT NULL,
  product_id           UUID NOT NULL,
  call_flow_id         TEXT NOT NULL,
  step_number          INTEGER NOT NULL,
  from_node_id         TEXT NOT NULL,             -- node BEFORE this utterance
  utterance            TEXT NOT NULL,             -- admin's typed prospect utterance
  tier_hit             INTEGER                    -- 1 | 2 | 3 | null (no match)
                       CHECK (tier_hit IN (1, 2, 3)),
  resolved_node_id     TEXT,                      -- where AI navigated to
  resolved_node_title  TEXT,                      -- denormalized for display
  resolved_confidence  TEXT
                       CHECK (resolved_confidence IN ('high', 'medium', 'low')),
  similarity_score     FLOAT,                     -- tier 2 cosine score
  tier3_reasoning      TEXT,                      -- Claude's reasoning (tier 3)
  matched_phrase       TEXT,                      -- tier 2: which cached phrase matched
  review_status        TEXT NOT NULL DEFAULT 'pending'
                       CHECK (review_status IN ('pending', 'confirmed', 'corrected', 'rejected')),
  admin_node_id        TEXT,                      -- set when corrected
  applied_to_cache     BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_steps_session
  ON ai_simulation_steps(session_id, step_number);

-- ─── Conversation Upload ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_training_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  product_id       UUID NOT NULL,
  call_flow_id     TEXT NOT NULL,         -- required: which call flow this transcript covers
  created_by       UUID,
  title            TEXT NOT NULL,
  raw_transcript   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'ready', 'error', 'applied')),
  entry_count      INTEGER NOT NULL DEFAULT 0,
  gap_count        INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_convs_org_product
  ON ai_training_conversations(organization_id, product_id, call_flow_id);

CREATE TABLE IF NOT EXISTS ai_training_entries (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id           UUID NOT NULL REFERENCES ai_training_conversations(id) ON DELETE CASCADE,
  organization_id           UUID NOT NULL,
  product_id                UUID NOT NULL,
  call_flow_id              TEXT NOT NULL,
  utterance                 TEXT NOT NULL,
  utterance_context         TEXT,               -- preceding rep lines (display only)
  is_gap                    BOOLEAN NOT NULL DEFAULT false,
  suggested_node_id         TEXT,               -- null when is_gap = true
  suggested_confidence      TEXT
                            CHECK (suggested_confidence IN ('high', 'medium', 'low')),
  claude_reasoning          TEXT,
  review_status             TEXT NOT NULL DEFAULT 'pending'
                            CHECK (review_status IN ('pending', 'confirmed', 'corrected', 'rejected')),
  admin_node_id             TEXT,               -- set when corrected
  admin_notes               TEXT,
  -- Gap scaffold: Claude suggests a new node spec when is_gap = true
  gap_suggested_title       TEXT,
  gap_suggested_type        TEXT,
  gap_suggested_script      TEXT,
  gap_suggested_ai_condition TEXT,
  applied_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_entries_conv
  ON ai_training_entries(conversation_id, review_status);

-- ─── updated_at triggers ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_update_training_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sim_sessions_updated_at
  BEFORE UPDATE ON ai_simulation_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_update_training_updated_at();

CREATE TRIGGER set_training_convs_updated_at
  BEFORE UPDATE ON ai_training_conversations
  FOR EACH ROW EXECUTE FUNCTION trigger_update_training_updated_at();

CREATE TRIGGER set_training_entries_updated_at
  BEFORE UPDATE ON ai_training_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_update_training_updated_at();

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

ALTER TABLE ai_simulation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_simulation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_entries ENABLE ROW LEVEL SECURITY;

-- Sessions: visible to org members; write/delete via service_role (admin API routes)
CREATE POLICY "org members can view simulation sessions"
  ON ai_simulation_sessions FOR SELECT
  USING (organization_id IN (SELECT public.get_user_orgs()));

CREATE POLICY "service role manages simulation sessions"
  ON ai_simulation_sessions FOR ALL
  USING (true) WITH CHECK (true);

-- Steps: visible to org members; write/delete via service_role
CREATE POLICY "org members can view simulation steps"
  ON ai_simulation_steps FOR SELECT
  USING (organization_id IN (SELECT public.get_user_orgs()));

CREATE POLICY "service role manages simulation steps"
  ON ai_simulation_steps FOR ALL
  USING (true) WITH CHECK (true);

-- Conversations: visible to org members; write/delete via service_role
CREATE POLICY "org members can view training conversations"
  ON ai_training_conversations FOR SELECT
  USING (organization_id IN (SELECT public.get_user_orgs()));

CREATE POLICY "service role manages training conversations"
  ON ai_training_conversations FOR ALL
  USING (true) WITH CHECK (true);

-- Entries: visible to org members; write/delete via service_role
CREATE POLICY "org members can view training entries"
  ON ai_training_entries FOR SELECT
  USING (organization_id IN (SELECT public.get_user_orgs()));

CREATE POLICY "service role manages training entries"
  ON ai_training_entries FOR ALL
  USING (true) WITH CHECK (true);
