"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import {
  AMBIENT_C,
  LOOP_LENGTH,
  ROD_LENGTH,
  ROD_MATERIALS,
  TIME_LAPSE,
  WAX_MELTING_C,
  absorbedPower,
  flameColour,
  flameIsLit,
  flameTemperature,
  flirColour,
  irradianceAt,
  mixHex,
  nodeTimeConstant,
  SHINY_EMISSIVITY,
  plateEquilibrium,
  plateTimeConstant,
  radiatedPower,
  relax,
  steadyExcessFraction,
  stepWaterMean,
  waterFrom,
} from "@/lib/heatTransfer";

// ─── Conduction, convection and radiation, in one scene ─────────────
// A Bunsen under a beaker, four rods leaning out of it, dye tracing the
// current inside it, and a blackened plate standing off to one side touching
// nothing at all.
//
// The reason all of it is on screen at once is that the three modes are only
// meaningful against each other. Taught one at a time they collapse into three
// definitions with nothing to distinguish them; seen together, each is
// obviously doing something the others cannot. The rods carry heat without
// anything moving between them. The water carries heat by physically moving,
// and you can watch the dye do it. The plate warms with nothing between it and
// the flame but air the radiation passes straight through. Switching the view
// mode changes how they are DRAWN — false colour or vibrating atoms — but
// never which of them is visible, because hiding two thirds of the comparison
// would defeat the scene.
//
// Temperatures are integrated here rather than read off a closed form, so that
// turning the gas down halfway through cools the apparatus from where it
// actually is. `lib/heatTransfer.js` owns every rate; this file owns only the
// clock and the geometry.
// ─────────────────────────────────────────────────────────────────────

/** World units per centimetre of apparatus. */
const S = 0.23;
const cm = (v) => v * S;

const BENCH_Y = -2.6;
/** Beaker geometry, centimetres. */
const BEAKER = { radius: 4, height: 11, waterDepth: 9, wall: 0.25 };
const BEAKER_BASE_Y = 0.06;
const WATER_BOTTOM_Y = BEAKER_BASE_Y + cm(0.4);
const WATER_TOP_Y = WATER_BOTTOM_Y + cm(BEAKER.waterDepth);
const RIM_Y = BEAKER_BASE_Y + cm(BEAKER.height);

/** The rods, drawn at true length: 20 cm of a 4 cm-wide beaker. */
const ROD_WORLD = cm(ROD_LENGTH * 100);
/** How much of each rod is under the water. The rest leans out into the air. */
const ROD_SUBMERGED = 1.5;
const ROD_EXPOSED = ROD_WORLD - ROD_SUBMERGED;
const ROD_RADIUS_W = cm(0.5);
/** Nodes per rod — the resolution of both the colour ramp and the model. */
const ROD_NODES = 18;

/** Where the blackened plate stands: 15 cm from the flame, touching nothing. */
const PLATE_X = -cm(15);
const FLAME_Y = BENCH_Y + 1.3;

const WAX_POSITIONS = [0.3, 0.5, 0.7, 0.88];

/**
 * The four rods, splayed symmetrically so no two overlap from the front.
 *
 * Angle is measured from +x. The pair on each side share the same two angles,
 * so the layout cannot be read as one rod having been given an easier run than
 * another — the only difference between them is the material.
 */
const ROD_LAYOUT = [
  { key: "copper", angle: 30, side: 1 },
  { key: "iron", angle: 60, side: 1 },
  { key: "glass", angle: 120, side: -1 },
  { key: "wood", angle: 150, side: -1 },
];

const DEG = Math.PI / 180;
const SCRATCH_COLOUR = new THREE.Color();
const SCRATCH_OBJECT = new THREE.Object3D();

/** Node `i`'s distance from the hot end, in metres. */
const nodeX = (i) => ((i + 0.5) / ROD_NODES) * ROD_LENGTH;
/** …and its position along the rod's own axis, in world units. */
const nodeY = (i) => -ROD_SUBMERGED + ((i + 0.5) / ROD_NODES) * ROD_WORLD;

// ─── The model ──────────────────────────────────────────────────────

/**
 * A mutable snapshot of the apparatus, stepped once per frame.
 *
 * Deliberately not React state. Every rod node, every dye particle and every
 * thermometer wants the newest number sixty times a second, and pushing that
 * through a re-render would spend the whole frame budget on reconciliation.
 * The numbers a human actually reads are sampled out of here on a throttle
 * instead — see `SAMPLE_HZ`.
 */
function createModel() {
  const rods = {};
  for (const { key } of ROD_LAYOUT) {
    rods[key] = { nodes: new Float32Array(ROD_NODES).fill(AMBIENT_C), tipC: AMBIENT_C, waxFront: 0 };
  }
  return {
    seconds: 0,
    waterMean: AMBIENT_C,
    water: waterFrom(AMBIENT_C, 0),
    plateC: AMBIENT_C,
    shinyC: AMBIENT_C,
    flame: { lit: false, temperatureC: AMBIENT_C, colour: flameColour(0), height: 0 },
    radiated: 0,
    irradiance: 0,
    absorbed: 0,
    hottestC: AMBIENT_C + 40,
    rods,
  };
}

/** How often the printed numbers refresh. The physics runs every frame. */
const SAMPLE_HZ = 6;

/**
 * The clock. Renders nothing; steps everything.
 *
 * Rendered first inside the canvas so its `useFrame` subscribes before the
 * components that read what it writes — a one-frame lag would be harmless, but
 * there is no reason to have one.
 */
function ThermalDriver({ modelRef, intensity, onSample, animSpeed = 1 }) {
  const since = useRef(0);

  useFrame((_, delta) => {
    const m = modelRef.current;
    // A backgrounded tab hands back a frame that lasted a minute. Integrated
    // in one go at 8× that would boil the beaker between two paints.
    const dt = Math.min(delta, 0.05) * animSpeed;
    m.seconds += dt;

    // Water: one first-order lag toward wherever this flame would take it,
    // capped at the boil by `waterFrom`.
    m.waterMean = stepWaterMean(m.waterMean, intensity, dt);
    m.water = waterFrom(m.waterMean, intensity);

    // Rods: every node chases its own steady value with its own time
    // constant, which is what makes the warm front visibly race up the copper
    // and crawl up the iron rather than both simply fading in together.
    const hot = m.water.bottom;
    for (const { key } of ROD_LAYOUT) {
      const rod = m.rods[key];
      let melted = 0;
      for (let i = 0; i < ROD_NODES; i += 1) {
        const x = nodeX(i);
        const target = AMBIENT_C + (hot - AMBIENT_C) * steadyExcessFraction(key, x);
        rod.nodes[i] = relax(rod.nodes[i], target, nodeTimeConstant(key, x), dt);
        if (rod.nodes[i] >= WAX_MELTING_C) melted += 1;
      }
      rod.tipC = rod.nodes[ROD_NODES - 1];
      rod.waxFront = melted / ROD_NODES;
    }

    // The plate, warmed by radiation alone.
    const plateTarget = plateEquilibrium(intensity);
    m.plateC = relax(m.plateC, plateTarget, plateTimeConstant(Math.max(plateTarget, AMBIENT_C)), dt);
    // Its silvered twin: same flame, same distance, a surface that reflects
    // nearly everything that reaches it.
    const shinyTarget = plateEquilibrium(intensity, undefined, undefined, SHINY_EMISSIVITY);
    m.shinyC = relax(
      m.shinyC,
      shinyTarget,
      plateTimeConstant(Math.max(shinyTarget, AMBIENT_C), SHINY_EMISSIVITY),
      dt,
    );

    const lit = flameIsLit(intensity);
    m.flame.lit = lit;
    m.flame.temperatureC = flameTemperature(intensity);
    m.flame.colour = flameColour(intensity);
    m.flame.height = lit ? 0.5 + 1.1 * clamp(intensity / 100, 0, 1) : 0;
    m.radiated = radiatedPower(intensity);
    m.irradiance = irradianceAt(intensity);
    m.absorbed = absorbedPower(intensity);

    // Ceiling for the false-colour ramp. Eased rather than snapped, so the
    // whole image does not re-key every time one probe ticks over.
    const peak = Math.max(m.water.bottom, m.rods.copper.tipC, m.plateC, m.shinyC, AMBIENT_C + 20);
    m.hottestC += (peak - m.hottestC) * Math.min(dt * 1.5, 1);

    since.current += delta;
    if (since.current >= 1 / SAMPLE_HZ) {
      since.current = 0;
      onSample({
        waterBottom: m.water.bottom,
        waterTop: m.water.top,
        delta: m.water.delta,
        speed: m.water.speed,
        boiling: m.water.boiling,
        plateC: m.plateC,
        shinyC: m.shinyC,
        hottestC: m.hottestC,
        tips: Object.fromEntries(ROD_LAYOUT.map(({ key }) => [key, m.rods[key].tipC])),
      });
    }
  });

  return null;
}

