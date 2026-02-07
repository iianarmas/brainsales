import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

const VALID_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

// GET /api/user-objection-preferences?product_id=xxx
export async function GET(request: NextRequest) {
  try {
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

    const productId = request.nextUrl.searchParams.get("product_id");
    if (!productId) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400 }
      );
    }

    // Check product access
    const { data: productUser } = await supabaseAdmin
      .from("product_users")
      .select("role")
      .eq("product_id", productId)
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

    // Get user preferences
    const { data: preferences, error } = await supabaseAdmin
      .from("user_objection_preferences")
      .select("*")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no preferences exist, user hasn't customized
    if (!preferences || preferences.length === 0) {
      return NextResponse.json({
        customized: false,
        preferences: [],
        keyToNode: {},
        nodeToKey: {},
      });
    }

    // Build convenience maps
    const keyToNode: Record<string, string> = {};
    const nodeToKey: Record<string, string> = {};

    preferences.forEach((p) => {
      if (p.shortcut_key) {
        keyToNode[p.shortcut_key] = p.node_id;
        nodeToKey[p.node_id] = p.shortcut_key;
      }
    });

    return NextResponse.json({
      customized: true,
      preferences: preferences.map((p) => ({
        node_id: p.node_id,
        shortcut_key: p.shortcut_key,
      })),
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

// PUT /api/user-objection-preferences
export async function PUT(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { product_id, preferences } = body as {
      product_id: string;
      preferences: Array<{
        node_id: string;
        shortcut_key: string | null;
      }>;
    };

    if (!product_id) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(preferences)) {
      return NextResponse.json(
        { error: "preferences must be an array" },
        { status: 400 }
      );
    }

    // Check product access
    const { data: productUser } = await supabaseAdmin
      .from("product_users")
      .select("role")
      .eq("product_id", product_id)
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

    // Validate shortcut keys
    for (const p of preferences) {
      if (p.shortcut_key !== null && !VALID_KEYS.includes(p.shortcut_key)) {
        return NextResponse.json(
          { error: `Invalid shortcut key: ${p.shortcut_key}. Must be 0-9 or null.` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate shortcut keys
    const assignedKeys = preferences
      .map((p) => p.shortcut_key)
      .filter((k): k is string => k !== null);
    if (new Set(assignedKeys).size !== assignedKeys.length) {
      return NextResponse.json(
        { error: "Duplicate shortcut keys are not allowed" },
        { status: 400 }
      );
    }

    // Delete existing preferences for this user/product
    await supabaseAdmin
      .from("user_objection_preferences")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", product_id);

    // Insert new preferences
    if (preferences.length > 0) {
      const rows = preferences.map((p, index) => ({
        user_id: user.id,
        product_id,
        node_id: p.node_id,
        shortcut_key: p.shortcut_key,
        sort_order: index,
      }));

      const { error } = await supabaseAdmin
        .from("user_objection_preferences")
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

// DELETE /api/user-objection-preferences?product_id=xxx - Reset to defaults
export async function DELETE(request: NextRequest) {
  try {
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

    const productId = request.nextUrl.searchParams.get("product_id");
    if (!productId) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("user_objection_preferences")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
