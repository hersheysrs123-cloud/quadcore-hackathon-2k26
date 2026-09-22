"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEG, PALETTE, SceneLabel, clamp } from "@/components/visualizations/scene-kit";
import { bulgeFactor } from "@/lib/muscleMechanics";

// ─── Shared arm rig ─────────────────────────────────────────────────
// The one upper limb both nerve-and-muscle scenes are built on: scapula,
// humerus, radius, ulna and hand as a two-joint kinematic chain, plus the
// biceps and triceps as textured, volume-preserving bellies slung between
// their real attachment points.
//
// The reflex-arc scene and the antagonistic-muscles scene want the same
// forearm, the same elbow pivot and the same muscle origins and insertions;
// building it twice would have meant two arms that disagreed about where the
// biceps tendon goes. So the anatomy lives here and the scenes only decide
// what the arm is doing.
//
// Two conventions everything below relies on:
//   · World units are decimetres — 1 unit = 10 cm — so a 30 cm humerus is
//     3 units long, and the lever arms in `lib/muscleMechanics.js` convert
//     with a single factor.
//   · Joint angles are driven IMPERATIVELY through a pose object held in a
//     ref, not through React props. The arm moves every frame; re-rendering
//     the whole tree sixty times a second to rotate two groups would be the
//     wrong tool. Components read the pose in `useFrame` and set transforms
//     directly, exactly as the spring and coaster scenes do.
// ─────────────────────────────────────────────────────────────────────

/** Bone lengths and the default shoulder position, world units (dm). */
export const ARM = {
  shoulder: [0, 2.4, 0],
  /** Glenoid to elbow axis. */
  humerus: 3.0,
  /** Elbow axis to wrist. */
  forearm: 2.35,
  /** Elbow axis to the bar of a dumbbell gripped in the hand. */
  handCentre: 2.97,
  /** Anterior offset of that bar from the forearm axis. */
  handForward: 0.3,
  /** Elbow axis to the tip of the index finger. */
  fingertip: 3.72,
  /** Where the index fingertip sits in the forearm's local frame. */
  fingertipLocal: [0.04, -3.72, -0.2],
};

export const RIG_COLOURS = {
  bone: "#e7e0cf",
  cartilage: "#dbe7f0",
  muscleRelaxed: "#9e3547",
  muscleContracted: "#ff5a6e",
  muscleFatigued: "#6e2f66",
  tendon: "#f1f5f9",
  tendonStrained: "#fbbf24",
  tendonDanger: "#fb7185",
  skin: "#e8b89a",
};

/**
 * Where each muscle attaches, in the local frame of the bone it attaches to.
 *
 * Local frames put the proximal joint at the origin, run the bone down the
 * −y axis, and point +x anteriorly (towards the front of the body). So the
 * biceps origin sits just in front of and below the shoulder (coracoid /
 * supraglenoid), and its insertion is on the front of the radius a few cm
 * below the elbow — the radial tuberosity. The triceps mirrors it behind:
 * infraglenoid tubercle to the olecranon, which hooks BEHIND the elbow axis.
 */
export const MUSCLE_SPECS = {
  biceps: {
    key: "biceps",
    label: "Biceps brachii",
    origin: { frame: "humerus", local: [0.3, -0.32, 0.03] },
    insertion: { frame: "forearm", local: [0.17, -0.55, -0.06] },
    proximalTendon: 0.5,
    distalTendon: 0.55,
    /** Belly radius at full length (elbow straight). */
    radius: 0.36,
    /** Bows away from the bone on the anterior side. */
    bowSide: 1,
    bow: 0.16,
    tendonRadius: 0.06,
  },
  triceps: {
    key: "triceps",
    label: "Triceps brachii",
    origin: { frame: "humerus", local: [-0.3, -0.45, 0.0] },
    insertion: { frame: "forearm", local: [-0.3, 0.12, 0.08] },
    proximalTendon: 0.4,
    distalTendon: 0.42,
    radius: 0.34,
    bowSide: -1,
    bow: 0.14,
    tendonRadius: 0.075,
  },
};

