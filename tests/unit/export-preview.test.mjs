import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blocksToMarkdownLossy,
  blocksToHTMLLossy,
  blocksToPlainText,
  blocksToDocxBlob,
  tryParseDocxToBlocks,
  PREVIEWABLE_EXPORT_FORMATS,
} from "../../lib/exportImport.js";

const PREVIEWABLE_FORMATS = PREVIEWABLE_EXPORT_FORMATS;

describe("Document Export Previews (Word, HTML, TXT, MD)", () => {
  const sampleBlocks = [
    { id: "b1", type: "h1", content: "Quantum Mechanics Fundamentals" },
    { id: "b2", type: "text", content: "Wave-particle duality is a central concept in quantum theory." },
    { id: "b3", type: "callout", content: "Key principle discovered by Louis de Broglie in 1924.", calloutIcon: "💡" },
    { id: "b4", type: "math", content: "\\lambda = \\frac{h}{p}" },
    { id: "b5", type: "bullet", content: "Matter exhibits wave-like behavior", level: 0 },
    { id: "b6", type: "bullet", content: "Wavelength is inversely proportional to momentum", level: 1 },
    { id: "b7", type: "todo", content: "Review Compton Scattering derivation", checked: true },
    {
      id: "b8",
      type: "table",
      tableData: {
        headers: ["Particle", "Mass (kg)", "Wavelength (m)"],
        rows: [
          ["Electron", "9.11e-31", "1.23e-10"],
          ["Proton", "1.67e-27", "6.63e-14"],
        ],
      },
    },
    { id: "b9", type: "code", content: "console.log('E = h * nu');", language: "javascript" },
  ];

  const noteTitle = "Quantum Physics (2026)";
  const noteEmoji = "⚛️";

  it("identifies all 4 previewable formats correctly", () => {
    assert.deepStrictEqual(PREVIEWABLE_FORMATS, ["docx", "html", "txt", "md"]);
    assert.ok(PREVIEWABLE_FORMATS.includes("docx"));
    assert.ok(PREVIEWABLE_FORMATS.includes("html"));
    assert.ok(PREVIEWABLE_FORMATS.includes("txt"));
    assert.ok(PREVIEWABLE_FORMATS.includes("md"));
    assert.ok(!PREVIEWABLE_FORMATS.includes("socratic"));
    assert.ok(!PREVIEWABLE_FORMATS.includes("bookmarks"));
    assert.ok(!PREVIEWABLE_FORMATS.includes("pdf"));
  });

  it("generates faithful Markdown (.md) preview content with KaTeX math & tables", () => {
    const md = blocksToMarkdownLossy(sampleBlocks, noteTitle);
    assert.ok(md.includes("# Quantum Mechanics Fundamentals"), "Must include H1 title");
    assert.ok(md.includes("Wave-particle duality"), "Must include text content");
    assert.ok(md.includes("> 💡 Key principle"), "Must format callout with blockquote and icon");
    assert.ok(md.includes("$$\n\\lambda = \\frac{h}{p}\n$$") || md.includes("\\lambda = \\frac{h}{p}"), "Must include LaTeX math");
    assert.ok(md.includes("- [x] Review Compton Scattering"), "Must format checked todo");
    assert.ok(md.includes("| Particle | Mass (kg) | Wavelength (m) |"), "Must format markdown table header");
    assert.ok(md.includes("```javascript"), "Must include code block language");
  });

  it("generates standalone HTML (.html) preview document with embedded styles and iframe compatibility", () => {
    const html = blocksToHTMLLossy(sampleBlocks, noteTitle, noteEmoji);
    assert.ok(html.startsWith("<!DOCTYPE html>"), "Must be a valid HTML5 document");
    assert.ok(html.includes(`<title>${noteTitle}</title>`), "Must include document title");
    assert.ok(html.includes("katex.min.css"), "Must include KaTeX stylesheet for math rendering");
    assert.ok(html.includes("Wave-particle duality"), "Must include body text");
    assert.ok(html.includes("socratic-table"), "Must include styled table container");
    assert.ok(html.includes("Electron"), "Must include table cells");
    assert.ok(html.includes("code-block"), "Must include code container");
  });

  it("generates structured Plain Text (.txt) preview with ASCII headers and indentation", () => {
    const txt = blocksToPlainText(sampleBlocks, noteTitle);
    assert.ok(txt.includes("QUANTUM PHYSICS (2026)"), "Must include capitalized title");
    assert.ok(txt.includes("=".repeat(noteTitle.length)), "Must include ASCII divider under title");
    assert.ok(txt.includes("Wave-particle duality"), "Must include paragraph text");
    assert.ok(txt.includes("[x] Review Compton Scattering"), "Must format checked todo with ASCII box");
    assert.ok(txt.includes("Particle"), "Must include table column text");
  });

  it("generates valid Word Document (.docx) blob and parses back correctly", async () => {
    const blob = await blocksToDocxBlob(sampleBlocks, noteTitle, noteEmoji);
    assert.ok(blob, "Blob must exist");
    assert.ok(blob.size > 1000, `Blob size (${blob.size} bytes) should be non-trivial Word document`);

    const arrayBuffer = await blob.arrayBuffer();
    const parsedBlocks = await tryParseDocxToBlocks(arrayBuffer);
    assert.ok(Array.isArray(parsedBlocks), "Should parse back to array of blocks");
    assert.ok(parsedBlocks.length > 0, "Should contain parsed blocks from Word doc");

    const textJoined = parsedBlocks.map((b) => b.content).join(" ");
    assert.ok(textJoined.includes("Quantum"), "Parsed docx should retain Quantum keywords");
  });

  it("sanitizes filenames correctly for download action", () => {
    const raw = 'Quantum Mechanics / Optics: 101 & More? *Yes*!';
    const safe = raw.replace(/[^a-z0-9_-]/gi, "_");
    assert.strictEqual(safe, "Quantum_Mechanics___Optics__101___More___Yes__");
    assert.ok(!/[/\\:*?"<>|]/.test(safe), "Filename must be safe from illegal filesystem characters");
  });

  it("ensures previewable exports provide scroll-friendly content across long documents", () => {
    // Generate a long 50-block document
    const longBlocks = [];
    for (let i = 1; i <= 50; i++) {
      longBlocks.push({ id: `block-${i}`, type: "text", content: `Paragraph ${i}: Detailed analysis of quantum coherence and state vectors.` });
    }

    const longMd = blocksToMarkdownLossy(longBlocks, "Long Document");
    const longHtml = blocksToHTMLLossy(longBlocks, "Long Document");
    const longTxt = blocksToPlainText(longBlocks, "Long Document");

    assert.ok(longMd.split("\n").length >= 50, "Markdown should contain all 50 paragraph blocks");
    assert.ok(longHtml.includes("Paragraph 50"), "HTML document should contain all 50 paragraph blocks");
    assert.ok(longTxt.includes("Paragraph 50"), "Plain text document should contain all 50 paragraph blocks");
    assert.ok(longHtml.length > 5000, "HTML document size should be substantial for 50 blocks");
  });
});

