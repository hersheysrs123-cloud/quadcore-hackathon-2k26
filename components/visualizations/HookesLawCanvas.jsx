"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
} from "@/components/visualizations/scene-kit";
import { FORCE_COLOURS, ForceVector, GraphPanel, useForceScale } from "@/components/visualizations/force-diagram";
import {
  ELASTIC_LIMIT_EXTENSION,
  FAILURE_EXTENSION,
  NATURAL_LENGTH,
  elasticLimitForce,
  failureForce,
  loadCurve,
  loadForce,
  solveSpring,
} from "@/lib/hookesLaw";

// ─── Hooke's law · the elastic limit ────────────────────────────────
// A helical spring on a retort stand, a millimetre ruler beside it, slotted
// masses on a hanger, and the force–extension graph filling in as they go on.
//
// The scene exists for the boundary rather than the line: F = kx holds only
// below the elastic limit, and the way to show that is to let a student walk a
// spring over the edge and then take the masses back off to find it no longer
// returns. Everything is solved in `lib/hookesLaw.js`, including the coil's
// permanent set, so the deformed geometry and the plotted graph are the same
// model seen twice.
// ─────────────────────────────────────────────────────────────────────

/** World units per metre of apparatus. */
const S = 11;
/** Where the spring is clamped. */
const TOP_Y = 2.45;
const RULER_X = -1.35;
const COIL_TURNS = 18;
const COIL_RADIUS = 0.3;
const WIRE_RADIUS = 0.045;

const cmOf = (metres) => metres * 100;

// ─── The spring ─────────────────────────────────────────────────────

/**
 * The coil, built as a tube swept along a helix.
 *
 * Two things change with load, and both are what an overstretched spring
 * actually looks like: the pitch stops being even, because the coils nearest
 * the load are the ones pulled permanently open, and the helix necks in
 * slightly as it extends. A spring drawn with even pitch at every load looks
 * like a cartoon accordion, and hides the plastic deformation entirely.
 */
function Spring({ lengthM, setM, failed }) {
  const geometry = useMemo(() => {
    const length = lengthM * S;
    const extension = Math.max(lengthM - NATURAL_LENGTH, 0);
    const stretch = clamp(extension / FAILURE_EXTENSION, 0, 1);
    const radius = COIL_RADIUS * (1 - 0.22 * stretch);
    // Bias > 1 crowds the coils at the clamped end and opens them out toward
    // the load — the signature of a spring that has been taken past its limit.
    const bias = 1 + clamp(setM / ELASTIC_LIMIT_EXTENSION, 0, 1.6) * 0.75;

    const points = [];
    const steps = COIL_TURNS * 12;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const drop = Math.pow(t, bias);
      const a = t * COIL_TURNS * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * radius, -drop * length, Math.sin(a) * radius));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, steps, WIRE_RADIUS, 7, false);
  }, [lengthM, setM]);

  // Rebuilt on every step of the mass slider, so the previous sweep has to be
  // released with it.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        color={failed ? "#8a6a52" : setM > 0 ? "#b9a888" : "#cbd5e1"}
        roughness={failed ? 0.75 : 0.28}
        metalness={failed ? 0.35 : 0.85}
      />
    </mesh>
  );
}

