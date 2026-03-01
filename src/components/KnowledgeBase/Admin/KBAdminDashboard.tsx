import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Upload, Users, FileText, Clock, BarChart3, Pencil, X, Building2, Search } from 'lucide-react';
import { AcknowledgmentTracker } from './AcknowledgmentTracker';
import { CategoryManager } from './CategoryManager';
import { ProductUpdatesManager } from './ProductUpdatesManager';
import { TeamUpdatesFeed } from '../TeamUpdatesFeed';
import { useAdminData } from '@/hooks/useAdminData';
import { LoadingScreen } from '@/components/LoadingScreen';

interface KBAdminDashboardProps {
  initialTab?: 'product' | 'team';
}

export function KBAdminDashboard({ initialTab = 'product' }: KBAdminDashboardProps) {
  const { adminStats: stats, loadingStats: loading, fetchAdminStats } = useAdminData();
  const [selectedUpdate, setSelectedUpdate] = useState<{ id: string; title: string; type: 'kb' | 'team' } | null>(null);
  const [activeTab, setActiveTab] = useState<'product' | 'team'>(initialTab);
  const [teamSearch, setTeamSearch] = useState('');

  // Sync tab when URL param changes (e.g. user navigates via sidebar)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  if (loading && !stats) {
    return <LoadingScreen fullScreen={false} message="Loading dashboard..." />;
  }

  const statCards = [
    { label: 'Total Updates', value: activeTab === 'product' ? (stats?.kb_stats?.total ?? 0) : (stats?.team_stats?.total ?? 0), icon: FileText, color: 'text-blue-400' },
    { label: 'Pending Drafts', value: activeTab === 'product' ? (stats?.kb_stats?.drafts ?? 0) : (stats?.team_stats?.drafts ?? 0), icon: Clock, color: 'text-amber-400' },
    { label: 'Published', value: activeTab === 'product' ? (stats?.kb_stats?.published ?? 0) : (stats?.team_stats?.published ?? 0), icon: BarChart3, color: 'text-emerald-400' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground p-6 relative">
      <div className="max-w-5xl mx-auto">

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 mb-6 bg-surface-elevated rounded-xl p-1 shadow-xl border border-border-subtle w-fit">
          <button
            onClick={() => setActiveTab('product')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'product'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
              }`}
          >
            <FileText className="h-4 w-4" />
            Product Updates
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'team'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
              }`}
          >
            <Users className="h-4 w-4" />
            Team Updates
          </button>
        </div>

        {/* Quick actions — context-aware */}
        <div className="flex gap-3 mb-8">
          {activeTab === 'product' ? (
            <>
              <Link
                href="/admin/updates/new"
                className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-transparent shadow-md active:scale-95"
              >
                <Plus className="h-4 w-4" />
                New Update
              </Link>
              <Link
                href="/admin/updates/competitors"
                className="flex items-center gap-2 border border-border-subtle bg-surface-elevated hover:bg-surface-active text-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg active:scale-95"
              >
                <Building2 className="h-4 w-4 text-primary" />
                Manage Competitors
              </Link>
              <Link
                href="/admin/kb/import"
                className="flex items-center gap-2 border border-border-subtle bg-surface-elevated hover:bg-surface-active text-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg active:scale-95"
              >
                <Upload className="h-4 w-4 text-primary" />
                Bulk Import
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/admin/updates/team-update/new"
                className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-transparent shadow-md active:scale-95"
              >
                <Plus className="h-4 w-4" />
                New Team Update
              </Link>
              <Link
                href="/admin/updates/teams"
                className="flex items-center gap-2 border border-border-subtle bg-surface-elevated hover:bg-surface-active text-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg active:scale-95"
              >
                <Users className="h-4 w-4 text-primary" />
                Manage Teams
              </Link>
            </>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-surface group-hover:scale-110 transition-transform`}>
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-4xl text-foreground font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Category Management */}
        <div className="mb-8">
          <CategoryManager />
        </div>

        {/* Acknowledgment rates */}
        {stats?.acknowledgment_rates && stats.acknowledgment_rates.filter(r => activeTab === 'product' ? r.type === 'kb' : r.type === 'team').length > 0 && (
          <div className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 mb-8 shadow-xl">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-6 flex items-center justify-between">
              {activeTab === 'product' ? 'Product' : 'Team'} Acknowledgment Rates
              <BarChart3 className="h-4 w-4 text-muted-foreground/30" />
            </h2>
            <div className="space-y-6">
              {stats.acknowledgment_rates
                .filter(item => activeTab === 'product' ? item.type === 'kb' : item.type === 'team')
                .map((item) => (
                  <div key={item.id || item.title} className="group cursor-pointer" onClick={() => setSelectedUpdate({ id: item.id, title: item.title, type: item.type === 'team' ? 'team' : 'kb' })}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-foreground font-medium truncate flex-1 group-hover:text-primary transition-colors">{item.title}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-bold shrink-0">{Math.round(item.rate * 100)}%</span>
                        <button className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded transition-colors border border-primary/20">
                          Details
                        </button>
                      </div>
                    </div>
                    <div className="h-2.5 bg-surface-active rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-1000 ease-out opacity-90 group-hover:opacity-100"
                        style={{ width: `${Math.round(item.rate * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Management Section */}
        <div className="mt-8 transition-all duration-300">
          {activeTab === 'product' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ProductUpdatesManager onShowStats={(u) => setSelectedUpdate({ id: u.id, title: u.title, type: 'kb' })} />
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search team updates..."
                  className="w-full bg-surface-elevated border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium shadow-sm"
                />
              </div>
              <div className="bg-surface-elevated border border-border-subtle rounded-2xl p-6 shadow-xl overflow-hidden">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">Team Distribution Feed</h2>
                <TeamUpdatesFeed
                  isAdmin={true}
                  searchQuery={teamSearch}
                  onShowStats={(u) => setSelectedUpdate({ id: u.id, title: u.title, type: 'team' })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Acknowledgment Stats Modal */}
      {selectedUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-elevated rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-border-subtle">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-foreground">Acknowledgment Tracking</h3>
                <p className="text-xs text-muted-foreground truncate max-w-[400px] font-medium">{selectedUpdate.title}</p>
              </div>
              <button
                onClick={() => setSelectedUpdate(null)}
                className="p-2 hover:bg-surface-active rounded-full transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-surface/30">
              <AcknowledgmentTracker updateId={selectedUpdate.id} updateType={selectedUpdate.type} />
            </div>
            <div className="px-6 py-4 border-t border-border-subtle bg-surface-elevated flex justify-end">
              <button
                onClick={() => setSelectedUpdate(null)}
                className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg active:scale-95"
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
