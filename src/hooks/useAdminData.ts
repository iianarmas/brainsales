'use client';

import { useCallback } from 'react';
import { useKbStore, type Product, type DashboardStats } from '@/store/useKbStore';
import { supabase } from '@/app/lib/supabaseClient';
import type { Team } from '@/types/knowledgeBase';

const CACHE_TIME = 60 * 1000; // 1 minute

export function useAdminData() {
    const {
        products,
        lastFetchedProducts,
        setProducts,
        adminStats,
        lastFetchedAdminStats,
        setAdminStats,
        teams,
        lastFetchedTeams,
        setTeams,
    } = useKbStore();

    const fetchProducts = useCallback(async (force = false) => {
        const now = Date.now();
        if (!force && now - lastFetchedProducts < CACHE_TIME && products.length > 0) {
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/products', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);
            }
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
    }, [lastFetchedProducts, products.length, setProducts]);

    const fetchAdminStats = useCallback(async (force = false) => {
        const now = Date.now();
        if (!force && now - lastFetchedAdminStats < CACHE_TIME && adminStats !== null) {
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/kb/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (res.ok) {
                const data = await res.json();
                setAdminStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch admin stats:', error);
        }
    }, [lastFetchedAdminStats, adminStats, setAdminStats]);

    const fetchTeams = useCallback(async (force = false) => {
        const now = Date.now();
        if (!force && now - lastFetchedTeams < CACHE_TIME && teams.length > 0) {
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/kb/teams', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (res.ok) {
                const data = await res.json();
                setTeams(data.data || data || []);
            }
        } catch (error) {
            console.error('Failed to fetch teams:', error);
        }
    }, [lastFetchedTeams, teams.length, setTeams]);

    return {
        products,
        loadingProducts: products.length === 0 && lastFetchedProducts === 0,
        fetchProducts,

        adminStats,
        loadingStats: adminStats === null && lastFetchedAdminStats === 0,
        fetchAdminStats,

        teams,
        loadingTeams: teams.length === 0 && lastFetchedTeams === 0,
        fetchTeams,
    };
}
