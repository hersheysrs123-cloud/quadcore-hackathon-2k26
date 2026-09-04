import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * ─── SIMULATED WORKSPACE & NOTE STATE MANAGEMENT ────────────────────
 * Mirrors the state synchronization in Workspace.jsx and BlockNoteEditor.jsx
 */

export function createWorkspaceStore(initialNotesBySpace = { School: [], Personal: [], Misc: [], Journal: [] }) {
  let notesBySpace = { ...initialNotesBySpace };
  let activeSpace = "School";
  let activeNoteId = null;
  let editorBlocks = [];

  return {
    get notesBySpace() {
      return notesBySpace;
    },
    get activeSpace() {
      return activeSpace;
    },
    get activeNoteId() {
      return activeNoteId;
    },
    get editorBlocks() {
      return editorBlocks;
    },
    get activeNote() {
      const list = notesBySpace[activeSpace] || [];
      return list.find((n) => n.id === activeNoteId) || list[0] || null;
    },

    selectSpace(spaceName) {
      activeSpace = spaceName;
      const list = notesBySpace[spaceName] || [];
      if (list.length > 0) {
        activeNoteId = list[0].id;
        editorBlocks = list[0].blocks ? [...list[0].blocks] : [];
      } else {
        activeNoteId = null;
        editorBlocks = [];
      }
    },

    createNote(title = "Untitled Note") {
      const newNote = {
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title,
        space: activeSpace,
        spaceId: activeSpace,
        banner: null,
        emoji: "📝",
        isFavorite: false,
        blocks: [{ id: `blk_${Date.now()}`, type: "text", content: "" }],
      };

      notesBySpace = {
        ...notesBySpace,
        [activeSpace]: [...(notesBySpace[activeSpace] || []), newNote],
      };
      activeNoteId = newNote.id;
      editorBlocks = [...newNote.blocks];
      return newNote;
    },

    updateEditorBlocks(newBlocks) {
      editorBlocks = [...newBlocks];
    },

    saveNote(noteToSave) {
      const activeObj = (notesBySpace[activeSpace] || []).find((n) => n.id === activeNoteId) || (notesBySpace[activeSpace] || [])[0];
      const targetNoteId = noteToSave?.id || activeObj?.id || `n_${Date.now()}`;
      const targetSpace = noteToSave?.spaceId || noteToSave?.space || activeObj?.spaceId || activeObj?.space || activeSpace;

      const isTargetActive = !noteToSave?.id || targetNoteId === activeObj?.id;
      const currentBlocks = isTargetActive && editorBlocks && editorBlocks.length > 0
        ? editorBlocks
        : (activeObj?.blocks || []);

      const updatedTitle = noteToSave?.title !== undefined
        ? noteToSave.title
        : (activeObj?.title || "Untitled Note");

      const updatedBlocks = noteToSave?.blocks !== undefined
        ? noteToSave.blocks
        : (currentBlocks.length > 0 ? currentBlocks : [{ id: `blk_${Date.now()}`, type: "text", content: "" }]);

      const updatedBanner = noteToSave?.banner !== undefined
        ? noteToSave.banner
        : (activeObj?.banner ?? null);

      const updatedFav = noteToSave?.isFavorite !== undefined
        ? Boolean(noteToSave.isFavorite)
        : Boolean(activeObj?.isFavorite);

      const updatedEmoji = noteToSave?.emoji !== undefined
        ? noteToSave.emoji
        : (activeObj?.emoji || "📝");

      const noteData = {
        id: targetNoteId,
        spaceId: targetSpace,
        space: targetSpace,
        title: updatedTitle,
        blocks: updatedBlocks,
        banner: updatedBanner,
        isFavorite: updatedFav,
        emoji: updatedEmoji,
      };

      const spaceNotes = notesBySpace[targetSpace] || [];
      const existingIdx = spaceNotes.findIndex((n) => n.id === targetNoteId);
      let updatedNotes;

      if (existingIdx >= 0) {
        updatedNotes = spaceNotes.map((n) => (n.id === targetNoteId ? { ...n, ...noteData } : n));
      } else {
        updatedNotes = [...spaceNotes, noteData];
      }

      notesBySpace = {
        ...notesBySpace,
        [targetSpace]: updatedNotes,
      };

      if (!activeNoteId || (isTargetActive && !activeObj)) {
        activeNoteId = targetNoteId;
      }

      return noteData;
    },
  };
}

