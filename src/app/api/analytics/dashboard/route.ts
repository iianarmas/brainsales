import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getOrganizationId, isOrgAdmin, getProductId } from "@/app/lib/apiAuth";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/analytics/dashboard
 * Aggregated analytics for org admins: conversion funnels,
 * drop-off analysis, objection frequency, per-rep performance.
 *
 * Query params:
 *   productId - filter to specific product (optional, defaults to user's product)
 *   from      - start date ISO string (optional, defaults to 30 days ago)
 *   to        - end date ISO string (optional, defaults to now)
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

  const organizationId = await getOrganizationId(user.id);
  if (!organizationId) {
    return NextResponse.json({ error: "User not in an organization" }, { status: 403 });
  }

  // Org admins only
  const isAdmin = await isOrgAdmin(user.id, organizationId);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: org admin required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId") || await getProductId(request, authHeader);
    const from = searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = searchParams.get("to") || new Date().toISOString();

    const [
      outcomeDistribution,
      completionRate,
      dropOffNodes,
      objectionFrequency,
      repPerformance,
    ] = await Promise.all([
      getOutcomeDistribution(organizationId, productId, from, to),
      getCompletionRate(organizationId, productId, from, to),
      getDropOffAnalysis(organizationId, productId, from, to),
      getObjectionFrequency(organizationId, productId, from, to),
      getRepPerformance(organizationId, productId, from, to),
    ]);

    return NextResponse.json({
      dateRange: { from, to },
      outcomeDistribution,
      completionRate,
      dropOffNodes,
      objectionFrequency,
      repPerformance,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error fetching analytics dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

// -- Aggregation helpers --

/**
 * Outcome distribution: count of each outcome type for the org.
 */
async function getOutcomeDistribution(
  orgId: string, productId: string | null, from: string, to: string
) {
  let query = supabaseAdmin!
    .from("call_sessions")
    .select("outcome")
    .eq("organization_id", orgId)
    .gte("started_at", from)
    .lte("started_at", to)
    .not("outcome", "is", null);

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) throw error;

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of data || []) {
    counts[row.outcome] = (counts[row.outcome] || 0) + 1;
    total++;
  }

  return {
    total,
    outcomes: Object.entries(counts).map(([outcome, count]) => ({
      outcome,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    })),
  };
}

/**
 * Script completion rate: % of sessions where the user reached
 * a terminal "success" type node.
 */
async function getCompletionRate(
  orgId: string, productId: string | null, from: string, to: string
) {
  // Get all sessions in range
  let sessionQuery = supabaseAdmin!
    .from("call_sessions")
    .select("session_id")
    .eq("organization_id", orgId)
    .gte("started_at", from)
    .lte("started_at", to);

  if (productId) sessionQuery = sessionQuery.eq("product_id", productId);

  const { data: sessions, error: sessError } = await sessionQuery;
  if (sessError) throw sessError;

  const totalSessions = sessions?.length || 0;
  if (totalSessions === 0) return { totalSessions: 0, completed: 0, rate: 0 };

  const sessionIds = sessions!.map((s) => s.session_id);

  // Get success-type nodes for this product
  let nodesQuery = supabaseAdmin!
    .from("call_nodes")
    .select("id")
    .eq("type", "success");

  if (productId) nodesQuery = nodesQuery.eq("product_id", productId);

  const { data: successNodes, error: nodeError } = await nodesQuery;
  if (nodeError) throw nodeError;

  if (!successNodes?.length) return { totalSessions, completed: 0, rate: 0 };

  const successNodeIds = successNodes.map((n) => n.id);

  // Count sessions that hit a success node
  const { data: analytics, error: analyticsError } = await supabaseAdmin!
    .from("call_analytics")
    .select("session_id")
    .in("session_id", sessionIds)
    .in("node_id", successNodeIds);

  if (analyticsError) throw analyticsError;

  const completedSessions = new Set(analytics?.map((a) => a.session_id)).size;

  return {
    totalSessions,
    completed: completedSessions,
    rate: Math.round((completedSessions / totalSessions) * 1000) / 10,
  };
}

/**
 * Drop-off analysis: which nodes are most frequently the LAST node
 * visited before a session ends (without reaching success).
 */
async function getDropOffAnalysis(
  orgId: string, productId: string | null, from: string, to: string
) {
  // Get sessions that did NOT reach a success outcome
  let sessionQuery = supabaseAdmin!
    .from("call_sessions")
    .select("session_id")
    .eq("organization_id", orgId)
    .gte("started_at", from)
    .lte("started_at", to)
    .or("outcome.is.null,outcome.neq.meeting_set");

  if (productId) sessionQuery = sessionQuery.eq("product_id", productId);

  const { data: incompleteSessions, error: sessError } = await sessionQuery;
  if (sessError) throw sessError;

  if (!incompleteSessions?.length) return [];

  const sessionIds = incompleteSessions.map((s) => s.session_id);

  // For each session, find the last navigated node
  const { data: analytics, error: analyticsError } = await supabaseAdmin!
    .from("call_analytics")
    .select("session_id, node_id, navigated_at")
    .in("session_id", sessionIds)
    .order("navigated_at", { ascending: false });

  if (analyticsError) throw analyticsError;

  // Group by session, take the last node
  const lastNodeBySession = new Map<string, string>();
  for (const row of analytics || []) {
    if (!lastNodeBySession.has(row.session_id)) {
      lastNodeBySession.set(row.session_id, row.node_id);
    }
  }

  // Count drop-off frequency per node
  const dropOffCounts: Record<string, number> = {};
  for (const nodeId of lastNodeBySession.values()) {
    dropOffCounts[nodeId] = (dropOffCounts[nodeId] || 0) + 1;
  }

  // Get node titles for display
  const nodeIds = Object.keys(dropOffCounts);
  const { data: nodes } = await supabaseAdmin!
    .from("call_nodes")
    .select("id, title, type")
    .in("id", nodeIds);

  const nodeMap = new Map(nodes?.map((n) => [n.id, n]) || []);

  return Object.entries(dropOffCounts)
    .map(([nodeId, count]) => ({
      nodeId,
      nodeTitle: nodeMap.get(nodeId)?.title || nodeId,
      nodeType: nodeMap.get(nodeId)?.type || "unknown",
      count,
      percentage: Math.round((count / lastNodeBySession.size) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

/**
 * Objection frequency: how often objection-type nodes are visited.
 */
async function getObjectionFrequency(
  orgId: string, productId: string | null, from: string, to: string
) {
  // Get objection nodes
  let nodesQuery = supabaseAdmin!
    .from("call_nodes")
    .select("id, title")
    .eq("type", "objection");

  if (productId) nodesQuery = nodesQuery.eq("product_id", productId);

  const { data: objectionNodes, error: nodeError } = await nodesQuery;
  if (nodeError) throw nodeError;

  if (!objectionNodes?.length) return [];

  const objectionNodeIds = objectionNodes.map((n) => n.id);

  // Count visits to objection nodes in the date range
  let analyticsQuery = supabaseAdmin!
    .from("call_analytics")
    .select("node_id")
    .in("node_id", objectionNodeIds)
    .gte("navigated_at", from)
    .lte("navigated_at", to);

  if (productId) analyticsQuery = analyticsQuery.eq("product_id", productId);

  const { data: analytics, error: analyticsError } = await analyticsQuery;
  if (analyticsError) throw analyticsError;

  const counts: Record<string, number> = {};
  for (const row of analytics || []) {
    counts[row.node_id] = (counts[row.node_id] || 0) + 1;
  }

  const nodeMap = new Map(objectionNodes.map((n) => [n.id, n.title]));
  const totalObjectionHits = Object.values(counts).reduce((sum, c) => sum + c, 0);

  return Object.entries(counts)
    .map(([nodeId, count]) => ({
      nodeId,
      nodeTitle: nodeMap.get(nodeId) || nodeId,
      count,
      percentage: totalObjectionHits > 0
        ? Math.round((count / totalObjectionHits) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Per-rep performance: outcome distribution and avg duration per user.
 */
async function getRepPerformance(
  orgId: string, productId: string | null, from: string, to: string
) {
  let query = supabaseAdmin!
    .from("call_sessions")
    .select("user_id, outcome, duration_seconds")
    .eq("organization_id", orgId)
    .gte("started_at", from)
    .lte("started_at", to)
    .not("user_id", "is", null);

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) throw error;

  // Group by user
  const byUser = new Map<string, { outcomes: Record<string, number>; durations: number[]; total: number }>();

  for (const row of data || []) {
    if (!row.user_id) continue;
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, { outcomes: {}, durations: [], total: 0 });
    }
    const entry = byUser.get(row.user_id)!;
    entry.total++;
    if (row.outcome) {
      entry.outcomes[row.outcome] = (entry.outcomes[row.outcome] || 0) + 1;
    }
    if (row.duration_seconds) {
      entry.durations.push(row.duration_seconds);
    }
  }

  // Get profile info for all reps
  const userIds = Array.from(byUser.keys());
  const { data: profiles } = await supabaseAdmin!
    .from("profiles")
    .select("user_id, first_name, last_name, profile_picture_url")
    .in("user_id", userIds);

  const profileMap = new Map(
    profiles?.map((p) => [
      p.user_id,
      {
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
        avatarUrl: p.profile_picture_url,
      },
    ]) || []
  );

  return Array.from(byUser.entries())
    .map(([userId, stats]) => {
      const avgDuration = stats.durations.length > 0
        ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
        : null;

      const successCount = (stats.outcomes["meeting_set"] || 0);

      return {
        userId,
        name: profileMap.get(userId)?.name || "Unknown",
        avatarUrl: profileMap.get(userId)?.avatarUrl || null,
        totalCalls: stats.total,
        outcomes: stats.outcomes,
        successCount,
        successRate: stats.total > 0
          ? Math.round((successCount / stats.total) * 1000) / 10
          : 0,
        avgDurationSeconds: avgDuration,
      };
    })
    .sort((a, b) => b.successRate - a.successRate || b.totalCalls - a.totalCalls);
}
