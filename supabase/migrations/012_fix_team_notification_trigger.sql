-- ============================================================
-- Fix Team Update Notification Trigger
-- ============================================================

-- Update the trigger to handle broadcasts and product targeting
CREATE OR REPLACE FUNCTION notify_team_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    BEGIN
      -- 1. Broadcasts (is_broadcast = true)
      IF NEW.is_broadcast THEN
        INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
        SELECT
          u.id,
          'new_team_update',
          'Broadcast: ' || NEW.title,
          left(NEW.content, 200),
          'team_update',
          NEW.id
        FROM auth.users u
        WHERE u.id != NEW.created_by;

      -- 2. Product Targets (target_product_id IS NOT NULL)
      ELSIF NEW.target_product_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
        SELECT
          pu.user_id,
          'new_team_update',
          'Product Update: ' || NEW.title,
          left(NEW.content, 200),
          'team_update',
          NEW.id
        FROM product_users pu
        WHERE pu.product_id = NEW.target_product_id
          AND pu.user_id != NEW.created_by;

      -- 3. Standard Team Update (team_id IS NOT NULL)
      ELSIF NEW.team_id IS NOT NULL THEN
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

    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the update
      RAISE WARNING 'Failed to create team update notification: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
