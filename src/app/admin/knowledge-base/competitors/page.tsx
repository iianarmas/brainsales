'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useCompetitors } from '@/hooks/useCompetitors';
import { useProduct } from '@/context/ProductContext';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Plus, Building2, ExternalLink, Edit, Trash2, ChevronDown, ArrowLeft } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { toast } from 'sonner';
import { useConfirmModal } from '@/components/ConfirmModal';
import type { Competitor } from '@/types/competitor';

export default function CompetitorsAdminRoute() {
  const { confirm: confirmModal } = useConfirmModal();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { products, currentProduct } = useProduct();
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(currentProduct?.id);
  const { competitors, loading: competitorsLoading, refetch } = useCompetitors({
    product_id: selectedProductId,
  });

  const handleDelete = async (competitor: Competitor) => {
    const confirmed = await confirmModal({
      title: "Archive Competitor",
      message: `Are you sure you want to archive "${competitor.name}"?`,
      confirmLabel: "Archive",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/competitors/${competitor.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to archive');
      }

      toast.success('Competitor archived');
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to archive competitor';
      toast.error(message);
    }
  };

  if (loading || adminLoading) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-primary">
      <p>Access denied. Admin only.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/knowledge-base"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-gray-800">Manage Competitors</h1>
            </div>
          </div>
          <Link
            href="/admin/knowledge-base/competitors/new"
            className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Competitor
          </Link>
        </div>

        {/* Product Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-2">Filter by Product</label>
          <div className="relative inline-block">
            <select
              value={selectedProductId || ''}
              onChange={(e) => setSelectedProductId(e.target.value || undefined)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Competitors List */}
        {competitorsLoading ? (
          <div className="text-center py-12 text-gray-500">Loading competitors...</div>
        ) : competitors.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No competitors found for this product.</p>
            <Link
              href="/admin/knowledge-base/competitors/new"
              className="text-primary hover:underline text-sm"
            >
              Add your first competitor
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {competitors.map((competitor) => (
              <div
                key={competitor.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {competitor.logo_url ? (
                      <img
                        src={competitor.logo_url}
                        alt={competitor.name}
                        className="w-12 h-12 rounded-lg object-cover bg-gray-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800">{competitor.name}</h3>
                        {competitor.website && (
                          <a
                            href={competitor.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-primary transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      {competitor.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {competitor.description}
                        </p>
                      )}
                      <div className="flex gap-4 mt-3 text-xs text-gray-400">
                        {competitor.strengths.length > 0 && (
                          <span>{competitor.strengths.length} strengths</span>
                        )}
                        {competitor.limitations.length > 0 && (
                          <span>{competitor.limitations.length} limitations</span>
                        )}
                        {competitor.our_advantage && (
                          <span className="text-green-600">Has advantage defined</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/knowledge-base/competitors/${competitor.id}/edit`}
                      className="p-2 text-gray-400 hover:text-primary transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(competitor)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
