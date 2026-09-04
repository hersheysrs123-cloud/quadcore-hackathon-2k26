import { getNormalizedTableData, getNormalizedColumnsData } from "./exportImport.js";
import { cleanZeroWidth } from "./editorCaret.js";

/**
 * Best-effort concept label from a raw string.
 *
 * BlockNoteEditor hands the Duck the selected block's text, so this is what
 * turns a paragraph into something usable as a concept name.
 */
export function conceptFromText(text) {
  const trimmed = cleanZeroWidth(text ?? "").trim();
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

  const result = blocks
    .map((block) => {
      if (!block) return "";
      const rawContent = block.content ?? "";
      const content = cleanZeroWidth(typeof rawContent === "string" ? rawContent : String(rawContent)).trim();

      if (block.type === "number") {
        numberIndex += 1;
      } else {
        numberIndex = 0;
      }

      switch (block.type) {
        case "h1":
          return content ? `# ${content}` : "";
        case "h2":
          return content ? `## ${content}` : "";
        case "h3":
          return content ? `### ${content}` : "";
        case "h4":
          return content ? `#### ${content}` : "";
        case "bullet": {
          const indent = "  ".repeat(Math.max(0, Math.min(4, Number(block.level) || 0)));
          return content ? `${indent}- ${content}` : "";
        }
        case "number":
          return content ? `${numberIndex}. ${content}` : "";
        case "todo":
          return `[${block.checked ? "x" : " "}] ${content}`;
        case "quote":
          return content ? `> ${content}` : "";
        case "callout":
          return content ? `> ${block.calloutIcon || "💡"} ${content}` : "";
        case "code":
          return content ? `\`\`\`${block.language || ""}\n${content}\n\`\`\`` : "";
        case "math":
          return content ? `$$\n${content}\n$$` : "";
        case "inlinemath":
          return content ? `$${content}$` : "";
        case "toggle": {
          const summary = content ? `**${content}**` : "";
          const details = (block.details ?? "").trim();
          if (summary && details) return `${summary}\n${details}`;
          return summary || details || "";
        }
        case "table": {
          const data = getNormalizedTableData(block.tableData, content);
          const headers = data.headers && data.headers.length > 0 ? data.headers : ["Col 1", "Col 2"];
          const rows = data.rows || [];
          const colCount = Math.max(headers.length, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)));
          const formatRow = (r) => {
            const cells = [];
            for (let i = 0; i < colCount; i++) {
              cells.push(r && r[i] !== undefined ? String(r[i]).replace(/\|/g, "\\|") : "");
            }
            return `| ${cells.join(" | ")} |`;
          };
          const titlePrefix = block.title ? `${block.title}\n` : "";
          const headLine = formatRow(headers);
          const sepLine = `| ${Array(colCount).fill("---").join(" | ")} |`;
          const rowLines = rows.map((r) => formatRow(r));
          return (titlePrefix + [headLine, sepLine, ...rowLines].join("\n")).trim();
        }
        case "divider":
          return "---";
        case "columns": {
          const count = Math.max(2, Math.min(5, Number(block.columnCount) || 2));
          const cols = getNormalizedColumnsData(block.columnsData, content, count);
          return cols
            .map((c, i) => `### ${c.title || `Column ${i + 1}`}\n${c.content || ""}`)
            .join("\n\n");
        }
        case "site":
          return `[bookmark] ${block.url || content}`;
        default:
          return content;
      }
    })
    .filter(Boolean)
    .join("\n\n");

  return cleanZeroWidth(result);
}

/**
 * Robustly extracts all headings (H1–H4) from note blocks for study scoping and quiz filtering.
 * Supports SocraticOS custom block types (h1–h4), standard heading formats, and Markdown headings.
 */
export function extractHeadingsFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  const headings = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;

    const rawType = String(block.type || "").toLowerCase().trim();
    let level = null;
    let rawText = "";

    // 1. Check known heading types
    if (rawType === "h1" || rawType === "heading1") {
      level = 1;
    } else if (rawType === "h2" || rawType === "heading2") {
      level = 2;
    } else if (rawType === "h3" || rawType === "heading3") {
      level = 3;
    } else if (rawType === "h4" || rawType === "heading4") {
      level = 4;
    } else if (rawType === "heading") {
      level = Number(block.props?.level) || 1;
    }

    // Extract text content from block
    if (typeof block.content === "string") {
      rawText = cleanZeroWidth(block.content);
    } else if (Array.isArray(block.content)) {
      rawText = cleanZeroWidth(
        block.content
          .map((c) => (typeof c === "string" ? c : c?.text || ""))
          .join("")
      );
    } else if (typeof block.text === "string") {
      rawText = cleanZeroWidth(block.text);
    }

    // If it's a recognized heading block type
    if (level !== null) {
      const clean = rawText
        .replace(/^#+\s*/, "")
        .replace(/^(\*+|_+\s*)/, "")
        .replace(/(\*+|_+\s*)$/, "")
        .replace(/[:\s]+$/, "")
        .trim();

      if (clean) {
        headings.push({
          id: block.id || `heading_${i}`,
          type: `H${level}`,
          level,
          text: clean,
        });
      }
      continue;
    }

    // 2. Check if a text / paragraph block contains Markdown heading syntax (#, ##, ###, ####)
    if (typeof block.content === "string" && (rawType === "text" || rawType === "paragraph" || !rawType)) {
      const lines = block.content.split("\n");
      for (const line of lines) {
        const match = line.match(/^(#{1,4})\s+(.+)$/);
        if (match) {
          const hashCount = match[1].length;
          const clean = match[2]
            .replace(/^(\*+|_+\s*)/, "")
            .replace(/(\*+|_+\s*)$/, "")
            .replace(/[:\s]+$/, "")
            .trim();

          if (clean) {
            headings.push({
              id: `${block.id || `blk_${i}`}_h${hashCount}`,
              type: `H${hashCount}`,
              level: hashCount,
              text: clean,
            });
          }
        }
      }
    }
  }

  return headings;
}
