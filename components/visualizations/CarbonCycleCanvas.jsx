"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE, Callout, SceneCanvas, SceneLabel, clamp, hashRandom, FitCamera, LabelsOn, ToggleLabel } from "@/components/visualizations/scene-kit";
import { ECO_COLOURS, PhotonShower, SunSource } from "@/components/visualizations/ecosystem-diorama";
import { SignedFluxBars } from "@/components/visualizations/flux-chart";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { CARBON_CYCLE_MODEL } from "@/components/visualizations/carbon-cycle-model-meta";
import { BASELINE_FOREST_PCT, MAX_COMBUSTION_PCT, MAX_FOREST_PCT, MIN_FOREST_PCT, initialCarbonState, solarLabel, solveCarbon, stepCarbon } from "@/lib/carbonCycle";

// ─── The carbon cycle ───────────────────────────────────────────────
// A block of the Earth cut out like a museum diorama: woodland and pasture
// on the left, a coal-fired power station at the back, and the sea on the
// right behind a glass front, so its water column and the carbonate
// sediment on its floor show. The block's cut face shows the ground under
// the land — soil, rock, and a seam of coal: carbon that photosynthesis
// buried 300 million years ago, which the station mines out as it burns.
//
// Every carbon flow is a labelled arrow, as in a textbook figure, with
// pulses running along it: photosynthesis down into the trees,
// respiration and decay back up, the stacks' combustion, the pasture's
// land-use and methane, and the air↔sea exchange (which reverses when the
// air falls below the surface water). Arrow thickness goes with √flux, so
// the 9.5 GtC/yr of fossil fuel is still visible next to the 120 of
// photosynthesis, and the chart under the block adds them up.
//
// The air holds CO₂ and CH₄ molecules (O=C=O, and a carbon with four
// hydrogens), more of them as the ppm climbs; the greenhouse layer they
// make catches longwave photons when the photon filter is on.
//
// Every mesh that is a thing (trees, stumps, cows, the station) is ours,
// modelled in Blender by scripts/ecosystem-model → public/models/carbon-cycle.glb.
//
// This scene has a clock. `lib/carbonCycle.js` integrates the atmosphere
// at SIM_YEARS_PER_SECOND × speed; the ppm counter, the thermometer and
// the thickness of the greenhouse layer are all read off that state, and
// the HUD gets the same numbers ten times a second.
// ─────────────────────────────────────────────────────────────────────

const CARBON_GLB = "/models/carbon-cycle.glb";
const SIM_YEARS_PER_SECOND = 2;
const PUSH_EVERY_S = 0.1;

/** The block: x across, z front to back (+z towards the viewer), top at y = 0. */
const BLOCK = { x0: -7.5, x1: 7.5, z0: -4.5, z1: 4.5, depth: 2.4 };
/** The sea fills the block's right-hand end, down to its floor. */
const SEA = { x0: 2.4, surface: -0.18, floor: -1.7 };
/** The land the forest and pasture share; the forest grows from the back. */
const LAND = { x0: -7.1, x1: 2.0, z0: -4.1, z1: 4.1 };
/** The power station's footprint (kept clear of trees) and where it stands. */
const PLANT = { x: 1.05, z: -2.7, scale: 0.072, clear: { x0: -1.65, x1: 2.25, z0: -3.6, z1: -1.2 } };
/** The station's access road, from its yard to the front of the land, past the furnace door. */
const ROAD = { x0: 0.45, x1: 1.2 };
/** Strata on the cut face, as depths below the surface. */
const STRATA = { topsoil: -0.25, subsoil: -0.8, seamTop: -1.38, seamBottom: -1.78 };
const SUN = { position: [-7.4, 8.4, -4.2] };
const ENVELOPE_Y = 5.0;
const WATER_INSET = 0.02;
const ESCAPE_Y = 9.5;
const CHART = { position: [-4.6, -5.0, 5.2], width: 9.2, height: 2.0 };
const THERMO = { x: 8.55, z: 2.6, height: 3.2, maxC: 6 };
const TREE_SEATS = 46;
const COW_SEATS = 12;
/** The block, the air above it to the greenhouse layer, the chart below and the thermometer. */
const CARBON_VIEW = { cx: 0.5, cy: 0.4, width: 19.5, height: 16.6, depth: 9 };

const COLOURS = {
  photosynthesis: PALETTE.emerald,
  respiration: "#f59e0b",
  combustion: "#a3adbd",
  livestock: PALETTE.violet,
  ocean: PALETTE.sky,
  outgas: "#fb7185",
  net: PALETTE.gold,
  furnace: "#f97316",
  fence: "#9a7b55",
  carbonate: "#e0f2fe",
  warm: "#fb923c",
  carbon: "#3a3d44",
  oxygen: "#e5484d",
  hydrogen: "#f1f5f9",
};

/** Sunlight a warm white, its reflection paler; infrared red, and orange once caught and re-emitted. */
const PHOTON_COLOURS = { ...ECO_COLOURS, shortwave: "#ffe7a3", reflected: "#fff8e1", longwave: "#f43f5e", trapped: "#fb923c" };

/** Arrow radius for a flow in GtC/yr: √flux, so 1 and 120 are both visible. */
const arrowRadius = (gtc) => 0.03 + 0.0125 * Math.sqrt(Math.abs(gtc));

const NOISE = /* glsl */ `
float ccHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ccNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ccHash(i), ccHash(i + vec2(1, 0)), f.x), mix(ccHash(i + vec2(0, 1)), ccHash(i + vec2(1, 1)), f.x), f.y);
}
float ccFbm(vec2 p) { return 0.55 * ccNoise(p) + 0.3 * ccNoise(p * 2.1 + 3.7) + 0.15 * ccNoise(p * 4.3 + 9.1); }
`;

/** z of the forest's front edge for a forest cover, %: the trees hold the back of the land. */
const forestEdge = (forestPct) => LAND.z0 + (LAND.z1 - LAND.z0) * clamp((forestPct - MIN_FOREST_PCT * 0.5) / (MAX_FOREST_PCT - MIN_FOREST_PCT * 0.5), 0.05, 1);

/** How much of the coal seam is left, 0–1, after burning `gtc` of it (the seam is drawn as 1500 GtC). */
const seamLeft = (gtc) => clamp(1 - gtc / 1500, 0.08, 1);

// ─── The clock ──────────────────────────────────────────────────────

