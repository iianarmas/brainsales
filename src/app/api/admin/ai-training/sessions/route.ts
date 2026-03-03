import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getProductId, getOrganizationId, isAdmin } from "@/app/lib/apiAuth";

// POST /api/admin/ai-training/sessions
// Creates a new simulation session for a specific call flow.
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
        const { title, call_flow_id, opening_node_id } = body;

        if (!title || !call_flow_id || !opening_node_id) {
            return NextResponse.json(
                { error: "title, call_flow_id, and opening_node_id are required" },
                { status: 400 }
            );
        }

        // Verify the opening node exists for this product
        const { data: node, error: nodeError } = await supabaseAdmin
            .from("call_nodes")
            .select("id, type, title, script, context, metadata")
            .eq("id", opening_node_id)
            .eq("product_id", productId)
            .single();

        if (nodeError || !node) {
            return NextResponse.json({ error: "Opening node not found" }, { status: 404 });
        }

        // Fetch full node data for the response
        const [listenForRes, responsesRes] = await Promise.all([
            supabaseAdmin
                .from("call_node_listen_for")
                .select("listen_for_text")
                .eq("node_id", opening_node_id)
                .order("sort_order"),
            supabaseAdmin
                .from("call_node_responses")
                .select("*")
                .eq("node_id", opening_node_id)
                .order("sort_order"),
        ]);

        const { data: session, error: sessionError } = await supabaseAdmin
            .from("ai_simulation_sessions")
            .insert({
                organization_id: orgId,
                product_id: productId,
                call_flow_id,
                created_by: user.id,
                title,
                opening_node_id,
                current_node_id: opening_node_id,
                status: "active",
                step_count: 0,
            })
            .select("*")
            .single();

        if (sessionError) throw sessionError;

        return NextResponse.json({
            session,
            current_node: {
                ...node,
                listenFor: (listenForRes.data || []).map((l: any) => l.listen_for_text),
                responses: (responsesRes.data || []).map((r: any) => ({
                    label: r.label,
                    nextNode: r.next_node_id,
                    note: r.note,
                    isSpecialInstruction: r.is_special_instruction,
                    coachingScope: r.coaching_scope,
                    aiCondition: r.ai_condition,
                    aiConfidence: r.ai_confidence,
                })),
            },
        });
    } catch (error) {
        console.error("[AI Training] POST /sessions error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET /api/admin/ai-training/sessions
// Lists all simulation sessions for the current product, newest first.
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
    const status = searchParams.get("status");

    try {
        let query = supabaseAdmin
            .from("ai_simulation_sessions")
            .select("id, title, status, step_count, call_flow_id, opening_node_id, current_node_id, created_at, updated_at")
            .eq("product_id", productId)
            .order("created_at", { ascending: false });

        if (callFlowId) query = query.eq("call_flow_id", callFlowId);
        if (status) query = query.eq("status", status);

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ sessions: data || [] });
    } catch (error) {
        console.error("[AI Training] GET /sessions error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
