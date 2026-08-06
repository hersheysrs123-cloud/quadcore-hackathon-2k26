"use client";

import { useEffect, useRef, useState } from "react";

// ─── InstantNoteModal ───────────────────────────────────────────────
// Instant Note popup covering 75% of the screen.
// Triggers globally via Ctrl+I or the "⚡ Instant Note" button.
// Saves directly into the "Misc" space in Supabase & LocalStorage.
// ─────────────────────────────────────────────────────────────────────

export default function InstantNoteModal({ open, onClose, onSaveInstantNote, spaces = [] }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [space, setSpace] = useState("Misc");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const inputRef = useRef(null);

  // Set default title with current date/time when opened
  useEffect(() => {
    if (open) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setTitle(`Quick Idea — ${now.toLocaleDateString()} ${timeStr}`);
      setContent("");
      setSavedSuccess(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Handle Ctrl+Enter to quick save
  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  async function handleSave() {
    if (!content.trim() && !title.trim()) return;

    const newNote = {
      id: `n_instant_${Date.now()}`,
      title: title.trim() || "Instant Note",
      space: space || "Misc",
      blocks: [
        {
          id: `blk_${Date.now()}`,
          type: "text",
          content: content.trim(),
        },
      ],
    };

    onSaveInstantNote?.(newNote);
    setSavedSuccess(true);

    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md transition-all animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative flex h-[75vh] w-[75vw] max-w-5xl flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-ink-800/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-lg text-ink-950 font-bold shadow-md">
              ⚡
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-100 flex items-center gap-2">
                <span>Instant Note</span>
                <span className="rounded bg-ink-800 px-2 py-0.5 text-[10px] font-mono text-ink-400">
                  Ctrl+I
                </span>
              </h2>
              <p className="text-xs text-ink-500">
                Jot down quick thoughts instantly · Saved under <strong className="text-duck-300">Misc</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="flex flex-1 flex-col p-6 space-y-4 overflow-y-auto">
          {/* Note Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note Title…"
            className="w-full border-b border-ink-800 bg-transparent pb-2 text-2xl font-bold tracking-tight text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none"
          />

          {/* Quick Idea Text Area */}
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your quick idea or thoughts here… Press Ctrl+Enter to save."
            className="flex-1 w-full resize-none rounded-xl border border-ink-800 bg-ink-950 p-4 text-sm leading-relaxed text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none shadow-inner"
          />
        </div>

        {/* Footer Controls */}
        <div className="flex shrink-0 items-center justify-between border-t border-ink-800/80 px-6 py-4 bg-ink-900/90">
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <span>Save to Space:</span>
            <select
              value={space}
              onChange={(e) => setSpace(e.target.value)}
              className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1 text-xs text-ink-200 focus:border-duck-500 focus:outline-none"
            >
              {spaces.map(sp => (
                <option key={sp.name} value={sp.name}>{sp.name} {sp.name === 'Misc' ? '(Instant Notes)' : ''}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-400 animate-fade-in">
                ✓ Saved to {space}!
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-duck-400 px-5 py-2 text-xs font-bold text-ink-950 shadow-lg shadow-amber-500/10 transition-all hover:brightness-110 active:scale-95"
            >
              <span>⚡</span>
              <span>Save Instant Note</span>
              <kbd className="ml-1 rounded bg-ink-950/20 px-1.5 py-0.5 text-[10px] font-mono text-ink-950">
                Ctrl+Enter
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
