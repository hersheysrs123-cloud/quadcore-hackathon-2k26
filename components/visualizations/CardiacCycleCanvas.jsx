"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import { StageCaption, StageCycleDriver } from "@/components/visualizations/stage-stepper";
import {
  CARDIAC_CYCLE,
  EDV_REST,
  beatTime,
  hemodynamicsAtCycle,
  pathologyFor,
  soundMarkers,
  tempoFor,
  wiggersSamples,
} from "@/lib/cardiacCycle";

// ─── The cardiac cycle ──────────────────────────────────────────────
// A four-chamber heart sectioned like a textbook plate: each chamber is
// the BACK half of a thick-walled sphere, so the camera looks straight into
// the cavities and sees the cut edge of the myocardium — thin round the
// atria, thicker round the right ventricle, thickest round the left. The
// cavity radius is set from the chamber's volume every frame and the wall
// swells to keep its own volume, so the left ventricle visibly thickens as
// it squeezes.
//
// Everything else hangs off one hemodynamic state per frame
// (`hemodynamicsAtCycle` in `lib/cardiacCycle.js`, read from the stepper's
// clock): the four valves' leaflets swing on their annuli by the model's
// open fraction; blood particles run the inflow and outflow paths at the
// model's flow rates; the conduction tubes reveal themselves along their
// length as the impulse travels SA → AV → His → Purkinje; a glow pulses at
// a valve when it shuts (S1, S2). The Wiggers panel beside the heart is
// ONE beat sampled at the current rate and pathology — rebuilt only when
// those change — with a cursor riding the same clock, and a scrolling
// monitor strip draws the live ECG underneath.
//
// Playing, the stepper runs at the per-stage tempo `tempoFor(bpm)` gives
// it, so systole and diastole shorten by their own physiological amounts;
// stepping parks on each phase's textbook moment.
// ─────────────────────────────────────────────────────────────────────

const COLOURS = {
  myocardium: "#b91c1c",
  myocardiumDark: "#7f1d1d",
  endocardium: "#fca5a5",
  bloodLeft: "#ef4444",
  bloodRight: "#3b82f6",
  bloodLeftDim: "#7f1d1d",
  bloodRightDim: "#1e3a8a",
  vesselLeft: "#dc2626",
  vesselRight: "#2563eb",
  leaflet: "#fde2e2",
  leafletStenotic: "#e5d5a0",
  calcium: "#fef3c7",
  annulus: "#fecaca",
  node: "#fde047",
  conduction: "#fbbf24",
  conductionIdle: "#78350f",
  chaos: "#f97316",
  panel: "#0d121c",
  traceLV: "#f87171",
  traceAo: "#fbbf24",
  traceLA: "#c084fc",
  traceVol: "#38bdf8",
  traceEcg: "#4ade80",
  tracePhono: "#e2e8f0",
  cursor: "#ffffff",
};

/** Chamber layout: viewer's left is the patient's right. Radii at rest, world units. */
const CHAMBERS = {
  ra: { centre: [-1.46, 1.22, 0], cavity: 0.78, wall: 0.1, scaleY: 0.95, side: "right", kind: "atrium", label: "Right atrium" },
  la: { centre: [1.42, 1.26, 0], cavity: 0.74, wall: 0.11, scaleY: 0.95, side: "left", kind: "atrium", label: "Left atrium" },
  rv: { centre: [-1.05, -1.22, 0], cavity: 1.0, wall: 0.16, scaleY: 1.24, side: "right", kind: "ventricle", label: "Right ventricle" },
  lv: { centre: [1.14, -1.26, 0], cavity: 0.98, wall: 0.36, scaleY: 1.24, side: "left", kind: "ventricle", label: "Left ventricle" },
};

const VALVES = {
  tricuspid: { centre: [-1.22, 0.24, -0.2], radius: 0.46, leaflets: 3, kind: "av", side: "right", label: "tricuspid valve" },
  mitral: { centre: [1.26, 0.26, -0.2], radius: 0.44, leaflets: 2, kind: "av", side: "left", label: "mitral (bicuspid) valve" },
  pulmonary: { centre: [-0.62, 0.7, -0.55], radius: 0.3, leaflets: 3, kind: "semilunar", side: "right", label: "pulmonary valve" },
  aortic: { centre: [0.5, 0.62, -0.6], radius: 0.3, leaflets: 3, kind: "semilunar", side: "left", label: "aortic valve" },
};

const PANEL = { x: 3.55, y: -2.45, width: 5.1, height: 5.3 };
const STRIP = { x: 3.55, y: -3.55, width: 5.1, height: 0.75, samples: 360, seconds: 3 };

// ─── Anatomy ────────────────────────────────────────────────────────

