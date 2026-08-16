"use client";

import { useMemo, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Html as DreiHtml, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_GRAPHICS_SETTINGS } from "@/lib/db";

// ─── Shared 3D kit ──────────────────────────────────────────────────
// Camera rig, lighting, and the primitives (arrows, bonds, labels) that
// every scene in Physics / Chemistry / Biology draws with. Keeping them
// here is what makes thirteen scenes look like one product.
// ─────────────────────────────────────────────────────────────────────

/**
 * WebGL clear colour. Three.js cannot read Tailwind's `--color-ink-950`,
 * so this must be kept in step with globals.css by hand — otherwise the
 * viewport shows a seam against the page behind it.
 */
export const CANVAS_BG = "#090d16";

export const PALETTE = {
  gold: "#fbbf24",
  goldDim: "#f59e0b",
  sky: "#38bdf8",
  emerald: "#34d399",
  rose: "#fb7185",
  violet: "#a78bfa",
  slate: "#64748b",
  bone: "#e8ebf0",
  line: "#333a45",
};

/**
 * `keyLight`, not `key`: React reserves `key`, so spreading a `lights` object
 * that carried one both dropped the value and logged a warning per frame.
 */
export function StudioLights({ ambient = 0.55, keyLight = 1.5, rim = PALETTE.sky }) {
  return (
    <>
      <ambientLight intensity={ambient} />
      <directionalLight position={[6, 9, 6]} intensity={keyLight} castShadow />
      <directionalLight position={[-7, -4, -6]} intensity={0.42} color={rim} />
    </>
  );
}

function PerformanceManager({ autoPauseHidden }) {
  const setFrameloop = useThree((state) => state.setFrameloop);
  
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && autoPauseHidden) {
        setFrameloop("demand"); // "demand" pauses the continuous rAF loop while tab is hidden
      } else {
        setFrameloop("always");
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibility);
    // Trigger once on mount
    handleVisibility();
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [autoPauseHidden, setFrameloop]);

  return null;
}

export function WebGLCleanup() {
  const { scene } = useThree();
  useEffect(() => {
    return () => {
      try {
        if (scene) {
          scene.traverse((object) => {
            try {
              if (object.geometry) object.geometry.dispose();
              if (object.material) {
                if (Array.isArray(object.material)) {
                  object.material.forEach((m) => {
                    m?.dispose?.();
                    if (m?.map) m.map?.dispose?.();
                  });
                } else {
                  object.material?.dispose?.();
                  if (object.material?.map) object.material.map?.dispose?.();
                }
              }
            } catch (_) {
              // Safe geometry/material disposal
            }
          });
        }
      } catch (_) {
        // Safe scene teardown
      }
    };
  }, [scene]);
  return null;
}

/**
 * Every scene mounts through here, so orbit behaviour, colour management
 * and DPR policy are decided once.
 */
export function SceneCanvas({
  camera = { position: [0, 2.5, 11], fov: 45 },
  controls,
  fog,
  lights,
  onPointerMissed,
  children,
}) {
  // Read graphics settings reactively
  const gfxArray = useLiveQuery(() => db.settings.where('key').startsWith('gfx_').toArray());
  
  const gfx = useMemo(() => {
    const s = { ...DEFAULT_GRAPHICS_SETTINGS };
    if (gfxArray) {
      for (const item of gfxArray) {
        const key = item.key.replace("gfx_", "");
        s[key] = item.value;
      }
    }
    return s;
  }, [gfxArray]);

  return (
    <Canvas
      camera={camera}
      dpr={[1, gfx.pixelRatio]}
      shadows={gfx.enableShadows}
      gl={{ antialias: gfx.enableAntialias, powerPreference: "high-performance" }}
      onPointerMissed={onPointerMissed}
      frameloop="always"
    >
      <WebGLCleanup />
      <PerformanceManager autoPauseHidden={gfx.autoPauseHidden} />
      <color attach="background" args={[CANVAS_BG]} />
      {fog && <fog attach="fog" args={[CANVAS_BG, fog[0], fog[1]]} />}
      <StudioLights {...lights} />
      {children}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={45}
        autoRotate={controls?.autoRotate ?? false}
        autoRotateSpeed={0.45}
        {...controls}
      />
    </Canvas>
  );
}

// ─── In-scene text ──────────────────────────────────────────────────

export function SceneLabel({
  position,
  children,
  tone = "text-ink-200",
  accent = false,
  distanceFactor,
}) {
  return (
    <Html
      position={position}
      center
      distanceFactor={distanceFactor}
      style={{ pointerEvents: "none" }}
      zIndexRange={[40, 0]}
    >
      <span
        className={`whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm ${
          accent
            ? "border-duck-500/50 bg-duck-500/15 text-duck-300"
            : `border-ink-800 bg-ink-950/85 ${tone}`
        }`}
      >
        {children}
      </span>
    </Html>
  );
}

