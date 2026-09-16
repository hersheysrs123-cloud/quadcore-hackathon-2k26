import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advanceCycle,
  createStepper,
  cycleDelta,
  describeCycle,
  holdTime,
  makeCycle,
  stageBlend,
  stageWindow,
  stepIndex,
  stepperJump,
  stepperLock,
  stepperNext,
  stepperPause,
  stepperPlay,
  stepperPrev,
  stepperSnapshot,
  stepperTick,
  wrapTime,
} from "../../lib/stageCycle.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const CYCLE = makeCycle([
  { key: "a", label: "A", duration: 1 },
  { key: "b", label: "B", duration: 1, hold: 0.5 },
  { key: "c", label: "C", duration: 2 },
]);

/** Run the machine for `seconds` of wall time in small steps. */
const run = (state, seconds, speed = 1, tempo = null, step = 1 / 60) => {
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += step) s = stepperTick(CYCLE, s, step, speed, tempo);
  return s;
};

describe("makeCycle", () => {
  it("lays stages end to end with absolute hold points", () => {
    assert.equal(CYCLE.total, 4);
    assert.deepEqual(CYCLE.stages.map((s) => [s.start, s.end]), [[0, 1], [1, 2], [2, 4]]);
    assert.equal(CYCLE.byKey.a.hold, 0.5, "hold defaults to the midpoint");
    assert.equal(CYCLE.byKey.b.hold, 1.5);
    assert.equal(CYCLE.byKey.c.hold, 3);
    assert.equal(CYCLE.byKey.c.short, "C", "short falls back to the label");
  });
});

describe("wrapping", () => {
  it("takes time modulo the total and counts laps", () => {
    assert.equal(wrapTime(CYCLE, 4.5), 0.5);
    assert.equal(wrapTime(CYCLE, -0.5), 3.5);
    assert.equal(describeCycle(CYCLE, 9.2).lap, 2);
    assert.equal(describeCycle(CYCLE, 9.2).stage, "b");
    assert.ok(close(describeCycle(CYCLE, 9.2).progress, 0.2));
  });

  it("steps the index round in both directions", () => {
    assert.equal(stepIndex(CYCLE, 2, 1), 0);
    assert.equal(stepIndex(CYCLE, 0, -1), 2);
  });

  it("finds the shorter way round, or forward only when asked", () => {
    assert.ok(close(cycleDelta(CYCLE, 3.5, 0.5), 1));
    assert.ok(close(cycleDelta(CYCLE, 0.5, 3.5), -1));
    assert.ok(close(cycleDelta(CYCLE, 0.5, 3.5, { forwardOnly: true }), 3));
  });

  it("blends and windows a stage", () => {
    assert.equal(stageBlend(CYCLE, 0.5, "b"), 0);
    assert.equal(stageBlend(CYCLE, 1.5, "b"), 0.5);
    assert.equal(stageBlend(CYCLE, 2.5, "b"), 1);
    assert.equal(stageWindow(CYCLE, 1.5, "b"), 1);
    assert.equal(stageWindow(CYCLE, 2.5, "b"), 0);
  });
});

describe("advanceCycle", () => {
  it("splits a step at a stage boundary so each stretch runs at its own tempo", () => {
    // 0.1 s at tempo 1 reaches the boundary at t = 1; the remaining 0.4 s run at tempo 4.
    const r = advanceCycle(CYCLE, 0.9, 0.5, null, (i) => (i === 0 ? 1 : 4));
    assert.ok(close(r.t, 2.6), `got ${r.t}`);
    assert.equal(r.hit, false);
  });

  it("stops on a lock's hold point and reports the hit", () => {
    const r = advanceCycle(CYCLE, 0.9, 5, 1);
    assert.ok(close(r.t, 1.5));
    assert.equal(r.hit, true);
    assert.equal(advanceCycle(CYCLE, 1.5, 1, 1).hit, true, "sitting on the lock stays put");
  });
});

