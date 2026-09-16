"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import {
  DioramaSlab,
  ECO_COLOURS,
  FluxStream,
  PhotonShower,
  SkyEnvelope,
  SunSource,
  TreeStand,
  WaterBody,
} from "@/components/visualizations/ecosystem-diorama";
import { SignedFluxBars } from "@/components/visualizations/flux-chart";
import {
  BASELINE_FOREST_PCT,
  MAX_COMBUSTION_PCT,
  initialCarbonState,
  solarLabel,
  solveCarbon,
  stepCarbon,
} from "@/lib/carbonCycle";

// ─── The carbon cycle ───────────────────────────────────────────────
// A planetary diorama under a hemisphere of air: a forest breathing CO₂
// in and out, a pasture with cattle on cleared land, a coal plant, and a
// sea that dissolves what the air pushes into it. The sun rains photons
// on the lot. Every carbon flow is a stream of particles whose rate is
// the model's GtC/yr (particle rate ∝ √flux, so the small flows are still
// visible next to the 120 GtC/yr of photosynthesis), and the signed chart
// at the back adds them up.
//
// This scene has a clock. `lib/carbonCycle.js` integrates the atmosphere
// at SIM_YEARS_PER_SECOND × speed; the ppm counter, the thermometer and
// the thickness of the greenhouse layer are all read off that state, and
// the HUD gets the same numbers ten times a second.
// ─────────────────────────────────────────────────────────────────────

const SIM_YEARS_PER_SECOND = 2;
const PUSH_EVERY_S = 0.1;

const SLAB = { size: [15, 1.2, 9] };
const FOREST = { x: -3.7, z: -1.5, w: 5.4, d: 4.4, maxTrees: 72 };
const PASTURE = { x: -3.6, z: 2.5, w: 4.6, d: 2.2 };
const OCEAN = { centre: [4.3, 0, 0.7], size: [5.2, 1.0, 5.4] };
const PLANT = { x: 2.5, z: -3.3 };
const SUN = { position: [-7.0, 8.0, -5.0] };
const CHART = { position: [-9.6, 3.3, -6.6], width: 7.6, height: 2.3 };
const ENVELOPE_Y = 4.9;
const DOME_RADIUS = 9.2;
const THERMO = { x: 7.1, z: -1.2, height: 3.2, maxC: 6 };

/** Anchor points for the streams: [x, y, z]. */
const AIR_OVER_FOREST = [FOREST.x, ENVELOPE_Y - 0.6, FOREST.z];
const CANOPY = [FOREST.x, 1.15, FOREST.z];
const AIR_OVER_PASTURE = [PASTURE.x, ENVELOPE_Y - 0.9, PASTURE.z];
const CATTLE_TOP = [PASTURE.x, 0.45, PASTURE.z];
const AIR_OVER_OCEAN = [OCEAN.centre[0], ENVELOPE_Y - 0.7, OCEAN.centre[2]];
const SEA_SURFACE = [OCEAN.centre[0], 0.05, OCEAN.centre[2]];
const CHIMNEY_TOPS = [
  [PLANT.x - 0.45, 1.95, PLANT.z],
  [PLANT.x + 0.45, 1.95, PLANT.z],
];
const AIR_OVER_PLANT = [PLANT.x, ENVELOPE_Y - 0.5, PLANT.z + 0.3];

const COLOURS = {
  photosynthesis: PALETTE.emerald,
  respiration: "#f59e0b",
  combustion: "#94a3b8",
  livestock: PALETTE.violet,
  ocean: PALETTE.sky,
  outgas: "#fb7185",
  co2: "#e2e8f0",
  ch4: "#c4b5fd",
  net: PALETTE.gold,
  brick: "#6b5b57",
  chimney: "#4b5563",
  coal: "#1f2937",
  furnace: "#f97316",
  cow: "#f5f0e6",
  cowSpots: "#3f3129",
  fence: "#a8875f",
  carbonate: "#e0f2fe",
  warm: "#fb923c",
};

/** Particles per second for a flow in GtC/yr. */
const streamRate = (gtc) => 3.4 * Math.sqrt(Math.abs(gtc)) * Math.sign(gtc);

// ─── The clock ──────────────────────────────────────────────────────