// ─── Corner-pinned panels ───────────────────────────────────────────

const PANEL_PAD = 14;

/**
 * Panels pinned to a corner of the viewport rather than to a point in the
 * scene.
 *
 * These used to sit at world coordinates, which meant that the moment you
 * orbited — exactly when you most want to read the numbers — the panel swung
 * behind the model or off the edge of the canvas. `calculatePosition` hands
 * back pixels, so the corner is resolved against the live canvas size every
 * frame and the panel simply stays where you left it.
 */
const CORNERS = {
  "top-left": { at: () => [PANEL_PAD, PANEL_PAD], shift: "none" },
  "top-right": { at: (s) => [s.width - PANEL_PAD, PANEL_PAD], shift: "translateX(-100%)" },
  "bottom-left": { at: (s) => [PANEL_PAD, s.height - PANEL_PAD], shift: "translateY(-100%)" },
  "bottom-right": {
    at: (s) => [s.width - PANEL_PAD, s.height - PANEL_PAD],
    shift: "translate(-100%, -100%)",
  },
};

function PinnedPanel({ corner = "top-right", children }) {
  const { at, shift } = CORNERS[corner] ?? CORNERS["top-right"];
  // Two panels share the right-hand edge. Capping each at a little under half
  // the canvas is what makes the overlap impossible rather than merely
  // unlikely — a short viewport used to let a long readout run into the
  // legend below it.
  const height = useThree((state) => state.size.height);
  const maxHeight = Math.max(120, height / 2 - PANEL_PAD * 1.5);

  return (
    <Html
      calculatePosition={(_el, _camera, size) => at(size)}
      style={{ pointerEvents: "none" }}
      zIndexRange={[30, 0]}
    >
      <div style={{ transform: shift, display: "inline-block" }}>
        {/* Pointer events come back on so a capped panel can be scrolled;
            that also stops a drag inside a panel from spinning the model, and stops wheel events zooming the canvas. */}
        <div
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ maxHeight, overflowY: "auto", pointerEvents: "auto" }}
        >
          {children}
        </div>
      </div>
    </Html>
  );
}

