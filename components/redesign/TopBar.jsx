"use client";

import { ChevronLeft, ChevronRight, GraduationCap, Maximize2, PanelLeft, Sparkles } from "lucide-react";

const SECTION_TITLES = {
  home: "Home",
  quizzes: "Quiz Studio",
  mastery: "Mastery",
  calendar: "Calendar",
  "3d": "3D Lab",
  websaver: "Saved links",
};

/**
 * The quiet top bar. Left: where you are. Right: the one thing this product
 * is about — study this with AI — plus the page menu and focus mode.
 */
export default function TopBar({
  activeTab,
  activeSpace,
  breadcrumbPath = [],
  activeNote,
  onSelectNote,
  onOpenSpaceHub,
  showPanelToggle = false,
  panelOpen = true,
  onTogglePanel,
  historyState = {},
  onBack,
  onForward,
  saveStatus = "",
  studyKind = null,
  onExplain,
  onQuiz,
  onTutor,
  noteMenu = null,
  onToggleZen,
}) {
  const isNotes = activeTab === "notes";
  const canStudyNote = Boolean(activeNote);

  const crumbs = (() => {
    if (activeTab === "spacehub") return [{ id: "__space", label: activeSpace, emoji: "📂" }, { id: "__hub", label: "Space settings" }];
    if (!isNotes) return [{ id: "__section", label: SECTION_TITLES[activeTab] || "Workspace" }];
    const path = breadcrumbPath.length > 0 ? breadcrumbPath : activeNote ? [activeNote] : [];
    const noteCrumbs = path.map((n) => ({ id: n.id, label: n.title || "Untitled Note", emoji: n.emoji || "📝", note: n }));
    return [{ id: "__space", label: activeSpace, emoji: "📂", onClick: onOpenSpaceHub }, ...noteCrumbs];
  })();

  // Long chains keep the first and last two crumbs; the middle collapses.
  const MAX = 4;
  const collapsed = crumbs.length > MAX;
  const hidden = collapsed ? crumbs.slice(1, crumbs.length - 2) : [];
  const visible = collapsed ? [crumbs[0], { id: "__more", label: "…", hiddenTitles: hidden.map((h) => h.label) }, ...crumbs.slice(-2)] : crumbs;

  return (
    <header className="no-print relative z-[60] flex h-13 shrink-0 items-center gap-2 border-b border-ink-800 bg-ink-900/95 px-3 backdrop-blur sm:px-4">
      {/* Left: wayfinding */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {showPanelToggle && (
          <button
            type="button"
            onClick={onTogglePanel}
            title={panelOpen ? "Hide notes panel" : "Show notes panel"}
            className={`rounded-lg p-1.5 transition-colors hover:bg-ink-800 hover:text-ink-100 ${panelOpen ? "text-ink-400" : "text-duck-400"}`}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onBack}
            disabled={!historyState.canGoBack}
            title="Back (Alt+←)"
            className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onForward}
            disabled={!historyState.canGoForward}
            title="Forward (Alt+→)"
            className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Breadcrumb" data-testid="note-breadcrumb" className="ml-1 flex min-w-0 items-center gap-1 text-[13px]">
          {visible.map((c, i) => {
            const last = i === visible.length - 1;
            const clickable = !last && (c.onClick || c.note);
            const inner = (
              <>
                {c.emoji && <span className="shrink-0 text-sm leading-none">{c.emoji}</span>}
                <span className={`truncate ${last ? "font-semibold text-ink-100" : "text-ink-400"}`}>{c.label}</span>
                {last && c.note?.isFavorite && <span className="shrink-0 text-xs text-duck-400">★</span>}
              </>
            );
            return (
              <span key={c.id} className="flex min-w-0 items-center gap-1">
                {i > 0 && <span className="shrink-0 text-ink-600">/</span>}
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => (c.onClick ? c.onClick() : onSelectNote?.(c.note))}
                    className="flex min-w-0 max-w-[12rem] items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-ink-800 hover:text-ink-100"
                    title={c.label}
                  >
                    {inner}
                  </button>
                ) : (
                  <span
                    className="flex min-w-0 max-w-[24rem] items-center gap-1.5 px-1.5 py-0.5"
                    title={c.hiddenTitles ? c.hiddenTitles.join(" › ") : c.label}
                    aria-current={last ? "page" : undefined}
                  >
                    {inner}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      {/* Right: study actions */}
      <div className="flex shrink-0 items-center gap-2">
        {saveStatus && (
          <span className="hidden items-center gap-1.5 text-[11px] font-medium text-ink-500 md:inline-flex" aria-live="polite">
            <span className="h-1.5 w-1.5 rounded-full bg-solid-500" />
            {saveStatus.replace(/^✓\s*/, "")}
          </span>
        )}

        {isNotes ? (
          <div className="flex items-center rounded-xl border border-ink-800 bg-ink-850 p-0.5">
            <button
              type="button"
              disabled={!canStudyNote}
              onClick={onExplain}
              title={canStudyNote ? "Explain this note" : "Open a note first"}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                studyKind === "explain" ? "bg-ink-700 text-ink-100" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Explain</span>
            </button>
            <button
              type="button"
              disabled={!canStudyNote}
              onClick={onQuiz}
              title={canStudyNote ? "Quiz me on this note" : "Open a note first"}
              className="flex items-center gap-1.5 rounded-lg bg-duck-400 px-2.5 py-1.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-duck-300 disabled:pointer-events-none disabled:opacity-40"
            >
              <span aria-hidden="true">🦆</span>
              <span className="hidden lg:inline">Quiz me</span>
            </button>
            <button
              type="button"
              onClick={onTutor}
              title="Ask the AI tutor"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                studyKind === "tutor" ? "bg-ink-700 text-ink-100" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Tutor</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onTutor}
            title="Ask the AI tutor about this space"
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              studyKind === "tutor"
                ? "border-ink-700 bg-ink-800 text-ink-100"
                : "border-ink-800 bg-ink-850 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI Tutor</span>
          </button>
        )}

        {noteMenu}

        <button
          type="button"
          onClick={onToggleZen}
          title="Focus mode (Ctrl+Shift+F)"
          className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
