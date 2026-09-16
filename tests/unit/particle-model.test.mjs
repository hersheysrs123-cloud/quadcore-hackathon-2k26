import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  C_TO_K,
  CONTAINER,
  HEATING_CONDUCTANCE,
  PARTICLE_COUNT,
  PRESSURE_MAX_ATM,
  PRESSURE_MIN_ATM,
  SUBSTANCES,
  SUBSTANCE_ORDER,
  TEMP_MAX_C,
  TEMP_MIN_C,
  boilingPointC,
  columnHeights,
  createThermalState,
  describePhase,
  energyAtTemperature,
  heatingCurve,
  kineticReadout,
  meltingPointC,
  molarVolumes,
  phaseComposition,
  stateAtEnergy,
  stepThermal,
  sublimationPointC,
  transitionsAt,
} from "../../lib/particleModel.js";

const near = (a, b, tol) => Math.abs(a - b) <= tol;

/** Drive the hotplate for `seconds` of sim time at 60 fps. */
function heat(state, seconds, opts) {
  let s = state;
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i += 1) s = stepThermal(s, { ...opts, dt: 1 / 60 });
  return s;
}

describe("particle model · phase boundaries", () => {
  it("lists three substances in the option order", () => {
    assert.deepEqual(SUBSTANCE_ORDER, ["water", "neon", "co2"]);
    for (const id of SUBSTANCE_ORDER) assert.ok(SUBSTANCES[id].label);
  });

  it("water boils at 100 °C at 1 atm, ~180 °C at 10 atm and ~81 °C at 0.5 atm (Clausius–Clapeyron)", () => {
    assert.ok(near(boilingPointC("water", 1), 100, 1e-6));
    assert.ok(near(boilingPointC("water", 10), 180, 2), `got ${boilingPointC("water", 10)}`);
    assert.ok(near(boilingPointC("water", 0.5), 81, 1.5), `got ${boilingPointC("water", 0.5)}`);
  });

  it("water's melting point falls, not rises, with pressure — ice is the open structure", () => {
    assert.ok(meltingPointC("water", 10) < meltingPointC("water", 1));
    assert.ok(near(meltingPointC("water", 1), 0, 1e-9));
  });

  it("carbon dioxide has no liquid below its triple-point pressure and sublimes at −78.5 °C at 1 atm", () => {
    assert.equal(boilingPointC("co2", 1), null);
    assert.equal(meltingPointC("co2", 1), null);
    assert.equal(transitionsAt("co2", 1).kind, "sublime");
    assert.ok(near(sublimationPointC("co2", 1), -78.5, 1e-6));
    assert.ok(sublimationPointC("co2", 0.5) < -78.5, "lower pressure, lower sublimation point");
  });

  it("carbon dioxide gains a liquid above 5.11 atm, between a melting and a boiling point", () => {
    const tr = transitionsAt("co2", 10);
    assert.equal(tr.kind, "three");
    assert.ok(near(tr.meltC, -56.4, 0.5), `melt ${tr.meltC}`);
    assert.ok(near(tr.boilC, -39.5, 1.5), `boil ${tr.boilC}`);
    assert.ok(tr.boilC > tr.meltC);
  });

  it("neon's transitions sit far below the slider — a gas everywhere the hotplate can go", () => {
    assert.ok(boilingPointC("neon", 1) < -240);
    assert.ok(boilingPointC("neon", PRESSURE_MAX_ATM) < TEMP_MIN_C);
    const curve = heatingCurve("neon", 1);
    assert.deepEqual(curve.segments.map((s) => s.phase), ["gas"]);
  });
});

