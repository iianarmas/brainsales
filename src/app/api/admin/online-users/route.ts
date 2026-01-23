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

  const { data: presenceData, error: presenceError } = await supabaseAdmin
    .from("user_presence")
    .select("*")
    .eq("is_online", true)
    .gte("last_seen", twoMinutesAgo)
    .order("last_seen", { ascending: false });

  if (presenceError) {
    return NextResponse.json({ error: presenceError.message }, { status: 500 });
  }

  if (!presenceData || presenceData.length === 0) {
    return NextResponse.json([]);
  }

  // Get user IDs
  const userIds = presenceData.map((p: any) => p.user_id);

  // Fetch profiles for these users
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("user_id, first_name, last_name")
    .in("user_id", userIds);

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    // Continue without profile data
  }

  // Create a map of user_id to profile
  const profilesMap = new Map();
  if (profilesData) {
    profilesData.forEach((profile: any) => {
      profilesMap.set(profile.user_id, profile);
    });
  }

  // Merge presence data with profile data
  const transformedData = presenceData.map((user: any) => {
    const profile = profilesMap.get(user.user_id);
    return {
      ...user,
      first_name: profile?.first_name || null,
      last_name: profile?.last_name || null,
    };
  });

  return NextResponse.json(transformedData);
}
