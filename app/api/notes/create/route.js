import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  BLOCK_TYPES,
  BLOCK_CONTENT_SHAPES,
  ORDER_INDEX_STEP,
} from "@/lib/constants";

export const dynamic = "force-dynamic";


/**
 * POST /api/notes/create
 *
 * Creates a note inside a space and seeds it with blocks. Called with no
 * `blocks` it creates a single empty text block, so the editor always opens on
 * something focusable rather than a void.
 *
 * Body:
 * {
 *   "spaceId": "uuid",                       // required
 *   "title":   "Untitled",                   // optional
 *   "blocks":  [                             // optional
 *     { "block_type": "heading", "content_json": { "text": "...", "level": 2 } }
 *   ]
 * }
 *
 * 201 -> { note: { ...note, blocks: [...] } }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { spaceId, title, blocks } = body ?? {};

  if (!spaceId || typeof spaceId !== "string") {
    return NextResponse.json(
      { error: "`spaceId` is required." },
      { status: 400 },
    );
  }

  if (blocks !== undefined && !Array.isArray(blocks)) {
    return NextResponse.json(
      { error: "`blocks` must be an array when provided." },
      { status: 400 },
    );
  }

  const incoming = blocks?.length ? blocks : [{ block_type: "text" }];

  const invalid = incoming.find(
    (b) => b.block_type && !BLOCK_TYPES.includes(b.block_type),
  );
  if (invalid) {
    return NextResponse.json(
      {
        error: `Unknown block_type "${invalid.block_type}". Expected one of: ${BLOCK_TYPES.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: note, error: noteError } = await supabase
    .from("notes")
    .insert({ space_id: spaceId, title: title?.trim() || "Untitled" })
    .select()
    .single();

  if (noteError) {
    return NextResponse.json(
      { error: "Could not create note.", detail: noteError.message },
      { status: 400 },
    );
  }

  const rows = incoming.map((block, i) => {
    const type = block.block_type ?? "text";
    return {
      note_id: note.id,
      order_index: (i + 1) * ORDER_INDEX_STEP,
      block_type: type,
      content_json: block.content_json ?? BLOCK_CONTENT_SHAPES[type] ?? {},
    };
  });

  const { data: createdBlocks, error: blockError } = await supabase
    .from("blocks")
    .insert(rows)
    .select();

  if (blockError) {
    // Leave the note without blocks rather than silently swallowing this — the
    // caller needs to know the note is half-built.
    return NextResponse.json(
      {
        error: "Note created but blocks failed.",
        detail: blockError.message,
        note: { ...note, blocks: [] },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { note: { ...note, blocks: createdBlocks } },
    { status: 201 },
  );
}
