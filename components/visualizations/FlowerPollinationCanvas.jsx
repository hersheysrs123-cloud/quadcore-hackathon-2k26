"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
  lerp,
  FitCamera,
  LabelsOn,
  ToggleLabel,
} from "@/components/visualizations/scene-kit";
import { TimelineCaption, TimelineDriver } from "@/components/visualizations/timeline-kit";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { FLOWER_MODEL } from "@/components/visualizations/flower-model-meta";
import { pulse, smoothstep } from "@/lib/timeline";
import {
  MICROPYLE_OVERSHOOT,
  POLLINATION_TIMELINE,
  STYLE_LENGTH_MM,
  describePollination,
  vectorFor,
} from "@/lib/pollination";

// ─── Flower dissection: pollination and fertilisation ───────────────
// A flower cut down the middle, as a botany practical dissects one, and
// the front half taken away: our own Blender model (scripts/flower-model).
// The pedicel, receptacle, carpel and ovules are solids whose cut faces show
// fresh tissue (green epidermis, pale cortex, the vascular strands and the
// style's transmitting tract); petals and sepals that cross the cut are
// clipped at the same plane, z = 0. An insect flower has five large pink
// petals, a nectary at the ovary's base, stamens inside the flower and a
// wet, papillate stigma; a wind flower has small papery tepals, anthers
// dangling outside on hair-thin filaments and a feathery stigma.
//
// Press the button and the vector delivers a grain: a honeybee visits an
// anther then the stigma, or the wind blows a cloud past the feathery
// stigma and one grain catches. That moment is POLLINATION, and the label
// says so. Everything after it — the tube growing down the style (a
// TubeGeometry whose draw range is the model's fraction), the three
// nuclei travelling behind the tip, the generative nucleus dividing, the
// tip entering the micropyle and the two fusions in the embryo sac — is
// FERTILISATION, and takes hours. The time slider is the same clock:
// playing, the scene drives it; dragged, it drives the scene.
// ─────────────────────────────────────────────────────────────────────

const FLOWER_GLB = "/models/flower.glb";
const M = FLOWER_MODEL;

const STIGMA_Y = M.stigmaY;
/** The style as the tube sees it: from the stigma to the top of the locule. */
const STYLE = { bottom: M.locule.centre[1] + M.locule.radius[1], top: M.style.top };
const toOvule = (o) => ({ centre: o.centre, rx: o.rx, ry: o.ry });
const OVULE_A = toOvule(M.ovules[0]);
const OVULE_B = toOvule(M.ovules[1]);
/** Far enough right that its scale clears the petals and the anther labels. */
const GAUGE = { x: 3.45 };
/** Stem base and caption to the verdict at the top, the gauge at the right. */
const FLOWER_VIEW = { cx: 0.75, cy: 2.2, width: 8.8, height: 9.4, depth: 3 };
const TUBE_SEGMENTS = 180;
const TUBE_RADIAL = 8;

/** The dissection: everything in front of z = 0 has been cut away. */
const CUT_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const deg = Math.PI / 180;
/** Azimuths (0 = +x, 90° = straight back) of the organs in each whorl. */
const WHORLS = {
  petals: [90, 18, 162, -54, 234].map((a) => a * deg),
  sepals: [126, 54, 198, -18, 270].map((a) => a * deg),
  tepals: [90, 30, 150, -30, 210].map((a) => a * deg),
  stamensInsect: [14, 34, 56, 78, 102, 124, 146, 166].map((a) => a * deg),
  stamensWind: [28, 90, 152].map((a) => a * deg),
};
/** The stamen the bee works: its anther, in the scene. */
const BEE_STAMEN = WHORLS.stamensInsect[0];

