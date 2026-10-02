"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  CANVAS_BG,
  Callout,
  FitCamera,
  LabelsOn,
  NoLabel,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  lerp,
} from "@/components/visualizations/scene-kit";
import { makeFlowPath } from "@/components/visualizations/charge-carriers";
import { ARM_MODEL } from "@/components/visualizations/arm-model-meta";
import { ARM, createPose, frameOf, localToWorld, setPose } from "@/components/visualizations/arm-rig";
import { ModelledArm } from "@/components/visualizations/arm-model";
import {
  DORSAL_ROOT_FRACTION,
  STAGES,
  VENTRAL_ROOT_FRACTION,
  contractionAt,
  playbackRate,
  solveReflex,
  stageAt,
} from "@/lib/reflexArc";

// ─── The reflex arc ─────────────────────────────────────────────────
// A forearm reaching into a candle flame, the sensory neuron running from
// the fingertip up the arm into a transverse section of the spinal cord,
// the relay neuron crossing the grey matter, and the motor neuron coming
// back out of the ventral root to the biceps.
//
// The scene is a clock. Physiological time runs from the moment the finger
// enters the flame, at a rate set by the playback control, and everything
// that moves — the impulse, the synapse flashes, the arm itself — is a pure
// function of that clock through `lib/reflexArc.js`. That is what lets
// real-time and slow-motion be the SAME event rather than two animations:
// slow-motion only changes how many wall-clock milliseconds each
// physiological one is worth.
//
// The arm moves on the shared rig's kinematics (`arm-rig.jsx`) but is drawn
// with our own anatomical model (`public/models/arm.glb`, built in Blender by
// scripts/arm-model): bones, and the muscles and tendons over them. The
// nerves are hung on its bones so they follow the withdrawal for free.
// ─────────────────────────────────────────────────────────────────────

const SHOULDER = [0, 2.2, 0];

/** Arm poses (shoulder flexion, elbow flexion, degrees). */
const POSES = {
  /** Fingertip in the tip of the flame. */
  flame: { shoulder: 55, elbow: 10 },
  /** Fingertip held in the warm air half a decimetre above it. */
  warmth: { shoulder: 60, elbow: 10 },
  /** Where the withdrawal takes the arm. */
  withdrawn: { shoulder: 30, elbow: 100 },
};

/** The hand points at the flame with its index finger. */
const POINTING = { current: { from: "point", to: "point", t: 0 } };

const CANDLE_X = 5.85;
const TABLE_Y = -3.2;
const CANDLE_TOP_Y = -1.75;

/**
 * The C6 segment of the spinal cord (the biceps' segment), magnified and cut
 * across, hung behind and above the shoulder. Section-local coordinates:
 * x runs dorsal (−, towards the back) to ventral (+), y is lateral, z runs
 * along the cord with the cut face at z = `face`. A real cervical cord is
 * about 13 mm wide and 8 mm front to back, so it is wider (ry) than deep (rx).
 * `S` takes a section-local point to the world.
 */
const CORD = { centre: [-2.05, 4.55, 0], k: 1.15, rx: 0.7, ry: 1.0, face: 0.45, back: -1.55 };
const S = (x, y, z) => [CORD.centre[0] + x * CORD.k, CORD.centre[1] + y * CORD.k, z * CORD.k];
/** Just proud of the cut face, where the neurons inside the cord are drawn. */
const ON_FACE = CORD.face + 0.035;
const DORSAL_HORN = S(-0.38, -0.36, ON_FACE);
const RELAY_SOMA = S(0.0, -0.3, ON_FACE);
const VENTRAL_HORN = S(0.36, -0.47, ON_FACE);
/** Rootlets leave the cord's side at the dorsolateral and ventrolateral sulci. */
const DORSAL_ENTRY = S(-0.52, -0.69, 0.12);
const VENTRAL_EXIT = S(0.42, -0.83, 0.12);
const DORSAL_ROOT = S(-0.58, -1.08, 0.12);
const GANGLION = S(-0.6, -1.45, 0.12);
const VENTRAL_ROOT = S(0.4, -1.22, 0.12);
/** Where the two roots join into the spinal nerve. */
const JUNCTION = S(0.0, -1.98, 0.12);
const BRAIN_TOP = S(-0.45, 1.55, ON_FACE);
/** The spinal nerve from the roots to the shoulder: both neurons travel in it. */
const NERVE_BUNDLE = [JUNCTION, [-1.4, 2.08, 0.18], [-0.8, 2.12, 0.2], [-0.3, 2.14, 0.22]];
const bundle = (dy, dz) => NERVE_BUNDLE.map(([x, y, z]) => [x, y + dy, z + dz]);

const NEURON_COLOURS = {
  sensory: PALETTE.gold,
  relay: PALETTE.violet,
  motor: PALETTE.sky,
  brain: PALETTE.slate,
  impulse: "#ffffff",
  synapse: PALETTE.emerald,
  pain: PALETTE.rose,
  flame: "#fb923c",
};

/** A one-line account of each run, for the caption. */
const OUTCOME = {
  fires: (s) => `Withdrawal reflex: the biceps is told to contract ${Math.round(s.responseMs)} ms after the burn, before the pain is even felt.`,
  threshold: () =>
    "40 °C is warm, not painful (pain starts near 43 °C). Warm receptors send slow impulses up C fibres at 2 m/s and the warmth is felt, but the relay neuron does not fire the motor neuron: no reflex.",
  dorsal: () => "Dorsal root cut: the impulse never gets into the spinal cord. No reflex, and nothing is felt.",
  ventral: () => "Ventral root cut: the pain reaches the brain and is felt, but the order to move never reaches the biceps.",
};

/** Wall-clock phases of one cycle, seconds. */
const APPROACH_S = 1.0;
const FIRST_HOLD_S = 0.7;
const LINGER_FIRED_S = 0.9;
const LINGER_STALLED_S = 1.8;
/** How often the scene reports its clock to the HUD, seconds. */
const PUSH_EVERY_S = 0.09;

// ─── Nerve routes ───────────────────────────────────────────────────

