-- ============================================================
-- Fix: KB Issues - Notifications, Acknowledgments, Team Member Count
-- ============================================================

-- ============================================================
-- Issue 1 & 2: Fix notify_acknowledgment to handle errors gracefully
-- and add notification trigger for team update acknowledgments
-- ============================================================

-- Rewrite notify_acknowledgment to handle missing data gracefully
CREATE OR REPLACE FUNCTION notify_acknowledgment()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name TEXT;
  v_email TEXT;
  v_user_label TEXT;
  v_update_title TEXT;
BEGIN
  -- Get the update title first
  SELECT title INTO v_update_title FROM kb_updates WHERE id = NEW.update_id;

  -- Skip if update not found
  IF v_update_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user's name from profiles
  SELECT
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') INTO v_display_name
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- Fall back to email if no name found
  IF v_display_name IS NULL OR v_display_name = '' THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
    v_user_label := COALESCE(v_email, 'A user');
  ELSE
    v_user_label := v_display_name;
  END IF;

  -- Insert notifications for all admins (except the acknowledging user)
  BEGIN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT
      a.user_id,
      'acknowledgment',
      'Update Acknowledged',
      v_user_label || ' acknowledged "' || v_update_title || '"',
      'kb_update',
      NEW.update_id
    FROM admins a
    WHERE a.user_id != NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the acknowledgment
    RAISE WARNING 'Failed to create acknowledgment notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- New: Add notification trigger for team update acknowledgments
-- ============================================================

CREATE OR REPLACE FUNCTION notify_team_acknowledgment()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name TEXT;
  v_email TEXT;
  v_user_label TEXT;
  v_update_title TEXT;
  v_team_id UUID;
BEGIN
  -- Get the team update details
  SELECT title, team_id INTO v_update_title, v_team_id
  FROM team_updates
  WHERE id = NEW.team_update_id;

  -- Skip if update not found
  IF v_update_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user's name from profiles
  SELECT
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') INTO v_display_name
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- Fall back to email if no name found
  IF v_display_name IS NULL OR v_display_name = '' THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
    v_user_label := COALESCE(v_email, 'A user');
  ELSE
    v_user_label := v_display_name;
  END IF;

  -- Insert notifications for all admins (except the acknowledging user)
  BEGIN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT
      a.user_id,
      'acknowledgment',
      'Team Update Acknowledged',
      v_user_label || ' acknowledged "' || v_update_title || '"',
      'team_update',
      NEW.team_update_id
    FROM admins a
    WHERE a.user_id != NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the acknowledgment
    RAISE WARNING 'Failed to create team acknowledgment notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for team update acknowledgments
DROP TRIGGER IF EXISTS trg_notify_team_ack ON team_update_acknowledgments;
CREATE TRIGGER trg_notify_team_ack
  AFTER INSERT ON team_update_acknowledgments
  FOR EACH ROW EXECUTE FUNCTION notify_team_acknowledgment();

-- ============================================================
-- Grant necessary permissions for the triggers to work
-- ============================================================

-- Ensure the trigger functions can access required tables
GRANT SELECT ON admins TO postgres;
GRANT SELECT ON profiles TO postgres;
GRANT SELECT ON kb_updates TO postgres;
GRANT SELECT ON team_updates TO postgres;
GRANT INSERT ON notifications TO postgres;
