import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GAS_CONSTANT,
  PRE_EXPONENTIAL,
  PROCEEDS_ABOVE_K,
  boltzmannFraction,
  floorEa,
  solveEnergetics,
} from "../../lib/energetics.js";

/** The five controls, swept over the ranges the sliders can reach. */
const ACTIVATIONS = [10, 40, 90, 140, 200];
const ENTHALPIES = [-150, -60, -5, 0, 5, 60, 150];
const TEMPERATURES = [200, 298, 350, 500, 800];

const sweep = (fn) => {
  for (const activation of ACTIVATIONS) {
    for (const deltaH of ENTHALPIES) {
      for (const temperature of TEMPERATURES) {
        for (const catalyst of [false, true]) fn({ activation, deltaH, temperature, catalyst });
      }
    }
  }
};

describe("constants", () => {
  it("uses the molar gas constant", () => {
    assert.equal(GAS_CONSTANT, 8.314);
    assert.ok(PRE_EXPONENTIAL > 0);
    assert.ok(PROCEEDS_ABOVE_K > 0);
  });
});

describe("the activation-energy floor", () => {
  // The forward barrier can never be lower than ΔH: the products would sit
  // above the "peak" and the reverse activation energy would come out
  // negative. The sliders can reach that combination.
  it("keeps the barrier above the enthalpy change, always", () => {
    for (const deltaH of ENTHALPIES) assert.ok(floorEa(deltaH) > deltaH);
    assert.equal(floorEa(100), 105);
    assert.equal(floorEa(-60), 5, "an exothermic reaction still needs a positive barrier");
    assert.equal(floorEa(0), 5);
  });

  it("never lets the reverse activation energy go negative", () => {
    sweep((controls) => {
      const s = solveEnergetics(controls);
      assert.ok(s.reverseEa > 0, `Ea(rev) = ${s.reverseEa} for ${JSON.stringify(controls)}`);
      assert.ok(s.effectiveEa > 0);
      assert.ok(s.effectiveEa >= s.floorEa - 1e-9);
    });
  });

  it("says out loud when ΔH forced the barrier above what the slider asked for", () => {
    const clamped = solveEnergetics({ activation: 20, deltaH: 150 });
    assert.equal(clamped.clampedByDeltaH, true);
    assert.equal(clamped.uncatalysed, 155);
    assert.notEqual(clamped.uncatalysed, clamped.activation);

    const free = solveEnergetics({ activation: 200, deltaH: 60 });
    assert.equal(free.clampedByDeltaH, false);
    assert.equal(free.uncatalysed, 200);
  });
});

describe("the Boltzmann fraction", () => {
  it("is a probability — between zero and one, always", () => {
    sweep((controls) => {
      const s = solveEnergetics(controls);
      assert.ok(s.fraction >= 0 && s.fraction <= 1, `fraction ${s.fraction}`);
      assert.ok(s.baseFraction >= 0 && s.baseFraction <= 1);
      assert.ok(Number.isFinite(s.rateConstant));
    });
  });

  it("rises with temperature and falls with the barrier", () => {
    const cold = boltzmannFraction(90, 300);
    const hot = boltzmannFraction(90, 600);
    assert.ok(hot > cold, "heating must make more collisions successful");
    assert.ok(boltzmannFraction(50, 400) > boltzmannFraction(150, 400));
  });

  it("follows exp(-Ea/RT) exactly", () => {
    const want = Math.exp((-90 * 1000) / (GAS_CONSTANT * 350));
    assert.equal(boltzmannFraction(90, 350), want);
  });

  it("does not divide by zero at absolute zero", () => {
    assert.ok(Number.isFinite(boltzmannFraction(90, 0)));
    assert.ok(Number.isFinite(boltzmannFraction(90, -50)));
  });

  it("increases monotonically with temperature at a fixed barrier", () => {
    let last = -1;
    for (let t = 200; t <= 900; t += 10) {
      const f = boltzmannFraction(90, t);
      assert.ok(f > last, `fraction fell going up to ${t} K`);
      last = f;
    }
  });
});

