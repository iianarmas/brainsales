import { supabaseAdmin } from "./supabaseAdmin";

export interface ScriptIndexEntry {
    id: string;
    type: string;
    title: string;
    context: string | null;
    listenFor: string[];
    aiTransitionTriggers: Array<{
        condition: string;
        targetNodeId: string;
        confidence: "high" | "medium";
    }>;
}

/**
 * Builds the compact script index used by Claude for navigation decisions.
 * Fetches all official nodes for the given product + call flow and maps
 * each node's responses into the aiTransitionTriggers format.
 *
 * @param productId - The product whose nodes to fetch
 * @param callFlowId - Required: scope to a specific call flow
 */
export async function buildScriptIndex(
    productId: string,
    callFlowId: string,
    options?: { fallbackToAll?: boolean; skipScopeFilter?: boolean }
): Promise<ScriptIndexEntry[]> {
    let query = supabaseAdmin
        .from("call_nodes")
        .select(`
            id,
            type,
            title,
            context,
            metadata,
            call_flow_ids,
            call_node_listen_for ( listen_item, sort_order ),
            call_node_responses!node_id ( ai_condition, next_node_id, ai_confidence, is_special_instruction, sort_order )
        `)
        .eq("product_id", productId);

    if (!options?.skipScopeFilter) {
        query = query.eq("scope", "official");
    }

    const { data: nodes, error } = await query.order("id");

    if (error || !nodes) {
        const msg = error?.message ?? "No data returned";
        console.error("[buildScriptIndex] Failed to fetch nodes:", error);
        throw new Error(`buildScriptIndex query failed: ${msg}`);
    }

    // Filter to nodes that belong to this call flow
    // A node belongs to a flow if: call_flow_ids is null/empty (universal) OR includes callFlowId
    const flowNodes = nodes.filter((n: any) => {
        const flowIds: string[] | null = n.call_flow_ids;
        return !flowIds || flowIds.length === 0 || flowIds.includes(callFlowId);
    });

    // If fallbackToAll is set and the flow filter yielded nothing, use all product nodes
    const finalNodes = (options?.fallbackToAll && flowNodes.length === 0) ? nodes : flowNodes;

    return finalNodes.map((n: any) => {
        const listenFor = (n.call_node_listen_for || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((l: any) => l.listen_item as string);

        const aiTransitionTriggers = (n.call_node_responses || [])
            .filter((r: any) => !r.is_special_instruction && r.ai_condition)
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((r: any) => ({
                condition: r.ai_condition as string,
                targetNodeId: r.next_node_id as string,
                confidence: (r.ai_confidence ?? "medium") as "high" | "medium",
            }));

        // Also include legacy triggers from metadata (backward-compat)
        const legacyTriggers = (n.metadata?.aiTransitionTriggers || []).filter(
            (t: any) => !aiTransitionTriggers.some((d: any) => d.targetNodeId === t.targetNodeId)
        );

        return {
            id: n.id as string,
            type: n.type as string,
            title: n.title as string,
            context: (n.context ?? n.metadata?.aiIntent ?? null) as string | null,
            listenFor,
            aiTransitionTriggers: [...aiTransitionTriggers, ...legacyTriggers],
        };
    });
}
