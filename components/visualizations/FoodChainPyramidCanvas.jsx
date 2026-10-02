"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PALETTE, Callout, FitCamera, LabelsOn, SceneCanvas, ToggleLabel, clamp, hashRandom } from "@/components/visualizations/scene-kit";
import { FluxStream, SunSource } from "@/components/visualizations/ecosystem-diorama";
import { LogTierBars } from "@/components/visualizations/flux-chart";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { FOOD_CHAIN_MODEL } from "@/components/visualizations/food-chain-model-meta";
import { NEXT_LINK, TIERS, TOXIN_HARM_PPM, TOXIN_LETHAL_PPM, TRANSFER_EFFICIENCY, TRANSFER_LOSS, solveFoodChain } from "@/lib/foodChain";

// ─── Food chain & energy pyramid ────────────────────────────────────
// A stepped pyramid on a patch of oak-wood floor, one terrace per trophic
// level, built against a common back wall so every step faces the camera.
// On each step stand that level's organisms, all modelled in-house in
// Blender (scripts/ecosystem-model → public/models/food-chain.glb): oak
// shoots, looping winter-moth caterpillars, blue tits, and one
// sparrowhawk on a fallen log. Terrace WIDTH is on a log scale (it has to
// be — 10 000 : 10 cannot be drawn); the honest numbers are on the chart
// and in the callouts.
//
// The energy is a gold ribbon climbing the middle of the steps, pulsing
// upwards, narrowing at every riser: the 10 % passed on. From every step
// rises a plume of warm haze: the 90 % respired as heat, spent, or left
// uneaten — none of it available to the level above.
//
// `lib/foodChain.js` is steady state; the scene eases its terrace widths
// and headcounts towards the model's equilibrium, so a spray or a removal
// plays out as a change rather than a cut.
// ─────────────────────────────────────────────────────────────────────

const FOOD_GLB = "/models/food-chain.glb";

const TIER_H = 0.85;
/** Terrace depths front to back; all share the back wall at Z_BACK. */
const DEPTHS = [5.0, 3.7, 2.45, 1.6];
const Z_BACK = -2.1;
const PYRAMID_X = -0.6;
const SUN = { position: [-6.0, 7.6, -4.6] };
const CHART = { position: [4.4, 0.05, -1.9], width: 4.0, height: 3.0 };
const FLOOR = { centre: [0.9, 0, -0.4], radius: 7.2 };
/** The pyramid, the chart at its right, the sun and the ghost of a fifth link above. */
const FOOD_VIEW = { cx: 0.6, cy: 2.7, width: 15.5, height: 8.6, depth: 6 };
const TIER_LABEL_X = PYRAMID_X - 4.7;
const TIER_FAN = 0.55;

const COLOURS = {
  energy: PALETTE.gold,
  heat: "#fb923c",
  heatFar: PALETTE.rose,
  toxin: "#d946ef",
  toxinLethal: "#7e22ce",
  dead: "#7c8597",
  ghost: "#94a3b8",
  moss: "#34472a",
  soil: "#4a3627",
};

/** Terrace width from stored energy: log scale, so every tenth is one equal step in. */
const tierWidth = (kj) => (kj <= 0 ? 1.4 : 2.0 + 1.35 * Math.log10(kj + 1));
const tierTop = (i) => (i + 1) * TIER_H;
const zFront = (i) => Z_BACK + DEPTHS[i];
/** The part of a terrace not covered by the one above: its front step. */
const stepZ = (i) => [i + 1 < DEPTHS.length ? zFront(i + 1) : Z_BACK, zFront(i)];

/**
 * How each level's organisms are drawn. `per` individuals per model;
 * `scale` turns the model's centimetres into scene units.
 */
const HERDS = {
  producers: { node: "sprig", per: 25000, max: 22, scale: 0.056, margin: 0.4, inset: [0.18, 0.12] },
  primary: { node: "caterpillar", per: 200, max: 26, scale: 0.2, margin: 0.3, inset: [0.15, 0.15] },
  secondary: { node: "blueTit", per: 1, max: 32, scale: 0.058, margin: 0.35, inset: [0.12, 0.2] },
  apex: { node: "hawk", per: 1, max: 2, scale: 0.05, margin: 0.6, inset: [0.3, 0.3] },
};
const visualCount = (tier) => {
  const v = HERDS[tier.key];
  // A poisoned sparrowhawk is shown fallen on its log, not simply gone.
  if (tier.key === "apex" && tier.toxinStatus === "lethal") return 1;
  return clamp(Math.round(tier.population / v.per), tier.population > 0 ? 1 : 0, v.max);
};

/** The ribbon's width for a level's stored energy (log, like the terraces). */
const ribbonWidth = (kj) => (kj <= 0 ? 0 : 0.12 + 0.13 * Math.log10(kj + 1));

/** Share of a level's heat-plume particles alive, from the energy it loses. */
const heatShare = (kj) => (kj <= 0 ? 0 : clamp(0.2 + 0.2 * Math.log10(kj + 1), 0, 1));

