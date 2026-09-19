// ─── Electrolysis of copper(II) sulfate ─────────────────────────────
// Two cells, one electrolyte. Which electrode you use decides what happens
// at the anode, and that single choice is the examinable distinction.
//
// COPPER electrodes: the anode dissolves at exactly the rate the cathode
// plates. Copper is transferred from one electrode to the other and the
// solution is left alone — it never fades, and its concentration never
// changes. This is the industrial purification cell.
//
// GRAPHITE (inert) electrodes: the anode cannot dissolve, so something else
// has to be oxidised. Water is, giving oxygen and H⁺. The copper still
// plates out at the cathode but nothing replaces it, so the Cu²⁺ is used up,
// the blue fades, and the solution turns into sulfuric acid.
//
// The Details panel used to print `Math.round(current * 14)` under the label
// "Cu atoms". It was not atoms, it did not track the simulation, and it did
// not change as the cell ran — at 1.0 A it read "14 Cu atoms" for ever. The
// scene had a real arrival counter of its own the panel could not see,
// because the panel is computed from `params` alone. So the scene pushes its
// run clock into `params` and the numbers below are derived from it, the way
// `reactivity_series` already does with its own.
// ─────────────────────────────────────────────────────────────────────

/** Faraday constant, C/mol. */
export const FARADAY = 96485;

/** Copper: molar mass g/mol, and electrons per ion discharged. */
export const COPPER = { molarMass: 63.5, charge: 2, symbol: "Cu" };

/** Molar volume of a gas at room temperature and pressure, dm³/mol. */
export const MOLAR_GAS_VOLUME_DM3 = 24;

/** Oxygen: molar mass g/mol, and electrons per O₂ released from water. */
export const OXYGEN = { molarMass: 32, electronsPerMolecule: 4, symbol: "O₂" };

/**
 * The cell: 25 cm³ of 0.10 mol/dm³ copper(II) sulfate — a microscale one.
 *
 * Sized so the thing it exists to show is actually reachable. A 250 cm³
 * beaker of 1.0 mol/dm³ holds 0.25 mol of Cu²⁺, which at 1 A takes over
 * thirteen hours to plate out: the fade would be real in the model and
 * invisible in the room, which is the same defect as an anode that can never
 * be consumed. 0.0025 mol needs 482 C — about eight minutes at 1 A, four at
 * full current.
 */
export const ELECTROLYTE = {
  volumeCm3: 25,
  volumeDm3: 0.025,
  molarity: 0.1,
  formula: "CuSO₄(aq)",
  get copperMol() {
    return this.volumeDm3 * this.molarity;
  },
  /** Charge needed to strip every Cu²⁺ out of it, coulombs. */
  get exhaustionC() {
    return this.copperMol * COPPER.charge * FARADAY;
  },
};

/**
 * The two electrode materials, and what each does to the anode reaction.
 *
 * `anodeDissolves` is the whole difference. Everything else below — whether
 * the solution fades, whether gas comes off, whether the concentration holds
 * — follows from it.
 */
export const ELECTRODES = {
  copper: {
    key: "copper",
    label: "Copper",
    short: "Cu",
    anodeDissolves: true,
    cathode: "Cu²⁺ + 2e⁻ → Cu",
    anode: "Cu → Cu²⁺ + 2e⁻",
    overall: "Cu(anode) → Cu(cathode)",
    anodeProduct: "copper ions into solution",
    cathodeProduct: "copper metal",
    note: "The anode dissolves at exactly the rate the cathode plates, so the copper is only moved from one electrode to the other. The solution is not consumed and never fades — this is how copper is purified industrially.",
  },
  graphite: {
    key: "graphite",
    label: "Graphite (inert)",
    short: "C",
    anodeDissolves: false,
    cathode: "Cu²⁺ + 2e⁻ → Cu",
    anode: "2H₂O → O₂ + 4H⁺ + 4e⁻",
    overall: "2Cu²⁺ + 2H₂O → 2Cu + O₂ + 4H⁺",
    anodeProduct: "oxygen gas",
    cathodeProduct: "copper metal",
    note: "Graphite cannot dissolve, so water is oxidised instead: oxygen bubbles off the anode and H⁺ is left behind. Nothing replaces the copper leaving the solution, so the blue fades and what is left is sulfuric acid.",
  },
};

