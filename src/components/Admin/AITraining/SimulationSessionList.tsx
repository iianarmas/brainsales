'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Brain, Plus, Play, CheckCircle, Clock, Loader2, ChevronRight } from 'lucide-react';
import { NewSessionModal } from './NewSessionModal';

interface SimulationSession {
    id: string;
    title: string;
    status: 'active' | 'paused' | 'completed';
    step_count: number;
    call_flow_id: string;
    opening_node_id: string;
    current_node_id: string;
    created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-green-100 text-green-700' },
    paused: { label: 'Paused', className: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
};

export function SimulationSessionList() {
    const { session } = useAuth();
    const { currentProduct } = useProduct();
    const router = useRouter();

    const [sessions, setSessions] = useState<SimulationSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewModal, setShowNewModal] = useState(false);

    const fetchSessions = useCallback(async () => {
        if (!session?.access_token || !currentProduct?.id) return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/ai-training/sessions', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'X-Product-Id': currentProduct.id,
                },
            });
            if (!res.ok) throw new Error('Failed to load sessions');
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch (err) {
            toast.error('Failed to load simulation sessions');
        } finally {
            setLoading(false);
        }
    }, [session?.access_token, currentProduct?.id]);

    useEffect(() => { void fetchSessions(); }, [fetchSessions]);

    const handleSessionCreated = (sessionId: string) => {
        router.push(`/admin/ai-training/simulate/${sessionId}`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Brain className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">AI Training — Simulation</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Walk through a call flow as the prospect to train the AI cache
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowNewModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                    <Plus className="h-4 w-4" />
                    New Session
                </button>
            </div>

            {/* How it works */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-sm text-blue-800">
                <strong>How it works:</strong> Select a call flow → start from the opening node → type what the prospect might say → AI navigates to the right node → approve or correct → repeat until the call ends. Apply all confirmed steps to the cache when done.
            </div>

            {/* Session list */}
            {sessions.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-gray-600">No simulation sessions yet</p>
                    <p className="text-sm mt-1">Create your first session to start training the AI</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sessions.map((s) => {
                        const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.active;
                        return (
                            <button
                                key={s.id}
                                onClick={() => router.push(`/admin/ai-training/simulate/${s.id}`)}
                                className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-primary/40 hover:bg-gray-50 transition-all text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    {s.status === 'completed' ? (
                                        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                                    ) : s.status === 'active' ? (
                                        <Play className="h-5 w-5 text-primary shrink-0" />
                                    ) : (
                                        <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900">{s.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Flow: {s.call_flow_id} &nbsp;·&nbsp; {s.step_count} steps &nbsp;·&nbsp;{' '}
                                            {new Date(s.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                                        {badge.label}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {showNewModal && (
                <NewSessionModal
                    onClose={() => setShowNewModal(false)}
                    onCreated={handleSessionCreated}
                />
            )}
        </div>
    );
}
