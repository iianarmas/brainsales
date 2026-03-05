-- User-configurable script shortcuts
-- Allows users to assign keyboard keys to any official-scope script node

CREATE TABLE user_script_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Opening node ID that scopes this shortcut to a specific flow; NULL = applies across all flows
  call_flow_id TEXT,
  node_id TEXT NOT NULL,
  -- Key string: single letter (a-z), function key (f1-f12), or combo (ctrl+a, alt+s)
  shortcut_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each key can only be assigned once per user+product (regardless of flow)
  UNIQUE(user_id, product_id, shortcut_key),
  -- Each node can only have one shortcut per user+product
  UNIQUE(user_id, product_id, node_id)
);

-- RLS: users can only read/write their own shortcut rows
ALTER TABLE user_script_shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_script_shortcuts" ON user_script_shortcuts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
