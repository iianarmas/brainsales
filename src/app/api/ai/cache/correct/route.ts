import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUser, getProductId } from "@/app/lib/apiAuth";
import { generateEmbedding } from "@/app/lib/embeddings";
import crypto from 'crypto';

function hashPhrase(phrase: string): string {
    return crypto.createHash('sha256').update(phrase.toLowerCase().trim()).digest('hex');
}

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "Product context required" }, { status: 400 });

    try {
        const body = await request.json();
        const { phrase_snippet, wrong_node_id, correct_node_id, organization_id, call_flow_id } = body;

        if (!phrase_snippet || !wrong_node_id || !correct_node_id || !organization_id) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const phrase_hash = hashPhrase(phrase_snippet);

        // Blacklist the wrong mapping, scoped to the call flow to avoid poisoning other flows
        let blacklistQuery = supabaseAdmin
            .from('ai_navigation_cache')
            .update({ status: 'blacklisted' })
            .eq('product_id', productId)
            .eq('phrase_hash', phrase_hash)
            .eq('node_id', wrong_node_id);

        if (call_flow_id) {
            blacklistQuery = blacklistQuery.eq('call_flow_id', call_flow_id);
        }

        await blacklistQuery;

        // Generate embedding for the corrected phrase (best-effort)
        let embedding: number[] | null = null;
        try {
            embedding = await generateEmbedding(phrase_snippet);
        } catch {
            console.warn('[AI Cache Correct] Could not generate embedding for corrected record, storing without vector.');
        }

        // Check if the correct node already exists for this phrase, scoped to the call flow
        let existingQuery = supabaseAdmin
            .from('ai_navigation_cache')
            .select('*')
            .eq('product_id', productId)
            .eq('phrase_hash', phrase_hash)
            .eq('node_id', correct_node_id);

        if (call_flow_id) {
            existingQuery = existingQuery.eq('call_flow_id', call_flow_id);
        } else {
            existingQuery = existingQuery.is('call_flow_id', null);
        }

        const { data: existing, error: err } = await existingQuery.single();

        if (err && err.code !== 'PGRST116') throw err;

        if (existing) {
            const updatePayload: Record<string, unknown> = {
                status: 'corrected',
                hit_count: existing.hit_count + 1,
                corrected_node_id: correct_node_id,
            };
            // Backfill embedding if missing
            if (!existing.embedding && embedding) {
                updatePayload.embedding = embedding;
            }

            await supabaseAdmin
                .from('ai_navigation_cache')
                .update(updatePayload)
                .eq('id', existing.id);
        } else {
            await supabaseAdmin
                .from('ai_navigation_cache')
                .insert({
                    organization_id,
                    product_id: productId,
                    phrase_hash,
                    phrase_snippet,
                    node_id: correct_node_id,
                    status: 'corrected',
                    corrected_node_id: correct_node_id,
                    hit_count: 1,
                    ...(call_flow_id && { call_flow_id }),
                    ...(embedding && { embedding }),
                });
        }

        return NextResponse.json({ success: true, status: 'corrected' });

    } catch (error) {
        console.error("AI cache correction error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
