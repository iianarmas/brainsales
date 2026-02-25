import { useState, useMemo } from 'react';
import { useCallStore } from '@/store/callStore';
import { Search, X, CheckCircle2, ChevronRight } from 'lucide-react';

export function AICorrectionOverlay({
    onClose,
    phraseHash,
    phraseSnippet,
    wrongNodeId
}: {
    onClose: () => void;
    phraseHash: string;
    phraseSnippet: string;
    wrongNodeId: string;
}) {
    const { scripts, productId } = useCallStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const nodes = Object.values(scripts).filter(n => n.type !== 'end' && n.title);

    const filteredNodes = useMemo(() => {
        if (!searchQuery.trim()) return nodes;
        const lowerQuery = searchQuery.toLowerCase();
        return nodes.filter(n =>
            n.title.toLowerCase().includes(lowerQuery) ||
            (n.script && n.script.toLowerCase().includes(lowerQuery))
        );
    }, [nodes, searchQuery]);

    const handleCorrect = async (correctNodeId: string) => {
        if (!productId) return;
        setIsSubmitting(true);

        try {
            // We need org_id, fetch it client side from supabase or an API
            // But actually, the API route can infer the organization_id from the user,
            // Wait, our correct route currently expects organization_id in the body.
            // We'll let the user provide it via auth in the API route, or we fetch it here.
            // Let's just grab the user's active org client-side.

            const { supabase } = await import('@/app/lib/supabaseClient');
            const { data: { user } } = await supabase.auth.getUser();
            const { data } = await supabase.from('organization_members').select('organization_id').eq('user_id', user?.id).single();
            const organization_id = data?.organization_id;

            if (!organization_id) throw new Error("Could not find org");

            const res = await fetch('/api/ai/cache/correct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phrase_snippet: phraseSnippet,
                    wrong_node_id: wrongNodeId,
                    correct_node_id: correctNodeId,
                    organization_id
                })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => onClose(), 2000);
            } else {
                throw new Error("Failed to correct");
            }
        } catch (e) {
            console.error(e);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col max-h-[80vh] overflow-hidden">
                {success ? (
                    <div className="p-8 text-center flex flex-col items-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                        <h3 className="text-xl font-bold text-zinc-900 mb-2">Correction Saved</h3>
                        <p className="text-zinc-500">The AI will navigate instantly to the new node next time it hears this phrase.</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b border-zinc-100 flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-lg text-zinc-900">Correct the AI</h3>
                                <p className="text-sm text-zinc-500 mt-1">
                                    Teach the AI where it should have navigated when the prospect said:
                                </p>
                                <div className="mt-3 p-3 bg-zinc-50 rounded italic text-sm text-zinc-700 border border-zinc-200">
                                    "{phraseSnippet}"
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-zinc-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="Search for the correct node..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            {filteredNodes.length === 0 ? (
                                <div className="p-4 text-center text-zinc-500 text-sm">No nodes found matching your search.</div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {filteredNodes.map(node => (
                                        <button
                                            key={node.id}
                                            onClick={() => handleCorrect(node.id)}
                                            disabled={isSubmitting || node.id === wrongNodeId}
                                            className={`flex items-center justify-between p-3 rounded-lg text-sm text-left transition-colors
                        ${node.id === wrongNodeId
                                                    ? 'bg-red-50 text-red-700 cursor-not-allowed opacity-50'
                                                    : 'hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900'}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{node.title}</span>
                                                <span className="text-xs text-zinc-500 truncate w-64">{node.type}</span>
                                            </div>
                                            {node.id === wrongNodeId ? (
                                                <span className="text-xs font-medium px-2 py-1 bg-red-100 rounded text-red-700">Wrong Choice</span>
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-zinc-400" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
