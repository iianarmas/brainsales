import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser } from "@/app/lib/apiAuth";

/**
 * POST /api/scripts/community/publish
 * Publish sandbox node(s) to the community library (owner only).
 * Accepts either { nodeId } for single or { nodeIds } for bulk publish.
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
    const body = await request.json() as { nodeId?: string; nodeIds?: string[] };

    // Support both single and bulk
    const ids: string[] = body.nodeIds || (body.nodeId ? [body.nodeId] : []);

    if (ids.length === 0) {
      return NextResponse.json({ error: "nodeId or nodeIds is required" }, { status: 400 });
    }

    // Verify all nodes exist, are sandbox, and owned by the user
    const { data: nodes, error: fetchError } = await supabaseAdmin
      .from("call_nodes")
      .select("id, scope, owner_user_id")
      .in("id", ids);

    if (fetchError) throw new Error(fetchError.message);
    if (!nodes || nodes.length === 0) {
      return NextResponse.json({ error: "No nodes found" }, { status: 404 });
    }

    // Validate each node
    const errors: string[] = [];
    const validIds: string[] = [];
    for (const node of nodes) {
      if (node.scope !== "sandbox") {
        errors.push(`${node.id}: not a sandbox node`);
      } else if (node.owner_user_id !== user.id) {
        errors.push(`${node.id}: not owned by you`);
      } else {
        validIds.push(node.id);
      }
    }

    // Check for IDs that weren't found
    const foundIds = new Set(nodes.map(n => n.id));
    for (const id of ids) {
      if (!foundIds.has(id)) {
        errors.push(`${id}: not found`);
      }
    }

    if (validIds.length === 0) {
      return NextResponse.json({ error: "No valid nodes to publish", details: errors }, { status: 400 });
    }

    // Bulk update scope to community
    const { error: updateError } = await supabaseAdmin
      .from("call_nodes")
      .update({
        scope: "community",
        published_at: new Date().toISOString(),
      })
      .in("id", validIds);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `${validIds.length} node(s) published to community`,
      published: validIds,
      ...(errors.length > 0 ? { skipped: errors } : {}),
    });
  } catch (error) {
    console.error("Error publishing node(s):", error);
    return NextResponse.json({ error: "Failed to publish node(s)" }, { status: 500 });
  }
}
