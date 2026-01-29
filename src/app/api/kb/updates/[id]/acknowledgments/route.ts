import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

interface Acknowledgment {
  id: string;
  update_id: string;
  user_id: string;
  acknowledged_at: string;
}

interface EnrichedAckUser {
  user_id: string;
  email: string | null;
  display_name: string | null;
  acknowledged_at: string;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminData } = await supabaseAdmin.from("admins").select("id").eq("user_id", user.id).single();
    if (!adminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: acknowledgments, error } = await supabaseAdmin
      .from("update_acknowledgments")
      .select("*")
      .eq("update_id", id)
      .order("acknowledged_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get total user count
    const { count: totalUsers } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Enrich acknowledgments with user info (name and email)
    const enrichedAcknowledged: EnrichedAckUser[] = await Promise.all(
      (acknowledgments || []).map(async (ack: Acknowledgment) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(ack.user_id);
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", ack.user_id)
          .single();

        const displayName = profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : null;

        return {
          user_id: ack.user_id,
          email: userData?.user?.email || null,
          display_name: displayName,
          acknowledged_at: ack.acknowledged_at,
        };
      })
    );

    // Get all users who haven't acknowledged yet
    const acknowledgedUserIds = new Set((acknowledgments || []).map((a: Acknowledgment) => a.user_id));

    // Get all user profiles
    const { data: allProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, first_name, last_name");

    // Get pending users (those who haven't acknowledged)
    const pendingUsers: EnrichedAckUser[] = await Promise.all(
      (allProfiles || [])
        .filter((p: { user_id: string }) => !acknowledgedUserIds.has(p.user_id))
        .map(async (profile: { user_id: string; first_name?: string; last_name?: string }) => {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
          const displayName = profile
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : null;

          return {
            user_id: profile.user_id,
            email: userData?.user?.email || null,
            display_name: displayName,
            acknowledged_at: '',
          };
        })
    );

    return NextResponse.json({
      acknowledged: enrichedAcknowledged,
      pending: pendingUsers,
      stats: {
        acknowledged_count: acknowledgments?.length || 0,
        total_users: totalUsers || 0,
        acknowledgment_rate: totalUsers ? ((acknowledgments?.length || 0) / totalUsers * 100).toFixed(1) : 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
