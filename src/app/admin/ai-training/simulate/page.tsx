'use client';

import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SimulationSessionList } from '@/components/Admin/AITraining/SimulationSessionList';

export default function AITrainingSimulatePage() {
    const { user, loading } = useAuth();
    const { isAdmin, loading: adminLoading } = useAdmin();

    if (loading || adminLoading) return <LoadingScreen fullScreen={false} />;
    if (!user) return <LoginForm />;
    if (!isAdmin) return (
        <div className="min-h-screen flex items-center justify-center text-primary">
            <p>Access denied. Admin only.</p>
        </div>
    );

    return <SimulationSessionList />;
}
