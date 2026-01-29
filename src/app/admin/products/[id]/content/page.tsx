'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/app/lib/supabaseClient';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Keyboard, BookOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  slug: string;
}

export default function ProductContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);

  useEffect(() => {
    if (user && isAdmin) {
      loadProduct();
    }
  }, [user, isAdmin, id]);

  async function loadProduct() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/products/${id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to load product');
      const json = await res.json();
      setProduct(json.product);
    } catch (err) {
      toast.error('Failed to load product');
    } finally {
      setLoadingProduct(false);
    }
  }

  if (loading || adminLoading || loadingProduct) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-white">
      <p>Access denied. Admin only.</p>
    </div>
  );
  if (!product) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-white">
      <p>Product not found.</p>
    </div>
  );

  const contentLinks = [
    {
      title: 'Quick Reference',
      description: 'Edit differentiators, competitors, metrics, and tips that appear in the Quick Reference panel',
      icon: BookOpen,
      href: `/admin/products/${id}/quick-reference`,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
    },
    {
      title: 'Objection Shortcuts',
      description: 'Configure which objection handlers are mapped to number keys 0-9 in the hotbar',
      icon: Keyboard,
      href: `/admin/products/${id}/objection-shortcuts`,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
    },
    {
      title: 'Scripts',
      description: 'Manage call scripts and node flows for this product',
      icon: FileText,
      href: '/admin/scripts',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      external: true,
    },
  ];

  return (
    <div className="min-h-screen bg-bg-default p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/products"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{product.name} Content</h1>
            <p className="text-gray-400 text-sm">Manage product-specific content and configurations</p>
          </div>
        </div>

        {/* Content Links */}
        <div className="space-y-4">
          {contentLinks.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-center gap-4 p-5 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-primary-light/50 transition-colors group"
            >
              <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center`}>
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold group-hover:text-primary-light transition-colors">
                  {item.title}
                  {item.external && <span className="text-xs text-gray-500 ml-2">(All Products)</span>}
                </h3>
                <p className="text-gray-400 text-sm mt-0.5">{item.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-primary-light transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
