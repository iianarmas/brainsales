import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// GET /api/products - List user's products with roles
export async function GET(request: NextRequest) {
  try {
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

    // Get user's product memberships
    const { data: productUsers, error: puError } = await supabaseAdmin
      .from("product_users")
      .select("product_id, role, is_default, joined_at")
      .eq("user_id", user.id);

    if (puError) {
      return NextResponse.json({ error: puError.message }, { status: 500 });
    }

    // Identify the "calculated default" product ID
    let calculatedDefaultId: string | null = null;
    if (productUsers && productUsers.length > 0) {
      // 1. Check for explicit default
      const explicitDefault = productUsers.find((pu) => pu.is_default);
      if (explicitDefault) {
        calculatedDefaultId = explicitDefault.product_id;
      } else {
        // 2. Use the first product they were assigned to (earliest joined_at)
        const sortedMemberships = [...productUsers].sort(
          (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
        );
        calculatedDefaultId = sortedMemberships[0].product_id;
      }
    }

    // Build a map of user's membership roles
    const membershipMap = new Map(
      (productUsers || []).map((pu) => [pu.product_id, pu])
    );

    // Fetch ALL active products so all users can view any product's scripts
    const { data: allProducts, error: prodError } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (prodError) {
      return NextResponse.json({ error: prodError.message }, { status: 500 });
    }

    if (!allProducts || allProducts.length === 0) {
      return NextResponse.json({ products: [] });
    }

    // If no calculated default yet (user not assigned to any product), use the very first product on the list
    if (!calculatedDefaultId && allProducts.length > 0) {
      calculatedDefaultId = allProducts[0].id;
    }

    // Merge product data with user roles - assigned products get their actual role,
    // other products get "viewer" role so users can browse their scripts
    const products = allProducts.map((product) => {
      const membership = membershipMap.get(product.id);
      return {
        ...product,
        role: membership?.role || "viewer",
        is_default: product.id === calculatedDefaultId,
      };
    });

    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/products - Create a new product (super_admin only)
export async function POST(request: NextRequest) {
  try {
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

    // Check if user is super_admin or global admin
    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const { data: superAdminData } = await supabaseAdmin
      .from("product_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (!adminData && !superAdminData) {
      return NextResponse.json(
        { error: "Forbidden - Super admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, slug, description, logo_url } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "name and slug are required" },
        { status: 400 }
      );
    }

    // Check if slug is unique
    const { data: existing } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "A product with this slug already exists" },
        { status: 400 }
      );
    }

    // Create the product
    const { data: product, error: insertError } = await supabaseAdmin
      .from("products")
      .insert({
        name,
        slug,
        description: description || null,
        logo_url: logo_url || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Add creator as super_admin of the new product
    await supabaseAdmin.from("product_users").insert({
      product_id: product.id,
      user_id: user.id,
      role: "super_admin",
      is_default: false,
    });

    // Auto-create a default opening node for the new product
    const openingNodeId = `opening_${slug.replace(/-/g, "_")}`;
    await supabaseAdmin.from("call_nodes").insert({
      id: openingNodeId,
      type: "opening",
      title: `Welcome to ${name}`,
      script: `Welcome to ${name}. This is the opening script for this product.`,
      context: null,
      metadata: null,
      position_x: 250,
      position_y: 100,
      topic_group_id: "opening",
      product_id: product.id,
      is_active: true,
      created_by: user.id,
      updated_by: user.id,
    });

    // Auto-create a corresponding team for the new product
    await supabaseAdmin.from("teams").insert({
      name: name,
      description: `Default team for ${name} product`,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