// ─── Shared GLSL ────────────────────────────────────────────────────

const NOISE = /* glsl */ `
float fcHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fcNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fcHash(i), fcHash(i + vec2(1, 0)), f.x), mix(fcHash(i + vec2(0, 1)), fcHash(i + vec2(1, 1)), f.x), f.y);
}
float fcFbm(vec2 p) { return 0.55 * fcNoise(p) + 0.3 * fcNoise(p * 2.1 + 3.7) + 0.15 * fcNoise(p * 4.3 + 9.1); }
`;

// ─── Ground ─────────────────────────────────────────────────────────

/** A round patch of oak-wood floor: leaf litter, moss and bare earth, with a cut earth rim. */
function ForestFloor() {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vFloor;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFloor = position.xy;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nvarying vec2 vFloor;\n${NOISE}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float big = fcFbm(vFloor * 0.35);
          float litter = fcFbm(vFloor * 4.5 + 4.0);
          float fleck = fcNoise(vFloor * 16.0);
          vec3 earth = vec3(0.13, 0.09, 0.06);
          vec3 leafBrown = vec3(0.25, 0.16, 0.08);
          vec3 leafGold = vec3(0.36, 0.25, 0.11);
          vec3 moss = vec3(0.14, 0.2, 0.08);
          vec3 c = mix(earth, leafBrown, smoothstep(0.3, 0.7, litter));
          c = mix(c, leafGold, smoothstep(0.78, 0.95, fleck) * 0.5);
          c = mix(c, moss, smoothstep(0.45, 0.75, big) * 0.45);
          float r = length(vFloor) / ${FLOOR.radius.toFixed(2)};
          c *= 0.78 + 0.22 * smoothstep(1.0, 0.6, r);
          diffuseColor.rgb = c;`,
        );
    };
    return m;
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  const [cx, , cz] = FLOOR.centre;
  return (
    <group position={[cx, 0, cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={material} receiveShadow>
        <circleGeometry args={[FLOOR.radius, 96]} />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[FLOOR.radius, FLOOR.radius * 0.97, 0.9, 96, 1, true]} />
        <meshStandardMaterial color="#3b2a1e" roughness={1} />
      </mesh>
      <mesh position={[0, -0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[FLOOR.radius * 0.97, 96]} />
        <meshStandardMaterial color="#21170f" roughness={1} />
      </mesh>
    </group>
  );
}

// ─── The terraces ───────────────────────────────────────────────────

const SLAB_CORE = 0.4;

/**
 * One terrace: a rounded block whose width eases towards the model's. The
 * geometry is built once at SLAB_CORE wide and stretched in the vertex
 * shader (every vertex moves out by the same amount on its own side), so
 * the rounded edges keep their radius at any width. Its sides carry the
 * level's colour in bands of strata; its top is moss and litter, with a
 * bright lip in the level's colour.
 */
function Terrace({ tier, widthRef }) {
  const i = tier.level;
  const depth = DEPTHS[i];
  const geometry = useMemo(() => new RoundedBoxGeometry(SLAB_CORE, TIER_H - 0.02, depth, 3, 0.12), [depth]);
  const uniforms = useMemo(
    () => ({
      uExtra: { value: 0 },
      uSide: { value: new THREE.Color() },
      uTop: { value: new THREE.Color() },
      uLip: { value: new THREE.Color() },
      uHalf: { value: new THREE.Vector3(SLAB_CORE / 2, (TIER_H - 0.02) / 2, depth / 2) },
      uGhost: { value: 0 },
      uSeed: { value: i * 7.3 },
    }),
    [depth, i],
  );
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uExtra;\nvarying vec3 vObjP;\nvarying vec3 vObjN;")
        .replace(
          "#include <begin_vertex>",
          `vec3 transformed = position;
          transformed.x += sign(position.x) * uExtra;
          vObjP = transformed;
          vObjN = normal;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nuniform vec3 uSide;\nuniform vec3 uTop;\nuniform vec3 uLip;\nuniform vec3 uHalf;\nuniform float uExtra;\nuniform float uGhost;\nuniform float uSeed;\nvarying vec3 vObjP;\nvarying vec3 vObjN;\n${NOISE}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float up = smoothstep(0.55, 0.9, vObjN.y);
          // Sides: the level's colour in soft strata, darker towards the foot.
          float strata = 0.94 + 0.06 * sin(vObjP.y * 30.0 + fcNoise(vObjP.xz * 2.0 + uSeed) * 2.0);
          float foot = 0.7 + 0.3 * smoothstep(-uHalf.y, uHalf.y, vObjP.y);
          vec3 side = uSide * strata * foot * (0.96 + 0.04 * fcNoise(vObjP.xy * 6.0 + uSeed));
          // Top: moss and litter, tinted by the level.
          float n = fcFbm(vObjP.xz * 3.2 + uSeed);
          vec3 top = mix(uTop * 0.8, uTop * 1.1, n);
          top = mix(top, vec3(0.2, 0.14, 0.08), smoothstep(0.6, 0.8, fcNoise(vObjP.xz * 6.0 + uSeed)) * 0.5);
          // A band of the level's colour round the top of the sides.
          float band = smoothstep(uHalf.y - 0.25, uHalf.y - 0.22, vObjP.y) * (1.0 - smoothstep(uHalf.y - 0.05, uHalf.y - 0.02, vObjP.y));
          side = mix(side, uLip * (0.9 + 0.1 * fcNoise(vObjP.xz * 8.0)), band);
          vec3 c = mix(side, top, up);
          diffuseColor.rgb = mix(c, vec3(0.55, 0.6, 0.68), uGhost);
          diffuseColor.a = mix(1.0, 0.2, uGhost);`,
        );
    };
    return m;
  }, [uniforms]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const target = tierWidth(tier.energyKJ);
  const empty = tier.energyKJ <= 0;
  useEffect(() => {
    const base = new THREE.Color(tier.colour);
    const side = new THREE.Color(COLOURS.soil).lerp(base, 0.12);
    const top = new THREE.Color(COLOURS.moss).lerp(base, 0.12);
    const lip = base.clone().multiplyScalar(0.85);
    const tox = tier.toxinStatus;
    const k = tox === "lethal" ? 0.65 : tox === "harmed" ? 0.42 : tox === "trace" ? 0.14 : 0;
    const tc = new THREE.Color(tox === "lethal" ? COLOURS.toxinLethal : COLOURS.toxin);
    uniforms.uSide.value.copy(side.lerp(tc, k));
    uniforms.uTop.value.copy(top.lerp(tc, k * 0.6));
    uniforms.uLip.value.copy(lip.lerp(tc, k));
    uniforms.uGhost.value = empty ? 1 : 0;
    material.transparent = empty;
    material.depthWrite = !empty;
    material.needsUpdate = true;
  }, [tier.colour, tier.toxinStatus, empty, uniforms, material]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    widthRef.current += (target - widthRef.current) * (1 - Math.exp(-dt * 3));
    if (Math.abs(target - widthRef.current) < 0.005) widthRef.current = target;
    uniforms.uExtra.value = Math.max(0, (widthRef.current - SLAB_CORE) / 2);
  });

  return <mesh geometry={geometry} material={material} position={[PYRAMID_X, tierTop(i) - TIER_H / 2, Z_BACK + depth / 2]} castShadow receiveShadow />;
}

// ─── Organisms ──────────────────────────────────────────────────────

/**
 * Seats on a step, in step coordinates (u across, -½..½; v from the back of
 * the step to its front, 0..1), by Mitchell's best candidate: each new seat
 * is the one of a dozen candidates furthest from those already placed, so
 * the first n seats cover the step evenly for every n. A strip down the
 * middle is kept clear for the energy ribbon.
 */
function useSeats(max, seed, aspect, fixed, sideways = false) {
  return useMemo(() => {
    if (fixed) return fixed.slice(0, max).map((s, i) => ({ ...s, heading: s.heading ?? 0, scale: 1, phase: i * 0.37 }));
    const seats = [];
    let k = 0;
    while (seats.length < max && k < max * 60) {
      let best = null;
      let bestD = -1;
      for (let c = 0; c < 14; c += 1) {
        k += 1;
        const u = hashRandom(seed + k * 1.37) - 0.5;
        const v = hashRandom(seed * 3.1 + k * 2.71);
        if (Math.abs(u) < 0.06) continue;
        let d = Infinity;
        for (const s of seats) d = Math.min(d, Math.hypot((s.u - u) * aspect, s.v - v));
        if (d > bestD) {
          bestD = d;
          best = { u, v };
        }
      }
      if (!best) continue;
      const i = seats.length;
      seats.push({
        ...best,
        // Birds face the viewer, more or less, in three-quarter; loopers
        // walk across the step, so their arching is seen in profile.
        heading: sideways ? (hashRandom(seed * 5 + i) < 0.5 ? 0 : Math.PI) + (hashRandom(seed * 7 + i * 0.7) - 0.5) * 0.7 : -Math.PI / 2 + (hashRandom(seed * 7 + i * 0.7) - 0.5) * 2.4,
        scale: 0.86 + 0.28 * hashRandom(seed * 11 + i * 1.3),
        phase: hashRandom(seed * 13 + i * 2.1) * Math.PI * 2,
      });
    }
    return seats;
  }, [max, seed, aspect, fixed, sideways]);
}

/** Leaves sway in the wind: each vertex moves by its height in the shoot, in step with its own instance's phase. */
function swayMaterial(timeRef) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeRef;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
      #else
        float ph = 0.0;
      #endif
      float h = max(position.y - 2.0, 0.0);
      transformed.x += sin(uTime * 1.4 + ph) * 0.018 * h * h * 0.1;
      transformed.z += cos(uTime * 1.1 + ph * 1.3) * 0.012 * h * h * 0.1;`,
    );
  };
  return m;
}

