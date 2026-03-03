import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getProductId, getOrganizationId, isAdmin } from "@/app/lib/apiAuth";
import { prewarmNodeConditions } from "@/app/lib/prewarmNodeCache";

// POST /api/admin/ai-training/sessions/[id]/apply
// Bulk-applies all confirmed/corrected steps to ai_navigation_cache.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
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
        const { data: session, error: sessionError } = await supabaseAdmin
            .from("ai_simulation_sessions")
            .select("call_flow_id")
            .eq("id", id)
            .eq("product_id", productId)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const { data: steps, error: stepsError } = await supabaseAdmin
            .from("ai_simulation_steps")
            .select("id, utterance, resolved_node_id, admin_node_id, review_status")
            .eq("session_id", id)
            .in("review_status", ["confirmed", "corrected"])
            .eq("applied_to_cache", false);

        if (stepsError) throw stepsError;

        if (!steps || steps.length === 0) {
            return NextResponse.json({ applied: 0, skipped: 0 });
        }

        // Build the conditions array for prewarmNodeConditions
        const conditions = steps
            .map((s: any) => {
                const effectiveNodeId =
                    s.review_status === "corrected" ? s.admin_node_id : s.resolved_node_id;
                if (!effectiveNodeId) return null;
                return { aiCondition: s.utterance, nextNode: effectiveNodeId };
            })
            .filter(Boolean) as Array<{ aiCondition: string; nextNode: string }>;

        if (conditions.length === 0) {
            return NextResponse.json({ applied: 0, skipped: steps.length });
        }

        // Reuse prewarmNodeConditions: batch embedding + confirmed-status insert
        await prewarmNodeConditions(
            conditions.map(c => ({ aiCondition: c.aiCondition, nextNode: c.nextNode })),
            productId,
            orgId,
            session.call_flow_id
        );

        // Mark all steps as applied
        const stepIds = steps.map((s: any) => s.id);
        await supabaseAdmin
            .from("ai_simulation_steps")
            .update({ applied_to_cache: true })
            .in("id", stepIds);

        return NextResponse.json({
            applied: conditions.length,
            skipped: steps.length - conditions.length,
        });
    } catch (error) {
        console.error("[AI Training] POST /sessions/[id]/apply error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
