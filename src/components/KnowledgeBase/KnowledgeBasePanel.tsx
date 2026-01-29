'use client';

import { useEffect, useCallback } from 'react';
import { X, Maximize2 } from 'lucide-react';
import { KnowledgeBasePage } from './KnowledgeBasePage';

interface KnowledgeBasePanelProps {
  open: boolean;
  onClose: () => void;
  initialUpdateId?: string;
  initialTab?: 'dexit' | 'team';
}

export function KnowledgeBasePanel({ open, onClose, initialUpdateId, initialTab }: KnowledgeBasePanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleMaximize = useCallback(() => {
    window.open('/knowledge-base', '_blank');
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop - dimmed and blurred */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel - slides in from right */}
      <div
        className="absolute top-0 right-0 h-full w-full max-w-[540px] bg-white shadow-2xl animate-slide-in-right flex flex-col"
      >
        {/* Panel header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-primary-light/20">
          <span className="text-sm font-semibold text-primary">Updates & Announcements</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMaximize}
              className="p-2 text-primary-light hover:text-white transition-colors rounded-lg hover:bg-primary-light"
              title="Open full view"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-primary-light hover:text-white transition-colors rounded-lg hover:bg-primary-light"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden">
          {/* Key forces remount when navigating from notifications to ensure fresh state */}
          <KnowledgeBasePage
            key={`${initialUpdateId || 'none'}-${initialTab || 'dexit'}`}
            initialUpdateId={initialUpdateId}
            initialTab={initialTab}
          />
        </div>
      </div>
    </div>
  );
}
