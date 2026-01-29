import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("team_members")
      .select("*")
      .eq("team_id", id)
      .order("joined_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with user email/display info
    const enriched = await Promise.all(
      (data || []).map(async (m: Record<string, unknown>) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(m.user_id as string);
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", m.user_id)
          .single();
        return {
          ...m,
          email: userData?.user?.email || null,
          display_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null,
        };
      })
    );

    return NextResponse.json({ data: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const { user_id, email, role } = body;

    let resolvedUserId = user_id;

    // If email provided instead of user_id, look up the user
    if (!resolvedUserId && email) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const found = users?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
      if (!found) {
        return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
      }
      resolvedUserId = found.id;
    }

    if (!resolvedUserId) {
      return NextResponse.json({ error: "user_id or email is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("team_members")
      .insert({ team_id: id, user_id: resolvedUserId, role: role || "member" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json({ error: "user_id query parameter is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("team_members")
      .delete()
      .eq("team_id", id)
      .eq("user_id", user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
