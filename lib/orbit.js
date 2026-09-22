// ─── Gravity wells & orbital motion ──────────────────────────────────
// The two-body problem the orbit scene runs: the conic a launch condition
// puts the satellite on, and the leapfrog step that flies it.
//
// It lives in `lib/` because the scene, the HUD readout and the tests all need
// the same numbers. The HUD carried its own copy of the gravitational
// parameter (6 · mass) beside the scene's, and nothing checked that the
// integrator actually flew the orbit the formulae promised.
//
// Nothing here touches React or three.js.
// ─────────────────────────────────────────────────────────────────────

/** Gravitational constant in scene units — chosen so a 1.0 mass looks right. */
export const G_SCENE = 6;

/**
 * Inside this radius the pull stops growing, so a satellite dropped straight
 * at the central body is deflected rather than flung out at a numerical
 * infinity. Every launch the sliders allow stays outside it.
 */
export const SOFT_RADIUS = 0.55;

/** μ = GM for a central mass in units of M₀. */
export const muOf = (mass) => G_SCENE * mass;

/**
 * The conic a tangential launch puts the satellite on.
 *
 * The launch speed is given either outright (`launchSpeed`) or, more usefully,
 * as a multiple of the circular speed at that radius (`launchRatio`): 1 is a
 * circle, √2 is the escape speed, and everything between is an ellipse — the
 * same meaning at every radius and every central mass, which an absolute speed
 * never had.
 *
 * Launched sideways from radius r₀ at speed v₀, the specific energy is
 * ε = v₀²/2 − μ/r₀ and the specific angular momentum h = r₀v₀, which fix
 * everything else: e = √(1 + 2εh²/μ²), a = −μ/2ε, and the closest and
 * farthest points h²/(μ(1 ± e)).
 *
 * `bound` orbits close on themselves and have a finite `apoapsis` and
 * `period`; unbound ones (ε ≥ 0) leave and never come back.
 */
export function solveOrbit({ mass = 1, launchRadius = 3.4, launchSpeed, launchRatio = 1 } = {}) {
  const mu = muOf(mass);
  const r0 = launchRadius;

  const circularSpeed = Math.sqrt(mu / r0);
  const escapeSpeed = Math.sqrt((2 * mu) / r0);
  const v0 = launchSpeed ?? launchRatio * circularSpeed;
  const energy = (v0 * v0) / 2 - mu / r0;
  const h = r0 * v0;
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));

  const bound = energy < 0;
  const a = bound ? -mu / (2 * energy) : null;
  const periapsis = (h * h) / (mu * (1 + e));
  const apoapsis = bound ? (h * h) / (mu * (1 - e)) : null;
  const period = bound ? 2 * Math.PI * Math.sqrt((a * a * a) / mu) : null;

  const kind = bound ? (e < 0.02 ? "circular" : "elliptical") : energy === 0 ? "parabolic" : "hyperbolic";
  return {
    mu,
    launchSpeed: v0,
    speedRatio: v0 / circularSpeed,
    circularSpeed,
    escapeSpeed,
    energy,
    angularMomentum: h,
    eccentricity: e,
    bound,
    semiMajor: a,
    periapsis,
    apoapsis,
    period,
    // Speed left over at infinity for an unbound launch: ½v∞² = ε.
    speedAtInfinity: bound ? null : Math.sqrt(2 * energy),
    kind,
  };
}

/**
 * One kick–drift–kick leapfrog step of size `h`, in place on
 * `s = {x, z, vx, vz}`.
 *
 * Leapfrog is symplectic: a closed orbit stays closed and its energy wobbles
 * about the true value instead of draining away, which a naive Euler step
 * would do until the ellipse visibly spiralled in.
 */
export function stepOrbit(s, mu, h) {
  let r = Math.max(Math.hypot(s.x, s.z), SOFT_RADIUS);
  let a = -mu / (r * r * r);
  s.vx += 0.5 * h * a * s.x;
  s.vz += 0.5 * h * a * s.z;
  s.x += h * s.vx;
  s.z += h * s.vz;
  r = Math.max(Math.hypot(s.x, s.z), SOFT_RADIUS);

  a = -mu / (r * r * r);
  s.vx += 0.5 * h * a * s.x;
  s.vz += 0.5 * h * a * s.z;
}

/** Escape speed as a multiple of the circular speed at the same radius: √2. */
export const ESCAPE_RATIO = Math.SQRT2;

/**
 * What a launch will do, in a few words — for the slider to say beside its
 * number, so the control explains itself instead of being a bare figure.
 *
 * It takes the radius and mass as well as the ratio, because "near escape" is
 * only honest if the whole orbit is on screen: just under √2 the ellipse is
 * bound but hundreds of units wide, and the satellite leaves the view exactly
 * as an escaping one would. That one is called what it does.
 */
export function speedRegime({ mass = 1, launchRadius = 3.4, launchRatio = 1 } = {}) {
  if (Math.abs(launchRatio - 1) < 0.005) return "circular";
  if (launchRatio < 1) return "falls inward";
  const orbit = solveOrbit({ mass, launchRadius, launchRatio });
  if (!orbit.bound) return "escapes";
  if (!framing(orbit, launchRadius).fits) return "bound, leaves view";
  return launchRatio < 1.25 ? "ellipse" : "near escape";
}

/** The farthest the scene will frame: the drawn sheet is wider than this. */
export const VIEW_MAX = 45;
/** The smallest it will frame, so a close orbit is not lost in the middle. */
export const VIEW_MIN = 5.6;

/**
 * How far out the camera should be able to see, for this launch.
 *
 * A bound orbit is shown whole, with a margin. An unbound one only needs the
 * stretch where the path is still visibly bending — a hyperbola is close to a
 * straight line by six times its closest approach — so it is shown out to
 * there. Either way it is capped inside the drawn sheet, so nothing leaves
 * the sheet by more than the frame allows. `fits` says whether the whole
 * orbit is in view; if not, the satellite will leave it.
 */
export function framing(orbit, launchRadius) {
  const raw = orbit.bound ? orbit.apoapsis * 1.1 : 6 * orbit.periapsis;
  const viewRadius = Math.min(VIEW_MAX, Math.max(raw, launchRadius * 1.3, VIEW_MIN));
  return { viewRadius, fits: orbit.bound && orbit.apoapsis * 1.1 <= VIEW_MAX };
}

/**
 * Advances a satellite by `dt` of simulated time, in steps a small fraction
 * of the local dynamical time √(r³/μ) — so a tight orbit or a close pass gets
 * fine steps and a distant one gets coarse ones, and a frame that covers
 * many seconds (a fast time-scale) is still flown accurately.
 *
 * `onStep(s)` runs after each step; returning `false` stops early (the
 * satellite has left, say). Returns the number of steps taken. The count is
 * capped so a very fast time-scale slows down rather than freezing the page.
 */
export function advanceOrbit(s, mu, dt, onStep, maxSteps = 1500) {
  let left = dt;
  let steps = 0;
  while (left > 1e-12 && steps < maxSteps) {
    const r = Math.max(Math.hypot(s.x, s.z), SOFT_RADIUS);
    const h = Math.min(left, 0.02 * Math.sqrt((r * r * r) / mu));
    stepOrbit(s, mu, h);
    left -= h;
    steps += 1;
    if (onStep && onStep(s) === false) break;
  }
  return steps;
}
