import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, canAccessProduct, getProductId, getUserProfile } from "@/app/lib/apiAuth";
import { CallNode } from "@/data/callFlow";

interface KeypointRow { node_id: string; keypoint: string; sort_order: number; }
interface WarningRow { node_id: string; warning: string; sort_order: number; }
interface ListenForRow { node_id: string; listen_item: string; sort_order: number; }
interface ResponseRow { node_id: string; label: string; next_node_id: string; note: string | null; sort_order: number; }

/**
 * GET /api/scripts/community/nodes
 * Fetch all community nodes for a product (any authenticated product member).
 */
export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const user = await getUser(authHeader);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const productId = await getProductId(request, authHeader);
    if (!productId) {
      return NextResponse.json({ error: "Product context required" }, { status: 400 });
    }

    if (!(await canAccessProduct(user, productId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all community nodes for this product
    const { data: nodes, error: nodesError } = await supabaseAdmin
      .from("call_nodes")
      .select("*")
      .eq("scope", "community")
      .eq("product_id", productId)
      .order("published_at", { ascending: false });

    if (nodesError) throw new Error(nodesError.message);
    if (!nodes || nodes.length === 0) {
      return NextResponse.json([]);
    }

    const nodeIds = nodes.map(n => n.id);

    // Fetch related data in parallel
    const [
      { data: allKeypoints, error: kpErr },
      { data: allWarnings, error: wErr },
      { data: allListenFor, error: lfErr },
      { data: allResponses, error: rErr }
    ] = await Promise.all([
      supabaseAdmin.from("call_node_keypoints").select("node_id, keypoint, sort_order").in("node_id", nodeIds).order("sort_order"),
      supabaseAdmin.from("call_node_warnings").select("node_id, warning, sort_order").in("node_id", nodeIds).order("sort_order"),
      supabaseAdmin.from("call_node_listen_for").select("node_id, listen_item, sort_order").in("node_id", nodeIds).order("sort_order"),
      supabaseAdmin.from("call_node_responses").select("node_id, label, next_node_id, note, sort_order").in("node_id", nodeIds).order("sort_order"),
    ]);

    if (kpErr) throw new Error(kpErr.message);
    if (wErr) throw new Error(wErr.message);
    if (lfErr) throw new Error(lfErr.message);
    if (rErr) throw new Error(rErr.message);

    // Group related data
    const keypointsMap = new Map<string, KeypointRow[]>();
    allKeypoints?.forEach((row: any) => {
      if (!keypointsMap.has(row.node_id)) keypointsMap.set(row.node_id, []);
      keypointsMap.get(row.node_id)!.push(row);
    });
    const warningsMap = new Map<string, WarningRow[]>();
    allWarnings?.forEach((row: any) => {
      if (!warningsMap.has(row.node_id)) warningsMap.set(row.node_id, []);
      warningsMap.get(row.node_id)!.push(row);
    });
    const listenForMap = new Map<string, ListenForRow[]>();
    allListenFor?.forEach((row: any) => {
      if (!listenForMap.has(row.node_id)) listenForMap.set(row.node_id, []);
      listenForMap.get(row.node_id)!.push(row);
    });
    const responsesMap = new Map<string, ResponseRow[]>();
    allResponses?.forEach((row: any) => {
      if (!responsesMap.has(row.node_id)) responsesMap.set(row.node_id, []);
      responsesMap.get(row.node_id)!.push(row);
    });

    // Collect unique owner IDs and batch-fetch profiles
    const ownerIds = [...new Set(nodes.map(n => n.owner_user_id).filter(Boolean))];
    const profileMap = new Map<string, { name: string; avatarUrl: string | null }>();
    for (const ownerId of ownerIds) {
      const profile = await getUserProfile(ownerId);
      if (profile) profileMap.set(ownerId, profile);
    }

    // Build full node objects with creator info
    const fullNodes = nodes.map(node => {
      const nodeKeypoints = keypointsMap.get(node.id) || [];
      const nodeWarnings = warningsMap.get(node.id) || [];
      const nodeListenFor = listenForMap.get(node.id) || [];
      const nodeResponses = responsesMap.get(node.id) || [];
      const profile = node.owner_user_id ? profileMap.get(node.owner_user_id) : null;

      return {
        id: node.id,
        type: node.type as CallNode["type"],
        title: node.title,
        script: node.script,
        context: node.context || undefined,
        keyPoints: nodeKeypoints.length > 0 ? nodeKeypoints.map(k => k.keypoint) : undefined,
        warnings: nodeWarnings.length > 0 ? nodeWarnings.map(w => w.warning) : undefined,
        listenFor: nodeListenFor.length > 0 ? nodeListenFor.map(l => l.listen_item) : undefined,
        responses: nodeResponses.map(r => ({
          label: r.label,
          nextNode: r.next_node_id,
          note: r.note || undefined,
        })),
        metadata: node.metadata ? {
          competitorInfo: (node.metadata as any).competitorInfo,
          greenFlags: (node.metadata as any).greenFlags,
          redFlags: (node.metadata as any).redFlags,
          outcome: (node.metadata as any).outcome,
          meetingSubject: (node.metadata as any).meetingSubject,
          meetingBody: (node.metadata as any).meetingBody,
          ehr: (node.metadata as any).ehr,
          dms: (node.metadata as any).dms,
          competitors: (node.metadata as any).competitors,
        } : undefined,
        position_x: node.position_x,
        position_y: node.position_y,
        topic_group_id: node.topic_group_id,
        scope: node.scope,
        owner_user_id: node.owner_user_id,
        creator_name: profile?.name || "Unknown",
        creator_avatar_url: profile?.avatarUrl || null,
        forked_from_node_id: node.forked_from_node_id,
        published_at: node.published_at,
      };
    });

    return NextResponse.json(fullNodes);
  } catch (error) {
    console.error("Error fetching community nodes:", error);
    return NextResponse.json({ error: "Failed to fetch community nodes" }, { status: 500 });
  }
}
