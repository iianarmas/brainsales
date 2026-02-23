-- ============================================================
-- Migration 022: Add Conversation Path & Adherence to Sessions
-- ============================================================
-- Adds conversation_path, call_flow_id, and adherence_score to
-- call_sessions so reps' actual navigation can be compared
-- against the intended call flow for script adherence tracking.
-- ============================================================

-- 1. Add conversation_path: ordered list of node IDs the rep visited
ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS conversation_path TEXT[] DEFAULT NULL;

-- 2. Add call_flow_id: the opening node ID that defined the intended call flow
ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS call_flow_id TEXT DEFAULT NULL;

-- 3. Add adherence_score: pre-computed on session persist
--    = (on-script nodes / total nodes visited) * 100
--    A node is "on-script" if its call_flow_ids includes this call_flow_id
--    OR if it is a universal node (call_flow_ids IS NULL or empty).
ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS adherence_score NUMERIC(5,2) DEFAULT NULL;

-- 4. Index for efficient per-rep adherence queries
CREATE INDEX IF NOT EXISTS idx_call_sessions_call_flow ON call_sessions(call_flow_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_adherence ON call_sessions(adherence_score);
