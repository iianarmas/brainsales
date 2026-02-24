-- ============================================================
-- Add is_special_instruction to call_node_responses
-- Allows responses that carry coaching/guidance text for the rep
-- but aren't connected to any specific next node.
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE call_node_responses
  ADD COLUMN IF NOT EXISTS is_special_instruction BOOLEAN DEFAULT false;

-- Also allow next_node_id to be NULL for special instructions
-- (it may already be nullable; this is a safety net)
ALTER TABLE call_node_responses
  ALTER COLUMN next_node_id DROP NOT NULL;
