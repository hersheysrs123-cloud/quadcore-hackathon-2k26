"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";
import { makeBlobGeometry } from "@/components/visualizations/cell-organelles";
import { TimelineCaption, TimelineDriver } from "@/components/visualizations/timeline-kit";
import { pulse, smoothstep } from "@/lib/timeline";
import {
  MICROPYLE_OVERSHOOT,
  POLLINATION_TIMELINE,
  STYLE_LENGTH_MM,
  describePollination,
  vectorFor,
} from "@/lib/pollination";

// ─── Flower dissection: pollination and fertilisation ───────────────
// A flower cut down the middle, the front half taken away: three petals
// and the sepals at the back, four stamens, and the carpel in the centre
// — stigma, style, and an ovary opened to show two ovules, one of them
// with its micropyle turned towards the style.
//
// Press the button and the vector delivers a grain: a bee visits the
// anther then the stigma, or the wind blows a cloud past a feathery
// stigma and one grain catches. That moment is POLLINATION, and the label
// says so. Everything after it — the tube growing down the style (a
// TubeGeometry whose draw range is the model's fraction), the three
// nuclei travelling behind the tip, the generative nucleus dividing, the
// tip entering the micropyle and the two fusions in the embryo sac — is
// FERTILISATION, and takes hours. The time slider is the same clock:
// playing, the scene drives it; dragged, it drives the scene.
// ─────────────────────────────────────────────────────────────────────

const RECEPTACLE_Y = 0.15;
const OVARY = { centre: [0, 1.05, 0], radius: 0.86, scaleY: 1.18 };
const STYLE = { bottom: 1.95, top: 4.6, radius: 0.17 };
const STIGMA_Y = 4.75;
const OVULE_A = { centre: [0.38, 1.05, -0.08], rx: 0.3, ry: 0.42 };
const OVULE_B = { centre: [-0.44, 0.95, -0.14], rx: 0.27, ry: 0.38 };
const GAUGE = { x: 2.35 };
const TUBE_SEGMENTS = 160;
const TUBE_RADIAL = 8;

const COLOURS = {
  stem: "#3f8a3a",
  sepal: "#4d9a45",
  petalInsect: "#f472b6",
  petalInsectDeep: "#db2777",
  petalWind: "#8fae74",
  filament: "#e9f0d8",
  anther: "#f5c518",
  pollenInsect: "#fbbf24",
  pollenWind: "#fde68a",
  stigma: "#a3e635",
  stigmaSticky: "#bef264",
  style: "#c7e8a8",
  ovaryWall: "#86c96b",
  ovaryInner: "#5f9e4c",
  ovule: "#f1f5e0",
  sac: "#d9f0c4",
  egg: "#fb7185",
  synergid: "#fda4af",
  polar: PALETTE.violet,
  antipodal: "#94a3b8",
  tube: "#fcd34d",
  tubeNucleus: PALETTE.sky,
  generative: PALETTE.violet,
  sperm: PALETTE.rose,
  zygote: PALETTE.gold,
  endosperm: "#c084fc",
  nectar: "#fde047",
  bee: "#facc15",
  beeStripe: "#1f2937",
  wing: "#e0f2fe",
  wind: "#cbd5e1",
};

// ─── The tube's path ────────────────────────────────────────────────

/** Stigma → down the style → across the locule → micropyle → egg apparatus. */
function useTubePath() {
  return useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, STIGMA_Y - 0.05, 0.06),
        new THREE.Vector3(0, 3.6, 0.06),
        new THREE.Vector3(0, 2.6, 0.06),
        new THREE.Vector3(0, STYLE.bottom + 0.05, 0.06),
        new THREE.Vector3(0.17, 1.72, 0.03),
        new THREE.Vector3(OVULE_A.centre[0] - 0.02, OVULE_A.centre[1] + OVULE_A.ry + 0.02, OVULE_A.centre[2] + 0.06),
        new THREE.Vector3(OVULE_A.centre[0] + 0.03, OVULE_A.centre[1] + 0.2, OVULE_A.centre[2] + 0.06),
      ],
      false,
      "catmullrom",
      0.35,
    );
    // Where along the curve the style ends: the model's fraction 1.0.
    let styleShare = 0.8;
    for (let i = 0; i <= 200; i += 1) {
      const u = i / 200;
      if (curve.getPointAt(u).y <= STYLE.bottom + 0.05) {
        styleShare = u;
        break;
      }
    }
    const geometry = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, 0.055, TUBE_RADIAL, false);
    return { curve, styleShare, geometry };
  }, []);
}

