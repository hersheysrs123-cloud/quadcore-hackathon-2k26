"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE, SceneLabel, clamp, hashRandom } from "@/components/visualizations/scene-kit";

// ─── Cell organelles ────────────────────────────────────────────────
// Built shapes for the cell explorer. The scene in BiologyCanvas composes
// these; everything here is about the *form* of one organelle and knows
// nothing about osmosis, selection state or the readout.
//
// Two rules keep it looking like a cell rather than a bag of primitives:
//
//   1. Nothing is a bare primitive. Every closed surface goes through
//      `makeBlobGeometry`, which pushes vertices along a smooth 3D noise
//      field. A sphere reads as a ball; a sphere with 8% noise on it reads
//      as something grown.
//   2. Membranes are surfaces you see *through*, so interiors have to be
//      worth seeing — cristae inside the mitochondria, grana stacks inside
//      the chloroplasts, a nucleolus and chromatin inside the nucleus.
// ─────────────────────────────────────────────────────────────────────

// ═══ Geometry helpers ════════════════════════════════════════════════

/**
 * Smooth deterministic 3D noise, summed over four octaves.
 *
 * Sine products rather than a gradient lattice: it is a few lines, needs no
 * permutation table, and is only ever sampled at build time to bend a mesh —
 * the artefacts a proper simplex noise avoids are invisible at this amplitude.
 */
