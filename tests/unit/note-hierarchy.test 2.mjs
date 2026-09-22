import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeParentId,
  sortNotes,
  flattenNotesBySpace,
  findNoteAcrossSpaces,
  getChildNotes,
  hasChildNotes,
  buildNoteTree,
  collectDescendantIds,
  collectSubtree,
  getAncestorChain,
  buildBreadcrumbPath,
  getAncestorIds,
  isSameOrDescendant,
  wouldCreateCycle,
  getNoteDepth,
  getTopmostSelected,
  expandSelectionWithDescendants,
  hasPageBlockFor,
  getPageBlockIds,
  diffRemovedPageIds,
  cloneNoteTree,
  resolveRestoredParentId,
  formatBreadcrumbText,
  MAX_NESTING_DEPTH,
} from "../../lib/noteHierarchy.js";

/**
 * Space
 * ├─ physics (root, order 0)
 * │   ├─ mechanics (order 0)
 * │   │   └─ forces (order 0)
 * │   │       └─ friction
 * │   └─ waves (order 1)
 * ├─ chemistry (root, order 1)
 * └─ orphan (parentId → missing note; must render as a root)
 */
function fixture() {
  return [
    { id: "physics", title: "Physics", parentId: null, order: 0, createdAt: "2026-01-01", emoji: "⚛️",
      blocks: [
        { id: "b1", type: "h1", content: "Physics" },
        { id: "b2", type: "page", pageId: "mechanics", content: "" },
        { id: "b3", type: "page", pageId: "waves", content: "" },
      ] },
    { id: "mechanics", title: "Mechanics", parentId: "physics", order: 0, createdAt: "2026-01-02",
      blocks: [{ id: "b4", type: "page", pageId: "forces", content: "" }] },
    { id: "forces", title: "Forces", parentId: "mechanics", order: 0, createdAt: "2026-01-03",
      blocks: [{ id: "b5", type: "page", pageId: "friction", content: "" }, { id: "b6", type: "text", content: "F = ma" }] },
    { id: "friction", title: "Friction", parentId: "forces", order: 0, createdAt: "2026-01-04", blocks: [] },
    { id: "waves", title: "Waves", parentId: "physics", order: 1, createdAt: "2026-01-05", blocks: [] },
    { id: "chemistry", title: "Chemistry", parentId: null, order: 1, createdAt: "2026-01-06", blocks: [] },
    { id: "orphan", title: "Orphan", parentId: "does-not-exist", order: 2, createdAt: "2026-01-07", blocks: [] },
  ];
}

describe("noteHierarchy — basics", () => {
  it("normalizeParentId treats undefined / null / blank as top-level", () => {
    assert.equal(normalizeParentId(undefined), null);
    assert.equal(normalizeParentId(null), null);
    assert.equal(normalizeParentId(""), null);
    assert.equal(normalizeParentId("   "), null);
    assert.equal(normalizeParentId(" abc "), "abc");
    assert.equal(normalizeParentId(42), "42");
  });

  it("sortNotes orders by order → createdAt → id and drops falsy entries", () => {
    const sorted = sortNotes([
      { id: "b", order: 1, createdAt: "2026-01-02" },
      null,
      { id: "a", order: 0, createdAt: "2026-01-03" },
      { id: "c", order: 1, createdAt: "2026-01-01" },
      { id: "d", order: 1, createdAt: "2026-01-01" },
    ]);
    assert.deepEqual(sorted.map((n) => n.id), ["a", "c", "d", "b"]);
  });

  it("flattenNotesBySpace tags every note with its space", () => {
    const flat = flattenNotesBySpace({ School: [{ id: "1" }], Personal: [{ id: "2", space: "Personal" }, null] });
    assert.deepEqual(flat.map((n) => [n.id, n.space, n.spaceId]), [["1", "School", "School"], ["2", "Personal", "Personal"]]);
  });

  it("findNoteAcrossSpaces returns { note, space } or null", () => {
    const bySpace = { School: fixture(), Misc: [{ id: "misc1" }] };
    assert.equal(findNoteAcrossSpaces(bySpace, "misc1").space, "Misc");
    assert.equal(findNoteAcrossSpaces(bySpace, "forces").space, "School");
    assert.equal(findNoteAcrossSpaces(bySpace, "nope"), null);
    assert.equal(findNoteAcrossSpaces(bySpace, null), null);
    assert.equal(findNoteAcrossSpaces(undefined, "x"), null);
  });
});