/** The cut edge of a chamber wall: an annulus in the z = 0 plane, rewritten as the radii change. */
function CutFace({ live, id, segments = 56 }) {
  const built = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const index = [];
    for (let i = 0; i < segments; i += 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(index);
    const normals = new Float32Array((segments + 1) * 2 * 3);
    for (let i = 0; i < (segments + 1) * 2; i += 1) normals[i * 3 + 2] = 1;
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    return { geometry, positions };
  }, [segments]);
  useEffect(() => () => built.geometry.dispose(), [built]);

  useFrame(() => {
    const c = live.current.chambers[id];
    const p = built.positions;
    for (let i = 0; i <= segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const k = i * 6;
      p[k] = cos * c.inner;
      p[k + 1] = sin * c.inner;
      p[k + 2] = 0;
      p[k + 3] = cos * c.outer;
      p[k + 4] = sin * c.outer;
      p[k + 5] = 0;
    }
    built.geometry.attributes.position.needsUpdate = true;
    built.geometry.computeBoundingSphere();
  });

  return (
    <mesh geometry={built.geometry}>
      <meshStandardMaterial color={COLOURS.myocardium} roughness={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** One chamber: outer muscle shell, inner blood-lined cavity, and the cut face between them. */
function Chamber({ live, id }) {
  const spec = CHAMBERS[id];
  const group = useRef(null);
  const outer = useRef(null);
  const inner = useRef(null);
  const blood = useRef(null);
  const bloodColour = spec.side === "left" ? COLOURS.bloodLeft : COLOURS.bloodRight;

  useFrame(() => {
    const c = live.current.chambers[id];
    const g = group.current;
    if (!g) return;
    g.position.set(spec.centre[0] + c.jitter[0], spec.centre[1] + c.jitter[1], spec.centre[2]);
    g.scale.set(1, spec.scaleY, 1);
    if (outer.current) outer.current.scale.setScalar(c.outer);
    if (inner.current) inner.current.scale.setScalar(c.inner);
    if (blood.current) {
      blood.current.scale.setScalar(c.inner * 0.985);
      blood.current.material.opacity = 0.55 + 0.35 * c.fullness;
    }
  });

  return (
    <group ref={group}>
      {/* Back half only: phi from π to 2π keeps z ≤ 0, so the cavity faces the camera. */}
      <mesh ref={outer} receiveShadow castShadow>
        <sphereGeometry args={[1, 44, 30, Math.PI, Math.PI]} />
        <meshStandardMaterial color={spec.kind === "ventricle" ? COLOURS.myocardium : COLOURS.myocardiumDark} roughness={0.75} side={THREE.FrontSide} />
      </mesh>
      <mesh ref={inner}>
        <sphereGeometry args={[1, 44, 30, Math.PI, Math.PI]} />
        <meshStandardMaterial color={COLOURS.endocardium} roughness={0.5} side={THREE.BackSide} />
      </mesh>
      <mesh ref={blood}>
        <sphereGeometry args={[1, 32, 22, Math.PI, Math.PI]} />
        <meshStandardMaterial color={bloodColour} emissive={bloodColour} emissiveIntensity={0.25} roughness={0.3} transparent opacity={0.7} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <CutFace live={live} id={id} />
    </group>
  );
}

/** The septa: slabs between the two sides, back half only. */
function Septa() {
  return (
    <group>
      <mesh position={[0.02, -1.3, -0.62]}>
        <boxGeometry args={[0.34, 2.6, 1.24]} />
        <meshStandardMaterial color={COLOURS.myocardium} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.2, -0.62]}>
        <boxGeometry args={[0.16, 1.5, 1.24]} />
        <meshStandardMaterial color={COLOURS.myocardiumDark} roughness={0.8} />
      </mesh>
      {/* The fibrous skeleton between atria and ventricles. */}
      <mesh position={[0, 0.25, -0.62]}>
        <boxGeometry args={[4.9, 0.14, 1.24]} />
        <meshStandardMaterial color={COLOURS.annulus} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** A tube along a few points: the great vessels. */
function Vessel({ points, radius, colour, taper = false }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.4);
    return new THREE.TubeGeometry(curve, 40, radius, 14, false);
  }, [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={colour} roughness={0.55} transparent={taper} opacity={taper ? 0.85 : 1} />
    </mesh>
  );
}

const AORTA = [
  [0.5, 0.62, -0.6],
  [0.55, 1.65, -0.78],
  [0.25, 2.55, -0.8],
  [-0.55, 2.9, -0.7],
  [-1.25, 2.5, -0.75],
  [-1.5, 1.7, -0.95],
];
const PULMONARY = [
  [-0.62, 0.7, -0.55],
  [-0.6, 1.5, -0.45],
  [-0.9, 2.15, -0.35],
];
const PULMONARY_LEFT = [
  [-0.9, 2.15, -0.35],
  [-0.2, 2.35, -0.25],
  [0.6, 2.25, -0.3],
];
const SVC = [
  [-1.55, 2.9, -0.45],
  [-1.5, 2.2, -0.45],
  [-1.46, 1.75, -0.4],
];
const IVC = [
  [-2.9, 0.15, -0.55],
  [-2.35, 0.55, -0.5],
  [-2.05, 0.85, -0.45],
];
const PV_UPPER = [
  [2.85, 1.85, -0.5],
  [2.3, 1.55, -0.45],
  [1.98, 1.4, -0.4],
];
const PV_LOWER = [
  [2.9, 0.75, -0.5],
  [2.35, 0.95, -0.45],
  [2.0, 1.05, -0.4],
];

/**
 * One valve: an annulus with `n` leaflets hinged on its rim. AV leaflets
 * swing DOWN into the ventricle to open; semilunar leaflets swing UP into
 * the artery. A stenotic aortic valve has thick, nodular leaflets that
 * barely move.
 */
