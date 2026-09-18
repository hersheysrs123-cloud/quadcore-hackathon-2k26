import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BOND_COLOUR,
  LATTICE_FACTS,
  LATTICE_KEYS,
  latticeFactsFor,
  latticeKeyFor,
} from "../../lib/lattices.js";

const STRUCTURES = ["nacl", "diamond", "graphite", "quartz", "ice"];

describe("the five structures", () => {
  it("covers every structure the picker offers, in facts and in key", () => {
    assert.deepEqual(Object.keys(LATTICE_FACTS), STRUCTURES);
    assert.deepEqual(Object.keys(LATTICE_KEYS), STRUCTURES);
  });

  it("gives each one a title, a bonding type, rows and a note", () => {
    for (const s of STRUCTURES) {
      const f = LATTICE_FACTS[s];
      assert.ok(f.title.length > 0, `${s} has no title`);
      assert.ok(f.type.length > 0, `${s} has no type`);
      assert.ok(f.rows.length >= 4, `${s} has only ${f.rows.length} rows`);
      assert.ok(f.note.length > 20, `${s} has no note`);
      for (const [label, value] of f.rows) {
        assert.ok(label.length > 0);
        assert.ok(String(value).length > 0, `${s} row "${label}" has no value`);
      }
    }
  });

  it("uses only tones the HUD knows how to render", () => {
    const TONES = new Set(["default", "neutral", "gold", "good", "warn", "bad", "sky", "rose"]);
    for (const s of STRUCTURES) {
      for (const [label, , tone] of LATTICE_FACTS[s].rows) {
        if (tone !== undefined) assert.ok(TONES.has(tone), `${s} row "${label}" uses tone "${tone}"`);
      }
    }
  });
});

describe("the colour key", () => {
  // The regression: bond entries were keyed #38bdf8 against bonds the scene
  // actually drew #3f4854, so the key pointed at a colour nothing on screen
  // used. A key that names a colour nothing uses is worse than no key.
  it("keys every covalent, ionic and Si–O bond with the colour the scene draws", () => {
    for (const s of STRUCTURES) {
      for (const e of LATTICE_KEYS[s]) {
        if (e.shape !== "line") continue;
        // The two genuinely weaker interactions are drawn in their own colour.
        const weak = /hydrogen bond|between the layers/i.test(e.label);
        if (!weak) assert.equal(e.colour ?? e.color, BOND_COLOUR, `${s}: "${e.label}" is keyed wrong`);
      }
    }
  });

  it("gives every entry a colour, a shape and a label", () => {
    for (const s of STRUCTURES) {
      assert.ok(LATTICE_KEYS[s].length >= 2, `${s} has a one-line key`);
      for (const e of LATTICE_KEYS[s]) {
        assert.match(e.color, /^#[0-9a-f]{6}$/i, `${s}: "${e.label}" has no colour`);
        assert.ok(["dot", "line"].includes(e.shape), `${s}: "${e.label}" has shape "${e.shape}"`);
        assert.ok(e.label.length > 0);
      }
    }
  });

  it("names both atoms in each two-element structure", () => {
    const labels = (s) => LATTICE_KEYS[s].map((e) => e.label).join(" | ");
    assert.match(labels("nacl"), /Na/);
    assert.match(labels("nacl"), /Cl/);
    assert.match(labels("quartz"), /Silicon/);
    assert.match(labels("quartz"), /Oxygen/);
    assert.match(labels("ice"), /Oxygen/);
    assert.match(labels("ice"), /Hydrogen atom/);
  });

  // The regression: the graphite key named a "Delocalised Electron" and an
  // "Interlayer Force" and the scene drew neither — the gold it pointed at was
  // the middle layer's carbons, coloured so the shear is visible.
  it("keys graphite's delocalised electron and interlayer force — both now drawn", () => {
    const labels = LATTICE_KEYS.graphite.map((e) => e.label);
    assert.ok(labels.some((l) => /Delocalised electron/i.test(l)));
    assert.ok(labels.some((l) => /between the layers/i.test(l)));
    assert.ok(labels.some((l) => /middle layer/i.test(l)), "the gold must be explained as the middle layer");
  });
});

describe("the facts the structures are taught for", () => {
  it("says diamond does not conduct and graphite does", () => {
    const rows = (s) => LATTICE_FACTS[s].rows.map((r) => `${r[0]}: ${r[1]}`).join(" | ");
    assert.match(rows("diamond"), /Conducts: no/);
    assert.match(rows("graphite"), /Conducts: yes/);
  });

  it("says ionic NaCl conducts only once its ions are free", () => {
    const rows = LATTICE_FACTS.nacl.rows.map((r) => `${r[0]}: ${r[1]}`);
    assert.ok(rows.some((r) => /Solid conducts: no/.test(r)));
    assert.ok(rows.some((r) => /Molten .* conducts: yes/.test(r)));
  });

  it("gives graphite three bonds per carbon and diamond four", () => {
    const bondRow = (s) => LATTICE_FACTS[s].rows.find((r) => /Bonds per carbon/.test(r[0]))[1];
    assert.match(bondRow("diamond"), /4/);
    assert.match(bondRow("graphite"), /3/);
  });

  it("keeps quartz at one silicon to two oxygens", () => {
    const rows = LATTICE_FACTS.quartz.rows.map((r) => `${r[0]}: ${r[1]}`).join(" | ");
    assert.match(rows, /SiO₂/);
    assert.match(rows, /1 silicon : 2 oxygen/);
    // The drawn fragment has under-coordinated silicons at its surface, and
    // the note has to say so rather than leaving them looking like a mistake.
    assert.match(LATTICE_FACTS.quartz.note, /fragment/);
  });

  it("says ice is less dense than liquid water, and why", () => {
    const rows = LATTICE_FACTS.ice.rows.map((r) => `${r[0]}: ${r[1]}`).join(" | ");
    assert.match(rows, /Density: lower than liquid water/);
    assert.match(LATTICE_FACTS.ice.note, /open cage/);
    assert.match(rows, /hydrogen bonds/i);
  });

  it("puts the molecular crystal's melting point far below the giant ones", () => {
    const mp = (s) => {
      const row = LATTICE_FACTS[s].rows.find((r) => /Melting point/.test(r[0]));
      return row ? Number(String(row[1]).match(/-?\d+/)[0]) : null;
    };
    assert.equal(mp("ice"), 0);
    for (const s of ["nacl", "diamond", "quartz"]) {
      assert.ok(mp(s) > 500, `${s} melts at ${mp(s)} °C`);
    }
  });
});

describe("lookups", () => {
  it("falls back to a real structure rather than returning undefined", () => {
    assert.equal(latticeFactsFor("nonsense"), LATTICE_FACTS.nacl);
    assert.equal(latticeKeyFor("nonsense"), LATTICE_KEYS.nacl);
    assert.equal(latticeFactsFor(undefined), LATTICE_FACTS.nacl);
  });

  it("returns the matching pair for every structure", () => {
    for (const s of STRUCTURES) {
      assert.equal(latticeFactsFor(s), LATTICE_FACTS[s]);
      assert.equal(latticeKeyFor(s), LATTICE_KEYS[s]);
    }
  });
});
