import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chunkNoteBlocks,
  heuristicReformatBlocks,
} from "../../lib/aiService.js";
import {
  REFORMAT_BLOCK_TYPES,
  REFORMAT_SCHEMA,
} from "../../lib/schemas.js";

describe("Intelligent Note Reformatting Engine", () => {
  describe("Schema & Allowed Types Validation", () => {
    it("defines valid SocraticOS block types for note reformatting", () => {
      assert.ok(Array.isArray(REFORMAT_BLOCK_TYPES));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("text"));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("h1"));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("h2"));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("callout"));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("math"));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("inlinemath"));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("toggle"));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("todo"));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("code"));
      assert.ok(REFORMAT_BLOCK_TYPES.includes("table"));
    });

    it("declares standard OpenAPI 3.0 schema properties for /api/reformat", () => {
      assert.equal(REFORMAT_SCHEMA.type, "OBJECT");
      assert.ok(REFORMAT_SCHEMA.properties.title);
      assert.ok(REFORMAT_SCHEMA.properties.emoji);
      assert.ok(REFORMAT_SCHEMA.properties.blocks);
      assert.deepEqual(REFORMAT_SCHEMA.required, ["title", "emoji", "blocks"]);
    });
  });

  describe("Long-Note Intelligent Chunking Engine", () => {
    it("preserves short notes as a single chunk", () => {
      const blocks = [
        { id: "b1", type: "h1", content: "Short Topic" },
        { id: "b2", type: "text", content: "A brief single paragraph note." },
      ];
      const chunks = chunkNoteBlocks(blocks, 1000);
      assert.equal(chunks.length, 1);
      assert.equal(chunks[0].length, 2);
    });

    it("automatically breaks oversized long notes into sequential chunks", () => {
      const longBlocks = [];
      for (let i = 0; i < 40; i++) {
        longBlocks.push({
          id: `b_${i}`,
          type: i % 10 === 0 ? "h2" : "text",
          content: `Section ${i}: ${"Detailed conceptual explanation with scientific vocabulary and mathematical derivations. ".repeat(6)}`,
        });
      }

      const chunks = chunkNoteBlocks(longBlocks, 400);
      assert.ok(chunks.length > 1, "Long note should be segmented into multiple chunks");

      // Verify that total blocks across all chunks equals original block count
      const totalBlocks = chunks.reduce((acc, c) => acc + c.length, 0);
      assert.equal(totalBlocks, 40);
    });
  });

  describe("Heuristic Reformatting Fallback Engine", () => {
    it("transforms raw text with headers, lists, callouts, and math into structured blocks", () => {
      const rawBlocks = [
        { id: "b1", type: "text", content: "# Special Relativity Overview" },
        { id: "b2", type: "text", content: "Key Idea: The speed of light is invariant across all inertial reference frames." },
        { id: "b3", type: "text", content: "$$E = mc^2$$" },
        { id: "b4", type: "text", content: "- Mass-energy equivalence" },
        { id: "b5", type: "text", content: "- Time dilation" },
        { id: "b6", type: "text", content: "- [ ] Review Lorentz factor derivation" },
      ];

      const result = heuristicReformatBlocks(rawBlocks, "Untitled Note");

      assert.ok(result);
      assert.equal(result.title, "Special Relativity Overview");
      assert.ok(result.emoji); // Should detect physics/relativity context (e.g. ⚛️)
      assert.ok(Array.isArray(result.blocks));
      assert.ok(result.blocks.length >= 4);

      const calloutBlock = result.blocks.find((b) => b.type === "callout");
      assert.ok(calloutBlock, "Should identify callout block from 'Key Idea:'");
      assert.ok(calloutBlock.content.includes("speed of light is invariant"));
      assert.equal(calloutBlock.calloutIcon, "🎯");

      const mathBlock = result.blocks.find((b) => b.type === "math");
      assert.ok(mathBlock, "Should identify math block from '$$E = mc^2$$'");
      assert.equal(mathBlock.content, "E = mc^2");

      const todoBlock = result.blocks.find((b) => b.type === "todo");
      assert.ok(todoBlock, "Should identify todo checklist item");
      assert.equal(todoBlock.checked, false);
      assert.equal(todoBlock.content, "Review Lorentz factor derivation");
    });

    it("handles warnings and caution lines as callouts with warning icon", () => {
      const rawBlocks = [
        { id: "b1", type: "text", content: "Warning: Never divide by zero when computing derivatives." },
      ];

      const result = heuristicReformatBlocks(rawBlocks, "Calculus 101");
      assert.equal(result.blocks[0].type, "callout");
      assert.equal(result.blocks[0].calloutIcon, "⚠️");
      assert.equal(result.blocks[0].content, "Never divide by zero when computing derivatives.");
    });

    it("handles empty note input gracefully without crashing", () => {
      const result = heuristicReformatBlocks([], "Empty Note");
      assert.equal(result.title, "Empty Note");
      assert.ok(Array.isArray(result.blocks));
      assert.equal(result.blocks.length, 1);
      assert.equal(result.blocks[0].type, "text");
    });

    it("derives contextual emoji based on academic keywords", () => {
      const bioBlocks = [
        { id: "b1", type: "text", content: "# DNA Transcription & Enzymes" },
        { id: "b2", type: "text", content: "RNA polymerase unzips DNA double helix." },
      ];
      const bioResult = heuristicReformatBlocks(bioBlocks);
      assert.equal(bioResult.emoji, "🧬");

      const csBlocks = [
        { id: "b1", type: "text", content: "# Binary Search Tree Algorithm" },
        { id: "b2", type: "text", content: "```python\ndef search(root, key):\n    return root\n```" },
      ];
      const csResult = heuristicReformatBlocks(csBlocks);
      assert.equal(csResult.emoji, "💻");
    });

    it("identifies pasted markdown tables and converts them into structured table blocks", () => {
      const tableText = [
        { id: "b1", type: "text", content: "# Quantum Gate Comparison" },
        { id: "b2", type: "text", content: "| Gate | Operation | Matrix |\n|---|---|---|\n| Pauli-X | Bit Flip | [[0, 1], [1, 0]] |\n| Hadamard | Superposition | 1/sqrt(2) * [[1, 1], [1, -1]] |\n| CNOT | Entanglement | 4x4 matrix |" },
      ];

      const result = heuristicReformatBlocks(tableText, "Quantum Gate Comparison");
      assert.equal(result.title, "Quantum Gate Comparison");
      const tableBlock = result.blocks.find((b) => b.type === "table");
      assert.ok(tableBlock, "Should identify table block from markdown table syntax");
      assert.ok(tableBlock.tableData);
      assert.deepEqual(tableBlock.tableData.headers, ["Gate", "Operation", "Matrix"]);
      assert.equal(tableBlock.tableData.rows.length, 3);
      assert.equal(tableBlock.tableData.rows[0][0], "Pauli-X");
      assert.equal(tableBlock.tableData.rows[1][1], "Superposition");
    });

    it("preserves exact wording and details verbatim without modifying text content when reclassifying block types", () => {
      const rawBlocks = [
        { id: "b1", type: "text", content: "# Quantum Computing Laboratory Notes" },
        { id: "b2", type: "text", content: "Qubit coherence time T2 is exactly 120.45 microseconds with single-qubit gate fidelity of 99.987%." },
        { id: "b3", type: "text", content: "$$\\psi(t) = \\frac{1}{\\sqrt{2}}(|0\\rangle + e^{i\\omega t}|1\\rangle)$$" },
        { id: "b4", type: "text", content: "```python\ndef measure_qubit(state_vector):\n    probs = np.abs(state_vector) ** 2\n    return np.random.choice([0, 1], p=probs)\n```" },
        { id: "b5", type: "text", content: "- [x] Calibrate microwave pulse frequency at 4.852 GHz" },
        { id: "b6", type: "text", content: "Warning: Liquid helium cryogenic temperature must stay strictly below 15.2 mK to prevent thermal decoherence." },
      ];

      const result = heuristicReformatBlocks(rawBlocks, "Quantum Computing Laboratory Notes");

      // Verify that the title and every detail is 100% intact without any loss or alterations
      assert.equal(result.title, "Quantum Computing Laboratory Notes");

      const paragraph = result.blocks.find((b) => b.type === "text");
      assert.ok(paragraph, "Paragraph block should exist");
      assert.equal(paragraph.content, "Qubit coherence time T2 is exactly 120.45 microseconds with single-qubit gate fidelity of 99.987%.");

      const math = result.blocks.find((b) => b.type === "math");
      assert.ok(math, "Math block should exist");
      assert.equal(math.content, "\\psi(t) = \\frac{1}{\\sqrt{2}}(|0\\rangle + e^{i\\omega t}|1\\rangle)");

      const code = result.blocks.find((b) => b.type === "code");
      assert.ok(code, "Code block should exist");
      assert.equal(code.language, "python");
      assert.equal(code.content, "def measure_qubit(state_vector):\n    probs = np.abs(state_vector) ** 2\n    return np.random.choice([0, 1], p=probs)");

      const todo = result.blocks.find((b) => b.type === "todo");
      assert.ok(todo, "Todo block should exist");
      assert.equal(todo.checked, true);
      assert.equal(todo.content, "Calibrate microwave pulse frequency at 4.852 GHz");

      const callout = result.blocks.find((b) => b.type === "callout");
      assert.ok(callout, "Callout block should exist");
      assert.equal(callout.calloutIcon, "⚠️");
      assert.equal(callout.content, "Liquid helium cryogenic temperature must stay strictly below 15.2 mK to prevent thermal decoherence.");
    });

    it("heals jumbled LaTeX pathway equations with missing opening $$ and cleans bold asterisks in subheadings", () => {
      const rawText = [
        { id: "b1", type: "text", content: "\\text{Stimulus} \\rightarrow \\text{Receptor} \\rightarrow \\text{Sensory Neurone} \\rightarrow \\text{Relay Neurone (in CNS)} \\rightarrow \\text{Motor Neurone} \\rightarrow \\text{Effector} \\rightarrow \\text{Response}$$" },
        { id: "b2", type: "text", content: "* **Eye Structures:**" },
        { id: "b3", type: "text", content: "* **Cornea:** Refracts light rays entering the eye." },
        { id: "b4", type: "text", content: "* *In Bright Light:* Circular muscles contract, radial muscles relax $\\rightarrow$ pupil constricts." },
        { id: "b5", type: "text", content: "### 14.3 Hormones" },
      ];

      const result = heuristicReformatBlocks(rawText, "Human Biology");

      // Math block healing
      const mathBlock = result.blocks.find((b) => b.type === "math");
      assert.ok(mathBlock, "Should heal jumbled LaTeX pathway equation into a math block");
      assert.equal(
        mathBlock.content,
        "\\text{Stimulus} \\rightarrow \\text{Receptor} \\rightarrow \\text{Sensory Neurone} \\rightarrow \\text{Relay Neurone (in CNS)} \\rightarrow \\text{Motor Neurone} \\rightarrow \\text{Effector} \\rightarrow \\text{Response}"
      );

      // Subheading category healing
      const eyeHeading = result.blocks.find((b) => b.type === "h3" && b.content.includes("Eye Structures"));
      assert.ok(eyeHeading, "Should convert '* **Eye Structures:**' into clean h3 heading");
      assert.equal(eyeHeading.content, "Eye Structures");

      // Bullet cleaning
      const corneaBullet = result.blocks.find((b) => b.type === "bullet" && b.content.includes("Cornea"));
      assert.ok(corneaBullet, "Should convert cornea entry to clean bullet");
      assert.equal(corneaBullet.content, "**Cornea:** Refracts light rays entering the eye.");
    });
  });
});




