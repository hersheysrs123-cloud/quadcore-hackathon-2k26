"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE, SceneLabel, VectorArrow, clamp } from "@/components/visualizations/scene-kit";

// ─── Free-body diagrams and live plots ──────────────────────────────
// The pieces the two statics scenes — the friction ramp and the spring — have
// in common: one rigid body, a set of forces drawn on it to a shared scale,
// and a graph beside it that fills in as the experiment runs.
//
// Sharing them is not only about saving lines. A free-body diagram is only
// readable if a newton is the same length in every arrow on the screen, and
// if the same quantity is the same colour in both scenes — neither of which
// survives being re-decided in two files.
// ─────────────────────────────────────────────────────────────────────

/**
 * One colour per quantity, used by the arrows, the graph and the HUD's colour
 * key alike.
 *
 * The two components of the weight are deliberately NOT the same colour as
 * each other, because the entire exercise on a slope is telling them apart —
 * but both are warm, so they still read as halves of the red weight vector
 * they were resolved from.
 */
export const FORCE_COLOURS = {
  weight: "#fb7185",
  weightParallel: "#fb923c",
  weightPerpendicular: "#a78bfa",
  normal: "#38bdf8",
  friction: "#2dd4bf",
  applied: "#fbbf24",
  net: "#34d399",
  velocity: "#e8ebf0",
  spring: "#38bdf8",
  limit: "#f43f5e",
};

/** Longest arrow in the diagram, in world units. */
const TARGET_ARROW = 1.75;
/** Shorter than this and an arrowhead is all you would see, so draw nothing. */
const MIN_ARROW = 0.13;

/**
 * A scale factor that keeps the biggest force in the diagram a constant length.
 *
 * Fixing the scale instead would send the arrows off the screen the moment the
 * mass slider moves, and scaling each arrow to its own length would destroy
 * the only thing a free-body diagram is for: comparing magnitudes at a glance.
 * Normalising to the largest force preserves every ratio and never overflows.
 */
export function useForceScale(magnitudes, target = TARGET_ARROW) {
  return useMemo(() => {
    let max = 0;
    for (const m of magnitudes) {
      const v = Math.abs(Number(m) || 0);
      if (v > max) max = v;
    }
    return max > 1e-6 ? target / max : 0;
  }, [magnitudes, target]);
}

/**
 * One force, drawn from the body's centre of mass in the direction it acts,
 * with its magnitude printed on the tip.
 *
 * `newtons` may be signed: a negative value flips the arrow rather than
 * drawing it backwards to a negative length, which is what lets friction and
 * the applied pull reverse without any caller having to work out a direction.
 */
export function ForceVector({
  at,
  direction,
  newtons,
  scale,
  colour,
  symbol,
  showValue = true,
  labelOffset = 0.4,
}) {
  const signed = Number(newtons) || 0;
  const length = Math.abs(signed) * scale;
  if (!(length > MIN_ARROW)) return null;

  const sign = signed < 0 ? -1 : 1;
  const to = [
    at[0] + direction[0] * length * sign,
    at[1] + direction[1] * length * sign,
    at[2] + direction[2] * length * sign,
  ];

  return (
    <VectorArrow
      from={at}
      to={to}
      color={colour}
      radius={0.045}
      headLength={0.24}
      headRadius={0.12}
      labelOffset={labelOffset}
      label={showValue ? `${symbol} ${Math.abs(signed).toFixed(1)} N` : symbol}
    />
  );
}

/**
 * The dashed guide lines that show a vector being resolved into two
 * components — the parallelogram a textbook draws in pencil.
 *
 * Without them the components look like extra forces that appeared from
 * nowhere, rather than the one weight vector written two different ways.
 */
export function ResolutionGuides({ at, tip, componentTips, colour = PALETTE.slate }) {
  return (
    <group>
      {componentTips.map((corner, i) => (
        <Line
          key={i}
          points={[corner, tip]}
          color={colour}
          lineWidth={1.3}
          transparent
          opacity={0.55}
          dashed
          dashSize={0.11}
          gapSize={0.09}
        />
      ))}
    </group>
  );
}

// ─── Live graph panel ───────────────────────────────────────────────

/**
 * A 2D plot standing in the 3D scene: axes, gridlines, one or more series and
 * an optional marker at "you are here".
 *
 * Data is given in real units and mapped here, so a caller never converts
 * newtons or metres into world space by hand — the mistake that makes a
 * plotted point disagree with the number printed beside it.
 */
