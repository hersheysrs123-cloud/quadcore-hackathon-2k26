"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";
import { ProfiledTube } from "@/components/visualizations/tube-transit";
import { StageCaption, StageCycleDriver } from "@/components/visualizations/stage-stepper";
import { smoothstep } from "@/lib/stageCycle";
import {
  PAIRS,
  PARENTS,
  arrestIndexFor,
  chiasmaPlan,
  chromatids as listChromatids,
  colchicineApplied,
  cycleFor,
  divisionPose,
  modeFor,
} from "@/lib/cellDivision";

// ─── Mitosis and meiosis ────────────────────────────────────────────
// A 2n = 4 cell — two homologous pairs, maternal red and paternal blue —
// stepped through division, or left to run.
//
// Everything animated reads ONE bag, `live.current`, that the choreography
// fills every frame from the stepper's clock: the pure `divisionPose` in
// `lib/cellDivision.js` gives the continuous channels (condensation,
// envelope, pole separation, spindle, alignment, separation, elongation,
// furrow, synapsis, crossing over), and `choreograph` below turns them into
// where every chromatid, centrosome, nucleus and cell lobe is. The meshes
// then only copy numbers into transforms and buffers — nothing allocates
// per frame:
//
//   membrane    a dynamic `ProfiledTube` lathe: two sphere profiles under a
//               smooth-max, whose centres drift apart and whose neck sharpens
//               as the furrow closes — one sphere, a stretched cell, two
//               lobes, two cells, from the same buffer.
//   chromatids  eight dynamic `ProfiledTube`s along their own long axis; the
//               centre-offset callback bows sisters into an X, sweeps the
//               arms back into a V when they are pulled, and — in meiosis —
//               drags the distal arms across to the homologue at a chiasma;
//               the colour callback paints each station by which parent that
//               stretch of DNA now comes from (`originAt`).
//   spindle     one instanced mesh of unit cylinders: kinetochore fibres from
//               each pole to the kinetochores facing it, interpolar fibres
//               overlapping at the equator, asters — sized, aimed and faded
//               per frame. Colchicine collapses them to stubs.
//
// Meiosis II is the same machinery in two smaller cells whose spindle axis
// is turned 90°, each holding the two chromosomes its pole received in
// anaphase I — one from each pair, assorted independently.
// ─────────────────────────────────────────────────────────────────────

/** Resting cell radius, and the daughters' radius and centre spacing. */
const R = 2.6;
const R2 = 1.85;
const D2 = 2.15;
/** Half-length of the membrane lathe's station range — the longest the cell ever gets. */
const LMAX = D2 + R2 + 0.15;
const MEMBRANE_RINGS = 84;
const MEMBRANE_SEGMENTS = 36;
const CHROMATID_RINGS = 30;
const CHROMATID_SEGMENTS = 8;
/** Chromosome 1's total arm length, world units, and chromatid radius when condensed. */
const ARM_LENGTH = 1.3;
const CHROMATID_RADIUS = 0.082;
const CHROMATIN_DOTS = 150;
const FIBRES_INTERPOLAR = 9;
const FIBRES_ASTRAL = 9;

const COLOURS = {
  membrane: "#5eead4",
  cytoplasm: "#0f766e",
  envelope: "#c4b5fd",
  chromatin: "#d8b4fe",
  maternal: PARENTS.maternal.colour,
  paternal: PARENTS.paternal.colour,
  kinetochore: "#fde68a",
  centrosome: "#fbbf24",
  microtubule: "#7dd3fc",
  microtubulePoisoned: "#a3e635",
  actin: "#fb923c",
  chiasma: "#fef9c3",
  poison: "#84cc16",
};

const MATERNAL = new THREE.Color(COLOURS.maternal);
const PATERNAL = new THREE.Color(COLOURS.paternal);
const MT_COLOUR = new THREE.Color(COLOURS.microtubule);
const MT_POISONED = new THREE.Color(COLOURS.microtubulePoisoned);

/**
 * Polynomial smooth maximum: a neck between two sphere profiles. The bump
 * fades out where both profiles vanish, so the gap between separated
 * daughters is a true zero rather than a thread of radius k/4.
 */
const smax = (a, b, k) => {
  const m = Math.max(a, b);
  if (k <= 1e-6 || m <= 1e-6) return m;
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(a, b, h) + k * h * (1 - h) * Math.min(1, m / k);
};

/** Which parent a station of a chromatid comes from, as a 0–1 blend towards the other parent — allocation-free `originAt`. */
function blendAt(ch, u, plan, reveal) {
  if (reveal <= 0 || plan.length === 0) return 0;
  const arm = u < 0 ? "p" : "q";
  const d = Math.abs(u);
  let flips = 0;
  for (const x of plan) if (x.pair === ch.pair && x.which === ch.which && x.arm === arm && d > x.u) flips += 1;
  return flips % 2 === 1 ? reveal : 0;
}

const sphereProfile = (a, centre, radius) => {
  const d = a - centre;
  const q = radius * radius - d * d;
  return q > 0 ? Math.sqrt(q) : 0;
};

// ─── Layout ─────────────────────────────────────────────────────────

/**
 * Where chromosomes sit on the plate, in unit-local (b, c) — the plane
 * perpendicular to the spindle axis `a`. Mitosis and meiosis II seat single
 * chromosomes; meiosis I seats bivalents.
 */
