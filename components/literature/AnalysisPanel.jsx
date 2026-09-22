"use client";

import { annotationLocation, annotationQuote, orderAnnotations } from "@/lib/literature";

/**
 * The analysis side panel.
 *
 * Its content deliberately differs by mode:
 *   · Normal — an INDEX. Quote, label and location only, so it works as a
 *     map of the poem without becoming a wall of text beside the poem.
 *   · Test — the recall surface. Every analysis body is blurred; clicking a
 *     card reveals or re-hides it.
 */
export default function AnalysisPanel({
  poem,
  testMode,
  revealed,
  openAnnId,
  hotIds = [],
  onCardClick,
  onCardHover,
}) {
  const ordered = poem ? orderAnnotations(poem.annotations || []) : [];
  const hot = new Set(hotIds);

  return (
    <aside className="flex w-[322px] shrink-0 flex-col border-l border-ink-800 bg-ink-900">
      <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-300">Analysis</h3>
        <span className="rounded-full border border-ink-750 bg-ink-850 px-2 py-0.5 text-[10px] font-bold tabular-nums text-ink-400">
          {ordered.length}
        </span>
      </div>

      <div
        className="flex-1 space-y-1.5 overflow-y-auto p-2"
        onMouseLeave={() => onCardHover?.([])}
      >
        {ordered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] leading-relaxed text-ink-500">
            No analysis yet. Select words in the poem and choose “Add analysis”.
          </p>
        ) : (
          ordered.map(({ ann, n }) => {
            const isRevealed = Boolean(revealed[ann.id]);
            const isOpen = openAnnId === ann.id;
            const isHot = hot.has(ann.id);
            return (
              <div
                key={ann.id}
                data-id={ann.id}
                tabIndex={0}
                role="button"
                onClick={() => onCardClick?.(ann.id)}
                onMouseEnter={() => onCardHover?.([ann.id])}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onCardClick?.(ann.id);
                  }
                }}
                className={`group cursor-pointer rounded-xl border px-2.5 py-2 transition-colors outline-none ${
                  isOpen
                    ? "border-duck-500/50 bg-ink-850"
                    : isHot
                    ? "border-ink-700 bg-ink-850"
                    : "border-ink-800 bg-ink-850/50 hover:border-ink-700 hover:bg-ink-850"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 rounded-md border border-duck-500/30 bg-duck-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-duck-300">
                    {n}
                  </span>
                  <div className="min-w-0 flex-1 font-note-serif text-[13px] leading-snug text-ink-200">
                    {annotationQuote(poem.lines, ann)}
                  </div>
                </div>

                {ann.label && (
                  <span className="mt-1.5 inline-block rounded border border-ink-750 bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    {ann.label}
                  </span>
                )}

                {/* The body is the recall target, so it only exists in Test mode. */}
                {testMode && (
                  <div
                    className={`lit-blurable mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-300 ${
                      isRevealed ? "" : "is-hidden"
                    }`}
                  >
                    {ann.text || "(no analysis written yet)"}
                  </div>
                )}

                {!testMode && (
                  <div className="mt-1.5 text-[10.5px] text-ink-500">{annotationLocation(ann)}</div>
                )}

                {testMode && (
                  <div className="mt-1.5 hidden text-[10.5px] font-semibold uppercase tracking-wide text-ink-600 group-hover:block group-focus-visible:block">
                    {isRevealed ? "Click to hide" : "Click to reveal"}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
