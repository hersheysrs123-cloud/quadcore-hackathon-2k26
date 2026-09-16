"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE, SceneLabel, VectorArrow, hashRandom, lerp } from "@/components/visualizations/scene-kit";

// ─── Multi-vessel comparison rack ───────────────────────────────────
// The furniture shared by the two redox scenes: a bench, a rack of N
// numbered slots, glass vessels to stand in them, and the visual language
// for electron transfer — a stream of glowing particles along a path, with
// an arrow saying which way they go.
//
// The point of a comparison rack is that every vessel is drawn by the same
// code with different chemistry inside, so a difference on screen can only
// be a difference in the chemistry. Both scenes lean on that: four beakers
// with the same strip in each, four tubes with the same nail in each.
//
// Disposal: every geometry and material here is a JSX child, so R3F calls
// `dispose()` on each at unmount and the scene's `WebGLCleanup` sweeps for
// anything that path missed. The one imperative object is the electron
// stream's path (a `Vector3` array, no GPU side), and the label DOM comes
// and goes with drei's `Html`.
// ─────────────────────────────────────────────────────────────────────

/** x of slot `i` in a rack of `count`, centred on zero. */
export const slotX = (i, count, spacing) => (i - (count - 1) / 2) * spacing;

// ─── Bench and rack ─────────────────────────────────────────────────

/** A lab bench top with a back rail — the same one every rack stands on. */
export function Bench({ y = 0, width = 16, depth = 6, colour = "#8c9cb3" }) {
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
    </group>
  );
}

/**
 * A rack of `count` slots. Draws the board, a numbered tag under each slot,
 * and an optional raised holder (a ring, for test tubes) at each. Children
 * are positioned by the caller with `slotX`.
 *
 * `holder` — "ring" stands a tube in a hole in a raised board; "pad" is a
 * flat coaster for a beaker.
 */
export function VesselRack({
  count = 4,
  spacing = 3,
  y = 0,
  holder = "pad",
  holderRadius = 0.9,
  holderHeight = 2.2,
  labels = [],
  focus = -1,
  colour = "#6b5a46",
  children,
}) {
  const width = spacing * count + 1.2;
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[width, 0.12, holderRadius * 2 + 1]} />
        <meshStandardMaterial color={colour} roughness={0.85} />
      </mesh>

      {holder === "ring" && (
        <>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (width / 2 - 0.35), holderHeight / 2, 0]}>
              <boxGeometry args={[0.24, holderHeight, holderRadius * 2 + 0.6]} />
              <meshStandardMaterial color={colour} roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, holderHeight, 0]}>
            <boxGeometry args={[width, 0.12, holderRadius * 2 + 0.6]} />
            <meshStandardMaterial color={colour} roughness={0.85} />
          </mesh>
          {Array.from({ length: count }, (_, i) => (
            <mesh key={i} position={[slotX(i, count, spacing), holderHeight, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[holderRadius + 0.06, 0.08, 8, 28]} />
              <meshStandardMaterial color="#4a3e30" roughness={0.9} />
            </mesh>
          ))}
        </>
      )}

      {Array.from({ length: count }, (_, i) => {
        const x = slotX(i, count, spacing);
        const active = i === focus;
        return (
          <group key={i} position={[x, 0, 0]}>
            {holder === "pad" && (
              <mesh position={[0, 0.14, 0]}>
                <cylinderGeometry args={[holderRadius + 0.12, holderRadius + 0.18, 0.06, 32]} />
                <meshStandardMaterial
                  color={active ? PALETTE.gold : "#4a4038"}
                  emissive={active ? PALETTE.gold : "#000000"}
                  emissiveIntensity={active ? 0.5 : 0}
                  roughness={0.8}
                />
              </mesh>
            )}
            <mesh position={[0, 0.13, holderRadius + 0.32]} rotation={[-Math.PI / 2.6, 0, 0]}>
              <boxGeometry args={[0.6, 0.02, 0.36]} />
              <meshStandardMaterial color={active ? PALETTE.gold : "#e8ebf0"} roughness={0.6} />
            </mesh>
            <SceneLabel position={[0, 0.3, holderRadius + 0.5]} tone={active ? "text-duck-300" : "text-ink-300"} accent={active}>
              {labels[i] ?? `${i + 1}`}
            </SceneLabel>
          </group>
        );
      })}
      {children}
    </group>
  );
}

// ─── Glassware ──────────────────────────────────────────────────────

/**
 * A beaker: open cylinder of glass on a thick base, with a pouring lip,
 * graduations and whatever liquid the caller wants in it. The liquid is a
 * separate mesh whose material the caller may recolour every frame through
 * `liquidRef` — that is how a displacement fades the blue out of copper
 * sulfate without a single re-render.
 */
