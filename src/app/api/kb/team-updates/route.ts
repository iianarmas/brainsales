import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// GET: Fetch all team updates for teams the user belongs to
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

    // Get all teams the user belongs to
    const { data: memberships } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id);

    const teamIds = memberships?.map((m) => m.team_id) || [];

    if (teamIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Fetch all published updates from user's teams
    const { data: updates, error } = await supabaseAdmin
      .from("team_updates")
      .select("*, team:teams(id, name, description)")
      .in("team_id", teamIds)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updates || updates.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get member counts for all teams
    const { data: memberCounts } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .in("team_id", teamIds);

    const memberCountMap: Record<string, number> = {};
    for (const mc of memberCounts || []) {
      memberCountMap[mc.team_id] = (memberCountMap[mc.team_id] || 0) + 1;
    }

    // Fetch acknowledgment data
    const updateIds = updates.map((u) => u.id);
    const { data: acks } = await supabaseAdmin
      .from("team_update_acknowledgments")
      .select("team_update_id, user_id")
      .in("team_update_id", updateIds);

    const ackCountMap: Record<string, number> = {};
    const userAckSet = new Set<string>();
    for (const ack of acks || []) {
      ackCountMap[ack.team_update_id] = (ackCountMap[ack.team_update_id] || 0) + 1;
      if (ack.user_id === user.id) {
        userAckSet.add(ack.team_update_id);
      }
    }

    // Enrich updates
    const enrichedUpdates = updates.map((u) => ({
      ...u,
      team: u.team ? { ...u.team, member_count: memberCountMap[u.team_id] || 0 } : null,
      acknowledgment_count: ackCountMap[u.id] || 0,
      is_acknowledged: userAckSet.has(u.id),
    }));

    return NextResponse.json({ data: enrichedUpdates });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

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

    const { data: adminData } = await supabaseAdmin.from("admins").select("id").eq("user_id", user.id).single();
    if (!adminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { team_id, title, content, priority, requires_acknowledgment, status, effective_until } = body;

    if (!team_id || !title) {
      return NextResponse.json({ error: "team_id and title are required" }, { status: 400 });
    }

    const isPublishing = status === "published";

    const insertData: Record<string, unknown> = {
      team_id,
      created_by: user.id,
      title,
      content: content || "",
      priority: priority || "medium",
      requires_acknowledgment: requires_acknowledgment ?? true,
      status: status || "draft",
    };

    if (effective_until) {
      insertData.effective_until = effective_until;
    }

    if (isPublishing) {
      insertData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("team_updates")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create notifications for team members when publishing
    if (isPublishing && data) {
      const { data: members } = await supabaseAdmin
        .from("team_members")
        .select("user_id")
        .eq("team_id", team_id);

      if (members && members.length > 0) {
        const notifications = members.map((member) => ({
          user_id: member.user_id,
          type: "new_team_update",
          title: `Team Update: ${title}`,
          message: content ? content.replace(/<[^>]*>/g, "").slice(0, 200) : null,
          reference_type: "team_update",
          reference_id: data.id,
          is_read: false,
        }));

        await supabaseAdmin.from("notifications").insert(notifications);
      }
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
