import { create } from 'zustand';
import type { KBUpdate, KBCategory, Team, TeamUpdate } from '@/types/knowledgeBase';
import type { Competitor } from '@/types/competitor';

export interface Product {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    role?: string;
    is_default?: boolean;
}

export interface DashboardStats {
    total_updates: number;
    pending_drafts: number;
    published: number;
    kb_stats?: { total: number; drafts: number; published: number };
    team_stats?: { total: number; drafts: number; published: number };
    acknowledgment_rates: { id: string; title: string; rate: number }[];
    recent_updates: { id: string; title: string; status: string; created_at: string; update_type?: string }[];
}

interface KbState {
    // Product Updates
    updates: Record<string, KBUpdate[]>; // productId -> updates
    categories: KBCategory[];
    lastFetchedUpdates: Record<string, number>; // productId -> timestamp
    lastFetchedCategories: number;

    // Team Updates
    teamUpdates: Record<string, TeamUpdate[]>; // teamId ('all' or specific) -> updates
    teams: Team[];
    lastFetchedTeamUpdates: Record<string, number>; // teamId -> timestamp
    lastFetchedTeams: number;

    // Competitive Intel
    competitors: Record<string, Competitor[]>; // productId -> competitors
    competitiveUpdates: Record<string, KBUpdate[]>; // productId -> updates
    lastFetchedCompetitiveIntel: Record<string, number>; // productId -> timestamp

    // Admin Data
    products: Product[];
    lastFetchedProducts: number;
    adminStats: DashboardStats | null;
    lastFetchedAdminStats: number;
}

interface KbActions {
    setUpdates: (productId: string, updates: KBUpdate[]) => void;
    setCategories: (categories: KBCategory[]) => void;
    setTeamUpdates: (teamId: string, updates: TeamUpdate[]) => void;
    setTeams: (teams: Team[]) => void;
    setCompetitiveIntel: (productId: string, competitors: Competitor[], updates: KBUpdate[]) => void;
    setProducts: (products: Product[]) => void;
    setAdminStats: (stats: DashboardStats) => void;
    clearCache: () => void;
}

export const useKbStore = create<KbState & KbActions>((set) => ({
    updates: {},
    categories: [],
    lastFetchedUpdates: {},
    lastFetchedCategories: 0,
    teamUpdates: {},
    teams: [],
    lastFetchedTeamUpdates: {},
    lastFetchedTeams: 0,
    competitors: {},
    competitiveUpdates: {},
    lastFetchedCompetitiveIntel: {},
    products: [],
    lastFetchedProducts: 0,
    adminStats: null,
    lastFetchedAdminStats: 0,

    setUpdates: (productId, updates) => set((state) => ({
        updates: { ...state.updates, [productId]: updates },
        lastFetchedUpdates: { ...state.lastFetchedUpdates, [productId]: Date.now() },
    })),

    setCategories: (categories) => set({
        categories,
        lastFetchedCategories: Date.now(),
    }),

    setTeamUpdates: (teamId, updates) => set((state) => ({
        teamUpdates: { ...state.teamUpdates, [teamId]: updates },
        lastFetchedTeamUpdates: { ...state.lastFetchedTeamUpdates, [teamId]: Date.now() },
    })),

    setTeams: (teams) => set({
        teams,
        lastFetchedTeams: Date.now(),
    }),

    setCompetitiveIntel: (productId, competitors, updates) => set((state) => ({
        competitors: { ...state.competitors, [productId]: competitors },
        competitiveUpdates: { ...state.competitiveUpdates, [productId]: updates },
        lastFetchedCompetitiveIntel: { ...state.lastFetchedCompetitiveIntel, [productId]: Date.now() },
    })),

    setProducts: (products) => set({
        products,
        lastFetchedProducts: Date.now(),
    }),

    setAdminStats: (adminStats) => set({
        adminStats,
        lastFetchedAdminStats: Date.now(),
    }),

    clearCache: () => set({
        updates: {},
        categories: [],
        lastFetchedUpdates: {},
        lastFetchedCategories: 0,
        teamUpdates: {},
        teams: [],
        lastFetchedTeamUpdates: {},
        lastFetchedTeams: 0,
        competitors: {},
        competitiveUpdates: {},
        lastFetchedCompetitiveIntel: {},
        products: [],
        lastFetchedProducts: 0,
        adminStats: null,
        lastFetchedAdminStats: 0,
    }),
}));
