import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { CallNode } from "@/data/callFlow";

async function getOrganizationIds(authHeader: string | null): Promise<string[]> {
    if (!authHeader || !supabaseAdmin) return [];
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return [];

    const { data: memberData } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id);

    return (memberData || []).map(m => m.organization_id);
}

async function isOrgAdminForProduct(authHeader: string | null, productId: string): Promise<boolean> {
    if (!authHeader || !supabaseAdmin) return false;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return false;

    // 1. Check if user is a global super admin
    const { data: globalAdmin } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

    // 2. Get product organization
    const { data: product } = await supabaseAdmin
        .from("products")
        .select("organization_id")
        .eq("id", productId)
        .maybeSingle();

    if (!product) return false;

    // 3. Check if user is admin/owner of this specific organization
    const { data: orgMembership } = await supabaseAdmin
        .from("organization_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", product.organization_id)
        .in("role", ["admin", "owner"])
        .maybeSingle();

    // Access granted if global admin (optional check) or org admin for the product
    return !!orgMembership || !!globalAdmin;
}

// verifyProductAccess is now redundant with isOrgAdminForProduct in this specific file
// but we keep consistent with the pattern if needed elsewhere.
async function verifyProductAccess(productId: string, orgIds: string[]): Promise<boolean> {
    const { data: product } = await supabaseAdmin!
        .from("products")
        .select("organization_id")
        .eq("id", productId)
        .single();

    return !!product && orgIds.includes(product.organization_id);
}

// GET: List versions
export async function GET(request: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    const productId = request.headers.get("X-Product-Id");

    if (!productId) {
        return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const authorized = await isOrgAdminForProduct(authHeader, productId);
    if (!authorized) {
        return NextResponse.json({ error: "Unauthorized or organization mismatch" }, { status: 403 });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("flow_snapshots")
            .select("id, created_at, label, created_by")
            .eq("product_id", productId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching versions:", error);
        return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
    }
}

// POST: Create a new version snapshot
export async function POST(request: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    const productId = request.headers.get("X-Product-Id");

    if (!productId) {
        return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const authorized = await isOrgAdminForProduct(authHeader, productId);
    if (!authorized) {
        return NextResponse.json({ error: "Unauthorized or organization mismatch" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { label } = body;

        if (!label) {
            return NextResponse.json({ error: "Label is required" }, { status: 400 });
        }

        // 1. Fetch current data for this product
        const { data: nodes, error: nodesError } = await supabaseAdmin
            .from("call_nodes")
            .select("*")
            .eq("product_id", productId)
            .eq("scope", "official");

        if (nodesError) throw nodesError;

        if (!nodes || nodes.length === 0) {
            return NextResponse.json({ error: "No official nodes found to snapshot" }, { status: 400 });
        }

        const nodeIds = nodes.map(n => n.id);

        const [
            { data: keypoints },
            { data: warnings },
            { data: listenFor },
            { data: responses }
        ] = await Promise.all([
            supabaseAdmin.from("call_node_keypoints").select("*").in("node_id", nodeIds),
            supabaseAdmin.from("call_node_warnings").select("*").in("node_id", nodeIds),
            supabaseAdmin.from("call_node_listen_for").select("*").in("node_id", nodeIds),
            supabaseAdmin.from("call_node_responses").select("*").in("node_id", nodeIds)
        ]);

        const snapshotData = {
            nodes,
            keypoints,
            warnings,
            listenFor,
            responses,
            timestamp: new Date().toISOString()
        };

        // 2. Get user ID
        const token = authHeader?.replace("Bearer ", "") || "";
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);

        // 3. Save to flow_snapshots
        const { data, error } = await supabaseAdmin
            .from("flow_snapshots")
            .insert({
                label,
                data: snapshotData,
                created_by: user?.id,
                product_id: productId
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error creating version:", error);
        return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
    }
}
