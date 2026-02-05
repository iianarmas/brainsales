// ============================================================
// Knowledge Base Types
// ============================================================

import type { Competitor } from './competitor';

export interface KBCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export type UpdateStatus = 'draft' | 'review' | 'published' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface KBUpdate {
  id: string;
  category_id: string;
  title: string;
  slug: string | null;
  content: string;
  summary: string | null;
  tags: string[];
  version: string | null;
  status: UpdateStatus;
  priority: Priority;
  publish_at: string | null;
  published_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Competitor link (for competitive intel updates)
  competitor_id?: string | null;
  // Joined
  category?: KBCategory;
  competitor?: Competitor;
  features?: KBUpdateFeature[];
  metrics?: KBUpdateMetric[];
  acknowledgment_count?: number;
  is_acknowledged?: boolean;
}

export interface KBUpdateFeature {
  id: string;
  update_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface KBUpdateMetric {
  id: string;
  update_id: string;
  metric_name: string;
  old_value: string | null;
  new_value: string;
  unit: string | null;
  created_at: string;
}

export interface KBUpdateVersion {
  id: string;
  update_id: string;
  version_number: number;
  title: string;
  content: string;
  changed_by: string | null;
  change_description: string | null;
  created_at: string;
}

export interface KBUpdateAttachment {
  id: string;
  update_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface UpdateAcknowledgment {
  id: string;
  update_id: string;
  user_id: string;
  acknowledged_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count?: number;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  // Joined
  email?: string;
  display_name?: string;
}

export interface TeamUpdate {
  id: string;
  team_id: string;
  target_product_id?: string;
  created_by: string;
  title: string;
  content: string;
  priority: Priority;
  requires_acknowledgment: boolean;
  status: UpdateStatus;
  publish_at: string | null;
  published_at: string | null;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  team?: Team;
  target_product?: { id: string; name: string };
  acknowledgment_count?: number;
  is_acknowledged?: boolean;
}

export interface TeamUpdateAcknowledgment {
  id: string;
  team_update_id: string;
  user_id: string;
  acknowledged_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_update' | 'new_team_update' | 'acknowledgment' | 'reminder';
  title: string;
  message: string | null;
  reference_type: 'kb_update' | 'team_update' | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  in_app: boolean;
  email: boolean;
  push_enabled: boolean;
  digest_frequency: 'realtime' | 'hourly' | 'daily';
  quiet_start: string | null;
  quiet_end: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================
// Request / Filter Types
// ============================================================

export interface UpdateFilters {
  category?: string; // slug
  status?: UpdateStatus;
  priority?: Priority;
  search?: string;
  tags?: string[];
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface CreateUpdatePayload {
  category_slug: string;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  version?: string;
  status?: UpdateStatus;
  priority?: Priority;
  publish_at?: string;
  target_product_id?: string;
  competitor_id?: string;
  features?: { name: string; description?: string }[];
  metrics?: { metric_name: string; old_value?: string; new_value: string; unit?: string }[];
}

export interface CreateTeamUpdatePayload {
  team_id: string;
  title: string;
  content: string;
  priority?: Priority;
  requires_acknowledgment?: boolean;
  status?: UpdateStatus;
  publish_at?: string;
  effective_until?: string;
}

export interface AcknowledgmentStats {
  total_users: number;
  acknowledged_count: number;
  pending_count: number;
}

export interface UnreadCounts {
  kb_updates: number;
  team_updates: number;
  total: number;
}