/**
 * A neuron's path as a chain of segments, each in the local frame of one
 * bone (or the world). The tubes are drawn inside the rotating bone groups,
 * so they move with the arm; `at` converts a fraction of the whole route to
 * a world point through the current pose, so the impulse follows them.
 */
function makeRoute(segments) {
  const built = segments.map((seg) => {
    const curve = new THREE.CatmullRomCurve3(seg.points.map((p) => new THREE.Vector3(...p)));
    const sampled = curve.getPoints(Math.max(12, seg.points.length * 10));
    return { frame: seg.frame, curve, path: makeFlowPath(sampled), length: 0 };
  });
  const cumulative = [0];
  for (const seg of built) {
    seg.length = seg.path.length;
    cumulative.push(cumulative[cumulative.length - 1] + seg.length);
  }
  const total = cumulative[cumulative.length - 1];
  const tmp = [0, 0, 0];
  return {
    segments: built,
    length: total,
    at(t, pose, out) {
      const target = clamp(t, 0, 1) * total;
      let i = 0;
      while (i < built.length - 1 && cumulative[i + 1] < target) i += 1;
      const seg = built[i];
      const local = seg.length > 1e-9 ? (target - cumulative[i]) / seg.length : 0;
      seg.path.at(local, out);
      if (seg.frame === "world") return out;
      // `path.at` wrote local coordinates; take them through the bone frame.
      tmp[0] = out.x;
      tmp[1] = out.y;
      tmp[2] = out.z;
      return localToWorld(frameOf(pose, seg.frame), tmp, out);
    },
  };
}

const SENSORY_ROUTE = [
  {
    frame: "forearm",
    points: [
      // The index fingertip (arm-model-meta.js), then along the palm side of
      // the finger, over the palm and the carpal tunnel, and up the front of
      // the forearm on the surface of the flexors (measured off the model).
      ARM_MODEL.indexTip,
      [0.18, -3.879, -0.201],
      [0.163, -3.723, -0.19],
      [0.138, -3.427, -0.168],
      [0.146, -3.257, -0.155],
      [0.135, -2.983, -0.136],
      [0.138, -2.6, -0.1],
      [0.191, -2.35, -0.05],
      [0.25, -2.05, 0.038],
      [0.193, -1.8, 0.115],
      [0.243, -1.3, 0.201],
      [0.272, -0.8, 0.31],
      [0.212, -0.35, 0.424],
      [0.035, 0.0, 0.43],
    ],
  },
  {
    // Up the medial bicipital groove, between biceps and triceps, then off
    // the arm into the armpit towards the neck.
    frame: "humerus",
    points: [
      [0.035, -3.0, 0.43],
      [0.0, -2.6, 0.292],
      [0.0, -2.2, 0.238],
      [0.0, -1.7, 0.152],
      [0.0, -1.2, 0.14],
      [-0.02, -0.7, 0.086],
      [-0.04, -0.35, 0.25],
      [-0.05, -0.15, 0.49],
    ],
  },
  {
    // Up the spinal nerve beside the motor fibre, through the dorsal root
    // ganglion (where its cell body sits off to one side), along the dorsal
    // root and its rootlets into the cord, and across to the dorsal horn.
    frame: "world",
    points: [
      [SHOULDER[0] - 0.05, SHOULDER[1] - 0.15, 0.49],
      ...bundle(0.035, 0.04).reverse(),
      S(-0.3, -1.72, 0.14),
      GANGLION,
      DORSAL_ROOT,
      DORSAL_ENTRY,
      S(-0.5, -0.55, ON_FACE),
      DORSAL_HORN,
    ],
  },
];

const RELAY_ROUTE = [
  {
    frame: "world",
    points: [DORSAL_HORN, S(-0.2, -0.27, ON_FACE), RELAY_SOMA, S(0.2, -0.4, ON_FACE), VENTRAL_HORN],
  },
];

const MOTOR_ROUTE = [
  {
    frame: "world",
    points: [
      VENTRAL_HORN,
      S(0.43, -0.66, ON_FACE),
      VENTRAL_EXIT,
      VENTRAL_ROOT,
      S(0.22, -1.7, 0.1),
      ...bundle(-0.035, -0.04),
      [SHOULDER[0] + 0.331, SHOULDER[1] - 0.1, 0.238],
    ],
  },
  {
    // Down the medial face of the biceps to its motor end plates.
    frame: "humerus",
    points: [
      [0.331, -0.1, 0.238],
      [0.322, -0.6, 0.211],
      [0.321, -1.0, 0.207],
      [0.317, -1.4, 0.199],
      [0.306, -1.75, 0.167],
    ],
  },
];

const BRAIN_ROUTE = [
  {
    frame: "world",
    // Schematic: the ascending copy really runs up the dorsal columns, along the cord.
    points: [DORSAL_HORN, S(-0.48, 0.0, ON_FACE), S(-0.46, 0.75, ON_FACE), S(-0.45, 1.15, ON_FACE), BRAIN_TOP],
  },
];

/** Where the motor neuron meets the biceps — its end plates, humerus frame. */
const NMJ_LOCAL = MOTOR_ROUTE[1].points[MOTOR_ROUTE[1].points.length - 1];

// ─── Scenery ────────────────────────────────────────────────────────

/** A tube along one route segment, in whichever frame it was drawn in. */
function NerveTube({ curve, colour, radius = 0.045, opacity = 0.9, dashed = false }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 48, radius, 8, false), [curve, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (dashed) {
    return (
      <Line
        points={curve.getPoints(40).map((p) => [p.x, p.y, p.z])}
        color={colour}
        lineWidth={1.6}
        dashed
        dashSize={0.16}
        gapSize={0.1}
        transparent
        opacity={opacity}
      />
    );
  }
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={colour}
        emissive={colour}
        emissiveIntensity={0.35}
        roughness={0.45}
        metalness={0.05}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

/** The segments of a route that live in one frame. */
function RouteTubes({ route, frame, colour, radius, dashed }) {
  return route.segments
    .filter((seg) => seg.frame === frame)
    .map((seg, i) => <NerveTube key={i} curve={seg.curve} colour={colour} radius={radius} dashed={dashed} />);
}

/** A severed root: the tube interrupted by a slab of background, and a marker. */
function Cut({ position, label, Label }) {
  return (
    <group position={position}>
      {/* Just deep enough to interrupt the root's sheath: the cuts sit where the
          roots meet the cord, and a deeper slab punched a hole in its edge. */}
      <mesh>
        <boxGeometry args={[0.2, 0.2, 0.32]} />
        <meshBasicMaterial color={CANVAS_BG} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.32, 0.05, 0.05]} />
        <meshBasicMaterial color={PALETTE.rose} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.32, 0.05, 0.05]} />
        <meshBasicMaterial color={PALETTE.rose} toneMapped={false} />
      </mesh>
      <Label position={[0, -0.36, 0]} tone="text-rose-300">
        {label}
      </Label>
    </group>
  );
}