export function Beaker({
  radius = 0.9,
  height = 2.6,
  liquidHeight = 1.9,
  liquidColour = "#c9e3ec",
  liquidOpacity = 0.12,
  liquidRef,
  children,
}) {
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[radius, radius, 0.12, 36]} />
        <meshPhysicalMaterial color="#9fd6e8" transparent opacity={0.3} roughness={0.05} />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius, radius, height, 36, 1, true]} />
        <meshPhysicalMaterial
          color="#9fd6e8"
          transparent
          opacity={0.14}
          roughness={0.04}
          transmission={0.6}
          thickness={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.024, 8, 36]} />
        <meshPhysicalMaterial color="#c3e6f2" transparent opacity={0.4} roughness={0.05} />
      </mesh>
      {/* Graduations up the front face. */}
      {[0.3, 0.55, 0.8].map((f) => (
        <mesh key={f} position={[-radius * 0.55, 0.12 + height * f, radius + 0.005]}>
          <boxGeometry args={[0.28, 0.018, 0.01]} />
          <meshStandardMaterial color="#e8ebf0" transparent opacity={0.6} />
        </mesh>
      ))}
      {/* Body and meniscus share `liquidRef`'s group, so one traversal
          recolours both — see `TestTube` for why the surface is drawn at all. */}
      <group ref={liquidRef}>
        <mesh position={[0, 0.12 + liquidHeight / 2, 0]}>
          <cylinderGeometry args={[radius - 0.03, radius - 0.03, liquidHeight, 36]} />
          <meshStandardMaterial color={liquidColour} transparent opacity={liquidOpacity} roughness={0.1} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.12 + liquidHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[radius - 0.03, 36]} />
          <meshStandardMaterial
            color={liquidColour}
            transparent
            opacity={Math.min(0.72, liquidOpacity * 1.8)}
            roughness={0.08}
            metalness={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      {children}
    </group>
  );
}

/**
 * A test tube: an open glass cylinder on a hemispherical bottom. `liquid`
 * is the depth of water; `oil` an optional layer of paraffin floating on it;
 * `stopper` closes the mouth with rubber; `desiccant` drops granules in the
 * bottom. The liquid mesh is again exposed through `liquidRef`.
 */