function fbm3(x, y, z) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let octave = 0; octave < 4; octave += 1) {
    value +=
      amplitude *
      Math.sin(x * frequency * 1.7 + octave * 2.1) *
      Math.sin(y * frequency * 1.3 + octave * 3.7) *
      Math.sin(z * frequency * 2.1 + octave * 1.3);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

/**
 * A sphere pushed around by `fbm3` — the base shape for almost everything.
 *
 * Deliberately built on SphereGeometry rather than an icosahedron: sphere
 * geometry is indexed, so `computeVertexNormals` averages across shared
 * vertices and the result shades smoothly. A displaced icosahedron is
 * non-indexed and comes out faceted, which reads as low-poly, not organic.
 */
export function makeBlobGeometry({
  radius = 1,
  amp = 0.08,
  freq = 1.2,
  seed = 0,
  scale = [1, 1, 1],
  segments = 48,
  rings = 32,
}) {
  const geometry = new THREE.SphereGeometry(radius, segments, rings);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const noise = fbm3(
      vertex.x * freq + seed,
      vertex.y * freq + seed * 1.7,
      vertex.z * freq + seed * 2.3,
    );
    vertex.multiplyScalar(1 + noise * amp);
    vertex.set(vertex.x * scale[0], vertex.y * scale[1], vertex.z * scale[2]);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Roundness of the plant cell wall. Shared, because the fibril strokes are
 * projected onto the same surface the wall mesh is built from — if these ever
 * drift apart the hatching lifts off the wall.
 */
export const WALL_EXPONENT = 6;

/**
 * Superellipsoid — a box with genuinely rounded edges, for the plant cell.
 *
 * A plant cell is brick-shaped because the wall holds it that way, but a
 * `boxGeometry` has knife-sharp corners no cell has. Raising the exponent
 * slides the shape from sphere (2) to brick (~8).
 */
export function makeRoundedBoxGeometry({
  size = [1, 1, 1],
  exponent = 6,
  amp = 0.012,
  seed = 3,
  segments = 64,
  rings = 44,
}) {
  const geometry = new THREE.SphereGeometry(1, segments, rings);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const direction = vertex.clone().normalize();
    const norm = Math.pow(
      Math.pow(Math.abs(direction.x), exponent) +
        Math.pow(Math.abs(direction.y), exponent) +
        Math.pow(Math.abs(direction.z), exponent),
      -1 / exponent,
    );
    const noise = fbm3(direction.x * 2 + seed, direction.y * 2 + seed, direction.z * 2 + seed);
    direction.multiplyScalar(norm * (1 + noise * amp));
    position.setXYZ(
      i,
      direction.x * size[0] * 0.5,
      direction.y * size[1] * 0.5,
      direction.z * size[2] * 0.5,
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A flat ribbon swept along a curve — endoplasmic reticulum cisternae.
 *
 * `TubeGeometry` would be the obvious tool and is wrong here: ER is a stack
 * of flattened *sheets*, not piping, and a circular cross-section loses the
 * one feature that distinguishes it from the smooth ER tubules next to it.
 */
export function makeRibbonGeometry(curve, halfWidth, samples = 180) {
  const points = curve.getSpacedPoints(samples);
  const frames = curve.computeFrenetFrames(samples, false);

  const positions = [];
  const indices = [];

  for (let i = 0; i <= samples; i += 1) {
    const point = points[i];
    const binormal = frames.binormals[i];
    // Taper both ends so a cisterna fades out instead of stopping square.
    const t = i / samples;
    const taper = Math.sin(Math.PI * clamp(t, 0, 1)) ** 0.35;
    const w = halfWidth * taper;
    positions.push(
      point.x + binormal.x * w,
      point.y + binormal.y * w,
      point.z + binormal.z * w,
      point.x - binormal.x * w,
      point.y - binormal.y * w,
      point.z - binormal.z * w,
    );
  }

  for (let i = 0; i < samples; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * One crista: a corrugated shelf, tapered to an ellipse so it sits inside
 * the mitochondrion's cross-section instead of poking through the envelope.
 */
export function makeCristaGeometry({ width = 0.5, height = 0.44, waves = 9, amp = 0.035 }) {
  const geometry = new THREE.PlaneGeometry(width, height, 44, 10);
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const t = clamp(x / (width / 2), -1, 1);
    const taper = Math.sqrt(Math.max(0, 1 - t * t));
    position.setY(i, y * taper);
    position.setZ(i, Math.sin(x * waves) * amp * taper);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Evenly spread points on a sphere — nuclear pores, surface proteins. */
export function fibonacciSphere(count) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius));
  }
  return points;
}

/** A wandering closed-ish curve inside a radius — chromatin, ER, tubules. */
function wanderCurve({ seed, points = 7, radius = 1, spread = [1, 1, 1], closed = false }) {
  const controls = [];
  for (let i = 0; i < points; i += 1) {
    const a = hashRandom(seed + i * 3.1) * Math.PI * 2;
    const b = Math.acos(2 * hashRandom(seed + i * 7.7) - 1);
    const r = radius * (0.35 + hashRandom(seed + i * 5.3) * 0.65);
    controls.push(
      new THREE.Vector3(
        Math.sin(b) * Math.cos(a) * r * spread[0],
        Math.cos(b) * r * spread[1],
        Math.sin(b) * Math.sin(a) * r * spread[2],
      ),
    );
  }
  return new THREE.CatmullRomCurve3(controls, closed, "catmullrom", 0.5);
}

/** Build geometries once and dispose the whole set when the scene unmounts. */
function useGeometries(factory, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(factory, deps);
  useEffect(
    () => () => {
      const bag = Array.isArray(built) ? built : Object.values(built);
      bag.flat().forEach((g) => g?.dispose?.());
    },
    [built],
  );
  return built;
}

// ═══ Cutaway clipping ════════════════════════════════════════════════

const ClipContext = createContext(null);

const NO_CLIP = [];

export function useClip() {
  return useContext(ClipContext) ?? NO_CLIP;
}

/**
 * A cutaway plane, so the detail inside is actually reachable.
 *
 * Everything below draws interiors that a closed translucent envelope only
 * half reveals. Rather than fading the membranes out — which loses the very
 * boundary the syllabus cares about — this slices the front off the whole
 * cell, the way a textbook section does, and leaves the cut edge visible.
 */
export function CutawayProvider({ enabled, children }) {
  const gl = useThree((state) => state.gl);
  // The clipping shader discards fragments where `dot(position, normal) >
  // constant`, so the normal points at the half that is *removed*. Pointing
  // it at -Z kept the camera-facing half and threw away the hidden one, which
  // from a front-on view is indistinguishable from no cutaway at all.
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);

  useEffect(() => {
    const previous = gl.localClippingEnabled;
    gl.localClippingEnabled = true;
    return () => {
      gl.localClippingEnabled = previous;
    };
  }, [gl]);

  const planes = useMemo(() => (enabled ? [plane] : NO_CLIP), [enabled, plane]);


  return <ClipContext.Provider value={planes}>{children}</ClipContext.Provider>;
}

// ═══ Shared materials ════════════════════════════════════════════════

/**
 * Three material roles, so the cell reads as layers of depth rather than a
 * pile of equally-lit objects:
 *
 *   membrane — you see through it, and it catches a highlight at the rim
 *   matrix   — the fluid inside a compartment; soft, barely lit
 *   dense    — the structures you are meant to look at; solid and shaded
 */
/**
 * Every material below carries `key={clip.length}`.
 *
 * `NUM_CLIPPING_PLANES` is a #define baked into the compiled shader, so
 * assigning a new `clippingPlanes` array to a live material changes nothing —
 * the cutaway toggle silently did nothing until each material was rebuilt
 * instead. Keying on the plane count remounts them exactly when that number
 * changes, and never otherwise.
 */
export function MembraneMaterial({ color, opacity = 0.22, selected = false, side }) {
  const clip = useClip();
  return (
    <meshPhysicalMaterial
      key={clip.length}
      color={color}
      emissive={color}
      emissiveIntensity={selected ? 0.55 : 0.12}
      transparent
      opacity={selected ? Math.min(0.55, opacity + 0.16) : opacity}
      roughness={0.22}
      metalness={0}
      clearcoat={0.85}
      clearcoatRoughness={0.25}
      iridescence={0.45}
      iridescenceIOR={1.35}
      transmission={0}
      side={side ?? THREE.DoubleSide}
      depthWrite={false}
      clippingPlanes={clip}
      clipShadows
    />
  );
}

export function MatrixMaterial({ color, opacity = 0.42, selected = false }) {
  const clip = useClip();
  return (
    <meshPhysicalMaterial
      key={clip.length}
      color={color}
      emissive={color}
      emissiveIntensity={selected ? 0.5 : 0.16}
      transparent
      opacity={opacity}
      roughness={0.55}
      metalness={0.02}
      sheen={0.6}
      sheenColor={color}
      side={THREE.DoubleSide}
      depthWrite={false}
      clippingPlanes={clip}
    />
  );
}

export function DenseMaterial({
  color,
  selected = false,
  roughness = 0.42,
  emissiveIntensity,
  opacity = 1,
  side,
  flatShading = false,
}) {
  const clip = useClip();
  return (
    <meshPhysicalMaterial
      key={clip.length}
      color={color}
      emissive={color}
      emissiveIntensity={emissiveIntensity ?? (selected ? 0.85 : 0.22)}
      roughness={roughness}
      metalness={0.08}
      clearcoat={0.3}
      sheen={0.35}
      sheenColor={color}
      transparent={opacity < 1}
      opacity={opacity}
      side={side ?? THREE.FrontSide}
      flatShading={flatShading}
      clippingPlanes={clip}
    />
  );
}

/**
 * Backface-only shell that lights up the silhouette of a selected organelle.
 *
 * Selection used to be signalled by cranking `emissiveIntensity`, which on a
 * translucent membrane is nearly invisible — the thing you clicked was the
 * thing that changed least. A rim reads instantly at any depth.
 */
function SelectionRim({ geometry, color, scale = 1.06, visible }) {
  const clip = useClip();
  if (!visible) return null;
  return (
    <mesh geometry={geometry} scale={scale}>
      <meshBasicMaterial
        key={clip.length}
        color={color}
        transparent
        opacity={0.32}
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        clippingPlanes={clip}
      />
    </mesh>
  );
}

/**
 * drei's `Line` draws with a `LineMaterial`, which is a ShaderMaterial — and
 * ShaderMaterial does not compile in the clipping chunks unless you ask via
 * `.clipping`. Without this the wall fibrils and cytoskeleton kept drawing
 * across the cutaway, floating in front of the sectioned cell.
 */
function ClippedLine(props) {
  const ref = useRef(null);
  const clip = useClip();

  useLayoutEffect(() => {
    const material = ref.current?.material;
    if (!material) return;
    material.clippingPlanes = clip;
    material.clipping = clip.length > 0;
    material.needsUpdate = true;
  }, [clip]);

  return <Line ref={ref} {...props} />;
}

/** Click / hover plumbing, shared by every organelle. */
export function Pickable({ id, onSelect, children }) {
  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {children}
    </group>
  );
}

// ═══ Nucleus ═════════════════════════════════════════════════════════

/**
 * Nuclear envelope (two membranes), pores, nucleolus and chromatin.
 *
 * The pores are the detail worth paying for: they are why the envelope is a
 * *double* membrane with holes rather than a solid shell, and they are how
 * mRNA gets out to the ribosomes. Forty of them, spread by Fibonacci so they
 * do not clump at the poles the way random spherical sampling does.
 */
export function Nucleus({ radius = 1.05, selected, onSelect, showLabel, chromatinSpin = 1 }) {
  const chromatinRef = useRef(null);
  const poresRef = useRef(null);
  const clip = useClip();

  const geo = useGeometries(
    () => ({
      outer: makeBlobGeometry({ radius: radius * 1.06, amp: 0.05, freq: 1.4, seed: 11 }),
      inner: makeBlobGeometry({ radius: radius * 0.99, amp: 0.05, freq: 1.4, seed: 11 }),
      nucleolus: makeBlobGeometry({
        radius: radius * 0.34,
        amp: 0.16,
        freq: 2.6,
        seed: 27,
        segments: 32,
        rings: 24,
      }),
      pore: new THREE.TorusGeometry(radius * 0.075, radius * 0.026, 8, 18),
      chromatin: Array.from({ length: 4 }, (_, i) =>
        new THREE.TubeGeometry(
          wanderCurve({ seed: 90 + i * 11, points: 9, radius: radius * 0.78, closed: true }),
          90,
          radius * 0.017,
          6,
          true,
        ),
      ),
    }),
    [radius],
  );

  const pores = useMemo(() => fibonacciSphere(40), []);

  useLayoutEffect(() => {
    const mesh = poresRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    pores.forEach((direction, i) => {
      dummy.position.copy(direction).multiplyScalar(radius * 1.03);
      // A pore is a hole *through* the envelope, so the ring lies flat in the
      // surface — look along the normal, not at the centre.
      dummy.lookAt(dummy.position.clone().add(direction));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [pores, radius]);

  useFrame((_, delta) => {
    if (chromatinRef.current) chromatinRef.current.rotation.y += delta * 0.06 * chromatinSpin;
  });

  return (
    <Pickable id="nucleus" onSelect={onSelect}>
      <SelectionRim geometry={geo.outer} color={PALETTE.violet} visible={selected} scale={1.05} />

      {/* Chromatin — loose tangled threads, not condensed chromosomes. */}
      <group ref={chromatinRef}>
        {geo.chromatin.map((geometry, i) => (
          <mesh key={i} geometry={geometry}>
            <DenseMaterial
              color={i % 2 ? "#a78bfa" : "#7c3aed"}
              roughness={0.6}
              emissiveIntensity={selected ? 0.6 : 0.22}
            />
          </mesh>
        ))}
      </group>

      {/* Nucleolus — denser region where ribosomes are assembled. */}
      <mesh geometry={geo.nucleolus} position={[radius * 0.22, -radius * 0.16, 0]}>
        <DenseMaterial color="#6d28d9" roughness={0.75} emissiveIntensity={selected ? 0.8 : 0.35} />
      </mesh>

      {/* Nucleoplasm. */}
      <mesh geometry={geo.inner}>
        <MatrixMaterial color={PALETTE.violet} opacity={0.16} selected={selected} />
      </mesh>

      {/* The two membranes of the envelope. */}
      <mesh geometry={geo.outer}>
        <MembraneMaterial color={PALETTE.violet} opacity={0.2} selected={selected} />
      </mesh>

      <instancedMesh ref={poresRef} args={[geo.pore, undefined, pores.length]}>
        <meshPhysicalMaterial
          key={clip.length}
          color="#ddd6fe"
          emissive="#a78bfa"
          emissiveIntensity={selected ? 1.5 : 0.75}
          roughness={0.3}
          metalness={0.15}
          clippingPlanes={clip}
        />
      </instancedMesh>

      {showLabel && (
        <SceneLabel position={[0, radius * 1.5, 0]} accent={selected}>
          Nucleus
        </SceneLabel>
      )}
    </Pickable>
  );
}

// ═══ Mitochondrion ═══════════════════════════════════════════════════

/**
 * Outer membrane, inner membrane, and cristae as corrugated shelves.
 *
 * The old version drew the cristae as rings *around* the outside, which is
 * backwards — cristae are folds of the inner membrane, and their whole point
 * is surface area for the reactions of aerobic respiration. Here they sit
 * inside a translucent envelope where they belong, alternating from each
 * side so they interleave the way real ones do.
 */
export function Mitochondrion({ selected, onSelect, showLabel, seed = 0, cristae = 8 }) {
  const geo = useGeometries(
    () => ({
      outer: makeBlobGeometry({
        radius: 0.36,
        amp: 0.1,
        freq: 2.2,
        seed: 40 + seed,
        scale: [2.05, 1, 1],
        segments: 40,
        rings: 26,
      }),
      inner: makeBlobGeometry({
        radius: 0.3,
        amp: 0.1,
        freq: 2.4,
        seed: 40 + seed,
        scale: [2.0, 1, 1],
        segments: 32,
        rings: 22,
      }),
      crista: makeCristaGeometry({ width: 0.52, height: 0.5, waves: 11, amp: 0.03 }),
    }),
    [seed],
  );

  return (
    <Pickable id="mitochondrion" onSelect={onSelect}>
      <SelectionRim geometry={geo.outer} color={PALETTE.rose} visible={selected} scale={1.12} />

      {/* Matrix — the fluid the cristae sit in. */}
      <mesh geometry={geo.inner}>
        <MatrixMaterial color="#7f1d3a" opacity={0.5} selected={selected} />
      </mesh>

      {/* Cristae, alternating high/low across the long axis. */}
      {Array.from({ length: cristae }, (_, i) => {
        const t = (i + 0.5) / cristae;
        const x = (t - 0.5) * 1.24;
        // Narrow toward the rounded ends so no shelf breaks the envelope.
        const fit = Math.sqrt(Math.max(0.05, 1 - Math.pow((x / 0.72) * 1.0, 2)));
        const offset = (i % 2 ? 1 : -1) * 0.055;
        return (
          <mesh
            key={i}
            geometry={geo.crista}
            position={[x, offset, 0]}
            rotation={[0, Math.PI / 2, hashRandom(seed * 3 + i) * 0.24 - 0.12]}
            scale={[fit, fit * 0.94, 1]}
          >
            <DenseMaterial
              color="#fda4af"
              roughness={0.5}
              opacity={0.92}
              side={THREE.DoubleSide}
              emissiveIntensity={selected ? 0.8 : 0.34}
            />
          </mesh>
        );
      })}

      {/* Outer membrane. */}
      <mesh geometry={geo.outer}>
        <MembraneMaterial color={PALETTE.rose} opacity={0.2} selected={selected} />
      </mesh>

      {showLabel && (
        <SceneLabel position={[0, 0.62, 0]} accent={selected}>
          Mitochondrion
        </SceneLabel>
      )}
    </Pickable>
  );
}

// ═══ Chloroplast ═════════════════════════════════════════════════════

/**
 * Envelope, grana (stacks of thylakoid discs), stroma lamellae joining the
 * stacks, and a starch grain.
 *
 * Chlorophyll sits in the thylakoid membranes, so the stacks are not
 * decoration — they are the reason a chloroplast can trap light at all, and
 * the reason it is drawn green.
 */
export function Chloroplast({ selected, onSelect, showLabel, seed = 0 }) {
  const stacks = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        position: [
          (hashRandom(seed * 5 + i) - 0.5) * 0.72,
          (hashRandom(seed * 5 + i + 30) - 0.5) * 0.2,
          (hashRandom(seed * 5 + i + 60) - 0.5) * 0.46,
        ],
        discs: 4 + Math.floor(hashRandom(seed * 5 + i + 90) * 4),
        tilt: (hashRandom(seed * 5 + i + 120) - 0.5) * 0.7,
      })),
    [seed],
  );

  const geo = useGeometries(
    () => ({
      envelope: makeBlobGeometry({
        radius: 0.52,
        amp: 0.07,
        freq: 2,
        seed: 70 + seed,
        scale: [1.5, 0.62, 1.05],
        segments: 40,
        rings: 26,
      }),
      stroma: makeBlobGeometry({
        radius: 0.47,
        amp: 0.07,
        freq: 2,
        seed: 70 + seed,
        scale: [1.48, 0.58, 1.02],
        segments: 28,
        rings: 20,
      }),
      thylakoid: new THREE.CylinderGeometry(0.108, 0.108, 0.018, 20),
      starch: makeBlobGeometry({
        radius: 0.1,
        amp: 0.2,
        freq: 3,
        seed: 88 + seed,
        segments: 20,
        rings: 14,
      }),
      lamella: new THREE.CylinderGeometry(0.012, 0.012, 1, 6),
    }),
    [seed],
  );

  return (
    <Pickable id="chloroplast" onSelect={onSelect}>
      <SelectionRim geometry={geo.envelope} color={PALETTE.emerald} visible={selected} scale={1.1} />

      <mesh geometry={geo.stroma}>
        <MatrixMaterial color="#065f46" opacity={0.4} selected={selected} />
      </mesh>

      {stacks.map((stack, i) => (
        <group key={i} position={stack.position} rotation={[stack.tilt, i * 0.7, stack.tilt * 0.5]}>
          {Array.from({ length: stack.discs }, (_, d) => (
            <mesh
              key={d}
              geometry={geo.thylakoid}
              position={[0, (d - (stack.discs - 1) / 2) * 0.028, 0]}
              scale={[1 - Math.abs(d - (stack.discs - 1) / 2) * 0.04, 1, 1]}
            >
              <DenseMaterial
                color="#22c55e"
                roughness={0.38}
                emissiveIntensity={selected ? 0.9 : 0.42}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Stroma lamellae — the tubes that connect one granum to the next. */}
      {stacks.slice(0, -1).map((stack, i) => {
        const next = stacks[i + 1];
        const a = new THREE.Vector3(...stack.position);
        const b = new THREE.Vector3(...next.position);
        const delta = new THREE.Vector3().subVectors(b, a);
        const length = delta.length();
        if (length < 1e-4) return null;
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          delta.clone().normalize(),
        );
        return (
          <mesh
            key={i}
            geometry={geo.lamella}
            position={a.clone().add(b).multiplyScalar(0.5)}
            quaternion={quaternion}
            scale={[1, length, 1]}
          >
            <DenseMaterial
              color="#16a34a"
              roughness={0.5}
              opacity={0.75}
              emissiveIntensity={selected ? 0.6 : 0.28}
            />
          </mesh>
        );
      })}

      {/* Starch grain — glucose from photosynthesis, stored. */}
      <mesh geometry={geo.starch} position={[-0.42, -0.06, 0.16]}>
        <DenseMaterial color="#d9f99d" roughness={0.8} emissiveIntensity={selected ? 0.5 : 0.18} />
      </mesh>

      <mesh geometry={geo.envelope}>
        <MembraneMaterial color={PALETTE.emerald} opacity={0.18} selected={selected} />
      </mesh>

      {showLabel && (
        <SceneLabel position={[0, 0.55, 0]} accent={selected}>
          Chloroplast
        </SceneLabel>
      )}
    </Pickable>
  );
}

// ═══ Golgi apparatus ═════════════════════════════════════════════════

/** Stacked curved cisternae with vesicles budding off the rim. */
export function Golgi({ selected, onSelect, showLabel }) {
  const layers = 6;
  const budRef = useRef(null);

  const geo = useGeometries(
    () => ({
      cisternae: Array.from({ length: layers }, (_, i) =>
        new THREE.SphereGeometry(0.62 - i * 0.058, 40, 14, 0, Math.PI * 2, 0, 0.5),
      ),
      vesicle: makeBlobGeometry({
        radius: 0.072,
        amp: 0.2,
        freq: 4,
        seed: 130,
        segments: 16,
        rings: 12,
      }),
    }),
    [],
  );

  const buds = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        angle: hashRandom(140 + i) * Math.PI * 2,
        radius: 0.56 + hashRandom(160 + i) * 0.26,
        y: -0.16 + hashRandom(180 + i) * 0.4,
        phase: hashRandom(200 + i),
      })),
    [],
  );

  useFrame((state) => {
    const group = budRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    buds.forEach((bud, i) => {
      const child = group.children[i];
      if (!child) return;
      // Vesicles drift outward, then reset — secretion, on a loop.
      const local = (t * 0.12 + bud.phase) % 1;
      const r = bud.radius + local * 0.5;
      child.position.set(Math.cos(bud.angle) * r, bud.y + local * 0.16, Math.sin(bud.angle) * r);
      child.scale.setScalar(0.3 + Math.sin(local * Math.PI) * 0.9);
    });
  });

  return (
    <Pickable id="golgi" onSelect={onSelect}>
      {geo.cisternae.map((geometry, i) => (
        <mesh
          key={i}
          geometry={geometry}
          position={[0, i * 0.095 - 0.24, 0]}
          scale={[1, 0.38, 1]}
          rotation={[0, i * 0.16, 0]}
        >
          <DenseMaterial
            color={i % 2 ? "#fcd34d" : "#fbbf24"}
            roughness={0.36}
            opacity={0.88}
            side={THREE.DoubleSide}
            emissiveIntensity={selected ? 0.8 : 0.3}
          />
        </mesh>
      ))}

      <group ref={budRef}>
        {buds.map((_, i) => (
          <mesh key={i} geometry={geo.vesicle}>
            <DenseMaterial
              color="#fde68a"
              roughness={0.4}
              emissiveIntensity={selected ? 1 : 0.55}
            />
          </mesh>
        ))}
      </group>

      {showLabel && (
        <SceneLabel position={[0, 0.5, 0]} accent={selected}>
          Golgi apparatus
        </SceneLabel>
      )}
    </Pickable>
  );
}

