import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BOX,
  GASES,
  SPECIES,
  TUBE,
  concentrationProfile,
  createDiffusion,
  describeDiffusion,
  grahamRatio,
  mixingPercent,
  penetration,
  releaseDiffusion,
  ringFraction,
  speedRatioRingFraction,
  stepDiffusion,
  vRms,
} from "../../lib/diffusion.js";

const run = (s, seconds, tempC = 20, dt = 0.02) => {
  for (let t = 0; t < seconds; t += dt) stepDiffusion(s, dt, tempC);
  return s;
};

describe("kinetic theory numbers", () => {
  it("gives the textbook r.m.s. speeds at 20 °C", () => {
    assert.ok(Math.abs(vRms(GASES.ammonia.M, 20) - 656) < 3);
    assert.ok(Math.abs(vRms(GASES.hcl.M, 20) - 448) < 3);
    assert.ok(Math.abs(vRms(GASES.bromine.M, 20) - 214) < 2);
  });

  it("scales speed with √T and with 1/√M", () => {
    const M = 30;
    assert.ok(Math.abs(vRms(M, 4 * 293.15 - 273.15) / vRms(M, 20) - 2) < 1e-9);
    assert.ok(Math.abs(grahamRatio(GASES.ammonia.M, GASES.hcl.M) - Math.sqrt(36.46 / 17.03)) < 1e-12);
  });

  it("puts the speed-ratio ring estimate nearer the HCl end", () => {
    const f = speedRatioRingFraction(GASES.ammonia.M, GASES.hcl.M);
    assert.ok(f > 0.58 && f < 0.6, String(f));
  });
});

describe("the mixing box", () => {
  it("starts with each gas in its own half, and the partition keeps it there", () => {
    const s = run(createDiffusion("mixing", { seed: 4 }), 3);
    assert.equal(mixingPercent(s), 0);
    for (let i = 0; i < s.n; i += 1) {
      const x = s.pos[i * 3];
      if (s.species[i] === SPECIES.left) assert.ok(x < 0);
      else assert.ok(x > 0);
    }
  });

  it("mixes once the partition is lifted, and keeps every particle in the box", () => {
    const s = run(releaseDiffusion(createDiffusion("mixing", { seed: 4 })), 20);
    assert.ok(mixingPercent(s) > 50, `only ${mixingPercent(s)}% mixed`);
    for (let i = 0; i < s.n; i += 1) {
      assert.ok(Math.abs(s.pos[i * 3]) <= BOX.halfL);
      assert.ok(Math.abs(s.pos[i * 3 + 1]) <= BOX.halfH);
      assert.ok(Math.abs(s.pos[i * 3 + 2]) <= BOX.halfD);
    }
  });

  it("lets the lighter gas (air) get further into the other half than bromine", () => {
    const s = run(releaseDiffusion(createDiffusion("mixing", { seed: 9 })), 15);
    const [bromine, air] = penetration(s);
    assert.ok(air > bromine * 1.2, `air ${air} vs bromine ${bromine}`);
  });

  it("mixes faster when hotter", () => {
    // Averaged over seeds: one run's noise is comparable to a 1.3× change in speed.
    const mean = (tempC) =>
      [1, 2, 3, 4, 5, 6].reduce((sum, seed) => sum + mixingPercent(run(releaseDiffusion(createDiffusion("mixing", { seed })), 8, tempC)), 0) / 6;
    const cold = mean(0);
    const hot = mean(200);
    assert.ok(hot > cold + 3, `hot ${hot} vs cold ${cold}`);
  });

  it("profiles each gas along the box and counts every particle once", () => {
    const s = createDiffusion("mixing", { seed: 1 });
    const { left, right } = concentrationProfile(s, 24);
    assert.equal(left.reduce((a, b) => a + b, 0) + right.reduce((a, b) => a + b, 0), s.n);
    assert.equal(left.slice(12).reduce((a, b) => a + b, 0), 0);
    assert.equal(right.slice(0, 12).reduce((a, b) => a + b, 0), 0);
  });

  it("walks the smoke particle without leaving the box", () => {
    const s = run(createDiffusion("mixing", { seed: 3, tracer: true }), 10);
    assert.ok(s.tracer.trail.length > 100);
    const moved = Math.hypot(...s.tracer.pos.map((v, k) => v - [0.6, 0, 0][k]));
    assert.ok(moved > 0.05);
    for (const k of [0, 1, 2]) assert.ok(Math.abs(s.tracer.pos[k]) <= [BOX.halfL, BOX.halfH, BOX.halfD][k]);
  });
});

describe("the NH₃ + HCl tube", () => {
  it("is empty until the cotton wool goes in", () => {
    const s = run(createDiffusion("tube", { seed: 5 }), 2);
    assert.ok(s.species.every((sp) => sp === SPECIES.unborn));
    assert.equal(ringFraction(s), null);
  });

  it("forms a ring of NH₄Cl nearer the HCl end", () => {
    const s = run(releaseDiffusion(createDiffusion("tube", { seed: 5 })), 30);
    assert.ok(s.reacted > 20, `only ${s.reacted} reacted`);
    const f = ringFraction(s);
    assert.ok(f > 0.5 && f < 0.65, `ring at ${f}`);
  });

  it("keeps every gas particle inside the glass", () => {
    const s = run(releaseDiffusion(createDiffusion("tube", { seed: 6 })), 12);
    for (let i = 0; i < s.n; i += 1) {
      if (s.species[i] === SPECIES.unborn) continue;
      const o = i * 3;
      assert.ok(Math.abs(s.pos[o]) <= TUBE.halfL);
      assert.ok(Math.hypot(s.pos[o + 1], s.pos[o + 2]) <= TUBE.r + 1e-6);
    }
  });
});

describe("describeDiffusion — what the readout prints", () => {
  it("names the faster gas and is complete for both experiments", () => {
    for (const experiment of ["mixing", "tube"]) {
      for (const tempC of [0, 20, 200]) {
        const d = describeDiffusion({ experiment, tempC, released: true });
        for (const v of Object.values(d)) {
          if (typeof v === "number") assert.ok(Number.isFinite(v));
        }
        assert.ok(d.speedRatio > 1);
      }
    }
    assert.equal(describeDiffusion({ experiment: "tube" }).faster.formula, "NH₃");
    assert.equal(describeDiffusion({ experiment: "mixing" }).faster.key, "air");
    // The two are never the same gas — the readout names one against the other.
    const t = describeDiffusion({ experiment: "tube" });
    assert.equal(t.slower.formula, "HCl");
    assert.notEqual(t.faster.M, t.slower.M);
  });
});