// ─── Kinematics ─────────────────────────────────────────────────────

/**
 * A pose: the two joint angles plus a cached frame for each bone, so that
 * every consumer (bones, muscles, nerves, labels) converts local points with
 * the same numbers on the same frame. `setPose` rewrites it in place; nothing
 * here allocates per frame.
 */
export function createPose(shoulder = ARM.shoulder, shoulderDeg = 0, elbowDeg = 0) {
  const pose = {
    shoulderDeg: 0,
    elbowDeg: 0,
    humerus: { origin: new THREE.Vector3(...shoulder), cos: 1, sin: 0, angle: 0 },
    forearm: { origin: new THREE.Vector3(), cos: 1, sin: 0, angle: 0 },
  };
  setPose(pose, shoulderDeg, elbowDeg);
  return pose;
}

/**
 * Shoulder flexion swings the humerus forward (+x) about z; elbow flexion
 * swings the forearm forward and up relative to the humerus. Both positive.
 */
export function setPose(pose, shoulderDeg, elbowDeg) {
  pose.shoulderDeg = shoulderDeg;
  pose.elbowDeg = elbowDeg;
  const a1 = shoulderDeg * DEG;
  const a2 = a1 + elbowDeg * DEG;
  const h = pose.humerus;
  const f = pose.forearm;
  h.angle = a1;
  h.cos = Math.cos(a1);
  h.sin = Math.sin(a1);
  f.angle = a2;
  f.cos = Math.cos(a2);
  f.sin = Math.sin(a2);
  // The elbow: the humerus's local (0, −L, 0) taken into the world.
  f.origin.set(h.origin.x + ARM.humerus * h.sin, h.origin.y - ARM.humerus * h.cos, h.origin.z);
  return pose;
}

/** Take a local point [x, y, z] of `frame` into world space, writing into `out`. */
export function localToWorld(frame, local, out) {
  const lx = local[0];
  const ly = local[1];
  return out.set(
    frame.origin.x + lx * frame.cos - ly * frame.sin,
    frame.origin.y + lx * frame.sin + ly * frame.cos,
    frame.origin.z + local[2],
  );
}

export const frameOf = (pose, name) => (name === "forearm" ? pose.forearm : pose.humerus);

/** World-space origin and insertion of one muscle at this pose. */
export function attachmentPoints(pose, spec, outOrigin, outInsertion) {
  localToWorld(frameOf(pose, spec.origin.frame), spec.origin.local, outOrigin);
  localToWorld(frameOf(pose, spec.insertion.frame), spec.insertion.local, outInsertion);
  return { origin: outOrigin, insertion: outInsertion };
}

/** Straight-line length between a muscle's attachments at this pose. */
export function muscleSpan(pose, spec) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  attachmentPoints(pose, spec, a, b);
  return a.distanceTo(b);
}

// ─── Procedural textures ────────────────────────────────────────────

/**
 * Striated skeletal muscle, laid out for a LatheGeometry: `u` runs around
 * the belly and `v` runs along it, so the fibres are drawn as streaks
 * varying across `u` and the sarcomere bands as faint lines across `v`.
 * When the belly shortens the texture compresses along the fibres with it —
 * which is what sarcomeres actually do.
 */
