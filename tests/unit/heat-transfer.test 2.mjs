import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AMBIENT_C,
  BOILING_C,
  FLAME_MAX_C,
  FLAME_MIN_C,
  FLAME_OUT_BELOW,
  PLATE_AREA,
  PLATE_DISTANCE,
  PLATE_EMISSIVITY,
  PLATE_FILM_H,
  ROD_LENGTH,
  ROD_MATERIALS,
  STEFAN_BOLTZMANN,
  TIME_LAPSE,
  WATER_TIME_CONSTANT,
  WAX_MELTING_C,
  absorbedPower,
  conductionRate,
  convectionDeltaT,
  convectionSpeed,
  diffusivity,
  finParameter,
  flameColour,
  flameIsLit,
  flamePower,
  flameTemperature,
  flirColour,
  irradianceAt,
  mixHex,
  nodeTimeConstant,
  plateEquilibrium,
  plateTemperature,
  plateTimeConstant,
  radiatedPower,
  relax,
  rodProfile,
  rodTemperature,
  solveHeatTransfer,
  steadyExcessFraction,
  waterAsymptote,
  waterDensity,
  waterFrom,
  waterState,
  warmupFraction,
} from "../../lib/heatTransfer.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const MATERIALS = Object.keys(ROD_MATERIALS);
const INTENSITIES = [0, 1, 2, 5, 15, 35, 55, 70, 85, 100];

// ─── Conduction ─────────────────────────────────────────────────────

describe("the fin equation behaves like a rod", () => {
  it("starts at the hot end and falls away monotonically", () => {
    for (const m of MATERIALS) {
      assert.ok(close(steadyExcessFraction(m, 0), 1, 1e-9), `${m} at the hot end`);
      let last = 1.0000001;
      for (let x = 0; x <= ROD_LENGTH + 1e-9; x += ROD_LENGTH / 40) {
        const f = steadyExcessFraction(m, x);
        assert.ok(Number.isFinite(f), `${m} produced ${f} at ${x}`);
        assert.ok(f >= 0 && f <= 1, `${m} out of range at ${x}: ${f}`);
        assert.ok(f <= last + 1e-12, `${m} rose at ${x}`);
        last = f;
      }
    }
  });

  it("stays finite for an insulator, where cosh(mL) would overflow the naive form", () => {
    // Wood's mL is about 36, so cosh(mL) is 1.7 × 10¹⁵ — a ratio of two huge
    // numbers. The exponential form has no large intermediate at all.
    const wood = finParameter("wood") * ROD_LENGTH;
    assert.ok(wood > 30, `mL was only ${wood}, so this test is no longer testing anything`);
    assert.ok(Number.isFinite(Math.cosh(wood)));
    for (const x of [0, 0.05, 0.1, ROD_LENGTH]) {
      assert.ok(Number.isFinite(steadyExcessFraction("wood", x)));
    }
  });

  it("is algebraically the cosh form, checked where cosh is still well behaved", () => {
    // Copper's mL is 0.7, so the textbook expression is safe to evaluate and
    // can be compared directly against the rewrite the library uses.
    const m = finParameter("copper");
    for (const x of [0, 0.03, 0.09, 0.15, ROD_LENGTH]) {
      const textbook = Math.cosh(m * (ROD_LENGTH - x)) / Math.cosh(m * ROD_LENGTH);
      assert.ok(close(steadyExcessFraction("copper", x), textbook, 1e-12), `at x=${x}`);
    }
  });

  it("ranks the four materials the way their conductivities do", () => {
    const tips = MATERIALS.map((m) => ({ m, f: steadyExcessFraction(m, ROD_LENGTH) }));
    assert.ok(tips[0].f > tips[1].f, "copper beats iron");
    assert.ok(tips[1].f > tips[2].f, "iron beats glass");
    assert.ok(tips[2].f > tips[3].f, "glass beats wood");
    // The lesson: two of them deliver heat to the far end and two do not.
    assert.ok(steadyExcessFraction("copper", ROD_LENGTH) > 0.5);
    assert.ok(steadyExcessFraction("wood", ROD_LENGTH) < 1e-6);
  });

  it("gives a decay length longer than the rod for copper and millimetres for wood", () => {
    assert.ok(1 / finParameter("copper") > ROD_LENGTH, "copper carries past the end of the rod");
    assert.ok(1 / finParameter("wood") < 0.01, "wood gives up within a centimetre");
    // 1/m = √(kr/2h), so a rod of four times the conductivity reaches twice as far.
    assert.ok(close(finParameter("copper") / finParameter("iron"), Math.sqrt(80 / 385), 1e-12));
  });

  it("holds the hot end at the source temperature and the tip above the room", () => {
    for (const m of MATERIALS) {
      assert.ok(close(rodTemperature({ material: m, x: 0, hotC: 95 }), 95, 1e-9));
      const tip = rodTemperature({ material: m, x: ROD_LENGTH, hotC: 95 });
      assert.ok(tip >= AMBIENT_C - 1e-9 && tip <= 95 + 1e-9, `${m} tip ${tip}`);
    }
  });

  it("carries more heat through a better conductor at the same ΔT", () => {
    const rates = MATERIALS.map((m) => conductionRate({ material: m, hotC: 95 }));
    for (let i = 1; i < rates.length; i += 1) assert.ok(rates[i - 1] > rates[i]);
    assert.equal(conductionRate({ material: "copper", hotC: AMBIENT_C }), 0, "no ΔT, no flow");
  });

  it("profiles the rod at the resolution asked for, hot end first", () => {
    const nodes = rodProfile({ material: "copper", hotC: 90, count: 12 });
    assert.equal(nodes.length, 12);
    assert.ok(nodes[0].temperature > nodes[11].temperature);
    for (const n of nodes) assert.ok(n.x >= 0 && n.x <= ROD_LENGTH);
  });
});

