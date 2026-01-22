import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

async function isAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !supabaseAdmin) return false;

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  if (!user) return false;

  const { data } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return !!data;
}

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");

  if (!(await isAdmin(authHeader))) {
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

  if (!(await isAdmin(authHeader))) {
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
