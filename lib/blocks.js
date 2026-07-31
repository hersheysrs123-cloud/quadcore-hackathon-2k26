/**
 * Best-effort concept label from a raw string.
 *
 * BlockNoteEditor hands the Duck the selected block's text, so this is what
 * turns a paragraph into something usable as a concept name.
 */
export function conceptFromText(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "this block";

  // First clause, capped — enough to name the concept without pasting a paragraph.
  const firstClause = trimmed.split(/[.?!\n]/)[0].trim() || trimmed;
  return firstClause.length > 80
    ? `${firstClause.slice(0, 77)}...`
    : firstClause;
}

/** Same, for a persisted block row. */
export function conceptFromBlock(block) {
  if (!block) return "";
  const c = block.content_json ?? {};

  if (block.block_type === "socratic" && c.concept) return c.concept;
  if (c.caption) return c.caption;

  return conceptFromText(c.text);
}

/**
 * Maps a persisted note onto BlockNoteEditor's block shape.
 *
 * The editor's types (h1/h2/h3, bullet, code, action) are a superset of the
 * block_type enum in supabase/schema.sql, so this is lossy in one direction:
 * heading level collapses to h2, and media/socratic blocks flatten to text.
 * Fine while blocks are client-side state — needs a real mapping before any of
 * this persists.
 */
export function toEditorBlocks(note) {
  if (!note?.blocks?.length) return [];

  return note.blocks.map((block, i) => {
    const c = block.content_json ?? {};
    const id = block.id ?? `seed-${i}`;

    switch (block.block_type) {
      case "heading":
        return { id, type: c.level === 1 ? "h1" : "h2", content: c.text ?? "" };
      case "socratic":
        return {
          id,
          type: "text",
          content: [c.concept, c.prompt].filter(Boolean).join(" — "),
        };
      case "media":
        return { id, type: "text", content: c.caption ?? "" };
      case "text":
      default:
        return { id, type: "text", content: c.text ?? "" };
    }
  });
}

/** Flattens live editor blocks back to plain text for the Duck's context. */
export function editorBlocksToText(blocks) {
  if (!Array.isArray(blocks)) return "";

  return blocks
    .map((block) => {
      const content = (block.content ?? "").trim();
      if (!content) return "";
      if (block.type === "h1") return `# ${content}`;
      if (block.type === "h2" || block.type === "h3") return `## ${content}`;
      if (block.type === "bullet") return `- ${content}`;
      if (block.type === "code") return `\`\`\`\n${content}\n\`\`\``;
      return content;
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Flattens a note into plain text for the `noteContent` payload field.
 *
 * The Duck uses this to spot what the learner wrote down but can't explain,
 * so headings and captions are worth keeping — they carry structure.
 */
export function noteToPlainText(note) {
  if (!note?.blocks?.length) return "";

  return note.blocks
    .map((block) => {
      const c = block.content_json ?? {};
      switch (block.block_type) {
        case "heading":
          return c.text ? `## ${c.text}` : "";
        case "media":
          return c.caption ? `[media] ${c.caption}` : "";
        case "socratic":
          return [c.concept && `[flagged] ${c.concept}`, c.prompt]
            .filter(Boolean)
            .join("\n");
        case "text":
        default:
          return c.text ?? "";
      }
    })
    .filter((line) => line.trim().length > 0)
    .join("\n\n");
}

/** Human label for the block-type chip in the editor gutter. */
export const BLOCK_TYPE_LABELS = {
  text: "Text",
  heading: "Heading",
  media: "Media",
  socratic: "Socratic",
};
