import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser } from "@/app/lib/apiAuth";
import { CallNode } from "@/data/callFlow";

/**
 * PATCH /api/scripts/sandbox/nodes/[id]
 * Update a sandbox node (owner only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const user = await getUser(authHeader);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: nodeId } = await params;
    const body = await request.json() as Partial<CallNode> & {
      position_x?: number;
      position_y?: number;
      topic_group_id?: string;
    };

    // Verify node exists, is a sandbox node, and is owned by the user
    const { data: existing } = await supabaseAdmin
      .from("call_nodes")
      .select("id, product_id, scope, owner_user_id")
      .eq("id", nodeId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
    if (existing.scope !== "sandbox" && existing.scope !== "community") {
      return NextResponse.json({ error: "Can only edit sandbox/community nodes" }, { status: 403 });
    }
    if (existing.owner_user_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own nodes" }, { status: 403 });
    }

    const productId = existing.product_id;

    // Update main node
    const { error: nodeError } = await supabaseAdmin
      .from("call_nodes")
      .update({
        type: body.type,
        title: body.title,
        script: body.script,
        context: body.context || null,
        metadata: body.metadata || null,
        position_x: body.position_x,
        position_y: body.position_y,
        topic_group_id: body.topic_group_id || null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", nodeId);

    if (nodeError) {
      return NextResponse.json({ error: nodeError.message }, { status: 500 });
    }

    // Update satellite data (delete and re-insert pattern)
    if (body.keyPoints !== undefined) {
      await supabaseAdmin.from("call_node_keypoints").delete().eq("node_id", nodeId);
      if (body.keyPoints && body.keyPoints.length > 0) {
        await supabaseAdmin.from("call_node_keypoints").insert(
          body.keyPoints.map((keypoint, index) => ({ node_id: nodeId, keypoint, sort_order: index, product_id: productId }))
        );
      }
    }
    if (body.warnings !== undefined) {
      await supabaseAdmin.from("call_node_warnings").delete().eq("node_id", nodeId);
      if (body.warnings && body.warnings.length > 0) {
        await supabaseAdmin.from("call_node_warnings").insert(
          body.warnings.map((warning, index) => ({ node_id: nodeId, warning, sort_order: index, product_id: productId }))
        );
      }
    }
    if (body.listenFor !== undefined) {
      await supabaseAdmin.from("call_node_listen_for").delete().eq("node_id", nodeId);
      if (body.listenFor && body.listenFor.length > 0) {
        await supabaseAdmin.from("call_node_listen_for").insert(
          body.listenFor.map((listen_item, index) => ({ node_id: nodeId, listen_item, sort_order: index, product_id: productId }))
        );
      }
    }
    if (body.responses !== undefined) {
      await supabaseAdmin.from("call_node_responses").delete().eq("node_id", nodeId);
      if (body.responses && body.responses.length > 0) {
        await supabaseAdmin.from("call_node_responses").insert(
          body.responses.map((response, index) => ({
            node_id: nodeId,
            label: response.label,
            next_node_id: response.nextNode,
            note: response.note || null,
            sort_order: index,
            product_id: productId,
          }))
        );
      }
    }

    return NextResponse.json({ message: "Node updated successfully", id: nodeId });
  } catch (error) {
    console.error("Error updating sandbox node:", error);
    return NextResponse.json({ error: "Failed to update node" }, { status: 500 });
  }
}

/**
 * DELETE /api/scripts/sandbox/nodes/[id]
 * Delete a sandbox node (owner only).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const user = await getUser(authHeader);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: nodeId } = await params;

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("call_nodes")
      .select("id, scope, owner_user_id")
      .eq("id", nodeId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
    if (existing.scope !== "sandbox" && existing.scope !== "community") {
      return NextResponse.json({ error: "Can only delete sandbox/community nodes" }, { status: 403 });
    }
    if (existing.owner_user_id !== user.id) {
      return NextResponse.json({ error: "You can only delete your own nodes" }, { status: 403 });
    }

    // Delete satellite data first
    await supabaseAdmin.from("call_node_keypoints").delete().eq("node_id", nodeId);
    await supabaseAdmin.from("call_node_warnings").delete().eq("node_id", nodeId);
    await supabaseAdmin.from("call_node_listen_for").delete().eq("node_id", nodeId);
    await supabaseAdmin.from("call_node_responses").delete().eq("node_id", nodeId);

    // Delete the node
    const { error: deleteError } = await supabaseAdmin
      .from("call_nodes")
      .delete()
      .eq("id", nodeId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Node deleted successfully", id: nodeId });
  } catch (error) {
    console.error("Error deleting sandbox node:", error);
    return NextResponse.json({ error: "Failed to delete node" }, { status: 500 });
  }
}
