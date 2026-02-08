'use client';

import { useState, useEffect, useMemo } from 'react';
import { Check, Square, ChevronDown, Users, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabaseClient';
import { useTeamUpdates } from '@/hooks/useTeamUpdates';
import type { TeamUpdate } from '@/types/knowledgeBase';
import { ImageLightbox } from './ImageLightbox';
import { LoadingScreen } from '@/components/LoadingScreen';

const priorityConfig: Record<string, { color: string; border: string; label: string }> = {
  urgent: { color: 'bg-red-500', border: 'border-primary-light/50', label: 'Urgent' },
  high: { color: 'bg-yellow-500', border: 'border-primary-light/50', label: 'High' },
  medium: { color: 'bg-blue-500', border: 'border-primary-light/50', label: 'Medium' },
  low: { color: 'bg-gray-500', border: 'border-primary-light/50', label: 'Low' },
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
}

export function TeamUpdatesFeed({ teamId: externalTeamId, onTeamChange, initialUpdateId, searchQuery = '' }: TeamUpdatesFeedProps) {
  const { teams } = useTeamUpdates(); // We don't need products anymore

  // Default selection logic:
  // 1. External team ID if provided
  // 2. 'all' if showing a specific update (initially)
  // 3. Fallback to empty (all/none)
  const getDefaultSelection = () => {
    if (externalTeamId) return externalTeamId;
    if (initialUpdateId) return 'all';

    // Try localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brainsales_team_updates_selection');
      if (saved) return saved;
    }

    return 'all';
  };

  const [selectedTeam, setSelectedTeam] = useState(getDefaultSelection());
  const [initialUpdate, setInitialUpdate] = useState<TeamUpdate | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(!!initialUpdateId);

  const activeSelection = externalTeamId ?? selectedTeam;

  // If it's a team selection, we pass the team ID.
  // If it's 'all', we pass 'all'.
  const effectiveTeamId = activeSelection;

  const { updates, loading, acknowledge } = useTeamUpdates(effectiveTeamId);

  // Update selection when currentProduct changes IF user hasn't manually selected something else
  // and we are in a "default" state. 
  // Actually, simpler: just let user select. But initialize correctly.

  // Fetch the initial update directly if provided (for notification clicks)
  useEffect(() => {
    if (!initialUpdateId) {
      setLoadingInitial(false);
      setInitialUpdate(null);
      return;
    }

    let cancelled = false;
    setLoadingInitial(true);
    setInitialUpdate(null); // Reset before fetching new one

    async function fetchInitialUpdate() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('TeamUpdatesFeed: No session available');
          return;
        }
        if (cancelled) return;

        const res = await fetch(`/api/kb/team-updates/${initialUpdateId}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (cancelled) return;

        if (!res.ok) {
          console.warn('TeamUpdatesFeed: Failed to fetch update', res.status);
          return;
        }

        const json = await res.json();
        const update = json.data || json;

        if (cancelled) return;

        if (update && update.id) {
          setInitialUpdate(update);
        } else {
          console.warn('TeamUpdatesFeed: Invalid update data', json);
        }
      } catch (err) {
        console.error('TeamUpdatesFeed: Error fetching initial update', err);
      } finally {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      }
    }

    fetchInitialUpdate();

    return () => {
      cancelled = true;
    };
  }, [initialUpdateId]); // Only re-fetch when initialUpdateId changes

  // Only set specific team if not already showing all teams
  // (This allows users to stay on "All Teams" view when coming from notifications)
  useEffect(() => {
    if (initialUpdate?.team_id && selectedTeam !== 'all' && !selectedTeam) {
      setSelectedTeam(initialUpdate.team_id);
    }
  }, [initialUpdate?.team_id, selectedTeam]);

  // Notify parent of team change
  useEffect(() => {
    if (selectedTeam && onTeamChange) {
      onTeamChange(selectedTeam);
    }
  }, [selectedTeam, onTeamChange]);

  // Combine initial update with team updates, avoiding duplicates
  const allUpdates = initialUpdate
    ? [initialUpdate, ...updates.filter(u => u.id !== initialUpdate.id)]
    : updates;

  // Sort updates with initialUpdateId at the top if provided
  const sortedUpdates = [...allUpdates].sort((a, b) => {
    if (initialUpdateId) {
      if (a.id === initialUpdateId) return -1;
      if (b.id === initialUpdateId) return 1;
    }
    // Default sort by published date descending
    const da = new Date(a.published_at || a.created_at).getTime();
    const db = new Date(b.published_at || b.created_at).getTime();
    return db - da;
  });

  // Client-side search filtering
  const lowerQuery = searchQuery.trim().toLowerCase();
  const filteredUpdates = useMemo(() => {
    if (!lowerQuery) return sortedUpdates;
    return sortedUpdates.filter((u) => {
      const searchText = `${u.title} ${stripHtml(u.content || '')}`.toLowerCase();
      return searchText.includes(lowerQuery);
    });
  }, [sortedUpdates, lowerQuery]);

  const handleTeamChange = (id: string) => {
    setSelectedTeam(id);
    localStorage.setItem('brainsales_team_updates_selection', id);
    onTeamChange?.(id);
  };

  const handleAcknowledge = async (updateId: string) => {
    try {
      await acknowledge(updateId);
      // Also update the initialUpdate if it matches
      if (initialUpdate && initialUpdate.id === updateId) {
        setInitialUpdate({ ...initialUpdate, is_acknowledged: true });
      }
      toast.success('Team update acknowledged');
    } catch {
      toast.error('Failed to acknowledge');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Team selector */}
      {teams.length > 0 && (
        <div className="mb-4">
          <select
            value={activeSelection}
            onChange={(e) => handleTeamChange(e.target.value)}
            className="w-full bg-white border border-primary-light/50 text-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select a view...</option>
            <option value="all">All Updates</option>

            {teams.length > 0 && (
              <optgroup label="Teams">
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {/* Updates list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loadingInitial ? (
          <LoadingScreen fullScreen={false} message="Loading updates..." />
        ) : !activeSelection && !initialUpdate ? (
          <div className="text-center text-gray-500 py-16">Select a team or product to view updates</div>
        ) : loading && filteredUpdates.length === 0 ? (
          <LoadingScreen fullScreen={false} message="Loading updates..." />
        ) : filteredUpdates.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            {lowerQuery ? `No results found for "${searchQuery.trim()}"` : 'No team updates yet'}
          </div>
        ) : (
          filteredUpdates.map((update) => (
            <TeamUpdateCard
              key={update.id}
              update={update}
              onAcknowledge={() => handleAcknowledge(update.id)}
              initialExpanded={update.id === initialUpdateId}
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
}: {
  update: TeamUpdate;
  onAcknowledge: () => void;
  initialExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);

  // Sync expanded state if initialExpanded changes
  useEffect(() => {
    if (initialExpanded) setExpanded(true);
  }, [initialExpanded]);

  const config = priorityConfig[update.priority] || priorityConfig.low;

  return (
    <div className={`bg-white border ${config.border} hover:bg-primary-light/10 rounded-lg p-5 transition-colors`}>
      {/* Header row */}
      <div className="flex items-start gap-3 mb-2">
        <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${config.color} text-white`}>
              {config.label}
            </span>
            {/* Product Label */}
            {update.target_product && (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-purple-600 text-white">
                <Package className="h-3 w-3" />
                {update.target_product.name}
              </span>
            )}
            {update.requires_acknowledgment && (
              <span className="text-xs text-amber-400">Requires acknowledgment</span>
            )}
            <span className="text-xs text-gray-500 ml-auto">
              {new Date(update.published_at || update.created_at).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-primary font-semibold text-base">{update.title}</h3>
        </div>

        {/* Unread dot */}
        {!update.is_acknowledged && update.requires_acknowledgment && (
          <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
        )}
      </div>

      {/* Content */}
      <div className="text-gray-500 text-sm mb-3 leading-relaxed">
        {expanded ? (
          <div
            className="text-gray-600 rich-text-content"
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-primary mb-3">
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

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-primary-light/20">
        {update.requires_acknowledgment ? (
          update.is_acknowledged ? (
            <div className="flex items-center gap-2 text-primary-light text-sm">
              <Check className="h-4 w-4" />
              <span>Acknowledged</span>
            </div>
          ) : (
            <button
              onClick={onAcknowledge}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary-light transition-colors"
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
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-light transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
