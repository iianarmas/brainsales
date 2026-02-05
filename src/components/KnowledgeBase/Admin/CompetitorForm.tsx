'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2, Globe, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabaseClient';
import { useProduct } from '@/context/ProductContext';
import type { Competitor } from '@/types/competitor';

interface CompetitorFormProps {
  existingCompetitor?: Competitor;
  onSuccess?: () => void;
}

export function CompetitorForm({ existingCompetitor, onSuccess }: CompetitorFormProps) {
  const isEdit = !!existingCompetitor;
  const { currentProduct } = useProduct();
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    product_id: existingCompetitor?.product_id ?? '',
    name: existingCompetitor?.name ?? '',
    logo_url: existingCompetitor?.logo_url ?? '',
    website: existingCompetitor?.website ?? '',
    description: existingCompetitor?.description ?? '',
    strengths: existingCompetitor?.strengths ?? [''],
    limitations: existingCompetitor?.limitations ?? [''],
    our_advantage: existingCompetitor?.our_advantage ?? '',
    positioning: existingCompetitor?.positioning ?? '',
    target_market: existingCompetitor?.target_market ?? '',
    pricing_info: existingCompetitor?.pricing_info ?? '',
  });

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch('/api/products', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const json = await res.json();
          setProducts(json.products || []);
        }
      } catch { /* silent */ }
    }
    loadProducts();
  }, []);

  // Set default product_id when products load and we're creating new
  useEffect(() => {
    if (!isEdit && !form.product_id && products.length > 0) {
      const defaultProduct = currentProduct?.id || products[0]?.id;
      if (defaultProduct) {
        setForm(prev => ({ ...prev, product_id: defaultProduct }));
      }
    }
  }, [products, currentProduct?.id, isEdit, form.product_id]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Strengths management
  const addStrength = () => setField('strengths', [...form.strengths, '']);
  const removeStrength = (i: number) =>
    setField('strengths', form.strengths.filter((_, idx) => idx !== i));
  const updateStrength = (i: number, value: string) =>
    setField('strengths', form.strengths.map((s, idx) => (idx === i ? value : s)));

  // Limitations management
  const addLimitation = () => setField('limitations', [...form.limitations, '']);
  const removeLimitation = (i: number) =>
    setField('limitations', form.limitations.filter((_, idx) => idx !== i));
  const updateLimitation = (i: number, value: string) =>
    setField('limitations', form.limitations.map((l, idx) => (idx === i ? value : l)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.product_id) {
      toast.error('Please select a product');
      return;
    }
    setSaving(true);

    const payload = {
      product_id: form.product_id,
      name: form.name,
      logo_url: form.logo_url || undefined,
      website: form.website || undefined,
      description: form.description || undefined,
      strengths: form.strengths.filter(s => s.trim()),
      limitations: form.limitations.filter(l => l.trim()),
      our_advantage: form.our_advantage || undefined,
      positioning: form.positioning || undefined,
      target_market: form.target_market || undefined,
      pricing_info: form.pricing_info || undefined,
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = isEdit ? `/api/competitors/${existingCompetitor.id}` : '/api/competitors';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save');
      }

      toast.success(isEdit ? 'Competitor saved' : 'Competitor created');
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save competitor';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-gray-500 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-sm font-medium text-gray-600 mb-1';
  const textareaCls =
    'w-full bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-gray-500 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px] resize-y';

  return (
    <div className="h-full overflow-y-auto bg-white border border-primary-light/20 shadow-xl rounded-xl text-primary p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl text-gray-700 font-bold">
            {isEdit ? 'Edit Competitor' : 'New Competitor'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Product Selector */}
          <div>
            <label className={labelCls}>Product</label>
            <select
              value={form.product_id}
              onChange={(e) => setField('product_id', e.target.value)}
              className={inputCls}
              disabled={isEdit}
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This competitor will be associated with this product.
            </p>
          </div>

          {/* Name + Website row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Competitor Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className={inputCls}
                placeholder="e.g., Acme Corp"
              />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  className={`${inputCls} pl-10`}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label className={labelCls}>Logo URL (optional)</label>
            <input
              type="url"
              value={form.logo_url}
              onChange={(e) => setField('logo_url', e.target.value)}
              className={inputCls}
              placeholder="https://example.com/logo.png"
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              className={textareaCls}
              placeholder="Brief overview of this competitor..."
            />
          </div>

          {/* Strengths */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Their Strengths</label>
              <button
                type="button"
                onClick={addStrength}
                className="flex items-center gap-1 text-xs text-primary-light/80 hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5" /> Add strength
              </button>
            </div>
            <div className="space-y-2">
              {form.strengths.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={s}
                    onChange={(e) => updateStrength(i, e.target.value)}
                    className={`${inputCls} flex-1`}
                    placeholder="e.g., Strong enterprise features"
                  />
                  {form.strengths.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStrength(i)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Limitations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Their Limitations</label>
              <button
                type="button"
                onClick={addLimitation}
                className="flex items-center gap-1 text-xs text-primary-light/80 hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5" /> Add limitation
              </button>
            </div>
            <div className="space-y-2">
              {form.limitations.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={l}
                    onChange={(e) => updateLimitation(i, e.target.value)}
                    className={`${inputCls} flex-1`}
                    placeholder="e.g., Limited integration options"
                  />
                  {form.limitations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLimitation(i)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Our Advantage */}
          <div>
            <label className={labelCls}>Our Advantage</label>
            <textarea
              value={form.our_advantage}
              onChange={(e) => setField('our_advantage', e.target.value)}
              className={textareaCls}
              placeholder="What makes us better than this competitor..."
            />
          </div>

          {/* Positioning */}
          <div>
            <label className={labelCls}>Their Positioning</label>
            <textarea
              value={form.positioning}
              onChange={(e) => setField('positioning', e.target.value)}
              className={textareaCls}
              placeholder="How they position themselves in the market..."
            />
          </div>

          {/* Target Market */}
          <div>
            <label className={labelCls}>Their Target Market</label>
            <textarea
              value={form.target_market}
              onChange={(e) => setField('target_market', e.target.value)}
              className={textareaCls}
              placeholder="Who are their ideal customers..."
            />
          </div>

          {/* Pricing Info */}
          <div>
            <label className={labelCls}>Pricing Intelligence</label>
            <textarea
              value={form.pricing_info}
              onChange={(e) => setField('pricing_info', e.target.value)}
              className={textareaCls}
              placeholder="What do we know about their pricing..."
            />
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-primary-light/20">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-primary hover:bg-primary-light disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Competitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
