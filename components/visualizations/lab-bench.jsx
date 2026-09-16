"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE, clamp, lerp } from "@/components/visualizations/scene-kit";

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
  opacity: 0.16,
  roughness: 0.04,
  metalness: 0,
  transmission: 0.6,
  thickness: 0.3,
  side: THREE.DoubleSide,
  depthWrite: false,
};
/** The rim and base of a vessel, where glass is thick enough to be seen. */
export const THICK_GLASS = { ...GLASS, color: "#c3e6f2", opacity: 0.42, transmission: 0.3 };
/** A glazed porcelain basin. */
export const PORCELAIN = { color: "#f3f1ec", roughness: 0.25, metalness: 0.05, emissive: "#f3f1ec", emissiveIntensity: 0.08 };
/** Brushed steel — rods, bases, barrels. */
export const STEEL = { color: "#6b7482", roughness: 0.38, metalness: 0.6, emissive: "#6b7482", emissiveIntensity: 0.22 };
export const DARK_STEEL = { color: "#3a4150", roughness: 0.45, metalness: 0.6, emissive: "#3a4150", emissiveIntensity: 0.18 };
/** The brass of a collar, a gas tap, a needle valve. */
export const BRASS = { color: "#c9a24a", roughness: 0.32, metalness: 0.6, emissive: "#c9a24a", emissiveIntensity: 0.3 };
export const RUBBER = { color: "#1f2731", roughness: 0.92, metalness: 0.05 };
/** Filter and chromatography paper. */
export const PAPER = { color: "#f4f1e6", roughness: 0.95, metalness: 0, side: THREE.DoubleSide };
export const CERAMIC_MAT = { color: "#2b2f38", roughness: 0.9, metalness: 0.05 };

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
      <mesh position={[0, -0.34, -depth / 2 + 0.1]}>
        <boxGeometry args={[width, 0.1, 0.2]} />
        <meshStandardMaterial color="#5b6472" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.24, depth / 2 - 0.05]}>
        <boxGeometry args={[width, 0.16, 0.1]} />
        <meshStandardMaterial color="#6f7d93" roughness={0.7} metalness={0.15} />
      </mesh>
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
          <mesh position={[0, height + 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[cm(11), cm(11)]} />
            <meshStandardMaterial color="#6b7280" roughness={0.85} metalness={0.3} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, height + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[cm(3.2), 24]} />
            <meshStandardMaterial color="#d6d3ce" roughness={0.95} side={THREE.DoubleSide} />
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
  const shown = useRef({ height: 0, inner: 0, colour: new THREE.Color("#f5b731") });
  const scratch = useMemo(() => new THREE.Color(), []);
  const open = clamp(collar, 0, 1);

  useFrame((state, delta) => {
    const f = flameRef?.current;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const k = 1 - Math.exp(-dt / 0.18);
    const s = shown.current;
    const wantHeight = f?.height ?? 0;
    s.height += (wantHeight - s.height) * k;
    s.inner += ((f?.inner ?? 0) * (wantHeight > 0.02 ? 1 : 0) - s.inner) * k;
    if (f?.colour) {
      scratch.set(f.colour);
      s.colour.lerp(scratch, k);
    }
    const roar = f?.roar ?? 0;
    const luminous = f?.luminous ?? 1;
    const t = state.clock.elapsedTime * animSpeed;
    // A lazy yellow flame wanders; a roaring blue one shivers.
    const lazy = 1 + 0.09 * Math.sin(t * 5.1) + 0.05 * Math.sin(t * 8.3 + 1.1);
    const stiff = 1 + 0.025 * Math.sin(t * 27.3) + 0.015 * Math.sin(t * 41.7 + 0.7);
    const flicker = lerp(lazy, stiff, roar);
    const h = s.height * FLAME_FULL_HEIGHT * flicker;
    const lean = (1 - roar) * 0.06 * Math.sin(t * 3.7);

    if (outer.current) {
      outer.current.visible = h > 0.01;
      outer.current.scale.set(1 + (1 - roar) * 0.25, h, 1 + (1 - roar) * 0.25);
      outer.current.position.set(lean * h, BURNER_MOUTH_Y + h / 2, 0);
      outer.current.rotation.z = lean;
      const mat = outer.current.material;
      mat.color.copy(s.colour);
      mat.emissive.copy(s.colour);
      mat.emissiveIntensity = 1.6 + 1.2 * luminous;
      mat.opacity = 0.42 + 0.4 * luminous;
    }
    if (inner.current) {
      const ih = h * 0.42 * s.inner;
      inner.current.visible = ih > 0.01;
      inner.current.scale.set(1, ih, 1);
      inner.current.position.set(0, BURNER_MOUTH_Y + ih / 2, 0);
      inner.current.material.opacity = 0.85 * s.inner;
    }
    if (glow.current) {
      glow.current.visible = h > 0.01;
      glow.current.position.y = BURNER_MOUTH_Y + h * 0.45;
      glow.current.scale.setScalar(0.4 + h * 0.35);
      glow.current.material.color.copy(s.colour);
      glow.current.material.opacity = 0.05 + 0.07 * luminous * s.height;
    }
    if (light.current) {
      light.current.intensity = s.height * (4 + 3 * luminous);
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

      {/* Flame envelope, inner cone and glow: unit-height cones scaled each frame. */}
      <mesh ref={outer} position={[0, BURNER_MOUTH_Y, 0]} visible={false}>
        <coneGeometry args={[BURNER.barrelRadius * 1.5, 1, 18, 1]} />
        <meshStandardMaterial color="#f5b731" emissive="#f5b731" emissiveIntensity={2.4} toneMapped={false} transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh ref={inner} position={[0, BURNER_MOUTH_Y, 0]} visible={false}>
        <coneGeometry args={[BURNER.barrelRadius * 0.85, 1, 14, 1]} />
        <meshStandardMaterial color="#7dd3fc" emissive="#7dd3fc" emissiveIntensity={3} toneMapped={false} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh ref={glow} position={[0, BURNER_MOUTH_Y, 0]} visible={false}>
        <sphereGeometry args={[1, 18, 18]} />
        <meshBasicMaterial color="#f5b731" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <pointLight ref={light} position={[0, BURNER_MOUTH_Y + 0.6, 0]} intensity={0} distance={10} decay={2} />
    </group>
  );
}

// ─── Glassware ──────────────────────────────────────────────────────

/**
 * A stack of short discs filling a vessel whose radius varies with height,
 * driven per frame from `liquidRef.current = { fill, colour, opacity }`.
 * `profile(h)` returns the inner radius at height h (0..height). Discs
 * above the fill line are hidden, so the level follows the vessel's own
 * shape — a low fill in a conical flask is wide, a low fill in a basin is
 * a small puddle at the bottom.
 */
export function LiquidStack({ height, profile, liquidRef, steps = 16, colour = "#c9e3ec", opacity = 0.3, y0 = 0 }) {
  const meshes = useRef([]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity, roughness: 0.12, depthWrite: false }),
    // The starting colour only seeds the material; the ref drives it after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const surface = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity: Math.min(0.75, opacity * 1.8), roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(
    () => () => {
      material.dispose();
      surface.dispose();
    },
    [material, surface],
  );
  const top = useRef(null);
  const step = height / steps;
  const discs = useMemo(() => Array.from({ length: steps }, (_, i) => ({ y: y0 + step * (i + 0.5), radius: profile(step * (i + 0.5)) })), [steps, step, profile, y0]);

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
    let topIndex = -1;
    for (let i = 0; i < steps; i += 1) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const visible = step * i < level - 1e-4;
      mesh.visible = visible;
      if (visible) topIndex = i;
    }
    if (top.current) {
      top.current.visible = topIndex >= 0;
      if (topIndex >= 0) {
        top.current.position.y = y0 + level;
        const r = profile(level);
        top.current.scale.set(r, r, 1);
      }
    }
  });

  return (
    <group>
      {discs.map((d, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          position={[0, d.y, 0]}
          material={material}
          visible={false}
        >
          <cylinderGeometry args={[d.radius, d.radius, step * 1.02, 32]} />
        </mesh>
      ))}
      <mesh ref={top} rotation={[-Math.PI / 2, 0, 0]} material={surface} visible={false}>
        <circleGeometry args={[1, 32]} />
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
  const inner = useMemo(
    () => (h) => Math.sqrt(Math.max(0, sphereRadius * sphereRadius - Math.pow(sphereRadius - (h + wall * 0.6), 2))) - 0.04,
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
      <LiquidStack height={depth - wall * 0.6 - 0.04} profile={inner} liquidRef={liquidRef} colour={liquidColour} opacity={liquidOpacity} y0={wall * 0.6} steps={12} />
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
