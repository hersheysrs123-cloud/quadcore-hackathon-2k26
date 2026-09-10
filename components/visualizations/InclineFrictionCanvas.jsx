"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Grid, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
} from "@/components/visualizations/scene-kit";
import {
  FORCE_COLOURS,
  ForceVector,
  GraphPanel,
  ResolutionGuides,
  arcPoints,
  onSlope,
  slopeFrame,
  useBodyMotion,
  useForceScale,
  useRollingTrace,
  useWedgeGeometry,
} from "@/components/visualizations/force-diagram";
import { RAMP_LENGTH_M, advanceBlock, solveIncline, surfaceFor } from "@/lib/inclineForces";

// ─── Incline plane · Newton's laws & friction ───────────────────────
// A cargo block on an adjustable ramp, with every force that acts on it drawn
// from its centre of mass to one shared scale.
//
// The whole scene is a picture of two ideas that students routinely fuse into
// one: that weight resolves into mg·sinθ down the slope and mg·cosθ into it,
// and that friction is not a fixed force but a reaction with a ceiling. All of
// the arithmetic lives in `lib/inclineForces.js`, so the arrows, the trace and
// the HUD's Details panel are three views of a single solve.
// ─────────────────────────────────────────────────────────────────────

/** World units per metre. */
const SCALE = 1.15;
const RAMP_WORLD = RAMP_LENGTH_M * SCALE;
/** Where the ramp is hinged. Everything else is measured from here. */
const HINGE = [-2.75, -1.7, 0];
const RAMP_DEPTH = 1.5;
const PLANK = 0.14;
const BLOCK = 0.52;

/** Longest velocity the trace plots before it clips, m/s. */
const TRACE_SPEED = 6;
const TRACE_SECONDS = 8;

// ─── The block ──────────────────────────────────────────────────────

/**
 * The cargo block, its centre of mass, and every force on it.
 *
 * Coincident arrows are nudged a few centimetres apart along the surface —
 * N and mg·cosθ are equal and opposite and would otherwise be drawn exactly
 * on top of one another, which hides the very fact that they balance.
 */
function BlockAndForces({ frame, along, solved, scale, showComponents, showNet, mass }) {
  const lift = BLOCK / 2 + PLANK / 2;
  const centre = onSlope(HINGE, frame, along, lift);
  const { up, out } = frame;

  /** A point offset from the centre of mass, to separate overlapping arrows. */
  const nudge = (alongBy, outBy) => [
    centre[0] + up[0] * alongBy + out[0] * outBy,
    centre[1] + up[1] * alongBy + out[1] * outBy,
    centre[2],
  ];

  const weightTip = [centre[0], centre[1] - solved.weight * scale, centre[2]];
  const parallelTip = [
    centre[0] - up[0] * solved.weightParallel * scale,
    centre[1] - up[1] * solved.weightParallel * scale,
    centre[2],
  ];
  const perpTip = [
    centre[0] - out[0] * solved.weightPerpendicular * scale,
    centre[1] - out[1] * solved.weightPerpendicular * scale,
    centre[2],
  ];

  return (
    <group>
      <group position={centre} rotation={[0, 0, frame.radians]}>
        <RoundedBox args={[BLOCK * 1.35, BLOCK, BLOCK * 0.95]} radius={0.05} smoothness={3} castShadow>
          <meshStandardMaterial color="#8a5a3b" roughness={0.72} metalness={0.06} />
        </RoundedBox>
        {/* Crate banding, so the block reads as cargo rather than a cube. */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * BLOCK * 1.35) / 3, 0, BLOCK * 0.48]}>
            <boxGeometry args={[0.05, BLOCK * 0.96, 0.012]} />
            <meshStandardMaterial color="#5d3b26" roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* Centre of mass — the point every arrow is drawn from. */}
      <mesh position={centre}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color={PALETTE.bone} emissive={PALETTE.bone} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>

      {/* Weight, straight down, whatever the ramp is doing. */}
      <ForceVector
        at={centre}
        direction={[0, -1, 0]}
        newtons={solved.weight}
        scale={scale}
        colour={FORCE_COLOURS.weight}
        symbol="W = mg"
      />

      {showComponents && (
        <>
          <ForceVector
            at={nudge(0, 0.1)}
            direction={up}
            newtons={-solved.weightParallel}
            scale={scale}
            colour={FORCE_COLOURS.weightParallel}
            symbol="W∥ = mg sinθ"
          />
          <ForceVector
            at={nudge(-0.16, 0)}
            direction={out}
            newtons={-solved.weightPerpendicular}
            scale={scale}
            colour={FORCE_COLOURS.weightPerpendicular}
            symbol="W⊥ = mg cosθ"
          />
          {/* The rectangle that closes W∥ + W⊥ back onto W. */}
          <ResolutionGuides at={centre} tip={weightTip} componentTips={[parallelTip, perpTip]} />
        </>
      )}

      {/* Normal contact force — the surface pushing back. */}
      <ForceVector
        at={nudge(0.16, 0)}
        direction={out}
        newtons={solved.normal}
        scale={scale}
        colour={FORCE_COLOURS.normal}
        symbol="N"
      />

      {/* Friction. Signed, so it flips on its own when the motion reverses. */}
      <ForceVector
        at={nudge(0, -0.09)}
        direction={up}
        newtons={solved.friction}
        scale={scale}
        colour={FORCE_COLOURS.friction}
        symbol={solved.isStatic ? "fs" : "fk"}
      />

      {Math.abs(solved.appliedForce) > 0.05 && (
        <ForceVector
          at={nudge(0, 0.22)}
          direction={up}
          newtons={solved.appliedForce}
          scale={scale}
          colour={FORCE_COLOURS.applied}
          symbol="F"
        />
      )}

      {showNet && Math.abs(solved.netForce) > 0.05 && (
        <ForceVector
          at={nudge(0, -0.3)}
          direction={up}
          newtons={solved.netForce}
          scale={scale}
          colour={FORCE_COLOURS.net}
          symbol="Fnet = ma"
        />
      )}

      <SceneLabel position={[centre[0], centre[1] + 0.52, centre[2]]} accent>
        {`${mass} kg`}
      </SceneLabel>
    </group>
  );
}

