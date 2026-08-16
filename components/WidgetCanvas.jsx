"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Renders a widget config from /api/socratic/widget.
 *
 * ── On the renderer ────────────────────────────────────────────────────────
 * This draws to a 2D canvas with a hand-rolled perspective projection rather
 * than Three.js. It's dependency-free and genuinely 3D (rotation, depth
 * ordering, perspective divide), which is enough for vectors, points and
 * concept graphs.
 *
 * To swap in Three.js / react-three-fiber later, everything you need is already
 * separated: `project()` and `draw()` below are the only things that touch the
 * canvas. Replace this file's render layer with an <R3F Canvas>, map
 * `initialState.objects` to meshes, and keep `scaleFor()` — the control->object
 * binding is renderer-independent.
 * ───────────────────────────────────────────────────────────────────────────
 */

const GAP_HALO = { red: "#fb7185", yellow: "#fbbf24", none: null };
const AXIS_COLOR = "#333a45";
const AXIS_EXTENT = 4;

/** Perspective projection: rotate about Y, then X, then divide by depth. */
function project([x, y, z], { rotX, rotY, zoom, width, height }) {
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  let px = x * cy - z * sy;
  let pz = x * sy + z * cy;

  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const py = y * cx - pz * sx;
  pz = y * sx + pz * cx;

  const distance = 14;
  const denom = Math.max(distance + pz, 0.1); // never divide through zero
  const scale = (distance / denom) * zoom * Math.min(width, height) * 0.085;

  return {
    x: width / 2 + px * scale,
    y: height / 2 - py * scale,
    depth: pz,
  };
}

/**
 * Maps a slider onto an object's magnitude.
 *
 * A control whose `targetsSubtopic` matches an object's label drives that object
 * specifically; otherwise the first control acts as a global scalar. The 0.2x–2x
 * output range guarantees slider motion is always visible on screen — a control
 * that appears to do nothing is worse than no control.
 */
function scaleFor(object, controls, values) {
  if (!controls || !controls.length) return 1;

  const label = (object?.label || "").trim().toLowerCase();
  const exact = controls.find(
    (c) => (c?.targetsSubtopic || "").trim().toLowerCase() === label,
  );
  const control = exact ?? controls[0];

  if (!control) return 1;
  const value = values[control.key] ?? control.default ?? control.min ?? 1;
  const span = control.max - control.min || 1;
  return 0.2 + ((value - control.min) / span) * 1.8;
}

/**
 * Draws a label, nudging it down until it clears labels already placed this
 * frame. Vectors sharing an origin project their captions to nearly the same
 * point, which otherwise renders them overprinted on top of each other.
 *
 * `placed` is per-frame scratch — reset it every draw.
 */
function placeLabel(ctx, text, x, y, placed) {
  const width = ctx.measureText(text).width;
  let ty = y;

  for (let attempt = 0; attempt < 12; attempt++) {
    const collides = placed.some(
      (p) => Math.abs(p.y - ty) < 12 && x < p.x + p.width && p.x < x + width,
    );
    if (!collides) break;
    ty += 13;
  }

  placed.push({ x, y: ty, width });
  ctx.fillText(text, x, ty);
}

