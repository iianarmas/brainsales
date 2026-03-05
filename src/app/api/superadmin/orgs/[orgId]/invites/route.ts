import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/lib/superAdminAuth";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import crypto from "crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId } = await params;

  const { data, error } = await supabaseAdmin
    .from("invite_tokens")
    .select("id, email, role, token, expires_at, used_at, used_by, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId } = await params;
  const { email, role = "member", expiresInDays = 7 } = await request.json();

  const token = crypto.randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("invite_tokens")
    .insert({
      organization_id: orgId,
      created_by: auth.userId,
      email: email || null,
      role,
      token,
      expires_at,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