function CarbonDriver({ controls, speed, resetToken, rates, onTick, setParam }) {
  const clock = useRef({ state: initialCarbonState(), resetToken, sincePush: 1, pushed: {} });

  useFrame((_, rawDelta) => {
    const c = clock.current;
    if (resetToken !== c.resetToken) {
      c.resetToken = resetToken;
      c.state = initialCarbonState();
      c.sincePush = 1;
    }
    const dt = Math.min(rawDelta, 1 / 30);
    c.state = stepCarbon(c.state, controls, dt * SIM_YEARS_PER_SECOND * speed);
    const solved = solveCarbon(c.state, controls);
    rates.trap.current = solved.opacity;
    rates.seam.current = seamLeft(solved.fossilBurned);

    c.sincePush += dt;
    if (c.sincePush < PUSH_EVERY_S) return;
    c.sincePush = 0;
    onTick(solved);

    if (typeof setParam !== "function") return;
    const next = {
      liveYear: Math.round(solved.year * 10) / 10,
      livePpm: Math.round(solved.ppm * 10) / 10,
      liveAnomaly: Math.round(solved.anomaly * 100) / 100,
      liveOceanPpm: Math.round(solved.oceanPpm * 10) / 10,
      liveFossil: Math.round(solved.fossilBurned),
      liveLand: Math.round(solved.landStored * 10) / 10,
      liveOcean: Math.round(solved.oceanStored * 10) / 10,
    };
    for (const key of Object.keys(next)) {
      if (c.pushed[key] !== next[key]) setParam(key, next[key]);
    }
    c.pushed = next;
  });
  return null;
}

/** Scene time, scaled by the speed control; every animated material reads it. */
function Clock({ timeRef, speed }) {
  useFrame((_, rawDelta) => {
    timeRef.value += Math.min(rawDelta, 1 / 20) * speed;
  });
  return null;
}

// ─── The block ──────────────────────────────────────────────────────

/**
 * The land: one box whose top is drawn by region (forest floor behind the
 * forest's edge, pasture in front of it, gravel round the station, sand at
 * the shore) and whose cut faces are strata — topsoil, subsoil, sandstone,
 * the coal seam (mined out from the top as fossil carbon is burned), shale.
 */
