import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import { useProduct } from '@/context/ProductContext';
import { useKbStore } from '@/store/useKbStore';
import type { KBUpdate, KBCategory, UpdateFilters } from '@/types/knowledgeBase';

export function useKnowledgeBase(initialFilters: UpdateFilters = {}, productId?: string) {
  const { currentProduct } = useProduct();
  const targetProductId = productId || currentProduct?.id;

  const {
    updates: cachedUpdatesMap,
    categories: cachedCategories,
    setUpdates,
    setCategories,
    lastFetchedUpdates,
    lastFetchedCategories
  } = useKbStore();

  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<UpdateFilters>(initialFilters);

  const updates = useMemo(() => {
    if (!targetProductId) return [];
    return cachedUpdatesMap[targetProductId] || [];
  }, [cachedUpdatesMap, targetProductId]);

  const fetchUpdates = useCallback(async (force = false) => {
    if (!targetProductId) return;

    // Check if we already have fresh data
    const lastFetched = lastFetchedUpdates[targetProductId] || 0;
    const isFresh = Date.now() - lastFetched < 60000; // 1 minute

    // If the cache is fresh and we're not forcing a reload, we don't need to fetch.
    if (!force && isFresh) {
      if (loading) setLoading(false);
      return;
    }

    // Since we are proceeding to fetch, show loading if no data exists
    if (updates.length === 0) {
      setLoading(true);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.status) params.set('status', filters.status);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.search) params.set('search', filters.search);
      if (filters.from_date) params.set('from_date', filters.from_date);
      if (filters.to_date) params.set('to_date', filters.to_date);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      headers['X-Product-Id'] = targetProductId;

      const res = await fetch(`/api/kb/updates?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch updates');

      const json = await res.json();
      setUpdates(targetProductId, json.data || []);
    } catch (err) {
      console.error('Error fetching updates:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, targetProductId, updates.length, setUpdates, lastFetchedUpdates]);

  const fetchCategories = useCallback(async () => {
    // If fetched in the last hour, skip background fetch unless explicitly requested
    if (cachedCategories.length > 0 && Date.now() - lastFetchedCategories < 3600000) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/kb/categories', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) return;
      const json = await res.json();
      setCategories(json.data || json);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, [cachedCategories.length, lastFetchedCategories, setCategories]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    updates,
    categories: cachedCategories,
    loading,
    filters,
    setFilters,
    refetch: fetchUpdates,
  };
}


export function useSearchUpdates() {
  const [results, setResults] = useState<KBUpdate[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const res = await fetch(`/api/kb/updates/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Search failed');
      const json = await res.json();
      setResults(json.data || json);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  return { results, searching, search };
}