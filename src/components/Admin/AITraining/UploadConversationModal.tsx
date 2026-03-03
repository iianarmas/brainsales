'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { toast } from 'sonner';
import { X, FileText, Loader2, Upload } from 'lucide-react';

interface OpeningNode {
    id: string;
    title: string;
}

interface Props {
    onClose: () => void;
    onUploaded: (conversationId: string) => void;
}

const PLACEHOLDER = `PROSPECT: Hi, who is this?
REP: Hi, this is Alex from Acme Corp. I'm reaching out because...
PROSPECT: I'm not really sure we're looking for anything new right now.
REP: Totally understand. Can I ask what you're currently using for...
PROSPECT: We use Salesforce actually, we've been pretty happy with it.`;

export function UploadConversationModal({ onClose, onUploaded }: Props) {
    const { session } = useAuth();
    const { currentProduct } = useProduct();

    const [openingNodes, setOpeningNodes] = useState<OpeningNode[]>([]);
    const [loadingNodes, setLoadingNodes] = useState(true);
    const [title, setTitle] = useState('');
    const [selectedCallFlowId, setSelectedCallFlowId] = useState('');
    const [rawTranscript, setRawTranscript] = useState('');
    const [uploading, setUploading] = useState(false);

    const fetchOpeningNodes = useCallback(async () => {
        if (!session?.access_token || !currentProduct?.id) return;
        setLoadingNodes(true);
        try {
            const res = await fetch('/api/admin/scripts/nodes', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'X-Product-Id': currentProduct.id,
                },
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            const nodes: OpeningNode[] = (data.nodes || [])
                .filter((n: any) => n.type === 'opening')
                .map((n: any) => ({ id: n.id, title: n.title }));
            setOpeningNodes(nodes);
            if (nodes.length === 1) setSelectedCallFlowId(nodes[0].id);
        } catch {
            toast.error('Failed to load call flows');
        } finally {
            setLoadingNodes(false);
        }
    }, [session?.access_token, currentProduct?.id]);

    useEffect(() => { void fetchOpeningNodes(); }, [fetchOpeningNodes]);

    const handleUpload = async () => {
        if (!title.trim() || !selectedCallFlowId || !rawTranscript.trim()) {
            toast.error('Please fill in all fields');
            return;
        }
        if (!session?.access_token || !currentProduct?.id) return;

        // Quick sanity check for transcript format
        const hasValidFormat = /^(prospect|rep|customer|sales|agent)\s*:/im.test(rawTranscript);
        if (!hasValidFormat) {
            toast.error('Transcript must use PROSPECT: / REP: format (see placeholder)');
            return;
        }

        setUploading(true);
        try {
            const res = await fetch('/api/admin/ai-training/conversations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                    'X-Product-Id': currentProduct.id,
                },
                body: JSON.stringify({
                    title: title.trim(),
                    raw_transcript: rawTranscript.trim(),
                    call_flow_id: selectedCallFlowId,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Upload failed');
            }

            const data = await res.json();
            toast.success('Transcript uploaded — Claude is processing it now');
            onUploaded(data.id);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-gray-900">Upload Training Transcript</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Sample cold call — competitor objection"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Call Flow</label>
                            {loadingNodes ? (
                                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </div>
                            ) : (
                                <select
                                    value={selectedCallFlowId}
                                    onChange={e => setSelectedCallFlowId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                                >
                                    <option value="">— Select call flow —</option>
                                    {openingNodes.map(n => (
                                        <option key={n.id} value={n.id}>{n.title}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Transcript
                        </label>
                        <p className="text-xs text-gray-400 mb-2">
                            Use <code className="bg-gray-100 px-1 rounded">PROSPECT:</code> and <code className="bg-gray-100 px-1 rounded">REP:</code> prefixes. Alternating turns. Can be real or invented.
                        </p>
                        <textarea
                            value={rawTranscript}
                            onChange={e => setRawTranscript(e.target.value)}
                            placeholder={PLACEHOLDER}
                            rows={12}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Also accepts: CUSTOMER:, CLIENT:, SALES:, AGENT:
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={uploading || !title.trim() || !selectedCallFlowId || !rawTranscript.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {uploading ? 'Uploading...' : 'Process Transcript'}
                    </button>
                </div>
            </div>
        </div>
    );
}
