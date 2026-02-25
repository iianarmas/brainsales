import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

/**
 * GET /api/invite/[token]
 *
 * Public endpoint — no auth required.
 * Returns invite metadata so the /join/[token] page can display details
 * (org name, invited email, expiry) before the user signs in.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: "Server not configured" },
                { status: 500 }
            );
        }

        const { token } = await params;
        if (!token) {
            return NextResponse.json({ error: "Token required" }, { status: 400 });
        }

        const { data: invite, error } = await supabaseAdmin
            .from("active_invite_tokens")  // Uses the view — filters expired/used
            .select("organization_name, organization_slug, email, role, expires_at")
            .eq("token", token)
            .maybeSingle();

        if (error || !invite) {
            return NextResponse.json(
                { error: "Invite link is invalid or has expired." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            valid: true,
            organizationName: invite.organization_name,
            organizationSlug: invite.organization_slug,
            email: invite.email,      // null = open invite, string = targeted
            role: invite.role,
            expiresAt: invite.expires_at,
        });
    } catch (error) {
        console.error("Invite lookup error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
