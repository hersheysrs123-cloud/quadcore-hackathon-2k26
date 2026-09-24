"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";
import { relaxTo } from "@/components/visualizations/vessel-rack";
import {
  BRASS,
  BURNER_MOUTH_Y,
  BunsenBurner,
  DARK_STEEL,
  EvaporatingBasin,
  FLAME_FULL_HEIGHT,
  GlassJar,
  HeatMat,
  HeatShield,
  LAB_WALL_Z,
  LabBench,
  LabWall,
  RUBBER,
  RetortStand,
  STEEL,
  SprayBottle,
  Tongs,
  BASIN,
  basinRimRadius,
  cm,
  useGlowTexture,
} from "@/components/visualizations/lab-bench";
import {
  BASIN_HOLD_S,
  O2_EXTINCTION,
  createCombustionState,
  describeFlame,
  flameProfile,
  stepCombustion,
} from "@/lib/combustion";

// ─── Combustion & the fire triangle ─────────────────────────────────
// One Bunsen burner, drawn in enough detail that the collar is a thing you
// turn rather than a slider you slide: the sleeve rotates, its holes line
// up with the barrel's, and the flame answers — yellow and lazy with them
// covered, blue and roaring with them open. Around it, the three ways of
// putting a flame out, each of which removes exactly one side of the
// triangle: a gas tap, a bell jar, a spray bottle. And a cold basin on
// tongs to catch the soot a starved flame leaves behind.
//
// The chemistry is `lib/combustion.js`; this file drives it from the frame
// loop, draws the flame through the shared burner's ref, and animates the
// hardware — the jar coming down, the thermocouple swinging clear, the
// mist, the steam, the soot, the tongs — off the state the model returns.
// The HUD is kept in step with a handful of `live*` params pushed five
// times a second.
// ─────────────────────────────────────────────────────────────────────

const BENCH_Y = -2.4;
const PUSH_EVERY_S = 0.2;
const BURNER_Y = 0.04;
const MOUTH_Y = BURNER_Y + BURNER_MOUTH_Y;
const JAR = { radius: cm(8.5), height: cm(20) };
/** Raised, the jar hangs clear above the tallest (lazy yellow) flame's tip. */
const JAR_UP_Y = 4.7;
const PROBE_STAND = [3.0, 0, 0];
const PROBE_Y = MOUTH_Y + 1.35;
const PROBE_LENGTH = 0.95;
/** The thermocouple's digital meter, on the bench behind its stand. */
// Behind the stand's base, well clear of the parked basin (rim radius 1.55).
const METER_POS = [3.3, 0, -2.4];
const TAP_POS = [-3.7, 0, 1.15];
const BOTTLE_POS = [3.6, 0, 2.2];
const BASIN_REST = [5.2, 0.02, -0.2];
const BASIN_HELD = [0, MOUTH_Y + 1.25, 0];
/**
 * Shown on its easel, the basin leans back by BASIN_SHOW_TILT so its sooty
 * underside faces the camera; raised so the rim clears the bench.
 */
const BASIN_SHOW = [-4.3, 1.35, 0.25];
const BASIN_SHOW_TILT = 1.15;
/** The CO alarm is mounted on the wall, as it would be in a real lab. */
const DETECTOR_POS = [-2.35, 3.3, LAB_WALL_Z + 0.12];
/** The fire-triangle safety poster on the wall, left of the burner and below the shelf. */
const POSTER_POS = [-5.3, BENCH_Y + 4.05, LAB_WALL_Z + 0.06];
const POSTER_SIZE = [3.1, 3.0];

/** What the camera keeps in view: the bench's working width, and from below its front edge to the raised jar's knob. */
const VIEW = { cx: -0.1, width: 14.2, top: BENCH_Y + JAR_UP_Y + JAR.height + JAR.radius + 0.5, bottom: BENCH_Y - 1.7 };
const FOV = 44;
const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180));
const VIEW_DIRECTION = new THREE.Vector3(0, 0.2, 1).normalize();

const SCRATCH_OBJECT = new THREE.Object3D();

// ─── The driver ─────────────────────────────────────────────────────

/**
 * Steps the model every frame, fires the buttons, and keeps the burner's
 * flame ref and the HUD in step. Renders nothing.
 *
 * Buttons are counters that only ever go up — except when the HUD resets
 * every parameter to its default, which sends them all back to zero at
 * once. A counter going DOWN is therefore read as "reset the apparatus"
 * (a relight), never as a press.
 */
