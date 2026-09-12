"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MULTI_TIMER_STORAGE_KEY = "socratic_multi_timers_v2";

export const defaultTimers = [
  { id: "focus_pomodoro", title: "Pomodoro Focus", mode: "focus", totalSeconds: 1500, targetEndTime: null, pausedSecondsLeft: null, isActive: false, isPinned: false, isDefault: true },
  { id: "short_break", title: "Short Break", mode: "short", totalSeconds: 300, targetEndTime: null, pausedSecondsLeft: null, isActive: false, isPinned: false, isDefault: true },
  { id: "long_break", title: "Long Break", mode: "long", totalSeconds: 900, targetEndTime: null, pausedSecondsLeft: null, isActive: false, isPinned: false, isDefault: true },
];

export const sanitizeTimer = (t) => ({
  ...t,
  totalSeconds: Number(t.totalSeconds) || 1500,
  targetEndTime: t.targetEndTime ? Number(t.targetEndTime) : null,
  pausedSecondsLeft: t.pausedSecondsLeft != null ? Number(t.pausedSecondsLeft) : null,
  isActive: Boolean(t.isActive),
  isPinned: Boolean(t.isPinned),
  isDefault: Boolean(t.isDefault),
});

// Storage Adapter (Supports both legacy raw array & Zustand envelope format)
export const timerStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const timers = Array.isArray(parsed) ? parsed : parsed?.state?.timers;
      return Array.isArray(timers) ? { state: { timers: timers.map(sanitizeTimer) }, version: 0 } : null;
    } catch {
      return null;
    }
  },
  setItem: (name, val) => {
    if (typeof window !== "undefined") {
      try { localStorage.setItem(name, JSON.stringify(val)); } catch {}
    }
  },
  removeItem: (name) => {
    if (typeof window !== "undefined") {
      try { localStorage.removeItem(name); } catch {}
    }
  },
};

// Auto-Sleep Ticker (0% Idle CPU when no active timers)
let tickerInterval = null;
export const isTickerRunning = () => tickerInterval !== null;

export function checkAndManageTicker() {
  if (typeof window === "undefined") return;
  const hasActive = useTimerStore.getState().timers.some((t) => t.isActive);
  if (hasActive && !tickerInterval) {
    tickerInterval = setInterval(handleStoreTick, 500);
  } else if (!hasActive && tickerInterval) {
    clearInterval(tickerInterval);
    tickerInterval = null;
  }
}

export function handleStoreTick() {
  const now = Date.now();
  let hasExpired = false;
  const timers = useTimerStore.getState().timers.map((t) => {
    if (!t.isActive || !t.targetEndTime) return t;
    const remaining = Math.max(0, Math.ceil((t.targetEndTime - now) / 1000));
    if (remaining > 0) return t;
    hasExpired = true;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("socratic_alarm_triggered", {
          detail: { alarmType: "timer", title: `${t.title} Complete!`, message: `Your timer "${t.title}" of ${Math.round(t.totalSeconds / 60)}m has finished.` },
        })
      );
    }
    return { ...t, isActive: false, targetEndTime: null, pausedSecondsLeft: null };
  });

  useTimerStore.setState({ timers, lastTick: now });
  if (hasExpired || !timers.some((t) => t.isActive)) checkAndManageTicker();
}

