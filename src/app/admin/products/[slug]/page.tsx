'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/app/lib/supabaseClient';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAdminData } from '@/hooks/useAdminData';
import { useKbStore } from '@/store/useKbStore';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  role: string;
}

export default function ProductSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    logo_url: '',
    is_active: true,
  });

  useEffect(() => {
    if (user && isAdmin) {
      loadProduct();
    }
  }, [user, isAdmin, slug]);

  async function loadProduct() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/products/${slug}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to load product');
      const json = await res.json();
      const p = json.product;
      setProduct(p);
      setForm({
        name: p.name,
        description: p.description || '',
        logo_url: p.logo_url || '',
        is_active: p.is_active,
      });
    } catch (err) {
      toast.error('Failed to load product');
    } finally {
      setLoadingProduct(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!product) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update product');
      }

      toast.success('Product updated successfully');
      loadProduct();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
    }
  }

  const { fetchProducts } = useAdminData();

  async function handleDelete() {
    if (!product) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete product');
      }

      toast.success('Product deleted');
      useKbStore.getState().clearCache();
      await fetchProducts(true);
      router.push('/admin/products');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  }

  if (loading || adminLoading || loadingProduct) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <p>Access denied. Admin only.</p>
    </div>
  );
  if (!product) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <p>Product not found.</p>
    </div>
  );

  const inputCls = "w-full bg-input border border-border-subtle rounded-lg px-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block text-sm font-medium text-muted-foreground mb-1";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/products" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-primary">{product.name} Settings</h1>
            <p className="text-muted-foreground text-sm">/{product.slug}</p>
          </div>
        </div>

        <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6 space-y-5 shadow-xl">
          <div>
            <label className={labelCls}>Product Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} resize-none`} rows={3} placeholder="Brief description of the product..." />
          </div>

          <div>
            <label className={labelCls}>Logo URL (optional)</label>
            <input type="text" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} className={inputCls} placeholder="https://..." />
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm({ ...form, is_active: !form.is_active })} className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-surface-active'}`}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-muted-foreground">{form.is_active ? 'Product is active' : 'Product is inactive'}</span>
          </div>

          <div className={`flex items-center ${product.role === 'super_admin' ? 'justify-between' : 'justify-end'} pt-4 border-t border-border-subtle`}>
            {product.role === 'super_admin' && (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors">
                <Trash2 className="h-4 w-4" />
                Delete Product
              </button>
            )}
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-primary-light hover:bg-primary disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface-elevated border border-border-subtle rounded-xl w-full max-w-sm p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-foreground mb-2">Delete Product?</h3>
              <p className="text-muted-foreground text-sm mb-6">
                This will permanently delete <strong>{product.name}</strong> and all associated content. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
