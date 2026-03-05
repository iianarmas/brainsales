-- Migration 035: Add sequence column to ai_training_entries
-- Ensures entries are displayed in the original transcript order.
-- Without this, bulk-inserted entries share the same created_at timestamp
-- and PostgreSQL does not guarantee their storage/retrieval order.

ALTER TABLE ai_training_entries
    ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0;

-- Index to make ORDER BY sequence efficient
CREATE INDEX IF NOT EXISTS idx_training_entries_conv_seq
    ON ai_training_entries(conversation_id, sequence);
