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

    // Get user's organization
    const { data: memberData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!memberData) {
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    const orgId = memberData.organization_id;

    // Fetch KB and Team updates stats in parallel
    const [
      { count: totalKbUpdates },
      { count: pendingKbDrafts },
      { count: publishedKbUpdates },
      { data: recentKbUpdates },
      { count: totalTeamUpdates },
      { count: pendingTeamDrafts },
      { count: publishedTeamUpdates },
      { data: recentTeamUpdates },
      { count: totalOrgUsers },
      { data: publishedUpdatesForAck }
    ] = await Promise.all([
      supabaseAdmin.from("kb_updates").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabaseAdmin.from("kb_updates").select("id", { count: "exact", head: true }).eq("status", "draft").eq("organization_id", orgId),
      supabaseAdmin.from("kb_updates").select("id", { count: "exact", head: true }).eq("status", "published").eq("organization_id", orgId),
      supabaseAdmin
        .from("kb_updates")
        .select("id, title, status, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin.from("team_updates").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabaseAdmin.from("team_updates").select("id", { count: "exact", head: true }).eq("status", "draft").eq("organization_id", orgId),
      supabaseAdmin.from("team_updates").select("id", { count: "exact", head: true }).eq("status", "published").eq("organization_id", orgId),
      supabaseAdmin
        .from("team_updates")
        .select("id, title, status, created_at, team_id")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabaseAdmin
        .from("kb_updates")
        .select("id, title")
        .eq("status", "published")
        .eq("organization_id", orgId)
        .order("published_at", { ascending: false })
        .limit(5)
    ]);

    // Fetch acknowledgment rates for recent published KB updates in a single query
    const updateIds = (publishedUpdatesForAck || []).map(u => u.id);
    const { data: allAcks } = updateIds.length > 0
      ? await supabaseAdmin
        .from("update_acknowledgments")
        .select("update_id")
        .in("update_id", updateIds)
      : { data: [] };

    const ackCountsMap = (allAcks || []).reduce((acc: Record<string, number>, curr: { update_id: string }) => {
      acc[curr.update_id] = (acc[curr.update_id] || 0) + 1;
      return acc;
    }, {});

    const acknowledgmentRates = (publishedUpdatesForAck || []).map((update: { id: string; title: string }) => ({
      id: update.id,
      title: update.title,
      rate: totalOrgUsers && totalOrgUsers > 0 ? (ackCountsMap[update.id] || 0) / totalOrgUsers : 0,
    }));

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
