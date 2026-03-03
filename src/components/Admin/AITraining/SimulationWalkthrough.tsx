'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    Brain, Send, CheckCircle, XCircle, ArrowRight, Loader2,
    ChevronDown, ChevronUp, Flag, RotateCcw, Zap,
} from 'lucide-react';

interface CallNode {
    id: string;
    type: string;
    title: string;
    script: string;
    context?: string;
    listenFor?: string[];
    responses?: Array<{
        label: string;
        nextNode: string;
        isSpecialInstruction?: boolean;
        aiCondition?: string;
    }>;
}

interface SimulationStep {
    id: string;
    step_number: number;
    from_node_id: string;
    utterance: string;
    tier_hit: number | null;
    resolved_node_id: string | null;
    resolved_node_title: string | null;
    resolved_confidence: string | null;
    similarity_score: number | null;
    tier3_reasoning: string | null;
    matched_phrase: string | null;
    review_status: 'pending' | 'confirmed' | 'corrected' | 'rejected';
    admin_node_id: string | null;
    applied_to_cache: boolean;
}

interface Session {
    id: string;
    title: string;
    status: string;
    step_count: number;
    call_flow_id: string;
    current_node_id: string;
}

const TIER_BADGE: Record<number, { label: string; className: string }> = {
    1: { label: 'Exact Match', className: 'bg-green-100 text-green-700 border-green-200' },
    2: { label: 'Semantic Match', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    3: { label: 'AI Match', className: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const REVIEW_BADGE: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-500',
    confirmed: 'bg-green-100 text-green-700',
    corrected: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-600',
};

interface Props {
    sessionId: string;
}

export function SimulationWalkthrough({ sessionId }: Props) {
    const { session } = useAuth();
    const { currentProduct } = useProduct();
    const router = useRouter();

    const [sessionData, setSessionData] = useState<Session | null>(null);
    const [currentNode, setCurrentNode] = useState<CallNode | null>(null);
    const [steps, setSteps] = useState<SimulationStep[]>([]);
    const [loading, setLoading] = useState(true);

    const [utterance, setUtterance] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [latestStep, setLatestStep] = useState<SimulationStep | null>(null);
    const [latestResolvedNode, setLatestResolvedNode] = useState<CallNode | null>(null);

    const [correcting, setCorrecting] = useState(false);
    const [correctingStepId, setCorrectingStepId] = useState<string | null>(null);
    const [allNodes, setAllNodes] = useState<Array<{ id: string; title: string }>>([]);
    const [correctionNodeId, setCorrectionNodeId] = useState('');

    const [applying, setApplying] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [historyExpanded, setHistoryExpanded] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const headers = useCallback(
        () => ({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            'X-Product-Id': currentProduct?.id ?? '',
        }),
        [session?.access_token, currentProduct?.id]
    );

    const loadSession = useCallback(async () => {
        if (!session?.access_token || !currentProduct?.id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/ai-training/sessions/${sessionId}`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'X-Product-Id': currentProduct.id,
                },
            });
            if (!res.ok) throw new Error('Session not found');
            const data = await res.json();
            setSessionData(data.session);
            setSteps(data.steps || []);

            // Fetch current node
            if (data.session.current_node_id) {
                await fetchNodeData(data.session.current_node_id);
            }
        } catch (err) {
            toast.error('Failed to load session');
            router.push('/admin/ai-training/simulate');
        } finally {
            setLoading(false);
        }
    }, [session?.access_token, currentProduct?.id, sessionId]);

    const fetchNodeData = async (nodeId: string): Promise<CallNode | null> => {
        if (!session?.access_token || !currentProduct?.id) return null;
        const res = await fetch('/api/admin/scripts/nodes', {
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                'X-Product-Id': currentProduct.id,
            },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const node = (Array.isArray(data) ? data : []).find((n: any) => n.id === nodeId);
        if (node) setCurrentNode(node);
        return node ?? null;
    };

    useEffect(() => { void loadSession(); }, [loadSession]);

    // Fetch all nodes for correction picker (lazy, only when needed)
    const fetchAllNodes = useCallback(async () => {
        if (allNodes.length > 0 || !session?.access_token || !currentProduct?.id) return;
        const res = await fetch('/api/admin/scripts/nodes', {
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                'X-Product-Id': currentProduct.id,
            },
        });
        if (res.ok) {
            const data = await res.json();
            setAllNodes((Array.isArray(data) ? data : []).map((n: any) => ({ id: n.id, title: n.title })));
        }
    }, [allNodes.length, session?.access_token, currentProduct?.id]);

    const handleSubmitUtterance = async () => {
        if (!utterance.trim() || submitting) return;
        setSubmitting(true);
        setLatestStep(null);
        setLatestResolvedNode(null);

        try {
            const res = await fetch(`/api/admin/ai-training/sessions/${sessionId}/step`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ utterance: utterance.trim() }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Step failed');
            }

            const data = await res.json();
            setLatestStep(data.step);
            setLatestResolvedNode(data.resolved_node ?? null);
            setSteps(prev => [...prev, data.step]);
            setSessionData(prev => prev ? { ...prev, step_count: (prev.step_count || 0) + 1 } : prev);
            setUtterance('');
            textareaRef.current?.focus();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to submit utterance');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReview = async (stepId: string, status: 'confirmed' | 'corrected' | 'rejected', nodeId?: string) => {
        try {
            const res = await fetch(
                `/api/admin/ai-training/sessions/${sessionId}/steps/${stepId}`,
                {
                    method: 'PATCH',
                    headers: headers(),
                    body: JSON.stringify({
                        review_status: status,
                        ...(nodeId && { admin_node_id: nodeId }),
                    }),
                }
            );

            if (!res.ok) throw new Error('Failed to review step');
            const data = await res.json();

            // Update the local step list
            setSteps(prev =>
                prev.map(s =>
                    s.id === stepId
                        ? { ...s, review_status: status, admin_node_id: nodeId ?? null }
                        : s
                )
            );

            // Advance current node if confirmed/corrected
            if (status !== 'rejected' && data.next_node) {
                setCurrentNode(data.next_node);
                setSessionData(prev =>
                    prev ? { ...prev, current_node_id: data.next_node.id } : prev
                );
            }

            // Clear the latest step card now that it's been reviewed
            if (latestStep?.id === stepId) {
                setLatestStep(null);
                setLatestResolvedNode(null);
            }

            setCorrecting(false);
            setCorrectingStepId(null);
            setCorrectionNodeId('');

            if (status === 'confirmed') toast.success('Approved — moved to next node');
            else if (status === 'corrected') toast.success('Corrected — moved to corrected node');
            else toast.info('Skipped — staying on current node');
        } catch (err) {
            toast.error('Failed to update step');
        }
    };

    const handleApply = async () => {
        setApplying(true);
        try {
            const res = await fetch(`/api/admin/ai-training/sessions/${sessionId}/apply`, {
                method: 'POST',
                headers: headers(),
            });
            if (!res.ok) throw new Error('Apply failed');
            const data = await res.json();
            toast.success(`Applied ${data.applied} entries to cache${data.skipped > 0 ? ` (${data.skipped} skipped)` : ''}`);
            // Refresh steps to show applied state
            void loadSession();
        } catch {
            toast.error('Failed to apply to cache');
        } finally {
            setApplying(false);
        }
    };

    const handleComplete = async () => {
        setCompleting(true);
        try {
            const res = await fetch(`/api/admin/ai-training/sessions/${sessionId}/complete`, {
                method: 'POST',
                headers: headers(),
            });
            if (!res.ok) throw new Error('Complete failed');
            const data = await res.json();
            toast.success(`Session completed — ${data.summary.confirmed + data.summary.corrected} steps ready to apply`);
            setSessionData(prev => prev ? { ...prev, status: 'completed' } : prev);
        } catch {
            toast.error('Failed to complete session');
        } finally {
            setCompleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!sessionData || !currentNode) return null;

    const pendingCount = steps.filter(s => s.review_status === 'pending').length;
    const confirmedCount = steps.filter(s => s.review_status === 'confirmed' || s.review_status === 'corrected').length;
    const appliedCount = steps.filter(s => s.applied_to_cache).length;
    const isCompleted = sessionData.status === 'completed';

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-4">
            {/* Session header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        <h1 className="text-lg font-bold text-gray-900">{sessionData.title}</h1>
                        {isCompleted && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Completed</span>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Flow: {sessionData.call_flow_id} &nbsp;·&nbsp; {sessionData.step_count} steps &nbsp;·&nbsp;
                        {confirmedCount} approved &nbsp;·&nbsp; {appliedCount} applied to cache
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {confirmedCount > appliedCount && (
                        <button
                            onClick={handleApply}
                            disabled={applying}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                            Apply to Cache
                        </button>
                    )}
                    {!isCompleted && (
                        <button
                            onClick={handleComplete}
                            disabled={completing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
                        >
                            {completing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
                            End Session
                        </button>
                    )}
                </div>
            </div>

            {/* Current node */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">{currentNode.type}</span>
                    <span className="text-xs text-gray-400">Current Node</span>
                </div>
                <h2 className="font-semibold text-gray-900 mb-1">{currentNode.title}</h2>
                {currentNode.script && (
                    <p className="text-sm text-gray-600 leading-relaxed">{currentNode.script}</p>
                )}
                {currentNode.listenFor && currentNode.listenFor.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-xs text-gray-400">Listen for:</span>
                        {currentNode.listenFor.map((l, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                {l}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* AI result card */}
            {latestStep && (
                <div className="bg-white border-2 border-primary/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">Prospect said:</p>
                            <p className="text-sm font-medium text-gray-800">"{latestStep.utterance}"</p>
                        </div>
                        {latestStep.tier_hit && TIER_BADGE[latestStep.tier_hit] && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${TIER_BADGE[latestStep.tier_hit].className}`}>
                                {TIER_BADGE[latestStep.tier_hit].label}
                                {latestStep.similarity_score ? ` (${latestStep.similarity_score}%)` : ''}
                            </span>
                        )}
                        {!latestStep.tier_hit && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-red-50 text-red-600 border-red-200 shrink-0">
                                No Match
                            </span>
                        )}
                    </div>

                    {latestStep.resolved_node_id ? (
                        <div className="flex items-center gap-2 text-sm">
                            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-medium text-gray-900">{latestStep.resolved_node_title}</span>
                            {latestStep.resolved_confidence && (
                                <span className="text-xs text-gray-400">({latestStep.resolved_confidence} confidence)</span>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">AI could not determine a navigation target.</p>
                    )}

                    {latestStep.matched_phrase && (
                        <p className="text-xs text-gray-400">
                            Matched: "{latestStep.matched_phrase}"
                        </p>
                    )}
                    {latestStep.tier3_reasoning && (
                        <p className="text-xs text-gray-500 italic">{latestStep.tier3_reasoning}</p>
                    )}

                    {/* Review actions */}
                    {latestStep.review_status === 'pending' && latestStep.resolved_node_id && (
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={() => handleReview(latestStep.id, 'confirmed')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors"
                            >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Approve & Continue
                            </button>
                            <button
                                onClick={() => {
                                    setCorrecting(true);
                                    setCorrectingStepId(latestStep.id);
                                    void fetchAllNodes();
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Correct
                            </button>
                            <button
                                onClick={() => handleReview(latestStep.id, 'rejected')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                            >
                                <XCircle className="h-3.5 w-3.5" />
                                Skip
                            </button>
                        </div>
                    )}

                    {/* Correction picker */}
                    {correcting && correctingStepId === latestStep.id && (
                        <div className="flex items-center gap-2 pt-1">
                            <select
                                value={correctionNodeId}
                                onChange={e => setCorrectionNodeId(e.target.value)}
                                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                            >
                                <option value="">— Select correct node —</option>
                                {allNodes.map(n => (
                                    <option key={n.id} value={n.id}>{n.title}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => correctionNodeId && handleReview(latestStep.id, 'corrected', correctionNodeId)}
                                disabled={!correctionNodeId}
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                            >
                                Apply
                            </button>
                            <button
                                onClick={() => { setCorrecting(false); setCorrectingStepId(null); setCorrectionNodeId(''); }}
                                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Utterance input */}
            {!isCompleted && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                        What does the prospect say?
                    </label>
                    <textarea
                        ref={textareaRef}
                        value={utterance}
                        onChange={e => setUtterance(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                void handleSubmitUtterance();
                            }
                        }}
                        placeholder="Type a prospect utterance… (Cmd+Enter to submit)"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={handleSubmitUtterance}
                            disabled={submitting || !utterance.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {submitting ? 'Analyzing...' : 'Submit'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step history */}
            {steps.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setHistoryExpanded(p => !p)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                        <span className="text-sm font-medium text-gray-700">
                            Step History ({steps.length})
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                                {pendingCount > 0 && `${pendingCount} pending review`}
                            </span>
                            {historyExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </div>
                    </button>

                    {historyExpanded && (
                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                            {[...steps].reverse().map(step => (
                                <div key={step.id} className="px-4 py-3 flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-400 mb-0.5">Step {step.step_number}</p>
                                        <p className="text-sm text-gray-800 truncate">"{step.utterance}"</p>
                                        {step.resolved_node_title && (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                → {step.review_status === 'corrected' && step.admin_node_id
                                                    ? `(corrected)`
                                                    : step.resolved_node_title}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {step.applied_to_cache && (
                                            <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">cached</span>
                                        )}
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REVIEW_BADGE[step.review_status] ?? ''}`}>
                                            {step.review_status}
                                        </span>
                                        {/* Allow retroactive review of pending steps */}
                                        {step.review_status === 'pending' && step.id !== latestStep?.id && step.resolved_node_id && (
                                            <button
                                                onClick={() => handleReview(step.id, 'confirmed')}
                                                className="text-xs text-green-600 hover:underline"
                                            >
                                                Approve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
