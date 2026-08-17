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

// Matches how blocksToMarkdownLossy writes a callout: "> <icon> <text>".
// Any emoji works as the icon since block.calloutIcon is freeform.
const CALLOUT_QUOTE_RE = /^>\s(\p{Extended_Pictographic}️?)\s(.*)$/u;

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

  return sanitized;
}

/**
 * ─── 2. MARKDOWN EXPORT & IMPORT ──────────────────────────────────────────
 * blocksToMarkdownLossy() & tryParseMarkdownToBlocks()
 */
export function blocksToMarkdownLossy(rawBlocks = []) {
  const blocks = filterBlocksForExport(rawBlocks);
  // A running count of consecutive numbered items, so a three-item list
  // renders "1. / 2. / 3." rather than "1." three times over. It resets the
  // moment a non-number block breaks the run.
  let numberIndex = 0;

  return blocks
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
        case "bullet":
          return `- ${content}`;
        case "number":
          numberIndex += 1;
          return `${numberIndex}. ${content}`;
        case "todo":
          return `[${block.checked ? "x" : " "}] ${content}`;
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
    } else if (line.startsWith("💡 ") || line.startsWith(">! ")) {
      resultBlocks.push({ id: makeBlockId(), type: "callout", content: line.slice(3) });
    } else if (CALLOUT_QUOTE_RE.test(line)) {
      // A callout is exported as "> <icon> <text>" — a blockquote carrying an
      // emoji, which is indistinguishable from a real quote by prefix alone.
      // Checked before the generic quote branch so importing a note round
      // trips callouts back to callouts instead of flattening them to quotes.
      const [, icon, content] = line.match(CALLOUT_QUOTE_RE);
      resultBlocks.push({ id: makeBlockId(), type: "callout", content, calloutIcon: icon });
    } else if (line.startsWith("> ")) {
      resultBlocks.push({ id: makeBlockId(), type: "quote", content: line.slice(2) });
    } else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      resultBlocks.push({ id: makeBlockId(), type: "divider", content: "" });
    } else if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 2) {
      resultBlocks.push({ id: makeBlockId(), type: "math", content: trimmed.slice(2, -2).trim() });
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
/** Render one non-list block to HTML. Lists are handled by the caller, since
 * consecutive items need to share a single <ul>/<ol> rather than one each. */
function blockToHtmlFragment(block) {
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
    case "todo":
      return `<p><input type="checkbox" ${block.checked ? "checked" : ""} disabled /> ${content}</p>`;
    case "toggle": {
      const details = block.details ?? block.toggleContent ?? "";
      return `<details ${block.open !== false ? "open" : ""} style="margin:10px 0; padding:10px; background:#181c27; border-radius:6px; border:1px solid #363d54;"><summary style="cursor:pointer; font-weight:600; color:#f1f3fa;">${content}</summary><div style="margin-top:8px; padding-left:16px; color:#c5cbe3;">${escapeHtml(details)}</div></details>`;
    }
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
    case "inlinemath":
      return `<div class="inlinemath" style="display:inline-block; font-family:monospace; padding:3px 8px; background:#181c27; border:1px solid rgba(240,192,74,0.3); border-radius:6px; color:#f7d67c; margin:4px 0;">$${content}$</div>`;
    case "divider":
      return `<hr style="border:0; border-top:1px solid #363d54; margin:24px 0;" />`;
    case "site": {
      const url = escapeHtml(block.url || content);
      return `<div class="site-bookmark" style="margin:12px 0; padding:12px; background:#181c27; border:1px solid #363d54; border-radius:8px;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#f7d67c; text-decoration:none; font-weight:600;">🌐 ${url}</a></div>`;
    }
    case "media": {
      const mediaUrl = escapeHtml(block.url || content);
      const kind = block.mediaKind || "image";
      if (kind === "audio") {
        return `<div class="media-audio" style="margin:12px 0;"><audio src="${mediaUrl}" controls style="width:100%;"></audio></div>`;
      } else if (kind === "video") {
        return `<div class="media-video" style="margin:12px 0;"><video src="${mediaUrl}" controls style="max-width:100%; border-radius:8px;"></video></div>`;
      } else {
        return `<div class="media-image" style="margin:12px 0;"><img src="${mediaUrl}" alt="${content || "media"}" style="max-width:100%; border-radius:8px;" />${content ? `<p style="font-size:12px; color:#9aa2bc; margin-top:4px;">${content}</p>` : ""}</div>`;
      }
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
  // getting its own single-item list — the previous version wrapped every
  // item in its own list, which also restarted numbered lists at "1." every
  // time.
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listType) return;
    const tag = listType === "bullet" ? "ul" : "ol";
    pieces.push(`<${tag}>${listItems.map((item) => `<li>${item}</li>`).join("")}</${tag}>`);
    listType = null;
    listItems = [];
  };

  for (const block of blocks) {
    if (block.type === "bullet" || block.type === "number") {
      if (listType && listType !== block.type) flushList();
      listType = block.type;
      listItems.push(escapeHtml(block.content || ""));
      continue;
    }
    flushList();
    const html = blockToHtmlFragment(block);
    if (html) pieces.push(html);
  }
  flushList();

  const contentHtml = pieces.join("\n");

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
  if (typeof DOMParser === "undefined") return [];

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
    } else if (tagName === "details") {
      const summary = node.querySelector("summary");
      const title = summary ? summary.textContent.trim() : "";
      const clone = node.cloneNode(true);
      const cloneSummary = clone.querySelector("summary");
      if (cloneSummary) cloneSummary.remove();
      const details = clone.textContent.trim();
      blocks.push({ id: makeBlockId(), type: "toggle", content: title, open: node.hasAttribute("open"), details });
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
    } else if (node.classList.contains("inlinemath") || (node.tagName.toLowerCase() === "span" && node.classList.contains("katex-inline-node"))) {
      let formula = node.getAttribute("data-formula") || node.textContent.trim();
      if (formula.startsWith("$") && formula.endsWith("$")) {
        formula = formula.slice(1, -1).trim();
      }
      blocks.push({ id: makeBlockId(), type: "text", content: formula ? `$${formula}$` : "" });
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
      case "bullet":
        lines.push(`• ${content}`);
        break;
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
      case "inlinemath":
        lines.push(`$${content}$`);
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
    } else if (trimmed.startsWith("▶ ")) {
      blocks.push({ id: makeBlockId(), type: "toggle", content: trimmed.slice(2).trim(), open: true });
    } else if (trimmed.startsWith("↳ ") && blocks.length > 0 && blocks[blocks.length - 1].type === "toggle") {
      blocks[blocks.length - 1].details = trimmed.slice(2).trim();
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
      case "bullet":
        children.push(new Paragraph({ text: `• ${content}`, spacing: { after: 60 }, indent: { left: 360 } }));
        break;
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
            new TextRun({ text: "▶ ", bold: true, color: "F59E0B" }),
            new TextRun({ text: content, bold: true }),
          ],
          spacing: { before: 100, after: 40 },
          indent: { left: 360 },
        }));
        if (details && details.trim()) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `↳ ${details.trim()}`, italic: true, color: "6B7280" }),
            ],
            spacing: { after: 80 },
            indent: { left: 720 },
          }));
        }
        break;
      }
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
      case "inlinemath":
        children.push(new Paragraph({
          children: [
            new TextRun({ text: "ƒ(x) ", bold: true, font: "Consolas", color: "F59E0B" }),
            new TextRun({ text: content, font: "Consolas", italic: true }),
          ],
          spacing: { before: 80, after: 80 },
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
 * 
 * @param {File|string} fileOrText 
 * @param {string} [targetSpace="School"] 
 * @returns {Promise<{ foldersCount: number, bookmarksCount: number, folders: Array, bookmarks: Array }>}
 */
export async function importBookmarksFromHtml(fileOrText, targetSpace = "School") {
  const { db } = await import("./db.js");
  let text = "";
  if (typeof fileOrText === "string") {
    text = fileOrText;
  } else if (fileOrText && typeof fileOrText.text === "function") {
    text = await fileOrText.text();
  } else {
    throw new Error("Invalid file or content provided for bookmarks import.");
  }

  const { folders, bookmarks } = parseNetscapeBookmarksHtml(text, targetSpace);

  if (folders.length > 0 && db.folders) {
    await db.folders.bulkPut(folders);
  }
  if (bookmarks.length > 0 && db.bookmarks) {
    await db.bookmarks.bulkPut(bookmarks);
  }

  return {
    foldersCount: folders.length,
    bookmarksCount: bookmarks.length,
    folders,
    bookmarks,
  };
}

