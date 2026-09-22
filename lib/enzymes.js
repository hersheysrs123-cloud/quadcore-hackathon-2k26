// ─── Enzyme kinetics ────────────────────────────────────────────────
// Rate against temperature and pH, and when the active site is wrecked.
//
// The scene and the Details panel had a rate model each and they were not
// the same model — a product of Gaussians against a product of linear
// triangles, reading 84 % and 72 % for the same dials. Worse, they
// denatured at different temperatures: the scene at 50 °C, the panel at
// 55 °C while its own note said "> 50 °C". At 52 °C the scene collapsed
// the rate to 9 % and gaped the active site open while the panel reported
// 40 % and "Complementary Lock".
// ─────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const OPTIMUM_TEMP = 37;
export const OPTIMUM_PH = 7;

/** Above this the protein's tertiary structure is lost — permanently. */
export const DENATURE_TEMP = 50;

/** Width of the collapse above the denaturation temperature, °C. */
export const DENATURE_WIDTH = 6;

/** pH this far from the optimum counts as extreme. */
export const PH_STRESS_LIMIT = 3;

/** Colours the scene draws with, so the key names what is on screen. */
export const ENZYME_COLOURS = {
  enzyme: "#34d399",
  denatured: "#fb7185",
  substrate: "#fbbf24",
  product: "#f59e0b",
  curve: "#fbbf24",
  marker: "#e8ebf0",
};

/**
 * Rate as a fraction of the maximum, 0–1.
 *
 * Two Gaussians for the reversible part — collisions get more frequent and
 * more energetic up to the optimum — and a steep sigmoid collapse above the
 * denaturation temperature.
 *
 * The collapse used to be a step: 0.557 just below 50 °C and 0.12 just
 * above. That is a discontinuity, and it was drawn straight through as a
 * vertical segment of the rate-against-temperature curve, which is not a
 * thing a graph is allowed to do. It is a cliff now, not a jump.
 */
export function enzymeRate(temperature, ph) {
  const t = Number(temperature) || 0;
  const p = Number(ph) || 0;
  const tempTerm = Math.exp(-Math.pow((t - OPTIMUM_TEMP) / 17, 2));
  const phTerm = Math.exp(-Math.pow((p - OPTIMUM_PH) / 2.4, 2));

  // Smoothstep down across the denaturation window, so the curve is steep
  // but single-valued.
  const x = clamp((t - DENATURE_TEMP + DENATURE_WIDTH * 0.35) / DENATURE_WIDTH, 0, 1);
  const surviving = 1 - x * x * (3 - 2 * x);

  return {
    rate: clamp(tempTerm * phTerm * surviving, 0, 1),
    denatured: t > DENATURE_TEMP,
    /** How far through the collapse: 0 intact, 1 completely unfolded. */
    denaturation: 1 - surviving,
  };
}

/** Distortion of the active site from extreme pH alone, 0–1. */
export const phStress = (ph) => clamp(Math.abs((Number(ph) || 0) - OPTIMUM_PH) / 7, 0, 1);

/** Everything a readout wants from the two sliders. */
export function solveEnzyme({ temperature = 37, ph = 7 } = {}) {
  const { rate, denatured, denaturation } = enzymeRate(temperature, ph);
  const stress = phStress(ph);
  const extremePh = Math.abs(ph - OPTIMUM_PH) > PH_STRESS_LIMIT;

  // Both heat and extreme pH wreck the active site; the scene deforms the
  // protein by this, so the panel must describe the same number.
  const distortion = clamp(denaturation + stress * 0.45, 0, 1);

  return {
    temperature,
    ph,
    rate,
    ratePercent: Math.round(rate * 100),
    denatured,
    denaturation,
    extremePh,
    distortion,
    /** Heat denaturation cannot be undone; extreme pH usually cannot either. */
    reversible: !denatured && !extremePh,
    activeSite: denatured || extremePh ? "wrong shape — the substrate no longer fits" : "complementary to the substrate",
    tooCold: temperature < 20 && !denatured,
  };
}
