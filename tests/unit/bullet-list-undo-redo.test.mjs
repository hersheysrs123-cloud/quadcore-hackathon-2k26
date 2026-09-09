import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Bullet & List Block Undo / Redo State Machine", () => {
  // Helper simulating the centralized history push & state transitions
  function createHistoryHarness(initialBlocks) {
    let blocks = JSON.parse(JSON.stringify(initialBlocks));
    let pastBlocks = [];
    let futureBlocks = [];
    let selectedId = blocks[0]?.id || null;

    const pushSnapshot = () => {
      const snapshot = JSON.parse(JSON.stringify(blocks));
      pastBlocks.push(snapshot);
      futureBlocks = [];
    };

    const undo = () => {
      if (pastBlocks.length === 0) return false;
      const currentBlocks = JSON.parse(JSON.stringify(blocks));
      const previous = pastBlocks.pop();
      const clonedPrevious = JSON.parse(JSON.stringify(previous));
      futureBlocks.unshift(currentBlocks);
      blocks = clonedPrevious;

      // Smart target focus resolution
      let targetBlock = null;
      if (selectedId && clonedPrevious.some((b) => b.id === selectedId)) {
        targetBlock = clonedPrevious.find((b) => b.id === selectedId);
      } else {
        const prevIdx = currentBlocks.findIndex((b) => b.id === selectedId);
        if (prevIdx !== -1) {
          const targetIdx = Math.max(0, Math.min(prevIdx, clonedPrevious.length - 1));
          targetBlock = clonedPrevious[targetIdx];
        } else {
          targetBlock = clonedPrevious[0];
        }
      }
      if (targetBlock) selectedId = targetBlock.id;
      return true;
    };

    const redo = () => {
      if (futureBlocks.length === 0) return false;
      const currentBlocks = JSON.parse(JSON.stringify(blocks));
      const next = futureBlocks.shift();
      const clonedNext = JSON.parse(JSON.stringify(next));
      pastBlocks.push(currentBlocks);
      blocks = clonedNext;

      // Smart target focus resolution
      let targetBlock = null;
      const newlyAdded = clonedNext.find((b) => !currentBlocks.some((cb) => cb.id === b.id));
      if (newlyAdded) {
        targetBlock = newlyAdded;
      } else if (selectedId && clonedNext.some((b) => b.id === selectedId)) {
        targetBlock = clonedNext.find((b) => b.id === selectedId);
      } else {
        targetBlock = clonedNext[0];
      }
      if (targetBlock) selectedId = targetBlock.id;
      return true;
    };

    return {
      get blocks() { return blocks; },
      set blocks(val) { blocks = val; },
      get pastBlocks() { return pastBlocks; },
      get futureBlocks() { return futureBlocks; },
      get selectedId() { return selectedId; },
      set selectedId(val) { selectedId = val; },
      pushSnapshot,
      undo,
      redo,
    };
  }

  it("preserves historical snapshot integrity via deep cloning without mutation leakage", () => {
    const harness = createHistoryHarness([
      { id: "b1", type: "bullet", level: 0, content: "First bullet" },
    ]);

    // Push snapshot before mutating
    harness.pushSnapshot();

    // Mutate the active block in-place (simulating user indenting & typing)
    harness.blocks[0].level = 1;
    harness.blocks[0].content = "First bullet indented";

    // Snapshot in pastBlocks MUST NOT be affected by in-place mutation
    assert.strictEqual(harness.pastBlocks[0][0].level, 0);
    assert.strictEqual(harness.pastBlocks[0][0].content, "First bullet");

    // Perform Undo: restores level 0 and original text
    harness.undo();
    assert.strictEqual(harness.blocks[0].level, 0);
    assert.strictEqual(harness.blocks[0].content, "First bullet");

    // Perform Redo: restores level 1 and indented text
    harness.redo();
    assert.strictEqual(harness.blocks[0].level, 1);
    assert.strictEqual(harness.blocks[0].content, "First bullet indented");
  });

  it("handles atomic Enter split of a bullet item in a single undo step", () => {
    const harness = createHistoryHarness([
      { id: "b1", type: "bullet", level: 0, content: "Split me into two" },
    ]);

    // User splits bullet at "Split me " and "into two"
    const textBefore = "Split me";
    const textAfter = "into two";

    // Atomic split operation:
    harness.pushSnapshot();
    const newBlock = { id: "b2", type: "bullet", level: 0, content: textAfter };
    harness.blocks[0].content = textBefore;
    harness.blocks.push(newBlock);
    harness.selectedId = newBlock.id;

    assert.strictEqual(harness.blocks.length, 2);
    assert.strictEqual(harness.blocks[0].content, "Split me");
    assert.strictEqual(harness.blocks[1].content, "into two");
    assert.strictEqual(harness.selectedId, "b2");

    // Exactly 1 snapshot in pastBlocks
    assert.strictEqual(harness.pastBlocks.length, 1);

    // 1st Undo: must restore the single un-split block AND fall back focus to b1 (not lost or body)
    const undid = harness.undo();
    assert.strictEqual(undid, true);
    assert.strictEqual(harness.blocks.length, 1);
    assert.strictEqual(harness.blocks[0].content, "Split me into two");
    assert.strictEqual(harness.selectedId, "b1");

    // Redo: re-splits into two blocks and focuses the newly added block b2
    const redid = harness.redo();
    assert.strictEqual(redid, true);
    assert.strictEqual(harness.blocks.length, 2);
    assert.strictEqual(harness.blocks[0].content, "Split me");
    assert.strictEqual(harness.blocks[1].content, "into two");
    assert.strictEqual(harness.selectedId, "b2");
  });

  it("correctly undoes and redoes sub-bullet Tab indentation and Shift+Tab outdent", () => {
    const harness = createHistoryHarness([
      { id: "b1", type: "number", level: 0, content: "Step 1" },
    ]);

    // User presses Tab: level goes from 0 to 1
    harness.pushSnapshot();
    harness.blocks[0].level = 1;

    assert.strictEqual(harness.blocks[0].level, 1);

    // User presses Tab again: level goes from 1 to 2
    harness.pushSnapshot();
    harness.blocks[0].level = 2;

    assert.strictEqual(harness.blocks[0].level, 2);

    // Undo 1: back to level 1
    harness.undo();
    assert.strictEqual(harness.blocks[0].level, 1);
    assert.strictEqual(harness.selectedId, "b1");

    // Undo 2: back to level 0
    harness.undo();
    assert.strictEqual(harness.blocks[0].level, 0);
    assert.strictEqual(harness.selectedId, "b1");

    // Redo 1: forwards to level 1
    harness.redo();
    assert.strictEqual(harness.blocks[0].level, 1);
    assert.strictEqual(harness.selectedId, "b1");

    // Redo 2: forwards to level 2
    harness.redo();
    assert.strictEqual(harness.blocks[0].level, 2);
    assert.strictEqual(harness.selectedId, "b1");
  });

  it("handles un-listing via Backspace and cleanly undoes back to list type", () => {
    const harness = createHistoryHarness([
      { id: "b1", type: "bullet", level: 0, content: "List item" },
    ]);

    // Backspace converts bullet to text paragraph
    harness.pushSnapshot();
    harness.blocks[0].type = "text";

    assert.strictEqual(harness.blocks[0].type, "text");

    // Undo: restores bullet type
    harness.undo();
    assert.strictEqual(harness.blocks[0].type, "bullet");
    assert.strictEqual(harness.blocks[0].content, "List item");

    // Redo: converts to text paragraph again
    harness.redo();
    assert.strictEqual(harness.blocks[0].type, "text");
  });

  it("handles Enter at the start of a bullet (prepending an empty bullet above)", () => {
    const harness = createHistoryHarness([
      { id: "b1", type: "bullet", level: 0, content: "Existing bullet item" },
    ]);

    // User presses Enter at start: prepends a new empty bullet above and keeps focus on original bullet
    harness.pushSnapshot();
    const prepended = { id: "b0", type: "bullet", level: 0, content: "" };
    harness.blocks.unshift(prepended);
    harness.selectedId = "b1"; // focus stays on original moved bullet

    assert.strictEqual(harness.blocks.length, 2);
    assert.strictEqual(harness.blocks[0].id, "b0");
    assert.strictEqual(harness.blocks[1].id, "b1");
    assert.strictEqual(harness.selectedId, "b1");

    // Undo: removes b0, keeping b1 focused cleanly
    harness.undo();
    assert.strictEqual(harness.blocks.length, 1);
    assert.strictEqual(harness.blocks[0].id, "b1");
    assert.strictEqual(harness.selectedId, "b1");

    // Redo: restores b0
    harness.redo();
    assert.strictEqual(harness.blocks.length, 2);
    assert.strictEqual(harness.blocks[0].id, "b0");
    assert.strictEqual(harness.blocks[1].id, "b1");
  });

  it("maintains consistent state during rapid alternating undo/redo sequences", () => {
    const harness = createHistoryHarness([
      { id: "b1", type: "bullet", level: 0, content: "Root" },
    ]);

    // Step 1: indent
    harness.pushSnapshot();
    harness.blocks[0].level = 1;

    // Step 2: edit text
    harness.pushSnapshot();
    harness.blocks[0].content = "Root modified";

    // Rapid Undo -> Undo -> Redo -> Undo -> Redo -> Redo
    harness.undo(); // back to "Root", level 1
    assert.strictEqual(harness.blocks[0].content, "Root");
    assert.strictEqual(harness.blocks[0].level, 1);

    harness.undo(); // back to "Root", level 0
    assert.strictEqual(harness.blocks[0].content, "Root");
    assert.strictEqual(harness.blocks[0].level, 0);

    harness.redo(); // to level 1
    assert.strictEqual(harness.blocks[0].level, 1);

    harness.undo(); // back to level 0
    assert.strictEqual(harness.blocks[0].level, 0);

    harness.redo(); // to level 1
    assert.strictEqual(harness.blocks[0].level, 1);

    harness.redo(); // to "Root modified"
    assert.strictEqual(harness.blocks[0].content, "Root modified");
    assert.strictEqual(harness.blocks[0].level, 1);
  });
});
