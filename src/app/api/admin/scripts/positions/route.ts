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

interface PositionUpdate {
    id: string;
    position_x: number;
    position_y: number;
}

/**
 * PATCH /api/admin/scripts/positions
 * Bulk update node positions (admin only)
 */
export async function PATCH(request: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    const orgId = await isOrgAdmin(authHeader);

    if (!orgId) {
        return NextResponse.json({ error: "Unauthorized or organization mismatch" }, { status: 403 });
    }

    try {
        const body = await request.json() as { positions: PositionUpdate[] };

        if (!body.positions || !Array.isArray(body.positions)) {
            return NextResponse.json(
                { error: "Invalid request body. Expected { positions: PositionUpdate[] }" },
                { status: 400 }
            );
        }

        // Get user ID from auth header (supabaseAdmin is already checked above)
        const token = authHeader?.replace("Bearer ", "") || "";
        const { data: { user } } = await supabaseAdmin!.auth.getUser(token);

        // Update each node position, but ONLY if it belongs to the admin's organization
        const updatePromises = body.positions.map((pos) =>
            supabaseAdmin!
                .from("call_nodes")
                .update({
                    position_x: pos.position_x,
                    position_y: pos.position_y,
                    updated_by: user?.id || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", pos.id)
                .eq("organization_id", orgId) // Strict organization filter
        );

        const results = await Promise.all(updatePromises);

        // Check for errors
        const errors = results.filter((r) => r.error);
        if (errors.length > 0) {
            console.error("Errors updating positions:", errors);
            return NextResponse.json(
                { error: "Some positions failed to update", details: errors },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: "Positions updated successfully",
            count: body.positions.length,
        });
    } catch (error) {
        console.error("Error updating positions:", error);
        return NextResponse.json({ error: "Failed to update positions" }, { status: 500 });
    }
}