describe("Note Persistence & Space Switching Flow", () => {
  it("creates a new note in a newly created space and retains pasted blocks after saving", () => {
    const store = createWorkspaceStore();

    // 1. User switches to a newly created space "Biochemistry"
    store.selectSpace("Biochemistry");
    assert.strictEqual(store.activeSpace, "Biochemistry");
    assert.strictEqual(store.activeNote, null);

    // 2. User creates a new note
    const createdNote = store.createNote("Cellular Respiration");
    assert.strictEqual(store.activeNoteId, createdNote.id);
    assert.strictEqual(store.activeNote.title, "Cellular Respiration");

    // 3. User pastes markdown / structured blocks into the editor
    const pastedBlocks = [
      { id: "b1", type: "h1", content: "Glycolysis & Krebs Cycle" },
      { id: "b2", type: "text", content: "Glucose is broken down into pyruvate." },
      { id: "b3", type: "math", content: "C_6H_{12}O_6 + 6O_2 \\rightarrow 6CO_2 + 6H_2O + 36ATP" },
      { id: "b4", type: "callout", content: "Yields 2 net ATP per glucose in cytoplasm.", calloutIcon: "💡" },
    ];
    store.updateEditorBlocks(pastedBlocks);

    // 4. User saves the note (e.g. Ctrl+S or debounced save)
    store.saveNote();

    // 5. Verify notesBySpace contains the saved blocks
    const biochemNotes = store.notesBySpace["Biochemistry"];
    assert.strictEqual(biochemNotes.length, 1);
    assert.strictEqual(biochemNotes[0].blocks.length, 4);
    assert.strictEqual(biochemNotes[0].blocks[0].content, "Glycolysis & Krebs Cycle");
    assert.strictEqual(biochemNotes[0].blocks[2].content, "C_6H_{12}O_6 + 6O_2 \\rightarrow 6CO_2 + 6H_2O + 36ATP");
  });

  it("preserves note blocks intact when switching between different spaces", () => {
    const store = createWorkspaceStore({
      School: [
        { id: "n_school_1", title: "Calculus", space: "School", spaceId: "School", blocks: [{ id: "sb1", type: "h1", content: "Derivatives" }] },
      ],
      Biochemistry: [],
    });

    // 1. In Biochemistry space, create note and paste 3 blocks
    store.selectSpace("Biochemistry");
    const bioNote = store.createNote("Enzymes");
    const bioBlocks = [
      { id: "eb1", type: "h1", content: "Enzyme Kinetics" },
      { id: "eb2", type: "math", content: "v = \\frac{V_{max}[S]}{K_m + [S]}" },
      { id: "eb3", type: "bullet", content: "Michaelis-Menten constant Km" },
    ];
    store.updateEditorBlocks(bioBlocks);
    store.saveNote();

    // 2. User switches to "School" space to view something
    store.selectSpace("School");
    assert.strictEqual(store.activeSpace, "School");
    assert.strictEqual(store.activeNote.title, "Calculus");
    assert.strictEqual(store.editorBlocks[0].content, "Derivatives");

    // 3. User switches back to "Biochemistry" space
    store.selectSpace("Biochemistry");
    assert.strictEqual(store.activeSpace, "Biochemistry");
    assert.strictEqual(store.activeNote.id, bioNote.id);
    assert.strictEqual(store.activeNote.title, "Enzymes");

    // 4. Verify all blocks are completely intact and not lost
    assert.strictEqual(store.activeNote.blocks.length, 3);
    assert.strictEqual(store.activeNote.blocks[0].content, "Enzyme Kinetics");
    assert.strictEqual(store.activeNote.blocks[1].content, "v = \\frac{V_{max}[S]}{K_m + [S]}");
    assert.strictEqual(store.activeNote.blocks[2].content, "Michaelis-Menten constant Km");
    assert.strictEqual(store.editorBlocks.length, 3);
  });

  it("does not overwrite note blocks when toggling favorite or editing title", () => {
    const store = createWorkspaceStore();
    store.selectSpace("Physics");
    store.createNote("Thermodynamics");

    const thermoBlocks = [
      { id: "tb1", type: "h2", content: "First Law of Thermodynamics" },
      { id: "tb2", type: "math", content: "\\Delta U = Q - W" },
    ];
    store.updateEditorBlocks(thermoBlocks);
    store.saveNote();

    // Toggle favorite via partial save payload
    store.saveNote({ isFavorite: true });
    assert.strictEqual(store.activeNote.isFavorite, true);
    assert.strictEqual(store.activeNote.blocks.length, 2);
    assert.strictEqual(store.activeNote.blocks[1].content, "\\Delta U = Q - W");

    // Update title via partial save payload
    store.saveNote({ title: "Thermodynamics & Heat Engines" });
    assert.strictEqual(store.activeNote.title, "Thermodynamics & Heat Engines");
    assert.strictEqual(store.activeNote.blocks.length, 2);
    assert.strictEqual(store.activeNote.blocks[0].content, "First Law of Thermodynamics");
  });
});

