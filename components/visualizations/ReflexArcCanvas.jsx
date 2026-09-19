"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  CANVAS_BG,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  lerp,
} from "@/components/visualizations/scene-kit";
import { makeFlowPath } from "@/components/visualizations/charge-carriers";
import {
  ArmSkeleton,
  MUSCLE_SPECS,
  Muscle,
  createPose,
  frameOf,
  localToWorld,
  setPose,
  useArmTextures,
} from "@/components/visualizations/arm-rig";
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
// The arm is the shared rig from `arm-rig.jsx`; the nerves are hung on its
// bones so they follow the withdrawal for free.
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

const CANDLE_X = 5.85;
const TABLE_Y = -3.2;
const CANDLE_TOP_Y = -1.75;

/** Transverse section of the cord, hung behind and above the shoulder. */
const CORD = { centre: [-1.4, 4.4, 0], rx: 0.95, ry: 0.8, depth: 0.5 };
/** Nerves inside the cord run just in front of its cut face, so they read. */
const NERVE_Z = 0.46;
const DORSAL_HORN = [-1.9, 4.05, NERVE_Z];
const VENTRAL_HORN = [-0.9, 4.0, NERVE_Z];
const GANGLION = [-2.55, 3.25, 0.05];
const BRAIN_TOP = [-1.72, 5.75, 0.25];

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
      [0.04, -3.72, -0.2],
      [0.12, -3.2, -0.1],
      [0.16, -2.6, 0.05],
      [0.2, -1.8, 0.14],
      [0.15, -0.8, 0.25],
      [0.05, 0.0, 0.32],
    ],
  },
  {
    frame: "humerus",
    points: [
      [0.05, -3.0, 0.32],
      [0.0, -2.2, 0.34],
      [-0.02, -1.2, 0.34],
      [-0.1, -0.35, 0.32],
      [-0.12, -0.15, 0.3],
    ],
  },
  {
    frame: "world",
    points: [
      [SHOULDER[0] - 0.12, SHOULDER[1] - 0.15, 0.3],
      [-0.6, 2.35, 0.25],
      [-1.4, 2.7, 0.15],
      [-2.3, 3.0, 0.05],
      GANGLION,
      [-2.35, 3.6, 0.15],
      DORSAL_HORN,
    ],
  },
];

const RELAY_ROUTE = [
  {
    frame: "world",
    points: [DORSAL_HORN, [-1.5, 4.14, NERVE_Z], [-1.15, 4.07, NERVE_Z], VENTRAL_HORN],
  },
];

const MOTOR_ROUTE = [
  {
    frame: "world",
    points: [
      VENTRAL_HORN,
      [-0.55, 3.6, 0.2],
      [-0.35, 3.2, 0.1],
      [0.0, 2.75, 0.1],
      [0.3, 2.35, 0.1],
      [SHOULDER[0] + 0.32, SHOULDER[1] - 0.1, 0.1],
    ],
  },
  {
    frame: "humerus",
    points: [
      [0.32, -0.1, 0.1],
      [0.44, -0.6, 0.12],
      [0.55, -1.3, 0.14],
      [0.58, -1.75, 0.16],
    ],
  },
];

const BRAIN_ROUTE = [
  {
    frame: "world",
    points: [DORSAL_HORN, [-1.78, 4.5, NERVE_Z], [-1.7, 5.05, 0.28], BRAIN_TOP],
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
function Cut({ position, label }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.22, 0.22, 0.7]} />
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
      <SceneLabel position={[0, -0.36, 0]} tone="text-rose-300">
        {label}
      </SceneLabel>
    </group>
  );
}

/**
 * Transverse section of the spinal cord: an ellipse of white matter with
 * the grey-matter butterfly standing slightly proud of its cut face, drawn
 * so that dorsal is towards the back of the body (−x) and ventral towards
 * the front, which is the orientation the arm's nerves arrive in.
 */
