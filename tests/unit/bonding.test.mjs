import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  IONIC_COMPOUNDS,
  PAIR_SPREAD,
  VALENCE,
  chargeLabel,
  chargeSuperscript,
  covalentDiagram,
  diagramShellRadius,
  ionicFormation,
} from "../../lib/bonding.js";
import { MOLECULES } from "../../lib/vseprMolecules.js";

const KEYS = Object.keys(IONIC_COMPOUNDS);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("charges as written", () => {
  it("drops the 1 and uses a real minus sign", () => {
    assert.equal(chargeLabel(1), "+");
    assert.equal(chargeLabel(2), "2+");
    assert.equal(chargeLabel(-1), "−");
    assert.equal(chargeLabel(-2), "2−");
    assert.equal(chargeSuperscript(3), "³⁺");
    assert.equal(chargeSuperscript(-2), "²⁻");
  });
});

describe("ionic formation — electron transfer", () => {
  for (const key of KEYS) {
    const f = ionicFormation(key);

    it(`${key}: the charges add to zero`, () => {
      assert.equal(f.totalCharge, 0);
    });

    it(`${key}: every ion ends with a full outer shell`, () => {
      for (const a of f.atoms) {
        const outer = a.ionShells[a.ionShells.length - 1];
        assert.equal(outer, a.ionShells.length === 1 ? 2 : 8, `${a.ionSymbol} ends ${a.ionShells.join(",")}`);
      }
    });

    it(`${key}: metals lose all their outer electrons, non-metals gain what they lack`, () => {
      for (const a of f.atoms) {
        if (a.metal) assert.equal(a.charge, a.valence);
        else assert.equal(a.charge, -(8 - a.valence));
      }
      assert.equal(f.electronsMoved, f.atoms.filter((a) => a.metal).reduce((s, a) => s + a.valence, 0));
    });

    it(`${key}: no electron is lost or duplicated`, () => {
      const before = f.atoms.reduce((s, a) => s + a.shells.reduce((x, y) => x + y, 0), 0);
      const after = f.atoms.reduce((s, a) => s + a.ionShells.reduce((x, y) => x + y, 0), 0);
      assert.equal(f.electrons.length, before);
      assert.equal(after, before);
    });

    it(`${key}: electrons only cross to a neighbouring atom`, () => {
      for (const t of f.transfers) assert.equal(Math.abs(t.from - t.to), 1, `step ${t.step}`);
    });

    it(`${key}: each moved electron lands on the receiving atom's outer ring, facing the donor`, () => {
      for (const e of f.electrons.filter((x) => x.step !== null)) {
        const to = f.atoms[e.to];
        const from = f.atoms[e.owner];
        const r = diagramShellRadius(to.shells.length - 1);
        assert.ok(Math.abs(dist(e.arrival, [to.x, 0]) - r) < 1e-9);
        assert.ok(Math.abs(dist(e.end, [to.ionX, 0]) - r) < 1e-9);
        // On the donor's side of the receiving atom, or at worst square above or below it.
        assert.ok(Math.sign(e.arrival[0] - to.x) === Math.sign(from.x - to.x) || Math.abs(e.arrival[0] - to.x) < r * Math.sin(PAIR_SPREAD) + 1e-9);
      }
    });

    it(`${key}: no two electrons share a place on any ion`, () => {
      const ends = f.electrons.map((e) => e.end);
      for (let i = 0; i < ends.length; i += 1) {
        for (let j = i + 1; j < ends.length; j += 1) assert.ok(dist(ends[i], ends[j]) > 0.05, `${i} and ${j} coincide`);
      }
    });

    it(`${key}: the ions stand closer than the atoms did, and never overlap`, () => {
      for (let i = 1; i < f.atoms.length; i += 1) {
        const a = f.atoms[i - 1];
        const b = f.atoms[i];
        assert.ok(b.ionX - a.ionX < b.x - a.x);
        assert.ok(b.ionX - a.ionX > a.ionRadius + b.ionRadius);
      }
    });
  }

  it("writes the half equations the syllabus uses", () => {
    assert.deepEqual(ionicFormation("MgO").halfEquations, ["Mg → Mg²⁺ + 2e⁻", "O + 2e⁻ → O²⁻"]);
    assert.equal(ionicFormation("Al2O3").equation, "2Al + 3O → 2Al³⁺ + 3O²⁻");
    assert.equal(ionicFormation("NaCl").cation.config, "2,8");
    assert.equal(ionicFormation("NaCl").anion.config, "2,8,8");
  });

  it("marks only the rock-salt compounds for the lattice finale", () => {
    assert.deepEqual(KEYS.filter((k) => IONIC_COMPOUNDS[k].rockSalt), ["NaCl", "MgO"]);
  });
});

describe("covalent dot and cross — agrees with VSEPR", () => {
  for (const m of MOLECULES) {
    it(`${m.id}: the leftover electrons on ${m.centre} are exactly VSEPR's ${m.lone} lone pair${m.lone === 1 ? "" : "s"}`, () => {
      const d = covalentDiagram(m.id);
      if (m.id === "O3") {
        assert.equal(d.supported, false);
        assert.match(d.reason, /resonance/);
        return;
      }
      assert.equal(d.supported, true);
      assert.equal(d.centre.lonePairs, m.lone);
    });
  }

  it("fills every outer atom: a duet for H, an octet for the rest", () => {
    for (const m of MOLECULES.filter((x) => x.id !== "O3")) {
      const d = covalentDiagram(m.id);
      assert.equal(d.ligandFull, true, m.id);
      assert.equal(d.ligand.electronsAround, m.ligand === "H" ? 2 : 8, m.id);
    }
  });

  it("names incomplete and expanded octets", () => {
    assert.equal(covalentDiagram("BF3").octet, "incomplete");
    assert.equal(covalentDiagram("BF3").centre.electronsAround, 6);
    assert.equal(covalentDiagram("SF6").octet, "expanded");
    assert.equal(covalentDiagram("SF6").centre.electronsAround, 12);
    assert.equal(covalentDiagram("CH4").octet, "full");
    assert.equal(covalentDiagram("CO2").sharedPairs, 4);
  });

  it("conserves electrons: shared plus lone equals what the atoms brought", () => {
    for (const m of MOLECULES.filter((x) => x.id !== "O3")) {
      const d = covalentDiagram(m.id);
      const lone = 2 * d.centre.lonePairs + m.bonding * 2 * d.ligand.lonePairs;
      assert.equal(d.sharedElectrons + lone, VALENCE[m.centre] + m.bonding * VALENCE[m.ligand], m.id);
    }
  });
});
