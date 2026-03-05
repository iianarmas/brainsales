import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/lib/superAdminAuth";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; featureKey: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId, featureKey } = await params;
  const { config } = await request.json();

  const { data, error } = await supabaseAdmin
    .from("organization_features")
    .update({ config })
    .eq("organization_id", orgId)
    .eq("feature_key", featureKey)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; featureKey: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId, featureKey } = await params;

  const { error } = await supabaseAdmin
    .from("organization_features")
    .delete()
    .eq("organization_id", orgId)
    .eq("feature_key", featureKey);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
