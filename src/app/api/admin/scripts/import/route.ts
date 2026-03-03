import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { CallNode } from "@/data/callFlow";
import { getProductId, ensureUniqueNodeId } from "@/app/lib/apiAuth";
import { prewarmNodeConditions } from "@/app/lib/prewarmNodeCache";

async function getOrganizationId(authHeader: string | null): Promise<string | null> {
    if (!authHeader || !supabaseAdmin) return null;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return null;

    const { data: memberData } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

    return memberData?.organization_id || null;
}

async function isOrgAdmin(authHeader: string | null): Promise<string | null> {
    const orgId = await getOrganizationId(authHeader);
    if (!orgId) return null;

    const token = authHeader!.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return null;

    const { data: admin } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .single();

    return admin ? orgId : null;
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
    const orgId = await isOrgAdmin(authHeader);
    if (!orgId) {
        return NextResponse.json({ error: "Unauthorized or organization mismatch" }, { status: 403 });
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

        // Get product_id from header or user's default product
        const productId = await getProductId(request, authHeader);
        if (!productId) {
            return NextResponse.json(
                { error: "product_id is required. Set X-Product-Id header or ensure user has a default product." },
                { status: 400 }
            );
        }

        // Verify product belongs to admin's organization
        const { data: product } = await adminClient
            .from("products")
            .select("organization_id")
            .eq("id", productId)
            .single();

        if (product?.organization_id !== orgId) {
            return NextResponse.json({ error: "Forbidden: Product belongs to another organization" }, { status: 403 });
        }

        // IF OVERWRITE: Delete everything first
        if (strategy === "overwrite") {

            // Due to cascade delete on call_nodes, deleting nodes should be enough
            // But let's be safe and try to act carefully. 
            // In Supabase/PostgreSQL, cascading deletes are efficient.
            const { error: deleteError } = await adminClient
                .from("call_nodes")
                .delete()
                .eq("product_id", productId); // Delete all nodes for this product

            if (deleteError) {
                throw new Error(`Failed to clear existing data: ${deleteError.message}`);
            }
        }

        // Prepare data for batch insertion/upsert
        // We need to insert nodes first, then related data

        // Resolve cross-org ID collisions for all nodes
        const idMapping = new Map<string, string>(); // original -> resolved
        for (const node of nodes) {
            const resolvedId = await ensureUniqueNodeId(node.id, orgId);
            if (resolvedId !== node.id) {
                idMapping.set(node.id, resolvedId);
            }
        }

        // Helper to resolve a node ID through the mapping
        const resolveId = (id: string) => idMapping.get(id) || id;

        // 1. Upsert Nodes
        const nodeRows = nodes.map(node => ({
            id: resolveId(node.id),
            type: node.type,
            title: node.title,
            script: node.script,
            context: node.context || null,
            metadata: node.metadata || null,
            position_x: node.position_x || 0,
            position_y: node.position_y || 0,
            topic_group_id: node.topic_group_id || null,
            product_id: productId,
            organization_id: orgId, // Ensure isolation
            updated_at: new Date().toISOString(),
            updated_by: userId,
            created_by: userId
        }));

        const { error: nodeError } = await adminClient
            .from("call_nodes")
            .upsert(nodeRows, { onConflict: 'id' });

        if (nodeError) throw new Error(`Failed to upsert nodes: ${nodeError.message}`);

        const nodeIds = nodes.map(n => resolveId(n.id));

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
                node_id: resolveId(n.id),
                product_id: productId,
                organization_id: orgId,
                keypoint: k,
                sort_order: i
            }))
        );
        await clearAndInsertRelated('call_node_keypoints', 'node_id', keypointRows);

        // 3. Warnings
        const warningRows = nodes.flatMap(n =>
            (n.warnings || []).map((w, i) => ({
                node_id: resolveId(n.id),
                product_id: productId,
                organization_id: orgId,
                warning: w,
                sort_order: i
            }))
        );
        await clearAndInsertRelated('call_node_warnings', 'node_id', warningRows);

        // 4. Listen For
        const listenRows = nodes.flatMap(n =>
            (n.listenFor || []).map((l, i) => ({
                node_id: resolveId(n.id),
                product_id: productId,
                organization_id: orgId,
                listen_item: l,
                sort_order: i
            }))
        );
        await clearAndInsertRelated('call_node_listen_for', 'node_id', listenRows);

        // 5. Responses (also resolve next_node_id references)
        const responseRows = nodes.flatMap(n =>
            (n.responses || []).map((r, i) => ({
                node_id: resolveId(n.id),
                product_id: productId,
                organization_id: orgId,
                label: r.label,
                next_node_id: r.isSpecialInstruction ? null : (r.nextNode ? resolveId(r.nextNode) : null),
                note: r.note || null,
                is_special_instruction: r.isSpecialInstruction ?? false,
                coaching_scope: r.isSpecialInstruction ? (r.coachingScope || null) : null,
                ai_condition: !r.isSpecialInstruction ? (r.aiCondition || null) : null,
                ai_confidence: !r.isSpecialInstruction ? (r.aiConfidence || null) : null,
                sort_order: i
            }))
        );
        await clearAndInsertRelated('call_node_responses', 'node_id', responseRows);

        // Level 1: fire-and-forget batch pre-warm for all imported nodes' aiCondition phrases.
        // Batch all conditions into a single prewarmNodeConditions call for efficiency.
        const allImportedResponses = nodes.flatMap(n =>
            (n.responses || []).map(r => ({
                aiCondition: r.aiCondition,
                nextNode: r.nextNode ? resolveId(r.nextNode) : "",
            }))
        );
        if (allImportedResponses.length > 0) {
            void prewarmNodeConditions(allImportedResponses, productId, orgId, null);
        }

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
