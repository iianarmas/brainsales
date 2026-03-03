'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProduct } from '@/context/ProductContext';
import { toast } from 'sonner';
import { X, FileText, Loader2, Upload, FolderOpen } from 'lucide-react';
import { ThemedSelect } from '@/components/ThemedSelect';

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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [openingNodes, setOpeningNodes] = useState<OpeningNode[]>([]);
    const [loadingNodes, setLoadingNodes] = useState(true);
    const [title, setTitle] = useState('');
    const [selectedCallFlowId, setSelectedCallFlowId] = useState('');
    const [rawTranscript, setRawTranscript] = useState('');
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState('');

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
            if (nodes.length === 1) setSelectedCallFlowId(nodes[0].id);
        } catch {
            toast.error('Failed to load call flows');
        } finally {
            setLoadingNodes(false);
        }
    }, [session?.access_token, currentProduct?.id]);

    useEffect(() => { void fetchOpeningNodes(); }, [fetchOpeningNodes]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.txt')) {
            toast.error('Only .txt files are supported');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setRawTranscript(text);
            setFileName(file.name);
            if (!title.trim()) setTitle(file.name.replace(/\.txt$/i, ''));
        };
        reader.readAsText(file);
    };

    const handleUpload = async () => {
        if (!title.trim() || !selectedCallFlowId || !rawTranscript.trim()) {
            toast.error('Please fill in all fields');
            return;
        }
        if (!session?.access_token || !currentProduct?.id) return;

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
            <div className="bg-surface-elevated w-full max-w-2xl rounded-xl shadow-2xl border border-border-subtle flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold text-foreground">Upload Training Transcript</h2>
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
                <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Sample cold call — competitor objection"
                                className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">Call Flow</label>
                            {loadingNodes ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                </div>
                            ) : openingNodes.length === 0 ? (
                                <p className="text-sm text-destructive py-1">No call flows found for this product.</p>
                            ) : (
                                <ThemedSelect
                                    variant="form"
                                    value={selectedCallFlowId}
                                    onChange={setSelectedCallFlowId}
                                    options={openingNodes.map(n => ({ id: n.id, name: n.title }))}
                                    placeholder="— Select call flow —"
                                    className="w-full"
                                />
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-foreground">
                                Transcript
                            </label>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                            >
                                <FolderOpen className="h-3.5 w-3.5" />
                                {fileName ? fileName : 'Load from .txt file'}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                            Use <code className="bg-surface-active px-1 rounded">PROSPECT:</code> and <code className="bg-surface-active px-1 rounded">REP:</code> prefixes. Alternating turns. Can be real or invented.
                        </p>
                        <textarea
                            value={rawTranscript}
                            onChange={e => { setRawTranscript(e.target.value); setFileName(''); }}
                            placeholder={PLACEHOLDER}
                            rows={12}
                            className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm font-mono resize-none bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Also accepts: CUSTOMER:, CLIENT:, SALES:, AGENT:
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-subtle shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
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
