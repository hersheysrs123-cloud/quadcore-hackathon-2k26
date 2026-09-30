"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  DEG,
  FitCamera,
  NoLabel,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
} from "@/components/visualizations/scene-kit";
import { FORCE_COLOURS, ForceVector, arcPoints, useForceScale } from "@/components/visualizations/force-diagram";
import {
  ARM,
  Dumbbell,
  JointMarker,
  MUSCLE_SPECS,
  RIG_COLOURS,
  createPose,
  localToWorld,
  setPose,
} from "@/components/visualizations/arm-rig";
import { ModelledArm } from "@/components/visualizations/arm-model";
import {
  FATIGUE_DONE,
  FATIGUE_ONSET_S,
  clampAngle,
  clampLoad,
  fatigueAt,
  loadLeverArm,
  settledAngle,
  solveMuscles,
} from "@/lib/muscleMechanics";

// ─── Antagonistic muscle pairs ──────────────────────────────────────
// Our anatomical arm (`arm-model.jsx`) hung from a vertical humerus, a
// dumbbell in the hand, and the biceps and triceps shown as the pair they
// are: the biceps shortens and swells while the triceps is drawn out over
// the elbow, each lights up as it works, and they swap roles the moment the
// joint changes direction. The hand closes round the handle when there is
// a load to hold and relaxes when there is none.
//
// The elbow angle the slider asks for is a REQUEST. `lib/muscleMechanics.js`
// decides whether the biceps can actually hold it with this load at this
// level of fatigue, and if it cannot the arm gives way to the angle it can
// hold — which after the fatigue trigger means watching the dumbbell sag
// and then slowly lift again as the lactic acid clears.
//
// The free-body overlay is the lever. The load's weight acts a long way
// from the elbow; the biceps pulls a short way from it; and τ = F·d on both
// sides of the joint is why the muscle force is so much bigger than the
// weight it holds.
// ─────────────────────────────────────────────────────────────────────

const SHOULDER = [0, 2.6, 0];

/**
 * Scapula to the hanging hand, and out to the hand at full flexion. Seen from
 * the side, because the lever — the elbow angle, the moment arm, the two
 * forces — is a flat diagram in the arm's own plane; the old three-quarter
 * view from the right foreshortened it and stacked every label on the elbow.
 */
const MUSCLE_VIEW = { cx: 0.9, cy: -0.4, width: 8.6, height: 8.8, depth: 2 };

/** How often the scene reports to the HUD while the arm is moving, seconds. */
const PUSH_EVERY_S = 0.1;

const easeRate = (dt, k) => 1 - Math.exp(-dt * k);

/** Where the hand's centre is in the world at this elbow angle. */
function handWorld(pose, out) {
  return localToWorld(pose.forearm, [ARM.handForward, -ARM.handCentre, 0], out);
}

// ─── The clock ──────────────────────────────────────────────────────

/**
 * Eases the arm towards the angle it can hold, tracks which way it is
 * going, runs the fatigue clock, and tells the HUD about all three. Rendered
 * first so the rig sees this frame's pose.
 */
