# Developer gotchas — nested sub-pages

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). Gotcha 24: the `parentId` + `page` block invariants.

24. **Nested Sub-Pages (`parentId` + `page` blocks)**:
    - `saveNote` treats `parentId: undefined` as "keep the stored value" and `parentId: null` as "make top-level". Partial saves from the editor never carry it; pass `null` explicitly only when you really mean to detach a page. A note is never allowed to be its own parent.
    - Every note object kept in `Workspace.notesBySpace` must include `parentId` (hydration, `handleImportSuccess`, `handleSaveNote`, `handleCreateSubPage` all set it) — `saveNotesOrder` bulk-puts these objects verbatim, so a missing field would silently detach pages.
    - Never act on a single id when the operation is trash / restore / permanent delete / move / duplicate: use `collectDescendantIds` / `expandSelectionWithDescendants` / `getTopmostSelected` from `lib/noteHierarchy.js` (all cycle-safe; orphans are treated as roots). The storage functions already cascade, so bulk handlers call them once per topmost note.
    - Sub-pages must live in the parent's space. `handleMoveNoteToSpace` / `handleMoveMultipleNotes` / `moveNoteTreeToSpace` move the whole subtree; hydration repairs strays. `getChildNotes(list, null)` (not `list[0]`) is the correct "first note in a space" for default selection.
    - `page` blocks may be referenced in only one place: `canDuplicate`/`canTurnInto` are off for them and removing a card trashes its page. New code that deletes blocks must route through `trashRemovedSubPages(prev, next)` (editor) so the invariant holds; code that restores a page must call `ensurePageBlockInParent` (workspace) so the card comes back.
    - Sidebar drag-reorder passes only one sibling group to `onReorderNotes`; `handleReorderNotes` merges those `order` values into the space list and re-sorts (`sortNotes`) instead of replacing the whole list.
    - The `inert` attribute keeps collapsed tree rows out of the tab order and out of `getBoundingClientRect`-based visibility checks; the `grid-rows-[0fr]` wrapper must keep `overflow-hidden` on the inner `<ul>` or the expand animation is skipped.

---
