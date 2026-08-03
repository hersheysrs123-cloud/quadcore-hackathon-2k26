"use client";

import { useGlobalTimer } from "@/lib/timerStore";
import { Play, Pause, RotateCcw, Pin, PinOff, AlertTriangle } from "lucide-react";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function PinnedTimersOverlay() {
  const { pinnedTimers, togglePlayPause, resetTimer, togglePin } = useGlobalTimer();

  if (!pinnedTimers || pinnedTimers.length === 0) return null;

  const modeEmojis = {
    focus: "🍅",
    short: "⚡",
    long: "☕",
    custom: "⏱️",
  };

  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2.5 max-w-xs w-full pointer-events-auto animate-fade-up">
      {pinnedTimers.map((timer) => (
        <div
          key={timer.id}
          className={`relative overflow-hidden rounded-xl border p-3.5 shadow-2xl backdrop-blur-xl transition-all ${
            timer.isNearingEnd
              ? "border-rose-500/80 bg-rose-950/90 ring-2 ring-rose-500/50 animate-pulse text-rose-100"
              : timer.isActive
              ? "border-duck-500/60 bg-ink-900/95 ring-1 ring-duck-500/30 text-ink-100"
              : "border-ink-700 bg-ink-900/90 text-ink-200"
          }`}
        >
          {/* Top Bar: Title & Unpin Button */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm shrink-0">{modeEmojis[timer.mode] || "⏱️"}</span>
              <span className="truncate text-xs font-bold tracking-tight">
                {timer.title}
              </span>
            </div>

            <button
              type="button"
              onClick={() => togglePin(timer.id)}
              title="Unpin from screen"
              className="rounded p-1 text-ink-400 hover:bg-ink-800 hover:text-duck-300 transition-colors shrink-0"
            >
              <PinOff className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Center: Countdown Time & Controls */}
          <div className="flex items-center justify-between gap-3 bg-ink-950/70 rounded-lg p-2 border border-ink-800/80">
            <div className="flex items-center gap-2">
              {timer.isNearingEnd && (
                <AlertTriangle className="h-4 w-4 text-rose-400 animate-bounce shrink-0" />
              )}
              <span
                className={`font-mono text-xl font-extrabold tracking-tight tabular-nums ${
                  timer.isNearingEnd ? "text-rose-400" : timer.isActive ? "text-duck-300" : "text-ink-300"
                }`}
              >
                {formatTime(timer.secondsLeft)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => togglePlayPause(timer.id)}
                className={`rounded-md p-1.5 text-xs font-bold transition-all ${
                  timer.isActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                    : "bg-duck-500/20 text-duck-300 border border-duck-500/40 hover:bg-duck-500/30"
                }`}
              >
                {timer.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => resetTimer(timer.id)}
                className="rounded-md border border-ink-800 bg-ink-850 p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Bottom Progress Underline Bar */}
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
  );
}
