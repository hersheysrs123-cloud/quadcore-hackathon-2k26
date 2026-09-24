"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE, clamp, hashRandom, lerp } from "@/components/visualizations/scene-kit";

// ─── Lab bench base ─────────────────────────────────────────────────
// The furniture and materials shared by the apparatus scenes — the
// separation bench and the combustion bench draw from the same kit, so
// a retort stand, a Bunsen, a piece of glassware or a porcelain basin
// looks the same in both and is only ever built once.
//
// What is here:
//   scale        `cm()` — one real centimetre in scene units, so a 13 cm
//                flask and a 10 cm burner are the right size next to each
//                other without anyone guessing;
//   materials    the presets (`GLASS`, `PORCELAIN`, `STEEL`, `BRASS`,
//                `RUBBER`, `PAPER`) as prop objects for JSX materials.
//                Metals carry an emissive term: `SceneCanvas` has no
//                environment map, and a bare high-metalness material
//                with nothing to reflect renders as charcoal;
//   furniture    `LabBench`, `HeatMat`, `RetortStand`, `Tripod`;
//   burner       `BunsenBurner` — body, needle valve, rotating air
//                collar, and a flame the caller drives every frame
//                through a ref, so the same burner serves a fixed
//                medium flame under a basin and a fully adjustable one;
//   glassware    `ConicalFlask`, `Funnel`, `EvaporatingBasin`,
//                `GlassJar`, `HeatShield`. Vessels that hold a liquid
//                take a `liquidRef` the caller writes `{ fill, colour,
//                opacity }` into each frame — no re-render for a level
//                that changes sixty times a second.
//
// Disposal: every geometry and material is a JSX child, including the
// lathe geometries (their profile arrays are memoised and handed to
// `<latheGeometry args>`), so R3F disposes each at unmount and the
// scene's `WebGLCleanup` sweeps for anything missed. The only shared
// imperative materials are the liquid stacks' single material per vessel,
// each carrying its own disposal effect.
// ─────────────────────────────────────────────────────────────────────

/** One centimetre in scene units. */
export const cm = (v) => v * 0.2;

// ─── Material presets ───────────────────────────────────────────────

/** Thin laboratory glass — borosilicate, slightly blue, mostly not there. */
export const GLASS = {
  color: "#9fd6e8",
  transparent: true,
  opacity: 0.22,
  roughness: 0.04,
  metalness: 0,
  transmission: 0.6,
  thickness: 0.3,
  side: THREE.DoubleSide,
  depthWrite: false,
};
/** The rim and base of a vessel, where glass is thick enough to be seen. */
export const THICK_GLASS = { ...GLASS, color: "#c3e6f2", opacity: 0.55, transmission: 0.3 };
/** A glazed porcelain basin. */
export const PORCELAIN = { color: "#f3f1ec", roughness: 0.25, metalness: 0.05, emissive: "#f3f1ec", emissiveIntensity: 0.08 };
/** Brushed steel — rods, bases, barrels. */
export const STEEL = { color: "#6b7482", roughness: 0.38, metalness: 0.6, emissive: "#6b7482", emissiveIntensity: 0.22 };
export const DARK_STEEL = { color: "#4d5666", roughness: 0.45, metalness: 0.5, emissive: "#4d5666", emissiveIntensity: 0.2 };
/** The brass of a collar, a gas tap, a needle valve. */
export const BRASS = { color: "#c9a24a", roughness: 0.32, metalness: 0.6, emissive: "#c9a24a", emissiveIntensity: 0.3 };
export const RUBBER = { color: "#1f2731", roughness: 0.92, metalness: 0.05 };
/** Filter and chromatography paper. */
export const PAPER = { color: "#f4f1e6", roughness: 0.95, metalness: 0, side: THREE.DoubleSide };
export const CERAMIC_MAT = { color: "#4a515e", roughness: 0.9, metalness: 0.05 };

// ─── Bench and mat ──────────────────────────────────────────────────

/**
 * A lab bench top: a thick slab with a back rail and a front lip. `width`
 * and `depth` are in scene units; `y` is the height of the working surface.
 */
export function LabBench({ y = 0, width = 18, depth = 7, colour = "#8c9cb3" }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[width, 0.32, depth]} />
        <meshStandardMaterial color={colour} roughness={0.75} metalness={0.2} />
      </mesh>
      {/* Rail and lip both stand proud of the slab's faces: flush, the lip's
          front and the slab's front were one plane and z-fought. */}
      <mesh position={[0, -0.34, -depth / 2 + 0.09]}>
        <boxGeometry args={[width + 0.02, 0.1, 0.2]} />
        <meshStandardMaterial color="#5b6472" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.24, depth / 2 - 0.035]}>
        <boxGeometry args={[width + 0.02, 0.16, 0.1]} />
        <meshStandardMaterial color="#6f7d93" roughness={0.7} metalness={0.15} />
      </mesh>
    </group>
  );
}

/** A tile texture for a splashback: white-grey ceramic squares with grout lines. */
export function useTileTexture(repeat = [4, 2.4]) {
  const [rx, ry] = repeat;
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const g = canvas.getContext("2d");
    g.fillStyle = "#8b96a6";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        const shade = 196 + Math.round(hashRandom(i * 4 + j + 1) * 14);
        g.fillStyle = `rgb(${shade - 8}, ${shade - 2}, ${shade + 6})`;
        g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      }
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [rx, ry]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** Where `LabWall` stands, behind a 7-deep bench. */
export const LAB_WALL_Z = -3.45;