function useDisposedTubePath() {
  const path = useTubePath();
  useEffect(() => () => path.geometry.dispose(), [path]);
  return path;
}

/** Model fraction (0–1 down the style, up to 1.09 inside the ovule) → curve parameter. */
const fractionToU = (f, styleShare) => (f <= 1 ? f * styleShare : styleShare + ((f - 1) / MICROPYLE_OVERSHOOT) * (1 - styleShare));

// ─── Vectors ────────────────────────────────────────────────────────

/** Pollen grains: smooth spheres for wind, spiky icosahedra for insects. */
function usePollenGeometry(spiky) {
  const geometry = useMemo(() => {
    if (!spiky) return new THREE.SphereGeometry(1, 10, 8);
    const g = new THREE.IcosahedronGeometry(1, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const spike = i % 3 === 0 ? 1.45 : 0.85;
      v.multiplyScalar(spike);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, [spiky]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Grains dusted over an anther's surface. */
function AntherPollen({ geometry, colour, count = 14, seed = 1, sizeScale = 1 }) {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < count; i += 1) {
      const a = hashRandom(seed + i * 1.7) * Math.PI * 2;
      const y = (hashRandom(seed * 3 + i * 2.3) - 0.5) * 0.5;
      const side = i % 2 === 0 ? -0.11 : 0.11;
      dummy.position.set(side + Math.cos(a) * 0.11, y, Math.sin(a) * 0.11);
      dummy.scale.setScalar(0.035 * sizeScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, seed, dummy, sizeScale, geometry]);
  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color={colour} roughness={0.6} emissive={colour} emissiveIntensity={0.25} />
    </instancedMesh>
  );
}

/**
 * The bee. `s` runs 0 → 1 along its visit: in from the right, a pause at
 * the anther (where it picks up pollen), on to the stigma (where it
 * leaves some), and away to the left. Wings flap; pollen appears on its
 * underside after the anther.
 */
function Bee({ s, visible, pollenGeometry }) {
  const group = useRef(null);
  const wingL = useRef(null);
  const wingR = useRef(null);
  const path = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(7.5, 6.2, 1.6),
          new THREE.Vector3(4.2, 5.2, 0.9),
          new THREE.Vector3(1.55, 4.35, 0.25),
          new THREE.Vector3(1.4, 4.25, 0.2),
          new THREE.Vector3(0.9, 5.1, 0.45),
          new THREE.Vector3(0.05, 5.45, 0.55),
          new THREE.Vector3(0.05, 5.4, 0.55),
          new THREE.Vector3(-2.2, 6.0, 1.2),
          new THREE.Vector3(-7.5, 7.0, 1.8),
        ],
        false,
        "catmullrom",
        0.4,
      ),
    [],
  );
  const hasPollen = s > 0.32;
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const u = clamp(s, 0, 1);
    const p = path.getPointAt(u);
    const ahead = path.getPointAt(Math.min(1, u + 0.01));
    g.position.copy(p);
    g.lookAt(ahead);
    g.rotateY(-Math.PI / 2);
    g.visible = visible;
    const flap = Math.sin(clock.elapsedTime * 40) * 0.6;
    if (wingL.current) wingL.current.rotation.x = -0.4 + flap;
    if (wingR.current) wingR.current.rotation.x = 0.4 - flap;
  });
  return (
    <group ref={group}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.16, 0.34, 4, 12]} />
        <meshStandardMaterial color={COLOURS.bee} roughness={0.7} />
      </mesh>
      {[-0.1, 0.04, 0.18].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.165, 0.035, 8, 20]} />
          <meshStandardMaterial color={COLOURS.beeStripe} roughness={0.8} />
        </mesh>
      ))}
      {/* Head at +x — the group is turned so +x faces along the path. */}
      <mesh position={[0.36, 0.02, 0]}>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color={COLOURS.beeStripe} roughness={0.7} />
      </mesh>
      <group ref={wingL} position={[0.02, 0.14, 0.05]}>
        <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.24, 16]} />
          <meshStandardMaterial color={COLOURS.wing} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <group ref={wingR} position={[0.02, 0.14, -0.05]}>
        <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.24, 16]} />
          <meshStandardMaterial color={COLOURS.wing} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      {/* Pollen picked up at the anther, stuck to the hairy underside. */}
      {hasPollen && (
        <group position={[0, -0.15, 0]}>
          {[-0.14, -0.04, 0.06, 0.16].map((x, i) => (
            <mesh key={i} position={[x, (i % 2) * 0.03, (i % 2 ? 0.06 : -0.06)]} geometry={pollenGeometry} scale={0.04}>
              <meshStandardMaterial color={COLOURS.pollenInsect} emissive={COLOURS.pollenInsect} emissiveIntensity={0.3} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/** A cloud of light grains blown left to right across the flower's top. */
function WindPollen({ densityRef, geometry, count = 90, seed = 9 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      x: Float32Array.from({ length: count }, (_, i) => -8 + hashRandom(seed + i * 1.3) * 16),
      y: Float32Array.from({ length: count }, (_, i) => 3.4 + hashRandom(seed * 3 + i * 2.1) * 3.2),
      z: Float32Array.from({ length: count }, (_, i) => -1.5 + hashRandom(seed * 7 + i * 0.7) * 3),
      phase: Float32Array.from({ length: count }, (_, i) => hashRandom(seed * 11 + i * 1.9) * Math.PI * 2),
      dummy: new THREE.Object3D(),
    }),
    [count, seed],
  );
  useFrame(({ clock }, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05);
    const density = densityRef.current;
    const t = clock.elapsedTime;
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      state.x[i] += (2.2 + 1.5 * Math.sin(state.phase[i])) * dt;
      if (state.x[i] > 8) state.x[i] = -8;
      const on = i < Math.round(density * count);
      d.position.set(state.x[i], state.y[i] + 0.15 * Math.sin(t * 2 + state.phase[i]), state.z[i]);
      d.scale.setScalar(on ? 0.035 : 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color={COLOURS.pollenWind} emissive={COLOURS.pollenWind} emissiveIntensity={0.4} transparent opacity={0.9} />
    </instancedMesh>
  );
}

/** Wind streaks so the air itself is visible. */
function WindStreaks({ densityRef, count = 18, seed = 4 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      x: Float32Array.from({ length: count }, (_, i) => -8 + hashRandom(seed + i * 1.7) * 16),
      y: Float32Array.from({ length: count }, (_, i) => 3.0 + hashRandom(seed * 3 + i * 2.3) * 3.8),
      z: Float32Array.from({ length: count }, (_, i) => -1.8 + hashRandom(seed * 7 + i * 3.1) * 3.4),
      dummy: new THREE.Object3D(),
    }),
    [count, seed],
  );
  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05);
    const density = densityRef.current;
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      state.x[i] += 4.5 * dt;
      if (state.x[i] > 8) state.x[i] = -8;
      const on = i < Math.round(density * count);
      d.position.set(state.x[i], state.y[i], state.z[i]);
      d.scale.set(on ? 1 : 0, on ? 1 : 0, on ? 1 : 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1.1, 0.016, 0.016]} />
      <meshBasicMaterial color={COLOURS.wind} transparent opacity={0.5} depthWrite={false} />
    </instancedMesh>
  );
}

