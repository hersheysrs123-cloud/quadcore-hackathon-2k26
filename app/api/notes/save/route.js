import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when the database simply isn't there, as opposed to a real query error.
 *
 * supabase-js swallows network failures and hands them back on the `error`
 * field rather than throwing, so this has to be checked on both paths.
 */
const isUnreachable = (message) =>
  /fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo|network/i.test(
    String(message ?? ""),
  );

/**
 * Reaching Supabase is optional: the workspace runs entirely on localStorage
 * until a real project URL is configured, and Workspace.jsx calls this on
 * every mount. Answering 500 for "no database configured" put a red error in
 * the console on every page load for a state that is expected and already
 * handled, so that case answers 200 with `offline: true` instead.
 */
const offlineResponse = () =>
  NextResponse.json({
    success: false,
    offline: true,
    notes: [],
    error: "Supabase is not reachable — using local storage.",
  });

/**
 * GET /api/notes/save
 * Fetches all saved notes and their associated blocks from Supabase.
 */
export async function GET() {
  const supabase = getSupabaseServerClient();
  try {
    const { data: notes, error } = await supabase
      .from("notes")
      .select(`
        id,
        space_id,
        title,
        created_at,
        updated_at,
        blocks (
          id,
          order_index,
          block_type,
          content_json
        )
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      if (isUnreachable(error.message)) return offlineResponse();
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, notes: notes || [] });
  } catch (err) {
    if (isUnreachable(err?.message)) return offlineResponse();
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/notes/save
 * Body: { noteId?, spaceId?, space?, title, blocks: [{ id, block_type, content_json }] }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { noteId, spaceId, space, title, blocks } = body ?? {};
  const targetSpace = space || spaceId || "School";
  const supabase = getSupabaseServerClient();

  try {
    let activeNoteId = noteId;
    const isValidUuid = activeNoteId && UUID_REGEX.test(activeNoteId);

    // 1. If noteId is present and a valid UUID, update note
    if (isValidUuid) {
      await supabase
        .from("notes")
        .update({
          title: title || "Untitled Note",
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeNoteId);
    } else {
      // Create new note row
      const insertObj = { title: title || "Untitled Note" };
      if (UUID_REGEX.test(targetSpace)) {
        insertObj.space_id = targetSpace;
      }
      const { data: newNote, error: createErr } = await supabase
        .from("notes")
        .insert([insertObj])
        .select("id")
        .single();
      
      if (newNote) {
        activeNoteId = newNote.id;
      } else if (createErr) {
        console.warn("Supabase note insert notice:", createErr.message);
      }
    }

    // 2. Save blocks if activeNoteId exists
    if (activeNoteId && Array.isArray(blocks) && blocks.length > 0) {
      const blockRows = blocks.map((b, idx) => ({
        note_id: activeNoteId,
        order_index: (idx + 1) * 1024,
        block_type: b.type || b.block_type || "text",
        content_json: typeof b.content_json === "object" && b.content_json !== null
          ? b.content_json
          : {
              text: typeof b.content === "string" ? b.content : "",
              drawingData: b.drawingData || null,
              bgType: b.bgType || null,
              url: b.url || null,
              mediaKind: b.mediaKind || null,
              checked: b.checked ?? null,
              icon: b.icon || null,
            },
      }));

      // Delete existing blocks and insert new ones
      const { error: delErr } = await supabase.from("blocks").delete().eq("note_id", activeNoteId);
      if (delErr) {
        console.warn("Block cleanup notice:", delErr.message);
      }
      const { error: insErr } = await supabase.from("blocks").insert(blockRows);
      if (insErr) {
        throw new Error(`Failed to save note blocks: ${insErr.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      noteId: activeNoteId,
      title: title || "Untitled Note",
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        savedLocally: true,
        message: "Error processing note save request.",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
