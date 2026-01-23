import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { validatePhoneNumber } from "@/utils/phoneNumber";

interface ProfileUpdateData {
  first_name: string;
  last_name: string;
  company_email: string;
  company_phone_number: string;
  profile_picture_url?: string | null;
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

    // Fetch profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      // If profile doesn't exist, create an empty one
      if (profileError.code === "PGRST116") {
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from("profiles")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) {
          return NextResponse.json(
            { error: "Failed to create profile" },
            { status: 500 }
          );
        }

        return NextResponse.json({ profile: newProfile });
      }

      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

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
    const { first_name, last_name, company_email, company_phone_number, profile_picture_url } = body;

    // Validate required fields
    if (!first_name || !last_name || !company_email || !company_phone_number) {
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
    };

    if (profile_picture_url !== undefined) {
      updateData.profile_picture_url = profile_picture_url;
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
