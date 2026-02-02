'use client';

import { ReactNode, useState, useEffect } from 'react';
import { AdminSidebar } from '@/components/Admin/AdminSidebar';
import { Menu, X } from 'lucide-react';

interface AdminLayoutProps {
    children: ReactNode;
    defaultSection?: string;
}

export function AdminLayout({ children, defaultSection }: AdminLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Check if mobile on mount
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
            if (window.innerWidth < 1024) {
                setSidebarOpen(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        // Load sidebar state from localStorage (desktop only)
        if (window.innerWidth >= 1024) {
            const saved = localStorage.getItem('admin-sidebar-open');
            if (saved !== null) {
                setSidebarOpen(saved === 'true');
            }
        }

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        // Save sidebar state to localStorage (desktop only)
        if (!isMobile) {
            localStorage.setItem('admin-sidebar-open', String(sidebarOpen));
        }
    }, [sidebarOpen, isMobile]);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <div className="flex h-screen bg-bg-default overflow-hidden">
            {/* Mobile overlay */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
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
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header with toggle button */}
                <div className="bg-white border-b border-primary-light/20 px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                    >
                        {sidebarOpen ? (
                            <X className="h-5 w-5 text-gray-600" />
                        ) : (
                            <Menu className="h-5 w-5 text-gray-600" />
                        )}
                    </button>
                    <h1 className="text-lg font-semibold text-primary">Admin Dashboard</h1>
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
