import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUser, getProductId } from "@/app/lib/apiAuth";
import crypto from 'crypto';

function hashPhrase(phrase: string): string {
    return crypto.createHash('sha256').update(phrase.toLowerCase().trim()).digest('hex');
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "Product context required" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const phrase = searchParams.get('phrase');

    if (!phrase) return NextResponse.json({ error: "Missing phrase" }, { status: 400 });

    const phraseHash = hashPhrase(phrase);

    try {
        const { data, error } = await supabaseAdmin
            .from('ai_navigation_cache')
            .select('node_id, status')
            .eq('product_id', productId)
            .eq('phrase_hash', phraseHash)
            .in('status', ['confirmed', 'corrected'])
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found

        if (data) {
            return NextResponse.json({ match: true, nodeId: data.node_id, source: data.status });
        }

        return NextResponse.json({ match: false });
    } catch (error) {
        console.error("AI cache GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "Product context required" }, { status: 400 });

    try {
        const body = await request.json();
        const { phrase_snippet, node_id, organization_id } = body;

        if (!phrase_snippet || !node_id || !organization_id) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const phrase_hash = hashPhrase(phrase_snippet);

        // First, check if there's an existing active rule for this phrase hash
        // We only want to auto-learn or promote if it hasn't been corrected/blacklisted
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('ai_navigation_cache')
            .select('*')
            .eq('product_id', productId)
            .eq('phrase_hash', phrase_hash)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        console.log(`[AI Cache POST] Received phrase: "${phrase_snippet}". Hash: ${phrase_hash}, Node: ${node_id}`);

        if (existing) {
            console.log(`[AI Cache POST] Found existing record. Status: ${existing.status}, HitCount: ${existing.hit_count}, Node: ${existing.node_id}`);
            // If it's already corrected or blacklisted, do nothing; manual feedback overrides auto-learning.
            if (existing.status === 'corrected' || existing.status === 'blacklisted') {
                return NextResponse.json({ success: true, ignored: true });
            }

            // If it's the exact same node, increment hit_count and promote if >= 3
            if (existing.node_id === node_id) {
                const newHitCount = existing.hit_count + 1;
                const newStatus = newHitCount >= 3 ? 'confirmed' : 'provisional';

                const { error: updateError } = await supabaseAdmin
                    .from('ai_navigation_cache')
                    .update({ hit_count: newHitCount, status: newStatus })
                    .eq('id', existing.id);

                if (updateError) {
                    console.error("[AI Cache POST] Failed to update existing record", updateError);
                    throw updateError;
                }

                console.log(`[AI Cache POST] Successfully updated record. New HitCount: ${newHitCount}, New Status: ${newStatus}`);
                return NextResponse.json({ success: true, status: newStatus });
            } else {
                console.log(`[AI Cache POST] Existing rule points to different node (${existing.node_id} vs new ${node_id}). Ignoring to prevent thrashing.`);
            }
        } else {
            console.log(`[AI Cache POST] No existing record found. Inserting new provisional rule.`);
        }

        // Insert new provisional rule
        const { error: insertError } = await supabaseAdmin
            .from('ai_navigation_cache')
            .insert({
                organization_id,
                product_id: productId,
                phrase_hash,
                phrase_snippet,
                node_id,
                status: 'provisional',
                hit_count: 1
            });

        // Ignore unique constraint violation if it happens in a race condition
        if (insertError) {
            if (insertError.code !== '23505') {
                console.error("[AI Cache POST] Failed to insert new record", insertError);
                throw insertError;
            } else {
                console.log("[AI Cache POST] Race condition: record already inserted.");
            }
        } else {
            console.log("[AI Cache POST] Successfully inserted new provisional rule.");
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
