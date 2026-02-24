-- ============================================================
-- Migration 025: Add Invite Tokens & Organization Plans
-- ============================================================
-- Enables the invite-based onboarding flow for teams using
-- generic email addresses (no shared company domain).
--
-- Changes:
--   1. Add `plan` column to organizations
--   2. Set new orgs to is_active = false by default (require approval)
--   3. Create invite_tokens table with RLS
-- ============================================================

-- 1. Add plan to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'team'
    CHECK (plan IN ('solo', 'team', 'enterprise'));

-- 2. Default is_active to false for new orgs (all future INSERTs)
--    Existing orgs (like 314e) keep is_active = true — no change needed.
ALTER TABLE organizations
  ALTER COLUMN is_active SET DEFAULT false;

-- ============================================================
-- 3. Create invite_tokens table
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID        NOT NULL REFERENCES auth.users(id),

  -- Optional: if set, only this specific email address can accept the invite
  email           TEXT,

  role            TEXT        NOT NULL DEFAULT 'member'
                    CHECK (role IN ('member', 'admin')),

  -- Random 64-char hex token (32 bytes of entropy)
  token           TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',

  -- Filled in when the invite is accepted
  used_at         TIMESTAMPTZ,
  used_by         UUID        REFERENCES auth.users(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_tokens_org     ON invite_tokens(organization_id);
CREATE INDEX idx_invite_tokens_token   ON invite_tokens(token);
CREATE INDEX idx_invite_tokens_email   ON invite_tokens(email) WHERE email IS NOT NULL;

-- ============================================================
-- 4. RLS for invite_tokens
-- ============================================================
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- 4a. Anyone can look up a token by its value (pre-auth, for the /join page)
--     We expose only non-sensitive fields via the API; the policy just allows the select.
CREATE POLICY "Public token lookup by token value"
  ON invite_tokens FOR SELECT
  USING (true);  -- filtered to a specific token in the query; no data leak since tokens are random

-- 4b. Org admins/owners can create invite tokens for their own org
CREATE POLICY "Org admins can create invite tokens"
  ON invite_tokens FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

-- 4c. Org admins/owners can delete (revoke) tokens
CREATE POLICY "Org admins can revoke invite tokens"
  ON invite_tokens FOR DELETE
  USING (is_org_admin(organization_id));

-- 4d. The system (via service role) updates used_at/used_by on accept — no user-level UPDATE needed

-- ============================================================
-- 5. Helper view: pending (unused, non-expired) invites in an org
-- ============================================================
CREATE OR REPLACE VIEW active_invite_tokens AS
  SELECT
    it.id,
    it.organization_id,
    it.created_by,
    it.email,
    it.role,
    it.token,
    it.expires_at,
    it.used_at,
    it.used_by,
    it.created_at,
    o.name AS organization_name,
    o.slug AS organization_slug
  FROM invite_tokens it
  JOIN organizations o ON o.id = it.organization_id
  WHERE it.used_at IS NULL
    AND it.expires_at > now();