describe("Marquee / Lasso Selection & Auto-Scrolling Mechanics", () => {
  it("calculates 2D box intersection accurately across multiple blocks", () => {
    const blocks = [
      { id: "b1", top: 100, bottom: 150, left: 50, right: 650 },
      { id: "b2", top: 160, bottom: 210, left: 50, right: 650 },
      { id: "b3", top: 220, bottom: 300, left: 50, right: 650 },
      { id: "b4", top: 310, bottom: 380, left: 50, right: 650 },
    ];

    // Marquee box spanning from y=120 to y=250 (intersects b1, b2, b3)
    const marqueeBox = { left: 40, right: 500, top: 120, bottom: 250 };

    const selectedIds = new Set();
    for (const b of blocks) {
      const intersects =
        b.left < marqueeBox.right &&
        b.right > marqueeBox.left &&
        b.top < marqueeBox.bottom &&
        b.bottom > marqueeBox.top;
      if (intersects) {
        selectedIds.add(b.id);
      }
    }

    assert.strictEqual(selectedIds.size, 3);
    assert.ok(selectedIds.has("b1"));
    assert.ok(selectedIds.has("b2"));
    assert.ok(selectedIds.has("b3"));
    assert.ok(!selectedIds.has("b4"));
  });

  it("calculates progressive auto-scroll velocity near viewport edge thresholds", () => {
    const container = { top: 100, bottom: 900, height: 800 };
    const threshold = 80;

    function computeScrollSpeed(mouseY) {
      const topThreshold = container.top + threshold; // 180
      const bottomThreshold = container.bottom - threshold; // 820

      if (mouseY < topThreshold) {
        const dist = topThreshold - mouseY;
        return -Math.min(35, Math.max(3, (dist / threshold) * 30));
      } else if (mouseY > bottomThreshold) {
        const dist = mouseY - bottomThreshold;
        return Math.min(35, Math.max(3, (dist / threshold) * 30));
      }
      return 0;
    }

    // Inside dead zone -> no scrolling
    assert.strictEqual(computeScrollSpeed(500), 0);

    // Near top edge -> negative speed (scroll up)
    const topSpeed = computeScrollSpeed(140);
    assert.ok(topSpeed < 0);
    assert.strictEqual(topSpeed, -15);

    // Beyond top edge -> maximum upward velocity
    const extremeTopSpeed = computeScrollSpeed(50);
    assert.strictEqual(extremeTopSpeed, -35);

    // Near bottom edge -> positive speed (scroll down)
    const bottomSpeed = computeScrollSpeed(860);
    assert.ok(bottomSpeed > 0);
    assert.strictEqual(bottomSpeed, 15);

    // Beyond bottom edge -> maximum downward velocity
    const extremeBottomSpeed = computeScrollSpeed(950);
    assert.strictEqual(extremeBottomSpeed, 35);
  });
});

describe("LaTeX MathBlock Scaling, Readability Floor & Scroll Wheel Mechanics", () => {
  const MIN_READABLE_SCALE = 0.75;

  function evaluateFormulaViewport(rawFormulaWidth, containerWidth) {
    if (rawFormulaWidth <= containerWidth) {
      return { scale: 1, isOverflowing: false };
    }
    const idealScale = containerWidth / rawFormulaWidth;
    if (idealScale >= MIN_READABLE_SCALE) {
      return { scale: idealScale, isOverflowing: false };
    }
    return { scale: MIN_READABLE_SCALE, isOverflowing: true };
  }

  it("renders short formulas at 100% full scale without overflow", () => {
    const result = evaluateFormulaViewport(120, 600);
    assert.strictEqual(result.scale, 1);
    assert.strictEqual(result.isOverflowing, false);
  });

  it("scales medium formulas smoothly down to fit within container when >= 0.75", () => {
    const result = evaluateFormulaViewport(400, 320); // 320/400 = 0.8
    assert.strictEqual(result.scale, 0.8);
    assert.strictEqual(result.isOverflowing, false);
  });

  it("locks long formulas to minimum readable floor (0.75) and enables scroll wheel when exceeding threshold", () => {
    const result = evaluateFormulaViewport(800, 320); // 320/800 = 0.4 < 0.75
    assert.strictEqual(result.scale, 0.75);
    assert.strictEqual(result.isOverflowing, true);
  });

  it("converts vertical wheel deltas into horizontal panning within scroll bounds", () => {
    const viewport = {
      scrollLeft: 100,
      scrollWidth: 800,
      clientWidth: 350,
    };

    function handleWheelDelta(deltaY, vp) {
      const canScrollLeft = vp.scrollLeft > 0;
      const canScrollRight = vp.scrollLeft < vp.scrollWidth - vp.clientWidth - 1;

      if ((deltaY < 0 && canScrollLeft) || (deltaY > 0 && canScrollRight)) {
        return { handled: true, newScrollLeft: vp.scrollLeft + deltaY * 0.85 };
      }
      return { handled: false, newScrollLeft: vp.scrollLeft };
    }

    // Scroll right with positive deltaY
    const scrollRight = handleWheelDelta(50, viewport);
    assert.strictEqual(scrollRight.handled, true);
    assert.strictEqual(scrollRight.newScrollLeft, 142.5);

    // Scroll left with negative deltaY
    const scrollLeft = handleWheelDelta(-40, viewport);
    assert.strictEqual(scrollLeft.handled, true);
    assert.strictEqual(scrollLeft.newScrollLeft, 66);

    // At far right edge -> deltaY positive does not block page scroll
    const atRightEdge = { scrollLeft: 450, scrollWidth: 800, clientWidth: 350 };
    const overflowRight = handleWheelDelta(50, atRightEdge);
    assert.strictEqual(overflowRight.handled, false);
  });
});

