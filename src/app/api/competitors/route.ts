import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Helper to verify user has access to the requested product (within their organization)
async function verifyProductAccess(userId: string, productId: string): Promise<boolean> {
  const { data: memberData } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (!memberData) return false;

  const { data } = await supabaseAdmin
    .from("product_users")
    .select("role")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .single();

  if (!data) return false;

  // Ensure product belongs to user's organization
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("organization_id")
    .eq("id", productId)
    .single();

  return product?.organization_id === memberData.organization_id;
}

// Helper to verify user is admin for the product (within their organization)
async function verifyProductAdmin(userId: string, productId: string): Promise<boolean> {
  const { data: memberData } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (!memberData) return false;

  const { data } = await supabaseAdmin
    .from("product_users")
    .select("role")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .single();

  if (!data || (data.role !== "admin" && data.role !== "super_admin")) return false;

  // Ensure product belongs to user's organization
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("organization_id")
    .eq("id", productId)
    .single();

  return product?.organization_id === memberData.organization_id;
}

// Helper to get user's product IDs
async function getUserProductIds(userId: string): Promise<string[]> {
  const { data: productUsers } = await supabaseAdmin
    .from("product_users")
    .select("product_id")
    .eq("user_id", userId);

  return (productUsers || []).map((pu) => pu.product_id);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const search = searchParams.get("search");

    // Get user's organization
    const { data: memberData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!memberData) {
      return NextResponse.json({ data: [] });
    }

    // Get product ID from header or query param
    const productIdHeader = request.headers.get("X-Product-Id");
    const productIdParam = searchParams.get("product_id");
    const productId = productIdHeader || productIdParam;

    let query = supabaseAdmin
      .from("competitors")
      .select("*")
      .eq("status", status)
      .eq("organization_id", memberData.organization_id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (productId) {
      // Specific product requested - verify access
      const hasAccess = await verifyProductAccess(user.id, productId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden - No access to this product" }, { status: 403 });
      }
      query = query.eq("product_id", productId);
    } else {
      // Filter to user's products
      const userProductIds = await getUserProductIds(user.id);
      if (userProductIds.length === 0) {
        return NextResponse.json({ data: [] });
      } else {
        query = query.in("product_id", userProductIds);
      }
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      product_id,
      name,
      slug: providedSlug,
      logo_url,
      website,
      description,
      strengths,
      limitations,
      our_advantage,
      positioning,
      target_market,
      pricing_info,
    } = body;

    if (!product_id || !name) {
      return NextResponse.json({ error: "product_id and name are required" }, { status: 400 });
    }

    // Verify user is admin for this product
    const isProductAdmin = await verifyProductAdmin(user.id, product_id);
    if (!isProductAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Get user's organization
    const { data: memberData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!memberData) {
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    // Generate slug if not provided
    const slug = providedSlug || generateSlug(name);

    // Check for duplicate slug within the product
    const { data: existing } = await supabaseAdmin
      .from("competitors")
      .select("id")
      .eq("product_id", product_id)
      .eq("slug", slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: "A competitor with this name already exists for this product" }, { status: 400 });
    }

    const { data: competitor, error: insertError } = await supabaseAdmin
      .from("competitors")
      .insert({
        product_id,
        name,
        slug,
        logo_url: logo_url || null,
        website: website || null,
        description: description || null,
        strengths: strengths || [],
        limitations: limitations || [],
        our_advantage: our_advantage || null,
        positioning: positioning || null,
        target_market: target_market || null,
        pricing_info: pricing_info || null,
        created_by: user.id,
        organization_id: memberData.organization_id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: competitor }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
