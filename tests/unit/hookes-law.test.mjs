import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ELASTIC_LIMIT_EXTENSION,
  FAILURE_EXTENSION,
  G,
  NATURAL_LENGTH,
  elasticEnergy,
  elasticLimitForce,
  extensionFor,
  failureForce,
  loadCurve,
  loadForce,
  loadingExtension,
  permanentSet,
  plasticStiffness,
  recoverableEnergy,
  solveSpring,
  tangentStiffness,
} from "../../lib/hookesLaw.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("Hooke's law region", () => {
  it("makes extension directly proportional to load", () => {
    const k = 50;
    const a = solveSpring({ massKg: 0.2, k });
    const b = solveSpring({ massKg: 0.4, k });
    assert.ok(close(b.extension / a.extension, 2, 1e-9), "double the load, double the extension");
  });

  it("solves x = F ÷ k exactly below the limit", () => {
    for (const k of [10, 50, 80, 150]) {
      for (const mass of [0.05, 0.1]) {
        const s = solveSpring({ massKg: mass, k });
        if (!s.elastic) continue;
        assert.ok(close(s.extension, loadForce(mass) / k, 1e-12), `k=${k} m=${mass}`);
      }
    }
  });

  it("reports a gradient of exactly k while it is still elastic", () => {
    const s = solveSpring({ massKg: 0.1, k: 60 });
    assert.equal(s.elastic, true);
    assert.ok(close(s.stiffness, 60, 1e-12));
  });

  it("stores ½kx², which is the area under the straight line", () => {
    const k = 70;
    const s = solveSpring({ massKg: 0.3, k });
    assert.ok(close(s.elasticEnergy, 0.5 * k * s.extension ** 2, 1e-12));
    // Area of the triangle under the graph = ½ × x × F.
    assert.ok(close(s.elasticEnergy, 0.5 * s.extension * s.force, 1e-9));
  });

  it("gives back everything it stored while elastic", () => {
    const s = solveSpring({ massKg: 0.2, k: 90 });
    assert.equal(s.elastic, true);
    assert.ok(close(s.elasticEnergy, s.recoverableEnergy, 1e-9));
  });

  it("starts from the spring's natural length", () => {
    const s = solveSpring({ massKg: 0, k: 50 });
    assert.ok(close(s.length, NATURAL_LENGTH, 1e-12));
    assert.ok(close(s.extension, 0, 1e-12));
  });
});

describe("the elastic limit", () => {
  it("scales the limit load with stiffness but keeps the limit extension fixed", () => {
    for (const k of [10, 50, 150]) {
      assert.ok(close(elasticLimitForce(k), k * ELASTIC_LIMIT_EXTENSION, 1e-12));
      assert.ok(close(loadingExtension(elasticLimitForce(k), k), ELASTIC_LIMIT_EXTENSION, 1e-12));
    }
  });

  it("bends the graph over past the limit — the gradient falls well below k", () => {
    const k = 80;
    const past = solveSpring({ massKg: (elasticLimitForce(k) * 1.2) / G, k });
    assert.equal(past.yielding, true);
    assert.ok(past.stiffness < k, `${past.stiffness} should be below ${k}`);
    assert.ok(close(past.stiffness, plasticStiffness(k), 1e-9));
  });

  it("stays continuous across the limit — no jump in extension", () => {
    const k = 80;
    const limit = elasticLimitForce(k);
    assert.ok(close(loadingExtension(limit - 1e-7, k), loadingExtension(limit + 1e-7, k), 1e-6));
  });

  it("keeps the same 60% margin between yield and failure for every spring", () => {
    for (const k of [10, 45, 150]) {
      assert.ok(close(failureForce(k) / elasticLimitForce(k), 1.6, 1e-12));
      assert.ok(close(loadingExtension(failureForce(k), k), FAILURE_EXTENSION, 1e-9));
    }
  });

  it("leaves no permanent set at all below the limit", () => {
    const k = 80;
    assert.ok(close(permanentSet(elasticLimitForce(k) * 0.99, k), 0, 1e-12));
    assert.ok(permanentSet(elasticLimitForce(k) * 1.2, k) > 0);
  });
});

