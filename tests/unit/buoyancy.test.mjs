import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APPARATUS,
  FLUIDS,
  G,
  HULL_BLOCK,
  HULL_ENVELOPE,
  HULL_FORM,
  HULL_UNIT_VOLUME,
  MAX_DENSITY,
  MAX_VOLUME,
  MIN_DENSITY,
  MIN_VOLUME,
  SHAPES,
  SOLIDS,
  TANK_INSIDE,
  buoyantForce,
  catchRange,
  fluidComparison,
  formatNewtons,
  gaugePressure,
  hullDraftFraction,
  hullSection,
  isOverflowing,
  massKg,
  shapeMetrics,
  springScaleRange,
  solidPresetFor,
  solveBuoyancy,
  waterlineFraction,
  weightN,
} from "../../lib/buoyancy.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const FLUID_KEYS = Object.keys(FLUIDS);
const SHAPE_KEYS = Object.keys(SHAPES);
const DENSITIES = [0.2, 0.6, 0.92, 1.0, 2.7, 7.85, 13.6, 19.3];
const VOLUMES = [50, 120, 200, 350, 500];

/** Every combination the two sliders and two selects can produce. */
function* everyCase() {
  for (const density of DENSITIES)
    for (const volume of VOLUMES)
      for (const fluid of FLUID_KEYS)
        for (const shape of SHAPE_KEYS)
          yield { density, volume, fluid, shape };
}

describe("units survive the trip from g/cm³ to newtons", () => {
  it("turns 1 g/cm³ over 1000 cm³ into exactly 1 kg", () => {
    assert.ok(close(massKg(1, 1000), 1));
    assert.ok(close(weightN(1, 1000), G, 1e-12));
  });

  it("prices a litre of fresh water at 9.81 N", () => {
    assert.ok(close(buoyantForce(1.0, 1000), 9.81, 1e-9));
  });

  it("gives ~9.81 kPa for a metre of water", () => {
    assert.ok(close(gaugePressure(1.0, 100), 9810, 1e-6));
    assert.equal(gaugePressure(1.0, -5), 0, "a depth above the surface is not negative pressure");
  });
});

describe("Archimedes' principle holds by construction", () => {
  it("makes the upthrust equal the weight of the fluid in the cylinder", () => {
    for (const c of everyCase()) {
      const b = solveBuoyancy(c);
      const displacedWeight = (b.displacedMassG / 1000) * G;
      assert.ok(
        close(b.upthrust, displacedWeight, 1e-9),
        `${c.shape} ${c.density} in ${c.fluid}: F_b ${b.upthrust} vs ${displacedWeight}`,
      );
    }
  });

  it("gets the same upthrust from the pressure difference across the object", () => {
    // Δp × A and ρVg are different routes to the same force. If they ever
    // disagreed, one of the two explanations on screen would be wrong.
    for (const c of everyCase()) {
      const b = solveBuoyancy(c);
      assert.ok(
        close(b.pressureUpthrust, b.upthrust, 1e-6 * Math.max(1, b.upthrust)),
        `${c.shape} ${c.density} in ${c.fluid}: ${b.pressureUpthrust} vs ${b.upthrust}`,
      );
    }
  });

  it("never displaces more than the object could possibly push aside", () => {
    for (const c of everyCase()) {
      const b = solveBuoyancy(c);
      assert.ok(b.displacedCC > 0);
      assert.ok(b.displacedCC <= b.metrics.envelopeCC + 1e-9);
    }
  });
});