// ═══ Endoplasmic reticulum ═══════════════════════════════════════════

/**
 * Rough ER: folded sheets studded with ribosomes. The ribosomes are the
 * whole distinction from smooth ER, so they are instanced onto the actual
 * ribbon surface rather than scattered near it.
 */
export function RoughER({ selected, onSelect, showLabel, radius = 1.9 }) {
  const clip = useClip();
  const ribosomeRef = useRef(null);

  const { sheets, ribosomeGeometry, studs } = useGeometries(() => {
    const built = [];
    const points = [];

    for (let s = 0; s < 6; s += 1) {
      const controls = [];
      const turns = 1.5;
      const steps = 9;
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const angle = t * Math.PI * 2 * turns + s * 1.5;
        const r = radius * (0.86 + Math.sin(t * Math.PI * 2 + s) * 0.16);
        controls.push(
          new THREE.Vector3(
            Math.cos(angle) * r,
            (t - 0.5) * 1.3 + Math.sin(t * 5 + s) * 0.18 + (s - 2.5) * 0.2,
            Math.sin(angle) * r * 0.8,
          ),
        );
      }
      const curve = new THREE.CatmullRomCurve3(controls, false, "catmullrom", 0.5);
      built.push(makeRibbonGeometry(curve, 0.15, 150));

      // Sample the same curve for ribosome positions.
      const frames = curve.computeFrenetFrames(60, false);
      curve.getSpacedPoints(60).forEach((point, i) => {
        if (i % 2) return;
        const normal = frames.normals[i];
        const side = i % 4 === 0 ? 1 : -1;
        points.push(point.clone().addScaledVector(normal, 0.026 * side));
      });
    }

    return {
      sheets: built,
      ribosomeGeometry: new THREE.SphereGeometry(0.038, 10, 8),
      studs: points,
    };
  }, [radius]);

  useLayoutEffect(() => {
    const mesh = ribosomeRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    studs.forEach((point, i) => {
      dummy.position.copy(point);
      dummy.scale.setScalar(0.75 + hashRandom(i * 2.7) * 0.6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [studs]);

  return (
    <Pickable id="er" onSelect={onSelect}>
      {sheets.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <DenseMaterial
            color="#38bdf8"
            roughness={0.42}
            opacity={0.55}
            side={THREE.DoubleSide}
            emissiveIntensity={selected ? 0.75 : 0.24}
          />
        </mesh>
      ))}

      <instancedMesh ref={ribosomeRef} args={[ribosomeGeometry, undefined, studs.length]}>
        <meshPhysicalMaterial
          key={clip.length}
          color={PALETTE.bone}
          emissive={PALETTE.bone}
          emissiveIntensity={selected ? 1.1 : 0.5}
          roughness={0.5}
          clippingPlanes={clip}
        />
      </instancedMesh>

      {showLabel && (
        <SceneLabel position={[radius * 0.9, 1.1, 0]} accent={selected}>
          Rough ER
        </SceneLabel>
      )}
    </Pickable>
  );
}

/** Smooth ER: tubules, no ribosomes — lipid synthesis rather than protein. */
export function SmoothER({ selected, onSelect, showLabel, position = [0, 0, 0] }) {
  const geo = useGeometries(
    () => ({
      tubules: Array.from({ length: 3 }, (_, i) =>
        new THREE.TubeGeometry(
          wanderCurve({
            seed: 210 + i * 13,
            points: 8,
            radius: 0.72,
            spread: [1.2, 0.7, 1],
            closed: false,
          }),
          80,
          0.045,
          8,
          false,
        ),
      ),
    }),
    [],
  );

  return (
    <Pickable id="smoothEr" onSelect={onSelect}>
      <group position={position}>
        {geo.tubules.map((geometry, i) => (
          <mesh key={i} geometry={geometry}>
            <DenseMaterial
              color="#22d3ee"
              roughness={0.4}
              opacity={0.8}
              emissiveIntensity={selected ? 0.85 : 0.3}
            />
          </mesh>
        ))}
        {showLabel && (
          <SceneLabel position={[0, 0.85, 0]} accent={selected}>
            Smooth ER
          </SceneLabel>
        )}
      </group>
    </Pickable>
  );
}

// ═══ Small bodies ════════════════════════════════════════════════════

/** Lysosome — a bag of digestive enzymes, drawn granular. */
export function Lysosome({ selected, onSelect, seed = 0 }) {
  const geo = useGeometries(
    () => ({
      body: makeBlobGeometry({
        radius: 0.13,
        amp: 0.18,
        freq: 3.4,
        seed: 240 + seed,
        segments: 22,
        rings: 16,
      }),
    }),
    [seed],
  );

  return (
    <Pickable id="lysosome" onSelect={onSelect}>
      <mesh geometry={geo.body}>
        <DenseMaterial
          color="#f472b6"
          roughness={0.55}
          emissiveIntensity={selected ? 1 : 0.4}
        />
      </mesh>
    </Pickable>
  );
}

/**
 * Centriole pair — nine microtubule triplets in a barrel, two barrels at
 * right angles. Animal cells only; this is the structure that organises the
 * spindle during division.
 */
export function Centrioles({ selected, onSelect, showLabel }) {
  const geo = useGeometries(
    () => ({ tubule: new THREE.CylinderGeometry(0.016, 0.016, 0.34, 6) }),
    [],
  );

  const barrel = (key, rotation) => (
    <group key={key} rotation={rotation}>
      {Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 9) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(angle) * 0.13, 0, Math.sin(angle) * 0.13]}>
            {[-1, 0, 1].map((t) => (
              <mesh
                key={t}
                geometry={geo.tubule}
                position={[Math.cos(angle + Math.PI / 2) * t * 0.032, 0, Math.sin(angle + Math.PI / 2) * t * 0.032]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <DenseMaterial
                  color="#a5b4fc"
                  roughness={0.35}
                  emissiveIntensity={selected ? 1 : 0.4}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );

  return (
    <Pickable id="centriole" onSelect={onSelect}>
      {barrel("a", [0, 0, 0])}
      {barrel("b", [0, 0, Math.PI / 2])}
      {showLabel && (
        <SceneLabel position={[0, 0.42, 0]} accent={selected}>
          Centrioles
        </SceneLabel>
      )}
    </Pickable>
  );
}

// ═══ Vacuole, wall and membrane ══════════════════════════════════════

/** Permanent vacuole, bounded by the tonoplast. */
export function Vacuole({ selected, onSelect, showLabel, scale = 1 }) {
  const geo = useGeometries(
    () => ({
      sap: makeBlobGeometry({
        radius: 1.68,
        amp: 0.06,
        freq: 1.1,
        seed: 300,
        scale: [1.12, 1, 1],
        segments: 44,
        rings: 30,
      }),
      tonoplast: makeBlobGeometry({
        radius: 1.74,
        amp: 0.06,
        freq: 1.1,
        seed: 300,
        scale: [1.12, 1, 1],
        segments: 44,
        rings: 30,
      }),
    }),
    [],
  );

  return (
    <Pickable id="vacuole" onSelect={onSelect}>
      <group scale={scale}>
        <SelectionRim geometry={geo.tonoplast} color="#0ea5e9" visible={selected} scale={1.04} />
        <mesh geometry={geo.sap}>
          <MatrixMaterial color="#0ea5e9" opacity={0.09} selected={selected} />
        </mesh>
        <mesh geometry={geo.tonoplast}>
          <MembraneMaterial color="#38bdf8" opacity={0.11} selected={selected} />
        </mesh>
        {showLabel && (
          <SceneLabel position={[0, 1.95, 0]} accent={selected}>
            Permanent vacuole
          </SceneLabel>
        )}
      </group>
    </Pickable>
  );
}

/**
 * Cellulose wall with visible microfibrils.
 *
 * The fibrils are what make it a *cellulose* wall rather than a green box:
 * they run in crossed layers, which is exactly why the wall resists stretch
 * in every direction and stops the cell bursting.
 */
export function CellWall({ size, selected, onSelect, showLabel }) {
  const geo = useGeometries(
    () => ({
      wall: makeRoundedBoxGeometry({ size, exponent: WALL_EXPONENT, amp: 0.01, seed: 5 }),
      lamella: makeRoundedBoxGeometry({
        size: [size[0] * 1.045, size[1] * 1.05, size[2] * 1.05],
        exponent: WALL_EXPONENT,
        amp: 0.01,
        seed: 5,
      }),
    }),
    [size[0], size[1], size[2]],
  );

  /**
   * Short strokes in two alternating directions, tiled across each large
   * face.
   *
   * Full-width lines were the first attempt and read as scratches on the
   * lens rather than as structure — one continuous stroke across the whole
   * cell has no scale, so the eye files it as an artefact. Short crossed
   * strokes are also the truer picture: the wall is layers of fibrils laid
   * down at angles to each other, which is why it resists stretch in every
   * direction at once.
   */
  const fibrils = useMemo(() => {
    const out = [];
    const [w, h, d] = size;

    /**
     * Project a direction onto the wall's surface — the same superellipsoid
     * `makeRoundedBoxGeometry` builds.
     *
     * Laying the strokes on flat planes at ±size/2 was wrong: those planes
     * are tangent to the *extreme* point of a rounded box, so everything away
     * from the face centre floated outside the wall and the hatching spilled
     * past the cell's silhouette. Projecting wraps them onto the real
     * surface, rounded edges included.
     */
    const onWall = (dx, dy, dz) => {
      const v = new THREE.Vector3(dx, dy, dz).normalize();
      const norm = Math.pow(
        Math.pow(Math.abs(v.x), WALL_EXPONENT) +
          Math.pow(Math.abs(v.y), WALL_EXPONENT) +
          Math.pow(Math.abs(v.z), WALL_EXPONENT),
        -1 / WALL_EXPONENT,
      );
      // A hair proud of the surface so the strokes are not z-fought away.
      const r = norm * 1.006;
      return [v.x * r * w * 0.5, v.y * r * h * 0.5, v.z * r * d * 0.5];
    };

    // Two layers per face, each with a single consistent lean and offset half
    // a step from the other. Alternating the lean stroke-by-stroke instead
    // produced a chevron net, which reads as wire mesh rather than as two
    // sheets of fibrils laid across each other.
    const tile = (toDir, uCount, vCount, len) => {
      for (const layer of [1, -1]) {
        const nudge = layer > 0 ? 0 : 0.5;
        for (let iu = 0; iu < uCount; iu += 1) {
          for (let iv = 0; iv < vCount; iv += 1) {
            const u = ((iu + nudge) / (uCount - 1) - 0.5) * 1.7;
            const v = ((iv + nudge) / (vCount - 1) - 0.5) * 1.7;
            out.push(
              onWall(...toDir(u - len, v - len * layer)),
              onWall(...toDir(u + len, v + len * layer)),
            );
          }
        }
      }
    };

    tile((u, v) => [u, v, 1], 9, 6, 0.11);
    tile((u, v) => [u, v, -1], 9, 6, 0.11);
    tile((u, v) => [u, 1, v], 9, 6, 0.11);
    tile((u, v) => [u, -1, v], 9, 6, 0.11);
    return out;
  }, [size[0], size[1], size[2]]);

  return (
    <Pickable id="wall" onSelect={onSelect}>
      {/* Middle lamella — the pectin layer cementing neighbouring cells. */}
      <mesh geometry={geo.lamella}>
        <MembraneMaterial color="#a16207" opacity={selected ? 0.16 : 0.07} selected={selected} />
      </mesh>

      <mesh geometry={geo.wall}>
        <MembraneMaterial color={selected ? PALETTE.emerald : "#4d7c0f"} opacity={0.14} selected={selected} />
      </mesh>

      <ClippedLine
        points={fibrils}
        segments
        color={selected ? PALETTE.emerald : "#65a30d"}
        lineWidth={1}
        transparent
        opacity={selected ? 0.45 : 0.18}
      />

      {showLabel && (
        <SceneLabel position={[0, size[1] * 0.5 + 0.35, 0]} accent={selected}>
          Cell wall
        </SceneLabel>
      )}
    </Pickable>
  );
}

/**
 * A patch of phospholipid bilayer, shown when the membrane is selected.
 *
 * At whole-cell scale the membrane can only ever be a translucent skin, so
 * "partially permeable" stays a phrase rather than a structure. Zooming one
 * patch out to molecular scale is the only honest way to show *why* it is
 * partially permeable: two rows of heads, tails inside, gaps small enough to
 * pass water and nothing much else.
 */
export function BilayerPatch({ position, normal = [0, 0, 1], visible }) {
  const clip = useClip();

  const geo = useGeometries(
    () => ({
      head: new THREE.SphereGeometry(0.055, 14, 12),
      tail: new THREE.CylinderGeometry(0.011, 0.011, 0.15, 6),
      protein: makeBlobGeometry({
        radius: 0.11,
        amp: 0.22,
        freq: 3,
        seed: 410,
        scale: [1, 1.7, 1],
        segments: 20,
        rings: 16,
      }),
    }),
    [],
  );

  const quaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(...normal).normalize(),
      ),
    [normal[0], normal[1], normal[2]],
  );

  if (!visible) return null;

  const columns = 9;

  return (
    <group position={position} quaternion={quaternion}>
      {[1, -1].map((side) =>
        Array.from({ length: columns }, (_, i) => {
          const x = (i - (columns - 1) / 2) * 0.13;
          // Leave a gap where the transport protein sits.
          if (Math.abs(i - 3) < 1) return null;
          return (
            <group key={`${side}-${i}`} position={[x, side * 0.13, 0]}>
              <mesh geometry={geo.head}>
                <meshPhysicalMaterial
                  key={clip.length}
                  color={PALETTE.gold}
                  emissive={PALETTE.gold}
                  emissiveIntensity={0.75}
                  roughness={0.3}
                  clippingPlanes={clip}
                />
              </mesh>
              <mesh geometry={geo.tail} position={[0, -side * 0.1, 0]}>
                <meshPhysicalMaterial
                  key={clip.length}
                  color="#fcd34d"
                  emissive="#fcd34d"
                  emissiveIntensity={0.3}
                  roughness={0.6}
                  clippingPlanes={clip}
                />
              </mesh>
            </group>
          );
        }),
      )}

      {/* Channel protein — the route for things that cannot cross the tails. */}
      <mesh geometry={geo.protein} position={[(3 - (columns - 1) / 2) * 0.13, 0, 0]}>
        <meshPhysicalMaterial
          key={clip.length}
          color={PALETTE.sky}
          emissive={PALETTE.sky}
          emissiveIntensity={0.7}
          roughness={0.4}
          clippingPlanes={clip}
        />
      </mesh>

      <SceneLabel position={[0, 0.42, 0]} accent>
        phospholipid bilayer
      </SceneLabel>
    </group>
  );
}

// ═══ Cytoplasm ═══════════════════════════════════════════════════════

/**
 * Cytoplasmic streaming — instanced granules drifting on slow loops.
 *
 * Cheap, but it is what stops the cell reading as a museum diorama. One
 * InstancedMesh rather than 140 meshes: the whole point is to have enough of
 * them that the interior feels occupied.
 */
export function Cytoplasm({ count = 140, bounds = [3, 2.2, 2.2], tint = PALETTE.sky }) {
  const ref = useRef(null);
  const clip = useClip();

  const geometry = useGeometries(() => ({ g: new THREE.SphereGeometry(0.028, 8, 6) }), []);

  const grains = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        origin: [
          (hashRandom(i * 1.7) - 0.5) * 2 * bounds[0],
          (hashRandom(i * 3.1 + 50) - 0.5) * 2 * bounds[1],
          (hashRandom(i * 5.3 + 90) - 0.5) * 2 * bounds[2],
        ],
        speed: 0.1 + hashRandom(i * 7.9) * 0.22,
        phase: hashRandom(i * 11.3) * Math.PI * 2,
        scale: 0.5 + hashRandom(i * 13.7) * 1.1,
      })),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, bounds[0], bounds[1], bounds[2]],
  );

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();
    grains.forEach((grain, i) => {
      const drift = t * grain.speed + grain.phase;
      dummy.position.set(
        grain.origin[0] + Math.sin(drift) * 0.22,
        grain.origin[1] + Math.cos(drift * 0.8) * 0.16,
        grain.origin[2] + Math.sin(drift * 1.2) * 0.2,
      );
      dummy.scale.setScalar(grain.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geometry.g, undefined, count]}>
      <meshBasicMaterial
        key={clip.length}
        color={tint}
        transparent
        opacity={0.24}
        depthWrite={false}
        clippingPlanes={clip}
      />
    </instancedMesh>
  );
}

