import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import mammoth from "mammoth";
import { saveNote } from "./storageService.js";

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
  const originalTitle = document.title;
  document.title = noteTitle || "Note";
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}

/**
 * ─── DATA FILTER UTILITY FOR FILE EXPORTS ──────────────────────────────────────────
 * Normalises all editor block types into a flat set of standard structures
 * (text, h1-h4, bullet, number, todo, quote, callout, code, math, divider)
 * ready for Markdown / HTML / DOCX / plain-text serialisers.
 *
 * Rules (matching the user's spec):
 *   canvas   → text  "[Canvas] – <title>"
 *   toggle   → bullet for the header + bullet "  ↳ <details>" for body
 *   site     → text  "<url-host> – <full-url>"  (site bookmark)
 *   media    → text  "[Image/Video/Audio] <url>"
 *   code     → kept as code
 *   math     → kept as math
 *   everything else passes through unchanged
 */
export function filterBlocksForExport(blocks = []) {
  if (!Array.isArray(blocks)) return [];

  const sanitized = [];

  for (const block of blocks) {
    if (!block) continue;
    const type = block.type || "text";
    // Prefer block.content; fall back to empty string
    const content = block.content || "";

    switch (type) {
      // ── To-do: strip any stray leading "[ ]" / "[x]" that crept into content
      case "todo": {
        const cleanTodo = content.replace(/^\[[ xX]\]\s*/, "");
        sanitized.push({ ...block, content: cleanTodo });
        break;
      }

      // ── Toggle: header as bullet, then details as an indented note bullet
      case "toggle": {
        const header = content || "Toggle";
        sanitized.push({
          id: block.id || makeBlockId(),
          type: "bullet",
          content: header,
        });
        const details = block.details ?? block.toggleContent ?? "";
        if (details && details.trim()) {
          sanitized.push({
            id: makeBlockId(),
            type: "bullet",
            content: `  ↳ ${details.trim()}`,
          });
        }
        // Recurse into explicit children if present
        if (Array.isArray(block.children) && block.children.length > 0) {
          sanitized.push(...filterBlocksForExport(block.children));
        }
        break;
      }

      // ── Canvas / Drawing: show a placeholder badge
      case "canvas":
      case "drawing": {
        const canvasTitle = content || block.title || block.meta?.title || "Untitled Drawing";
        sanitized.push({
          id: block.id || makeBlockId(),
          type: "text",
          content: `[Canvas] – ${canvasTitle}`,
        });
        break;
      }

      // ── Site / Bookmark: "<host> – <full url>"
      case "site":
      case "bookmark":
      case "site_embed": {
        const rawUrl = block.url || block.meta?.url || content || "";
        let displayUrl = rawUrl;
        let host = rawUrl;
        try {
          const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
          displayUrl = u.href;
          host = u.hostname.replace(/^www\./, "");
        } catch {
          /* not a valid URL – just use the raw string */
        }
        sanitized.push({
          id: block.id || makeBlockId(),
          type: "text",
          content: host && displayUrl && host !== displayUrl
            ? `${host} – ${displayUrl}`
            : displayUrl || "[Site Bookmark]",
        });
        break;
      }

      // ── Media: image / audio / video → give the URL
      case "media": {
        const mediaUrl = block.url || block.meta?.url || content || "";
        const kind = block.mediaKind || block.meta?.kind || "image";
        const kindLabel = kind === "audio" ? "Audio" : kind === "video" ? "Video" : "Image";
        sanitized.push({
          id: block.id || makeBlockId(),
          type: "text",
          content: mediaUrl
            ? `[${kindLabel}] ${mediaUrl}`
            : `[${kindLabel}]`,
        });
        break;
      }

      // ── Code & Math pass through unmodified so serialisers can format them
      case "code":
      case "math":
        sanitized.push({ ...block });
        break;

      default:
        sanitized.push({ ...block });
        break;
    }
  }

  return sanitized;
}

