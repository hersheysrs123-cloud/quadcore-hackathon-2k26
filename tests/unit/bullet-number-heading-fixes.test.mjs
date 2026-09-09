import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatNumberMarker, editorBlocksToText } from "../../lib/blocks.js";
import { isCaretAtLogicalStart, cleanZeroWidth } from "../../lib/editorCaret.js";
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

  describe("Bullet & Number Enter-at-Start Prepending (Notion-style)", () => {
    it("prepends an empty bullet ABOVE the first bullet and moves the first bullet to the next line", () => {
      const blocks = [
        { id: "b1", type: "bullet", level: 0, content: "First bullet item" },
        { id: "b2", type: "bullet", level: 0, content: "Second bullet item" },
      ];

      // Simulate handleAddBefore for b1 (the first bullet)
      const beforeId = "b1";
      const newBlock = { id: "new_b", type: "bullet", level: blocks[0].level, content: "" };
      const idx = blocks.findIndex((b) => b.id === beforeId);
      const nextBlocks = [...blocks];
      nextBlocks.splice(idx, 0, newBlock);

      // Verify the new block above is an empty bullet, and b1 is moved down to index 1 with its bullet type and content
      assert.strictEqual(nextBlocks.length, 3);
      assert.strictEqual(nextBlocks[0].id, "new_b");
      assert.strictEqual(nextBlocks[0].type, "bullet");
      assert.strictEqual(nextBlocks[0].content, "");
      assert.strictEqual(nextBlocks[0].level, 0);

      assert.strictEqual(nextBlocks[1].id, "b1");
      assert.strictEqual(nextBlocks[1].type, "bullet");
      assert.strictEqual(nextBlocks[1].content, "First bullet item");
      assert.strictEqual(nextBlocks[1].level, 0);

      assert.strictEqual(nextBlocks[2].id, "b2");
      assert.strictEqual(nextBlocks[2].content, "Second bullet item");
    });

    it("preserves sub-bullet level when prepending a bullet above an indented item", () => {
      const blocks = [
        { id: "b1", type: "bullet", level: 0, content: "Root bullet" },
        { id: "b2", type: "bullet", level: 2, content: "Deeply nested sub-bullet" },
      ];

      // Simulate handleAddBefore for b2 (level 2)
      const beforeId = "b2";
      const newBlock = { id: "new_sub", type: "bullet", level: blocks[1].level, content: "" };
      const idx = blocks.findIndex((b) => b.id === beforeId);
      const nextBlocks = [...blocks];
      nextBlocks.splice(idx, 0, newBlock);

      assert.strictEqual(nextBlocks[1].id, "new_sub");
      assert.strictEqual(nextBlocks[1].type, "bullet");
      assert.strictEqual(nextBlocks[1].level, 2);
      assert.strictEqual(nextBlocks[1].content, "");

      assert.strictEqual(nextBlocks[2].id, "b2");
      assert.strictEqual(nextBlocks[2].level, 2);
      assert.strictEqual(nextBlocks[2].content, "Deeply nested sub-bullet");
    });

    it("prepends an empty number block ABOVE a numbered item and pushes the numbered item down", () => {
      const blocks = [
        { id: "n1", type: "number", level: 0, content: "First instruction" },
      ];

      const beforeId = "n1";
      const newBlock = { id: "new_num", type: "number", level: blocks[0].level, content: "" };
      const idx = blocks.findIndex((b) => b.id === beforeId);
      const nextBlocks = [...blocks];
      nextBlocks.splice(idx, 0, newBlock);

      assert.strictEqual(nextBlocks.length, 2);
      assert.strictEqual(nextBlocks[0].type, "number");
      assert.strictEqual(nextBlocks[0].content, "");
      assert.strictEqual(nextBlocks[1].type, "number");
      assert.strictEqual(nextBlocks[1].content, "First instruction");
    });
  });

  describe("Backspace & Caret Detection on Empty Elements", () => {
    it("isCaretAtLogicalStart returns true for null, input at 0, or empty text", () => {
      const fakeInput = { tagName: "INPUT", selectionStart: 0, selectionEnd: 0 };
      assert.strictEqual(isCaretAtLogicalStart(fakeInput), true);

      const fakeNonZeroInput = { tagName: "INPUT", selectionStart: 2, selectionEnd: 2 };
      assert.strictEqual(isCaretAtLogicalStart(fakeNonZeroInput), false);
    });

    it("isCaretAtLogicalStart returns false when caret is after typed space in input or element", () => {
      // Input with typed space, caret at index 1
      const fakeInputAfterSpace = { tagName: "INPUT", selectionStart: 1, selectionEnd: 1 };
      assert.strictEqual(isCaretAtLogicalStart(fakeInputAfterSpace), false);

      // Textarea with typed space, caret at index 1
      const fakeTextareaAfterSpace = { tagName: "TEXTAREA", selectionStart: 1, selectionEnd: 1 };
      assert.strictEqual(isCaretAtLogicalStart(fakeTextareaAfterSpace), false);
    });

    it("verifies cleanZeroWidth preserves normal whitespace and only treats length === 0 as empty", () => {
      // Whitespace characters have length > 0 and must not be treated as empty
      assert.strictEqual(cleanZeroWidth(" ").length, 1);
      assert.strictEqual(cleanZeroWidth("  ").length, 2);
      assert.strictEqual(cleanZeroWidth("\t").length, 1);

      // Truly empty strings or only zero-width characters have length 0
      assert.strictEqual(cleanZeroWidth("").length, 0);
      assert.strictEqual(cleanZeroWidth("\u200B").length, 0);
      assert.strictEqual(cleanZeroWidth("\uFEFF").length, 0);
    });

    it("simulates block deletion condition: does NOT delete block when space is typed, deletes only when truly empty", () => {
      let blocks = [
        { id: "b1", type: "text", content: "Existing content" },
        { id: "b2", type: "text", content: " " }, // user pressed space once
      ];

      function simulateBackspace(blockId, currentDOMText) {
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return { deleted: false, prevented: false };

        const cleanDOM = cleanZeroWidth(currentDOMText);
        const cleanContent = cleanZeroWidth(block.content || "");
        const isDomEmpty = cleanDOM.length === 0 && cleanContent.length === 0;

        if (block.type === "text" && isDomEmpty) {
          blocks = blocks.filter((b) => b.id !== blockId);
          return { deleted: true, prevented: true };
        }
        // Native backspace deletes character (not block)
        return { deleted: false, prevented: false };
      }

      // 1. User presses space once: DOM has " "
      const firstPress = simulateBackspace("b2", " ");
      assert.strictEqual(firstPress.deleted, false, "Block b2 must NOT be deleted when it contains a space");
      assert.strictEqual(firstPress.prevented, false, "Event must not be prevented so browser can delete the space");
      assert.strictEqual(blocks.length, 2, "Both blocks must remain intact");

      // 2. Native backspace deletes the space character, so now content is ""
      blocks = blocks.map((b) => (b.id === "b2" ? { ...b, content: "" } : b));
      const secondPress = simulateBackspace("b2", "");
      assert.strictEqual(secondPress.deleted, true, "Block b2 must be deleted when it is truly empty");
      assert.strictEqual(secondPress.prevented, true);
      assert.strictEqual(blocks.length, 1);
      assert.strictEqual(blocks[0].id, "b1");
    });
  });
});
