-- ============================================================
-- Migration 029: Fix Notification Scoping and Include Publishers
-- ============================================================
-- Specifically addresses:
-- 1. Publishers not receiving notifications for their own updates.
-- 2. Broadcasts and Global KB Updates leaking across organizations.
-- 3. Acknowledgment notifications leaking across organizations.
-- 4. Acknowledgment notifications being sent to all admins globally.
-- ============================================================

-- 1. Fix KB Update Notification Trigger
CREATE OR REPLACE FUNCTION notify_kb_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    BEGIN
      IF NEW.target_product_id IS NOT NULL THEN
        -- Product-specific KB update - notify product users
        INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
        SELECT
          pu.user_id,
          'new_update',
          'Product Update: ' || NEW.title,
          coalesce(NEW.summary, left(NEW.content, 200)),
          'kb_update',
          NEW.id
        FROM product_users pu
        WHERE pu.product_id = NEW.target_product_id;
      ELSE
        -- Global KB update - notify all users in the SAME organization
        INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
        SELECT
          om.user_id,
          'new_update',
          'New Update: ' || NEW.title,
          coalesce(NEW.summary, left(NEW.content, 200)),
          'kb_update',
          NEW.id
        FROM organization_members om
        WHERE om.organization_id = NEW.organization_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the update
      RAISE WARNING 'Failed to create kb update notification: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix Team Update Notification Trigger
CREATE OR REPLACE FUNCTION notify_team_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    BEGIN
      -- 1. Broadcasts (is_broadcast = true) - Scoped to organization
      IF NEW.is_broadcast THEN
        INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
        SELECT
          om.user_id,
          'new_team_update',
          'Broadcast: ' || NEW.title,
          left(NEW.content, 200),
          'team_update',
          NEW.id
        FROM organization_members om
        WHERE om.organization_id = NEW.organization_id;

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
        WHERE pu.product_id = NEW.target_product_id;

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
        WHERE tm.team_id = NEW.team_id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the update
      RAISE WARNING 'Failed to create team update notification: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix KB Acknowledgment Notification Trigger
CREATE OR REPLACE FUNCTION notify_acknowledgment()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name TEXT;
  v_email TEXT;
  v_user_label TEXT;
  v_update_title TEXT;
  v_org_id UUID;
BEGIN
  -- Get the update title and organization_id
  SELECT title, organization_id INTO v_update_title, v_org_id 
  FROM kb_updates 
  WHERE id = NEW.update_id;

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

  -- Insert notifications for organization admins (except the acknowledging user)
  BEGIN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT
      om.user_id,
      'acknowledgment',
      'Update Acknowledged',
      v_user_label || ' acknowledged "' || v_update_title || '"',
      'kb_update',
      NEW.update_id
    FROM organization_members om
    WHERE om.organization_id = v_org_id
      AND om.role IN ('admin', 'owner')
      AND om.user_id != NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create acknowledgment notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix Team Acknowledgment Notification Trigger
CREATE OR REPLACE FUNCTION notify_team_acknowledgment()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name TEXT;
  v_email TEXT;
  v_user_label TEXT;
  v_update_title TEXT;
  v_org_id UUID;
BEGIN
  -- Get the team update details and organization_id
  SELECT title, organization_id INTO v_update_title, v_org_id
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

  -- Insert notifications for organization admins (except the acknowledging user)
  BEGIN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT
      om.user_id,
      'acknowledgment',
      'Team Update Acknowledged',
      v_user_label || ' acknowledged "' || v_update_title || '"',
      'team_update',
      NEW.team_update_id
    FROM organization_members om
    WHERE om.organization_id = v_org_id
      AND om.role IN ('admin', 'owner')
      AND om.user_id != NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create team acknowledgment notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
