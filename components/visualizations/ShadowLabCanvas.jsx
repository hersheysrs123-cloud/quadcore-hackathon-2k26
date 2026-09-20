"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  Eye,
  EyeOff,
  Lightbulb,
  Ruler,
  RotateCcw,
  RotateCw,
  Sparkles,
  Target,
} from "lucide-react";
import {
  SceneCanvas,
  SceneLabel,
  clamp,
} from "@/components/visualizations/scene-kit";
import {
  Choice,
  HudButton,
  HudPanel,
  Slider,
  Toggle,
} from "@/components/visualizations/VisualizationHUD";
import ShapeDropdown from "@/components/visualizations/ShapeDropdown";
import {
  BENCH,
  MATERIAL_OPTIONS,
  MATERIALS,
  PRESETS,
  SCENE,
  SHAPE_DEFS,
  SOURCES,
  benchGap,
  castShadow,
  describeShadow,
  enforceBench,
  getSolid,
  hasUmbra,
  lightRays,
  shadowFitsScreen,
  solveShadow,
  underside,
} from "@/lib/shadowOptics";

// ─── Shadow lab ─────────────────────────────────────────────────────
// A torch, a stand and a screen on a ruled bench. Everything the child can
// move feeds `lib/shadowOptics.js`, which fires a ray from every point of the
// lamp through every point of the very mesh drawn here and marks the screen
// dark where the ray was stopped. That result is PAINTED ONTO the screen as a
// texture rather than floated in front of it as a second mesh — so it is
// clipped by the screen's edges, visible from either side, and cannot drift
// off the surface it is supposed to be landing on.
// ─────────────────────────────────────────────────────────────────────

/** World units per centimetre of bench. */
const CM = 0.062;
const cm = (v) => v * CM;
/** The bench runs along +Z; the origin sits at its midpoint. */
const zAt = (benchCm) => cm(benchCm - BENCH.max / 2);

/** Height of the optical axis above the bench: lamp, object and screen centre. */
const AXIS_CM = SCENE.axisHeightCm;
/** The screen panel, in centimetres. Its centre sits on the optical axis. */
const SCREEN = { halfW: SCENE.screenHalfWidthCm, halfH: SCENE.screenHalfHeightCm };

// ─── The shadow, drawn onto the screen ──────────────────────────────

const PX_PER_CM = 8;
const TEX_W = Math.round(SCREEN.halfW * 2 * PX_PER_CM);
const TEX_H = Math.round(SCREEN.halfH * 2 * PX_PER_CM);

const SCREEN_LIT = [252, 250, 244];
const SCREEN_DIM = [38, 41, 48];

