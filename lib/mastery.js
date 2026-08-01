/**
 * One vocabulary for mastery status, shared by every surface that renders it:
 * the per-session heatmap, the quiz results, and the mastery dashboard.
 *
 * The `shape` field is not decoration. Colour alone must never be the only
 * carrier of meaning, so each status also gets a distinct glyph, and the three
 * glyphs form an ordinal ramp (filled -> half -> hollow) that survives
 * greyscale, colour-blindness and a 12px cell. Every place that paints a status
 * colour must also render `shape` or `label`.
 */

export const STATUS_ORDER = ["green", "yellow", "red"];

export const STATUS = {
  green: {
    key: "green",
    label: "Solid",
    shape: "●",
    blurb: "Explained the mechanism unprompted",
    text: "text-solid-500",
    fill: "bg-solid-500",
    soft: "bg-solid-500/10",
    ring: "border-solid-500/40",
    chip: "border-solid-500/40 bg-solid-500/10 text-solid-500",
  },
  yellow: {
    key: "yellow",
    label: "Shaky",
    shape: "◐",
    blurb: "Right, but recited or needed leading",
    text: "text-shaky-500",
    fill: "bg-shaky-500",
    soft: "bg-shaky-500/10",
    ring: "border-shaky-500/40",
    chip: "border-shaky-500/40 bg-shaky-500/10 text-shaky-500",
  },
  red: {
    key: "red",
    label: "Gap",
    shape: "○",
    blurb: "Wrong, absent, or collapsed on a follow-up",
    text: "text-gap-500",
    fill: "bg-gap-500",
    soft: "bg-gap-500/10",
    ring: "border-gap-500/40",
    chip: "border-gap-500/40 bg-gap-500/10 text-gap-500",
  },
};

/** Never returns undefined — an unknown status renders as Shaky, not as a crash. */
export const statusOf = (key) => STATUS[key] ?? STATUS.yellow;

/** Score colour follows the same three-step scale as the statuses. */
export function scoreStatus(score) {
  if (score >= 70) return STATUS.green;
  if (score >= 40) return STATUS.yellow;
  return STATUS.red;
}

const TIME_UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/**
 * "2 days ago" — relative dates read better than timestamps in a study log.
 *
 * Reads the clock, so it must only ever be called from a component that has
 * already mounted (the `mounted` guard described in CODEBASE_SUMMARY.md).
 * Calling it during the server render would let the two passes disagree about
 * how long ago "just now" was.
 */
export function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";

  for (const [label, size] of TIME_UNITS) {
    if (seconds >= size) {
      const value = Math.floor(seconds / size);
      return `${value} ${label}${value === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

// ─── Session rollup ──────────────────────────────────────────────────

const STATUS_WEIGHT = { green: 1, yellow: 0.5, red: 0 };

/**
 * Rolls every graded session's heatmap up into one topic-level view.
 *
 * A topic probed in several sessions is scored on the most recent evidence but
 * keeps its full history, because "was a gap twice, now shaky" is the
 * interesting shape and an average would erase it.
 *
 * Both quiz modes emit the same { subtopic, status, feedback } entries, which
 * is what lets this treat them as one dataset.
 */
export function summariseMastery(sessions) {
  const byTopic = new Map();

  // Oldest first, so the last write per topic is the newest evidence.
  const chronological = [...(sessions ?? [])].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );

  for (const session of chronological) {
    for (const entry of session.heatmap ?? []) {
      const key = entry.subtopic?.trim();
      if (!key) continue;

      const existing = byTopic.get(key) ?? { subtopic: key, history: [] };

      existing.history.push({
        status: entry.status,
        feedback: entry.feedback,
        at: session.createdAt,
        mode: session.mode,
      });
      existing.status = entry.status;
      existing.feedback = entry.feedback;
      existing.lastSeen = session.createdAt;
      existing.noteId = session.noteId;
      existing.noteTitle = session.noteTitle;
      existing.space = session.space;

      byTopic.set(key, existing);
    }
  }

  const topics = [...byTopic.values()].map((topic) => {
    const scores = topic.history.map((h) => STATUS_WEIGHT[h.status] ?? 0.5);
    const strength = scores.at(-1);
    const previous = scores.length > 1 ? scores.at(-2) : null;

    return {
      ...topic,
      timesSeen: topic.history.length,
      strength,
      // null on a first encounter — "no change" and "never measured" are
      // different things and the dashboard shows them differently.
      trend: previous === null ? null : strength - previous,
    };
  });

  const counts = { green: 0, yellow: 0, red: 0 };
  for (const topic of topics) counts[topic.status] = (counts[topic.status] ?? 0) + 1;

  const scored = (sessions ?? []).filter((s) => Number.isFinite(s.score));
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
    : null;

  return {
    topics: topics.sort(
      (a, b) => a.strength - b.strength || a.subtopic.localeCompare(b.subtopic),
    ),
    counts,
    totalTopics: topics.length,
    sessionCount: (sessions ?? []).length,
    averageScore,
    strengths: topics.filter((t) => t.status === "green"),
    weaknesses: topics.filter((t) => t.status === "red"),
  };
}