function makeMuscleTexture() {
  if (typeof document === "undefined") return null;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#a83a4c";
  ctx.fillRect(0, 0, size, size);

  // Fascicles: long streaks along v, varying in tone across u.
  for (let x = 0; x < size; x += 3) {
    const tone = 0.18 + 0.4 * Math.abs(Math.sin(x * 0.19)) + 0.15 * Math.abs(Math.sin(x * 0.61 + 1.3));
    ctx.fillStyle = `rgba(255, 120, 135, ${tone.toFixed(3)})`;
    ctx.fillRect(x, 0, 2, size);
    ctx.fillStyle = `rgba(70, 8, 28, ${(0.3 + 0.2 * Math.abs(Math.sin(x * 0.33))).toFixed(3)})`;
    ctx.fillRect(x + 2, 0, 1, size);
  }

  // Sarcomere striations: faint bands across the fibres.
  for (let y = 0; y < size; y += 6) {
    const strong = y % 24 === 0;
    ctx.fillStyle = `rgba(255, 224, 228, ${strong ? 0.3 : 0.12})`;
    ctx.fillRect(0, y, size, strong ? 2 : 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Pearly tendon: dense parallel collagen, drawn as fine bright fibres along v. */
function makeTendonTexture() {
  if (typeof document === "undefined") return null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#eef2f7";
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 2) {
    const tone = 0.1 + 0.25 * Math.abs(Math.sin(x * 0.7));
    ctx.fillStyle = `rgba(148, 163, 184, ${tone.toFixed(3)})`;
    ctx.fillRect(x, 0, 1, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Both textures, created once per scene and released when it unmounts. */
export function useArmTextures() {
  const textures = useMemo(() => ({ muscle: makeMuscleTexture(), tendon: makeTendonTexture() }), []);
  useEffect(
    () => () => {
      textures.muscle?.dispose();
      textures.tendon?.dispose();
    },
    [textures],
  );
  return textures;
}

// ─── Geometry ───────────────────────────────────────────────────────

const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * A long bone as a surface of revolution: flared at both ends, waisted in
 * the middle, with rounded caps. Proximal end at the origin, running down −y.
 */
export function makeBoneGeometry(length, shaft, proximal, distal, segments = 22) {
  const points = [];
  const steps = 26;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const flareP = 1 - smoothstep(0.04, 0.3, t);
    const flareD = smoothstep(0.7, 0.96, t);
    let r = shaft + (proximal - shaft) * flareP + (distal - shaft) * flareD;
    // Rounded caps: pull the radius in over the last few percent at each end.
    const capP = t < 0.05 ? Math.sqrt(1 - Math.pow((0.05 - t) / 0.05, 2)) : 1;
    const capD = t > 0.95 ? Math.sqrt(1 - Math.pow((t - 0.95) / 0.05, 2)) : 1;
    r *= Math.max(capP * capD, 0.02);
    points.push(new THREE.Vector2(r, -t * length));
  }
  return new THREE.LatheGeometry(points, segments);
}

/**
 * A unit fusiform belly: length 1 along y, radius 1 at the middle, tapering
 * to a small flat at each end where the tendon takes over. Scaled per frame
 * to (r, L, r), so the mesh's own volume is r²·L — which is exactly what the
 * volume-preserving bulge in `lib/muscleMechanics.js` keeps constant.
 */
export function makeFusiformGeometry(segments = 28) {
  const points = [];
  const steps = 30;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const r = 0.07 + 0.93 * Math.pow(Math.sin(Math.PI * t), 0.62);
    points.push(new THREE.Vector2(r, t - 0.5));
  }
  return new THREE.LatheGeometry(points, segments);
}

/**
 * The scapula blade as a thin extruded triangle: glenoid at the origin,
 * superior angle up and medial, inferior angle a long way down. The group
 * that holds it is rotated into the scapular plane by `ArmSkeleton`.
 */
export function makeScapulaGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0.05, 0.3);
  shape.quadraticCurveTo(-0.6, 0.85, -1.55, 0.95);
  shape.quadraticCurveTo(-1.75, 0.3, -1.6, -0.9);
  shape.quadraticCurveTo(-1.45, -2.2, -1.05, -2.75);
  shape.quadraticCurveTo(-0.55, -1.7, -0.05, -0.45);
  shape.quadraticCurveTo(0.12, -0.1, 0.05, 0.3);
  return new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
}

// ─── Materials ──────────────────────────────────────────────────────

function BoneMaterial() {
  return <meshStandardMaterial color={RIG_COLOURS.bone} roughness={0.62} metalness={0.02} />;
}

function CartilageMaterial() {
  return <meshStandardMaterial color={RIG_COLOURS.cartilage} roughness={0.28} metalness={0.05} />;
}

// ─── The skeleton ───────────────────────────────────────────────────

/** A capsule finger segment along −y from its base. */
function Segment({ position, rotation = [0, 0, 0], length, radius, colour = RIG_COLOURS.bone }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, -length / 2, 0]} castShadow>
        <capsuleGeometry args={[radius, Math.max(length - radius * 2, 0.02), 4, 10]} />
        <meshStandardMaterial color={colour} roughness={0.6} metalness={0.02} />
      </mesh>
    </group>
  );
}

