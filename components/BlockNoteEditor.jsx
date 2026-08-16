"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  CORE_LANGUAGES,
  normalizeLanguage,
  TOKEN_STYLES,
  tokenizeCode,
} from "@/lib/syntaxHighlighter";

// ─── BlockNoteEditor ────────────────────────────────────────────────
// Full Notion-style block suite:
//   • Headings 1–4 (h1, h2, h3, h4)
//   • Bullet List, Numbered List, To-Do List (checkboxes), Toggle List
//   • Callout Box with icon picker (💡, ⚠️, 📌, 🔥, ⭐, 🎉, ℹ️, 🦆)
//   • Quote (accent bar), Divider (hr), Note Link (workspace note picker)
//   • Media Embeds (Image / Audio / Video) & Clickable Site Bookmark Embeds
//   • Math Equation Container (LaTeX & KaTeX renderer)
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
  { type: "quote", label: "Quote", icon: "“", description: "Capture quotes & citations" },
  { type: "math", label: "Math Equation", icon: "∑", description: "LaTeX formula block & KaTeX renderer" },
  { type: "inlinemath", label: "Inline Equation", icon: "ƒ(x)", description: "Insert inline LaTeX formula ($x$)" },
  { type: "divider", label: "Divider", icon: "―", description: "Visual horizontal line" },
  { type: "site", label: "Site Bookmark Embed", icon: "🌐", description: "Clickable website card" },
  { type: "media", label: "Image / Audio / Video", icon: "🖼️", description: "Embed media file or URL" },
  { type: "code", label: "Code Snippet", icon: "</>", description: "Code block with syntax" },
  { type: "canvas", label: "Canvas / Drawing", icon: "🎨", description: "Interactive 70% whiteboard & sketching tool" },
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
    case "bullet":
      return `- ${content}`;
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
      return `💡 ${content}`;
    case "divider":
      return `---`;
    case "code":
      return `\`\`\`${block.meta?.language || ""}\n${content}\n\`\`\``;
    case "math":
      return `$$\n${content}\n$$`;
    case "canvas":
      return `[Canvas Drawing: ${content}]`;
    case "text":
    default:
      return content;
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
        resultBlocks.push(
          createBlock("code", codeBuffer.join("\n"), { meta: { language: codeLang } })
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

    if (trimmed.startsWith("$$")) {
      if (!inMathBlock) {
        inMathBlock = true;
        const rest = trimmed.slice(2).trim();
        mathBuffer = rest ? [rest] : [];
      } else {
        inMathBlock = false;
        resultBlocks.push(createBlock("math", mathBuffer.join("\n")));
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
      resultBlocks.push(createBlock("h4", line.slice(5)));
    } else if (line.startsWith("### ")) {
      resultBlocks.push(createBlock("h3", line.slice(4)));
    } else if (line.startsWith("## ")) {
      resultBlocks.push(createBlock("h2", line.slice(3)));
    } else if (line.startsWith("# ")) {
      resultBlocks.push(createBlock("h1", line.slice(2)));
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      resultBlocks.push(createBlock("bullet", line.slice(2)));
    } else if (/^\d+\.\s/.test(line)) {
      resultBlocks.push(createBlock("number", line.replace(/^\d+\.\s/, "")));
    } else if (line.startsWith("[ ] ") || line.startsWith("[] ")) {
      resultBlocks.push(createBlock("todo", line.slice(line.indexOf("]") + 1).trim(), { checked: false }));
    } else if (line.startsWith("[x] ") || line.startsWith("[X] ")) {
      resultBlocks.push(createBlock("todo", line.slice(line.indexOf("]") + 1).trim(), { checked: true }));
    } else if (line.startsWith("> ")) {
      resultBlocks.push(createBlock("quote", line.slice(2)));
    } else if (line.startsWith("💡 ") || line.startsWith(">! ")) {
      resultBlocks.push(createBlock("callout", line.slice(3)));
    } else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      resultBlocks.push(createBlock("divider", ""));
    } else if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 2) {
      resultBlocks.push(createBlock("math", trimmed.slice(2, -2).trim()));
    } else {
      resultBlocks.push(createBlock("text", line));
    }
  }

  if (codeBuffer.length > 0) {
    resultBlocks.push(createBlock("code", codeBuffer.join("\n"), { meta: { language: codeLang } }));
  }
  if (mathBuffer.length > 0) {
    resultBlocks.push(createBlock("math", mathBuffer.join("\n")));
  }

  return resultBlocks.length > 0 ? resultBlocks : [createBlock("text", rawText)];
}

// ─── Slash-Command Menu ─────────────────────────────────────────────
function SlashMenu({ onSelect, onClose, filter }) {
  const menuRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = BLOCK_TYPES.filter((bt) => {
    const q = filter.toLowerCase();
    return (
      bt.label.toLowerCase().includes(q) ||
      bt.type.toLowerCase().includes(q) ||
      (bt.type === "math" && ["math", "equation", "latex", "formula"].some((k) => k.includes(q))) ||
      (bt.type === "inlinemath" && ["inline", "inlinemath", "equation", "latex", "formula", "katex", "fx", "math"].some((k) => k.includes(q)))
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
        if (filtered[activeIdx]) onSelect(filtered[activeIdx].type);
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
          <li key={bt.type}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(bt.type);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
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
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [onClose]);

  const blockText = (block.content || block.formula || block.details || "").trim();

  const handleCopy = () => {
    if (!blockText) return;
    navigator.clipboard?.writeText(blockText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      ref={menuRef}
      className="absolute -left-2 top-full z-[100] mt-1 w-72 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl animate-fade-in p-2.5 text-xs space-y-2"
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

      {/* Formatting Toolbar */}
      <div className="flex items-center justify-around rounded-lg border border-ink-800 bg-ink-850 p-1">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat?.("bold");
          }}
          className="rounded px-2.5 py-1 font-bold text-ink-200 hover:bg-ink-800 hover:text-ink-100 transition-colors"
          title="Bold (Selection or whole block)"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat?.("italic");
          }}
          className="rounded px-2.5 py-1 italic text-ink-200 hover:bg-ink-800 hover:text-ink-100 transition-colors"
          title="Italic (Selection or whole block)"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat?.("underline");
          }}
          className="rounded px-2.5 py-1 underline text-ink-200 hover:bg-ink-800 hover:text-ink-100 transition-colors"
          title="Underline (Selection or whole block)"
        >
          U
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat?.("strikethrough");
          }}
          className="rounded px-2.5 py-1 line-through text-ink-200 hover:bg-ink-800 hover:text-ink-100 transition-colors"
          title="Strikethrough (Selection or whole block)"
        >
          S
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat?.("math");
          }}
          className="rounded px-2 py-1 font-mono text-xs font-bold text-duck-300 hover:bg-ink-800 transition-colors"
          title="Inline Math ($formula$)"
        >
          $x$
        </button>
      </div>

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

// ─── KaTeX LRU Memoization Cache ─────────────────────────────────────
const KATEX_STRING_CACHE = new Map();
export function renderKatexToStringMemoized(formula, options = {}) {
  const key = `${formula}::${Boolean(options.displayMode)}`;
  if (KATEX_STRING_CACHE.has(key)) return KATEX_STRING_CACHE.get(key);
  try {
    const html = katex.renderToString(formula || "", {
      displayMode: Boolean(options.displayMode),
      throwOnError: false,
      ...options,
    });
    if (KATEX_STRING_CACHE.size > 500) {
      KATEX_STRING_CACHE.delete(KATEX_STRING_CACHE.keys().next().value);
    }
    KATEX_STRING_CACHE.set(key, html);
    return html;
  } catch {
    return escapeHtml(formula || "");
  }
}

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

// ─── Inline Equation Utilities & Popover ─────────────────────────────
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTextWithKaTeX(text) {
  if (!text) return "";
  if (!text.includes("$")) return escapeHtml(text);

  const parts = [];
  const regex = /\$([^$]+)\$/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    }
    const formula = match[1];
    try {
      const katexHtml = renderKatexToStringMemoized(formula, {
        displayMode: false,
        throwOnError: false,
      });
      const escapedFormula = formula.replace(/"/g, "&quot;");
      parts.push(
        `<span class="katex-inline-node inline-flex items-center mx-1 px-2 py-0.5 rounded-md border border-duck-500/40 bg-duck-500/10 hover:bg-duck-500/25 hover:border-duck-400 text-duck-200 font-semibold cursor-pointer transition-all select-none group/mathpill" data-formula="${escapedFormula}" contenteditable="false">${katexHtml}</span>`
      );
    } catch (e) {
      parts.push(escapeHtml(match[0]));
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)));
  }

  return parts.join("");
}

function setBlockDOMFromText(domNode, text) {
  if (!domNode) return;
  if (text && text.includes("$")) {
    domNode.innerHTML = formatTextWithKaTeX(text);
  } else {
    domNode.textContent = text || "";
  }
}

function getBlockTextFromDOM(domNode) {
  if (!domNode) return "";
  const clone = domNode.cloneNode(true);
  clone.querySelectorAll(".katex-inline-node").forEach((node) => {
    const formula = node.getAttribute("data-formula") || "";
    node.replaceWith(`$${formula}$`);
  });
  return clone.textContent || "";
}

