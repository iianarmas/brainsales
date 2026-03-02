-- ============================================================
-- Add AI condition fields and coaching scope to call_node_responses
-- Consolidates the separate aiTransitionTriggers metadata array
-- into per-response fields so users only define node connections once.
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE call_node_responses
  ADD COLUMN IF NOT EXISTS ai_condition TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence TEXT CHECK (ai_confidence IN ('high', 'medium')),
  ADD COLUMN IF NOT EXISTS coaching_scope TEXT CHECK (coaching_scope IN ('rep', 'ai', 'both'));

-- Data migration: for each node with aiTransitionTriggers in metadata,
-- attempt to match triggers to existing responses by targetNodeId = next_node_id.
-- Matched triggers have their condition/confidence merged in-place (label/note preserved).
-- Unmatched triggers become new AI-only response rows (label prefixed [AI] for review).
DO $$
DECLARE
  node_rec RECORD;
  trigger_rec RECORD;
BEGIN
  FOR node_rec IN
    SELECT id, metadata, product_id, organization_id
    FROM call_nodes
    WHERE metadata ? 'aiTransitionTriggers'
      AND jsonb_array_length(metadata->'aiTransitionTriggers') > 0
  LOOP
    FOR trigger_rec IN
      SELECT
        value->>'condition'    AS condition,
        value->>'targetNodeId' AS target_node_id,
        value->>'confidence'   AS confidence
      FROM jsonb_array_elements(node_rec.metadata->'aiTransitionTriggers') AS t(value)
      WHERE value->>'condition' IS NOT NULL
        AND value->>'targetNodeId' IS NOT NULL
    LOOP
      -- Try to match to an existing non-coaching response by next_node_id
      UPDATE call_node_responses
      SET
        ai_condition  = trigger_rec.condition,
        ai_confidence = COALESCE(trigger_rec.confidence, 'medium')
      WHERE node_id         = node_rec.id
        AND next_node_id    = trigger_rec.target_node_id
        AND ai_condition    IS NULL
        AND (is_special_instruction IS NULL OR is_special_instruction = false)
        -- Only update the first matching row
        AND id = (
          SELECT id FROM call_node_responses
          WHERE node_id      = node_rec.id
            AND next_node_id = trigger_rec.target_node_id
            AND ai_condition IS NULL
            AND (is_special_instruction IS NULL OR is_special_instruction = false)
          ORDER BY sort_order
          LIMIT 1
        );

      -- If no existing response matched, insert an AI-only placeholder for review
      IF NOT FOUND THEN
        INSERT INTO call_node_responses (
          node_id,
          label,
          next_node_id,
          note,
          ai_condition,
          ai_confidence,
          is_special_instruction,
          sort_order,
          product_id,
          organization_id
        )
        SELECT
          node_rec.id,
          '[AI] ' || LEFT(trigger_rec.condition, 60),
          trigger_rec.target_node_id,
          'Migrated from AI trigger — verify this response label is correct.',
          trigger_rec.condition,
          COALESCE(trigger_rec.confidence, 'medium'),
          false,
          COALESCE((SELECT MAX(sort_order) FROM call_node_responses WHERE node_id = node_rec.id), -1) + 1,
          node_rec.product_id,
          node_rec.organization_id;
      END IF;
    END LOOP;
  END LOOP;
END $$;
