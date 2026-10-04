import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  configuration,
  configurationString,
  describeOrbitals,
  displayRadius,
  mostProbableRadius,
  orbitalOccupancy,
  radialNodeRadii,
  radiusEnclosing,
  sampleOrbital,
  slaterZeff,
  subshellFor,
} from "../../lib/orbitals.js";
import { ELEMENTS } from "../../lib/atomicStructure.js";

describe("Aufbau configurations", () => {
  it("writes the textbook configurations", () => {
    assert.equal(configurationString(1), "1s¹");
    assert.equal(configurationString(6), "1s² 2s² 2p²");
    assert.equal(configurationString(11), "1s² 2s² 2p⁶ 3s¹");
    assert.equal(configurationString(17), "1s² 2s² 2p⁶ 3s² 3p⁵");
    assert.equal(configurationString(20), "1s² 2s² 2p⁶ 3s² 3p⁶ 4s²");
  });

  it("regroups into exactly the Bohr shells for all twenty elements", () => {
    for (const el of Object.values(ELEMENTS)) {
      const byShell = { K: 0, L: 0, M: 0, N: 0 };
      for (const s of configuration(el.protons)) byShell[s.shell] += s.electrons;
      const shells = ["K", "L", "M", "N"].map((k) => byShell[k]).filter((n) => n > 0);
      assert.deepEqual(shells, el.shells, el.symbol);
    }
  });

  it("follows Hund's rule in the p subshell", () => {
    const p = subshellFor("2p");
    assert.deepEqual(orbitalOccupancy(p, 2), [1, 1, 0]);
    assert.deepEqual(orbitalOccupancy(p, 3), [1, 1, 1]);
    assert.deepEqual(orbitalOccupancy(p, 4), [2, 1, 1]);
    assert.deepEqual(orbitalOccupancy(p, 6), [2, 2, 2]);
  });
});

describe("Slater's effective nuclear charge", () => {
  it("matches the textbook values", () => {
    assert.ok(Math.abs(slaterZeff(11, "3s") - 2.2) < 1e-9);
    assert.ok(Math.abs(slaterZeff(6, "2p") - 3.25) < 1e-9);
    assert.ok(Math.abs(slaterZeff(17, "3p") - 6.1) < 1e-9);
    assert.ok(Math.abs(slaterZeff(19, "4s") - 2.2) < 1e-9);
    assert.ok(Math.abs(slaterZeff(2, "1s") - 1.7) < 1e-9);
  });
});

describe("hydrogen-like wavefunctions", () => {
  it("puts hydrogen's most probable 1s radius at one Bohr radius", () => {
    assert.ok(Math.abs(mostProbableRadius(1, 0, 1) - 1) < 0.01);
    // and 2p's at 4 a₀ — n² for the l = n − 1 orbitals.
    assert.ok(Math.abs(mostProbableRadius(2, 1, 1) - 4) < 0.02);
  });

  it("finds the radial nodes where they analytically are", () => {
    assert.deepEqual(radialNodeRadii(1, 0, 1), []);
    assert.deepEqual(radialNodeRadii(2, 1, 1), []);
    assert.ok(Math.abs(radialNodeRadii(2, 0, 1)[0] - 2) < 1e-6);
    const [a, b] = radialNodeRadii(3, 0, 1);
    assert.ok(Math.abs(a - (9 - 3 * Math.sqrt(3)) / 2) < 1e-6);
    assert.ok(Math.abs(b - (9 + 3 * Math.sqrt(3)) / 2) < 1e-6);
    assert.ok(Math.abs(radialNodeRadii(3, 1, 1)[0] - 6) < 1e-6);
    assert.equal(radialNodeRadii(4, 0, 1).length, 3);
  });

  it("samples 1s with the right mean radius (3/2 a₀ for hydrogen)", () => {
    const { positions } = sampleOrbital({ n: 1, l: 0, Z: 1, count: 40000, seed: 2 });
    let sum = 0;
    for (let i = 0; i < 40000; i += 1) sum += Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    assert.ok(Math.abs(sum / 40000 - 1.5) < 0.03);
  });

  it("samples a p orbital along its own axis, three times wider along it (cos²)", () => {
    for (const [axis, k] of [["x", 0], ["y", 1], ["z", 2]]) {
      const { positions } = sampleOrbital({ n: 2, l: 1, axis, Z: 3, count: 30000, seed: 5 });
      const m = [0, 0, 0];
      for (let i = 0; i < 30000; i += 1) for (let c = 0; c < 3; c += 1) m[c] += positions[i * 3 + c] ** 2;
      const other = m[(k + 1) % 3];
      assert.ok(Math.abs(m[k] / other - 3) < 0.15, `${axis}: ${m[k] / other}`);
    }
  });

  it("gives a p orbital's two lobes opposite signs", () => {
    const { positions, signs } = sampleOrbital({ n: 2, l: 1, axis: "x", Z: 3, count: 4000, seed: 7 });
    for (let i = 0; i < 4000; i += 1) assert.equal(signs[i], positions[i * 3] >= 0 ? 1 : -1);
  });

  it("encloses 90% of the 1s electron inside 2.66 a₀ for hydrogen", () => {
    assert.ok(Math.abs(radiusEnclosing(1, 0, 1, 0.9) - 2.66) < 0.02);
  });

  it("compresses radii without reordering them", () => {
    let prev = -1;
    for (let r = 0; r < 30; r += 0.25) {
      const d = displayRadius(r);
      assert.ok(d > prev);
      prev = d;
    }
  });
});

describe("describeOrbitals — what the readout prints", () => {
  it("is complete for every element and every focus", () => {
    for (const el of Object.values(ELEMENTS)) {
      for (const focus of ["all", "1s", "2s", "2p", "3s", "3p", "4s"]) {
        const d = describeOrbitals(el.symbol, focus);
        for (const s of d.subshells) {
          assert.ok(Number.isFinite(s.Zeff) && s.Zeff > 0);
          assert.ok(Number.isFinite(s.peakA0) && s.peakA0 > 0);
        }
        assert.equal(d.focusEmpty, focus !== "all" && !d.subshells.some((s) => s.key === focus));
      }
    }
  });

  it("counts carbon's two unpaired p electrons and flags 4s-before-3d for K and Ca", () => {
    assert.equal(describeOrbitals("C").unpairedP, 2);
    assert.equal(describeOrbitals("O").unpairedP, 2);
    assert.equal(describeOrbitals("N").unpairedP, 3);
    assert.equal(describeOrbitals("K").fourSBeforeThreeD, true);
    assert.equal(describeOrbitals("Ar").fourSBeforeThreeD, false);
  });
});