/**
 * The tiled wall behind the bench, with two short stainless shelves out to
 * the sides (so nothing runs behind the apparatus) carrying a few reagent
 * bottles. `benchY` is the working surface; `shelfX` how far out each shelf
 * is centred.
 */
export function LabWall({ benchY = 0, width = 22, height = 9, shelfX = 5.4, shelfHeight = 5.6, children }) {
  const tiles = useTileTexture([(4 * width) / 22, (2.4 * height) / 9]);
  const shelfY = benchY + shelfHeight;
  const bottles = [-shelfX - 0.9, -shelfX - 0.1, -shelfX + 0.7, shelfX - 0.5, shelfX + 0.4];
  return (
    <group>
      <mesh position={[0, benchY + height / 2, LAB_WALL_Z]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={tiles ?? undefined} color="#ffffff" roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * shelfX, shelfY, LAB_WALL_Z + 0.35]}>
          <boxGeometry args={[3.2, 0.08, 0.7]} />
          <meshStandardMaterial color="#c8d0da" metalness={0.3} roughness={0.35} />
        </mesh>
      ))}
      {bottles.map((x, i) => (
        <group key={x} position={[x, shelfY + 0.04, LAB_WALL_Z + 0.35]}>
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.72, 16]} />
            <meshStandardMaterial color={["#7a4a1f", "#dfe7ee", "#7a4a1f", "#dfe7ee", "#5b7fa6"][i]} transparent opacity={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.16, 12]} />
            <meshStandardMaterial color="#334155" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.38, 0.201]}>
            <planeGeometry args={[0.26, 0.26]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.8} />
          </mesh>
        </group>
      ))}
      {children}
    </group>
  );
}

/** A heat-resistant mat under anything that burns. */
export function HeatMat({ position = [0, 0, 0], size = [4, 3.2] }) {
  return (
    <mesh position={[position[0], position[1] + 0.02, position[2]]} receiveShadow>
      <boxGeometry args={[size[0], 0.04, size[1]]} />
      <meshStandardMaterial {...CERAMIC_MAT} />
    </mesh>
  );
}

// ─── Stands ─────────────────────────────────────────────────────────

/**
 * A retort stand: a heavy base plate, a vertical rod, and any number of
 * fittings clamped to it. Each fitting is `{ y, type, reach, radius,
 * angle }` — `type` "ring" for a funnel ring, "clamp" for a boss-head
 * clamp with jaws, "arm" for a bare rod; `reach` is how far the arm
 * extends from the rod (along +x, turned by `angle` radians about the
 * rod); `radius` is the ring's radius. The origin is the foot of the rod;
 * the base plate runs out under the arms (along +x, or turned by
 * `baseAngle`) so the stand looks like it could hold what it holds. Children are drawn at the origin so
 * callers can hang things off it.
 *
 * `armRefs[i]` receives the group of fitting i, so a caller can swing an
 * arm out of the way per frame.
 */
