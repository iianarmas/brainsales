import { createClient } from '@supabase/supabase-js';
import type {
  KBCategory,
  KBUpdate,
  KBUpdateVersion,
  UpdateFilters,
  CreateUpdatePayload,
  CreateTeamUpdatePayload,
  TeamUpdate,
  Team,
  TeamMember,
  Notification,
  NotificationPreferences,
  AcknowledgmentStats,
  UnreadCounts,
} from '@/types/knowledgeBase';

// Use the browser client for frontend, service role for server
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// ============================================================
// CATEGORIES
// ============================================================

export async function fetchCategories(): Promise<KBCategory[]> {
  const { data, error } = await getSupabase()
    .from('kb_categories')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data;
}

// ============================================================
// KB UPDATES
// ============================================================

export async function fetchUpdates(filters: UpdateFilters = {}): Promise<{ data: KBUpdate[]; count: number }> {
  const supabase = getSupabase();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('kb_updates')
    .select('*, category:kb_categories(*), features:kb_update_features(*), metrics:kb_update_metrics(*)', { count: 'exact' });

  if (filters.category) {
    // Join category and filter by slug
    query = query.eq('category.slug', filters.category);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  } else {
    query = query.eq('status', 'published');
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters.from_date) {
    query = query.gte('published_at', filters.from_date);
  }
  if (filters.to_date) {
    query = query.lte('published_at', filters.to_date);
  }
  if (filters.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags);
  }

  query = query.order('published_at', { ascending: false, nullsFirst: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function fetchUpdate(id: string): Promise<KBUpdate> {
  const { data, error } = await getSupabase()
    .from('kb_updates')
    .select('*, category:kb_categories(*), features:kb_update_features(*), metrics:kb_update_metrics(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function searchUpdates(query: string): Promise<KBUpdate[]> {
  const { data, error } = await getSupabase().rpc('search_kb_updates', { query });
  if (error) throw error;
  return data;
}

export async function createUpdate(payload: CreateUpdatePayload): Promise<KBUpdate> {
  const supabase = getServiceSupabase();

  // Resolve category
  const { data: cat } = await supabase
    .from('kb_categories')
    .select('id')
    .eq('slug', payload.category_slug)
    .single();

  if (!cat) throw new Error(`Category not found: ${payload.category_slug}`);

  const { data: update, error } = await supabase
    .from('kb_updates')
    .insert({
      category_id: cat.id,
      title: payload.title,
      content: payload.content,
      summary: payload.summary,
      tags: payload.tags ?? [],
      version: payload.version,
      status: payload.status ?? 'draft',
      priority: payload.priority ?? 'medium',
      publish_at: payload.publish_at,
    })
    .select()
    .single();

  if (error) throw error;

  // Insert features
  if (payload.features?.length) {
    const { error: fErr } = await supabase.from('kb_update_features').insert(
      payload.features.map((f, i) => ({
        update_id: update.id,
        name: f.name,
        description: f.description,
        sort_order: i,
      }))
    );
    if (fErr) throw fErr;
  }

  // Insert metrics
  if (payload.metrics?.length) {
    const { error: mErr } = await supabase.from('kb_update_metrics').insert(
      payload.metrics.map((m) => ({
        update_id: update.id,
        metric_name: m.metric_name,
        old_value: m.old_value,
        new_value: m.new_value,
        unit: m.unit,
      }))
    );
    if (mErr) throw mErr;
  }

  return update;
}

export async function updateUpdate(id: string, data: Partial<KBUpdate>): Promise<KBUpdate> {
  const { data: updated, error } = await getServiceSupabase()
    .from('kb_updates')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return updated;
}

export async function publishUpdate(id: string): Promise<KBUpdate> {
  return updateUpdate(id, { status: 'published' } as Partial<KBUpdate>);
}

export async function deleteUpdate(id: string): Promise<void> {
  const { error } = await getServiceSupabase()
    .from('kb_updates')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchUpdateVersions(updateId: string): Promise<KBUpdateVersion[]> {
  const { data, error } = await getSupabase()
    .from('kb_update_versions')
    .select('*')
    .eq('update_id', updateId)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return data;
}

// ============================================================
// ACKNOWLEDGMENTS
// ============================================================

export async function acknowledgeUpdate(updateId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('update_acknowledgments')
    .upsert({ update_id: updateId, user_id: userId }, { onConflict: 'update_id,user_id' });
  if (error) throw error;
}

export async function getAcknowledgmentStats(updateId: string): Promise<AcknowledgmentStats> {
  const { data, error } = await getSupabase().rpc('get_acknowledgment_stats', { p_update_id: updateId });
  if (error) throw error;
  return data?.[0] ?? { total_users: 0, acknowledged_count: 0, pending_count: 0 };
}

export async function getUserAcknowledgments(userId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('update_acknowledgments')
    .select('update_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((d) => d.update_id);
}

export async function getUnacknowledgedUsers(updateId: string): Promise<{ id: string; email: string }[]> {
  const { data, error } = await getServiceSupabase().rpc('get_acknowledgment_stats', { p_update_id: updateId });
  if (error) throw error;
  // For detailed user list, query directly
  const { data: acked } = await getServiceSupabase()
    .from('update_acknowledgments')
    .select('user_id')
    .eq('update_id', updateId);
  const ackedIds = new Set((acked ?? []).map((a) => a.user_id));
  const { data: allUsers } = await getServiceSupabase().from('auth.users').select('id, email');
  return (allUsers ?? []).filter((u) => !ackedIds.has(u.id));
}

// ============================================================
// UNREAD COUNTS
// ============================================================

export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  const supabase = getSupabase();
  const [kb, team] = await Promise.all([
    supabase.rpc('get_unread_count', { p_user_id: userId }),
    supabase.rpc('get_team_unread_count', { p_user_id: userId }),
  ]);
  const kbCount = kb.data ?? 0;
  const teamCount = team.data ?? 0;
  return { kb_updates: kbCount, team_updates: teamCount, total: kbCount + teamCount };
}

// ============================================================
// TEAMS
// ============================================================

export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await getSupabase().from('teams').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function createTeam(name: string, description?: string): Promise<Team> {
  const { data, error } = await getServiceSupabase()
    .from('teams')
    .insert({ name, description })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await getSupabase()
    .from('team_members')
    .select('*')
    .eq('team_id', teamId);
  if (error) throw error;
  return data;
}

export async function addTeamMember(teamId: string, userId: string, role = 'member'): Promise<void> {
  const { error } = await getServiceSupabase()
    .from('team_members')
    .upsert({ team_id: teamId, user_id: userId, role }, { onConflict: 'team_id,user_id' });
  if (error) throw error;
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await getServiceSupabase()
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ============================================================
// TEAM UPDATES
// ============================================================

export async function fetchTeamUpdates(
  teamId: string,
  filters: { status?: string; priority?: string; page?: number; limit?: number } = {}
): Promise<{ data: TeamUpdate[]; count: number }> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = getSupabase()
    .from('team_updates')
    .select('*, team:teams(*)', { count: 'exact' })
    .eq('team_id', teamId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function createTeamUpdate(payload: CreateTeamUpdatePayload): Promise<TeamUpdate> {
  const { data, error } = await getServiceSupabase()
    .from('team_updates')
    .insert({
      team_id: payload.team_id,
      title: payload.title,
      content: payload.content,
      priority: payload.priority ?? 'medium',
      requires_acknowledgment: payload.requires_acknowledgment ?? true,
      status: payload.status ?? 'draft',
      publish_at: payload.publish_at,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function acknowledgeTeamUpdate(teamUpdateId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('team_update_acknowledgments')
    .upsert({ team_update_id: teamUpdateId, user_id: userId }, { onConflict: 'team_update_id,user_id' });
  if (error) throw error;
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export async function fetchNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  const { data, error } = await getSupabase()
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  const { error } = await getSupabase()
    .from('notification_preferences')
    .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ============================================================
// REALTIME SUBSCRIPTIONS
// ============================================================

export function subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
  const supabase = getSupabase();
  return supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => callback(payload.new as Notification)
    )
    .subscribe();
}

export function subscribeToAcknowledgments(updateId: string, callback: (ack: { user_id: string }) => void) {
  const supabase = getSupabase();
  return supabase
    .channel(`acks-${updateId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'update_acknowledgments',
        filter: `update_id=eq.${updateId}`,
      },
      (payload) => callback(payload.new as { user_id: string })
    )
    .subscribe();
}

// ============================================================
// BULK IMPORT
// ============================================================

export async function bulkImportUpdates(updates: CreateUpdatePayload[]): Promise<{ success: number; errors: string[] }> {
  const errors: string[] = [];
  let success = 0;

  for (const update of updates) {
    try {
      await createUpdate(update);
      success++;
    } catch (err) {
      errors.push(`Failed to import "${update.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { success, errors };
}
