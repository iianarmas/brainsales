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

  // Get users who were online in the last 2 minutes (heartbeat is every 30s)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("user_presence")
    .select("*")
    .eq("is_online", true)
    .gte("last_seen", twoMinutesAgo)
    .order("last_seen", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
