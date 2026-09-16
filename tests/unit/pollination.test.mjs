import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GENERATIVE_DIVISION_FRACTION,
  HOURS_PER_SECOND,
  MICROPYLE_OVERSHOOT,
  PLOIDY,
  POLLINATION_TIMELINE,
  STAGES,
  STYLE_LENGTH_MM,
  TIMELINE_SECONDS,
  TUBE_GROWTH_MM_PER_H,
  VECTORS,
  describePollination,
  hoursAfterPollination,
  nucleiPositions,
  timeLabel,
  tubeFraction,
  vectorFor,
} from "../../lib/pollination.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const tl = POLLINATION_TIMELINE;
const at = (key, frac = 0) => tl.byKey[key].start + tl.byKey[key].duration * frac;

describe("The two vectors", () => {
  it("describe pollen and flower built for wind or for insects", () => {
    assert.equal(VECTORS.wind.pollen.sticky, false);
    assert.equal(VECTORS.wind.pollen.spiky, false);
    assert.equal(VECTORS.wind.nectar, false);
    assert.equal(VECTORS.insect.pollen.sticky, true);
    assert.equal(VECTORS.insect.pollen.spiky, true);
    assert.equal(VECTORS.insect.nectar, true);
    assert.equal(vectorFor("wind").key, "wind");
    assert.equal(vectorFor("nonsense").key, "insect", "falls back to insect");
  });

  it("change nothing about what happens after the grain lands", () => {
    for (const t of [3, 6, 9, 12]) {
      const a = describePollination(t, "wind");
      const b = describePollination(t, "insect");
      assert.equal(a.stage, b.stage);
      assert.ok(close(a.tubeMm, b.tubeMm));
      assert.equal(a.fertilised, b.fertilised);
    }
  });
});

describe("The timeline", () => {
  it("runs arrival → landing → germination → growth → entry → fertilisation", () => {
    assert.deepEqual(STAGES.map((s) => s.key), ["arrival", "landing", "germination", "growth", "entry", "fertilisation"]);
    assert.ok(close(TIMELINE_SECONDS, tl.total));
    assert.ok(close(tl.byKey.growth.duration, STYLE_LENGTH_MM / (TUBE_GROWTH_MM_PER_H * HOURS_PER_SECOND)), "growth lasts as long as the style takes at 1.5 mm/h");
  });

  it("separates pollination from fertilisation in time", () => {
    const landed = describePollination(at("landing", 1));
    assert.equal(landed.pollinated, true);
    assert.equal(landed.fertilised, false);
    assert.equal(landed.status, "pollinated — not yet fertilised");
    const before = describePollination(at("landing", 0.5));
    assert.equal(before.pollinated, false);
    assert.equal(before.status, "not yet pollinated");
    const done = describePollination(tl.total);
    assert.equal(done.pollinated, true);
    assert.equal(done.fertilised, true);
    assert.equal(done.complete, true);
    assert.equal(done.status, "pollinated and fertilised");
  });

  it("counts hours from the moment of landing", () => {
    assert.equal(hoursAfterPollination(0), 0);
    assert.equal(hoursAfterPollination(at("landing", 1)), 0);
    assert.ok(close(hoursAfterPollination(at("landing", 1) + 2), 2 * HOURS_PER_SECOND));
    const end = describePollination(at("growth", 1));
    assert.ok(close(end.hoursAfterPollination, (tl.byKey.germination.duration + tl.byKey.growth.duration) * HOURS_PER_SECOND));
  });
});

describe("The pollen tube", () => {
  it("is nothing before germination, the style's length at the end of growth, and a little more once inside the ovule", () => {
    assert.equal(tubeFraction(0), 0);
    assert.equal(tubeFraction(at("landing", 1)), 0);
    assert.ok(tubeFraction(at("germination", 1)) > 0 && tubeFraction(at("germination", 1)) < 0.05);
    assert.ok(close(tubeFraction(at("growth", 1)), 1));
    assert.ok(close(tubeFraction(at("entry", 1)), 1 + MICROPYLE_OVERSHOOT));
    const half = describePollination(at("growth", 0.5));
    assert.ok(half.tubeMm > 5.5 && half.tubeMm < 6.5);
    assert.equal(half.growthRateMmPerH, TUBE_GROWTH_MM_PER_H);
    assert.equal(describePollination(at("entry", 0.5)).growthRateMmPerH, 0);
    assert.ok(describePollination(tl.total).tubeMm <= STYLE_LENGTH_MM);
  });

  it("grows monotonically", () => {
    let last = -1;
    for (let t = 0; t <= tl.total; t += 0.05) {
      const f = tubeFraction(t);
      assert.ok(f >= last - 1e-12, `tube shrank at t=${t}`);
      last = f;
    }
  });
});

describe("The nuclei", () => {
  it("appear after germination, with the generative nucleus dividing part-way down", () => {
    assert.equal(nucleiPositions(0).tube, null);
    const early = nucleiPositions(at("growth", 0.2));
    assert.ok(early.tube !== null && early.generative !== null);
    assert.equal(early.divided, false);
    assert.equal(early.sperm1, null);
    const late = nucleiPositions(at("growth", 0.7));
    assert.equal(late.divided, true);
    assert.equal(late.generative, null);
    assert.ok(late.sperm1 !== null && late.sperm2 !== null);
    assert.ok(late.tube > late.sperm1 && late.sperm1 > late.sperm2, "tube nucleus leads, sperm follow");
    assert.ok(tubeFraction(at("growth", 0.7)) >= GENERATIVE_DIVISION_FRACTION);
  });

  it("fuse in order: zygote first, then endosperm", () => {
    const start = describePollination(at("fertilisation", 0.1));
    assert.equal(start.zygoteFormed, false);
    assert.ok(start.nuclei.sperm1 !== null);
    const mid = describePollination(at("fertilisation", 0.6));
    assert.equal(mid.zygoteFormed, true);
    assert.equal(mid.endospermFormed, false);
    assert.equal(mid.nuclei.sperm1, null, "first sperm has fused with the egg");
    assert.ok(mid.nuclei.sperm2 !== null, "second sperm still on its way");
    assert.equal(mid.status, "first fusion done — zygote formed");
    const end = describePollination(at("fertilisation", 1));
    assert.equal(end.endospermFormed, true);
    assert.equal(end.nuclei.sperm2, null);
    assert.equal(PLOIDY.zygote, "2n");
    assert.equal(PLOIDY.endosperm, "3n");
  });
});

describe("Captions", () => {
  it("say where the slider is", () => {
    assert.match(timeLabel(0), /before pollination/);
    assert.match(timeLabel(1), /arrival/);
    assert.match(timeLabel(at("growth", 0.5)), /h after pollination/);
  });

  it("tolerate bad input", () => {
    const d = describePollination(NaN, undefined);
    assert.equal(d.t, 0);
    assert.equal(d.vector.key, "insect");
    assert.equal(describePollination(-5).t, 0);
    assert.equal(describePollination(1e9).complete, true);
  });
});
