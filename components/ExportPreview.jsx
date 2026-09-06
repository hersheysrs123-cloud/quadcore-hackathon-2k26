"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  blocksToMarkdownLossy,
  blocksToHTMLLossy,
  blocksToPlainText,
  blocksToDocxBlob,
  getNormalizedTableData,
} from "@/lib/exportImport";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  Download,
  ArrowLeft,
  Copy,
  Check,
  Eye,
  Code2,
  FileText,
  FileCode,
  Globe,
  Sparkles,
  Layers,
} from "lucide-react";

const FORMAT_CONFIGS = {
  docx: {
    id: "docx",
    name: "Word Document",
    ext: ".docx",
    icon: "📝",
    badge: "Microsoft Word",
    color: "text-blue-400 border-blue-500/40 bg-blue-500/10",
    ribbonColor: "bg-[#1f4e79]",
    description: "Formatted Microsoft Word document with headings, tables, and callouts",
  },
  html: {
    id: "html",
    name: "HTML Web Page",
    ext: ".html",
    icon: "🌐",
    badge: "Standalone Web",
    color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    ribbonColor: "bg-emerald-800",
    description: "Self-contained HTML file with embedded styles and KaTeX math formulas",
  },
  txt: {
    id: "txt",
    name: "Plain Text",
    ext: ".txt",
    icon: "📑",
    badge: "Universal Text",
    color: "text-amber-400 border-amber-500/40 bg-amber-500/10",
    ribbonColor: "bg-amber-800",
    description: "Clean plain text document with structured ASCII headers and indentation",
  },
  md: {
    id: "md",
    name: "Markdown",
    ext: ".md",
    icon: "⬇️",
    badge: "Standard Markdown",
    color: "text-duck-300 border-duck-500/40 bg-duck-500/10",
    ribbonColor: "bg-duck-700",
    description: "Standard Markdown file compatible with Obsidian, GitHub, and Notion",
  },
};

