'use client';

import { Trophy } from 'lucide-react';

interface Rep {
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalCalls: number;
  outcomes: Record<string, number>;
  successCount: number;
  successRate: number;
  avgDurationSeconds: number | null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RepLeaderboard({ reps }: { reps: Rep[] }) {
  return (
    <div className="bg-white border border-primary-light/20 rounded-xl p-5 shadow-xl">
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="text-base font-semibold text-primary">Rep Leaderboard</h3>
      </div>

      {reps.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No rep data available</p>
      ) : (
        <div className="space-y-3">
          {reps.map((rep, i) => (
            <div
              key={rep.userId}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                i === 0 ? 'bg-amber-50 border border-amber-200' : 'hover:bg-gray-50'
              } transition-colors`}
            >
              {/* Rank */}
              <span className={`text-sm font-bold w-6 text-center ${
                i === 0 ? 'text-amber-600' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-amber-700' : 'text-gray-400'
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

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{rep.name}</p>
                <p className="text-xs text-gray-400">
                  {rep.totalCalls} calls &middot; avg {formatDuration(rep.avgDurationSeconds)}
                </p>
              </div>

              {/* Success metrics */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-green-600">{rep.successRate}%</p>
                <p className="text-xs text-gray-400">{rep.successCount} meetings</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
