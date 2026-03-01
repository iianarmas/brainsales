import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import { useKbStore } from '@/store/useKbStore';
import type { TeamUpdate, Team } from '@/types/knowledgeBase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export function useTeamUpdates(teamId?: string) {
  const {
    teamUpdates: cachedUpdatesMap,
    teams: cachedTeams,
    setTeamUpdates,
    setTeams,
    lastFetchedTeams
  } = useKbStore();

  const [loading, setLoading] = useState(false);

  const updates = useMemo(() => {
    if (!teamId) return [];
    return cachedUpdatesMap[teamId] || [];
  }, [cachedUpdatesMap, teamId]);

  const fetchTeams = useCallback(async () => {
    // Refresh teams if older than 1 hour or empty
    if (cachedTeams.length > 0 && Date.now() - lastFetchedTeams < 3600000) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const [teamsRes, membershipsRes] = await Promise.all([
        fetch('/api/kb/teams', { headers }),
        fetch('/api/kb/teams/memberships', { headers }) // Assuming this endpoint exists or should exist
      ]);

      if (!teamsRes.ok) return;
      const teamsJson = await teamsRes.json();
      const teamsData = teamsJson.data || teamsJson;

      let memberships: string[] = [];
      if (membershipsRes.ok) {
        const membershipsJson = await membershipsRes.json();
        memberships = membershipsJson.data?.map((m: any) => m.team_id) || [];
      }

      const enrichedTeams = teamsData.map((t: any) => ({
        ...t,
        is_member: memberships.includes(t.id)
      }));

      setTeams(enrichedTeams);
    } catch {
      // silent
    }
  }, [cachedTeams.length, lastFetchedTeams, setTeams]);

  const fetchUpdates = useCallback(async () => {
    if (!teamId) return;

    // Only show loading if we have no data
    if (updates.length === 0) {
      setLoading(true);
    }

    try {
      const headers = await getAuthHeaders();
      let url = teamId !== 'all' ? `/api/kb/teams/${teamId}/updates` : '/api/kb/team-updates';

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();

      setTeamUpdates(teamId, json.data || []);
    } catch (err) {
      console.error('[useTeamUpdates] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId, updates.length, setTeamUpdates]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);
  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const acknowledge = useCallback(async (teamUpdateId: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/kb/team-updates/${teamUpdateId}/acknowledge`, {
        method: 'POST',
        headers,
      });
      // Update local state in store
      setTeamUpdates(teamId || 'all', updates.map((u) => (u.id === teamUpdateId ? { ...u, is_acknowledged: true } : u)));
    } catch {
      // silent
    }
  }, [teamId, updates, setTeamUpdates]);

  return {
    updates,
    teams: cachedTeams,
    loading,
    refetch: fetchUpdates,
    acknowledge
  };
}

