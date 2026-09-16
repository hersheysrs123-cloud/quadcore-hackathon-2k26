import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import mammoth from "mammoth";
import { saveNote } from "./storageService.js";
import { tokenizeCode } from "./syntaxHighlighter.js";
import { cleanZeroWidth } from "./editorCaret.js";

export const PREVIEWABLE_EXPORT_FORMATS = ["docx", "html", "txt", "md"];

/**
 * ─── UTILITY HELPERS ──────────────────────────────────────────
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function makeBlockId() {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getYouTubeEmbedInfo(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const regExp = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})(?:[?&](?:t|start)=([\w\d]+))?/i;
  const match = trimmed.match(regExp);
  if (!match) return null;

  const videoId = match[1];
  let startTime = 0;
  if (match[2]) {
    const rawTime = match[2];
    if (/^\d+$/.test(rawTime)) {
      startTime = parseInt(rawTime, 10);
    } else {
      const hours = rawTime.match(/(\d+)h/i)?.[1] || 0;
      const mins = rawTime.match(/(\d+)m/i)?.[1] || 0;
      const secs = rawTime.match(/(\d+)s/i)?.[1] || 0;
      startTime = parseInt(hours, 10) * 3600 + parseInt(mins, 10) * 60 + parseInt(secs, 10);
    }
  }

  const queryParams = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
  });
  if (startTime > 0) {
    queryParams.set("start", String(startTime));
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?${queryParams.toString()}`;
  return {
    videoId,
    startTime,
    embedUrl,
  };
}

export function parseMarkdownTableRow(str = "") {
  const trimmed = String(str || "").trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === "\\" && i + 1 < trimmed.length && trimmed[i + 1] === "|") {
      current += "|";
      i++; // skip escaped pipe
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function getNormalizedTableData(tableData, content = "") {
  if (tableData && typeof tableData === "object") {
    const rawHeaders = Array.isArray(tableData.headers)
      ? tableData.headers
      : Array.isArray(tableData.columns)
      ? tableData.columns
      : null;
    const rawRows = Array.isArray(tableData.rows)
      ? tableData.rows
      : Array.isArray(tableData.data)
      ? tableData.data
      : null;

    if (rawHeaders !== null || rawRows !== null) {
      const headers = Array.isArray(rawHeaders) ? rawHeaders.map((h) => String(h ?? "")) : [];
      const rows = Array.isArray(rawRows)
        ? rawRows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : []))
        : [];

      const finalHeaders = headers.length > 0 ? headers : ["Column 1", "Column 2", "Column 3"];
      const finalRows =
        rows.length > 0 ? rows : [Array(finalHeaders.length).fill("")];

      return {
        headers: finalHeaders,
        rows: finalRows,
        hasHeaderRow: tableData.hasHeaderRow !== false,
      };
    }
  }
  if (typeof tableData === "string" && tableData.trim()) {
    try {
      const parsed = JSON.parse(tableData);
      if (parsed && typeof parsed === "object") {
        const rawHeaders = Array.isArray(parsed.headers)
          ? parsed.headers
          : Array.isArray(parsed.columns)
          ? parsed.columns
          : null;
        const rawRows = Array.isArray(parsed.rows)
          ? parsed.rows
          : Array.isArray(parsed.data)
          ? parsed.data
          : null;

        if (rawHeaders !== null || rawRows !== null) {
          const headers = Array.isArray(rawHeaders) ? rawHeaders.map((h) => String(h ?? "")) : [];
          const rows = Array.isArray(rawRows)
            ? rawRows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : []))
            : [];

          const finalHeaders = headers.length > 0 ? headers : ["Column 1", "Column 2", "Column 3"];
          const finalRows =
            rows.length > 0 ? rows : [Array(finalHeaders.length).fill("")];

          return {
            headers: finalHeaders,
            rows: finalRows,
            hasHeaderRow: parsed.hasHeaderRow !== false,
          };
        }
      }
    } catch {}
  }
  if (content && typeof content === "string" && content.includes("|")) {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const tableLines = lines.filter((l) => l.includes("|"));
    if (tableLines.length >= 2) {
      const headerCells = parseMarkdownTableRow(tableLines[0]);
      let startIndex = 1;
      if (tableLines.length > 1 && /^\|?[\s\-:|]+\|?$/.test(tableLines[1])) {
        startIndex = 2;
      }
      const dataRows = [];
      for (let i = startIndex; i < tableLines.length; i++) {
        dataRows.push(parseMarkdownTableRow(tableLines[i]));
      }
      const finalHeaders = headerCells.length > 0 ? headerCells : ["Col 1", "Col 2"];
      const finalRows = dataRows.length > 0 ? dataRows : [Array(finalHeaders.length).fill("")];
      return {
        headers: finalHeaders,
        rows: finalRows,
        hasHeaderRow: true,
      };
    }
  }
  return {
    headers: ["Column 1", "Column 2", "Column 3"],
    rows: [
      ["", "", ""],
      ["", "", ""],
    ],
    hasHeaderRow: true,
  };
}

export function getNormalizedColumnsData(columnsData, content = "", defaultCount = 2) {
  const targetCount = Math.max(2, Math.min(5, Number(defaultCount) || 2));

  if (Array.isArray(columnsData) && columnsData.length > 0) {
    const cols = columnsData.map((c, i) => ({
      id: c?.id || `col_${i + 1}`,
      title: typeof c?.title === "string" ? c.title : `Column ${i + 1}`,
      content: typeof c?.content === "string" ? c.content : (typeof c === "string" ? c : ""),
    }));
    while (cols.length < targetCount) {
      cols.push({ id: `col_${cols.length + 1}`, title: `Column ${cols.length + 1}`, content: "" });
    }
    return cols.slice(0, 5);
  }

  if (typeof columnsData === "string" && columnsData.trim()) {
    try {
      const parsed = JSON.parse(columnsData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return getNormalizedColumnsData(parsed, content, targetCount);
      }
    } catch {}
  }

  if (content && typeof content === "string") {
    if (/^###\s+/m.test(content)) {
      const sections = content.split(/^###\s+/m).filter(Boolean);
      const cols = sections.map((sec, i) => {
        const lines = sec.split(/\r?\n/);
        const title = lines[0]?.trim() || `Column ${i + 1}`;
        const body = lines.slice(1).join("\n").trim();
        return {
          id: `col_${i + 1}`,
          title,
          content: body,
        };
      });
      while (cols.length < targetCount) {
        cols.push({ id: `col_${cols.length + 1}`, title: `Column ${cols.length + 1}`, content: "" });
      }
      return cols.slice(0, 5);
    }
  }

  const defaultCols = [];
  for (let i = 1; i <= targetCount; i++) {
    defaultCols.push({ id: `col_${i}`, title: `Column ${i}`, content: i === 1 ? content : "" });
  }
  return defaultCols;
}



// Matches how blocksToMarkdownLossy writes a callout: "> <icon> <text>".
// Any emoji works as the icon since block.calloutIcon is freeform.
const CALLOUT_QUOTE_RE = /^>\s*(\p{Extended_Pictographic}️?)\s*(.*)$/u;
const OBSIDIAN_CALLOUT_RE = /^>\s*\[!(NOTE|INFO|TIP|WARNING|IMPORTANT|CAUTION|DANGER|QUESTION|HELP|FAQ|SUMMARY|SUCCESS)\](?:\s+(.*))?$/i;

const OBSIDIAN_CALLOUT_ICONS = {
  note: "💡",
  info: "ℹ️",
  tip: "⚡",
  warning: "⚠️",
  important: "📌",
  caution: "🚨",
  danger: "🔥",
  question: "❓",
  help: "🆘",
  faq: "💬",
  summary: "📋",
  success: "✅",
};

function makeFreshNoteId() {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * ─── 1. PDF EXPORT ──────────────────────────────────────────────────────────
 * Uses clean print stylesheet (@media print) and triggers window.print().
 */
export function exportToPdf(noteTitle = "Note") {
  const originalTitle = typeof document !== "undefined" ? document.title : "";
  const originalColorScheme = typeof document !== "undefined" ? document.documentElement.style.colorScheme : "";
  const originalHtmlBg = typeof document !== "undefined" ? document.documentElement.style.backgroundColor : "";
  const originalBodyBg = typeof document !== "undefined" ? document.body.style.backgroundColor : "";

  if (typeof document !== "undefined") {
    document.title = noteTitle || "Note";
    document.documentElement.style.colorScheme = "light";
    document.documentElement.style.backgroundColor = "#ffffff";
    document.body.style.backgroundColor = "#ffffff";
  }

  window.print();

  setTimeout(() => {
    if (typeof document !== "undefined") {
      document.title = originalTitle;
      document.documentElement.style.colorScheme = originalColorScheme;
      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.body.style.backgroundColor = originalBodyBg;
    }
  }, 1000);
}

/**
 * ─── DATA FILTER UTILITY FOR FILE EXPORTS ──────────────────────────────────────────
 * Normalises all editor block types into standard structures
 * ready for Markdown / HTML / DOCX / plain-text serialisers.
 */
export function filterBlocksForExport(blocks = []) {
  if (!Array.isArray(blocks)) return [];

  const sanitized = [];

  for (const block of blocks) {
    if (!block) continue;
    const type = block.type || "text";
    const content = block.content || "";

    switch (type) {
      // ── To-do: strip any stray leading "[ ]" / "[x]" that crept into content
      case "todo": {
        const cleanTodo = content.replace(/^\[[ xX]\]\s*/, "");
        sanitized.push({ ...block, content: cleanTodo });
        break;
      }

      // ── Toggle: preserve with content, details, and auto-expanded in export
      case "toggle": {
        const header = content || "Toggle";
        const details = block.details ?? block.toggleContent ?? "";
        sanitized.push({
          ...block,
          id: block.id || makeBlockId(),
          type: "toggle",
          content: header,
          details: details,
          open: true,
        });
        // Recurse into explicit children if present
        if (Array.isArray(block.children) && block.children.length > 0) {
          sanitized.push(...filterBlocksForExport(block.children));
        }
        break;
      }

      // ── Canvas / Drawing: deleted / deprecated block type -> omit from exports
      case "canvas":
      case "drawing": {
        break;
      }

      // ── Site / Bookmark: preserve as native site block
      case "site":
      case "bookmark":
      case "site_embed": {
        const rawUrl = block.url || block.meta?.url || content || "";
        const title = block.title || block.content || block.meta?.title || "";
        sanitized.push({
          ...block,
          id: block.id || makeBlockId(),
          type: "site",
          url: rawUrl,
          title: title || rawUrl,
          content: title || rawUrl,
        });
        break;
      }

      // ── Media: image / audio / video
      case "media": {
        const mediaUrl = block.url || block.meta?.url || content || "";
        const kind = block.mediaKind || block.meta?.kind || "image";
        const size = block.size || block.width || block.meta?.size || block.meta?.width || "100%";
        sanitized.push({
          ...block,
          id: block.id || makeBlockId(),
          type: "media",
          url: mediaUrl,
          content: content,
          mediaKind: kind,
          size: size,
          width: size,
        });
        break;
      }

      // ── Multi-Column Layout Block (2 to 5 columns)
      case "columns": {
        const count = Math.max(2, Math.min(5, Number(block.columnCount) || 2));
        const cols = getNormalizedColumnsData(block.columnsData, block.content, count);
        sanitized.push({
          ...block,
          id: block.id || makeBlockId(),
          type: "columns",
          columnCount: count,
          columnsData: cols,
          content: block.content || "",
        });
        break;
      }

      // ── Code, Math & Inline Math pass through unmodified so serialisers can format them
      case "code":
      case "math":
      case "inlinemath":
        sanitized.push({ ...block });
        break;

      default:
        sanitized.push({ ...block });
        break;
    }
  }

  return sanitized.map((block) => {
    if (!block) return block;
    const cleanB = { ...block };
    if (typeof cleanB.content === "string") cleanB.content = cleanZeroWidth(cleanB.content);
    if (typeof cleanB.title === "string") cleanB.title = cleanZeroWidth(cleanB.title);
    if (typeof cleanB.details === "string") cleanB.details = cleanZeroWidth(cleanB.details);
    if (typeof cleanB.formula === "string") cleanB.formula = cleanZeroWidth(cleanB.formula);
    if (typeof cleanB.caption === "string") cleanB.caption = cleanZeroWidth(cleanB.caption);
    if (typeof cleanB.url === "string") cleanB.url = cleanZeroWidth(cleanB.url);
    if (Array.isArray(cleanB.columnsData)) {
      cleanB.columnsData = cleanB.columnsData.map((c) => ({
        ...c,
        title: typeof c.title === "string" ? cleanZeroWidth(c.title) : c.title,
        content: typeof c.content === "string" ? cleanZeroWidth(c.content) : c.content,
      }));
    }
    if (cleanB.tableData && typeof cleanB.tableData === "object") {
      const td = { ...cleanB.tableData };
      if (Array.isArray(td.headers)) {
        td.headers = td.headers.map((h) => (typeof h === "string" ? cleanZeroWidth(h) : h));
      }
      if (Array.isArray(td.rows)) {
        td.rows = td.rows.map((row) =>
          Array.isArray(row)
            ? row.map((cell) => (typeof cell === "string" ? cleanZeroWidth(cell) : cell))
            : row
        );
      }
      cleanB.tableData = td;
    }
    return cleanB;
  });
}