describe("floating is decided by mean density, and by nothing else", () => {
  it("floats exactly when mass ÷ envelope volume is below the fluid's density", () => {
    for (const c of everyCase()) {
      const b = solveBuoyancy(c);
      assert.equal(b.floats, b.meanDensity < b.fluidDensity, JSON.stringify(c));
    }
  });

  it("supports a floating object entirely — the scale reads zero", () => {
    for (const c of everyCase()) {
      const b = solveBuoyancy(c);
      if (!b.floats) continue;
      assert.ok(close(b.upthrust, b.weight, 1e-9), "upthrust must equal the whole weight");
      assert.ok(close(b.apparentWeight, 0, 1e-9), "nothing left for the string to carry");
      assert.ok(close(b.netForce, 0, 1e-9), "and therefore no resultant");
    }
  });

  it("submerges a solid in the ratio of the two densities", () => {
    // The syllabus result: fraction under = ρ_object ÷ ρ_fluid.
    for (const shape of ["cube", "rock", "sphere"]) {
      for (const fluid of ["gasoline", "freshwater", "saltwater", "honey", "mercury"]) {
        for (const density of DENSITIES) {
          const b = solveBuoyancy({ density, volume: 200, fluid, shape });
          if (!b.floats) continue;
          assert.ok(
            close(b.submergedFraction, density / FLUIDS[fluid].density, 1e-9),
            `${shape} ${density} in ${fluid}`,
          );
        }
      }
    }
  });

  it("is indifferent to volume — size cannot make a material float", () => {
    const small = solveBuoyancy({ density: 7.85, volume: MIN_VOLUME, fluid: "freshwater", shape: "cube" });
    const large = solveBuoyancy({ density: 7.85, volume: MAX_VOLUME, fluid: "freshwater", shape: "cube" });
    assert.equal(small.floats, false);
    assert.equal(large.floats, false);
    // Ten times the pebble is ten times the upthrust AND ten times the weight.
    assert.ok(close(large.upthrust / small.upthrust, MAX_VOLUME / MIN_VOLUME, 1e-9));
    assert.ok(close(large.weightLostFraction, small.weightLostFraction, 1e-12));
  });

  it("floats a solid only in a denser fluid than itself", () => {
    for (const density of DENSITIES) {
      const floats = fluidComparison({ density, volume: 200, shape: "cube" })
        .filter((f) => f.floats)
        .map((f) => f.fluidDensity);
      for (const d of floats) assert.ok(d > density, `${density} should not float in ${d}`);
    }
  });
});

describe("the steel ship and the steel pebble", () => {
  const steel = SOLIDS.steel.density;

  it("sinks the lump and floats the hull, with the material untouched", () => {
    const pebble = solveBuoyancy({ density: steel, volume: 200, fluid: "freshwater", shape: "rock" });
    const ship = solveBuoyancy({ density: steel, volume: 200, fluid: "freshwater", shape: "hull" });

    assert.equal(pebble.floats, false);
    assert.equal(ship.floats, true);
    // Same metal, same mass — only the volume it pushes aside differs.
    assert.ok(close(pebble.massG, ship.massG, 1e-9));
    assert.ok(close(pebble.objectDensity, ship.objectDensity, 1e-12));
    assert.ok(close(ship.meanDensity, steel / HULL_ENVELOPE, 1e-9));
  });

  it("collapses the displacement to the bare metal once the hull floods", () => {
    // Gold is denser than the hull can carry, so the hull goes under.
    const swamped = solveBuoyancy({ density: SOLIDS.gold.density, volume: 200, fluid: "freshwater", shape: "hull" });
    assert.equal(swamped.floats, false);
    assert.equal(swamped.swamped, true);
    assert.ok(close(swamped.displacedCC, 200, 1e-9), "a flooded hull displaces only its own material");
    const afloat = solveBuoyancy({ density: steel, volume: 200, fluid: "freshwater", shape: "hull" });
    assert.ok(afloat.displacedCC > swamped.displacedCC * 5, "and that is a collapse, not a decline");
  });

  it("still sinks a hull built of something dense enough", () => {
    const justFloats = solveBuoyancy({ density: HULL_ENVELOPE * 0.99, volume: 200, fluid: "freshwater", shape: "hull" });
    const justSinks = solveBuoyancy({ density: HULL_ENVELOPE * 1.01, volume: 200, fluid: "freshwater", shape: "hull" });
    assert.equal(justFloats.floats, true);
    assert.equal(justSinks.floats, false);
  });
});

describe("apparent weight", () => {
  it("is the true weight less the upthrust, and never negative", () => {
    for (const c of everyCase()) {
      const b = solveBuoyancy(c);
      assert.ok(b.apparentWeight >= 0);
      assert.ok(close(b.apparentWeight, Math.max(b.weight - b.upthrust, 0), 1e-9));
    }
  });

  it("reproduces the standard 5 N / 3 N textbook measurement", () => {
    // An object weighing 5.00 N that reads 3.00 N under water has displaced
    // 2.00 N of it — about 204 cm³.
    const volume = 204;
    const density = 5.0 / (volume * 9.81 * 1e-3);
    const b = solveBuoyancy({ density, volume, fluid: "freshwater", shape: "cube" });
    assert.ok(close(b.weight, 5.0, 1e-3));
    assert.ok(close(b.upthrust, 2.0, 5e-3), `upthrust ${b.upthrust}`);
    assert.ok(close(b.apparentWeight, 3.0, 5e-3));
  });

  it("leaves a small but real upthrust in air", () => {
    const b = solveBuoyancy({ density: 7.85, volume: 200, fluid: "air", shape: "cube" });
    assert.ok(b.upthrust > 0, "air is a fluid and does push up");
    assert.ok(b.weightLostFraction < 0.001, "but by well under a tenth of a percent");
  });
});