function drawAxes(ctx, view, axisLabels, placed) {
  const origin = project([0, 0, 0], view);
  const axes = [
    { end: [AXIS_EXTENT, 0, 0], label: axisLabels[0] },
    { end: [0, AXIS_EXTENT, 0], label: axisLabels[1] },
    { end: [0, 0, AXIS_EXTENT], label: axisLabels[2] },
  ];

  ctx.lineWidth = 1;
  ctx.strokeStyle = AXIS_COLOR;
  ctx.fillStyle = "#5b6472";
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";

  for (const axis of axes) {
    const negative = project(axis.end.map((v) => -v), view);
    const positive = project(axis.end, view);

    ctx.beginPath();
    ctx.moveTo(negative.x, negative.y);
    ctx.lineTo(positive.x, positive.y);
    ctx.stroke();

    placeLabel(ctx, axis.label, positive.x + 5, positive.y - 3, placed);
  }

  ctx.beginPath();
  ctx.arc(origin.x, origin.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = AXIS_COLOR;
  ctx.fill();
}

function drawArrowHead(ctx, from, to, color) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 9;

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 7),
    to.y - size * Math.sin(angle - Math.PI / 7),
  );
  ctx.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 7),
    to.y - size * Math.sin(angle + Math.PI / 7),
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawObject(ctx, { object, scale }, view, placed) {
  const pos = object.position || [0, 0, 0];
  const vec = object.vector || [0, 1, 0];
  const start = project(pos, view);
  const end = project(
    [
      pos[0] + vec[0] * scale,
      pos[1] + vec[1] * scale,
      pos[2] + vec[2] * scale,
    ],
    view,
  );

  const halo = GAP_HALO[object.gapStatus];

  // Gap objects get a soft outer glow so the eye lands on them first.
  if (halo) {
    ctx.save();
    ctx.shadowColor = halo;
    ctx.shadowBlur = 14;
  }

  ctx.strokeStyle = object.color;
  ctx.fillStyle = object.color;
  ctx.lineWidth = object.gapStatus === "none" ? 1.5 : 2.5;

  switch (object.kind) {
    case "vector":
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      drawArrowHead(ctx, start, end, object.color);
      break;

    case "edge":
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      break;

    case "node":
      ctx.beginPath();
      ctx.arc(start.x, start.y, 7, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "plane": {
      const size = 1.2 * scale;
      const [cx, cy, cz] = object.position;
      const corners = [
        [cx - size, cy, cz - size],
        [cx + size, cy, cz - size],
        [cx + size, cy, cz + size],
        [cx - size, cy, cz + size],
      ].map((c) => project(c, view));

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach((c) => ctx.lineTo(c.x, c.y));
      ctx.closePath();
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
      break;
    }

    case "point":
    default:
      ctx.beginPath();
      ctx.arc(start.x, start.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  if (halo) ctx.restore();

  const anchor = object.kind === "vector" || object.kind === "edge" ? end : start;
  ctx.fillStyle = object.gapStatus === "none" ? "#8a92a0" : object.color;
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  placeLabel(ctx, object.label, anchor.x + 8, anchor.y - 6, placed);
}

export default function WidgetCanvas({ widget, loading = false, error = null }) {
  const canvasRef = useRef(null);
  const rotationRef = useRef({ x: 0.35, y: 0.6 });
  const valuesRef = useRef({});
  const pausedRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [values, setValues] = useState({});
  const [canvasHeight, setCanvasHeight] = useState(256); // default h-64
  const [zoomOverride, setZoomOverride] = useState(1);

  const controls = useMemo(
    () => widget?.interactiveControls ?? [],
    [widget],
  );

  // Reset slider state whenever a new widget config arrives.
  useEffect(() => {
    const next = Object.fromEntries(controls.map((c) => [c.key, c.default]));
    setValues(next);
    valuesRef.current = next;
    rotationRef.current = { x: 0.35, y: 0.6 };
  }, [controls]);

  // Mirror React state into refs so the animation loop reads live values
  // without being torn down and rebuilt on every slider tick.
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !widget) return;

    const ctx = canvas.getContext("2d");
    let frameId;
    let last = performance.now();
    let width = 0;
    let height = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05); // clamp tab-restore jumps
      last = now;

      const initialState = widget.initialState || {};
      // A control keyed `rotationSpeed` takes over the spin if the model emits one.
      const spinControl = controls.find((c) => c.key === "rotationSpeed");
      const spin = spinControl
        ? (valuesRef.current[spinControl.key] ?? spinControl.default ?? 0.4)
        : (initialState.rotationSpeed ?? 0.4);

      if (!pausedRef.current) rotationRef.current.y += spin * dt;

      const view = {
        rotX: rotationRef.current.x,
        rotY: rotationRef.current.y,
        zoom: (initialState.cameraZoom ?? 1) * zoomOverride,
        width,
        height,
      };

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = initialState.backgroundColor || "#090d16";
      ctx.fillRect(0, 0, width, height);

      // Per-frame label collision scratch — see placeLabel().
      const placed = [];
      if (Array.isArray(initialState.axisLabels)) {
        drawAxes(ctx, view, initialState.axisLabels, placed);
      }

      // Painter's algorithm — farthest first.
      const objects = Array.isArray(initialState.objects) ? initialState.objects : [];
      objects
        .map((object) => ({
          object,
          scale: scaleFor(object, controls, valuesRef.current),
          depth: project(object.position || [0, 0, 0], view).depth,
        }))
        .sort((a, b) => b.depth - a.depth)
        .forEach((item) => drawObject(ctx, item, view, placed));

      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [widget, controls]);

  // Drag to orbit.
  function handlePointerDown(event) {
    const canvas = canvasRef.current;
    canvas.setPointerCapture(event.pointerId);
    let lastX = event.clientX;
    let lastY = event.clientY;

    function move(e) {
      rotationRef.current.y += (e.clientX - lastX) * 0.008;
      rotationRef.current.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, rotationRef.current.x + (e.clientY - lastY) * 0.008),
      );
      lastX = e.clientX;
      lastY = e.clientY;
    }

    function up(e) {
      canvas.releasePointerCapture(e.pointerId);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    }

    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-ink-800 bg-ink-850">
        <p className="text-xs text-ink-500">Building your playground...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-xs text-rose-400">
        {error}
      </div>
    );
  }

  if (!widget) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-ink-700 bg-ink-850 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">
            {widget.widgetType.replaceAll("_", " ")}
          </span>
          <div className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-850 p-0.5">
            <button
              type="button"
              onClick={() => setZoomOverride((z) => Math.max(0.2, z - 0.2))}
              className="px-2 py-0.5 text-xs text-ink-400 hover:text-ink-200 transition-colors"
              title="Zoom Out"
            >-</button>
            <button
              type="button"
              onClick={() => setZoomOverride(1)}
              className="px-2 py-0.5 text-[10px] text-ink-500 hover:text-ink-300 transition-colors"
              title="Reset Zoom"
            >100%</button>
            <button
              type="button"
              onClick={() => setZoomOverride((z) => Math.min(5, z + 0.2))}
              className="px-2 py-0.5 text-xs text-ink-400 hover:text-ink-200 transition-colors"
              title="Zoom In"
            >+</button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="rounded-md border border-ink-700 px-2 py-1 text-[11px] text-ink-400 transition-colors hover:text-ink-200"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>

      <div className="relative group">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          style={{ height: canvasHeight }}
          className="w-full cursor-grab touch-none rounded-lg border border-ink-800 active:cursor-grabbing"
          aria-label={`Interactive ${widget.widgetType} visualisation. Drag to rotate.`}
        />
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-12 h-2 cursor-ns-resize rounded-full bg-ink-700 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = canvasHeight;
            function onMove(evt) {
              setCanvasHeight(Math.max(100, Math.min(1000, startH + (evt.clientY - startY))));
            }
            function onUp() {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            }
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
        />
      </div>

      {controls.length > 0 && (
        <div className="space-y-3 rounded-lg border border-ink-800 bg-ink-850 px-3.5 py-3">
          {controls.map((control) => (
            <div key={control.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <label
                  htmlFor={`control-${control.key}`}
                  className="text-xs text-ink-200"
                >
                  {control.name}
                </label>
                <span className="text-[11px] tabular-nums text-ink-500">
                  {(values[control.key] ?? control.default).toFixed(2)}
                  {control.unit && ` ${control.unit}`}
                </span>
              </div>
              <input
                id={`control-${control.key}`}
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={values[control.key] ?? control.default}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [control.key]: Number(e.target.value),
                  }))
                }
                className="w-full accent-duck-400"
              />
              {control.targetsSubtopic && (
                <p className="mt-0.5 text-[10px] text-ink-600">
                  Targets: {control.targetsSubtopic}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {widget.explanationKey.length > 0 && (
        <ul className="space-y-2">
          {widget.explanationKey.map((entry, i) => (
            <li
              key={`${entry.subtopic}-${i}`}
              className="rounded-lg border border-duck-500/25 bg-duck-500/5 px-3.5 py-2.5"
            >
              <p className="text-xs font-medium text-duck-300">{entry.subtopic}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-200">
                {entry.hint}
              </p>
              <p className="mt-1 text-[11px] text-ink-500">→ {entry.watchFor}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