function SpinalCordSection() {
  const geometries = useMemo(() => {
    const white = new THREE.Shape();
    white.absellipse(0, 0, CORD.rx, CORD.ry, 0, Math.PI * 2, false, 0);
    const whiteGeom = new THREE.ExtrudeGeometry(white, { depth: CORD.depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 });
    whiteGeom.translate(0, 0, -CORD.depth / 2);

    const grey = new THREE.Shape();
    const outline = [
      [-0.66, 0.6], [-0.45, 0.35], [-0.25, 0.17], [0.0, 0.16], [0.25, 0.22], [0.5, 0.48], [0.68, 0.3],
      [0.58, 0.08], [0.58, -0.08], [0.68, -0.3], [0.5, -0.48], [0.25, -0.22], [0.0, -0.16], [-0.25, -0.17],
      [-0.45, -0.35], [-0.66, -0.6], [-0.5, -0.28], [-0.38, 0], [-0.5, 0.28],
    ];
    grey.moveTo(outline[0][0], outline[0][1]);
    grey.splineThru(outline.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
    grey.closePath();
    // Deeper than the white matter plus its bevel, so the butterfly stands
    // proud of the cut face instead of vanishing inside it.
    const greyDepth = CORD.depth + 0.24;
    const greyGeom = new THREE.ExtrudeGeometry(grey, { depth: greyDepth, bevelEnabled: false });
    greyGeom.translate(0, 0, -greyDepth / 2);
    return { white: whiteGeom, grey: greyGeom };
  }, []);
  useEffect(
    () => () => {
      geometries.white.dispose();
      geometries.grey.dispose();
    },
    [geometries],
  );

  return (
    <group position={CORD.centre}>
      <mesh geometry={geometries.white} castShadow>
        <meshStandardMaterial color="#f3ede1" roughness={0.6} metalness={0.02} />
      </mesh>
      <mesh geometry={geometries.grey}>
        <meshStandardMaterial color="#c9a3a3" roughness={0.7} metalness={0.02} />
      </mesh>
      {/* Central canal. */}
      <mesh position={[0, 0, CORD.depth / 2 + 0.13]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
        <meshBasicMaterial color="#3b2a2a" />
      </mesh>
      <SceneLabel position={[0.3, CORD.ry + 0.42, 0]} tone="text-ink-200">
        spinal cord · transverse section
      </SceneLabel>
      <SceneLabel position={[-CORD.rx - 0.55, 0.35, 0]} tone="text-ink-500">
        dorsal (back)
      </SceneLabel>
      <SceneLabel position={[CORD.rx + 0.6, 0.35, 0]} tone="text-ink-500">
        ventral (front)
      </SceneLabel>
    </group>
  );
}

/** The candle, its flame and the light it throws. Flickers on its own. */
function Candle({ flameRef, lightRef }) {
  return (
    <group position={[CANDLE_X, 0, -0.2]}>
      {/* Dish, wax and wick. */}
      <mesh position={[0, TABLE_Y + 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.7, 0.62, 0.08, 28]} />
        <meshStandardMaterial color="#8a6a52" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, (TABLE_Y + 0.08 + CANDLE_TOP_Y) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.3, CANDLE_TOP_Y - TABLE_Y - 0.08, 24]} />
        <meshStandardMaterial color="#f5efe0" roughness={0.5} metalness={0.02} />
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
      <SceneLabel position={[0, TABLE_Y - 0.35, 0]} tone="text-ink-400">
        candle · flame ≈ 80 °C at the tip
      </SceneLabel>
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
function Milestone({ position, stage, reached, blocked }) {
  return (
    <SceneLabel position={position} accent={reached && !blocked} tone={blocked ? "text-rose-300" : "text-ink-400"}>
      {`${reached ? (blocked ? "✕" : "✓") : "○"} ${stage.label}`}
    </SceneLabel>
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

export default function ReflexArcCanvas({ params = {}, setParam }) {
  const { stimulus = "flame", pathway = "intact", slowMotion = true, speed = 1, liveStage = -1 } = params || {};

  const solved = useMemo(() => solveReflex({ stimulus, pathway }), [stimulus, pathway]);
  const reachPose = solved.nociceptive ? POSES.flame : POSES.warmth;

  const poseRef = useRef(null);
  if (poseRef.current === null) poseRef.current = createPose(SHOULDER, reachPose.shoulder, reachPose.elbow);

  const bicepsState = useRef({ activation: 0, fatigue: 0, strain: 0 });
  const tricepsState = useRef({ activation: 0, fatigue: 0, strain: 0 });
  const textures = useArmTextures();

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
    <SceneCanvas
      camera={{ position: [1.9, 1.6, 14.5], fov: 46 }}
      controls={{ minDistance: 5, maxDistance: 30, target: [1.9, 1.1, 0] }}
      lights={{ ambient: 0.5, keyLight: 1.1, rim: PALETTE.gold }}
    >
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

      {/* Table the candle stands on. */}
      <mesh position={[3.4, TABLE_Y - 0.06, 0]} receiveShadow>
        <boxGeometry args={[9, 0.12, 4]} />
        <meshStandardMaterial color="#3b4557" roughness={0.75} metalness={0.15} />
      </mesh>

      <ArmSkeleton
        poseRef={poseRef}
        grip={0}
        humerusChildren={
          <>
            <RouteTubes route={routes.sensory} frame="humerus" colour={NEURON_COLOURS.sensory} />
            <RouteTubes route={routes.motor} frame="humerus" colour={NEURON_COLOURS.motor} />
            <Flash innerRef={(el) => (refs.endPlate.current = el)} position={NMJ_LOCAL} colour={NEURON_COLOURS.synapse} radius={0.2} />
            <SceneLabel position={[NMJ_LOCAL[0] + 0.25, NMJ_LOCAL[1] - 0.42, NMJ_LOCAL[2]]} tone="text-emerald-300">
              neuromuscular junction
            </SceneLabel>
            <Milestone position={[0.95, -1.75, 0.2]} stage={STAGES[4]} reached={reached(4)} blocked={blocked(4)} />
            <SceneLabel position={[0.35, -1.1, 0.5]} tone="text-sky-300">
              motor neuron
            </SceneLabel>
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
            <Milestone position={[0.55, -3.95, 0.1]} stage={STAGES[0]} reached={reached(0)} blocked={blocked(0)} />
            <Milestone position={[0.75, -1.7, 0.3]} stage={STAGES[1]} reached={reached(1)} blocked={blocked(1)} />
          </>
        }
      />

      <Muscle poseRef={poseRef} spec={MUSCLE_SPECS.biceps} stateRef={bicepsState} textures={textures} label="biceps brachii · effector" labelOffset={0.55} />
      <Muscle poseRef={poseRef} spec={MUSCLE_SPECS.triceps} stateRef={tricepsState} textures={textures} showLabel={false} />

      {/* Nerves in the fixed part of the body: shoulder to cord and back. */}
      <RouteTubes route={routes.sensory} frame="world" colour={NEURON_COLOURS.sensory} />
      <RouteTubes route={routes.relay} frame="world" colour={NEURON_COLOURS.relay} radius={0.05} />
      <RouteTubes route={routes.motor} frame="world" colour={NEURON_COLOURS.motor} />
      <RouteTubes route={routes.brain} frame="world" colour={NEURON_COLOURS.brain} dashed />

      <SpinalCordSection />

      {/* Dorsal root ganglion: the sensory neuron's cell body, outside the cord. */}
      <mesh position={GANGLION} castShadow>
        <sphereGeometry args={[0.2, 18, 14]} />
        <meshStandardMaterial color={NEURON_COLOURS.sensory} emissive={NEURON_COLOURS.sensory} emissiveIntensity={0.45} roughness={0.4} />
      </mesh>
      <SceneLabel position={[-3.1, 3.0, 0]} tone="text-amber-300">
        dorsal root ganglion
      </SceneLabel>
      <SceneLabel position={[-1.75, 2.45, 0]} tone="text-amber-300">
        sensory neuron
      </SceneLabel>
      <SceneLabel position={[-1.4, 3.7, 0.3]} tone="text-violet-300">
        relay neuron
      </SceneLabel>
      <SceneLabel position={[0.35, 3.05, 0]} tone="text-sky-300">
        ventral root
      </SceneLabel>
      <SceneLabel position={[-2.75, 3.95, 0]} tone="text-amber-300">
        dorsal root
      </SceneLabel>
      <SceneLabel position={[BRAIN_TOP[0], BRAIN_TOP[1] + 0.35, 0]} tone={solved.sensationReachesBrain ? "text-ink-200" : "text-ink-600"}>
        {solved.sensationReachesBrain ? "to brain · sensation felt (later)" : "to brain · nothing arrives"}
      </SceneLabel>

      <Milestone position={[0.75, 4.25, 0.2]} stage={STAGES[2]} reached={reached(2)} blocked={blocked(2)} />
      <Milestone position={[0.75, 3.7, 0.2]} stage={STAGES[3]} reached={reached(3)} blocked={blocked(3)} />

      <Flash innerRef={(el) => (refs.dorsalSynapse.current = el)} position={DORSAL_HORN} colour={NEURON_COLOURS.synapse} />
      <Flash innerRef={(el) => (refs.ventralSynapse.current = el)} position={VENTRAL_HORN} colour={NEURON_COLOURS.synapse} />

      {pathway === "dorsal" && <Cut position={cuts.dorsal} label="dorsal root severed" />}
      {pathway === "ventral" && <Cut position={cuts.ventral} label="ventral root severed" />}

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

      <Candle flameRef={(el) => (refs.flame.current = el)} lightRef={(el) => (refs.light.current = el)} />

    </SceneCanvas>
  );
}
