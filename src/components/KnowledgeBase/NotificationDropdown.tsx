'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { UnreadBadge } from './UnreadBadge';

// Strip HTML tags for plain text display
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

interface NotificationDropdownProps {
  buttonClassName?: string;
  onNotificationClick?: (referenceId: string, referenceType: string) => void;
}

export function NotificationDropdown({ buttonClassName, onNotificationClick }: NotificationDropdownProps = {}) {
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications();
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

  const handleNotificationClick = (notification: (typeof notifications)[0]) => {
    if (!notification.is_read) markRead(notification.id);
    if (notification.reference_id && onNotificationClick) {
      onNotificationClick(notification.reference_id, notification.reference_type || 'kb_update');
    } else if (notification.reference_id) {
      const tab = notification.reference_type === 'team_update' ? 'team' : 'product';
      window.location.href = `/knowledge-base?tab=${tab}&update=${notification.reference_id}`;
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={buttonClassName || "relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5">
            <UnreadBadge count={unreadCount} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-primary-light/10 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-semibold text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="text-center text-gray-500 text-sm py-8">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">No notifications</div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-primary-light/40 transition-colors ${
                    !n.is_read ? 'bg-primary-light/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 font-medium truncate">{stripHtml(n.title)}</p>
                      {n.message && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{stripHtml(n.message)}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(n.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {n.reference_id && (
                      <ExternalLink className="h-3.5 w-3.5 text-gray-500 hover:text-primary shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