const SEATS = {
  // Stacked along b (vertical for the first division) so all four read from the front; c staggers depth.
  mitosis: { "one-maternal": [1.55, 0.3], "two-paternal": [0.5, -0.35], "two-maternal": [-0.5, 0.35], "one-paternal": [-1.55, -0.3] },
  bivalent: { one: [0.95, 0.2], two: [-0.8, -0.25] },
  // Meiosis II: b is horizontal, the two chromosomes lie end to end on the equator.
  haploid: { one: [0.72, 0.15], two: [-0.72, -0.15] },
};

/** Which pole each homologue goes to in anaphase I — the second bivalent is assorted the other way. */
const ASSORTMENT = { one: { maternal: -1, paternal: 1 }, two: { maternal: 1, paternal: -1 } };

/**
 * Unit-local frame → world. `a` is the spindle axis, `b` the direction the
 * chromosomes' long axes lie along on the plate, `c = a × b`. Division 1
 * divides along x; the daughters divide along y, so the second division
 * is seen face-on and the four gametes end up in a 2 × 2.
 */
function makeUnit(origin, axis, scale) {
  const m = new THREE.Matrix4();
  const a = axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const b = axis === "x" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const c = new THREE.Vector3().crossVectors(a, b);
  m.makeBasis(a, b, c);
  const quat = new THREE.Quaternion().setFromRotationMatrix(m);
  return { origin: new THREE.Vector3(...origin), quat, scale, axis, matrix: new THREE.Matrix4().compose(new THREE.Vector3(...origin), quat, new THREE.Vector3(scale, scale, scale)) };
}

const UNITS = {
  one: [makeUnit([0, 0, 0], "x", 1)],
  two: [makeUnit([-D2, 0, 0], "y", R2 / R), makeUnit([D2, 0, 0], "y", R2 / R)],
};

/** Which daughter each chromosome lands in after anaphase I. */
const unitOf = (ch) => (ASSORTMENT[PAIRS[ch.pair].key][ch.parent] < 0 ? 0 : 1);

/** A fixed pseudo-random resting place inside the nucleus, for prophase scatter. */
function scatterSeat(seed, spread) {
  const u = hashRandom(seed * 3.1 + 1);
  const v = hashRandom(seed * 5.7 + 2);
  const w = hashRandom(seed * 7.3 + 3);
  return [(u - 0.5) * spread * 0.9, (v - 0.5) * spread * 1.4, (w - 0.5) * spread * 1.2];
}

/**
 * Everything the meshes read this frame. Written in place: the bag is
 * allocated once and its arrays are reused.
 */
function makeLiveBag(chromatids) {
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
    nucleus: { centre: 1, centreRadius: R * 0.6, poles: 0, poleRadius: R * 0.38, poleOffset: 0 },
    chromatin: { centre: 0, poles: 0 },
    spindle: 0,
    furrow: 0,
    ringRadius: R,
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
    pullDir: 0,
    condense: 0,
    opacity: 1,
    reveal: 0,
    chiasmaPull: 0,
    world: new THREE.Vector3(),
    kinetochore: new THREE.Vector3(),
    visible: true,
  };
}

/**
 * The choreography: pose channels → placements. Runs inside the driver's
 * frame, so every mesh that mounted after it reads finished numbers.
 */