function LandBlock({ edgeRef, seamRef }) {
  const w = SEA.x0 - BLOCK.x0;
  const d = BLOCK.z1 - BLOCK.z0;
  const uniforms = useMemo(() => ({ uEdge: { value: 0 }, uSeam: { value: 1 } }), []);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vW;\nvarying vec3 vN;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.0)).xyz;\nvN = normal;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nuniform float uEdge;\nuniform float uSeam;\nvarying vec3 vW;\nvarying vec3 vN;\n${NOISE}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec3 c;
          if (vN.y > 0.5) {
            float n = ccFbm(vW.xz * 1.6);
            float fine = ccNoise(vW.xz * 9.0);
            vec3 forest = mix(vec3(0.13, 0.17, 0.08), vec3(0.24, 0.2, 0.1), n) * (0.85 + 0.3 * fine);
            vec3 pasture = mix(vec3(0.42, 0.5, 0.2), vec3(0.58, 0.58, 0.28), n) * (0.88 + 0.24 * fine);
            float f = smoothstep(uEdge + 0.25, uEdge - 0.25, vW.z);
            c = mix(pasture, forest, f);
            // Gravel round the station.
            float yard = step(${PLANT.clear.x0.toFixed(2)}, vW.x) * step(vW.x, ${PLANT.clear.x1.toFixed(2)}) * step(${PLANT.clear.z0.toFixed(2)}, vW.z) * step(vW.z, ${PLANT.clear.z1.toFixed(2)});
            c = mix(c, vec3(0.36, 0.35, 0.33) * (0.85 + 0.3 * fine), yard * 0.9);
            // The access road: two worn ruts in a gravel lane.
            float road = smoothstep(${(ROAD.x0 - 0.05).toFixed(2)}, ${ROAD.x0.toFixed(2)}, vW.x) * smoothstep(${(ROAD.x1 + 0.05).toFixed(2)}, ${ROAD.x1.toFixed(2)}, vW.x) * step(${PLANT.clear.z1.toFixed(2)}, vW.z);
            float rut = 1.0 - 0.18 * smoothstep(0.06, 0.0, abs(abs(vW.x - ${((ROAD.x0 + ROAD.x1) / 2).toFixed(3)}) - 0.17));
            c = mix(c, vec3(0.4, 0.37, 0.32) * (0.85 + 0.3 * fine) * rut, road * 0.92);
            // A strip of beach along the shore.
            c = mix(c, vec3(0.74, 0.66, 0.47) * (0.9 + 0.2 * fine), smoothstep(${(SEA.x0 - 0.55).toFixed(2)}, ${(SEA.x0 - 0.25).toFixed(2)}, vW.x));
          } else {
            float y = vW.y;
            float wob = (ccNoise(vec2(vW.x + vW.z, y) * 3.0) - 0.5) * 0.06;
            float seamTop = ${STRATA.seamTop.toFixed(2)} - (1.0 - uSeam) * ${(STRATA.seamTop - STRATA.seamBottom).toFixed(2)};
            vec3 topsoil = vec3(0.17, 0.11, 0.07);
            vec3 subsoil = vec3(0.4, 0.27, 0.17);
            vec3 sand = vec3(0.56, 0.47, 0.34) * (0.92 + 0.08 * sin(y * 60.0 + wob * 40.0));
            vec3 coal = vec3(0.06, 0.06, 0.07) + vec3(0.12) * step(0.93, ccNoise(vW.xy * 40.0 + vW.zy * 40.0));
            vec3 worked = vec3(0.16, 0.15, 0.14) * (0.8 + 0.2 * step(0.5, fract((vW.x + vW.z + y) * 6.0)));
            vec3 shale = vec3(0.24, 0.24, 0.27) * (0.9 + 0.1 * sin(y * 45.0));
            c = topsoil;
            c = mix(c, subsoil, step(y, ${STRATA.topsoil.toFixed(2)} + wob));
            c = mix(c, sand, step(y, ${STRATA.subsoil.toFixed(2)} + wob));
            c = mix(c, worked, step(y, ${STRATA.seamTop.toFixed(2)} + wob * 0.5));
            c = mix(c, coal, step(y, seamTop + wob * 0.5));
            c = mix(c, shale, step(y, ${STRATA.seamBottom.toFixed(2)} + wob * 0.5));
          }
          diffuseColor.rgb = c;`,
        );
    };
    return m;
  }, [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    uniforms.uEdge.value = edgeRef.current;
    uniforms.uSeam.value += (seamRef.current - uniforms.uSeam.value) * 0.1;
  });
  return (
    <mesh position={[BLOCK.x0 + w / 2, -BLOCK.depth / 2, 0]} material={material} receiveShadow>
      <boxGeometry args={[w, BLOCK.depth, d, 1, 1, 1]} />
    </mesh>
  );
}

/** The sea: its floor of sand over carbonate sediment, a glass-fronted water column, and a moving surface. */
function Sea({ timeRef, uptaking }) {
  const w = BLOCK.x1 - SEA.x0;
  const d = BLOCK.z1 - BLOCK.z0;
  const cx = SEA.x0 + w / 2;
  const floorH = BLOCK.depth + SEA.floor;
  const floorMaterial = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vW;\nvarying vec3 vN;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.0)).xyz;\nvN = normal;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vW;\nvarying vec3 vN;\n${NOISE}`).replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float y = vW.y;
        vec3 c;
        if (vN.y > 0.5) {
          c = vec3(0.7, 0.63, 0.47) * (0.85 + 0.3 * ccFbm(vW.xz * 3.0));
        } else {
          // Shell-sand over pale bands of carbonate ooze (future limestone), over rock.
          float band = 0.5 + 0.5 * sin(y * 70.0 + ccNoise(vW.xz * 4.0) * 2.0);
          c = mix(vec3(0.66, 0.6, 0.46), vec3(0.86, 0.84, 0.76), step(y, ${(SEA.floor - 0.12).toFixed(2)}));
          c *= 0.92 + 0.08 * band;
          c = mix(c, vec3(0.3, 0.3, 0.33), step(y, ${(SEA.floor - 0.48).toFixed(2)}));
        }
        diffuseColor.rgb = c;`,
      );
    };
    return m;
  }, []);
  const waterMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTop: { value: SEA.surface }, uFloor: { value: SEA.floor } },
        vertexShader: /* glsl */ `
          varying vec3 vW;
          void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTop, uFloor;
          varying vec3 vW;
          void main() {
            float k = clamp((uTop - vW.y) / (uTop - uFloor), 0.0, 1.0);
            vec3 c = mix(vec3(0.16, 0.55, 0.78), vec3(0.03, 0.17, 0.36), k);
            gl_FragColor = vec4(c, 0.62 + 0.18 * k);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const surfaceMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: timeRef },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vW;
          void main() {
            vec3 p = position;
            vW = (modelMatrix * vec4(p, 1.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec3 vW;
          ${NOISE}
          void main() {
            vec2 p = vW.xz;
            float a = ccNoise(p * 2.2 + vec2(uTime * 0.25, uTime * 0.12));
            float b = ccNoise(p * 4.7 - vec2(uTime * 0.18, -uTime * 0.3));
            float ripple = a * 0.6 + b * 0.4;
            vec3 c = mix(vec3(0.1, 0.42, 0.66), vec3(0.32, 0.7, 0.88), ripple);
            float glint = smoothstep(0.78, 0.92, ripple) * 0.9;
            c += vec3(1.0, 0.95, 0.8) * glint * 0.5;
            gl_FragColor = vec4(c, 0.78);
          }`,
        transparent: true,
        depthWrite: false,
      }),
    [timeRef],
  );
  useEffect(
    () => () => {
      floorMaterial.dispose();
      waterMaterial.dispose();
      surfaceMaterial.dispose();
    },
    [floorMaterial, waterMaterial, surfaceMaterial],
  );
  const waterH = SEA.surface - SEA.floor;
  return (
    <group>
      <mesh position={[cx, -BLOCK.depth + floorH / 2, 0]} material={floorMaterial} receiveShadow>
        <boxGeometry args={[w, floorH, d]} />
      </mesh>
      {/* Inset from the sea floor and the land's cliff: sharing their planes, its faces z-fought. */}
      <mesh position={[cx + WATER_INSET / 2, SEA.floor + WATER_INSET + (waterH - WATER_INSET) / 2, 0]} material={waterMaterial} renderOrder={1}>
        <boxGeometry args={[w - WATER_INSET, waterH - WATER_INSET, d - 0.01]} />
      </mesh>
      <mesh position={[cx, SEA.surface + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={surfaceMaterial} renderOrder={2}>
        <planeGeometry args={[w - 0.01, d - 0.01]} />
      </mesh>
      {/* The glass: a faint pane and a bright rim, so the cut reads as a window. */}
      <Line
        points={[
          [SEA.x0, -BLOCK.depth, BLOCK.z1 + 0.005],
          [SEA.x0, 0.12, BLOCK.z1 + 0.005],
          [BLOCK.x1, 0.12, BLOCK.z1 + 0.005],
          [BLOCK.x1, -BLOCK.depth, BLOCK.z1 + 0.005],
        ]}
        color="#bae6fd"
        lineWidth={1}
        transparent
        opacity={0.45}
      />
      <Carbonates uptaking={uptaking} />
    </group>
  );
}

/** Dissolved CO₂, bicarbonate and carbonate ions drifting in the water column. */
function Carbonates({ count = 70, seed = 61, uptaking }) {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const w = BLOCK.x1 - SEA.x0;
  const seats = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: SEA.x0 + 0.2 + hashRandom(seed + i * 1.9) * (w - 0.4),
        y: SEA.floor + 0.1 + hashRandom(seed * 2 + i * 2.7) * (SEA.surface - SEA.floor - 0.2),
        z: BLOCK.z0 + 0.2 + hashRandom(seed * 3 + i * 3.1) * (BLOCK.z1 - BLOCK.z0 - 0.4),
        phase: hashRandom(seed * 5 + i * 0.7) * Math.PI * 2,
        scale: 0.025 + 0.025 * hashRandom(seed * 7 + i * 1.3),
      })),
    [count, seed, w],
  );
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      const s = seats[i];
      // Dissolving: they sink slowly from the surface; outgassing: they rise.
      const drift = ((t * 0.04 + s.phase) % 1) * (uptaking ? -1 : 1) * 0.2;
      dummy.position.set(s.x + 0.06 * Math.sin(t * 0.4 + s.phase), clamp(s.y + drift, SEA.floor + 0.05, SEA.surface - 0.05), s.z + 0.06 * Math.cos(t * 0.35 + s.phase));
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={3}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={COLOURS.carbonate} transparent opacity={0.75} depthWrite={false} />
    </instancedMesh>
  );
}

// ─── Land use ───────────────────────────────────────────────────────

/** Seats over the land by best candidate, kept off the station's yard. */
function landSeats(n, seed, inYard) {
  const seats = [];
  let k = 0;
  while (seats.length < n && k < n * 80) {
    let best = null;
    let bestD = -1;
    for (let c = 0; c < 16; c += 1) {
      k += 1;
      const x = LAND.x0 + hashRandom(seed + k * 1.37) * (LAND.x1 - LAND.x0);
      const z = LAND.z0 + hashRandom(seed * 3.1 + k * 2.71) * (LAND.z1 - LAND.z0);
      if (inYard(x, z)) continue;
      let dd = Infinity;
      for (const s of seats) dd = Math.min(dd, Math.hypot(s.x - x, s.z - z));
      if (dd > bestD) {
        bestD = dd;
        best = { x, z };
      }
    }
    if (best) seats.push(best);
  }
  return seats;
}

const inPlantYard = (x, z) => (x > PLANT.clear.x0 - 0.3 && x < PLANT.clear.x1 + 0.2 && z > PLANT.clear.z0 - 0.3 && z < PLANT.clear.z1 + 0.35) || (x > ROAD.x0 - 0.45 && x < ROAD.x1 + 0.45 && z > PLANT.clear.z1);

/**
 * The forest: broadleaf and conifer seats over the whole of the land. A seat
 * behind the forest's edge holds a tree; in front of it, the tree is gone
 * and about half the seats show its stump. Each seat eases between the
 * two, so moving the slider fells or replants a row at a time.
 */
function Forest({ parts, edgeRef }) {
  const seats = useMemo(
    () =>
      landSeats(TREE_SEATS, 5, inPlantYard).map((s, i) => ({
        ...s,
        conifer: hashRandom(i * 3.7 + 1) < 0.4,
        scale: 0.85 + 0.3 * hashRandom(i * 5.1 + 2),
        heading: hashRandom(i * 7.3 + 3) * Math.PI * 2,
        stump: hashRandom(i * 9.1 + 4) < 0.55,
        tint: 0.88 + 0.24 * hashRandom(i * 11.3 + 5),
        tree: 1,
      })),
    [],
  );
  const refs = { broadleaf: useRef(null), conifer: useRef(null), stump: useRef(null) };
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);
  const lists = useMemo(() => ({ broadleaf: seats.filter((s) => !s.conifer), conifer: seats.filter((s) => s.conifer) }), [seats]);
  const tinted = useRef(false);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    const edge = edgeRef.current;
    for (const kind of ["broadleaf", "conifer"]) {
      const mesh = refs[kind].current;
      if (!mesh) continue;
      lists[kind].forEach((s, i) => {
        const want = s.z < edge ? 1 : 0;
        s.tree += (want - s.tree) * (1 - Math.exp(-dt * 3));
        dummy.position.set(s.x, 0, s.z);
        dummy.rotation.set(0, s.heading, 0);
        dummy.scale.setScalar((kind === "conifer" ? 0.16 : 0.165) * s.scale * s.tree);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (!tinted.current) mesh.setColorAt(i, colour.setScalar(s.tint));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (!tinted.current && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    tinted.current = true;
    const stumps = refs.stump.current;
    if (stumps) {
      seats.forEach((s, i) => {
        const k = s.stump ? clamp(1 - s.tree, 0, 1) : 0;
        dummy.position.set(s.x, 0, s.z);
        dummy.rotation.set(0, s.heading, 0);
        dummy.scale.setScalar(0.24 * s.scale * k);
        dummy.updateMatrix();
        stumps.setMatrixAt(i, dummy.matrix);
      });
      stumps.instanceMatrix.needsUpdate = true;
    }
  });

  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      <instancedMesh ref={refs.broadleaf} args={[parts.broadleaf.geometry, material, lists.broadleaf.length]} frustumCulled={false} castShadow receiveShadow />
      <instancedMesh ref={refs.conifer} args={[parts.conifer.geometry, material, lists.conifer.length]} frustumCulled={false} castShadow receiveShadow />
      <instancedMesh ref={refs.stump} args={[parts.stump.geometry, material, seats.length]} frustumCulled={false} castShadow />
    </group>
  );
}

/** Holstein cattle grazing the pasture in front of the forest's edge: as many as the cleared land carries. */
function Cattle({ parts, count, edgeRef, timeRef }) {
  const meshRef = useRef(null);
  const seats = useMemo(
    () =>
      Array.from({ length: COW_SEATS }, (_, i) => ({
        u: 0.08 + 0.84 * hashRandom(41 + i * 2.3),
        v: 0.2 + 0.7 * hashRandom(123 + i * 1.7),
        heading: hashRandom(287 + i * 0.9) * Math.PI * 2,
        phase: hashRandom(19 + i * 3.1) * 6.28,
        shown: 0,
      })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 1 / 30);
    const t = timeRef.value;
    const edge = edgeRef.current;
    const z0 = Math.min(edge + 0.35, LAND.z1 - 0.3);
    seats.forEach((s, i) => {
      s.shown += ((i < count ? 1 : 0) - s.shown) * (1 - Math.exp(-dt * 3));
      const x = LAND.x0 + 0.3 + s.u * (LAND.x1 - LAND.x0 - 0.6);
      const z = z0 + s.v * Math.max(LAND.z1 - z0 - 0.15, 0);
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, s.heading + 0.3 * Math.sin(t * 0.15 + s.phase), 0);
      dummy.scale.setScalar(0.034 * s.shown * (z > edge + 0.2 ? 1 : 0));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={meshRef} args={[parts.cow.geometry, material, COW_SEATS]} frustumCulled={false} castShadow />;
}

/** The fence along the forest's edge: posts and two rails, moving with it. */
function Fence({ edge }) {
  const { posts, rails } = useMemo(() => {
    const z = Math.min(edge + 0.2, LAND.z1);
    const xs = [];
    for (let x = LAND.x0; x <= LAND.x1 + 1e-6; x += 0.55) if (!inPlantYard(x, z)) xs.push(x);
    return {
      posts: xs,
      rails: [0.14, 0.26].map((y) => [[LAND.x0, y, z], [LAND.x1, y, z]]),
    };
  }, [edge]);
  const z = Math.min(edge + 0.2, LAND.z1);
  return (
    <group>
      {posts.map((x) => (
        <mesh key={x} position={[x, 0.16, z]}>
          <boxGeometry args={[0.04, 0.32, 0.04]} />
          <meshStandardMaterial color={COLOURS.fence} roughness={0.9} />
        </mesh>
      ))}
      {rails.map((pts, i) => (
        <Line key={i} points={pts} color={COLOURS.fence} lineWidth={1.2} />
      ))}
    </group>
  );
}

/** The coal-fired station, its furnace door glowing with the burn rate, and smoke from its stacks. */
function PowerStation({ parts, combustion, timeRef }) {
  const k = clamp(combustion / MAX_COMBUSTION_PCT, 0, 1);
  const lit = combustion > 0;
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), []);
  useEffect(() => () => material.dispose(), [material]);
  const s = PLANT.scale;
  const door = CARBON_CYCLE_MODEL.furnace;
  return (
    <group position={[PLANT.x, 0, PLANT.z]}>
      <mesh geometry={parts.plant.geometry} material={material} scale={s} castShadow receiveShadow />
      <Furnace position={[door[0] * s, door[1] * s, door[2] * s]} scale={s} k={lit ? 0.25 + 0.75 * Math.sqrt(k) : 0} timeRef={timeRef} />
      {CARBON_CYCLE_MODEL.stacks.map((p, i) => (
        <Smoke key={i} origin={[p[0] * s, p[1] * s, p[2] * s]} amount={lit ? 0.25 + 0.75 * Math.sqrt(k) : 0} timeRef={timeRef} seed={i * 7 + 3} />
      ))}
    </group>
  );
}

const FURNACE = { w: 8.0, h: 4.6, frame: 0.55, depth: 0.8 };

/**
 * The furnace mouth on the turbine hall's front: a steel frame standing out
 * from the brick, and inside it a fire whose flames lick upwards and
 * flicker, as bright as the burn rate (`k`, 0–1), with a warm light spilling
 * onto the yard in front.
 */
function Furnace({ position, scale, k, timeRef }) {
  const { w, h, frame, depth } = FURNACE;
  const uniforms = useMemo(() => ({ uTime: timeRef, uK: { value: 0 } }), [timeRef]);
  const fire = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uK;
          varying vec2 vUv;
          ${NOISE}
          void main() {
            vec2 q = vec2(vUv.x * 3.0, vUv.y * 2.0 - uTime * 1.6);
            float n = ccFbm(q * 2.0) * 0.65 + ccNoise(q * 6.0) * 0.35;
            // Flames: tall where the noise is high, licking up from a white-hot bed.
            float flame = smoothstep(0.0, 1.0, (n * 1.3 - vUv.y) * 1.8 + 0.35);
            vec3 c = mix(vec3(0.35, 0.03, 0.0), vec3(1.0, 0.42, 0.05), flame);
            c = mix(c, vec3(1.0, 0.86, 0.45), smoothstep(0.55, 1.0, flame) * (1.0 - vUv.y));
            float flicker = 0.85 + 0.15 * sin(uTime * 13.0 + n * 6.0);
            vec3 cold = vec3(0.05, 0.05, 0.06);
            gl_FragColor = vec4(mix(cold, c * (1.0 + 1.6 * uK) * flicker, uK), 1.0);
          }`,
        toneMapped: false,
      }),
    [uniforms],
  );
  useEffect(() => () => fire.dispose(), [fire]);
  const light = useRef(null);
  useFrame(() => {
    uniforms.uK.value += (k - uniforms.uK.value) * 0.08;
    if (light.current) light.current.intensity = uniforms.uK.value * (1.4 + 0.3 * Math.sin(timeRef.value * 11.0));
  });
  const steel = "#2b2e34";
  const bars = [
    [0, h / 2 + frame / 2, w + 2 * frame, frame],
    [0, -h / 2 - frame / 2, w + 2 * frame, frame],
    [-w / 2 - frame / 2, 0, frame, h],
    [w / 2 + frame / 2, 0, frame, h],
  ];
  return (
    <group position={position} scale={scale}>
      {/* The fire sits on the wall; the frame stands out from it, so the fire reads as set back. */}
      <mesh position={[0, 0, 0.03]} material={fire}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {bars.map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, depth / 2]} castShadow>
          <boxGeometry args={[bw, bh, depth]} />
          <meshStandardMaterial color={steel} roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
      {/* The door, swung open to the right. */}
      <mesh position={[w / 2 + frame + 0.1, 0, depth + w * 0.35]} rotation={[0, -1.25, 0]}>
        <boxGeometry args={[w * 0.75, h, 0.25]} />
        <meshStandardMaterial color={steel} roughness={0.55} metalness={0.6} />
      </mesh>
      <pointLight ref={light} position={[0, -h * 0.1, depth + 2.5]} color="#ff8a3d" intensity={0} distance={2.4} decay={2} />
    </group>
  );
}

