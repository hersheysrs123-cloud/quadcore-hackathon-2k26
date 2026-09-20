// ─── Two-source interference ─────────────────────────────────────────
// The geometry of the ripple tank the interference scene draws, and the
// screen pattern on it.
//
// It lives in `lib/` because the scene labels the fringes and the HUD quotes
// their positions, and the two must be talking about the same tank. The HUD
// used to carry its own screen distance (10.2) beside a scene whose screen is
// 10.7 from the sources.
//
// Nothing here touches React or three.js.
// ─────────────────────────────────────────────────────────────────────

/** Half the width of the tank and of the screen, in scene units (metres). */
export const FIELD_HALF_X = 6;
/** Where the sources sit, and the far edge of the tank. */
export const FIELD_NEAR_Z = -4.2;
export const FIELD_FAR_Z = 6;
/** Where the screen strip is drawn — and so the distance the paths must use. */
export const SCREEN_Z = FIELD_FAR_Z + 0.5;
/** Sources to screen: the L in every fringe formula. */
export const SCREEN_DISTANCE = SCREEN_Z - FIELD_NEAR_Z;
/** Samples across the screen. Fine enough that a fringe is many cells wide. */
export const SCREEN_CELLS = 241;

/**
 * Time-averaged intensity along the screen. Summing the complex phasors and
 * squaring is what produces fringes; summing the instantaneous heights would
 * just show the wave sloshing.
 *
 * Each cell carries its position, the raw intensity, and `level` — the
 * intensity as a fraction of the brightest cell.
 */
export function screenIntensity(sources, wavelength, amplitude, cells = SCREEN_CELLS) {
  const k = (Math.PI * 2) / wavelength;
  const out = [];
  let peak = 1e-9;
  for (let c = 0; c < cells; c += 1) {
    const x = -FIELD_HALF_X + (2 * FIELD_HALF_X * c) / (cells - 1);
    let re = 0;
    let im = 0;
    for (let s = 0; s < sources.length; s += 1) {
      const r = Math.max(Math.hypot(x - sources[s], SCREEN_DISTANCE), 0.35);
      const a = amplitude / Math.sqrt(r);
      re += a * Math.cos(k * r);
      im += a * Math.sin(k * r);
    }
    const intensity = re * re + im * im;
    peak = Math.max(peak, intensity);
    out.push({ x, intensity });
  }
  return out.map((c) => ({ ...c, level: c.intensity / peak }));
}

/**
 * Where a fringe of a given order lands on the screen, measured from the
 * centre line.
 *
 * A fringe is a set of points whose path difference to the two sources is
 * fixed at `order · λ` — a hyperbola with the sources at its foci. Cutting it
 * with a screen a distance L away gives, exactly,
 *
 *     x = (p / 2) · √(1 + 4L² / (d² − p²)),   p = order · λ
 *
 * which is the familiar x ≈ L·tan(asin(p/d)) only when L is much larger than
 * d. The tank is not that big, and the difference is visible. Whole orders
 * are bright fringes; half-odd orders are dark ones.
 *
 * Returns null when no such fringe exists — the path difference can never
 * exceed the slit separation.
 */
export function fringePosition(order, separation, wavelength, distance = SCREEN_DISTANCE) {
  const p = Math.abs(order) * wavelength;
  if (!(separation > 0) || !(p < separation)) return null;
  const x = (p / 2) * Math.sqrt(1 + (4 * distance * distance) / (separation * separation - p * p));
  return order < 0 ? -x : x;
}

/**
 * The bright fringes that land on the screen, as {order, x}, in left-to-right
 * order. `order` is m in "path difference = mλ"; the central maximum is 0.
 */
export function brightFringes(separation, wavelength, halfWidth = FIELD_HALF_X) {
  const fringes = [];
  const highest = Math.floor(separation / wavelength);
  for (let m = -highest; m <= highest; m += 1) {
    const x = m === 0 ? 0 : fringePosition(m, separation, wavelength);
    if (x !== null && Math.abs(x) <= halfWidth) fringes.push({ order: m, x });
  }
  return fringes;
}
