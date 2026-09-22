"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Halo, PALETTE, SceneLabel, clamp, hashRandom } from "@/components/visualizations/scene-kit";

// ─── Ecosystem diorama kit ──────────────────────────────────────────
// The furniture the two ecosystem-scale scenes stand on. Where the cell and
// physiology scenes zoom IN, these zoom OUT — to a wood, a sea and a sky —
// and they want the same things: a slab of ground to build on, a sun, a
// sky to bound the picture, stands of trees whose number is a control, and
// two kinds of moving particle —
//
//   FluxStream    matter or energy going from one place to another at a
//                 rate the model sets (tonnes of carbon a year into the
//                 sea, kilojoules a season up a food chain);
//   PhotonShower  light: sunlight falling on the ground and bouncing, or
//                 infrared leaving it and being caught in the air.
//
// Both are instanced, both are driven by refs so a changing rate never
// re-renders the tree, and both are pure bookkeeping in `useFrame`.
// ─────────────────────────────────────────────────────────────────────

export const ECO_COLOURS = {
  grass: "#4f8a3c",
  grassDry: "#8a9a4a",
  earth: "#5a4030",
  rock: "#6b7280",
  water: "#1d6fa8",
  waterDeep: "#0e3f66",
  trunk: "#6b4a2e",
  canopy: "#2f7a3a",
  canopyLight: "#4aa04c",
  stump: "#8a6b4a",
  sun: "#fde68a",
  shortwave: "#fde047",
  reflected: "#fef9c3",
  longwave: "#fb7185",
  trapped: "#f97316",
  sky: "#38bdf8",
  carbon: "#cbd5e1",
};

// ─── Ground and sky ─────────────────────────────────────────────────

/**
 * A block of land with a grassy top. `size` is [width, thickness, depth];
 * the top face sits at y = position[1], so scenes can build on y = 0.
 */
