import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { isGenericEmailDomain } from "@/lib/genericEmailDomains";
import { getOrgFeatures } from "@/app/lib/orgFeatures";

/**
 * POST /api/auth/validate
 *
 * Three possible outcomes:
 *  1. { valid: true, organizationId }          — active member, allow in
 *  2. { valid: false, reason: 'pending_approval' } — org exists but awaits admin approval
 *  3. { valid: false, reason: 'no_org' }       — no matching org; redirect to /register
 *
 * Domain-match orgs auto-assign the user as a member on first sign-in.
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
      return NextResponse.json({ valid: false, reason: "no_org" });
    }

    // 0. Superadmins bypass all org membership logic
    const { data: superAdmin } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (superAdmin) {
      return NextResponse.json({ valid: true, isSuperAdmin: true });
    }

    // 1. Check if user is already a member of any org (active or pending)
    const { data: existingMemberships } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, organizations!inner(id, is_active)")
      .eq("user_id", user.id);

    const activeMembership = existingMemberships?.find(
      (m: any) => m.organizations?.is_active
    );

    if (activeMembership) {
      const features = await getOrgFeatures(activeMembership.organization_id);
      return NextResponse.json({
        valid: true,
        organizationId: activeMembership.organization_id,
        features,
      });
    }

    // Member exists but their org is pending approval
    const pendingMembership = existingMemberships?.find(
      (m: any) => !m.organizations?.is_active
    );

    if (pendingMembership) {
      return NextResponse.json({
        valid: false,
        reason: "pending_approval",
        organizationId: pendingMembership.organization_id,
      });
    }

    // 2. No membership — check if any active org's domain/email whitelist matches
    const { data: orgs } = await supabaseAdmin
      .from("organizations")
      .select("id, allowed_domains, allowed_emails")
      .eq("is_active", true);

    if (orgs && orgs.length > 0) {
      const matchedOrg = orgs.find((org) => {
        const domainMatch =
          org.allowed_domains?.includes(domain) &&
          !isGenericEmailDomain(domain); // safety: never match on gmail.com etc.
        const emailMatch = org.allowed_emails?.includes(email);
        return domainMatch || emailMatch;
      });

      if (matchedOrg) {
        // Auto-assign user to the domain-matched org as a regular member
        await supabaseAdmin.from("organization_members").insert({
          organization_id: matchedOrg.id,
          user_id: user.id,
          role: "member",
        });

        const features = await getOrgFeatures(matchedOrg.id);
        return NextResponse.json({
          valid: true,
          organizationId: matchedOrg.id,
          features,
        });
      }
    }

    // 3. No org found at all — send them to /register or /join
    return NextResponse.json({
      valid: false,
      reason: "no_org",
    });
  } catch (error) {
    console.error("Auth validate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
