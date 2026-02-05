import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// Helper to verify user has access to the competitor's product
async function verifyCompetitorAccess(userId: string, competitorId: string): Promise<{ hasAccess: boolean; productId?: string }> {
  // Get the competitor to find its product_id
  const { data: competitor } = await supabaseAdmin
    .from("competitors")
    .select("product_id")
    .eq("id", competitorId)
    .single();

  if (!competitor) {
    return { hasAccess: false };
  }

  // Check if user has access to the product
  const { data: productUser } = await supabaseAdmin
    .from("product_users")
    .select("role")
    .eq("user_id", userId)
    .eq("product_id", competitor.product_id)
    .single();

  if (productUser) {
    return { hasAccess: true, productId: competitor.product_id };
  }

  // Check if user is global admin
  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .single();

  return { hasAccess: !!admin, productId: competitor.product_id };
}

// Helper to verify user is admin for the competitor's product
async function verifyCompetitorAdmin(userId: string, competitorId: string): Promise<{ isAdmin: boolean; productId?: string }> {
  // Get the competitor to find its product_id
  const { data: competitor } = await supabaseAdmin
    .from("competitors")
    .select("product_id")
    .eq("id", competitorId)
    .single();

  if (!competitor) {
    return { isAdmin: false };
  }

  // Check if user is admin for the product
  const { data: productUser } = await supabaseAdmin
    .from("product_users")
    .select("role")
    .eq("user_id", userId)
    .eq("product_id", competitor.product_id)
    .single();

  if (productUser && (productUser.role === "admin" || productUser.role === "super_admin")) {
    return { isAdmin: true, productId: competitor.product_id };
  }

  // Check if user is global admin
  const { data: admin } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .single();

  return { isAdmin: !!admin, productId: competitor.product_id };
}

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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify access
    const { hasAccess } = await verifyCompetitorAccess(user.id, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: competitor, error } = await supabaseAdmin
      .from("competitors")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    return NextResponse.json({ data: competitor });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin access
    const { isAdmin } = await verifyCompetitorAdmin(user.id, id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      slug,
      logo_url,
      website,
      description,
      strengths,
      limitations,
      our_advantage,
      positioning,
      target_market,
      pricing_info,
      status,
      sort_order,
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (logo_url !== undefined) updateData.logo_url = logo_url || null;
    if (website !== undefined) updateData.website = website || null;
    if (description !== undefined) updateData.description = description || null;
    if (strengths !== undefined) updateData.strengths = strengths || [];
    if (limitations !== undefined) updateData.limitations = limitations || [];
    if (our_advantage !== undefined) updateData.our_advantage = our_advantage || null;
    if (positioning !== undefined) updateData.positioning = positioning || null;
    if (target_market !== undefined) updateData.target_market = target_market || null;
    if (pricing_info !== undefined) updateData.pricing_info = pricing_info || null;
    if (status !== undefined) updateData.status = status;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: competitor, error: updateError } = await supabaseAdmin
      .from("competitors")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: competitor });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}

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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin access
    const { isAdmin } = await verifyCompetitorAdmin(user.id, id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Soft delete by setting status to archived
    const { error: deleteError } = await supabaseAdmin
      .from("competitors")
      .update({ status: "archived" })
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
