"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hashRandom } from "@/components/visualizations/scene-kit";
import { carrierFraction } from "@/lib/carriers";

// ─── Charge carriers ────────────────────────────────────────────────
// The animated charge shared by the two electrical scenes: glowing carriers
// running along a path, and the + / − markers that sit on a charged surface.
//
// Both scenes needed the same awkward piece — moving n particles along a
// polyline at a CONSTANT speed — and neither can be honest without it. A
// naive implementation interpolates by segment index, which makes carriers
// sprint across short segments and crawl along long ones; in a circuit that
// reads as the current changing at every corner of the board, which is the
// one thing about a series loop a student must not come away believing.
// So the path is resampled by arc length once, and everything rides on that.
//
// The carriers are instanced. A drift animation wants forty or so of them per
// branch and a fresh mesh each would cost forty draw calls to say one thing.
// ─────────────────────────────────────────────────────────────────────

export const CHARGE_COLOURS = {
  /** Electrons — negative, cold. Same blue in both scenes on purpose. */
  electron: "#38bdf8",
  /** Unbalanced positive charge, left behind when electrons leave. */
  positive: "#fb7185",
  /** Copper trace. */
  copper: "#c2703b",
};

// ─── Arc-length paths ───────────────────────────────────────────────

/**
 * A polyline with a cumulative-length table, so `at(t)` is uniform in
 * DISTANCE rather than in vertex index.
 *
 * Returns plain data plus a sampler; nothing here allocates per frame except
 * through the caller's own scratch vector, which `at` writes into.
 */
export function makeFlowPath(points, { closed = false } = {}) {
  const verts = (points ?? [])
    .filter(Boolean)
    .map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0)));

  if (closed && verts.length > 1) verts.push(verts[0].clone());

  const cumulative = [0];
  for (let i = 1; i < verts.length; i += 1) {
    cumulative.push(cumulative[i - 1] + verts[i].distanceTo(verts[i - 1]));
  }
  const length = cumulative[cumulative.length - 1] || 0;

  return {
    points: verts,
    cumulative,
    length,
    closed,
    /**
     * Position at fraction `t` of the way along, by arc length.
     * `t` wraps for a closed path and clamps for an open one.
     */
    at(t, out = new THREE.Vector3()) {
      if (verts.length === 0) return out.set(0, 0, 0);
      if (verts.length === 1 || length <= 1e-9) return out.copy(verts[0]);

      const f = closed ? ((t % 1) + 1) % 1 : Math.min(Math.max(t, 0), 1);
      const target = f * length;

      // Binary search the cumulative table — paths here run to a few hundred
      // vertices and this is called once per carrier per frame.
      let lo = 0;
      let hi = cumulative.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] <= target) lo = mid;
        else hi = mid;
      }
      const span = cumulative[hi] - cumulative[lo];
      const local = span > 1e-9 ? (target - cumulative[lo]) / span : 0;
      return out.lerpVectors(verts[lo], verts[hi], local);
    },
  };
}

// ─── Flowing carriers ───────────────────────────────────────────────

// Scratch vector moved into each component instance via useMemo (see ChargeFlow)

/**
 * `count` glowing carriers running along `path` at `speed` world units per
 * second.
 *
 * Spacing is even and fixed; only the speed responds to the physics. In the
 * circuit scene that is the literal truth about a wire — copper's charge
 * density is a property of the copper, so more current is the same electrons
 * moving faster — and keeping the same convention in the static scene means
 * a fast stream reads as a big transfer in both places.
 *
 * `spread` under 1 bunches the carriers into the leading fraction of the path,
 * which is how the static scene draws a burst of electrons crossing during a
 * rub rather than a continuous loop.
 *
 * `wrap` makes an OPEN path behave like one link of a loop: carriers leaving
 * the end re-enter at the start. It is what a wire in a circuit needs. It is
 * off by default because the burst above depends on carriers stopping at the
 * end of their path.
 */
