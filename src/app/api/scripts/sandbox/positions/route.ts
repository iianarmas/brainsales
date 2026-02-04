import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser } from "@/app/lib/apiAuth";

/**
 * PATCH /api/scripts/sandbox/positions
 * Batch update positions for sandbox nodes owned by the user.
 */
export async function PATCH(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const user = await getUser(authHeader);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as { positions: Array<{ id: string; position_x: number; position_y: number }> };

    if (!body.positions || !Array.isArray(body.positions) || body.positions.length === 0) {
      return NextResponse.json({ error: "Expected { positions: [...] } array" }, { status: 400 });
    }

    // Update each node's position (only if owned by the user and is sandbox/community)
    const updates = body.positions.map(async ({ id, position_x, position_y }) => {
      return supabaseAdmin!
        .from("call_nodes")
        .update({ position_x, position_y })
        .eq("id", id)
        .eq("owner_user_id", user!.id)
        .in("scope", ["sandbox", "community"]);
    });

    await Promise.all(updates);

    return NextResponse.json({ message: "Positions updated successfully" });
  } catch (error) {
    console.error("Error updating sandbox positions:", error);
    return NextResponse.json({ error: "Failed to update positions" }, { status: 500 });
  }
}
