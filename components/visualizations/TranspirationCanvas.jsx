"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  VectorArrow,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import { makeBlobGeometry, makeRoundedBoxGeometry } from "@/components/visualizations/cell-organelles";
import { ProfiledTube, TubeFlow, TubeRings } from "@/components/visualizations/tube-transit";
import { lignifiedRings, profileRadius } from "@/lib/tubeTransit";
import {
  CAVITATION_TENSION_MPA,
  MAX_WIND_MS,
  STRAINED_TENSION_MPA,
  solveTranspiration,
} from "@/lib/transpiration";

// ─── Plant transpiration ────────────────────────────────────────────
// Three magnifications of the same pathway, left to right:
//
//   the plant      root hairs in soil, a cut-away stem with its vascular
//                  bundle (three xylem vessels with lignin rings, two
//                  phloem tubes), and a leaf;
//   leaf section   ×200 — upper epidermis, palisade, spongy mesophyll with
//                  its air spaces, and the lower epidermis with the pore
//                  the vapour leaves through;
//   the stoma      ×800, surface view — two kidney-shaped guard cells that
//                  bow apart as K⁺ (and then water) moves into them.
//
// Nothing here is a clock. `lib/transpiration.js` is steady state, so the
// scene is a picture of the controls: the rate of every stream — soil
// water into the root, the column up the xylem, vapour out of the pore —
// is the same transpiration flux in a different place, and the guard cells
// simply sit at the aperture the light and the soil give them.
// ─────────────────────────────────────────────────────────────────────

/** World units of flow speed per mL/hr of transpiration. */
const FLOW_UNITS_PER_ML = 0.006;

const STEM = { x: -2.6, bottom: -2.5, top: 2.0, radius: 0.55 };
const STEM_LENGTH = STEM.top - STEM.bottom;
const SOIL = { centre: [-2.6, -3.55, 0], size: [4.6, 2.1, 3] };
const SOIL_TOP = SOIL.centre[1] + SOIL.size[1] / 2;
const LEAF = { centre: [-0.55, 2.8, 0], length: 3.0, width: 1.7, rotation: [0.5, 0.2, 0.12] };

/** Xylem vessels in the front half of the stem, where the cut-away shows them. */
const VESSELS = [
  { x: -0.2, z: 0.16, seed: 1 },
  { x: 0.03, z: 0.28, seed: 2 },
  { x: 0.25, z: 0.12, seed: 3 },
];
const VESSEL_RADIUS = 0.115;
const LIGNIN_PITCH = 0.34;
const LIGNIN_RELIEF = 0.22;
const PHLOEM = [
  { x: -0.36, z: -0.02 },
  { x: 0.4, z: -0.06 },
];

/** Root hairs: angle in the XZ plane (radians), depth below the soil top, length. */
const ROOT_HAIRS = [
  { angle: 0.35, depth: 0.55, length: 0.95, seed: 11 },
  { angle: 2.75, depth: 0.7, length: 0.85, seed: 12 },
  { angle: -0.9, depth: 0.95, length: 1.0, seed: 13 },
  { angle: 1.9, depth: 1.2, length: 0.8, seed: 14 },
  { angle: -2.3, depth: 1.05, length: 0.9, seed: 15 },
  { angle: 0.9, depth: 1.45, length: 0.7, seed: 16 },
];

/** Leaf-section inset (×200) and stoma inset (×800), to the right. */
const SECTION = { x: 3.9, y: 2.15, width: 4.2, height: 3.0 };
const STOMA = { x: 3.9, y: -1.95, width: 4.2, height: 3.6, R: 0.78, r: 0.21 };

const COLOURS = {
  soilWet: "#3b2a1e",
  soilDry: "#8c6a48",
  root: "#e9dcc4",
  cortex: "#7a9a5b",
  xylemWall: "#e3d3ab",
  lignin: "#b07a4a",
  phloem: "#8a5a3c",
  water: PALETTE.sky,
  strained: "#fbbf24",
  cavitated: PALETTE.rose,
  sugar: PALETTE.gold,
  leaf: "#3f9a4a",
  epidermis: "#bfe3a8",
  palisade: "#3e8f3a",
  spongy: "#6dbb63",
  guard: "#4fbf60",
  pavement: "#c8e6b0",
  chloroplast: "#1f6f2a",
  potassium: PALETTE.gold,
  vapour: "#dbeafe",
  wind: "#cbd5e1",
  sun: "#fde68a",
};

const columnColour = (tensionMPa) => {
  const c = new THREE.Color(COLOURS.water);
  if (tensionMPa >= CAVITATION_TENSION_MPA) return COLOURS.cavitated;
  if (tensionMPa > STRAINED_TENSION_MPA) {
    const k = clamp((tensionMPa - STRAINED_TENSION_MPA) / (CAVITATION_TENSION_MPA - STRAINED_TENSION_MPA), 0, 1);
    return `#${c.lerp(new THREE.Color(COLOURS.strained), k).getHexString()}`;
  }
  return COLOURS.water;
};

