import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { CallNode } from "@/data/callFlow";

async function isAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !supabaseAdmin) {
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  if (!user) {
    return false;
  }

  const { data } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return !!data;
}

/**
 * PATCH /api/admin/scripts/nodes/[id]
 * Update an existing node (admin only)
 */
export async function PATCH(
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

  try {
    const { id: nodeId } = await params;
    const body = await request.json() as Partial<CallNode> & {
      position_x?: number;
      position_y?: number;
      topic_group_id?: string;
      product_id?: string;
    };

    // Check if node exists and get its product_id
    const { data: existing } = await supabaseAdmin
      .from("call_nodes")
      .select("id, product_id")
      .eq("id", nodeId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const productId = existing.product_id;

    // Get user ID from auth header
    const token = authHeader?.replace("Bearer ", "") || "";
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

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
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", nodeId);

    if (nodeError) {
      return NextResponse.json({ error: nodeError.message }, { status: 500 });
    }

    // Update keypoints - delete all and re-insert
    if (body.keyPoints !== undefined) {
      await supabaseAdmin
        .from("call_node_keypoints")
        .delete()
        .eq("node_id", nodeId);

      if (body.keyPoints && body.keyPoints.length > 0) {
        const keypointRows = body.keyPoints.map((keypoint, index) => ({
          node_id: nodeId,
          keypoint,
          sort_order: index,
          product_id: productId,
        }));
        await supabaseAdmin.from("call_node_keypoints").insert(keypointRows);
      }
    }

    // Update warnings - delete all and re-insert
    if (body.warnings !== undefined) {
      await supabaseAdmin
        .from("call_node_warnings")
        .delete()
        .eq("node_id", nodeId);

      if (body.warnings && body.warnings.length > 0) {
        const warningRows = body.warnings.map((warning, index) => ({
          node_id: nodeId,
          warning,
          sort_order: index,
          product_id: productId,
        }));
        await supabaseAdmin.from("call_node_warnings").insert(warningRows);
      }
    }

    // Update listen_for - delete all and re-insert
    if (body.listenFor !== undefined) {
      await supabaseAdmin
        .from("call_node_listen_for")
        .delete()
        .eq("node_id", nodeId);

      if (body.listenFor && body.listenFor.length > 0) {
        const listenForRows = body.listenFor.map((listen_item, index) => ({
          node_id: nodeId,
          listen_item,
          sort_order: index,
          product_id: productId,
        }));
        await supabaseAdmin.from("call_node_listen_for").insert(listenForRows);
      }
    }

    // Update responses - delete all and re-insert
    if (body.responses !== undefined) {
      await supabaseAdmin
        .from("call_node_responses")
        .delete()
        .eq("node_id", nodeId);

      if (body.responses && body.responses.length > 0) {
        const responseRows = body.responses.map((response, index) => ({
          node_id: nodeId,
          label: response.label,
          next_node_id: response.nextNode,
          note: response.note || null,
          sort_order: index,
          product_id: productId,
        }));
        await supabaseAdmin.from("call_node_responses").insert(responseRows);
      }
    }

    return NextResponse.json({ message: "Node updated successfully", id: nodeId });
  } catch (error) {
    console.error("Error updating node:", error);
    return NextResponse.json({ error: "Failed to update node" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/scripts/nodes/[id]
 * Delete a node (admin only)
 */
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

  try {
    const { id: nodeId } = await params;

    // Check if node exists
    const { data: existing } = await supabaseAdmin
      .from("call_nodes")
      .select("id")
      .eq("id", nodeId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    // Delete related data first (due to foreign key constraints)
    await supabaseAdmin.from("call_node_keypoints").delete().eq("node_id", nodeId);
    await supabaseAdmin.from("call_node_warnings").delete().eq("node_id", nodeId);
    await supabaseAdmin.from("call_node_listen_for").delete().eq("node_id", nodeId);
    await supabaseAdmin.from("call_node_responses").delete().eq("node_id", nodeId);

    // Delete the node itself
    const { error: deleteError } = await supabaseAdmin
      .from("call_nodes")
      .delete()
      .eq("id", nodeId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Node deleted successfully", id: nodeId });
  } catch (error) {
    console.error("Error deleting node:", error);
    return NextResponse.json({ error: "Failed to delete node" }, { status: 500 });
  }
}
