'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Save, GripVertical, ChevronUp, ChevronDown, X, Tag } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { toast } from 'sonner';
import * as LucideIcons from 'lucide-react';
import { LucideIconPicker } from '@/components/LucideIconPicker';

interface Category {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  sort_order: number;
}

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/kb/categories', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to load categories');
      const data = await res.json();
      setCategories(data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/kb/categories', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: categories.map((c, i) => ({ ...c, sort_order: i })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setCategories(data.data || []);
      setHasChanges(false);
      toast.success('Categories saved successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save categories');
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const addCategory = () => {
    setCategories([...categories, {
      name: 'New Category',
      slug: `new-category-${Date.now()}`,
      icon: 'circle',
      sort_order: categories.length,
    }]);
    setHasChanges(true);
  };

  const removeCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateCategory = (index: number, field: keyof Category, value: string) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-generate slug from name
    if (field === 'name') {
      updated[index].slug = generateSlug(value);
    }
    setCategories(updated);
    setHasChanges(true);
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const updated = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    setCategories(updated);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="bg-white border border-primary-light/30 rounded-xl p-6 shadow-lg">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-100 rounded w-48" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-primary-light/30 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary-light/50" />
          Update Categories
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={addCategory}
            className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <span className="animate-spin">...</span> : <Save className="h-4 w-4" />}
              Save
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Manage the category pills shown in the Product Updates tab. Changes are saved when you click Save.
      </p>

      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No categories yet. Click &quot;Add&quot; to create one.</p>
        ) : (
          categories.map((cat, index) => (
            <div key={cat.id || index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 group">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveCategory(index, 'up')}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-primary disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <GripVertical className="h-3.5 w-3.5 text-gray-300" />
                <button
                  onClick={() => moveCategory(index, 'down')}
                  disabled={index === categories.length - 1}
                  className="text-gray-400 hover:text-primary disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Fields */}
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Name</label>
                  <input
                    value={cat.name}
                    onChange={(e) => updateCategory(index, 'name', e.target.value)}
                    className="w-full text-sm bg-white px-2 py-1 rounded border border-gray-300 focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Slug</label>
                  <input
                    value={cat.slug}
                    onChange={(e) => updateCategory(index, 'slug', e.target.value)}
                    className="w-full text-sm bg-white px-2 py-1 rounded border border-gray-300 focus:border-primary focus:outline-none font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Icon (Lucide)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={cat.icon || ''}
                      onChange={(e) => updateCategory(index, 'icon', e.target.value)}
                      className="w-full text-sm bg-white px-2 py-1 rounded border border-gray-300 focus:border-primary focus:outline-none text-xs"
                      placeholder="e.g. rocket"
                    />
                    <LucideIconPicker
                      value={cat.icon || ''}
                      onChange={(name) => updateCategory(index, 'icon', name)}
                      lowercase
                    />
                  </div>
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => removeCategory(index)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove Category"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
