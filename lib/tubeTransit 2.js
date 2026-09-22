// ─── Tube transit ───────────────────────────────────────────────────
// The kinematics shared by the two "material moving through a tube under a
// driving force" scenes: the water column climbing a xylem vessel, and the
// food bolus squeezed along a muscular gut.
//
// Both scenes need the same three things and neither should own them:
//
//   1. a tube whose RADIUS varies along its length — the lignified rings
//      of a xylem vessel, the constriction of a peristaltic wave — built
//      from a base radius and a handful of smooth bumps;
//   2. a body that moves ALONG the tube at a speed the physics sets, with
//      a front that can be tracked and a cross-section it has to squeeze
//      into (a bolus is wider than the ring closing behind it — a water
//      column is not, and that difference is exactly what the two scenes
//      teach);
//   3. bookkeeping for a stream of particles that recycle from one end of
//      an OPEN tube to the other, which is what water flowing up a stem
//      looks like, and what the charge-carrier helper (a closed loop) does
//      not do.
//
// Everything here is pure: world units in, world units out, no three.js.
// ─────────────────────────────────────────────────────────────────────

/**
 * A smooth bump of unit height centred on `centre` with a half-width
 * `width` (the distance at which it has fallen to e⁻¹ ≈ 0.37). Every
 * profile in both scenes is a sum of these.
 */
export function bump(s, centre, width) {
  if (!(width > 0)) return 0;
  const x = (s - centre) / width;
  return Math.exp(-x * x);
}

/**
 * Radius of a tube at distance `s` along it, from a base radius and a list
 * of `{ centre, width, depth }` features. `depth` is the FRACTION of the
 * base radius to take away (positive — a constriction) or add (negative — a
 * dilation). The result never drops below `floor`, so a wave that "closes"
 * the lumen still leaves a sliver for the geometry to be built on.
 */
export function profileRadius(s, base, features = [], floor = 0.02) {
  let scale = 1;
  for (const f of features) scale -= f.depth * bump(s, f.centre, f.width);
  return Math.max(floor, base * scale);
}

/**
 * Sample a radius profile at `count` evenly spaced stations along a tube of
 * `length`. What a tube mesh builds its rings from.
 */
export function sampleProfile(length, count, radiusAt) {
  const out = new Array(count);
  const n = Math.max(2, count);
  for (let i = 0; i < n; i += 1) {
    const s = (i / (n - 1)) * length;
    out[i] = radiusAt(s);
  }
  return out;
}

/**
 * Periodic lignin thickenings along a xylem vessel: `pitch` apart, each one
 * standing `relief` proud of the wall. Positive `relief` means the wall
 * bulges INWARD (the rings narrow the lumen), which is how annular and
 * spiral thickening reads in a cutaway.
 */
export function lignifiedRings(length, pitch, relief, width = pitch * 0.18) {
  const rings = [];
  if (!(pitch > 0)) return rings;
  for (let s = pitch / 2; s < length; s += pitch) rings.push({ centre: s, width, depth: relief });
  return rings;
}

// ─── Moving a body along the tube ───────────────────────────────────

/**
 * Advance a front along an OPEN tube: `position + speed·dt`, clamped to
 * `[0, length]`. Returns the new position and whether the end was reached
 * this step — the caller decides what to do at the end (stop, recycle).
 */
export function advanceFront(position, speed, dt, length) {
  const next = position + speed * dt;
  if (next >= length) return { position: length, arrived: true };
  if (next <= 0) return { position: 0, arrived: false };
  return { position: next, arrived: false };
}

/**
 * Mean flow speed of an incompressible column through a tube: volume flow
 * rate divided by cross-section area. `flow` in units³/s, `radius` in units,
 * the answer in units/s. Zero area is treated as no flow, not infinite flow.
 */
export function columnSpeed(flow, radius) {
  const area = Math.PI * radius * radius;
  return area > 1e-12 ? flow / area : 0;
}

/**
 * A body of fixed volume squeezed into a tube whose local radius is `r`:
 * its cross-section can be no wider than the lumen, so its length grows to
 * conserve volume. Returns `{ radius, length }` for an ellipsoidal body of
 * rest radius `restRadius` and rest half-length `restHalf`.
 *
 * `compliance` (0–1) is how much of the squeeze the body actually takes:
 * a liquid takes all of it, a dry lump resists and springs the wall out
 * instead (so its radius exceeds the lumen and the tube stretches to fit).
 */
export function squeezeBody(restRadius, restHalf, r, compliance = 1) {
  const fitted = Math.min(restRadius, r);
  const radius = restRadius + (fitted - restRadius) * compliance;
  // Volume ∝ radius² × half-length.
  const half = (restRadius * restRadius * restHalf) / Math.max(1e-6, radius * radius);
  return { radius, length: 2 * half };
}

// ─── Recycling particle stream ──────────────────────────────────────

