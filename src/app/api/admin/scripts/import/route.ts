import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { CallNode } from "@/data/callFlow";

async function isAdmin(authHeader: string | null): Promise<boolean> {
    if (!authHeader || !supabaseAdmin) {
        return false;
    }

    const token = authHeader.replace("Bearer ", "");
    const {
        data: { user },
    } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
        return false;
    }

    const { data } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .single();

    return !!data;
}

interface ImportRequest {
    nodes: Array<CallNode & {
        position_x?: number;
        position_y?: number;
        topic_group_id?: string | null;
    }>;
    strategy: "overwrite" | "merge";
}

/**
 * POST /api/admin/scripts/import
 * Import nodes from JSON backup
 */
export async function POST(request: NextRequest) {
    const adminClient = supabaseAdmin;
    if (!adminClient) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!(await isAdmin(authHeader))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { nodes, strategy } = (await request.json()) as ImportRequest;

        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
            return NextResponse.json({ error: "No nodes provided for import" }, { status: 400 });
        }

        if (!strategy || !["overwrite", "merge"].includes(strategy)) {
            return NextResponse.json({ error: "Invalid import strategy" }, { status: 400 });
        }



        // Get user ID for tracking creation
        const token = authHeader?.replace("Bearer ", "") || "";
        const { data: { user } } = await adminClient.auth.getUser(token);
        const userId = user?.id;

        // IF OVERWRITE: Delete everything first
        if (strategy === "overwrite") {

            // Due to cascade delete on call_nodes, deleting nodes should be enough
            // But let's be safe and try to act carefully. 
            // In Supabase/PostgreSQL, cascading deletes are efficient.
            const { error: deleteError } = await adminClient
                .from("call_nodes")
                .delete()
                .neq("id", "placeholder_never_match"); // Delete all

            if (deleteError) {
                throw new Error(`Failed to clear existing data: ${deleteError.message}`);
            }
        }

        // Prepare data for batch insertion/upsert
        // We need to insert nodes first, then related data

        // 1. Upsert Nodes
        const nodeRows = nodes.map(node => ({
            id: node.id,
            type: node.type,
            title: node.title,
            script: node.script,
            context: node.context || null,
            metadata: node.metadata || null,
            position_x: node.position_x || 0,
            position_y: node.position_y || 0,
            topic_group_id: node.topic_group_id || null,
            updated_at: new Date().toISOString(),
            updated_by: userId,
            // Only set created_by if it's a new insert (upsert handles updates)
            // actually simple upsert just overwrites. for merge, we want to keep original created_at if possible?
            // Let's simplified: just upsert.
            created_by: userId // this might overwrite original creator if we are not careful, but for restore it's okay.
        }));

        const { error: nodeError } = await adminClient
            .from("call_nodes")
            .upsert(nodeRows, { onConflict: 'id' });

        if (nodeError) throw new Error(`Failed to upsert nodes: ${nodeError.message}`);

        // For related tables, it's cleaner to delete existing related items for these nodes 
        // and re-insert them to avoid duplication or stale data (e.g. keypoints changed).
        // If strategy is merge, we only want to clear related items for the nodes we are touching.
        const nodeIds = nodes.map(n => n.id);

        // Helper to clear and insert related
        const clearAndInsertRelated = async (table: string, idField: string, rows: any[]) => {
            // Delete existing for these nodes
            const { error: delErr } = await adminClient
                .from(table)
                .delete()
                .in('node_id', nodeIds);

            if (delErr) throw new Error(`Failed to clear ${table}: ${delErr.message}`);

            if (rows.length > 0) {
                const { error: insErr } = await adminClient
                    .from(table)
                    .insert(rows);
                if (insErr) throw new Error(`Failed to insert ${table}: ${insErr.message}`);
            }
        };

        // 2. Keypoints
        const keypointRows = nodes.flatMap(n =>
            (n.keyPoints || []).map((k, i) => ({
                node_id: n.id,
                keypoint: k,
                sort_order: i
            }))
        );
        await clearAndInsertRelated('call_node_keypoints', 'node_id', keypointRows);

        // 3. Warnings
        const warningRows = nodes.flatMap(n =>
            (n.warnings || []).map((w, i) => ({
                node_id: n.id,
                warning: w,
                sort_order: i
            }))
        );
        await clearAndInsertRelated('call_node_warnings', 'node_id', warningRows);

        // 4. Listen For
        const listenRows = nodes.flatMap(n =>
            (n.listenFor || []).map((l, i) => ({
                node_id: n.id,
                listen_item: l,
                sort_order: i
            }))
        );
        await clearAndInsertRelated('call_node_listen_for', 'node_id', listenRows);

        // 5. Responses
        const responseRows = nodes.flatMap(n =>
            (n.responses || []).map((r, i) => ({
                node_id: n.id,
                label: r.label,
                next_node_id: r.nextNode,
                note: r.note || null,
                sort_order: i
            }))
        );
        await clearAndInsertRelated('call_node_responses', 'node_id', responseRows);

        return NextResponse.json({
            message: "Import successful",
            count: nodes.length
        });

    } catch (error) {
        console.error("❌ Import failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown import error" },
            { status: 500 }
        );
    }
}
