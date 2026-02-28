'use client';

import { ReactNode, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/Admin/AdminSidebar';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Menu } from 'lucide-react';
import { ProductSwitcher } from '@/components/ProductSwitcher';

interface AdminLayoutProps {
    children: ReactNode;
    defaultSection?: string;
}

// Map pathnames to human-readable page titles
function getPageTitle(pathname: string): string {
    if (pathname === '/admin/updates') return 'Updates Dashboard';
    if (pathname.startsWith('/admin/updates/team-update')) return 'Team Update';
    if (pathname.startsWith('/admin/updates/competitors')) return 'Competitors';
    if (pathname.startsWith('/admin/updates/teams')) return 'Teams';
    if (pathname.startsWith('/admin/updates')) return 'Updates';
    if (pathname.startsWith('/admin/products')) return 'Products';
    if (pathname.startsWith('/admin/analytics')) return 'Analytics';
    if (pathname.startsWith('/admin/scripts')) return 'Script Editor';
    if (pathname.startsWith('/admin/settings')) return 'Settings';
    return 'Admin';
}

export function AdminLayout({ children, defaultSection }: AdminLayoutProps) {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
            if (window.innerWidth < 1024) {
                setSidebarOpen(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        if (window.innerWidth >= 1024) {
            const saved = localStorage.getItem('admin-sidebar-open');
            if (saved !== null) {
                setSidebarOpen(saved === 'true');
            }
        }

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (!isMobile) {
            localStorage.setItem('admin-sidebar-open', String(sidebarOpen));
        }
    }, [sidebarOpen, isMobile]);



    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const pageTitle = getPageTitle(pathname);

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Mobile overlay */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-60 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
                    fixed lg:relative inset-y-0 left-0 z-30
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    ${sidebarOpen ? 'w-64' : 'lg:w-0'}
                `}
            >
                <AdminSidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    defaultSection={defaultSection}
                />
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Header */}
                <div className="bg-surface border-b border-border-subtle px-4 py-3 flex items-center justify-between shadow-xl flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={toggleSidebar}
                            className="p-2 hover:bg-surface-active rounded-lg transition-colors flex-shrink-0"
                            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                        >
                            <Menu className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <div className="flex items-center gap-2 min-w-0">
                            <h1 className="text-base font-semibold text-primary truncate">{pageTitle}</h1>
                        </div>
                    </div>
                    {pathname === '/admin/scripts' && (
                        <div className="flex-shrink-0">
                            <ProductSwitcher />
                        </div>
                    )}
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-auto flex flex-col relative">
                    {children}
                </div>
            </div>
        </div>
    );
}
