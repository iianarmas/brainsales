'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import { useProduct } from '@/context/ProductContext';
import type { Competitor, CompetitorFilters } from '@/types/competitor';

export function useCompetitors(filters: CompetitorFilters = {}) {
  const { currentProduct } = useProduct();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompetitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      // Use filters.product_id if provided, otherwise use current product
      const targetProductId = filters.product_id || currentProduct?.id;
      if (targetProductId) {
        headers['X-Product-Id'] = targetProductId;
      }

      const res = await fetch(`/api/competitors?${params}`, { headers });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch competitors');
      }

      const json = await res.json();
      setCompetitors(json.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching competitors';
      setError(message);
      console.error('Error fetching competitors:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.product_id, filters.status, filters.search, currentProduct?.id]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  return {
    competitors,
    loading,
    error,
    refetch: fetchCompetitors,
  };
}

export function useCompetitor(competitorId: string | null) {
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompetitor = useCallback(async () => {
    if (!competitorId) {
      setCompetitor(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const res = await fetch(`/api/competitors/${competitorId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch competitor');
      }

      const json = await res.json();
      setCompetitor(json.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching competitor';
      setError(message);
      console.error('Error fetching competitor:', err);
    } finally {
      setLoading(false);
    }
  }, [competitorId]);

  useEffect(() => {
    fetchCompetitor();
  }, [fetchCompetitor]);

  return {
    competitor,
    loading,
    error,
    refetch: fetchCompetitor,
  };
}

// Hook for competitor updates (kb_updates with competitor_id)
export function useCompetitorUpdates(competitorId: string | null, productId?: string) {
  const { currentProduct } = useProduct();
  const [updates, setUpdates] = useState<Array<{
    id: string;
    title: string;
    summary: string | null;
    content: string;
    priority: string;
    created_at: string;
    is_acknowledged?: boolean;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    if (!competitorId) {
      setUpdates([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const params = new URLSearchParams();
      params.set('category', 'competitive');
      params.set('status', 'published');

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      const targetProductId = productId || currentProduct?.id;
      if (targetProductId) {
        headers['X-Product-Id'] = targetProductId;
      }

      const res = await fetch(`/api/kb/updates?${params}`, { headers });

      if (!res.ok) {
        throw new Error('Failed to fetch competitive updates');
      }

      const json = await res.json();
      // Filter updates that have this competitor_id
      const filteredUpdates = (json.data || []).filter(
        (update: { competitor_id?: string }) => update.competitor_id === competitorId
      );
      setUpdates(filteredUpdates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching competitor updates';
      setError(message);
      console.error('Error fetching competitor updates:', err);
    } finally {
      setLoading(false);
    }
  }, [competitorId, productId, currentProduct?.id]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  return {
    updates,
    loading,
    error,
    refetch: fetchUpdates,
  };
}
