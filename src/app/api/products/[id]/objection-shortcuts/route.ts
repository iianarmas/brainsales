import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// GET /api/products/[id]/objection-shortcuts - Get objection shortcuts for a product
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

    // Get shortcuts
    const { data: shortcuts, error } = await supabaseAdmin
      .from("product_objection_shortcuts")
      .select("*")
      .eq("product_id", id)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build convenience maps
    const keyToNode: Record<string, string> = {};
    const nodeToKey: Record<string, string> = {};

    (shortcuts || []).forEach((s) => {
      keyToNode[s.shortcut_key] = s.node_id;
      nodeToKey[s.node_id] = s.shortcut_key;
    });

    return NextResponse.json({
      shortcuts: shortcuts || [],
      keyToNode,
      nodeToKey,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id]/objection-shortcuts - Update objection shortcuts (admin only)
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

    const body = await request.json();
    const { shortcuts } = body as {
      shortcuts: Array<{
        node_id: string;
        shortcut_key: string;
        label?: string;
      }>;
    };

    if (!Array.isArray(shortcuts)) {
      return NextResponse.json(
        { error: "shortcuts must be an array" },
        { status: 400 }
      );
    }

    // Validate shortcut keys are 0-9
    const validKeys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    for (const s of shortcuts) {
      if (!validKeys.includes(s.shortcut_key)) {
        return NextResponse.json(
          { error: `Invalid shortcut key: ${s.shortcut_key}. Must be 0-9.` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate shortcut keys
    const keys = shortcuts.map((s) => s.shortcut_key);
    if (new Set(keys).size !== keys.length) {
      return NextResponse.json(
        { error: "Duplicate shortcut keys are not allowed" },
        { status: 400 }
      );
    }

    // Delete existing shortcuts for this product
    await supabaseAdmin
      .from("product_objection_shortcuts")
      .delete()
      .eq("product_id", id);

    // Insert new shortcuts
    if (shortcuts.length > 0) {
      const rows = shortcuts.map((s, index) => ({
        product_id: id,
        node_id: s.node_id,
        shortcut_key: s.shortcut_key,
        label: s.label || null,
        sort_order: index,
      }));

      const { error } = await supabaseAdmin
        .from("product_objection_shortcuts")
        .insert(rows);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
