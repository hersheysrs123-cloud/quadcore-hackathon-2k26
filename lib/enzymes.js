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

/**
 * By this temperature essentially every molecule has lost its shape (rate
 * under 10 % and gone by ~52 °C). Denaturing itself starts just past the
 * optimum: between OPTIMUM_TEMP and here the enzyme is *denaturing*.
 */
export const DENATURE_TEMP = 50;

/** Share of molecules unfolded past which the loss counts as under way (and permanent). */
export const DENATURING_FROM = 0.05;

/** Rate roughly doubles for every 10 °C below the optimum (Q10 ≈ 2). */
export const Q10 = 2;

/**
 * The unfolding window, °C: molecules start to lose their shape at
 * UNFOLD_START and all of them have by UNFOLD_START + DENATURE_WIDTH.
 * UNFOLD_START is solved so the product of the Q10 rise and the fraction
 * still folded peaks exactly at OPTIMUM_TEMP.
 */
export const UNFOLD_START = 31.78;
export const DENATURE_WIDTH = 20;

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

const smoothstep = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};

/** Fraction of enzyme molecules still folded at a temperature, 0–1. */
const foldedAt = (t) => 1 - smoothstep((t - UNFOLD_START) / DENATURE_WIDTH);
const FOLDED_AT_OPTIMUM = foldedAt(OPTIMUM_TEMP);

/**
 * Rate as a fraction of the maximum, 0–1.
 *
 * Temperature: rate = (Q10 rise) × (fraction of molecules still folded).
 * The rise speeds up all the way to the optimum; past it, unfolding wins and
 * the rate falls far more steeply than it rose — the lopsided textbook curve.
 *
 * It used to be a symmetric Gaussian, which flattened out near 0 °C (1 %
 * where Q10 gives ~9 %) and started losing rate the moment it passed 37 °C
 * for no reason, before anything had unfolded (80 % at 45 °C).
 */
export function enzymeRate(temperature, ph) {
  const t = Number(temperature) || 0;
  const p = Number(ph) || 0;
  const folded = foldedAt(t);
  const tempTerm = (Math.pow(Q10, (t - OPTIMUM_TEMP) / 10) * folded) / FOLDED_AT_OPTIMUM;
  const phTerm = Math.exp(-Math.pow((p - OPTIMUM_PH) / 2.4, 2));

  return {
    rate: clamp(tempTerm * phTerm, 0, 1),
    denatured: t > DENATURE_TEMP,
    /** Share of the enzyme unfolded beyond what it is at the optimum: 0 intact, 1 all unfolded. */
    denaturation: clamp(1 - folded / FOLDED_AT_OPTIMUM, 0, 1),
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
  // Past the optimum molecules are unfolding for good, even though some still work.
  const denaturing = !denatured && denaturation > DENATURING_FROM;

  return {
    temperature,
    ph,
    rate,
    ratePercent: Math.round(rate * 100),
    denatured,
    denaturation,
    denaturing,
    extremePh,
    distortion,
    /** Heat denaturation cannot be undone; extreme pH usually cannot either. */
    reversible: !denatured && !denaturing && !extremePh,
    activeSite:
      denatured || extremePh
        ? "wrong shape — the substrate no longer fits"
        : denaturing
          ? `losing its shape in ${Math.round(denaturation * 100)} % of the molecules`
          : "complementary to the substrate",
    tooCold: temperature < 20 && !denatured,
  };
}
