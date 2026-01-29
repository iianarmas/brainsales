import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";


export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [generalResult, teamResult] = await Promise.all([
      supabaseAdmin.rpc("get_unread_count", { p_user_id: user.id }),
      supabaseAdmin.rpc("get_team_unread_count", { p_user_id: user.id }),
    ]);

    if (generalResult.error) {
      return NextResponse.json({ error: generalResult.error.message }, { status: 500 });
    }
    if (teamResult.error) {
      return NextResponse.json({ error: teamResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        general: generalResult.data || 0,
        team: teamResult.data || 0,
        total: (generalResult.data || 0) + (teamResult.data || 0),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