/**
 * ─── 2. MARKDOWN EXPORT & IMPORT ──────────────────────────────────────────
 * blocksToMarkdownLossy() & tryParseMarkdownToBlocks()
 */
export function blocksToMarkdownLossy(rawBlocks = [], title = "") {
  const blocks = filterBlocksForExport(rawBlocks);
  // A running count of consecutive numbered items, so a three-item list
  // renders "1. / 2. / 3." rather than "1." three times over. It resets the
  // moment a non-number block breaks the run.
  let numberIndex = 0;

  const mdBody = blocks
    .map((block) => {
      const content = block.content || "";
      if (block.type !== "number") numberIndex = 0;
      switch (block.type) {
        case "h1":
          return `# ${content}`;
        case "h2":
          return `## ${content}`;
        case "h3":
          return `### ${content}`;
        case "h4":
          return `#### ${content}`;
        case "bullet": {
          const indent = "  ".repeat(Math.max(0, Math.min(4, Number(block.level) || 0)));
          return `${indent}- ${content}`;
        }
        case "number":
          numberIndex += 1;
          return `${numberIndex}. ${content}`;
        case "todo":
          return `- [${block.checked ? "x" : " "}] ${content}`;
        case "toggle": {
          const details = block.details ?? block.toggleContent ?? "";
          return details ? `<details>\n<summary>${content}</summary>\n${details}\n</details>` : `<details>\n<summary>${content}</summary>\n</details>`;
        }
        case "quote":
          return `> ${content}`;
        case "callout":
          return `> ${block.calloutIcon || "💡"} ${content}`;
        case "divider":
          return `---`;
        case "code": {
          const lang = block.language || block.meta?.language || "";
          return `\`\`\`${lang}\n${content}\n\`\`\``;
        }
        case "math":
          return `$$\n${content}\n$$`;
        case "inlinemath":
          return `$${content}$`;
        case "site": {
          const url = block.url || block.content || "";
          const title = block.title || block.content || url || "Bookmark";
          return url ? `[${title}](${url})` : title;
        }
        case "page": {
          const pageTitle = block.title || block.content || "Untitled Note";
          return `${block.emoji || "📄"} **${pageTitle}** _(sub-page)_`;
        }
        case "media": {
          const mediaUrl = block.url || block.content || "";
          const ytInfo = getYouTubeEmbedInfo(mediaUrl);
          const kind = ytInfo ? "youtube" : (block.mediaKind || "image");
          const caption = block.content || (kind === "youtube" ? "YouTube Video" : kind);
          if (kind === "youtube") {
            return `[![YouTube Video: ${caption}](${mediaUrl})](${mediaUrl})`;
          }
          return mediaUrl ? `![${caption}](${mediaUrl})` : `[${kind}]`;
        }
        case "canvas":
        case "drawing":
          return "";
        case "columns": {
          const count = Math.max(2, Math.min(5, Number(block.columnCount) || 2));
          const cols = getNormalizedColumnsData(block.columnsData, block.content, count);
          return cols
            .map((c, i) => `### ${c.title || `Column ${i + 1}`}\n${c.content || ""}`)
            .join("\n\n");
        }
        case "table": {
          const data = getNormalizedTableData(block.tableData, block.content);
          const headers = data.headers && data.headers.length > 0 ? data.headers : ["Col 1", "Col 2"];
          const rows = data.rows || [];
          const colCount = Math.max(headers.length, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)));
          const formatRow = (r) => {
            const cells = [];
            for (let i = 0; i < colCount; i++) {
              const cellVal = (r && r[i] !== undefined ? String(r[i]) : "").replace(/\|/g, "\\|");
              cells.push(cellVal);
            }
            return `| ${cells.join(" | ")} |`;
          };
          const headLine = formatRow(headers);
          const sepLine = `| ${Array(colCount).fill("---").join(" | ")} |`;
          const rowLines = rows.map((r) => formatRow(r));
          return [headLine, sepLine, ...rowLines].join("\n");
        }
        case "text":
        default:
          return content;
      }
    })
    .join("\n\n");

  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  const hasMatchingFirstH1 = blocks[0]?.type === "h1" && blocks[0]?.content?.trim().toLowerCase() === trimmedTitle.toLowerCase();
  const titlePrefix = (trimmedTitle && !hasMatchingFirstH1) ? `# ${trimmedTitle}\n\n` : "";

  return titlePrefix + mdBody;
}