export function TestTube({
  radius = 0.5,
  height = 4,
  liquid = 0,
  liquidColour = "#c9e3ec",
  liquidOpacity = 0.14,
  liquidRef,
  oil = 0,
  stopper = false,
  desiccant = false,
  children,
}) {
  const bottomY = radius;
  const glass = (
    <meshPhysicalMaterial
      color="#9fd6e8"
      transparent
      opacity={0.15}
      roughness={0.04}
      transmission={0.6}
      thickness={0.25}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  );
  const granules = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = hashRandom(i * 3.1 + 1) * Math.PI * 2;
        const r = hashRandom(i * 5.7 + 2) * (radius - 0.14);
        return {
          position: [Math.cos(a) * r, bottomY - radius * 0.55 + hashRandom(i * 7.3 + 3) * 0.5, Math.sin(a) * r],
          scale: 0.07 + hashRandom(i * 9.1 + 4) * 0.06,
        };
      }),
    [radius, bottomY],
  );

  return (
    <group>
      <mesh position={[0, bottomY, 0]}>
        <sphereGeometry args={[radius, 28, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {glass}
      </mesh>
      <mesh position={[0, bottomY + (height - radius) / 2, 0]}>
        <cylinderGeometry args={[radius, radius, height - radius, 28, 1, true]} />
        {glass}
      </mesh>
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.03, 8, 28]} />
        <meshPhysicalMaterial color="#c3e6f2" transparent opacity={0.4} roughness={0.05} />
      </mesh>

      {liquid > 0 && (
        <group ref={liquidRef}>
          <mesh position={[0, bottomY, 0]}>
            <sphereGeometry args={[radius - 0.04, 24, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color={liquidColour} transparent opacity={liquidOpacity} roughness={0.1} depthWrite={false} />
          </mesh>
          <mesh position={[0, bottomY + liquid / 2, 0]}>
            <cylinderGeometry args={[radius - 0.04, radius - 0.04, liquid, 24]} />
            <meshStandardMaterial color={liquidColour} transparent opacity={liquidOpacity} roughness={0.1} depthWrite={false} />
          </mesh>
          {/* The meniscus. Without it a column of 14%-opacity water inside
              14%-opacity glass has no visible top, and the whole point of the
              rack is comparing what is in one tube against another. */}
          <mesh position={[0, bottomY + liquid, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[radius - 0.04, 24]} />
            <meshStandardMaterial
              color={liquidColour}
              transparent
              opacity={Math.min(0.72, liquidOpacity * 3.4)}
              roughness={0.08}
              metalness={0.1}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {oil > 0 && (
        <mesh position={[0, bottomY + liquid + oil / 2, 0]}>
          <cylinderGeometry args={[radius - 0.04, radius - 0.04, oil, 24]} />
          <meshStandardMaterial color="#f4d35e" transparent opacity={0.42} roughness={0.15} depthWrite={false} />
        </mesh>
      )}

      {stopper && (
        <mesh position={[0, height + 0.1, 0]}>
          <cylinderGeometry args={[radius + 0.08, radius - 0.06, 0.5, 24]} />
          <meshStandardMaterial color="#3b3f46" roughness={0.95} />
        </mesh>
      )}

      {desiccant &&
        granules.map((g, i) => (
          <mesh key={i} position={g.position} scale={g.scale}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#eef2f6" roughness={0.6} />
          </mesh>
        ))}

      {children}
    </group>
  );
}

// ─── Electron transfer ──────────────────────────────────────────────

/**
 * Electrons on the move: `count` glowing particles running along a
 * polyline `path` at `rate` traversals per second. `running` false freezes
 * them where they are; `intensity` 0..1 scales both their brightness and
 * how many are visible, so a reaction that is petering out visibly thins.
 *
 * The path is world-space points. The particles are plain meshes rather
 * than an instanced mesh because there are never more than a dozen and
 * per-particle emissive is what sells the glow.
 */
export function ElectronStream({ path, count = 8, rate = 0.4, running = true, intensity = 1, colour = PALETTE.bone, size = 0.07, animSpeed = 1 }) {
  const meshes = useRef([]);
  const phase = useRef(0);
  const points = useMemo(() => path.map((p) => new THREE.Vector3(p[0], p[1], p[2])), [path]);
  const legs = Math.max(1, points.length - 1);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05) * animSpeed;
    if (running) phase.current = (phase.current + step * rate) % 1;
    const visible = Math.round(count * Math.min(1, intensity * 1.2));
    for (let i = 0; i < count; i += 1) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      mesh.visible = i < visible;
      const t = ((phase.current + i / count) % 1) * legs;
      const leg = Math.min(legs - 1, Math.floor(t));
      scratch.lerpVectors(points[leg], points[Math.min(points.length - 1, leg + 1)], t - leg);
      mesh.position.copy(scratch);
      mesh.material.emissiveIntensity = 1.4 + 1.6 * intensity;
    }
  });

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[size, 12, 12]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

/** An arrow with an "e⁻" tag — the direction the electrons go. */
export function ElectronArrow({ from, to, label = "e⁻", colour = PALETTE.bone, opacity = 0.9 }) {
  return <VectorArrow from={from} to={to} color={colour} radius={0.035} headLength={0.24} headRadius={0.1} label={label} labelOffset={0.3} opacity={opacity} />;
}

/**
 * Gas bubbles rising from `origin` to `top`. `rate` 0 draws nothing; 1 is a
 * brisk fizz. Deterministic wobble, so the column never drifts into a
 * pattern the eye reads as a bug.
 */
export function BubbleColumn({ origin = [0, 0, 0], top = 1, rate = 1, spread = 0.2, colour = "#e8f4ff", count = 12, animSpeed = 1 }) {
  const meshes = useRef([]);
  const state = useRef(null);
  if (!state.current) {
    state.current = Array.from({ length: count }, (_, i) => ({
      phase: hashRandom(i * 2.3 + 5),
      rx: (hashRandom(i * 4.7 + 11) - 0.5) * spread,
      rz: (hashRandom(i * 6.1 + 17) - 0.5) * spread,
      size: 0.03 + hashRandom(i * 8.9 + 23) * 0.05,
    }));
  }

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05) * animSpeed;
    const live = Math.round(count * Math.min(1, rate * 1.5));
    state.current.forEach((s, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.visible = i < live && rate > 0;
      if (rate > 0) s.phase = (s.phase + step * (0.35 + rate * 0.5)) % 1;
      const y = lerp(origin[1], top, s.phase);
      const wobble = Math.sin(s.phase * 14 + i) * 0.04;
      mesh.position.set(origin[0] + s.rx + wobble, y, origin[2] + s.rz);
      mesh.scale.setScalar(s.size * (0.6 + s.phase * 0.7));
    });
  });

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.8} transparent opacity={0.7} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Relax a rendered value toward its target with time constant `tau`
 * seconds — the per-frame easing every vessel uses so a slider jump or a
 * control change animates instead of snapping.
 */
export const relaxTo = (value, target, tau, dt) => value + (target - value) * (1 - Math.exp(-dt / Math.max(tau, 1e-6)));

/** Hook: a Vector3 array from a list of triples, rebuilt only when they change. */
export function usePath(points) {
  const key = points.map((p) => p.join(",")).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => points, [key]);
}

/** Keeps a material colour in step with a hex string without a re-render. */
export function useTintedMaterial(ref, colour, opacity) {
  useEffect(() => {
    const obj = ref.current;
    if (!obj) return;
    const apply = (o) => {
      if (o.material) {
        o.material.color.set(colour);
        o.material.opacity = opacity;
      }
    };
    if (obj.isMesh) apply(obj);
    else obj.traverse?.(apply);
  }, [ref, colour, opacity]);
}
