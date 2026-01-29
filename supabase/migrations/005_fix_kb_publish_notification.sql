-- ============================================================
-- Fix: KB Publish Notification Trigger - Add Error Handling
-- ============================================================

-- The notify_kb_update_published trigger can fail when accessing auth.users
-- which causes the entire UPDATE to fail. This fix adds error handling
-- similar to the acknowledgment notification triggers.

CREATE OR REPLACE FUNCTION notify_kb_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the update
      RAISE WARNING 'Failed to create kb update notification: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the team update notification trigger with the same error handling
CREATE OR REPLACE FUNCTION notify_team_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the update
      RAISE WARNING 'Failed to create team update notification: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
