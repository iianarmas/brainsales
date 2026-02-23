'use client';

import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { RepScorecard } from '@/components/Admin/Analytics/RepScorecard';
import { use } from 'react';

interface Props {
    params: Promise<{ userId: string }>;
}

export default function RepScorecardPage({ params }: Props) {
    const { userId } = use(params);
    const { user, loading } = useAuth();
    const { isAdmin, loading: adminLoading } = useAdmin();

    if (loading || adminLoading) return <LoadingScreen />;
    if (!user) return <LoginForm />;
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-bg-default flex items-center justify-center text-primary">
                <p>Access denied. Admin only.</p>
            </div>
        );
    }

    return <RepScorecard userId={userId} />;
}
