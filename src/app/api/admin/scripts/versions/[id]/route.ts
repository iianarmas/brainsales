import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

async function isAdmin(authHeader: string | null): Promise<boolean> {
    if (!authHeader || !supabaseAdmin) return false;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return false;
    const { data } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .single();
    return !!data;
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!(await isAdmin(authHeader))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const { error } = await supabaseAdmin
            .from("flow_snapshots")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ message: "Snapshot deleted successfully" });
    } catch (error) {
        console.error("Error deleting snapshot:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to delete snapshot"
        }, { status: 500 });
    }
}
