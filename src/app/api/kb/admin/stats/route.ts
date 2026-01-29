import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!adminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch KB updates stats
    const [
      { count: totalKbUpdates },
      { count: pendingKbDrafts },
      { count: publishedKbUpdates },
      { data: recentKbUpdates },
    ] = await Promise.all([
      supabaseAdmin.from("kb_updates").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("kb_updates").select("id", { count: "exact", head: true }).eq("status", "draft"),
      supabaseAdmin.from("kb_updates").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabaseAdmin
        .from("kb_updates")
        .select("id, title, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    // Fetch Team updates stats
    const [
      { count: totalTeamUpdates },
      { count: pendingTeamDrafts },
      { count: publishedTeamUpdates },
      { data: recentTeamUpdates },
    ] = await Promise.all([
      supabaseAdmin.from("team_updates").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("team_updates").select("id", { count: "exact", head: true }).eq("status", "draft"),
      supabaseAdmin.from("team_updates").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabaseAdmin
        .from("team_updates")
        .select("id, title, status, created_at, team_id")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    // Get total user count for acknowledgment rate calculation
    const { count: totalUsers } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Fetch acknowledgment rates for recent published KB updates
    const { data: publishedUpdatesForAck } = await supabaseAdmin
      .from("kb_updates")
      .select("id, title")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5);

    const acknowledgmentRates = await Promise.all(
      (publishedUpdatesForAck || []).map(async (update: { id: string; title: string }) => {
        const { count: ackCount } = await supabaseAdmin
          .from("update_acknowledgments")
          .select("id", { count: "exact", head: true })
          .eq("update_id", update.id);
        return {
          title: update.title,
          rate: totalUsers && totalUsers > 0 ? (ackCount || 0) / totalUsers : 0,
        };
      })
    );

    // Combine recent updates from both KB and Team updates
    const allRecentUpdates = [
      ...(recentKbUpdates || []).map((u: { id: string; title: string; status: string; created_at: string }) => ({
        ...u,
        update_type: "kb_update",
      })),
      ...(recentTeamUpdates || []).map((u: { id: string; title: string; status: string; created_at: string }) => ({
        ...u,
        update_type: "team_update",
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    return NextResponse.json({
      total_updates: (totalKbUpdates || 0) + (totalTeamUpdates || 0),
      pending_drafts: (pendingKbDrafts || 0) + (pendingTeamDrafts || 0),
      published: (publishedKbUpdates || 0) + (publishedTeamUpdates || 0),
      kb_stats: {
        total: totalKbUpdates || 0,
        drafts: pendingKbDrafts || 0,
        published: publishedKbUpdates || 0,
      },
      team_stats: {
        total: totalTeamUpdates || 0,
        drafts: pendingTeamDrafts || 0,
        published: publishedTeamUpdates || 0,
      },
      acknowledgment_rates: acknowledgmentRates,
      recent_updates: allRecentUpdates,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