const FINGERS = [
  { z: -0.2, proximal: 0.4, distal: 0.34, r: 0.072 },
  { z: -0.066, proximal: 0.44, distal: 0.38, r: 0.075 },
  { z: 0.066, proximal: 0.41, distal: 0.35, r: 0.072 },
  { z: 0.2, proximal: 0.32, distal: 0.27, r: 0.064 },
];

/**
 * The hand, in the forearm frame, wrist at y = −ARM.forearm. `grip` closes
 * the fingers around a bar sitting at the palm centre; 0 leaves the index
 * finger pointing, which is what the reflex scene needs.
 */
function Hand({ grip = 0 }) {
  const wristY = -ARM.forearm;
  const palmLength = 0.62;
  const curl = grip * 78 * DEG;
  return (
    <group position={[0, wristY, 0]}>
      {/* Carpals and palm. */}
      <mesh position={[0.02, -0.08, 0]} castShadow>
        <sphereGeometry args={[0.2, 14, 12]} />
        <BoneMaterial />
      </mesh>
      <mesh position={[0.03, -palmLength / 2 - 0.05, 0]} castShadow>
        <boxGeometry args={[0.2, palmLength, 0.56]} />
        <BoneMaterial />
      </mesh>
      {/* Four fingers, each of two segments so they can curl. */}
      {FINGERS.map((f, i) => (
        <group key={i} position={[0.03, -palmLength - 0.05, f.z]} rotation={[0, 0, curl]}>
          <Segment position={[0, 0, 0]} length={f.proximal} radius={f.r} />
          <group position={[0, -f.proximal, 0]} rotation={[0, 0, curl * 0.9]}>
            <Segment position={[0, 0, 0]} length={f.distal} radius={f.r * 0.92} />
          </group>
        </group>
      ))}
      {/* Thumb: from the lateral side of the palm, forward, and — in a grip —
          curling down over the bar to meet the fingers coming up from below. */}
      <group position={[0.12, -0.15, -0.3]} rotation={[0.3, 0, 0.55 + grip * 0.95]}>
        <Segment position={[0, 0, 0]} length={0.42} radius={0.085} />
        <group position={[0, -0.42, 0]} rotation={[0, 0, -grip * 1.25]}>
          <Segment position={[0, 0, 0]} length={0.32} radius={0.078} />
        </group>
      </group>
    </group>
  );
}

/** A dumbbell sat across the palm, sized by its mass. Nothing at zero. */
function Dumbbell({ kg }) {
  if (!(kg > 0.05)) return null;
  const plateR = 0.22 + 0.016 * kg;
  const plateT = 0.12 + 0.008 * kg;
  const barHalf = 0.5;
  return (
    <group position={[ARM.handForward, -ARM.handCentre, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.06, barHalf * 2 + plateT * 2, 14]} />
        <meshStandardMaterial color="#b8c0cc" roughness={0.35} metalness={0.8} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, side * (barHalf + plateT / 2), 0]} castShadow>
          <cylinderGeometry args={[plateR, plateR, plateT, 26]} />
          <meshStandardMaterial color="#2f3745" roughness={0.55} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Scapula, humerus, radius, ulna and hand as nested groups rotated each
 * frame from `poseRef.current`.
 *
 * `humerusChildren` and `forearmChildren` are rendered INSIDE the rotating
 * groups, which is how the reflex scene hangs nerve segments and labels on
 * the bones without positioning them by hand every frame.
 */
