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
import { FORCE_COLOURS, ForceVector } from "@/components/visualizations/force-diagram";
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
/** Height of the lever pivot above the workbench top to prevent bar dipping under base. */
const PIVOT_HEIGHT_ABOVE_BENCH = 1.22;
/** Seconds for one complete lift-and-lower stroke. */
const STROKE_PERIOD = 4.2;

// ─── Levers ─────────────────────────────────────────────────────────

/** A precision slotted-weight stack standing in for the load. */
function LoadStack({ position, loadN, tone = "#f1f5f9" }) {
  const plates = clamp(Math.round(loadN / 45), 1, 10);
  const plateThick = 0.085;
  const plateSpacing = 0.098;
  const totalH = plates * plateSpacing + 0.04;
  const spindleH = totalH + 0.28;

  return (
    <group position={position}>
      {/* Central suspension hanger spindle rod */}
      <mesh position={[0, spindleH / 2 - 0.02, 0]}>
        <cylinderGeometry args={[0.022, 0.022, spindleH, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.9} />
      </mesh>

      {/* Top hanger lifting ring / eyelet */}
      <mesh position={[0, spindleH + 0.04, 0]}>
        <torusGeometry args={[0.075, 0.02, 10, 24]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.85} />
      </mesh>

      {/* Base carrier platform tray */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.29, 0.29, 0.04, 28]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Slotted mass disks */}
      {Array.from({ length: plates }, (_, i) => {
        const y = 0.07 + i * plateSpacing;
        const isOdd = i % 2 === 1;
        const color = isOdd ? tone : "#e2e8f0";
        return (
          <group key={i} position={[0, y, 0]}>
            {/* Main mass disc */}
            <mesh>
              <cylinderGeometry args={[0.27, 0.27, plateThick, 32]} />
              <meshStandardMaterial color={color} roughness={0.25} metalness={0.85} />
            </mesh>
            {/* Raised central hub boss */}
            <mesh position={[0, plateThick / 2 + 0.003, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.012, 20]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
            </mesh>
            {/* Radial cutout slot (authentic laboratory slotted weight notch) */}
            <mesh position={[0.15, 0, 0]}>
              <boxGeometry args={[0.16, plateThick + 0.002, 0.04]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.5} />
            </mesh>
            {/* Circumferential calibration groove */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.271, 0.006, 6, 28]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.95} />
            </mesh>
          </group>
        );
      })}
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
function Lever({ type, solved, phase, loadN, forceScale }) {
  const layout = solved.layout ?? leverLayout(type, 0.35);
  const beam = BEAM_LENGTH_M * S;
  const pivotX = layout.fulcrum * S - beam / 2;
  const pivotY = BENCH_Y + PIVOT_HEIGHT_ABOVE_BENCH;

  // Geometry boundary: guarantee that the bar, its rails, end-caps, and attachments NEVER touch or dip under the workbench base
  const leftArmWorld = layout.fulcrum * S;
  const rightArmWorld = (BEAM_LENGTH_M - layout.fulcrum) * S;
  const tiltsClockwise = layout.load < layout.fulcrum;
  const downArmWorld = tiltsClockwise ? rightArmWorld : leftArmWorld;

  // Maximum allowable vertical drop before touching bench top (accounting for bar half-height 0.08, rail & clearance buffer 0.14)
  const maxSafeDropWorld = Math.max(PIVOT_HEIGHT_ABOVE_BENCH - 0.22, 0.25);
  const maxAllowedSin = clamp(maxSafeDropWorld / Math.max(downArmWorld, 0.001), 0.05, 0.95);

  // Angle chosen so the LOAD end travels the stroke, strictly clamped so neither arm dips under the workbench
  const maxAngle = Math.asin(clamp(solved.loadDistance / Math.max(layout.loadArm, 1e-6), 0, maxAllowedSin));
  const angle = maxAngle * phase * (tiltsClockwise ? -1 : 1);

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

  const beamCenterOffset = beam / 2 - layout.fulcrum * S;

  // Ruler tick positions along the beam (every 20 cm)
  const rulerTicks = useMemo(() => {
    const ticks = [];
    const stepM = 0.2;
    const count = Math.floor(BEAM_LENGTH_M / stepM);
    for (let i = 0; i <= count; i += 1) {
      const posM = i * stepM;
      const x = posM * S - layout.fulcrum * S;
      const isMajor = i % 5 === 0;
      ticks.push({ x, isMajor, label: `${(posM * 100).toFixed(0)}` });
    }
    return ticks;
  }, [layout.fulcrum]);

  return (
    <group>
      {/* ── Fulcrum assembly (lighter polished steel/aluminum) ── */}
      {/* Heavy-duty mounting base shoe on bench */}
      <RoundedBox position={[pivotX, BENCH_Y + 0.04, 0]} args={[0.82, 0.08, 0.52]} radius={0.02} smoothness={2}>
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.7} />
      </RoundedBox>
      {/* Corner mounting bolts on base shoe */}
      {[-0.34, 0.34].map((bx) =>
        [-0.2, 0.2].map((bz) => (
          <mesh key={`b-${bx}-${bz}`} position={[pivotX + bx, BENCH_Y + 0.085, bz]}>
            <cylinderGeometry args={[0.02, 0.02, 0.02, 10]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
          </mesh>
        )),
      )}

      {/* Main triangular fulcrum wedge in bright light silver */}
      <mesh position={[pivotX, pivotY - 0.59, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.42, 1.10, 4]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.25} metalness={0.8} />
      </mesh>

      {/* Apex pivot saddle collar */}
      <mesh position={[pivotX, pivotY - 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.42, 20]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
      </mesh>

      {/* Balance angle graduation scale plate on front of fulcrum */}
      <mesh position={[pivotX, pivotY - 0.40, 0.21]}>
        <boxGeometry args={[0.36, 0.13, 0.015]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} metalness={0.4} />
      </mesh>
      {/* Scale zero mark (red) */}
      <Line
        points={[
          [pivotX, pivotY - 0.34, 0.22],
          [pivotX, pivotY - 0.46, 0.22],
        ]}
        color="#ef4444"
        lineWidth={2.2}
      />
      {/* Scale angle divisions (-10° and +10°) */}
      <Line
        points={[
          [pivotX - 0.11, pivotY - 0.36, 0.22],
          [pivotX - 0.11, pivotY - 0.44, 0.22],
        ]}
        color="#64748b"
        lineWidth={1.6}
      />
      <Line
        points={[
          [pivotX + 0.11, pivotY - 0.36, 0.22],
          [pivotX + 0.11, pivotY - 0.44, 0.22],
        ]}
        color="#64748b"
        lineWidth={1.6}
      />

      <SceneLabel position={[pivotX, BENCH_Y - 0.42, 0]} tone="text-ink-300">
        fulcrum
      </SceneLabel>

      {/* ── The swinging bar (lighter blonde birch & aluminum precision balance) ── */}
      <group position={[pivotX, pivotY, 0]} rotation={[0, 0, angle]}>
        {/* Main beam body in luminous light birch */}
        <mesh position={[beamCenterOffset, 0.08, 0]}>
          <boxGeometry args={[beam, 0.16, 0.32]} />
          <meshStandardMaterial color="#f6ede0" roughness={0.35} metalness={0.15} />
        </mesh>

        {/* Brushed aluminum top reinforcement and graduation rail */}
        <mesh position={[beamCenterOffset, 0.164, 0]}>
          <boxGeometry args={[beam + 0.02, 0.01, 0.33]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.25} metalness={0.8} />
        </mesh>

        {/* Brushed aluminum bottom reinforcement rail */}
        <mesh position={[beamCenterOffset, -0.004, 0]}>
          <boxGeometry args={[beam + 0.02, 0.01, 0.33]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.25} metalness={0.8} />
        </mesh>

        {/* Metric ruler ticks across the top face */}
        {rulerTicks.map((t, idx) => (
          <mesh key={idx} position={[t.x, 0.171, 0]}>
            <boxGeometry args={[t.isMajor ? 0.018 : 0.008, 0.003, t.isMajor ? 0.26 : 0.16]} />
            <meshStandardMaterial color={t.isMajor ? "#1e293b" : "#64748b"} roughness={0.4} metalness={0.3} />
          </mesh>
        ))}

        {/* Polished metal end-cap brackets */}
        <mesh position={[-layout.fulcrum * S - 0.015, 0.08, 0]}>
          <boxGeometry args={[0.03, 0.17, 0.34]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
        </mesh>
        <mesh position={[(BEAM_LENGTH_M - layout.fulcrum) * S + 0.015, 0.08, 0]}>
          <boxGeometry args={[0.03, 0.17, 0.34]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
        </mesh>

        {/* Center pivot hub collar & bearing */}
        <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.38, 28]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
        </mesh>
        {/* Polished steel pivot center pin */}
        <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.46, 20]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
        </mesh>

        {/* Precision balance indicator needle (sweeps across fulcrum scale) */}
        <mesh position={[0, -0.21, 0.22]}>
          <boxGeometry args={[0.022, 0.42, 0.012]} />
          <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.6} />
        </mesh>
        <mesh position={[0, -0.43, 0.22]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.032, 0.06, 3]} />
          <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.6} />
        </mesh>

        {/* Under-beam load suspension eyelet bracket */}
        <mesh
          position={[layout.load * S - layout.fulcrum * S, -0.02, 0]}
          rotation={[0, 0, 0]}
        >
          <torusGeometry args={[0.05, 0.014, 8, 18]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>

        {/* Under-beam effort attachment bracket */}
        <mesh
          position={[layout.effort * S - layout.fulcrum * S, -0.02, 0]}
          rotation={[0, 0, 0]}
        >
          <torusGeometry args={[0.05, 0.014, 8, 18]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>
      </group>

      {/* Load stack and effort push plunger. */}
      <LoadStack position={loadPoint} loadN={loadN} />
      <SceneLabel position={[loadPoint[0], loadPoint[1] + 1.25, 0]} tone="text-ink-200">
        {`load ${loadN.toFixed(0)} N`}
      </SceneLabel>

      {/* Effort actuator rod & grip handle */}
      <mesh position={[effortPoint[0], effortPoint[1] + (tiltsClockwise ? 0.17 : -0.17), 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.34, 16]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
      </mesh>
      <mesh position={[effortPoint[0], effortPoint[1] + (tiltsClockwise ? 0.34 : -0.34), 0]}>
        <sphereGeometry args={[0.17, 18, 18]} />
        <meshStandardMaterial color={FORCE_COLOURS.applied} emissive={FORCE_COLOURS.applied} emissiveIntensity={0.6} />
      </mesh>

      {/* Live force vector arrow directly on the lever at effort point */}
      {forceScale && (
        <ForceVector
          at={[effortPoint[0], effortPoint[1] + (tiltsClockwise ? 0.42 : -0.42), 0]}
          direction={tiltsClockwise ? [0, -1, 0] : [0, 1, 0]}
          newtons={solved.effortForce}
          scale={forceScale}
          colour={ENERGY_COLOURS.workIn}
          symbol=""
          showValue={false}
        />
      )}

      {/* Live gravitational weight vector arrow directly at the load */}
      {forceScale && (
        <ForceVector
          at={[loadPoint[0], loadPoint[1] - 0.08, 0]}
          direction={[0, -1, 0]}
          newtons={loadN}
          scale={forceScale}
          colour={ENERGY_COLOURS.workOut}
          symbol=""
          showValue={false}
        />
      )}

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
        label={`${tiltsClockwise ? "effort drops" : "effort rises"} ${(solved.effortDistance * 100).toFixed(0)} cm`}
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
  const sheaveR = 0.22;
  const spread = Math.max(0.55, 0.38 * (n - 1));

  const sheavesTop = Math.ceil(n / 2);
  const sheavesBottom = Math.floor(n / 2);

  // Sheave center coordinates
  const topX = (i) => (sheavesTop > 1 ? (i / (sheavesTop - 1) - 0.5) * spread : 0);
  const botX = (i) => (sheavesBottom > 1 ? (i / (sheavesBottom - 1) - 0.5) * spread : 0);

  // Free rope pull travel: exactly n times the rise distance
  const pullTravel = solved.effortDistance * S * phase;
  const pullX = (sheavesTop > 1 ? spread / 2 : 0) + sheaveR + 0.55;
  const pullY = topY - 1.1 - pullTravel;

  /**
   * The rope threaded realistically between the upper and lower pulley blocks.
   * Includes smooth tangency arc points around sheaves rather than piercing centers.
   */
  const rope = useMemo(() => {
    const pts = [];

    // Dead end tie-off: anchored to bottom block if n is odd, upper block if n is even
    if (n % 2 === 1) {
      // Anchored to becket on lower block
      pts.push([botX(0), lowerY + 0.24, 0]);
      pts.push([botX(0), lowerY + 0.15, 0]);
    } else {
      // Anchored to becket on upper block
      pts.push([topX(0), topY - 0.24, 0]);
      pts.push([topX(0), topY - 0.15, 0]);
    }

    // Helper for generating arc tangencies around sheave rim
    // isLeftToRight indicates the rope traversal direction around the sheave rim
    const addTopArc = (cx, r, leftToRight = true) => {
      if (leftToRight) {
        pts.push([cx - r, topY, 0]);
        pts.push([cx - r * 0.707, topY + r * 0.707, 0]);
        pts.push([cx, topY + r, 0]);
        pts.push([cx + r * 0.707, topY + r * 0.707, 0]);
        pts.push([cx + r, topY, 0]);
      } else {
        pts.push([cx + r, topY, 0]);
        pts.push([cx + r * 0.707, topY + r * 0.707, 0]);
        pts.push([cx, topY + r, 0]);
        pts.push([cx - r * 0.707, topY + r * 0.707, 0]);
        pts.push([cx - r, topY, 0]);
      }
    };

    const addBottomArc = (cx, r, leftToRight = true) => {
      if (leftToRight) {
        pts.push([cx - r, lowerY, 0]);
        pts.push([cx - r * 0.707, lowerY - r * 0.707, 0]);
        pts.push([cx, lowerY - r, 0]);
        pts.push([cx + r * 0.707, lowerY - r * 0.707, 0]);
        pts.push([cx + r, lowerY, 0]);
      } else {
        pts.push([cx + r, lowerY, 0]);
        pts.push([cx + r * 0.707, lowerY - r * 0.707, 0]);
        pts.push([cx, lowerY - r, 0]);
        pts.push([cx - r * 0.707, lowerY - r * 0.707, 0]);
        pts.push([cx - r, lowerY, 0]);
      }
    };

    // Thread the rope:
    // If n is odd: starts at bottom block becket, rises to top sheave 0, drops to bot sheave 0, etc.
    // If n is even: starts at top block becket, drops to bottom sheave 0, rises to top sheave 0, etc.
    if (n % 2 === 1) {
      // Anchored to becket on lower block
      pts.push([botX(0), lowerY + 0.22, 0]);
      for (let s = 0; s < sheavesBottom; s += 1) {
        // Go UP to top sheave s
        addTopArc(topX(s), sheaveR, true);
        // Go DOWN to bottom sheave s
        addBottomArc(botX(s), sheaveR, true);
      }
      // Final top sheave before exiting
      addTopArc(topX(sheavesTop - 1), sheaveR, true);
    } else {
      // Anchored to becket on upper block
      pts.push([topX(0), topY - 0.22, 0]);
      for (let s = 0; s < sheavesBottom; s += 1) {
        // Go DOWN to bottom sheave s
        addBottomArc(botX(s), sheaveR, true);
        // Go UP to top sheave s
        addTopArc(topX(s), sheaveR, true);
      }
    }

    // Free hauling lead: passes over top exit guide sheave and drops vertically to pulling point
    const exitX = topX(sheavesTop - 1) + sheaveR;
    pts.push([exitX, topY, 0]);
    pts.push([pullX, topY + 0.08, 0]);
    pts.push([pullX, topY - 0.05, 0]);
    pts.push([pullX, pullY, 0]);

    return pts;
  }, [n, topY, lowerY, sheavesTop, sheavesBottom, spread, pullX, pullY]);

  return (
    <group>
      {/* ── Realistic Laboratory Gantry Rigging Frame ── */}
      {/* Heavy gantry base footing shoes anchored to workbench */}
      {[-2.3, 2.3].map((gx) => (
        <group key={`gantry-foot-${gx}`} position={[gx, BENCH_Y + 0.04, 0]}>
          <RoundedBox args={[0.42, 0.08, 0.36]} radius={0.02} smoothness={2}>
            <meshStandardMaterial color="#64748b" roughness={0.35} metalness={0.6} />
          </RoundedBox>
          {[-0.15, 0.15].map((bx) => (
            <mesh key={`fb-${bx}`} position={[bx, 0.045, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.02, 10]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Upright structural gantry columns */}
      {[-2.3, 2.3].map((gx) => (
        <group key={`gantry-col-${gx}`} position={[gx, BENCH_Y + 2.45, 0]}>
          <mesh>
            <cylinderGeometry args={[0.055, 0.055, 4.8, 20]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.7} />
          </mesh>
          {/* Gusset support collars */}
          <mesh position={[0, -2.15, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.18, 20]} />
            <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 2.15, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.18, 20]} />
            <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Overhead horizontal I-beam / crosshead */}
      <mesh position={[0, topY + 0.46, 0]}>
        <boxGeometry args={[4.9, 0.18, 0.36]} />
        <meshStandardMaterial color="#475569" roughness={0.35} metalness={0.65} />
      </mesh>
      {/* Polished beam rail flange */}
      <mesh position={[0, topY + 0.36, 0]}>
        <boxGeometry args={[4.8, 0.03, 0.28]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
      </mesh>

      {/* ── Upper Pulley Block (Fixed) ── */}
      {/* Suspension bracket shackle connecting to overhead rail */}
      <mesh position={[0, topY + 0.26, 0]}>
        <torusGeometry args={[0.1, 0.024, 12, 24]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
      </mesh>
      {/* Top block steel cheek plates casing */}
      <RoundedBox position={[0, topY, 0]} args={[spread + 0.58, 0.44, 0.28]} radius={0.04} smoothness={3}>
        <meshStandardMaterial color="#64748b" roughness={0.35} metalness={0.65} />
      </RoundedBox>
      {/* Top block polished central through-axle pin */}
      <mesh position={[0, topY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.34, 24]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
      </mesh>
      {/* Becket lug on top block */}
      <mesh position={[topX(0), topY - 0.24, 0]}>
        <torusGeometry args={[0.05, 0.015, 8, 16]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
      </mesh>

      {/* Top Sheaves with grooved rims */}
      {Array.from({ length: sheavesTop }, (_, i) => (
        <group key={`top-sheave-${i}`} position={[topX(i), topY, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[sheaveR, 0.048, 12, 28]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.85} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[sheaveR - 0.02, sheaveR - 0.02, 0.07, 24]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Exit guide sheave for free pulling lead */}
      <group position={[pullX - 0.15, topY + 0.08, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.035, 10, 24]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
        </mesh>
      </group>

      {/* ── Lower Pulley Block (Moving) ── */}
      <group position={[0, lowerY, 0]}>
        {/* Steel cheek casing holding lower sheaves */}
        <RoundedBox args={[spread + 0.52, 0.42, 0.28]} radius={0.04} smoothness={3}>
          <meshStandardMaterial color="#64748b" roughness={0.35} metalness={0.65} />
        </RoundedBox>
        {/* Lower block axle pin */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.34, 24]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
        </mesh>
        {/* Becket anchor lug on lower block */}
        <mesh position={[botX(0), 0.24, 0]}>
          <torusGeometry args={[0.05, 0.015, 8, 16]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
        </mesh>

        {/* Lower Sheaves with grooved rims */}
        {Array.from({ length: sheavesBottom }, (_, i) => (
          <group key={`bot-sheave-${i}`} position={[botX(i), 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[sheaveR, 0.048, 12, 28]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.85} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[sheaveR - 0.02, sheaveR - 0.02, 0.07, 24]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.7} />
            </mesh>
          </group>
        ))}

        {/* Swivel lifting shank and forged crane hook */}
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.12, 16]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
        </mesh>
        <mesh position={[0, -0.38, 0]} rotation={[0, 0, Math.PI / 6]}>
          <torusGeometry args={[0.11, 0.032, 10, 24, Math.PI * 1.5]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Rigging shackle connecting hook to safe eyelet */}
        <mesh position={[0, -0.49, 0]}>
          <torusGeometry args={[0.05, 0.016, 8, 16]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.85} />
        </mesh>
      </group>

      {/* Threaded High-Tensile Rope */}
      <Line points={rope} color={ENERGY_COLOURS.workIn} lineWidth={2.6} />

      {/* ── Hauling Effort Handle / Plunger ── */}
      <group position={[pullX, pullY, 0]}>
        {/* Ergonomic knurled pulling grip */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.042, 0.042, 0.28, 18]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Flanged top & bottom end-caps */}
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.03, 18]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.03, 18]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>

      {/* The safe (load in block & tackle). */}
      <group position={[0, lowerY - 1.15, 0]}>
        {/* Main vault body in lighter platinum / silver */}
        <RoundedBox args={[1.15, 1.15, 0.95]} radius={0.06} smoothness={3}>
          <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.65} />
        </RoundedBox>

        {/* Heavy-duty top lifting shackle connecting to the hook */}
        <mesh position={[0, 0.65, 0]}>
          <torusGeometry args={[0.12, 0.028, 10, 24]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.05, 16]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.85} />
        </mesh>

        {/* Front door recessed face */}
        <mesh position={[0, 0, 0.48]}>
          <boxGeometry args={[0.96, 0.96, 0.02]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.55} />
        </mesh>

        {/* Polished corner reinforcement brackets */}
        {[-0.52, 0.52].map((cx) =>
          [-0.52, 0.52].map((cy) => (
            <mesh key={`c-${cx}-${cy}`} position={[cx, cy, 0.485]}>
              <boxGeometry args={[0.1, 0.1, 0.025]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.9} />
            </mesh>
          )),
        )}

        {/* Combination dial ring in brass & chrome */}
        <mesh position={[0.22, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.035, 10, 24]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.8} />
        </mesh>
        <mesh position={[0.22, 0, 0.51]}>
          <cylinderGeometry args={[0.08, 0.08, 0.04, 18]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
        </mesh>

        <SceneLabel position={[0, -0.86, 0]} tone="text-ink-200">
          {`${loadN.toFixed(0)} N · ${solved.loadMassKg.toFixed(0)} kg`}
        </SceneLabel>
      </group>

      <SceneLabel position={[0, topY + 0.86, 0]} accent>
        {`${n} rope${n === 1 ? "" : "s"} supporting the load`}
      </SceneLabel>

      {/* Travel indicator alongside safe rise */}
      <TravelMarker
        from={[1.2, topY - drop - 1.15, 0]}
        to={[1.2, lowerY - 1.15, 0]}
        colour={ENERGY_COLOURS.workOut}
        label={`safe rises ${(solved.loadDistance * 100).toFixed(0)} cm`}
        side={1}
      />
      {/* Travel indicator alongside rope pull */}
      <TravelMarker
        from={[pullX + 0.35, topY - 1.1, 0]}
        to={[pullX + 0.35, pullY, 0]}
        colour={ENERGY_COLOURS.workIn}
        label={`rope pulled ${(solved.effortDistance * 100).toFixed(0)} cm`}
        side={1}
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

  // Lever lift calculation:
  // For Class 1: downward effort arm drop is clamped so it never breaches the workbench.
  // For Class 2 & 3: fulcrum is at the left end, bar tilts upwards; allow natural stroke travel proportional to load arm.
  const lift = useMemo(() => {
    if (!lever) return LIFT_M;
    const layout = leverLayout(machineType, armPosition);
    if (machineType === "lever1") {
      const tiltsClockwise = layout.load < layout.fulcrum;
      const downArmM = tiltsClockwise ? layout.effortArm : layout.loadArm;
      const maxSafeDropM = Math.max(PIVOT_HEIGHT_ABOVE_BENCH - 0.22, 0.25) / S;
      const maxSin = clamp(maxSafeDropM / Math.max(downArmM, 0.001), 0.05, 0.55);
      return Math.min(LIFT_M, layout.loadArm * maxSin);
    }
    // Class 2 and Class 3: load lifts upward with the beam tilt, comfortably within laboratory envelope
    return Math.min(LIFT_M, 0.35 * layout.loadArm);
  }, [lever, machineType, armPosition]);

  const solved = useMemo(
    () => solveMachine({ type: machineType, p: armPosition, sheaves, loadN, lift }),
    [machineType, armPosition, sheaves, loadN, lift],
  );

  // Dynamic stroke speed simulating mass inertia and rotational resistance:
  // Heavier loads exhibit realistic physical resistance, slowing the stroke cadence naturally.
  const dynamicSpeed = useMemo(() => {
    const inertiaFactor = Math.pow(Math.max(loadN, 20) / 200, 0.22);
    return Math.max(0.25, speed / inertiaFactor);
  }, [speed, loadN]);

  // Direction and action label for effort depending on machine class:
  // Class 1 & Pulley: downward effort ("you push" or "you pull down")
  // Class 2 & 3: upward effort ("you lift up")
  const effortDirection = machineType === "lever2" || machineType === "lever3" ? [0, 1, 0] : [0, -1, 0];
  const effortLabel = machineType === "lever2" || machineType === "lever3" ? "you lift" : machineType === "pulley" ? "you pull" : "you push";

  // Maximum work scale: calibrated to 150 J baseline, scaling proportionally with load settings
  const workScaleMax = useMemo(
    () => Math.max(150, Math.ceil((solved.workIn * 1.08) / 25) * 25),
    [solved.workIn],
  );

  // Absolute calibrated force scale: arrow lengths grow and shrink visibly with loadN and effortForce changes
  const forceScale = useMemo(
    () => 1.6 / Math.max(650, solved.loadN, solved.effortForce),
    [solved.loadN, solved.effortForce],
  );

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
        cellColor="#334155"
        sectionSize={2}
        sectionColor="#475569"
        fadeDistance={34}
        infiniteGrid={false}
      />

      {/* Modern lighter laboratory workbench base. */}
      <RoundedBox position={[0.7, BENCH_Y - 0.12, 0]} args={[7.6, 0.24, 2.5]} radius={0.03} smoothness={3} receiveShadow>
        <meshStandardMaterial color="#64748b" roughness={0.45} metalness={0.35} />
      </RoundedBox>

      {/* Inset top workplate in bright brushed aluminum */}
      <mesh position={[0.7, BENCH_Y + 0.005, 0]} receiveShadow>
        <boxGeometry args={[7.4, 0.015, 2.3]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.65} />
      </mesh>

      {/* Bench corner support pedestals */}
      {[-3.2, 3.2].map((fx) =>
        [-0.95, 0.95].map((fz) => (
          <mesh key={`leg-${fx}-${fz}`} position={[0.7 + fx, BENCH_Y - 0.28, fz]}>
            <cylinderGeometry args={[0.1, 0.13, 0.12, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.35} metalness={0.7} />
          </mesh>
        )),
      )}

      <StrokeClock running={running} speed={dynamicSpeed} onPhase={setPhase} />

      <group position={[0.7, 0, 0]}>
        {lever ? (
          <Lever type={machineType} solved={solved} phase={phase} loadN={loadN} forceScale={forceScale} />
        ) : (
          <Pulley solved={solved} phase={phase} loadN={loadN} />
        )}
      </group>

      {/* Effort and load as force vectors, on one shared calibrated scale so the
          force saving is as visible as the distance cost. */}
      <group position={[3.6, BENCH_Y + 3.6, 0]}>
        <ForceVector
          at={[0, 0, 0]}
          direction={effortDirection}
          newtons={solved.effortForce}
          scale={forceScale}
          colour={ENERGY_COLOURS.workIn}
          symbol="effort"
        />
        <SceneLabel position={[0, 0.42, 0]} tone="text-ink-300">
          {effortLabel}
        </SceneLabel>
      </group>
      <group position={[4.45, BENCH_Y + 3.6, 0]}>
        <ForceVector
          at={[0, 0, 0]}
          direction={[0, 1, 0]}
          newtons={solved.loadN}
          scale={forceScale}
          colour={ENERGY_COLOURS.workOut}
          symbol="load"
        />
        <SceneLabel position={[0, 0.42, 0]} tone="text-ink-300">
          it lifts
        </SceneLabel>
      </group>

      <EnergyBars
        position={[5.1, BENCH_Y + 0.45, 0]}
        width={3.0}
        height={2.2}
        scaleMax={workScaleMax}
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
