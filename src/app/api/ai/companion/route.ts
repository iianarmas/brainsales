import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUser, getOrganizationId, isOrgAdmin, getProductId } from "@/app/lib/apiAuth";
import { CallNode } from "@/data/callFlow";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const COMPANION_SYSTEM_PROMPT = `You are an expert AI Sales Co-Pilot listening to a live cold call.
Your job is to analyze the recent conversation transcript and determine the NEXT node the sales rep should navigate to.

You must output ONLY a JSON object. No explanations, no markdown formatting.

You will be provided with:
1. The Current Node Context (what the rep is supposed to be doing right now, its intent, and possible branches).
2. The Recent Transcript (the last few lines of the conversation).
3. The Global Script Index (a summary of EVERY node in the call script).

## Output Schema
Your JSON output must be exactly this structure:
{
  "confidence": "high" | "medium" | "low",
  "recommendedNodeId": string | null, // The ID of the node to navigate to, or null ONLY if truly unable to determine
  "reasoning": string // Internal reasoning for the choice
}

## Rules
- FIRST, try to match the prospect's response to the Current Node's \`responses\` or \`metadata.aiTransitionTriggers\`.
- Look very closely at the \`listenFor\` arrays.
- If the prospect says something matching a "high" confidence trigger in the current node, return that \`targetNodeId\`.
- If no match is found in the Current Node, SEARCH THE GLOBAL SCRIPT INDEX for the most semantically appropriate node.
  - Match on intent and meaning, not exact keywords.
  - Common patterns to detect: cost/budget objections → look for obj_cost nodes; timing objections → obj_timing; competitor mentions → relevant competitor nodes; "not interested" → obj_not_interested.
- If the prospect raises a clear objection (cost, timing, not interested, using competitor), navigate immediately to the corresponding objection node regardless of the current context.
- Returning null is a LAST RESORT — use it only when you genuinely cannot determine what the prospect said or what they need.
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
}

export async function POST(request: NextRequest) {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get product context
    const productId = await getProductId(request, authHeader);
    if (!productId) {
        return NextResponse.json({ error: "Product context required" }, { status: 400 });
    }

    try {
        const body = (await request.json()) as CompanionRequest;
        const { currentNode, transcript, scriptIndex } = body;

        if (!currentNode || !transcript) {
            return NextResponse.json(
                { error: "currentNode and transcript are required" },
                { status: 400 }
            );
        }

        const userPrompt = `
**Current Node:**
ID: ${currentNode.id}
Type: ${currentNode.type}
Intent: ${currentNode.metadata?.aiIntent || "N/A"}
Listen For: ${JSON.stringify(currentNode.listenFor || [])}
Triggers: ${JSON.stringify(currentNode.metadata?.aiTransitionTriggers || [])}
Responses: ${JSON.stringify(currentNode.responses || [])}

**Recent Transcript:**
${transcript}

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

Analyze the transcript. First check the Current Node's transitions. If no match, search the Global Script Index for the best fitting node. Return the JSON recommendation.`;

        // Prompt caching: mark the system prompt and the large userPrompt (which contains
        // the full script index) as cacheable. Anthropic caches these token blocks for up to
        // 5 minutes, reducing latency ~30% and cost ~90% on repeated calls within a session.
        const message = await anthropic.messages.create(
            // @ts-ignore - Some Anthropic SDK types might not fully support cache_control yet
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

        // Extract text content from Claude's response
        const textBlock = message.content.find((block: any) => block.type === "text") as any;
        const content = textBlock?.text;

        if (!content) {
            return NextResponse.json({ error: "No response from AI" }, { status: 500 });
        }

        // Strip markdown formatting
        let jsonStr = content.trim();
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }

        if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
            const jsonMatch = jsonStr.match(/(\{[\s\S]*\})/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            }
        }

        let parsed: any;
        try {
            parsed = JSON.parse(jsonStr);
        } catch {
            console.error("Failed to parse Companion AI response:", content);
            return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
        }

        return NextResponse.json(parsed);

    } catch (error: any) {
        console.error("AI Companion API error:", error);

        if (error?.status === 429) {
            return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate recommendation" },
            { status: 500 }
        );
    }
}
