'use client';

import { useState } from 'react';
import { ArrowLeft, Calendar, Tag, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { KBUpdate } from '@/types/knowledgeBase';
import { AcknowledgeButton } from './AcknowledgeButton';

interface UpdateCardProps {
  update: KBUpdate;
  isSelected?: boolean;
  onSelectToggle?: () => void;
  showCheckbox?: boolean;
  onAcknowledge?: () => void;
  isAdmin?: boolean;
  onEdit?: (update: KBUpdate) => void;
  onDelete?: (update: KBUpdate) => void;
  initialExpanded?: boolean;
}

const priorityLabels: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { label: 'High', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  low: { label: 'Low', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Strip HTML tags for plain text preview
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export function UpdateCard({
  update,
  isSelected,
  onSelectToggle,
  showCheckbox,
  onAcknowledge,
  isAdmin,
  onEdit,
  onDelete,
  initialExpanded,
}: UpdateCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded || false);
  const isUnread = !update.is_acknowledged;

  // Build display title: "Version - Title" or just "Title"
  const displayTitle = update.version
    ? `${update.version} - ${update.title}`
    : update.title;

  const publishDate = update.published_at || update.created_at;

  if (expanded) {
    // Detail view (matches "Read More" view from kb_plan.md)
    return (
      <div className="bg-white border border-primary-light/50 rounded-lg overflow-hidden">
        {/* Back button header */}
        <div className="px-5 py-3 border-b border-primary-light/20 flex items-center justify-between">
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-2 text-sm text-primary-light/80 hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Updates
          </button>
          <div className="flex items-center gap-2">
            {isAdmin && onEdit && (
              <button
                onClick={() => onEdit(update)}
                className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Edit
              </button>
            )}
            {isAdmin && onDelete && (
              <button
                onClick={() => onDelete(update)}
                className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Title */}
          <h2 className="text-xl font-bold text-primary mb-3">{displayTitle}</h2>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 mb-5 text-sm text-primary-light/80">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Published: {formatDate(publishDate)}
            </span>
            {update.category && (
              <span className="flex items-center gap-1.5">
                <Tag className="h-4 w-4" />
                Category: {update.category.name}
              </span>
            )}
            {update.priority && update.priority !== 'low' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${priorityLabels[update.priority]?.color}`}>
                {priorityLabels[update.priority]?.label}
              </span>
            )}
          </div>

          {/* Overview section */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Overview</h3>
            <div
              className="text-gray-500 text-sm leading-relaxed prose prose-sm max-w-none prose-headings:text-primary prose-strong:text-gray-600"
              dangerouslySetInnerHTML={{ __html: update.content }}
            />
          </div>

          {/* Features section */}
          {update.features && update.features.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">New Features</h3>
              <div className="space-y-3">
                {update.features.map((f) => (
                  <div key={f.id} className="flex gap-3">
                    <CheckCircle2 className="h-4 w-4 text-primary-light mt-0.5 shrink-0" />
                    <div>
                      <span className="text-gray-500 font-medium text-sm">{f.name}</span>
                      {f.description && (
                        <p className="text-gray-500 text-sm mt-0.5">{f.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {update.tags && update.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {update.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs text-white bg-primary-light px-2 py-0.5 rounded">
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Acknowledge button */}
          <div className="pt-4 border-t border-primary-light/20">
            <AcknowledgeButton
              updateId={update.id}
              isAcknowledged={!!update.is_acknowledged}
              onAcknowledge={onAcknowledge}
            />
          </div>
        </div>
      </div>
    );
  }

  // Card view (matches summary view from kb_plan.md)
  return (
    <div className={`bg-white border rounded-lg p-5 hover:bg-primary-light/10 hover:border-primary-light/50 transition-colors ${isUnread ? 'border-primary-light/20' : 'border-primary-light/20'}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox for bulk selection */}
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelectToggle}
            className="mt-1.5 h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 shrink-0 cursor-pointer"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Category + Priority + Unread dot */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {isUnread && (
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            )}
            {update.category && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary-light text-gray-300">
                {update.category.name}
              </span>
            )}
            {update.priority && update.priority !== 'low' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${priorityLabels[update.priority]?.color}`}>
                {priorityLabels[update.priority]?.label}
              </span>
            )}
          </div>

          {/* Title: "Version - Feature/Title" */}
          <h3 className="text-primary font-semibold text-base leading-snug mb-1">
            {displayTitle}
          </h3>

          {/* Date */}
          <p className="text-xs text-gray-500 mb-2">
            {formatDate(publishDate)}
          </p>

          {/* Summary */}
          <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-3">
            {update.summary || stripHtml(update.content)}
          </p>

          {/* Actions row */}
          <div className="flex items-center justify-between pt-2 border-t border-primary-light/20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1 text-sm text-primary hover:text-primary-light/80 font-medium transition-colors"
              >
                Read More
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {isAdmin && onEdit && (
                <button
                  onClick={() => onEdit(update)}
                  className="text-xs text-gray-500 hover:text-primary transition-colors"
                >
                  Edit
                </button>
              )}
              {isAdmin && onDelete && (
                <button
                  onClick={() => onDelete(update)}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
            <AcknowledgeButton
              updateId={update.id}
              isAcknowledged={!!update.is_acknowledged}
              onAcknowledge={onAcknowledge}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