export function tryParseMarkdownToBlocks(rawMarkdown = "") {
  if (!rawMarkdown || typeof rawMarkdown !== "string") return [];

  const lines = rawMarkdown.split(/\r?\n/);
  const resultBlocks = [];
  let inCodeBlock = false;
  let codeLang = null;
  let codeBuffer = [];

  let inMathBlock = false;
  let mathBuffer = [];

  let inDetailsBlock = false;
  let detailsSummary = "";
  let detailsContentBuffer = [];
  let detailsOpen = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Block Delimiters
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim() || null;
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        resultBlocks.push({
          id: makeBlockId(),
          type: "code",
          content: codeBuffer.join("\n"),
          language: codeLang,
          meta: { language: codeLang },
        });
        codeBuffer = [];
        codeLang = null;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // 2. Math Block Delimiters & Jumbled Equation Lines
    if (trimmed.startsWith("$$") || (trimmed.endsWith("$$") && /\\(text|frac|rightarrow|sum|int|sqrt|vec|alpha|beta|gamma|theta|lambda|pi|mu|sigma|omega|Delta|nabla|partial|times|cdot|approx|ne|le|ge|pm|infty|in|subset|cup|cap|to|Rightarrow|Longleftrightarrow|left|right|begin)/.test(trimmed))) {
      if (!inMathBlock) {
        if (trimmed.endsWith("$$") && trimmed.length > 2) {
          const cleanMath = trimmed.replace(/^\$\$+|\$\$+$/g, "").trim();
          if (cleanMath) {
            resultBlocks.push({
              id: makeBlockId(),
              type: "math",
              content: cleanMath,
            });
            continue;
          }
        }
        inMathBlock = true;
        const rest = trimmed.replace(/^\$\$+/, "").trim();
        mathBuffer = rest ? [rest] : [];
      } else {
        inMathBlock = false;
        const rest = trimmed.replace(/\$\$+$/, "").trim();
        if (rest) mathBuffer.push(rest);
        resultBlocks.push({
          id: makeBlockId(),
          type: "math",
          content: mathBuffer.join("\n"),
        });
        mathBuffer = [];
      }
      continue;
    }

    if (inMathBlock) {
      mathBuffer.push(line);
      continue;
    }

    // 3. Single-line <details><summary>Title</summary>Details</details>
    const singleDetailsMatch = trimmed.match(/<details[^>]*>\s*<summary>(.*?)<\/summary>(.*?)<\/details>/i);
    if (singleDetailsMatch) {
      resultBlocks.push({
        id: makeBlockId(),
        type: "toggle",
        content: singleDetailsMatch[1].replace(/<[^>]+>/g, "").trim() || "Toggle",
        details: singleDetailsMatch[2].replace(/<[^>]+>/g, "").trim(),
        open: !trimmed.includes('open="false"'),
      });
      continue;
    }

    // 4. Multiline <details> Block
    if (trimmed.toLowerCase().startsWith("<details")) {
      inDetailsBlock = true;
      detailsOpen = !trimmed.includes('open="false"');
      detailsSummary = "";
      detailsContentBuffer = [];
      const summaryMatch = trimmed.match(/<summary>(.*?)<\/summary>/i);
      if (summaryMatch) {
        detailsSummary = summaryMatch[1].replace(/<[^>]+>/g, "").trim();
      }
      continue;
    }

    if (inDetailsBlock) {
      if (trimmed.toLowerCase().includes("</details>")) {
        const rest = line.replace(/<\/details>/gi, "").replace(/<\/?div[^>]*>/gi, "").trim();
        if (rest) detailsContentBuffer.push(rest);
        inDetailsBlock = false;
        resultBlocks.push({
          id: makeBlockId(),
          type: "toggle",
          content: detailsSummary || "Toggle",
          details: detailsContentBuffer.join("\n").trim(),
          open: detailsOpen,
        });
        detailsSummary = "";
        detailsContentBuffer = [];
        continue;
      }

      const summaryMatch = trimmed.match(/<summary>(.*?)<\/summary>/i);
      if (summaryMatch) {
        detailsSummary = summaryMatch[1].replace(/<[^>]+>/g, "").trim();
        continue;
      }

      const cleanDetailLine = line.replace(/<\/?div[^>]*>/gi, "").replace(/<\/?p[^>]*>/gi, "").trim();
      if (cleanDetailLine) detailsContentBuffer.push(cleanDetailLine);
      continue;
    }

    if (!trimmed) continue;

    // 4.5 Markdown Tables (| Header 1 | Header 2 | \n | --- | --- | or Header 1 | Header 2 \n --- | ---)
    if (trimmed.includes("|")) {
      const nextLine = (lines[i + 1] || "").trim();
      const isSeparator = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(nextLine);
      if (isSeparator) {
        const headers = parseMarkdownTableRow(trimmed);
        const rows = [];
        i += 1; // consume separator line

        while (i + 1 < lines.length) {
          const rowLine = lines[i + 1].trim();
          if (rowLine.includes("|") && !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(rowLine)) {
            rows.push(parseMarkdownTableRow(rowLine));
            i += 1;
          } else {
            break;
          }
        }

        resultBlocks.push({
          id: makeBlockId(),
          type: "table",
          content: "",
          tableData: {
            headers: headers.length > 0 ? headers : ["Col 1", "Col 2"],
            rows: rows.length > 0 ? rows : [["", ""]],
            hasHeaderRow: true,
          },
        });
        continue;
      }
    }

    // 4.7 Standalone bold category subheadings ending with colon (e.g. "* **Eye Structures:**", "**Eye Structures:**" or "**Eye Structures**:")
    const boldHeadingMatch = trimmed.match(/^(?:[*•\-+]\s*)?\*\*([^*:]+)(?::\*\*|\*\*:)[\s]*$/);
    if (boldHeadingMatch) {
      const headingText = boldHeadingMatch[1].trim();
      if (headingText) {
        resultBlocks.push({
          id: makeBlockId(),
          type: "h3",
          content: headingText,
        });
        continue;
      }
    }

    // 5. Standard Markdown Tasks (Must be checked before generic bullets!)
    const taskMatch = trimmed.match(/^[-*+]?\s*\[([ xX])\]\s*(.*)$/);

    if (taskMatch) {
      resultBlocks.push({
        id: makeBlockId(),
        type: "todo",
        content: taskMatch[2].trim(),
        checked: taskMatch[1].toLowerCase() === "x",
      });
      continue;
    }

    // 6. Headings
    if (trimmed.startsWith("#### ")) {
      resultBlocks.push({ id: makeBlockId(), type: "h4", content: trimmed.slice(5).replace(/^(\*+|\#+|\s*)+/, "").replace(/(\*+|\s*)+$/, "").replace(/[:\s]+$/, "").trim() });
    } else if (trimmed.startsWith("### ")) {
      resultBlocks.push({ id: makeBlockId(), type: "h3", content: trimmed.slice(4).replace(/^(\*+|\#+|\s*)+/, "").replace(/(\*+|\s*)+$/, "").replace(/[:\s]+$/, "").trim() });
    } else if (trimmed.startsWith("## ")) {
      resultBlocks.push({ id: makeBlockId(), type: "h2", content: trimmed.slice(3).replace(/^(\*+|\#+|\s*)+/, "").replace(/(\*+|\s*)+$/, "").replace(/[:\s]+$/, "").trim() });
    } else if (trimmed.startsWith("# ")) {
      resultBlocks.push({ id: makeBlockId(), type: "h1", content: trimmed.slice(2).replace(/^(\*+|\#+|\s*)+/, "").replace(/(\*+|\s*)+$/, "").replace(/[:\s]+$/, "").trim() });
    }
    // 7. Bullets
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("+ ")) {
      let bContent = trimmed.slice(2).trim();
      if (bContent.startsWith("* ") || bContent.startsWith("- ") || bContent.startsWith("+ ")) {
        bContent = bContent.replace(/^[*•\-+]\s+/, "").trim();
      }
      const indentSpaces = (line.match(/^(\s*)/)[1] || "").replace(/\t/g, "  ").length;
      const level = Math.min(4, Math.floor(indentSpaces / 2));
      resultBlocks.push({
        id: makeBlockId(),
        type: "bullet",
        content: bContent,
        ...(level > 0 ? { level } : {}),
      });
    }



    // 8. Numbered list items
    else if (/^\d+\.\s/.test(trimmed)) {
      resultBlocks.push({ id: makeBlockId(), type: "number", content: trimmed.replace(/^\d+\.\s/, "").trim() });
    }
    // 9. Obsidian / GitHub Style Callouts: > [!NOTE], > [!WARNING], > [!TIP], etc.
    else if (OBSIDIAN_CALLOUT_RE.test(line)) {
      const match = line.match(OBSIDIAN_CALLOUT_RE);
      const calloutType = (match[1] || "note").toLowerCase();
      const icon = OBSIDIAN_CALLOUT_ICONS[calloutType] || "💡";
      const calloutText = (match[2] || "").trim();
      resultBlocks.push({
        id: makeBlockId(),
        type: "callout",
        content: calloutText,
        calloutIcon: icon,
      });
    }
    // 10. Unicode Emoji Callouts: > 💡 text, > ⚠️ text, 💡 text
    else if (CALLOUT_QUOTE_RE.test(line)) {
      const [, icon, content] = line.match(CALLOUT_QUOTE_RE);
      resultBlocks.push({ id: makeBlockId(), type: "callout", content: content.trim(), calloutIcon: icon });
    } else if (line.startsWith("💡 ") || line.startsWith(">! ")) {
      resultBlocks.push({ id: makeBlockId(), type: "callout", content: line.slice(3).trim(), calloutIcon: "💡" });
    }
    // 11. Plain Blockquote
    else if (line.startsWith("> ")) {
      resultBlocks.push({ id: makeBlockId(), type: "quote", content: line.slice(2).trim() });
    }
    // 12. Dividers
    else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      resultBlocks.push({ id: makeBlockId(), type: "divider", content: "" });
    }
    // 13. Standalone inline math line: $$formula$$
    else if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 2) {
      resultBlocks.push({ id: makeBlockId(), type: "math", content: trimmed.slice(2, -2).trim() });
    }
    // 14. Media Image / YouTube: ![caption](url)
    else if (/^!\[(.*?)\]\((.*?)\)$/.test(trimmed)) {
      const match = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
      const url = match[2];
      const ytInfo = getYouTubeEmbedInfo(url);
      resultBlocks.push({
        id: makeBlockId(),
        type: "media",
        content: match[1],
        url: url,
        mediaKind: ytInfo ? "youtube" : "image",
      });
    }
    // 14.5 Standalone YouTube URL
    else if (getYouTubeEmbedInfo(trimmed) && /^https?:\/\//i.test(trimmed)) {
      resultBlocks.push({
        id: makeBlockId(),
        type: "media",
        content: "",
        url: trimmed,
        mediaKind: "youtube",
      });
    }
    // 15. Site Bookmark link: [title](url)
    else if (/^\[(.*?)\]\((https?:\/\/.*?)\)$/.test(trimmed)) {
      const match = trimmed.match(/^\[(.*?)\]\((https?:\/\/.*?)\)$/);
      resultBlocks.push({
        id: makeBlockId(),
        type: "site",
        content: match[1],
        url: match[2],
      });
    }
    // 16. Regular Text Paragraph
    else {
      resultBlocks.push({ id: makeBlockId(), type: "text", content: line });
    }
  }

  if (codeBuffer.length > 0) {
    resultBlocks.push({ id: makeBlockId(), type: "code", content: codeBuffer.join("\n"), language: codeLang, meta: { language: codeLang } });
  }
  if (mathBuffer.length > 0) {
    resultBlocks.push({ id: makeBlockId(), type: "math", content: mathBuffer.join("\n") });
  }
  if (inDetailsBlock && detailsSummary) {
    resultBlocks.push({
      id: makeBlockId(),
      type: "toggle",
      content: detailsSummary,
      details: detailsContentBuffer.join("\n").trim(),
      open: detailsOpen,
    });
  }

  return resultBlocks.length > 0 ? resultBlocks : [{ id: makeBlockId(), type: "text", content: rawMarkdown }];
}

export function exportMarkdown(blocks, title = "Note") {
  const mdContent = blocksToMarkdownLossy(blocks, title);
  const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
  const filename = `${title.replace(/[^a-z0-9_-]/gi, "_") || "Note"}.md`;
  triggerDownload(blob, filename);
}

/**
 * ─── 3. HTML EXPORT & IMPORT ──────────────────────────────────────────
 * blocksToHTMLLossy() & tryParseHTMLToBlocks()
 */
const TOKEN_HTML_COLORS = {
  keyword: "#f472b6", // pink-400
  type: "#67e8f9", // cyan-300
  builtin: "#60a5fa", // blue-400
  string: "#6ee7b7", // emerald-300
  comment: "#64748b", // slate-500
  number: "#fbbf24", // amber-400
  operator: "#fde047", // duck-300
  tag: "#fb7185", // rose-400
  attribute: "#d8b4fe", // purple-300
  decorator: "#facc15", // yellow-400
  function: "#7dd3fc", // sky-300
  punctuation: "#94a3b8", // slate-400
  "json-key": "#7dd3fc", // sky-300
};

function highlightCodeToHtml(code, language) {
  if (!code) return "";
  const tokens = tokenizeCode(code, language);
  if (!tokens || tokens.length === 0) return escapeHtml(code);
  return tokens
    .map((tok) => {
      const escaped = escapeHtml(tok.text);
      const color = TOKEN_HTML_COLORS[tok.type];
      if (color) {
        const fontStyle =
          tok.type === "comment"
            ? "font-style:italic;"
            : tok.type === "keyword" || tok.type === "json-key"
            ? "font-weight:600;"
            : "";
        return `<span style="color:${color};${fontStyle}">${escaped}</span>`;
      }
      return escaped;
    })
    .join("");
}

export function formatInlineMarkdownForHtml(text = "") {
  if (!text) return "";
  const str = String(text);

  // 1. Math tokens ($formula$ or $$formula$$)
  const mathTokens = [];
  let processed = str.replace(/\$\$([^$]+)\$\$|\$([^\s$](?:[^$\n]*[^\s$])?)\$/g, (match, dFormula, sFormula) => {
    const formula = (dFormula || sFormula || "").trim();
    if (!formula) return match;
    const token = `\u0000MATH_${mathTokens.length}\u0000`;
    mathTokens.push(`<span class="inline-math">$${escapeHtml(formula)}$</span>`);
    return token;
  });

  // 2. Code tokens (`code`)
  const codeTokens = [];
  processed = processed.replace(/`([^`\n]+)`/g, (match, code) => {
    const token = `\u0000CODE_${codeTokens.length}\u0000`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  // 3. Links
  const linkTokens = [];
  processed = processed.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|#[^\s)]+)\)/g, (match, linkText, url) => {
    const token = `\u0000LINK_${linkTokens.length}\u0000`;
    linkTokens.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`);
    return token;
  });

  // 4. Escape HTML for the rest
  processed = escapeHtml(processed);

  // 5. Bold & Italic
  processed = processed.replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  processed = processed.replace(/___([^_\n]+)___/g, "<strong><em>$1</em></strong>");

  // 6. Bold
  processed = processed.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  processed = processed.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");

  // 7. Italic
  processed = processed.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  processed = processed.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?])/g, "$1<em>$2</em>");

  // 8. Strikethrough
  processed = processed.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  // 9. Highlight
  processed = processed.replace(/==([^=\n]+)==/g, "<mark>$1</mark>");

  // 10. Restore tokens
  linkTokens.forEach((linkHtml, idx) => {
    processed = processed.replace(`\u0000LINK_${idx}\u0000`, linkHtml);
  });
  codeTokens.forEach((codeHtml, idx) => {
    processed = processed.replace(`\u0000CODE_${idx}\u0000`, codeHtml);
  });
  mathTokens.forEach((mathHtml, idx) => {
    processed = processed.replace(`\u0000MATH_${idx}\u0000`, mathHtml);
  });

  return processed;
}

/** Render one non-list block to HTML. Lists are handled by the caller, since
 * consecutive items need to share a single <ul>/<ol> rather than one each. */
function blockToHtmlFragment(block, allBlocks = []) {
  const content = formatInlineMarkdownForHtml(block.content || "");
  const headingId = block.id ? ` id="block-${escapeHtml(block.id)}"` : "";

  switch (block.type) {
    case "h1":
      return `<h1${headingId}>${content}</h1>`;
    case "h2":
      return `<h2${headingId}>${content}</h2>`;
    case "h3":
      return `<h3${headingId}>${content}</h3>`;
    case "h4":
      return `<h4${headingId}>${content}</h4>`;
    case "todo":
      return `<p class="todo-item">${
        block.checked
          ? `<span class="todo-check checked">✓</span><span class="todo-text checked">${content}</span>`
          : `<span class="todo-check unchecked"></span><span class="todo-text">${content}</span>`
      }</p>`;
    case "toggle": {
      const details = block.details ?? block.toggleContent ?? "";
      return `<details open><summary>${content}</summary><div class="toggle-details">${formatInlineMarkdownForHtml(details)}</div></details>`;
    }
    case "quote":
      return `<blockquote>${content}</blockquote>`;
    case "callout":
      return `<div class="callout"><span style="font-size:18px; line-height:1.2;">${block.calloutIcon || "💡"}</span><div style="color:#e2e8f0; font-size:14px; line-height:1.5;">${content}</div></div>`;
    case "code": {
      const rawLang = block.language || block.meta?.language || "javascript";
      const lang = escapeHtml(rawLang.toLowerCase());
      const displayLang = escapeHtml(rawLang.toUpperCase());
      const highlighted = highlightCodeToHtml(block.content || "", rawLang);
      return `<div class="code-block"><div class="code-header"><span style="font-weight:600; color:#e2e8f0;">&lt;/&gt; Code Snippet</span><span class="code-lang-badge">${displayLang}</span></div><pre><code class="language-${lang}">${highlighted}</code></pre></div>`;
    }
    case "math":
      return `<div class="math">$$${escapeHtml(block.content || "")}$$</div>`;
    case "inlinemath":
      return `<div class="inlinemath">$${escapeHtml(block.content || "")}$</div>`;
    case "table": {
      const data = block.tableData || { headers: [], rows: [] };
      const headers = data.headers && data.headers.length > 0 ? data.headers : ["Col 1", "Col 2"];
      const rows = data.rows || [];
      const theadHtml = `<thead><tr>${headers.map((h) => `<th>${formatInlineMarkdownForHtml(h)}</th>`).join("")}</tr></thead>`;
      const tbodyHtml = `<tbody>${rows
        .map((r) => `<tr>${headers.map((_, i) => `<td>${formatInlineMarkdownForHtml(r[i] || "")}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      return `<div class="table-container" style="margin:16px 0; overflow-x:auto;"><table class="socratic-table" style="width:100%; border-collapse:collapse; background:#181c27; border:1px solid #334155; border-radius:8px; overflow:hidden;">${theadHtml}${tbodyHtml}</table></div>`;
    }
    case "divider":
      return `<hr />`;
    case "page": {
      const pageTitle = escapeHtml(block.title || block.content || "Untitled Note");
      const pageEmoji = escapeHtml(block.emoji || "📄");
      return `<div class="site-bookmark page-card"><span style="font-size:18px;">${pageEmoji}</span><div style="min-width:0; flex:1;"><span style="color:#f1f3fa; font-weight:600; font-size:14px; display:block;">${pageTitle}</span><span style="color:#94a3b8; font-size:12px; display:block;">Sub-page</span></div><span style="color:#94a3b8;">→</span></div>`;
    }
    case "site": {
      const url = escapeHtml(block.url || block.content || "");
      const siteTitle = escapeHtml(block.title || block.url || block.content || "");
      return `<div class="site-bookmark"><span style="font-size:18px;">🌐</span><div style="min-width:0; flex:1;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; text-decoration:none; font-weight:600; font-size:14px; display:block;">${siteTitle}</a><span style="color:#94a3b8; font-size:12px; display:block; word-break:break-all;">${url}</span></div></div>`;
    }
    case "media": {
      const mediaUrl = escapeHtml(block.url || block.content || "");
      const rawUrl = block.url || block.content || "";
      const ytInfo = getYouTubeEmbedInfo(rawUrl);
      const kind = ytInfo ? "youtube" : (block.mediaKind || "image");
      const currentSize = block.size || block.width || "100%";
      const sizeStyle =
        currentSize === "25%"
          ? "max-width:25%; min-width:220px; margin:16px auto;"
          : currentSize === "50%"
          ? "max-width:50%; min-width:320px; margin:16px auto;"
          : "max-width:100%; margin:16px 0;";

      if (kind === "youtube" && ytInfo) {
        return `<div class="media-youtube" style="${sizeStyle} position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; background:#000;"><iframe src="${escapeHtml(ytInfo.embedUrl)}" title="${escapeHtml(block.content || "YouTube video player")}" style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>${block.content ? `<p style="font-size:12px; color:#9aa2bc; margin-top:4px; text-align:center;">${escapeHtml(block.content)}</p>` : ""}`;
      } else if (kind === "audio") {
        return `<div class="media-audio" style="margin:16px 0;"><audio src="${mediaUrl}" controls style="width:100%;"></audio></div>`;
      } else if (kind === "video") {
        return `<div class="media-video" style="${sizeStyle}"><video src="${mediaUrl}" controls style="width:100%; max-height:28rem; border-radius:8px;"></video></div>`;
      } else {
        return `<div class="media-image" style="${sizeStyle} text-align:center;"><img src="${mediaUrl}" alt="${escapeHtml(block.content || "media")}" style="max-width:100%; max-height:28rem; border-radius:8px; object-contain:contain;" />${block.content ? `<p style="font-size:12px; color:#9aa2bc; margin-top:4px;">${escapeHtml(block.content)}</p>` : ""}</div>`;
      }
    }
    case "canvas":
    case "drawing": {
      return "";
    }
    case "columns": {
      const count = Math.max(2, Math.min(5, Number(block.columnCount) || 2));
      const cols = getNormalizedColumnsData(block.columnsData, block.content, count);
      const colHtml = cols
        .map((c, i) => {
          const titleHtml = c.title
            ? `<div style="font-weight:600; color:#f1f5f9; font-size:13px; margin-bottom:8px; border-bottom:1px solid #334155; padding-bottom:4px;">${escapeHtml(c.title)}</div>`
            : "";
          const bodyHtml = formatInlineMarkdownForHtml(c.content || "").replace(/\n/g, "<br/>");
          return `<div class="column-item" style="background:#181c27; border:1px solid #334155; border-radius:10px; padding:12px; min-width:0;">${titleHtml}<div style="color:#cbd5e1; font-size:13px; line-height:1.5;">${bodyHtml || "<span style='color:#64748b; font-style:italic;'>Empty column</span>"}</div></div>`;
        })
        .join("");
      return `<div class="columns-block" style="display:grid; grid-template-columns: repeat(${count}, minmax(0, 1fr)); gap:14px; margin:16px 0;">${colHtml}</div>`;
    }
    case "text":
    default:
      return content ? `<p>${content}</p>` : "";
  }
}

export function blocksToHTMLLossy(rawBlocks = [], title = "Untitled Note", emoji = "📝") {
  const blocks = filterBlocksForExport(rawBlocks);
  const pieces = [];
  // Consecutive bullet/number blocks share one <ul>/<ol> instead of each
  // getting its own single-item list.
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listType) return;
    const tag = listType === "bullet" ? "ul" : "ol";
    pieces.push(`<${tag}>${listItems.join("")}</${tag}>`);
    listType = null;
    listItems = [];
  };

  (blocks || []).forEach((block) => {
    if (block.type === "bullet" || block.type === "number") {
      if (listType && listType !== block.type) flushList();
      listType = block.type;
      const lvl = Math.max(0, Math.min(4, Number(block.level) || 0));
      const numberStyle = lvl === 1 ? 'lower-alpha' : lvl === 2 ? 'lower-roman' : lvl === 3 ? 'upper-alpha' : 'decimal';
      const bulletStyle = lvl === 1 ? 'circle' : 'square';
      const listStyle = block.type === 'number' ? numberStyle : bulletStyle;
      const styleAttr = lvl > 0 ? ` style="margin-left: ${lvl * 1.5}em; list-style-type: ${listStyle};"` : "";
      listItems.push(`<li${styleAttr}>${formatInlineMarkdownForHtml(block.content || "")}</li>`);
      return;
    }
    flushList();
    const html = blockToHtmlFragment(block, blocks);
    if (html) pieces.push(html);
  });
  flushList();


  const contentHtml = pieces.join("\n  ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.65; max-width: 820px; margin: 40px auto; padding: 0 24px; background-color: #12151e; color: #f1f3fa; }
    h1, h2, h3, h4 { color: #f8fafc; font-weight: 700; margin-top: 1.4em; margin-bottom: 0.4em; }
    h1 { font-size: 1.85em; line-height: 1.25; color: #ffffff; }
    h2 { font-size: 1.45em; line-height: 1.3; color: #f8fafc; }
    h3 { font-size: 1.25em; line-height: 1.35; color: #f1f5f9; }
    h4 { font-size: 1.1em; color: #e2e8f0; }
    .note-title { color: #ffffff; font-size: 2.2em; font-weight: 800; border-bottom: 1px solid #334155; padding-bottom: 12px; margin-top: 0; margin-bottom: 24px; }
    code, pre { font-family: 'Consolas', 'Courier New', monospace; }
    blockquote { border-left: 4px solid #f0c04a; margin: 16px 0; padding: 10px 16px; color: #cbd5e1; font-style: italic; background: rgba(24, 28, 39, 0.5); border-radius: 0 6px 6px 0; }
    ul, ol { margin: 10px 0; padding-left: 1.5em; color: #f1f3fa; }
    li { margin: 4px 0; }
    p { margin: 10px 0; color: #f1f3fa; line-height: 1.65; }
    .todo-item { margin: 8px 0; color: #f1f3fa; display: flex; align-items: center; gap: 10px; line-height: 1.5; }
    .todo-check { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0; user-select: none; font-size: 11px; font-weight: bold; }
    .todo-check.checked { background: #0284c7; border: 1.5px solid #38bdf8; color: #ffffff; }
    .todo-check.unchecked { background: #181c27; border: 1.5px solid #475569; }
    .math { text-align: center; font-family: monospace; padding: 12px 16px; background: #181c27; border: 1px solid rgba(240, 192, 74, 0.4); margin: 16px 0; border-radius: 8px; color: #f7d67c; overflow-x: auto; }
    .inlinemath { display: inline-block; padding: 2px 4px; background: transparent; border: none; margin: 0; }
    .inline-math { display: inline-block; padding: 2px 4px; background: transparent; border: none; margin: 0; }
    .katex, .katex-display, .katex * { color: #f7d67c !important; }
    .socratic-table { width: 100%; border-collapse: collapse; margin: 16px 0; background: #181c27; border: 1px solid #334155; border-radius: 8px; overflow: hidden; font-size: 13px; }
    .socratic-table th { background: #12151e; color: #f7d67c; padding: 10px 14px; text-align: left; font-weight: 600; border-bottom: 1px solid #334155; border-right: 1px solid #334155; }
    .socratic-table th:last-child { border-right: none; }
    .socratic-table td { padding: 8px 14px; color: #e2e8f0; border-bottom: 1px solid #232938; border-right: 1px solid #232938; }
    .socratic-table td:last-child { border-right: none; }
    .socratic-table tr:last-child td { border-bottom: none; }
    .socratic-table tr:hover td { background: rgba(255, 255, 255, 0.03); }
    .callout { padding: 14px 16px; border-left: 4px solid #f59e0b; background: #181c27; margin: 16px 0; border-radius: 6px; display: flex; align-items: flex-start; gap: 10px; }
    .code-block { background: #1e2433; border: 1px solid #334155; border-radius: 8px; overflow: hidden; margin: 16px 0; }
    .code-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; background: #181c27; border-bottom: 1px solid #334155; font-size: 12px; font-family: 'Consolas', 'Courier New', monospace; color: #94a3b8; }
    .code-lang-badge { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 2px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    .code-block pre { margin: 0; border: none; border-radius: 0; padding: 14px; overflow-x: auto; background: #12151e; }
    .code-block code { color: #e2e8f0; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.5; }
    .site-bookmark { margin: 16px 0; padding: 12px 16px; background: #181c27; border: 1px solid #334155; border-radius: 8px; display: flex; align-items: center; gap: 12px; }
    details { margin: 16px 0; padding: 12px 16px; background: #181c27; border-radius: 8px; border: 1px solid #363d54; }
    summary { cursor: pointer; font-weight: 600; color: #f8fafc; font-size: 14px; }
    .toggle-details { margin-top: 10px; padding-left: 14px; border-left: 2.5px solid #64748b; color: #cbd5e1; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
    hr { border: 0; border-top: 1px solid #363d54; margin: 24px 0; }
  </style>
</head>
<body>
  <h1 class="note-title">${emoji ? `${emoji} ` : ""}${escapeHtml(title)}</h1>
  ${contentHtml}
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/contrib/auto-render.min.js" onload="if(typeof renderMathInElement==='function'){renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]});}"></script>
</body>
</html>`;
}

export function tryParseHTMLToBlocks(htmlString = "") {
  if (!htmlString || typeof htmlString !== "string") return [];

  // Browser DOMParser implementation
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");
      const blocks = [];

      function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const txt = node.textContent.trim();
          if (txt) blocks.push({ id: makeBlockId(), type: "text", content: txt });
          return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tagName = node.tagName.toLowerCase();

        // Skip standalone note-title header tag from duplicating into blocks
        if (node.classList.contains("note-title")) {
          return;
        }

        if (tagName === "h1") {
          blocks.push({ id: makeBlockId(), type: "h1", content: node.textContent.trim() });
        } else if (tagName === "h2") {
          blocks.push({ id: makeBlockId(), type: "h2", content: node.textContent.trim() });
        } else if (tagName === "h3") {
          blocks.push({ id: makeBlockId(), type: "h3", content: node.textContent.trim() });
        } else if (tagName === "h4" || tagName === "h5" || tagName === "h6") {
          blocks.push({ id: makeBlockId(), type: "h4", content: node.textContent.trim() });
        } else if (tagName === "ul") {
          Array.from(node.children).forEach((li) => {
            if (li.tagName.toLowerCase() === "li") {
              const checkbox = li.querySelector("input[type=checkbox]");
              const todoCheck = li.querySelector(".todo-check");
              if (checkbox || todoCheck) {
                const isChecked = checkbox ? checkbox.checked : todoCheck.classList.contains("checked");
                const text = li.textContent.replace("✓", "").trim();
                blocks.push({ id: makeBlockId(), type: "todo", content: text, checked: isChecked });
              } else {
                blocks.push({ id: makeBlockId(), type: "bullet", content: li.textContent.trim() });
              }
            }
          });
        } else if (tagName === "ol") {
          Array.from(node.children).forEach((li) => {
            if (li.tagName.toLowerCase() === "li") {
              blocks.push({ id: makeBlockId(), type: "number", content: li.textContent.trim() });
            }
          });
        } else if (tagName === "details") {
          const summary = node.querySelector("summary");
          const title = summary ? summary.textContent.trim() : "";
          const clone = node.cloneNode(true);
          const cloneSummary = clone.querySelector("summary");
          if (cloneSummary) cloneSummary.remove();
          const details = clone.textContent.trim();
          blocks.push({ id: makeBlockId(), type: "toggle", content: title, open: node.hasAttribute("open"), details });
        } else if (tagName === "table" || node.classList.contains("socratic-table")) {
          let headerCells = Array.from(node.querySelectorAll("th")).map((th) => th.textContent.trim());
          let rows = [];
          const trs = Array.from(node.querySelectorAll("tbody tr"));
          const effectiveTrs = trs.length > 0 ? trs : Array.from(node.querySelectorAll("tr"));
          effectiveTrs.forEach((tr) => {
            const tds = Array.from(tr.querySelectorAll("td"));
            if (tds.length > 0) {
              rows.push(tds.map((td) => td.textContent.trim()));
            }
          });
          if (headerCells.length === 0 && rows.length > 0) {
            headerCells = rows.shift();
          }
          blocks.push({
            id: makeBlockId(),
            type: "table",
            content: "",
            tableData: {
              headers: headerCells && headerCells.length > 0 ? headerCells : ["Col 1", "Col 2"],
              rows: rows.length > 0 ? rows : [["", ""]],
              hasHeaderRow: true,
            },
          });
          return;
        } else if (tagName === "blockquote") {

          blocks.push({ id: makeBlockId(), type: "quote", content: node.textContent.trim() });
        } else if (tagName === "pre" || tagName === "code" || node.classList.contains("code-block")) {
          const codeEl = node.querySelector("code") || node;
          const codeText = codeEl.textContent;
          const classAttr = (codeEl.getAttribute("class") || "") + " " + (node.getAttribute("class") || "");
          const langMatch = classAttr.match(/language-(\w+)/);
          const language = langMatch ? langMatch[1] : null;
          blocks.push({ id: makeBlockId(), type: "code", content: codeText, language, meta: { language } });
        } else if (tagName === "hr") {
          blocks.push({ id: makeBlockId(), type: "divider", content: "" });
        } else if (tagName === "iframe") {
          const src = node.getAttribute("src") || "";
          const ytInfo = getYouTubeEmbedInfo(src);
          if (ytInfo) {
            blocks.push({ id: makeBlockId(), type: "media", content: "", url: src, mediaKind: "youtube" });
          }
        } else if (tagName === "video") {
          const src = node.getAttribute("src") || node.querySelector("source")?.getAttribute("src") || "";
          if (src) {
            blocks.push({ id: makeBlockId(), type: "media", content: "", url: src, mediaKind: "video" });
          }
        } else if (tagName === "img") {
          const src = node.getAttribute("src") || "";
          const alt = node.getAttribute("alt") || "";
          if (src) {
            blocks.push({ id: makeBlockId(), type: "media", content: alt, url: src, mediaKind: "image" });
          }
        } else if (node.classList.contains("callout")) {
          blocks.push({ id: makeBlockId(), type: "callout", content: node.textContent.trim(), calloutIcon: "💡" });
        } else if (node.classList.contains("math")) {
          let formula = node.textContent.trim();
          if (formula.startsWith("$$") && formula.endsWith("$$")) {
            formula = formula.slice(2, -2).trim();
          }
          blocks.push({ id: makeBlockId(), type: "math", content: formula });
        } else if (node.classList.contains("inlinemath") || (node.tagName.toLowerCase() === "span" && node.classList.contains("katex-inline-node"))) {
          let formula = node.getAttribute("data-formula") || node.textContent.trim();
          if (formula.startsWith("$") && formula.endsWith("$")) {
            formula = formula.slice(1, -1).trim();
          }
          blocks.push({ id: makeBlockId(), type: "text", content: formula ? `$${formula}$` : "" });
        } else if (node.classList.contains("todo-item") || tagName === "p") {
          const checkbox = node.querySelector("input[type=checkbox]");
          const todoCheck = node.querySelector(".todo-check");
          if (checkbox || todoCheck) {
            const isChecked = checkbox ? checkbox.checked : todoCheck.classList.contains("checked");
            const text = node.textContent.replace("✓", "").trim();
            blocks.push({ id: makeBlockId(), type: "todo", content: text, checked: isChecked });
          } else {
            const txt = node.textContent.trim();
            if (txt) blocks.push({ id: makeBlockId(), type: "text", content: txt });
          }
        } else {
          Array.from(node.childNodes).forEach(processNode);
        }
      }

      const bodyChildren = Array.from(doc.body.childNodes);
      bodyChildren.forEach(processNode);

      if (blocks.length > 0) return blocks;
    } catch {
      // Fall through to regex parser
    }
  }

  // Regex fallback parser for Node / non-DOM environments
  const blocks = [];
  const lines = htmlString.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/<h1[^>]*class="note-title"[^>]*>/i.test(line)) {
      continue; // skip document title wrapper in regex parser
    }
    if (/<h1[^>]*>(.*?)<\/h1>/i.test(line)) {
      blocks.push({ id: makeBlockId(), type: "h1", content: line.replace(/<[^>]+>/g, "").trim() });
    } else if (/<h2[^>]*>(.*?)<\/h2>/i.test(line)) {
      blocks.push({ id: makeBlockId(), type: "h2", content: line.replace(/<[^>]+>/g, "").trim() });
    } else if (/<h3[^>]*>(.*?)<\/h3>/i.test(line)) {
      blocks.push({ id: makeBlockId(), type: "h3", content: line.replace(/<[^>]+>/g, "").trim() });
    } else if (/<h4[^>]*>(.*?)<\/h4>/i.test(line)) {
      blocks.push({ id: makeBlockId(), type: "h4", content: line.replace(/<[^>]+>/g, "").trim() });
    } else if (/<p[^>]*class="[^"]*todo-item[^"]*"[^>]*>[\s\S]*?<\/p>/i.test(line)) {
      const isChecked = /todo-check\s+checked|checked/i.test(line);
      const text = line.replace(/<[^>]+>/g, "").replace("✓", "").trim();
      blocks.push({ id: makeBlockId(), type: "todo", content: text, checked: isChecked });
    } else if (/<li[^>]*>(.*?)<\/li>/i.test(line)) {
      blocks.push({ id: makeBlockId(), type: "bullet", content: line.replace(/<[^>]+>/g, "").trim() });
    } else if (/<blockquote[^>]*>(.*?)<\/blockquote>/i.test(line)) {
      blocks.push({ id: makeBlockId(), type: "quote", content: line.replace(/<[^>]+>/g, "").trim() });
    } else if (/<div[^>]*class="callout"[^>]*>(.*?)<\/div>/i.test(line)) {
      blocks.push({ id: makeBlockId(), type: "callout", content: line.replace(/<[^>]+>/g, "").trim(), calloutIcon: "💡" });
    } else if (/<div[^>]*class="math"[^>]*>(.*?)<\/div>/i.test(line)) {
      let formula = line.replace(/<[^>]+>/g, "").trim();
      if (formula.startsWith("$$") && formula.endsWith("$$")) formula = formula.slice(2, -2).trim();
      blocks.push({ id: makeBlockId(), type: "math", content: formula });
    } else if (/<div[^>]*class="code-block"[^>]*>[\s\S]*?<code[^>]*class="language-([^"]*)"[^>]*>([\s\S]*?)<\/code>/i.test(line)) {
      const m = line.match(/<code[^>]*class="language-([^"]*)"[^>]*>([\s\S]*?)<\/code>/i);
      const lang = m ? m[1] : "javascript";
      const code = m ? m[2].replace(/<[^>]+>/g, "").trim() : "";
      blocks.push({ id: makeBlockId(), type: "code", content: code, language: lang, meta: { language: lang } });
    } else if (/<pre[^>]*><code[^>]*class="language-([^"]*)"[^>]*>([\s\S]*?)<\/code><\/pre>/i.test(line)) {
      const m = line.match(/<code[^>]*class="language-([^"]*)"[^>]*>([\s\S]*?)<\/code>/i);
      const lang = m ? m[1] : "javascript";
      const code = m ? m[2].replace(/<[^>]+>/g, "").trim() : "";
      blocks.push({ id: makeBlockId(), type: "code", content: code, language: lang, meta: { language: lang } });
    } else if (/<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>([\s\S]*?)<\/details>/i.test(line)) {
      const m = line.match(/<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>([\s\S]*?)<\/details>/i);
      blocks.push({ id: makeBlockId(), type: "toggle", content: m[1].replace(/<[^>]+>/g, "").trim(), details: m[2].replace(/<[^>]+>/g, "").trim(), open: true });
    } else if (/<table[^>]*>([\s\S]*?)<\/table>/i.test(line) || line.toLowerCase().includes("<table")) {
      let tableHtml = line;
      while (!tableHtml.toLowerCase().includes("</table>") && i + 1 < lines.length) {
        i += 1;
        tableHtml += "\n" + lines[i];
      }
      let thMatches = Array.from(tableHtml.matchAll(/<th[^>]*>(.*?)<\/th>/gi)).map((m) => m[1].replace(/<[^>]+>/g, "").trim());
      const trMatches = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
      let dataRows = [];
      trMatches.forEach((trM) => {
        const tdMatches = Array.from(trM[1].matchAll(/<td[^>]*>(.*?)<\/td>/gi)).map((m) => m[1].replace(/<[^>]+>/g, "").trim());
        if (tdMatches.length > 0) {
          dataRows.push(tdMatches);
        }
      });
      if (thMatches.length === 0 && dataRows.length > 0) {
        thMatches = dataRows.shift();
      }
      blocks.push({
        id: makeBlockId(),
        type: "table",
        content: "",
        tableData: {
          headers: thMatches && thMatches.length > 0 ? thMatches : ["Col 1", "Col 2"],
          rows: dataRows.length > 0 ? dataRows : [["", ""]],
          hasHeaderRow: true,
        },
      });
    } else if (/<p[^>]*>(.*?)<\/p>/i.test(line)) {
      const text = line.replace(/<[^>]+>/g, "").trim();
      if (text) blocks.push({ id: makeBlockId(), type: "text", content: text });
    }
  }

  return blocks.length > 0 ? blocks : [{ id: makeBlockId(), type: "text", content: htmlString.replace(/<[^>]+>/g, "").trim() }];
}

