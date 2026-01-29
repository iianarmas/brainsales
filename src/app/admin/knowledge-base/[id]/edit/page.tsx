'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { UpdateForm } from '@/components/KnowledgeBase/Admin/UpdateForm';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/app/lib/supabaseClient';
import type { KBUpdate } from '@/types/knowledgeBase';

export default function EditUpdateRoute() {
  const { id } = useParams<{ id: string }>();
  const { user, session, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [update, setUpdate] = useState<KBUpdate | null>(null);
  const [loadingUpdate, setLoadingUpdate] = useState(true);

  useEffect(() => {
    if (!id || !session?.access_token) return;
    fetch(`/api/kb/updates/${id}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((json) => setUpdate(json.data || json))
      .catch(console.error)
      .finally(() => setLoadingUpdate(false));
  }, [id, session?.access_token]);

  if (loading || adminLoading || loadingUpdate) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-white">
      <p>Access denied. Admin only.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-default p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Edit Update</h1>
        {update ? <UpdateForm existingUpdate={update} /> : <p className="text-gray-400">Update not found.</p>}
      </div>
    </div>
  );
}
