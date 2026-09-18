import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CELL_COLOURS,
  COPPER,
  FARADAY,
  HALF_EQUATIONS,
  formatRunTime,
  solveElectrolysis,
} from "../../lib/electrolysis.js";

const close = (a, b, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

describe("constants", () => {
  it("uses the accepted Faraday constant and copper's molar mass", () => {
    assert.equal(FARADAY, 96485);
    assert.equal(COPPER.molarMass, 63.5);
    assert.equal(COPPER.charge, 2, "Cu²⁺ takes two electrons");
  });

  it("writes the half-equations the right way round", () => {
    // Reduction at the cathode, oxidation at the anode.
    assert.equal(HALF_EQUATIONS.cathode, "Cu²⁺ + 2e⁻ → Cu");
    assert.equal(HALF_EQUATIONS.anode, "Cu → Cu²⁺ + 2e⁻");
    assert.ok(HALF_EQUATIONS.cathode.endsWith("Cu"), "the cathode must GAIN copper");
    assert.ok(HALF_EQUATIONS.anode.startsWith("Cu "), "the anode must LOSE copper");
  });
});

describe("Faraday's laws", () => {
  // The textbook check: 1.00 A for 30 minutes deposits 0.592 g of copper.
  it("matches the standard worked example — 1 A, 30 min, 0.592 g", () => {
    const s = solveElectrolysis({ current: 1.0, seconds: 1800 });
    assert.equal(s.chargeC, 1800);
    close(s.depositG, 0.5922, 5e-4);
  });

  it("derives the deposit from Q = It, n = Q/zF, m = nM — not from a table", () => {
    for (const current of [0.1, 0.5, 1, 2.5, 5]) {
      for (const seconds of [0, 1, 37, 600, 3600]) {
        const s = solveElectrolysis({ current, seconds });
        const charge = current * seconds;
        close(s.chargeC, charge, 1e-9);
        close(s.electronsMol, charge / FARADAY, 1e-15);
        close(s.copperMol, charge / (FARADAY * COPPER.charge), 1e-15);
        close(s.depositG, (charge / (FARADAY * COPPER.charge)) * COPPER.molarMass, 1e-12);
        close(s.depositMg, s.depositG * 1000, 1e-9);
      }
    }
  });

  it("is linear in both current and time", () => {
    const a = solveElectrolysis({ current: 1, seconds: 600 });
    const b = solveElectrolysis({ current: 2, seconds: 600 });
    const c = solveElectrolysis({ current: 1, seconds: 1200 });
    close(b.depositG, a.depositG * 2, 1e-12);
    close(c.depositG, a.depositG * 2, 1e-12);
  });

  it("deposits nothing before the cell has run", () => {
    const s = solveElectrolysis({ current: 2, seconds: 0 });
    assert.equal(s.chargeC, 0);
    assert.equal(s.depositG, 0);
    assert.equal(s.ions, 0);
  });

  // The regression: the panel printed `Math.round(current * 14)` under the
  // label "Cu atoms". It was not atoms, and at 1.0 A it read "14" for ever,
  // however long the cell ran.
  it("grows with the run clock — the number is not a function of current alone", () => {
    const early = solveElectrolysis({ current: 1, seconds: 10 });
    const later = solveElectrolysis({ current: 1, seconds: 20 });
    assert.ok(later.depositG > early.depositG);
    assert.ok(later.ions > early.ions);
    close(later.ions, early.ions * 2, 1e6);
  });

  it("counts ions on the Avogadro scale, not in the dozens", () => {
    const s = solveElectrolysis({ current: 1, seconds: 1800 });
    assert.ok(s.ions > 1e21, `only ${s.ions} ions discharged`);
    close(s.ions, s.copperMol * 6.022e23, 1e10);
  });

  it("clamps a negative current or a negative clock rather than un-plating", () => {
    assert.equal(solveElectrolysis({ current: -3, seconds: 100 }).depositG, 0);
    assert.equal(solveElectrolysis({ current: 1, seconds: -100 }).depositG, 0);
    assert.equal(solveElectrolysis({}).depositG, 0);
    assert.equal(solveElectrolysis().current, 1.0);
  });
});

describe("the purification cell", () => {
  // Copper electrodes in CuSO₄: what leaves the anode is what arrives at the
  // cathode, which is why the electrolyte's concentration never changes.
  it("moves the same mass off the anode as onto the cathode", () => {
    for (const seconds of [30, 300, 3000]) {
      const s = solveElectrolysis({ current: 1.5, seconds });
      // One quantity is reported precisely because it describes both electrodes.
      assert.ok(s.depositG > 0);
      close(s.depositMg / 1000, s.depositG, 1e-12);
    }
  });

  it("reports both half-equations on every solve", () => {
    const s = solveElectrolysis({ current: 1, seconds: 5 });
    assert.equal(s.cathode, HALF_EQUATIONS.cathode);
    assert.equal(s.anode, HALF_EQUATIONS.anode);
  });

  it("passes the running flag through as a boolean", () => {
    assert.equal(solveElectrolysis({ running: false }).running, false);
    assert.equal(solveElectrolysis({ running: true }).running, true);
    assert.equal(solveElectrolysis({}).running, true);
  });
});

describe("the run clock", () => {
  it("reads in seconds to one decimal below a minute", () => {
    assert.equal(formatRunTime(0), "0.0 s");
    assert.equal(formatRunTime(8.44), "8.4 s");
    assert.equal(formatRunTime(59.9), "59.9 s");
  });

  it("switches to minutes and pads the seconds at sixty", () => {
    assert.equal(formatRunTime(60), "1 min 00 s");
    assert.equal(formatRunTime(125), "2 min 05 s");
    assert.equal(formatRunTime(3661), "61 min 01 s");
  });

  it("never prints a negative or a NaN clock", () => {
    assert.equal(formatRunTime(-5), "0.0 s");
    assert.equal(formatRunTime(NaN), "0.0 s");
    assert.equal(formatRunTime(undefined), "0.0 s");
  });
});

describe("the colour key", () => {
  it("draws the two electrodes in different shades, so they can be told apart", () => {
    assert.notEqual(CELL_COLOURS.cathode, CELL_COLOURS.anode);
    for (const c of Object.values(CELL_COLOURS)) assert.match(c, /^#[0-9a-f]{6}$/i);
  });
});
