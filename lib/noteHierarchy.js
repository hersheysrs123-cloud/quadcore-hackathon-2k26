/**
 * ─── Note Hierarchy Helpers (Notion-style nested sub-pages) ─────────────────
 *
 * Every note may carry a `parentId` (null / undefined for top-level notes).
 * A parent note embeds each child exactly once as a `page` block
 * (`{ type: "page", pageId: childId }`).
 *
 * Everything in this file is pure and synchronous so it can be shared by the
 * Dexie storage layer (cascade delete / restore / move), `Workspace.jsx`
 * (in-memory state), the Sidebar tree view and the editor, and unit-tested in
 * plain Node without a DOM or IndexedDB.
 *
 * All traversals are cycle-safe: a corrupted `parentId` loop (A → B → A) can
 * never hang the UI. Orphans (a `parentId` pointing at a note that does not
 * exist in the supplied list) are treated as top-level notes.
 */

/** Hard cap on nesting depth walked by ancestor lookups (defensive). */
export const MAX_NESTING_DEPTH = 64;

export function normalizeParentId(parentId) {
  if (parentId === undefined || parentId === null) return null;
  const str = String(parentId).trim();
  return str.length > 0 ? str : null;
}

function noteSortComparator(a, b) {
  return (
    (a.order ?? 0) - (b.order ?? 0) ||
    (a.createdAt || "").localeCompare(b.createdAt || "") ||
    (a.id || "").localeCompare(b.id || "")
  );
}

/** Sorts notes the same way the sidebar and storage layer do (order → createdAt → id). */
export function sortNotes(notes = []) {
  return [...(notes || [])].filter(Boolean).sort(noteSortComparator);
}

/** Map of id → note for fast lookups. Later duplicates win. */
export function indexNotesById(notes = []) {
  const map = new Map();
  for (const n of notes || []) {
    if (n && n.id) map.set(n.id, n);
  }
  return map;
}

/** Flattens the `{ [space]: Note[] }` structure into one array (each note tagged with its space). */
export function flattenNotesBySpace(notesBySpace = {}) {
  const out = [];
  for (const [space, list] of Object.entries(notesBySpace || {})) {
    for (const n of list || []) {
      if (!n) continue;
      out.push({ ...n, space: n.space || space, spaceId: n.spaceId || space });
    }
  }
  return out;
}

/** Finds a note by id anywhere in `notesBySpace`. Returns `{ note, space }` or null. */
export function findNoteAcrossSpaces(notesBySpace = {}, noteId) {
  if (!noteId) return null;
  for (const [space, list] of Object.entries(notesBySpace || {})) {
    const match = (list || []).find((n) => n && n.id === noteId);
    if (match) return { note: match, space };
  }
  return null;
}

/**
 * Resolves the effective parent of a note: its `parentId` when that parent
 * exists in `byId`, otherwise null (orphans are promoted to top-level).
 */
export function resolveParentId(note, byId) {
  const pid = normalizeParentId(note?.parentId);
  if (!pid) return null;
  if (pid === note.id) return null; // self-parented corruption guard
  return byId.has(pid) ? pid : null;
}

/** Direct children of `parentId` (null → top-level notes), sorted. */
export function getChildNotes(notes = [], parentId = null) {
  const byId = indexNotesById(notes);
  const target = normalizeParentId(parentId);
  return sortNotes((notes || []).filter((n) => n && resolveParentId(n, byId) === target));
}

export function hasChildNotes(notes = [], parentId) {
  return getChildNotes(notes, parentId).length > 0;
}

/**
 * Builds a render-ready tree: `roots` (sorted top-level notes) and
 * `childrenOf` (Map<parentId, Note[]> sorted). Orphans are roots.
 */