const SMOKE_COUNT = 40;

/** Soft grey puffs from a stack: CO₂ going up with the combustion products. */
function Smoke({ origin, amount, timeRef, seed }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i += 1) {
      seeds[i * 3] = hashRandom(seed + i * 1.3);
      seeds[i * 3 + 1] = hashRandom(seed * 2 + i * 2.1);
      seeds[i * 3 + 2] = hashRandom(seed * 3 + i * 3.7);
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
    return g;
  }, [seed]);
  const uniforms = useMemo(() => ({ uTime: timeRef, uAmount: { value: 0 }, uOrigin: { value: new THREE.Vector3() } }), [timeRef]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          attribute vec3 aSeed;
          uniform float uTime, uAmount;
          uniform vec3 uOrigin;
          varying float vA;
          void main() {
            float life = fract(aSeed.z + uTime * 0.18);
            float alive = step(aSeed.x, uAmount);
            vec3 p = uOrigin + vec3(life * 1.1 + (aSeed.x - 0.5) * 0.3 * life, life * 1.6, (aSeed.y - 0.5) * 0.5 * life);
            vA = alive * smoothstep(0.0, 0.1, life) * (1.0 - life);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (0.18 + 0.7 * life) * 900.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() {
            float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
            gl_FragColor = vec4(vec3(0.62, 0.64, 0.68), a * vA * 0.42);
          }`,
        transparent: true,
        depthWrite: false,
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
  uniforms.uOrigin.value.set(...origin);
  useFrame(() => {
    uniforms.uAmount.value += (amount - uniforms.uAmount.value) * 0.05;
  });
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />;
}

// ─── The flows ──────────────────────────────────────────────────────

const ARROW_SEGMENTS = 64;

/**
 * A carbon flow as a textbook arrow: a tube along a curve through `points`
 * with a cone for a head, and pulses running towards it. The tube is built
 * at radius 1 and set to `radius` in the vertex shader, so a changing flux
 * never rebuilds geometry. `reverse` sends the pulses and the head the
 * other way (the sea outgassing instead of dissolving).
 */
function FlowArrow({ points, flux, colour, label, labelOffset = [0, 0.3, 0], timeRef, reverse = false, tone }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points]);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, ARROW_SEGMENTS, 1, 10, false), [curve]);
  const uniforms = useMemo(() => ({ uTime: timeRef, uRadius: { value: 0.05 }, uColour: { value: new THREE.Color(colour) }, uDir: { value: 1 } }), [timeRef, colour]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          uniform float uRadius;
          varying vec2 vUv;
          varying vec3 vN;
          void main() {
            vUv = uv;
            vN = normalize(normalMatrix * normal);
            vec3 p = position - normal + normal * uRadius;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uDir;
          uniform vec3 uColour;
          varying vec2 vUv;
          varying vec3 vN;
          void main() {
            float s = uDir > 0.0 ? vUv.x : 1.0 - vUv.x;
            float pulse = pow(0.5 + 0.5 * sin(s * 22.0 - uTime * 4.0), 4.0);
            float rim = 0.55 + 0.45 * abs(vN.z);
            vec3 c = uColour * (0.55 + 0.9 * pulse) * rim;
            float fade = smoothstep(0.0, 0.08, s);
            gl_FragColor = vec4(c, (0.55 + 0.4 * pulse) * fade);
          }`,
        transparent: true,
        depthWrite: false,
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
  const radius = arrowRadius(flux);
  uniforms.uRadius.value = radius;
  uniforms.uDir.value = reverse ? -1 : 1;
  uniforms.uColour.value.set(colour);

  // The head sits at whichever end the flow is going to.
  const head = useMemo(() => {
    const t = reverse ? 0 : 1;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).multiplyScalar(reverse ? -1 : 1);
    return { position: p, quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan) };
  }, [curve, reverse]);
  const mid = useMemo(() => curve.getPointAt(0.5), [curve]);
  const hr = radius * 2.4;
  return (
    <group>
      <mesh geometry={geometry} material={material} renderOrder={5} />
      <mesh position={head.position.clone().addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(head.quaternion), hr * 0.6)} quaternion={head.quaternion} scale={[hr, hr * 1.8, hr]} renderOrder={6}>
        <coneGeometry args={[1, 1, 16]} />
        <meshBasicMaterial color={colour} toneMapped={false} />
      </mesh>
      {label && (
        <ToggleLabel position={[mid.x + labelOffset[0], mid.y + labelOffset[1], mid.z + labelOffset[2]]} tone={tone}>
          {label}
        </ToggleLabel>
      )}
    </group>
  );
}