// ─── The flower ─────────────────────────────────────────────────────

function Stem() {
  return (
    <group>
      <mesh position={[0, RECEPTACLE_Y - 1.4, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 2.8, 12]} />
        <meshStandardMaterial color={COLOURS.stem} roughness={0.8} />
      </mesh>
      <mesh position={[0, RECEPTACLE_Y, 0]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.62, 20, 14]} />
        <meshStandardMaterial color={COLOURS.stem} roughness={0.8} />
      </mesh>
      <SceneLabel position={[-0.95, RECEPTACLE_Y - 0.25, 0.4]} tone="text-ink-400">
        receptacle
      </SceneLabel>
    </group>
  );
}

/** Petals and sepals at the back of the cut; the front ones are dissected away. */
function Perianth({ vector }) {
  const insect = vector.key === "insect";
  const petal = useMemo(() => makeBlobGeometry({ radius: 1, amp: 0.05, freq: 1.6, seed: 21, scale: [1.55, 0.06, 0.95], segments: 36, rings: 20 }), []);
  const sepal = useMemo(() => makeBlobGeometry({ radius: 1, amp: 0.05, freq: 1.8, seed: 22, scale: [0.95, 0.05, 0.36], segments: 28, rings: 14 }), []);
  useEffect(() => () => {
    petal.dispose();
    sepal.dispose();
  }, [petal, sepal]);
  const petalScale = insect ? 1 : 0.42;
  const petalColour = insect ? COLOURS.petalInsect : COLOURS.petalWind;
  return (
    <group>
      {[0.35, Math.PI / 2, Math.PI - 0.35].map((a, i) => (
        <group key={i} rotation={[0, a, 0]}>
          <mesh position={[0.55 + 1.15 * petalScale, RECEPTACLE_Y + 0.55 + 0.9 * petalScale, 0]} rotation={[0, 0, insect ? 0.62 : 0.85]} scale={petalScale} geometry={petal} castShadow>
            <meshStandardMaterial color={petalColour} roughness={0.55} side={THREE.DoubleSide} emissive={insect ? COLOURS.petalInsectDeep : "#000000"} emissiveIntensity={insect ? 0.12 : 0} />
          </mesh>
          {/* Nectary at the petal base — the reward that pays the courier. */}
          {insect && (
            <group position={[0.62, RECEPTACLE_Y + 0.42, 0]}>
              <mesh>
                <sphereGeometry args={[0.09, 12, 10]} />
                <meshStandardMaterial color={COLOURS.nectar} emissive={COLOURS.nectar} emissiveIntensity={0.9} roughness={0.1} />
              </mesh>
              <Halo radius={0.18} color={COLOURS.nectar} opacity={0.14} />
            </group>
          )}
        </group>
      ))}
      {[0.12, Math.PI / 2 - 0.55, Math.PI / 2 + 0.55, Math.PI - 0.12].map((a, i) => (
        <group key={i} rotation={[0, a, 0]}>
          <mesh position={[1.05, RECEPTACLE_Y + 0.28, 0]} rotation={[0, 0, 0.42]} geometry={sepal}>
            <meshStandardMaterial color={COLOURS.sepal} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <SceneLabel position={[insect ? 2.6 : 2.35, insect ? 2.35 : 0.7, -0.6]} tone={insect ? "text-pink-300" : "text-ink-400"}>
        {insect ? "petal · large, bright — advertises" : "petals · small, dull — nothing to advertise"}
      </SceneLabel>
      <SceneLabel position={[-1.6, RECEPTACLE_Y + 0.5, -0.4]} tone="text-emerald-300">
        sepal
      </SceneLabel>
      {insect && (
        <SceneLabel position={[1.15, RECEPTACLE_Y + 0.1, 0.65]} tone="text-amber-200">
          nectar
        </SceneLabel>
      )}
    </group>
  );
}

function Stamens({ vector, pollenGeometry }) {
  const insect = vector.key === "insect";
  const filamentTop = insect ? 3.85 : 4.75;
  const pollenColour = insect ? COLOURS.pollenInsect : COLOURS.pollenWind;
  return (
    <group>
      {[0.55, 1.25, Math.PI - 1.25, Math.PI - 0.55].map((a, i) => (
        <group key={i} rotation={[0, a, 0]}>
          <mesh position={[0.78, RECEPTACLE_Y + (filamentTop - RECEPTACLE_Y) / 2, 0]}>
            <cylinderGeometry args={[0.03, 0.04, filamentTop - RECEPTACLE_Y, 8]} />
            <meshStandardMaterial color={COLOURS.filament} roughness={0.7} />
          </mesh>
          {/* Two-lobed anther; a wind anther dangles below the filament tip. */}
          <group position={[0.78, insect ? filamentTop + 0.2 : filamentTop - 0.32, 0]}>
            {[-0.11, 0.11].map((x) => (
              <mesh key={x} position={[x, 0, 0]}>
                <capsuleGeometry args={[0.1, 0.3, 4, 10]} />
                <meshStandardMaterial color={COLOURS.anther} roughness={0.55} />
              </mesh>
            ))}
            <AntherPollen geometry={pollenGeometry} colour={pollenColour} count={insect ? 14 : 22} seed={i + 3} sizeScale={insect ? 1.15 : 0.8} />
          </group>
        </group>
      ))}
      <SceneLabel position={[1.25, filamentTop + (insect ? 0.62 : -0.75), -0.3]} tone="text-amber-300">
        {insect ? "anther · spiky, sticky pollen" : "anther · dangling · light dry pollen"}
      </SceneLabel>
      <SceneLabel position={[-1.35, RECEPTACLE_Y + 2.7, -0.3]} tone="text-ink-300">
        filament
      </SceneLabel>
      <SceneLabel position={[-1.55, filamentTop + 0.35, -0.3]} tone="text-ink-400">
        stamen = anther + filament
      </SceneLabel>
    </group>
  );
}

function Stigma({ vector, landed }) {
  const insect = vector.key === "insect";
  const feathers = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        angle: -1.05 + (i / 15) * 2.1,
        spin: hashRandom(i * 2.3) * Math.PI * 2,
        length: 0.55 + 0.25 * hashRandom(i * 1.7),
      })),
    [],
  );
  return (
    <group position={[0, STIGMA_Y, 0]}>
      {insect ? (
        <>
          <mesh scale={[1.25, 0.72, 1.1]}>
            <sphereGeometry args={[0.3, 20, 14]} />
            <meshStandardMaterial color={landed ? COLOURS.stigmaSticky : COLOURS.stigma} roughness={0.15} metalness={0.05} emissive={COLOURS.stigma} emissiveIntensity={0.18} />
          </mesh>
          {/* Sticky secretion — glossy droplets. */}
          {[0.18, -0.2, 0.05].map((x, i) => (
            <mesh key={i} position={[x, 0.16, 0.16 - i * 0.12]}>
              <sphereGeometry args={[0.05, 10, 8]} />
              <meshStandardMaterial color="#f0fdf4" roughness={0.05} transparent opacity={0.8} />
            </mesh>
          ))}
        </>
      ) : (
        <group>
          {feathers.map((f, i) => (
            <group key={i} rotation={[0, f.spin, f.angle]}>
              <mesh position={[0, f.length / 2, 0]}>
                <cylinderGeometry args={[0.012, 0.022, f.length, 6]} />
                <meshStandardMaterial color={COLOURS.stigma} roughness={0.7} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      <SceneLabel position={[1.05, 0.45, 0.2]} tone="text-lime-300" accent={landed}>
        {landed ? `stigma · pollinated` : insect ? "stigma · sticky, inside the flower" : "stigma · feathery, sieves the air"}
      </SceneLabel>
    </group>
  );
}

/** The grain that lands; the tube grows out of it. */
function LandedGrain({ landing, germination, geometry, colour }) {
  const scale = 0.09 * smoothstep(landing);
  if (landing <= 0) return null;
  return (
    <group position={[0, STIGMA_Y + 0.12, 0.08]}>
      <mesh geometry={geometry} scale={scale * (1 + 0.15 * germination)}>
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
      {landing >= 1 && germination < 1 && (
        <SceneLabel position={[-0.95, 0.35, 0.2]} tone="text-amber-200">
          {germination > 0 ? "grain hydrates · tube emerges" : "pollen grain · landed"}
        </SceneLabel>
      )}
    </group>
  );
}

function Style() {
  const length = STYLE.top - STYLE.bottom;
  return (
    <group>
      {/* Back half only, so the tube inside is on show. */}
      <mesh position={[0, STYLE.bottom + length / 2, 0]}>
        <cylinderGeometry args={[STYLE.radius, STYLE.radius * 1.15, length, 24, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={COLOURS.style} roughness={0.6} side={THREE.DoubleSide} transparent opacity={0.9} />
      </mesh>
      <SceneLabel position={[-0.95, 3.7, 0.2]} tone="text-ink-300">
        style · cut-away
      </SceneLabel>
    </group>
  );
}

function Ovule({ ovule, primary, describe }) {
  const { centre, rx, ry } = ovule;
  const z = describe?.zygoteFormed && primary;
  const e = describe?.endospermFormed && primary;
  const entered = primary && describe?.entry > 0;
  return (
    <group position={centre}>
      {/* Integuments — the ovule's coat — open at the micropyle end (top). */}
      <mesh scale={[rx, ry, rx]}>
        <sphereGeometry args={[1, 24, 18, 0, Math.PI * 2, 0.32, Math.PI - 0.32]} />
        <meshStandardMaterial color={COLOURS.ovule} roughness={0.6} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Embryo sac. */}
      <mesh scale={[rx * 0.62, ry * 0.7, rx * 0.62]} position={[0, -0.02, 0]}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshStandardMaterial color={COLOURS.sac} roughness={0.5} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {/* Micropyle: the gap the tube comes through. */}
      <mesh position={[0, ry - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.085, 16]} />
        <meshBasicMaterial color="#365314" side={THREE.DoubleSide} />
      </mesh>
      {/* Egg apparatus near the micropyle: egg + two synergids. */}
      <mesh position={[0, ry * 0.42, 0.04]}>
        <sphereGeometry args={[z ? 0.1 : 0.075, 14, 12]} />
        <meshStandardMaterial color={z ? COLOURS.zygote : COLOURS.egg} emissive={z ? COLOURS.zygote : COLOURS.egg} emissiveIntensity={z ? 1.0 : 0.45} />
      </mesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, ry * 0.5, -0.02]}>
          <sphereGeometry args={[0.04, 10, 8]} />
          <meshStandardMaterial color={COLOURS.synergid} roughness={0.5} />
        </mesh>
      ))}
      {/* Two polar nuclei in the centre; fuse with the second sperm into the 3n endosperm. */}
      {e ? (
        <mesh position={[0, -0.02, 0.03]}>
          <sphereGeometry args={[0.12, 14, 12]} />
          <meshStandardMaterial color={COLOURS.endosperm} emissive={COLOURS.endosperm} emissiveIntensity={0.9} />
        </mesh>
      ) : (
        [-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, -0.02, 0.03]}>
            <sphereGeometry args={[0.048, 10, 8]} />
            <meshStandardMaterial color={COLOURS.polar} emissive={COLOURS.polar} emissiveIntensity={0.5} />
          </mesh>
        ))
      )}
      {/* Antipodal cells at the far end. */}
      {[-0.06, 0, 0.06].map((x) => (
        <mesh key={x} position={[x, -ry * 0.55, 0]}>
          <sphereGeometry args={[0.03, 8, 6]} />
          <meshStandardMaterial color={COLOURS.antipodal} roughness={0.6} />
        </mesh>
      ))}
      {/* Funicle: the stalk to the ovary wall. */}
      <mesh position={[primary ? 0.22 : -0.2, -ry * 0.2, -0.1]} rotation={[0, 0, primary ? -1.1 : 1.1]}>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 6]} />
        <meshStandardMaterial color={COLOURS.ovaryInner} roughness={0.7} />
      </mesh>
      {z && <Halo position={[0, ry * 0.42, 0.04]} radius={0.22} color={COLOURS.zygote} opacity={0.18} />}
      {e && <Halo position={[0, -0.02, 0.03]} radius={0.26} color={COLOURS.endosperm} opacity={0.14} />}
      {primary && (
        <>
          <SceneLabel position={[0.85, ry + 0.05, 0.2]} tone={entered ? "text-amber-200" : "text-ink-400"}>
            {entered ? "micropyle · tube entering" : "micropyle"}
          </SceneLabel>
          <SceneLabel position={[0.85, ry * 0.42, 0.2]} tone={z ? "text-amber-300" : "text-rose-300"} accent={z}>
            {z ? "zygote · 2n (sperm + egg)" : "egg cell · n"}
          </SceneLabel>
          <SceneLabel position={[0.85, -0.12, 0.2]} tone={e ? "text-fuchsia-300" : "text-violet-300"} accent={e}>
            {e ? "endosperm · 3n (sperm + 2 polar nuclei)" : "2 polar nuclei · n + n"}
          </SceneLabel>
        </>
      )}
      {!primary && (
        <SceneLabel position={[-0.7, -ry - 0.15, 0.2]} tone="text-ink-400">
          second ovule
        </SceneLabel>
      )}
    </group>
  );
}