describe("particle model · the heating curve", () => {
  it("water at 1 atm: solid, flat melt step, liquid, flat boil step, gas — in that order, with the right widths", () => {
    const c = heatingCurve("water", 1);
    assert.deepEqual(c.segments.map((s) => s.phase), ["solid", "melting", "liquid", "boiling", "gas"]);
    const melt = c.segments[1];
    const boil = c.segments[3];
    assert.equal(melt.from.T, melt.to.T, "melting step is flat");
    assert.equal(boil.from.T, boil.to.T, "boiling step is flat");
    assert.ok(near(melt.to.E - melt.from.E, 6010, 1e-6));
    assert.ok(near(boil.to.E - boil.from.E, 40650, 1e-6));
    assert.ok(near(melt.from.T, 0, 1e-9));
    assert.ok(near(boil.from.T, 100, 1e-9));
    // Segments are contiguous and monotonic in energy.
    for (let i = 1; i < c.segments.length; i += 1) assert.ok(near(c.segments[i].from.E, c.segments[i - 1].to.E, 1e-9));
    assert.ok(near(c.totalE, 63400, 200), `total ${c.totalE}`);
  });

  it("CO₂ at 1 atm: one flat sublimation step of ΔH_sub", () => {
    const c = heatingCurve("co2", 1);
    assert.deepEqual(c.segments.map((s) => s.phase), ["solid", "subliming", "gas"]);
    assert.ok(near(c.segments[1].to.E - c.segments[1].from.E, 25200, 1e-6));
  });

  it("stateAtEnergy reads the phase and the fraction across a step; energyAtTemperature inverts it to the step's start", () => {
    const c = heatingCurve("water", 1);
    const melt = c.segments[1];
    const half = stateAtEnergy(c, melt.from.E + (melt.to.E - melt.from.E) / 2);
    assert.equal(half.phase, "melting");
    assert.ok(near(half.fraction, 0.5, 1e-9));
    assert.ok(near(half.tempC, 0, 1e-9));
    assert.ok(near(energyAtTemperature(c, 0), melt.from.E, 1e-9), "0 °C is ice about to melt");
    const warm = stateAtEnergy(c, energyAtTemperature(c, 50));
    assert.equal(warm.phase, "liquid");
    assert.ok(near(warm.tempC, 50, 1e-6));
    // Off the top: extrapolates along the gas gradient.
    const over = stateAtEnergy(c, c.totalE + 3600);
    assert.equal(over.phase, "gas");
    assert.ok(near(over.tempC, 250 + 100, 1e-6));
  });
});

describe("particle model · the integrator", () => {
  it("holds the temperature at 100.0 °C for the whole boiling step while the hotplate keeps pushing", () => {
    let s = createThermalState("water", 1, 90);
    const opts = { substance: "water", pressureAtm: 1, setpointC: 150 };
    s = heat(s, 2, opts);
    assert.equal(s.phase, "boiling");
    let minT = Infinity;
    let maxT = -Infinity;
    while (s.phase === "boiling") {
      s = stepThermal(s, { ...opts, dt: 1 / 60 });
      if (s.phase === "boiling") {
        minT = Math.min(minT, s.tempC);
        maxT = Math.max(maxT, s.tempC);
      }
    }
    assert.ok(near(minT, 100, 1e-9) && near(maxT, 100, 1e-9), `T ranged ${minT}–${maxT}`);
    assert.equal(s.phase, "gas");
  });

  it("heats toward the setpoint at HEATING_CONDUCTANCE × gap and settles there", () => {
    let s = createThermalState("water", 1, 20);
    const opts = { substance: "water", pressureAtm: 1, setpointC: 60 };
    const first = stepThermal(s, { ...opts, dt: 1 / 60 });
    assert.ok(near(first.heating, HEATING_CONDUCTANCE * 40, 1e-6));
    s = heat(first, 40, opts);
    assert.ok(near(s.tempC, 60, 0.05), `settled at ${s.tempC}`);
    assert.equal(s.phase, "liquid");
  });

  it("cools through freezing when the setpoint is below the melting point, naming it freezing", () => {
    let s = createThermalState("water", 1, 10);
    const opts = { substance: "water", pressureAtm: 1, setpointC: -60 };
    // 10 → 0 °C costs 753 J/mol at ~5 kJ/s: on the step within a quarter of a second.
    s = heat(s, 0.6, opts);
    assert.equal(s.phase, "melting");
    assert.ok(s.heating < 0);
    assert.equal(describePhase({ substance: "water", pressureAtm: 1, tempC: s.tempC, phase: s.phase, fraction: s.fraction, heating: s.heating }).key, "freezing");
    s = heat(s, 60, opts);
    assert.equal(s.phase, "solid");
  });

  it("a change of substance restarts the sample at the setpoint", () => {
    const s = createThermalState("water", 1, 20);
    const n = stepThermal(s, { substance: "neon", pressureAtm: 1, setpointC: 20, dt: 1 / 60 });
    assert.equal(n.substance, "neon");
    assert.equal(n.phase, "gas");
    assert.ok(near(n.tempC, 20, 1e-6));
  });

  it("raising the piston pressure moves a sample that was steam at 105 °C back onto the boiling step", () => {
    let s = createThermalState("water", 1, 105);
    s = stepThermal(s, { substance: "water", pressureAtm: 1, setpointC: 105, dt: 1 / 60 });
    assert.equal(s.phase, "gas");
    const squeezed = stepThermal(s, { substance: "water", pressureAtm: 2, setpointC: 105, dt: 1 / 60 });
    assert.equal(squeezed.phase, "boiling", "at 2 atm the boiling point is ~120 °C, so the same energy is part-condensed");
  });
});