/**
 * Runs the integrator, writes the stream rates the instanced particles read
 * every frame into `rates`, and — ten times a second — hands the solved
 * picture to the scene (for the chart and captions) and to the HUD.
 */
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

    rates.photosynthesis.current = streamRate(solved.photosynthesis) * speed;
    rates.respiration.current = streamRate(solved.respiration) * speed;
    rates.combustion.current = streamRate(solved.combustion) * speed;
    rates.livestock.current = streamRate(solved.landUse) * speed;
    rates.ocean.current = streamRate(solved.oceanUptake) * speed;
    rates.trap.current = solved.opacity;

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

// ─── The land ───────────────────────────────────────────────────────

/** Cattle on the pasture: low-poly, instanced, as many as the cleared land carries. */
function Cattle({ count, maxCount = 12, seed = 41 }) {
  const bodies = useRef(null);
  const heads = useRef(null);
  const state = useRef({ shown: count, dirty: true, dummy: new THREE.Object3D() });
  const seats = useMemo(
    () =>
      Array.from({ length: maxCount }, (_, i) => ({
        x: PASTURE.x + (hashRandom(seed + i * 2.3) - 0.5) * (PASTURE.w - 0.6),
        z: PASTURE.z + (hashRandom(seed * 3 + i * 1.7) - 0.5) * (PASTURE.d - 0.5),
        heading: hashRandom(seed * 7 + i * 0.9) * Math.PI * 2,
      })),
    [maxCount, seed],
  );
  const parts = useMemo(() => {
    const body = new THREE.BoxGeometry(0.42, 0.22, 0.2).translate(0, 0.27, 0);
    const head = new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(0.27, 0.34, 0);
    return { body, head };
  }, []);
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose()), [parts]);

  useFrame((_, rawDelta) => {
    const s = state.current;
    const dt = Math.min(rawDelta, 1 / 30);
    const target = clamp(count, 0, seats.length);
    const before = s.shown;
    s.shown += (target - s.shown) * (1 - Math.exp(-dt * 3));
    if (Math.abs(target - s.shown) < 0.02) s.shown = target;
    if (s.shown === before && !s.dirty) return;
    if (!bodies.current || !heads.current) return;
    s.dirty = false;
    const d = s.dummy;
    for (let i = 0; i < seats.length; i += 1) {
      const seat = seats[i];
      const sc = clamp(s.shown - i, 0, 1);
      d.position.set(seat.x, 0, seat.z);
      d.rotation.set(0, seat.heading, 0);
      d.scale.setScalar(sc);
      d.updateMatrix();
      bodies.current.setMatrixAt(i, d.matrix);
      heads.current.setMatrixAt(i, d.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[parts.body, undefined, maxCount]} frustumCulled={false} castShadow>
        <meshStandardMaterial color={COLOURS.cow} roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[parts.head, undefined, maxCount]} frustumCulled={false}>
        <meshStandardMaterial color={COLOURS.cowSpots} roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

function Pasture({ pasture, livestockRef }) {
  const posts = useMemo(() => {
    const out = [];
    const n = 7;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      out.push([PASTURE.x - PASTURE.w / 2 + t * PASTURE.w, 0, PASTURE.z - PASTURE.d / 2]);
      out.push([PASTURE.x - PASTURE.w / 2 + t * PASTURE.w, 0, PASTURE.z + PASTURE.d / 2]);
    }
    return out;
  }, []);
  const rails = useMemo(
    () => [
      [[PASTURE.x - PASTURE.w / 2, 0.3, PASTURE.z - PASTURE.d / 2], [PASTURE.x + PASTURE.w / 2, 0.3, PASTURE.z - PASTURE.d / 2]],
      [[PASTURE.x - PASTURE.w / 2, 0.3, PASTURE.z + PASTURE.d / 2], [PASTURE.x + PASTURE.w / 2, 0.3, PASTURE.z + PASTURE.d / 2]],
    ],
    [],
  );
  const cattle = Math.round(pasture * 12);
  return (
    <group>
      {/* The pasture's own turf: dry grass, distinct from the forest floor. */}
      <mesh position={[PASTURE.x, 0.012, PASTURE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PASTURE.w, PASTURE.d]} />
        <meshStandardMaterial color={ECO_COLOURS.grassDry} roughness={0.95} transparent opacity={clamp(0.25 + pasture, 0, 1)} />
      </mesh>
      {posts.map((p, i) => (
        <mesh key={i} position={[p[0], 0.18, p[2]]}>
          <boxGeometry args={[0.05, 0.36, 0.05]} />
          <meshStandardMaterial color={COLOURS.fence} roughness={0.9} />
        </mesh>
      ))}
      {rails.map((pts, i) => (
        <Line key={i} points={pts} color={COLOURS.fence} lineWidth={1.2} />
      ))}
      <Cattle count={cattle} />
      <FluxStream from={CATTLE_TOP} to={AIR_OVER_PASTURE} rateRef={livestockRef} colour={COLOURS.livestock} count={40} travel={2.6} lift={0.2} spread={0.5} size={0.05} seed={12} />
      <SceneLabel position={[PASTURE.x, 0.95, PASTURE.z + PASTURE.d / 2 + 0.2]} tone="text-violet-300">
        {cattle === 0 ? "no pasture · all forest" : `pasture · ${cattle} head · methane`}
      </SceneLabel>
    </group>
  );
}

function Forest({ forest, photoRef, respRef }) {
  const trees = Math.round((clamp(forest, 0, 100) / 100) * FOREST.maxTrees);
  return (
    <group>
      <TreeStand region={FOREST} count={trees} maxCount={FOREST.maxTrees} seed={5} height={1.2} />
      <FluxStream from={[AIR_OVER_FOREST[0] - 0.7, AIR_OVER_FOREST[1], AIR_OVER_FOREST[2]]} to={[CANOPY[0] - 0.7, CANOPY[1], CANOPY[2]]} rateRef={photoRef} colour={COLOURS.photosynthesis} count={110} travel={2.2} lift={0.1} spread={1.4} size={0.05} seed={21} />
      <FluxStream from={[CANOPY[0] + 0.7, CANOPY[1], CANOPY[2]]} to={[AIR_OVER_FOREST[0] + 0.7, AIR_OVER_FOREST[1], AIR_OVER_FOREST[2]]} rateRef={respRef} colour={COLOURS.respiration} count={110} travel={2.2} lift={0.1} spread={1.4} size={0.05} seed={22} />
      <SceneLabel position={[FOREST.x - 1.1, 1.85, FOREST.z + 1.2]} tone="text-emerald-300">
        photosynthesis ↓
      </SceneLabel>
      <SceneLabel position={[FOREST.x + 1.2, 1.85, FOREST.z + 1.2]} tone="text-amber-300">
        respiration ↑
      </SceneLabel>
      <SceneLabel position={[FOREST.x, 0.35, FOREST.z + FOREST.d / 2 + 0.15]} tone="text-ink-300">
        {`forest · ${Math.round(forest)} % cover · ${trees} of ${FOREST.maxTrees} stands`}
      </SceneLabel>
    </group>
  );
}

function CoalPlant({ combustion, combustionRef }) {
  const k = clamp(combustion / MAX_COMBUSTION_PCT, 0, 1);
  const lit = combustion > 0;
  return (
    <group>
      <group position={[PLANT.x, 0, PLANT.z]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.9, 1.0, 1.1]} />
        <meshStandardMaterial color={COLOURS.brick} roughness={0.85} />
      </mesh>
      {/* Furnace window: glows with the burn rate. */}
      <mesh position={[0, 0.42, 0.56]}>
        <planeGeometry args={[0.5, 0.32]} />
        <meshStandardMaterial color={lit ? COLOURS.furnace : "#2b2b2b"} emissive={COLOURS.furnace} emissiveIntensity={lit ? 0.4 + 2.4 * k : 0} toneMapped={false} />
      </mesh>
      {lit && <Halo position={[0, 0.42, 0.6]} radius={0.35 + 0.5 * k} color={COLOURS.furnace} opacity={0.05 + 0.15 * k} />}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 1.45, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.17, 1.1, 12]} />
          <meshStandardMaterial color={COLOURS.chimney} roughness={0.7} metalness={0.2} />
        </mesh>
      ))}
      {/* The coal heap: fossil carbon waiting to go up the stack. */}
      <mesh position={[1.45, 0.22, 0.2]}>
        <coneGeometry args={[0.55, 0.45, 8]} />
        <meshStandardMaterial color={COLOURS.coal} roughness={1} />
      </mesh>
      <SceneLabel position={[0, 2.35, 0.2]} tone={lit ? "text-ink-200" : "text-ink-500"}>
        {lit ? `coal plant · ${Math.round(combustion)} % · combustion ↑` : "coal plant · shut down"}
      </SceneLabel>
      </group>
      {CHIMNEY_TOPS.map((top, i) => (
        <FluxStream key={i} from={top} to={[AIR_OVER_PLANT[0] + (i === 0 ? -0.3 : 0.3), AIR_OVER_PLANT[1], AIR_OVER_PLANT[2]]} rateRef={combustionRef} colour={COLOURS.combustion} count={70} travel={2.4} lift={0} spread={0.55} size={0.075} seed={31 + i} emissive={false} opacity={0.7} />
      ))}
    </group>
  );
}

