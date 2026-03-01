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

        // Get the update details
        const { data: updateData, error: updateError } = await supabaseAdmin
            .from("kb_updates")
            .select("title, target_product_id, organization_id")
            .eq("id", id)
            .single();

        if (updateError || !updateData) {
            return NextResponse.json({ error: "Update not found" }, { status: 404 });
        }

        // Get already acknowledged user IDs
        const { data: acknowledged, error: ackError } = await supabaseAdmin
            .from("update_acknowledgments")
            .select("user_id")
            .eq("update_id", id);

        if (ackError) {
            return NextResponse.json({ error: ackError.message }, { status: 500 });
        }

        const acknowledgedUserIds = new Set((acknowledged || []).map(a => a.user_id));

        // Get relevant users based on update scoping
        let relevantUserIds: string[] = [];
        if (updateData.target_product_id) {
            const { data: productUsers } = await supabaseAdmin
                .from("product_users")
                .select("user_id")
                .eq("product_id", updateData.target_product_id);
            relevantUserIds = (productUsers || []).map(pu => pu.user_id);
        } else if (updateData.organization_id) {
            const { data: orgMembers } = await supabaseAdmin
                .from("organization_members")
                .select("user_id")
                .eq("organization_id", updateData.organization_id);
            relevantUserIds = (orgMembers || []).map(om => om.user_id);
        } else {
            const { data: allProfiles } = await supabaseAdmin
                .from("profiles")
                .select("user_id");
            relevantUserIds = (allProfiles || []).map(p => p.user_id);
        }

        // Filter for pending users
        const pendingUserIds = relevantUserIds.filter(userId => !acknowledgedUserIds.has(userId));

        if (pendingUserIds.length === 0) {
            return NextResponse.json({ message: "No pending users to remind" });
        }

        // Create notifications for all pending users
        const notifications = pendingUserIds.map(userId => ({
            user_id: userId,
            type: "reminder",
            title: "Update Acknowledgment Reminder",
            message: `Please acknowledge the update: ${updateData.title}`,
            reference_type: "kb_update",
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
            message: `Reminders sent to ${pendingUserIds.length} users`,
            count: pendingUserIds.length
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
