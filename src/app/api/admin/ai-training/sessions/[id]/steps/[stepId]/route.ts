import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getProductId, isAdmin } from "@/app/lib/apiAuth";

// PATCH /api/admin/ai-training/sessions/[id]/steps/[stepId]
// Admin reviews a simulation step: confirm, correct, or reject.
// If confirmed/corrected, advances session.current_node_id to the effective node.
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; stepId: string }> }
) {
    const { id, stepId } = await params;
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminCheck = await isAdmin(authHeader);
    if (!adminCheck) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const productId = await getProductId(request, authHeader);
    if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });

    try {
        const body = await request.json();
        const { review_status, admin_node_id } = body;

        if (!["confirmed", "corrected", "rejected"].includes(review_status)) {
            return NextResponse.json(
                { error: "review_status must be confirmed, corrected, or rejected" },
                { status: 400 }
            );
        }

        if (review_status === "corrected" && !admin_node_id) {
            return NextResponse.json(
                { error: "admin_node_id is required when correcting a step" },
                { status: 400 }
            );
        }

        // Fetch the step and verify it belongs to this session
        const { data: step, error: stepError } = await supabaseAdmin
            .from("ai_simulation_steps")
            .select("*")
            .eq("id", stepId)
            .eq("session_id", id)
            .single();

        if (stepError || !step) {
            return NextResponse.json({ error: "Step not found" }, { status: 404 });
        }

        const updatePayload: Record<string, any> = { review_status };
        if (review_status === "corrected") updatePayload.admin_node_id = admin_node_id;

        const { error: updateError } = await supabaseAdmin
            .from("ai_simulation_steps")
            .update(updatePayload)
            .eq("id", stepId);

        if (updateError) throw updateError;

        // Advance session.current_node_id to the effective node (unless rejected)
        let nextNodeData: any = null;
        if (review_status !== "rejected") {
            const effectiveNodeId =
                review_status === "corrected" ? admin_node_id : step.resolved_node_id;

            if (effectiveNodeId) {
                await supabaseAdmin
                    .from("ai_simulation_sessions")
                    .update({ current_node_id: effectiveNodeId })
                    .eq("id", id);

                // Fetch next node data for the UI to render immediately
                const { data: node } = await supabaseAdmin
                    .from("call_nodes")
                    .select("id, type, title, script, context, metadata")
                    .eq("id", effectiveNodeId)
                    .eq("product_id", productId)
                    .single();

                if (node) {
                    const [listenForRes, responsesRes] = await Promise.all([
                        supabaseAdmin
                            .from("call_node_listen_for")
                            .select("listen_for_text")
                            .eq("node_id", effectiveNodeId)
                            .order("sort_order"),
                        supabaseAdmin
                            .from("call_node_responses")
                            .select("*")
                            .eq("node_id", effectiveNodeId)
                            .order("sort_order"),
                    ]);

                    nextNodeData = {
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
                    };
                }
            }
        }

        return NextResponse.json({
            step: { ...step, ...updatePayload },
            next_node: nextNodeData,
        });
    } catch (error) {
        console.error("[AI Training] PATCH /sessions/[id]/steps/[stepId] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
