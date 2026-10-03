// ─── Mitosis and meiosis: the choreography ──────────────────────────
// The pose channels of `lib/cellDivision.js` turned into placements: where
// every chromatid, centrosome, nucleus, cell lobe and organelle of the
// cell-division scene is, at any moment of the cycle. The scene
// (`MitosisMeiosisCanvas.jsx`) calls `choreograph` once a frame and its
// meshes copy the numbers out; nothing here knows about React.
//
// It is a module of its own so that a test can run the whole cycle frame
// by frame and check that nothing jumps between stages
// (`tests/unit/mitosis-choreography.test.mjs`). The places that need care:
//
//   anaphase → telophase   the kinetochore fibres let go and the interpolar
//                          fibres narrow into the midzone between the new
//                          nuclei, over the first half of telophase.
//   cytokinesis I → prophase II   the scene changes frames: one cell along
//                          x becomes two smaller cells dividing along y.
//                          Every daughter starts meiosis II exactly where
//                          meiosis I left it — chromosomes at their places
//                          and lying the way they lay (`UNIT_INVERSE`), the
//                          centrosome beside the nucleus, organelles where
//                          the furrow left them — and turns to its new
//                          spindle over the first part of prophase II.
//   the end of cytokinesis   the midbody fades before the next stage.
//
// Chromosomes keep their size in every frame: a daughter cell is smaller,
// its chromosomes are not.
// ─────────────────────────────────────────────────────────────────────

import * as THREE from "three";
import { PAIRS, divisionPose } from "../../lib/cellDivision.js";
import { clamp, smoothstep } from "../../lib/stageCycle.js";

const lerp = (a, b, t) => a + (b - a) * t;
/** The same hash as scene-kit's `hashRandom`, so the layouts match it. */
export function hashRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const rampIn = (x, a, b) => smoothstep(clamp((x - a) / Math.max(1e-6, b - a), 0, 1));

/** Resting cell radius, and the daughters' radius and centre spacing. */
export const R = 2.6;
export const R2 = 1.85;
export const D2 = 2.15;
/** Half-length of the membrane lathe's station range — the longest the cell ever gets. */
export const LMAX = D2 + R2 + 0.15;
/** Chromosome 1's total arm length and a chromatid's radius when condensed, world units. */
export const ARM_LENGTH = 1.3;
export const CHROMATID_RADIUS = 0.085;
/** Nuclei: the interphase nucleus, a re-forming telophase nucleus, a daughter cell's nucleus. */
export const NUCLEUS_R = R * 0.6;
export const TELO_NUCLEUS_R = R * 0.33;
export const DAUGHTER_NUCLEUS_R = R2 * 0.6;
/** How far beyond its nucleus a centrosome sits. */
export const CENTROSOME_GAP = 0.26;
export const MITOCHONDRIA = 22;
export const VESICLES = 44;

/**
 * Polynomial smooth maximum: a neck between two sphere profiles. The bump
 * fades out where both profiles vanish, so the gap between separated
 * daughters is a true zero rather than a thread of radius k/4.
 */
export const smax = (a, b, k) => {
  const m = Math.max(a, b);
  if (k <= 1e-6 || m <= 1e-6) return m;
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(a, b, h) + k * h * (1 - h) * Math.min(1, m / k);
};

export const sphereProfile = (a, centre, radius) => {
  const d = a - centre;
  const q = radius * radius - d * d;
  return q > 0 ? Math.sqrt(q) : 0;
};

/** A chromatid's radius at u when fully condensed, before the condensation factor. */
export function chromatidProfile(u, s, pairIndex, which) {
  const tip = 1 - 0.55 * Math.pow(Math.abs(u), 6);
  // The primary constriction: the centromere is a waist.
  const waist = 1 - 0.4 * Math.exp(-(u * u) / 0.012);
  const lumps = 1 + 0.05 * Math.sin(s * 37 + pairIndex * 3 + which) + 0.035 * Math.sin(s * 83 + which * 2);
  return CHROMATID_RADIUS * tip * waist * lumps;
}

// ─── Layout ─────────────────────────────────────────────────────────

