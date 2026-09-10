// ─── Incline plane · Newton's laws and dry friction ─────────────────
// The mechanics behind the ramp scene: resolving weight into components
// along and across a slope, the difference between the friction that *is*
// acting and the most that *could* act, and the break-away from static to
// kinetic.
//
// It lives in `lib/` rather than inside the canvas so the unit tests import
// the very code that ships, and so the 3D scene and the HUD's Details panel
// cannot drift into disagreeing about how hard anything is being pushed.
// ─────────────────────────────────────────────────────────────────────

/** Standard gravity, m/s². */
export const G = 9.81;

/** How long the drawn ramp is, in metres — the sim clamps travel to it. */
export const RAMP_LENGTH_M = 4;

/** Below this speed the block counts as at rest and static friction takes over. */
export const REST_SPEED = 1e-4;

/**
 * Coefficients for the three surface pairings the control offers.
 *
 * `muS` values are the ones the syllabus quotes. `muK` is always the smaller
 * of the two, and that gap is not a rounding detail — it is why a block lurches
 * the instant it breaks away instead of easing into motion.
 */
export const FRICTION_SURFACES = {
  teflon: {
    label: "Teflon on Teflon",
    short: "Teflon",
    muS: 0.04,
    muK: 0.04,
    note: "the slipperiest solid pair known — barely holds on any slope",
  },
  wood: {
    label: "Wood on Wood",
    short: "Wood",
    muS: 0.5,
    muK: 0.3,
    note: "a big drop from static to kinetic, so it lurches when it goes",
  },
  rubber: {
    label: "Rubber on Concrete",
    short: "Rubber",
    muS: 0.9,
    muK: 0.68,
    note: "what car tyres are designed for — grips past 40°",
  },
};

export const surfaceFor = (key) => FRICTION_SURFACES[key] ?? FRICTION_SURFACES.wood;

export const degToRad = (deg) => (deg * Math.PI) / 180;
export const radToDeg = (rad) => (rad * 180) / Math.PI;

// ─── Resolving the weight ───────────────────────────────────────────

/**
 * Weight split into the component down the slope and the component pressing
 * into it.
 *
 * The two are mg·sinθ and mg·cosθ, and which gets the sine is the single
 * thing most often written down backwards. The check that settles it: at
 * θ = 0 nothing should slide, and sin 0 = 0.
 */
export function weightComponents(massKg, angleDeg, g = G) {
  const theta = degToRad(angleDeg);
  const weight = massKg * g;
  return {
    weight,
    /** Down the slope. Zero on the flat, the whole weight when vertical. */
    parallel: weight * Math.sin(theta),
    /** Into the surface. The whole weight on the flat, zero when vertical. */
    perpendicular: weight * Math.cos(theta),
  };
}

/**
 * Normal force on the block.
 *
 * Equal to mg·cosθ here because the applied pull acts ALONG the ramp. Angle
 * that pull out of the surface and this stops being true — which is why the
 * scene keeps it in-plane rather than quietly letting it change two things at
 * once.
 */
export function normalForce(massKg, angleDeg, g = G) {
  return weightComponents(massKg, angleDeg, g).perpendicular;
}

/**
 * The MOST static friction available — not the friction that is acting.
 *
 * f_s ≤ μ_s·N is an inequality, and treating it as an equation is the classic
 * error: it would have a block on level ground being shoved sideways by
 * friction with nothing to oppose.
 */
export function maxStaticFriction(muS, normal) {
  return muS * Math.max(normal, 0);
}

/** Kinetic friction — this one really is an equation, once sliding. */
export function kineticFriction(muK, normal) {
  return muK * Math.max(normal, 0);
}

/**
 * Angle of repose: the slope at which an unhelped block just lets go.
 *
 * tan θ = μ_s, from mg·sinθ = μ_s·mg·cosθ. The mass cancels — a grain of sand
 * and a shipping container let go at the same angle, which is worth making a
 * student prove to themselves with the mass slider.
 */
export function angleOfRepose(muS) {
  return radToDeg(Math.atan(muS));
}

// ─── The solve ──────────────────────────────────────────────────────

/**
 * Everything acting on the block right now.
 *
 * Sign convention: positive is UP the slope, for every force and for velocity.
 * `appliedForce` is therefore positive when the pull helps the block climb.
 */
