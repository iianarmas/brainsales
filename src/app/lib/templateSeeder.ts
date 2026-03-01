import { supabaseAdmin } from "./supabaseServer";
import { callFlow, CallNode } from "@/data/callFlow";

/**
 * Seeds a new organization with a default "General Sales" product and 
 * a standard call flow (Opening -> Discovery -> Pitch -> Close).
 */
export async function seedOrganizationTemplate(organizationId: string, userId: string): Promise<void> {
    if (!supabaseAdmin) {
        console.error("Supabase admin client not initialized for seeding");
        return;
    }

    try {
        // 1. Create the "General Sales" product
        const { data: product, error: productError } = await supabaseAdmin
            .from("products")
            .insert({
                name: "General Sales",
                slug: `general-sales-${organizationId.slice(0, 8)}`,
                description: "Standard sales template for your team.",
                organization_id: organizationId,
                created_by: userId,
                is_active: true
            })
            .select("id")
            .single();

        if (productError || !product) {
            console.error("Failed to seed product:", productError);
            return;
        }

        const productId = product.id;

        // 2. Associate the user with the product as a super_admin
        const { error: memberError } = await supabaseAdmin
            .from("product_users")
            .insert({
                product_id: productId,
                user_id: userId,
                role: "super_admin",
                is_default: true
            });

        if (memberError) {
            console.error("Failed to seed product member:", memberError);
            // Continue anyway, as the owner is already in the org
        }

        // 3. Map static keys to new UUIDs for the database
        // This avoids ID collisions if multiple orgs seed simultaneously
        const nodeKeyToId: Record<string, string> = {
            opening_default: crypto.randomUUID(),
            discovery_default: crypto.randomUUID(),
            pitch_default: crypto.randomUUID(),
            close_default: crypto.randomUUID(),
            end_success: crypto.randomUUID(),
            end_not_interested: crypto.randomUUID(),
        };

        const templateKeys = Object.keys(nodeKeyToId);

        // 4. Create Call Nodes
        const nodesToInsert = templateKeys.map((key, index) => {
            const template = callFlow[key];

            // Layout nodes vertically: Opening -> Discovery -> Pitch -> Close -> End
            const positions: Record<string, { x: number, y: number }> = {
                opening_default: { x: 300, y: 100 },
                discovery_default: { x: 300, y: 350 },
                pitch_default: { x: 300, y: 600 },
                close_default: { x: 300, y: 850 },
                end_success: { x: 150, y: 1100 },
                end_not_interested: { x: 450, y: 1100 }
            };

            const pos = positions[key] || { x: 300, y: 100 + (index * 250) };

            return {
                id: nodeKeyToId[key],
                type: template.type,
                title: template.title,
                script: template.script,
                context: template.context,
                product_id: productId,
                organization_id: organizationId,
                is_active: true,
                scope: "official",
                position_x: pos.x,
                position_y: pos.y,
                topic_group_id: template.type === 'end' || template.type === 'success' ? 'end' : template.type
            };
        });

        const { error: nodesError } = await supabaseAdmin
            .from("call_nodes")
            .insert(nodesToInsert);

        if (nodesError) {
            console.error("Failed to seed call nodes:", nodesError);
            return;
        }

        // 5. Create Responses
        const responsesToInsert: any[] = [];
        templateKeys.forEach(key => {
            const template = callFlow[key];
            template.responses.forEach((resp, index) => {
                // Only insert if the nextNode is one of our template keys
                const nextNodeId = nodeKeyToId[resp.nextNode] || null;
                responsesToInsert.push({
                    node_id: nodeKeyToId[key],
                    label: resp.label,
                    next_node_id: nextNodeId,
                    sort_order: index,
                    product_id: productId,
                    organization_id: organizationId
                });
            });
        });

        if (responsesToInsert.length > 0) {
            const { error: respError } = await supabaseAdmin
                .from("call_node_responses")
                .insert(responsesToInsert);

            if (respError) {
                console.error("Failed to seed node responses:", respError);
            }
        }

        console.log(`Successfully seeded template for org ${organizationId}`);
    } catch (error) {
        console.error("Unexpected error during seeding:", error);
    }
}
