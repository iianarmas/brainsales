'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, Settings, ChevronDown } from 'lucide-react';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useAdmin } from '@/hooks/useAdmin';
import { useProduct } from '@/context/ProductContext';
import { UpdatesFeed } from './UpdatesFeed';
import { TeamUpdatesFeed } from './TeamUpdatesFeed';
import { CompetitiveIntelFeed } from './CompetitiveIntelFeed';

type Tab = 'product' | 'team' | 'competitive';

interface KnowledgeBasePageProps {
  initialUpdateId?: string;
  initialTab?: Tab;
}

export function KnowledgeBasePage({ initialUpdateId, initialTab }: KnowledgeBasePageProps = {}) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || 'product');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamId, setTeamId] = useState<string | undefined>();
  const { currentProduct, products } = useProduct();
  // Initialize from localStorage if available, otherwise default to current product
  const [viewProductId, setViewProductId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brainsales_kb_view_product_id');
      if (saved) return saved;
    }
    return currentProduct?.id;
  });

  // Update viewProductId when currentProduct changes IF we haven't set one yet
  // But also respect localStorage.
  useEffect(() => {
    if (currentProduct?.id && !viewProductId && typeof window !== 'undefined' && !localStorage.getItem('brainsales_kb_view_product_id')) {
      setViewProductId(currentProduct.id);
    }
  }, [currentProduct?.id, viewProductId]);

  // Persist selection
  const handleSetViewProduct = (id: string) => {
    setViewProductId(id);
    localStorage.setItem('brainsales_kb_view_product_id', id);
  };

  const { updates, categories, loading, filters, setFilters, refetch } = useKnowledgeBase({
    status: 'published',
  }, viewProductId);
  const { kb_updates: kbUnread, team_updates: teamUnread } = useUnreadCount();
  const { isAdmin } = useAdmin();

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setFilters((prev) => ({ ...prev, search: query || undefined }));
    },
    [setFilters]
  );

  const handleCategoryChange = useCallback(
    (slug: string | undefined) => {
      setFilters((prev) => ({ ...prev, category: slug }));
    },
    [setFilters]
  );

  const selectedProduct = products.find(p => p.id === viewProductId) || currentProduct;
  const productName = selectedProduct?.name || 'Product';
  const tabs: { id: Tab; label: string; unread: number }[] = [
    { id: 'product', label: `${productName} Updates`, unread: kbUnread },
    { id: 'competitive', label: 'Competitive Intel', unread: 0 },
    { id: 'team', label: 'Team Updates', unread: teamUnread },
  ];

  return (
    <div className="h-full flex flex-col bg-white text-primary">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-primary-light/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold mb-1">Knowledge Base</h1>
            {isAdmin && products.length > 0 && (
              <div className="relative inline-block text-left">
                <select
                  value={viewProductId || ''}
                  onChange={(e) => handleSetViewProduct(e.target.value)}
                  className="appearance-none bg-primary-light/10 hover:bg-primary-light/20 text-primary text-sm font-medium pl-3 pr-8 py-1 rounded-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-light transition-colors"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      View: {p.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-primary">
                  <ChevronDown className="h-3 w-3" />
                </div>
              </div>
            )}
          </div>
          {isAdmin && (
            <a
              href="/admin/knowledge-base"
              target="_blank"
              className="flex items-center gap-1.5 text-sm text-primary-light/50 hover:text-primary transition-colors shrink-0 ml-4"
            >
              <Settings className="h-4 w-4" />
              Admin Dashboard
            </a>
          )}
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search updates..."
            className="w-full bg-white border border-primary-light/20 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-500 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id
                ? 'text-primary'
                : 'text-gray-400 hover:text-white hover:bg-primary-light'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6 relative">
        <div className={`h-full ${activeTab !== 'product' ? 'hidden' : ''}`}>
          <UpdatesFeed
            updates={updates}
            loading={loading}
            categories={categories}
            onCategoryChange={handleCategoryChange}
            onSearch={handleSearch}
            selectedCategory={filters.category}
            isAdmin={isAdmin}
            onRefetch={refetch}
            initialUpdateId={initialUpdateId}
          />
        </div>

        <div className={`h-full ${activeTab !== 'team' ? 'hidden' : ''}`}>
          <TeamUpdatesFeed
            teamId={teamId}
            onTeamChange={setTeamId}
            initialUpdateId={initialUpdateId}
          />
        </div>

        <div className={`h-full ${activeTab !== 'competitive' ? 'hidden' : ''}`}>
          <CompetitiveIntelFeed
            isAdmin={isAdmin}
            onRefetch={refetch}
            productId={viewProductId}
          />
        </div>
      </div>

    </div>
  );
}
