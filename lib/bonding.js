// ─── Ionic and covalent bonding, electron by electron ───────────────
// The bookkeeping behind the two dot-and-cross scenes: which electrons move
// in an ionic compound, and which are shared in a covalent molecule.
//
// Ionic (the lattice topic's "Ion formation"): metal atoms give every outer
// electron to the non-metal atoms beside them until each non-metal has an
// octet. The atoms sit in a row, alternating, so each electron only has to
// cross to a neighbour; `ionicFormation` decides who gives which electron
// to whom and where on the receiving shell it lands — always in the gap
// that faces the atom it came from, which is how the diagrams are drawn.
//
// Covalent (the VSEPR topic's "Dot & cross" view): each bond is one shared
// pair per bond order, one electron from each atom. What is left on the
// central atom pairs up into lone pairs — and that count is checked, in the
// tests, against the lone pairs the VSEPR solver was given for every
// molecule. If the two ever disagree one of them is wrong.
//
// Positions here are in diagram units, in the plane of the page (x right,
// y up). Nothing here imports three.js.
// ─────────────────────────────────────────────────────────────────────

import { ELEMENTS } from "./atomicStructure.js";
import { MOLECULES } from "./vseprMolecules.js";

// ─── Shared drawing scale ───────────────────────────────────────────

/** Radius of shell i in a flat diagram: K, L, M, N. */
export const diagramShellRadius = (i) => 0.62 + i * 0.5;
/** Gap between neighbouring atoms' outer rings before and after the transfer. */
export const ATOM_GAP = 1.5;
export const ION_GAP = 1.35;
/** Half the angle between the two electrons of a pair on a ring, radians. */
export const PAIR_SPREAD = (15 * Math.PI) / 180;

/**
 * The colours both diagrams draw each element in. Metals warm, non-metals
 * cool; the covalent ones match the VSEPR scene's ball-and-stick colours so
 * the two views of one molecule agree.
 */
export const BONDING_COLOURS = {
  H: "#f1f5f9",
  Li: "#fda4af",
  Be: "#bef264",
  B: "#fda4af",
  C: "#94a3b8",
  N: "#60a5fa",
  O: "#f87171",
  F: "#86efac",
  Na: "#fbbf24",
  Mg: "#c4b5fd",
  Al: "#cbd5e1",
  P: "#fb923c",
  S: "#fde047",
  Cl: "#34d399",
  K: "#e879f9",
  Ca: "#fdba74",
  Br: "#d97706",
  Xe: "#22d3ee",
};

/** The covalent view marks electrons by whose they were: the central atom's gold, the outer atoms' sky. */
export const COVALENT_ROLE_COLOURS = { centre: "#fbbf24", outer: "#38bdf8" };

/** Outer-shell electrons for the elements the bonding scenes use (Br and Xe are past calcium). */
export const VALENCE = {
  ...Object.fromEntries(Object.values(ELEMENTS).map((e) => [e.symbol, e.shells[e.shells.length - 1]])),
  Br: 7,
  Xe: 8,
};

const SUPERSCRIPT = { 1: "", 2: "²", 3: "³" };
/** "+", "2+", "−", "3−" — the way an ion's charge is written. */
export const chargeLabel = (q) => (q === 0 ? "" : `${Math.abs(q) === 1 ? "" : Math.abs(q)}${q > 0 ? "+" : "−"}`);
/** "⁺", "²⁺", "⁻", "²⁻" — as a superscript after the symbol. */
export const chargeSuperscript = (q) => (q === 0 ? "" : `${SUPERSCRIPT[Math.abs(q)] ?? ""}${q > 0 ? "⁺" : "⁻"}`);

const ANION_NAMES = { Cl: "chloride", O: "oxide", F: "fluoride", S: "sulfide", N: "nitride" };

// ─── Ionic formation ────────────────────────────────────────────────

/**
 * The compounds the scene offers. `row` is the order the atoms stand in,
 * alternating so every metal has a non-metal beside it. `rockSalt` marks
 * the two that crystallise in the NaCl structure, so the scene can grow the
 * lattice the lattice topic draws out of the ions it has just made.
 */
