import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getProductId, isAdmin } from "@/app/lib/apiAuth";

// POST /api/admin/ai-training/sessions/[id]/complete
// Marks a simulation session as completed.
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

    try {
        const { data: session, error: sessionError } = await supabaseAdmin
            .from("ai_simulation_sessions")
            .select("id, step_count")
            .eq("id", id)
            .eq("product_id", productId)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        await supabaseAdmin
            .from("ai_simulation_sessions")
            .update({ status: "completed" })
            .eq("id", id);

        const { data: steps } = await supabaseAdmin
            .from("ai_simulation_steps")
            .select("review_status, applied_to_cache")
            .eq("session_id", id);

        const stepList = steps || [];
        const summary = {
            total: stepList.length,
            confirmed: stepList.filter((s: any) => s.review_status === "confirmed").length,
            corrected: stepList.filter((s: any) => s.review_status === "corrected").length,
            rejected: stepList.filter((s: any) => s.review_status === "rejected").length,
            pending: stepList.filter((s: any) => s.review_status === "pending").length,
            applied: stepList.filter((s: any) => s.applied_to_cache).length,
        };

        return NextResponse.json({ success: true, summary });
    } catch (error) {
        console.error("[AI Training] POST /sessions/[id]/complete error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
