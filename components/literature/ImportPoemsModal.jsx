"use client";

import { Upload } from "lucide-react";

/**
 * Import preview. The file has already been parsed and validated by
 * lib/literature's `migrate()` before this renders, so the counts shown are
 * the counts that will actually land — not the file's own claims.
 */
export default function ImportPoemsModal({ open, preview, currentCount, onClose, onMerge, onReplace }) {
  if (!open || !preview) return null;

  const annCount = preview.poems.reduce((s, p) => s + p.annotations.length, 0);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[250] bg-ink-950/75 backdrop-blur-xs" />
      <div className="fixed left-1/2 top-1/2 z-[260] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-800 bg-ink-900 p-6 shadow-2xl animate-fade-up">
        <div className="flex items-center gap-3 border-b border-ink-800 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-duck-500/30 bg-duck-500/10 text-duck-300">
            <Upload className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-ink-100">Import Literature backup</h3>
        </div>

        <div className="mt-4 space-y-3 text-xs leading-relaxed text-ink-300">
          <p>
            This file contains <strong className="text-ink-100">{preview.poems.length}</strong>{" "}
            {preview.poems.length === 1 ? "poem" : "poems"} and{" "}
            <strong className="text-ink-100">{annCount}</strong>{" "}
            {annCount === 1 ? "annotation" : "annotations"}.
          </p>
          <p>
            You currently have <strong className="text-ink-100">{currentCount}</strong>{" "}
            {currentCount === 1 ? "poem" : "poems"} in this space. Replacing removes them.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onMerge}
            className="rounded-xl border border-ink-750 bg-ink-850 px-4 py-2 text-xs font-semibold text-ink-200 transition-colors hover:border-ink-700 hover:text-ink-100"
          >
            Add to my poems
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-200 transition-colors hover:bg-rose-500/30"
          >
            Replace all
          </button>
        </div>
      </div>
    </>
  );
}
