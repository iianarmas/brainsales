import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/lib/superAdminAuth";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId, inviteId } = await params;

  const { error } = await supabaseAdmin
    .from("invite_tokens")
    .delete()
    .eq("id", inviteId)
    .eq("organization_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
