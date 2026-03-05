import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/lib/superAdminAuth";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { data: orgs, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug, plan, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch member + product counts per org
  const orgIds = orgs?.map((o) => o.id) ?? [];

  const [membersRes, productsRes, sessionsRes] = await Promise.all([
    supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .in("organization_id", orgIds),
    supabaseAdmin
      .from("products")
      .select("organization_id")
      .in("organization_id", orgIds),
    supabaseAdmin
      .from("call_sessions")
      .select("organization_id")
      .in("organization_id", orgIds),
  ]);

  const memberCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};
  const sessionCounts: Record<string, number> = {};

  for (const row of membersRes.data ?? []) {
    memberCounts[row.organization_id] = (memberCounts[row.organization_id] ?? 0) + 1;
  }
  for (const row of productsRes.data ?? []) {
    productCounts[row.organization_id] = (productCounts[row.organization_id] ?? 0) + 1;
  }
  for (const row of sessionsRes.data ?? []) {
    sessionCounts[row.organization_id] = (sessionCounts[row.organization_id] ?? 0) + 1;
  }

  const result = (orgs ?? []).map((org) => ({
    ...org,
    member_count: memberCounts[org.id] ?? 0,
    product_count: productCounts[org.id] ?? 0,
    session_count: sessionCounts[org.id] ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name, slug, plan = "team", allowed_domains = [], allowed_emails = [] } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("organizations")
    .insert({ name, slug, plan, allowed_domains, allowed_emails, is_active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