// ─── Bench, burner and flame ────────────────────────────────────────

// ─── The lab ────────────────────────────────────────────────────────

/**
 * The room behind the bench: a light wall, a floor, a shelf of reagent bottles
 * (one of them the potassium permanganate the dye comes from), and a clock.
 *
 * The clock is there for a reason. The scene runs at TIME_LAPSE times real
 * speed, and a caption saying so is easy to skim past; a clock whose hands
 * visibly race, and whose reading is the REAL elapsed time the apparatus would
 * have needed, makes the point without a word.
 */
const WALL_Z = -3.4;
const FLOOR_Y = -3.3;

function Room({ modelRef }) {
  const minute = useRef(null);
  const second = useRef(null);

  useFrame(() => {
    const s = modelRef.current.seconds * TIME_LAPSE;
    if (second.current) second.current.rotation.z = -((s % 60) / 60) * Math.PI * 2;
    if (minute.current) minute.current.rotation.z = -(s / 3600) * Math.PI * 2;
  });

  const bottles = [
    { x: -7.3, colour: "#f9a8d4", height: 0.78 },
    { x: -6.55, colour: "#a7f3d0", height: 0.62 },
    { x: -5.8, colour: "#c4b5fd", height: 0.72, label: "KMnO₄" },
    { x: -5.05, colour: "#fde68a", height: 0.66 },
  ];

  return (
    <group>
      {/* Back wall, skirting and floor. */}
      <mesh position={[0, 2.2, WALL_Z]}>
        <planeGeometry args={[40, 11]} />
        <meshStandardMaterial color="#c3cee0" roughness={0.95} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.14, WALL_Z + 0.04]}>
        <boxGeometry args={[40, 0.28, 0.08]} />
        <meshStandardMaterial color="#9eabbf" roughness={0.8} />
      </mesh>
      <mesh position={[0, FLOOR_Y, WALL_Z + 8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 16]} />
        <meshStandardMaterial color="#a2afc4" roughness={0.9} />
      </mesh>

      {/* Shelf and bottles. */}
      <mesh position={[-6.2, 2.75, WALL_Z + 0.32]}>
        <boxGeometry args={[3.6, 0.09, 0.62]} />
        <meshStandardMaterial color="#d9c3a3" roughness={0.7} />
      </mesh>
      {[-7.7, -4.7].map((x) => (
        <mesh key={x} position={[x, 2.6, WALL_Z + 0.32]}>
          <boxGeometry args={[0.07, 0.3, 0.55]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.4} />
        </mesh>
      ))}
      {bottles.map((b) => (
        <group key={b.x} position={[b.x, 2.8 + b.height / 2, WALL_Z + 0.32]}>
          <mesh>
            <cylinderGeometry args={[0.27, 0.27, b.height, 18]} />
            <meshStandardMaterial color={b.colour} transparent opacity={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, b.height / 2 + 0.11, 0]}>
            <cylinderGeometry args={[0.1, 0.13, 0.22, 14]} />
            <meshStandardMaterial color={b.colour} transparent opacity={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, b.height / 2 + 0.26, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.1, 14]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.275]}>
            <planeGeometry args={[0.36, 0.26]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <SceneLabel position={[-5.8, 3.95, WALL_Z + 0.5]} tone="text-ink-400">
        KMnO₄ — the dye
      </SceneLabel>

      {/* Wall clock, running at the scene's rate. */}
      <group position={[6.5, 5.7, WALL_Z + 0.05]}>
        <mesh>
          <circleGeometry args={[0.85, 40]} />
          <meshStandardMaterial color="#fafcff" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <torusGeometry args={[0.85, 0.07, 10, 44]} />
          <meshStandardMaterial color="#8593a8" roughness={0.4} metalness={0.3} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.sin(a) * 0.68, Math.cos(a) * 0.68, 0.02]}
              rotation={[0, 0, -a]}
            >
              <boxGeometry args={[0.04, i % 3 === 0 ? 0.16 : 0.09, 0.01]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
          );
        })}
        <group ref={minute} position={[0, 0, 0.03]}>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.055, 0.58, 0.012]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
        <group ref={second} position={[0, 0, 0.045]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.022, 0.68, 0.012]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.06]}>
          <circleGeometry args={[0.06, 12]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <SceneLabel position={[0, 1.3, 0.2]} tone="text-ink-400">
          {`lab clock · runs ${TIME_LAPSE}× fast`}
        </SceneLabel>
      </group>
    </group>
  );
}

/**
 * The bench: a worktop on a cabinet, with a heat-proof mat under the burner and
 * a centimetre rule laid out from the flame to the plates.
 *
 * The rule is the honest version of the "15 cm of air" caption. The whole
 * radiation half of the topic is an inverse-square law in that distance, and a
 * distance that is only written down is one nobody checks.
 */
function Bench({ intensity }) {
  const ruleZ = 1.72;
  const ticks = useMemo(() => {
    const positions = [];
    for (let i = 0; i <= 15; i += 1) {
      const x = -cm(i);
      const len = i % 5 === 0 ? 0.2 : 0.1;
      positions.push(x, BENCH_Y + 0.07, ruleZ - 0.14, x, BENCH_Y + 0.07, ruleZ - 0.14 + len);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);
  useEffect(() => () => ticks.dispose(), [ticks]);

  return (
    <group>
      {/* Worktop and cabinet. */}
      <mesh position={[0, BENCH_Y - 0.08, 0]}>
        <boxGeometry args={[15, 0.16, 5.6]} />
        <meshStandardMaterial color="#cfd8e5" roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0, BENCH_Y - 0.16 - 0.25, -0.1]}>
        <boxGeometry args={[14.4, 0.5, 5.2]} />
        <meshStandardMaterial color="#dde4ee" roughness={0.7} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.07, -0.1]}>
        <boxGeometry args={[14.4, 0.14, 5]} />
        <meshStandardMaterial color="#9aa8bc" roughness={0.8} />
      </mesh>
      {[-4.8, 0, 4.8].map((x) => (
        <group key={x}>
          <mesh position={[x, BENCH_Y - 0.43, 2.51]}>
            <boxGeometry args={[4.5, 0.4, 0.03]} />
            <meshStandardMaterial color="#e2e8f2" roughness={0.6} />
          </mesh>
          <mesh position={[x, BENCH_Y - 0.33, 2.56]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.7, 8]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Heat-proof mat. */}
      <mesh position={[-1.7, BENCH_Y + 0.015, 0]}>
        <boxGeometry args={[7.6, 0.03, 3.4]} />
        <meshStandardMaterial color="#aebbd0" roughness={0.95} />
      </mesh>

      {/* The rule, flame to plate. */}
      <mesh position={[PLATE_X / 2, BENCH_Y + 0.035, ruleZ]}>
        <boxGeometry args={[Math.abs(PLATE_X) + 0.25, 0.03, 0.34]} />
        <meshStandardMaterial color="#fde9a2" roughness={0.6} />
      </mesh>
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color="#64748b" />
      </lineSegments>
      <SceneLabel position={[0.05, BENCH_Y + 0.32, ruleZ]} tone="text-ink-400">
        0
      </SceneLabel>
      <SceneLabel position={[PLATE_X / 2, BENCH_Y + 0.32, ruleZ]} tone="text-ink-400">
        15 cm from the flame
      </SceneLabel>

      <GasSupply intensity={intensity} />
    </group>
  );
}

