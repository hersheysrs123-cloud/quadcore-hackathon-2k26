"use client";

const STATUS_STYLES = {
  green: {
    dot: "bg-emerald-400",
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    label: "Solid",
  },
  yellow: {
    dot: "bg-amber-400",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    label: "Shaky",
  },
  red: {
    dot: "bg-rose-400",
    chip: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    label: "Gap",
  },
};

function scoreTone(score) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

/**
 * Renders the final-turn diagnostic: score, two-sentence summary, and the
 * per-subtopic confidence heatmap.
 */
export default function ConfidenceHeatmap({ diagnostic }) {
  if (!diagnostic) return null;

  const { score, summary, heatmap } = diagnostic;
  const counts = heatmap.reduce(
    (acc, entry) => ({ ...acc, [entry.status]: (acc[entry.status] ?? 0) + 1 }),
    {},
  );

  return (
    <section className="border-b border-ink-800 px-5 py-5">
      <div className="mb-4 flex items-baseline gap-3">
        <span className={`text-3xl font-semibold tabular-nums ${scoreTone(score)}`}>
          {score}
        </span>
        <span className="text-xs text-ink-500">/ 100</span>
        <div className="ml-auto flex gap-1.5">
          {["green", "yellow", "red"].map((status) =>
            counts[status] ? (
              <span
                key={status}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status].chip}`}
              >
                {counts[status]} {STATUS_STYLES[status].label.toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* Proportional bar — one segment per heatmap entry, in order. */}
      <div className="mb-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        {heatmap.map((entry, i) => (
          <div
            key={`${entry.subtopic}-${i}`}
            className={`flex-1 ${STATUS_STYLES[entry.status].dot}`}
            title={`${entry.subtopic}: ${STATUS_STYLES[entry.status].label}`}
          />
        ))}
      </div>

      <p className="mb-4 text-sm leading-relaxed text-ink-200">{summary}</p>

      <ul className="space-y-2.5">
        {heatmap.map((entry, i) => {
          const style = STATUS_STYLES[entry.status];
          return (
            <li
              key={`${entry.subtopic}-${i}`}
              className="flex gap-2.5 rounded-lg border border-ink-800 bg-ink-850 px-3 py-2.5"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-100">
                  {entry.subtopic}
                  <span className="sr-only"> — {style.label}</span>
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
