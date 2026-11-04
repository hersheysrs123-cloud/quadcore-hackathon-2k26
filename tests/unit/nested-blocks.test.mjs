import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blockLevel,
  getSubtreeEnd,
  getHiddenBlockIds,
  withDescendantIds,
  shiftBlockLevels,
  migrateToggleDetails,
  matchSlashItems,
} from "../../lib/blocks.js";
import {
  foldToggleChildren,
  blocksToMarkdownLossy,
  tryParseMarkdownToBlocks,
  numberedIndentLevel,
} from "../../lib/exportImport.js";

const blocks = [
  { id: "a", type: "toggle", content: "A", open: false },
  { id: "a1", type: "text", content: "a1", level: 1 },
  { id: "a2", type: "bullet", content: "a2", level: 2 },
  { id: "b", type: "text", content: "b" },
  { id: "c", type: "toggle", content: "C" },
  { id: "c1", type: "text", content: "c1", level: 1 },
];

describe("nested blocks", () => {
  it("clamps levels to 0-4", () => {
    assert.equal(blockLevel({ level: 9 }), 4);
    assert.equal(blockLevel({}), 0);
  });

  it("finds the end of a block's children", () => {
    assert.equal(getSubtreeEnd(blocks, 0), 3);
    assert.equal(getSubtreeEnd(blocks, 3), 4);
    assert.equal(getSubtreeEnd(blocks, 4), 6);
  });

  it("hides only the contents of collapsed toggles", () => {
    assert.deepEqual([...getHiddenBlockIds(blocks)].sort(), ["a1", "a2"]);
  });

  it("adds descendants to a selection", () => {
    assert.deepEqual([...withDescendantIds(blocks, new Set(["a"]))].sort(), ["a", "a1", "a2"]);
  });

  it("shifts levels within bounds", () => {
    const shifted = shiftBlockLevels([{ id: "x", level: 4 }, { id: "y" }], 1);
    assert.deepEqual(shifted.map((b) => b.level ?? 0), [4, 1]);
  });

  it("turns legacy toggle details into nested blocks", () => {
    let n = 0;
    const out = migrateToggleDetails(
      [{ id: "t", type: "toggle", content: "T", level: 1, details: "line\n- item" }],
      () => `id${n++}`
    );
    assert.equal(out[0].details, undefined);
    assert.deepEqual(
      out.map((b) => [b.type, b.content, b.level ?? 0]),
      [["toggle", "T", 1], ["text", "line", 2], ["bullet", "item", 2]]
    );
  });

  it("returns the same array when nothing needs migrating", () => {
    const list = [{ id: "t", type: "toggle", content: "T" }];
    assert.equal(migrateToggleDetails(list), list);
  });
});

describe("slash menu matching", () => {
  const items = [
    { type: "text", label: "Text", keywords: ["text", "p"] },
    { type: "columns", label: "2 Columns", keywords: ["2", "columns"] },
    { type: "todo", label: "To-Do List", keywords: ["todo", "to do"] },
  ];

  it("accepts multi-word queries that start a label or keyword", () => {
    assert.equal(matchSlashItems(items, "2 columns")[0].type, "columns");
    assert.equal(matchSlashItems(items, "to do")[0].type, "todo");
  });

  it("does not match a sentence through a loose keyword", () => {
    assert.equal(matchSlashItems(items, "p and q").length, 0);
  });
});

describe("exporting nested blocks", () => {
  it("folds a toggle's nested blocks into its details", () => {
    const folded = foldToggleChildren(blocks);
    assert.deepEqual(folded.map((b) => b.id), ["a", "b", "c"]);
    assert.match(folded[0].details, /a1/);
    assert.match(folded[0].details, /- a2/);
  });

  it("writes and reads back nested numbered lists", () => {
    const md = blocksToMarkdownLossy(
      [
        { type: "number", content: "one" },
        { type: "number", content: "sub", level: 1 },
        { type: "number", content: "two" },
      ],
      ""
    );
    assert.match(md, /^1\. one/m);
    assert.match(md, /^ {3}1\. sub/m);
    assert.match(md, /^2\. two/m);
    const parsed = tryParseMarkdownToBlocks(md);
    assert.deepEqual(parsed.map((b) => b.level ?? 0), [0, 1, 0]);
  });

  it("reads 3-space and 2-space numbered indents", () => {
    assert.equal(numberedIndentLevel(3), 1);
    assert.equal(numberedIndentLevel(6), 2);
    assert.equal(numberedIndentLevel(2), 1);
    assert.equal(numberedIndentLevel(4), 2);
  });
});
