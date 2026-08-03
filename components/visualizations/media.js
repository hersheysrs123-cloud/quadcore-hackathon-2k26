// ─── Optical media ──────────────────────────────────────────────────
// Refractive indices at the values IGCSE papers use. Plain data with no
// three.js import, so the page (which drives the controls) and the canvas
// bundle (which draws the block) can share one source of truth.
// ─────────────────────────────────────────────────────────────────────

export const MEDIA = {
  air: { label: "Air", n: 1.0, colour: "#7dd3fc" },
  ice: { label: "Ice", n: 1.31, colour: "#a5f3fc" },
  water: { label: "Water", n: 1.33, colour: "#38bdf8" },
  perspex: { label: "Perspex", n: 1.49, colour: "#c4b5fd" },
  glass: { label: "Glass", n: 1.5, colour: "#93c5fd" },
  diamond: { label: "Diamond", n: 2.42, colour: "#e0e7ff" },
};

export const MEDIA_OPTIONS = Object.entries(MEDIA).map(([value, m]) => ({
  value,
  label: m.label,
}));

/** Which named medium has this refractive index, or "custom" if none does. */
export function mediumFor(n) {
  const hit = Object.entries(MEDIA).find(([, m]) => Math.abs(m.n - n) < 0.005);
  return hit ? hit[0] : "custom";
}

export function mediumName(id, n) {
  if (MEDIA[id]?.label) return MEDIA[id].label;
  const val = typeof n === "number" && !isNaN(n) ? n : 1.0;
  return `n = ${val.toFixed(2)}`;
}

export function mediumColour(id) {
  return MEDIA[id]?.colour ?? "#93c5fd";
}
