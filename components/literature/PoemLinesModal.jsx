"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Trash2, X } from "lucide-react";

/**
 * The line-by-line poem editor.
 *
 * Every row carries `src`: the index this line had when the modal opened, or
 * -1 for a line that did not exist before. On save that produces a `lineMap`
 * (`lineMap[oldIndex] = newIndex`, or -1 when deleted), which is what lets
 * annotations follow their lines through reordering and deletion instead of
 * being silently detached. Never drop `src` when manipulating rows.
 */
export default function PoemLinesModal({ open, poem, onClose, onSave, onDelete }) {
  const isNew = !poem;
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState([{ src: -1, text: "" }]);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const listRef = useRef(null);
  const titleRef = useRef(null);
  const focusTargetRef = useRef(null);
  const originalCountRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTitle(poem?.title || "");
    setRows(poem ? poem.lines.map((t, i) => ({ src: i, text: t })) : [{ src: -1, text: "" }]);
    originalCountRef.current = poem ? poem.lines.length : 0;
    setDirty(false);
    setConfirmDiscard(false);
    setConfirmDelete(false);
    const t = setTimeout(() => titleRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open, poem]);

  /* Row focus has to happen after the new rows have painted, otherwise the
     input we want does not exist yet. */
  useEffect(() => {
    const target = focusTargetRef.current;
    if (!target || !listRef.current) return;
    focusTargetRef.current = null;
    const inputs = listRef.current.querySelectorAll(".lit-line-input");
    const node = inputs[Math.max(0, Math.min(target.index, inputs.length - 1))];
    if (!node) return;
    node.focus();
    const pos = target.caret === "start" ? 0 : node.value.length;
    try {
      node.setSelectionRange(pos, pos);
    } catch (err) {
      /* number/date inputs would throw; text inputs never do */
    }
  }, [rows]);

  const focusRow = (index, caret = "end") => {
    focusTargetRef.current = { index, caret };
  };

  const annCount = poem?.annotations?.length || 0;

  const move = useCallback((i, dir) => {
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      focusRow(j);
      return next;
    });
    setDirty(true);
  }, []);

  const removeRow = useCallback((i) => {
    setRows((prev) => {
      if (prev.length === 1) return [{ ...prev[0], text: "" }];
      const next = prev.slice();
      next.splice(i, 1);
      focusRow(Math.min(i, next.length - 1));
      return next;
    });
    setDirty(true);
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => {
      focusRow(prev.length);
      return [...prev, { src: -1, text: "" }];
    });
    setDirty(true);
  }, []);

  const handleKeyDown = (e, i, input) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const caretPos = input.selectionStart;
      const rest = input.value.slice(caretPos);
      setRows((prev) => {
        const next = prev.slice();
        next[i] = { ...next[i], text: input.value.slice(0, caretPos) };
        next.splice(i + 1, 0, { src: -1, text: rest });
        return next;
      });
      focusRow(i + 1, "start");
      setDirty(true);
    } else if (e.key === "Backspace" && input.value === "" && rows.length > 1) {
      e.preventDefault();
      removeRow(i);
      focusRow(Math.max(0, i - 1));
    } else if (e.key === "ArrowDown" && !e.altKey && i < rows.length - 1) {
      e.preventDefault();
      focusRow(i + 1);
      setRows((r) => r.slice());
    } else if (e.key === "ArrowUp" && !e.altKey && i > 0) {
      e.preventDefault();
      focusRow(i - 1);
      setRows((r) => r.slice());
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      move(i, e.key === "ArrowUp" ? -1 : 1);
    }
  };

  /* Pasting a whole poem splits into one row per line — the single most
     common way a poem gets in here. */
  const handlePaste = (e, i, input) => {
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (!text || text.indexOf("\n") < 0) return;
    e.preventDefault();
    const pieces = text.replace(/\r\n?/g, "\n").split("\n");
    const caretPos = input.selectionStart;
    const before = input.value.slice(0, caretPos);
    const after = input.value.slice(input.selectionEnd);

    setRows((prev) => {
      const newRows = pieces.map((p, k) => {
        let t = p;
        if (k === 0) t = before + p;
        if (k === pieces.length - 1) t += after;
        return { src: -1, text: t };
      });
      newRows[0].src = prev[i].src; // keep this line's annotations attached
      const next = prev.slice();
      next.splice(i, 1, ...newRows);
      focusRow(i + newRows.length - 1);
      return next;
    });
    setDirty(true);
  };

  const buildResult = () => {
    const kept = rows.slice();
    /* Trim trailing blank lines the user never typed, so stray empties from
       pasting never accumulate at the foot of the poem. */
    while (kept.length > 1 && kept[kept.length - 1].text.trim() === "" && kept[kept.length - 1].src === -1) {
      kept.pop();
    }
    const lines = kept.map((r) => r.text);
    const lineMap = [];
    kept.forEach((r, newIndex) => {
      if (r.src >= 0) lineMap[r.src] = newIndex;
    });
    let maxSrc = 0;
    rows.forEach((r) => {
      if (r.src > maxSrc) maxSrc = r.src;
    });
    for (let i = 0; i <= Math.max(maxSrc, originalCountRef.current - 1); i++) {
      if (lineMap[i] === undefined) lineMap[i] = -1; // present before, gone now
    }
    return { lines, lineMap };
  };

  const requestClose = () => {
    if (!dirty) return onClose();
    setConfirmDiscard(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (confirmDelete) return setConfirmDelete(false);
      if (confirmDiscard) return setConfirmDiscard(false);
      requestClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  if (!open) return null;

  return (
    <>
      <div onClick={requestClose} className="fixed inset-0 z-[250] bg-ink-950/75 backdrop-blur-xs" />
      <div className="fixed left-1/2 top-1/2 z-[260] flex max-h-[88vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl animate-fade-up">
        <div className="flex items-center gap-3 border-b border-ink-800 px-5 py-4">
          <h3 className="text-sm font-bold text-ink-100">{isNew ? "Add poem" : "Edit poem"}</h3>
          <div className="flex-1" />
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              Title
            </span>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  focusRow(0);
                  setRows((r) => r.slice());
                }
              }}
              placeholder="Poem title — e.g. Remember — Christina Rossetti"
              className="w-full rounded-xl border border-ink-750 bg-ink-850 px-3 py-2 text-sm text-ink-100 outline-none transition-colors placeholder:text-ink-600 focus:border-duck-500/50 focus:ring-2 focus:ring-duck-400/20"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              Lines
            </span>
            <div ref={listRef} className="flex flex-col gap-1">
              {rows.map((row, i) => (
                <div key={i} className="group/row flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-right text-[10.5px] tabular-nums text-ink-600">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={row.text}
                    spellCheck={false}
                    placeholder={row.text.trim() === "" ? "Blank line (stanza break)" : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRows((prev) => {
                        const next = prev.slice();
                        next[i] = { ...next[i], text: v };
                        return next;
                      });
                      setDirty(true);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, i, e.currentTarget)}
                    onPaste={(e) => handlePaste(e, i, e.currentTarget)}
                    className={`lit-line-input min-w-0 flex-1 rounded-lg border border-transparent px-2.5 py-1.5 font-note-serif text-[15px] text-ink-100 outline-none transition-colors hover:border-ink-800 focus:border-duck-500/50 focus:bg-ink-850 focus:ring-2 focus:ring-duck-400/20 ${
                      row.text.trim() === "" ? "bg-ink-850/40" : "bg-ink-850"
                    }`}
                  />
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                    <button
                      type="button"
                      title="Move up"
                      onClick={() => move(i, -1)}
                      className="rounded p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      onClick={() => move(i, 1)}
                      className="rounded p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete line"
                      onClick={() => removeRow(i)}
                      className="rounded p-1 text-ink-500 transition-colors hover:bg-rose-500/15 hover:text-gap-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-2 rounded-xl border border-ink-750 bg-ink-850 px-3 py-1.5 text-xs font-semibold text-ink-300 transition-colors hover:border-ink-700 hover:text-ink-100"
            >
              + Add line
            </button>
          </div>

          {annCount > 0 && (
            <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11.5px] leading-relaxed text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This poem has {annCount} {annCount === 1 ? "annotation" : "annotations"}. Moving lines keeps
                them attached. Deleting a line also deletes the analysis attached to it.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-500">
            <span>
              <Kbd>Enter</Kbd> new line
            </span>
            <span>
              <Kbd>Backspace</Kbd> on an empty line deletes it
            </span>
            <span>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move between lines
            </span>
            <span>
              <Kbd>Alt</Kbd>+<Kbd>↑</Kbd>/<Kbd>↓</Kbd> reorder
            </span>
            <span>pasting several lines splits them automatically</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-ink-800 px-5 py-3.5">
          {!isNew && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-gap-400 transition-colors hover:bg-rose-500/15"
            >
              Delete poem
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={requestClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const built = buildResult();
              onSave({ title: title.trim() || "Untitled poem", ...built });
            }}
            className="rounded-xl bg-duck-400 px-4 py-2 text-xs font-bold text-ink-950 transition-colors hover:bg-duck-300"
          >
            Save
          </button>
        </div>
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard changes?"
          message="Your edits to this poem will not be saved."
          confirmText="Discard"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            onClose();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this poem?"
          message={`This deletes “${poem?.title}” along with its ${annCount} ${
            annCount === 1 ? "annotation" : "annotations"
          }, introduction and conclusion. This cannot be undone.`}
          confirmText="Delete poem"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete?.();
          }}
        />
      )}
    </>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="rounded border border-ink-750 bg-ink-850 px-1 py-0.5 font-mono text-[10px] text-ink-400">
      {children}
    </kbd>
  );
}

export function ConfirmDialog({ title, message, confirmText = "Confirm", onCancel, onConfirm }) {
  return (
    <>
      <div onClick={onCancel} className="fixed inset-0 z-[270] bg-ink-950/75 backdrop-blur-xs" />
      <div className="fixed left-1/2 top-1/2 z-[280] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-rose-500/40 bg-ink-900 p-6 shadow-2xl animate-fade-up">
        <div className="flex items-center gap-3 border-b border-ink-800 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-ink-100">{title}</h3>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-300">{message}</p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-xs font-medium text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-200 shadow-sm transition-colors hover:bg-rose-500/30"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
}
