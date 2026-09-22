// ─── Ray optics: refraction through a block, and image formation ─────
// The arithmetic behind the refraction scene and the lens/mirror bench.
//
// It lives in `lib/` rather than inside PhysicsCanvas.jsx because three
// callers need the same numbers — the scene that draws the rays, the HUD
// that prints the readout, and the unit tests — and when each kept its own
// copy they disagreed. VisualizationHUD called an image "at infinity"
// within 0.03 of the focal point while the scene used 0.035; it printed the
// reflected share from the s-polarisation alone where the scene averaged
// both; and it printed h' as +m·h for a real image the scene drew inverted.
//
// Nothing here touches React or three.js: it is arithmetic, and every
// number it produces is one the scene puts on screen.
// ─────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ═══ 1 · Refraction through a parallel-sided block ═══════════════════

/**
 * Fraction of the light reflected at the surface, from the Fresnel
 * equations averaged over the two polarisations (unpolarised light).
 *
 * Refraction is never all-or-nothing: about 4% comes straight back off a
 * glass surface at normal incidence, and the share climbs steeply toward
 * 100% as the ray flattens out — which is why a window is a mirror when you
 * look along it. Drawing the reflected ray at a fixed faintness hid that
 * entirely.
 *
 * `i` and `r` are in radians; `r` is null past the critical angle.
 */
export function fresnelReflectance(i, r, n1, n2) {
  if (r === null) return 1; // past the critical angle: everything comes back
  const cosI = Math.cos(i);
  const cosR = Math.cos(r);
  const rs = (n1 * cosI - n2 * cosR) / (n1 * cosI + n2 * cosR);
  const rp = (n1 * cosR - n2 * cosI) / (n1 * cosR + n2 * cosI);
  return clamp((rs * rs + rp * rp) / 2, 0, 1);
}

/**
 * The full parallel-sided block, not just the first surface.
 *
 * The ray refracts on the way in (i → r), crosses the block, then refracts
 * on the way out. Because the two faces are parallel, the second refraction
 * undoes the first exactly: the emergent angle equals the angle of
 * incidence, so the ray leaves parallel to how it arrived, shifted sideways
 * by the lateral displacement d = t·sin(i − r) ÷ cos r.
 *
 * Angles in are degrees (what the slider hands over); angles out are
 * radians, except `critical`, which is the degrees the readout prints.
 * `r` and `e` are null under total internal reflection.
 */
export function solveBlock(angleDeg, n1, n2, thickness) {
  const i = angleDeg * DEG;
  const sinR = (n1 * Math.sin(i)) / n2;
  const tir = sinR > 1; // only possible when the block is less dense
  const r = tir ? null : Math.asin(clamp(sinR, -1, 1));
  const e = tir ? null : i; // parallel faces ⇒ emergent angle = incident angle
  const critical = n1 > n2 ? Math.asin(clamp(n2 / n1, -1, 1)) / DEG : null;
  const cosR = r !== null ? Math.cos(r) : 0;
  // At grazing incidence cos r → 0 and the displacement would blow up.
  const lateral = tir ? 0 : Math.abs(cosR) < 1e-4 ? 0 : (thickness * Math.sin(i - (r ?? 0))) / cosR;
  const run = tir ? 0 : clamp(thickness * Math.tan(r ?? 0), -25, 25); // sideways travel inside
  const reflectance = fresnelReflectance(i, r, n1, n2);
  return { i, r, e, tir, critical, lateral, run, reflectance };
}

// ═══ 2 · Lenses and spherical mirrors ════════════════════════════════

/**
 * How close to the focal point counts as "at infinity".
 *
 * An object exactly at F sends the rays out parallel, so there is no image
 * at all. The sliders are continuous, so the branch needs a tolerance —
 * and the scene and the readout have to agree on it, or the panel says "∞"
 * over a scene that is still drawing an image, or the reverse.
 */
export const AT_INFINITY_TOLERANCE = 0.035;

/** The four elements the bench can be set to. */
export const OPTICS_TYPES = ["convex_lens", "concave_lens", "concave_mirror", "convex_mirror"];

export const OPTICS_TITLES = {
  convex_lens: "Convex Lens (Converging)",
  concave_lens: "Concave Lens (Diverging)",
  concave_mirror: "Concave Mirror (Converging)",
  convex_mirror: "Convex Mirror (Diverging)",
};

/** The element this params object selects, honouring the older `lensType`. */
export function opticsTypeOf(params = {}) {
  if (OPTICS_TYPES.includes(params.opticsType)) return params.opticsType;
  return params.lensType === "concave" ? "concave_lens" : "convex_lens";
}

/**
 * Where the image is, how big, and which way up.
 *
 * Real-is-positive convention, and the SAME equation for both lenses and
 * mirrors: 1/v + 1/u = 1/f. The sliders hand over u and f as positive
 * magnitudes, so the branches carry the signs explicitly rather than
 * relying on a signed f — writing the lens case as 1/v − 1/u = 1/f would be
 * the Cartesian convention, which needs a negative u for a real object and
 * would disagree with every number the panel prints.
 *
 * `imgX` is where the scene puts the image on the optical axis: a real
 * mirror image is in front (x < 0) and a real lens image behind (x > 0),
 * and the virtual cases are the other way round.
 */
export function solveRayOptics({
  type = "convex_lens",
  focal = 2.5,
  objectDistance = 5.0,
  objectHeight = 1.5,
} = {}) {
  const isMirror = type.includes("mirror");
  const isConverging = type === "convex_lens" || type === "concave_mirror";
  const u = objectDistance;
  const h = objectHeight;
  const f = focal;

  const atInfinity = isConverging && Math.abs(u - f) < AT_INFINITY_TOLERANCE;

  let v = 0;
  let real = false;
  let m = 0;
  let imgX = 0;
  let imageHeight = 0;

  if (isConverging) {
    if (!atInfinity) {
      if (u > f) {
        v = (f * u) / (u - f);
        real = true;
        m = v / u;
        imageHeight = -h * m; // Inverted
        imgX = isMirror ? -v : v;
      } else {
        v = (f * u) / (f - u);
        real = false;
        m = v / u;
        imageHeight = h * m; // Upright
        imgX = isMirror ? v : -v;
      }
    }
  } else {
    // Diverging optical element: concave lens or convex mirror.
    v = (f * u) / (u + f);
    real = false;
    m = v / u;
    imageHeight = h * m; // Upright
    imgX = isMirror ? v : -v;
  }

  return {
    atInfinity,
    v,
    imgX,
    imageHeight,
    magnification: m,
    real,
    virtual: !real && !atInfinity,
    upright: imageHeight > 0,
    inverted: imageHeight < 0,
    isMirror,
    isConverging,
  };
}

/** "Real, inverted, diminished" — the one sentence the scene and panel share. */
export function imageNature(solved) {
  if (solved.atInfinity) return "No image — rays leave parallel (spotlight)";
  const size =
    solved.magnification > 1.02 ? "magnified" : solved.magnification < 0.98 ? "diminished" : "same size";
  return `${solved.real ? "Real" : "Virtual"}, ${solved.inverted ? "inverted" : "upright"}, ${size}`;
}

/** Which of the three textbook zones the object sits in. */
export function objectZone(focal, objectDistance) {
  if (objectDistance > 2 * focal) return "Beyond 2F (C)";
  return objectDistance > focal ? "Between F & 2F" : "Inside F";
}
