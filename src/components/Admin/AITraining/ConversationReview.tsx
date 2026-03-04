'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    CheckCircle, XCircle, RotateCcw, Zap, Loader2, AlertTriangle,
    ArrowLeft, ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react';

interface TrainingEntry {
    id: string;
    utterance: string;
    utterance_context: string | null;
    is_gap: boolean;
    suggested_node_id: string | null;
    suggested_confidence: string | null;
    claude_reasoning: string | null;
    review_status: 'pending' | 'confirmed' | 'corrected' | 'rejected';
    admin_node_id: string | null;
    admin_notes: string | null;
    gap_suggested_title: string | null;
    gap_suggested_type: string | null;
    gap_suggested_script: string | null;
    gap_suggested_ai_condition: string | null;
    applied_at: string | null;
}

interface Conversation {
    id: string;
    title: string;
    status: string;
    entry_count: number;
    gap_count: number;
    call_flow_id: string;
    error_message: string | null;
}

interface Summary {
    total: number;
    confirmed: number;
    corrected: number;
    rejected: number;
    pending: number;
    gaps: number;
    applied: number;
}

interface Props {
    conversationId: string;
}

function getScriptSnippet(script: string, query: string): string {
    if (!script) return '';
    if (!query.trim()) return script.length > 130 ? script.slice(0, 130) + '…' : script;
    const lq = query.toLowerCase();
    const idx = script.toLowerCase().indexOf(lq);
    if (idx === -1) return script.length > 130 ? script.slice(0, 130) + '…' : script;
    const start = Math.max(0, idx - 40);
    const end = Math.min(script.length, idx + query.length + 90);
    return (start > 0 ? '…' : '') + script.slice(start, end) + (end < script.length ? '…' : '');
}

const CONFIDENCE_BADGE: Record<string, string> = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-red-100 text-red-600',
};

const REVIEW_BADGE: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-500',
    confirmed: 'bg-green-100 text-green-700',
    corrected: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-600',
};

