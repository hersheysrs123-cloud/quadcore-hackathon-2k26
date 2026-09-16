import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASELINE_FOREST_PCT,
  CLIMATE_SENSITIVITY,
  CO2_FORCING_COEFF,
  FOSSIL_GTC_PER_YEAR,
  GPP_BASELINE,
  GTC_PER_PPM,
  LAND_USE_GTC_PER_YEAR,
  MAX_PPM,
  MIN_PPM,
  OCEAN_BASELINE_PPM,
  OCEAN_THERMAL_LAG_YEARS,
  PREINDUSTRIAL_PPM,
  PRESENT_ANOMALY_C,
  PRESENT_PPM,
  carbonFluxes,
  co2Fertilisation,
  combustionEmission,
  equilibriumAnomaly,
  greenhouseOpacity,
  initialCarbonState,
  landNetUptake,
  landUseEmission,
  oceanNetUptake,
  oceanPH,
  pastureFraction,
  photosynthesis,
  radiativeForcing,
  respiration,
  respirationBoost,
  solarIrradianceDelta,
  solarLabel,
  solveCarbon,
  stepCarbon,
} from "../../lib/carbonCycle.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const DEFAULTS = { combustion: 100, forest: BASELINE_FOREST_PCT, solar: 50 };

describe("Sources", () => {
  it("burn 9.5 GtC/yr at 100 % and scale linearly to 500 %", () => {
    assert.ok(close(combustionEmission(100), FOSSIL_GTC_PER_YEAR));
    assert.ok(close(combustionEmission(0), 0));
    assert.ok(close(combustionEmission(500), FOSSIL_GTC_PER_YEAR * 5));
    assert.ok(close(combustionEmission(900), FOSSIL_GTC_PER_YEAR * 5), "clamped at the slider's top");
  });

  it("clear no land and run no cattle at full forest", () => {
    assert.ok(close(pastureFraction(100), 0));
    assert.ok(close(landUseEmission(100), 0));
    assert.ok(close(landUseEmission(BASELINE_FOREST_PCT), LAND_USE_GTC_PER_YEAR), "today's pasture is the calibration");
    assert.ok(landUseEmission(10) > landUseEmission(BASELINE_FOREST_PCT), "more pasture, more emissions");
  });
});

describe("Land", () => {
  it("photosynthesises 120 GtC/yr at baseline and scales with forest cover", () => {
    assert.ok(close(photosynthesis(PRESENT_PPM, BASELINE_FOREST_PCT), GPP_BASELINE));
    assert.ok(close(photosynthesis(PRESENT_PPM, 100), GPP_BASELINE * (100 / BASELINE_FOREST_PCT)));
    assert.ok(close(photosynthesis(PRESENT_PPM, 10), GPP_BASELINE * (10 / BASELINE_FOREST_PCT)));
  });

  it("is fertilised by CO₂ with diminishing returns", () => {
    assert.ok(close(co2Fertilisation(PRESENT_PPM), 1));
    assert.ok(co2Fertilisation(840) > 1 && co2Fertilisation(840) < 1.3);
    assert.ok(co2Fertilisation(PREINDUSTRIAL_PPM) < 1);
    assert.equal(co2Fertilisation(1), 0, "starved of CO₂ it stops");
  });

  it("keeps a 3 GtC/yr sink today and none at pre-industrial balance", () => {
    assert.ok(close(landNetUptake(PRESENT_PPM, BASELINE_FOREST_PCT, PRESENT_ANOMALY_C), 3));
    assert.ok(close(landNetUptake(PREINDUSTRIAL_PPM, BASELINE_FOREST_PCT, PRESENT_ANOMALY_C), 0));
    assert.ok(landNetUptake(200, BASELINE_FOREST_PCT, PRESENT_ANOMALY_C) < 0, "below 280 ppm the land is a source");
    assert.ok(close(landNetUptake(PRESENT_PPM, 100, PRESENT_ANOMALY_C), 5), "full forest, bigger sink");
  });

  it("respires faster when warmer, which eats into the sink", () => {
    assert.ok(close(respirationBoost(PRESENT_ANOMALY_C), 1));
    assert.ok(close(respirationBoost(PRESENT_ANOMALY_C + 10), 2), "Q10 of 2");
    const cool = landNetUptake(PRESENT_PPM, BASELINE_FOREST_PCT, PRESENT_ANOMALY_C);
    const hot = landNetUptake(PRESENT_PPM, BASELINE_FOREST_PCT, PRESENT_ANOMALY_C + 4);
    assert.ok(hot < cool);
    assert.ok(close(respiration(PRESENT_PPM, BASELINE_FOREST_PCT, PRESENT_ANOMALY_C), GPP_BASELINE - 3));
  });
});

