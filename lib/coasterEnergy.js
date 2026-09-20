// ─── Roller coaster · conservation of mechanical energy ─────────────
// A drop, a vertical loop and a braking straight, with the cart's speed read
// off the energy budget rather than integrated from forces.
//
// Doing it that way is the point: GPE + KE is constant on the ideal track, so
// the speed at any height follows from the release height alone and nothing
// else — not the mass, not the shape of the drop. Friction is then the one
// thing that spoils it, and it does so by moving energy into a third box that
// never comes back.
// ─────────────────────────────────────────────────────────────────────

export const G = 9.81;

/** Horizontal run of the first drop, metres. */
export const DROP_RUN = 34;
/** Flat approach between the drop and the loop, metres. */
export const APPROACH = 12;
/** Flat run after the loop, before the brakes bite. */
export const RUN_OUT = 8;
/** Length of the braking section, metres. */
export const BRAKE_RUN = 26;

/**
 * Rolling resistance plus air drag, lumped into one coefficient.
 *
 * Applied against the true normal force rather than mg, so the inside of the
 * loop — where the rail is pressing on the wheels at several g — costs far
 * more energy per metre than the flat does. That is real, and it is why a
 * loop is expensive to a coaster's energy budget.
 */
export const STEEL_ON_STEEL = 0.016;
/** Friction coefficient while the brake fins are engaged. */
export const BRAKE_MU = 0.85;

/** Steps used to lay out the centreline. More is smoother, not more accurate. */
const DROP_STEPS = 150;
const LOOP_STEPS = 220;
const FLAT_STEPS = 40;

/**
 * The track centreline, as a polyline with everything the sim needs sampled
 * along it.
 *
 * Curvature is measured off the finished polyline rather than written down
 * per segment, so the crest of the drop gets its real (negative) curvature
 * instead of being treated as straight — which is what lets the scene show
 * airtime on the hill as well as at the top of the loop.
 */
export function buildTrack({ releaseHeight = 25, loopRadius = 8 }) {
  const h0 = Math.max(releaseHeight, 1);
  const R = Math.max(loopRadius, 1);
  const pts = [];

  // 1 · The drop: a raised-cosine, so it leaves the station level and arrives
  //     level rather than kinking at either end.
  for (let i = 0; i <= DROP_STEPS; i += 1) {
    const t = i / DROP_STEPS;
    pts.push([t * DROP_RUN, (h0 / 2) * (1 + Math.cos(Math.PI * t))]);
  }

  // 2 · Flat approach.
  const xApproach = DROP_RUN;
  for (let i = 1; i <= FLAT_STEPS; i += 1) {
    pts.push([xApproach + (i / FLAT_STEPS) * APPROACH, 0]);
  }

  // 3 · The loop. A true circle, because that is the shape v_top = √(gR)
  //     describes; real coasters use clothoids precisely to avoid the g-force
  //     at the bottom that a circle of this radius implies.
  const xLoop = xApproach + APPROACH;
  for (let i = 1; i <= LOOP_STEPS; i += 1) {
    const a = -Math.PI / 2 + (i / LOOP_STEPS) * Math.PI * 2;
    pts.push([xLoop + Math.cos(a) * R, R + Math.sin(a) * R]);
  }

  // 4 · Run-out, then the brakes.
  for (let i = 1; i <= FLAT_STEPS; i += 1) {
    pts.push([xLoop + (i / FLAT_STEPS) * RUN_OUT, 0]);
  }
  const xBrake = xLoop + RUN_OUT;
  for (let i = 1; i <= FLAT_STEPS; i += 1) {
    pts.push([xBrake + (i / FLAT_STEPS) * BRAKE_RUN, 0]);
  }

  // ── Arc length, tangents, normals and curvature along the finished line.
  const n = pts.length;
  const s = new Float64Array(n);
  const height = new Float64Array(n);
  const normalY = new Float64Array(n);
  const curvature = new Float64Array(n);

  for (let i = 1; i < n; i += 1) {
    s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  for (let i = 0; i < n; i += 1) height[i] = pts[i][1];

  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(i - 1, 0)];
    const b = pts[i];
    const c = pts[Math.min(i + 1, n - 1)];
    const tx = c[0] - a[0];
    const ty = c[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    // Normal is the tangent turned a quarter turn anticlockwise, so on level
    // track it points straight up — the direction the rail supports from.
    normalY[i] = tx / len;

    // Signed curvature from three consecutive points: positive when the track
    // turns toward that normal, which is what makes the loop positive and the
    // crest of the hill negative.
    const d1x = b[0] - a[0];
    const d1y = b[1] - a[1];
    const d2x = c[0] - b[0];
    const d2y = c[1] - b[1];
    const cross = d1x * d2y - d1y * d2x;
    const l1 = Math.hypot(d1x, d1y);
    const l2 = Math.hypot(d2x, d2y);
    const l3 = Math.hypot(c[0] - a[0], c[1] - a[1]);
    curvature[i] = l1 * l2 * l3 > 1e-9 ? (2 * cross) / (l1 * l2 * l3) : 0;
  }

  const loopEntryIndex = DROP_STEPS + FLAT_STEPS + 1;
  const loopTopIndex = loopEntryIndex + Math.round(LOOP_STEPS / 2);
  const brakeStartIndex = n - FLAT_STEPS;

  return {
    points: pts,
    s,
    height,
    normalY,
    curvature,
    length: s[n - 1],
    releaseHeight: h0,
    loopRadius: R,
    loopEntryS: s[loopEntryIndex],
    loopTopS: s[loopTopIndex],
    loopExitS: s[loopEntryIndex + LOOP_STEPS],
    loopTopHeight: 2 * R,
    brakeStartS: s[brakeStartIndex],
  };
}

