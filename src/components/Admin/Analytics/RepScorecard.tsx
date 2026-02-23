'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Phone,
    TrendingUp,
    Clock,
    CheckCircle,
    ShieldCheck,
    Loader2,
    Calendar,
    AlertCircle,
} from 'lucide-react';

// --- Types ---

interface RepProfile {
    userId: string;
    name: string;
    avatarUrl: string | null;
}

interface RecentSession {
    sessionId: string;
    startedAt: string;
    outcome: string | null;
    durationSeconds: number | null;
    adherenceScore: number | null;
    callFlowTitle: string | null;
    prospectName: string | null;
    organization: string | null;
}

interface TopObjection {
    nodeId: string;
    nodeTitle: string;
    count: number;
}

interface ScorecardData {
    dateRange: { from: string; to: string };
    profile: RepProfile;
    grade: 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';
    totalCalls: number;
    successCount: number;
    successRate: number;
    avgDurationSeconds: number | null;
    avgAdherenceScore: number | null;
    sessionsWithAdherence: number;
    outcomes: Record<string, number>;
    topObjections: TopObjection[];
    recentSessions: RecentSession[];
}

// --- Helpers ---

function formatDuration(seconds: number | null): string {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

const OUTCOME_LABELS: Record<string, string> = {
    meeting_set: 'Meeting Set',
    follow_up: 'Follow-up',
    send_info: 'Sent Info',
    not_interested: 'Not Interested',
    no_answer: 'No Answer',
    wrong_person: 'Wrong Person',
};

const OUTCOME_COLORS: Record<string, string> = {
    meeting_set: 'bg-green-100 text-green-700',
    follow_up: 'bg-blue-100 text-blue-700',
    send_info: 'bg-purple-100 text-purple-700',
    not_interested: 'bg-red-100 text-red-700',
    no_answer: 'bg-gray-100 text-gray-600',
    wrong_person: 'bg-orange-100 text-orange-700',
};

const GRADE_COLORS: Record<string, string> = {
    A: 'bg-green-500',
    B: 'bg-blue-500',
    C: 'bg-yellow-500',
    D: 'bg-orange-500',
    F: 'bg-red-500',
    'N/A': 'bg-gray-400',
};

// --- Sub-components ---

function StatCard({
    label,
    value,
    sub,
    icon: Icon,
    color = 'text-primary',
}: {
    label: string;
    value: string | number;
    sub?: string;
    icon: typeof Phone;
    color?: string;
}) {
    return (
        <div className="bg-white border border-primary-light/20 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary-light/15 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary-light" />
                </div>
                <span className="text-xs text-gray-500">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    );
}

function AdherenceBar({ score }: { score: number | null }) {
    if (score === null) return <span className="text-xs text-gray-400">No data yet</span>;
    const color = score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-sm font-semibold text-gray-700 w-12 text-right">{score.toFixed(1)}%</span>
        </div>
    );
}

// --- Main component ---

