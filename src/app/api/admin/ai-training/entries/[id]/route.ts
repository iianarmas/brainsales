import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, isAdmin } from "@/app/lib/apiAuth";

// PATCH /api/admin/ai-training/entries/[id]
// Admin reviews a single training entry: confirm, correct, or reject.
// Does NOT write to the cache — that happens via the bulk-apply route.
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const user = await getUser(authHeader);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminCheck = await isAdmin(authHeader);
    if (!adminCheck) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    try {
        const body = await request.json();
        const { review_status, admin_node_id, admin_notes } = body;

        if (!["pending", "confirmed", "corrected", "rejected"].includes(review_status)) {
            return NextResponse.json(
                { error: "review_status must be pending, confirmed, corrected, or rejected" },
                { status: 400 }
            );
        }

        if (review_status === "corrected" && !admin_node_id) {
            return NextResponse.json(
                { error: "admin_node_id is required when correcting an entry" },
                { status: 400 }
            );
        }

        const updatePayload: Record<string, unknown> = { review_status };
        if (review_status === "pending") {
            updatePayload.admin_node_id = null;
            updatePayload.admin_notes = null;
        } else {
            if (admin_node_id) updatePayload.admin_node_id = admin_node_id;
            if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;
        }

        const { data: entry, error: updateError } = await supabaseAdmin
            .from("ai_training_entries")
            .update(updatePayload)
            .eq("id", id)
            .select("*")
            .single();

        if (updateError) {
            if (updateError.code === "PGRST116") {
                return NextResponse.json({ error: "Entry not found" }, { status: 404 });
            }
            throw updateError;
        }

        return NextResponse.json({ success: true, entry });
    } catch (error) {
        console.error("[AI Training] PATCH /entries/[id] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
