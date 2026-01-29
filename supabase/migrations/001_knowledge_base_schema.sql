-- ============================================================
-- Dexit Knowledge Base System - Complete Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. CATEGORIES
-- ============================================================
CREATE TABLE kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Lucide icon name
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default categories
INSERT INTO kb_categories (name, slug, description, icon, sort_order) VALUES
  ('Release', 'release', 'Product version releases', 'rocket', 1),
  ('Feature', 'feature', 'Feature announcements and updates', 'sparkles', 2),
  ('News', 'news', 'Company news and announcements', 'newspaper', 3),
  ('Blog', 'blog', 'Blog posts and insights', 'book-open', 4),
  ('Metrics', 'metrics', 'Performance and accuracy metrics', 'bar-chart-3', 5),
  ('Bug Fix', 'bug-fix', 'Bug fixes and patches', 'bug', 6),
  ('Use Case', 'use-case', 'Use cases and workflows', 'workflow', 7),
  ('Compliance', 'compliance', 'Security and compliance updates', 'shield-check', 8),
  ('Technical', 'technical', 'Technical specifications', 'cpu', 9),
  ('Product Info', 'product-info', 'General product information', 'info', 10),
  ('Competitive', 'competitive', 'Competitive advantages', 'trophy', 11);

-- ============================================================
-- 2. KB UPDATES (central content table)
-- ============================================================
CREATE TABLE kb_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES kb_categories(id),
  title TEXT NOT NULL,
  slug TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  version TEXT, -- e.g. "10.3" for releases
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  publish_at TIMESTAMPTZ, -- scheduled publishing
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Full-text search vector
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) STORED
);

CREATE INDEX idx_kb_updates_category ON kb_updates(category_id);
CREATE INDEX idx_kb_updates_status ON kb_updates(status);
CREATE INDEX idx_kb_updates_published_at ON kb_updates(published_at DESC);
CREATE INDEX idx_kb_updates_search ON kb_updates USING GIN(search_vector);
CREATE INDEX idx_kb_updates_tags ON kb_updates USING GIN(tags);

-- ============================================================
-- 3. UPDATE FEATURES (linked to release updates)
-- ============================================================
CREATE TABLE kb_update_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES kb_updates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kb_update_features_update ON kb_update_features(update_id);

-- ============================================================
-- 4. UPDATE METRICS
-- ============================================================
CREATE TABLE kb_update_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES kb_updates(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kb_update_metrics_update ON kb_update_metrics(update_id);

-- ============================================================
-- 5. VERSION HISTORY (audit trail for edits)
-- ============================================================
CREATE TABLE kb_update_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES kb_updates(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kb_update_versions_update ON kb_update_versions(update_id);

-- ============================================================
-- 6. ATTACHMENTS (Supabase Storage references)
-- ============================================================
CREATE TABLE kb_update_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES kb_updates(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kb_update_attachments_update ON kb_update_attachments(update_id);

-- ============================================================
-- 7. USER ACKNOWLEDGMENTS
-- ============================================================
CREATE TABLE update_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES kb_updates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(update_id, user_id)
);

CREATE INDEX idx_ack_update ON update_acknowledgments(update_id);
CREATE INDEX idx_ack_user ON update_acknowledgments(user_id);

-- ============================================================
-- 8. TEAMS
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. TEAM MEMBERS
-- ============================================================
CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_user ON team_members(user_id);

-- ============================================================
-- 10. TEAM UPDATES
-- ============================================================
CREATE TABLE team_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  requires_acknowledgment BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  publish_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED
);

CREATE INDEX idx_team_updates_team ON team_updates(team_id);
CREATE INDEX idx_team_updates_status ON team_updates(status);
CREATE INDEX idx_team_updates_search ON team_updates USING GIN(search_vector);

-- ============================================================
-- 11. TEAM UPDATE ACKNOWLEDGMENTS
-- ============================================================
CREATE TABLE team_update_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_update_id UUID NOT NULL REFERENCES team_updates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_update_id, user_id)
);

