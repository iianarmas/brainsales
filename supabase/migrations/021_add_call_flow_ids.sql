-- Add call_flow_ids column to call_nodes table
-- NULL or empty array means "universal" (visible in all call flows)
-- When populated, contains opening node IDs this node belongs to
ALTER TABLE call_nodes ADD COLUMN IF NOT EXISTS call_flow_ids TEXT[] DEFAULT NULL;

-- GIN index for efficient array containment queries
CREATE INDEX IF NOT EXISTS call_nodes_call_flow_ids_idx ON call_nodes USING GIN (call_flow_ids);
