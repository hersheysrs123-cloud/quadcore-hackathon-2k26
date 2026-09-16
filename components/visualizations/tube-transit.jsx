"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hashRandom } from "@/components/visualizations/scene-kit";
import {
  advancePhase,
  streamPositions,
  tubeIndices,
  tubeVertexCount,
  writeTubeVertices,
} from "@/lib/tubeTransit";

// ─── Tube transit ───────────────────────────────────────────────────
// The drawing side of `lib/tubeTransit.js`: the three things the plant
// and gut scenes both hang their animation on.
//
//   ProfiledTube  a tube along +y whose radius (and, if wanted, centre and
//                 colour) at every ring is a callback. Static tubes are
//                 written once; dynamic ones are rewritten IN PLACE every
//                 frame — the buffers never reallocate, so a peristaltic
//                 wave costs a loop over a few hundred vertices and nothing
//                 else. A xylem vessel with lignin rings and a gut with a
//                 travelling constriction are the same component.
//   TubeRings     a set of tori stacked along the tube, each one sized to
//                 the tube's radius at its station and as thick as the
//                 caller says — annular thickening on a vessel wall, or
//                 circular muscle that fattens as it contracts.
//   TubeFlow      instanced particles streaming from one end of an OPEN
//                 tube to the other and recycling, scattered across the
//                 lumen's cross-section, with an optional front they may
//                 not pass. Water going up a stem; chyme going down a gut.
//
// Callbacks are read through refs, so a scene can hand in closures over
// its own per-frame state without re-creating any geometry.
// ─────────────────────────────────────────────────────────────────────

const useLatest = (value) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

// ─── ProfiledTube ───────────────────────────────────────────────────

/**
 * @param length      tube length along local +y, s = 0 at y = 0
 * @param rings       ring count along the length
 * @param segments    vertices around each ring
 * @param radiusAt    (s) → radius
 * @param centreAt    optional (s, out) → writes out[0] = x, out[1] = z
 * @param colourAt    optional (s, out) → writes out[0..2] = r, g, b in 0–1;
 *                    enables per-vertex colour (set `vertexColors` on the
 *                    material)
 * @param dynamic     rewrite every frame (callbacks may read mutable state)
 * @param vRepeat     texture repeats along the length
 */
export function ProfiledTube({
  length,
  rings = 64,
  segments = 24,
  radiusAt,
  centreAt = null,
  colourAt = null,
  dynamic = false,
  vRepeat = 1,
  children,
  ...meshProps
}) {
  const radiusRef = useLatest(radiusAt);
  const centreRef = useLatest(centreAt);
  const colourRef = useLatest(colourAt);
  const hasCentre = Boolean(centreAt);
  const hasColour = Boolean(colourAt);

  const built = useMemo(() => {
    const n = tubeVertexCount(rings, segments);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(n * 3);
    const normals = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    let colours = null;
    if (hasColour) {
      colours = new Float32Array(n * 3);
      geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    }
    geometry.setIndex(new THREE.BufferAttribute(tubeIndices(rings, segments), 1));
    const station = new Float32Array(rings);
    for (let i = 0; i < rings; i += 1) station[i] = (i / (rings - 1)) * length;
    return {
      geometry,
      positions,
      normals,
      uvs,
      colours,
      station,
      radius: new Float32Array(rings),
      centreX: hasCentre ? new Float32Array(rings) : null,
      centreZ: hasCentre ? new Float32Array(rings) : null,
      scratch2: [0, 0],
      scratch3: [0, 0, 0],
    };
  }, [length, rings, segments, hasCentre, hasColour]);

  useEffect(() => () => built.geometry.dispose(), [built]);

  const write = () => {
    const b = built;
    const rAt = radiusRef.current;
    const cAt = centreRef.current;
    const kAt = colourRef.current;
    for (let i = 0; i < rings; i += 1) {
      const s = b.station[i];
      b.radius[i] = Math.max(1e-4, rAt ? rAt(s) : 1);
      if (b.centreX && cAt) {
        cAt(s, b.scratch2);
        b.centreX[i] = b.scratch2[0];
        b.centreZ[i] = b.scratch2[1];
      }
      if (b.colours && kAt) {
        kAt(s, b.scratch3);
        const perRing = segments + 1;
        for (let j = 0; j <= segments; j += 1) {
          const k = (i * perRing + j) * 3;
          b.colours[k] = b.scratch3[0];
          b.colours[k + 1] = b.scratch3[1];
          b.colours[k + 2] = b.scratch3[2];
        }
      }
    }
    writeTubeVertices(b, { rings, segments, station: b.station, radius: b.radius, centreX: b.centreX, centreZ: b.centreZ, vRepeat });
    const g = b.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    if (g.attributes.color) g.attributes.color.needsUpdate = true;
    g.computeBoundingSphere();
  };

  // Static tubes are written when they are built or their callbacks change.
  useLayoutEffect(() => {
    write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, dynamic ? null : radiusAt, dynamic ? null : centreAt, dynamic ? null : colourAt, vRepeat]);

  useFrame(() => {
    if (dynamic) write();
  });

  return (
    <mesh geometry={built.geometry} {...meshProps}>
      {children ?? <meshStandardMaterial color="#cbd5e1" roughness={0.5} />}
    </mesh>
  );
}

