import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DENATURE_TEMP,
  DENATURE_WIDTH,
  ENZYME_COLOURS,
  OPTIMUM_PH,
  OPTIMUM_TEMP,
  PH_STRESS_LIMIT,
  enzymeRate,
  phStress,
  solveEnzyme,
} from "../../lib/enzymes.js";

/** The temperature slider at the resolution the curve is drawn with. */
const TEMPS = Array.from({ length: 801 }, (_, i) => i / 10); // 0 → 80 °C
const PHS = Array.from({ length: 141 }, (_, i) => i / 10); // 0 → 14

describe("the optima", () => {
  it("peaks at human body temperature and neutral pH", () => {
    assert.equal(OPTIMUM_TEMP, 37);
    assert.equal(OPTIMUM_PH, 7);
    const peak = enzymeRate(OPTIMUM_TEMP, OPTIMUM_PH).rate;
    for (const t of TEMPS) {
      assert.ok(enzymeRate(t, OPTIMUM_PH).rate <= peak + 1e-12, `${t} °C beat the optimum`);
    }
    for (const p of PHS) {
      assert.ok(enzymeRate(OPTIMUM_TEMP, p).rate <= peak + 1e-12, `pH ${p} beat the optimum`);
    }
  });

  it("reaches essentially full rate at the optimum", () => {
    assert.ok(enzymeRate(37, 7).rate > 0.99);
  });

  it("falls away on both sides of each optimum", () => {
    assert.ok(enzymeRate(20, 7).rate < enzymeRate(30, 7).rate);
    assert.ok(enzymeRate(30, 7).rate < enzymeRate(37, 7).rate);
    assert.ok(enzymeRate(37, 4).rate < enzymeRate(37, 6).rate);
    assert.ok(enzymeRate(37, 10).rate < enzymeRate(37, 8).rate);
  });
});

describe("denaturation", () => {
  // The regression: the scene denatured at 50 °C and the panel at 55 °C while
  // its own note said "> 50 °C". At 52 °C the scene collapsed the rate to 9 %
  // and gaped the active site open while the panel reported 40 % and
  // "Complementary Lock".
  it("denatures at one temperature, and it is the one the note names", () => {
    assert.equal(DENATURE_TEMP, 50);
    assert.equal(enzymeRate(49.9, 7).denatured, false);
    assert.equal(enzymeRate(50.1, 7).denatured, true);
    assert.equal(solveEnzyme({ temperature: 52, ph: 7 }).denatured, true);
  });

  it("agrees between the rate model and the readout at every temperature", () => {
    for (const t of TEMPS) {
      const raw = enzymeRate(t, 7);
      const solved = solveEnzyme({ temperature: t, ph: 7 });
      assert.equal(solved.denatured, raw.denatured, `disagreement at ${t} °C`);
      assert.equal(solved.rate, raw.rate, `rate disagreement at ${t} °C`);
      assert.equal(solved.ratePercent, Math.round(raw.rate * 100));
    }
  });

  it("collapses the rate to nothing above the denaturation window", () => {
    assert.ok(enzymeRate(DENATURE_TEMP + DENATURE_WIDTH + 2, 7).rate < 1e-6);
    assert.equal(enzymeRate(70, 7).denaturation, 1);
    assert.equal(enzymeRate(20, 7).denaturation, 0);
  });

  // The regression: the collapse was a step — 0.557 just below 50 °C and 0.12
  // just above — drawn straight through as a vertical segment of the
  // rate-against-temperature curve, which is not a thing a graph may do.
  it("is a cliff, not a jump — the curve stays single-valued", () => {
    let biggest = 0;
    let at = null;
    for (let i = 1; i < TEMPS.length; i += 1) {
      const step = Math.abs(enzymeRate(TEMPS[i], 7).rate - enzymeRate(TEMPS[i - 1], 7).rate);
      if (step > biggest) {
        biggest = step;
        at = TEMPS[i];
      }
    }
    assert.ok(biggest < 0.05, `the curve jumps by ${biggest.toFixed(4)} at ${at} °C`);
  });

  it("is monotonic through the collapse — it never recovers on the way up", () => {
    let last = Infinity;
    for (let t = DENATURE_TEMP - 2; t <= 80; t += 0.1) {
      const r = enzymeRate(t, 7).rate;
      assert.ok(r <= last + 1e-9, `rate rose again at ${t.toFixed(1)} °C`);
      last = r;
    }
  });

  it("calls heat denaturation irreversible", () => {
    assert.equal(solveEnzyme({ temperature: 60, ph: 7 }).reversible, false);
    assert.equal(solveEnzyme({ temperature: 37, ph: 7 }).reversible, true);
  });
});

