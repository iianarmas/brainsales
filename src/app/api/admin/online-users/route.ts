import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

interface PresenceRecord {
  id: string;
  user_id: string;
  email: string;
  last_seen: string;
  is_online: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileRecord {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
}

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

  // Get users who were online in the last 60 seconds (heartbeat is every 30s)
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString();

  const { data: presenceData, error: presenceError } = await supabaseAdmin
    .from("user_presence")
    .select("*")
    .eq("is_online", true)
    .eq("organization_id", orgId)
    .gte("last_seen", cutoff)
    .order("last_seen", { ascending: false });

  if (presenceError) {
    return NextResponse.json({ error: presenceError.message }, { status: 500 });
  }

  if (!presenceData || presenceData.length === 0) {
    return NextResponse.json([]);
  }

  // Get user IDs
  const userIds = (presenceData as PresenceRecord[]).map((p) => p.user_id);

  // Fetch profiles for these users
  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("user_id, first_name, last_name, profile_picture_url")
    .in("user_id", userIds);

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    // Continue without profile data
  }

  // Create a map of user_id to profile
  const profilesMap = new Map<string, ProfileRecord>();
  if (profilesData) {
    (profilesData as ProfileRecord[]).forEach((profile) => {
      profilesMap.set(profile.user_id, profile);
    });
  }

  // Merge presence data with profile data
  const transformedData = (presenceData as PresenceRecord[]).map((user) => {
    const profile = profilesMap.get(user.user_id);
    return {
      ...user,
      profiles: profile ? {
        first_name: profile.first_name,
        last_name: profile.last_name,
        profile_picture_url: profile.profile_picture_url,
      } : null,
      // Keep legacy fields for compatibility if needed, but nesting is better for our new UI
      first_name: profile?.first_name || null,
      last_name: profile?.last_name || null,
    };
  });

  return NextResponse.json(transformedData);
}