/**
 * How far the track steps sideways across the loop, metres.
 *
 * A vertical loop drawn flat closes on itself: the rails that leave it lie
 * exactly on the rails that entered, at the bottom. Real loops are helical —
 * the exit is displaced by more than the width of the track — and the physics
 * is untouched by it, because the centreline is still a circle in the plane of
 * the ride. Only the picture needs the offset.
 */
export const LOOP_OFFSET_M = 2.2;

/**
 * Sideways position of the track at arc position `at`, metres: zero until the
 * loop, a smooth step across it, and the full offset from the exit on.
 */
export function lateralAt(track, at) {
  const span = track.loopExitS - track.loopEntryS;
  if (span <= 1e-9) return 0;
  const t = Math.min(Math.max((at - track.loopEntryS) / span, 0), 1);
  return LOOP_OFFSET_M * t * t * (3 - 2 * t);
}

/** Linear interpolation of a sampled field at arc position `at`. */
export function sampleAt(track, field, at) {
  const { s } = track;
  const n = s.length;
  const x = Math.min(Math.max(at, 0), s[n - 1]);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid] <= x) lo = mid;
    else hi = mid;
  }
  const span = s[hi] - s[lo];
  const t = span > 1e-9 ? (x - s[lo]) / span : 0;
  return field[lo] + (field[hi] - field[lo]) * t;
}

/** Position on the centreline at arc position `at`. */
export function positionAt(track, at) {
  const { s, points } = track;
  const n = s.length;
  const x = Math.min(Math.max(at, 0), s[n - 1]);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid] <= x) lo = mid;
    else hi = mid;
  }
  const span = s[hi] - s[lo];
  const t = span > 1e-9 ? (x - s[lo]) / span : 0;
  return [
    points[lo][0] + (points[hi][0] - points[lo][0]) * t,
    points[lo][1] + (points[hi][1] - points[lo][1]) * t,
  ];
}

/**
 * The least release height that gets a cart round the loop, metres.
 *
 * From v² ≥ gR at a height of 2R: ½v² = g(h − 2R) gives h ≥ 2.5R. The number
 * every student should be able to reconstruct, and it does not involve the
 * mass — the scene's mass slider is there partly to prove that.
 */
export const minimumReleaseHeight = (loopRadius) => 2.5 * loopRadius;

/** Speed needed at the very top of the loop to stay on the rail, m/s. */
export const minimumTopSpeed = (loopRadius, g = G) => Math.sqrt(g * loopRadius);

/**
 * The force the rail exerts on the cart, newtons.
 *
 * The centripetal requirement mv²κ has to be met by the rail and gravity
 * together, so N = mv²κ + mg·n̂y. At the top of a loop n̂ points down and this
 * collapses to the familiar N = mv²/R − mg; on the flat it collapses to mg.
 * A negative answer means the rail would have to PULL to keep the cart on it,
 * which a wheel running on the inside of a rail cannot do.
 */
export function railForce(mass, speed, curvature, normalY, g = G) {
  return mass * speed * speed * curvature + mass * g * normalY;
}

/** What the passengers feel, in multiples of their own weight. */
export const gForce = (railN, mass, g = G) => railN / (mass * g);

/** Speed from the energy budget: v² = 2(E_mech/m − gh). */
export function speedFrom(mechanical, mass, height, g = G) {
  const v2 = 2 * (mechanical / mass - g * height);
  return v2 > 0 ? Math.sqrt(v2) : 0;
}

/** How far along the track to look when deciding which way is downhill. */
const SLOPE_PROBE = 0.4;

/**
 * Smallest speed a cart leaving a turning point is given, m/s.
 *
 * Speed here is read off the energy budget rather than integrated, which makes
 * a cart holding exactly zero kinetic energy a fixed point: it cannot move, so
 * it cannot lose height, so it never acquires any speed to move with. A cart
 * that failed the loop used to hang motionless on the rail instead of rolling
 * back down it. Leaving the turning point at the speed the budget allows one
 * probe length downhill — never less than this — is what breaks that deadlock.
 */
const ROLLBACK_FLOOR = 0.05;

/**
 * Speed the lift chain hands the cart over with, m/s.
 *
 * Not a fudge factor. The crest of the drop is level BY CONSTRUCTION — the
 * raised-cosine profile arrives there with zero gradient so the track does not
 * kink — and a cart released at rest on level track has no force along the
 * rail at all, so it would sit there for ever. Real lift hills have exactly
 * this problem and solve it exactly this way, by walking the train over the
 * crest under chain before letting go.
 */
