"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Billboard, Html } from "@react-three/drei";
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
  maxLength,
}) {
  const signed = Number(newtons) || 0;
  let length = Math.abs(signed) * scale;
  if (maxLength !== undefined) length = Math.min(length, maxLength);
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
  const validTips = useMemo(() => {
    if (!tip || !Array.isArray(componentTips)) return [];
    return componentTips.filter((corner) => {
      if (!corner) return false;
      const dxTip = corner[0] - tip[0];
      const dyTip = corner[1] - tip[1];
      const dzTip = (corner[2] ?? 0) - (tip[2] ?? 0);
      const dTip = Math.sqrt(dxTip * dxTip + dyTip * dyTip + dzTip * dzTip);
      if (!Number.isFinite(dTip) || dTip < 0.08) return false;

      if (at) {
        const dxAt = corner[0] - at[0];
        const dyAt = corner[1] - at[1];
        const dzAt = (corner[2] ?? 0) - (at[2] ?? 0);
        const dAt = Math.sqrt(dxAt * dxAt + dyAt * dyAt + dzAt * dzAt);
        if (!Number.isFinite(dAt) || dAt < 0.08) return false;
      }
      return true;
    });
  }, [at, tip, componentTips]);

  if (validTips.length === 0) return null;

  return (
    <group>
      {validTips.map((corner, i) => (
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
  bgColour = "#1e2638",
  borderColour = "#38455c",
  gridColour = "#334155",
  axisColour = "#94a3b8",
  billboard = true,
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

  const yZero = ((clamp(0, yMin, yMax) - yMin) / Math.max(yMax - yMin, 1e-9)) * height;
  const xZero = ((clamp(0, xMin, xMax) - xMin) / Math.max(xMax - xMin, 1e-9)) * width;

  const centerX = position[0] + width / 2;
  const centerY = position[1] + height / 2;
  const centerZ = position[2] ?? 0;

  const content = (
    <group position={billboard ? [-width / 2, -height / 2, 0] : [0, 0, 0]}>
      {/* Backing panel: lighter, refined slate-blue surface with 3D chassis */}
      <mesh position={[width / 2, height / 2, -0.04]}>
        <boxGeometry args={[width + 0.8, height + 1.0, 0.04]} />
        <meshBasicMaterial color={bgColour} transparent opacity={0.94} side={THREE.DoubleSide} />
      </mesh>

      {/* Sleek outer panel border */}
      <Line
        points={[
          [-0.35, -0.45, -0.018],
          [width + 0.35, -0.45, -0.018],
          [width + 0.35, height + 0.45, -0.018],
          [-0.35, height + 0.45, -0.018],
          [-0.35, -0.45, -0.018],
        ]}
        color={borderColour}
        lineWidth={1.5}
        transparent
        opacity={0.8}
      />

      {grid.map((pts, i) => (
        <Line key={i} points={pts} color={gridColour} lineWidth={1} transparent opacity={0.5} />
      ))}

      {/* Subtle plot border enclosing the grid area */}
      <Line
        points={[
          [0, 0, 0],
          [width, 0, 0],
          [width, height, 0],
          [0, height, 0],
          [0, 0, 0],
        ]}
        color={gridColour}
        lineWidth={1.2}
        transparent
        opacity={0.45}
      />

      {/* Main mathematical axes (x = 0, y = 0) */}
      <Line
        points={[
          [xZero, 0, 0],
          [xZero, height, 0],
        ]}
        color={axisColour}
        lineWidth={1.5}
      />
      {yZero > 0.05 && yZero < height - 0.05 ? (
        <Line
          points={[
            [0, yZero, 0],
            [width, yZero, 0],
          ]}
          color="#64748b"
          lineWidth={1.2}
          dashed
          dashSize={0.08}
          gapSize={0.06}
          transparent
          opacity={0.6}
        />
      ) : (
        <Line
          points={[
            [0, yZero, 0],
            [width, yZero, 0],
          ]}
          color={axisColour}
          lineWidth={1.5}
        />
      )}

      {/* Axis numerical tick labels */}
      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const frac = i / xTicks;
        const xPos = frac * width;
        const val = xMin + frac * (xMax - xMin);
        const formatted = Number.isInteger(val) ? `${val}s` : `${val.toFixed(1)}s`;
        return (
          <Html key={`xtick-${i}`} position={[xPos, -0.16, 0.01]} center style={{ pointerEvents: "none" }}>
            <span className="font-mono text-[9px] text-ink-400 select-none whitespace-nowrap">{formatted}</span>
          </Html>
        );
      })}

      {Array.from({ length: yTicks + 1 }).map((_, j) => {
        const frac = j / yTicks;
        const yPos = frac * height;
        const val = yMin + frac * (yMax - yMin);
        const formatted = Number.isInteger(val)
          ? `${val > 0 ? "+" : ""}${val}`
          : `${val > 0 ? "+" : ""}${val.toFixed(1)}`;
        return (
          <Html key={`ytick-${j}`} position={[-0.26, yPos, 0.01]} center style={{ pointerEvents: "none" }}>
            <span className="font-mono text-[9px] text-ink-400 select-none whitespace-nowrap">{formatted}</span>
          </Html>
        );
      })}

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

      {series.map((s, i) => {
        if (!s?.points || s.points.length < 2) return null;
        const worldPts = [];
        for (let j = 0; j < s.points.length; j += 1) {
          const pt = toWorld(s.points[j]);
          if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
          if (worldPts.length > 0) {
            const prev = worldPts[worldPts.length - 1];
            const d = Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
            if (d < 1e-4) continue;
          }
          worldPts.push(pt);
        }
        if (worldPts.length < 2) return null;
        return (
          <Line
            key={`s${i}`}
            points={worldPts}
            color={s.colour}
            lineWidth={s.lineWidth ?? 2.6}
            transparent
            opacity={s.opacity ?? 1}
            dashed={Boolean(s.dashed)}
            dashSize={0.12}
            gapSize={0.1}
          />
        );
      })}

      {marker && Number.isFinite(marker.at?.[0]) && Number.isFinite(marker.at?.[1]) && (
        <group position={toWorld(marker.at)}>
          <mesh>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial
              color={marker.colour}
              emissive={marker.colour}
              emissiveIntensity={2.4}
              toneMapped={false}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[0.14, 0.2, 24]} />
            <meshBasicMaterial color={marker.colour} transparent opacity={0.65} side={THREE.DoubleSide} />
          </mesh>
          {marker.label && (
            <SceneLabel position={[0.75, 0.35, 0]} accent>
              {marker.label}
            </SceneLabel>
          )}
        </group>
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

  if (billboard) {
    return (
      <Billboard position={[centerX, centerY, centerZ]} follow={true}>
        {content}
      </Billboard>
    );
  }

  return <group position={position}>{content}</group>;
}

// ─── Rolling time series ────────────────────────────────────────────

/**
 * A fixed-length ring of samples for a live trace.
 *
 * The buffer is a ref and only the redraw is throttled, because pushing a
 * sample into React state every frame re-renders the whole scene sixty times a
 * second to move a line by one pixel.
 */
export function useRollingTrace(capacity = 800, hz = 24, initialPoints = []) {
  const buffer = useRef([...initialPoints]);
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

  const reset = useCallback((newPoints = []) => {
    buffer.current = [...newPoints];
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
export function useBodyMotion({ step, onSample, running = true, sampleHz = 60, speed = 1.0 }) {
  const motion = useRef({ position: 0, velocity: 0 });
  const since = useRef(0);

  useFrame((_, delta) => {
    // A tab that has been hidden for a minute reports a minute-long frame.
    // Integrating that in one go teleports the body through the whole scene.
    const dt = Math.min(delta, 0.05) * speed;
    if (running && speed > 0) motion.current = step(motion.current, dt);

    since.current += delta;
    if (since.current >= 1 / sampleHz) {
      since.current = 0;
      if (running) onSample(motion.current, dt);
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
    // Guard against zero or negative dimensions so extrude never degenerates.
    const b = Math.max(baseLength, 0.01);
    const h = Math.max(height, 0.01);
    shape.moveTo(0, 0);
    shape.lineTo(b, 0);
    shape.lineTo(b, h);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  }, [baseLength, height, depth]);

  // Every angle change builds a new prism, so the old one has to go with it —
  // dragging the slider through its range would otherwise leak a buffer per
  // degree for as long as the scene is open.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return geometry;
}
