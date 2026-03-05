import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/lib/superAdminAuth";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId, userId } = await params;
  const { role } = await request.json();

  if (!["member", "admin", "owner"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // If promoting to owner, demote the current owner first
  if (role === "owner") {
    await supabaseAdmin
      .from("organization_members")
      .update({ role: "admin" })
      .eq("organization_id", orgId)
      .eq("role", "owner");
  }

  const { error } = await supabaseAdmin
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { orgId, userId } = await params;

  const { error } = await supabaseAdmin
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
