import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASELINE_MM,
  COMPONENTS,
  FILTER_PORE_UM,
  FRONT_MAX_MM,
  MIXTURES,
  MIXTURE_ORDER,
  PAPER_LENGTH_MM,
  RISE_MM_PER_SQRT_S,
  SAMPLE_VOLUME_ML,
  SOLVENTS,
  SOLVENT_DEPTH_MM,
  SOLVENT_ORDER,
  STATIONS,
  STATION_ORDER,
  boilTime,
  crystallisationTime,
  dissolvedFraction,
  evaporationRate,
  formatSeconds,
  liquidAppearance,
  mixHex,
  phaseOf,
  retentionFactor,
  rfText,
  solubilityAt,
  solveChromatography,
  solveCrystallization,
  solveFiltration,
  solveSeparation,
} from "../../lib/separation.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("Separation — the tables", () => {
  it("has three samples, two solvents and three stations, each in order", () => {
    assert.deepEqual(MIXTURE_ORDER, ["sand_salt", "cuso4", "dye"]);
    assert.deepEqual(SOLVENT_ORDER, ["water", "ethanol"]);
    assert.deepEqual(STATION_ORDER, ["filtration", "crystallization", "chromatography"]);
    for (const key of MIXTURE_ORDER) assert.ok(MIXTURES[key].components.every((c) => COMPONENTS[c]), key);
    for (const key of STATION_ORDER) assert.ok(STATIONS[key].timeLapse >= 1);
  });

  it("gives every component a solubility and an Rf in both solvents", () => {
    for (const [key, c] of Object.entries(COMPONENTS)) {
      for (const s of SOLVENT_ORDER) {
        assert.ok(typeof c.solubility[s] === "number", `${key} solubility ${s}`);
        assert.ok(c.hotSolubility[s] >= c.solubility[s], `${key} is at least as soluble hot as cold in ${s}`);
        assert.ok(c.rf[s] >= 0 && c.rf[s] <= 1, `${key} Rf ${s} in [0, 1]`);
      }
    }
  });

  it("puts sand far above the pore size and every solute far below it", () => {
    assert.ok(COMPONENTS.sand.particleUm > FILTER_PORE_UM * 10);
    for (const key of ["salt", "cuso4", "yellow", "red", "blue"]) assert.ok(COMPONENTS[key].particleUm < FILTER_PORE_UM / 1000, key);
  });

  it("ethanol boils lower and needs far less latent heat than water", () => {
    assert.ok(SOLVENTS.ethanol.boilingC < SOLVENTS.water.boilingC);
    assert.ok(SOLVENTS.ethanol.latentKJPerKg < SOLVENTS.water.latentKJPerKg / 2);
    assert.equal(SOLVENTS.ethanol.flammable, true);
    assert.equal(SOLVENTS.water.flammable, false);
  });
});

describe("Separation — dissolution", () => {
  it("dissolves salt completely in water and hardly at all in ethanol", () => {
    assert.equal(dissolvedFraction("salt", "water", 12), 1);
    assert.ok(dissolvedFraction("salt", "ethanol", 12) < 0.01);
    assert.equal(phaseOf("salt", "water"), "dissolved");
    assert.equal(phaseOf("salt", "ethanol"), "undissolved (insoluble here)");
    assert.equal(phaseOf("sand", "water"), "insoluble solid");
  });

  it("interpolates solubility between the cold and hot values", () => {
    assert.ok(close(solubilityAt("cuso4", "water", 20), 32));
    assert.ok(close(solubilityAt("cuso4", "water", 100), 114));
    assert.ok(close(solubilityAt("cuso4", "water", 60), 73));
    assert.ok(close(solubilityAt("cuso4", "water", 200), 114), "clamped at the boil");
  });

  it("tints the liquid by what is dissolved and clouds it by what is not", () => {
    const blue = liquidAppearance("cuso4", "water");
    assert.equal(blue.cloudy, false);
    assert.equal(blue.colour, COMPONENTS.cuso4.tint);
    const suspension = liquidAppearance("cuso4", "ethanol");
    assert.equal(suspension.cloudy, true);
    assert.notEqual(suspension.colour, COMPONENTS.cuso4.tint);
    const black = liquidAppearance("dye", "water");
    assert.equal(black.colour, "#1f1a2e");
    assert.ok(black.opacity >= 0.75);
    const sandy = liquidAppearance("sand_salt", "water");
    assert.equal(sandy.cloudy, true);
  });

  it("mixes hex colours linearly", () => {
    assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
    assert.equal(mixHex("#ff0000", "#0000ff", 0), "#ff0000");
    assert.equal(mixHex("#ff0000", "#0000ff", 1), "#0000ff");
  });
});