export function RepScorecard({ userId }: { userId: string }) {
    const { session } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<ScorecardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRange, setSelectedRange] = useState(90);

    const RANGES = [
        { label: '30d', days: 30 },
        { label: '90d', days: 90 },
        { label: '180d', days: 180 },
    ];

    const fetchData = useCallback(
        async (days: number) => {
            if (!session?.access_token) return;
            setLoading(true);
            try {
                const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
                const to = new Date().toISOString();
                const res = await fetch(
                    `/api/analytics/scorecard/${userId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
                    { headers: { Authorization: `Bearer ${session.access_token}` } }
                );
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to load scorecard');
                }
                setData(await res.json());
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to load scorecard');
            } finally {
                setLoading(false);
            }
        },
        [session?.access_token, userId]
    );

    useEffect(() => {
        fetchData(selectedRange);
    }, [fetchData, selectedRange]);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!data) return null;

    const gradeColor = GRADE_COLORS[data.grade] || GRADE_COLORS['N/A'];
    const totalOutcomes = Object.values(data.outcomes).reduce((a, b) => a + b, 0);

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Back button */}
            <button
                onClick={() => router.push('/admin/analytics')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-6 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Analytics
            </button>

            {/* Header */}
            <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    {/* Avatar */}
                    {data.profile.avatarUrl ? (
                        <img
                            src={data.profile.avatarUrl}
                            alt={data.profile.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-primary-light/30"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-primary-light/20 flex items-center justify-center text-xl font-bold text-primary">
                            {data.profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-primary">{data.profile.name}</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {data.totalCalls} calls · {formatDate(data.dateRange.from)} – {formatDate(data.dateRange.to)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Date range selector */}
                    <div className="flex items-center gap-1 bg-white border border-primary-light/20 rounded-lg p-1">
                        {RANGES.map((r) => (
                            <button
                                key={r.days}
                                onClick={() => setSelectedRange(r.days)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedRange === r.days
                                    ? 'bg-primary text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Grade badge */}
                    <div className={`w-14 h-14 rounded-2xl ${gradeColor} flex items-center justify-center shadow-lg`}>
                        <span className="text-2xl font-black text-white">{data.grade}</span>
                    </div>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    label="Total Calls"
                    value={data.totalCalls}
                    icon={Phone}
                />
                <StatCard
                    label="Success Rate"
                    value={`${data.successRate}%`}
                    sub={`${data.successCount} successes`}
                    icon={CheckCircle}
                    color="text-green-600"
                />
                <StatCard
                    label="Script Adherence"
                    value={data.avgAdherenceScore !== null ? `${data.avgAdherenceScore.toFixed(1)}%` : '--'}
                    sub={data.sessionsWithAdherence > 0 ? `${data.sessionsWithAdherence} sessions tracked` : 'No data yet'}
                    icon={ShieldCheck}
                    color={
                        data.avgAdherenceScore === null ? 'text-gray-400' :
                            data.avgAdherenceScore >= 85 ? 'text-green-600' :
                                data.avgAdherenceScore >= 70 ? 'text-yellow-600' :
                                    'text-red-600'
                    }
                />
                <StatCard
                    label="Avg Call Duration"
                    value={formatDuration(data.avgDurationSeconds)}
                    icon={Clock}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Outcome breakdown */}
                <div className="bg-white border border-primary-light/20 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-5 w-5 text-primary-light" />
                        <h2 className="text-sm font-semibold text-primary">Outcome Breakdown</h2>
                    </div>
                    {totalOutcomes === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No outcomes logged yet</p>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(data.outcomes)
                                .sort(([, a], [, b]) => b - a)
                                .map(([outcome, count]) => {
                                    const pct = Math.round((count / totalOutcomes) * 100);
                                    const barColor =
                                        outcome === 'meeting_set' ? 'bg-green-500' :
                                            outcome === 'follow_up' ? 'bg-blue-500' :
                                                outcome === 'not_interested' ? 'bg-red-400' :
                                                    'bg-gray-300';
                                    return (
                                        <div key={outcome}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-gray-600">
                                                    {OUTCOME_LABELS[outcome] || outcome}
                                                </span>
                                                <span className="text-xs font-semibold text-gray-700">
                                                    {count} ({pct}%)
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Top objections */}
                <div className="bg-white border border-primary-light/20 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="h-5 w-5 text-orange-400" />
                        <h2 className="text-sm font-semibold text-primary">Top Objections Encountered</h2>
                    </div>
                    {data.topObjections.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No objection data yet</p>
                    ) : (
                        <div className="space-y-3">
                            {data.topObjections.map((obj, i) => (
                                <div key={obj.nodeId} className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-700 truncate">{obj.nodeTitle}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                                        {obj.count}×
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent sessions table */}
            <div className="bg-white border border-primary-light/20 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                    <Calendar className="h-5 w-5 text-primary-light" />
                    <h2 className="text-sm font-semibold text-primary">Recent Sessions</h2>
                    <span className="text-xs text-gray-400 ml-auto">Last {data.recentSessions.length} calls</span>
                </div>
                {data.recentSessions.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No sessions in this period</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                    <th className="px-4 py-3 text-left font-medium">Date</th>
                                    <th className="px-4 py-3 text-left font-medium">Prospect</th>
                                    <th className="px-4 py-3 text-left font-medium">Call Flow</th>
                                    <th className="px-4 py-3 text-center font-medium">Outcome</th>
                                    <th className="px-4 py-3 text-center font-medium">Adherence</th>
                                    <th className="px-4 py-3 text-right font-medium">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.recentSessions.map((s) => (
                                    <tr key={s.sessionId} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                            {formatDate(s.startedAt)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 max-w-[140px]">
                                            <p className="truncate font-medium">{s.prospectName || '—'}</p>
                                            {s.organization && (
                                                <p className="text-xs text-gray-400 truncate">{s.organization}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px]">
                                            <span className="truncate block">{s.callFlowTitle || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {s.outcome ? (
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OUTCOME_COLORS[s.outcome] || 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {OUTCOME_LABELS[s.outcome] || s.outcome}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {s.adherenceScore !== null ? (
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${s.adherenceScore >= 85 ? 'bg-green-500' :
                                                                s.adherenceScore >= 70 ? 'bg-yellow-500' : 'bg-red-400'
                                                                }`}
                                                            style={{ width: `${s.adherenceScore}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-600 w-9 text-right">
                                                        {s.adherenceScore.toFixed(0)}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600 font-mono text-xs whitespace-nowrap">
                                            {formatDuration(s.durationSeconds)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Adherence explanation */}
            {data.avgAdherenceScore === null && data.totalCalls > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                        <strong>Adherence tracking is now active.</strong> Future sessions will track how closely this rep follows their assigned call flow. Historical sessions created before adherence tracking was enabled will show "—".
                    </p>
                </div>
            )}
        </div>
    );
}
