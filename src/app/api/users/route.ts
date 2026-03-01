import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// GET /api/users - Get users scoped by organization/product (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");
    const orgId = searchParams.get("org_id");

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

    // Check if user is admin
    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const { data: superAdminData } = await supabaseAdmin
      .from("product_users")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .limit(1)
      .single();

    if (!adminData && !superAdminData) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    let targetOrgId = orgId;

    // If product_id is provided, get its organization_id
    if (productId && !targetOrgId) {
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("organization_id")
        .eq("id", productId)
        .single();
      if (product) {
        targetOrgId = product.organization_id;
      }
    }

    let query = supabaseAdmin
      .from("profiles")
      .select("user_id, first_name, last_name, company_email, created_at")
      .order("first_name", { ascending: true });

    // Filter by organization if specified
    if (targetOrgId) {
      const { data: memberIds } = await supabaseAdmin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", targetOrgId);

      if (memberIds) {
        query = query.in("user_id", memberIds.map(m => m.user_id));
      }
    }

    const { data: profiles, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (profiles || []).map((p) => ({
      user_id: p.user_id,
      full_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
      email: p.company_email || null,
      created_at: p.created_at,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