/**
 * Where chromosomes sit on the plate, in unit-local (b, c) — the plane
 * perpendicular to the spindle axis `a`. Mitosis and meiosis II seat single
 * chromosomes; meiosis I seats bivalents.
 */
export const SEATS = {
  // Stacked along b (vertical for the first division) so all four read from the front; c staggers depth.
  mitosis: { "one-maternal": [1.55, 0.3], "two-paternal": [0.5, -0.35], "two-maternal": [-0.5, 0.35], "one-paternal": [-1.55, -0.3] },
  bivalent: { one: [0.95, 0.2], two: [-0.8, -0.25] },
  // Meiosis II: b is horizontal, the two chromosomes lie end to end on the equator.
  haploid: { one: [0.95, 0.15], two: [-0.85, -0.15] },
};

/** Which pole each homologue goes to in anaphase I — the second bivalent is assorted the other way. */
export const ASSORTMENT = { one: { maternal: -1, paternal: 1 }, two: { maternal: 1, paternal: -1 } };

/**
 * Unit-local frame → world. `a` is the spindle axis, `b` the direction the
 * chromosomes' long axes lie along on the plate, `c = a × b`. Division 1
 * divides along x; the daughters divide along y, so the second division
 * is seen face-on and the four gametes end up in a 2 × 2.
 */
export function makeUnit(origin, axis, scale) {
  const m = new THREE.Matrix4();
  const a = axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const b = axis === "x" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const c = new THREE.Vector3().crossVectors(a, b);
  m.makeBasis(a, b, c);
  const quat = new THREE.Quaternion().setFromRotationMatrix(m);
  const inverse = quat.clone().invert();
  return { origin: new THREE.Vector3(...origin), quat, inverse, scale, axis, matrix: new THREE.Matrix4().compose(new THREE.Vector3(...origin), quat, new THREE.Vector3(scale, scale, scale)) };
}

export const UNITS = {
  one: [makeUnit([0, 0, 0], "x", 1)],
  two: [makeUnit([-D2, 0, 0], "y", R2 / R), makeUnit([D2, 0, 0], "y", R2 / R)],
};

/** A meiosis II frame turned back to the first division's: how things lay at the end of meiosis I. */
const UNIT_INVERSE = UNITS.two[0].inverse;

/** Which daughter each chromosome lands in after anaphase I. */
export const unitOf = (ch) => (ASSORTMENT[PAIRS[ch.pair].key][ch.parent] < 0 ? 0 : 1);

/** A fixed pseudo-random resting place inside the nucleus, for prophase scatter. */
export function scatterSeat(seed, spread) {
  const u = hashRandom(seed * 3.1 + 1);
  const v = hashRandom(seed * 5.7 + 2);
  const w = hashRandom(seed * 7.3 + 3);
  return [(u - 0.5) * spread * 0.9, (v - 0.5) * spread * 1.4, (w - 0.5) * spread * 1.2];
}

// ─── Organelles ─────────────────────────────────────────────────────

/**
 * Mitochondria and vesicles, each a point in the unit ball. In the first
 * division it rides with the lobe on its side of x; in the second, inside
 * the daughter it went to, with the lobe on its side of y. The second
 * division's frame is turned so that both describe the same place at the
 * handover. They are kept off the front of the cell and its central
 * column and row, so they never hide the chromosomes.
 */
function organelleSeats(n, seed, lo, hi) {
  return Array.from({ length: n }, (_, i) => {
    const th = hashRandom(seed + i * 1.7) * Math.PI * 2;
    const ph = Math.acos(2 * hashRandom(seed + i * 2.3) - 1);
    const r = lo + (hi - lo) * hashRandom(seed + i * 3.1);
    let x = r * Math.sin(ph) * Math.cos(th);
    let y = r * Math.sin(ph) * Math.sin(th);
    let z = r * Math.cos(ph);
    if (z > 0.2 || (z > -0.1 && (Math.abs(x) < 0.6 || Math.abs(y) < 0.6))) z = -Math.abs(z) - 0.1;
    // Back at its own distance from the centre, so moving it behind never moves it out.
    const k = r / Math.hypot(x, y, z);
    x *= k;
    y *= k;
    z *= k;
    return {
      x,
      y,
      z,
      rot: [hashRandom(seed + i * 4.1) * 6.28, hashRandom(seed + i * 5.3) * 6.28, hashRandom(seed + i * 6.7) * 6.28],
      size: 0.8 + 0.4 * hashRandom(seed + i * 7.9),
      phase: hashRandom(seed + i * 8.3) * 6.28,
    };
  });
}

