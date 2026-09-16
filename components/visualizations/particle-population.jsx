"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Instanced particle population ──────────────────────────────────
// The one performance pattern the particle-model and radioactive-decay
// scenes share, so it lives here instead of twice: a population of up to
// ten thousand particles drawn as ONE instanced mesh, driven from typed
// arrays the simulation writes into directly.
//
// Why not a mesh per particle: React reconciles each `<mesh>` and three
// issues a draw call for each, so 10 000 of them is 10 000 draw calls and
// a 10 000-element JSX array diffed every render. An `InstancedMesh` is one
// draw call and one 640 KB buffer upload, and nothing in React re-renders
// while the particles move.
//
// Why not `setMatrixAt`: it composes a full transform per instance —
// position, quaternion, scale — through `Object3D.updateMatrix`, which is
// ~40 multiplies and a method chain per particle. Every particle here is a
// sphere, so its matrix is a uniform scale and a translation: six numbers.
// `flushPopulation` writes exactly those six into the matrix array, and the
// twelve constants (zeros and the trailing 1) are written once at mount.
//
// The split of responsibilities:
//
//   createPopulation   the typed arrays — position, velocity, scale,
//                      colour, a free `kind` byte and an age — sized once
//                      at the population's CAPACITY. `count` says how many
//                      are drawn; the rest cost nothing.
//   the simulation     writes into those arrays from its own `useFrame`
//                      (or a pure lib step) and sets `dirtyMatrix` /
//                      `dirtyColour` when it has.
//   InstancedPopulation mounts the mesh, allocates the instance colour
//                      attribute, flushes the arrays into the GPU buffers
//                      only when dirty, and on unmount disposes the mesh
//                      (which is what frees `instanceMatrix` and
//                      `instanceColor` on the renderer — geometry and
//                      material disposal alone would leave them behind).
// ─────────────────────────────────────────────────────────────────────

/** Allocate the arrays for up to `capacity` particles. Nothing is drawn until `count` is raised. */
export function createPopulation(capacity) {
  const n = Math.max(1, Math.floor(capacity));
  return {
    capacity: n,
    count: 0,
    position: new Float32Array(n * 3),
    velocity: new Float32Array(n * 3),
    scale: new Float32Array(n),
    colour: new Float32Array(n * 3),
    kind: new Uint8Array(n),
    age: new Float32Array(n),
    dirtyMatrix: true,
    dirtyColour: true,
  };
}

/** Drop the arrays. The mesh's GPU buffers are freed by `InstancedPopulation`'s own cleanup. */
export function disposePopulation(pop) {
  if (!pop) return;
  pop.count = 0;
  pop.capacity = 0;
  pop.position = pop.velocity = pop.scale = pop.colour = pop.kind = pop.age = null;
}

// Hex strings are parsed once — a simulation recolouring 10 000 particles
// from a palette of five must not construct 10 000 `Color`s a frame.
const COLOUR_CACHE = new Map();
const SCRATCH_COLOUR = new THREE.Color();
export function rgbOf(hex) {
  let rgb = COLOUR_CACHE.get(hex);
  if (!rgb) {
    SCRATCH_COLOUR.set(hex);
    rgb = [SCRATCH_COLOUR.r, SCRATCH_COLOUR.g, SCRATCH_COLOUR.b];
    COLOUR_CACHE.set(hex, rgb);
  }
  return rgb;
}

/** Colour one particle from a hex string (cached) or an `[r, g, b]` triple. */
export function setParticleColour(pop, i, colour) {
  const rgb = typeof colour === "string" ? rgbOf(colour) : colour;
  const o = i * 3;
  pop.colour[o] = rgb[0];
  pop.colour[o + 1] = rgb[1];
  pop.colour[o + 2] = rgb[2];
  pop.dirtyColour = true;
}

/** Blend two hex colours into particle `i` — `t` = 0 is `a`, 1 is `b`. */
export function mixParticleColour(pop, i, a, b, t) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  const o = i * 3;
  pop.colour[o] = A[0] + (B[0] - A[0]) * t;
  pop.colour[o + 1] = A[1] + (B[1] - A[1]) * t;
  pop.colour[o + 2] = A[2] + (B[2] - A[2]) * t;
  pop.dirtyColour = true;
}

