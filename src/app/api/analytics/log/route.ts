import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

/**
 * POST /api/analytics/log
 * Log a node navigation event
 */
export async function POST(request: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    try {
        const { nodeId, sessionId } = await request.json();
        if (!nodeId || !sessionId) {
            return NextResponse.json({ error: "Node ID and Session ID are required" }, { status: 400 });
        }

        const authHeader = request.headers.get("authorization");
        let userId = null;

        if (authHeader) {
            const token = authHeader.replace("Bearer ", "");
            const { data: { user } } = await supabaseAdmin.auth.getUser(token);
            userId = user?.id || null;
        }

        const { error } = await supabaseAdmin
            .from("call_analytics")
            .insert({
                node_id: nodeId,
                session_id: sessionId,
                user_id: userId,
                navigated_at: new Date().toISOString()
            });

        if (error) throw error;
        return NextResponse.json({ message: "Navigation logged" });
    } catch (error) {
        console.error("Error logging analytics:", error);
        return NextResponse.json({ error: "Failed to log navigation" }, { status: 500 });
    }
}

/**
 * GET /api/analytics/stats
 * Get navigation counts per node for heatmap
 */
export async function GET(request: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Admin only
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { data: admin } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .single();

    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    try {
        // Get counts per node
        const { data, error } = await supabaseAdmin
            .from("call_analytics")
            .select("node_id");

        if (error) throw error;

        const stats: Record<string, number> = {};
        data.forEach(row => {
            stats[row.node_id] = (stats[row.node_id] || 0) + 1;
        });

        return NextResponse.json(stats);
    } catch (error) {
        console.error("Error fetching analytics stats:", error);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}
