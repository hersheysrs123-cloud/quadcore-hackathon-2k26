"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { PALETTE, SceneLabel, clamp } from "@/components/visualizations/scene-kit";

// ─── Energy and work bar charts ─────────────────────────────────────
// The readout both machines scenes are built around: a set of columns on a
// common scale, and — where it applies — a stacked column beside them whose
// total never moves.
//
// That stacked column is the whole argument for conservation. Three separate
// bars going up and down prove nothing on their own; a stack of the same three
// whose top edge stays pinned to a line is the statement "none of it went
// anywhere" drawn rather than asserted.
// ─────────────────────────────────────────────────────────────────────

/** One colour per quantity, shared with the HUD's colour key. */
export const ENERGY_COLOURS = {
  gpe: "#a78bfa",
  kinetic: "#38bdf8",
  thermal: "#fb7185",
  workIn: "#fbbf24",
  workOut: "#34d399",
  wasted: "#fb7185",
  total: "#e8ebf0",
};

const GAP = 0.22;

/**
 * A column chart standing in the scene.
 *
 * `bars` are drawn side by side on one shared scale; `stack` — when given —
 * adds a final column of the same values piled up, so the constant total is
 * visible as a flat top rather than as a number a student has to add up.
 */
export function EnergyBars({
  position = [0, 0, 0],
  width = 4,
  height = 2.8,
  bars = [],
  stack = null,
  scaleMax,
  title,
  format = (v) => v.toFixed(0),
  unit = "J",
  reference,
  footnote,
}) {
  const columns = bars.length + (stack ? 1 : 0);
  const slot = width / Math.max(columns, 1);
  const barWidth = Math.max(slot - GAP, 0.12);

  // One scale for every column, or the comparison is meaningless. Never zero:
  // an empty chart should be flat, not an infinite division.
  const top = useMemo(() => {
    const values = bars.map((b) => Math.abs(b.value));
    if (stack) values.push(stack.segments.reduce((sum, s) => sum + Math.abs(s.value), 0));
    if (reference !== undefined) values.push(Math.abs(reference));
    const found = Math.max(...values, 0);
    return scaleMax ?? (found > 1e-9 ? found * 1.12 : 1);
  }, [bars, stack, reference, scaleMax]);

  const yOf = (v) => clamp(Math.abs(v) / top, 0, 1) * height;

  return (
    <group position={position}>
      {/* Backing panel and baseline. */}
      <mesh position={[width / 2, height / 2, -0.05]}>
        <planeGeometry args={[width + 0.6, height + 1.35]} />
        <meshBasicMaterial color="#0d121c" transparent opacity={0.88} />
      </mesh>
      <Line
        points={[
          [0, 0, 0],
          [width, 0, 0],
        ]}
        color={PALETTE.slate}
        lineWidth={1.8}
      />

      {/* The line the stack should never cross — conservation, drawn. */}
      {reference !== undefined && (
        <>
          <Line
            points={[
              [-0.12, yOf(reference), 0],
              [width + 0.12, yOf(reference), 0],
            ]}
            color={ENERGY_COLOURS.total}
            lineWidth={1.6}
            transparent
            opacity={0.8}
            dashed
            dashSize={0.11}
            gapSize={0.09}
          />
          <SceneLabel position={[width + 0.62, yOf(reference), 0]} tone="text-ink-300">
            {`${format(reference)} ${unit}`}
          </SceneLabel>
        </>
      )}

      {bars.map((bar, i) => {
        const h = yOf(bar.value);
        const x = i * slot + slot / 2;
        return (
          <group key={bar.key ?? i} position={[x, 0, 0]}>
            {h > 0.004 && (
              <mesh position={[0, h / 2, 0]}>
                <planeGeometry args={[barWidth, h]} />
                <meshBasicMaterial color={bar.colour} toneMapped={false} />
              </mesh>
            )}
            <SceneLabel position={[0, h + 0.28, 0]} tone="text-ink-200">
              {`${format(bar.value)} ${unit}`}
            </SceneLabel>
            <SceneLabel position={[0, -0.32, 0]} tone="text-ink-400">
              {bar.label}
            </SceneLabel>
          </group>
        );
      })}

      {stack && (
        <group position={[bars.length * slot + slot / 2, 0, 0]}>
          {stack.segments.reduce(
            (acc, seg, i) => {
              const h = yOf(seg.value);
              if (h > 0.004) {
                acc.nodes.push(
                  <mesh key={seg.key ?? i} position={[0, acc.base + h / 2, 0]}>
                    <planeGeometry args={[barWidth, h]} />
                    <meshBasicMaterial color={seg.colour} toneMapped={false} />
                  </mesh>,
                );
              }
              acc.base += h;
              return acc;
            },
            { base: 0, nodes: [] },
          ).nodes}
          <SceneLabel
            position={[0, yOf(stack.segments.reduce((s, x) => s + Math.abs(x.value), 0)) + 0.28, 0]}
            accent
          >
            {`${format(stack.segments.reduce((s, x) => s + Math.abs(x.value), 0))} ${unit}`}
          </SceneLabel>
          <SceneLabel position={[0, -0.32, 0]} tone="text-ink-300">
            {stack.label}
          </SceneLabel>
        </group>
      )}

      {title && (
        <SceneLabel position={[width / 2, height + 0.75, 0]} accent>
          {title}
        </SceneLabel>
      )}
      {footnote && (
        <SceneLabel position={[width / 2, -0.78, 0]} tone="text-ink-400">
          {footnote}
        </SceneLabel>
      )}
    </group>
  );
}

