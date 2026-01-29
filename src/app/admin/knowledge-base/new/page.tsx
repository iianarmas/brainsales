'use client';

import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { UpdateForm } from '@/components/KnowledgeBase/Admin/UpdateForm';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function NewUpdateRoute() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (loading || adminLoading) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-white">
      <p>Access denied. Admin only.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-default p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-primary mb-6">Create New Update</h1>
        <UpdateForm />
      </div>
    </div>
  );
}
