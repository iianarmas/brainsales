import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// GET /api/products/[id]/users - Get users for a product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if user is admin of this product
    const { data: productUser } = await supabaseAdmin
      .from("product_users")
      .select("role")
      .eq("product_id", id)
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .single();

    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!productUser && !adminData) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Get product users (without profile join to avoid column issues)
    const { data: users, error } = await supabaseAdmin
      .from("product_users")
      .select(`
        product_id,
        user_id,
        role,
        is_default,
        joined_at
      `)
      .eq("product_id", id)
      .order("joined_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch profile info from profiles table
    const userIds = (users || []).map((u) => u.user_id);
    let profileMap = new Map();

    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, first_name, last_name, company_email")
        .in("user_id", userIds);

      profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    }

    const enrichedUsers = (users || []).map((u) => {
      const profile = profileMap.get(u.user_id);
      return {
        ...u,
        profiles: profile ? {
          full_name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null,
          email: profile.company_email || null,
        } : null,
      };
    });

    return NextResponse.json({ users: enrichedUsers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/users - Add user to product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if user is admin of this product
    const { data: productUser } = await supabaseAdmin
      .from("product_users")
      .select("role")
      .eq("product_id", id)
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .single();

    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!productUser && !adminData) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_id, role = "user" } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }

    // Check if user already exists in product
    const { data: existing } = await supabaseAdmin
      .from("product_users")
      .select("product_id")
      .eq("product_id", id)
      .eq("user_id", user_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "User already belongs to this product" },
        { status: 400 }
      );
    }

    // Add user to product
    const { data: newUser, error } = await supabaseAdmin
      .from("product_users")
      .insert({
        product_id: id,
        user_id,
        role,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id]/users - Update user role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if user is admin of this product
    const { data: productUser } = await supabaseAdmin
      .from("product_users")
      .select("role")
      .eq("product_id", id)
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .single();

    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!productUser && !adminData) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id || !role) {
      return NextResponse.json(
        { error: "user_id and role are required" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from("product_users")
      .update({ role })
      .eq("product_id", id)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id]/users - Remove user from product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if user is admin of this product
    const { data: productUser } = await supabaseAdmin
      .from("product_users")
      .select("role")
      .eq("product_id", id)
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .single();

    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!productUser && !adminData) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id query param is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("product_users")
      .delete()
      .eq("product_id", id)
      .eq("user_id", user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
