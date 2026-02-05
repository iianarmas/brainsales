import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { CallNode } from "@/data/callFlow";

async function getUser(authHeader: string | null) {
  if (!authHeader || !supabaseAdmin) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

async function isAdmin(authHeader: string | null): Promise<boolean> {
  const user = await getUser(authHeader);
  if (!user) return false;

  const { data } = await supabaseAdmin!
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return !!data;
}

async function canAccessProduct(user: any, productId: string): Promise<boolean> {
  if (!user || !supabaseAdmin) return false;

  // Admins can access all products
  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (admin) return true;

  // Check if user is assigned to this specific product
  const { data: productUser } = await supabaseAdmin
    .from("product_users")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .single();

  if (productUser) return true;

  // Allow any authenticated user to access active products (viewer access)
  // This matches the /api/products behavior which returns all active products to all users
  const { data: activeProduct } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("is_active", true)
    .single();

  return !!activeProduct;
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
  next_node_id: string;
  note: string | null;
  sort_order: number;
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
  const user = await getUser(authHeader);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get product ID for filtering
    const productId = await getProductId(request, authHeader);
    const isUserAdmin = await isAdmin(authHeader);

    // Non-admins MUST have a product context
    if (!isUserAdmin && !productId) {
      return NextResponse.json({ error: "Product context required" }, { status: 400 });
    }

    // Check if user has access to this product (if specified)
    if (productId && !(await canAccessProduct(user, productId))) {

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }



    // Build product-filtered queries (only official nodes for the admin editor)
    let nodesQuery = supabaseAdmin.from("call_nodes").select("*").eq("scope", "official").order("created_at");

    if (productId) {
      nodesQuery = nodesQuery.eq("product_id", productId);
    }

    // Execute nodes query first to get IDs for related data
    const { data: nodes, error: nodesError } = await nodesQuery;
    if (nodesError) throw new Error(`Nodes error: ${nodesError.message}`);

    if (!nodes || nodes.length === 0) {

      return NextResponse.json([]);
    }

    const nodeIds = nodes.map(n => n.id);

    // Build related data queries based on node IDs found
    const keypointsQuery = supabaseAdmin.from("call_node_keypoints").select("node_id, keypoint, sort_order").in("node_id", nodeIds).order("sort_order");
    const warningsQuery = supabaseAdmin.from("call_node_warnings").select("node_id, warning, sort_order").in("node_id", nodeIds).order("sort_order");
    const listenForQuery = supabaseAdmin.from("call_node_listen_for").select("node_id, listen_item, sort_order").in("node_id", nodeIds).order("sort_order");
    const responsesQuery = supabaseAdmin.from("call_node_responses").select("node_id, label, next_node_id, note, sort_order").in("node_id", nodeIds).order("sort_order");

    // Execute related queries in parallel
    const [
      { data: allKeypoints, error: keypointsError },
      { data: allWarnings, error: warningsError },
      { data: allListenFor, error: listenForError },
      { data: allResponses, error: responsesError }
    ] = await Promise.all([
      keypointsQuery,
      warningsQuery,
      listenForQuery,
      responsesQuery
    ]);

    if (keypointsError) throw new Error(`Keypoints error: ${keypointsError.message}`);
    if (warningsError) throw new Error(`Warnings error: ${warningsError.message}`);
    if (listenForError) throw new Error(`ListenFor error: ${listenForError.message}`);
    if (responsesError) throw new Error(`Responses error: ${responsesError.message}`);



    // Group related data by node_id
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

    // Build full node objects
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
        // Include editor-specific fields
        position_x: node.position_x,
        position_y: node.position_y,
        topic_group_id: node.topic_group_id,
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

  if (!(await isAdmin(authHeader))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json() as Partial<CallNode> & { position_x?: number; position_y?: number; topic_group_id?: string; product_id?: string };
    const { id, type, title, script, context, keyPoints, warnings, listenFor, responses, metadata } = body;

    // Validate required fields
    if (!id || !type || !title || !script) {
      return NextResponse.json(
        { error: "Missing required fields: id, type, title, script" },
        { status: 400 }
      );
    }

    // Get product_id from body, header, or user's default product
    const productId = body.product_id || await getProductId(request, authHeader);
    if (!productId) {
      return NextResponse.json(
        { error: "product_id is required. Set it in the body, X-Product-Id header, or ensure user has a default product." },
        { status: 400 }
      );
    }

    // Check if node ID already exists
    const { data: existing } = await supabaseAdmin
      .from("call_nodes")
      .select("id")
      .eq("id", id)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Node ID already exists" }, { status: 400 });
    }

    // Get user ID from auth header
    const token = authHeader?.replace("Bearer ", "") || "";
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    // Insert node
    const { error: nodeError } = await supabaseAdmin
      .from("call_nodes")
      .insert({
        id,
        type,
        title,
        script,
        context: context || null,
        metadata: metadata || null,
        position_x: body.position_x || 0,
        position_y: body.position_y || 0,
        topic_group_id: body.topic_group_id || null,
        product_id: productId,
        created_by: user?.id || null,
        updated_by: user?.id || null,
      });

    if (nodeError) {
      return NextResponse.json({ error: nodeError.message }, { status: 500 });
    }

    // Insert keypoints
    if (keyPoints && keyPoints.length > 0) {
      const keypointRows = keyPoints.map((keypoint, index) => ({
        node_id: id,
        keypoint,
        sort_order: index,
        product_id: productId,
      }));
      await supabaseAdmin.from("call_node_keypoints").insert(keypointRows);
    }

    // Insert warnings
    if (warnings && warnings.length > 0) {
      const warningRows = warnings.map((warning, index) => ({
        node_id: id,
        warning,
        sort_order: index,
        product_id: productId,
      }));
      await supabaseAdmin.from("call_node_warnings").insert(warningRows);
    }

    // Insert listen_for
    if (listenFor && listenFor.length > 0) {
      const listenForRows = listenFor.map((listen_item, index) => ({
        node_id: id,
        listen_item,
        sort_order: index,
        product_id: productId,
      }));
      await supabaseAdmin.from("call_node_listen_for").insert(listenForRows);
    }

    // Insert responses
    if (responses && responses.length > 0) {
      const responseRows = responses.map((response, index) => ({
        node_id: id,
        label: response.label,
        next_node_id: response.nextNode,
        note: response.note || null,
        sort_order: index,
        product_id: productId,
      }));
      await supabaseAdmin.from("call_node_responses").insert(responseRows);
    }

    return NextResponse.json({ message: "Node created successfully", id });
  } catch (error) {
    console.error("Error creating node:", error);
    return NextResponse.json({ error: "Failed to create node" }, { status: 500 });
  }
}
