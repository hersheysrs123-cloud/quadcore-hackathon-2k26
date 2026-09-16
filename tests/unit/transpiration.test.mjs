import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ATMOSPHERE_KPA,
  BOUNDARY_CONDUCTANCE_STILL,
  BOUNDARY_CONDUCTANCE_WINDY,
  CAVITATION_TENSION_MPA,
  DROUGHT_RESIDUAL_APERTURE,
  GRAVITY_MPA_PER_M,
  GUARD_CELL_TURGOR_FLACCID,
  GUARD_CELL_TURGOR_TURGID,
  HYDRAULIC_RESISTANCE,
  LEAF_AREA_M2,
  LEAF_TEMPERATURE_C,
  MAX_STOMATAL_CONDUCTANCE,
  OPEN_PORE_THRESHOLD,
  SOILS,
  STRAINED_TENSION_MPA,
  TREE_HEIGHT_M,
  WATER_G_PER_MOL,
  boundaryConductance,
  columnStateFor,
  formatMl,
  guardCellTurgor,
  molFluxToMlPerHour,
  potassiumUptake,
  saturationVapourPressure,
  seriesConductance,
  solveTranspiration,
  stomatalAperture,
  vapourPressureDeficit,
  xylemTension,
} from "../../lib/transpiration.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("Guard cells", () => {
  it("pump in more K⁺ with more light, saturating towards full sun", () => {
    assert.equal(potassiumUptake(0), 0);
    assert.ok(close(potassiumUptake(100), 1));
    assert.ok(potassiumUptake(50) > 0.75, "half-light is most of the way there");
    assert.ok(potassiumUptake(20) < potassiumUptake(40) && potassiumUptake(40) < potassiumUptake(80));
  });

  it("run turgor from flaccid to fully turgid with their K⁺ load", () => {
    assert.ok(close(guardCellTurgor(0), GUARD_CELL_TURGOR_FLACCID));
    assert.ok(close(guardCellTurgor(1), GUARD_CELL_TURGOR_TURGID));
    assert.ok(close(guardCellTurgor(2), GUARD_CELL_TURGOR_TURGID), "clamped");
  });

  it("open the pore with light and shut it under drought whatever the light", () => {
    assert.ok(stomatalAperture(100, "hydrated") > OPEN_PORE_THRESHOLD);
    assert.ok(stomatalAperture(0, "hydrated") < OPEN_PORE_THRESHOLD);
    assert.ok(close(stomatalAperture(100, "drought"), DROUGHT_RESIDUAL_APERTURE));
    assert.ok(stomatalAperture(100, "drought") < OPEN_PORE_THRESHOLD, "ABA closure counts as a closed pore");
  });
});

describe("Leaf-to-air pathway", () => {
  it("uses Tetens for saturation vapour pressure — about 3.17 kPa at 25 °C", () => {
    assert.ok(close(saturationVapourPressure(25), 3.17, 0.02));
    assert.equal(LEAF_TEMPERATURE_C, 25);
  });

  it("has a vapour-pressure deficit that vanishes at saturation and peaks in dry air", () => {
    assert.ok(close(vapourPressureDeficit(100), 0));
    assert.ok(close(vapourPressureDeficit(50), saturationVapourPressure(25) * 0.5));
    assert.ok(vapourPressureDeficit(10) > vapourPressureDeficit(95));
  });

  it("strips the boundary layer with wind", () => {
    assert.ok(close(boundaryConductance(0), BOUNDARY_CONDUCTANCE_STILL));
    assert.ok(close(boundaryConductance(10), BOUNDARY_CONDUCTANCE_WINDY));
    assert.ok(boundaryConductance(2) > boundaryConductance(0) && boundaryConductance(2) < boundaryConductance(8));
    assert.ok(close(boundaryConductance(50), BOUNDARY_CONDUCTANCE_WINDY), "clamped at the slider's top");
  });

  it("puts two conductances in series like resistances in series", () => {
    assert.ok(close(seriesConductance(1, 1), 0.5));
    assert.ok(seriesConductance(0.4, 3) < 0.4, "the smaller one dominates");
    assert.equal(seriesConductance(0, 3), 0, "a shut pore passes nothing");
  });

  it("converts a molar flux to mL/hr over the sapling's leaf area", () => {
    assert.ok(close(molFluxToMlPerHour(1), WATER_G_PER_MOL * 3600 * LEAF_AREA_M2));
  });
});

