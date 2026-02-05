'use client';

import { useState } from 'react';
import {
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Target,
  DollarSign,
  Users,
} from 'lucide-react';
import type { Competitor } from '@/types/competitor';
import type { KBUpdate } from '@/types/knowledgeBase';

interface CompetitorCardProps {
  competitor: Competitor;
  updates?: KBUpdate[];
  onUpdateClick?: (update: KBUpdate) => void;
}

export function CompetitorCard({ competitor, updates = [], onUpdateClick }: CompetitorCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {competitor.logo_url ? (
            <img
              src={competitor.logo_url}
              alt={competitor.name}
              className="w-10 h-10 rounded-lg object-cover bg-gray-100"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-gray-400" />
            </div>
          )}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">{competitor.name}</h3>
              {competitor.website && (
                <a
                  href={competitor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            {competitor.description && (
              <p className="text-sm text-gray-500 line-clamp-1">{competitor.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {updates.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {updates.length} update{updates.length !== 1 ? 's' : ''}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {/* Full Description */}
          {competitor.description && (
            <p className="text-sm text-gray-600 mt-4">{competitor.description}</p>
          )}

          {/* Strengths & Limitations */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Strengths */}
            {competitor.strengths.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  Their Strengths
                </h4>
                <ul className="space-y-1">
                  {competitor.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-500 pl-3 border-l-2 border-green-200">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Limitations */}
            {competitor.limitations.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  Their Limitations
                </h4>
                <ul className="space-y-1">
                  {competitor.limitations.map((l, i) => (
                    <li key={i} className="text-sm text-gray-500 pl-3 border-l-2 border-red-200">
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Our Advantage */}
          {competitor.our_advantage && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100">
              <h4 className="flex items-center gap-2 text-sm font-medium text-green-700 mb-1">
                <Target className="h-4 w-4" />
                Our Advantage
              </h4>
              <p className="text-sm text-green-600">{competitor.our_advantage}</p>
            </div>
          )}

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {competitor.positioning && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
                  <Target className="h-4 w-4 text-gray-400" />
                  Their Positioning
                </h4>
                <p className="text-sm text-gray-500">{competitor.positioning}</p>
              </div>
            )}

            {competitor.target_market && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
                  <Users className="h-4 w-4 text-gray-400" />
                  Their Target Market
                </h4>
                <p className="text-sm text-gray-500">{competitor.target_market}</p>
              </div>
            )}

            {competitor.pricing_info && (
              <div className="col-span-2">
                <h4 className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  Pricing Intelligence
                </h4>
                <p className="text-sm text-gray-500">{competitor.pricing_info}</p>
              </div>
            )}
          </div>

          {/* Related Updates */}
          {updates.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-600 mb-3">Related Updates</h4>
              <div className="space-y-2">
                {updates.map((update) => (
                  <button
                    key={update.id}
                    onClick={() => onUpdateClick?.(update)}
                    className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{update.title}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(update.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {update.summary && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{update.summary}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
