import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { CallNode } from "@/data/callFlow";

// Disable cache to ensure fresh data from database
export const revalidate = 0;

// Helper to get product ID from request
async function getProductId(request: NextRequest): Promise<string | null> {
  // First check for explicit product ID header
  const productIdHeader = request.headers.get("X-Product-Id");
  if (productIdHeader) {
    return productIdHeader;
  }

  // Fall back to user's default product
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  if (!user) {
    return null;
  }

  // Get user's default product
  const { data: productUser } = await supabaseAdmin
    .from("product_users")
    .select("product_id")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("joined_at", { ascending: true })
    .limit(1)
    .single();

  return productUser?.product_id || null;
}

interface KeypointRow {
  node_id: string;
  keypoint: string;
  sort_order: number;
}

interface WarningRow {
  node_id: string;
  warning: string;
  sort_order: number;
}

interface ListenForRow {
  node_id: string;
  listen_item: string;
  sort_order: number;
}

interface ResponseRow {
  node_id: string;
  label: string;
  next_node_id: string;
  note: string | null;
  sort_order: number;
}

/**
 * API Route to fetch the call flow structure from Supabase.
 * Uses POST to definitively bypass all levels of caching.
 * Supports product filtering via X-Product-Id header.
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] POST /api/scripts/callflow - Fetching scripts...`);

  try {
    if (!supabaseAdmin) {
      console.warn(`[${requestId}] ❌ Supabase admin client NOT initialized`);
      return NextResponse.json({ error: "Supabase client not initialized" }, { status: 500 });
    }

    // Get product ID for filtering
    const productId = await getProductId(request);

    // Build the base nodes query
    let nodesQuery = supabaseAdmin
      .from("call_nodes")
      .select("*")
      .eq("is_active", true);

    // Filter by product (product_id is NOT NULL per migration 008)
    if (productId) {
      nodesQuery = nodesQuery.eq("product_id", productId);
      console.log(`[${requestId}] Filtering by product: ${productId}`);
    }

    // Fetch all active nodes
    const { data: nodes, error: nodesError } = await nodesQuery;

    if (nodesError) {
      console.error(`[${requestId}] ❌ Error fetching nodes from database:`, nodesError);
      return NextResponse.json({ error: nodesError.message, details: nodesError }, { status: 500 });
    }

    if (!nodes || nodes.length === 0) {
      console.warn(`[${requestId}] ⚠️ No active nodes found in database`);
      return NextResponse.json({ error: "No active nodes found" }, { status: 404 });
    }

    console.log(`[${requestId}] ✓ Successfully fetched ${nodes.length} nodes from database`);

    // Get all node IDs
    const nodeIds = nodes.map((n) => n.id);

    // Fetch related data separately for reliability
    const [keypointsRes, warningsRes, listenForRes, responsesRes] = await Promise.all([
      supabaseAdmin
        .from("call_node_keypoints")
        .select("node_id, keypoint, sort_order")
        .in("node_id", nodeIds),
      supabaseAdmin
        .from("call_node_warnings")
        .select("node_id, warning, sort_order")
        .in("node_id", nodeIds),
      supabaseAdmin
        .from("call_node_listen_for")
        .select("node_id, listen_item, sort_order")
        .in("node_id", nodeIds),
      supabaseAdmin
        .from("call_node_responses")
        .select("node_id, label, next_node_id, note, sort_order")
        .in("node_id", nodeIds),
    ]);

    // Build lookup maps
    const keypointsMap = new Map<string, KeypointRow[]>();
    (keypointsRes.data || []).forEach((row) => {
      if (!keypointsMap.has(row.node_id)) keypointsMap.set(row.node_id, []);
      keypointsMap.get(row.node_id)!.push(row);
    });

    const warningsMap = new Map<string, WarningRow[]>();
    (warningsRes.data || []).forEach((row) => {
      if (!warningsMap.has(row.node_id)) warningsMap.set(row.node_id, []);
      warningsMap.get(row.node_id)!.push(row);
    });

    const listenForMap = new Map<string, ListenForRow[]>();
    (listenForRes.data || []).forEach((row) => {
      if (!listenForMap.has(row.node_id)) listenForMap.set(row.node_id, []);
      listenForMap.get(row.node_id)!.push(row);
    });

    const responsesMap = new Map<string, ResponseRow[]>();
    (responsesRes.data || []).forEach((row) => {
      if (!responsesMap.has(row.node_id)) responsesMap.set(row.node_id, []);
      responsesMap.get(row.node_id)!.push(row);
    });

    // Build callFlow structure in memory
    const callFlowData: Record<string, CallNode> = {};

    for (const node of nodes) {
      const keypoints = keypointsMap.get(node.id) || [];
      const warnings = warningsMap.get(node.id) || [];
      const listenFor = listenForMap.get(node.id) || [];
      const responses = responsesMap.get(node.id) || [];

      callFlowData[node.id] = {
        id: node.id,
        type: node.type as CallNode["type"],
        title: node.title,
        script: node.script,
        context: node.context || undefined,
        keyPoints: keypoints.length > 0
          ? keypoints.sort((a, b) => a.sort_order - b.sort_order).map((k) => k.keypoint)
          : undefined,
        warnings: warnings.length > 0
          ? warnings.sort((a, b) => a.sort_order - b.sort_order).map((w) => w.warning)
          : undefined,
        listenFor: listenFor.length > 0
          ? listenFor.sort((a, b) => a.sort_order - b.sort_order).map((l) => l.listen_item)
          : undefined,
        responses: responses
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((r) => ({
            label: r.label,
            nextNode: r.next_node_id,
            note: r.note || undefined,
          })),
        topic_group_id: node.topic_group_id,
        metadata: node.metadata ? {
          competitorInfo: (node.metadata as Record<string, unknown>).competitorInfo,
          greenFlags: (node.metadata as Record<string, unknown>).greenFlags,
          redFlags: (node.metadata as Record<string, unknown>).redFlags,
        } : undefined,
      };
    }

    return new NextResponse(JSON.stringify(callFlowData), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "Pragma": "no-cache",
        "X-Sync": "true"
      }
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ Fatal error in /api/scripts/callflow:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Support GET by redirecting to static fallback if needed, or just return error
// But our hook now uses POST
export async function GET(request: NextRequest) {
  return POST(request);
}