function Valve({ live, id, stenotic }) {
  const spec = VALVES[id];
  const n = spec.leaflets;
  const leafRefs = useRef([]);
  const glow = useRef(null);
  const hinges = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const theta = ((i + 0.5) / n) * Math.PI * 2;
        return {
          theta,
          position: new THREE.Vector3(Math.cos(theta) * spec.radius, 0, Math.sin(theta) * spec.radius),
          // Tangent to the rim in the valve's plane (XZ): the hinge axis.
          axis: new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta)).normalize(),
        };
      }),
    [n, spec.radius],
  );
  // Each leaflet is a circle sector built in the XZ plane and translated so its rim midpoint is at the origin.
  const geometries = useMemo(
    () =>
      hinges.map((h) => {
        const g = new THREE.CircleGeometry(spec.radius * 0.98, 12, h.theta - Math.PI / n, (Math.PI * 2) / n);
        // CircleGeometry lies in XY; lay it flat in XZ (y ↦ z, so a point at angle θ lands at (r cos θ, 0, r sin θ), on the hinge).
        g.rotateX(Math.PI / 2);
        g.translate(-h.position.x, 0, -h.position.z);
        return g;
      }),
    [hinges, spec.radius, n],
  );
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  const nodules = useMemo(
    () =>
      stenotic
        ? Array.from({ length: 9 }, (_, i) => {
            const t = hashRandom(i * 3 + 1) * Math.PI * 2;
            const r = spec.radius * (0.3 + 0.55 * hashRandom(i * 5 + 2));
            return [Math.cos(t) * r, 0.035, Math.sin(t) * r, 0.03 + 0.03 * hashRandom(i * 7 + 3)];
          })
        : [],
    [stenotic, spec.radius],
  );
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const v = live.current.valves[id];
    const open = v.open;
    // Closed leaflets meet at the centre; open ones swing through up to 68°.
    // A positive angle about the rim tangent swings the free edge DOWN (−y):
    // into the ventricle for an AV valve, so semilunar leaflets take the negative.
    const angle = (spec.kind === "av" ? 1 : -1) * open * (68 * Math.PI) / 180;
    for (let i = 0; i < n; i += 1) {
      const m = leafRefs.current[i];
      if (!m) continue;
      tmpQ.setFromAxisAngle(hinges[i].axis, angle);
      m.quaternion.copy(tmpQ);
    }
    const g = glow.current;
    if (g) {
      g.visible = v.sound > 0.05;
      g.scale.setScalar(spec.radius * (1.2 + 1.6 * v.sound));
      g.material.opacity = 0.55 * v.sound;
    }
  });

  return (
    <group position={spec.centre}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[spec.radius, 0.035, 8, 40]} />
        <meshStandardMaterial color={COLOURS.annulus} roughness={0.6} />
      </mesh>
      {hinges.map((h, i) => (
        <group key={i} position={h.position} ref={(el) => (leafRefs.current[i] = el)}>
          <mesh geometry={geometries[i]} castShadow>
            <meshStandardMaterial color={stenotic ? COLOURS.leafletStenotic : COLOURS.leaflet} roughness={stenotic ? 0.9 : 0.35} side={THREE.DoubleSide} transparent opacity={stenotic ? 1 : 0.92} />
          </mesh>
        </group>
      ))}
      {nodules.map((p, i) => (
        <mesh key={`n${i}`} position={[p[0], p[1], p[2]]}>
          <sphereGeometry args={[p[3], 8, 6]} />
          <meshStandardMaterial color={COLOURS.calcium} roughness={0.9} />
        </mesh>
      ))}
      {/* The sound: a ring of light that blooms as the leaflets slam shut. */}
      <mesh ref={glow} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── Blood ──────────────────────────────────────────────────────────

const STREAMS = [
  { key: "svc", points: [[-1.55, 2.9, -0.45], [-1.5, 1.9, -0.4], [-1.46, 1.1, -0.3]], colour: COLOURS.bloodRight, drive: "venous", count: 8 },
  { key: "ivc", points: [[-2.9, 0.15, -0.55], [-2.2, 0.75, -0.45], [-1.5, 1.05, -0.3]], colour: COLOURS.bloodRight, drive: "venous", count: 8 },
  { key: "pv", points: [[2.85, 1.85, -0.5], [2.2, 1.45, -0.4], [1.42, 1.16, -0.3]], colour: COLOURS.bloodLeft, drive: "venous", count: 8 },
  { key: "pv2", points: [[2.9, 0.75, -0.5], [2.3, 1.0, -0.4], [1.5, 1.2, -0.3]], colour: COLOURS.bloodLeft, drive: "venous", count: 6 },
  { key: "tricuspid", points: [[-1.46, 1.1, -0.3], [-1.22, 0.24, -0.2], [-1.05, -1.05, -0.3]], colour: COLOURS.bloodRight, drive: "av", count: 14 },
  { key: "mitral", points: [[1.42, 1.15, -0.3], [1.26, 0.26, -0.2], [1.14, -1.1, -0.3]], colour: COLOURS.bloodLeft, drive: "av", count: 14 },
  { key: "pulmonary", points: [[-1.05, -0.9, -0.35], [-0.75, 0.0, -0.5], [-0.62, 0.7, -0.55], [-0.6, 1.5, -0.45], [-0.9, 2.15, -0.35]], colour: COLOURS.bloodRight, drive: "semilunar", count: 16 },
  { key: "aorta", points: [[1.14, -0.95, -0.35], [0.8, -0.1, -0.5], [0.5, 0.62, -0.6], [0.55, 1.65, -0.78], [0.25, 2.55, -0.8], [-0.55, 2.9, -0.7]], colour: COLOURS.bloodLeft, drive: "semilunar", count: 18 },
];