export function solveIncline({
  massKg = 10,
  angleDeg = 20,
  surface = "wood",
  appliedForce = 0,
  velocity = 0,
  g = G,
}) {
  const s = surfaceFor(surface);
  const { weight, parallel, perpendicular } = weightComponents(massKg, angleDeg, g);
  const normal = perpendicular;

  /** What is trying to move the block, before friction gets a say. */
  const drive = appliedForce - parallel;
  const grip = maxStaticFriction(s.muS, normal);
  const sliding = kineticFriction(s.muK, normal);
  const moving = Math.abs(velocity) > REST_SPEED;

  let friction;
  let state;
  if (!moving && Math.abs(drive) <= grip) {
    // Static friction takes exactly the value needed and no more.
    friction = -drive;
    state = "static";
  } else if (!moving) {
    friction = -Math.sign(drive) * sliding;
    state = "breaking away";
  } else {
    // Kinetic friction opposes MOTION, not the applied force: drag a block
    // uphill and friction points downhill even though the pull does too.
    friction = -Math.sign(velocity) * sliding;
    state = "sliding";
  }

  const netForce = drive + friction;
  const acceleration = state === "static" ? 0 : netForce / massKg;

  return {
    surface: s,
    weight,
    /** Magnitude of mg·sinθ, down the slope. */
    weightParallel: parallel,
    /** Magnitude of mg·cosθ, into the slope. */
    weightPerpendicular: perpendicular,
    normal,
    appliedForce,
    /** Signed. Positive means friction is pushing the block up the slope. */
    friction,
    frictionMagnitude: Math.abs(friction),
    /** The ceiling on static friction, μ_s·N. */
    grip,
    /** The ceiling on kinetic friction, μ_k·N. */
    slidingFriction: sliding,
    /** How much friction is being asked for, |applied − mg sinθ|. */
    demand: Math.abs(drive),
    /** Fraction of the available grip in use: 1.0 is the instant it lets go. */
    gripUsed: grip > 0 ? Math.min(Math.abs(drive) / grip, 1) : Math.abs(drive) > 0 ? 1 : 0,
    netForce,
    acceleration,
    state,
    isStatic: state === "static",
    /** Within 2% of letting go — worth warning about before it happens. */
    onTheVerge: state === "static" && grip > 0 && Math.abs(drive) / grip > 0.98,
    reposeAngle: angleOfRepose(s.muS),
  };
}

/**
 * One step of the block's motion.
 *
 * The delicate part is stopping. Integrating a = (drive − μ_k·N·sign v)/m
 * naively makes a block that should have settled chatter across v = 0 forever,
 * flipping the friction direction every frame. So a step that would reverse the
 * velocity is treated as arriving at rest, and the block only sets off again if
 * the drive can beat static friction.
 */
export function advanceBlock(motion, options, dt) {
  const { position = 0, velocity = 0 } = motion;
  const solved = solveIncline({ ...options, velocity });

  if (solved.state === "static") {
    return { position, velocity: 0, solved };
  }

  let nextVelocity = velocity + solved.acceleration * dt;

  // Crossed zero this step: it has stopped, unless the drive can restart it.
  if (velocity !== 0 && nextVelocity * velocity < 0) {
    const atRest = solveIncline({ ...options, velocity: 0 });
    if (atRest.state === "static") {
      return { position, velocity: 0, solved: atRest };
    }
    nextVelocity = 0;
  }

  let nextPosition = position + nextVelocity * dt;

  // The ramp has ends. Hitting one stops the block dead rather than letting it
  // sail off into empty space.
  const limit = RAMP_LENGTH_M / 2;
  if (nextPosition <= -limit) {
    nextPosition = -limit;
    if (nextVelocity < 0) nextVelocity = 0;
  } else if (nextPosition >= limit) {
    nextPosition = limit;
    if (nextVelocity > 0) nextVelocity = 0;
  }

  return { position: nextPosition, velocity: nextVelocity, solved };
}

/**
 * The applied pull that would just hold the block still, in newtons.
 *
 * Not a single number but a window: anything between these two is held by
 * static friction. The window has width 2μ_s·N and shuts completely on a
 * frictionless surface, which is why Teflon needs an exact answer.
 */
export function holdingRange({ massKg = 10, angleDeg = 20, surface = "wood", g = G }) {
  const s = surfaceFor(surface);
  const { parallel, perpendicular } = weightComponents(massKg, angleDeg, g);
  const grip = maxStaticFriction(s.muS, perpendicular);
  return { min: parallel - grip, max: parallel + grip, ideal: parallel, grip };
}