const DEAD = new THREE.Color(COLOURS.dead);
const ALIVE = new THREE.Color("#ffffff");

/**
 * The individuals of one level, instanced on its front step and eased
 * towards `count`. Seats are held in step coordinates, so the organisms
 * spread out as the terrace widens (a cascade) and bunch as it narrows.
 */
function Herd({ part, tier, count, widthRef, speedRef, timeRef, dead }) {
  const cfg = HERDS[tier.key];
  const i = tier.level;
  const [z0, z1] = stepZ(i);
  const meshRef = useRef(null);
  const state = useRef({ shown: 0, dummy: new THREE.Object3D(), morph: { morphTargetInfluences: [0] }, lastDead: null, pivot: new THREE.Vector3() });
  const aspect = (tierWidth(10000 / 10 ** i) - 2 * cfg.margin) / Math.max(z1 - z0, 0.1);
  const fixed = useMemo(() => (tier.key === "apex" ? [{ u: 0.08, v: 0.58, heading: -Math.PI / 2 + 0.75 }, { u: -0.24, v: 0.45, heading: -Math.PI / 2 - 0.6 }] : null), [tier.key]);
  const seats = useSeats(cfg.max, 11 + i * 7, aspect, fixed, cfg.node === "caterpillar");
  const kind = cfg.node;
  const material = useMemo(() => (kind === "sprig" ? swayMaterial(timeRef) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kind === "hawk" ? 0.7 : 0.6 })), [kind, timeRef]);
  useEffect(() => () => material.dispose(), [material]);
  const hasMorph = kind === "caterpillar" && part.geometry.morphAttributes.position?.length > 0;

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const s = state.current;
    const dt = Math.min(rawDelta, 1 / 30);
    const target = clamp(count, 0, seats.length);
    s.shown += (target - s.shown) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(target - s.shown) < 0.02) s.shown = target;
    const t = timeRef.value;
    const width = widthRef.current;
    const usable = Math.max(width - 2 * cfg.margin, 0.2);
    const d = s.dummy;
    d.rotation.order = "YXZ";
    for (let k = 0; k < seats.length; k += 1) {
      const seat = seats[k];
      const sc = clamp(s.shown - k, 0, 1) * seat.scale * cfg.scale;
      let y = tierTop(i);
      let pitch = 0;
      let roll = 0;
      let heading = seat.heading;
      const zz = z0 + cfg.inset[0] + seat.v * Math.max(z1 - z0 - cfg.inset[0] - cfg.inset[1], 0.01);
      if (kind === "blueTit" && !dead) {
        // Short hops and pecks, each bird on its own clock.
        const hop = Math.max(0, Math.sin(t * 2.2 + seat.phase)) ** 6;
        y += 0.07 * hop;
        pitch = -0.45 * Math.max(0, Math.sin(t * 1.3 + seat.phase * 1.7)) ** 10;
        heading += 0.5 * Math.sin(t * 0.35 + seat.phase);
      } else if (kind === "blueTit" && dead) {
        roll = 1.45;
        y -= 0.05;
      } else if (kind === "hawk") {
        // Its log is below its feet in the model: lift it onto the terrace.
        y += 2 * FOOD_CHAIN_MODEL.logRadius * sc;
        if (dead) pitch = 1.45;
        else heading += 0.12 * Math.sin(t * 0.4 + seat.phase);
      }
      d.position.set(PYRAMID_X + seat.u * usable, y, zz);
      d.rotation.set(roll, heading, pitch);
      if (kind === "hawk" && dead) {
        // Fallen backwards off its perch: turned about the log's own axis.
        s.pivot.set(0.4 * sc, -FOOD_CHAIN_MODEL.logRadius * sc, 0);
        d.position.add(s.pivot).sub(s.pivot.applyEuler(d.rotation));
      }
      d.scale.setScalar(sc);
      d.updateMatrix();
      mesh.setMatrixAt(k, d.matrix);
      if (hasMorph) {
        // A looper: it arches its back to bring its rear prolegs up to its true legs.
        const cyc = 0.5 - 0.5 * Math.cos(t * 1.6 + seat.phase);
        s.morph.morphTargetInfluences[0] = dead ? 0 : cyc;
        mesh.setMorphAt(k, s.morph);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (hasMorph && mesh.morphTexture) mesh.morphTexture.needsUpdate = true;
    if (s.lastDead !== dead) {
      s.lastDead = dead;
      for (let k = 0; k < seats.length; k += 1) mesh.setColorAt(k, dead ? DEAD : ALIVE);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return <instancedMesh ref={meshRef} args={[part.geometry, material, seats.length]} frustumCulled={false} castShadow receiveShadow />;
}

// ─── The flows ──────────────────────────────────────────────────────

/**
 * The energy: one gold ribbon up the middle of the steps, from the front of
 * the producers' terrace to the sparrowhawk's. It lies on each step and
 * stands against each riser, and it narrows at every riser — the 10 %
 * passed on. Pulses run up it; `s` (arc length) drives them.
 */
function EnergyRibbon({ pyramid, timeRef }) {
  const { geometry, risers } = useMemo(() => {
    const pts = [];
    const lift = 0.018;
    const add = (y, z, w) => pts.push({ y, z, w });
    const risersOut = [];
    for (let i = 0; i < TIERS.length; i += 1) {
      const w = ribbonWidth(pyramid.tiers[i].energyKJ);
      const yTop = tierTop(i) + lift;
      const [zb, zf] = stepZ(i);
      if (i === 0) add(yTop, zf - 0.02, w);
      if (i + 1 < TIERS.length) {
        const wNext = ribbonWidth(pyramid.tiers[i + 1].energyKJ);
        add(yTop, zb + lift, w);
        // Up the riser, narrowing from this level's width to the next's.
        add(yTop + 0.05, zb + lift, wNext);
        add(tierTop(i + 1) - 0.02, zb + lift, wNext);
        risersOut.push({ y: (tierTop(i) + tierTop(i + 1)) / 2, z: zb + 0.05, w: wNext, i });
      } else {
        add(yTop, zf - 0.3, w);
      }
    }
    const pos = [];
    const sArr = [];
    const idx = [];
    let s = 0;
    for (let k = 0; k < pts.length; k += 1) {
      const p = pts[k];
      if (k > 0) s += Math.hypot(p.y - pts[k - 1].y, p.z - pts[k - 1].z);
      pos.push(PYRAMID_X - p.w / 2, p.y, p.z, PYRAMID_X + p.w / 2, p.y, p.z);
      sArr.push(s, s);
      if (k > 0) {
        const a = (k - 1) * 2;
        idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aS", new THREE.Float32BufferAttribute(sArr, 1));
    g.setIndex(idx);
    return { geometry: g, risers: risersOut };
  }, [pyramid]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: timeRef, uColour: { value: new THREE.Color(COLOURS.energy) } },
        vertexShader: /* glsl */ `
          attribute float aS;
          varying float vS;
          varying float vX;
          void main() {
            vS = aS;
            vX = position.x;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColour;
          varying float vS;
          void main() {
            float pulse = pow(0.5 + 0.5 * sin((vS * 3.2 - uTime * 2.4)), 6.0);
            vec3 c = uColour * (0.75 + 1.1 * pulse);
            gl_FragColor = vec4(c, 0.78 + 0.2 * pulse);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [timeRef],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      <mesh geometry={geometry} material={material} renderOrder={2} />
      {risers.map((r) => (
        <ToggleLabel key={r.i} position={[PYRAMID_X + r.w / 2 + 0.42, r.y, r.z + 0.1]} tone="text-amber-200">
          {`×${TRANSFER_EFFICIENCY} · ${Math.round(TRANSFER_EFFICIENCY * 100)} % up`}
        </ToggleLabel>
      ))}
    </group>
  );
}

const HEAT_COUNT = 60;

/**
 * The 90 %: warm haze rising off a step and fading — respiration heat, and
 * by extension everything that never reaches the level above. Each particle
 * lives on its own clock; `uShare` of them are alive, from the energy lost.
 */
function HeatPlume({ level, widthRef, share, timeRef }) {
  const size = useThree((st) => st.size);
  const camera = useThree((st) => st.camera);
  const gl = useThree((st) => st.gl);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(HEAT_COUNT * 3);
    for (let k = 0; k < HEAT_COUNT; k += 1) {
      seeds[k * 3] = hashRandom(level * 31 + k * 1.31);
      seeds[k * 3 + 1] = hashRandom(level * 17 + k * 2.17);
      seeds[k * 3 + 2] = hashRandom(level * 7 + k * 3.7);
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(HEAT_COUNT * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
    return g;
  }, [level]);
  const [z0, z1] = stepZ(level);
  const uniforms = useMemo(
    () => ({
      uTime: timeRef,
      uShare: { value: 0 },
      uWidth: { value: 4 },
      uX: { value: PYRAMID_X },
      uTop: { value: tierTop(level) },
      uZ: { value: new THREE.Vector2(z0, z1) },
      uRise: { value: 2.3 - level * 0.25 },
      uScale: { value: 400 },
      uNear: { value: new THREE.Color(COLOURS.heat) },
      uFar: { value: new THREE.Color(COLOURS.heatFar) },
    }),
    [timeRef, level, z0, z1],
  );
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          attribute vec3 aSeed;
          uniform float uTime, uShare, uWidth, uX, uTop, uRise, uScale;
          uniform vec2 uZ;
          varying float vAlpha;
          varying float vLife;
          void main() {
            float life = fract(aSeed.z + uTime * (0.16 + 0.1 * aSeed.x));
            float alive = step(fract(aSeed.x * 13.17 + aSeed.y * 3.1), uShare);
            float sway = 0.18 * sin(life * 5.0 + aSeed.y * 19.0) * life;
            vec3 p = vec3(uX + (aSeed.x - 0.5) * uWidth + sway, uTop + 0.05 + life * uRise, mix(uZ.x, uZ.y, aSeed.y));
            vAlpha = alive * smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.55, 1.0, life));
            vLife = life;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (0.6 + 1.0 * life) * uScale / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uNear, uFar;
          varying float vAlpha;
          varying float vLife;
          void main() {
            float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
            gl_FragColor = vec4(mix(uNear, uFar, smoothstep(0.2, 0.9, vLife)), a * a * a * vAlpha * 0.16);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [uniforms],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(() => {
    uniforms.uWidth.value = Math.max(widthRef.current - 0.5, 0.3);
    uniforms.uShare.value += (share - uniforms.uShare.value) * 0.05;
    uniforms.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  });
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}

/**
 * The textbook's wavy "heat" arrows: from each step a few squiggles leave
 * the pyramid, up and outwards, with dashes running along them — energy
 * respired as heat, and with it the 90 % that never reaches the level
 * above. Fewer leave the narrower steps, as less is lost there.
 */
function HeatArrows({ level, width, share, timeRef }) {
  const [zb, zf] = stepZ(level);
  const geometry = useMemo(() => {
    const n = share <= 0 ? 0 : Math.max(1, Math.round(1 + 4 * share));
    const parts = [];
    for (let k = 0; k < n; k += 1) {
      const side = k % 2 === 0 ? 1 : -1;
      const along = Math.floor(k / 2);
      const x0 = PYRAMID_X + side * Math.max(width / 2 - 0.3 - along * 0.45, 0.4);
      const z0 = zb + (zf - zb) * (0.3 + 0.4 * hashRandom(level * 9 + k));
      const start = new THREE.Vector3(x0, tierTop(level) + 0.12, z0);
      const dir = new THREE.Vector3(side * (0.55 + 0.15 * along), 1, 0.12).normalize();
      const perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
      const L = 1.25 + 0.25 * hashRandom(level * 3 + k * 5);
      const pts = [];
      for (let j = 0; j <= 48; j += 1) {
        const t = j / 48;
        pts.push(start.clone().addScaledVector(dir, t * L).addScaledVector(perp, 0.075 * Math.sin(t * L * 11 + k)));
      }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.022, 6, false));
    }
    if (!parts.length) return null;
    // One geometry per level: merge by hand (the tubes share attribute layouts).
    const g = new THREE.BufferGeometry();
    const pos = [];
    const nrm = [];
    const uv = [];
    const idx = [];
    let base = 0;
    for (const p of parts) {
      pos.push(...p.attributes.position.array);
      nrm.push(...p.attributes.normal.array);
      uv.push(...p.attributes.uv.array);
      for (const v of p.index.array) idx.push(v + base);
      base += p.attributes.position.count;
      p.dispose();
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }, [level, width, share, zb, zf]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: timeRef, uNear: { value: new THREE.Color(COLOURS.heat) }, uFar: { value: new THREE.Color(COLOURS.heatFar) } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uNear, uFar;
          varying vec2 vUv;
          void main() {
            float dash = smoothstep(0.35, 0.45, fract(vUv.x * 5.0 - uTime * 0.9));
            float fade = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.62, 1.0, vUv.x));
            gl_FragColor = vec4(mix(uNear, uFar, vUv.x) * 1.25, (0.35 + 0.65 * dash) * fade * 0.9);
          }`,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [timeRef],
  );
  useEffect(() => () => material.dispose(), [material]);
  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} renderOrder={3} />;
}

/** Soft shafts of sunlight slanting onto the producers' step, as bright as the insolation. */
function SunShafts({ intensity, timeRef }) {
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.5, 3.2, 1, 32, 1, true);
    g.translate(0, -0.5, 0);
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uK: { value: 1 }, uTime: timeRef },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vP;
          void main() { vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uK, uTime;
          varying vec2 vUv;
          varying vec3 vP;
          void main() {
            float along = -vP.y;
            float rays = 0.55 + 0.45 * sin(vUv.x * 6.2831 * 9.0 + sin(uTime * 0.3) * 0.6);
            float a = smoothstep(0.0, 0.25, along) * (1.0 - smoothstep(0.7, 1.0, along)) * rays;
            gl_FragColor = vec4(vec3(1.0, 0.92, 0.65), a * 0.075 * uK);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [timeRef],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  material.uniforms.uK.value = intensity;
  // From the sun to the middle of the producers' step.
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...SUN.position);
    const [zb, zf] = stepZ(0);
    const b = new THREE.Vector3(PYRAMID_X, tierTop(0), (zb + zf) / 2);
    const dir = b.clone().sub(a);
    return { position: a, quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize()), length: dir.length() };
  }, []);
  return <mesh geometry={geometry} material={material} position={position} quaternion={quaternion} scale={[1, length, 1]} renderOrder={1} />;
}