function MuscleDriver({ target, loadKg, fatigueTrigger, speed, poseRef, handRef, bicepsState, tricepsState, setParam }) {
  const clock = useRef({
    t: 0,
    grip: loadKg > 0.05 ? 1 : 0,
    angle: target,
    prevTarget: target,
    motion: "holding",
    fatigueTrigger,
    fatigueStart: null,
    fatigue: 0,
    lastPush: -1,
    pushed: { angle: null, motion: null, fatigue: null },
  });

  useFrame((_, rawDelta) => {
    const c = clock.current;
    const dt = Math.min(rawDelta, 1 / 30) * speed;
    c.t += dt;

    // A press of the fatigue button starts the clock; a second press restarts it.
    if (fatigueTrigger !== c.fatigueTrigger) {
      c.fatigueTrigger = fatigueTrigger;
      if (fatigueTrigger > 0) c.fatigueStart = c.t;
    }
    // The build-up starts from zero, so "recovered" only means anything once
    // the onset is over and the level has decayed away.
    const since = c.fatigueStart === null ? -1 : c.t - c.fatigueStart;
    c.fatigue = fatigueAt(since);
    if (since > FATIGUE_ONSET_S && c.fatigue < FATIGUE_DONE) {
      c.fatigue = 0;
      c.fatigueStart = null;
    }

    // Direction of travel comes from the slider, not from the arm: an arm
    // sagging under fatigue is not "extending", it is failing to flex.
    if (target !== c.prevTarget) {
      c.motion = target > c.prevTarget ? "flexing" : "extending";
      c.prevTarget = target;
    }

    const goal = settledAngle(target, loadKg, c.fatigue);
    const sagging = goal < c.angle - 0.5 && c.fatigue > 0.02;
    // A failing muscle lets go more slowly than a working one moves.
    c.angle += (goal - c.angle) * easeRate(dt, sagging ? 3 : 6);
    if (c.motion !== "holding" && Math.abs(goal - c.angle) < 0.35) c.motion = "holding";

    // Tremor: a fatigued muscle cannot hold a steady tension.
    const tremor = c.fatigue * (1.1 * Math.sin(c.t * 31) + 0.55 * Math.sin(c.t * 47 + 1.2));
    setPose(poseRef.current, 0, clamp(c.angle + tremor, 0, 145));

    // The fingers close round the handle when a load goes on, and open when
    // it comes off.
    c.grip += ((loadKg > 0.05 ? 1 : 0) - c.grip) * easeRate(dt, 5);
    handRef.current.t = c.grip;

    const solved = solveMuscles({ elbowAngle: target, loadKg, fatigue: c.fatigue, motion: c.motion });
    bicepsState.current.activation = solved.biceps.active ? 0.3 + 0.7 * solved.biceps.utilisation : 0;
    bicepsState.current.fatigue = c.fatigue;
    bicepsState.current.strain = solved.biceps.tendonStrain;
    tricepsState.current.activation = solved.triceps.active ? 0.75 : 0.06;
    tricepsState.current.fatigue = c.fatigue * 0.4;
    tricepsState.current.strain = solved.triceps.tendonStrain;

    // Report only what changed, and not more than ten times a second.
    if (typeof setParam !== "function") return;
    const angle = Math.round(c.angle);
    const fatigue = Math.round(c.fatigue * 100) / 100;
    const due = c.t - c.lastPush >= PUSH_EVERY_S;
    const p = c.pushed;
    if (due && (p.angle !== angle || p.motion !== c.motion || p.fatigue !== fatigue)) {
      c.lastPush = c.t;
      if (p.angle !== angle) setParam("liveAngle", angle);
      if (p.motion !== c.motion) setParam("liveMotion", c.motion);
      if (p.fatigue !== fatigue) setParam("liveFatigue", fatigue);
      p.angle = angle;
      p.motion = c.motion;
      p.fatigue = fatigue;
    }
  });

  return null;
}

// ─── Overlays ───────────────────────────────────────────────────────

/** The elbow angle drawn as an arc from the line of the humerus to the forearm. */
function AngleArc({ elbow, angleDeg, Label }) {
  const from = -Math.PI / 2;
  const to = from + angleDeg * DEG;
  const points = useMemo(() => arcPoints(elbow, 0.85, from, to, 40), [elbow, from, to]);
  const mid = from + (to - from) / 2;
  if (angleDeg < 4) return null;
  return (
    <>
      <Line points={points} color={PALETTE.sky} lineWidth={1.8} transparent opacity={0.85} />
      <Label position={[elbow[0] + Math.cos(mid) * 1.25, elbow[1] + Math.sin(mid) * 1.25, elbow[2]]} tone="text-sky-300">
        {`θ = ${angleDeg.toFixed(0)}°`}
      </Label>
    </>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

/** A cone at `at`, pointing the way from `from` to `at`. */
function ArrowHead({ at, from, colour, length = 0.3, radius = 0.12 }) {
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(at[0] - from[0], at[1] - from[1], at[2] - from[2]).normalize();
    return new THREE.Quaternion().setFromUnitVectors(UP, dir);
  }, [at, from]);
  return (
    <mesh position={at} quaternion={quaternion}>
      <coneGeometry args={[radius, length, 14]} />
      <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={1.2} toneMapped={false} />
    </mesh>
  );
}

