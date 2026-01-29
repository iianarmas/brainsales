import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { notification_id, all } = body;

    if (!notification_id && !all) {
      return NextResponse.json({ error: "Either notification_id or all: true is required" }, { status: 400 });
    }

    if (all) {
      // Mark all real notifications as read
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Also acknowledge all unacknowledged KB updates for this user
      const { data: kbUpdates } = await supabaseAdmin
        .from("kb_updates")
        .select("id")
        .eq("status", "published");

      if (kbUpdates && kbUpdates.length > 0) {
        const kbAcks = kbUpdates.map((u) => ({
          update_id: u.id,
          user_id: user.id,
          acknowledged_at: new Date().toISOString(),
        }));
        await supabaseAdmin
          .from("update_acknowledgments")
          .upsert(kbAcks, { onConflict: "update_id,user_id" });
      }

      // Also acknowledge all unacknowledged team updates for teams user belongs to
      const { data: memberships } = await supabaseAdmin
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);

      if (memberships && memberships.length > 0) {
        const teamIds = memberships.map((m) => m.team_id);
        const { data: teamUpdates } = await supabaseAdmin
          .from("team_updates")
          .select("id")
          .eq("status", "published")
          .in("team_id", teamIds);

        if (teamUpdates && teamUpdates.length > 0) {
          const teamAcks = teamUpdates.map((u) => ({
            team_update_id: u.id,
            user_id: user.id,
            acknowledged_at: new Date().toISOString(),
          }));
          await supabaseAdmin
            .from("team_update_acknowledgments")
            .upsert(teamAcks, { onConflict: "team_update_id,user_id" });
        }
      }

      return NextResponse.json({ message: "All notifications marked as read" });
    }

    // Handle synthetic notifications by acknowledging the underlying update
    if (notification_id.startsWith("synthetic-kb-")) {
      const updateId = notification_id.replace("synthetic-kb-", "");
      await supabaseAdmin
        .from("update_acknowledgments")
        .upsert(
          { update_id: updateId, user_id: user.id, acknowledged_at: new Date().toISOString() },
          { onConflict: "update_id,user_id" }
        );
      return NextResponse.json({ message: "KB update acknowledged" });
    }

    if (notification_id.startsWith("synthetic-team-")) {
      const updateId = notification_id.replace("synthetic-team-", "");
      await supabaseAdmin
        .from("team_update_acknowledgments")
        .upsert(
          { team_update_id: updateId, user_id: user.id, acknowledged_at: new Date().toISOString() },
          { onConflict: "team_update_id,user_id" }
        );
      return NextResponse.json({ message: "Team update acknowledged" });
    }

    // Handle real notifications
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification_id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Notification marked as read" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