export const electrodeFor = (key) => ELECTRODES[key] ?? ELECTRODES.copper;

/** Kept for callers that only ever wanted the copper cell's equations. */
export const HALF_EQUATIONS = {
  cathode: ELECTRODES.copper.cathode,
  anode: ELECTRODES.copper.anode,
};

/**
 * Colours the scene draws the cell with, so the key names the right things.
 *
 * `anode` is the copper anode; an inert one is graphite grey, and the oxygen
 * bubbling off it gets its own colour so the key can distinguish the gas from
 * the sulfate's oxygens.
 */
export const CELL_COLOURS = {
  cathode: "#b45309",
  anode: "#7c3f12",
  graphite: "#3f4854",
  cation: "#38bdf8",
  sulfur: "#eab308",
  oxygen: "#ef4444",
  bubble: "#e0f2fe",
  electron: "#e8ebf0",
};

/**
 * What the cell has done after `seconds` at `current` amps.
 *
 * The cathode half is the same either way — Faraday's laws do not care what
 * the anode is made of, and the same charge always deposits the same copper.
 * What changes is where that copper comes from.
 */
export function solveElectrolysis({
  current = 1.0,
  seconds = 0,
  running = true,
  electrode = "copper",
} = {}) {
  const i = Math.max(0, Number(current) || 0);
  const t = Math.max(0, Number(seconds) || 0);
  const material = electrodeFor(electrode);

  const charge = i * t;
  const electronsMol = charge / FARADAY;
  const copperMol = electronsMol / COPPER.charge;
  const copperG = copperMol * COPPER.molarMass;

  // Only an inert anode evolves gas; a copper one dissolves instead.
  const oxygenMol = material.anodeDissolves ? 0 : electronsMol / OXYGEN.electronsPerMolecule;
  const oxygenCm3 = oxygenMol * MOLAR_GAS_VOLUME_DM3 * 1000;

  // With a copper anode the solution is untouched. With an inert one the
  // Cu²⁺ is used up and nothing puts it back.
  const startMol = ELECTROLYTE.copperMol;
  const consumedMol = material.anodeDissolves ? 0 : Math.min(copperMol, startMol);
  const remainingMol = startMol - consumedMol;
  const remainingMolarity = remainingMol / ELECTROLYTE.volumeDm3;
  const depleted = remainingMol <= 0;

  return {
    current: i,
    seconds: t,
    running: Boolean(running),
    electrode: material.key,
    material,
    inert: !material.anodeDissolves,

    chargeC: charge,
    electronsMol,
    copperMol,
    /** Grams gained at the cathode. With copper electrodes, also grams lost at the anode. */
    depositG: copperG,
    depositMg: copperG * 1000,
    /** Grams the anode loses — zero for an inert one, which is the point. */
    anodeLostG: material.anodeDissolves ? copperG : 0,
    /** Ions discharged, for the scale of the thing. */
    ions: copperMol * 6.022e23,

    oxygenMol,
    oxygenCm3,
    oxygenG: oxygenMol * OXYGEN.molarMass,

    startMol,
    remainingMol,
    remainingMolarity,
    /** 1 at full blue, 0 once every Cu²⁺ has plated out. */
    blueFraction: startMol > 0 ? Math.max(0, Math.min(1, remainingMol / startMol)) : 0,
    /** Concentration only holds when the anode replaces what the cathode takes. */
    concentrationHolds: material.anodeDissolves,
    depleted,

    cathode: material.cathode,
    anode: material.anode,
    overall: material.overall,
  };
}

/** "2 min 05 s", "8.4 s" — the run clock, in the units a lab would use. */
export function formatRunTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.floor(s - m * 60).toString().padStart(2, "0")} s`;
}

/** "18 cm³", "1.4 dm³" — gas volumes in the unit a lab would read off. */
export function formatGasVolume(cm3) {
  const v = Math.max(0, Number(cm3) || 0);
  if (v < 1000) return `${v.toFixed(v < 10 ? 2 : 0)} cm³`;
  return `${(v / 1000).toFixed(2)} dm³`;
}
