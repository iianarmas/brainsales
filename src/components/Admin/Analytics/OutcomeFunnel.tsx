'use client';

import { Target } from 'lucide-react';

const OUTCOME_LABELS: Record<string, string> = {
  meeting_set: 'Meeting Set',
  follow_up: 'Follow-up',
  send_info: 'Info Sent',
  not_interested: 'Not Interested',
  no_answer: 'No Answer',
  wrong_person: 'Wrong Person',
};

const OUTCOME_COLORS: Record<string, string> = {
  meeting_set: 'bg-green-500',
  follow_up: 'bg-blue-500',
  send_info: 'bg-amber-500',
  not_interested: 'bg-red-400',
  no_answer: 'bg-gray-400',
  wrong_person: 'bg-gray-300',
};

interface OutcomeFunnelProps {
  data: {
    total: number;
    outcomes: { outcome: string; count: number; percentage: number }[];
  };
}

export function OutcomeFunnel({ data }: OutcomeFunnelProps) {
  const sorted = [...data.outcomes].sort((a, b) => b.count - a.count);
  const maxCount = sorted[0]?.count || 1;

  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-5">
        <Target className="h-5 w-5 text-primary-light" />
        <h3 className="text-base font-semibold text-primary">Outcome Distribution</h3>
        <span className="ml-auto text-xs text-muted-foreground">{data.total} total</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No outcomes recorded yet</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((item) => (
            <div key={item.outcome}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-foreground">
                  {OUTCOME_LABELS[item.outcome] || item.outcome}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {item.count} <span className="text-muted-foreground text-xs">({item.percentage}%)</span>
                </span>
              </div>
              <div className="h-2.5 bg-surface-active rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${OUTCOME_COLORS[item.outcome] || 'bg-primary-light'
                    }`}
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