/**
 * Positions for `count` particles evenly spread along `[from, to]` of an
 * open tube, drifted by `phase` (in tube units) and recycled at the far end,
 * so a stream reads as continuous flow rather than a pulse.
 *
 * `front` (optional) is how far the column has got: particles beyond it are
 * reported as hidden — a filling vessel shows only the water that has
 * arrived. Writes into `out` (a Float32Array or array of length `count`)
 * and returns how many are visible.
 */
export function streamPositions(count, from, to, phase, out, front = Infinity) {
  const span = Math.max(1e-9, to - from);
  let visible = 0;
  for (let i = 0; i < count; i += 1) {
    const base = (i / count) * span;
    const s = from + (((base + phase) % span) + span) % span;
    if (s <= front) {
      out[i] = s;
      visible += 1;
    } else {
      out[i] = NaN;
    }
  }
  return visible;
}

/**
 * How far a stream drifts in `dt` at `speed`, kept within one span so the
 * modulo in `streamPositions` never sees a huge number.
 */
export function advancePhase(phase, speed, dt, span) {
  if (!(span > 0)) return 0;
  const next = phase + speed * dt;
  return ((next % span) + span) % span;
}

// ─── Tube mesh vertices ─────────────────────────────────────────────
// The deformable tube both scenes are drawn with is a stack of rings. The
// layout is fixed at build time (so the index buffer never changes); only
// the ring radii and centres are rewritten, in place, when the profile
// moves. This is the arithmetic; the React component wraps it in a
// BufferGeometry.

/** Vertices per ring: `segments` around plus one duplicate to close the UV seam. */
export const ringVertexCount = (segments) => segments + 1;

/** Total vertex count for a tube of `rings` rings. */
export const tubeVertexCount = (rings, segments) => rings * ringVertexCount(segments);

/**
 * Triangle indices for a tube of `rings` × `segments`, wound so that the
 * analytic normals from `writeTubeVertices` face OUTWARD.
 */
export function tubeIndices(rings, segments) {
  const perRing = ringVertexCount(segments);
  const out = new Uint32Array((rings - 1) * segments * 6);
  let k = 0;
  for (let i = 0; i < rings - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = i * perRing + j;
      const b = a + 1;
      const c = a + perRing + 1;
      const d = a + perRing;
      out[k++] = a;
      out[k++] = d;
      out[k++] = b;
      out[k++] = b;
      out[k++] = d;
      out[k++] = c;
    }
  }
  return out;
}

/**
 * Write positions, normals and UVs for a tube whose ring `i` sits at height
 * `station[i]` along +y with radius `radius[i]` and centre offset
 * (`centreX[i]`, `centreZ[i]`) — the offsets are optional and let a thin
 * "tube" ride along the surface of a fatter one (a longitudinal fibre on a
 * gut). UV `v` runs 0 → 1 along the length, scaled by `vRepeat`.
 *
 * Normals are analytic: the surface tangent along the tube (which includes
 * the slope of the radius) crossed with the tangent around it. That is what
 * keeps a constriction lit like a waist rather than a stack of discs.
 */
export function writeTubeVertices(
  { positions, normals, uvs },
  { rings, segments, station, radius, centreX = null, centreZ = null, vRepeat = 1 },
) {
  const perRing = ringVertexCount(segments);
  const twoPi = Math.PI * 2;
  for (let i = 0; i < rings; i += 1) {
    const s = station[i];
    const r = radius[i];
    const cx = centreX ? centreX[i] : 0;
    const cz = centreZ ? centreZ[i] : 0;

    // Slopes by central difference (one-sided at the ends).
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(rings - 1, i + 1);
    const ds = station[i1] - station[i0] || 1;
    const dr = (radius[i1] - radius[i0]) / ds;
    const dcx = centreX ? (centreX[i1] - centreX[i0]) / ds : 0;
    const dcz = centreZ ? (centreZ[i1] - centreZ[i0]) / ds : 0;

    const v = (i / (rings - 1)) * vRepeat;
    for (let j = 0; j <= segments; j += 1) {
      const theta = (j / segments) * twoPi;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const k = (i * perRing + j) * 3;
      positions[k] = cx + r * cosT;
      positions[k + 1] = s;
      positions[k + 2] = cz + r * sinT;

      // tAlong = (dcx + dr·cos, 1, dcz + dr·sin), tAround = (−sin, 0, cos);
      // n = tAlong × tAround = (cos, −(ax·cos + az·sin), sin).
      const ax = dcx + dr * cosT;
      const az = dcz + dr * sinT;
      const nx = cosT;
      const ny = -(ax * cosT + az * sinT);
      const nz = sinT;
      const len = Math.hypot(nx, ny, nz) || 1;
      normals[k] = nx / len;
      normals[k + 1] = ny / len;
      normals[k + 2] = nz / len;

      const uk = (i * perRing + j) * 2;
      uvs[uk] = j / segments;
      uvs[uk + 1] = v;
    }
  }
}
