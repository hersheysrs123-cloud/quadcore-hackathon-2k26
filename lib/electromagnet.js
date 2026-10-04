// ─── Electromagnets ─────────────────────────────────────────────────
// The magnetic effect of a current, for the induction topic's third
// apparatus: the same coil on its bobbin, now driven by a bench supply,
// with an optional core of soft iron or steel.
//
//   • The field of the coil: B = μ₀ N I / √(L² + 4R²) at its centre (a
//     finite solenoid), so doubling the current or the turns doubles it.
//   • A core multiplies it. An open rod cannot multiply it by its full μr:
//     its own poles push back (the demagnetising field), so a stubby rod
//     like this one gains about ×8 (soft iron) or ×6 (steel), and both
//     saturate in the end.
//   • When the current stops, soft iron keeps almost nothing; steel keeps
//     about half — a permanent magnet. Only a field stronger than the
//     steel's coercivity rewrites what it holds.
//   • The field everywhere on the card through the axis, for the filings,
//     compasses and field lines, from rings of current (the exact field of
//     a current loop, via elliptic integrals): the winding is one set of
//     rings, and a magnetised core is another (its equivalent surface
//     current).
//
// Nothing here touches React or three.js.
// ─────────────────────────────────────────────────────────────────────

export const MU0 = 4e-7 * Math.PI;

/** One scene unit is 4 cm. */
export const UNIT_M = 0.04;

/** The coil, in scene units: the bobbin the induction scene's solenoid is wound on. */
export const COIL = { half: 0.75, radius: 0.96 };
/** The core rod, in scene units: it stands out of both ends of the coil. */
export const CORE = { half: 1.6, radius: 0.55 };

export const TURN_RANGE = [100, 500];
export const CURRENT_RANGE = [0, 3];

/**
 * gain: apparent permeability of this rod (its μr cut down by its own
 * demagnetising field); remanence: the share of its magnetisation it keeps
 * when the current stops; coerciveT: the field it takes to rewrite that;
 * saturationT: where it stops gaining.
 */
export const CORES = {
  air: { label: "No core (air)", gain: 1, remanence: 0, coerciveT: 0, saturationT: Infinity, colour: null },
  softIron: { label: "Soft iron", gain: 8, remanence: 0.02, coerciveT: 0.0005, saturationT: 1.6, colour: "#59616d" },
  steel: { label: "Steel", gain: 6, remanence: 0.45, coerciveT: 0.012, saturationT: 1.4, colour: "#8ea4b9" },
};
export const CORE_KEYS = Object.keys(CORES);

/** The colours the scene draws with, which the Details panel's key names. */
export const EM_COLOURS = {
  copper: "#ea580c",
  charge: "#fef08a",
  north: "#f43f5e",
  south: "#3b82f6",
  filing: "#30343b",
  fieldLine: "#38bdf8",
  card: "#f1f5f9",
  clip: "#cbd5e1",
  leadPos: "#dc2626",
  leadNeg: "#1f2937",
  needleN: "#ef4444",
  needleS: "#f8fafc",
};

/** The Earth's horizontal field, which a plotting compass follows when nothing else is there. */
export const EARTH_FIELD_T = 2e-5;

/** The pole field one small steel clip needs to hang another below it. */
export const B_PER_CLIP = 0.0125;
export const MAX_CLIPS = 6;

/** Field a filing needs before tapping the card lines it up. */
export const FILING_THRESHOLD_T = 6e-4;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** B at the centre of the coil with no core: a finite solenoid. Signed: + along +x. */
export function airField(turns, current) {
  const L = 2 * COIL.half * UNIT_M;
  const R = COIL.radius * UNIT_M;
  return (MU0 * turns * current) / Math.hypot(L, 2 * R);
}

/** What a core makes of the coil's field: its gain, saturating. Signed. */
export function coreField(bAir, core) {
  const c = CORES[core] ?? CORES.air;
  if (!Number.isFinite(c.saturationT)) return bAir * c.gain;
  return c.saturationT * Math.tanh((bAir * c.gain) / c.saturationT);
}

/** Clips the pole can hold in a chain, each magnetised by the one above it. */
export const clipsHeld = (poleT) => Math.min(MAX_CLIPS, Math.floor(Math.abs(poleT) / B_PER_CLIP + 1e-9));

/**
 * The electromagnet at one setting.
 *
 * `retained` is the signed field at the centre that the core kept the last
 * time the current changed (the scene remembers it: it is history, not a
 * setting). Returns `retainedNext`, what the core will keep from now on.
 */
export function solveElectromagnet({ turns = 300, current = 1.5, reverse = false, core = "softIron", on = true, retained = 0 } = {}) {
  const c = CORES[core] ? core : "air";
  const props = CORES[c];
  const N = clamp(Math.round(turns || 0), TURN_RANGE[0], TURN_RANGE[1]);
  const I = on ? clamp(Number(current) || 0, CURRENT_RANGE[0], CURRENT_RANGE[1]) : 0;
  const sign = reverse ? -1 : 1;
  const air = sign * airField(N, I);
  const driven = coreField(air, c);
  // The core always answers the coil's field. Below its coercivity it also
  // keeps what it had; above it, the new magnetisation replaces the old.
  const rewrites = on && Math.abs(driven) >= props.coerciveT;
  const held = c === "air" ? 0 : Number(retained) || 0;
  const centre = rewrites ? driven : driven + held;
  const retainedNext = rewrites ? props.remanence * driven : held;
  // At the end of a long magnetised rod the field is about half the centre's.
  const pole = centre / 2;
  const clips = clipsHeld(pole);
  const tiny = 1e-7;
  return {
    core: c,
    coreLabel: props.label,
    turns: N,
    current: I,
    on,
    reverse,
    ampereTurns: N * I,
    airT: air,
    centreT: centre,
    poleT: pole,
    gain: Math.abs(air) > tiny ? centre / air : null,
    clips,
    retainedNext,
    permanent: !on && Math.abs(centre) > tiny,
    // The end the field comes out of is the north pole (right-hand grip rule).
    north: Math.abs(centre) <= tiny ? null : centre > 0 ? "right" : "left",
  };
}

