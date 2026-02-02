'use client';

import { ReactNode } from 'react';
import { AdminLayout } from '@/components/Admin/AdminLayout';

export default function AdminRootLayout({ children }: { children: ReactNode }) {
    // We use the AdminLayout component as the root layout for all /admin routes.
    // This ensures the sidebar and header state persist during navigation.
    return <AdminLayout>{children}</AdminLayout>;
}