/** Screen paper, dimmed toward `f` = 0 where little light lands. */
function litPaper(f) {
  const t = 0.2 + 0.8 * clamp(f, 0, 1);
  const c = SCREEN_LIT.map((hi, i) => Math.round(SCREEN_DIM[i] + (hi - SCREEN_DIM[i]) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** A scratch canvas, kept between repaints, for compositing pixel data onto the paper. */
const overlays = new Map();
function overlay(name) {
  let o = overlays.get(name);
  if (!o) {
    const canvas = document.createElement("canvas");
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext("2d");
    o = { canvas, ctx, image: ctx.createImageData(TEX_W, TEX_H) };
    overlays.set(name, o);
  }
  return o;
}

/** Mark the boundary of a region as dashes, 2 px thick, in `rgb`. */
function traceEdges(data, blocked, test, rgb) {
  const W = TEX_W;
  const H = TEX_H;
  for (let j = 1; j < H - 1; j += 1) {
    for (let i = 1; i < W - 1; i += 1) {
      const idx = j * W + i;
      if (!test(blocked[idx])) continue;
      if (test(blocked[idx - 1]) && test(blocked[idx + 1]) && test(blocked[idx - W]) && test(blocked[idx + W])) continue;
      if (((i >> 3) + (j >> 3)) & 1) continue; // dashes
      for (const q of [idx, idx + 1, idx + W]) {
        data[q * 4] = rgb[0];
        data[q * 4 + 1] = rgb[1];
        data[q * 4 + 2] = rgb[2];
        data[q * 4 + 3] = 225;
      }
    }
  }
}

/**
 * Repaint the screen: illumination, ruled grid, then the shadow itself.
 *
 * The shadow is the ray-cast field, pixel for pixel: how many of the lamp's
 * points were shut out there, dimmed by how much light the material let
 * through. Nothing is blurred or drawn as an outline — a penumbra appears
 * only where some lamp points see the paper and others do not, and the two
 * dashed guides are the edge of "any lamp point blocked" and of "every lamp
 * point blocked".
 */
function paintScreen(canvas, geo, guides) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { solved, field } = geo;
  const cx = TEX_W / 2;
  const cy = TEX_H / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.clearRect(0, 0, TEX_W, TEX_H);

  // ── Illumination. Falls off as 1/d² with the throw, and as cos³θ across
  //    the panel, so the middle of the screen is visibly the brightest part.
  const d = Math.max(solved.lightToScreen, 1);
  const throwFactor = clamp((78 * 78) / (d * d), 0.4, 1);
  const maxR = Math.hypot(SCREEN.halfW, SCREEN.halfH);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * PX_PER_CM);
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    const cos = d / Math.hypot(d, t * maxR);
    grad.addColorStop(t, litPaper(throwFactor * cos * cos * cos));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // ── Ruled 10 cm grid, so the shadow can actually be measured.
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(96,110,132,0.30)";
  ctx.beginPath();
  for (let x = -30; x <= 30; x += 10) {
    ctx.moveTo(cx + x * PX_PER_CM, 0);
    ctx.lineTo(cx + x * PX_PER_CM, TEX_H);
  }
  for (let y = -20; y <= 20; y += 10) {
    ctx.moveTo(0, cy + y * PX_PER_CM);
    ctx.lineTo(TEX_W, cy + y * PX_PER_CM);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(96,110,132,0.55)";
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, TEX_H);
  ctx.moveTo(0, cy);
  ctx.lineTo(TEX_W, cy);
  ctx.stroke();

  // ── The shadow: near-black, as opaque as the ray-cast says.
  const shadow = overlay("shadow");
  const px = shadow.image.data;
  const shade = field.shade;
  for (let p = 0, q = 0; p < shade.length; p += 1, q += 4) {
    px[q] = 6;
    px[q + 1] = 8;
    px[q + 2] = 13;
    px[q + 3] = shade[p] * 255 + 0.5;
  }
  shadow.ctx.putImageData(shadow.image, 0, 0);
  ctx.drawImage(shadow.canvas, 0, 0);

  // ── Measuring guides: where full darkness ends and where any shadow at all
  //    ends. Only worth drawing once the two are actually distinguishable.
  const fuzzy = Math.max(solved.horizontal.penumbraWidth, solved.vertical.penumbraWidth);
  if (guides && fuzzy > 0.4) {
    const g = overlay("guides");
    g.image.data.fill(0);
    const N = field.samples;
    traceEdges(g.image.data, field.blocked, (v) => v >= N, [251, 191, 36]);
    traceEdges(g.image.data, field.blocked, (v) => v > 0, [56, 189, 248]);
    g.ctx.putImageData(g.image, 0, 0);
    ctx.drawImage(g.canvas, 0, 0);
  }
}

/**
 * The screen's paper as a live canvas, shared by the 3D panel and the HUD
 * preview. One element, one repaint — the inset cannot disagree with the
 * scene because it IS the scene's texture.
 */
function useScreenCanvas(geo, guides) {
  const canvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    return c;
  }, []);

  const texture = useMemo(() => {
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);

  useEffect(() => () => texture?.dispose(), [texture]);

  useEffect(() => {
    if (!canvas) return;
    paintScreen(canvas, geo, guides);
    if (texture) texture.needsUpdate = true;
  }, [canvas, texture, geo, guides]);

  return { canvas, texture };
}

// ─── Bench furniture ────────────────────────────────────────────────

function Bench() {
  return (
    <group>
      <mesh position={[0, -0.07, 0]} receiveShadow>
        <boxGeometry args={[cm(160), 0.14, cm(160)]} />
        <meshStandardMaterial color="#8c9cb3" roughness={0.65} metalness={0.1} />
      </mesh>
    </group>
  );
}

/**
 * The post that carries a piece of apparatus up to the optical axis.
 *
 * `top` is where the post stops, relative to the axis, and it runs from there
 * all the way down to the bench. A `glass` post is a clear acrylic rod: an
 * object's stand has to hold it without throwing a shadow of its own, which
 * is exactly what clear acrylic does.
 */
function Post({ top = 0, radius = 1.5, glass = false }) {
  const height = AXIS_CM + top;
  return (
    <group>
      <mesh position={[0, cm(top - height / 2), 0]}>
        <cylinderGeometry args={[cm(radius), cm(radius), cm(height), 20]} />
        {glass ? (
          <meshStandardMaterial color="#bfe3ff" transparent opacity={0.32} roughness={0.06} metalness={0.1} depthWrite={false} />
        ) : (
          <meshStandardMaterial color="#39414f" roughness={0.6} metalness={0.4} />
        )}
      </mesh>
      <mesh position={[0, cm(top - height + 0.7), 0]}>
        <cylinderGeometry args={[cm(5.2), cm(6), cm(1.4), 24]} />
        <meshStandardMaterial color="#2c3340" roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  );
}