/** Place particle `i` — position, uniform scale, kind tag, colour — and reset its velocity and age. */
export function spawnParticle(pop, i, { x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0, scale = 1, kind = 0, colour }) {
  const o = i * 3;
  pop.position[o] = x;
  pop.position[o + 1] = y;
  pop.position[o + 2] = z;
  pop.velocity[o] = vx;
  pop.velocity[o + 1] = vy;
  pop.velocity[o + 2] = vz;
  pop.scale[i] = scale;
  pop.kind[i] = kind;
  pop.age[i] = 0;
  if (colour !== undefined) setParticleColour(pop, i, colour);
  pop.dirtyMatrix = true;
}

/** Hide particle `i` without moving it: scale zero draws nothing. */
export function killParticle(pop, i) {
  pop.scale[i] = 0;
  pop.kind[i] = 0;
  pop.dirtyMatrix = true;
}

/**
 * Write the twelve constants of every instance matrix once. After this,
 * `flushPopulation` only touches the diagonal and the translation.
 */
function primeMatrices(mesh, capacity) {
  const m = mesh.instanceMatrix.array;
  m.fill(0);
  for (let i = 0; i < capacity; i += 1) m[i * 16 + 15] = 1;
}

/**
 * Copy the population's arrays into the mesh's instance buffers — but only
 * the ones marked dirty, and only the first `count` instances. A static
 * population (the ten thousand nuclei, which never move) costs nothing
 * here once it is placed.
 */
export function flushPopulation(pop, mesh) {
  if (!pop || !mesh) return;
  const n = Math.min(pop.count, pop.capacity, mesh.instanceMatrix.count);
  mesh.count = n;
  if (pop.dirtyMatrix) {
    const m = mesh.instanceMatrix.array;
    const p = pop.position;
    const s = pop.scale;
    for (let i = 0; i < n; i += 1) {
      const o = i * 16;
      const k = s[i];
      const q = i * 3;
      m[o] = k;
      m[o + 5] = k;
      m[o + 10] = k;
      m[o + 12] = p[q];
      m[o + 13] = p[q + 1];
      m[o + 14] = p[q + 2];
    }
    mesh.instanceMatrix.needsUpdate = true;
    pop.dirtyMatrix = false;
  }
  if (pop.dirtyColour && mesh.instanceColor) {
    mesh.instanceColor.array.set(pop.colour.subarray(0, n * 3));
    mesh.instanceColor.needsUpdate = true;
    pop.dirtyColour = false;
  }
}

/**
 * The mesh. `population` is the object from `createPopulation`; `onFrame`
 * (optional) is called with `(pop, dt, elapsed)` before the flush so a
 * scene can drive its simulation and its drawing from one place. Geometry
 * and material are passed as children exactly as for a `<mesh>` — the
 * material's `color` multiplies the per-instance colour, so leave it white
 * unless a tint over the whole population is wanted.
 *
 * `maxDt` clamps the frame step so a tab that was hidden does not fire one
 * enormous step when it comes back; `animSpeed` scales it.
 */
export function InstancedPopulation({ population, onFrame, animSpeed = 1, maxDt = 0.05, children, ...meshProps }) {
  const mesh = useRef(null);
  const capacity = population?.capacity ?? 1;

  useEffect(() => {
    const inst = mesh.current;
    if (!inst) return undefined;
    primeMatrices(inst, capacity);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const colour = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    colour.setUsage(THREE.DynamicDrawUsage);
    inst.instanceColor = colour;
    if (population) {
      population.dirtyMatrix = true;
      population.dirtyColour = true;
    }
    return () => {
      // `InstancedMesh.dispose` is the call that releases instanceMatrix and
      // instanceColor from the renderer's attribute cache. The fibre
      // reconciler also disposes geometry and material on unmount; doing it
      // here as well is harmless (three's dispose is idempotent) and means
      // the guarantee does not depend on how the mesh was mounted.
      inst.dispose();
      inst.geometry?.dispose?.();
      const mat = inst.material;
      if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
      else mat?.dispose?.();
      inst.instanceColor = null;
    };
    // Capacity is fixed for the life of the population; a new capacity is a new mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  useFrame((state, delta) => {
    const inst = mesh.current;
    if (!inst || !population) return;
    const dt = Math.min(delta, maxDt) * animSpeed;
    if (onFrame) onFrame(population, dt, state.clock.elapsedTime);
    flushPopulation(population, inst);
  });

  return (
    <instancedMesh key={capacity} ref={mesh} args={[undefined, undefined, capacity]} frustumCulled={false} {...meshProps}>
      {children}
    </instancedMesh>
  );
}

// ─── Small helpers the two scenes share ─────────────────────────────

/** Mulberry32 — a seedable generator, so a test and the scene can draw the same sample. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A sample from N(0, 1) — Box–Muller, one draw per call. */
export function gaussian(rng = Math.random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