/** A spray of toxin falling on the leaves, for a couple of seconds after each press. */
function ToxinSpray({ doses, sprayRef }) {
  const last = useRef(doses);
  useFrame((_, rawDelta) => {
    if (doses !== last.current) {
      last.current = doses;
      if (doses > 0) sprayRef.current = 60;
    }
    sprayRef.current = Math.max(0, sprayRef.current - Math.min(rawDelta, 1 / 30) * 28);
  });
  const [zb, zf] = stepZ(0);
  return <FluxStream from={[PYRAMID_X, tierTop(0) + 3.4, (zb + zf) / 2]} to={[PYRAMID_X, tierTop(0) + 0.05, (zb + zf) / 2]} rateRef={sprayRef} colour={COLOURS.toxin} count={120} travel={1.1} lift={0} spread={3.2} size={0.04} seed={300} />;
}

/** The level that is not there: a dashed outline above the hawk's terrace. */
function FifthLink({ pyramid }) {
  const w = 1.6;
  const hw = w / 2;
  const hh = (TIER_H - 0.06) / 2;
  const hd = DEPTHS[TIERS.length - 1] / 2 - 0.15;
  const cy = tierTop(TIERS.length - 1) + 2.15 + hh;
  const cz = Z_BACK + DEPTHS[TIERS.length - 1] / 2;
  const box = useMemo(
    () => [
      [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd], [-hw, -hh, hd]],
      [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd], [-hw, -hh, -hd]],
      [[-hw, -hh, hd], [-hw, -hh, -hd]],
      [[hw, -hh, hd], [hw, -hh, -hd]],
      [[-hw, hh, hd], [-hw, hh, -hd]],
      [[hw, hh, hd], [hw, hh, -hd]],
    ],
    [hw, hh, hd],
  );
  return (
    <group position={[PYRAMID_X, cy, cz]}>
      {box.map((pts, i) => (
        <Line key={i} points={pts} color={COLOURS.ghost} lineWidth={1} dashed dashSize={0.12} gapSize={0.09} transparent opacity={0.55} />
      ))}
      <ToggleLabel position={[0, hh + 0.32, hd]} tone="text-ink-400">
        {`5th link? ${NEXT_LINK.organism} · would receive ${pyramid.nextLink.energyKJ.toFixed(1)} kJ · needs ${NEXT_LINK.kjPerIndividual} kJ · not viable`}
      </ToggleLabel>
    </group>
  );
}