describe("the transient runs at the diffusivity, not at the conductivity", () => {
  it("starts cold and ends at the steady profile", () => {
    for (const m of MATERIALS) {
      assert.ok(close(warmupFraction(m, ROD_LENGTH, 0), 0, 1e-12), `${m} at t=0`);
      assert.ok(close(warmupFraction(m, ROD_LENGTH, Infinity), 1, 1e-12), `${m} at t=∞`);
      let last = -1;
      for (const t of [0, 1, 5, 20, 120, 1e4]) {
        const f = warmupFraction(m, ROD_LENGTH, t);
        assert.ok(f >= last, `${m} went backwards at ${t}`);
        last = f;
      }
    }
  });

  it("sends the warm front up the copper long before the iron", () => {
    const at = (m) => warmupFraction(m, ROD_LENGTH, 12);
    assert.ok(at("copper") > at("iron") * 2, "copper's α is nearly five times iron's");
    assert.ok(at("glass") < at("iron") / 10, "and glass is not in the same race at all");
    // α = k/ρc, and it is α — not k — that sets the speed.
    assert.ok(diffusivity("copper") > diffusivity("iron"));
    assert.ok(close(nodeTimeConstant("copper", 0.1), 0.01 / (4 * diffusivity("copper")), 1e-12));
  });

  it("takes no time at all to warm the hot end itself", () => {
    assert.equal(warmupFraction("wood", 0, 0), 1);
  });
});

describe("the integrator and the closed form are the same model", () => {
  it("lands on the closed form after stepping there frame by frame", () => {
    for (const intensity of [15, 55, 100]) {
      let mean = AMBIENT_C;
      const target = waterAsymptote(intensity);
      for (let i = 0; i < 60 * 25; i += 1) mean = relax(mean, target, WATER_TIME_CONSTANT, 1 / 60);
      assert.ok(
        close(mean, waterState({ intensity, seconds: 25 }).mean, 1e-6),
        `at ${intensity}%: ${mean} vs ${waterState({ intensity, seconds: 25 }).mean}`,
      );
    }
  });

  it("does not depend on the frame rate", () => {
    // Two half-steps must equal one whole step, or a stuttering frame would
    // change the physics.
    const one = relax(20, 200, 50, 0.4);
    const two = relax(relax(20, 200, 50, 0.2), 200, 50, 0.2);
    assert.ok(close(one, two, 1e-12), `${one} vs ${two}`);
  });

  it("never overshoots, however long the frame", () => {
    const jump = relax(20, 100, 0.5, 60);
    assert.ok(jump <= 100 + 1e-9 && jump >= 20);
    assert.equal(relax(20, 100, 0, 0.016), 100, "a zero time constant is instantaneous");
    assert.equal(relax(37, 100, 50, 0), 37, "a zero-length frame changes nothing");
  });

  it("cools back down when the target falls below the current value", () => {
    let t = 90;
    for (let i = 0; i < 600; i += 1) t = relax(t, AMBIENT_C, WATER_TIME_CONSTANT, 1 / 60);
    assert.ok(t < 90 && t > AMBIENT_C, `cooled to ${t}`);
  });
});

