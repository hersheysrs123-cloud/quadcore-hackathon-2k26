import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BARRIERS,
  BARRIER_ORDER,
  CURVE_HALF_LIVES,
  DEFAULT_ATOMS,
  LAMBDA,
  MAX_ATOMS,
  MIN_ATOMS,
  MODES,
  MODE_ORDER,
  PARTICLE_KINDS,
  SIM_HALF_LIFE_S,
  activityBq,
  createDecayState,
  deflection,
  describeSample,
  formatDuration,
  halfLifeIntervals,
  halfLifeLabel,
  measuredRate,
  nuclearEquation,
  nuclideSymbol,
  penetrates,
  realSecondsPerSimSecond,
  stepDecay,
  theoreticalN,
  transmission,
} from "../../lib/radioactiveDecay.js";

const near = (a, b, tol) => Math.abs(a - b) <= tol;

/** Mulberry32, so every run of this file rolls the same dice. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(state, seconds, rng) {
  let s = state;
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i += 1) s = stepDecay(s, { dt: 1 / 60, rng });
  return s;
}

describe("radioactive decay · conservation", () => {
  it("every mode's equation balances A and Z, computed from the nuclide data", () => {
    for (const id of MODE_ORDER) {
      const eq = nuclearEquation(id);
      assert.ok(eq.conservedA, `${id}: A ${eq.left.A} vs ${eq.right.A}`);
      assert.ok(eq.conservedZ, `${id}: Z ${eq.left.Z} vs ${eq.right.Z}`);
    }
  });

  it("alpha: A −4, Z −2 · β⁻: Z +1 · β⁺: Z −1 · gamma: unchanged", () => {
    assert.deepEqual([nuclearEquation("alpha").deltaA, nuclearEquation("alpha").deltaZ], [-4, -2]);
    assert.deepEqual([nuclearEquation("beta_minus").deltaA, nuclearEquation("beta_minus").deltaZ], [0, 1]);
    assert.deepEqual([nuclearEquation("beta_plus").deltaA, nuclearEquation("beta_plus").deltaZ], [0, -1]);
    assert.deepEqual([nuclearEquation("gamma").deltaA, nuclearEquation("gamma").deltaZ], [0, 0]);
  });

  it("writes the syllabus equations", () => {
    assert.equal(nuclearEquation("alpha").text, "²³⁸₉₂U → ²³⁴₉₀Th + ⁴₂He");
    assert.equal(nuclearEquation("beta_minus").text, "¹⁴₆C → ¹⁴₇N + ⁰₋₁e + ν̄ₑ");
    assert.equal(nuclearEquation("beta_plus").text, "¹⁸₉F → ¹⁸₈O + ⁰₁e + νₑ");
    assert.equal(nuclearEquation("gamma").text, "⁹⁹ᵐ₄₃Tc → ⁹⁹₄₃Tc + γ");
    assert.equal(nuclideSymbol({ symbol: "He", A: 4, Z: 2 }), "⁴₂He");
  });

  it("the nuclides are the ones the syllabus names", () => {
    assert.equal(MODES.alpha.parent.name, "uranium-238");
    assert.equal(MODES.beta_minus.parent.name, "carbon-14");
    assert.equal(MODES.beta_plus.emissions[0].name, "positron");
    assert.equal(MODES.gamma.parent.metastable, true);
  });
});

describe("radioactive decay · the dice", () => {
  it("ten thousand atoms: half remain after one sim half-life, to within 2%", () => {
    const rng = seeded(1);
    const s = run(createDecayState(MAX_ATOMS), SIM_HALF_LIFE_S, rng);
    assert.ok(near(s.alive / s.n0, 0.5, 0.02), `left ${s.alive}`);
    assert.equal(s.alive + s.totalDecays, s.n0);
  });

  it("follows N₀e^(−λt) over six half-lives at 10 000 atoms, and stamps every half-life at ≈10 s intervals", () => {
    const rng = seeded(2);
    let s = createDecayState(MAX_ATOMS);
    for (let k = 1; k <= CURVE_HALF_LIVES; k += 1) {
      s = run(s, SIM_HALF_LIFE_S, rng);
      const expected = theoreticalN(s.n0, s.t);
      assert.ok(Math.abs(s.alive - expected) / s.n0 < 0.02, `after ${k} t½: ${s.alive} vs ${expected.toFixed(0)}`);
    }
    assert.ok(s.halfLifeMarks.length >= 5, `marks ${s.halfLifeMarks.length}`);
    for (const gap of halfLifeIntervals(s.halfLifeMarks).slice(0, 5)) assert.ok(near(gap, SIM_HALF_LIFE_S, 1.2), `interval ${gap}`);
  });

  it("a hundred atoms scatter more than ten thousand — the statistical point", () => {
    const spread = (n, runs) => {
      const gaps = [];
      for (let r = 0; r < runs; r += 1) {
        const s = run(createDecayState(n), SIM_HALF_LIFE_S * 4, seeded(100 + r));
        for (const g of halfLifeIntervals(s.halfLifeMarks).slice(0, 2)) gaps.push(g);
      }
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      return Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
    };
    const small = spread(MIN_ATOMS, 8);
    const large = spread(MAX_ATOMS, 4);
    assert.ok(small > large * 2, `scatter small ${small.toFixed(2)} vs large ${large.toFixed(2)}`);
  });

  it("each step reports exactly the indices that decayed, and never a decayed atom twice", () => {
    const rng = seeded(3);
    let s = createDecayState(500);
    const seen = new Set();
    for (let i = 0; i < 600; i += 1) {
      s = stepDecay(s, { dt: 1 / 60, rng });
      for (const idx of s.decayedNow) {
        assert.ok(!seen.has(idx), `atom ${idx} decayed twice`);
        seen.add(idx);
        assert.equal(s.status[idx], 1);
      }
    }
    assert.equal(seen.size, s.totalDecays);
    assert.equal(s.alive, 500 - seen.size);
  });

  it("a zero step changes nothing; the old state object is never mutated", () => {
    const s0 = createDecayState(50);
    const s1 = stepDecay(s0, { dt: 0, rng: seeded(4) });
    assert.equal(s1.alive, 50);
    assert.equal(s1.t, 0);
    assert.equal(s0.t, 0);
    const s2 = run(s1, 5, seeded(5));
    assert.equal(s1.alive, 50, "scalars of the earlier state untouched");
    assert.ok(s2.alive < 50);
  });

  it("finishes when the last nucleus goes, and the count rate follows the survivors", () => {
    const rng = seeded(6);
    let s = createDecayState(MIN_ATOMS);
    s = run(s, SIM_HALF_LIFE_S * 20, rng);
    assert.equal(s.alive, 0);
    assert.equal(s.finished, true);
    assert.equal(measuredRate(s), 0);
    const fresh = run(createDecayState(MAX_ATOMS), 1.5, seeded(7));
    assert.ok(near(measuredRate(fresh), activityBq(fresh.alive), activityBq(fresh.alive) * 0.15), `rate ${measuredRate(fresh)} vs λN ${activityBq(fresh.alive)}`);
  });

  it("λ = ln2 / t½ and A = λN", () => {
    assert.ok(near(LAMBDA, Math.LN2 / SIM_HALF_LIFE_S, 1e-12));
    assert.ok(near(activityBq(1000), 69.3, 0.05));
    assert.ok(near(theoreticalN(1000, SIM_HALF_LIFE_S * 3), 125, 1e-9));
  });

  it("clamps the sample to the slider's range and defaults sensibly", () => {
    assert.equal(createDecayState(1e9).n0, MAX_ATOMS);
    assert.equal(createDecayState(-5).n0, 1);
    assert.ok(DEFAULT_ATOMS >= MIN_ATOMS && DEFAULT_ATOMS <= MAX_ATOMS);
  });
});

describe("radioactive decay · barriers and plates", () => {
  it("paper stops alpha only; aluminium stops alpha and both betas; lead stops everything", () => {
    assert.deepEqual(BARRIER_ORDER, ["paper", "aluminium", "lead"]);
    const table = {};
    for (const b of BARRIER_ORDER) table[b] = ["alpha", "beta_minus", "beta_plus", "gamma"].map((k) => penetrates(k, b));
    assert.deepEqual(table.paper, [false, true, true, true]);
    assert.deepEqual(table.aluminium, [false, false, false, true]);
    assert.deepEqual(table.lead, [false, false, false, false]);
    assert.equal(BARRIERS.aluminium.thicknessMm, 5);
    assert.equal(BARRIERS.lead.thicknessMm, 3);
  });

  it("gamma is attenuated, never quite stopped: some through aluminium, a thousandth through lead; neutrinos pass everything", () => {
    assert.equal(transmission("gamma", "paper"), 1);
    assert.ok(transmission("gamma", "aluminium") > 0.7 && transmission("gamma", "aluminium") < 1);
    assert.ok(transmission("gamma", "lead") > 0 && transmission("gamma", "lead") < 0.01);
    assert.equal(transmission("alpha", "paper"), 0);
    for (const b of BARRIER_ORDER) assert.equal(transmission("neutrino", b), 1);
  });

  it("the plates pull alpha down, beta-minus up (further), positron down (further), and leave gamma and neutrinos alone", () => {
    assert.equal(deflection("alpha", true).direction, -1);
    assert.equal(deflection("beta_minus", true).direction, 1);
    assert.equal(deflection("beta_plus", true).direction, -1);
    assert.ok(deflection("beta_minus", true).magnitude > deflection("alpha", true).magnitude * 2);
    assert.equal(deflection("gamma", true).direction, 0);
    assert.equal(deflection("neutrino", true).direction, 0);
    assert.equal(deflection("beta_minus", false).direction, 0);
    assert.equal(PARTICLE_KINDS.alpha.charge, 2);
    assert.equal(PARTICLE_KINDS.beta_minus.charge, -1);
  });
});

describe("radioactive decay · words and time", () => {
  it("prints half-lives the way the syllabus does, and what a sim second is worth", () => {
    assert.equal(halfLifeLabel("alpha"), "4.47 billion years");
    assert.equal(halfLifeLabel("beta_minus"), "5,730 years");
    assert.equal(halfLifeLabel("beta_plus"), "110 minutes");
    assert.equal(halfLifeLabel("gamma"), "6.01 hours");
    assert.equal(formatDuration(realSecondsPerSimSecond("gamma")), "36.1 minutes");
    assert.equal(formatDuration(45), "45 seconds");
    assert.equal(formatDuration(3 * 86400), "3 days");
  });

  it("describes the sample against the prediction", () => {
    const fresh = createDecayState(2000);
    assert.match(describeSample(fresh, "alpha"), /fresh sample of 2,000 uranium-238/);
    const half = { n0: 2000, alive: 1000, t: SIM_HALF_LIFE_S };
    assert.match(describeSample(half, "beta_minus"), /50\.0% of the carbon-14 remains after 1\.00 half-lives, within 1% of/);
    assert.match(describeSample({ n0: 100, alive: 0, t: 120 }, "gamma"), /Every technetium-99m nucleus has decayed/);
  });
});
