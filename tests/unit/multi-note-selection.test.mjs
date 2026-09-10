import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Test model for multi-note selection state and batch operations
 * matching Workspace.jsx and Sidebar.jsx logic.
 */
function createMultiNoteSelectionManager(initialNotes = []) {
  let notes = [...initialNotes];
  let selectedNoteIds = new Set();
  let isMultiSelecting = false;
  let trash = [];

  return {
    get notes() {
      return notes;
    },
    get selectedNoteIds() {
      return selectedNoteIds;
    },
    get isMultiSelecting() {
      return isMultiSelecting;
    },
    get trash() {
      return trash;
    },
    get selectedCount() {
      return selectedNoteIds.size;
    },

    toggleSelectMode() {
      isMultiSelecting = !isMultiSelecting;
      if (!isMultiSelecting) {
        selectedNoteIds.clear();
      }
    },

    toggleNoteSelection(noteId) {
      if (selectedNoteIds.has(noteId)) {
        selectedNoteIds.delete(noteId);
      } else {
        selectedNoteIds.add(noteId);
      }
    },

    selectAll() {
      if (selectedNoteIds.size === notes.length) {
        selectedNoteIds.clear();
      } else {
        selectedNoteIds = new Set(notes.map((n) => n.id));
      }
    },

    clearSelection() {
      selectedNoteIds.clear();
    },

    // Batch Delete (requires confirmation before executing)
    batchDelete(confirmed) {
      if (!confirmed) return false;
      const ids = new Set(selectedNoteIds);
      const toDelete = notes.filter((n) => ids.has(n.id));
      notes = notes.filter((n) => !ids.has(n.id));
      trash.push(...toDelete.map((n) => ({ ...n, deletedAt: new Date().toISOString() })));
      selectedNoteIds.clear();
      if (notes.length === 0) {
        isMultiSelecting = false;
      }
      return true;
    },

    // Batch Move to Space
    batchMove(targetSpace) {
      const ids = new Set(selectedNoteIds);
      const toMove = notes.filter((n) => ids.has(n.id));
      notes = notes.filter((n) => !ids.has(n.id));
      const moved = toMove.map((n, idx) => ({
        ...n,
        space: targetSpace,
        spaceId: targetSpace,
        order: idx,
        updatedAt: new Date().toISOString(),
      }));
      selectedNoteIds.clear();
      return moved;
    },

    // Batch Star / Favorite Toggle
    batchToggleFavorite() {
      const ids = new Set(selectedNoteIds);
      const targets = notes.filter((n) => ids.has(n.id));
      const allStarred = targets.length > 0 && targets.every((n) => Boolean(n.isFavorite));
      const nextFav = !allStarred;
      notes = notes.map((n) => (ids.has(n.id) ? { ...n, isFavorite: nextFav } : n));
      return nextFav;
    },

    // Batch Duplicate
    batchDuplicate() {
      const ids = new Set(selectedNoteIds);
      const toDuplicate = notes.filter((n) => ids.has(n.id));
      const duplicates = toDuplicate.map((n, idx) => ({
        ...n,
        id: `dup_${n.id}_${idx}`,
        title: `Copy of ${n.title || "Untitled Note"}`,
        blocks: (n.blocks || []).map((b) => ({ ...b, id: `dup_blk_${b.id}` })),
      }));
      notes = [...notes, ...duplicates];
      selectedNoteIds.clear();
      return duplicates;
    },
  };
}

