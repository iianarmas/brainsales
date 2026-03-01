'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';
import { useProduct } from '@/context/ProductContext';
import { UpdatesFeed } from '../UpdatesFeed';
import { ThemedSelect } from '@/components/ThemedSelect';

export function ProductUpdatesManager({ onShowStats }: { onShowStats?: (update: any) => void }) {
    const { products, currentProduct, setCurrentProduct } = useProduct();
    const [localSearch, setLocalSearch] = useState('');
    const { updates, loading, categories, setFilters, refetch, filters } = useKnowledgeBase({}, currentProduct?.id);

    const setCategory = (category: string | undefined) => {
        setFilters(prev => ({ ...prev, category }));
    };

    const setSearch = (search: string) => {
        setFilters(prev => ({ ...prev, search }));
    };

    const handleSearch = (val: string) => {
        setLocalSearch(val);
        setSearch(val);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Manage Product</label>
                    <ThemedSelect
                        value={currentProduct?.id || ''}
                        options={products.map(p => ({ id: p.id, name: p.name }))}
                        onChange={setCurrentProduct}
                        placeholder="Choose a product..."
                        className="w-full"
                    />
                </div>
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={localSearch}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Search updates..."
                        className="w-full bg-surface border border-border-subtle rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                </div>
            </div>

            <div className="bg-surface rounded-2xl border border-border-subtle overflow-hidden">
                <div className="p-4 border-b border-border-subtle bg-surface-active/30">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Live Feed</h3>
                </div>
                <div className="p-4 max-h-[800px] overflow-y-auto custom-scrollbar">
                    <UpdatesFeed
                        updates={updates}
                        loading={loading}
                        categories={categories}
                        onCategoryChange={setCategory}
                        onSearch={setSearch}
                        selectedCategory={filters.category}
                        isAdmin={true}
                        onRefetch={refetch}
                        onShowStats={onShowStats}
                    />
                </div>
            </div>
        </div>
    );
}
