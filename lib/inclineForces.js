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

/** How long the drawn ramp is, in metres. */
export const RAMP_LENGTH_M = 4;

/**
 * How far the crate's CENTRE can travel either way from the middle of the ramp
 * before the crate itself meets a stop: half the ramp (2 m), less half the
 * crate's length (0.30 m) and the thickness of the stop (0.08 m). It was half
 * the ramp, which let the centre reach the end and left the picture holding the
 * crate back 0.3 m short of where the physics said it had stopped.
 */
export const TRAVEL_LIMIT_M = 1.62;

/** Below this speed the block counts as at rest and static friction takes over. */
export const REST_SPEED = 1e-4;

/**
 * Coefficients for the three surface pairings the control offers.
 *
 * `muS` values are the ones the syllabus quotes, and `muK` is never larger.
 * Where the two differ that gap is not a rounding detail — it is why a block
 * lurches the instant it breaks away instead of easing into motion. Teflon is
 * the exception that proves it: its two coefficients are equal, so it is the
 * one surface here that slides away smoothly rather than snatching.
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
 * The block's situation right now: `solveIncline`, except that a block pressed
 * against an end stop is held by it.
 *
 * The stop is a force like any other. Pinned against it the block is at rest,
 * the resultant is zero, and the diagram only balances if the stop's push is
 * drawn: `stopForce` is that push, signed like every force here (positive up
 * the slope) and equal and opposite to whatever the drive and friction leave
 * over. Friction stays at the value it had while the block was sliding in.
 */
export function solveMotion(options, { position = 0, velocity = 0 } = {}) {
  const raw = solveIncline({ ...options, velocity });
  const top = position >= TRAVEL_LIMIT_M - 1e-4 && (velocity > 0 || raw.netForce > 0);
  const bottom = position <= -TRAVEL_LIMIT_M + 1e-4 && (velocity < 0 || raw.netForce < 0);
  if (!top && !bottom) return raw;
  return {
    ...raw,
    stopForce: -raw.netForce,
    netForce: 0,
    acceleration: 0,
    state: "held by stop",
    isStatic: false,
    atBarrier: top ? "top" : "bottom",
  };
}

/**
 * One step of the block's motion.
 *
 * Whenever the block is moving the force on it is constant (kinetic friction
 * does not depend on speed), so the step is the exact constant-acceleration
 * one — x + vΔt + ½aΔt² — rather than an approximation that drifts with the
 * frame time. That also makes the speed it arrives at a stop exact, v² = u² +
 * 2as, and `hitTime` says how far into the step it got there.
 *
 * The delicate part is stopping. Integrating a = (drive − μ_k·N·sign v)/m
 * naively makes a block that should have settled chatter across v = 0 forever,
 * flipping the friction direction every frame. So a step that would reverse the
 * velocity is treated as arriving at rest, and the block only sets off again if
 * the drive can beat static friction.
 */
export function advanceBlock(motion, options, dt) {
  const { position = 0, velocity = 0 } = motion;
  const limit = TRAVEL_LIMIT_M;

  const solved = solveMotion(options, { position, velocity });

  if (solved.atBarrier) {
    // Pressed against the stop: the stop's reaction keeps the block at rest.
    return {
      position: solved.atBarrier === "top" ? limit : -limit,
      velocity: 0,
      arrivalVelocity: 0,
      hitBarrier: true,
      hitTime: 0,
      solved,
    };
  }
  if (solved.state === "static") {
    return { position, velocity: 0, solved };
  }

  const a = solved.acceleration;
  let nextVelocity = velocity + a * dt;

  // Crossed zero this step: it has stopped, unless the drive can restart it.
  if (velocity !== 0 && nextVelocity * velocity < 0) {
    const atRest = solveIncline({ ...options, velocity: 0 });
    // It stops after v²/2|a|, not after a whole step's worth of travel.
    const stopped = position - (velocity * velocity) / (2 * a);
    if (atRest.state === "static") {
      return { position: stopped, velocity: 0, arrivalVelocity: 0, hitBarrier: false, solved: atRest };
    }
    return { position: stopped, velocity: 0, arrivalVelocity: 0, hitBarrier: false, solved };
  }

  const nextPosition = position + velocity * dt + 0.5 * a * dt * dt;

  // The ramp has ends. Hitting one stops the block dead rather than letting it
  // sail off into empty space.
  const end = nextPosition >= limit ? limit : nextPosition <= -limit ? -limit : null;
  if (end !== null) {
    const distance = end - position;
    const arrival = Math.sign(distance) * Math.sqrt(Math.max(0, velocity * velocity + 2 * a * distance));
    // Time to cover `distance`: from v_arrival = v + a·t, or straight division
    // if the block is coasting with no net force.
    const hitTime = Math.abs(a) > 1e-12 ? (arrival - velocity) / a : distance / velocity;
    return {
      position: end,
      velocity: 0,
      arrivalVelocity: arrival,
      hitBarrier: true,
      hitTime: Math.min(Math.max(hitTime, 0), dt),
      solved,
    };
  }

  return { position: nextPosition, velocity: nextVelocity, arrivalVelocity: nextVelocity, hitBarrier: false, solved };
}

/**
 * What will happen when the block is let go from the middle of the ramp: does
 * it move, which way, and how long and how fast until it meets a stop.
 *
 * Sliding is at constant acceleration, so this is closed-form: t = √(2d/|a|)
 * and v = √(2|a|d) over the travel d. The velocity graph uses it to fix its
 * axes before the run starts, instead of rescaling as the curve grows.
 */
export function slideForecast(options) {
  const rest = solveIncline({ ...options, velocity: 0 });
  if (rest.state === "static") {
    return { slides: false, direction: 0, acceleration: 0, timeToStop: null, impactSpeed: null };
  }
  const a = rest.acceleration;
  const d = TRAVEL_LIMIT_M;
  return {
    slides: true,
    direction: Math.sign(a),
    acceleration: a,
    timeToStop: Math.sqrt((2 * d) / Math.abs(a)),
    impactSpeed: Math.sqrt(2 * Math.abs(a) * d),
  };
}

const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10];

/** The smallest round number (1, 1.2, 1.5, 2 … × a power of ten) that is ≥ x. */
export function niceCeil(x) {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (NICE_STEPS.find((step) => step >= m - 1e-9) ?? 10) * p;
}

/**
 * The axes of the velocity graph, fixed for the whole run.
 *
 * A sliding block's velocity is a straight line from zero to its impact speed,
 * so the window is just past that time and speed. The block can only go one
 * way, so the zero line sits at the top for a slide down and at the bottom for
 * a pull up. A block that stays put gets a short, symmetric window.
 */
export function traceAxes(forecast) {
  if (!forecast.slides) return { tMax: 4, vMin: -2, vMax: 2 };
  const tMax = niceCeil(forecast.timeToStop * 1.04);
  const top = niceCeil(forecast.impactSpeed * 1.08);
  return forecast.direction > 0 ? { tMax, vMin: 0, vMax: top } : { tMax, vMin: -top, vMax: 0 };
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
