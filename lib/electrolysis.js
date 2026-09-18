// ─── Electrolysis of copper(II) sulfate ─────────────────────────────
// Copper electrodes in CuSO₄: the anode dissolves, the cathode plates, and
// Faraday's laws say exactly how much of each per second.
//
// The Details panel used to print `Math.round(current * 14)` under the
// label "Cu atoms". It was not atoms, it did not track the simulation, and
// it did not change as the cell ran — at 1.0 A it read "14 Cu atoms" for
// ever. The scene had a real arrival counter of its own the panel could
// not see, because the panel is computed from `params` alone.
//
// So the scene pushes its run clock into `params` and the numbers below are
// derived from it, the way `reactivity_series` already does with its own.
// ─────────────────────────────────────────────────────────────────────

/** Faraday constant, C/mol. */
export const FARADAY = 96485;

/** Copper: molar mass g/mol, and electrons per ion discharged. */
export const COPPER = { molarMass: 63.5, charge: 2, symbol: "Cu" };

export const HALF_EQUATIONS = {
  cathode: "Cu²⁺ + 2e⁻ → Cu",
  anode: "Cu → Cu²⁺ + 2e⁻",
};

/** Colours the scene draws the cell with, so the key names the right things. */
export const CELL_COLOURS = {
  cathode: "#b45309",
  anode: "#7c3f12",
  cation: "#38bdf8",
  sulfur: "#eab308",
  oxygen: "#ef4444",
  electron: "#e8ebf0",
};

/**
 * What the cell has done after `seconds` at `current` amps.
 *
 * Both electrodes change by the same amount and in opposite directions —
 * the copper that leaves the anode is the copper that arrives at the
 * cathode — which is the whole point of the purification cell, and is why
 * the electrolyte's concentration never changes.
 */
export function solveElectrolysis({ current = 1.0, seconds = 0, running = true } = {}) {
  const i = Math.max(0, Number(current) || 0);
  const t = Math.max(0, Number(seconds) || 0);
  const charge = i * t;
  const electronsMol = charge / FARADAY;
  const copperMol = electronsMol / COPPER.charge;
  const copperG = copperMol * COPPER.molarMass;

  return {
    current: i,
    seconds: t,
    running: Boolean(running),
    chargeC: charge,
    electronsMol,
    copperMol,
    /** Grams gained at the cathode — and lost at the anode. */
    depositG: copperG,
    depositMg: copperG * 1000,
    /** Ions discharged, for the scale of the thing. */
    ions: copperMol * 6.022e23,
    ...HALF_EQUATIONS,
  };
}

/** "2 min 05 s", "8.4 s" — the run clock, in the units a lab would use. */
export function formatRunTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.floor(s - m * 60).toString().padStart(2, "0")} s`;
}