export function ChargeFlow({
  path,
  count = 24,
  speed = 1,
  colour = CHARGE_COLOURS.electron,
  radius = 0.055,
  running = true,
  reverse = false,
  spread = 1,
  offset = 0,
  opacity = 1,
  emissiveIntensity = 2.2,
  seed = 1,
  jitter = 0,
  wrap = false,
}) {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const SCRATCH = useMemo(() => new THREE.Vector3(), []);
  const phase = useRef(0);

  const n = Math.max(0, Math.round(count));
  const usable = path && path.length > 1e-6 && n > 0;

  // Per-carrier lateral offsets, so a wide trace does not look like a single
  // file of beads. Deterministic, so they do not reshuffle on every render.
  const wobble = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => [
        (hashRandom(seed * 31.7 + i * 2.1) - 0.5) * 2,
        (hashRandom(seed * 57.3 + i * 3.7) - 0.5) * 2,
        (hashRandom(seed * 91.1 + i * 5.3) - 0.5) * 2,
      ]),
    [n, seed],
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !usable) return;

    if (running && speed !== 0) {
      // Advance in path-fractions: distance moved ÷ total path length.
      phase.current += ((reverse ? -1 : 1) * speed * Math.min(delta, 0.05)) / path.length;
      phase.current = ((phase.current % 1) + 1) % 1;
    }

    for (let i = 0; i < n; i += 1) {
      path.at(carrierFraction(phase.current, offset, i, n, spread, wrap), SCRATCH);
      const w = wobble[i];
      dummy.position.set(
        SCRATCH.x + w[0] * jitter,
        SCRATCH.y + w[1] * jitter,
        SCRATCH.z + w[2] * jitter,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!usable) return null;

  return (
    // `args` carries the count, so R3F rebuilds the instanced mesh — and
    // disposes the old buffers — whenever the carrier count changes.
    <instancedMesh ref={meshRef} args={[undefined, undefined, n]} frustumCulled={false}>
      <sphereGeometry args={[radius, 10, 10]} />
      <meshStandardMaterial
        color={colour}
        emissive={colour}
        emissiveIntensity={emissiveIntensity}
        toneMapped={false}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.3}
      />
    </instancedMesh>
  );
}

// ─── Surface charge markers ─────────────────────────────────────────

const BAR = 0.6;
const THICK = 0.16;

/**
 * A field of + and − glyphs sitting on a surface.
 *
 * Two instanced meshes, not one mesh per sign: every glyph needs a horizontal
 * bar and only the plus signs need the vertical one, so the whole cloud costs
 * two draw calls whatever the charge count is. The scenes redraw these every
 * time the count changes, which with leakage is continuous.
 *
 * `signs` is `[{ position, sign, rotation? }]`. Rotation lets the static scene
 * lay markers flat against a vertical wall as well as around a balloon.
 */
export function ChargeSigns({ signs = [], size = 0.12, opacity = 1 }) {
  const positives = useMemo(() => signs.filter((s) => s.sign > 0), [signs]);
  const negatives = useMemo(() => signs.filter((s) => s.sign <= 0), [signs]);

  return (
    <>
      <SignSet items={positives} size={size} colour={CHARGE_COLOURS.positive} stem opacity={opacity} />
      <SignSet items={negatives} size={size} colour={CHARGE_COLOURS.electron} opacity={opacity} />
    </>
  );
}