describe("pH", () => {
  it("stresses the active site further from neutral", () => {
    assert.equal(phStress(7), 0);
    assert.ok(phStress(2) > phStress(5));
    assert.ok(phStress(12) > phStress(9));
    for (const p of PHS) {
      const s = phStress(p);
      assert.ok(s >= 0 && s <= 1, `stress ${s} at pH ${p}`);
    }
  });

  it("calls a pH more than three from the optimum extreme", () => {
    assert.equal(PH_STRESS_LIMIT, 3);
    assert.equal(solveEnzyme({ temperature: 37, ph: 7 }).extremePh, false);
    assert.equal(solveEnzyme({ temperature: 37, ph: 10 }).extremePh, false);
    assert.equal(solveEnzyme({ temperature: 37, ph: 10.5 }).extremePh, true);
    assert.equal(solveEnzyme({ temperature: 37, ph: 3 }).extremePh, true);
  });

  it("says the active site is the wrong shape whenever it is wrecked", () => {
    const hot = solveEnzyme({ temperature: 60, ph: 7 });
    const acid = solveEnzyme({ temperature: 37, ph: 2 });
    const fine = solveEnzyme({ temperature: 37, ph: 7 });
    assert.match(hot.activeSite, /no longer fits/);
    assert.match(acid.activeSite, /no longer fits/);
    assert.match(fine.activeSite, /complementary/);
    assert.equal(acid.reversible, false);
  });
});

describe("solveEnzyme — what the readout prints", () => {
  it("keeps the rate a fraction across the whole slider space", () => {
    for (const t of [0, 10, 25, 37, 45, 50, 55, 70, 80]) {
      for (const p of [0, 2, 4, 7, 9, 11, 14]) {
        const s = solveEnzyme({ temperature: t, ph: p });
        assert.ok(s.rate >= 0 && s.rate <= 1, `rate ${s.rate} at ${t} °C pH ${p}`);
        assert.ok(s.ratePercent >= 0 && s.ratePercent <= 100);
        assert.ok(s.distortion >= 0 && s.distortion <= 1);
        assert.ok(s.denaturation >= 0 && s.denaturation <= 1);
      }
    }
  });

  it("distorts the active site more as heat and pH stress build", () => {
    const calm = solveEnzyme({ temperature: 37, ph: 7 });
    const acid = solveEnzyme({ temperature: 37, ph: 1 });
    const hot = solveEnzyme({ temperature: 65, ph: 7 });
    assert.equal(calm.distortion, 0);
    assert.ok(acid.distortion > calm.distortion);
    assert.ok(hot.distortion > calm.distortion);
  });

  it("flags a cold enzyme as slow but not denatured", () => {
    const cold = solveEnzyme({ temperature: 5, ph: 7 });
    assert.equal(cold.tooCold, true);
    assert.equal(cold.denatured, false);
    assert.equal(cold.reversible, true, "cold is the one thing an enzyme recovers from");
    assert.equal(solveEnzyme({ temperature: 60, ph: 7 }).tooCold, false);
    assert.equal(solveEnzyme({ temperature: 30, ph: 7 }).tooCold, false);
  });

  it("has usable defaults at the optimum", () => {
    const s = solveEnzyme();
    assert.equal(s.temperature, 37);
    assert.equal(s.ph, 7);
    assert.equal(s.ratePercent, 100);
  });
});

describe("the colour key", () => {
  it("draws a denatured enzyme in a different colour from a working one", () => {
    assert.notEqual(ENZYME_COLOURS.enzyme, ENZYME_COLOURS.denatured);
    assert.notEqual(ENZYME_COLOURS.substrate, ENZYME_COLOURS.product);
    for (const c of Object.values(ENZYME_COLOURS)) assert.match(c, /^#[0-9a-f]{6}$/i);
  });
});
