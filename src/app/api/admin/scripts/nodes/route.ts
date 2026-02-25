import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { CallNode } from "@/data/callFlow";
import { ensureUniqueNodeId } from "@/app/lib/apiAuth";

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

async function canAccessProduct(user: any, productId: string, orgId: string): Promise<boolean> {
  if (!user || !supabaseAdmin) return false;

  // Check if product belongs to this organization
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("organization_id, is_active")
    .eq("id", productId)
    .single();

  if (!product) return false;

  // Organization must match
  if (product.organization_id !== orgId) return false;

  // Admins of this org can access it
  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (admin) return true;

  // Non-admins check product_users
  const { data: productUser } = await supabaseAdmin
    .from("product_users")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .single();

  if (productUser) return true;

  // Allow viewer access if product is active
  return product.is_active === true;
}

interface NodeRow {
  id: string;
  type: string;
  title: string;
  script: string;
  context: string | null;
  metadata: Record<string, unknown> | null;
  position_x: number;
  position_y: number;
  topic_group_id: string | null;
  call_flow_ids: string[] | null;
  product_id: string;
}

// Helper to get product ID from request header or user's default product
async function getProductId(request: NextRequest, authHeader: string | null): Promise<string | null> {
  const productIdHeader = request.headers.get("X-Product-Id");
  if (productIdHeader) return productIdHeader;

  if (!authHeader || !supabaseAdmin) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  const { data: productUser } = await supabaseAdmin
    .from("product_users")
    .select("product_id")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .limit(1)
    .single();

  return productUser?.product_id || null;
}

interface KeypointRow {
  keypoint: string;
  sort_order: number;
}

interface WarningRow {
  warning: string;
  sort_order: number;
}

interface ListenForRow {
  listen_item: string;
  sort_order: number;
}

interface ResponseRow {
  label: string;
  next_node_id: string | null;
  note: string | null;
  sort_order: number;
  is_special_instruction: boolean | null;
}

/**
 * GET /api/admin/scripts/nodes
 * Fetch all nodes with related data (admin only)
 */
export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const orgId = await isOrgAdmin(authHeader);

  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized or organization mismatch" }, { status: 403 });
  }

  try {
    const token = authHeader!.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    // Get product ID for filtering
    const productId = await getProductId(request, authHeader);

    // If productId is provided, verify access
    if (productId && !(await canAccessProduct(user, productId, orgId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build product-filtered queries (only official nodes for the admin editor)
    let nodesQuery = supabaseAdmin
      .from("call_nodes")
      .select("*")
      .eq("scope", "official")
      .eq("organization_id", orgId)
      .order("created_at");

    if (productId) {
      nodesQuery = nodesQuery.eq("product_id", productId);
    }

    const { data: nodes, error: nodesError } = await nodesQuery;
    if (nodesError) throw new Error(`Nodes error: ${nodesError.message}`);

    if (!nodes || nodes.length === 0) {
      return NextResponse.json([]);
    }

    const nodeIds = nodes.map(n => n.id);

    const [
      { data: allKeypoints, error: keypointsError },
      { data: allWarnings, error: warningsError },
      { data: allListenFor, error: listenForError },
      { data: allResponses, error: responsesError }
    ] = await Promise.all([
      supabaseAdmin.from("call_node_keypoints").select("node_id, keypoint, sort_order").in("node_id", nodeIds).order("sort_order"),
      supabaseAdmin.from("call_node_warnings").select("node_id, warning, sort_order").in("node_id", nodeIds).order("sort_order"),
      supabaseAdmin.from("call_node_listen_for").select("node_id, listen_item, sort_order").in("node_id", nodeIds).order("sort_order"),
      supabaseAdmin.from("call_node_responses").select("node_id, label, next_node_id, note, sort_order, is_special_instruction").in("node_id", nodeIds).order("sort_order")
    ]);

    if (keypointsError) throw new Error(`Keypoints error: ${keypointsError.message}`);
    if (warningsError) throw new Error(`Warnings error: ${warningsError.message}`);
    if (listenForError) throw new Error(`ListenFor error: ${listenForError.message}`);
    if (responsesError) throw new Error(`Responses error: ${responsesError.message}`);

    const keypointsMap = new Map<string, KeypointRow[]>();
    allKeypoints?.forEach((row: any) => {
      if (!keypointsMap.has(row.node_id)) keypointsMap.set(row.node_id, []);
      keypointsMap.get(row.node_id)!.push(row as KeypointRow);
    });

    const warningsMap = new Map<string, WarningRow[]>();
    allWarnings?.forEach((row: any) => {
      if (!warningsMap.has(row.node_id)) warningsMap.set(row.node_id, []);
      warningsMap.get(row.node_id)!.push(row as WarningRow);
    });

    const listenForMap = new Map<string, ListenForRow[]>();
    allListenFor?.forEach((row: any) => {
      if (!listenForMap.has(row.node_id)) listenForMap.set(row.node_id, []);
      listenForMap.get(row.node_id)!.push(row as ListenForRow);
    });

    const responsesMap = new Map<string, ResponseRow[]>();
    allResponses?.forEach((row: any) => {
      if (!responsesMap.has(row.node_id)) responsesMap.set(row.node_id, []);
      responsesMap.get(row.node_id)!.push(row as ResponseRow);
    });

    const fullNodes = (nodes as NodeRow[]).map(node => {
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
        })),
        metadata: node.metadata ? {
          ...(node.metadata as Record<string, unknown>),
        } : undefined,
        position_x: node.position_x,
        position_y: node.position_y,
        topic_group_id: node.topic_group_id,
        call_flow_ids: node.call_flow_ids || null,
      };
    });

    return NextResponse.json(fullNodes);
  } catch (error) {
    console.error("❌ Error fetching nodes:", error);
    return NextResponse.json({ error: "Failed to fetch nodes" }, { status: 500 });
  }
}