export default function ExportPreview({
  note,
  format = "md",
  onFormatChange,
  onBack,
  onDownload,
  isProcessing = false,
}) {
  const [activeFormat, setActiveFormat] = useState(format);
  const [viewMode, setViewMode] = useState("rendered"); // "rendered" | "source" | "outline"
  const [copied, setCopied] = useState(false);
  const [docxBlob, setDocxBlob] = useState(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(null);

  const canvasRef = useRef(null);
  const iframeRef = useRef(null);

  // Synchronize incoming format prop with internal state
  useEffect(() => {
    if (format && FORMAT_CONFIGS[format]) {
      setActiveFormat(format);
    }
  }, [format]);

  // Reset scroll position to top whenever format or view mode toggles
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.scrollTop = 0;
    }
  }, [activeFormat, viewMode]);

  const title = note?.title || "Untitled Note";
  const blocks = note?.blocks || [];
  const emoji = note?.emoji || "📝";

  const currentCfg = FORMAT_CONFIGS[activeFormat] || FORMAT_CONFIGS.md;
  const safeBaseName = title.replace(/[^a-z0-9_-]/gi, "_") || "Note";
  const downloadFileName = `${safeBaseName}${currentCfg.ext}`;

  // Generate serialized exports
  const mdContent = useMemo(() => {
    try {
      return blocksToMarkdownLossy(blocks, title);
    } catch {
      return `# ${title}\n\n`;
    }
  }, [blocks, title]);

  const htmlContent = useMemo(() => {
    try {
      return blocksToHTMLLossy(blocks, title, emoji);
    } catch {
      return `<!DOCTYPE html><html><body><h1>${title}</h1></body></html>`;
    }
  }, [blocks, title, emoji]);

  const txtContent = useMemo(() => {
    try {
      return blocksToPlainText(blocks, title);
    } catch {
      return `${title}\n\n`;
    }
  }, [blocks, title]);

  // Generate DOCX blob for size estimation & metadata
  useEffect(() => {
    let isMounted = true;
    if (activeFormat === "docx") {
      setDocxLoading(true);
      blocksToDocxBlob(blocks, title, emoji)
        .then((blob) => {
          if (isMounted) {
            setDocxBlob(blob);
            setDocxLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setDocxLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [activeFormat, blocks, title, emoji]);

  // Handle iframe dynamic height and mouse wheel forwarding
  const handleIframeLoad = (e) => {
    try {
      const iframe = e?.target || iframeRef.current;
      if (!iframe) return;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const updateHeight = () => {
        try {
          const docEl = doc.documentElement;
          const body = doc.body;
          const contentH = Math.max(
            docEl ? docEl.scrollHeight : 0,
            body ? body.scrollHeight : 0,
            560
          );
          if (contentH > 100) {
            setIframeHeight(contentH + 24);
          }
        } catch {}
      };

      updateHeight();

      // Forward wheel events from inside the iframe to the canvas scroll container
      try {
        const handleWheel = (we) => {
          if (canvasRef.current) {
            canvasRef.current.scrollTop += we.deltaY;
          }
        };
        doc.removeEventListener("wheel", handleWheel);
        doc.addEventListener("wheel", handleWheel, { passive: true });
      } catch {}

      // Observe dynamic content changes (e.g. KaTeX math equations or font loading)
      if (typeof window !== "undefined" && window.ResizeObserver && doc.body) {
        const ro = new ResizeObserver(() => {
          updateHeight();
        });
        ro.observe(doc.body);
      }
    } catch (err) {
      console.warn("ExportPreview iframe resize handler:", err);
    }
  };

  // Compute file metadata
  const stats = useMemo(() => {
    let wordCount = 0;
    let charCount = 0;
    blocks.forEach((b) => {
      const text = String(b.content || "");
      charCount += text.length;
      const words = text.trim().split(/\s+/).filter(Boolean);
      wordCount += words.length;
    });

    let estimatedSize = "~1 KB";
    if (activeFormat === "docx") {
      if (docxBlob) {
        estimatedSize = `${(docxBlob.size / 1024).toFixed(1)} KB`;
      } else {
        estimatedSize = `~${Math.max(8, Math.round(charCount / 80 + 8))} KB`;
      }
    } else if (activeFormat === "html") {
      estimatedSize = `${(new Blob([htmlContent]).size / 1024).toFixed(1)} KB`;
    } else if (activeFormat === "txt") {
      estimatedSize = `${(new Blob([txtContent]).size / 1024).toFixed(1)} KB`;
    } else if (activeFormat === "md") {
      estimatedSize = `${(new Blob([mdContent]).size / 1024).toFixed(1)} KB`;
    }

    return {
      blockCount: blocks.length,
      wordCount,
      charCount,
      estimatedSize,
    };
  }, [blocks, activeFormat, docxBlob, htmlContent, txtContent, mdContent]);

  const handleSelectFormat = (fmtKey) => {
    setActiveFormat(fmtKey);
    setViewMode("rendered");
    if (onFormatChange) onFormatChange(fmtKey);
  };

  const handleCopy = () => {
    let textToCopy = "";
    if (activeFormat === "md") textToCopy = mdContent;
    else if (activeFormat === "html") textToCopy = htmlContent;
    else if (activeFormat === "txt") textToCopy = txtContent;
    else if (activeFormat === "docx") textToCopy = txtContent;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-ink-950 text-ink-100 animate-fade-in overflow-hidden">
      {/* ─── Top Control Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 bg-ink-950/80 px-4 sm:px-6 py-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-ink-300 hover:bg-ink-800 hover:text-ink-100 transition-colors shrink-0"
            title="Return to format selection"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to Formats</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="h-4 w-px bg-ink-800 shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{currentCfg.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-ink-100 truncate">
                  {downloadFileName}
                </span>
                <span
                  className={`hidden sm:inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border shrink-0 ${currentCfg.color}`}
                >
                  {currentCfg.badge}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-ink-400">
                <span>{stats.estimatedSize}</span>
                <span>•</span>
                <span>{stats.blockCount} blocks</span>
                <span>•</span>
                <span>{stats.wordCount} words</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Format Switcher Tabs */}
        <div className="flex items-center gap-1 bg-ink-900/90 border border-ink-800 p-1 rounded-xl shrink-0">
          {Object.values(FORMAT_CONFIGS).map((cfg) => (
            <button
              key={cfg.id}
              type="button"
              onClick={() => handleSelectFormat(cfg.id)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                activeFormat === cfg.id
                  ? "bg-duck-500 text-ink-950 font-bold shadow-xs"
                  : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/60"
              }`}
              title={`Preview as ${cfg.name} (${cfg.ext})`}
            >
              <span>{cfg.icon}</span>
              <span className="hidden md:inline">{cfg.name}</span>
              <span className="md:hidden">{cfg.ext}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Sub-Bar: View Toggles & Actions ─── */}
      <div className="flex items-center justify-between border-b border-ink-800/80 bg-ink-900/40 px-4 sm:px-6 py-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {activeFormat === "md" && (
            <>
              <button
                type="button"
                onClick={() => setViewMode("rendered")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "rendered"
                    ? "bg-duck-500/20 text-duck-300 border border-duck-500/40"
                    : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/50"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Formatted Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("source")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "source"
                    ? "bg-duck-500/20 text-duck-300 border border-duck-500/40"
                    : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/50"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Raw Markdown (.md)</span>
              </button>
            </>
          )}

          {activeFormat === "html" && (
            <>
              <button
                type="button"
                onClick={() => setViewMode("rendered")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "rendered"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/50"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Rendered Web Page</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("source")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "source"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/50"
                }`}
              >
                <FileCode className="h-3.5 w-3.5" />
                <span>HTML Source (.html)</span>
              </button>
            </>
          )}

          {activeFormat === "docx" && (
            <>
              <button
                type="button"
                onClick={() => setViewMode("rendered")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "rendered"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                    : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/50"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Word Document Page View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("outline")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "outline"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                    : "text-ink-400 hover:text-ink-200 hover:bg-ink-800/50"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Document Outline</span>
              </button>
            </>
          )}

          {activeFormat === "txt" && (
            <div className="flex items-center gap-1.5 text-xs text-amber-300/90 font-medium">
              <FileText className="h-3.5 w-3.5" />
              <span>Plain Text Editor Layout</span>
            </div>
          )}
        </div>

        {/* Copy to Clipboard & Scroll Hint */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-ink-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-duck-400/80 animate-pulse" />
            <span>Scrollable Preview</span>
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-ink-800 bg-ink-900 px-2.5 py-1 text-xs font-semibold text-ink-300 hover:bg-ink-800 hover:text-ink-100 transition-colors"
            title="Copy file contents to clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied!" : "Copy Content"}</span>
          </button>
        </div>
      </div>

      {/* ─── Main Preview Canvas ─── */}
      <div
        ref={canvasRef}
        tabIndex={0}
        role="region"
        aria-label="Export document preview canvas"
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-ink-900/30 overscroll-contain focus:outline-none focus-visible:ring-1 focus-visible:ring-duck-500/30 scrollbar-thin scrollbar-thumb-ink-700/80 hover:scrollbar-thumb-duck-500/50 scrollbar-track-transparent scroll-smooth"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* 1. WORD DOCUMENT (.docx) PREVIEW */}
        {activeFormat === "docx" && (
          <div className="max-w-3xl mx-auto space-y-4 pb-8">
            {viewMode === "rendered" ? (
              <div className="rounded-xl border border-gray-300/30 shadow-2xl overflow-hidden bg-white text-gray-900 select-text">
                {/* Word Document Ribbon Header */}
                <div className="flex items-center justify-between border-b border-gray-200 bg-[#1f4e79] px-4 py-2 text-white text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">W</span>
                    <span>Microsoft Word (.docx) Document Preview</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-blue-100">
                    <span>Print Layout View</span>
                    <span>•</span>
                    <span>100% Zoom</span>
                  </div>
                </div>

                {/* 8.5 x 11 Simulated Word Page Sheet */}
                <div className="p-8 sm:p-14 min-h-[580px] bg-white font-sans leading-relaxed">
                  {/* Document Title Header */}
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#1f4e79] border-b-2 border-[#1f4e79]/20 pb-3 mb-6 flex items-center gap-2.5">
                    <span>{emoji}</span>
                    <span>{title}</span>
                  </h1>

                  {/* Document Blocks in Word Typography */}
                  <div className="space-y-4 text-[13.5px] text-gray-800">
                    {blocks.length === 0 ? (
                      <p className="text-gray-400 italic">This note is currently empty.</p>
                    ) : (
                      blocks.map((b, idx) => (
                        <WordBlockItem key={b.id || idx} block={b} />
                      ))
                    )}
                  </div>

                  {/* Word Page Footer */}
                  <div className="mt-14 pt-4 border-t border-gray-200 text-center text-xs text-gray-400 flex items-center justify-between">
                    <span>{title}</span>
                    <span>Page 1 of 1</span>
                    <span className="text-[10px]">SocraticOS Word Exporter</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Word Outline View */
              <div className="rounded-xl border border-ink-800 bg-ink-950 p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span>Document Structure & Sections ({blocks.length} blocks)</span>
                </h3>
                <div className="divide-y divide-ink-900 border border-ink-800/80 rounded-xl overflow-hidden bg-ink-900/40">
                  {blocks.map((b, idx) => (
                    <div key={b.id || idx} className="flex items-start gap-3 p-3 text-xs">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-mono uppercase bg-ink-800 text-ink-300 font-bold shrink-0">
                        {b.type || "text"}
                      </span>
                      <p className="text-ink-200 truncate flex-1 font-mono text-[11px]">
                        {b.content || (b.type === "table" ? "Table Block" : "(empty)")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. HTML WEB PAGE (.html) PREVIEW */}
        {activeFormat === "html" && (
          <div className="max-w-4xl mx-auto pb-8">
            {viewMode === "rendered" ? (
              <div className="rounded-xl border border-ink-700 shadow-2xl overflow-hidden bg-ink-950">
                {/* Browser Mockup Header */}
                <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-4 py-2 text-xs shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-ink-400 ml-2 font-mono text-[11px]">
                      Standalone HTML Preview
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-ink-950 border border-ink-800 rounded-md px-3 py-1 text-[11px] font-mono text-ink-300 max-w-sm truncate">
                    <Globe className="h-3 w-3 shrink-0 text-emerald-400" />
                    <span className="truncate">file:///exports/{downloadFileName}</span>
                  </div>
                </div>

                {/* Rendered Isolated Sandbox iFrame */}
                <div className="relative w-full bg-[#12151e]">
                  <iframe
                    ref={iframeRef}
                    title="Exported HTML Web Page Preview"
                    srcDoc={htmlContent}
                    sandbox="allow-same-origin allow-scripts"
                    onLoad={handleIframeLoad}
                    style={{
                      minHeight: "560px",
                      height: iframeHeight ? `${iframeHeight}px` : "auto",
                    }}
                    className="w-full border-0 block"
                  />
                </div>
              </div>
            ) : (
              /* Raw HTML Source View */
              <CodeBlockViewer code={htmlContent} language="html" />
            )}
          </div>
        )}

        {/* 3. PLAIN TEXT (.txt) PREVIEW */}
        {activeFormat === "txt" && (
          <div className="max-w-3xl mx-auto rounded-xl border border-ink-800 bg-ink-950 shadow-2xl overflow-hidden mb-8">
            <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900/80 px-4 py-2 text-xs font-mono text-ink-400">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-amber-400" />
                <span>{downloadFileName} — Plain Text (UTF-8)</span>
              </div>
              <span>{stats.wordCount} words</span>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto select-text font-mono text-xs sm:text-[13px] leading-relaxed text-ink-200 whitespace-pre">
              {txtContent}
            </div>
          </div>
        )}

        {/* 4. MARKDOWN (.md) PREVIEW */}
        {activeFormat === "md" && (
          <div className="max-w-3xl mx-auto pb-8">
            {viewMode === "rendered" ? (
              <div className="rounded-xl border border-ink-800 bg-ink-950 p-6 sm:p-8 shadow-2xl space-y-4">
                <div className="border-b border-ink-800 pb-3 mb-4">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-ink-100 flex items-center gap-2">
                    <span>{emoji}</span>
                    <span>{title}</span>
                  </h1>
                  <p className="text-xs text-ink-400 mt-1">Rendered Markdown Preview</p>
                </div>
                <div className="prose prose-invert max-w-none select-text">
                  <MarkdownRenderer content={mdContent} />
                </div>
              </div>
            ) : (
              /* Raw Markdown Source View */
              <CodeBlockViewer code={mdContent} language="markdown" />
            )}
          </div>
        )}
      </div>

      {/* ─── Bottom Footer Download Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 bg-ink-950 px-4 sm:px-6 py-3.5 shrink-0">
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <Sparkles className="h-4 w-4 text-duck-400 shrink-0" />
          <span>
            Preview matches the exported file. Click below to download directly to your machine.
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-ink-700 px-4 py-2 text-xs font-semibold text-ink-300 hover:bg-ink-800 transition-colors"
          >
            Change Format
          </button>

          <button
            type="button"
            onClick={() => onDownload && onDownload(activeFormat)}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 rounded-xl border border-duck-500/40 bg-duck-500 px-5 py-2 text-xs font-bold text-ink-950 hover:bg-duck-400 disabled:opacity-50 transition-all shadow-md active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>
              {isProcessing ? "Downloading..." : `Download ${downloadFileName}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Clean Monospace Code Block Viewer with line numbering
 */
function CodeBlockViewer({ code = "", language = "code" }) {
  const lines = code.split("\n");
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950 shadow-2xl overflow-hidden mb-8">
      <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-4 py-2 text-xs font-mono text-ink-400">
        <span className="uppercase font-bold text-ink-300">{language} Source Code</span>
        <span>{lines.length} lines</span>
      </div>
      <div className="p-4 sm:p-5 overflow-x-auto select-text font-mono text-[11px] sm:text-xs leading-relaxed text-ink-200">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-ink-900/40">
                <td className="w-10 pr-4 text-right select-none text-ink-600 font-mono text-[10px]">
                  {idx + 1}
                </td>
                <td className="whitespace-pre font-mono text-ink-100">{line || " "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Word Document Block Renderer
 */
function WordBlockItem({ block }) {
  const type = block.type || "text";
  const content = block.content || "";

  switch (type) {
    case "h1":
      return <h2 className="text-xl font-bold text-[#1f4e79] mt-4 mb-2">{content}</h2>;
    case "h2":
      return <h3 className="text-lg font-bold text-[#2e74b5] mt-3 mb-1">{content}</h3>;
    case "h3":
      return <h4 className="text-base font-semibold text-[#1f4e79] mt-2 mb-1">{content}</h4>;
    case "h4":
      return <h5 className="text-sm font-semibold text-[#2e74b5] mt-2 mb-1">{content}</h5>;
    case "bullet": {
      const lvl = Math.max(0, Math.min(4, Number(block.level) || 0));
      return (
        <div className="flex items-start gap-2 my-1" style={{ marginLeft: `${lvl * 1.5}rem` }}>
          <span className="text-[#1f4e79] select-none">•</span>
          <span>{content}</span>
        </div>
      );
    }
    case "number":
      return (
        <div className="flex items-start gap-2 my-1 ml-4">
          <span className="text-[#1f4e79] select-none font-semibold">1.</span>
          <span>{content}</span>
        </div>
      );
    case "todo":
      return (
        <div className="flex items-center gap-2.5 my-1 ml-2">
          <input
            type="checkbox"
            checked={Boolean(block.checked)}
            readOnly
            className="rounded border-gray-300 text-blue-600 pointer-events-none"
          />
          <span className={block.checked ? "line-through text-gray-400" : ""}>{content}</span>
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-[#2e74b5] pl-4 py-1.5 my-3 italic text-gray-700 bg-blue-50/40 rounded-r">
          {content}
        </blockquote>
      );
    case "callout":
      return (
        <div className="border border-amber-300 bg-amber-50/60 rounded-md p-3 my-3 flex items-start gap-2.5 text-gray-800">
          <span className="text-base shrink-0">{block.calloutIcon || "💡"}</span>
          <div className="text-xs sm:text-[13px]">{content}</div>
        </div>
      );
    case "code":
      return (
        <div className="my-3 border border-gray-300 rounded-md bg-gray-50 overflow-hidden">
          <div className="bg-gray-100 px-3 py-1 text-[10px] font-mono text-gray-500 uppercase font-semibold">
            {block.language || "code"}
          </div>
          <pre className="p-3 text-xs font-mono overflow-x-auto text-gray-800 leading-normal">
            <code>{content}</code>
          </pre>
        </div>
      );
    case "table": {
      const data = getNormalizedTableData(block.tableData, block.content);
      const headers = data.headers && data.headers.length > 0 ? data.headers : ["Col 1", "Col 2"];
      const rows = data.rows || [];
      return (
        <div className="my-3 overflow-x-auto border border-gray-300 rounded-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#1f4e79]/10 border-b border-gray-300 text-[#1f4e79] font-bold">
                {headers.map((h, i) => (
                  <th key={i} className="p-2 border-r border-gray-300 last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 1 ? "bg-gray-50" : ""}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2 border-r border-gray-200 last:border-r-0">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "divider":
      return <hr className="border-t border-gray-300 my-4" />;
    case "text":
    default:
      return content ? <p className="my-1.5 leading-relaxed">{content}</p> : null;
  }
}