export function exportHtml(blocks, title = "Note", emoji = "📝") {
  const htmlContent = blocksToHTMLLossy(blocks, title, emoji);
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const filename = `${title.replace(/[^a-z0-9_-]/gi, "_") || "Note"}.html`;
  triggerDownload(blob, filename);
}

/**
 * ─── 4. PLAIN TEXT EXPORT & IMPORT ──────────────────────────────────────────
 * blocksToPlainText() & tryParsePlainTextToBlocks()
 */
export function blocksToPlainText(rawBlocks = [], title = "") {
  const blocks = filterBlocksForExport(rawBlocks);
  const lines = [];
  if (title) {
    lines.push(title.toUpperCase());
    lines.push("=".repeat(title.length));
    lines.push("");
  }

  let numberIndex = 0;
  (blocks || []).forEach((block) => {
    const content = block.content || "";
    if (block.type !== "number") numberIndex = 0;
    switch (block.type) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
        lines.push(`\n${content}\n${"-".repeat(Math.max(4, content.length))}`);
        break;
      case "bullet": {
        const indent = "  ".repeat(Math.max(0, Math.min(4, Number(block.level) || 0)));
        lines.push(`${indent}• ${content}`);
        break;
      }
      case "number":
        numberIndex += 1;
        lines.push(`${numberIndex}. ${content}`);
        break;
      case "todo":
        lines.push(`[${block.checked ? "x" : " "}] ${content}`);
        break;
      case "toggle": {
        const details = block.details ?? block.toggleContent ?? "";
        lines.push(`▶ ${content}${details ? `\n   ↳ ${details}` : ""}`);
        break;
      }
      case "quote": {
        const trimmed = content.trim();
        if (trimmed.startsWith('"') && (trimmed.endsWith('"') || trimmed.includes('" —') || trimmed.includes('"—') || trimmed.includes('" -'))) {
          lines.push(trimmed);
        } else {
          lines.push(`"${trimmed.replace(/^"+|"+$/g, "")}"`);
        }
        break;
      }
      case "callout":
        lines.push(`[NOTE: ${content}]`);
        break;
      case "code": {
        const lang = block.language || block.meta?.language || "";
        lines.push(`--- CODE${lang ? ` (${lang})` : ""} ---\n${content}\n------------`);
        break;
      }
      case "math":
        lines.push(`[MATH: ${content}]`);
        break;
      case "inlinemath":
        lines.push(`$${content}$`);
        break;
      case "table": {
        const data = getNormalizedTableData(block.tableData, block.content);
        const headers = data.headers && data.headers.length > 0 ? data.headers : ["Col 1", "Col 2"];
        const rows = data.rows || [];
        const colCount = Math.max(headers.length, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)));
        const formatRow = (r) => {
          const cells = [];
          for (let i = 0; i < colCount; i++) {
            cells.push(r && r[i] !== undefined ? String(r[i]) : "");
          }
          return `| ${cells.join(" | ")} |`;
        };
        lines.push(`\n${formatRow(headers)}\n| ${Array(colCount).fill("---").join(" | ")} |\n${rows.map(formatRow).join("\n")}`);
        break;
      }
      case "columns": {
        const count = Math.max(2, Math.min(5, Number(block.columnCount) || 2));
        const cols = getNormalizedColumnsData(block.columnsData, block.content, count);
        cols.forEach((c, i) => {
          const colTitle = c.title || `Column ${i + 1}`;
          lines.push(`\n[COLUMN: ${colTitle}]`);
          if (c.content) {
            lines.push(c.content);
          }
        });
        break;
      }
      case "site": {
        const url = block.url || block.content || "";
        const title = block.title || block.content || url;
        lines.push(`[LINK: ${title}] ${url}`);
        break;
      }
      case "page": {
        lines.push(`[SUB-PAGE] ${block.emoji ? `${block.emoji} ` : ""}${block.title || block.content || "Untitled Note"}`);
        break;
      }
      case "media": {
        const mediaUrl = block.url || block.content || "";
        const kind = (block.mediaKind || "image").toUpperCase();
        lines.push(`[${kind}] ${block.content ? `${block.content} – ` : ""}${mediaUrl}`);
        break;
      }
      case "canvas":
      case "drawing":
        break;
      case "divider":
        lines.push("----------------------------------------");
        break;
      case "text":
      default:
        if (content) lines.push(content);
        break;
    }
  });

  return lines.join("\n");
}