// ─── The burner ─────────────────────────────────────────────────────

describe("the burner", () => {
  it("is out below the threshold and hotter above it", () => {
    assert.equal(flameIsLit(0), false);
    assert.equal(flameIsLit(FLAME_OUT_BELOW - 0.1), false);
    assert.equal(flameIsLit(FLAME_OUT_BELOW), true);
    assert.equal(flameTemperature(0), AMBIENT_C);
    assert.equal(flamePower(0), 0);
    assert.ok(flameTemperature(100) === FLAME_MAX_C);
    assert.ok(flameTemperature(FLAME_OUT_BELOW) >= FLAME_MIN_C);
  });

  it("rises monotonically with the gas", () => {
    let last = -Infinity;
    for (const i of INTENSITIES) {
      const t = flameTemperature(i);
      assert.ok(t >= last, `fell at ${i}`);
      last = t;
    }
  });

  it("goes from a luminous yellow to a roaring blue", () => {
    for (const i of INTENSITIES) assert.match(flameColour(i), /^#[0-9a-f]{6}$/);
    assert.notEqual(flameColour(10), flameColour(100));
  });
});

// ─── Convection ─────────────────────────────────────────────────────

describe("convection", () => {
  it("grows the gradient as the two-thirds power of the heat put in", () => {
    // ΔT ∝ Q^⅔ falls out of Q = ṁcΔT with ṁ ∝ √(gβΔT·H).
    const a = convectionDeltaT(100);
    const b = convectionDeltaT(800);
    assert.ok(close(b / a, Math.pow(8, 2 / 3), 1e-9), `ratio was ${b / a}`);
    assert.equal(convectionDeltaT(0), 0);
    assert.equal(convectionDeltaT(-5), 0);
  });

  it("speeds the current up as the square root of the gradient", () => {
    assert.ok(close(convectionSpeed(16) / convectionSpeed(4), 2, 1e-9));
    assert.equal(convectionSpeed(0), 0);
  });

  it("makes hot water less dense — which is the whole mechanism", () => {
    assert.ok(waterDensity(80) < waterDensity(20));
    assert.ok(close(waterDensity(AMBIENT_C), 1000, 1e-9));
  });

  it("caps the beaker at boiling and flattens the gradient there", () => {
    const boiling = waterFrom(BOILING_C, 100);
    assert.ok(close(boiling.mean, BOILING_C, 1e-9));
    assert.ok(boiling.delta < 0.01, "a rolling boil stirs the beaker flat");
    assert.equal(boiling.boiling, true);
    assert.ok(waterState({ intensity: 100, seconds: Infinity }).mean <= BOILING_C + 1e-9);
  });

  it("keeps the current running AT the boil rather than stalling it", () => {
    // The flow is driven by the buoyancy the heat supplies, not by the
    // flattened gradient the thermometers read. Deriving it from the latter
    // would bring the dye to a halt at exactly the moment a real beaker is
    // churning hardest.
    const gentle = waterFrom(60, 55);
    const boiling = waterFrom(BOILING_C, 100);
    assert.ok(boiling.speed > gentle.speed, `${boiling.speed} should exceed ${gentle.speed}`);
    assert.ok(boiling.speed > 0.01, "and be a visible current, not a crawl");
    assert.ok(Number.isFinite(boiling.loopSeconds));
  });

  it("is still when the burner is out", () => {
    const cold = waterFrom(AMBIENT_C, 0);
    assert.equal(cold.speed, 0);
    assert.equal(cold.delta, 0);
    assert.equal(cold.loopSeconds, Infinity);
  });

  it("puts the bottom above the top, never the other way round", () => {
    for (const intensity of INTENSITIES) {
      const w = waterState({ intensity, seconds: 40 });
      assert.ok(w.bottom >= w.top - 1e-9, `inverted at ${intensity}%`);
      assert.ok(w.top >= AMBIENT_C - 1e-9);
    }
  });
});

// ─── Radiation ──────────────────────────────────────────────────────

describe("radiation", () => {
  it("follows the fourth power of absolute temperature", () => {
    // Divide out the area, which also scales with the gas, and what is left
    // must be the T⁴ ratio exactly.
    const hot = flameTemperature(100) + 273.15;
    const cool = flameTemperature(50) + 273.15;
    const amb = AMBIENT_C + 273.15;
    const predicted =
      (2 * (Math.pow(hot, 4) - Math.pow(amb, 4))) / (Math.pow(cool, 4) - Math.pow(amb, 4));
    assert.ok(close(radiatedPower(100) / radiatedPower(50), predicted, 1e-9));
    assert.equal(radiatedPower(0), 0);
  });

  it("spreads as an inverse square", () => {
    assert.ok(close(irradianceAt(80, 0.1) / irradianceAt(80, 0.2), 4, 1e-9));
    assert.ok(irradianceAt(80, 0.15) > 0);
  });

  it("balances the plate's books at the temperature it reports", () => {
    for (const intensity of [15, 55, 100]) {
      const t = plateEquilibrium(intensity);
      const gain = absorbedPower(intensity);
      const tK = t + 273.15;
      const ambK = AMBIENT_C + 273.15;
      const loss =
        PLATE_EMISSIVITY * STEFAN_BOLTZMANN * 2 * PLATE_AREA * (Math.pow(tK, 4) - Math.pow(ambK, 4)) +
        PLATE_FILM_H * 2 * PLATE_AREA * (t - AMBIENT_C);
      assert.ok(close(gain, loss, 1e-6 * Math.max(gain, 1e-3)), `at ${intensity}%: ${gain} vs ${loss}`);
    }
  });

  it("leaves the plate at room temperature with the burner out", () => {
    assert.equal(plateEquilibrium(0), AMBIENT_C);
    assert.equal(plateTemperature({ intensity: 0 }), AMBIENT_C);
  });

  it("warms the plate more, the more gas there is", () => {
    let last = -Infinity;
    for (const i of INTENSITIES) {
      const t = plateEquilibrium(i);
      assert.ok(t >= last - 1e-9, `fell at ${i}`);
      last = t;
    }
    assert.ok(plateEquilibrium(100) > AMBIENT_C + 20, "and noticeably, at full gas");
    assert.ok(plateEquilibrium(100) < 200, "but it is a warm plate, not a hot one");
  });

  it("approaches that equilibrium rather than jumping to it", () => {
    const target = plateEquilibrium(100);
    const early = plateTemperature({ intensity: 100, seconds: 1 });
    const late = plateTemperature({ intensity: 100, seconds: 600 });
    assert.ok(early > AMBIENT_C && early < target);
    assert.ok(close(late, target, 0.01));
    assert.ok(plateTimeConstant(target) > 1);
  });

  it("moves faster than the beaker does — light is instant, water is not", () => {
    const plateFraction =
      (plateTemperature({ intensity: 100, seconds: 3 }) - AMBIENT_C) / (plateEquilibrium(100) - AMBIENT_C);
    const waterFraction =
      (waterState({ intensity: 100, seconds: 3 }).mean - AMBIENT_C) /
      (Math.min(waterAsymptote(100), BOILING_C) - AMBIENT_C);
    assert.ok(plateFraction > waterFraction, `${plateFraction} vs ${waterFraction}`);
  });
});

// ─── Colour ramps ───────────────────────────────────────────────────

describe("the false-colour ramp", () => {
  it("returns a valid hex everywhere, including outside its range", () => {
    for (const t of [-100, 0, 20, 55, 90, 120, 5000]) {
      assert.match(flirColour(t, 20, 120), /^#[0-9a-f]{6}$/, `at ${t}`);
    }
  });

  it("gets brighter with temperature, so it reads without the key", () => {
    const luma = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
    };
    let last = -1;
    for (let t = 20; t <= 120; t += 5) {
      const l = luma(flirColour(t, 20, 120));
      assert.ok(l >= last - 2, `ironbow dipped at ${t}`);
      last = l;
    }
    assert.ok(luma(flirColour(120, 20, 120)) > luma(flirColour(20, 20, 120)) * 5);
  });

  it("clamps instead of wrapping at the ends", () => {
    assert.equal(flirColour(-40, 20, 120), flirColour(20, 20, 120));
    assert.equal(flirColour(9000, 20, 120), flirColour(120, 20, 120));
  });

  it("blends between two colours and returns the endpoints exactly", () => {
    assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
    assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
    assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
    assert.equal(mixHex("#000000", "#ffffff", 5), "#ffffff", "t is clamped");
  });
});

// ─── The whole bench ────────────────────────────────────────────────

describe("the bench, solved as one", () => {
  it("reports all four rods whichever one is selected", () => {
    for (const material of MATERIALS) {
      const s = solveHeatTransfer({ intensity: 70, material });
      assert.equal(s.rods.length, 4, "all four are always on screen and always modelled");
      assert.equal(s.selected.key, material);
      assert.equal(s.rods.filter((r) => r.selected).length, 1);
    }
  });

  it("hangs every rod off the same hot end, so only the material differs", () => {
    const s = solveHeatTransfer({ intensity: 70 });
    const hot = s.rods[0].hotC;
    for (const rod of s.rods) assert.ok(close(rod.hotC, hot, 1e-12), `${rod.key} started somewhere else`);
  });

  it("melts the wax up the copper and not at all up the wood", () => {
    const s = solveHeatTransfer({ intensity: 80 });
    const byKey = Object.fromEntries(s.rods.map((r) => [r.key, r]));
    assert.ok(byKey.copper.waxFront > byKey.iron.waxFront);
    assert.ok(byKey.iron.waxFront > byKey.glass.waxFront);
    assert.ok(byKey.glass.waxFront <= 0.2, "only the bit actually in the hot water");
    assert.ok(byKey.copper.tipC > WAX_MELTING_C, "the copper tip really does pass the melting point");
    assert.ok(byKey.wood.tipC < WAX_MELTING_C);
  });

  it("leaves the insulators' tips at room temperature", () => {
    const s = solveHeatTransfer({ intensity: 100 });
    const byKey = Object.fromEntries(s.rods.map((r) => [r.key, r]));
    assert.ok(close(byKey.wood.tipC, AMBIENT_C, 0.01));
    assert.ok(close(byKey.glass.tipC, AMBIENT_C, 0.01));
    assert.ok(byKey.copper.tipC > 70, "while the copper is too hot to hold");
  });

  it("puts everything at room temperature with the burner out", () => {
    const s = solveHeatTransfer({ intensity: 0 });
    assert.equal(s.lit, false);
    assert.ok(close(s.water.bottom, AMBIENT_C, 1e-9));
    assert.ok(close(s.plateC, AMBIENT_C, 1e-9));
    for (const rod of s.rods) assert.ok(close(rod.tipC, AMBIENT_C, 1e-9));
    assert.equal(s.radiatedPower, 0);
  });

  it("keeps the false-colour ceiling above everything it has to colour", () => {
    for (const intensity of INTENSITIES) {
      const s = solveHeatTransfer({ intensity });
      assert.ok(s.hottestC >= s.water.bottom - 1e-9);
      assert.ok(s.hottestC >= s.plateC - 1e-9);
      for (const rod of s.rods) assert.ok(s.hottestC >= rod.tipC - 1e-9);
      assert.ok(s.hottestC > AMBIENT_C, "and never collapses to a zero-width ramp");
    }
  });

  it("has all three modes respond somewhere across the flame's range", () => {
    // The point of the scene is the comparison, so a slider that moves only
    // one of the three would be a broken control.
    const low = solveHeatTransfer({ intensity: 20 });
    const high = solveHeatTransfer({ intensity: 90 });
    assert.ok(high.selected.tipC > low.selected.tipC, "conduction");
    assert.ok(high.water.speed > low.water.speed, "convection");
    assert.ok(high.plateC > low.plateC, "radiation");
  });

  it("stays finite at every setting", () => {
    for (const intensity of INTENSITIES) {
      for (const material of MATERIALS) {
        for (const seconds of [0, 0.5, 10, 240, Infinity]) {
          const s = solveHeatTransfer({ intensity, material, seconds });
          const check = (v, name) => assert.ok(Number.isFinite(v), `${name} was ${v} at ${intensity}%/${seconds}s`);
          check(s.water.bottom, "bottom");
          check(s.water.top, "top");
          check(s.water.speed, "speed");
          check(s.plateC, "plate");
          check(s.hottestC, "hottest");
          for (const rod of s.rods) {
            check(rod.tipC, `${rod.key} tip`);
            for (const n of rod.nodes) check(n.temperature, `${rod.key} node`);
          }
        }
      }
    }
  });

  it("runs the whole scene on one time base", () => {
    // Every rate is scaled by the same factor, which is what makes the ratios
    // between them the real ones even though no single duration is.
    assert.ok(TIME_LAPSE > 1);
    // A second of scene time is TIME_LAPSE seconds of laboratory time — for
    // the rod's warm-up and for the beaker's alike.
    assert.ok(close(warmupFraction("copper", 0.1, 1), 1 - Math.exp(-TIME_LAPSE / nodeTimeConstant("copper", 0.1)), 1e-12));
    const oneSecond = relax(20, 100, 8 / TIME_LAPSE, 1);
    const scaled = relax(20, 100, 8, TIME_LAPSE);
    assert.ok(close(oneSecond, scaled, 1e-9), "the lapse enters every rate the same way");
  });
});
