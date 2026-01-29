'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import { useProduct } from '@/context/ProductContext';
import type { KBUpdate, KBCategory, UpdateFilters } from '@/types/knowledgeBase';

export function useKnowledgeBase(initialFilters: UpdateFilters = {}) {
  const { currentProduct } = useProduct();
  const [updates, setUpdates] = useState<KBUpdate[]>([]);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<UpdateFilters>(initialFilters);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

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
      if (currentProduct?.id) {
        headers['X-Product-Id'] = currentProduct.id;
      }

      const res = await fetch(`/api/kb/updates?${params}`, { headers });

      if (!res.ok) throw new Error('Failed to fetch updates');
      const json = await res.json();
      setUpdates(json.data);
      setTotalCount(json.pagination?.total || 0);
    } catch (err) {
      console.error('Error fetching updates:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, currentProduct?.id]);

  const fetchCategories = useCallback(async () => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session for fetching categories');
        return;
      }

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
  }, []);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    updates,
    categories,
    totalCount,
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