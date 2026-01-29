'use client';

import { useState, useEffect } from 'react';
import { Plus, Upload, Users, FileText, Clock, BarChart3, Loader2, Pencil, ExternalLink } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';

interface DashboardStats {
  total_updates: number;
  pending_drafts: number;
  published: number;
  kb_stats?: { total: number; drafts: number; published: number };
  team_stats?: { total: number; drafts: number; published: number };
  acknowledgment_rates: { title: string; rate: number }[];
  recent_updates: { id: string; title: string; status: string; created_at: string; update_type?: string }[];
}

export function KBAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }
        const res = await fetch('/api/kb/admin/stats', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) throw new Error('Failed');
        setStats(await res.json());
      } catch {
        // fallback empty
        setStats({
          total_updates: 0,
          pending_drafts: 0,
          published: 0,
          acknowledgment_rates: [],
          recent_updates: [],
        });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <Loader2 className="h-8 w-8 text-gray-500 animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Updates', value: stats?.total_updates ?? 0, icon: FileText, color: 'text-blue-400' },
    { label: 'Pending Drafts', value: stats?.pending_drafts ?? 0, icon: Clock, color: 'text-amber-400' },
    { label: 'Published', value: stats?.published ?? 0, icon: BarChart3, color: 'text-emerald-400' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-bg-default text-primary p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Knowledge Base Admin</h1>

        {/* Quick actions */}
        <div className="flex gap-3 mb-8">
          <a
            href="/admin/knowledge-base/new"
            className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Update
          </a>
          <a
            href="/admin/knowledge-base/team-update/new"
            className="flex items-center gap-2 border border-1 border-primary/50 hover:bg-primary-light text-primary hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Users className="h-4 w-4" />
            New Team Update
          </a>
          <a
            href="/admin/knowledge-base/teams"
            className="flex items-center gap-2 border border-1 border-primary/50 hover:bg-primary-light text-primary hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Users className="h-4 w-4" />
            Manage Teams
          </a>
          <a
            href="/admin/kb/import"
            className="flex items-center gap-2 border border-1 border-primary/50 hover:bg-primary-light text-primary hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </a>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white border border-primary-light/50 rounded-lg p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <span className="text-sm text-primary">{s.label}</span>
              </div>
              <p className="text-3xl text-gray-700 font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Acknowledgment rates */}
        {stats?.acknowledgment_rates && stats.acknowledgment_rates.length > 0 && (
          <div className="bg-white border border-primary-light/50 rounded-lg p-5 mb-8 shadow-lg">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
              Acknowledgment Rates
            </h2>
            <div className="space-y-3">
              {stats.acknowledgment_rates.map((item) => (
                <div key={item.title}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate">{item.title}</span>
                    <span className="text-gray-500 shrink-0 ml-2">{Math.round(item.rate * 100)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-light rounded-full transition-all"
                      style={{ width: `${Math.round(item.rate * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent updates */}
        <div className="bg-white border border-primary-light/50 rounded-lg p-5 shadow-lg">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
            Recent Updates
          </h2>
          <div className="divide-y divide-primary-light/20">
            {(stats?.recent_updates ?? []).length === 0 ? (
              <p className="text-gray-700 text-sm py-4">No updates yet</p>
            ) : (
              stats!.recent_updates.map((u) => {
                const editUrl = u.update_type === 'team_update'
                  ? `/admin/knowledge-base/team-update/${u.id}/edit`
                  : `/admin/knowledge-base/${u.id}/edit`;
                return (
                  <a
                    key={u.id}
                    href={editUrl}
                    className="flex items-center justify-between py-3 hover:bg-primary-light -mx-2 px-2 rounded transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-semibold text-gray-700 truncate group-hover:text-white transition-colors">
                        {u.title}
                      </span>
                      {u.update_type === 'team_update' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary-light text-white shrink-0">
                          Team
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          u.status === 'published'
                            ? 'bg-emerald-500 text-white'
                            : u.status === 'draft'
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-700 text-white'
                        }`}
                      >
                        {u.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                      <Pencil className="h-3.5 w-3.5 text-gray-500 group-hover:text-white transition-colors" />
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
