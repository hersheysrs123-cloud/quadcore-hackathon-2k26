/**
 * The single boundary between BlockNoteEditor's block model and the database's.
 *
 * Editor blocks are flat:      { id, type, content }          content is a string
 * Database rows are structured: { block_type, content_json }   content_json is jsonb
 *
 * Three mismatches to reconcile:
 *
 *   1. The editor splits headings by level (h1/h2/h3) where the database has a
 *      single `heading` type carrying `level` in content_json. Lossless both
 *      ways.
 *   2. The editor has `bullet` and `code`, which the original enum
 *      lacked. These are now real enum values — see supabase/schema.sql.
 *   3. The database has `media` and `socratic`, which the editor cannot render.
 *      These flatten to `text` so they stay editable, and their extra payload
 *      (a media URL, a Socratic session id) rides along on `meta`.
 *
 * `meta` works because BlockNoteEditor mutates blocks with `{ ...b, content }`
 * and `{ ...b, type }` — unknown fields survive edits untouched. That is what
 * makes the round trip lossless rather than merely close.
 */

/** Types BlockNoteEditor's slash menu can produce. */
export const EDITOR_TYPES = [
  "text",
  "h1",
  "h2",
  "h3",
  "h4",
  "bullet",
  "number",
  "todo",
  "toggle",
  "callout",
  "quote",
  "divider",
  "site",
  "media",
  "code",
  "canvas",
  "math",
];

/** Must stay in sync with the block_type enum in supabase/schema.sql. */
export const DB_BLOCK_TYPES = [
  "text",
  "heading",
  "bullet",
  "number",
  "todo",
  "toggle",
  "callout",
  "quote",
  "divider",
  "site",
  "code",
  "media",
  "socratic",
  "canvas",
];

const EDITOR_TO_LEVEL = { h1: 1, h2: 2, h3: 3, h4: 4 };
const LEVEL_TO_EDITOR = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" };

/** Joins a Socratic block's two fields into one editable line, and back. */
const SOCRATIC_SEPARATOR = " — ";

function editorId(row, index) {
  return row?.id ?? `blk_seed_${index}`;
}

/** One database row -> one editor block. */
export function toEditorBlock(row, index = 0) {
  const content = row?.content_json ?? {};
  const id = editorId(row, index);

  switch (row?.block_type) {
    case "heading":
      return {
        id,
        type: LEVEL_TO_EDITOR[content.level] ?? "h2",
        content: content.text ?? "",
      };

    case "bullet":
      return { id, type: "bullet", content: content.text ?? "" };

    case "number":
      return { id, type: "number", content: content.text ?? "" };

    case "todo":
      return { id, type: "todo", content: content.text ?? "", checked: Boolean(content.checked) };

    case "quote":
      return { id, type: "quote", content: content.text ?? "" };

    case "callout":
      return { id, type: "callout", content: content.text ?? "", calloutIcon: content.icon || content.calloutIcon || "💡" };

    case "divider":
      return { id, type: "divider", content: "" };

    case "site":
      return { id, type: "site", content: content.text ?? "", url: content.url ?? "" };

    case "code": {
      const codeLang = content.language ?? content.meta?.language ?? null;
      return {
        id,
        type: "code",
        content: content.text ?? "",
        language: codeLang,
        meta: { language: codeLang },
      };
    }

    case "toggle":
      return {
        id,
        type: "toggle",
        content: content.text ?? "",
        open: content.open ?? true,
        details: content.details ?? content.toggleContent ?? "",
      };

    case "media":
      return {
        id,
        type: "media",
        content: content.caption ?? "",
        url: content.url ?? "",
        mediaKind: content.kind ?? "image",
        meta: {
          url: content.url ?? "",
          kind: content.kind ?? "image",
        },
      };

    case "socratic":
      return {
        id,
        type: "text",
        content: [content.concept, content.prompt]
          .filter(Boolean)
          .join(SOCRATIC_SEPARATOR),
        meta: { dbType: "socratic", sessionId: content.sessionId ?? null },
      };

    case "text":
    default:
      if (content.dbType === "math") {
        return { id, type: "math", content: content.text ?? "" };
      }
      if (content.dbType === "inlinemath") {
        const formula = content.text ?? "";
        return { id, type: "text", content: formula ? `$${formula}$` : "" };
      }
      if (content.dbType === "canvas" || content.drawingData) {
        return {
          id,
          type: "canvas",
          content: content.text ?? "Canvas Drawing",
          drawingData: content.drawingData ?? null,
          bgType: content.bgType ?? "dots",
        };
      }
      return { id, type: "text", content: content.text ?? "" };
  }
}

