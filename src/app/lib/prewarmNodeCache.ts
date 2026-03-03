import OpenAI from "openai";
import { supabaseAdmin } from "./supabaseAdmin";
import crypto from "crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function hashPhrase(phrase: string): string {
    return crypto.createHash("sha256").update(phrase.toLowerCase().trim()).digest("hex");
}

/**
 * Pre-warms the AI navigation cache for a set of node responses.
 *
 * Called after node create/update/import so Tier 1 (hash) and Tier 2 (vector)
 * lookups are ready before any rep starts a call.
 *
 * - Skips phrases already in the cache (never overwrites confirmed/corrected).
 * - Generates embeddings in one OpenAI batch round-trip.
 * - Inserts with status: 'confirmed' so both tiers work immediately.
 * - Safe to call fire-and-forget — all errors are logged, never thrown.
 */
export async function prewarmNodeConditions(
    responses: Array<{ aiCondition?: string; nextNode: string }>,
    productId: string,
    organizationId: string,
    callFlowId: string | null
): Promise<void> {
    const conditions = responses
        .filter(r => r.aiCondition && r.nextNode)
        .map(r => ({ phrase: r.aiCondition!, nodeId: r.nextNode }));

    if (conditions.length === 0) return;

    try {
        const phraseHashes = conditions.map(c => hashPhrase(c.phrase));

        // Batch-query existing hashes — skip already-cached entries
        let existingQuery = supabaseAdmin
            .from("ai_navigation_cache")
            .select("phrase_hash")
            .eq("product_id", productId)
            .in("phrase_hash", phraseHashes);

        if (callFlowId) {
            existingQuery = existingQuery.eq("call_flow_id", callFlowId);
        } else {
            existingQuery = existingQuery.is("call_flow_id", null);
        }

        const { data: existing } = await existingQuery;
        const existingHashes = new Set((existing || []).map((e: any) => e.phrase_hash));

        const newConditions = conditions.filter((_, i) => !existingHashes.has(phraseHashes[i]));
        if (newConditions.length === 0) {
            return;
        }

        // Single OpenAI batch embedding round-trip (~400–600ms for 100–300 phrases)
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: newConditions.map(c => c.phrase.toLowerCase().trim()),
        });

        const rows = newConditions.map((c, i) => ({
            organization_id: organizationId,
            product_id: productId,
            phrase_hash: hashPhrase(c.phrase),
            phrase_snippet: c.phrase,
            node_id: c.nodeId,
            status: "confirmed",
            hit_count: 1,
            embedding: embeddingResponse.data[i].embedding,
            ...(callFlowId && { call_flow_id: callFlowId }),
        }));

        // Try batch insert; on unique constraint conflict (race condition), fall back to per-row
        const { error: batchError } = await supabaseAdmin
            .from("ai_navigation_cache")
            .insert(rows);

        if (batchError) {
            if (batchError.code === "23505") {
                // Race condition: insert individually and skip duplicates
                await Promise.allSettled(
                    rows.map(row => supabaseAdmin.from("ai_navigation_cache").insert(row))
                );

            } else {
                console.error("[PrewarmNodeCache] Batch insert failed:", batchError);
            }
        } else {

        }
    } catch (err) {
        console.error("[PrewarmNodeCache] Failed:", err);
    }
}