const gtcText = (v) => `${Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)} GtC/yr`;

function CarbonFlows({ solved, edge, timeRef }) {
  // The forest's middle, between the back of the land and its edge.
  const fz = (LAND.z0 + Math.max(edge, LAND.z0 + 1)) / 2;
  const fx = -4.6;
  const pz = (Math.min(edge + 0.3, LAND.z1) + LAND.z1) / 2;
  const s = PLANT.scale;
  const stack = CARBON_CYCLE_MODEL.stacks[1];
  const top = [PLANT.x + stack[0] * s, stack[1] * s + 0.1, PLANT.z + stack[2] * s];
  const seaX = (SEA.x0 + BLOCK.x1) / 2 + 0.4;
  const uptaking = solved.oceanUptake >= 0;
  const paths = useMemo(
    () => ({
      photo: [[fx - 1.1, 4.4, fz], [fx - 1.5, 3.2, fz + 0.2], [fx - 1.0, 1.9, fz]],
      resp: [[fx + 1.0, 1.9, fz], [fx + 1.5, 3.2, fz + 0.2], [fx + 1.1, 4.4, fz]],
      combustion: [top, [top[0] + 0.5, top[1] + 0.9, top[2]], [top[0] + 0.7, 4.4, top[2] + 0.2]],
      landUse: [[0.5, 0.6, pz], [0.2, 2.4, pz - 0.3], [-0.2, 4.3, pz - 0.8]],
      ocean: [[seaX - 0.6, 4.4, 0.6], [seaX - 0.1, 2.2, 0.9], [seaX + 0.2, SEA.surface + 0.12, 1.0]],
    }),
    [fx, fz, pz, top[0], top[1], top[2], seaX], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <group>
      <FlowArrow points={paths.photo} flux={solved.photosynthesis} colour={COLOURS.photosynthesis} timeRef={timeRef} label={`photosynthesis ↓ ${gtcText(solved.photosynthesis)}`} labelOffset={[-1.3, 0.1, 0]} tone="text-emerald-300" />
      <FlowArrow points={paths.resp} flux={solved.respiration} colour={COLOURS.respiration} timeRef={timeRef} label={`respiration & decay ↑ ${gtcText(solved.respiration)}`} labelOffset={[1.5, 0.1, 0]} tone="text-amber-300" />
      {solved.combustion > 0 && <FlowArrow points={paths.combustion} flux={solved.combustion} colour={COLOURS.combustion} timeRef={timeRef} label={`combustion ↑ ${gtcText(solved.combustion)}`} labelOffset={[1.1, 0.35, 0]} tone="text-ink-200" />}
      {solved.landUse > 0.01 && <FlowArrow points={paths.landUse} flux={solved.landUse} colour={COLOURS.livestock} timeRef={timeRef} label={`land use · CH₄ ↑ ${gtcText(solved.landUse)}`} labelOffset={[-1.3, -0.4, 0]} tone="text-violet-300" />}
      <FlowArrow points={paths.ocean} flux={solved.oceanUptake} colour={uptaking ? COLOURS.ocean : COLOURS.outgas} reverse={!uptaking} timeRef={timeRef} label={uptaking ? `dissolving ↓ ${gtcText(solved.oceanUptake)} net` : `outgassing ↑ ${gtcText(solved.oceanUptake)} net`} labelOffset={[1.3, 0.2, 0]} tone={uptaking ? "text-sky-300" : "text-rose-300"} />
    </group>
  );
}

