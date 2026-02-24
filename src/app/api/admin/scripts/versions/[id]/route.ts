import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

async function getOrganizationId(authHeader: string | null): Promise<string | null> {
    if (!authHeader || !supabaseAdmin) return null;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return null;

    const { data: memberData } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

    return memberData?.organization_id || null;
}

async function isOrgAdmin(authHeader: string | null): Promise<string | null> {
    const orgId = await getOrganizationId(authHeader);
    if (!orgId) return null;

    const token = authHeader!.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return null;

    const { data: admin } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .single();

    return admin ? orgId : null;
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    const orgId = await isOrgAdmin(authHeader);
    if (!orgId) {
        return NextResponse.json({ error: "Unauthorized or organization mismatch" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const { error } = await supabaseAdmin
            .from("flow_snapshots")
            .delete()
            .eq("id", id)
            .eq("product_id", (
                // Verify product belongs to org before deleting its snapshot
                await supabaseAdmin
                    .from("flow_snapshots")
                    .select("product_id")
                    .eq("id", id)
                    .single()
            ).data?.product_id)
            .filter("product_id", "in", (
                supabaseAdmin
                    .from("products")
                    .select("id")
                    .eq("organization_id", orgId)
            ));

        if (error) throw error;

        return NextResponse.json({ message: "Snapshot deleted successfully" });
    } catch (error) {
        console.error("Error deleting snapshot:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to delete snapshot"
        }, { status: 500 });
    }
}