/**
 * POST /api/admin/scripts/nodes
 * Create a new node (admin only)
 */
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const orgId = await isOrgAdmin(authHeader);

  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized or organization mismatch" }, { status: 403 });
  }

  try {
    const body = await request.json() as Partial<CallNode> & { position_x?: number; position_y?: number; topic_group_id?: string; product_id?: string };
    const { id, type, title, script, context, keyPoints, warnings, listenFor, responses, metadata } = body;

    if (!id || !type || !title || !script) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Resolve cross-org ID collisions by auto-prefixing if needed
    const resolvedId = await ensureUniqueNodeId(id, orgId);

    const productId = body.product_id || await getProductId(request, authHeader);
    if (!productId) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    const token = authHeader?.replace("Bearer ", "") || "";
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

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
        call_flow_ids: (body as any).call_flow_ids || null,
        product_id: productId,
        organization_id: orgId,
        created_by: user?.id || null,
        updated_by: user?.id || null,
      });

    if (nodeError) throw nodeError;

    if (keyPoints && keyPoints.length > 0) {
      await supabaseAdmin.from("call_node_keypoints").insert(keyPoints.map((k, i) => ({
        node_id: resolvedId,
        keypoint: k,
        sort_order: i,
        product_id: productId,
        organization_id: orgId,
      })));
    }

    if (warnings && warnings.length > 0) {
      await supabaseAdmin.from("call_node_warnings").insert(warnings.map((w, i) => ({
        node_id: resolvedId,
        warning: w,
        sort_order: i,
        product_id: productId,
        organization_id: orgId,
      })));
    }

    if (listenFor && listenFor.length > 0) {
      await supabaseAdmin.from("call_node_listen_for").insert(listenFor.map((l, i) => ({
        node_id: resolvedId,
        listen_item: l,
        sort_order: i,
        product_id: productId,
        organization_id: orgId,
      })));
    }

    if (responses && responses.length > 0) {
      const validResponses = responses.filter(r => (r.nextNode && r.nextNode.trim() !== "") || r.isSpecialInstruction);
      if (validResponses.length > 0) {
        await supabaseAdmin.from("call_node_responses").insert(validResponses.map((r, i) => ({
          node_id: resolvedId,
          label: r.label,
          next_node_id: r.isSpecialInstruction ? null : r.nextNode,
          note: r.note || null,
          is_special_instruction: !!r.isSpecialInstruction,
          sort_order: i,
          product_id: productId,
          organization_id: orgId,
        })));
      }
    }

    return NextResponse.json({ message: "Node created successfully", id: resolvedId });
  } catch (error) {
    console.error("Error creating node:", error);
    return NextResponse.json({ error: "Failed to create node" }, { status: 500 });
  }
}