function choreograph(live, snap, modeKey, chromatids, dt) {
  const pose = divisionPose(modeKey, snap.t);
  live.snap = snap;
  live.pose = pose;
  live.clock += dt;
  const meiosis = modeKey === "meiosis";
  const division = pose.division;
  live.division = division;
  const units = division === 2 ? UNITS.two : UNITS.one;
  live.unitCount = units.length;

  // Colchicine: ease the poison in while arrested, out when washed.
  const wantPoison = snap.arrested ? 1 : 0;
  live.poison += (wantPoison - live.poison) * (1 - Math.exp(-dt * 2.2));
  const poison = live.poison;

  const e = pose.elongate;
  const f = pose.furrow;
  const fe = smoothstep(f);
  // Under colchicine no plate forms: chromosomes hover, spindle stubs.
  const align = pose.align * (1 - 0.8 * poison);
  const spindle = pose.spindle * (1 - 0.88 * poison);

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
    u.membraneOpacity = 0.26;
    u.pole = R * (0.7 + 0.16 * e);
    u.polesOut = pose.poles;
    u.spindle = spindle;
    u.furrow = f;
    u.ringRadius = smax(sphereProfile(0, -u.c, u.r), sphereProfile(0, u.c, u.r), u.k);
    u.fade = pose.fade;
    // Nuclei: one at the centre before division, one at each pole after.
    const afterAnaphase = pose.phase === "telophase" || pose.phase === "cytokinesis";
    u.nucleus.centre = afterAnaphase ? 0 : pose.envelope;
    u.nucleus.centreRadius = R * 0.6 * (1 + 0.12 * (1 - pose.envelope));
    u.nucleus.poles = afterAnaphase ? pose.envelope : 0;
    u.nucleus.poleOffset = u.pole - 0.32;
    u.nucleus.poleRadius = R * 0.36;
    u.chromatin.centre = afterAnaphase ? 0 : 1 - pose.condense;
    u.chromatin.poles = afterAnaphase ? 1 - pose.condense : 0;
  }

  const plan = live.plan;
  const pull = pose.separate;
  const chromatidScale = division === 2 ? 0.86 : 1;

  for (const ch of chromatids) {
    const st = live.chromatids[ch.key];
    const pairKey = PAIRS[ch.pair].key;
    const unitIndex = division === 2 ? unitOf(ch) : 0;
    st.unit = unitIndex;
    const u = live.units[unitIndex];
    const P = u.pole;

    // Which pole this chromatid is heading for. Mitosis / meiosis II: sisters
    // part, sister 0 to −a, sister 1 to +a. Meiosis I: whole homologues part,
    // by the assortment table.
    const sisterDir = ch.which === 0 ? -1 : 1;
    const homologueDir = ASSORTMENT[pairKey][ch.parent];
    const meiosisOne = meiosis && division === 1;
    const dir = meiosisOne ? homologueDir : sisterDir;
    st.pullDir = dir;

    // Resting seats.
    const seed = ch.pair * 10 + (ch.parent === "maternal" ? 1 : 5) + ch.which * 2 + (division === 2 ? 40 : 0);
    const scatter = scatterSeat(seed, R * 0.55 * chromatidScale);
    const drift = 0.06 * Math.sin(live.clock * 0.7 + seed);
    let plate;
    let aOffset;
    if (meiosisOne) {
      const seat = SEATS.bivalent[pairKey];
      plate = [seat[0], seat[1]];
      // Homologues straddle the plate; the paired bivalent forms in prophase I.
      const pairedA = homologueDir * 0.27;
      const bivalentScatter = scatterSeat(ch.pair * 13 + 7, R * 0.7);
      const own = [scatter[0], scatter[1], scatter[2]];
      const paired = [bivalentScatter[0] + pairedA, bivalentScatter[1], bivalentScatter[2]];
      const synapsed = [lerp(own[0], paired[0], pose.pair), lerp(own[1], paired[1], pose.pair), lerp(own[2], paired[2], pose.pair)];
      const onPlate = [pairedA, plate[0], plate[1]];
      aOffset = lerp(synapsed[0], onPlate[0], align);
      st.seat[1] = lerp(synapsed[1], onPlate[1], align) + drift * (1 - align);
      st.seat[2] = lerp(synapsed[2], onPlate[2], align);
      // Sisters sit almost on top of each other, slightly apart along c.
      st.seat[2] += (ch.which === 0 ? -0.07 : 0.07);
    } else {
      const seat = division === 2 ? SEATS.haploid[pairKey] : SEATS.mitosis[`${pairKey}-${ch.parent}`];
      plate = [seat[0] * chromatidScale, seat[1] * chromatidScale];
      const sisterA = sisterDir * 0.085;
      aOffset = lerp(scatter[0], sisterA, align);
      st.seat[1] = lerp(scatter[1], plate[0], align) + drift * (1 - align);
      st.seat[2] = lerp(scatter[2], plate[1], align);
    }

    // The anaphase pull, along a. Meiosis I pulls the X intact; the others pull single chromatids.
    const travel = (P - 0.6) * pull;
    st.seat[0] = aOffset * (1 - pull) + dir * travel + aOffset * pull * (meiosisOne ? 0.35 : 0);

    // Telophase: gather the set into the pole nucleus and decondense.
    const gather = pose.phase === "telophase" || pose.phase === "cytokinesis" ? (pose.phase === "telophase" ? smoothstep(clamp((pose.progress - 0.1) / 0.6, 0, 1)) : 1) : 0;
    if (gather > 0) {
      const nucleusA = dir * u.nucleus.poleOffset;
      const inner = scatterSeat(seed + 100, R * 0.42);
      st.seat[0] = lerp(st.seat[0], nucleusA + inner[0] * 0.5, gather);
      st.seat[1] = lerp(st.seat[1], inner[1] * 0.7, gather);
      st.seat[2] = lerp(st.seat[2], inner[2] * 0.7, gather);
    }

    // Under colchicine the chromosomes never settle: they drift around the spindle remnant.
    if (poison > 0.01) {
      st.seat[0] += poison * 0.5 * Math.sin(live.clock * 1.1 + seed * 2.3);
      st.seat[1] += poison * 0.35 * Math.sin(live.clock * 0.9 + seed);
      st.seat[2] += poison * 0.35 * Math.cos(live.clock * 0.8 + seed * 1.7);
    }

    st.tilt = (hashRandom(seed + 0.5) - 0.5) * 1.3 * (1 - align) * (1 - gather) + (poison > 0.01 ? poison * 0.6 * Math.sin(live.clock * 0.5 + seed) : 0);
    st.side = ch.which === 0 ? -1 : 1;
    // Sisters bow apart into an X while joined; a chromatid on its own is straight but swept back.
    const joined = meiosisOne ? 1 : 1 - pull;
    st.bow = joined;
    st.bend = meiosisOne ? 0.35 * pull : pull;
    st.condense = pose.condense;
    st.opacity = (0.16 + 0.84 * pose.condense) * pose.fade;
    st.reveal = meiosis ? pose.crossover : 0;
    st.chiasmaPull = meiosis ? pose.chiasmaVisible : 0;
    st.visible = true;

    // World position of the centromere and of the kinetochore that faces its pole.
    st.world.set(st.seat[0], st.seat[1], st.seat[2]).applyMatrix4(u.frame.matrix);
    st.kinetochore.set(st.seat[0] + dir * 0.06, st.seat[1], st.seat[2]).applyMatrix4(u.frame.matrix);
  }
  return pose;
}

// ─── Cell parts ─────────────────────────────────────────────────────

