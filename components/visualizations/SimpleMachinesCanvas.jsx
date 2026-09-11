"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid, Line, RoundedBox } from "@react-three/drei";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
} from "@/components/visualizations/scene-kit";
import { ENERGY_COLOURS, EnergyBars } from "@/components/visualizations/energy-bars";
import { FORCE_COLOURS, ForceVector, useForceScale } from "@/components/visualizations/force-diagram";
import {
  BEAM_LENGTH_M,
  LIFT_M,
  isLever,
  leverLayout,
  solveMachine,
  supportingRopes,
} from "@/lib/simpleMachines";

// ─── Simple machines & mechanical advantage ─────────────────────────
// A lab bench that switches between the three classes of lever and a block
// and tackle, running the same job on each: raise this load by this height.
//
// The scene animates a full stroke rather than showing a still, because the
// trade-off it exists to teach is a statement about DISTANCES. A picture of a
// lever at rest shows the small effort force and hides the long sweep that
// paid for it, which is exactly the half of the bargain students forget.
// ─────────────────────────────────────────────────────────────────────

/** World units per metre. */
const S = 2.1;
const BENCH_Y = -1.9;
/** Seconds for one complete lift-and-lower stroke. */
const STROKE_PERIOD = 4.2;

// ─── Levers ─────────────────────────────────────────────────────────