function CombustionDriver({ modelRef, flameRef, collar, tokens, animSpeed, setParam }) {
  const seen = useRef({ ...tokens });
  const pushed = useRef({ sinceLast: 0, values: {} });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const events = {};
    for (const key of Object.keys(tokens)) {
      const now = Number(tokens[key]) || 0;
      const was = seen.current[key] ?? 0;
      if (now > was) events[key] = true;
      else if (now < was) events.relight = true;
      seen.current[key] = now;
    }
    const m = modelRef.current;
    m.state = stepCombustion(m.state, { collar, dt, events });
    const s = m.state;
    const p = flameProfile(collar);
    m.profile = p;

    const f = flameRef.current;
    f.height = s.lit ? p.height * (0.35 + 0.65 * s.heat) : 0;
    f.colour = p.colour;
    f.inner = p.innerCone;
    f.roar = p.roar;
    f.luminous = p.luminous;

    if (typeof setParam !== "function") return;
    pushed.current.sinceLast += delta;
    if (pushed.current.sinceLast < PUSH_EVERY_S) return;
    pushed.current.sinceLast = 0;
    const next = {
      liveLit: s.lit,
      liveTempC: Math.round(s.tempC),
      liveO2: Math.round(s.jarO2 * 10000) / 100,
      liveHeat: Math.round(s.heat * 100) / 100,
      liveFuel: s.fuelOpen,
      liveJar: s.jarDown ? (s.jarTravel >= 1 ? "down" : "lowering") : s.jarTravel > 0 ? "lifting" : "up",
      liveMist: Math.round(s.mist * 100) / 100,
      liveSoot: Math.round(s.sootOnBasin * 100) / 100,
      liveBasin: s.basin,
      liveOut: s.extinguishedBy ?? "",
    };
    for (const [key, value] of Object.entries(next)) {
      if (pushed.current.values[key] !== value) {
        pushed.current.values[key] = value;
        setParam(key, value);
      }
    }
  });

  return null;
}

// ─── Hardware around the burner ─────────────────────────────────────

/** The gas tap on the bench, its lever turned off when the fuel is cut, and the hose to the burner. */
function GasTap({ modelRef, animSpeed = 1 }) {
  const lever = useRef(null);
  const shown = useRef({ open: 1 });
  const hose = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(TAP_POS[0] + 0.32, 0.42, TAP_POS[2]),
        new THREE.Vector3(TAP_POS[0] + 1.1, 0.16, TAP_POS[2] + 0.1),
        new THREE.Vector3(-1.6, 0.1, 1.05),
        new THREE.Vector3(-0.85, 0.3, cm(4.6)),
        new THREE.Vector3(-0.46, 0.33, cm(4.6)),
      ]),
    [],
  );
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const open = modelRef.current.state.fuelOpen ? 1 : 0;
    shown.current.open = relaxTo(shown.current.open, open, 0.18, dt);
    if (lever.current) lever.current.rotation.y = (1 - shown.current.open) * (Math.PI / 2);
  });
  return (
    <group>
      <group position={TAP_POS}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.5, 0.4, 0.5]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.13, 0.15, 0.3, 14]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0.22, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.3, 10]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        {/* The lever: along +x when open, turned across when shut. */}
        <group ref={lever} position={[0, 0.72, 0]}>
          <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.46, 8]} />
            <meshStandardMaterial color="#b91c1c" emissive="#b91c1c" emissiveIntensity={0.3} roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        </group>
      </group>
      <mesh>
        <tubeGeometry args={[hose, 40, 0.06, 8, false]} />
        <meshStandardMaterial {...RUBBER} />
      </mesh>
    </group>
  );
}

/**
 * A carbon monoxide alarm screwed to the wall: a rounded white case, a
 * slotted sensor grille, a small LCD and a status lamp that goes green,
 * amber, red — and blinks when the reading is dangerous.
 */
function CoDetector({ modelRef }) {
  const led = useRef(null);
  const screen = useRef(null);
  useFrame((state) => {
    const m = modelRef.current;
    const co = m.state.lit ? m.profile.coFraction : 0;
    const colour = co > 0.45 ? PALETTE.rose : co > 0.12 ? PALETTE.gold : PALETTE.emerald;
    if (led.current) {
      const blink = co > 0.45 ? (Math.sin(state.clock.elapsedTime * 9) > 0 ? 1 : 0.15) : 1;
      led.current.material.color.set(colour);
      led.current.material.emissive.set(colour);
      led.current.material.emissiveIntensity = (0.8 + co * 1.5) * blink;
    }
    if (screen.current) screen.current.material.emissiveIntensity = 0.35 + co * 0.6;
  });
  return (
    <group position={DETECTOR_POS}>
      {/* Case: a slab on a slightly larger wall plate. */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[0.8, 1.0, 0.06]} />
        <meshStandardMaterial color="#dfe3e8" roughness={0.6} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.72, 0.9, 0.2]} />
        <meshStandardMaterial color="#eef1f4" roughness={0.55} />
      </mesh>
      {/* Sensor grille: a row of slots. */}
      {[-0.2, -0.1, 0, 0.1, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.26, 0.101]}>
          <boxGeometry args={[0.05, 0.24, 0.004]} />
          <meshStandardMaterial color="#9aa3ae" roughness={0.8} />
        </mesh>
      ))}
      <mesh ref={screen} position={[0, -0.04, 0.102]}>
        <boxGeometry args={[0.44, 0.2, 0.006]} />
        <meshStandardMaterial color="#9fb89a" emissive="#9fb89a" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <mesh ref={led} position={[-0.22, -0.3, 0.105]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color={PALETTE.emerald} emissive={PALETTE.emerald} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      {/* Test button. */}
      <mesh position={[0.16, -0.3, 0.105]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.03, 16]} />
        <meshStandardMaterial color="#cbd2da" roughness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * The thermocouple's digital meter on the bench, joined to the probe's stand
 * by its lead — the reading in the label is what its display would show.
 */
