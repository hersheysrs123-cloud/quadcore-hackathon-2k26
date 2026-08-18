"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Search, X } from "lucide-react";
import WidgetCanvas from "@/components/WidgetCanvas";
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

// ─── 3D Visualizations Studio ─────────────────────────────────────────
// Studio for rendering interactive 3D visualizations across Physics,
// Chemistry, Biology, Computer Science, and custom Socratic Duck models.
// ─────────────────────────────────────────────────────────────────────

const viewportLoader = () => (
  <div className="flex h-full w-full items-center justify-center bg-ink-950 min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-duck-400" />
      <span className="text-[11px] uppercase tracking-wider text-ink-500">Compiling 3D scene</span>
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


export default function ThreeDView() {
  const [customWidgets, setCustomWidgets] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState(null);

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

  // Sync state to URL and localStorage (debounced)
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.set("vis", topicId);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      localStorage.setItem("socratic_last_vis_state", JSON.stringify({ topicId }));
    }, 150);
    return () => clearTimeout(timer);
  }, [topicId, isHydrated]);

  // Params live per topic, so switching away and back keeps your settings.
  const [paramsByTopic, setParamsByTopic] = useState(() =>
    Object.fromEntries(TOPICS.map((t) => [t.id, { ...t.defaults }])),
  );

  // Fetch saved 3D visualization models on mount
  useEffect(() => {
    async function loadVisualizations() {
      try {
        const res = await fetch("/api/visualizations");
        const data = await res.json();
        if (data.visualizations && data.visualizations.length > 0) {
          const formatted = data.visualizations.map((v) => ({
            id: v.id,
            title: v.title || v.concept_name || "3D Model",
            widget: v.widget_json,
          }));
          setCustomWidgets(formatted);
        }
      } catch {
        // Fallback if network/DB table not populated yet
      }
    }
    loadVisualizations();
  }, []);

  const isCustomSelected = selectedWidgetId !== null;
  const activeWidgetObj = customWidgets.find((w) => w.id === selectedWidgetId);

  const topic = TOPICS_BY_ID[topicId] || TOPICS[0];
  const params = paramsByTopic[topic.id] || topic.defaults;
  const CanvasComponent = CANVASES[topic.category];

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
        [topic.id]: { ...prev[topic.id], ...patch },
      }));
    },
    [topic.id],
  );

  const setParam = useCallback(
    (key, value) => setParams({ [key]: value }),
    [setParams],
  );

  const resetParams = useCallback(() => {
    setParamsByTopic((prev) => ({ ...prev, [topic.id]: { ...topic.defaults } }));
  }, [topic]);

  const selectTopic = useCallback((id) => {
    setTopicId(id);
    setSelectedWidgetId(null);
    setQuizOpen(false);
  }, []);

  return (
    <div className="flex flex-1 flex-col h-full w-full bg-ink-950 overflow-hidden min-h-0">
      {/* ─── Compact Studio Toolbar ──────────────────────── */}
      <header className="shrink-0 border-b border-ink-800 bg-ink-900/90 backdrop-blur-md px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Title & Dropdown Selector */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-duck-500/30 bg-duck-500/10 text-base">
              🧊
            </div>

            <div className="relative min-w-0">
              <select
                value={isCustomSelected ? `custom_${selectedWidgetId}` : topicId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith("custom_")) {
                    setSelectedWidgetId(val.replace("custom_", ""));
                  } else {
                    selectTopic(val);
                  }
                }}
                className="appearance-none rounded-lg border border-ink-700 bg-ink-850 py-1.5 pl-3 pr-8 text-xs font-semibold text-ink-100 focus:border-duck-500/50 focus:outline-none cursor-pointer truncate max-w-[260px]"
              >
                <optgroup label="Standard 3D Models">
                  {TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {CATEGORY_EMOJI[t.category]} {t.title}
                    </option>
                  ))}
                </optgroup>
                {customWidgets.length > 0 && (
                  <optgroup label="Saved Duck Models">
                    {customWidgets.map((w) => (
                      <option key={w.id} value={`custom_${w.id}`}>
                        🦆 {w.title}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            </div>

            <span className="hidden md:inline-block rounded border border-ink-800 bg-ink-850 px-2 py-0.5 text-[10px] text-ink-400 font-mono">
              {isCustomSelected ? "Saved Supabase Model" : topic.syllabus}
            </span>
          </div>

          {/* Right: Search */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative w-36 sm:w-52">
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
                className="w-full rounded-lg border border-ink-700 bg-ink-850 py-1 pl-8 pr-6 text-xs text-ink-100 placeholder:text-ink-500 focus:border-duck-500/50 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  suppressHydrationWarning
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-500 hover:text-ink-200"
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Category Quick Switch Strip ─────────────────── */}
      <div className="shrink-0 border-b border-ink-800/70 bg-ink-900/40 px-3 py-1.5 overflow-x-auto flex items-center gap-2 no-scrollbar">
        <div className="flex shrink-0 items-center gap-1.5 border-r border-ink-800 pr-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                category === cat.id
                  ? "border-duck-500/50 bg-duck-500/15 text-duck-300 shadow-sm"
                  : "border-transparent text-ink-400 hover:border-ink-800 hover:bg-ink-850 hover:text-ink-200"
              }`}
            >
              <span>{cat.emoji || "🌐"}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Filtered by the category above and the header search box — unlike
            the dropdown selector, which always lists every topic so the
            current selection never vanishes out from under it. */}
        <div className="flex items-center gap-1.5">
          {visibleTopics.map((t) => {
            const active = !isCustomSelected && topicId === t.id;
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
        <main className="relative flex-1 h-full w-full min-h-0">
          {isCustomSelected && activeWidgetObj ? (
            <div className="h-full w-full p-4 overflow-y-auto">
              <div className="mb-4 flex items-center justify-between border-b border-ink-800 pb-3">
                <h2 className="text-sm font-semibold text-ink-100">
                  {activeWidgetObj.title}
                </h2>
                <span className="rounded-full border border-duck-500/30 bg-duck-500/10 px-2.5 py-1 text-[10px] text-duck-300">
                  Saved Supabase Model
                </span>
              </div>
              <WidgetCanvas widget={activeWidgetObj.widget} />
            </div>
          ) : (
            <>
              {CanvasComponent && (
                <CanvasComponent key={topic.id} topicId={topic.id} params={params} setParam={setParam} onOpenQuiz={() => setQuizOpen(true)} />
              )}

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
            </>
          )}
        </main>
      </div>

      {quizOpen && <QuizOverlay topic={topic} onClose={() => setQuizOpen(false)} />}
    </div>
  );
}