export const IONIC_COMPOUNDS = {
  NaCl: { key: "NaCl", formula: "NaCl", name: "Sodium chloride", row: ["Na", "Cl"], rockSalt: true },
  MgO: { key: "MgO", formula: "MgO", name: "Magnesium oxide", row: ["Mg", "O"], rockSalt: true },
  MgCl2: { key: "MgCl2", formula: "MgCl₂", name: "Magnesium chloride", row: ["Cl", "Mg", "Cl"], rockSalt: false },
  Na2O: { key: "Na2O", formula: "Na₂O", name: "Sodium oxide", row: ["Na", "O", "Na"], rockSalt: false },
  CaF2: { key: "CaF2", formula: "CaF₂", name: "Calcium fluoride", row: ["F", "Ca", "F"], rockSalt: false },
  Al2O3: { key: "Al2O3", formula: "Al₂O₃", name: "Aluminium oxide", row: ["O", "Al", "O", "Al", "O"], rockSalt: false },
};

export const ionicCompoundFor = (key) => IONIC_COMPOUNDS[key] ?? IONIC_COMPOUNDS.NaCl;

const isMetal = (symbol) => ["1", "2", "3"].includes(ELEMENTS[symbol]?.group) && symbol !== "H" && symbol !== "B";

/** Compass directions on a ring: east, north, west, south. */
const COMPASS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

const polar = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];

