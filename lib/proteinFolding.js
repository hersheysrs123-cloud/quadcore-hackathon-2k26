// ─── Protein folding ────────────────────────────────────────────────
// How folded the chain is, given the fold slider and the temperature, and
// whether what is left counts as denatured.
//
// The scene applies heat as a WINDOW — 320 K to 358 K — multiplying the
// fold slider, so at 330 K a fully-folded helix is still 74 % folded with
// its i→i+4 bonds intact. The Details panel used `temperature > 320 ||
// fold < 0.35`, so it called that same helix a random coil, and printed
// the raw slider as "Folded Progress: 100 %" over a chain the scene had
// half unravelled. Between them the whole partial-unfolding behaviour the
// scene exists to show was reported as fully denatured.
//
// The scene also blamed heat for a cold unfolding: dragging fold to 0.2 at
// 300 K produced the note "Above about 47 °C the hydrogen bonds break".
// `cause` below exists so a readout can say which control did it.
// ─────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Denaturation window in kelvin — folded below, random coil above. */
export const DENATURE_START = 320;
export const DENATURE_END = 358;

/** Below this fraction folded, there is no secondary structure left to speak of. */
export const DENATURED_BELOW = 0.35;

/** Hydrogen bonds only appear once the partners are in reach. */
export const BONDS_FORM_ABOVE = 0.55;

export const STRUCTURE_COLOURS = {
  helix: "#fbbf24",
  sheet: "#38bdf8",
  coil: "#64748b",
  hydrophobic: "#fbbf24",
  hydrophilic: "#38bdf8",
  denatured: "#fb7185",
  bond: "#34d399",
  backbone: "#64748b",
};

/** How much of the fold survives at this temperature, 1 → 0 across the window. */
export const heatFactor = (temperatureK) =>
  1 - clamp(((Number(temperatureK) || 0) - DENATURE_START) / (DENATURE_END - DENATURE_START), 0, 1);

/**
 * How folded the chain actually is: the slider, scaled by what the heat has
 * left of it. This is the number the scene draws, so it is the number the
 * readout has to print.
 */
export function foldedFraction(fold, temperatureK) {
  return clamp(Number(fold) || 0, 0, 1) * heatFactor(temperatureK);
}

/** Everything a readout wants from the four controls. */
export function solveFolding({ structure = "helix", residues = 30, fold = 1, temperature = 300 } = {}) {
  const heat = heatFactor(temperature);
  const asked = clamp(Number(fold) || 0, 0, 1);
  const folded = asked * heat;
  const denatured = folded < DENATURED_BELOW;
  const count = clamp(Math.round(Number(residues) || 0), 8, 64);

  // Which control is responsible, so the note does not blame heat for an
  // unfolding the fold slider caused at room temperature.
  const cause = !denatured
    ? null
    : heat < 0.999 && asked >= DENATURED_BELOW
      ? "heat"
      : heat >= 0.999
        ? "slider"
        : "both";

  return {
    structure,
    residues: count,
    temperatureK: temperature,
    temperatureC: temperature - 273,
    /** What the fold slider asks for, before heat. */
    asked,
    heatFactor: heat,
    /** What the chain is actually at — the number the scene draws. */
    folded,
    foldedPercent: Math.round(folded * 100),
    denatured,
    cause,
    heating: temperature > DENATURE_START,
    fullyDenaturedByHeat: heat <= 0,
    bondsFormed: folded >= BONDS_FORM_ABOVE && structure !== "coil",
    isCoil: structure === "coil",
  };
}
