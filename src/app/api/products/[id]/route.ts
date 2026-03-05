import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts either a UUID or a slug and returns the product's UUID. */
async function resolveProductId(idOrSlug: string): Promise<string | null> {
  if (UUID_REGEX.test(idOrSlug)) return idOrSlug;
  const { data } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("slug", idOrSlug)
    .single();
  return data?.id ?? null;
}

// GET /api/products/[id] - Get single product details (accepts UUID or slug)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idOrSlug } = await params;
    const id = await resolveProductId(idOrSlug);
    if (!id) return NextResponse.json({ error: "Product not found" }, { status: 404 });
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

    // Check if user has access to this product
    const { data: productUser } = await supabaseAdmin
      .from("product_users")
      .select("role, is_default")
      .eq("product_id", id)
      .eq("user_id", user.id)
      .single();

    // Also check if user is global admin
    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!productUser && !adminData) {
      return NextResponse.json(
        { error: "Forbidden - No access to this product" },
        { status: 403 }
      );
    }

    // Get product details
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if user is org admin/owner of the product's organization
    const { data: orgMember } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", product.organization_id)
      .eq("user_id", user.id)
      .single();

    let effectiveRole = productUser?.role || "user";
    if (adminData) effectiveRole = "super_admin";
    else if (orgMember?.role === "owner") effectiveRole = "super_admin";
    else if (orgMember?.role === "admin" && effectiveRole === "user") effectiveRole = "admin";

    return NextResponse.json({
      product: {
        ...product,
        role: effectiveRole,
        is_default: productUser?.is_default || false,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Update product (admin only, accepts UUID or slug)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idOrSlug } = await params;
    const id = await resolveProductId(idOrSlug);
    if (!id) return NextResponse.json({ error: "Product not found" }, { status: 404 });
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
    const { name, description, logo_url, is_active } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data: product, error } = await supabaseAdmin
      .from("products")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Delete product (super_admin only, accepts UUID or slug)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idOrSlug } = await params;
    const id = await resolveProductId(idOrSlug);
    if (!id) return NextResponse.json({ error: "Product not found" }, { status: 404 });
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

    // Get product details to find its organization
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("organization_id, name")
      .eq("id", id)
      .single();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if user is super_admin of this product
    const { data: productUser } = await supabaseAdmin
      .from("product_users")
      .select("role")
      .eq("product_id", id)
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    // Check if user is global admin
    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    // Check if user is org owner
    const { data: orgMember } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", product.organization_id)
      .eq("user_id", user.id)
      .eq("role", "owner")
      .single();

    if (!productUser && !adminData && !orgMember) {
      return NextResponse.json(
        { error: "Forbidden - Super admin or Owner access required" },
        { status: 403 }
      );
    }

    if (product) {
      // First try by product_id (preferred)
      const { data: teamById } = await supabaseAdmin
        .from("teams")
        .select("id")
        .eq("product_id", id)
        .maybeSingle();

      const teamDeleteId = teamById?.id;

      if (teamDeleteId) {
        await supabaseAdmin.from("teams").delete().eq("id", teamDeleteId);
      } else {
        // Fallback to name match for legacy data
        await supabaseAdmin.from("teams").delete().eq("name", product.name);
      }
    }

    // 2. Delete the product (cascade will handle call_nodes, kb_updates, etc. after migration)
    const { error } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", id);

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
