"use client";

import { useCallStore } from "@/store/callStore";
import { useCompanionWebSocket } from "@/hooks/useCompanionWebSocket";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef, useState } from "react";
import { Bot, User, Mic, Sparkles, ArrowRight, X, Play, Pause, Square } from "lucide-react";
import type { AIRecommendation } from "@/hooks/useCompanionWebSocket";

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
                bubble: "bg-emerald-50 border-l-2 border-emerald-400 text-zinc-800 shadow-sm shadow-emerald-100",
                label: "text-emerald-600",
                icon: "📈",
                tag: "Buying Signal",
            };
        case "objection":
            return {
                bubble: "bg-red-50 border-l-2 border-red-400 text-zinc-800 shadow-sm shadow-red-100",
                label: "text-red-600",
                icon: "⚠️",
                tag: "Objection",
            };
        case "question":
            return {
                bubble: "bg-blue-50 border-l-2 border-blue-400 text-zinc-800 shadow-sm shadow-blue-100",
                label: "text-blue-600",
                icon: "❓",
                tag: "Question",
            };
        default:
            return {
                bubble: "bg-white border-zinc-200 text-zinc-700 shadow-sm",
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
    } = useCallStore();
    const { profile } = useAuth();
    const { isConnected, error } = useCompanionWebSocket();
    const [dismissedRec, setDismissedRec] = useState<AIRecommendation | null>(null);
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

    if (!isCompanionActive) {
        return (
            <div className="w-80 border-l border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="p-4 bg-zinc-100 rounded-full mb-4">
                    <Bot className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="font-semibold text-zinc-900 mb-2">AI Call Companion</h3>
                <p className="text-sm text-zinc-500 mb-6">
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
            : <div className="w-2 h-2 rounded-full bg-zinc-400" />;

    const statusLabel = transcriptionState === 'recording'
        ? (isConnected ? "Recording" : error ? "Connection Error" : "Connecting…")
        : transcriptionState === 'paused'
            ? "Paused"
            : "Ready";

    return (
        <div className="w-80 border-l border-zinc-200 bg-white flex flex-col h-full shadow-lg z-10">
            {/* Header */}
            <div className="p-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-2">
                    {statusDot}
                    <span className="font-medium text-sm text-zinc-700">{statusLabel}</span>
                </div>
                {/* Close panel */}
                <button
                    onClick={toggleCompanion}
                    className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
                    title="Close Co-Pilot"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Controls Bar */}
            <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
                {/* Start / Resume */}
                {transcriptionState !== 'recording' && (
                    <button
                        onClick={startTranscription}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                        title="Start transcription"
                    >
                        <Play className="w-3.5 h-3.5" />
                        {transcriptionState === 'paused' ? 'Resume' : 'Start'}
                    </button>
                )}

                {/* Pause */}
                {transcriptionState === 'recording' && (
                    <button
                        onClick={pauseTranscription}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-400 text-white hover:bg-amber-500 transition-colors shadow-sm"
                        title="Pause transcription"
                    >
                        <Pause className="w-3.5 h-3.5" />
                        Pause
                    </button>
                )}

                {/* Stop */}
                {transcriptionState !== 'idle' && (
                    <button
                        onClick={stopTranscription}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
                        title="Stop and clear transcription"
                    >
                        <Square className="w-3.5 h-3.5" />
                        Stop
                    </button>
                )}

                {transcriptionState === 'idle' && (
                    <span className="text-xs text-zinc-400 italic">Click Start to begin transcribing</span>
                )}
            </div>

            {/* AI Suggestion Banner */}
            {aiRecommendation && aiRecommendation !== dismissedRec && aiRecommendation.recommendedNodeId && (() => {
                const targetNode = scripts[aiRecommendation.recommendedNodeId];
                return (
                    <div className="mx-3 mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg flex items-start gap-2 text-xs">
                        <Sparkles className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-violet-800 flex items-center gap-1">
                                AI Suggestion
                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${aiRecommendation.confidence === "high"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                    }`}>
                                    {aiRecommendation.confidence}
                                </span>
                            </div>
                            {targetNode && (
                                <div className="flex items-center gap-1 text-violet-700 mt-0.5 font-medium">
                                    <ArrowRight className="w-3 h-3" />
                                    {targetNode.title}
                                </div>
                            )}
                            <div className="text-violet-600 mt-1 leading-snug">{aiRecommendation.reasoning}</div>
                        </div>
                        <button
                            onClick={() => setDismissedRec(aiRecommendation)}
                            className="shrink-0 text-violet-400 hover:text-violet-600 transition-colors"
                            title="Dismiss"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })()}

            {/* Transcript Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" ref={scrollRef}>
                {error && transcriptionState === 'recording' && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg">
                        Ensure the Tauri Companion app is running. Error: {error}
                    </div>
                )}

                {liveTranscript.length === 0 && transcriptionState === 'recording' && isConnected && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-3">
                        <Mic className="w-6 h-6 animate-pulse text-primary/40" />
                        <p className="text-sm">Listening to conversation...</p>
                    </div>
                )}

                {liveTranscript.length === 0 && transcriptionState === 'idle' && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-3 pt-8">
                        <Bot className="w-6 h-6 text-zinc-300" />
                        <p className="text-sm text-center">Press <span className="font-semibold text-emerald-500">Start</span> to begin transcribing your call.</p>
                    </div>
                )}

                {liveTranscript.length === 0 && transcriptionState === 'paused' && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-3 pt-8">
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
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden ${isRep ? "bg-primary text-white" : "bg-zinc-100 text-zinc-500"
                                }`}>
                                {isRep
                                    ? profile?.profile_picture_url
                                        ? <img src={profile.profile_picture_url} alt="Rep" className="w-full h-full object-cover" />
                                        : <User className="w-3.5 h-3.5" />
                                    : <Bot className="w-3.5 h-3.5" />}
                            </div>
                            <div className={`border rounded-lg p-2.5 max-w-[85%] ${isRep ? "bg-primary/5 border-primary/20 text-zinc-800" : style.bubble
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
        </div>
    );
}
