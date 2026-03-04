import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getProductId, isAdmin } from "@/app/lib/apiAuth";
import { generateEmbedding } from "@/app/lib/embeddings";
import { buildScriptIndex } from "@/app/lib/buildScriptIndex";
import { COMPANION_SYSTEM_PROMPT } from "@/app/lib/companionPrompt";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function hashPhrase(phrase: string): string {
    return crypto.createHash("sha256").update(phrase.toLowerCase().trim()).digest("hex");
}

async function fetchFullNode(nodeId: string, productId: string) {
    const { data: node } = await supabaseAdmin
        .from("call_nodes")
        .select("id, type, title, script, context, metadata")
        .eq("id", nodeId)
        .eq("product_id", productId)
        .single();

    if (!node) return null;

    const [listenForRes, responsesRes] = await Promise.all([
        supabaseAdmin
            .from("call_node_listen_for")
            .select("listen_item")
            .eq("node_id", nodeId)
            .order("sort_order"),
        supabaseAdmin
            .from("call_node_responses")
            .select("*")
            .eq("node_id", nodeId)
            .order("sort_order"),
    ]);

    return {
        ...node,
        listenFor: (listenForRes.data || []).map((l: any) => l.listen_item),
        responses: (responsesRes.data || []).map((r: any) => ({
            label: r.label,
            nextNode: r.next_node_id,
            note: r.note,
            isSpecialInstruction: r.is_special_instruction,
            coachingScope: r.coaching_scope,
            aiCondition: r.ai_condition,
            aiConfidence: r.ai_confidence,
        })),
    };
}