export function DioramaSlab({ position = [0, 0, 0], size = [14, 1.2, 9], top = ECO_COLOURS.grass, side = ECO_COLOURS.earth, receiveShadow = true }) {
  const [w, t, d] = size;
  return (
    <group position={position}>
      <mesh position={[0, -t / 2, 0]} receiveShadow={receiveShadow}>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial color={side} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={receiveShadow}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={top} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

/** A basin cut into the slab, filled with translucent water. */
export function WaterBody({ position = [0, 0, 0], size = [4, 1, 3], depthColour = ECO_COLOURS.waterDeep, colour = ECO_COLOURS.water, opacity = 0.55 }) {
  const [w, h, d] = size;
  return (
    <group position={position}>
      {/* The basin floor and walls, darker than the ground round them. */}
      <mesh position={[0, -h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={depthColour} roughness={0.9} />
      </mesh>
      {/* The water, sitting a hair below the rim so the edge reads. */}
      <mesh position={[0, -h / 2 - 0.02, 0]}>
        <boxGeometry args={[w - 0.04, h - 0.04, d - 0.04]} />
        <meshStandardMaterial color={colour} roughness={0.15} metalness={0.05} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.04, d - 0.04]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.1} transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * The atmosphere: a hemisphere over the diorama, drawn inside and out at a
 * whisper of opacity so it bounds the scene without hiding it. `tint` and
 * `opacity` are what the greenhouse scene turns up as the air thickens.
 */
export function SkyEnvelope({ centre = [0, 0, 0], radius = 9, colour = ECO_COLOURS.sky, opacity = 0.05, tint }) {
  return (
    <group position={centre}>
      <mesh>
        <sphereGeometry args={[radius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={tint ?? colour} roughness={1} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* The rim where the dome meets the ground. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[radius - 0.04, radius, 96]} />
        <meshBasicMaterial color={colour} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** The sun: a lamp whose brightness is a control, with a caption. */
export function SunSource({ position = [-6, 7, -3], intensity = 1, radius = 0.6, colour = ECO_COLOURS.sun, label }) {
  const k = clamp(intensity, 0, 2);
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 28, 20]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.4 + 1.8 * k} toneMapped={false} />
      </mesh>
      <Halo radius={radius * (1.6 + 0.8 * k)} color={colour} opacity={0.05 + 0.1 * k} />
      <pointLight intensity={2 + 10 * k} distance={40} decay={2} color="#fff3c4" />
      {label && (
        <SceneLabel position={[0, -radius - 0.55, 0]} tone={k > 0.2 ? "text-amber-200" : "text-ink-500"}>
          {label}
        </SceneLabel>
      )}
    </group>
  );
}

// ─── Trees ──────────────────────────────────────────────────────────

const UP = new THREE.Vector3(0, 1, 0);

/**
 * A stand of low-poly trees on a jittered grid over `region` ({ x, z, w,
 * d }): `maxCount` seats, of which `count` are trees and the rest stumps.
 * The number shown eases towards `count`, so a slider reads as clearing
 * or replanting rather than a jump cut. Trees in the front rows are
 * removed first, which is what a diorama of deforestation looks like.
 */
export function TreeStand({ region = { x: 0, z: 0, w: 6, d: 4 }, count = 40, maxCount = 60, seed = 1, height = 1.1, trunkColour = ECO_COLOURS.trunk, canopyColour = ECO_COLOURS.canopy, stumpColour = ECO_COLOURS.stump, easing = 4 }) {
  const trunks = useRef(null);
  const canopies = useRef(null);
  const stumps = useRef(null);
  const state = useRef({ shown: count, dirty: true, dummy: new THREE.Object3D() });

  // Unit tree parts, each lifted to stand on y = 0 at its seat.
  const parts = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6).translate(0, 0.25, 0);
    const canopy = new THREE.ConeGeometry(0.3, 0.9, 7).translate(0, 0.8, 0);
    const stump = new THREE.CylinderGeometry(0.08, 0.1, 0.12, 6).translate(0, 0.06, 0);
    return { trunk, canopy, stump };
  }, []);
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose()), [parts]);

  // Seats: a grid with jitter, ordered back-to-front so the clearing eats forward.
  const seats = useMemo(() => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(maxCount * (region.w / region.d))));
    const rows = Math.max(1, Math.ceil(maxCount / cols));
    const out = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (out.length >= maxCount) break;
        const i = out.length;
        const jx = (hashRandom(seed * 17.3 + i * 3.1) - 0.5) * 0.7;
        const jz = (hashRandom(seed * 29.7 + i * 5.3) - 0.5) * 0.7;
        out.push({
          x: region.x - region.w / 2 + ((c + 0.5 + jx) / cols) * region.w,
          z: region.z - region.d / 2 + ((r + 0.5 + jz) / rows) * region.d,
          scale: 0.75 + 0.5 * hashRandom(seed * 7.1 + i * 1.7),
          lean: (hashRandom(seed * 3.3 + i * 2.9) - 0.5) * 0.12,
          shade: hashRandom(seed * 11.9 + i * 0.7),
        });
      }
    }
    // Back rows (most negative z) keep their trees longest.
    out.sort((a, b) => a.z - b.z);
    return out;
  }, [region.x, region.z, region.w, region.d, maxCount, seed]);

  const canopyColours = useMemo(() => {
    const base = new THREE.Color(canopyColour);
    const light = new THREE.Color(ECO_COLOURS.canopyLight);
    return seats.map((s) => base.clone().lerp(light, s.shade * 0.6));
  }, [seats, canopyColour]);

  useEffect(() => {
    const mesh = canopies.current;
    if (!mesh) return;
    canopyColours.forEach((c, i) => mesh.setColorAt(i, c));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [canopyColours]);

  useFrame((_, rawDelta) => {
    const s = state.current;
    const dt = Math.min(rawDelta, 1 / 30);
    const target = clamp(count, 0, seats.length);
    const before = s.shown;
    s.shown += (target - s.shown) * (1 - Math.exp(-dt * easing));
    if (Math.abs(target - s.shown) < 0.02) s.shown = target;
    if (s.shown === before && !s.dirty) return;
    if (!trunks.current || !canopies.current || !stumps.current) return;
    s.dirty = false;
    const d = s.dummy;
    // A tree part-way through growing or being felled shrinks in place.
    for (let i = 0; i < seats.length; i += 1) {
      const seat = seats[i];
      const presence = clamp(s.shown - i, 0, 1);
      const sc = seat.scale * presence;
      d.position.set(seat.x, 0, seat.z);
      d.rotation.set(seat.lean, 0, seat.lean * 0.6);
      d.scale.set(sc, sc * height, sc);
      d.updateMatrix();
      trunks.current.setMatrixAt(i, d.matrix);
      canopies.current.setMatrixAt(i, d.matrix);
      const stumpScale = seat.scale * (1 - presence);
      d.rotation.set(0, 0, 0);
      d.scale.set(stumpScale, stumpScale, stumpScale);
      d.updateMatrix();
      stumps.current.setMatrixAt(i, d.matrix);
    }
    trunks.current.instanceMatrix.needsUpdate = true;
    canopies.current.instanceMatrix.needsUpdate = true;
    stumps.current.instanceMatrix.needsUpdate = true;
  });

  const n = seats.length;
  return (
    <group>
      <instancedMesh ref={trunks} args={[parts.trunk, undefined, n]} frustumCulled={false} castShadow>
        <meshStandardMaterial color={trunkColour} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={canopies} args={[parts.canopy, undefined, n]} frustumCulled={false} castShadow>
        <meshStandardMaterial color={canopyColour} roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={stumps} args={[parts.stump, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial color={stumpColour} roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

// ─── Moving particles ───────────────────────────────────────────────

/**
 * A stream of particles from `from` to `to`, born at `rateRef.current`
 * per second and taking `travel` seconds to arrive along a gentle arc of
 * height `lift`. A NEGATIVE rate runs the stream the other way, so a flux
 * that changes sign (the ocean giving carbon back) turns round rather
 * than stopping. Particles fade in and out so the ends are soft.
 */
export function FluxStream({ from = [0, 0, 0], to = [0, 2, 0], rateRef, colour = ECO_COLOURS.carbon, count = 60, travel = 2.2, lift = 0.6, spread = 0.18, size = 0.06, speed = 1, seed = 1, opacity = 0.85, emissive = true }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      age: new Float32Array(count).fill(-1),
      dir: new Int8Array(count),
      offset: Float32Array.from({ length: count * 3 }, (_, k) => (hashRandom(seed * 13.7 + k * 2.9) - 0.5) * 2),
      pending: 0,
      dummy: new THREE.Object3D(),
    }),
    [count, seed],
  );

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05) * speed;
    const rate = rateRef ? rateRef.current : 0;
    const forward = rate >= 0 ? 1 : -1;
    state.pending += Math.abs(rate) * dt;
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      let age = state.age[i];
      if (age < 0 && state.pending >= 1) {
        state.pending -= 1;
        age = 0;
        state.dir[i] = forward;
      }
      if (age >= 0) {
        age += dt / travel;
        if (age > 1) age = -1;
      }
      state.age[i] = age;
      if (age < 0) {
        d.scale.setScalar(0);
        d.position.set(0, -100, 0);
      } else {
        const t = state.dir[i] > 0 ? age : 1 - age;
        const o = i * 3;
        d.position.set(
          from[0] + (to[0] - from[0]) * t + state.offset[o] * spread,
          from[1] + (to[1] - from[1]) * t + Math.sin(Math.PI * t) * lift + state.offset[o + 1] * spread * 0.5,
          from[2] + (to[2] - from[2]) * t + state.offset[o + 2] * spread,
        );
        d.scale.setScalar(size * Math.sin(Math.PI * Math.min(1, age * 1.05)) ** 0.5);
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (state.pending > 3) state.pending = 3;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      {emissive ? (
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={1.2} toneMapped={false} transparent opacity={opacity} depthWrite={false} />
      ) : (
        <meshBasicMaterial color={colour} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
      )}
    </instancedMesh>
  );
}

