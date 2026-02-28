'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Code, Library, LogOut, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';

interface ProfileDropdownProps {
  user: { email?: string } | null;
  profile: {
    first_name?: string | null;
    last_name?: string | null;
    profile_picture_url?: string | null;
  } | null;
  isAdmin: boolean;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function ProfileDropdown({
  user,
  profile,
  isAdmin,
  onOpenSettings,
  onLogout,
}: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useThemeStore();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name || profile?.last_name || user?.email || 'User';

  const handleItemClick = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative">
      {/* Profile Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors p-0.5"
      >
        {profile?.profile_picture_url ? (
          <img
            src={profile.profile_picture_url}
            alt="Profile"
            className="h-8 w-8 rounded-full object-cover border-2 border-primary"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary-subtle-bg flex items-center justify-center border border-primary/20">
            <User className="h-4 w-4 text-primary" />
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface-overlay border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header - User Info */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              {profile?.profile_picture_url ? (
                <img
                  src={profile.profile_picture_url}
                  alt="Profile"
                  className="h-10 w-10 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-surface-elevated flex items-center justify-center">
                  <User className="h-5 w-5 text-text-muted" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-primary font-medium truncate">{displayName}</p>
                {user?.email && (
                  <p className="text-xs text-text-muted truncate">{user.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1 border-t border-border-subtle">
            {/* My Profile */}
            <button
              onClick={() => handleItemClick(onOpenSettings)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
            >
              <User className="h-4 w-4 text-primary" />
              My Profile
            </button>

            {/* Dark Mode Toggle */}
            <div className="w-full flex items-center justify-between px-4 py-2 text-sm text-foreground hover:bg-surface-hover transition-colors">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
                Dark Mode
              </div>
              <button
                onClick={() => toggleTheme()}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                style={{ backgroundColor: theme === 'dark' ? 'var(--primary)' : 'var(--muted)' }}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
                />
              </button>
            </div>

            {/* Scripts */}
            {isAdmin ? (
              <button
                onClick={() => handleItemClick(() => window.open('/admin/scripts', '_blank'))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
              >
                <Code className="h-4 w-4 text-primary" />
                Scripts
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-primary-subtle-bg text-primary rounded">
                  Admin
                </span>
              </button>
            ) : (
              <button
                onClick={() => handleItemClick(() => window.open('/scripts', '_blank'))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
              >
                <Code className="h-4 w-4 text-primary" />
                Scripts
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-primary-subtle-bg text-primary rounded">
                  View Only
                </span>
              </button>
            )}

            {/* Updates */}
            {isAdmin && (
              <button
                onClick={() => handleItemClick(() => window.open('/admin/updates', '_blank'))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
              >
                <Library className="h-4 w-4 text-primary" />
                Updates
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-primary-subtle-bg text-primary rounded">
                  Admin
                </span>
              </button>
            )}

            {/* Admin Dashboard */}
            {isAdmin && (
              <button
                onClick={() => handleItemClick(() => window.open('/admin/updates', '_blank'))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-primary" />
                Admin Dashboard
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-primary-subtle-bg text-primary rounded">
                  Admin
                </span>
              </button>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-border-subtle">
            <button
              onClick={() => handleItemClick(onLogout)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-surface-hover transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
