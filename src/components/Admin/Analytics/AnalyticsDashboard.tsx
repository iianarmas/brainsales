'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/app/lib/supabaseClient';
import { toast } from 'sonner';
import {
  BarChart3,
  RefreshCw,
  Calendar,
  Loader2,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { OutcomeFunnel } from './OutcomeFunnel';
import { DropOffAnalysis } from './DropOffAnalysis';
import { RepLeaderboard } from './RepLeaderboard';
import { ObjectionFrequency } from './ObjectionFrequency';

interface DateRange {
  from: string;
  to: string;
}

export interface DashboardData {
  dateRange: DateRange;
  outcomeDistribution: {
    total: number;
    outcomes: { outcome: string; count: number; percentage: number }[];
  };
  completionRate: {
    totalSessions: number;
    completed: number;
    rate: number;
  };
  dropOffNodes: {
    nodeId: string;
    nodeTitle: string;
    nodeType: string;
    count: number;
    percentage: number;
  }[];
  objectionFrequency: {
    nodeId: string;
    nodeTitle: string;
    count: number;
    percentage: number;
  }[];
  repPerformance: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    totalCalls: number;
    outcomes: Record<string, number>;
    successCount: number;
    successRate: number;
    avgDurationSeconds: number | null;
  }[];
}

const RANGE_PRESETS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export function AnalyticsDashboard() {
  const { session } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState(1); // default 30d

  const fetchData = useCallback(async (days: number) => {
    if (!session?.access_token) return;
    setLoading(true);

    try {
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();

      const res = await fetch(
        `/api/analytics/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch analytics');
      }

      setData(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchData(RANGE_PRESETS[selectedRange].days);
  }, [fetchData, selectedRange]);

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-primary">Call Analytics</h1>
            <p className="text-gray-500 text-sm mt-1">
              Conversion funnels, drop-off analysis, and rep performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date range presets */}
            <div className="flex items-center gap-1 bg-white border border-primary-light/20 rounded-lg p-1">
              {RANGE_PRESETS.map((preset, i) => (
                <button
                  key={preset.days}
                  onClick={() => setSelectedRange(i)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedRange === i
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchData(RANGE_PRESETS[selectedRange].days)}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : !data || (data.completionRate.totalSessions === 0 && data.outcomeDistribution.total === 0) ? (
          <EmptyState />
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Total Sessions"
                value={data.completionRate.totalSessions}
                icon={BarChart3}
              />
              <StatCard
                label="Completion Rate"
                value={`${data.completionRate.rate}%`}
                icon={TrendingUp}
                subtitle={`${data.completionRate.completed} completed`}
              />
              <StatCard
                label="Outcomes Logged"
                value={data.outcomeDistribution.total}
                icon={Calendar}
              />
              <StatCard
                label="Active Reps"
                value={data.repPerformance.length}
                icon={AlertTriangle}
              />
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <OutcomeFunnel data={data.outcomeDistribution} />
              <DropOffAnalysis nodes={data.dropOffNodes} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RepLeaderboard reps={data.repPerformance} />
              <ObjectionFrequency objections={data.objectionFrequency} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: typeof BarChart3;
  subtitle?: string;
}) {
  return (
    <div className="bg-white border border-primary-light/20 rounded-xl p-5 shadow-xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary-light/20 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary-light" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-primary">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-primary-light/20 rounded-xl p-12 text-center shadow-xl">
      <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-600 mb-2">No analytics data yet</h3>
      <p className="text-sm text-gray-400 max-w-md mx-auto">
        Analytics will appear here once your team starts making calls and logging outcomes.
        Session data is collected automatically during call navigation.
      </p>
    </div>
  );
}