export function ConversationReview({ conversationId }: Props) {
    const { session } = useAuth();
    const { currentProduct } = useProduct();
    const router = useRouter();

    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [entries, setEntries] = useState<TrainingEntry[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);

    const [allNodes, setAllNodes] = useState<Array<{ id: string; title: string; script: string; call_flow_ids: string[] | null }>>([]);
    const [correctingId, setCorrectingId] = useState<string | null>(null);
    const [correctionNodeId, setCorrectionNodeId] = useState('');
    const [nodeSearch, setNodeSearch] = useState('');
    const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);

    const [applying, setApplying] = useState(false);
    const [gapsExpanded, setGapsExpanded] = useState(false);

    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const headers = () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        'X-Product-Id': currentProduct?.id ?? '',
    });

    const fetchConversation = useCallback(async () => {
        if (!session?.access_token || !currentProduct?.id) return;
        try {
            const res = await fetch(`/api/admin/ai-training/conversations/${conversationId}`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'X-Product-Id': currentProduct.id,
                },
            });
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            setConversation(data.conversation);
            setEntries(data.entries || []);
            setSummary(data.summary);
        } catch {
            toast.error('Failed to load conversation');
            router.push('/admin/ai-training/conversations');
        } finally {
            setLoading(false);
        }
    }, [session?.access_token, currentProduct?.id, conversationId]);

    useEffect(() => { void fetchConversation(); }, [fetchConversation]);

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
            const callFlowId = conversation?.call_flow_id;
            const filtered = (Array.isArray(data) ? data : []).filter((n: any) => {
                const flowIds: string[] | null = n.call_flow_ids;
                return !flowIds || flowIds.length === 0 || (callFlowId && flowIds.includes(callFlowId));
            });
            setAllNodes(filtered.map((n: any) => ({
                id: n.id,
                title: n.title,
                script: n.script || '',
                call_flow_ids: n.call_flow_ids ?? null,
            })));
        }
    }, [allNodes.length, session?.access_token, currentProduct?.id, conversation?.call_flow_id]);

    // Poll while processing
    useEffect(() => {
        if (!conversation) return;
        if (conversation.status === 'processing' || conversation.status === 'pending') {
            pollingRef.current = setInterval(() => void fetchConversation(), 3000);
        } else {
            if (pollingRef.current) clearInterval(pollingRef.current);
            // Eagerly load node scripts once conversation is done
            void fetchAllNodes();
        }
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [conversation?.status, fetchConversation, fetchAllNodes]);

    const handleReview = async (entryId: string, status: 'confirmed' | 'corrected' | 'rejected', nodeId?: string) => {
        try {
            const res = await fetch(`/api/admin/ai-training/entries/${entryId}`, {
                method: 'PATCH',
                headers: headers(),
                body: JSON.stringify({
                    review_status: status,
                    ...(nodeId && { admin_node_id: nodeId }),
                }),
            });
            if (!res.ok) throw new Error();

            setEntries(prev => prev.map(e =>
                e.id === entryId
                    ? { ...e, review_status: status, admin_node_id: nodeId ?? e.admin_node_id }
                    : e
            ));
            setSummary(prev => {
                if (!prev) return prev;
                const entry = entries.find(e => e.id === entryId)!;
                const oldStatus = entry.review_status;
                return {
                    ...prev,
                    [oldStatus]: Math.max(0, prev[oldStatus as keyof Summary] as number - 1),
                    [status]: (prev[status as keyof Summary] as number) + 1,
                };
            });

            setCorrectingId(null);
            setCorrectionNodeId('');
            setNodeSearch('');
            setPreviewNodeId(null);
        } catch {
            toast.error('Failed to update entry');
        }
    };

    const handleApplyAll = async () => {
        setApplying(true);
        try {
            const res = await fetch(`/api/admin/ai-training/conversations/${conversationId}/apply`, {
                method: 'POST',
                headers: headers(),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            toast.success(`Applied ${data.applied} entries to the AI cache`);
            void fetchConversation();
        } catch {
            toast.error('Failed to apply entries');
        } finally {
            setApplying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!conversation) return null;

    const filteredCorrectionNodes = allNodes.filter(n => {
        if (!nodeSearch.trim()) return true;
        const q = nodeSearch.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.script.toLowerCase().includes(q);
    });

    const isProcessing = conversation.status === 'processing' || conversation.status === 'pending';
    const matchedEntries = entries.filter(e => !e.is_gap);
    const gapEntries = entries.filter(e => e.is_gap);
    const readyToApply = (summary?.confirmed ?? 0) + (summary?.corrected ?? 0);
    const appliedCount = summary?.applied ?? 0;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <button
                        onClick={() => router.push('/admin/ai-training/conversations')}
                        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-2"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        All Transcripts
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">{conversation.title}</h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Flow: {conversation.call_flow_id} &nbsp;·&nbsp;
                        {summary && `${summary.confirmed + summary.corrected} approved · ${summary.pending} pending · ${summary.rejected} rejected · ${appliedCount} applied`}
                    </p>
                </div>
                {readyToApply > appliedCount && (
                    <button
                        onClick={handleApplyAll}
                        disabled={applying}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        Apply Confirmed to Cache
                    </button>
                )}
            </div>

            {/* Processing state */}
            {isProcessing && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    BrainSales is analyzing your transcript… this usually takes 15–30 seconds.
                </div>
            )}

            {/* Error state */}
            {conversation.status === 'error' && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Processing failed</p>
                        {conversation.error_message && (
                            <p className="mt-0.5 text-red-600">{conversation.error_message}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Matched entries */}
            {!isProcessing && matchedEntries.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-gray-700">
                        Matched Entries ({matchedEntries.length})
                    </h2>
                    {matchedEntries.map(entry => (
                        <div
                            key={entry.id}
                            className={`bg-white border rounded-xl p-4 space-y-2 ${
                                entry.review_status === 'confirmed' ? 'border-green-200' :
                                entry.review_status === 'corrected' ? 'border-blue-200' :
                                entry.review_status === 'rejected' ? 'border-gray-200 opacity-60' :
                                'border-gray-200'
                            }`}
                        >
                            {entry.utterance_context && (
                                <p className="text-xs text-gray-400 italic">{entry.utterance_context}</p>
                            )}
                            <p className="text-sm font-medium text-gray-800">"{entry.utterance}"</p>

                            {(() => {
                                const displayNodeId = (entry.review_status === 'corrected' && entry.admin_node_id)
                                    ? entry.admin_node_id
                                    : entry.suggested_node_id;
                                const nodeData = allNodes.find(n => n.id === displayNodeId);
                                const isCorrected = entry.review_status === 'corrected' && entry.admin_node_id;
                                return (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
                                            <span className={`text-sm font-medium ${isCorrected ? 'text-blue-700' : 'text-gray-800'}`}>
                                                {nodeData?.title ?? displayNodeId}
                                                {isCorrected && <span className="ml-1 font-normal text-blue-500">(corrected)</span>}
                                            </span>
                                            {entry.suggested_confidence && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CONFIDENCE_BADGE[entry.suggested_confidence] ?? ''}`}>
                                                    {entry.suggested_confidence}
                                                </span>
                                            )}
                                            {entry.applied_at && (
                                                <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">cached</span>
                                            )}
                                        </div>
                                        {nodeData?.script && (
                                            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 ml-6 italic leading-relaxed">
                                                {nodeData.script}
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

                            {entry.claude_reasoning && (
                                <p className="text-xs text-gray-500 italic">{entry.claude_reasoning}</p>
                            )}

                            {/* Review actions */}
                            {entry.review_status === 'pending' && !entry.applied_at && (
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        onClick={() => handleReview(entry.id, 'confirmed')}
                                        className="flex items-center gap-1 px-2.5 py-1 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600"
                                    >
                                        <CheckCircle className="h-3 w-3" /> Confirm
                                    </button>
                                    <button
                                        onClick={() => { setCorrectingId(entry.id); void fetchAllNodes(); }}
                                        className="flex items-center gap-1 px-2.5 py-1 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600"
                                    >
                                        <RotateCcw className="h-3 w-3" /> Correct
                                    </button>
                                    <button
                                        onClick={() => handleReview(entry.id, 'rejected')}
                                        className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"
                                    >
                                        <XCircle className="h-3 w-3" /> Reject
                                    </button>
                                </div>
                            )}

                            {/* Status badge for non-pending */}
                            {entry.review_status !== 'pending' && (
                                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${REVIEW_BADGE[entry.review_status]}`}>
                                    {entry.review_status}
                                </span>
                            )}

                            {/* Correction node picker */}
                            {correctingId === entry.id && (
                                <div className="pt-1 space-y-2">
                                    <input
                                        type="text"
                                        value={nodeSearch}
                                        onChange={e => setNodeSearch(e.target.value)}
                                        placeholder="Search by title or script…"
                                        autoFocus
                                        className="w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                    />
                                    <div
                                        className="rounded-lg border overflow-y-auto"
                                        style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '12rem' }}
                                    >
                                        {filteredCorrectionNodes.length === 0 ? (
                                            <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                                                No nodes match "{nodeSearch}"
                                            </p>
                                        ) : filteredCorrectionNodes.map((n, i) => {
                                            const isSelected = correctionNodeId === n.id;
                                            const isExpanded = previewNodeId === n.id;
                                            const snippet = getScriptSnippet(n.script, nodeSearch);
                                            return (
                                                <div
                                                    key={n.id}
                                                    style={{
                                                        background: isSelected ? 'var(--primary-subtle-bg)' : undefined,
                                                        borderBottom: i < filteredCorrectionNodes.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrectionNodeId(isSelected ? '' : n.id)}
                                                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
                                                    >
                                                        <span className="text-xs font-medium truncate" style={{ color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                                                            {n.title}
                                                        </span>
                                                        {isSelected && <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--primary)' }} />}
                                                    </button>
                                                    {n.script && (
                                                        <div className="px-3 pb-2 -mt-1">
                                                            <p
                                                                className="text-xs leading-relaxed"
                                                                style={{
                                                                    color: 'var(--text-muted)',
                                                                    display: '-webkit-box',
                                                                    WebkitLineClamp: isExpanded ? undefined : 2,
                                                                    WebkitBoxOrient: 'vertical' as const,
                                                                    overflow: isExpanded ? undefined : 'hidden',
                                                                }}
                                                            >
                                                                {snippet}
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewNodeId(isExpanded ? null : n.id)}
                                                                className="text-xs mt-0.5 hover:underline"
                                                                style={{ color: 'var(--text-muted)' }}
                                                            >
                                                                {isExpanded ? 'Show less ↑' : 'Show full script ↓'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => correctionNodeId && handleReview(entry.id, 'corrected', correctionNodeId)}
                                            disabled={!correctionNodeId}
                                            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                                        >
                                            Apply Correction
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setCorrectingId(null); setCorrectionNodeId(''); setNodeSearch(''); setPreviewNodeId(null); }}
                                            className="px-3 py-1.5 text-xs rounded-lg transition-colors hover:underline"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Gap entries */}
            {!isProcessing && gapEntries.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setGapsExpanded(p => !p)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-800">
                                Gaps Detected ({gapEntries.length})
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-600">
                                These utterances have no matching script node
                            </span>
                            {gapsExpanded ? (
                                <ChevronUp className="h-4 w-4 text-amber-600" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-amber-600" />
                            )}
                        </div>
                    </button>

                    {gapsExpanded && (
                        <div className="divide-y divide-amber-100">
                            {gapEntries.map(entry => (
                                <div key={entry.id} className="px-4 py-4 bg-white space-y-2">
                                    {entry.utterance_context && (
                                        <p className="text-xs text-gray-400 italic">{entry.utterance_context}</p>
                                    )}
                                    <p className="text-sm font-medium text-gray-800">"{entry.utterance}"</p>
                                    <p className="text-xs text-amber-700">{entry.claude_reasoning}</p>

                                    {entry.gap_suggested_title && (
                                        <div className="bg-amber-50 rounded-lg p-3 text-xs space-y-1">
                                            <p className="font-semibold text-amber-800">Suggested new node:</p>
                                            <p><strong>Title:</strong> {entry.gap_suggested_title}</p>
                                            <p><strong>Type:</strong> {entry.gap_suggested_type}</p>
                                            {entry.gap_suggested_script && (
                                                <p><strong>Script:</strong> {entry.gap_suggested_script}</p>
                                            )}
                                            {entry.gap_suggested_ai_condition && (
                                                <p><strong>Trigger:</strong> "{entry.gap_suggested_ai_condition}"</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Review actions for gap entries */}
                                    {entry.review_status === 'pending' && !entry.applied_at && (
                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                onClick={() => { setCorrectingId(entry.id); void fetchAllNodes(); }}
                                                className="flex items-center gap-1 px-2.5 py-1 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600"
                                            >
                                                <RotateCcw className="h-3 w-3" /> Map to Node
                                            </button>
                                            <button
                                                onClick={() => handleReview(entry.id, 'rejected')}
                                                className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"
                                            >
                                                <XCircle className="h-3 w-3" /> Reject
                                            </button>
                                        </div>
                                    )}

                                    {entry.review_status !== 'pending' && (
                                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${REVIEW_BADGE[entry.review_status]}`}>
                                            {entry.review_status}
                                        </span>
                                    )}

                                    {/* Correction node picker for gaps */}
                                    {correctingId === entry.id && (
                                        <div className="pt-1 space-y-2">
                                            <input
                                                type="text"
                                                value={nodeSearch}
                                                onChange={e => setNodeSearch(e.target.value)}
                                                placeholder="Search by title or script…"
                                                autoFocus
                                                className="w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                            />
                                            <div
                                                className="rounded-lg border overflow-y-auto"
                                                style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '12rem' }}
                                            >
                                                {filteredCorrectionNodes.length === 0 ? (
                                                    <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                                                        No nodes match "{nodeSearch}"
                                                    </p>
                                                ) : filteredCorrectionNodes.map((n, i) => {
                                                    const isSelected = correctionNodeId === n.id;
                                                    const isExpanded = previewNodeId === n.id;
                                                    const snippet = getScriptSnippet(n.script, nodeSearch);
                                                    return (
                                                        <div
                                                            key={n.id}
                                                            style={{
                                                                background: isSelected ? 'var(--primary-subtle-bg)' : undefined,
                                                                borderBottom: i < filteredCorrectionNodes.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => setCorrectionNodeId(isSelected ? '' : n.id)}
                                                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
                                                            >
                                                                <span className="text-xs font-medium truncate" style={{ color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                                                                    {n.title}
                                                                </span>
                                                                {isSelected && <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--primary)' }} />}
                                                            </button>
                                                            {n.script && (
                                                                <div className="px-3 pb-2 -mt-1">
                                                                    <p
                                                                        className="text-xs leading-relaxed"
                                                                        style={{
                                                                            color: 'var(--text-muted)',
                                                                            display: '-webkit-box',
                                                                            WebkitLineClamp: isExpanded ? undefined : 2,
                                                                            WebkitBoxOrient: 'vertical' as const,
                                                                            overflow: isExpanded ? undefined : 'hidden',
                                                                        }}
                                                                    >
                                                                        {snippet}
                                                                    </p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPreviewNodeId(isExpanded ? null : n.id)}
                                                                        className="text-xs mt-0.5 hover:underline"
                                                                        style={{ color: 'var(--text-muted)' }}
                                                                    >
                                                                        {isExpanded ? 'Show less ↑' : 'Show full script ↓'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => correctionNodeId && handleReview(entry.id, 'corrected', correctionNodeId)}
                                                    disabled={!correctionNodeId}
                                                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                                                >
                                                    Apply Correction
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setCorrectingId(null); setCorrectionNodeId(''); setNodeSearch(''); setPreviewNodeId(null); }}
                                                    className="px-3 py-1.5 text-xs rounded-lg transition-colors hover:underline"
                                                    style={{ color: 'var(--text-muted)' }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {!isProcessing && conversation.status !== 'error' && entries.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    <p className="text-sm">No entries extracted. Check that your transcript uses PROSPECT: / REP: format.</p>
                </div>
            )}
        </div>
    );
}
