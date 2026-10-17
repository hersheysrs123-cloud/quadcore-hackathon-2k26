import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMarkdownInline, wrapMarker } from "../../lib/editorCaret.js";
import { buildNoteTree } from "../../lib/noteHierarchy.js";
import { looksLikeDisplayMath, normalizeReformattedPayload } from "../../lib/aiService.js";
import { generateNetscapeBookmarksHtml } from "../../lib/exportImport.js";

/**
 * The last minor items from the Gemini audit (BUG-19, BUG-25): reformat
 * turning prose into maths, bold runs ending in a space, and the note tree's
 * cycle breaker detaching notes that only hang below a cycle.
 */

describe("Reformat — display maths detection", () => {
  it("treats a block wrapped in $$ as one formula", () => {
    assert.equal(looksLikeDisplayMath("$$E = mc^2$$"), true);
  });

  it("treats a dangling $$ at either end as a formula to repair", () => {
    assert.equal(looksLikeDisplayMath("\\text{Stimulus} \\rightarrow \\text{Response}$$"), true);
    assert.equal(looksLikeDisplayMath("$$a^2 + b^2 = c^2"), true);
  });

  it("keeps bare LaTeX that opens on a command", () => {
    assert.equal(looksLikeDisplayMath("\\frac{a}{b} = c"), true);
  });

  it("leaves a paragraph that starts or ends with inline $$ as prose", () => {
    assert.equal(looksLikeDisplayMath("$$a$$ is the area and $$b$$ is the base"), false);
    assert.equal(looksLikeDisplayMath("The energy is given by $$E = mc^2$$"), false);
  });

  it("keeps such a paragraph a text block after normalising", () => {
    const out = normalizeReformattedPayload({
      blocks: [{ type: "text", content: "$$a$$ is the area and $$b$$ is the base" }],
    });
    assert.equal(out.blocks[0].type, "text");
    assert.equal(out.blocks[0].content, "$$a$$ is the area and $$b$$ is the base");
  });

  it("still turns a lone formula into a math block without delimiters", () => {
    const out = normalizeReformattedPayload({ blocks: [{ type: "text", content: "$$x = 1$$" }] });
    assert.equal(out.blocks[0].type, "math");
    assert.equal(out.blocks[0].content, "x = 1");
  });
});

describe("Editor — emphasis serialisation", () => {
  it("moves edge spaces outside the markers", () => {
    assert.equal(wrapMarker("word ", "**"), "**word** ");
    assert.equal(wrapMarker("  two words", "*"), "  *two words*");
  });

  it("does not wrap whitespace-only runs", () => {
    assert.equal(wrapMarker(" ", "**"), " ");
    assert.equal(wrapMarker("", "**"), "");
  });

  it("renders a bold run that ended in a space as bold again", () => {
    const html = formatMarkdownInline(`plain ${wrapMarker("bold ", "**")}tail`);
    assert.match(html, /<strong[^>]*>bold<\/strong> tail/);
    assert.doesNotMatch(html, /\*\*/);
  });
});

describe("Note tree — cycle breaking", () => {
  const ids = (list) => list.map((n) => n.id);

  it("breaks the cycle on the cycle, keeping a child under its parent", () => {
    // A <-> B is a corrupt loop; C is an ordinary child of A listed first.
    const notes = [
      { id: "C", parentId: "A" },
      { id: "A", parentId: "B" },
      { id: "B", parentId: "A" },
    ];
    const { roots, childrenOf } = buildNoteTree(notes);
    assert.equal(roots.length, 1);
    assert.ok(["A", "B"].includes(roots[0].id));
    assert.ok(ids(childrenOf.get("A") || []).includes("C"));
  });

  it("still shows every note exactly once", () => {
    const notes = [
      { id: "D", parentId: "C" },
      { id: "C", parentId: "A" },
      { id: "A", parentId: "B" },
      { id: "B", parentId: "A" },
      { id: "R" },
    ];
    const { roots, childrenOf } = buildNoteTree(notes);
    const seen = [...ids(roots)];
    for (const list of childrenOf.values()) seen.push(...ids(list));
    assert.deepEqual(seen.sort(), ["A", "B", "C", "D", "R"]);
  });
});

describe("Bookmark export — folder loops", () => {
  it("finishes when a folder ends up inside itself", () => {
    // Two rows sharing an id: the second hangs below the first, so the first's
    // children include itself again.
    const folders = [
      { id: "f1", name: "Top", parentId: null },
      { id: "f1", name: "Copy", parentId: "f1" },
    ];
    const bookmarks = [{ id: "b1", title: "Kept", url: "https://example.com", folderId: "f1" }];
    const { html } = generateNetscapeBookmarksHtml(bookmarks, folders, "All");
    assert.match(html, /Top/);
    assert.match(html, /https:\/\/example\.com/);
  });
});
