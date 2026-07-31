/** Best-effort label for what the Duck should interrogate on a given block. */
export function conceptFromBlock(block) {
  if (!block) return "";
  const c = block.content_json ?? {};

  if (block.block_type === "socratic" && c.concept) return c.concept;
  if (c.caption) return c.caption;

  const text = (c.text ?? "").trim();
  if (!text) return "this block";

  // First clause, capped — enough to name the concept without pasting a paragraph.
  const firstClause = text.split(/[.?!\n]/)[0].trim();
  return firstClause.length > 80
    ? `${firstClause.slice(0, 77)}...`
    : firstClause;
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
