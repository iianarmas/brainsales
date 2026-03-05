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

  const { data, error } = await supabaseAdmin
    .from("organization_features")
    .select("feature_key, config, enabled_at, enabled_by")
    .eq("organization_id", orgId);

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
  const { feature_key, config = {} } = await request.json();

  if (!feature_key) return NextResponse.json({ error: "feature_key is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("organization_features")
    .upsert(
      { organization_id: orgId, feature_key, config, enabled_by: auth.userId },
      { onConflict: "organization_id,feature_key" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