export function ArmSkeleton({
  poseRef,
  grip = 0,
  loadKg = 0,
  showScapula = true,
  humerusChildren = null,
  forearmChildren = null,
}) {
  const humerusRef = useRef(null);
  const forearmRef = useRef(null);
  const shoulder = poseRef.current.humerus.origin;

  const geometries = useMemo(
    () => ({
      humerus: makeBoneGeometry(ARM.humerus, 0.15, 0.28, 0.26),
      ulna: makeBoneGeometry(ARM.forearm, 0.095, 0.17, 0.1),
      radius: makeBoneGeometry(ARM.forearm - 0.05, 0.085, 0.11, 0.19),
      scapula: makeScapulaGeometry(),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(geometries).forEach((g) => g.dispose());
    },
    [geometries],
  );

  useFrame(() => {
    const pose = poseRef.current;
    if (humerusRef.current) humerusRef.current.rotation.z = pose.humerus.angle;
    if (forearmRef.current) forearmRef.current.rotation.z = pose.elbowDeg * DEG;
  });

  return (
    <group position={[shoulder.x, shoulder.y, shoulder.z]}>
      {showScapula && (
        // Into the scapular plane: the blade runs back and inwards from the
        // shoulder, about 55° off the sagittal plane the camera looks along.
        <group rotation={[0, -0.95, 0]} position={[-0.12, 0.08, -0.05]}>
          <mesh geometry={geometries.scapula} castShadow position={[0, 0, -0.05]} scale={[0.62, 0.62, 1]}>
            <BoneMaterial />
          </mesh>
          {/* Spine of the scapula and the acromion hooking over the joint. */}
          <mesh position={[-0.5, 0.42, 0.1]} rotation={[0, 0, 0.12]} castShadow>
            <boxGeometry args={[0.95, 0.13, 0.13]} />
            <BoneMaterial />
          </mesh>
          <mesh position={[0.08, 0.5, 0.12]} castShadow>
            <boxGeometry args={[0.4, 0.15, 0.28]} />
            <BoneMaterial />
          </mesh>
          {/* Glenoid fossa. */}
          <mesh position={[0.06, 0, 0.02]}>
            <sphereGeometry args={[0.26, 16, 14]} />
            <CartilageMaterial />
          </mesh>
        </group>
      )}
      {/* Coracoid process: the knob the short head of biceps hangs from. */}
      {showScapula && (
        <mesh position={[0.3, -0.18, 0.02]} castShadow>
          <sphereGeometry args={[0.13, 12, 10]} />
          <BoneMaterial />
        </mesh>
      )}

      <group ref={humerusRef}>
        <mesh geometry={geometries.humerus} castShadow>
          <BoneMaterial />
        </mesh>
        {/* Humeral head. */}
        <mesh position={[-0.02, -0.08, 0]} castShadow>
          <sphereGeometry args={[0.33, 20, 16]} />
          <CartilageMaterial />
        </mesh>
        {/* Trochlea and capitulum — the two condyles the elbow hinges on. */}
        {[-0.17, 0.17].map((z) => (
          <mesh key={z} position={[0.03, -ARM.humerus, z]} castShadow>
            <sphereGeometry args={[0.2, 16, 14]} />
            <CartilageMaterial />
          </mesh>
        ))}
        {humerusChildren}

        <group ref={forearmRef} position={[0, -ARM.humerus, 0]}>
          {/* Ulna, medial, with the olecranon hooking behind the joint. */}
          <mesh geometry={geometries.ulna} position={[0, 0, 0.13]} castShadow>
            <BoneMaterial />
          </mesh>
          <mesh position={[-0.27, 0.12, 0.13]} castShadow>
            <sphereGeometry args={[0.18, 14, 12]} />
            <BoneMaterial />
          </mesh>
          {/* Radius, lateral, a touch forward, with its disc-shaped head. */}
          <mesh geometry={geometries.radius} position={[0.08, -0.05, -0.14]} castShadow>
            <BoneMaterial />
          </mesh>
          <mesh position={[0.08, -0.05, -0.14]} castShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.1, 18]} />
            <CartilageMaterial />
          </mesh>
          <Hand grip={grip} />
          <Dumbbell kg={loadKg} />
          {forearmChildren}
        </group>
      </group>
    </group>
  );
}

