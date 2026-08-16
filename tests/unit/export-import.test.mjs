import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterBlocksForExport,
  blocksToMarkdownLossy,
  tryParseMarkdownToBlocks,
  blocksToHTMLLossy,
  tryParseHTMLToBlocks,
  blocksToPlainText,
  tryParsePlainTextToBlocks,
  blocksToDocxBlob,
} from "../../lib/exportImport.js";

describe("Multi-Format Export & Import Engine (lib/exportImport.js)", () => {
  const sampleBlocks = [
    { id: "b1", type: "h1", content: "Quantum Computing Foundations" },
    { id: "b2", type: "text", content: "Superposition allows states like $\\alpha|0\\rangle + \\beta|1\\rangle$." },
    { id: "b3", type: "h2", content: "Core Principles" },
    { id: "b4", type: "bullet", content: "Qubits exhibit quantum entanglement" },
    { id: "b5", type: "bullet", content: "No-cloning theorem prevents arbitrary duplication" },
    { id: "b6", type: "number", content: "Prepare initial state $|00\\dots 0\\rangle$" },
    { id: "b7", type: "number", content: "Apply Hadamard transformation" },
    { id: "b8", type: "number", content: "Measure collapsed state" },
    { id: "b9", type: "todo", content: "Review Shor's algorithm derivation", checked: true },
    { id: "b10", type: "todo", content: "Simulate Grover search in Python", checked: false },
    { id: "b11", type: "callout", content: "Superposition is destroyed upon measurement!", calloutIcon: "⚠️" },
    { id: "b12", type: "quote", content: "If you think you understand quantum mechanics, you don't." },
    { id: "b13", type: "code", content: "def hadamard():\n    return [[1, 1], [1, -1]]", language: "python" },
    { id: "b14", type: "math", content: "E = mc^2" },
    { id: "b15", type: "toggle", content: "What is decoherence?", details: "Decoherence is the loss of quantum coherence caused by environmental noise." },
    { id: "b16", type: "site", content: "Google Quantum AI", url: "https://quantumai.google" },
    { id: "b17", type: "canvas", content: "Qubit Bloch Sphere Diagram" },
  ];

  describe("filterBlocksForExport", () => {
    it("converts toggle and canvas blocks into export-ready standard representations", () => {
      const filtered = filterBlocksForExport(sampleBlocks);
      assert.ok(Array.isArray(filtered));
      assert.ok(filtered.length >= sampleBlocks.length);

      const canvasBlock = filtered.find((b) => b.content.includes("[Canvas] – Qubit Bloch Sphere Diagram"));
      assert.ok(canvasBlock, "Canvas block should be represented as a clean badge");

      const toggleHeader = filtered.find((b) => b.content === "What is decoherence?");
      assert.ok(toggleHeader, "Toggle header should pass through");

      const toggleDetails = filtered.find((b) => b.content.includes("↳ Decoherence is the loss of quantum coherence"));
      assert.ok(toggleDetails, "Toggle details should be indented with arrow");
    });
  });

  describe("Markdown Export & Lossless Round-Trip", () => {
    it("exports Markdown with sequential numbered lists, callout emojis, and formulas", () => {
      const md = blocksToMarkdownLossy(sampleBlocks);
      assert.ok(md.includes("# Quantum Computing Foundations"));
      assert.ok(md.includes("## Core Principles"));
      assert.ok(md.includes("1. Prepare initial state"));
      assert.ok(md.includes("2. Apply Hadamard transformation"));
      assert.ok(md.includes("3. Measure collapsed state"));
      assert.ok(md.includes("[x] Review Shor's algorithm derivation"));
      assert.ok(md.includes("[ ] Simulate Grover search in Python"));
      assert.ok(md.includes("> ⚠️ Superposition is destroyed upon measurement!"));
      assert.ok(md.includes("```python\ndef hadamard():"));
      assert.ok(md.includes("$$\nE = mc^2\n$$"));
    });

    it("parses exported Markdown back into structured editor blocks losslessly", () => {
      const md = blocksToMarkdownLossy(sampleBlocks);
      const importedBlocks = tryParseMarkdownToBlocks(md);

      assert.ok(importedBlocks.length > 0);
      assert.strictEqual(importedBlocks[0].type, "h1");
      assert.strictEqual(importedBlocks[0].content, "Quantum Computing Foundations");

      // Verify numbered list run
      const numbers = importedBlocks.filter((b) => b.type === "number");
      assert.strictEqual(numbers.length, 3);
      assert.strictEqual(numbers[0].content, "Prepare initial state $|00\\dots 0\\rangle$");

      // Verify Callout retains icon
      const callout = importedBlocks.find((b) => b.type === "callout");
      assert.ok(callout, "Callout should be recognized");
      assert.strictEqual(callout.calloutIcon, "⚠️");
      assert.ok(callout.content.includes("Superposition is destroyed"));

      // Verify Todo items
      const doneTodo = importedBlocks.find((b) => b.type === "todo" && b.checked);
      const undoneTodo = importedBlocks.find((b) => b.type === "todo" && !b.checked);
      assert.ok(doneTodo, "Checked todo should be parsed");
      assert.ok(undoneTodo, "Unchecked todo should be parsed");
    });
  });

  describe("HTML Export & Grouped List Tagging", () => {
    it("groups consecutive list items inside single <ul> and <ol> containers", () => {
      const html = blocksToHTMLLossy(sampleBlocks, "Quantum Note", "⚛️");
      assert.ok(html.includes("<h1>Quantum Computing Foundations</h1>"));
      assert.ok(html.includes("<ul>"));
      assert.ok(html.includes("<li>Qubits exhibit quantum entanglement</li>"));
      assert.ok(html.includes("<ol>"));
      assert.ok(html.includes("<li>Prepare initial state"));
      assert.ok(html.includes("<pre><code class=\"language-python\">"));
    });

    it("guards tryParseHTMLToBlocks safely in Node environments without DOMParser", () => {
      const html = blocksToHTMLLossy(sampleBlocks, "Quantum Note", "⚛️");
      const parsed = tryParseHTMLToBlocks(html);
      assert.ok(Array.isArray(parsed));
    });
  });

  describe("Plain Text Serialization (AI Context Prompt Feed)", () => {
    it("converts blocks to clean formatted plain text with sequential numbers", () => {
      const txt = blocksToPlainText(sampleBlocks, "Quantum Note");
      assert.ok(txt.includes("1. Prepare initial state"));
      assert.ok(txt.includes("2. Apply Hadamard transformation"));
      assert.ok(txt.includes("3. Measure collapsed state"));
      assert.ok(txt.includes("[x] Review Shor's algorithm derivation"));
      assert.ok(txt.includes("[ ] Simulate Grover search in Python"));
    });

    it("parses plain text lines into paragraph blocks", () => {
      const txt = "First line\nSecond line\nThird line";
      const blocks = tryParsePlainTextToBlocks(txt);
      assert.strictEqual(blocks.length, 3);
      assert.strictEqual(blocks[0].content, "First line");
    });
  });

  describe("DOCX Word Document Blob Generation", () => {
    it("successfully compiles a valid binary Blob from complex 18-block notes", async () => {
      const blob = await blocksToDocxBlob(sampleBlocks, "Quantum Note", "⚛️");
      assert.ok(blob instanceof Blob);
      assert.ok(blob.size > 1000, "DOCX Blob should have substantial binary content");
      assert.strictEqual(blob.type, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    });
  });
});
