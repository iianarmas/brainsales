import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUser, getProductId } from "@/app/lib/apiAuth";
import { generateEmbedding } from "@/app/lib/embeddings";
import crypto from 'crypto';

function hashPhrase(phrase: string): string {
    return crypto.createHash('sha256').update(phrase.toLowerCase().trim()).digest('hex');
}

// ---------------------------------------------------------------------------
// GET /api/ai/cache?phrase=...
//
// 3-tier lookup:
//   Tier 1 — SHA-256 exact hash match      (~0ms)
//   Tier 2 — pgvector cosine similarity    (~150ms)
//   Tier 3 — returns { match: false }      → caller falls through to Claude
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "Product context required" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const phrase = searchParams.get('phrase');
    const callFlowId = searchParams.get('call_flow_id') || null;

    if (!phrase) return NextResponse.json({ error: "Missing phrase" }, { status: 400 });

    const phraseHash = hashPhrase(phrase);

    try {
        // ── Tier 1: Exact hash lookup (fastest path, ~0ms) ──────────────────
        let tier1Query = supabaseAdmin
            .from('ai_navigation_cache')
            .select('node_id, status')
            .eq('product_id', productId)
            .eq('phrase_hash', phraseHash)
            .in('status', ['confirmed', 'corrected']);

        // Scope to the active call flow OR universal entries (call_flow_id IS NULL)
        if (callFlowId) {
            tier1Query = tier1Query.or(`call_flow_id.eq.${callFlowId},call_flow_id.is.null`);
        }

        const { data: hashMatch, error: hashError } = await tier1Query
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (hashError && hashError.code !== 'PGRST116') throw hashError;

        if (hashMatch) {

            return NextResponse.json({
                match: true,
                nodeId: hashMatch.node_id,
                source: hashMatch.status,
                tier: 1,
            });
        }

        // ── Tier 2: Semantic vector similarity (~150ms) ──────────────────────
        // Generate embedding for the incoming phrase, then ask pgvector for
        // the closest confirmed/corrected entry in this product's cache.
        let embedding: number[];
        try {
            embedding = await generateEmbedding(phrase);
        } catch (embErr) {
            console.warn('[AI Cache] Embedding generation failed, falling back to Claude:', embErr);
            return NextResponse.json({ match: false });
        }

        const { data: vectorMatches, error: rpcError } = await supabaseAdmin.rpc('match_intents', {
            query_embedding: embedding,
            query_product_id: productId,
            match_threshold: 0.82,
            match_count: 1,
            query_call_flow_id: callFlowId,
        });

        if (rpcError) {
            console.warn('[AI Cache] match_intents RPC error, falling back to Claude:', rpcError);
            return NextResponse.json({ match: false });
        }

        if (vectorMatches && vectorMatches.length > 0) {
            const best = vectorMatches[0];
            const similarityPct = Math.round(best.similarity * 100);

            return NextResponse.json({
                match: true,
                nodeId: best.node_id,
                source: 'semantic',
                similarity: similarityPct,
                matchedPhrase: best.phrase_snippet,
                tier: 2,
            });
        }

        // ── No match — caller will invoke Claude (Tier 3) ───────────────────
        return NextResponse.json({ match: false });

    } catch (error) {
        console.error("AI cache GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// POST /api/ai/cache
//
// Saves a new intent → node mapping to the cache. Generates and stores an
// embedding alongside the phrase so future semantic lookups can match it.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "Product context required" }, { status: 400 });

    try {
        const body = await request.json();
        const { phrase_snippet, node_id, organization_id, reinforce, reject, call_flow_id } = body;

        if (!phrase_snippet || !node_id || !organization_id) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const phrase_hash = hashPhrase(phrase_snippet);

        // Check for existing active rule for this phrase hash, scoped to the call flow
        let existingQuery = supabaseAdmin
            .from('ai_navigation_cache')
            .select('*')
            .eq('product_id', productId)
            .eq('phrase_hash', phrase_hash);

        if (call_flow_id) {
            existingQuery = existingQuery.eq('call_flow_id', call_flow_id);
        } else {
            existingQuery = existingQuery.is('call_flow_id', null);
        }

        const { data: existing, error: fetchError } = await existingQuery
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;



        if (existing) {


            if (existing.status === 'blacklisted') {
                return NextResponse.json({ success: true, ignored: true });
            }

            // Handle Rejection (No)
            if (reject) {
                const newHitCount = Math.max(0, existing.hit_count - 1);
                const { error: rejectError } = await supabaseAdmin
                    .from('ai_navigation_cache')
                    .update({ hit_count: newHitCount, status: 'provisional' })
                    .eq('id', existing.id);

                if (rejectError) throw rejectError;

                return NextResponse.json({ success: true, status: 'provisional', hitCount: newHitCount });
            }

            // If it's the exact same node, increment / reinforce
            if (existing.node_id === node_id) {
                const newHitCount = reinforce && existing.hit_count >= 1
                    ? existing.hit_count
                    : existing.hit_count + 1;

                const newStatus = newHitCount >= 3 ? 'confirmed' : 'provisional';

                // Backfill embedding if it wasn't stored originally
                const updatePayload: Record<string, unknown> = { hit_count: newHitCount, status: newStatus };
                if (!existing.embedding) {
                    try {
                        const embedding = await generateEmbedding(phrase_snippet);
                        updatePayload.embedding = embedding;

                    } catch {
                        console.warn('[AI Cache POST] Could not backfill embedding, skipping.');
                    }
                }

                const { error: updateError } = await supabaseAdmin
                    .from('ai_navigation_cache')
                    .update(updatePayload)
                    .eq('id', existing.id);

                if (updateError) throw updateError;


                return NextResponse.json({ success: true, status: newStatus });
            }
        } else {

        }

        // Insert new provisional rule — reject for a missing record is a no-op
        if (reject) return NextResponse.json({ success: true });

        // Generate embedding for the new phrase (best-effort — never block the save)
        let embedding: number[] | null = null;
        try {
            embedding = await generateEmbedding(phrase_snippet);
        } catch {
            console.warn('[AI Cache POST] Could not generate embedding for new record, storing without vector.');
        }

        const { error: insertError } = await supabaseAdmin
            .from('ai_navigation_cache')
            .insert({
                organization_id,
                product_id: productId,
                phrase_hash,
                phrase_snippet,
                node_id,
                status: 'provisional',
                hit_count: 1,
                ...(call_flow_id && { call_flow_id }),
                ...(embedding && { embedding }),
            });

        // Ignore unique constraint violation from a race condition
        if (insertError) {
            if (insertError.code !== '23505') {
                console.error("[AI Cache POST] Failed to insert new record", insertError);
                throw insertError;
            } else {

            }
        } else {

        }

        return NextResponse.json({ success: true, status: 'provisional' });

    } catch (error) {
        console.error("AI cache POST error:", error);
        return NextResponse.json({
            error: "Internal server error",
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            raw: error
        }, { status: 500 });
    }
}
