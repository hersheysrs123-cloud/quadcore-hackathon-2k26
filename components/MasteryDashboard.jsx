"use client";

import { useMemo } from "react";
import ScoreRing from "@/components/ScoreRing";
import {
  STATUS,
  STATUS_ORDER,
  relativeTime,
  statusOf,
  summariseMastery,
} from "@/lib/mastery";

/**
 * Every graded session, rolled up into one picture of what the learner holds
 * and what they don't.
 *
 * Three views of the same data, deliberately: the strip is the glance, the
 * focus list is the read, and the log is the history. A topic's colour, its
 * glyph and its written status all say the same thing, so no single channel is
 * load-bearing.
 */
export default function MasteryDashboard({
  sessions,
  notes,
  onOpenNote,
  onStudy,
  onClearSessions,
  // Timestamps read the clock, so they wait for the client — the `mounted`
  // guard the rest of the workspace uses.
  mounted = false,
}) {
  const hydrated = mounted;
  const mastery = useMemo(() => summariseMastery(sessions), [sessions]);

  const byNote = useMemo(() => {
    const groups = new Map();
    for (const topic of mastery.topics) {
      const key = topic.noteId ?? "unfiled";
      const group = groups.get(key) ?? {
        noteId: topic.noteId,
        title: topic.noteTitle || "Unfiled",
        topics: [],
      };
      group.topics.push(topic);
      groups.set(key, group);
    }
    // Weakest notes first — this page exists to tell you where to go next.
    return [...groups.values()].sort(
      (a, b) => average(a.topics) - average(b.topics),
    );
  }, [mastery.topics]);

  if (mastery.sessionCount === 0) {
    return <EmptyState notes={notes} onStudy={onStudy} />;
  }

  return (
    <div className="mx-auto max-w-4xl px-10 pb-24 pt-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-ink-100">
            Mastery
          </h1>
          <p className="mt-1.5 text-sm text-ink-400">
            Built from {mastery.sessionCount} graded{" "}
            {mastery.sessionCount === 1 ? "session" : "sessions"} across{" "}
            {byNote.length} {byNote.length === 1 ? "note" : "notes"}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.confirm("Are you sure you want to clear your study sessions history and mastery data? This cannot be undone.")) {
              onClearSessions?.();
            }
          }}
          className="rounded-lg border border-ink-800 px-3 py-1.5 text-xs text-ink-500 transition-colors hover:border-gap-500/40 hover:text-gap-500"
        >
          Clear history
        </button>
      </header>

      {/* Stat row */}
      <section className="mb-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 flex items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900 px-5 py-4 sm:col-span-1">
          <ScoreRing score={mastery.averageScore ?? 0} size="sm" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-ink-500">
              Average
            </p>
            <p className="text-xs text-ink-400">across all sessions</p>
          </div>
        </div>

        {STATUS_ORDER.map((key) => (
          <StatTile
            key={key}
            status={STATUS[key]}
            count={mastery.counts[key] ?? 0}
            total={mastery.totalTopics}
          />
        ))}
      </section>

      {/* The heatmap */}
      <section className="mb-9">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-100">
            Topic heatmap
          </h2>
          <Legend />
        </div>

        <div className="space-y-2.5">
          {byNote.map((group) => (
            <div
              key={group.noteId ?? "unfiled"}
              className="rounded-2xl border border-ink-800 bg-ink-900 px-4 py-3.5"
            >
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <button
                  type="button"
                  onClick={() => group.noteId && onOpenNote(group.noteId)}
                  disabled={!group.noteId}
                  className="min-w-0 truncate text-left text-[13px] font-medium text-ink-200 transition-colors hover:text-duck-300 disabled:hover:text-ink-200"
                >
                  {group.title}
                </button>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-600">
                  {group.topics.length}{" "}
                  {group.topics.length === 1 ? "topic" : "topics"}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {group.topics.map((topic) => (
                  <Cell key={topic.subtopic} topic={topic} onStudy={onStudy} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Focus list — the table view of the same data */}
      {mastery.topics.length > 0 && (
        <section className="mb-9">
          <h2 className="mb-1 text-sm font-semibold text-ink-100">
            What to study next
          </h2>
          <p className="mb-3 text-xs text-ink-500">
            Weakest first. Every line is something a session actually caught.
          </p>

          <ul className="space-y-2">
            {mastery.topics.slice(0, 8).map((topic) => {
              const status = statusOf(topic.status);
              return (
                <li
                  key={topic.subtopic}
                  className="flex flex-wrap items-start gap-3 rounded-xl border border-ink-800 bg-ink-900 px-4 py-3"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 text-sm ${status.text}`}
                  >
                    {status.shape}
                  </span>

                  <div className="min-w-[12rem] flex-1">
                    <p className="flex flex-wrap items-baseline gap-2 text-[13px] font-medium text-ink-100">
                      {topic.subtopic}
                      <span className={`text-[10px] font-normal ${status.text}`}>
                        {status.label}
                      </span>
                      <Trend topic={topic} />
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-400">
                      {topic.feedback}
                    </p>
                    <p className="mt-1 text-[10px] text-ink-600">
                      {topic.noteTitle} · seen {topic.timesSeen}×
                      {hydrated && topic.lastSeen
                        ? ` · ${relativeTime(topic.lastSeen)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onStudy(topic, "explain")}
                      className="rounded-lg border border-ink-700 px-2.5 py-1.5 text-[11px] text-ink-300 transition-colors hover:border-duck-500/50 hover:text-duck-300"
                    >
                      ✨ Explain
                    </button>
                    <button
                      type="button"
                      onClick={() => onStudy(topic, "quiz")}
                      className="rounded-lg border border-ink-700 px-2.5 py-1.5 text-[11px] text-ink-300 transition-colors hover:border-duck-500/50 hover:text-duck-300"
                    >
                      🦆 Retest
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Session log */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-100">Session log</h2>
        <ul className="space-y-1.5">
          {sessions.slice(0, 10).map((session) => (
            <li
              key={session.id}
              className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 px-4 py-2.5"
            >
              <span
                aria-hidden="true"
                className="text-sm"
                title={session.mode === "quiz" ? "Quick quiz" : "Socratic session"}
              >
                {session.mode === "quiz" ? "📋" : "🦆"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-200">
                {session.concept}
              </span>
              {hydrated && (
                <span className="shrink-0 text-[11px] text-ink-600">
                  {relativeTime(session.createdAt)}
                </span>
              )}
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  statusOf(
                    session.score >= 70 ? "green" : session.score >= 40 ? "yellow" : "red",
                  ).text
                }`}
              >
                {session.score}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const average = (topics) =>
  topics.reduce((sum, t) => sum + t.strength, 0) / Math.max(1, topics.length);

function StatTile({ status, count, total }) {
  const share = total ? Math.round((count / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 px-4 py-4">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-500">
        <span aria-hidden="true" className={status.text}>
          {status.shape}
        </span>
        {status.label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${status.text}`}>
        {count}
      </p>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-ink-800"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full ${status.fill}`}
          style={{ width: `${share}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-ink-600">
        {share}% of tracked topics
      </p>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-3">
      {STATUS_ORDER.map((key) => (
        <li
          key={key}
          className="flex items-center gap-1.5 text-[11px] text-ink-500"
        >
          <span aria-hidden="true" className={STATUS[key].text}>
            {STATUS[key].shape}
          </span>
          <span>{STATUS[key].label}</span>
        </li>
      ))}
    </ul>
  );
}

/** One heatmap cell, with the detail on hover and focus. */
function Cell({ topic, onStudy }) {
  const status = statusOf(topic.status);

  return (
    <span className="group/cell relative">
      <button
        type="button"
        onClick={() => onStudy?.(topic, "explain")}
        title="Click to explain this topic with AI"
        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-all ${status.chip} hover:scale-[1.02] hover:brightness-125 focus:outline-none focus:ring-1 focus:ring-duck-400`}
      >
        <span aria-hidden="true">{status.shape}</span>
        <span className="max-w-[11rem] truncate font-medium">{topic.subtopic}</span>
        {topic.timesSeen > 1 && (
          <span className="tabular-nums opacity-60">×{topic.timesSeen}</span>
        )}
      </button>

      <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 hidden w-60 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-[11px] leading-relaxed text-ink-300 shadow-xl group-hover/cell:block group-focus-within/cell:block">
        <span className={`block font-medium ${status.text}`}>
          {status.label} — {status.blurb}
        </span>
        <span className="mt-1 block">{topic.feedback}</span>
        <span className="mt-1.5 block text-[9px] text-duck-400 font-medium">Click to Explain →</span>
      </span>
    </span>
  );
}

function Trend({ topic }) {
  if (topic.trend === null || topic.trend === 0) return null;

  const improving = topic.trend > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-normal ${
        improving ? "text-solid-500" : "text-gap-500"
      }`}
    >
      <span aria-hidden="true">{improving ? "↑" : "↓"}</span>
      {improving ? "improving" : "slipped"}
    </span>
  );
}

// ─── Empty state ────────────────────────────────────────────────────
function EmptyState({ notes, onStudy }) {
  const suggestions = notes.slice(0, 3);

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-10 py-16">
      <div className="animate-fade-up">
        <div
          aria-hidden="true"
          className="mb-6 flex gap-1.5"
          title="Solid, shaky and gap"
        >
          {["green", "yellow", "green", "red", "yellow", "green", "red", "green"].map(
            (key, i) => (
              <span
                key={i}
                className={`h-8 flex-1 rounded-md opacity-25 ${STATUS[key].fill}`}
              />
            ),
          )}
        </div>

        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-ink-100">
          Your mastery map is empty
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-400">
          Every time the Duck quizzes you, it grades each sub-topic separately
          and drops the result here. After a few sessions this page becomes the
          honest answer to “what should I revise?” — not what you read most, but
          what you couldn’t explain.
        </p>

        {suggestions.length > 0 ? (
          <div className="mt-8">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-500">
              Start with a note
            </p>
            <ul className="space-y-2">
              {suggestions.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => onStudy({ noteId: note.id }, "quiz")}
                    className="flex w-full items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 px-4 py-3 text-left transition-colors hover:border-duck-500/40"
                  >
                    <span className="text-lg leading-none">{note.emoji || "📝"}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-200">
                      {note.title || "Untitled Note"}
                    </span>
                    <span className="shrink-0 text-xs text-ink-500 font-medium">
                      Quiz me →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => onStudy?.({}, "quiz")}
              className="inline-flex items-center gap-2 rounded-xl bg-duck-400 px-4 py-2.5 text-xs font-bold text-ink-950 shadow-md hover:bg-duck-300 transition-colors"
            >
              <span>🦆</span>
              <span>Start a Socratic Drill</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
