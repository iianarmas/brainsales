import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUser, getProductId } from "@/app/lib/apiAuth";
import { CallNode } from "@/data/callFlow";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { COMPANION_SYSTEM_PROMPT } from "@/app/lib/companionPrompt";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});


interface ScriptIndexEntry {
    id: string;
    type: string;
    title: string;
    context: string | null;
    listenFor?: string[];
    aiTransitionTriggers: Array<{
        condition: string;
        targetNodeId: string;
        confidence: "high" | "medium";
    }>;
}

interface CompanionRequest {
    currentNode: CallNode;
    transcript: string;
    scriptIndex?: ScriptIndexEntry[];
    callHistory?: { visitedNodes: string; nodesVisitedCount?: number };
}

export async function POST(request: NextRequest) {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Get product context
    const productId = await getProductId(request, authHeader);
    if (!productId) {
        return new Response(JSON.stringify({ error: "Product context required" }), { status: 400 });
    }

    // Fetch product context for richer AI reasoning
    const [productRes, quickRefRes, competitorsRes] = await Promise.all([
        supabaseAdmin.from("products").select("name, description").eq("id", productId).single(),
        supabaseAdmin.from("product_quick_reference").select("section, data").eq("product_id", productId).order("sort_order"),
        supabaseAdmin.from("competitors").select("name, our_advantage").eq("product_id", productId).eq("status", "active").order("sort_order"),
    ]);

    const product = productRes.data;
    const quickRef = quickRefRes.data ?? [];
    const competitorList = competitorsRes.data ?? [];

    try {
        const body = (await request.json()) as CompanionRequest;
        const { currentNode, transcript, scriptIndex, callHistory } = body;

        if (!currentNode || !transcript) {
            return new Response(JSON.stringify({ error: "currentNode and transcript are required" }), { status: 400 });
        }

        // Derive AI navigation triggers from responses (new path),
        // with backward-compat fallback to legacy metadata.aiTransitionTriggers
        const derivedTriggers = (currentNode.responses || [])
            .filter(r => !r.isSpecialInstruction && r.aiCondition)
            .map(r => ({
                condition: r.aiCondition!,
                targetNodeId: r.nextNode,
                confidence: r.aiConfidence ?? "medium",
            }));

        const legacyTriggers = (currentNode.metadata?.aiTransitionTriggers || [])
            .filter(t => !derivedTriggers.some(d => d.targetNodeId === t.targetNodeId));

        const allTriggers = [...derivedTriggers, ...legacyTriggers];

        // Extract coaching notes scoped to "ai" or "both" as behavioral context
        const coachingNotes = (currentNode.responses || [])
            .filter(r => r.isSpecialInstruction && (r.coachingScope === "ai" || r.coachingScope === "both"))
            .map(r => r.note || r.label)
            .filter(Boolean);

        const callProgressSection = callHistory?.visitedNodes
            ? `\n**Call Progress (${callHistory.nodesVisitedCount ?? "?"} nodes visited so far, oldest → newest):**\n${callHistory.visitedNodes}\n`
            : "";

        const differentiators = (quickRef.find(r => r.section === "differentiators")?.data ?? []) as string[];
        const metrics = (quickRef.find(r => r.section === "metrics")?.data ?? []) as Array<{ value: string; label: string }>;

        const productSection = product ? `\n**Product Being Sold:**
Name: ${product.name}${product.description ? `\nDescription: ${product.description}` : ""}${differentiators.length > 0
            ? `\nKey Differentiators: ${differentiators.join(" | ")}`
            : ""}${metrics.length > 0
            ? `\nKey Metrics: ${metrics.map(m => `${m.value} ${m.label}`).join(", ")}`
            : ""}${competitorList.length > 0
            ? `\nKnown Competitors (navigate to competitor objection nodes if prospect mentions these):\n${competitorList.map(c => `- ${c.name}${c.our_advantage ? `: our advantage — ${c.our_advantage}` : ""}`).join("\n")}`
            : ""}
` : "";

        const userPrompt = `
**Current Node:**
ID: ${currentNode.id}
Type: ${currentNode.type}
Intent: ${currentNode.metadata?.aiIntent || "N/A"}
Listen For: ${JSON.stringify(currentNode.listenFor || [])}
Triggers: ${JSON.stringify(allTriggers)}${coachingNotes.length > 0 ? `
Coaching Notes (follow these behavioral guidelines):
${coachingNotes.map(n => `- ${n}`).join("\n")}` : ""}
Responses (visible rep buttons): ${JSON.stringify((currentNode.responses || []).filter(r => !r.isSpecialInstruction))}
${productSection}
**Global Script Index (ALL available nodes — search this if the current node has no matching transition):**
${scriptIndex && scriptIndex.length > 0
            ? scriptIndex
                .map((n) =>
                    `[${n.id}] (${n.type}) "${n.title}"${n.context ? ` — ${n.context}` : ""
                    }${n.listenFor && n.listenFor.length > 0
                        ? `\n  Listen For: ${n.listenFor.join(", ")}`
                        : ""
                    }${n.aiTransitionTriggers.length > 0
                        ? `\n  Triggers: ${n.aiTransitionTriggers.map((t) => `if "${t.condition}" → ${t.targetNodeId} (${t.confidence})`).join("; ")}`
                        : ""
                    }`
                )
                .join("\n")
            : "(Not provided)"
        }
${callProgressSection}
**Recent Transcript:**
${transcript}

Analyze the transcript. First check the Current Node's transitions. If no match, search the Global Script Index. Detect ALL intents present. Return the JSON recommendation.`;

        // Prompt caching: mark the system prompt and the large userPrompt (which contains
        // the full script index) as cacheable. Only the dynamic per-call section
        // (transcript + call history) changes per request — keep that in the non-cached part.
        // @ts-expect-error - cache_control not yet in SDK types
        const stream = anthropic.messages.stream(
            // @ts-expect-error
            {
                model: "claude-haiku-4-5",
                max_tokens: 1000,
                system: [
                    {
                        type: "text",
                        text: COMPANION_SYSTEM_PROMPT,
                        cache_control: { type: "ephemeral" },
                    },
                ],
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: userPrompt,
                                cache_control: { type: "ephemeral" },
                            },
                        ],
                    },
                ],
            },
            {
                headers: { "anthropic-beta": "prompt-caching-2024-07-31" },
            }
        );

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    stream.on("text", (text: string) => {
                        controller.enqueue(encoder.encode(text));
                    });
                    await stream.finalMessage();
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
            cancel() {
                stream.abort();
            },
        });

        return new Response(readable, {
            headers: { "Content-Type": "text/plain" },
        });

    } catch (error: any) {
        console.error("AI Companion API error:", error);

        if (error?.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429 });
        }

        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate recommendation" }),
            { status: 500 }
        );
    }
}
