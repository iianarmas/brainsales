'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/app/lib/supabaseClient';
import { toast } from 'sonner';
import { Plus, Package, Users, Settings, ChevronRight, Loader2, X } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminProductsPage() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (user && isAdmin) {
      loadProducts();
    }
  }, [user, isAdmin]);

  async function loadProducts() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to load products');
      const json = await res.json();
      setProducts(json.products || []);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  }

  if (loading || adminLoading) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-white">
      <p>Access denied. Admin only.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-default p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Product Management</h1>
            <p className="text-gray-400 text-sm mt-1">Manage products, users, and product-specific content</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary-light hover:bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Product
          </button>
        </div>

        {/* Products Grid */}
        {loadingProducts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary-light" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-gray-800/50 rounded-xl p-12 text-center">
            <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No products yet. Create your first product to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onRefresh={loadProducts} />
            ))}
          </div>
        )}

        {/* Create Product Modal */}
        {showCreateModal && (
          <CreateProductModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              loadProducts();
            }}
          />
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, onRefresh }: { product: Product; onRefresh: () => void }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-primary-light/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-light/20 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-light" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{product.name}</h3>
            <p className="text-xs text-gray-500">/{product.slug}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          product.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
        }`}>
          {product.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {product.description && (
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">{product.description}</p>
      )}

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Link
          href={`/admin/products/${product.id}`}
          className="flex items-center justify-center gap-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
        <Link
          href={`/admin/products/${product.id}/users`}
          className="flex items-center justify-center gap-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        >
          <Users className="h-3.5 w-3.5" />
          Users
        </Link>
        <Link
          href={`/admin/products/${product.id}/content`}
          className="flex items-center justify-center gap-1.5 bg-primary-light/20 hover:bg-primary-light/30 text-primary-light px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        >
          Content
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function CreateProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create product');
      }

      toast.success('Product created successfully');
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setForm({ ...form, name, slug });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Create New Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Product Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light"
              placeholder="e.g., Dexit"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">/</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light"
                placeholder="dexit"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">URL-friendly identifier (lowercase, no spaces)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light resize-none"
              rows={3}
              placeholder="Brief description of the product..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-primary-light hover:bg-primary disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
