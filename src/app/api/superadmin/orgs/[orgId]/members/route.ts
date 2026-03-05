import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/lib/superAdminAuth";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId } = await params;

  const { data: members, error } = await supabaseAdmin
    .from("organization_members")
    .select("user_id, role, joined_at")
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("user_id, first_name, last_name, company_email, profile_picture_url")
        .in("user_id", userIds)
    : { data: [] as { user_id: string; first_name: string | null; last_name: string | null; company_email: string | null; profile_picture_url: string | null }[] };

  const profileMap: Record<string, { user_id: string; first_name: string | null; last_name: string | null; company_email: string | null; profile_picture_url: string | null }> = {};
  for (const p of profiles ?? []) profileMap[p.user_id] = p;

  const result = (members ?? []).map((m) => {
    const p = profileMap[m.user_id];
    const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.company_email : m.user_id;
    return { ...m, name, email: p?.company_email ?? null, avatar_url: p?.profile_picture_url ?? null };
  });

  return NextResponse.json(result);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId } = await params;
  const { email, role = "member" } = await request.json();

  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  // Look up user by email in auth.users via profiles table
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("company_email", email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: profile.user_id, role });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
