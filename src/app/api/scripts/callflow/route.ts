import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { CallNode } from "@/data/callFlow";

// Disable cache to ensure fresh data from database
export const revalidate = 0;

// Helper to get product ID and authenticated user from request
async function getRequestContext(request: NextRequest): Promise<{ productId: string | null; userId: string | null }> {
  const productIdHeader = request.headers.get("X-Product-Id");
  const authHeader = request.headers.get("authorization");

  let userId: string | null = null;
  let productId: string | null = productIdHeader;

  if (authHeader && supabaseAdmin) {
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);

    if (user) {
      userId = user.id;

      // Get user's organization
      const { data: memberData } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (memberData) {
        // Find product within the same organization
        const { data: productUser } = await supabaseAdmin
          .from("product_users")
          .select("product_id")
          .eq("user_id", user.id)
          .eq("product_id", productIdHeader || "00000000-0000-0000-0000-000000000000") // Check header first
          .limit(1)
          .single();

        if (productUser) {
          productId = productUser.product_id;
        } else if (!productIdHeader) {
          // If no header, use default product
          const { data: defaultProduct } = await supabaseAdmin
            .from("product_users")
            .select("product_id")
            .eq("user_id", user.id)
            .order("is_default", { ascending: false })
            .order("joined_at", { ascending: true })
            .limit(1)
            .single();

          productId = defaultProduct?.product_id || null;
        }
      }
    }
  }

  return { productId, userId };
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
  next_node_id: string | null;
  note: string | null;
  sort_order: number;
  is_special_instruction: boolean | null;
  ai_condition: string | null;
  ai_confidence: string | null;
  coaching_scope: string | null;
}

function buildCallNode(node: any, keypointsMap: Map<string, KeypointRow[]>, warningsMap: Map<string, WarningRow[]>, listenForMap: Map<string, ListenForRow[]>, responsesMap: Map<string, ResponseRow[]>): CallNode {
  const keypoints = keypointsMap.get(node.id) || [];
  const warnings = warningsMap.get(node.id) || [];
  const listenFor = listenForMap.get(node.id) || [];
  const responses = responsesMap.get(node.id) || [];

  return {
    id: node.id,
    type: node.type as CallNode["type"],
    title: node.title,
    script: node.script,
    context: node.context || undefined,
    scope: node.scope || "official",
    forked_from_node_id: node.forked_from_node_id || undefined,
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
        nextNode: r.next_node_id || "",
        note: r.note || undefined,
        isSpecialInstruction: !!r.is_special_instruction,
        coachingScope: (r.coaching_scope as "rep" | "ai" | "both") || undefined,
        aiCondition: r.ai_condition || undefined,
        aiConfidence: (r.ai_confidence as "high" | "medium") || undefined,
      })),
    topic_group_id: node.topic_group_id,
    call_flow_ids: node.call_flow_ids || null,
    metadata: node.metadata ? {
      ...(node.metadata as Record<string, unknown>),
    } : undefined,
  };
}

async function fetchSatelliteData(nodeIds: string[]) {
  const [keypointsRes, warningsRes, listenForRes, responsesRes] = await Promise.all([
    supabaseAdmin!
      .from("call_node_keypoints")
      .select("node_id, keypoint, sort_order")
      .in("node_id", nodeIds),
    supabaseAdmin!
      .from("call_node_warnings")
      .select("node_id, warning, sort_order")
      .in("node_id", nodeIds),
    supabaseAdmin!
      .from("call_node_listen_for")
      .select("node_id, listen_item, sort_order")
      .in("node_id", nodeIds),
    supabaseAdmin!
      .from("call_node_responses")
      .select("node_id, label, next_node_id, note, sort_order, is_special_instruction, ai_condition, ai_confidence, coaching_scope")
      .in("node_id", nodeIds),
  ]);

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

  return { keypointsMap, warningsMap, listenForMap, responsesMap };
}

/**
 * API Route to fetch the call flow structure from Supabase.
 * Uses POST to definitively bypass all levels of caching.
 * Supports product filtering via X-Product-Id header.
 *
 * When an authenticated user requests the call flow, their sandbox nodes
 * are included alongside official nodes as personal "side paths".
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);


  try {
    if (!supabaseAdmin) {
      console.warn(`[${requestId}] Supabase admin client NOT initialized`);
      return NextResponse.json({ error: "Supabase client not initialized" }, { status: 500 });
    }

    const { productId, userId } = await getRequestContext(request);

    // Get user's organization for strict filtering
    const { data: memberData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId || "00000000-0000-0000-0000-000000000000")
      .limit(1)
      .single();

    if (!memberData) {
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    // Build the official nodes query
    let officialQuery = supabaseAdmin
      .from("call_nodes")
      .select("*")
      .eq("is_active", true)
      .eq("scope", "official")
      .eq("organization_id", memberData.organization_id);

    if (productId) {
      officialQuery = officialQuery.eq("product_id", productId);

    }

    const { data: officialNodes, error: nodesError } = await officialQuery;

    if (nodesError) {
      console.error(`[${requestId}] Error fetching nodes from database:`, nodesError);
      return NextResponse.json({ error: nodesError.message, details: nodesError }, { status: 500 });
    }

    if (!officialNodes || officialNodes.length === 0) {
      console.warn(`[${requestId}] No active nodes found in database for organization`);
      return NextResponse.json({}, { status: 200 }); // Return empty object instead of 404
    }



    // Also fetch the user's sandbox nodes if authenticated
    let sandboxNodes: any[] = [];
    if (userId && productId) {
      const { data: sbxNodes, error: sbxError } = await supabaseAdmin
        .from("call_nodes")
        .select("*")
        .eq("is_active", true)
        .eq("scope", "sandbox")
        .eq("owner_user_id", userId)
        .eq("product_id", productId)
        .eq("organization_id", memberData.organization_id);

      if (!sbxError && sbxNodes) {
        sandboxNodes = sbxNodes;

      }
    }

    // Combine all nodes for satellite data fetching
    const allNodes = [...officialNodes, ...sandboxNodes];
    const allNodeIds = allNodes.map((n) => n.id);

    const { keypointsMap, warningsMap, listenForMap, responsesMap } = await fetchSatelliteData(allNodeIds);

    // Build callFlow structure
    const callFlowData: Record<string, CallNode> = {};
    for (const node of allNodes) {
      callFlowData[node.id] = buildCallNode(node, keypointsMap, warningsMap, listenForMap, responsesMap);
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
    console.error(`[${requestId}] Fatal error in /api/scripts/callflow:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Support GET by redirecting to POST handler
export async function GET(request: NextRequest) {
  return POST(request);
}
