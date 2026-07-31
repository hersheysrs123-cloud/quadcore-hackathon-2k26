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

/** Human label for the block-type chip in the editor gutter. */
export const BLOCK_TYPE_LABELS = {
  text: "Text",
  heading: "Heading",
  media: "Media",
  socratic: "Socratic",
};