describe("Sidebar Note Drag-and-Drop Reordering Mechanics", () => {
  it("reorders note array correctly when dragging note below another note", () => {
    const notes = [
      { id: "n1", title: "Note 1", order: 0 },
      { id: "n2", title: "Note 2", order: 1 },
      { id: "n3", title: "Note 3", order: 2 },
      { id: "n4", title: "Note 4", order: 3 },
    ];

    // Drag n1 and drop at bottom of n3
    const fromIdx = notes.findIndex((n) => n.id === "n1");
    const updated = [...notes];
    const [moved] = updated.splice(fromIdx, 1);
    let toIdx = updated.findIndex((n) => n.id === "n3");
    toIdx += 1; // position === 'bottom'
    updated.splice(toIdx, 0, moved);

    const reindexed = updated.map((n, idx) => ({ ...n, order: idx }));

    assert.deepStrictEqual(
      reindexed.map((n) => n.id),
      ["n2", "n3", "n1", "n4"]
    );
    assert.strictEqual(reindexed[2].id, "n1");
    assert.strictEqual(reindexed[2].order, 2);
  });

  it("reorders note array correctly when dragging note above another note", () => {
    const notes = [
      { id: "n1", title: "Note 1", order: 0 },
      { id: "n2", title: "Note 2", order: 1 },
      { id: "n3", title: "Note 3", order: 2 },
      { id: "n4", title: "Note 4", order: 3 },
    ];

    // Drag n4 and drop at top of n2
    const fromIdx = notes.findIndex((n) => n.id === "n4");
    const updated = [...notes];
    const [moved] = updated.splice(fromIdx, 1);
    let toIdx = updated.findIndex((n) => n.id === "n2");
    // position === 'top' -> insert at toIdx directly
    updated.splice(toIdx, 0, moved);

    const reindexed = updated.map((n, idx) => ({ ...n, order: idx }));

    assert.deepStrictEqual(
      reindexed.map((n) => n.id),
      ["n1", "n4", "n2", "n3"]
    );
    assert.strictEqual(reindexed[1].id, "n4");
    assert.strictEqual(reindexed[1].order, 1);
  });

  it("sorts loaded notes by order attribute ascending with deterministic tie-breakers", () => {
    const rawNotesFromDb = [
      { id: "n3", title: "Note 3", order: 2, createdAt: "2026-01-03T00:00:00Z" },
      { id: "n1", title: "Note 1", order: 0, createdAt: "2026-01-01T00:00:00Z" },
      { id: "n4", title: "Note 4", order: 3, createdAt: "2026-01-04T00:00:00Z" },
      { id: "n2", title: "Note 2", order: 1, createdAt: "2026-01-02T00:00:00Z" },
    ];

    const sorted = [...rawNotesFromDb].sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        (a.createdAt || "").localeCompare(b.createdAt || "") ||
        (a.id || "").localeCompare(b.id || "")
    );

    assert.deepStrictEqual(
      sorted.map((n) => n.id),
      ["n1", "n2", "n3", "n4"]
    );
  });

  it("calculates drop position accurately using event coordinates (top vs bottom)", () => {
    const rect = { top: 100, height: 40 }; // midY = 120
    const clientYTop = 110;
    const clientYBottom = 135;

    const isBottomTop = clientYTop >= rect.top + rect.height / 2;
    const isBottomBottom = clientYBottom >= rect.top + rect.height / 2;

    assert.strictEqual(isBottomTop, false, "Drop above midpoint should target top/before");
    assert.strictEqual(isBottomBottom, true, "Drop below midpoint should target bottom/after");
  });

  it("places moved note at the very end when dropped on bottom container", () => {
    const notes = [
      { id: "n1", title: "Note 1", order: 0 },
      { id: "n2", title: "Note 2", order: 1 },
      { id: "n3", title: "Note 3", order: 2 },
    ];

    // Drag n1 to bottom of container
    const fromIdx = notes.findIndex((n) => n.id === "n1");
    const updated = [...notes];
    const [moved] = updated.splice(fromIdx, 1);
    updated.push(moved);

    const reindexed = updated.map((n, idx) => ({ ...n, order: idx }));
    assert.deepStrictEqual(
      reindexed.map((n) => n.id),
      ["n2", "n3", "n1"]
    );
    assert.strictEqual(reindexed[2].id, "n1");
    assert.strictEqual(reindexed[2].order, 2);
  });

  it("preserves existing note order when saved without explicit order property", () => {
    const existingNoteInDb = {
      id: "note_abc",
      title: "Existing Title",
      spaceId: "School",
      order: 4,
      createdAt: "2026-06-01T10:00:00.000Z",
    };

    const updatePayload = {
      id: "note_abc",
      title: "Updated Title After Auto-save",
      spaceId: "School",
      // order is omitted
    };

    const finalOrder =
      typeof updatePayload.order === "number"
        ? updatePayload.order
        : existingNoteInDb && typeof existingNoteInDb.order === "number"
          ? existingNoteInDb.order
          : 0;

    assert.strictEqual(finalOrder, 4, "Auto-save must preserve existing order 4 instead of resetting to 0");
  });
});