export function buildNoteTree(notes = []) {
  const byId = indexNotesById(notes);
  const childrenOf = new Map();
  const roots = [];

  for (const n of notes || []) {
    if (!n || !n.id) continue;
    const pid = resolveParentId(n, byId);
    if (pid === null) {
      roots.push(n);
    } else {
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid).push(n);
    }
  }

  // Detect cycles: a note whose parent chain never reaches a root would be
  // invisible. Promote one member of each cycle to a root so nothing is lost.
  const reachable = new Set();
  const stack = [...roots];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (reachable.has(cur.id)) continue;
    reachable.add(cur.id);
    for (const c of childrenOf.get(cur.id) || []) stack.push(c);
  }
  for (const n of notes || []) {
    if (!n || !n.id || reachable.has(n.id)) continue;
    // Break the cycle at this node: treat it as a root and drop it from its parent's children.
    const pid = resolveParentId(n, byId);
    if (pid !== null && childrenOf.has(pid)) {
      childrenOf.set(pid, childrenOf.get(pid).filter((c) => c.id !== n.id));
    }
    roots.push(n);
    const s = [n];
    while (s.length > 0) {
      const cur = s.pop();
      if (reachable.has(cur.id)) continue;
      reachable.add(cur.id);
      for (const c of childrenOf.get(cur.id) || []) s.push(c);
    }
  }

  roots.sort(noteSortComparator);
  for (const [k, arr] of childrenOf) childrenOf.set(k, sortNotes(arr));

  return { roots, childrenOf, byId };
}

/**
 * Every descendant id of `rootId` (children, grandchildren, ...), excluding
 * the root itself. Depth-first, pre-order, cycle-safe.
 */
