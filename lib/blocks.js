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

/**
 * Flattens live editor blocks to plain text for AI (Explain / Quiz / Duck) context.
 */
export function editorBlocksToText(blocks) {
  if (!Array.isArray(blocks)) return "";

  // Tracks position within a run of consecutive "number" blocks so a
  // multi-step procedure reads as "1. ... 2. ... 3. ..." instead of every
  // line being "1." — the AI features (Explain/Quiz/Duck) read this text as
  // the note's content, and a flattened run of "1."s hides step order from
  // them.
  let numberIndex = 0;

  return blocks
    .map((block) => {
      const content = (block.content ?? "").trim();

      if (block.type === "number") {
        numberIndex += 1;
      } else {
        numberIndex = 0;
      }

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
          return `${numberIndex}. ${content}`;
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
        case "site":
          return `[bookmark] ${block.url || content}`;
        default:
          return content;
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
