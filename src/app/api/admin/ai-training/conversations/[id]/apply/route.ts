import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getProductId, getOrganizationId, isAdmin } from "@/app/lib/apiAuth";
import { prewarmNodeConditions } from "@/app/lib/prewarmNodeCache";

// POST /api/admin/ai-training/conversations/[id]/apply
// Bulk-applies all confirmed/corrected entries to ai_navigation_cache.
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
        const { data: conv, error: convError } = await supabaseAdmin
            .from("ai_training_conversations")
            .select("call_flow_id")
            .eq("id", id)
            .eq("product_id", productId)
            .single();

        if (convError || !conv) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const { data: entries, error: entriesError } = await supabaseAdmin
            .from("ai_training_entries")
            .select("id, utterance, suggested_node_id, admin_node_id, review_status, is_gap")
            .eq("conversation_id", id)
            .in("review_status", ["confirmed", "corrected"])
            .eq("is_gap", false)
            .is("applied_at", null);

        if (entriesError) throw entriesError;

        if (!entries || entries.length === 0) {
            return NextResponse.json({ applied: 0, skipped: 0 });
        }

        const conditions = entries
            .map((e: any) => {
                const effectiveNodeId =
                    e.review_status === "corrected" ? e.admin_node_id : e.suggested_node_id;
                if (!effectiveNodeId) return null;
                return { aiCondition: e.utterance, nextNode: effectiveNodeId };
            })
            .filter(Boolean) as Array<{ aiCondition: string; nextNode: string }>;

        if (conditions.length > 0) {
            await prewarmNodeConditions(
                conditions.map(c => ({ aiCondition: c.aiCondition, nextNode: c.nextNode })),
                productId,
                orgId,
                conv.call_flow_id
            );
        }

        // Mark applied
        const entryIds = entries.map((e: any) => e.id);
        await supabaseAdmin
            .from("ai_training_entries")
            .update({ applied_at: new Date().toISOString() })
            .in("id", entryIds);

        // Check if all non-rejected entries are now applied; if so mark conversation applied
        const { data: remaining } = await supabaseAdmin
            .from("ai_training_entries")
            .select("id")
            .eq("conversation_id", id)
            .not("review_status", "eq", "rejected")
            .is("applied_at", null)
            .eq("is_gap", false);

        if (!remaining || remaining.length === 0) {
            await supabaseAdmin
                .from("ai_training_conversations")
                .update({ status: "applied" })
                .eq("id", id);
        }

        return NextResponse.json({
            applied: conditions.length,
            skipped: entries.length - conditions.length,
        });
    } catch (error) {
        console.error("[AI Training] POST /conversations/[id]/apply error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
