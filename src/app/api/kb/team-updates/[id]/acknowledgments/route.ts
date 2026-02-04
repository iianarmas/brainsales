import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

interface Acknowledgment {
    id: string;
    team_update_id: string;
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

        // Get the team update to find the associated team_id
        const { data: updateData, error: updateError } = await supabaseAdmin
            .from("team_updates")
            .select("team_id")
            .eq("id", id)
            .single();

        if (updateError || !updateData) {
            return NextResponse.json({ error: "Update not found" }, { status: 404 });
        }

        const { data: acknowledgments, error } = await supabaseAdmin
            .from("team_update_acknowledgments")
            .select("*")
            .eq("team_update_id", id)
            .order("acknowledged_at", { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Enrichment function for users
        const enrichUser = async (userId: string, acknowledgedAt: string = ""): Promise<EnrichedAckUser> => {
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
                acknowledged_at: acknowledgedAt,
            };
        };

        // Enrich acknowledgments
        const enrichedAcknowledged: EnrichedAckUser[] = await Promise.all(
            (acknowledgments || []).map((ack: Acknowledgment) => enrichUser(ack.user_id, ack.acknowledged_at))
        );

        const acknowledgedUserIds = new Set((acknowledgments || []).map((a: Acknowledgment) => a.user_id));

        // Get all members of the team
        const { data: teamMembers, error: memberError } = await supabaseAdmin
            .from("team_members")
            .select("user_id")
            .eq("team_id", updateData.team_id);

        if (memberError) {
            return NextResponse.json({ error: memberError.message }, { status: 500 });
        }

        // Get pending users (team members who haven't acknowledged)
        const pendingUsers: EnrichedAckUser[] = await Promise.all(
            (teamMembers || [])
                .filter((m: { user_id: string }) => !acknowledgedUserIds.has(m.user_id))
                .map((m: { user_id: string }) => enrichUser(m.user_id))
        );

        const totalTeamMembers = (teamMembers || []).length;

        return NextResponse.json({
            acknowledged: enrichedAcknowledged,
            pending: pendingUsers,
            stats: {
                acknowledged_count: acknowledgments?.length || 0,
                total_users: totalTeamMembers,
                acknowledgment_rate: totalTeamMembers ? ((acknowledgments?.length || 0) / totalTeamMembers * 100).toFixed(1) : 0,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