const COLOURS = {
  pollenInsect: "#fbbf24",
  pollenWind: "#fde68a",
  egg: "#fb7185",
  synergid: "#fda4af",
  polar: PALETTE.violet,
  antipodal: "#94a3b8",
  sacCell: "#fdf6e3",
  tube: "#fcd34d",
  tubeNucleus: PALETTE.sky,
  generative: PALETTE.violet,
  sperm: PALETTE.rose,
  zygote: PALETTE.gold,
  endosperm: "#c084fc",
  nectar: "#fde047",
  wind: "#cbd5e1",
  // vertex colours baked by scripts/flower-model, named here for the key
  petal: "#f6a2c8",
  tepal: "#c6c08a",
  anther: "#f0b92a",
  stigma: "#c8df4c",
  style: "#bfe08e",
  ovary: "#7fb94b",
};

/** An organ's local point (x out from the axis, y up, z across) at azimuth `a`, in the scene. */
function whorlPoint(a, x, y, z = 0, base = 0) {
  const r = base + x;
  return new THREE.Vector3(r * Math.cos(a) + z * Math.sin(a), y, -r * Math.sin(a) + z * Math.cos(a));
}

// ─── Materials ──────────────────────────────────────────────────────

function EnableLocalClipping() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const was = gl.localClippingEnabled;
    gl.localClippingEnabled = true;
    return () => {
      gl.localClippingEnabled = was;
    };
  }, [gl]);
  return null;
}

/**
 * A petal: vertex-coloured (white claw flushing to pink, a yellow nectar
 * guide), with fine veins fanning from the claw drawn from the leaf
 * coordinates, a velvet sheen, and clipped at the dissection plane.
 */
function makePetalMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.55,
    sheen: 0.6,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color("#ffd6e8"),
    clippingPlanes: [CUT_PLANE],
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 _uvl;\nvarying vec2 vUvl;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvUvl = _uvl;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vUvl;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float u = vUvl.x;
          float v = vUvl.y;
          // Main veins fan from the claw; finer ones between them.
          float k1 = v * (5.0 + 4.0 * u);
          float k2 = v * (13.0 + 12.0 * u) + 0.5;
          float w1 = fwidth(k1) * 1.3 + 0.07;
          float w2 = fwidth(k2) * 1.3 + 0.1;
          float v1 = 1.0 - smoothstep(0.0, w1, abs(fract(k1 + 0.5) - 0.5));
          float v2 = 1.0 - smoothstep(0.0, w2, abs(fract(k2 + 0.5) - 0.5));
          float along = smoothstep(0.02, 0.18, u) * (1.0 - smoothstep(0.7, 0.98, u));
          float vein = (v1 * 0.45 + v2 * 0.18 * smoothstep(0.25, 0.45, u)) * along;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.93, 0.7, 0.82), vein);
          // Thin petal tissue: the underside shows a touch of light through it.
          if (!gl_FrontFacing) diffuseColor.rgb *= 1.06;
        }`,
      );
  };
  return m;
}

function useMaterials() {
  const mats = useMemo(
    () => ({
      tissue: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
      ovule: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color("#fffbe8") }),
      wet: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }),
      nectary: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
      plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
      leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, side: THREE.DoubleSide, clippingPlanes: [CUT_PLANE] }),
      petal: makePetalMaterial(),
      bee: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
      wing: new THREE.MeshPhysicalMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.2, iridescence: 0.8, iridescenceIOR: 1.4 }),
      pollen: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

// ─── The tube's path ────────────────────────────────────────────────

/** Grain on the stigma → down the cut face of the style → across the locule → micropyle → egg apparatus. */
function useTubePath() {
  return useMemo(() => {
    const [ax, ay, az] = OVULE_A.centre;
    const top = ay + OVULE_A.ry;
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, STIGMA_Y + 0.17, -0.01),
        new THREE.Vector3(0, STIGMA_Y - 0.1, 0.022),
        new THREE.Vector3(0, 3.6, 0.022),
        new THREE.Vector3(0, 2.6, 0.022),
        new THREE.Vector3(0, STYLE.bottom + 0.05, 0.022),
        new THREE.Vector3(0.12, STYLE.bottom - 0.17, 0.01),
        new THREE.Vector3(ax - 0.01, top + 0.04, az + 0.03),
        new THREE.Vector3(ax, top - 0.16, az - 0.01),
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
    const geometry = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, 0.032, TUBE_RADIAL, false);
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

// ─── Pollen ─────────────────────────────────────────────────────────

/** Grains dusted over one anther's slits (insect) or all over a dangling anther (wind), in the stamen's frame. */
function AntherPollen({ geometry, material, colour, insect, seed }) {
  const meshRef = useRef(null);
  const count = insect ? 11 : 16;
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    const c = new THREE.Color(colour);
    const [ax, ay] = insect ? M.anther.insect : M.anther.wind;
    for (let i = 0; i < count; i += 1) {
      const r1 = hashRandom(seed * 13.1 + i * 1.7);
      const r2 = hashRandom(seed * 7.3 + i * 2.3);
      const r3 = hashRandom(seed * 5.7 + i * 3.1);
      const side = i % 2 ? 1 : -1;
      if (insect) d.position.set(ax - 0.095 - 0.025 * r3, ay + (r1 - 0.5) * 0.34, side * (0.072 + (r2 - 0.5) * 0.05));
      else d.position.set(ax + Math.cos(r2 * 6.28) * 0.07, ay + (r1 - 0.5) * 0.8, Math.sin(r2 * 6.28) * 0.08);
      d.rotation.set(r1 * 6, r2 * 6, r3 * 6);
      d.scale.setScalar(insect ? 0.019 : 0.014);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, insect, colour, seed]);
  return <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />;
}

/** A cloud of light grains blown left to right across the flower's top. */
function WindPollen({ densityRef, geometry, material, speed = 1, count = 110, seed = 9 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      x: Float32Array.from({ length: count }, (_, i) => -8 + hashRandom(seed + i * 1.3) * 16),
      y: Float32Array.from({ length: count }, (_, i) => 3.4 + hashRandom(seed * 3 + i * 2.1) * 3.2),
      z: Float32Array.from({ length: count }, (_, i) => -1.5 + hashRandom(seed * 7 + i * 0.7) * 3),
      phase: Float32Array.from({ length: count }, (_, i) => hashRandom(seed * 11 + i * 1.9) * Math.PI * 2),
      t: 0,
      dummy: new THREE.Object3D(),
    }),
    [count, seed],
  );
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c = new THREE.Color(COLOURS.pollenWind);
    for (let i = 0; i < count; i += 1) mesh.setColorAt(i, c);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);
  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // The wind blows at the animation speed, like everything else in the scene.
    const dt = Math.min(rawDelta, 0.05) * speed;
    state.t += dt;
    const density = densityRef.current;
    const t = state.t;
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      state.x[i] += (2.2 + 1.5 * Math.sin(state.phase[i])) * dt;
      if (state.x[i] > 8) state.x[i] = -8;
      const on = i < Math.round(density * count);
      d.position.set(state.x[i], state.y[i] + 0.15 * Math.sin(t * 2 + state.phase[i]), state.z[i]);
      d.rotation.set(t + state.phase[i], state.phase[i], 0);
      d.scale.setScalar(on ? 0.03 : 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />;
}

/** Wind streaks so the air itself is visible. */
function WindStreaks({ densityRef, speed = 1, count = 18, seed = 4 }) {
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
    const dt = Math.min(rawDelta, 0.05) * speed;
    const density = densityRef.current;
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      state.x[i] += 4.5 * dt;
      if (state.x[i] > 8) state.x[i] = -8;
      const on = i < Math.round(density * count);
      d.position.set(state.x[i], state.y[i], state.z[i]);
      d.scale.setScalar(on ? 1 : 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1.1, 0.012, 0.012]} />
      <meshBasicMaterial color={COLOURS.wind} transparent opacity={0.4} depthWrite={false} />
    </instancedMesh>
  );
}

// ─── The honeybee ───────────────────────────────────────────────────

/**
 * A worker honeybee. `s` runs 0 → 1 along its visit: in from the right, a
 * pause on an anther (where it picks up pollen), on to the stigma (where it
 * leaves some), and away to the left. Wings beat; the pollen baskets on its
 * hind legs fill after the anther.
 */
function Bee({ s, visible, parts, mats, speed = 1 }) {
  const group = useRef(null);
  const wingL = useRef(null);
  const wingR = useRef(null);
  // Keyframes in s: it dwells on the anther, and is on the stigma at
  // s = 0.7, the moment the grain lands (the end of the arrival stage).
  const flight = useMemo(() => {
    const [ax, ay] = M.anther.insect;
    const anther = whorlPoint(BEE_STAMEN, ax, M.stamenBase.y + ay + 0.42, 0, M.stamenBase.radius);
    const stigma = new THREE.Vector3(0.02, STIGMA_Y + M.stigmaTop + 0.3, -0.05);
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const keys = [
      [0, v(7.5, 6.4, 1.6)],
      [0.16, v(4.0, 5.5, 0.9)],
      [0.27, anther.clone().add(v(0.25, 0.08, 0.3))],
      [0.33, anther],
      [0.42, anther.clone().add(v(-0.02, 0.02, 0.01))],
      [0.52, anther.clone().add(v(-0.35, 0.55, 0.25))],
      [0.62, stigma.clone().add(v(0.18, 0.12, 0.12))],
      [0.68, stigma],
      [0.76, stigma.clone().add(v(-0.02, 0.02, 0.0))],
      [0.88, v(-2.2, 6.2, 1.2)],
      [1, v(-7.5, 7.0, 1.8)],
    ];
    const curve = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, "catmullrom", 0.4);
    // s → the curve's own parameter, which passes control point k at k / (n - 1).
    const toT = (sv) => {
      const n = keys.length;
      for (let k = 0; k < n - 1; k += 1) {
        if (sv <= keys[k + 1][0]) return (k + (sv - keys[k][0]) / (keys[k + 1][0] - keys[k][0])) / (n - 1);
      }
      return 1;
    };
    return { curve, toT };
  }, []);
  const hasPollen = s > 0.36;
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const beat = useRef(0);
  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    const t = flight.toT(clamp(s, 0, 1));
    flight.curve.getPoint(t, g.position);
    flight.curve.getPoint(Math.min(1, t + 0.02), ahead);
    ahead.y = g.position.y + (ahead.y - g.position.y) * 0.3; // stays level-ish, as a bee hovers
    if (ahead.distanceToSquared(g.position) > 1e-6) {
      g.lookAt(ahead);
      g.rotateY(-Math.PI / 2);
    }
    g.visible = visible;
    beat.current += Math.min(rawDelta, 0.05) * speed;
    const flap = Math.sin(beat.current * 48) * 0.7;
    if (wingL.current) wingL.current.rotation.x = -0.25 - flap;
    if (wingR.current) wingR.current.rotation.x = 0.25 + flap;
  });
  if (!parts.bee) return null;
  return (
    <group ref={group} scale={0.85}>
      <mesh geometry={parts.bee.geometry} material={mats.bee} />
      {hasPollen && parts.beePollen && <mesh geometry={parts.beePollen.geometry} material={mats.plain} />}
      <group ref={wingL} position={[0.17, 0.09, 0.05]} rotation={[0, 0.35, 0]}>
        <mesh geometry={parts.beeWing.geometry} material={mats.wing} renderOrder={3} />
      </group>
      <group ref={wingR} position={[0.17, 0.09, -0.05]} rotation={[0, -0.35, 0]}>
        <mesh geometry={parts.beeWing.geometry} material={mats.wing} scale={[1, 1, -1]} renderOrder={3} />
      </group>
    </group>
  );
}

// ─── The flower ─────────────────────────────────────────────────────

/** Organs repeated round a whorl, each turned to its azimuth. */
function Whorl({ geometry, material, angles, base, y, jitter = 0, seed = 1, renderOrder = 0 }) {
  return angles.map((a, i) => {
    const r = jitter ? hashRandom(seed + i * 2.7) - 0.5 : 0;
    return (
      <group key={i} rotation={[0, a, 0]}>
        <mesh geometry={geometry} material={material} position={[base, y, 0]} rotation={[r * jitter, 0, r * jitter * 0.5]} scale={1 + r * jitter * 0.4} renderOrder={renderOrder} />
      </group>
    );
  });
}

function Perianth({ insect, parts, mats }) {
  return (
    <group>
      {parts.sepal && <Whorl geometry={parts.sepal.geometry} material={mats.leaf} angles={WHORLS.sepals} base={M.sepalBase.radius} y={M.sepalBase.y} jitter={0.15} seed={5} />}
      {insect
        ? parts.petal && <Whorl geometry={parts.petal.geometry} material={mats.petal} angles={WHORLS.petals} base={M.petalBase.radius} y={M.petalBase.y} jitter={0.12} seed={2} />
        : parts.tepal && <Whorl geometry={parts.tepal.geometry} material={mats.leaf} angles={WHORLS.tepals} base={M.tepalBase.radius} y={M.tepalBase.y} jitter={0.2} seed={3} />}
      <ToggleLabel position={[2.55, 2.35, -0.6]} tone={insect ? "text-pink-300" : "text-ink-400"}>
        {insect ? "petal · large, bright — advertises" : "petals · small, dull — nothing to advertise"}
      </ToggleLabel>
      <ToggleLabel position={[-2.0, 0.3, 0.2]} tone="text-emerald-300">
        sepal
      </ToggleLabel>
    </group>
  );
}

function Nectary({ parts, mats }) {
  const drops = useMemo(
    () =>
      [30, 75, 115, 160].map((a, i) => {
        const p = whorlPoint(a * deg, M.nectary.radius - 0.02, M.nectary.y + 0.07, 0.04 * (i % 2 ? 1 : -1));
        return [p.x, p.y, p.z];
      }),
    [],
  );
  return (
    <group>
      {parts.nectary && <mesh geometry={parts.nectary.geometry} material={mats.nectary} />}
      {/* Nectar beading on the disc: the reward that pays the courier. */}
      {drops.map((p, i) => (
        <mesh key={i} position={p} scale={[1, 0.7, 1]}>
          <sphereGeometry args={[0.05, 14, 10]} />
          <meshPhysicalMaterial color={COLOURS.nectar} roughness={0.05} transmission={0.6} thickness={0.1} clearcoat={1} emissive={COLOURS.nectar} emissiveIntensity={0.15} />
        </mesh>
      ))}
      <ToggleLabel position={[1.45, 0.0, 0.5]} tone="text-amber-200">
        nectary · nectar
      </ToggleLabel>
    </group>
  );
}

/** Each stamen a little taller or shorter and leaning a little, as in a real flower; the bee's stays as modelled. */
const stamenPose = (i, angle) => {
  if (angle === BEE_STAMEN) return { lean: 0, stretch: 1, twist: 0 };
  const r1 = hashRandom(i * 3.7 + 1) - 0.5;
  const r2 = hashRandom(i * 5.3 + 2) - 0.5;
  return { lean: r1 * 0.12, stretch: 1 + r2 * 0.14, twist: r1 * 0.5 };
};

function Stamens({ insect, parts, mats, pollen }) {
  const part = insect ? parts.stamenInsect : parts.stamenWind;
  const angles = insect ? WHORLS.stamensInsect : WHORLS.stamensWind;
  const [, ay] = insect ? M.anther.insect : M.anther.wind;
  const antherY = M.stamenBase.y + ay;
  return (
    <group>
      {part &&
        angles.map((a, i) => {
          const { lean, stretch, twist } = stamenPose(i, a);
          return (
            <group key={i} rotation={[0, a, 0]}>
              <group position={[M.stamenBase.radius, M.stamenBase.y, 0]} rotation={[0, twist, lean]} scale={[1, stretch, 1]}>
                <mesh geometry={part.geometry} material={mats.plain} />
                {pollen && <AntherPollen geometry={pollen} material={mats.pollen} colour={insect ? COLOURS.pollenInsect : COLOURS.pollenWind} insect={insect} seed={i + 1} />}
              </group>
            </group>
          );
        })}
      <ToggleLabel position={[insect ? 1.45 : 2.2, antherY + (insect ? 0.62 : -0.1), -0.3]} tone="text-amber-300">
        {insect ? "anther · spiky, sticky pollen" : "anther · dangling · light dry pollen"}
      </ToggleLabel>
      <ToggleLabel position={[-1.55, 2.7, -0.3]} tone="text-ink-300">
        filament
      </ToggleLabel>
      <ToggleLabel position={[-1.75, antherY + 0.45, -0.3]} tone="text-ink-400">
        stamen = anther + filament
      </ToggleLabel>
    </group>
  );
}

function Stigma({ insect, landed, parts, mats }) {
  const part = insect ? parts.stigmaSticky : parts.stigmaFeathery;
  return (
    <group position={[0, STIGMA_Y, 0]}>
      {part && <mesh geometry={part.geometry} material={insect ? mats.wet : mats.tissue} />}
      <ToggleLabel position={[1.05, insect ? 0.5 : 1.05, 0.2]} tone="text-lime-300" accent={landed}>
        {landed ? `stigma · pollinated` : insect ? "stigma · sticky, inside the flower" : "stigma · feathery, sieves the air"}
      </ToggleLabel>
    </group>
  );
}

/** The grain that lands; the tube grows out of it. */
function LandedGrain({ landing, germination, geometry, material, colour }) {
  const scale = 0.06 * smoothstep(landing);
  if (landing <= 0) return null;
  return (
    <group position={[0, STIGMA_Y + M.stigmaTop + 0.03, -0.04]}>
      <mesh geometry={geometry} scale={scale * (1 + 0.15 * germination)}>
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.3} roughness={0.5} vertexColors />
      </mesh>
      {landing >= 1 && germination < 1 && (
        <ToggleLabel position={[-0.95, 0.35, 0.2]} tone="text-amber-200">
          {germination > 0 ? "grain hydrates · tube emerges" : "pollen grain · landed"}
        </ToggleLabel>
      )}
    </group>
  );
}

/** A cell of the embryo sac: a pale, translucent cell with its nucleus. */
function SacCell({ position, radius, colour, glow = 0.45, nucleus = true }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 16, 12]} />
        <meshPhysicalMaterial color={COLOURS.sacCell} roughness={0.3} transparent opacity={0.55} depthWrite={false} clearcoat={0.6} />
      </mesh>
      {nucleus && (
        <mesh>
          <sphereGeometry args={[radius * 0.45, 12, 10]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={glow} />
        </mesh>
      )}
    </group>
  );
}

/**
 * The contents of the opened embryo sac: egg apparatus at the micropylar
 * end (an egg flanked by two synergids), two polar nuclei in the central
 * cell, three antipodals at the far end. They change as fertilisation runs.
 */
function EmbryoSac({ ovule, primary, describe }) {
  const { centre, rx, ry } = ovule;
  const z = describe?.zygoteFormed && primary;
  const e = describe?.endospermFormed && primary;
  const entered = primary && describe?.entry > 0;
  const sy = ry * 0.62;
  const cz = -0.045;
  return (
    <group position={[centre[0], centre[1] + 0.03 * ry, centre[2]]}>
      {[-1, 1].map((s) => (
        <SacCell key={s} position={[s * rx * 0.2, sy * 0.72, cz]} radius={rx * 0.15} colour={COLOURS.synergid} glow={0.2} />
      ))}
      <SacCell position={[0, sy * 0.42, cz]} radius={z ? rx * 0.25 : rx * 0.21} colour={z ? COLOURS.zygote : COLOURS.egg} glow={z ? 1.0 : 0.45} />
      {e ? (
        <mesh position={[0, -0.02, cz]}>
          <sphereGeometry args={[rx * 0.3, 16, 12]} />
          <meshStandardMaterial color={COLOURS.endosperm} emissive={COLOURS.endosperm} emissiveIntensity={0.9} />
        </mesh>
      ) : (
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * rx * 0.13, -0.02, cz]}>
            <sphereGeometry args={[rx * 0.13, 12, 10]} />
            <meshStandardMaterial color={COLOURS.polar} emissive={COLOURS.polar} emissiveIntensity={0.5} />
          </mesh>
        ))
      )}
      {[-1, 0, 1].map((s) => (
        <SacCell key={s} position={[s * rx * 0.2, -sy * 0.75 + Math.abs(s) * 0.03, cz]} radius={rx * 0.11} colour={COLOURS.antipodal} glow={0.1} />
      ))}
      {z && <Halo position={[0, sy * 0.42, cz]} radius={0.2} color={COLOURS.zygote} opacity={0.18} />}
      {e && <Halo position={[0, -0.02, cz]} radius={0.24} color={COLOURS.endosperm} opacity={0.14} />}
      {primary && (
        <>
          {/* A column to the right of the ovary, spread wider than the ovule's
              own height so the three never overprint. */}
          <ToggleLabel position={[0.85, ry + 0.3, 0.2]} className="inline-block translate-x-1/2" tone={entered ? "text-amber-200" : "text-ink-400"}>
            {entered ? "micropyle · tube entering" : "micropyle"}
          </ToggleLabel>
          <ToggleLabel position={[0.85, ry * 0.3, 0.2]} className="inline-block translate-x-1/2" tone={z ? "text-amber-300" : "text-rose-300"} accent={z}>
            {z ? "zygote · 2n (sperm + egg)" : "egg cell · n"}
          </ToggleLabel>
          <ToggleLabel position={[0.85, -0.28, 0.2]} className="inline-block translate-x-1/2" tone={e ? "text-fuchsia-300" : "text-violet-300"} accent={e}>
            {e ? "endosperm · 3n (sperm + 2 polar nuclei)" : "2 polar nuclei · n + n"}
          </ToggleLabel>
        </>
      )}
      {!primary && (
        <ToggleLabel position={[-0.65, -ry - 0.3, 0.2]} tone="text-ink-400">
          second ovule
        </ToggleLabel>
      )}
    </group>
  );
}

function Carpel({ describe, parts, mats }) {
  return (
    <group>
      {parts.body && <mesh geometry={parts.body.geometry} material={mats.tissue} />}
      {parts.ovules && <mesh geometry={parts.ovules.geometry} material={mats.ovule} />}
      <EmbryoSac ovule={OVULE_A} primary describe={describe} />
      <EmbryoSac ovule={OVULE_B} primary={false} describe={describe} />
      <ToggleLabel position={[-1.65, 1.75, 0.3]} tone="text-emerald-300">
        ovary · cut open
      </ToggleLabel>
      <ToggleLabel position={[1.95, -0.6, 0.4]} tone="text-ink-400">
        carpel = stigma + style + ovary
      </ToggleLabel>
      <ToggleLabel position={[-1.05, 3.15, 0.2]} tone="text-ink-300">
        style · cut lengthways
      </ToggleLabel>
      <ToggleLabel position={[-1.55, -0.45, 0.4]} tone="text-ink-400">
        receptacle
      </ToggleLabel>
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
      <mesh ref={meshRef} geometry={path.geometry} renderOrder={2}>
        <meshStandardMaterial color={COLOURS.tube} emissive={COLOURS.tube} emissiveIntensity={0.5} roughness={0.35} transparent opacity={0.92} toneMapped={false} />
      </mesh>
      {[
        [tubeNucleus, COLOURS.tubeNucleus, 0.052],
        [generative, COLOURS.generative, 0.046],
        [sperm1, COLOURS.sperm, 0.042],
        [sperm2, COLOURS.sperm, 0.042],
      ].map(([ref, colour, r], i) => (
        <mesh key={i} ref={ref} visible={false} renderOrder={3}>
          <sphereGeometry args={[r, 12, 10]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      ))}
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
      <ToggleLabel position={[0, 6.55, 0]} accent={describe.pollinated}>
        {describe.pollinated ? "POLLINATION ✓ · pollen on the stigma" : "POLLINATION · pollen must reach the stigma"}
      </ToggleLabel>
      <ToggleLabel position={[0, 6.15, 0]} tone={tone} accent={describe.fertilised}>
        {describe.fertilised ? "FERTILISATION ✓ · nuclei fused in the ovule" : describe.pollinated ? "FERTILISATION · not yet — the tube is still growing" : "FERTILISATION · fusion of nuclei, in the ovule, hours later"}
      </ToggleLabel>
    </group>
  );
}

/** Everything built from the model: it suspends while the GLB loads, the labels above do not. */
function FlowerModel({ vector, describe, beeS, beeVisible, windRef, liveRef, path, speed }) {
  const parts = usePackedModel(FLOWER_GLB);
  const mats = useMaterials();
  const insect = vector.key === "insect";
  const pollen = (insect ? parts.pollenSpiky : parts.pollenSmooth)?.geometry;
  return (
    <group>
      <Carpel describe={describe} parts={parts} mats={mats} />
      {insect && <Nectary parts={parts} mats={mats} />}
      <Perianth insect={insect} parts={parts} mats={mats} />
      <Stamens insect={insect} parts={parts} mats={mats} pollen={pollen} />
      <Stigma insect={insect} landed={describe.pollinated} parts={parts} mats={mats} />
      {pollen && <LandedGrain landing={describe.landing} germination={describe.germination} geometry={pollen} colour={insect ? COLOURS.pollenInsect : COLOURS.pollenWind} />}
      <PollenTube path={path} liveRef={liveRef} vectorKey={vector.key} />
      {insect ? (
        <Bee s={beeS} visible={beeVisible} parts={parts} mats={mats} speed={speed} />
      ) : (
        pollen && (
          <>
            <WindPollen densityRef={windRef} geometry={pollen} material={mats.pollen} speed={speed} />
            <WindStreaks densityRef={windRef} speed={speed} />
          </>
        )
      )}
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function FlowerPollinationCanvas({ params = {}, setParam }) {
  const { vector: vectorKey = "insect", pollinate = 0, time = 0, speed = 1, showLabels = true } = params || {};
  const vector = vectorFor(vectorKey);
  const live = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const describe = useMemo(() => describePollination(snapshot ? snapshot.t : Number(time) || 0, vector.key), [snapshot, time, vector.key]);

  const path = useDisposedTubePath();

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
      controls={{ minDistance: 3, maxDistance: 28, maxPolarAngle: Math.PI * 0.52 }}
      lights={{ ambient: 0.55, keyLight: 1.25, rim: PALETTE.emerald }}
    >
      <FitCamera view={FLOWER_VIEW} direction={[0.04, 0.12, 1]} fov={42} />
      <EnableLocalClipping />
      <hemisphereLight args={["#f3f7ff", "#2f3b22", 0.55]} />
      {/* A soft light from the front, so the cut faces read as moist tissue. */}
      <directionalLight position={[1.5, 3, 8]} intensity={0.55} color="#fff6ea" />
      <LabelsOn.Provider value={showLabels !== false}>
        <TimelineDriver timeline={POLLINATION_TIMELINE} trigger={pollinate} speed={speed} live={live} scrub={scrub} onTick={setSnapshot} />

        <Suspense fallback={null}>
          <FlowerModel vector={vector} describe={describe} beeS={beeS} beeVisible={beeVisible} windRef={windRef} liveRef={live} path={path} speed={Number(speed) || 0} />
        </Suspense>
        <GrowthGauge describe={describe} />

        {describe.nuclei.tube !== null && (
          <ToggleLabel position={[-1.7, Math.max(2.45, lerp(STYLE.top, STYLE.bottom, clamp(describe.tubeFraction, 0, 1)) + 0.1), 0.3]} tone="text-sky-300">
            {describe.nuclei.divided ? "tube nucleus + 2 sperm nuclei (n)" : "tube nucleus + generative nucleus"}
          </ToggleLabel>
        )}
        {describe.nuclei.divided && describe.fertilisation === 0 && (
          <ToggleLabel position={[1.75, 3.35, 0.3]} tone="text-rose-300">
            generative nucleus divided → 2 sperm
          </ToggleLabel>
        )}

        <Verdict describe={describe} />
        <TimelineCaption position={[0, -1.75, 0.5]} timeline={POLLINATION_TIMELINE} snapshot={snapshot} idle="press Trigger pollination — or drag the time slider" />
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}