describe("upthrust does not care how deep the object is", () => {
  it("gives the same force at 4 cm and at 40 cm, while the pressures differ", () => {
    const shallow = solveBuoyancy({ density: 7.85, volume: 200, fluid: "freshwater", shape: "cube", topDepthCm: 4 });
    const deep = solveBuoyancy({ density: 7.85, volume: 200, fluid: "freshwater", shape: "cube", topDepthCm: 40 });

    assert.ok(close(shallow.upthrust, deep.upthrust, 1e-12), "the upthrust is unchanged");
    assert.ok(deep.pressureTop > shallow.pressureTop * 5, "though both faces feel far more pressure");
    assert.ok(
      close(shallow.pressureDifference, deep.pressureDifference, 1e-9),
      "because only the difference across the object lifts it",
    );
  });
});

describe("geometry", () => {
  it("keeps footprint × height equal to the envelope volume", () => {
    for (const shape of SHAPE_KEYS) {
      for (const volume of VOLUMES) {
        const m = shapeMetrics(shape, volume);
        assert.ok(close(m.envelopeCC, volume * SHAPES[shape].envelope, 1e-9));
        if (shape === "sphere") continue; // A ball's footprint is not V ÷ h.
        assert.ok(close(m.footprint * m.height, m.envelopeCC, 1e-6), `${shape} at ${volume}`);
      }
    }
  });

  it("reads a prism's waterline straight off the volume fraction", () => {
    for (const f of [0, 0.25, 0.5, 0.92, 1]) {
      assert.ok(close(waterlineFraction("cube", f), f, 1e-9));
    }
  });

  it("gives the lumpy rock the ellipsoid's waterline, not a prism's", () => {
    for (const f of [0.2, 0.6, 0.9]) {
      assert.ok(close(waterlineFraction("rock", f), waterlineFraction("sphere", f), 1e-9));
    }
    // And a rock's own volume is the slider's, as an ellipsoid: pi/6 * L * W * H.
    for (const v of VOLUMES) {
      const m = shapeMetrics("rock", v);
      assert.ok(close((Math.PI / 6) * m.length * m.width * m.height, v, 1e-6), `V=${v}`);
    }
  });

  it("uses the spherical cap for a ball, so ice sits higher than its volume suggests", () => {
    assert.ok(close(waterlineFraction("sphere", 0.5), 0.5, 1e-6), "half a ball is half its diameter");
    assert.ok(close(waterlineFraction("sphere", 0), 0, 1e-6));
    assert.ok(close(waterlineFraction("sphere", 1), 1, 1e-6));
    // 92% of the volume of a sphere is only about 83% of its diameter.
    const ice = waterlineFraction("sphere", 0.92);
    assert.ok(ice > 0.8 && ice < 0.85, `got ${ice}`);
    assert.ok(ice < 0.92, "the widest part is in the middle, so the depth fraction is smaller");

    // And it inverts the cap formula it claims to: f = 3u² − 2u³.
    for (const f of [0.1, 0.3, 0.5, 0.7, 0.92]) {
      const u = waterlineFraction("sphere", f);
      assert.ok(close(3 * u * u - 2 * u * u * u, f, 1e-6), `f=${f} u=${u}`);
    }
  });

  it("is monotonic in the volume fraction", () => {
    let last = -1;
    for (let f = 0; f <= 1.0001; f += 0.05) {
      const u = waterlineFraction("sphere", f);
      assert.ok(u >= last - 1e-12, `dropped at ${f}`);
      last = u;
    }
  });
});

describe("the preset table and the slider agree", () => {
  it("recognises every named solid, and nothing between them", () => {
    for (const [key, spec] of Object.entries(SOLIDS)) {
      assert.equal(solidPresetFor(spec.density), key);
    }
    assert.equal(solidPresetFor(4.321), "custom");
  });

  it("keeps every preset reachable from the slider's range", () => {
    // Gold is 19.30, which is why the ceiling is not 12: a preset the control
    // cannot reach would be a button that lies about what it selected.
    for (const spec of Object.values(SOLIDS)) {
      assert.ok(spec.density >= MIN_DENSITY && spec.density <= MAX_DENSITY, spec.label);
    }
  });

  it("puts mercury between the two densest solids, which is the point of it", () => {
    const mercury = FLUIDS.mercury.density;
    assert.ok(SOLIDS.steel.density < mercury, "steel floats on mercury");
    assert.ok(SOLIDS.gold.density > mercury, "gold does not");
    assert.equal(solveBuoyancy({ density: SOLIDS.steel.density, volume: 200, fluid: "mercury", shape: "cube" }).floats, true);
    assert.equal(solveBuoyancy({ density: SOLIDS.gold.density, volume: 200, fluid: "mercury", shape: "cube" }).floats, false);
  });
});