describe("Filtration", () => {
  it("keeps sand on the paper and lets salt water through", () => {
    const r = solveFiltration({ mixture: "sand_salt", solvent: "water", seconds: 600 });
    const sand = r.components.find((c) => c.key === "sand");
    const salt = r.components.find((c) => c.key === "salt");
    assert.equal(sand.retained, true);
    assert.ok(close(sand.retainedG, 6));
    assert.equal(salt.retained, false);
    assert.ok(close(salt.passedG, 12));
    assert.equal(r.separates, true);
    assert.match(r.verdict, /sand on the paper/);
    assert.match(r.verdict, /salt in the flask/);
  });

  it("is the wrong tool for a solution — everything passes", () => {
    const r = solveFiltration({ mixture: "cuso4", solvent: "water", seconds: 600 });
    assert.equal(r.residueG, 0);
    assert.equal(r.nothingRetained, true);
    assert.equal(r.separates, false);
    assert.equal(r.filtrateColour, COMPONENTS.cuso4.tint, "the blue goes through");
    assert.match(r.verdict, /wrong tool/);
  });

  it("retains the same copper sulfate when the solvent is ethanol, because it never dissolved", () => {
    const r = solveFiltration({ mixture: "cuso4", solvent: "ethanol", seconds: 600 });
    assert.ok(close(r.residueG, 18));
    assert.equal(r.nothingPassed, true);
    assert.equal(r.filtrateColour, SOLVENTS.ethanol.colour, "the filtrate is just solvent");
    assert.match(r.verdict, /never dissolved/);
  });

  it("does not count a 0.5% trace as salt in the flask", () => {
    const r = solveFiltration({ mixture: "sand_salt", solvent: "ethanol", seconds: 600 });
    assert.equal(r.nothingPassed, true);
    assert.equal(r.separates, false);
  });

  it("collects filtrate on a first-order curve that a residue cake slows, and never before the lag", () => {
    const clean = solveFiltration({ mixture: "cuso4", solvent: "water", seconds: 200 });
    const caked = solveFiltration({ mixture: "sand_salt", solvent: "water", seconds: 200 });
    assert.ok(caked.tau > clean.tau);
    assert.ok(caked.filtrateMl < clean.filtrateMl);
    assert.equal(solveFiltration({ mixture: "cuso4", solvent: "water", seconds: 2 }).filtrateMl, 0);
    assert.equal(solveFiltration({ mixture: "cuso4", solvent: "water", seconds: 2 }).dripRate, 0);
    const late = solveFiltration({ mixture: "cuso4", solvent: "water", seconds: 2000 });
    assert.ok(late.complete);
    assert.ok(late.filtrateMl > SAMPLE_VOLUME_ML * 0.95);
    // Filtrate cannot get ahead of what has been poured.
    const early = solveFiltration({ mixture: "cuso4", solvent: "water", seconds: 15 });
    assert.ok(early.filtrateMl <= early.pouredFraction * SAMPLE_VOLUME_ML + 1e-9);
  });

  it("caps how much a cake can slow the paper", () => {
    const r = solveFiltration({ mixture: "cuso4", solvent: "ethanol", seconds: 1 });
    assert.ok(r.tau <= 90 * 2 + 1e-9);
  });
});

