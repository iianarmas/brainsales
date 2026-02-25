import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { getUser, getProductId } from "@/app/lib/apiAuth";
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
        const { phrase_snippet, wrong_node_id, correct_node_id, organization_id } = body;

        if (!phrase_snippet || !wrong_node_id || !correct_node_id || !organization_id) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const phrase_hash = hashPhrase(phrase_snippet);

        // First attempt to blacklist the wrong one if it exists
        await supabaseAdmin
            .from('ai_navigation_cache')
            .update({ status: 'blacklisted' })
            .eq('product_id', productId)
            .eq('phrase_hash', phrase_hash)
            .eq('node_id', wrong_node_id);

        // Then insert or override the correct one
        // Check if correct node already exists for this phrase
        const { data: existing, error: err } = await supabaseAdmin
            .from('ai_navigation_cache')
            .select('*')
            .eq('product_id', productId)
            .eq('phrase_hash', phrase_hash)
            .eq('node_id', correct_node_id)
            .single();

        if (err && err.code !== 'PGRST116') throw err;

        if (existing) {
            // Update to corrected status and set corrected node reference if needed
            await supabaseAdmin
                .from('ai_navigation_cache')
                .update({ status: 'corrected', hit_count: existing.hit_count + 1, corrected_node_id: correct_node_id })
                .eq('id', existing.id);
        } else {
            // Insert entirely new corrected entry
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
                    hit_count: 1
                });
        }

        return NextResponse.json({ success: true, status: 'corrected' });

    } catch (error) {
        console.error("AI cache correction error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
