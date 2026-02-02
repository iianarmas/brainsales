'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff, Save, Loader2, Globe, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabaseClient';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useProduct } from '@/context/ProductContext';
import type {
  KBUpdate,
  KBCategory,
  UpdateStatus,
  Priority,
  CreateUpdatePayload,
} from '@/types/knowledgeBase';

interface UpdateFormProps {
  existingUpdate?: KBUpdate;
}

const statusOptions: UpdateStatus[] = ['draft', 'review', 'published'];
const priorityOptions: Priority[] = ['low', 'medium', 'high', 'urgent'];



export function UpdateForm({ existingUpdate }: UpdateFormProps) {
  const isEdit = !!existingUpdate;
  const { currentProduct } = useProduct();
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);


  const [form, setForm] = useState({
    title: existingUpdate?.title ?? '',
    category_slug: existingUpdate?.category?.slug ?? '',
    content: existingUpdate?.content ?? '',
    summary: existingUpdate?.summary ?? '',
    tagsInput: existingUpdate?.tags?.join(', ') ?? '',
    version: existingUpdate?.version ?? '',
    priority: (existingUpdate?.priority ?? 'medium') as Priority,
    status: (existingUpdate?.status ?? 'draft') as UpdateStatus,
    publish_at: existingUpdate?.publish_at ?? '',
    features: existingUpdate?.features?.map((f) => ({ name: f.name, description: f.description || '' })) ?? [],
    target_product_id: '',
  });

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Load categories and products in parallel
        const [categoriesRes, productsRes] = await Promise.all([
          fetch('/api/kb/categories', {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          }),
          fetch('/api/products', {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          }),
        ]);

        if (categoriesRes.ok) {
          const json = await categoriesRes.json();
          setCategories(json.data || json);
        }

        if (productsRes.ok) {
          const json = await productsRes.json();
          setProducts(json.products || []);
        }
      } catch { /* silent */ }
    }
    loadData();
  }, []);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addFeature = () => setField('features', [...form.features, { name: '', description: '' }]);
  const removeFeature = (i: number) =>
    setField('features', form.features.filter((_, idx) => idx !== i));
  const updateFeature = (i: number, key: 'name' | 'description', value: string) =>
    setField(
      'features',
      form.features.map((f, idx) => (idx === i ? { ...f, [key]: value } : f))
    );

  const tags = form.tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.category_slug) {
      toast.error('Title and category are required');
      return;
    }
    if (!form.target_product_id) {
      toast.error('Please select a product');
      return;
    }
    setSaving(true);

    const payload: CreateUpdatePayload = {
      title: form.title,
      category_slug: form.category_slug,
      content: form.content,
      summary: form.summary || undefined,
      tags: tags.length ? tags : undefined,
      version: form.version || undefined,
      priority: form.priority,
      status: form.status,
      publish_at: form.publish_at || undefined,
      features: form.features.filter((f) => f.name.trim()).map((f) => ({
        name: f.name,
        description: f.description || undefined,
      })),
      target_product_id: form.target_product_id,
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const url = isEdit ? `/api/kb/updates/${existingUpdate.id}` : '/api/kb/updates';
      const method = isEdit ? 'PUT' : 'POST';
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };
      if (currentProduct?.id) {
        headers['X-Product-Id'] = currentProduct.id;
      }
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ ...payload, product_id: form.target_product_id || currentProduct?.id }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save');
      }
      toast.success(isEdit ? 'Update saved' : 'Update created');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save update';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-gray-500 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-sm font-medium text-gray-600 mb-1';

  return (
    <div className="h-full overflow-y-auto bg-white border border-primary-light/20 shadow-xl rounded-xl text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl text-primary font-bold">{isEdit ? 'Edit Update' : 'New Update'}</h1>
          <button
            onClick={() => setPreview(!preview)}
            className="flex items-center gap-2 text-sm text-primary-light/50 hover:text-primary-light transition-colors"
          >
            {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {preview ? (
          <div className="bg-white border border-primary-light/50 rounded-lg p-6 space-y-4">
            <h2 className="text-xl text-gray-600 font-bold">{form.title || 'Untitled'}</h2>
            {form.summary && <p className="text-gray-500 text-sm">{form.summary}</p>}
            <div
              className="prose prose-invert prose-sm max-w-none text-gray-500"
              dangerouslySetInnerHTML={{ __html: form.content || '<p>No content</p>' }}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {form.features.filter((f) => f.name).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase">Features</p>
                {form.features
                  .filter((f) => f.name)
                  .map((f, i) => (
                    <div key={i} className="text-sm text-gray-300 pl-3 border-l-2 border-gray-700">
                      <span className="font-medium text-white">{f.name}</span>
                      {f.description && <span className="text-gray-400"> - {f.description}</span>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Product Selector */}
            <div>
              <label className={labelCls}>Product</label>
              <select
                value={form.target_product_id}
                onChange={(e) => setField('target_product_id', e.target.value)}
                className={inputCls}
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Updates must be targeted to a specific product.
              </p>
            </div>

            {/* Title */}
            <div>
              <label className={labelCls}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                className={inputCls}
                placeholder="Update title"
              />
            </div>

            {/* Category + Priority row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Category</label>
                <select
                  value={form.category_slug}
                  onChange={(e) => setField('category_slug', e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setField('priority', e.target.value as Priority)}
                  className={inputCls}
                >
                  {priorityOptions.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className={labelCls}>Summary</label>
              <input
                type="text"
                value={form.summary}
                onChange={(e) => setField('summary', e.target.value)}
                className={inputCls}
                placeholder="Brief summary"
              />
            </div>

            {/* Content */}
            <div>
              <label className={labelCls}>Content</label>
              <RichTextEditor
                content={form.content}
                onChange={(html) => setField('content', html)}
                placeholder="Write your update content..."
              />
            </div>

            {/* Tags */}
            <div>
              <label className={labelCls}>Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tagsInput}
                onChange={(e) => setField('tagsInput', e.target.value)}
                className={inputCls}
                placeholder="tag1, tag2, tag3"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((t) => (
                    <span key={t} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Version + Status + Publish at */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Version (optional)</label>
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) => setField('version', e.target.value)}
                  className={inputCls}
                  placeholder="1.0.0"
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value as UpdateStatus)}
                  className={inputCls}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Schedule publish</label>
                <input
                  type="datetime-local"
                  value={form.publish_at}
                  onChange={(e) => setField('publish_at', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Features */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls}>Features</label>
                <button
                  type="button"
                  onClick={addFeature}
                  className="flex items-center gap-1 text-xs text-primary-light/80 hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> Add feature
                </button>
              </div>
              <div className="space-y-2">
                {form.features.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => updateFeature(i, 'name', e.target.value)}
                      className={`${inputCls} flex-1`}
                      placeholder="Feature name"
                    />
                    <input
                      type="text"
                      value={f.description}
                      onChange={(e) => updateFeature(i, 'description', e.target.value)}
                      className={`${inputCls} flex-[2]`}
                      placeholder="Description"
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(i)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-primary-light/20">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-primary hover:bg-primary-light disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Update'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