// ─── The sea ────────────────────────────────────────────────────────

/** Dissolved CO₂ and carbonate ions drifting in the basin. */
function Carbonates({ count = 48, seed = 61 }) {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seats = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (hashRandom(seed + i * 1.9) - 0.5) * (OCEAN.size[0] - 0.4),
        y: -0.1 - hashRandom(seed * 2 + i * 2.7) * (OCEAN.size[1] - 0.25),
        z: (hashRandom(seed * 3 + i * 3.1) - 0.5) * (OCEAN.size[2] - 0.4),
        phase: hashRandom(seed * 5 + i * 0.7) * Math.PI * 2,
        scale: 0.03 + 0.03 * hashRandom(seed * 7 + i * 1.3),
      })),
    [count, seed],
  );
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      const s = seats[i];
      dummy.position.set(OCEAN.centre[0] + s.x + 0.08 * Math.sin(t * 0.4 + s.phase), s.y + 0.05 * Math.sin(t * 0.6 + s.phase * 1.7), OCEAN.centre[2] + s.z + 0.08 * Math.cos(t * 0.35 + s.phase));
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={COLOURS.carbonate} transparent opacity={0.7} depthWrite={false} />
    </instancedMesh>
  );
}

function Ocean({ solved, oceanRef }) {
  const uptaking = solved.oceanUptake >= 0;
  return (
    <group>
      <WaterBody position={OCEAN.centre} size={OCEAN.size} />
      <Carbonates />
      <FluxStream from={AIR_OVER_OCEAN} to={SEA_SURFACE} rateRef={oceanRef} colour={uptaking ? COLOURS.ocean : COLOURS.outgas} count={60} travel={2.4} lift={0.1} spread={1.6} size={0.055} seed={51} />
      <SceneLabel position={[OCEAN.centre[0], 0.45, OCEAN.centre[2] + OCEAN.size[2] / 2 + 0.15]} tone={uptaking ? "text-sky-300" : "text-rose-300"}>
        {uptaking ? `ocean · dissolving CO₂ ↓ · pH ${solved.pH.toFixed(2)}` : `ocean · outgassing CO₂ ↑ · pH ${solved.pH.toFixed(2)}`}
      </SceneLabel>
      <SceneLabel position={[OCEAN.centre[0], -0.55, OCEAN.centre[2] + OCEAN.size[2] / 2 + 0.3]} tone="text-ink-400">
        {`dissolved CO₂ · HCO₃⁻ · CO₃²⁻ · surface at ${Math.round(solved.oceanPpm)} ppm-equivalent`}
      </SceneLabel>
    </group>
  );
}

