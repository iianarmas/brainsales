import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "./supabaseAdmin";
import { buildScriptIndex } from "./buildScriptIndex";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ParsedTurn {
    speaker: "PROSPECT" | "REP";
    text: string;
}

interface ProspectTurn {
    utterance: string;
    context: string; // preceding 1–2 rep lines
}

const SPEAKER_PREFIXES: Record<string, "PROSPECT" | "REP"> = {
    prospect: "PROSPECT",
    customer: "PROSPECT",
    client: "PROSPECT",
    rep: "REP",
    sales: "REP",
    agent: "REP",
    seller: "REP",
};

function parseTranscript(raw: string): ParsedTurn[] {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const turns: ParsedTurn[] = [];

    for (const line of lines) {
        // Try to match "SPEAKER: text" pattern (case-insensitive)
        const match = line.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
        if (match) {
            const speakerKey = match[1].toLowerCase();
            const speaker = SPEAKER_PREFIXES[speakerKey];
            const text = match[2].trim();
            if (speaker && text) {
                // Merge consecutive same-speaker lines
                const last = turns[turns.length - 1];
                if (last && last.speaker === speaker) {
                    last.text += " " + text;
                } else {
                    turns.push({ speaker, text });
                }
                continue;
            }
        }

        // No recognized prefix — attach to previous turn
        if (turns.length > 0 && line.length > 0) {
            turns[turns.length - 1].text += " " + line;
        }
    }

    return turns;
}

function extractProspectTurns(turns: ParsedTurn[]): ProspectTurn[] {
    const result: ProspectTurn[] = [];

    for (let i = 0; i < turns.length; i++) {
        if (turns[i].speaker !== "PROSPECT") continue;

        // Collect the preceding 1–2 REP lines as context
        const contextLines: string[] = [];
        for (let j = i - 1; j >= Math.max(0, i - 3) && contextLines.length < 2; j--) {
            if (turns[j].speaker === "REP") {
                contextLines.unshift(`Rep: ${turns[j].text}`);
            }
        }

        result.push({
            utterance: turns[i].text,
            context: contextLines.join("\n"),
        });
    }

    return result;
}

interface ClaudeEntry {
    utterance_index: number;
    matched_node_id: string | null;
    confidence: "high" | "medium" | "low";
    reasoning: string;
    is_gap: boolean;
    gap_suggested_title: string | null;
    gap_suggested_type: string | null;
    gap_suggested_script: string | null;
    gap_suggested_ai_condition: string | null;
}

async function processBatch(
    batch: ProspectTurn[],
    batchOffset: number,
    scriptIndexText: string
): Promise<ClaudeEntry[]> {
    const utteranceList = batch
        .map((t, i) => {
            const idx = batchOffset + i + 1;
            const ctx = t.context ? ` (Context: ${t.context.replace(/\n/g, " | ")})` : "";
            return `${idx}. ${t.utterance}${ctx}`;
        })
        .join("\n");

    const userPrompt = `## Script Index
${scriptIndexText}

## Instructions
Analyze each prospect utterance below and determine which script node it maps to.
Return a JSON array with one object per utterance, in order:
{
  "utterance_index": number,
  "matched_node_id": string | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "one sentence",
  "is_gap": boolean,
  "gap_suggested_title": string | null,
  "gap_suggested_type": string | null,
  "gap_suggested_script": string | null,
  "gap_suggested_ai_condition": string | null
}

Rules:
- Match by INTENT, not keywords. "we're good" at call start = not interested; mid-call = already handled.
- Only use node IDs that appear in the script index above.
- Set is_gap=true when no existing node adequately handles the utterance.
- For gaps: suggest a new node (title, type, 1-2 sentence rep script, draft aiCondition phrase).
- Output ONLY the JSON array. No markdown, no explanation.

Utterances:
${utteranceList}`;

    const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4000,
        system:
            "You are an AI training assistant for a sales script navigation system. For each prospect utterance, identify which script node it maps to. Output only valid JSON — no markdown, no explanation outside the JSON.",
        messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("");

    // Strip markdown fences if Claude wraps in them despite instructions
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned) as ClaudeEntry[];
}

