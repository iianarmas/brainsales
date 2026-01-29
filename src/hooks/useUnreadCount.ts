'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import { useAuth } from './useAuth';
import type { UnreadCounts } from '@/types/knowledgeBase';

export function useUnreadCount() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({ kb_updates: 0, team_updates: 0, total: 0 });

  const fetchCounts = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || signal?.cancelled) return;
      const res = await fetch('/api/kb/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok || signal?.cancelled) return;
      const data = await res.json();
      if (!signal?.cancelled) setCounts(data.data || data);
    } catch (err) {
      if (!signal?.cancelled) console.error('Error fetching unread count:', err);
    }
  }, [user]);

  useEffect(() => {
    const signal = { cancelled: false };

    const initial = setTimeout(() => fetchCounts(signal), 0);
    const interval = setInterval(() => fetchCounts(signal), 120000); // poll every 2 min
    return () => {
      signal.cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchCounts]);

  return { ...counts, refresh: () => fetchCounts() };
}
