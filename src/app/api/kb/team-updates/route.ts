import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// GET: Fetch all team updates for teams the user belongs to (including broadcasts)
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

    // Get all teams the user belongs to
    const { data: memberships } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id);

    const teamIds = memberships?.map((m) => m.team_id) || [];

    // Get user's product IDs for product-specific broadcasts
    const { data: productMemberships } = await supabaseAdmin
      .from("product_users")
      .select("product_id")
      .eq("user_id", user.id);

    const productIds = productMemberships?.map((p) => p.product_id) || [];

    const productId = request.nextUrl.searchParams.get("product_id");

    // Build query to include:
    // 1. Team updates from user's teams
    // 2. Broadcasts to all teams (is_broadcast = true)
    // 3. Broadcasts to user's products (target_product_id in user's products)
    let query = supabaseAdmin
      .from("team_updates")
      .select("*, team:teams(id, name, description), target_product:products(id, name)")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (productId) {
      query = query.or(`target_product_id.is.null,target_product_id.eq.${productId}`);
    }

    // Build OR conditions
    // Build OR conditions
    const orConditions: string[] = [];

    // 1. User's teams
    if (teamIds.length > 0) {
      orConditions.push(`team_id.in.(${teamIds.join(",")})`);
    }

    // 2. Broadcasts (global)
    orConditions.push("is_broadcast.eq.true");

    // 3. Updates targeted to user's products
    if (productIds.length > 0) {
      orConditions.push(`target_product_id.in.(${productIds.join(",")})`);
    }

    // Combine with OR
    if (orConditions.length > 0) {
      query = query.or(orConditions.join(","));
    }






    const { data: updates, error } = await query;

    if (error) console.error('[API Team Updates] Error:', error);


    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updates || updates.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get member counts for all teams
    const { data: memberCounts } = await supabaseAdmin
      .from("team_members")
      .select("team_id")
      .in("team_id", teamIds);

    const memberCountMap: Record<string, number> = {};
    for (const mc of memberCounts || []) {
      memberCountMap[mc.team_id] = (memberCountMap[mc.team_id] || 0) + 1;
    }

    // Fetch acknowledgment data
    const updateIds = updates.map((u) => u.id);
    const { data: acks } = await supabaseAdmin
      .from("team_update_acknowledgments")
      .select("team_update_id, user_id")
      .in("team_update_id", updateIds);

    const ackCountMap: Record<string, number> = {};
    const userAckSet = new Set<string>();
    for (const ack of acks || []) {
      ackCountMap[ack.team_update_id] = (ackCountMap[ack.team_update_id] || 0) + 1;
      if (ack.user_id === user.id) {
        userAckSet.add(ack.team_update_id);
      }
    }

    // Enrich updates
    const enrichedUpdates = updates.map((u) => ({
      ...u,
      team: u.team ? { ...u.team, member_count: memberCountMap[u.team_id] || 0 } : null,
      acknowledgment_count: ackCountMap[u.id] || 0,
      is_acknowledged: userAckSet.has(u.id),
    }));

    return NextResponse.json({ data: enrichedUpdates });
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

    const { data: adminData } = await supabaseAdmin.from("admins").select("id").eq("user_id", user.id).single();
    if (!adminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { team_id, title, content, priority, requires_acknowledgment, status, effective_until, is_broadcast, target_product_id } = body;

    // team_id is optional if broadcasting or targeting a product
    if (!is_broadcast && !team_id && !target_product_id) {
      return NextResponse.json({ error: "team_id or target_product_id is required unless broadcasting" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const isPublishing = status === "published";

    const insertData: Record<string, unknown> = {
      created_by: user.id,
      title,
      content: content || "",
      priority: priority || "medium",
      requires_acknowledgment: requires_acknowledgment ?? true,
      status: status || "draft",
      is_broadcast: is_broadcast || false,
    };

    // Set team_id if provided (might be null for broadcasts)
    if (team_id) {
      insertData.team_id = team_id;
    }

    // Set target_product_id for product-specific broadcasts
    if (target_product_id) {
      insertData.target_product_id = target_product_id;
    }

    if (effective_until) {
      insertData.effective_until = effective_until;
    }

    if (isPublishing) {
      insertData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("team_updates")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notifications are now handled by the database trigger notify_team_update_published
    // to prevent duplicate notifications and ensure consistency.

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