export function tryParsePlainTextToBlocks(rawText = "") {
  if (!rawText || typeof rawText !== "string") return [];

  const lines = rawText.split(/\r?\n/);
  const blocks = [];
  let inCodeBlock = false;
  let codeLang = null;
  let codeBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block header in plain text: --- CODE (lang) --- or --- CODE ---
    const codeHeaderMatch = trimmed.match(/^---\s*CODE(?:\s*\(([^)]+)\))?\s*---$/i);
    if (codeHeaderMatch) {
      inCodeBlock = true;
      codeLang = codeHeaderMatch[1]?.toLowerCase() || null;
      codeBuffer = [];
      continue;
    }

    if (inCodeBlock) {
      if (trimmed === "------------" || trimmed === "---" || trimmed === "----------------------------------------") {
        inCodeBlock = false;
        blocks.push({
          id: makeBlockId(),
          type: "code",
          content: codeBuffer.join("\n"),
          language: codeLang,
          meta: { language: codeLang },
        });
        codeBuffer = [];
        codeLang = null;
      } else {
        codeBuffer.push(line);
      }
      continue;
    }

    if (!trimmed) continue;

    // Table detection in plain text (| col 1 | col 2 | or col 1 | col 2)
    if (trimmed.includes("|")) {
      const nextLine = (lines[i + 1] || "").trim();
      const isSeparator = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(nextLine);
      if (isSeparator) {
        const headers = parseMarkdownTableRow(trimmed);
        const rows = [];
        i += 1;

        while (i + 1 < lines.length) {
          const rowLine = lines[i + 1].trim();
          if (rowLine.includes("|") && !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(rowLine)) {
            rows.push(parseMarkdownTableRow(rowLine));
            i += 1;
          } else {
            break;
          }
        }

        blocks.push({
          id: makeBlockId(),
          type: "table",
          content: "",
          tableData: {
            headers: headers.length > 0 ? headers : ["Col 1", "Col 2"],
            rows: rows.length > 0 ? rows : [["", ""]],
            hasHeaderRow: true,
          },
        });
        continue;
      }
    }

    if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {

      blocks.push({ id: makeBlockId(), type: "bullet", content: trimmed.slice(2).trim() });
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({ id: makeBlockId(), type: "number", content: trimmed.replace(/^\d+\.\s/, "").trim() });
    } else if (trimmed.startsWith("[ ] ") || trimmed.startsWith("[] ")) {
      blocks.push({ id: makeBlockId(), type: "todo", content: trimmed.slice(trimmed.indexOf("]") + 1).trim(), checked: false });
    } else if (trimmed.startsWith("[x] ") || trimmed.startsWith("[X] ")) {
      blocks.push({ id: makeBlockId(), type: "todo", content: trimmed.slice(trimmed.indexOf("]") + 1).trim(), checked: true });
    } else if (trimmed.startsWith("▶ ")) {
      blocks.push({ id: makeBlockId(), type: "toggle", content: trimmed.slice(2).trim(), open: true });
    } else if (trimmed.startsWith("↳ ") && blocks.length > 0 && blocks[blocks.length - 1].type === "toggle") {
      blocks[blocks.length - 1].details = trimmed.slice(2).trim();
    } else if (trimmed.startsWith("[NOTE: ") && trimmed.endsWith("]")) {
      blocks.push({ id: makeBlockId(), type: "callout", content: trimmed.slice(7, -1).trim() });
    } else if (trimmed.startsWith("[MATH: ") && trimmed.endsWith("]")) {
      blocks.push({ id: makeBlockId(), type: "math", content: trimmed.slice(7, -1).trim() });
    } else if (trimmed.startsWith("[COLUMN: ") && trimmed.endsWith("]")) {
      const colTitle = trimmed.slice(9, -1).trim();
      let colBody = "";
      if (i + 1 < lines.length && !lines[i + 1].trim().startsWith("[") && !lines[i + 1].trim().startsWith("-") && !lines[i + 1].trim().startsWith("•") && !lines[i + 1].trim().startsWith("▶") && !lines[i + 1].trim().startsWith("=")) {
        colBody = lines[i + 1].trim();
        i++;
      }
      if (blocks.length > 0 && blocks[blocks.length - 1].type === "columns") {
        const prevCols = blocks[blocks.length - 1];
        prevCols.columnsData.push({
          id: `col_${prevCols.columnsData.length + 1}`,
          title: colTitle,
          content: colBody,
        });
        prevCols.columnCount = prevCols.columnsData.length;
      } else {
        blocks.push({
          id: makeBlockId(),
          type: "columns",
          columnCount: 1,
          columnsData: [{ id: "col_1", title: colTitle, content: colBody }],
          content: "",
        });
      }
    } else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      blocks.push({ id: makeBlockId(), type: "quote", content: trimmed.slice(1, -1).trim() });
    } else if (/^-{3,}$/.test(trimmed) || /^={3,}$/.test(trimmed)) {
      // Underline / divider line — skip or mark divider
      if (blocks.length > 0 && blocks[blocks.length - 1].type === "text") {
        blocks[blocks.length - 1].type = "h2";
      } else {
        blocks.push({ id: makeBlockId(), type: "divider", content: "" });
      }
    } else {
      blocks.push({ id: makeBlockId(), type: "text", content: line });
    }
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({
      id: makeBlockId(),
      type: "code",
      content: codeBuffer.join("\n"),
      language: codeLang,
      meta: { language: codeLang },
    });
  }

  return blocks.length > 0 ? blocks : [{ id: makeBlockId(), type: "text", content: rawText }];
}