/**
 * A needle gauge — the speedometer and the accelerometer both want one.
 *
 * `value` is mapped onto a 240° sweep. Anything past `redline` draws in the
 * warning colour, so a reading that has gone somewhere dangerous says so
 * without needing a caption.
 */
export function DialGauge({
  position = [0, 0, 0],
  radius = 0.8,
  value = 0,
  min = 0,
  max = 100,
  redline,
  label,
  readout,
  colour = ENERGY_COLOURS.kinetic,
}) {
  const START = Math.PI * 1.2;
  const SWEEP = Math.PI * 1.4;

  const t = clamp((value - min) / Math.max(max - min, 1e-9), 0, 1);
  const angle = START - t * SWEEP;
  const hot = redline !== undefined && value >= redline;

  const arc = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 48; i += 1) {
      const a = START - (i / 48) * SWEEP;
      pts.push([Math.cos(a) * radius, Math.sin(a) * radius, 0]);
    }
    return pts;
  }, [radius, START, SWEEP]);

  const dangerArc = useMemo(() => {
    if (redline === undefined) return null;
    const t0 = clamp((redline - min) / Math.max(max - min, 1e-9), 0, 1);
    const pts = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = START - (t0 + (1 - t0) * (i / 24)) * SWEEP;
      pts.push([Math.cos(a) * radius, Math.sin(a) * radius, 0]);
    }
    return pts;
  }, [redline, min, max, radius, START, SWEEP]);

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.05]}>
        <circleGeometry args={[radius * 1.28, 40]} />
        <meshBasicMaterial color="#0d121c" transparent opacity={0.9} />
      </mesh>
      <Line points={arc} color={PALETTE.line} lineWidth={3} />
      {dangerArc && <Line points={dangerArc} color={ENERGY_COLOURS.thermal} lineWidth={3.4} />}

      <Line
        points={[
          [0, 0, 0.01],
          [Math.cos(angle) * radius * 0.86, Math.sin(angle) * radius * 0.86, 0.01],
        ]}
        color={hot ? ENERGY_COLOURS.thermal : colour}
        lineWidth={3}
      />
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[radius * 0.09, 16]} />
        <meshBasicMaterial color={PALETTE.bone} />
      </mesh>

      {readout && (
        <SceneLabel position={[0, -radius * 0.55, 0]} accent>
          {readout}
        </SceneLabel>
      )}
      {label && (
        <SceneLabel position={[0, radius * 1.42, 0]} tone="text-ink-400">
          {label}
        </SceneLabel>
      )}
    </group>
  );
}
