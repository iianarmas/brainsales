import { useEffect, useState, useRef } from "react";
import { useCallStore, AINavigationEvent } from "@/store/callStore";
import { supabase } from "@/app/lib/supabaseClient";
import { isNodeInFlow } from "@/data/callFlow";

/** Number of transcript lines to send to Claude for context */
const CONTEXT_WINDOW = 20;

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

// Module-level timer map for secondary suggestion auto-clear cancellation
const _secondaryClearTimers = new Map<string, ReturnType<typeof setTimeout>>();
function _clearSecondaryTimer(phraseHash: string) {
    const t = _secondaryClearTimers.get(phraseHash);
    if (t) {
        clearTimeout(t);
        _secondaryClearTimers.delete(phraseHash);
    }
}

export function useCompanionWebSocket() {
    const {
        isCompanionActive,
        appendTranscript,
        setAIRecommendation,
        transcriptionState,
        recordVisitedNode,
        clearSecondaryNavSuggestions,
    } = useCallStore();
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Level 2: Call-start backfill pre-warm ────────────────────────────────
    // Fires once when transcription starts. Pre-warms all uncached aiCondition
    // phrases for the active call flow so Tier 2 can navigate anywhere from
    // anywhere without waiting for Tier 3.
    useEffect(() => {
        if (transcriptionState !== "recording") return;

        const prewarm = async () => {
            try {
                const { scripts: currentScripts, activeCallFlowId: flowId, productId: pid } = useCallStore.getState();
                if (!pid) return;

                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: memberData } = await supabase
                    .from("organization_members")
                    .select("organization_id")
                    .eq("user_id", user.id)
                    .single();
                const orgId = memberData?.organization_id;
                if (!orgId) return;

                const conditions = Object.values(currentScripts)
                    .filter(n => isNodeInFlow(n, flowId))
                    .flatMap(n =>
                        (n.responses || [])
                            .filter((r: any) => !r.isSpecialInstruction && r.aiCondition && r.nextNode)
                            .map((r: any) => ({ phrase: r.aiCondition!, nodeId: r.nextNode }))
                    );

                if (conditions.length === 0) return;

                const token = await getAccessToken();
                const prewarmHeaders: Record<string, string> = { "Content-Type": "application/json" };
                if (token) prewarmHeaders["Authorization"] = `Bearer ${token}`;
                if (pid) prewarmHeaders["X-Product-Id"] = pid;

                fetch("/api/ai/cache/prewarm", {
                    method: "POST",
                    headers: prewarmHeaders,
                    body: JSON.stringify({ conditions, organizationId: orgId, callFlowId: flowId }),
                }).catch(e => console.warn("[PrewarmL2] Failed:", e));
            } catch (e) {
                console.warn("[PrewarmL2] Error:", e);
            }
        };

        prewarm();
    }, [transcriptionState]);

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
                };

                ws.onmessage = async (event) => {
                    // If paused or idle, discard incoming transcript data entirely
                    if (useCallStore.getState().transcriptionState !== "recording") return;

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
                        const { currentNodeId, scripts, liveTranscript, navigateTo, productId, activeCallFlowId, visitedNodes } =
                            useCallStore.getState();

                        const currentNode = scripts[currentNodeId];
                        if (!currentNode) return;

                        // Build a rolling context window from the last N transcript entries (for Claude)
                        const contextWindow = liveTranscript
                            .slice(-CONTEXT_WINDOW)
                            .map((t) => `${t.speaker === 0 ? "Rep" : "Prospect"}: ${t.text}`)
                            .join("\n");

                        // Build a semantic phrase from the last SEMANTIC_WINDOW_MS of prospect speech.
                        const now = Date.now();
                        const semanticPhrase = liveTranscript
                            .filter(t => t.speaker !== 0 && (now - new Date(t.timestamp).getTime()) < SEMANTIC_WINDOW_MS)
                            .map(t => t.text)
                            .join(" ")
                            .trim() || transcriptText;

                        // Build a compact index of nodes in the ACTIVE CALL FLOW so Claude only
                        // searches relevant nodes. Universal nodes (no call_flow_ids) are always
                        // included. This reduces noise, improves accuracy, and speeds up Tier 3.
                        const scriptIndex = Object.values(scripts).filter(node => isNodeInFlow(node, activeCallFlowId)).map((node) => {
                            const responseTriggers = (node.responses || [])
                                .filter(r => !r.isSpecialInstruction && r.aiCondition)
                                .map(r => ({
                                    condition: r.aiCondition!,
                                    targetNodeId: r.nextNode,
                                    confidence: (r.aiConfidence ?? "medium") as "high" | "medium",
                                }));
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

                        // Build call history for richer Claude context (Improvement 3)
                        const callHistory = visitedNodes.length > 0
                            ? {
                                visitedNodes: visitedNodes
                                    .slice(-15)
                                    .map(v => v.title)
                                    .join(" → ")
                            }
                            : undefined;

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
                            const organization_id = await supabase.from("organization_members")
                                .select("organization_id")
                                .eq("user_id", user?.id)
                                .single()
                                .then(res => res.data?.organization_id);

                            // Use the aggregated semantic phrase as the cache key so that
                            // fragmented speech is matched as a complete thought.
                            const phraseHash = await hashPhrase(semanticPhrase);

                            if (productId && organization_id) {
                                try {
                                    const cacheUrl = `/api/ai/cache?phrase=${encodeURIComponent(semanticPhrase)}${activeCallFlowId ? `&call_flow_id=${encodeURIComponent(activeCallFlowId)}` : ""}`;
                                    const cacheRes = await fetch(cacheUrl, { headers });
                                    if (cacheRes.ok) {
                                        const cacheData = await cacheRes.json();
                                        if (cacheData.match && cacheData.nodeId) {


                                            const reasoning = cacheData.tier === 2
                                                ? `Semantic match (${cacheData.similarity}% similar to: "${cacheData.matchedPhrase}")`
                                                : `Learned from previous calls (${cacheData.source})`;

                                            useCallStore.getState().setAIRecommendation({
                                                recommendedNodeId: cacheData.nodeId,
                                                confidence: "high",
                                                reasoning,
                                            });

                                            navigateTo(cacheData.nodeId);
                                            useCallStore.getState().recordVisitedNode(
                                                cacheData.nodeId,
                                                scripts[cacheData.nodeId]?.title ?? cacheData.nodeId
                                            );
                                            useCallStore.getState().addPendingAINavigation({
                                                phraseHash,
                                                phraseSnippet: semanticPhrase,
                                                navigatedNodeId: cacheData.nodeId,
                                                timestamp: Date.now()
                                            });
                                            useCallStore.getState().setAIRecommendation(null);
                                            useCallStore.getState().clearSecondaryNavSuggestions();

                                            // Level 3: per-navigation safety net pre-warm
                                            const navigatedNode = scripts[cacheData.nodeId];
                                            if (navigatedNode) {
                                                const nodeConditions = (navigatedNode.responses || [])
                                                    .filter((r: any) => !r.isSpecialInstruction && r.aiCondition && r.nextNode)
                                                    .map((r: any) => ({ phrase: r.aiCondition!, nodeId: r.nextNode }));
                                                if (nodeConditions.length > 0) {
                                                    fetch("/api/ai/cache/prewarm", {
                                                        method: "POST",
                                                        headers,
                                                        body: JSON.stringify({ conditions: nodeConditions, organizationId: organization_id, callFlowId: activeCallFlowId }),
                                                    }).catch(e => console.warn("[PrewarmL3] Failed:", e));
                                                }
                                            }

                                            return; // Skip Claude entirely
                                        }
                                    }
                                } catch (e) {
                                    console.warn("Failed to check AI cache", e);
                                    // continue to Claude on error
                                }
                            }

                            // 2. Cache miss → Call Claude (Tier 3) — streaming response
                            const res = await fetch("/api/ai/companion", {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    currentNode,
                                    transcript: contextWindow,
                                    scriptIndex,
                                    ...(callHistory && { callHistory }),
                                }),
                            });

                            if (!res.ok) {
                                console.warn("AI companion API error:", res.status, await res.text());
                                return;
                            }

                            // Stream response: parse JSON incrementally, act as soon as complete
                            const reader = res.body!.getReader();
                            const decoder = new TextDecoder();
                            let buffer = "";

                            const stripJsonMarkdown = (s: string): string => {
                                const codeBlockMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
                                if (codeBlockMatch) return codeBlockMatch[1].trim();
                                const trimmed = s.trim();
                                if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
                                    const jsonMatch = trimmed.match(/(\{[\s\S]*\})/);
                                    if (jsonMatch) return jsonMatch[1];
                                }
                                return trimmed;
                            };

                            try {
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    buffer += decoder.decode(value, { stream: !done });

                                    try {
                                        const parsed = JSON.parse(stripJsonMarkdown(buffer));
                                        processCompanionResponse(
                                            parsed, scripts, navigateTo, phraseHash, semanticPhrase,
                                            headers, productId, organization_id, activeCallFlowId
                                        );
                                        return;
                                    } catch {
                                        // Partial JSON — keep accumulating
                                    }
                                }

                                // Final parse attempt after stream ends
                                if (buffer) {
                                    try {
                                        const parsed = JSON.parse(stripJsonMarkdown(buffer));
                                        processCompanionResponse(
                                            parsed, scripts, navigateTo, phraseHash, semanticPhrase,
                                            headers, productId, organization_id, activeCallFlowId
                                        );
                                    } catch {
                                        console.error("Failed to parse streaming companion response:", buffer);
                                    }
                                }
                            } finally {
                                reader.releaseLock();
                            }

                        } catch (err) {
                            console.error("AI companion check failed", err);
                        }
                    }, AI_CHECK_DEBOUNCE_MS);
                };

                ws.onclose = () => {
                    setIsConnected(false);
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

/**
 * Processes a parsed Claude companion response:
 * - Extracts primaryIntent (with backward-compat fallback to flat structure)
 * - Auto-navigates on high confidence
 * - Stores secondary suggestions with 15s auto-clear
 * - Writes provisional cache entry for primary intent only
 * - Level 3 pre-warm after navigation
 */
function processCompanionResponse(
    data: any,
    scripts: Record<string, any>,
    navigateTo: (nodeId: string) => void,
    phraseHash: string,
    semanticPhrase: string,
    headers: Record<string, string>,
    productId: string | null,
    organization_id: string | null | undefined,
    activeCallFlowId: string | null
) {
    // Backward compat: support both new { primaryIntent: {...} } and old flat { recommendedNodeId }
    const primary = data.primaryIntent ?? {
        recommendedNodeId: data.recommendedNodeId ?? null,
        confidence: data.confidence ?? "low",
        reasoning: data.reasoning ?? "",
    };

    const additionalIntents: Array<{ recommendedNodeId: string; topic: string; reasoning: string }> =
        Array.isArray(data.additionalIntents) ? data.additionalIntents : [];

    // Show primary recommendation in UI
    if (primary.recommendedNodeId) {
        useCallStore.getState().setAIRecommendation({
            recommendedNodeId: primary.recommendedNodeId,
            confidence: primary.confidence,
            reasoning: primary.reasoning,
        });
    }

    // Store secondary suggestions; auto-clear after 15s if rep doesn't act
    const secondary = additionalIntents
        .filter(s => s.recommendedNodeId)
        .map(s => ({ nodeId: s.recommendedNodeId, topic: s.topic, reasoning: s.reasoning }));
    useCallStore.getState().setSecondaryNavSuggestions(secondary);

    _clearSecondaryTimer(phraseHash);
    _secondaryClearTimers.set(phraseHash, setTimeout(() => {
        useCallStore.getState().clearSecondaryNavSuggestions();
        _secondaryClearTimers.delete(phraseHash);
    }, 15_000));

    // Auto-navigate and learn on high confidence
    if (primary.recommendedNodeId && primary.confidence === "high") {

        navigateTo(primary.recommendedNodeId);
        useCallStore.getState().recordVisitedNode(
            primary.recommendedNodeId,
            scripts[primary.recommendedNodeId]?.title ?? primary.recommendedNodeId
        );
        useCallStore.getState().clearSecondaryNavSuggestions();
        _clearSecondaryTimer(phraseHash);

        useCallStore.getState().addPendingAINavigation({
            phraseHash,
            phraseSnippet: semanticPhrase,
            navigatedNodeId: primary.recommendedNodeId,
            timestamp: Date.now()
        });

        // Write provisional learning event to the cache asynchronously (primary intent only)
        if (productId && organization_id) {
            fetch("/api/ai/cache", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    phrase_snippet: semanticPhrase,
                    node_id: primary.recommendedNodeId,
                    organization_id,
                    ...(activeCallFlowId && { call_flow_id: activeCallFlowId }),
                })
            }).then(async res => {
                if (!res.ok) {
                    const body = await res.text();
                    console.error("AI cache POST failed:", res.status, body);
                }
            }).catch(e => console.error("Failed to write to AI cache", e));

            // Level 3: per-navigation safety net pre-warm for the newly navigated node
            const navigatedNode = scripts[primary.recommendedNodeId];
            if (navigatedNode) {
                const nodeConditions = (navigatedNode.responses || [])
                    .filter((r: any) => !r.isSpecialInstruction && r.aiCondition && r.nextNode)
                    .map((r: any) => ({ phrase: r.aiCondition!, nodeId: r.nextNode }));
                if (nodeConditions.length > 0) {
                    fetch("/api/ai/cache/prewarm", {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ conditions: nodeConditions, organizationId: organization_id, callFlowId: activeCallFlowId }),
                    }).catch(e => console.warn("[PrewarmL3] Failed:", e));
                }
            }
        }

        useCallStore.getState().setAIRecommendation(null);
    }
}