describe("List Block Enter Key Splitting & Empty List Exit Mechanics", () => {
  function simulateEnterKeyOnBlock({ block, cursorOffset }) {
    const fullText = block.content || "";
    const textBefore = fullText.slice(0, cursorOffset);
    const textAfter = fullText.slice(cursorOffset);

    let changedType = null;
    let updatedCurrentContent = null;
    let addedBlock = null;

    // Mirrors BlockNoteEditor Enter key handler
    if (["bullet", "number", "todo", "toggle", "callout", "quote"].includes(block.type) && !textBefore.trim() && !textAfter.trim()) {
      changedType = "text";
      return { changedType, updatedCurrentContent: "", addedBlock: null };
    }

    updatedCurrentContent = textBefore;
    const nextType = ["h1", "h2", "h3", "h4", "callout", "quote"].includes(block.type) ? "text" : block.type;
    addedBlock = {
      id: `blk_new_${Date.now()}`,
      type: nextType,
      content: textAfter,
    };

    return { changedType, updatedCurrentContent, addedBlock };
  }

  it("splits list item cleanly when Enter is pressed at offset 0 (start of text) without deleting content", () => {
    const block = { id: "b1", type: "bullet", content: "Chapter 12: Respiration" };
    const result = simulateEnterKeyOnBlock({ block, cursorOffset: 0 });

    assert.strictEqual(result.changedType, null, "Must NOT convert block to text when textAfter has content");
    assert.strictEqual(result.updatedCurrentContent, "", "Current bullet block becomes empty bullet item");
    assert.ok(result.addedBlock, "Must spawn a new block below");
    assert.strictEqual(result.addedBlock.type, "bullet", "New block must inherit bullet type");
    assert.strictEqual(result.addedBlock.content, "Chapter 12: Respiration", "Text must be preserved completely in the spawned block");
  });

  it("splits list item in the middle when Enter is pressed midway", () => {
    const block = { id: "b1", type: "number", content: "Step 1: Glycolysis pathway" };
    const result = simulateEnterKeyOnBlock({ block, cursorOffset: 8 });

    assert.strictEqual(result.updatedCurrentContent, "Step 1: ");
    assert.strictEqual(result.addedBlock.type, "number");
    assert.strictEqual(result.addedBlock.content, "Glycolysis pathway");
  });

  it("splits formatted text without truncating words like Word Equation into mangled fragments", () => {
    const text = "Word Equation: Glucose + Oxygen";
    const cursorOffset = 5; // right after "Word "
    const textBefore = text.slice(0, cursorOffset);
    const textAfter = text.slice(cursorOffset);

    assert.strictEqual(textBefore, "Word ");
    assert.strictEqual(textAfter, "Equation: Glucose + Oxygen", "Must retain full word Equation without truncation");
  });

  it("strips leftover bullet markers when splitting or continuing a bullet block", () => {
    let rawInheritedText = "* Chemical reactants";
    const cleaned = rawInheritedText.replace(/^(\*|-|•|\d+\.|\[\s?\])\s+/, "");
    assert.strictEqual(cleaned, "Chemical reactants", "Asterisk bullet marker must be cleaned");
  });

  it("exits list and converts to text block ONLY when Enter is pressed on an empty list item", () => {
    const block = { id: "b1", type: "bullet", content: "" };
    const result = simulateEnterKeyOnBlock({ block, cursorOffset: 0 });

    assert.strictEqual(result.changedType, "text", "Empty bullet must convert to standard paragraph text");
    assert.strictEqual(result.addedBlock, null, "No additional block should be spawned when exiting empty list");
  });
});

