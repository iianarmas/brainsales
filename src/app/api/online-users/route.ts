import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

interface PresenceRecord {
  id: string;
  user_id: string;
  email: string;
  last_seen: string;
  is_online: boolean;
}

interface ProfileRecord {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
}

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get users who were online in the last 60 seconds (heartbeat is every 30s)
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString();

  const { data: presenceData, error: presenceError } = await supabaseAdmin
    .from("user_presence")
    .select("*")
    .eq("is_online", true)
    .gte("last_seen", cutoff)
    .order("last_seen", { ascending: false });

  if (presenceError) {
    return NextResponse.json({ error: presenceError.message }, { status: 500 });
  }

  if (!presenceData || presenceData.length === 0) {
    return NextResponse.json([]);
  }

  const userIds = (presenceData as PresenceRecord[]).map((p) => p.user_id);

  const { data: profilesData } = await supabaseAdmin
    .from("profiles")
    .select("user_id, first_name, last_name, profile_picture_url")
    .in("user_id", userIds);

  const profilesMap = new Map<string, ProfileRecord>();
  if (profilesData) {
    (profilesData as ProfileRecord[]).forEach((profile) => {
      profilesMap.set(profile.user_id, profile);
    });
  }

  const transformedData = (presenceData as PresenceRecord[]).map((u) => {
    const profile = profilesMap.get(u.user_id);
    return {
      id: u.id,
      user_id: u.user_id,
      email: u.email,
      last_seen: u.last_seen,
      is_online: u.is_online,
      first_name: profile?.first_name || null,
      last_name: profile?.last_name || null,
      profile_picture_url: profile?.profile_picture_url || null,
    };
  });

  return NextResponse.json(transformedData);
}