/** One editor block -> one database row (without note_id / order_index). */
export function toDbBlock(block) {
  const text = block?.content ?? "";
  const meta = block?.meta ?? {};
  const row = (block_type, content_json) => ({ block_type, content_json });

  if (block?.type === "math") {
    return row("text", {
      text,
      dbType: "math",
    });
  }

  if (block?.type === "inlinemath") {
    return row("text", {
      text: text ? `$${text}$` : "",
    });
  }

  if (block?.type === "canvas") {
    return row("text", {
      text: text || "Canvas Drawing",
      drawingData: block.drawingData ?? meta.drawingData ?? null,
      bgType: block.bgType ?? meta.bgType ?? "dots",
      dbType: "canvas",
    });
  }

  // A flattened row round-trips only while it is still the type we flattened
  // it to. Retyping it through the slash menu is a deliberate edit, so the new
  // type wins and the stale payload is dropped.
  if (block?.type === "text" && meta.dbType === "media") {
    // Key order matches BLOCK_CONTENT_SHAPES. jsonb ignores it, but consistent
    // ordering keeps stored rows and diffs readable.
    return row("media", {
      url: meta.url ?? "",
      caption: text,
      kind: meta.kind ?? "image",
    });
  }

  if (block?.type === "text" && meta.dbType === "socratic") {
    const [concept, ...rest] = text.split(SOCRATIC_SEPARATOR);
    return row("socratic", {
      concept: (concept ?? "").trim(),
      prompt: rest.join(SOCRATIC_SEPARATOR).trim(),
      sessionId: meta.sessionId ?? null,
    });
  }

  switch (block?.type) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
      return row("heading", { text, level: EDITOR_TO_LEVEL[block.type] });

    case "bullet":
      return row("bullet", { text });

    case "number":
      return row("number", { text });

    case "todo":
      return row("todo", { text, checked: Boolean(block.checked) });

    case "quote":
      return row("quote", { text });

    case "callout":
      return row("callout", { text, icon: block.calloutIcon || "💡" });

    case "divider":
      return row("divider", {});

    case "site":
      return row("site", { url: block.url ?? "" });

    case "media":
      return row("media", {
        url: block.url ?? meta.url ?? "",
        caption: text,
        kind: block.mediaKind ?? meta.kind ?? "image",
      });

    case "code":
      return row("code", { text, language: block.language ?? meta.language ?? null });

    case "toggle":
      return row("toggle", { text, open: block.open ?? true, details: block.details ?? block.toggleContent ?? "" });

    case "text":
    default:
      return row("text", { text });
  }
}

/** A persisted note -> the editor's initialBlocks. */
export function toEditorBlocks(note) {
  if (!note?.blocks?.length) return [];
  return note.blocks.map((row, i) => toEditorBlock(row, i));
}

/**
 * Editor blocks -> rows ready for `POST /api/notes/create`.
 *
 * order_index is spaced rather than sequential so a block can later be dropped
 * between two others without renumbering — see the column comment in
 * supabase/schema.sql.
 */
export function toDbBlocks(blocks, { step = 1024 } = {}) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block, i) => ({
    ...toDbBlock(block),
    order_index: (i + 1) * step,
  }));
}
