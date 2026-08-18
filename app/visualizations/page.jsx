"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Search, X } from "lucide-react";
import {
  QuizOverlay,
  ViewportHint,
  VisualizationHUD,
} from "@/components/visualizations/VisualizationHUD";
import {
  CATEGORIES,
  CATEGORY_EMOJI,
  TOPICS,
  TOPICS_BY_ID,
} from "@/components/visualizations/topics";

// ─── IGCSE Grade 10 · Interactive 3D Visualization Hub ──────────────
// Scenes across sciences & computer science. Every scene is a pure function
// of the params declared here, so the HUD can drive all of them from one
// schema and the canvases stay free of UI state.
// ─────────────────────────────────────────────────────────────────────

const viewportLoader = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-duck-400" />
      <span className="text-[11px] uppercase tracking-wider text-ink-500">Compiling scene</span>
    </div>
  </div>
);

const CANVASES = {
  physics: dynamic(() => import("@/components/visualizations/PhysicsCanvas"), {
    ssr: false,
    loading: viewportLoader,
  }),
  chemistry: dynamic(() => import("@/components/visualizations/ChemistryCanvas"), {
    ssr: false,
    loading: viewportLoader,
  }),
  biology: dynamic(() => import("@/components/visualizations/BiologyCanvas"), {
    ssr: false,
    loading: viewportLoader,
  }),
  cs: dynamic(() => import("@/components/visualizations/CSCanvas"), {
    ssr: false,
    loading: viewportLoader,
  }),
  math: dynamic(() => import("@/components/visualizations/MathCanvas"), {
    ssr: false,
    loading: viewportLoader,
  }),
};


// ─── Page ───────────────────────────────────────────────────────────

export default function VisualizationsPage() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState(TOPICS[0].id);
  const [quizOpen, setQuizOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from URL / LocalStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlVis = params.get("vis");
    let fallback = null;
    try { fallback = JSON.parse(localStorage.getItem("socratic_last_vis_state")); } catch(e){}

    const targetVis = urlVis || fallback?.topicId || TOPICS[0].id;
    if (TOPICS_BY_ID[targetVis]) {
       setTopicId(targetVis);
       setCategory(TOPICS_BY_ID[targetVis].category);
    }
    setIsHydrated(true);
  }, []);

  // Sync state to URL and localStorage
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("vis", topicId);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    localStorage.setItem("socratic_last_vis_state", JSON.stringify({ topicId }));
  }, [topicId, isHydrated]);

  // Params live per topic, so switching away and back keeps your settings.
  const [paramsByTopic, setParamsByTopic] = useState(() =>
    Object.fromEntries(TOPICS.map((t) => [t.id, { ...t.defaults }])),
  );

  const topic = TOPICS_BY_ID[topicId] || TOPICS[0];
  const params = (topic && paramsByTopic[topic.id]) || topic.defaults;
  const Canvas = CANVASES[topic.category];

  const visibleTopics = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return TOPICS.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!needle) return true;
      return `${t.title} ${t.blurb} ${t.syllabus} ${t.keywords}`
        .toLowerCase()
        .includes(needle);
    });
  }, [category, query]);

  /** Merge a patch of several keys at once — see ControlField's `patch`. */
  const setParams = useCallback(
    (patch) => {
      setParamsByTopic((prev) => ({
        ...prev,
        [topicId]: { ...prev[topicId], ...patch },
      }));
    },
    [topicId],
  );

  const setParam = useCallback(
    (key, value) => setParams({ [key]: value }),
    [setParams],
  );

  const resetParams = useCallback(() => {
    setParamsByTopic((prev) => ({ ...prev, [topicId]: { ...topic.defaults } }));
  }, [topicId, topic]);

  const selectTopic = useCallback((id) => {
    setTopicId(id);
    setQuizOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 lg:h-screen lg:overflow-hidden">
      {/* ─── Header ──────────────────────────────────────── */}
      <header className="shrink-0 border-b border-ink-800 bg-ink-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Workspace
          </Link>

          <div className="h-5 w-px bg-ink-800" aria-hidden="true" />

          <div className="min-w-0 flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight text-ink-100">
              Visualization Hub
            </h1>

            {/* Dropdown Topic Selector */}
            <p className="truncate text-[11px] text-ink-500">
              {TOPICS.length} interactive 3D models
            </p>
            <div className="relative min-w-0">
              <select
                value={topicId}
                onChange={(e) => selectTopic(e.target.value)}
                className="appearance-none rounded-lg border border-ink-700 bg-ink-850 py-1 pl-3 pr-8 text-xs font-semibold text-ink-100 focus:border-duck-500/50 focus:outline-none cursor-pointer truncate max-w-[260px]"
              >
                {TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {CATEGORY_EMOJI[t.category]} {t.title}
                  </option>
                ))}
              </select>
            </div>

            <span className="hidden md:inline-block rounded border border-ink-800 bg-ink-850 px-2 py-0.5 text-[10px] text-ink-400 font-mono">
              {topic.syllabus}
            </span>
          </div>

          {/* Search */}
          <div className="relative ml-auto w-full max-w-[200px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500"
              strokeWidth={2}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics…"
              aria-label="Search visualizations"
              suppressHydrationWarning
              className="w-full rounded-md border border-ink-700 bg-ink-850 py-1.5 pl-8 pr-7 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                suppressHydrationWarning
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-500 transition-colors hover:text-ink-200"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Category & Topic Quick Switch Strip ───────────────────── */}
      <div className="shrink-0 border-b border-ink-800/70 bg-ink-900/40 px-3 py-1.5 overflow-x-auto flex items-center gap-2 no-scrollbar">
        <div className="flex items-center gap-1 border-r border-ink-800 pr-2 shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                category === cat.id
                  ? "bg-duck-500/20 text-duck-300 border border-duck-500/40"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              <span>{cat.emoji || "🌐"}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {visibleTopics.map((t) => {
            const active = topic.id === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTopic(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? "border-duck-500/50 bg-duck-500/15 text-duck-300 shadow-sm"
                    : "border-transparent text-ink-400 hover:border-ink-800 hover:bg-ink-850 hover:text-ink-200"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "text-duck-300" : "text-ink-500"}`} />
                <span>{t.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col relative overflow-hidden">
        {/* Viewport + overlaid HUD */}
        <main className="relative min-h-[600px] flex-1 lg:min-h-0">
          {/* Remounting per topic gives each scene a clean WebGL context. */}
          <Canvas key={topic.id} topicId={topic.id} params={params} setParam={setParam} onOpenQuiz={() => setQuizOpen(true)} />

          {!topic.ownHud && (
            <VisualizationHUD
              topic={topic}
              params={params}
              setParam={setParam}
              setParams={setParams}
              onReset={resetParams}
              onOpenQuiz={() => setQuizOpen(true)}
            />
          )}

          <ViewportHint>drag to orbit · scroll to zoom · right-drag to pan</ViewportHint>
        </main>
      </div>

      {quizOpen && <QuizOverlay topic={topic} onClose={() => setQuizOpen(false)} />}
    </div>
  );
}
