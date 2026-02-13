-- ============================================================
-- Migration 020: Call Sessions & Outcome Tracking
-- ============================================================
-- Adds a call_sessions table to persist session data that was
-- previously ephemeral (only in client-side Zustand state).
-- This enables outcome tracking, conversion funnel analysis,
-- drop-off detection, and per-rep performance metrics.
-- ============================================================

-- 1. Create call_sessions table
CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,                    -- client-generated session UUID
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  outcome TEXT CHECK (outcome IN ('meeting_set', 'follow_up', 'send_info', 'not_interested', 'no_answer', 'wrong_person')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,                           -- computed on session end
  notes TEXT,
  metadata JSONB DEFAULT '{}',                        -- prospect name, org, ehr, dms, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_call_sessions_user ON call_sessions(user_id);
CREATE INDEX idx_call_sessions_org ON call_sessions(organization_id);
CREATE INDEX idx_call_sessions_product ON call_sessions(product_id);
CREATE INDEX idx_call_sessions_outcome ON call_sessions(outcome);
CREATE INDEX idx_call_sessions_started ON call_sessions(started_at DESC);

-- 2. Add organization_id and product_id to call_analytics for efficient org-scoped queries
ALTER TABLE call_analytics ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE call_analytics ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_call_analytics_org ON call_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_product ON call_analytics(product_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_session ON call_analytics(session_id);

-- 3. RLS for call_sessions
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON call_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Org members can view sessions in their org"
  ON call_sessions FOR SELECT
  USING (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Users can insert their own sessions"
  ON call_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
  ON call_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- 4. Create a view for drop-off analysis (last node per session)
CREATE OR REPLACE VIEW session_last_nodes AS
SELECT DISTINCT ON (ca.session_id)
  ca.session_id,
  ca.node_id AS last_node_id,
  ca.user_id,
  ca.navigated_at,
  ca.organization_id,
  ca.product_id
FROM call_analytics ca
ORDER BY ca.session_id, ca.navigated_at DESC;