function getSerializedTextFromRange(container, endContainer, endOffset) {
  if (!container || !endContainer) return "";
  try {
    const range = document.createRange();
    range.selectNodeContents(container);
    range.setEnd(endContainer, endOffset);
    const fragment = range.cloneContents();
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(fragment);
    return getBlockTextFromDOM(tempDiv);
  } catch (e) {
    return "";
  }
}

function InlineEquationPopover({
  isOpen,
  initialFormula = "",
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
      className="absolute left-0 top-full z-50 mt-1.5 w-full max-w-lg rounded-xl border border-duck-500/50 bg-ink-900/98 p-3 shadow-2xl backdrop-blur space-y-2.5 animate-fade-in text-left pointer-events-auto"
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
              className="absolute right-0 top-full mt-1.5 z-[60] w-72 rounded-xl border border-duck-500/40 bg-ink-900/98 p-2.5 shadow-2xl backdrop-blur space-y-2.5 animate-fade-in text-left pointer-events-auto"
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
          placeholder="LaTeX formula (e.g. f'(x) = 2x or \lim_{x \to 0}\frac{\sin x}{x})..."
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
function MathBlock({ block, onUpdateBlock, onSelect, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formula, setFormula] = useState(block.content ?? "");
  const textareaRef = useRef(null);

  useEffect(() => {
    setFormula(block.content ?? "");
  }, [block.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const presets = [
    { label: "Quadratic", math: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
    { label: "Euler", math: "e^{i\\pi} + 1 = 0" },
    { label: "Integral", math: "\\int_{a}^{b} f(x) dx = F(b) - F(a)" },
    { label: "Einstein", math: "E = mc^2" },
    { label: "Normal Dist", math: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}" },
    { label: "Derivative", math: "\\frac{d}{dx}\\left( \\sin(x) \\right) = \\cos(x)" },
    { label: "Matrix", math: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  ];

  const handleFormulaChange = (newVal) => {
    setFormula(newVal);
    onUpdateBlock(block.id, { content: newVal }, true);
  };

  const handleExitEdit = () => {
    if (!formula || !formula.trim()) {
      if (onDelete) {
        onDelete(block.id);
      }
    } else {
      setIsEditing(false);
    }
  };

  return (
    <div
      onClick={() => {
        onSelect(block.id);
      }}
      className="group/mathblk relative my-2 overflow-hidden rounded-xl border border-ink-700 bg-ink-900/90 p-4 transition-all hover:border-duck-500/50 shadow-md"
    >
      <div className="flex items-center justify-between border-b border-ink-800 pb-2 mb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-duck-300 w-full">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-duck-500/20 font-mono text-xs text-duck-400 shrink-0">∑</span>
          <input
            type="text"
            value={block.title || "LaTeX Math Equation"}
            onChange={(e) => onUpdateBlock(block.id, { title: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="print-content bg-transparent border-none outline-none text-duck-300 placeholder:text-duck-500/50 w-full"
            placeholder="Equation Title..."
          />
        </div>
      </div>

      {/* Rendered KaTeX Formula Viewport — Click opens editing drawer */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
          setIsEditing(true);
        }}
        className="flex items-center justify-center min-h-[3.5rem] py-2 px-4 overflow-x-auto text-ink-100 text-lg bg-ink-950/60 rounded-lg border border-ink-800/80 cursor-pointer hover:border-duck-500/40 transition-colors"
      >
        <KaTeXRender formula={formula || "E = mc^2"} displayMode={true} className="text-duck-300" />
      </div>

      {/* Interactive LaTeX Code Input & Presets */}
      {isEditing && (
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
              rows={2}
              value={formula}
              onFocus={() => onSelect(block.id)}
              onChange={(e) => handleFormulaChange(e.target.value)}
              onBlur={handleExitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleExitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleExitEdit();
                }
              }}
              placeholder="e.g. E = mc^2 or \int_{a}^{b} f(x) dx"
              className="w-full resize-y rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs font-mono text-duck-300 outline-none focus:border-duck-400 focus:ring-1 focus:ring-duck-400"
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mr-1">Quick Presets:</span>
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFormulaChange(p.math);
                }}
                className="rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-ink-300 transition-colors hover:border-duck-500/40 hover:bg-duck-500/20 hover:text-duck-300 active:scale-95 cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
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

function CodeBlock({ block, onUpdateBlock, onSelect, onDelete }) {
  const [copied, setCopied] = useState(false);
  const underlayRef = useRef(null);

  const activeLangId = normalizeLanguage(block.language || block.meta?.language);
  const activeLangObj =
    CORE_LANGUAGES.find((l) => l.id === activeLangId) || CORE_LANGUAGES[0];

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
    onUpdateBlock(
      block.id,
      {
        language: langId,
        meta: { ...(block.meta || {}), language: langId },
      },
      true
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      if (e.shiftKey) {
        // Shift+Tab: Unindent 2 spaces if present
        if (start >= 2 && val.substring(start - 2, start) === "  ") {
          const newVal = val.substring(0, start - 2) + val.substring(end);
          onUpdateBlock(block.id, { content: newVal }, true);
          setTimeout(() => {
            target.selectionStart = target.selectionEnd = Math.max(0, start - 2);
          }, 0);
        }
      } else {
        // Tab: Insert 2 spaces
        const newVal = val.substring(0, start) + "  " + val.substring(end);
        onUpdateBlock(block.id, { content: newVal }, true);
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        }, 0);
      }
    } else if (e.key === "Backspace" && (!block.content || !block.content.trim())) {
      e.preventDefault();
      onDelete?.(block.id);
    }
  };

  const handleScroll = (e) => {
    if (underlayRef.current) {
      underlayRef.current.scrollTop = e.target.scrollTop;
      underlayRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  return (
    <div
      onClick={() => onSelect(block.id)}
      className="group/codeblk relative my-3 overflow-hidden rounded-xl border border-ink-800 bg-ink-950 font-mono text-sm shadow-xl transition-all hover:border-ink-700"
    >
      {/* Top Header Bar with Language Dropdown & Copy Controls */}
      <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900/90 px-3.5 py-2 select-none">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-[10px] font-extrabold text-emerald-400">
            &lt;/&gt;
          </span>
          <span className="text-xs font-semibold text-ink-300">Code Snippet</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            onMouseDown={(e) => e.stopPropagation()}
            title="Copy code snippet"
            className="flex items-center gap-1 rounded-md border border-ink-750 bg-ink-850 px-2.5 py-1 text-[11px] font-medium text-ink-300 transition-colors hover:border-ink-600 hover:bg-ink-800 hover:text-ink-100 pointer-events-auto relative z-20"
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
          <div className="relative pointer-events-auto z-20">
            <select
              value={activeLangId}
              onChange={(e) => handleSelectLang(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="cursor-pointer rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-ink-750 focus:outline-none pointer-events-auto"
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

      {/* Code Editor Body */}
      <div className="relative min-h-[4rem] bg-ink-950 font-mono text-sm leading-relaxed overflow-hidden rounded-b-xl">
        {/* Syntax Highlighting Underlay */}
        <div
          ref={underlayRef}
          className="code-highlight-underlay absolute inset-0 pointer-events-none p-4 whitespace-pre-wrap break-words overflow-hidden text-ink-100"
          style={{ tabSize: 2 }}
        >
          <HighlightCode code={block.content || ""} language={activeLangId} />
        </div>
        
        {/* Interactive Textarea Overlay */}
        <textarea
          value={block.content || ""}
          onChange={(e) => onUpdateBlock(block.id, { content: e.target.value }, true)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Write code snippet here..."
          rows={Math.max(3, (block.content || "").split("\n").length)}
          style={{
            tabSize: 2,
            color: "transparent",
            caretColor: "#34d399", // emerald-400
          }}
          className="relative z-10 block w-full resize-y bg-transparent font-mono text-sm leading-relaxed outline-none placeholder:text-ink-600 focus:outline-none p-4 whitespace-pre-wrap break-words border-0 outline-0 shadow-none ring-0 selection:bg-duck-500/30 selection:text-transparent pointer-events-auto"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── Site Bookmark Component ─────────────────────────────────────────
function SiteBlock({ block, onUpdateBlock, onSelect, onDelete }) {
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
        if (e.key === "Backspace" || e.key === "Delete") {
          if (e.target.tagName !== "INPUT" || !urlInput) {
            e.preventDefault();
            onDelete?.(block.id);
          }
        }
      }}
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

          <div className="flex items-center gap-1.5 shrink-0">
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

// ─── Media Block Component (URL Embed & Local File Upload) ────────────
function MediaBlock({ block, onUpdateBlock, onSelect, onDelete }) {
  const [activeTab, setActiveTab] = useState("url"); // "url" | "upload"
  const [urlInput, setUrlInput] = useState(block.url || "");
  const [mediaError, setMediaError] = useState(false);
  const fileInputRef = useRef(null);

  const mediaKind = block.mediaKind || "image";

  const handleEmbedUrl = (e) => {
    e?.preventDefault?.();
    if (urlInput.trim()) {
      setMediaError(false);
      onUpdateBlock(block.id, { url: urlInput.trim(), mediaKind }, true);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let detectedKind = "image";
    if (file.type.startsWith("audio/")) {
      detectedKind = "audio";
    } else if (file.type.startsWith("video/")) {
      detectedKind = "video";
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result;
      if (dataUrl) {
        setMediaError(false);
        onUpdateBlock(
          block.id,
          {
            url: dataUrl,
            mediaKind: detectedKind,
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
        if (e.key === "Backspace" || e.key === "Delete") {
          if (e.target.tagName !== "INPUT" || !urlInput) {
            e.preventDefault();
            onDelete?.(block.id);
          }
        }
      }}
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
            </div>

            {/* Media Kind Selector */}
            <div className="flex items-center gap-1">
              {[
                { id: "image", label: "🖼️ Image" },
                { id: "audio", label: "🎵 Audio" },
                { id: "video", label: "🎬 Video" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdateBlock(block.id, { mediaKind: m.id })}
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
                placeholder={`Paste ${mediaKind} URL (e.g. https://example.com/media.png)...`}
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

          {/* Tab 2: Upload File */}
          {activeTab === "upload" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 bg-ink-950/60 p-6 transition-all hover:border-duck-500/60 hover:bg-duck-500/5 cursor-pointer group"
              >
                <span className="text-3xl mb-1.5 group-hover:scale-110 transition-transform">
                  {mediaKind === "audio" ? "🎵" : mediaKind === "video" ? "🎬" : "🖼️"}
                </span>
                <span className="text-xs font-semibold text-ink-200 group-hover:text-duck-200">
                  Click to select {mediaKind} from your computer
                </span>
                <span className="text-[10px] text-ink-500 mt-0.5">
                  Supports PNG, JPG, GIF, WebP, MP3, WAV, MP4, WebM
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
              <span>{mediaKind === "audio" ? "🎵 Audio" : mediaKind === "video" ? "🎬 Video" : "🖼️ Image"}</span>
            </span>
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

          {/* Media Player / Image */}
          {mediaError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-xs text-rose-300">
              ⚠️ Unable to load media from this URL. Please check the link or choose another file.
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

          {/* Editable Caption */}
          <input
            type="text"
            value={block.content || ""}
            onChange={(e) => onUpdateBlock(block.id, { content: e.target.value })}
            placeholder="Add an optional caption (e.g. Figure 1: Circuit diagram)..."
            className="w-full bg-transparent text-center text-xs text-ink-400 placeholder:text-ink-600 outline-none border-b border-transparent focus:border-duck-500/30 py-0.5"
          />
        </div>
      )}
    </div>
  );
}

// ─── Canvas Block Component (Interactive Whiteboard & Drawing) ────────
function CanvasBlock({ block, onUpdateBlock, onSelect, onDelete }) {
  const [showCanvasModal, setShowCanvasModal] = useState(false);

  return (
    <div
      tabIndex={0}
      onClick={() => onSelect(block.id)}
      onKeyDown={(e) => {
        if (e.key === "Backspace" || e.key === "Delete") {
          if (e.target.tagName !== "INPUT") {
            e.preventDefault();
            onDelete?.(block.id);
          }
        }
      }}
      className="group/canvasblk relative my-2.5 overflow-hidden rounded-xl border border-ink-700 bg-ink-900/90 p-4 shadow-lg transition-all hover:border-duck-500/50 outline-none focus:ring-1 focus:ring-duck-400/40"
    >
      <div className="flex items-center justify-between border-b border-ink-800/80 pb-2 mb-3">
        <div className="flex items-center gap-2 flex-1 pr-3">
          <span className="text-lg">🎨</span>
          <input
            type="text"
            value={block.content || ""}
            onChange={(e) => onUpdateBlock(block.id, { content: e.target.value })}
            placeholder="Canvas Drawing Title..."
            className="print-content w-full bg-transparent text-xs font-semibold text-ink-100 outline-none placeholder:text-ink-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCanvasModal(true)}
            className="rounded-md border border-duck-500/40 bg-duck-500/15 px-2.5 py-1 text-xs font-semibold text-duck-200 transition-colors hover:bg-duck-500/25 cursor-pointer"
          >
            🎨 {block.drawingData ? "Edit Drawing" : "Open Canvas"}
          </button>
        </div>
      </div>

      <div
        onClick={() => setShowCanvasModal(true)}
        className="relative w-full rounded-xl border border-dashed border-ink-750 overflow-hidden transition-all hover:border-duck-500/60 group/view flex flex-col items-center justify-center bg-ink-950 cursor-pointer"
        style={{ height: block.previewHeight || 240 }}
      >
        {block.drawingData ? (
          <div
            className="w-full h-full relative"
            style={{
              transform: `scale(${block.canvasZoom || 1})`,
              transformOrigin: "top left",
              width: `${100 / (block.canvasZoom || 1)}%`,
              height: `${100 / (block.canvasZoom || 1)}%`,
            }}
          >
            <img
              src={block.drawingData}
              alt="Canvas drawing preview"
              className="w-full h-full object-contain object-center"
            />
          </div>
        ) : (
          <div className="no-print text-center space-y-2 p-6 pointer-events-none">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-duck-500/10 text-duck-300 text-2xl group-hover/view:scale-110 transition-transform">
              🎨
            </div>
            <p className="text-xs font-semibold text-ink-200">Interactive Whiteboard & Canvas</p>
            <p className="text-[11px] text-ink-500">Click to expand to 85% screen drawing workspace</p>
          </div>
        )}
      </div>

      {showCanvasModal && (
        <CanvasModal
          drawingData={block.drawingData}
          title={block.content || "Canvas Drawing"}
          initialCanvasHeight={block.canvasHeight}
          initialCanvasZoom={block.canvasZoom}
          onSave={(newData, newCanvasHeight, newCanvasZoom) => {
            onUpdateBlock(
              block.id,
              {
                drawingData: newData,
                canvasHeight: newCanvasHeight,
                canvasZoom: newCanvasZoom,
              },
              true
            );
            setShowCanvasModal(false);
          }}
          onClose={() => setShowCanvasModal(false)}
        />
      )}
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
}) {
  const contentRef = useRef(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleFormat = (command) => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();

    const sel = window.getSelection();
    let isSelectedInside = false;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        isSelectedInside = true;
      }
    }

    if (command === "math") {
      if (isSelectedInside) {
        const text = sel.toString();
        document.execCommand("insertText", false, `$${text || "x"}$`);
      } else {
        const currentText = getBlockTextFromDOM(el);
        if (currentText.startsWith("$") && currentText.endsWith("$")) {
          const unmath = currentText.slice(1, -1);
          setBlockDOMFromText(el, unmath);
          onChange(block.id, unmath);
        } else {
          const mathText = `$${currentText || "E = mc^2"}$`;
          setBlockDOMFromText(el, mathText);
          onChange(block.id, mathText);
        }
      }
      const updatedText = getBlockTextFromDOM(el);
      onChange(block.id, updatedText);
      return;
    }

    if (isSelectedInside) {
      document.execCommand(command, false, null);
    } else {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand(command, false, null);
    }
    const updatedText = getBlockTextFromDOM(el);
    onChange(block.id, updatedText);
  };
  // The block only becomes draggable while the ⠿ handle is held. Making the
  // whole row draggable would hijack text selection inside contentEditable.
  const [handleHeld, setHandleHeld] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState(false);

  const [selectedMathNode, setSelectedMathNode] = useState(null);
  const [popoverFormula, setPopoverFormula] = useState("");
  const [mathPopoverOpen, setMathPopoverOpen] = useState(false);

  useEffect(() => {
    if (registerRef) registerRef(block.id, contentRef);
  }, [block.id, registerRef]);

  useEffect(() => {
    if (contentRef.current) {
      const currentDomText = getBlockTextFromDOM(contentRef.current);
      if (currentDomText !== (block.content || "")) {
        setBlockDOMFromText(contentRef.current, block.content || "");
      }
    }
  }, [block.id, block.type, block.content]);

  function handleInput() {
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
      { prefix: "[ ] ", type: "todo" },
      { prefix: "[] ", type: "todo" },
      { prefix: "> ", type: "quote" },
      { prefix: "💡 ", type: "callout" },
      { prefix: ">! ", type: "callout" },
      { prefix: "---", type: "divider" },
      { prefix: "***", type: "divider" },
      { prefix: "```", type: "code" },
      { prefix: "$$", type: "math" },
    ];

    for (const sc of shortcuts) {
      if (text.startsWith(sc.prefix)) {
        const remaining = text.slice(sc.prefix.length);
        onChangeType(block.id, sc.type);
        onChange(block.id, remaining);
        if (contentRef.current) {
          setBlockDOMFromText(contentRef.current, remaining);
        }
        return;
      }
    }
  }

  function handleSlashSelect(type) {
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

    if (lastSlashIndex <= 0 || text.trim().startsWith("/")) {
      onChange(block.id, "");
      if (contentRef.current) {
        contentRef.current.textContent = "";
      }
      onChangeType(block.id, type);
    } else {
      const textBefore = text.slice(0, lastSlashIndex).trimEnd();
      const textAfter = text.slice(lastSlashIndex + slashFilter.length + 1).trimStart();

      onChange(block.id, textBefore);
      if (contentRef.current) {
        setBlockDOMFromText(contentRef.current, textBefore);
      }

      if (onAddAfter) {
        onAddAfter(block.id, "", type);
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
    if (selectedMathNode && contentRef.current) {
      if (!newFormula) {
        selectedMathNode.remove();
      } else {
        const katexHtml = katex.renderToString(newFormula, { displayMode: false, throwOnError: false });
        const escapedFormula = newFormula.replace(/"/g, "&quot;");
        selectedMathNode.setAttribute("data-formula", newFormula);
        selectedMathNode.innerHTML = katexHtml;
      }
      const updatedText = getBlockTextFromDOM(contentRef.current);
      onChange(block.id, updatedText);
      onUpdateBlock(block.id, { content: updatedText }, true);
    }
    setMathPopoverOpen(false);
    setSelectedMathNode(null);
  };

  const handleMathDelete = () => {
    if (selectedMathNode && contentRef.current) {
      selectedMathNode.remove();
      const updatedText = getBlockTextFromDOM(contentRef.current);
      onChange(block.id, updatedText);
      onUpdateBlock(block.id, { content: updatedText }, true);
    }
    setMathPopoverOpen(false);
    setSelectedMathNode(null);
  };

  function handleKeyDown(e) {
    if (slashOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
      e.preventDefault();
      
      const sel = window.getSelection();
      let textBefore = block.content || "";
      let textAfter = "";

      if (sel && sel.rangeCount > 0 && sel.focusNode && contentRef.current) {
        const range = sel.getRangeAt(0);
        textBefore = getSerializedTextFromRange(contentRef.current, range.startContainer, range.startOffset);
        const textSelected = range.collapsed
          ? ""
          : getSerializedTextFromRange(contentRef.current, range.endContainer, range.endOffset).slice(textBefore.length);
        const fullText = getBlockTextFromDOM(contentRef.current);
        textAfter = fullText.slice(textBefore.length + textSelected.length);
        
        onChange(block.id, textBefore);
        if (contentRef.current) {
          setBlockDOMFromText(contentRef.current, textBefore);
        }
      }

      if (["bullet", "number", "todo", "toggle", "callout", "quote"].includes(block.type) && !textBefore.trim()) {
        onChangeType(block.id, "text");
        return;
      }

      // Pressing Enter in headings, callouts, and quotes spawns a standard paragraph text block below
      const nextType = ["h1", "h2", "h3", "h4", "callout", "quote"].includes(block.type) ? "text" : block.type;
      onAddAfter(block.id, textAfter, nextType);
      return;
    }

    onKeyDown?.(e, block.id, contentRef.current);
  }
  const typeStyles = {
    text: "text-[15px] leading-relaxed text-ink-200",
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

  // Flatten all notes from notesBySpace for Note Link picker
  const allNotes = Object.entries(notesBySpace).flatMap(([space, notes]) =>
    (notes || []).map((n) => ({ ...n, space }))
  );

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
      onClick={() => onSelect(block.id)}
    >
      {/* Properly Aligned Controls */}
      <div className="absolute -left-14 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(block.id);
          }}
          title="Delete Block"
          className="rounded p-1 text-xs text-rose-400/90 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
        >
          🗑️
        </button>
        <button
          type="button"
          onMouseDown={() => setHandleHeld(true)}
          onMouseUp={() => setHandleHeld(false)}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          title="Drag to move · click for block menu"
          className="cursor-grab rounded p-1 text-xs text-ink-500 transition-colors hover:bg-ink-800 hover:text-duck-300 active:cursor-grabbing"
        >
          ⠿
        </button>
      </div>

      {menuOpen && (
        <BlockContextMenu
          block={block}
          onClose={() => setMenuOpen(false)}
          onChangeType={onChangeType}
          onDelete={onDelete}
          onExplainBlock={onExplainBlock}
          onQuizBlock={onQuizBlock}
          onFormat={handleFormat}
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
          tabIndex={0}
          onClick={() => onSelect(block.id)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Delete") {
              e.preventDefault();
              onDelete(block.id);
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
        <MathBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} />
      ) : block.type === "code" ? (
        /* Code Snippet Block */
        <CodeBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} />
      ) : block.type === "bullet" ? (
        /* 3. Bullet List */
        <div className="flex items-start gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onClick={handleTagClick}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.bullet}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.bullet} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "number" ? (
        /* 4. Numbered List */
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 w-5 font-mono text-sm font-semibold text-ink-400">
            {blockNumber || 1}.
          </span>
          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onClick={handleTagClick}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.number}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.number} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "todo" ? (
        /* 5. To-Do List */
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={Boolean(block.checked)}
            onChange={(e) => onUpdateBlock(block.id, { checked: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-ink-700 bg-ink-850 text-duck-400 focus:ring-0 cursor-pointer"
          />
          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onClick={handleTagClick}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.todo}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.todo} ${
              block.checked ? "line-through text-ink-500" : ""
            } empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "toggle" ? (
        /* 6. Toggle / Collapsible Dropdown Block */
        <div className="my-1 rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 shadow-sm space-y-2 transition-all">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateBlock(block.id, { open: block.open === false ? true : false })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-850 text-xs font-bold text-duck-400 transition-transform active:scale-95 hover:border-duck-500/40 hover:bg-duck-500/10"
              title="Toggle Dropdown Section"
            >
              {block.open === false ? "▶" : "▼"}
            </button>
            <Tag
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onClick={handleTagClick}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => onSelect(block.id)}
              data-placeholder={placeholders.toggle}
              className={`min-h-[1.5em] flex-1 font-semibold text-ink-100 outline-none ${typeStyles.toggle} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 px-2 py-0.5 rounded border border-ink-800 bg-ink-950">
              {block.open === false ? "Collapsed" : "Expanded"}
            </span>
          </div>

          {block.open !== false && (
            <div className="ml-7 rounded-lg border-l-2 border-duck-500/40 bg-ink-850/70 p-3 text-xs leading-relaxed text-ink-200 animate-fade-in">
              <textarea
                value={block.details ?? block.toggleContent ?? ""}
                onChange={(e) => onUpdateBlock(block.id, { details: e.target.value })}
                placeholder="Add collapsible details, deep dive text, or code breakdown here..."
                rows={3}
                className="w-full bg-transparent font-sans text-xs text-ink-200 placeholder:text-ink-600 focus:outline-none resize-y min-h-[3rem]"
              />
            </div>
          )}
        </div>
      ) : block.type === "callout" ? (
        /* 7. Callout Box */
        <div className="relative rounded-xl border border-ink-700 bg-ink-850/90 p-3.5 shadow-md flex items-start gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="text-lg leading-none p-1 rounded hover:bg-ink-800"
            >
              {block.calloutIcon || "💡"}
            </button>

            {showIconPicker && (
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
            contentEditable
            suppressContentEditableWarning
            onClick={handleTagClick}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.callout}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.text} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "quote" ? (
        /* 8. Quote */
        <div className="border-l-4 border-duck-400 pl-4 py-1 italic">
          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onClick={handleTagClick}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.quote}
            className={`min-h-[1.5em] outline-none ${typeStyles.quote} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "site" ? (
        /* 10. Site Bookmark Embed */
        <SiteBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} />
      ) : block.type === "media" ? (
        /* 11. Image / Audio / Video Embed */
        <MediaBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} />
      ) : block.type === "canvas" ? (
        /* 12. Canvas / Drawing Block */
        <CanvasBlock block={block} onUpdateBlock={onUpdateBlock} onSelect={onSelect} onDelete={onDelete} />
      ) : (
        /* Standard Paragraph & Heading Blocks */
        <Tag
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onClick={handleTagClick}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => onSelect(block.id)}
          data-placeholder={placeholders[block.type] ?? ""}
          className={`min-h-[1.5em] outline-none ${typeStyles[block.type] ?? typeStyles.text} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
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
          }}
          filter={slashFilter}
        />
      )}
    </div>
  );
});

// ─── Canvas Modal (85% Screen Drawing Workspace) ────────────────────
function CanvasModal({ drawingData, title, initialCanvasHeight, initialCanvasZoom, onSave, onClose }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [color, setColor] = useState("#3B82F6");
  const [tool, setTool] = useState("pen");
  const [lastNonRulerTool, setLastNonRulerTool] = useState("pen");
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [lastPoint, setLastPoint] = useState(null);

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const [eraserSize, setEraserSize] = useState(24);
  const [penSize, setPenSize] = useState(4);
  const [measureInfo, setMeasureInfo] = useState(null);

  const [canvasHeight, setCanvasHeight] = useState(initialCanvasHeight || 700);
  const [canvasZoom, setCanvasZoom] = useState(initialCanvasZoom || 1);

  const COLORS = [
    "#FFFFFF",
    "#F59E0B",
    "#3B82F6",
    "#EF4444",
    "#10B981",
    "#A855F7",
    "#06B6D4",
    "#F97316",
    "#EAB308",
    "#64748B",
  ];

  const TOOLS = [
    { id: "pen", label: "Pen", icon: "🖊️", opacity: 1 },
    { id: "marker", label: "Marker", icon: "🖌️", opacity: 0.9 },
    { id: "highlighter", label: "Highlighter", icon: "🖍️", opacity: 0.35 },
    { id: "eraser", label: "Eraser", icon: "🧹", opacity: 1 },
    { id: "ruler", label: "Ruler Line", icon: "📐", opacity: 1 },
  ];

  const isInitialized = useRef(false);

  // Ensure canvas has the correct coordinate resolution for the zoom level
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const desiredWidth = container.clientWidth / canvasZoom;
    const desiredHeight = canvasHeight / canvasZoom;

    if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
      const ctx = canvas.getContext("2d");
      
      let currentData = null;
      // Only capture currentData if we have already initialized the canvas with drawingData
      if (isInitialized.current && canvas.width > 0 && canvas.height > 0) {
        currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      
      canvas.width = desiredWidth;
      canvas.height = desiredHeight;
      
      if (currentData) {
        ctx.putImageData(currentData, 0, 0);
      } else if (drawingData && !isInitialized.current) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          saveState();
        };
        img.src = drawingData;
      } else {
        saveState();
      }
      isInitialized.current = true;
    }
  }, [canvasHeight, canvasZoom, drawingData]);

  // Global Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo) inside Canvas Modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack, redoStack]);

  function saveState() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev.slice(-25), data]);
    setRedoStack([]);
  }

  function handleUndo() {
    if (undoStack.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const nextUndo = [...undoStack];
    const currentData = nextUndo.pop();
    setRedoStack((prev) => [currentData, ...prev]);

    const previousState = nextUndo[nextUndo.length - 1];
    setUndoStack(nextUndo);

    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
    }
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const nextRedo = [...redoStack];
    const targetData = nextRedo.shift();
    setRedoStack(nextRedo);

    if (targetData) {
      ctx.putImageData(targetData, 0, 0);
      setUndoStack((prev) => [...prev, targetData]);
    }
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
  }

  function handleToolClick(toolId) {
    if (toolId === "ruler") {
      if (tool === "ruler") {
        // Toggle ruler off -> restore previous tool
        setTool(lastNonRulerTool || "pen");
      } else {
        setLastNonRulerTool(tool);
        setTool("ruler");
      }
    } else {
      setLastNonRulerTool(toolId);
      setTool(toolId);
    }
  }

  function getCanvasCoords(e) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / canvasZoom,
      y: (clientY - rect.top) / canvasZoom,
    };
  }

  function applyToolStyle(ctx) {
    const tObj = TOOLS.find((t) => t.id === tool) || TOOLS[0];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = eraserSize;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.globalAlpha = tObj.opacity;

      if (tool === "marker") {
        ctx.lineWidth = Math.max(4, penSize * 2.2);
      } else if (tool === "highlighter") {
        ctx.lineWidth = Math.max(12, penSize * 4.5);
      } else {
        // Standard Pen
        ctx.lineWidth = penSize;
      }
    }
  }

  function startDrawing(e) {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    

    setIsDrawing(true);
    setDragStart(coords);
    setCurrentPos(coords);
    setLastPoint(coords);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      applyToolStyle(ctx);
    }
  }

  function draw(e) {
    const coords = getCanvasCoords(e);
    setMousePos(coords);

    if (!isDrawing) return;
    e.preventDefault();
    setCurrentPos(coords);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (tool === "ruler") {
      if (dragStart) {
        const dx = coords.x - dragStart.x;
        const dy = coords.y - dragStart.y;
        const length = Math.round(Math.sqrt(dx * dx + dy * dy));
        const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        setMeasureInfo({ length, angle });
      }

    } else if (tool === "marker") {
      // 🖌️ Felt-Tip Marker: Saturated felt ink with soft edge bleed
      if (lastPoint) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Outer soft felt bleed
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(6, penSize * 2.8);
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        // Inner saturated ink core
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = Math.max(4, penSize * 2.0);
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        setLastPoint(coords);
      }
    } else if (tool === "highlighter") {
      // 🖍️ Translucent Chisel Highlighter: Wide flat chisel stroke
      if (lastPoint) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineCap = "square";
        ctx.lineJoin = "bevel";
        ctx.lineWidth = Math.max(16, penSize * 4.5);

        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        setLastPoint(coords);
      }

    } else if (tool === "pen") {
      // 🖊️ Gel Ballpoint Pen: Smooth velocity-sensitive ink line
      if (lastPoint) {
        const dx = coords.x - lastPoint.x;
        const dy = coords.y - lastPoint.y;
        const speed = Math.sqrt(dx * dx + dy * dy);
        const dynamicWidth = Math.max(1, penSize * (1.2 / (1 + speed * 0.04)));

        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1.0;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = dynamicWidth;

        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        setLastPoint(coords);
      }
    } else {
      // Eraser
      applyToolStyle(ctx);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  }

  function stopDrawing(e) {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (tool === "ruler" && dragStart && currentPos) {
      applyToolStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(dragStart.x, dragStart.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
    }

    setDragStart(null);
    setCurrentPos(null);
    setLastPoint(null);
    setMeasureInfo(null);
    saveState();
  }

  function handleSaveAndClose() {
    const canvas = canvasRef.current;
    if (!canvas) {
      onClose();
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl, canvasHeight, canvasZoom);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 animate-fade-in">
      <div className="flex w-[85vw] h-[85vh] relative flex-col rounded-2xl border border-ink-700 bg-ink-950 shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎨</span>
            <div>
              <h2 className="text-sm font-bold text-ink-100">{title || "Canvas Whiteboard"}</h2>
              <p className="text-[11px] text-ink-400">85% Viewport Drawing Workspace • Ctrl+Z / Ctrl+Y to Undo/Redo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:bg-ink-800 disabled:opacity-40"
              title="Undo (Ctrl+Z)"
            >
              <span>↩</span>
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:bg-ink-800 disabled:opacity-40"
              title="Redo (Ctrl+Y)"
            >
              <span>↪</span>
              <span>Redo</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
              title="Clear full grid/canvas"
            >
              🗑️ Clear Full Grid
            </button>

            <button
              type="button"
              onClick={handleSaveAndClose}
              className="rounded-lg bg-gradient-to-r from-duck-500 to-amber-500 px-4 py-1.5 text-xs font-bold text-ink-950 shadow hover:brightness-110"
            >
              Save & Done
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Toolbar: Tools + Size Selectors + 10 Colors */}
        <div className="flex flex-wrap items-center justify-between border-b border-ink-800 bg-ink-900/90 px-4 py-2 gap-3">
          {/* Tool Picker */}
          <div className="flex items-center gap-1">
            {TOOLS.map((t) => {
              const isActive = tool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToolClick(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-duck-500/20 text-duck-300 border border-duck-500/40 shadow-sm"
                      : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                  }`}
                  title={t.id === "ruler" ? (isActive ? "Click to deactivate Ruler" : "Click to activate Ruler") : t.label}
                >
                  <span>{t.icon}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                  {t.id === "ruler" && isActive && <span className="text-[10px] text-amber-400">●</span>}
                </button>
              );
            })}
          </div>

          {/* Dynamic Tool Size Control */}
          <div className="flex items-center gap-2 rounded-xl border border-ink-800 bg-ink-850 px-3 py-1">
            <span className="text-[11px] font-semibold text-ink-400">
              {tool === "eraser" ? "Eraser Size:" : "Stroke Width:"}
            </span>
            {tool === "eraser" ? (
              <div className="flex items-center gap-1">
                {[12, 24, 40, 60, 80].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setEraserSize(sz)}
                    className={`rounded px-2 py-0.5 text-[11px] font-bold transition-all ${
                      eraserSize === sz
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "text-ink-400 hover:text-ink-200"
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {[1.5, 3, 6, 12, 20].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPenSize(sz)}
                    className={`rounded px-2 py-0.5 text-[11px] font-bold transition-all ${
                      penSize === sz
                        ? "bg-duck-500/20 text-duck-300 border border-duck-500/40"
                        : "text-ink-400 hover:text-ink-200"
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 10 Colors Palette */}
          <div className="flex items-center gap-1.5 rounded-xl border border-ink-800 bg-ink-850 p-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${
                  color === c ? "ring-2 ring-duck-400 ring-offset-2 ring-offset-ink-900 scale-110" : ""
                }`}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Canvas Body (85% viewport height container) */}
        <div
          ref={containerRef}
          className="relative flex-1 w-full h-full overflow-auto group"
        >
          <div
            style={{ width: `${100 / canvasZoom}%`, height: canvasHeight / canvasZoom, transform: `scale(${canvasZoom})` }}
            className={`relative origin-top-left cursor-crosshair bg-ink-950`}
          >
            <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="absolute inset-0 z-10 block"
          />



          {/* Floating Circular Eraser Preview Cursor */}
          {tool === "eraser" && mousePos && (
            <div
              style={{
                left: mousePos.x - eraserSize / 2,
                top: mousePos.y - eraserSize / 2,
                width: eraserSize,
                height: eraserSize,
              }}
              className="pointer-events-none absolute z-30 rounded-full border-2 border-dashed border-rose-400 bg-rose-500/20 shadow-lg"
            />
          )}

          {/* Ruler Line Preview Guide while dragging */}
          {tool === "ruler" && isDrawing && dragStart && currentPos && (
            <svg className="absolute inset-0 z-20 pointer-events-none w-full h-full">
              <line
                x1={dragStart.x}
                y1={dragStart.y}
                x2={currentPos.x}
                y2={currentPos.y}
                stroke={color}
                strokeWidth={Math.max(2, penSize)}
                strokeDasharray="6 4"
              />
              <circle cx={dragStart.x} cy={dragStart.y} r={5} fill={color} />
              <circle cx={currentPos.x} cy={currentPos.y} r={5} fill={color} />
            </svg>
          )}

          {/* Floating measurement readout for Ruler tool */}
          {tool === "ruler" && measureInfo && currentPos && (
            <div
              style={{ left: currentPos.x + 12, top: currentPos.y + 12 }}
              className="absolute z-30 rounded bg-ink-900/90 border border-duck-500/40 px-2 py-1 text-[11px] font-mono font-bold text-duck-300 shadow-lg pointer-events-none"
            >
              📏 {measureInfo.length}px | {measureInfo.angle}°
            </div>
          )}

          {/* Translucent Ruler Active Banner */}
          {tool === "ruler" && !isDrawing && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-950/90 px-3 py-1.5 text-xs text-amber-300 font-semibold shadow-lg">
              <span>📐 Ruler Guide Active: Drag to draw straight lines</span>
              <button
                type="button"
                onClick={() => setTool(lastNonRulerTool || "pen")}
                className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/40 transition-colors"
              >
                ✕ Deactivate
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BlockNoteEditor (main export) ──────────────────────────────────
export default function BlockNoteEditor({
  onExplainBlock,
  onQuizBlock,
  onTriggerSocratic,
  onSwitchTab,
  initialTitle = "",
  initialBlocks,
  initialBanner = null,
  initialFavorite = false,
  initialEmoji = null,
  onBlocksChange,
  onSaveNote,
  onExportImport,
  notesBySpace = {},
  onSelectNote,
  clickToAppend = true,
}) {
  const [title, setTitle] = useState(initialTitle);
  const [banner, setBanner] = useState(initialBanner);
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [blocks, setBlocks] = useState(() =>
    initialBlocks && initialBlocks.length > 0
      ? initialBlocks
      : [{ id: "blk_default_init_0", type: "text", content: "" }]
  );
  const [selectedId, setSelectedId] = useState(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState(new Set());
  const [marqueeBox, setMarqueeBox] = useState(null);
  const isDraggingMarquee = useRef(false);
  const marqueeStart = useRef({ x: 0, y: 0 });
  const editorContainerRef = useRef(null);
  const blockRefs = useRef({});
  const bannerPickerRef = useRef(null);
  const emojiPickerRef = useRef(null);

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

  // Marquee Drag Selection & Empty Canvas Click Handlers
  const handleEditorMouseDown = (e) => {
    const isInput = e.target.closest('[contenteditable="true"], input, textarea, button, a, select, [role="button"]');
    if (isInput) {
      if (!e.shiftKey) {
        setSelectedBlockIds(new Set());
      }
      return;
    }

    isDraggingMarquee.current = true;
    marqueeStart.current = { x: e.clientX, y: e.clientY };
    setMarqueeBox({
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });

    if (!e.shiftKey) {
      setSelectedBlockIds(new Set());
    }
  };

  const handleEditorMouseMove = (e) => {
    if (!isDraggingMarquee.current) return;

    const currentX = e.clientX;
    const currentY = e.clientY;
    const startX = marqueeStart.current.x;
    const startY = marqueeStart.current.y;

    setMarqueeBox({
      startX,
      startY,
      currentX,
      currentY,
    });

    const boxRect = {
      left: Math.min(startX, currentX),
      top: Math.min(startY, currentY),
      right: Math.max(startX, currentX),
      bottom: Math.max(startY, currentY),
    };

    const newSelected = new Set();
    blocks.forEach((b) => {
      const el = document.querySelector(`[data-block-id="${b.id}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        const intersects =
          r.left < boxRect.right &&
          r.right > boxRect.left &&
          r.top < boxRect.bottom &&
          r.bottom > boxRect.top;
        if (intersects) {
          newSelected.add(b.id);
        }
      }
    });

    setSelectedBlockIds(newSelected);
  };

  const handleEditorMouseUp = (e) => {
    if (isDraggingMarquee.current) {
      const startX = marqueeStart.current.x;
      const startY = marqueeStart.current.y;
      const currentX = e?.clientX ?? startX;
      const currentY = e?.clientY ?? startY;
      const dist = Math.hypot(currentX - startX, currentY - startY);

      isDraggingMarquee.current = false;
      setMarqueeBox(null);

      // Simple click on empty canvas area -> create or focus last block
      if (dist < 6) {
        if (!clickToAppend) return;
        const lastBlock = blocksRef.current[blocksRef.current.length - 1];
        if (!lastBlock || (lastBlock.content !== "" && lastBlock.content !== undefined)) {
          const newBlock = createBlock("text", "");
          setBlocks((prev) => [...prev, newBlock]);
          setSelectedId(newBlock.id);
          setTimeout(() => {
            blockRefs.current[newBlock.id]?.current?.focus();
          }, 30);
        } else if (lastBlock) {
          setSelectedId(lastBlock.id);
          setTimeout(() => {
            blockRefs.current[lastBlock.id]?.current?.focus();
          }, 30);
        }
      }
    }
  };

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
        // Record undo history for the reorder itself. Without this, dragging
        // a block was the only editing action that bypassed the undo stack —
        // Ctrl+Z right after a drag would skip over it and revert an earlier,
        // unrelated edit instead, which reads as "undo silently ate my change".
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
          // The drop indicator renders above the target block, signalling
          // "insert before this block". When dragging forward (from < to),
          // removing the source shifts every later index down by one, so the
          // target's post-removal position is `to - 1`. Without this
          // adjustment the block lands one slot too far, after the target.
          const insertAt = from < to ? to - 1 : to;
          next.splice(insertAt, 0, moved);
          return next;
        });
        setDragging(null);
        setDragOver(null);
      },
    }),
    [dragging, dragOver],
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

  // Initial states are handled by useState initialization.
  // The component is completely remounted when changing notes because of the `key` prop in Workspace.jsx.
  // We avoid syncing these via useEffect to prevent the editor's internal state from being overwritten
  // during typing or saving, which causes cursor jumps and lost focus.

  useEffect(() => {
    onBlocksChange?.(blocks);
  }, [blocks, onBlocksChange]);

  const registerRef = useCallback((id, ref) => {
    blockRefs.current[id] = ref;
  }, []);

  const lastHistoryPush = useRef(0);

  const handleChange = useCallback((id, content) => {
    const now = Date.now();
    if (now - lastHistoryPush.current > 600) {
      setPastBlocks((p) => [...p.slice(-30), blocksRef.current]);
      setFutureBlocks([]);
      lastHistoryPush.current = now;
    }
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content } : b))
    );
  }, []);

  const [pastBlocks, setPastBlocks] = useState([]);
  const [futureBlocks, setFutureBlocks] = useState([]);

  const blocksRef = useRef(blocks);
  const pastBlocksRef = useRef(pastBlocks);
  const futureBlocksRef = useRef(futureBlocks);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    pastBlocksRef.current = pastBlocks;
  }, [pastBlocks]);

  useEffect(() => {
    futureBlocksRef.current = futureBlocks;
  }, [futureBlocks]);

  // Cancel any pending debounced title save on unmount. Workspace.jsx mounts
  // this editor with `key={activeNoteObj.id}`, so switching notes unmounts
  // this instance entirely. Without this cleanup, a title edit made just
  // before switching notes still fires its setTimeout after unmount; that
  // stale onSaveNote call carries no note id, so the parent's handleSaveNote
  // falls back to whatever note is active *then* — silently overwriting the
  // newly-opened note with the previous note's title/blocks.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleTitleChange = useCallback(
    (newTitle) => {
      setTitle(newTitle);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        onSaveNote?.({ title: newTitle, blocks: blocksRef.current, banner, isFavorite, emoji });
      }, 400);
    },
    [banner, isFavorite, emoji, onSaveNote]
  );

  useEffect(() => {
    const handleGlobalUndoRedo = (e) => {
      const activeEl = document.activeElement;
      const inEditor =
        (editorContainerRef.current && editorContainerRef.current.contains(activeEl)) ||
        activeEl === document.body;

      if (!inEditor) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          if (futureBlocksRef.current.length > 0) {
            e.preventDefault();
            const next = futureBlocksRef.current[0];
            setFutureBlocks((f) => f.slice(1));
            setPastBlocks((p) => [...p, blocksRef.current]);
            setBlocks(next);
            onSaveNote?.({ title, blocks: next, banner, isFavorite, emoji });
          }
        } else {
          if (pastBlocksRef.current.length > 0) {
            e.preventDefault();
            const previous = pastBlocksRef.current[pastBlocksRef.current.length - 1];
            setPastBlocks((p) => p.slice(0, p.length - 1));
            setFutureBlocks((f) => [blocksRef.current, ...f]);
            setBlocks(previous);
            onSaveNote?.({ title, blocks: previous, banner, isFavorite, emoji });
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        if (futureBlocksRef.current.length > 0) {
          e.preventDefault();
          const next = futureBlocksRef.current[0];
          setFutureBlocks((f) => f.slice(1));
          setPastBlocks((p) => [...p, blocksRef.current]);
          setBlocks(next);
          onSaveNote?.({ title, blocks: next, banner, isFavorite, emoji });
        }
      }
    };
    window.addEventListener("keydown", handleGlobalUndoRedo);
    return () => window.removeEventListener("keydown", handleGlobalUndoRedo);
  }, [title, banner, isFavorite, emoji, onSaveNote]);

  // Multi-Block Selection Keyboard Shortcuts: Ctrl+A, Ctrl+C, Ctrl+X, Delete/Backspace
  useEffect(() => {
    const handleMultiBlockKeydown = (e) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.isContentEditable || activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      // Ctrl+A / Cmd+A Select All Blocks
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        if (!isInput) {
          e.preventDefault();
          setSelectedBlockIds(new Set(blocksRef.current.map((b) => b.id)));
        }
        return;
      }

      const effectiveIds = selectedBlockIds.size > 0 ? selectedBlockIds : null;

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
            return next.length > 0 ? next : [createBlock("text", "")];
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
        if ((e.key === "Backspace" || e.key === "Delete") && !isInput) {
          e.preventDefault();
          setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
          setFutureBlocks([]);
          setBlocks((prev) => {
            const next = prev.filter((b) => !effectiveIds.has(b.id));
            return next.length > 0 ? next : [createBlock("text", "")];
          });
          setSelectedBlockIds(new Set());
          if (selectedId) setSelectedId(null);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleMultiBlockKeydown);
    return () => window.removeEventListener("keydown", handleMultiBlockKeydown);
  }, [selectedBlockIds, selectedId]);

  const handleChangeType = useCallback((id, type) => {
    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
    setFutureBlocks([]);
    setBlocks((prev) =>
      prev.map((b) => {
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
        return { ...b, type };
      })
    );
    setSelectedId(id);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = blockRefs.current[id]?.current;
        if (el) {
          el.focus();
          const sel = window.getSelection();
          if (sel) {
            sel.selectAllChildren(el);
            sel.collapseToStart();
          }
        }
      }, 15);
    });
  }, []);

  const handleUpdateBlock = useCallback(
    (id, patch, shouldSaveNote = false) => {
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
          queueMicrotask(() => {
            onSaveNote?.({ title, blocks: next, banner, isFavorite, emoji });
          });
        }
        return next;
      });
    },
    [title, banner, isFavorite, emoji, onSaveNote]
  );

  const handleDeleteBlock = useCallback((id) => {
    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
    setFutureBlocks([]);
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      return next.length > 0 ? next : [createBlock("text", "")];
    });
  }, []);

  const handleDuplicateBlock = useCallback(
    (id) => {
      setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
      setFutureBlocks([]);
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === id);
        if (idx === -1) return prev;
        const target = prev[idx];
        const newBlock = {
          ...target,
          id: `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        };
        const next = [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
        queueMicrotask(() => {
          onSaveNote?.({ title, blocks: next, banner, isFavorite, emoji });
        });
        return next;
      });
    },
    [title, banner, isFavorite, emoji, onSaveNote]
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
        queueMicrotask(() => {
          onSaveNote?.({ title, blocks: next, banner, isFavorite, emoji });
        });
        return next;
      });
    },
    [title, banner, isFavorite, emoji, onSaveNote]
  );

  const handleAddAfter = useCallback((afterId, content = "", typeToInherit = null) => {
    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
    setFutureBlocks([]);
    
    let newType = "text";
    if (typeToInherit) {
      newType = typeToInherit;
    } else {
      const currentBlock = blocksRef.current.find((b) => b.id === afterId);
      if (currentBlock && ["bullet", "number", "todo", "toggle"].includes(currentBlock.type)) {
        newType = currentBlock.type;
      }
    }

    const newBlock = createBlock(newType, content);
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setSelectedId(newBlock.id);
    setTimeout(() => {
      blockRefs.current[newBlock.id]?.current?.focus();
    }, 30);
  }, []);

  // Smart Markdown & Plain Text Paste Handler
  const handleSmartPaste = useCallback(
    (e) => {
      const targetTag = e.target?.tagName;
      if (targetTag === "TEXTAREA" || targetTag === "INPUT") return;

      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;

      const isMarkdown =
        text.includes("\n") ||
        /^(#+|-|\*|\d+\.|>|```|\$\$|\[\s*\]|---)\s/m.test(text);

      if (isMarkdown) {
        e.preventDefault();
        const parsedBlocks = parseMarkdownToBlocks(text);
        if (parsedBlocks.length > 0) {
          setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
          setFutureBlocks([]);
          setBlocks((prev) => {
            const activeIdx = prev.findIndex((b) => b.id === selectedId);
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
              if (textBefore && blocksToInsert.length > 0) {
                blocksToInsert[0].content = (textBefore + (blocksToInsert[0].content || ""));
              }
              if (textAfter && blocksToInsert.length > 0) {
                const lastIdx = blocksToInsert.length - 1;
                blocksToInsert[lastIdx].content = ((blocksToInsert[lastIdx].content || "") + textAfter);
              }

              const next = [...prev];
              next.splice(activeIdx, 1, ...blocksToInsert);
              const lastInserted = blocksToInsert[blocksToInsert.length - 1];
              if (lastInserted) {
                setSelectedId(lastInserted.id);
                setTimeout(() => {
                  blockRefs.current[lastInserted.id]?.current?.focus();
                }, 30);
              }
              return next;
            }
            return [...prev, ...parsedBlocks];
          });
        }
        return;
      }

      // If pasting single-line or non-multiline text, sanitize to plain text to avoid foreign HTML injection
      if (e.target?.isContentEditable) {
        e.preventDefault();
        const plainText = e.clipboardData?.getData("text/plain") || "";
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(plainText);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
          
          const activeBlockEl = e.target.closest("[contenteditable]");
          if (activeBlockEl) {
            const blockId = activeBlockEl.closest("[data-block-id]")?.getAttribute("data-block-id");
            if (blockId) {
              const updatedText = getBlockTextFromDOM(activeBlockEl);
              handleChange(blockId, updatedText);
            }
          }
        }
      }
    },
    [selectedId, handleChange]
  );

  const handleKeyDown = useCallback(
    (e, blockId) => {
      if (e.key === "Backspace") {
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;
        const idx = blocks.findIndex((b) => b.id === blockId);

        // Check if caret is at the start (offset 0) of the current block
        const el = blockRefs.current[blockId]?.current;
        let isAtStart = false;
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && sel.focusNode) {
            const range = sel.getRangeAt(0);
            if (range.collapsed) {
              const textBefore = getSerializedTextFromRange(el, range.startContainer, range.startOffset);
              if (textBefore.length === 0) {
                isAtStart = true;
              }
            }
          }
        } else if (block.content === "") {
          isAtStart = true;
        }

        // 1. Notion-style Divider, Site Bookmark, Media & Canvas Deletion:
        // When Backspace is pressed at the start of a line after a divider, site, media or canvas block, delete it!
        const standaloneEmbedTypes = ["divider", "site", "media", "canvas"];
        if (isAtStart && idx > 0 && standaloneEmbedTypes.includes(blocks[idx - 1]?.type)) {
          e.preventDefault();
          const targetBlock = blocks[idx - 1];
          setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
          setFutureBlocks([]);
          setBlocks((prev) => prev.filter((b) => b.id !== targetBlock.id));
          return;
        }

        // A. If block is empty and we have more than 1 block, delete THIS block and move focus to previous block
        if (block.content === "" && blocks.length > 1) {
          e.preventDefault();
          const prevBlock = idx > 0 ? blocks[idx - 1] : null;
          
          setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
          setFutureBlocks([]);
          setBlocks((prev) => prev.filter((b) => b.id !== blockId));

          if (prevBlock) {
            setSelectedId(prevBlock.id);
            requestAnimationFrame(() => {
              setTimeout(() => {
                const el = blockRefs.current[prevBlock.id]?.current;
                if (el) {
                  el.focus();
                  const sel = window.getSelection();
                  if (sel) {
                    sel.selectAllChildren(el);
                    sel.collapseToEnd();
                  }
                }
              }, 15);
            });
          }
          return;
        }

        // B. If block is a single remaining empty list item, change it to text
        if (block.type !== "text" && block.content === "" && blocks.length === 1) {
          e.preventDefault();
          handleChangeType(blockId, "text");
          requestAnimationFrame(() => {
            setTimeout(() => {
              const el = blockRefs.current[blockId]?.current;
              if (el) {
                el.focus();
              }
            }, 15);
          });
          return;
        }

        // C. If list block or heading is non-empty, but caret is at offset 0, convert to text block (escape list style)
        if (el && isAtStart) {
          if (block.type !== "text") {
            e.preventDefault();
            handleChangeType(blockId, "text");
            requestAnimationFrame(() => {
              setTimeout(() => {
                const targetEl = blockRefs.current[blockId]?.current;
                if (targetEl) {
                  targetEl.focus();
                  const newSel = window.getSelection();
                  if (newSel) {
                    newSel.selectAllChildren(targetEl);
                    newSel.collapseToStart();
                  }
                }
              }, 15);
            });
            return;
          }

          // D. Merge non-empty text block into previous block if caret is at start
          if (idx > 0) {
            const prevBlock = blocks[idx - 1];
            const mergeableTypes = ["text", "h1", "h2", "h3", "h4", "bullet", "number", "todo", "quote", "callout"];
            if (mergeableTypes.includes(prevBlock.type)) {
              e.preventDefault();
              const prevContent = prevBlock.content || "";
              const currentContent = block.content || "";
              const mergedContent = prevContent + currentContent;

              setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
              setFutureBlocks([]);

              setBlocks((prev) => {
                const next = prev.filter((b) => b.id !== blockId);
                const targetIdx = next.findIndex((b) => b.id === prevBlock.id);
                if (targetIdx !== -1) {
                  next[targetIdx] = { ...next[targetIdx], content: mergedContent };
                }
                return next;
              });

              setSelectedId(prevBlock.id);
              requestAnimationFrame(() => {
                setTimeout(() => {
                  const targetEl = blockRefs.current[prevBlock.id]?.current;
                  if (targetEl) {
                    targetEl.focus();
                    const newSel = window.getSelection();
                    if (newSel) {
                      try {
                        let charCount = 0;
                        let found = false;
                        const walker = document.createTreeWalker(targetEl, NodeFilter.SHOW_TEXT, null, false);
                        let node;
                        while ((node = walker.nextNode())) {
                          const nextCount = charCount + node.length;
                          if (prevContent.length <= nextCount) {
                            const r = document.createRange();
                            r.setStart(node, Math.min(node.length, Math.max(0, prevContent.length - charCount)));
                            r.collapse(true);
                            newSel.removeAllRanges();
                            newSel.addRange(r);
                            found = true;
                            break;
                          }
                          charCount = nextCount;
                        }
                        if (!found) {
                          newSel.selectAllChildren(targetEl);
                          newSel.collapseToEnd();
                        }
                      } catch (_) {
                        newSel.selectAllChildren(targetEl);
                        newSel.collapseToEnd();
                      }
                    }
                  }
                }, 20);
              });
              return;
            }
          }
        }

      } else if (e.key === "Delete") {
        // Notion-style Divider, Site Bookmark, Media & Canvas Deletion:
        // When Delete is pressed at the end of a line before a divider, site, media or canvas block, delete it!
        const standaloneEmbedTypes = ["divider", "site", "media", "canvas"];
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
                if (idx !== -1 && idx < blocks.length - 1 && standaloneEmbedTypes.includes(blocks[idx + 1]?.type)) {
                  e.preventDefault();
                  const targetBlock = blocks[idx + 1];
                  setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
                  setFutureBlocks([]);
                  setBlocks((prev) => prev.filter((b) => b.id !== targetBlock.id));
                  return;
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
            let targetIdx = idx - 1;
            while (targetIdx >= 0 && blocks[targetIdx].type === "divider") targetIdx--;
            if (targetIdx >= 0) {
              const prevId = blocks[targetIdx].id;
              setSelectedId(prevId);
              blockRefs.current[prevId]?.current?.focus();
            }
          }
          return;
        }

        const el = blockRefs.current[blockId]?.current;
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(el);
            preCaretRange.setEnd(range.startContainer, range.startOffset);
            if (preCaretRange.toString().length === 0) {
              const idx = blocks.findIndex((b) => b.id === blockId);
              if (idx > 0) {
                e.preventDefault();
                let targetIdx = idx - 1;
                while (targetIdx >= 0 && blocks[targetIdx].type === "divider") targetIdx--;
                if (targetIdx >= 0) {
                  const prevId = blocks[targetIdx].id;
                  setSelectedId(prevId);
                  const prevEl = blockRefs.current[prevId]?.current;
                  if (prevEl) {
                    prevEl.focus();
                    const newSel = window.getSelection();
                    if (newSel) {
                      newSel.selectAllChildren(prevEl);
                      newSel.collapseToEnd();
                    }
                  }
                }
              }
            }
          }
        }
      } else if (e.key === "ArrowDown") {
        if (e.altKey) {
          e.preventDefault();
          const idx = blocks.findIndex((b) => b.id === blockId);
          if (idx < blocks.length - 1) {
            let targetIdx = idx + 1;
            while (targetIdx < blocks.length && blocks[targetIdx].type === "divider") targetIdx++;
            if (targetIdx < blocks.length) {
              const nextId = blocks[targetIdx].id;
              setSelectedId(nextId);
              blockRefs.current[nextId]?.current?.focus();
            }
          }
          return;
        }

        const el = blockRefs.current[blockId]?.current;
        if (el) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const postCaretRange = range.cloneRange();
            postCaretRange.selectNodeContents(el);
            postCaretRange.setStart(range.endContainer, range.endOffset);
            if (postCaretRange.toString().length === 0) {
              const idx = blocks.findIndex((b) => b.id === blockId);
              if (idx < blocks.length - 1) {
                e.preventDefault();
                let targetIdx = idx + 1;
                while (targetIdx < blocks.length && blocks[targetIdx].type === "divider") targetIdx++;
                if (targetIdx < blocks.length) {
                  const nextId = blocks[targetIdx].id;
                  setSelectedId(nextId);
                  const nextEl = blockRefs.current[nextId]?.current;
                  if (nextEl) {
                    nextEl.focus();
                    const newSel = window.getSelection();
                    if (newSel) {
                      newSel.selectAllChildren(nextEl);
                      newSel.collapseToStart();
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    [blocks, handleChangeType]
  );

  const activeBannerPreset = BANNER_PRESETS.find((b) => b.id === banner);

  // Compute sequential numbered list indices
  let currentNumber = 0;

  return (
    <div
      ref={editorContainerRef}
      onMouseDown={handleEditorMouseDown}
      onMouseMove={handleEditorMouseMove}
      onMouseUp={handleEditorMouseUp}
      onPaste={handleSmartPaste}
      className="relative min-h-full w-full pb-32"
    >
      {/* Marquee Selection Box Overlay */}
      {marqueeBox && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-duck-400/60 bg-duck-500/20 backdrop-blur-[1px] shadow-lg animate-pulse"
          style={{
            left: Math.min(marqueeBox.startX, marqueeBox.currentX),
            top: Math.min(marqueeBox.startY, marqueeBox.currentY),
            width: Math.abs(marqueeBox.currentX - marqueeBox.startX),
            height: Math.abs(marqueeBox.currentY - marqueeBox.startY),
          }}
        />
      )}
      {banner && (
        <div
          className={`group relative h-44 md:h-52 w-full border-b border-ink-800/40 shadow-lg transition-all ${banner.startsWith("data:image/") ? "" : (activeBannerPreset?.style || "bg-gradient-to-r from-indigo-600 to-purple-600")}`}
          style={banner.startsWith("data:image/") ? { backgroundImage: `url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
        />
      )}

      <div className={`absolute right-6 ${banner ? "top-4" : "top-3"} z-30 flex items-center gap-2`}>
        <div className="relative" ref={bannerPickerRef}>
          <button
            type="button"
            onClick={() => setShowBannerPicker(!showBannerPicker)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition-all ${
              banner
                ? "border-white/30 bg-ink-950/40 text-white opacity-60 hover:opacity-100 hover:bg-ink-950/80 hover:border-white/50"
                : "border-ink-700 bg-ink-900/90 text-ink-200 hover:border-duck-500/40 hover:text-duck-300"
            }`}
          >
            <span>🖼️</span>
            <span>{banner ? "Change Cover" : "Add Cover Banner"}</span>
          </button>

          {showBannerPicker && (
            <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl">
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
                      setShowBannerPicker(false);
                      onSaveNote?.({ title, blocks, banner: preset.id, isFavorite, emoji });
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
                        setShowBannerPicker(false);
                        onSaveNote?.({ title, blocks, banner: dataUrl, isFavorite, emoji });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {banner && (
                  <button
                    type="button"
                    onClick={() => {
                      setBanner(null);
                      setShowBannerPicker(false);
                      onSaveNote?.({ title, blocks, banner: null, isFavorite, emoji });
                    }}
                    className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10"
                  >
                    Remove Banner
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Note Content Container */}
      <div
        data-editor-root
        className="relative mx-auto max-w-3xl px-10 pt-4 pb-20 cursor-text"
        onClick={(e) => {
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
        {/* Controls Bar Below Banner: Add Icon, Note Menu & Quick Actions */}
        <div className="mb-4 pl-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative" ref={emojiPickerRef}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/90 px-3 py-1.5 text-xs font-semibold text-ink-300 shadow-sm backdrop-blur-md transition-all hover:border-duck-500/40 hover:text-duck-300"
              >
                <span>{emoji || "😀"}</span>
                <span>{emoji ? "Change Icon" : "Add Icon"}</span>
              </button>

              {showEmojiPicker && (
                <div className="absolute left-0 top-9 z-50 w-64 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl space-y-1.5 animate-fade-in">
                  <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Select Note Icon
                  </p>
                  <div className="grid grid-cols-6 gap-1 p-1">
                    {NOTE_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setEmoji(e);
                          setShowEmojiPicker(false);
                          onSaveNote?.({ title, blocks, banner, isFavorite, emoji: e });
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-ink-800"
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
                        setShowEmojiPicker(false);
                        onSaveNote?.({ title, blocks, banner, isFavorite, emoji: null });
                      }}
                      className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10"
                    >
                      Remove Icon
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Notion Large Note Icon & Title Input */}
        <div className="mb-6 pl-8">
          {emoji && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="print-content text-5xl leading-none transition-transform hover:scale-105"
                title="Change Icon"
              >
                {emoji}
              </button>
            </div>
          )}
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (blocks.length > 0) {
                  const firstId = blocks[0].id;
                  setSelectedId(firstId);
                  blockRefs.current[firstId]?.current?.focus();
                }
              }
            }}
            placeholder="Untitled Note"
            className="print-content w-full border-b border-ink-800/80 bg-transparent pt-1 pb-3 leading-snug text-4xl font-extrabold tracking-tight text-ink-100 placeholder:text-ink-700 focus:border-duck-500/50 focus:outline-none min-h-[3.5rem]"
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
                notesBySpace={notesBySpace}
                onSelectNote={onSelectNote}
                registerRef={registerRef}
                onSaveNote={() => onSaveNote?.({ title, blocks, banner, isFavorite, emoji })}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
