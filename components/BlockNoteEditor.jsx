"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { Lock, Sparkles, AlertCircle } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  CORE_LANGUAGES,
  normalizeLanguage,
  TOKEN_STYLES,
  tokenizeCode,
} from "@/lib/syntaxHighlighter";
import { reformatNoteContent } from "@/lib/aiService";
import { getNormalizedTableData, getNormalizedColumnsData, parseMarkdownTableRow } from "@/lib/exportImport";



// ─── BlockNoteEditor ────────────────────────────────────────────────
// Full Notion-style block suite:
//   • Headings 1–4 (h1, h2, h3, h4)
//   • Bullet List, Numbered List, To-Do List (checkboxes), Toggle List
//   • Callout Box with icon picker (💡, ⚠️, 📌, 🔥, ⭐, 🎉, ℹ️, 🦆)
//   • Quote (accent bar), Divider (hr), Note Link (workspace note picker)
//   • Media Embeds (Image / Audio / Video) & Clickable Site Bookmark Embeds
//   • Math Equation Container (LaTeX & KaTeX renderer)
//   • Interactive Table Grid Block (cell editing, add/del cols/rows, tab nav)
//   • 2–5 Columns Split Layout Block (comparative dual/multi-column cards)
//   • 6-dots (⠿) context menu: Explain / Quiz, formatting (B, I, U, S), turn-into
// ─────────────────────────────────────────────────────────────────────

const BLOCK_TYPES = [
  { type: "text", label: "Text", icon: "Aa", description: "Plain text paragraph" },
  { type: "h1", label: "Heading 1", icon: "H1", description: "Large section heading" },
  { type: "h2", label: "Heading 2", icon: "H2", description: "Medium section heading" },
  { type: "h3", label: "Heading 3", icon: "H3", description: "Small section heading" },
  { type: "h4", label: "Heading 4", icon: "H4", description: "Sub-heading" },
  { type: "bullet", label: "Bullet List", icon: "•", description: "Bulleted list item" },
  { type: "number", label: "Numbered List", icon: "1.", description: "Numbered list item" },
  { type: "todo", label: "To-Do List", icon: "☑", description: "Track tasks with a checkbox" },
  { type: "toggle", label: "Toggle List", icon: "▶", description: "Collapsible text container" },
  { type: "callout", label: "Callout Box", icon: "💡", description: "Highlighted callout frame" },
  { type: "columns", label: "2–5 Columns Split", icon: "⫽", description: "Side-by-side comparative column layout" },
  { type: "table", label: "Table", icon: "▦", description: "Insert an interactive grid table" },
  { type: "quote", label: "Quote", icon: "“", description: "Capture quotes & citations" },
  { type: "math", label: "Math Equation", icon: "∑", description: "LaTeX formula block & KaTeX renderer" },
  { type: "inlinemath", label: "Inline Equation", icon: "ƒ(x)", description: "Insert inline LaTeX formula ($x$)" },
  { type: "divider", label: "Divider", icon: "―", description: "Visual horizontal line" },
  { type: "site", label: "Site Bookmark Embed", icon: "🌐", description: "Clickable website card" },
  { type: "media", label: "Image / Video / YouTube", icon: "🎬", description: "Embed YouTube, video, audio or image" },
  { type: "code", label: "Code Snippet", icon: "</>", description: "Code block with syntax" },
];


const BANNER_PRESETS = [
  { id: "cyber", label: "Cyberpunk", style: "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" },
  { id: "sunset", label: "Sunset Amber", style: "bg-gradient-to-r from-amber-500 via-orange-600 to-red-600" },
  { id: "ocean", label: "Ocean Teal", style: "bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600" },
  { id: "midnight", label: "Midnight Blue", style: "bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900" },
  { id: "gold", label: "Socratic Gold", style: "bg-gradient-to-r from-yellow-400 via-amber-500 to-amber-600" },
];

const CALLOUT_ICONS = ["💡", "⚠️", "📌", "🔥", "⭐", "🎉", "ℹ️", "🦆"];

const NOTE_EMOJIS = [
  "📝", "🎓", "💡", "🚀", "📚", "💻", "🎨", "⚡",
  "🦆", "🔥", "⭐", "🎯", "📌", "✨", "🧪", "🧠",
  "🏆", "🌱", "💬", "🌐", "⚙️", "🔮", "💎", "📜"
];

export function getYouTubeEmbedInfo(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  // Match youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/..., youtube.com/shorts/..., m.youtube.com/watch?v=...
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

function formatUrl(url) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function makeId() {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createBlock(type = "text", content = "", extra = {}) {
  return { id: extra.id || makeId(), type, content, ...extra };
}

// Matches how blocksToMarkdown writes a callout: "> <icon> <text>" or standard emoji/icon
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

function blockToMarkdown(block) {
  if (!block) return "";
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
    case "bullet": {
      const indent = "  ".repeat(Math.max(0, Math.min(4, Number(block.level) || 0)));
      return `${indent}- ${content}`;
    }
    case "number":
      return `1. ${content}`;
    case "todo":
      return block.checked ? `[x] ${content}` : `[ ] ${content}`;
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
    case "code":
      return `\`\`\`${block.language || block.meta?.language || ""}\n${content}\n\`\`\``;
    case "math":
      return `$$\n${content}\n$$`;
    case "inlinemath":
      return content.startsWith("$") && content.endsWith("$") ? content : `$${content}$`;
    case "site": {
      const url = block.url || block.content || "";
      const title = block.title || block.content || url || "Bookmark";
      return url ? `[${title}](${url})` : title;
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
          cells.push(r && r[i] !== undefined ? String(r[i]).replace(/\|/g, "\\|") : "");
        }
        return `| ${cells.join(" | ")} |`;
      };
      return [formatRow(headers), `| ${Array(colCount).fill("---").join(" | ")} |`, ...rows.map(formatRow)].join("\n");
    }
    case "text":
    default:
      return content;
  }
}

function htmlNodeToInlineMarkdown(node) {
  if (!node) return "";
  if (node.nodeType === 3) {
    // TEXT_NODE
    return node.textContent || "";
  }
  if (node.nodeType !== 1) return ""; // ELEMENT_NODE

  const tag = node.tagName.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "noscript" || tag === "head" || tag === "meta" || tag === "link") return "";

  const childText = Array.from(node.childNodes)
    .map(htmlNodeToInlineMarkdown)
    .join("");

  if (tag === "br") return "\n";
  if (!childText && tag !== "img") return "";

  const style = node.getAttribute("style") || "";
  const isBoldStyle = /font-weight\s*:\s*(?:700|800|900|bold)/i.test(style);
  const isItalicStyle = /font-style\s*:\s*italic/i.test(style);
  const isStrikeStyle = /text-decoration(?:-line)?\s*:\s*line-through/i.test(style);
  const isCodeStyle = /font-family\s*:\s*(?:monospace|courier|consolas|source code pro)/i.test(style);

  let formatted = childText;

  // Inline code / monospace
  if (tag === "code" || tag === "tt" || tag === "kbd" || isCodeStyle) {
    const trimmed = formatted.trim();
    if (trimmed && !trimmed.startsWith("`") && !trimmed.endsWith("`")) {
      formatted = formatted.replace(trimmed, `\`${trimmed}\``);
    }
  }

  // Bold / Strong / Google Docs 700 weight
  if (tag === "strong" || tag === "b" || isBoldStyle) {
    const isDocGuid = node.id && node.id.startsWith("docs-internal-guid") && /font-weight\s*:\s*normal/i.test(style);
    if (!isDocGuid) {
      const leadingSpace = (formatted.match(/^(\s*)/) || ["", ""])[1];
      const trailingSpace = (formatted.match(/(\s*)$/) || ["", ""])[1];
      const trimmed = formatted.trim();
      const isAlreadyBold = (trimmed.startsWith("**") && trimmed.endsWith("**")) || (trimmed.startsWith("__") && trimmed.endsWith("__"));
      if (trimmed && !isAlreadyBold) {
        formatted = `${leadingSpace}**${trimmed}**${trailingSpace}`;
      }
    }
  }

  // Italic / Em / Google Docs italic
  if (tag === "em" || tag === "i" || isItalicStyle) {
    const leadingSpace = (formatted.match(/^(\s*)/) || ["", ""])[1];
    const trailingSpace = (formatted.match(/(\s*)$/) || ["", ""])[1];
    const trimmed = formatted.trim();
    const isTripleStar = trimmed.startsWith("***") && trimmed.endsWith("***");
    const isSingleStar = trimmed.startsWith("*") && !trimmed.startsWith("**") && trimmed.endsWith("*") && !trimmed.endsWith("**");
    const isSingleUnderscore = trimmed.startsWith("_") && !trimmed.startsWith("__") && trimmed.endsWith("_") && !trimmed.endsWith("__");
    const isMixed = (trimmed.startsWith("**_") && trimmed.endsWith("_**")) || (trimmed.startsWith("_**") && trimmed.endsWith("**_"));
    const isAlreadyItalic = isTripleStar || isSingleStar || isSingleUnderscore || isMixed;

    if (trimmed && !isAlreadyItalic) {
      formatted = `${leadingSpace}*${trimmed}*${trailingSpace}`;
    }
  }

  // Strikethrough
  if (tag === "s" || tag === "strike" || tag === "del" || isStrikeStyle) {
    const trimmed = formatted.trim();
    if (trimmed && !trimmed.startsWith("~~") && !trimmed.endsWith("~~")) {
      formatted = formatted.replace(trimmed, `~~${trimmed}~~`);
    }
  }

  // Highlight
  if (tag === "mark") {
    const trimmed = formatted.trim();
    if (trimmed && !trimmed.startsWith("==") && !trimmed.endsWith("==")) {
      formatted = formatted.replace(trimmed, `==${trimmed}==`);
    }
  }

  // Hyperlink
  if (tag === "a") {
    const href = node.getAttribute("href");
    const trimmed = formatted.trim();
    if (href && trimmed && !trimmed.startsWith("[")) {
      formatted = formatted.replace(trimmed, `[${trimmed}](${href})`);
    }
  }

  // Inline Image
  if (tag === "img") {
    const src = node.getAttribute("src");
    const alt = node.getAttribute("alt") || "";
    if (src) {
      formatted = `![${alt}](${src})`;
    }
  }

  return formatted;
}

export function parseHtmlToBlocks(htmlString) {
  if (!htmlString || typeof htmlString !== "string" || typeof DOMParser === "undefined") return [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    if (!doc || !doc.body) return [];

    const blocks = [];

    // Helper to unwrap Google Docs container wrapper if present
    let container = doc.body;
    if (
      container.children.length === 1 &&
      container.firstElementChild.id &&
      container.firstElementChild.id.startsWith("docs-internal-guid")
    ) {
      container = container.firstElementChild;
    }

    function processChildNodes(parent) {
      Array.from(parent.children).forEach((node) => {
        const tag = node.tagName.toLowerCase();

        if (tag === "h1") {
          const content = htmlNodeToInlineMarkdown(node).trim();
          if (content) blocks.push(createBlock("h1", content));
        } else if (tag === "h2") {
          const content = htmlNodeToInlineMarkdown(node).trim();
          if (content) blocks.push(createBlock("h2", content));
        } else if (tag === "h3") {
          const content = htmlNodeToInlineMarkdown(node).trim();
          if (content) blocks.push(createBlock("h3", content));
        } else if (tag === "h4" || tag === "h5" || tag === "h6") {
          const content = htmlNodeToInlineMarkdown(node).trim();
          if (content) blocks.push(createBlock("h4", content));
        } else if (tag === "hr") {
          blocks.push(createBlock("divider", ""));
        } else if (tag === "pre") {
          const codeEl = node.querySelector("code") || node;
          const langMatch = (codeEl.className || "").match(/language-([a-zA-Z0-9_-]+)/);
          const lang = langMatch ? langMatch[1] : null;
          blocks.push(createBlock("code", codeEl.textContent || "", { language: lang, meta: { language: lang } }));
        } else if (tag === "blockquote") {
          const content = htmlNodeToInlineMarkdown(node).trim();
          if (content.startsWith("💡 ") || content.startsWith(">! ") || OBSIDIAN_CALLOUT_RE.test(`> ${content}`)) {
            blocks.push(createBlock("callout", content.replace(/^(💡|>!)\s*/, ""), { calloutIcon: "💡" }));
          } else {
            blocks.push(createBlock("quote", content));
          }
        } else if (tag === "ul" || tag === "ol") {
          function parseListChildren(listNode, level = 0) {
            const isOrdered = listNode.tagName.toLowerCase() === "ol";
            Array.from(listNode.children).forEach((li) => {
              if (li.tagName.toLowerCase() === "li") {
                const checkbox = li.querySelector("input[type=checkbox]");
                const isTodo = !!checkbox || li.getAttribute("data-list-type") === "checked" || li.getAttribute("role") === "checkbox";
                const nestedList = li.querySelector("ul, ol");
                const liClone = li.cloneNode(true);
                liClone.querySelectorAll("ul, ol").forEach((n) => n.remove());
                let content = htmlNodeToInlineMarkdown(liClone).trim();
                // Strip redundant list markers or numbers (e.g. "• ", "- ", "* ", "1. "), but NEVER strip bold (**) or italic (* or _)
                content = content
                  .replace(/^[•◦▪▫⁃]\s*/, "")
                  .replace(/^[-*+]\s+/, "")
                  .replace(/^\d+[.)]\s+/, "")
                  .trim();
                if (content) {
                  if (isTodo) {
                    blocks.push(createBlock("todo", content, { checked: checkbox ? checkbox.checked : false }));
                  } else if (isOrdered) {
                    blocks.push(createBlock("number", content));
                  } else {
                    blocks.push(createBlock("bullet", content, level > 0 ? { level } : {}));
                  }
                }
                if (nestedList) {
                  parseListChildren(nestedList, Math.min(4, level + 1));
                }
              }
            });
          }
          parseListChildren(node, 0);
        } else if (tag === "table") {
          let headers = [];
          const ths = Array.from(node.querySelectorAll("th"));
          if (ths.length > 0) {
            headers = ths.map((th) => htmlNodeToInlineMarkdown(th).trim());
          }
          const rows = [];
          const trs = Array.from(node.querySelectorAll("tr"));
          trs.forEach((tr, trIdx) => {
            const tds = Array.from(tr.querySelectorAll("td"));
            if (tds.length > 0) {
              rows.push(tds.map((td) => htmlNodeToInlineMarkdown(td).trim()));
            } else if (headers.length === 0 && trIdx === 0) {
              const firstThs = Array.from(tr.querySelectorAll("th"));
              if (firstThs.length > 0) {
                headers = firstThs.map((th) => htmlNodeToInlineMarkdown(th).trim());
              }
            }
          });

          if (headers.length === 0 && rows.length > 0) {
            headers = rows.shift();
          }

          if (headers.length > 0 || rows.length > 0) {
            blocks.push(
              createBlock("table", "", {
                tableData: {
                  headers: headers.length > 0 ? headers : ["Column 1", "Column 2"],
                  rows: rows.length > 0 ? rows : [["", ""]],
                  hasHeaderRow: true,
                },
              })
            );
          }
        } else if (tag === "iframe") {
          const src = node.getAttribute("src") || "";
          const ytInfo = getYouTubeEmbedInfo(src);
          if (ytInfo) {
            blocks.push(createBlock("media", "", { url: src, mediaKind: "youtube" }));
          }
        } else if (tag === "video") {
          const src = node.getAttribute("src") || node.querySelector("source")?.getAttribute("src") || "";
          if (src) {
            blocks.push(createBlock("media", "", { url: src, mediaKind: "video" }));
          }
        } else if (tag === "img" && node.parentElement === container) {
          const src = node.getAttribute("src") || "";
          const alt = node.getAttribute("alt") || "";
          if (src) {
            blocks.push(createBlock("media", alt, { url: src, mediaKind: "image" }));
          }
        } else if (tag === "details") {
          const summaryEl = node.querySelector("summary");
          const summaryText = summaryEl ? htmlNodeToInlineMarkdown(summaryEl).trim() : "Toggle";
          const clone = node.cloneNode(true);
          const cloneSummary = clone.querySelector("summary");
          if (cloneSummary) cloneSummary.remove();
          const detailsText = htmlNodeToInlineMarkdown(clone).trim();
          blocks.push(createBlock("toggle", summaryText, { details: detailsText, open: node.hasAttribute("open") }));
        } else {
          // Check if this container has block-level children
          const hasBlockChildren = Array.from(node.children).some((c) =>
            /^(p|div|h[1-6]|ul|ol|table|blockquote|pre|details|section|article)$/i.test(c.tagName)
          );
          if (hasBlockChildren) {
            processChildNodes(node);
          } else {
            const content = htmlNodeToInlineMarkdown(node).trim();
            if (content) {
              const ytInfo = getYouTubeEmbedInfo(content);
              if (ytInfo && /^https?:\/\//i.test(content)) {
                blocks.push(createBlock("media", "", { url: content, mediaKind: "youtube" }));
              } else {
                blocks.push(createBlock("text", content));
              }
            }
          }
        }
      });
    }

    processChildNodes(container);
    return blocks;
  } catch {
    return [];
  }
}


