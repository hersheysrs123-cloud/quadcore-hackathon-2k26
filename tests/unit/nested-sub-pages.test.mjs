import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { editorBlocksToText, rankSlashItems, scoreSlashItem } from "../../lib/blocks.js";
import { blocksToMarkdownLossy, blocksToHTMLLossy, blocksToPlainText, filterBlocksForExport } from "../../lib/exportImport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

/**
 * Notion-style nested sub-pages: `page` blocks embed a child note whose
 * `parentId` points back at the host note. These checks pin the wiring across
 * the editor, workspace, sidebar, storage layer and exporters.
 */
describe("Nested sub-pages — editor (BlockNoteEditor.jsx)", () => {
  const editor = read("components/BlockNoteEditor.jsx");

  it("offers a /page slash command that embeds a new nested sub-page", () => {
    assert.match(editor, /type: "page", label: "Page"/);
    assert.match(editor, /keywords: \["page", "subpage", "sub-page"/);
    assert.match(editor, /if \(type === "page"\) \{[\s\S]*?onInsertPage\?\.\(block\.id, \{ replace, anchorContent: textBefore \}\)/);
  });

  it("has a gutter + button whose insert menu includes the Page option", () => {
    assert.match(editor, /data-testid="gutter-insert-button"/);
    assert.match(editor, /title="Insert below"/);
    assert.match(editor, /function handleInsertMenuSelect\(type, extra = \{\}\)[\s\S]*?if \(type === "page"\)/);
    assert.match(editor, /searchable\s+title="Insert below"/);
  });

  it("renders a clickable PageBlock card with live icon, title and arrow", () => {
    assert.match(editor, /function PageBlock\(\{/);
    assert.match(editor, /data-testid="page-block"/);
    assert.match(editor, /const located = useMemo\(\(\) => findNoteAcrossSpaces\(notesBySpace, pageId\)/);
    assert.match(editor, /const liveTitle = pageNote\?\.title \|\| block\.title/);
    assert.match(editor, /const liveEmoji = pageNote\?\.emoji \|\| block\.emoji/);
    assert.match(editor, /if \(pageNote\) onSelectNote\?\.\(pageNote\);/);
    assert.ok(editor.includes("→"), "card shows an arrow indicator");
    assert.match(editor, /block\.type === "page" \? \([\s\S]*?<PageBlock/);
  });

  it("caches the child's title/emoji on the block so exports stay correct", () => {
    assert.match(editor, /onUpdateBlock\(block\.id, \{ title: nextTitle, emoji: nextEmoji \}\)/);
  });

  it("creates the child, flushes the parent and navigates into the sub-page", () => {
    assert.match(editor, /const handleInsertPage = useCallback\(/);
    assert.match(editor, /const child = onCreateSubPage\(parentId, spaceIdRef\.current\);/);
    assert.match(editor, /performSave\(\{ id: parentId, blocks: next \}\);\s*\n\s*\/\/ Navigate into the freshly created sub-page\.\s*\n\s*onSelectNote\?\.\(child\);/);
    // Draft notes without an id get one minted so the child can point at it.
    assert.match(editor, /if \(!parentId\) \{\s*parentId = `n_\$\{Date\.now\(\)\}/);
  });

  it("trashes a sub-page when its card is deleted, and offers Restore for trashed pages", () => {
    assert.match(editor, /const trashRemovedSubPages = useCallback\(\(prevBlocks, nextBlocks\)/);
    assert.equal((editor.match(/trashRemovedSubPages\(prev, (safeNext|next)\);/g) || []).length, 4, "gutter delete, multi-delete, cut and forward-delete all cascade");
    assert.match(editor, /onRecoverSubPage\(pageId\)/);
    assert.match(editor, /This sub-page is in the Trash\./);
  });

  it("keeps the focus engine and standalone-embed handling aware of page cards", () => {
    assert.match(editor, /if \(\["site", "media", "page"\]\.includes\(block\.type\)\)/);
    assert.match(editor, /const standaloneEmbedTypes = \["divider", "site", "media", "page"\];/);
    assert.match(editor, /canTurnInto=\{block\.type !== "page"\}/);
    assert.match(editor, /canDuplicate=\{block\.type !== "page"\}/);
  });

  it("registers an imperative card inserter for the workspace (sidebar / restore flows)", () => {
    assert.match(editor, /onRegisterInsertPageBlock\(insert\);/);
    assert.match(editor, /if \(hasPageBlockFor\(prev, cardBlock\.pageId\)\) return false;/);
  });
});

describe("Nested sub-pages — workspace (Workspace.jsx)", () => {
  const ws = read("components/Workspace.jsx");

  it("hydrates parentId from IndexedDB and repairs cross-space drift", () => {
    assert.equal((ws.match(/parentId: normalizeParentId\(n\.parentId\)/g) || []).length, 2);
    assert.match(ws, /A sub-page must live in the same space as its parent/);
  });

  it("creates sub-pages as children of the current note in the same space", () => {
    assert.match(ws, /const handleCreateSubPage = useCallback\(/);
    assert.match(ws, /parentId,\s*\n\s*banner: null,\s*\n\s*emoji: "📄"/);
    assert.match(ws, /const siblings = getChildNotes\(notesBySpace\[targetSpace\] \|\| \[\], parentId\);/);
    assert.match(ws, /onCreateSubPage=\{\(parentId, spaceId\) =>/);
  });

  it("cascades delete, restore and permanent-delete through the subtree", () => {
    assert.match(ws, /const subtreeIds = \[noteId, \.\.\.collectDescendantIds\(allNotes, noteId\)\];/);
    assert.match(ws, /const subtreeIds = \[noteId, \.\.\.collectDescendantIds\(trashNotes, noteId\)\];/);
    assert.match(ws, /const subtreeSet = new Set\(\[noteId, \.\.\.collectDescendantIds\(trashNotes, noteId\)\]\);/);
    assert.match(ws, /expandSelectionWithDescendants\(allNotes, noteIds\)/);
    // Deleting the open note jumps up to the surviving parent.
    assert.match(ws, /const survivingParentId = normalizeParentId\(targetNote\.parentId\);/);
  });

  it("moves whole subtrees between spaces and deep-clones them on duplicate", () => {
    assert.match(ws, /await moveNoteTreeToSpace\(noteToMove\.id, targetSpaceName, \{ rootOrder: targetRoots\.length \}\);/);
    assert.match(ws, /const cloned = cloneNoteTree\(sourceNotes, noteToDuplicate\.id/);
    assert.match(ws, /getTopmostSelected\(spaceNotes, noteIds\)/);
  });

  it("renders a clickable hierarchy breadcrumb with an overflow menu", () => {
    assert.match(ws, /const breadcrumbPath = useMemo\(/);
    assert.match(ws, /buildBreadcrumbPath\(notesBySpace\[activeSpace\] \|\| \[\], activeNoteObj\.id\)/);
    assert.match(ws, /data-testid="note-breadcrumb"/);
    assert.match(ws, /onClick=\{\(\) => handleSelectNote\(n\)\}/);
    assert.match(ws, /key="breadcrumb-overflow"/);
  });

  it("re-inserts a card into the parent when a sub-page is restored", () => {
    assert.match(ws, /const ensurePageBlockInParent = useCallback\(/);
    assert.match(ws, /ensurePageBlockInParent\(rootParentId, target\.id/);
    assert.match(ws, /insertPageBlockRef\.current\(cardBlock\)/);
  });

  it("re-orders one sibling group at a time", () => {
    assert.match(ws, /const orderById = new Map\(indexedNotes\.map\(\(n\) => \[n\.id, n\]\)\);/);
  });
});

describe("Nested sub-pages — sidebar (Sidebar.jsx)", () => {
  const sb = read("components/Sidebar.jsx");

  it("renders a recursive tree with ▶/▼ toggles and smooth expand/collapse", () => {
    assert.match(sb, /const noteTree = useMemo\(\(\) => buildNoteTree\(currentNotes\), \[currentNotes\]\);/);
    assert.match(sb, /function renderNoteNode\(n, depth\)/);
    assert.match(sb, /data-testid="note-tree-toggle"/);
    assert.match(sb, /isExpanded \? "rotate-90" : "rotate-0"/);
    assert.match(sb, /isExpanded \? "grid-rows-\[1fr\]" : "grid-rows-\[0fr\]"/);
    assert.match(sb, /renderNoteNode\(child, depth \+ 1\)/);
  });

  it("auto-expands every ancestor of the open note", () => {
    assert.match(sb, /const ancestors = getAncestorIds\(currentNotesRef\.current, activeNoteId\);/);
  });

  it("restricts drag re-ordering to siblings and persists expansion state", () => {
    assert.match(sb, /if \(!siblings\.some\(\(sib\) => sib\.id === sourceId\)\)/);
    assert.match(sb, /SIDEBAR_EXPANDED_KEY = "socratic_sidebar_expanded_notes"/);
  });

  it("exposes New sub-page in the note menu and labels trashed sub-pages", () => {
    assert.match(sb, /onCreateSubPage=\{onCreateSubPage\}/);
    assert.match(read("components/NoteMenu.jsx"), /data-testid="note-menu-new-subpage"/);
    assert.match(sb, /↳ in \{trashedParent\.title/);
  });
});

describe("Nested sub-pages — storage (db.js / storageService.js)", () => {
  const db = read("lib/db.js");
  const storage = read("lib/storageService.js");

  it("bumps the Dexie schema to v8 with a parentId index and a null-defaulting migration", () => {
    assert.match(db, /db\.version\(8\)\.stores\(\{/);
    assert.match(db, /notes: "id, spaceId, parentId, title, isFavorite, emoji, updatedAt"/);
    assert.match(db, /trash: "id, parentId, deletedAt"/);
    assert.match(db, /if \(note\.parentId === undefined\) note\.parentId = null;/);
  });

  it("persists parentId on save without ever allowing self-parenting", () => {
    assert.match(storage, /noteData\.parentId !== undefined\s*\?\s*normalizeParentId\(noteData\.parentId\)\s*:\s*normalizeParentId\(existingNote\?\.parentId\)/);
    assert.match(storage, /if \(parentId === id\) parentId = null;/);
  });

  it("cascades trash / recover / permanent delete / move through the subtree", () => {
    assert.match(storage, /export async function deleteNoteToTrash\(id\)[\s\S]*?collectDescendantIds\(allNotes, id\)[\s\S]*?db\.trash\.bulkPut\(subtree\.map\(\(n\) => \(\{ \.\.\.n, deletedAt \}\)\)\)/);
    assert.match(storage, /export async function recoverNote\(id\)[\s\S]*?collectDescendantIds\(allTrash, id\)[\s\S]*?parentId: resolveRestoredParentId\(restoredNote, liveIds\)/);
    assert.match(storage, /export async function permanentlyDeleteNote\(id\)[\s\S]*?collectDescendantIds\(\[\.\.\.allTrash, \.\.\.allNotes\], id\)/);
    assert.match(storage, /export async function moveNoteTreeToSpace\(rootId, targetSpace, \{ rootOrder \} = \{\}\)/);
  });
});

describe("Nested sub-pages — exporters & AI context", () => {
  const pageBlock = { id: "p1", type: "page", pageId: "child_1", content: "", title: "Chapter 2", emoji: "🧪" };
  const blocks = [{ id: "h", type: "h1", content: "Course" }, pageBlock, { id: "t", type: "text", content: "Body" }];

  it("editorBlocksToText mentions the sub-page so AI features see it", () => {
    const text = editorBlocksToText(blocks);
    assert.ok(text.includes("[sub-page] 🧪 Chapter 2"), text);
  });

  it("Markdown / HTML / plain-text exports render the card", () => {
    assert.ok(blocksToMarkdownLossy(blocks).includes("🧪 **Chapter 2** _(sub-page)_"));
    const html = blocksToHTMLLossy(blocks, "Course");
    assert.ok(html.includes("page-card"));
    assert.ok(html.includes("Chapter 2"));
    assert.ok(blocksToPlainText(blocks).includes("[SUB-PAGE] 🧪 Chapter 2"));
  });

  it("filterBlocksForExport passes page blocks through and defaults an untitled card", () => {
    const out = filterBlocksForExport([{ id: "x", type: "page", pageId: "c" }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].type, "page");
    assert.ok(blocksToMarkdownLossy(out).includes("Untitled Note"));
  });
});

describe("Slash menu ranking (lib/blocks.js rankSlashItems)", () => {
  const items = [
    { type: "text", label: "Text", keywords: ["text", "paragraph", "p"] },
    { type: "page", label: "Page", keywords: ["page", "subpage", "sub-page", "nested"] },
    { type: "h1", label: "Heading 1", keywords: ["h1", "heading1", "title"] },
    { type: "h2", label: "Heading 2", keywords: ["h2", "heading2"] },
    { type: "columns", columnCount: 2, label: "2 Columns", keywords: ["2", "2 columns", "column", "col"] },
    { type: "todo", label: "To-Do List", keywords: ["todo", "task", "checkbox"] },
  ];

  it("puts exact label/type matches first: '/page' → Page, not Text", () => {
    assert.equal(rankSlashItems(items, "page")[0].type, "page");
    assert.equal(rankSlashItems(items, "pa")[0].type, "page");
    assert.equal(rankSlashItems(items, "h1")[0].type, "h1");
    assert.equal(rankSlashItems(items, "todo")[0].type, "todo");
  });

  it("keeps loose substring matches but after stronger ones; empty query returns everything", () => {
    const ranked = rankSlashItems(items, "p");
    assert.equal(ranked[0].type, "page"); // label prefix
    assert.ok(ranked.some((i) => i.type === "text")); // keyword "p" exact
    assert.deepEqual(rankSlashItems(items, "").map((i) => i.type), items.map((i) => i.type));
    assert.deepEqual(rankSlashItems(items, "zzz"), []);
    assert.equal(scoreSlashItem(items[1], "sub"), 3);
    assert.equal(scoreSlashItem(items[0], "zzz"), -1);
  });
});