const ZERO_REF = { current: 0 };

// ─── Particle plumes ────────────────────────────────────────────────

/**
 * Vapour: particles born in a box around `origin` at `rateRef.current`
 * per second, carried by `velocity` plus a horizontal drift from
 * `driftRef.current`, shrinking away over `life` seconds. Used for the water
 * evaporating off the mesophyll into the leaf's air spaces, and again for
 * the vapour leaving the pore into the wind.
 */
function Plume({ count = 70, origin = [0, 0, 0], spread = [0.3, 0.05, 0.2], velocity = [0, -0.5, 0], driftRef = null, rateRef, speed = 1, life = 2, colour = COLOURS.vapour, size = 0.05, seed = 1 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      age: new Float32Array(count).fill(-1),
      pos: new Float32Array(count * 3),
      wobble: Array.from({ length: count }, (_, i) => hashRandom(seed * 13.7 + i * 2.9) * Math.PI * 2),
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
    const drift = driftRef ? driftRef.current : 0;
    state.pending += rate * dt;
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      let age = state.age[i];
      if (age < 0 && state.pending >= 1) {
        state.pending -= 1;
        age = 0;
        const h = (k) => hashRandom(seed * 31.1 + i * 7.3 + k * 97.7 + state.pending * 3.3) - 0.5;
        state.pos[i * 3] = origin[0] + h(1) * 2 * spread[0];
        state.pos[i * 3 + 1] = origin[1] + h(2) * 2 * spread[1];
        state.pos[i * 3 + 2] = origin[2] + h(3) * 2 * spread[2];
      }
      if (age >= 0) {
        age += dt;
        if (age > life) age = -1;
      }
      state.age[i] = age;
      if (age < 0) {
        d.scale.setScalar(0);
        d.position.set(0, 0, 0);
      } else {
        const k = age / life;
        const sway = 0.12 * Math.sin(age * 3 + state.wobble[i]);
        state.pos[i * 3] += (velocity[0] + drift) * dt + sway * dt;
        state.pos[i * 3 + 1] += velocity[1] * dt;
        state.pos[i * 3 + 2] += velocity[2] * dt + sway * 0.5 * dt;
        d.position.set(state.pos[i * 3], state.pos[i * 3 + 1], state.pos[i * 3 + 2]);
        d.scale.setScalar(size * (0.6 + 0.9 * Math.sin(Math.PI * Math.min(1, k * 1.15))));
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (state.pending > 4) state.pending = 4;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={colour} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

/** Wind: streaks sweeping left to right across a region at the wind speed. */
function WindStreaks({ count = 14, origin = [0, 0, 0], size = [4, 2.4, 1], windRef, speed = 1, seed = 5 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      x: Float32Array.from({ length: count }, (_, i) => (hashRandom(seed + i * 1.7) - 0.5) * size[0]),
      y: Float32Array.from({ length: count }, (_, i) => (hashRandom(seed * 3 + i * 2.3) - 0.5) * size[1]),
      z: Float32Array.from({ length: count }, (_, i) => (hashRandom(seed * 7 + i * 3.1) - 0.5) * size[2]),
      dummy: new THREE.Object3D(),
    }),
    // `size` is a literal from the caller; the seats only need laying out once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, seed],
  );
  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05) * speed;
    const wind = windRef ? windRef.current : 0;
    const frac = clamp(wind / MAX_WIND_MS, 0, 1);
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      // The number of streaks on show, and their speed and length, all rise with the wind.
      const on = i < Math.round(frac * count) && frac > 0.02;
      state.x[i] += (0.6 + 3.0 * frac) * dt;
      if (state.x[i] > size[0] / 2) state.x[i] = -size[0] / 2;
      d.position.set(origin[0] + state.x[i], origin[1] + state.y[i], origin[2] + state.z[i]);
      d.scale.set(on ? 0.25 + 0.75 * frac : 0, on ? 1 : 0, on ? 1 : 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[0.9, 0.018, 0.018]} />
      <meshBasicMaterial color={COLOURS.wind} transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}

// ─── The plant ──────────────────────────────────────────────────────

