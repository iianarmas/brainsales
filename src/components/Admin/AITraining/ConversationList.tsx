'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    FileText, Plus, CheckCircle, AlertTriangle, Loader2,
    Clock, ChevronRight, AlertCircle, Trash2,
} from 'lucide-react';
import { UploadConversationModal } from './UploadConversationModal';

interface Conversation {
    id: string;
    title: string;
    status: 'pending' | 'processing' | 'ready' | 'error' | 'applied';
    entry_count: number;
    gap_count: number;
    call_flow_id: string;
    error_message: string | null;
    created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string; icon?: React.ReactNode }> = {
    pending: { label: 'Pending', className: 'bg-gray-100 text-gray-500' },
    processing: { label: 'Processing...', className: 'bg-amber-100 text-amber-700' },
    ready: { label: 'Ready to Review', className: 'bg-blue-100 text-blue-700' },
    error: { label: 'Error', className: 'bg-red-100 text-red-600' },
    applied: { label: 'Applied', className: 'bg-green-100 text-green-700' },
};

export function ConversationList() {
    const { session } = useAuth();
    const { currentProduct } = useProduct();
    const router = useRouter();

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);

    const fetchConversations = useCallback(async () => {
        if (!session?.access_token || !currentProduct?.id) return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/ai-training/conversations', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'X-Product-Id': currentProduct.id,
                },
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setConversations(data.conversations || []);
        } catch {
            toast.error('Failed to load conversations');
        } finally {
            setLoading(false);
        }
    }, [session?.access_token, currentProduct?.id]);

    useEffect(() => { void fetchConversations(); }, [fetchConversations]);

    // Poll every 3 seconds while any conversation is still processing
    useEffect(() => {
        const hasProcessing = conversations.some(c => c.status === 'processing' || c.status === 'pending');
        if (!hasProcessing) return;
        const interval = setInterval(() => void fetchConversations(), 3000);
        return () => clearInterval(interval);
    }, [conversations, fetchConversations]);

    const handleDelete = async (e: React.MouseEvent, convId: string) => {
        e.stopPropagation();
        if (!confirm('Delete this transcript and all its entries? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/admin/ai-training/conversations/${convId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                    'X-Product-Id': currentProduct?.id ?? '',
                },
            });
            if (!res.ok) throw new Error();
            setConversations(prev => prev.filter(c => c.id !== convId));
            toast.success('Transcript deleted');
        } catch {
            toast.error('Failed to delete transcript');
        }
    };

    const handleUploaded = (convId: string) => {
        setShowUploadModal(false);
        void fetchConversations();
        router.push(`/admin/ai-training/conversations/${convId}`);
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
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">AI Training — Transcripts</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Upload call transcripts to bulk-train the AI navigation cache
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                    <Plus className="h-4 w-4" />
                    Upload Transcript
                </button>
            </div>

            {/* How it works */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-sm text-blue-800">
                <strong>How it works:</strong> Paste a text transcript in <code>PROSPECT: / REP:</code> format → Claude maps each prospect utterance to the correct navigation node → review the suggestions → apply confirmed entries to the AI cache in one click. Transcripts don't need to be from real calls — sample or invented conversations work just as well.
            </div>

            {/* Conversation list */}
            {conversations.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-gray-600">No transcripts uploaded yet</p>
                    <p className="text-sm mt-1">Upload your first transcript to start bulk-training</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {conversations.map((c) => {
                        const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.pending;
                        return (
                            <button
                                key={c.id}
                                onClick={() => c.status !== 'processing' && c.status !== 'pending'
                                    ? router.push(`/admin/ai-training/conversations/${c.id}`)
                                    : undefined
                                }
                                disabled={c.status === 'processing' || c.status === 'pending'}
                                className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-primary/40 hover:bg-gray-50 transition-all text-left group disabled:cursor-default disabled:hover:bg-white disabled:hover:border-gray-200"
                            >
                                <div className="flex items-center gap-3">
                                    {c.status === 'processing' || c.status === 'pending' ? (
                                        <Loader2 className="h-5 w-5 text-amber-500 animate-spin shrink-0" />
                                    ) : c.status === 'error' ? (
                                        <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                                    ) : c.status === 'applied' ? (
                                        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                                    ) : (
                                        <FileText className="h-5 w-5 text-primary shrink-0" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900">{c.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Flow: {c.call_flow_id}
                                            {c.status === 'ready' || c.status === 'applied' ? (
                                                <>
                                                    &nbsp;·&nbsp; {c.entry_count} entries
                                                    {c.gap_count > 0 && (
                                                        <span className="text-amber-600">&nbsp;·&nbsp; {c.gap_count} gaps</span>
                                                    )}
                                                </>
                                            ) : c.status === 'error' ? (
                                                <span className="text-red-500">&nbsp;·&nbsp; {c.error_message}</span>
                                            ) : null}
                                            &nbsp;·&nbsp; {new Date(c.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {c.gap_count > 0 && (
                                        <span className="flex items-center gap-0.5 text-xs text-amber-600">
                                            <AlertTriangle className="h-3 w-3" />
                                            {c.gap_count} gaps
                                        </span>
                                    )}
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                                        {badge.label}
                                    </span>
                                    <button
                                        onClick={(e) => handleDelete(e, c.id)}
                                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Delete transcript"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    {c.status !== 'processing' && c.status !== 'pending' && (
                                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {showUploadModal && (
                <UploadConversationModal
                    onClose={() => setShowUploadModal(false)}
                    onUploaded={handleUploaded}
                />
            )}
        </div>
    );
}