/**
 * ─── 2. MARKDOWN EXPORT & IMPORT ──────────────────────────────────────────
 * blocksToMarkdownLossy() & tryParseMarkdownToBlocks()
 */
export function blocksToMarkdownLossy(rawBlocks = []) {
  const blocks = filterBlocksForExport(rawBlocks);

  return blocks
    .map((block) => {
      const content = block.content || "";
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
        case "divider":
          return `---`;
        case "code": {
          const lang = block.language || block.meta?.language || "";
          return `\`\`\`${lang}\n${content}\n\`\`\``;
        }
        case "math":
          return `$$\n${content}\n$$`;
        case "text":
        default:
          return content;
      }
    })
    .join("\n\n");
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

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

    if (trimmed.startsWith("$$")) {
      if (!inMathBlock) {
        inMathBlock = true;
        const rest = trimmed.slice(2).trim();
        mathBuffer = rest ? [rest] : [];
      } else {
        inMathBlock = false;
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

    if (!trimmed) continue;

    if (line.startsWith("#### ")) {
      resultBlocks.push({ id: makeBlockId(), type: "h4", content: line.slice(5) });
    } else if (line.startsWith("### ")) {
      resultBlocks.push({ id: makeBlockId(), type: "h3", content: line.slice(4) });
    } else if (line.startsWith("## ")) {
      resultBlocks.push({ id: makeBlockId(), type: "h2", content: line.slice(3) });
    } else if (line.startsWith("# ")) {
      resultBlocks.push({ id: makeBlockId(), type: "h1", content: line.slice(2) });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      resultBlocks.push({ id: makeBlockId(), type: "bullet", content: line.slice(2) });
    } else if (/^\d+\.\s/.test(line)) {
      resultBlocks.push({ id: makeBlockId(), type: "number", content: line.replace(/^\d+\.\s/, "") });
    } else if (line.startsWith("[ ] ") || line.startsWith("[] ")) {
      resultBlocks.push({ id: makeBlockId(), type: "todo", content: line.slice(line.indexOf("]") + 1).trim(), checked: false });
    } else if (line.startsWith("[x] ") || line.startsWith("[X] ")) {
      resultBlocks.push({ id: makeBlockId(), type: "todo", content: line.slice(line.indexOf("]") + 1).trim(), checked: true });
    } else if (line.startsWith("> ")) {
      resultBlocks.push({ id: makeBlockId(), type: "quote", content: line.slice(2) });
    } else if (line.startsWith("💡 ") || line.startsWith(">! ")) {
      resultBlocks.push({ id: makeBlockId(), type: "callout", content: line.slice(3) });
    } else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      resultBlocks.push({ id: makeBlockId(), type: "divider", content: "" });
    } else {
      resultBlocks.push({ id: makeBlockId(), type: "text", content: line });
    }
  }

  if (codeBuffer.length > 0) {
    resultBlocks.push({ id: makeBlockId(), type: "code", content: codeBuffer.join("\n"), meta: { language: codeLang } });
  }
  if (mathBuffer.length > 0) {
    resultBlocks.push({ id: makeBlockId(), type: "math", content: mathBuffer.join("\n") });
  }

  return resultBlocks.length > 0 ? resultBlocks : [{ id: makeBlockId(), type: "text", content: rawMarkdown }];
}

export function exportMarkdown(blocks, title = "Note") {
  const mdContent = blocksToMarkdownLossy(blocks);
  const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
  const filename = `${title.replace(/[^a-z0-9_-]/gi, "_") || "Note"}.md`;
  triggerDownload(blob, filename);
}

/**
 * ─── 3. HTML EXPORT & IMPORT ──────────────────────────────────────────
 * blocksToHTMLLossy() & tryParseHTMLToBlocks()
 */
