import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

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
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: "Request body must be a non-empty array" }, { status: 400 });
    }

    const results: { success: any[]; errors: any[] } = { success: [], errors: [] };

    for (let i = 0; i < body.length; i++) {
      const { category_slug, title, content, summary, tags, version, status, priority, publish_at, features, metrics } = body[i];

      if (!category_slug || !title || !content) {
        results.errors.push({ index: i, error: "category_slug, title, and content are required" });
        continue;
      }

      const { data: update, error: insertError } = await supabaseAdmin
        .from("kb_updates")
        .insert({
          category_slug,
          title,
          content,
          summary: summary || null,
          tags: tags || [],
          version: version || null,
          status: status || "draft",
          priority: priority || "normal",
          publish_at: publish_at || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        results.errors.push({ index: i, error: insertError.message });
        continue;
      }

      if (features && features.length > 0) {
        const featureRows = features.map((f: any) => ({ update_id: update.id, ...f }));
        await supabaseAdmin.from("kb_update_features").insert(featureRows);
      }

      if (metrics && metrics.length > 0) {
        const metricRows = metrics.map((m: any) => ({ update_id: update.id, ...m }));
        await supabaseAdmin.from("kb_update_metrics").insert(metricRows);
      }

      results.success.push(update);
    }

    return NextResponse.json({
      data: results,
      summary: { total: body.length, success: results.success.length, failed: results.errors.length },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
