import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * GET /api/notes/[id]
 *
 * Fetches a note with all of its blocks in order, plus any Socratic sessions
 * hanging off those blocks (so the Duck pane can resume mid-conversation).
 *
 * 200 -> { note: { ...note, blocks: [{ ...block, socratic_sessions: [...] }] } }
 */
export async function GET(request, { params }) {
  const { id } = await params; // params is a Promise in the Next 15 App Router

  if (!id) {
    return NextResponse.json({ error: "Missing note id." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const { data: note, error } = await supabase
    .from("notes")
    .select(
      `
      id,
      space_id,
      title,
      created_at,
      updated_at,
      blocks (
        id,
        order_index,
        block_type,
        content_json,
        created_at,
        socratic_sessions (
          id,
          concept_name,
          status,
          heatmap_json,
          created_at
        )
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch note.", detail: error.message },
      { status: 500 },
    );
  }

  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  // Nested selects come back unordered; sort here rather than relying on
  // referencedTable ordering, which has moved around between supabase-js versions.
  const blocks = [...(note.blocks ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  return NextResponse.json({ note: { ...note, blocks } });
}
