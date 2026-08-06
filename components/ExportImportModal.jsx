"use client";

import { useState, useRef, useEffect } from "react";
import { SPACES } from "@/lib/constants";
import {
  exportToPdf,
  exportDocx,
  exportHtml,
  exportTxt,
  exportMarkdown,
  importNoteFromFile,
} from "@/lib/exportImport";
import { exportWorkspaceToJSON } from "@/lib/backup";
import { FileText, Download, Upload, X, Check, FileType, Sparkles, Package } from "lucide-react";

export default function ExportImportModal({
  open,
  onClose,
  activeNote,
  activeSpace,
  spaces = [],
  onImportSuccess,
}) {
  const [tab, setTab] = useState("export"); // "export" | "import"
  const [exportFormat, setExportFormat] = useState("socratic"); // "socratic" | "pdf" | "docx" | "html" | "txt" | "md"
  const [exportSpace, setExportSpace] = useState(activeSpace || "All");
  const [importSpace, setImportSpace] = useState(activeSpace || "School");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (activeSpace) {
      setImportSpace(activeSpace);
      setExportSpace(activeSpace);
    }
  }, [activeSpace]);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const formats = [
    {
      id: "socratic",
      name: "Socratic Package (.socratic)",
      ext: ".socratic",
      icon: "📦",
      description: "Space or full workspace backup file containing notes & metadata",
      badge: "Space Backup",
    },
    {
      id: "pdf",
      name: "PDF Document (.pdf)",
      ext: ".pdf",
      icon: "📄",
      description: "Clean styled PDF with KaTeX math equations (print layout)",
      badge: "Print & Save",
    },
    {
      id: "docx",
      name: "Word Document (.docx)",
      ext: ".docx",
      icon: "📝",
      description: "Microsoft Word file with formatted headings, lists & text",
      badge: "Word format",
    },
    {
      id: "html",
      name: "HTML Web Page (.html)",
      ext: ".html",
      icon: "🌐",
      description: "Standalone HTML document with embedded CSS & KaTeX CDN",
      badge: "Web standard",
    },
    {
      id: "txt",
      name: "Plain Text (.txt)",
      ext: ".txt",
      icon: "📑",
      description: "Clean plain text with structured indentation & ASCII symbols",
      badge: "Universal",
    },
    {
      id: "md",
      name: "Markdown (.md)",
      ext: ".md",
      icon: "⬇️",
      description: "Standard Markdown syntax compatible with Obsidian & Notion",
      badge: "Developer",
    },
  ];

  const handleExport = async () => {
    setIsProcessing(true);
    const title = activeNote?.title || "Untitled Note";
    const blocks = activeNote?.blocks || [];
    const emoji = activeNote?.emoji || "📝";

    try {
      if (exportFormat === "socratic") {
        const res = await exportWorkspaceToJSON(exportSpace);
        setToastMessage(`✓ Exported ${res.count} notes from "${exportSpace}" to ${res.filename}`);
      } else if (exportFormat === "pdf") {
        if (!activeNote) throw new Error("No active note to export.");
        exportToPdf(title);
        setToastMessage("✓ Triggered PDF Print Dialog");
      } else if (exportFormat === "docx") {
        if (!activeNote) throw new Error("No active note to export.");
        await exportDocx(blocks, title, emoji);
        setToastMessage(`✓ Downloaded ${title}.docx`);
      } else if (exportFormat === "html") {
        if (!activeNote) throw new Error("No active note to export.");
        exportHtml(blocks, title, emoji);
        setToastMessage(`✓ Downloaded ${title}.html`);
      } else if (exportFormat === "txt") {
        if (!activeNote) throw new Error("No active note to export.");
        exportTxt(blocks, title);
        setToastMessage(`✓ Downloaded ${title}.txt`);
      } else if (exportFormat === "md") {
        if (!activeNote) throw new Error("No active note to export.");
        exportMarkdown(blocks, title);
        setToastMessage(`✓ Downloaded ${title}.md`);
      }
    } catch (err) {
      console.error("Export error:", err);
      setToastMessage("❌ Export failed: " + err.message);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setToastMessage("⚠️ Please select a file to import.");
      return;
    }

    setIsProcessing(true);
    try {
      const importedNote = await importNoteFromFile(selectedFile, importSpace);
      setToastMessage(`✓ Successfully imported into "${importSpace}" space!`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (onImportSuccess) {
        onImportSuccess(importedNote);
      }

      setTimeout(() => {
        setToastMessage("");
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Import error:", err);
      setToastMessage("❌ Import failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4 bg-ink-950/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-duck-500/30 bg-duck-500/10 text-duck-300">
              <FileType className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink-100">Note Import & Export</h2>
              <p className="text-xs text-ink-400">.socratic Space Backups, PDF, Word, HTML, TXT & MD</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-ink-800 bg-ink-950/30 px-6 pt-3">
          <button
            type="button"
            onClick={() => setTab("export")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              tab === "export"
                ? "border-duck-400 text-duck-300"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Export Notes & Spaces</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("import")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              tab === "import"
                ? "border-duck-400 text-duck-300"
                : "border-transparent text-ink-400 hover:text-ink-200"
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Import Note / Space File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {toastMessage && (
            <div className="rounded-xl border border-duck-500/40 bg-duck-500/10 px-4 py-3 text-xs font-semibold text-duck-200 animate-fade-in flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-duck-300" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* EXPORT TAB */}
          {tab === "export" && (
            <div className="space-y-4">
              {/* Active Note Preview Card */}
              <div className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-850/60 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{activeNote?.emoji || "📝"}</span>
                  <div>
                    <h3 className="font-bold text-sm text-ink-100">
                      {activeNote?.title || "Untitled Note"}
                    </h3>
                    <p className="text-xs text-ink-400">
                      Current Space: <span className="text-duck-300 font-medium">{activeSpace || "School"}</span> • Blocks: {(activeNote?.blocks || []).length}
                    </p>
                  </div>
                </div>
                <span className="rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1 text-[11px] font-mono text-ink-300">
                  Ready to export
                </span>
              </div>

              {/* Space Picker for .socratic Package Export */}
              {exportFormat === "socratic" && (
                <div className="rounded-xl border border-duck-500/30 bg-duck-500/10 p-4 space-y-2 animate-fade-in">
                  <label className="text-xs font-bold uppercase tracking-wider text-duck-300 flex items-center gap-1.5">
                    <Package className="h-4 w-4" />
                    <span>Choose Space to Export (.socratic):</span>
                  </label>
                  <p className="text-[11px] text-duck-200/80">
                    Select a single space to export its notes or choose &quot;All Spaces&quot; to export your full workspace backup.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[{ name: "All", icon: "🌐" }, ...spaces].map((sp) => (
                      <button
                        key={sp.name}
                        type="button"
                        onClick={() => setExportSpace(sp.name)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                          exportSpace === sp.name
                            ? "border-duck-400 bg-duck-500/30 text-duck-200 shadow-sm"
                            : "border-ink-700 bg-ink-900/60 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                        }`}
                      >
                        <span>{sp.icon}</span>
                        <span>{sp.name === "All" ? "All Spaces" : sp.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-400">
                  Select Format:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {formats.map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setExportFormat(fmt.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                        exportFormat === fmt.id
                          ? "border-duck-500/60 bg-duck-500/15 shadow-sm"
                          : "border-ink-800 bg-ink-950/40 hover:border-ink-700 hover:bg-ink-850/40"
                      }`}
                    >
                      <span className="text-2xl shrink-0 mt-0.5">{fmt.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-ink-100">{fmt.name}</span>
                          <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-ink-800 text-ink-300 border border-ink-700">
                            {fmt.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-400 mt-1 line-clamp-2">
                          {fmt.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* IMPORT TAB */}
          {tab === "import" && (
            <div className="space-y-4">
              {/* Target Space Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-400">
                  Target Space for Import:
                </label>
                <p className="text-[11px] text-ink-400">
                  Select which space to assign the imported note/backup to:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setImportSpace("Original")}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      importSpace === "Original"
                        ? "border-duck-500/60 bg-duck-500/20 text-duck-300"
                        : "border-ink-800 bg-ink-950/40 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                    }`}
                  >
                    <span>🔄</span>
                    <span>Original Spaces (File Defaults)</span>
                  </button>

                  {spaces.map((space) => (
                    <button
                      key={space.name}
                      type="button"
                      onClick={() => setImportSpace(space.name)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        importSpace === space.name
                          ? "border-duck-500/60 bg-duck-500/20 text-duck-300"
                          : "border-ink-800 bg-ink-950/40 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                      }`}
                    >
                      <span>{space.icon}</span>
                      <span>{space.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* File Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? "border-duck-400 bg-duck-500/10"
                    : "border-ink-700 bg-ink-950/50 hover:border-duck-500/50 hover:bg-ink-850/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".socratic,.json,.docx,.html,.htm,.txt,.md,.markdown"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-duck-500/20 text-duck-300 text-2xl">
                      📄
                    </div>
                    <div>
                      <p className="font-bold text-sm text-ink-100">{selectedFile.name}</p>
                      <p className="text-xs text-ink-400 mt-0.5">
                        Size: {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-ink-300">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-ink-200">
                        Click to browse or drop your note / space backup file here
                      </p>
                      <p className="text-xs text-ink-400 mt-1">
                        Supports <span className="text-duck-300 font-semibold">.socratic, .docx, .html, .txt, .md</span> files
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-ink-800 px-6 py-4 bg-ink-950/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-ink-700 px-4 py-2 text-xs font-semibold text-ink-300 hover:bg-ink-800 transition-colors"
          >
            Cancel
          </button>

          {tab === "export" ? (
            <button
              type="button"
              onClick={handleExport}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-xl border border-duck-500/40 bg-duck-500 px-5 py-2 text-xs font-bold text-ink-950 hover:bg-duck-400 disabled:opacity-50 transition-all shadow-md"
            >
              <Download className="h-4 w-4" />
              <span>{isProcessing ? "Exporting..." : `Export ${exportFormat === "socratic" ? `"${exportSpace}" Space` : exportFormat.toUpperCase()}`}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleImport}
              disabled={isProcessing || !selectedFile}
              className="inline-flex items-center gap-2 rounded-xl border border-duck-500/40 bg-duck-500 px-5 py-2 text-xs font-bold text-ink-950 hover:bg-duck-400 disabled:opacity-50 transition-all shadow-md"
            >
              <Upload className="h-4 w-4" />
              <span>{isProcessing ? "Importing..." : "Import File to Workspace"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
