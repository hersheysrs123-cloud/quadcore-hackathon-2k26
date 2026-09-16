"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  ChevronDown,
  ChevronRight,
  Gauge,
  Layers,
  Scale,
  Zap,
} from "lucide-react";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
} from "@/components/visualizations/scene-kit";
import { ENERGY_COLOURS } from "@/components/visualizations/energy-bars";
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

/**
 * A precision laboratory slotted-weight stack suspended beneath the beam.
 * Weights hang stably under gravity from an eyelet hook rather than floating on top.
 */
function LoadStack({ position = [0, 0, 0], loadN = 300, tone = "#f1f5f9" }) {
  const plates = clamp(Math.round(loadN / 45), 1, 10);
  const plateThick = 0.082;
  const plateSpacing = 0.095;
  const totalH = plates * plateSpacing + 0.04;
  const spindleH = totalH + 0.22;

  return (
    <group position={position}>
      {/* Upper suspension hook attaching to under-beam eyelet */}
      <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[0.055, 0.016, 10, 20, Math.PI * 1.5]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.92} />
      </mesh>

      {/* Central suspension hanger spindle rod */}
      <mesh position={[0, -spindleH / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, spindleH, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.9} />
      </mesh>

      {/* Top hanger ring connecting hook to spindle */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[0.045, 0.014, 8, 18]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
      </mesh>

      {/* Base carrier platform tray */}
      <mesh position={[0, -spindleH, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.038, 28]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Slotted mass disks stacked upward from the tray */}
      {Array.from({ length: plates }, (_, i) => {
        const y = -spindleH + 0.045 + i * plateSpacing;
        const isOdd = i % 2 === 1;
        const color = isOdd ? tone : "#e2e8f0";
        return (
          <group key={i} position={[0, y, 0]}>
            {/* Main mass disc */}
            <mesh>
              <cylinderGeometry args={[0.26, 0.26, plateThick, 32]} />
              <meshStandardMaterial color={color} roughness={0.25} metalness={0.85} />
            </mesh>
            {/* Raised central hub boss */}
            <mesh position={[0, plateThick / 2 + 0.002, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.01, 20]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
            </mesh>
            {/* Radial cutout slot (authentic laboratory slotted weight notch) */}
            <mesh position={[0.14, 0, 0]}>
              <boxGeometry args={[0.15, plateThick + 0.002, 0.038]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.5} />
            </mesh>
            {/* Circumferential calibration groove */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.261, 0.005, 6, 28]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.95} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * The lever bar, its fulcrum, and travel markers.
 *
 * Performance: Animated strictly in `useFrame` via direct Three.js object transforms
 * rather than thrashing React state at 30Hz, achieving 60-120 FPS without frame drops.
 *
 * Realism:
 * - Class 1 uses a triangular knife-edge fulcrum with saddle collar, scale plate, and balance needle.
 * - Class 2 & 3 use a robust stanchion hinge bracket with horizontal clevis pin at x=0.
 * - Loads hang vertically below the beam eyelet, preserving physical gravity behavior.
 */
function Lever({ type, solved, running, speed, loadN, forceScale }) {
  const layout = solved.layout ?? leverLayout(type, 0.35);
  const beam = BEAM_LENGTH_M * S;
  const pivotX = layout.fulcrum * S - beam / 2;
  const pivotY = BENCH_Y + PIVOT_HEIGHT_ABOVE_BENCH;

  const leftArmWorld = layout.fulcrum * S;
  const rightArmWorld = (BEAM_LENGTH_M - layout.fulcrum) * S;
  const tiltsClockwise = layout.load < layout.fulcrum;
  const downArmWorld = tiltsClockwise ? rightArmWorld : leftArmWorld;

  const maxSafeDropWorld = Math.max(PIVOT_HEIGHT_ABOVE_BENCH - 0.22, 0.25);
  const maxAllowedSin = clamp(maxSafeDropWorld / Math.max(downArmWorld, 0.001), 0.05, 0.95);
  const maxAngle = Math.asin(clamp(solved.loadDistance / Math.max(layout.loadArm, 1e-6), 0, maxAllowedSin));

  const beamCenterOffset = beam / 2 - layout.fulcrum * S;
  const isClass1 = type === "lever1";

  // Animation refs for zero-state useFrame updates
  const tRef = useRef(0);
  const beamGroupRef = useRef(null);
  const loadGroupRef = useRef(null);
  const effortGroupRef = useRef(null);

  useFrame((_, rawDelta) => {
    if (running && speed > 0) {
      const delta = Math.min(rawDelta, 1 / 30);
      tRef.current += delta * speed;
    }
    const phase = (1 - Math.cos((tRef.current / STROKE_PERIOD) * Math.PI * 2)) / 2;
    const angle = maxAngle * phase * (tiltsClockwise ? -1 : 1);

    if (beamGroupRef.current) {
      beamGroupRef.current.rotation.z = angle;
    }

    const rLoad = layout.load * S - layout.fulcrum * S;
    const lx = pivotX + rLoad * Math.cos(angle);
    const ly = pivotY + rLoad * Math.sin(angle);

    if (loadGroupRef.current) {
      loadGroupRef.current.position.set(lx, ly - 0.04, 0);
    }

    const rEffort = layout.effort * S - layout.fulcrum * S;
    const ex = pivotX + rEffort * Math.cos(angle);
    const ey = pivotY + rEffort * Math.sin(angle);

    if (effortGroupRef.current) {
      effortGroupRef.current.position.set(ex, ey, 0);
    }
  });

  const restLoadX = pivotX + (layout.load * S - layout.fulcrum * S);
  const restEffortX = pivotX + (layout.effort * S - layout.fulcrum * S);

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
      {/* ── Fulcrum Assembly ── */}
      {isClass1 ? (
        // Class 1: Triangular knife-edge balance scale fulcrum
        <group>
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
          <Line
            points={[
              [pivotX, pivotY - 0.34, 0.22],
              [pivotX, pivotY - 0.46, 0.22],
            ]}
            color="#ef4444"
            lineWidth={2.2}
          />
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
        </group>
      ) : (
        // Class 2 & 3: Stanchion Hinge Clevis Bracket at x=0
        <group>
          {/* Base plate bolted to workbench */}
          <RoundedBox position={[pivotX, BENCH_Y + 0.04, 0]} args={[0.52, 0.08, 0.52]} radius={0.02} smoothness={2}>
            <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.75} />
          </RoundedBox>
          {[-0.2, 0.2].map((bx) =>
            [-0.2, 0.2].map((bz) => (
              <mesh key={`hinge-bolt-${bx}-${bz}`} position={[pivotX + bx, BENCH_Y + 0.085, bz]}>
                <cylinderGeometry args={[0.02, 0.02, 0.02, 10]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
              </mesh>
            )),
          )}

          {/* Front upright stanchion ear */}
          <mesh position={[pivotX, pivotY - 0.56, 0.20]}>
            <boxGeometry args={[0.16, 1.16, 0.06]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
          </mesh>
          {/* Rear upright stanchion ear */}
          <mesh position={[pivotX, pivotY - 0.56, -0.20]}>
            <boxGeometry args={[0.16, 1.16, 0.06]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
          </mesh>

          {/* Horizontal clevis hinge pin through beam end */}
          <mesh position={[pivotX, pivotY, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.48, 24]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
          </mesh>
          {/* End cap retaining nut */}
          <mesh position={[pivotX, pivotY, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.03, 6]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[pivotX, pivotY, -0.25]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.03, 6]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      )}

      <SceneLabel position={[pivotX, BENCH_Y - 0.42, 0]} tone="text-ink-300">
        {isClass1 ? "fulcrum" : "hinge pivot"}
      </SceneLabel>

      {/* ── The swinging bar (blonde birch & aluminum precision balance) ── */}
      <group ref={beamGroupRef} position={[pivotX, pivotY, 0]}>
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

        {/* Pivot hub collar & bearing */}
        <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.38, 28]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.46, 20]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
        </mesh>

        {/* Class 1 Balance needle (only for see-saw scale) */}
        {isClass1 && (
          <group>
            <mesh position={[0, -0.21, 0.22]}>
              <boxGeometry args={[0.022, 0.42, 0.012]} />
              <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.6} />
            </mesh>
            <mesh position={[0, -0.43, 0.22]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.032, 0.06, 3]} />
              <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.6} />
            </mesh>
          </group>
        )}

        {/* Under-beam load suspension eyelet bracket */}
        <mesh position={[layout.load * S - layout.fulcrum * S, -0.02, 0]}>
          <torusGeometry args={[0.05, 0.014, 8, 18]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>

        {/* Under-beam effort attachment bracket */}
        <mesh position={[layout.effort * S - layout.fulcrum * S, -0.02, 0]}>
          <torusGeometry args={[0.05, 0.014, 8, 18]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>
      </group>

      {/* ── Suspended Load (driven via useFrame ref) ── */}
      <group ref={loadGroupRef} position={[restLoadX, pivotY - 0.04, 0]}>
        <LoadStack loadN={loadN} />
        <SceneLabel position={[0, 0.55, 0]} tone="text-ink-200">
          {`load ${loadN.toFixed(0)} N`}
        </SceneLabel>

        {/* Gravitational weight vector arrow at load */}
        {forceScale && (
          <ForceVector
            at={[0, -0.95, 0]}
            direction={[0, -1, 0]}
            newtons={loadN}
            scale={forceScale}
            colour={ENERGY_COLOURS.workOut}
            symbol=""
            showValue={false}
          />
        )}
      </group>

      {/* ── Effort Actuator Grip Handle (driven via useFrame ref) ── */}
      <group ref={effortGroupRef} position={[restEffortX, pivotY, 0]}>
        <mesh position={[0, tiltsClockwise ? 0.17 : -0.17, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.34, 16]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>
        <mesh position={[0, tiltsClockwise ? 0.34 : -0.34, 0]}>
          <sphereGeometry args={[0.17, 18, 18]} />
          <meshStandardMaterial color={FORCE_COLOURS.applied} emissive={FORCE_COLOURS.applied} emissiveIntensity={0.6} />
        </mesh>

        {/* Effort force vector arrow */}
        {forceScale && (
          <ForceVector
            at={[0, tiltsClockwise ? 0.42 : -0.42, 0]}
            direction={tiltsClockwise ? [0, -1, 0] : [0, 1, 0]}
            newtons={solved.effortForce}
            scale={forceScale}
            colour={ENERGY_COLOURS.workIn}
            symbol=""
            showValue={false}
          />
        )}
      </group>

      {/* Stroke Travel Measurement Indicators */}
      <TravelMarker
        x={restLoadX + 0.46}
        y1={pivotY}
        y2={pivotY + (tiltsClockwise ? solved.loadDistance * S : solved.loadDistance * S)}
        colour={ENERGY_COLOURS.workOut}
        label={`load rises ${(solved.loadDistance * 100).toFixed(0)} cm`}
      />
      <TravelMarker
        x={restEffortX - 0.46}
        y1={pivotY}
        y2={pivotY + (tiltsClockwise ? -solved.effortDistance * S : solved.effortDistance * S)}
        colour={ENERGY_COLOURS.workIn}
        label={`${tiltsClockwise ? "effort drops" : "effort rises"} ${(solved.effortDistance * 100).toFixed(0)} cm`}
      />
    </group>
  );
}

/** Static vertical travel span marker with clean end caps and metric readout. */
function TravelMarker({ x, y1, y2, colour, label }) {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  const dy = hi - lo;
  if (dy < 0.02) return null;

  return (
    <group>
      <Line
        points={[
          [x, lo, 0],
          [x, hi, 0],
        ]}
        color={colour}
        lineWidth={2.4}
        dashed
        dashSize={0.08}
        gapSize={0.04}
      />
      {[lo, hi].map((y) => (
        <Line
          key={y}
          points={[
            [x - 0.12, y, 0],
            [x + 0.12, y, 0],
          ]}
          color={colour}
          lineWidth={2}
        />
      ))}
      <SceneLabel position={[x + 0.55, (lo + hi) / 2, 0]} tone="text-ink-200">
        {label}
      </SceneLabel>
    </group>
  );
}

// ─── Block and tackle ───────────────────────────────────────────────

/**
 * Generates verified, non-crossing multi-sheave rope path coordinates.
 * Supports 1, 2, 3, and 4 supporting ropes matching real industrial block and tackle reeving.
 */
function generateRopePoints(n, topY, lowerY, spread, sheaveR, pullX, pullY) {
  const pts = [];

  const addTopArc = (cx, cz = 0, leftToRight = true) => {
    const steps = 8;
    for (let i = 0; i <= steps; i += 1) {
      const frac = i / steps;
      const angle = leftToRight ? Math.PI - frac * Math.PI : frac * Math.PI;
      pts.push([cx + Math.cos(angle) * sheaveR, topY + Math.sin(angle) * sheaveR, cz]);
    }
  };

  const addBottomArc = (cx, cz = 0, leftToRight = true) => {
    const steps = 8;
    for (let i = 0; i <= steps; i += 1) {
      const frac = i / steps;
      const angle = leftToRight ? Math.PI + frac * Math.PI : 2 * Math.PI - frac * Math.PI;
      pts.push([cx + Math.cos(angle) * sheaveR, lowerY + Math.sin(angle) * sheaveR, cz]);
    }
  };

  const sheavesTop = Math.ceil(n / 2);
  const sheavesBottom = Math.floor(n / 2);
  const topX = (i) => (sheavesTop > 1 ? (i / (sheavesTop - 1) - 0.5) * spread : 0);
  const botX = (i) => (sheavesBottom > 1 ? (i / (sheavesBottom - 1) - 0.5) * spread : 0);

  if (n === 1) {
    // Single overhead pulley: rope connects directly to load, routes over top sheave, drops to hand
    pts.push([topX(0) - sheaveR, lowerY + 0.1, 0]);
    pts.push([topX(0) - sheaveR, topY, 0]);
    addTopArc(topX(0), 0, true);
    pts.push([topX(0) + sheaveR, topY, 0]);
    pts.push([pullX, pullY, 0]);
  } else if (n === 2) {
    // 2 ropes (1 top sheave, 1 bottom sheave): becket anchor on upper block
    pts.push([topX(0) - sheaveR, topY - 0.24, 0.04]);
    pts.push([botX(0) - sheaveR, lowerY, 0.04]);
    addBottomArc(botX(0), 0.04, true);
    pts.push([botX(0) + sheaveR, lowerY, 0.04]);
    pts.push([topX(0) - sheaveR, topY, -0.04]);
    addTopArc(topX(0), -0.04, true);
    pts.push([topX(0) + sheaveR, topY, -0.04]);
    pts.push([pullX, pullY, 0]);
  } else if (n === 3) {
    // 3 ropes (2 top sheaves, 1 bottom sheave): becket anchor on lower block
    pts.push([botX(0), lowerY + 0.24, 0.04]);
    pts.push([topX(0) - sheaveR, topY, 0.04]);
    addTopArc(topX(0), 0.04, true);
    pts.push([topX(0) + sheaveR, topY, 0.04]);
    pts.push([botX(0) - sheaveR, lowerY, -0.04]);
    addBottomArc(botX(0), -0.04, true);
    pts.push([botX(0) + sheaveR, lowerY, -0.04]);
    pts.push([topX(1) - sheaveR, topY, 0]);
    addTopArc(topX(1), 0, true);
    pts.push([topX(1) + sheaveR, topY, 0]);
    pts.push([pullX, pullY, 0]);
  } else {
    // 4 ropes (2 top sheaves, 2 bottom sheaves): authentic non-crossing reeving
    // Fall 1: top becket down to lower sheave 0 inner rim
    pts.push([0, topY - 0.24, 0.04]);
    pts.push([botX(0) + sheaveR, lowerY, 0.04]);
    addBottomArc(botX(0), 0.04, false);
    // Fall 2: lower sheave 0 outer rim straight UP to top sheave 0 outer rim
    pts.push([botX(0) - sheaveR, lowerY, 0.04]);
    pts.push([topX(0) - sheaveR, topY, -0.04]);
    addTopArc(topX(0), -0.04, true);
    // Fall 3: top sheave 0 inner rim down to lower sheave 1 outer rim
    pts.push([topX(0) + sheaveR, topY, -0.04]);
    pts.push([botX(1) + sheaveR, lowerY, -0.04]);
    addBottomArc(botX(1), -0.04, false);
    // Fall 4: lower sheave 1 inner rim straight UP to top sheave 1 inner rim
    pts.push([botX(1) - sheaveR, lowerY, -0.04]);
    pts.push([topX(1) - sheaveR, topY, 0.04]);
    addTopArc(topX(1), 0.04, true);
    // Hauling Fall: top sheave 1 outer rim down to pull handle
    pts.push([topX(1) + sheaveR, topY, 0.04]);
    pts.push([pullX, topY + 0.05, 0]);
    pts.push([pullX, pullY, 0]);
  }

  return pts;
}

/**
 * Precision Block and Tackle apparatus.
 *
 * Performance: Dynamic transforms (lower block, hauling handle, and rope geometry)
 * are driven directly in `useFrame` via buffer geometry attributes, preventing
 * React re-renders and memory allocations during animation.
 */
function Pulley({ solved, running, speed, loadN }) {
  const n = solved.ropes;
  const topY = BENCH_Y + 4.5;
  const drop = 2.2;
  const maxRise = solved.loadDistance * S;
  const sheaveR = 0.22;
  const spread = Math.max(0.55, 0.38 * (n - 1));

  const sheavesTop = Math.ceil(n / 2);
  const sheavesBottom = Math.floor(n / 2);

  const topX = (i) => (sheavesTop > 1 ? (i / (sheavesTop - 1) - 0.5) * spread : 0);
  const botX = (i) => (sheavesBottom > 1 ? (i / (sheavesBottom - 1) - 0.5) * spread : 0);

  const maxPullTravel = solved.effortDistance * S;
  const pullX = (sheavesTop > 1 ? spread / 2 : 0) + sheaveR + 0.55;

  const tRef = useRef(0);
  const lowerGroupRef = useRef(null);
  const pullHandleRef = useRef(null);
  const ropeGeomRef = useRef(null);

  useFrame((_, rawDelta) => {
    if (running && speed > 0) {
      const delta = Math.min(rawDelta, 1 / 30);
      tRef.current += delta * speed;
    }
    const phase = (1 - Math.cos((tRef.current / STROKE_PERIOD) * Math.PI * 2)) / 2;
    const rise = maxRise * phase;
    const lowerY = topY - drop + rise;
    const pullTravel = maxPullTravel * phase;
    const pullY = topY - 1.1 - pullTravel;

    if (lowerGroupRef.current) {
      lowerGroupRef.current.position.y = lowerY;
    }

    if (pullHandleRef.current) {
      pullHandleRef.current.position.y = pullY;
    }

    if (ropeGeomRef.current) {
      const pts = generateRopePoints(n, topY, lowerY, spread, sheaveR, pullX, pullY);
      ropeGeomRef.current.setFromPoints(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    }
  });

  return (
    <group>
      {/* ── Realistic Laboratory Gantry Rigging Frame ── */}
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
      <mesh position={[0, topY + 0.36, 0]}>
        <boxGeometry args={[4.8, 0.03, 0.28]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
      </mesh>

      {/* ── Upper Pulley Block (Fixed) ── */}
      <mesh position={[0, topY + 0.26, 0]}>
        <torusGeometry args={[0.1, 0.024, 12, 24]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
      </mesh>
      <RoundedBox position={[0, topY, 0]} args={[spread + 0.58, 0.44, 0.28]} radius={0.04} smoothness={3}>
        <meshStandardMaterial color="#64748b" roughness={0.35} metalness={0.65} />
      </RoundedBox>
      <mesh position={[0, topY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.34, 24]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
      </mesh>
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

      {/* Exit guide sheave */}
      <group position={[pullX - 0.15, topY + 0.08, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.035, 10, 24]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
        </mesh>
      </group>

      {/* ── Lower Pulley Block (Moving, driven via useFrame ref) ── */}
      <group ref={lowerGroupRef} position={[0, topY - drop, 0]}>
        <RoundedBox args={[spread + 0.52, 0.42, 0.28]} radius={0.04} smoothness={3}>
          <meshStandardMaterial color="#64748b" roughness={0.35} metalness={0.65} />
        </RoundedBox>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.34, 24]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
        </mesh>
        <mesh position={[botX(0), 0.24, 0]}>
          <torusGeometry args={[0.05, 0.015, 8, 16]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.85} />
        </mesh>

        {/* Lower Sheaves */}
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
        <mesh position={[0, -0.49, 0]}>
          <torusGeometry args={[0.05, 0.016, 8, 16]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.85} />
        </mesh>

        {/* ── Suspended Safe Load (moves synchronously with lower block) ── */}
        <group position={[0, -1.15, 0]}>
          <RoundedBox args={[1.15, 1.15, 0.95]} radius={0.06} smoothness={3}>
            <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.65} />
          </RoundedBox>

          <mesh position={[0, 0.65, 0]}>
            <torusGeometry args={[0.12, 0.028, 10, 24]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.05, 16]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.85} />
          </mesh>

          <mesh position={[0, 0, 0.48]}>
            <boxGeometry args={[0.96, 0.96, 0.02]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.55} />
          </mesh>

          {[-0.52, 0.52].map((cx) =>
            [-0.52, 0.52].map((cy) => (
              <mesh key={`c-${cx}-${cy}`} position={[cx, cy, 0.485]}>
                <boxGeometry args={[0.1, 0.1, 0.025]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.9} />
              </mesh>
            )),
          )}

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
      </group>

      {/* ── Native Three.js Line with In-Place BufferGeometry ── */}
      <line>
        <bufferGeometry ref={ropeGeomRef} />
        <lineBasicMaterial color={ENERGY_COLOURS.workIn} linewidth={2.6} />
      </line>

      {/* ── Hauling Effort Grip Handle (driven via useFrame ref) ── */}
      <group ref={pullHandleRef} position={[pullX, topY - 1.1, 0]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.042, 0.042, 0.28, 18]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.03, 18]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.03, 18]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>

      <SceneLabel position={[0, topY + 0.86, 0]} accent>
        {`${n} rope${n === 1 ? "" : "s"} supporting the load`}
      </SceneLabel>

      {/* Travel indicators */}
      <TravelMarker
        x={1.35}
        y1={topY - drop - 1.15}
        y2={topY - drop - 1.15 + maxRise}
        colour={ENERGY_COLOURS.workOut}
        label={`safe rises ${(solved.loadDistance * 100).toFixed(0)} cm`}
      />
      <TravelMarker
        x={pullX + 0.45}
        y1={topY - 1.1}
        y2={topY - 1.1 - maxPullTravel}
        colour={ENERGY_COLOURS.workIn}
        label={`rope pulled ${(solved.effortDistance * 100).toFixed(0)} cm`}
      />
    </group>
  );
}

// ─── Right-Hand Sidebar HUD for Work & Advantage Graph ───────────────

function SimpleMachinesSidebar({ solved, loadN }) {
  const [collapsed, setCollapsed] = useState(false);

  const workMax = Math.max(160, Math.max(solved.workIn, solved.workOut) * 1.12);
  const inPct = Math.min(100, Math.max(0, (solved.workIn / workMax) * 100));
  const outPct = Math.min(100, Math.max(0, (solved.workOut / workMax) * 100));
  const wastedPct = Math.min(100, Math.max(0, (solved.wasted / workMax) * 100));

  const maxForce = Math.max(loadN, solved.effortForce, 1);
  const effortPct = Math.min(100, Math.max(2, (solved.effortForce / maxForce) * 100));
  const loadPct = Math.min(100, Math.max(2, (loadN / maxForce) * 100));

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-20 flex w-76 sm:w-80 flex-col gap-2.5">
      <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/90 p-3.5 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/70 pb-2.5">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-duck-400" />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Work & Mechanical Advantage
              </h3>
              <p className="text-[11px] text-slate-400">{solved.machine.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="mt-3 space-y-3.5">
            {/* Work per stroke bar chart */}
            <div className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-2.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
                <span>WORK PER STROKE</span>
                <span className="font-mono text-slate-400">Scale: {workMax.toFixed(0)} J</span>
              </div>

              <div className="mt-2.5 space-y-2">
                {/* Work In */}
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium text-amber-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                      Work In (Effort × Distance)
                    </span>
                    <span className="font-mono font-semibold text-amber-300">
                      {solved.workIn.toFixed(1)} J
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-700/80">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${inPct}%` }}
                    />
                  </div>
                </div>

                {/* Work Out */}
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                      Work Out (Load × Lift)
                    </span>
                    <span className="font-mono font-semibold text-emerald-300">
                      {solved.workOut.toFixed(1)} J
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-700/80">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${outPct}%` }}
                    />
                  </div>
                </div>

                {/* Friction / Heat */}
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium text-rose-300">
                      <span className="h-2 w-2 rounded-full bg-rose-400 inline-block" />
                      Friction / Heat Wasted
                    </span>
                    <span className="font-mono font-semibold text-rose-300">
                      {solved.wasted.toFixed(1)} J
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-700/80">
                    <div
                      className="h-full rounded-full bg-rose-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${wastedPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Ratios Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-700/60 bg-slate-800/60 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Mech. Adv.</div>
                <div className="mt-0.5 text-sm font-bold text-duck-300 font-mono">
                  {solved.mechanicalAdvantage.toFixed(2)}×
                </div>
                <div className="text-[9px] text-slate-400 font-mono">F_load / F_effort</div>
              </div>

              <div className="rounded-lg border border-slate-700/60 bg-slate-800/60 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Velocity Ratio</div>
                <div className="mt-0.5 text-sm font-bold text-sky-300 font-mono">
                  {solved.velocityRatio.toFixed(2)}×
                </div>
                <div className="text-[9px] text-slate-400 font-mono">d_effort / d_load</div>
              </div>

              <div className="rounded-lg border border-slate-700/60 bg-slate-800/60 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Efficiency</div>
                <div className="mt-0.5 text-sm font-bold text-emerald-300 font-mono">
                  {(solved.efficiency * 100).toFixed(0)}%
                </div>
                <div className="text-[9px] text-slate-400 font-mono">MA / VR</div>
              </div>
            </div>

            {/* Live Forces & Travel with Comparative Bar Gauge */}
            <div className="rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2.5 text-[11px] space-y-2">
              <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <span>FORCE COMPARISON</span>
                <span className="font-mono text-slate-400">Max: {maxForce.toFixed(0)} N</span>
              </div>

              {/* Comparative Visual Bars */}
              <div className="space-y-1.5 pt-0.5">
                <div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-amber-300 font-medium">Effort Applied</span>
                    <span className="font-mono font-semibold text-amber-300">
                      {solved.effortForce.toFixed(1)} N
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/80">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${effortPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-emerald-300 font-medium">Load Lifted</span>
                    <span className="font-mono font-semibold text-emerald-300">
                      {loadN.toFixed(0)} N
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/80">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-[width] duration-300 ease-out"
                      style={{ width: `${loadPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-700/50 pt-2 space-y-1 text-slate-400">
                <div className="flex justify-between items-center">
                  <span>Effort Travel Sweep</span>
                  <span className="font-mono text-slate-200">
                    {(solved.effortDistance * 100).toFixed(0)} cm
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Load Lift Height</span>
                  <span className="font-mono text-slate-200">
                    {(solved.loadDistance * 100).toFixed(0)} cm
                  </span>
                </div>
              </div>
            </div>

            {/* Energy Conservation Direct Insight */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-200">
              <span className="font-semibold text-amber-300">Core Physics Law: </span>
              Simple machines trade effort force for distance. Work in always exceeds or equals work out—no machine creates free energy.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Precision Laboratory Dynamometer Test Stand ────────────────────

function DynamometerTestStand({ position, solved, forceScale, effortDirection, effortLabel }) {
  return (
    <group position={position}>
      {/* Heavy cast-iron base plate bolted to workbench */}
      <RoundedBox position={[0, 0.04, 0]} args={[1.5, 0.08, 0.6]} radius={0.02} smoothness={3}>
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.8} />
      </RoundedBox>

      {/* Hex mounting bolts */}
      {[-0.64, 0.64].map((bx) =>
        [-0.22, 0.22].map((bz) => (
          <mesh key={`bolt-${bx}-${bz}`} position={[bx, 0.085, bz]}>
            <cylinderGeometry args={[0.025, 0.025, 0.02, 6]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.9} />
          </mesh>
        )),
      )}

      {/* Twin structural upright chrome columns */}
      {[-0.66, 0.66].map((colX) => (
        <mesh key={`col-${colX}`} position={[colX, 1.25, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 2.4, 16]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.15} metalness={0.85} />
        </mesh>
      ))}

      {/* Top and mid crossbars */}
      <mesh position={[0, 2.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.024, 0.024, 1.36, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 1.36, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.85} />
      </mesh>

      {/* Instrument slate backplate */}
      <mesh position={[0, 1.3, -0.02]}>
        <boxGeometry args={[1.28, 2.2, 0.03]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.3, -0.004]}>
        <boxGeometry args={[1.24, 2.16, 0.005]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Calibration graduation scale lines */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((gy) => (
        <group key={`grad-${gy}`} position={[0, 1.3 + gy, 0.002]}>
          <mesh position={[-0.38, 0, 0]}>
            <boxGeometry args={[0.3, 0.006, 0.002]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0.38, 0, 0]}>
            <boxGeometry args={[0.3, 0.006, 0.002]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
        </group>
      ))}

      {/* Center divider bar */}
      <mesh position={[0, 1.3, 0.01]}>
        <boxGeometry args={[0.012, 2.1, 0.01]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* Stand Header Placard */}
      <mesh position={[0, 2.34, 0.01]}>
        <boxGeometry args={[1.15, 0.12, 0.015]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.6} />
      </mesh>
      <SceneLabel position={[0, 2.34, 0.03]} tone="text-slate-400">
        FORCE TRANSDUCERS
      </SceneLabel>

      {/* Channel 1: Effort Load Cell & Calibrated Force Vector */}
      <group position={[-0.38, 1.3, 0.04]}>
        {/* Load cell transducer housing */}
        <mesh position={[0, 0.82, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.14, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.82, 0.055]}>
          <boxGeometry args={[0.08, 0.05, 0.01]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.5} />
        </mesh>

        <ForceVector
          at={[0, 0, 0]}
          direction={effortDirection}
          newtons={solved.effortForce}
          scale={forceScale}
          colour={ENERGY_COLOURS.workIn}
          symbol="effort"
        />

        <SceneLabel position={[0, -0.96, 0]} tone="text-amber-300">
          {effortLabel}
        </SceneLabel>
      </group>

      {/* Channel 2: Load Force Transducer & Calibrated Vector */}
      <group position={[0.38, 1.3, 0.04]}>
        {/* Load cell transducer housing */}
        <mesh position={[0, 0.82, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.14, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.82, 0.055]}>
          <boxGeometry args={[0.08, 0.05, 0.01]} />
          <meshStandardMaterial color="#34d399" roughness={0.3} metalness={0.5} />
        </mesh>

        <ForceVector
          at={[0, 0, 0]}
          direction={[0, 1, 0]}
          newtons={solved.loadN}
          scale={forceScale}
          colour={ENERGY_COLOURS.workOut}
          symbol="load"
        />

        <SceneLabel position={[0, -0.96, 0]} tone="text-emerald-300">
          it lifts
        </SceneLabel>
      </group>
    </group>
  );
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

  const lever = isLever(machineType);

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
    return Math.min(LIFT_M, 0.35 * layout.loadArm);
  }, [lever, machineType, armPosition]);

  const solved = useMemo(
    () => solveMachine({ type: machineType, p: armPosition, sheaves, loadN, lift }),
    [machineType, armPosition, sheaves, loadN, lift],
  );

  const dynamicSpeed = useMemo(() => {
    const inertiaFactor = Math.pow(Math.max(loadN, 20) / 200, 0.22);
    return Math.max(0.25, speed / inertiaFactor);
  }, [speed, loadN]);

  const effortDirection = machineType === "lever2" || machineType === "lever3" ? [0, 1, 0] : [0, -1, 0];
  const effortLabel = machineType === "lever2" || machineType === "lever3" ? "you lift" : machineType === "pulley" ? "you pull" : "you push";

  const forceScale = useMemo(
    () => 1.6 / Math.max(650, solved.loadN, solved.effortForce),
    [solved.loadN, solved.effortForce],
  );

  return (
    <div className="relative w-full h-full">
      <SceneCanvas
        camera={{ position: [0.2, 1.3, 14.6], fov: 46 }}
        controls={{ minDistance: 5, maxDistance: 32, target: [0.2, 0.3, 0] }}
        lights={{ ambient: 0.54, keyLight: 0.95 }}
      >
        <Grid
          position={[0, BENCH_Y - 0.001, 0]}
          args={[28, 14]}
          cellSize={0.5}
          cellColor="#334155"
          sectionSize={2}
          sectionColor="#475569"
          fadeDistance={36}
          infiniteGrid={false}
        />

        {/* Expanded laboratory workbench base - widened to the left */}
        <RoundedBox position={[-0.4, BENCH_Y - 0.12, 0]} args={[10.2, 0.24, 2.5]} radius={0.03} smoothness={3} receiveShadow>
          <meshStandardMaterial color="#64748b" roughness={0.45} metalness={0.35} />
        </RoundedBox>

        {/* Inset top workplate in bright brushed aluminum */}
        <mesh position={[-0.4, BENCH_Y + 0.005, 0]} receiveShadow>
          <boxGeometry args={[10.0, 0.015, 2.3]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.65} />
        </mesh>

        {/* Bench support pedestals across the widened base */}
        {[-5.0, -0.4, 4.2].map((fx) =>
          [-0.95, 0.95].map((fz) => (
            <mesh key={`leg-${fx}-${fz}`} position={[fx, BENCH_Y - 0.28, fz]}>
              <cylinderGeometry args={[0.1, 0.13, 0.12, 16]} />
              <meshStandardMaterial color="#475569" roughness={0.35} metalness={0.7} />
            </mesh>
          )),
        )}

        {/* Dedicated Laboratory Dynamometer Test Stand on the expanded left base */}
        <DynamometerTestStand
          position={[-3.75, BENCH_Y + 0.05, 0.15]}
          solved={solved}
          forceScale={forceScale}
          effortDirection={effortDirection}
          effortLabel={effortLabel}
        />

        <group position={[0.7, 0, 0]}>
          {lever ? (
            <Lever
              type={machineType}
              solved={solved}
              running={running}
              speed={dynamicSpeed}
              loadN={loadN}
              forceScale={forceScale}
            />
          ) : (
            <Pulley
              solved={solved}
              running={running}
              speed={dynamicSpeed}
              loadN={loadN}
            />
          )}
        </group>

        <SceneLabel position={[0.2, BENCH_Y + 5.9, 0]} accent>
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

      {/* Right-Hand Sidebar Layout for Work & Advantage Graph */}
      <SimpleMachinesSidebar solved={solved} loadN={loadN} />
    </div>
  );
}