/** The membrane lathe, along local +y; the parent turns +y onto the unit's spindle axis. */
function Membrane({ live, index }) {
  const matRef = useRef(null);
  const radiusAt = useCallback(
    (s) => {
      const u = live.current.units[index];
      const a = s - LMAX;
      return smax(sphereProfile(a, -u.c, u.r), sphereProfile(a, u.c, u.r), u.k);
    },
    [live, index],
  );
  useFrame(() => {
    const u = live.current.units[index];
    const m = matRef.current;
    if (m) m.opacity = u.membraneOpacity * u.fade;
  });
  return (
    <group rotation={[0, 0, -Math.PI / 2]} position={[-LMAX, 0, 0]}>
      <ProfiledTube length={LMAX * 2} rings={MEMBRANE_RINGS} segments={MEMBRANE_SEGMENTS} radiusAt={radiusAt} dynamic>
        <meshPhysicalMaterial ref={matRef} color={COLOURS.membrane} roughness={0.25} metalness={0.05} transparent opacity={0.26} side={THREE.DoubleSide} depthWrite={false} clearcoat={0.4} />
      </ProfiledTube>
    </group>
  );
}

/** Actin contractile ring at the equator, tightening as the furrow closes. */
function ContractileRing({ live, index }) {
  const ref = useRef(null);
  useFrame(() => {
    const u = live.current.units[index];
    const m = ref.current;
    if (!m) return;
    const on = u.furrow > 0.001 && u.furrow < 0.995;
    m.visible = on;
    if (!on) return;
    const rr = Math.max(0.05, u.ringRadius + 0.05);
    m.scale.set(rr, rr, 1);
    m.material.opacity = 0.9 * u.fade;
  });
  return (
    <mesh ref={ref} rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[1, 0.045, 10, 64]} />
      <meshStandardMaterial color={COLOURS.actin} emissive={COLOURS.actin} emissiveIntensity={0.8} transparent opacity={0.9} />
    </mesh>
  );
}

/** A translucent nuclear envelope that swells slightly as it breaks down. */
function NuclearEnvelope({ live, index, which }) {
  const ref = useRef(null);
  useFrame(() => {
    const u = live.current.units[index];
    const m = ref.current;
    if (!m) return;
    const n = u.nucleus;
    let opacity;
    let radius;
    let x = 0;
    if (which === "centre") {
      opacity = n.centre;
      radius = n.centreRadius;
    } else {
      opacity = n.poles;
      radius = n.poleRadius;
      x = (which === "left" ? -1 : 1) * n.poleOffset;
    }
    m.visible = opacity > 0.01;
    m.position.set(x, 0, 0);
    m.scale.setScalar(radius);
    m.material.opacity = 0.22 * opacity * u.fade;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 36, 24]} />
      <meshPhysicalMaterial color={COLOURS.envelope} roughness={0.3} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} transmission={0.2} />
    </mesh>
  );
}

/** Decondensed chromatin: a cloud of specks inside a nucleus, half tinted each parent. */
function Chromatin({ live, index, which, seed = 3 }) {
  const ref = useRef(null);
  const seats = useMemo(
    () =>
      Array.from({ length: CHROMATIN_DOTS }, (_, i) => {
        const r = Math.cbrt(hashRandom(seed + i * 1.3)) * 0.82;
        const th = hashRandom(seed * 2 + i * 0.7) * Math.PI * 2;
        const ph = Math.acos(2 * hashRandom(seed * 3 + i * 0.9) - 1);
        return { x: r * Math.sin(ph) * Math.cos(th), y: r * Math.sin(ph) * Math.sin(th), z: r * Math.cos(ph), s: 0.03 + 0.03 * hashRandom(seed * 5 + i), phase: hashRandom(seed * 7 + i) * 6.28 };
      }),
    [seed],
  );
  const state = useRef({ dummy: new THREE.Object3D(), colour: new THREE.Color(), painted: false });
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const u = live.current.units[index];
    const n = u.nucleus;
    const amount = which === "centre" ? u.chromatin.centre : u.chromatin.poles;
    const radius = which === "centre" ? n.centreRadius : n.poleRadius;
    const x = which === "centre" ? 0 : (which === "left" ? -1 : 1) * n.poleOffset;
    const visible = amount > 0.02 && u.fade > 0.02;
    mesh.visible = visible;
    if (!visible) return;
    const s = state.current;
    const d = s.dummy;
    const t = clock.elapsedTime;
    for (let i = 0; i < seats.length; i += 1) {
      const p = seats[i];
      const wob = 0.03 * Math.sin(t * 0.8 + p.phase);
      d.position.set(x + p.x * radius + wob, p.y * radius, p.z * radius + wob);
      d.scale.setScalar(p.s * radius * amount);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (!s.painted) {
      s.painted = true;
      for (let i = 0; i < seats.length; i += 1) {
        s.colour.copy(i % 2 === 0 ? MATERNAL : PATERNAL).lerp(new THREE.Color(COLOURS.chromatin), 0.55);
        mesh.setColorAt(i, s.colour);
      }
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.material.opacity = 0.85 * u.fade;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CHROMATIN_DOTS]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 5]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.25} roughness={0.7} transparent opacity={0.85} />
    </instancedMesh>
  );
}

/** A centriole pair: two short barrels at right angles, with a glow. */
function Centrosome({ live, index, which }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    const u = live.current.units[index];
    const g = ref.current;
    if (!g) return;
    const dir = which === "left" ? -1 : 1;
    // Interphase: the duplicated pair sits together beside the nucleus; prophase walks them to the poles.
    const restA = 0.18 * dir;
    const restB = R * 0.62;
    const x = lerp(restA, dir * u.pole, u.polesOut);
    const y = lerp(restB, 0, u.polesOut);
    g.position.set(x, y, 0);
    g.rotation.z = clock.elapsedTime * 0.3 * dir;
    g.visible = u.fade > 0.02;
    g.scale.setScalar(0.9 + 0.1 * Math.sin(clock.elapsedTime * 2));
  });
  return (
    <group ref={ref}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.26, 12]} />
        <meshStandardMaterial color={COLOURS.centrosome} emissive={COLOURS.centrosome} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.04, 0.16, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.26, 12]} />
        <meshStandardMaterial color={COLOURS.centrosome} emissive={COLOURS.centrosome} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      <Halo radius={0.3} color={COLOURS.centrosome} opacity={0.12} />
    </group>
  );
}

