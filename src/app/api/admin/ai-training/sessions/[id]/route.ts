import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getProductId, isAdmin } from "@/app/lib/apiAuth";

// GET /api/admin/ai-training/sessions/[id]
// Returns a session with all its steps ordered by step_number.
export async function GET(
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
            .select("*")
            .eq("id", id)
            .eq("product_id", productId)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const { data: steps, error: stepsError } = await supabaseAdmin
            .from("ai_simulation_steps")
            .select("*")
            .eq("session_id", id)
            .order("step_number", { ascending: true });

        if (stepsError) throw stepsError;

        // Summary counts
        const stepList = steps || [];
        const summary = {
            total: stepList.length,
            confirmed: stepList.filter((s: any) => s.review_status === "confirmed").length,
            corrected: stepList.filter((s: any) => s.review_status === "corrected").length,
            rejected: stepList.filter((s: any) => s.review_status === "rejected").length,
            pending: stepList.filter((s: any) => s.review_status === "pending").length,
            applied: stepList.filter((s: any) => s.applied_to_cache).length,
        };

        return NextResponse.json({ session, steps: stepList, summary });
    } catch (error) {
        console.error("[AI Training] GET /sessions/[id] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
