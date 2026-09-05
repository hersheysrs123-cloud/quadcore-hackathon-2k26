"use client";

import React, { useMemo, memo, useState } from "react";
import "katex/dist/katex.min.css";
import { renderKatexToStringMemoized } from "@/lib/editorCaret";
import { parseMathSegments } from "@/lib/mathUtils";
import { tokenizeCode, normalizeLanguage, TOKEN_STYLES } from "@/lib/syntaxHighlighter";
import { Check, Copy } from "lucide-react";

/**
 * Enhanced Markdown text renderer for AI Tutor responses and study dialogues.
 * Converts inline formatting (bold, italic, inline code, inline math, links)
 * while delegating math expressions to KaTeX.
 */
export function FormattedInline({ text = "" }) {
  const elements = useMemo(() => {
    if (!text) return null;

    // First isolate math segments ($...$ and $$...$$)
    const mathSegs = parseMathSegments(text);

    return mathSegs.map((seg, segIdx) => {
      if (seg.type === "display_math") {
        const html = renderKatexToStringMemoized(seg.content, { displayMode: true });
        return (
          <span
            key={`math_disp_${segIdx}`}
            className="block my-2 overflow-x-auto text-center py-1 select-text"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
      if (seg.type === "inline_math") {
        const html = renderKatexToStringMemoized(seg.content, { displayMode: false });
        return (
          <span
            key={`math_inl_${segIdx}`}
            className="inline-block align-baseline mx-0.5 select-text font-serif"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      // Format standard inline markdown within text:
      // code (`code`), bold (**bold**), italic (*italic* or _italic_), strikethrough (~~del~~), links ([text](url))
      const content = seg.content;
      const parts = [];
      const inlineRegex = /(`[^`\n]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(__[^_]+__)|(_[^_]+_)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\))/g;
      let lastPos = 0;
      let match;

      while ((match = inlineRegex.exec(content)) !== null) {
        if (match.index > lastPos) {
          parts.push(content.slice(lastPos, match.index));
        }

        const raw = match[0];
        const key = `part_${segIdx}_${match.index}`;

        if (raw.startsWith("`") && raw.endsWith("`")) {
          // Inline code
          parts.push(
            <code key={key} className="rounded bg-ink-800 border border-ink-700/80 px-1.5 py-0.5 text-[11px] font-mono text-duck-300">
              {raw.slice(1, -1)}
            </code>
          );
        } else if (raw.startsWith("***") && raw.endsWith("***")) {
          parts.push(
            <strong key={key} className="font-bold text-ink-100 italic text-ink-200">
              {raw.slice(3, -3)}
            </strong>
          );
        } else if (raw.startsWith("**") && raw.endsWith("**")) {
          parts.push(
            <strong key={key} className="font-bold text-ink-100">
              {raw.slice(2, -2)}
            </strong>
          );
        } else if (raw.startsWith("*") && raw.endsWith("*")) {
          parts.push(
            <em key={key} className="italic text-ink-200">
              {raw.slice(1, -1)}
            </em>
          );
        } else if (raw.startsWith("__") && raw.endsWith("__")) {
          parts.push(
            <strong key={key} className="font-bold text-ink-100">
              {raw.slice(2, -2)}
            </strong>
          );
        } else if (raw.startsWith("_") && raw.endsWith("_")) {
          parts.push(
            <em key={key} className="italic text-ink-200">
              {raw.slice(1, -1)}
            </em>
          );
        } else if (raw.startsWith("~~") && raw.endsWith("~~")) {
          parts.push(
            <del key={key} className="line-through text-ink-500">
              {raw.slice(2, -2)}
            </del>
          );
        } else if (raw.startsWith("[") && raw.includes("](") && raw.endsWith(")")) {
          const linkMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (linkMatch) {
            parts.push(
              <a
                key={key}
                href={linkMatch[2]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-duck-400 hover:text-duck-300 underline decoration-duck-500/40 underline-offset-2"
              >
                {linkMatch[1]}
              </a>
            );
          } else {
            parts.push(raw);
          }
        } else {
          parts.push(raw);
        }

        lastPos = match.index + raw.length;
      }

      if (lastPos < content.length) {
        parts.push(content.slice(lastPos));
      }

      return <React.Fragment key={`text_frag_${segIdx}`}>{parts}</React.Fragment>;
    });
  }, [text]);

  return <>{elements}</>;
}

/**
 * Fenced Code Block with copy action and syntax highlighting.
 */
function TutorCodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  const normLang = normalizeLanguage(language);
  const tokens = useMemo(() => tokenizeCode(code || "", normLang), [code, normLang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl border border-ink-800 bg-ink-950 overflow-hidden text-left shadow-xs">
      <div className="flex items-center justify-between border-b border-ink-800/80 bg-ink-900 px-3 py-1 text-[10px] text-ink-400">
        <span className="font-mono uppercase font-bold tracking-wider text-ink-300">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-ink-200 transition-colors p-0.5"
          title="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed select-text">
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
      </pre>
    </div>
  );
}

/**
 * Markdown Table renderer.
 */
function TutorTable({ headers, rows }) {
  return (
    <div className="my-2.5 overflow-x-auto rounded-xl border border-ink-800 bg-ink-950/80 shadow-xs">
      <table className="w-full text-left text-xs border-collapse">
        {headers && headers.length > 0 && (
          <thead>
            <tr className="border-b border-ink-800 bg-ink-900 text-ink-200 font-semibold">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 border-r border-ink-800 last:border-r-0">
                  <FormattedInline text={h} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-ink-800 text-ink-300">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-ink-900/40 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-1.5 border-r border-ink-800 last:border-r-0 align-top">
                  <FormattedInline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Parses markdown blocks: headings, lists, code fences, blockquotes, tables, and paragraphs.
 */
export function MarkdownRenderer({ content, className = "" }) {
  const blocks = useMemo(() => {
    if (!content) return [];
    const lines = String(content).split("\n");
    const result = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 1. Fenced code block (```lang ... ```)
      if (trimmed.startsWith("```")) {
        const lang = trimmed.slice(3).trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        result.push({
          type: "code",
          language: lang,
          code: codeLines.join("\n"),
        });
        i++;
        continue;
      }

      // 2. Fenced display math ($$ ... $$)
      if (trimmed.startsWith("$$") && !trimmed.slice(2).includes("$$")) {
        const mathLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("$$")) {
          mathLines.push(lines[i]);
          i++;
        }
        result.push({
          type: "math",
          content: mathLines.join("\n"),
        });
        i++;
        continue;
      }

      // 3. Headings (#, ##, ###, ####)
      if (trimmed.startsWith("#### ")) {
        result.push({ type: "h4", content: trimmed.slice(5) });
        i++;
        continue;
      }
      if (trimmed.startsWith("### ")) {
        result.push({ type: "h3", content: trimmed.slice(4) });
        i++;
        continue;
      }
      if (trimmed.startsWith("## ")) {
        result.push({ type: "h2", content: trimmed.slice(3) });
        i++;
        continue;
      }
      if (trimmed.startsWith("# ")) {
        result.push({ type: "h1", content: trimmed.slice(2) });
        i++;
        continue;
      }

      // 4. Blockquote (> ...)
      if (trimmed.startsWith("> ")) {
        const quoteLines = [trimmed.slice(2)];
        i++;
        while (i < lines.length && lines[i].trim().startsWith("> ")) {
          quoteLines.push(lines[i].trim().slice(2));
          i++;
        }
        result.push({ type: "quote", content: quoteLines.join("\n") });
        continue;
      }

      // 5. Horizontal rule (--- or ***)
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
        result.push({ type: "divider" });
        i++;
        continue;
      }

      // 6. Markdown Table (| Col 1 | Col 2 |)
      if (trimmed.startsWith("|") && trimmed.endsWith("|") && i + 1 < lines.length && lines[i + 1].includes("---")) {
        const parseRow = (r) => r.split("|").slice(1, -1).map((c) => c.trim());
        const headers = parseRow(trimmed);
        i += 2; // skip header and delimiter row
        const tableRows = [];
        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
          tableRows.push(parseRow(lines[i].trim()));
          i++;
        }
        result.push({ type: "table", headers, rows: tableRows });
        continue;
      }

      // 7. Unordered List (- , * , + )
      if (/^[-*+]\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
          i++;
        }
        result.push({ type: "ul", items });
        continue;
      }

      // 8. Ordered List (1. , 2. )
      if (/^\d+\.\s+/.test(trimmed)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
          i++;
        }
        result.push({ type: "ol", items });
        continue;
      }

      // 9. Blank line
      if (!trimmed) {
        i++;
        continue;
      }

      // 10. Normal Paragraph (accumulate continuous text lines)
      const paraLines = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith("#") &&
        !lines[i].trim().startsWith("```") &&
        !lines[i].trim().startsWith("$$") &&
        !lines[i].trim().startsWith("> ") &&
        !/^[-*+]\s+/.test(lines[i].trim()) &&
        !/^\d+\.\s+/.test(lines[i].trim()) &&
        !lines[i].trim().startsWith("|")
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      result.push({ type: "p", content: paraLines.join(" ") });
    }

    return result;
  }, [content]);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h1":
            return (
              <h1 key={idx} className="text-base font-bold text-ink-100 border-b border-ink-800 pb-1 mt-2">
                <FormattedInline text={block.content} />
              </h1>
            );
          case "h2":
            return (
              <h2 key={idx} className="text-sm font-bold text-duck-300 mt-2">
                <FormattedInline text={block.content} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={idx} className="text-xs font-bold text-ink-200 mt-1.5 uppercase tracking-wide">
                <FormattedInline text={block.content} />
              </h3>
            );
          case "h4":
            return (
              <h4 key={idx} className="text-xs font-semibold text-ink-300 mt-1">
                <FormattedInline text={block.content} />
              </h4>
            );
          case "code":
            return <TutorCodeBlock key={idx} language={block.language} code={block.code} />;
          case "math":
            return (
              <div
                key={idx}
                className="my-2 overflow-x-auto text-center py-1.5 px-3 rounded-lg bg-ink-950 border border-ink-800/80"
                dangerouslySetInnerHTML={{
                  __html: renderKatexToStringMemoized(block.content, { displayMode: true }),
                }}
              />
            );
          case "table":
            return <TutorTable key={idx} headers={block.headers} rows={block.rows} />;
          case "quote":
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-duck-400/80 bg-ink-950/60 pl-3 py-1 text-xs italic text-ink-300 rounded-r-md"
              >
                <FormattedInline text={block.content} />
              </blockquote>
            );
          case "ul":
            return (
              <ul key={idx} className="list-disc pl-4 space-y-1 text-xs text-ink-200">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    <FormattedInline text={item} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="list-decimal pl-4 space-y-1 text-xs text-ink-200">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    <FormattedInline text={item} />
                  </li>
                ))}
              </ol>
            );
          case "divider":
            return <hr key={idx} className="border-t border-ink-800 my-2" />;
          case "p":
          default:
            return (
              <p key={idx} className="text-xs leading-relaxed text-ink-200">
                <FormattedInline text={block.content} />
              </p>
            );
        }
      })}
    </div>
  );
}

export default memo(MarkdownRenderer);