describe("the stepper", () => {
  it("parks a new stepper on its stage's hold point", () => {
    const s = createStepper(CYCLE, { index: 1 });
    assert.equal(s.t, 1.5);
    assert.equal(s.playing, false);
  });

  it("plays continuously, wraps, and reports the stage under the playhead", () => {
    let s = createStepper(CYCLE, { index: 0, playing: true });
    s = run(s, 5);
    assert.ok(s.t > 5.4 && s.t < 5.6, `t = ${s.t}`);
    assert.equal(s.index, 1, "5.5 wraps to 1.5, in stage b");
    assert.equal(describeCycle(CYCLE, s.t).lap, 1);
  });

  it("scales the playing clock by speed and per-stage tempo but not a tween", () => {
    let s = createStepper(CYCLE, { index: 0, playing: true });
    s = run(s, 1, 2);
    assert.ok(close(s.t, 2.5, 0.05), `speed 2 for 1 s → 2.5, got ${s.t}`);
    let q = createStepper(CYCLE, { index: 0, playing: true });
    q = run(q, 1, 1, [0.5, 1, 1]);
    assert.ok(close(q.t, 1.0, 0.05), `stage a at half tempo takes 2 s; after 1 s we are at 1.0, got ${q.t}`);
    // A step-mode tween ignores speed.
    let a = stepperJump(CYCLE, createStepper(CYCLE, { index: 0 }), 1);
    let b = stepperJump(CYCLE, createStepper(CYCLE, { index: 0 }), 1);
    a = run(a, 0.2, 1);
    b = run(b, 0.2, 3);
    assert.ok(close(a.t, b.t, 1e-6), "tween progress is wall-clock, whatever the speed");
  });

  it("stepping tweens to the target's hold point and parks there", () => {
    let s = createStepper(CYCLE, { index: 0 });
    s = stepperNext(CYCLE, s);
    assert.equal(s.index, 1);
    assert.ok(s.tween, "a tween is under way");
    const mid = run(s, s.tween.duration / 2);
    assert.ok(mid.t > 0.5 && mid.t < 1.5, "part-way there");
    assert.equal(stepperSnapshot(CYCLE, mid).transitioning, true);
    s = run(s, 3);
    assert.ok(close(s.t, 1.5), `parked on b's hold, got ${s.t}`);
    assert.equal(s.tween, null);
    assert.equal(stepperSnapshot(CYCLE, s).transitioning, false);
  });

  it("prev from the first stage rewinds across the wrap by the shorter way", () => {
    let s = createStepper(CYCLE, { index: 0 });
    s = stepperPrev(CYCLE, s);
    assert.equal(s.index, 2);
    assert.ok(s.tween.to < s.tween.from, "goes backwards through the wrap rather than forward through b");
    s = run(s, 3);
    assert.ok(close(wrapTime(CYCLE, s.t), holdTime(CYCLE, 2)));
  });

  it("a jump while playing cuts to the stage's start and keeps playing", () => {
    let s = createStepper(CYCLE, { index: 0, playing: true });
    s = stepperJump(CYCLE, s, 2);
    assert.equal(s.t, 2);
    assert.equal(s.playing, true);
    s = run(s, 0.5);
    assert.ok(s.t > 2.4, "still advancing");
  });

  it("pause parks on the stage under the playhead; play resumes from there", () => {
    let s = createStepper(CYCLE, { index: 0, playing: true });
    s = run(s, 2.6);
    s = stepperPause(CYCLE, s);
    assert.equal(s.playing, false);
    assert.equal(s.index, 2);
    const parked = run(s, 1);
    assert.ok(close(parked.t, s.t), "a paused clock does not move");
    const resumed = run(stepperPlay(CYCLE, s), 0.5);
    assert.ok(resumed.t > s.t + 0.4);
  });

  it("a lock stops play at that stage's hold point and clamps stepping beyond it", () => {
    let s = createStepper(CYCLE, { index: 0, playing: true });
    s = stepperLock(CYCLE, s, 1);
    s = run(s, 5);
    assert.ok(close(s.t, 1.5), `held at b's hold, got ${s.t}`);
    assert.equal(s.arrested, true);
    assert.equal(stepperSnapshot(CYCLE, s).arrested, true);
    // Stepping past the lock lands on the lock.
    let p = stepperLock(CYCLE, createStepper(CYCLE, { index: 0 }), 1);
    p = stepperJump(CYCLE, p, 2);
    assert.equal(p.index, 1);
    p = run(p, 3);
    assert.ok(close(p.t, 1.5));
    assert.equal(p.arrested, true);
  });

  it("locking a cell that is already past the lock runs it forward to the NEXT one, never backwards", () => {
    let s = createStepper(CYCLE, { index: 2 });
    s = stepperLock(CYCLE, s, 1);
    assert.ok(s.tween && s.tween.to > s.tween.from, "forward tween");
    assert.ok(close(s.tween.to, 5.5), "round the wrap to the next b");
    s = run(s, 3);
    assert.ok(close(wrapTime(CYCLE, s.t), 1.5));
    assert.equal(s.arrested, true);
    const released = stepperLock(CYCLE, s, null);
    assert.equal(released.lock, null);
    assert.equal(released.arrested, false);
  });
});
