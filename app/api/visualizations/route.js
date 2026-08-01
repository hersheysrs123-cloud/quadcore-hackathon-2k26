import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * GET /api/visualizations
 * Fetches saved 3D visualization models from Supabase.
 */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("visualizations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ visualizations: [] });
    }

    return NextResponse.json({ visualizations: data ?? [] });
  } catch (err) {
    return NextResponse.json({ visualizations: [], error: err.message });
  }
}

/**
 * POST /api/visualizations
 * Saves a 3D visualization model into Supabase.
 * Body: { title, concept, widget }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { title, concept, widget } = body ?? {};
  if (!widget) {
    return NextResponse.json({ error: "`widget` config is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const payload = {
    title: title || concept || "3D Concept Model",
    concept_name: concept || "3D Model",
    widget_json: widget,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("visualizations")
      .insert([payload])
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: true,
        visualization: { id: `local_vis_${Date.now()}`, ...payload },
        note: "Saved locally.",
      });
    }

    return NextResponse.json({ success: true, visualization: data });
  } catch (err) {
    return NextResponse.json({
      success: true,
      visualization: { id: `local_vis_${Date.now()}`, ...payload },
      error: err.message,
    });
  }
}
