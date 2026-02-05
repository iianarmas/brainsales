'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useProduct } from '@/context/ProductContext';
import { CompetitorCard } from './CompetitorCard';
import { UpdateCard } from './UpdateCard';
import type { Competitor } from '@/types/competitor';
import type { KBUpdate } from '@/types/knowledgeBase';

interface CompetitiveIntelFeedProps {
  isAdmin?: boolean;
  onRefetch?: () => void;
  productId?: string;
}

export function CompetitiveIntelFeed({ isAdmin, onRefetch, productId }: CompetitiveIntelFeedProps) {
  const { currentProduct } = useProduct();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitiveUpdates, setCompetitiveUpdates] = useState<KBUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpdate, setSelectedUpdate] = useState<KBUpdate | null>(null);

  // Use provided productId prop, fall back to currentProduct
  const targetProductId = productId || currentProduct?.id;

  const fetchData = useCallback(async () => {
    if (!targetProductId) {
      setLoading(false);
      return;
    }

    setLoading(true);
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

      if (competitorsRes.ok) {
        const json = await competitorsRes.json();
        setCompetitors(json.data || []);
      }

      if (updatesRes.ok) {
        const json = await updatesRes.json();
        setCompetitiveUpdates(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching competitive intel:', err);
    } finally {
      setLoading(false);
    }
  }, [targetProductId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group updates by competitor_id
  const updatesByCompetitor = competitiveUpdates.reduce((acc, update) => {
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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
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
                onRefetch={() => {
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
      {competitors.length === 0 && competitiveUpdates.length === 0 ? (
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
          {competitors.map((competitor) => (
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
                    onRefetch={() => {
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