describe("particle model · readouts", () => {
  it("phase labels: the four states, transitions by direction, supercritical only above both critical values", () => {
    const at = (o) => describePhase({ substance: "water", pressureAtm: 1, heating: 1, fraction: 0.3, ...o });
    assert.equal(at({ tempC: -20, phase: "solid" }).label, "Solid Lattice");
    assert.equal(at({ tempC: 20, phase: "liquid" }).label, "Liquid Flow");
    assert.equal(at({ tempC: 120, phase: "gas" }).label, "Gas Chaos");
    assert.equal(at({ tempC: 0, phase: "melting" }).key, "melting");
    assert.equal(at({ tempC: 0, phase: "melting", heating: -1 }).key, "freezing");
    assert.equal(at({ tempC: 100, phase: "boiling", heating: -1 }).key, "condensing");
    assert.equal(at({ tempC: 400, phase: "gas", pressureAtm: 300 }).label, "Supercritical Fluid");
    assert.equal(at({ tempC: 400, phase: "gas", pressureAtm: 10 }).label, "Gas Chaos", "above T꜀ but not P꜀ is a gas");
    assert.match(at({ tempC: 400, phase: "gas", pressureAtm: 10 }).detail, /cannot be liquefied/);
  });

  it("kinetic readout: ³⁄₂kT and √(3RT/M) — water at 100 °C moves at ~720 m/s", () => {
    const k = kineticReadout("water", 100);
    assert.ok(near(k.tempK, 373.15, 1e-9));
    assert.ok(near(k.meanKEzJ, 7.73, 0.01));
    assert.ok(near(k.vRms, 719, 2));
    assert.ok(kineticReadout("neon", 100).vRms < k.vRms, "heavier neon is slower at the same T");
  });

  it("composition splits the particles across a step and always sums to one", () => {
    for (const [phase, f] of [["solid", 0], ["melting", 0.3], ["liquid", 0], ["boiling", 0.7], ["subliming", 0.5], ["gas", 0]]) {
      const c = phaseComposition(phase, f);
      assert.ok(near(c.solid + c.liquid + c.gas, 1, 1e-9));
    }
    assert.deepEqual(phaseComposition("subliming", 0.25), { solid: 0.75, liquid: 0, gas: 0.25 });
  });

  it("column heights: ice stands taller than water, dry ice shorter than liquid CO₂; the piston rises with T and falls with P", () => {
    const ice = columnHeights("water", 1, -10, { solid: 1, liquid: 0, gas: 0 });
    const water = columnHeights("water", 1, 20, { solid: 0, liquid: 1, gas: 0 });
    assert.ok(near(ice.solidH / water.liquidH, 1.09, 1e-9));
    const dryIce = columnHeights("co2", 1, -90, { solid: 1, liquid: 0, gas: 0 });
    assert.ok(dryIce.solidH < CONTAINER.liquidHeight);
    const hot = columnHeights("water", 1, 200, { solid: 0, liquid: 0, gas: 1 });
    const cool = columnHeights("water", 1, 110, { solid: 0, liquid: 0, gas: 1 });
    const squeezed = columnHeights("water", PRESSURE_MAX_ATM, 200, { solid: 0, liquid: 0, gas: 1 });
    assert.ok(hot.piston >= cool.piston);
    assert.ok(squeezed.piston < hot.piston);
    assert.ok(squeezed.piston >= CONTAINER.minHeadspace);
    assert.ok(hot.piston <= CONTAINER.maxHeight);
  });

  it("real molar volumes: steam is ~1 600× the volume of water at 100 °C, 1 atm", () => {
    const v = molarVolumes("water", 1, 100);
    assert.ok(near(v.ratio, 1630, 40), `ratio ${v.ratio}`);
    assert.ok(near(v.gasL, 30.6, 0.2));
  });

  it("exports the slider ranges and the population size the topic registers", () => {
    assert.equal(TEMP_MIN_C, -100);
    assert.equal(TEMP_MAX_C, 250);
    assert.equal(PRESSURE_MIN_ATM, 0.5);
    assert.equal(PRESSURE_MAX_ATM, 10);
    assert.equal(PARTICLE_COUNT, 500);
    assert.ok(near(C_TO_K, 273.15, 1e-9));
  });
});
