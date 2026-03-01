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

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("kb_updates")
      .select("target_product_id, organization_id")
      .eq("id", id)
      .single();

    if (updateError || !updateData) {
      return NextResponse.json({ error: "Update not found" }, { status: 404 });
    }

    const { data: acknowledgments, error } = await supabaseAdmin
      .from("update_acknowledgments")
      .select("*")
      .eq("update_id", id)
      .order("acknowledged_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get relevant users based on update scoping
    let relevantUserIds: string[] = [];
    if (updateData.target_product_id) {
      // Product-specific update
      const { data: productUsers } = await supabaseAdmin
        .from("product_users")
        .select("user_id")
        .eq("product_id", updateData.target_product_id);
      relevantUserIds = (productUsers || []).map(pu => pu.user_id);
    } else if (updateData.organization_id) {
      // Organization-wide update
      const { data: orgMembers } = await supabaseAdmin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", updateData.organization_id);
      relevantUserIds = (orgMembers || []).map(om => om.user_id);
    } else {
      // Global fallback (should probably not happen in newer versions)
      const { data: allProfiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id");
      relevantUserIds = (allProfiles || []).map(p => p.user_id);
    }

    const totalUsers = relevantUserIds.length;

    // Enrich acknowledgments with user info (name and email)
    const enrichedAcknowledged: EnrichedAckUser[] = await Promise.all(
      (acknowledgments || [])
        .filter((ack: Acknowledgment) => relevantUserIds.includes(ack.user_id))
        .map(async (ack: Acknowledgment) => {
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

    // Get pending users (those who haven't acknowledged)
    const pendingUsers: EnrichedAckUser[] = await Promise.all(
      relevantUserIds
        .filter((userId: string) => !acknowledgedUserIds.has(userId))
        .map(async (userId: string) => {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", userId)
            .single();

          const displayName = profile
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : null;

          return {
            user_id: userId,
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
        acknowledged_count: enrichedAcknowledged.length,
        total_users: totalUsers || 0,
        acknowledgment_rate: totalUsers ? (enrichedAcknowledged.length / totalUsers * 100).toFixed(1) : 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
