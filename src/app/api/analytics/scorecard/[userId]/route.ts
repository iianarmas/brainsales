import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getOrganizationId, isOrgAdmin } from "@/app/lib/apiAuth";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/analytics/scorecard/[userId]
 * Full scorecard for a single rep. Admin-only.
 *
 * Query params:
 *   productId - filter to specific product (optional)
 *   from      - start date ISO string (optional, defaults to 90 days ago)
 *   to        - end date ISO string (optional, defaults to now)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
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

    const isAdmin = await isOrgAdmin(user.id, organizationId);
    if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden: org admin required" }, { status: 403 });
    }

    const { userId } = await params;

    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get("productId");
        const from = searchParams.get("from") || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const to = searchParams.get("to") || new Date().toISOString();

        // Fetch profile
        const { data: profile } = await supabaseAdmin!
            .from("profiles")
            .select("user_id, first_name, last_name, profile_picture_url")
            .eq("user_id", userId)
            .single();

        // Fetch all sessions for this rep in the date range
        let sessionQuery = supabaseAdmin!
            .from("call_sessions")
            .select(
                "session_id, outcome, duration_seconds, adherence_score, call_flow_id, started_at, ended_at, metadata"
            )
            .eq("organization_id", organizationId)
            .eq("user_id", userId)
            .gte("started_at", from)
            .lte("started_at", to)
            .order("started_at", { ascending: false });

        if (productId) sessionQuery = sessionQuery.eq("product_id", productId);

        const { data: sessions, error: sessError } = await sessionQuery;
        if (sessError) throw sessError;

        const totalCalls = sessions?.length || 0;
        const outcomes: Record<string, number> = {};
        const durations: number[] = [];
        const adherenceScores: number[] = [];

        for (const s of sessions || []) {
            if (s.outcome) outcomes[s.outcome] = (outcomes[s.outcome] || 0) + 1;
            if (s.duration_seconds) durations.push(s.duration_seconds);
            if (s.adherence_score !== null) adherenceScores.push(s.adherence_score);
        }

        const successCount =
            (outcomes["meeting_set"] || 0) +
            (outcomes["follow_up"] || 0) +
            (outcomes["send_info"] || 0);
        const successRate = totalCalls > 0
            ? Math.round((successCount / totalCalls) * 1000) / 10
            : 0;
        const avgDurationSeconds = durations.length > 0
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : null;
        const avgAdherenceScore = adherenceScores.length > 0
            ? Math.round(adherenceScores.reduce((a, b) => a + b, 0) / adherenceScores.length * 100) / 100
            : null;

        // Call flow name lookup for recent sessions
        const callFlowIds = [...new Set((sessions || []).map((s) => s.call_flow_id).filter(Boolean))];
        let flowMap: Map<string, string> = new Map();
        if (callFlowIds.length > 0) {
            const { data: flows } = await supabaseAdmin!
                .from("call_nodes")
                .select("id, title")
                .in("id", callFlowIds);
            if (flows) flowMap = new Map(flows.map((f) => [f.id, f.title]));
        }

        // Top objections: fetch call_analytics for objection nodes during this rep's sessions in range
        const sessionIds = (sessions || []).map((s) => s.session_id);
        let topObjections: { nodeId: string; nodeTitle: string; count: number }[] = [];
        if (sessionIds.length > 0) {
            const { data: analytics } = await supabaseAdmin!
                .from("call_analytics")
                .select("node_id")
                .in("session_id", sessionIds);

            if (analytics?.length) {
                const nodeIdCounts: Record<string, number> = {};
                for (const a of analytics) {
                    nodeIdCounts[a.node_id] = (nodeIdCounts[a.node_id] || 0) + 1;
                }
                const allNodeIds = Object.keys(nodeIdCounts);

                // Get only objection-type nodes
                const { data: objNodes } = await supabaseAdmin!
                    .from("call_nodes")
                    .select("id, title")
                    .eq("type", "objection")
                    .in("id", allNodeIds);

                if (objNodes) {
                    topObjections = objNodes
                        .map((n) => ({ nodeId: n.id, nodeTitle: n.title, count: nodeIdCounts[n.id] || 0 }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5);
                }
            }
        }

        // Compute overall grade (A–F)
        const grade = computeGrade(avgAdherenceScore, successRate, totalCalls);

        // Recent sessions (last 20)
        const recentSessions = (sessions || []).slice(0, 20).map((s) => ({
            sessionId: s.session_id,
            startedAt: s.started_at,
            outcome: s.outcome,
            durationSeconds: s.duration_seconds,
            adherenceScore: s.adherence_score,
            callFlowId: s.call_flow_id,
            callFlowTitle: s.call_flow_id ? (flowMap.get(s.call_flow_id) || s.call_flow_id) : null,
            prospectName: (s.metadata as Record<string, unknown> | null)?.prospectName as string | null,
            organization: (s.metadata as Record<string, unknown> | null)?.organization as string | null,
        }));

        return NextResponse.json({
            dateRange: { from, to },
            profile: profile
                ? {
                    userId: profile.user_id,
                    name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown",
                    avatarUrl: profile.profile_picture_url,
                }
                : { userId, name: "Unknown", avatarUrl: null },
            grade,
            totalCalls,
            successCount,
            successRate,
            avgDurationSeconds,
            avgAdherenceScore,
            sessionsWithAdherence: adherenceScores.length,
            outcomes,
            topObjections,
            recentSessions,
        });
    } catch (error) {
        Sentry.captureException(error);
        console.error("Error fetching rep scorecard:", error);
        return NextResponse.json({ error: "Failed to fetch scorecard" }, { status: 500 });
    }
}

/**
 * Computes an overall grade for a rep based on adherence and success rate.
 * Weights: adherence 60%, success rate 40%.
 * Needs at least 3 calls to get a reliable grade.
 */
function computeGrade(
    avgAdherence: number | null,
    successRate: number,
    totalCalls: number
): "A" | "B" | "C" | "D" | "F" | "N/A" {
    if (totalCalls < 3) return "N/A";

    const adherenceComponent = avgAdherence ?? 50; // default to 50 if unavailable
    const composite = adherenceComponent * 0.6 + successRate * 0.4;

    if (composite >= 85) return "A";
    if (composite >= 70) return "B";
    if (composite >= 55) return "C";
    if (composite >= 40) return "D";
    return "F";
}