export function GraphPanel({
  position = [0, 0, 0],
  width = 4,
  height = 2.6,
  xMax = 1,
  yMax = 1,
  xMin = 0,
  yMin = 0,
  series = [],
  marker,
  guides = [],
  title,
  xLabel,
  yLabel,
  xTicks = 4,
  yTicks = 3,
}) {
  const toWorld = useCallback(
    ([x, y]) => [
      ((clamp(x, xMin, xMax) - xMin) / Math.max(xMax - xMin, 1e-9)) * width,
      ((clamp(y, yMin, yMax) - yMin) / Math.max(yMax - yMin, 1e-9)) * height,
      0,
    ],
    [width, height, xMax, yMax, xMin, yMin],
  );

  const grid = useMemo(() => {
    const lines = [];
    for (let i = 1; i <= xTicks; i += 1) {
      const x = (i / xTicks) * width;
      lines.push([
        [x, 0, 0],
        [x, height, 0],
      ]);
    }
    for (let i = 1; i <= yTicks; i += 1) {
      const y = (i / yTicks) * height;
      lines.push([
        [0, y, 0],
        [width, y, 0],
      ]);
    }
    return lines;
  }, [width, height, xTicks, yTicks]);

  return (
    <group position={position}>
      {/* Backing panel, so the plot reads against the scene rather than
          floating in it. */}
      <mesh position={[width / 2, height / 2, -0.04]}>
        <planeGeometry args={[width + 0.7, height + 0.9]} />
        <meshBasicMaterial color="#0d121c" transparent opacity={0.88} />
      </mesh>

      {grid.map((pts, i) => (
        <Line key={i} points={pts} color={PALETTE.line} lineWidth={1} transparent opacity={0.4} />
      ))}

      {/* Axes. */}
      <Line
        points={[
          [0, height, 0],
          [0, 0, 0],
          [width, 0, 0],
        ]}
        color={PALETTE.slate}
        lineWidth={1.8}
      />

      {guides.map((g, i) => (
        <Line
          key={`g${i}`}
          points={g.points.map(toWorld)}
          color={g.colour}
          lineWidth={g.lineWidth ?? 1.4}
          transparent
          opacity={g.opacity ?? 0.8}
          dashed
          dashSize={0.1}
          gapSize={0.08}
        />
      ))}

      {series.map((s, i) =>
        s.points.length > 1 ? (
          <Line
            key={`s${i}`}
            points={s.points.map(toWorld)}
            color={s.colour}
            lineWidth={s.lineWidth ?? 2.6}
            transparent
            opacity={s.opacity ?? 1}
            dashed={Boolean(s.dashed)}
            dashSize={0.12}
            gapSize={0.1}
          />
        ) : null,
      )}

      {marker && (
        <mesh position={toWorld(marker.at)}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial
            color={marker.colour}
            emissive={marker.colour}
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      )}

      {title && (
        <SceneLabel position={[width / 2, height + 0.42, 0]} accent>
          {title}
        </SceneLabel>
      )}
      {xLabel && (
        <SceneLabel position={[width / 2, -0.42, 0]} tone="text-ink-400">
          {xLabel}
        </SceneLabel>
      )}
      {yLabel && (
        <SceneLabel position={[-0.72, height / 2, 0]} tone="text-ink-400">
          {yLabel}
        </SceneLabel>
      )}
    </group>
  );
}

// ─── Rolling time series ────────────────────────────────────────────

/**
 * A fixed-length ring of samples for a live trace.
 *
 * The buffer is a ref and only the redraw is throttled, because pushing a
 * sample into React state every frame re-renders the whole scene sixty times a
 * second to move a line by one pixel.
 */
export function useRollingTrace(capacity = 220, hz = 24) {
  const buffer = useRef([]);
  const since = useRef(0);
  const [, bump] = useState(0);

  const push = useCallback(
    (x, y, delta) => {
      const b = buffer.current;
      b.push([x, y]);
      if (b.length > capacity) b.splice(0, b.length - capacity);
      since.current += delta;
      if (since.current >= 1 / hz) {
        since.current = 0;
        bump((n) => n + 1);
      }
    },
    [capacity, hz],
  );

  const reset = useCallback(() => {
    buffer.current = [];
    since.current = 0;
    bump((n) => n + 1);
  }, []);

  return { points: buffer.current, push, reset };
}

/**
 * Drives a body's motion from a stepper function and reports it back on a
 * throttle.
 *
 * Every scene that animates a rigid body needs the same three things — a
 * fixed-ish timestep, a guard against the enormous `delta` a backgrounded tab
 * hands back on return, and a readout that updates slowly enough to read.
 */
export function useBodyMotion({ step, onSample, running = true, sampleHz = 12 }) {
  const motion = useRef({ position: 0, velocity: 0 });
  const since = useRef(0);

  useFrame((_, delta) => {
    // A tab that has been hidden for a minute reports a minute-long frame.
    // Integrating that in one go teleports the body through the whole scene.
    const dt = Math.min(delta, 0.05);
    if (running) motion.current = step(motion.current, dt);

    since.current += delta;
    if (since.current >= 1 / sampleHz) {
      since.current = 0;
      onSample(motion.current, dt);
    }
  });

  return motion;
}

/** Unit vectors along and out of a slope of `angleDeg`, in the XY plane. */
export function slopeFrame(angleDeg) {
  const t = (angleDeg * Math.PI) / 180;
  return {
    /** Up the slope. */
    up: [Math.cos(t), Math.sin(t), 0],
    /** Out of the surface. */
    out: [-Math.sin(t), Math.cos(t), 0],
    /** Straight down, for the weight. */
    down: [0, -1, 0],
    radians: t,
  };
}

/** Point on the slope, `along` metres from the hinge and `lift` above it. */
export function onSlope(origin, frame, along, lift = 0) {
  return [
    origin[0] + frame.up[0] * along + frame.out[0] * lift,
    origin[1] + frame.up[1] * along + frame.out[1] * lift,
    origin[2],
  ];
}

/** An arc of `segments` points, for drawing the angle at the hinge. */
export function arcPoints(origin, radius, fromRad, toRad, segments = 32) {
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = fromRad + ((toRad - fromRad) * i) / segments;
    pts.push([origin[0] + Math.cos(a) * radius, origin[1] + Math.sin(a) * radius, origin[2]]);
  }
  return pts;
}

/** A right-triangle prism — the body of the ramp under its sliding surface. */
export function useWedgeGeometry(baseLength, height, depth) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    // A hair of width even when vertical, so the extrude never degenerates.
    const b = Math.max(baseLength, 0.02);
    shape.moveTo(0, 0);
    shape.lineTo(b, 0);
    shape.lineTo(b, height);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  }, [baseLength, height, depth]);

  // Every angle change builds a new prism, so the old one has to go with it —
  // dragging the slider through its range would otherwise leak a buffer per
  // degree for as long as the scene is open.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return geometry;
}
