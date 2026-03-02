import { useEffect, useState, useRef } from "react";
import { useCallStore, AINavigationEvent } from "@/store/callStore";
import { supabase } from "@/app/lib/supabaseClient";

/** Number of transcript lines to send to Claude for context */
const CONTEXT_WINDOW = 10;

/** Milliseconds to wait after a new message before firing the AI check.
 *  Short enough to feel real-time, long enough to catch a complete phrase
 *  before sending to the AI. */
const AI_CHECK_DEBOUNCE_MS = 350;

async function hashPhrase(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
    const { isCompanionActive, appendTranscript, setAIRecommendation, transcriptionState } = useCallStore();
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
                    // If paused or idle, discard incoming transcript data entirely
                    if (useCallStore.getState().transcriptionState !== 'recording') return;

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
                        const scriptIndex = Object.values(scripts).map((node) => {
                            // Derive AI triggers from responses (new path)
                            const responseTriggers = (node.responses || [])
                                .filter(r => !r.isSpecialInstruction && r.aiCondition)
                                .map(r => ({
                                    condition: r.aiCondition!,
                                    targetNodeId: r.nextNode,
                                    confidence: (r.aiConfidence ?? "medium") as "high" | "medium",
                                }));
                            // Backward-compat: include any legacy metadata triggers not already covered
                            const legacyTriggers = (node.metadata?.aiTransitionTriggers ?? [])
                                .filter(t => !responseTriggers.some(d => d.targetNodeId === t.targetNodeId));

                            return {
                                id: node.id,
                                type: node.type,
                                title: node.title,
                                context: node.context ?? null,
                                aiTransitionTriggers: [...responseTriggers, ...legacyTriggers],
                            };
                        });

                        try {
                            // Build headers — include auth token to avoid 401
                            const token = await getAccessToken();
                            const headers: Record<string, string> = {
                                "Content-Type": "application/json",
                            };
                            if (token) headers["Authorization"] = `Bearer ${token}`;
                            if (productId) headers["X-Product-Id"] = productId;

                            // 1. Check local intent cache first
                            const { data: { user } } = await supabase.auth.getUser();
                            const organization_id = await supabase.from('organization_members')
                                .select('organization_id')
                                .eq('user_id', user?.id)
                                .single()
                                .then(res => res.data?.organization_id);

                            const phraseHash = await hashPhrase(transcriptText);

                            if (productId && organization_id) {
                                try {
                                    const cacheRes = await fetch(`/api/ai/cache?phrase=${encodeURIComponent(transcriptText)}`, { headers });
                                    if (cacheRes.ok) {
                                        const cacheData = await cacheRes.json();
                                        if (cacheData.match && cacheData.nodeId) {
                                            console.log("⚡ AI Cache Hit:", cacheData.nodeId, `(${cacheData.source})`);

                                            // Show recommendation immediately
                                            useCallStore.getState().setAIRecommendation({
                                                recommendedNodeId: cacheData.nodeId,
                                                confidence: "high",
                                                reasoning: `Learned from previous calls (${cacheData.source})`
                                            });

                                            // Handle fast auto-navigation
                                            navigateTo(cacheData.nodeId);
                                            useCallStore.getState().addPendingAINavigation({
                                                phraseHash,
                                                phraseSnippet: transcriptText,
                                                navigatedNodeId: cacheData.nodeId,
                                                timestamp: Date.now()
                                            });
                                            useCallStore.getState().setAIRecommendation(null);
                                            return; // Skip Claude entirely
                                        }
                                    }
                                } catch (e) {
                                    console.warn("Failed to check AI cache", e);
                                    // continue to Claude on error
                                }
                            }

                            // 2. Cache miss -> Call Claude
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
                                useCallStore.getState().setAIRecommendation(data);
                            }

                            // 3. Auto-navigate and optionally learn on high confidence
                            if (data.recommendedNodeId && data.confidence === "high") {
                                console.log(
                                    "AI Auto-Navigating to:",
                                    data.recommendedNodeId,
                                    "Reason:",
                                    data.reasoning
                                );
                                navigateTo(data.recommendedNodeId);

                                // Record the navigation event for the correction feedback UI
                                useCallStore.getState().addPendingAINavigation({
                                    phraseHash,
                                    phraseSnippet: transcriptText,
                                    navigatedNodeId: data.recommendedNodeId,
                                    timestamp: Date.now()
                                });

                                // Write provisional learning event to the cache asynchronously
                                if (productId && organization_id) {
                                    fetch("/api/ai/cache", {
                                        method: "POST",
                                        headers,
                                        body: JSON.stringify({
                                            phrase_snippet: transcriptText,
                                            node_id: data.recommendedNodeId,
                                            organization_id
                                        })
                                    }).then(async res => {
                                        if (!res.ok) {
                                            const body = await res.text();
                                            console.error("AI cache POST failed:", res.status, body);
                                        }
                                    }).catch(e => console.error("Failed to write to AI cache", e));
                                }

                                // Clear the recommendation after acting on it
                                useCallStore.getState().setAIRecommendation(null);
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
    }, [isCompanionActive, appendTranscript, transcriptionState]);

    return { isConnected, error };
}