/** Retort stand: cast base, upright rod, boss head and clamp arm. */
function RetortStand() {
  return (
    <group>
      <mesh position={[0.5, -2.62, 0]} receiveShadow>
        <boxGeometry args={[3.1, 0.24, 1.7]} />
        <meshStandardMaterial color="#8c9cb3" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[1.55, 0.1, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 5.2, 18]} />
        <meshStandardMaterial color="#5b6472" roughness={0.35} metalness={0.75} />
      </mesh>
      {/* Boss head and the arm the spring hangs from. */}
      <mesh position={[1.55, TOP_Y + 0.22, 0]}>
        <boxGeometry args={[0.34, 0.4, 0.34]} />
        <meshStandardMaterial color="#2f3745" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0.78, TOP_Y + 0.22, 0]}>
        <boxGeometry args={[1.6, 0.14, 0.16]} />
        <meshStandardMaterial color="#5b6472" roughness={0.35} metalness={0.75} />
      </mesh>
      {/* The hook itself. */}
      <mesh position={[0, TOP_Y + 0.1, 0]}>
        <torusGeometry args={[0.1, 0.028, 8, 20, Math.PI * 1.4]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * The millimetre ruler.
 *
 * Its zero is at the bottom of the UNSTRETCHED spring, not at the clamp, so
 * the number beside the pointer is the extension itself rather than a length
 * a student has to subtract L₀ from — which is how the scale is set up in the
 * lab, and removes the most common source of a wrong graph.
 *
 * Built as a physical double-sided laboratory meter rule with 3D depth so that
 * rotating the camera 180 degrees reveals the identical graduated scale, margin
 * lines, protective end caps, and mounting fixtures on the back.
 */
function Ruler({ zeroY }) {
  const ticks = useMemo(() => {
    const positions = [];
    const zFront = 0.022;
    const zBack = -0.022;

    // Every 2 mm, with every centimetre drawn longer on both front and back.
    for (let mm = 0; mm <= 460; mm += 2) {
      const y = zeroY - (mm / 1000) * S;
      const major = mm % 10 === 0;
      const long = mm % 50 === 0;
      const len = long ? 0.34 : major ? 0.22 : 0.11;

      // Front graduations
      positions.push(RULER_X, y, zFront, RULER_X + len, y, zFront);
      // Back graduations (exact mirror on the back face)
      positions.push(RULER_X, y, zBack, RULER_X + len, y, zBack);

      // Edge wrap ticks connecting front and back across the inner edge
      if (major) {
        positions.push(RULER_X, y, zBack, RULER_X, y, zFront);
      }
    }

    // Vertical baseline spine along inner edge on both front and back
    positions.push(RULER_X, zeroY + 0.01 * S, zFront, RULER_X, zeroY - 0.465 * S, zFront);
    positions.push(RULER_X, zeroY + 0.01 * S, zBack, RULER_X, zeroY - 0.465 * S, zBack);

    // Outer framing rule line on both front and back
    positions.push(RULER_X + 0.44, zeroY + 0.01 * S, zFront, RULER_X + 0.44, zeroY - 0.465 * S, zFront);
    positions.push(RULER_X + 0.44, zeroY + 0.01 * S, zBack, RULER_X + 0.44, zeroY - 0.465 * S, zBack);

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [zeroY]);

  useEffect(() => () => ticks.dispose(), [ticks]);

  const labels = useMemo(() => {
    const out = [];
    for (let cm = 0; cm <= 45; cm += 5) out.push(cm);
    return out;
  }, []);

  return (
    <group>
      {/* 3D solid meter rule body with double-sided visibility and realistic depth */}
      <mesh position={[RULER_X + 0.14, zeroY - 0.23 * S, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.66, 0.48 * S, 0.04]} />
        <meshStandardMaterial color="#f3efe6" roughness={0.65} metalness={0.12} />
      </mesh>

      {/* Top and bottom brass protective end caps */}
      <mesh position={[RULER_X + 0.14, zeroY + 0.012 * S, 0]}>
        <boxGeometry args={[0.68, 0.1, 0.046]} />
        <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[RULER_X + 0.14, zeroY - 0.472 * S, 0]}>
        <boxGeometry args={[0.68, 0.1, 0.046]} />
        <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Retort stand mounting bracket */}
      <mesh position={[RULER_X + 0.38, zeroY - 0.15 * S, 0]}>
        <boxGeometry args={[0.18, 0.22, 0.06]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[RULER_X + 0.95, zeroY - 0.15 * S, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 1.0, 12]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#5b6472" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* Razor-sharp vector graduations on both front and back faces */}
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color="#1e293b" />
      </lineSegments>

      {labels.map((cm) => (
        <SceneLabel key={cm} position={[RULER_X - 0.75, zeroY - (cm / 100) * S, 0]} tone="text-ink-400">
          {`${cm}`}
        </SceneLabel>
      ))}
      <SceneLabel position={[RULER_X - 0.72, zeroY + 0.42, 0]} tone="text-ink-300">
        extension / cm
      </SceneLabel>
    </group>
  );
}

/**
 * The hanger and its slotted masses.
 *
 * One disc per 250 g, because fifty separate 50 g slots is a stack nobody can
 * count — the label carries the exact figure the slider set.
 */
function WeightHanger({ topY, massKg }) {
  const discs = clamp(Math.round(massKg / 0.25), 0, 10);
  return (
    <group position={[0, topY, 0]}>
      {/* Hook and stem. */}
      <mesh position={[0, -0.1, 0]}>
        <torusGeometry args={[0.1, 0.026, 8, 20, Math.PI * 1.4]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.85} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 12]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Slotted discs, stacked on the hanger plate. */}
      <mesh position={[0, -0.87, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.06, 24]} />
        <meshStandardMaterial color="#8d99a8" roughness={0.4} metalness={0.7} />
      </mesh>
      {Array.from({ length: discs }, (_, i) => (
        <mesh key={i} position={[0, -0.93 - i * 0.115, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.1, 24]} />
          <meshStandardMaterial color={i % 2 ? "#5b6472" : "#6c7684"} roughness={0.45} metalness={0.6} />
        </mesh>
      ))}
      <SceneLabel position={[0.85, -0.95, 0]} accent>
        {massKg < 1 ? `${(massKg * 1000).toFixed(0)} g` : `${massKg.toFixed(2)} kg`}
      </SceneLabel>
    </group>
  );
}

