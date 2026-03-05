-- Migration 036: Organization Feature Flags
-- Enables per-org feature toggling. Features are built once and deployed for all,
-- but only orgs with a matching row here can access them.

CREATE TABLE IF NOT EXISTS organization_features (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key     TEXT        NOT NULL,
  config          JSONB       NOT NULL DEFAULT '{}',
  enabled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  enabled_by      UUID        REFERENCES auth.users(id),
  UNIQUE (organization_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_org_features_org ON organization_features(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_features_key ON organization_features(feature_key);

ALTER TABLE organization_features ENABLE ROW LEVEL SECURITY;

-- Org members can read their own flags. All writes go through service role (super-admin API only).
CREATE POLICY "Org members can view their org features"
  ON organization_features FOR SELECT
  USING (organization_id IN (SELECT public.get_user_orgs()));
