// ─── The multi-timer subsystem ───────────────────────────────────────
// The clock arithmetic used to be reimplemented at the top of this file —
// calculateSecondsRemaining, startTimer, pauseTimer, resetTimer and a
// validateDurationMins that disagreed with the shipping clamp about what
// "−50 minutes" means. lib/timerStore.js now exports the real ones and
// the store's own actions are built out of them, so this file tests the
// code that runs.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// The store module touches window/localStorage on import, so the globals
// have to exist before it loads.
let dispatchedEvents = [];
globalThis.window = { dispatchEvent: (e) => dispatchedEvents.push(e) };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
const mockStorage = {};
globalThis.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
};

const {
  secondsRemaining, resumeTimer, pauseTimer, clearTimer, clampDurationMins,
  MIN_TIMER_MINS, MAX_TIMER_MINS, DEFAULT_TIMER_MINS,
  useTimerStore, multiTimerStore, isTickerRunning,
  handleStoreTick, timerStorage, sanitizeTimer,
  MULTI_TIMER_STORAGE_KEY, defaultTimers,
} = await import("../../lib/timerStore.js");

describe("Multi-Timer clock arithmetic (lib/timerStore.js)", () => {
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

    assert.strictEqual(secondsRemaining(runningTimer, baseTime), 1500);
    assert.strictEqual(secondsRemaining(runningTimer, baseTime + 10000), 1490);
    assert.strictEqual(secondsRemaining(runningTimer, baseTime + 1500000), 0);
    assert.strictEqual(secondsRemaining(runningTimer, baseTime + 2000000), 0, "never counts past zero into negatives");
  });

  it("reads a stopped timer from its banked or full duration", () => {
    assert.strictEqual(secondsRemaining(pomodoroPreset, 1000000), 1500, "untouched: the full duration");
    assert.strictEqual(
      secondsRemaining({ ...pomodoroPreset, pausedSecondsLeft: 742 }, 1000000),
      742,
      "paused: what was banked, whatever the wall clock has done since",
    );
  });

  it("preserves exact remaining time when paused and resumed", () => {
    const baseTime = 1000000;
    const started = resumeTimer(pomodoroPreset, baseTime);

    const after5Mins = baseTime + 300 * 1000;
    const paused = pauseTimer(started, after5Mins);

    assert.strictEqual(paused.isActive, false);
    assert.strictEqual(paused.pausedSecondsLeft, 1200); // 20 mins left

    const resumed = resumeTimer(paused, baseTime + 3600 * 1000);
    assert.strictEqual(resumed.isActive, true);
    assert.strictEqual(secondsRemaining(resumed, baseTime + 3600 * 1000), 1200);
  });

  it("leaves an already-stopped timer alone when paused again", () => {
    assert.strictEqual(pauseTimer(pomodoroPreset, 1000000), pomodoroPreset);
  });

  it("resumes from the full duration when the banked time ran out", () => {
    const spent = { ...pomodoroPreset, pausedSecondsLeft: 0 };
    assert.strictEqual(secondsRemaining(resumeTimer(spent, 1000000), 1000000), 1500);
  });

  it("resets timer back to initial total duration cleanly", () => {
    const started = resumeTimer(pomodoroPreset);
    const reset = clearTimer(started);

    assert.strictEqual(reset.isActive, false);
    assert.strictEqual(reset.targetEndTime, null);
    assert.strictEqual(reset.pausedSecondsLeft, null);
    assert.strictEqual(secondsRemaining(reset), 1500);
  });

  it("validates and clamps custom timer minutes between 1m and 180m", () => {
    assert.strictEqual(clampDurationMins(25), 25);
    assert.strictEqual(clampDurationMins(0), DEFAULT_TIMER_MINS);
    assert.strictEqual(clampDurationMins(-50), DEFAULT_TIMER_MINS, "nonsense is the default, not the floor");
    assert.strictEqual(clampDurationMins(500), MAX_TIMER_MINS);
    assert.strictEqual(clampDurationMins("invalid"), DEFAULT_TIMER_MINS);
    assert.strictEqual(clampDurationMins(undefined), DEFAULT_TIMER_MINS);
    assert.strictEqual(clampDurationMins(0.4), MIN_TIMER_MINS, "a fraction of a minute rounds up to the floor");
    assert.strictEqual(clampDurationMins("45"), 45, "a numeric string from an input element is fine");
  });
});