describe("nothing produces a NaN", () => {
  it("stays finite across every control combination, and at the extremes", () => {
    const cases = [...everyCase(), { density: MIN_DENSITY, volume: MIN_VOLUME, fluid: "air", shape: "hull" }];
    for (const c of cases) {
      const b = solveBuoyancy(c);
      for (const [k, v] of Object.entries(b)) {
        if (typeof v !== "number") continue;
        assert.ok(Number.isFinite(v), `${k} was ${v} for ${JSON.stringify(c)}`);
      }
    }
  });

  it("survives a zero or missing argument rather than dividing by it", () => {
    const b = solveBuoyancy({});
    assert.ok(Number.isFinite(b.upthrust));
    const zero = solveBuoyancy({ density: 0, volume: 0 });
    assert.ok(Number.isFinite(zero.meanDensity));
    assert.ok(Number.isFinite(zero.acceleration));
  });
});

describe("the hull is one body, in the numbers and in the picture", () => {
  /**
   * Immersed volume of the unit hull at waterline `y`, worked out a different
   * way from the solver: slice the body by HEIGHT (width at each level, read off
   * the section outline by interpolation) instead of clipping it by station.
   */
  function immersedByLevels(y) {
    const stations = 240;
    const levels = 320;
    let volume = 0;
    for (let i = 0; i < stations; i += 1) {
      const section = hullSection((i + 0.5) / stations); // ascending in height
      const yTop = Math.min(y, section[section.length - 1][1]);
      const yBot = section[0][1];
      if (yTop <= yBot) continue;
      const widthAt = (level) => {
        for (let k = 0; k < section.length - 2; k += 1) {
          const [x0, y0] = section[k];
          const [x1, y1] = section[k + 1];
          if (level <= y1 + 1e-12) return x0 + ((x1 - x0) * (level - y0)) / (y1 - y0);
        }
        return section[section.length - 2][0];
      };
      let area = 0;
      for (let j = 0; j < levels; j += 1) {
        area += 2 * widthAt(yBot + ((j + 0.5) / levels) * (yTop - yBot)) * ((yTop - yBot) / levels);
      }
      volume += area * (HULL_FORM.length / stations);
    }
    return volume;
  }

  it("sinks the drawn hull to the waterline that holds exactly the displaced volume", () => {
    for (const f of [0.05, 0.2, 0.4, 0.65, 0.9]) {
      const draft = hullDraftFraction(f);
      const displaced = immersedByLevels(-0.5 + draft);
      assert.ok(close(displaced / HULL_UNIT_VOLUME, f, 0.006), `f=${f}: got ${displaced / HULL_UNIT_VOLUME}`);
    }
  });

  it("sits a fuller-than-a-box hull deeper than the old box did, but not absurdly so", () => {
    // A hull is narrower at the keel than at the deck, so displacing a given
    // volume takes MORE draft than the straight-sided box said.
    for (const f of [0.1, 0.3, 0.65]) {
      assert.ok(hullDraftFraction(f) > f, `f=${f}`);
    }
    assert.ok(HULL_BLOCK > 0.45 && HULL_BLOCK < 0.8, `block coefficient ${HULL_BLOCK}`);
    assert.ok(close(hullDraftFraction(0), 0, 1e-9) && close(hullDraftFraction(1), 1, 1e-9));
  });

  it("is monotonic: more displaced volume never means a shallower draft", () => {
    let last = -1;
    for (let f = 0; f <= 1.0001; f += 0.02) {
      const d = hullDraftFraction(f);
      assert.ok(d >= last - 1e-12, `dropped at ${f}`);
      last = d;
    }
  });

  it("holds its envelope in the drawn body, and reports the same size to the scene", () => {
    for (const v of VOLUMES) {
      const m = shapeMetrics("hull", v);
      assert.ok(close(m.height ** 3 * HULL_UNIT_VOLUME, m.envelopeCC, 1e-6), `V=${v}`);
      assert.ok(close(m.length, HULL_FORM.length * m.height, 1e-9));
      assert.ok(close(m.width, HULL_FORM.beam * m.height, 1e-9));
    }
  });

  it("fits inside the overflow can at every volume the slider can make", () => {
    for (let v = MIN_VOLUME; v <= MAX_VOLUME; v += 10) {
      const m = shapeMetrics("hull", v);
      assert.ok(m.length < TANK_INSIDE.width, `length ${m.length} vs ${TANK_INSIDE.width} at V=${v}`);
      assert.ok(m.width < TANK_INSIDE.depth, `beam ${m.width} vs ${TANK_INSIDE.depth} at V=${v}`);
      assert.ok(m.length > m.width, "a boat is longer than it is wide");
    }
  });

  it("holds a hull that has gone under clear of the bottom of the can", () => {
    // Held four centimetres down when there is room, and as deep as there is room for when not.
    for (const volume of [50, 200, 350, 500]) {
      const b = solveBuoyancy({ density: MAX_DENSITY, volume, fluid: "freshwater", shape: "hull" });
      assert.equal(b.swamped, true);
      assert.ok(b.topDepth >= 0.3 - 1e-9);
      assert.ok(b.topDepth + b.metrics.height <= APPARATUS.waterDepth + 1e-9, `V=${volume}: bottom below the can`);
    }
    const small = solveBuoyancy({ density: MAX_DENSITY, volume: 50, shape: "hull" });
    assert.equal(small.topDepth, APPARATUS.immersionDepth);
  });

  it("floats steel in freshwater with a realistic draft, below the deck", () => {
    const b = solveBuoyancy({ density: 7.85, volume: 200, fluid: "freshwater", shape: "hull" });
    assert.equal(b.floats, true, "Steel hull should float in freshwater");
    assert.ok(b.draftCm < b.metrics.height, "Draft must be strictly less than hull height");
    assert.ok(b.submergedFraction > 0.5 && b.submergedFraction < 0.8, `Expected ~65% by volume, got ${b.submergedFraction}`);
    assert.ok(b.draftFraction > b.submergedFraction, "and the draft is deeper than the volume fraction");
    assert.ok(b.freeboardCm > 0);
  });
});