export function exportTxt(blocks, title = "Note") {
  const txtContent = blocksToPlainText(blocks, title);
  const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
  const filename = `${title.replace(/[^a-z0-9_-]/gi, "_") || "Note"}.txt`;
  triggerDownload(blob, filename);
}

/**
 * ─── 5. DOCX EXPORT & IMPORT ──────────────────────────────────────────
 * blocksToDocxBlob() & tryParseDocxToBlocks()
 */
export async function blocksToDocxBlob(rawBlocks = [], title = "Untitled Note", emoji = "📝") {
  const blocks = filterBlocksForExport(rawBlocks);
  const children = [
    new Paragraph({
      text: `${emoji} ${title}`,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
    }),
  ];

  let numberIndex = 0;
  (blocks || []).forEach((block) => {
    const content = block.content || "";
    if (block.type !== "number") numberIndex = 0;
    switch (block.type) {
      case "h1":
        children.push(new Paragraph({ text: content, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
        break;
      case "h2":
        children.push(new Paragraph({ text: content, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
        break;
      case "h3":
        children.push(new Paragraph({ text: content, heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } }));
        break;
      case "h4":
        children.push(new Paragraph({ text: content, heading: HeadingLevel.HEADING_4, spacing: { before: 120, after: 60 } }));
        break;
      case "bullet": {
        const lvl = Math.max(0, Math.min(4, Number(block.level) || 0));
        children.push(new Paragraph({ text: `• ${content}`, spacing: { after: 60 }, indent: { left: 360 + lvl * 280 } }));
        break;
      }
      case "number":
        numberIndex += 1;
        children.push(new Paragraph({ text: `${numberIndex}. ${content}`, spacing: { after: 60 }, indent: { left: 360 } }));
        break;
      case "todo":
        children.push(new Paragraph({
          children: [
            new TextRun({ text: block.checked ? "[x] " : "[ ] ", bold: true }),
            new TextRun({ text: content, strike: Boolean(block.checked) }),
          ],
          spacing: { after: 60 },
          indent: { left: 360 },
        }));
        break;
      case "toggle": {
        const details = block.details ?? block.toggleContent ?? "";
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "▼ ", bold: true, color: "F59E0B" }),
            new TextRun({ text: content, bold: true }),
          ],
          spacing: { before: 100, after: 40 },
          indent: { left: 360 },
        }));
        if (details && details.trim()) {
          const detailLines = details.split(/\r?\n/);
          let firstNonEmpty = true;
          detailLines.forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
              children.push(new Paragraph({ text: "", spacing: { after: 40 }, indent: { left: 720 } }));
            } else {
              const prefix = firstNonEmpty ? "↳ " : "";
              firstNonEmpty = false;
              children.push(new Paragraph({
                children: [
                  new TextRun({
                    text: `${prefix}${trimmedLine}`,
                    italic: true,
                    color: "6B7280",
                  }),
                ],
                spacing: { after: 40 },
                indent: { left: 720 },
              }));
            }
          });
        }
        break;
      }
      case "quote": {
        const trimmed = content.trim();
        let quoteText = trimmed;
        if (trimmed.startsWith('"') && (trimmed.endsWith('"') || trimmed.includes('" —') || trimmed.includes('"—') || trimmed.includes('" -'))) {
          quoteText = trimmed;
        } else {
          quoteText = `"${trimmed.replace(/^"+|"+$/g, "")}"`;
        }
        children.push(new Paragraph({
          children: [new TextRun({ text: quoteText, italic: true })],
          indent: { left: 720 },
          spacing: { before: 120, after: 120 },
        }));
        break;
      }
      case "callout":
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${block.calloutIcon || "💡"} `, bold: true }),
            new TextRun({ text: content }),
          ],
          indent: { left: 360 },
          spacing: { before: 120, after: 120 },
        }));
        break;
      case "code": {
        const lang = block.language || block.meta?.language || "";
        // Language label line
        if (lang) {
          children.push(new Paragraph({
            children: [new TextRun({ text: lang.toUpperCase(), font: "Consolas", bold: true, color: "888888", size: 18 })],
            spacing: { before: 120, after: 0 },
            indent: { left: 360 },
          }));
        }
        // Code content — split by newlines so each line is its own paragraph
        const codeLines = content.split("\n");
        codeLines.forEach((codeLine) => {
          children.push(new Paragraph({
            children: [new TextRun({ text: codeLine || " ", font: "Consolas", size: 20 })],
            spacing: { after: 0, before: 0 },
            indent: { left: 360 },
          }));
        });
        // Trailing space after block
        children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
        break;
      }
      case "math": {
        const cleanFormula = content.trim().replace(/^\$+|\$+$/g, "").trim();
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "Formula: ", bold: true, italic: true }),
            new TextRun({ text: cleanFormula, font: "Consolas", italic: true }),
          ],
          spacing: { before: 120, after: 120 },
          indent: { left: 360 },
        }));
        break;
      }
      case "inlinemath": {
        const cleanFormula = content.trim().replace(/^\$+|\$+$/g, "").trim();
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "Inline: ", bold: true, italic: true }),
            new TextRun({ text: cleanFormula, font: "Consolas", italic: true }),
          ],
          spacing: { before: 80, after: 80 },
          indent: { left: 360 },
        }));
        break;
      }
      case "table": {
        const data = getNormalizedTableData(block.tableData, block.content);
        const headers = data.headers && data.headers.length > 0 ? data.headers : ["Col 1", "Col 2"];
        const rows = data.rows || [];
        const tableRows = [];
        tableRows.push(
          new TableRow({
            children: headers.map(
              (h) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                })
            ),
          })
        );
        rows.forEach((r) => {
          tableRows.push(
            new TableRow({
              children: headers.map(
                (_, i) =>
                  new TableCell({
                    children: [new Paragraph({ text: r[i] || "" })],
                  })
              ),
            })
          );
        });
        children.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        break;
      }
      case "page": {
        const pageTitle = block.title || block.content || "Untitled Note";
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${block.emoji || "📄"} `, bold: true }),
            new TextRun({ text: pageTitle, bold: true, color: "0284C7" }),
            new TextRun({ text: " (sub-page)", italic: true, color: "64748B" }),
          ],
          indent: { left: 360 },
          spacing: { before: 80, after: 80 },
        }));
        break;
      }
      case "site": {
        const url = block.url || block.content || "";
        const title = block.title || block.url || block.content || "Link";
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "🌐 ", bold: true }),
            new TextRun({ text: title, bold: true, color: "0284C7" }),
            new TextRun({ text: url ? ` (${url})` : "", italic: true, color: "64748B" }),
          ],
          indent: { left: 360 },
          spacing: { before: 80, after: 80 },
        }));
        break;
      }
      case "media": {
        const mediaUrl = block.url || block.content || "";
        const ytInfo = getYouTubeEmbedInfo(mediaUrl);
        const kind = ytInfo ? "youtube" : (block.mediaKind || "image");
        const icon = kind === "youtube" ? "▶️ " : kind === "audio" ? "🎵 " : kind === "video" ? "🎬 " : "🖼️ ";
        children.push(new Paragraph({
          children: [
            new TextRun({ text: icon, bold: true }),
            new TextRun({ text: `[${kind.toUpperCase()}]: `, bold: true }),
            new TextRun({ text: block.content ? `${block.content} ` : "" }),
            new TextRun({ text: mediaUrl ? `(${mediaUrl})` : "", italic: true, color: "64748B" }),
          ],
          indent: { left: 360 },
          spacing: { before: 80, after: 80 },
        }));
        break;
      }
      case "canvas":
      case "drawing":
        break;
      case "columns": {
        const count = Math.max(2, Math.min(5, Number(block.columnCount) || 2));
        const cols = getNormalizedColumnsData(block.columnsData, block.content, count);
        const cells = cols.map((c, i) => {
          const cellChildren = [];
          if (c.title) {
            cellChildren.push(new Paragraph({
              children: [new TextRun({ text: c.title, bold: true, color: "0284C7" })],
              spacing: { after: 60 },
            }));
          }
          const lines = (c.content || "").split(/\r?\n/).filter(Boolean);
          if (lines.length === 0) {
            cellChildren.push(new Paragraph({ text: "" }));
          } else {
            lines.forEach((l) => {
              cellChildren.push(new Paragraph({ text: l, spacing: { after: 40 } }));
            });
          }
          return new TableCell({
            children: cellChildren,
            width: { size: Math.floor(100 / count), type: WidthType.PERCENTAGE },
          });
        });
        children.push(new Table({
          rows: [new TableRow({ children: cells })],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }));
        break;
      }

      case "divider":

        children.push(new Paragraph({
          text: "__________________________________________________",
          spacing: { before: 120, after: 120 },
        }));
        break;
      case "text":
      default:
        if (content) {
          children.push(new Paragraph({ text: content, spacing: { after: 120 } }));
        }
        break;
    }
  });

  const doc = new Document({
    sections: [{ children }],
  });

  return await Packer.toBlob(doc);
}

