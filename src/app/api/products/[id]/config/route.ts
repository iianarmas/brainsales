import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

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

        // Get product configuration and topics
        const { data: product, error: productError } = await supabaseAdmin
            .from("products")
            .select("configuration")
            .eq("id", id)
            .single();

        if (productError) {
            return NextResponse.json({ error: productError.message }, { status: 500 });
        }

        const { data: topics, error: topicsError } = await supabaseAdmin
            .from("topic_groups")
            .select("*")
            .eq("product_id", id)
            .order("sort_order");

        return NextResponse.json({
            configuration: product?.configuration || {},
            topics: topics || [],
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify admin access
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: admin } = await supabaseAdmin
            .from("admins")
            .select("id")
            .eq("user_id", user.id)
            .single();

        if (!admin) {
            // Check product admin
            const { data: productUser } = await supabaseAdmin
                .from("product_users")
                .select("role")
                .eq("product_id", id)
                .eq("user_id", user.id)
                .in("role", ["admin", "super_admin"])
                .single();

            if (!productUser) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const body = await request.json();
        const { configuration, topics } = body;

        // Update product configuration
        if (configuration) {
            const { error: configError } = await supabaseAdmin
                .from("products")
                .update({ configuration })
                .eq("id", id);

            if (configError) throw configError;
        }

        // Update topics (if provided)
        // This is a simplified approach: upsert based on ID
        // Update topics (if provided)
        if (topics && Array.isArray(topics)) {
            // 1. Get existing topic IDs for this product
            const { data: existingTopics } = await supabaseAdmin
                .from("topic_groups")
                .select("id")
                .eq("product_id", id);

            const existingIds = new Set(existingTopics?.map(t => t.id) || []);
            const incomingIds = new Set(topics.map(t => t.id).filter(Boolean));

            // 2. Delete topics not in the incoming payload
            const idsToDelete = [...existingIds].filter(id => !incomingIds.has(id));
            if (idsToDelete.length > 0) {
                await supabaseAdmin
                    .from("topic_groups")
                    .delete()
                    .eq("product_id", id)
                    .in("id", idsToDelete);
            }

            // 3. Upsert incoming topics
            for (const topic of topics) {
                if (topic.id) {
                    await supabaseAdmin.from("topic_groups").upsert({
                        ...topic,
                        product_id: id
                    });
                } else {
                    await supabaseAdmin.from("topic_groups").insert({
                        ...topic,
                        product_id: id
                    });
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Error updating config:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Internal server error" },
            { status: 500 }
        );
    }
}
