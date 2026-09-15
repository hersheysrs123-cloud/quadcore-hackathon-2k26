"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Billboard, Grid, Line, RoundedBox } from "@react-three/drei";
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
const HALF_BLOCK = (BLOCK * 1.35) / 2;

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
function BlockAndForces({ frame, along, solved, scale, showComponents, showNet, mass, surface }) {
  const lift = BLOCK / 2 + PLANK;
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
        {/* Main cargo crate body — bright golden honey wood, clean light rubber, or porcelain teflon */}
        <RoundedBox args={[BLOCK * 1.35, BLOCK, BLOCK * 0.95]} radius={0.05} smoothness={3} castShadow>
          <meshStandardMaterial
            color={surface === "teflon" ? "#ffffff" : surface === "rubber" ? "#64748b" : "#d4924b"}
            roughness={surface === "teflon" ? 0.2 : surface === "rubber" ? 0.75 : 0.55}
            metalness={surface === "teflon" ? 0.15 : 0.08}
          />
        </RoundedBox>

        {/* Structural reinforcement banding planks */}
        {[-1, 1].map((s) => (
          <mesh key={`band-${s}`} position={[(s * BLOCK * 1.35) / 3, 0, 0]}>
            <boxGeometry args={[0.05, BLOCK * 0.98, BLOCK * 0.96]} />
            <meshStandardMaterial color={surface === "wood" ? "#a06030" : "#475569"} roughness={0.5} metalness={0.1} />
          </mesh>
        ))}

        {/* Bright gleaming brass corner caps on the 8 corners */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sy) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`corner-${sx}-${sy}-${sz}`}
                position={[
                  (sx * (BLOCK * 1.35 - 0.05)) / 2,
                  (sy * (BLOCK - 0.05)) / 2,
                  (sz * (BLOCK * 0.95 - 0.05)) / 2,
                ]}
              >
                <boxGeometry args={[0.07, 0.07, 0.07]} />
                <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.85} />
              </mesh>
            ))
          )
        )}

        {/* Recessed metal lifting handles on both sides */}
        {[-1, 1].map((sz) => (
          <group key={`handle-${sz}`} position={[0, 0, (sz * (BLOCK * 0.95 + 0.01)) / 2]}>
            <mesh>
              <boxGeometry args={[0.18, 0.07, 0.015]} />
              <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0, sz * 0.015]}>
              <cylinderGeometry args={[0.012, 0.012, 0.14, 12]} rotation={[0, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.9} />
            </mesh>
          </group>
        ))}

        {/* Underside friction contact runners matching selected material */}
        {[-1, 1].map((sz) => (
          <mesh
            key={`runner-${sz}`}
            position={[0, -BLOCK / 2 - 0.01, (sz * BLOCK * 0.6) / 2]}
          >
            <boxGeometry args={[BLOCK * 1.3, 0.02, 0.12]} />
            <meshStandardMaterial
              color={surface === "teflon" ? "#f8fafc" : surface === "rubber" ? "#0f172a" : "#5d3b26"}
              roughness={surface === "teflon" ? 0.08 : surface === "rubber" ? 0.95 : 0.6}
              metalness={surface === "teflon" ? 0.3 : 0.05}
            />
          </mesh>
        ))}

        {/* Front tow eyebolt ring on uphill face for pull string */}
        <group position={[(BLOCK * 1.35) / 2 + 0.02, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <mesh>
            <torusGeometry args={[0.035, 0.01, 12, 24]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.25} metalness={0.85} />
          </mesh>
        </group>
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
          {/* The rectangle that closes W∥ + W⊥ back onto W (only when both components exist). */}
          {solved.weightParallel * scale > 0.08 && solved.weightPerpendicular * scale > 0.08 && (
            <ResolutionGuides at={centre} tip={weightTip} componentTips={[parallelTip, perpTip]} />
          )}
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
          maxLength={
            solved.appliedForce > 0
              ? Math.max(0.18, (RAMP_WORLD + 0.04) - (along + HALF_BLOCK))
              : Math.max(0.18, along - HALF_BLOCK)
          }
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
function BlockMotion({ options, running, speed = 1, resetKey, onSample, onTrace, maxTime = TRACE_SECONDS }) {
  const elapsed = useRef(0);
  const finished = useRef(false);

  const step = useCallback(
    (motion, dt) => {
      // If trace has reached the end of the graph time window or block hit barrier, stop
      if (elapsed.current >= maxTime || finished.current) {
        return motion;
      }
      const nextElapsed = Math.min(elapsed.current + dt, maxTime);
      const actualDt = nextElapsed - elapsed.current;
      elapsed.current = nextElapsed;
      const next = advanceBlock(motion, options, actualDt);
      if (next.hitBarrier) {
        onTrace(elapsed.current, next.arrivalVelocity ?? next.velocity, actualDt);
        finished.current = true;
      } else {
        onTrace(elapsed.current, next.velocity, actualDt);
      }
      return next;
    },
    [options, onTrace, maxTime],
  );

  const motion = useBodyMotion({ step, onSample, running, speed });

  // A reset puts the crate back in the middle of the ramp with the clock and
  // the trace both wiped, rather than leaving a stale curve on the graph.
  useEffect(() => {
    motion.current = { position: 0, velocity: 0 };
    elapsed.current = 0;
    finished.current = false;
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

  const centerX = position[0] + width / 2;
  const centerY = position[1];
  const centerZ = position[2] ?? 0;

  return (
    <Billboard position={[centerX, centerY, centerZ]} follow={true}>
      <group position={[-width / 2, 0, 0]}>
        {/* Background panel with 3D chassis */}
        <mesh position={[width / 2, 0, -0.016]}>
          <boxGeometry args={[width + 0.26, 0.44, 0.03]} />
          <meshBasicMaterial color="#222f46" transparent opacity={0.95} side={THREE.DoubleSide} />
        </mesh>
        {/* Outer border */}
        <Line
          points={[
            [-0.13, -0.22, 0.005],
            [width + 0.13, -0.22, 0.005],
            [width + 0.13, 0.22, 0.005],
            [-0.13, 0.22, 0.005],
            [-0.13, -0.22, 0.005],
          ]}
          color="#475569"
          lineWidth={1.6}
          transparent
          opacity={0.9}
        />
        {/* Subtle interior division tick marks: 25%, 50%, 75% */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <Line
            key={`tick-${frac}`}
            points={[
              [width * frac, -0.12, 0.006],
              [width * frac, 0.12, 0.006],
            ]}
            color="#64748b"
            lineWidth={1.4}
            transparent
            opacity={0.8}
          />
        ))}
        {filled > 0.001 && (
          <mesh position={[filled / 2, 0, 0.005]}>
            <planeGeometry args={[filled, 0.26]} />
            <meshBasicMaterial color={colour} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        )}
        {/* The ceiling: μs·N. Reaching it is the break-away. */}
        <Line
          points={[
            [width, -0.21, 0.008],
            [width, 0.21, 0.008],
          ]}
          color={PALETTE.bone}
          lineWidth={2.6}
        />
        <SceneLabel
          position={[width / 2, 0.46, 0.01]}
          tone={solved.isStatic ? (solved.onTheVerge ? "text-amber-400" : "text-emerald-400") : "text-rose-400"}
        >
          {solved.isStatic
            ? `${(solved.gripUsed * 100).toFixed(0)}% static grip used ${solved.onTheVerge ? "· ON THE VERGE!" : "(equilibrium)"}`
            : `sliding — kinetic friction fixed at μk·N = ${solved.slidingFriction.toFixed(1)} N`}
        </SceneLabel>
      </group>
    </Billboard>
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
    speed = 1,
    reset = 0,
  } = params || {};

  const [live, setLive] = useState({ position: 0, velocity: 0 });
  const trace = useRollingTrace(4000, 30, [[0, 0]]);

  const frame = useMemo(() => slopeFrame(rampAngle), [rampAngle]);

  const options = useMemo(
    () => ({ massKg: blockMass, angleDeg: rampAngle, surface, appliedForce }),
    [blockMass, rampAngle, surface, appliedForce],
  );

  // The solve the arrows are drawn from uses the CURRENT velocity, so friction
  // switches from static to kinetic in the diagram at the same instant the
  // block starts to move rather than a frame later.
  // Also account for barrier contact: when resting against the top or bottom stop,
  // the mechanical barrier supplies an equal reaction force, keeping the block at rest.
  const solved = useMemo(() => {
    const raw = solveIncline({ ...options, velocity: live.velocity });
    const limit = RAMP_LENGTH_M / 2;
    const atTop = live.position >= limit - 1e-4;
    const atBottom = live.position <= -limit + 1e-4;
    if (atTop && (live.velocity > 0 || raw.netForce > 0)) {
      return {
        ...raw,
        netForce: 0,
        acceleration: 0,
        isStatic: true,
        atBarrier: "top",
      };
    }
    if (atBottom && (live.velocity < 0 || raw.netForce < 0)) {
      return {
        ...raw,
        netForce: 0,
        acceleration: 0,
        isStatic: true,
        atBarrier: "bottom",
      };
    }
    return raw;
  }, [options, live.velocity, live.position]);

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
    trace.reset([[0, 0]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, rampAngle, surface, blockMass, appliedForce]);

  const b = RAMP_WORLD * Math.cos(frame.radians);
  const h = RAMP_WORLD * Math.sin(frame.radians);
  const wedge = useWedgeGeometry(b, h, RAMP_DEPTH);

  // Keep the crate on the plank rather than half off the end of it.
  const along = clamp(RAMP_WORLD / 2 + live.position * SCALE, HALF_BLOCK, RAMP_WORLD - HALF_BLOCK);

  const tracePoints = trace.points;
  const latest = tracePoints.length ? tracePoints[tracePoints.length - 1] : null;

  // Dynamic Y range that adapts to motion direction:
  // - Purely positive motion (uphill pull): yMin = 0, yMax = peak (zero axis at bottom, no middle line!)
  // - Purely negative motion (downhill slide): yMin = -peak, yMax = 0 (zero axis at top)
  // - Bipolar motion (reverses): symmetric -peak to +peak
  const { yMin, yMax } = useMemo(() => {
    let minV = 0;
    let maxV = 0;
    for (let i = 0; i < tracePoints.length; i += 1) {
      const v = tracePoints[i][1];
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const hasNeg = minV < -0.15;
    const hasPos = maxV > 0.15;

    if (!hasNeg && !hasPos) {
      return { yMin: 0, yMax: 4 };
    }
    if (!hasNeg) {
      const top = Math.max(2, Math.ceil(maxV * 1.15));
      return { yMin: 0, yMax: top };
    }
    if (!hasPos) {
      const bottom = Math.min(-2, Math.floor(minV * 1.15));
      return { yMin: bottom, yMax: 0 };
    }
    const peak = Math.max(2, Math.ceil(Math.max(Math.abs(minV), Math.abs(maxV)) * 1.15));
    return { yMin: -peak, yMax: peak };
  }, [tracePoints]);

  const latestTime = latest ? latest[0] : 0;
  const xMax = useMemo(() => {
    if (solved.atBarrier && latestTime > 0.1) {
      return Math.max(1.0, Math.ceil(latestTime * 1.25 * 2) / 2);
    }
    return Math.max(2.0, Math.min(TRACE_SECONDS, Math.ceil(Math.max(latestTime, 1) * 1.25)));
  }, [solved.atBarrier, latestTime]);

  const xLabel = solved.atBarrier && latestTime > 0.1
    ? `time · ${latestTime.toFixed(2)}s to stop`
    : `time · ${xMax}s window`;

  const markerLabel = latest
    ? solved.atBarrier
      ? `impact: ${latest[1] >= 0 ? "+" : ""}${latest[1].toFixed(2)} m/s`
      : `${latest[1] >= 0 ? "+" : ""}${latest[1].toFixed(2)} m/s`
    : undefined;

  const gaugeY = Math.max(2.15, HINGE[1] + h + 0.85);

  return (
    <SceneCanvas
      // Framed right of centre: the controls panel covers the left quarter of
      // the viewport, so a scene centred on the origin loses its left-hand
      // instruments behind it.
      camera={{ position: [1.85, 1.4, 13.4], fov: 46 }}
      controls={{ minDistance: 4, maxDistance: 26, target: [1.85, 0.2, 0] }}
      lights={{ ambient: 0.85, keyLight: 1.7 }}
    >
      <Grid
        position={[0, HINGE[1] - 0.001, 0]}
        args={[26, 16]}
        cellSize={SCALE / 2}
        cellColor="#334155"
        sectionSize={SCALE * 2}
        sectionColor="#475569"
        fadeDistance={40}
        infiniteGrid={false}
      />

      {/* ── Apparatus Sturdy Base Bed (anchored foundation, visible at all angles including 90°) ── */}
      <group position={[HINGE[0] + RAMP_WORLD / 2 - 0.05, HINGE[1] - 0.08, 0]}>
        {/* Main heavy aluminum/steel base plate — light satin brushed aluminum */}
        <mesh receiveShadow>
          <boxGeometry args={[RAMP_WORLD + 0.5, 0.14, RAMP_DEPTH + 0.14]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.65} />
        </mesh>
        {/* Green spirit level bubble vial embedded in the base */}
        <group position={[-RAMP_WORLD / 2 + 0.5, 0.075, (RAMP_DEPTH + 0.05) / 2]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 0.18, 16]} />
            <meshStandardMaterial color="#4ade80" roughness={0.1} metalness={0.2} transparent opacity={0.9} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.01, 12, 12]} />
            <meshStandardMaterial color="#bbf7d0" emissive="#4ade80" emissiveIntensity={1.5} />
          </mesh>
        </group>
      </group>

      {/* ── Hinge knuckle brackets at the pivot ── */}
      {[-1, 1].map((side) => (
        <group key={`hinge-${side}`} position={[HINGE[0], HINGE[1], (side * (RAMP_DEPTH + 0.14)) / 2]}>
          <mesh>
            <cylinderGeometry args={[0.13, 0.15, 0.06, 16]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.75} />
          </mesh>
        </group>
      ))}
      {/* Brass hinge pivot pin */}
      <mesh position={[HINGE[0], HINGE[1], 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, RAMP_DEPTH + 0.22, 16]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.9} />
      </mesh>

      {/* ── Rear Upright Support Mast at the end of the base (light satin extruded rail) ── */}
      <group position={[HINGE[0] + RAMP_WORLD, HINGE[1] + RAMP_WORLD / 2, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[0.08, RAMP_WORLD, RAMP_DEPTH * 0.4]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.8} />
        </mesh>
      </group>

      {/* ── Elevation Mast Sliding Clamp Collar ── */}
      <group position={[HINGE[0] + RAMP_WORLD, HINGE[1] + h, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 0.12, RAMP_DEPTH * 0.45]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>
        {/* Knurled brass tightening knob */}
        <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.05, 16]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.9} />
        </mesh>
      </group>

      {/* ── The ramp wedge support (rendered when angle allows a non-degenerate wedge) ── */}
      {b > 0.05 && (
        <group position={[HINGE[0], HINGE[1], -RAMP_DEPTH / 2]}>
          <mesh geometry={wedge} receiveShadow>
            <meshStandardMaterial
              color="#cbd5e1"
              roughness={0.35}
              metalness={0.35}
              polygonOffset
              polygonOffsetFactor={1}
              polygonOffsetUnits={1}
            />
          </mesh>
        </group>
      )}

      {/* Sliding surface, laid on the hypotenuse — elevated by PLANK/2 and slightly wider to eliminate z-fighting */}
      <group
        position={onSlope(HINGE, frame, RAMP_WORLD / 2, PLANK / 2)}
        rotation={[0, 0, frame.radians]}
      >
        <mesh receiveShadow>
          <boxGeometry args={[RAMP_WORLD, PLANK, RAMP_DEPTH + 0.08]} />
          <meshStandardMaterial
            color={surfaceFor(surface).muS > 0.7 ? "#64748b" : surfaceFor(surface).muS > 0.2 ? "#d4a373" : "#f1f5f9"}
            roughness={clamp(surfaceFor(surface).muS + 0.1, 0.08, 0.85)}
            metalness={surfaceFor(surface).muS < 0.2 ? 0.35 : 0.08}
          />
        </mesh>
        {/* Dual extruded aluminum guide channel rails along both edges */}
        {[-1, 1].map((sz) => (
          <mesh
            key={`rail-${sz}`}
            position={[0, PLANK / 2 + 0.03, (sz * (RAMP_DEPTH + 0.08)) / 2]}
          >
            <boxGeometry args={[RAMP_WORLD, 0.06, 0.025]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.85} />
          </mesh>
        ))}
        {/* Laser-etched metric centimeter ruler ticks on the front rail */}
        {Array.from({ length: 9 }).map((_, i) => {
          const xPos = -RAMP_WORLD / 2 + (i * RAMP_WORLD) / 8;
          const isMajor = i % 2 === 0;
          return (
            <group key={`tick-${i}`} position={[xPos, PLANK / 2 + 0.05, (RAMP_DEPTH + 0.11) / 2]}>
              <Line
                points={[
                  [0, -0.02, 0],
                  [0, isMajor ? 0.03 : 0.01, 0],
                ]}
                color="#0f172a"
                lineWidth={isMajor ? 2.2 : 1.4}
              />
              {isMajor && (
                <SceneLabel position={[0, -0.12, 0]} tone="text-ink-200">
                  {`${(i * 0.5).toFixed(1)}m`}
                </SceneLabel>
              )}
            </group>
          );
        })}
        {/* Bottom stopper bumper on the plank catching the crate */}
        <mesh position={[-RAMP_WORLD / 2 + 0.04, PLANK / 2 + 0.06, 0]}>
          <boxGeometry args={[0.08, 0.12, RAMP_DEPTH + 0.08]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.65} />
        </mesh>
      </group>

      {/* ── Top Pulley Wheel and Applied Pull Taut Tow String ── */}
      {Math.abs(appliedForce) > 0.05 && (
        <group position={onSlope(HINGE, frame, RAMP_WORLD + 0.06, PLANK + 0.08)} rotation={[0, 0, frame.radians]}>
          <mesh position={[0, -0.04, 0]}>
            <boxGeometry args={[0.06, 0.08, RAMP_DEPTH * 0.35]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.035, 24]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.15} metalness={0.95} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.05, 16]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.9} />
          </mesh>
        </group>
      )}

      {/* Taut nylon pull string from crate to top pulley */}
      {appliedForce > 0.05 && (RAMP_WORLD + 0.06 - (along + (BLOCK * 1.35) / 2 + 0.02)) > 0.03 && (
        <Line
          points={[
            onSlope(HINGE, frame, along + (BLOCK * 1.35) / 2 + 0.02, BLOCK / 2 + PLANK),
            onSlope(HINGE, frame, RAMP_WORLD + 0.06, PLANK + 0.08),
          ]}
          color="#f59e0b"
          lineWidth={2.8}
        />
      )}

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
        surface={surface}
      />

      <BlockMotion
        options={options}
        running={running}
        speed={speed}
        maxTime={TRACE_SECONDS}
        resetKey={`${reset}-${rampAngle}-${surface}-${blockMass}-${appliedForce}`}
        onSample={onSample}
        onTrace={onTrace}
      />

      {/* Static friction grip gauge positioned above the ramp */}
      <GripGauge position={[-2.6, gaugeY, 0]} solved={solved} />

      {/* ── Velocity trace (adaptive range, clear axis ticks, clean baseline) ── */}
      <GraphPanel
        position={[3.4, -1.25, 0]}
        width={3.4}
        height={3.4}
        xMin={0}
        xMax={xMax}
        yMin={yMin}
        yMax={yMax}
        title="velocity along the slope"
        xLabel={xLabel}
        yLabel="v (m/s)"
        xTicks={4}
        yTicks={4}
        bgColour="#1e2638"
        borderColour="#38455c"
        gridColour="#2e3b52"
        axisColour="#94a3b8"
        series={[{ points: tracePoints, colour: FORCE_COLOURS.velocity, lineWidth: 2.6 }]}
        marker={latest ? { at: latest, colour: FORCE_COLOURS.net, label: markerLabel } : undefined}
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
          ["Friction", solved.atBarrier ? `held by ${solved.atBarrier} stop` : `${solved.frictionMagnitude.toFixed(1)} N`, solved.isStatic ? "good" : "warn"],
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