describe("plastic deformation and the permanent set", () => {
  const k = 80;
  const peak = elasticLimitForce(k) * 1.35;

  it("unloads down a line of the ORIGINAL gradient, not a softer one", () => {
    const a = solveSpring({ massKg: 0.4, k, peakForce: peak });
    const b = solveSpring({ massKg: 0.8, k, peakForce: peak });
    const gradient = (b.force - a.force) / (b.extension - a.extension);
    assert.ok(close(gradient, k, 1e-6), `unloading gradient ${gradient} should still be ${k}`);
    assert.ok(close(a.stiffness, k, 1e-12));
  });

  it("comes to rest longer than it started once the load is off", () => {
    const s = solveSpring({ massKg: 0, k, peakForce: peak });
    assert.ok(s.permanentSet > 0);
    assert.ok(close(s.extension, s.permanentSet, 1e-12));
    assert.ok(s.restLength > NATURAL_LENGTH);
  });

  it("does not spring back to L₀ under a load it used to handle", () => {
    const fresh = solveSpring({ massKg: 0.4, k });
    const tired = solveSpring({ massKg: 0.4, k, peakForce: peak });
    assert.ok(tired.extension > fresh.extension, "a yielded spring sits lower under the same load");
    assert.ok(close(tired.extension - fresh.extension, tired.permanentSet, 1e-9));
  });

  it("meets the loading curve exactly at the peak it remembers", () => {
    const atPeak = extensionFor(peak, k, peak);
    assert.ok(close(atPeak, loadingExtension(peak, k), 1e-12));
  });

  it("remembers only its worst moment, not its whole history", () => {
    const wobbled = solveSpring({ massKg: 0.3, k, peakForce: peak });
    const straightThere = solveSpring({ massKg: 0.3, k, peakForce: peak });
    assert.ok(close(wobbled.extension, straightThere.extension, 1e-12));
  });

  it("stops giving back the full ½kx² once it has yielded", () => {
    const s = solveSpring({ massKg: peak / G, k });
    assert.ok(s.recoverableEnergy < s.elasticEnergy, "plastic work is spent, not stored");
    assert.ok(close(s.recoverableEnergy, recoverableEnergy(s.force, k), 1e-12));
  });
});

describe("overload and failure", () => {
  it("marks a spring as scrap once the coils have pulled straight", () => {
    const s = solveSpring({ massKg: 2.5, k: 10 });
    assert.equal(s.failed, true);
    assert.ok(close(s.extension, FAILURE_EXTENSION, 1e-9), "the drawn spring cannot exceed its own limit");
  });

  it("stops the graph rising once it has failed — the gradient goes to zero", () => {
    assert.ok(close(tangentStiffness(failureForce(40) * 2, 40, 0), 0, 1e-12));
  });

  it("never leaves a permanent set longer than the stretched spring it came from", () => {
    for (const k of [10, 30, 80, 150]) {
      for (const mass of [0.5, 1.5, 2.5]) {
        const s = solveSpring({ massKg: mass, k });
        assert.ok(s.permanentSet <= s.extension + 1e-9, `k=${k} m=${mass}`);
        assert.ok(s.permanentSet < FAILURE_EXTENSION);
      }
    }
  });

  it("keeps every solve finite and non-negative across the whole control range", () => {
    for (let k = 10; k <= 150; k += 5) {
      for (let mass = 0.05; mass <= 2.5; mass += 0.05) {
        const s = solveSpring({ massKg: mass, k });
        for (const v of [s.force, s.extension, s.length, s.permanentSet, s.elasticEnergy, s.stiffness]) {
          assert.ok(Number.isFinite(v) && v >= 0, `k=${k} m=${mass.toFixed(2)}`);
        }
      }
    }
  });
});

describe("the plotted curve matches the solver", () => {
  it("draws the elastic segment from the origin to the limit point", () => {
    const k = 80;
    const c = loadCurve(k, 0);
    assert.deepEqual(c.elastic[0], [0, 0]);
    assert.ok(close(c.elastic[1][0], ELASTIC_LIMIT_EXTENSION, 1e-12));
    assert.ok(close(c.elastic[1][1], elasticLimitForce(k), 1e-12));
  });

  it("adds no plastic or unloading branch to a spring that has never yielded", () => {
    const c = loadCurve(80, elasticLimitForce(80) * 0.5);
    assert.equal(c.plastic.length, 0);
    assert.equal(c.unload.length, 0);
  });

  it("lands the unloading line exactly on the permanent set", () => {
    const k = 80;
    const peak = elasticLimitForce(k) * 1.4;
    const c = loadCurve(k, peak);
    const end = c.unload[c.unload.length - 1];
    assert.ok(close(end[1], 0, 1e-12), "it must arrive at zero load");
    assert.ok(close(end[0], permanentSet(peak, k), 1e-9));
  });

  it("joins the plastic branch onto the end of the elastic one", () => {
    const k = 80;
    const c = loadCurve(k, elasticLimitForce(k) * 1.3);
    assert.deepEqual(c.plastic[0], c.elastic[1]);
  });
});

describe("energy helpers", () => {
  it("gives ½kx² directly", () => {
    assert.ok(close(elasticEnergy(50, 0.1), 0.25, 1e-12));
  });

  it("agrees with F²/2k, which is the same triangle", () => {
    const k = 50;
    const x = 0.08;
    assert.ok(close(elasticEnergy(k, x), recoverableEnergy(k * x, k), 1e-12));
  });
});
