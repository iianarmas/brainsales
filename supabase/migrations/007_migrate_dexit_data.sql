-- ============================================================
-- Multi-Product Support - Phase 2: Dexit Data Migration
-- Run this AFTER 006_add_products_schema.sql
-- ============================================================

-- ============================================================
-- 1. CREATE DEXIT AS THE INITIAL PRODUCT
-- ============================================================
INSERT INTO products (name, slug, description)
VALUES (
  'Dexit',
  'dexit',
  '314e Document Intelligence Platform - AI-powered document processing for healthcare'
)
ON CONFLICT (slug) DO NOTHING;

-- Store Dexit product ID for use in subsequent operations
DO $$
DECLARE
  dexit_id UUID;
BEGIN
  SELECT id INTO dexit_id FROM products WHERE slug = 'dexit';

  -- ==========a==================================================
  -- 2. ASSIGN ALL EXISTING USERS TO DEXIT
  -- ============================================================
  INSERT INTO product_users (product_id, user_id, role, is_default)
  SELECT
    dexit_id,
    p.user_id,
    CASE WHEN EXISTS (SELECT 1 FROM admins WHERE user_id = p.user_id) THEN 'admin' ELSE 'user' END,
    true
  FROM profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM product_users pu
    WHERE pu.product_id = dexit_id AND pu.user_id = p.user_id
  );

  -- ============================================================
  -- 3. UPDATE EXISTING CONTENT WITH DEXIT PRODUCT_ID
  -- ============================================================

  -- Call Nodes
  UPDATE call_nodes SET product_id = dexit_id WHERE product_id IS NULL;

  -- Call Node related tables
  UPDATE call_node_keypoints SET product_id = dexit_id WHERE product_id IS NULL;
  UPDATE call_node_warnings SET product_id = dexit_id WHERE product_id IS NULL;
  UPDATE call_node_listen_for SET product_id = dexit_id WHERE product_id IS NULL;
  UPDATE call_node_responses SET product_id = dexit_id WHERE product_id IS NULL;

  -- Topic Groups
  UPDATE topic_groups SET product_id = dexit_id WHERE product_id IS NULL;

  -- KB Updates
  UPDATE kb_updates SET product_id = dexit_id WHERE product_id IS NULL;

  -- KB Categories
  UPDATE kb_categories SET product_id = dexit_id WHERE product_id IS NULL;

  -- ============================================================
  -- 4. MIGRATE QUICK REFERENCE DATA
  -- ============================================================

  -- Differentiators
  INSERT INTO product_quick_reference (product_id, section, data, sort_order)
  VALUES (
    dexit_id,
    'differentiators',
    '[
      "DextractLM™ - Purpose-built healthcare LLM (not adapted from other industries)",
      "Continuous Learning - AI improves automatically from corrections",
      "70-80% Time Savings - Only 10-20% of documents need human review",
      "Virtual Fax Server - Built-in, AI-powered fax routing (inbound/outbound)",
      "EHR Agnostic - Works with Epic, Cerner, Meditech, any EHR",
      "Complements Existing Systems - Works WITH OnBase/Gallery, not replacing",
      "Subscription Pricing - Not massive capital investment",
      "20+ Years - 314e healthcare IT experience"
    ]'::jsonb,
    1
  )
  ON CONFLICT DO NOTHING;

  -- Competitors
  INSERT INTO product_quick_reference (product_id, section, data, sort_order)
  VALUES (
    dexit_id,
    'competitors',
    '{
      "onbase": {
        "name": "OnBase",
        "strengths": ["Storage", "Workflow", "Enterprise-proven"],
        "limitations": ["No AI", "Manual indexing required", "Keyword rules brittle"],
        "advantage": "AI intelligence for front-end processing, works WITH OnBase"
      },
      "brainware": {
        "name": "Brainware",
        "strengths": ["Better than basic OCR"],
        "limitations": ["Expensive add-on ($50K-$200K+)", "Built before modern AI", "Requires training and retraining"],
        "advantage": "Modern LLM, pre-trained, continuous learning, more cost-effective"
      },
      "gallery": {
        "name": "Epic Gallery",
        "strengths": ["Epic integration", "Good for Epic clinical docs"],
        "limitations": ["No AI", "Not for external/non-clinical docs", "Still maturing"],
        "advantage": "AI processing + handles non-clinical + migration help"
      },
      "vyne": {
        "name": "Vyne",
        "strengths": ["Strong for referrals", "Established presence"],
        "limitations": ["Referral-focused", "AI bolted on", "Enterprise pricing"],
        "advantage": "All document types, modern AI, flexible pricing"
      },
      "solarity": {
        "name": "Solarity",
        "strengths": ["Healthcare-focused", "Has AI/ML"],
        "limitations": ["Smaller company", "AI sophistication unclear"],
        "advantage": "DextractLM proven, 314e backing, continuous learning"
      }
    }'::jsonb,
    2
  )
  ON CONFLICT DO NOTHING;

  -- Metrics
  INSERT INTO product_quick_reference (product_id, section, data, sort_order)
  VALUES (
    dexit_id,
    'metrics',
    '[
      {"value": "70-80%", "label": "Time Savings"},
      {"value": "95%+", "label": "Accuracy Rate"},
      {"value": "10-20%", "label": "Human Review"},
      {"value": "20+", "label": "Years Experience"}
    ]'::jsonb,
    3
  )
  ON CONFLICT DO NOTHING;

  -- Tips
  INSERT INTO product_quick_reference (product_id, section, data, sort_order)
  VALUES (
    dexit_id,
    'tips',
    '[
      "Listen more than you talk - let them reveal pain",
      "Don''t attack competitors - complement existing systems",
      "Focus on time savings, not features",
      "20-minute demo is the goal - specific, not vague",
      "Subscription pricing = lower barrier than capital expense"
    ]'::jsonb,
    4
  )
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- 5. MIGRATE OBJECTION SHORTCUTS
  -- ============================================================
  INSERT INTO product_objection_shortcuts (product_id, node_id, shortcut_key, label, sort_order)
  VALUES
    (dexit_id, 'obj_whats_this_about', '0', 'What''s this about?', 0),
    (dexit_id, 'obj_not_interested', '1', 'Not interested', 1),
    (dexit_id, 'obj_timing', '2', 'Timing', 2),
    (dexit_id, 'obj_happy_current', '3', 'Happy with current', 3),
    (dexit_id, 'obj_send_info', '4', 'Send info', 4),
    (dexit_id, 'obj_cost', '5', 'Cost', 5),
    (dexit_id, 'obj_not_decision_maker', '6', 'Not decision maker', 6),
    (dexit_id, 'obj_contract', '7', 'Contract', 7),
    (dexit_id, 'obj_implementing', '8', 'Implementing', 8)
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================
-- 6. UPDATE RLS POLICIES FOR PRODUCT-AWARE FILTERING
-- ============================================================