// ─── TubeRings ──────────────────────────────────────────────────────

/**
 * `count` tori around the tube's axis, all in ONE geometry so a wall of
 * thirty rings is one draw call. Each ring `i` sits at `stationAt(i)` (or
 * evenly spaced), with major radius `radiusAt(s)` and minor radius
 * `thicknessAt(s)`; `colourAt(s, out)` tints it. Positions are rewritten
 * in place each frame when `dynamic`.
 */
export function TubeRings({
  length,
  count = 24,
  radiusAt,
  thicknessAt,
  stationAt = null,
  colourAt = null,
  dynamic = false,
  tubular = 28,
  radial = 8,
  children,
  ...meshProps
}) {
  const radiusRef = useLatest(radiusAt);
  const thickRef = useLatest(thicknessAt);
  const stationRef = useLatest(stationAt);
  const colourRef = useLatest(colourAt);
  const hasColour = Boolean(colourAt);

  const built = useMemo(() => {
    const perRing = (tubular + 1) * (radial + 1);
    const n = count * perRing;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(n * 3);
    const normals = new Float32Array(n * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    let colours = null;
    if (hasColour) {
      colours = new Float32Array(n * 3);
      geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    }
    // Index: for each ring, a (tubular × radial) grid of quads.
    const index = new Uint32Array(count * tubular * radial * 6);
    let k = 0;
    for (let r = 0; r < count; r += 1) {
      const base = r * perRing;
      for (let j = 0; j < tubular; j += 1) {
        for (let i = 0; i < radial; i += 1) {
          const a = base + j * (radial + 1) + i;
          const b = a + radial + 1;
          const c = b + 1;
          const d = a + 1;
          // (∂φ × ∂θ) faces outward, so φ goes first in each triangle.
          index[k++] = a;
          index[k++] = d;
          index[k++] = b;
          index[k++] = b;
          index[k++] = d;
          index[k++] = c;
        }
      }
    }
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    return { geometry, positions, normals, colours, perRing, scratch3: [0, 0, 0] };
  }, [count, tubular, radial, hasColour]);

  useEffect(() => () => built.geometry.dispose(), [built]);

  const write = () => {
    const b = built;
    const rAt = radiusRef.current;
    const tAt = thickRef.current;
    const sAt = stationRef.current;
    const kAt = colourRef.current;
    const twoPi = Math.PI * 2;
    for (let r = 0; r < count; r += 1) {
      const s = sAt ? sAt(r) : ((r + 0.5) / count) * length;
      const R = Math.max(1e-4, rAt ? rAt(s) : 1);
      const t = Math.max(1e-4, tAt ? tAt(s) : 0.05);
      if (b.colours && kAt) kAt(s, b.scratch3);
      for (let j = 0; j <= tubular; j += 1) {
        const theta = (j / tubular) * twoPi;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        for (let i = 0; i <= radial; i += 1) {
          const phi = (i / radial) * twoPi;
          const cosP = Math.cos(phi);
          const sinP = Math.sin(phi);
          const k = (r * b.perRing + j * (radial + 1) + i) * 3;
          const ring = R + t * cosP;
          b.positions[k] = ring * cosT;
          b.positions[k + 1] = s + t * sinP;
          b.positions[k + 2] = ring * sinT;
          b.normals[k] = cosP * cosT;
          b.normals[k + 1] = sinP;
          b.normals[k + 2] = cosP * sinT;
          if (b.colours) {
            b.colours[k] = b.scratch3[0];
            b.colours[k + 1] = b.scratch3[1];
            b.colours[k + 2] = b.scratch3[2];
          }
        }
      }
    }
    const g = b.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    if (g.attributes.color) g.attributes.color.needsUpdate = true;
    g.computeBoundingSphere();
  };

  useLayoutEffect(() => {
    write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, length, dynamic ? null : radiusAt, dynamic ? null : thicknessAt, dynamic ? null : stationAt, dynamic ? null : colourAt]);

  useFrame(() => {
    if (dynamic) write();
  });

  return (
    <mesh geometry={built.geometry} {...meshProps}>
      {children ?? <meshStandardMaterial color="#cbd5e1" roughness={0.5} />}
    </mesh>
  );
}

// ─── TubeFlow ───────────────────────────────────────────────────────

/**
 * `count` glowing particles streaming along local +y from `from` to `to`
 * at `speed` units/s (negative runs them back), recycling at the far end.
 * Each particle keeps a fixed radial seat inside the lumen — `fill` of the
 * local radius from `radiusAt(s)` — so a stream fills a vessel rather than
 * threading its axis. `frontRef.current`, if given, is the furthest station
 * the column has reached: particles beyond it are hidden.
 *
 * `speedRef` lets a scene drive the speed from its own frame loop without
 * a React render; it wins over `speed` when present.
 */
export function TubeFlow({
  length,
  from = 0,
  to = null,
  count = 40,
  speed = 1,
  speedRef = null,
  radiusAt = null,
  radius = 0.3,
  fill = 0.65,
  frontRef = null,
  colour = "#38bdf8",
  size = 0.05,
  running = true,
  opacity = 1,
  emissiveIntensity = 1.8,
  seed = 1,
  ...meshProps
}) {
  const meshRef = useRef(null);
  const end = to === null ? length : to;
  const n = Math.max(0, Math.round(count));
  const state = useMemo(
    () => ({
      phase: 0,
      stations: new Float32Array(n),
      dummy: new THREE.Object3D(),
      seats: Array.from({ length: n }, (_, i) => ({
        angle: hashRandom(seed * 17.3 + i * 3.1) * Math.PI * 2,
        rho: Math.sqrt(hashRandom(seed * 41.7 + i * 5.9)),
        scale: 0.75 + 0.5 * hashRandom(seed * 73.1 + i * 7.7),
      })),
    }),
    [n, seed],
  );
  const radiusRef = useLatest(radiusAt);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || n === 0) return;
    const span = end - from;
    const v = speedRef ? speedRef.current : speed;
    if (running && v !== 0) state.phase = advancePhase(state.phase, v, Math.min(delta, 0.05), span);
    const front = frontRef ? frontRef.current : Infinity;
    streamPositions(n, from, end, state.phase, state.stations, front);
    const rAt = radiusRef.current;
    const d = state.dummy;
    for (let i = 0; i < n; i += 1) {
      const s = state.stations[i];
      if (Number.isNaN(s)) {
        d.position.set(0, 0, 0);
        d.scale.setScalar(0);
      } else {
        const seat = state.seats[i];
        const rho = seat.rho * fill * (rAt ? rAt(s) : radius);
        d.position.set(Math.cos(seat.angle) * rho, s, Math.sin(seat.angle) * rho);
        d.scale.setScalar(seat.scale);
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (n === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, n]} frustumCulled={false} {...meshProps}>
      <sphereGeometry args={[size, 10, 8]} />
      <meshStandardMaterial
        color={colour}
        emissive={colour}
        emissiveIntensity={emissiveIntensity}
        toneMapped={false}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.3}
        depthWrite={opacity >= 1}
      />
    </instancedMesh>
  );
}
