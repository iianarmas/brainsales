import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { CallNode } from "@/data/callFlow";

async function isAdmin(authHeader: string | null): Promise<boolean> {
    if (!authHeader || !supabaseAdmin) return false;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return false;
    const { data } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .single();
    return !!data;
}

// GET: List versions
export async function GET(request: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!(await isAdmin(authHeader))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const productId = request.headers.get("X-Product-Id");
        if (!productId) {
            return NextResponse.json({ error: "Product ID required" }, { status: 400 });
        }

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
    if (!(await isAdmin(authHeader))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { label } = body;
        const productId = request.headers.get("X-Product-Id");

        if (!label) {
            return NextResponse.json({ error: "Label is required" }, { status: 400 });
        }
        if (!productId) {
            return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
        }

        // 1. Fetch current data for this product
        const [
            { data: nodes },
            { data: keypoints },
            { data: warnings },
            { data: listenFor },
            { data: responses }
        ] = await Promise.all([
            supabaseAdmin.from("call_nodes").select("*").eq("product_id", productId),
            supabaseAdmin.from("call_node_keypoints").select("*").eq("product_id", productId),
            supabaseAdmin.from("call_node_warnings").select("*").eq("product_id", productId),
            supabaseAdmin.from("call_node_listen_for").select("*").eq("product_id", productId),
            supabaseAdmin.from("call_node_responses").select("*").eq("product_id", productId)
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

        // 3. Save to script_versions
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
