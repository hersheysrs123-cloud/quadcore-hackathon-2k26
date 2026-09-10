"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Search, X } from "lucide-react";
import {
  ViewportHint,
  VisualizationHUD,
} from "@/components/visualizations/VisualizationHUD";
import {
  CATEGORY_EMOJI,
  TOPICS,
  TOPICS_BY_ID,
  formatTopicStudyContext,
} from "@/components/visualizations/topics";
import TopicSelectorDropdown from "@/components/visualizations/TopicSelectorDropdown";
import { CANVAS_BG } from "@/components/visualizations/scene-kit";

// ─── 3D Visualizations Studio ─────────────────────────────────────────
// Studio for rendering interactive 3D visualizations across Physics,
// Chemistry, Biology, Computer Science, and Mathematics.
// ─────────────────────────────────────────────────────────────────────

const viewportLoader = () => (
  <div className="flex h-full w-full items-center justify-center min-h-[400px]" style={{ backgroundColor: CANVAS_BG }}>
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


export default function ThreeDView({ hideTopBars = false, onToggleTopBars, onStudyTopic }) {
  const [topicId, setTopicId] = useState(TOPICS[0].id);
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

  const topic = TOPICS_BY_ID[topicId] || TOPICS[0];
  const params = paramsByTopic[topic.id] || topic.defaults;
  const CanvasComponent = CANVASES[topic.category];

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
  }, []);

  const handleOpenStudy = useCallback(
    (targetTopic, targetParams) => {
      const t = targetTopic || topic;
      const p = targetParams || params;
      const studyContext = formatTopicStudyContext(t, p);

      if (onStudyTopic) {
        onStudyTopic(studyContext, "explain");
      }
    },
    [topic, params, onStudyTopic],
  );

  return (
    <div className="flex flex-1 flex-col h-full w-full bg-ink-950 overflow-hidden min-h-0">
      {/* ─── Compact Studio Toolbar (Hidden in Fullscreen Focus Mode) ─ */}
      {!hideTopBars && (
        <header className="shrink-0 border-b border-ink-800 bg-ink-900 px-4 py-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Title & Dropdown Selector */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-duck-500/30 bg-duck-500/10 text-base shadow-inner">
                🧊
              </div>

              <TopicSelectorDropdown
                currentTopicId={topicId}
                onSelectTopic={selectTopic}
              />

              <span className="hidden md:inline-block rounded-lg border border-ink-800 bg-ink-850 px-2.5 py-1 text-[11px] text-ink-400 font-mono shrink-0">
                {topic.syllabus}
              </span>
            </div>

            {/* Right: Model Count */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-ink-500 hidden sm:inline">
                {TOPICS.length} models
              </span>
            </div>
          </div>
        </header>
      )}

      {/* ─── Body ────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col relative overflow-hidden">
        {/* Floating Reopen Button (ONLY displayed when top bars are hidden) */}
        {hideTopBars && onToggleTopBars && (
          <div className="absolute top-3 right-3 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={onToggleTopBars}
              className="flex items-center gap-1.5 rounded-lg border border-duck-500/50 bg-duck-500/20 px-2.5 py-1 text-xs font-semibold text-duck-300 hover:bg-duck-500/30 transition-all shadow-sm ring-1 ring-duck-400/20 whitespace-nowrap cursor-pointer"
              title="Show all top bars"
            >
              <ChevronDown className="h-3.5 w-3.5 text-duck-400 shrink-0" />
              <span className="whitespace-nowrap">Show top bars</span>
            </button>
          </div>
        )}
        {/* Viewport + overlaid HUD */}
        <main className="relative flex-1 h-full w-full min-h-0" style={{ backgroundColor: CANVAS_BG }}>
          {CanvasComponent && (
            <CanvasComponent key={topic.id} topicId={topic.id} params={params} setParam={setParam} onOpenQuiz={handleOpenStudy} />
          )}

          {!topic.ownHud && (
            <VisualizationHUD
              topic={topic}
              params={params}
              setParam={setParam}
              setParams={setParams}
              onReset={resetParams}
              onOpenQuiz={handleOpenStudy}
            />
          )}

          <ViewportHint>drag to orbit · scroll to zoom · right-drag to pan</ViewportHint>
        </main>
      </div>
    </div>
  );
}

