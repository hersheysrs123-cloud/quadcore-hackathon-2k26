import { describe, it } from "node:test";
import assert from "node:assert/strict";

export function calculateSecondsRemaining(timer, nowMs = Date.now()) {
  if (!timer.isActive) {
    return timer.pausedSecondsLeft !== null ? timer.pausedSecondsLeft : timer.totalSeconds;
  }
  if (!timer.targetEndTime) return timer.totalSeconds;

  const diffMs = timer.targetEndTime - nowMs;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 1000);
}

export function startTimer(timer, nowMs = Date.now()) {
  const currentLeft = calculateSecondsRemaining(timer, nowMs);
  const duration = currentLeft > 0 ? currentLeft : timer.totalSeconds;
  return {
    ...timer,
    isActive: true,
    targetEndTime: nowMs + duration * 1000,
    pausedSecondsLeft: null,
  };
}

export function pauseTimer(timer, nowMs = Date.now()) {
  if (!timer.isActive) return timer;
  const left = calculateSecondsRemaining(timer, nowMs);
  return {
    ...timer,
    isActive: false,
    targetEndTime: null,
    pausedSecondsLeft: left,
  };
}

export function resetTimer(timer) {
  return {
    ...timer,
    isActive: false,
    targetEndTime: null,
    pausedSecondsLeft: null,
  };
}

export function validateDurationMins(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.max(1, Math.min(180, n));
}

describe("Multi-Timer Subsystem Logic (lib/timerStore.js)", () => {
  const pomodoroPreset = {
    id: "focus_pomodoro",
    title: "Pomodoro Focus",
    mode: "focus",
    totalSeconds: 25 * 60,
    targetEndTime: null,
    pausedSecondsLeft: null,
    isActive: false,
    isPinned: false,
  };

  it("calculates remaining seconds accurately when timer is active", () => {
    const baseTime = 1000000;
    const runningTimer = {
      ...pomodoroPreset,
      isActive: true,
      targetEndTime: baseTime + 1500 * 1000, // 25 min in the future
    };

    assert.strictEqual(calculateSecondsRemaining(runningTimer, baseTime), 1500);
    assert.strictEqual(calculateSecondsRemaining(runningTimer, baseTime + 10000), 1490);
    assert.strictEqual(calculateSecondsRemaining(runningTimer, baseTime + 1500000), 0);
    assert.strictEqual(calculateSecondsRemaining(runningTimer, baseTime + 2000000), 0);
  });

  it("preserves exact remaining time when paused and resumed", () => {
    const baseTime = 1000000;
    const started = startTimer(pomodoroPreset, baseTime);

    const after5Mins = baseTime + 300 * 1000;
    const paused = pauseTimer(started, after5Mins);

    assert.strictEqual(paused.isActive, false);
    assert.strictEqual(paused.pausedSecondsLeft, 1200); // 20 mins left

    const resumed = startTimer(paused, baseTime + 3600 * 1000);
    assert.strictEqual(resumed.isActive, true);
    assert.strictEqual(calculateSecondsRemaining(resumed, baseTime + 3600 * 1000), 1200);
  });

  it("resets timer back to initial total duration cleanly", () => {
    const started = startTimer(pomodoroPreset);
    const reset = resetTimer(started);

    assert.strictEqual(reset.isActive, false);
    assert.strictEqual(reset.targetEndTime, null);
    assert.strictEqual(reset.pausedSecondsLeft, null);
    assert.strictEqual(calculateSecondsRemaining(reset), 1500);
  });

  it("validates and clamps custom timer minutes between 1m and 180m", () => {
    assert.strictEqual(validateDurationMins(25), 25);
    assert.strictEqual(validateDurationMins(0), 10);
    assert.strictEqual(validateDurationMins(-50), 10);
    assert.strictEqual(validateDurationMins(500), 180);
    assert.strictEqual(validateDurationMins("invalid"), 10);
  });
});