describe("Cohesion–tension column", () => {
  it("must always at least hold the column's own weight above the soil", () => {
    const still = xylemTension(0, "hydrated");
    assert.ok(close(still, -SOILS.hydrated.psiMPa + GRAVITY_MPA_PER_M * TREE_HEIGHT_M));
    assert.ok(xylemTension(0.005, "hydrated") > still, "flow adds tension through hydraulic resistance");
    assert.ok(close(xylemTension(0.005, "hydrated") - still, HYDRAULIC_RESISTANCE * 0.005));
  });

  it("starts already strained in dry soil, before any water moves", () => {
    assert.ok(xylemTension(0, "drought") > xylemTension(0, "hydrated"));
    assert.ok(xylemTension(0, "drought") > STRAINED_TENSION_MPA);
  });

  it("classifies tension as safe, strained or cavitating", () => {
    assert.equal(columnStateFor(0.5), "safe");
    assert.equal(columnStateFor(STRAINED_TENSION_MPA), "strained");
    assert.equal(columnStateFor(CAVITATION_TENSION_MPA), "cavitation");
  });
});

describe("The whole pathway", () => {
  it("gives a well-watered sapling a realistic midday rate and tension", () => {
    const t = solveTranspiration({ light: 70, humidity: 50, wind: 2, soil: "hydrated" });
    assert.ok(t.poreOpen);
    assert.equal(t.poreStatus, "Open pore");
    assert.ok(t.rateMlPerHour > 80 && t.rateMlPerHour < 250, `rate ${t.rateMlPerHour}`);
    assert.ok(t.tensionMPa > 0.5 && t.tensionMPa < 1.4, `tension ${t.tensionMPa}`);
    assert.equal(t.columnState, "safe");
    assert.ok(close(t.fluxMol, t.conductance * (t.vpdKPa / ATMOSPHERE_KPA)));
  });

  it("all but stops at night: closed pore, near-zero rate, only the column's weight to hold", () => {
    const t = solveTranspiration({ light: 0, humidity: 50, wind: 2, soil: "hydrated" });
    assert.equal(t.poreStatus, "Closed pore");
    assert.ok(t.rateMlPerHour < 0.5);
    assert.ok(close(t.tensionMPa, xylemTension(0, "hydrated"), 1e-6));
    assert.equal(t.columnState, "safe");
  });

  it("rises with lower humidity, more wind and more light — each on its own", () => {
    const base = solveTranspiration({ light: 60, humidity: 60, wind: 2, soil: "hydrated" });
    assert.ok(solveTranspiration({ light: 60, humidity: 20, wind: 2 }).rateMlPerHour > base.rateMlPerHour);
    assert.ok(solveTranspiration({ light: 60, humidity: 60, wind: 8 }).rateMlPerHour > base.rateMlPerHour);
    assert.ok(solveTranspiration({ light: 100, humidity: 60, wind: 2 }).rateMlPerHour > base.rateMlPerHour);
    assert.ok(solveTranspiration({ light: 60, humidity: 95, wind: 0 }).rateMlPerHour < base.rateMlPerHour);
  });

  it("is bottlenecked by the boundary layer in still air and by the stomata once there is wind", () => {
    assert.equal(solveTranspiration({ light: 100, humidity: 50, wind: 0 }).limitedBy, "boundary layer");
    assert.equal(solveTranspiration({ light: 100, humidity: 50, wind: 4 }).limitedBy, "stomata");
    assert.ok(BOUNDARY_CONDUCTANCE_STILL < MAX_STOMATAL_CONDUCTANCE, "which is only possible because still air is that resistive");
  });

  it("closes the stomata under drought, cutting the rate but leaving the column strained", () => {
    const wet = solveTranspiration({ light: 100, humidity: 50, wind: 2, soil: "hydrated" });
    const dry = solveTranspiration({ light: 100, humidity: 50, wind: 2, soil: "drought" });
    assert.ok(dry.droughtClosed && !wet.droughtClosed);
    assert.equal(dry.poreStatus, "Closed pore");
    assert.ok(dry.rateMlPerHour < wet.rateMlPerHour * 0.3, "ABA closure cuts most of the loss");
    assert.ok(dry.tensionMPa > wet.tensionMPa, "…yet the column is under MORE tension, because the soil holds its water");
    assert.equal(dry.columnState, "strained");
  });

  it("cavitates in drought on a dry, windy day even with the pore nearly shut", () => {
    const t = solveTranspiration({ light: 100, humidity: 10, wind: 10, soil: "drought" });
    assert.equal(t.columnState, "cavitation");
    assert.ok(t.tensionMPa >= CAVITATION_TENSION_MPA);
    const wet = solveTranspiration({ light: 100, humidity: 10, wind: 10, soil: "hydrated" });
    assert.notEqual(wet.columnState, "cavitation", "the same weather is survivable with wet soil");
  });

  it("scales sap velocity with the rate and falls back to defaults for unknown soil", () => {
    const a = solveTranspiration({ light: 100, humidity: 30, wind: 5 });
    const b = solveTranspiration({ light: 40, humidity: 30, wind: 5 });
    assert.ok(a.sapCmPerHour > b.sapCmPerHour);
    assert.equal(solveTranspiration({ soil: "lava" }).soil, "hydrated");
  });

  it("formats millilitres per hour readably", () => {
    assert.equal(formatMl(3.14159), "3.1 mL/hr");
    assert.equal(formatMl(153.6), "154 mL/hr");
  });
});
