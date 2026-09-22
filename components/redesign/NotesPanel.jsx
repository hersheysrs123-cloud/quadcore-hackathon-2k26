"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOnClickOutside } from "usehooks-ts";
import { ChevronDown, ChevronRight, Pencil, Plus, Search, SlidersHorizontal, Star, Trash2, X } from "lucide-react";
import NoteMenu from "@/components/NoteMenu";
import { CreateSpaceModal, EditSpaceModal, TrashModal } from "@/components/Sidebar";
import { saveAllSpaces } from "@/lib/storageService";
import { buildNoteTree, getAncestorIds } from "@/lib/noteHierarchy";

const EXPANDED_KEY = "socratic_sidebar_expanded_notes";

/**
 * The contextual panel shown next to the rail while you are in Notes.
 *
 * It does exactly three things: pick a space, find a note, open a note.
 * Global tools (timer, calendar, 3D, bookmarks) moved to the rail, so this
 * panel no longer has to carry them. Drag-to-reorder and multi-select from
 * the original sidebar are intentionally left out of this prototype.
 */
export default function NotesPanel({
  spaces = [],
  setSpaces,
  activeSpace,
  onSelectSpace,
  onEditSpace,
  onDeleteSpace,
  onOpenSpaceHub,
  notesBySpace = {},
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onSaveNote,
  onToggleFavorite,
  onDuplicateNote,
  onMoveNote,
  onRenameNote,
  onDeleteNote,
  onCreateSubPage,
  trashNotes = [],
  onRecoverNote,
  onPermanentlyDeleteNote,
  onRecoverAllNotes,
  onPermanentlyDeleteAllNotes,
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [query, setQuery] = useState("");
  const switcherRef = useRef(null);
  useOnClickOutside(switcherRef, () => setSwitcherOpen(false));

  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const cached = JSON.parse(localStorage.getItem(EXPANDED_KEY) || "[]");
      return new Set(Array.isArray(cached) ? cached : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(expanded).slice(-500)));
    } catch {
      /* convenience only */
    }
  }, [expanded]);

  const notes = notesBySpace[activeSpace] || [];
  const tree = useMemo(() => buildNoteTree(notes), [notes]);
  const currentSpace = spaces.find((s) => s.name === activeSpace) || spaces[0];

  // Keep the open note visible: expand every ancestor of it.
  useEffect(() => {
    if (!activeNoteId) return;
    const ancestors = getAncestorIds(notes, activeNoteId);
    if (ancestors.length === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeNoteId, notes]);

  const toggleExpanded = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateSpace = useCallback(
    (newSpace) => {
      try {
        const delArr = JSON.parse(localStorage.getItem("socratic_deleted_spaces") || "[]");
        if (Array.isArray(delArr) && delArr.includes(newSpace.name)) {
          localStorage.setItem(
            "socratic_deleted_spaces",
            JSON.stringify(delArr.filter((n) => n !== newSpace.name))
          );
        }
      } catch {
        /* ignore */
      }
      setSpaces?.((prev) => {
        const next = [...prev, newSpace];
        saveAllSpaces(next);
        return next;
      });
      onSelectSpace?.(newSpace.name);
    },
    [setSpaces, onSelectSpace]
  );

  const trimmedQuery = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!trimmedQuery) return null;
    return notes.filter((n) => (n.title || "Untitled Note").toLowerCase().includes(trimmedQuery));
  }, [notes, trimmedQuery]);

  const menuProps = {
    spaces,
    onSaveNote,
    onToggleFavorite,
    onDuplicateNote,
    onMoveNote,
    onRenameNote,
    onDeleteNote,
    onCreateSubPage,
  };

  function renderRow(n, depth, { showChevron = true } = {}) {
    const children = tree.childrenOf.get(n.id) || [];
    const hasChildren = showChevron && children.length > 0;
    const isOpen = hasChildren && expanded.has(n.id);
    const isActive = n.id === activeNoteId;

    return (
      <li key={n.id} data-note-id={n.id} data-depth={depth}>
        <div
          className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
            isActive ? "bg-ink-800 text-ink-100" : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
          }`}
          style={{ paddingLeft: `${4 + depth * 14}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpanded(n.id)}
              aria-label={isOpen ? "Collapse sub-pages" : "Expand sub-pages"}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-500 hover:bg-ink-700 hover:text-ink-200"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => onSelectNote?.(n)}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-[13px]"
            title={n.title || "Untitled Note"}
          >
            <span className="shrink-0 text-sm leading-none">{n.emoji || "📝"}</span>
            <span className={`truncate ${isActive ? "font-semibold" : "font-medium"}`}>
              {n.title || "Untitled Note"}
            </span>
            {n.isFavorite && <Star className="h-3 w-3 shrink-0 fill-duck-400 text-duck-400" />}
          </button>
          <NoteMenu
            mode="sidebar"
            note={n}
            {...menuProps}
            variant="icon"
            align="right"
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          />
        </div>
        {hasChildren && isOpen && (
          <ul className="mt-0.5 space-y-0.5">{children.map((c) => renderRow(c, depth + 1))}</ul>
        )}
      </li>
    );
  }

  return (
    <aside className="no-print flex h-full w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
      {/* Space switcher */}
      <div className="relative px-3 pt-3" ref={switcherRef}>
        <button
          type="button"
          onClick={() => setSwitcherOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink-850"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-base">
            {currentSpace?.icon || "📂"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink-100">{activeSpace}</span>
            <span className="block truncate text-[11px] text-ink-500">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-500 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
        </button>

        {switcherOpen && (
          <div
            role="listbox"
            className="absolute left-3 right-3 top-full z-[120] mt-1 rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-2xl animate-pop"
          >
            <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Spaces</p>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {spaces.map((s) => {
                const active = s.name === activeSpace;
                return (
                  <div
                    key={s.name}
                    className={`group/sp flex items-center rounded-lg ${
                      active ? "bg-ink-800 text-ink-100" : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
                    }`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onSelectSpace?.(s.name);
                        setSwitcherOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[13px]"
                    >
                      <span className="text-sm leading-none">{s.icon || "📂"}</span>
                      <span className="truncate font-medium">{s.name}</span>
                      <span className="ml-auto text-[11px] text-ink-500">{(notesBySpace[s.name] || []).length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSwitcherOpen(false);
                        setEditingSpace(s);
                      }}
                      title="Edit space"
                      className="mr-1 rounded p-1 text-ink-500 opacity-0 transition-opacity hover:bg-ink-700 hover:text-ink-100 group-hover/sp:opacity-100"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="my-1 border-t border-ink-800" />
            <button
              type="button"
              onClick={() => {
                setSwitcherOpen(false);
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-duck-400 hover:bg-ink-850"
            >
              <Plus className="h-3.5 w-3.5" /> New space
            </button>
            <button
              type="button"
              onClick={() => {
                setSwitcherOpen(false);
                onOpenSpaceHub?.();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-ink-300 hover:bg-ink-850 hover:text-ink-100"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Space settings &amp; syllabus
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pt-2">
        <label className="flex items-center gap-2 rounded-lg border border-transparent bg-ink-850 px-2.5 py-1.5 text-ink-500 focus-within:border-ink-700 focus-within:bg-ink-900">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a note"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-100 placeholder:text-ink-500 focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="rounded p-0.5 hover:text-ink-200">
              <X className="h-3 w-3" />
            </button>
          )}
        </label>
      </div>

      {/* Notes list */}
      <div className="mt-3 flex items-center justify-between px-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          {searchResults ? `${searchResults.length} found` : "Notes"}
        </p>
        <button
          type="button"
          onClick={onCreateNote}
          title="New note"
          className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-1 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {notes.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center">
            <p className="text-sm font-medium text-ink-200">No notes yet</p>
            <p className="mt-1 text-xs text-ink-500">Start writing and the Duck will quiz you on it later.</p>
            <button
              type="button"
              onClick={onCreateNote}
              className="mt-3 rounded-lg bg-duck-400 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-duck-300"
            >
              New note
            </button>
          </div>
        ) : searchResults ? (
          searchResults.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-ink-500">Nothing matches “{query}”.</p>
          ) : (
            <ul className="space-y-0.5">{searchResults.map((n) => renderRow(n, 0, { showChevron: false }))}</ul>
          )
        ) : (
          <ul className="space-y-0.5" data-testid="sidebar-note-tree">
            {tree.roots.map((n) => renderRow(n, 0))}
          </ul>
        )}

        {notes.length > 0 && !searchResults && (
          <button
            type="button"
            onClick={onCreateNote}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] text-ink-500 transition-colors hover:bg-ink-850 hover:text-ink-200"
          >
            <Plus className="h-3.5 w-3.5" /> New note
          </button>
        )}
      </div>

      {/* Trash */}
      <div className="border-t border-ink-800 px-3 py-2">
        <button
          type="button"
          onClick={() => setTrashOpen(true)}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-ink-500 transition-colors hover:bg-ink-850 hover:text-ink-200"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="h-3.5 w-3.5" /> Trash
          </span>
          {trashNotes.length > 0 && (
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] font-semibold text-ink-300">{trashNotes.length}</span>
          )}
        </button>
      </div>

      <CreateSpaceModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreateSpace} spaces={spaces} />
      <EditSpaceModal
        open={Boolean(editingSpace)}
        space={editingSpace}
        onClose={() => setEditingSpace(null)}
        onSave={(name, updates) => onEditSpace?.(name, updates)}
        onDelete={(name) => onDeleteSpace?.(name)}
        canDelete={spaces.length > 1}
        spaces={spaces}
      />
      <TrashModal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        trashNotes={trashNotes}
        onRecoverNote={onRecoverNote}
        onPermanentlyDeleteNote={onPermanentlyDeleteNote}
        onRecoverAll={onRecoverAllNotes}
        onPermanentlyDeleteAll={onPermanentlyDeleteAllNotes}
      />
    </aside>
  );
}