function ThermoMeter() {
  const lead = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(PROBE_STAND[0], PROBE_Y + 0.2, PROBE_STAND[2] - 0.05),
        new THREE.Vector3(PROBE_STAND[0] + 0.25, PROBE_Y - 0.4, PROBE_STAND[2] - 0.35),
        new THREE.Vector3(PROBE_STAND[0] + 0.6, 0.35, METER_POS[2] + 0.5),
        new THREE.Vector3(METER_POS[0] - 0.35, 0.28, METER_POS[2] + 0.1),
      ]),
    [],
  );
  return (
    <group>
      <group position={METER_POS} rotation={[0, -0.35, 0]}>
        {/* A sloped-front case, so the display faces up at the camera. */}
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.95, 0.4, 0.6]} />
          <meshStandardMaterial color="#f1c232" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.34, 0.2]} rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[0.62, 0.26, 0.02]} />
          <meshStandardMaterial color="#1b2a1f" emissive="#3a5a3f" emissiveIntensity={0.4} roughness={0.3} />
        </mesh>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 0.2, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
            <meshStandardMaterial {...DARK_STEEL} />
          </mesh>
        ))}
      </group>
      <mesh>
        <tubeGeometry args={[lead, 40, 0.025, 6, false]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * The fire-triangle safety poster on the wall: a board with a printed title
 * strip, and the triangle mounted on it whose corners light up — green while
 * that side is there, red the moment it is taken away.
 */
function FireTrianglePoster({ status, Label }) {
  const outline = useMemo(() => [...TRI_POINTS, TRI_POINTS[0]], []);
  const allGood = status.heat && status.fuel && status.oxygen;
  return (
    <group position={POSTER_POS}>
      <mesh>
        <boxGeometry args={[POSTER_SIZE[0], POSTER_SIZE[1], 0.04]} />
        <meshStandardMaterial color="#fdf6e3" roughness={0.9} />
      </mesh>
      {/* A red safety border and title strip. */}
      <mesh position={[0, POSTER_SIZE[1] / 2 - 0.2, 0.022]}>
        <boxGeometry args={[POSTER_SIZE[0] - 0.16, 0.26, 0.004]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.8} />
      </mesh>
      {[
        [0, -POSTER_SIZE[1] / 2 + 0.04, POSTER_SIZE[0], 0.08],
        [-POSTER_SIZE[0] / 2 + 0.04, 0, 0.08, POSTER_SIZE[1]],
        [POSTER_SIZE[0] / 2 - 0.04, 0, 0.08, POSTER_SIZE[1]],
      ].map(([x, y, w, h]) => (
        <mesh key={`${x},${y}`} position={[x, y, 0.022]}>
          <boxGeometry args={[w, h, 0.004]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.8} />
        </mesh>
      ))}
      {/* The triangle itself, a hair proud of the board. */}
      <group position={[0, -0.2, 0.06]} scale={0.95}>
        <Line points={outline} color={allGood ? "#d97706" : PALETTE.rose} lineWidth={3} />
        {TRI_POINTS.map((p, i) => {
          const ok = status[TRI_KEYS[i]];
          return (
            <group key={TRI_KEYS[i]}>
              <mesh position={p}>
                <sphereGeometry args={[0.13, 16, 16]} />
                <meshStandardMaterial color={ok ? PALETTE.emerald : PALETTE.rose} emissive={ok ? PALETTE.emerald : PALETTE.rose} emissiveIntensity={1.2} toneMapped={false} />
              </mesh>
              <Label position={[p[0] * 1.02, p[1] + (i === 0 ? 0.32 : -0.3), 0]} tone={ok ? "text-emerald-300" : "text-rose-300"}>
                {`${TRI_NAMES[i]} ${ok ? "✓" : "✗"}`}
              </Label>
            </group>
          );
        })}
      </group>
      <Label position={[0, POSTER_SIZE[1] / 2 + 0.3, 0.1]} accent={allGood} tone={allGood ? "text-duck-300" : "text-rose-300"}>
        {allGood ? "fire triangle — all three sides" : "a side is missing — no flame"}
      </Label>
    </group>
  );
}

/**
 * The thermocouple on its stand: the probe hangs from the clamp jaws into
 * the flame, and the whole arm swings back toward the wall whenever the
 * bell jar is on its way down or the basin is held in the flame, so
 * neither ever passes through it. The
 * stand's arm group and the probe group are turned by the same angle.
 */
function Thermocouple({ modelRef, animSpeed = 1 }) {
  const arms = useRef([]);
  const probe = useRef(null);
  const bead = useRef(null);
  const shown = useRef({ swing: 0, glow: 0 });
  const hot = useMemo(() => new THREE.Color("#ff5a1f"), []);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const s = modelRef.current.state;
    // Out of the way of the jar coming down, and of the basin held where the probe hangs.
    const clear = s.jarDown || s.jarTravel > 0.01 || s.basin === "held" ? 1 : 0;
    shown.current.swing = relaxTo(shown.current.swing, clear, 0.3, dt);
    // The bead glows dull red from about 500 °C and orange-hot near the top
    // of the range; swung out of the flame it cools and goes dark.
    const inFlame = s.lit ? 1 - shown.current.swing : 0;
    shown.current.glow = relaxTo(shown.current.glow, inFlame * clamp((s.tempC - 450) / 900, 0, 1), 0.6, dt);
    if (bead.current) {
      bead.current.material.emissive.copy(hot);
      bead.current.material.emissiveIntensity = 0.15 + shown.current.glow * 2.2;
    }
    // Swung back toward the wall, clear of the basin's path in front of the stand.
    const angle = Math.PI - (shown.current.swing * Math.PI) / 2;
    const arm = arms.current[0];
    if (arm) arm.rotation.y = angle;
    if (probe.current) probe.current.rotation.y = angle;
  });
  return (
    <group>
      <RetortStand position={PROBE_STAND} height={PROBE_Y + 0.8} baseAngle={Math.PI} armRefs={arms} fittings={[{ y: PROBE_Y, type: "clamp", reach: PROBE_STAND[0], angle: Math.PI }]} />
      {/* The probe: at the jaws (arm length out from the rod), turned with the arm. */}
      <group ref={probe} position={[PROBE_STAND[0], PROBE_Y, PROBE_STAND[2]]} rotation={[0, Math.PI, 0]}>
        <group position={[PROBE_STAND[0], 0, 0]}>
          <mesh position={[0, -PROBE_LENGTH / 2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, PROBE_LENGTH, 8]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh ref={bead} position={[0, -PROBE_LENGTH, 0]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial color="#d1d5db" emissive="#ff5a1f" emissiveIntensity={0.15} metalness={0.5} roughness={0.3} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** The bell jar on its hoist, lowering over the burner and lifting off again. */
function BellJar({ modelRef, animSpeed = 1 }) {
  const group = useRef(null);
  const hoist = useRef(null);
  const shown = useRef({ y: JAR_UP_Y });
  useFrame((_, delta) => {
    const s = modelRef.current.state;
    const y = lerp(JAR_UP_Y, 0.06, s.jarTravel);
    shown.current.y = y;
    if (group.current) group.current.position.y = y;
    if (hoist.current) {
      const top = JAR_UP_Y + JAR.height + JAR.radius + 3.2;
      const bottom = y + JAR.height + JAR.radius + 0.3;
      hoist.current.position.y = (top + bottom) / 2;
      hoist.current.scale.y = Math.max(top - bottom, 0.01);
    }
  });
  return (
    <group>
      <group ref={group} position={[0, JAR_UP_Y, 0]}>
        <GlassJar radius={JAR.radius} height={JAR.height} dome />
      </group>
      <mesh ref={hoist} position={[0, JAR_UP_Y + 6, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
    </group>
  );
}

// ─── Particles ──────────────────────────────────────────────────────

const SOOT = 90;
/** Soot off the flame tip — only a starved flame makes any. Instanced specks that rise, drift and shrink. */
function Soot({ modelRef, animSpeed = 1 }) {
  const mesh = useRef(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: SOOT }, (_, i) => ({
        phase: hashRandom(i * 2.3 + 1),
        angle: hashRandom(i * 4.1 + 3) * Math.PI * 2,
        r: hashRandom(i * 6.7 + 5) * 0.25,
        drift: (hashRandom(i * 8.9 + 7) - 0.5) * 0.9,
        // Fine specks: soot is a haze of sub-micron carbon that clumps into flecks, not pellets.
        size: 0.008 + hashRandom(i * 10.3 + 9) * 0.016,
        speed: 0.5 + hashRandom(i * 12.1 + 11) * 0.5,
      })),
    [],
  );
  useFrame((_, delta) => {
    const inst = mesh.current;
    if (!inst) return;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const m = modelRef.current;
    const rate = m.state.lit ? m.profile.sootRate : 0;
    const live = Math.round(SOOT * clamp(rate * 1.15, 0, 1));
    const tip = MOUTH_Y + FLAME_FULL_HEIGHT * m.profile.height * 0.85;
    for (let i = 0; i < SOOT; i += 1) {
      const s = seeds[i];
      if (rate > 0.02) s.phase = (s.phase + dt * s.speed * 0.35) % 1;
      const t = s.phase;
      const on = i < live;
      const rad = s.r + t * 0.9;
      // Rising and spreading in the plume, gone before it reaches the raised jar.
      SCRATCH_OBJECT.position.set(Math.cos(s.angle + t * s.drift) * rad, tip + t * 1.9, Math.sin(s.angle + t * s.drift) * rad);
      const k = on ? s.size * (1 - t * 0.7) : 0;
      SCRATCH_OBJECT.scale.setScalar(k);
      SCRATCH_OBJECT.updateMatrix();
      inst.setMatrixAt(i, SCRATCH_OBJECT.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SOOT]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color="#0b0d12" roughness={1} transparent opacity={0.7} depthWrite={false} />
    </instancedMesh>
  );
}

const SMOKE = 14;
/**
 * The grey wisp a sooty flame trails: soft puffs that leave the tip, rise,
 * swell and thin out. A clean blue flame makes none.
 */
function Smoke({ modelRef, animSpeed = 1 }) {
  const puffs = useRef([]);
  const texture = useGlowTexture();
  const seeds = useMemo(
    () => Array.from({ length: SMOKE }, (_, i) => ({ phase: i / SMOKE, drift: (hashRandom(i * 3.7 + 1) - 0.5) * 0.8, spin: hashRandom(i * 5.9 + 2) * Math.PI * 2 })),
    [],
  );
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const m = modelRef.current;
    const rate = m.state.lit ? m.profile.sootRate : 0;
    const tip = MOUTH_Y + FLAME_FULL_HEIGHT * m.profile.height * 0.9;
    const t = state.clock.elapsedTime * animSpeed;
    seeds.forEach((s, i) => {
      const sprite = puffs.current[i];
      if (!sprite) return;
      s.phase = (s.phase + dt * 0.28) % 1;
      const u = s.phase;
      sprite.visible = rate > 0.04;
      sprite.position.set(Math.sin(t * 0.9 + s.spin) * 0.12 * u + s.drift * u * 0.9, tip + 0.1 + u * 2.3, Math.cos(t * 0.7 + s.spin) * 0.1 * u);
      const size = 0.25 + u * 1.1;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = rate * 0.32 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 1.5;
    });
  });
  return (
    <>
      {seeds.map((s, i) => (
        <sprite
          key={i}
          ref={(el) => {
            puffs.current[i] = el;
          }}
          visible={false}
        >
          <spriteMaterial map={texture ?? undefined} color="#4b5058" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </>
  );
}

const MIST = 70;
/** The burst from the spray bottle: droplets flying at the flame, then a puff of steam where they land. */
function WaterMist({ modelRef, animSpeed = 1 }) {
  const drops = useRef(null);
  const steam = useRef(null);
  const burst = useRef(0);
  const seeds = useMemo(
    () =>
      Array.from({ length: MIST }, (_, i) => ({
        lead: hashRandom(i * 3.1 + 2) * 0.45,
        dy: (hashRandom(i * 5.3 + 4) - 0.5) * 0.7,
        dz: (hashRandom(i * 7.9 + 6) - 0.5) * 0.7,
        size: 0.025 + hashRandom(i * 9.7 + 8) * 0.03,
        sAngle: hashRandom(i * 11.3 + 10) * Math.PI * 2,
        sR: 0.2 + hashRandom(i * 13.7 + 12) * 0.6,
      })),
    [],
  );
  const nozzle = useMemo(() => new THREE.Vector3(BOTTLE_POS[0] - 0.4, BOTTLE_POS[1] + 1.4, BOTTLE_POS[2]), []);
  const aim = useMemo(() => new THREE.Vector3(0, MOUTH_Y + 0.7, 0), []);
  const lastMist = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const s = modelRef.current.state;
    // A fresh spray restarts the burst clock.
    if (s.mist > lastMist.current + 0.3) burst.current = 0;
    lastMist.current = s.mist;
    burst.current += dt;
    const flying = s.mist > 0.05;
    const inst = drops.current;
    if (inst) {
      for (let i = 0; i < MIST; i += 1) {
        const sd = seeds[i];
        const t = clamp((burst.current - sd.lead) / 0.75, 0, 1);
        const on = flying && t > 0 && t < 1;
        SCRATCH_OBJECT.position.set(lerp(nozzle.x, aim.x + sd.dz, t), lerp(nozzle.y, aim.y + sd.dy, t) - t * t * 0.4, lerp(nozzle.z, aim.z + sd.dz, t));
        SCRATCH_OBJECT.scale.setScalar(on ? sd.size : 0);
        SCRATCH_OBJECT.updateMatrix();
        inst.setMatrixAt(i, SCRATCH_OBJECT.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
    const puff = steam.current;
    if (puff) {
      const strength = s.steam;
      for (let i = 0; i < MIST; i += 1) {
        const sd = seeds[i];
        const t = clamp((burst.current - 0.5 - sd.lead * 0.6) / 1.6, 0, 1);
        const on = strength > 0.03 && t > 0 && t < 1;
        const r = sd.sR * (0.5 + t * 1.6);
        SCRATCH_OBJECT.position.set(Math.cos(sd.sAngle) * r, MOUTH_Y + 0.4 + t * 2.4, Math.sin(sd.sAngle) * r);
        SCRATCH_OBJECT.scale.setScalar(on ? (0.08 + t * 0.32) * (0.5 + strength) : 0);
        SCRATCH_OBJECT.updateMatrix();
        puff.setMatrixAt(i, SCRATCH_OBJECT.matrix);
      }
      puff.instanceMatrix.needsUpdate = true;
      puff.material.opacity = 0.22 * clamp(strength, 0, 1);
    }
  });
  return (
    <>
      <instancedMesh ref={drops} args={[undefined, undefined, MIST]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial color="#dbeafe" emissive="#93c5fd" emissiveIntensity={0.5} transparent opacity={0.85} />
      </instancedMesh>
      <instancedMesh ref={steam} args={[undefined, undefined, MIST]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#e5e7eb" transparent opacity={0.2} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

// ─── The cold basin on tongs ────────────────────────────────────────

/**
 * The evaporating basin: parked on the bench, carried into the flame on
 * tongs for the hold, then set on a cradle tilted toward the camera so the
 * underside — and whatever the flame left on it — is in plain view.
 */
function ColdBasin({ modelRef, animSpeed = 1 }) {
  const group = useRef(null);
  const soot = useRef(null);
  const tongs = useRef(null);
  const liquid = useRef({ fill: 0 });
  const shown = useRef({ pos: new THREE.Vector3(...BASIN_REST), tilt: 0, tongs: 0 });
  const rim = basinRimRadius();
  // A shell a hair outside the basin's outer surface (sphere radius + the
  // 0.06 wall), from the bottom to 70% of the way up.
  const sootGeo = useMemo(() => {
    const { sphereRadius: R, depth } = BASIN;
    // Starts at the axis so the bottom-centre is covered too.
    const pts = [new THREE.Vector2(0, -0.004)];
    for (let i = 0; i <= 16; i += 1) {
      const h = (depth * 0.7 * i) / 16;
      const r = Math.sqrt(Math.max(0, R * R - (R - h) ** 2)) + 0.06 + 0.008;
      pts.push(new THREE.Vector2(r, h - 0.004));
    }
    return new THREE.LatheGeometry(pts, 48);
  }, []);
  const sootTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const g = c.getContext("2d");
    // v runs up the side (canvas y = 0 is the bottom in lathe UVs flipped by
    // flipY), u around it. Dense at the bottom, then a ragged, blotchy edge.
    // Periodic in u (whole cycles over 256 px) so there is no seam round the basin.
    const TAU = Math.PI * 2;
    for (let x = 0; x < 256; x += 2) {
      const a = (x / 256) * TAU;
      // A soft, wandering edge — a few low harmonics, not per-column noise,
      // which drew a spiky starburst.
      const edge = 0.5 + 0.1 * Math.sin(a * 3 + 0.7) + 0.06 * Math.sin(a * 7 + 2.1) + 0.03 * Math.sin(a * 13);
      for (let y = 0; y < 128; y += 2) {
        const v = 1 - y / 128;
        const t = clamp((edge - v) / 0.22 + 0.5, 0, 1);
        const smooth = t * t * (3 - 2 * t);
        // Blotches: thicker and thinner patches of deposit, plus a fine grain.
        const blotch = 0.8 + 0.12 * Math.sin(a * 5 + v * 9) * Math.sin(a * 2 - v * 6 + 1) + (hashRandom(x * 131 + y) - 0.5) * 0.1;
        const k = clamp(smooth * blotch, 0, 1);
        g.fillStyle = `rgba(16,17,20,${k.toFixed(3)})`;
        g.fillRect(x, y, 2, 2);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(
    () => () => {
      sootGeo.dispose();
      sootTexture?.dispose();
    },
    [sootGeo, sootTexture],
  );
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const s = modelRef.current.state;
    const target = s.basin === "held" ? BASIN_HELD : s.basin === "showing" ? BASIN_SHOW : BASIN_REST;
    const p = shown.current.pos;
    // Carried, not slid: it rises first, and swings out in front of the
    // thermocouple stand on the way to the flame, instead of passing
    // straight through the rod.
    const travelling = Math.abs(p.x - target[0]) > 0.6;
    const tz = s.basin === "held" && travelling ? 1.5 : target[2];
    p.x = relaxTo(p.x, target[0], 0.5, dt);
    p.y = relaxTo(p.y, target[1], 0.18, dt);
    p.z = relaxTo(p.z, tz, 0.22, dt);
    // Leaning BACK (negative x-rotation) turns the underside, where the soot
    // is, toward the camera; leaning forward showed the clean inside.
    shown.current.tilt = relaxTo(shown.current.tilt, s.basin === "showing" ? -BASIN_SHOW_TILT : 0, 0.4, dt);
    shown.current.tongs = relaxTo(shown.current.tongs, s.basin === "held" ? 1 : 0, 0.25, dt);
    if (group.current) {
      group.current.position.copy(p);
      group.current.rotation.x = shown.current.tilt;
    }
    if (soot.current) {
      soot.current.visible = s.sootOnBasin > 0.01;
      soot.current.material.opacity = Math.min(1, 1.1 * s.sootOnBasin);
      const ring = soot.current.children[0];
      if (ring) ring.material.opacity = 0.9 * Math.min(1, 1.1 * s.sootOnBasin);
    }
    if (tongs.current) {
      tongs.current.visible = shown.current.tongs > 0.02;
      tongs.current.position.set(p.x + rim * 0.9, p.y + 0.25, p.z);
    }
  });
  return (
    <group>
      <group ref={group} position={BASIN_REST}>
        <EvaporatingBasin liquidRef={liquid} />
        {/* The soot: a film hugging the curved underside, densest where the
            flame touched and feathering out in blotches up the sides. */}
        <mesh ref={soot} geometry={sootGeo}>
          <meshStandardMaterial map={sootTexture ?? undefined} color="#ffffff" roughness={1} transparent opacity={0} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
          {/* The foot ring sits in the flame's path too, so it is blackened with the rest. */}
          <mesh position={[0, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[rim * 0.42, 0.036, 8, 30]} />
            <meshStandardMaterial color="#141518" roughness={1} transparent opacity={0.9} depthWrite={false} />
          </mesh>
        </mesh>
      </group>
      <group ref={tongs} visible={false}>
        <Tongs length={cm(24)} open={0.16} />
      </group>
      {/* The easel it is propped on: a base, a back board leaning at the
          basin's own angle, and a lip in front that its rim rests on. */}
      <group position={[BASIN_SHOW[0], 0, BASIN_SHOW[2]]}>
        <mesh position={[0, 0.05, -0.2]}>
          <boxGeometry args={[2.0, 0.1, 1.5]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
        <mesh position={[0, 1.3, -0.95]} rotation={[-(Math.PI / 2 - BASIN_SHOW_TILT), 0, 0]}>
          <boxGeometry args={[1.9, 2.5, 0.06]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
        <mesh position={[0, 0.2, 0.42]}>
          <boxGeometry args={[1.6, 0.2, 0.1]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      </group>
    </group>
  );
}

// ─── The triangle ───────────────────────────────────────────────────

const TRI = { r: 0.95 };
const TRI_POINTS = [
  [0, TRI.r, 0],
  [-TRI.r * 0.87, -TRI.r * 0.5, 0],
  [TRI.r * 0.87, -TRI.r * 0.5, 0],
];
const TRI_NAMES = ["Heat", "Fuel", "Oxygen"];
const TRI_KEYS = ["heat", "fuel", "oxygen"];

/** Frames the bench at the canvas's aspect, and hands the target to the orbit controls. */
function FitCamera() {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls);
  const aspect = useThree((st) => st.size.width / Math.max(st.size.height, 1));
  useEffect(() => {
    // A canvas measured before layout is 0 wide; fitting to it sends the camera to NaN.
    if (!(aspect > 0.05)) return;
    const target = new THREE.Vector3(VIEW.cx, (VIEW.top + VIEW.bottom) / 2, 0);
    const fit = Math.max((VIEW.top - VIEW.bottom) / 2 / TAN_HALF_FOV, VIEW.width / 2 / (TAN_HALF_FOV * aspect)) * 1.04;
    camera.position.copy(target).addScaledVector(VIEW_DIRECTION, fit);
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [camera, controls, aspect]);
  return null;
}

const NoLabel = () => null;

/** A label that wraps to a fixed width, for the one long sentence under the bench. */
function NoteLabel({ position, children, tone = "text-ink-300" }) {
  return (
    <Html position={position} center style={{ pointerEvents: "none" }} zIndexRange={[40, 0]}>
      <div className={`w-[19rem] rounded-md border border-ink-800 bg-ink-950/85 px-2 py-1 text-center text-[10px] font-medium leading-snug ${tone}`}>{children}</div>
    </Html>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function CombustionFireTriangleCanvas({ params = {}, setParam }) {
  const {
    collar = 15,
    cutFuel = 0,
    bellJar = 0,
    waterMist = 0,
    holdBasin = 0,
    relight = 0,
    speed = 1,
    showLabels = true,
    liveLit = true,
    liveTempC = null,
    liveO2 = 20.9,
    liveHeat = 1,
    liveFuel = true,
    liveJar = "up",
    liveBasin = "rest",
    liveSoot = 0,
    liveOut = "",
  } = params || {};
  const modelRef = useRef(null);
  if (modelRef.current === null) modelRef.current = { state: createCombustionState(collar), profile: flameProfile(collar) };
  const flameRef = useRef({ height: 0, colour: "#f5b731", inner: 0, roar: 0, luminous: 1 });
  const tokens = useMemo(() => ({ cutFuel, bellJar, waterMist, holdBasin, relight }), [cutFuel, bellJar, waterMist, holdBasin, relight]);

  const profile = useMemo(() => flameProfile(collar), [collar]);
  // Each interrupter takes exactly one side: the side that put the flame
  // out stays missing until a relight, the other two stay present.
  const status = {
    fuel: Boolean(liveFuel),
    oxygen: liveOut === "oxygen" ? false : liveO2 >= O2_EXTINCTION * 100,
    // The same rule as `triangleStatus`: only the mist takes heat away; while
    // a relight waits on the jar, the striker is the heat.
    heat: Boolean(liveLit) || liveOut !== "heat",
  };
  const tempC = liveTempC === null || liveTempC === undefined ? Math.round(profile.temperatureC) : liveTempC;
  const lit = Boolean(liveLit);
  const description = describeFlame({ lit, extinguishedBy: liveOut || null, jarO2: liveO2 / 100, heat: liveHeat }, collar);
  const Label = showLabels ? SceneLabel : NoLabel;
  // The readouts stand to the right of the jar, clear of it and the flame.
  const READOUT_X = 3.55;
  const READOUT_Y = BENCH_Y + JAR_UP_Y + JAR.height * 0.75;

  return (
    <SceneCanvas camera={{ position: [-0.3, 4.5, 18], fov: FOV }} controls={{ minDistance: 4, maxDistance: 32, target: [VIEW.cx, (VIEW.top + VIEW.bottom) / 2, 0] }}>
      <FitCamera />
      <CombustionDriver modelRef={modelRef} flameRef={flameRef} collar={collar} tokens={tokens} animSpeed={speed} setParam={setParam} />

      <LabWall benchY={BENCH_Y} width={24} height={13} shelfHeight={6.4} />
      <LabBench y={BENCH_Y} width={17} depth={7} />
      <group position={[0, BENCH_Y, 0]}>
        <HeatMat position={[0, 0, 0]} size={[5.2, 3.8]} />
        <HeatShield position={[0, 0, -2.15]} />
        <BunsenBurner position={[0, BURNER_Y, 0]} collar={collar / 100} flameRef={flameRef} animSpeed={speed} valveOpen={Boolean(liveFuel)} />
        <GasTap modelRef={modelRef} animSpeed={speed} />
        <Thermocouple modelRef={modelRef} animSpeed={speed} />
        <ThermoMeter />
        <BellJar modelRef={modelRef} animSpeed={speed} />
        <SprayBottle position={BOTTLE_POS} />
        <CoDetector modelRef={modelRef} />
        <ColdBasin modelRef={modelRef} animSpeed={speed} />
        <Soot modelRef={modelRef} animSpeed={speed} />
        <Smoke modelRef={modelRef} animSpeed={speed} />
        <WaterMist modelRef={modelRef} animSpeed={speed} />
      </group>

      <FireTrianglePoster status={status} Label={Label} />

      {/* The live equation and the numbers, beside the jar. */}
      <Label position={[READOUT_X, READOUT_Y + 0.9, 0]} accent>
        {lit ? profile.equation.label : "no combustion"}
      </Label>
      <Label position={[READOUT_X, READOUT_Y + 0.45, 0]} tone={lit ? "text-ink-100" : "text-ink-400"}>
        {lit ? profile.equation.text : "the triangle is broken"}
      </Label>
      <Label position={[READOUT_X, READOUT_Y, 0]} tone={lit ? (profile.mode === "complete" ? "text-sky-300" : "text-amber-300") : "text-ink-400"}>
        {lit
          ? `collar ${profile.label} · ${profile.mode === "complete" ? "blue · CO₂ + H₂O" : `yellow · CO + soot`}`
          : liveOut
            ? `flame out · ${liveOut} removed`
            : "flame out · unlit"}
      </Label>
      <Label position={[PROBE_STAND[0] + 0.2, BENCH_Y + PROBE_Y + 1.05, PROBE_STAND[2]]} tone="text-ink-300">
        {`thermocouple · ${tempC} °C`}
      </Label>
      <Label position={[TAP_POS[0], BENCH_Y + 1.2, TAP_POS[2]]} tone={liveFuel ? "text-ink-300" : "text-rose-300"}>
        {`methane supply · ${liveFuel ? "open" : "SHUT"}`}
      </Label>
      <Label position={[0, liveJar === "up" ? BENCH_Y + JAR_UP_Y + JAR.height * 0.5 : BENCH_Y + JAR.height + 0.5, JAR.radius + 0.3]} tone={liveJar === "up" ? "text-ink-400" : liveO2 < O2_EXTINCTION * 100 ? "text-rose-300" : "text-sky-300"}>
        {liveJar === "up" ? "bell jar raised · air 20.9% O₂" : `bell jar ${liveJar} · O₂ ${liveO2.toFixed(2)}%${liveO2 < O2_EXTINCTION * 100 ? " — below 16%" : ""}`}
      </Label>
      <Label position={[DETECTOR_POS[0], BENCH_Y + DETECTOR_POS[1] + 0.8, DETECTOR_POS[2]]} tone={lit && profile.coFraction > 0.45 ? "text-rose-300" : lit && profile.coFraction > 0.12 ? "text-amber-300" : "text-emerald-300"}>
        {`CO alarm · ${lit ? profile.coPpm : 0} ppm`}
      </Label>
      <Label
        position={liveBasin === "held" ? [-1.9, BENCH_Y + MOUTH_Y + 0.45, 0.9] : liveBasin === "showing" ? [BASIN_SHOW[0], BENCH_Y + 0.45, BASIN_SHOW[2] + 1.2] : [BASIN_REST[0], BENCH_Y + 1.3, BASIN_REST[2]]}
        tone={liveSoot > 0.05 ? "text-amber-300" : "text-ink-400"}
      >
        {liveBasin === "held"
          ? `basin in the flame · ${BASIN_HOLD_S} s hold`
          : liveBasin === "showing"
            ? liveSoot > 0.05
              ? `underside: soot ${(liveSoot * 100).toFixed(0)}% — unburnt carbon`
              : "underside: clean — the carbon all left as CO₂"
            : "cold evaporating basin"}
      </Label>
      {showLabels && (
        <NoteLabel position={[VIEW.cx, BENCH_Y - 0.7, 3.2]} tone={lit ? "text-ink-300" : "text-rose-300"}>
          {description}
        </NoteLabel>
      )}

    </SceneCanvas>
  );
}
