import { useEffect, useState, useRef } from "react";
import { useCallStore, AINavigationEvent } from "@/store/callStore";
import { supabase } from "@/app/lib/supabaseClient";
import { isNodeInFlow } from "@/data/callFlow";

/** Number of transcript lines to send to Claude for context */
const CONTEXT_WINDOW = 10;

/** Milliseconds to wait after a new message before firing the AI check.
 *  Short enough to feel real-time, long enough to catch a complete phrase
 *  before sending to the AI. */
const AI_CHECK_DEBOUNCE_MS = 350;

/**
 * Rolling window (ms) for aggregating recent prospect speech into a single
 * semantic phrase. Speech-to-text streams fragments in real-time, so we
 * collect everything the prospect said in the last N ms and join it into
 * one coherent phrase before embedding lookup and cache storage.
 * This prevents matching fragments like "this about?" in isolation.
 */
const SEMANTIC_WINDOW_MS = 5000;

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
                        const { currentNodeId, scripts, liveTranscript, navigateTo, productId, activeCallFlowId } =
                            useCallStore.getState();

                        const currentNode = scripts[currentNodeId];
                        if (!currentNode) return;

                        // Build a rolling context window from the last N transcript entries (for Claude)
                        const contextWindow = liveTranscript
                            .slice(-CONTEXT_WINDOW)
                            .map((t) => `${t.speaker === 0 ? "Rep" : "Prospect"}: ${t.text}`)
                            .join("\n");

                        // Build a semantic phrase from the last SEMANTIC_WINDOW_MS of prospect speech.
                        // Speech-to-text streams in fragments ("yes", "I am", "the manager, and"),
                        // so we aggregate them into one coherent thought before cache/embedding lookup.
                        // This prevents incomplete fragments from failing to match stored intent phrases.
                        const now = Date.now();
                        const semanticPhrase = liveTranscript
                            .filter(t => t.speaker !== 0 && (now - new Date(t.timestamp).getTime()) < SEMANTIC_WINDOW_MS)
                            .map(t => t.text)
                            .join(' ')
                            .trim() || transcriptText;

                        // Build a compact index of nodes in the ACTIVE CALL FLOW so Claude only
                        // searches relevant nodes. Universal nodes (no call_flow_ids) are always
                        // included. This reduces noise, improves accuracy, and speeds up Tier 3.
                        const scriptIndex = Object.values(scripts).filter(node => isNodeInFlow(node, activeCallFlowId)).map((node) => {
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

                            // 1. Check intent cache — Tier 1 (hash) then Tier 2 (semantic vector)
                            const { data: { user } } = await supabase.auth.getUser();
                            const organization_id = await supabase.from('organization_members')
                                .select('organization_id')
                                .eq('user_id', user?.id)
                                .single()
                                .then(res => res.data?.organization_id);

                            // Use the aggregated semantic phrase as the cache key so that
                            // fragmented speech is matched as a complete thought.
                            const phraseHash = await hashPhrase(semanticPhrase);

                            if (productId && organization_id) {
                                try {
                                    const cacheUrl = `/api/ai/cache?phrase=${encodeURIComponent(semanticPhrase)}${activeCallFlowId ? `&call_flow_id=${encodeURIComponent(activeCallFlowId)}` : ''}`;
                                    const cacheRes = await fetch(cacheUrl, { headers });
                                    if (cacheRes.ok) {
                                        const cacheData = await cacheRes.json();
                                        if (cacheData.match && cacheData.nodeId) {
                                            const tierLabel = cacheData.tier === 1
                                                ? '⚡ Tier 1 (exact)'
                                                : `🧠 Tier 2 (semantic ${cacheData.similarity}% match)`;
                                            console.log(`${tierLabel} AI Cache Hit → ${cacheData.nodeId}`, cacheData.matchedPhrase ? `| matched: "${cacheData.matchedPhrase}"` : '');

                                            const reasoning = cacheData.tier === 2
                                                ? `Semantic match (${cacheData.similarity}% similar to: "${cacheData.matchedPhrase}")`
                                                : `Learned from previous calls (${cacheData.source})`;

                                            // Show recommendation immediately
                                            useCallStore.getState().setAIRecommendation({
                                                recommendedNodeId: cacheData.nodeId,
                                                confidence: "high",
                                                reasoning,
                                            });

                                            // Handle fast auto-navigation
                                            navigateTo(cacheData.nodeId);
                                            useCallStore.getState().addPendingAINavigation({
                                                phraseHash,
                                                phraseSnippet: semanticPhrase,
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

                            // 2. Cache miss → Call Claude (Tier 3)
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

                            // 3. Auto-navigate and learn on high confidence
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
                                    phraseSnippet: semanticPhrase,
                                    navigatedNodeId: data.recommendedNodeId,
                                    timestamp: Date.now()
                                });

                                // Write provisional learning event to the cache asynchronously.
                                // Store the semantic phrase (aggregated context) so future matches
                                // work against the complete thought, not just the latest fragment.
                                if (productId && organization_id) {
                                    fetch("/api/ai/cache", {
                                        method: "POST",
                                        headers,
                                        body: JSON.stringify({
                                            phrase_snippet: semanticPhrase,
                                            node_id: data.recommendedNodeId,
                                            organization_id,
                                            ...(activeCallFlowId && { call_flow_id: activeCallFlowId }),
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