export function blocksToHTMLLossy(rawBlocks = [], title = "Untitled Note", emoji = "📝") {
  const blocks = filterBlocksForExport(rawBlocks);
  const contentHtml = (blocks || [])
    .map((block) => {
      const content = escapeHtml(block.content || "");
      switch (block.type) {
        case "h1":
          return `<h1>${content}</h1>`;
        case "h2":
          return `<h2>${content}</h2>`;
        case "h3":
          return `<h3>${content}</h3>`;
        case "h4":
          return `<h4>${content}</h4>`;
        case "bullet":
          return `<ul><li>${content}</li></ul>`;
        case "number":
          return `<ol><li>${content}</li></ol>`;
        case "todo":
          return `<p><input type="checkbox" ${block.checked ? "checked" : ""} disabled /> ${content}</p>`;
        case "quote":
          return `<blockquote>${content}</blockquote>`;
        case "callout":
          return `<div class="callout" style="padding:12px; border-left:4px solid #f0c04a; background:#181c27; margin:10px 0; border-radius:6px;"><span>${block.calloutIcon || "💡"}</span> ${content}</div>`;
        case "code": {
          const lang = escapeHtml(block.language || block.meta?.language || "text");
          return `<pre><code class="language-${lang}">${content}</code></pre>`;
        }
        case "math":
          return `<div class="math" style="text-align:center; font-family:monospace; padding:10px; background:#181c27; margin:10px 0; border-radius:6px; color:#f7d67c;">$$${content}$$</div>`;
        case "divider":
          return `<hr style="border:0; border-top:1px solid #363d54; margin:24px 0;" />`;
        case "text":
        default:
          return content ? `<p>${content}</p>` : "";
      }
    })
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/katex.min.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; background-color: #12151e; color: #f1f3fa; }
    h1, h2, h3, h4 { color: #f7d67c; margin-top: 1.2em; }
    code, pre { font-family: 'Consolas', 'Courier New', monospace; background: #181c27; padding: 2px 6px; border-radius: 4px; }
    pre { padding: 16px; overflow-x: auto; border: 1px solid #363d54; }
    blockquote { border-left: 4px solid #f7d67c; margin: 0; padding-left: 16px; color: #9aa2bc; font-style: italic; }
    ul, ol { margin: 4px 0; padding-left: 1.5em; }
  </style>
</head>
<body>
  <h1>${emoji} ${escapeHtml(title)}</h1>
  ${contentHtml}
</body>
</html>`;
}

export function tryParseHTMLToBlocks(htmlString = "") {
  if (!htmlString || typeof htmlString !== "string") return [];

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
          blocks.push({ id: makeBlockId(), type: "bullet", content: li.textContent.trim() });
        }
      });
    } else if (tagName === "ol") {
      Array.from(node.children).forEach((li) => {
        if (li.tagName.toLowerCase() === "li") {
          blocks.push({ id: makeBlockId(), type: "number", content: li.textContent.trim() });
        }
      });
    } else if (tagName === "blockquote") {
      blocks.push({ id: makeBlockId(), type: "quote", content: node.textContent.trim() });
    } else if (tagName === "pre" || tagName === "code") {
      const codeText = node.textContent;
      const classAttr = node.getAttribute("class") || "";
      const langMatch = classAttr.match(/language-(\w+)/);
      const language = langMatch ? langMatch[1] : null;
      blocks.push({ id: makeBlockId(), type: "code", content: codeText, meta: { language } });
    } else if (tagName === "hr") {
      blocks.push({ id: makeBlockId(), type: "divider", content: "" });
    } else if (node.classList.contains("callout")) {
      blocks.push({ id: makeBlockId(), type: "callout", content: node.textContent.trim(), calloutIcon: "💡" });
    } else if (node.classList.contains("math")) {
      let formula = node.textContent.trim();
      if (formula.startsWith("$$") && formula.endsWith("$$")) {
        formula = formula.slice(2, -2).trim();
      }
      blocks.push({ id: makeBlockId(), type: "math", content: formula });
    } else if (tagName === "p") {
      const checkbox = node.querySelector("input[type=checkbox]");
      if (checkbox) {
        const text = node.textContent.trim();
        blocks.push({ id: makeBlockId(), type: "todo", content: text, checked: checkbox.checked });
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

  (blocks || []).forEach((block) => {
    const content = block.content || "";
    switch (block.type) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
        lines.push(`\n${content}\n${"-".repeat(Math.max(4, content.length))}`);
        break;
      case "bullet":
        lines.push(`• ${content}`);
        break;
      case "number":
        lines.push(`1. ${content}`);
        break;
      case "todo":
        lines.push(`[${block.checked ? "x" : " "}] ${content}`);
        break;
      case "quote":
        lines.push(`"${content}"`);
        break;
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({ id: makeBlockId(), type: "bullet", content: trimmed.slice(2).trim() });
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({ id: makeBlockId(), type: "number", content: trimmed.replace(/^\d+\.\s/, "").trim() });
    } else if (trimmed.startsWith("[ ] ") || trimmed.startsWith("[] ")) {
      blocks.push({ id: makeBlockId(), type: "todo", content: trimmed.slice(trimmed.indexOf("]") + 1).trim(), checked: false });
    } else if (trimmed.startsWith("[x] ") || trimmed.startsWith("[X] ")) {
      blocks.push({ id: makeBlockId(), type: "todo", content: trimmed.slice(trimmed.indexOf("]") + 1).trim(), checked: true });
    } else if (trimmed.startsWith("[NOTE: ") && trimmed.endsWith("]")) {
      blocks.push({ id: makeBlockId(), type: "callout", content: trimmed.slice(7, -1).trim() });
    } else if (trimmed.startsWith("[MATH: ") && trimmed.endsWith("]")) {
      blocks.push({ id: makeBlockId(), type: "math", content: trimmed.slice(7, -1).trim() });
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

  (blocks || []).forEach((block) => {
    const content = block.content || "";
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
      case "bullet":
        children.push(new Paragraph({ text: `• ${content}`, spacing: { after: 60 }, indent: { left: 360 } }));
        break;
      case "number":
        children.push(new Paragraph({ text: `1. ${content}`, spacing: { after: 60 }, indent: { left: 360 } }));
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
      case "quote":
        children.push(new Paragraph({
          children: [new TextRun({ text: `"${content}"`, italic: true })],
          indent: { left: 720 },
          spacing: { before: 120, after: 120 },
        }));
        break;
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
      case "math":
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "Formula: ", bold: true, italic: true }),
            new TextRun({ text: content, font: "Consolas", italic: true }),
          ],
          spacing: { before: 120, after: 120 },
          indent: { left: 360 },
        }));
        break;
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

export async function tryParseDocxToBlocks(arrayBuffer) {
  const result = await mammoth.convertToHtml({ arrayBuffer });
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

  if (ext === "socratic" || (ext === "json" && filename.toLowerCase().includes("socratic"))) {
    const { importWorkspaceFromJSON } = await import("./backup.js");
    const res = await importWorkspaceFromJSON(file, { targetSpace: targetSpace === "Original" ? "Original" : targetSpace, overwrite: false });
    const firstImported = res.notes?.[0];
    if (firstImported) return firstImported;
    return { id: `note_socratic_${Date.now()}`, spaceId: targetSpace, title: rawTitle, blocks: [] };
  } else if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    blocks = await tryParseDocxToBlocks(arrayBuffer);
  } else if (ext === "html" || ext === "htm") {
    const htmlText = await file.text();
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
  const noteTitle = headingBlock?.content || rawTitle || "Imported Note";

  // Create fresh note object with fresh ID
  const freshNote = {
    id: makeFreshNoteId(),
    spaceId: targetSpace,
    space: targetSpace,
    title: noteTitle,
    blocks: blocks.length > 0 ? blocks : [{ id: makeBlockId(), type: "text", content: "" }],
    banner: null,
    emoji: "📄",
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save cleanly into Dexie IndexedDB (db.notes)
  await saveNote(freshNote);

  return freshNote;
}
