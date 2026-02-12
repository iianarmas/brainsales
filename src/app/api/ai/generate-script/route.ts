import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getOrganizationId, isOrgAdmin, getProductId } from "@/app/lib/apiAuth";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an Expert Sales Script Architect. Your job is to generate a complete, multi-branching cold call flow for a sales team.

You will receive:
1. A product/service description
2. A target persona description
3. Common objections encountered

You must output ONLY a JSON object with a "nodes" key containing an array of call nodes. No other text, no markdown, no explanations - just the raw JSON object.

## Node Schema

Each node MUST follow this exact structure:
{
  "id": string,        // Unique snake_case identifier (e.g., "opening_intro", "disc_pain_points", "pitch_main")
  "type": string,      // One of: "opening", "discovery", "pitch", "objection", "close", "success", "voicemail", "end"
  "title": string,     // Short descriptive title for the node
  "script": string,    // The actual words the sales rep should say. Use natural, conversational language.
  "context": string,   // Coaching notes for the rep (why this script works, what to listen for)
  "keyPoints": string[],  // Optional bullet points of key things to remember
  "warnings": string[],   // Optional warnings or things to avoid
  "listenFor": string[],  // Optional cues to listen for in the prospect's response
  "responses": [        // Array of possible prospect responses, each branching to another node
    {
      "label": string,     // Short label describing this response path (e.g., "Interested", "Has objection")
      "nextNode": string,  // The id of the next node to go to
      "note": string       // Brief coaching note about this path
    }
  ]
}

## Required Flow Structure

Your flow MUST include ALL of these sections:

1. **Opening** (1-2 nodes): A pattern-interrupt opening that asks about their current process/pain. NOT a pitch. Sound curious, not sales-y.

2. **Discovery** (3-5 nodes): Branch based on their responses. Dig into pain points, current solutions, and gaps. Ask smart questions.

3. **Pitch** (2-4 nodes): Tailored value propositions based on what you discovered. Reference their specific pain points. Focus on outcomes and ROI, not features.

4. **Objection Handling** (4-6 nodes): Handle common objections like:
   - "Not interested" / "We're fine"
   - "Send me information"
   - "Bad timing"
   - "How much does it cost?"
   - "I'm not the decision maker"
   - Plus any industry-specific objections provided

5. **Close** (2-3 nodes): Ask for the meeting/next step. Include a soft close alternative. Use assumptive closing techniques.

6. **Success** (1 node): What to say when they agree to a meeting. Confirm details.

7. **End** (2-3 nodes): Graceful endings for different outcomes (info sent, follow-up scheduled, not interested).

8. **Voicemail** (1 node): A concise voicemail script under 30 seconds.

## Sales Framework Rules

- Opening must be a QUESTION about their process, not a pitch
- Use empathy and validation ("I hear that a lot", "That makes sense")
- Include pattern interrupts and psychological triggers
- Pitches should focus on outcomes/ROI, not just features
- Always have a soft close fallback
- Objection handling should acknowledge, reframe, then redirect
- Include clear CTAs (calls to action) in close nodes
- Use placeholder brackets like [Name], [Company], [Day/Time] for personalization

## Output Rules

- Output ONLY a JSON object: {"nodes": [...]}. No markdown, no code blocks, no explanations before or after.
- The nodes array must be flat (not nested).
- Every nextNode reference MUST point to a valid id in the array.
- Generate 15-25 nodes for a complete flow.
- Node IDs should be descriptive and use snake_case.
- The first node in the array should be the opening node.`;

interface GenerateRequest {
  productDescription: string;
  targetPersona: string;
  commonObjections: string;
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Auth check
  const authHeader = request.headers.get("authorization");
  const user = await getUser(authHeader);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Org admin check
  const organizationId = await getOrganizationId(user.id);
  if (!organizationId) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  const isAdmin = await isOrgAdmin(user.id, organizationId);
  if (!isAdmin) {
    return NextResponse.json({ error: "Only organization admins can generate scripts" }, { status: 403 });
  }

  // Get product context
  const productId = await getProductId(request, authHeader);
  if (!productId) {
    return NextResponse.json({ error: "Product context required" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as GenerateRequest;
    const { productDescription, targetPersona, commonObjections } = body;

    if (!productDescription || !targetPersona) {
      return NextResponse.json(
        { error: "productDescription and targetPersona are required" },
        { status: 400 }
      );
    }

    const userPrompt = `Generate a complete cold call script flow for the following:

**Product/Service:**
${productDescription}

**Target Persona:**
${targetPersona}

**Common Objections:**
${commonObjections || "None specified - use standard sales objections (not interested, bad timing, cost concerns, need to check with others, send info)."}

Generate the JSON object with the nodes array now. Remember: output ONLY the raw JSON object, nothing else.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
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

    // Parse and validate the response - strip any markdown code fences if present
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    // Handle both { nodes: [...] } and direct array formats
    const nodes = Array.isArray(parsed) ? parsed : parsed.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json({ error: "AI returned empty or invalid node array" }, { status: 500 });
    }

    // Validate node references
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const warnings: string[] = [];

    for (const node of nodes) {
      if (!node.id || !node.type || !node.title || !node.script) {
        warnings.push(`Node missing required fields: ${JSON.stringify(node).slice(0, 100)}`);
        continue;
      }
      if (!node.responses) {
        node.responses = [];
      }
      for (const resp of node.responses) {
        if (resp.nextNode && !nodeIds.has(resp.nextNode)) {
          warnings.push(`Node "${node.id}" references non-existent nextNode "${resp.nextNode}"`);
        }
      }
    }

    return NextResponse.json({
      nodes,
      warnings,
      nodeCount: nodes.length,
    });
  } catch (error: any) {
    console.error("AI Script Generation error:", error);

    if (error?.status === 429) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again in a moment." }, { status: 429 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate script" },
      { status: 500 }
    );
  }
}