// ─── Muscles ────────────────────────────────────────────────────────

const UP = new THREE.Vector3(0, 1, 0);
const COLOUR_RELAXED = new THREE.Color(RIG_COLOURS.muscleRelaxed);
const COLOUR_CONTRACTED = new THREE.Color(RIG_COLOURS.muscleContracted);
const COLOUR_FATIGUED = new THREE.Color(RIG_COLOURS.muscleFatigued);
const COLOUR_TENDON = new THREE.Color(RIG_COLOURS.tendon);
const COLOUR_TENDON_STRAINED = new THREE.Color(RIG_COLOURS.tendonStrained);
const COLOUR_TENDON_DANGER = new THREE.Color(RIG_COLOURS.tendonDanger);

/** Orient a unit-length-along-y mesh from `a` to `b`, writing into `mesh`. */
function placeBetween(mesh, a, b, radius, scratch) {
  scratch.dir.subVectors(b, a);
  const length = scratch.dir.length();
  if (length < 1e-6) return 0;
  scratch.dir.divideScalar(length);
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, scratch.dir);
  mesh.scale.set(radius, length, radius);
  return length;
}

/**
 * One muscle: a fusiform belly between two tendons, re-fitted every frame to
 * wherever the bones have put its attachments.
 *
 * `stateRef.current` is `{ activation, fatigue, strain }`, all 0–1 except
 * strain (a fraction, ~0.04 is a lot). The scene owns it and updates it as
 * often as it likes; nothing here re-renders for it.
 *
 * The belly length is what is left of the origin–insertion distance after
 * the two tendons, and its radius follows r ∝ 1/√L from that — a belly that
 * is shorter is fatter by exactly the amount that keeps its volume the
 * same. Activation adds a little extra swell on top, which is the stiffening
 * you can feel in a muscle that is working even before it shortens.
 */