/** Cytoskeleton — the filament scaffold everything else is suspended in. */
export function Cytoskeleton({ bounds = [3, 2.2, 2.2], strands = 34 }) {
  const points = useMemo(() => {
    const segments = [];
    for (let i = 0; i < strands; i += 1) {
      const a = [
        (hashRandom(i * 2.3 + 500) - 0.5) * 2 * bounds[0],
        (hashRandom(i * 4.1 + 520) - 0.5) * 2 * bounds[1],
        (hashRandom(i * 6.7 + 540) - 0.5) * 2 * bounds[2],
      ];
      const b = [
        (hashRandom(i * 8.9 + 560) - 0.5) * 2 * bounds[0],
        (hashRandom(i * 10.3 + 580) - 0.5) * 2 * bounds[1],
        (hashRandom(i * 12.7 + 600) - 0.5) * 2 * bounds[2],
      ];
      segments.push(a, b);
    }
    return segments;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds[0], bounds[1], bounds[2], strands]);

  return (
    <ClippedLine points={points} segments color="#475569" lineWidth={1} transparent opacity={0.13} />
  );
}

/**
 * Free ribosomes, instanced and jittering.
 *
 * There are hundreds of thousands in a real cell; 90 is enough to read as
 * "everywhere" without another 90 draw calls.
 */
