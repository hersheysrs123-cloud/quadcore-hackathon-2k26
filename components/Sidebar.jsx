"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Sidebar ────────────────────────────────────────────────────────
// Dark-mode sidebar with Spaces, notes-per-space, a "Create New Space"
// modal, and a pinned Calendar / Reminder quick-add widget.
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_NOTES = {
  School: [
    { id: "n1", title: "Eigenvectors & Eigenvalues" },
    { id: "n2", title: "Lecture 7 — Determinants" },
  ],
  Personal: [
    { id: "n3", title: "Reading list — July" },
    { id: "n4", title: "Side project brainstorm" },
  ],
  Misc: [{ id: "n5", title: "Random thoughts" }],
};

// ─── Create New Space Modal ─────────────────────────────────────────
function CreateSpaceModal({ open, onClose, onCreate }) {
  const inputRef = useRef(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📂");

  useEffect(() => {
    if (open) {
      setName("");
      setIcon("📂");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({ name: trimmed, icon, blurb: "" });
    onClose();
  }

  if (!open) return null;

  const ICON_OPTIONS = ["📂", "🎓", "🌱", "📦", "🧪", "🎨", "🏋️", "💼", "🎯", "🔬"];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[60] bg-ink-950/70 backdrop-blur-sm transition-opacity"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create New Space"
        className="fixed left-1/2 top-1/2 z-[70] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-100">Create New Space</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
          {/* Icon picker */}
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-ink-500">
              Icon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all ${
                    icon === emoji
                      ? "bg-duck-500/20 ring-2 ring-duck-400"
                      : "bg-ink-850 hover:bg-ink-800"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="space-name"
              className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-ink-500"
            >
              Name
            </label>
            <input
              ref={inputRef}
              id="space-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Research"
              maxLength={32}
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm text-ink-400 transition-colors hover:text-ink-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg bg-duck-400 px-4 py-2 text-sm font-medium text-ink-950 transition-opacity disabled:opacity-30"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Calendar / Reminder Quick-Add ──────────────────────────────────
function QuickAddWidget() {
  const [mode, setMode] = useState("idle"); // idle | calendar | reminder
  const [value, setValue] = useState("");
  const [items, setItems] = useState([]);

  function handleAdd(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setItems((prev) => [
      ...prev,
      { id: Date.now(), label: trimmed, type: mode, done: false },
    ]);
    setValue("");
    setMode("idle");
  }

  function toggleDone(id) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it))
    );
  }

  const today = new Date();
  const dayLabel = today.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="border-t border-ink-800 px-4 py-3">
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
          {dayLabel}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode(mode === "calendar" ? "idle" : "calendar")}
            title="Add calendar event"
            className={`rounded-md px-1.5 py-1 text-xs transition-colors ${
              mode === "calendar"
                ? "bg-duck-500/20 text-duck-300"
                : "text-ink-500 hover:bg-ink-800 hover:text-ink-300"
            }`}
          >
            📅
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "reminder" ? "idle" : "reminder")}
            title="Add reminder"
            className={`rounded-md px-1.5 py-1 text-xs transition-colors ${
              mode === "reminder"
                ? "bg-duck-500/20 text-duck-300"
                : "text-ink-500 hover:bg-ink-800 hover:text-ink-300"
            }`}
          >
            ⏰
          </button>
        </div>
      </div>

      {/* Inline quick-add form */}
      {mode !== "idle" && (
        <form onSubmit={handleAdd} className="mb-2 flex gap-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              mode === "calendar" ? "Event title…" : "Reminder…"
            }
            className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-850 px-2 py-1.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="shrink-0 rounded-md bg-duck-400 px-2.5 py-1.5 text-xs font-medium text-ink-950 transition-opacity disabled:opacity-30"
          >
            +
          </button>
        </form>
      )}

      {/* Items */}
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => toggleDone(it.id)}
                className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[8px] transition-colors ${
                  it.done
                    ? "border-duck-500 bg-duck-500 text-ink-950"
                    : "border-ink-600 hover:border-ink-400"
                }`}
              >
                {it.done && "✓"}
              </button>
              <span
                className={`text-xs leading-snug ${
                  it.done
                    ? "text-ink-600 line-through"
                    : "text-ink-300"
                }`}
              >
                <span className="mr-1 text-[10px] text-ink-500">
                  {it.type === "calendar" ? "📅" : "⏰"}
                </span>
                {it.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 && mode === "idle" && (
        <p className="text-[11px] leading-relaxed text-ink-600">
          Blocks you flag get quizzed by the Duck until it can score what you
          actually know.
        </p>
      )}
    </div>
  );
}

// ─── Sidebar (main export) ──────────────────────────────────────────
export default function Sidebar({
  spaces: initialSpaces,
  activeSpace,
  onSelectSpace,
  note,
}) {
  const [spaces, setSpaces] = useState(initialSpaces);
  const [modalOpen, setModalOpen] = useState(false);
  const [notesBySpace] = useState(DEFAULT_NOTES);
  const [activeNote, setActiveNote] = useState(null);

  // Keep activeSpace in sync with the first space if it's removed
  useEffect(() => {
    if (!spaces.find((s) => s.name === activeSpace) && spaces.length > 0) {
      onSelectSpace(spaces[0].name);
    }
  }, [spaces, activeSpace, onSelectSpace]);

  const handleCreateSpace = useCallback(
    (newSpace) => {
      setSpaces((prev) => [...prev, newSpace]);
      onSelectSpace(newSpace.name);
    },
    [onSelectSpace]
  );

  const currentNotes = notesBySpace[activeSpace] ?? [];

  return (
    <>
      <aside className="flex w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="text-lg leading-none">🦆</span>
          <span className="text-sm font-semibold tracking-tight text-ink-100">
            SocraticOS
          </span>
        </div>

        {/* ─── Spaces ─────────────────────────────────── */}
        <nav className="px-3">
          <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-500">
            Spaces
          </p>
          <ul className="space-y-0.5">
            {spaces.map((space) => {
              const isActive = space.name === activeSpace;
              return (
                <li key={space.name}>
                  <button
                    type="button"
                    onClick={() => onSelectSpace(space.name)}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-ink-800 text-ink-100"
                        : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
                    }`}
                  >
                    <span className="text-base leading-none">{space.icon}</span>
                    <span className="flex-1 truncate">{space.name}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-duck-400" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Create New Space */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-ink-700 px-2.5 py-2 text-left text-sm text-ink-500 transition-colors hover:border-duck-500/40 hover:text-duck-400"
          >
            <span className="text-base leading-none">＋</span>
            <span>Create New Space</span>
          </button>
        </nav>

        {/* ─── Notes list ─────────────────────────────── */}
        <div className="mt-6 flex-1 overflow-y-auto px-3">
          <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-500">
            {activeSpace} · Notes
          </p>
          <ul className="space-y-0.5">
            {/* Current note from props (always shown first) */}
            {note && (
              <li>
                <button
                  type="button"
                  onClick={() => setActiveNote(null)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                    activeNote === null
                      ? "bg-ink-800 text-ink-100"
                      : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
                  }`}
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-duck-400" />
                  <span className="truncate">{note.title}</span>
                </button>
              </li>
            )}
            {/* Per-space notes */}
            {currentNotes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setActiveNote(n.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                    activeNote === n.id
                      ? "bg-ink-800 text-ink-100"
                      : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
                  }`}
                >
                  <span className="truncate">{n.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 w-full rounded-md border border-dashed border-ink-700 px-2.5 py-2 text-left text-sm text-ink-500 transition-colors hover:border-ink-600 hover:text-ink-400"
          >
            + New note
          </button>
        </div>

        {/* ─── Quick-add Calendar / Reminder widget (pinned bottom) ── */}
        <QuickAddWidget />
      </aside>

      {/* Create Space modal */}
      <CreateSpaceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateSpace}
      />
    </>
  );
}