export async function exportDocx(blocks, title = "Note", emoji = "📝") {
  const blob = await blocksToDocxBlob(blocks, title, emoji);
  const filename = `${title.replace(/[^a-z0-9_-]/gi, "_") || "Note"}.docx`;
  triggerDownload(blob, filename);
}

export async function tryParseDocxToBlocks(arrayBufferOrBuffer) {
  let mammothInput = {};
  if (typeof Buffer !== "undefined") {
    mammothInput = {
      buffer: Buffer.isBuffer(arrayBufferOrBuffer)
        ? arrayBufferOrBuffer
        : Buffer.from(arrayBufferOrBuffer),
    };
  } else {
    mammothInput = { arrayBuffer: arrayBufferOrBuffer };
  }
  const result = await mammoth.convertToHtml(mammothInput);
  const html = result.value || "";
  return tryParseHTMLToBlocks(html);
}

/**
 * ─── 6. IMPORT FILE HANDLER & DEXIE DB PERSISTENCE ──────────────────────────────────────────
 * Reads file, parses blocks, creates new note with fresh ID & saves to db.notes
 */
export async function importNoteFromFile(file, targetSpace = "School") {
  if (!file) throw new Error("No file selected for import.");

  const filename = file.name || "Imported Note";
  const ext = filename.split(".").pop().toLowerCase();
  const rawTitle = filename.replace(/\.[^/.]+$/, "");
  let blocks = [];
  let noteTitle = rawTitle;
  let noteEmoji = "📄";

  if (ext === "socratic" || (ext === "json" && filename.toLowerCase().includes("socratic"))) {
    const { importWorkspaceFromJSON } = await import("./backup.js");
    const res = await importWorkspaceFromJSON(file, { targetSpace: targetSpace === "Original" ? "Original" : targetSpace, overwrite: false });
    const firstImported = res.notes?.[0];
    if (firstImported) return firstImported;
    return { id: `note_socratic_${Date.now()}`, spaceId: targetSpace === "Original" ? "School" : targetSpace, title: rawTitle, blocks: [], isWorkspaceImport: true };
  } else if (ext === "json") {
    const jsonText = await file.text();
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.format?.startsWith("socratic-backup")) {
        const { importWorkspaceFromJSON } = await import("./backup.js");
        const res = await importWorkspaceFromJSON(file, { targetSpace: targetSpace === "Original" ? "Original" : targetSpace, overwrite: false });
        const firstImported = res.notes?.[0];
        if (firstImported) return firstImported;
        return { id: `note_socratic_${Date.now()}`, spaceId: targetSpace === "Original" ? "School" : targetSpace, title: rawTitle, blocks: [], isWorkspaceImport: true };
      } else if (Array.isArray(parsed)) {
        blocks = parsed.map((b) => ({ id: b.id || makeBlockId(), type: b.type || "text", content: b.content || "", ...b }));
      } else if (parsed && typeof parsed === "object") {
        noteTitle = parsed.title || rawTitle;
        noteEmoji = parsed.emoji || "📝";
        if (Array.isArray(parsed.blocks)) {
          blocks = parsed.blocks.map((b) => ({ id: b.id || makeBlockId(), type: b.type || "text", content: b.content || "", ...b }));
        }
      }
    } catch {
      blocks = tryParsePlainTextToBlocks(jsonText);
    }
  } else if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    blocks = await tryParseDocxToBlocks(arrayBuffer);
  } else if (ext === "html" || ext === "htm") {
    const htmlText = await file.text();
    if (/NETSCAPE-Bookmark-file/i.test(htmlText)) {
      const res = await importBookmarksFromHtml(htmlText, targetSpace === "Original" ? "School" : targetSpace);
      return {
        id: `bookmarks_import_${Date.now()}`,
        spaceId: targetSpace === "Original" ? "School" : targetSpace,
        title: `${rawTitle} (Imported ${res.bookmarksCount} Bookmarks)`,
        isBookmarkImport: true,
        count: res.bookmarksCount,
        foldersCount: res.foldersCount,
      };
    }
    blocks = tryParseHTMLToBlocks(htmlText);
  } else if (ext === "md" || ext === "markdown") {
    const mdText = await file.text();
    blocks = tryParseMarkdownToBlocks(mdText);
  } else if (ext === "txt") {
    const txtText = await file.text();
    blocks = tryParsePlainTextToBlocks(txtText);
  } else {
    // Fallback: read as plain text
    const text = await file.text();
    blocks = tryParsePlainTextToBlocks(text);
  }

  // Extract first H1 heading if present to use as title
  const headingBlock = blocks.find((b) => b.type === "h1");
  if (headingBlock?.content && (!noteTitle || noteTitle === "Imported Note" || noteTitle === rawTitle)) {
    noteTitle = headingBlock.content;
  }

  // Create fresh note object with fresh ID
  const freshNote = {
    id: makeFreshNoteId(),
    spaceId: targetSpace === "Original" ? "School" : targetSpace,
    space: targetSpace === "Original" ? "School" : targetSpace,
    title: noteTitle || "Imported Note",
    blocks: blocks.length > 0 ? blocks : [{ id: makeBlockId(), type: "text", content: "" }],
    banner: null,
    emoji: noteEmoji || "📄",
    fontStyle: "sans",
    fullWidth: false,
    isLocked: false,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save cleanly into Dexie IndexedDB (db.notes)
  await saveNote(freshNote);

  return freshNote;
}