describe("Ocean", () => {
  it("takes up 2.8 GtC/yr today, in proportion to how far the air is ahead of the water", () => {
    assert.ok(close(oceanNetUptake(PRESENT_PPM, OCEAN_BASELINE_PPM, PRESENT_ANOMALY_C), 2.8, 1e-9));
    assert.ok(close(oceanNetUptake(380, 380, PRESENT_ANOMALY_C), 0));
    assert.ok(oceanNetUptake(300, 380, PRESENT_ANOMALY_C) < 0, "outgasses when the air drops below the water");
    assert.ok(oceanNetUptake(600, 380, PRESENT_ANOMALY_C) > oceanNetUptake(PRESENT_PPM, 380, PRESENT_ANOMALY_C));
  });

  it("holds less when warm", () => {
    const now = oceanNetUptake(PRESENT_PPM, OCEAN_BASELINE_PPM, PRESENT_ANOMALY_C);
    const warm = oceanNetUptake(PRESENT_PPM, OCEAN_BASELINE_PPM, PRESENT_ANOMALY_C + 3);
    assert.ok(warm < now);
  });

  it("acidifies as CO₂ rises", () => {
    assert.ok(close(oceanPH(PREINDUSTRIAL_PPM), 8.2));
    assert.ok(oceanPH(PRESENT_PPM) < 8.2 && oceanPH(PRESENT_PPM) > 8.0);
    assert.ok(oceanPH(1000) < oceanPH(PRESENT_PPM));
  });
});

describe("The budget", () => {
  it("reproduces the 2020s at the defaults: ~+4.9 GtC/yr, ~+2.3 ppm/yr", () => {
    const f = carbonFluxes(initialCarbonState(), DEFAULTS);
    assert.ok(close(f.combustion, 9.5));
    assert.ok(close(f.landUse, 1.2));
    assert.ok(close(f.photosynthesis, 120));
    assert.ok(close(f.respiration, 117));
    assert.ok(close(f.oceanUptake, 2.8, 1e-9));
    assert.ok(close(f.net, 9.5 + 1.2 + 117 - 120 - 2.8, 1e-9));
    assert.ok(f.ppmPerYear > 2.2 && f.ppmPerYear < 2.4);
    assert.ok(close(f.net / f.ppmPerYear, GTC_PER_PPM));
  });

  it("drains the atmosphere with no combustion and full forest", () => {
    const f = carbonFluxes(initialCarbonState(), { combustion: 0, forest: 100, solar: 50 });
    assert.ok(f.net < 0);
    assert.ok(close(f.landUse, 0));
  });

  it("still fills it at 100 % combustion even with every acre forested", () => {
    const f = carbonFluxes(initialCarbonState(), { combustion: 100, forest: 100, solar: 50 });
    assert.ok(f.net > 0, "forests alone cannot offset fossil fuels");
    assert.ok(f.net < carbonFluxes(initialCarbonState(), DEFAULTS).net);
  });

  it("fills it fastest with the furnaces at 500 % and the forest at 10 %", () => {
    const worst = carbonFluxes(initialCarbonState(), { combustion: 500, forest: 10, solar: 50 });
    assert.ok(worst.net > 40);
    assert.ok(worst.ppmPerYear > 18);
  });
});

describe("Radiation", () => {
  it("forces logarithmically in CO₂ — 3.7 W/m² per doubling", () => {
    const f = radiativeForcing(PREINDUSTRIAL_PPM, 100, 50);
    assert.ok(close(f.co2, 0));
    assert.ok(close(f.methane, 0));
    assert.ok(close(f.solar, 0));
    const doubled = radiativeForcing(2 * PREINDUSTRIAL_PPM, 100, 50);
    assert.ok(close(doubled.co2, CO2_FORCING_COEFF * Math.log(2)));
    const quadrupled = radiativeForcing(4 * PREINDUSTRIAL_PPM, 100, 50);
    assert.ok(close(quadrupled.co2, 2 * doubled.co2), "each doubling adds the same again");
  });

  it("warms 3 °C per doubling at equilibrium", () => {
    const perDoubling = equilibriumAnomaly(CO2_FORCING_COEFF * Math.log(2));
    assert.ok(perDoubling > 2.9 && perDoubling < 3.1);
    assert.ok(close(equilibriumAnomaly(1), CLIMATE_SENSITIVITY));
  });

  it("gets a small, symmetric nudge from the solar cycle", () => {
    assert.ok(close(solarIrradianceDelta(50), 0));
    assert.ok(close(solarIrradianceDelta(100), -solarIrradianceDelta(0)));
    const max = radiativeForcing(PRESENT_PPM, BASELINE_FOREST_PCT, 100);
    const mean = radiativeForcing(PRESENT_PPM, BASELINE_FOREST_PCT, 50);
    assert.ok(max.solar > 0 && max.solar < 0.5, "a few tenths of a W/m², not the CO₂'s two");
    assert.ok(max.solar < mean.co2 / 4, "solar cycle is small next to the CO₂ forcing");
    assert.equal(solarLabel(50), "mean");
    assert.match(solarLabel(100), /maximum/);
    assert.match(solarLabel(0), /minimum/);
  });

  it("adds methane forcing in proportion to pasture", () => {
    const today = radiativeForcing(PRESENT_PPM, BASELINE_FOREST_PCT, 50).methane;
    const cleared = radiativeForcing(PRESENT_PPM, 10, 50).methane;
    assert.ok(today > 0 && cleared > today);
  });

  it("traps more outgoing longwave the more CO₂ there is, saturating", () => {
    const pre = greenhouseOpacity(PREINDUSTRIAL_PPM, 100);
    const now = greenhouseOpacity(PRESENT_PPM, BASELINE_FOREST_PCT);
    const high = greenhouseOpacity(2000, BASELINE_FOREST_PCT);
    assert.ok(pre > 0.4 && pre < 0.6);
    assert.ok(now > pre);
    assert.ok(high > now && high < 1);
    assert.ok((high - now) / (2000 - PRESENT_PPM) < (now - pre) / (PRESENT_PPM - PREINDUSTRIAL_PPM), "diminishing returns per ppm");
  });
});

