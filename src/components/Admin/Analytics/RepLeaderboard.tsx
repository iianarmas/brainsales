'use client';

import { useRouter } from 'next/navigation';
import { Trophy, ChevronRight } from 'lucide-react';

interface Rep {
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalCalls: number;
  outcomes: Record<string, number>;
  successCount: number;
  successRate: number;
  avgDurationSeconds: number | null;
  avgAdherenceScore?: number | null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function AdherencePill({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-gray-300">--</span>;
  }
  const color =
    score >= 85 ? 'text-green-600 bg-green-50 border-green-200' :
      score >= 70 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
        'text-red-600 bg-red-50 border-red-200';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {score.toFixed(0)}%
    </span>
  );
}

export function RepLeaderboard({ reps }: { reps: Rep[] }) {
  const router = useRouter();

  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="text-base font-semibold text-primary">Rep Leaderboard</h3>
      </div>

      {reps.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No rep data available</p>
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="grid grid-cols-[24px_32px_1fr_60px_60px_28px] items-center gap-2 px-3 pb-1 border-b border-border-subtle">
            <span className="text-[10px] text-muted-foreground font-medium">#</span>
            <span />
            <span className="text-[10px] text-muted-foreground font-medium">Rep</span>
            <span className="text-[10px] text-muted-foreground font-medium text-right">Wins</span>
            <span className="text-[10px] text-muted-foreground font-medium text-right">Adhrnc</span>
            <span />
          </div>
          {reps.map((rep, i) => (
            <button
              key={rep.userId}
              onClick={() => router.push(`/admin/analytics/rep/${rep.userId}`)}
              className={`w-full grid grid-cols-[24px_32px_1fr_60px_60px_28px] items-center gap-2 p-3 rounded-lg text-left transition-colors ${i === 0
                ? 'bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20'
                : 'hover:bg-surface-hover border border-transparent'
                }`}
            >
              {/* Rank */}
              <span className={`text-sm font-bold text-center ${i === 0 ? 'text-amber-600' : i === 1 ? 'text-muted-foreground' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'
                }`}>
                {i + 1}
              </span>

              {/* Avatar */}
              {rep.avatarUrl ? (
                <img
                  src={rep.avatarUrl}
                  alt={rep.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary-light/20 flex items-center justify-center text-xs font-medium text-primary">
                  {rep.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              )}

              {/* Name and calls */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{rep.name}</p>
                <p className="text-xs text-muted-foreground">
                  {rep.totalCalls} calls · {formatDuration(rep.avgDurationSeconds)}
                </p>
              </div>

              {/* Success metrics */}
              <div className="text-right">
                <p className="text-sm font-bold text-green-600">{rep.successRate}%</p>
                <p className="text-xs text-muted-foreground">{rep.successCount} successes</p>
              </div>

              {/* Adherence */}
              <div className="flex justify-end">
                <AdherencePill score={rep.avgAdherenceScore} />
              </div>

              {/* Chevron */}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
