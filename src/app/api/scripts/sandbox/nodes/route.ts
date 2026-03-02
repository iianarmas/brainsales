import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, canAccessProduct, getProductId, getUserProfile, getOrganizationId, ensureUniqueNodeId } from "@/app/lib/apiAuth";
import { CallNode } from "@/data/callFlow";

interface KeypointRow { node_id: string; keypoint: string; sort_order: number; }
interface WarningRow { node_id: string; warning: string; sort_order: number; }
interface ListenForRow { node_id: string; listen_item: string; sort_order: number; }
interface ResponseRow { node_id: string; label: string; next_node_id: string | null; note: string | null; sort_order: number; is_special_instruction: boolean | null; ai_condition: string | null; ai_confidence: string | null; coaching_scope: string | null; }

/**
 * GET /api/scripts/sandbox/nodes
 * Fetch the current user's sandbox nodes for a product.
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

    // Fetch sandbox nodes owned by this user
    const { data: nodes, error: nodesError } = await supabaseAdmin
      .from("call_nodes")
      .select("*")
      .eq("scope", "sandbox")
      .eq("owner_user_id", user.id)
      .eq("product_id", productId)
      .order("created_at");

    if (nodesError) throw new Error(`Nodes error: ${nodesError.message}`);
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
      supabaseAdmin.from("call_node_responses").select("node_id, label, next_node_id, note, sort_order, is_special_instruction, ai_condition, ai_confidence, coaching_scope").in("node_id", nodeIds).order("sort_order"),
    ]);

    if (kpErr) throw new Error(kpErr.message);
    if (wErr) throw new Error(wErr.message);
    if (lfErr) throw new Error(lfErr.message);
    if (rErr) throw new Error(rErr.message);

    // Group related data by node_id
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

    // Get user profile for creator name
    const profile = await getUserProfile(user.id);

    // Build full node objects
    const fullNodes = nodes.map(node => {
      const nodeKeypoints = keypointsMap.get(node.id) || [];
      const nodeWarnings = warningsMap.get(node.id) || [];
      const nodeListenFor = listenForMap.get(node.id) || [];
      const nodeResponses = responsesMap.get(node.id) || [];




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
          nextNode: r.next_node_id || "",
          note: r.note || undefined,
          isSpecialInstruction: !!r.is_special_instruction,
          coachingScope: (r.coaching_scope as "rep" | "ai" | "both") || undefined,
          aiCondition: r.ai_condition || undefined,
          aiConfidence: (r.ai_confidence as "high" | "medium") || undefined,
        })),
        metadata: node.metadata ? {
          ...(node.metadata as Record<string, unknown>),
        } : undefined,
        position_x: node.position_x,
        position_y: node.position_y,
        topic_group_id: node.topic_group_id,
        scope: node.scope,
        owner_user_id: node.owner_user_id,
        creator_name: profile?.name,
        creator_avatar_url: profile?.avatarUrl,
        forked_from_node_id: node.forked_from_node_id,
      };
    });

    return NextResponse.json(fullNodes);
  } catch (error) {
    console.error("Error fetching sandbox nodes:", error);
    return NextResponse.json({ error: "Failed to fetch sandbox nodes" }, { status: 500 });
  }
}

/**
 * POST /api/scripts/sandbox/nodes
 * Create a new sandbox node (any authenticated product member).
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
    const body = await request.json() as Partial<CallNode> & {
      position_x?: number;
      position_y?: number;
      topic_group_id?: string;
      product_id?: string;
    };
    const { id, type, title, script, context, keyPoints, warnings, listenFor, responses, metadata } = body;

    if (!id || !type || !title || !script) {
      return NextResponse.json({ error: "Missing required fields: id, type, title, script" }, { status: 400 });
    }

    const productId = body.product_id || await getProductId(request, authHeader);
    if (!productId) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    if (!(await canAccessProduct(user, productId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get user's organization for strict isolation
    const organizationId = await getOrganizationId(user.id);
    if (!organizationId) {
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    // Resolve cross-org ID collisions by auto-prefixing if needed
    const resolvedId = await ensureUniqueNodeId(id, organizationId);

    // Insert sandbox node
    const { error: nodeError } = await supabaseAdmin
      .from("call_nodes")
      .insert({
        id: resolvedId,
        type,
        title,
        script,
        context: context || null,
        metadata: metadata || null,
        position_x: body.position_x || 0,
        position_y: body.position_y || 0,
        topic_group_id: body.topic_group_id || null,
        product_id: productId,
        organization_id: organizationId,
        scope: "sandbox",
        owner_user_id: user.id,
        created_by: user.id,
        updated_by: user.id,
      });

    if (nodeError) {
      return NextResponse.json({ error: nodeError.message }, { status: 500 });
    }

    // Insert satellite data
    if (keyPoints && keyPoints.length > 0) {
      await supabaseAdmin.from("call_node_keypoints").insert(
        keyPoints.map((keypoint, index) => ({ node_id: resolvedId, keypoint, sort_order: index, product_id: productId, organization_id: organizationId }))
      );
    }
    if (warnings && warnings.length > 0) {
      await supabaseAdmin.from("call_node_warnings").insert(
        warnings.map((warning, index) => ({ node_id: resolvedId, warning, sort_order: index, product_id: productId, organization_id: organizationId }))
      );
    }
    if (listenFor && listenFor.length > 0) {
      await supabaseAdmin.from("call_node_listen_for").insert(
        listenFor.map((listen_item, index) => ({ node_id: resolvedId, listen_item, sort_order: index, product_id: productId, organization_id: organizationId }))
      );
    }
    if (responses && responses.length > 0) {
      const validResponses = responses.filter(r =>
        (r.nextNode && r.nextNode.trim() !== "") || r.isSpecialInstruction
      );
      if (validResponses.length > 0) {
        await supabaseAdmin.from("call_node_responses").insert(
          validResponses.map((response, index) => ({
            node_id: resolvedId,
            label: response.label,
            next_node_id: response.isSpecialInstruction ? null : response.nextNode,
            note: response.note || null,
            is_special_instruction: response.isSpecialInstruction ?? false,
            coaching_scope: response.isSpecialInstruction ? (response.coachingScope || null) : null,
            ai_condition: !response.isSpecialInstruction ? (response.aiCondition || null) : null,
            ai_confidence: !response.isSpecialInstruction ? (response.aiConfidence || null) : null,
            sort_order: index,
            product_id: productId,
            organization_id: organizationId,
          }))
        );
      }
    }

    return NextResponse.json({ message: "Sandbox node created successfully", id: resolvedId });
  } catch (error) {
    console.error("Error creating sandbox node:", error);
    return NextResponse.json({ error: "Failed to create sandbox node" }, { status: 500 });
  }
}
