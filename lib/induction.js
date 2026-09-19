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
 * Flux through the coil at rotation angle θ.
 *
 * The coil is built in the XY plane, so its normal starts along +z, and it
 * turns about y — which puts the normal at (sin θ, 0, cos θ). B lies along
 * +x, so Φ = B·A·sin θ, *not* cos θ. Getting this backwards (as this scene
 * did) puts the readout a quarter turn out of step with the model: it
 * announced "cutting no field lines" at the exact moment the coil was drawn
 * edge-on to the field, sweeping across the lines as fast as it ever does.
 */
export const fluxAt = (field, angle) => field * COIL_AREA * Math.sin(angle);

/** ε = −N·dΦ/dt = −N·B·A·ω·cos θ. */
export const emfAt = (field, omega, angle, turns = 1) =>
  -turns * field * COIL_AREA * omega * Math.cos(angle);

/** A signed zero or a rounding crumb reads as "reversed" on a galvanometer. */
const settle = (n) => (Object.is(n, -0) || Math.abs(n) < 1e-12 ? 0 : n);

/** Which way the induced current goes, or nothing while the needle rests. */
export const currentDirection = (emf) =>
  Math.abs(emf) < 0.05 ? "none" : emf > 0 ? "clockwise" : "anticlockwise";

/** Turns has to be a whole coil, and at least one. */
export const safeTurnsOf = (turns) => Math.max(1, Math.round(turns || 1));

/** The whole dynamo readout at one instant of the rotation. */
export function solveInduction({ speed = 1.0, field = 1.0, turns = 1, angle = 0 } = {}) {
  const safeTurns = safeTurnsOf(turns);
  const omega = omegaOf(speed);
  const emf = settle(emfAt(field, omega, angle, safeTurns));
  return {
    coilArea: COIL_AREA,
    turns: safeTurns,
    omega,
    peakEmf: peakEmf(field, omega, safeTurns),
    flux: settle(fluxAt(field, angle)),
    emf,
    direction: currentDirection(emf),
    frequencyHz: speed,
    // |cos θ| — how fast the coil is sweeping across the field lines, as a
    // fraction of the fastest it ever does.
    cuttingRate: Math.abs(Math.cos(angle)),
  };
}

/**
 * Bar magnet on the axis of a solenoid.
 *
 * The magnet is a dipole, so its flux through the coil falls off as
 * (x² + R²)^(3/2). The e.m.f. is the chain rule on that: ε = −N·(dΦ/dx)·v,
 * which is why a magnet held still at the very centre — maximum flux —
 * induces exactly nothing.
 */
export function solveSolenoidInduction({
  x = 0,
  velocity = 0,
  turns = 10,
  magnetStrength = 1.0,
  radius = 0.9,
  flipPoles = false,
} = {}) {
  const safeTurns = safeTurnsOf(turns);
  const polarity = flipPoles ? -1 : 1;
  const m = (magnetStrength || 1.0) * polarity;
  const R = radius || 0.9;
  const denom = Math.pow(x * x + R * R, 1.5);
  const C = 2.0 * R;
  const flux = (C * m * R * R) / denom;
  const dPhi_dx = (-3 * C * m * R * R * x) / Math.pow(x * x + R * R, 2.5);
  const emf = settle(-safeTurns * dPhi_dx * velocity);
  return {
    turns: safeTurns,
    flux: settle(flux),
    dPhi_dx: settle(dPhi_dx),
    emf,
    velocity,
    direction: currentDirection(emf),
  };
}
