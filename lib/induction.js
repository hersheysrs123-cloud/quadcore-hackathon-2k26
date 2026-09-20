// ─── Electromagnetic induction ───────────────────────────────────────
// Faraday's law for the two apparatus the scene can show: a coil rotating
// in a uniform field (the AC dynamo) and a bar magnet moving in and out of
// a solenoid.
//
// It lives in `lib/` because the scene, the HUD readout and the unit tests
// all need the same numbers, and they had drifted. VisualizationHUD printed
// the peak e.m.f. as N·B·speed·1.5 where the coil actually generates
// N·B·A·ω = N·B·6.0·1.7·speed — seven times larger, on the same screen as
// the scene it was describing.
//
// Sign convention, used by every function here and by the scene: e.m.f. is
// positive when the induced *conventional* current is anticlockwise as seen
// looking back along the coil's normal from its tip (the right-hand rule
// about the normal). That is ε = −N dΦ/dt with Φ measured along the normal,
// so Lenz's law is built into the sign rather than bolted on afterwards.
//
// Nothing here touches React or three.js.
// ─────────────────────────────────────────────────────────────────────

// Half-width and half-height of the coil, and the area they enclose. The
// scene and the coil both need these, and the flux is wrong if they drift.
export const COIL_W = 1.5;
export const COIL_H = 1.0;
export const COIL_AREA = 2 * COIL_W * 2 * COIL_H;

/** Radians per second for a given slider `speed` — one unit is 1.7 rad/s. */
export const omegaOf = (speed) => (speed || 0) * 1.7;

/**
 * Peak e.m.f. of an N-turn coil of area A turning at ω in a field B.
 * Each turn cuts the same flux, so they add: ε₀ = N B A ω.
 */
export const peakEmf = (field, omega, turns = 1) => turns * field * COIL_AREA * omega;

/**
 * Flux through the coil at angle θ = ωt, measured from the moment the coil
 * is face-on to the field — the textbook convention, Φ = B A cos θ.
 *
 * At θ = 0 the coil's normal lies along B, so the flux is at its maximum and
 * is not changing; at θ = π/2 the coil is edge-on to B, the flux is zero and
 * it is changing as fast as it ever does.
 */
export const fluxAt = (field, angle) => field * COIL_AREA * Math.cos(angle);

/** ε = −N dΦ/dt = N B A ω sin θ — zero when face-on, greatest when edge-on. */
export const emfAt = (field, omega, angle, turns = 1) =>
  turns * field * COIL_AREA * omega * Math.sin(angle);

/** A signed zero or a rounding crumb reads as "reversed" on a galvanometer. */
const settle = (n) => (Object.is(n, -0) || Math.abs(n) < 1e-12 ? 0 : n);

/**
 * Which way the induced conventional current goes, or nothing while the
 * needle rests. "Anticlockwise" is as seen from the tip of the coil's normal.
 */
export const currentDirection = (emf) =>
  Math.abs(emf) < 0.05 ? "none" : emf > 0 ? "anticlockwise" : "clockwise";

/**
 * The direction the induced field points along the coil's axis: +1 along the
 * normal, −1 against it, 0 at rest. An anticlockwise current makes a field
 * along the normal, so this is simply the sign of the e.m.f. — and by
 * Lenz's law it opposes whatever change in flux is producing it.
 */
export const inducedFieldOf = (emf) => (Math.abs(emf) < 0.05 ? 0 : emf > 0 ? 1 : -1);

/** Turns has to be a whole coil, and at least one. */
export const safeTurnsOf = (turns) => Math.max(1, Math.round(turns || 1));

/** The whole dynamo readout at one instant of the rotation. */
export function solveInduction({ speed = 1.0, field = 1.0, turns = 1, angle = 0 } = {}) {
  const safeTurns = safeTurnsOf(turns);
  const omega = omegaOf(speed);
  const emf = settle(emfAt(field, omega, angle, safeTurns));
  const frequencyHz = omega / (2 * Math.PI);
  return {
    coilArea: COIL_AREA,
    turns: safeTurns,
    omega,
    peakEmf: peakEmf(field, omega, safeTurns),
    flux: settle(fluxAt(field, angle)),
    emf,
    direction: currentDirection(emf),
    // f = ω / 2π. The slider's "1.0" is 1.7 rad/s, which is 0.27 Hz — the
    // readout used to quote the slider value as if it were hertz.
    frequencyHz,
    period: frequencyHz > 0 ? 1 / frequencyHz : Infinity,
    // |sin θ| — how fast the coil is sweeping across the field lines, as a
    // fraction of the fastest it ever does.
    cuttingRate: Math.abs(Math.sin(angle)),
  };
}

