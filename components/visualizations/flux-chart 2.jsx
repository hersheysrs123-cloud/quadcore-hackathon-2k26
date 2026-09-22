"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { PALETTE, SceneLabel, clamp } from "@/components/visualizations/scene-kit";

// ─── Flux chart ─────────────────────────────────────────────────────
// The in-scene readout the ecosystem scenes share: a column chart that can
// say two things a plain bar chart cannot.
//
//   signed   columns grow UP from a zero line for flows INTO a pool and
//            DOWN for flows out of it, with a final accented column for
//            the net. A carbon budget is an argument about a sum, and a
//            row of numbers with signs is exactly what a student cannot
//            add in their head. Drawn, the surplus is a column that is
//            visibly above the line.
//
//   log      column height is proportional to log₁₀ of the value, because
//            10 000 → 1 000 → 100 → 10 cannot be drawn to scale (the top
//            of the pyramid would be a thousandth of a pixel). A "ghost"
//            column behind each one shows what that tier RECEIVED before
//            its 90 % loss, so the gap between ghost and column is the
//            loss, at every tier, in one glance.
//
// Values are plain props; the parent re-renders the chart when the model
// moves, which for the carbon scene is ten times a second.
// ─────────────────────────────────────────────────────────────────────

const GAP = 0.2;

