'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    FileText,
    Users,
    Package,
    ChevronRight,
    ChevronDown,
    Plus,
    Settings,
    BarChart3,
    X,
} from 'lucide-react';

interface SidebarSection {
    id: string;
    label: string;
    icon: typeof FileText;
    items?: SidebarItem[];
    action?: () => void;
}

interface SidebarItem {
    id: string;
    label: string;
    href?: string;
    action?: () => void;
    badge?: number;
}

interface AdminSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    defaultSection?: string;
}

export function AdminSidebar({ isOpen, onClose, defaultSection }: AdminSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(defaultSection ? [defaultSection] : ['updates'])
    );
    const [stats, setStats] = useState({ kbDrafts: 0, teamDrafts: 0 });

    useEffect(() => {
        // Fetch draft counts for badges
        async function fetchStats() {
            try {
                const res = await fetch('/api/kb/admin/stats');
                if (res.ok) {
                    const data = await res.json();
                    setStats({
                        kbDrafts: data.kb_stats?.drafts || 0,
                        teamDrafts: data.team_stats?.drafts || 0,
                    });
                }
            } catch {
                // Silent fail
            }
        }
        fetchStats();
    }, []);

    useEffect(() => {
        // Auto-expand section based on current path
        const sections = ['knowledge-base', 'products', 'settings'];
        for (const section of sections) {
            if (pathname.includes(`/admin/${section}`)) {
                const sectionId = section === 'knowledge-base' ? 'updates' : section;
                setExpandedSections(prev => {
                    if (prev.has(sectionId)) return prev;
                    const next = new Set(prev);
                    next.add(sectionId);
                    return next;
                });
            }
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

    const handleNavigation = (href: string) => {
        router.push(href);
        // Close sidebar on mobile after navigation
        if (window.innerWidth < 1024) {
            onClose();
        }
    };

    const sections: SidebarSection[] = [
        {
            id: 'updates',
            label: 'Updates',
            icon: FileText,
            items: [
                {
                    id: 'kb-updates',
                    label: 'KB Updates',
                    href: '/admin/knowledge-base',
                    badge: stats.kbDrafts,
                },
                {
                    id: 'new-kb-update',
                    label: '+ New KB Update',
                    href: '/admin/knowledge-base/new',
                },
                {
                    id: 'team-updates',
                    label: 'Team Updates',
                    href: '/admin/knowledge-base',
                    badge: stats.teamDrafts,
                },
                {
                    id: 'new-team-update',
                    label: '+ New Team Update',
                    href: '/admin/knowledge-base/team-update/new',
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
                },
                {
                    id: 'new-product',
                    label: '+ New Product',
                    action: () => {
                        // TODO: Implement inline product creation or modal
                        handleNavigation('/admin/products');
                    },
                },
            ],
        },
        {
            id: 'teams',
            label: 'Teams',
            icon: Users,
            items: [
                {
                    id: 'teams-list',
                    label: 'All Teams',
                    href: '/admin/knowledge-base/teams',
                },
                {
                    id: 'new-team',
                    label: '+ New Team',
                    action: () => {
                        // TODO: Implement inline team creation or modal
                        handleNavigation('/admin/knowledge-base/teams');
                    },
                },
            ],
        },
        {
            id: 'scripts',
            label: 'Script Editor',
            icon: FileText,
            action: () => handleNavigation('/admin/scripts'),
        },
    ];

    if (!isOpen) return null;

    return (
        <div className="h-full w-64 bg-white border-r border-primary-light/20 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-primary-light/20 flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary">Admin</h2>
                <button
                    onClick={onClose}
                    className="lg:hidden p-1 hover:bg-gray-100 rounded"
                    aria-label="Close sidebar"
                >
                    <X className="h-5 w-5 text-gray-600" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {sections.map((section) => (
                    <div key={section.id}>
                        {/* Section header */}
                        <button
                            onClick={() => {
                                if (section.action) {
                                    section.action();
                                } else if (section.items) {
                                    toggleSection(section.id);
                                }
                            }}
                            className={`
                w-full flex items-center justify-between px-3 py-2 rounded-lg
                text-sm font-medium transition-colors
                ${pathname.startsWith(`/admin/${section.id}`)
                                    ? 'bg-primary-light/10 text-primary'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }
              `}
                        >
                            <div className="flex items-center gap-2">
                                <section.icon className="h-4 w-4" />
                                <span>{section.label}</span>
                            </div>
                            {section.items && (
                                expandedSections.has(section.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )
                            )}
                        </button>

                        {/* Section items */}
                        {section.items && expandedSections.has(section.id) && (
                            <div className="ml-6 mt-1 space-y-1">
                                {section.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            if (item.action) {
                                                item.action();
                                            } else if (item.href) {
                                                handleNavigation(item.href);
                                            }
                                        }}
                                        className={`
                      w-full flex items-center justify-between px-3 py-1.5 rounded-lg
                      text-sm transition-colors
                      ${pathname === item.href
                                                ? 'bg-primary-light/10 text-primary font-medium'
                                                : item.label.startsWith('+')
                                                    ? 'text-primary-light hover:bg-primary-light/5'
                                                    : 'text-gray-600 hover:bg-gray-100'
                                            }
                    `}
                                    >
                                        <span>{item.label}</span>
                                        {item.badge !== undefined && item.badge > 0 && (
                                            <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                                {item.badge}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-primary-light/20">
                <button
                    onClick={() => handleNavigation('/admin/settings')}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                </button>
            </div>
        </div>
    );
}
