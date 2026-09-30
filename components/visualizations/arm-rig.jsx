"use client";

import * as THREE from "three";
import { DEG, PALETTE } from "@/components/visualizations/scene-kit";
import { ARM_MODEL } from "@/components/visualizations/arm-model-meta";

// ─── Shared arm rig ─────────────────────────────────────────────────
// The kinematics both nerve-and-muscle scenes move the arm with: a
// two-joint chain (shoulder, elbow) whose frames the modelled arm
// (`arm-model.jsx`) hangs its bones and muscles on, and the attachment
// points the scenes mark and draw forces at.
//
// The reflex-arc scene and the antagonistic-muscles scene want the same
// forearm, the same elbow pivot and the same muscle origins and insertions;
// building it twice would have meant two arms that disagreed about where the
// biceps tendon goes. So the anatomy lives here and in the model, and the
// scenes only decide what the arm is doing.
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

const GRIP = ARM_MODEL.grip;
const MARKS = ARM_MODEL.landmarks;

/** Bone lengths and the default shoulder position, world units (dm). */
export const ARM = {
  shoulder: [0, 2.4, 0],
  /** Humeral head centre (the shoulder's pivot) to the elbow axis. */
  humerus: 3.0,
  /** Elbow axis to the wrist (the radiocarpal joint). */
  forearm: 2.26,
  /** Elbow axis to the centre of a dumbbell handle gripped in the hand. */
  handCentre: -GRIP.centre[1],
  /** Anterior offset of that handle from the forearm axis. */
  handForward: GRIP.centre[0],
  /** Where the index fingertip sits in the forearm's frame, pointing. */
  fingertipLocal: ARM_MODEL.indexTip,
};

export const RIG_COLOURS = {
  bone: "#e8dcc4",
  muscleRelaxed: "#9c2f3a",
  muscleContracted: "#ff5a6e",
  muscleFatigued: "#6e2f66",
  tendon: "#eceae2",
};

/**
 * Where the biceps and triceps attach, in the local frame of the bone each
 * end rides on, measured off the model: the biceps from the coracoid (its
 * short head; the long head's tendon starts just above the glenoid) to the
 * radial tuberosity, a few cm below the elbow on the front of the radius;
 * the triceps from the infraglenoid tubercle to the olecranon, the point of
 * the elbow that hooks BEHIND the elbow axis.
 *
 * Local frames put the proximal joint at the origin, run the bone down the
 * −y axis, and point +x anteriorly (towards the front of the body).
 */
export const MUSCLE_SPECS = {
  biceps: {
    key: "biceps",
    label: "Biceps brachii",
    origin: { frame: "humerus", local: MARKS.bicepsOrigin },
    insertion: { frame: "forearm", local: MARKS.bicepsInsertion },
  },
  triceps: {
    key: "triceps",
    label: "Triceps brachii",
    origin: { frame: "humerus", local: MARKS.tricepsOrigin },
    insertion: { frame: "forearm", local: MARKS.tricepsInsertion },
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

// ─── Props that ride on the arm ─────────────────────────────────────

/**
 * A dumbbell gripped in the hand, sized by its mass; nothing at zero. Its
 * handle sits where the model's grip closes (ARM_MODEL.grip, forearm frame),
 * so render it among the forearm's children.
 */
export function Dumbbell({ kg }) {
  if (!(kg > 0.05)) return null;
  const plateR = 0.3 + 0.018 * kg;
  const plateT = 0.12 + 0.008 * kg;
  // The handle spans the hand's width with room either side of the palm.
  const barHalf = 0.42;
  return (
    <group position={GRIP.centre} rotation={[Math.PI / 2, 0, 0]}>
      {/* Moderate metalness: with no environment map to reflect, a high value
          renders metal nearly black. */}
      <mesh>
        <cylinderGeometry args={[GRIP.radius, GRIP.radius, barHalf * 2 + plateT * 2 + 0.16, 24]} />
        <meshStandardMaterial color="#b9c1cc" roughness={0.42} metalness={0.4} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Rubber-coated plate, with a raised rim and a hub. */}
          <mesh position={[0, side * (barHalf + plateT / 2), 0]}>
            <cylinderGeometry args={[plateR, plateR, plateT, 40]} />
            <meshStandardMaterial color="#4f5b6d" roughness={0.65} metalness={0.08} />
          </mesh>
          <mesh position={[0, side * (barHalf + plateT / 2), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[plateR - 0.015, 0.03, 8, 40]} />
            <meshStandardMaterial color="#667389" roughness={0.55} metalness={0.08} />
          </mesh>
          <mesh position={[0, side * (barHalf + plateT + 0.04), 0]}>
            <cylinderGeometry args={[GRIP.radius * 1.5, GRIP.radius * 1.5, 0.09, 20]} />
            <meshStandardMaterial color="#c2c9d4" roughness={0.3} metalness={0.35} />
          </mesh>
        </group>
      ))}
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