// A mitochondrion is up to 0.3 long either side of its centre, so it sits deeper than a vesicle: neither may poke through the membrane.
export const ORGANELLES = { mito: organelleSeats(MITOCHONDRIA, 3, 0.6, 0.8), ves: organelleSeats(VESICLES, 17, 0.66, 0.9) };

const OV = new THREE.Vector3();

/**
 * Where an organelle is this frame (world), into `out`. Returns its scale
 * factor (lobe radius over the resting radius, times the frame's scale) and
 * the unit's fade as [scale, fade], or null when its unit is not drawn.
 */
export function placeOrganelle(live, o, out) {
  const wob = 0.04 * Math.sin(live.clock * 0.5 + o.phase);
  let u;
  if (live.division === 2) {
    u = live.units[o.x < 0 ? 0 : 1];
    // In the daughter's frame: a = world y, b = world x, c = −world z.
    const X = o.y;
    const s2 = X < 0 ? -1 : 1;
    OV.set(s2 * u.c + X * u.r + wob, o.x * u.r + wob, -o.z * u.r);
  } else {
    u = live.units[0];
    const s1 = o.x < 0 ? -1 : 1;
    OV.set(s1 * u.c + o.x * u.r + wob, o.y * u.r + wob, o.z * u.r);
  }
  if (!u.active || !u.frame) return null;
  out.copy(OV).applyMatrix4(u.frame.matrix);
  return [(u.r / R) * u.frame.scale, u.fade];
}

// ─── Containment ────────────────────────────────────────────────────

/** The cell's radius (distance from the spindle axis to the membrane) at axial position `a`, unit-local. */
export const cellRadiusAt = (u, a) => smax(sphereProfile(a, -u.c, u.r), sphereProfile(a, u.c, u.r), u.k);

const insideCell = (u, x, y, z, margin) => Math.hypot(y, z) <= cellRadiusAt(u, x) - margin;

/**
 * How much of the segment from → to (unit-local) lies inside the cell, as
 * a fraction from `from`. Astral microtubules reach the cortex under the
 * membrane and push on it; they never pass through it.
 */
export function fibreReach(u, fx, fy, fz, tx, ty, tz, margin = 0.05) {
  if (insideCell(u, tx, ty, tz, margin)) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 10; i += 1) {
    const m = (lo + hi) / 2;
    if (insideCell(u, fx + (tx - fx) * m, fy + (ty - fy) * m, fz + (tz - fz) * m, margin)) lo = m;
    else hi = m;
  }
  return lo;
}

/** Distance from point s along unit direction v to a sphere of radius `radius` about the origin (s inside); 0 if s is outside. */
function rayToSphere(sx, sy, sz, vx, vy, vz, radius) {
  const b = sx * vx + sy * vy + sz * vz;
  const c = sx * sx + sy * sy + sz * sz - radius * radius;
  if (c >= 0) return 0;
  return -b + Math.sqrt(b * b - c);
}

// ─── The live bag ───────────────────────────────────────────────────

/**
 * Everything the meshes read this frame. Written in place: the bag is
 * allocated once and its arrays are reused.
 */
export function makeLiveBag(chromatids) {
  return {
    snap: null,
    pose: null,
    poison: 0,
    clock: 0,
    plan: [],
    units: [makeUnitState(), makeUnitState()],
    unitCount: 1,
    division: 1,
    chromatids: Object.fromEntries(chromatids.map((ch) => [ch.key, makeChromatidState()])),
  };
}

