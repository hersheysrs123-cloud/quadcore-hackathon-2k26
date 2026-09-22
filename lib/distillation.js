// ─── Fractional distillation ────────────────────────────────────────
// The fractions in the column, top (coolest, shortest chains) to bottom
// (hottest, longest), and the one predicate that decides which of them
// the furnace is hot enough to send up.
//
// Both the scene and the Details panel used to carry their own copy of
// this table and they had drifted apart completely: different boiling
// points, different chain ranges, and colours that matched nothing in the
// viewport — the "Fractions Key" keyed refinery gases red while the scene
// drew them pale blue. They also counted the risers with two different
// formulas and disagreed at the default heat.
// ─────────────────────────────────────────────────────────────────────

export const FRACTIONS = [
  { key: "gases", name: "Refinery gases", top: 25, use: "bottled gas", colour: "#7dd3fc", chain: "C₁–C₄" },
  { key: "petrol", name: "Petrol", top: 75, use: "car fuel", colour: "#a5b4fc", chain: "C₅–C₁₀" },
  { key: "naphtha", name: "Naphtha", top: 150, use: "chemical feedstock", colour: "#c4b5fd", chain: "C₈–C₁₂" },
  { key: "kerosene", name: "Kerosene", top: 240, use: "aircraft fuel", colour: "#fcd34d", chain: "C₁₁–C₁₆" },
  { key: "diesel", name: "Diesel oil", top: 320, use: "lorries, trains", colour: "#fb923c", chain: "C₁₅–C₂₀" },
  {
    key: "bitumen",
    name: "Bitumen",
    top: 400,
    use: "road surfacing",
    colour: "#f87171",
    chain: "C₃₀+",
    /** Too heavy to vaporise at any furnace setting — drained off, not condensed out. */
    residue: true,
  },
];

/** Furnace temperature for the heat slider's 0–1, °C. */
export const furnaceTemperature = (heat) => Math.round(250 + Math.min(1, Math.max(0, heat)) * 200);

/** Temperature at the top of the column, °C — fixed by the condensers. */
export const COLUMN_TOP_C = 25;

/** How much furnace heat each step up the column costs. */
export const HEAT_PER_LEVEL = 0.14;

/** Threshold above which a fraction counts as having climbed at all. */
export const RISE_THRESHOLD = 0.05;

/**
 * Does fraction `i` vaporise at this furnace heat?
 *
 * A residue never does, however hot the furnace. That is what makes it a
 * residue, and it is the fact the "left at the base" readout depends on.
 */
export function rises(heat, i) {
  if (FRACTIONS[i]?.residue) return false;
  return heat - i * HEAT_PER_LEVEL > RISE_THRESHOLD;
}

/** How many of the fractions are up the column at this heat. */
export const risingCount = (heat) => FRACTIONS.filter((_, i) => rises(heat, i)).length;

/** The highest fraction that actually reaches its tray, or null if none does. */
export function highestRiser(heat) {
  for (let i = 0; i < FRACTIONS.length; i += 1) if (rises(heat, i)) return FRACTIONS[i];
  return null;
}

/** The fractions that never leave the base at this heat — residues included. */
export const atTheBase = (heat) => FRACTIONS.filter((_, i) => !rises(heat, i));

/** Everything a readout wants from the heat slider alone. */
export function solveColumn(heat) {
  const h = Math.min(1, Math.max(0, Number(heat) || 0));
  const rising = risingCount(h);
  const highest = highestRiser(h);
  return {
    heat: h,
    furnaceC: furnaceTemperature(h),
    topC: COLUMN_TOP_C,
    rising,
    total: FRACTIONS.length,
    highest,
    /** The residue is always the last thing left in the base. */
    residue: FRACTIONS.find((f) => f.residue) ?? null,
    tooCool: rising <= 2,
    fractions: FRACTIONS.map((f, i) => ({ ...f, index: i, rises: rises(h, i) })),
  };
}
