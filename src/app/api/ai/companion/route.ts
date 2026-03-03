import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUser, getProductId } from "@/app/lib/apiAuth";
import { CallNode } from "@/data/callFlow";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const COMPANION_SYSTEM_PROMPT = `You are an expert AI Sales Co-Pilot listening to a live cold call.
Your job is to analyze the recent conversation transcript and determine the NEXT node(s) the sales rep should navigate to.

You must output ONLY a JSON object. No explanations, no markdown formatting.

You will be provided with:
1. The Current Node Context (what the rep is supposed to be doing right now, its intent, and possible branches).
2. The Recent Transcript (the last few lines of the conversation).
3. The Global Script Index (a summary of EVERY node in the call script).
4. Call Progress (nodes visited so far in this call, oldest to newest).

## Output Schema
Your JSON output must be exactly this structure:
{
  "primaryIntent": {
    "confidence": "high" | "medium" | "low",
    "recommendedNodeId": string | null,
    "reasoning": string
  },
  "additionalIntents": [
    { "recommendedNodeId": string, "topic": string, "reasoning": string }
  ]
}

## Multi-Intent Detection
When the prospect expresses multiple things at once (objection + buying signal, multiple objections, etc.),
identify ALL intents. Return the most urgent as primaryIntent and the rest as additionalIntents.
Priority order for primary: objections > questions > buying signals > continuation.
The additionalIntents array may be empty if only one intent is detected.

## Rules
- FIRST, try to match the prospect's response to the Current Node's \`triggers\` (derived from response aiConditions) or \`listenFor\` arrays.
- If the prospect says something matching a "high" confidence trigger, return that trigger's \`targetNodeId\` as primaryIntent.
- If present, follow the Current Node's \`coachingNotes\` as behavioral guidelines — they are instructions from the script author about how to reason at this node (e.g. "don't rush navigation", "emphasize ROI first").
- If no match is found in the Current Node, SEARCH THE GLOBAL SCRIPT INDEX for the most semantically appropriate node.
  - Match on intent and meaning, not exact keywords.
  - Common patterns to detect: cost/budget objections → look for obj_cost nodes; timing objections → obj_timing; competitor mentions → relevant competitor nodes; "not interested" → obj_not_interested.
- If the prospect raises a clear objection (cost, timing, not interested, using competitor), navigate immediately to the corresponding objection node regardless of the current context.
- Use the Call Progress to avoid recommending nodes the rep has already visited and handled.
- Returning null for recommendedNodeId is a LAST RESORT — use it only when you genuinely cannot determine what the prospect said or what they need.
- If the conversation is still on topic and the prospect hasn't answered the node's core intent yet, return null.
`;

interface ScriptIndexEntry {
    id: string;
    type: string;
    title: string;
    context: string | null;
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
    callHistory?: { visitedNodes: string };
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
            ? `\n**Call Progress (nodes visited so far, oldest → newest):**\n${callHistory.visitedNodes}\n`
            : "";

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

**Global Script Index (ALL available nodes — search this if the current node has no matching transition):**
${scriptIndex && scriptIndex.length > 0
            ? scriptIndex
                .map((n) =>
                    `[${n.id}] (${n.type}) "${n.title}"${n.context ? ` — ${n.context}` : ""
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
        // @ts-ignore - cache_control not yet in SDK types
        const stream = anthropic.messages.stream(
            // @ts-ignore
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