/** A slotted-weight stack standing in for the load. */
function LoadStack({ position, loadN, tone = "#6c7684" }) {
  const plates = clamp(Math.round(loadN / 60), 1, 8);
  return (
    <group position={position}>
      {Array.from({ length: plates }, (_, i) => (
        <mesh key={i} position={[0, 0.07 + i * 0.115, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.1, 20]} />
          <meshStandardMaterial color={i % 2 ? tone : "#5b6472"} roughness={0.45} metalness={0.62} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The lever bar, its fulcrum, and the two travel markers.
 *
 * The bar is drawn tilted through the live stroke angle, so the load end and
 * the effort end visibly sweep different distances — the geometry IS the
 * mechanical advantage, and the markers put a number on both.
 */
function Lever({ type, solved, phase, loadN }) {
  const layout = solved.layout ?? leverLayout(type, 0.35);
  const beam = BEAM_LENGTH_M * S;
  const pivotX = layout.fulcrum * S - beam / 2;
  const pivotY = BENCH_Y + 0.62;

  // Angle chosen so the LOAD end travels exactly the stroke this machine is
  // being asked for; the effort end then travels whatever the arms dictate.
  const maxAngle = Math.asin(clamp(solved.loadDistance / Math.max(layout.loadArm, 1e-6), 0, 0.95));
  const angle = maxAngle * phase * (layout.load < layout.fulcrum ? -1 : 1);

  const at = (metres) => {
    const r = metres * S - (layout.fulcrum * S);
    return [pivotX + r * Math.cos(angle), pivotY + r * Math.sin(angle), 0];
  };

  // Effort presses down on one side; the load rises on the other. Which end
  // is which is the entire definition of the three classes.
  const loadPoint = at(layout.load);
  const effortPoint = at(layout.effort);
  const restLoad = [pivotX + (layout.load * S - layout.fulcrum * S), pivotY, 0];
  const restEffort = [pivotX + (layout.effort * S - layout.fulcrum * S), pivotY, 0];

  return (
    <group>
      {/* Fulcrum wedge. */}
      <mesh position={[pivotX, pivotY - 0.34, 0]}>
        <coneGeometry args={[0.34, 0.62, 4]} />
        <meshStandardMaterial color="#5b6472" roughness={0.45} metalness={0.6} />
      </mesh>
      <SceneLabel position={[pivotX, pivotY - 0.86, 0]} tone="text-ink-300">
        fulcrum
      </SceneLabel>

      {/* The bar. */}
      <group position={[pivotX, pivotY, 0]} rotation={[0, 0, angle]}>
        <mesh position={[beam / 2 - layout.fulcrum * S, 0.08, 0]}>
          <boxGeometry args={[beam, 0.16, 0.34]} />
          <meshStandardMaterial color="#8a5a3b" roughness={0.7} metalness={0.05} />
        </mesh>
      </group>

      {/* Load and effort. */}
      <LoadStack position={loadPoint} loadN={loadN} />
      <SceneLabel position={[loadPoint[0], loadPoint[1] + 1.15, 0]} tone="text-ink-200">
        {`load ${loadN.toFixed(0)} N`}
      </SceneLabel>

      <mesh position={[effortPoint[0], effortPoint[1] + 0.34, 0]}>
        <sphereGeometry args={[0.17, 18, 18]} />
        <meshStandardMaterial color={FORCE_COLOURS.applied} emissive={FORCE_COLOURS.applied} emissiveIntensity={0.6} />
      </mesh>

      {/* Travel markers — the point of the whole scene. */}
      <TravelMarker
        from={restLoad}
        to={loadPoint}
        colour={ENERGY_COLOURS.workOut}
        label={`load rises ${(solved.loadDistance * 100).toFixed(0)} cm`}
        side={1}
      />
      <TravelMarker
        from={restEffort}
        to={effortPoint}
        colour={ENERGY_COLOURS.workIn}
        label={`effort moves ${(solved.effortDistance * 100).toFixed(0)} cm`}
        side={-1}
      />
    </group>
  );
}

/** A dashed span between where something started and where it is now. */
function TravelMarker({ from, to, colour, label, side = 1 }) {
  const dy = Math.abs(to[1] - from[1]);
  if (dy < 0.02) return null;
  const x = from[0] + side * 0.46;
  const lo = Math.min(from[1], to[1]);
  const hi = Math.max(from[1], to[1]);
  return (
    <group>
      <Line
        points={[
          [x, lo, 0],
          [x, hi, 0],
        ]}
        color={colour}
        lineWidth={2.4}
      />
      {[lo, hi].map((y) => (
        <Line
          key={y}
          points={[
            [x - 0.13, y, 0],
            [x + 0.13, y, 0],
          ]}
          color={colour}
          lineWidth={2}
        />
      ))}
      <SceneLabel position={[x + side * 0.72, (lo + hi) / 2, 0]} tone="text-ink-200">
        {label}
      </SceneLabel>
    </group>
  );
}

// ─── Block and tackle ───────────────────────────────────────────────

/**
 * A tackle with `n` rope segments supporting the load.
 *
 * Every segment is drawn, because the count IS the advantage: n ropes share
 * the load's weight, so each carries a fraction of it, and the free end has to
 * be hauled through n times the distance the safe rises.
 */
function Pulley({ solved, phase, loadN }) {
  const n = solved.ropes;
  const topY = BENCH_Y + 4.5;
  const drop = 2.2;
  const rise = solved.loadDistance * S * phase;
  const lowerY = topY - drop + rise;
  const spread = 0.62;

  const sheavesTop = Math.ceil(n / 2);
  const sheavesBottom = Math.floor(n / 2);

  const topX = (i) => -spread / 2 + (sheavesTop > 1 ? (i / (sheavesTop - 1) - 0.5) * spread : 0);
  const botX = (i) => (sheavesBottom > 1 ? (i / (sheavesBottom - 1) - 0.5) * spread : 0);

  /** The rope, threaded alternately between the two blocks. */
  const rope = useMemo(() => {
    const pts = [[topX(0), topY, 0]];
    for (let k = 0; k < n; k += 1) {
      const down = k % 2 === 0;
      const bi = Math.min(Math.floor(k / 2), Math.max(sheavesBottom - 1, 0));
      const ti = Math.min(Math.floor((k + 1) / 2), Math.max(sheavesTop - 1, 0));
      if (down) pts.push([botX(bi), lowerY, 0], [topX(ti), topY, 0]);
      else pts.push([topX(ti), topY, 0], [botX(bi), lowerY, 0]);
    }
    // The free end the effort is applied to.
    const last = pts[pts.length - 1];
    pts.push([last[0] + 1.5, topY, 0], [last[0] + 1.5, topY - 2.6 - rise * 0.4, 0]);
    return pts;
  }, [n, topY, lowerY, sheavesTop, sheavesBottom, rise]);

  return (
    <group>
      {/* Overhead beam. */}
      <mesh position={[0, topY + 0.34, 0]}>
        <boxGeometry args={[5.2, 0.24, 0.5]} />
        <meshStandardMaterial color="#39414f" roughness={0.55} metalness={0.5} />
      </mesh>

      {/* Sheaves. */}
      {Array.from({ length: sheavesTop }, (_, i) => (
        <mesh key={`t${i}`} position={[topX(i), topY, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.055, 10, 22]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.8} />
        </mesh>
      ))}
      {Array.from({ length: sheavesBottom }, (_, i) => (
        <mesh key={`b${i}`} position={[botX(i), lowerY, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.055, 10, 22]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.8} />
        </mesh>
      ))}

      <Line points={rope} color={ENERGY_COLOURS.workIn} lineWidth={2.2} />

      {/* The safe. */}
      <group position={[0, lowerY - 0.95, 0]}>
        <RoundedBox args={[1.15, 1.15, 0.95]} radius={0.06} smoothness={3}>
          <meshStandardMaterial color="#3f4a5c" roughness={0.5} metalness={0.55} />
        </RoundedBox>
        <mesh position={[0.22, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.035, 8, 20]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.9} />
        </mesh>
        <SceneLabel position={[0, -0.86, 0]} tone="text-ink-200">
          {`${loadN.toFixed(0)} N · ${solved.loadMassKg.toFixed(0)} kg`}
        </SceneLabel>
      </group>

      <SceneLabel position={[0, topY + 0.86, 0]} accent>
        {`${n} rope${n === 1 ? "" : "s"} supporting the load`}
      </SceneLabel>

      <TravelMarker
        from={[1.35, topY - drop - 0.95, 0]}
        to={[1.35, lowerY - 0.95, 0]}
        colour={ENERGY_COLOURS.workOut}
        label={`safe rises ${(solved.loadDistance * 100).toFixed(0)} cm`}
        side={1}
      />
      <TravelMarker
        from={[-2.4, topY - 2.6, 0]}
        to={[-2.4, topY - 2.6 - solved.effortDistance * S * phase, 0]}
        colour={ENERGY_COLOURS.workIn}
        label={`rope pulled ${(solved.effortDistance * 100).toFixed(0)} cm`}
        side={-1}
      />
    </group>
  );
}

// ─── Stroke clock ───────────────────────────────────────────────────

/**
 * Drives the lift-and-lower cycle.
 *
 * Kept in its own component inside the canvas so the phase can advance every
 * frame while the React tree above only re-renders at the sample rate — and so
 * `useFrame` unsubscribes with it when the topic is switched away.
 */
function StrokeClock({ running, speed = 1, onPhase, hz = 30 }) {
  const t = useRef(0);
  const since = useRef(0);
  const lastPhase = useRef(-1);

  useFrame((_, rawDelta) => {
    if (!running || speed <= 0) return;
    const delta = Math.min(rawDelta, 1 / 30);
    t.current += delta * speed;
    since.current += delta;
    if (since.current >= 1 / hz) {
      since.current = 0;
      // A raised cosine, so the stroke eases at both ends instead of snapping.
      const p = (1 - Math.cos((t.current / STROKE_PERIOD) * Math.PI * 2)) / 2;
      if (Math.abs(p - lastPhase.current) > 0.002) {
        lastPhase.current = p;
        onPhase(p);
      }
    }
  });
  return null;
}

// ─── The scene ──────────────────────────────────────────────────────

export default function SimpleMachinesCanvas({ params = {} }) {
  const {
    machineType = "lever1",
    armPosition = 0.35,
    sheaves = 2,
    loadN = 300,
    running = true,
    speed = 1,
  } = params || {};

  const [phase, setPhase] = useState(0);
  const lever = isLever(machineType);

  // A short lever arm cannot sweep through the full 25 cm stroke, so the job
  // shrinks to fit rather than the bar being drawn through an impossible
  // angle. The RATIO of the two distances — which is what the lesson is about
  // — is untouched by that.
  const lift = useMemo(() => {
    if (!lever) return LIFT_M;
    const { loadArm } = leverLayout(machineType, armPosition);
    return Math.min(LIFT_M, 0.45 * loadArm);
  }, [lever, machineType, armPosition]);

  const solved = useMemo(
    () => solveMachine({ type: machineType, p: armPosition, sheaves, loadN, lift }),
    [machineType, armPosition, sheaves, loadN, lift],
  );

  const scale = useForceScale([solved.loadN, solved.effortForce], 1.5);

  return (
    <SceneCanvas
      // Apparatus on the left of the frame, instruments stacked down the
      // right, and the whole thing pushed clear of the controls panel.
      camera={{ position: [1.5, 1.2, 13.4], fov: 46 }}
      controls={{ minDistance: 5, maxDistance: 30, target: [1.5, 0.3, 0] }}
      lights={{ ambient: 0.54, keyLight: 0.95 }}
    >
      <Grid
        position={[0, BENCH_Y - 0.001, 0]}
        args={[26, 14]}
        cellSize={0.5}
        cellColor="#1e2531"
        sectionSize={2}
        sectionColor="#2b3442"
        fadeDistance={34}
        infiniteGrid={false}
      />

      {/* Bench. */}
      <mesh position={[0.7, BENCH_Y - 0.12, 0]} receiveShadow>
        <boxGeometry args={[7.4, 0.24, 2.4]} />
        <meshStandardMaterial color="#252c38" roughness={0.85} metalness={0.05} />
      </mesh>

      <StrokeClock running={running} speed={speed} onPhase={setPhase} />

      <group position={[0.7, 0, 0]}>
        {lever ? (
          <Lever type={machineType} solved={solved} phase={phase} loadN={loadN} />
        ) : (
          <Pulley solved={solved} phase={phase} loadN={loadN} />
        )}
      </group>

      {/* Effort and load as force vectors, on one shared scale so the
          force saving is as visible as the distance cost. */}
      <group position={[3.5, BENCH_Y + 3.8, 0]}>
        <ForceVector
          at={[0, 0, 0]}
          direction={[0, -1, 0]}
          newtons={solved.effortForce}
          scale={scale}
          colour={ENERGY_COLOURS.workIn}
          symbol="effort"
        />
        <SceneLabel position={[0, 0.42, 0]} tone="text-ink-300">
          you push
        </SceneLabel>
      </group>
      <group position={[4.35, BENCH_Y + 3.8, 0]}>
        <ForceVector
          at={[0, 0, 0]}
          direction={[0, -1, 0]}
          newtons={solved.loadN}
          scale={scale}
          colour={ENERGY_COLOURS.workOut}
          symbol="load"
        />
        <SceneLabel position={[0, 0.42, 0]} tone="text-ink-300">
          it lifts
        </SceneLabel>
      </group>

      <EnergyBars
        position={[5.4, BENCH_Y + 0, 0]}
        width={3.1}
        height={2.2}
        title="work per stroke"
        unit="J"
        format={(v) => v.toFixed(1)}
        reference={solved.workIn}
        bars={[
          { key: "in", label: "in", value: solved.workIn, colour: ENERGY_COLOURS.workIn },
          { key: "out", label: "out", value: solved.workOut, colour: ENERGY_COLOURS.workOut },
          { key: "heat", label: "wasted", value: solved.wasted, colour: ENERGY_COLOURS.wasted },
        ]}
        footnote={`efficiency ${(solved.efficiency * 100).toFixed(0)}% · MA ${solved.mechanicalAdvantage.toFixed(2)} · VR ${solved.velocityRatio.toFixed(2)}`}
      />

      <SceneLabel position={[0.7, BENCH_Y + 5.9, 0]} accent>
        {solved.machine.label}
      </SceneLabel>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title={solved.machine.label}
        subtitle={solved.machine.order}
        rows={[
          ["Load", `${loadN.toFixed(0)} N`],
          ["Effort needed", `${solved.effortForce.toFixed(1)} N`, solved.losesForce ? "bad" : "good"],
          ["Mechanical advantage", `${solved.mechanicalAdvantage.toFixed(2)}×`],
          ["Distance ratio", `${solved.velocityRatio.toFixed(2)}×`],
          ["Efficiency", `${(solved.efficiency * 100).toFixed(0)}%`],
        ]}
      />

      <SceneLegend
        title="Work bookkeeping"
        items={[
          { color: ENERGY_COLOURS.workIn, label: "Work in", note: "effort force × the distance you move it" },
          { color: ENERGY_COLOURS.workOut, label: "Work out", note: "load × the height it rises" },
          { color: ENERGY_COLOURS.wasted, label: "Wasted", note: "friction at the pivots and sheaves — heat" },
        ]}
      />
    </SceneCanvas>
  );
}
