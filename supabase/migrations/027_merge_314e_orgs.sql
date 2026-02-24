-- ============================================================
-- Migration 027: Merge 314e Organizations
-- ============================================================
-- This migration addresses the split between '314e-corp' (seeded)
-- and '314e' (likely created by user).
-- We consolidate everything into '314e-corp' as it's the 
-- one with the most initial config, and then we ensure the
-- slug is what the user expects ('314e').
-- ============================================================

DO $$
DECLARE
  old_org_id UUID;
  new_org_id UUID;
  target_org_id UUID;
BEGIN
  -- 1. Identify the organizations
  SELECT id INTO old_org_id FROM organizations WHERE slug = '314e-corp' LIMIT 1;
  SELECT id INTO new_org_id FROM organizations WHERE slug = '314e' LIMIT 1;

  -- 2. Scenarios
  IF old_org_id IS NOT NULL AND new_org_id IS NOT NULL THEN
    -- Both exist - Merge '314e' into '314e-corp' then rename '314e-corp' to '314e'
    RAISE NOTICE 'Merging org % (314e) into % (314e-corp)', new_org_id, old_org_id;
    
    -- Move members
    INSERT INTO organization_members (organization_id, user_id, role)
    SELECT old_org_id, user_id, role 
    FROM organization_members 
    WHERE organization_id = new_org_id
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- Update all tables that might have the new organization_id
    UPDATE products SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE teams SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE team_updates SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE kb_updates SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE competitors SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE kb_categories SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE call_nodes SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE user_presence SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE call_node_keypoints SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE call_node_warnings SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE call_node_listen_for SET organization_id = old_org_id WHERE organization_id = new_org_id;
    UPDATE call_node_responses SET organization_id = old_org_id WHERE organization_id = new_org_id;

    -- Merge whitelists
    UPDATE organizations
    SET 
      allowed_domains = ARRAY(SELECT DISTINCT unnest(allowed_domains || (SELECT allowed_domains FROM organizations WHERE id = new_org_id))),
      allowed_emails = ARRAY(SELECT DISTINCT unnest(allowed_emails || (SELECT allowed_emails FROM organizations WHERE id = new_org_id)))
    WHERE id = old_org_id;

    -- Delete the redundant org
    DELETE FROM organizations WHERE id = new_org_id;
    
    -- Update the old org slug to the user-preferred one
    UPDATE organizations SET slug = '314e' WHERE id = old_org_id;
    target_org_id := old_org_id;

  ELSIF old_org_id IS NOT NULL AND new_org_id IS NULL THEN
    -- Only old exists - just rename slug
    RAISE NOTICE 'Renaming org % (314e-corp) to 314e', old_org_id;
    UPDATE organizations SET slug = '314e' WHERE id = old_org_id;
    target_org_id := old_org_id;

  ELSIF old_org_id IS NULL AND new_org_id IS NOT NULL THEN
    -- Only new exists - we need to make sure the data is mapped to it
    -- This shouldn't happen if data was seeded to 314e-corp, but just in case
    RAISE NOTICE 'Consolidating data into existing org % (314e)', new_org_id;
    target_org_id := new_org_id;
  END IF;

  -- 3. Final polish if we have a target org
  IF target_org_id IS NOT NULL THEN
    -- Ensure common domains are whitelisted to prevent future registration splits
    UPDATE organizations
    SET 
      allowed_domains = ARRAY(SELECT DISTINCT unnest(allowed_domains || ARRAY['314e.com', '314ecorp.com', '314ecorp.us', '314e.in'])),
      is_active = true
    WHERE id = target_org_id;
  END IF;

END $$;
