// ─── Cells and osmosis ──────────────────────────────────────────────
// The organelles the explorer draws, which cell type each belongs to, and
// what a tonicity does to a plant cell and to an animal one.
//
// The `plant` / `animal` flag existed on every organelle already and was
// never read, so the Details panel's key listed chloroplasts, a vacuole
// and a cellulose wall for ANIMAL cells, and the scene's own key listed
// lysosomes for plant cells. Half the clickable organelles — smooth ER,
// ribosomes, lysosomes, centrioles, cytoskeleton — had no key entry at all,
// and the rough ER shared a colour with the cell membrane.
//
// The two sides also disagreed about the cell's state across most of the
// slider: the panel switched at ±0.05 and the scene at +0.45 / −0.3, so at
// tonicity 0.1 the panel said "Plasmolysed" over a scene that had barely
// moved — and "Flaccid", one of the three states the topic teaches, never
// appeared in the panel at all.
// ─────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Every organelle the scene draws, in the order the key should list them.
 *
 * `in` is which cell types have it. `colour` is what the scene actually
 * draws it with — the key reads this rather than its own literal.
 */
export const ORGANELLES = [
  { key: "nucleus", label: "Nucleus", colour: "#a78bfa", in: ["plant", "animal"], note: "chromatin and nucleolus, inside a pored double membrane" },
  { key: "mitochondrion", label: "Mitochondria", colour: "#fb7185", in: ["plant", "animal"], note: "cristae — folded inner membrane for aerobic respiration" },
  { key: "er", label: "Rough ER", colour: "#38bdf8", in: ["plant", "animal"], note: "ribosome-studded sheets; proteins fold here" },
  { key: "smoothEr", label: "Smooth ER", colour: "#22d3ee", in: ["plant", "animal"], note: "tubules with no ribosomes — lipids and steroids" },
  { key: "golgi", label: "Golgi apparatus", colour: "#fbbf24", in: ["plant", "animal"], note: "stacked cisternae; packages proteins into vesicles" },
  { key: "ribosome", label: "Free ribosomes", colour: "#e8ebf0", in: ["plant", "animal"], note: "where proteins are made, loose in the cytoplasm" },
  { key: "membrane", label: "Cell membrane", colour: "#7dd3fc", in: ["plant", "animal"], note: "a partially permeable phospholipid bilayer" },
  { key: "cytoskeleton", label: "Cytoskeleton", colour: "#64748b", in: ["plant", "animal"], note: "protein filaments holding the cell's shape" },
  { key: "lysosome", label: "Lysosomes", colour: "#f472b6", in: ["animal"], note: "sacs of digestive enzymes — animal cells only" },
  { key: "centriole", label: "Centrioles", colour: "#a5b4fc", in: ["animal"], note: "nine microtubule triplets; organise the spindle — animal cells only" },
  { key: "chloroplast", label: "Chloroplasts", colour: "#34d399", in: ["plant"], note: "grana stacks trap light for photosynthesis — plant cells only" },
  { key: "vacuole", label: "Permanent vacuole", colour: "#0ea5e9", in: ["plant"], note: "cell sap; its pressure keeps the cell turgid — plant cells only" },
  { key: "wall", label: "Cell wall", colour: "#65a30d", in: ["plant"], note: "crossed cellulose microfibrils — rigid, and fully permeable" },
];

/** The organelles a given cell type actually has on screen. */
export const organellesIn = (cellType) =>
  ORGANELLES.filter((o) => o.in.includes(cellType === "plant" ? "plant" : "animal"));

export const organelleFor = (key) => ORGANELLES.find((o) => o.key === key) ?? null;

export const WATER_COLOUR = "#38bdf8";

// ─── Osmosis ────────────────────────────────────────────────────────

/**
 * Thresholds, matched to what the scene draws.
 *
 * A plant cell in an isotonic solution is FLACCID, not plasmolysed: the
 * membrane is still against the wall but there is no turgor pressure. It
 * only plasmolyses when the solution is concentrated enough to pull the
 * membrane away, which is why the plant thresholds are not symmetric.
 */
export const PLASMOLYSIS_AT = 0.45;
export const TURGID_BELOW = -0.3;
export const CRENATION_AT = 0.45;
export const LYSIS_BELOW = -0.45;

/** What state the cell is in, and why. */
export function osmosisState(cellType, tonicity) {
  const t = clamp(Number(tonicity) || 0, -1, 1);
  const isPlant = cellType === "plant";

  const outside = t > 0.05 ? "concentrated (hypertonic)" : t < -0.05 ? "dilute (hypotonic)" : "the same as inside (isotonic)";
  const flow = t > 0.05 ? "out of the cell" : t < -0.05 ? "into the cell" : "none — in and out are balanced";

  if (isPlant) {
    if (t > PLASMOLYSIS_AT) {
      return {
        state: "Plasmolysed",
        tone: "bad",
        outside,
        flow,
        detail: "so much water has left that the membrane has pulled away from the wall",
      };
    }
    if (t < TURGID_BELOW) {
      return {
        state: "Turgid",
        tone: "good",
        outside,
        flow,
        detail: "water has pushed the membrane hard against the wall — this is what holds the plant up",
      };
    }
    return {
      state: "Flaccid",
      tone: "warn",
      outside,
      flow,
      // Not "no net flow": the flaccid band is a range of tonicities, and at
      // the concentrated end of it water is leaving. What defines flaccid is
      // the absence of turgor PRESSURE, not the absence of movement.
      detail: "too little turgor pressure to push the membrane against the wall — the cell is limp, but not yet plasmolysed",
    };
  }

  if (t > CRENATION_AT) {
    return { state: "Crenated (shrivelled)", tone: "bad", outside, flow, detail: "water has left and the membrane has crinkled inward" };
  }
  if (t < LYSIS_BELOW) {
    return { state: "Lysed (burst)", tone: "bad", outside, flow, detail: "with no wall to resist it, water has kept entering until the membrane gave way" };
  }
  return { state: "Normal", tone: "good", outside, flow, detail: "the cell holds its shape" };
}

/** Everything a readout wants from the two controls. */
export function solveOsmosis({ cellType = "plant", tonicity = 0 } = {}) {
  const isPlant = cellType === "plant";
  const t = clamp(Number(tonicity) || 0, -1, 1);
  return {
    cellType: isPlant ? "plant" : "animal",
    isPlant,
    tonicity: t,
    ...osmosisState(cellType, t),
    organelles: organellesIn(cellType),
    hasWall: isPlant,
    hasChloroplasts: isPlant,
    hasVacuole: isPlant,
    hasCentrioles: !isPlant,
    moving: Math.abs(t) > 0.05,
  };
}