// ─── The air ────────────────────────────────────────────────────────

/** CO₂ and CH₄ molecules in the greenhouse layer: more of them as the air thickens. */
function GreenhouseMolecules({ ppm, pasture, maxCount = 260, seed = 71 }) {
  const meshRef = useRef(null);
  const state = useRef({ shown: 0, dirty: true, dummy: new THREE.Object3D(), colour: new THREE.Color() });
  const seats = useMemo(
    () =>
      Array.from({ length: maxCount }, (_, i) => {
        const a = hashRandom(seed + i * 1.7) * Math.PI * 2;
        const r = Math.sqrt(hashRandom(seed * 2 + i * 2.3)) * (DOME_RADIUS - 1.2);
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          y: ENVELOPE_Y - 0.55 + hashRandom(seed * 3 + i * 3.7) * 1.1,
          phase: hashRandom(seed * 5 + i * 0.9) * Math.PI * 2,
          methane: hashRandom(seed * 7 + i * 1.1),
        };
      }),
    [maxCount, seed],
  );
  const target = clamp(18 + ppm / 7, 0, maxCount);
  const methaneShare = clamp(pasture * 0.35, 0, 0.35);
  useFrame(({ clock }, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const s = state.current;
    const dt = Math.min(rawDelta, 1 / 30);
    s.shown += (target - s.shown) * (1 - Math.exp(-dt * 2));
    const t = clock.elapsedTime;
    const d = s.dummy;
    let colourDirty = s.dirty;
    for (let i = 0; i < maxCount; i += 1) {
      const seat = seats[i];
      const presence = clamp(s.shown - i, 0, 1);
      d.position.set(seat.x + 0.15 * Math.sin(t * 0.5 + seat.phase), seat.y + 0.08 * Math.sin(t * 0.8 + seat.phase * 1.3), seat.z + 0.15 * Math.cos(t * 0.45 + seat.phase));
      d.scale.setScalar(0.07 * presence);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      if (s.dirty || s.lastMethane !== methaneShare) {
        s.colour.set(seat.methane < methaneShare ? COLOURS.ch4 : COLOURS.co2);
        mesh.setColorAt(i, s.colour);
        colourDirty = true;
      }
    }
    s.dirty = false;
    s.lastMethane = methaneShare;
    mesh.instanceMatrix.needsUpdate = true;
    if (colourDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, maxCount]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} transparent opacity={0.8} depthWrite={false} />
    </instancedMesh>
  );
}