const NOTE_STYLES = {
  neutral: "border-ink-700 bg-ink-850 text-ink-400",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

const VALUE_TONES = {
  good: "text-emerald-400",
  bad: "text-rose-400",
  warn: "text-amber-400",
  gold: "text-duck-300",
};

/**
 * The live numbers for a scene. Scenes own values the HUD cannot know —
 * measured pressure, instantaneous e.m.f., reaction rate — so they surface
 * them here rather than pushing state back up on every frame.
 */
export function SceneReadout({
  corner = "top-right",
  title,
  subtitle,
  rows = [],
  note,
  noteTone = "neutral",
  hidden = false,
}) {
  if (hidden) return null;
  return (
    <PinnedPanel corner={corner}>
      <div className="w-[184px] rounded-lg border border-ink-700 bg-ink-950/92 p-3 shadow-2xl backdrop-blur-md sm:w-[204px]">
        {title && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-200">
            {title}
          </p>
        )}
        {subtitle && <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{subtitle}</p>}
        {(title || subtitle) && rows.length > 0 && (
          <div className="my-2 h-px bg-ink-800" aria-hidden="true" />
        )}

        <div className="space-y-1">
          {/* Keyed by position, not by label: rows are a fixed-length list a
              scene rebuilds each render, and two rows may legitimately want
              the same label. */}
          {rows.map(([label, value, tone], i) => (
            <div key={i} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[10px] text-ink-500">{label}</span>
              <span
                className={`shrink-0 text-[11.5px] font-semibold tabular-nums ${
                  VALUE_TONES[tone] ?? "text-ink-100"
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {note && (
          <p
            className={`mt-2 rounded border px-1.5 py-1 text-[9.5px] leading-relaxed ${NOTE_STYLES[noteTone]}`}
          >
            {note}
          </p>
        )}
      </div>
    </PinnedPanel>
  );
}

/**
 * Colour key. Every scene codes meaning into colour — which sphere is the
 * cation, which ray is the emergent one — and until now nothing said so.
 * `shape` matches how the thing is actually drawn, so the swatch reads as a
 * miniature of the object rather than a generic bullet.
 */
export function SceneLegend({ corner = "bottom-right", title = "Key", items = [] }) {
  const swatch = (item) => {
    const shape = item.shape ?? "dot";
    if (shape === "line" || shape === "dash") {
      return (
        <span
          className="mt-[5px] h-0.5 w-3 shrink-0 rounded-full"
          style={{
            background:
              shape === "dash"
                ? `repeating-linear-gradient(90deg, ${item.color} 0 3px, transparent 3px 6px)`
                : item.color,
          }}
        />
      );
    }
    return (
      <span
        className={`mt-[3px] h-2.5 w-2.5 shrink-0 ${shape === "square" ? "rounded-[3px]" : "rounded-full"}`}
        style={{ background: item.color, boxShadow: `0 0 6px ${item.color}66` }}
      />
    );
  };

  return (
    <PinnedPanel corner={corner}>
      <div className="w-[184px] rounded-lg border border-ink-700 bg-ink-950/92 p-3 shadow-2xl backdrop-blur-md sm:w-[204px]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-200">{title}</p>
        <div className="my-2 h-px bg-ink-800" aria-hidden="true" />
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              {swatch(item)}
              <span className="min-w-0 flex-1">
                <span className="block text-[10.5px] leading-snug text-ink-200">{item.label}</span>
                {item.note && (
                  <span className="block text-[9.5px] leading-snug text-ink-500">{item.note}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PinnedPanel>
  );
}

// ─── Geometry primitives ────────────────────────────────────────────

const UP = new THREE.Vector3(0, 1, 0);

/** Orientation + midpoint for a segment, shared by Bond and VectorArrow. */
function useSegment(from = [0, 0, 0], to = [0, 1, 0]) {
  return useMemo(() => {
    const fromArr = Array.isArray(from) ? from : [0, 0, 0];
    const toArr = Array.isArray(to) ? to : [0, 1, 0];
    const a = new THREE.Vector3(fromArr[0] ?? 0, fromArr[1] ?? 0, fromArr[2] ?? 0);
    const b = new THREE.Vector3(toArr[0] ?? 0, toArr[1] ?? 0, toArr[2] ?? 0);
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = delta.length();
    const direction = length > 1e-6 ? delta.clone().normalize() : UP.clone();
    return {
      a,
      length,
      direction,
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, direction),
      midpoint: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
    };
    // Arrays are fresh objects on every render, so depend on the numbers.
  }, [from?.[0], from?.[1], from?.[2], to?.[0], to?.[1], to?.[2]]);
}

export function Bond({
  from = [0, 0, 0],
  to = [0, 1, 0],
  radius = 0.075,
  color = PALETTE.line,
  opacity = 1,
  emissive,
}) {
  const { length, quaternion, midpoint } = useSegment(from, to);
  if (length < 1e-6) return null;
  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 14]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={emissive ? 0.7 : 0.12}
        roughness={0.4}
        metalness={0.2}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

/** Shaft + head + optional floating label. The workhorse for vector fields. */
export function VectorArrow({
  from = [0, 0, 0],
  to = [0, 1, 0],
  color = PALETTE.gold,
  radius = 0.05,
  headLength = 0.34,
  headRadius = 0.14,
  label,
  labelOffset = 0.42,
  opacity = 1,
}) {
  const { a, length, direction, quaternion } = useSegment(from, to);
  if (length < headLength * 1.1) return null;

  const shaft = length - headLength;
  const shaftCentre = a.clone().addScaledVector(direction, shaft / 2);
  const headCentre = a.clone().addScaledVector(direction, shaft + headLength / 2);
  const labelAt = a.clone().addScaledVector(direction, length + labelOffset);

  return (
    <group>
      <mesh position={shaftCentre} quaternion={quaternion}>
        <cylinderGeometry args={[radius, radius, shaft, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.1}
          toneMapped={false}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      <mesh position={headCentre} quaternion={quaternion}>
        <coneGeometry args={[headRadius, headLength, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          toneMapped={false}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      {label && (
        <DreiHtml position={labelAt} center style={{ pointerEvents: "none" }} zIndexRange={[40, 0]}>
          <div 
            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm whitespace-nowrap"
            style={{ backgroundColor: color, opacity: 0.9 }}
          >
            {label}
          </div>
        </DreiHtml>
      )}
    </group>
  );
}

export function AtomSphere({
  position,
  radius = 0.3,
  color = PALETTE.bone,
  emissiveIntensity = 0.45,
  opacity = 1,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  return (
    <mesh
      position={position}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <sphereGeometry args={[radius, 28, 28]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.28}
        metalness={0.2}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

/** Soft glow shell — cheap depth cue for nuclei, cells and lamps. */
export function Halo({ position = [0, 0, 0], radius, color, opacity = 0.07 }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// ─── Maths helpers ──────────────────────────────────────────────────

export const DEG = Math.PI / 180;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Circle in the XZ plane — orbital shells, coils, field loops. */
export function circlePoints(radius, segments = 128) {
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
  }
  return pts;
}

/** Deterministic pseudo-random in [0,1) — stable across re-renders. */
export function hashRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
