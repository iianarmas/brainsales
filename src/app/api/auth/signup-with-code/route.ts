import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { validatePhoneNumber } from "@/utils/phoneNumber";

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const { email, password, inviteCode, firstName, lastName, companyEmail, companyPhone } = await request.json();

    if (!email || !password || !inviteCode) {
      return NextResponse.json(
        { error: "Email, password, and invite code are required" },
        { status: 400 }
      );
    }

    // Validate profile fields
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }

    // Validate phone number format (if provided)
    if (companyPhone && !validatePhoneNumber(companyPhone)) {
      return NextResponse.json(
        { error: "Phone number must be in format +1.XXX.XXX.XXXX" },
        { status: 400 }
      );
    }

    // Validate company email format (if provided)
    if (companyEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(companyEmail)) {
        return NextResponse.json(
          { error: "Invalid company email format" },
          { status: 400 }
        );
      }
    }

    // Validate invite code
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "invite_code")
      .single();

    if (settingsError || !settings) {
      console.error("Failed to fetch invite code:", settingsError);
      return NextResponse.json(
        { error: "Unable to validate invite code" },
        { status: 500 }
      );
    }

    // Compare invite codes (case-insensitive)
    if (inviteCode.toUpperCase() !== settings.value.toUpperCase()) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 403 }
      );
    }

    // Create the user using Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for simplicity
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create profile with user data
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: data.user.id,
        first_name: firstName,
        last_name: lastName,
        company_email: companyEmail,
        company_phone_number: companyPhone
      });

    if (profileError) {
      console.error("Failed to create profile:", profileError);
      // Don't fail signup if profile creation fails, but log the error
    }

    return NextResponse.json({
      success: true,
      message: "Account created successfully! You can now sign in.",
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