describe("a hull in air", () => {
  it("is not flooded, because air cannot flood it - it still pushes aside its whole envelope", () => {
    const b = solveBuoyancy({ density: 7.85, volume: 200, fluid: "air", shape: "hull" });
    assert.equal(b.floats, false);
    assert.equal(b.swamped, false);
    assert.ok(close(b.displacedCC, b.metrics.envelopeCC, 1e-9));
  });
});

describe("the instruments read what they should", () => {
  it("never lets a floating hull overflow the catch cylinder", () => {
    for (const c of everyCase()) {
      const b = solveBuoyancy(c);
      assert.ok(b.overflowML <= catchRange(b.overflowML) + 1e-9, JSON.stringify(c));
    }
    assert.equal(catchRange(200), 500);
    assert.equal(catchRange(540), 1000);
    assert.equal(catchRange(5750), 10000);
  });

  it("picks the smallest spring balance that reads the true weight", () => {
    assert.equal(springScaleRange(0.4), 1);
    assert.equal(springScaleRange(5.3), 10);
    assert.equal(springScaleRange(10), 20, "a full-scale reading is not a reading");
    for (const c of everyCase()) {
      const b = solveBuoyancy(c);
      const range = springScaleRange(b.weight);
      assert.ok(b.weight <= range * 0.98 + 1e-9 || range === 200, JSON.stringify(c));
    }
  });

  it("prints air's upthrust as a real number, not 0.00 N", () => {
    const air = solveBuoyancy({ density: 2.7, volume: 200, fluid: "air", shape: "cube" });
    assert.ok(air.upthrust > 0 && air.upthrust < 0.01);
    assert.match(formatNewtons(air.upthrust), /^\d+\.\d+ mN$/);
    assert.equal(formatNewtons(1.96), "1.96 N");
    assert.equal(formatNewtons(0), "0.00 N");
    assert.equal(formatNewtons(NaN), "0.00 N");
  });
});

describe("overflow spout stream directional pouring logic", () => {
  const isPouring = isOverflowing;

  it("activates stream only when catch cylinder is receiving displaced fluid (target > shown)", () => {
    assert.equal(isPouring(100, 250), true, "Water should pour from spout when filling catch cylinder");
    assert.equal(isPouring(0, 50), true, "Initial overflow stream should be visible");
  });

  it("strictly suppresses stream when volume is lowered or specimen is lifted (target < shown)", () => {
    assert.equal(isPouring(300, 100), false, "Water must NEVER pour from spout when cylinder level recedes");
    assert.equal(isPouring(500, 0), false, "Emptying cylinder must not trigger spout stream");
    assert.equal(isPouring(200, 199), false, "Minor reductions must not trigger spout stream");
  });

  it("deactivates stream once catch cylinder settles at target level", () => {
    assert.equal(isPouring(200, 200), false, "Settled level must not pour");
    assert.equal(isPouring(200, 200.4), false, "Within settle threshold must not pour");
  });
});