describe("Multi-Note Selection & Batch Actions Engine", () => {
  it("allows toggling selection mode and individual note selection one-by-one", () => {
    const manager = createMultiNoteSelectionManager([
      { id: "note_1", title: "Physics Lecture 1", isFavorite: false },
      { id: "note_2", title: "Math Quiz Review", isFavorite: false },
      { id: "note_3", title: "Chemistry Lab", isFavorite: false },
    ]);

    assert.equal(manager.isMultiSelecting, false);
    manager.toggleSelectMode();
    assert.equal(manager.isMultiSelecting, true);
    assert.equal(manager.selectedCount, 0);

    // Select note_1
    manager.toggleNoteSelection("note_1");
    assert.equal(manager.selectedCount, 1);
    assert.ok(manager.selectedNoteIds.has("note_1"));

    // Select note_3
    manager.toggleNoteSelection("note_3");
    assert.equal(manager.selectedCount, 2);
    assert.ok(manager.selectedNoteIds.has("note_3"));

    // Toggle note_1 off
    manager.toggleNoteSelection("note_1");
    assert.equal(manager.selectedCount, 1);
    assert.ok(!manager.selectedNoteIds.has("note_1"));
    assert.ok(manager.selectedNoteIds.has("note_3"));
  });

  it("supports Select All and Deselect All toggle", () => {
    const manager = createMultiNoteSelectionManager([
      { id: "note_1", title: "Note 1" },
      { id: "note_2", title: "Note 2" },
      { id: "note_3", title: "Note 3" },
    ]);

    manager.toggleSelectMode();
    manager.selectAll();
    assert.equal(manager.selectedCount, 3);
    assert.ok(manager.selectedNoteIds.has("note_1"));
    assert.ok(manager.selectedNoteIds.has("note_2"));
    assert.ok(manager.selectedNoteIds.has("note_3"));

    // Clicking select all again when all are selected deselects all
    manager.selectAll();
    assert.equal(manager.selectedCount, 0);
  });

  it("requires confirmation before moving multiple selected notes to trash", () => {
    const manager = createMultiNoteSelectionManager([
      { id: "note_1", title: "Important Exam Notes" },
      { id: "note_2", title: "Project Draft" },
      { id: "note_3", title: "Scratchpad" },
    ]);

    manager.toggleSelectMode();
    manager.toggleNoteSelection("note_1");
    manager.toggleNoteSelection("note_2");

    // User cancels the confirmation dialog
    const cancelled = manager.batchDelete(false);
    assert.equal(cancelled, false);
    assert.equal(manager.notes.length, 3);
    assert.equal(manager.trash.length, 0);

    // User confirms the confirmation dialog
    const confirmed = manager.batchDelete(true);
    assert.equal(confirmed, true);
    assert.equal(manager.notes.length, 1);
    assert.equal(manager.notes[0].id, "note_3");
    assert.equal(manager.trash.length, 2);
    assert.equal(manager.trash[0].title, "Important Exam Notes");
    assert.equal(manager.trash[1].title, "Project Draft");
    assert.equal(manager.selectedCount, 0);
  });

  it("moves multiple selected notes into target space cleanly", () => {
    const manager = createMultiNoteSelectionManager([
      { id: "note_1", title: "Note 1", space: "School" },
      { id: "note_2", title: "Note 2", space: "School" },
      { id: "note_3", title: "Note 3", space: "School" },
    ]);

    manager.toggleSelectMode();
    manager.toggleNoteSelection("note_1");
    manager.toggleNoteSelection("note_3");

    const movedNotes = manager.batchMove("Personal");
    assert.equal(movedNotes.length, 2);
    assert.equal(movedNotes[0].space, "Personal");
    assert.equal(movedNotes[1].space, "Personal");

    // Source space now only retains note_2
    assert.equal(manager.notes.length, 1);
    assert.equal(manager.notes[0].id, "note_2");
    assert.equal(manager.selectedCount, 0);
  });

  it("stars and unstars multiple selected notes in bulk", () => {
    const manager = createMultiNoteSelectionManager([
      { id: "note_1", title: "Note 1", isFavorite: false },
      { id: "note_2", title: "Note 2", isFavorite: false },
      { id: "note_3", title: "Note 3", isFavorite: true },
    ]);

    manager.toggleSelectMode();
    manager.toggleNoteSelection("note_1");
    manager.toggleNoteSelection("note_2");

    // Star both note_1 and note_2
    const nextFav = manager.batchToggleFavorite();
    assert.equal(nextFav, true);
    assert.equal(manager.notes.find((n) => n.id === "note_1").isFavorite, true);
    assert.equal(manager.notes.find((n) => n.id === "note_2").isFavorite, true);

    // Now all 3 notes are favorited. Select all 3 and toggle favorite -> unstars all 3
    manager.selectAll();
    const unstarFav = manager.batchToggleFavorite();
    assert.equal(unstarFav, false);
    assert.equal(manager.notes.find((n) => n.id === "note_1").isFavorite, false);
    assert.equal(manager.notes.find((n) => n.id === "note_2").isFavorite, false);
    assert.equal(manager.notes.find((n) => n.id === "note_3").isFavorite, false);
  });

  it("duplicates multiple selected notes with 'Copy of [note name]' titles and cloned blocks", () => {
    const manager = createMultiNoteSelectionManager([
      {
        id: "note_1",
        title: "Biology 101",
        blocks: [{ id: "b1", type: "text", content: "Cell division" }],
      },
      {
        id: "note_2",
        title: "Chemistry 201",
        blocks: [{ id: "b2", type: "text", content: "Stoichiometry" }],
      },
    ]);

    manager.toggleSelectMode();
    manager.selectAll();

    const duplicated = manager.batchDuplicate();
    assert.equal(duplicated.length, 2);
    assert.equal(duplicated[0].title, "Copy of Biology 101");
    assert.equal(duplicated[1].title, "Copy of Chemistry 201");
    assert.notEqual(duplicated[0].id, "note_1");
    assert.notEqual(duplicated[0].blocks[0].id, "b1");

    // Total notes should now be 4
    assert.equal(manager.notes.length, 4);
  });
});