export function RetortStand({ position = [0, 0, 0], height = 6, fittings = [], armRefs, baseAngle = 0, children }) {
  return (
    <group position={position}>
      <group rotation={[0, baseAngle, 0]}>
        <mesh position={[cm(5), 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[cm(16), 0.12, cm(10)]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      </group>
      <mesh position={[0, 0.12 + height / 2, 0]}>
        <cylinderGeometry args={[0.055, 0.055, height, 14]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {fittings.map((f, i) => {
        const reach = f.reach ?? 1.4;
        const angle = f.angle ?? 0;
        return (
          <group
            key={i}
            position={[0, f.y, 0]}
            rotation={[0, angle, 0]}
            ref={(el) => {
              if (armRefs) armRefs.current[i] = el;
            }}
          >
            {/* Boss head. */}
            <mesh>
              <boxGeometry args={[0.24, 0.3, 0.24]} />
              <meshStandardMaterial {...DARK_STEEL} />
            </mesh>
            <mesh position={[0.16, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.035, 0.035, 0.14, 8]} />
              <meshStandardMaterial {...BRASS} />
            </mesh>
            {/* Arm. */}
            <mesh position={[reach / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.04, 0.04, reach, 10]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
            {f.type === "ring" && (
              <mesh position={[reach + (f.radius ?? 0.9), 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[f.radius ?? 0.9, 0.04, 8, 32]} />
                <meshStandardMaterial {...STEEL} />
              </mesh>
            )}
            {f.type === "clamp" && (
              <group position={[reach, 0, 0]}>
                <mesh position={[0, 0.12, 0]}>
                  <boxGeometry args={[0.36, 0.06, 0.16]} />
                  <meshStandardMaterial {...DARK_STEEL} />
                </mesh>
                <mesh position={[0, -0.12, 0]}>
                  <boxGeometry args={[0.36, 0.06, 0.16]} />
                  <meshStandardMaterial {...DARK_STEEL} />
                </mesh>
                <mesh position={[0.14, 0.12, 0]}>
                  <boxGeometry args={[0.08, 0.06, 0.3]} />
                  <meshStandardMaterial {...RUBBER} />
                </mesh>
                <mesh position={[0.14, -0.12, 0]}>
                  <boxGeometry args={[0.08, 0.06, 0.3]} />
                  <meshStandardMaterial {...RUBBER} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
      {children}
    </group>
  );
}

/**
 * How far above the tripod ring the top of the gauze's ceramic centre sits —
 * where a vessel resting on the tripod actually touches. Callers stand their
 * basin at `height + TRIPOD_TOP_CLEARANCE`.
 */
export const TRIPOD_TOP_CLEARANCE = 0.075;

/** A tripod with a wire gauze and its ceramic centre — where a basin or beaker sits. */
export function Tripod({ position = [0, 0, 0], height = 2.2, gauze = true }) {
  const legs = [0, 120, 240];
  const r = cm(5.4);
  return (
    <group position={position}>
      {legs.map((deg) => {
        const a = (deg * Math.PI) / 180;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        return (
          <mesh key={deg} position={[x * 0.72, height / 2, z * 0.72]} rotation={[z * 0.09, 0, -x * 0.09]}>
            <cylinderGeometry args={[0.045, 0.045, height, 10]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        );
      })}
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[cm(4.6), 0.045, 8, 30]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {gauze && (
        <>
          {/* The gauze sits ON the ring (clear of the torus), and its ceramic
              centre is a disc with thickness above it. Two planes 0.01 apart
              used to fight each other at any distance. */}
          <mesh position={[0, height + 0.05, 0]}>
            <boxGeometry args={[cm(11), 0.012, cm(11)]} />
            <meshStandardMaterial color="#8a93a0" roughness={0.85} metalness={0.3} />
          </mesh>
          <mesh position={[0, height + 0.065, 0]}>
            <cylinderGeometry args={[cm(3.2), cm(3.2), 0.02, 28]} />
            <meshStandardMaterial color="#e2dfd9" roughness={0.95} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ─── The burner ─────────────────────────────────────────────────────

export const BURNER = {
  baseRadius: cm(4.2),
  baseHeight: 0.2,
  barrelRadius: cm(0.85),
  barrelHeight: cm(9.5),
  collarRadius: cm(1.25),
  collarHeight: cm(1.9),
  collarY: cm(1.6),
};
/** Height of the barrel mouth above the burner's origin — where the flame starts. */
export const BURNER_MOUTH_Y = BURNER.baseHeight + BURNER.barrelHeight;
/** Full height of the flame envelope at height scale 1. */
export const FLAME_FULL_HEIGHT = cm(9);

// ─── The flame ──────────────────────────────────────────────────────

const FLAME_ROWS = 26;
const FLAME_SIDES = 28;
const FLAME_BLUE_BASE = new THREE.Color("#3f6df2");
const FLAME_HEART = new THREE.Color("#fff3c4");
const FLAME_INNER_CONE = new THREE.Color("#3fb4ff");
const FLAME_LUMINOUS = [
  // A luminous (collar closed) flame: blue only at the very base, then
  // glowing soot — white-yellow in the middle, orange and dim at the tip.
  [0, new THREE.Color("#3f6df2")],
  [0.1, new THREE.Color("#6d7cf0")],
  [0.22, new THREE.Color("#ffd46b")],
  [0.55, new THREE.Color("#ffc247")],
  [0.82, new THREE.Color("#f58a2e")],
  [1, new THREE.Color("#c2410c")],
];
const FLAME_BLUE = [
  // A roaring (collar open) flame: a pale violet-blue envelope, no soot.
  [0, new THREE.Color("#5b8cff")],
  [0.5, new THREE.Color("#4f7df5")],
  [1, new THREE.Color("#7c6cf2")],
];
const rampAt = (ramp, u, out) => {
  for (let i = 1; i < ramp.length; i += 1) {
    if (u <= ramp[i][0]) {
      const [u0, c0] = ramp[i - 1];
      const [u1, c1] = ramp[i];
      return out.copy(c0).lerp(c1, (u - u0) / Math.max(u1 - u0, 1e-6));
    }
  }
  return out.copy(ramp[ramp.length - 1][1]);
};

/** A unit-height lathe shell with a colour attribute carrying alpha, rewritten per frame. */
function flameShellGeometry() {
  const cols = FLAME_SIDES + 1;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(FLAME_ROWS * cols * 3), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(FLAME_ROWS * cols * 4), 4));
  const index = [];
  for (let i = 0; i < FLAME_ROWS - 1; i += 1) {
    for (let j = 0; j < FLAME_SIDES; j += 1) {
      const a = i * cols + j;
      const b = a + cols;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  g.setIndex(index);
  return g;
}

/**
 * The flame's radius at fraction `u` of its height, as a fraction of the
 * mouth radius. A lazy luminous flame is a teardrop that bellies out above
 * the mouth; a stiff roaring one is a narrow cone.
 */
const flameRadius = (u, roar) => {
  const lazy = (1 + 0.55 * Math.sin(Math.PI * u * 0.9)) * Math.pow(1 - u, 0.6);
  const stiff = (1 + 0.22 * Math.sin(Math.PI * u)) * Math.pow(1 - u, 0.85);
  return lerp(lazy, stiff, roar);
};

/**
 * Writes one flame shell: `height` and `radius` in scene units, a sway that
 * travels up the flame (a lazy flame licks about; a roaring one only
 * shivers), and colours graded up the height with alpha fading at the base
 * and tip. `colourAt(u, out)` returns the colour at fraction u.
 */
function shapeFlameShell(geometry, { height, radius, roar, t, alpha, colourAt, seed = 0, cone = 0 }) {
  const pos = geometry.attributes.position.array;
  const col = geometry.attributes.color.array;
  const cols = FLAME_SIDES + 1;
  const colour = SCRATCH_COLOUR;
  const sway = (1 - roar) * 0.16 + 0.02;
  for (let i = 0; i < FLAME_ROWS; i += 1) {
    const u = i / (FLAME_ROWS - 1);
    // The travelling wave: nothing at the mouth, most at the tip.
    const wave = u * u;
    const dx = sway * height * wave * (Math.sin(t * 3.3 - u * 5 + seed) * 0.7 + Math.sin(t * 7.9 - u * 9 + seed * 2) * 0.3);
    const dz = sway * height * wave * 0.6 * Math.sin(t * 2.7 - u * 4.4 + seed * 3);
    const breathe = 1 + (1 - roar) * 0.08 * Math.sin(t * 6.1 - u * 7 + seed) + roar * 0.03 * Math.sin(t * 31 + u * 13);
    // `cone` straightens the profile into a sharp cone (the inner cone of premix).
    const r = radius * lerp(flameRadius(u, roar), 1 - u, cone) * breathe;
    colourAt(u, colour);
    // Fade in over the first few rows (the mouth) and out over the tip.
    const a = alpha * clamp(u / 0.06, 0.35, 1) * clamp((1 - u) / 0.25, 0, 1);
    for (let j = 0; j < cols; j += 1) {
      const phi = (j / FLAME_SIDES) * Math.PI * 2;
      const k = i * cols + j;
      pos[k * 3] = Math.sin(phi) * r + dx;
      pos[k * 3 + 1] = u * height;
      pos[k * 3 + 2] = Math.cos(phi) * r + dz;
      col[k * 4] = colour.r;
      col[k * 4 + 1] = colour.g;
      col[k * 4 + 2] = colour.b;
      col[k * 4 + 3] = a;
    }
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.computeBoundingSphere();
}
const SCRATCH_COLOUR = new THREE.Color();

/** A soft white radial dot: the flame's glow, and a puff of smoke or steam when tinted. */
export function useGlowTexture() {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const g = canvas.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.35)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.08)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/**
 * A Bunsen burner. `collar` is 0..1 open; the sleeve turns so that at 1
 * its holes line up with the barrel's and at 0 they sit between them —
 * which is exactly what the collar on a real burner does.
 *
 * The flame is driven through `flameRef`: the caller writes
 * `{ height, colour, inner, roar, luminous }` into `flameRef.current`
 * whenever it likes (typically every frame) and the burner's own frame
 * loop draws it. `height` is 0..1 of a full flame (0 is out), `inner`
 * 0..1 the visibility of the inner cone, `roar` 0..1 sets the flicker
 * from lazy to stiff, `luminous` 0..1 how bright and opaque the envelope
 * is. Nothing about the flame causes a React render.
 */
export function BunsenBurner({ position = [0, 0, 0], collar = 0.2, flameRef, animSpeed = 1, valveOpen = true }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const glow = useRef(null);
  const light = useRef(null);
  const shown = useRef({ height: 0, inner: 0, luminous: 1, roar: 0, colour: new THREE.Color("#f5b731") });
  const scratch = useMemo(() => ({ colour: new THREE.Color(), a: new THREE.Color(), b: new THREE.Color() }), []);
  const outerGeo = useMemo(() => flameShellGeometry(), []);
  const innerGeo = useMemo(() => flameShellGeometry(), []);
  useEffect(
    () => () => {
      outerGeo.dispose();
      innerGeo.dispose();
    },
    [outerGeo, innerGeo],
  );
  const glowTexture = useGlowTexture();
  const open = clamp(collar, 0, 1);

  useFrame((state, delta) => {
    const f = flameRef?.current;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const k = 1 - Math.exp(-dt / 0.18);
    const s = shown.current;
    const wantHeight = f?.height ?? 0;
    s.height += (wantHeight - s.height) * k;
    s.inner += ((f?.inner ?? 0) * (wantHeight > 0.02 ? 1 : 0) - s.inner) * k;
    s.luminous += ((f?.luminous ?? 1) - s.luminous) * k;
    s.roar += ((f?.roar ?? 0) - s.roar) * k;
    if (f?.colour) {
      scratch.colour.set(f.colour);
      s.colour.lerp(scratch.colour, k);
    }
    const { roar, luminous } = s;
    const t = state.clock.elapsedTime * animSpeed;
    // A lazy yellow flame wanders; a roaring blue one shivers.
    const lazy = 1 + 0.09 * Math.sin(t * 5.1) + 0.05 * Math.sin(t * 8.3 + 1.1);
    const stiff = 1 + 0.025 * Math.sin(t * 27.3) + 0.015 * Math.sin(t * 41.7 + 0.7);
    const h = s.height * FLAME_FULL_HEIGHT * lerp(lazy, stiff, roar);
    const lit = h > 0.01;
    // A luminous flame is wider than the mouth; a pre-mixed one hugs it.
    const radius = BURNER.barrelRadius * lerp(1.45, 1.15, roar);

    if (outer.current) {
      outer.current.visible = lit;
      if (lit) {
        shapeFlameShell(outerGeo, {
          height: h,
          radius,
          roar,
          t,
          // Glowing soot makes a luminous flame bright and nearly opaque; a
          // roaring one is a faint blue you can see the bench through.
          alpha: lerp(0.3, 0.92, luminous),
          colourAt: (u, out) => rampAt(FLAME_BLUE, u, out).lerp(rampAt(FLAME_LUMINOUS, u, scratch.b), luminous),
        });
      }
    }
    if (inner.current) {
      // The core: a white-hot heart inside a luminous flame, and the sharp
      // pale-blue inner cone of unburnt premix once the collar is open.
      const coneH = h * lerp(0.62, 0.4, s.inner);
      inner.current.visible = lit && (s.inner > 0.02 || luminous > 0.15);
      if (inner.current.visible) {
        shapeFlameShell(innerGeo, {
          height: coneH,
          radius: radius * lerp(0.55, 0.62, s.inner),
          roar: Math.max(roar, s.inner),
          t,
          seed: 1.7,
          cone: s.inner,
          alpha: Math.max(0.55 * luminous, 0.5 * s.inner),
          colourAt: (u, out) => out.copy(u < 0.08 ? FLAME_BLUE_BASE : FLAME_HEART).lerp(FLAME_INNER_CONE, s.inner),
        });
      }
    }
    if (glow.current) {
      glow.current.visible = lit;
      glow.current.position.y = BURNER_MOUTH_Y + h * 0.45;
      glow.current.scale.set(0.5 + h * 1.1, 0.6 + h * 1.5, 1);
      glow.current.material.color.copy(s.colour);
      glow.current.material.opacity = (0.12 + 0.4 * luminous) * Math.min(1, s.height * 1.5);
    }
    if (light.current) {
      light.current.intensity = s.height * (4 + 3 * luminous) * lerp(0.92, 1.08, Math.sin(t * 9.3) * 0.5 + 0.5);
      light.current.color.copy(s.colour);
      light.current.position.y = BURNER_MOUTH_Y + h * 0.5;
    }
  });

  const holeAngles = [0, 90, 180, 270];

  return (
    <group position={position}>
      {/* Base. */}
      <mesh position={[0, BURNER.baseHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[BURNER.baseRadius * 0.82, BURNER.baseRadius, BURNER.baseHeight, 28]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      {/* Gas inlet and needle valve, on the side of the base. */}
      <mesh position={[-BURNER.baseRadius * 0.55, BURNER.baseHeight + 0.09, cm(2.2)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, cm(4.5), 10]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[-BURNER.baseRadius * 0.55, BURNER.baseHeight + 0.09, cm(4.8)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.06, 0.28, 10]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {/* Needle valve: a knurled wheel on the far side that opens with the gas. */}
      <group position={[BURNER.baseRadius * 0.7, BURNER.baseHeight + 0.1, 0]} rotation={[0, 0, valveOpen ? 0 : Math.PI / 2]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0.05, 0, 0]}>
          <boxGeometry args={[0.04, 0.3, 0.06]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      </group>
      {/* Barrel. */}
      <mesh position={[0, BURNER.baseHeight + BURNER.barrelHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[BURNER.barrelRadius, BURNER.barrelRadius * 1.08, BURNER.barrelHeight, 20]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {/* Air holes in the barrel, fixed. */}
      {holeAngles.map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <mesh
            key={deg}
            position={[Math.cos(a) * BURNER.barrelRadius * 1.02, BURNER.baseHeight + BURNER.collarY + BURNER.collarHeight * 0.5, Math.sin(a) * BURNER.barrelRadius * 1.02]}
            rotation={[0, -a + Math.PI / 2, 0]}
          >
            <circleGeometry args={[0.07, 12]} />
            <meshBasicMaterial color="#0b0e14" side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      {/* The collar: a brass sleeve with matching holes, turned by the slider. */}
      <group position={[0, BURNER.baseHeight + BURNER.collarY + BURNER.collarHeight / 2, 0]} rotation={[0, (1 - open) * (Math.PI / 4), 0]}>
        <mesh>
          <cylinderGeometry args={[BURNER.collarRadius, BURNER.collarRadius, BURNER.collarHeight, 24, 1, true]} />
          <meshStandardMaterial {...BRASS} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, BURNER.collarHeight / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BURNER.collarRadius, 0.025, 8, 24]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0, -BURNER.collarHeight / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BURNER.collarRadius, 0.025, 8, 24]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        {holeAngles.map((deg) => {
          const a = (deg * Math.PI) / 180;
          return (
            <mesh key={deg} position={[Math.cos(a) * BURNER.collarRadius * 1.01, 0, Math.sin(a) * BURNER.collarRadius * 1.01]} rotation={[0, -a + Math.PI / 2, 0]}>
              <circleGeometry args={[0.075, 12]} />
              <meshBasicMaterial color={open > 0.5 ? "#0b0e14" : "#2a2418"} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
        {/* A grip tab so the rotation reads. */}
        <mesh position={[BURNER.collarRadius + 0.06, 0, 0]}>
          <boxGeometry args={[0.14, BURNER.collarHeight * 0.7, 0.08]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      </group>
      {/* Mouth rim. */}
      <mesh position={[0, BURNER_MOUTH_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BURNER.barrelRadius, 0.03, 8, 20]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>

      {/* The flame: an envelope and a core, each one shell rebuilt every
          frame, self-lit and graded in colour and alpha up its height; and
          a soft additive glow around it. */}
      <mesh ref={outer} geometry={outerGeo} position={[0, BURNER_MOUTH_Y + 0.005, 0]} visible={false} renderOrder={2}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={inner} geometry={innerGeo} position={[0, BURNER_MOUTH_Y + 0.005, 0]} visible={false} renderOrder={3}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <sprite ref={glow} position={[0, BURNER_MOUTH_Y, 0]} visible={false} renderOrder={1}>
        <spriteMaterial map={glowTexture ?? undefined} color="#f5b731" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <pointLight ref={light} position={[0, BURNER_MOUTH_Y + 0.6, 0]} intensity={0} distance={10} decay={2} />
    </group>
  );
}

// ─── Glassware ──────────────────────────────────────────────────────

const LIQUID_SEGMENTS = 40;
/** The liquid body's floor stands this far above `y0`, clear of the vessel's own base face. */
const LIQUID_FLOOR_LIFT = 0.004;

/**
 * The liquid filling a vessel whose radius varies with height, driven per
 * frame from `liquidRef.current = { fill, colour, opacity }`. `profile(h)`
 * returns the inner radius at height h (0..height). The body is ONE smooth
 * solid of revolution rebuilt to the current level whenever it changes —
 * walls that follow the vessel's own shape and a floor — plus a surface
 * disc on top. (It used to be a stack of short cylinders, which read as
 * visible layers through the glass.)
 *
 * `walls` false draws only the liquid's surface: right for an opaque vessel
 * like a porcelain basin, where the sides can never be seen.
 */
export function LiquidStack({ height, profile, liquidRef, steps = 16, colour = "#c9e3ec", opacity = 0.3, y0 = 0, walls = true }) {
  const body = useRef(null);
  const lastLevel = useRef(-1);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity, roughness: 0.12, depthWrite: false }),
    // The starting colour only seeds the material; the ref drives it after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // Rows: the floor's centre, the floor's edge, then steps + 1 rings up the
  // wall. The floor edge and the first wall ring are separate vertices so the
  // corner stays crisp instead of being smoothed into a bulge.
  const geometry = useMemo(() => {
    const rows = steps + 3;
    const cols = LIQUID_SEGMENTS + 1;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
    const index = [];
    for (let i = 0; i < rows - 1; i += 1) {
      for (let j = 0; j < LIQUID_SEGMENTS; j += 1) {
        const a = i * cols + j;
        const b = a + cols;
        index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    g.setIndex(index);
    return g;
  }, [steps]);
  const surface = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity: Math.min(0.75, opacity * 1.8), roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(
    () => () => {
      material.dispose();
      surface.dispose();
      geometry.dispose();
    },
    [material, surface, geometry],
  );
  const top = useRef(null);

  /** Rewrites the body's rings for a liquid standing `level` deep. */
  const shapeBody = (level) => {
    const pos = geometry.attributes.position.array;
    const nrm = geometry.attributes.normal.array;
    const cols = LIQUID_SEGMENTS + 1;
    const floor = LIQUID_FLOOR_LIFT;
    const ring = (row, r, h, nr, ny) => {
      for (let j = 0; j < cols; j += 1) {
        const phi = (j / LIQUID_SEGMENTS) * Math.PI * 2;
        const s = Math.sin(phi);
        const c = Math.cos(phi);
        const k = (row * cols + j) * 3;
        pos[k] = r * s;
        pos[k + 1] = y0 + h;
        pos[k + 2] = r * c;
        nrm[k] = nr * s;
        nrm[k + 1] = ny;
        nrm[k + 2] = nr * c;
      }
    };
    const r0 = profile(floor);
    ring(0, 0, floor, 0, -1);
    ring(1, r0, floor, 0, -1);
    for (let i = 0; i <= steps; i += 1) {
      const h = floor + ((level - floor) * i) / steps;
      // The wall's outward normal, from the profile's slope at h.
      const e = 0.01;
      const slope = (profile(Math.min(height, h + e)) - profile(Math.max(0, h - e))) / (2 * e);
      const a = 1 / Math.sqrt(1 + slope * slope);
      ring(i + 2, profile(h), h, a, -slope * a);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingSphere();
  };

  useFrame(() => {
    const l = liquidRef?.current;
    const fill = clamp(l?.fill ?? 0, 0, 1);
    const level = fill * height;
    if (l?.colour) {
      material.color.set(l.colour);
      surface.color.set(l.colour);
    }
    if (l?.opacity !== undefined) {
      material.opacity = l.opacity;
      surface.opacity = Math.min(0.75, l.opacity * 1.8);
    }
    const wet = level > LIQUID_FLOOR_LIFT + 1e-3;
    if (body.current) {
      body.current.visible = walls && wet;
      if (walls && wet && Math.abs(level - lastLevel.current) > 1e-4) {
        shapeBody(level);
        lastLevel.current = level;
      }
    }
    if (top.current) {
      top.current.visible = wet;
      if (wet) {
        top.current.position.y = y0 + level;
        const r = profile(level);
        top.current.scale.set(r, r, 1);
      }
    }
  });

  return (
    <group>
      <mesh ref={body} geometry={geometry} material={material} visible={false} />
      <mesh ref={top} rotation={[-Math.PI / 2, 0, 0]} material={surface} visible={false}>
        <circleGeometry args={[1, LIQUID_SEGMENTS]} />
      </mesh>
    </group>
  );
}

/**
 * A conical (Erlenmeyer) flask: a flat base, straight conical sides up to a
 * shoulder, then a short neck with a lip. The liquid fills the cone.
 */
export const FLASK = { baseRadius: cm(5), bodyHeight: cm(9), neckRadius: cm(1.4), neckHeight: cm(3.2) };

export function ConicalFlask({ liquidRef, liquidColour = "#c9e3ec", liquidOpacity = 0.3, size = FLASK, children }) {
  const { baseRadius, bodyHeight, neckRadius, neckHeight } = size;
  const profilePoints = useMemo(
    () => [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(baseRadius * 0.96, 0),
      new THREE.Vector2(baseRadius, 0.05),
      new THREE.Vector2(neckRadius * 1.15, bodyHeight),
      new THREE.Vector2(neckRadius, bodyHeight + 0.12),
      new THREE.Vector2(neckRadius, bodyHeight + neckHeight),
      new THREE.Vector2(neckRadius * 1.25, bodyHeight + neckHeight + 0.05),
    ],
    [baseRadius, bodyHeight, neckRadius, neckHeight],
  );
  const inner = useMemo(() => {
    const r0 = baseRadius - 0.05;
    const r1 = neckRadius * 1.15 - 0.04;
    return (h) => lerp(r0, r1, clamp(h / bodyHeight, 0, 1));
  }, [baseRadius, neckRadius, bodyHeight]);

  return (
    <group>
      <mesh>
        <latheGeometry args={[profilePoints, 40]} />
        <meshPhysicalMaterial {...GLASS} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[baseRadius * 0.96, baseRadius * 0.96, 0.06, 40]} />
        <meshPhysicalMaterial {...THICK_GLASS} />
      </mesh>
      <mesh position={[0, bodyHeight + neckHeight + 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[neckRadius * 1.2, 0.03, 8, 28]} />
        <meshPhysicalMaterial {...THICK_GLASS} />
      </mesh>
      {/* Graduations. */}
      {[0.22, 0.42, 0.62].map((f) => (
        <mesh key={f} position={[0, 0.06 + bodyHeight * f, inner(bodyHeight * f) + 0.06]}>
          <boxGeometry args={[0.32, 0.018, 0.01]} />
          <meshStandardMaterial color="#e8ebf0" transparent opacity={0.6} />
        </mesh>
      ))}
      <LiquidStack height={bodyHeight - 0.1} profile={inner} liquidRef={liquidRef} colour={liquidColour} opacity={liquidOpacity} y0={0.06} />
      {children}
    </group>
  );
}

/**
 * A filter funnel: a glass cone with a stem, and — when `paper` is set — a
 * fluted filter paper inside it, drawn as a low-segment cone with flat
 * shading so the pleats catch the light. `residueRef` receives the mesh of
 * the residue mound at the paper's apex, for the caller to scale.
 */
export const FUNNEL = { radius: cm(5.5), height: cm(5), stemLength: cm(6), stemRadius: 0.11 };

export function Funnel({ paper = true, paperColour = "#f4f1e6", residueRef, size = FUNNEL, children }) {
  const { radius, height, stemLength, stemRadius } = size;
  return (
    <group>
      {/* Cone, apex down at the origin; the stem hangs below. */}
      <mesh position={[0, height / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius, height, 40, 1, true]} />
        <meshPhysicalMaterial {...GLASS} />
      </mesh>
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.028, 8, 40]} />
        <meshPhysicalMaterial {...THICK_GLASS} />
      </mesh>
      <mesh position={[0, -stemLength / 2, 0]}>
        <cylinderGeometry args={[stemRadius, stemRadius, stemLength, 14, 1, true]} />
        <meshPhysicalMaterial {...GLASS} />
      </mesh>
      {paper && (
        <mesh position={[0, height * 0.47 + 0.02, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[radius * 0.9, height * 0.94, 14, 1, true]} />
          <meshStandardMaterial {...PAPER} color={paperColour} flatShading transparent opacity={0.92} />
        </mesh>
      )}
      {/* Residue mound at the apex, scaled by the caller. */}
      <mesh ref={residueRef} position={[0, 0.16, 0]} scale={[0, 0, 0]}>
        <sphereGeometry args={[radius * 0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c9a96e" roughness={0.95} />
      </mesh>
      {children}
    </group>
  );
}

/**
 * A porcelain evaporating basin: a spherical-cap bowl with a rolled lip.
 * `liquidRef` drives the puddle inside; `sphereRadius` and `depth` fix the
 * bowl's curve, and the rim radius follows from them.
 */
export const BASIN = { sphereRadius: cm(11), depth: cm(3.2) };
export const basinRimRadius = ({ sphereRadius, depth } = BASIN) => Math.sqrt(sphereRadius * sphereRadius - Math.pow(sphereRadius - depth, 2));

export function EvaporatingBasin({ liquidRef, liquidColour = "#c9e3ec", liquidOpacity = 0.3, size = BASIN, children }) {
  const { sphereRadius, depth } = size;
  const rim = basinRimRadius(size);
  const wall = 0.06;
  const profilePoints = useMemo(() => {
    const pts = [];
    const n = 14;
    // Outer surface, bottom to rim.
    for (let i = 0; i <= n; i += 1) {
      const h = (depth / n) * i;
      const r = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - Math.pow(sphereRadius - h, 2)));
      pts.push(new THREE.Vector2(r + wall, h));
    }
    pts.push(new THREE.Vector2(rim + wall + 0.08, depth + 0.02));
    pts.push(new THREE.Vector2(rim + 0.02, depth + 0.06));
    // Inner surface, rim back to bottom.
    for (let i = n; i >= 0; i -= 1) {
      const h = (depth / n) * i;
      const r = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - Math.pow(sphereRadius - h, 2)));
      pts.push(new THREE.Vector2(Math.max(r - 0.01, 0), h + wall * 0.6));
    }
    return pts;
  }, [sphereRadius, depth, rim]);
  // The liquid stack starts at y0 = wall·0.6, the height where the inner
  // surface's curve begins, so at stack height h the inner wall's radius is
  // the sphere's at h. Adding the wall offset again (as this once did) put the
  // liquid outside the porcelain near the steep rim, and each disc's edge
  // striped through it. The margin covers a disc's half-step of taper.
  const inner = useMemo(
    () => (h) => Math.max(0, Math.sqrt(Math.max(0, sphereRadius * sphereRadius - Math.pow(sphereRadius - h, 2))) - 0.06),
    [sphereRadius],
  );

  return (
    <group>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[profilePoints, 44]} />
        <meshStandardMaterial {...PORCELAIN} side={THREE.DoubleSide} />
      </mesh>
      {/* A foot ring so it sits flat. */}
      <mesh position={[0, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rim * 0.42, 0.03, 8, 30]} />
        <meshStandardMaterial {...PORCELAIN} />
      </mesh>
      <LiquidStack height={depth - wall * 0.6 - 0.04} profile={inner} liquidRef={liquidRef} colour={liquidColour} opacity={liquidOpacity} y0={wall * 0.6} steps={12} walls={false} />
      {children}
    </group>
  );
}

/**
 * A tall glass jar, open at the bottom. With `dome` it is a bell jar (a
 * knob on a hemispherical top); without, a chromatography tank with a
 * flat glass lid the caller can leave off by passing `lid={false}`.
 */
export function GlassJar({ radius = cm(8), height = cm(22), dome = false, lid = true, children }) {
  return (
    <group>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius, radius, height, 40, 1, true]} />
        <meshPhysicalMaterial {...GLASS} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.035, 8, 40]} />
        <meshPhysicalMaterial {...THICK_GLASS} />
      </mesh>
      {dome ? (
        <>
          <mesh position={[0, height, 0]}>
            <sphereGeometry args={[radius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial {...GLASS} />
          </mesh>
          <mesh position={[0, height + radius + 0.12, 0]}>
            <sphereGeometry args={[0.17, 16, 16]} />
            <meshPhysicalMaterial {...THICK_GLASS} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius, 0.035, 8, 40]} />
            <meshPhysicalMaterial {...THICK_GLASS} />
          </mesh>
          {lid && (
            <mesh position={[0, height + 0.06, 0]}>
              <cylinderGeometry args={[radius + 0.12, radius + 0.12, 0.08, 40]} />
              <meshPhysicalMaterial {...THICK_GLASS} />
            </mesh>
          )}
        </>
      )}
      {children}
    </group>
  );
}

/** A curved glass heat shield on two feet, standing behind a burner (its arc faces −z). */
export function HeatShield({ position = [0, 0, 0], radius = cm(12), height = cm(24), arc = Math.PI * 0.62 }) {
  // Three's cylinder arc starts at +z and sweeps toward +x; turning it by
  // π − arc/2 centres the arc on −z, so the feet sit at ±sin(arc/2).
  const turn = Math.PI - arc / 2;
  return (
    <group position={position}>
      <mesh position={[0, height / 2 + 0.16, 0]} rotation={[0, turn, 0]}>
        <cylinderGeometry args={[radius, radius, height, 40, 1, true, 0, arc]} />
        <meshPhysicalMaterial {...GLASS} opacity={0.12} />
      </mesh>
      <mesh position={[0, height + 0.16, 0]} rotation={[0, turn, 0]}>
        <cylinderGeometry args={[radius + 0.02, radius + 0.02, 0.06, 40, 1, true, 0, arc]} />
        <meshPhysicalMaterial {...THICK_GLASS} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * Math.sin(arc / 2) * radius, 0.08, -Math.cos(arc / 2) * radius]}>
          <boxGeometry args={[0.3, 0.16, 0.3]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      ))}
    </group>
  );
}

/** A pair of crucible tongs, jaws at the origin, handle trailing along +x. */
export function Tongs({ length = cm(20), open = 0.12 }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} rotation={[0, 0, 0]}>
          <mesh position={[length / 2, side * open * 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, length, 8]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position={[0.1, side * open * 0.5, 0]}>
            <boxGeometry args={[0.24, 0.05, 0.16]} />
            <meshStandardMaterial {...DARK_STEEL} />
          </mesh>
        </group>
      ))}
      <mesh position={[length * 0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 8]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </group>
  );
}

/** A small spray bottle, nozzle pointing along −x. */
export function SprayBottle({ position = [0, 0, 0], colour = PALETTE.sky }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 1.2, 20]} />
        <meshPhysicalMaterial {...GLASS} color={colour} opacity={0.35} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.27, 0.31, 0.9, 20]} />
        <meshStandardMaterial color={colour} transparent opacity={0.35} roughness={0.2} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[0.36, 0.34, 0.3]} />
        <meshStandardMaterial {...RUBBER} color="#374151" />
      </mesh>
      <mesh position={[-0.28, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.24, 8]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh position={[-0.1, 1.1, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.08, 0.3, 0.16]} />
        <meshStandardMaterial {...RUBBER} color="#374151" />
      </mesh>
    </group>
  );
}
