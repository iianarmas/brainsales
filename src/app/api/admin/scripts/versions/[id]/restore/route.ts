import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

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

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!(await isAdmin(authHeader))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    try {
        // 1. Fetch the version data
        const { data: version, error: fetchError } = await supabaseAdmin
            .from("flow_snapshots")
            .select("data, product_id")
            .eq("id", id)
            .single();

        if (fetchError || !version) {
            return NextResponse.json({ error: "Version not found" }, { status: 404 });
        }

        const productId = version.product_id;
        const { nodes, keypoints, warnings, listenFor, responses } = version.data;

        if (!productId) {
            throw new Error("Version data is missing product_id");
        }

        // 2. Clear existing data
        // We only clear the "official" flow for this product.
        // Sandbox and Library nodes must remain untouched.

        const { data: currentOfficialNodes, error: currentNodesError } = await supabaseAdmin
            .from("call_nodes")
            .select("id")
            .eq("product_id", productId)
            .eq("scope", "official");

        if (currentNodesError) throw currentNodesError;

        const idsToClear = currentOfficialNodes?.map(n => n.id) || [];

        if (idsToClear.length > 0) {
            // Step A: Clear incoming references (from ANY product/scope) to these official IDs
            // This is safe because we are clearing the official flow and its connections.
            await supabaseAdmin.from("call_node_responses").delete().in("next_node_id", idsToClear);

            // Step B: Clear all child records belonging to these IDs
            await Promise.all([
                supabaseAdmin.from("call_node_keypoints").delete().in("node_id", idsToClear),
                supabaseAdmin.from("call_node_warnings").delete().in("node_id", idsToClear),
                supabaseAdmin.from("call_node_listen_for").delete().in("node_id", idsToClear),
                supabaseAdmin.from("call_node_responses").delete().in("node_id", idsToClear)
            ]);

            // Step C: Delete the official nodes themselves
            const { error: deleteError } = await supabaseAdmin
                .from("call_nodes")
                .delete()
                .in("id", idsToClear);

            if (deleteError) {
                throw new Error(`Failed to clear existing official nodes: ${deleteError.message}`);
            }
        }

        // 3. Restore data


        // We must restore nodes first
        if (nodes && nodes.length > 0) {
            const { error: insertNodesError } = await supabaseAdmin
                .from("call_nodes")
                .insert(nodes);

            if (insertNodesError) throw new Error(`Failed to restore nodes: ${insertNodesError.message}`);
        }

        // Restore children
        if (keypoints && keypoints.length > 0) {
            const { error } = await supabaseAdmin.from("call_node_keypoints").insert(keypoints);
            if (error) throw new Error(`Failed to restore keypoints: ${error.message}`);
        }

        if (warnings && warnings.length > 0) {
            const { error } = await supabaseAdmin.from("call_node_warnings").insert(warnings);
            if (error) throw new Error(`Failed to restore warnings: ${error.message}`);
        }

        if (listenFor && listenFor.length > 0) {
            const { error } = await supabaseAdmin.from("call_node_listen_for").insert(listenFor);
            if (error) throw new Error(`Failed to restore listen_for: ${error.message}`);
        }

        if (responses && responses.length > 0) {
            const { error } = await supabaseAdmin.from("call_node_responses").insert(responses);
            if (error) throw new Error(`Failed to restore responses: ${error.message}`);
        }

        return NextResponse.json({ message: "Version restored successfully" });

    } catch (error) {
        console.error("Error restoring version:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to restore version"
        }, { status: 500 });
    }
}
