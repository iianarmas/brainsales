'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, Square, ChevronDown, Users, Calendar, Package, CheckSquare, Trash2, ArrowUpDown, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabaseClient';
import { useTeamUpdates } from '@/hooks/useTeamUpdates';
import type { TeamUpdate } from '@/types/knowledgeBase';
import { ImageLightbox } from './ImageLightbox';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ThemedSelect } from '@/components/ThemedSelect';

const priorityConfig: Record<string, { color: string; border: string; label: string }> = {
  urgent: { color: 'bg-destructive/10 text-destructive-foreground', border: 'border-destructive/30', label: 'Urgent' },
  high: { color: 'bg-warning/10 text-warning-foreground', border: 'border-warning/30', label: 'High' },
  medium: { color: 'bg-info/10 text-info-foreground', border: 'border-info/30', label: 'Medium' },
  low: { color: 'bg-muted text-muted-foreground', border: 'border-border', label: 'Low' },
};

// Strip HTML tags for plain text preview
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

interface TeamUpdatesFeedProps {
  teamId?: string;
  onTeamChange?: (teamId: string) => void;
  initialUpdateId?: string;
  searchQuery?: string;
  isAdmin?: boolean;
  onShowStats?: (update: TeamUpdate) => void;
}

export function TeamUpdatesFeed({
  teamId: externalTeamId,
  onTeamChange,
  initialUpdateId,
  searchQuery = '',
  isAdmin,
  onShowStats
}: TeamUpdatesFeedProps) {
  const [selectedTeam, setSelectedTeam] = useState('all');
  const { teams, updates, loading, refetch, acknowledge } = useTeamUpdates(selectedTeam);
  const [initialUpdate, setInitialUpdate] = useState<TeamUpdate | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(!!initialUpdateId);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Sync with external team ID
  useEffect(() => {
    if (externalTeamId) setSelectedTeam(externalTeamId);
  }, [externalTeamId]);

  // Handle initial update from notification
  useEffect(() => {
    if (initialUpdateId) {
      const fetchInitial = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          const res = await fetch(`/api/kb/team-updates/${initialUpdateId}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setInitialUpdate(data);
          }
        } catch (err) {
          console.error('Failed to fetch initial update:', err);
        } finally {
          setLoadingInitial(false);
        }
      };
      fetchInitial();
    }
  }, [initialUpdateId]);

  const handleTeamChange = (val: string) => {
    setSelectedTeam(val);
    onTeamChange?.(val);
  };

  const filteredUpdates = useMemo(() => {
    let list = [...updates];
    if (initialUpdate && !list.find(u => u.id === initialUpdate.id)) {
      list.unshift(initialUpdate);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u =>
        u.title.toLowerCase().includes(q) ||
        u.content.toLowerCase().includes(q)
      );
    }
    return list;
  }, [updates, initialUpdate, searchQuery]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filteredUpdates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUpdates.map((u) => u.id)));
    }
  }, [filteredUpdates, selectedIds.size]);

  const bulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/kb/team-updates/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          })
        )
      );

      toast.success('Updates deleted');
      setSelectedIds(new Set());
      setBulkMode(false);
      refetch();
    } catch {
      toast.error('Failed to bulk delete');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, refetch]);

  const handleEdit = (id: string) => {
    window.open(`/admin/updates/team-update/${id}/edit`, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this update?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`/api/kb/team-updates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Update deleted');
      refetch();
    } catch {
      toast.error('Failed to delete update');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 gap-4">
        {!externalTeamId && (
          <div className="flex-1 max-w-[240px]">
            <ThemedSelect
              value={selectedTeam}
              options={[
                { id: 'all', name: 'All Teams' },
                ...teams.map(t => ({ id: t.id, name: t.name }))
              ]}
              onChange={handleTeamChange}
              placeholder="Filter by team..."
            />
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded transition-colors ${bulkMode
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Bulk
            </button>
          </div>
        )}
      </div>

      {bulkMode && isAdmin && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-muted/50 border border-border rounded-xl transition-all animate-in slide-in-from-top-2">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            {selectedIds.size === filteredUpdates.length ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {selectedIds.size === filteredUpdates.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <button
            onClick={bulkDelete}
            disabled={selectedIds.size === 0 || bulkLoading}
            className="ml-auto flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive-hover transition-colors disabled:opacity-50 font-bold"
          >
            <Trash2 className="h-4 w-4" />
            Delete ({selectedIds.size})
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loadingInitial ? (
          <LoadingScreen fullScreen={false} message="Loading updates..." />
        ) : filteredUpdates.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            {searchQuery ? `No results found for "${searchQuery}"` : 'No team updates yet'}
          </div>
        ) : (
          filteredUpdates.map((update) => (
            <TeamUpdateCard
              key={update.id}
              update={update}
              onAcknowledge={() => acknowledge(update.id)}
              initialExpanded={update.id === initialUpdateId}
              isAdmin={isAdmin}
              onEdit={() => handleEdit(update.id)}
              onDelete={() => handleDelete(update.id)}
              showCheckbox={bulkMode}
              isSelected={selectedIds.has(update.id)}
              onSelectToggle={() => toggleSelect(update.id)}
              onShowStats={onShowStats}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TeamUpdateCard({
  update,
  onAcknowledge,
  initialExpanded = false,
  isAdmin,
  onEdit,
  onDelete,
  showCheckbox,
  isSelected,
  onSelectToggle,
  onShowStats,
}: {
  update: TeamUpdate;
  onAcknowledge: () => void;
  initialExpanded?: boolean;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onSelectToggle?: () => void;
  onShowStats?: (update: TeamUpdate) => void;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);

  useEffect(() => {
    if (initialExpanded) setExpanded(true);
  }, [initialExpanded]);

  const config = priorityConfig[update.priority] || priorityConfig.low;

  return (
    <div className={`bg-surface border border-border hover:bg-surface-hover rounded-lg p-5 transition-colors shadow-sm flex items-start gap-4`}>
      {showCheckbox && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelectToggle}
          className="mt-1.5 h-4 w-4 rounded border-border bg-background accent-primary shrink-0 cursor-pointer"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-2">
          <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${config.color.split(' ')[0]}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded border border-current ${config.color}`}>
                {config.label}
              </span>
              {update.target_product && (
                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-primary text-primary-foreground">
                  <Package className="h-3 w-3" />
                  {update.target_product.name}
                </span>
              )}
              {update.requires_acknowledgment && (
                <span className="text-xs text-amber-400">Requires acknowledgment</span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(update.published_at || update.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-foreground font-semibold text-base flex-1">{update.title}</h3>
              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                    className="text-[10px] text-primary hover:underline font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                    className="text-[10px] text-destructive hover:underline font-medium"
                  >
                    Delete
                  </button>
                  {onShowStats && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onShowStats(update); }}
                      className="text-[10px] text-emerald-500 hover:underline font-medium"
                    >
                      Stats
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {!update.is_acknowledged && update.requires_acknowledgment && (
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
          )}
        </div>

        <div className="text-foreground/70 text-sm mb-3 leading-relaxed transition-colors">
          {expanded ? (
            <div
              className="text-text-secondary rich-text-content"
              dangerouslySetInnerHTML={{ __html: update.content }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'IMG') {
                  const img = target as HTMLImageElement;
                  setLightboxImage({ src: img.src, alt: img.alt });
                }
              }}
            />
          ) : (
            <p className="line-clamp-2">{stripHtml(update.content)}</p>
          )}
        </div>

        {lightboxImage && (
          <ImageLightbox
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            onClose={() => setLightboxImage(null)}
          />
        )}

        {/* Meta info row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3 transition-colors">
          {update.team && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>
                {update.acknowledgment_count ?? 0}/{update.team.member_count ?? '?'} team members have read
              </span>
            </div>
          )}
          {update.effective_until && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {new Date(update.effective_until) > new Date() ? (
                  <>Effective until {new Date(update.effective_until).toLocaleDateString()}</>
                ) : (
                  <span className="text-amber-400">Expired on {new Date(update.effective_until).toLocaleDateString()}</span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border transition-colors">
          {update.requires_acknowledgment ? (
            update.is_acknowledged ? (
              <div className="flex items-center gap-2 text-primary-light text-sm">
                <Check className="h-4 w-4" />
                <span>Acknowledged</span>
              </div>
            ) : (
              <button
                onClick={onAcknowledge}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Square className="h-4 w-4" />
                <span>Acknowledge</span>
              </button>
            )
          ) : (
            <span />
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {expanded ? 'Show less' : 'Show more'}
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
