"use client";

import { useState, useRef, useEffect } from "react";
import { useGlobalTimer } from "@/lib/timerStore";
import { Play, Pause, RotateCcw, Plus, Calendar, AlertTriangle, Clock, Pin, PinOff, Trash2, Check } from "lucide-react";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function GlobalTimerHUD({ onNavigateCalendar }) {
  const {
    timers,
    activeTimers,
    pinnedTimers,
    primaryTimer,
    addTimer,
    togglePlayPause,
    resetTimer,
    togglePin,
    deleteTimer,
  } = useGlobalTimer();

  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState(15);
  const popoverRef = useRef(null);

  const modeEmojis = {
    focus: "🍅",
    short: "⚡",
    long: "☕",
    custom: "⏱️",
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleCreateTimer(e) {
    e.preventDefault();
    if (!newDuration || newDuration <= 0) return;
    addTimer(newTitle || `Custom Timer (${newDuration}m)`, newDuration, "custom");
    setNewTitle("");
    setNewDuration(15);
    setShowAddForm(false);
  }

  const primaryIsNearingEnd = primaryTimer?.isNearingEnd;
  const primaryIsActive = primaryTimer?.isActive;
  const activeCount = activeTimers.length;

  return (
    <div className="relative flex w-full items-center" ref={popoverRef}>
      {/* ── Unified Timers Button ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Manage Workspace Timers"
        className={`group relative flex w-full items-center justify-between rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all shadow-sm ${
          primaryIsNearingEnd
            ? "border-rose-500/80 bg-rose-500/20 text-rose-300 ring-2 ring-rose-500/40 animate-pulse"
            : primaryIsActive
            ? "border-duck-500/60 bg-duck-500/10 text-duck-300 ring-1 ring-duck-500/30"
            : "border-ink-700/80 bg-ink-850/90 text-ink-200 hover:border-duck-500/50 hover:bg-ink-800 hover:text-ink-100"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 items-center justify-center shrink-0">
            {primaryIsNearingEnd ? (
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400 animate-bounce" />
            ) : primaryIsActive ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-duck-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-duck-400" />
              </>
            ) : (
              <Clock className="h-3.5 w-3.5 text-duck-400" />
            )}
          </span>

          {/* Button Display Logic */}
          <div className="flex items-center gap-1.5 tabular-nums min-w-0">
            <span className="font-bold text-ink-100 shrink-0">Timers</span>
            {activeCount > 1 ? (
              <span className="rounded-full bg-duck-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-duck-300 border border-duck-500/40 shrink-0">
                {activeCount} Active
              </span>
            ) : activeCount === 1 && primaryTimer ? (
              <span className="truncate text-[11px] text-ink-300 font-normal">
                {modeEmojis[primaryTimer.mode]} {primaryTimer.title}
              </span>
            ) : (
              pinnedTimers.length > 0 && (
                <span className="rounded-full bg-ink-800 px-1.5 text-[10px] text-ink-400 shrink-0">
                  📌 {pinnedTimers.length}
                </span>
              )
            )}
          </div>
        </div>

        {primaryTimer && (
          <span className="font-mono text-xs tracking-tight font-bold tabular-nums shrink-0 ml-2 text-ink-300">
            {formatTime(primaryTimer.secondsLeft)}
          </span>
        )}

        {/* Progress bar on button */}
        {primaryIsActive && (
          <div className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-ink-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                primaryIsNearingEnd ? "bg-rose-500" : "bg-duck-400"
              }`}
              style={{ width: `${primaryTimer?.percentLeft || 0}%` }}
            />
          </div>
        )}
      </button>

      {/* ── Multi-Timer Dropdown Panel ── */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-[100] w-72 max-h-[85vh] overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-2xl backdrop-blur-xl animate-fade-up">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-ink-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-duck-400" />
              <h4 className="text-xs font-bold text-ink-100">Unified Timers</h4>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAddForm((prev) => !prev)}
                className="flex items-center gap-1 rounded-md border border-duck-500/40 bg-duck-500/10 px-2 py-1 text-[10px] font-semibold text-duck-300 hover:bg-duck-500/20 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>New</span>
              </button>

              {onNavigateCalendar && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateCalendar();
                  }}
                  title="View full calendar schedule"
                  className="rounded-md border border-ink-800 bg-ink-850 p-1 text-ink-400 hover:text-ink-200"
                >
                  <Calendar className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Add Custom Timer Form */}
          {showAddForm && (
            <form onSubmit={handleCreateTimer} className="mb-3 rounded-lg border border-duck-500/30 bg-ink-950 p-3 space-y-2.5 animate-fade-in">
              <div className="text-[11px] font-semibold text-duck-300">Create Custom Timer</div>
              <input
                type="text"
                placeholder="Timer Title (e.g. Math Exam Drill)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1 text-xs text-ink-100 placeholder:text-ink-500 focus:border-duck-500/50 focus:outline-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="180"
                  placeholder="Minutes"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="w-24 rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                />
                <span className="text-xs text-ink-400">mins</span>

                <button
                  type="submit"
                  className="ml-auto rounded-md bg-duck-400 px-3 py-1 text-xs font-bold text-ink-950 hover:bg-duck-300"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Timers List */}
          <div className="space-y-2.5 mb-3">
            {timers.map((timer) => (
              <div
                key={timer.id}
                className={`rounded-lg border p-3 transition-all ${
                  timer.isNearingEnd
                    ? "border-rose-500/60 bg-rose-950/40 text-rose-200"
                    : timer.isActive
                    ? "border-duck-500/50 bg-ink-950"
                    : "border-ink-800 bg-ink-950/60"
                }`}
              >
                {/* Timer Info & Pin Toggle */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm shrink-0">{modeEmojis[timer.mode] || "⏱️"}</span>
                    <span className="truncate text-xs font-bold text-ink-100">
                      {timer.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePin(timer.id)}
                      title={timer.isPinned ? "Unpin from screen" : "Pin floating timer on screen"}
                      className={`rounded p-1 transition-colors ${
                        timer.isPinned
                          ? "text-duck-300 bg-duck-500/20 border border-duck-500/40"
                          : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                      }`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>

                    {!timer.isDefault && (
                      <button
                        type="button"
                        onClick={() => deleteTimer(timer.id)}
                        title="Delete custom timer"
                        className="rounded p-1 text-ink-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Countdown & Play/Pause/Reset Controls */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-lg font-bold tabular-nums ${
                      timer.isNearingEnd
                        ? "text-rose-400 animate-pulse"
                        : timer.isActive
                        ? "text-duck-300"
                        : "text-ink-300"
                    }`}
                  >
                    {formatTime(timer.secondsLeft)}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => togglePlayPause(timer.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                        timer.isActive
                          ? "border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                          : "border border-duck-500/40 bg-duck-500/20 text-duck-300 hover:bg-duck-500/30"
                      }`}
                    >
                      {timer.isActive ? (
                        <span className="flex items-center gap-1"><Pause className="h-3 w-3" /> Pause</span>
                      ) : (
                        <span className="flex items-center gap-1"><Play className="h-3 w-3" /> Start</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => resetTimer(timer.id)}
                      title="Reset timer"
                      className="rounded-md border border-ink-800 bg-ink-850 p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      timer.isNearingEnd ? "bg-rose-500" : "bg-duck-400"
                    }`}
                    style={{ width: `${timer.percentLeft}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