function makeUnitState() {
  return {
    active: false,
    frame: null,
    /** Two sphere profiles under a smooth max: centre ±c, radius r, neck k. */
    c: 0,
    r: R,
    k: 0.9,
    membraneOpacity: 0.3,
    pole: R * 0.7,
    polesOut: 0,
    /** Centrosome positions, unit-local, for the pole at −a and +a. */
    centrosomes: [new THREE.Vector3(), new THREE.Vector3()],
    nucleus: { centre: 1, centreRadius: NUCLEUS_R, poles: 0, poleRadius: TELO_NUCLEUS_R, poleOffset: 0, nucleolus: 1, poleNucleolus: 0 },
    spindle: 0,
    /** The interpolar fibres: where they start (distance from the centre), how tightly they bundle, and how far they have become the midzone. */
    midzoneStart: R * 0.7,
    midzoneSpread: 1,
    midzone: 0,
    /** Kinetochore fibres let go over the first half of telophase. */
    kinetochoreHold: 1,
    afterAnaphase: false,
    furrow: 0,
    ringRadius: R,
    ringFade: 1,
    fade: 1,
  };
}

function makeChromatidState() {
  return {
    unit: 0,
    seat: [0, 0, 0],
    tilt: 0,
    side: 1,
    bend: 0,
    bow: 1,
    splay: 1,
    pullDir: 0,
    condense: 0,
    opacity: 1,
    reveal: 0,
    chiasmaPull: 0,
    world: new THREE.Vector3(),
    /** Orientation relative to its unit's frame, and in the world. */
    localQuat: new THREE.Quaternion(),
    quat: new THREE.Quaternion(),
    /** Scale along the chromatid's length (longer as it decondenses, shorter to fit its nucleus), and how far its decondensing fibre wanders. */
    lengthScale: 1,
    wander: 0,
    /** The kinetochore facing this chromatid's pole: unit-local, and in the chromatid's own frame. */
    kin: new THREE.Vector3(),
    kinLocal: new THREE.Vector3(),
    /** The decondensed territory: centre (world), radius and opacity. */
    territory: new THREE.Vector3(),
    territorySize: 0,
    territoryOpacity: 0,
    visible: true,
  };
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const LONG = new THREE.Vector3();
const TIP_SIDE = new THREE.Vector3();
const TILT_Q = new THREE.Quaternion();
const KV = new THREE.Vector3();

// ─── The choreography ───────────────────────────────────────────────

/**
 * Pose channels → placements, for cycle time `snap.t`. `dt` is the frame's
 * wall time and `speed` the animation speed; the ambient clock runs at their
 * product. Runs inside the stepper's frame, before any mesh reads the bag.
 */
export function choreograph(live, snap, modeKey, chromatids, dt, speed) {
  const pose = divisionPose(modeKey, snap.t);
  live.snap = snap;
  live.pose = pose;
  const sdt = dt * speed;
  live.clock += sdt;
  const meiosis = modeKey === "meiosis";
  const division = pose.division;
  live.division = division;
  const units = division === 2 ? UNITS.two : UNITS.one;
  live.unitCount = units.length;

  // Colchicine: ease the poison in while arrested, out when washed.
  const wantPoison = snap.arrested ? 1 : 0;
  live.poison += (wantPoison - live.poison) * (1 - Math.exp(-sdt * 2.2));
  const poison = live.poison;

  const e = pose.elongate;
  const f = pose.furrow;
  const fe = smoothstep(f);
  // Under colchicine no plate forms: chromosomes hover, spindle stubs.
  const align = pose.align * (1 - 0.8 * poison);
  const spindle = pose.spindle * (1 - 0.88 * poison);
  const afterAnaphase = pose.phase === "telophase" || pose.phase === "cytokinesis";
  // Telophase: how far the spindle has become the midzone and let go of the kinetochores.
  const telo = pose.phase === "telophase" ? rampIn(pose.progress, 0, 0.5) : pose.phase === "cytokinesis" ? 1 : 0;
  // Prophase II: how far each daughter has turned from the way meiosis I left it to its own spindle.
  const handover = division === 2 && pose.phase === "prophase" ? rampIn(pose.progress, 0, 0.7) : 1;

  for (let i = 0; i < live.units.length; i += 1) {
    const u = live.units[i];
    u.active = i < units.length;
    if (!u.active) continue;
    u.frame = units[i];
    // Anaphase B stretches the cell (two overlapping spheres); the furrow
    // then drives the centres apart and sharpens the neck.
    const stretch = 0.34 * R * e;
    u.c = lerp(stretch, D2, fe);
    u.r = lerp(R * (1 - 0.1 * e), R2, fe);
    // No neck smoothing while the two profiles coincide (a resting sphere is exactly R).
    u.k = lerp(1.1, 0.12, fe) * smoothstep(clamp(u.c / 0.6, 0, 1));
    u.membraneOpacity = 0.3;
    u.pole = R * (0.7 + 0.16 * e);
    u.polesOut = pose.poles;
    u.spindle = spindle;
    u.furrow = f;
    u.ringRadius = smax(sphereProfile(0, -u.c, u.r), sphereProfile(0, u.c, u.r), u.k);
    // The midbody fades before the next stage begins.
    u.ringFade = pose.phase === "cytokinesis" ? 1 - rampIn(pose.progress, 0.86, 0.99) : 1;
    u.fade = pose.fade;
    u.afterAnaphase = afterAnaphase;

    // Nuclei. Before anaphase: one at the centre. After: one per pole,
    // forming between the chromosomes' pole and the equator, then centred
    // in its daughter as the furrow closes. The centrosome sits just beyond.
    const n = u.nucleus;
    n.centre = afterAnaphase ? 0 : pose.envelope;
    n.centreRadius = NUCLEUS_R * (1 + 0.1 * (1 - pose.envelope));
    n.poles = afterAnaphase ? pose.envelope : 0;
    n.poleRadius = lerp(TELO_NUCLEUS_R, DAUGHTER_NUCLEUS_R, fe);
    const teloCentre = u.pole - TELO_NUCLEUS_R - CENTROSOME_GAP;
    n.poleOffset = lerp(teloCentre, D2, fe);
    // The nucleolus goes before the envelope does, and comes back after it.
    n.nucleolus = Math.pow(n.centre, 3);
    n.poleNucleolus = Math.pow(n.poles, 3);

    // Centrosomes. Interphase: the duplicated pair sits beside the nucleus,
    // on the cell's outer side (in meiosis II, where the one centrosome of
    // meiosis I was); prophase walks them round it to opposite poles; after
    // anaphase each stays just outside its new nucleus.
    const restSide = division === 2 && i === 0 ? -1 : 1;
    // Slightly in front of the plane (world +z) in either frame; the second frame's c is world −z.
    const zc = division === 2 ? -0.05 / u.frame.scale : 0.05;
    // In meiosis II the one centrosome a daughter inherited duplicates: the two ease apart.
    const split = 0.2 * handover;
    for (let k = 0; k < 2; k += 1) {
      const dir = k === 0 ? -1 : 1;
      const out = u.centrosomes[k];
      if (afterAnaphase) {
        out.set(dir * (n.poleOffset + n.poleRadius + CENTROSOME_GAP), 0, zc);
      } else {
        const restR = NUCLEUS_R + 0.36;
        const restTheta = Math.atan2(restSide * restR, dir * split);
        const poleTheta = dir < 0 ? restSide * Math.PI : 0;
        const p = smoothstep(u.polesOut);
        const th = lerp(restTheta, poleTheta, p);
        const rad = lerp(Math.hypot(restR, split), u.pole, p);
        out.set(rad * Math.cos(th), rad * Math.sin(th), zc);
      }
    }
    // The interpolar fibres that outlast anaphase are the midzone between the new nuclei.
    u.midzone = telo;
    u.midzoneStart = lerp(u.pole, Math.max(0.2, n.poleOffset - n.poleRadius * 0.85), telo);
    u.midzoneSpread = lerp(1, 0.35, telo);
    u.kinetochoreHold = 1 - telo;
  }

  const pull = pose.separate;
  const chromatidScale = division === 2 ? 0.86 : 1;
  const meiosisOne = meiosis && division === 1;
  const meiosisTwo = meiosis && division === 2;

  for (const ch of chromatids) {
    const st = live.chromatids[ch.key];
    const pairKey = PAIRS[ch.pair].key;
    const unitIndex = division === 2 ? unitOf(ch) : 0;
    st.unit = unitIndex;
    const u = live.units[unitIndex];
    const P = u.pole;
    const scale = u.frame.scale;

    // Which pole this chromatid is heading for. Meiosis I: whole homologues
    // part, by the assortment table. Mitosis: sister 0 to −a, sister 1 to
    // +a. Meiosis II: whichever sister lay on the −a side when meiosis I
    // ended goes to −a, so the pair never has to swap sides.
    const homologueDir = ASSORTMENT[pairKey][ch.parent];
    const sisterDir = meiosisTwo ? (ch.which === 0 ? -homologueDir : homologueDir) : ch.which === 0 ? -1 : 1;
    const dir = meiosisOne ? homologueDir : sisterDir;
    st.pullDir = dir;

    // Resting seats.
    const seed = ch.pair * 10 + (ch.parent === "maternal" ? 1 : 5) + ch.which * 2 + (division === 2 ? 40 : 0);
    const scatter = scatterSeat(seed, R * 0.55 * chromatidScale);
    const drift = 0.06 * Math.sin(live.clock * 0.7 + seed);
    let aOffset;
    if (meiosisOne) {
      const seat = SEATS.bivalent[pairKey];
      // Homologues straddle the plate; the paired bivalent forms in prophase I.
      const pairedA = homologueDir * 0.27;
      const bivalentScatter = scatterSeat(ch.pair * 13 + 7, R * 0.7);
      const paired = [bivalentScatter[0] + pairedA, bivalentScatter[1], bivalentScatter[2]];
      const synapsed = [lerp(scatter[0], paired[0], pose.pair), lerp(scatter[1], paired[1], pose.pair), lerp(scatter[2], paired[2], pose.pair)];
      const onPlate = [pairedA, seat[0], seat[1]];
      aOffset = lerp(synapsed[0], onPlate[0], align);
      st.seat[1] = lerp(synapsed[1], onPlate[1], align) + drift * (1 - align);
      st.seat[2] = lerp(synapsed[2], onPlate[2], align);
    } else {
      const seat = division === 2 ? SEATS.haploid[pairKey] : SEATS.mitosis[`${pairKey}-${ch.parent}`];
      aOffset = lerp(scatter[0], 0, align);
      st.seat[1] = lerp(scatter[1], seat[0] * chromatidScale, align) + drift * (1 - align);
      st.seat[2] = lerp(scatter[2], seat[1] * chromatidScale, align);
    }
    // The anaphase pull, along a. Meiosis I pulls the X intact; the others pull single chromatids.
    const travel = (P - 0.6) * pull;
    st.seat[0] = aOffset * (1 - pull) + dir * travel + aOffset * pull * (meiosisOne ? 0.35 : 0);

    // Telophase: gather the set into the pole nucleus and decondense.
    const gather = afterAnaphase ? (pose.phase === "telophase" ? smoothstep(clamp((pose.progress - 0.1) / 0.6, 0, 1)) : 1) : 0;
    if (gather > 0) {
      const nucleusA = dir * u.nucleus.poleOffset;
      const inner = scatterSeat(seed + 100, u.nucleus.poleRadius * 1.1);
      st.seat[0] = lerp(st.seat[0], nucleusA + inner[0] * 0.6, gather);
      st.seat[1] = lerp(st.seat[1], inner[1] * 0.6, gather);
      st.seat[2] = lerp(st.seat[2], inner[2] * 0.6, gather);
    }

    // Prophase II starts where cytokinesis I ended: the chromosome's seat in
    // its daughter's nucleus, in the new frame (a = world y, b = world x,
    // c = −world z), easing to the new prophase scatter.
    if (handover < 1) {
      const inner = scatterSeat(seed - 40 + 100, DAUGHTER_NUCLEUS_R * 1.1);
      st.seat[0] = lerp((inner[1] * 0.6) / scale, st.seat[0], handover);
      st.seat[1] = lerp((inner[0] * 0.6) / scale, st.seat[1], handover);
      st.seat[2] = lerp((-inner[2] * 0.6) / scale, st.seat[2], handover);
    }

    // Under colchicine the chromosomes never settle: they drift around the spindle remnant.
    if (poison > 0.01) {
      st.seat[0] += poison * 0.5 * Math.sin(live.clock * 1.1 + seed * 2.3);
      st.seat[1] += poison * 0.35 * Math.sin(live.clock * 0.9 + seed);
      st.seat[2] += poison * 0.35 * Math.cos(live.clock * 0.8 + seed * 1.7);
    }

    st.tilt = (hashRandom(seed + 0.5) - 0.5) * 1.3 * (1 - align) * (1 - gather) + (poison > 0.01 ? poison * 0.6 * Math.sin(live.clock * 0.5 + seed) : 0);
    // Orientation in the unit's frame: the tilt about c — except early in
    // prophase II, when it turns from the way it lay at the end of meiosis I.
    TILT_Q.setFromAxisAngle(Z_AXIS, st.tilt);
    if (handover < 1) st.localQuat.copy(UNIT_INVERSE).slerp(TILT_Q, handover);
    else st.localQuat.copy(TILT_Q);
    st.quat.copy(u.frame.quat).multiply(st.localQuat);

    // While its nucleus is intact, the whole chromosome is inside it: the
    // centromere is kept away from the envelope and the arms shortened (more
    // tightly folded) where they would reach through it. Weighted by how
    // intact the envelope is, so it lets go as the envelope breaks up and
    // takes hold as it re-forms.
    const enclosed = afterAnaphase ? u.nucleus.poles : u.nucleus.centre;
    const stretch = 1 + 0.35 * (1 - pose.condense);
    st.lengthScale = stretch;
    st.wander = (1 - pose.condense) * (1 - 0.7 * enclosed);
    if (enclosed > 0.001) {
      const encCentre = afterAnaphase ? dir * u.nucleus.poleOffset : 0;
      const encR = (afterAnaphase ? u.nucleus.poleRadius : u.nucleus.centreRadius) * 0.97;
      const pairDef = PAIRS[ch.pair];
      const total = ARM_LENGTH * pairDef.length;
      const armP = (total * pairDef.centromere * stretch) / scale;
      const armQ = (total * (1 - pairDef.centromere) * stretch) / scale;
      // Room for the tube, the sister beside it, its wander and a crossover arm.
      const margin = (CHROMATID_RADIUS * 2 + 0.06 + 0.25 * st.wander + 0.42 * (meiosis ? pose.chiasmaVisible : 0)) / scale;
      const room = Math.max(0.05, encR - margin);
      // The centromere stays far enough in for most of an arm to lie straight.
      const reachMax = Math.max(0, room - Math.max(armP, armQ) * 0.6);
      const sx = st.seat[0] - encCentre;
      const sy = st.seat[1];
      const sz = st.seat[2];
      const d = Math.hypot(sx, sy, sz);
      if (d > reachMax && d > 1e-6) {
        const k = lerp(1, reachMax / d, enclosed);
        st.seat[0] = encCentre + sx * k;
        st.seat[1] = sy * k;
        st.seat[2] = sz * k;
      }
      LONG.set(0, 1, 0).applyQuaternion(st.localQuat);
      const cx = st.seat[0] - encCentre;
      const fitQ = rayToSphere(cx, st.seat[1], st.seat[2], LONG.x, LONG.y, LONG.z, room) / armQ;
      const fitP = rayToSphere(cx, st.seat[1], st.seat[2], -LONG.x, -LONG.y, -LONG.z, room) / armP;
      const fit = clamp(Math.min(1, fitQ, fitP), 0.25, 1);
      st.lengthScale = stretch * lerp(1, fit, enclosed);
    }

    // Sister chromatids lie side by side along the spindle axis, touching at
    // the centromere. In mitosis and meiosis II each sister's kinetochore
    // faces its own pole. In meiosis I the two sisters' kinetochores are
    // fused on the homologue's outer face, both facing ONE pole
    // (mono-orientation), and sister 0 is the inner one, next to the
    // homologue it crosses over with.
    st.side = meiosisOne ? (ch.which === 0 ? -dir : dir) : dir;
    const joined = meiosisOne ? 1 : 1 - pull;
    st.bow = joined;
    // Looser in prophase, closer once the chromosome is on the plate (and as it was at the end of meiosis I).
    st.splay = lerp(0.45, lerp(1, 0.45, align), handover);
    // Arms trail behind a pulled chromatid, and relax again as it is gathered into the new nucleus.
    st.bend = (meiosisOne ? 0.35 * pull : pull) * (1 - gather);
    st.condense = pose.condense;
    // The condensed chromosome takes over from its territory as it condenses.
    st.opacity = smoothstep(clamp((pose.condense - 0.08) / 0.5, 0, 1)) * pose.fade;
    st.reveal = meiosis ? pose.crossover : 0;
    st.chiasmaPull = meiosis ? pose.chiasmaVisible : 0;
    st.visible = true;

    // And the whole chromosome stays inside the cell: as a set nears its pole,
    // where the cell narrows, it bunches in towards the spindle axis instead
    // of reaching through the membrane.
    {
      const pairDef = PAIRS[ch.pair];
      const total = ARM_LENGTH * pairDef.length;
      const armsOut = [total * (1 - pairDef.centromere), -total * pairDef.centromere];
      const margin = (CHROMATID_RADIUS * 2 + 0.08) / scale;
      LONG.set(0, 1, 0).applyQuaternion(st.localQuat);
      const SIDE = TIP_SIDE.set(1, 0, 0).applyQuaternion(st.localQuat);
      const fits = (k) => {
        for (const arm of armsOut) {
          const along = (arm * st.lengthScale) / scale;
          const trail = (-dir * st.bend * 0.42 * Math.abs(arm)) / scale;
          const x = st.seat[0] + LONG.x * along + SIDE.x * trail;
          const y = st.seat[1] * k + LONG.y * along + SIDE.y * trail;
          const z = st.seat[2] * k + LONG.z * along + SIDE.z * trail;
          if (Math.hypot(y, z) > cellRadiusAt(u, x) - margin) return false;
        }
        return true;
      };
      if (!fits(1)) {
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 12; i += 1) {
          const m = (lo + hi) / 2;
          if (fits(m)) lo = m;
          else hi = m;
        }
        st.seat[1] *= lo;
        st.seat[2] *= lo;
      }
    }

    // The kinetochore: on the outer face of the centromere, facing its pole.
    const r0 = CHROMATID_RADIUS * 0.6 * (0.3 + 0.7 * st.condense);
    const gap0 = 0.012;
    if (meiosisOne) st.kinLocal.set(dir * (r0 + gap0 + r0 + 0.018), 0, st.side * 0.035);
    else st.kinLocal.set(dir * (st.bow * (r0 + gap0) + r0 + 0.018), 0, 0);
    KV.copy(st.kinLocal).applyQuaternion(st.localQuat).divideScalar(scale);
    st.kin.set(st.seat[0] + KV.x, st.seat[1] + KV.y, st.seat[2] + KV.z);

    // World position of the centromere.
    st.world.set(st.seat[0], st.seat[1], st.seat[2]).applyMatrix4(u.frame.matrix);

    // The territory: the same chromosome decondensed, kept inside its nucleus.
    const nucleusCentre = afterAnaphase ? dir * u.nucleus.poleOffset : 0;
    const nucleusR = afterAnaphase ? u.nucleus.poleRadius : NUCLEUS_R;
    const terrWorld = afterAnaphase ? (division === 2 ? 0.3 : 0.42) : division === 2 ? 0.42 : 0.55;
    const terrR = terrWorld / scale;
    let tx = st.seat[0] - nucleusCentre;
    let ty = st.seat[1];
    let tz = st.seat[2];
    const reach = Math.hypot(tx, ty, tz);
    const room = Math.max(0, nucleusR - terrR * 1.05);
    if (reach > room && reach > 1e-6) {
      tx *= room / reach;
      ty *= room / reach;
      tz *= room / reach;
    }
    st.territory.set(nucleusCentre + tx, ty, tz).applyMatrix4(u.frame.matrix);
    const loose = 1 - smoothstep(clamp(pose.condense / 0.6, 0, 1));
    st.territorySize = terrWorld * lerp(0.35, 1, loose);
    st.territoryOpacity = loose * pose.fade;
  }
  return pose;
}
