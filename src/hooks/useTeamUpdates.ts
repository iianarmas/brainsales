'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
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
  const [updates, setUpdates] = useState<TeamUpdate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTeams = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/kb/teams', { headers });
      if (!res.ok) return;
      const json = await res.json();
      setTeams(json.data || json);
    } catch {
      // silent
    }
  }, []);

  const fetchUpdates = useCallback(async () => {
    // Determine if we should fetch. 
    // We fetch if teamId is set (specific team or 'all')
    if (!teamId) {
      setUpdates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();

      let url = '';

      if (teamId !== 'all') {
        // Specific team
        url = `/api/kb/teams/${teamId}/updates`;
      } else {
        // 'all' view
        url = '/api/kb/team-updates';
      }

      console.log(`[useTeamUpdates] Fetching from: ${url}`);
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      console.log(`[useTeamUpdates] Got ${json.data?.length} updates`);
      setUpdates(json.data || []);
      setTotalCount(json.count || json.data?.length || 0);
    } catch (err) {
      console.error('[useTeamUpdates] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);
  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const acknowledge = useCallback(async (teamUpdateId: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/kb/team-updates/${teamUpdateId}/acknowledge`, {
        method: 'POST',
        headers,
      });
      setUpdates((prev) =>
        prev.map((u) => (u.id === teamUpdateId ? { ...u, is_acknowledged: true } : u))
      );
    } catch {
      // silent
    }
  }, []);

  return { updates, teams, totalCount, loading, refetch: fetchUpdates, acknowledge };
}