/**
 * The gas tap on the bench and the hose that runs from it to the burner. The
 * knob turns with the flame slider, so "open the gas" is something you can see
 * being done rather than a number that changed.
 */
function GasSupply({ intensity }) {
  const hose = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.1, BENCH_Y + 0.25, -1.55),
      new THREE.Vector3(1.75, BENCH_Y + 0.08, -0.95),
      new THREE.Vector3(1.05, BENCH_Y + 0.07, -0.4),
      new THREE.Vector3(0.4, BENCH_Y + 0.1, -0.05),
      new THREE.Vector3(cm(0.95) + 0.03, BENCH_Y + 0.34, 0),
    ]);
    return new THREE.TubeGeometry(curve, 40, 0.055, 8, false);
  }, []);
  useEffect(() => () => hose.dispose(), [hose]);

  const open = clamp(intensity / 100, 0, 1);
  return (
    <group>
      <mesh geometry={hose}>
        <meshStandardMaterial color="#5b6b82" roughness={0.75} />
      </mesh>
      <mesh position={[2.1, BENCH_Y + 0.3, -1.6]}>
        <boxGeometry args={[0.34, 0.6, 0.34]} />
        <meshStandardMaterial color="#c6a25a" roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh position={[2.1, BENCH_Y + 0.72, -1.6]}>
        <cylinderGeometry args={[0.07, 0.07, 0.24, 10]} />
        <meshStandardMaterial color="#c6a25a" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* The knob: a lever that swings from crosswise (shut) to in-line (open). */}
      <group position={[2.1, BENCH_Y + 0.86, -1.6]} rotation={[0, open * (Math.PI / 2), 0]}>
        <mesh>
          <boxGeometry args={[0.62, 0.08, 0.1]} />
          <meshStandardMaterial color={open > 0.02 ? "#f59e0b" : "#ef4444"} roughness={0.5} />
        </mesh>
      </group>
      <SceneLabel position={[2.1, BENCH_Y + 1.35, -1.6]} tone="text-ink-400">
        {open > 0.02 ? "gas tap · open" : "gas tap · shut"}
      </SceneLabel>
    </group>
  );
}

/**
 * The burner and its flame.
 *
 * Two cones, because a Bunsen flame has two: a cool inner cone of unburnt gas
 * and the hot outer envelope where combustion actually happens. Both scale and
 * recolour with the gas — a lazy luminous yellow at a whisper, a roaring blue
 * wide open — and the flicker is deterministic noise rather than a random
 * walk, so it never drifts into a shape the eye reads as a bug.
 */