/**
 * Processes a training conversation asynchronously (fire-and-forget from upload route).
 * Parses the transcript, sends batches to Claude, and inserts entries.
 * Updates the conversation status when done.
 */
export async function processTrainingConversation(
    conversationId: string,
    rawTranscript: string,
    productId: string,
    organizationId: string,
    callFlowId: string
): Promise<void> {
    try {
        // Parse transcript into prospect turns
        const allTurns = parseTranscript(rawTranscript);
        const prospectTurns = extractProspectTurns(allTurns);

        if (prospectTurns.length === 0) {
            await supabaseAdmin
                .from("ai_training_conversations")
                .update({
                    status: "error",
                    error_message:
                        "No prospect utterances found. Make sure your transcript uses PROSPECT: or REP: prefixes.",
                })
                .eq("id", conversationId);
            return;
        }

        // Build script index for this call flow (skip scope filter so all active nodes are included)
        const scriptIndex = await buildScriptIndex(productId, callFlowId, { fallbackToAll: true, skipScopeFilter: true });

        if (scriptIndex.length === 0) {
            await supabaseAdmin
                .from("ai_training_conversations")
                .update({
                    status: "error",
                    error_message: "No script nodes found for this product. Make sure your call flow has nodes set up.",
                })
                .eq("id", conversationId);
            return;
        }

        const scriptIndexText = scriptIndex
            .map(
                n =>
                    `[${n.id}] (${n.type}) "${n.title}"${n.context ? ` — ${n.context}` : ""}${n.listenFor.length > 0 ? `\n  Listen For: ${n.listenFor.join(", ")}` : ""}${n.aiTransitionTriggers.length > 0 ? `\n  Triggers: ${n.aiTransitionTriggers.map(t => `if "${t.condition}" → ${t.targetNodeId} (${t.confidence})`).join("; ")}` : ""}`
            )
            .join("\n");

        // Process in batches of 20
        const BATCH_SIZE = 20;
        const allEntries: ClaudeEntry[] = [];

        for (let i = 0; i < prospectTurns.length; i += BATCH_SIZE) {
            const batch = prospectTurns.slice(i, i + BATCH_SIZE);
            const entries = await processBatch(batch, i, scriptIndexText);
            allEntries.push(...entries);
        }

        // Insert all entries
        const rows = allEntries.map((entry, i) => {
            const turn = prospectTurns[i] ?? prospectTurns[entry.utterance_index - 1];
            return {
                conversation_id: conversationId,
                organization_id: organizationId,
                product_id: productId,
                call_flow_id: callFlowId,
                utterance: turn?.utterance ?? `(utterance ${i + 1})`,
                utterance_context: turn?.context || null,
                is_gap: entry.is_gap,
                suggested_node_id: entry.is_gap ? null : entry.matched_node_id,
                suggested_confidence: entry.confidence,
                claude_reasoning: entry.reasoning,
                review_status: "pending",
                gap_suggested_title: entry.gap_suggested_title,
                gap_suggested_type: entry.gap_suggested_type,
                gap_suggested_script: entry.gap_suggested_script,
                gap_suggested_ai_condition: entry.gap_suggested_ai_condition,
            };
        });

        if (rows.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from("ai_training_entries")
                .insert(rows);
            if (insertError) throw insertError;
        }

        const entryCount = allEntries.filter(e => !e.is_gap).length;
        const gapCount = allEntries.filter(e => e.is_gap).length;

        await supabaseAdmin
            .from("ai_training_conversations")
            .update({
                status: "ready",
                entry_count: entryCount,
                gap_count: gapCount,
                error_message: null,
            })
            .eq("id", conversationId);
    } catch (err) {
        console.error("[processTrainingConversation] Failed:", err);
        await supabaseAdmin
            .from("ai_training_conversations")
            .update({
                status: "error",
                error_message: err instanceof Error ? err.message : "Unknown processing error",
            })
            .eq("id", conversationId);
    }
}
