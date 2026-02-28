"use client";

import { useCallStore } from "@/store/callStore";
import { useCompanionWebSocket } from "@/hooks/useCompanionWebSocket";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef, useState } from "react";
import { Bot, User, Mic, Sparkles, ArrowRight, X, Play, Pause, Square, ThumbsUp, ThumbsDown } from "lucide-react";
import type { AIRecommendation } from "@/hooks/useCompanionWebSocket";
import { AICorrectionOverlay } from "./AICorrectionOverlay";
import { Tooltip } from "./Tooltip";

// ── Signal Detection ─────────────────────────────────────────────────────────

type SignalType = "buying" | "objection" | "question" | null;

function detectSignal(text: string): SignalType {
    const t = text.toLowerCase();

    if (
        t.includes("sounds good") || t.includes("sounds great") || t.includes("i'm interested") ||
        t.includes("i am interested") || t.includes("when can") || t.includes("how do we") ||
        t.includes("let's do it") || t.includes("let's move") || t.includes("schedule") ||
        t.includes("set up a") || t.includes("love to") || t.includes("that works") ||
        t.includes("we'd like") || t.includes("we would like")
    ) return "buying";

    if (
        t.includes("not interested") || t.includes("no thank") || t.includes("don't call") ||
        t.includes("do not call") || t.includes("no budget") || t.includes("too expensive") ||
        t.includes("can't afford") || t.includes("already have") || t.includes("happy with") ||
        t.includes("send me info") || t.includes("send information") || t.includes("call back later") ||
        t.includes("busy right now") || t.includes("not the right time") || t.includes("remove me")
    ) return "objection";

    if (
        t.includes("what is") || t.includes("what's") || t.includes("how does") ||
        t.includes("how much") || t.includes("can you") || t.includes("tell me more") ||
        t.includes("what are") || t.includes("how long") || t.includes("how many") ||
        t.includes("do you offer") || t.includes("does it") || t.includes("is there") ||
        t.startsWith("why ") || t.startsWith("when ")
    ) return "question";

    return null;
}

interface SignalStyle {
    bubble: string;
    label: string;
    icon: string;
    tag: string;
}

