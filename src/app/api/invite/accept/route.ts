import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

/**
 * POST /api/invite/accept
 *
 * Authenticated endpoint — called after the user signs in on the /join page.
 * Validates the token, adds the user to the org, and marks the token as used.
 *
 * Body: { token: string }
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

        const accessToken = authHeader.replace("Bearer ", "");
        const {
            data: { user },
            error: authError,
        } = await supabaseAdmin.auth.getUser(accessToken);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { token } = body as { token: string };

        if (!token) {
            return NextResponse.json({ error: "Token required" }, { status: 400 });
        }

        // Look up the invite (must be unused and not expired)
        const { data: invite, error: tokenError } = await supabaseAdmin
            .from("invite_tokens")
            .select("id, organization_id, email, role, expires_at, used_at, organizations!inner(is_active)")
            .eq("token", token)
            .maybeSingle();

        if (tokenError || !invite) {
            return NextResponse.json(
                { error: "Invite link is invalid or has already been used." },
                { status: 404 }
            );
        }

        // Check it hasn't been used
        if (invite.used_at) {
            return NextResponse.json(
                { error: "This invite link has already been used." },
                { status: 409 }
            );
        }

        // Check it hasn't expired
        if (new Date(invite.expires_at) < new Date()) {
            return NextResponse.json(
                { error: "This invite link has expired. Please request a new one." },
                { status: 410 }
            );
        }

        // Check org is active
        if (!(invite as any).organizations?.is_active) {
            return NextResponse.json(
                { error: "This workspace is pending approval and not yet active." },
                { status: 403 }
            );
        }

        // If invite is targeted to a specific email, verify it matches
        if (invite.email && invite.email !== user.email?.toLowerCase()) {
            return NextResponse.json(
                {
                    error: `This invite was sent to ${invite.email}. Please sign in with that email address.`,
                },
                { status: 403 }
            );
        }

        // Check user isn't already a member of this org
        const { data: existing } = await supabaseAdmin
            .from("organization_members")
            .select("user_id")
            .eq("user_id", user.id)
            .eq("organization_id", invite.organization_id)
            .maybeSingle();

        if (existing) {
            // Already a member — this is fine, just mark the token used and return success
            await supabaseAdmin
                .from("invite_tokens")
                .update({ used_at: new Date().toISOString(), used_by: user.id })
                .eq("id", invite.id);

            return NextResponse.json({
                success: true,
                organizationId: invite.organization_id,
                alreadyMember: true,
            });
        }

        // Add to org
        const { error: memberError } = await supabaseAdmin
            .from("organization_members")
            .insert({
                organization_id: invite.organization_id,
                user_id: user.id,
                role: invite.role,
            });

        if (memberError) {
            console.error("Failed to add member:", memberError);
            return NextResponse.json(
                { error: "Failed to join workspace. Please try again." },
                { status: 500 }
            );
        }

        // Mark token as used
        await supabaseAdmin
            .from("invite_tokens")
            .update({ used_at: new Date().toISOString(), used_by: user.id })
            .eq("id", invite.id);

        return NextResponse.json({
            success: true,
            organizationId: invite.organization_id,
        });
    } catch (error) {
        console.error("Invite accept error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
