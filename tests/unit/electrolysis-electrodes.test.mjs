// ─── Inert vs active electrodes ─────────────────────────────────────
// The electrode material decides the ANODE reaction, and nothing else.
//
// Copper: the anode dissolves at exactly the rate the cathode plates, so
// the copper is only moved across and the solution is never touched.
// Graphite: the anode cannot dissolve, so water is oxidised instead —
// oxygen comes off, the Cu²⁺ is used up with nothing to replace it, and
// the blue drains away into sulfuric acid.
//
// That contrast is the examinable distinction, so it is the thing tested.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CELL_COLOURS,
  ELECTRODES,
  ELECTROLYTE,
  HALF_EQUATIONS,
  MOLAR_GAS_VOLUME_DM3,
  OXYGEN,
  electrodeFor,
  formatGasVolume,
  solveElectrolysis,
} from "../../lib/electrolysis.js";

const close = (a, b, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

describe("the two electrode materials", () => {
  it("offers copper and inert graphite, and falls back to copper", () => {
    assert.deepEqual(Object.keys(ELECTRODES), ["copper", "graphite"]);
    assert.equal(electrodeFor("nonsense"), ELECTRODES.copper);
    assert.equal(electrodeFor(undefined), ELECTRODES.copper);
    assert.equal(solveElectrolysis({}).electrode, "copper");
  });

  it("dissolves only the copper anode", () => {
    assert.equal(ELECTRODES.copper.anodeDissolves, true);
    assert.equal(ELECTRODES.graphite.anodeDissolves, false);
    assert.equal(solveElectrolysis({ electrode: "graphite" }).inert, true);
    assert.equal(solveElectrolysis({ electrode: "copper" }).inert, false);
  });

  it("keeps the same cathode reaction either way", () => {
    // Faraday's laws do not care what the anode is made of.
    assert.equal(ELECTRODES.copper.cathode, ELECTRODES.graphite.cathode);
    assert.equal(ELECTRODES.graphite.cathode, "Cu²⁺ + 2e⁻ → Cu");
  });

  it("oxidises water at an inert anode", () => {
    assert.equal(ELECTRODES.graphite.anode, "2H₂O → O₂ + 4H⁺ + 4e⁻");
    assert.notEqual(ELECTRODES.graphite.anode, ELECTRODES.copper.anode);
  });

  it("explains itself in each material's note", () => {
    for (const key of Object.keys(ELECTRODES)) {
      assert.ok(ELECTRODES[key].note.length > 40, `${key} has no explanation`);
    }
    assert.match(ELECTRODES.graphite.note, /oxidis/i);
    assert.match(ELECTRODES.copper.note, /purif/i);
  });
});

describe("the same charge deposits the same copper either way", () => {
  it("plates identically at the cathode for both materials", () => {
    for (const seconds of [0, 60, 1800, 7200]) {
      for (const current of [0.2, 1.0, 2.0]) {
        const cu = solveElectrolysis({ current, seconds, electrode: "copper" });
        const c = solveElectrolysis({ current, seconds, electrode: "graphite" });
        close(c.depositG, cu.depositG, 1e-12);
        close(c.electronsMol, cu.electronsMol, 1e-15);
      }
    }
  });

  it("loses anode mass only with copper", () => {
    const cu = solveElectrolysis({ current: 1, seconds: 1800, electrode: "copper" });
    const c = solveElectrolysis({ current: 1, seconds: 1800, electrode: "graphite" });
    close(cu.anodeLostG, cu.depositG, 1e-12);
    assert.equal(c.anodeLostG, 0, "graphite must not be consumed");
  });
});

describe("oxygen at the inert anode", () => {
  it("evolves none at a copper anode, at any charge", () => {
    for (const seconds of [0, 600, 7200]) {
      const cu = solveElectrolysis({ current: 2, seconds, electrode: "copper" });
      assert.equal(cu.oxygenMol, 0);
      assert.equal(cu.oxygenCm3, 0);
    }
  });

  // 2Cu²⁺ + 2H₂O → 2Cu + O₂ + 4H⁺: four electrons per O₂ against two per Cu,
  // so there is exactly half as much oxygen as copper, every time.
  it("gives exactly one O2 for every two Cu", () => {
    for (const seconds of [1, 60, 1800, 7200]) {
      for (const current of [0.2, 1.0, 2.0]) {
        const c = solveElectrolysis({ current, seconds, electrode: "graphite" });
        close(c.copperMol / c.oxygenMol, 2, 1e-9);
        close(c.oxygenMol, c.electronsMol / OXYGEN.electronsPerMolecule, 1e-15);
      }
    }
  });

  it("converts to a volume at RTP rather than storing one", () => {
    const c = solveElectrolysis({ current: 1, seconds: 1800, electrode: "graphite" });
    close(c.oxygenCm3, c.oxygenMol * MOLAR_GAS_VOLUME_DM3 * 1000, 1e-9);
    close(c.oxygenG, c.oxygenMol * OXYGEN.molarMass, 1e-12);
    // 1 A for 30 min is 1800 C, so 1800 / 96485 / 4 mol of O2 — about 112 cm³.
    close(c.oxygenCm3, 111.9, 0.5);
  });
});

describe("what happens to the solution", () => {
  it("leaves the copper cell's concentration untouched, however long it runs", () => {
    for (const seconds of [0, 1800, 100000]) {
      const cu = solveElectrolysis({ current: 2, seconds, electrode: "copper" });
      assert.equal(cu.concentrationHolds, true);
      close(cu.remainingMol, ELECTROLYTE.copperMol, 1e-12);
      assert.equal(cu.blueFraction, 1);
      assert.equal(cu.depleted, false);
    }
  });

  it("drains the inert cell's copper away, and the blue with it", () => {
    // Both samples have to be taken BEFORE exhaustion at ~482 s, or they are
    // just two readings of an empty cell.
    const early = solveElectrolysis({ current: 1, seconds: 60, electrode: "graphite" });
    const later = solveElectrolysis({ current: 1, seconds: 300, electrode: "graphite" });
    assert.equal(early.concentrationHolds, false);
    assert.ok(later.remainingMol < early.remainingMol, "Cu2+ must fall as it plates out");
    assert.ok(later.blueFraction < early.blueFraction);
    close(early.remainingMol, ELECTROLYTE.copperMol - early.copperMol, 1e-12);
  });

  it("never drives the solution past empty", () => {
    for (const seconds of [0, 1e4, 1e6, 1e9]) {
      const c = solveElectrolysis({ current: 2, seconds, electrode: "graphite" });
      assert.ok(c.remainingMol >= 0, `remaining ${c.remainingMol} at ${seconds} s`);
      assert.ok(c.blueFraction >= 0 && c.blueFraction <= 1);
      assert.ok(c.remainingMolarity >= 0);
    }
  });

  it("reports depletion once every Cu2+ has plated out", () => {
    const c = solveElectrolysis({ current: 2, seconds: 1e7, electrode: "graphite" });
    assert.equal(c.depleted, true);
    assert.equal(c.blueFraction, 0);
    close(c.remainingMolarity, 0, 1e-12);
  });

  it("starts from a real beaker of solution", () => {
    close(ELECTROLYTE.copperMol, 0.0025, 1e-12);
    assert.equal(ELECTROLYTE.volumeDm3, 0.025);
    assert.equal(ELECTROLYTE.molarity, 0.1);
  });

  // The B41 lesson: a modelled behaviour nobody can reach is not a feature.
  // A 250 cm³ beaker of 1.0 mol/dm³ needs over thirteen hours at 1 A to
  // plate out, so the fade would have been real in the model and invisible
  // in the room.
  it("can actually be exhausted inside a lesson", () => {
    close(ELECTROLYTE.exhaustionC, 482.4, 0.5);
    const minutesAt1A = ELECTROLYTE.exhaustionC / 60;
    assert.ok(minutesAt1A < 15, `${minutesAt1A.toFixed(1)} min at 1 A is too long to watch`);
    assert.ok(minutesAt1A > 1, `${minutesAt1A.toFixed(1)} min at 1 A is too fast to follow`);
    assert.equal(solveElectrolysis({ current: 1, seconds: 490, electrode: "graphite" }).depleted, true);
    assert.equal(solveElectrolysis({ current: 1, seconds: 60, electrode: "graphite" }).depleted, false);
  });

  it("fades visibly as it runs", () => {
    const at = (t) => solveElectrolysis({ current: 1, seconds: t, electrode: "graphite" }).blueFraction;
    assert.ok(at(60) < 0.95, `still ${(at(60) * 100).toFixed(1)} % blue after a minute`);
    assert.ok(at(300) < 0.5, `still ${(at(300) * 100).toFixed(1)} % blue after five minutes`);
    // Monotonic: the blue never comes back.
    let last = Infinity;
    for (let t = 0; t <= 600; t += 5) {
      const b = at(t);
      assert.ok(b <= last + 1e-12, `blue rose again at ${t} s`);
      last = b;
    }
  });
});

describe("the overall equations", () => {
  it("gives each material its own, and neither is the other's", () => {
    const cu = solveElectrolysis({ electrode: "copper" });
    const c = solveElectrolysis({ electrode: "graphite" });
    assert.notEqual(cu.overall, c.overall);
    assert.equal(c.overall, "2Cu²⁺ + 2H₂O → 2Cu + O₂ + 4H⁺");
    assert.equal(cu.anode, HALF_EQUATIONS.anode, "the copper cell is still the old one");
    assert.equal(cu.cathode, HALF_EQUATIONS.cathode);
  });
});

describe("gas volumes", () => {
  it("reads in cm3 below a litre and dm3 above", () => {
    assert.equal(formatGasVolume(0), "0.00 cm³");
    assert.equal(formatGasVolume(5.5), "5.50 cm³");
    assert.equal(formatGasVolume(112), "112 cm³");
    assert.equal(formatGasVolume(1500), "1.50 dm³");
  });

  it("never prints a negative or a NaN volume", () => {
    assert.equal(formatGasVolume(-5), "0.00 cm³");
    assert.equal(formatGasVolume(NaN), "0.00 cm³");
    assert.equal(formatGasVolume(undefined), "0.00 cm³");
  });
});

describe("the key names both anodes", () => {
  it("draws graphite in a different colour from copper, and gives the gas its own", () => {
    assert.notEqual(CELL_COLOURS.graphite, CELL_COLOURS.anode);
    assert.notEqual(CELL_COLOURS.bubble, CELL_COLOURS.oxygen);
    for (const c of Object.values(CELL_COLOURS)) assert.match(c, /^#[0-9a-f]{6}$/i);
  });
});
