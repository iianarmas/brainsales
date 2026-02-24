import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

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

    // Get user's organizations
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id);

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    if (!memberData || memberData.length === 0) {
      // If user has no organization, they see no categories
      return NextResponse.json({ data: [] });
    }

    const orgIds = memberData.map(m => m.organization_id);

    const { data, error } = await supabaseAdmin
      .from("kb_categories")
      .select("*")
      .in("organization_id", orgIds)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // De-duplicate by slug if user belongs to multiple orgs with same categories
    const unique = Array.from(new Map(data.map(item => [item.slug, item])).values());

    return NextResponse.json({ data: unique });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// PUT: Bulk update categories (admin only)
// Accepts { categories: Array<{ id?, name, slug, description?, icon?, sort_order }> }
// Upserts incoming categories and deletes any not in the payload.
export async function PUT(request: NextRequest) {
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

    // Check admin
    const { data: adminData } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!adminData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get user's organization
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    if (!memberData) {
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    const orgId = memberData.organization_id;

    const body = await request.json();
    const { categories } = body;

    if (!Array.isArray(categories)) {
      return NextResponse.json({ error: "categories array is required" }, { status: 400 });
    }

    // Get existing category IDs for this organization
    const { data: existing } = await supabaseAdmin
      .from("kb_categories")
      .select("id")
      .eq("organization_id", orgId);
    const existingIds = new Set((existing || []).map((c: { id: string }) => c.id));

    // Separate into updates and inserts
    const incomingIds = new Set<string>();

    for (const cat of categories) {
      if (!cat.name || !cat.slug) {
        return NextResponse.json({ error: "Each category must have name and slug" }, { status: 400 });
      }

      if (cat.id && existingIds.has(cat.id)) {
        // Update existing
        incomingIds.add(cat.id);
        const { error } = await supabaseAdmin
          .from("kb_categories")
          .update({
            name: cat.name,
            slug: cat.slug,
            description: cat.description || null,
            icon: cat.icon || null,
            sort_order: cat.sort_order ?? 0,
          })
          .eq("id", cat.id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        // Insert new
        const { data: inserted, error } = await supabaseAdmin
          .from("kb_categories")
          .insert({
            name: cat.name,
            slug: cat.slug,
            description: cat.description || null,
            icon: cat.icon || null,
            sort_order: cat.sort_order ?? 0,
            organization_id: orgId,
          })
          .select("id")
          .single();
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (inserted) incomingIds.add(inserted.id);
      }
    }

    // Delete categories not in the incoming payload
    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    if (toDelete.length > 0) {
      const { error } = await supabaseAdmin
        .from("kb_categories")
        .delete()
        .in("id", toDelete);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Return updated list for this organization
    const { data: updated, error: fetchError } = await supabaseAdmin
      .from("kb_categories")
      .select("*")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
