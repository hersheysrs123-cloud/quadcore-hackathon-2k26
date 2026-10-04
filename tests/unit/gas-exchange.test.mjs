import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALTITUDES,
  KPA_PER_MMHG,
  LUNG_CONDITIONS,
  alveolarPO2,
  barometricKPa,
  diffusingFactor,
  o2Content,
  po2ForContent,
  profileAt,
  saturation,
  solveGasExchange,
} from "../../lib/gasExchange.js";

const mmHg = (kPa) => kPa / KPA_PER_MMHG;

describe("the air in the alveolus", () => {
  it("falls with height the way the atmosphere does", () => {
    assert.ok(Math.abs(barometricKPa(0) - 101.3) < 1e-9);
    // Everest base camp is about half an atmosphere.
    assert.ok(Math.abs(barometricKPa(5400) - 53) < 1.5);
  });

  it("gives the textbook alveolar PO₂ at sea level (~100 mmHg)", () => {
    const pa = alveolarPO2(barometricKPa(0), ALTITUDES.sea.paco2);
    assert.ok(Math.abs(mmHg(pa) - 100) < 3, `${mmHg(pa)} mmHg`);
  });
});

describe("haemoglobin", () => {
  it("is half saturated near 27 mmHg and ~97 % at 100 mmHg", () => {
    assert.ok(Math.abs(saturation(26.8 * KPA_PER_MMHG) - 0.5) < 0.01);
    assert.ok(Math.abs(saturation(100 * KPA_PER_MMHG) - 0.975) < 0.005);
    assert.ok(Math.abs(saturation(40 * KPA_PER_MMHG) - 0.75) < 0.01);
  });

  it("inverts content back to the PO₂ it came from", () => {
    for (const p of [1, 3, 5.3, 8, 13.3, 20]) assert.ok(Math.abs(po2ForContent(o2Content(p)) - p) < 1e-3);
  });

  it("is never more than 100 % saturated, and rises with PO₂", () => {
    let prev = -1;
    for (let p = 0; p < 30; p += 0.5) {
      const s = saturation(p);
      assert.ok(s >= prev && s <= 1);
      prev = s;
    }
  });
});

describe("Fick's law", () => {
  it("is area over thickness, relative to a healthy lung", () => {
    assert.equal(diffusingFactor("healthy"), 1);
    assert.ok(diffusingFactor("fibrosis") < 0.5);
    assert.ok(diffusingFactor("emphysema") < 0.5);
    assert.ok(LUNG_CONDITIONS.fibrosis.thicknessUm > LUNG_CONDITIONS.healthy.thicknessUm);
    assert.ok(LUNG_CONDITIONS.emphysema.areaM2 < LUNG_CONDITIONS.healthy.areaM2);
  });
});

describe("along the capillary", () => {
  it("a healthy lung at rest equilibrates about a third of the way along (West)", () => {
    const s = solveGasExchange();
    assert.ok(s.equilibratedAt > 0.18 && s.equilibratedAt < 0.3, `${s.equilibratedAt} s`);
    assert.ok(s.shortfall < 0.14);
    // The arteriovenous difference at rest is about 5 mL O₂ per dL — 50 mL per litre.
    assert.ok(Math.abs(s.o2PerLitre - 50) < 6, `${s.o2PerLitre} mL/L`);
  });

  it("a healthy lung keeps up even in hard exercise at sea level", () => {
    const s = solveGasExchange({ exercise: true });
    assert.notEqual(s.equilibratedAt, null);
    assert.ok(s.equilibratedAt < s.transitS);
  });

  it("a thickened barrier copes at rest but leaves the blood short in exercise", () => {
    const rest = solveGasExchange({ condition: "fibrosis" });
    const run = solveGasExchange({ condition: "fibrosis", exercise: true });
    assert.ok(rest.shortfall < 0.2);
    assert.ok(run.diffusionLimited);
    assert.ok(run.endSat < 0.9, `${run.endSat}`);
  });

  it("altitude makes even a healthy lung diffusion-limited in exercise", () => {
    const s = solveGasExchange({ altitude: "high", exercise: true });
    assert.ok(s.diffusionLimited);
    assert.ok(s.endSat < solveGasExchange({ exercise: true }).endSat);
  });

  it("PO₂ only rises and PCO₂ only falls along the way", () => {
    for (const altitude of Object.keys(ALTITUDES)) {
      for (const condition of Object.keys(LUNG_CONDITIONS)) {
        for (const exercise of [false, true]) {
          const s = solveGasExchange({ altitude, condition, exercise });
          for (let i = 1; i < s.profile.length; i += 1) {
            assert.ok(s.profile[i].po2 >= s.profile[i - 1].po2 - 1e-9);
            assert.ok(s.profile[i].pco2 <= s.profile[i - 1].pco2 + 1e-9);
            assert.ok(s.profile[i].po2 <= s.pao2 + 1e-6);
          }
          assert.ok(s.pvo2 < s.pao2);
        }
      }
    }
  });

  it("interpolates the profile at any fraction of the way", () => {
    const s = solveGasExchange();
    assert.ok(Math.abs(profileAt(s, 0).po2 - s.pvo2) < 1e-9);
    assert.ok(Math.abs(profileAt(s, 1).po2 - s.endPo2) < 1e-9);
    const mid = profileAt(s, 0.05);
    assert.ok(mid.po2 > s.pvo2 && mid.po2 < s.pao2);
  });
});