export function collectDescendantIds(notes = [], rootId) {
  const result = [];
  if (!rootId) return result;
  const childrenByParent = new Map();
  for (const n of notes || []) {
    if (!n || !n.id) continue;
    const pid = normalizeParentId(n.parentId);
    if (!pid || pid === n.id) continue;
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(n);
  }
  for (const [k, arr] of childrenByParent) childrenByParent.set(k, sortNotes(arr));

  const visited = new Set([rootId]);
  const stack = [...(childrenByParent.get(rootId) || [])].reverse();
  while (stack.length > 0) {
    const cur = stack.pop();
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    result.push(cur.id);
    const kids = childrenByParent.get(cur.id) || [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return result;
}

/** Root + all descendants as note objects, root first (pre-order). */
export function collectSubtree(notes = [], rootId) {
  const byId = indexNotesById(notes);
  const root = byId.get(rootId);
  if (!root) return [];
  return [root, ...collectDescendantIds(notes, rootId).map((id) => byId.get(id)).filter(Boolean)];
}

/**
 * Ancestors of `noteId` from the top-level note down to the direct parent.
 * Excludes the note itself. Stops on missing parents or cycles.
 */
export function getAncestorChain(notes = [], noteId) {
  const byId = indexNotesById(notes);
  const chain = [];
  let cur = byId.get(noteId);
  const seen = new Set(cur ? [cur.id] : []);
  let depth = 0;
  while (cur && depth < MAX_NESTING_DEPTH) {
    const pid = normalizeParentId(cur.parentId);
    if (!pid || seen.has(pid)) break;
    const parent = byId.get(pid);
    if (!parent) break;
    chain.unshift(parent);
    seen.add(parent.id);
    cur = parent;
    depth += 1;
  }
  return chain;
}

/** Ancestor chain + the note itself (for breadcrumbs). Empty if the note is unknown. */
export function buildBreadcrumbPath(notes = [], noteId) {
  const byId = indexNotesById(notes);
  const self = byId.get(noteId);
  if (!self) return [];
  return [...getAncestorChain(notes, noteId), self];
}

/** Set of ancestor ids of `noteId` (what the sidebar must expand to reveal it). */
export function getAncestorIds(notes = [], noteId) {
  return new Set(getAncestorChain(notes, noteId).map((n) => n.id));
}

/** True when `candidateId` is `ancestorId` itself or sits anywhere below it. */
export function isSameOrDescendant(notes = [], candidateId, ancestorId) {
  if (!candidateId || !ancestorId) return false;
  if (candidateId === ancestorId) return true;
  return collectDescendantIds(notes, ancestorId).includes(candidateId);
}

/**
 * Would setting `note.parentId = newParentId` create a loop?
 * (i.e. newParentId is the note itself or one of its descendants)
 */
export function wouldCreateCycle(notes = [], noteId, newParentId) {
  const pid = normalizeParentId(newParentId);
  if (!pid) return false;
  return isSameOrDescendant(notes, pid, noteId);
}

/** Depth of a note (0 = top-level). */
export function getNoteDepth(notes = [], noteId) {
  return getAncestorChain(notes, noteId).length;
}

/**
 * From a set of selected ids, keeps only those whose ancestors are NOT also
 * selected. Used so bulk operations (duplicate / move / delete) treat a
 * selected subtree once instead of once per selected member.
 */
export function getTopmostSelected(notes = [], selectedIds = []) {
  const selected = new Set(selectedIds);
  const byId = indexNotesById(notes);
  const out = [];
  for (const id of selected) {
    if (!byId.has(id)) continue;
    const ancestors = getAncestorChain(notes, id);
    if (!ancestors.some((a) => selected.has(a.id))) out.push(id);
  }
  return out;
}

/** Ids from `selectedIds` expanded with all of their descendants (deduplicated, order-preserving). */
export function expandSelectionWithDescendants(notes = [], selectedIds = []) {
  const out = [];
  const seen = new Set();
  for (const id of selectedIds || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const d of collectDescendantIds(notes, id)) {
      if (!seen.has(d)) {
        seen.add(d);
        out.push(d);
      }
    }
  }
  return out;
}

/** True if `blocks` already embed a card for `pageId`. */
export function hasPageBlockFor(blocks = [], pageId) {
  if (!pageId) return false;
  return (blocks || []).some((b) => b && b.type === "page" && b.pageId === pageId);
}

/** Ids of every sub-page referenced by `page` blocks in `blocks` (deduplicated, document order). */
export function getPageBlockIds(blocks = []) {
  const out = [];
  const seen = new Set();
  for (const b of blocks || []) {
    if (b && b.type === "page" && b.pageId && !seen.has(b.pageId)) {
      seen.add(b.pageId);
      out.push(b.pageId);
    }
  }
  return out;
}

/** Ids of `page` blocks that were present in `prevBlocks` but not in `nextBlocks`. */
export function diffRemovedPageIds(prevBlocks = [], nextBlocks = []) {
  const nextIds = new Set(getPageBlockIds(nextBlocks));
  return getPageBlockIds(prevBlocks).filter((id) => !nextIds.has(id));
}

function defaultIdFactory(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Deep-clones a note subtree with fresh ids. Every `parentId` and every
 * `page` block's `pageId` inside the subtree is remapped so the copy is a
 * fully independent tree (never shares children with the original).
 *
 * Returns the new notes, root first. `titlePrefix` is applied to the root only.
 */
export function cloneNoteTree(notes = [], rootId, options = {}) {
  const {
    titlePrefix = "Copy of ",
    makeNoteId = () => defaultIdFactory("n"),
    makeBlockId = () => defaultIdFactory("blk"),
    now = new Date().toISOString(),
    overrides = {},
  } = options;

  const subtree = collectSubtree(notes, rootId);
  if (subtree.length === 0) return [];

  const idMap = new Map();
  for (const n of subtree) idMap.set(n.id, makeNoteId());

  return subtree.map((n, idx) => {
    const isRoot = idx === 0;
    const clonedBlocks = (n.blocks || []).map((b) => {
      const copy = JSON.parse(JSON.stringify(b));
      copy.id = makeBlockId();
      if (copy.type === "page" && copy.pageId && idMap.has(copy.pageId)) {
        copy.pageId = idMap.get(copy.pageId);
      }
      return copy;
    });
    const newParent = isRoot
      ? (overrides.parentId !== undefined ? normalizeParentId(overrides.parentId) : normalizeParentId(n.parentId))
      : idMap.get(normalizeParentId(n.parentId)) ?? null;

    return {
      ...n,
      ...(isRoot ? overrides : {}),
      id: idMap.get(n.id),
      parentId: newParent,
      title: isRoot ? `${titlePrefix}${n.title || "Untitled Note"}` : n.title,
      blocks: clonedBlocks.length > 0 ? clonedBlocks : [{ id: makeBlockId(), type: "text", content: "" }],
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Chooses the parent for a note that is being restored: keep `parentId` only
 * when that parent is (or is about to be) live, else promote to top-level.
 */
export function resolveRestoredParentId(note, liveIds) {
  const pid = normalizeParentId(note?.parentId);
  if (!pid || pid === note?.id) return null;
  return liveIds.has(pid) ? pid : null;
}

/** Formats a breadcrumb path as plain text, e.g. "Physics › Mechanics › Forces". */
export function formatBreadcrumbText(path = [], separator = " › ") {
  return (path || []).map((n) => n?.title || "Untitled Note").join(separator);
}
