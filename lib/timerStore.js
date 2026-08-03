"use client";

import { useState, useEffect, useSyncExternalStore } from "react";

const MULTI_TIMER_STORAGE_KEY = "socratic_multi_timers_v2";

const defaultTimers = [
  {
    id: "focus_pomodoro",
    title: "Pomodoro Focus",
    mode: "focus",
    totalSeconds: 25 * 60,
    targetEndTime: null,
    pausedSecondsLeft: null,
    isActive: false,
    isPinned: false,
    isDefault: true,
  },
  {
    id: "short_break",
    title: "Short Break",
    mode: "short",
    totalSeconds: 5 * 60,
    targetEndTime: null,
    pausedSecondsLeft: null,
    isActive: false,
    isPinned: false,
    isDefault: true,
  },
  {
    id: "long_break",
    title: "Long Break",
    mode: "long",
    totalSeconds: 15 * 60,
    targetEndTime: null,
    pausedSecondsLeft: null,
    isActive: false,
    isPinned: false,
    isDefault: true,
  },
];

let currentState = { timers: defaultTimers };
const subscribers = new Set();

function emitChange() {
  subscribers.forEach((cb) => cb());
}

function saveToStorage(state) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MULTI_TIMER_STORAGE_KEY, JSON.stringify(state.timers));
  } catch {
    // Ignore storage error
  }
}

function loadFromStorage() {
  if (typeof window === "undefined") return { timers: defaultTimers };
  try {
    const raw = localStorage.getItem(MULTI_TIMER_STORAGE_KEY);
    if (!raw) return { timers: defaultTimers };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return {
        timers: parsed.map((t) => ({
          ...t,
          totalSeconds: Number(t.totalSeconds) || 25 * 60,
          targetEndTime: t.targetEndTime ? Number(t.targetEndTime) : null,
          pausedSecondsLeft: t.pausedSecondsLeft !== null && t.pausedSecondsLeft !== undefined ? Number(t.pausedSecondsLeft) : null,
          isActive: Boolean(t.isActive),
          isPinned: Boolean(t.isPinned),
        })),
      };
    }
  } catch {
    // fallback
  }
  return { timers: defaultTimers };
}

if (typeof window !== "undefined") {
  currentState = loadFromStorage();
}