/** Particles running one path at the model's flow rate for that path. */
function BloodStream({ live, stream }) {
  const ref = useRef(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(stream.points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.4), [stream.points]);
  const state = useRef({ dummy: new THREE.Object3D(), point: new THREE.Vector3(), phases: Array.from({ length: stream.count }, (_, i) => (i + hashRandom(i * 2.3 + 5) * 0.6) / stream.count), speed: 0 });

  useFrame((_, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const L = live.current;
    const s = state.current;
    const dt = Math.min(rawDelta, 1 / 30);
    const flow = L.flows[stream.drive];
    // Ease the speed so a valve snapping shut stops the stream over a few frames.
    s.speed += (flow - s.speed) * (1 - Math.exp(-dt * 12));
    const visible = s.speed > 0.03;
    mesh.visible = visible;
    if (!visible) return;
    const rate = (stream.drive === "venous" ? 0.35 : 0.9) * s.speed * L.speed;
    for (let i = 0; i < stream.count; i += 1) {
      s.phases[i] = (s.phases[i] + rate * dt) % 1;
      curve.getPointAt(s.phases[i], s.point);
      s.dummy.position.copy(s.point);
      const fade = Math.sin(Math.PI * s.phases[i]);
      s.dummy.scale.setScalar(0.05 * (0.6 + 0.6 * fade) * (0.5 + 0.5 * s.speed));
      s.dummy.updateMatrix();
      mesh.setMatrixAt(i, s.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, stream.count]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color={stream.colour} emissive={stream.colour} emissiveIntensity={0.9} roughness={0.4} toneMapped={false} />
    </instancedMesh>
  );
}

// ─── Conduction ─────────────────────────────────────────────────────

const PATHS = {
  atria: [[-0.95, 1.85, -0.5], [-1.5, 1.6, -0.55], [-1.85, 1.1, -0.5], [-1.4, 0.6, -0.55], [-0.75, 0.45, -0.55], [-0.35, 0.3, -0.58]],
  atriaLeft: [[-0.95, 1.85, -0.5], [-0.2, 1.7, -0.55], [0.7, 1.75, -0.5], [1.6, 1.5, -0.5], [1.9, 1.0, -0.5]],
  his: [[-0.35, 0.3, -0.58], [-0.1, -0.05, -0.65], [0.0, -0.55, -0.66], [0.0, -1.05, -0.66]],
  rightBranch: [[0.0, -1.05, -0.66], [-0.25, -1.75, -0.6], [-0.55, -2.25, -0.5], [-1.25, -2.15, -0.45], [-1.95, -1.55, -0.45], [-2.0, -0.7, -0.5], [-1.6, -0.2, -0.5]],
  leftBranch: [[0.0, -1.05, -0.66], [0.3, -1.8, -0.6], [0.75, -2.35, -0.5], [1.5, -2.2, -0.45], [2.1, -1.5, -0.45], [2.1, -0.6, -0.5], [1.7, -0.15, -0.5]],
};
const SA_NODE = [-0.95, 1.85, -0.5];
const AV_NODE = [-0.35, 0.3, -0.58];

/** A conduction tube revealed along its length by `progress`, glowing while active. */
function ConductionPath({ live, id, pick, radius = 0.028 }) {
  const ref = useRef(null);
  // Two copies of the tube: the dim full-length trace, and a lit one whose
  // draw range is the impulse's progress (a shared geometry would clip both).
  const built = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(PATHS[id].map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.4);
    const idle = new THREE.TubeGeometry(curve, 48, radius, 8, false);
    return { idle, lit: idle.clone() };
  }, [id, radius]);
  useEffect(
    () => () => {
      built.idle.dispose();
      built.lit.dispose();
    },
    [built],
  );
  const total = built.lit.index ? built.lit.index.count : 0;
  const colours = useMemo(() => ({ idle: new THREE.Color(COLOURS.conductionIdle), on: new THREE.Color(COLOURS.conduction), tmp: new THREE.Color() }), []);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const c = live.current.conduction;
    const progress = clamp(pick(c), 0, 1);
    // Reveal the lit stretch on top of a dim full-length trace (drawn by the sibling below).
    const shown = Math.max(0, Math.floor((total / 6) * progress) * 6);
    m.geometry.setDrawRange(0, shown);
    m.visible = shown > 0;
    colours.tmp.copy(colours.on);
    m.material.emissive.copy(colours.tmp);
    m.material.emissiveIntensity = 1.2 + 1.5 * (progress > 0 && progress < 1 ? 1 : 0.4);
  });

  return (
    <group>
      <mesh geometry={built.idle}>
        <meshStandardMaterial color={COLOURS.conductionIdle} emissive={COLOURS.conductionIdle} emissiveIntensity={0.25} roughness={0.6} />
      </mesh>
      <mesh ref={ref} geometry={built.lit} scale={[1.02, 1.02, 1.02]}>
        <meshStandardMaterial color={COLOURS.conduction} emissive={COLOURS.conduction} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Node({ live, pick, position, label, radius = 0.11 }) {
  const ref = useRef(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const a = clamp(pick(live.current.conduction), 0, 1);
    m.scale.setScalar(1 + 0.9 * a);
    m.material.emissiveIntensity = 0.3 + 2.4 * a;
  });
  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 16, 12]} />
        <meshStandardMaterial color={COLOURS.node} emissive={COLOURS.node} emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
      <SceneLabel position={[0, radius + 0.22, 0.2]} tone="text-amber-300">
        {label}
      </SceneLabel>
    </group>
  );
}

/** Fibrillation: sparks all over the ventricular walls, no order to them. */
function ChaosSparks({ live, count = 28 }) {
  const ref = useRef(null);
  const seats = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const left = i % 2 === 0;
        const spec = left ? CHAMBERS.lv : CHAMBERS.rv;
        const a = hashRandom(i * 1.7 + 3) * Math.PI;
        const b = (hashRandom(i * 2.9 + 5) - 0.5) * Math.PI * 0.9;
        const r = spec.cavity + spec.wall * 0.5;
        return { x: spec.centre[0] + Math.cos(a) * Math.cos(b) * r, y: spec.centre[1] + Math.sin(b) * r * spec.scaleY, z: spec.centre[2] - Math.abs(Math.sin(a)) * Math.cos(b) * r, phase: hashRandom(i * 3.3 + 7) * 20, rate: 6 + 8 * hashRandom(i * 4.1 + 9) };
      }),
    [count],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const chaos = live.current.conduction.chaos;
    mesh.visible = chaos > 0.02;
    if (!mesh.visible) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < seats.length; i += 1) {
      const s = seats[i];
      const flick = Math.max(0, Math.sin(t * s.rate + s.phase)) ** 6;
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.setScalar(0.06 + 0.16 * flick * chaos);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color={COLOURS.chaos} emissive={COLOURS.chaos} emissiveIntensity={2} toneMapped={false} />
    </instancedMesh>
  );
}