describe("Crystallisation", () => {
  it("heats to the boil, then evaporates at the rate the latent heat allows", () => {
    const water = solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: 0 });
    assert.equal(water.phase, "heating");
    assert.ok(close(water.temperatureC, 20));
    assert.equal(water.volumeMl, SAMPLE_VOLUME_ML);
    const boiling = solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: water.boilAt + 100 });
    assert.equal(boiling.phase, "evaporating");
    assert.equal(boiling.temperatureC, 100);
    assert.ok(close(boiling.evaporatedMl, evaporationRate("water") * 100, 1e-6));
    assert.ok(evaporationRate("ethanol") > evaporationRate("water") * 3, "ethanol boils off much faster");
    assert.ok(boilTime("ethanol") < boilTime("water"), "and reaches its boil sooner");
  });

  it("takes copper sulfate to the first crystals, turns the flame off, and lets cooling do the rest", () => {
    const start = solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: 0 });
    assert.equal(start.coolMethod, true);
    assert.ok(start.nucleationAt > start.boilAt);
    assert.ok(start.stopAt < start.dryAt, "the flame comes off before dryness");
    const justBefore = solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: start.stopAt - 1 });
    assert.equal(justBefore.flameOn, true);
    assert.equal(justBefore.nucleated, false);
    const cooling = solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: start.stopAt + 200 });
    assert.equal(cooling.flameOn, false);
    assert.equal(cooling.phase, "cooling");
    assert.ok(cooling.temperatureC < 100);
    assert.ok(cooling.nucleated);
    const cold = solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: start.stopAt + 3000 });
    assert.equal(cold.phase, "done");
    assert.ok(cold.crystalsG > cooling.crystalsG, "more comes out as it cools");
    assert.ok(cold.crystalsG > 12 && cold.crystalsG < 18);
    assert.ok(close(cold.volumeMl, cooling.volumeMl), "no more evaporation once the flame is off");
    assert.match(cold.verdict, /cooled/);
  });

  it("takes salt to dryness, because cooling would recover almost nothing", () => {
    const start = solveCrystallization({ mixture: "sand_salt", solvent: "water", seconds: 0 });
    assert.equal(start.coolMethod, false);
    assert.ok(close(start.stopAt, start.dryAt));
    const dry = solveCrystallization({ mixture: "sand_salt", solvent: "water", seconds: start.dryAt + 10 });
    assert.equal(dry.dry, true);
    assert.equal(dry.phase, "dry");
    const salt = dry.components.find((c) => c.key === "salt");
    assert.ok(salt.crystalsG > 11);
    assert.match(dry.verdict, /taken to dryness/);
  });

  it("puts the first crystal where the volume can no longer hold the solute", () => {
    const t = crystallisationTime("cuso4", "water", 18);
    const before = solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: t - 0.5 });
    const after = solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: t + 0.5 });
    assert.equal(before.components[0].nucleated, false);
    assert.ok(after.components[0].saturation >= 0.999);
    assert.equal(crystallisationTime("cuso4", "water", 0.1), Infinity, "nothing to crystallise");
  });

  it("leaves a dye as a film and never as crystals", () => {
    const r = solveCrystallization({ mixture: "dye", solvent: "water", seconds: 5000 });
    assert.equal(r.crystalsG, 0);
    assert.ok(r.filmG > 0.8);
    assert.equal(r.crystallisers.length, 0);
    assert.match(r.verdict, /film/);
  });

  it("has nothing to crystallise when the solute never dissolved", () => {
    const early = solveCrystallization({ mixture: "cuso4", solvent: "ethanol", seconds: 10 });
    assert.equal(early.crystallisers.length, 0);
    assert.ok(close(early.precipitateG, 18));
    assert.match(early.verdict, /never dissolved/);
    const late = solveCrystallization({ mixture: "cuso4", solvent: "ethanol", seconds: 5000 });
    assert.equal(late.dry, true);
    assert.match(late.verdict, /solid all along/);
    assert.equal(late.flammableWarning, true);
  });

  it("steams while boiling and not when cold", () => {
    const boiling = solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: 400 });
    assert.equal(boiling.steamRate, 1);
    assert.equal(solveCrystallization({ mixture: "cuso4", solvent: "water", seconds: 0 }).steamRate, 0);
  });
});

