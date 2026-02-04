import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, isUserAdmin } from "@/app/lib/apiAuth";

/**
 * POST /api/scripts/community/promote
 * Promote a community node to the official flow (admin only).
 *
 * Strategy: Clone + auto-unpublish
 * 1. Deep-copy the community node as a new official node (new ID)
 * 2. Move the original community node back to the author's sandbox
 * 3. Return both IDs for frontend awareness
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

  // Only admins can promote
  if (!(await isUserAdmin(user.id))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json() as { nodeId?: string; nodeIds?: string[] };

    // Support both single and bulk
    const idsToPromote: string[] = body.nodeIds || (body.nodeId ? [body.nodeId] : []);

    if (idsToPromote.length === 0) {
      return NextResponse.json({ error: "nodeId or nodeIds is required" }, { status: 400 });
    }

    // Fetch the full community nodes
    const { data: nodes } = await supabaseAdmin
      .from("call_nodes")
      .select("*")
      .in("id", idsToPromote);

    if (!nodes || nodes.length === 0) {
      return NextResponse.json({ error: "Nodes not found" }, { status: 404 });
    }

    const validNodes = nodes.filter(n => n.scope === "community");
    if (validNodes.length === 0) {
      return NextResponse.json({ error: "No valid community nodes found to promote" }, { status: 400 });
    }

    // 1. Generate ID Mappings (Old -> New)
    const idMap = new Map<string, string>();
    const timestamp = Date.now().toString(36);

    for (const node of validNodes) {
      const baseId = node.id.replace(/^sbx_/, "").replace(/_[a-z0-9]+$/, "");
      const officialId = `official_${baseId}_${timestamp}_${Math.random().toString(36).substring(2, 6)}`;
      idMap.set(node.id, officialId);
    }

    const promotedIds: string[] = [];
    const allResponsesToInsert: any[] = [];

    // 2. Insert Official Nodes
    for (const node of validNodes) {
      const newId = idMap.get(node.id)!;
      promotedIds.push(newId);

      const { error: insertError } = await supabaseAdmin
        .from("call_nodes")
        .insert({
          id: newId,
          type: node.type,
          title: node.title,
          script: node.script,
          context: node.context,
          metadata: node.metadata,
          position_x: node.position_x,
          position_y: node.position_y,
          topic_group_id: node.topic_group_id,
          product_id: node.product_id,
          scope: "official",
          owner_user_id: null, // Official nodes have no owner
          forked_from_node_id: node.id, // Audit trail
          created_by: user.id,
          updated_by: user.id,
        });

      if (insertError) {
        console.error(`Failed to promote node ${node.id}: ${insertError.message}`);
        continue; // Skip rest of logic for this node if insert fails
      }

      // 3. Copy Satellite Data with ID Remapping
      // Fetch details

      // IMPORTANT: Collect responses for Phase 2 to ensure all nodes exist
      const { data: responses } = await supabaseAdmin.from("call_node_responses").select("*").eq("node_id", node.id);

      if (responses && responses.length > 0) {
        responses.forEach(r => {
          const remappedNextNode = idMap.get(r.next_node_id);
          const finalNextNode = remappedNextNode || r.next_node_id;

          allResponsesToInsert.push({
            node_id: newId,
            label: r.label,
            next_node_id: finalNextNode,
            note: r.note,
            sort_order: r.sort_order,
            product_id: node.product_id
          });
        });
      }

      // 4. Move Original Back to Sandbox (can differ till end, but safe to do here)
      await supabaseAdmin
        .from("call_nodes")
        .update({
          scope: "sandbox",
          published_at: null,
        })
        .eq("id", node.id);
    }

    // Phase 2: Insert all responses
    if (allResponsesToInsert.length > 0) {

      const { error: responseError } = await supabaseAdmin
        .from("call_node_responses")
        .insert(allResponsesToInsert);

      if (responseError) {
        console.error("[Promote] Failed to insert responses:", responseError);
      }
    }


    return NextResponse.json({
      message: `${promotedIds.length} node(s) promoted to official flow. Originals moved back to sandbox.`,
      officialIds: promotedIds,
      idMap: Object.fromEntries(idMap),
    });
  } catch (error) {
    console.error("Error promoting node:", error);
    return NextResponse.json({ error: "Failed to promote node" }, { status: 500 });
  }
}
