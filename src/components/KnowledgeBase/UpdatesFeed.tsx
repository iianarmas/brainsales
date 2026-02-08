'use client';

import { useState, useCallback } from 'react';
import { ArrowUpDown, CheckSquare, Square, Trash2, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmModal } from '@/components/ConfirmModal';
import { supabase } from '@/app/lib/supabaseClient';
import type { KBUpdate, KBCategory } from '@/types/knowledgeBase';
import { UpdateCard } from './UpdateCard';
import { LoadingScreen } from '@/components/LoadingScreen';

interface UpdatesFeedProps {
  updates: KBUpdate[];
  loading: boolean;
  categories: KBCategory[];
  onCategoryChange: (slug: string | undefined) => void;
  onSearch: (query: string) => void;
  selectedCategory?: string;
  isAdmin?: boolean;
  onRefetch?: () => void;
  initialUpdateId?: string;
}

export function UpdatesFeed({
  updates,
  loading,
  categories,
  onCategoryChange,
  onSearch,
  selectedCategory,
  isAdmin,
  onRefetch,
  initialUpdateId,
}: UpdatesFeedProps) {
  const { confirm: confirmModal } = useConfirmModal();
  const [sortNewest, setSortNewest] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Sort updates with special handling for highlighted update from notification click
  const sorted = [...updates].sort((a, b) => {
    // If there's an initialUpdateId (from notification click), always put it at the top
    if (initialUpdateId) {
      if (a.id === initialUpdateId) return -1;
      if (b.id === initialUpdateId) return 1;
    }
    // Normal date-based sorting
    const da = new Date(a.published_at || a.created_at).getTime();
    const db = new Date(b.published_at || b.created_at).getTime();
    return sortNewest ? db - da : da - db;
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((u) => u.id)));
    }
  }, [sorted, selectedIds.size]);

  const bulkAcknowledge = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/kb/updates/${id}/acknowledge`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          })
        )
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      toast.success(`Acknowledged ${succeeded} update${succeeded !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      setBulkMode(false);
      onRefetch?.();
    } catch {
      toast.error('Failed to bulk acknowledge');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, onRefetch]);

  const bulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await confirmModal({
      title: "Delete Updates",
      message: `Delete ${selectedIds.size} update(s)? This will archive them.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    setBulkLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/kb/updates/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          })
        )
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      toast.success(`Deleted ${succeeded} update${succeeded !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      setBulkMode(false);
      onRefetch?.();
    } catch {
      toast.error('Failed to bulk delete');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, onRefetch, confirmModal]);

  const handleEdit = useCallback((update: KBUpdate) => {
    window.open(`/admin/knowledge-base/${update.id}/edit`, '_blank');
  }, []);

  const handleDelete = useCallback(async (update: KBUpdate) => {
    const confirmed = await confirmModal({
      title: "Delete Update",
      message: `Delete "${update.title}"? This will archive it.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`/api/kb/updates/${update.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Update deleted');
      onRefetch?.();
    } catch {
      toast.error('Failed to delete update');
    }
  }, [onRefetch, confirmModal]);

  return (
    <div className="flex flex-col h-full">
      {/* Category pills + sort + bulk actions */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => onCategoryChange(undefined)}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${!selectedCategory
              ? 'bg-primary-light text-white'
              : 'border border-1 border-primary-light text-primary-light hover:text-white hover:bg-primary'
            }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.slug)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${selectedCategory === cat.slug
                ? 'bg-primary-light text-white'
                : 'border border-1 border-primary-light text-primary-light hover:text-white hover:bg-primary'
              }`}
          >
            {cat.name}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {/* Bulk mode toggle */}
          <button
            onClick={() => {
              setBulkMode(!bulkMode);
              setSelectedIds(new Set());
            }}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded transition-colors ${bulkMode
                ? 'bg-primary-light text-white hover:bg-primary'
                : 'text-gray-400 hover:text-white hover:bg-primary'
              }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Bulk
          </button>

          {isAdmin && (
            <a
              href="/admin/knowledge-base/new"
              target="_blank"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-primary-light hover:bg-primary text-white transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Update
            </a>
          )}

          <button
            onClick={() => setSortNewest(!sortNewest)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortNewest ? 'Newest' : 'Oldest'}
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-white border border-primary-light/50 rounded-lg">
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors"
          >
            {selectedIds.size === sorted.length ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {selectedIds.size === sorted.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs text-gray-500">
            {selectedIds.size} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={bulkAcknowledge}
              disabled={selectedIds.size === 0 || bulkLoading}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-primary-light hover:bg-primary-light text-primary hover:text-white transition-colors disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              Acknowledge ({selectedIds.size})
            </button>
            {isAdmin && (
              <button
                onClick={bulkDelete}
                disabled={selectedIds.size === 0 || bulkLoading}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-primary-light hover:bg-primary-light text-primary hover:text-white transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Delete ({selectedIds.size})
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loading && sorted.length === 0 ? (
          <LoadingScreen fullScreen={false} message="Loading updates..." />
        ) : sorted.length === 0 ? (
          <div className="text-center text-primary py-16">No updates found</div>
        ) : (
          sorted.map((update) => (
            <UpdateCard
              key={update.id}
              update={update}
              showCheckbox={bulkMode}
              isSelected={selectedIds.has(update.id)}
              onSelectToggle={() => toggleSelect(update.id)}
              onAcknowledge={onRefetch}
              isAdmin={isAdmin}
              onEdit={isAdmin ? handleEdit : undefined}
              onDelete={isAdmin ? handleDelete : undefined}
              initialExpanded={update.id === initialUpdateId}
            />
          ))
        )}
      </div>
    </div>
  );
}
