import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { validatePhoneNumber } from "@/utils/phoneNumber";

/**
 * Auto-assign admin role based on organization membership.
 * Users with 'admin' or 'owner' role in any org get added to the admins table.
 */
async function autoAssignAdmin(userId: string) {
  if (!supabaseAdmin) return;

  // Check if user is an admin/owner in any organization
  const { data: orgMembership } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "owner"]);

  if (!orgMembership || orgMembership.length === 0) return;

  // Ensure they're in the admins table
  const { data: existingAdmin } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!existingAdmin) {
    await supabaseAdmin
      .from("admins")
      .insert({ user_id: userId })
      .select()
      .single();
  }
}

/**
 * Validate that a user belongs to an active organization.
 * Checks organization_members table instead of hardcoded domain lists.
 */
async function validateUserOrganization(userId: string, email: string | undefined): Promise<boolean> {
  if (!supabaseAdmin || !email) return false;

  // Check if user is already a member of any active org
  const { data: memberships } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, organizations!inner(is_active)")
    .eq("user_id", userId);

  if (memberships && memberships.some((m: any) => m.organizations?.is_active)) {
    return true;
  }

  // If not a member, check if their domain/email is allowed by any org
  const domain = email.toLowerCase().split("@")[1];
  const normalizedEmail = email.toLowerCase();

  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("id, allowed_domains, allowed_emails")
    .eq("is_active", true);

  if (!orgs) return false;

  const matchedOrg = orgs.find((org) => {
    const domainMatch = org.allowed_domains?.includes(domain);
    const emailMatch = org.allowed_emails?.includes(normalizedEmail);
    return domainMatch || emailMatch;
  });

  if (!matchedOrg) return false;

  // Auto-assign to matching org
  await supabaseAdmin.from("organization_members").insert({
    organization_id: matchedOrg.id,
    user_id: userId,
    role: "member",
  });

  return true;
}

interface ProfileUpdateData {
  first_name: string;
  last_name: string;
  company_email: string;
  company_phone_number: string;
  role: string;
  profile_picture_url?: string | null;
  zoom_link?: string | null;
}

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // Get the session from the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate organization membership (replaces hardcoded domain check)
    const isAuthorized = await validateUserOrganization(user.id, user.email);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized domain" }, { status: 403 });
    }

    // Fetch profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      // If profile doesn't exist, create one populated from Google metadata
      if (profileError.code === "PGRST116") {
        const metadata = user.user_metadata || {};
        const fullName = metadata.full_name || metadata.name || "";
        const nameParts = fullName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const { data: newProfile, error: createError } = await supabaseAdmin
          .from("profiles")
          .insert({
            user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            company_email: user.email || "",
            profile_picture_url: metadata.avatar_url || null,
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json(
            { error: "Failed to create profile" },
            { status: 500 }
          );
        }

        // Auto-assign admin role based on org membership
        await autoAssignAdmin(user.id);

        return NextResponse.json({ profile: newProfile });
      }

      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    // Auto-assign admin role based on org membership (on every login)
    await autoAssignAdmin(user.id);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    // Get the session from the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { first_name, last_name, company_email, company_phone_number, role, profile_picture_url, zoom_link } = body;

    // Validate required fields
    if (!first_name || !last_name || !company_email || !company_phone_number || role === undefined) {
      return NextResponse.json(
        { error: "First name, last name, company email, and phone number are required" },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!validatePhoneNumber(company_phone_number)) {
      return NextResponse.json(
        { error: "Phone number must be in format +1.XXX.XXX.XXXX" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(company_email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Update profile
    const updateData: ProfileUpdateData = {
      first_name,
      last_name,
      company_email,
      company_phone_number,
      role,
    };

    if (profile_picture_url !== undefined) {
      updateData.profile_picture_url = profile_picture_url;
    }

    if (zoom_link !== undefined) {
      updateData.zoom_link = zoom_link;
    }

    const { data: profile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
