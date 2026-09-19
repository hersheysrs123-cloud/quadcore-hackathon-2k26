import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHAIN_NAMES,
  CRACK_ALKENE_CARBONS,
  FAMILIES,
  MAX_CARBONS,
  ORGANIC_COLOURS,
  atomCounts,
  crackProducts,
  describeMolecule,
  familyFor,
  formulaFor,
  isCrackable,
  isValid,
  nameFor,
  sub,
} from "../../lib/organic.js";

const KEYS = Object.keys(FAMILIES);
const every = (fn) => {
  for (const family of KEYS) {
    for (let n = 1; n <= MAX_CARBONS; n += 1) fn(family, n);
  }
};

describe("subscripts", () => {
  it("drops the subscript for one, as chemical notation does", () => {
    assert.equal(sub(1), "");
    assert.equal(sub(0), "");
  });

  it("converts every digit, including multi-digit chains", () => {
    assert.equal(sub(4), "₄");
    assert.equal(sub(12), "₁₂");
    assert.equal(sub(10), "₁₀");
  });
});

describe("the six series", () => {
  it("names every family and gives it a general formula", () => {
    for (const k of KEYS) {
      assert.equal(FAMILIES[k].key, k);
      assert.ok(FAMILIES[k].label.length > 0);
      assert.ok(FAMILIES[k].general.length > 0);
    }
  });

  // The regression: saturation was decided with `family === "alkane"`, so
  // ethanol, ethanoic acid and ethyl ethanoate all reported as unsaturated
  // and as decolourising bromine water. Saturation means no C=C or C≡C.
  it("counts alcohols, acids and esters as SATURATED — they carry oxygen, not a C=C", () => {
    assert.equal(FAMILIES.alcohol.saturated, true);
    assert.equal(FAMILIES.acid.saturated, true);
    assert.equal(FAMILIES.ester.saturated, true);
    assert.equal(FAMILIES.alkane.saturated, true);
    assert.equal(FAMILIES.alkene.saturated, false);
    assert.equal(FAMILIES.alkyne.saturated, false);
  });

  it("decolourises bromine water for exactly the two unsaturated series", () => {
    const decolourising = KEYS.filter((k) => describeMolecule(k, 4).decolourisesBromine);
    assert.deepEqual(decolourising.sort(), ["alkene", "alkyne"]);
  });

  it("knows an alkene and an alkyne need two carbons", () => {
    assert.equal(isValid("alkene", 1), false);
    assert.equal(isValid("alkyne", 1), false);
    assert.equal(isValid("alkene", 2), true);
    assert.equal(isValid("alkane", 1), true);
    assert.equal(isValid("alkane", MAX_CARBONS + 1), false);
  });
});

describe("formulae", () => {
  it("matches the general formula of each series, for every chain length", () => {
    const expected = {
      alkane: (n) => ({ c: n, h: 2 * n + 2, o: 0 }),
      alkene: (n) => ({ c: n, h: 2 * n, o: 0 }),
      alkyne: (n) => ({ c: n, h: 2 * n - 2, o: 0 }),
      alcohol: (n) => ({ c: n, h: 2 * n + 2, o: 1 }),
      acid: (n) => ({ c: n, h: 2 * n, o: 2 }),
      ester: (n) => ({ c: n + 1, h: 2 * n + 2, o: 2 }),
    };
    every((family, n) => {
      if (!isValid(family, n)) return;
      assert.deepEqual(atomCounts(family, n), expected[family](n), `${family} C${n}`);
    });
  });

  it("obeys the valence of carbon — 4 bonds, no more", () => {
    every((family, n) => {
      if (!isValid(family, n)) return;
      const { c, h, o } = atomCounts(family, n);
      // Degree of unsaturation must be a non-negative whole number.
      const dou = (2 * c + 2 - h) / 2;
      assert.ok(Number.isInteger(dou), `${family} C${n} has a fractional degree of unsaturation`);
      assert.ok(dou >= 0, `${family} C${n} has more hydrogens than carbon can hold`);
      assert.ok(o >= 0);
    });
  });

  // The regression: the panel handled four families and fell through to the
  // ALKANE formula for the rest, so propanoic acid printed "C3H8" — propane.
  it("gives the acid, the ester and the alcohol their own formulae", () => {
    assert.equal(formulaFor("acid", 3), "C₃H₆O₂");
    assert.notEqual(formulaFor("acid", 3), formulaFor("alkane", 3));
    assert.equal(formulaFor("alkane", 3), "C₃H₈");
    assert.equal(formulaFor("ester", 2), "C₃H₆O₂");
    assert.equal(formulaFor("alcohol", 2), "C₂H₅OH");
    assert.equal(formulaFor("alkene", 2), "C₂H₄");
    assert.equal(formulaFor("alkyne", 2), "C₂H₂");
  });

  it("prints a dash for a molecule that cannot exist", () => {
    assert.equal(formulaFor("alkene", 1), "—");
    assert.equal(formulaFor("alkyne", 1), "—");
  });
});