function EnergyChart({ pyramid }) {
  const bars = pyramid.tiers.map((t) => ({
    key: t.key,
    label: t.organism.toLowerCase(),
    caption: t.population > 0 ? `${t.population.toLocaleString()}` : "—",
    value: t.energyKJ,
    ghost: t.level === 0 ? undefined : t.receivedKJ,
    ghostColour: COLOURS.heatFar,
    colour: t.energyKJ > 0 ? t.colour : COLOURS.ghost,
  }));
  return (
    <LogTierBars
      position={CHART.position}
      width={CHART.width}
      height={CHART.height}
      bars={bars}
      unit="kJ"
      floor={1}
      scaleMax={20000}
      lossLabel={(bar) => (bar.ghost > 0 ? `−${Math.round(TRANSFER_LOSS * 100)} %` : null)}
      format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v >= 10 ? Math.round(v).toString() : v.toFixed(1))}
      title="Energy stored per level · log scale · ghost = energy received"
      footnote={`${Math.round(TRANSFER_EFFICIENCY * 100)} % passed on at each link · ${pyramid.totalLostKJ.toLocaleString(undefined, { maximumFractionDigits: 0 })} kJ lost as heat & waste`}
    />
  );
}

function TierLabels({ tier, doses }) {
  const i = tier.level;
  const width = tierWidth(tier.energyKJ);
  const y = tierTop(i) - TIER_H / 2;
  const zf = zFront(i);
  const status = tier.toxinStatus;
  const energyText = tier.energyKJ <= 0 ? "0 kJ" : tier.energyKJ >= 100 ? `${Math.round(tier.energyKJ).toLocaleString()} kJ` : `${tier.energyKJ.toFixed(0)} kJ`;
  const pop = tier.population;
  const popText = pop === 0 ? (tier.removed ? (tier.toxinStatus === "lethal" ? "poisoned" : "removed") : `none — needs ${tier.kjPerIndividual} kJ each`) : `${pop.toLocaleString()} ${pop === 1 ? tier.singular : tier.plural}`;
  return (
    <group>
      <Callout anchor={[PYRAMID_X - width / 2 + 0.05, y, zf]} at={[TIER_LABEL_X, y + (i - (TIERS.length - 1) / 2) * TIER_FAN, zf]} side="left" accent={pop > 0} tone={pop > 0 ? undefined : "text-rose-300"}>
        <span className="inline-block text-right leading-tight">
          <span className="text-ink-300">{tier.label}</span>
          <br />
          {`${energyText} · ${popText}`}
        </span>
      </Callout>
      {doses > 0 && (
        <ToggleLabel position={[PYRAMID_X + Math.max(width / 2 + 0.9, 2.4), y, zf]} tone={status === "lethal" || status === "harmed" ? "text-fuchsia-300" : "text-ink-400"}>
          {`${tier.toxinPpm < 1 ? tier.toxinPpm.toFixed(2) : tier.toxinPpm.toFixed(1)} ppm · ${tier.toxinLabel}`}
        </ToggleLabel>
      )}
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

function Organisms({ pyramid, widthRefs, timeRef }) {
  const parts = usePackedModel(FOOD_GLB);
  return pyramid.tiers.map((tier, i) => {
    const part = parts[HERDS[tier.key].node];
    if (!part) return null;
    return <Herd key={tier.key} part={part} tier={tier} count={visualCount(tier)} widthRef={widthRefs[i]} timeRef={timeRef} dead={tier.toxinStatus === "lethal"} />;
  });
}

/** Scene time, scaled by the speed control; every animated material reads it. */
function Clock({ timeRef, speed }) {
  useFrame((_, rawDelta) => {
    timeRef.value += Math.min(rawDelta, 1 / 20) * speed;
  });
  return null;
}

export default function FoodChainPyramidCanvas({ params = {} }) {
  const { insolation = 100, toxin = 0, cascade = 0, speed = 1, showLabels = true } = params || {};
  const pyramid = useMemo(() => solveFoodChain({ insolation: Number(insolation) || 100, toxinDoses: Number(toxin) || 0, cascadePresses: Number(cascade) || 0 }), [insolation, toxin, cascade]);

  // Terrace widths are eased in the scene, so the organisms and plumes need them each frame.
  const widthRefs = useMemo(() => TIERS.map((_, i) => ({ current: tierWidth(pyramid.tiers[i].energyKJ) })), []); // eslint-disable-line react-hooks/exhaustive-deps
  const timeRef = useMemo(() => ({ value: 0 }), []);
  const sprayRef = useRef(0);
  const sunK = clamp(insolation / 100, 0.5, 1.5);
  const apex = pyramid.tiers[TIERS.length - 1];

  return (
    <SceneCanvas camera={{ position: [1.8, 5.4, 16.2], fov: 42 }} controls={{ minDistance: 5, maxDistance: 34, maxPolarAngle: Math.PI * 0.48 }} lights={{ ambient: 0.25 + 0.15 * sunK, keyLight: 0.8 + 0.7 * sunK, rim: PALETTE.emerald }}>
      <FitCamera view={FOOD_VIEW} direction={[0.12, 0.42, 1]} fov={42} />
      <Clock timeRef={timeRef} speed={Number(speed) || 1} />
      <hemisphereLight args={["#dfe9ff", "#3a2a1a", 0.45]} />
      <LabelsOn.Provider value={showLabels !== false}>
        <SunSource position={SUN.position} intensity={sunK} radius={0.75} label={`sun · ${Math.round(insolation)} % insolation · ${pyramid.producerKJ.toLocaleString()} kJ fixed by the leaves`} />
        <SunShafts intensity={sunK} timeRef={timeRef} />
        <ForestFloor />

        {pyramid.tiers.map((tier, i) => (
          <group key={tier.key}>
            <Terrace tier={tier} widthRef={widthRefs[i]} />
            <HeatPlume level={i} widthRef={widthRefs[i]} share={heatShare(tier.energyKJ * TRANSFER_LOSS)} timeRef={timeRef} />
            <HeatArrows level={i} width={tierWidth(tier.energyKJ)} share={heatShare(tier.energyKJ * TRANSFER_LOSS)} timeRef={timeRef} />
            <TierLabels tier={tier} doses={pyramid.doses} />
          </group>
        ))}
        <Suspense fallback={null}>
          <Organisms pyramid={pyramid} widthRefs={widthRefs} timeRef={timeRef} />
        </Suspense>
        <EnergyRibbon pyramid={pyramid} timeRef={timeRef} />

        <FifthLink pyramid={pyramid} />
        <ToxinSpray doses={pyramid.doses} sprayRef={sprayRef} />
        <EnergyChart pyramid={pyramid} />

        <ToggleLabel position={[PYRAMID_X + tierWidth(pyramid.tiers[0].energyKJ) / 2 + 0.6, tierTop(1) + 2.3, 0.4]} tone="text-orange-300">
          90 % lost at each link · respiration heat · waste · uneaten
        </ToggleLabel>
        <ToggleLabel position={[PYRAMID_X + 0.6, -0.55, zFront(0) + 1.3]} tone="text-ink-400">
          {`chain length ${pyramid.chainLength} of ${TIERS.length} · the sparrowhawk gets ${(pyramid.apexShare * 100).toFixed(1)} % of what the leaves stored`}
        </ToggleLabel>
        {apex.removed && (
          <ToggleLabel position={[PYRAMID_X, tierTop(TIERS.length - 1) + 1.2, zFront(TIERS.length - 1)]} tone="text-rose-300">
            {apex.toxinStatus === "lethal" ? "sparrowhawk poisoned · trophic cascade" : "sparrowhawk removed · trophic cascade"}
          </ToggleLabel>
        )}
        {pyramid.doses > 0 && (
          <ToggleLabel position={[PYRAMID_X - 1.6, tierTop(0) + 4.25, 0.3]} tone="text-fuchsia-300">
            {`persistent toxin · ${pyramid.doses} ${pyramid.doses === 1 ? "spray" : "sprays"} · ×10 per link · birds harmed above ${TOXIN_HARM_PPM} ppm, killed above ${TOXIN_LETHAL_PPM} ppm`}
          </ToggleLabel>
        )}
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}

useGLTF.preload(FOOD_GLB);