export function FreeRibosomes({ count = 90, bounds = [2.6, 1.7, 1.7], selected, onSelect }) {
  const ref = useRef(null);
  const clip = useClip();

  const geometry = useGeometries(() => ({ g: new THREE.SphereGeometry(0.045, 10, 8) }), []);

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        origin: [
          (hashRandom(i * 1.3 + 700) - 0.5) * 2 * bounds[0],
          (hashRandom(i * 2.9 + 730) - 0.5) * 2 * bounds[1],
          (hashRandom(i * 4.7 + 760) - 0.5) * 2 * bounds[2],
        ],
        phase: hashRandom(i * 6.1 + 790) * Math.PI * 2,
      })),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, bounds[0], bounds[1], bounds[2]],
  );

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();
    seeds.forEach((seed, i) => {
      dummy.position.set(
        seed.origin[0] + Math.sin(t * 0.5 + seed.phase) * 0.05,
        seed.origin[1] + Math.cos(t * 0.42 + seed.phase) * 0.05,
        seed.origin[2] + Math.sin(t * 0.61 + seed.phase) * 0.05,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geometry.g, undefined, count]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.("ribosome");
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <meshPhysicalMaterial
        key={clip.length}
        color={PALETTE.bone}
        emissive={PALETTE.bone}
        emissiveIntensity={selected ? 1.4 : 0.55}
        roughness={0.5}
        clippingPlanes={clip}
      />
    </instancedMesh>
  );
}
