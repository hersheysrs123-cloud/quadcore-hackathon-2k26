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
