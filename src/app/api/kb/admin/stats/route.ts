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

    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const kbPage = parseInt(searchParams.get("kb_page") || "1");
    const kbLimit = parseInt(searchParams.get("kb_limit") || "5");
    const teamPage = parseInt(searchParams.get("team_page") || "1");
    const teamLimit = parseInt(searchParams.get("team_limit") || "5");

    const kbOffset = (kbPage - 1) * kbLimit;
    const teamOffset = (teamPage - 1) * teamLimit;

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
      { data: publishedUpdatesForAck, count: kbCountForAck },
      { data: publishedTeamUpdatesForAck, count: teamCountForAck }
    ] = await Promise.all([
      supabaseAdmin.from("kb_updates").select("*", { count: "exact", head: true }).eq("organization_id", orgId).neq("status", "archived"),
      supabaseAdmin.from("kb_updates").select("*", { count: "exact", head: true }).eq("status", "draft").eq("organization_id", orgId).neq("status", "archived"),
      supabaseAdmin.from("kb_updates").select("*", { count: "exact", head: true }).eq("status", "published").eq("organization_id", orgId).neq("status", "archived"),
      supabaseAdmin
        .from("kb_updates")
        .select("id, title, status, created_at")
        .eq("organization_id", orgId)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin.from("team_updates").select("*", { count: "exact", head: true }).eq("organization_id", orgId).neq("status", "archived"),
      supabaseAdmin.from("team_updates").select("*", { count: "exact", head: true }).eq("status", "draft").eq("organization_id", orgId).neq("status", "archived"),
      supabaseAdmin.from("team_updates").select("*", { count: "exact", head: true }).eq("status", "published").eq("organization_id", orgId).neq("status", "archived"),
      supabaseAdmin
        .from("team_updates")
        .select("id, title, status, created_at, team_id")
        .eq("organization_id", orgId)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabaseAdmin
        .from("kb_updates")
        .select("id, title, target_product_id", { count: "exact" })
        .eq("status", "published")
        .eq("organization_id", orgId)
        .order("published_at", { ascending: false })
        .range(kbOffset, kbOffset + kbLimit - 1),
      supabaseAdmin
        .from("team_updates")
        .select("id, title, is_broadcast, team_id", { count: "exact" })
        .eq("status", "published")
        .eq("organization_id", orgId)
        .order("published_at", { ascending: false })
        .range(teamOffset, teamOffset + teamLimit - 1)
    ]);

    const totalKbForAck = kbCountForAck || 0;
    const totalTeamForAck = teamCountForAck || 0;

    // Get rates for KB updates
    const kbRates = await Promise.all((publishedUpdatesForAck || []).map(async (update: any) => {
      // 1. Get Target User IDs
      let targetUserIds: string[] = [];
      if (update.target_product_id) {
        const { data } = await supabaseAdmin
          .from("product_users")
          .select("user_id")
          .eq("product_id", update.target_product_id);
        targetUserIds = (data || []).map(d => d.user_id);
      } else {
        const { data } = await supabaseAdmin
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId);
        targetUserIds = (data || []).map(d => d.user_id);
      }

      // 2. Get Acknowledgment User IDs for this update
      const { data: acks } = await supabaseAdmin
        .from("update_acknowledgments")
        .select("user_id")
        .eq("update_id", update.id);
      const ackUserIds = (acks || []).map(a => a.user_id);

      // 3. Intersect (Only count acknowledgments from users in the target group)
      const validAcks = ackUserIds.filter(id => targetUserIds.includes(id));

      const denominator = targetUserIds.length;
      const count = validAcks.length;

      return {
        id: update.id,
        title: update.title,
        type: 'kb' as const,
        rate: denominator > 0 ? count / denominator : 0,
      };
    }));

    // Get rates for Team updates
    const teamRates = await Promise.all((publishedTeamUpdatesForAck || []).map(async (update: any) => {
      // 1. Get Target User IDs
      let targetUserIds: string[] = [];
      if (update.is_broadcast) {
        const { data } = await supabaseAdmin
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgId);
        targetUserIds = (data || []).map(d => d.user_id);
      } else if (update.team_id) {
        const { data } = await supabaseAdmin
          .from("team_members")
          .select("user_id")
          .eq("team_id", update.team_id);
        targetUserIds = (data || []).map(d => d.user_id);
      }

      // 2. Get Acknowledgment User IDs
      const { data: acks } = await supabaseAdmin
        .from("team_update_acknowledgments")
        .select("user_id")
        .eq("team_update_id", update.id);
      const ackUserIds = (acks || []).map(a => a.user_id);

      // 3. Intersect
      const validAcks = ackUserIds.filter(id => targetUserIds.includes(id));

      const denominator = targetUserIds.length;
      const count = validAcks.length;

      return {
        id: update.id,
        title: update.title,
        type: 'team' as const,
        rate: denominator > 0 ? count / denominator : 0,
      };
    }));

    const acknowledgmentRates = [...kbRates, ...teamRates];

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
      acknowledgment_pagination: {
        kb: {
          total: totalKbForAck,
          page: kbPage,
          limit: kbLimit,
          total_pages: Math.ceil(totalKbForAck / kbLimit)
        },
        team: {
          total: totalTeamForAck,
          page: teamPage,
          limit: teamLimit,
          total_pages: Math.ceil(totalTeamForAck / teamLimit)
        }
      },
      recent_updates: allRecentUpdates,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