describe("The clock", () => {
  it("starts in the early 2020s", () => {
    const s = initialCarbonState();
    assert.equal(s.ppm, PRESENT_PPM);
    assert.equal(s.anomaly, PRESENT_ANOMALY_C);
    assert.equal(s.oceanPpm, OCEAN_BASELINE_PPM);
    assert.equal(s.year, 0);
  });

  it("is pure and advances ppm at the budget's rate", () => {
    const s0 = initialCarbonState();
    const s1 = stepCarbon(s0, DEFAULTS, 1);
    assert.equal(s0.ppm, PRESENT_PPM, "input untouched");
    assert.ok(close(s1.year, 1));
    assert.ok(s1.ppm > PRESENT_PPM + 2.1 && s1.ppm < PRESENT_PPM + 2.4);
    assert.ok(close(s1.fossilBurned, FOSSIL_GTC_PER_YEAR, 1e-9));
    assert.equal(stepCarbon(s0, DEFAULTS, 0), s0, "no time, no change");
  });

  it("sub-steps a long dt to the same place as many short ones", () => {
    const s0 = initialCarbonState();
    const controls = { combustion: 500, forest: 10, solar: 100 };
    let fine = s0;
    for (let i = 0; i < 40; i += 1) fine = stepCarbon(fine, controls, 0.25);
    const coarse = stepCarbon(s0, controls, 10);
    assert.ok(close(fine.ppm, coarse.ppm, 1e-6));
    assert.ok(close(fine.anomaly, coarse.anomaly, 1e-6));
  });

  it("keeps warming after the dials stop moving — the ocean lag", () => {
    const s0 = initialCarbonState();
    const target = solveCarbon(s0, DEFAULTS).equilibriumAnomaly;
    assert.ok(target > s0.anomaly, "there is warming in the pipeline today");
    const s = stepCarbon(s0, DEFAULTS, OCEAN_THERMAL_LAG_YEARS);
    assert.ok(s.anomaly > s0.anomaly);
    assert.ok(s.anomaly < solveCarbon(s, DEFAULTS).equilibriumAnomaly, "still short of equilibrium");
  });

  it("falls back towards pre-industrial with the furnaces off and the forest whole", () => {
    let s = initialCarbonState();
    const controls = { combustion: 0, forest: 100, solar: 50 };
    for (let i = 0; i < 200; i += 1) s = stepCarbon(s, controls, 1);
    assert.ok(s.ppm < 340, `after two centuries: ${s.ppm.toFixed(0)} ppm`);
    assert.ok(s.ppm > PREINDUSTRIAL_PPM - 40);
    assert.ok(s.anomaly < PRESENT_ANOMALY_C);
  });

  it("never leaves the bucket's limits", () => {
    let s = initialCarbonState();
    for (let i = 0; i < 400; i += 1) s = stepCarbon(s, { combustion: 500, forest: 10, solar: 100 }, 1);
    assert.ok(s.ppm <= MAX_PPM && s.ppm >= MIN_PPM);
    assert.ok(Number.isFinite(s.anomaly));
    let t = initialCarbonState();
    for (let i = 0; i < 2000; i += 1) t = stepCarbon(t, { combustion: 0, forest: 100, solar: 0 }, 1);
    assert.ok(t.ppm >= MIN_PPM);
  });
});

describe("The readout", () => {
  it("reports the trend, the band and the committed warming", () => {
    const now = solveCarbon(initialCarbonState(), DEFAULTS);
    assert.equal(now.trend, "rising");
    assert.equal(now.band, "present");
    assert.ok(close(now.committedWarming, now.equilibriumAnomaly - PRESENT_ANOMALY_C));
    assert.ok(now.opacity > 0.6 && now.opacity < 0.8);
    assert.ok(close(now.pasture, 0.4));

    const green = solveCarbon(initialCarbonState(), { combustion: 0, forest: 100, solar: 50 });
    assert.equal(green.trend, "falling");

    const hot = solveCarbon({ ...initialCarbonState(), ppm: 900, anomaly: 4 }, DEFAULTS);
    assert.equal(hot.band, "extreme");
    assert.ok(hot.doublings > 1.5);
  });
});
