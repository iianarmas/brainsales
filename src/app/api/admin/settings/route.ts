import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

async function getOrganizationId(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !supabaseAdmin) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  const { data: memberData } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return memberData?.organization_id || null;
}

async function isOrgAdmin(authHeader: string | null): Promise<string | null> {
  const orgId = await getOrganizationId(authHeader);
  if (!orgId) return null;

  const token = authHeader!.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;

  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return admin ? orgId : null;
}

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const orgId = await isOrgAdmin(authHeader);

  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("*")
    .eq("key", "invite_code")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const orgId = await isOrgAdmin(authHeader);

  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { value } = await request.json();

  if (!value || typeof value !== "string") {
    return NextResponse.json(
      { error: "Invalid invite code value" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .update({ value: value.toUpperCase(), updated_at: new Date().toISOString() })
    .eq("key", "invite_code")
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
