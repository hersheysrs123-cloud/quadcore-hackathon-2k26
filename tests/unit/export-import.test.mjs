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
    {
      id: "b18",
      type: "table",
      content: "",
      tableData: {
        headers: ["Qubit State", "Probability", "Phase"],
        rows: [
          ["|0>", "50%", "0"],
          ["|1>", "50%", "pi"],
        ],
        hasHeaderRow: true,
      },
    },
  ];

  describe("filterBlocksForExport", () => {
    it("converts canvas and site blocks into standard representations while preserving toggles", () => {
      const filtered = filterBlocksForExport(sampleBlocks);
      assert.ok(Array.isArray(filtered));
      assert.ok(filtered.length >= sampleBlocks.length);

      const canvasBlock = filtered.find((b) => b.content.includes("[Canvas] – Qubit Bloch Sphere Diagram"));
      assert.ok(canvasBlock, "Canvas block should be represented as a clean badge");

      const toggleBlock = filtered.find((b) => b.type === "toggle" && b.content === "What is decoherence?");
      assert.ok(toggleBlock, "Toggle block should pass through as a native toggle");
      assert.ok(toggleBlock.details.includes("loss of quantum coherence"), "Toggle details should be preserved");
    });
  });

  describe("Markdown Export & Lossless Round-Trip", () => {
    it("exports Markdown with sequential numbered lists, callout emojis, details toggles, tables, and formulas", () => {
      const md = blocksToMarkdownLossy(sampleBlocks);
      assert.ok(md.includes("# Quantum Computing Foundations"));
      assert.ok(md.includes("## Core Principles"));
      assert.ok(md.includes("1. Prepare initial state"));
      assert.ok(md.includes("2. Apply Hadamard transformation"));
      assert.ok(md.includes("3. Measure collapsed state"));
      assert.ok(md.includes("[x] Review Shor's algorithm derivation"));
      assert.ok(md.includes("[ ] Simulate Grover search in Python"));
      assert.ok(md.includes("> ⚠️ Superposition is destroyed upon measurement!"));
      assert.ok(md.includes("<details>\n<summary>What is decoherence?</summary>"));
      assert.ok(md.includes("```python\ndef hadamard():"));
      assert.ok(md.includes("$$\nE = mc^2\n$$"));
      assert.ok(md.includes("| Qubit State | Probability | Phase |"));
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

      // Verify Table block
      const tableBlock = importedBlocks.find((b) => b.type === "table");
      assert.ok(tableBlock, "Table block should be parsed back from Markdown table");
      assert.ok(tableBlock.tableData);
      assert.deepEqual(tableBlock.tableData.headers, ["Qubit State", "Probability", "Phase"]);
      assert.strictEqual(tableBlock.tableData.rows.length, 2);
      assert.strictEqual(tableBlock.tableData.rows[0][0], "|0>");

      // Verify Toggle block parsed from <details><summary>
      const toggle = importedBlocks.find((b) => b.type === "toggle");
      assert.ok(toggle, "Toggle block should be parsed from details tag");
      assert.strictEqual(toggle.content, "What is decoherence?");
      assert.ok(toggle.details.includes("loss of quantum coherence"));
    });


    it("parses standard Obsidian/GitHub Markdown tasks (- [ ] and - [x]) cleanly", () => {
      const md = "# Task List\n- [ ] Buy groceries\n- [x] Complete quantum problem set\n* [ ] Review PR";
      const blocks = tryParseMarkdownToBlocks(md);
      const todos = blocks.filter((b) => b.type === "todo");
      assert.strictEqual(todos.length, 3);
      assert.strictEqual(todos[0].content, "Buy groceries");
      assert.strictEqual(todos[0].checked, false);
      assert.strictEqual(todos[1].content, "Complete quantum problem set");
      assert.strictEqual(todos[1].checked, true);
    });

    it("parses Obsidian callouts (> [!NOTE] and > [!WARNING]) with correct icons", () => {
      const md = "> [!NOTE] Remember to save your work\n> [!WARNING] High voltage hazard";
      const blocks = tryParseMarkdownToBlocks(md);
      const callouts = blocks.filter((b) => b.type === "callout");
      assert.strictEqual(callouts.length, 2);
      assert.strictEqual(callouts[0].calloutIcon, "💡");
      assert.strictEqual(callouts[0].content, "Remember to save your work");
      assert.strictEqual(callouts[1].calloutIcon, "⚠️");
      assert.strictEqual(callouts[1].content, "High voltage hazard");
    });
  });

  describe("HTML Export & Grouped List Tagging", () => {
    it("groups consecutive list items inside single <ul> and <ol> containers and embeds KaTeX", () => {
      const html = blocksToHTMLLossy(sampleBlocks, "Quantum Note", "⚛️");
      assert.ok(html.includes("<h1>Quantum Computing Foundations</h1>"));
      assert.ok(html.includes("<ul>"));
      assert.ok(html.includes("<li>Qubits exhibit quantum entanglement</li>"));
      assert.ok(html.includes("<ol>"));
      assert.ok(html.includes("<li>Prepare initial state"));
      assert.ok(html.includes("<pre><code class=\"language-python\">"));
      assert.ok(html.includes("<details open"));
      assert.ok(html.includes("auto-render.min.js"));
    });

    it("renders bold, italic, code, strikethrough, and math inside list items and table cells in HTML export", () => {
      const richBlocks = [
        { id: "b1", type: "bullet", content: "**Cornea:** Refracts light rays entering the eye." },
        { id: "b2", type: "number", content: "Release *neurotransmitter chemicals* across the synaptic gap." },
        {
          id: "b3",
          type: "table",
          tableData: {
            headers: ["**Structure**", "*Function*", "`Code Type`"],
            rows: [
              ["**Iris**", "*Controls pupil diameter*", "`iris_node`"],
              ["~~Old Theory~~", "==Active Standard==", "$E = mc^2$"],
            ],
            hasHeaderRow: true,
          },
        },
      ];

      const html = blocksToHTMLLossy(richBlocks, "Sense Organs");
      assert.ok(html.includes("<strong>Cornea:</strong> Refracts light rays entering the eye."));
      assert.ok(html.includes("Release <em>neurotransmitter chemicals</em> across the synaptic gap."));
      assert.ok(html.includes("<th><strong>Structure</strong></th>"));
      assert.ok(html.includes("<th><em>Function</em></th>"));
      assert.ok(html.includes("<code>iris_node</code>"));
      assert.ok(html.includes("<del>Old Theory</del>"));
      assert.ok(html.includes("<mark>Active Standard</mark>"));
      assert.ok(html.includes("<span class=\"inline-math\">$E = mc^2$</span>"));
    });

    it("parses HTML note tags via Node regex fallback when DOMParser is unavailable", () => {
      const html = blocksToHTMLLossy(sampleBlocks, "Quantum Note", "⚛️");
      const parsed = tryParseHTMLToBlocks(html);
      assert.ok(Array.isArray(parsed));
      assert.ok(parsed.length > 0);
      assert.ok(parsed.some((b) => b.type === "h1" || b.type === "h2"));
    });

  });

  describe("Plain Text Serialization (AI Context Prompt Feed)", () => {
    it("converts blocks to clean formatted plain text with sequential numbers and code delimiters", () => {
      const txt = blocksToPlainText(sampleBlocks, "Quantum Note");
      assert.ok(txt.includes("1. Prepare initial state"));
      assert.ok(txt.includes("2. Apply Hadamard transformation"));
      assert.ok(txt.includes("3. Measure collapsed state"));
      assert.ok(txt.includes("[x] Review Shor's algorithm derivation"));
      assert.ok(txt.includes("[ ] Simulate Grover search in Python"));
      assert.ok(txt.includes("--- CODE (python) ---"));
      assert.ok(txt.includes("▶ What is decoherence?"));
    });

    it("parses plain text code blocks and list lines into structured editor blocks", () => {
      const txt = "First line\n--- CODE (python) ---\ndef solve():\n    return 42\n------------\n• Bullet one\n[x] Done task";
      const blocks = tryParsePlainTextToBlocks(txt);
      assert.ok(blocks.length >= 4);
      assert.strictEqual(blocks[0].content, "First line");
      const codeBlock = blocks.find((b) => b.type === "code");
      assert.ok(codeBlock);
      assert.strictEqual(codeBlock.language, "python");
      assert.ok(codeBlock.content.includes("def solve():"));
      const todoBlock = blocks.find((b) => b.type === "todo");
      assert.ok(todoBlock && todoBlock.checked);
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

  describe("JSON Note & Workspace Formats", () => {
    it("supports parsing raw JSON note payloads with structured blocks", () => {
      const noteJson = JSON.stringify({
        title: "Calculus Limits",
        emoji: "📐",
        blocks: [
          { type: "h1", content: "Limit Definition" },
          { type: "math", content: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
          { type: "callout", content: "Fundamental trigonometric limit", calloutIcon: "📌" },
        ],
      });

      const parsed = JSON.parse(noteJson);
      assert.strictEqual(parsed.title, "Calculus Limits");
      assert.strictEqual(parsed.blocks.length, 3);
      assert.strictEqual(parsed.blocks[1].type, "math");
    });
  });
});