function parseMarkdownToBlocks(rawText) {
  if (!rawText || typeof rawText !== "string") return [];

  const lines = rawText.split(/\r?\n/);
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
        resultBlocks.push(
          createBlock("code", codeBuffer.join("\n"), { language: codeLang, meta: { language: codeLang } })
        );
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
            resultBlocks.push(createBlock("math", cleanMath));
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
        resultBlocks.push(createBlock("math", mathBuffer.join("\n")));
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
      resultBlocks.push(
        createBlock("toggle", singleDetailsMatch[1].replace(/<[^>]+>/g, "").trim() || "Toggle", {
          details: singleDetailsMatch[2].replace(/<[^>]+>/g, "").trim(),
          open: !trimmed.includes('open="false"'),
        })
      );
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
        resultBlocks.push(
          createBlock("toggle", detailsSummary || "Toggle", {
            details: detailsContentBuffer.join("\n").trim(),
            open: detailsOpen,
          })
        );
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


        resultBlocks.push(
          createBlock("table", "", {
            tableData: {
              headers: headers.length > 0 ? headers : ["Column 1", "Column 2"],
              rows: rows.length > 0 ? rows : [["", ""]],
              hasHeaderRow: true,
            },
          })
        );
        continue;
      }
    }

    // 4.6 Tab-separated values (TSV / Excel / Sheets paste detection)
    if (line.includes("\t")) {
      const parseTsvRow = (str) => str.split("\t").map((c) => c.trim());
      const headers = parseTsvRow(line);
      if (headers.length > 1) {
        const rows = [];
        while (i + 1 < lines.length && lines[i + 1].includes("\t")) {
          rows.push(parseTsvRow(lines[i + 1]));
          i += 1;
        }
        if (rows.length > 0) {
          resultBlocks.push(
            createBlock("table", "", {
              tableData: {
                headers,
                rows,
                hasHeaderRow: true,
              },
            })
          );
          continue;
        }
      }
    }

    // 4.7 Standalone bold category subheadings ending with colon (e.g. "* **Eye Structures:**", "**Eye Structures:**" or "**Eye Structures**:")
    const boldHeadingMatch = trimmed.match(/^(?:[*•\-+]\s*)?\*\*([^*:]+)(?::\*\*|\*\*:)[\s]*$/);
    if (boldHeadingMatch) {
      const headingText = boldHeadingMatch[1].trim();
      if (headingText) {
        resultBlocks.push(createBlock("h3", headingText));
        continue;
      }
    }

    // 5. Standard Markdown Tasks (Checked before generic bullets)
    const taskMatch = trimmed.match(/^[-*+]?\s*\[([ xX])\]\s*(.*)$/);

    if (taskMatch) {
      resultBlocks.push(
        createBlock("todo", taskMatch[2].trim(), { checked: taskMatch[1].toLowerCase() === "x" })
      );
      continue;
    }

    // 6. Headings
    if (trimmed.startsWith("#### ")) {
      resultBlocks.push(createBlock("h4", trimmed.slice(5).replace(/^(\*+|\#+|\s*)+/, "").replace(/(\*+|\s*)+$/, "").replace(/[:\s]+$/, "").trim()));
    } else if (trimmed.startsWith("### ")) {
      resultBlocks.push(createBlock("h3", trimmed.slice(4).replace(/^(\*+|\#+|\s*)+/, "").replace(/(\*+|\s*)+$/, "").replace(/[:\s]+$/, "").trim()));
    } else if (trimmed.startsWith("## ")) {
      resultBlocks.push(createBlock("h2", trimmed.slice(3).replace(/^(\*+|\#+|\s*)+/, "").replace(/(\*+|\s*)+$/, "").replace(/[:\s]+$/, "").trim()));
    } else if (trimmed.startsWith("# ")) {
      resultBlocks.push(createBlock("h1", trimmed.slice(2).replace(/^(\*+|\#+|\s*)+/, "").replace(/(\*+|\s*)+$/, "").replace(/[:\s]+$/, "").trim()));
    }
    // 7. Bullets
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("+ ")) {
      let bContent = trimmed.slice(2).trim();
      if (bContent.startsWith("* ") || bContent.startsWith("- ") || bContent.startsWith("+ ")) {
        bContent = bContent.replace(/^[*•\-+]\s+/, "").trim();
      }
      const indentSpaces = (line.match(/^(\s*)/)[1] || "").replace(/\t/g, "  ").length;
      const level = Math.min(4, Math.floor(indentSpaces / 2));
      resultBlocks.push(createBlock("bullet", bContent, level > 0 ? { level } : {}));
    }



    // 8. Numbered list items
    else if (/^\d+\.\s/.test(trimmed)) {
      resultBlocks.push(createBlock("number", trimmed.replace(/^\d+\.\s/, "").trim()));
    }
    // 9. Obsidian / GitHub Style Callouts
    else if (OBSIDIAN_CALLOUT_RE.test(line)) {
      const match = line.match(OBSIDIAN_CALLOUT_RE);
      const calloutType = (match[1] || "note").toLowerCase();
      const icon = OBSIDIAN_CALLOUT_ICONS[calloutType] || "💡";
      const calloutText = (match[2] || "").trim();
      resultBlocks.push(createBlock("callout", calloutText, { calloutIcon: icon }));
    }
    // 10. Unicode Emoji Callouts
    else if (CALLOUT_QUOTE_RE.test(line)) {
      const [, icon, content] = line.match(CALLOUT_QUOTE_RE);
      resultBlocks.push(createBlock("callout", content.trim(), { calloutIcon: icon }));
    } else if (line.startsWith("💡 ") || line.startsWith(">! ")) {
      resultBlocks.push(createBlock("callout", line.slice(3).trim(), { calloutIcon: "💡" }));
    }
    // 11. Quotes
    else if (line.startsWith("> ")) {
      resultBlocks.push(createBlock("quote", line.slice(2).trim()));
    }
    // 12. Dividers
    else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      resultBlocks.push(createBlock("divider", ""));
    }
    // 13. Inline math line
    else if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 2) {
      resultBlocks.push(createBlock("math", trimmed.slice(2, -2).trim()));
    }
    // 14. Media / YouTube / Image markdown: ![caption](url)
    else if (/^!\[(.*?)\]\((.*?)\)$/.test(trimmed)) {
      const match = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
      const url = match[2];
      const ytInfo = getYouTubeEmbedInfo(url);
      resultBlocks.push(
        createBlock("media", match[1], {
          url,
          mediaKind: ytInfo ? "youtube" : "image",
        })
      );
    }
    // 14.5 Standalone YouTube URL
    else if (getYouTubeEmbedInfo(trimmed) && /^https?:\/\//i.test(trimmed)) {
      resultBlocks.push(
        createBlock("media", "", {
          url: trimmed,
          mediaKind: "youtube",
        })
      );
    }
    // 15. Site Bookmark link: [title](url)
    else if (/^\[(.*?)\]\((https?:\/\/.*?)\)$/.test(trimmed)) {
      const match = trimmed.match(/^\[(.*?)\]\((https?:\/\/.*?)\)$/);
      resultBlocks.push(
        createBlock("site", match[1], {
          url: match[2],
          title: match[1],
        })
      );
    } else {
      resultBlocks.push(createBlock("text", line));
    }
  }

  if (codeBuffer.length > 0) {
    resultBlocks.push(createBlock("code", codeBuffer.join("\n"), { language: codeLang, meta: { language: codeLang } }));
  }
  if (mathBuffer.length > 0) {
    resultBlocks.push(createBlock("math", mathBuffer.join("\n")));
  }
  if (inDetailsBlock && detailsSummary) {
    resultBlocks.push(
      createBlock("toggle", detailsSummary, {
        details: detailsContentBuffer.join("\n").trim(),
        open: detailsOpen,
      })
    );
  }

  return resultBlocks.length > 0 ? resultBlocks : [createBlock("text", rawText)];
}

const SLASH_COMMAND_ITEMS = [
  { type: "text", label: "Text", icon: "Aa", description: "Plain text paragraph", keywords: ["text", "paragraph", "p"] },
  { type: "h1", label: "Heading 1", icon: "H1", description: "Large section heading", keywords: ["h1", "heading1", "title", "header1"] },
  { type: "h2", label: "Heading 2", icon: "H2", description: "Medium section heading", keywords: ["h2", "heading2", "header2"] },
  { type: "h3", label: "Heading 3", icon: "H3", description: "Small section heading", keywords: ["h3", "heading3", "header3"] },
  { type: "h4", label: "Heading 4", icon: "H4", description: "Sub-heading", keywords: ["h4", "heading4", "header4"] },
  { type: "columns", columnCount: 2, label: "2 Columns", icon: "⫽2", description: "2 side-by-side equal columns", keywords: ["2", "2 columns", "2 cols", "two", "column", "columns", "split", "compare", "dual", "grid", "col"] },
  { type: "columns", columnCount: 3, label: "3 Columns", icon: "⫽3", description: "3 side-by-side equal columns", keywords: ["3", "3 columns", "3 cols", "three", "column", "columns", "split", "compare", "grid", "col"] },
  { type: "columns", columnCount: 4, label: "4 Columns", icon: "⫽4", description: "4 side-by-side equal columns", keywords: ["4", "4 columns", "4 cols", "four", "column", "columns", "split", "compare", "grid", "col"] },
  { type: "columns", columnCount: 5, label: "5 Columns", icon: "⫽5", description: "5 side-by-side equal columns", keywords: ["5", "5 columns", "5 cols", "five", "column", "columns", "split", "compare", "grid", "col"] },
  { type: "bullet", label: "Bullet List", icon: "•", description: "Bulleted list item", keywords: ["bullet", "list", "ul"] },
  { type: "number", label: "Numbered List", icon: "1.", description: "Numbered list item", keywords: ["number", "numbered", "list", "ol"] },
  { type: "todo", label: "To-Do List", icon: "☑", description: "Track tasks with a checkbox", keywords: ["todo", "task", "checkbox", "check"] },
  { type: "toggle", label: "Toggle List", icon: "▶", description: "Collapsible text container", keywords: ["toggle", "collapse", "dropdown", "details"] },
  { type: "callout", label: "Callout Box", icon: "💡", description: "Highlighted callout frame", keywords: ["callout", "note", "box", "alert", "tip"] },
  { type: "table", label: "Table", icon: "▦", description: "Insert an interactive grid table", keywords: ["table", "grid", "matrix", "rows", "cols"] },
  { type: "quote", label: "Quote", icon: "“", description: "Capture quotes & citations", keywords: ["quote", "blockquote", "citation"] },
  { type: "math", label: "Math Equation", icon: "∑", description: "LaTeX formula block & KaTeX renderer", keywords: ["math", "latex", "equation", "formula", "katex"] },
  { type: "inlinemath", label: "Inline Equation", icon: "ƒ(x)", description: "Insert inline LaTeX formula ($x$)", keywords: ["inline", "inlinemath", "fx", "math", "formula"] },
  { type: "divider", label: "Divider", icon: "―", description: "Visual horizontal line", keywords: ["divider", "hr", "line", "separator"] },
  { type: "site", label: "Site Bookmark Embed", icon: "🌐", description: "Clickable website card", keywords: ["site", "bookmark", "link", "url", "web", "website"] },
  { type: "media", label: "Image / YouTube Video", icon: "🎬", description: "Embed YouTube video or upload image", keywords: ["media", "image", "photo", "picture", "youtube", "yt", "video", "embed"] },
  { type: "code", label: "Code Snippet", icon: "</>", description: "Code block with syntax", keywords: ["code", "snippet", "javascript", "python", "syntax"] },
];

// ─── Slash-Command Menu ─────────────────────────────────────────────
function SlashMenu({ onSelect, onClose, filter }) {
  const menuRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = SLASH_COMMAND_ITEMS.filter((bt) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      bt.label.toLowerCase().includes(q) ||
      bt.type.toLowerCase().includes(q) ||
      (bt.keywords && bt.keywords.some((k) => k.includes(q) || q.includes(k)))
    );
  });

  useEffect(() => {
    setActiveIdx(0);
  }, [filter]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[activeIdx]) {
          const item = filtered[activeIdx];
          onSelect(item.type, { columnCount: item.columnCount });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, filtered, onSelect, onClose]);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl animate-fade-in"
    >
      <p className="border-b border-ink-800 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-500">
        Block type
      </p>
      <ul className="max-h-56 overflow-y-auto py-1">
        {filtered.map((bt, i) => (
          <li key={`${bt.type}_${bt.columnCount || 0}_${i}`}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(bt.type, { columnCount: bt.columnCount });
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                i === activeIdx
                  ? "bg-ink-800 text-ink-100"
                  : "text-ink-400 hover:bg-ink-850"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                  i === activeIdx
                    ? "bg-duck-500/20 text-duck-300"
                    : "bg-ink-850 text-ink-500"
                }`}
              >
                {bt.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{bt.label}</p>
                <p className="truncate text-[11px] text-ink-500">{bt.description}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Notion 6-Dots Block Context Menu ───────────────────────────────
function BlockContextMenu({
  block,
  position = null,
  onClose,
  onChangeType,
  onDelete,
  onExplainBlock,
  onQuizBlock,
  onFormat,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}) {
  const menuRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const blockText = (
    block.type === "table" || block.type === "columns"
      ? blockToMarkdown(block)
      : block.content || block.formula || block.details || blockToMarkdown(block) || ""
  ).trim();

  const handleCopy = () => {
    if (!blockText) return;
    navigator.clipboard?.writeText(blockText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      ref={menuRef}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
            }
          : undefined
      }
      className={`${
        position ? "absolute" : "absolute -left-2 top-full mt-1"
      } z-[100] w-72 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl animate-fade-in p-2.5 text-xs space-y-2`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* AI Study Buttons */}
      {(onExplainBlock || onQuizBlock) && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={!blockText}
            onClick={() => {
              onExplainBlock?.(blockText);
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 font-medium text-ink-200 transition-colors hover:border-duck-500/50 hover:bg-ink-800 hover:text-duck-300 disabled:opacity-30"
          >
            <span>✨</span>
            <span>Explain</span>
          </button>
          <button
            type="button"
            disabled={!blockText}
            onClick={() => {
              onQuizBlock?.(blockText);
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-duck-500/30 bg-duck-500/10 px-2.5 py-1.5 font-medium text-duck-300 transition-colors hover:bg-duck-500/20 hover:text-duck-200 disabled:opacity-30"
          >
            <span>🦆</span>
            <span>Quiz me</span>
          </button>
        </div>
      )}

      {/* Quick Block Actions: Duplicate, Move Up, Move Down */}
      <div className="grid grid-cols-3 gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => {
            onDuplicate?.();
            onClose();
          }}
          className="flex items-center justify-center gap-1 rounded-md border border-ink-800 bg-ink-850 px-2 py-1 text-[11px] font-medium text-ink-300 hover:bg-ink-800 hover:text-ink-100 transition-colors"
          title="Duplicate Block"
        >
          <span>📋</span>
          <span>Clone</span>
        </button>
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={() => {
            onMoveUp?.();
            onClose();
          }}
          className="flex items-center justify-center gap-1 rounded-md border border-ink-800 bg-ink-850 px-2 py-1 text-[11px] font-medium text-ink-300 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30 transition-colors"
          title="Move Block Up"
        >
          <span>⬆️</span>
          <span>Up</span>
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={() => {
            onMoveDown?.();
            onClose();
          }}
          className="flex items-center justify-center gap-1 rounded-md border border-ink-800 bg-ink-850 px-2 py-1 text-[11px] font-medium text-ink-300 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30 transition-colors"
          title="Move Block Down"
        >
          <span>⬇️</span>
          <span>Down</span>
        </button>
      </div>

      {/* Copy Text Button */}
      {blockText && (
        <button
          type="button"
          onClick={handleCopy}
          className="flex w-full items-center justify-between rounded-md border border-ink-800 bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-ink-300 hover:bg-ink-800 hover:text-ink-100 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <span>📄</span>
            <span>Copy Content</span>
          </div>
          {copied && <span className="text-[10px] text-emerald-400 font-bold animate-fade-in">✓ Copied</span>}
        </button>
      )}

      {/* Turn Into Type List */}
      <div>
        <p className="px-1 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
          Turn into
        </p>
        <div className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5">
          {BLOCK_TYPES.map((bt) => (
            <button
              key={bt.type}
              type="button"
              onClick={() => {
                onChangeType(block.id, bt.type);
                onClose();
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors ${
                block.type === bt.type
                  ? "bg-duck-500/20 text-duck-300 font-semibold"
                  : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              <span className="w-5 text-center font-bold text-ink-400">{bt.icon}</span>
              <span>{bt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Delete Block */}
      <div className="border-t border-ink-800/80 pt-1">
        <button
          type="button"
          onClick={() => {
            onDelete(block.id);
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/15 px-2.5 py-1.5 text-left text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/25"
        >
          <span>🗑️</span>
          <span>Delete Block</span>
        </button>
      </div>
    </div>
  );
}

export {
  renderKatexToStringMemoized,
  escapeHtml,
  cleanZeroWidth,
  formatMarkdownInline,
  setBlockDOMFromText,
  tryAutoFormatInlineCode,
  tryAutoFormatInlineMath,
  handleInlineBoundaryKeyDown,
  setCaretToEnd,
  setCaretToStart,
  getDOMCaretLength,
  setCaretAtOffset,
  isCaretAtLogicalStart,
  isCaretAtBlockStart,
  isCaretAtLogicalEnd,
  isCaretAtBlockEnd,
  isCaretOnFirstVisualLine,
  isCaretOnLastVisualLine,
  getBlockTextFromDOM,
  splitBlockDOMAtRange,
  getSerializedTextFromRange,
} from "../lib/editorCaret.js";

import {
  renderKatexToStringMemoized,
  escapeHtml,
  cleanZeroWidth,
  formatMarkdownInline,
  setBlockDOMFromText,
  tryAutoFormatInlineCode,
  tryAutoFormatInlineMath,
  handleInlineBoundaryKeyDown,
  setCaretToEnd,
  setCaretToStart,
  getDOMCaretLength,
  setCaretAtOffset,
  isCaretAtLogicalStart,
  isCaretAtBlockStart,
  isCaretAtLogicalEnd,
  isCaretAtBlockEnd,
  isCaretOnFirstVisualLine,
  isCaretOnLastVisualLine,
  getBlockTextFromDOM,
  splitBlockDOMAtRange,
  getSerializedTextFromRange,
} from "../lib/editorCaret.js";

// ─── Single Block Component ─────────────────────────────────────────
const KaTeXRender = memo(function KaTeXRender({ formula, displayMode = false, className = "" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const html = renderKatexToStringMemoized(formula, { displayMode });
      containerRef.current.innerHTML = html;
    }
  }, [formula, displayMode]);

  return <span ref={containerRef} className={`katex-wrapper inline-block ${className}`} />;
});

function InlineEquationPopover({
  isOpen,
  initialFormula = "",
  placement = "bottom",
  onSave,
  onDelete,
  onClose,
}) {
  const [formula, setFormula] = useState(initialFormula);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const inputRef = useRef(null);
  const popoverRef = useRef(null);
  const presetsRef = useRef(null);
  const presetsBtnRef = useRef(null);

  useEffect(() => {
    setFormula(initialFormula);
    setPresetsOpen(false);
  }, [initialFormula, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        presetsOpen &&
        presetsRef.current &&
        !presetsRef.current.contains(e.target) &&
        !presetsBtnRef.current?.contains(e.target)
      ) {
        setPresetsOpen(false);
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, presetsOpen, onClose]);

  if (!isOpen) return null;

  const FORMULA_PRESETS = [
    { label: "Fraction", latex: "\\frac{a}{b}", display: "a/b" },
    { label: "Square Root", latex: "\\sqrt{x}", display: "√x" },
    { label: "Power", latex: "x^{n}", display: "xⁿ" },
    { label: "Derivative", latex: "\\frac{d}{dx}[f(x)]", display: "d/dx" },
    { label: "Integral", latex: "\\int_{a}^{b} f(x)\\,dx", display: "∫ f(x)" },
    { label: "Limit", latex: "\\lim_{x \\to 0} \\frac{\\sin x}{x}", display: "lim" },
    { label: "Summation", latex: "\\sum_{i=1}^{n} x_i", display: "∑ x_i" },
    { label: "Quadratic", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", display: "x = ..." },
    { label: "Einstein", latex: "E = mc^2", display: "E = mc²" },
    { label: "Euler", latex: "e^{i\\pi} + 1 = 0", display: "e^{iπ}" },
  ];

  const QUICK_SYMBOLS = [
    { label: "π", latex: "\\pi" },
    { label: "θ", latex: "\\theta" },
    { label: "α", latex: "\\alpha" },
    { label: "β", latex: "\\beta" },
    { label: "λ", latex: "\\lambda" },
    { label: "σ", latex: "\\sigma" },
    { label: "Δ", latex: "\\Delta" },
    { label: "∇", latex: "\\nabla" },
    { label: "±", latex: "\\pm" },
    { label: "≤", latex: "\\le" },
    { label: "≥", latex: "\\ge" },
    { label: "≠", latex: "\\neq" },
    { label: "≈", latex: "\\approx" },
    { label: "∞", latex: "\\infty" },
    { label: "·", latex: "\\cdot" },
    { label: "×", latex: "\\times" },
    { label: "→", latex: "\\to" },
    { label: "∂", latex: "\\partial" },
    { label: "∈", latex: "\\in" },
    { label: "⊂", latex: "\\subset" },
  ];

  const handleInsert = (latex) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? formula.length;
      const end = input.selectionEnd ?? formula.length;
      const next = formula.slice(0, start) + latex + formula.slice(end);
      setFormula(next);
      setTimeout(() => {
        if (input) {
          input.focus();
          const pos = start + latex.length;
          input.setSelectionRange(pos, pos);
        }
      }, 10);
    } else {
      setFormula((prev) => (prev ? prev + " " : "") + latex);
    }
  };

  const handleCommit = () => {
    onSave(formula);
  };

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute left-0 z-[100] w-full max-w-lg rounded-xl border border-duck-500/50 bg-ink-900/98 p-3 shadow-2xl backdrop-blur space-y-2.5 animate-fade-in text-left pointer-events-auto ${
        placement === "top" ? "bottom-full mb-2" : "top-full mt-1.5"
      }`}
      style={{
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(240, 192, 74, 0.25)",
      }}
    >
      <div className="flex items-center justify-end gap-2 border-b border-ink-800 pb-2">
        <div className="flex items-center gap-1.5 relative">
          <button
            ref={presetsBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPresetsOpen((prev) => !prev);
            }}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-all ${
              presetsOpen
                ? "border-duck-400 bg-duck-500/25 text-duck-200 shadow-sm"
                : "border-ink-700 bg-ink-850 text-ink-300 hover:border-duck-500/50 hover:bg-duck-500/10 hover:text-duck-200"
            }`}
            title="Open math equation & symbol presets"
          >
            <span>✨ Presets</span>
            <span className="text-[9px] opacity-70">▾</span>
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-colors"
              title="Remove equation from sentence"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={handleCommit}
            className="rounded bg-duck-500/20 px-2.5 py-0.5 text-xs font-semibold text-duck-200 border border-duck-400/40 hover:bg-duck-500/30 transition-colors"
          >
            Done ↵
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-ink-800 px-2 py-0.5 text-xs font-medium text-ink-300 hover:bg-ink-700 hover:text-ink-100 transition-colors"
          >
            Cancel
          </button>

          {/* Presets Popup Menu */}
          {presetsOpen && (
            <div
              ref={presetsRef}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className={`absolute right-0 z-[110] w-72 rounded-xl border border-duck-500/40 bg-ink-900/98 p-2.5 shadow-2xl backdrop-blur space-y-2.5 animate-fade-in text-left pointer-events-auto ${
                placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
              }`}
              style={{
                boxShadow: "0 20px 40px -5px rgba(0,0,0,0.85), 0 0 0 1px rgba(240, 192, 74, 0.25)",
              }}
            >
              {/* Common Formulas */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-duck-400/90 mb-1.5 px-0.5">
                  Formulas & Structures
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {FORMULA_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        handleInsert(p.latex);
                        setPresetsOpen(false);
                      }}
                      className="flex items-center justify-between rounded border border-ink-800 bg-ink-950/80 px-2 py-1 text-xs text-ink-200 hover:border-duck-500/50 hover:bg-duck-500/15 hover:text-duck-200 transition-colors group"
                      title={p.latex}
                    >
                      <span className="font-medium text-[11px]">{p.label}</span>
                      <span className="font-mono text-[10px] text-ink-500 group-hover:text-duck-300/80">{p.display}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Math Symbols */}
              <div className="border-t border-ink-800/80 pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-duck-400/90 mb-1.5 px-0.5">
                  Symbols & Greek
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {QUICK_SYMBOLS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        handleInsert(s.latex);
                        setPresetsOpen(false);
                      }}
                      className="flex h-7 items-center justify-center rounded border border-ink-800 bg-ink-950/80 font-mono text-xs font-medium text-ink-300 hover:border-duck-500/50 hover:bg-duck-500/20 hover:text-duck-200 transition-all"
                      title={`Insert ${s.latex}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <input
          ref={inputRef}
          type="text"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              handleCommit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder="LaTeX formula (e.g. f'(x) = 2x or \\lim_{x \\to 0}\\frac{\\sin x}{x})..."
          className="w-full rounded-lg border border-duck-500/50 bg-ink-950 px-3 py-1.5 font-mono text-xs text-duck-200 placeholder:text-ink-600 focus:border-duck-400 focus:outline-none focus:ring-1 focus:ring-duck-400/50"
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-950/80 px-3 py-1.5 min-h-[32px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 shrink-0">
            Preview:
          </span>
          <div className="overflow-x-auto py-0.5">
            {formula.trim() ? (
              <KaTeXRender
                formula={formula}
                displayMode={false}
                className="text-duck-200 font-semibold inline"
              />
            ) : (
              <span className="text-xs italic text-ink-600">Empty equation</span>
            )}
          </div>
        </div>
        {formula.trim() && (
          <span className="text-[10px] font-mono text-ink-500 shrink-0">KaTeX</span>
        )}
      </div>
    </div>
  );
}

// ─── Math Block Component (KaTeX LaTeX Equation Container) ───────────
function MathBlock({ block, onUpdateBlock, onSelect, onDelete, onAddAfter, onExitDown, onExitUp, isLocked = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formula, setFormula] = useState(block.content ?? "");
  const textareaRef = useRef(null);
  const viewportRef = useRef(null);
  const formulaInnerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const MIN_READABLE_SCALE = 0.75;

  useEffect(() => {
    setFormula(block.content ?? "");
  }, [block.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Intelligent visibility & font size scaling calculation
  useEffect(() => {
    function updateScale() {
      if (viewportRef.current && formulaInnerRef.current) {
        const viewportEl = viewportRef.current;
        const formulaEl = formulaInnerRef.current;

        const containerWidth = viewportEl.clientWidth - 32; // padding allowance
        const rawFormulaWidth = formulaEl.scrollWidth || formulaEl.offsetWidth;

        if (containerWidth > 0 && rawFormulaWidth > 0) {
          if (rawFormulaWidth <= containerWidth) {
            // Whole text is completely visible at 100% full scale
            setScale(1);
            setIsOverflowing(false);
          } else {
            const idealScale = containerWidth / rawFormulaWidth;
            if (idealScale >= MIN_READABLE_SCALE) {
              // Fits cleanly within the comfortable dynamic scale range
              setScale(idealScale);
              setIsOverflowing(false);
            } else {
              // Formula is too long to fit at readable scale -> lock to readable floor & enable scroll wheel
              setScale(MIN_READABLE_SCALE);
              setIsOverflowing(true);
            }
          }
        }
      }
    }

    updateScale();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScale) : null;
    if (ro && viewportRef.current) ro.observe(viewportRef.current);
    if (ro && formulaInnerRef.current) ro.observe(formulaInnerRef.current);

    return () => ro?.disconnect();
  }, [formula, isEditing]);

  // Horizontal mouse scroll wheel listener when equation overflows
  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const handleWheel = (e) => {
      if (!isOverflowing) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const canScrollLeft = viewportEl.scrollLeft > 0;
        const canScrollRight =
          viewportEl.scrollLeft < viewportEl.scrollWidth - viewportEl.clientWidth - 1;

        if ((e.deltaY < 0 && canScrollLeft) || (e.deltaY > 0 && canScrollRight)) {
          e.preventDefault();
          viewportEl.scrollLeft += e.deltaY * 0.85;
        }
      }
    };

    viewportEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewportEl.removeEventListener("wheel", handleWheel);
  }, [isOverflowing]);

  const MATH_PRESETS = [
    { label: "Quadratic", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
    { label: "Euler", latex: "e^{i\\pi} + 1 = 0" },
    { label: "Integral", latex: "\\int_{a}^{b} f(x) dx = F(b) - F(a)" },
    { label: "Einstein", latex: "E = mc^2" },
    { label: "Normal Dist", latex: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}" },
    { label: "Derivative", latex: "\\frac{d}{dx}\\left( \\sin(x) \\right) = \\cos(x)" },
    { label: "Matrix", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  ];

  const handleSave = () => {
    setIsEditing(false);
    onUpdateBlock(block.id, { content: formula.trim() });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setFormula(block.content ?? "");
    } else if (e.key === "ArrowDown") {
      e.stopPropagation();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = formula || "";
      const isLastLine = !val.substring(start).includes("\n");
      if (isLastLine && start === end) {
        e.preventDefault();
        handleSave();
        onExitDown?.(block.id);
      }
    } else if (e.key === "ArrowUp") {
      e.stopPropagation();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = formula || "";
      const isFirstLine = !val.substring(0, start).includes("\n");
      if (isFirstLine && start === end) {
        e.preventDefault();
        handleSave();
        onExitUp?.(block.id);
      }
    } else if (e.key === "ArrowLeft") {
      e.stopPropagation();
      if (e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
        e.preventDefault();
        handleSave();
        onExitUp?.(block.id);
      }
    } else if (e.key === "ArrowRight") {
      e.stopPropagation();
      const val = formula || "";
      if (e.target.selectionStart === val.length && e.target.selectionEnd === val.length) {
        e.preventDefault();
        handleSave();
        onExitDown?.(block.id);
      }
    } else if (e.key === "Backspace" && !formula.trim()) {
      if (!isLocked) {
        e.preventDefault();
        setIsEditing(false);
        onDelete?.(block.id);
      }
    }
  };

  return (
    <div
      tabIndex={0}
      onClick={() => {
        onSelect(block.id);
        if (!isLocked) setIsEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") {
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onExitDown?.(block.id);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onExitUp?.(block.id);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onExitUp?.(block.id);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onExitDown?.(block.id);
        } else if (e.key === "Enter" && !isEditing) {
          e.preventDefault();
          if (!isLocked) setIsEditing(true);
        } else if (
          e.key === "Delete" &&
          !isEditing &&
          e.target.tagName !== "INPUT" &&
          e.target.tagName !== "TEXTAREA"
        ) {
          if (!isLocked) {
            e.preventDefault();
            onDelete?.(block.id);
          }
        }
      }}
      id={`math_${block.id}`}
      className="group/mathblk relative my-3 overflow-hidden rounded-xl border border-ink-800 bg-ink-900/90 p-4 shadow-lg transition-all hover:border-duck-500/50 cursor-pointer outline-none focus:ring-1 focus:ring-duck-400/40"
    >
      {/* KaTeX Centered Equation Viewer (100% full formula visibility with dynamic auto-scaling) */}
      <div
        ref={viewportRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
          if (!isLocked) setIsEditing(true);
        }}
        className={`relative flex items-center min-h-[3.5rem] py-2.5 px-4 text-ink-100 text-lg bg-ink-950/60 rounded-lg border border-ink-800/80 cursor-pointer hover:border-duck-500/40 transition-colors w-full ${
          isOverflowing
            ? "justify-start overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-ink-700/80 hover:scrollbar-thumb-duck-500/50 scrollbar-track-transparent"
            : "justify-center overflow-hidden"
        }`}
      >
        <div
          ref={formulaInnerRef}
          style={{
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: isOverflowing ? "left center" : "center center",
            transition: "transform 0.15s ease-out",
          }}
          className={`flex items-center text-duck-300 ${isOverflowing ? "min-w-max pr-6" : "max-w-full justify-center"}`}
        >
          <KaTeXRender formula={formula || "E = mc^2"} displayMode={true} />
        </div>

        {/* Scroll hint indicator when overflowing */}
        {isOverflowing && (
          <div className="absolute right-2 bottom-1 text-[9px] font-mono text-ink-500/70 bg-ink-950/80 px-1.5 py-0.5 rounded border border-ink-800/60 pointer-events-none print:hidden opacity-70 group-hover/mathblk:opacity-100 transition-opacity">
            ↔ Scroll
          </div>
        )}
      </div>

      {/* Interactive LaTeX Code Input & Presets */}
      {!isLocked && isEditing && (
        <div
          className="mt-3 border-t border-ink-800/80 pt-3 space-y-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-duck-400">
                LaTeX Formula Input
              </label>
              <span className="text-[10px] text-ink-500 font-mono">Press Enter to exit · Shift+Enter for new line</span>
            </div>
            <textarea
              ref={textareaRef}
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}"
              rows={2}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none"
            />
          </div>

          {/* Action Toolbar with single Presets toggle button */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-ink-800/50">
            <button
              type="button"
              onClick={() => setPresetsOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                presetsOpen
                  ? "border-duck-400 bg-duck-500/25 text-duck-200 shadow-sm"
                  : "border-ink-700 bg-ink-850 text-ink-300 hover:border-duck-500/50 hover:bg-duck-500/10 hover:text-duck-200"
              }`}
              title="Toggle math formula presets & symbols"
            >
              <span>✨ Presets</span>
              <span className="text-[10px] opacity-70">{presetsOpen ? "▴" : "▾"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setPresetsOpen(false);
                  setFormula(block.content ?? "");
                }}
                className="rounded-md px-3 py-1 text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-duck-400 px-3 py-1 text-xs font-semibold text-ink-950 hover:bg-duck-300 cursor-pointer"
              >
                Done (Save)
              </button>
            </div>
          </div>

          {/* Expandable Presets & Symbols Tray */}
          {presetsOpen && (
            <div className="rounded-lg border border-ink-750 bg-ink-950 p-2.5 space-y-2 animate-fade-in text-left">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">
                  Formula Templates
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {MATH_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setFormula(preset.latex);
                        onUpdateBlock(block.id, { content: preset.latex });
                      }}
                      className="rounded-md border border-ink-750 bg-ink-850 px-2 py-0.5 text-[11px] font-mono text-ink-300 hover:border-duck-500/40 hover:bg-ink-800 hover:text-duck-300 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">
                  Quick Symbols
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    "\\pi", "\\theta", "\\alpha", "\\beta", "\\lambda", "\\sigma", "\\Delta", "\\nabla",
                    "\\pm", "\\le", "\\ge", "\\neq", "\\approx", "\\infty", "\\cdot", "\\times", "\\to", "\\partial", "\\sqrt{x}", "\\frac{a}{b}"
                  ].map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        const textarea = textareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart ?? formula.length;
                          const end = textarea.selectionEnd ?? formula.length;
                          const next = formula.slice(0, start) + sym + formula.slice(end);
                          setFormula(next);
                          setTimeout(() => {
                            textarea.focus();
                            const pos = start + sym.length;
                            textarea.setSelectionRange(pos, pos);
                          }, 10);
                        } else {
                          setFormula((prev) => (prev ? prev + " " : "") + sym);
                        }
                      }}
                      className="rounded border border-ink-750 bg-ink-850/80 px-1.5 py-0.5 text-xs font-mono text-ink-300 hover:border-duck-500/40 hover:bg-ink-800 hover:text-duck-200 transition-colors cursor-pointer"
                      title={sym}
                    >
                      {sym.replace(/^\\/, "")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Code Snippet Block (10-Language Syntax Highlighting & Dropdown) ──
function HighlightCode({ code, language }) {
  const normLang = normalizeLanguage(language);
  const tokens = useMemo(() => tokenizeCode(code || "", normLang), [code, normLang]);

  return (
    <code>
      {tokens.map((token, index) => {
        if (!token.type || token.type === "plain") {
          return <span key={index}>{token.text}</span>;
        }
        return (
          <span key={index} className={TOKEN_STYLES[token.type] || ""}>
            {token.text}
          </span>
        );
      })}
    </code>
  );
}

function CodeBlock({ block, onUpdateBlock, onSelect, onDelete, onAddAfter, onExitDown, onExitUp, isLocked = false, registerRef }) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (registerRef) registerRef(block.id, textareaRef);
  }, [block.id, registerRef]);

  const activeLangId = normalizeLanguage(block.language || block.meta?.language);
  const activeLangObj =
    CORE_LANGUAGES.find((l) => l.id === activeLangId) || CORE_LANGUAGES[0];

  const codeText = block.content || "";
  const lines = codeText.split("\n");
  const lineCount = Math.max(3, lines.length);

  const handleCopy = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const textToCopy = block.content || "";
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleSelectLang = (langId) => {
    if (isLocked) return;
    onUpdateBlock(
      block.id,
      {
        language: langId,
        meta: { ...(block.meta || {}), language: langId },
      },
      false
    );
  };

  const handleKeyDown = (e) => {
    if (isLocked) {
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "Enter") {
        e.preventDefault();
        return;
      }
    }
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    const val = block.content || "";

    if (e.key === "ArrowDown") {
      e.stopPropagation();
      const isLastLine = !val.substring(start).includes("\n");
      if (isLastLine && start === end) {
        e.preventDefault();
        onExitDown?.(block.id);
        return;
      }
    }
    if (e.key === "ArrowUp") {
      e.stopPropagation();
      const isFirstLine = !val.substring(0, start).includes("\n");
      if (isFirstLine && start === end) {
        e.preventDefault();
        onExitUp?.(block.id);
        return;
      }
    }
    if (e.key === "ArrowLeft") {
      e.stopPropagation();
      if (start === 0 && end === 0) {
        e.preventDefault();
        onExitUp?.(block.id);
        return;
      }
    }
    if (e.key === "ArrowRight") {
      e.stopPropagation();
      if (start === val.length && end === val.length) {
        e.preventDefault();
        onExitDown?.(block.id);
        return;
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (isLocked) return;
      if (e.shiftKey) {
        // Dedent 2 spaces if possible
        if (start >= 2 && val.substring(start - 2, start) === "  ") {
          const newVal = val.substring(0, start - 2) + val.substring(end);
          onUpdateBlock(block.id, { content: newVal }, false);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start - 2;
            }
          }, 0);
        }
      } else {
        // Indent 2 spaces
        const newVal = val.substring(0, start) + "  " + val.substring(end);
        onUpdateBlock(block.id, { content: newVal }, false);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          }
        }, 0);
      }
    } else if (e.key === "Enter") {
      // Auto-indent to match previous line leading spaces
      const currentLineText = val.substring(0, start).split("\n").pop() || "";
      const match = currentLineText.match(/^(\s+)/);
      if (match && match[1]) {
        e.preventDefault();
        const indent = match[1];
        const newVal = val.substring(0, start) + "\n" + indent + val.substring(start);
        onUpdateBlock(block.id, { content: newVal }, false);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1 + indent.length;
          }
        }, 0);
      }
    } else if (e.key === "Backspace" && (!block.content || !block.content.trim())) {
      if (!isLocked) {
        e.preventDefault();
        onDelete?.(block.id);
      }
    }
  };

  return (
    <div
      tabIndex={0}
      onClick={() => {
        onSelect(block.id);
        if (textareaRef.current && document.activeElement !== textareaRef.current) {
          textareaRef.current.focus();
        }
      }}
      onFocus={(e) => {
        if (e.target === e.currentTarget && textareaRef.current) {
          textareaRef.current.focus();
        }
      }}
      onKeyDown={(e) => {
        if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT" || e.target.tagName === "SELECT") {
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onExitDown?.(block.id);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onExitUp?.(block.id);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onExitUp?.(block.id);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onExitDown?.(block.id);
        } else if (e.key === "Enter") {
          e.preventDefault();
          onAddAfter?.(block.id, "", "text");
        } else if (e.key === "Delete" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "INPUT") {
          if (!isLocked) {
            e.preventDefault();
            onDelete?.(block.id);
          }
        }
      }}
      className="group/codeblk relative my-3 overflow-hidden rounded-xl border border-ink-800 bg-[#0f1219] font-mono text-sm shadow-xl transition-all hover:border-emerald-500/30 outline-none focus:ring-1 focus:ring-emerald-400/40"
    >
      {/* Top Header Bar with Language Dropdown & Copy Controls */}
      <div className="flex items-center justify-between border-b border-ink-800/80 bg-ink-900/90 px-3.5 py-2 select-none">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-[10px] font-extrabold text-emerald-400">
            &lt;/&gt;
          </span>
          <span className="text-xs font-semibold text-ink-300 font-sans">Code Snippet</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Static Language Badge for Print */}
          <span className="hidden print:inline-block font-mono text-[10px] font-bold uppercase tracking-wider text-ink-600 border border-ink-400/60 rounded px-1.5 py-0.5">
            {activeLangObj.label || activeLangId}
          </span>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            onMouseDown={(e) => e.stopPropagation()}
            title="Copy code snippet"
            className="flex items-center gap-1 rounded-md border border-ink-750 bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-ink-300 transition-colors hover:border-ink-600 hover:bg-ink-800 hover:text-ink-100 pointer-events-auto relative z-20 print:hidden cursor-pointer"
          >
            {copied ? (
              <>
                <span className="text-emerald-400">✓</span>
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Copy</span>
              </>
            )}
          </button>

          {/* 10-Language Selector Dropdown */}
          <div className="relative pointer-events-auto z-20 print:hidden">
            <select
              value={activeLangId}
              disabled={isLocked}
              onChange={(e) => handleSelectLang(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className={`cursor-pointer rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-ink-750 focus:outline-none pointer-events-auto ${
                isLocked ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {CORE_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-ink-900 text-ink-100">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Code Editor Body with Line Numbers */}
      <div className="relative flex min-h-[4.5rem] bg-[#0d1017] font-mono text-xs sm:text-sm leading-relaxed overflow-hidden rounded-b-xl">
        {/* Line Numbers Gutter */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            textareaRef.current?.focus();
          }}
          className="select-none py-3.5 pl-3 pr-2.5 text-right font-mono text-ink-600 border-r border-ink-850 bg-ink-950/60 shrink-0 text-xs leading-relaxed min-w-[2.5rem] cursor-pointer"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="leading-relaxed">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea Code Editor */}
        <textarea
          id={`code_${block.id}`}
          ref={textareaRef}
          value={block.content || ""}
          readOnly={isLocked}
          onChange={(e) => onUpdateBlock(block.id, { content: e.target.value }, false)}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="// Type or paste code here..."
          rows={lineCount}
          style={{ tabSize: 2 }}
          className="flex-1 block w-full resize-y bg-transparent font-mono text-xs sm:text-sm leading-relaxed text-emerald-300 placeholder:text-ink-600 focus:outline-none p-3.5 whitespace-pre border-0 outline-0 shadow-none ring-0 selection:bg-emerald-500/20 selection:text-emerald-100 pointer-events-auto overflow-x-auto"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── Table Cell Component (Rich Markdown & Inline KaTeX Editable Cell) ──────
function TableCell({
  id,
  value = "",
  isHeader = false,
  placeholder = "...",
  onChange,
  onKeyDown,
  onDelete,
  onMathClick,
  rowIdx,
  colIdx,
  isLocked = false,
}) {
  const cellRef = useRef(null);

  useEffect(() => {
    if (cellRef.current && document.activeElement !== cellRef.current) {
      const currentDomText = getBlockTextFromDOM(cellRef.current);
      if (currentDomText !== value) {
        setBlockDOMFromText(cellRef.current, value || "");
      }
    }
  }, [value]);

  const handleInput = () => {
    if (isLocked) return;
    if (cellRef.current) {
      tryAutoFormatInlineCode(cellRef.current);
      tryAutoFormatInlineMath(cellRef.current);
      const newText = getBlockTextFromDOM(cellRef.current);
      onChange(newText);
    }
  };

  const handleBlur = () => {
    if (cellRef.current) {
      setBlockDOMFromText(cellRef.current, value || "");
    }
  };

  const handleClick = (e) => {
    if (isLocked) return;
    const mathPill = e.target.closest(".katex-inline-node");
    if (mathPill) {
      e.stopPropagation();
      e.preventDefault();
      onMathClick?.(mathPill, cellRef.current, rowIdx, colIdx, isHeader);
    }
  };

  const handleKeyDownInternal = (e) => {
    if (isLocked) {
      if (e.key === "Enter" || e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        return;
      }
    }
    handleInlineBoundaryKeyDown(e);
    if (e.key === "Enter" || e.key === "Tab") {
      if (cellRef.current) {
        const text = getBlockTextFromDOM(cellRef.current);
        if (text.includes("$") || text.includes("`")) {
          setBlockDOMFromText(cellRef.current, text);
        }
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="flex items-center justify-between gap-1 w-full">
      <div
        id={id}
        ref={cellRef}
        contentEditable={!isLocked}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDownInternal}
        onClick={handleClick}
        data-placeholder={placeholder}
        className={`w-full outline-none transition-colors rounded px-1.5 py-1 min-h-[1.5em] empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)] ${
          isHeader
            ? "font-semibold text-duck-300 focus:text-duck-200 focus:bg-ink-800/80"
            : "text-ink-100 focus:text-duck-200 focus:bg-ink-900/80"
        } ${isLocked ? "cursor-default select-text" : ""}`}
      />
      {!isLocked && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title={isHeader ? "Delete column" : "Delete row"}
          className={`opacity-0 ${
            isHeader ? "group-hover/th:opacity-100" : "group-hover/tr:opacity-100"
          } rounded px-1 text-[10px] text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-opacity cursor-pointer shrink-0 print:hidden`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function removeFormulaAtIndex(text, targetIndex) {
  if (!text) return "";
  let currentIndex = 0;
  return text.replace(/\$([^$\n]+)\$/g, (match) => {
    if (currentIndex === targetIndex) {
      currentIndex++;
      return "";
    }
    currentIndex++;
    return match;
  }).replace(/\s+/g, " ").trim();
}

function removeFormulaFromCellText(text, formulaToRemove, formulaIndex = -1) {
  if (!text) return "";
  if (formulaIndex >= 0) {
    const byIndex = removeFormulaAtIndex(text, formulaIndex);
    if (byIndex !== text) return byIndex;
  }
  if (!formulaToRemove) return text;
  const escaped = formulaToRemove.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\$${escaped}\\$`, "g");
  return text.replace(regex, "").replace(/\s+/g, " ").trim();
}

function updateFormulaAtIndex(text, targetIndex, newFormula) {
  if (!text) return "";
  let currentIndex = 0;
  return text.replace(/\$([^$\n]+)\$/g, (match) => {
    if (currentIndex === targetIndex) {
      currentIndex++;
      return `$${newFormula}$`;
    }
    currentIndex++;
    return match;
  });
}

function updateFormulaInCellText(text, oldFormula, newFormula, formulaIndex = -1) {
  if (!text) return `$${newFormula}$`;
  if (formulaIndex >= 0) {
    const byIndex = updateFormulaAtIndex(text, formulaIndex, newFormula);
    if (byIndex !== text) return byIndex;
  }
  if (oldFormula) {
    const escaped = oldFormula.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\$${escaped}\\$`);
    if (regex.test(text)) {
      return text.replace(regex, `$${newFormula}$`);
    }
  }
  const regex = /\$([^$\n]+)\$/;
  if (regex.test(text)) {
    return text.replace(regex, `$${newFormula}$`);
  }
  return `${text} $${newFormula}$`.trim();
}

// ─── Table Block Component (Interactive Matrix / Grid Table) ─────────
function TableBlock({ block, onUpdateBlock, onSelect, onDelete, onAddAfter, onExitDown, onExitUp, isLocked = false }) {
  const normData = useMemo(() => {
    return getNormalizedTableData(block.tableData, block.content);
  }, [block.tableData, block.content]);

  const [tableData, setTableData] = useState(normData);

  // Math Popover State for Table Cells
  const [mathPopoverOpen, setMathPopoverOpen] = useState(false);
  const [selectedMathNode, setSelectedMathNode] = useState(null);
  const [popoverFormula, setPopoverFormula] = useState("");
  const [activeCellLocation, setActiveCellLocation] = useState(null); // { rowIdx, colIdx, isHeader }
  const [activeCellEl, setActiveCellEl] = useState(null);
  const [activeFormulaIndex, setActiveFormulaIndex] = useState(-1);

  useEffect(() => {
    setTableData(normData);
  }, [normData]);

  const updateAndSave = (newData, recordHistory = false) => {
    if (isLocked) return;
    setTableData(newData);
    onUpdateBlock(block.id, { tableData: newData, content: "" }, true, recordHistory);
  };

  const handleCellChange = (rowIndex, colIndex, value, isHeader = false, recordHistory = false) => {
    if (isLocked) return;
    if (isHeader) {
      const newHeaders = [...tableData.headers];
      while (newHeaders.length <= colIndex) newHeaders.push("");
      newHeaders[colIndex] = value;
      updateAndSave({ ...tableData, headers: newHeaders }, recordHistory);
    } else {
      const newRows = tableData.rows.map((r, rIdx) => {
        if (rIdx !== rowIndex) return r;
        const newRow = Array.isArray(r) ? [...r] : [];
        while (newRow.length <= colIndex) newRow.push("");
        newRow[colIndex] = value;
        return newRow;
      });
      updateAndSave({ ...tableData, rows: newRows }, recordHistory);
    }
  };

  const handleMathClick = (mathPill, cellEl, rowIdx, colIdx, isHeader) => {
    if (isLocked) return;
    let pillIdx = -1;
    if (mathPill && cellEl) {
      const allPills = Array.from(cellEl.querySelectorAll(".katex-inline-node"));
      pillIdx = allPills.indexOf(mathPill);
    }
    setActiveFormulaIndex(pillIdx);

    if (mathPill) {
      const formula = mathPill.getAttribute("data-formula") || "";
      setSelectedMathNode(mathPill);
      setPopoverFormula(formula);
    } else {
      setSelectedMathNode(null);
      setPopoverFormula("x^2");
    }
    setActiveCellLocation({ rowIdx, colIdx, isHeader });
    setActiveCellEl(cellEl);
    setMathPopoverOpen(true);
  };

  const handleMathSave = (newFormula) => {
    if (isLocked) return;
    if (activeCellLocation) {
      const { rowIdx, colIdx, isHeader } = activeCellLocation;
      const currentCellText =
        (isHeader
          ? tableData.headers[colIdx]
          : tableData.rows[rowIdx]?.[colIdx]) || "";

      let newCellText = "";
      if (!newFormula || !newFormula.trim()) {
        const formulaToDelete = popoverFormula || (selectedMathNode?.getAttribute("data-formula") || "");
        newCellText = removeFormulaFromCellText(currentCellText, formulaToDelete, activeFormulaIndex);
      } else if (popoverFormula) {
        newCellText = updateFormulaInCellText(currentCellText, popoverFormula, newFormula.trim(), activeFormulaIndex);
      } else {
        newCellText = currentCellText ? `${currentCellText} $${newFormula.trim()}$` : `$${newFormula.trim()}$`;
      }

      const cellId = isHeader
        ? `tbl_${block.id}_h_${colIdx}`
        : `tbl_${block.id}_r_${rowIdx}_c_${colIdx}`;
      const targetEl = document.getElementById(cellId) || activeCellEl;
      if (targetEl) {
        setBlockDOMFromText(targetEl, newCellText);
      }
      handleCellChange(rowIdx, colIdx, newCellText, isHeader, true);
    }
    setMathPopoverOpen(false);
    setSelectedMathNode(null);
    setActiveFormulaIndex(-1);
    setActiveCellLocation(null);
    setActiveCellEl(null);
  };

  const handleMathDelete = () => {
    if (isLocked) return;
    handleMathSave("");
  };

  const addColumn = () => {
    if (isLocked) return;
    const colNumber = tableData.headers.length + 1;
    const newHeaders = [...tableData.headers, `Column ${colNumber}`];
    const newRows = tableData.rows.map((r) => (Array.isArray(r) ? [...r, ""] : [""]));
    updateAndSave({ ...tableData, headers: newHeaders, rows: newRows }, true);
  };

  const removeColumn = (colIndex) => {
    if (isLocked) return;
    if (tableData.headers.length <= 1) return;
    const newHeaders = tableData.headers.filter((_, idx) => idx !== colIndex);
    const newRows = tableData.rows.map((r) => (Array.isArray(r) ? r.filter((_, idx) => idx !== colIndex) : []));
    updateAndSave({ ...tableData, headers: newHeaders, rows: newRows }, true);
  };

  const addRow = (insertIndex = null) => {
    if (isLocked) return;
    const emptyRow = Array(Math.max(1, tableData.headers.length)).fill("");
    let newRows;
    if (insertIndex !== null && insertIndex >= 0) {
      newRows = [...tableData.rows];
      newRows.splice(insertIndex + 1, 0, emptyRow);
    } else {
      newRows = [...tableData.rows, emptyRow];
    }
    updateAndSave({ ...tableData, rows: newRows }, true);
  };

  const removeRow = (rowIndex) => {
    if (isLocked) return;
    if (tableData.rows.length <= 1) return;
    const newRows = tableData.rows.filter((_, idx) => idx !== rowIndex);
    updateAndSave({ ...tableData, rows: newRows }, true);
  };

  const handleCellKeyDown = (e, rowIndex, colIndex, isHeader = false) => {
    if (isLocked) return;
    const colCount = tableData.headers.length || 1;
    const rowCount = tableData.rows.length || 0;
    const hasHeaders = tableData.hasHeaderRow !== false && tableData.headers.length > 0;

    if (e.key === "Tab") {
      e.preventDefault();
      if (!e.shiftKey) {
        if (isHeader) {
          if (colIndex < colCount - 1) {
            const nextEl = document.getElementById(`tbl_${block.id}_h_${colIndex + 1}`);
            nextEl?.focus();
          } else {
            const nextEl = document.getElementById(`tbl_${block.id}_r_0_c_0`);
            nextEl?.focus();
          }
        } else {
          if (colIndex < colCount - 1) {
            const nextEl = document.getElementById(`tbl_${block.id}_r_${rowIndex}_c_${colIndex + 1}`);
            nextEl?.focus();
          } else if (rowIndex < rowCount - 1) {
            const nextEl = document.getElementById(`tbl_${block.id}_r_${rowIndex + 1}_c_0`);
            nextEl?.focus();
          } else {
            addRow();
            setTimeout(() => {
              const newEl = document.getElementById(`tbl_${block.id}_r_${rowIndex + 1}_c_0`);
              newEl?.focus();
            }, 30);
          }
        }
      } else {
        if (isHeader) {
          if (colIndex > 0) {
            const prevEl = document.getElementById(`tbl_${block.id}_h_${colIndex - 1}`);
            prevEl?.focus();
          }
        } else {
          if (colIndex > 0) {
            const prevEl = document.getElementById(`tbl_${block.id}_r_${rowIndex}_c_${colIndex - 1}`);
            prevEl?.focus();
          } else if (rowIndex > 0) {
            const prevEl = document.getElementById(`tbl_${block.id}_r_${rowIndex - 1}_c_${colCount - 1}`);
            prevEl?.focus();
          } else {
            const prevEl = document.getElementById(`tbl_${block.id}_h_${colCount - 1}`);
            prevEl?.focus();
          }
        }
      }
    } else if (e.key === "ArrowDown") {
      if (isHeader) {
        if (rowCount > 0) {
          e.preventDefault();
          const targetEl = document.getElementById(`tbl_${block.id}_r_0_c_${colIndex}`);
          targetEl?.focus();
        } else {
          e.preventDefault();
          onExitDown?.(block.id);
        }
      } else {
        if (rowIndex < rowCount - 1) {
          e.preventDefault();
          const targetEl = document.getElementById(`tbl_${block.id}_r_${rowIndex + 1}_c_${colIndex}`);
          targetEl?.focus();
        } else {
          e.preventDefault();
          onExitDown?.(block.id);
        }
      }
    } else if (e.key === "ArrowUp") {
      if (isHeader) {
        e.preventDefault();
        onExitUp?.(block.id);
      } else {
        if (rowIndex > 0) {
          e.preventDefault();
          const targetEl = document.getElementById(`tbl_${block.id}_r_${rowIndex - 1}_c_${colIndex}`);
          targetEl?.focus();
        } else {
          // Row 0: navigate into header if present, otherwise exit up (BUG-TBL-09)
          e.preventDefault();
          if (hasHeaders) {
            const targetEl = document.getElementById(`tbl_${block.id}_h_${colIndex}`);
            targetEl?.focus();
          } else {
            onExitUp?.(block.id);
          }
        }
      }
    } else if (e.key === "ArrowLeft") {
      const activeEl = document.activeElement;
      const sel = window.getSelection();
      const isAtStart = isCaretAtBlockStart(activeEl, sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);
      if (isAtStart) {
        e.preventDefault();
        if (colIndex > 0) {
          const targetId = isHeader
            ? `tbl_${block.id}_h_${colIndex - 1}`
            : `tbl_${block.id}_r_${rowIndex}_c_${colIndex - 1}`;
          const targetEl = document.getElementById(targetId);
          if (targetEl) setCaretToEnd(targetEl);
        } else {
          // colIndex === 0
          if (isHeader) {
            onExitUp?.(block.id);
          } else if (rowIndex > 0) {
            const targetEl = document.getElementById(`tbl_${block.id}_r_${rowIndex - 1}_c_${colCount - 1}`);
            if (targetEl) setCaretToEnd(targetEl);
          } else {
            if (hasHeaders) {
              const targetEl = document.getElementById(`tbl_${block.id}_h_${colCount - 1}`);
              if (targetEl) setCaretToEnd(targetEl);
            } else {
              onExitUp?.(block.id);
            }
          }
        }
      }
    } else if (e.key === "ArrowRight") {
      const activeEl = document.activeElement;
      const sel = window.getSelection();
      const isAtEnd = isCaretAtBlockEnd(activeEl, sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);
      if (isAtEnd) {
        e.preventDefault();
        if (colIndex < colCount - 1) {
          const targetId = isHeader
            ? `tbl_${block.id}_h_${colIndex + 1}`
            : `tbl_${block.id}_r_${rowIndex}_c_${colIndex + 1}`;
          const targetEl = document.getElementById(targetId);
          if (targetEl) setCaretToStart(targetEl);
        } else {
          // colIndex === colCount - 1
          if (isHeader) {
            const targetEl = document.getElementById(`tbl_${block.id}_r_0_c_0`);
            if (targetEl) setCaretToStart(targetEl);
            else onExitDown?.(block.id);
          } else if (rowIndex < rowCount - 1) {
            const targetEl = document.getElementById(`tbl_${block.id}_r_${rowIndex + 1}_c_0`);
            if (targetEl) setCaretToStart(targetEl);
          } else {
            onExitDown?.(block.id);
          }
        }
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isHeader) {
        if (rowCount > 0) {
          const nextEl = document.getElementById(`tbl_${block.id}_r_0_c_${colIndex}`);
          nextEl?.focus();
        } else if (colIndex === colCount - 1) {
          const exited = onExitDown?.(block.id);
          if (!exited) {
            onAddAfter?.(block.id, "", "text");
          }
        } else {
          const nextEl = document.getElementById(`tbl_${block.id}_h_${colIndex + 1}`);
          nextEl?.focus();
        }
      } else if (rowIndex < rowCount - 1) {
        const nextEl = document.getElementById(`tbl_${block.id}_r_${rowIndex + 1}_c_${colIndex}`);
        nextEl?.focus();
      } else {
        // Last row (rowIndex === rowCount - 1):
        if (colIndex === colCount - 1) {
          // Last row, last col: go to next block (place caret there)
          const exited = onExitDown?.(block.id);
          if (!exited) {
            onAddAfter?.(block.id, "", "text");
          }
        } else {
          // Move to next column on last row without adding any new rows or columns
          const nextEl = document.getElementById(`tbl_${block.id}_r_${rowIndex}_c_${colIndex + 1}`);
          nextEl?.focus();
        }
      }
    }
  };

  return (
    <div
      tabIndex={0}
      onClick={() => onSelect(block.id)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && !e.target.isContentEditable && e.target.tagName !== "INPUT") {
          e.preventDefault();
          onExitDown?.(block.id);
        } else if (e.key === "ArrowUp" && !e.target.isContentEditable && e.target.tagName !== "INPUT") {
          e.preventDefault();
          onExitUp?.(block.id);
        } else if (e.key === "ArrowLeft" && !e.target.isContentEditable && e.target.tagName !== "INPUT") {
          e.preventDefault();
          onExitUp?.(block.id);
        } else if (e.key === "ArrowRight" && !e.target.isContentEditable && e.target.tagName !== "INPUT") {
          e.preventDefault();
          onExitDown?.(block.id);
        } else if (e.key === "Enter" && e.target.tagName !== "INPUT" && !e.target.isContentEditable) {
          e.preventDefault();
          onAddAfter?.(block.id, "", "text");
        } else if (
          e.key === "Delete" &&
          e.target.tagName !== "INPUT" &&
          !e.target.isContentEditable
        ) {
          if (!isLocked) {
            e.preventDefault();
            onDelete?.(block.id);
          }
        }
      }}
      className="group/tableblk relative my-3 overflow-visible rounded-xl border border-ink-800 bg-ink-900/90 shadow-lg transition-all hover:border-duck-500/40 outline-none focus:ring-1 focus:ring-duck-400/40"
    >
      {/* Inline LaTeX Equation Popover positioned ABOVE the Table */}
      {!isLocked && mathPopoverOpen && (
        <InlineEquationPopover
          isOpen={mathPopoverOpen}
          placement="top"
          initialFormula={popoverFormula}
          onSave={handleMathSave}
          onDelete={handleMathDelete}
          onClose={() => {
            const el = activeCellEl;
            setMathPopoverOpen(false);
            setSelectedMathNode(null);
            setActiveCellLocation(null);
            setActiveCellEl(null);
            requestAnimationFrame(() => {
              el?.focus();
            });
          }}
        />
      )}

      {/* Table Top Toolbar */}
      <div className="flex items-center justify-between border-b border-ink-800 bg-ink-950/80 px-3.5 py-2 select-none rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-duck-500/20 text-xs font-bold text-duck-400 shrink-0">
            ▦
          </span>
          <span className="text-xs font-semibold text-ink-300">Table</span>
          <span className="text-[10px] font-mono font-medium text-ink-400 bg-ink-900 border border-ink-800 px-2 py-0.5 rounded">
            {tableData.rows.length} × {tableData.headers.length}
          </span>
        </div>

        {!isLocked && (
          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              type="button"
              onClick={addColumn}
              title="Add Column to the right"
              className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-[11px] font-semibold text-duck-300 transition-colors hover:border-duck-500/40 hover:bg-ink-800 cursor-pointer"
            >
              <span>+</span> Column
            </button>
            <button
              type="button"
              onClick={() => addRow()}
              title="Add Row to bottom"
              className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-[11px] font-semibold text-duck-300 transition-colors hover:border-duck-500/40 hover:bg-ink-800 cursor-pointer"
            >
              <span>+</span> Row
            </button>
          </div>
        )}
      </div>

      {/* Interactive Table Grid Container */}
      <div className="overflow-x-auto p-3">
        <table className="w-full border-collapse rounded-lg overflow-hidden border border-ink-800 bg-ink-950/60 text-xs">
          {tableData.hasHeaderRow !== false && (
            <thead>
              <tr className="border-b border-ink-700 bg-ink-900">
                {tableData.headers.map((head, colIdx) => (
                  <th
                    key={`h-${colIdx}`}
                    className="group/th relative border-r border-ink-800 px-3 py-2 text-left font-semibold text-duck-300 last:border-r-0"
                  >
                    <TableCell
                      id={`tbl_${block.id}_h_${colIdx}`}
                      value={head}
                      isHeader={true}
                      placeholder={`Header ${colIdx + 1}`}
                      onChange={(val) => handleCellChange(0, colIdx, val, true)}
                      onKeyDown={(e) => handleCellKeyDown(e, 0, colIdx, true)}
                      onDelete={tableData.headers.length > 1 ? () => removeColumn(colIdx) : null}
                      onMathClick={handleMathClick}
                      rowIdx={0}
                      colIdx={colIdx}
                      isLocked={isLocked}
                    />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {tableData.rows.map((row, rowIdx) => (
              <tr
                key={`r-${rowIdx}`}
                className="group/tr border-b border-ink-800/70 transition-colors hover:bg-ink-900/40 last:border-b-0"
              >
                {tableData.headers.map((_, colIdx) => (
                  <td
                    key={`c-${colIdx}`}
                    className="group/td relative border-r border-ink-800/70 px-3 py-1.5 text-ink-100 last:border-r-0"
                  >
                    <TableCell
                      id={`tbl_${block.id}_r_${rowIdx}_c_${colIdx}`}
                      value={row[colIdx] || ""}
                      isHeader={false}
                      placeholder="..."
                      onChange={(val) => handleCellChange(rowIdx, colIdx, val, false)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx, false)}
                      onDelete={colIdx === tableData.headers.length - 1 && tableData.rows.length > 1 ? () => removeRow(rowIdx) : null}
                      onMathClick={handleMathClick}
                      rowIdx={rowIdx}
                      colIdx={colIdx}
                      isLocked={isLocked}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Site Bookmark Component ─────────────────────────────────────────

function SiteBlock({ block, onUpdateBlock, onSelect, onDelete, onAddAfter, onExitDown, onExitUp }) {
  const [urlInput, setUrlInput] = useState(block.url || "");

  const handleEmbed = (e) => {
    e?.preventDefault?.();
    if (urlInput.trim()) {
      onUpdateBlock(block.id, { url: urlInput.trim() }, true);
    }
  };

  const formattedUrl = formatUrl(block.url);
  let domain = "";
  try {
    const u = new URL(formattedUrl);
    domain = u.hostname.replace(/^www\./, "");
  } catch {
    domain = block.url || "";
  }

  return (
    <div
      tabIndex={0}
      onClick={() => onSelect(block.id)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onExitDown?.(block.id);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onExitUp?.(block.id);
          return;
        }
        if (e.key === "Enter" && e.target.tagName !== "INPUT") {
          e.preventDefault();
          onAddAfter?.(block.id, "", "text");
          return;
        }
        if (e.key === "Delete") {
          if (e.target.tagName !== "INPUT" || !urlInput) {
            e.preventDefault();
            onDelete?.(block.id);
          }
        }
        if (e.key === "Backspace" && (e.target.tagName !== "INPUT" || !urlInput)) {
          e.preventDefault();
          onExitUp?.(block.id);
        }
      }}
      id={`site_${block.id}`}
      className="group/siteblk relative my-2.5 overflow-hidden rounded-xl border border-ink-700 bg-ink-900/90 p-3.5 shadow-md transition-all hover:border-duck-500/50 outline-none focus:ring-1 focus:ring-duck-400/40"
    >
      {!block.url ? (
        <form onSubmit={handleEmbed} className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-duck-500/15 text-sm shrink-0">
            🌐
          </span>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste website URL (e.g. https://wikipedia.org) and press Enter…"
            className="flex-1 rounded-lg border border-ink-750 bg-ink-950 px-3 py-1.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!urlInput.trim()}
            className="rounded-lg bg-duck-500/20 border border-duck-400/40 px-3 py-1.5 text-xs font-semibold text-duck-200 transition-colors hover:bg-duck-500/30 disabled:opacity-40 cursor-pointer"
          >
            Embed
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-950/70 p-3 transition-all hover:border-duck-500/40">
          <a
            href={formattedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 min-w-0 flex-1 group/link"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-850 border border-ink-750 overflow-hidden">
              <img
                src={`https://www.google.com/s2/favicons?domain=${formattedUrl}&sz=64`}
                alt="favicon"
                className="h-5 w-5 rounded object-contain"
                onError={(e) => {
                  e.target.style.display = "none";
                  if (e.target.nextSibling) e.target.nextSibling.style.display = "block";
                }}
              />
              <span className="hidden text-xs">🌐</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-100 truncate group-hover/link:text-duck-300">
                {block.title || domain}
              </p>
              <p className="text-[11px] text-ink-500 truncate">{formattedUrl}</p>
            </div>
          </a>

          <div className="flex items-center gap-1.5 shrink-0 print:hidden">
            <button
              type="button"
              onClick={() => {
                setUrlInput(block.url || "");
                onUpdateBlock(block.id, { url: "" });
              }}
              className="rounded-md border border-ink-750 bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-ink-300 hover:border-ink-600 hover:bg-ink-800 hover:text-ink-100 transition-colors cursor-pointer"
              title="Edit Bookmark URL"
            >
              ✏️ Edit
            </button>
            <a
              href={formattedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-750 bg-ink-850 text-xs font-bold text-ink-400 hover:border-duck-500/40 hover:bg-duck-500/10 hover:text-duck-300 transition-colors"
              title="Open link in new tab"
            >
              ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Media Block Component (URL Embed & Local File Upload & YouTube) ──
function MediaBlock({ block, onUpdateBlock, onSelect, onDelete, onAddAfter, onExitDown, onExitUp, isLocked = false }) {
  const [activeTab, setActiveTab] = useState("url"); // "url" | "upload"
  const [urlInput, setUrlInput] = useState(block.url || "");
  const [mediaError, setMediaError] = useState(false);
  const fileInputRef = useRef(null);

  const ytInfo = useMemo(() => getYouTubeEmbedInfo(block.url), [block.url]);
  const isYouTube = block.mediaKind === "youtube" || !!ytInfo;
  const mediaKind = isYouTube ? "youtube" : (block.mediaKind || "image");

  const handleEmbedUrl = (e) => {
    e?.preventDefault?.();
    const rawUrl = urlInput.trim();
    if (rawUrl) {
      setMediaError(false);
      const detectedYt = getYouTubeEmbedInfo(rawUrl);
      const chosenKind = detectedYt ? "youtube" : mediaKind === "youtube" ? "video" : mediaKind;
      onUpdateBlock(block.id, { url: rawUrl, mediaKind: chosenKind }, true);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result;
      if (dataUrl) {
        setMediaError(false);
        onUpdateBlock(
          block.id,
          {
            url: dataUrl,
            mediaKind: "image",
            fileName: file.name,
            content: block.content || file.name,
          },
          true
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const formattedUrl = block.url ? (block.url.startsWith("data:") ? block.url : formatUrl(block.url)) : "";

  return (
    <div
      tabIndex={0}
      onClick={() => onSelect(block.id)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onExitDown?.(block.id);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onExitUp?.(block.id);
          return;
        }
        if (e.key === "Enter" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
          onAddAfter?.(block.id, "", "text");
          return;
        }
        if (e.key === "Delete") {
          if (e.target.tagName !== "INPUT" || !urlInput) {
            e.preventDefault();
            onDelete?.(block.id);
          }
        }
        if (e.key === "Backspace" && (e.target.tagName !== "INPUT" || !urlInput)) {
          e.preventDefault();
          onExitUp?.(block.id);
        }
      }}
      id={`media_${block.id}`}
      className="group/mediablk relative my-2.5 overflow-hidden rounded-xl border border-ink-700 bg-ink-900/90 p-4 shadow-lg transition-all hover:border-duck-500/50 outline-none focus:ring-1 focus:ring-duck-400/40"
    >
      {!block.url ? (
        <div className="space-y-3">
          {/* Header & Tabs */}
          <div className="flex items-center justify-between border-b border-ink-800 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("url")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "url"
                    ? "bg-duck-500/20 text-duck-200 border border-duck-400/40"
                    : "text-ink-400 hover:text-ink-200 hover:bg-ink-800"
                }`}
              >
                🔗 Embed Link
              </button>
              {mediaKind !== "youtube" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === "upload"
                      ? "bg-duck-500/20 text-duck-200 border border-duck-400/40"
                      : "text-ink-400 hover:text-ink-200 hover:bg-ink-800"
                  }`}
                >
                  📁 Upload File
                </button>
              )}
            </div>

            {/* Media Kind Selector */}
            <div className="flex items-center gap-1">
              {[
                { id: "image", label: "🖼️ Image" },
                { id: "youtube", label: "▶️ YouTube" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (m.id === "youtube") {
                      setActiveTab("url");
                    }
                    onUpdateBlock(block.id, { mediaKind: m.id });
                  }}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    mediaKind === m.id
                      ? "bg-duck-500/25 text-duck-300 border border-duck-500/50"
                      : "bg-ink-850 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab 1: Embed by URL */}
          {activeTab === "url" && (
            <form onSubmit={handleEmbedUrl} className="flex items-center gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={
                  mediaKind === "youtube"
                    ? "Paste YouTube URL (e.g. https://www.youtube.com/watch?v=... or youtu.be)..."
                    : `Paste image URL (e.g. https://example.com/diagram.png)...`
                }
                className="flex-1 rounded-lg border border-ink-750 bg-ink-950 px-3 py-1.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!urlInput.trim()}
                className="rounded-lg bg-duck-500/20 border border-duck-400/40 px-3 py-1.5 text-xs font-semibold text-duck-200 transition-colors hover:bg-duck-500/30 disabled:opacity-40 cursor-pointer"
              >
                Embed
              </button>
            </form>
          )}

          {/* Tab 2: Upload Image */}
          {activeTab === "upload" && mediaKind !== "youtube" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 bg-ink-950/60 p-6 transition-all hover:border-duck-500/60 hover:bg-duck-500/5 cursor-pointer group"
              >
                <span className="text-3xl mb-1.5 group-hover:scale-110 transition-transform">
                  🖼️
                </span>
                <span className="text-xs font-semibold text-ink-200 group-hover:text-duck-200">
                  Click to select image from your computer
                </span>
                <span className="text-[10px] text-ink-500 mt-0.5">
                  Supports PNG, JPG, JPEG, GIF, WebP, SVG
                </span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Rendered Media Viewport */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-ink-800/80 pb-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-duck-400 uppercase tracking-wider">
              <span>{isYouTube ? "▶️ YouTube Video" : mediaKind === "audio" ? "🎵 Audio" : mediaKind === "video" ? "🎬 Video" : "🖼️ Image"}</span>
            </span>

            <div className="flex items-center gap-2 print:hidden">
              {/* Width Resize Presets for Images, Videos, and YouTube */}
              {mediaKind !== "audio" && (
                <div className="flex items-center gap-1 bg-ink-950/80 px-1 py-0.5 rounded-lg border border-ink-750">
                  {["25%", "50%", "100%"].map((sz) => {
                    const currentSize = block.size || block.width || "100%";
                    const isActive = currentSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateBlock(block.id, { size: sz, width: sz });
                        }}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-duck-500/30 text-duck-200 border border-duck-400/50 shadow-sm"
                            : "text-ink-400 hover:text-ink-200 hover:bg-ink-800"
                        }`}
                        title={`Resize to ${sz} width`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setUrlInput(block.url.startsWith("data:") ? "" : block.url);
                  setMediaError(false);
                  onUpdateBlock(block.id, { url: "" });
                }}
                className="rounded-md border border-ink-750 bg-ink-850 px-2.5 py-1 text-xs text-ink-300 hover:border-ink-600 hover:bg-ink-800 hover:text-ink-100 transition-colors cursor-pointer"
              >
                ✏️ Replace Media
              </button>
            </div>
          </div>

          {/* Media Player / Image / YouTube Container */}
          <div
            className={`transition-all duration-300 ${
              mediaKind === "audio"
                ? "w-full"
                : (block.size || block.width) === "25%"
                ? "w-full max-w-[25%] min-w-[220px] mx-auto"
                : (block.size || block.width) === "50%"
                ? "w-full max-w-[50%] min-w-[320px] mx-auto"
                : "w-full"
            }`}
          >
            {mediaError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-xs text-rose-300">
                ⚠️ Unable to load media from this URL. Please check the link or choose another file.
              </div>
            ) : isYouTube && ytInfo ? (
              <div className="relative w-full overflow-hidden rounded-xl border border-ink-800 bg-black aspect-video shadow-lg">
                <iframe
                  src={ytInfo.embedUrl}
                  title={block.content || "YouTube video player"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            ) : isYouTube && !ytInfo ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-xs text-amber-300">
                ⚠️ Invalid YouTube URL. Please enter a valid YouTube video link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...).
              </div>
            ) : mediaKind === "audio" ? (
              <audio src={formattedUrl} controls onError={() => setMediaError(true)} className="w-full" />
            ) : mediaKind === "video" ? (
              <video
                src={formattedUrl}
                controls
                onError={() => setMediaError(true)}
                className="w-full max-h-[28rem] rounded-xl border border-ink-800 bg-ink-950 object-contain shadow"
              />
            ) : (
              <img
                src={formattedUrl}
                alt={block.content || "Media"}
                onError={() => setMediaError(true)}
                className="w-full max-h-[28rem] rounded-xl object-contain bg-ink-950/80 border border-ink-800 shadow"
              />
            )}
          </div>

          {/* Editable Caption */}
          <input
            type="text"
            value={block.content || ""}
            onChange={(e) => onUpdateBlock(block.id, { content: e.target.value })}
            placeholder="Add an optional caption (e.g. Lecture 4: Key concepts)..."
            className="w-full bg-transparent text-center text-xs text-ink-400 placeholder:text-ink-600 outline-none border-b border-transparent focus:border-duck-500/30 py-0.5"
          />
        </div>
      )}
    </div>
  );
}



// ─── Multi-Column Layout Block (2 to 5 Columns Split) ──────────────────────────
function ColumnItem({ blockId, col, idx, totalCols = 2, isLocked, onTitleChange, onContentChange, onMathClick, onAddAfter, onExitDown, onExitUp, onDelete, allCols, setSelectedBlockIds, selectedBlockIds }) {
  const titleRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (titleRef.current && document.activeElement !== titleRef.current) {
      const domText = getBlockTextFromDOM(titleRef.current);
      if (domText !== (col.title || "")) {
        setBlockDOMFromText(titleRef.current, col.title || "");
      }
    }
  }, [col.title]);

  useEffect(() => {
    if (contentRef.current && document.activeElement !== contentRef.current) {
      const domText = getBlockTextFromDOM(contentRef.current);
      if (domText !== (col.content || "")) {
        setBlockDOMFromText(contentRef.current, col.content || "");
      }
    }
  }, [col.content]);

  const handleTitleInput = () => {
    if (isLocked || !titleRef.current) return;
    tryAutoFormatInlineCode(titleRef.current);
    tryAutoFormatInlineMath(titleRef.current);
    const text = getBlockTextFromDOM(titleRef.current);
    onTitleChange(text);
  };

  const handleTitleBlur = () => {
    if (titleRef.current) {
      setBlockDOMFromText(titleRef.current, col.title || "");
    }
  };

  const handleContentInput = () => {
    if (isLocked || !contentRef.current) return;
    tryAutoFormatInlineCode(contentRef.current);
    tryAutoFormatInlineMath(contentRef.current);
    const text = getBlockTextFromDOM(contentRef.current);
    onContentChange(text);
  };

  const handleContentBlur = () => {
    if (contentRef.current) {
      setBlockDOMFromText(contentRef.current, col.content || "");
    }
  };

  const handleClick = (e) => {
    if (isLocked) return;
    const mathPill = e.target.closest(".katex-inline-node");
    if (mathPill) {
      e.stopPropagation();
      e.preventDefault();
      const isTitle = titleRef.current && titleRef.current.contains(mathPill);
      onMathClick?.(
        mathPill,
        idx,
        isTitle ? "title" : "content",
        isTitle ? titleRef.current : contentRef.current
      );
    }
  };

  const handleKeyDown = (e) => {
    if (isLocked) {
      if (e.key === "Enter" || e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
      }
      return;
    }

    const activeEl = document.activeElement;
    const isTitle = activeEl === titleRef.current;
    const isContent = activeEl === contentRef.current;

    // 1. Enter key: title advances to content instead of inserting newline (BUG-COL-11)
    if (e.key === "Enter" && !e.shiftKey) {
      if (isTitle) {
        e.preventDefault();
        if (contentRef.current) {
          setCaretToStart(contentRef.current);
        }
        return;
      }
    }

    // 2. Tab & Shift+Tab column hopping (BUG-COL-13)
    if (e.key === "Tab") {
      e.preventDefault();
      if (!e.shiftKey) {
        if (isTitle) {
          if (contentRef.current) setCaretToStart(contentRef.current);
        } else {
          if (idx < totalCols - 1) {
            const nextTitle = document.getElementById(`col_${blockId}_${idx + 1}_title`);
            if (nextTitle) setCaretToStart(nextTitle);
          } else {
            onExitDown?.(blockId);
          }
        }
      } else {
        if (isContent) {
          if (titleRef.current) setCaretToEnd(titleRef.current);
        } else {
          if (idx > 0) {
            const prevContent = document.getElementById(`col_${blockId}_${idx - 1}_content`);
            if (prevContent) setCaretToEnd(prevContent);
          } else {
            onExitUp?.(blockId);
          }
        }
      }
      return;
    }

    // 3. ArrowDown navigation (BUG-COL-11)
    if (e.key === "ArrowDown") {
      if (isTitle) {
        const sel = window.getSelection();
        const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (isCaretOnLastVisualLine(titleRef.current, range)) {
          e.preventDefault();
          if (contentRef.current) setCaretToStart(contentRef.current);
          return;
        }
      } else if (isContent) {
        const sel = window.getSelection();
        const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (isCaretOnLastVisualLine(contentRef.current, range)) {
          e.preventDefault();
          onExitDown?.(blockId);
          return;
        }
      }
    }

    // 4. ArrowUp navigation (BUG-COL-12)
    if (e.key === "ArrowUp") {
      if (isContent) {
        const sel = window.getSelection();
        const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (isCaretOnFirstVisualLine(contentRef.current, range)) {
          e.preventDefault();
          if (titleRef.current) setCaretToEnd(titleRef.current);
          return;
        }
      } else if (isTitle) {
        const sel = window.getSelection();
        const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (isCaretOnFirstVisualLine(titleRef.current, range)) {
          e.preventDefault();
          onExitUp?.(blockId);
          return;
        }
      }
    }

    // 5. Horizontal ArrowLeft across columns (BUG-COL-13)
    if (e.key === "ArrowLeft") {
      const sel = window.getSelection();
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      if (isTitle) {
        if (isCaretAtBlockStart(titleRef.current, range)) {
          e.preventDefault();
          if (idx > 0) {
            const prevTitle = document.getElementById(`col_${blockId}_${idx - 1}_title`);
            if (prevTitle) setCaretToEnd(prevTitle);
          } else {
            onExitUp?.(blockId);
          }
          return;
        }
      } else if (isContent) {
        if (isCaretAtBlockStart(contentRef.current, range)) {
          e.preventDefault();
          if (idx > 0) {
            const prevContent = document.getElementById(`col_${blockId}_${idx - 1}_content`);
            if (prevContent) setCaretToEnd(prevContent);
          } else if (titleRef.current) {
            setCaretToEnd(titleRef.current);
          }
          return;
        }
      }
    }

    // 6. Horizontal ArrowRight across columns (BUG-COL-13)
    if (e.key === "ArrowRight") {
      const sel = window.getSelection();
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      if (isTitle) {
        if (isCaretAtBlockEnd(titleRef.current, range)) {
          e.preventDefault();
          if (idx < totalCols - 1) {
            const nextTitle = document.getElementById(`col_${blockId}_${idx + 1}_title`);
            if (nextTitle) setCaretToStart(nextTitle);
          } else if (contentRef.current) {
            setCaretToStart(contentRef.current);
          }
          return;
        }
      } else if (isContent) {
        if (isCaretAtBlockEnd(contentRef.current, range)) {
          e.preventDefault();
          if (idx < totalCols - 1) {
            const nextContent = document.getElementById(`col_${blockId}_${idx + 1}_content`);
            if (nextContent) setCaretToStart(nextContent);
          } else {
            onExitDown?.(blockId);
          }
          return;
        }
      }
    }

    // 7. Backspace key across columns & empty split block deletion:
    if (e.key === "Backspace") {
      const activeEl = document.activeElement;
      const isTitle = activeEl === titleRef.current;
      const isContent = activeEl === contentRef.current;
      const sel = window.getSelection();
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      const isAtStart = range ? isCaretAtBlockStart(activeEl, range) : false;
      const currentText = cleanZeroWidth(getBlockTextFromDOM(activeEl));
      const isEmpty = currentText.length === 0;

      const isEntireBlockEmpty = allCols && allCols.every(
        (c) => (!c.title || cleanZeroWidth(c.title).length === 0) && (!c.content || cleanZeroWidth(c.content).length === 0)
      );

      if (isEntireBlockEmpty && (isAtStart || isEmpty)) {
        e.preventDefault();
        onDelete?.(blockId);
        return;
      }

      if (isAtStart || isEmpty) {
        if (isContent && isEmpty) {
          e.preventDefault();
          if (titleRef.current) setCaretToEnd(titleRef.current);
          return;
        }
        if (isTitle && isEmpty && idx > 0) {
          e.preventDefault();
          const prevContent = document.getElementById(`col_${blockId}_${idx - 1}_content`);
          if (prevContent) setCaretToEnd(prevContent);
          return;
        }
      }
    }

    // 8. Delete key across columns & empty split block deletion:
    if (e.key === "Delete") {
      const activeEl = document.activeElement;
      const isTitle = activeEl === titleRef.current;
      const isContent = activeEl === contentRef.current;
      const sel = window.getSelection();
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      const isAtEnd = range ? isCaretAtBlockEnd(activeEl, range) : false;
      const currentText = cleanZeroWidth(getBlockTextFromDOM(activeEl));
      const isEmpty = currentText.length === 0;

      const isEntireBlockEmpty = allCols && allCols.every(
        (c) => (!c.title || cleanZeroWidth(c.title).length === 0) && (!c.content || cleanZeroWidth(c.content).length === 0)
      );

      if (isEntireBlockEmpty && (isAtEnd || isEmpty)) {
        e.preventDefault();
        onDelete?.(blockId);
        return;
      }

      if (isAtEnd || isEmpty) {
        if (isTitle) {
          e.preventDefault();
          if (contentRef.current) setCaretToStart(contentRef.current);
          return;
        }
        if (isContent && idx < totalCols - 1) {
          e.preventDefault();
          const nextTitle = document.getElementById(`col_${blockId}_${idx + 1}_title`);
          if (nextTitle) setCaretToStart(nextTitle);
          return;
        }
      }
    }

    // Escape key focuses the parent columns block container in Notion style
    if (e.key === "Escape") {
      e.preventDefault();
      const container = document.getElementById(`columns_${blockId}`);
      if (container) {
        container.focus();
      } else if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      return;
    }

    handleInlineBoundaryKeyDown(e);
  };

  return (
    <div
      onClick={(e) => {
        handleClick(e);
        const isEditable = Boolean(e.target.closest("[contenteditable='true'], input, textarea, select, button"));
        if (!isEditable) {
          const container = document.getElementById(`columns_${blockId}`);
          container?.focus();
        }
      }}
      className="flex flex-col rounded-xl border border-ink-800/80 bg-ink-900/80 p-3.5 shadow-sm transition-all hover:border-duck-500/30 hover:bg-ink-900/95 group/colcard min-w-0"
    >
      {/* Column Title with Inline Math / Code formatting */}
      <div
        id={`col_${blockId}_${idx}_title`}
        ref={titleRef}
        contentEditable={!isLocked}
        suppressContentEditableWarning
        onInput={handleTitleInput}
        onBlur={handleTitleBlur}
        onKeyDown={handleKeyDown}
        data-placeholder={`Column ${idx + 1} Title...`}
        className="w-full bg-transparent text-xs font-semibold text-ink-100 placeholder:text-ink-600 border-b border-ink-800/60 pb-1.5 mb-2 focus:outline-none focus:border-duck-400 empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)] transition-colors min-h-[1.5em]"
      />

      {/* Column Multi-Line Body with Live KaTeX ($x$) & Inline Code (`code`) */}
      <div
        id={`col_${blockId}_${idx}_content`}
        ref={contentRef}
        contentEditable={!isLocked}
        suppressContentEditableWarning
        onInput={handleContentInput}
        onBlur={handleContentBlur}
        onKeyDown={handleKeyDown}
        data-placeholder={`Notes, $formula$, \`code\`, or details for Column ${idx + 1}...`}
        className="w-full flex-1 bg-transparent text-xs leading-relaxed text-ink-200 placeholder:text-ink-600 focus:outline-none min-h-[5.5rem] empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)] whitespace-pre-wrap transition-colors"
      />
    </div>
  );
}

function ColumnsBlock({
  block,
  onUpdateBlock,
  onSelect,
  setSelectedBlockIds,
  selectedBlockIds,
  onDelete,
  isLocked = false,
  onSaveNote,
  onAddAfter,
  onExitDown,
  onExitUp,
}) {
  const currentCount = Math.max(2, Math.min(5, Number(block.columnCount) || 2));
  const columnsData = useMemo(() => {
    return getNormalizedColumnsData(block.columnsData, block.content, currentCount);
  }, [block.columnsData, block.content, currentCount]);

  const [localCols, setLocalCols] = useState(columnsData);

  // Math Popover State for Columns
  const [mathPopoverOpen, setMathPopoverOpen] = useState(false);
  const [selectedMathNode, setSelectedMathNode] = useState(null);
  const [popoverFormula, setPopoverFormula] = useState("");
  const [activeMathColIndex, setActiveMathColIndex] = useState(0);
  const [activeMathField, setActiveMathField] = useState("content");
  const [activeMathEl, setActiveMathEl] = useState(null);
  const [activeFormulaIndex, setActiveFormulaIndex] = useState(-1);

  useEffect(() => {
    setLocalCols(columnsData);
  }, [columnsData]);

  const updateAndPersist = useCallback(
    (newCols, newCount = currentCount, immediate = false, recordHistory = false) => {
      setLocalCols(newCols);
      onUpdateBlock?.(
        block.id,
        {
          columnCount: newCount,
          columnsData: newCols,
          content: newCols.map((c) => `### ${c.title || "Column"}\n${c.content || ""}`).join("\n\n"),
        },
        immediate,
        recordHistory
      );
      if (immediate) {
        onSaveNote?.();
      }
    },
    [block.id, currentCount, onUpdateBlock, onSaveNote]
  );

  const handleTitleChange = (idx, val) => {
    if (isLocked) return;
    const newCols = localCols.map((col, i) => (i === idx ? { ...col, title: val } : col));
    updateAndPersist(newCols, currentCount, false);
  };

  const handleContentChange = (idx, val) => {
    if (isLocked) return;
    const newCols = localCols.map((col, i) => (i === idx ? { ...col, content: val } : col));
    updateAndPersist(newCols, currentCount, false);
  };

  const handleMathClick = (mathPill, colIdx, fieldType, targetEl) => {
    if (isLocked) return;
    const formula = mathPill.getAttribute("data-formula") || "";
    setSelectedMathNode(mathPill);
    setPopoverFormula(formula);
    setActiveMathColIndex(colIdx);
    setActiveMathField(fieldType);
    setActiveMathEl(targetEl);

    // Compute active formula index
    let formulaIdx = 0;
    if (targetEl) {
      const allPills = Array.from(targetEl.querySelectorAll(".katex-inline-node"));
      const foundIdx = allPills.indexOf(mathPill);
      if (foundIdx >= 0) formulaIdx = foundIdx;
    }
    setActiveFormulaIndex(formulaIdx);
    setMathPopoverOpen(true);
  };

  const handleMathSave = (newFormula) => {
    if (isLocked) return;
    const targetCol = localCols[activeMathColIndex];
    if (targetCol) {
      const currentText = (activeMathField === "title" ? targetCol.title : targetCol.content) || "";
      let newText = "";
      if (!newFormula || !newFormula.trim()) {
        const formulaToDelete = popoverFormula || (selectedMathNode?.getAttribute("data-formula") || "");
        newText = removeFormulaFromCellText(currentText, formulaToDelete, activeFormulaIndex);
      } else if (popoverFormula) {
        newText = updateFormulaInCellText(currentText, popoverFormula, newFormula.trim(), activeFormulaIndex);
      } else {
        newText = currentText ? `${currentText} $${newFormula.trim()}$` : `$${newFormula.trim()}$`;
      }

      const targetEl = activeMathEl || document.getElementById(`col_${block.id}_${activeMathColIndex}_${activeMathField}`);
      if (targetEl) {
        setBlockDOMFromText(targetEl, newText);
      }

      const newCols = localCols.map((col, i) =>
        i === activeMathColIndex
          ? { ...col, [activeMathField]: newText }
          : col
      );
      updateAndPersist(newCols, currentCount, true, true);
    }
    setMathPopoverOpen(false);
    setSelectedMathNode(null);
    setActiveFormulaIndex(-1);
    setActiveMathEl(null);
  };

  const handleMathDelete = () => {
    if (isLocked) return;
    handleMathSave("");
  };

  const gridColsClass =
    currentCount === 2
      ? "grid-cols-1 md:grid-cols-2"
      : currentCount === 3
      ? "grid-cols-1 md:grid-cols-3"
      : currentCount === 4
      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-5";

  return (
    <div
      tabIndex={0}
      id={`columns_${block.id}`}
      onClick={(e) => {
        onSelect?.(block.id);
        const isEditable = Boolean(e.target.closest("[contenteditable='true'], input, textarea, select, button"));
        if (!isEditable) {
          e.currentTarget.focus();
        }
      }}
      onKeyDown={(e) => {
        if (
          e.key === "Delete" &&
          (!e.target.isContentEditable && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA")
        ) {
          if (!isLocked) {
            e.preventDefault();
            e.stopPropagation();
            onDelete?.(block.id);
            return;
          }
        } else if (e.key === "ArrowDown" && !e.target.isContentEditable && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
          onExitDown?.(block.id);
        } else if (e.key === "ArrowUp" && !e.target.isContentEditable && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
          onExitUp?.(block.id);
        } else if (e.key === "ArrowLeft" && !e.target.isContentEditable && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
          onExitUp?.(block.id);
        } else if (e.key === "ArrowRight" && !e.target.isContentEditable && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
          onExitDown?.(block.id);
        } else if (e.key === "Enter" && !e.target.isContentEditable && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
          onAddAfter?.(block.id, "", "text");
        }
      }}
      className="relative w-full my-2 select-text outline-none focus:ring-1 focus:ring-duck-400/40 rounded-xl"
    >
      {/* Inline LaTeX Equation Popover positioned directly above the Columns */}
      {!isLocked && mathPopoverOpen && (
        <InlineEquationPopover
          isOpen={mathPopoverOpen}
          placement="top"
          initialFormula={popoverFormula}
          onSave={handleMathSave}
          onDelete={handleMathDelete}
          onClose={() => {
            const el = activeMathEl;
            setMathPopoverOpen(false);
            setSelectedMathNode(null);
            setActiveMathEl(null);
            requestAnimationFrame(() => {
              el?.focus();
            });
          }}
        />
      )}

      <div className={`grid ${gridColsClass} gap-3 sm:gap-4 items-stretch`}>
        {localCols.map((col, idx) => (
          <ColumnItem
            key={col.id || idx}
            blockId={block.id}
            col={col}
            idx={idx}
            totalCols={localCols.length}
            isLocked={isLocked}
            onTitleChange={(val) => handleTitleChange(idx, val)}
            onContentChange={(val) => handleContentChange(idx, val)}
            onMathClick={handleMathClick}
            onAddAfter={onAddAfter}
            onExitDown={onExitDown}
            onExitUp={onExitUp}
            onDelete={onDelete}
            allCols={localCols}
            setSelectedBlockIds={setSelectedBlockIds}
            selectedBlockIds={selectedBlockIds}
          />
        ))}
      </div>
    </div>
  );
}


const EditorBlock = memo(function EditorBlock({
  block,
  index = 0,
  totalBlocks = 1,
  blockNumber,
  isLast,
  isSelected,
  onSelect,
  setSelectedBlockIds,
  selectedBlockIds,
  onChange,
  onChangeType,
  onUpdateBlock,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onKeyDown,
  onAddAfter,
  onExplainBlock,
  onQuizBlock,
  onSwitchTab,
  notesBySpace = {},
  onSelectNote,
  registerRef,
  onSaveNote,
  dragHandlers,
  isDragTarget,
  isMultiSelected = false,
  isLocked = false,
  allBlocks = [],
  onSelectHeading,
  onExitDown,
  onExitUp,
}) {
  const contentRef = useRef(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  // The block only becomes draggable while the ⠿ handle is held. Making the
  // whole row draggable would hijack text selection inside contentEditable.
  const [handleHeld, setHandleHeld] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState(false);

  const [selectedMathNode, setSelectedMathNode] = useState(null);
  const [popoverFormula, setPopoverFormula] = useState("");
  const [mathPopoverOpen, setMathPopoverOpen] = useState(false);

  useEffect(() => {
    if (registerRef && contentRef.current) {
      registerRef(block.id, contentRef);
    }
  }, [block.id, registerRef]);

  useEffect(() => {
    if (contentRef.current) {
      const currentDomText = getBlockTextFromDOM(contentRef.current);
      if (currentDomText !== (block.content || "")) {
        setBlockDOMFromText(contentRef.current, block.content || "", block.type);
      }
    }
  }, [block.id, block.type, block.content]);

  function handleInput() {
    if (isLocked) return;
    tryAutoFormatInlineCode(contentRef.current);
    tryAutoFormatInlineMath(contentRef.current);
    const text = getBlockTextFromDOM(contentRef.current);
    onChange(block.id, text);

    const lastSlashIndex = text.lastIndexOf("/");
    if (lastSlashIndex !== -1) {
      const filterText = text.slice(lastSlashIndex + 1);
      if (!/\s/.test(filterText)) {
        setSlashOpen(true);
        setSlashFilter(filterText);
        return;
      }
    }
    setSlashOpen(false);
    setSlashFilter("");

    const shortcuts = [
      { prefix: "#### ", type: "h4" },
      { prefix: "### ", type: "h3" },
      { prefix: "## ", type: "h2" },
      { prefix: "# ", type: "h1" },
      { prefix: "- ", type: "bullet" },
      { prefix: "* ", type: "bullet" },
      { prefix: "1. ", type: "number" },
      { prefix: "[ ] ", type: "todo", checked: false },
      { prefix: "[] ", type: "todo", checked: false },
      { prefix: "[x] ", type: "todo", checked: true },
      { prefix: "[X] ", type: "todo", checked: true },
      { prefix: "> ", type: "quote" },
      { prefix: "💡 ", type: "callout" },
      { prefix: ">! ", type: "callout" },
      { prefix: "---", type: "divider" },
      { prefix: "***", type: "divider" },
      { prefix: "```", type: "code" },
      { prefix: "$$", type: "math" },
      { prefix: "|| ", type: "table" },
    ];

    for (const sc of shortcuts) {
      if (text.startsWith(sc.prefix)) {
        const remaining = text.slice(sc.prefix.length);
        const targetCaret = remaining.length > 0 ? "end" : "start";
        if (sc.checked !== undefined && onUpdateBlock) {
          onUpdateBlock(block.id, { checked: sc.checked });
        }
        if (block.type === sc.type) {
          onChange(block.id, remaining);
          if (contentRef.current) {
            setBlockDOMFromText(contentRef.current, remaining, block.type);
            if (targetCaret === "end") {
              setCaretToEnd(contentRef.current);
            } else {
              setCaretToStart(contentRef.current);
            }
          }
          return;
        }
        onChangeType(block.id, sc.type, targetCaret);
        onChange(block.id, remaining);
        if (contentRef.current) {
          setBlockDOMFromText(contentRef.current, remaining, sc.type);
          if (targetCaret === "end") {
            setCaretToEnd(contentRef.current);
          } else {
            setCaretToStart(contentRef.current);
          }
        }
        return;
      }
    }
  }

  function handleSlashSelect(type, extra = {}) {
    if (isLocked) return;
    const text = getBlockTextFromDOM(contentRef.current) || block.content || "";
    const lastSlashIndex = text.lastIndexOf("/");

    if (type === "inlinemath") {
      let newText = "";
      if (lastSlashIndex !== -1) {
        const textBefore = text.slice(0, lastSlashIndex);
        const textAfter = text.slice(lastSlashIndex + slashFilter.length + 1);
        newText = textBefore + "$f(x)$" + (textAfter ? " " + textAfter : "");
      } else {
        newText = text + " $f(x)$";
      }

      onChange(block.id, newText);
      onUpdateBlock(block.id, { content: newText }, true);
      if (contentRef.current) {
        setBlockDOMFromText(contentRef.current, newText);
      }
      setSlashOpen(false);
      setSlashFilter("");
      return;
    }

    let initialCount = extra?.columnCount || 2;
    if (type === "columns") {
      const q = slashFilter.toLowerCase();
      if (extra?.columnCount) initialCount = extra.columnCount;
      else if (q.includes("3") || q.includes("three")) initialCount = 3;
      else if (q.includes("4") || q.includes("four")) initialCount = 4;
      else if (q.includes("5") || q.includes("five")) initialCount = 5;
      else if (q.includes("2") || q.includes("two")) initialCount = 2;

      onUpdateBlock?.(block.id, {
        columnCount: initialCount,
        columnsData: getNormalizedColumnsData(null, "", initialCount),
      });
    }

    if (lastSlashIndex <= 0 || text.trim().startsWith("/")) {
      onChange(block.id, "");
      if (contentRef.current) {
        contentRef.current.textContent = "";
      }
      onChangeType(block.id, type, {
        columnCount: initialCount,
        columnsData: getNormalizedColumnsData(null, "", initialCount),
      });
    } else {
      const textBefore = text.slice(0, lastSlashIndex).trimEnd();
      const textAfter = text.slice(lastSlashIndex + slashFilter.length + 1).trimStart();

      onChange(block.id, textBefore);
      if (contentRef.current) {
        setBlockDOMFromText(contentRef.current, textBefore);
      }

      if (onAddAfter) {
        onAddAfter(block.id, "", type, {
          columnCount: initialCount,
          columnsData: getNormalizedColumnsData(null, "", initialCount),
        });
        if (textAfter) {
          setTimeout(() => {
            onAddAfter(block.id, textAfter, "text");
          }, 40);
        }
      }
    }

    setSlashOpen(false);
    setSlashFilter("");
    setTimeout(() => contentRef.current?.focus(), 20);
  }

  const handleTagClick = (e) => {
    if (isLocked) return;
    const mathPill = e.target.closest(".katex-inline-node");
    if (mathPill) {
      e.stopPropagation();
      e.preventDefault();
      const formula = mathPill.getAttribute("data-formula") || "";
      setSelectedMathNode(mathPill);
      setPopoverFormula(formula);
      setMathPopoverOpen(true);
    }
  };

  const handleMathSave = (newFormula) => {
    if (isLocked) return;
    const mathNode = selectedMathNode;
    if (mathNode && contentRef.current) {
      if (!newFormula) {
        mathNode.remove();
      } else {
        const katexHtml = renderKatexToStringMemoized(newFormula, { displayMode: false, throwOnError: false });
        const escapedFormula = newFormula.replace(/"/g, "&quot;");
        mathNode.setAttribute("data-formula", newFormula);
        mathNode.innerHTML = katexHtml;
      }
      const updatedText = getBlockTextFromDOM(contentRef.current);
      onChange(block.id, updatedText);
      onUpdateBlock(block.id, { content: updatedText }, true);
      const targetNext = mathNode.nextSibling;
      setMathPopoverOpen(false);
      setSelectedMathNode(null);
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.focus();
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            if (targetNext && targetNext.nodeType === 3) {
              range.setStart(targetNext, 0);
              range.collapse(true);
            } else if (contentRef.current.contains(mathNode)) {
              range.setStartAfter(mathNode);
              range.collapse(true);
            } else {
              range.selectNodeContents(contentRef.current);
              range.collapse(false);
            }
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      });
      return;
    }
    setMathPopoverOpen(false);
    setSelectedMathNode(null);
  };

  const handleMathDelete = () => {
    if (isLocked) return;
    const mathNode = selectedMathNode;
    if (mathNode && contentRef.current) {
      const prevSibling = mathNode.previousSibling;
      mathNode.remove();
      const updatedText = getBlockTextFromDOM(contentRef.current);
      onChange(block.id, updatedText);
      onUpdateBlock(block.id, { content: updatedText }, true);
      setMathPopoverOpen(false);
      setSelectedMathNode(null);
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.focus();
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            if (prevSibling && prevSibling.nodeType === 3) {
              range.setStart(prevSibling, prevSibling.nodeValue ? prevSibling.nodeValue.length : 0);
              range.collapse(true);
            } else {
              range.selectNodeContents(contentRef.current);
              range.collapse(true);
            }
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      });
      return;
    }
    setMathPopoverOpen(false);
    setSelectedMathNode(null);
  };

  function handleKeyDown(e) {
    if (isLocked) {
      if (e.key === "Enter" || e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        return;
      }
    }

    handleInlineBoundaryKeyDown(e);

    if (slashOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) {
      return;
    }

    // Sub-bullet Tab / Shift+Tab indentation & unindentation for bullet lists
    if (e.key === "Tab" && block.type === "bullet") {
      e.preventDefault();
      const currentLevel = Math.max(0, Math.min(4, Number(block.level) || 0));
      if (!e.shiftKey) {
        if (currentLevel < 4) {
          onUpdateBlock?.(block.id, { level: currentLevel + 1 }, false, true);
        }
      } else {
        if (currentLevel > 0) {
          onUpdateBlock?.(block.id, { level: currentLevel - 1 }, false, true);
        } else {
          const text = contentRef.current ? getBlockTextFromDOM(contentRef.current) : (block.content || "");
          if (!text.trim()) {
            onChangeType?.(block.id, "text");
          }
        }
      }
      return;
    }

    // BUG-TAB-01: Soft tab indentation / outdent without losing focus
    if (e.key === "Tab" && block.type !== "code" && block.type !== "table") {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || !contentRef.current) return;
      const range = sel.getRangeAt(0);

      if (!e.shiftKey) {
        const textNode = document.createTextNode("  ");
        range.deleteContents();
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
        const updated = getBlockTextFromDOM(contentRef.current);
        onChange(block.id, updated);
      } else {
        const fullText = getBlockTextFromDOM(contentRef.current);
        if (fullText.startsWith("  ")) {
          const newText = fullText.slice(2);
          setBlockDOMFromText(contentRef.current, newText);
          setCaretToStart(contentRef.current);
          onChange(block.id, newText);
        } else if (fullText.startsWith(" ")) {
          const newText = fullText.slice(1);
          setBlockDOMFromText(contentRef.current, newText);
          setCaretToStart(contentRef.current);
          onChange(block.id, newText);
        }
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
      e.preventDefault();
      
      const sel = window.getSelection();
      let textBefore = block.content || "";
      let textAfter = "";

      if (sel && sel.rangeCount > 0 && sel.focusNode && contentRef.current) {
        const range = sel.getRangeAt(0);
        const split = splitBlockDOMAtRange(contentRef.current, range);
        textBefore = split.textBefore;
        textAfter = split.textAfter;
        
        onChange(block.id, textBefore);
        if (contentRef.current) {
          setBlockDOMFromText(contentRef.current, textBefore);
        }
      }

      if (["bullet", "number", "todo", "toggle", "callout", "quote"].includes(block.type) && !textBefore.trim() && !textAfter.trim()) {
        if (block.type === "bullet" && (block.level || 0) > 0) {
          onUpdateBlock?.(block.id, { level: (block.level || 0) - 1 }, false, true);
          return;
        }
        onChangeType(block.id, "text");
        return;
      }

      // Pressing Enter in headings, callouts, and quotes spawns a standard paragraph text block below
      const nextType = ["h1", "h2", "h3", "h4", "callout", "quote"].includes(block.type) ? "text" : block.type;
      
      // Clean redundant leading bullet markers if inheriting list type
      if (["bullet", "number", "todo"].includes(nextType)) {
        textAfter = textAfter.replace(/^(\*|-|\u2022|\d+\.|\\[[ xX]?\\])\s+/, "");
      }

      const extraProps = nextType === "todo" ? { checked: false } : nextType === "bullet" ? { level: block.level || 0 } : {};
      onAddAfter(block.id, textAfter, nextType, extraProps);
      return;
    }

    onKeyDown?.(e, block.id, contentRef.current);
  }
  const typeStyles = {
    text: "text-[15px] leading-relaxed text-ink-200",
    inlinemath: "text-[15px] leading-relaxed text-ink-200 my-0.5",
    h1: "text-3xl font-extrabold tracking-tight leading-snug text-ink-100 pt-3 pb-1.5 my-1.5",
    h2: "text-2xl font-bold tracking-tight leading-snug text-ink-100 pt-2.5 pb-1 my-1",
    h3: "text-xl font-semibold leading-snug text-ink-100 pt-2 pb-0.5 my-0.5",
    h4: "text-base font-semibold leading-normal text-ink-100 pt-1 pb-0.5",
    bullet: "text-[15px] leading-relaxed text-ink-200",
    number: "text-[15px] leading-relaxed text-ink-200",
    todo: "text-[15px] leading-relaxed text-ink-200",
    toggle: "text-[15px] leading-relaxed text-ink-200",
    code: "font-mono text-sm leading-relaxed text-emerald-400 bg-ink-850 rounded-lg px-4 py-3 border border-ink-700 whitespace-pre-wrap code-block",
  };

  const placeholders = {
    text: isLast ? "Type something, or press '/' for commands…" : "",
    inlinemath: "Inline equation $formula$…",
    h1: "Heading 1",
    h2: "Heading 2",
    h3: "Heading 3",
    h4: "Heading 4",
    bullet: "List item",
    number: "Numbered item",
    todo: "To-do item",
    toggle: "Toggle heading…",
    callout: "Callout text…",
    quote: "Quote or citation…",
    code: "Write code…",
    math: "LaTeX formula…",
    table: "Table…",
  };

  const Tag =
    block.type === "h1"
      ? "h1"
      : block.type === "h2"
        ? "h2"
        : block.type === "h3"
          ? "h3"
          : block.type === "h4"
            ? "h4"
            : "div";

  return (
    <div
      data-block-id={block.id}
      className={`group relative rounded-lg px-2.5 py-1.5 transition-all ${
        isMultiSelected
          ? "bg-duck-500/20 border border-duck-400/60 shadow-md ring-1 ring-duck-400/40"
          : isSelected
            ? "bg-ink-900/60"
            : "hover:bg-ink-900/30"
      } ${
        isDragTarget
          ? "before:absolute before:-top-px before:left-0 before:h-0.5 before:w-full before:rounded-full before:bg-duck-400"
          : ""
      }`}
      onClick={(e) => {
        onSelect(block.id);
        if (contentRef.current && !isLocked) {
          // If clicked in the empty margin/whitespace of the row, place caret at the end of the text
          if (
            e.target === e.currentTarget ||
            (e.target.tagName === "DIV" &&
              !e.target.isContentEditable &&
              !e.target.closest("button, a, input, textarea, select, table, [contenteditable='true']"))
          ) {
            setCaretToEnd(contentRef.current);
          }
        }
      }}
      onDragOver={(e) => {
        if (isLocked) return;
        e.preventDefault();
        dragHandlers?.onDragOver(block.id);
      }}
      onDrop={(e) => {
        if (isLocked) return;
        e.preventDefault();
        dragHandlers?.onDrop();
      }}
      onContextMenu={(e) => {
        if (isLocked) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect(block.id);
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(rect.width - 290, e.clientX - rect.left));
        const offsetY = Math.max(0, e.clientY - rect.top + 4);
        setMenuPosition({ x: offsetX, y: offsetY });
        setMenuOpen(true);
      }}
    >
      {/* Properly Aligned Controls */}
      {!isLocked && (
        <div className="absolute -left-14 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(block.id);
            }}
            title="Delete Block"
            className="rounded p-1 text-xs text-rose-400/90 transition-colors hover:bg-rose-500/20 hover:text-rose-300 cursor-pointer"
          >
            🗑️
          </button>
          <button
            type="button"
            draggable={!isLocked}
            onDragStart={(e) => {
              if (isLocked) return;
              e.stopPropagation();
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", block.id);
              dragHandlers?.onDragStart(block.id);
            }}
            onDragEnd={() => {
              dragHandlers?.onDragEnd();
            }}
            onMouseDown={() => setHandleHeld(true)}
            onMouseUp={() => setHandleHeld(false)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(block.id);
              setMenuPosition(null);
              setMenuOpen(!menuOpen);
            }}
            title="Drag to move · click for block menu"
            className="cursor-grab rounded p-1 text-xs text-ink-500 transition-colors hover:bg-ink-800 hover:text-duck-300 active:cursor-grabbing"
          >
            ⠿
          </button>
        </div>
      )}

      {menuOpen && (
        <BlockContextMenu
          block={block}
          position={menuPosition}
          onClose={() => {
            setMenuOpen(false);
            setMenuPosition(null);
          }}
          onChangeType={onChangeType}
          onDelete={onDelete}
          onExplainBlock={onExplainBlock}
          onQuizBlock={onQuizBlock}
          onDuplicate={onDuplicate}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={index > 0}
          canMoveDown={index < totalBlocks - 1}
        />
      )}

      {/* ─── Render Specific Block Types ─────────────────── */}

      {/* 1. Divider */}
      {block.type === "divider" ? (
        <div
          id={`divider_${block.id}`}
          tabIndex={0}
          onClick={() => onSelect(block.id)}
          onKeyDown={(e) => {
            if (isLocked) return;
            if (e.key === "Delete") {
              e.preventDefault();
              onDelete(block.id);
            } else if (e.key === "Backspace") {
              e.preventDefault();
              onExitUp?.(block.id);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onExitDown?.(block.id);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              onExitUp?.(block.id);
            } else if (e.key === "Enter") {
              e.preventDefault();
              onAddAfter(block.id, "", "text");
            }
          }}
          className={`group/divider py-3 px-2 cursor-pointer outline-none rounded-lg transition-all ${
            isSelected ? "ring-1 ring-duck-400/40 bg-duck-500/5" : "hover:bg-ink-850/50"
          }`}
          title="Click to select divider. Press Backspace/Delete to remove, Enter to add block below."
        >
          <hr className={`border-t transition-colors ${isSelected ? "border-duck-400/70" : "border-ink-800 group-hover/divider:border-ink-700"}`} />
        </div>
      ) : block.type === "math" ? (
        /* Math Equation Block */
        <MathBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} onAddAfter={onAddAfter} onExitDown={onExitDown} onExitUp={onExitUp} isLocked={isLocked} />
      ) : block.type === "code" ? (
        /* Code Snippet Block */
        <CodeBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} onAddAfter={onAddAfter} onExitDown={onExitDown} onExitUp={onExitUp} isLocked={isLocked} registerRef={registerRef} />
      ) : block.type === "table" ? (
        /* Interactive Grid Table Block */
        <TableBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} onAddAfter={onAddAfter} onExitDown={onExitDown} onExitUp={onExitUp} isLocked={isLocked} />
      ) : block.type === "bullet" ? (

        /* 3. Bullet List (Hierarchical sub-bullets with Tab/Shift+Tab support) */
        (() => {
          const bulletLevel = Math.max(0, Math.min(4, Number(block.level) || 0));
          return (
            <div
              className="flex items-start gap-2.5 transition-all"
              style={bulletLevel > 0 ? { paddingLeft: `${bulletLevel * 1.5}rem` } : undefined}
            >
              {bulletLevel === 0 ? (
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
              ) : bulletLevel === 1 ? (
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full border border-ink-400 bg-transparent" />
              ) : bulletLevel === 2 ? (
                <span className="mt-2.5 h-1.25 w-1.25 shrink-0 rounded-none bg-ink-400" />
              ) : (
                <span className="mt-2.5 h-1.25 w-1.25 shrink-0 rounded-none border border-ink-400 bg-transparent" />
              )}
              <Tag
                ref={contentRef}
                contentEditable={!isLocked}
                suppressContentEditableWarning
                onClick={handleTagClick}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={() => onSelect(block.id)}
                data-placeholder={bulletLevel > 0 ? "Sub-bullet item" : placeholders.bullet}
                className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.bullet} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)] ${
                  isLocked ? "cursor-default select-text" : ""
                }`}
              />
            </div>
          );
        })()
      ) : block.type === "number" ? (
        /* 4. Numbered List */
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 w-5 font-mono text-sm font-semibold text-ink-400">
            {blockNumber || 1}.
          </span>
          <Tag
            ref={contentRef}
            contentEditable={!isLocked}
            suppressContentEditableWarning
            onClick={handleTagClick}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.number}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.number} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)] ${
              isLocked ? "cursor-default select-text" : ""
            }`}
          />
        </div>
      ) : block.type === "todo" ? (
        /* 5. To-Do List */
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            disabled={isLocked}
            checked={Boolean(block.checked)}
            onChange={(e) => onUpdateBlock(block.id, { checked: e.target.checked })}
            className={`mt-1 h-4 w-4 rounded border-ink-700 bg-ink-850 text-duck-400 focus:ring-0 ${
              isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
          />
          <Tag
            ref={contentRef}
            contentEditable={!isLocked}
            suppressContentEditableWarning
            onClick={handleTagClick}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.todo}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.todo} ${
              block.checked ? "line-through text-ink-500" : ""
            } empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)] ${
              isLocked ? "cursor-default select-text" : ""
            }`}
          />
        </div>
      ) : block.type === "toggle" ? (
        /* 6. Toggle / Collapsible Dropdown Block */
        <div className="group/toggleblk my-1 rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 shadow-sm space-y-2 transition-all">
          <div className="flex items-center gap-2 print:gap-1">
            <span className="hidden print:inline-block font-bold text-xs text-ink-600 shrink-0 ml-3 mr-1.5">▶</span>
            <button
              type="button"
              onClick={() => onUpdateBlock(block.id, { open: block.open === false ? true : false })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-850 text-xs font-bold text-duck-400 transition-transform active:scale-95 hover:border-duck-500/40 hover:bg-duck-500/10 print:hidden cursor-pointer"
              title="Toggle Dropdown Section"
            >
              {block.open === false ? "▶" : "▼"}
            </button>
            <Tag
              ref={contentRef}
              contentEditable={!isLocked}
              suppressContentEditableWarning
              onClick={handleTagClick}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => onSelect(block.id)}
              data-placeholder={placeholders.toggle}
              className={`min-h-[1.5em] flex-1 font-semibold text-ink-100 outline-none ${typeStyles.toggle} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)] ${
                isLocked ? "cursor-default select-text" : ""
              }`}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 px-2 py-0.5 rounded border border-ink-800 bg-ink-950 print:hidden">
              {block.open === false ? "Collapsed" : "Expanded"}
            </span>
          </div>

          {/* 1. Screen Interactive Textarea: Shown only when open on screen */}
          {block.open !== false && (
            <div className="ml-7 rounded-lg border-l-2 border-duck-500/40 bg-ink-850/70 p-3 text-xs leading-relaxed text-ink-200 animate-fade-in print:hidden">
              <textarea
                id={`toggle_details_${block.id}`}
                value={block.details ?? block.toggleContent ?? ""}
                readOnly={isLocked}
                onChange={(e) => onUpdateBlock(block.id, { details: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    const start = e.target.selectionStart;
                    const val = e.target.value || "";
                    const isLastLine = !val.substring(start).includes("\n");
                    if (isLastLine && start === val.length) {
                      e.preventDefault();
                      onExitDown?.(block.id);
                    }
                  } else if (e.key === "ArrowUp") {
                    const start = e.target.selectionStart;
                    const val = e.target.value || "";
                    const isFirstLine = !val.substring(0, start).includes("\n");
                    if (isFirstLine && start === 0) {
                      e.preventDefault();
                      if (contentRef.current) {
                        setCaretToEnd(contentRef.current);
                      } else {
                        onExitUp?.(block.id);
                      }
                    }
                  } else if (e.key === "ArrowLeft") {
                    if (e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
                      e.preventDefault();
                      if (contentRef.current) {
                        setCaretToEnd(contentRef.current);
                      } else {
                        onExitUp?.(block.id);
                      }
                    }
                  } else if (e.key === "ArrowRight") {
                    const val = e.target.value || "";
                    if (e.target.selectionStart === val.length && e.target.selectionEnd === val.length) {
                      e.preventDefault();
                      onExitDown?.(block.id);
                    }
                  } else if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    onAddAfter(block.id, "", "text");
                  }
                }}
                placeholder="Add collapsible details, deep dive text, or code breakdown here..."
                rows={3}
                className={`w-full bg-transparent font-sans text-xs text-ink-200 placeholder:text-ink-600 focus:outline-none resize-y min-h-[3rem] ${
                  isLocked ? "cursor-default" : ""
                }`}
              />
            </div>
          )}

          {/* 2. Print-Only Details Container: ALWAYS rendered in DOM for every toggle block, unconditionally visible in print/PDF */}
          {(Boolean(block.details) || Boolean(block.toggleContent)) && (
            <div className="toggle-print-details hidden print:block text-xs text-ink-900 whitespace-pre-wrap leading-relaxed font-sans">
              {block.details ?? block.toggleContent ?? ""}
            </div>
          )}
        </div>
      ) : block.type === "callout" ? (
        /* 7. Callout Box */
        <div className="relative rounded-xl border border-ink-700 bg-ink-850/90 p-3.5 shadow-md flex items-start gap-3">
          <div className="relative">
            <button
              type="button"
              disabled={isLocked}
              onClick={() => setShowIconPicker(!showIconPicker)}
              className={`text-lg leading-none p-1 rounded hover:bg-ink-800 ${
                isLocked ? "cursor-default" : "cursor-pointer"
              }`}
            >
              {block.calloutIcon || "💡"}
            </button>

            {!isLocked && showIconPicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowIconPicker(false)}
                />
                <div className="absolute left-0 top-8 z-50 flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1.5 shadow-2xl">
                  {CALLOUT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => {
                        onUpdateBlock(block.id, { calloutIcon: icon });
                        setShowIconPicker(false);
                      }}
                      className="p-1 text-base hover:bg-ink-800 rounded cursor-pointer"
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <Tag
            ref={contentRef}
            contentEditable={!isLocked}
            suppressContentEditableWarning
            onClick={handleTagClick}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.callout}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.text} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)] ${
              isLocked ? "cursor-default select-text" : ""
            }`}
          />
        </div>
      ) : block.type === "quote" ? (
        /* 8. Quote */
        <div className="border-l-4 border-duck-400 pl-4 py-1 italic">
          <Tag
            ref={contentRef}
            contentEditable={!isLocked}
            suppressContentEditableWarning
            onClick={handleTagClick}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.quote}
            className={`min-h-[1.5em] outline-none ${typeStyles.quote} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)] ${
              isLocked ? "cursor-default select-text" : ""
            }`}
          />
        </div>
      ) : block.type === "site" ? (
        /* 10. Site Bookmark Embed */
        <SiteBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} onAddAfter={onAddAfter} onExitDown={onExitDown} onExitUp={onExitUp} />
      ) : block.type === "media" ? (
        /* 11. Image / Audio / Video Embed */
        <MediaBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} onAddAfter={onAddAfter} onExitDown={onExitDown} onExitUp={onExitUp} isLocked={isLocked} />
      ) : block.type === "columns" ? (
        /* Multi-Column Layout Block (2 to 5 Columns Split) */
        <ColumnsBlock
          block={block}
          onUpdateBlock={onUpdateBlock}
          onSelect={onSelect}
          setSelectedBlockIds={setSelectedBlockIds}
          selectedBlockIds={selectedBlockIds}
          onDelete={onDelete}
          isLocked={isLocked}
          onSaveNote={onSaveNote}
          onAddAfter={onAddAfter}
          onExitDown={onExitDown}
          onExitUp={onExitUp}
        />
      ) : (
        /* Standard Paragraph & Heading Blocks */
        <Tag
          ref={contentRef}
          contentEditable={!isLocked}
          suppressContentEditableWarning
          onClick={handleTagClick}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => onSelect(block.id)}
          data-placeholder={placeholders[block.type] ?? ""}
          className={`min-h-[1.5em] outline-none ${typeStyles[block.type] ?? typeStyles.text} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
        />
      )}

      {/* Bottom Insertion Dropzone for effortless clicking below any block */}
      {!isLocked && (
        <div
          data-insert-zone="after"
          onClick={(e) => {
            e.stopPropagation();
            onAddAfter(block.id, "", "text");
          }}
          className="h-1.5 w-full cursor-text my-0.5 rounded transition-all hover:bg-duck-400/20 group/dropzone flex items-center justify-center"
          title="Click to place cursor and type below this block"
        />
      )}

      {mathPopoverOpen && (
        <InlineEquationPopover
          isOpen={mathPopoverOpen}
          initialFormula={popoverFormula}
          onSave={handleMathSave}
          onDelete={handleMathDelete}
          onClose={() => {
            setMathPopoverOpen(false);
            setSelectedMathNode(null);
            requestAnimationFrame(() => {
              contentRef.current?.focus();
            });
          }}
        />
      )}

      {/* Slash Menu pops up directly below current block */}
      {slashOpen && (
        <SlashMenu
          onSelect={handleSlashSelect}
          onClose={() => {
            setSlashOpen(false);
            setSlashFilter("");
            requestAnimationFrame(() => {
              contentRef.current?.focus();
            });
          }}
          filter={slashFilter}
        />
      )}
    </div>
  );
});

// ─── Floating Text Selection Popover Toolbar ────────────────────────
function TextSelectionToolbar({
  editorContainerRef,
  onExplainBlock,
  onQuizBlock,
  onRecordHistory,
}) {
  const [position, setPosition] = useState(null); // { x, y, selectedText }
  const [visible, setVisible] = useState(false);
  const toolbarRef = useRef(null);

  const updateSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setVisible(false);
      return;
    }
    const text = sel.toString().trim();
    if (!text) {
      setVisible(false);
      return;
    }

    const range = sel.getRangeAt(0);
    // Ensure selection is within the editorContainer
    if (
      editorContainerRef.current &&
      !editorContainerRef.current.contains(range.commonAncestorContainer)
    ) {
      setVisible(false);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setVisible(false);
      return;
    }

    const toolbarWidth = 370;
    const toolbarHeight = 40;
    const targetX = Math.max(
      16,
      Math.min(window.innerWidth - toolbarWidth - 16, rect.left + rect.width / 2 - toolbarWidth / 2)
    );
    let targetY = rect.top - toolbarHeight - 8;
    if (targetY < 8) {
      targetY = rect.bottom + 8;
    }

    setPosition({ x: targetX, y: targetY, selectedText: text });
    setVisible(true);
  }, [editorContainerRef]);

  useEffect(() => {
    const handleSelectionChange = () => {
      requestAnimationFrame(updateSelection);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("scroll", handleSelectionChange, true);
    window.addEventListener("resize", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("scroll", handleSelectionChange, true);
      window.removeEventListener("resize", handleSelectionChange);
    };
  }, [updateSelection]);

  if (!visible || !position) return null;

  const handleFormat = (command) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const selectedText = sel.toString();
    if (!selectedText) return;

    // Record history snapshot before applying format
    onRecordHistory?.();

    const activeEl =
      (document.activeElement && document.activeElement.isContentEditable)
        ? document.activeElement
        : range.commonAncestorContainer?.nodeType === 1
        ? range.commonAncestorContainer.closest("[contenteditable='true']")
        : range.commonAncestorContainer?.parentElement?.closest("[contenteditable='true']");

    if (command === "bold") {
      document.execCommand("bold", false, null);
    } else if (command === "italic") {
      document.execCommand("italic", false, null);
    } else if (command === "underline") {
      document.execCommand("underline", false, null);
    } else if (command === "strikethrough") {
      document.execCommand("strikeThrough", false, null);
    } else if (command === "code") {
      const trimmed = selectedText.trim();
      document.execCommand("insertText", false, `\`${trimmed}\``);
    } else if (command === "math") {
      const trimmed = selectedText.trim();
      document.execCommand("insertText", false, `$${trimmed}$`);
    }

    if (activeEl) {
      // Immediately compile rich KaTeX math pills and inline code tags in DOM
      if (command === "math" || command === "code") {
        const fullText = getBlockTextFromDOM(activeEl);
        setBlockDOMFromText(activeEl, fullText);
        setCaretToEnd(activeEl);
      }
      activeEl.dispatchEvent(new Event("input", { bubbles: true }));
      requestAnimationFrame(() => {
        activeEl.focus();
      });
    }

    setVisible(false);
  };

  return (
    <div
      ref={toolbarRef}
      onMouseDown={(e) => {
        // Prevent selection blur when clicking toolbar buttons
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className="fixed z-[120] flex items-center gap-0.5 rounded-xl border border-ink-700/90 bg-ink-900/98 px-1.5 py-1 shadow-2xl backdrop-blur-md animate-fade-in text-xs select-none pointer-events-auto"
    >
      {/* Formatting buttons */}
      <button
        type="button"
        onClick={() => handleFormat("bold")}
        title="Bold"
        className="flex h-7 w-7 items-center justify-center rounded-lg font-bold text-ink-200 hover:bg-ink-800 hover:text-white transition-colors cursor-pointer"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => handleFormat("italic")}
        title="Italic"
        className="flex h-7 w-7 items-center justify-center rounded-lg italic text-ink-200 hover:bg-ink-800 hover:text-white transition-colors cursor-pointer"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => handleFormat("underline")}
        title="Underline"
        className="flex h-7 w-7 items-center justify-center rounded-lg underline text-ink-200 hover:bg-ink-800 hover:text-white transition-colors cursor-pointer"
      >
        U
      </button>
      <button
        type="button"
        onClick={() => handleFormat("strikethrough")}
        title="Cross / Strikethrough"
        className="flex h-7 w-7 items-center justify-center rounded-lg line-through text-ink-200 hover:bg-ink-800 hover:text-white transition-colors cursor-pointer"
      >
        S
      </button>
      <button
        type="button"
        onClick={() => handleFormat("code")}
        title="Convert to Code (`code`)"
        className="flex h-7 px-1.5 items-center justify-center rounded-lg font-mono text-xs text-ink-200 hover:bg-ink-800 hover:text-duck-300 transition-colors cursor-pointer"
      >
        &lt;/&gt;
      </button>
      <button
        type="button"
        onClick={() => handleFormat("math")}
        title="Convert to Formula ($formula$)"
        className="flex h-7 px-1.5 items-center justify-center rounded-lg font-mono text-xs font-bold text-duck-300 hover:bg-duck-500/20 hover:text-duck-200 transition-colors cursor-pointer"
      >
        $x$
      </button>

      {/* Divider */}
      <div className="mx-1 h-4 w-[1px] bg-ink-700/80" />

      {/* Explain & Quiz AI Study Buttons */}
      <button
        type="button"
        onClick={() => {
          if (position.selectedText) {
            onExplainBlock?.(position.selectedText);
            setVisible(false);
          }
        }}
        title="Explain highlighted text with Socratic AI"
        className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-ink-200 hover:bg-ink-800 hover:text-duck-300 transition-colors cursor-pointer"
      >
        <span>✨</span>
        <span>Explain</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (position.selectedText) {
            onQuizBlock?.(position.selectedText);
            setVisible(false);
          }
        }}
        title="Generate quiz from highlighted text"
        className="flex items-center gap-1 rounded-lg border border-duck-500/30 bg-duck-500/10 px-2 py-1 font-medium text-duck-300 hover:bg-duck-500/20 hover:text-duck-200 transition-colors cursor-pointer"
      >
        <span>🦆</span>
        <span>Quiz me</span>
      </button>
    </div>
  );
}

export const NOTE_FONT_CLASSES = {
  sans: "font-note-sans",
  serif: "font-note-serif",
  mono: "font-note-mono",
  handwriting: "font-note-handwriting",
  geometric: "font-note-geometric",
};

// ─── BlockNoteEditor (main export) ──────────────────────────────────
export default function BlockNoteEditor({
  noteId = "",
  spaceId = "",
  onExplainBlock,
  onQuizBlock,
  onTriggerSocratic,
  onSwitchTab,
  initialTitle = "",
  initialBlocks,
  initialBanner = null,
  initialFavorite = false,
  initialEmoji = null,
  initialFontStyle = "sans",
  initialFullWidth = false,
  initialLocked = false,
  onToggleLock,
  onBlocksChange,
  onSaveNote,
  onExportImport,
  onRegisterReformat,
  onReformatStateChange,
  notesBySpace = {},
  onSelectNote,
  clickToAppend = true,
}) {
  const [title, setTitle] = useState(initialTitle);
  const [banner, setBanner] = useState(initialBanner);
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [fontStyle, setFontStyle] = useState(initialFontStyle || "sans");
  const [fullWidth, setFullWidth] = useState(Boolean(initialFullWidth));
  const [isLocked, setIsLocked] = useState(Boolean(initialLocked));
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [isReformatting, setIsReformatting] = useState(false);
  const [reformatProgress, setReformatProgress] = useState(null);
  const [reformatToast, setReformatToast] = useState(null);

  useEffect(() => {
    setFontStyle(initialFontStyle || "sans");
    fontStyleRef.current = initialFontStyle || "sans";
  }, [initialFontStyle]);

  useEffect(() => {
    setFullWidth(Boolean(initialFullWidth));
    fullWidthRef.current = Boolean(initialFullWidth);
  }, [initialFullWidth]);

  useEffect(() => {
    setIsLocked(Boolean(initialLocked));
    isLockedRef.current = Boolean(initialLocked);
  }, [initialLocked]);

  const [blocks, setBlocks] = useState(() =>
    initialBlocks && initialBlocks.length > 0
      ? initialBlocks
      : [{ id: "blk_default_init_0", type: "text", content: "" }]
  );
  const [selectedId, setSelectedId] = useState(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState(new Set());
  const selectedBlockIdsRef = useRef(selectedBlockIds);
  useEffect(() => {
    selectedBlockIdsRef.current = selectedBlockIds;
  }, [selectedBlockIds]);

  const [marqueeBox, setMarqueeBox] = useState(null);
  const isDraggingMarquee = useRef(false);
  const marqueeStartClient = useRef({ x: 0, y: 0 });
  const marqueeStartEditor = useRef({ x: 0, y: 0 });
  const currentMousePos = useRef({ clientX: 0, clientY: 0 });
  const initialSelectedIdsRef = useRef(new Set());
  const scrollContainerRef = useRef(null);
  const marqueeRafId = useRef(null);

  const editorContainerRef = useRef(null);
  const blockRefs = useRef({});
  const noteTitleInputRef = useRef(null);
  const bannerPickerRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const lastHistoryPush = useRef(0);
  const [pastBlocks, setPastBlocks] = useState([]);
  const [futureBlocks, setFutureBlocks] = useState([]);

  const noteIdRef = useRef(noteId);
  const spaceIdRef = useRef(spaceId);
  const titleRef = useRef(title);
  const bannerRef = useRef(banner);
  const isFavoriteRef = useRef(isFavorite);
  const emojiRef = useRef(emoji);
  const fontStyleRef = useRef(fontStyle);
  const fullWidthRef = useRef(fullWidth);
  const isLockedRef = useRef(isLocked);
  const blocksRef = useRef(blocks);
  const pastBlocksRef = useRef(pastBlocks);
  const futureBlocksRef = useRef(futureBlocks);
  const saveTimeoutRef = useRef(null);
  const isDirtyRef = useRef(false);

  const registerRef = useCallback((id, ref) => {
    blockRefs.current[id] = ref;
  }, []);

  const focusBlock = useCallback((blockOrId, position = "start") => {
    if (!blockOrId) return;
    const block =
      typeof blockOrId === "object" && blockOrId !== null
        ? blockOrId
        : blocksRef.current.find((b) => b.id === blockOrId);
    if (!block) return;

    setSelectedId(block.id);
    setSelectedBlockIds(new Set());

    const performFocus = () => {
      // 1. CodeBlock
      if (block.type === "code") {
        const codeEl = document.getElementById(`code_${block.id}`);
        if (codeEl) {
          codeEl.focus();
          if (position === "end") {
            const len = codeEl.value ? codeEl.value.length : 0;
            codeEl.setSelectionRange(len, len);
          } else {
            codeEl.setSelectionRange(0, 0);
          }
          return true;
        }
      }

      // 2. TableBlock
      if (block.type === "table") {
        const norm = getNormalizedTableData(block.tableData, block.content);
        const hasHeaders = norm.hasHeaderRow !== false && norm.headers && norm.headers.length > 0;
        const rowCount = norm.rows?.length || 0;
        const colCount = Math.max(
          norm.headers?.length || 0,
          ...(norm.rows?.map((r) => (Array.isArray(r) ? r.length : 0)) || [2])
        );

        if (position === "end") {
          let targetCell = null;
          if (rowCount > 0) {
            targetCell = document.getElementById(`tbl_${block.id}_r_${rowCount - 1}_c_${colCount - 1}`);
          }
          if (!targetCell && hasHeaders) {
            targetCell = document.getElementById(`tbl_${block.id}_h_${colCount - 1}`);
          }
          if (!targetCell) {
            targetCell = document.querySelector(`[data-block-id="${block.id}"] [contenteditable="true"]:last-of-type`);
          }
          if (targetCell) {
            setCaretToEnd(targetCell);
            return true;
          }
        } else {
          const firstCell = hasHeaders
            ? document.getElementById(`tbl_${block.id}_h_0`)
            : document.getElementById(`tbl_${block.id}_r_0_c_0`) ||
              document.querySelector(`[data-block-id="${block.id}"] [contenteditable="true"]`);
          if (firstCell) {
            setCaretToStart(firstCell);
            return true;
          }
        }
      }

      // 3. ColumnsBlock
      if (block.type === "columns") {
        const colCount = Math.max(2, Math.min(5, Number(block.columnCount) || 2));
        if (position === "end") {
          const lastColIdx = colCount - 1;
          const targetEl =
            document.getElementById(`col_${block.id}_${lastColIdx}_content`) ||
            document.getElementById(`col_${block.id}_${lastColIdx}_title`);
          if (targetEl) {
            setCaretToEnd(targetEl);
            return true;
          }
        } else {
          const firstColTitle =
            document.getElementById(`col_${block.id}_0_title`) ||
            document.getElementById(`col_${block.id}_0_content`);
          if (firstColTitle) {
            setCaretToStart(firstColTitle);
            return true;
          }
        }
      }

      // 4. MathBlock
      if (block.type === "math") {
        const titleInput = document.querySelector(`[data-block-id="${block.id}"] input`);
        if (titleInput) {
          titleInput.focus();
          const len = titleInput.value ? titleInput.value.length : 0;
          if (position === "end") {
            titleInput.setSelectionRange(len, len);
          } else {
            titleInput.setSelectionRange(0, 0);
          }
          return true;
        }
        const mathContainer =
          document.getElementById(`math_${block.id}`) ||
          document.querySelector(`[data-block-id="${block.id}"] .group\\/mathblk`) ||
          document.querySelector(`[data-block-id="${block.id}"] [tabindex="0"]`);
        if (mathContainer) {
          mathContainer.focus();
          return true;
        }
      }

      // 5. Divider
      if (block.type === "divider") {
        const dividerEl =
          document.getElementById(`divider_${block.id}`) ||
          document.querySelector(`[data-block-id="${block.id}"] .group\\/divider`) ||
          document.querySelector(`[data-block-id="${block.id}"] [tabindex="0"]`);
        if (dividerEl) {
          dividerEl.focus();
          return true;
        }
      }

      // 6. Site, Media standalone embeds
      if (["site", "media"].includes(block.type)) {
        const cardEl =
          document.getElementById(`${block.type}_${block.id}`) ||
          document.querySelector(`[data-block-id="${block.id}"] [tabindex="0"]`) ||
          document.querySelector(`[data-block-id="${block.id}"]`);
        if (cardEl) {
          cardEl.focus();
          return true;
        }
      }

      // 7. Toggle Block
      if (block.type === "toggle") {
        if (position === "end" && block.open !== false) {
          const textarea = document.querySelector(`[data-block-id="${block.id}"] textarea`);
          if (textarea) {
            setCaretToEnd(textarea);
            return true;
          }
        }
      }

      // 8. Standard ContentEditable Block (text, headings, lists, quote, callout, inlinemath, toggle summary)
      const el =
        blockRefs.current[block.id]?.current ||
        document.querySelector(`[data-block-id="${block.id}"] [contenteditable="true"]`);
      if (el) {
        if (position === "end") {
          setCaretToEnd(el);
        } else {
          setCaretToStart(el);
        }
        return true;
      }

      return false;
    };

    if (!performFocus()) {
      requestAnimationFrame(() => {
        if (!performFocus()) {
          setTimeout(performFocus, 25);
        }
      });
    }
  }, []);

  useEffect(() => {
    noteIdRef.current = noteId;
  }, [noteId]);

  useEffect(() => {
    spaceIdRef.current = spaceId;
  }, [spaceId]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    bannerRef.current = banner;
  }, [banner]);

  useEffect(() => {
    isFavoriteRef.current = isFavorite;
  }, [isFavorite]);

  useEffect(() => {
    emojiRef.current = emoji;
  }, [emoji]);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    pastBlocksRef.current = pastBlocks;
  }, [pastBlocks]);

  useEffect(() => {
    futureBlocksRef.current = futureBlocks;
  }, [futureBlocks]);

  useEffect(() => {
    fontStyleRef.current = fontStyle;
  }, [fontStyle]);

  useEffect(() => {
    fullWidthRef.current = fullWidth;
  }, [fullWidth]);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  const performSave = useCallback(
    (overrides = {}) => {
      isDirtyRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      onSaveNote?.({
        id: overrides.id || noteIdRef.current,
        spaceId: overrides.spaceId || spaceIdRef.current,
        title: overrides.title !== undefined ? overrides.title : titleRef.current,
        blocks: overrides.blocks !== undefined ? overrides.blocks : blocksRef.current,
        banner: overrides.banner !== undefined ? overrides.banner : bannerRef.current,
        isFavorite: overrides.isFavorite !== undefined ? overrides.isFavorite : isFavoriteRef.current,
        emoji: overrides.emoji !== undefined ? overrides.emoji : emojiRef.current,
        fontStyle: overrides.fontStyle !== undefined ? overrides.fontStyle : fontStyleRef.current,
        fullWidth: overrides.fullWidth !== undefined ? overrides.fullWidth : fullWidthRef.current,
        isLocked: overrides.isLocked !== undefined ? overrides.isLocked : isLockedRef.current,
      });
    },
    [onSaveNote]
  );

  const triggerDebouncedSave = useCallback(
    (overrides = {}) => {
      isDirtyRef.current = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        performSave(overrides);
      }, 400);
    },
    [performSave]
  );

  // Flush pending changes on unmount for this exact noteId & spaceId
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (isDirtyRef.current) {
        isDirtyRef.current = false;
        onSaveNote?.({
          id: noteIdRef.current,
          spaceId: spaceIdRef.current,
          title: titleRef.current,
          blocks: blocksRef.current,
          banner: bannerRef.current,
          isFavorite: isFavoriteRef.current,
          emoji: emojiRef.current,
          fontStyle: fontStyleRef.current,
          fullWidth: fullWidthRef.current,
          isLocked: isLockedRef.current,
        });
      }
    };
  }, [onSaveNote]);

  // Editor-level Ctrl+S / Cmd+S shortcut to immediately save the active note
  useEffect(() => {
    const handleEditorSaveShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        performSave();
      }
    };
    window.addEventListener("keydown", handleEditorSaveShortcut);
    return () => window.removeEventListener("keydown", handleEditorSaveShortcut);
  }, [performSave]);

  // Close banner and emoji pickers on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (showBannerPicker && bannerPickerRef.current && !bannerPickerRef.current.contains(e.target)) {
        setShowBannerPicker(false);
      }
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    }
    if (showBannerPicker || showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showBannerPicker, showEmojiPicker]);

  // High-Performance Smooth Marquee Drag Selection & Auto-Scrolling Engine
  const updateMarqueeFrame = useCallback(() => {
    if (!isDraggingMarquee.current || !editorContainerRef.current) return;

    const editorEl = editorContainerRef.current;
    const scrollContainer = scrollContainerRef.current;

    // 1. Smooth Edge Proximity Auto-Scrolling
    if (scrollContainer) {
      const containerRect =
        scrollContainer === document.documentElement || scrollContainer === document.body
          ? { top: 0, bottom: window.innerHeight, height: window.innerHeight }
          : scrollContainer.getBoundingClientRect();

      const mouseY = currentMousePos.current.clientY;
      const topThreshold = containerRect.top + 80;
      const bottomThreshold = containerRect.bottom - 80;

      if (mouseY < topThreshold) {
        const dist = topThreshold - mouseY;
        const speed = -Math.min(35, Math.max(3, (dist / 80) * 30));
        if (scrollContainer === document.documentElement || scrollContainer === document.body) {
          window.scrollBy({ top: speed, behavior: "instant" });
        } else {
          scrollContainer.scrollTop += speed;
        }
      } else if (mouseY > bottomThreshold) {
        const dist = mouseY - bottomThreshold;
        const speed = Math.min(35, Math.max(3, (dist / 80) * 30));
        if (scrollContainer === document.documentElement || scrollContainer === document.body) {
          window.scrollBy({ top: speed, behavior: "instant" });
        } else {
          scrollContainer.scrollTop += speed;
        }
      }
    }

    // 2. Compute Selection Box in Editor Coordinates (after scroll update)
    const updatedEditorRect = editorEl.getBoundingClientRect();
    const currentX = currentMousePos.current.clientX - updatedEditorRect.left;
    const currentY = currentMousePos.current.clientY - updatedEditorRect.top;
    const startX = marqueeStartEditor.current.x;
    const startY = marqueeStartEditor.current.y;

    const boxLeft = Math.min(startX, currentX);
    const boxTop = Math.min(startY, currentY);
    const boxRight = Math.max(startX, currentX);
    const boxBottom = Math.max(startY, currentY);
    const boxWidth = boxRight - boxLeft;
    const boxHeight = boxBottom - boxTop;

    setMarqueeBox({
      left: boxLeft,
      top: boxTop,
      width: boxWidth,
      height: boxHeight,
    });

    // 3. Batch Check Block Intersections (Only if box is larger than small click threshold)
    if (boxWidth > 4 || boxHeight > 4) {
      const blockEls = editorEl.querySelectorAll("[data-block-id]");
      const newSelected = new Set(initialSelectedIdsRef.current);

      for (let i = 0; i < blockEls.length; i++) {
        const el = blockEls[i];
        const id = el.getAttribute("data-block-id");
        if (!id) continue;

        const elRect = el.getBoundingClientRect();
        const elTop = elRect.top - updatedEditorRect.top;
        const elBottom = elTop + elRect.height;
        const elLeft = elRect.left - updatedEditorRect.left;
        const elRight = elLeft + elRect.width;

        const intersects =
          elLeft < boxRight &&
          elRight > boxLeft &&
          elTop < boxBottom &&
          elBottom > boxTop;

        if (intersects) {
          newSelected.add(id);
        }
      }

      // Check if selection set actually changed before updating state to avoid laggy re-renders
      const currentSelected = selectedBlockIdsRef.current;
      let changed = currentSelected.size !== newSelected.size;
      if (!changed) {
        for (const id of newSelected) {
          if (!currentSelected.has(id)) {
            changed = true;
            break;
          }
        }
      }

      if (changed) {
        selectedBlockIdsRef.current = newSelected;
        setSelectedBlockIds(newSelected);
      }
    }

    if (isDraggingMarquee.current) {
      marqueeRafId.current = requestAnimationFrame(updateMarqueeFrame);
    }
  }, []);

  const handleGlobalMouseMove = useCallback((e) => {
    if (!isDraggingMarquee.current) return;
    currentMousePos.current = { clientX: e.clientX, clientY: e.clientY };
  }, []);

  const handleGlobalMouseUp = useCallback(
    (e) => {
      if (!isDraggingMarquee.current) return;

      if (marqueeRafId.current) {
        cancelAnimationFrame(marqueeRafId.current);
        marqueeRafId.current = null;
      }

      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);

      const clientX = e?.clientX ?? currentMousePos.current.clientX;
      const clientY = e?.clientY ?? currentMousePos.current.clientY;
      const startClient = marqueeStartClient.current;
      const dist = Math.hypot(clientX - startClient.x, clientY - startClient.y);

      isDraggingMarquee.current = false;
      setMarqueeBox(null);
      if (selectedBlockIdsRef.current && selectedBlockIdsRef.current.size > 0) {
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
      }

      // Simple click on empty canvas area -> create or focus last block
      if (dist < 6) {
        if (!clickToAppend) return;
        const lastBlock = blocksRef.current[blocksRef.current.length - 1];
        if (!lastBlock || (lastBlock.content !== "" && lastBlock.content !== undefined)) {
          const newBlock = createBlock("text", "");
          setBlocks((prev) => {
            const next = [...prev, newBlock];
            triggerDebouncedSave({ blocks: next });
            return next;
          });
          setSelectedId(newBlock.id);
          focusBlock(newBlock, "end");
        } else if (lastBlock) {
          focusBlock(lastBlock, "end");
        }
      }
    },
    [clickToAppend, focusBlock, handleGlobalMouseMove, triggerDebouncedSave]
  );

  const handleEditorMouseDown = (e) => {
    if (e.button !== 0) return;

    const isInput = e.target.closest(
      '[contenteditable="true"], input, textarea, button, a, select, [role="button"], canvas, svg, [data-menu]'
    );
    if (isInput) {
      if (!e.shiftKey) {
        setSelectedBlockIds(new Set());
        selectedBlockIdsRef.current = new Set();
      }
      return;
    }

    if (!editorContainerRef.current) return;

    const editorEl = editorContainerRef.current;
    const editorRect = editorEl.getBoundingClientRect();

    isDraggingMarquee.current = true;
    marqueeStartClient.current = { x: e.clientX, y: e.clientY };
    marqueeStartEditor.current = {
      x: e.clientX - editorRect.left,
      y: e.clientY - editorRect.top,
    };
    currentMousePos.current = { clientX: e.clientX, clientY: e.clientY };
    initialSelectedIdsRef.current = e.shiftKey ? new Set(selectedBlockIdsRef.current) : new Set();

    scrollContainerRef.current =
      editorEl.closest("main") ||
      editorEl.parentElement ||
      document.scrollingElement ||
      document.documentElement;

    if (!e.shiftKey) {
      setSelectedBlockIds(new Set());
      selectedBlockIdsRef.current = new Set();
    }

    setMarqueeBox({
      left: e.clientX - editorRect.left,
      top: e.clientY - editorRect.top,
      width: 0,
      height: 0,
    });

    window.addEventListener("mousemove", handleGlobalMouseMove, { passive: true });
    window.addEventListener("mouseup", handleGlobalMouseUp);

    if (marqueeRafId.current) cancelAnimationFrame(marqueeRafId.current);
    marqueeRafId.current = requestAnimationFrame(updateMarqueeFrame);
  };

  useEffect(() => {
    return () => {
      if (marqueeRafId.current) {
        cancelAnimationFrame(marqueeRafId.current);
      }
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  // Drag-to-reorder, driven by each block's ⠿ handle.
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const dragHandlers = useMemo(
    () => ({
      dragging,
      onDragStart: setDragging,
      onDragOver: (id) => setDragOver((current) => (current === id ? current : id)),
      onDragEnd: () => {
        setDragging(null);
        setDragOver(null);
      },
      onDrop: () => {
        if (dragging && dragOver && dragging !== dragOver) {
          setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
          setFutureBlocks([]);
        }
        setBlocks((prev) => {
          if (!dragging || !dragOver || dragging === dragOver) return prev;
          const from = prev.findIndex((b) => b.id === dragging);
          const to = prev.findIndex((b) => b.id === dragOver);
          if (from === -1 || to === -1) return prev;
          const next = [...prev];
          const [moved] = next.splice(from, 1);
          const insertAt = from < to ? to - 1 : to;
          next.splice(insertAt, 0, moved);
          performSave({ blocks: next });
          return next;
        });
        setDragging(null);
        setDragOver(null);
      },
    }),
    [dragging, dragOver, performSave],
  );

  const { totalCharacters, totalWords } = useMemo(() => {
    let chars = 0;
    let words = 0;
    for (let i = 0; i < blocks.length; i++) {
      const c = blocks[i].content;
      if (c) {
        chars += c.length;
        const trimmed = c.trim();
        if (trimmed) {
          words += trimmed.split(/\s+/).length;
        }
      }
    }
    return { totalCharacters: chars, totalWords: words };
  }, [blocks]);

  const totalBlocks = blocks.length;

  useEffect(() => {
    onBlocksChange?.(blocks);
  }, [blocks, onBlocksChange]);


  const handleChange = useCallback(
    (id, content) => {
      const now = Date.now();
      if (now - lastHistoryPush.current > 600) {
        setPastBlocks((p) => [...p.slice(-30), blocksRef.current]);
        setFutureBlocks([]);
        lastHistoryPush.current = now;
      }
      setBlocks((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, content } : b));
        triggerDebouncedSave({ blocks: next });
        return next;
      });
    },
    [triggerDebouncedSave]
  );

  const handleTitleChange = useCallback(
    (newTitle) => {
      setTitle(newTitle);
      titleRef.current = newTitle;
      triggerDebouncedSave({ title: newTitle });
    },
    [triggerDebouncedSave]
  );

  useEffect(() => {
    const handleGlobalUndoRedo = (e) => {
      const activeEl = document.activeElement;
      const inEditor =
        (editorContainerRef.current && editorContainerRef.current.contains(activeEl)) ||
        activeEl === document.body ||
        !activeEl;

      if (!inEditor) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          if (futureBlocksRef.current.length > 0) {
            e.preventDefault();
            const next = futureBlocksRef.current[0];
            setFutureBlocks((f) => f.slice(1));
            setPastBlocks((p) => [
              ...p,
              JSON.parse(JSON.stringify(blocksRef.current)),
            ]);
            const clonedNext = JSON.parse(JSON.stringify(next));
            setBlocks(clonedNext);
            performSave({ blocks: clonedNext });
          }
        } else {
          if (pastBlocksRef.current.length > 0) {
            e.preventDefault();
            const previous = pastBlocksRef.current[pastBlocksRef.current.length - 1];
            setPastBlocks((p) => p.slice(0, p.length - 1));
            setFutureBlocks((f) => [
              JSON.parse(JSON.stringify(blocksRef.current)),
              ...f,
            ]);
            const clonedPrevious = JSON.parse(JSON.stringify(previous));
            setBlocks(clonedPrevious);
            performSave({ blocks: clonedPrevious });
            const targetId = selectedId || clonedPrevious[0]?.id;
            if (targetId) {
              requestAnimationFrame(() => {
                focusBlock(targetId, "end");
              });
            }
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        if (futureBlocksRef.current.length > 0) {
          e.preventDefault();
          const next = futureBlocksRef.current[0];
          setFutureBlocks((f) => f.slice(1));
          setPastBlocks((p) => [
            ...p,
            JSON.parse(JSON.stringify(blocksRef.current)),
          ]);
          const clonedNext = JSON.parse(JSON.stringify(next));
          setBlocks(clonedNext);
          performSave({ blocks: clonedNext });
          const targetId = selectedId || clonedNext[0]?.id;
          if (targetId) {
            requestAnimationFrame(() => {
              focusBlock(targetId, "end");
            });
          }
        }
      }
    };
    window.addEventListener("keydown", handleGlobalUndoRedo);
    return () => window.removeEventListener("keydown", handleGlobalUndoRedo);
  }, [performSave]);

  // Multi-Block Selection Keyboard Shortcuts: Ctrl+A, Ctrl+C, Ctrl+X, Delete/Backspace

  // Multi-Block Selection Keyboard Shortcuts: Ctrl+A, Ctrl+C, Ctrl+X, Delete/Backspace
  useEffect(() => {
    const handleMultiBlockKeydown = (e) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.isContentEditable || activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      // CRITICAL: When user is typing inside any text input or contentEditable block, NEVER intercept keys!
      if (isInput) return;

      // Ctrl+A / Cmd+A Select All Blocks
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedBlockIds(new Set(blocksRef.current.map((b) => b.id)));
        return;
      }

      const effectiveIds =
        selectedBlockIds && selectedBlockIds.size > 0
          ? selectedBlockIds
          : null;

      if (effectiveIds && effectiveIds.size > 0) {
        // Ctrl+C / Cmd+C Copy Selected Blocks as Markdown
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
          e.preventDefault();
          const selected = blocksRef.current.filter((b) => effectiveIds.has(b.id));
          const md = selected.map((b) => blockToMarkdown(b)).join("\n\n");
          navigator.clipboard.writeText(md);
          return;
        }

        // Ctrl+X / Cmd+X Cut Selected Blocks
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
          e.preventDefault();
          const selected = blocksRef.current.filter((b) => effectiveIds.has(b.id));
          const md = selected.map((b) => blockToMarkdown(b)).join("\n\n");
          navigator.clipboard.writeText(md);
          setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
          setFutureBlocks([]);
          setBlocks((prev) => {
            const next = prev.filter((b) => !effectiveIds.has(b.id));
            const safeNext = next.length > 0 ? next : [createBlock("text", "")];
            triggerDebouncedSave({ blocks: safeNext });
            return safeNext;
          });
          setSelectedBlockIds(new Set());
          if (selectedId) setSelectedId(null);
          return;
        }

        // Enter on Selected Blocks
        if (e.key === "Enter" && !isInput) {
          e.preventDefault();
          setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
          setFutureBlocks([]);
          setBlocks((prev) => {
            let lastSelectedIdx = -1;
            prev.forEach((b, i) => {
              if (effectiveIds.has(b.id)) lastSelectedIdx = i;
            });
            
            let insertIdxInNext = 0;
            for (let i = 0; i <= lastSelectedIdx; i++) {
              if (!effectiveIds.has(prev[i].id)) insertIdxInNext++;
            }

            const next = prev.filter((b) => !effectiveIds.has(b.id));
            const newBlock = createBlock("text", "");
            next.splice(insertIdxInNext, 0, newBlock);

            triggerDebouncedSave({ blocks: next });

            setTimeout(() => {
              const el = blockRefs.current[newBlock.id]?.current;
              el?.focus();
            }, 50);
            return next;
          });
          setSelectedBlockIds(new Set());
          if (selectedId) setSelectedId(null);
          return;
        }

        // Backspace / Delete Selected Blocks
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          e.stopPropagation();
          setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
          setFutureBlocks([]);
          let focusTarget = null;
          setBlocks((prev) => {
            const firstSelectedIdx = prev.findIndex((b) => effectiveIds.has(b.id));
            const next = prev.filter((b) => !effectiveIds.has(b.id));
            const safeNext = next.length > 0 ? next : [createBlock("text", "")];
            const targetIdx = Math.max(0, Math.min(firstSelectedIdx >= 0 ? firstSelectedIdx : 0, safeNext.length - 1));
            focusTarget = safeNext[targetIdx];
            triggerDebouncedSave({ blocks: safeNext });
            return safeNext;
          });
          setSelectedBlockIds(new Set());
          if (focusTarget) {
            setSelectedId(focusTarget.id);
            requestAnimationFrame(() => {
              focusBlock(focusTarget, "end");
            });
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", handleMultiBlockKeydown);
    return () => window.removeEventListener("keydown", handleMultiBlockKeydown);
  }, [selectedBlockIds, selectedId, triggerDebouncedSave]);

  const handleChangeType = useCallback((id, type, extraOrCaret = "start") => {
    const extra = typeof extraOrCaret === "object" && extraOrCaret !== null ? extraOrCaret : {};
    const caretTarget = typeof extraOrCaret === "string" ? extraOrCaret : "start";
    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
    setFutureBlocks([]);
    setBlocks((prev) => {
      const next = prev.map((b) => {
        if (b.id !== id) return b;
        if (type === "code") {
          const lang = b.language || b.meta?.language || "javascript";
          return {
            ...b,
            type,
            language: lang,
            meta: { ...(b.meta || {}), language: lang },
          };
        }
        if (type === "table") {
          const norm = getNormalizedTableData(b.tableData, b.content);
          return {
            ...b,
            type: "table",
            tableData: norm,
            content: "",
          };
        }
        if (type === "columns") {
          const count = extra.columnCount || b.columnCount || 2;
          const norm = extra.columnsData || getNormalizedColumnsData(b.columnsData, b.content, count);
          return {
            ...b,
            type: "columns",
            columnCount: count,
            columnsData: norm,
            content: b.content || "",
          };
        }
        if (b.type === "table") {
          const serializedText = blockToMarkdown(b);
          return {
            ...b,
            type,
            content: serializedText,
            tableData: undefined,
          };
        }
        if (b.type === "columns") {
          const serializedText = blockToMarkdown(b);
          return {
            ...b,
            type,
            content: serializedText,
            columnsData: undefined,
            columnCount: undefined,
          };
        }
        return { ...b, type };
      });
      triggerDebouncedSave({ blocks: next });
      return next;
    });
    setSelectedId(id);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const targetBlock = blocksRef.current.find((b) => b.id === id);
        if (targetBlock) {
          focusBlock(targetBlock, caretTarget);
        }
      }, 15);
    });
  }, [focusBlock, triggerDebouncedSave]);

  const handleUpdateBlock = useCallback(
    (id, patch, shouldSaveNote = false, recordHistory = false) => {
      if (recordHistory) {
        setPastBlocks((p) => [
          ...p.slice(-25),
          JSON.parse(JSON.stringify(blocksRef.current)),
        ]);
        setFutureBlocks([]);
      }
      setBlocks((prev) => {
        const next = prev.map((b) => {
          if (b.id !== id) return b;
          const updated = { ...b, ...patch };
          if (patch.language) {
            updated.meta = { ...(updated.meta || {}), language: patch.language };
          }
          return updated;
        });
        if (shouldSaveNote) {
          performSave({ blocks: next });
        } else {
          triggerDebouncedSave({ blocks: next });
        }
        return next;
      });
    },
    [performSave, triggerDebouncedSave]
  );

  const recordHistorySnapshot = useCallback(() => {
    setPastBlocks((p) => [
      ...p.slice(-25),
      JSON.parse(JSON.stringify(blocksRef.current)),
    ]);
    setFutureBlocks([]);
  }, []);

  const handleDeleteBlock = useCallback(
    (id) => {
      setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
      setFutureBlocks([]);
      let focusTarget = null;
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        const next = prev.filter((b) => b.id !== id);
        const safeNext = next.length > 0 ? next : [createBlock("text", "")];
        const targetIdx = Math.max(0, Math.min(idx > 0 ? idx - 1 : 0, safeNext.length - 1));
        focusTarget = safeNext[targetIdx];
        performSave({ blocks: safeNext });
        return safeNext;
      });
      if (focusTarget) {
        setSelectedId(focusTarget.id);
        requestAnimationFrame(() => {
          focusBlock(focusTarget, "end");
        });
      }
    },
    [performSave, focusBlock]
  );

  const handleDuplicateBlock = useCallback(
    (id) => {
      setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
      setFutureBlocks([]);
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx === -1) return prev;
        const orig = prev[idx];
        const copy = {
          ...JSON.parse(JSON.stringify(orig)),
          id: Math.random().toString(36).slice(2, 10),
        };
        const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
        performSave({ blocks: next });
        return next;
      });
    },
    [performSave]
  );

  const handleMoveBlock = useCallback(
    (fromIndex, toIndex) => {
      setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
      setFutureBlocks([]);
      setBlocks((prev) => {
        if (toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        performSave({ blocks: next });
        return next;
      });
    },
    [performSave]
  );

  const handleAddAfter = useCallback((afterId, content = "", typeToInherit = null, extraProps = {}) => {
    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
    setFutureBlocks([]);
    
    const currentBlock = blocksRef.current.find((b) => b.id === afterId);
    let newType = "text";
    if (typeToInherit) {
      newType = typeToInherit;
    } else {
      if (currentBlock && ["bullet", "number", "todo", "toggle"].includes(currentBlock.type)) {
        newType = currentBlock.type;
      }
    }

    const defaultExtra = {};
    if (newType === "bullet" && currentBlock && currentBlock.type === "bullet" && (currentBlock.level || 0) > 0) {
      defaultExtra.level = currentBlock.level;
    }

    const count = extraProps?.columnCount || 2;
    const extra =
      newType === "columns"
        ? { columnCount: count, columnsData: extraProps?.columnsData || getNormalizedColumnsData(null, "", count) }
        : { ...defaultExtra, ...(extraProps || {}) };
    const newBlock = createBlock(newType, content, extra);
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      triggerDebouncedSave({ blocks: next });
      return next;
    });
    setSelectedId(newBlock.id);
    requestAnimationFrame(() => {
      setTimeout(() => {
        focusBlock(newBlock, "start");
      }, 30);
    });
  }, [focusBlock, triggerDebouncedSave]);

  const handleExitDown = useCallback(
    (blockId) => {
      const idx = blocksRef.current.findIndex((b) => b.id === blockId);
      if (idx === -1) return false;
      if (idx < blocksRef.current.length - 1) {
        const nextBlock = blocksRef.current[idx + 1];
        focusBlock(nextBlock, "start");
        return true;
      }
      return false;
    },
    [focusBlock]
  );

  const handleExitUp = useCallback(
    (blockId) => {
      const idx = blocksRef.current.findIndex((b) => b.id === blockId);
      if (idx === -1) return;
      if (idx > 0) {
        const prevBlock = blocksRef.current[idx - 1];
        focusBlock(prevBlock, "end");
      } else if (idx === 0) {
        // Exiting UP from Block 0 -> Focus Note Title input!
        if (noteTitleInputRef.current) {
          noteTitleInputRef.current.focus();
          const len = noteTitleInputRef.current.value?.length || 0;
          noteTitleInputRef.current.setSelectionRange(len, len);
        }
      }
    },
    [focusBlock]
  );

  // Smart Markdown, Google Docs HTML & Plain Text Paste Handler
  const handleSmartPaste = useCallback(
    (e) => {
      const targetTag = e.target?.tagName;
      if (targetTag === "TEXTAREA" || targetTag === "INPUT") return;

      const html = e.clipboardData?.getData("text/html");
      const text = e.clipboardData?.getData("text/plain") || "";
      if (!html && !text) return;

      // 1. Check if clipboard contains structured/rich HTML (from Google Docs, Web pages, etc.)
      let parsedBlocks = [];
      const hasRichHtml =
        html &&
        (/<(h[1-6]|ul|ol|table|blockquote|pre|details|b\b|strong\b|i\b|em\b|mark\b|a\s+href|iframe|video)/i.test(html) ||
          html.includes("docs-internal-guid"));

      if (hasRichHtml) {
        parsedBlocks = parseHtmlToBlocks(html);
      }

      // 2. If no structured HTML parsed, check if plain text is markdown or multi-line TSV
      if (parsedBlocks.length === 0 && text) {
        const isMarkdown =
          text.includes("\n") ||
          /^(#+|-|\*|\d+\.|>|```|\$\$|\[\s*\]|---)\s/m.test(text) ||
          text.includes("\t") ||
          !!getYouTubeEmbedInfo(text.trim());

        if (isMarkdown) {
          parsedBlocks = parseMarkdownToBlocks(text);
        }
      }

      if (parsedBlocks.length > 0) {
        e.preventDefault();
        setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
        setFutureBlocks([]);
        setBlocks((prev) => {
          const activeIdx = prev.findIndex((b) => b.id === selectedId);
          let next;
          if (activeIdx !== -1) {
            const activeBlock = prev[activeIdx];
            const el = blockRefs.current[activeBlock.id]?.current;
            const sel = window.getSelection();
            let textBefore = "";
            let textAfter = "";
            if (el && sel && sel.rangeCount > 0 && el.contains(sel.focusNode)) {
              const range = sel.getRangeAt(0);
              textBefore = getSerializedTextFromRange(el, range.startContainer, range.startOffset);
              const textSelected = range.collapsed
                ? ""
                : getSerializedTextFromRange(el, range.endContainer, range.endOffset).slice(textBefore.length);
              const fullText = getBlockTextFromDOM(el);
              textAfter = fullText.slice(textBefore.length + textSelected.length);
            }

            const blocksToInsert = parsedBlocks.map((b) => ({ ...b }));
            if (activeBlock && ["bullet", "number", "todo"].includes(activeBlock.type)) {
              if (blocksToInsert.length > 0 && blocksToInsert[0].type === "text") {
                blocksToInsert[0].type = activeBlock.type;
                if (activeBlock.level !== undefined) blocksToInsert[0].level = activeBlock.level;
                if (activeBlock.type === "todo") blocksToInsert[0].checked = activeBlock.checked || false;
              }
            }
            if (textBefore && blocksToInsert.length > 0) {
              blocksToInsert[0].content = (textBefore + (blocksToInsert[0].content || ""));
            }
            if (textAfter && blocksToInsert.length > 0) {
              const lastIdx = blocksToInsert.length - 1;
              blocksToInsert[lastIdx].content = ((blocksToInsert[lastIdx].content || "") + textAfter);
            }

            next = [...prev];
            next.splice(activeIdx, 1, ...blocksToInsert);
            const lastInserted = blocksToInsert[blocksToInsert.length - 1];
            if (lastInserted) {
              focusBlock(lastInserted, "end");
            }
          } else {
            next = [...prev, ...parsedBlocks];
            const lastInserted = parsedBlocks[parsedBlocks.length - 1];
            if (lastInserted) {
              focusBlock(lastInserted, "end");
            }
          }
          triggerDebouncedSave({ blocks: next });
          return next;
        });
        return;
      }

      // If pasting single-line or non-multiline text, compile inline markdown safely into DOM
      if (e.target?.isContentEditable) {
        e.preventDefault();
        const activeBlockEl = e.target.closest("[contenteditable]");
        if (activeBlockEl) {
          const blockContainer = activeBlockEl.closest("[data-block-id]");
          const blockId = blockContainer?.getAttribute("data-block-id");
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const { textBefore, textAfter } = splitBlockDOMAtRange(activeBlockEl, range);
            const fullText = (textBefore || "") + text + (textAfter || "");
            const block = blocksRef.current?.find((b) => b.id === blockId);
            const bType = block?.type || "text";

            setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
            setFutureBlocks([]);

            // Format DOM immediately with inline markdown (handles bold, italic, code, math)
            setBlockDOMFromText(activeBlockEl, fullText, bType);
            const targetOffset = (textBefore || "").length + text.length;
            setCaretAtOffset(activeBlockEl, targetOffset);

            if (blockId) {
              handleChange(blockId, fullText);
              setBlocks((prev) => {
                const next = prev.map((b) => (b.id === blockId ? { ...b, content: fullText } : b));
                triggerDebouncedSave({ blocks: next });
                return next;
              });
            }
          }
        }
      }
    },
    [selectedId, handleChange, focusBlock, triggerDebouncedSave]
  );

  const headings = useMemo(() => {
    return (blocks || []).filter((b) => ["h1", "h2", "h3", "h4"].includes(b.type));
  }, [blocks]);

  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [isOutlinePinned, setIsOutlinePinned] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState(null);
  const outlineTimeoutRef = useRef(null);

  const handleOutlineMouseEnter = useCallback(() => {
    if (outlineTimeoutRef.current) {
      clearTimeout(outlineTimeoutRef.current);
      outlineTimeoutRef.current = null;
    }
    setIsOutlineOpen(true);
  }, []);

  const handleOutlineMouseLeave = useCallback(() => {
    if (isOutlinePinned) return;
    if (outlineTimeoutRef.current) {
      clearTimeout(outlineTimeoutRef.current);
    }
    outlineTimeoutRef.current = setTimeout(() => {
      setIsOutlineOpen(false);
    }, 280);
  }, [isOutlinePinned]);

  const handleSelectHeading = useCallback((targetId) => {
    if (!targetId) return;
    setSelectedId(targetId);
    setActiveHeadingId(targetId);
    const targetRef = blockRefs.current[targetId];
    const el = targetRef?.current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
      const blockContainer = el.closest("[data-block-id]");
      if (blockContainer) {
        blockContainer.classList.add("ring-2", "ring-duck-400", "bg-duck-500/10");
        setTimeout(() => {
          blockContainer.classList.remove("ring-2", "ring-duck-400", "bg-duck-500/10");
        }, 1200);
      }
    }
  }, []);

  useEffect(() => {
    if (headings.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    let ticking = false;
    let rafId = null;

    const checkScrollPosition = () => {
      let currentActive = null;
      for (const h of headings) {
        const el = blockRefs.current[h.id]?.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) {
            currentActive = h.id;
          }
        }
      }
      if (currentActive) {
        setActiveHeadingId((prev) => (prev !== currentActive ? currentActive : prev));
      } else if (headings.length > 0) {
        setActiveHeadingId((prev) => (prev !== headings[0].id ? headings[0].id : prev));
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(checkScrollPosition);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    const scrollParent = editorContainerRef.current?.closest("main");
    if (scrollParent) {
      scrollParent.addEventListener("scroll", handleScroll, { passive: true });
    }
    checkScrollPosition();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      if (scrollParent) {
        scrollParent.removeEventListener("scroll", handleScroll);
      }
    };
  }, [headings]);

  const handleIntelligentReformat = useCallback(async () => {
    if (isReformatting) return;

    const currentBlocks = blocksRef.current || [];
    const hasContent = currentBlocks.some(
      (b) => (b.content && b.content.trim().length > 0) || (b.details && b.details.trim().length > 0)
    );

    if (!hasContent && !title.trim()) {
      setReformatToast({ message: "Note is empty — write some notes first!", type: "error" });
      setTimeout(() => setReformatToast(null), 3500);
      return;
    }

    setIsReformatting(true);
    setReformatProgress(null);
    setReformatToast(null);

    try {
      setPastBlocks((p) => [...p.slice(-30), currentBlocks]);
      setFutureBlocks([]);

      const res = await reformatNoteContent({
        title,
        blocks: currentBlocks,
        onProgress: (prog) => {
          setReformatProgress(prog);
        },
      });

      if (res?.reformatted) {
        const { title: newTitle, emoji: newEmoji, blocks: newBlocks } = res.reformatted;

        if (newBlocks && newBlocks.length > 0) {
          setBlocks(newBlocks);
        }
        if (newTitle) {
          setTitle(newTitle);
        }
        if (newEmoji && !emoji) {
          setEmoji(newEmoji);
        }

        const effectiveTitle = newTitle || title;
        const effectiveEmoji = emoji || newEmoji || null;
        const effectiveBlocks = newBlocks && newBlocks.length > 0 ? newBlocks : currentBlocks;

        performSave({
          title: effectiveTitle,
          blocks: effectiveBlocks,
          emoji: effectiveEmoji,
        });

        setReformatToast({
          message: res.isHeuristic
            ? "✨ Note structured & reformatted! (Ctrl+Z to undo)"
            : "✨ AI reformatted note into structured blocks! (Ctrl+Z to undo)",
          type: "success",
        });
        setTimeout(() => setReformatToast(null), 4000);
      }
    } catch (err) {
      console.error("Failed to reformat note:", err);
      setReformatToast({
        message: err?.message || "Failed to reformat note.",
        type: "error",
      });
      setTimeout(() => setReformatToast(null), 4000);
    } finally {
      setIsReformatting(false);
      setReformatProgress(null);
    }
  }, [isReformatting, title, emoji, performSave]);

  useEffect(() => {
    onRegisterReformat?.(handleIntelligentReformat);
  }, [handleIntelligentReformat, onRegisterReformat]);

  useEffect(() => {
    onReformatStateChange?.({ isReformatting, progress: reformatProgress });
  }, [isReformatting, reformatProgress, onReformatStateChange]);


  const handleKeyDown = useCallback(

    (e, blockId) => {
      if (selectedBlockIdsRef.current?.size > 0) {
        setSelectedBlockIds(new Set());
      }
      if (e.key === "Backspace") {
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;
        const idx = blocks.findIndex((b) => b.id === blockId);

        // Check if caret is at the start (offset 0) of the current block
        const el = blockRefs.current[blockId]?.current;
        let isAtStart = false;
        if (el) {
          isAtStart = isCaretAtLogicalStart(el);
          if (!isAtStart) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && sel.focusNode) {
              const range = sel.getRangeAt(0);
              if (range.collapsed) {
                const split = splitBlockDOMAtRange(el, range);
                if (cleanZeroWidth(split.textBefore).length === 0) {
                  isAtStart = true;
                }
              }
            }
          }
        } else if (!block.content || cleanZeroWidth(block.content) === "") {
          isAtStart = true;
        }

        // 1. UN-LIST / UN-FORMAT:
        // If current block is a list or formatted type (bullet, number, todo, toggle, heading, quote, callout)
        // AND (caret is at offset 0 OR the block content is empty):
        // Convert block to a plain "text" paragraph first without deleting or merging!
        if (block.type !== "text" && (isAtStart || block.content === "")) {
          if (block.type === "bullet" && (block.level || 0) > 0) {
            e.preventDefault();
            handleUpdateBlock(blockId, { level: (block.level || 0) - 1 }, false, true);
            return;
          }
          e.preventDefault();
          handleChangeType(blockId, "text", "start");
          const focusStart = () => {
            const targetEl = blockRefs.current[blockId]?.current;
            if (targetEl) {
              setCaretToStart(targetEl);
            }
          };
          requestAnimationFrame(focusStart);
          setTimeout(focusStart, 10);
          return;
        }

        // 2. EMPTY PLAIN TEXT BLOCK DELETION:
        // When Backspace is pressed on an empty plain text line, delete the empty line itself
        // and cleanly place the caret at the end of the block above (never deleting the block above)!
        const currentDOMText = el ? getBlockTextFromDOM(el) : "";
        if (block.type === "text" && (block.content === "" || currentDOMText === "")) {
          if (blocks.length > 1) {
            e.preventDefault();
            const prevBlock = idx > 0 ? blocks[idx - 1] : (blocks[1] || null);
            
            setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
            setFutureBlocks([]);
            setBlocks((prev) => {
              const next = prev.filter((b) => b.id !== blockId);
              triggerDebouncedSave({ blocks: next });
              return next;
            });

            if (prevBlock) {
              focusBlock(prevBlock, idx > 0 ? "end" : "start");
              requestAnimationFrame(() => {
                focusBlock(prevBlock, idx > 0 ? "end" : "start");
              });
            }
            return;
          } else {
            // Single remaining block in note: keep it as empty text and focus start
            e.preventDefault();
            focusBlock(blockId, "start");
            return;
          }
        }

        // 3. MERGE PLAIN TEXT BLOCK OR STEP INTO PREVIOUS SPECIAL BLOCK (at offset 0, idx > 0):
        if (el && isAtStart && idx > 0 && block.type === "text") {
          const prevBlock = blocks[idx - 1];
          const mergeableTypes = ["text", "h1", "h2", "h3", "h4", "bullet", "number", "todo", "quote", "callout"];
          if (mergeableTypes.includes(prevBlock.type)) {
            e.preventDefault();
            const prevContent = prevBlock.content || "";
            const currentContent = block.content || "";
            const mergedContent = prevContent + currentContent;

            setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
            setFutureBlocks([]);

            // Measure DOM text length before merge to avoid markdown syntax offset overshooting
            const prevEl = blockRefs.current[prevBlock.id]?.current;
            const domCaretOffset = prevEl ? getDOMCaretLength(prevEl) : prevContent.length;

            // Synchronously update DOM of target element so caret placement is rock-solid and not wiped by re-render
            const targetEl = blockRefs.current[prevBlock.id]?.current;
            if (targetEl) {
              setBlockDOMFromText(targetEl, mergedContent, prevBlock.type);
              setCaretAtOffset(targetEl, domCaretOffset);
            }

            setBlocks((prev) => {
              const next = prev.filter((b) => b.id !== blockId);
              const targetIdx = next.findIndex((b) => b.id === prevBlock.id);
              if (targetIdx !== -1) {
                next[targetIdx] = { ...next[targetIdx], content: mergedContent };
              }
              triggerDebouncedSave({ blocks: next });
              return next;
            });

            setSelectedId(prevBlock.id);
            const focusJoin = () => {
              const targetElRef = blockRefs.current[prevBlock.id]?.current;
              if (targetElRef) {
                setCaretAtOffset(targetElRef, domCaretOffset);
              }
            };
            requestAnimationFrame(focusJoin);
            setTimeout(focusJoin, 10);
            setTimeout(focusJoin, 35);
            return;
          } else {
            // Previous block is a special non-mergeable block (code, table, math, columns, divider, site, media, canvas):
            // Step into the previous block at the end without deleting it!
            e.preventDefault();
            focusBlock(prevBlock, "end");
            return;
          }
        }

      } else if (e.key === "Delete") {
        // Notion-style Forward Deletion & Merging:
        // When Delete is pressed at the end of a block:
        const standaloneEmbedTypes = ["divider", "site", "media"];
        const complexCardTypes = ["code", "math", "table", "columns"];
        const mergeableTypes = ["text", "h1", "h2", "h3", "h4", "bullet", "number", "todo", "quote", "callout"];
        const el = blockRefs.current[blockId]?.current;
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && sel.focusNode) {
            const range = sel.getRangeAt(0);
            if (range.collapsed) {
              const textBefore = getSerializedTextFromRange(el, range.startContainer, range.startOffset);
              const fullText = getBlockTextFromDOM(el);
              const textAfter = fullText.slice(textBefore.length);
              
              if (textAfter.length === 0) {
                const idx = blocks.findIndex((b) => b.id === blockId);
                if (idx !== -1 && idx < blocks.length - 1) {
                  const targetBlock = blocks[idx + 1];
                  // 1. Standalone embed block (divider, site, media, canvas): delete it!
                  if (standaloneEmbedTypes.includes(targetBlock?.type)) {
                    e.preventDefault();
                    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
                    setFutureBlocks([]);
                    setBlocks((prev) => {
                      const next = prev.filter((b) => b.id !== targetBlock.id);
                      triggerDebouncedSave({ blocks: next });
                      return next;
                    });
                    return;
                  }
                  // 2. Empty text block: delete it!
                  if (targetBlock?.type === "text" && (!targetBlock.content || targetBlock.content.trim() === "")) {
                    e.preventDefault();
                    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
                    setFutureBlocks([]);
                    setBlocks((prev) => {
                      const next = prev.filter((b) => b.id !== targetBlock.id);
                      triggerDebouncedSave({ blocks: next });
                      return next;
                    });
                    return;
                  }
                  // 3. Mergeable text block: pull and merge it into current block!
                  if (mergeableTypes.includes(targetBlock?.type)) {
                    e.preventDefault();
                    const currentContent = block.content || "";
                    const nextContent = targetBlock.content || "";
                    const mergedContent = currentContent + nextContent;

                    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
                    setFutureBlocks([]);

                    const domCaretOffset = getDOMCaretLength(el);

                    setBlockDOMFromText(el, mergedContent, block.type);
                    setCaretAtOffset(el, domCaretOffset);

                    setBlocks((prev) => {
                      const next = prev.filter((b) => b.id !== targetBlock.id);
                      const targetIdx = next.findIndex((b) => b.id === blockId);
                      if (targetIdx !== -1) {
                        next[targetIdx] = { ...next[targetIdx], content: mergedContent };
                      }
                      triggerDebouncedSave({ blocks: next });
                      return next;
                    });

                    requestAnimationFrame(() => {
                      const targetEl = blockRefs.current[blockId]?.current;
                      if (targetEl) setCaretAtOffset(targetEl, domCaretOffset);
                    });
                    return;
                  }
                  // 4. Complex block (code, math, table, columns): step into it!
                  if (complexCardTypes.includes(targetBlock?.type)) {
                    e.preventDefault();
                    focusBlock(targetBlock, "start");
                    return;
                  }
                }
              }
            }
          }
        }

      } else if (e.key === "ArrowUp") {
        if (e.altKey) {
          e.preventDefault();
          const idx = blocks.findIndex((b) => b.id === blockId);
          if (idx > 0) {
            focusBlock(blocks[idx - 1], "end");
          }
          return;
        }

        const el = blockRefs.current[blockId]?.current;
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (isCaretOnFirstVisualLine(el, range)) {
              e.preventDefault();
              handleExitUp(blockId);
            }
          }
        }
      } else if (e.key === "ArrowDown") {
        if (e.altKey) {
          e.preventDefault();
          const idx = blocks.findIndex((b) => b.id === blockId);
          if (idx < blocks.length - 1) {
            focusBlock(blocks[idx + 1], "start");
          }
          return;
        }

        const el = blockRefs.current[blockId]?.current;
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (isCaretOnLastVisualLine(el, range)) {
              // BUG-TOG-01: If this is an open toggle block, step down into its details textarea!
              const currentBlock = blocks.find((b) => b.id === blockId);
              if (currentBlock?.type === "toggle" && currentBlock.open !== false) {
                const detailsEl = document.getElementById(`toggle_details_${blockId}`);
                if (detailsEl) {
                  e.preventDefault();
                  detailsEl.focus();
                  detailsEl.setSelectionRange(0, 0);
                  return;
                }
              }

              const idx = blocks.findIndex((b) => b.id === blockId);
              if (idx < blocks.length - 1) {
                e.preventDefault();
                handleExitDown(blockId);
              }
            }
          }
        }
      } else if (e.key === "ArrowLeft") {
        const el = blockRefs.current[blockId]?.current;
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            if (isCaretAtBlockStart(el, range)) {
              e.preventDefault();
              handleExitUp(blockId);
            }
          }
        }
      } else if (e.key === "ArrowRight") {
        const el = blockRefs.current[blockId]?.current;
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            if (isCaretAtBlockEnd(el, range)) {
              const idx = blocks.findIndex((b) => b.id === blockId);
              if (idx < blocks.length - 1) {
                e.preventDefault();
                const nextBlock = blocks[idx + 1];
                focusBlock(nextBlock, "start");
              }
            }
          }
        }
      }
    },
    [blocks, handleChangeType, handleExitDown, handleExitUp, focusBlock, triggerDebouncedSave]
  );

  const activeBannerPreset = BANNER_PRESETS.find((b) => b.id === banner);

  // Compute sequential numbered list indices
  let currentNumber = 0;

  return (
    <div
      ref={editorContainerRef}
      onMouseDown={handleEditorMouseDown}
      onPaste={handleSmartPaste}
      className={`relative min-h-full w-full pb-32 transition-all ${
        NOTE_FONT_CLASSES[fontStyle] || "font-note-sans"
      }`}
    >
      {/* Floating Text Selection Popover Toolbar */}
      <TextSelectionToolbar
        editorContainerRef={editorContainerRef}
        onExplainBlock={onExplainBlock}
        onQuizBlock={onQuizBlock}
        onRecordHistory={recordHistorySnapshot}
      />

      {/* High-Performance Marquee Selection Box (Absolute in document coordinate space) */}
      {marqueeBox && (
        <div
          className="absolute z-40 pointer-events-none rounded border border-duck-400/80 bg-duck-500/15 shadow-sm transition-none select-none"
          style={{
            left: marqueeBox.left,
            top: marqueeBox.top,
            width: marqueeBox.width,
            height: marqueeBox.height,
          }}
        />
      )}
      
      {/* Subtle Lock Indicator at Top Right (under top bar) */}
      {isLocked && (
        <div className="absolute top-3 right-6 z-30 print:hidden select-none">
          <button
            type="button"
            onClick={() => {
              setIsLocked(false);
              isLockedRef.current = false;
              performSave({ isLocked: false });
              onToggleLock?.(false);
            }}
            title="Page is locked to prevent edits. Click to unlock."
            className="group/lock flex items-center justify-center p-1.5 rounded-lg border border-ink-800/70 bg-ink-900/80 text-ink-400 hover:text-amber-300 hover:border-amber-500/40 hover:bg-ink-850/90 backdrop-blur-md transition-all shadow-sm cursor-pointer"
          >
            <Lock className="h-4 w-4 text-amber-400/80 group-hover/lock:text-amber-300 transition-colors" />
          </button>
        </div>
      )}

      {/* AI Reformat Floating Progress Banner & Feedback */}
      {(isReformatting || reformatToast) && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in select-none">
          {isReformatting ? (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-ink-900/95 border border-duck-500/50 shadow-2xl backdrop-blur-md text-xs font-semibold text-duck-200 ring-4 ring-duck-400/20">
              <Sparkles className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5">
                  <span>Structuring & Reformatting Note with AI...</span>
                  <span className="inline-flex h-2 w-2 rounded-full bg-duck-400 animate-ping" />
                </span>
                {reformatProgress ? (
                  <span className="text-[10px] text-duck-300/80 font-normal">
                    {typeof reformatProgress === "string"
                      ? reformatProgress
                      : reformatProgress.message || (reformatProgress.total > 1 ? `Part ${reformatProgress.current} of ${reformatProgress.total}...` : null)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : reformatToast ? (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-2xl backdrop-blur-md text-xs font-semibold ${
                reformatToast.type === "error"
                  ? "border-rose-500/50 bg-ink-900/95 text-rose-300 ring-4 ring-rose-500/20"
                  : "border-duck-500/50 bg-ink-900/95 text-duck-200 ring-4 ring-duck-500/20"
              }`}
            >
              {reformatToast.type === "error" ? (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              ) : (
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
              )}
              <span>{reformatToast.message}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Cover Banner (when set) */}
      {banner && (
        <div
          className={`group/banner relative h-44 md:h-52 w-full border-b border-ink-800/40 shadow-lg transition-all print:hidden ${
            banner.startsWith("data:image/")
              ? ""
              : activeBannerPreset?.style || "bg-gradient-to-r from-indigo-600 to-purple-600"
          }`}
          style={
            banner.startsWith("data:image/")
              ? { backgroundImage: `url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" }
              : {}
          }
        >
          {/* Controls on banner */}
          {!isLocked && (
            <div className="absolute right-6 top-3 z-30 flex items-center gap-2 opacity-80 group-hover/banner:opacity-100 transition-opacity">
              <div className="relative" ref={bannerPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowBannerPicker(!showBannerPicker)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-ink-950/60 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition-all hover:bg-ink-950/90 hover:border-white/50"
                >
                  <span>🖼️</span>
                  <span>Change Cover</span>
                </button>

                {showBannerPicker && (
                  <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl animate-fade-in">
                    <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                      Select Cover Style
                    </p>
                    <div className="space-y-1">
                      {BANNER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setBanner(preset.id);
                            bannerRef.current = preset.id;
                            setShowBannerPicker(false);
                            performSave({ banner: preset.id });
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-200 hover:bg-ink-800"
                        >
                          <span className={`h-4 w-8 rounded ${preset.style}`} />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                      <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-200 hover:bg-ink-800">
                        <span className="h-4 w-8 rounded bg-ink-700 flex items-center justify-center text-[10px]">📁</span>
                        <span>Upload Image...</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target.result;
                              setBanner(dataUrl);
                              bannerRef.current = dataUrl;
                              setShowBannerPicker(false);
                              performSave({ banner: dataUrl });
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setBanner(null);
                          bannerRef.current = null;
                          setShowBannerPicker(false);
                          performSave({ banner: null });
                        }}
                        className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10"
                      >
                        Remove Banner
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Note Content Container */}
      <div
        data-editor-root
        className={`relative mx-auto ${fullWidth ? "w-full max-w-none px-6 md:px-12" : "max-w-3xl px-10"} ${banner ? "pt-6" : "pt-8"} pb-20 cursor-text print:px-0 print:pt-0 print:pb-0`}
        onClick={(e) => {
          if (isLocked) return;
          if (e.target === e.currentTarget && blocks.length > 0) {
            const lastBlock = blocks[blocks.length - 1];
            setSelectedId(lastBlock.id);
            const el = blockRefs.current[lastBlock.id]?.current;
            if (el) {
              el.focus();
              const range = document.createRange();
              const sel = window.getSelection();
              range.selectNodeContents(el);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }}
      >
        {/* Print-Only Clean Document Title & Icon Header */}
        <div className="hidden print:block mb-4 pt-0">
          {emoji && <div className="text-4xl mb-1 leading-none">{emoji}</div>}
          <h1 className="text-3xl font-extrabold tracking-tight text-black leading-tight break-words">
            {title || "Untitled Note"}
          </h1>
        </div>

        {/* Title Header with Progressive Disclosure Actions */}
        <div className="group/header relative mb-6 pl-8 print:hidden">
          {/* Progressive Action Hover Strip (revealed on hover) */}
          {!isLocked && (
            <div
              className={`flex items-center gap-2 mb-2 transition-all duration-200 ${
                showEmojiPicker || showBannerPicker || isReformatting
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 group-hover/header:opacity-100 pointer-events-none group-hover/header:pointer-events-auto"
              }`}
            >
              {/* Add/Change Icon button */}
              <div className="relative" ref={emojiPickerRef}>
                {!emoji ? (
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/90 px-2.5 py-1 text-xs font-semibold text-ink-300 shadow-sm backdrop-blur-md transition-all hover:border-duck-500/40 hover:text-duck-300 cursor-pointer"
                  >
                    <span>😀</span>
                    <span>Add Icon</span>
                  </button>
                ) : null}

                {showEmojiPicker && (
                  <div className="absolute left-0 top-9 z-50 w-64 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl space-y-1.5 animate-fade-in">
                    <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                      Select Note Icon
                    </p>
                    <div className="grid grid-cols-6 gap-1 p-1 max-h-48 overflow-y-auto">
                      {NOTE_EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => {
                            setEmoji(e);
                            emojiRef.current = e;
                            setShowEmojiPicker(false);
                            performSave({ emoji: e });
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-ink-800 cursor-pointer"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    {emoji && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmoji(null);
                          emojiRef.current = null;
                          setShowEmojiPicker(false);
                          performSave({ emoji: null });
                        }}
                        className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        Remove Icon
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Add Cover Button (when no banner exists) */}
              {!banner && (
                <div className="relative" ref={bannerPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowBannerPicker(!showBannerPicker)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/90 px-2.5 py-1 text-xs font-semibold text-ink-300 shadow-sm backdrop-blur-md transition-all hover:border-duck-500/40 hover:text-duck-300 cursor-pointer"
                  >
                    <span>🖼️</span>
                    <span>Add Cover</span>
                  </button>

                  {showBannerPicker && (
                    <div className="absolute left-0 top-9 z-50 w-64 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl animate-fade-in">
                      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        Select Cover Style
                      </p>
                      <div className="space-y-1">
                        {BANNER_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setBanner(preset.id);
                              bannerRef.current = preset.id;
                              setShowBannerPicker(false);
                              performSave({ banner: preset.id });
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-200 hover:bg-ink-800 cursor-pointer"
                          >
                            <span className={`h-4 w-8 rounded ${preset.style}`} />
                            <span>{preset.label}</span>
                          </button>
                        ))}
                        <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-200 hover:bg-ink-800">
                          <span className="h-4 w-8 rounded bg-ink-700 flex items-center justify-center text-[10px]">📁</span>
                          <span>Upload Image...</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const dataUrl = ev.target.result;
                                setBanner(dataUrl);
                                bannerRef.current = dataUrl;
                                setShowBannerPicker(false);
                                performSave({ banner: dataUrl });
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Large Notion Note Icon (when set) */}
          {emoji && (
            <div className="mb-2 inline-block relative">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && setShowEmojiPicker(!showEmojiPicker)}
                className={`text-5xl leading-none transition-transform select-none ${
                  isLocked ? "cursor-default" : "hover:scale-105 cursor-pointer"
                }`}
                title={isLocked ? "Note icon" : "Change Icon"}
              >
                {emoji}
              </button>
            </div>
          )}
          <input
            ref={noteTitleInputRef}
            type="text"
            readOnly={isLocked}
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (blocks.length > 0) {
                  focusBlock(blocks[0], "start");
                }
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (blocks.length > 0) {
                  focusBlock(blocks[0], "start");
                }
              } else if (e.key === "ArrowRight") {
                const len = e.target.value?.length || 0;
                if (e.target.selectionStart === len && blocks.length > 0) {
                  e.preventDefault();
                  focusBlock(blocks[0], "start");
                }
              }
            }}
            placeholder="Untitled Note"
            className={`w-full border-b border-ink-800/80 bg-transparent pt-1 pb-3 leading-snug text-4xl font-extrabold tracking-tight text-ink-100 placeholder:text-ink-700 focus:border-duck-500/50 focus:outline-none min-h-[3.5rem] ${
              isLocked ? "cursor-default select-text" : ""
            }`}
          />
        </div>

        {/* Notion Blocks */}
        <div className="space-y-2 pl-8">
          {blocks.map((block, index) => {
            if (block.type === "number") {
              currentNumber += 1;
            } else {
              currentNumber = 0;
            }

            return (
              <EditorBlock
                key={block.id}
                block={block}
                index={index}
                totalBlocks={blocks.length}
                blockNumber={currentNumber}
                isLast={index === blocks.length - 1}
                isSelected={selectedId === block.id}
                onSelect={setSelectedId}
                setSelectedBlockIds={setSelectedBlockIds}
                selectedBlockIds={selectedBlockIds}
                onChange={handleChange}
                onChangeType={handleChangeType}
                onUpdateBlock={handleUpdateBlock}
                onDelete={handleDeleteBlock}
                onDuplicate={() => handleDuplicateBlock(block.id)}
                onMoveUp={() => handleMoveBlock(index, index - 1)}
                onMoveDown={() => handleMoveBlock(index, index + 1)}
                onKeyDown={handleKeyDown}
                onAddAfter={handleAddAfter}
                onExplainBlock={onExplainBlock}
                onQuizBlock={onQuizBlock}
                onTriggerSocratic={onTriggerSocratic}
                onSwitchTab={onSwitchTab}
                dragHandlers={dragHandlers}
                isDragTarget={dragOver === block.id && dragging !== block.id}
                isMultiSelected={selectedBlockIds.has(block.id)}
                isLocked={isLocked}
                allBlocks={blocks}
                onSelectHeading={handleSelectHeading}
                notesBySpace={notesBySpace}
                onSelectNote={onSelectNote}
                registerRef={registerRef}
                onSaveNote={() => performSave()}
                onExitDown={handleExitDown}
                onExitUp={handleExitUp}
              />
            );
          })}
        </div>
      </div>

      {/* Notion-Style Right-Side Outline (Minimap Ticks & Floating Card) */}
      {headings.length > 0 && (
        <aside
          aria-label="Table of Contents Outline"
          className="print:hidden fixed top-24 right-2 sm:right-3.5 z-40 flex items-start select-none pointer-events-auto"
        >
          {/* Notion Floating Outline Card (Image 1) */}
          {isOutlineOpen && (
            <div
              className="mr-2 w-64 sm:w-72 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-[#2b2e37] bg-[#16181f]/95 p-3.5 shadow-2xl backdrop-blur-2xl transition-all animate-fade-in space-y-1 select-none ring-1 ring-white/5"
              onMouseEnter={handleOutlineMouseEnter}
              onMouseLeave={handleOutlineMouseLeave}
            >
              <div className="space-y-1 pr-0.5">
                {headings.map((h) => {
                  const isActive = activeHeadingId === h.id;
                  const isH1 = h.type === "h1";
                  const indentClass =
                    h.type === "h1"
                      ? "pl-2.5 sm:pl-3"
                      : h.type === "h2"
                      ? "pl-5 sm:pl-5.5"
                      : h.type === "h3"
                      ? "pl-7 sm:pl-8"
                      : "pl-9 sm:pl-10";

                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectHeading(h.id);
                      }}
                      className={`flex w-full items-center text-left py-1.5 pr-2.5 rounded-lg text-xs leading-relaxed transition-all cursor-pointer group/outlineitem ${indentClass} ${
                        isActive
                          ? "bg-[#282b34] text-white font-medium shadow-sm ring-1 ring-white/10"
                          : isH1
                          ? "text-sky-400 font-medium hover:text-sky-300 hover:bg-ink-800/40"
                          : "text-[#9ca0ab] hover:text-white hover:bg-ink-800/40 font-normal"
                      }`}
                      title={h.content || "Untitled"}
                    >
                      <span className="truncate flex-1">
                        {h.content || <span className="italic text-ink-600">Untitled</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Right-Margin Minimap Dash Strip (Image 2) */}
          <div
            className="flex flex-col items-end gap-2.5 py-4 px-1.5 cursor-pointer group select-none"
            onClick={() => {
              setIsOutlinePinned((p) => !p);
              setIsOutlineOpen(true);
            }}
            onMouseEnter={handleOutlineMouseEnter}
            onMouseLeave={handleOutlineMouseLeave}
            title={isOutlinePinned ? "Outline pinned (click to unpin)" : "Hover to view outline, click to pin"}
          >
            {headings.map((h) => {
              const isActive = activeHeadingId === h.id;
              const barWidth =
                h.type === "h1"
                  ? "w-5"
                  : h.type === "h2"
                  ? "w-4"
                  : h.type === "h3"
                  ? "w-3"
                  : "w-2";

              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectHeading(h.id);
                  }}
                  className={`h-[2px] rounded-full transition-all duration-200 cursor-pointer p-0 border-0 ${barWidth} ${
                    isActive
                      ? "bg-white h-[2.5px] shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                      : "bg-[#4e515d] hover:bg-white hover:h-[2.5px] group-hover:bg-[#828698]"
                  }`}
                  title={h.content || "Untitled"}
                />
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
}
