"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { annotationParts, annotationQuote, annotationLocation, rangeText } from "@/lib/literature";

/**
 * Anchor a fixed-position element to a client rect: prefer below, flip above
 * when it would overflow, and clamp to the viewport either way.
 */
function place(node, rect, { align = "start", gap = 8 } = {}) {
  if (!node || !rect) return;
  const pad = 10;
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = rect.bottom + gap;
  if (top + h > vh - pad) {
    const above = rect.top - gap - h;
    top = above >= pad ? above : Math.max(pad, vh - pad - h);
  }
  let left = align === "center" ? rect.left + rect.width / 2 - w / 2 : rect.left;
  left = Math.max(pad, Math.min(left, vw - pad - w));

  node.style.top = `${Math.round(top)}px`;
  node.style.left = `${Math.round(left)}px`;
}

function sameRange(a, b) {
  return (
    a &&
    b &&
    a.startLine === b.startLine &&
    a.startChar === b.startChar &&
    a.endLine === b.endLine &&
    a.endChar === b.endChar
  );
}

const SHELL =
  "fixed z-[220] w-[370px] max-w-[calc(100vw-20px)] rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl animate-fade-in";

/* ── view: read one annotation ───────────────────────────────── */

function ViewPopover({ poem, annotation, number, testMode, revealed, onToggleReveal, onEdit, onDelete, onClose }) {
  const parts = annotationParts(poem.lines, annotation);
  const hidden = testMode && !revealed;

  return (
    <>
      <div className="flex items-start gap-2 border-b border-ink-800 px-3.5 py-2.5">
        <span className="mt-0.5 shrink-0 rounded-md border border-duck-500/30 bg-duck-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-duck-300">
          {number}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-1">
          {parts.map((t, i) => (
            <span key={i} className="truncate font-note-serif text-[13.5px] text-ink-200">
              {t.replace(/\s+/g, " ").trim()}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="shrink-0 rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3.5 py-3">
        {annotation.label && (
          <span className="mb-2 inline-block rounded-md border border-ink-750 bg-ink-850 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
            {annotation.label}
          </span>
        )}
        <div
          onClick={() => testMode && onToggleReveal()}
          className={`lit-blurable max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink-200 ${
            hidden ? "is-hidden" : ""
          }`}
        >
          {annotation.text || "(no analysis written yet)"}
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-t border-ink-800 px-3.5 py-2">
        <span className="text-[11px] text-ink-500">{annotationLocation(annotation)}</span>
        <div className="flex-1" />
        {testMode && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            {revealed ? "Hide" : "Reveal"}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-gap-400 transition-colors hover:bg-rose-500/15"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </>
  );
}

/* ── chooser: several annotations on the same words ──────────── */

function ChooserPopover({ poem, annotations, numbers, testMode, onPick, onHover, onClose }) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-ink-800 px-3.5 py-2.5">
        <span className="text-[13px] font-semibold text-ink-100">
          {annotations.length} analyses on these words
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto p-1.5">
        {annotations.map((ann) => (
          <button
            key={ann.id}
            type="button"
            onMouseEnter={() => onHover?.([ann.id])}
            onClick={() => onPick(ann.id)}
            className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink-850"
          >
            <span className="mt-0.5 shrink-0 rounded-md border border-duck-500/30 bg-duck-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-duck-300">
              {numbers[ann.id]}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-note-serif text-[13px] text-ink-200">
                “{annotationQuote(poem.lines, ann)}”
              </span>
              {ann.label && (
                <span className="w-fit rounded border border-ink-750 bg-ink-850 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  {ann.label}
                </span>
              )}
              <span className={`lit-blurable line-clamp-2 text-[11.5px] text-ink-400 ${testMode ? "is-hidden" : ""}`}>
                {ann.text}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ── editor: create / edit, with multi-phrase chips ──────────── */

function EditorPopover({
  poem,
  existing,
  ranges,
  pendingRange,
  onAddPart,
  onRemovePart,
  onSave,
  onCancel,
  onDelete,
}) {
  const [label, setLabel] = useState(existing?.label || "");
  const [text, setText] = useState(existing?.text || "");
  const [error, setError] = useState("");
  const textRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => textRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, []);

  const canAddPart = pendingRange && !ranges.some((r) => sameRange(r, pendingRange));

  const submit = () => {
    if (!ranges.length) return setError("Select some words first.");
    if (!text.trim()) {
      setError("Write your analysis before saving.");
      textRef.current?.focus();
      return;
    }
    onSave({ text: text.trim(), label: label.trim() });
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-ink-800 px-3.5 py-2.5">
        <span className="text-[12.5px] font-semibold text-ink-300">
          {existing ? "Edit analysis" : "New analysis"}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          title="Cancel"
          className="rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto px-3.5 py-3">
        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            Selected text
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {ranges.map((r, i) => (
              <span
                key={i}
                className="flex max-w-[190px] items-center gap-1 rounded-lg border border-ink-750 bg-ink-850 px-2 py-1 text-[12px]"
              >
                <span className="truncate font-note-serif text-ink-200">
                  {rangeText(poem.lines, r).replace(/\s+/g, " ").trim()}
                </span>
                {ranges.length > 1 && (
                  <button
                    type="button"
                    title="Remove this phrase"
                    onClick={() => onRemovePart(i)}
                    className="shrink-0 rounded text-ink-500 transition-colors hover:text-gap-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            <button
              type="button"
              disabled={!canAddPart}
              onClick={onAddPart}
              className="rounded-lg border border-dashed border-ink-700 px-2 py-1 text-[11px] font-semibold text-duck-300 transition-colors hover:border-duck-500/50 hover:bg-ink-850 disabled:pointer-events-none disabled:text-ink-500"
            >
              {canAddPart ? "+ Add selected phrase" : "+ Select more text to add"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
            Select more words in the poem (any line) and click “+ Add selected phrase” to attach them to
            this same analysis.
          </p>
        </div>

        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            Label
          </span>
          <input
            type="text"
            maxLength={40}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                textRef.current?.focus();
              }
            }}
            placeholder="Optional — e.g. Imagery, Structure, Tone"
            className="w-full rounded-xl border border-ink-750 bg-ink-850 px-2.5 py-1.5 text-[13px] text-ink-100 outline-none transition-colors placeholder:text-ink-600 focus:border-duck-500/50 focus:ring-2 focus:ring-duck-400/20"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            Analysis
          </span>
          <textarea
            ref={textRef}
            value={text}
            spellCheck
            rows={6}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Your analysis of these words…"
            className="w-full resize-y rounded-xl border border-ink-750 bg-ink-850 px-2.5 py-2 text-[13px] leading-relaxed text-ink-100 outline-none transition-colors placeholder:text-ink-600 focus:border-duck-500/50 focus:ring-2 focus:ring-duck-400/20"
          />
          {error && <p className="mt-1 text-[11px] font-medium text-gap-400">{error}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-ink-800 px-3.5 py-2.5">
        {existing && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-gap-400 transition-colors hover:bg-rose-500/15"
          >
            Delete
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-1.5 text-xs font-medium text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-xl bg-duck-400 px-3.5 py-1.5 text-xs font-bold text-ink-950 transition-colors hover:bg-duck-300"
        >
          Save
        </button>
      </div>
    </>
  );
}

/* ── shell ───────────────────────────────────────────────────── */

export default function AnnotationPopover({ state, poem, numbers, testMode, revealed, handlers }) {
  const ref = useRef(null);

  /* Position before paint so the popover never flashes at 0,0. It is measured
     after content renders, which is why this is a layout effect. */
  useLayoutEffect(() => {
    if (state?.rect && ref.current) place(ref.current, state.rect, { align: "center" });
  });

  if (!state || !poem) return null;

  return (
    <div
      ref={ref}
      className={SHELL}
      onMouseEnter={handlers.onMouseEnter}
      onMouseLeave={handlers.onMouseLeave}
      role="dialog"
      aria-label={state.type === "edit" ? "Edit analysis" : "Analysis"}
    >
      {state.type === "view" && (
        <ViewPopover
          poem={poem}
          annotation={state.annotation}
          number={numbers[state.annotation.id]}
          testMode={testMode}
          revealed={Boolean(revealed[state.annotation.id])}
          onToggleReveal={() => handlers.onToggleReveal(state.annotation.id)}
          onEdit={() => handlers.onEdit(state.annotation)}
          onDelete={() => handlers.onDelete(state.annotation)}
          onClose={handlers.onClose}
        />
      )}
      {state.type === "choose" && (
        <ChooserPopover
          poem={poem}
          annotations={state.annotations}
          numbers={numbers}
          testMode={testMode}
          onPick={handlers.onPick}
          onHover={handlers.onHover}
          onClose={handlers.onClose}
        />
      )}
      {state.type === "edit" && (
        <EditorPopover
          poem={poem}
          existing={state.annotation}
          ranges={state.ranges}
          pendingRange={state.pendingRange}
          onAddPart={handlers.onAddPart}
          onRemovePart={handlers.onRemovePart}
          onSave={handlers.onSaveAnnotation}
          onCancel={handlers.onCancelEditor}
          onDelete={() => handlers.onDelete(state.annotation)}
        />
      )}
    </div>
  );
}

export { place, sameRange };