/**
 * ─── 7. NETSCAPE HTML BOOKMARKS EXPORT & IMPORT ─────────────────────────────
 * Standard browser bookmarks format supported by Chrome, Firefox, Safari, Edge, Brave, Arc.
 */

/**
 * Generates Netscape Bookmarks HTML string from folders and bookmarks.
 * 
 * @param {Array} bookmarks - List of bookmark objects
 * @param {Array} folders - List of folder objects
 * @param {string} [spaceId="All"] - Space filter name
 * @returns {{ html: string, count: number }}
 */
export function generateNetscapeBookmarksHtml(bookmarks = [], folders = [], spaceId = "All") {
  const filteredFolders = spaceId && spaceId !== "All"
    ? folders.filter(f => (f.spaceId || "School") === spaceId)
    : folders;

  const filteredBookmarks = spaceId && spaceId !== "All"
    ? bookmarks.filter(b => (b.spaceId || "School") === spaceId)
    : bookmarks;

  // Build folder map
  const foldersByParent = {};
  filteredFolders.forEach(f => {
    const pId = f.parentId || "root";
    if (!foldersByParent[pId]) foldersByParent[pId] = [];
    foldersByParent[pId].push(f);
  });

  // Build bookmarks by folder map
  const bookmarksByFolder = {};
  filteredBookmarks.forEach(bm => {
    const fId = bm.folderId || "root";
    if (!bookmarksByFolder[fId]) bookmarksByFolder[fId] = [];
    bookmarksByFolder[fId].push(bm);
  });

  function renderBookmarks(fId, indent = "        ") {
    const items = bookmarksByFolder[fId] || [];
    let out = "";
    items.forEach(bm => {
      const addDate = Math.floor(new Date(bm.createdAt || Date.now()).getTime() / 1000);
      const tagsAttr = Array.isArray(bm.tags) && bm.tags.length > 0
        ? ` TAGS="${escapeHtml(bm.tags.join(","))}"`
        : "";
      const iconAttr = bm.favicon ? ` ICON="${escapeHtml(bm.favicon)}"` : "";
      
      out += `${indent}<DT><A HREF="${escapeHtml(bm.url)}" ADD_DATE="${addDate}"${iconAttr}${tagsAttr}>${escapeHtml(bm.title || bm.url)}</A>\n`;
      if (bm.notes && bm.notes.trim()) {
        out += `${indent}<DD>${escapeHtml(bm.notes.trim())}\n`;
      }
    });
    return out;
  }

  function renderFolder(folder, depth = 2) {
    const indent = "    ".repeat(depth);
    const addDate = Math.floor(new Date(folder.createdAt || Date.now()).getTime() / 1000);
    let out = `${indent}<DT><H3 ADD_DATE="${addDate}" LAST_MODIFIED="${addDate}">${escapeHtml(folder.name)}</H3>\n`;
    out += `${indent}<DL><p>\n`;

    // Render bookmarks inside this folder
    out += renderBookmarks(folder.id, indent + "    ");

    // Render child folders
    const subFolders = foldersByParent[folder.id] || [];
    subFolders.forEach(sub => {
      out += renderFolder(sub, depth + 1);
    });

    out += `${indent}</DL><p>\n`;
    return out;
  }

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>SocraticOS Bookmarks — ${escapeHtml(spaceId)}</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  // Render root folders
  const rootFolders = foldersByParent["root"] || [];
  rootFolders.forEach(f => {
    html += renderFolder(f, 1);
  });

  // Render root unorganized bookmarks
  html += renderBookmarks("root", "    ");

  html += `</DL><p>\n`;

  return { html, count: filteredBookmarks.length };
}

/**
 * Exports bookmarks to Netscape HTML format and triggers browser download.
 */
export async function exportBookmarksToHtml(bookmarks = [], folders = [], spaceId = "All") {
  const { html, count } = generateNetscapeBookmarksHtml(bookmarks, folders, spaceId);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const spaceSlug = spaceId && spaceId !== "All" ? spaceId.replace(/[^a-z0-9_-]/gi, "_") : "All";
  const filename = `SocraticOS-Bookmarks-${spaceSlug}-${new Date().toISOString().split("T")[0]}.html`;
  triggerDownload(blob, filename);
  return { filename, count };
}

/**
 * Parses Netscape Bookmarks HTML string into folders and bookmarks.
 * Works seamlessly in both browser (DOMParser) and Node.js environments.
 * 
 * @param {string} htmlString 
 * @param {string} [targetSpace="School"] 
 * @returns {{ folders: Array, bookmarks: Array }}
 */
export function parseNetscapeBookmarksHtml(htmlString, targetSpace = "School") {
  if (!htmlString || typeof htmlString !== "string") {
    return { folders: [], bookmarks: [] };
  }

  const folders = [];
  const bookmarks = [];

  // Browser DOMParser implementation
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");

      function processDl(dlElement, parentFolderId = null) {
        if (!dlElement) return;

        const children = Array.from(dlElement.children);
        let i = 0;
        while (i < children.length) {
          const child = children[i];
          const tagName = child.tagName.toUpperCase();

          if (tagName === "DT") {
            // Check what's inside the DT
            const h3 = child.querySelector("h3, H3");
            const a = child.querySelector("a, A");
            const subDl = child.querySelector("dl, DL") || (children[i + 1]?.tagName.toUpperCase() === "DL" ? children[i + 1] : null);

            if (h3) {
              const folderName = (h3.textContent || "Folder").trim();
              const folderId = `f_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              folders.push({
                id: folderId,
                parentId: parentFolderId,
                spaceId: targetSpace,
                name: folderName,
                createdAt: new Date().toISOString(),
              });

              if (subDl) {
                processDl(subDl, folderId);
              }
            } else if (a) {
              const url = a.getAttribute("href") || a.getAttribute("HREF") || "";
              const title = (a.textContent || url || "Saved Link").trim();
              const favicon = a.getAttribute("icon") || a.getAttribute("ICON") || "";
              const tagsAttr = a.getAttribute("tags") || a.getAttribute("TAGS") || "";
              const tags = tagsAttr ? tagsAttr.split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : [];
              
              // Check if next sibling or child is a <DD> description
              let notes = "";
              const nextElem = children[i + 1];
              if (nextElem && nextElem.tagName.toUpperCase() === "DD") {
                notes = (nextElem.textContent || "").trim();
              } else {
                const dd = child.querySelector("dd, DD");
                if (dd) notes = (dd.textContent || "").trim();
              }

              if (url) {
                bookmarks.push({
                  id: `bm_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  folderId: parentFolderId,
                  spaceId: targetSpace,
                  url,
                  title,
                  favicon: favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split("/")[0])}&sz=64`,
                  notes,
                  tags,
                  createdAt: new Date().toISOString(),
                });
              }
            }
          } else if (tagName === "DL") {
            processDl(child, parentFolderId);
          }
          i++;
        }
      }

      const rootDl = doc.querySelector("dl, DL");
      if (rootDl) {
        processDl(rootDl, null);
      }
      if (folders.length > 0 || bookmarks.length > 0) {
        return { folders, bookmarks };
      }
    } catch {
      // Fall through to regex parser
    }
  }

  // Regex fallback parser for Node / non-DOM environments
  const folderStack = [];
  const lines = htmlString.split(/\r?\n/);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for folder start: <H3 ...>FolderName</H3>
    const h3Match = line.match(/<H3[^>]*>(.*?)<\/H3>/i);
    if (h3Match) {
      const folderName = h3Match[1].replace(/<[^>]+>/g, "").trim() || "Folder";
      const currentParent = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;
      const folderId = `f_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      
      const newFolder = {
        id: folderId,
        parentId: currentParent,
        spaceId: targetSpace,
        name: folderName,
        createdAt: new Date().toISOString(),
      };
      folders.push(newFolder);
      folderStack.push(newFolder);
      continue;
    }

    // Check for closing DL: </DL>
    if (/<\/DL>/i.test(line)) {
      if (folderStack.length > 0) {
        folderStack.pop();
      }
      continue;
    }

    // Check for bookmark link: <A HREF="..." ...>Title</A>
    const aMatch = line.match(/<A\s+([^>]*?)>(.*?)<\/A>/i);
    if (aMatch) {
      const attrs = aMatch[1];
      const title = aMatch[2].replace(/<[^>]+>/g, "").trim();
      
      const hrefMatch = attrs.match(/HREF="([^"]*)"/i);
      const iconMatch = attrs.match(/ICON="([^"]*)"/i);
      const tagsMatch = attrs.match(/TAGS="([^"]*)"/i);
      
      const url = hrefMatch ? hrefMatch[1] : "";
      const favicon = iconMatch ? iconMatch[1] : "";
      const tags = tagsMatch ? tagsMatch[1].split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : [];
      
      // Check for <DD> on same line or next line
      let notes = "";
      const ddMatch = line.match(/<DD>(.*?)$/i);
      if (ddMatch) {
        notes = ddMatch[1].replace(/<[^>]+>/g, "").trim();
      } else if (i + 1 < lines.length && /<DD>/i.test(lines[i + 1])) {
        notes = lines[i + 1].replace(/<DD>/i, "").replace(/<[^>]+>/g, "").trim();
      }

      if (url) {
        const currentParent = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;
        const domain = url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split("/")[0] || "link";
        bookmarks.push({
          id: `bm_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          folderId: currentParent,
          spaceId: targetSpace,
          url,
          title: title || domain || "Saved Link",
          favicon: favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
          notes,
          tags,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return { folders, bookmarks };
}

/**
 * Imports bookmarks and folders from Netscape HTML file or text directly into Dexie DB.
 * By default, clears existing folders and bookmarks in targetSpace to prevent duplicate entries.
 * 
 * @param {File|string} fileOrText 
 * @param {string} [targetSpace="School"] 
 * @param {Object} [options={}]
 * @param {boolean} [options.replaceExisting=true] - If true, clears target space bookmarks/folders first.
 * @returns {Promise<{ foldersCount: number, bookmarksCount: number, folders: Array, bookmarks: Array }>}
 */
export async function importBookmarksFromHtml(fileOrText, targetSpace = "School", { replaceExisting = true } = {}) {
  let db = null;
  try {
    const dbModule = await import("./db.js");
    db = dbModule.db;
  } catch {}

  let text = "";
  if (typeof fileOrText === "string") {
    text = fileOrText;
  } else if (fileOrText && typeof fileOrText.text === "function") {
    text = await fileOrText.text();
  } else {
    throw new Error("Invalid file or content provided for bookmarks import.");
  }

  const { folders, bookmarks } = parseNetscapeBookmarksHtml(text, targetSpace);

  if (db && db.folders && db.bookmarks) {
    try {
      await db.transaction("rw", [db.folders, db.bookmarks], async () => {
        if (replaceExisting) {
          if (targetSpace && targetSpace !== "All") {
            await db.folders.where("spaceId").equals(targetSpace).delete();
            await db.bookmarks.where("spaceId").equals(targetSpace).delete();
          } else {
            await db.folders.clear();
            await db.bookmarks.clear();
          }
        }

        if (folders.length > 0) {
          await db.folders.bulkPut(folders);
        }
        if (bookmarks.length > 0) {
          await db.bookmarks.bulkPut(bookmarks);
        }
      });
    } catch {
      // Environment fallback (e.g. Node test environment without browser IndexedDB)
    }
  }

  return {
    foldersCount: folders.length,
    bookmarksCount: bookmarks.length,
    folders,
    bookmarks,
  };
}

