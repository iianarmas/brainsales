'use client';

import { useState, useCallback } from 'react';
import { Search, Settings } from 'lucide-react';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useAdmin } from '@/hooks/useAdmin';
import { UpdatesFeed } from './UpdatesFeed';
import { TeamUpdatesFeed } from './TeamUpdatesFeed';
import { UnreadBadge } from './UnreadBadge';

type Tab = 'dexit' | 'team';

interface KnowledgeBasePageProps {
  initialUpdateId?: string;
  initialTab?: Tab;
}

export function KnowledgeBasePage({ initialUpdateId, initialTab }: KnowledgeBasePageProps = {}) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || 'dexit');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamId, setTeamId] = useState<string | undefined>();

  const { updates, categories, loading, filters, setFilters, refetch } = useKnowledgeBase({
    status: 'published',
  });
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

  const tabs: { id: Tab; label: string; unread: number }[] = [
    { id: 'dexit', label: 'Dexit Updates', unread: kbUnread },
    { id: 'team', label: 'Team Updates', unread: teamUnread },
  ];

  return (
    <div className="h-full flex flex-col bg-white text-primary">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-primary-light/20">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          {isAdmin && (
            <a
              href="/admin/knowledge-base"
              target="_blank"
              className="flex items-center gap-1.5 text-sm text-primary-light/50 hover:text-primary transition-colors"
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
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
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
      <div className="flex-1 overflow-hidden p-6">
        {activeTab === 'dexit' ? (
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
        ) : (
          <TeamUpdatesFeed
            teamId={teamId}
            onTeamChange={setTeamId}
            initialUpdateId={initialUpdateId}
          />
        )}
      </div>
    </div>
  );
}