function Ovary({ describe }) {
  return (
    <group>
      <group position={OVARY.centre} scale={[1, OVARY.scaleY, 0.92]}>
        {/* Back half of the ovary wall, and a darker inner lining for depth. */}
        <mesh>
          <sphereGeometry args={[OVARY.radius, 36, 24, Math.PI, Math.PI]} />
          <meshStandardMaterial color={COLOURS.ovaryWall} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <sphereGeometry args={[OVARY.radius * 0.93, 36, 24, Math.PI, Math.PI]} />
          <meshStandardMaterial color={COLOURS.ovaryInner} roughness={0.85} side={THREE.BackSide} />
        </mesh>
        {/* The cut face: a thin ring in the plane of the cut, where the front half was removed. */}
        <mesh>
          <ringGeometry args={[OVARY.radius * 0.93, OVARY.radius, 48]} />
          <meshStandardMaterial color="#a3d977" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <Ovule ovule={OVULE_A} primary describe={describe} />
      <Ovule ovule={OVULE_B} primary={false} describe={describe} />
      <SceneLabel position={[-1.85, OVARY.centre[1] + 0.55, 0.3]} tone="text-emerald-300">
        ovary · cut open
      </SceneLabel>
      <SceneLabel position={[-1.6, OVARY.centre[1] - 0.95, 0.4]} tone="text-ink-400">
        carpel = stigma + style + ovary
      </SceneLabel>
    </group>
  );
}