function OscillatingSpringRig({ solved, hangingMass, springConstant, speed = 1, scale }) {
  const springGroupRef = useRef();
  const hangerGroupRef = useRef();
  const pointerGroupRef = useRef();

  const yOffset = useRef(0);
  const yVel = useRef(0);
  const prevMass = useRef(hangingMass);
  const clock = useRef(0);

  useEffect(() => {
    if (prevMass.current !== hangingMass) {
      const deltaM = hangingMass - prevMass.current;
      prevMass.current = hangingMass;
      // Convert mass delta to equilibrium displacement delta: deltaY = -(deltaM * g) / k
      const rawKick = -(deltaM * 9.80665) / Math.max(springConstant, 1);
      // Soft-clamp impulse kick so rapid slider dragging never injects explosive energy
      const kick = clamp(rawKick, -0.06, 0.06);
      yOffset.current = clamp(yOffset.current + kick, -0.08, 0.08);
      yVel.current = clamp(yVel.current * 0.4, -1.0, 1.0);
    }
  }, [hangingMass, springConstant]);

  // Reset oscillation state when spring properties change
  useEffect(() => {
    yOffset.current = 0;
    yVel.current = 0;
    clock.current = 0;
    prevMass.current = hangingMass;
  }, [springConstant, solved.permanentSet]);

  useFrame((_, rawDelta) => {
    if (speed <= 0) return;
    const dt = Math.min(rawDelta, 0.04) * Math.min(Math.max(speed, 0), 3.0);
    clock.current += dt;

    // Base natural frequency: omega = sqrt(k / m)
    const rawOmega = Math.sqrt(Math.max(springConstant / Math.max(hangingMass, 0.05), 4));
    // Perceptually capped visual frequency to strictly prevent 60Hz display strobing / Nyquist aliasing
    const omega = Math.min(rawOmega, 16.0);
    // Physically scaled viscous damping (zeta = 0.18): settles gracefully in ~1.5s
    const damping = 2 * 0.18 * omega;

    // Sub-stepping guarantees unconditional numerical stability: omega * subDt <= 0.12 << 2.0
    const maxSubDt = 0.12 / Math.max(omega, 1);
    const subSteps = Math.min(Math.max(1, Math.ceil(dt / maxSubDt)), 16);
    const subDt = dt / subSteps;

    for (let i = 0; i < subSteps; i += 1) {
      const accel = -omega * omega * yOffset.current - damping * yVel.current;
      yVel.current += accel * subDt;
      yOffset.current += yVel.current * subDt;
    }

    // Physical coil compression boundary: 18 coils of 0.045m wire cannot compress below ~0.085m
    const minLength = Math.max(0.085, NATURAL_LENGTH * 0.72);
    const maxCompress = Math.max(0, solved.length - minLength);
    const maxExtend = FAILURE_EXTENSION * 0.85;

    yOffset.current = clamp(yOffset.current, -maxCompress, maxExtend);
    yVel.current = clamp(yVel.current, -2.5, 2.5);

    // Zero out micro-drift once velocity and offset are sub-millimeter
    if (Math.abs(yOffset.current) < 1e-4 && Math.abs(yVel.current) < 1e-4) {
      yOffset.current = 0;
      yVel.current = 0;
    }

    // Small persistent ambient flutter only when nearly settled
    const ambient = (speed > 0 && Math.abs(yOffset.current) < 0.002)
      ? Math.sin(clock.current * Math.min(omega, 6.0)) * 0.0006
      : 0;

    const curLength = Math.max(minLength, solved.length + yOffset.current + ambient);
    // Strict stretch ratio lower bound: guarantees mesh normals never invert and texture never turns black
    const stretchRatio = clamp(curLength / Math.max(solved.length, 0.001), 0.65, 2.5);
    const curY = TOP_Y - curLength * S;

    if (springGroupRef.current) {
      springGroupRef.current.scale.y = stretchRatio;
    }
    if (hangerGroupRef.current) {
      hangerGroupRef.current.position.y = curY;
    }
    if (pointerGroupRef.current) {
      pointerGroupRef.current.position.y = curY;
    }
  });

  const pointerY = TOP_Y - solved.length * S;

  return (
    <>
      <group ref={springGroupRef} position={[0, TOP_Y, 0]}>
        <Spring lengthM={solved.length} setM={solved.permanentSet} failed={solved.failed} />
      </group>

      <group ref={hangerGroupRef} position={[0, pointerY, 0]}>
        <WeightHanger topY={0} massKg={hangingMass} />
      </group>

      <group ref={pointerGroupRef} position={[0, pointerY, 0]}>
        {/* Front pointer arm */}
        <Line
          points={[
            [RULER_X, 0, 0.05],
            [0.42, 0, 0.05],
          ]}
          color={PALETTE.gold}
          lineWidth={2}
          transparent
          opacity={0.9}
        />
        {/* Back pointer arm */}
        <Line
          points={[
            [RULER_X, 0, -0.05],
            [0.42, 0, -0.05],
          ]}
          color={PALETTE.gold}
          lineWidth={2}
          transparent
          opacity={0.9}
        />
        {/* Transverse needle at the scale edge connecting front and back */}
        <Line
          points={[
            [RULER_X, 0, -0.05],
            [RULER_X, 0, 0.05],
          ]}
          color={PALETTE.gold}
          lineWidth={2.5}
          transparent
          opacity={0.95}
        />
        <SceneLabel position={[0.95, 0.3, 0]} accent>
          {`x = ${cmOf(solved.extension).toFixed(1)} cm`}
        </SceneLabel>
        <ForceVector
          at={[0, -1.35, 0]}
          direction={[0, -1, 0]}
          newtons={solved.force}
          scale={scale}
          colour={FORCE_COLOURS.weight}
          symbol="F = mg"
        />
      </group>
    </>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function HookesLawCanvas({ params = {} }) {
  const {
    hangingMass = 0.5,
    springConstant = 80,
    overload = 0,
    newSpring = 0,
    showGraph = true,
    speed = 1,
  } = params || {};

  /**
   * The spring's memory: the heaviest load it has ever carried.
   *
   * This is the only history the model needs, and keeping it here rather than
   * in the HUD is deliberate — it is a property of the spring, not a setting,
   * so it must survive the mass slider moving back down and only reset when a
   * genuinely new spring is fitted.
   */
  const [peakForce, setPeakForce] = useState(0);

  const force = loadForce(hangingMass);

  useEffect(() => {
    setPeakForce((p) => Math.max(p, force));
  }, [force]);

  // A different spring constant IS a different spring, so its history goes
  // with it — as does explicitly fitting a fresh one.
  useEffect(() => {
    setPeakForce(0);
  }, [springConstant, newSpring]);

  // The overload button takes the coil well past yield in one go, which is the
  // demonstration a student should not have to hunt for on the mass slider.
  useEffect(() => {
    if (overload > 0) setPeakForce(elasticLimitForce(springConstant) * 1.4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overload]);

  const solved = useMemo(
    () => solveSpring({ massKg: hangingMass, k: springConstant, peakForce }),
    [hangingMass, springConstant, peakForce],
  );

  const curve = useMemo(
    () => loadCurve(springConstant, solved.peakForce),
    [springConstant, solved.peakForce],
  );

  const scale = useForceScale([solved.force, solved.limitForce], 1.4);

  const zeroY = TOP_Y - NATURAL_LENGTH * S;
  const pointerY = TOP_Y - solved.length * S;
  const restY = TOP_Y - solved.restLength * S;

  // The graph's axes are sized to the spring under test, so swapping a 10 N/m
  // spring for a 150 N/m one rescales rather than flattening the trace.
  const yMax = Math.max(failureForce(springConstant), force) * 1.08;
  const xMax = FAILURE_EXTENSION * 1.05;

  /** The measured gradient, drawn through the working point. */
  const tangent = useMemo(() => {
    const half = 0.045;
    const x0 = Math.max(solved.extension - half, 0);
    const x1 = Math.min(solved.extension + half, xMax);
    return [
      [x0, solved.force - (solved.extension - x0) * solved.stiffness],
      [x1, solved.force + (x1 - solved.extension) * solved.stiffness],
    ];
  }, [solved, xMax]);

  return (
    <SceneCanvas
      camera={{ position: [1.2, 0.3, 12.5], fov: 44 }}
      controls={{ minDistance: 5, maxDistance: 26, target: [0.9, -0.2, 0] }}
      lights={{ ambient: 0.58, keyLight: 1.0 }}
    >
      <RetortStand />
      <Ruler zeroY={zeroY} />

      {/* L₀ datum, and — once the spring has yielded — where it now rests (front & back). */}
      <Line
        points={[
          [RULER_X, zeroY, 0.05],
          [1.15, zeroY, 0.05],
        ]}
        color={PALETTE.slate}
        lineWidth={1.4}
        transparent
        opacity={0.7}
        dashed
        dashSize={0.1}
        gapSize={0.08}
      />
      <Line
        points={[
          [RULER_X, zeroY, -0.05],
          [1.15, zeroY, -0.05],
        ]}
        color={PALETTE.slate}
        lineWidth={1.4}
        transparent
        opacity={0.7}
        dashed
        dashSize={0.1}
        gapSize={0.08}
      />
      <SceneLabel position={[1.65, zeroY, 0]} tone="text-ink-400">
        L₀ · unloaded
      </SceneLabel>

      {solved.yielded && (
        <>
          <Line
            points={[
              [RULER_X, restY, 0.05],
              [1.15, restY, 0.05],
            ]}
            color={FORCE_COLOURS.limit}
            lineWidth={1.6}
            transparent
            opacity={0.85}
            dashed
            dashSize={0.1}
            gapSize={0.08}
          />
          <Line
            points={[
              [RULER_X, restY, -0.05],
              [1.15, restY, -0.05],
            ]}
            color={FORCE_COLOURS.limit}
            lineWidth={1.6}
            transparent
            opacity={0.85}
            dashed
            dashSize={0.1}
            gapSize={0.08}
          />
          <SceneLabel position={[1.9, restY, 0]} tone="text-rose-300">
            {`new rest length · set ${cmOf(solved.permanentSet).toFixed(1)} cm`}
          </SceneLabel>
        </>
      )}

      <OscillatingSpringRig
        solved={solved}
        hangingMass={hangingMass}
        springConstant={springConstant}
        speed={speed}
        scale={scale}
      />

      {showGraph && (
        <GraphPanel
          position={[3.2, -2.15, 0]}
          width={4.1}
          height={4.3}
          xMax={xMax}
          yMax={yMax}
          title="force against extension"
          xLabel={`extension · 0 – ${cmOf(xMax).toFixed(0)} cm`}
          yLabel="F / N"
          xTicks={5}
          yTicks={4}
          xFormat={(v) => `${(v * 100).toFixed(0)}cm`}
          guides={[
            // Where Hooke's law stops describing this spring.
            {
              points: [
                [ELASTIC_LIMIT_EXTENSION, 0],
                [ELASTIC_LIMIT_EXTENSION, yMax],
              ],
              colour: FORCE_COLOURS.limit,
              lineWidth: 1.5,
              opacity: 0.75,
            },
            // The gradient being reported, drawn where it is measured.
            { points: tangent, colour: FORCE_COLOURS.net, lineWidth: 2, opacity: 0.95 },
          ]}
          series={[
            { points: curve.elastic, colour: FORCE_COLOURS.spring, lineWidth: 2.8 },
            ...(curve.plastic.length
              ? [{ points: curve.plastic, colour: FORCE_COLOURS.applied, lineWidth: 2.8 }]
              : []),
            ...(curve.unload.length
              ? [{ points: curve.unload, colour: FORCE_COLOURS.limit, lineWidth: 2.2, dashed: true }]
              : []),
          ]}
          marker={{ at: [solved.extension, solved.force], colour: PALETTE.bone }}
        />
      )}

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Spring under load"
        subtitle="F = kx, below the elastic limit"
        rows={[
          ["Force F", `${solved.force.toFixed(2)} N`, "gold"],
          ["Extension x", `${cmOf(solved.extension).toFixed(2)} cm`],
          ["Gradient ΔF/Δx", `${solved.stiffness.toFixed(0)} N/m`, solved.elastic ? "good" : "warn"],
          ["Energy ½kx²", `${solved.elasticEnergy.toFixed(2)} J`],
          ["Permanent set", solved.yielded ? `${cmOf(solved.permanentSet).toFixed(2)} cm` : "none", solved.yielded ? "bad" : "good"],
        ]}
      />

      <SceneLegend
        title="Force–extension"
        items={[
          { color: FORCE_COLOURS.spring, shape: "line", label: "Hooke's law region", note: "straight — gradient is k" },
          { color: FORCE_COLOURS.applied, shape: "line", label: "Plastic region", note: "bent over — the spring is yielding" },
          { color: FORCE_COLOURS.limit, shape: "dash", label: "Elastic limit", note: "beyond here it will not spring back" },
          { color: FORCE_COLOURS.net, shape: "line", label: "Measured gradient", note: "ΔF/Δx where the load sits now" },
        ]}
      />
    </SceneCanvas>
  );
}
