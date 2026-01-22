import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const { email, password, inviteCode } = await request.json();

    if (!email || !password || !inviteCode) {
      return NextResponse.json(
        { error: "Email, password, and invite code are required" },
        { status: 400 }
      );
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