function BunsenBurner({ modelRef, animSpeed = 1 }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const glow = useRef(null);

  useFrame((state) => {
    const m = modelRef.current;
    const t = state.clock.elapsedTime * animSpeed;
    const h = m.flame.height;
    const flicker = 1 + 0.06 * Math.sin(t * 11.3) + 0.035 * Math.sin(t * 19.7 + 1.1);

    if (outer.current) {
      outer.current.visible = h > 0.01;
      outer.current.scale.set(1, h * flicker, 1);
      outer.current.position.y = FLAME_Y + (h * flicker) / 2;
      outer.current.material.color.set(m.flame.colour);
      outer.current.material.emissive.set(m.flame.colour);
    }
    if (inner.current) {
      inner.current.visible = h > 0.01 && m.flame.temperatureC > 700;
      inner.current.scale.set(1, h * 0.45 * flicker, 1);
      inner.current.position.y = FLAME_Y + (h * 0.45 * flicker) / 2;
    }
    if (glow.current) {
      glow.current.intensity = h * 5.5;
      glow.current.color.set(m.flame.colour);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Base, barrel and the air collar that decides the flame's colour. */}
      <mesh position={[0, BENCH_Y + 0.09, 0]}>
        <cylinderGeometry args={[cm(3.4), cm(4), 0.18, 24]} />
        <meshStandardMaterial color="#8593a8" roughness={0.5} metalness={0.55} />
      </mesh>
      <mesh position={[0, (BENCH_Y + FLAME_Y) / 2, 0]}>
        <cylinderGeometry args={[cm(0.75), cm(0.9), FLAME_Y - BENCH_Y, 20]} />
        <meshStandardMaterial color="#8593a8" roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[0, BENCH_Y + 0.55, 0]}>
        <cylinderGeometry args={[cm(1.1), cm(1.1), 0.26, 20]} />
        <meshStandardMaterial color="#b9c4d4" roughness={0.3} metalness={0.85} />
      </mesh>
      {/* The air hole in the collar — the thing that turns the flame blue. */}
      <mesh position={[0, BENCH_Y + 0.55, cm(1.1) + 0.005]}>
        <planeGeometry args={[0.13, 0.13]} />
        <meshBasicMaterial color="#1e293b" />
      </mesh>
      {/* The needle valve at the base, where the hose joins. */}
      <mesh position={[cm(0.95) + 0.05, BENCH_Y + 0.34, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.085, 0.085, 0.16, 12]} />
        <meshStandardMaterial color="#c6a25a" roughness={0.35} metalness={0.6} />
      </mesh>

      {/* Unit-height cones, scaled in the frame loop. */}
      <mesh ref={outer} position={[0, FLAME_Y, 0]}>
        <coneGeometry args={[cm(1.15), 1, 18]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={2.4}
          toneMapped={false}
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={inner} position={[0, FLAME_Y, 0]}>
        <coneGeometry args={[cm(0.62), 1, 14]} />
        <meshStandardMaterial
          color="#1d4ed8"
          emissive="#3b82f6"
          emissiveIntensity={2.8}
          toneMapped={false}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      <pointLight ref={glow} position={[0, FLAME_Y + 0.5, 0]} intensity={0} distance={9} decay={2} />
    </group>
  );
}

function Tripod() {
  const legs = [0, 120, 240];
  return (
    <group>
      {legs.map((a) => {
        const r = cm(5.4);
        const x = Math.cos(a * DEG) * r;
        const z = Math.sin(a * DEG) * r;
        return (
          <mesh key={a} position={[x * 0.72, (BENCH_Y + 0) / 2, z * 0.72]} rotation={[z * 0.09, 0, -x * 0.09]}>
            <cylinderGeometry args={[0.045, 0.045, Math.abs(BENCH_Y), 10]} />
            <meshStandardMaterial color="#8593a8" roughness={0.4} metalness={0.75} />
          </mesh>
        );
      })}
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[cm(4.6), 0.045, 8, 30]} />
        <meshStandardMaterial color="#8593a8" roughness={0.4} metalness={0.75} />
      </mesh>
      {/* Ceramic-centred gauze — what actually spreads the flame. */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[cm(11), cm(11)]} />
        <meshStandardMaterial color="#a4afbf" roughness={0.85} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[cm(3.2), 24]} />
        <meshStandardMaterial color="#d6d3ce" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── The beaker, and the water convecting in it ─────────────────────

/**
 * The water, drawn as a stack of discs so the top-to-bottom gradient is a
 * gradient rather than an assertion.
 *
 * In false-colour mode each disc takes the temperature its own height would
 * have; in the normal view they stay water-coloured and only tint. Either way
 * the bottom is warmer than the top, which is what drives everything else in
 * the beaker.
 */
function WaterColumn({ modelRef, flir }) {
  const discs = 9;
  const refs = useRef([]);
  const height = WATER_TOP_Y - WATER_BOTTOM_Y;

  useFrame(() => {
    const m = modelRef.current;
    for (let i = 0; i < discs; i += 1) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      // Disc 0 is the bottom, so it takes the bottom temperature.
      const f = i / (discs - 1);
      const t = m.water.bottom + (m.water.top - m.water.bottom) * f;
      mesh.material.color.set(
        flir ? flirColour(t, AMBIENT_C, m.hottestC) : mixHex("#63b8e0", "#f2905a", clamp((t - 20) / 80, 0, 1)),
      );
    }
  });

  return (
    <group>
      {Array.from({ length: discs }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[0, WATER_BOTTOM_Y + (height * (i + 0.5)) / discs, 0]}
        >
          <cylinderGeometry args={[cm(BEAKER.radius - BEAKER.wall), cm(BEAKER.radius - BEAKER.wall), height / discs, 30, 1, true]} />
          <meshStandardMaterial
            color="#63b8e0"
            transparent
            opacity={flir ? 0.62 : 0.4}
            roughness={0.2}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <mesh position={[0, WATER_TOP_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[cm(BEAKER.radius - BEAKER.wall), 30]} />
        <meshStandardMaterial color="#b4e6f8" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function BeakerGlass() {
  return (
    <group>
      <mesh position={[0, BEAKER_BASE_Y, 0]}>
        <cylinderGeometry args={[cm(BEAKER.radius), cm(BEAKER.radius), cm(0.5), 32]} />
        <meshStandardMaterial color="#9fd6e8" transparent opacity={0.24} roughness={0.1} />
      </mesh>
      <mesh position={[0, BEAKER_BASE_Y + cm(BEAKER.height) / 2, 0]}>
        <cylinderGeometry args={[cm(BEAKER.radius), cm(BEAKER.radius), cm(BEAKER.height), 34, 1, true]} />
        {/* Plain alpha, not `transmission`: a transmissive material makes three
            render the WHOLE scene a second time into an offscreen buffer every
            frame, and this scene has a room in it now. */}
        <meshStandardMaterial
          color="#9fd6e8"
          transparent
          opacity={0.17}
          roughness={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Graduation and spout — it is a Pyrex beaker, not a jar. */}
      <mesh position={[0, WATER_TOP_Y + cm(0.6), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[cm(BEAKER.radius), 0.012, 6, 34]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, RIM_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[cm(BEAKER.radius), 0.022, 8, 34]} />
        <meshStandardMaterial color="#c3e6f2" transparent opacity={0.35} roughness={0.1} />
      </mesh>
    </group>
  );
}

/**
 * The graduations printed on the beaker: 50 mL steps up to the 250 mL the water
 * is poured to, long marks at 100 and 200.
 */
function BeakerMarks() {
  const ticks = useMemo(() => {
    const positions = [];
    const R = cm(BEAKER.radius) + 0.006;
    for (let ml = 50; ml <= 250; ml += 50) {
      const y = WATER_BOTTOM_Y + ((ml / 250) * BEAKER.waterDepth * S);
      const long = ml % 100 === 0;
      const a1 = 0.55;
      const a2 = long ? 0.9 : 0.78;
      positions.push(R * Math.sin(a1), y, R * Math.cos(a1), R * Math.sin(a2), y, R * Math.cos(a2));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);
  useEffect(() => () => ticks.dispose(), [ticks]);
  return (
    <lineSegments geometry={ticks}>
      <lineBasicMaterial color="#64748b" />
    </lineSegments>
  );
}

/**
 * Bubbles rising from the hot floor of the beaker, and steam above it.
 *
 * Nothing in the water changed between a beaker at 30 °C and one at 99 °C except
 * temperature, and a scene that shows no bubbles at the boil is asking the eye
 * to believe a number. The count follows how hot the bottom is (dissolved gas
 * comes out first, then the boil proper), and the steam follows the boil
 * fraction the model already computes — the moment the thermometer stops rising
 * is the moment the steam starts, which is the latent-heat point made visible.
 */
function BoilingBubbles({ modelRef, animSpeed = 1 }) {
  const bubbles = useRef(null);
  const steam = useRef(null);
  const nBubbles = 60;
  const nSteam = 24;
  const inner = cm(BEAKER.radius - BEAKER.wall);

  const seeds = useMemo(
    () =>
      Array.from({ length: nBubbles }, (_, i) => ({
        angle: hashRandom(i * 2.3 + 1) * Math.PI * 2,
        radius: Math.sqrt(hashRandom(i * 3.1 + 5)) * inner * 0.82,
        rate: 0.5 + hashRandom(i * 4.7 + 9) * 0.9,
        offset: hashRandom(i * 6.1 + 13),
        size: 0.55 + hashRandom(i * 7.3 + 17) * 0.9,
      })),
    [inner],
  );
  const steamSeeds = useMemo(
    () =>
      Array.from({ length: nSteam }, (_, i) => ({
        angle: hashRandom(i * 2.9 + 3) * Math.PI * 2,
        radius: Math.sqrt(hashRandom(i * 3.7 + 7)) * inner * 0.7,
        rate: 0.18 + hashRandom(i * 5.1 + 11) * 0.22,
        offset: hashRandom(i * 6.7 + 19),
      })),
    [inner],
  );

  useFrame((state) => {
    const m = modelRef.current;
    const t = state.clock.elapsedTime * animSpeed;
    const activity = clamp((m.water.bottom - 55) / 45, 0, 1);
    const boil = m.water.boilFraction;
    const depth = WATER_TOP_Y - WATER_BOTTOM_Y;

    const b = bubbles.current;
    if (b) {
      const shown = Math.floor(nBubbles * activity * (0.35 + 0.65 * boil + 0.2));
      for (let i = 0; i < nBubbles; i += 1) {
        const s = seeds[i];
        const phase = (t * s.rate * (0.5 + boil) + s.offset) % 1;
        const live = i < shown;
        SCRATCH_OBJECT.position.set(
          Math.cos(s.angle) * s.radius * (1 + 0.1 * Math.sin(phase * 9 + i)),
          WATER_BOTTOM_Y + 0.05 + phase * (depth - 0.08),
          Math.sin(s.angle) * s.radius,
        );
        SCRATCH_OBJECT.scale.setScalar(live ? s.size * (0.55 + 0.7 * phase) : 0);
        SCRATCH_OBJECT.updateMatrix();
        b.setMatrixAt(i, SCRATCH_OBJECT.matrix);
      }
      b.instanceMatrix.needsUpdate = true;
    }

    const st = steam.current;
    if (st) {
      st.visible = boil > 0.02;
      if (st.visible) {
        for (let i = 0; i < nSteam; i += 1) {
          const s = steamSeeds[i];
          const phase = (t * s.rate + s.offset) % 1;
          SCRATCH_OBJECT.position.set(
            Math.cos(s.angle) * s.radius + Math.sin(phase * 5 + i) * 0.12,
            WATER_TOP_Y + 0.1 + phase * 2.4,
            Math.sin(s.angle) * s.radius,
          );
          SCRATCH_OBJECT.scale.setScalar(0.6 + phase * 2.0);
          SCRATCH_OBJECT.updateMatrix();
          st.setMatrixAt(i, SCRATCH_OBJECT.matrix);
        }
        st.instanceMatrix.needsUpdate = true;
        st.material.opacity = 0.2 * boil;
      }
    }
  });

  return (
    <group>
      <instancedMesh ref={bubbles} args={[undefined, undefined, nBubbles]} frustumCulled={false}>
        <sphereGeometry args={[cm(0.2), 8, 8]} />
        <meshBasicMaterial color="#ecfbff" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={steam} args={[undefined, undefined, nSteam]} frustumCulled={false} visible={false}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/**
 * Potassium permanganate, tracing the convection current.
 *
 * The roll is two counter-rotating cells: water rises up the middle where the
 * flame is, spreads across the surface, sinks down the cool walls and runs
 * back along the floor. Each particle rides an ellipse in one cell, and the
 * whole system's angular rate comes from the model's flow speed — which is
 * derived from the buoyancy the flame supplies, not chosen to look right. Turn
 * the gas down and the dye visibly slows; turn it off and it drifts to a stop.
 *
 * Instanced, because a convincing current needs a couple of hundred specks and
 * two hundred draw calls to say one thing would be indefensible.
 *
 * Nothing here is disposed by hand and nothing needs to be: the geometry and
 * the material are declared as JSX children, and R3F's `removeChild` calls
 * `dispose()` on the instanced mesh itself at unmount — which is what fires
 * three's `onInstancedMeshDispose` and releases the `instanceMatrix` and
 * `instanceColor` GPU buffers along with them. The scene's `WebGLCleanup`
 * traverses for anything that path missed. What WOULD leak is a geometry built
 * with `new THREE.*` inside a `useMemo`, because React knows nothing about it —
 * there are none in this file, and the two in the buoyancy scene each carry
 * their own disposal effect.
 */
function DyeTracers({ modelRef, dropSignal, animSpeed = 1 }) {
  const meshRef = useRef(null);
  const count = 170;

  const inner = cm(BEAKER.radius - BEAKER.wall);
  const cellX = inner * 0.5;
  const rx = inner * 0.42;
  const ry = (WATER_TOP_Y - WATER_BOTTOM_Y) * 0.38;
  const cellY = (WATER_TOP_Y + WATER_BOTTOM_Y) / 2;

  /** Per-particle constants: which cell, where on the ellipse, how far off it. */
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        side: i % 2 === 0 ? 1 : -1,
        jitterR: 0.55 + hashRandom(i * 1.7 + 3) * 0.6,
        jitterY: 0.55 + hashRandom(i * 2.9 + 11) * 0.62,
        z: (hashRandom(i * 4.1 + 7) - 0.5) * inner * 1.15,
        size: 0.55 + hashRandom(i * 5.3 + 19) * 0.6,
        lead: hashRandom(i * 7.1 + 23),
      })),
    [count, inner],
  );

  const theta = useRef(new Float32Array(count));
  const age = useRef(new Float32Array(count));

  /**
   * Dropping a crystal restarts the trace: every speck goes back to the floor
   * of the beaker at full strength, and the current carries it from there.
   * That is the demonstration — the streak is drawn BY the flow, so its shape
   * is evidence rather than illustration.
   */
  const seed = useCallback(() => {
    for (let i = 0; i < count; i += 1) {
      // Bottom of the ellipse, spread over a short arc: a crystal on the floor.
      theta.current[i] = 1.5 * Math.PI + (seeds[i].lead - 0.5) * 0.9;
      age.current[i] = -seeds[i].lead * 0.35;
    }
  }, [count, seeds]);

  useEffect(() => {
    seed();
  }, [seed, dropSignal]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = modelRef.current;
    const dt = Math.min(delta, 0.05) * animSpeed;

    // Angular rate straight from the modelled flow: one lap of the real
    // 26 cm loop at the real speed, replayed at the scene's time lapse.
    const omega = m.water.speed > 1e-6 ? (2 * Math.PI * TIME_LAPSE * m.water.speed) / LOOP_LENGTH : 0;

    for (let i = 0; i < count; i += 1) {
      const s = seeds[i];
      theta.current[i] = (theta.current[i] + omega * dt) % (Math.PI * 2);
      age.current[i] += dt;

      const th = theta.current[i];
      const x = s.side * (cellX - rx * s.jitterR * Math.cos(th));
      const y = cellY + ry * s.jitterY * Math.sin(th);

      SCRATCH_OBJECT.position.set(x, y, s.z);
      SCRATCH_OBJECT.scale.setScalar(s.size);
      SCRATCH_OBJECT.updateMatrix();
      mesh.setMatrixAt(i, SCRATCH_OBJECT.matrix);

      // Fresh dye is almost black-purple; it thins out as it is stirred
      // through the beaker, and settles to a permanent faint tint so the
      // current stays readable long after the crystal has dissolved.
      const dilution = clamp(Math.max(age.current[i], 0) / 26, 0, 1);
      SCRATCH_COLOUR.set(mixHex("#c026d3", "#f5d0fe", dilution));
      mesh.setColorAt(i, SCRATCH_COLOUR);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  // Give the instance colour buffer to three before its first draw, so the
  // shader is compiled with the instancing-colour path already in it.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    SCRATCH_COLOUR.set("#c026d3");
    for (let i = 0; i < count; i += 1) mesh.setColorAt(i, SCRATCH_COLOUR);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[cm(0.16), 7, 7]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#a21caf"
        emissiveIntensity={0.3}
        roughness={0.6}
        transparent
        opacity={0.88}
      />
    </instancedMesh>
  );
}

/** The roll, called out with two arrows so the dye's path is unambiguous. */
function ConvectionArrows() {
  const inner = cm(BEAKER.radius - BEAKER.wall);
  const mid = (WATER_TOP_Y + WATER_BOTTOM_Y) / 2;
  const loop = (side) => {
    const pts = [];
    for (let i = 0; i <= 40; i += 1) {
      const th = 1.4 * Math.PI + (i / 40) * 1.5 * Math.PI;
      pts.push([
        side * (inner * 0.5 - inner * 0.34 * Math.cos(th)),
        mid + (WATER_TOP_Y - WATER_BOTTOM_Y) * 0.32 * Math.sin(th),
        0.0,
      ]);
    }
    return pts;
  };
  return (
    <group>
      {[1, -1].map((side) => (
        <Line
          key={side}
          points={loop(side)}
          color="#f0abfc"
          lineWidth={1.5}
          transparent
          opacity={0.5}
          dashed
          dashSize={0.07}
          gapSize={0.06}
        />
      ))}
    </group>
  );
}

// ─── The rods ───────────────────────────────────────────────────────

/**
 * One rod: its body, the wax beads stuck along it, the atoms inside it, and a
 * probe on its tip.
 *
 * The body is a single instanced mesh of short segments, one per model node,
 * each taking its own node's colour. That is what makes the temperature
 * GRADIENT visible rather than just the endpoints — and on wood it is the
 * whole story, because the colour has fallen back to room temperature within
 * about half a centimetre of the water.
 */
function Rod({ materialKey, angle, modelRef, flir, atomic, tipC, selected, animSpeed = 1 }) {
  const spec = ROD_MATERIALS[materialKey];
  const bodyRef = useRef(null);
  const atomRef = useRef(null);
  const waxRefs = useRef([]);

  const pivotX = Math.cos(angle * DEG) > 0 ? cm(BEAKER.radius) : -cm(BEAKER.radius);
  const segment = ROD_WORLD / ROD_NODES;

  /** Four atoms per node: one on the axis, three around it. */
  const atomsPerNode = 4;
  const atomNodes = 14;
  const atomCount = atomNodes * atomsPerNode;

  const atomSeeds = useMemo(
    () =>
      Array.from({ length: atomCount }, (_, i) => ({
        phase: hashRandom(i * 3.3 + 1.7) * Math.PI * 2,
        rate: 9 + hashRandom(i * 5.9 + 4.1) * 7,
        dir: [
          hashRandom(i * 2.1 + 9) - 0.5,
          hashRandom(i * 4.7 + 13) - 0.5,
          hashRandom(i * 6.3 + 17) - 0.5,
        ],
      })),
    [atomCount],
  );

  useLayoutEffect(() => {
    // Lay out the body segments once — only their colours change afterwards.
    const body = bodyRef.current;
    if (body) {
      for (let i = 0; i < ROD_NODES; i += 1) {
        SCRATCH_OBJECT.position.set(0, nodeY(i), 0);
        SCRATCH_OBJECT.scale.set(1, 1, 1);
        SCRATCH_OBJECT.rotation.set(0, 0, 0);
        SCRATCH_OBJECT.updateMatrix();
        body.setMatrixAt(i, SCRATCH_OBJECT.matrix);
        SCRATCH_COLOUR.set(spec.colour);
        body.setColorAt(i, SCRATCH_COLOUR);
      }
      body.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
    }
    // The lattice is unmounted whenever the view mode is not atomic, so this
    // has to re-seed on the way back in — otherwise the remounted mesh has no
    // instance colour buffer until the first frame allocates one.
    const atoms = atomRef.current;
    if (atoms) {
      SCRATCH_COLOUR.set(spec.colour);
      for (let i = 0; i < atomCount; i += 1) {
        const node = Math.floor(i / atomsPerNode);
        const ring = i % atomsPerNode;
        const ringAngle = (ring / (atomsPerNode - 1)) * Math.PI * 2;
        const radius = ring === 0 ? 0 : ROD_RADIUS_W * 0.52;
        SCRATCH_OBJECT.position.set(
          Math.cos(ringAngle) * radius,
          -ROD_SUBMERGED + ((node + 0.5) / atomNodes) * ROD_WORLD,
          Math.sin(ringAngle) * radius,
        );
        SCRATCH_OBJECT.scale.set(1, 1, 1);
        SCRATCH_OBJECT.updateMatrix();
        atoms.setMatrixAt(i, SCRATCH_OBJECT.matrix);
        atoms.setColorAt(i, SCRATCH_COLOUR);
      }
      atoms.instanceMatrix.needsUpdate = true;
      if (atoms.instanceColor) atoms.instanceColor.needsUpdate = true;
    }
  }, [spec.colour, atomCount, atomsPerNode, atomNodes, atomic]);

  useFrame((state) => {
    const m = modelRef.current;
    const rod = m.rods[materialKey];
    const t = state.clock.elapsedTime * animSpeed;

    // Skipped entirely in atomic view, where the solid body is hidden: there
    // is no sense re-uploading an instance colour buffer nobody can see.
    const body = atomic ? null : bodyRef.current;
    if (body) {
      for (let i = 0; i < ROD_NODES; i += 1) {
        const temp = rod.nodes[i];
        SCRATCH_COLOUR.set(
          flir
            ? flirColour(temp, AMBIENT_C, m.hottestC)
            : mixHex(spec.colour, "#ff9d4d", clamp((temp - AMBIENT_C) / 90, 0, 1)),
        );
        body.setColorAt(i, SCRATCH_COLOUR);
      }
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
    }

    // Wax beads let go once the rod beneath them passes the melting point.
    for (let w = 0; w < WAX_POSITIONS.length; w += 1) {
      const bead = waxRefs.current[w];
      if (!bead) continue;
      const idx = clamp(Math.round(WAX_POSITIONS[w] * (ROD_NODES - 1)), 0, ROD_NODES - 1);
      // A 4 K window, so a bead softens and slumps rather than vanishing.
      const melt = clamp((rod.nodes[idx] - WAX_MELTING_C + 2) / 4, 0, 1);
      const size = 1 - melt;
      bead.visible = size > 0.02;
      bead.scale.set(size, size * (1 - melt * 0.4), size);
    }

    const atoms = atomRef.current;
    if (atoms && atomic) {
      for (let i = 0; i < atomCount; i += 1) {
        const node = Math.floor(i / atomsPerNode);
        const along = (node + 0.5) / atomNodes;
        const modelNode = clamp(Math.round(along * (ROD_NODES - 1)), 0, ROD_NODES - 1);
        const temp = rod.nodes[modelNode];

        // Amplitude ∝ √T is the honest scaling — but between a cold rod and a
        // boiling one that is only a 13% difference, which nobody can see. So
        // the room-temperature amplitude is subtracted and what is left is
        // magnified; the caption on screen says by how much, because a scene
        // that silently exaggerates is teaching the exaggeration.
        const swing =
          0.012 + 0.055 * (Math.sqrt(temp + 273.15) - Math.sqrt(AMBIENT_C + 273.15));
        const s = atomSeeds[i];
        const ring = i % atomsPerNode;
        const ringAngle = (ring / (atomsPerNode - 1)) * Math.PI * 2;
        const radius = ring === 0 ? 0 : ROD_RADIUS_W * 0.52;

        SCRATCH_OBJECT.position.set(
          Math.cos(ringAngle) * radius + s.dir[0] * swing * Math.sin(t * s.rate + s.phase),
          -ROD_SUBMERGED + along * ROD_WORLD + s.dir[1] * swing * Math.sin(t * s.rate * 1.13 + s.phase),
          Math.sin(ringAngle) * radius + s.dir[2] * swing * Math.sin(t * s.rate * 0.87 + s.phase),
        );
        SCRATCH_OBJECT.scale.setScalar(1);
        SCRATCH_OBJECT.updateMatrix();
        atoms.setMatrixAt(i, SCRATCH_OBJECT.matrix);
        SCRATCH_COLOUR.set(
          flir
            ? flirColour(temp, AMBIENT_C, m.hottestC)
            : mixHex(spec.colour, "#fff1c9", clamp((temp - AMBIENT_C) / 80, 0, 1)),
        );
        atoms.setColorAt(i, SCRATCH_COLOUR);
      }
      atoms.instanceMatrix.needsUpdate = true;
      if (atoms.instanceColor) atoms.instanceColor.needsUpdate = true;
    }
  });

  const tipLocal = ROD_EXPOSED;

  return (
    <group position={[pivotX, RIM_Y, 0]} rotation={[0, 0, angle * DEG - Math.PI / 2]}>
      {/* The clip where the rod rests on the rim of the beaker. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ROD_RADIUS_W * 1.55, 0.024, 8, 18]} />
        <meshStandardMaterial color="#7c8ba1" roughness={0.4} metalness={0.4} />
      </mesh>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, ROD_NODES]}
        frustumCulled={false}
        visible={!atomic}
      >
        <cylinderGeometry args={[ROD_RADIUS_W, ROD_RADIUS_W, segment * 1.04, 14]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} metalness={0.3} />
      </instancedMesh>

      {/* In atomic mode the metal becomes a ghost so the lattice reads. */}
      {atomic && (
        <>
          <mesh position={[0, (-ROD_SUBMERGED + ROD_EXPOSED) / 2, 0]}>
            <cylinderGeometry args={[ROD_RADIUS_W * 1.1, ROD_RADIUS_W * 1.1, ROD_WORLD, 16, 1, true]} />
            <meshStandardMaterial
              color={spec.colour}
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <instancedMesh ref={atomRef} args={[undefined, undefined, atomCount]} frustumCulled={false}>
            <sphereGeometry args={[cm(0.19), 8, 8]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={0.25}
              roughness={0.4}
            />
          </instancedMesh>
        </>
      )}

      {/* Paraffin beads. The classic test, and the clearest comparison here:
          copper drops all four, wood never drops one. */}
      {WAX_POSITIONS.map((p, i) => (
        <mesh
          key={p}
          ref={(el) => {
            waxRefs.current[i] = el;
          }}
          position={[0, -ROD_SUBMERGED + p * ROD_WORLD, ROD_RADIUS_W * 0.9]}
        >
          <sphereGeometry args={[cm(0.42), 12, 10]} />
          <meshStandardMaterial color="#f5e6c8" roughness={0.55} />
        </mesh>
      ))}

      {/* Which rod the controls are pointed at. */}
      {selected && (
        <mesh position={[0, -ROD_SUBMERGED + ROD_WORLD * 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ROD_RADIUS_W * 2.1, 0.028, 8, 24]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={1.8}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Probe on the tip. */}
      <TipProbe modelRef={modelRef} materialKey={materialKey} localY={tipLocal} flir={flir} />

      <group position={[0, tipLocal + 0.42, 0]} rotation={[0, 0, -(angle * DEG - Math.PI / 2)]}>
        <SceneLabel position={[0, 0.16, 0]} accent={selected} tone="text-ink-300">
          {`${spec.label} · k = ${spec.k}${selected ? " · probed" : ""}`}
        </SceneLabel>
        <SceneLabel position={[0, -0.24, 0]} tone="text-ink-200">
          {`tip ${tipC.toFixed(1)} °C`}
        </SceneLabel>
      </group>
    </group>
  );
}

/** A bead on the rod's tip that takes the tip's colour — a contact probe. */
function TipProbe({ modelRef, materialKey, localY, flir }) {
  const ref = useRef(null);
  useFrame(() => {
    const m = modelRef.current;
    const mesh = ref.current;
    if (!mesh) return;
    const t = m.rods[materialKey].tipC;
    mesh.material.color.set(
      flir ? flirColour(t, AMBIENT_C, m.hottestC) : mixHex("#cbd5e1", "#ef4444", clamp((t - AMBIENT_C) / 70, 0, 1)),
    );
  });
  return (
    <mesh ref={ref} position={[0, localY, 0]}>
      <sphereGeometry args={[ROD_RADIUS_W * 1.5, 14, 12]} />
      <meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.3} />
    </mesh>
  );
}

// ─── Thermometers ───────────────────────────────────────────────────

/**
 * A laboratory thermometer whose column actually tracks its probe.
 *
 * `read` is a selector against the live model, so the same component serves
 * the top of the beaker, the bottom of it and the radiation plate without any
 * of them needing to know where their number comes from.
 */
function Thermometer({ position, read, modelRef, label, maxC = 120 }) {
  const column = useRef(null);
  const bulb = useRef(null);
  const tube = 1.5;

  useFrame(() => {
    const m = modelRef.current;
    const t = clamp((read(m) - 0) / maxC, 0, 1);
    if (column.current) {
      const h = Math.max(t * tube, 1e-3);
      column.current.scale.y = h;
      column.current.position.y = h / 2;
    }
    if (bulb.current) {
      const warm = clamp((read(m) - AMBIENT_C) / 70, 0, 1);
      bulb.current.material.color.set(mixHex("#b91c1c", "#f87171", warm));
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, tube / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, tube, 12, 1, true]} />
        <meshPhysicalMaterial
          color="#cbd5e1"
          transparent
          opacity={0.3}
          roughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[0, 20, 40, 60, 80, 100, 120]
        .filter((v) => v <= maxC)
        .map((v) => (
          <mesh key={v} position={[0.075, (v / maxC) * tube, 0]}>
            <boxGeometry args={[v % 40 === 0 ? 0.1 : 0.055, 0.008, 0.008]} />
            <meshBasicMaterial color="#64748b" />
          </mesh>
        ))}
      <mesh ref={bulb} position={[0, -0.06, 0]}>
        <sphereGeometry args={[0.085, 14, 12]} />
        <meshStandardMaterial color="#b91c1c" emissive="#7f1d1d" emissiveIntensity={0.5} roughness={0.35} />
      </mesh>
      <mesh ref={column} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 1, 10]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      {label && (
        <SceneLabel position={[0, tube + 0.28, 0]} tone="text-ink-200">
          {label}
        </SceneLabel>
      )}
    </group>
  );
}

// ─── Radiation ──────────────────────────────────────────────────────

/** The two plates stand side by side, either side of the beam's axis. */
const PLATE_Z = { black: 0.66, shiny: -0.66 };

/**
 * Wavefronts leaving the flame in every direction.
 *
 * Rings rather than arrows, because the single most important thing about
 * radiation here is that it is not aimed: the plate is warmed by the small
 * share of it that happens to be going that way, which is exactly why the
 * effect falls off as 1/r². Their brightness follows the radiated power, so at
 * a low flame they are barely there and at full gas they are unmissable —
 * the fourth-power law, drawn.
 */
function RadiationRings({ modelRef, animSpeed = 1 }) {
  const refs = useRef([]);
  const rings = 5;
  const maxR = 5.6;

  useFrame((state) => {
    const m = modelRef.current;
    const t = state.clock.elapsedTime * animSpeed;
    // Normalised against the strongest flame the burner has, so the ramp the
    // eye sees is the ramp the physics gives.
    const strength = clamp(m.radiated / 370, 0, 1);
    for (let i = 0; i < rings; i += 1) {
      const ring = refs.current[i];
      if (!ring) continue;
      const phase = (t * 0.5 + i / rings) % 1;
      const r = 0.25 + phase * maxR;
      ring.scale.setScalar(r);
      ring.material.opacity = (1 - phase) * 0.55 * strength;
      ring.visible = strength > 0.01;
    }
  });

  return (
    <group position={[0, FLAME_Y + 0.45, 0]}>
      {Array.from({ length: rings }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[1, 0.016, 6, 60]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The share of that radiation which happens to reach the plates, as trains of
 * quanta running down a sine — three streams to each plate.
 *
 * Packets rather than a static squiggle, so the point lands that something is
 * crossing the gap through air that stays cold. And at the silvered plate a
 * few of them turn round and come back: what a shiny surface does with the
 * radiation it does not absorb is the whole difference between the two.
 */
function RadiationBeam({ modelRef, animSpeed = 1 }) {
  const meshRef = useRef(null);
  const bounceRef = useRef(null);
  const perPlate = 9;
  const count = perPlate * 2;
  const bounces = 8;
  const from = useMemo(() => new THREE.Vector3(-cm(2), FLAME_Y + 0.35, 0), []);
  const toX = PLATE_X + 0.22;

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = modelRef.current;
    const strength = clamp(m.radiated / 370, 0, 1);
    mesh.visible = strength > 0.01;
    if (bounceRef.current) bounceRef.current.visible = strength > 0.01;
    if (!mesh.visible) return;

    const t = state.clock.elapsedTime * animSpeed;
    const rays = 3;
    for (let i = 0; i < count; i += 1) {
      const plate = i < perPlate ? PLATE_Z.black : PLATE_Z.shiny;
      const j = i % perPlate;
      const ray = j % rays;
      const phase = (t * 0.85 + Math.floor(j / rays) / (perPlate / rays)) % 1;
      const targetY = FLAME_Y + 0.2;
      const spread = (ray - 1) * 0.3;
      SCRATCH_OBJECT.position.set(
        from.x + (toX - from.x) * phase,
        from.y + (targetY - from.y) * phase + spread * phase + Math.sin(phase * 26 + ray * 2.1) * 0.1,
        plate * phase + (ray - 1) * 0.06,
      );
      SCRATCH_OBJECT.scale.setScalar(0.6 + 0.5 * strength);
      SCRATCH_OBJECT.updateMatrix();
      mesh.setMatrixAt(i, SCRATCH_OBJECT.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.material.opacity = 0.35 + 0.5 * strength;

    // Reflected packets leave the silvered face and head back the way they came,
    // fanning out, fading as they go.
    const bounce = bounceRef.current;
    if (bounce) {
      for (let i = 0; i < bounces; i += 1) {
        const phase = (t * 0.6 + i / bounces) % 1;
        const spread = ((i % 4) - 1.5) * 0.35;
        SCRATCH_OBJECT.position.set(
          toX + phase * 1.9,
          FLAME_Y + 0.2 + spread * phase * 1.3,
          PLATE_Z.shiny - phase * 0.7 - (i % 2) * 0.1,
        );
        SCRATCH_OBJECT.scale.setScalar(0.55 * (1 - phase * 0.6));
        SCRATCH_OBJECT.updateMatrix();
        bounce.setMatrixAt(i, SCRATCH_OBJECT.matrix);
      }
      bounce.instanceMatrix.needsUpdate = true;
      bounce.material.opacity = 0.5 * strength;
    }
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bounceRef} args={[undefined, undefined, bounces]} frustumCulled={false}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#fdba74" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/**
 * A plate on its stand, one blackened and one silvered.
 *
 * Neither is touching anything, in the path of any rising air, or wired to
 * anything. Whatever they gain crossed the gap as radiation, and their
 * thermometers are the proof. They are the same size and the same distance
 * from the flame — the only thing that differs is the surface, which is the
 * whole point of having two.
 */
function RadiationPlate({ modelRef, flir, kind, tempC }) {
  const faceRef = useRef(null);
  const black = kind === "black";
  const z = PLATE_Z[kind];

  useFrame(() => {
    const m = modelRef.current;
    if (!faceRef.current) return;
    const c = black ? m.plateC : m.shinyC;
    faceRef.current.material.color.set(
      flir
        ? flirColour(c, AMBIENT_C, m.hottestC)
        : black
          ? mixHex("#2b303b", "#b4502c", clamp((c - AMBIENT_C) / 45, 0, 1))
          : mixHex("#e6ebf2", "#f6cfae", clamp((c - AMBIENT_C) / 25, 0, 1)),
    );
  });

  return (
    <group position={[PLATE_X, 0, z]}>
      <mesh position={[0, BENCH_Y + 0.05, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.1, 20]} />
        <meshStandardMaterial color="#8593a8" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, (BENCH_Y + FLAME_Y) / 2 + 0.1, 0]}>
        <cylinderGeometry args={[0.045, 0.045, FLAME_Y - BENCH_Y + 0.2, 12]} />
        <meshStandardMaterial color="#9aa8bc" roughness={0.35} metalness={0.4} />
      </mesh>
      {/* Clamp: a boss on the pole and a short arm holding the plate. */}
      <mesh position={[0.0, FLAME_Y + 0.2, 0]}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial color="#7c8ba1" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh ref={faceRef} position={[0.09, FLAME_Y + 0.2, 0]} rotation={[0, Math.PI / 2 - 0.5, 0]}>
        <boxGeometry args={[cm(5), cm(5), 0.05]} />
        <meshStandardMaterial
          color={black ? "#2b303b" : "#e6ebf2"}
          roughness={black ? 0.95 : 0.18}
          metalness={black ? 0.1 : 0.25}
        />
      </mesh>
      <Thermometer
        position={[-0.5, FLAME_Y - 0.35, 0]}
        modelRef={modelRef}
        read={(m) => (black ? m.plateC : m.shinyC)}
        maxC={80}
      />
      <SceneLabel position={[0, FLAME_Y + (black ? 1.0 : 1.5), 0]} accent={black} tone="text-ink-200">
        {`${black ? "blackened" : "silvered"} plate · ${tempC.toFixed(1)} °C`}
      </SceneLabel>
    </group>
  );
}

// ─── The false-colour key ───────────────────────────────────────────

function ThermalScaleBar({ hottestC, visible }) {
  const stops = 22;
  if (!visible) return null;
  return (
    <group position={[5.1, 0.4, 0]}>
      {Array.from({ length: stops }, (_, i) => {
        const f = i / (stops - 1);
        const t = AMBIENT_C + (hottestC - AMBIENT_C) * f;
        return (
          <mesh key={i} position={[0, f * 2.6, 0]}>
            <planeGeometry args={[0.32, 2.6 / stops + 0.01]} />
            <meshBasicMaterial color={flirColour(t, AMBIENT_C, hottestC)} toneMapped={false} />
          </mesh>
        );
      })}
      <SceneLabel position={[0.62, 2.6, 0]} tone="text-ink-300">
        {`${hottestC.toFixed(0)} °C`}
      </SceneLabel>
      <SceneLabel position={[0.62, 1.3, 0]} tone="text-ink-300">
        {`${((AMBIENT_C + hottestC) / 2).toFixed(0)} °C`}
      </SceneLabel>
      <SceneLabel position={[0.62, 0, 0]} tone="text-ink-300">
        {`${AMBIENT_C} °C`}
      </SceneLabel>
      <SceneLabel position={[0, 3.05, 0]} accent>
        FLIR
      </SceneLabel>
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

/**
 * Everything that never changes with the numbers: the room, the bench, the
 * tripod, the glassware. The thermal sample re-renders the scene six times a
 * second, and re-reconciling a hundred static meshes each time was pure cost —
 * memoised, this only re-renders when the gas tap moves.
 */
const StaticSet = memo(function StaticSet({ modelRef, intensity }) {
  return (
    <>
      <Room modelRef={modelRef} />
      <Bench intensity={intensity} />
      <Tripod />
      <BeakerGlass />
      <BeakerMarks />
      <ConvectionArrows />
    </>
  );
});

export default function HeatTransferCanvas({ params = {} }) {
  const {
    flameIntensity = 55,
    rodMaterial = "copper",
    viewMode = "flir",
    dyeDrop = 0,
    speed = 1,
  } = params || {};

  const modelRef = useRef(null);
  if (modelRef.current === null) modelRef.current = createModel();

  const [sample, setSample] = useState({
    waterBottom: AMBIENT_C,
    waterTop: AMBIENT_C,
    delta: 0,
    speed: 0,
    boiling: false,
    plateC: AMBIENT_C,
    shinyC: AMBIENT_C,
    hottestC: AMBIENT_C + 40,
    tips: Object.fromEntries(ROD_LAYOUT.map(({ key }) => [key, AMBIENT_C])),
  });

  const flir = viewMode !== "atomic";
  const atomic = viewMode === "atomic";

  return (
    <SceneCanvas
      camera={{ position: [0.5, 1.1, 13.4], fov: 46 }}
      controls={{ minDistance: 5, maxDistance: 32, target: [0, 0.9, 0] }}
      lights={{ ambient: flir ? 0.75 : 0.85, keyLight: flir ? 1.0 : 1.3 }}
    >
      <ThermalDriver modelRef={modelRef} intensity={flameIntensity} onSample={setSample} animSpeed={speed} />

      <StaticSet modelRef={modelRef} intensity={flameIntensity} />
      <BunsenBurner modelRef={modelRef} animSpeed={speed} />

      {/* ── Convection ── */}
      <WaterColumn modelRef={modelRef} flir={flir} />
      <DyeTracers modelRef={modelRef} dropSignal={dyeDrop} animSpeed={speed} />
      <BoilingBubbles modelRef={modelRef} animSpeed={speed} />

      <Thermometer
        position={[-cm(1.6), WATER_TOP_Y - 0.55, cm(BEAKER.radius) + 0.18]}
        modelRef={modelRef}
        read={(m) => m.water.top}
        label={`top ${sample.waterTop.toFixed(1)} °C`}
      />
      <Thermometer
        position={[cm(1.6), WATER_BOTTOM_Y + 0.1, cm(BEAKER.radius) + 0.18]}
        modelRef={modelRef}
        read={(m) => m.water.bottom}
        label={`bottom ${sample.waterBottom.toFixed(1)} °C`}
      />
      <SceneLabel position={[0, WATER_BOTTOM_Y - 0.55, cm(BEAKER.radius) + 0.3]} tone="text-fuchsia-300">
        {sample.speed > 1e-5
          ? `convection current ${(sample.speed * 100).toFixed(1)} cm/s · Δθ ${sample.delta.toFixed(1)} K`
          : "no current — the water is still"}
      </SceneLabel>

      {/* ── Conduction ── */}
      {ROD_LAYOUT.map(({ key, angle }) => (
        <Rod
          key={key}
          materialKey={key}
          angle={angle}
          modelRef={modelRef}
          flir={flir}
          atomic={atomic}
          tipC={sample.tips[key] ?? AMBIENT_C}
          selected={key === rodMaterial}
          animSpeed={speed}
        />
      ))}

      {/* ── Radiation ── */}
      <RadiationRings modelRef={modelRef} animSpeed={speed} />
      <RadiationBeam modelRef={modelRef} animSpeed={speed} />
      <RadiationPlate modelRef={modelRef} flir={flir} kind="black" tempC={sample.plateC} />
      <RadiationPlate modelRef={modelRef} flir={flir} kind="shiny" tempC={sample.shinyC} />
      <SceneLabel position={[PLATE_X, FLAME_Y + 2.0, 0]} tone="text-ink-400">
        touching nothing · 15 cm of air
      </SceneLabel>

      <ThermalScaleBar hottestC={sample.hottestC} visible={flir} />

      {/* Which rod the controls are pointed at, and what mode is drawn. */}
      <SceneLabel position={[0, BENCH_Y - 0.55, 0]} tone="text-ink-400">
        {atomic
          ? "atomic view · vibration amplitude exaggerated — the real difference between 20 °C and 100 °C is 13%"
          : `false colour · ${AMBIENT_C}–${sample.hottestC.toFixed(0)} °C`}
      </SceneLabel>
      <SceneLabel position={[0, BENCH_Y - 0.95, 0]} accent>
        {`probing ${ROD_MATERIALS[rodMaterial]?.label ?? "Copper"} · scene runs at ${TIME_LAPSE}× real time`}
      </SceneLabel>

    </SceneCanvas>
  );
}