describe("noteHierarchy — children & tree", () => {
  it("getChildNotes(null) returns sorted roots and promotes orphans", () => {
    const roots = getChildNotes(fixture(), null).map((n) => n.id);
    assert.deepEqual(roots, ["physics", "chemistry", "orphan"]);
  });

  it("getChildNotes(parent) returns direct children only, sorted", () => {
    assert.deepEqual(getChildNotes(fixture(), "physics").map((n) => n.id), ["mechanics", "waves"]);
    assert.deepEqual(getChildNotes(fixture(), "friction"), []);
    assert.equal(hasChildNotes(fixture(), "physics"), true);
    assert.equal(hasChildNotes(fixture(), "waves"), false);
  });

  it("buildNoteTree produces roots + childrenOf map", () => {
    const tree = buildNoteTree(fixture());
    assert.deepEqual(tree.roots.map((n) => n.id), ["physics", "chemistry", "orphan"]);
    assert.deepEqual(tree.childrenOf.get("physics").map((n) => n.id), ["mechanics", "waves"]);
    assert.deepEqual(tree.childrenOf.get("mechanics").map((n) => n.id), ["forces"]);
    assert.equal(tree.childrenOf.has("chemistry"), false);
    assert.equal(tree.byId.size, 7);
  });

  it("buildNoteTree never loses notes stuck in a parentId cycle", () => {
    const cyclic = [
      { id: "a", parentId: "b", order: 0 },
      { id: "b", parentId: "a", order: 0 },
      { id: "root", parentId: null, order: 0 },
    ];
    const tree = buildNoteTree(cyclic);
    const visible = new Set();
    const walk = (n) => {
      visible.add(n.id);
      (tree.childrenOf.get(n.id) || []).forEach(walk);
    };
    tree.roots.forEach(walk);
    assert.deepEqual([...visible].sort(), ["a", "b", "root"]);
  });

  it("buildNoteTree ignores self-parented notes gracefully", () => {
    const tree = buildNoteTree([{ id: "x", parentId: "x", order: 0 }]);
    assert.deepEqual(tree.roots.map((n) => n.id), ["x"]);
  });

  it("handles empty / malformed input", () => {
    assert.deepEqual(buildNoteTree([]).roots, []);
    assert.deepEqual(buildNoteTree(undefined).roots, []);
    assert.deepEqual(buildNoteTree([null, {}, { id: "" }]).roots, []);
    assert.deepEqual(collectDescendantIds([], "x"), []);
    assert.deepEqual(collectDescendantIds(fixture(), null), []);
  });
});