// ─── Bar magnet and solenoid ─────────────────────────────────────────

/** Radius of the winding, from the axis to the centre of the wire. */
export const SOLENOID_RADIUS = 0.96;
/** Length of the bar magnet the scene draws (two 1.35 poles). */
export const MAGNET_LENGTH = 2.7;
/** Axial spacing of adjacent turns — a compact coil, so every turn links
 *  very nearly the same flux and ε ∝ N holds as the syllabus states it. */
export const TURN_PITCH = 0.11;
/** Radians per second for the auto-shaker at a slider `speed` of 1. */
export const MAGNET_OMEGA = 2.2;
/** Turns the slider's "tesla" figure into the scene's flux units. */
const MOMENT_SCALE = 10;

/** Axial positions of the turns, centred on the middle of the coil. */
export const turnCentres = (turns) => {
  const n = safeTurnsOf(turns);
  return Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * TURN_PITCH);
};

// The magnet is a line of dipoles spread evenly along its length. One dipole
// at axial distance s links R² / (2 (R² + s²)^1.5) through a loop of radius
// R, and integrating that along the bar gives a flux that is smooth and
// finite everywhere. G below is the antiderivative of R² / (R² + s²)^1.5.
const G = (s, R) => s / Math.hypot(s, R);
const dG = (s, R) => (R * R) / Math.pow(s * s + R * R, 1.5);

/**
 * Flux through one turn, with the magnet's centre at axial offset `d` from
 * the turn and its moment `m` along +x. Positive means along +x.
 */
export function turnFlux(d, m, R = SOLENOID_RADIUS, L = MAGNET_LENGTH) {
  const h = L / 2;
  return (m / (2 * L)) * (G(d + h, R) - G(d - h, R));
}

/** dΦ/dx for one turn. */
export function turnFluxGradient(d, m, R = SOLENOID_RADIUS, L = MAGNET_LENGTH) {
  const h = L / 2;
  return (m / (2 * L)) * (dG(d + h, R) - dG(d - h, R));
}

/**
 * Bar magnet sliding along the axis of a solenoid.
 *
 * ε = −N dΦ/dt = −N (dΦ/dx) v. The flux is largest with the magnet centred in
 * the coil, where its slope is zero — so a magnet held there, or held anywhere
 * else, induces nothing. The slope is steepest as a pole passes the turns,
 * which is where the e.m.f. peaks: entering one way, leaving the other.
 *
 * The magnet's moment points along +x (north at +x) unless `flipPoles`.
 */
export function solveSolenoidInduction({
  x = 0,
  velocity = 0,
  turns = 10,
  magnetStrength = 1.0,
  radius = SOLENOID_RADIUS,
  flipPoles = false,
  magnetLength = MAGNET_LENGTH,
} = {}) {
  const safeTurns = safeTurnsOf(turns);
  const polarity = flipPoles ? -1 : 1;
  const m = (magnetStrength || 1.0) * MOMENT_SCALE * polarity;
  const R = radius || SOLENOID_RADIUS;

  let linkage = 0;
  let gradient = 0;
  for (const t of turnCentres(safeTurns)) {
    linkage += turnFlux(x - t, m, R, magnetLength);
    gradient += turnFluxGradient(x - t, m, R, magnetLength);
  }

  const emf = settle(-gradient * velocity);
  return {
    turns: safeTurns,
    // Per turn, and the flux linkage NΦ that Faraday's law actually differentiates.
    flux: settle(linkage / safeTurns),
    linkage: settle(linkage),
    dPhi_dx: settle(gradient / safeTurns),
    emf,
    velocity,
    direction: currentDirection(emf),
    inducedField: inducedFieldOf(emf),
  };
}