CREATE INDEX idx_team_ack_update ON team_update_acknowledgments(team_update_id);
CREATE INDEX idx_team_ack_user ON team_update_acknowledgments(user_id);

-- ============================================================
-- 12. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_update', 'new_team_update', 'acknowledgment', 'reminder'
  title TEXT NOT NULL,
  message TEXT,
  reference_type TEXT, -- 'kb_update' or 'team_update'
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ============================================================
-- 13. NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app BOOLEAN DEFAULT true,
  email BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  digest_frequency TEXT DEFAULT 'realtime' CHECK (digest_frequency IN ('realtime', 'hourly', 'daily')),
  quiet_start TIME,
  quiet_end TIME,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 14. AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'publish', 'acknowledge'
  entity_type TEXT NOT NULL, -- 'kb_update', 'team_update', 'team', etc.
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kb_updates_updated_at
  BEFORE UPDATE ON kb_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_team_updates_updated_at
  BEFORE UPDATE ON team_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-set published_at when status changes to 'published'
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kb_updates_published_at
  BEFORE INSERT OR UPDATE ON kb_updates
  FOR EACH ROW EXECUTE FUNCTION set_published_at();

CREATE TRIGGER trg_team_updates_published_at
  BEFORE INSERT OR UPDATE ON team_updates
  FOR EACH ROW EXECUTE FUNCTION set_published_at();

