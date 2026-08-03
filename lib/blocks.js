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
 * Flattens live editor blocks to plain text for the Duck's note context.
 *
 * Editor <-> database translation lives in lib/blockMapping.js; this is purely
 * for display, so it renders as light Markdown to keep structure legible to
 * the model.
 */
export function editorBlocksToText(blocks) {
  if (!Array.isArray(blocks)) return "";

  return blocks
    .map((block) => {
      const content = (block.content ?? "").trim();
      if (!content) return "";

      switch (block.type) {
        case "h1":
          return `# ${content}`;
        case "h2":
          return `## ${content}`;
        case "h3":
          return `### ${content}`;
        case "h4":
          return `#### ${content}`;
        case "bullet":
          return `- ${content}`;
        case "number":
          return `1. ${content}`;
        case "todo":
          return `[${block.checked ? "x" : " "}] ${content}`;
        case "quote":
          return `> ${content}`;
        case "callout":
          return `> ${block.calloutIcon || "💡"} ${content}`;
        case "code":
          return `\`\`\`\n${content}\n\`\`\``;
        case "canvas":
          return `[canvas drawing] ${content}`;
        case "notelink":
          return `[linked note] ${block.targetNoteTitle || content}`;
        case "site":
          return `[bookmark] ${block.url || content}`;
        default:
          return content;
      }
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