// Zustand Store
export const useTimerStore = create(
  persist(
    (set) => ({
      timers: defaultTimers,
      lastTick: Date.now(),

      addTimer: (title, durationMins, mode = "custom") => {
        const validMins = Math.max(1, Math.min(180, Number(durationMins) || 10));
        set((s) => ({
          timers: [
            ...s.timers,
            {
              id: `timer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              title: title?.trim() || `Custom (${validMins}m)`,
              mode,
              totalSeconds: validMins * 60,
              targetEndTime: null,
              pausedSecondsLeft: null,
              isActive: false,
              isPinned: false,
              isDefault: false,
            },
          ],
        }));
      },

      togglePlayPause: (id) => {
        const now = Date.now();
        set((s) => ({
          timers: s.timers.map((t) => {
            if (t.id !== id) return t;
            if (t.isActive) {
              const remaining = t.targetEndTime ? Math.max(0, Math.ceil((t.targetEndTime - now) / 1000)) : t.totalSeconds;
              return { ...t, isActive: false, targetEndTime: null, pausedSecondsLeft: remaining };
            }
            const count = t.pausedSecondsLeft != null && t.pausedSecondsLeft > 0 ? t.pausedSecondsLeft : t.totalSeconds;
            return { ...t, isActive: true, targetEndTime: now + count * 1000, pausedSecondsLeft: null };
          }),
        }));
      },

      resetTimer: (id) => set((s) => ({
        timers: s.timers.map((t) => (t.id === id ? { ...t, isActive: false, targetEndTime: null, pausedSecondsLeft: null } : t)),
      })),

      togglePin: (id) => set((s) => ({
        timers: s.timers.map((t) => (t.id === id ? { ...t, isPinned: !t.isPinned } : t)),
      })),

      deleteTimer: (id) => set((s) => ({
        timers: s.timers.filter((t) => t.id !== id || t.isDefault),
      })),

      extendTimer: (id, extraMins = 5) => {
        const extraSecs = (Number(extraMins) || 5) * 60;
        set((s) => ({
          timers: s.timers.map((t) => {
            if (t.id !== id) return t;
            return {
              ...t,
              totalSeconds: t.totalSeconds + extraSecs,
              targetEndTime: t.targetEndTime ? t.targetEndTime + extraSecs * 1000 : null,
              pausedSecondsLeft: t.pausedSecondsLeft != null ? t.pausedSecondsLeft + extraSecs : null,
            };
          }),
        }));
      },
    }),
    {
      name: MULTI_TIMER_STORAGE_KEY,
      storage: timerStorage,
      partialize: (s) => ({ timers: s.timers }),
    }
  )
);

useTimerStore.subscribe(checkAndManageTicker);
if (typeof window !== "undefined") checkAndManageTicker();

export const multiTimerStore = {
  getSnapshot: () => useTimerStore.getState(),
  subscribe: (cb) => useTimerStore.subscribe(cb),
  addTimer: (...a) => useTimerStore.getState().addTimer(...a),
  togglePlayPause: (...a) => useTimerStore.getState().togglePlayPause(...a),
  resetTimer: (...a) => useTimerStore.getState().resetTimer(...a),
  togglePin: (...a) => useTimerStore.getState().togglePin(...a),
  deleteTimer: (...a) => useTimerStore.getState().deleteTimer(...a),
  extendTimer: (...a) => useTimerStore.getState().extendTimer(...a),
  isTickerRunning,
};

const SERVER_SNAPSHOT = { timers: defaultTimers, lastTick: 0 };

export function useGlobalTimer() {
  const store = useSyncExternalStore(
    multiTimerStore.subscribe,
    multiTimerStore.getSnapshot,
    () => SERVER_SNAPSHOT
  );
  const now = store.lastTick || Date.now();

  const timersWithLive = store.timers.map((t) => {
    let secondsLeft = t.totalSeconds;
    if (t.isActive && t.targetEndTime) {
      secondsLeft = Math.max(0, Math.ceil((t.targetEndTime - now) / 1000));
    } else if (t.pausedSecondsLeft != null) {
      secondsLeft = t.pausedSecondsLeft;
    }
    return {
      ...t,
      secondsLeft,
      isNearingEnd: t.isActive && secondsLeft > 0 && secondsLeft <= 120,
      percentLeft: Math.max(0, Math.min(100, (secondsLeft / Math.max(1, t.totalSeconds)) * 100)),
    };
  });

  const activeTimers = timersWithLive.filter((t) => t.isActive);
  const pinnedTimers = timersWithLive.filter((t) => t.isPinned);
  const primaryTimer =
    [...activeTimers].sort((a, b) => a.secondsLeft - b.secondsLeft)[0] ||
    pinnedTimers[0] ||
    timersWithLive.find((t) => t.id === "focus_pomodoro") ||
    timersWithLive[0];

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (primaryTimer?.isActive && primaryTimer.secondsLeft > 0) {
      const m = Math.floor(primaryTimer.secondsLeft / 60);
      const s = String(primaryTimer.secondsLeft % 60).padStart(2, "0");
      document.title = `(${m}:${s} ⏱️ ${primaryTimer.title}) SocraticOS`;
    } else {
      document.title = "SocraticOS — notes that quiz you back";
    }
  }, [primaryTimer]);

  const cleanId = (id) => (typeof id === "string" && id ? id : primaryTimer?.id);

  return {
    timers: timersWithLive,
    activeTimers,
    pinnedTimers,
    primaryTimer,
    addTimer: (title, mins, mode) => useTimerStore.getState().addTimer(title, mins, mode),
    togglePlayPause: (id) => useTimerStore.getState().togglePlayPause(cleanId(id)),
    resetTimer: (id) => useTimerStore.getState().resetTimer(cleanId(id)),
    togglePin: (id) => useTimerStore.getState().togglePin(cleanId(id)),
    deleteTimer: (id) => useTimerStore.getState().deleteTimer(typeof id === "string" ? id : ""),
    extendTimer: (id, mins) => useTimerStore.getState().extendTimer(cleanId(id), typeof mins === "number" ? mins : typeof id === "number" ? id : 5),
    mode: primaryTimer?.mode || "focus",
    totalSeconds: primaryTimer?.totalSeconds || 25 * 60,
    secondsLeft: primaryTimer?.secondsLeft ?? 25 * 60,
    isActive: Boolean(primaryTimer?.isActive),
    isNearingEnd: Boolean(primaryTimer?.isNearingEnd),
    percentLeft: primaryTimer?.percentLeft ?? 100,
    pausedSecondsLeft: primaryTimer?.pausedSecondsLeft ?? null,
    customMins: Math.round((primaryTimer?.totalSeconds || 600) / 60),
    startTimer: (mode = "focus", customMins) => {
      const target = timersWithLive.find((t) => t.mode === mode) || primaryTimer;
      if (target) {
        if (typeof customMins === "number" && mode === "custom") {
          useTimerStore.getState().addTimer("Custom Timer", customMins, "custom");
        } else {
          useTimerStore.getState().togglePlayPause(target.id);
        }
      }
    },
  };
}