function Soil({ drought }) {
  return (
    <group position={SOIL.centre}>
      {/* Cut away: solid soil behind the root, a see-through slab in front of it. */}
      <mesh position={[0, 0, -SOIL.size[2] * 0.3]} receiveShadow>
        <boxGeometry args={[SOIL.size[0], SOIL.size[1], SOIL.size[2] * 0.4]} />
        <meshStandardMaterial color={drought ? COLOURS.soilDry : COLOURS.soilWet} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 0, SOIL.size[2] * 0.2]}>
        <boxGeometry args={[SOIL.size[0], SOIL.size[1], SOIL.size[2] * 0.6]} />
        <meshStandardMaterial color={drought ? COLOURS.soilDry : COLOURS.soilWet} roughness={0.95} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {/* Drought cracks on the surface. */}
      {drought &&
        [0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-1.6 + i * 1.05, SOIL.size[1] / 2 + 0.005, (hashRandom(i + 3) - 0.5) * 2]} rotation={[-Math.PI / 2, 0, (hashRandom(i) - 0.5) * 1.2]}>
            <planeGeometry args={[0.9, 0.05]} />
            <meshBasicMaterial color="#2a1c12" />
          </mesh>
        ))}
      <SceneLabel position={[-1.55, SOIL.size[1] / 2 + 0.28, 1.5]} tone={drought ? "text-amber-300" : "text-ink-300"}>
        {drought ? "dry soil · Ψ ≈ −2.0 MPa" : "moist soil · Ψ ≈ −0.05 MPa"}
      </SceneLabel>
    </group>
  );
}

/** A root hair with soil water converging on it at the transpiration flux. */
function RootHair({ hair, flowRef, colour }) {
  const base = [STEM.x + Math.cos(hair.angle) * 0.2, SOIL_TOP - hair.depth, Math.sin(hair.angle) * 0.2];
  // Local +y points outward along the hair; water runs −y, into the root.
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(Math.cos(hair.angle), -0.25, Math.sin(hair.angle)).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }, [hair.angle]);
  const scatter = (s) => 0.035 + 0.3 * (s / hair.length);
  return (
    <group position={base} quaternion={quaternion}>
      <mesh position={[0, hair.length / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.045, hair.length, 8]} />
        <meshStandardMaterial color={COLOURS.root} roughness={0.8} />
      </mesh>
      <TubeFlow length={hair.length} count={14} speedRef={flowRef} radiusAt={scatter} fill={1} colour={colour} size={0.035} opacity={0.85} seed={hair.seed} />
    </group>
  );
}

function Root({ flowRef, colour }) {
  return (
    <group>
      <mesh position={[STEM.x, SOIL_TOP - 0.85, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.32, 1.8, 14]} />
        <meshStandardMaterial color={COLOURS.root} roughness={0.75} />
      </mesh>
      {ROOT_HAIRS.map((hair, i) => (
        <RootHair key={i} hair={hair} flowRef={flowRef} colour={colour} />
      ))}
      <SceneLabel position={[STEM.x + 1.5, SOIL_TOP - 0.55, 1.0]} tone="text-sky-300">
        root hair · water in by osmosis
      </SceneLabel>
    </group>
  );
}

/** One xylem vessel: lignified wall, annular thickening, the column inside. */
function XylemVessel({ vessel, flowRef, colour, cavitated }) {
  const features = useMemo(() => lignifiedRings(STEM_LENGTH, LIGNIN_PITCH, LIGNIN_RELIEF), []);
  const wallRadius = useMemo(() => (s) => profileRadius(s, VESSEL_RADIUS, features), [features]);
  const lumenRadius = useMemo(() => (s) => profileRadius(s, VESSEL_RADIUS, features) - 0.025, [features]);
  const ringRadius = useMemo(() => () => VESSEL_RADIUS + 0.012, []);
  const ringThickness = useMemo(() => () => 0.028, []);
  // A cavitated vessel has an air gap in it; nothing moves.
  const speedRef = cavitated ? ZERO_REF : flowRef;
  return (
    <group position={[STEM.x + vessel.x, STEM.bottom, vessel.z]}>
      <ProfiledTube length={STEM_LENGTH} rings={96} segments={16} radiusAt={wallRadius}>
        <meshStandardMaterial color={COLOURS.xylemWall} roughness={0.55} transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} />
      </ProfiledTube>
      <TubeRings length={STEM_LENGTH} count={Math.floor(STEM_LENGTH / LIGNIN_PITCH)} radiusAt={ringRadius} thicknessAt={ringThickness} tubular={20} radial={6}>
        <meshStandardMaterial color={COLOURS.lignin} roughness={0.6} metalness={0.05} />
      </TubeRings>
      <TubeFlow length={STEM_LENGTH} count={30} speedRef={speedRef} radiusAt={lumenRadius} fill={0.6} colour={colour} size={0.036} seed={vessel.seed} />
      {cavitated && (
        <group position={[0, STEM_LENGTH * 0.62, 0]}>
          <mesh>
            <sphereGeometry args={[VESSEL_RADIUS - 0.02, 14, 10]} />
            <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={0.4} roughness={0.2} />
          </mesh>
          <Halo radius={VESSEL_RADIUS + 0.08} color={PALETTE.rose} opacity={0.25} />
        </group>
      )}
    </group>
  );
}