describe("Chromatography", () => {
  it("draws the baseline above the solvent pool and stops the front short of the top", () => {
    assert.ok(BASELINE_MM > SOLVENT_DEPTH_MM);
    assert.ok(FRONT_MAX_MM + BASELINE_MM < PAPER_LENGTH_MM);
  });

  it("raises the front as √t and finishes in fifteen minutes", () => {
    const a = solveChromatography({ mixture: "dye", solvent: "water", seconds: 100 });
    const b = solveChromatography({ mixture: "dye", solvent: "water", seconds: 400 });
    assert.ok(close(b.frontMm, a.frontMm * 2, 1e-9), "4× the time, 2× the distance");
    assert.ok(close(a.frontMm, RISE_MM_PER_SQRT_S * 10));
    const done = solveChromatography({ mixture: "dye", solvent: "water", seconds: 900 });
    assert.ok(done.finished);
    assert.ok(close(done.frontMm, FRONT_MAX_MM));
    assert.ok(close(done.finishAt, 900, 1e-6));
    assert.ok(close(solveChromatography({ mixture: "dye", solvent: "water", seconds: 5000 }).frontMm, FRONT_MAX_MM), "never past the top");
  });

  it("separates black ink into three pigments whose Rf never changes during the run", () => {
    const early = solveChromatography({ mixture: "dye", solvent: "water", seconds: 100 });
    const late = solveChromatography({ mixture: "dye", solvent: "water", seconds: 800 });
    assert.equal(early.distinct, 3);
    for (let i = 0; i < 3; i += 1) {
      assert.equal(early.spots[i].rf, late.spots[i].rf);
      assert.ok(close(early.spots[i].distanceMm / early.frontMm, early.spots[i].rf));
      assert.ok(late.spots[i].distanceMm > early.spots[i].distanceMm);
    }
    assert.match(late.verdict, /3 pigments/);
    // In water the order top-down is yellow, red, blue…
    const water = late.spots.map((s) => s.key).sort((x, y) => retentionFactor(y, "water") - retentionFactor(x, "water"));
    assert.deepEqual(water, ["yellow", "red", "blue"]);
    // …and ethanol carries the blue past the red.
    const ethanol = late.spots.map((s) => s.key).sort((x, y) => retentionFactor(y, "ethanol") - retentionFactor(x, "ethanol"));
    assert.deepEqual(ethanol, ["yellow", "blue", "red"]);
  });

  it("gives a single substance a single spot", () => {
    const r = solveChromatography({ mixture: "cuso4", solvent: "water", seconds: 600 });
    assert.equal(r.distinct, 1);
    assert.match(r.verdict, /single substance/);
  });

  it("shows nothing for salt water — colourless — and nothing moving in ethanol", () => {
    const water = solveChromatography({ mixture: "sand_salt", solvent: "water", seconds: 600 });
    assert.equal(water.distinct, 0);
    const salt = water.spots.find((s) => s.key === "salt");
    assert.equal(salt.visible, false);
    assert.ok(salt.distanceMm > 0, "it travels, it just cannot be seen");
    assert.match(water.verdict, /locating agent/);
    const sand = water.spots.find((s) => s.key === "sand");
    assert.equal(sand.distanceMm, 0);
    const ethanol = solveChromatography({ mixture: "cuso4", solvent: "ethanol", seconds: 600 });
    assert.equal(ethanol.distinct, 0);
    assert.match(ethanol.verdict, /nothing moves/);
  });

  it("prints the Rf arithmetic from the live distances", () => {
    const r = solveChromatography({ mixture: "dye", solvent: "water", seconds: 400 });
    const blue = r.spots.find((s) => s.key === "blue");
    assert.equal(rfText(blue, r.frontMm), `${blue.distanceMm.toFixed(1)} mm / ${r.frontMm.toFixed(1)} mm = 0.38`);
    assert.equal(rfText({ moves: false }, r.frontMm), "—");
  });
});

describe("Separation — dispatch and formatting", () => {
  it("routes by station and falls back to defaults for unknown keys", () => {
    assert.equal(solveSeparation({ station: "filtration", mixture: "dye", solvent: "water", seconds: 10 }).station, "filtration");
    assert.equal(solveSeparation({ station: "crystallization", mixture: "dye", solvent: "water", seconds: 10 }).station, "crystallization");
    assert.equal(solveSeparation({ station: "chromatography", mixture: "dye", solvent: "water", seconds: 10 }).station, "chromatography");
    const fallback = solveSeparation({ station: "nope", mixture: "nope", solvent: "nope", seconds: -5 });
    assert.equal(fallback.station, "filtration");
    assert.equal(fallback.mixture, "sand_salt");
    assert.equal(fallback.solvent, "water");
    assert.equal(fallback.seconds, 0);
  });

  it("formats the model clock", () => {
    assert.equal(formatSeconds(0), "0 s");
    assert.equal(formatSeconds(45.4), "45 s");
    assert.equal(formatSeconds(60), "1 min");
    assert.equal(formatSeconds(125), "2 min 05 s");
    assert.equal(formatSeconds(NaN), "0 s");
  });
});
