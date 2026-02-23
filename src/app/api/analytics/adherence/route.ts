import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getOrganizationId, isOrgAdmin, getProductId } from "@/app/lib/apiAuth";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/analytics/adherence
 * Per-rep adherence scores and weekly trend data. Admin-only.
 *
 * Query params:
 *   productId  - filter to specific product (optional)
 *   from       - start date ISO string (optional, defaults to 90 days ago)
 *   to         - end date ISO string (optional, defaults to now)
 *   userId     - filter to single rep (optional)
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

    const isAdmin = await isOrgAdmin(user.id, organizationId);
    if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden: org admin required" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get("productId") || await getProductId(request, authHeader);
        const from = searchParams.get("from") || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const to = searchParams.get("to") || new Date().toISOString();
        const filterUserId = searchParams.get("userId") || null;

        const [repAdherence, weeklyTrend] = await Promise.all([
            getRepAdherenceSummary(organizationId, productId, from, to, filterUserId),
            getWeeklyAdherenceTrend(organizationId, productId, from, to, filterUserId),
        ]);

        // Org-wide average
        const scoresWithData = repAdherence.filter((r) => r.avgAdherenceScore !== null);
        const orgAvgAdherence = scoresWithData.length > 0
            ? Math.round(
                scoresWithData.reduce((sum, r) => sum + (r.avgAdherenceScore ?? 0), 0) /
                scoresWithData.length * 100
            ) / 100
            : null;

        return NextResponse.json({
            dateRange: { from, to },
            orgAvgAdherence,
            repAdherence,
            weeklyTrend,
        });
    } catch (error) {
        Sentry.captureException(error);
        console.error("Error fetching adherence data:", error);
        return NextResponse.json({ error: "Failed to fetch adherence data" }, { status: 500 });
    }
}

/**
 * Per-rep adherence summary: avg score, sessions with/without adherence data,
 * total calls, and outcome breakdown.
 */
async function getRepAdherenceSummary(
    orgId: string,
    productId: string | null,
    from: string,
    to: string,
    filterUserId: string | null
) {
    let query = supabaseAdmin!
        .from("call_sessions")
        .select("user_id, outcome, adherence_score, duration_seconds")
        .eq("organization_id", orgId)
        .gte("started_at", from)
        .lte("started_at", to)
        .not("user_id", "is", null);

    if (productId) query = query.eq("product_id", productId);
    if (filterUserId) query = query.eq("user_id", filterUserId);

    const { data, error } = await query;
    if (error) throw error;

    // Group by user
    const byUser = new Map<string, {
        scores: number[];
        outcomes: Record<string, number>;
        durations: number[];
        total: number;
    }>();

    for (const row of data || []) {
        if (!row.user_id) continue;
        if (!byUser.has(row.user_id)) {
            byUser.set(row.user_id, { scores: [], outcomes: {}, durations: [], total: 0 });
        }
        const entry = byUser.get(row.user_id)!;
        entry.total++;
        if (row.adherence_score !== null) entry.scores.push(row.adherence_score);
        if (row.outcome) entry.outcomes[row.outcome] = (entry.outcomes[row.outcome] || 0) + 1;
        if (row.duration_seconds) entry.durations.push(row.duration_seconds);
    }

    // Fetch profile info
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

    return Array.from(byUser.entries()).map(([userId, stats]) => {
        const avgAdherenceScore = stats.scores.length > 0
            ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length * 100) / 100
            : null;
        const avgDuration = stats.durations.length > 0
            ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
            : null;
        const successCount =
            (stats.outcomes["meeting_set"] || 0) +
            (stats.outcomes["follow_up"] || 0) +
            (stats.outcomes["send_info"] || 0);
        const successRate = stats.total > 0
            ? Math.round((successCount / stats.total) * 1000) / 10
            : 0;

        return {
            userId,
            name: profileMap.get(userId)?.name || "Unknown",
            avatarUrl: profileMap.get(userId)?.avatarUrl || null,
            totalCalls: stats.total,
            sessionsWithAdherence: stats.scores.length,
            avgAdherenceScore,
            outcomes: stats.outcomes,
            successCount,
            successRate,
            avgDurationSeconds: avgDuration,
        };
    }).sort((a, b) => (b.avgAdherenceScore ?? -1) - (a.avgAdherenceScore ?? -1));
}

/**
 * Weekly adherence trend: average adherence score per ISO week.
 * Returns an array of { weekStart, avgAdherence, sessionCount } objects.
 */
async function getWeeklyAdherenceTrend(
    orgId: string,
    productId: string | null,
    from: string,
    to: string,
    filterUserId: string | null
) {
    let query = supabaseAdmin!
        .from("call_sessions")
        .select("started_at, adherence_score")
        .eq("organization_id", orgId)
        .gte("started_at", from)
        .lte("started_at", to)
        .not("adherence_score", "is", null);

    if (productId) query = query.eq("product_id", productId);
    if (filterUserId) query = query.eq("user_id", filterUserId);

    const { data, error } = await query;
    if (error) throw error;

    // Group by ISO week (Monday as start)
    const weekMap = new Map<string, { scores: number[] }>();
    for (const row of data || []) {
        const date = new Date(row.started_at);
        // Monday of the week
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        const weekKey = monday.toISOString().slice(0, 10);

        if (!weekMap.has(weekKey)) weekMap.set(weekKey, { scores: [] });
        weekMap.get(weekKey)!.scores.push(row.adherence_score);
    }

    return Array.from(weekMap.entries())
        .map(([weekStart, { scores }]) => ({
            weekStart,
            avgAdherence: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100,
            sessionCount: scores.length,
        }))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
