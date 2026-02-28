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

    // Get user's organization
    const { data: memberData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!memberData) {
      return NextResponse.json({ data: [] });
    }

    // Get teams and their member counts in parallel
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from("teams")
      .select("*")
      .eq("organization_id", memberData.organization_id)
      .order("name", { ascending: true });

    if (teamsError) {
      return NextResponse.json({ error: teamsError.message }, { status: 500 });
    }

    // Batch fetch member counts for all teams
    const teamIds = (teams || []).map(t => t.id);
    const { data: memberCounts, error: countsError } = teamIds.length > 0
      ? await supabaseAdmin
        .from("team_members")
        .select("team_id")
        .in("team_id", teamIds)
      : { data: [], error: null };

    if (countsError) {
      console.error("Failed to fetch member counts:", countsError);
    }

    const countsMap = (memberCounts || []).reduce((acc: Record<string, number>, curr: { team_id: string }) => {
      acc[curr.team_id] = (acc[curr.team_id] || 0) + 1;
      return acc;
    }, {});

    const teamsWithCounts = (teams || []).map(team => ({
      ...team,
      member_count: countsMap[team.id] || 0
    }));

    return NextResponse.json({ data: teamsWithCounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
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
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
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

    const { data, error } = await supabaseAdmin
      .from("teams")
      .insert({
        name,
        description: description || null,
        organization_id: memberData.organization_id
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Automatically add creator as a member
    await supabaseAdmin
      .from("team_members")
      .insert({ team_id: data.id, user_id: user.id, role: 'admin' });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("id");

    if (!teamId) {
      return NextResponse.json({ error: "Team id is required" }, { status: 400 });
    }

    // Delete all team updates associated with this team first (cascading delete)
    const { error: updatesError } = await supabaseAdmin
      .from("team_updates")
      .delete()
      .eq("team_id", teamId);

    if (updatesError) {
      console.warn("Failed to cleanup team updates:", updatesError);
      // We continue to try to delete the team anyway, or should we fail?
      // If the FK constraint exists with CASCADE, the DB would handle it,
      // but if not, this manual delete is necessary.
    }

    // Delete the team (cascade will handle team_members)
    const { error } = await supabaseAdmin
      .from("teams")
      .delete()
      .eq("id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Team deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