// POST /api/admin/ai-training/sessions/[id]/step
// Admin submits a prospect utterance; runs 3-tier lookup and records the result.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminCheck = await isAdmin(authHeader);
    if (!adminCheck) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });

    try {
        const body = await request.json();
        const { utterance } = body;

        if (!utterance?.trim()) {
            return NextResponse.json({ error: "utterance is required" }, { status: 400 });
        }

        // Fetch the session
        const { data: session, error: sessionError } = await supabaseAdmin
            .from("ai_simulation_sessions")
            .select("*")
            .eq("id", id)
            .eq("product_id", productId)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        if (session.status === "completed") {
            return NextResponse.json({ error: "Session is already completed" }, { status: 409 });
        }

        const { organization_id: organizationId, call_flow_id: callFlowId, current_node_id: fromNodeId } = session;
        const phraseHash = hashPhrase(utterance);

        let tierHit: number | null = null;
        let resolvedNodeId: string | null = null;
        let resolvedConfidence: string | null = null;
        let similarityScore: number | null = null;
        let tier3Reasoning: string | null = null;
        let matchedPhrase: string | null = null;

        // ── Tier 1: Exact hash match ─────────────────────────────────────────
        let tier1Query = supabaseAdmin
            .from("ai_navigation_cache")
            .select("node_id, status")
            .eq("product_id", productId)
            .eq("phrase_hash", phraseHash)
            .in("status", ["confirmed", "corrected"])
            .or(`call_flow_id.eq.${callFlowId},call_flow_id.is.null`);

        const { data: hashMatch } = await tier1Query
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();

        if (hashMatch) {
            tierHit = 1;
            resolvedNodeId = hashMatch.node_id;
            resolvedConfidence = "high";
        }

        // ── Tier 2: Semantic vector match ────────────────────────────────────
        if (!resolvedNodeId) {
            try {
                const embedding = await generateEmbedding(utterance);
                const { data: vectorMatches } = await supabaseAdmin.rpc("match_intents", {
                    query_embedding: embedding,
                    query_product_id: productId,
                    match_threshold: 0.78,
                    match_count: 1,
                    query_call_flow_id: callFlowId,
                });

                if (vectorMatches && vectorMatches.length > 0) {
                    const best = vectorMatches[0];
                    tierHit = 2;
                    resolvedNodeId = best.node_id;
                    similarityScore = Math.round(best.similarity * 100);
                    matchedPhrase = best.phrase_snippet;
                    resolvedConfidence = similarityScore >= 90 ? "high" : "medium";
                }
            } catch (embErr) {
                console.warn("[AI Training Step] Tier 2 embedding failed, falling through to Claude:", embErr);
            }
        }

        // ── Tier 3: Claude (with current node context) ───────────────────────
        if (!resolvedNodeId) {
            try {
                const [currentNode, scriptIndex] = await Promise.all([
                    fromNodeId ? fetchFullNode(fromNodeId, productId) : Promise.resolve(null),
                    buildScriptIndex(productId, callFlowId, { fallbackToAll: true }),
                ]);

                const scriptIndexText = scriptIndex.map((n) =>
                    `[${n.id}] (${n.type}) "${n.title}"${n.context ? ` — ${n.context}` : ""}${n.listenFor && n.listenFor.length > 0 ? `\n  Listen For: ${n.listenFor.join(", ")}` : ""}${n.aiTransitionTriggers.length > 0 ? `\n  Triggers: ${n.aiTransitionTriggers.map((t) => `if "${t.condition}" → ${t.targetNodeId} (${t.confidence})`).join("; ")}` : ""}`
                ).join("\n");

                let currentNodeSection = "";
                if (currentNode) {
                    const derivedTriggers = (currentNode.responses || [])
                        .filter((r: any) => !r.isSpecialInstruction && r.aiCondition)
                        .map((r: any) => ({
                            condition: r.aiCondition,
                            targetNodeId: r.nextNode,
                            confidence: r.aiConfidence ?? "medium",
                        }));

                    const coachingNotes = (currentNode.responses || [])
                        .filter((r: any) => r.isSpecialInstruction && (r.coachingScope === "ai" || r.coachingScope === "both"))
                        .map((r: any) => r.note || r.label)
                        .filter(Boolean);

                    currentNodeSection = `**Current Node:**
ID: ${currentNode.id}
Type: ${currentNode.type}
Intent: ${currentNode.metadata?.aiIntent || "N/A"}
Listen For: ${JSON.stringify(currentNode.listenFor || [])}
Triggers: ${JSON.stringify(derivedTriggers)}${coachingNotes.length > 0 ? `\nCoaching Notes:\n${coachingNotes.map((n: string) => `- ${n}`).join("\n")}` : ""}
Responses (visible rep buttons): ${JSON.stringify((currentNode.responses || []).filter((r: any) => !r.isSpecialInstruction))}

`;
                }

                const userPrompt = `${currentNodeSection}**Global Script Index (ALL available nodes):**
${scriptIndexText}

**Recent Transcript:**
Prospect: ${utterance}

Analyze this single prospect utterance. Return the JSON recommendation.`;

                const message = await anthropic.messages.create({
                    model: "claude-haiku-4-5",
                    max_tokens: 500,
                    system: COMPANION_SYSTEM_PROMPT,
                    messages: [{ role: "user", content: userPrompt }],
                });

                const responseText = message.content
                    .filter((b: any) => b.type === "text")
                    .map((b: any) => b.text)
                    .join("");

                const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
                const parsed = JSON.parse(cleaned);
                const primary = parsed.primaryIntent ?? parsed;

                if (primary.recommendedNodeId) {
                    tierHit = 3;
                    resolvedNodeId = primary.recommendedNodeId;
                    resolvedConfidence = primary.confidence ?? "medium";
                    tier3Reasoning = primary.reasoning ?? null;
                }
            } catch (claudeErr) {
                console.error("[AI Training Step] Claude Tier 3 failed:", claudeErr);
            }
        }

        // Fetch the resolved node's title for display
        let resolvedNodeTitle: string | null = null;
        let resolvedNodeData: any = null;
        if (resolvedNodeId) {
            resolvedNodeData = await fetchFullNode(resolvedNodeId, productId);
            resolvedNodeTitle = resolvedNodeData?.title ?? null;
        }

        // Insert the step record
        const stepNumber = (session.step_count || 0) + 1;
        const { data: step, error: stepError } = await supabaseAdmin
            .from("ai_simulation_steps")
            .insert({
                session_id: id,
                organization_id: organizationId,
                product_id: productId,
                call_flow_id: callFlowId,
                step_number: stepNumber,
                from_node_id: fromNodeId,
                utterance: utterance.trim(),
                tier_hit: tierHit,
                resolved_node_id: resolvedNodeId,
                resolved_node_title: resolvedNodeTitle,
                resolved_confidence: resolvedConfidence,
                similarity_score: similarityScore,
                tier3_reasoning: tier3Reasoning,
                matched_phrase: matchedPhrase,
                review_status: "pending",
            })
            .select("*")
            .single();

        if (stepError) throw stepError;

        // Increment session step count (do not advance current_node_id yet — that happens on review)
        await supabaseAdmin
            .from("ai_simulation_sessions")
            .update({ step_count: stepNumber })
            .eq("id", id);

        return NextResponse.json({
            step,
            resolved_node: resolvedNodeData,
        });
    } catch (error) {
        console.error("[AI Training] POST /sessions/[id]/step error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
