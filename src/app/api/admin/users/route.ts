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

    const { data: adminData } = await supabaseAdmin.from("admins").select("id").eq("user_id", user.id).single();
    if (!adminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get user's organization for strict isolation
    const { data: memberData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!memberData) {
      return NextResponse.json({ data: [] });
    }

    const orgId = memberData.organization_id;

    // Get IDs of all members in this organization
    const { data: orgMembers } = await supabaseAdmin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId);

    const orgUserIds = new Set((orgMembers || []).map(m => m.user_id));

    // Get all auth users (we have to filter in memory as auth.admin.listUsers doesn't support bulk filter by ID)
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    // Filter auth users to those in the organization
    const filteredAuthUsers = (authUsers?.users || []).filter(u => orgUserIds.has(u.id));

    // Get profiles for display names in this organization
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", Array.from(orgUserIds));

    const profileMap = new Map(
      (profiles || []).map((p: { user_id: string; first_name: string | null; last_name: string | null }) => [
        p.user_id,
        `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      ])
    );

    const data = filteredAuthUsers.map((u: { id: string; email?: string }) => ({
      id: u.id,
      email: u.email || '',
      display_name: profileMap.get(u.id) || undefined,
    }));

    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