describe("Backspace Deletion & Caret Offset Calculation Mechanics", () => {
  function simulateBackspaceOnEmptyListBlock(blocks, targetBlockId) {
    const idx = blocks.findIndex((b) => b.id === targetBlockId);
    if (idx === -1) return { nextBlocks: blocks, focusedBlockId: null, targetCaretOffset: 0 };

    const targetBlock = blocks[idx];
    if (targetBlock.content === "" && blocks.length > 1) {
      const prevBlock = idx > 0 ? blocks[idx - 1] : null;
      const nextBlocks = blocks.filter((b) => b.id !== targetBlockId);
      return {
        nextBlocks,
        focusedBlockId: prevBlock ? prevBlock.id : null,
        targetCaretOffset: prevBlock ? (prevBlock.content || "").length : 0,
      };
    }

    return { nextBlocks: blocks, focusedBlockId: targetBlockId, targetCaretOffset: 0 };
  }

  it("deletes empty list block on Backspace and focuses the exact end of previous list item", () => {
    const blocks = [
      { id: "b1", type: "bullet", content: "Photosynthesis in chloroplasts" },
      { id: "b2", type: "bullet", content: "" },
    ];

    const result = simulateBackspaceOnEmptyListBlock(blocks, "b2");
    assert.strictEqual(result.nextBlocks.length, 1);
    assert.strictEqual(result.focusedBlockId, "b1");
    assert.strictEqual(result.targetCaretOffset, "Photosynthesis in chloroplasts".length);
  });

  it("merges non-empty list block directly into previous list block without changing type to text", () => {
    const blocks = [
      { id: "b1", type: "bullet", content: "Item 1" },
      { id: "b2", type: "bullet", content: "Item 2" },
    ];
    const prevBlock = blocks[0];
    const currentBlock = blocks[1];
    const mergedContent = (prevBlock.content || "") + (currentBlock.content || "");
    const remainingBlocks = [
      { ...prevBlock, content: mergedContent }
    ];

    assert.strictEqual(remainingBlocks.length, 1);
    assert.strictEqual(remainingBlocks[0].type, "bullet", "Must remain bullet type");
    assert.strictEqual(remainingBlocks[0].content, "Item 1Item 2");
  });

  it("calculates exact caret merge boundary when merging adjacent list blocks", () => {
    const prevContent = "First topic heading";
    const currentContent = " and continuation";
    const mergedContent = prevContent + currentContent;
    const caretAtMergeJoin = prevContent.length;

    assert.strictEqual(caretAtMergeJoin, 19);
    assert.strictEqual(mergedContent.slice(0, caretAtMergeJoin), "First topic heading");
    assert.strictEqual(mergedContent.slice(caretAtMergeJoin), " and continuation");
  });

  it("un-lists formatted list blocks (bullet, number, todo, toggle) to text on Backspace before merging or deleting", () => {
    function simulateBackspaceHandler(blocks, targetBlockId, isAtStart) {
      const idx = blocks.findIndex((b) => b.id === targetBlockId);
      const block = blocks[idx];

      // 1. Un-list / un-format
      if (block.type !== "text" && (isAtStart || block.content === "")) {
        const nextBlocks = blocks.map((b) => (b.id === targetBlockId ? { ...b, type: "text" } : b));
        return { action: "un-list", nextBlocks, focusedBlockId: targetBlockId, targetCaret: "start" };
      }

      // 2. Empty text deletion
      if (block.type === "text" && block.content === "" && blocks.length > 1) {
        const prevBlock = idx > 0 ? blocks[idx - 1] : blocks[1];
        const nextBlocks = blocks.filter((b) => b.id !== targetBlockId);
        return { action: "delete-empty", nextBlocks, focusedBlockId: prevBlock.id, targetCaret: idx > 0 ? "end" : "start" };
      }

      // 3. Text merge at offset 0
      if (block.type === "text" && isAtStart && idx > 0) {
        const prevBlock = blocks[idx - 1];
        const mergedContent = (prevBlock.content || "") + (block.content || "");
        const nextBlocks = blocks.filter((b) => b.id !== targetBlockId).map((b) => (b.id === prevBlock.id ? { ...b, content: mergedContent } : b));
        return { action: "merge", nextBlocks, focusedBlockId: prevBlock.id, targetCaret: (prevBlock.content || "").length };
      }

      return { action: "none", nextBlocks: blocks, focusedBlockId: targetBlockId, targetCaret: 0 };
    }

    const testBlocks = [
      { id: "b1", type: "h1", content: "Main Topic" },
      { id: "b2", type: "bullet", content: "Key observation" },
    ];

    // Pressing Backspace at offset 0 of bullet item:
    const step1 = simulateBackspaceHandler(testBlocks, "b2", true);
    assert.strictEqual(step1.action, "un-list");
    assert.strictEqual(step1.nextBlocks[1].type, "text", "Must un-list bullet to text");
    assert.strictEqual(step1.nextBlocks[1].content, "Key observation", "Must retain content intact");

    // Pressing Backspace AGAIN at offset 0 of the now-plain-text block:
    const step2 = simulateBackspaceHandler(step1.nextBlocks, "b2", true);
    assert.strictEqual(step2.action, "merge");
    assert.strictEqual(step2.nextBlocks.length, 1);
    assert.strictEqual(step2.nextBlocks[0].content, "Main TopicKey observation");
  });

  it("cleans checked todo markers [x] and [X] when splitting task items on Enter", () => {
    const rawInheritedDoneTask = "[x] Complete lab writeup";
    const cleaned = rawInheritedDoneTask.replace(/^(\*|-|•|\d+\.|\[[ xX]?\])\s+/, "");
    assert.strictEqual(cleaned, "Complete lab writeup", "Checked task marker [x] must be stripped");

    const rawInheritedUpperDone = "[X] Submit assignment";
    const cleanedUpper = rawInheritedUpperDone.replace(/^(\*|-|•|\d+\.|\[[ xX]?\])\s+/, "");
    assert.strictEqual(cleanedUpper, "Submit assignment", "Checked task marker [X] must be stripped");
  });
});

