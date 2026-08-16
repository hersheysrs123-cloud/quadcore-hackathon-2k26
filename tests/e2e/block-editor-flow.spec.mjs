import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * ─── BLOCK EDITOR FLOW STATE LOGIC ──────────────────────────────────
 * Core document manipulation logic from BlockNoteEditor.jsx
 */

export function filterSlashCommands(query, commands) {
  if (!query) return commands;
  const q = query.toLowerCase().trim();
  return commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.type.toLowerCase().includes(q) ||
      cmd.keywords?.toLowerCase().includes(q)
  );
}

export function reorderBlocks(blocks, sourceIndex, targetIndex) {
  if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0) return blocks;
  const next = [...blocks];
  const [removed] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, removed);
  return next;
}

export function pushHistoryState(history, newBlocks) {
  const past = [...history.past, history.present];
  return {
    past,
    present: newBlocks,
    future: [], // Clear future redo stack on new edit
  };
}

export function undoHistory(history) {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);
  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory(history) {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  const newFuture = history.future.slice(1);
  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("E2E Specification: Block Editor Document Flow", () => {
  const mockCommands = [
    { type: "text", label: "Text", keywords: "paragraph plain" },
    { type: "h1", label: "Heading 1", keywords: "title large" },
    { type: "h2", label: "Heading 2", keywords: "section medium" },
    { type: "code", label: "Code Block", keywords: "snippet javascript python" },
    { type: "math", label: "Math Equation", keywords: "latex katex formula" },
    { type: "callout", label: "Callout", keywords: "alert note tip" },
  ];

  it("filters slash menu commands based on query string", () => {
    const mathResults = filterSlashCommands("katex", mockCommands);
    assert.strictEqual(mathResults.length, 1);
    assert.strictEqual(mathResults[0].type, "math");

    const codeResults = filterSlashCommands("code", mockCommands);
    assert.strictEqual(codeResults.length, 1);
    assert.strictEqual(codeResults[0].type, "code");
  });

  it("reorders blocks cleanly via drag-and-drop handles", () => {
    const initialBlocks = [
      { id: "b1", type: "h1", content: "First" },
      { id: "b2", type: "text", content: "Second" },
      { id: "b3", type: "code", content: "Third" },
    ];

    // Move b3 (index 2) to the top (index 0)
    const reordered = reorderBlocks(initialBlocks, 2, 0);
    assert.strictEqual(reordered[0].id, "b3");
    assert.strictEqual(reordered[1].id, "b1");
    assert.strictEqual(reordered[2].id, "b2");
  });

  it("manages multi-level undo and redo snapshots correctly", () => {
    let history = {
      past: [],
      present: [{ id: "b1", content: "Version 1" }],
      future: [],
    };

    // Edit 1: change to Version 2
    history = pushHistoryState(history, [{ id: "b1", content: "Version 2" }]);
    assert.strictEqual(history.present[0].content, "Version 2");
    assert.strictEqual(history.past.length, 1);

    // Edit 2: change to Version 3
    history = pushHistoryState(history, [{ id: "b1", content: "Version 3" }]);
    assert.strictEqual(history.present[0].content, "Version 3");
    assert.strictEqual(history.past.length, 2);

    // Undo 1 -> should revert to Version 2
    history = undoHistory(history);
    assert.strictEqual(history.present[0].content, "Version 2");
    assert.strictEqual(history.future.length, 1);

    // Undo 2 -> should revert to Version 1
    history = undoHistory(history);
    assert.strictEqual(history.present[0].content, "Version 1");
    assert.strictEqual(history.future.length, 2);

    // Redo 1 -> should advance to Version 2
    history = redoHistory(history);
    assert.strictEqual(history.present[0].content, "Version 2");
    assert.strictEqual(history.future.length, 1);
  });
});