function Panel({ width, height, extraTop = 1.0, extraBottom = 1.1 }) {
  return (
    <mesh position={[width / 2, (height + extraTop - extraBottom) / 2, -0.06]} scale={[width + 0.7, height + extraTop + extraBottom, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#0d121c" transparent opacity={0.88} depthWrite={false} />
    </mesh>
  );
}

/**
 * Diverging columns about a zero line.
 *
 * `bars`: [{ key, label, value, colour }] where `value` is signed — positive
 * draws upward. `net` (optional): { label, colour } adds a final column of
 * the sum, drawn with an accent label.
 */
export function SignedFluxBars({ position = [0, 0, 0], width = 5, height = 3, bars = [], net, unit = "", format = (v) => v.toFixed(1), title, footnote, scaleMax, stagger = true }) {
  const columns = bars.length + (net ? 1 : 0);
  const slot = width / Math.max(columns, 1);
  const barWidth = Math.max(slot - GAP, 0.12);
  const sum = bars.reduce((s, b) => s + b.value, 0);

  // One scale for up and down, so a source and a sink of equal size look equal.
  const top = useMemo(() => {
    const values = bars.map((b) => Math.abs(b.value));
    if (net) values.push(Math.abs(sum));
    const found = Math.max(...values, 0);
    return scaleMax ?? (found > 1e-9 ? found * 1.1 : 1);
  }, [bars, net, sum, scaleMax]);

  const up = height * 0.62;
  const down = height * 0.38;
  const yOf = (v) => (v >= 0 ? clamp(v / top, 0, 1) * up : -clamp(-v / top, 0, 1) * down);

  // Fixed point arrays: a fresh array would rebuild the line's geometry on
  // every re-render, and the carbon scene re-renders ten times a second.
  const axes = useMemo(
    () => ({
      zero: [[-0.1, 0, 0], [width + 0.1, 0, 0]],
      vertical: [[0, -down, 0], [0, up, 0]],
    }),
    [width, up, down],
  );

  // Labels are screen-sized, so neighbouring columns alternate heights
  // rather than overprint each other when the chart is far from the camera.
  const column = (bar, i, accent = false) => {
    const h = yOf(bar.value);
    const x = i * slot + slot / 2;
    const positive = bar.value >= 0;
    const odd = stagger && i % 2 === 1;
    // A negative column's value sits just above the zero line, where its own
    // column is empty — below the bar it would land on the category labels.
    const valueY = (positive ? h + 0.26 : 0.26) + (odd ? 0.3 : 0);
    return (
      <group key={bar.key ?? i} position={[x, 0, 0]}>
        {/* Unit plane scaled to size: changing geometry args would rebuild the buffers every tick. */}
        {Math.abs(h) > 0.004 && (
          <mesh position={[0, h / 2, 0]} scale={[barWidth, Math.abs(h), 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={bar.colour} toneMapped={false} transparent opacity={accent ? 1 : 0.92} />
          </mesh>
        )}
        <SceneLabel position={[0, valueY, 0]} tone={accent ? undefined : "text-ink-200"} accent={accent}>
          {`${bar.value >= 0 ? "+" : "−"}${format(Math.abs(bar.value))}${unit ? ` ${unit}` : ""}`}
        </SceneLabel>
        <SceneLabel position={[0, -down - 0.34 - (odd ? 0.3 : 0), 0]} tone={accent ? "text-ink-100" : "text-ink-400"}>
          {bar.label}
        </SceneLabel>
      </group>
    );
  };

  return (
    <group position={position}>
      <Panel width={width} height={height} extraTop={1.25} extraBottom={stagger ? 1.35 : 0.85} />
      {/* The zero line: everything above it is going in, everything below is coming out. */}
      <Line points={axes.zero} color={PALETTE.bone} lineWidth={1.6} transparent opacity={0.85} />
      <Line points={axes.vertical} color={PALETTE.slate} lineWidth={1} transparent opacity={0.5} />
      {bars.map((bar, i) => column(bar, i))}
      {net && column({ key: "net", label: net.label, value: sum, colour: net.colour }, bars.length, true)}
      {title && (
        <SceneLabel position={[width / 2, up + 0.98, 0]} accent>
          {title}
        </SceneLabel>
      )}
      {footnote && (
        <SceneLabel position={[width / 2, -down - (stagger ? 1.05 : 0.7), 0]} tone="text-ink-400">
          {footnote}
        </SceneLabel>
      )}
    </group>
  );
}

/**
 * Log-scale columns with an optional ghost behind each.
 *
 * `bars`: [{ key, label, value, colour, ghost, ghostLabel, caption }].
 * `floor` is the value that draws as zero height; anything below it is a
 * stub so an empty tier still has a label to hang off.
 */
export function LogTierBars({ position = [0, 0, 0], width = 5, height = 3, bars = [], unit = "", format = (v) => v.toFixed(0), title, footnote, floor = 1, scaleMax, lossLabel = (bar) => (bar.ghost > 0 && bar.value > 0 ? `−${Math.round((1 - bar.value / bar.ghost) * 100)} %` : null) }) {
  const slot = width / Math.max(bars.length, 1);
  const barWidth = Math.max(slot - GAP, 0.12);
  const top = useMemo(() => {
    const values = bars.flatMap((b) => [b.value, b.ghost ?? 0]);
    const found = Math.max(...values, floor * 10);
    return scaleMax ?? found * 1.15;
  }, [bars, floor, scaleMax]);
  const logSpan = Math.log10(top / floor);
  const yOf = (v) => (v <= floor ? 0 : clamp(Math.log10(v / floor) / logSpan, 0, 1) * height);

  // Decade gridlines, so "each step down is a tenth" can be read off the axis.
  const decades = useMemo(() => {
    const out = [];
    for (let v = floor * 10; v <= top; v *= 10) {
      const y = v <= floor ? 0 : clamp(Math.log10(v / floor) / Math.log10(top / floor), 0, 1) * height;
      out.push({ value: v, points: [[-0.1, y, 0], [width + 0.1, y, 0]] });
    }
    return out;
  }, [floor, top, width, height]);
  const baseline = useMemo(() => [[0, 0, 0], [width, 0, 0]], [width]);

  return (
    <group position={position}>
      <Panel width={width} height={height} extraTop={0.95} extraBottom={1.05} />
      {decades.map((d) => (
        <group key={d.value}>
          <Line points={d.points} color={PALETTE.line} lineWidth={0.8} transparent opacity={0.45} dashed dashSize={0.1} gapSize={0.08} />
          <SceneLabel position={[-0.42, d.points[0][1], 0]} tone="text-ink-500">
            {`${format(d.value)}`}
          </SceneLabel>
        </group>
      ))}
      <Line points={baseline} color={PALETTE.bone} lineWidth={1.6} transparent opacity={0.85} />

      {bars.map((bar, i) => {
        const h = yOf(bar.value);
        const g = bar.ghost !== undefined ? yOf(bar.ghost) : 0;
        const x = i * slot + slot / 2;
        const loss = lossLabel(bar);
        return (
          <group key={bar.key ?? i} position={[x, 0, 0]}>
            {g > 0.004 && (
              <mesh position={[0, g / 2, -0.02]} scale={[barWidth, g, 1]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color={bar.ghostColour ?? bar.colour} toneMapped={false} transparent opacity={0.22} depthWrite={false} />
              </mesh>
            )}
            {h > 0.004 ? (
              <mesh position={[0, h / 2, 0]} scale={[barWidth, h, 1]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color={bar.colour} toneMapped={false} />
              </mesh>
            ) : (
              <mesh position={[0, 0.02, 0]} scale={[barWidth, 0.04, 1]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color={bar.colour} toneMapped={false} transparent opacity={0.5} />
              </mesh>
            )}
            <SceneLabel position={[0, Math.max(h, 0.04) + 0.26, 0]} tone="text-ink-100">
              {`${format(bar.value)}${unit ? ` ${unit}` : ""}`}
            </SceneLabel>
            {/* In the gap between ghost and column, nudged right so it clears the column's own value label. */}
            {loss && g > h + 0.3 && (
              <SceneLabel position={[barWidth * 0.55, (g + h) / 2 - 0.05, 0.01]} tone="text-rose-300">
                {loss}
              </SceneLabel>
            )}
            <SceneLabel position={[0, -0.34, 0]} tone="text-ink-300">
              {bar.label}
            </SceneLabel>
            {bar.caption && (
              <SceneLabel position={[0, -0.66, 0]} tone="text-ink-500">
                {bar.caption}
              </SceneLabel>
            )}
          </group>
        );
      })}

      {title && (
        <SceneLabel position={[width / 2, height + 0.72, 0]} accent>
          {title}
        </SceneLabel>
      )}
      {footnote && (
        <SceneLabel position={[width / 2, -1.0, 0]} tone="text-ink-400">
          {footnote}
        </SceneLabel>
      )}
    </group>
  );
}
