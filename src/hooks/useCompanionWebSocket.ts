import { useEffect, useState, useRef } from "react";
import { useCallStore } from "@/store/callStore";
import { supabase } from "@/app/lib/supabaseClient";

/** Number of transcript lines to send to Claude for context */
const CONTEXT_WINDOW = 10;

/** Milliseconds to wait after a new message before firing the AI check.
 *  Short enough to feel real-time, long enough to catch a complete phrase
 *  before sending to the AI. */
const AI_CHECK_DEBOUNCE_MS = 350;

async function getAccessToken(): Promise<string | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    } catch {
        return null;
    }
}

export interface AIRecommendation {
    recommendedNodeId: string | null;
    confidence: "high" | "medium" | "low";
    reasoning: string;
}

export function useCompanionWebSocket() {
    const { isCompanionActive, appendTranscript, setAIRecommendation } = useCallStore();
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isCompanionActive) {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            setIsConnected(false);
            setAIRecommendation(null);
            return;
        }

        const connect = () => {
            try {
                const ws = new WebSocket("ws://127.0.0.1:4141");

                ws.onopen = () => {
                    setIsConnected(true);
                    setError(null);
                    console.log("Connected to Tauri Companion WebSocket");
                };

                ws.onmessage = async (event) => {
                    let transcriptText = event.data;
                    let speaker = 0;

                    try {
                        const parsed = JSON.parse(event.data);
                        if (parsed.text !== undefined) {
                            transcriptText = parsed.text;
                            speaker = parsed.speaker ?? 0;
                        }
                    } catch {
                        // Fallback to raw string
                    }

                    if (!transcriptText) return;

                    // Append to transcript store first
                    appendTranscript({
                        text: transcriptText,
                        timestamp: new Date().toISOString(),
                        speaker,
                    });

                    // Only trigger AI navigation check when the PROSPECT speaks.
                    // speaker === 0 is the rep (microphone), speaker !== 0 is prospect (system audio).
                    if (speaker === 0) return;

                    // Debounce: cancel previous pending check and wait for a pause in speech
                    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);

                    aiDebounceRef.current = setTimeout(async () => {
                        const { currentNodeId, scripts, liveTranscript, navigateTo, productId } =
                            useCallStore.getState();

                        const currentNode = scripts[currentNodeId];
                        if (!currentNode) return;

                        // Build a rolling context window from the last N transcript entries
                        const contextWindow = liveTranscript
                            .slice(-CONTEXT_WINDOW)
                            .map((t) => `${t.speaker === 0 ? "Rep" : "Prospect"}: ${t.text}`)
                            .join("\n");

                        // Build a compact index of ALL available nodes so the AI can navigate
                        // to any node in the script — not just those directly connected to the
                        // current one. This lets the AI handle unexpected objections or off-script
                        // responses by finding the best matching node across the entire call flow.
                        const scriptIndex = Object.values(scripts).map((node) => ({
                            id: node.id,
                            type: node.type,
                            title: node.title,
                            context: node.context ?? null,
                            aiTransitionTriggers: node.metadata?.aiTransitionTriggers ?? [],
                        }));

                        try {
                            // Build headers — include auth token to avoid 401
                            const token = await getAccessToken();
                            const headers: Record<string, string> = {
                                "Content-Type": "application/json",
                            };
                            if (token) headers["Authorization"] = `Bearer ${token}`;
                            if (productId) headers["X-Product-Id"] = productId;

                            const res = await fetch("/api/ai/companion", {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    currentNode,
                                    transcript: contextWindow,
                                    scriptIndex,
                                }),
                            });

                            if (!res.ok) {
                                console.warn("AI companion API error:", res.status, await res.text());
                                return;
                            }

                            const data: AIRecommendation = await res.json();
                            console.log("AI Companion response:", data);

                            // Show recommendation in UI regardless of confidence
                            if (data.recommendedNodeId) {
                                setAIRecommendation(data);
                            }

                            // Only auto-navigate on high confidence
                            if (data.recommendedNodeId && data.confidence === "high") {
                                console.log(
                                    "AI Auto-Navigating to:",
                                    data.recommendedNodeId,
                                    "Reason:",
                                    data.reasoning
                                );
                                navigateTo(data.recommendedNodeId);
                                // Clear the recommendation after acting on it
                                setAIRecommendation(null);
                            }
                        } catch (err) {
                            console.error("AI companion check failed", err);
                        }
                    }, AI_CHECK_DEBOUNCE_MS);
                };

                ws.onclose = () => {
                    setIsConnected(false);
                    console.log("Disconnected from Tauri Companion.");
                    setTimeout(() => {
                        if (useCallStore.getState().isCompanionActive) {
                            connect();
                        }
                    }, 3000);
                };

                ws.onerror = (e) => {
                    console.error("WebSocket error:", e);
                    setError("Failed to connect to local companion app.");
                };

                wsRef.current = ws;
            } catch (err) {
                setError(String(err));
            }
        };

        connect();

        return () => {
            if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
        };
    }, [isCompanionActive, appendTranscript]);

    return { isConnected, error };
}
