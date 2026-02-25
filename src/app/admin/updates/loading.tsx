'use client';

import { LoadingScreen } from '@/components/LoadingScreen';

export default function AdminLoading() {
    return <LoadingScreen fullScreen={false} message="Loading..." />;
}
