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

  const [orgRes, membersRes, productsRes, invitesRes, cacheRes, sessionsRes] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single(),
    supabaseAdmin
      .from("organization_members")
      .select("user_id, role, joined_at")
      .eq("organization_id", orgId),
    supabaseAdmin
      .from("products")
      .select("id, name, slug, is_active")
      .eq("organization_id", orgId),
    supabaseAdmin
      .from("invite_tokens")
      .select("id, email, role, token, expires_at, used_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("ai_navigation_cache")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabaseAdmin
      .from("call_sessions")
      .select("id, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (orgRes.error) return NextResponse.json({ error: orgRes.error.message }, { status: 404 });

  // Enrich members with profile data
  const userIds = (membersRes.data ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("user_id, first_name, last_name, company_email, profile_picture_url")
        .in("user_id", userIds)
    : { data: [] };

  const profileMap: Record<string, typeof profiles[0]> = {};
  for (const p of profiles ?? []) profileMap[p.user_id] = p;

  const members = (membersRes.data ?? []).map((m) => {
    const p = profileMap[m.user_id];
    const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.company_email : m.user_id;
    return { ...m, name, email: p?.company_email ?? null, avatar_url: p?.profile_picture_url ?? null };
  });

  return NextResponse.json({
    org: orgRes.data,
    members,
    products: productsRes.data ?? [],
    invites: invitesRes.data ?? [],
    stats: {
      cache_count: cacheRes.count ?? 0,
      last_session_at: sessionsRes.data?.[0]?.created_at ?? null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId } = await params;
  const body = await request.json();
  const allowed = ["name", "slug", "plan", "is_active", "allowed_domains", "allowed_emails", "logo_url"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("organizations")
    .update(updates)
    .eq("id", orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId } = await params;

  const { error } = await supabaseAdmin
    .from("organizations")
    .delete()
    .eq("id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
