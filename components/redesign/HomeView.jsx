"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowRight,
  BarChart3,
  Box,
  CalendarDays,
  Check,
  FileText,
  Plus,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { STATUS, relativeTime, summariseMastery } from "@/lib/mastery";
import { CATEGORY_EMOJI, TOPICS_BY_ID } from "@/components/visualizations/topics";
import GlobalTimerHUD from "@/components/GlobalTimerHUD";

const FEATURED_3D = ["projectile", "bohr", "cell", "binary_tree"];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Card({ title, icon: Icon, action, children, className = "" }) {
  return (
    <section className={`flex flex-col rounded-2xl border border-ink-800 bg-ink-900 ${className}`}>
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
          {Icon && <Icon className="h-4 w-4 text-ink-500" />}
          {title}
        </h2>
        {action}
      </header>
      <div className="px-5 pb-5 pt-3">{children}</div>
    </section>
  );
}

function LinkButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-xs font-medium text-ink-400 transition-colors hover:text-duck-400"
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </button>
  );
}

/**
 * The first screen a user lands on. Answers three questions in one glance:
 * where was I, what should I revise, and what can I do here.
 */
export default function HomeView({
  activeSpace,
  notes = [],
  sessions = [],
  mounted = false,
  onOpenNote,
  onCreateNote,
  onOpenInstantNote,
  onExplainNote,
  onQuizNote,
  onNavigate,
  onOpen3D,
  onStartTutorial,
}) {
  const spaceNotes = useMemo(() => notes.filter((n) => (n.space || n.spaceId) === activeSpace), [notes, activeSpace]);
  const recent = useMemo(
    () =>
      [...spaceNotes]
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, 4),
    [spaceNotes]
  );

  const spaceSessions = useMemo(
    () => sessions.filter((s) => (s.space || "School") === activeSpace),
    [sessions, activeSpace]
  );
  const mastery = useMemo(() => summariseMastery(spaceSessions), [spaceSessions]);
  const toRevise = useMemo(
    () => [...mastery.weaknesses, ...mastery.topics.filter((t) => t.status === "yellow")].slice(0, 5),
    [mastery]
  );

  const todayEvents = useLiveQuery(async () => {
    try {
      const all = await db.calendarEvents.where("date").equals(todayKey()).toArray();
      return all.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    } catch {
      return [];
    }
  }, []);

  const quizCount = useLiveQuery(async () => {
    try {
      return await db.quizzes.where("spaceId").equals(activeSpace).count();
    } catch {
      return 0;
    }
  }, [activeSpace]);

  const steps = [
    { label: "Open a note and read it", done: spaceNotes.length > 0, action: () => recent[0] && onOpenNote?.(recent[0]) },
    { label: "Have the Duck explain it", done: false, action: () => recent[0] && onExplainNote?.(recent[0]) },
    { label: "Take your first quiz", done: sessions.length > 0, action: () => recent[0] && onQuizNote?.(recent[0]) },
  ];
  const showOnboarding = sessions.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-8 sm:px-10">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-500">
            {mounted
              ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
              : " "}
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-ink-100 sm:text-[32px]">
            {greeting()}.
          </h1>
          <p className="mt-1.5 text-sm text-ink-400">
            <span className="font-medium text-ink-200">{activeSpace}</span> · {spaceNotes.length}{" "}
            {spaceNotes.length === 1 ? "note" : "notes"} · {quizCount ?? 0} {quizCount === 1 ? "quiz" : "quizzes"} ·{" "}
            {spaceSessions.length} graded {spaceSessions.length === 1 ? "session" : "sessions"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenInstantNote}
            className="flex items-center gap-2 rounded-xl border border-ink-800 bg-ink-900 px-3.5 py-2 text-sm font-medium text-ink-200 transition-colors hover:border-ink-700 hover:bg-ink-850"
          >
            <Zap className="h-4 w-4 text-duck-400" /> Quick capture
          </button>
          <button
            type="button"
            onClick={onCreateNote}
            className="flex items-center gap-2 rounded-xl bg-duck-400 px-3.5 py-2 text-sm font-semibold text-ink-950 shadow-sm transition-colors hover:bg-duck-300"
          >
            <Plus className="h-4 w-4" /> New note
          </button>
        </div>
      </div>

      {/* Onboarding — only until the first graded session */}
      {showOnboarding && (
        <section className="mt-8 rounded-2xl border border-duck-500/30 bg-duck-500/[0.06] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-100">The study loop, in three steps</h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-400">
                Rereading is not studying. Read a note, have it explained, then let the Duck grade what you can actually
                explain back. Each graded sub-topic lands on your mastery map.
              </p>
            </div>
            <button type="button" onClick={onStartTutorial} className="text-xs font-medium text-duck-400 hover:text-duck-300">
              Take the guided tour
            </button>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={s.action}
                  className="flex w-full items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 px-3.5 py-3 text-left transition-colors hover:border-duck-500/40"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      s.done ? "bg-solid-500 text-white" : "bg-ink-800 text-ink-300"
                    }`}
                  >
                    {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={`text-[13px] font-medium ${s.done ? "text-ink-400 line-through" : "text-ink-100"}`}>
                    {s.label}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-5">
        {/* Continue */}
        <Card
          title="Pick up where you left off"
          icon={FileText}
          className="lg:col-span-3"
          action={<LinkButton onClick={() => onNavigate?.("notes")}>All notes</LinkButton>}
        >
          {recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center">
              <p className="text-sm font-medium text-ink-200">Nothing here yet</p>
              <p className="mt-1 text-xs text-ink-500">Create your first note in {activeSpace}.</p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-800">
              {recent.map((n) => (
                <li key={n.id} className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => onOpenNote?.(n)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-850 text-lg">
                      {n.emoji || "📝"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-100 group-hover:text-duck-300">
                        {n.title || "Untitled Note"}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {mounted && n.updatedAt ? `Edited ${relativeTime(n.updatedAt)}` : " "}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => onExplainNote?.(n)}
                      title="Explain"
                      className="rounded-lg border border-ink-800 p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuizNote?.(n)}
                      className="rounded-lg bg-duck-400 px-2.5 py-1.5 text-xs font-semibold text-ink-950 hover:bg-duck-300"
                    >
                      Quiz me
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Revise */}
        <Card
          title="Worth revising"
          icon={BarChart3}
          className="lg:col-span-2"
          action={<LinkButton onClick={() => onNavigate?.("mastery")}>Mastery map</LinkButton>}
        >
          {toRevise.length === 0 ? (
            <div className="rounded-xl bg-ink-850 px-4 py-5 text-center">
              <p className="text-sm font-medium text-ink-200">No gaps found yet</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Take a quiz and every shaky sub-topic shows up here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {toRevise.map((t) => {
                const st = STATUS[t.status] || STATUS.yellow;
                return (
                  <li key={t.subtopic}>
                    <button
                      type="button"
                      onClick={() => {
                        const note = notes.find((n) => n.id === t.noteId);
                        if (note) onQuizNote?.(note);
                        else onNavigate?.("mastery");
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs ${st.chip} transition-opacity hover:opacity-80`}
                      title={t.feedback || t.subtopic}
                    >
                      <span aria-hidden="true">{st.shape}</span>
                      <span className="truncate font-medium">{t.subtopic}</span>
                      <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider opacity-80">{st.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Today */}
        <Card
          title="Today"
          icon={CalendarDays}
          className="lg:col-span-2"
          action={<LinkButton onClick={() => onNavigate?.("calendar")}>Calendar</LinkButton>}
        >
          <div className="space-y-3">
            <GlobalTimerHUD onNavigateCalendar={() => onNavigate?.("calendar")} />
            {!todayEvents || todayEvents.length === 0 ? (
              <p className="text-xs text-ink-500">No events scheduled for today.</p>
            ) : (
              <ul className="space-y-1">
                {todayEvents.slice(0, 4).map((ev) => (
                  <li key={ev.id} className="flex items-center gap-3 rounded-lg bg-ink-850 px-3 py-2 text-xs">
                    <span className="font-mono text-ink-400">{ev.time || "—"}</span>
                    <span className="truncate font-medium text-ink-100">{ev.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Quizzes */}
        <Card
          title="Quizzes"
          icon={Target}
          className="lg:col-span-3"
          action={<LinkButton onClick={() => onNavigate?.("quizzes")}>Quiz Studio</LinkButton>}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-ink-100">{quizCount ?? 0}</span>
              <span className="text-sm text-ink-500">saved in {activeSpace}</span>
            </div>
            <div className="h-8 w-px bg-ink-800" aria-hidden="true" />
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-ink-100">
                {mastery.averageScore === null ? "–" : `${mastery.averageScore}%`}
              </span>
              <span className="text-sm text-ink-500">average score</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("quizzes")}
              className="ml-auto flex items-center gap-2 rounded-xl border border-ink-800 px-3.5 py-2 text-sm font-medium text-ink-200 transition-colors hover:border-ink-700 hover:bg-ink-850"
            >
              <Plus className="h-4 w-4" /> Create a quiz
            </button>
          </div>
        </Card>
      </div>

      {/* 3D Lab */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
            <Box className="h-4 w-4 text-ink-500" /> Explore in 3D
          </h2>
          <LinkButton onClick={() => onNavigate?.("3d")}>All 51 models</LinkButton>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_3D.map((id) => {
            const t = TOPICS_BY_ID[id];
            if (!t) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onOpen3D?.(id)}
                className="group flex flex-col rounded-2xl border border-ink-800 bg-ink-900 p-4 text-left transition-colors hover:border-duck-500/40 hover:bg-ink-850"
              >
                <span className="text-2xl">{CATEGORY_EMOJI[t.category]}</span>
                <span className="mt-3 text-[13px] font-semibold leading-snug text-ink-100 group-hover:text-duck-300">
                  {t.title}
                </span>
                <span className="mt-1 text-[11px] text-ink-500">{t.syllabus}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
