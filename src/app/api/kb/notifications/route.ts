import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

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

    // Fetch existing notifications
    const { data: existingNotifications, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get IDs of kb_updates the user already has notifications for
    const existingKbNotifIds = new Set(
      (existingNotifications || [])
        .filter((n: Notification) => n.reference_type === "kb_update" && n.reference_id)
        .map((n: Notification) => n.reference_id)
    );

    // Get IDs of team_updates the user already has notifications for
    const existingTeamNotifIds = new Set(
      (existingNotifications || [])
        .filter((n: Notification) => n.reference_type === "team_update" && n.reference_id)
        .map((n: Notification) => n.reference_id)
    );

    // Get user's acknowledgments for kb_updates
    const { data: kbAcks } = await supabaseAdmin
      .from("update_acknowledgments")
      .select("update_id")
      .eq("user_id", user.id);
    const acknowledgedKbIds = new Set((kbAcks || []).map((a: { update_id: string }) => a.update_id));

    // Get user's acknowledgments for team_updates
    const { data: teamAcks } = await supabaseAdmin
      .from("team_update_acknowledgments")
      .select("team_update_id")
      .eq("user_id", user.id);
    const acknowledgedTeamIds = new Set((teamAcks || []).map((a: { team_update_id: string }) => a.team_update_id));

    // Get user's team memberships
    const { data: memberships } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id);
    const userTeamIds = (memberships || []).map((m: { team_id: string }) => m.team_id);

    // Fetch published KB updates that user hasn't acknowledged and doesn't have notification for
    const { data: unreadKbUpdates } = await supabaseAdmin
      .from("kb_updates")
      .select("id, title, summary, content, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    // Generate synthetic notifications for unread KB updates without existing notifications
    const syntheticKbNotifications: Notification[] = (unreadKbUpdates || [])
      .filter((u: { id: string }) => !acknowledgedKbIds.has(u.id) && !existingKbNotifIds.has(u.id))
      .map((u: { id: string; title: string; summary?: string; content: string; published_at: string }) => ({
        id: `synthetic-kb-${u.id}`,
        user_id: user.id,
        type: "new_update",
        title: `New Update: ${u.title}`,
        message: u.summary || (u.content ? u.content.slice(0, 200) : null),
        reference_type: "kb_update",
        reference_id: u.id,
        is_read: false,
        created_at: u.published_at,
      }));

    // Fetch published team updates for user's teams that they haven't acknowledged
    let syntheticTeamNotifications: Notification[] = [];
    if (userTeamIds.length > 0) {
      const { data: unreadTeamUpdates } = await supabaseAdmin
        .from("team_updates")
        .select("id, title, content, published_at, team_id")
        .eq("status", "published")
        .in("team_id", userTeamIds)
        .order("published_at", { ascending: false });

      syntheticTeamNotifications = (unreadTeamUpdates || [])
        .filter((u: { id: string }) => !acknowledgedTeamIds.has(u.id) && !existingTeamNotifIds.has(u.id))
        .map((u: { id: string; title: string; content: string; published_at: string }) => ({
          id: `synthetic-team-${u.id}`,
          user_id: user.id,
          type: "new_team_update",
          title: `Team Update: ${u.title}`,
          message: u.content ? u.content.slice(0, 200) : null,
          reference_type: "team_update",
          reference_id: u.id,
          is_read: false,
          created_at: u.published_at,
        }));
    }

    // Combine all notifications and sort by created_at
    const allNotifications = [
      ...(existingNotifications || []),
      ...syntheticKbNotifications,
      ...syntheticTeamNotifications,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ data: allNotifications });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
