import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUser, getOrganizationId, isOrgAdmin, getProductId } from "@/app/lib/apiAuth";
import { CallNode } from "@/data/callFlow";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const COMPANION_SYSTEM_PROMPT = `You are an expert AI Sales Co-Pilot listening to a live cold call.
Your job is to analyze the recent conversation transcript and the current script node's constraints,
and determine the NEXT node the sales rep should navigate to.

You must output ONLY a JSON object. No explanations, no markdown formatting.

You will be provided with:
1. The Current Node Context (what the rep is supposed to be doing right now, its intent, and possible branches).
2. The Recent Transcript (the last few lines of the conversation).

## Output Schema
Your JSON output must be exactly this structure:
{
  "confidence": "high" | "medium" | "low",
  "recommendedNodeId": string | null, // The ID of the node to navigate to, or null if uncertain
  "reasoning": string // Internal reasoning for the choice
}

## Rules
- Match the prospect's response to the node's \`responses\` or \`metadata.aiTransitionTriggers\`.
- Look very closely at the \`listenFor\` array arrays.
- If the prospect says something matching a "high" confidence trigger, return that \`targetNodeId\`.
- If the conversation is still on topic and the prospect hasn't answered the node's core intent yet, return null.
- If the prospect raises a clear objection (cost, timing, not interested, using competitor), navigate immediately to the corresponding objection node regardless of the current context.
`;

interface CompanionRequest {
    currentNode: CallNode;
    transcript: string;
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
        const { currentNode, transcript } = body;

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

Analyze the transcript based on the node context and return the JSON recommendation.`;

        const message = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 1000,
            system: COMPANION_SYSTEM_PROMPT,
            messages: [
                { role: "user", content: userPrompt },
            ],
        });

        // Extract text content from Claude's response
        const textBlock = message.content.find((block) => block.type === "text");
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
