import { useState, useEffect } from 'react';
import { Plus, Upload, Users, FileText, Clock, BarChart3, Pencil, X, Building2 } from 'lucide-react';
import { AcknowledgmentTracker } from './AcknowledgmentTracker';
import { useAdminData } from '@/hooks/useAdminData';
import { LoadingScreen } from '@/components/LoadingScreen';

export function KBAdminDashboard() {
  const { adminStats: stats, loadingStats: loading, fetchAdminStats } = useAdminData();
  const [selectedUpdate, setSelectedUpdate] = useState<{ id: string; title: string; type: 'kb' | 'team' } | null>(null);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  if (loading && !stats) {
    return <LoadingScreen fullScreen={false} message="Loading dashboard..." />;
  }

  const statCards = [
    { label: 'Total Updates', value: stats?.total_updates ?? 0, icon: FileText, color: 'text-blue-400' },
    { label: 'Pending Drafts', value: stats?.pending_drafts ?? 0, icon: Clock, color: 'text-amber-400' },
    { label: 'Published', value: stats?.published ?? 0, icon: BarChart3, color: 'text-emerald-400' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-bg-default text-primary p-6 relative">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Knowledge Base Admin</h1>

        {/* Quick actions */}
        <div className="flex gap-3 mb-8">
          <a
            href="/admin/knowledge-base/new"
            className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-transparent shadow-md active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New Update
          </a>
          <a
            href="/admin/knowledge-base/team-update/new"
            className="flex items-center gap-2 border border-primary/30 bg-white/50 hover:bg-primary-light text-primary hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-95"
          >
            <Users className="h-4 w-4" />
            New Team Update
          </a>
          <a
            href="/admin/knowledge-base/teams"
            className="flex items-center gap-2 border border-primary/30 bg-white/50 hover:bg-primary-light text-primary hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-95"
          >
            <Users className="h-4 w-4" />
            Manage Teams
          </a>
          <a
            href="/admin/knowledge-base/competitors"
            className="flex items-center gap-2 border border-primary/30 bg-white/50 hover:bg-primary-light text-primary hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-95"
          >
            <Building2 className="h-4 w-4" />
            Manage Competitors
          </a>
          <a
            href="/admin/kb/import"
            className="flex items-center gap-2 border border-primary/30 bg-white/50 hover:bg-primary-light text-primary hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm active:scale-95"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </a>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white border border-primary-light/30 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow group">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-gray-50 group-hover:scale-110 transition-transform`}>
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <span className="text-sm font-medium text-primary-light">{s.label}</span>
              </div>
              <p className="text-4xl text-primary font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Acknowledgment rates */}
        {stats?.acknowledgment_rates && stats.acknowledgment_rates.length > 0 && (
          <div className="bg-white border border-primary-light/30 rounded-xl p-6 mb-8 shadow-lg">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-6 flex items-center justify-between">
              Acknowledgment Rates
              <BarChart3 className="h-4 w-4 text-primary-light/50" />
            </h2>
            <div className="space-y-6">
              {stats.acknowledgment_rates.map((item) => (
                <div key={item.id || item.title} className="group cursor-pointer" onClick={() => setSelectedUpdate({ id: item.id, title: item.title, type: 'kb' })}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-primary font-medium truncate flex-1 group-hover:text-primary-light transition-colors">{item.title}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-primary-light font-bold shrink-0">{Math.round(item.rate * 100)}%</span>
                      <button className="text-[10px] bg-primary/5 hover:bg-primary/10 text-primary px-2 py-0.5 rounded transition-colors border border-primary/10">
                        Details
                      </button>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out group-hover:bg-emerald-400"
                      style={{ width: `${Math.round(item.rate * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent updates */}
        <div className="bg-white border border-primary-light/30 rounded-xl p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-6 flex items-center justify-between">
            Recent Activity
            <Clock className="h-4 w-4 text-primary-light/50" />
          </h2>
          <div className="divide-y divide-primary-light/10">
            {(stats?.recent_updates ?? []).length === 0 ? (
              <p className="text-primary-light/60 text-sm py-8 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                No updates published yet
              </p>
            ) : (
              stats!.recent_updates.map((u) => {
                const editUrl = u.update_type === 'team_update'
                  ? `/admin/knowledge-base/team-update/${u.id}/edit`
                  : `/admin/knowledge-base/${u.id}/edit`;
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between py-4 group hover:bg-gray-50/80 -mx-6 px-6 transition-all"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg ${u.update_type === 'team_update' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                        {u.update_type === 'team_update' ? <Users className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-primary truncate group-hover:text-primary-light transition-colors">
                          {u.title}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-primary-light/60">
                            {new Date(u.created_at).toLocaleDateString()}
                          </span>
                          {u.update_type === 'team_update' && (
                            <span className="text-[10px] px-1.5 py-0 rounded-full bg-amber-100 text-amber-700 font-medium">
                              Team Update
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => setSelectedUpdate({ id: u.id, title: u.title, type: u.update_type === 'team_update' ? 'team' : 'kb' })}
                        className="text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 active:scale-95"
                      >
                        <BarChart3 className="h-3 w-3" />
                        Stats
                      </button>
                      <a
                        href={editUrl}
                        className="p-2 text-primary-light/40 hover:text-primary transition-colors hover:bg-white rounded-lg border border-transparent hover:border-primary-light/20 shadow-none hover:shadow-sm"
                      >
                        <Pencil className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Acknowledgment Stats Modal */}
      {selectedUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-primary">Acknowledgment Tracking</h3>
                <p className="text-xs text-primary-light truncate max-w-[400px]">{selectedUpdate.title}</p>
              </div>
              <button
                onClick={() => setSelectedUpdate(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-primary-light/50 hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-50/30">
              <AcknowledgmentTracker updateId={selectedUpdate.id} updateType={selectedUpdate.type} />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end">
              <button
                onClick={() => setSelectedUpdate(null)}
                className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors shadow-lg active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