function PhloemTube({ tube, speed }) {
  const speedRef = useRef(-0.12 * speed);
  useEffect(() => {
    speedRef.current = -0.12 * speed;
  }, [speed]);
  return (
    <group position={[STEM.x + tube.x, STEM.bottom, tube.z]}>
      <mesh position={[0, STEM_LENGTH / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, STEM_LENGTH, 12, 1, true]} />
        <meshStandardMaterial color={COLOURS.phloem} roughness={0.7} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <TubeFlow length={STEM_LENGTH} count={10} speedRef={speedRef} radius={0.05} fill={0.7} colour={COLOURS.sugar} size={0.03} opacity={0.8} seed={9} />
    </group>
  );
}

function Stem({ flowRef, colour, cavitated, speed }) {
  return (
    <group>
      {/* Cortex: the back half only, so the bundle is on show. */}
      <mesh position={[STEM.x, (STEM.top + STEM.bottom) / 2, 0]} castShadow>
        <cylinderGeometry args={[STEM.radius, STEM.radius * 1.08, STEM_LENGTH, 32, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={COLOURS.cortex} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {VESSELS.map((v, i) => (
        <XylemVessel key={i} vessel={v} flowRef={flowRef} colour={colour} cavitated={cavitated && i === 1} />
      ))}
      {PHLOEM.map((p, i) => (
        <PhloemTube key={i} tube={p} speed={speed} />
      ))}
      <SceneLabel position={[STEM.x - 1.15, STEM.bottom + 1.4, 0.4]} tone="text-sky-300">
        xylem · lignified vessels
      </SceneLabel>
      <SceneLabel position={[STEM.x - 1.05, STEM.bottom + 3.2, 0.4]} tone="text-amber-300">
        phloem · sugars down
      </SceneLabel>
      <SceneLabel position={[STEM.x + 1.15, STEM.bottom + 2.4, 0.3]} tone="text-ink-300">
        stem · cut-away
      </SceneLabel>
      {cavitated && (
        <SceneLabel position={[STEM.x + 1.45, STEM.bottom + STEM_LENGTH * 0.62 + 0.05, 0.5]} tone="text-rose-300">
          embolism · column broken
        </SceneLabel>
      )}
    </group>
  );
}

function Leaf({ flowRef, colour }) {
  const blade = useMemo(() => makeBlobGeometry({ radius: 1, amp: 0.05, freq: 1.4, seed: 4, scale: [LEAF.length / 2, 0.06, LEAF.width / 2], segments: 40, rings: 24 }), []);
  useEffect(() => () => blade.dispose(), [blade]);
  // Petiole: from the top of the stem out to the leaf centre.
  const petiole = useMemo(() => {
    const from = new THREE.Vector3(STEM.x, STEM.top, 0);
    const to = new THREE.Vector3(...LEAF.centre);
    const dir = to.clone().sub(from);
    return {
      length: dir.length(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      from: from.toArray(),
    };
  }, []);
  return (
    <group>
      <group position={petiole.from} quaternion={petiole.quaternion}>
        <mesh position={[0, petiole.length / 2, 0]}>
          <cylinderGeometry args={[0.07, 0.1, petiole.length, 10]} />
          <meshStandardMaterial color={COLOURS.cortex} roughness={0.8} />
        </mesh>
        <TubeFlow length={petiole.length} count={10} speedRef={flowRef} radius={0.035} fill={0.8} colour={colour} size={0.03} seed={21} />
      </group>
      <group position={LEAF.centre} rotation={LEAF.rotation}>
        <mesh geometry={blade} castShadow>
          <meshStandardMaterial color={COLOURS.leaf} roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
        {/* Midrib and veins carry the column into the blade, lying in its plane. */}
        <mesh position={[0, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.035, LEAF.length * 0.9, 8]} />
          <meshStandardMaterial color="#d8f0c0" roughness={0.6} />
        </mesh>
        {[-0.9, -0.45, 0.0, 0.45, 0.9].map((x, i) => (
          <group key={i} position={[x, 0.03, 0]}>
            <mesh position={[0.18, 0, 0.3]} rotation={[Math.PI / 2, -0.55, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.7, 6]} />
              <meshStandardMaterial color="#c9e8b0" roughness={0.6} />
            </mesh>
            <mesh position={[0.18, 0, -0.3]} rotation={[Math.PI / 2, 0.55, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.7, 6]} />
              <meshStandardMaterial color="#c9e8b0" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
      <SceneLabel position={[LEAF.centre[0] + 0.2, LEAF.centre[1] + 0.75, 0.3]} tone="text-emerald-300">
        leaf · evaporation from the mesophyll
      </SceneLabel>
    </group>
  );
}

function Sun({ light }) {
  const k = clamp(light / 100, 0, 1);
  return (
    <group position={[-5.3, 5.0, -1.2]}>
      <mesh>
        <sphereGeometry args={[0.45, 24, 18]} />
        <meshStandardMaterial color={COLOURS.sun} emissive={COLOURS.sun} emissiveIntensity={0.3 + 2.2 * k} toneMapped={false} />
      </mesh>
      <Halo radius={0.8 + 0.6 * k} color={COLOURS.sun} opacity={0.04 + 0.12 * k} />
      <pointLight intensity={0.6 + 6 * k} distance={16} decay={2} color="#fff3c4" />
      <SceneLabel position={[0, -0.95, 0]} tone={k > 0.15 ? "text-amber-200" : "text-ink-500"}>
        {k < 0.05 ? "night · no light" : `light ${Math.round(light)} %`}
      </SceneLabel>
    </group>
  );
}

// ─── Leaf section, ×200 ─────────────────────────────────────────────

function InsetFrame({ x, y, width, height, title, tone = "text-ink-300" }) {
  const hw = width / 2;
  const hh = height / 2;
  return (
    <group position={[x, y, 0]}>
      <Line points={[[-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0], [-hw, -hh, 0]]} color={PALETTE.line} lineWidth={1} transparent opacity={0.8} />
      <mesh position={[0, 0, -0.35]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#1c2436" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <SceneLabel position={[0, hh + 0.28, 0]} tone={tone}>
        {title}
      </SceneLabel>
    </group>
  );
}

function LeafSection({ solved, evapRateRef, windRef, speed }) {
  const spongy = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        geometry: makeBlobGeometry({ radius: 0.22 + 0.08 * hashRandom(i * 3.1), amp: 0.16, freq: 2.2, seed: i + 30, segments: 20, rings: 14 }),
        position: [-1.7 + (i % 6) * 0.68 + (hashRandom(i * 1.3) - 0.5) * 0.18, -0.15 - Math.floor(i / 6) * 0.5 + (hashRandom(i * 2.9) - 0.5) * 0.16, (hashRandom(i * 4.7) - 0.5) * 0.35],
      })),
    [],
  );
  useEffect(() => () => spongy.forEach((c) => c.geometry.dispose()), [spongy]);
  const aperture = solved.aperture;
  const gap = 0.12 + 0.5 * aperture;
  const x = SECTION.x;
  const y = SECTION.y;
  return (
    <group>
      <InsetFrame x={x} y={y} width={SECTION.width} height={SECTION.height} title="leaf section · ×200" tone="text-emerald-300" />
      <group position={[x, y, 0]}>
        {/* Upper epidermis with its waxy cuticle. */}
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[3.7, 0.16, 0.7]} />
          <meshStandardMaterial color={COLOURS.epidermis} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.245, 0]}>
          <boxGeometry args={[3.7, 0.02, 0.7]} />
          <meshStandardMaterial color="#f5fbe8" roughness={0.2} />
        </mesh>
        {/* Palisade: tall cells packed under the upper surface. */}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[-1.62 + i * 0.465, 0.62, 0]}>
            <capsuleGeometry args={[0.19, 0.5, 4, 10]} />
            <meshStandardMaterial color={COLOURS.palisade} roughness={0.6} />
          </mesh>
        ))}
        {/* Spongy mesophyll: loose cells with air spaces between them. */}
        {spongy.map((cell, i) => (
          <mesh key={i} geometry={cell.geometry} position={cell.position}>
            <meshStandardMaterial color={COLOURS.spongy} roughness={0.6} />
          </mesh>
        ))}
        {/* Water evaporating off the cell walls into the air spaces, drifting down to the pore. */}
        <Plume count={50} origin={[0, -0.35, 0]} spread={[1.5, 0.45, 0.2]} velocity={[0, -0.35, 0]} rateRef={evapRateRef} speed={speed} life={2.4} size={0.035} seed={41} />
        {/* Lower epidermis, split around the pore. */}
        <mesh position={[-(0.925 + gap / 4), -1.0, 0]}>
          <boxGeometry args={[1.85 - gap / 2, 0.16, 0.7]} />
          <meshStandardMaterial color={COLOURS.epidermis} roughness={0.5} />
        </mesh>
        <mesh position={[0.925 + gap / 4, -1.0, 0]}>
          <boxGeometry args={[1.85 - gap / 2, 0.16, 0.7]} />
          <meshStandardMaterial color={COLOURS.epidermis} roughness={0.5} />
        </mesh>
        {/* Guard cells in section: two round cells either side of the pore. */}
        <mesh position={[-(gap / 2 + 0.14), -1.0, 0]}>
          <sphereGeometry args={[0.15, 14, 10]} />
          <meshStandardMaterial color={COLOURS.guard} roughness={0.5} />
        </mesh>
        <mesh position={[gap / 2 + 0.14, -1.0, 0]}>
          <sphereGeometry args={[0.15, 14, 10]} />
          <meshStandardMaterial color={COLOURS.guard} roughness={0.5} />
        </mesh>
        {/* Vapour leaving through the pore, into whatever air is outside. */}
        <Plume count={60} origin={[0, -1.12, 0]} spread={[gap * 0.35, 0.02, 0.1]} velocity={[0, -0.45, 0]} driftRef={windRef} rateRef={evapRateRef} speed={speed} life={2.0} size={0.045} seed={42} />
        {/* Boundary layer: the skin of humid air under the leaf, thinned by wind. */}
        <mesh position={[0, -1.22 - 0.16 * (1 - clamp(solved.wind / MAX_WIND_MS, 0, 1)), 0.02]}>
          <boxGeometry args={[3.7, 0.28 * (1 - 0.8 * clamp(solved.wind / MAX_WIND_MS, 0, 1)) + 0.03, 0.75]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.06 + 0.22 * clamp(solved.humidity / 100, 0, 1)} depthWrite={false} />
        </mesh>
        <WindStreaks count={14} origin={[0, -1.32, 0.1]} size={[4.0, 0.36, 0.5]} windRef={windRef} speed={speed} />
        <SceneLabel position={[-1.2, 1.5, 0.4]} tone="text-ink-300">
          upper epidermis · cuticle
        </SceneLabel>
        <SceneLabel position={[1.35, 0.62, 0.45]} tone="text-emerald-300">
          palisade
        </SceneLabel>
        <SceneLabel position={[-1.35, -0.6, 0.5]} tone="text-emerald-300">
          spongy mesophyll · air spaces
        </SceneLabel>
        <SceneLabel position={[0, -0.78, 0.5]} tone={solved.poreOpen ? "text-sky-300" : "text-rose-300"}>
          {solved.poreOpen ? "stoma open · vapour out" : "stoma closed"}
        </SceneLabel>
        <SceneLabel position={[1.3, -1.42, 0.5]} tone={solved.wind > 1 ? "text-ink-200" : "text-ink-500"}>
          {solved.wind > 0.5 ? `wind ${solved.wind.toFixed(1)} m/s strips the boundary layer` : `still air · boundary layer · RH ${Math.round(solved.humidity)} %`}
        </SceneLabel>
      </group>
    </group>
  );
}

