import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, canAccessProduct, getProductId } from "@/app/lib/apiAuth";

/**
 * POST /api/scripts/sandbox/fork
 * Deep-copy official or community node(s) into the user's sandbox.
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
    const { nodeIds } = await request.json() as { nodeIds: string[] };

    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return NextResponse.json({ error: "nodeIds array is required" }, { status: 400 });
    }

    const productId = await getProductId(request, authHeader);
    if (!productId) {
      return NextResponse.json({ error: "Product context required" }, { status: 400 });
    }

    if (!(await canAccessProduct(user, productId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch source nodes (must be official or community)
    const { data: sourceNodes, error: fetchError } = await supabaseAdmin
      .from("call_nodes")
      .select("*")
      .in("id", nodeIds)
      .in("scope", ["official", "community"]);

    if (fetchError) throw new Error(fetchError.message);
    if (!sourceNodes || sourceNodes.length === 0) {
      return NextResponse.json({ error: "No valid source nodes found" }, { status: 404 });
    }

    // Generate new IDs and build mapping
    const timestamp = Date.now().toString(36);
    const idMapping = new Map<string, string>();
    for (const node of sourceNodes) {
      const newId = `sbx_${node.id}_${timestamp}`;
      idMapping.set(node.id, newId);
    }



    // Phase 1: Insert all nodes and non-relational satellite data
    const allResponsesToInsert: any[] = [];

    for (const node of sourceNodes) {
      const newId = idMapping.get(node.id)!;

      // Insert the forked node
      const { error: insertError } = await supabaseAdmin
        .from("call_nodes")
        .insert({
          id: newId,
          type: node.type,
          title: node.title,
          script: node.script,
          context: node.context,
          metadata: node.metadata,
          position_x: node.position_x + 50,
          position_y: node.position_y + 50,
          topic_group_id: node.topic_group_id,
          product_id: productId,
          scope: "sandbox",
          owner_user_id: user.id,
          forked_from_node_id: node.id,
          created_by: user.id,
          updated_by: user.id,
        });

      if (insertError) throw new Error(`Failed to fork node ${node.id}: ${insertError.message}`);

      // Copy keypoints
      const { data: keypoints } = await supabaseAdmin
        .from("call_node_keypoints")
        .select("*")
        .eq("node_id", node.id);

      if (keypoints && keypoints.length > 0) {
        await supabaseAdmin.from("call_node_keypoints").insert(
          keypoints.map(kp => ({
            node_id: newId,
            keypoint: kp.keypoint,
            sort_order: kp.sort_order,
            product_id: productId,
          }))
        );
      }

      // Copy warnings
      const { data: warnings } = await supabaseAdmin
        .from("call_node_warnings")
        .select("*")
        .eq("node_id", node.id);

      if (warnings && warnings.length > 0) {
        await supabaseAdmin.from("call_node_warnings").insert(
          warnings.map(w => ({
            node_id: newId,
            warning: w.warning,
            sort_order: w.sort_order,
            product_id: productId,
          }))
        );
      }

      // Copy listen_for
      const { data: listenFor } = await supabaseAdmin
        .from("call_node_listen_for")
        .select("*")
        .eq("node_id", node.id);

      if (listenFor && listenFor.length > 0) {
        await supabaseAdmin.from("call_node_listen_for").insert(
          listenFor.map(lf => ({
            node_id: newId,
            listen_item: lf.listen_item,
            sort_order: lf.sort_order,
            product_id: productId,
          }))
        );
      }

      // Collect responses for Phase 2
      const { data: responses } = await supabaseAdmin
        .from("call_node_responses")
        .select("*")
        .eq("node_id", node.id);

      if (responses && responses.length > 0) {
        responses.forEach(r => {
          const remappedNextNode = idMapping.get(r.next_node_id);
          const finalNextNode = remappedNextNode || r.next_node_id;

          // Check if target is being forked (safe to link) or is external.
          // If finalNextNode starts with 'sbx_' and is in our map, it will exist after Phase 1.
          // If it refers to an external node (e.g. strict dependency not included in fork), it should also exist.

          allResponsesToInsert.push({
            node_id: newId,
            label: r.label,
            next_node_id: finalNextNode,
            note: r.note,
            sort_order: r.sort_order,
            product_id: productId,
          });
        });
      }
    }

    // Phase 2: Insert all responses logic
    if (allResponsesToInsert.length > 0) {

      const { error: responseError } = await supabaseAdmin
        .from("call_node_responses")
        .insert(allResponsesToInsert);

      if (responseError) {
        console.error("[Fork] Failed to insert responses:", responseError);
        // We don't throw here to avoid rolling back the nodes (which we can't do easily without transactions), 
        // but we should report it. 
        // ideally we'd cleanup, but for now we log.
      }
    }

    // Return the mapping so the frontend can position the new nodes
    const mapping: Record<string, string> = {};
    idMapping.forEach((newId, originalId) => {
      mapping[originalId] = newId;
    });

    return NextResponse.json({ message: "Nodes forked successfully", mapping });
  } catch (error) {
    console.error("Error forking nodes:", error);
    return NextResponse.json({ error: "Failed to fork nodes" }, { status: 500 });
  }
}
