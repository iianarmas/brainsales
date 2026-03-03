import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getProductId, getOrganizationId, isAdmin } from "@/app/lib/apiAuth";
import { processTrainingConversation } from "@/app/lib/processTrainingConversation";

// POST /api/admin/ai-training/conversations
// Uploads a new transcript and fires async Claude processing.
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminCheck = await isAdmin(authHeader);
    if (!adminCheck) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });

    const orgId = await getOrganizationId(user.id);
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 400 });

    try {
        const body = await request.json();
        const { title, raw_transcript, call_flow_id } = body;

        if (!title || !raw_transcript || !call_flow_id) {
            return NextResponse.json(
                { error: "title, raw_transcript, and call_flow_id are required" },
                { status: 400 }
            );
        }

        const { data: conv, error: insertError } = await supabaseAdmin
            .from("ai_training_conversations")
            .insert({
                organization_id: orgId,
                product_id: productId,
                call_flow_id,
                created_by: user.id,
                title,
                raw_transcript,
                status: "processing",
            })
            .select("id, title, status, created_at")
            .single();

        if (insertError) throw insertError;

        // Fire-and-forget async processing — never block the response
        void processTrainingConversation(
            conv.id,
            raw_transcript,
            productId,
            orgId,
            call_flow_id
        );

        return NextResponse.json({ id: conv.id, status: "processing" });
    } catch (error) {
        console.error("[AI Training] POST /conversations error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET /api/admin/ai-training/conversations
// Lists all conversations for the current product, newest first.
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminCheck = await isAdmin(authHeader);
    if (!adminCheck) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const callFlowId = searchParams.get("call_flow_id");

    try {
        let query = supabaseAdmin
            .from("ai_training_conversations")
            .select("id, title, status, entry_count, gap_count, call_flow_id, error_message, created_at, updated_at")
            .eq("product_id", productId)
            .order("created_at", { ascending: false });

        if (callFlowId) query = query.eq("call_flow_id", callFlowId);

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ conversations: data || [] });
    } catch (error) {
        console.error("[AI Training] GET /conversations error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