describe("Zustand Timer Store Engine (lib/timerStore.js)", async () => {
  let dispatchedEvents = [];
  globalThis.window = { dispatchEvent: (e) => dispatchedEvents.push(e) };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
  let mockStorage = {};
  globalThis.localStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; },
  };

  const {
    useTimerStore, multiTimerStore, isTickerRunning,
    handleStoreTick, timerStorage, MULTI_TIMER_STORAGE_KEY, defaultTimers,
  } = await import("../../lib/timerStore.js");

  it("initializes with default timers and inactive ticker", () => {
    useTimerStore.setState({ timers: defaultTimers, lastTick: Date.now() });
    const snapshot = multiTimerStore.getSnapshot();
    assert.strictEqual(snapshot.timers.length, 3);
    assert.strictEqual(snapshot.timers[0].id, "focus_pomodoro");
    assert.strictEqual(isTickerRunning(), false, "Ticker must be idle on startup (0% idle CPU)");
  });

  it("starts ticker when timer is activated and stops ticker when paused (0% CPU)", () => {
    useTimerStore.setState({ timers: defaultTimers, lastTick: Date.now() });
    multiTimerStore.togglePlayPause("focus_pomodoro");
    let state = multiTimerStore.getSnapshot();
    const pomodoro = state.timers.find((t) => t.id === "focus_pomodoro");
    assert.strictEqual(pomodoro.isActive, true);
    assert.strictEqual(isTickerRunning(), true, "Ticker must run when active");

    multiTimerStore.togglePlayPause("focus_pomodoro");
    state = multiTimerStore.getSnapshot();
    assert.strictEqual(state.timers.find((t) => t.id === "focus_pomodoro").isActive, false);
    assert.strictEqual(isTickerRunning(), false, "Ticker must stop when paused (0% idle CPU)");
  });

  it("stops ticker when active timer is reset", () => {
    useTimerStore.setState({ timers: defaultTimers, lastTick: Date.now() });
    multiTimerStore.togglePlayPause("short_break");
    assert.strictEqual(isTickerRunning(), true);

    multiTimerStore.resetTimer("short_break");
    assert.strictEqual(multiTimerStore.getSnapshot().timers.find((t) => t.id === "short_break").isActive, false);
    assert.strictEqual(isTickerRunning(), false, "Ticker must stop on reset (0% idle CPU)");
  });

  it("adds custom timer and extends timer duration", () => {
    useTimerStore.setState({ timers: defaultTimers, lastTick: Date.now() });
    multiTimerStore.addTimer("Sprint Planning", 45, "custom");
    let state = multiTimerStore.getSnapshot();
    const added = state.timers.find((t) => t.title === "Sprint Planning");
    assert.ok(added);
    assert.strictEqual(added.totalSeconds, 45 * 60);

    multiTimerStore.extendTimer(added.id, 10);
    assert.strictEqual(multiTimerStore.getSnapshot().timers.find((t) => t.id === added.id).totalSeconds, 55 * 60);

    multiTimerStore.togglePin(added.id);
    assert.strictEqual(multiTimerStore.getSnapshot().timers.find((t) => t.id === added.id).isPinned, true);

    multiTimerStore.deleteTimer(added.id);
    assert.strictEqual(multiTimerStore.getSnapshot().timers.find((t) => t.id === added.id), undefined);

    multiTimerStore.deleteTimer("focus_pomodoro");
    assert.ok(multiTimerStore.getSnapshot().timers.find((t) => t.id === "focus_pomodoro"), "Default protected");
  });

  it("triggers alarm event and stops ticker when active timer expires", () => {
    dispatchedEvents = [];
    useTimerStore.setState({
      timers: [{ id: "exp_t", title: "Countdown", mode: "custom", totalSeconds: 60, targetEndTime: Date.now() - 500, pausedSecondsLeft: null, isActive: true, isPinned: false, isDefault: false }],
      lastTick: Date.now(),
    });
    handleStoreTick();

    assert.strictEqual(dispatchedEvents.length, 1);
    assert.strictEqual(dispatchedEvents[0].type, "socratic_alarm_triggered");
    assert.strictEqual(dispatchedEvents[0].detail.alarmType, "timer");
    assert.strictEqual(multiTimerStore.getSnapshot().timers.find((t) => t.id === "exp_t").isActive, false);
    assert.strictEqual(isTickerRunning(), false, "Ticker must stop after expiry (0% idle CPU)");
  });

  it("migrates legacy raw array storage format seamlessly", () => {
    mockStorage[MULTI_TIMER_STORAGE_KEY] = JSON.stringify([{ id: "leg", title: "Legacy", totalSeconds: 1800, targetEndTime: null, pausedSecondsLeft: 900, isActive: false, isPinned: true, isDefault: false }]);
    const loaded = timerStorage.getItem(MULTI_TIMER_STORAGE_KEY);
    assert.ok(loaded?.state && Array.isArray(loaded.state.timers));
    assert.strictEqual(loaded.state.timers[0].title, "Legacy");
    assert.strictEqual(loaded.state.timers[0].pausedSecondsLeft, 900);
    assert.strictEqual(loaded.state.timers[0].isPinned, true);
  });
});