export function Muscle({ poseRef, spec, stateRef, textures, label, labelOffset = 0.75, showLabel = true }) {
  const bellyRef = useRef(null);
  const proximalRef = useRef(null);
  const distalRef = useRef(null);
  const labelRef = useRef(null);
  const materialRef = useRef(null);

  const fusiform = useMemo(() => makeFusiformGeometry(), []);
  useEffect(() => () => fusiform.dispose(), [fusiform]);

  // One material shared by both tendons — they carry the same force, so one
  // per-frame colour write covers the pair.
  const tendonMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures?.tendon ?? null,
        color: RIG_COLOURS.tendon,
        emissive: RIG_COLOURS.tendon,
        emissiveIntensity: 0.05,
        roughness: 0.32,
        metalness: 0.08,
      }),
    [textures],
  );
  useEffect(() => () => tendonMaterial.dispose(), [tendonMaterial]);

  const scratch = useMemo(
    () => ({
      origin: new THREE.Vector3(),
      insertion: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      perp: new THREE.Vector3(),
      bellyStart: new THREE.Vector3(),
      bellyEnd: new THREE.Vector3(),
      centre: new THREE.Vector3(),
      colour: new THREE.Color(),
      tendonColour: new THREE.Color(),
    }),
    [],
  );

  // Belly length with the elbow straight, so the bulge is measured from there.
  const restBelly = useMemo(() => {
    const restPose = createPose(poseRef.current.humerus.origin.toArray(), 0, 0);
    return muscleSpan(restPose, spec) - spec.proximalTendon - spec.distalTendon;
    // The shoulder position is fixed for the life of a scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  useFrame(() => {
    const belly = bellyRef.current;
    if (!belly) return;
    const pose = poseRef.current;
    const state = stateRef?.current ?? {};
    const activation = clamp(Number(state.activation) || 0, 0, 1);
    const fatigue = clamp(Number(state.fatigue) || 0, 0, 1);
    const strain = Math.max(Number(state.strain) || 0, 0);

    attachmentPoints(pose, spec, scratch.origin, scratch.insertion);
    scratch.dir.subVectors(scratch.insertion, scratch.origin);
    const span = scratch.dir.length();
    if (span < 1e-6) return;
    scratch.dir.divideScalar(span);

    const bellyLength = Math.max(span - spec.proximalTendon - spec.distalTendon, 0.3);
    const fraction = bellyLength / restBelly;
    const radius = spec.radius * bulgeFactor(fraction) * (1 + 0.12 * activation);

    // Perpendicular in the sagittal plane, on the muscle's own side of the bone.
    scratch.perp.set(-scratch.dir.y, scratch.dir.x, 0).multiplyScalar(spec.bowSide);
    const bow = spec.bow * (radius / spec.radius);

    scratch.bellyStart.copy(scratch.origin).addScaledVector(scratch.dir, spec.proximalTendon);
    scratch.bellyEnd.copy(scratch.insertion).addScaledVector(scratch.dir, -spec.distalTendon);
    scratch.centre.addVectors(scratch.bellyStart, scratch.bellyEnd).multiplyScalar(0.5).addScaledVector(scratch.perp, bow);

    belly.position.copy(scratch.centre);
    belly.quaternion.setFromUnitVectors(UP, scratch.dir);
    belly.scale.set(radius, bellyLength, radius);

    // Tendons run from the attachment to the (bowed) end of the belly.
    scratch.bellyStart.copy(scratch.centre).addScaledVector(scratch.dir, -bellyLength / 2);
    scratch.bellyEnd.copy(scratch.centre).addScaledVector(scratch.dir, bellyLength / 2);
    if (proximalRef.current) placeBetween(proximalRef.current, scratch.origin, scratch.bellyStart, spec.tendonRadius, scratch);
    if (distalRef.current) placeBetween(distalRef.current, scratch.bellyEnd, scratch.insertion, spec.tendonRadius, scratch);

    if (labelRef.current) {
      labelRef.current.position.copy(scratch.centre).addScaledVector(scratch.perp, radius + labelOffset);
    }

    const material = materialRef.current;
    if (material) {
      scratch.colour.copy(COLOUR_RELAXED).lerp(COLOUR_CONTRACTED, activation).lerp(COLOUR_FATIGUED, fatigue * 0.7);
      material.color.copy(scratch.colour);
      material.emissive.copy(scratch.colour);
      material.emissiveIntensity = 0.04 + 0.3 * activation;
    }
    // Tendon colour walks from pearl through amber to rose as strain climbs
    // past the level where collagen starts to tear.
    const warm = clamp(strain / 0.04, 0, 1);
    const danger = clamp((strain - 0.04) / 0.04, 0, 1);
    scratch.tendonColour.copy(COLOUR_TENDON).lerp(COLOUR_TENDON_STRAINED, warm).lerp(COLOUR_TENDON_DANGER, danger);
    tendonMaterial.color.copy(scratch.tendonColour);
    tendonMaterial.emissive.copy(scratch.tendonColour);
    tendonMaterial.emissiveIntensity = 0.05 + 0.35 * danger;
  });

  return (
    <group>
      <mesh ref={bellyRef} geometry={fusiform} castShadow>
        <meshStandardMaterial
          ref={materialRef}
          map={textures?.muscle ?? null}
          color={RIG_COLOURS.muscleRelaxed}
          emissive={RIG_COLOURS.muscleRelaxed}
          emissiveIntensity={0.04}
          roughness={0.55}
          metalness={0.05}
        />
      </mesh>
      <mesh ref={proximalRef} castShadow material={tendonMaterial}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
      </mesh>
      <mesh ref={distalRef} castShadow material={tendonMaterial}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
      </mesh>
      {showLabel && label && (
        <group ref={labelRef}>
          <SceneLabel position={[0, 0, 0]} tone="text-ink-200">
            {label}
          </SceneLabel>
        </group>
      )}
    </group>
  );
}

/** Slate glow ring used for joints and attachment points. */
export function JointMarker({ position, radius = 0.12, colour = PALETTE.sky }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 12, 10]} />
      <meshBasicMaterial color={colour} transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}