-- Create notifications when kb_update is published
CREATE OR REPLACE FUNCTION notify_kb_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT
      u.id,
      'new_update',
      'New Update: ' || NEW.title,
      coalesce(NEW.summary, left(NEW.content, 200)),
      'kb_update',
      NEW.id
    FROM auth.users u
    WHERE u.id != coalesce(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_kb_update
  AFTER INSERT OR UPDATE ON kb_updates
  FOR EACH ROW EXECUTE FUNCTION notify_kb_update_published();

-- Create notifications when team_update is published
CREATE OR REPLACE FUNCTION notify_team_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT
      tm.user_id,
      'new_team_update',
      'Team Update: ' || NEW.title,
      left(NEW.content, 200),
      'team_update',
      NEW.id
    FROM team_members tm
    WHERE tm.team_id = NEW.team_id
      AND tm.user_id != NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_team_update
  AFTER INSERT OR UPDATE ON team_updates
  FOR EACH ROW EXECUTE FUNCTION notify_team_update_published();

-- Notify admins when user acknowledges an update
CREATE OR REPLACE FUNCTION notify_acknowledgment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
  SELECT
    a.user_id,
    'acknowledgment',
    'Update Acknowledged',
    (SELECT email FROM auth.users WHERE id = NEW.user_id) || ' acknowledged "' ||
    (SELECT title FROM kb_updates WHERE id = NEW.update_id) || '"',
    'kb_update',
    NEW.update_id
  FROM admins a
  WHERE a.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_ack
  AFTER INSERT ON update_acknowledgments
  FOR EACH ROW EXECUTE FUNCTION notify_acknowledgment();

-- Version history on kb_updates edits
CREATE OR REPLACE FUNCTION track_kb_update_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO kb_update_versions (update_id, version_number, title, content, changed_by, change_description)
    VALUES (
      OLD.id,
      coalesce((SELECT max(version_number) FROM kb_update_versions WHERE update_id = OLD.id), 0) + 1,
      OLD.title,
      OLD.content,
      NEW.updated_by,
      'Auto-versioned on edit'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kb_update_version
  BEFORE UPDATE ON kb_updates
  FOR EACH ROW EXECUTE FUNCTION track_kb_update_version();

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Get unread count for a user (KB updates they haven't acknowledged)
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id UUID)
RETURNS INT AS $$
  SELECT count(*)::int
  FROM kb_updates ku
  WHERE ku.status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM update_acknowledgments ua
      WHERE ua.update_id = ku.id AND ua.user_id = p_user_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get unread team update count
CREATE OR REPLACE FUNCTION get_team_unread_count(p_user_id UUID)
RETURNS INT AS $$
  SELECT count(*)::int
  FROM team_updates tu
  JOIN team_members tm ON tm.team_id = tu.team_id AND tm.user_id = p_user_id
  WHERE tu.status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM team_update_acknowledgments tua
      WHERE tua.team_update_id = tu.id AND tua.user_id = p_user_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Full-text search across kb_updates
CREATE OR REPLACE FUNCTION search_kb_updates(query TEXT)
RETURNS SETOF kb_updates AS $$
  SELECT *
  FROM kb_updates
  WHERE status = 'published'
    AND search_vector @@ plainto_tsquery('english', query)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', query)) DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Acknowledgment stats for an update
CREATE OR REPLACE FUNCTION get_acknowledgment_stats(p_update_id UUID)
RETURNS TABLE(total_users BIGINT, acknowledged_count BIGINT, pending_count BIGINT) AS $$
  SELECT
    (SELECT count(*) FROM auth.users) AS total_users,
    (SELECT count(*) FROM update_acknowledgments WHERE update_id = p_update_id) AS acknowledged_count,
    (SELECT count(*) FROM auth.users) -
    (SELECT count(*) FROM update_acknowledgments WHERE update_id = p_update_id) AS pending_count;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Use existing is_admin() function from database-setup.sql

ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON kb_categories FOR SELECT USING (true);
CREATE POLICY "Admin manage categories" ON kb_categories FOR ALL USING (is_admin());

ALTER TABLE kb_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published updates" ON kb_updates FOR SELECT USING (status = 'published' OR is_admin());
CREATE POLICY "Admin manage updates" ON kb_updates FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin update updates" ON kb_updates FOR UPDATE USING (is_admin());
CREATE POLICY "Admin delete updates" ON kb_updates FOR DELETE USING (is_admin());

ALTER TABLE kb_update_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read features" ON kb_update_features FOR SELECT USING (true);
CREATE POLICY "Admin manage features" ON kb_update_features FOR ALL USING (is_admin());

ALTER TABLE kb_update_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read metrics" ON kb_update_metrics FOR SELECT USING (true);
CREATE POLICY "Admin manage metrics" ON kb_update_metrics FOR ALL USING (is_admin());

ALTER TABLE kb_update_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read versions" ON kb_update_versions FOR SELECT USING (true);
CREATE POLICY "Admin manage versions" ON kb_update_versions FOR ALL USING (is_admin());

ALTER TABLE kb_update_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read attachments" ON kb_update_attachments FOR SELECT USING (true);
CREATE POLICY "Admin manage attachments" ON kb_update_attachments FOR ALL USING (is_admin());

ALTER TABLE update_acknowledgments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own acks" ON update_acknowledgments FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users insert own acks" ON update_acknowledgments FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own teams" ON teams FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id = auth.uid())
  OR is_admin()
);
CREATE POLICY "Admin manage teams" ON teams FOR ALL USING (is_admin());

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own memberships" ON team_members FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Admin manage members" ON team_members FOR ALL USING (is_admin());

ALTER TABLE team_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own team updates" ON team_updates FOR SELECT USING (
  (status = 'published' AND EXISTS (
    SELECT 1 FROM team_members WHERE team_id = team_updates.team_id AND user_id = auth.uid()
  )) OR is_admin()
);
CREATE POLICY "Admin manage team updates" ON team_updates FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin update team updates" ON team_updates FOR UPDATE USING (is_admin());
CREATE POLICY "Admin delete team updates" ON team_updates FOR DELETE USING (is_admin());

ALTER TABLE team_update_acknowledgments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own team acks" ON team_update_acknowledgments FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Users insert own team acks" ON team_update_acknowledgments FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON notification_preferences FOR ALL USING (user_id = auth.uid());

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read audit log" ON audit_log FOR SELECT USING (is_admin());

-- ============================================================
-- REALTIME (enable for live notifications)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE update_acknowledgments;
ALTER PUBLICATION supabase_realtime ADD TABLE team_update_acknowledgments;

-- ============================================================
-- STORAGE BUCKET (for attachments)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('kb-attachments', 'kb-attachments', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Authenticated read attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'kb-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Admin upload attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'kb-attachments' AND is_admin());
