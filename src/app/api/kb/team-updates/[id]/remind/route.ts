import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

        // Check if user is admin
        const { data: adminData, error: adminError } = await supabaseAdmin
            .from("admins")
            .select("id")
            .eq("user_id", user.id)
            .single();

        if (adminError || !adminData) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Get the team update details
        const { data: updateData, error: updateError } = await supabaseAdmin
            .from("team_updates")
            .select("title, team_id")
            .eq("id", id)
            .single();

        if (updateError || !updateData) {
            return NextResponse.json({ error: "Update not found" }, { status: 404 });
        }

        // Get already acknowledged user IDs
        const { data: acknowledged, error: ackError } = await supabaseAdmin
            .from("team_update_acknowledgments")
            .select("user_id")
            .eq("team_update_id", id);

        if (ackError) {
            return NextResponse.json({ error: ackError.message }, { status: 500 });
        }

        const acknowledgedUserIds = new Set((acknowledged || []).map(a => a.user_id));

        // Get all members of the team
        const { data: teamMembers, error: memberError } = await supabaseAdmin
            .from("team_members")
            .select("user_id")
            .eq("team_id", updateData.team_id);

        if (memberError) {
            return NextResponse.json({ error: memberError.message }, { status: 500 });
        }

        // Filter for pending users (team members who haven't acknowledged)
        const pendingUserIds = (teamMembers || [])
            .filter(m => !acknowledgedUserIds.has(m.user_id))
            .map(m => m.user_id);

        if (pendingUserIds.length === 0) {
            return NextResponse.json({ message: "No pending team members to remind" });
        }

        // Create notifications for all pending team members
        const notifications = pendingUserIds.map(userId => ({
            user_id: userId,
            type: "reminder",
            title: "Team Update Acknowledgment Reminder",
            message: `Please acknowledge the team update: ${updateData.title}`,
            reference_type: "team_update",
            reference_id: id,
            is_read: false
        }));

        const { error: notifyError } = await supabaseAdmin
            .from("notifications")
            .insert(notifications);

        if (notifyError) {
            return NextResponse.json({ error: notifyError.message }, { status: 500 });
        }

        return NextResponse.json({
            message: `Reminders sent to ${pendingUserIds.length} team members`,
            count: pendingUserIds.length
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
