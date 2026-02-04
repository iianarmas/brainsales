import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser } from "@/app/lib/apiAuth";

/**
 * POST /api/scripts/community/unpublish
 * Move a community node back to sandbox (owner only).
 */
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const user = await getUser(authHeader);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { nodeId } = await request.json() as { nodeId: string };

    if (!nodeId) {
      return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
    }

    // Verify the node exists, is a community node, and is owned by the user
    const { data: node } = await supabaseAdmin
      .from("call_nodes")
      .select("id, scope, owner_user_id")
      .eq("id", nodeId)
      .single();

    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
    if (node.scope !== "community") {
      return NextResponse.json({ error: "Only community nodes can be unpublished" }, { status: 400 });
    }
    if (node.owner_user_id !== user.id) {
      return NextResponse.json({ error: "You can only unpublish your own nodes" }, { status: 403 });
    }

    // Move back to sandbox
    const { error: updateError } = await supabaseAdmin
      .from("call_nodes")
      .update({
        scope: "sandbox",
        published_at: null,
      })
      .eq("id", nodeId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Node unpublished (moved to sandbox)", id: nodeId });
  } catch (error) {
    console.error("Error unpublishing node:", error);
    return NextResponse.json({ error: "Failed to unpublish node" }, { status: 500 });
  }
}