function getSignalStyle(signal: SignalType): SignalStyle {
    switch (signal) {
        case "buying":
            return {
                bubble: "bg-emerald-500/10 border-l-4 border-emerald-500 text-foreground shadow-sm",
                label: "text-emerald-600 dark:text-emerald-400 font-black",
                icon: "📈",
                tag: "Buying Signal",
            };
        case "objection":
            return {
                bubble: "bg-rose-500/10 border-l-4 border-rose-500 text-foreground shadow-sm",
                label: "text-rose-600 dark:text-rose-400 font-black",
                icon: "⚠️",
                tag: "Objection",
            };
        case "question":
            return {
                bubble: "bg-sky-500/10 border-l-4 border-sky-500 text-foreground shadow-sm",
                label: "text-sky-600 dark:text-sky-400 font-black",
                icon: "❓",
                tag: "Question",
            };
        default:
            return {
                bubble: "bg-primary-subtle-bg border-border-subtle text-foreground shadow-sm",
                label: "",
                icon: "",
                tag: "",
            };
    }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LiveTranscript() {
    const {
        isCompanionActive,
        liveTranscript,
        toggleCompanion,
        scripts,
        aiRecommendation,
        transcriptionState,
        startTranscription,
        pauseTranscription,
        stopTranscription,
        pendingAINavigations,
        addPendingAINavigation,
        removePendingAINavigation,
        clearAllPendingAINavigations,
        productId,
    } = useCallStore();
    const { profile } = useAuth();
    const { isConnected, error } = useCompanionWebSocket();
    const [dismissedRec, setDismissedRec] = useState<AIRecommendation | null>(null);
    const [showCorrectionFor, setShowCorrectionFor] = useState<{ hash: string, snippet: string, nodeId: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of transcript
    useEffect(() => {
        const timer = setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [liveTranscript]);

    // Clear dismissed recommendation when a new one arrives
    useEffect(() => {
        if (aiRecommendation && aiRecommendation !== dismissedRec) {
            setDismissedRec(null);
        }
    }, [aiRecommendation]);

    // AI Navigation feedback window is now explicitly closed by user interaction

    if (!isCompanionActive) {
        return (
            <div className="w-full h-full border-l border-primary/20 bg-background flex flex-col items-center justify-center p-6 text-center transition-colors">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                    <Bot className="w-8 h-8 text-primary/40" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">AI Call Companion</h3>
                <p className="text-sm text-foreground/40 mb-6">
                    Turn on the Co-Pilot to transcribe your call and get real-time AI guidance.
                </p>
                <button
                    onClick={toggleCompanion}
                    className="bg-primary text-white px-6 py-2 rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-colors"
                >
                    Enable Co-Pilot
                </button>
            </div>
        );
    }

    // ── Status indicator helpers ──────────────────────────────────────────────
    const statusDot = transcriptionState === 'recording'
        ? <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        : transcriptionState === 'paused'
            ? <div className="w-2 h-2 rounded-full bg-amber-400" />
            : <div className="w-2 h-2 rounded-full bg-foreground/20" />;

    const statusLabel = transcriptionState === 'recording'
        ? (isConnected ? "Recording" : error ? "Connection Error" : "Connecting…")
        : transcriptionState === 'paused'
            ? "Paused"
            : "Ready";

    return (
        <div className="w-full h-full flex flex-col bg-background transition-colors">
            {/* Header */}
            <div className="p-3 flex items-center justify-between bg-primary/10 border-b border-primary/20 transition-colors">
                <div className="flex items-center gap-2">
                    {statusDot}
                    <span className="font-medium text-sm text-foreground/70">{statusLabel}</span>
                </div>
                {/* Close panel */}
                <Tooltip content="Close Co-Pilot" position="left" variant="invert">
                    <button
                        onClick={toggleCompanion}
                        className="p-1 text-foreground/30 hover:text-foreground/70 hover:bg-foreground/10 rounded transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </Tooltip>
            </div>

            {/* Controls Bar */}
            <div className="px-3 py-2 flex items-center gap-2">
                {/* Start / Resume */}
                {transcriptionState !== 'recording' && (
                    <Tooltip content={transcriptionState === 'paused' ? 'Resume transcription' : 'Start transcription'} variant="invert">
                        <button
                            onClick={startTranscription}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors shadow-sm"
                        >
                            <Play className="w-3.5 h-3.5 text-emerald-500" />
                            {transcriptionState === 'paused' ? 'Resume' : 'Start'}
                        </button>
                    </Tooltip>
                )}

                {/* Pause */}
                {transcriptionState === 'recording' && (
                    <Tooltip content="Pause transcription" variant="invert">
                        <button
                            onClick={pauseTranscription}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors shadow-sm"
                        >
                            <Pause className="w-3.5 h-3.5 text-amber-500" />
                            Pause
                        </button>
                    </Tooltip>
                )}

                {/* Stop */}
                {transcriptionState !== 'idle' && (
                    <Tooltip content="Stop and clear transcription" variant="invert">
                        <button
                            onClick={stopTranscription}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors shadow-sm"
                        >
                            <Square className="w-3.5 h-3.5 text-red-500" />
                            Stop
                        </button>
                    </Tooltip>
                )}

                {transcriptionState === 'idle' && (
                    <span className="text-xs text-foreground/30 italic">Click Start to begin transcribing</span>
                )}
            </div>

            {/* AI Suggestion Banner */}
            {aiRecommendation && aiRecommendation !== dismissedRec && aiRecommendation.recommendedNodeId && (() => {
                const targetNode = scripts[aiRecommendation.recommendedNodeId];
                return (
                    <div className="mx-3 p-3 bg-primary-subtle-bg border border-primary/20 rounded-lg flex items-start gap-2 text-xs transition-colors">
                        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-primary flex items-center gap-1">
                                AI Suggestion
                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${aiRecommendation.confidence === "high"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                    }`}>
                                    {aiRecommendation.confidence}
                                </span>
                            </div>
                            {targetNode && (
                                <div className="flex items-center gap-1 text-primary/80 mt-0.5 font-medium">
                                    <ArrowRight className="w-3 h-3" />
                                    {targetNode.title}
                                </div>
                            )}
                            <div className="text-primary/60 mt-1 leading-snug">{aiRecommendation.reasoning}</div>
                        </div>
                        <button
                            onClick={() => setDismissedRec(aiRecommendation)}
                            className="shrink-0 text-primary/40 hover:text-primary transition-colors"
                            title="Dismiss"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })()}

            {/* Batch Feedback Bar */}
            {pendingAINavigations.length > 1 && !showCorrectionFor && (
                <div className="mx-3 mb-2 p-3 bg-primary-subtle-bg border border-border-subtle rounded-lg flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-foreground/70 font-semibold text-xs text-primary">Batch Feedback ({pendingAINavigations.length} navigations)</span>
                        <Tooltip content="Clear all pending" position="left" variant="invert">
                            <button onClick={() => clearAllPendingAINavigations()} className="text-foreground/30 hover:text-foreground/60 transition-colors">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                if (productId) {
                                    try {
                                        const { supabase } = await import('@/app/lib/supabaseClient');
                                        const { data: { user } } = await supabase.auth.getUser();
                                        const { data } = await supabase.from('organization_members').select('organization_id').eq('user_id', user?.id).single();
                                        const organization_id = data?.organization_id;

                                        if (organization_id) {
                                            const { data: { session } } = await supabase.auth.getSession();
                                            const token = session?.access_token;

                                            // Batch process all pending approvals
                                            await Promise.all(pendingAINavigations.map(nav =>
                                                fetch("/api/ai/cache", {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                                                        "X-Product-Id": productId
                                                    },
                                                    body: JSON.stringify({
                                                        phrase_snippet: nav.phraseSnippet,
                                                        node_id: nav.navigatedNodeId,
                                                        organization_id,
                                                        reinforce: true
                                                    })
                                                })
                                            ));
                                        }
                                    } catch (e) {
                                        console.error("Failed to batch reinforce AI navigations", e);
                                    }
                                }
                                clearAllPendingAINavigations();
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground text-[11px] font-bold rounded shadow-sm transition-all"
                        >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            Approve All
                        </button>
                        <button
                            onClick={async () => {
                                if (productId) {
                                    try {
                                        const { supabase } = await import('@/app/lib/supabaseClient');
                                        const { data: { user } } = await supabase.auth.getUser();
                                        const { data } = await supabase.from('organization_members').select('organization_id').eq('user_id', user?.id).single();
                                        const organization_id = data?.organization_id;

                                        if (organization_id) {
                                            const { data: { session } } = await supabase.auth.getSession();
                                            const token = session?.access_token;

                                            // Batch process rejections (subtract 1 from hit count)
                                            await Promise.all(pendingAINavigations.map(nav =>
                                                fetch("/api/ai/cache", {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type": "application/json",
                                                        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                                                        "X-Product-Id": productId
                                                    },
                                                    body: JSON.stringify({
                                                        phrase_snippet: nav.phraseSnippet,
                                                        node_id: nav.navigatedNodeId,
                                                        organization_id,
                                                        reject: true
                                                    })
                                                })
                                            ));
                                        }
                                    } catch (e) {
                                        console.error("Failed to batch reject AI navigations", e);
                                    }
                                }
                                clearAllPendingAINavigations();
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface-active hover:bg-border-strong text-foreground text-[11px] font-bold rounded shadow-sm transition-all"
                        >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            Reject All
                        </button>
                    </div>
                </div>
            )}

            {/* Correction Overlay */}
            {showCorrectionFor && (
                <AICorrectionOverlay
                    phraseHash={showCorrectionFor.hash}
                    phraseSnippet={showCorrectionFor.snippet}
                    wrongNodeId={showCorrectionFor.nodeId}
                    onClose={() => setShowCorrectionFor(null)}
                />
            )}

            {/* Transcript Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" ref={scrollRef}>
                {error && transcriptionState === 'recording' && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg transition-colors">
                        Ensure the Tauri Companion app is running. Error: {error}
                    </div>
                )}

                {liveTranscript.length === 0 && transcriptionState === 'recording' && isConnected && (
                    <div className="flex flex-col items-center justify-center h-full text-foreground/40 space-y-3">
                        <Mic className="w-6 h-6 animate-pulse text-primary/40" />
                        <p className="text-sm">Listening to conversation...</p>
                    </div>
                )}

                {liveTranscript.length === 0 && transcriptionState === 'idle' && (
                    <div className="flex flex-col items-center justify-center h-full text-foreground/30 space-y-3 pt-8">
                        <Bot className="w-6 h-6 text-foreground/20" />
                        <p className="text-sm text-center">Press <span className="font-semibold text-emerald-500">Start</span> to begin transcribing your call.</p>
                    </div>
                )}

                {liveTranscript.length === 0 && transcriptionState === 'paused' && (
                    <div className="flex flex-col items-center justify-center h-full text-foreground/30 space-y-3 pt-8">
                        <Pause className="w-6 h-6 text-amber-400" />
                        <p className="text-sm text-center">Transcription paused. Press <span className="font-semibold text-emerald-500">Resume</span> to continue.</p>
                    </div>
                )}

                {liveTranscript.map((msg, i) => {
                    const isRep = msg.speaker === 0 || msg.speaker === undefined;
                    const signal = !isRep ? detectSignal(msg.text) : null;
                    const style = getSignalStyle(signal);
                    return (
                        <div key={i} className={`flex gap-3 text-sm ${isRep ? "flex-row-reverse" : ""}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden transition-colors ${isRep ? "bg-primary text-primary-foreground" : "bg-primary-subtle-bg text-text-muted"
                                }`}>
                                {isRep
                                    ? profile?.profile_picture_url
                                        ? <img src={profile.profile_picture_url} alt="Rep" className="w-full h-full object-cover" />
                                        : <User className="w-3.5 h-3.5" />
                                    : <Bot className="w-3.5 h-3.5" />}
                            </div>
                            <div className={`border rounded-xl p-3.5 max-w-[85%] transition-all ${isRep
                                ? "bg-primary border-primary text-primary-foreground font-medium shadow-sm"
                                : `shadow-md ${style.bubble}`
                                }`}>
                                {/* Signal label for prospect messages */}
                                {!isRep && signal && (
                                    <div className={`flex items-center gap-1 mb-1 text-[10px] font-bold uppercase tracking-wider ${style.label}`}>
                                        <span>{style.icon}</span>
                                        {style.tag}
                                    </div>
                                )}
                                {msg.text}
                            </div>

                            {/* Individual Feedback Buttons */}
                            {(() => {
                                const pendingNav = pendingAINavigations.find(n => n.phraseSnippet === msg.text || msg.text.includes(n.phraseSnippet));
                                if (!pendingNav || isRep) return null;
                                return (
                                    <div className="flex flex-col gap-1.5 mt-2 animate-in fade-in slide-in-from-top-1 transition-all">
                                        <div className="flex items-center gap-1 px-1">
                                            <Sparkles className="w-3 h-3 text-primary/40" />
                                            <span className="text-[10px] font-bold text-primary/40 uppercase tracking-tighter">AI Navigation Feedback</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={async () => {
                                                    if (productId) {
                                                        try {
                                                            const { supabase } = await import('@/app/lib/supabaseClient');
                                                            const { data: { user } } = await supabase.auth.getUser();
                                                            const { data } = await supabase.from('organization_members').select('organization_id').eq('user_id', user?.id).single();
                                                            const organization_id = data?.organization_id;

                                                            if (organization_id) {
                                                                const { data: { session } } = await supabase.auth.getSession();
                                                                const token = session?.access_token;

                                                                await fetch("/api/ai/cache", {
                                                                    method: "POST",
                                                                    headers: {
                                                                        "Content-Type": "application/json",
                                                                        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                                                                        "X-Product-Id": productId
                                                                    },
                                                                    body: JSON.stringify({
                                                                        phrase_snippet: pendingNav.phraseSnippet,
                                                                        node_id: pendingNav.navigatedNodeId,
                                                                        organization_id,
                                                                        reinforce: true
                                                                    })
                                                                });
                                                            }
                                                        } catch (e) {
                                                            console.error("Failed to reinforce AI navigation", e);
                                                        }
                                                    }
                                                    removePendingAINavigation(pendingNav.phraseHash);
                                                }}
                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground rounded text-[10px] font-bold hover:opacity-90 transition-all shadow-sm"
                                            >
                                                <ThumbsUp className="w-2.5 h-2.5" />
                                                Yes
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (productId) {
                                                        try {
                                                            const { supabase } = await import('@/app/lib/supabaseClient');
                                                            const { data: { user } } = await supabase.auth.getUser();
                                                            const { data } = await supabase.from('organization_members').select('organization_id').eq('user_id', user?.id).single();
                                                            const organization_id = data?.organization_id;

                                                            if (organization_id) {
                                                                const { data: { session } } = await supabase.auth.getSession();
                                                                const token = session?.access_token;

                                                                await fetch("/api/ai/cache", {
                                                                    method: "POST",
                                                                    headers: {
                                                                        "Content-Type": "application/json",
                                                                        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                                                                        "X-Product-Id": productId
                                                                    },
                                                                    body: JSON.stringify({
                                                                        phrase_snippet: pendingNav.phraseSnippet,
                                                                        node_id: pendingNav.navigatedNodeId,
                                                                        organization_id,
                                                                        reject: true
                                                                    })
                                                                });
                                                            }
                                                        } catch (e) {
                                                            console.error("Failed to reject AI navigation", e);
                                                        }
                                                    }
                                                    setShowCorrectionFor({
                                                        hash: pendingNav.phraseHash,
                                                        snippet: pendingNav.phraseSnippet,
                                                        nodeId: pendingNav.navigatedNodeId
                                                    });
                                                    removePendingAINavigation(pendingNav.phraseHash);
                                                }}
                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-active text-foreground rounded text-[10px] font-bold hover:bg-border-strong transition-all shadow-sm"
                                            >
                                                <ThumbsDown className="w-2.5 h-2.5" />
                                                No
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    );
                })}

                {liveTranscript.length > 0 && transcriptionState === 'paused' && (
                    <div className="flex items-center gap-2 py-2">
                        <div className="flex-1 h-px bg-amber-200" />
                        <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">Paused</span>
                        <div className="flex-1 h-px bg-amber-200" />
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
        </div >
    );
}
