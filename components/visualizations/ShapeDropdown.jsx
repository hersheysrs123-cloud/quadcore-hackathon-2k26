"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { SHAPE_GROUPS, SHAPE_LABELS, getSolid } from "@/lib/shadowSolids";

// ─── Shape previews ─────────────────────────────────────────────────
// A small shaded picture of each solid, drawn from the same triangles the
// scene draws and casts its shadow from — so the preview beside a name IS the
// object that name puts on the stand, not an icon someone drew separately.
// ─────────────────────────────────────────────────────────────────────

const thumbCache = new Map();

/** The shape as the torch would see it, turned a little so its depth shows. */
const VIEW = { yaw: -0.62, pitch: 0.4 };
const CLAY = [214, 150, 96];

/** A 3D-looking preview of `shape` as a data URL, or null off the browser. */
export function shapeThumbnail(shape, px = 72) {
  const key = `${shape}@${px}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  if (typeof document === "undefined") return null;

  const solid = getSolid(shape);
  const { positions, tris, normals } = solid;
  const cy = Math.cos(VIEW.yaw), sy = Math.sin(VIEW.yaw);
  const cp = Math.cos(VIEW.pitch), sp = Math.sin(VIEW.pitch);
  // Bench frame → what the viewer sees: u to the right (= −x), v up, depth away.
  const turn = (x, y, z) => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    return [-x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };

  const nVert = positions.length / 3;
  const view = new Float64Array(nVert * 3);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < nVert; i += 1) {
    const [u, v, d] = turn(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    view[i * 3] = u;
    view[i * 3 + 1] = v;
    view[i * 3 + 2] = d;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const scale = (px * 0.84) / Math.max(maxU - minU, maxV - minV);
  const ox = px / 2 - ((minU + maxU) / 2) * scale;
  const oy = px / 2 + ((minV + maxV) / 2) * scale;

  const light = [-0.45, 0.75, -0.5];
  const ll = Math.hypot(...light);
  const faces = [];
  for (let t = 0; t < tris.length / 3; t += 1) {
    const [nu, nv, nd] = turn(normals[t * 3], normals[t * 3 + 1], normals[t * 3 + 2]);
    if (nd >= 0) continue; // turned away from the viewer
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    const depth = (view[a * 3 + 2] + view[b * 3 + 2] + view[c * 3 + 2]) / 3;
    const lit = 0.34 + 0.66 * Math.max(0, (nu * light[0] + nv * light[1] + nd * light[2]) / ll);
    faces.push({ a, b, c, depth, lit });
  }
  faces.sort((p, q) => q.depth - p.depth); // far first

  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.8;
  for (const f of faces) {
    const fill = `rgb(${Math.round(CLAY[0] * f.lit)},${Math.round(CLAY[1] * f.lit)},${Math.round(CLAY[2] * f.lit)})`;
    ctx.fillStyle = fill;
    ctx.strokeStyle = fill;
    ctx.beginPath();
    ctx.moveTo(ox + view[f.a * 3] * scale, oy - view[f.a * 3 + 1] * scale);
    ctx.lineTo(ox + view[f.b * 3] * scale, oy - view[f.b * 3 + 1] * scale);
    ctx.lineTo(ox + view[f.c * 3] * scale, oy - view[f.c * 3 + 1] * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  const url = canvas.toDataURL("image/png");
  thumbCache.set(key, url);
  return url;
}

function Thumb({ shape, size = 32 }) {
  // Drawn after mount, so the server and the first client render agree.
  const [src, setSrc] = useState(null);
  useEffect(() => {
    setSrc(shapeThumbnail(shape));
  }, [shape]);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-ink-950/70 ring-1 ring-ink-700"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size - 4} height={size - 4} draggable={false} />
      ) : null}
    </span>
  );
}

// ─── The dropdown ───────────────────────────────────────────────────

const LIST_MAX = 320;

/**
 * A list of every shape, each with its own preview beside the name.
 *
 * The list is drawn in a portal at the page level and positioned from the
 * button, so it is not clipped by the scrolling control panel it lives in, and
 * it opens upward when there is more room above than below.
 */
export default function ShapeDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState(null);
  const button = useRef(null);
  const list = useRef(null);
  const uid = useId();

  const flat = useMemo(() => SHAPE_GROUPS.flatMap((g) => g.shapes), []);

  const openList = useCallback(() => {
    setActive(Math.max(0, flat.indexOf(value)));
    setOpen(true);
  }, [flat, value]);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  const choose = useCallback(
    (shape) => {
      onChange(shape);
      close(true);
    },
    [onChange, close],
  );

  // Where to put the list, from the button's position on the screen.
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    const room = Math.max(140, up ? above : below);
    setPlace({
      left: r.left,
      width: r.width,
      maxHeight: Math.min(LIST_MAX, room),
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  }, [open]);

  // Click away, scroll away or resize away closes it.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (list.current?.contains(e.target) || button.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = (e) => {
      if (list.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Keep the highlighted row in view as the arrow keys move it.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${uid}-${flat[active]}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, flat, uid]);

  // Focus the list when it opens, so the keys work at once.
  useEffect(() => {
    if (open && place) list.current?.focus({ preventScroll: true });
  }, [open, place]);

  const onKeyDown = (e) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(flat.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(flat[active]);
    } else if (e.key.length === 1) {
      // Type a letter to jump to the next shape starting with it.
      const ch = e.key.toLowerCase();
      const from = active + 1;
      const order = [...flat.slice(from), ...flat.slice(0, from)];
      const hit = order.find((s) => SHAPE_LABELS[s].toLowerCase().startsWith(ch));
      if (hit) setActive(flat.indexOf(hit));
    }
  };

  return (
    <div>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        suppressHydrationWarning
        className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors ${
          open ? "border-duck-500/60 bg-ink-800" : "border-ink-700 bg-ink-850 hover:border-ink-600"
        }`}
      >
        <Thumb shape={value} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink-100">{SHAPE_LABELS[value]}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {open &&
        place &&
        createPortal(
          <div
            ref={list}
            id={`${uid}-list`}
            role="listbox"
            tabIndex={-1}
            aria-label="Shape on the stand"
            aria-activedescendant={`${uid}-${flat[active]}`}
            onKeyDown={onKeyDown}
            onWheel={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left: place.left,
              width: place.width,
              maxHeight: place.maxHeight,
              top: place.top,
              bottom: place.bottom,
              zIndex: 90,
            }}
            className="overflow-y-auto overscroll-contain rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-2xl outline-none"
          >
            {SHAPE_GROUPS.map((group) => (
              <div key={group.id} role="group" aria-label={group.label}>
                <p className="px-2 pb-1 pt-1.5 text-[9.5px] font-medium uppercase tracking-wider text-ink-500">
                  {group.label}
                </p>
                {group.shapes.map((shape) => {
                  const selected = shape === value;
                  const highlighted = flat[active] === shape;
                  return (
                    <div
                      key={shape}
                      id={`${uid}-${shape}`}
                      role="option"
                      aria-selected={selected}
                      onPointerEnter={() => setActive(flat.indexOf(shape))}
                      onClick={() => choose(shape)}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 ${
                        highlighted ? "bg-ink-800" : ""
                      } ${selected ? "text-duck-300" : "text-ink-200"}`}
                    >
                      <Thumb shape={shape} />
                      <span className="min-w-0 flex-1 truncate text-[12px]">{SHAPE_LABELS[shape]}</span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-duck-400" strokeWidth={2.5} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