// ─── Traces ─────────────────────────────────────────────────────────

/** A polyline with a fixed vertex budget whose positions are written in place. */
function useTraceGeometry(n) {
  const built = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(n * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry, positions };
  }, [n]);
  useEffect(() => () => built.geometry.dispose(), [built]);
  return built;
}

const ROWS = {
  pressure: { y0: 3.05, h: 1.65, min: 0, max: 200 },
  volume: { y0: 1.75, h: 1.0, min: 30, max: 130 },
  ecg: { y0: 0.7, h: 0.85, min: -0.5, max: 1.7 },
  phono: { y0: 0.05, h: 0.45, min: 0, max: 1 },
};

/** One static trace of the sampled beat, rewritten when the samples change. */
function StaticTrace({ samples, pick, row, colour, width = PANEL.width }) {
  const built = useTraceGeometry(samples.length);
  useEffect(() => {
    const r = ROWS[row];
    const p = built.positions;
    for (let i = 0; i < samples.length; i += 1) {
      const s = samples[i];
      p[i * 3] = s.fraction * width;
      p[i * 3 + 1] = r.y0 + clamp((pick(s) - r.min) / (r.max - r.min), 0, 1) * r.h;
      p[i * 3 + 2] = 0.01;
    }
    built.geometry.attributes.position.needsUpdate = true;
    built.geometry.computeBoundingSphere();
  }, [samples, pick, row, width, built]);
  return (
    <line geometry={built.geometry}>
      <lineBasicMaterial color={colour} toneMapped={false} />
    </line>
  );
}

/** Vertical marker lines with labels: stage boundaries and S1 / S2. */
function Marker({ x, y0, h, colour, label, tone, dashed = false }) {
  const built = useTraceGeometry(2);
  useEffect(() => {
    const p = built.positions;
    p[0] = x;
    p[1] = y0;
    p[2] = 0.005;
    p[3] = x;
    p[4] = y0 + h;
    p[5] = 0.005;
    built.geometry.attributes.position.needsUpdate = true;
    built.geometry.computeBoundingSphere();
  }, [x, y0, h, built]);
  return (
    <group>
      <line geometry={built.geometry}>
        <lineBasicMaterial color={colour} transparent opacity={dashed ? 0.35 : 0.9} toneMapped={false} />
      </line>
      {label && (
        <SceneLabel position={[x, y0 + h + 0.18, 0]} tone={tone}>
          {label}
        </SceneLabel>
      )}
    </group>
  );
}