export const RELEASE_SPEED = 0.8;

/** A cart at the top of the drop, holding almost nothing but potential energy. */
export function startRun({ track, mass }) {
  return {
    s: 0,
    direction: 1,
    mechanical: mass * G * track.height[0] + 0.5 * mass * RELEASE_SPEED * RELEASE_SPEED,
    thermal: 0,
    leftTrack: false,
    stopped: false,
  };
}

/**
 * One step along the track.
 *
 * Speed comes from the energy budget rather than from integrating a = F/m,
 * which keeps the total exactly conserved on the ideal track instead of
 * drifting a few percent over a run and quietly undermining the whole lesson.
 */
export function stepRun(state, track, { mass = 500, friction = true, g = G }, dt) {
  const height = sampleAt(track, track.height, state.s);
  const curvature = sampleAt(track, track.curvature, state.s);
  const normalY = sampleAt(track, track.normalY, state.s);

  let { direction, mechanical, thermal, leftTrack, stopped } = state;

  const speed = speedFrom(mechanical, mass, height, g);
  const railN = railForce(mass, speed, curvature, normalY, g);

  // Losing contact means the rail is being asked to pull the cart inward.
  if (railN < 0) leftTrack = true;

  // A cart that has run out of energy on a rise rolls back down it. The speed
  // it travels at has to come from where it is GOING rather than from where it
  // is: standing at a turning point it has none, and the budget would keep
  // handing it none for ever.
  let travelSpeed = speed;
  if (speed <= 1e-3) {
    if (sampleAt(track, track.height, state.s + direction * SLOPE_PROBE) > height + 1e-6) {
      direction = -direction;
    }
    const downhill = sampleAt(track, track.height, state.s + direction * SLOPE_PROBE);
    if (downhill < height - 1e-6) {
      travelSpeed = Math.max(speedFrom(mechanical, mass, downhill, g), ROLLBACK_FLOOR);
      stopped = false;
    } else {
      // Out of energy with nowhere lower to go: it has genuinely come to rest.
      stopped = true;
    }
  } else {
    stopped = false;
  }

  const ds = direction * travelSpeed * dt;
  let s = state.s + ds;

  if (friction) {
    const inBrakes = state.s >= track.brakeStartS;
    const mu = inBrakes ? BRAKE_MU : STEEL_ON_STEEL;
    const lost = mu * Math.abs(railN) * Math.abs(ds);
    // Never take out more than the kinetic energy actually present, or the
    // budget goes negative and the cart acquires an imaginary speed.
    const kinetic = Math.max(mechanical - mass * g * height, 0);
    const taken = Math.min(lost, kinetic);
    mechanical -= taken;
    thermal += taken;
  }

  // The ends of the track are ends, not cliffs.
  if (s <= 0) {
    s = 0;
    direction = 1;
  } else if (s >= track.length) {
    s = track.length;
    direction = -1;
  }

  return { s, direction, mechanical, thermal, leftTrack, stopped, speed, railN };
}

/**
 * Everything the readouts need at the cart's current position.
 *
 * Split out from the stepper so the HUD can describe a track the cart has not
 * been driven along yet — the panel is useful before anything is animating.
 */
export function describeRun({ track, state, mass, g = G }) {
  const height = sampleAt(track, track.height, state.s);
  const curvature = sampleAt(track, track.curvature, state.s);
  const normalY = sampleAt(track, track.normalY, state.s);
  const speed = speedFrom(state.mechanical, mass, height, g);
  const railN = railForce(mass, speed, curvature, normalY, g);

  const gpe = mass * g * height;
  const ke = Math.max(state.mechanical - gpe, 0);

  const topSpeed = speedFrom(state.mechanical, mass, track.loopTopHeight, g);
  const needed = minimumTopSpeed(track.loopRadius, g);

  return {
    height,
    speed,
    railN,
    gForce: gForce(railN, mass, g),
    gpe,
    ke,
    thermal: state.thermal,
    total: state.mechanical + state.thermal,
    /** Speed the cart would have at the top of the loop with what it has now. */
    topSpeed,
    neededTopSpeed: needed,
    clearsLoop: topSpeed >= needed,
    minimumHeight: minimumReleaseHeight(track.loopRadius),
    onLoop: state.s >= track.loopEntryS && state.s <= track.loopExitS,
    pastLoop: state.s > track.loopExitS,
    inBrakes: state.s >= track.brakeStartS,
    leftTrack: state.leftTrack,
  };
}

/**
 * What the badge should say about the loop.
 *
 * `clears` is the frictionless answer from the release height alone. With
 * friction on it is not the whole story — the badge used to report "clears the
 * loop, 5 m/s at the top, needed 8.9" in the same breath — so the live budget
 * (`clearsLoop`, from the energy the cart still has) has the last word until
 * the cart is actually round.
 */
export function loopVerdict(live, { friction = false, clears = true } = {}) {
  if (live.leftTrack) return "derailed";
  if (live.pastLoop) return "cleared";
  if (!clears) return "too-low";
  if (friction && !live.clearsLoop) return "friction";
  return "clears";
}
