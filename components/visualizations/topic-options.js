// ─── Topic option data ──────────────────────────────────────────────
// The choice lists the HUD renders, plus the small amount of metadata the
// scenes print back in their readouts.
//
// This module exists to stay free of three.js. `ThreeDView` builds its topic
// registry at module scope, so anything it imports lands in the main bundle —
// pulling these out of the canvas files is what keeps the canvases themselves
// behind their dynamic imports.
// ─────────────────────────────────────────────────────────────────────

// ─── Mathematics ────────────────────────────────────────────────────

export const SURFACE_OPTIONS = [
  { value: "bowl", label: "Bowl", title: "Convex — one global minimum" },
  { value: "saddle", label: "Saddle", title: "A stationary point that is not a minimum" },
  { value: "valley", label: "Valley", title: "A curved ravine — slow to traverse" },
  { value: "wells", label: "4 wells", title: "Four local minima" },
];

export const CURVE_OPTIONS = [
  { value: "line", label: "Line", title: "Revolves into a cone" },
  { value: "parabola", label: "Parabola", title: "Revolves into a paraboloid" },
  { value: "root", label: "√y", title: "Flares early" },
  { value: "sine", label: "Sine", title: "Revolves into a vase" },
  { value: "bell", label: "Bell", title: "Revolves into a barrel" },
];

// ─── Computer science ───────────────────────────────────────────────

/**
 * `complexity` is the typical case; `extreme` names whichever of best/worst
 * is worth knowing. The field used to be called `best` and was rendered under
 * a "Best case" heading, which made quicksort's entry read as though O(n²)
 * were its best case rather than its worst.
 */
export const ALGORITHM_META = {
  bubble: { label: "Bubble", complexity: "O(n²)", extreme: "O(n) best", stable: true },
  insertion: { label: "Insertion", complexity: "O(n²)", extreme: "O(n) best", stable: true },
  selection: { label: "Selection", complexity: "O(n²)", extreme: "O(n²) always", stable: false },
  quick: { label: "Quicksort", complexity: "O(n log n)", extreme: "O(n²) worst", stable: false },
  merge: { label: "Merge", complexity: "O(n log n)", extreme: "O(n log n) always", stable: true },
};

export const ALGORITHM_OPTIONS = Object.entries(ALGORITHM_META).map(([value, a]) => ({
  value,
  label: a.label,
  title: `${a.label} sort — ${a.complexity}`,
}));

// ─── Physics ────────────────────────────────────────────────────────

export const GRAVITY_OPTIONS = [
  { value: 1.62, label: "Moon", title: "1.62 m/s²" },
  { value: 3.72, label: "Mars", title: "3.72 m/s²" },
  { value: 9.81, label: "Earth", title: "9.81 m/s²" },
  { value: 24.8, label: "Jupiter", title: "24.79 m/s²" },
];

// ─── Chemistry ──────────────────────────────────────────────────────

/** Each preset writes both pair counts at once, via the control's `patch`. */
export const VSEPR_PRESETS = [
  { value: "CH4", label: "CH₄", bonding: 4, lone: 0, title: "Methane — tetrahedral" },
  { value: "NH3", label: "NH₃", bonding: 3, lone: 1, title: "Ammonia — trigonal pyramidal" },
  { value: "H2O", label: "H₂O", bonding: 2, lone: 2, title: "Water — bent" },
  { value: "BF3", label: "BF₃", bonding: 3, lone: 0, title: "Boron trifluoride — trigonal planar" },
  { value: "PCl5", label: "PCl₅", bonding: 5, lone: 0, title: "Phosphorus pentachloride" },
  { value: "SF6", label: "SF₆", bonding: 6, lone: 0, title: "Sulfur hexafluoride — octahedral" },
];

/** Which preset, if any, the current pair counts correspond to. */
export const vseprPresetFor = (bonding, lone) =>
  VSEPR_PRESETS.find((p) => p.bonding === bonding && p.lone === lone)?.value ?? "";

// ─── Biology ────────────────────────────────────────────────────────

export const STRUCTURE_META = {
  helix: { label: "α-helix" },
  sheet: { label: "β-sheet" },
  coil: { label: "Random coil" },
};

export const STRUCTURE_OPTIONS = Object.entries(STRUCTURE_META).map(([value, s]) => ({
  value,
  label: s.label,
}));