// ─── The air ────────────────────────────────────────────────────────

/** One CO₂ (O=C=O) and one CH₄ (a carbon and four hydrogens), as vertex-coloured geometry for instancing. */
function useMolecules() {
  const geos = useMemo(() => {
    const ball = (r, x, y, z, hex) => {
      const g = new THREE.SphereGeometry(r, 10, 8).translate(x, y, z);
      const c = new THREE.Color(hex);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 1) col.set([c.r, c.g, c.b], i * 3);
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      return g;
    };
    const merge = (list) => {
      const g = new THREE.BufferGeometry();
      const pos = [];
      const nrm = [];
      const col = [];
      const idx = [];
      let base = 0;
      for (const p of list) {
        pos.push(...p.attributes.position.array);
        nrm.push(...p.attributes.normal.array);
        col.push(...p.attributes.color.array);
        for (const v of p.index.array) idx.push(v + base);
        base += p.attributes.position.count;
        p.dispose();
      }
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      return g;
    };
    const co2 = merge([ball(1, 0, 0, 0, COLOURS.carbon), ball(0.88, 1.55, 0, 0, COLOURS.oxygen), ball(0.88, -1.55, 0, 0, COLOURS.oxygen)]);
    const h = 1.35;
    const tet = [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ].map(([x, y, z]) => ball(0.55, (x * h) / Math.sqrt(3), (y * h) / Math.sqrt(3), (z * h) / Math.sqrt(3), COLOURS.hydrogen));
    const ch4 = merge([ball(1, 0, 0, 0, COLOURS.carbon), ...tet]);
    return { co2, ch4 };
  }, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  return geos;
}

