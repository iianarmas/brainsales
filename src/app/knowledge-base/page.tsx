'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { KnowledgeBasePage } from '@/components/KnowledgeBase/KnowledgeBasePage';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';

function KnowledgeBaseContent() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();

  // Read URL params for notification click navigation
  const tab = searchParams.get('tab') as 'product' | 'team' | null;
  const updateId = searchParams.get('update');

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginForm />;

  return (
    <KnowledgeBasePage
      initialTab={tab || undefined}
      initialUpdateId={updateId || undefined}
    />
  );
}

export default function KnowledgeBaseRoute() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <KnowledgeBaseContent />
    </Suspense>
  );
}
