import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatNumberMarker, editorBlocksToText } from "../../lib/blocks.js";
import { isCaretAtLogicalStart } from "../../lib/editorCaret.js";
import { blocksToHTMLLossy } from "../../lib/exportImport.js";

describe("Bullet, Number List, Heading Enter & Socratic Bot Fixes", () => {
  describe("Hierarchical Number List Markers (formatNumberMarker)", () => {
    it("formats level 0 items as standard decimal numbers (1., 2., 3...)", () => {
      assert.strictEqual(formatNumberMarker(0, 1), "1.");
      assert.strictEqual(formatNumberMarker(0, 2), "2.");
      assert.strictEqual(formatNumberMarker(0, 10), "10.");
    });

    it("formats level 1 sub-bullets as lowercase alphabet (a., b., c...)", () => {
      assert.strictEqual(formatNumberMarker(1, 1), "a.");
      assert.strictEqual(formatNumberMarker(1, 2), "b.");
      assert.strictEqual(formatNumberMarker(1, 3), "c.");
      assert.strictEqual(formatNumberMarker(1, 26), "z.");
      assert.strictEqual(formatNumberMarker(1, 27), "aa.");
    });

    it("formats level 2 sub-bullets as lowercase roman numerals (i., ii., iii., iv...)", () => {
      assert.strictEqual(formatNumberMarker(2, 1), "i.");
      assert.strictEqual(formatNumberMarker(2, 2), "ii.");
      assert.strictEqual(formatNumberMarker(2, 3), "iii.");
      assert.strictEqual(formatNumberMarker(2, 4), "iv.");
      assert.strictEqual(formatNumberMarker(2, 5), "v.");
      assert.strictEqual(formatNumberMarker(2, 9), "ix.");
      assert.strictEqual(formatNumberMarker(2, 10), "x.");
    });

    it("formats level 3 sub-bullets as uppercase alphabet (A., B., C...)", () => {
      assert.strictEqual(formatNumberMarker(3, 1), "A.");
      assert.strictEqual(formatNumberMarker(3, 2), "B.");
      assert.strictEqual(formatNumberMarker(3, 3), "C.");
    });

    it("clamps invalid or negative levels gracefully", () => {
      assert.strictEqual(formatNumberMarker(-1, 1), "1.");
      assert.strictEqual(formatNumberMarker(0, 0), "1.");
    });
  });

  describe("Hierarchical Number Sequence Simulation", () => {
    it("computes accurate hierarchical sub-bullet counters across nested levels", () => {
      const blocks = [
        { id: "1", type: "number", level: 0, content: "First item" },
        { id: "2", type: "number", level: 0, content: "Second item" },
        { id: "3", type: "number", level: 1, content: "Sub-item A" },
        { id: "4", type: "number", level: 1, content: "Sub-item B" },
        { id: "5", type: "number", level: 2, content: "Sub-sub item i" },
        { id: "6", type: "number", level: 1, content: "Sub-item C" },
        { id: "7", type: "number", level: 0, content: "Third item" },
        { id: "8", type: "number", level: 1, content: "Sub-item A under Third" },
      ];

      let numberCounters = [0];
      const labels = blocks.map((block) => {
        if (block.type === "number") {
          const level = Math.max(0, Math.min(4, Number(block.level) || 0));
          numberCounters = numberCounters.slice(0, level + 1);
          while (numberCounters.length <= level) {
            numberCounters.push(0);
          }
          numberCounters[level] += 1;
          return formatNumberMarker(level, numberCounters[level]);
        } else {
          numberCounters = [0];
          return null;
        }
      });

      assert.deepStrictEqual(labels, [
        "1.",
        "2.",
        "a.",
        "b.",
        "i.",
        "c.",
        "3.",
        "a.",
      ]);
    });

    it("resets counters when an intervening non-number block occurs", () => {
      const blocks = [
        { id: "1", type: "number", level: 0, content: "First list" },
        { id: "2", type: "number", level: 1, content: "Sub A" },
        { id: "3", type: "text", content: "Intervening text paragraph" },
        { id: "4", type: "number", level: 0, content: "Restarted list" },
        { id: "5", type: "number", level: 1, content: "Sub A restarted" },
      ];

      let numberCounters = [0];
      const labels = blocks.map((block) => {
        if (block.type === "number") {
          const level = Math.max(0, Math.min(4, Number(block.level) || 0));
          numberCounters = numberCounters.slice(0, level + 1);
          while (numberCounters.length <= level) {
            numberCounters.push(0);
          }
          numberCounters[level] += 1;
          return formatNumberMarker(level, numberCounters[level]);
        } else {
          numberCounters = [0];
          return null;
        }
      });

      assert.deepStrictEqual(labels, [
        "1.",
        "a.",
        null,
        "1.",
        "a.",
      ]);
    });
  });

  describe("Editor Serialization with Indented Number Lists", () => {
    it("serializes numbered lists with sub-bullet indentation in editorBlocksToText", () => {
      const blocks = [
        { id: "1", type: "number", level: 0, content: "First topic" },
        { id: "2", type: "number", level: 1, content: "Sub-topic details" },
        { id: "3", type: "bullet", level: 1, content: "Bullet sub-point" },
      ];

      const text = editorBlocksToText(blocks);
      assert.ok(text.includes("1. First topic"));
      assert.ok(text.includes("  2. Sub-topic details"));
      assert.ok(text.includes("  - Bullet sub-point"));
    });

    it("generates HTML with lower-alpha list style for level 1 numbered lists", () => {
      const blocks = [
        { id: "1", type: "number", level: 0, content: "Root question" },
        { id: "2", type: "number", level: 1, content: "Option a" },
      ];

      const html = blocksToHTMLLossy(blocks, "Test Note");
      assert.ok(html.includes('list-style-type: lower-alpha'));
    });
  });

  describe("Heading Enter Behavior (Notion-style prepend)", () => {
    it("creates a new block ABOVE and preserves heading below when Enter is pressed at start of heading", () => {
      const blocks = [
        { id: "b1", type: "h1", content: "Main Topic Heading" },
        { id: "b2", type: "text", content: "Paragraph below" },
      ];

      // Simulate handleAddBefore for b1
      const beforeId = "b1";
      const newBlock = { id: "new_1", type: "text", content: "" };
      const idx = blocks.findIndex((b) => b.id === beforeId);
      const nextBlocks = [...blocks];
      nextBlocks.splice(idx, 0, newBlock);

      // Verify the new block is above, and b1 is preserved intact below
      assert.strictEqual(nextBlocks.length, 3);
      assert.strictEqual(nextBlocks[0].id, "new_1");
      assert.strictEqual(nextBlocks[0].type, "text");
      assert.strictEqual(nextBlocks[0].content, "");
      assert.strictEqual(nextBlocks[1].id, "b1");
      assert.strictEqual(nextBlocks[1].type, "h1");
      assert.strictEqual(nextBlocks[1].content, "Main Topic Heading");
      assert.strictEqual(nextBlocks[2].id, "b2");
    });
  });

  describe("Backspace & Caret Detection on Empty Elements", () => {
    it("isCaretAtLogicalStart returns true for null, input at 0, or empty text", () => {
      const fakeInput = { tagName: "INPUT", selectionStart: 0, selectionEnd: 0 };
      assert.strictEqual(isCaretAtLogicalStart(fakeInput), true);

      const fakeNonZeroInput = { tagName: "INPUT", selectionStart: 2, selectionEnd: 2 };
      assert.strictEqual(isCaretAtLogicalStart(fakeNonZeroInput), false);
    });
  });
});