/** CO₂ and CH₄ in the greenhouse layer: more of them as the air thickens, methane with the pasture. */
function GreenhouseMolecules({ ppm, pasture, timeRef }) {
  const geos = useMolecules();
  const MAX = 90;
  const MAXCH4 = 30;
  const co2Ref = useRef(null);
  const ch4Ref = useRef(null);
  const seats = useMemo(
    () =>
      Array.from({ length: MAX + MAXCH4 }, (_, i) => ({
        x: BLOCK.x0 + 0.3 + hashRandom(71 + i * 1.7) * (BLOCK.x1 - BLOCK.x0 - 0.6),
        z: BLOCK.z0 + 0.3 + hashRandom(142 + i * 2.3) * (BLOCK.z1 - BLOCK.z0 - 0.6),
        y: ENVELOPE_Y - 0.6 + hashRandom(213 + i * 3.7) * 1.2,
        phase: hashRandom(355 + i * 0.9) * Math.PI * 2,
        spin: new THREE.Vector3(hashRandom(i * 1.1), hashRandom(i * 2.2), hashRandom(i * 3.3)).normalize(),
      })),
    [],
  );
  const state = useRef({ co2: 0, ch4: 0, dummy: new THREE.Object3D() });
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 }), []);
  useEffect(() => () => material.dispose(), [material]);
  const co2Target = clamp(8 + (ppm - 250) / 7, 4, MAX);
  const ch4Target = clamp(Math.round(pasture * 34), 0, MAXCH4);
  useFrame((_, rawDelta) => {
    const s = state.current;
    const dt = Math.min(rawDelta, 1 / 30);
    s.co2 += (co2Target - s.co2) * (1 - Math.exp(-dt * 2));
    s.ch4 += (ch4Target - s.ch4) * (1 - Math.exp(-dt * 2));
    const t = timeRef.value;
    const d = s.dummy;
    for (const [mesh, n, shown, off, size] of [
      [co2Ref.current, MAX, s.co2, 0, 0.075],
      [ch4Ref.current, MAXCH4, s.ch4, MAX, 0.08],
    ]) {
      if (!mesh) continue;
      for (let i = 0; i < n; i += 1) {
        const seat = seats[off + i];
        const presence = clamp(shown - i, 0, 1);
        d.position.set(seat.x + 0.2 * Math.sin(t * 0.3 + seat.phase), seat.y + 0.1 * Math.sin(t * 0.5 + seat.phase * 1.3), seat.z + 0.2 * Math.cos(t * 0.27 + seat.phase));
        d.quaternion.setFromAxisAngle(seat.spin, t * 0.6 + seat.phase);
        d.scale.setScalar(size * presence);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group>
      <instancedMesh ref={co2Ref} args={[geos.co2, material, MAX]} frustumCulled={false} />
      <instancedMesh ref={ch4Ref} args={[geos.ch4, material, MAXCH4]} frustumCulled={false} />
    </group>
  );
}

/** The greenhouse layer: a soft sheet at the height the longwave is caught, warmer and denser as the air thickens. */
function GreenhouseLayer({ opacity, longwave, warmth, timeRef }) {
  const uniforms = useMemo(() => ({ uTime: timeRef, uK: { value: 0.3 }, uColour: { value: new THREE.Color() } }), [timeRef]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uK;
          uniform vec3 uColour;
          varying vec2 vUv;
          ${NOISE}
          void main() {
            vec2 q = vUv - 0.5;
            float edge = 1.0 - smoothstep(0.32, 0.5, max(abs(q.x), abs(q.y)));
            float n = ccFbm(vUv * 6.0 + vec2(uTime * 0.03, 0.0));
            gl_FragColor = vec4(uColour, edge * (0.35 + 0.65 * n) * uK);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [uniforms],
  );
  useEffect(() => () => material.dispose(), [material]);
  uniforms.uK.value = longwave ? 0.08 + 0.22 * opacity : 0.05 + 0.08 * opacity;
  uniforms.uColour.value.set(ECO_COLOURS.sky).lerp(new THREE.Color(COLOURS.warm), longwave ? 0.75 : warmth * 0.6);
  return (
    <mesh position={[0, ENVELOPE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={1}>
      <planeGeometry args={[BLOCK.x1 - BLOCK.x0 + 2, BLOCK.z1 - BLOCK.z0 + 2]} />
    </mesh>
  );
}

function Atmosphere({ solved, longwave, shortRef, longRef, trapRef, timeRef, overlays }) {
  const warmth = clamp(solved.anomaly / 6, 0, 1);
  const ground = { x: 0, z: 0, w: BLOCK.x1 - BLOCK.x0 - 0.6, d: BLOCK.z1 - BLOCK.z0 - 0.6, y: 0 };
  return (
    <group>
      <GreenhouseLayer opacity={solved.opacity} longwave={longwave} warmth={warmth} timeRef={timeRef} />
      {overlays && <GreenhouseMolecules ppm={solved.ppm} pasture={solved.pasture} timeRef={timeRef} />}
      {overlays && <PhotonShower mode="shortwave" origin={SUN.position} ground={ground} envelopeY={ENVELOPE_Y} escapeY={ESCAPE_Y} rateRef={shortRef} albedo={0.3} count={60} velocity={5} size={0.05} trail={0.9} seed={81} colours={PHOTON_COLOURS} />}
      {overlays && <PhotonShower mode="longwave" ground={ground} envelopeY={ENVELOPE_Y} escapeY={ESCAPE_Y} rateRef={longRef} trapRef={trapRef} count={90} velocity={3.6} size={0.05} trail={0.6} seed={82} colours={PHOTON_COLOURS} />}
      <ToggleLabel position={[-4.2, ENVELOPE_Y + 0.75, -3.6]} tone={longwave ? "text-orange-300" : "text-sky-300"}>
        {longwave ? `greenhouse layer · CO₂ + CH₄ · ${Math.round(solved.opacity * 100)} % of outgoing IR absorbed` : `atmosphere · CO₂ and CH₄ · shortwave sunlight passes through`}
      </ToggleLabel>
      <SceneLabel position={[3.6, ENVELOPE_Y + 1.3, -3.6]} accent>
        {`CO₂ ${Math.round(solved.ppm)} ppm · ${solved.ppmPerYear >= 0 ? "+" : "−"}${Math.abs(solved.ppmPerYear).toFixed(1)} ppm/yr`}
      </SceneLabel>
    </group>
  );
}

// ─── Instruments ────────────────────────────────────────────────────

function Thermometer({ anomaly }) {
  const k = clamp(anomaly / THERMO.maxC, 0, 1);
  const fill = 0.15 + k * (THERMO.height - 0.3);
  const colour = useMemo(() => `#${new THREE.Color(ECO_COLOURS.sky).lerp(new THREE.Color(PALETTE.rose), k).getHexString()}`, [k]);
  const ticks = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5, 6].map((c) => {
        const y = 0.35 + (c / THERMO.maxC) * (THERMO.height - 0.3);
        return { c, points: [[0.17, y, 0], [0.32, y, 0]] };
      }),
    [],
  );
  return (
    <group position={[THERMO.x, -BLOCK.depth, THERMO.z]}>
      {/* A plinth level with the block's foot. */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.45, 0.5, 0.3, 24]} />
        <meshStandardMaterial color="#3a4152" roughness={0.6} />
      </mesh>
      <group position={[0, 0.3, 0]}>
        <mesh position={[0, THERMO.height / 2 + 0.2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, THERMO.height + 0.1, 20, 1, true]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.15} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.2 + fill / 2, 0]}>
          <cylinderGeometry args={[0.085, 0.085, fill, 12]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.25, 18, 14]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
        {ticks.map((t) => (
          <Line key={t.c} points={t.points} color={PALETTE.slate} lineWidth={1} />
        ))}
        <SceneLabel position={[0, THERMO.height + 0.75, 0]} accent>
          {`${anomaly >= 0 ? "+" : "−"}${Math.abs(anomaly).toFixed(2)} °C`}
        </SceneLabel>
        <ToggleLabel position={[0, THERMO.height + 0.35, 0]} tone="text-ink-400">
          global mean vs pre-industrial
        </ToggleLabel>
      </group>
    </group>
  );
}

function BudgetChart({ solved }) {
  const bars = [
    { key: "combustion", label: "fossil fuel", value: solved.combustion, colour: COLOURS.combustion },
    { key: "landUse", label: "land use · CH₄", value: solved.landUse, colour: COLOURS.livestock },
    { key: "respiration", label: "respiration", value: solved.respiration, colour: COLOURS.respiration },
    { key: "photosynthesis", label: "photosynthesis", value: -solved.photosynthesis, colour: COLOURS.photosynthesis },
    { key: "ocean", label: solved.oceanUptake >= 0 ? "ocean uptake" : "ocean outgassing", value: -solved.oceanUptake, colour: solved.oceanUptake >= 0 ? COLOURS.ocean : COLOURS.outgas },
  ];
  return (
    <SignedFluxBars
      position={CHART.position}
      width={CHART.width}
      height={CHART.height}
      bars={bars}
      net={{ label: "net to air", colour: COLOURS.net }}
      format={(v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1))}
      title="Carbon pool exchange · GtC/yr · into (+) and out of (−) the atmosphere"
      footnote={`year ${solved.year.toFixed(0)} · CO₂ ${solved.trend} · ${solved.fossilBurned.toFixed(0)} GtC of fossil carbon burned so far`}
    />
  );
}

