// ─── Topic option data ──────────────────────────────────────────────
// The choice lists the HUD renders, plus the small amount of metadata the
// scenes print back in their readouts.
//
// This module exists to stay free of three.js. `ThreeDView` builds its topic
// registry at module scope, so anything it imports lands in the main bundle —
// pulling these out of the canvas files is what keeps the canvases themselves
// behind their dynamic imports.
// ─────────────────────────────────────────────────────────────────────

import { FLUIDS, SHAPES, SOLIDS } from "@/lib/buoyancy";
import { TOPOLOGIES } from "@/lib/circuits";
import { TARGETS } from "@/lib/electrostatics";
import { ROD_MATERIALS } from "@/lib/heatTransfer";
import { FRICTION_SURFACES } from "@/lib/inclineForces";
import { PATHWAYS, STIMULI } from "@/lib/reflexArc";
import { SOILS } from "@/lib/transpiration";
import { VECTORS } from "@/lib/pollination";
import { CONSISTENCIES, ORIENTATIONS } from "@/lib/peristalsis";
import { MODES as DIVISION_MODES } from "@/lib/cellDivision";
import { PATHOLOGIES as CARDIAC_PATHOLOGIES } from "@/lib/cardiacCycle";
import { ELECTROLYTES, METALS, PARTNERS, SERIES, SOLUTIONS, SOLUTION_ORDER } from "@/lib/redox";
import { MIXTURES, MIXTURE_ORDER, SOLVENTS, SOLVENT_ORDER, STATIONS, STATION_ORDER } from "@/lib/separation";
import { SUBSTANCES, SUBSTANCE_ORDER } from "@/lib/particleModel";
import { BARRIERS, BARRIER_ORDER, MODES, MODE_ORDER } from "@/lib/radioactiveDecay";

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

/**
 * The surface pairings on the friction ramp.
 *
 * Derived from the coefficient table rather than retyped beside it: a label
 * here that disagreed with the μ the solver uses would be a scene quietly
 * teaching the wrong number.
 */
export const FRICTION_SURFACE_OPTIONS = Object.entries(FRICTION_SURFACES).map(([value, s]) => ({
  value,
  label: s.short,
  title: `${s.label} — μs = ${s.muS}, μk = ${s.muK}`,
}));

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

/**
 * The strips on the dipping arm, in series order so the button row IS the
 * reactivity series — most reactive on the left, gold on the right.
 */
export const METAL_STRIP_OPTIONS = SERIES.map((value) => ({
  value,
  label: METALS[value].label,
  title: METALS[value].title,
}));

/** The four beakers, in rack order. Picking one puts it in focus. */
export const AQUEOUS_SOLUTION_OPTIONS = SOLUTION_ORDER.map((value) => ({
  value,
  label: SOLUTIONS[value].short,
  title: SOLUTIONS[value].title,
}));

export const ELECTROLYTE_OPTIONS = Object.entries(ELECTROLYTES).map(([value, e]) => ({
  value,
  label: e.label,
  title: e.title,
}));

/** What the fourth nail is wrapped in. Copper is here on purpose — it is the counter-example. */
/** The separation bench: three samples, two solvents, three stations. */
export const SAMPLE_MIXTURE_OPTIONS = MIXTURE_ORDER.map((value) => ({
  value,
  label: MIXTURES[value].label,
  title: MIXTURES[value].title,
}));

export const SOLVENT_TYPE_OPTIONS = SOLVENT_ORDER.map((value) => ({
  value,
  label: `${SOLVENTS[value].label} · ${SOLVENTS[value].formula}`,
  title: SOLVENTS[value].title,
}));

export const SEPARATION_STATION_OPTIONS = STATION_ORDER.map((value) => ({
  value,
  label: STATIONS[value].label,
  title: STATIONS[value].title,
}));

export const SACRIFICIAL_METAL_OPTIONS = Object.entries(PARTNERS).map(([value, p]) => ({
  value,
  label: `${p.label}${p.protects ? "" : " (accelerates)"}`,
  title: p.title,
}));

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

// ─── Electrical ─────────────────────────────────────────────────────

/** The three wiring patterns the breadboard can be snapped into. */
export const CIRCUIT_TOPOLOGY_OPTIONS = Object.entries(TOPOLOGIES).map(([value, t]) => ({
  value,
  label: t.label,
  title: t.summary,
}));

/** What the charged balloon is being held near. */
export const STATIC_TARGET_OPTIONS = Object.entries(TARGETS).map(([value, t]) => ({
  value,
  label: t.label,
  title: t.title,
}));

// ─── Fluids and thermal ─────────────────────────────────────────────

