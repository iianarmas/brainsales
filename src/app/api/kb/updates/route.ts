import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// Helper to get user's product IDs
async function getUserProductIds(userId: string): Promise<string[]> {
  const { data: productUsers } = await supabaseAdmin
    .from("product_users")
    .select("product_id")
    .eq("user_id", userId);

  return (productUsers || []).map((pu) => pu.product_id);
}

// Helper to verify user has access to the requested product (within any of their organizations)
async function verifyProductAccess(userId: string, productId: string): Promise<boolean> {
  // First check explicit assignment in product_users
  const { data: productAccess } = await supabaseAdmin
    .from("product_users")
    .select("role")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (productAccess) return true;

  // If no explicit assignment, check if user is admin/owner of the product's organization
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("organization_id")
    .eq("id", productId)
    .maybeSingle();

  if (!product) return false;

  const { data: orgMembership } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", product.organization_id)
    .in("role", ["admin", "owner"])
    .maybeSingle();

  return !!orgMembership;
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
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const from_date = searchParams.get("from_date");
    const to_date = searchParams.get("to_date");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    // Get product ID from header or use user's products
    const productIdHeader = request.headers.get("X-Product-Id");
    const userProductIds = await getUserProductIds(user.id);

    // Get user's organizations
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id);

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    if (!memberData || memberData.length === 0) {
      return NextResponse.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
    }

    const orgIds = memberData.map(m => m.organization_id);

    let query = supabaseAdmin
      .from("kb_updates")
      .select("*, kb_categories(*), kb_update_features(*), competitors(*)", { count: "exact" })
      .in("organization_id", orgIds)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by product (product_id is NOT NULL per migration 008)
    if (productIdHeader) {
      // Specific product requested - verify access
      const hasAccess = await verifyProductAccess(user.id, productIdHeader);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden - No access to this product" }, { status: 403 });
      }
      query = query.eq("product_id", productIdHeader);
    } else if (userProductIds.length > 0) {
      // Filter to user's products
      query = query.in("product_id", userProductIds);
    } else {
      // User has no products assigned, return empty (unless global admin)
      const { data: admin } = await supabaseAdmin.from("admins").select("id").eq("user_id", user.id).maybeSingle();
      if (!admin) {
        return NextResponse.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
    }

    if (category) {
      // Look up category_id from slug
      const { data: cat } = await supabaseAdmin.from("kb_categories").select("id").eq("slug", category).maybeSingle();
      if (cat) {
        query = query.eq("category_id", cat.id);
      } else {
        // If category requested but not found, return empty set (prevents falling back to "all updates")
        return NextResponse.json({
          data: [],
          pagination: { page, limit, total: 0, total_pages: 0 },
        });
      }
    }
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    if (from_date) query = query.gte("created_at", from_date);
    if (to_date) query = query.lte("created_at", to_date);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch acknowledgments for the current user
    const updateIds = (data || []).map((item: Record<string, unknown>) => item.id as string);
    let userAcks: Set<string> = new Set();
    if (updateIds.length > 0) {
      const { data: acks } = await supabaseAdmin
        .from("update_acknowledgments")
        .select("update_id")
        .eq("user_id", user.id)
        .in("update_id", updateIds);
      if (acks) {
        userAcks = new Set(acks.map((a: { update_id: string }) => a.update_id));
      }
    }

    // Map Supabase relation keys to frontend-expected keys
    const mapped = (data || []).map((item: Record<string, unknown>) => {
      const { kb_categories, kb_update_features, competitors, ...rest } = item;
      return {
        ...rest,
        category: kb_categories,
        features: kb_update_features,
        competitor: competitors,
        is_acknowledged: userAcks.has(item.id as string),
      };
    });

    return NextResponse.json({
      data: mapped,
      pagination: { page, limit, total: count, total_pages: Math.ceil((count || 0) / limit) },
    });
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

    // Get user's organization
    const { data: memberData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!memberData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { category_slug, title, content, summary, tags, version, status, priority, publish_at, features, metrics, product_id: bodyProductId, target_product_id, competitor_id } = body;

    if (!category_slug || !title || !content) {
      return NextResponse.json({ error: "category_slug, title, and content are required" }, { status: 400 });
    }

    // Get product_id from body, header, or user's default product
    let productId = target_product_id || bodyProductId || request.headers.get("X-Product-Id");
    if (!productId) {
      const userProductIds = await getUserProductIds(user.id);
      if (userProductIds.length > 0) {
        // Get user's default product
        const { data: defaultProduct } = await supabaseAdmin
          .from("product_users")
          .select("product_id")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .limit(1)
          .single();
        productId = defaultProduct?.product_id;
      }
    }

    // Get organization_id from product
    const { data: productData, error: productError } = await supabaseAdmin
      .from("products")
      .select("organization_id")
      .eq("id", productId)
      .single();

    if (productError || !productData) {
      return NextResponse.json({ error: "Invalid product or product access denied" }, { status: 400 });
    }

    const orgId = productData.organization_id;

    // Look up category_id from slug
    const { data: category, error: catError } = await supabaseAdmin
      .from("kb_categories")
      .select("id")
      .eq("slug", category_slug)
      .single();

    if (catError || !category) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const { data: update, error: insertError } = await supabaseAdmin
      .from("kb_updates")
      .insert({
        category_id: category.id,
        title,
        content,
        summary: summary || null,
        tags: tags || [],
        version: version || null,
        status: status || "draft",
        priority: priority || "medium",
        publish_at: publish_at || null,
        created_by: user.id,
        organization_id: orgId,
        product_id: productId || null,
        target_product_id: productId || null,
        competitor_id: competitor_id || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (features && features.length > 0) {
      const featureRows = features.map((f: Record<string, unknown>) => ({ update_id: update.id, ...f }));
      await supabaseAdmin.from("kb_update_features").insert(featureRows);
    }

    if (metrics && metrics.length > 0) {
      const metricRows = metrics.map((m: Record<string, unknown>) => ({ update_id: update.id, ...m }));
      await supabaseAdmin.from("kb_update_metrics").insert(metricRows);
    }

    // Note: Notifications are handled by the database trigger notify_kb_update_published
    // to avoid duplicate notifications

    return NextResponse.json({ data: update }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
