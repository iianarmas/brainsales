'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useCompetitor } from '@/hooks/useCompetitors';
import { CompetitorForm } from '@/components/KnowledgeBase/Admin/CompetitorForm';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ArrowLeft } from 'lucide-react';

interface EditCompetitorRouteProps {
  params: Promise<{ id: string }>;
}

export default function EditCompetitorRoute({ params }: EditCompetitorRouteProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { competitor, loading: competitorLoading, error } = useCompetitor(id);

  if (loading || adminLoading || competitorLoading) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-primary">
      <p>Access denied. Admin only.</p>
    </div>
  );

  if (error || !competitor) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-gray-500 mb-4">Competitor not found.</p>
          <Link
            href="/admin/knowledge-base/competitors"
            className="text-primary hover:underline"
          >
            Back to Competitors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/admin/knowledge-base/competitors"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Competitors
          </Link>
        </div>
        <CompetitorForm
          existingCompetitor={competitor}
          onSuccess={() => router.push('/admin/knowledge-base/competitors')}
        />
      </div>
    </div>
  );
}
