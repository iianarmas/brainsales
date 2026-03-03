import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUser, getProductId } from "@/app/lib/apiAuth";
import OpenAI from "openai";
import crypto from "crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function hashPhrase(phrase: string): string {
    return crypto.createHash("sha256").update(phrase.toLowerCase().trim()).digest("hex");
}

/**
 * POST /api/ai/cache/prewarm
 *
 * Batch pre-warms the AI navigation cache with known aiCondition phrases.
 * Used for:
 * - Level 2: call-start backfill (all uncached nodes in the active flow)
 * - Level 3: per-navigation safety net (current node's responses only)
 *
 * All entries are stored with status: 'confirmed', making them immediately
 * usable for both Tier 1 (hash) and Tier 2 (vector) lookups.
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "Product context required" }, { status: 400 });

    try {
        const body = await request.json();
        const { conditions, organizationId, callFlowId = null } = body as {
            conditions: Array<{ phrase: string; nodeId: string }>;
            organizationId: string;
            callFlowId: string | null;
        };

        if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
            return NextResponse.json({ skipped: 0, inserted: 0 });
        }

        if (!organizationId) {
            return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
        }

        const phraseHashes = conditions.map(c => hashPhrase(c.phrase));

        // Batch-query existing entries — skip already cached
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
            return NextResponse.json({ skipped: conditions.length, inserted: 0 });
        }

        // Single OpenAI batch embedding round-trip
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

        const { error: batchError } = await supabaseAdmin
            .from("ai_navigation_cache")
            .insert(rows);

        if (batchError) {
            if (batchError.code === "23505") {
                // Race condition — insert individually, skipping duplicates
                await Promise.allSettled(
                    rows.map(row => supabaseAdmin.from("ai_navigation_cache").insert(row))
                );
            } else {
                throw batchError;
            }
        }

        return NextResponse.json({ skipped: conditions.length - newConditions.length, inserted: newConditions.length });
    } catch (error) {
        console.error("Prewarm cache error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