// ─── The field on the card through the axis ─────────────────────────

/** Complete elliptic integrals K(m) and E(m), m = k², by the AGM. */
export function ellipticKE(m) {
  let a = 1;
  let b = Math.sqrt(Math.max(0, 1 - m));
  let c2sum = m / 2;
  let pow = 0.5;
  for (let i = 0; i < 24 && Math.abs(a - b) > 1e-12; i += 1) {
    const an = (a + b) / 2;
    const c = (a - b) / 2;
    b = Math.sqrt(a * b);
    a = an;
    pow *= 2;
    c2sum += pow * c * c;
  }
  const K = Math.PI / (2 * a);
  return { K, E: K * (1 - c2sum) };
}

/**
 * Field of one current loop (radius `a`, at axial `x0`, unit current, μ₀/2π
 * dropped) at axial x and radial ρ ≥ 0: { bx, br }.
 */
export function loopField(a, x0, x, rho) {
  const dx = x - x0;
  if (rho < 1e-9) return { bx: (Math.PI * a * a) / Math.pow(a * a + dx * dx, 1.5), br: 0 };
  const sum2 = (a + rho) ** 2 + dx * dx;
  const diff2 = Math.max((a - rho) ** 2 + dx * dx, 1e-6);
  const { K, E } = ellipticKE(Math.min((4 * a * rho) / sum2, 0.999999));
  const s = Math.sqrt(sum2);
  return {
    bx: (K + ((a * a - rho * rho - dx * dx) / diff2) * E) / s,
    br: (dx / (rho * s)) * (-K + ((a * a + rho * rho + dx * dx) / diff2) * E),
  };
}

const RINGS = 24;

/** A solenoid of RINGS loops from −half to +half: its field at (x, ρ), unit current per loop. */
function ringsField(half, radius, x, rho) {
  let bx = 0;
  let br = 0;
  for (let i = 0; i < RINGS; i += 1) {
    const x0 = -half + ((i + 0.5) / RINGS) * 2 * half;
    const f = loopField(radius, x0, x, rho);
    bx += f.bx;
    br += f.br;
  }
  return { bx, br };
}

const COIL_CENTRE = ringsField(COIL.half, COIL.radius, 0, 0).bx;
const CORE_CENTRE = ringsField(CORE.half, CORE.radius, 0, 0).bx;

/**
 * B in tesla at (x, z) on the card (scene units, the axis along x, z
 * across it): { bx, bz }. The coil's rings carry the air field at the
 * centre; the core's rings carry the rest.
 */
export function fieldAt(x, z, { airT, centreT, core }) {
  const rho = Math.abs(z);
  const coil = ringsField(COIL.half, COIL.radius, x, rho);
  let bx = (coil.bx / COIL_CENTRE) * airT;
  let br = (coil.br / COIL_CENTRE) * airT;
  const extra = centreT - airT;
  if (core && core !== "air" && extra !== 0) {
    const rod = ringsField(CORE.half, CORE.radius, x, rho);
    bx += (rod.bx / CORE_CENTRE) * extra;
    br += (rod.br / CORE_CENTRE) * extra;
  }
  return { bx, bz: z < 0 ? -br : br };
}

/** Is (x, z) inside the coil or the core, where the card is cut away? */
export function inFootprint(x, z, margin = 0) {
  const inCoil = Math.abs(x) < COIL.half + 0.06 + margin && Math.abs(z) < 1.2 + margin;
  const inCore = Math.abs(x) < CORE.half + 0.03 + margin && Math.abs(z) < CORE.radius + 0.03 + margin;
  return inCoil || inCore;
}

/**
 * A field line on the card, traced from (x, z) along B (or against it with
 * dir = −1) until it reaches the cut-out, leaves the card or runs `maxLen`.
 * `bounds` is the card: [half-width in x, back edge z, front edge z].
 */
export function traceFieldLine(x, z, field, { dir = 1, step = 0.06, maxLen = 16, bounds = [4.4, -2.0, 2.0] } = {}) {
  const pts = [[x, z]];
  let px = x;
  let pz = z;
  for (let s = 0; s < maxLen; s += step) {
    const a = fieldAt(px, pz, field);
    const m = Math.hypot(a.bx, a.bz);
    if (m < 1e-12) break;
    // midpoint step
    const mx = px + ((dir * a.bx) / m) * step * 0.5;
    const mz = pz + ((dir * a.bz) / m) * step * 0.5;
    const b = fieldAt(mx, mz, field);
    const n = Math.hypot(b.bx, b.bz) || 1;
    px += ((dir * b.bx) / n) * step;
    pz += ((dir * b.bz) / n) * step;
    if (Math.abs(px) > bounds[0] || pz < bounds[1] || pz > bounds[2]) break;
    pts.push([px, pz]);
    if (s > step * 3 && inFootprint(px, pz)) break;
  }
  return pts;
}
