"use client";

import { useCallStore } from "@/store/callStore";
import { useCompanionWebSocket } from "@/hooks/useCompanionWebSocket";
import { useEffect, useRef, useState } from "react";
import { Bot, User, Mic, Sparkles, ArrowRight, X } from "lucide-react";
import type { AIRecommendation } from "@/hooks/useCompanionWebSocket";

export default function LiveTranscript() {
    const { isCompanionActive, liveTranscript, toggleCompanion, scripts } = useCallStore();
    const { isConnected, error, aiRecommendation } = useCompanionWebSocket();
    const [dismissedRec, setDismissedRec] = useState<AIRecommendation | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of transcript
    useEffect(() => {
        // Use a small timeout to let React finish rendering the new DOM nodes
        const timer = setTimeout(() => {
            if (messagesEndRef.current) {
                // block: "nearest" ensures ONLY the scrollable container moves, not the whole browser window
                messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [liveTranscript]);

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

    return (
        <div className="w-80 border-l border-zinc-200 bg-white flex flex-col h-full shadow-lg z-10">
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    ) : error ? (
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                    ) : (
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                    <span className="font-medium text-sm text-zinc-700">
                        {isConnected ? "Co-Pilot Active" : error ? "Connection Error" : "Connecting..."}
                    </span>
                </div>
                <button
                    onClick={toggleCompanion}
                    className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                    Turn Off
                </button>
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
                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg">
                        Ensure the Tauri Companion app is running. Error: {error}
                    </div>
                )}

                {liveTranscript.length === 0 && isConnected && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-3">
                        <Mic className="w-6 h-6 animate-pulse text-primary/40" />
                        <p className="text-sm">Listening to conversation...</p>
                    </div>
                )}

                {liveTranscript.map((msg, i) => {
                    const isRep = msg.speaker === 0 || msg.speaker === undefined;
                    return (
                        <div key={i} className={`flex gap-3 text-sm ${isRep ? "flex-row-reverse" : ""}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isRep ? "bg-primary text-white" : "bg-zinc-100 text-zinc-500"}`}>
                                {isRep ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                            </div>
                            <div className={`border rounded-lg p-2.5 max-w-[85%] ${isRep ? "bg-primary/5 border-primary/20 text-zinc-800" : "bg-white border-zinc-200 text-zinc-700 shadow-sm"}`}>
                                {msg.text}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}