const CORD_COLOURS = {
  white: "#efe6d4",
  grey: "#b98c86",
  canal: "#3b2a2a",
  bone: "#e6dcc4",
  root: "#efe2bf",
  artery: "#c2362f",
  vein: "#4b5f9a",
};

/** The cord's outline in the section plane: an ellipse notched by the anterior median fissure (+x) and posterior median sulcus (−x). */
function cordOutline() {
  const pts = [];
  const n = 72;
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * CORD.rx;
    const y = Math.sin(t) * CORD.ry;
    // The fissure is a deep narrow cleft; the sulcus a shallow groove.
    if (Math.abs(y) < 0.07 && x > 0) {
      pts.push([x - 0.24 * (1 - Math.abs(y) / 0.07), y * 0.35]);
    } else if (Math.abs(y) < 0.05 && x < 0) {
      pts.push([x + 0.06 * (1 - Math.abs(y) / 0.05), y]);
    } else {
      pts.push([x, y]);
    }
  }
  return pts;
}

/**
 * The grey-matter butterfly (half, y ≥ 0, from the ventral midline round to
 * the dorsal one): broad ventral horns full of motor neuron cell bodies,
 * slender dorsal horns reaching almost to the dorsolateral surface where the
 * sensory rootlets come in, joined across the middle by the grey commissure.
 */
const GREY_HALF = [
  [0.2, 0], [0.24, 0.18], [0.42, 0.26], [0.55, 0.4], [0.52, 0.6], [0.34, 0.66], [0.16, 0.52],
  [0.05, 0.5], [-0.05, 0.4], [-0.2, 0.38], [-0.36, 0.48], [-0.5, 0.56], [-0.56, 0.54],
  [-0.5, 0.44], [-0.34, 0.28], [-0.2, 0.12], [-0.16, 0],
];

function shapeOf(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  return shape;
}

function ellipsePath(cx, cy, rx, ry, path = new THREE.Path()) {
  path.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0);
  return path;
}

/**
 * The C6 segment in 3D: a short length of cord cut square across at the
 * front, the grey matter on the cut face, the surface arteries and veins, the
 * vertebra it runs through (sitting just below the cut, so the roots pass in
 * front of it the way they leave through the intervertebral foramen), the dorsal and ventral rootlets fanning into their
 * roots, the dorsal root ganglion, and the two roots joining into the spinal
 * nerve.
 */
