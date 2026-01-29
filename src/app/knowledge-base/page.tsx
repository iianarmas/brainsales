'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { KnowledgeBasePage } from '@/components/KnowledgeBase/KnowledgeBasePage';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function KnowledgeBaseRoute() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();

  // Read URL params for notification click navigation
  const tab = searchParams.get('tab') as 'dexit' | 'team' | null;
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
