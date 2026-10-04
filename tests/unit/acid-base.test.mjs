import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACID_CONC_RANGE,
  ACID_KEYS,
  BASE_CONC_RANGE,
  BASE_KEYS,
  BURETTE_VOLUME,
  INDICATORS,
  INDICATOR_KEYS,
  SUBSTANCES,
  acidForms,
  describePH,
  endPoint,
  equivalenceJump,
  equivalenceVolume,
  hydrogenIons,
  indicatorColour,
  particleCounts,
  solvePH,
  titrationCurve,
  titrationPoint,
} from "../../lib/acidBase.js";

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const pH = (o) => titrationPoint(o).pH;

describe("the pH of a solution", () => {
  it("is −log[H⁺] for a strong acid and 14 + log[OH⁻] for a strong alkali", () => {
    close(solvePH("hcl", 0.1, "naoh", 0), 1.0, 0.005);
    close(solvePH("hcl", 0.001, "naoh", 0), 3.0, 0.005);
    close(solvePH("hcl", 0, "naoh", 0.01), 12.0, 0.005);
  });

  it("is 7 for pure water", () => close(solvePH("hcl", 0, "naoh", 0), 7, 0.001));

  it("is higher for a weak acid than a strong one at the same concentration", () => {
    close(solvePH("ethanoic", 0.1, "naoh", 0), 2.88, 0.01);
  });

  it("counts both of sulfuric acid's protons, the second only partly", () => {
    const p = solvePH("sulfuric", 0.05, "naoh", 0);
    assert.ok(p > 1.0 && p < 1.3, `${p}`);
  });

  it("splits an acid between its forms, the shares summing to 1", () => {
    const { shares, charge } = acidForms([1.75e-5], 1.75e-5);
    close(shares[0], 0.5, 1e-12);
    close(charge, 0.5, 1e-12);
  });
});

describe("a titration", () => {
  const strong = { acid: "hcl", acidConc: 0.1, base: "naoh", baseConc: 0.1 };
  const weak = { acid: "ethanoic", acidConc: 0.1, base: "naoh", baseConc: 0.1 };

  it("reaches equivalence when the moles of alkali match the acid's protons", () => {
    close(equivalenceVolume(strong), 25, 1e-9);
    close(equivalenceVolume({ acid: "sulfuric", acidConc: 0.05, baseConc: 0.1 }), 25, 1e-9);
    close(equivalenceVolume({ acid: "hcl", acidConc: 0.1, baseConc: 0.2 }), 12.5, 1e-9);
  });

  it("is neutral at the equivalence point for strong acid and strong alkali", () => {
    close(pH({ ...strong, volume: 25 }), 7, 0.01);
  });

  it("is alkaline at equivalence for a weak acid and acidic for a weak base", () => {
    close(pH({ ...weak, volume: 25 }), 8.73, 0.02);
    close(pH({ acid: "hcl", acidConc: 0.1, base: "ammonia", baseConc: 0.1, volume: 25 }), 5.28, 0.02);
  });

  it("has pH = pKa half-way to equivalence for a weak acid: the buffer", () => {
    close(pH({ ...weak, volume: 12.5 }), 4.76, 0.01);
    // a buffer resists change: 5 cm³ either side moves it less than one unit
    assert.ok(pH({ ...weak, volume: 17.5 }) - pH({ ...weak, volume: 7.5 }) < 0.8);
  });

  it("rises all the way and jumps at equivalence", () => {
    const curve = titrationCurve(strong, 200);
    for (let i = 1; i < curve.length; i += 1) assert.ok(curve[i].pH >= curve[i - 1].pH - 1e-9);
    assert.ok(equivalenceJump(strong).size > 4);
    assert.ok(equivalenceJump({ acid: "ethanoic", acidConc: 0.1, base: "ammonia", baseConc: 0.1 }).size < 0.5);
  });

  it("picks the right indicators", () => {
    assert.equal(endPoint(weak, "phenolphthalein").suitable, true);
    assert.equal(endPoint(weak, "methylOrange").suitable, false);
    assert.equal(endPoint({ acid: "hcl", acidConc: 0.1, base: "ammonia", baseConc: 0.1 }, "methylOrange").suitable, true);
    assert.equal(endPoint({ acid: "hcl", acidConc: 0.1, base: "ammonia", baseConc: 0.1 }, "phenolphthalein").suitable, false);
    assert.equal(endPoint(strong, "universal").suitable, false);
  });

  it("is finite at every control setting", () => {
    for (const acid of ACID_KEYS)
      for (const base of BASE_KEYS)
        for (const acidConc of ACID_CONC_RANGE)
          for (const baseConc of BASE_CONC_RANGE)
            for (const volume of [0, 12.5, equivalenceVolume({ acid, acidConc, baseConc }), BURETTE_VOLUME]) {
              const p = titrationPoint({ acid, acidConc, base, baseConc, volume });
              assert.ok(Number.isFinite(p.pH) && p.pH >= 0 && p.pH <= 14, `${acid} ${base} ${volume}: ${p.pH}`);
              const c = particleCounts(p, { acid, base });
              for (const k of ["hydrogen", "hydroxide", "cation", "anion", "water"]) assert.ok(Number.isInteger(c[k]));
            }
  });

  it("neutralises H⁺ in proportion to the alkali added", () => {
    const at = (v) => particleCounts(titrationPoint({ ...strong, volume: v }), strong);
    assert.equal(at(0).hydrogen, 24);
    assert.equal(at(12.5).hydrogen, 12);
    assert.equal(at(12.5).water, 12);
    assert.equal(at(25).hydrogen, 0);
    assert.ok(at(35).hydroxide > 0);
  });
});

describe("indicators and the scale", () => {
  it("turns phenolphthalein from colourless to pink", () => {
    assert.ok(indicatorColour("phenolphthalein", 4).strength < 0.01);
    assert.ok(indicatorColour("phenolphthalein", 11).strength > 0.9);
  });

  it("changes each two-colour indicator over its own range", () => {
    for (const key of INDICATOR_KEYS) {
      const ind = INDICATORS[key];
      if (ind.chart) continue;
      assert.notEqual(indicatorColour(key, ind.range[0] - 1.5).colour, indicatorColour(key, ind.range[1] + 1.5).colour);
    }
  });

  it("makes universal indicator green at 7 and red in strong acid", () => {
    assert.equal(indicatorColour("universal", 7).colour, "#4db848");
    assert.equal(indicatorColour("universal", 0).colour, "#c8102e");
  });

  it("puts each everyday solution on the right side of neutral", () => {
    assert.equal(describePH(SUBSTANCES.water.pH), "neutral");
    assert.equal(describePH(SUBSTANCES.lemon.pH), "strongly acidic");
    assert.equal(describePH(SUBSTANCES.oven.pH), "strongly alkaline");
  });

  it("has ten times the H⁺ for each step down the scale", () => {
    close(hydrogenIons(4).h / hydrogenIons(5).h, 10, 1e-9);
    close(hydrogenIons(7).timesWater, 1, 1e-12);
  });
});
