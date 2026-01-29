import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { QuickReferenceData } from "@/types/product";

// GET /api/products/[id]/quick-reference - Get quick reference data for a product
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
      .select("role")
      .eq("product_id", id)
      .eq("user_id", user.id)
      .single();

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

    // Get quick reference data
    const { data: quickRefEntries, error } = await supabaseAdmin
      .from("product_quick_reference")
      .select("*")
      .eq("product_id", id)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to QuickReferenceData format
    const quickReference: QuickReferenceData = {
      differentiators: [],
      competitors: {},
      metrics: [],
      tips: [],
    };

    (quickRefEntries || []).forEach((entry) => {
      switch (entry.section) {
        case "differentiators":
          quickReference.differentiators = entry.data as string[];
          break;
        case "competitors":
          quickReference.competitors = entry.data as Record<string, {
            name: string;
            strengths: string[];
            limitations: string[];
            advantage: string;
          }>;
          break;
        case "metrics":
          quickReference.metrics = entry.data as Array<{
            value: string;
            label: string;
          }>;
          break;
        case "tips":
          quickReference.tips = entry.data as string[];
          break;
      }
    });

    return NextResponse.json(quickReference);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id]/quick-reference - Update quick reference data (admin only)
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

    const body: QuickReferenceData = await request.json();
    const { differentiators, competitors, metrics, tips } = body;

    // Upsert each section
    const upsertSection = async (
      section: string,
      data: unknown,
      sortOrder: number
    ) => {
      // Check if section exists
      const { data: existing } = await supabaseAdmin
        .from("product_quick_reference")
        .select("id")
        .eq("product_id", id)
        .eq("section", section)
        .single();

      if (existing) {
        await supabaseAdmin
          .from("product_quick_reference")
          .update({ data, sort_order: sortOrder })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("product_quick_reference").insert({
          product_id: id,
          section,
          data,
          sort_order: sortOrder,
        });
      }
    };

    if (differentiators !== undefined) {
      await upsertSection("differentiators", differentiators, 1);
    }
    if (competitors !== undefined) {
      await upsertSection("competitors", competitors, 2);
    }
    if (metrics !== undefined) {
      await upsertSection("metrics", metrics, 3);
    }
    if (tips !== undefined) {
      await upsertSection("tips", tips, 4);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