// ─── The pollen tube ────────────────────────────────────────────────

function PollenTube({ path, liveRef, vectorKey }) {
  const meshRef = useRef(null);
  const tubeNucleus = useRef(null);
  const generative = useRef(null);
  const sperm1 = useRef(null);
  const sperm2 = useRef(null);
  const indexCount = TUBE_SEGMENTS * TUBE_RADIAL * 6;
  const perSegment = TUBE_RADIAL * 6;

  useFrame(() => {
    const snap = liveRef.current;
    const d = describePollination(snap ? snap.t : 0, vectorKey);
    const u = clamp(fractionToU(d.tubeFraction, path.styleShare), 0, 1);
    const segments = Math.floor(u * TUBE_SEGMENTS);
    path.geometry.setDrawRange(0, Math.min(indexCount, segments * perSegment));
    if (meshRef.current) meshRef.current.visible = segments > 0;
    const place = (ref, f) => {
      const m = ref.current;
      if (!m) return;
      if (f === null || f === undefined) {
        m.visible = false;
        return;
      }
      m.visible = true;
      m.position.copy(path.curve.getPointAt(clamp(fractionToU(f, path.styleShare), 0, 1)));
    };
    place(tubeNucleus, d.nuclei.tube);
    place(generative, d.nuclei.generative);
    place(sperm1, d.nuclei.sperm1);
    place(sperm2, d.nuclei.sperm2);
  });

  return (
    <group>
      <mesh ref={meshRef} geometry={path.geometry}>
        <meshStandardMaterial color={COLOURS.tube} emissive={COLOURS.tube} emissiveIntensity={0.45} roughness={0.45} toneMapped={false} />
      </mesh>
      <mesh ref={tubeNucleus} visible={false}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color={COLOURS.tubeNucleus} emissive={COLOURS.tubeNucleus} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <mesh ref={generative} visible={false}>
        <sphereGeometry args={[0.062, 10, 8]} />
        <meshStandardMaterial color={COLOURS.generative} emissive={COLOURS.generative} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <mesh ref={sperm1} visible={false}>
        <sphereGeometry args={[0.058, 10, 8]} />
        <meshStandardMaterial color={COLOURS.sperm} emissive={COLOURS.sperm} emissiveIntensity={1.3} toneMapped={false} />
      </mesh>
      <mesh ref={sperm2} visible={false}>
        <sphereGeometry args={[0.058, 10, 8]} />
        <meshStandardMaterial color={COLOURS.sperm} emissive={COLOURS.sperm} emissiveIntensity={1.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A vertical gauge beside the style: how far down the tube has got, in mm. */
function GrowthGauge({ describe }) {
  const top = STYLE.top;
  const bottom = STYLE.bottom;
  const length = top - bottom;
  const f = clamp(describe.tubeFraction, 0, 1);
  const fill = length * f;
  const colour = describe.entered ? COLOURS.zygote : COLOURS.tube;
  const ticks = useMemo(() => [0, 3, 6, 9, 12].map((mm) => ({ mm, y: top - (mm / STYLE_LENGTH_MM) * length })), [top, length]);
  return (
    <group position={[GAUGE.x, 0, 0]}>
      <mesh position={[0, bottom + length / 2, 0]}>
        <boxGeometry args={[0.16, length, 0.16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} transparent opacity={0.7} />
      </mesh>
      {fill > 0.005 && (
        <mesh position={[0, top - fill / 2, 0]} scale={[1, fill, 1]}>
          <boxGeometry args={[0.12, 1, 0.12]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
      )}
      {ticks.map((t) => (
        <SceneLabel key={t.mm} position={[0.42, t.y, 0]} tone="text-ink-500">
          {`${t.mm} mm`}
        </SceneLabel>
      ))}
      <SceneLabel position={[0, top + 0.78, 0]} accent={f > 0}>
        {f > 0 ? `tube ${describe.tubeMm.toFixed(1)} mm · ${Math.round(f * 100)} %` : "pollen tube gauge"}
      </SceneLabel>
      {describe.growthRateMmPerH > 0 && (
        <SceneLabel position={[0, bottom - 0.35, 0]} tone="text-amber-200">
          {`${describe.growthRateMmPerH.toFixed(1)} mm/h · ${describe.hoursAfterPollination.toFixed(1)} h`}
        </SceneLabel>
      )}
    </group>
  );
}

/** The one-line verdict the whole scene exists to teach. */
function Verdict({ describe }) {
  const tone = describe.fertilised ? "text-emerald-300" : describe.pollinated ? "text-amber-300" : "text-ink-400";
  return (
    <group>
      <SceneLabel position={[0, 6.35, 0]} accent={describe.pollinated}>
        {describe.pollinated ? "POLLINATION ✓ · pollen on the stigma" : "POLLINATION · pollen must reach the stigma"}
      </SceneLabel>
      <SceneLabel position={[0, 5.95, 0]} tone={tone} accent={describe.fertilised}>
        {describe.fertilised ? "FERTILISATION ✓ · nuclei fused in the ovule" : describe.pollinated ? "FERTILISATION · not yet — the tube is still growing" : "FERTILISATION · fusion of nuclei, in the ovule, hours later"}
      </SceneLabel>
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function FlowerPollinationCanvas({ params = {}, setParam }) {
  const { vector: vectorKey = "insect", pollinate = 0, time = 0, speed = 1 } = params || {};
  const vector = vectorFor(vectorKey);
  const live = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const describe = useMemo(() => describePollination(snapshot ? snapshot.t : Number(time) || 0, vector.key), [snapshot, time, vector.key]);

  const path = useDisposedTubePath();
  const pollenGeometry = usePollenGeometry(vector.pollen.spiky);

  // Wind density and the bee's place on its path follow the arrival stage.
  const windRef = useRef(0);
  useEffect(() => {
    windRef.current = vector.key === "wind" ? (describe.started ? 0.25 + 0.75 * pulse(describe.arrival, 0.5) * (describe.pollinated ? 0.35 : 1) : 0.15) : 0;
  }, [describe, vector.key]);
  const beeS = describe.arrival < 1 ? describe.arrival * 0.7 : 0.7 + 0.3 * smoothstep(describe.germination);
  const beeVisible = vector.key === "insect" && describe.started && beeS < 0.995;

  const scrub = useMemo(
    () => ({ value: Number(time) || 0, step: 0.1, onChange: (v) => typeof setParam === "function" && setParam("time", v) }),
    [time, setParam],
  );

  return (
    <SceneCanvas
      camera={{ position: [0.4, 3.4, 11.5], fov: 42 }}
      controls={{ minDistance: 4, maxDistance: 28, target: [0, 2.6, 0], maxPolarAngle: Math.PI * 0.52 }}
      lights={{ ambient: 0.6, keyLight: 1.3, rim: PALETTE.emerald }}
    >
      <TimelineDriver timeline={POLLINATION_TIMELINE} trigger={pollinate} speed={speed} live={live} scrub={scrub} onTick={setSnapshot} />

      <Stem />
      <Perianth vector={vector} />
      <Stamens vector={vector} pollenGeometry={pollenGeometry} />
      <Ovary describe={describe} />
      <Style />
      <Stigma vector={vector} landed={describe.pollinated} />
      <LandedGrain landing={describe.landing} germination={describe.germination} geometry={pollenGeometry} colour={vector.key === "insect" ? COLOURS.pollenInsect : COLOURS.pollenWind} />
      <PollenTube path={path} liveRef={live} vectorKey={vector.key} />
      <GrowthGauge describe={describe} />

      {vector.key === "insect" ? (
        <Bee s={beeS} visible={beeVisible} pollenGeometry={pollenGeometry} />
      ) : (
        <>
          <WindPollen densityRef={windRef} geometry={pollenGeometry} />
          <WindStreaks densityRef={windRef} />
        </>
      )}

      {describe.nuclei.tube !== null && (
        <SceneLabel position={[-1.7, Math.max(2.45, lerp(STYLE.top, STYLE.bottom, clamp(describe.tubeFraction, 0, 1)) + 0.1), 0.3]} tone="text-sky-300">
          {describe.nuclei.divided ? "tube nucleus + 2 sperm nuclei (n)" : "tube nucleus + generative nucleus"}
        </SceneLabel>
      )}
      {describe.nuclei.divided && describe.fertilisation === 0 && (
        <SceneLabel position={[1.75, 3.35, 0.3]} tone="text-rose-300">
          generative nucleus divided → 2 sperm
        </SceneLabel>
      )}

      <Verdict describe={describe} />
      <TimelineCaption position={[0, -1.75, 0.5]} timeline={POLLINATION_TIMELINE} snapshot={snapshot} idle="press Trigger pollination — or drag the time slider" />

    </SceneCanvas>
  );
}