describe("Zustand Timer Store Engine (lib/timerStore.js)", () => {
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

  it("banks the remaining seconds through the store's own pause", () => {
    useTimerStore.setState({ timers: defaultTimers, lastTick: Date.now() });
    multiTimerStore.togglePlayPause("short_break"); // 300 s
    multiTimerStore.togglePlayPause("short_break");
    const paused = multiTimerStore.getSnapshot().timers.find((t) => t.id === "short_break");
    assert.strictEqual(paused.targetEndTime, null);
    assert.ok(
      paused.pausedSecondsLeft > 295 && paused.pausedSecondsLeft <= 300,
      `banked ${paused.pausedSecondsLeft}s of a 300s break`,
    );
    multiTimerStore.resetTimer("short_break");
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

  it("clamps a new timer's duration through the store, not just in the form", () => {
    useTimerStore.setState({ timers: defaultTimers, lastTick: Date.now() });
    multiTimerStore.addTimer("Marathon", 900, "custom");
    multiTimerStore.addTimer("Nonsense", -50, "custom");
    const timers = multiTimerStore.getSnapshot().timers;
    assert.strictEqual(timers.find((t) => t.title === "Marathon").totalSeconds, MAX_TIMER_MINS * 60);
    assert.strictEqual(timers.find((t) => t.title === "Nonsense").totalSeconds, DEFAULT_TIMER_MINS * 60);
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

  it("leaves a still-running timer alone on a tick", () => {
    dispatchedEvents = [];
    useTimerStore.setState({
      timers: [{ id: "live_t", title: "Countdown", mode: "custom", totalSeconds: 600, targetEndTime: Date.now() + 600_000, pausedSecondsLeft: null, isActive: true, isPinned: false, isDefault: false }],
      lastTick: 0,
    });
    handleStoreTick();
    assert.strictEqual(dispatchedEvents.length, 0);
    assert.strictEqual(multiTimerStore.getSnapshot().timers[0].isActive, true);
    multiTimerStore.resetTimer("live_t");
  });

  it("migrates legacy raw array storage format seamlessly", () => {
    mockStorage[MULTI_TIMER_STORAGE_KEY] = JSON.stringify([{ id: "leg", title: "Legacy", totalSeconds: 1800, targetEndTime: null, pausedSecondsLeft: 900, isActive: false, isPinned: true, isDefault: false }]);
    const loaded = timerStorage.getItem(MULTI_TIMER_STORAGE_KEY);
    assert.ok(loaded?.state && Array.isArray(loaded.state.timers));
    assert.strictEqual(loaded.state.timers[0].title, "Legacy");
    assert.strictEqual(loaded.state.timers[0].pausedSecondsLeft, 900);
    assert.strictEqual(loaded.state.timers[0].isPinned, true);
  });

  it("sanitizes a timer read back off disk into the shape the clock expects", () => {
    const t = sanitizeTimer({ id: "x", title: "x", totalSeconds: "1800", targetEndTime: "1700", pausedSecondsLeft: "42", isActive: 1, isPinned: 0 });
    assert.strictEqual(t.totalSeconds, 1800);
    assert.strictEqual(t.targetEndTime, 1700);
    assert.strictEqual(t.pausedSecondsLeft, 42);
    assert.strictEqual(t.isActive, true);
    assert.strictEqual(t.isPinned, false);
    // Active, so the deadline wins over the banked seconds — the same
    // precedence the live clock uses, on numbers that came back as strings.
    assert.strictEqual(secondsRemaining(t, 0), 2);
    assert.strictEqual(secondsRemaining(clearTimer(t), 0), 1800);
  });
});
