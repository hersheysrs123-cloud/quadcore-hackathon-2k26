import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advanceTimeline,
  describeTimeline,
  makeTimeline,
  pulse,
  ramp,
  smoothstep,
  stageDone,
  stageProgress,
  stageStarted,
  stageWindow,
} from "../../lib/timeline.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

const TL = makeTimeline([
  { key: "a", label: "First", duration: 2 },
  { key: "b", label: "Second", duration: 3 },
  { key: "c", label: "Third", duration: 1 },
]);

describe("Laying out a timeline", () => {
  it("places stages end to end and totals them", () => {
    assert.equal(TL.total, 6);
    assert.deepEqual(TL.stages.map((s) => [s.key, s.start, s.end, s.index]), [["a", 0, 2, 0], ["b", 2, 5, 1], ["c", 5, 6, 2]]);
    assert.equal(stageWindow(TL, "b").start, 2);
    assert.throws(() => stageWindow(TL, "zzz"), /no stage/);
  });

  it("treats a missing or negative duration as zero", () => {
    const t = makeTimeline([{ key: "x" }, { key: "y", duration: -4 }, { key: "z", duration: 1 }]);
    assert.equal(t.total, 1);
    assert.equal(t.byKey.z.start, 0);
  });
});

describe("Reading the clock", () => {
  it("names the stage and how far through it we are", () => {
    const d = describeTimeline(TL, 3.5);
    assert.equal(d.stage, "b");
    assert.equal(d.label, "Second");
    assert.ok(close(d.stageT, 1.5));
    assert.ok(close(d.progress, 0.5));
    assert.ok(close(d.fraction, 3.5 / 6));
    assert.equal(d.complete, false);
    assert.equal(d.started, true);
    assert.ok(close(d.remaining, 2.5));
  });

  it("starts in the first stage at zero and ends held in the last", () => {
    const start = describeTimeline(TL, 0);
    assert.equal(start.stage, "a");
    assert.equal(start.started, false);
    assert.equal(start.progress, 0);
    const end = describeTimeline(TL, 6);
    assert.equal(end.stage, "c");
    assert.equal(end.complete, true);
    assert.equal(end.progress, 1);
    const past = describeTimeline(TL, 99);
    assert.equal(past.t, 6, "clamped");
    assert.equal(past.complete, true);
    const bad = describeTimeline(TL, NaN);
    assert.equal(bad.t, 0);
  });

  it("gives a stage's own progress: 0 before, 1 after", () => {
    assert.equal(stageProgress(TL, "b", 1), 0);
    assert.ok(close(stageProgress(TL, "b", 3.5), 0.5));
    assert.equal(stageProgress(TL, "b", 5), 1);
    assert.equal(stageProgress(TL, "b", 6), 1);
    assert.equal(stageStarted(TL, "b", 1.99), false);
    assert.equal(stageStarted(TL, "b", 2), true);
    assert.equal(stageDone(TL, "b", 4.99), false);
    assert.equal(stageDone(TL, "b", 5), true);
  });

  it("copes with an empty timeline", () => {
    const empty = makeTimeline([]);
    const d = describeTimeline(empty, 1);
    assert.equal(d.stage, null);
    assert.equal(d.complete, true);
  });
});

describe("Advancing", () => {
  it("moves forward and holds at the end", () => {
    assert.equal(advanceTimeline(TL, 0, 1.5), 1.5);
    assert.equal(advanceTimeline(TL, 5.5, 3), 6);
    assert.equal(advanceTimeline(TL, 2, -1), 2, "never runs backwards");
  });
});

describe("Easing", () => {
  it("ramps, eases and pulses inside [0, 1]", () => {
    assert.equal(ramp(0, 1, 3), 0);
    assert.ok(close(ramp(2, 1, 3), 0.5));
    assert.equal(ramp(9, 1, 3), 1);
    assert.equal(ramp(5, 3, 3), 1, "a zero-width ramp is a step");
    assert.equal(smoothstep(0), 0);
    assert.equal(smoothstep(1), 1);
    assert.ok(close(smoothstep(0.5), 0.5));
    assert.ok(smoothstep(0.25) < 0.25 && smoothstep(0.75) > 0.75);
    assert.equal(pulse(0), 0);
    assert.ok(close(pulse(0.5), 1));
    assert.equal(pulse(1), 0);
    assert.ok(close(pulse(0.3, 0.3), 1));
  });
});
