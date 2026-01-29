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

    const { data, error } = await supabaseAdmin
      .from("kb_updates")
      .select("*, kb_categories(*), kb_update_features(*), kb_update_metrics(*)")
      .eq("id", id)
      .neq("status", "archived")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Map Supabase relation keys to frontend-expected keys
    const { kb_categories, kb_update_features, kb_update_metrics, ...rest } = data as Record<string, unknown>;
    const mapped = { ...rest, category: kb_categories, features: kb_update_features, metrics: kb_update_metrics };

    return NextResponse.json({ data: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { features, metrics, category_slug, ...restFields } = body;

    // Save version snapshot before updating
    const { data: current } = await supabaseAdmin.from("kb_updates").select("*").eq("id", id).single();
    if (current) {
      // Get next version number
      const { data: lastVersion } = await supabaseAdmin
        .from("kb_update_versions")
        .select("version_number")
        .eq("update_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();
      const nextVersion = (lastVersion?.version_number || 0) + 1;

      await supabaseAdmin.from("kb_update_versions").insert({
        update_id: id,
        version_number: nextVersion,
        title: current.title,
        content: current.content,
        changed_by: user.id,
      });
    }

    // If category_slug provided, look up category_id
    const updateFields: Record<string, unknown> = { ...restFields };
    if (category_slug) {
      const { data: cat } = await supabaseAdmin
        .from("kb_categories")
        .select("id")
        .eq("slug", category_slug)
        .single();
      if (cat) {
        updateFields.category_id = cat.id;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("kb_updates")
      .update({ ...updateFields, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (features !== undefined) {
      await supabaseAdmin.from("kb_update_features").delete().eq("update_id", id);
      if (features.length > 0) {
        const featureRows = features.map((f: any) => ({ update_id: id, ...f }));
        await supabaseAdmin.from("kb_update_features").insert(featureRows);
      }
    }

    if (metrics !== undefined) {
      await supabaseAdmin.from("kb_update_metrics").delete().eq("update_id", id);
      if (metrics.length > 0) {
        const metricRows = metrics.map((m: any) => ({ update_id: id, ...m }));
        await supabaseAdmin.from("kb_update_metrics").insert(metricRows);
      }
    }

    // Note: Notifications are now handled by the database trigger notify_kb_update_published
    // to avoid duplicate notifications

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { error } = await supabaseAdmin
      .from("kb_updates")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Update archived successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
