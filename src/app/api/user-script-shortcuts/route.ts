import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

// Reserved keys that cannot be used for script shortcuts
const RESERVED_KEYS = new Set([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", // reserved for objections
  "escape", "backspace", "tab", "enter",
]);

// Valid key pattern: single letter, f1-f12, or ctrl/alt + letter
function isValidKey(key: string): boolean {
  if (RESERVED_KEYS.has(key.toLowerCase())) return false;
  const normalized = key.toLowerCase();
  if (/^[a-z]$/.test(normalized)) return true;
  if (/^f([1-9]|1[0-2])$/.test(normalized)) return true;
  if (/^(ctrl|alt)\+[a-z]$/.test(normalized)) return true;
  return false;
}

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function checkProductAccess(userId: string, productId: string): Promise<boolean> {
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("organization_id")
    .eq("id", productId)
    .single();

  if (!product) return false;

  const [{ data: orgMember }, { data: adminData }] = await Promise.all([
    supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", product.organization_id)
      .eq("user_id", userId)
      .single(),
    supabaseAdmin
      .from("admins")
      .select("id")
      .eq("user_id", userId)
      .single(),
  ]);

  return !!(orgMember || adminData);
}

// GET /api/user-script-shortcuts?product_id=xxx[&call_flow_id=yyy]
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const productId = request.nextUrl.searchParams.get("product_id");
    if (!productId) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    const hasAccess = await checkProductAccess(user.id, productId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: shortcuts, error } = await supabaseAdmin
      .from("user_script_shortcuts")
      .select("*")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const keyToNode: Record<string, string> = {};
    const nodeToKey: Record<string, string> = {};

    (shortcuts || []).forEach((s) => {
      keyToNode[s.shortcut_key] = s.node_id;
      nodeToKey[s.node_id] = s.shortcut_key;
    });

    return NextResponse.json({ shortcuts: shortcuts || [], keyToNode, nodeToKey });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/user-script-shortcuts — replace all shortcuts for a product
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { product_id, shortcuts } = body as {
      product_id: string;
      shortcuts: Array<{ node_id: string; call_flow_id?: string | null; shortcut_key: string }>;
    };

    if (!product_id) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }
    if (!Array.isArray(shortcuts)) {
      return NextResponse.json({ error: "shortcuts must be an array" }, { status: 400 });
    }

    const hasAccess = await checkProductAccess(user.id, product_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate keys
    for (const s of shortcuts) {
      if (!isValidKey(s.shortcut_key)) {
        return NextResponse.json(
          { error: `Invalid shortcut key: "${s.shortcut_key}". Keys 0-9 are reserved for objections.` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate keys in the payload
    const keys = shortcuts.map((s) => s.shortcut_key.toLowerCase());
    if (new Set(keys).size !== keys.length) {
      return NextResponse.json({ error: "Duplicate shortcut keys are not allowed" }, { status: 400 });
    }

    // Replace: delete all existing, insert new
    await supabaseAdmin
      .from("user_script_shortcuts")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", product_id);

    if (shortcuts.length > 0) {
      const rows = shortcuts.map((s) => ({
        user_id: user.id,
        product_id,
        call_flow_id: s.call_flow_id ?? null,
        node_id: s.node_id,
        shortcut_key: s.shortcut_key.toLowerCase(),
      }));

      const { error } = await supabaseAdmin.from("user_script_shortcuts").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/user-script-shortcuts?product_id=xxx — clear all shortcuts for a product
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const productId = request.nextUrl.searchParams.get("product_id");
    if (!productId) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    const hasAccess = await checkProductAccess(user.id, productId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("user_script_shortcuts")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