/** The bars for one polarity. `stem` adds the vertical stroke of a plus. */
function SignSet({ items, size, colour, stem = false, opacity }) {
  const barRef = useRef(null);
  const stemRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const n = items.length;

  // Marker positions only move when the charge count does, so the matrices
  // are written on change rather than every frame. With leakage running that
  // is still several times a second, but it is not sixty.
  useLayoutEffect(() => {
    if (n === 0) return;
    for (let i = 0; i < n; i += 1) {
      const item = items[i];
      const p = item.position;
      dummy.position.set(p[0], p[1], p[2]);
      if (item.rotation) dummy.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
      else dummy.rotation.set(0, 0, 0);

      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      barRef.current?.setMatrixAt(i, dummy.matrix);

      if (stem && stemRef.current) {
        // Same transform, rotated a quarter turn about the glyph's own normal.
        dummy.rotateZ(Math.PI / 2);
        dummy.updateMatrix();
        stemRef.current.setMatrixAt(i, dummy.matrix);
      }
    }
    if (barRef.current) barRef.current.instanceMatrix.needsUpdate = true;
    if (stem && stemRef.current) stemRef.current.instanceMatrix.needsUpdate = true;
  }, [items, n, stem, dummy]);

  if (n === 0) return null;

  const material = (
    <meshStandardMaterial
      color={colour}
      emissive={colour}
      emissiveIntensity={1.5}
      toneMapped={false}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );

  return (
    <>
      <instancedMesh ref={barRef} args={[undefined, undefined, n]} frustumCulled={false}>
        <boxGeometry args={[size * BAR, size * THICK, size * THICK]} />
        {material}
      </instancedMesh>
      {stem && (
        <instancedMesh ref={stemRef} args={[undefined, undefined, n]} frustumCulled={false}>
          <boxGeometry args={[size * BAR, size * THICK, size * THICK]} />
          {material}
        </instancedMesh>
      )}
    </>
  );
}

// ─── Marker placement ───────────────────────────────────────────────

/**
 * `count` markers scattered over a sphere, spaced by the Fibonacci lattice.
 *
 * Even spacing matters more than it sounds: random placement clumps, and a
 * clump of minus signs on a balloon invites exactly the wrong idea, that
 * static charge pools in patches rather than spreading over the surface.
 * Charge on a conductor does spread; on latex it does not move much at all,
 * but it was deposited evenly by the rubbing, so even is still the honest
 * picture.
 */
export function sphereMarkers(count, radius, { centre = [0, 0, 0], faceOut = true, arc = 1 } = {}) {
  const n = Math.max(0, Math.round(count));
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i += 1) {
    // `arc` under 1 keeps the markers in a cap around the +Y pole instead of
    // wrapping the whole sphere.
    const y = 1 - (i / Math.max(n - 1, 1)) * 2 * arc;
    const r = Math.sqrt(Math.max(1 - y * y, 0));
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    out.push({
      position: [centre[0] + x * radius, centre[1] + y * radius, centre[2] + z * radius],
      rotation: faceOut ? [0, Math.atan2(x, z), 0] : [0, 0, 0],
    });
  }
  return out;
}

/**
 * `count` markers filling a rectangular patch, densest at the middle.
 *
 * Used for the induced charge on the wall, where the concentration under the
 * balloon is the whole visual point — a uniform grid would say the wall
 * polarised everywhere equally, and it does not.
 */
export function patchMarkers(count, { centre = [0, 0, 0], width = 1, height = 1, seed = 7, plane = "xy" } = {}) {
  const n = Math.max(0, Math.round(count));
  const out = [];
  for (let i = 0; i < n; i += 1) {
    // Two hashes averaged tend to the middle — a cheap bell curve.
    const u = (hashRandom(seed + i * 1.7) + hashRandom(seed + i * 4.3 + 11)) / 2 - 0.5;
    const v = (hashRandom(seed + i * 2.9 + 5) + hashRandom(seed + i * 6.1 + 23)) / 2 - 0.5;
    const a = u * width;
    const b = v * height;
    out.push({
      position:
        plane === "xy"
          ? [centre[0] + a, centre[1] + b, centre[2]]
          : [centre[0] + a, centre[1], centre[2] + b],
      rotation: plane === "xy" ? [0, 0, 0] : [Math.PI / 2, 0, 0],
    });
  }
  return out;
}