/** The Wiggers diagram: pressures, volume, ECG and phonocardiogram over one beat, with a cursor on the live clock. */
function WiggersPanel({ live, bpm, pathology }) {
  const data = useMemo(() => wiggersSamples(bpm, pathology, 240), [bpm, pathology]);
  const markers = useMemo(() => soundMarkers(bpm), [bpm]);
  const cursor = useRef(null);
  const picks = useMemo(
    () => ({
      lv: (s) => s.pLV,
      ao: (s) => s.pAo,
      la: (s) => s.pLA,
      vol: (s) => s.vLV,
      ecg: (s) => s.ecg,
      phono: (s) => s.sound,
    }),
    [],
  );
  useFrame(() => {
    const c = cursor.current;
    if (!c) return;
    c.position.x = live.current.beatFraction * PANEL.width;
  });
  const tl = data.timeline;
  const boundaries = CARDIAC_CYCLE.stages.map((s) => ({ key: s.key, x: (tl.starts[s.key] / tl.period) * PANEL.width, short: s.short }));
  const summary = data.summary;

  return (
    <group position={[PANEL.x, PANEL.y, 0]}>
      <mesh position={[PANEL.width / 2, PANEL.height / 2 - 0.15, -0.05]}>
        <planeGeometry args={[PANEL.width + 0.6, PANEL.height + 0.7]} />
        <meshBasicMaterial color={COLOURS.panel} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <SceneLabel position={[PANEL.width / 2, PANEL.height + 0.2, 0]} accent>
        {`Wiggers diagram · one beat at ${Math.round(tl.bpm)} bpm · ${tl.period.toFixed(2)} s`}
      </SceneLabel>

      {/* Stage boundaries. */}
      {boundaries.map((b, i) => (
        <Marker key={b.key} x={b.x} y0={0} h={PANEL.height - 0.3} colour={PALETTE.slate} dashed label={i % 2 === 0 ? b.short : undefined} tone="text-ink-500" />
      ))}
      {boundaries
        .filter((_, i) => i % 2 === 1)
        .map((b) => (
          <SceneLabel key={`${b.key}-lo`} position={[b.x, -0.3, 0]} tone="text-ink-500">
            {b.short}
          </SceneLabel>
        ))}

      {/* Pressure row. */}
      <StaticTrace samples={data.samples} pick={picks.lv} row="pressure" colour={COLOURS.traceLV} />
      <StaticTrace samples={data.samples} pick={picks.ao} row="pressure" colour={COLOURS.traceAo} />
      <StaticTrace samples={data.samples} pick={picks.la} row="pressure" colour={COLOURS.traceLA} />
      <SceneLabel position={[-0.55, ROWS.pressure.y0 + ROWS.pressure.h, 0]} tone="text-rose-300">
        {`${ROWS.pressure.max} mmHg`}
      </SceneLabel>
      <SceneLabel position={[-0.55, ROWS.pressure.y0, 0]} tone="text-ink-500">
        0
      </SceneLabel>
      <SceneLabel position={[PANEL.width + 0.5, ROWS.pressure.y0 + ROWS.pressure.h * 0.78, 0]} tone="text-rose-300">
        LV
      </SceneLabel>
      <SceneLabel position={[PANEL.width + 0.5, ROWS.pressure.y0 + ROWS.pressure.h * 0.52, 0]} tone="text-amber-300">
        aorta
      </SceneLabel>
      <SceneLabel position={[PANEL.width + 0.5, ROWS.pressure.y0 + ROWS.pressure.h * 0.1, 0]} tone="text-violet-300">
        LA
      </SceneLabel>

      {/* Volume row. */}
      <StaticTrace samples={data.samples} pick={picks.vol} row="volume" colour={COLOURS.traceVol} />
      <SceneLabel position={[-0.55, ROWS.volume.y0 + ROWS.volume.h, 0]} tone="text-sky-300">
        {`${ROWS.volume.max} mL`}
      </SceneLabel>
      <SceneLabel position={[PANEL.width + 0.5, ROWS.volume.y0 + ROWS.volume.h * 0.5, 0]} tone="text-sky-300">
        {`LV vol · SV ${Math.round(summary.strokeVolume)}`}
      </SceneLabel>

      {/* ECG row. */}
      <StaticTrace samples={data.samples} pick={picks.ecg} row="ecg" colour={COLOURS.traceEcg} />
      <SceneLabel position={[PANEL.width + 0.5, ROWS.ecg.y0 + ROWS.ecg.h * 0.5, 0]} tone="text-emerald-300">
        ECG
      </SceneLabel>

      {/* Phonocardiogram row with S1 / S2 markers. */}
      <StaticTrace samples={data.samples} pick={picks.phono} row="phono" colour={COLOURS.tracePhono} />
      {pathology !== "vfib" && (
        <>
          <Marker x={markers.s1 * PANEL.width} y0={ROWS.phono.y0} h={ROWS.phono.h} colour={COLOURS.tracePhono} label="S1 · lub" tone="text-ink-100" />
          <Marker x={markers.s2 * PANEL.width} y0={ROWS.phono.y0} h={ROWS.phono.h} colour={COLOURS.tracePhono} label="S2 · dub" tone="text-ink-100" />
        </>
      )}
      <SceneLabel position={[PANEL.width + 0.5, ROWS.phono.y0 + ROWS.phono.h * 0.5, 0]} tone="text-ink-300">
        sounds
      </SceneLabel>

      {/* The cursor: where the heart is now. */}
      <mesh ref={cursor} position={[0, (PANEL.height - 0.3) / 2, 0.02]}>
        <planeGeometry args={[0.03, PANEL.height - 0.3]} />
        <meshBasicMaterial color={COLOURS.cursor} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A monitor strip: the last few seconds of ECG scrolling left. */
function EcgStrip({ live }) {
  const built = useTraceGeometry(STRIP.samples);
  const ring = useRef({ values: new Float32Array(STRIP.samples), head: 0, acc: 0 });
  const perSample = STRIP.seconds / STRIP.samples;

  useFrame((_, rawDelta) => {
    const r = ring.current;
    const dt = Math.min(rawDelta, 1 / 30) * live.current.speed;
    r.acc += dt;
    const v = live.current.ecg;
    while (r.acc >= perSample) {
      r.acc -= perSample;
      r.values[r.head] = v;
      r.head = (r.head + 1) % STRIP.samples;
    }
    const p = built.positions;
    for (let i = 0; i < STRIP.samples; i += 1) {
      const idx = (r.head + i) % STRIP.samples;
      p[i * 3] = (i / (STRIP.samples - 1)) * STRIP.width;
      p[i * 3 + 1] = clamp((r.values[idx] + 0.5) / 2.2, 0, 1) * STRIP.height;
      p[i * 3 + 2] = 0.01;
    }
    built.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group position={[STRIP.x, STRIP.y - STRIP.height, 0]}>
      <mesh position={[STRIP.width / 2, STRIP.height / 2, -0.05]}>
        <planeGeometry args={[STRIP.width + 0.6, STRIP.height + 0.5]} />
        <meshBasicMaterial color="#04140a" transparent opacity={0.92} depthWrite={false} />
      </mesh>
      <line geometry={built.geometry} frustumCulled={false}>
        <lineBasicMaterial color={COLOURS.traceEcg} toneMapped={false} />
      </line>
      <SceneLabel position={[STRIP.width / 2, STRIP.height + 0.3, 0]} tone="text-emerald-300">
        {`live ECG · last ${STRIP.seconds} s`}
      </SceneLabel>
    </group>
  );
}

// ─── Choreography ───────────────────────────────────────────────────

function makeLiveBag() {
  return {
    h: null,
    speed: 1,
    vfT: 0,
    beatFraction: 0,
    ecg: 0,
    chambers: {
      ra: { inner: CHAMBERS.ra.cavity, outer: CHAMBERS.ra.cavity + CHAMBERS.ra.wall, fullness: 1, jitter: [0, 0] },
      la: { inner: CHAMBERS.la.cavity, outer: CHAMBERS.la.cavity + CHAMBERS.la.wall, fullness: 1, jitter: [0, 0] },
      rv: { inner: CHAMBERS.rv.cavity, outer: CHAMBERS.rv.cavity + CHAMBERS.rv.wall, fullness: 1, jitter: [0, 0] },
      lv: { inner: CHAMBERS.lv.cavity, outer: CHAMBERS.lv.cavity + CHAMBERS.lv.wall, fullness: 1, jitter: [0, 0] },
    },
    valves: { tricuspid: { open: 1, sound: 0 }, mitral: { open: 1, sound: 0 }, pulmonary: { open: 0, sound: 0 }, aortic: { open: 0, sound: 0 } },
    flows: { venous: 0.5, av: 0, semilunar: 0 },
    conduction: { sa: 0, atria: 0, av: 0, his: 0, purkinje: 0, chaos: 0 },
  };
}

const wallOuter = (inner, spec, thick = 1) => Math.cbrt(inner ** 3 + (spec.cavity + spec.wall * thick) ** 3 - spec.cavity ** 3);

function choreograph(live, snap, bpm, pathology, speed, clock) {
  const vf = pathology === "vfib";
  live.speed = speed;
  live.vfT = vf ? live.vfT + snap.dt * speed : 0;
  const h = hemodynamicsAtCycle(snap.t, bpm, pathology, { vfTime: live.vfT });
  live.h = h;
  live.ecg = h.ecg;
  live.beatFraction = beatTime(bpm, snap.t) / h.summary.period;

  const hypertrophy = pathology === "stenosis" ? 1.4 : 1;
  const quiver = vf ? 0.02 * Math.sin(clock * 38) * h.quiver : 0;
  const ventricleScale = Math.cbrt(clamp(h.vLV, 20, 140) / EDV_REST);
  for (const id of ["lv", "rv"]) {
    const spec = CHAMBERS[id];
    const c = live.chambers[id];
    c.inner = spec.cavity * ventricleScale * (1 + quiver);
    c.outer = wallOuter(c.inner, spec, id === "lv" ? hypertrophy : 1) * (1 + 0.04 * h.wallTension);
    c.fullness = clamp((h.vLV - 40) / 80, 0, 1);
    c.jitter[0] = vf ? 0.02 * Math.sin(clock * 41 + (id === "lv" ? 1 : 0)) : 0;
    c.jitter[1] = vf ? 0.02 * Math.cos(clock * 37) : 0;
  }
  for (const id of ["la", "ra"]) {
    const spec = CHAMBERS[id];
    const c = live.chambers[id];
    // Atria squeeze in atrial systole and swell while the ventricles are shut.
    c.inner = spec.cavity * (1 - 0.2 * h.atrialSqueeze) * (1 + 0.07 * h.ventricularSqueeze);
    c.outer = wallOuter(c.inner, spec) * (1 + 0.05 * h.atrialSqueeze);
    c.fullness = 1 - 0.5 * h.atrialSqueeze;
    c.jitter[0] = 0;
    c.jitter[1] = 0;
  }
  live.valves.tricuspid.open = h.valves.tricuspid;
  live.valves.mitral.open = h.valves.mitral;
  live.valves.pulmonary.open = h.valves.pulmonary;
  live.valves.aortic.open = h.valves.aortic;
  live.valves.tricuspid.sound = h.sounds.s1;
  live.valves.mitral.sound = h.sounds.s1;
  live.valves.pulmonary.sound = h.sounds.s2;
  live.valves.aortic.sound = h.sounds.s2 + 0.5 * h.sounds.murmur;
  live.flows.venous = vf ? 0.15 : 0.35 + 0.3 * h.ventricularSqueeze;
  live.flows.av = h.flow.av;
  live.flows.semilunar = h.flow.semilunar;
  const k = h.conduction;
  live.conduction.sa = k.sa;
  live.conduction.atria = k.atria;
  live.conduction.av = k.av;
  live.conduction.his = k.his;
  live.conduction.purkinje = k.purkinje;
  live.conduction.chaos = k.chaos;
}

// ─── Labels ─────────────────────────────────────────────────────────

function Labels({ h, pathology, snapshot }) {
  const items = [];
  const at = (x, y, z, text, tone, key) => items.push({ x, y, z, text, tone, key });
  for (const id of Object.keys(CHAMBERS)) {
    const s = CHAMBERS[id];
    at(s.centre[0], s.centre[1] + (s.kind === "ventricle" ? -0.15 : -0.3), 0.25, s.label, s.side === "left" ? "text-rose-200" : "text-sky-200", id);
  }
  at(VALVES.tricuspid.centre[0] - 0.05, VALVES.tricuspid.centre[1] - 0.34, 0.3, VALVES.tricuspid.label, "text-ink-300", "tri");
  at(VALVES.mitral.centre[0] + 0.05, VALVES.mitral.centre[1] - 0.34, 0.3, VALVES.mitral.label, "text-ink-300", "mit");
  at(VALVES.pulmonary.centre[0] + 0.15, VALVES.pulmonary.centre[1] + 0.42, 0.1, VALVES.pulmonary.label, "text-ink-300", "pul");
  at(VALVES.aortic.centre[0] + 0.1, VALVES.aortic.centre[1] + 0.42, 0.1, pathology === "stenosis" ? "aortic valve · STENOTIC — calcified, opens a third" : VALVES.aortic.label, pathology === "stenosis" ? "text-amber-300" : "text-ink-300", "ao");
  at(0.95, 2.3, -0.5, "aorta", "text-rose-300", "aorta");
  at(-1.75, 2.35, -0.2, "pulmonary trunk", "text-sky-300", "pt");
  at(-2.15, 2.95, -0.3, "superior vena cava", "text-sky-300", "svc");
  at(-3.1, -0.1, -0.5, "inferior vena cava", "text-sky-300", "ivc");
  at(2.6, 1.9, -0.5, "pulmonary veins", "text-rose-300", "pv");
  if (h) {
    if (h.sounds.s1 > 0.45) at(0, -0.3, 0.6, "S1 · 'lub' — AV valves shut", "text-ink-100", "s1");
    if (h.sounds.s2 > 0.45) at(0, 1.45, 0.4, "S2 · 'dub' — semilunar valves shut", "text-ink-100", "s2");
    if (h.sounds.murmur > 0.35) at(0.5, 1.45, 0.3, "ejection murmur — turbulent jet through the narrowed valve", "text-amber-300", "murmur");
    at(0, -2.95, 0.3, h.conduction.label, pathology === "vfib" ? "text-orange-300" : "text-amber-200", "cond");
  }
  return (
    <>
      {items.map((it) => (
        <SceneLabel key={it.key} position={[it.x, it.y, it.z]} tone={it.tone}>
          {it.text}
        </SceneLabel>
      ))}
      <StageCaption position={[0, -3.55, 0.4]} snapshot={snapshot} />
    </>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function CardiacCycleCanvas({ params = {}, setParam }) {
  const { bpm = 75, pathology: pathologyParam = "normal", stage = 0, playing = true, speed = 1 } = params || {};
  const pathology = pathologyFor(pathologyParam).key;
  const rate = clamp(Number(bpm) || 75, 40, 180);
  const tempo = useMemo(() => tempoFor(rate), [rate]);
  const live = useRef(null);
  if (live.current === null) live.current = makeLiveBag();
  const stepperLive = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [h, setH] = useState(null);
  const pushed = useRef({ progress: -1, vf: -1 });

  // Reset the fibrillation clock when the rhythm changes.
  useEffect(() => {
    live.current.vfT = 0;
  }, [pathology]);

  const onFrame = useCallback(
    (snap) => {
      choreograph(live.current, snap, rate, pathology, speed, performance.now() / 1000);
    },
    [rate, pathology, speed],
  );
  const onTick = useCallback(
    (snap) => {
      setSnapshot(snap);
      setH(live.current.h);
      if (typeof setParam !== "function") return;
      const progress = Math.round(snap.progress * 20) / 20;
      const vf = Math.round(live.current.vfT * 2) / 2;
      if (progress !== pushed.current.progress) {
        pushed.current.progress = progress;
        setParam("liveProgress", progress);
      }
      if (vf !== pushed.current.vf) {
        pushed.current.vf = vf;
        setParam("liveVfTime", vf);
      }
    },
    [setParam],
  );

  return (
    <SceneCanvas
      camera={{ position: [2.4, 0.9, 12.2], fov: 42 }}
      controls={{ minDistance: 4, maxDistance: 30, target: [2.6, 0, 0] }}
      lights={{ ambient: 0.6, keyLight: 1.3, rim: PALETTE.rose }}
    >
      <StageCycleDriver cycle={CARDIAC_CYCLE} stage={stage} playing={playing} speed={speed} tempo={tempo} live={stepperLive} setParam={setParam} onFrame={onFrame} onTick={onTick} />

      {/* Anatomy */}
      <Septa />
      {Object.keys(CHAMBERS).map((id) => (
        <Chamber key={id} live={live} id={id} />
      ))}
      <Vessel points={AORTA} radius={0.3} colour={COLOURS.vesselLeft} />
      <Vessel points={PULMONARY} radius={0.26} colour={COLOURS.vesselRight} />
      <Vessel points={PULMONARY_LEFT} radius={0.16} colour={COLOURS.vesselRight} />
      <Vessel points={SVC} radius={0.22} colour={COLOURS.vesselRight} />
      <Vessel points={IVC} radius={0.24} colour={COLOURS.vesselRight} />
      <Vessel points={PV_UPPER} radius={0.13} colour={COLOURS.vesselLeft} />
      <Vessel points={PV_LOWER} radius={0.13} colour={COLOURS.vesselLeft} />
      {Object.keys(VALVES).map((id) => (
        <Valve key={`${id}-${pathology === "stenosis" && id === "aortic"}`} live={live} id={id} stenotic={pathology === "stenosis" && id === "aortic"} />
      ))}

      {/* Blood */}
      {STREAMS.map((s) => (
        <BloodStream key={s.key} live={live} stream={s} />
      ))}

      {/* Conduction */}
      <ConductionPath live={live} id="atria" pick={(c) => c.atria} />
      <ConductionPath live={live} id="atriaLeft" pick={(c) => c.atria} radius={0.022} />
      <ConductionPath live={live} id="his" pick={(c) => (c.his > 0.05 || c.purkinje > 0 ? 1 : 0)} radius={0.04} />
      <ConductionPath live={live} id="rightBranch" pick={(c) => c.purkinje} />
      <ConductionPath live={live} id="leftBranch" pick={(c) => c.purkinje} />
      <Node live={live} pick={(c) => c.sa} position={SA_NODE} label="SA node · pacemaker" />
      <Node live={live} pick={(c) => c.av} position={AV_NODE} label="AV node · delay" radius={0.09} />
      <SceneLabel position={[0.35, -0.75, -0.3]} tone="text-amber-300">
        bundle of His
      </SceneLabel>
      <SceneLabel position={[-1.55, -2.55, -0.2]} tone="text-amber-300">
        Purkinje fibres
      </SceneLabel>
      <ChaosSparks live={live} />

      {/* Traces */}
      <WiggersPanel live={live} bpm={rate} pathology={pathology} />
      <EcgStrip live={live} />

      <Labels h={h} pathology={pathology} snapshot={snapshot} />

    </SceneCanvas>
  );
}
