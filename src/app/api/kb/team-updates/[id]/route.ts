import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("team_updates")
      .select("*, team:teams(id, name, description), target_product:products(id, name)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Team update not found" }, { status: 404 });
    }

    // Check if the current user has acknowledged this update
    const { data: ackData } = await supabaseAdmin
      .from("team_update_acknowledgments")
      .select("id")
      .eq("team_update_id", id)
      .eq("user_id", user.id)
      .single();

    // Get acknowledgment count
    const { count: ackCount } = await supabaseAdmin
      .from("team_update_acknowledgments")
      .select("id", { count: "exact", head: true })
      .eq("team_update_id", id);

    return NextResponse.json({
      data: {
        ...data,
        is_acknowledged: !!ackData,
        acknowledgment_count: ackCount || 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!adminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { team_id, title, content, priority, requires_acknowledgment, status, effective_until, is_broadcast } = body;

    // Check current status before updating (to detect publish transition)
    const { data: currentUpdate } = await supabaseAdmin
      .from("team_updates")
      .select("status, team_id, title")
      .eq("id", id)
      .single();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (team_id !== undefined) updateData.team_id = team_id;
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (priority !== undefined) updateData.priority = priority;
    if (requires_acknowledgment !== undefined) updateData.requires_acknowledgment = requires_acknowledgment;
    if (status !== undefined) updateData.status = status;
    if (effective_until !== undefined) updateData.effective_until = effective_until;
    if (is_broadcast !== undefined) updateData.is_broadcast = is_broadcast;

    // Set published_at when transitioning to published
    const isPublishing = status === "published" && currentUpdate?.status !== "published";
    if (isPublishing) {
      updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("team_updates")
      .update(updateData)
      .eq("id", id)
      .select("*, team:teams(id, name, description)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create notifications for team members when publishing
    if (isPublishing && data) {
      const targetTeamId = team_id ?? currentUpdate?.team_id;
      const updateTitle = title ?? currentUpdate?.title ?? "Team Update";

      if (targetTeamId) {
        // Get all team members
        const { data: members } = await supabaseAdmin
          .from("team_members")
          .select("user_id")
          .eq("team_id", targetTeamId);

        if (members && members.length > 0) {
          // Create notification for each team member
          const notifications = members.map((member) => ({
            user_id: member.user_id,
            type: "new_team_update",
            title: `Team Update: ${updateTitle}`,
            message: content ? content.replace(/<[^>]*>/g, "").slice(0, 200) : null,
            reference_type: "team_update",
            reference_id: id,
            is_read: false,
          }));

          await supabaseAdmin.from("notifications").insert(notifications);
        }
      }
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!adminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Archive instead of hard delete
    const { error } = await supabaseAdmin
      .from("team_updates")
      .update({ status: "archived" })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Team update archived" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