/** Angular distance between two directions, 0…π. */
const angleBetween = (a, b) => {
  const d = Math.abs(((a - b) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
};

/** Angles for a full inner shell: a K-shell pair top and bottom, otherwise four compass pairs. */
function innerAngles(count) {
  if (count <= 2) return [Math.PI / 2, (3 * Math.PI) / 2].slice(0, count);
  const out = [];
  for (const c of COMPASS) out.push(c - PAIR_SPREAD, c + PAIR_SPREAD);
  return out.slice(0, count);
}

/** Row positions for atoms of outer radii `radii` with `gap` between rings, centred on 0. */
function rowPositions(radii, gap) {
  const xs = [0];
  for (let i = 1; i < radii.length; i += 1) xs.push(xs[i - 1] + radii[i - 1] + gap + radii[i]);
  const mid = (xs[0] - radii[0] + xs[xs.length - 1] + radii[radii.length - 1]) / 2;
  return xs.map((x) => x - mid);
}

/**
 * Every electron of a compound's atoms, where it starts and where it ends.
 *
 * Returns the atoms (before and after), the transfers in the order they
 * happen, and one record per electron:
 *
 *   owner      the atom it started on, and so how it is drawn (dot or cross)
 *   shell      its shell on the owner
 *   start/end  diagram positions; equal for an electron that stays put, and
 *              for one that stays put the end is on the atom's ION position
 *   to         the atom it moves to, or null
 *   step       the order of the transfer it belongs to, or null
 */
export function ionicFormation(key) {
  const compound = ionicCompoundFor(key);
  const atoms = compound.row.map((symbol, index) => {
    const el = ELEMENTS[symbol];
    const metal = isMetal(symbol);
    const valence = el.shells[el.shells.length - 1];
    return {
      index,
      symbol,
      name: el.name,
      metal,
      shells: el.shells.slice(),
      valence,
      need: metal ? 0 : 8 - valence,
      give: metal ? valence : 0,
    };
  });

  // Who gives which electron to whom: each metal, in turn, hands its outer
  // electrons to the nearest non-metals that still need one.
  const remaining = atoms.map((a) => a.need);
  const transfers = [];
  for (const metal of atoms.filter((a) => a.metal)) {
    let left = metal.give;
    const byDistance = atoms
      .filter((a) => !a.metal)
      .sort((p, q) => Math.abs(p.index - metal.index) - Math.abs(q.index - metal.index) || p.index - q.index);
    for (const target of byDistance) {
      while (left > 0 && remaining[target.index] > 0) {
        transfers.push({ step: transfers.length, from: metal.index, to: target.index });
        remaining[target.index] -= 1;
        left -= 1;
      }
    }
    if (left > 0) throw new Error(`${compound.formula}: ${metal.symbol} has electrons nobody takes`);
  }
  if (remaining.some((r) => r !== 0)) throw new Error(`${compound.formula}: a non-metal is left short`);

  // Charges and the ions' shells.
  for (const a of atoms) {
    const gained = transfers.filter((t) => t.to === a.index).length;
    const lost = transfers.filter((t) => t.from === a.index).length;
    a.charge = lost - gained;
    a.ionShells = a.metal ? a.shells.slice(0, -1) : [...a.shells.slice(0, -1), a.valence + gained];
    a.ionSymbol = `${a.symbol}${chargeSuperscript(a.charge)}`;
    a.ionName = a.metal ? `${a.name.toLowerCase()} ion` : `${ANION_NAMES[a.symbol] ?? a.name.toLowerCase()} ion`;
    a.radius = diagramShellRadius(a.shells.length - 1);
    a.ionRadius = diagramShellRadius(a.ionShells.length - 1);
  }
  const xs = rowPositions(atoms.map((a) => a.radius), ATOM_GAP);
  const ionXs = rowPositions(atoms.map((a) => a.ionRadius), ION_GAP);
  atoms.forEach((a, i) => {
    a.x = xs[i];
    a.ionX = ionXs[i];
  });

  const electrons = [];
  const dirTo = (from, to) => (atoms[to].x > atoms[from].x ? 0 : Math.PI);

  for (const a of atoms) {
    const outer = a.shells.length - 1;
    // Inner shells never change.
    for (let s = 0; s < outer; s += 1) {
      const r = diagramShellRadius(s);
      for (const angle of innerAngles(a.shells[s])) {
        electrons.push({
          owner: a.index,
          shell: s,
          start: polar(a.x, 0, r, angle),
          end: polar(a.ionX, 0, r, angle),
          to: null,
          step: null,
        });
      }
    }

    const r = diagramShellRadius(outer);
    if (a.metal) {
      // Each outgoing electron sits on the side facing where it is going:
      // one alone sits square on, two make a pair there, a third goes on top.
      const outgoing = transfers.filter((tr) => tr.from === a.index);
      const byDir = new Map();
      for (const t of outgoing) {
        const dir = dirTo(a.index, t.to);
        if (!byDir.has(dir)) byDir.set(dir, []);
        byDir.get(dir).push(t);
      }
      for (const [dir, list] of byDir) {
        const angles = list.length === 1 ? [dir] : [dir - PAIR_SPREAD, dir + PAIR_SPREAD, Math.PI / 2];
        list.forEach((t, k) => {
          electrons.push({ owner: a.index, shell: outer, start: polar(a.x, 0, r, angles[k]), end: null, arrival: null, to: t.to, step: t.step });
        });
      }
    } else {
      // The gaps face the donors: one compass point per incoming electron,
      // nearest the atom it comes from, holding one of the atom's own
      // electrons and waiting for the other. Every other point is a pair.
      const incoming = transfers.filter((tr) => tr.to === a.index);
      const free = COMPASS.slice();
      const gaps = incoming.map((t) => {
        const want = dirTo(a.index, t.from);
        free.sort((p, q) => angleBetween(p, want) - angleBetween(q, want));
        return { transfer: t, compass: free.shift() };
      });
      for (const g of gaps) {
        electrons.push({
          owner: a.index,
          shell: outer,
          start: polar(a.x, 0, r, g.compass - PAIR_SPREAD),
          end: polar(a.ionX, 0, r, g.compass - PAIR_SPREAD),
          to: null,
          step: null,
        });
        g.slot = g.compass + PAIR_SPREAD;
      }
      for (const c of free) {
        for (const angle of [c - PAIR_SPREAD, c + PAIR_SPREAD]) {
          electrons.push({ owner: a.index, shell: outer, start: polar(a.x, 0, r, angle), end: polar(a.ionX, 0, r, angle), to: null, step: null });
        }
      }
      a.gaps = gaps.map((g) => ({ step: g.transfer.step, angle: g.slot }));
    }
  }
  // Land every transferred electron in the gap kept for it: first on the
  // atom's ring where it stands (`arrival`), then on the ion's (`end`).
  for (const a of atoms.filter((at) => !at.metal)) {
    for (const g of a.gaps) {
      const e = electrons.find((el) => el.step === g.step);
      e.end = polar(a.ionX, 0, diagramShellRadius(a.shells.length - 1), g.angle);
      e.arrival = polar(a.x, 0, diagramShellRadius(a.shells.length - 1), g.angle);
    }
  }

  const metals = atoms.filter((a) => a.metal);
  const nonMetals = atoms.filter((a) => !a.metal);
  const cation = metals[0];
  const anion = nonMetals[0];
  return {
    compound,
    atoms,
    transfers,
    electrons,
    cation: { symbol: cation.symbol, ion: cation.ionSymbol, name: cation.ionName, charge: cation.charge, count: metals.length, config: cation.ionShells.join(",") },
    anion: { symbol: anion.symbol, ion: anion.ionSymbol, name: anion.ionName, charge: anion.charge, count: nonMetals.length, config: anion.ionShells.join(",") },
    totalCharge: atoms.reduce((s, a) => s + a.charge, 0),
    electronsMoved: transfers.length,
    equation: `${metals.length > 1 ? metals.length : ""}${cation.symbol} + ${nonMetals.length > 1 ? nonMetals.length : ""}${anion.symbol} → ${metals.length > 1 ? metals.length : ""}${cation.ionSymbol} + ${nonMetals.length > 1 ? nonMetals.length : ""}${anion.ionSymbol}`,
    halfEquations: [
      `${cation.symbol} → ${cation.ionSymbol} + ${cation.give > 1 ? cation.give : ""}e⁻`,
      `${anion.symbol} + ${anion.need > 1 ? anion.need : ""}e⁻ → ${anion.ionSymbol}`,
    ],
  };
}

// ─── Covalent dot and cross ─────────────────────────────────────────

/**
 * The electron count for one of the VSEPR scene's molecules.
 *
 * Each bond shares `order` pairs, one electron of each pair from each atom.
 * The central atom's leftover electrons pair up as lone pairs; so do each
 * outer atom's. Ozone is the exception: its two bonds are 1.5 on average and
 * no single dot-and-cross diagram shows that, so it is reported unsupported.
 */
export function covalentDiagram(moleculeId) {
  const m = MOLECULES.find((x) => x.id === moleculeId);
  if (!m) return null;
  const order = m.order ?? 1;
  if (!Number.isInteger(order)) {
    return {
      molecule: m,
      supported: false,
      reason: "Ozone's two O–O bonds are identical, each between a single and a double bond. No one dot-and-cross diagram shows that — it takes two resonance structures, one with a dative bond.",
    };
  }
  const centreValence = VALENCE[m.centre];
  const ligandValence = VALENCE[m.ligand];
  const fromCentre = m.bonding * order;
  const centreLeft = centreValence - fromCentre;
  const ligandLeft = ligandValence - order;
  const sharedPairs = m.bonding * order;
  const aroundCentre = 2 * sharedPairs + centreLeft;
  const ligandTarget = m.ligand === "H" ? 2 : 8;
  const ligandAround = 2 * order + ligandLeft;
  const octet =
    aroundCentre === 8 ? "full" : aroundCentre < 8 ? "incomplete" : "expanded";
  return {
    molecule: m,
    supported: centreLeft >= 0 && centreLeft % 2 === 0 && ligandLeft >= 0 && ligandLeft % 2 === 0,
    order,
    centre: { symbol: m.centre, valence: centreValence, lonePairs: centreLeft / 2, electronsAround: aroundCentre },
    ligand: { symbol: m.ligand, valence: ligandValence, lonePairs: ligandLeft / 2, electronsAround: ligandAround, target: ligandTarget },
    bonds: m.bonding,
    sharedPairs,
    sharedElectrons: 2 * sharedPairs,
    totalValence: centreValence + m.bonding * ligandValence,
    octet,
    octetNote:
      octet === "full"
        ? `${m.centre} has 8 electrons around it — a full outer shell.`
        : octet === "incomplete"
          ? `${m.centre} ends with only ${aroundCentre} electrons around it: an incomplete octet. ${m.centre} has only ${centreValence} outer electrons to share, so there is nothing left to pair.`
          : `${m.centre} ends with ${aroundCentre} electrons around it — an expanded octet. A period-${m.centre === "Xe" ? 5 : m.centre === "Br" ? 4 : 3} atom has empty d orbitals to hold the extra pairs; a period-2 atom never does this.`,
    ligandFull: ligandAround === ligandTarget,
  };
}
