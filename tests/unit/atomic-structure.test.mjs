import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ATOM_COLOURS,
  ELEMENTS,
  SHELL_CAPACITY,
  SHELL_NAMES,
  describeAtom,
  elementFor,
} from "../../lib/atomicStructure.js";

const SYMBOLS = Object.keys(ELEMENTS);

describe("atomic structure — the element table", () => {
  it("offers the first twenty elements, H to Ca, in atomic-number order", () => {
    assert.deepEqual(SYMBOLS, [
      "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
      "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
    ]);
    SYMBOLS.forEach((s, i) => assert.equal(ELEMENTS[s].protons, i + 1, `${s} is out of order`));
  });

  it("uses the most abundant isotope's neutron count", () => {
    const A = { H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35, Ar: 40, K: 39, Ca: 40 };
    for (const s of SYMBOLS) assert.equal(describeAtom(s).massNumber, A[s], `${s} mass number`);
  });

  it("gives every element a shell count within the 2,8,8 rule", () => {
    for (const s of SYMBOLS) {
      const el = ELEMENTS[s];
      el.shells.forEach((n, i) => {
        assert.ok(n >= 1, `${s} shell ${i} is empty`);
        assert.ok(n <= SHELL_CAPACITY[i], `${s} shell ${i} holds ${n} > ${SHELL_CAPACITY[i]}`);
      });
    }
  });

  it("fills every shell below the outermost", () => {
    for (const s of SYMBOLS) {
      const { shells } = ELEMENTS[s];
      for (let i = 0; i < shells.length - 1; i += 1) {
        assert.equal(shells[i], SHELL_CAPACITY[i], `${s} has a gap in shell ${SHELL_NAMES[i]}`);
      }
    }
  });

  it("has electrons matching protons — these are neutral atoms", () => {
    for (const s of SYMBOLS) {
      const el = ELEMENTS[s];
      const inShells = el.shells.reduce((a, b) => a + b, 0);
      assert.equal(inShells, el.protons, `${s} draws ${inShells} electrons for ${el.protons} protons`);
    }
  });
});

describe("describeAtom", () => {
  it("derives the mass number rather than storing it", () => {
    assert.equal(describeAtom("Na").massNumber, 23);
    assert.equal(describeAtom("Cl").massNumber, 35);
    assert.equal(describeAtom("C").massNumber, 12);
    assert.equal(describeAtom("H").massNumber, 1);
  });

  it("reads the valence off the outermost shell", () => {
    assert.equal(describeAtom("H").valence, 1);
    assert.equal(describeAtom("C").valence, 4);
    assert.equal(describeAtom("Na").valence, 1);
    assert.equal(describeAtom("Cl").valence, 7);
  });

  it("names the outer shell and the period from the same shell list", () => {
    assert.equal(describeAtom("H").shellName, "K");
    assert.equal(describeAtom("H").period, 1);
    assert.equal(describeAtom("C").shellName, "L");
    assert.equal(describeAtom("C").period, 2);
    assert.equal(describeAtom("Na").shellName, "M");
    assert.equal(describeAtom("Na").period, 3);
    assert.equal(describeAtom("Cl").shellName, "M");
    assert.equal(describeAtom("Cl").period, 3);
  });

  it("calls only the noble gases full — calcium's 2 in N is not a full shell", () => {
    const full = SYMBOLS.filter((s) => describeAtom(s).full);
    assert.deepEqual(full, ["He", "Ne", "Ar"]);
    for (const s of full) assert.equal(ELEMENTS[s].group, "0");
    assert.equal(describeAtom("Ca").capacity, 8);
    assert.equal(describeAtom("He").capacity, 2);
  });

  it("prints the configuration in the comma form the panel shows", () => {
    assert.equal(describeAtom("Na").configuration, "2,8,1");
    assert.equal(describeAtom("Cl").configuration, "2,8,7");
  });

  // The regression: the panel's note had branches for Na and Cl and fell
  // through to the carbon explanation, so hydrogen printed "Carbon shares 4
  // valence electrons via covalent bonds."
  it("gives each element its OWN bonding note, never another's", () => {
    const notes = SYMBOLS.map((s) => describeAtom(s).bonding);
    assert.equal(new Set(notes).size, SYMBOLS.length, "two elements share a bonding note");
    assert.ok(!describeAtom("H").bonding.includes("Carbon"));
    assert.ok(!describeAtom("Na").reaction.includes("Carbon"));
    assert.ok(describeAtom("H").bonding.includes("K shell"));
  });

  it("falls back to a real element for an unknown symbol", () => {
    assert.equal(elementFor("Xx"), ELEMENTS.Na);
    assert.equal(describeAtom(undefined).symbol, "Na");
  });
});

describe("the colour key", () => {
  it("names a distinct colour for each drawn particle", () => {
    const keys = ["proton", "neutron", "electron", "valence"];
    for (const k of keys) assert.match(ATOM_COLOURS[k], /^#[0-9a-f]{6}$/i, `${k} has no colour`);
    assert.equal(new Set(keys.map((k) => ATOM_COLOURS[k])).size, keys.length);
  });
});