/** What the overflow can is filled with. Air is on the list on purpose. */
export const FLUID_OPTIONS = Object.entries(FLUIDS).map(([value, f]) => ({
  value,
  label: f.label,
  title: f.title,
}));

/**
 * The density presets, named rather than numeric.
 *
 * Paired with the density slider through a `patch` the same way the optical
 * media are: picking Steel writes 7.85 into the slider, and dragging the
 * slider away from 7.85 clears the button. Neither can be left asserting
 * something the other disagrees with.
 */
export const SOLID_PRESET_OPTIONS = Object.entries(SOLIDS).map(([value, s]) => ({
  value,
  label: s.label,
  title: s.title,
}));

/** Which solid is on the hook — including the hull that makes ships float. */
export const SPECIMEN_SHAPE_OPTIONS = Object.entries(SHAPES).map(([value, s]) => ({
  value,
  label: s.label,
  title: s.title,
}));

/** The four rods leaning out of the beaker. */
export const ROD_MATERIAL_OPTIONS = Object.entries(ROD_MATERIALS).map(([value, m]) => ({
  value,
  label: m.label,
  title: m.title,
}));

/**
 * How the heat is drawn — never WHICH heat is drawn.
 *
 * Both modes show all three transfer mechanisms; the toggle only changes
 * whether temperature is rendered as false colour or as the amplitude of the
 * lattice's own vibration.
 */
export const HEAT_VIEW_OPTIONS = [
  {
    value: "flir",
    label: "Thermal (FLIR)",
    title: "False colour on the ironbow ramp a thermal imager uses",
  },
  {
    value: "atomic",
    label: "Atomic vibration",
    title: "The lattice itself, shaking harder wherever it is hotter",
  },
];

// ─── Nerve & muscle ─────────────────────────────────────────────────

export const STIMULUS_OPTIONS = Object.entries(STIMULI).map(([value, s]) => ({
  value,
  label: s.label,
  title: `${s.skinC} °C at the skin — ${s.nociceptive ? "above" : "below"} the pain threshold`,
}));

export const NERVE_PATHWAY_OPTIONS = Object.entries(PATHWAYS).map(([value, p]) => ({
  value,
  label: p.label,
}));

// ─── Tube transport ─────────────────────────────────────────────────

export const SOIL_MOISTURE_OPTIONS = Object.entries(SOILS).map(([value, s]) => ({
  value,
  label: s.label,
  title: `${s.note} · Ψ ${s.psiMPa} MPa`,
}));

export const BOLUS_CONSISTENCY_OPTIONS = Object.entries(CONSISTENCIES).map(([value, c]) => ({
  value,
  label: c.label,
  title: c.note,
}));

export const GRAVITY_ORIENTATION_OPTIONS = Object.entries(ORIENTATIONS).map(([value, o]) => ({
  value,
  label: o.label,
  title: o.gravitySign > 0 ? "Gravity helps the bolus along" : "Gravity opposes it — the wave has to do all the work",
}));

// ─── Pollination ────────────────────────────────────────────────────

export const POLLINATION_VECTOR_OPTIONS = Object.entries(VECTORS).map(([value, v]) => ({
  value,
  label: v.label,
  title: `${v.pollen.surface} pollen · stigma ${v.stigma.split(",")[0]} · e.g. ${v.examples}`,
}));

/** Which division the cell-division scene runs: one equational division, or the two of meiosis. */
export const DIVISION_MODE_OPTIONS = Object.entries(DIVISION_MODES).map(([value, m]) => ({
  value,
  label: m.label,
  title: `${m.product} — ${m.purpose}`,
}));

/** The rhythm the heart is in. */
export const CARDIAC_PATHOLOGY_OPTIONS = Object.entries(CARDIAC_PATHOLOGIES).map(([value, p]) => ({
  value,
  label: p.label,
  title: p.summary,
}));

// ─── Particle populations ───────────────────────────────────────────

export const SUBSTANCE_OPTIONS = SUBSTANCE_ORDER.map((value) => ({
  value,
  label: `${SUBSTANCES[value].label} (${SUBSTANCES[value].formula})`,
  title: SUBSTANCES[value].bondingNote,
}));

export const DECAY_MODE_OPTIONS = MODE_ORDER.map((value) => ({
  value,
  label: MODES[value].label,
  title: `${MODES[value].parent.name} → ${MODES[value].daughter.name}`,
}));

export const BARRIER_OPTIONS = BARRIER_ORDER.map((value) => ({
  value,
  label: `${BARRIERS[value].label} · ${BARRIERS[value].thickness}`,
  title: `Stops: ${BARRIERS[value].stops.map((k) => ({ alpha: "α", beta_minus: "β⁻", beta_plus: "β⁺", gamma: "γ" })[k]).join(", ")}`,
}));
