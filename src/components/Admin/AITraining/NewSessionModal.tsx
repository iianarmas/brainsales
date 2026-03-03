'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { toast } from 'sonner';
import { X, Loader2, Brain } from 'lucide-react';
import { ThemedSelect } from '@/components/ThemedSelect';

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
            const nodes: OpeningNode[] = (Array.isArray(data) ? data : [])
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
            <div className="bg-surface-elevated w-full max-w-md rounded-xl shadow-2xl border border-border-subtle">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">New Simulation Session</h2>
                        {currentProduct?.name && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {currentProduct.name}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-active transition-colors">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Session Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Cold call — price objection path"
                            className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Call Flow (Opening Node)</label>
                        {loadingNodes ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading call flows...
                            </div>
                        ) : openingNodes.length === 0 ? (
                            <p className="text-sm text-destructive">No opening nodes found for this product.</p>
                        ) : (
                            <ThemedSelect
                                variant="form"
                                value={selectedNodeId}
                                onChange={setSelectedNodeId}
                                options={openingNodes.map(n => ({ id: n.id, name: n.title }))}
                                placeholder="— Select a call flow —"
                                className="w-full"
                            />
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                            Training will be scoped to this call flow's cache entries.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-subtle">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
