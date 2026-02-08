import { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, Plus } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useProduct } from '@/context/ProductContext';
import { useKbStore } from '@/store/useKbStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { CompetitorCard } from './CompetitorCard';
import { UpdateCard } from './UpdateCard';
import type { Competitor } from '@/types/competitor';
import type { KBUpdate } from '@/types/knowledgeBase';

interface CompetitiveIntelFeedProps {
  isAdmin?: boolean;
  onRefetch?: () => void;
  productId?: string;
  searchQuery?: string;
}

export function CompetitiveIntelFeed({ isAdmin, onRefetch, productId, searchQuery = '' }: CompetitiveIntelFeedProps) {
  const { currentProduct } = useProduct();
  const targetProductId = productId || currentProduct?.id;

  const {
    competitors: cachedCompetitorsMap,
    competitiveUpdates: cachedUpdatesMap,
    setCompetitiveIntel,
    lastFetchedCompetitiveIntel
  } = useKbStore();

  const [loading, setLoading] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<KBUpdate | null>(null);

  const competitors = useMemo(() => targetProductId ? cachedCompetitorsMap[targetProductId] || [] : [], [cachedCompetitorsMap, targetProductId]);
  const competitiveUpdates = useMemo(() => targetProductId ? cachedUpdatesMap[targetProductId] || [] : [], [cachedUpdatesMap, targetProductId]);

  const fetchData = useCallback(async () => {
    if (!targetProductId) return;

    // Only show loading if we have no data
    if (competitors.length === 0 && competitiveUpdates.length === 0) {
      setLoading(true);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session.access_token}`,
        'X-Product-Id': targetProductId,
      };

      // Fetch competitors and competitive updates in parallel
      const [competitorsRes, updatesRes] = await Promise.all([
        fetch(`/api/competitors?product_id=${targetProductId}`, { headers }),
        fetch('/api/kb/updates?category=competitive&status=published', { headers }),
      ]);

      let newCompetitors: Competitor[] = competitors;
      let newUpdates: KBUpdate[] = competitiveUpdates;

      if (competitorsRes.ok) {
        const json = await competitorsRes.json();
        newCompetitors = json.data || [];
      }

      if (updatesRes.ok) {
        const json = await updatesRes.json();
        newUpdates = json.data || [];
      }

      setCompetitiveIntel(targetProductId, newCompetitors, newUpdates);
    } catch (err) {
      console.error('Error fetching competitive intel:', err);
    } finally {
      setLoading(false);
    }
  }, [targetProductId, competitors.length, competitiveUpdates.length, setCompetitiveIntel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  // Client-side search filtering
  const lowerQuery = searchQuery.trim().toLowerCase();

  const filteredCompetitors = useMemo(() => {
    if (!lowerQuery) return competitors;
    return competitors.filter((c) => {
      const searchText = [
        c.name,
        c.our_advantage,
        c.positioning,
        c.target_market,
        c.pricing_info,
        ...(c.strengths || []),
        ...(c.limitations || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchText.includes(lowerQuery);
    });
  }, [competitors, lowerQuery]);

  const filteredUpdates = useMemo(() => {
    if (!lowerQuery) return competitiveUpdates;
    return competitiveUpdates.filter((u) => {
      const searchText = `${u.title} ${u.content || ''} ${u.summary || ''}`.toLowerCase();
      return searchText.includes(lowerQuery);
    });
  }, [competitiveUpdates, lowerQuery]);

  // Group updates by competitor_id
  const updatesByCompetitor = filteredUpdates.reduce((acc, update) => {
    const competitorId = update.competitor_id || 'unassigned';
    if (!acc[competitorId]) {
      acc[competitorId] = [];
    }
    acc[competitorId].push(update);
    return acc;
  }, {} as Record<string, KBUpdate[]>);

  // Updates not linked to any competitor
  const unassignedUpdates = updatesByCompetitor['unassigned'] || [];

  const handleUpdateClick = (update: KBUpdate) => {
    setSelectedUpdate(update);
  };

  const handleCloseUpdate = () => {
    setSelectedUpdate(null);
  };

  if (loading) {
    return <LoadingScreen fullScreen={false} message="Loading..." />;
  }

  if (!targetProductId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please select a product to view competitive intelligence.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Admin Actions */}
      {isAdmin && (
        <div className="flex items-center gap-3 mb-6">
          <a
            href="/admin/knowledge-base/competitors/new"
            className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Competitor
          </a>
        </div>
      )}

      {/* Selected Update Modal */}
      {selectedUpdate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <UpdateCard
                update={selectedUpdate}
                isAdmin={isAdmin}
                onAcknowledge={() => {
                  fetchData();
                  onRefetch?.();
                }}
                initialExpanded={true}
              />
              <button
                onClick={handleCloseUpdate}
                className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Competitors List */}
      {lowerQuery && filteredCompetitors.length === 0 && filteredUpdates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No results found for &quot;{searchQuery.trim()}&quot;</p>
        </div>
      ) : competitors.length === 0 && competitiveUpdates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No competitive intelligence yet.</p>
          <p className="text-sm text-gray-400">
            {isAdmin ? (
              <>
                <a href="/admin/knowledge-base/competitors/new" className="text-primary hover:underline">
                  Add your first competitor
                </a>{' '}
                to start tracking competitive intel.
              </>
            ) : (
              'Check back later for competitive insights.'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Competitors with their updates */}
          {filteredCompetitors.map((competitor) => (
            <CompetitorCard
              key={competitor.id}
              competitor={competitor}
              updates={updatesByCompetitor[competitor.id] || []}
              onUpdateClick={handleUpdateClick}
            />
          ))}

          {/* Unassigned competitive updates */}
          {unassignedUpdates.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">General Competitive Updates</h3>
              <div className="space-y-3">
                {unassignedUpdates.map((update) => (
                  <UpdateCard
                    key={update.id}
                    update={update}
                    isAdmin={isAdmin}
                    onAcknowledge={() => {
                      fetchData();
                      onRefetch?.();
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
