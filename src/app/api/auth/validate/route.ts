import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

/**
 * POST /api/auth/validate
 * Validates that a user's email domain is authorized by at least one organization.
 * Called by AuthContext on login to replace hardcoded domain checks.
 *
 * If the user isn't yet a member of any org but their email/domain matches
 * an org's allowed list, they are auto-assigned as a member.
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

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.email.toLowerCase();
    const domain = email.split("@")[1];

    if (!domain) {
      return NextResponse.json({ valid: false, reason: "Invalid email format" });
    }

    // Check if user is already a member of any active org
    const { data: existingMemberships } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, organizations!inner(id, is_active)")
      .eq("user_id", user.id);

    const activeMembership = existingMemberships?.find(
      (m: any) => m.organizations?.is_active
    );

    if (activeMembership) {
      return NextResponse.json({
        valid: true,
        organizationId: activeMembership.organization_id,
      });
    }

    // No existing membership - check if any org allows this email/domain
    const { data: orgs } = await supabaseAdmin
      .from("organizations")
      .select("id, allowed_domains, allowed_emails")
      .eq("is_active", true);

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({
        valid: false,
        reason: "No organizations configured",
      });
    }

    const matchedOrg = orgs.find((org) => {
      const domainMatch = org.allowed_domains?.includes(domain);
      const emailMatch = org.allowed_emails?.includes(email);
      return domainMatch || emailMatch;
    });

    if (!matchedOrg) {
      return NextResponse.json({
        valid: false,
        reason: "Your email domain is not authorized for any organization",
      });
    }

    // Auto-assign user to the matched org
    await supabaseAdmin.from("organization_members").insert({
      organization_id: matchedOrg.id,
      user_id: user.id,
      role: "member",
    });

    return NextResponse.json({
      valid: true,
      organizationId: matchedOrg.id,
    });
  } catch (error) {
    console.error("Auth validate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