function SpinalSegment() {
  const g = useMemo(() => {
    const depth = CORD.face - CORD.back;
    const cord = new THREE.ExtrudeGeometry(shapeOf(cordOutline()), { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 4 });
    cord.translate(0, 0, CORD.back);
    const greyPts = [...GREY_HALF, ...GREY_HALF.slice(1, -1).reverse().map(([x, y]) => [x, -y])];
    // A thin slab standing just proud of the cut face, so it never z-fights it.
    const grey = new THREE.ExtrudeGeometry(shapeOf(greyPts), { depth: 0.03, bevelEnabled: false });
    grey.translate(0, 0, CORD.face + 0.012);

    // The vertebra: body in front (ventral), arch round the canal behind,
    // spinous process pointing back, transverse processes out to the sides.
    // One joined bone: the body overlaps the arch (the pedicles), and it is
    // as deep as it is tall. A thin body standing clear of the arch read as a
    // loose plate. It stops short of the rootlets, which leave between two
    // vertebrae (the intervertebral foramen).
    const vz0 = -1.55;
    const vDepth = 0.85;
    const body = new THREE.ExtrudeGeometry(ellipsePath(1.25, 0, 0.56, 1.0, new THREE.Shape()), { depth: vDepth, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
    body.translate(0, 0, vz0);
    const archShape = ellipsePath(-0.02, 0, 1.02, 1.33, new THREE.Shape());
    archShape.holes.push(ellipsePath(0.0, 0, 0.8, 1.1));
    const arch = new THREE.ExtrudeGeometry(archShape, { depth: vDepth * 0.8, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    arch.translate(0, 0, vz0 + 0.05);
    const spinous = new THREE.ExtrudeGeometry(shapeOf([[-0.95, 0.12], [-1.62, 0.08], [-1.68, 0], [-1.62, -0.08], [-0.95, -0.12]]), { depth: vDepth * 0.7, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    spinous.translate(0, 0, vz0 + 0.08);
    const transverse = [1, -1].map((side) => {
      const t = new THREE.ExtrudeGeometry(shapeOf([[0.55, side * 1.05], [0.62, side * 1.62], [0.3, side * 1.7], [0.05, side * 1.18]]), { depth: vDepth * 0.6, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
      t.translate(0, 0, vz0 + 0.1);
      return t;
    });
    return { cord, grey, body, arch, spinous, transverse };
  }, []);
  useEffect(
    () => () => {
      for (const v of Object.values(g)) (Array.isArray(v) ? v : [v]).forEach((x) => x.dispose());
    },
    [g],
  );

  // Rootlets: a fan of fine strands off the side of the cord, spread along it, into each root.
  const rootlets = useMemo(() => {
    const fan = (from, to, zs) =>
      zs.map((z) => new THREE.CatmullRomCurve3([new THREE.Vector3(...S(from[0], from[1], z)), new THREE.Vector3(...S((from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.05, (z + 0.12) / 2)), new THREE.Vector3(...S(to[0], to[1], 0.12))]));
    return [
      ...fan([-0.52, -0.69], [-0.58, -1.08], [-0.55, -0.3, -0.05, 0.3]),
      ...fan([0.42, -0.83], [0.4, -1.22], [-0.45, -0.15, 0.2]),
    ];
  }, []);
  const roots = useMemo(
    () => ({
      dorsal: new THREE.CatmullRomCurve3([DORSAL_ROOT, S(-0.6, -1.25, 0.12), GANGLION, S(-0.45, -1.72, 0.12), JUNCTION].map((p) => new THREE.Vector3(...p))),
      ventral: new THREE.CatmullRomCurve3([VENTRAL_ROOT, S(0.3, -1.6, 0.12), JUNCTION].map((p) => new THREE.Vector3(...p))),
      nerve: new THREE.CatmullRomCurve3([...NERVE_BUNDLE, [0.05, 2.12, 0.22]].map((p) => new THREE.Vector3(...p))),
    }),
    [],
  );
  const tubes = useMemo(
    () => ({
      rootlets: rootlets.map((c) => new THREE.TubeGeometry(c, 16, 0.022, 6, false)),
      dorsal: new THREE.TubeGeometry(roots.dorsal, 40, 0.075, 10, false),
      ventral: new THREE.TubeGeometry(roots.ventral, 30, 0.07, 10, false),
      nerve: new THREE.TubeGeometry(roots.nerve, 40, 0.12, 12, false),
    }),
    [rootlets, roots],
  );
  useEffect(
    () => () => {
      tubes.rootlets.forEach((t) => t.dispose());
      tubes.dorsal.dispose();
      tubes.ventral.dispose();
      tubes.nerve.dispose();
    },
    [tubes],
  );

  const bone = <meshStandardMaterial color={CORD_COLOURS.bone} roughness={0.72} metalness={0.02} />;
  const nerveSheath = (
    <meshStandardMaterial color={CORD_COLOURS.root} roughness={0.5} transparent opacity={0.42} depthWrite={false} />
  );
  // A vessel along the cord: one of the three longitudinal spinal arteries, or a vein.
  const vessel = (x, y, colour, r = 0.028) => (
    <mesh position={[x, y, (CORD.face + CORD.back) / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, CORD.face - CORD.back, 8]} />
      <meshStandardMaterial color={colour} roughness={0.4} />
    </mesh>
  );

  return (
    <group>
      <group position={CORD.centre} scale={CORD.k}>
        <mesh geometry={g.cord}>
          <meshStandardMaterial color={CORD_COLOURS.white} roughness={0.55} metalness={0.02} />
        </mesh>
        <mesh geometry={g.grey}>
          <meshStandardMaterial color={CORD_COLOURS.grey} roughness={0.7} metalness={0.02} />
        </mesh>
        {/* Central canal, in the grey commissure. */}
        <mesh position={[0.02, 0, CORD.face + 0.045]}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color={CORD_COLOURS.canal} />
        </mesh>
        {/* Anterior spinal artery in the fissure, posterior spinal arteries and a vein behind. */}
        {vessel(0.66, 0, CORD_COLOURS.artery, 0.034)}
        {vessel(-0.56, 0.42, CORD_COLOURS.artery)}
        {vessel(-0.56, -0.42, CORD_COLOURS.artery)}
        {vessel(-0.69, 0.0, CORD_COLOURS.vein, 0.03)}
        <mesh geometry={g.body}>{bone}</mesh>
        <mesh geometry={g.arch}>{bone}</mesh>
        <mesh geometry={g.spinous}>{bone}</mesh>
        {g.transverse.map((t, i) => (
          <mesh key={i} geometry={t}>
            {bone}
          </mesh>
        ))}
      </group>

      {tubes.rootlets.map((t, i) => (
        <mesh key={i} geometry={t}>
          <meshStandardMaterial color={CORD_COLOURS.root} roughness={0.55} />
        </mesh>
      ))}
      <mesh geometry={tubes.dorsal}>{nerveSheath}</mesh>
      <mesh geometry={tubes.ventral}>{nerveSheath}</mesh>
      <mesh geometry={tubes.nerve}>{nerveSheath}</mesh>
      {/* The dorsal root ganglion: a swelling on the dorsal root. */}
      <mesh position={GANGLION} scale={[0.19, 0.28, 0.19]}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color={CORD_COLOURS.root} roughness={0.5} transparent opacity={0.55} depthWrite={false} />
      </mesh>

    </group>
  );
}

/**
 * A neuron's cell body: a soma with short dendrites in the section plane.
 * Motor neurons are big and multipolar; the relay neuron is smaller.
 */
function Soma({ position, colour, radius, dendrites, seed = 0 }) {
  const arms = useMemo(
    () =>
      Array.from({ length: dendrites }, (_, i) => {
        const a = (i / dendrites) * Math.PI * 2 + seed;
        const len = radius * (2.2 + 0.8 * Math.sin(i * 2.3 + seed));
        return { a, len };
      }),
    [dendrites, radius, seed],
  );
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 16, 12]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.4} roughness={0.4} />
      </mesh>
      {arms.map(({ a, len }, i) => (
        <mesh key={i} position={[(Math.cos(a) * len) / 2, (Math.sin(a) * len) / 2, 0]} rotation={[0, 0, a - Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.12, radius * 0.3, len, 6]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.3} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

/** The candle, its flame and the light it throws. Flickers on its own. */
function Candle({ flameRef, lightRef, Label, nociceptive = true }) {
  return (
    <group position={[CANDLE_X, 0, -0.2]}>
      {/* Dish, wax and wick. */}
      {/* Dish, a hundredth into the table top, and the wax a hundredth into
          the dish: the dish's underside used to lie exactly in the table's top
          face and the two z-fought. */}
      <mesh position={[0, TABLE_Y + 0.03, 0]}>
        <cylinderGeometry args={[0.7, 0.62, 0.08, 36]} />
        <meshStandardMaterial color="#b08a63" roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[0, TABLE_Y + 0.075, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.68, 0.025, 8, 36]} />
        <meshStandardMaterial color="#c49b70" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0, (TABLE_Y + 0.06 + CANDLE_TOP_Y) / 2, 0]}>
        <cylinderGeometry args={[0.28, 0.3, CANDLE_TOP_Y - TABLE_Y - 0.06, 32]} />
        <meshStandardMaterial color="#f7f1e3" roughness={0.42} metalness={0.02} />
      </mesh>
      {/* The melt pool, dished a little below the rim, and one run of wax down the side. */}
      <mesh position={[0, CANDLE_TOP_Y - 0.015, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.02, 28]} />
        <meshStandardMaterial color="#fff6dc" emissive="#ffcf80" emissiveIntensity={0.25} roughness={0.2} />
      </mesh>
      <mesh position={[0.27, CANDLE_TOP_Y - 0.28, 0.1]} scale={[0.6, 1, 0.6]}>
        <capsuleGeometry args={[0.05, 0.4, 4, 10]} />
        <meshStandardMaterial color="#f7f1e3" roughness={0.42} />
      </mesh>
      <mesh position={[0, CANDLE_TOP_Y + 0.08, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.18, 6]} />
        <meshStandardMaterial color="#2a2118" roughness={0.9} />
      </mesh>
      {/* Flame: outer envelope and hot inner core, both emissive. */}
      <group ref={flameRef} position={[0, CANDLE_TOP_Y + 0.14, 0]}>
        <mesh position={[0, 0.34, 0]}>
          <coneGeometry args={[0.2, 0.75, 16]} />
          <meshStandardMaterial
            color={NEURON_COLOURS.flame}
            emissive={NEURON_COLOURS.flame}
            emissiveIntensity={2.2}
            toneMapped={false}
            transparent
            opacity={0.75}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <coneGeometry args={[0.09, 0.32, 12]} />
          <meshStandardMaterial color="#bfe3ff" emissive="#7cc4ff" emissiveIntensity={2.4} toneMapped={false} transparent opacity={0.85} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.32, 12, 10]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.08} depthWrite={false} />
        </mesh>
      </group>
      <pointLight ref={lightRef} position={[0, CANDLE_TOP_Y + 0.6, 0.4]} color="#ffb060" intensity={3} distance={7} decay={2} />
      {/* The flame is near 1000 °C; the 80 °C the model uses is the skin's. */}
      <Label position={[0, TABLE_Y - 0.35, 0]} tone="text-ink-400">
        {nociceptive ? "candle flame · fingertip skin heats to ~80 °C" : "candle flame · fingertip held above it, skin at ~40 °C"}
      </Label>
    </group>
  );
}

/** Soft emissive glow used for synapses, the receptor and the end plate. */
function Flash({ innerRef, position, colour, radius = 0.16 }) {
  return (
    <mesh ref={innerRef} position={position}>
      <sphereGeometry args={[radius, 14, 12]} />
      <meshBasicMaterial color={colour} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Milestone label that lights up once its stage has been reached. */
function Milestone({ position, stage, reached, blocked, Label }) {
  return (
    <Label position={position} accent={reached && !blocked} tone={blocked ? "text-rose-300" : "text-ink-400"}>
      {`${reached ? (blocked ? "✕" : "✓") : "○"} ${stage.label}`}
    </Label>
  );
}

// ─── The clock ──────────────────────────────────────────────────────

const easeInOut = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * Drives everything that moves. Rendered as the first child of the canvas
 * so its `useFrame` runs before the rig's, and the bones, muscles and
 * impulse all see the same pose on the same frame.
 */
function ReflexDriver({ solved, slowMotion, speed, poseRef, bicepsState, tricepsState, refs, routes, reachPose, setParam }) {
  const clock = useRef({
    phase: "hold",
    phaseT: 0,
    physMs: 0,
    lastPush: 0,
    lastStage: -2,
    lastFired: false,
    cycle: 0,
    ended: false,
  });
  const scratch = useMemo(() => ({ v: new THREE.Vector3(), w: new THREE.Vector3() }), []);

  // A new stimulus or pathway restarts the event from the reach pose.
  useEffect(() => {
    const c = clock.current;
    c.phase = "hold";
    c.phaseT = 0;
    c.physMs = 0;
    c.lastStage = -2;
    c.ended = false;
    setPose(poseRef.current, reachPose.shoulder, reachPose.elbow);
  }, [solved, reachPose, poseRef]);

  useFrame((_, rawDelta) => {
    const c = clock.current;
    const dt = Math.min(rawDelta, 1 / 30) * speed;
    const rate = playbackRate(slowMotion);
    c.phaseT += dt;

    // ── Phase machine ──
    if (c.phase === "hold" && c.phaseT >= FIRST_HOLD_S) {
      c.phase = "event";
      c.phaseT = 0;
      c.physMs = 0;
    } else if (c.phase === "approach" && c.phaseT >= APPROACH_S) {
      c.phase = "event";
      c.phaseT = 0;
      c.physMs = 0;
      c.ended = false;
    } else if (c.phase === "event") {
      c.physMs += dt * 1000 * rate;
      if (c.physMs >= solved.eventEndMs) {
        c.physMs = solved.eventEndMs;
        c.phase = "linger";
        c.phaseT = 0;
        c.ended = true;
      }
    } else if (c.phase === "linger" && c.phaseT >= (solved.fires ? LINGER_FIRED_S : LINGER_STALLED_S)) {
      c.phase = "approach";
      c.phaseT = 0;
      c.cycle += 1;
    }

    // ── Pose ──
    const contraction = c.phase === "event" || c.phase === "linger" ? contractionAt(solved, c.physMs) : 0;
    let shoulder = reachPose.shoulder;
    let elbow = reachPose.elbow;
    if (c.phase === "approach" && solved.fires) {
      const k = easeInOut(c.phaseT / APPROACH_S);
      shoulder = lerp(POSES.withdrawn.shoulder, reachPose.shoulder, k);
      elbow = lerp(POSES.withdrawn.elbow, reachPose.elbow, k);
    } else if (contraction > 0) {
      // A small overshoot at the peak reads as the snap of a real withdrawal.
      const k = easeInOut(contraction);
      const overshoot = Math.sin(Math.PI * k) * 0.08;
      shoulder = lerp(reachPose.shoulder, POSES.withdrawn.shoulder, k + overshoot);
      elbow = lerp(reachPose.elbow, POSES.withdrawn.elbow, k + overshoot);
    }
    setPose(poseRef.current, shoulder, elbow);

    bicepsState.current.activation = contraction;
    bicepsState.current.strain = contraction * 0.012;
    // The biceps cannot put the arm back: on the return stroke it is the
    // triceps doing the work, and it should be seen to.
    tricepsState.current.activation =
      c.phase === "approach" && solved.fires ? 0.4 * (1 - easeInOut(c.phaseT / APPROACH_S)) : 0;

    // ── Impulse ──
    const inEvent = c.phase === "event" || c.phase === "linger";
    const stage = inEvent ? stageAt(solved, c.physMs) : { index: -1, progress: 0, stalled: false, done: false };
    const pose = poseRef.current;
    const pulse = refs.pulse.current;
    if (pulse) {
      let visible = false;
      let t = 0;
      let route = null;
      if (stage.index === 0) {
        route = routes.sensory;
        t = 0;
        visible = true;
      } else if (stage.index === 1) {
        route = routes.sensory;
        t = solved.stages[1].blocked ? stage.progress * solved.stages[1].blockAt : stage.progress;
        visible = true;
      } else if (stage.index === 2) {
        route = routes.relay;
        t = clamp((stage.progress - 0.375) / 0.25, 0, 1);
        visible = true;
      } else if (stage.index === 3) {
        route = routes.motor;
        t = solved.stages[3].blocked ? stage.progress * solved.stages[3].blockAt : stage.progress;
        visible = true;
      } else if (stage.index === 4) {
        route = routes.motor;
        t = 1;
        visible = true;
      }
      if (visible && route) {
        const head = route.at(t, pose, scratch.v);
        pulse.visible = true;
        pulse.position.copy(head);
        // The trail: a few fainter beads a little way back along the route.
        for (let i = 0; i < refs.trail.length; i += 1) {
          const bead = refs.trail[i].current;
          if (!bead) continue;
          const back = t - (i + 1) * 0.022;
          if (back < 0) {
            bead.visible = false;
            continue;
          }
          bead.visible = true;
          bead.position.copy(route.at(back, pose, scratch.w));
        }
        const pulseScale = stage.stalled ? 1.0 + 0.25 * Math.sin(c.phaseT * 18) : 1;
        pulse.scale.setScalar(pulseScale);
      } else {
        pulse.visible = false;
        for (const bead of refs.trail) if (bead.current) bead.current.visible = false;
      }
    }

    // ── Second impulse: the copy that goes up to the brain ──
    const brain = refs.brainPulse.current;
    if (brain) {
      const departs = solved.brainDepartsMs;
      if (inEvent && departs !== null && c.physMs >= departs) {
        const bt = clamp((c.physMs - departs) / 10, 0, 1);
        brain.visible = true;
        brain.position.copy(routes.brain.at(bt, pose, scratch.v));
      } else {
        brain.visible = false;
      }
    }

    // ── Flashes: receptor, the two synapses, the end plate ──
    const flash = (ref, on, strength = 1) => {
      const m = ref.current;
      if (!m) return;
      const target = on ? strength : 0;
      m.material.opacity += (target - m.material.opacity) * Math.min(1, dt * 14);
      const s = 1 + m.material.opacity * 0.9;
      m.scale.setScalar(s);
    };
    flash(refs.receptor, inEvent && stage.index === 0, 0.9);
    flash(refs.dorsalSynapse, inEvent && stage.index === 2 && stage.progress < 0.4, 0.85);
    flash(refs.ventralSynapse, inEvent && stage.index === 2 && stage.progress > 0.6 && !solved.stages[2].blocked, 0.85);
    flash(refs.endPlate, inEvent && stage.index >= 4, 0.9);

    // Pain spot at the fingertip while a burn is being registered.
    const pain = refs.pain.current;
    if (pain) {
      const on = inEvent && solved.nociceptive;
      pain.material.opacity += ((on ? 0.85 : 0) - pain.material.opacity) * Math.min(1, dt * 10);
      pain.scale.setScalar(1 + 0.25 * Math.sin(c.phaseT * 22) * (on ? 1 : 0));
    }

    // ── Flame flicker ──
    const flame = refs.flame.current;
    if (flame) {
      const s = 1 + 0.06 * Math.sin(c.phaseT * 23 + c.cycle) + 0.04 * Math.sin(c.phaseT * 41);
      flame.scale.set(1 + 0.04 * Math.sin(c.phaseT * 31), s, 1 + 0.04 * Math.cos(c.phaseT * 29));
      flame.rotation.z = 0.05 * Math.sin(c.phaseT * 17);
    }
    if (refs.light.current) refs.light.current.intensity = 2.6 + 0.6 * Math.sin(c.phaseT * 27) + 0.3 * Math.sin(c.phaseT * 53);

    // ── Report to the HUD ──
    // On every stage change immediately, otherwise on a modest cadence: the
    // Details tab is React, and it does not need sixty updates a second to
    // show a millisecond counter.
    const reportStage = inEvent ? stage.index : -1;
    const fired = inEvent && solved.fires && c.physMs >= solved.responseMs;
    const due = c.phaseT - c.lastPush > PUSH_EVERY_S || reportStage !== c.lastStage || fired !== c.lastFired;
    if (due && typeof setParam === "function") {
      c.lastPush = c.phaseT;
      c.lastStage = reportStage;
      c.lastFired = fired;
      setParam("liveMs", Math.round(c.physMs * 10) / 10);
      setParam("liveStage", reportStage);
      setParam("liveFired", fired);
      setParam("livePhase", c.phase);
    }
  });

  return null;
}

// ─── The scene ──────────────────────────────────────────────────────

/** From the cord's callouts on the left, over the brain line, down to the table and out past the candle. */
const REFLEX_VIEW = { cx: 0.75, cy: 1.5, width: 14.6, height: 10.4, depth: 3 };

/** Callouts for the cord, in two columns either side of it, ordered by height so no leaders cross. */
const CORD_CALLOUTS = {
  left: [
    { key: "white", anchor: S(-0.28, 0.78, ON_FACE), text: "White matter · axon tracts", tone: "text-ink-200" },
    { key: "vertebra", anchor: S(-1.45, 0.0, -0.7), text: "Vertebra (C6) · spinous process", tone: "text-ink-300" },
    { key: "dh", anchor: DORSAL_HORN, text: "Dorsal (back) horn · synapse", tone: "text-emerald-300" },
    { key: "dr", anchor: DORSAL_ROOT, text: "Dorsal root · sensory in", tone: "text-amber-300" },
    { key: "drg", anchor: GANGLION, text: "Dorsal root ganglion · sensory cell body", tone: "text-amber-300" },
  ],
  right: [
    { key: "grey", anchor: S(0.4, 0.45, ON_FACE), text: "Grey matter · cell bodies", tone: "text-ink-200" },
    { key: "canal", anchor: S(0.02, 0, ON_FACE), text: "Central canal", tone: "text-ink-300" },
    { key: "relay", anchor: RELAY_SOMA, text: "Relay neuron", tone: "text-violet-300" },
    { key: "vh", anchor: VENTRAL_HORN, text: "Ventral (front) horn · motor neuron", tone: "text-sky-300" },
    { key: "vr", anchor: VENTRAL_ROOT, text: "Ventral root · motor out", tone: "text-sky-300" },
    { key: "nerve", anchor: NERVE_BUNDLE[1], text: "Spinal nerve · both neurons together", tone: "text-ink-200" },
  ],
};
const CALLOUT_LEFT_X = -3.95;
// Clear of the vertebral body, which reaches x ≈ 0.2.
const CALLOUT_RIGHT_X = 0.45;
const calloutRow = (i) => 6.15 - i * 0.58;

/**
 * A light laminate bench on four legs. The old table was a dark slab whose
 * top the candle dish sat exactly in.
 */
function Table() {
  const legs = [
    [-0.9, -1.6],
    [7.7, -1.6],
    [-0.9, 1.6],
    [7.7, 1.6],
  ];
  return (
    <group>
      <mesh position={[3.4, TABLE_Y - 0.07, 0]}>
        <boxGeometry args={[9.2, 0.14, 4]} />
        <meshStandardMaterial color="#d9cdb6" roughness={0.55} metalness={0.02} />
      </mesh>
      {/* Edge banding, proud of the top's front face so no face is shared. */}
      <mesh position={[3.4, TABLE_Y - 0.07, 2.005]}>
        <boxGeometry args={[9.22, 0.15, 0.02]} />
        <meshStandardMaterial color="#b9ab92" roughness={0.5} />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, TABLE_Y - 0.13 - 0.9, z]}>
          <boxGeometry args={[0.16, 1.8, 0.16]} />
          <meshStandardMaterial color="#9aa3b2" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export default function ReflexArcCanvas({ params = {}, setParam }) {
  const { stimulus = "flame", pathway = "intact", slowMotion = true, speed = 1, liveStage = -1, showLabels = true } = params || {};
  // Every label in the scene goes through this, so one toggle clears them all.
  const Label = showLabels ? SceneLabel : NoLabel;

  const solved = useMemo(() => solveReflex({ stimulus, pathway }), [stimulus, pathway]);
  const reachPose = solved.nociceptive ? POSES.flame : POSES.warmth;

  const poseRef = useRef(null);
  if (poseRef.current === null) poseRef.current = createPose(SHOULDER, reachPose.shoulder, reachPose.elbow);

  const bicepsState = useRef({ activation: 0, fatigue: 0, strain: 0 });
  const tricepsState = useRef({ activation: 0, fatigue: 0, strain: 0 });

  const routes = useMemo(
    () => ({
      sensory: makeRoute(SENSORY_ROUTE),
      relay: makeRoute(RELAY_ROUTE),
      motor: makeRoute(MOTOR_ROUTE),
      brain: makeRoute(BRAIN_ROUTE),
    }),
    [],
  );

  // Where the cuts sit: at the same fraction of each route the timing model
  // stops the impulse at, so the bead halts exactly on the marker.
  const cuts = useMemo(() => {
    const straight = createPose(SHOULDER, 0, 0);
    return {
      dorsal: routes.sensory.at(DORSAL_ROOT_FRACTION, straight, new THREE.Vector3()).toArray(),
      ventral: routes.motor.at(VENTRAL_ROOT_FRACTION, straight, new THREE.Vector3()).toArray(),
    };
  }, [routes]);

  const refs = useMemo(
    () => ({
      pulse: { current: null },
      trail: [0, 1, 2, 3].map(() => ({ current: null })),
      brainPulse: { current: null },
      receptor: { current: null },
      dorsalSynapse: { current: null },
      ventralSynapse: { current: null },
      endPlate: { current: null },
      pain: { current: null },
      flame: { current: null },
      light: { current: null },
    }),
    [],
  );

  const stageIndex = typeof liveStage === "number" ? liveStage : -1;
  const reached = (i) => solved.stages[i].reached && stageIndex >= i;
  const blocked = (i) => solved.stages[i].blocked && stageIndex >= i;

  return (
    <div className="relative h-full w-full">
    <SceneCanvas
      camera={{ position: [1.9, 1.6, 14.5], fov: 46 }}
      controls={{ minDistance: 5, maxDistance: 30 }}
      lights={{ ambient: 0.68, keyLight: 1.2, rim: PALETTE.gold }}
    >
      <LabelsOn.Provider value={showLabels !== false}>
      <FitCamera view={REFLEX_VIEW} direction={[0, 0.08, 1]} fov={46} />
      <ReflexDriver
        solved={solved}
        slowMotion={Boolean(slowMotion)}
        speed={speed}
        poseRef={poseRef}
        bicepsState={bicepsState}
        tricepsState={tricepsState}
        refs={refs}
        routes={routes}
        reachPose={reachPose}
        setParam={setParam}
      />

      <Table />

      {/* Its own Suspense: without one the whole canvas suspends and remounts
          while the model streams (see the cardiac scene's heart). */}
      <Suspense fallback={null}>
      <ModelledArm
        poseRef={poseRef}
        handRef={POINTING}
        bicepsState={bicepsState}
        tricepsState={tricepsState}
        humerusChildren={
          <>
            <RouteTubes route={routes.sensory} frame="humerus" colour={NEURON_COLOURS.sensory} />
            <RouteTubes route={routes.motor} frame="humerus" colour={NEURON_COLOURS.motor} />
            <Flash innerRef={(el) => (refs.endPlate.current = el)} position={NMJ_LOCAL} colour={NEURON_COLOURS.synapse} radius={0.2} />
            <Label position={[NMJ_LOCAL[0] + 0.35, NMJ_LOCAL[1] - 0.45, NMJ_LOCAL[2]]} tone="text-emerald-300">
              neuromuscular junction
            </Label>
            <Label position={[0.95, -1.35, 0.1]} tone="text-ink-200">
              biceps brachii · effector
            </Label>
          </>
        }
        forearmChildren={
          <>
            <RouteTubes route={routes.sensory} frame="forearm" colour={NEURON_COLOURS.sensory} />
            <Flash innerRef={(el) => (refs.receptor.current = el)} position={SENSORY_ROUTE[0].points[0]} colour={NEURON_COLOURS.sensory} radius={0.18} />
            <mesh ref={(el) => (refs.pain.current = el)} position={SENSORY_ROUTE[0].points[0]}>
              <sphereGeometry args={[0.11, 12, 10]} />
              <meshBasicMaterial color={NEURON_COLOURS.pain} transparent opacity={0} toneMapped={false} depthWrite={false} />
            </mesh>
            {/* Behind the forearm, clear of the elbow labels when the arm pulls back. */}
            <Label position={[-0.55, -2.0, 0.3]} tone="text-amber-300">
              sensory neuron
            </Label>
          </>
        }
      />
      </Suspense>


      {/* Nerves in the fixed part of the body: shoulder to cord and back. */}
      <RouteTubes route={routes.sensory} frame="world" colour={NEURON_COLOURS.sensory} />
      <RouteTubes route={routes.relay} frame="world" colour={NEURON_COLOURS.relay} radius={0.05} />
      <RouteTubes route={routes.motor} frame="world" colour={NEURON_COLOURS.motor} />
      <RouteTubes route={routes.brain} frame="world" colour={NEURON_COLOURS.brain} dashed />

      <SpinalSegment />

      {/* Cell bodies: the sensory neuron's in the ganglion, on a short stalk
          off its axon (it is pseudo-unipolar); the relay neuron's and the big
          multipolar motor neuron's in the grey matter. */}
      <Soma position={[GANGLION[0] - 0.13, GANGLION[1] + 0.02, GANGLION[2] + 0.06]} colour={NEURON_COLOURS.sensory} radius={0.085} dendrites={0} />
      <Soma position={RELAY_SOMA} colour={NEURON_COLOURS.relay} radius={0.055} dendrites={3} seed={0.6} />
      <Soma position={VENTRAL_HORN} colour={NEURON_COLOURS.motor} radius={0.085} dendrites={5} seed={1.1} />

      {CORD_CALLOUTS.left.map((c, i) => (
        <Callout key={c.key} anchor={c.anchor} at={[CALLOUT_LEFT_X, calloutRow(i), 0]} side="left" tone={c.tone}>
          {c.text}
        </Callout>
      ))}
      {CORD_CALLOUTS.right.map((c, i) => (
        <Callout key={c.key} anchor={c.anchor} at={[CALLOUT_RIGHT_X, calloutRow(i), 0]} side="right" tone={c.tone}>
          {c.text}
        </Callout>
      ))}
      <Label position={[BRAIN_TOP[0] - 0.2, BRAIN_TOP[1] + 0.35, 0]} tone={solved.sensationReachesBrain ? "text-ink-200" : "text-ink-600"}>
        {solved.sensationReachesBrain ? "to brain · sensation felt (later)" : "to brain · nothing arrives"}
      </Label>

      {/* The five stages as one checklist, right, above the candle and clear of
          the cord callouts and the withdrawn hand. Scattered on the arm they
          moved with it, and on withdrawal three of them landed on the elbow. */}
      {STAGES.map((stage, i) => (
        <Milestone key={stage.label} position={[6.75, 2.9 - i * 0.5, 0]} stage={stage} reached={reached(i)} blocked={blocked(i)} Label={Label} />
      ))}

      <Flash innerRef={(el) => (refs.dorsalSynapse.current = el)} position={DORSAL_HORN} colour={NEURON_COLOURS.synapse} />
      <Flash innerRef={(el) => (refs.ventralSynapse.current = el)} position={VENTRAL_HORN} colour={NEURON_COLOURS.synapse} />

      {pathway === "dorsal" && <Cut position={cuts.dorsal} label="dorsal root severed" Label={Label} />}
      {pathway === "ventral" && <Cut position={cuts.ventral} label="ventral root severed" Label={Label} />}

      {/* The impulse: a bright head with a short fading trail. */}
      <mesh ref={(el) => (refs.pulse.current = el)} visible={false}>
        <sphereGeometry args={[0.13, 14, 12]} />
        <meshStandardMaterial color={NEURON_COLOURS.impulse} emissive={NEURON_COLOURS.impulse} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      {refs.trail.map((holder, i) => (
        <mesh key={i} ref={(el) => (holder.current = el)} visible={false}>
          <sphereGeometry args={[0.1 - i * 0.018, 10, 8]} />
          <meshBasicMaterial color={NEURON_COLOURS.impulse} transparent opacity={0.55 - i * 0.12} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={(el) => (refs.brainPulse.current = el)} visible={false}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshBasicMaterial color={PALETTE.bone} transparent opacity={0.8} toneMapped={false} />
      </mesh>

      {/* What this run shows. Mild warmth in particular looks like "nothing
          happened" unless the scene says why: that IS the lesson. */}
      <Label position={[6.55, 5.45, 0]} tone={solved.fires ? "text-emerald-200" : "text-amber-200"}>
        <span className="inline-block w-56 whitespace-normal text-center leading-snug">{OUTCOME[solved.reason ?? "fires"](solved)}</span>
      </Label>

      <Candle flameRef={(el) => (refs.flame.current = el)} lightRef={(el) => (refs.light.current = el)} Label={Label} nociceptive={solved.nociceptive} />
      </LabelsOn.Provider>
    </SceneCanvas>
    </div>
  );
}
