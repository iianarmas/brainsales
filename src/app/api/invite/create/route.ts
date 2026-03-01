import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

/**
 * POST /api/invite/create
 *
 * Org admin or owner generates an invite token for their organization.
 * Returns the token and the full join URL.
 *
 * Body:
 *   email   string?   — optional; if set, only that email can accept the invite
 *   role    string    — 'member' or 'admin' (default: 'member')
 */
export async function POST(request: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: "Server not configured" },
                { status: 500 }
            );
        }

        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.replace("Bearer ", "");
        const {
            data: { user },
            error: authError,
        } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { email, role = "member" } = body as {
            email?: string;
            role?: "member" | "admin";
        };

        if (!["member", "admin"].includes(role)) {
            return NextResponse.json(
                { error: "Role must be 'member' or 'admin'" },
                { status: 400 }
            );
        }

        // Get caller's org membership (must be admin or owner)
        const { data: membership } = await supabaseAdmin
            .from("organization_members")
            .select("organization_id, role, organizations!inner(id, is_active, name, slug)")
            .eq("user_id", user.id)
            .in("role", ["admin", "owner"])
            .maybeSingle();

        if (!membership) {
            return NextResponse.json(
                { error: "You must be an org admin or owner to create invite links" },
                { status: 403 }
            );
        }

        if (role === "admin") {
            // Only allow if requester is Org Owner or Global Admin
            const { data: globalAdmin } = await supabaseAdmin
                .from("admins")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();

            if (!globalAdmin) {
                const { data: orgOwner } = await supabaseAdmin
                    .from("organization_members")
                    .select("role")
                    .eq("user_id", user.id)
                    .eq("organization_id", membership.organization_id)
                    .eq("role", "owner")
                    .maybeSingle();

                if (!orgOwner) {
                    return NextResponse.json(
                        { error: "Forbidden - Only organization owners can create admin invites" },
                        { status: 403 }
                    );
                }
            }
        }

        const org = (membership as any).organizations;

        if (!org?.is_active) {
            return NextResponse.json(
                { error: "Your workspace is pending approval and cannot invite members yet" },
                { status: 403 }
            );
        }

        // Create the invite token
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from("invite_tokens")
            .insert({
                organization_id: membership.organization_id,
                created_by: user.id,
                email: email?.toLowerCase().trim() || null,
                role,
            })
            .select("token, expires_at, email, role")
            .single();

        if (inviteError || !invite) {
            console.error("Failed to create invite token:", inviteError);
            return NextResponse.json(
                { error: "Failed to create invite link. Please try again." },
                { status: 500 }
            );
        }

        const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";

        return NextResponse.json({
            success: true,
            token: invite.token,
            joinUrl: `${baseUrl}/join/${invite.token}`,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expires_at,
            organizationName: org.name,
        });
    } catch (error) {
        console.error("Invite create error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
