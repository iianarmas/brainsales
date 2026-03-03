'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { toast } from 'sonner';
import { X, Loader2, Brain } from 'lucide-react';

interface OpeningNode {
    id: string;
    title: string;
}

interface Props {
    onClose: () => void;
    onCreated: (sessionId: string) => void;
}

export function NewSessionModal({ onClose, onCreated }: Props) {
    const { session } = useAuth();
    const { currentProduct } = useProduct();

    const [openingNodes, setOpeningNodes] = useState<OpeningNode[]>([]);
    const [loadingNodes, setLoadingNodes] = useState(true);
    const [title, setTitle] = useState('');
    const [selectedNodeId, setSelectedNodeId] = useState('');
    const [creating, setCreating] = useState(false);

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
            if (nodes.length === 1) setSelectedNodeId(nodes[0].id);
        } catch {
            toast.error('Failed to load opening nodes');
        } finally {
            setLoadingNodes(false);
        }
    }, [session?.access_token, currentProduct?.id]);

    useEffect(() => { void fetchOpeningNodes(); }, [fetchOpeningNodes]);

    const handleCreate = async () => {
        if (!title.trim() || !selectedNodeId) {
            toast.error('Please fill in all fields');
            return;
        }
        if (!session?.access_token || !currentProduct?.id) return;

        setCreating(true);
        try {
            const res = await fetch('/api/admin/ai-training/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                    'X-Product-Id': currentProduct.id,
                },
                body: JSON.stringify({
                    title: title.trim(),
                    call_flow_id: selectedNodeId,
                    opening_node_id: selectedNodeId,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create session');
            }

            const data = await res.json();
            toast.success('Session created');
            onCreated(data.session.id);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create session');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-gray-900">New Simulation Session</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Session Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Cold call — price objection path"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Call Flow (Opening Node)</label>
                        {loadingNodes ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading call flows...
                            </div>
                        ) : openingNodes.length === 0 ? (
                            <p className="text-sm text-red-500">No opening nodes found for this product.</p>
                        ) : (
                            <select
                                value={selectedNodeId}
                                onChange={e => setSelectedNodeId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                            >
                                <option value="">— Select a call flow —</option>
                                {openingNodes.map(n => (
                                    <option key={n.id} value={n.id}>{n.title}</option>
                                ))}
                            </select>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                            Training will be scoped to this call flow's cache entries.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={creating || !title.trim() || !selectedNodeId}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Start Session
                    </button>
                </div>
            </div>
        </div>
    );
}