function Atmosphere({ solved, longwave, shortRef, longRef, trapRef }) {
  const warmth = clamp(solved.anomaly / 6, 0, 1);
  const tint = useMemo(() => `#${new THREE.Color(ECO_COLOURS.sky).lerp(new THREE.Color(COLOURS.warm), warmth).getHexString()}`, [warmth]);
  const opacity = 0.035 + 0.12 * clamp((solved.opacity - 0.45) / 0.55, 0, 1);
  return (
    <group>
      <SkyEnvelope radius={DOME_RADIUS} opacity={opacity} tint={tint} />
      {/* The greenhouse layer: a faint band at the height the longwave is caught. */}
      <mesh position={[0, ENVELOPE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, Math.sqrt(DOME_RADIUS * DOME_RADIUS - ENVELOPE_Y * ENVELOPE_Y), 64]} />
        <meshBasicMaterial color={longwave ? COLOURS.warm : ECO_COLOURS.sky} transparent opacity={longwave ? 0.04 + 0.12 * solved.opacity : 0.03} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <GreenhouseMolecules ppm={solved.ppm} pasture={solved.pasture} />
      <PhotonShower mode="shortwave" origin={SUN.position} ground={{ x: 0, z: 0, w: 12, d: 7, y: 0 }} envelopeY={ENVELOPE_Y} escapeY={DOME_RADIUS + 1} rateRef={shortRef} albedo={0.3} count={140} velocity={5} size={0.05} seed={81} />
      <PhotonShower mode="longwave" ground={{ x: 0, z: 0, w: 12, d: 7, y: 0 }} envelopeY={ENVELOPE_Y} escapeY={DOME_RADIUS + 1} rateRef={longRef} trapRef={trapRef} count={160} velocity={3.6} size={0.055} seed={82} />
      <SceneLabel position={[3.4, ENVELOPE_Y + 0.45, 4.2]} tone={longwave ? "text-orange-300" : "text-sky-300"}>
        {longwave
          ? `greenhouse layer · CO₂ + CH₄ · ${Math.round(solved.opacity * 100)} % of outgoing IR absorbed`
          : `atmosphere · ${Math.round(solved.ppm)} ppm CO₂ · shortwave passes through`}
      </SceneLabel>
      <SceneLabel position={[4.2, ENVELOPE_Y + 2.2, -1.0]} accent>
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
        return { c, points: [[0.16, y, 0], [0.3, y, 0]] };
      }),
    [],
  );
  return (
    <group position={[THERMO.x, 0, THERMO.z]}>
      <mesh position={[0, THERMO.height / 2 + 0.2, 0]}>
        <cylinderGeometry args={[0.14, 0.14, THERMO.height + 0.1, 16, 1, true]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.2 + fill / 2, 0]}>
        <cylinderGeometry args={[0.085, 0.085, fill, 12]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      {ticks.map((t) => (
        <Line key={t.c} points={t.points} color={PALETTE.slate} lineWidth={1} />
      ))}
      <SceneLabel position={[0, THERMO.height + 0.7, 0]} accent>
        {`${anomaly >= 0 ? "+" : "−"}${Math.abs(anomaly).toFixed(2)} °C`}
      </SceneLabel>
      <SceneLabel position={[0, -0.25, 0]} tone="text-ink-400">
        global mean · vs pre-industrial
      </SceneLabel>
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

// ─── The scene ──────────────────────────────────────────────────────

export default function CarbonCycleCanvas({ params = {}, setParam }) {
  const { combustion = 100, forest = BASELINE_FOREST_PCT, solar = 50, longwave = false, reset = 0, speed = 1 } = params || {};
  const controls = useMemo(() => ({ combustion: Number(combustion) || 0, forest: Number(forest) || BASELINE_FOREST_PCT, solar: Number(solar) || 0 }), [combustion, forest, solar]);

  // One ref per stream; the driver writes them every frame, the particles read them.
  const photoRef = useRef(0);
  const respRef = useRef(0);
  const combustionRef = useRef(0);
  const livestockRef = useRef(0);
  const oceanRef = useRef(0);
  const trapRef = useRef(0.7);
  const shortRef = useRef(0);
  const longRef = useRef(0);
  const rates = useMemo(
    () => ({ photosynthesis: photoRef, respiration: respRef, combustion: combustionRef, livestock: livestockRef, ocean: oceanRef, trap: trapRef }),
    [],
  );

  const [solved, setSolved] = useState(() => solveCarbon(initialCarbonState(), controls));

  // Which photons are drawn is the toggle; the physics does not care.
  const sunK = 0.6 + 0.8 * clamp(solar / 100, 0, 1);
  useEffect(() => {
    shortRef.current = longwave ? 0 : 14 + 16 * sunK;
    longRef.current = longwave ? 26 : 0;
  }, [longwave, sunK]);

  return (
    <SceneCanvas
      camera={{ position: [0.6, 8.2, 18.5], fov: 44 }}
      controls={{ minDistance: 6, maxDistance: 38, target: [0, 1.4, 0], maxPolarAngle: Math.PI * 0.49 }}
      lights={{ ambient: 0.45 + 0.2 * sunK, keyLight: 0.6 + 0.9 * sunK, rim: ECO_COLOURS.sky }}
    >
      <CarbonDriver controls={controls} speed={speed} resetToken={reset} rates={rates} onTick={setSolved} setParam={setParam} />

      <SunSource position={SUN.position} intensity={sunK} radius={0.7} label={`sun · ${solarLabel(solar)}`} />
      <DioramaSlab size={SLAB.size} />
      <Forest forest={forest} photoRef={photoRef} respRef={respRef} />
      <Pasture pasture={solved.pasture} livestockRef={livestockRef} />
      <CoalPlant combustion={combustion} combustionRef={combustionRef} />
      <Ocean solved={solved} oceanRef={oceanRef} />
      <Atmosphere solved={solved} longwave={longwave} shortRef={shortRef} longRef={longRef} trapRef={trapRef} />
      <Thermometer anomaly={solved.anomaly} />
      <BudgetChart solved={solved} />

      <SceneLabel position={[0, -1.35, 4.9]} tone="text-ink-400">
        {`${SIM_YEARS_PER_SECOND * speed} sim-years per second · year ${solved.year.toFixed(0)} · ${longwave ? "showing re-radiated longwave IR" : "showing incoming shortwave sunlight"}`}
      </SceneLabel>

      <SceneReadout
        title="Carbon cycle"
        subtitle={`year ${solved.year.toFixed(0)} · combustion ${combustion} % · forest ${forest} %`}
        rows={[
          ["Atmospheric CO₂", `${Math.round(solved.ppm)} ppm`],
          ["Temperature anomaly", `${solved.anomaly >= 0 ? "+" : "−"}${Math.abs(solved.anomaly).toFixed(2)} °C`],
          ["Exchange balance", `${solved.net >= 0 ? "+" : "−"}${Math.abs(solved.net).toFixed(1)} GtC/yr`],
        ]}
      />
      <SceneLegend
        title="Carbon flows"
        items={[
          { color: COLOURS.photosynthesis, label: "Photosynthesis", note: "air → leaves" },
          { color: COLOURS.respiration, label: "Respiration", note: "living things → air" },
          { color: COLOURS.combustion, label: "Combustion", note: "fossil carbon → air" },
          { color: COLOURS.ocean, label: "Ocean uptake", note: "air → sea" },
        ]}
      />
    </SceneCanvas>
  );
}
