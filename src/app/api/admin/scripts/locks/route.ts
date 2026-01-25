import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";

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

/**
 * GET /api/admin/scripts/locks
 * List all active locks
 */
export async function GET(request: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!(await isAdmin(authHeader))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("node_locks")
            .select("*")
            .gt("expires_at", new Date().toISOString());

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching locks:", error);
        return NextResponse.json({ error: "Failed to fetch locks" }, { status: 500 });
    }
}

/**
 * POST /api/admin/scripts/locks
 * Acquire or refresh a lock
 */
export async function POST(request: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!(await isAdmin(authHeader))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { nodeId } = await request.json();
        if (!nodeId) {
            return NextResponse.json({ error: "Node ID is required" }, { status: 400 });
        }

        const token = authHeader?.replace("Bearer ", "") || "";
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

        const expiresAt = new Date(Date.now() + 60000).toISOString(); // 1 minute lock

        // Check if someone else has a lock
        const { data: existingLock } = await supabaseAdmin
            .from("node_locks")
            .select("*")
            .eq("node_id", nodeId)
            .gt("expires_at", new Date().toISOString())
            .single();

        if (existingLock && existingLock.user_id !== user.id) {
            return NextResponse.json({
                error: "Node is locked by another user",
                lockedBy: existingLock.email
            }, { status: 409 });
        }

        // Upsert lock
        const { error } = await supabaseAdmin
            .from("node_locks")
            .upsert({
                node_id: nodeId,
                user_id: user.id,
                email: user.email,
                locked_at: new Date().toISOString(),
                expires_at: expiresAt
            });

        if (error) throw error;
        return NextResponse.json({ message: "Lock acquired", expiresAt });
    } catch (error) {
        console.error("Error acquiring lock:", error);
        return NextResponse.json({ error: "Failed to acquire lock" }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/scripts/locks
 * Release a lock
 */
export async function DELETE(request: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!(await isAdmin(authHeader))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { nodeId } = await request.json();
        if (!nodeId) {
            return NextResponse.json({ error: "Node ID is required" }, { status: 400 });
        }

        const token = authHeader?.replace("Bearer ", "") || "";
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

        const { error } = await supabaseAdmin
            .from("node_locks")
            .delete()
            .eq("node_id", nodeId)
            .eq("user_id", user.id);

        if (error) throw error;
        return NextResponse.json({ message: "Lock released" });
    } catch (error) {
        console.error("Error releasing lock:", error);
        return NextResponse.json({ error: "Failed to release lock" }, { status: 500 });
    }
}
