import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getOrganizationId, getProductId } from "@/app/lib/apiAuth";
import * as Sentry from "@sentry/nextjs";

/**
 * POST /api/analytics/sessions
 * Create or update a call session with outcome data + conversation path.
 * Called when a rep ends a call or sets an outcome.
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
    const body = await request.json();
    const { sessionId, outcome, notes, metadata, startedAt, conversationPath, callFlowId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const organizationId = await getOrganizationId(user.id);
    if (!organizationId) {
      return NextResponse.json({ error: "User not in an organization" }, { status: 403 });
    }

    const productId = await getProductId(request, authHeader);
    if (!productId) {
      return NextResponse.json({ error: "No product context" }, { status: 400 });
    }

    // Compute adherence score if we have path and flow context
    let adherenceScore: number | null = null;
    if (conversationPath?.length && callFlowId) {
      adherenceScore = await computeAdherenceScore(conversationPath, callFlowId, productId);
    }

    // Upsert: create if new, update if existing (same session_id)
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .upsert(
        {
          session_id: sessionId,
          user_id: user.id,
          product_id: productId,
          organization_id: organizationId,
          outcome: outcome || null,
          started_at: startedAt || now,
          ended_at: outcome ? now : null,
          duration_seconds: startedAt
            ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
            : null,
          notes: notes || null,
          metadata: metadata || {},
          conversation_path: conversationPath || null,
          call_flow_id: callFlowId || null,
          adherence_score: adherenceScore,
        },
        { onConflict: "session_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error saving session:", error);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}

/**
 * Computes adherence score for a session.
 * A node is "on-script" if:
 *   - Its call_flow_ids array contains the callFlowId (assigned to this flow), OR
 *   - Its call_flow_ids is NULL or empty (universal node, visible in all flows)
 * Score = (on-script node count / total node count) * 100
 */
async function computeAdherenceScore(
  conversationPath: string[],
  callFlowId: string,
  productId: string
): Promise<number | null> {
  if (!conversationPath.length) return null;

  const { data: nodes, error } = await supabaseAdmin!
    .from("call_nodes")
    .select("id, call_flow_ids")
    .in("id", conversationPath)
    .eq("product_id", productId);

  if (error || !nodes) return null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n.call_flow_ids as string[] | null]));

  let onScriptCount = 0;
  for (const nodeId of conversationPath) {
    const flowIds = nodeMap.get(nodeId);
    // Universal (no flow restriction) OR explicitly assigned to this flow
    const isOnScript =
      !flowIds ||
      flowIds.length === 0 ||
      flowIds.includes(callFlowId);
    if (isOnScript) onScriptCount++;
  }

  return Math.round((onScriptCount / conversationPath.length) * 10000) / 100;
}
