'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useKbStore } from '@/store/useKbStore';
import Link from 'next/link';
import {
    FileText,
    Users,
    Package,
    ChevronRight,
    ChevronDown,
    Settings,
    BarChart3,
    X,
    Zap,
    Building2,
    Code2,
    Home,
} from 'lucide-react';

interface SidebarItem {
    id: string;
    label: string;
    href?: string;
    action?: () => void;
    badge?: number;
    icon?: typeof FileText;
}

interface SidebarSection {
    id: string;
    label: string;
    icon: typeof FileText;
    items?: SidebarItem[];
    href?: string;
    action?: () => void;
}

interface AdminSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    defaultSection?: string;
}

// Extract useSearchParams into a tiny isolated component so it doesn't suspend the whole sidebar
function TabTracker({ onTabChange }: { onTabChange: (tab: string | null) => void }) {
    const searchParams = useSearchParams();

    useEffect(() => {
        onTabChange(searchParams.get('tab'));
    }, [searchParams, onTabChange]);

    return null;
}

function AdminSidebarInner({ isOpen, onClose, defaultSection }: AdminSidebarProps) {
    const pathname = usePathname();
    const [currentTab, setCurrentTab] = useState<string | null>(null);

    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(defaultSection ? [defaultSection] : ['updates'])
    );
    const { adminStats: stats } = useKbStore();

    useEffect(() => {
        // Auto-expand section based on current path
        if (pathname.startsWith('/admin/updates')) {
            setExpandedSections(prev => {
                if (prev.has('updates')) return prev;
                const next = new Set(prev);
                next.add('updates');
                return next;
            });
        }
        if (pathname.startsWith('/admin/products')) {
            setExpandedSections(prev => {
                if (prev.has('products')) return prev;
                const next = new Set(prev);
                next.add('products');
                return next;
            });
        }
    }, [pathname]);

    const toggleSection = (sectionId: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    };



    // Determine active item using pathname + optional ?tab param
    const isItemActive = (href?: string): boolean => {
        if (!href) return false;
        const [hrefPath, hrefSearch] = href.split('?');
        if (hrefSearch) {
            const params = new URLSearchParams(hrefSearch);
            return pathname === hrefPath && currentTab === params.get('tab');
        }
        // Exact match only (no query params means default/no-tab)
        return pathname === hrefPath && !currentTab;
    };

    const sections: SidebarSection[] = [
        {
            id: 'updates',
            label: 'Updates',
            icon: FileText,
            items: [
                {
                    id: 'kb-updates',
                    label: 'Product Updates',
                    href: '/admin/updates',
                    icon: FileText,
                    badge: stats?.kb_stats?.drafts || 0,
                },
                {
                    id: 'team-updates',
                    label: 'Team Updates',
                    href: '/admin/updates?tab=team',
                    icon: Users,
                    badge: stats?.team_stats?.drafts || 0,
                },
                {
                    id: 'competitors',
                    label: 'Competitors',
                    href: '/admin/updates/competitors',
                    icon: Building2,
                },
                {
                    id: 'teams-list',
                    label: 'Manage Teams',
                    href: '/admin/updates/teams',
                    icon: Users,
                },
            ],
        },
        {
            id: 'products',
            label: 'Products',
            icon: Package,
            items: [
                {
                    id: 'products-list',
                    label: 'All Products',
                    href: '/admin/products',
                    icon: Package,
                },
            ],
        },
        {
            id: 'analytics',
            label: 'Analytics',
            icon: BarChart3,
            href: '/admin/analytics',
        },
        {
            id: 'scripts',
            label: 'Script Editor',
            icon: Code2,
            href: '/admin/scripts',
        },
    ];

    if (!isOpen) return null;

    return (
        <div className="h-full w-64 flex flex-col bg-primary bg-gradient-to-v from-primary/80 to-primary">
            {/* Isolated Suspense boundary just for the query parameter tracking */}
            <Suspense fallback={null}>
                <TabTracker onTabChange={setCurrentTab} />
            </Suspense>

            {/* Brand Header */}
            <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shadow-inner">
                        <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm leading-tight">BrainSales</p>
                        <p className="text-white/50 text-[10px] font-medium uppercase tracking-widest leading-tight">Admin</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Close sidebar"
                >
                    <X className="h-4 w-4 text-white/70" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">

                {/* Dashboard overview link */}
                <Link
                    href="/admin/updates"
                    prefetch={false}
                    onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                    }}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-3
                        active:scale-[0.98]
                        ${pathname === '/admin/updates' && !currentTab
                            ? 'bg-white/20 text-white shadow-sm'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                        }
                    `}
                >
                    <Home className="h-4 w-4" />
                    <span>Dashboard</span>
                </Link>

                <div className="mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-3 mb-2">Content</p>
                </div>

                {sections.map((section) => (
                    <div key={section.id} className="mb-0.5">
                        {/* Section header */}
                        {section.items ? (
                            <button
                                onClick={() => toggleSection(section.id)}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                                    text-sm font-medium transition-all
                                    ${pathname.startsWith(`/admin/${section.id}`)
                                        ? 'bg-white/15 text-white'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <section.icon className="h-4 w-4" />
                                    <span>{section.label}</span>
                                </div>
                                {expandedSections.has(section.id) ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-white/50" />
                                ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-white/50" />
                                )}
                            </button>
                        ) : section.href ? (
                            <Link
                                href={section.href}
                                prefetch={false}
                                onClick={() => {
                                    if (window.innerWidth < 1024) onClose();
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                    text-sm font-medium transition-all active:scale-[0.98]
                                    ${pathname === section.href
                                        ? 'bg-white/20 text-white shadow-sm'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                <section.icon className="h-4 w-4" />
                                <span>{section.label}</span>
                            </Link>
                        ) : null}

                        {/* Sub-items */}
                        {section.items && expandedSections.has(section.id) && (
                            <div className="ml-3 mt-0.5 space-y-0.5 pl-3 border-l border-white/10">
                                {section.items.map((item) => {
                                    const active = isItemActive(item.href);
                                    return item.href ? (
                                        <Link
                                            key={item.id}
                                            href={item.href}
                                            prefetch={false}
                                            onClick={() => {
                                                if (window.innerWidth < 1024) onClose();
                                            }}
                                            className={`
                                                w-full flex items-center justify-between px-3 py-2 rounded-lg
                                                text-sm transition-all active:scale-[0.98]
                                                ${active
                                                    ? 'bg-white/20 text-white font-semibold'
                                                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                {item.icon && <item.icon className="h-3.5 w-3.5" />}
                                                <span>{item.label}</span>
                                            </div>
                                            {item.badge !== undefined && item.badge > 0 && (
                                                <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-tight">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    ) : (
                                        <button
                                            key={item.id}
                                            onClick={item.action}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-all"
                                        >
                                            {item.icon && <item.icon className="h-3.5 w-3.5" />}
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-white/10">
                <Link
                    href="/admin/settings"
                    prefetch={false}
                    onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                    }}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98]
                        ${pathname === '/admin/settings'
                            ? 'bg-white/20 text-white'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                        }
                    `}
                >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                </Link>
            </div>
        </div>
    );
}

export function AdminSidebar(props: AdminSidebarProps) {
    return <AdminSidebarInner {...props} />;
}