/** Photon kinds, for colouring. */
const SHORTWAVE = 0;
const REFLECTED = 1;
const LONGWAVE = 2;
const TRAPPED = 3;

/**
 * Light. Two modes:
 *
 *   `shortwave`  photons leave `origin` (the sun) towards a patch of ground
 *                (`ground`: { x, z, w, d, y }); at the ground a fraction
 *                `albedo` bounce back up and out, the rest are absorbed;
 *   `longwave`   photons leave the ground straight up; on crossing
 *                `envelopeY` a fraction `trapRef.current` are absorbed by
 *                the air and re-emitted in a random direction — half of
 *                them back down — while the rest escape to space.
 *
 * `rateRef.current` is photons per second. Colour is per instance so a
 * bounced or trapped photon changes colour the moment it does.
 */
export function PhotonShower({ mode = "shortwave", origin = [-6, 7, -3], ground = { x: 0, z: 0, w: 10, d: 6, y: 0 }, envelopeY = 5, escapeY = 9, rateRef, trapRef, albedo = 0.3, count = 120, speed = 1, velocity = 4.5, size = 0.05, seed = 3, colours = ECO_COLOURS }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      age: new Float32Array(count).fill(-1),
      pos: new Float32Array(count * 3),
      vel: new Float32Array(count * 3),
      kind: new Uint8Array(count),
      pending: 0,
      spawned: 0,
      dummy: new THREE.Object3D(),
      colour: new THREE.Color(),
      palette: [new THREE.Color(colours.shortwave), new THREE.Color(colours.reflected), new THREE.Color(colours.longwave), new THREE.Color(colours.trapped)],
    }),
    [count, colours],
  );

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05) * speed;
    const rate = rateRef ? rateRef.current : 0;
    const trap = trapRef ? clamp(trapRef.current, 0, 1) : 0;
    state.pending += rate * dt;
    const d = state.dummy;
    const short = mode === "shortwave";
    let colourDirty = false;

    for (let i = 0; i < count; i += 1) {
      let age = state.age[i];
      const o = i * 3;
      if (age < 0 && state.pending >= 1) {
        state.pending -= 1;
        state.spawned += 1;
        const h = (k) => hashRandom(seed * 31.1 + i * 7.3 + k * 97.7 + state.spawned * 3.3) - 0.5;
        const gx = ground.x + h(1) * ground.w;
        const gz = ground.z + h(2) * ground.d;
        if (short) {
          // From the sun to a random point on the ground.
          state.pos[o] = origin[0] + h(3) * 0.4;
          state.pos[o + 1] = origin[1] + h(4) * 0.4;
          state.pos[o + 2] = origin[2] + h(5) * 0.4;
          const dx = gx - state.pos[o];
          const dy = ground.y - state.pos[o + 1];
          const dz = gz - state.pos[o + 2];
          const len = Math.hypot(dx, dy, dz) || 1;
          state.vel[o] = (dx / len) * velocity;
          state.vel[o + 1] = (dy / len) * velocity;
          state.vel[o + 2] = (dz / len) * velocity;
          state.kind[i] = SHORTWAVE;
        } else {
          // Off the ground, straight up with a little scatter.
          state.pos[o] = gx;
          state.pos[o + 1] = ground.y + 0.05;
          state.pos[o + 2] = gz;
          state.vel[o] = h(3) * 0.6;
          state.vel[o + 1] = velocity * 0.8;
          state.vel[o + 2] = h(4) * 0.6;
          state.kind[i] = LONGWAVE;
        }
        age = 0;
        colourDirty = true;
      }

      if (age >= 0) {
        age += dt;
        const y0 = state.pos[o + 1];
        state.pos[o] += state.vel[o] * dt;
        state.pos[o + 1] += state.vel[o + 1] * dt;
        state.pos[o + 2] += state.vel[o + 2] * dt;
        const y1 = state.pos[o + 1];
        const kind = state.kind[i];
        const roll = hashRandom(seed * 5.7 + i * 1.3 + state.spawned * 0.11 + age * 13.7);

        if (short && kind === SHORTWAVE && y1 <= ground.y) {
          // Hits the ground: bounce (albedo) or be absorbed.
          if (roll < albedo) {
            state.pos[o + 1] = ground.y + 0.01;
            state.vel[o + 1] = Math.abs(state.vel[o + 1]);
            state.vel[o] *= 0.6;
            state.vel[o + 2] *= 0.6;
            state.kind[i] = REFLECTED;
            colourDirty = true;
          } else {
            age = -1;
          }
        } else if (!short && kind === LONGWAVE && y0 < envelopeY && y1 >= envelopeY) {
          // Crosses the greenhouse layer: absorbed and re-emitted, or through.
          if (roll < trap) {
            const theta = hashRandom(seed * 9.1 + i * 2.7 + age * 31.3) * Math.PI * 2;
            const up = hashRandom(seed * 4.3 + i * 6.1 + age * 17.9) < 0.5 ? 1 : -1;
            const horiz = velocity * 0.45;
            state.vel[o] = Math.cos(theta) * horiz;
            state.vel[o + 1] = up * velocity * 0.7;
            state.vel[o + 2] = Math.sin(theta) * horiz;
            state.kind[i] = TRAPPED;
            colourDirty = true;
          }
        } else if (kind === TRAPPED && y1 <= ground.y) {
          // Back-radiation lands: the ground keeps the heat.
          age = -1;
        }

        if (y1 > escapeY || y1 < ground.y - 0.5 || age > 6) age = -1;
      }

      state.age[i] = age;
      if (age < 0) {
        d.scale.setScalar(0);
        d.position.set(0, -100, 0);
      } else {
        d.position.set(state.pos[o], state.pos[o + 1], state.pos[o + 2]);
        d.scale.setScalar(size * (state.kind[i] === TRAPPED ? 1.4 : 1));
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      if (colourDirty) mesh.setColorAt(i, state.palette[state.kind[i]]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colourDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (state.pending > 4) state.pending = 4;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 5]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

/** A dashed guide line in the XZ plane — the edge of a region, a boundary. */
export function GroundRing({ position = [0, 0.02, 0], radius = 1, colour = PALETTE.line, opacity = 0.4 }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.03, radius, 48]} />
      <meshBasicMaterial color={colour} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Orientation for a cylinder that should point from `a` to `b`. */
export function segmentQuaternion(a, b) {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  return { length: len, quaternion: new THREE.Quaternion().setFromUnitVectors(UP, len > 1e-6 ? dir.normalize() : UP.clone()), midpoint: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] };
}
