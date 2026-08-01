import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * POST /api/reset
 * Body: { target: "notes" | "calendar" | "3d" | "all" }
 * Factory resets specified module data in Supabase.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { target } = body ?? {};
  if (!target) {
    return NextResponse.json({ error: "Missing reset target." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  try {
    if (target === "notes" || target === "all") {
      await supabase.from("notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    if (target === "calendar" || target === "all") {
      await supabase.from("calendar_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    if (target === "3d" || target === "all") {
      await supabase.from("visualizations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    return NextResponse.json({
      success: true,
      target,
      message: `Factory reset for ${target} completed successfully.`,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