// ─── The stoma, ×800, surface view ──────────────────────────────────

/** K⁺ ions inside a guard cell, spread along its midline, as many as it is holding. */
function IonFill({ side, bow, held, count = 14, seed }) {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seats = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        y: (hashRandom(seed + i * 1.9) - 0.5) * 2 * STOMA.R * 0.82,
        rho: (hashRandom(seed * 2 + i * 3.7) - 0.5) * 0.16,
        phase: hashRandom(seed * 5 + i * 0.7) * Math.PI * 2,
      })),
    [count, seed],
  );
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const shown = Math.round(held * count);
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      const seat = seats[i];
      const y = seat.y;
      const px = guardMidline(side, bow, y) + seat.rho + 0.015 * Math.sin(t * 2 + seat.phase);
      dummy.position.set(px, y, 0.14);
      dummy.scale.setScalar(i < shown ? 1 : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.045, 8, 6]} />
      <meshStandardMaterial color={COLOURS.potassium} emissive={COLOURS.potassium} emissiveIntensity={1.6} toneMapped={false} />
    </instancedMesh>
  );
}

/** x of a guard cell's midline at height y: a semicircle of radius R, flattened by `bow`, bulging away from the pore. */
const guardMidline = (side, bow, y) => side * bow * Math.sqrt(Math.max(0, STOMA.R * STOMA.R - y * y));