export const multiTimerStore = {
  getSnapshot() {
    return currentState;
  },

  subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },

  addTimer(title, durationMins, mode = "custom") {
    const validMins = Math.max(1, Math.min(180, Number(durationMins) || 10));
    const newTimer = {
      id: `timer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || `Custom (${validMins}m)`,
      mode,
      totalSeconds: validMins * 60,
      targetEndTime: null,
      pausedSecondsLeft: null,
      isActive: false,
      isPinned: false,
      isDefault: false,
    };

    currentState = {
      timers: [...currentState.timers, newTimer],
    };
    saveToStorage(currentState);
    emitChange();
  },

  togglePlayPause(timerId) {
    const now = Date.now();
    currentState = {
      timers: currentState.timers.map((t) => {
        if (t.id !== timerId) return t;

        if (t.isActive) {
          // Pause timer
          const remainingMs = Math.max(0, (t.targetEndTime || now) - now);
          const remainingSecs = Math.ceil(remainingMs / 1000);
          return {
            ...t,
            isActive: false,
            pausedSecondsLeft: remainingSecs,
            targetEndTime: null,
          };
        } else {
          // Resume/Start timer
          const secsToRun = t.pausedSecondsLeft !== null ? t.pausedSecondsLeft : t.totalSeconds;
          const actualSecs = secsToRun <= 0 ? t.totalSeconds : secsToRun;
          return {
            ...t,
            isActive: true,
            targetEndTime: now + actualSecs * 1000,
            pausedSecondsLeft: null,
          };
        }
      }),
    };

    saveToStorage(currentState);
    emitChange();
  },

  resetTimer(timerId) {
    currentState = {
      timers: currentState.timers.map((t) => {
        if (t.id !== timerId) return t;
        return {
          ...t,
          targetEndTime: null,
          pausedSecondsLeft: null,
          isActive: false,
        };
      }),
    };

    saveToStorage(currentState);
    emitChange();
  },

  togglePin(timerId) {
    currentState = {
      timers: currentState.timers.map((t) => {
        if (t.id !== timerId) return t;
        return { ...t, isPinned: !t.isPinned };
      }),
    };

    saveToStorage(currentState);
    emitChange();
  },

  deleteTimer(timerId) {
    currentState = {
      timers: currentState.timers.filter((t) => t.id !== timerId || t.isDefault),
    };

    saveToStorage(currentState);
    emitChange();
  },

  extendTimer(timerId, addMinutes = 5) {
    const addSecs = addMinutes * 60;
    const now = Date.now();

    currentState = {
      timers: currentState.timers.map((t) => {
        if (t.id !== timerId) return t;

        let currentRemaining = t.totalSeconds;
        if (t.isActive && t.targetEndTime) {
          currentRemaining = Math.max(0, Math.ceil((t.targetEndTime - now) / 1000));
        } else if (t.pausedSecondsLeft !== null) {
          currentRemaining = t.pausedSecondsLeft;
        }

        const newRemaining = currentRemaining + addSecs;
        const newTotal = t.totalSeconds + addSecs;

        if (t.isActive) {
          return {
            ...t,
            totalSeconds: newTotal,
            targetEndTime: now + newRemaining * 1000,
          };
        } else {
          return {
            ...t,
            totalSeconds: newTotal,
            pausedSecondsLeft: newRemaining,
          };
        }
      }),
    };

    saveToStorage(currentState);
    emitChange();
  },
};

// Global extension event listener
if (typeof window !== "undefined") {
  window.addEventListener("socratic_extend_timer", (e) => {
    const mins = e.detail?.minutes || 5;
    const active = currentState.timers.find((t) => t.isActive);
    if (active) {
      multiTimerStore.extendTimer(active.id, mins);
    }
  });
}

const SERVER_SNAPSHOT = { timers: defaultTimers };
function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

// ─── React Hook: useGlobalTimer ─────────────────────────────────────────────
export function useGlobalTimer() {
  const store = useSyncExternalStore(
    multiTimerStore.subscribe,
    multiTimerStore.getSnapshot,
    getServerSnapshot
  );

  const [tickTime, setTickTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTickTime(Date.now());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Handle timer completion in a side-effect to avoid state updates during render
  useEffect(() => {
    store.timers.forEach((t) => {
      if (t.isActive && t.targetEndTime) {
        const remaining = Math.max(0, Math.ceil((t.targetEndTime - tickTime) / 1000));
        if (remaining === 0) {
          multiTimerStore.togglePlayPause(t.id);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("socratic_alarm_triggered", {
                detail: {
                  alarmType: "timer",
                  title: `${t.title} Complete!`,
                  message: `Your timer "${t.title}" of ${Math.round(t.totalSeconds / 60)}m has finished.`,
                },
              })
            );
          }
        }
      }
    });
  }, [tickTime, store.timers]);

  // Compute live properties for each timer
  const timersWithLive = store.timers.map((t) => {
    let secondsLeft = t.totalSeconds;
    if (t.isActive && t.targetEndTime) {
      secondsLeft = Math.max(0, Math.ceil((t.targetEndTime - tickTime) / 1000));
    } else if (t.pausedSecondsLeft !== null) {
      secondsLeft = t.pausedSecondsLeft;
    }

    const isNearingEnd = t.isActive && secondsLeft > 0 && secondsLeft <= 120;
    const percentLeft = Math.max(0, Math.min(100, (secondsLeft / Math.max(1, t.totalSeconds)) * 100));

    return {
      ...t,
      secondsLeft,
      isNearingEnd,
      percentLeft,
    };
  });

  const activeTimers = timersWithLive.filter((t) => t.isActive);
  const pinnedTimers = timersWithLive.filter((t) => t.isPinned);

  // Primary active timer (nearest to completion if multiple running)
  const primaryTimer =
    [...activeTimers].sort((a, b) => a.secondsLeft - b.secondsLeft)[0] ||
    pinnedTimers[0] ||
    timersWithLive.find((t) => t.id === "focus_pomodoro") ||
    timersWithLive[0];

  // Document Title update
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (primaryTimer && primaryTimer.isActive && primaryTimer.secondsLeft > 0) {
      const mins = Math.floor(primaryTimer.secondsLeft / 60);
      const secs = String(primaryTimer.secondsLeft % 60).padStart(2, "0");
      document.title = `(${mins}:${secs} ⏱️ ${primaryTimer.title}) SocraticOS`;
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
    // Methods for convenience
    addTimer: (title, mins, mode) => multiTimerStore.addTimer(title, mins, mode),
    togglePlayPause: (id) => multiTimerStore.togglePlayPause(cleanId(id)),
    resetTimer: (id) => multiTimerStore.resetTimer(cleanId(id)),
    togglePin: (id) => multiTimerStore.togglePin(cleanId(id)),
    deleteTimer: (id) => multiTimerStore.deleteTimer(typeof id === "string" ? id : ""),
    extendTimer: (id, mins) => {
      const targetId = cleanId(id);
      const actualMins = typeof mins === "number" ? mins : typeof id === "number" ? id : 5;
      multiTimerStore.extendTimer(targetId, actualMins);
    },
    // Backward compatibility props for single-timer view in StudyTimerWidget
    mode: primaryTimer?.mode || "focus",
    totalSeconds: primaryTimer?.totalSeconds || 25 * 60,
    secondsLeft: primaryTimer?.secondsLeft ?? 25 * 60,
    isActive: Boolean(primaryTimer?.isActive),
    isNearingEnd: Boolean(primaryTimer?.isNearingEnd),
    percentLeft: primaryTimer?.percentLeft ?? 100,
    pausedSecondsLeft: primaryTimer?.pausedSecondsLeft ?? null,
    startTimer: (mode, customMins) => {
      const selectedMode = typeof mode === "string" ? mode : "focus";
      const target = timersWithLive.find((t) => t.mode === selectedMode) || primaryTimer;
      if (target) {
        if (typeof customMins === "number" && selectedMode === "custom") {
          multiTimerStore.addTimer("Custom Timer", customMins, "custom");
        } else {
          multiTimerStore.togglePlayPause(target.id);
        }
      }
    },
  };
}