-- Update KB Updates policy to filter by product
DROP POLICY IF EXISTS "Public read published updates" ON kb_updates;
CREATE POLICY "Users read product kb_updates" ON kb_updates
  FOR SELECT USING (
    (status = 'published' AND product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid()))
    OR is_admin()
  );

-- Update Call Nodes policy (if exists)
DROP POLICY IF EXISTS "Users read nodes" ON call_nodes;
CREATE POLICY "Users read product nodes" ON call_nodes
  FOR SELECT USING (
    product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid())
    OR is_admin()
  );

-- Update KB Categories policy
DROP POLICY IF EXISTS "Public read categories" ON kb_categories;
CREATE POLICY "Users read product categories" ON kb_categories
  FOR SELECT USING (
    product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid())
    OR product_id IS NULL  -- Allow global categories
    OR is_admin()
  );

-- Update Topic Groups policy (if table has RLS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'topic_groups') THEN
    DROP POLICY IF EXISTS "Users read topic_groups" ON topic_groups;
    EXECUTE 'CREATE POLICY "Users read product topic_groups" ON topic_groups
      FOR SELECT USING (
        product_id IN (SELECT product_id FROM product_users WHERE user_id = auth.uid())
        OR is_admin()
      )';
  END IF;
END $$;

-- ============================================================
-- 7. UPDATE TEAM UPDATES POLICY FOR BROADCAST SUPPORT
-- ============================================================
DROP POLICY IF EXISTS "Users read own team updates" ON team_updates;
CREATE POLICY "Users read team updates" ON team_updates
  FOR SELECT USING (
    -- User's team updates (normal)
    (status = 'published' AND EXISTS (
      SELECT 1 FROM team_members WHERE team_id = team_updates.team_id AND user_id = auth.uid()
    ))
    -- Broadcast to all teams
    OR (status = 'published' AND is_broadcast = true)
    -- Broadcast to user's product
    OR (status = 'published' AND target_product_id IN (
      SELECT product_id FROM product_users WHERE user_id = auth.uid()
    ))
    OR is_admin()
  );

-- ============================================================
-- 8. UPDATE NOTIFICATION TRIGGER FOR PRODUCT-AWARE NOTIFICATIONS
-- ============================================================
CREATE OR REPLACE FUNCTION notify_kb_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    -- Only notify users in the same product
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT
      pu.user_id,
      'new_update',
      'New Update: ' || NEW.title,
      coalesce(NEW.summary, left(NEW.content, 200)),
      'kb_update',
      NEW.id
    FROM product_users pu
    WHERE pu.product_id = NEW.product_id
      AND pu.user_id != coalesce(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. UPDATE TEAM UPDATE NOTIFICATION FOR BROADCAST
-- ============================================================
CREATE OR REPLACE FUNCTION notify_team_update_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    IF NEW.is_broadcast = true THEN
      -- Broadcast to all users
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT
        p.user_id,
        'new_team_update',
        'Team Update (All): ' || NEW.title,
        left(NEW.content, 200),
        'team_update',
        NEW.id
      FROM profiles p
      WHERE p.user_id != NEW.created_by;
    ELSIF NEW.target_product_id IS NOT NULL THEN
      -- Broadcast to product users
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
      SELECT
        pu.user_id,
        'new_team_update',
        'Team Update: ' || NEW.title,
        left(NEW.content, 200),
        'team_update',
        NEW.id
      FROM product_users pu
      WHERE pu.product_id = NEW.target_product_id
        AND pu.user_id != NEW.created_by;
    ELSE
      -- Normal team update
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. UPDATE UNREAD COUNT FUNCTIONS FOR PRODUCT FILTERING
-- ============================================================
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id UUID)
RETURNS INT AS $$
  SELECT count(*)::int
  FROM kb_updates ku
  WHERE ku.status = 'published'
    AND ku.product_id IN (SELECT product_id FROM product_users WHERE user_id = p_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM update_acknowledgments ua
      WHERE ua.update_id = ku.id AND ua.user_id = p_user_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Search function updated for product filtering
CREATE OR REPLACE FUNCTION search_kb_updates(query TEXT, p_user_id UUID DEFAULT NULL)
RETURNS SETOF kb_updates AS $$
  SELECT *
  FROM kb_updates
  WHERE status = 'published'
    AND (p_user_id IS NULL OR product_id IN (SELECT product_id FROM product_users WHERE user_id = p_user_id))
    AND search_vector @@ plainto_tsquery('english', query)
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', query)) DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