/**
 * One guard cell: a kidney bean — a tube whose axis is a flattened
 * semicircle and whose radius is fat in the middle and pinched at the tips,
 * where it meets its partner at (0, ±R). Flaccid, the two beans lie straight
 * against each other and the pore between them is shut; turgid, the thin
 * inner wall is dragged out by the thick outer one and they bow apart.
 * Built on the shared tube kit: the bow is the axis, not a scale.
 */
function GuardCell({ side, bow, turgor, held, seed }) {
  const L = 2 * STOMA.R;
  const swell = 0.9 + 0.2 * clamp(turgor, 0, 1);
  const radiusAt = useMemo(() => (s) => STOMA.r * swell * (0.06 + 0.94 * Math.pow(Math.sin(Math.PI * clamp(s / L, 0, 1)), 0.55)), [L, swell]);
  const centreAt = useMemo(
    () => (s, out) => {
      out[0] = guardMidline(side, bow, s - STOMA.R);
      out[1] = 0;
    },
    [side, bow],
  );
  return (
    <group>
      <group position={[0, -STOMA.R, 0]}>
        <ProfiledTube length={L} rings={44} segments={18} radiusAt={radiusAt} centreAt={centreAt} castShadow>
          <meshStandardMaterial color={COLOURS.guard} roughness={0.45} />
        </ProfiledTube>
      </group>
      {/* Chloroplasts — guard cells are the only epidermal cells that have them. */}
      {[-0.55, -0.2, 0.15, 0.5].map((f, i) => {
        const y = f * STOMA.R;
        return (
          <mesh key={i} position={[guardMidline(side, bow, y) + side * 0.03, y, STOMA.r * 0.7]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshStandardMaterial color={COLOURS.chloroplast} roughness={0.5} />
          </mesh>
        );
      })}
      <IonFill side={side} bow={bow} held={held} seed={seed} />
    </group>
  );
}

function Stoma({ solved }) {
  const bowClosed = STOMA.r / STOMA.R;
  const bow = bowClosed + (1 - bowClosed) * solved.aperture;
  const turgor = clamp((solved.turgorMPa - 0.6) / 3.9, 0, 1);
  const pavement = useMemo(
    () =>
      [
        { p: [-1.55, 1.05, -0.1], s: [1.0, 0.9] },
        { p: [1.55, 1.05, -0.1], s: [1.0, 0.9] },
        { p: [-1.6, -1.05, -0.1], s: [0.9, 0.95] },
        { p: [1.6, -1.05, -0.1], s: [0.9, 0.95] },
        { p: [0, 1.45, -0.1], s: [1.4, 0.5] },
        { p: [0, -1.45, -0.1], s: [1.4, 0.5] },
        { p: [-1.5, 0.0, -0.1], s: [0.75, 1.0] },
        { p: [1.5, 0.0, -0.1], s: [0.75, 1.0] },
      ].map((c, i) => ({ ...c, geometry: makeRoundedBoxGeometry({ size: [c.s[0], c.s[1], 0.22], exponent: 5, amp: 0.02, seed: i + 60, segments: 28, rings: 18 }) })),
    [],
  );
  useEffect(() => () => pavement.forEach((c) => c.geometry.dispose()), [pavement]);

  // What the cells are actually holding: light's K⁺ less whatever ABA has dumped.
  const held = solved.aperture;
  const efflux = solved.droughtClosed && solved.kFraction > 0.04;
  const x = STOMA.x;
  const y = STOMA.y;
  const arrowLen = 0.25 + 0.5 * (efflux ? solved.kFraction : held);
  const outer = STOMA.R * bow + STOMA.r;
  // Arrows point in while K⁺ is being pumped in, out while ABA is dumping it.
  const arrow = (sign, yOff, colour, label) => {
    const near = sign * (outer + 0.35);
    const far = sign * (outer + 0.35 + arrowLen);
    return efflux ? (
      <VectorArrow from={[near, yOff, 0.2]} to={[far, yOff, 0.2]} color={colour} radius={0.028} headLength={0.16} headRadius={0.07} label={label} labelOffset={0.3} />
    ) : (
      <VectorArrow from={[far, yOff, 0.2]} to={[near, yOff, 0.2]} color={colour} radius={0.028} headLength={0.16} headRadius={0.07} label={label} labelOffset={-arrowLen - 0.35} />
    );
  };
  return (
    <group>
      <InsetFrame x={x} y={y} width={STOMA.width} height={STOMA.height} title="stoma · lower epidermis · ×800" tone="text-sky-300" />
      <group position={[x, y, 0]}>
        {pavement.map((c, i) => (
          <mesh key={i} geometry={c.geometry} position={c.p}>
            <meshStandardMaterial color={COLOURS.pavement} roughness={0.6} />
          </mesh>
        ))}
        {/* The pore: dark where the two cells have bowed apart. */}
        <mesh position={[0, 0, -0.05]} scale={[Math.max(0.02, STOMA.R * bow - STOMA.r) * 2, STOMA.R * 1.9, 1]}>
          <circleGeometry args={[0.5, 24]} />
          <meshBasicMaterial color="#0b1020" />
        </mesh>
        <GuardCell side={-1} bow={bow} turgor={turgor} held={held} seed={71} />
        <GuardCell side={1} bow={bow} turgor={turgor} held={held} seed={72} />
        {/* K⁺ pumped in from the neighbouring cells, water following by osmosis — or both leaving under ABA. */}
        {(held > 0.04 || efflux) && (
          <>
            {arrow(-1, 0.28, COLOURS.potassium, "K⁺")}
            {arrow(1, 0.28, COLOURS.potassium, "K⁺")}
            {arrow(-1, -0.3, COLOURS.water, "H₂O")}
            {arrow(1, -0.3, COLOURS.water, "H₂O")}
          </>
        )}
        <SceneLabel position={[0, -STOMA.R - 0.5, 0.3]} accent={solved.poreOpen} tone={solved.poreOpen ? "text-sky-300" : "text-rose-300"}>
          {solved.poreOpen ? `open pore · ${solved.poreWidthUm.toFixed(1)} µm` : `closed pore · ${solved.poreWidthUm.toFixed(1)} µm`}
        </SceneLabel>
        <SceneLabel position={[-1.55, STOMA.R + 0.35, 0.3]} tone="text-emerald-300">
          guard cell · {turgor > 0.5 ? "turgid" : "flaccid"}
        </SceneLabel>
        <SceneLabel position={[1.5, STOMA.R + 0.35, 0.3]} tone="text-ink-400">
          pavement cells
        </SceneLabel>
        {solved.droughtClosed && (
          <SceneLabel position={[0, STOMA.R + 0.85, 0.3]} tone="text-amber-300">
            ABA from the roots · K⁺ dumped, pore shut
          </SceneLabel>
        )}
      </group>
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function TranspirationCanvas({ params = {} }) {
  const { light = 70, humidity = 50, wind = 2, soil = "hydrated", speed = 1 } = params || {};
  const solved = useMemo(() => solveTranspiration({ light, humidity, wind, soil }), [light, humidity, wind, soil]);

  // Every stream in the scene runs at the one flux.
  const flowRef = useRef(0);
  const evapRateRef = useRef(0);
  const windRef = useRef(0);
  useEffect(() => {
    flowRef.current = solved.rateMlPerHour * FLOW_UNITS_PER_ML * speed;
    evapRateRef.current = 1.5 + solved.rateMlPerHour * 0.11;
    windRef.current = solved.wind * 0.22;
  }, [solved, speed]);

  const colour = columnColour(solved.tensionMPa);
  const cavitated = solved.columnState === "cavitation";
  const drought = solved.soil === "drought";

  return (
    <SceneCanvas
      camera={{ position: [1.2, 0.9, 14.5], fov: 46 }}
      controls={{ minDistance: 5, maxDistance: 30, target: [0.7, 0.2, 0] }}
      lights={{ ambient: 0.5 + 0.25 * clamp(light / 100, 0, 1), keyLight: 0.5 + 0.9 * clamp(light / 100, 0, 1), rim: PALETTE.emerald }}
    >
      <Sun light={light} />
      <Soil drought={drought} />
      <Root flowRef={flowRef} colour={colour} />
      <Stem flowRef={flowRef} colour={colour} cavitated={cavitated} speed={speed} />
      <Leaf flowRef={flowRef} colour={colour} />

      {/* Where each magnification comes from. */}
      <Line points={[[LEAF.centre[0] + 0.9, LEAF.centre[1] - 0.05, 0], [SECTION.x - SECTION.width / 2, SECTION.y + 0.6, 0]]} color={PALETTE.line} lineWidth={1} dashed dashSize={0.14} gapSize={0.1} />
      <Line points={[[SECTION.x, SECTION.y - SECTION.height / 2, 0], [STOMA.x, STOMA.y + STOMA.height / 2, 0]]} color={PALETTE.line} lineWidth={1} dashed dashSize={0.14} gapSize={0.1} />

      <LeafSection solved={solved} evapRateRef={evapRateRef} windRef={windRef} speed={speed} />
      <Stoma solved={solved} />

      {/* Tension gauge on the column. */}
      <SceneLabel position={[STEM.x + 1.0, STEM.top + 0.2, 0.4]} tone={cavitated ? "text-rose-300" : solved.columnState === "strained" ? "text-amber-300" : "text-sky-300"}>
        {`column tension ${solved.tensionMPa.toFixed(2)} MPa · ${solved.columnState}`}
      </SceneLabel>
      <SceneLabel position={[STEM.x + 1.5, SOIL_TOP + 0.5, 0.4]} tone="text-ink-300">
        {`${solved.rateMlPerHour < 10 ? solved.rateMlPerHour.toFixed(1) : Math.round(solved.rateMlPerHour)} mL/hr up the stem`}
      </SceneLabel>

      <SceneReadout
        title="Transpiration"
        subtitle={`${solved.soilLabel} · light ${light} % · RH ${humidity} % · wind ${wind} m/s`}
        rows={[
          ["Transpiration rate", `${solved.rateMlPerHour.toFixed(1)} mL/hr`],
          ["Guard cells", solved.poreStatus],
          ["Xylem tension", `${solved.tensionMPa.toFixed(2)} MPa`],
        ]}
      />
      <SceneLegend
        title="Pathway"
        items={[
          { color: COLOURS.water, label: "Water", note: "soil → root hair → xylem → leaf" },
          { color: COLOURS.vapour, label: "Vapour", note: "out of the stoma" },
          { color: COLOURS.potassium, label: "K⁺", note: "into the guard cells with light" },
        ]}
      />
    </SceneCanvas>
  );
}
