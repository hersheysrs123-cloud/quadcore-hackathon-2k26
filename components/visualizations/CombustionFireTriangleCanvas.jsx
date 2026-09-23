"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
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
  LabBench,
  RUBBER,
  RetortStand,
  STEEL,
  SprayBottle,
  Tongs,
  basinRimRadius,
  cm,
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
const JAR_UP_Y = 6.4;
const PROBE_STAND = [3.0, 0, 0];
const PROBE_Y = MOUTH_Y + 1.35;
const PROBE_LENGTH = 0.95;
const TAP_POS = [-3.7, 0, 1.15];
const BOTTLE_POS = [3.9, 0, 1.55];
const BASIN_REST = [4.9, 0.02, 0.1];
const BASIN_HELD = [0, MOUTH_Y + 1.25, 0];
const BASIN_SHOW = [-4.7, 0.62, 1.35];
const DETECTOR_POS = [-3.4, 0, -1.4];
// Far enough left that the "Oxygen" vertex clears the flame readouts centred over the burner.
const TRIANGLE_POS = [-5.0, BENCH_Y + 6.1, -1.2];

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

/** A CO detector standing at the back of the bench — green, amber, red. */
function CoDetector({ modelRef }) {
  const led = useRef(null);
  useFrame(() => {
    const m = modelRef.current;
    const co = m.state.lit ? m.profile.coFraction : 0;
    if (!led.current) return;
    const colour = co > 0.45 ? PALETTE.rose : co > 0.12 ? PALETTE.gold : PALETTE.emerald;
    led.current.material.color.set(colour);
    led.current.material.emissive.set(colour);
    led.current.material.emissiveIntensity = 0.8 + co * 1.5;
  });
  return (
    <group position={DETECTOR_POS}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.7, 0.9, 0.3]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.62, 0.16]}>
        <boxGeometry args={[0.42, 0.22, 0.02]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh ref={led} position={[0.2, 0.28, 0.16]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial color={PALETTE.emerald} emissive={PALETTE.emerald} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * The thermocouple on its stand: the probe hangs from the clamp jaws into
 * the flame, and the whole arm swings out toward the camera whenever the
 * bell jar is on its way down, so the jar never passes through it. The
 * stand's arm group and the probe group are turned by the same angle.
 */
function Thermocouple({ modelRef, animSpeed = 1 }) {
  const arms = useRef([]);
  const probe = useRef(null);
  const shown = useRef({ swing: 0 });
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const s = modelRef.current.state;
    const clear = s.jarDown || s.jarTravel > 0.01 ? 1 : 0;
    shown.current.swing = relaxTo(shown.current.swing, clear, 0.3, dt);
    const angle = Math.PI + (shown.current.swing * Math.PI) / 2;
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
          <mesh position={[0, -PROBE_LENGTH, 0]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial color="#d1d5db" emissive="#d1d5db" emissiveIntensity={0.3} metalness={0.5} roughness={0.3} />
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
        size: 0.02 + hashRandom(i * 10.3 + 9) * 0.035,
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
      SCRATCH_OBJECT.position.set(Math.cos(s.angle + t * s.drift) * rad, tip + t * 3.2, Math.sin(s.angle + t * s.drift) * rad);
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
      <meshStandardMaterial color="#0b0d12" roughness={1} transparent opacity={0.85} />
    </instancedMesh>
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
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const s = modelRef.current.state;
    const target = s.basin === "held" ? BASIN_HELD : s.basin === "showing" ? BASIN_SHOW : BASIN_REST;
    const p = shown.current.pos;
    p.x = relaxTo(p.x, target[0], 0.35, dt);
    p.y = relaxTo(p.y, target[1], 0.35, dt);
    p.z = relaxTo(p.z, target[2], 0.35, dt);
    shown.current.tilt = relaxTo(shown.current.tilt, s.basin === "showing" ? 1.15 : 0, 0.4, dt);
    shown.current.tongs = relaxTo(shown.current.tongs, s.basin === "held" ? 1 : 0, 0.25, dt);
    if (group.current) {
      group.current.position.copy(p);
      group.current.rotation.x = shown.current.tilt;
    }
    if (soot.current) soot.current.material.opacity = 0.92 * s.sootOnBasin;
    if (tongs.current) {
      tongs.current.visible = shown.current.tongs > 0.02;
      tongs.current.position.set(p.x + rim * 0.9, p.y + 0.25, p.z);
    }
  });
  return (
    <group>
      <group ref={group} position={BASIN_REST}>
        <EvaporatingBasin liquidRef={liquid} />
        {/* The soot, painted on the underside. */}
        <mesh ref={soot} position={[0, -0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[rim * 0.62, 28]} />
          <meshStandardMaterial color="#0b0d12" roughness={1} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <group ref={tongs} visible={false}>
        <Tongs length={cm(24)} open={0.16} />
      </group>
      {/* The cradle it is shown on. */}
      <group position={[BASIN_SHOW[0], 0, BASIN_SHOW[2]]}>
        <mesh position={[0, 0.06, -0.15]}>
          <boxGeometry args={[1.6, 0.12, 0.9]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
        <mesh position={[0, 0.45, -0.55]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[1.5, 0.9, 0.08]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      </group>
    </group>
  );
}

// ─── The triangle ───────────────────────────────────────────────────

const TRI = { r: 1.05 };
const TRI_POINTS = [
  [0, TRI.r, 0],
  [-TRI.r * 0.87, -TRI.r * 0.5, 0],
  [TRI.r * 0.87, -TRI.r * 0.5, 0],
];
const TRI_NAMES = ["Heat", "Fuel", "Oxygen"];
const TRI_KEYS = ["heat", "fuel", "oxygen"];

/** The fire triangle drawn as a triangle — a vertex goes red the moment its side is taken away. */
function FireTriangle({ status }) {
  const outline = useMemo(() => [...TRI_POINTS, TRI_POINTS[0]], []);
  const allGood = status.heat && status.fuel && status.oxygen;
  return (
    <group position={TRIANGLE_POS}>
      <Line points={outline} color={allGood ? PALETTE.gold : PALETTE.rose} lineWidth={2.2} transparent opacity={0.9} />
      {TRI_POINTS.map((p, i) => {
        const ok = status[TRI_KEYS[i]];
        return (
          <group key={TRI_KEYS[i]}>
            <mesh position={p}>
              <sphereGeometry args={[0.13, 16, 16]} />
              <meshStandardMaterial color={ok ? PALETTE.emerald : PALETTE.rose} emissive={ok ? PALETTE.emerald : PALETTE.rose} emissiveIntensity={1.2} toneMapped={false} />
            </mesh>
            <SceneLabel position={[p[0] * 1.45, p[1] * 1.45 - (i === 0 ? -0.1 : 0.05), 0]} tone={ok ? "text-emerald-300" : "text-rose-300"}>
              {`${TRI_NAMES[i]} ${ok ? "✓" : "✗"}`}
            </SceneLabel>
          </group>
        );
      })}
      <SceneLabel position={[0, -TRI.r - 0.75, 0]} accent={allGood} tone={allGood ? "text-duck-300" : "text-rose-300"}>
        {allGood ? "fire triangle complete" : "a side is missing — no flame"}
      </SceneLabel>
    </group>
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
    heat: Boolean(liveLit) || (liveOut !== "heat" && (liveOut !== "" || liveHeat >= 0.35)),
  };
  const tempC = liveTempC === null || liveTempC === undefined ? Math.round(profile.temperatureC) : liveTempC;
  const lit = Boolean(liveLit);
  const description = describeFlame({ lit, extinguishedBy: liveOut || null, jarO2: liveO2 / 100, heat: liveHeat }, collar);

  return (
    <SceneCanvas camera={{ position: [-0.6, 3.8, 17.5], fov: 44 }} controls={{ minDistance: 4, maxDistance: 32, target: [-0.6, 1.3, 0] }}>
      <CombustionDriver modelRef={modelRef} flameRef={flameRef} collar={collar} tokens={tokens} animSpeed={speed} setParam={setParam} />

      <LabBench y={BENCH_Y} width={17} depth={7} />
      <group position={[0, BENCH_Y, 0]}>
        <HeatMat position={[0, 0, 0]} size={[5.2, 3.8]} />
        <HeatShield position={[0, 0, -2.15]} />
        <BunsenBurner position={[0, BURNER_Y, 0]} collar={collar / 100} flameRef={flameRef} animSpeed={speed} valveOpen={Boolean(liveFuel)} />
        <GasTap modelRef={modelRef} animSpeed={speed} />
        <Thermocouple modelRef={modelRef} animSpeed={speed} />
        <BellJar modelRef={modelRef} animSpeed={speed} />
        <SprayBottle position={BOTTLE_POS} />
        <CoDetector modelRef={modelRef} />
        <ColdBasin modelRef={modelRef} animSpeed={speed} />
        <Soot modelRef={modelRef} animSpeed={speed} />
        <WaterMist modelRef={modelRef} animSpeed={speed} />
      </group>

      <FireTriangle status={status} />

      {/* The live equation and the numbers, hung above the flame. */}
      <SceneLabel position={[0, BENCH_Y + MOUTH_Y + 3.15, 0]} accent>
        {lit ? `${profile.equation.label}: ${profile.equation.text}` : "no combustion — the triangle is broken"}
      </SceneLabel>
      <SceneLabel position={[0, BENCH_Y + MOUTH_Y + 2.78, 0]} tone={lit ? (profile.mode === "complete" ? "text-sky-300" : "text-amber-300") : "text-ink-400"}>
        {lit
          ? `collar ${profile.label} · ${tempC} °C · ${profile.mode === "complete" ? "blue, inner cone, CO₂ + H₂O" : `yellow, ${profile.coPpm} ppm CO, soot`}`
          : `flame out · ${tempC} °C · ${liveOut ? `${liveOut} removed` : "unlit"}`}
      </SceneLabel>
      <SceneLabel position={[PROBE_STAND[0] - 0.4, BENCH_Y + PROBE_Y + 0.5, PROBE_STAND[2]]} tone="text-ink-300">
        {`thermocouple · ${tempC} °C`}
      </SceneLabel>
      <SceneLabel position={[TAP_POS[0], BENCH_Y + 1.2, TAP_POS[2]]} tone={liveFuel ? "text-ink-300" : "text-rose-300"}>
        {`methane supply · ${liveFuel ? "open" : "SHUT"}`}
      </SceneLabel>
      <SceneLabel position={[0, liveJar === "up" ? BENCH_Y + JAR_UP_Y + JAR.height * 0.5 : BENCH_Y + JAR.height + 0.5, JAR.radius + 0.3]} tone={liveJar === "up" ? "text-ink-500" : liveO2 < O2_EXTINCTION * 100 ? "text-rose-300" : "text-sky-300"}>
        {liveJar === "up" ? "bell jar raised · air 20.9% O₂" : `bell jar ${liveJar} · O₂ ${liveO2.toFixed(1)}%${liveO2 < O2_EXTINCTION * 100 ? " — below 16%, flame out" : ""}`}
      </SceneLabel>
      <SceneLabel position={[DETECTOR_POS[0], BENCH_Y + 1.25, DETECTOR_POS[2]]} tone={lit && profile.coFraction > 0.45 ? "text-rose-300" : lit && profile.coFraction > 0.12 ? "text-amber-300" : "text-emerald-300"}>
        {`CO detector · ${lit ? profile.coPpm : 0} ppm`}
      </SceneLabel>
      <SceneLabel
        position={liveBasin === "held" ? [-2.3, BENCH_Y + BASIN_HELD[1] + 0.2, 0.6] : liveBasin === "showing" ? [BASIN_SHOW[0], BENCH_Y + 1.9, BASIN_SHOW[2]] : [BASIN_REST[0], BENCH_Y + 1.3, BASIN_REST[2]]}
        tone={liveSoot > 0.05 ? "text-amber-300" : "text-ink-400"}
      >
        {liveBasin === "held"
          ? `basin in the flame · ${BASIN_HOLD_S} s hold`
          : liveBasin === "showing"
            ? liveSoot > 0.05
              ? `underside: soot ${(liveSoot * 100).toFixed(0)}% — unburnt carbon`
              : "underside: clean — the carbon all left as CO₂"
            : "cold evaporating basin"}
      </SceneLabel>
      <SceneLabel position={[0, BENCH_Y - 0.75, 3.0]} tone="text-ink-400">
        {description}
      </SceneLabel>

    </SceneCanvas>
  );
}
