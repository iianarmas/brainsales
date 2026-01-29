-- ============================================================
-- Fix: Show user name instead of email in acknowledgment notifications
-- ============================================================

-- Update the notify_acknowledgment function to use user's name from profiles
CREATE OR REPLACE FUNCTION notify_acknowledgment()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name TEXT;
  v_email TEXT;
  v_user_label TEXT;
BEGIN
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

  INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
  SELECT
    a.user_id,
    'acknowledgment',
    'Update Acknowledged',
    v_user_label || ' acknowledged "' ||
    (SELECT title FROM kb_updates WHERE id = NEW.update_id) || '"',
    'kb_update',
    NEW.update_id
  FROM admins a
  WHERE a.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger already exists, no need to recreate it
-- The function update will apply to all future acknowledgments
