import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FOLDINGS,
  GUT_CONDITIONS,
  MEALS,
  NUTRIENTS,
  absorbedFraction,
  areaMultiplier,
  solveAbsorption,
} from "../../lib/absorption.js";

describe("the three foldings", () => {
  it("multiply to the classic ×600 for a healthy lining", () => {
    assert.equal(FOLDINGS.reduce((p, f) => p * f.factor, 1), 600);
    assert.equal(areaMultiplier("healthy"), 600);
  });

  it("lose most of it to villous atrophy", () => {
    assert.ok(areaMultiplier("coeliac") < 0.2 * areaMultiplier("healthy"));
    assert.ok(GUT_CONDITIONS.coeliac.villusHeight < 0.5);
  });
});

describe("what gets absorbed", () => {
  it("is almost everything for a healthy gut", () => {
    assert.ok(Math.abs(absorbedFraction("healthy") - 0.98) < 1e-9);
  });

  it("falls with the area in coeliac disease", () => {
    assert.ok(absorbedFraction("coeliac") < 0.7);
    assert.ok(absorbedFraction("coeliac") > 0.2);
  });

  it("sends sugars and amino acids to the blood and fats to the lymph", () => {
    assert.equal(NUTRIENTS.glucose.route, "blood");
    assert.equal(NUTRIENTS.aminoAcids.route, "blood");
    assert.equal(NUTRIENTS.fats.route, "lymph");
  });

  it("accounts for every share of every meal", () => {
    for (const meal of Object.keys(MEALS)) {
      for (const condition of Object.keys(GUT_CONDITIONS)) {
        const s = solveAbsorption({ meal, condition });
        const shares = s.nutrients.reduce((t, n) => t + n.share, 0);
        assert.ok(Math.abs(shares - 1) < 1e-9, `${meal} shares ${shares}`);
        for (const n of s.nutrients) assert.ok(Math.abs(n.absorbed + n.lost - n.share) < 1e-9);
        assert.ok(Math.abs(s.toBlood + s.toLymph - s.absorbed) < 1e-9);
      }
    }
  });

  it("sends more to the lacteal after a fatty meal", () => {
    assert.ok(solveAbsorption({ meal: "fatty" }).toLymph > solveAbsorption({ meal: "starchy" }).toLymph);
  });

  it("scales the measured 30 m² with the area", () => {
    assert.equal(solveAbsorption().areaM2, 30);
    assert.ok(solveAbsorption({ condition: "coeliac" }).areaM2 < 6);
  });
});
