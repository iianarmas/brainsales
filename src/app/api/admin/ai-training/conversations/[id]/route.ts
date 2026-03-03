import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getProductId, isAdmin } from "@/app/lib/apiAuth";

// GET /api/admin/ai-training/conversations/[id]
// Returns a conversation with all its entries.
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
        const { data: conv, error: convError } = await supabaseAdmin
            .from("ai_training_conversations")
            .select("*")
            .eq("id", id)
            .eq("product_id", productId)
            .single();

        if (convError || !conv) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const { data: entries, error: entriesError } = await supabaseAdmin
            .from("ai_training_entries")
            .select("*")
            .eq("conversation_id", id)
            .order("created_at", { ascending: true });

        if (entriesError) throw entriesError;

        const entryList = entries || [];
        const summary = {
            total: entryList.length,
            confirmed: entryList.filter((e: any) => e.review_status === "confirmed").length,
            corrected: entryList.filter((e: any) => e.review_status === "corrected").length,
            rejected: entryList.filter((e: any) => e.review_status === "rejected").length,
            pending: entryList.filter((e: any) => e.review_status === "pending").length,
            gaps: entryList.filter((e: any) => e.is_gap).length,
            applied: entryList.filter((e: any) => e.applied_at !== null).length,
        };

        return NextResponse.json({ conversation: conv, entries: entryList, summary });
    } catch (error) {
        console.error("[AI Training] GET /conversations/[id] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
