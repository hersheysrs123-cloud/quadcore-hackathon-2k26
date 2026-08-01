"use client";

import { STATUS, STATUS_ORDER, statusOf } from "@/lib/mastery";

/**
 * The per-session heatmap: one row per sub-topic the session actually probed.
 *
 * Status is carried by three channels at once — colour, a glyph that forms an
 * ordinal ramp (● filled / ◐ half / ○ hollow), and a word. Any one of them is
 * enough on its own, which is what keeps this readable in greyscale, at a
 * glance, and for a colour-blind reader.
 */
export default function ConfidenceHeatmap({ diagnostic }) {
  if (!diagnostic?.heatmap?.length) return null;

  const { summary, heatmap } = diagnostic;

  const counts = heatmap.reduce(
    (acc, entry) => ({ ...acc, [entry.status]: (acc[entry.status] ?? 0) + 1 }),
    {},
  );

  return (
    <section className="border-b border-ink-800 px-5 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Confidence heatmap
        </p>
        <div className="flex flex-wrap justify-end gap-1.5">
          {STATUS_ORDER.map((key) =>
            counts[key] ? (
              <span
                key={key}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS[key].chip}`}
              >
                <span aria-hidden="true">{STATUS[key].shape}</span>{" "}
                {counts[key]} {STATUS[key].label.toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* One segment per sub-topic, in the order they were probed. A 2px gap
          between segments keeps adjacent same-status cells countable. */}
      <div className="mb-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        {heatmap.map((entry, i) => (
          <div
            key={`${entry.subtopic}-${i}`}
            className={`flex-1 ${statusOf(entry.status).fill}`}
            title={`${entry.subtopic}: ${statusOf(entry.status).label}`}
          />
        ))}
      </div>

      {summary && (
        <p className="mb-4 text-[13px] leading-relaxed text-ink-200">{summary}</p>
      )}

      <ul className="space-y-2">
        {heatmap.map((entry, i) => {
          const status = statusOf(entry.status);
          return (
            <li
              key={`${entry.subtopic}-${i}`}
              className={`flex gap-3 rounded-xl border border-ink-800 bg-ink-850 px-3.5 py-2.5 transition-colors hover:border-ink-700`}
            >
              <span
                aria-hidden="true"
                className={`mt-px text-sm leading-snug ${status.text}`}
              >
                {status.shape}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-[13px] font-medium text-ink-100">
                  <span className="min-w-0 truncate">{entry.subtopic}</span>
                  <span className={`shrink-0 text-[10px] font-normal ${status.text}`}>
                    {status.label}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-400">
                  {entry.feedback}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
