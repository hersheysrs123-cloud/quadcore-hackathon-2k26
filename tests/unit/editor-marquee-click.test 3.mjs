import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Editor Marquee Lasso & Side-Click Boundary Safety", () => {
  class MockEditorState {
    constructor({ clickToAppend = true, isLocked = false } = {}) {
      this.clickToAppend = clickToAppend;
      this.isLocked = isLocked;
      this.blocks = [
        { id: "b1", type: "h1", content: "Title Block" },
        { id: "b2", type: "text", content: "First paragraph" },
        { id: "b3", type: "text", content: "Second paragraph" },
      ];
      this.selectedId = null;
      this.selectedBlockIds = new Set();
      this.isDraggingMarquee = false;
      this.justFinishedMarquee = false;
      this.lastWhitespaceClickHandledTime = 0;
      this.caretPosition = null;
      this.rootRect = { left: 100, right: 700, top: 0, bottom: 800 };
      this.domRects = {
        b1: { top: 50, bottom: 90, left: 100, right: 700 },
        b2: { top: 100, bottom: 130, left: 100, right: 700 },
        b3: { top: 140, bottom: 170, left: 100, right: 700 },
      };
    }

    startMarquee({ clientX, clientY }) {
      this.isDraggingMarquee = true;
      this.marqueeStart = { x: clientX, y: clientY };
    }

    endMarquee({ clientX, clientY, selectedIds = [] }) {
      if (!this.isDraggingMarquee) return;
      this.isDraggingMarquee = false;

      const dist = Math.hypot(clientX - this.marqueeStart.x, clientY - this.marqueeStart.y);
      if (selectedIds.length > 0) {
        this.selectedBlockIds = new Set(selectedIds);
      }

      const hadSelection = this.selectedBlockIds.size > 0;
      if (dist >= 6 || hadSelection) {
        this.justFinishedMarquee = true;
        setTimeout(() => {
          this.justFinishedMarquee = false;
        }, 150);
      }

      // Simple click on empty canvas area
      if (dist < 6 && !hadSelection) {
        if (!this.clickToAppend) return;

        // Check horizontal side margins of screen
        if (clientX < this.rootRect.left || clientX > this.rootRect.right) {
          return;
        }

        const lastBlock = this.blocks[this.blocks.length - 1];
        if (lastBlock) {
          const lastRect = this.domRects[lastBlock.id];
          if (lastRect && clientY <= lastRect.bottom + 8) {
            // Clicked on side margin beside content
            return;
          }
        }

        this.lastWhitespaceClickHandledTime = Date.now();
        this.selectedId = lastBlock.id;
        this.caretPosition = { blockId: lastBlock.id, position: "end" };
      }
    }

    handleContainerClick({ clientX = 400, clientY, isCurrentTarget = true }) {
      if (this.isLocked) return;
      if (!this.clickToAppend) return;
      if (this.justFinishedMarquee) return;
      if (this.selectedBlockIds.size > 0) return;
      if (Date.now() - this.lastWhitespaceClickHandledTime < 250) return;

      if (clientX < this.rootRect.left || clientX > this.rootRect.right) {
        return;
      }

      if (isCurrentTarget && this.blocks.length > 0) {
        const lastBlock = this.blocks[this.blocks.length - 1];
        const lastRect = this.domRects[lastBlock.id];
        if (lastRect && clientY <= lastRect.bottom + 8) {
          // Click was on side margin beside content
          return;
        }

        this.selectedId = lastBlock.id;
        this.caretPosition = { blockId: lastBlock.id, position: "end" };
      }
    }
  }

  it("does NOT jump to last block when clicking on side margin with clickToAppend=false", () => {
    const editor = new MockEditorState({ clickToAppend: false });
    // Click on side of screen at clientX=20, clientY=110 (horizontally beside block 2)
    editor.startMarquee({ clientX: 20, clientY: 110 });
    editor.endMarquee({ clientX: 20, clientY: 110 });
    editor.handleContainerClick({ clientY: 110 });

    assert.strictEqual(editor.selectedId, null, "selectedId must remain null");
    assert.strictEqual(editor.caretPosition, null, "Caret must not jump to last block");
  });

  it("does NOT jump to last block when selecting blocks with lasso from left side", () => {
    const editor = new MockEditorState({ clickToAppend: false });
    // Start marquee drag from left side of screen
    editor.startMarquee({ clientX: 10, clientY: 90 });
    // Drag across b1 and b2
    editor.endMarquee({ clientX: 300, clientY: 135, selectedIds: ["b1", "b2"] });
    editor.handleContainerClick({ clientY: 135 });

    assert.strictEqual(editor.selectedBlockIds.size, 2, "Lasso selection must be preserved");
    assert.ok(editor.selectedBlockIds.has("b1"));
    assert.ok(editor.selectedBlockIds.has("b2"));
    assert.strictEqual(editor.selectedId, null, "Single block selection must not jump to last block");
    assert.strictEqual(editor.caretPosition, null, "Caret must not jump to last block");
  });

  it("does NOT jump to last block when lassoing with clickToAppend=true", () => {
    const editor = new MockEditorState({ clickToAppend: true });
    editor.startMarquee({ clientX: 10, clientY: 90 });
    editor.endMarquee({ clientX: 300, clientY: 135, selectedIds: ["b1", "b2"] });
    editor.handleContainerClick({ clientY: 135 });

    assert.strictEqual(editor.selectedBlockIds.size, 2, "Lasso selection must be preserved");
    assert.strictEqual(editor.caretPosition, null, "Caret must not be set into last block after lasso");
  });

  it("does NOT jump to last block when clicking side margin even with clickToAppend=true", () => {
    const editor = new MockEditorState({ clickToAppend: true });
    // Click on side of screen at clientY=110 (beside block 2, above last block bottom 170)
    editor.startMarquee({ clientX: 20, clientY: 110 });
    editor.endMarquee({ clientX: 20, clientY: 110 });
    editor.handleContainerClick({ clientY: 110 });

    assert.strictEqual(editor.selectedId, null, "Side click must not select last block");
    assert.strictEqual(editor.caretPosition, null, "Side click must not jump caret to last block");
  });

  it("DOES focus last block when clicking bottom whitespace with clickToAppend=true", () => {
    const editor = new MockEditorState({ clickToAppend: true });
    // Click in bottom whitespace below last block bottom (170 < 250)
    editor.startMarquee({ clientX: 200, clientY: 250 });
    editor.endMarquee({ clientX: 200, clientY: 250 });
    editor.handleContainerClick({ clientY: 250 });

    assert.strictEqual(editor.selectedId, "b3", "Bottom whitespace click must focus last block");
    assert.deepStrictEqual(editor.caretPosition, { blockId: "b3", position: "end" });
  });

  it("does NOT focus last block when clicking bottom whitespace with clickToAppend=false", () => {
    const editor = new MockEditorState({ clickToAppend: false });
    // Click in bottom whitespace below last block
    editor.startMarquee({ clientX: 200, clientY: 250 });
    editor.endMarquee({ clientX: 200, clientY: 250 });
    editor.handleContainerClick({ clientY: 250 });

    assert.strictEqual(editor.selectedId, null, "Bottom whitespace click must be ignored when clickToAppend=false");
    assert.strictEqual(editor.caretPosition, null);
  });

  it("completely disables clicking in the outer sides of the screen from appending, even when clickToAppend=true", () => {
    const editor = new MockEditorState({ clickToAppend: true });
    // Left side of the screen outside the note column (clientX=30, rootRect.left=100)
    editor.startMarquee({ clientX: 30, clientY: 300 });
    editor.endMarquee({ clientX: 30, clientY: 300 });
    editor.handleContainerClick({ clientX: 30, clientY: 300 });

    assert.strictEqual(editor.selectedId, null, "Clicking left side of screen must not append or focus");
    assert.strictEqual(editor.caretPosition, null);

    // Right side of the screen outside the note column (clientX=850, rootRect.right=700)
    editor.startMarquee({ clientX: 850, clientY: 300 });
    editor.endMarquee({ clientX: 850, clientY: 300 });
    editor.handleContainerClick({ clientX: 850, clientY: 300 });

    assert.strictEqual(editor.selectedId, null, "Clicking right side of screen must not append or focus");
    assert.strictEqual(editor.caretPosition, null);
  });
});
