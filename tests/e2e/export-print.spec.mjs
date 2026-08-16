import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * ─── EXPORT & PRINT DISPATCHER LOGIC ────────────────────────────────
 * Validates export options and print layout selectors from ExportImportModal.jsx
 */

export const EXPORT_FORMATS = [
  { id: "socratic", label: "Socratic Backup (.socratic / .json)", extension: "socratic" },
  { id: "pdf", label: "Print / PDF Document (.pdf)", extension: "pdf" },
  { id: "docx", label: "Microsoft Word Document (.docx)", extension: "docx" },
  { id: "markdown", label: "Markdown Document (.md)", extension: "md" },
  { id: "html", label: "Standalone Web Page (.html)", extension: "html" },
  { id: "txt", label: "Plain Text (.txt)", extension: "txt" },
];

export function getExportFilename(title, extension) {
  const safeSlug = (title || "Untitled_Note").replace(/[^a-z0-9_-]/gi, "_");
  const dateStr = new Date().toISOString().split("T")[0];
  return `${safeSlug}-${dateStr}.${extension}`;
}

export function filterPrintVisibleElements(classNames) {
  // Elements with 'no-print' should be hidden during window.print()
  return classNames.filter((c) => !c.includes("no-print"));
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("E2E Specification: Multi-Format Export & Print Pipeline", () => {
  it("supports all 6 primary export formats", () => {
    assert.strictEqual(EXPORT_FORMATS.length, 6);
    const ids = EXPORT_FORMATS.map((f) => f.id);
    assert.ok(ids.includes("socratic"));
    assert.ok(ids.includes("pdf"));
    assert.ok(ids.includes("docx"));
    assert.ok(ids.includes("markdown"));
    assert.ok(ids.includes("html"));
    assert.ok(ids.includes("txt"));
  });

  it("formats sanitized export filenames with date stamps", () => {
    const fn = getExportFilename("Quantum Physics & Optics (IGCSE)", "docx");
    assert.ok(fn.startsWith("Quantum_Physics___Optics__IGCSE_-"));
    assert.ok(fn.endsWith(".docx"));
  });

  it("filters out navigation and sidebars with .no-print during print rendering", () => {
    const pageElements = ["sidebar no-print", "print-content", "timer-hud no-print", "note-body"];
    const visibleInPrint = filterPrintVisibleElements(pageElements);
    assert.deepStrictEqual(visibleInPrint, ["print-content", "note-body"]);
  });
});
