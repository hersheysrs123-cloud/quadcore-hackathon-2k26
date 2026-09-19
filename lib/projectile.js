// ─── Projectile motion with air resistance ───────────────────────────
// The trajectory integrator behind the projectile scene.
//
// It lives in `lib/` because the HUD readout needs the same flight the
// scene draws. It used to guess instead: it estimated the range as the
// vacuum range times (1 − min(0.65, 10k)) and put the apex at a hardcoded
// 44% of it, so the panel and the curve beside it disagreed by metres.
//
// Nothing here touches React or three.js.
// ─────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

/** Integrator step, and the longest flight worth following (a lunar lob). */
export const SIM_DT = 0.004;
export const SIM_MAX_TIME = 60;

/**
 * Integrates the flight until it returns to the ground.
 *
 * Drag is quadratic (F = −k|v|v), not linear: at the speeds a thrown or
 * launched object actually reaches, that is the regime that applies, and it
 * is what makes the trajectory visibly asymmetric — the fall is steeper than
 * the climb, which no textbook parabola ever shows.
 *
 * Returns the summary numbers the readout prints, plus the sampled path the
 * scene draws and flat velocity arrays the vector arrows read. Sample i is
 * simply t = i·SIM_DT.
 */
export function simulateFlight(speed, angleDeg, gravity, drag, mass) {
  const angle = angleDeg * DEG;
  let vx = speed * Math.cos(angle);
  let vy = speed * Math.sin(angle);
  let x = 0;
  let y = 0;
  let t = 0;
  const points = [[0, 0, 0]];
  // Flat typed arrays rather than one object per step: a long lunar flight is
  // 15 000 steps, this runs twice (with drag and without), and it re-runs on
  // every frame of a slider drag.
  const cap = Math.round(SIM_MAX_TIME / SIM_DT) + 2;
  const sx = new Float32Array(cap);
  const sy = new Float32Array(cap);
  const svx = new Float32Array(cap);
  const svy = new Float32Array(cap);
  svx[0] = vx;
  svy[0] = vy;
  let n = 1;
  let apex = 0;
  let apexX = 0;

  while (t < SIM_MAX_TIME && n < cap) {
    const v = Math.hypot(vx, vy);
    const k = drag / Math.max(mass, 0.05);
    const ax = -k * v * vx;
    const ay = -gravity - k * v * vy;

    vx += ax * SIM_DT;
    vy += ay * SIM_DT;
    const nx = x + vx * SIM_DT;
    const ny = y + vy * SIM_DT;
    t += SIM_DT;

    if (ny < 0) {
      // Land exactly on the ground rather than a step below it, so the range
      // readout does not jitter with the integrator's step size.
      const f = y / (y - ny || 1);
      x += (nx - x) * f;
      y = 0;
      points.push([x, 0, 0]);
      sx[n] = x;
      sy[n] = 0;
      svx[n] = vx;
      svy[n] = vy;
      n += 1;
      break;
    }

    x = nx;
    y = ny;
    if (y > apex) {
      apex = y;
      apexX = x;
    }
    // Every step would be 15 000 points for a long flight; every eighth is
    // still smooth at this scale.
    if (n % 8 === 0) points.push([x, y, 0]);
    sx[n] = x;
    sy[n] = y;
    svx[n] = vx;
    svy[n] = vy;
    n += 1;
  }

  const last = n - 1;
  return {
    points,
    sx,
    sy,
    svx,
    svy,
    count: n,
    range: sx[last],
    apex,
    apexX,
    // The landing step is interpolated, so the true flight time sits a
    // fraction of a step before the last recorded index.
    flightTime: last * SIM_DT,
    impactSpeed: Math.hypot(svx[last], svy[last]),
  };
}

/**
 * The textbook vacuum flight, for the dashed comparison curve.
 *
 * Worth having in closed form beside the integrator: it is what the readout
 * quotes as "ideal", and it is the check that the integrator is right.
 */
export function idealFlight(speed, angleDeg, gravity) {
  const angle = angleDeg * DEG;
  const sin = Math.sin(angle);
  return {
    range: (speed * speed * Math.sin(2 * angle)) / gravity,
    apex: (speed * speed * sin * sin) / (2 * gravity),
    flightTime: (2 * speed * sin) / gravity,
  };
}
