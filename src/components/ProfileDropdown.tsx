'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Code, Library, LogOut, LayoutDashboard } from 'lucide-react';

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
        className="flex items-center justify-center rounded-full hover:bg-primary-light/10 transition-colors p-0.5"
      >
        {profile?.profile_picture_url ? (
          <img
            src={profile.profile_picture_url}
            alt="Profile"
            className="h-8 w-8 rounded-full object-cover border-2 border-primary-light/20"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary-light/20 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-primary-light/10 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header - User Info */}
          <div className="px-4 py-3 border-b border-white">
            <div className="flex items-center gap-3">
              {profile?.profile_picture_url ? (
                <img
                  src={profile.profile_picture_url}
                  alt="Profile"
                  className="h-10 w-10 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-primary font-medium truncate">{displayName}</p>
                {user?.email && (
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {/* My Profile */}
            <button
              onClick={() => handleItemClick(onOpenSettings)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-primary-light/10 transition-colors"
            >
              <User className="h-4 w-4 text-primary" />
              My Profile
            </button>

            <div className="border-t border-white my-1" />

            {/* Scripts */}
            {isAdmin ? (
              <button
                onClick={() => handleItemClick(() => window.open('/admin/scripts', '_blank'))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-primary-light/10 transition-colors"
              >
                <Code className="h-4 w-4 text-primary" />
                Scripts
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                  Admin
                </span>
              </button>
            ) : (
              <button
                onClick={() => handleItemClick(() => window.open('/scripts', '_blank'))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-primary-light/10 transition-colors"
              >
                <Code className="h-4 w-4 text-primary" />
                Scripts
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                  View Only
                </span>
              </button>
            )}

            {/* Updates */}
            {isAdmin && (
              <button
                onClick={() => handleItemClick(() => window.open('/admin/knowledge-base', '_blank'))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-primary-light/10 transition-colors"
              >
                <Library className="h-4 w-4 text-primary" />
                Updates
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                  Admin
                </span>
              </button>
            )}

            {/* Admin Dashboard */}
            {isAdmin && (
              <button
                onClick={() => handleItemClick(() => window.open('/admin/knowledge-base', '_blank'))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-primary-light/10 transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-primary" />
                Admin Dashboard
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                  Admin
                </span>
              </button>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-white">
            <button
              onClick={() => handleItemClick(onLogout)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-primary-light/10 transition-colors"
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