/**
 * The spindle: kinetochore, interpolar and astral microtubules as one
 * instanced mesh of unit cylinders, aimed pole → target every frame.
 */
function Spindle({ live, index, chromatids }) {
  const ref = useRef(null);
  const kinetochoreCount = chromatids.length;
  const count = kinetochoreCount + 2 * FIBRES_INTERPOLAR + 2 * FIBRES_ASTRAL;
  const state = useRef({
    dummy: new THREE.Object3D(),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    mid: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    quat: new THREE.Quaternion(),
    colour: new THREE.Color(),
    lastPoison: -1,
  });
  // Fixed fan directions for the interpolar and astral fibres.
  const fans = useMemo(() => {
    const inter = Array.from({ length: FIBRES_INTERPOLAR }, (_, i) => {
      const ang = (i / FIBRES_INTERPOLAR) * Math.PI * 2 + 0.3;
      const spread = 0.28 + 0.2 * hashRandom(i + 11);
      return { y: Math.cos(ang) * spread, z: Math.sin(ang) * spread, len: 1.08 + 0.18 * hashRandom(i + 21) };
    });
    const astral = Array.from({ length: FIBRES_ASTRAL }, (_, i) => {
      const ang = (i / FIBRES_ASTRAL) * Math.PI * 2 + 0.9;
      const tilt = 0.35 + 0.55 * hashRandom(i + 31);
      return { y: Math.cos(ang) * tilt, z: Math.sin(ang) * tilt, len: 0.55 + 0.3 * hashRandom(i + 41) };
    });
    return { inter, astral };
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const L = live.current;
    const u = L.units[index];
    const s = state.current;
    const d = s.dummy;
    const t = clock.elapsedTime;
    const grow = u.spindle;
    const poison = L.poison;
    const visible = grow > 0.01 && u.fade > 0.02;
    mesh.visible = visible;
    if (!visible) return;
    const jitter = 1 + 0.04 * Math.sin(t * 6);

    let i = 0;
    const place = (fromX, fromY, fromZ, toX, toY, toZ, fraction, radius) => {
      s.from.set(fromX, fromY, fromZ);
      s.to.set(toX, toY, toZ);
      s.dir.subVectors(s.to, s.from);
      const full = s.dir.length();
      const len = full * fraction;
      if (len < 0.02) {
        d.scale.set(0, 0, 0);
        d.updateMatrix();
        mesh.setMatrixAt(i++, d.matrix);
        return;
      }
      s.dir.normalize();
      s.mid.copy(s.from).addScaledVector(s.dir, len / 2);
      s.quat.setFromUnitVectors(s.up, s.dir);
      d.position.copy(s.mid);
      d.quaternion.copy(s.quat);
      d.scale.set(radius, len, radius);
      d.updateMatrix();
      mesh.setMatrixAt(i++, d.matrix);
    };

    // Kinetochore fibres: from the pole a chromatid faces to its kinetochore (unit-local).
    for (const ch of chromatids) {
      const st = L.chromatids[ch.key];
      if (st.unit !== index || st.condense < 0.4 || L.pose.phase === "telophase" || L.pose.phase === "cytokinesis") {
        d.scale.set(0, 0, 0);
        d.updateMatrix();
        mesh.setMatrixAt(i++, d.matrix);
        continue;
      }
      // Seats are unit-local, and so is this mesh (it sits inside the unit's group).
      place(st.pullDir * u.pole, 0, 0, st.seat[0] + st.pullDir * 0.06, st.seat[1], st.seat[2], grow * jitter, 0.02);
    }
    // Interpolar fibres from each pole, overlapping past the equator; they lengthen in anaphase B.
    for (const pole of [-1, 1]) {
      for (const f of fans.inter) {
        // From the pole to just past the equator, where they overlap the other pole's.
        place(pole * u.pole, 0, 0, pole * u.pole * (1 - f.len * grow), f.y * u.pole, f.z * u.pole, 1, 0.017);
      }
      for (const f of fans.astral) {
        const reach = f.len * grow;
        place(pole * u.pole, 0, 0, pole * (u.pole + reach), f.y * reach, f.z * reach, 1, 0.014);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (Math.abs(poison - s.lastPoison) > 0.01) {
      s.lastPoison = poison;
      s.colour.copy(MT_COLOUR).lerp(MT_POISONED, poison);
      mesh.material.color.copy(s.colour);
      mesh.material.emissive.copy(s.colour);
      mesh.material.opacity = 0.9 - 0.5 * poison;
    }
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, 1, 6, 1]} />
      <meshStandardMaterial color={COLOURS.microtubule} emissive={COLOURS.microtubule} emissiveIntensity={0.9} roughness={0.5} transparent opacity={0.9} toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * One chromatid: a dynamic tube along its own +y with the centromere at
 * the group origin. Sisters bow apart into an X; separated chromatids
 * sweep their arms back; chiasma arms cross over to the homologue; every
 * station is coloured by the parent it now comes from.
 */
function Chromatid({ live, ch }) {
  const groupRef = useRef(null);
  const matRef = useRef(null);
  const kinetoRef = useRef(null);
  const pair = PAIRS[ch.pair];
  const total = ARM_LENGTH * pair.length;
  const Lp = total * pair.centromere;
  const Lq = total - Lp;
  const tmp = useMemo(() => ({ colour: new THREE.Color(), own: new THREE.Color(ch.parent === "maternal" ? COLOURS.maternal : COLOURS.paternal), other: new THREE.Color(ch.parent === "maternal" ? COLOURS.paternal : COLOURS.maternal) }), [ch.parent]);

  // u: −1 at the p-arm tip, 0 at the centromere, +1 at the q-arm tip.
  const uOf = (s) => (s < Lp ? -(Lp - s) / Lp : (s - Lp) / Lq);

  const radiusAt = useCallback(
    (s) => {
      const st = live.current.chromatids[ch.key];
      const u = uOf(s);
      const tip = 1 - 0.55 * Math.pow(Math.abs(u), 6);
      const waist = 1 - 0.38 * Math.exp(-(u * u) / 0.012);
      return CHROMATID_RADIUS * (0.3 + 0.7 * st.condense) * tip * waist;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, ch.key, Lp, Lq],
  );

  const centreAt = useCallback(
    (s, out) => {
      const st = live.current.chromatids[ch.key];
      const u = uOf(s);
      const au = Math.abs(u);
      const armLen = u < 0 ? Lp : Lq;
      // Sisters bow away from each other along the pull axis (local x).
      const bow = st.side * st.bow * 0.16 * (1 - u * u) * pair.length;
      // A pulled chromatid trails its arms behind the kinetochore.
      const sweep = -st.pullDir * st.bend * 0.42 * au * armLen;
      // Decondensed chromatin wanders.
      const wander = (1 - st.condense) * 0.25 * Math.sin(s * 9 + live.current.clock * 0.6 + ch.pair);
      let x = bow + sweep + wander;
      let z = wander * 0.6;
      // Chiasma: beyond the crossover point the arm crosses to the homologue's side.
      if (st.chiasmaPull > 0.001) {
        for (const cx of live.current.plan) {
          if (cx.pair !== ch.pair || cx.which !== ch.which) continue;
          if ((cx.arm === "p") !== (u < 0)) continue;
          if (au > cx.u) {
            // Homologues sit at a = ±0.27; the distal arm crosses to the partner's side.
            const k = smoothstep(clamp((au - cx.u) / 0.25, 0, 1)) * st.chiasmaPull;
            x -= st.pullDir * 0.42 * k;
          }
        }
      }
      out[0] = x;
      out[1] = z;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, ch.key, ch.pair, ch.which, ch.parent, Lp, Lq, pair.length],
  );

  const colourAt = useCallback(
    (s, out) => {
      const st = live.current.chromatids[ch.key];
      const u = uOf(s);
      tmp.colour.copy(tmp.own).lerp(tmp.other, blendAt(ch, u, live.current.plan, st.reveal));
      // A faint dark band marks the centromere.
      const dark = 1 - 0.28 * Math.exp(-(u * u) / 0.01);
      out[0] = tmp.colour.r * dark;
      out[1] = tmp.colour.g * dark;
      out[2] = tmp.colour.b * dark;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, ch, Lp, Lq, tmp],
  );

  useFrame(() => {
    const st = live.current.chromatids[ch.key];
    const u = live.current.units[st.unit];
    const g = groupRef.current;
    if (!g || !u.frame) return;
    g.visible = st.visible && st.opacity > 0.02;
    g.position.copy(st.world);
    g.quaternion.copy(u.frame.quat);
    g.rotateZ(st.tilt);
    const stretch = 1 + 0.35 * (1 - st.condense);
    g.scale.set(u.frame.scale, u.frame.scale * stretch, u.frame.scale);
    if (matRef.current) matRef.current.opacity = st.opacity;
    const k = kinetoRef.current;
    if (k) {
      k.visible = st.condense > 0.5;
      k.position.set(st.pullDir * 0.07, 0, 0);
      k.material.opacity = st.opacity;
    }
  });

  return (
    <group ref={groupRef}>
      <group position={[0, -Lp, 0]}>
        <ProfiledTube length={total} rings={CHROMATID_RINGS} segments={CHROMATID_SEGMENTS} radiusAt={radiusAt} centreAt={centreAt} colourAt={colourAt} dynamic castShadow>
          <meshStandardMaterial ref={matRef} vertexColors roughness={0.45} metalness={0.05} emissive="#ffffff" emissiveIntensity={0.12} transparent opacity={1} />
        </ProfiledTube>
      </group>
      {/* Kinetochore: the protein plate on the centromere that the fibre grabs. */}
      <mesh ref={kinetoRef}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshStandardMaterial color={COLOURS.kinetochore} emissive={COLOURS.kinetochore} emissiveIntensity={0.9} transparent opacity={1} />
      </mesh>
    </group>
  );
}

/** Glowing markers where non-sister chromatids are held together at a chiasma. */
function Chiasmata({ live, chromatids }) {
  const ref = useRef(null);
  const count = 4;
  const state = useRef({ dummy: new THREE.Object3D(), p: new THREE.Vector3() });
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const L = live.current;
    const d = state.current.dummy;
    const p = state.current.p;
    const amount = L.pose ? L.pose.chiasmaVisible : 0;
    for (let i = 0; i < count; i += 1) {
      const cx = L.plan[i];
      if (!cx || amount < 0.02) {
        d.scale.set(0, 0, 0);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
        continue;
      }
      // Halfway between the two participants, at the crossover point along the arm.
      const pairKey = PAIRS[cx.pair];
      const mat = L.chromatids[`${pairKey.key}-maternal-${cx.which}`];
      const pat = L.chromatids[`${pairKey.key}-paternal-${cx.which}`];
      const u = L.units[mat.unit];
      const total = ARM_LENGTH * pairKey.length;
      const Lp = total * pairKey.centromere;
      const along = (cx.arm === "p" ? -Lp : total - Lp) * cx.u;
      p.set((mat.seat[0] + pat.seat[0]) / 2 - along * Math.sin(mat.tilt), (mat.seat[1] + pat.seat[1]) / 2 + along * Math.cos(mat.tilt), (mat.seat[2] + pat.seat[2]) / 2).applyMatrix4(u.frame.matrix);
      d.position.copy(p);
      d.scale.setScalar(0.09 * amount * (1 + 0.15 * Math.sin(clock.elapsedTime * 4 + i)));
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <torusGeometry args={[1, 0.35, 8, 20]} />
      <meshStandardMaterial color={COLOURS.chiasma} emissive={COLOURS.chiasma} emissiveIntensity={1.4} toneMapped={false} />
    </instancedMesh>
  );
}

/** One cell (or, in meiosis II, one daughter): its frame, membrane, nuclei, chromatin, centrosomes, spindle and furrow ring. */
function CellUnit({ live, index, chromatids }) {
  const ref = useRef(null);
  useFrame(() => {
    const u = live.current.units[index];
    const g = ref.current;
    if (!g) return;
    g.visible = u.active;
    if (!u.active) return;
    g.position.copy(u.frame.origin);
    g.quaternion.copy(u.frame.quat);
    g.scale.setScalar(u.frame.scale);
  });
  return (
    <group ref={ref}>
      <Membrane live={live} index={index} />
      <ContractileRing live={live} index={index} />
      <NuclearEnvelope live={live} index={index} which="centre" />
      <NuclearEnvelope live={live} index={index} which="left" />
      <NuclearEnvelope live={live} index={index} which="right" />
      <Chromatin live={live} index={index} which="centre" seed={3 + index} />
      <Chromatin live={live} index={index} which="left" seed={11 + index} />
      <Chromatin live={live} index={index} which="right" seed={19 + index} />
      <Centrosome live={live} index={index} which="left" />
      <Centrosome live={live} index={index} which="right" />
      <Spindle live={live} index={index} chromatids={chromatids} />
    </group>
  );
}

/** A sickly haze over the cell while the spindle poison is in. */
function PoisonHaze({ live }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const p = live.current.poison;
    m.visible = p > 0.02;
    m.material.opacity = 0.09 * p * (1 + 0.2 * Math.sin(clock.elapsedTime * 1.5));
    m.scale.setScalar(R * 1.25 + 0.4 * p);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicMaterial color={COLOURS.poison} transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
    </mesh>
  );
}

// ─── Labels ─────────────────────────────────────────────────────────

function Labels({ pose, modeKey, plan, poison, snapshot }) {
  if (!pose) return null;
  const meiosis = modeKey === "meiosis";
  const two = pose.division === 2;
  const xL = two ? -D2 : 0;
  const yTop = two ? R2 + 0.5 : R + 0.6;
  const items = [];
  const at = (x, y, z, text, tone, key) => items.push({ x, y, z, text, tone, key });

  if (poison > 0.4) {
    at(0, yTop + 0.7, 0, "colchicine · microtubules depolymerised — no spindle, no plate, no anaphase", "text-lime-300", "poison");
  }
  if (pose.phase === "interphase") {
    at(0, R * 0.62 + 0.35, 0.4, "nucleus · chromatin decondensed, already replicated in S phase", "text-violet-300", "nuc");
    at(0.55, R * 0.62 + 0.9, 0, "centrosome duplicated", "text-amber-300", "cen");
  }
  if (pose.phase === "prophase" && pose.condense > 0.5 && !two) {
    at(0, -R - 0.55, 0.3, meiosis ? "prophase I · homologues pair up — a bivalent is 2 chromosomes, 4 chromatids" : "prophase · each chromosome = 2 identical sister chromatids joined at the centromere", "text-ink-100", "pro");
    if (pose.envelope < 0.5) at(0, R * 0.62 + 0.55, 0.3, "nuclear envelope breaking down", "text-violet-300", "env");
  }
  if (pose.phase === "prophase" && two) {
    at(xL, -R2 - 0.55, 0.3, "prophase II · no replication — each chromosome is still 2 chromatids", "text-ink-100", "pro2");
  }
  if (pose.poles > 0.6 && pose.phase !== "cytokinesis" && pose.phase !== "interphase" && poison < 0.4) {
    const P = (R * (0.7 + 0.16 * pose.elongate)) * (two ? R2 / R : 1);
    if (two) {
      at(xL - 0.2, -P - 0.25, 0.3, "centrosome", "text-amber-300", "cL");
      at(D2 + 0.2, P + 0.25, 0.3, "centrosome", "text-amber-300", "cR");
    } else {
      at(-P - 0.15, 0.55, 0, "centrosome · spindle pole", "text-amber-300", "cL");
      at(P + 0.15, 0.55, 0, "centrosome · spindle pole", "text-amber-300", "cR");
    }
  }
  if (pose.phase === "metaphase" && pose.align > 0.7 && poison < 0.4) {
    if (meiosis && !two) {
      at(0, R + 0.35, 0, "metaphase I · bivalents on the plate — HOMOLOGUES face opposite poles", "text-sky-300", "plate");
      at(1.35, 0.72, 0.5, "homologous pair — red maternal, blue paternal", "text-rose-300", "homo");
    } else if (two) {
      at(xL, R2 + 0.35, 0, "metaphase II · single chromosomes on each plate", "text-sky-300", "plate2");
      at(xL + 0.9, 0.6, 0.6, "sister chromatids — identical", "text-rose-300", "sis2");
    } else {
      at(0, R + 0.35, 0, "metaphase plate · every chromosome's centromere on the equator", "text-sky-300", "plate");
      at(1.35, 0.78, 0.4, "sister chromatids — one chromosome, two copies", "text-rose-300", "sis");
    }
  }
  if (pose.phase === "anaphase" && pose.separate > 0.2) {
    const text = meiosis && !two ? "anaphase I · homologues part — sisters STAY together (reductional)" : two ? "anaphase II · sister chromatids part (equational)" : "anaphase · sister chromatids part — each is now a chromosome";
    at(two ? xL : 0, (two ? R2 : R) + 0.35, 0, text, "text-emerald-300", "ana");
    if (pose.elongate > 0.4) at(0, -(two ? R2 : R) - 0.55, 0.3, "anaphase B · interpolar fibres slide, the cell elongates", "text-sky-300", "anaB");
  }
  if (pose.phase === "telophase" && pose.envelope > 0.3) {
    at(two ? xL : 0, (two ? R2 : R) + 0.35, 0, meiosis && !two ? "telophase I · two haploid nuclei — n = 2, each chromosome still 2 chromatids" : two ? "telophase II · four haploid nuclei" : "telophase · two nuclei re-form, chromosomes decondense", "text-violet-300", "telo");
  }
  if (pose.phase === "cytokinesis" && pose.furrow > 0.1) {
    at(two ? xL : 0, -(two ? R2 : R) - 0.55, 0.3, pose.furrow < 0.95 ? "cleavage furrow · actin–myosin ring tightens" : meiosis && !two ? "two haploid cells · now meiosis II, with no S phase between" : two ? "four gametes · n = 2, none identical" : "two identical diploid cells · 2n = 4", "text-amber-300", "furrow");
  }
  if (meiosis && !two && pose.chiasmaVisible > 0.5 && plan.length > 0) {
    at(-1.25, -0.2, 0.7, `${plan.length} chiasma${plan.length === 1 ? "" : "ta"} · non-sister chromatids swap arms`, "text-yellow-200", "chi");
  }
  if (meiosis && !two && pose.phase === "prophase" && pose.chiasmaVisible > 0.5 && plan.length === 0) {
    at(-1.25, -0.2, 0.7, "no chiasmata · arms keep their parent's alleles", "text-ink-400", "chi0");
  }

  return (
    <>
      {items.map((it) => (
        <SceneLabel key={it.key} position={[it.x, it.y, it.z]} tone={it.tone}>
          {it.text}
        </SceneLabel>
      ))}
      <StageCaption position={[0, -(two ? R2 : R) - 1.25, 0.4]} snapshot={snapshot} arrestedLabel="arrested by colchicine" />
    </>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function MitosisMeiosisCanvas({ params = {}, setParam }) {
  const { mode: modeParam = "mitosis", stage = 0, playing = true, chiasmata = 2, colchicine = 0, speed = 1 } = params || {};
  const mode = modeFor(modeParam);
  const cycle = cycleFor(mode.key);
  const chromatids = useMemo(() => listChromatids(), []);
  const live = useRef(null);
  if (live.current === null) live.current = makeLiveBag(chromatids);
  const plan = useMemo(() => (mode.key === "meiosis" ? chiasmaPlan(chiasmata) : []), [mode.key, chiasmata]);
  useEffect(() => {
    live.current.plan = plan;
  }, [plan]);

  const lock = colchicineApplied(colchicine) ? arrestIndexFor(mode.key) : null;
  const stepperLive = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [pose, setPose] = useState(null);
  const [poison, setPoison] = useState(0);

  const onFrame = useCallback(
    (snap) => {
      choreograph(live.current, snap, mode.key, chromatids, snap.dt);
    },
    [mode.key, chromatids],
  );
  const onTick = useCallback((snap) => {
    setSnapshot(snap);
    setPose(live.current.pose);
    setPoison(Math.round(live.current.poison * 20) / 20);
  }, []);

  return (
    <SceneCanvas
      camera={{ position: [0.6, 2.4, 10.5], fov: 44 }}
      controls={{ minDistance: 4, maxDistance: 26, target: [0, 0, 0] }}
      lights={{ ambient: 0.55, keyLight: 1.25, rim: PALETTE.violet }}
    >
      <StageCycleDriver cycle={cycle} stage={stage} playing={playing} speed={speed} lock={lock} live={stepperLive} setParam={setParam} onFrame={onFrame} onTick={onTick} />

      <CellUnit live={live} index={0} chromatids={chromatids} />
      <CellUnit live={live} index={1} chromatids={chromatids} />
      {chromatids.map((ch) => (
        <Chromatid key={ch.key} live={live} ch={ch} />
      ))}
      <Chiasmata live={live} chromatids={chromatids} />
      <PoisonHaze live={live} />

      <Labels pose={pose} modeKey={mode.key} plan={plan} poison={poison} snapshot={snapshot} />

      <SceneReadout title={mode.short} subtitle={pose ? pose.label : ""} rows={[]} />
      <SceneLegend
        title="Chromosomes"
        items={[
          { color: COLOURS.maternal, label: "Maternal chromatids", note: "red" },
          { color: COLOURS.paternal, label: "Paternal chromatids", note: "blue" },
          { color: COLOURS.microtubule, label: "Spindle microtubules", note: "from the centrosomes" },
        ]}
      />
    </SceneCanvas>
  );
}