describe("the catalyst", () => {
  it("lowers the barrier and never raises it", () => {
    sweep((controls) => {
      const off = solveEnergetics({ ...controls, catalyst: false });
      const on = solveEnergetics({ ...controls, catalyst: true });
      assert.ok(on.effectiveEa <= off.effectiveEa + 1e-9);
      assert.equal(off.lowering, 0);
      assert.ok(on.lowering >= 0);
    });
  });

  it("cannot push the barrier below the floor ΔH sets", () => {
    const s = solveEnergetics({ activation: 20, deltaH: 10, catalyst: true, catalystDrop: 200 });
    assert.equal(s.effectiveEa, s.floorEa);
    assert.ok(s.effectiveEa > s.deltaH);
  });

  it("leaves ΔH completely alone — that is the whole point of a catalyst", () => {
    sweep((controls) => {
      const off = solveEnergetics({ ...controls, catalyst: false });
      const on = solveEnergetics({ ...controls, catalyst: true });
      assert.equal(on.deltaH, off.deltaH);
      assert.equal(on.exothermic, off.exothermic);
    });
  });

  // The panel was missing this: the bare fraction is ~1e-14 for a reaction
  // that runs perfectly briskly, so it answers "does this go?" with "no"
  // almost always. The speed-up is the number that makes the point.
  it("reports how many more collisions succeed because of it", () => {
    const on = solveEnergetics({ activation: 90, deltaH: -60, catalyst: true, catalystDrop: 35, temperature: 350 });
    assert.ok(on.speedUp > 1, "a catalyst must speed the reaction up");
    const off = solveEnergetics({ activation: 90, deltaH: -60, catalyst: false, temperature: 350 });
    assert.equal(off.speedUp, 1);
    // The speed-up is the ratio of the two fractions, derived not stored.
    assert.ok(Math.abs(on.speedUp - on.fraction / on.baseFraction) < 1e-6);
  });
});

describe("solveEnergetics — what the readout prints", () => {
  it("calls a negative ΔH exothermic and a positive one endothermic", () => {
    assert.equal(solveEnergetics({ deltaH: -60 }).exothermic, true);
    assert.equal(solveEnergetics({ deltaH: 60 }).exothermic, false);
    assert.equal(solveEnergetics({ deltaH: 0 }).exothermic, false);
  });

  it("derives the rate constant from the fraction rather than storing one", () => {
    sweep((controls) => {
      const s = solveEnergetics(controls);
      assert.ok(Math.abs(s.rateConstant - PRE_EXPONENTIAL * s.fraction) < 1e-6 * Math.max(1, s.rateConstant));
      assert.equal(s.proceeds, s.rateConstant > PROCEEDS_ABOVE_K);
    });
  });

  it("says a hot, low-barrier, catalysed reaction proceeds and a cold high-barrier one does not", () => {
    assert.equal(solveEnergetics({ activation: 40, deltaH: -60, temperature: 800, catalyst: true }).proceeds, true);
    assert.equal(solveEnergetics({ activation: 200, deltaH: -60, temperature: 200 }).proceeds, false);
  });

  it("returns a complete, finite record across the whole slider space", () => {
    sweep((controls) => {
      const s = solveEnergetics(controls);
      for (const k of ["floorEa", "uncatalysed", "effectiveEa", "reverseEa", "fraction", "baseFraction", "speedUp", "rateConstant", "lowering"]) {
        assert.ok(Number.isFinite(s[k]), `${k} is ${s[k]} for ${JSON.stringify(controls)}`);
      }
      assert.equal(typeof s.proceeds, "boolean");
      assert.equal(typeof s.clampedByDeltaH, "boolean");
    });
  });

  it("has usable defaults", () => {
    const s = solveEnergetics();
    assert.equal(s.activation, 90);
    assert.equal(s.deltaH, -60);
    assert.equal(s.temperature, 350);
    assert.equal(s.catalyst, false);
  });
});