const STEEL = { color: "#2d3748", roughness: 0.45, metalness: 0.65 };
const BRASS = { color: "#d4af37", roughness: 0.3, metalness: 0.85 };

/**
 * A torch. Its filament sits at the origin of this group — exactly the point
 * the rays are fired from — with the lens a couple of millimetres in front and
 * the barrel running back behind it.
 */
function Torch({ on }) {
  return (
    <group>
      {/* Post, saddle and clamp ring under the middle of the barrel */}
      <group position={[0, 0, cm(-5.9)]}>
        <Post top={-3.9} />
        <mesh position={[0, cm(-3.5), 0]}>
          <boxGeometry args={[cm(3.2), cm(0.9), cm(4.2)]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[cm(3.25), cm(3.25), cm(1.4), 28]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh position={[cm(3.5), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[cm(0.55), cm(0.55), cm(0.7), 12]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      </group>

      {/* Barrel, knurled grip ribs, tail cap and click button */}
      <mesh position={[0, 0, cm(-5.9)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[cm(3.1), cm(2.7), cm(8.4), 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.7} />
      </mesh>
      {[-4.4, -5.9, -7.4].map((z) => (
        <mesh key={z} position={[0, 0, cm(z)]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[cm(3.18), cm(3.18), cm(0.5), 32]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0, cm(-10.6)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[cm(2.9), cm(2.5), cm(1.1), 28]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0, cm(-11.4)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[cm(1.0), cm(1.0), cm(0.4), 16]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Head: an open shell round the reflector, so the dish shows */}
      <mesh position={[0, 0, cm(-0.7)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[cm(3.5), cm(3.1), cm(2.0), 32, 1, true]} />
        <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, cm(-1.7)]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[cm(3.1), 32]} />
        <meshStandardMaterial color="#0b1220" roughness={0.7} metalness={0.4} />
      </mesh>
      {/* Chrome reflector dish, apex back, opening forward */}
      <mesh position={[0, 0, cm(-1.45)]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[cm(3.25), cm(3.2), 32, 1, true]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.08} metalness={0.96} side={THREE.DoubleSide} />
      </mesh>
      {/* Glass lens and its brass bezel */}
      <mesh position={[0, 0, cm(0.3)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[cm(3.3), cm(3.3), cm(0.15), 32]} />
        <meshPhysicalMaterial color="#e0f2fe" roughness={0.05} transparent opacity={0.3} ior={1.5} />
      </mesh>
      <mesh position={[0, 0, cm(0.3)]}>
        <torusGeometry args={[cm(3.45), cm(0.24), 10, 40]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>

      {/* The filament: a glowing dot at the origin. Drawn a little bigger than
          the 2 mm the optics uses, so it can be seen from across the bench. */}
      <mesh>
        <sphereGeometry args={[cm(0.42), 16, 16]} />
        <meshStandardMaterial color="#fffbe8" emissive="#ffe9a8" emissiveIntensity={on ? 3.4 : 0.1} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A fluorescent tube lying across the bench, centred on the origin of this group. */
function TubeLamp({ width, on }) {
  return (
    <group>
      {/* Post behind the tube, and the chassis bar it carries */}
      <group position={[0, 0, cm(-1.85)]}>
        <Post top={-0.55} radius={1.1} />
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[cm(0.35), cm(0.35), cm(width + 1.8), 16]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.7} />
        </mesh>
        <mesh position={[cm(1.9), cm(-0.55), 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[cm(0.55), cm(0.55), cm(0.7), 12]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      </group>

      {/* Bi-pin socket end-caps with brass contact rings */}
      {[-1, 1].map((s) => (
        <group key={s} position={[cm(s * (width / 2 + 0.5)), 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[cm(1.7), cm(1.7), cm(1.0), 20]} />
            <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[cm(-s * 0.55), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[cm(1.5), cm(1.5), cm(0.2), 20]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        </group>
      ))}

      {/* Frosted diffuser tube — the emitting face the optics samples */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[cm(1.35), cm(1.35), cm(width), 24]} />
        <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={on ? 2.5 : 0.1} roughness={0.35} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[cm(0.35), cm(0.35), cm(width * 0.94), 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#fffbeb" emissiveIntensity={on ? 3.5 : 0.1} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The lamp, standing on the optical axis at its bench position. */
function LightSource({ benchZ, source, on }) {
  const broad = source === "broad";
  return (
    <group position={[0, cm(AXIS_CM), zAt(benchZ)]}>
      {broad ? <TubeLamp width={SOURCES.broad.width} on={on} /> : <Torch on={on} />}
      {on && (
        <pointLight
          position={[0, 0, cm(broad ? 1.8 : 0.9)]}
          intensity={broad ? 9 : 7}
          distance={cm(260)}
          color="#fff3cf"
        />
      )}
      <SceneLabel position={[0, cm(broad ? 4.6 : 6.4), 0]} accent>
        {SOURCES[source].label}
      </SceneLabel>
    </group>
  );
}

/**
 * The object on its stand: the very mesh the rays are fired at, turned by the
 * very rotation the optics applies (a tip about x or a spin about y, per shape).
 */
function TestObject({ shape, rotation, material, benchZ }) {
  const m = MATERIALS[material];
  const solid = useMemo(() => getSolid(shape), [shape]);
  const axis = SHAPE_DEFS[shape].turn;
  const rock = axis === "x" ? [rotation, 0, 0] : [0, rotation, 0];
  // Where the turned solid's lowest point hangs — the top of its stand.
  const stand = underside(shape, rotation) + 0.25;

  return (
    <group position={[0, cm(AXIS_CM), zAt(benchZ)]}>
      <Post top={-stand} radius={0.8} glass />
      <mesh geometry={solid.geometry} rotation={rock} scale={CM}>
        <meshPhysicalMaterial
          color={material === "opaque" ? "#b9784a" : material === "translucent" ? "#cfe6f2" : "#dff2ff"}
          roughness={material === "opaque" ? 0.7 : 0.15}
          metalness={0}
          transmission={m.transmission}
          thickness={material === "opaque" ? 0 : 1.2}
          transparent={m.transmission > 0}
          opacity={material === "transparent" ? 0.22 : material === "translucent" ? 0.62 : 1}
          ior={1.45}
        />
      </mesh>
    </group>
  );
}

/**
 * The projection screen.
 *
 * The shadow is the screen's own texture, so it is bounded by the paper, lands
 * on both faces of it and cannot float free of the surface.
 */
function ProjectionScreen({ benchZ, texture, curtain, overflows }) {
  return (
    <group position={[0, cm(AXIS_CM), zAt(benchZ)]}>
      {/* Frame — BEHIND the paper. The lamp is on −Z, so anything mounted on
          that side of the panel stands between the camera and the very surface
          the shadow is cast on, and hides all of it. */}
      <mesh position={[0, 0, cm(0.9)]}>
        <boxGeometry args={[cm(SCREEN.halfW * 2 + 3), cm(SCREEN.halfH * 2 + 3), cm(1.2)]} />
        <meshStandardMaterial color="#2f3745" roughness={0.65} metalness={0.35} />
      </mesh>

      {/* The paper itself. Unlit on purpose: what the child sees is exactly the
          illumination the optics module computed, not that plus a key light. */}
      <mesh rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[cm(SCREEN.halfW * 2), cm(SCREEN.halfH * 2)]} />
        {curtain ? (
          <meshStandardMaterial color="#6d3f8f" roughness={0.9} side={THREE.DoubleSide} />
        ) : (
          <meshBasicMaterial map={texture ?? undefined} side={THREE.DoubleSide} toneMapped={false} />
        )}
      </mesh>

      {/* Stand: two short legs onto a foot that rests on the bench. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[cm(side * (SCREEN.halfW - 5)), cm(-SCREEN.halfH - 0.6), cm(1.4)]}
        >
          <boxGeometry args={[cm(1.8), cm(AXIS_CM - SCREEN.halfH + 1.2), cm(1.8)]} />
          <meshStandardMaterial color="#39414f" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, cm(-AXIS_CM + 0.8), cm(1.4)]}>
        <boxGeometry args={[cm(SCREEN.halfW * 1.6), cm(1.6), cm(9)]} />
        <meshStandardMaterial color="#39414f" roughness={0.6} />
      </mesh>

      <SceneLabel position={[0, cm(SCREEN.halfH + 5), 0]} tone="text-ink-300">
        {curtain
          ? "screen covered — make your prediction!"
          : overflows
            ? "projection screen — shadow is running off the edge"
            : "projection screen"}
      </SceneLabel>
    </group>
  );
}

// ─── The rays ───────────────────────────────────────────────────────

const RAY_COLOURS = { fan: "#f8fafc", outer: "#38bdf8", inner: "#fbbf24" };

/**
 * The straight lines light takes: from the lamp, grazing the object, on to the
 * screen. Each one passes exactly through a vertex of the drawn solid and
 * lands exactly on the shadow's edge — draw them and there is nowhere for the
 * shadow to be but where the lines say.
 */
function LightRays({ rays }) {
  const groups = useMemo(() => {
    const at = ([x, y, z]) => [cm(x), cm(AXIS_CM + y), zAt(z)];
    const out = {};
    for (const r of rays) {
      const g = (out[r.kind] ??= { near: [], far: [] });
      g.near.push(at(r.from), at(r.through));
      g.far.push(at(r.through), at(r.to));
    }
    return out;
  }, [rays]);

  return (
    <group>
      {Object.entries(groups).map(([kind, g]) => (
        <group key={kind}>
          <Line points={g.near} segments color={RAY_COLOURS[kind]} lineWidth={1.4} transparent opacity={0.85} />
          <Line points={g.far} segments color={RAY_COLOURS[kind]} lineWidth={1.1} transparent opacity={0.45} />
        </group>
      ))}
    </group>
  );
}

// ─── Face-on view of the screen ─────────────────────────────────────

/**
 * The screen's own canvas, mounted straight into the HUD.
 *
 * Not a second drawing of the shadow — literally the same element the WebGL
 * texture samples, so the inset and the scene can never disagree, and the
 * child always has one unambiguous face-on view no matter where they have
 * orbited the camera to.
 */
function ScreenPreview({ canvas, covered, solved }) {
  const host = useRef(null);

  useEffect(() => {
    const el = host.current;
    if (!el || !canvas) return undefined;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";
    el.appendChild(canvas);
    return () => {
      if (canvas.parentNode === el) el.removeChild(canvas);
    };
  }, [canvas]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
      <div ref={host} aria-hidden="true" />
      {covered && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#6d3f8f]/95 text-[10.5px] font-medium text-white/90">
          screen covered
        </div>
      )}
      {!covered && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-1.5 py-1 text-[9px] font-mono text-ink-950/70">
          <span>grid = 10 cm</span>
          <span>
            {solved.shadowWidthCm.toFixed(1)} × {solved.shadowHeightCm.toFixed(1)} cm
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Predict-the-shadow game ────────────────────────────────────────

const GUESSES = [
  { value: "bigger", label: "Bigger" },
  { value: "same", label: "About the same" },
  { value: "smaller", label: "Smaller" },
];

/**
 * Marks a prediction against the geometry rather than against a stored answer,
 * so the game stays honest no matter what the child changed in between.
 */
function judgeGuess(guess, before, after) {
  const ratio = after / Math.max(before, 1e-6);
  const truth = ratio > 1.05 ? "bigger" : ratio < 0.95 ? "smaller" : "same";
  return { truth, correct: guess === truth, ratio };
}

// ─── The scene ──────────────────────────────────────────────────────

export default function ShadowLabCanvas({ onOpenQuiz }) {
  const [lightZ, setLightZ] = useState(BENCH.lightHome);
  const [objectZ, setObjectZ] = useState(BENCH.objectHome);
  const [screenZ, setScreenZ] = useState(BENCH.screenHome);
  const [shape, setShape] = useState("cylinder");
  const [rotationDeg, setRotationDeg] = useState(0);
  const [material, setMaterial] = useState("opaque");
  const [source, setSource] = useState("point");
  const [showGuides, setShowGuides] = useState(true);
  const [showRays, setShowRays] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [game, setGame] = useState(null);

  // Resizable panel width state (10% to 80% screen width)
  // Default to 288 to match SSR markup, then hydrate saved width on client mount
  const [panelWidth, setPanelWidth] = useState(288);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("socratic_hud_panel_width");
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 180 && parsed <= (window.innerWidth || 1920) * 0.85) {
            setPanelWidth(parsed);
          }
        }
      }
    } catch (_) {}
  }, []);

  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = panelWidth;

    let rafId;
    const onPointerMove = (moveEvent) => {
      if (!isResizingRef.current) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const deltaX = moveEvent.clientX - startX;
        const minW = Math.max(180, Math.floor(window.innerWidth * 0.10));
        const maxW = Math.floor(window.innerWidth * 0.80);
        const clamped = Math.min(Math.max(startWidth + deltaX, minW), maxW);
        setPanelWidth(clamped);
      });
    };

    const cleanup = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      try {
        if (typeof window !== "undefined") {
          setPanelWidth((curr) => {
            localStorage.setItem("socratic_hud_panel_width", String(curr));
            return curr;
          });
        }
      } catch (_) {}
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  const rotation = (rotationDeg * Math.PI) / 180;
  const turnAxis = SHAPE_DEFS[shape].turn;
  const gap = benchGap(shape);

  // One cast for everything on screen: the numbers, the picture and the words
  // all come from the same rays.
  const geo = useMemo(() => {
    const params = { lightZ, objectZ, screenZ, shape, rotation, material, source };
    const solved = solveShadow(params);
    const field = castShadow(params, { pxPerCm: PX_PER_CM });
    return { solved, field, umbra: hasUmbra(field), description: describeShadow({ shape, rotation, field }) };
  }, [lightZ, objectZ, screenZ, shape, rotation, material, source]);
  const { solved } = geo;

  const curtain = game?.stage === "predict";
  const { canvas, texture } = useScreenCanvas(geo, showGuides);

  const rays = useMemo(
    () => (showRays ? lightRays({ shape, rotation, lightZ, objectZ, screenZ, source }) : []),
    [showRays, shape, rotation, lightZ, objectZ, screenZ, source],
  );

  /** True once the shadow no longer fits on the paper — worth saying out loud. */
  const overflows = !shadowFitsScreen(solved);

  // The bench must stay in order: lamp behind the object, screen in front, and
  // far enough apart that the solid, turned any way, clears both.
  const setLight = useCallback((v) => setLightZ(clamp(v, BENCH.min, objectZ - gap)), [objectZ, gap]);
  const setObject = useCallback(
    (v) => setObjectZ(clamp(v, lightZ + gap, screenZ - gap)),
    [lightZ, screenZ, gap],
  );
  const setScreen = useCallback((v) => setScreenZ(clamp(v, objectZ + gap, BENCH.max)), [objectZ, gap]);

  const place = useCallback((layout, forShape) => {
    const fixed = enforceBench(layout, forShape);
    setLightZ(fixed.lightZ);
    setObjectZ(fixed.objectZ);
    setScreenZ(fixed.screenZ);
  }, []);

  const changeShape = useCallback(
    (next) => {
      setShape(next);
      setRotationDeg(0);
      place({ lightZ, objectZ, screenZ }, next);
    },
    [lightZ, objectZ, screenZ, place],
  );

  const reset = useCallback(() => {
    setLightZ(BENCH.lightHome);
    setObjectZ(BENCH.objectHome);
    setScreenZ(BENCH.screenHome);
    setShape("cylinder");
    setRotationDeg(0);
    setMaterial("opaque");
    setSource("point");
    setShowGuides(true);
    setShowRays(true);
    setGame(null);
  }, []);

  const applyPreset = useCallback(
    (key) => {
      const preset = PRESETS[key];
      const next = preset.shape ?? shape;
      if (preset.shape) setShape(preset.shape);
      if (preset.rotation !== undefined) setRotationDeg(Math.round((preset.rotation * 180) / Math.PI));
      place(
        {
          lightZ: preset.lightZ ?? lightZ,
          objectZ: preset.objectZ ?? objectZ,
          screenZ: preset.screenZ ?? screenZ,
        },
        next,
      );
    },
    [shape, lightZ, objectZ, screenZ, place],
  );

  const startGame = useCallback(() => {
    setGame({ stage: "predict", startWidth: solved.shadowWidthCm, guess: null, result: null });
  }, [solved.shadowWidthCm]);

  const submitGuess = useCallback(
    (guess) => {
      setGame((g) =>
        g ? { ...g, stage: "revealed", guess, result: judgeGuess(guess, g.startWidth, solved.shadowWidthCm) } : g,
      );
    },
    [solved.shadowWidthCm],
  );

  const fuzzyCm = Math.max(solved.horizontal.penumbraWidth, solved.vertical.penumbraWidth);

  return (
    <div className="relative h-full w-full bg-ink-950">
      <SceneCanvas
        // Framed from BEHIND THE TORCH, looking down the bench. The shadow
        // lands on the face of the screen that points back at the lamp, so a
        // camera parked past the screen — as this one used to be — sees only
        // its blank back, edge-on and half out of frame.
        camera={{ position: [cm(92), cm(74), zAt(SCENE.cameraBenchZ)], fov: 48 }}
        controls={{ minDistance: 3, maxDistance: 30, target: [0, cm(AXIS_CM - 8), zAt(SCENE.targetBenchZ)] }}
        lights={{ ambient: 0.5, keyLight: 0.55 }}
      >
        <Bench />
        <LightSource benchZ={lightZ} source={source} on />
        <TestObject shape={shape} rotation={rotation} material={material} benchZ={objectZ} />
        <ProjectionScreen
          benchZ={screenZ}
          texture={texture}
          curtain={curtain}
          overflows={overflows}
        />
        {showRays && !curtain && <LightRays rays={rays} />}
      </SceneCanvas>

      {/* ─── Controls ─────────────────────────────────────── */}
      {!panelOpen ? (
        <div className="pointer-events-auto absolute left-4 top-4 z-20">
          <HudButton icon={Lightbulb} onClick={() => setPanelOpen(true)}>
            Controls
          </HudButton>
        </div>
      ) : (
        <div
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ width: `${panelWidth}px`, maxWidth: "80vw", minWidth: "10vw" }}
          className={`pointer-events-auto absolute left-4 top-4 z-20 flex max-h-[calc(100%-2rem)] flex-col gap-3 ${
            isResizing ? "select-none" : ""
          }`}
        >
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl">
            <div className="max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5 flex flex-col gap-3">
              <HudPanel
            title="Shadow lab"
            icon={Lightbulb}
            action={
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Hide controls"
                className="shrink-0 rounded p-0.5 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
              >
                ✕
              </button>
            }
          >
            <div className="space-y-3">
              <Slider
                label="🔦 Torch position"
                value={lightZ}
                onChange={setLight}
                min={BENCH.min}
                max={BENCH.max - 10}
                step={1}
                format={(v) => `${v} cm`}
              />
              <Slider
                label="🧊 Object position"
                value={objectZ}
                onChange={setObject}
                min={BENCH.min + 5}
                max={BENCH.max - 5}
                step={1}
                format={(v) => `${v} cm`}
              />
              <Slider
                label="⬜ Screen position"
                value={screenZ}
                onChange={setScreen}
                min={BENCH.min + 10}
                max={BENCH.max}
                step={1}
                format={(v) => `${v} cm`}
              />

              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">Shape on the stand</p>
                <ShapeDropdown value={shape} onChange={changeShape} />
              </div>

              <Slider
                label={turnAxis === "x" ? "Tip toward the screen" : "Spin on the stand"}
                value={rotationDeg}
                onChange={setRotationDeg}
                min={0}
                max={360}
                step={5}
                format={(v) => `${v}°`}
              />

              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">What is it made of?</p>
                <Choice options={MATERIAL_OPTIONS} value={material} onChange={setMaterial} columns={3} />
              </div>

              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">Kind of lamp</p>
                <Choice
                  options={Object.entries(SOURCES).map(([value, s]) => ({ value, label: s.label }))}
                  value={source}
                  onChange={setSource}
                  columns={2}
                />
              </div>

              <Toggle label="Show the light rays" checked={showRays} onChange={setShowRays} />
              <Toggle label="Mark umbra / penumbra" checked={showGuides} onChange={setShowGuides} />

              <div className="grid grid-cols-1 gap-1 border-t border-ink-800 pt-2.5">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <HudButton key={key} icon={key === "circle" ? RotateCw : Sparkles} onClick={() => applyPreset(key)}>
                    {preset.label}
                  </HudButton>
                ))}
                <HudButton icon={RotateCcw} onClick={reset}>
                  Reset the bench
                </HudButton>
                {onOpenQuiz && (
                  <HudButton icon={Target} variant="primary" onClick={onOpenQuiz}>
                    Test understanding
                  </HudButton>
                )}
              </div>
            </div>
          </HudPanel>

          {/* ─── The screen, face on ──────────────────── */}
          <HudPanel title="On the screen" icon={Ruler}>
            <ScreenPreview canvas={canvas} covered={curtain} solved={solved} />
            <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
              {curtain
                ? "Covered up. Change something on the bench, then predict what the shadow did."
                : showGuides && fuzzyCm > 0.4
                  ? "Gold dashes mark where the fully dark umbra ends; blue dashes mark the outer edge of the fuzzy penumbra."
                  : "Every square is 10 cm, so the shadow can be measured straight off the paper."}
            </p>
            {showRays && !curtain && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-ink-500">
                Each white line is one straight ray from the {source === "broad" ? "lamp's middle" : "torch"}, grazing the
                shape and landing on the edge of its shadow.
                {source === "broad"
                  ? " Blue rays leave the lamp's ends and bound the penumbra; gold ones bound the umbra."
                  : ""}
              </p>
            )}
          </HudPanel>

          {/* ─── What is happening ────────────────────── */}
          <HudPanel title="What the shadow is doing" icon={Eye}>
            <div className="space-y-2 text-[11px] leading-relaxed">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-400">Shadow size</span>
                <span className="font-mono font-semibold text-duck-300">
                  {solved.castsShadow ? `${solved.shadowWidthCm.toFixed(1)} × ${solved.shadowHeightCm.toFixed(1)} cm` : "none"}
                </span>
              </div>
              <div
                className="flex items-baseline justify-between gap-2"
                title="Exact for a thin object. A thick one is magnified a little more on the side facing the torch, and a little less on the far side — the rays settle it."
              >
                <span className="text-ink-400">Times bigger (at its middle)</span>
                <span className="font-mono font-semibold text-duck-300">{solved.magnification.toFixed(2)}×</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-400">Torch → object</span>
                <span className="font-mono text-ink-200">{solved.lightToObject.toFixed(0)} cm</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-400">Object → screen</span>
                <span className="font-mono text-ink-200">{solved.objectToScreen.toFixed(0)} cm</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-400">Fuzzy edge</span>
                <span className="font-mono text-ink-200">
                  {fuzzyCm < 0.05 ? "sharp" : `${fuzzyCm.toFixed(1)} cm`}
                </span>
              </div>

              <p className="rounded border border-ink-700 bg-ink-850 px-2 py-1.5 text-[10.5px] text-ink-300">
                {!solved.castsShadow
                  ? "Light goes almost straight through, so there is hardly any shadow to see. Transparent things do not block light."
                  : overflows
                    ? "The shadow has grown bigger than the screen, so its edges are running off the paper. Slide the screen closer to the object to fit it back on."
                    : material === "translucent"
                      ? "Some light gets through, so the shadow is pale and grey instead of black — and darker where the object is thicker, because the light had further to go."
                      : !geo.umbra
                        ? "The lamp is so wide that every part of the shadow can still see a bit of it. There is no fully dark middle left — only a fuzzy penumbra."
                        : `The shadow is ${geo.description}. Move the torch closer to make it bigger, or slide the screen nearer to make it smaller.`}
              </p>
              <p className="text-[10px] leading-relaxed text-ink-500">
                The object is held on a clear acrylic rod, so its stand casts no shadow of its own.
              </p>
            </div>
          </HudPanel>

          {/* ─── Predict the shadow ───────────────────── */}
          <HudPanel title="Predict the shadow" icon={game ? EyeOff : Eye}>
            {!game ? (
              <>
                <p className="mb-2 text-[10.5px] leading-relaxed text-ink-400">
                  Hide the screen, change something, then guess what happened to the shadow.
                </p>
                <HudButton variant="primary" onClick={startGame} className="w-full">
                  Cover the screen
                </HudButton>
              </>
            ) : game.stage === "predict" ? (
              <>
                <p className="mb-2 text-[10.5px] leading-relaxed text-ink-400">
                  The screen is covered. Move the torch, the object or the screen — then predict: is the shadow now
                  bigger, smaller, or about the same?
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {GUESSES.map((g) => (
                    <HudButton key={g.value} onClick={() => submitGuess(g.value)}>
                      {g.label}
                    </HudButton>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p
                  className={`mb-2 rounded-md border px-2 py-1.5 text-[11px] font-medium ${
                    game.result.correct
                      ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-300"
                      : "border-rose-500/45 bg-rose-500/12 text-rose-300"
                  }`}
                >
                  {game.result.correct ? "Correct!" : `Not quite — it got ${game.result.truth}.`}
                </p>
                <p className="mb-2 text-[10.5px] leading-relaxed text-ink-400">
                  The shadow went from {game.startWidth.toFixed(1)} cm to {solved.shadowWidthCm.toFixed(1)} cm —
                  that is {game.result.ratio.toFixed(2)}× the size it was.
                </p>
                <HudButton variant="primary" onClick={startGame} className="w-full">
                  Play again
                </HudButton>
              </>
            )}
          </HudPanel>
            </div>

            {/* ─── Right Edge Drag-To-Resize Handle (10% to 80% screen width) ─── */}
            <div
              onPointerDown={handleResizePointerDown}
              className="absolute -right-1 top-0 bottom-0 z-30 flex w-3.5 cursor-ew-resize items-center justify-center select-none group"
              title="Drag to resize panel (10% to 80% screen width)"
            >
              <div
                className={`h-14 w-1 rounded-full transition-all ${
                  isResizing ? "bg-duck-400 shadow-md scale-y-110" : "bg-ink-700/50 group-hover:bg-duck-400/80 group-hover:h-20"
                }`}
              />
            </div>

            {/* ─── Bottom-Right Corner Resize Grip Indicator ─── */}
            <div
              onPointerDown={handleResizePointerDown}
              className="absolute bottom-1.5 right-1.5 z-30 cursor-nwse-resize p-1 text-ink-600 transition-colors hover:text-duck-400 select-none"
              title="Drag to resize panel width"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-60 hover:opacity-100 fill-current">
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="8" cy="4" r="1.2" />
                <circle cx="4" cy="8" r="1.2" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