describe("noteHierarchy — descendants & ancestors", () => {
  it("collectDescendantIds walks the whole subtree in pre-order", () => {
    assert.deepEqual(collectDescendantIds(fixture(), "physics"), ["mechanics", "forces", "friction", "waves"]);
    assert.deepEqual(collectDescendantIds(fixture(), "mechanics"), ["forces", "friction"]);
    assert.deepEqual(collectDescendantIds(fixture(), "friction"), []);
    assert.deepEqual(collectDescendantIds(fixture(), "unknown"), []);
  });

  it("collectDescendantIds is cycle-safe", () => {
    const cyclic = [
      { id: "a", parentId: "c" },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    assert.deepEqual(collectDescendantIds(cyclic, "a"), ["b", "c"]);
  });

  it("collectSubtree returns the root first, then descendants", () => {
    assert.deepEqual(collectSubtree(fixture(), "mechanics").map((n) => n.id), ["mechanics", "forces", "friction"]);
    assert.deepEqual(collectSubtree(fixture(), "missing"), []);
  });

  it("getAncestorChain lists root → parent", () => {
    assert.deepEqual(getAncestorChain(fixture(), "friction").map((n) => n.id), ["physics", "mechanics", "forces"]);
    assert.deepEqual(getAncestorChain(fixture(), "physics"), []);
    assert.deepEqual(getAncestorChain(fixture(), "orphan"), []);
    assert.deepEqual(getAncestorChain(fixture(), "nope"), []);
  });

  it("getAncestorChain stops on cycles and respects MAX_NESTING_DEPTH", () => {
    const cyclic = [{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }];
    assert.deepEqual(getAncestorChain(cyclic, "a").map((n) => n.id), ["b"]);

    const deep = [];
    for (let i = 0; i < MAX_NESTING_DEPTH + 10; i++) {
      deep.push({ id: `n${i}`, parentId: i === 0 ? null : `n${i - 1}` });
    }
    const chain = getAncestorChain(deep, `n${MAX_NESTING_DEPTH + 9}`);
    assert.equal(chain.length, MAX_NESTING_DEPTH);
  });

  it("buildBreadcrumbPath includes the note itself and formats to text", () => {
    const path = buildBreadcrumbPath(fixture(), "forces");
    assert.deepEqual(path.map((n) => n.id), ["physics", "mechanics", "forces"]);
    assert.equal(formatBreadcrumbText(path), "Physics › Mechanics › Forces");
    assert.equal(formatBreadcrumbText([{ title: "" }, { title: "B" }], " > "), "Untitled Note > B");
    assert.deepEqual(buildBreadcrumbPath(fixture(), "missing"), []);
  });

  it("getAncestorIds is what the sidebar must expand to reveal a note", () => {
    assert.deepEqual([...getAncestorIds(fixture(), "friction")], ["physics", "mechanics", "forces"]);
    assert.equal(getAncestorIds(fixture(), "chemistry").size, 0);
  });

  it("depth / descendant / cycle predicates", () => {
    assert.equal(getNoteDepth(fixture(), "friction"), 3);
    assert.equal(getNoteDepth(fixture(), "physics"), 0);
    assert.equal(isSameOrDescendant(fixture(), "friction", "physics"), true);
    assert.equal(isSameOrDescendant(fixture(), "physics", "physics"), true);
    assert.equal(isSameOrDescendant(fixture(), "physics", "friction"), false);
    assert.equal(isSameOrDescendant(fixture(), "chemistry", "physics"), false);
    assert.equal(isSameOrDescendant(fixture(), null, "physics"), false);
    // Re-parenting physics under its own grandchild would loop.
    assert.equal(wouldCreateCycle(fixture(), "physics", "forces"), true);
    assert.equal(wouldCreateCycle(fixture(), "physics", "physics"), true);
    assert.equal(wouldCreateCycle(fixture(), "waves", "chemistry"), false);
    assert.equal(wouldCreateCycle(fixture(), "waves", null), false);
  });
});

describe("noteHierarchy — selections for bulk operations", () => {
  it("getTopmostSelected drops notes whose ancestor is also selected", () => {
    const top = getTopmostSelected(fixture(), ["friction", "mechanics", "chemistry", "forces", "ghost"]);
    assert.deepEqual(top.sort(), ["chemistry", "mechanics"]);
  });

  it("expandSelectionWithDescendants adds every descendant once, preserving order", () => {
    const expanded = expandSelectionWithDescendants(fixture(), ["mechanics", "forces", "chemistry", "mechanics"]);
    assert.deepEqual(expanded, ["mechanics", "forces", "friction", "chemistry"]);
    assert.deepEqual(expandSelectionWithDescendants(fixture(), []), []);
    assert.deepEqual(expandSelectionWithDescendants(fixture(), [null, undefined]), []);
  });
});

describe("noteHierarchy — page blocks", () => {
  it("hasPageBlockFor / getPageBlockIds / diffRemovedPageIds", () => {
    const blocks = fixture()[0].blocks;
    assert.equal(hasPageBlockFor(blocks, "mechanics"), true);
    assert.equal(hasPageBlockFor(blocks, "forces"), false);
    assert.equal(hasPageBlockFor(blocks, null), false);
    assert.deepEqual(getPageBlockIds(blocks), ["mechanics", "waves"]);
    assert.deepEqual(getPageBlockIds([...blocks, { type: "page", pageId: "mechanics" }]), ["mechanics", "waves"]);
    assert.deepEqual(diffRemovedPageIds(blocks, blocks.filter((b) => b.pageId !== "waves")), ["waves"]);
    assert.deepEqual(diffRemovedPageIds(blocks, blocks), []);
    assert.deepEqual(diffRemovedPageIds(blocks, []), ["mechanics", "waves"]);
    assert.deepEqual(diffRemovedPageIds(undefined, undefined), []);
  });
});

describe("noteHierarchy — cloneNoteTree", () => {
  it("deep-clones a subtree with fresh ids and re-pointed parentIds / page cards", () => {
    let seq = 0;
    const cloned = cloneNoteTree(fixture(), "mechanics", {
      makeNoteId: () => `new_${++seq}`,
      makeBlockId: () => `blk_${++seq}`,
      now: "2026-09-16T00:00:00.000Z",
    });

    assert.equal(cloned.length, 3);
    const [root, forces, friction] = cloned;
    assert.equal(root.title, "Copy of Mechanics");
    assert.equal(forces.title, "Forces");
    assert.equal(friction.title, "Friction");

    // Fresh ids everywhere.
    const originalIds = new Set(fixture().map((n) => n.id));
    cloned.forEach((n) => assert.equal(originalIds.has(n.id), false));

    // Parent links point at clones, root keeps its original parent by default.
    assert.equal(root.parentId, "physics");
    assert.equal(forces.parentId, root.id);
    assert.equal(friction.parentId, forces.id);

    // Page cards inside the clones point at the cloned children, never the originals.
    assert.equal(root.blocks[0].type, "page");
    assert.equal(root.blocks[0].pageId, forces.id);
    assert.equal(forces.blocks[0].pageId, friction.id);
    assert.equal(forces.blocks[1].content, "F = ma");
    assert.equal(root.createdAt, "2026-09-16T00:00:00.000Z");

    // Block ids are fresh too.
    const originalBlockIds = new Set(fixture().flatMap((n) => n.blocks.map((b) => b.id)));
    cloned.flatMap((n) => n.blocks).forEach((b) => assert.equal(originalBlockIds.has(b.id), false));
  });

  it("applies overrides to the root only and gives empty notes a starter block", () => {
    const cloned = cloneNoteTree(fixture(), "waves", { overrides: { parentId: null, space: "Misc", order: 7 }, titlePrefix: "" });
    assert.equal(cloned.length, 1);
    assert.equal(cloned[0].title, "Waves");
    assert.equal(cloned[0].parentId, null);
    assert.equal(cloned[0].space, "Misc");
    assert.equal(cloned[0].order, 7);
    assert.equal(cloned[0].blocks.length, 1);
    assert.equal(cloned[0].blocks[0].type, "text");
  });

  it("does not mutate the source notes", () => {
    const src = fixture();
    const snapshot = JSON.stringify(src);
    cloneNoteTree(src, "physics");
    assert.equal(JSON.stringify(src), snapshot);
    assert.deepEqual(cloneNoteTree(src, "missing"), []);
  });
});

describe("noteHierarchy — restore semantics", () => {
  it("resolveRestoredParentId keeps live parents and promotes the rest to top-level", () => {
    const live = new Set(["physics"]);
    assert.equal(resolveRestoredParentId({ id: "mechanics", parentId: "physics" }, live), "physics");
    assert.equal(resolveRestoredParentId({ id: "forces", parentId: "mechanics" }, live), null);
    assert.equal(resolveRestoredParentId({ id: "x", parentId: "x" }, new Set(["x"])), null);
    assert.equal(resolveRestoredParentId({ id: "x", parentId: null }, live), null);
    assert.equal(resolveRestoredParentId(null, live), null);
  });

  it("trash cascade + restore cascade simulated with the helpers", () => {
    const notes = fixture();
    // Delete "mechanics": it and its descendants move to trash together.
    const trashedIds = ["mechanics", ...collectDescendantIds(notes, "mechanics")];
    const trash = notes.filter((n) => trashedIds.includes(n.id)).map((n) => ({ ...n, deletedAt: "t" }));
    const remaining = notes.filter((n) => !trashedIds.includes(n.id));
    assert.deepEqual(trashedIds, ["mechanics", "forces", "friction"]);
    assert.deepEqual(getChildNotes(remaining, "physics").map((n) => n.id), ["waves"]);

    // Restore just "forces" while its parent "mechanics" is still in the trash → promoted to root.
    const restoreIds = ["forces", ...collectDescendantIds(trash, "forces")];
    const liveIds = new Set([...remaining.map((n) => n.id), ...restoreIds]);
    const restored = trash
      .filter((t) => restoreIds.includes(t.id))
      .map(({ deletedAt, ...n }) => ({ ...n, parentId: resolveRestoredParentId(n, liveIds) }));
    assert.equal(restored.find((n) => n.id === "forces").parentId, null);
    assert.equal(restored.find((n) => n.id === "friction").parentId, "forces");

    // Restore the parent afterwards: its link to "physics" survives.
    const after = [...remaining, ...restored];
    const liveIds2 = new Set([...after.map((n) => n.id), "mechanics"]);
    assert.equal(resolveRestoredParentId(trash.find((t) => t.id === "mechanics"), liveIds2), "physics");
  });
});