describe("Notion-Style Note Menu Actions & Metadata Mechanics", () => {
  it("duplicates note with unique IDs, preserved emoji/banner, deep-copied blocks and appended copy title", () => {
    const originalNote = {
      id: "n_orig_123",
      title: "Cell Respiration",
      space: "School",
      spaceId: "School",
      emoji: "🧬",
      banner: "linear-gradient(to right, #000, #fff)",
      isFavorite: true,
      blocks: [
        { id: "blk_1", type: "h1", content: "Glycolysis" },
        { id: "blk_2", type: "text", content: "Occurs in cytoplasm without oxygen." },
      ],
    };

    const clonedBlocks = originalNote.blocks.map((b) => ({
      ...b,
      id: `blk_dup_${Math.random().toString(36).slice(2, 6)}`,
    }));

    const duplicatedNote = {
      id: "n_dup_456",
      title: `${originalNote.title} (Copy)`,
      space: originalNote.space,
      spaceId: originalNote.spaceId,
      banner: originalNote.banner,
      emoji: originalNote.emoji,
      isFavorite: originalNote.isFavorite,
      blocks: clonedBlocks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.strictEqual(duplicatedNote.title, "Cell Respiration (Copy)");
    assert.strictEqual(duplicatedNote.emoji, "🧬");
    assert.strictEqual(duplicatedNote.banner, "linear-gradient(to right, #000, #fff)");
    assert.strictEqual(duplicatedNote.isFavorite, true);
    assert.strictEqual(duplicatedNote.blocks.length, 2);
    assert.notStrictEqual(duplicatedNote.blocks[0].id, originalNote.blocks[0].id);
    assert.strictEqual(duplicatedNote.blocks[0].content, "Glycolysis");
  });

  it("moves note cleanly between spaces preserving block payload and order", () => {
    const noteMap = {
      School: [
        { id: "n_1", title: "Math", space: "School" },
        { id: "n_2", title: "Physics", space: "School" },
      ],
      Personal: [
        { id: "n_3", title: "Fitness Plan", space: "Personal" },
      ],
    };

    const targetNote = noteMap.School[1]; // Physics
    const targetSpace = "Personal";

    // Simulate moving targetNote from School to Personal
    const nextFromList = noteMap.School.filter((n) => n.id !== targetNote.id);
    const updatedNote = { ...targetNote, space: targetSpace, spaceId: targetSpace, order: noteMap.Personal.length };
    const nextToList = [...noteMap.Personal, updatedNote];

    const nextNoteMap = {
      School: nextFromList,
      Personal: nextToList,
    };

    assert.strictEqual(nextNoteMap.School.length, 1);
    assert.strictEqual(nextNoteMap.Personal.length, 2);
    assert.strictEqual(nextNoteMap.Personal[1].title, "Physics");
    assert.strictEqual(nextNoteMap.Personal[1].space, "Personal");
  });

  it("renames note title accurately trimming excess whitespace", () => {
    const note = { id: "n_1", title: "Draft Notes" };
    const newTitle = "  Advanced Electromagnetism  ";

    const renamed = {
      ...note,
      title: newTitle.trim(),
      updatedAt: new Date().toISOString(),
    };

    assert.strictEqual(renamed.title, "Advanced Electromagnetism");
  });

  it("formats human-readable relative and exact edit timestamps", () => {
    function formatLastEdited(timestamp) {
      if (!timestamp) return "Just now";
      try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return "Recently";
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
        if (diffDays === 0) return `Today at ${timeStr}`;
        if (diffDays === 1) return `Yesterday at ${timeStr}`;

        return date.toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        }) + ` at ${timeStr}`;
      } catch (e) {
        return "Recently";
      }
    }

    const justNow = new Date().toISOString();
    assert.strictEqual(formatLastEdited(justNow), "Just now");

    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    assert.strictEqual(formatLastEdited(tenMinsAgo), "10 mins ago");
  });

  it("dynamically flips dropdown upwards when button is near bottom of viewport", () => {
    function computeDropdownPosition({ buttonBottom, buttonTop, windowHeight, menuHeight, menuWidth, align, windowWidth }) {
      const spaceBelow = windowHeight - buttonBottom;
      const spaceAbove = buttonTop;
      const openUpwards = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      let left = align === "left" ? 100 : 100 + 24 - menuWidth;
      left = Math.max(8, Math.min(left, windowWidth - menuWidth - 8));

      let top = 0;
      let bottom = "auto";
      if (openUpwards) {
        bottom = windowHeight - buttonTop + 6;
      } else {
        top = buttonBottom + 6;
      }

      return { openUpwards, top, bottom, left };
    }

    // Case 1: Button near bottom (e.g. at y = 750 in 800px window)
    const bottomResult = computeDropdownPosition({
      buttonBottom: 780,
      buttonTop: 750,
      windowHeight: 800,
      menuHeight: 280,
      menuWidth: 224,
      align: "right",
      windowWidth: 1200,
    });

    assert.strictEqual(bottomResult.openUpwards, true, "Must flip upwards when space below is insufficient");
    assert.strictEqual(bottomResult.bottom, 800 - 750 + 6);
    assert.strictEqual(bottomResult.top, 0);

    // Case 2: Button near top (e.g. at y = 100 in 800px window)
    const topResult = computeDropdownPosition({
      buttonBottom: 130,
      buttonTop: 100,
      windowHeight: 800,
      menuHeight: 280,
      menuWidth: 224,
      align: "right",
      windowWidth: 1200,
    });

    assert.strictEqual(topResult.openUpwards, false, "Must open downwards when space below is ample");
    assert.strictEqual(topResult.top, 136);
  });

  it("clamps dropdown left coordinate to prevent horizontal viewport clipping", () => {
    function clampLeft(rawLeft, menuWidth, windowWidth) {
      return Math.max(8, Math.min(rawLeft, windowWidth - menuWidth - 8));
    }

    // Negative raw left (e.g. button at x = 50, menuWidth = 224 -> rawLeft = -174)
    assert.strictEqual(clampLeft(-174, 224, 1200), 8, "Left must never be less than 8px");

    // Overflow raw left (e.g. rawLeft = 1100, menuWidth = 224, windowWidth = 1200 -> max = 1200 - 224 - 8 = 968)
    assert.strictEqual(clampLeft(1100, 224, 1200), 968, "Right must never overflow past viewport - 8px");
  });

  it("serializes full note markdown payload for Copy Contents button", async () => {
    const { blocksToMarkdownLossy } = await import("../../lib/exportImport.js");
    const testNote = {
      title: "Photosynthesis Study Guide",
      blocks: [
        { id: "b1", type: "h1", content: "Light Dependent Reactions" },
        { id: "b2", type: "bullet", content: "Occurs in thylakoid membrane" },
        { id: "b3", type: "todo", content: "Memorize ATP synthase mechanism", checked: true },
        { id: "b4", type: "math", content: "6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2" },
      ],
    };

    const markdownBody = blocksToMarkdownLossy(testNote.blocks);
    const fullText = `# ${testNote.title}\n\n${markdownBody}`;

    assert.ok(fullText.startsWith("# Photosynthesis Study Guide"));
    assert.ok(fullText.includes("- Occurs in thylakoid membrane"));
    assert.ok(fullText.includes("[x] Memorize ATP synthase mechanism"));
    assert.ok(fullText.includes("$$\n6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2\n$$"));
  });
});




