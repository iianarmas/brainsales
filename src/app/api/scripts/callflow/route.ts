import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { callFlow as staticCallFlow, CallNode } from "@/data/callFlow";

// Disable cache to ensure fresh data from database
export const revalidate = 0;

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

interface NodeRow {
  id: string;
  type: string;
  title: string;
  script: string;
  context: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * API Route to fetch the call flow structure from Supabase.
 * Uses POST to definitively bypass all levels of caching.
 */
export async function POST() {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] POST /api/scripts/callflow - Fetching scripts...`);

  try {
    if (!supabaseAdmin) {
      console.warn(`[${requestId}] ❌ Supabase admin client NOT initialized`);
      return NextResponse.json({ error: "Supabase client not initialized" }, { status: 500 });
    }

    // Fetch all active nodes with their related data
    // !node_id is required because there are multiple FKs between these tables
    const { data: nodes, error: nodesError } = await supabaseAdmin
      .from("call_nodes")
      .select(`
        *,
        call_node_keypoints!node_id(keypoint, sort_order),
        call_node_warnings!node_id(warning, sort_order),
        call_node_listen_for!node_id(listen_item, sort_order),
        call_node_responses!node_id(label, next_node_id, note, sort_order)
      `)
      .eq("is_active", true);

    if (nodesError) {
      console.error(`[${requestId}] ❌ Error fetching nodes from database:`, nodesError);
      return NextResponse.json({ error: nodesError.message, details: nodesError }, { status: 500 });
    }

    if (!nodes || nodes.length === 0) {
      console.warn(`[${requestId}] ⚠️ No active nodes found in database`);
      return NextResponse.json({ error: "No active nodes found" }, { status: 404 });
    }

    console.log(`[${requestId}] ✓ Successfully fetched ${nodes.length} nodes from database`);

    // Build callFlow structure in memory
    const callFlowData: Record<string, CallNode> = {};

    for (const node of nodes) {
      callFlowData[node.id] = {
        id: node.id,
        type: node.type as CallNode["type"],
        title: node.title,
        script: node.script,
        context: node.context || undefined,
        keyPoints: node.call_node_keypoints
          ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((k: any) => k.keypoint) || undefined,
        warnings: node.call_node_warnings
          ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((w: any) => w.warning) || undefined,
        listenFor: node.call_node_listen_for
          ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((l: any) => l.listen_item) || undefined,
        responses: node.call_node_responses
          ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((r: any) => ({
            label: r.label,
            nextNode: r.next_node_id,
            note: r.note || undefined,
          })) || [],
        topic_group_id: node.topic_group_id,
        metadata: node.metadata ? {
          competitorInfo: (node.metadata as any).competitorInfo,
          greenFlags: (node.metadata as any).greenFlags,
          redFlags: (node.metadata as any).redFlags,
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
export async function GET() {
  return POST();
}