/** A curved arrow round the elbow for the load's torque — it tries to extend the joint. */
function TorqueArc({ elbow, forearmAngleDeg, torque, Label }) {
  const centre = -Math.PI / 2 + forearmAngleDeg * DEG;
  const from = centre + 0.55;
  const to = centre - 0.55;
  const radius = 1.45;
  const points = useMemo(() => arcPoints(elbow, radius, from, to, 32), [elbow, from, to]);
  if (torque < 0.3) return null;
  const tip = points[points.length - 1];
  const prev = points[points.length - 3];
  return (
    <>
      <Line points={points} color={FORCE_COLOURS.weightParallel} lineWidth={2.2} transparent opacity={0.9} />
      <ArrowHead at={tip} from={prev} colour={FORCE_COLOURS.weightParallel} />
      <Label position={[tip[0] + 0.15, tip[1] - 0.45, 0]} tone="text-orange-300">
        {`τ = F·d = ${torque.toFixed(1)} N·m`}
      </Label>
    </>
  );
}

/** Dashed guides showing the perpendicular distance from the elbow to the load's line of action. */
function LeverGuides({ elbow, hand, leverArmM, Label }) {
  const foot = [hand[0], elbow[1], elbow[2]];
  if (leverArmM < 0.015) return null;
  return (
    <>
      <Line points={[elbow, foot]} color={PALETTE.slate} lineWidth={1.4} dashed dashSize={0.14} gapSize={0.1} transparent opacity={0.8} />
      <Line points={[hand, foot]} color={PALETTE.slate} lineWidth={1.2} dashed dashSize={0.1} gapSize={0.08} transparent opacity={0.6} />
      <Label position={[(elbow[0] + foot[0]) / 2, elbow[1] - 0.34, 0]} tone="text-ink-400">
        {`d = L sin θ = ${(leverArmM * 100).toFixed(0)} cm`}
      </Label>
    </>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function AntagonisticMusclesCanvas({ params = {}, setParam }) {
  const {
    elbowAngle = 90,
    load = 10,
    fatigue: fatigueTrigger = 0,
    speed = 1,
    liveAngle,
    liveMotion = "holding",
    liveFatigue = 0,
    showLabels = true,
  } = params || {};
  // Every label in the scene goes through this, so one toggle clears them all.
  const Label = showLabels ? SceneLabel : NoLabel;

  const target = clampAngle(elbowAngle);
  const loadKg = clampLoad(load);

  const poseRef = useRef(null);
  if (poseRef.current === null) poseRef.current = createPose(SHOULDER, 0, target);

  const bicepsState = useRef({ activation: 0, fatigue: 0, strain: 0 });
  const tricepsState = useRef({ activation: 0, fatigue: 0, strain: 0 });
  const handRef = useRef({ from: "relaxed", to: "grip", t: loadKg > 0.05 ? 1 : 0 });

  // What the overlay describes: the arm where it actually is, as last
  // reported, solved with the same model the Details panel uses.
  const shownAngle = typeof liveAngle === "number" ? liveAngle : target;
  const solved = useMemo(
    () => solveMuscles({ elbowAngle: target, loadKg, fatigue: liveFatigue, motion: liveMotion }),
    [target, loadKg, liveFatigue, liveMotion],
  );

  const geometry = useMemo(() => {
    const pose = createPose(SHOULDER, 0, shownAngle);
    const elbow = pose.forearm.origin.toArray();
    const hand = handWorld(pose, new THREE.Vector3()).toArray();
    const origin = new THREE.Vector3();
    const insertion = new THREE.Vector3();
    localToWorld(pose.humerus, MUSCLE_SPECS.biceps.origin.local, origin);
    localToWorld(pose.forearm, MUSCLE_SPECS.biceps.insertion.local, insertion);
    const pull = origin.clone().sub(insertion).normalize().toArray();
    return { elbow, hand, insertion: insertion.toArray(), pull, leverArmM: loadLeverArm(shownAngle) };
  }, [shownAngle]);

  const scale = useForceScale([solved.loadWeightN, solved.biceps.force], 2.1);

  const bicepsLabel = `biceps · ${solved.biceps.state === "contracted" ? "CONTRACTED · bulging" : "RELAXED · stretched"}`;
  const tricepsLabel = `triceps · ${solved.triceps.state === "contracted" ? "CONTRACTED · pulling" : "RELAXED · stretched"}`;
  const fatigued = liveFatigue > 0.05;

  return (
    <SceneCanvas
      camera={{ position: [2.4, 0.4, 12], fov: 44 }}
      controls={{ minDistance: 4, maxDistance: 26 }}
      lights={{ ambient: 0.7, keyLight: 1.2 }}
    >
      <FitCamera view={MUSCLE_VIEW} direction={[0.18, 0.06, 1]} fov={44} />
      <MuscleDriver
        target={target}
        loadKg={loadKg}
        fatigueTrigger={Number(fatigueTrigger) || 0}
        speed={speed}
        poseRef={poseRef}
        handRef={handRef}
        bicepsState={bicepsState}
        tricepsState={tricepsState}
        setParam={setParam}
      />


      {/* Its own Suspense: without one the whole canvas suspends and remounts
          while the model streams. */}
      <Suspense fallback={null}>
        <ModelledArm
          poseRef={poseRef}
          handRef={handRef}
          bicepsState={bicepsState}
          tricepsState={tricepsState}
          humerusChildren={
            <>
              <JointMarker position={MUSCLE_SPECS.biceps.origin.local} radius={0.08} colour={PALETTE.gold} />
              <JointMarker position={MUSCLE_SPECS.triceps.origin.local} radius={0.08} colour={PALETTE.gold} />
              <Label position={[-0.3, -2.2, 0.55]} tone="text-ink-400">
                humerus
              </Label>
              <Label position={[0.75, 0.3, 0.45]} tone="text-amber-300">
                origins
              </Label>
              <Label position={[0.95, -1.45, 0.25]} tone="text-rose-200">
                {bicepsLabel}
              </Label>
              <Label position={[-1.05, -1.3, 0.25]} tone="text-rose-200">
                {tricepsLabel}
              </Label>
            </>
          }
          forearmChildren={
            <>
              <JointMarker position={MUSCLE_SPECS.biceps.insertion.local} radius={0.08} colour={PALETTE.emerald} />
              <JointMarker position={MUSCLE_SPECS.triceps.insertion.local} radius={0.08} colour={PALETTE.emerald} />
              <Label position={[0.95, -0.55, -0.2]} tone="text-emerald-300">
                biceps insertion
              </Label>
              <Label position={[-0.95, 0.45, 0.2]} tone="text-emerald-300">
                triceps insertion
              </Label>
              <Label position={[-0.55, -1.75, 0.45]} tone="text-ink-400">
                ulna
              </Label>
              <Label position={[0.6, -2.05, -0.3]} tone="text-ink-400">
                radius
              </Label>
              <Dumbbell kg={loadKg} />
            </>
          }
        />
      </Suspense>

      <Label position={[-1.3, SHOULDER[1] + 0.9, -0.6]} tone="text-ink-400">
        scapula
      </Label>
      <Label position={[geometry.elbow[0] - 1.35, geometry.elbow[1] - 0.6, 0]} tone="text-sky-300">
        elbow · hinge joint (pivot)
      </Label>

      {/* The lever: angle, moment arm, the two forces, and the torque they make. */}
      <AngleArc elbow={geometry.elbow} angleDeg={shownAngle} Label={Label} />
      <LeverGuides elbow={geometry.elbow} hand={geometry.hand} leverArmM={geometry.leverArmM} Label={Label} />
      <TorqueArc elbow={geometry.elbow} forearmAngleDeg={shownAngle} torque={solved.torque} Label={Label} />
      <ForceVector at={geometry.hand} direction={[0, -1, 0]} newtons={solved.loadWeightN} scale={scale} colour={FORCE_COLOURS.weight} symbol="W" showLabel={showLabels} />
      {solved.biceps.active && (
        <ForceVector at={geometry.insertion} direction={geometry.pull} newtons={solved.biceps.force} scale={scale} colour={RIG_COLOURS.muscleContracted} symbol="F(biceps)" showLabel={showLabels} />
      )}

      {fatigued && (
        <Label position={[geometry.elbow[0] - 2.1, SHOULDER[1] - 2.2, 0.6]} tone="text-fuchsia-300">
          {`⚡ fatigue · lactic acid · strength ${Math.round(solved.strengthPct)}%${solved.sagging ? " · giving way" : ""}`}
        </Label>
      )}

    </SceneCanvas>
  );
}
