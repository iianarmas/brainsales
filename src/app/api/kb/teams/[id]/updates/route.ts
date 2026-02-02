import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const productId = request.nextUrl.searchParams.get("product_id");

    // Fetch team updates
    let query = supabaseAdmin
      .from("team_updates")
      .select("*, target_product:products(id, name)")
      .eq("team_id", id)
      .eq("status", "published");

    if (productId) {
      query = query.or(`target_product_id.is.null,target_product_id.eq.${productId}`);
    }

    const { data: updates, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updates || updates.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Fetch team with member count
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, name, description")
      .eq("id", id)
      .single();

    const { count: memberCount } = await supabaseAdmin
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", id);

    // Fetch acknowledgment counts for all updates
    const updateIds = updates.map((u) => u.id);
    const { data: acks } = await supabaseAdmin
      .from("team_update_acknowledgments")
      .select("team_update_id, user_id")
      .in("team_update_id", updateIds);

    // Build acknowledgment map
    const ackCountMap: Record<string, number> = {};
    const userAckSet = new Set<string>();
    for (const ack of acks || []) {
      ackCountMap[ack.team_update_id] = (ackCountMap[ack.team_update_id] || 0) + 1;
      if (ack.user_id === user.id) {
        userAckSet.add(ack.team_update_id);
      }
    }

    // Enrich updates with team, ack count, and user ack status
    const enrichedUpdates = updates.map((u) => ({
      ...u,
      team: team ? { ...team, member_count: memberCount || 0 } : null,
      acknowledgment_count: ackCountMap[u.id] || 0,
      is_acknowledged: userAckSet.has(u.id),
    }));

    return NextResponse.json({ data: enrichedUpdates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { data: adminData } = await supabaseAdmin.from("admins").select("id").eq("user_id", user.id).single();
    if (!adminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { update_id } = body;

    if (!update_id) {
      return NextResponse.json({ error: "update_id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("team_updates")
      .insert({ team_id: id, update_id, assigned_by: user.id })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