/**
 * Steps the block and reports where it got to.
 *
 * Lives inside the canvas because it drives `useFrame`; the parent only ever
 * sees throttled samples, which is what keeps a sixty-hertz simulation from
 * re-rendering a HUD sixty times a second.
 */
function BlockMotion({ options, running, resetKey, onSample, onTrace }) {
  const elapsed = useRef(0);

  const step = useCallback(
    (motion, dt) => {
      elapsed.current += dt;
      const next = advanceBlock(motion, options, dt);
      onTrace(elapsed.current, next.velocity, dt);
      return next;
    },
    [options, onTrace],
  );

  const motion = useBodyMotion({ step, onSample, running });

  // A reset puts the crate back in the middle of the ramp with the clock and
  // the trace both wiped, rather than leaving a stale curve on the graph.
  useEffect(() => {
    motion.current = { position: 0, velocity: 0 };
    elapsed.current = 0;
    onSample(motion.current, 0);
  }, [resetKey, motion, onSample]);

  return null;
}

// ─── Static-friction gauge ──────────────────────────────────────────

/**
 * How much of the available grip is being used, as a bar.
 *
 * This is the inequality f_s ≤ μ_s·N drawn rather than asserted: the bar fills
 * as the slope steepens and the block does not budge until it is full, which is
 * hard to argue with and hard to get from a number alone.
 */