/** Names for the strata on the cut face and the regions on top. */
function Captions({ solved, forest, cattle, combustion }) {
  const z = BLOCK.z1 + 0.05;
  const left = (y, text, tone = "text-ink-400") => (
    <Callout anchor={[BLOCK.x0 + 0.35, y, z]} at={[BLOCK.x0 - 0.5, y, z]} side="left" tone={tone}>
      {text}
    </Callout>
  );
  const remaining = Math.round(seamLeft(solved.fossilBurned) * 100);
  return (
    <group>
      {left(-0.15, "topsoil")}
      {left(-1.1, "sandstone")}
      {left((STRATA.seamTop + STRATA.seamBottom) / 2, `coal seam · fossil carbon · ${remaining} % left`, "text-ink-200")}
      {left(-2.15, "shale")}
      <ToggleLabel position={[(SEA.x0 + BLOCK.x1) / 2, SEA.floor - 0.35, z]} tone="text-ink-300">
        carbonate sediment · tomorrow&apos;s limestone
      </ToggleLabel>
      <ToggleLabel position={[(SEA.x0 + BLOCK.x1) / 2, (SEA.surface + SEA.floor) / 2, z]} tone={solved.oceanUptake >= 0 ? "text-sky-200" : "text-rose-300"}>
        {`ocean · dissolved CO₂, HCO₃⁻, CO₃²⁻ · pH ${solved.pH.toFixed(2)}`}
      </ToggleLabel>
      <ToggleLabel position={[-5.6, 0.35, BLOCK.z1 - 0.2]} tone="text-lime-300">
        {cattle === 0 ? "no pasture · all forest" : `pasture · ${cattle} head of cattle`}
      </ToggleLabel>
      <ToggleLabel position={[-6.3, 2.2, -4.0]} tone="text-emerald-300">
        {`forest · ${Math.round(forest)} % cover`}
      </ToggleLabel>
      <ToggleLabel position={[PLANT.x + 0.4, 3.2, PLANT.z - 0.4]} tone={combustion > 0 ? "text-ink-200" : "text-ink-500"}>
        {combustion > 0 ? `coal power station · ${Math.round(combustion)} %` : "coal power station · shut down"}
      </ToggleLabel>
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

function Models({ forest, solved, combustion, edgeRef, timeRef, cattle }) {
  const parts = usePackedModel(CARBON_GLB);
  if (!parts.broadleaf || !parts.cow || !parts.plant) return null;
  return (
    <group>
      <Forest parts={parts} edgeRef={edgeRef} forest={forest} />
      <Cattle parts={parts} count={cattle} edgeRef={edgeRef} timeRef={timeRef} />
      <PowerStation parts={parts} combustion={combustion} timeRef={timeRef} solved={solved} />
    </group>
  );
}

/** Eases the forest's edge towards the slider's, for the trees, the cattle and the ground shader. */
function EdgeEaser({ edgeRef, target }) {
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    edgeRef.current += (target - edgeRef.current) * (1 - Math.exp(-dt * 2.5));
  });
  return null;
}

export default function CarbonCycleCanvas({ params = {}, setParam }) {
  const { combustion = 100, forest = BASELINE_FOREST_PCT, solar = 50, longwave = false, reset = 0, speed = 1, showLabels = true, showFlows = true } = params || {};
  // Arrows, molecules and light rays: off for an uncluttered look at the land and sea.
  const overlays = showFlows !== false;
  const controls = useMemo(() => ({ combustion: Number(combustion) || 0, forest: Number(forest) || BASELINE_FOREST_PCT, solar: Number(solar) || 0 }), [combustion, forest, solar]);

  const trapRef = useRef(0.7);
  const seamRef = useRef(1);
  const shortRef = useRef(0);
  const longRef = useRef(0);
  const rates = useMemo(() => ({ trap: trapRef, seam: seamRef }), []);
  const timeRef = useMemo(() => ({ value: 0 }), []);
  const edgeTarget = forestEdge(controls.forest);
  const edgeRef = useRef(edgeTarget);

  const [solved, setSolved] = useState(() => solveCarbon(initialCarbonState(), controls));

  // Which photons are drawn is the toggle; the physics does not care.
  const sunK = 0.6 + 0.8 * clamp(solar / 100, 0, 1);
  useEffect(() => {
    shortRef.current = longwave ? 0 : 12 + 14 * sunK;
    longRef.current = longwave ? 26 : 0;
  }, [longwave, sunK]);

  const cattle = Math.round(solved.pasture * COW_SEATS);
  const spd = Number(speed) || 1;

  return (
    <SceneCanvas camera={{ position: [0.6, 8.2, 18.5], fov: 42 }} controls={{ minDistance: 6, maxDistance: 38, maxPolarAngle: Math.PI * 0.49 }} lights={{ ambient: 0.32 + 0.12 * sunK, keyLight: 0.75 + 0.7 * sunK, rim: ECO_COLOURS.sky }}>
      <FitCamera view={CARBON_VIEW} direction={[0.06, 0.38, 1]} fov={42} />
      <hemisphereLight args={["#dbeafe", "#3a2a1a", 0.45]} />
      <Clock timeRef={timeRef} speed={spd} />
      <EdgeEaser edgeRef={edgeRef} target={edgeTarget} />
      <LabelsOn.Provider value={showLabels !== false}>
        <CarbonDriver controls={controls} speed={spd} resetToken={reset} rates={rates} onTick={setSolved} setParam={setParam} />

        <SunSource position={SUN.position} intensity={sunK} radius={0.7} label={`sun · ${solarLabel(solar)}`} />
        <LandBlock edgeRef={edgeRef} seamRef={seamRef} />
        <Sea timeRef={timeRef} uptaking={solved.oceanUptake >= 0} />
        <Fence edge={Math.round(edgeTarget * 20) / 20} />
        <Suspense fallback={null}>
          <Models forest={controls.forest} solved={solved} combustion={controls.combustion} edgeRef={edgeRef} timeRef={timeRef} cattle={cattle} />
        </Suspense>
        {overlays && <CarbonFlows solved={solved} edge={edgeTarget} timeRef={timeRef} />}
        <Atmosphere solved={solved} longwave={longwave} shortRef={shortRef} longRef={longRef} trapRef={trapRef} timeRef={timeRef} overlays={overlays} />
        <Thermometer anomaly={solved.anomaly} />
        <Captions solved={solved} forest={controls.forest} cattle={cattle} combustion={controls.combustion} />
        <BudgetChart solved={solved} />

        <ToggleLabel position={[0, CHART.position[1] - 2.3, CHART.position[2]]} tone="text-ink-400">
          {`${SIM_YEARS_PER_SECOND * spd} sim-years per second · year ${solved.year.toFixed(0)} · ${longwave ? "showing re-radiated longwave IR" : "showing incoming shortwave sunlight"}`}
        </ToggleLabel>
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}

useGLTF.preload(CARBON_GLB);
