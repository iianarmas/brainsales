'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/app/lib/supabaseClient';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Keyboard, BookOpen, ChevronRight, Settings } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  slug: string;
}

export default function ProductContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);

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
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <p>Access denied. Admin only.</p>
    </div>
  );
  if (!product) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <p>Product not found.</p>
    </div>
  );

  const contentLinks = [
    {
      title: 'Quick Reference',
      description: 'Edit differentiators, competitors, metrics, and tips that appear in the Quick Reference panel',
      icon: BookOpen,
      href: `/admin/products/${slug}/quick-reference`,
      bgColor: 'bg-primary',
    },
    {
      title: 'Objection Shortcuts',
      description: 'Configure which objection handlers are mapped to number keys 0-9 in the hotbar',
      icon: Keyboard,
      href: `/admin/products/${slug}/objection-shortcuts`,
      bgColor: 'bg-primary',
    },
    {
      title: 'Call Configuration',
      description: 'Manage call screen settings, pain points, and navigation',
      icon: Settings,
      href: `/admin/products/${slug}/configuration`,
      bgColor: 'bg-primary',
    },
    {
      title: 'Scripts',
      description: 'Manage call scripts and node flows for this product',
      icon: FileText,
      href: '/admin/scripts',
      bgColor: 'bg-primary',
      external: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/products" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-primary">{product.name} Content</h1>
            <p className="text-muted-foreground text-sm">Manage product-specific content and configurations</p>
          </div>
        </div>

        <div className="space-y-4">
          {contentLinks.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-center gap-4 p-5 bg-surface-elevated border border-border-subtle rounded-xl hover:border-primary/50 transition-colors group shadow-lg"
            >
              <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center`}>
                <item.icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-foreground font-semibold group-hover:text-primary transition-colors">
                  {item.title}
                  {item.external && <span className="text-xs text-muted-foreground ml-2">(All Products)</span>}
                </h3>
                <p className="text-muted-foreground text-sm mt-0.5">{item.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