describe("names", () => {
  it("names every reachable combination, and never returns undefined", () => {
    every((family, n) => {
      const name = nameFor(family, n);
      assert.equal(typeof name, "string");
      assert.ok(name.length > 0, `${family} C${n} has no name`);
      assert.ok(!name.includes("undefined"), `${family} C${n} gave ${name}`);
    });
  });

  it("uses the right stem for each chain length", () => {
    CHAIN_NAMES.forEach((stem, i) => {
      assert.equal(nameFor("alkane", i + 1), `${stem}ane`);
    });
  });

  it("names the four simple series conventionally", () => {
    assert.equal(nameFor("alkane", 3), "propane");
    assert.equal(nameFor("alkene", 2), "ethene");
    assert.equal(nameFor("alkyne", 2), "ethyne");
    assert.equal(nameFor("alcohol", 3), "propanol");
    assert.equal(nameFor("acid", 2), "ethanoic acid");
  });

  // The regression: esters were named from a fixed table indexed by n, which
  // labelled the 3-carbon ester (a methyl propanoate) "ethyl methanoate".
  it("names the ester from the molecule actually built — methyl, always", () => {
    assert.equal(nameFor("ester", 3), "methyl propanoate");
    assert.equal(nameFor("ester", 1), "methyl methanoate");
    assert.equal(nameFor("ester", 2), "methyl ethanoate");
    // n carbons in the acyl chain, plus the methyl: n + 1 in total.
    for (let n = 1; n <= MAX_CARBONS; n += 1) {
      assert.equal(atomCounts("ester", n).c, n + 1);
      assert.ok(nameFor("ester", n).startsWith("methyl "), nameFor("ester", n));
    }
  });

  it("explains itself rather than naming an impossible molecule", () => {
    assert.match(nameFor("alkene", 1), /needs 2\+ carbons/);
  });
});

describe("cracking", () => {
  it("only cracks alkanes, and only ones long enough to break in two", () => {
    assert.equal(isCrackable("alkane", 2), false);
    assert.equal(isCrackable("alkane", 3), true);
    assert.equal(isCrackable("alkene", 8), false);
    assert.equal(isCrackable("alcohol", 8), false);
    assert.equal(crackProducts(2), null);
  });

  // The regression: the scene "cracked" by sliding two halves of the SAME
  // molecule apart. No bond became a double bond and no hydrogen moved, so
  // both fragments were radicals — while the readout promised a real alkene.
  it("balances: carbons and hydrogens in equal the ones out, every length", () => {
    for (let n = 3; n <= MAX_CARBONS; n += 1) {
      const p = crackProducts(n);
      assert.ok(p, `C${n} did not crack`);
      const before = atomCounts("alkane", n);
      const a = atomCounts("alkane", p.alkane.carbons);
      const e = atomCounts("alkene", p.alkene.carbons);
      assert.equal(a.c + e.c, before.c, `carbon not conserved cracking C${n}`);
      assert.equal(a.h + e.h, before.h, `hydrogen not conserved cracking C${n}`);
    }
  });

  it("produces a genuine alkene, not a fragment of the parent", () => {
    const p = crackProducts(10);
    assert.equal(p.alkene.family, "alkene");
    assert.equal(p.alkene.carbons, CRACK_ALKENE_CARBONS);
    assert.equal(p.alkene.name, "ethene");
    assert.equal(p.alkene.formula, "C₂H₄");
    assert.equal(describeMolecule("alkene", p.alkene.carbons).decolourisesBromine, true);
  });

  it("gives the syllabus example: decane to octane plus ethene", () => {
    const p = crackProducts(10);
    assert.equal(p.wordEquation, "decane → octane + ethene");
    assert.equal(p.equation, "C₁₀H₂₂ → C₈H₁₈ + C₂H₄");
  });

  it("gives propane to methane plus ethene at the shortest crackable length", () => {
    const p = crackProducts(3);
    assert.equal(p.alkane.name, "methane");
    assert.equal(p.alkane.carbons, 1);
    assert.equal(p.wordEquation, "propane → methane + ethene");
  });

  it("derives both sides of the equation from the formula functions", () => {
    for (let n = 3; n <= MAX_CARBONS; n += 1) {
      const p = crackProducts(n);
      const want = `${formulaFor("alkane", n)} → ${formulaFor("alkane", n - 2)} + ${formulaFor("alkene", 2)}`;
      assert.equal(p.equation, want);
    }
  });
});

describe("describeMolecule — what the readout prints", () => {
  it("returns a complete, self-consistent record for every reachable combination", () => {
    every((family, n) => {
      const d = describeMolecule(family, n);
      assert.equal(d.family, family);
      assert.equal(d.carbons, n);
      assert.equal(d.valid, isValid(family, n));
      assert.equal(d.formula, formulaFor(family, n));
      assert.equal(d.name, nameFor(family, n));
      assert.equal(d.decolourisesBromine, !FAMILIES[family].saturated);
      assert.equal(d.crackable, isCrackable(family, n));
      assert.equal(d.minCarbons, FAMILIES[family].minCarbons);
      assert.ok(d.note.length > 0);
    });
  });

  it("reports the functional group only where there is one", () => {
    assert.equal(describeMolecule("alkane", 4).functionalGroup, null);
    assert.equal(describeMolecule("alcohol", 4).functionalGroup, "–OH (hydroxyl)");
    assert.equal(describeMolecule("acid", 4).functionalGroup, "–COOH (carboxyl)");
  });

  it("reports the unsaturation only for the unsaturated series", () => {
    assert.equal(describeMolecule("alkene", 3).unsaturation, "C=C");
    assert.equal(describeMolecule("alkyne", 3).unsaturation, "C≡C");
    assert.equal(describeMolecule("alcohol", 3).unsaturation, null);
  });

  it("falls back to a real family for an unknown key", () => {
    assert.equal(familyFor("nonsense"), FAMILIES.alkane);
  });
});

describe("the colour key", () => {
  it("gives a distinct colour to each of the three bond orders", () => {
    const bonds = [ORGANIC_COLOURS.single, ORGANIC_COLOURS.double, ORGANIC_COLOURS.triple];
    assert.equal(new Set(bonds).size, 3);
    for (const c of Object.values(ORGANIC_COLOURS)) assert.match(c, /^#[0-9a-f]{6}$/i);
  });
});