function GripGauge({ position, solved }) {
  const width = 3.2;
  const filled = width * clamp(solved.gripUsed, 0, 1);
  const colour = solved.isStatic
    ? solved.onTheVerge
      ? PALETTE.gold
      : FORCE_COLOURS.friction
    : PALETTE.rose;

  return (
    <group position={position}>
      <mesh position={[width / 2, 0, -0.02]}>
        <planeGeometry args={[width + 0.16, 0.34]} />
        <meshBasicMaterial color="#0d121c" transparent opacity={0.9} />
      </mesh>
      {filled > 0.001 && (
        <mesh position={[filled / 2, 0, 0]}>
          <planeGeometry args={[filled, 0.22]} />
          <meshBasicMaterial color={colour} toneMapped={false} />
        </mesh>
      )}
      {/* The ceiling: μs·N. Reaching it is the break-away. */}
      <Line
        points={[
          [width, -0.19, 0.01],
          [width, 0.19, 0.01],
        ]}
        color={PALETTE.bone}
        lineWidth={2.2}
      />
      <SceneLabel position={[width / 2, 0.42, 0]} tone="text-ink-300">
        {solved.isStatic
          ? `static friction using ${(solved.gripUsed * 100).toFixed(0)}% of μs·N`
          : `sliding — kinetic friction is fixed at μk·N = ${solved.slidingFriction.toFixed(1)} N`}
      </SceneLabel>
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function InclineFrictionCanvas({ params = {} }) {
  const {
    rampAngle = 20,
    surface = "wood",
    blockMass = 10,
    appliedForce = 0,
    showComponents = true,
    showNet = true,
    running = true,
    reset = 0,
  } = params || {};

  const [live, setLive] = useState({ position: 0, velocity: 0 });
  const trace = useRollingTrace(260, 24);

  const frame = useMemo(() => slopeFrame(rampAngle), [rampAngle]);

  const options = useMemo(
    () => ({ massKg: blockMass, angleDeg: rampAngle, surface, appliedForce }),
    [blockMass, rampAngle, surface, appliedForce],
  );

  // The solve the arrows are drawn from uses the CURRENT velocity, so friction
  // switches from static to kinetic in the diagram at the same instant the
  // block starts to move rather than a frame later.
  const solved = useMemo(
    () => solveIncline({ ...options, velocity: live.velocity }),
    [options, live.velocity],
  );

  const scale = useForceScale(
    [solved.weight, solved.normal, Math.abs(solved.appliedForce), solved.grip],
    1.7,
  );

  const onTrace = useCallback(
    (t, v, dt) => trace.push(t, v, dt),
    [trace],
  );
  const onSample = useCallback((motion) => setLive({ ...motion }), []);

  // Wiping the trace has to happen outside the frame loop, and the reset
  // counter is the only thing that should do it.
  useEffect(() => {
    trace.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, rampAngle, surface, blockMass, appliedForce]);

  const b = RAMP_WORLD * Math.cos(frame.radians);
  const h = RAMP_WORLD * Math.sin(frame.radians);
  const wedge = useWedgeGeometry(b, h, RAMP_DEPTH);

  // Keep the crate on the plank rather than half off the end of it.
  const halfBlock = (BLOCK * 1.35) / 2;
  const along = clamp(RAMP_WORLD / 2 + live.position * SCALE, halfBlock, RAMP_WORLD - halfBlock);

  const tracePoints = trace.points;
  const latest = tracePoints.length ? tracePoints[tracePoints.length - 1] : null;
  const tEnd = latest ? Math.max(latest[0], TRACE_SECONDS) : TRACE_SECONDS;
  const tStart = tEnd - TRACE_SECONDS;

  return (
    <SceneCanvas
      // Framed right of centre: the controls panel covers the left quarter of
      // the viewport, so a scene centred on the origin loses its left-hand
      // instruments behind it.
      camera={{ position: [1.1, 1.4, 12.2], fov: 46 }}
      controls={{ minDistance: 4, maxDistance: 26, target: [1.1, 0.1, 0] }}
      lights={{ ambient: 0.5, keyLight: 0.9 }}
    >
      <Grid
        position={[0, HINGE[1] - 0.001, 0]}
        args={[26, 16]}
        cellSize={SCALE / 2}
        cellColor="#1e2531"
        sectionSize={SCALE * 2}
        sectionColor="#2b3442"
        fadeDistance={38}
        infiniteGrid={false}
      />

      {/* ── The ramp ── */}
      <group position={[HINGE[0], HINGE[1], -RAMP_DEPTH / 2]}>
        <mesh geometry={wedge} receiveShadow>
          <meshStandardMaterial color="#2a3140" roughness={0.85} metalness={0.06} />
        </mesh>
      </group>

      {/* Sliding surface, laid on the hypotenuse. */}
      <group
        position={onSlope(HINGE, frame, RAMP_WORLD / 2, 0)}
        rotation={[0, 0, frame.radians]}
      >
        <mesh receiveShadow>
          <boxGeometry args={[RAMP_WORLD, PLANK, RAMP_DEPTH]} />
          <meshStandardMaterial
            color={surfaceFor(surface).muS > 0.7 ? "#4a4038" : surfaceFor(surface).muS > 0.2 ? "#6b5033" : "#dfe6ee"}
            roughness={clamp(surfaceFor(surface).muS + 0.1, 0.08, 0.95)}
            metalness={surfaceFor(surface).muS < 0.2 ? 0.45 : 0.05}
          />
        </mesh>
      </group>

      {/* ── The angle itself ── */}
      <Line
        points={[
          HINGE,
          [HINGE[0] + RAMP_WORLD * 1.02, HINGE[1], HINGE[2]],
        ]}
        color={PALETTE.slate}
        lineWidth={1.4}
        transparent
        opacity={0.6}
        dashed
        dashSize={0.14}
        gapSize={0.1}
      />
      <Line points={arcPoints(HINGE, 1.1, 0, frame.radians)} color={PALETTE.gold} lineWidth={2.2} />
      <SceneLabel
        position={[
          HINGE[0] + Math.cos(frame.radians / 2) * 1.42,
          HINGE[1] + Math.sin(frame.radians / 2) * 1.42,
          0,
        ]}
        accent
      >
        {`θ = ${rampAngle}°`}
      </SceneLabel>

      {/* Where this surface lets go on its own, marked on the arc. */}
      {solved.reposeAngle <= 90 && (
        <Line
          points={[
            HINGE,
            [
              HINGE[0] + Math.cos((solved.reposeAngle * Math.PI) / 180) * 1.75,
              HINGE[1] + Math.sin((solved.reposeAngle * Math.PI) / 180) * 1.75,
              0,
            ],
          ]}
          color={PALETTE.rose}
          lineWidth={1.6}
          transparent
          opacity={0.75}
          dashed
          dashSize={0.1}
          gapSize={0.08}
        />
      )}

      <BlockAndForces
        frame={frame}
        along={along}
        solved={solved}
        scale={scale}
        showComponents={showComponents}
        showNet={showNet}
        mass={blockMass}
      />

      <BlockMotion
        options={options}
        running={running}
        resetKey={`${reset}-${rampAngle}-${surface}-${blockMass}-${appliedForce}`}
        onSample={onSample}
        onTrace={onTrace}
      />

      <GripGauge position={[-2.9, -3.25, 0]} solved={solved} />

      {/* ── Velocity trace ── */}
      <GraphPanel
        position={[3.05, -1.35, 0]}
        width={3.7}
        height={2.4}
        xMin={tStart}
        xMax={tEnd}
        yMin={-TRACE_SPEED}
        yMax={TRACE_SPEED}
        title="velocity along the slope"
        xLabel={`time · ${TRACE_SECONDS} s window`}
        yLabel="v"
        xTicks={4}
        yTicks={4}
        guides={[
          {
            points: [
              [tStart, 0],
              [tEnd, 0],
            ],
            colour: PALETTE.slate,
            lineWidth: 1.6,
            opacity: 0.7,
          },
        ]}
        series={[{ points: tracePoints, colour: FORCE_COLOURS.velocity, lineWidth: 2.4 }]}
        marker={latest ? { at: latest, colour: FORCE_COLOURS.net } : undefined}
      />

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Block on a slope"
        subtitle="ΣF = ma along the surface"
        rows={[
          ["Weight W", `${solved.weight.toFixed(1)} N`],
          ["W∥ = mg sinθ", `${solved.weightParallel.toFixed(1)} N`, "gold"],
          ["W⊥ = mg cosθ", `${solved.weightPerpendicular.toFixed(1)} N`],
          ["Normal N", `${solved.normal.toFixed(1)} N`],
          ["Friction", `${solved.frictionMagnitude.toFixed(1)} N`, solved.isStatic ? "good" : "warn"],
          ["Acceleration", `${solved.acceleration.toFixed(2)} m/s²`, solved.isStatic ? "good" : "bad"],
        ]}
      />

      <SceneLegend
        title="Free-body diagram"
        items={[
          { color: FORCE_COLOURS.weight, shape: "line", label: "Weight W", note: "always vertically down" },
          { color: FORCE_COLOURS.weightParallel, shape: "line", label: "W∥", note: "mg sinθ, down the slope" },
          { color: FORCE_COLOURS.weightPerpendicular, shape: "line", label: "W⊥", note: "mg cosθ, into the surface" },
          { color: FORCE_COLOURS.normal, shape: "line", label: "Normal N", note: "balances W⊥ exactly" },
          { color: FORCE_COLOURS.friction, shape: "line", label: "Friction", note: "opposes motion, never causes it" },
          { color: FORCE_COLOURS.applied, shape: "line", label: "Applied F", note: "your pull, along the ramp" },
          { color: FORCE_COLOURS.net, shape: "line", label: "Resultant", note: "what is left over — this is ma" },
        ]}
      />
    </SceneCanvas>
  );
}
