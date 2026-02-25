'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { KBAdminDashboard } from '@/components/KnowledgeBase/Admin/KBAdminDashboard';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';

function AdminUpdatesContent() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') as 'product' | 'team' | null;

  if (loading || adminLoading) return <LoadingScreen fullScreen={false} />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-primary">
      <p>Access denied. Admin only.</p>
    </div>
  );

  return <KBAdminDashboard initialTab={tab || 'product'} />;
}

export default function AdminUpdatesRoute() {
  return (
    <Suspense fallback={<LoadingScreen fullScreen={false} />}>
      <AdminUpdatesContent />
    </Suspense>
  );
}
