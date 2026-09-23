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
} from "@/components/visualizations/scene-kit";
import { relaxTo } from "@/components/visualizations/vessel-rack";
import { DARK_STEEL, GLASS, LabBench, STEEL, THICK_GLASS } from "@/components/visualizations/lab-bench";
import { InstancedPopulation, createPopulation, mixParticleColour, spawnParticle } from "@/components/visualizations/particle-population";
import {
  CONTAINER,
  C_TO_K,
  PARTICLE_COUNT,
  TEMP_MAX_C,
  TEMP_MIN_C,
  columnHeights,
  createThermalState,
  describePhase,
  heatingCurve,
  kineticReadout,
  phaseComposition,
  stateAtEnergy,
  stepThermal,
  substanceFor,
} from "@/lib/particleModel";

// ─── The particle model of matter ───────────────────────────────────
// Five hundred particles in a sealed glass column on a hotplate that is
// also a cryocooler, with a piston on top. The thermal model
// (`lib/particleModel.js`) owns one number — the energy supplied — and
// reads temperature, phase and how far through a transition off the
// heating curve. This file turns that into particles:
//
//   solid    the first nS particles sit on lattice sites, filled layer by
//            layer from the floor, and vibrate about them harder as the
//            temperature rises. Ice's sites are further apart than
//            water's packing, so the same 500 particles stand 9% taller
//            as a block than as a pool.
//   liquid   the next nL jostle in a pool above the block, each with a
//            wandering home it is pulled back toward — close, touching,
//            sliding past one another.
//   gas      the rest fly ballistically between the pool's surface and
//            the piston, bouncing off the walls, at a speed set by √T.
//
// Particle i's state is decided by where i falls in [solid | liquid | gas]
// as the model's fractions move, so melting takes particles off the top
// of the block one by one, boiling takes them off the pool's surface, and
// each glides to its new place rather than teleporting. The population is
// one instanced mesh (`particle-population.jsx`); nothing here mounts a
// mesh per particle.
// ─────────────────────────────────────────────────────────────────────

const BENCH_Y = -3.1;
const PLATE_TOP = 0;
const FLOOR_Y = PLATE_TOP + 0.12;
const WALL = 0.06;
const GLASS_HEIGHT = CONTAINER.maxHeight + 0.7;
const HALF_W = CONTAINER.width / 2;
const PISTON_THICK = 0.2;
const PUSH_EVERY_S = 0.2;
const CHART_POS = [3.4, 0.5, -0.4];
const CHART_W = 5.2;
const CHART_H = 4.4;
const THERMO_X = -3.0;
const GAUGE_X = -4.1;

const LATTICE_COLS = 8;
const PER_LAYER = LATTICE_COLS * LATTICE_COLS;
const LATTICE_BASE = 0.4;
const PARTICLE_R = { water: 0.115, neon: 0.1, co2: 0.125 };
const GAS_SPEED_AT_300K = 2.6;

const SCRATCH_V = new THREE.Vector3();

// ─── The driver ─────────────────────────────────────────────────────

/**
 * Steps the thermal model, moves every particle, and pushes the live
 * numbers to the HUD five times a second. Renders the population.
 */
function ParticleDriver({ modelRef, substance, pressureAtm, setpointC, animSpeed, setParam, population, seeds, heightsRef }) {
  const pushed = useRef({ sinceLast: 0, values: {} });
  const sub = substanceFor(substance);
  const radius = PARTICLE_R[substance] ?? 0.11;

  const onFrame = (pop, dt, elapsed) => {
    const m = modelRef.current;
    m.state = stepThermal(m.state, { substance, pressureAtm, setpointC, dt });
    const s = m.state;
    const comp = phaseComposition(s.phase, s.fraction);
    const n = PARTICLE_COUNT;
    const nS = Math.round(n * comp.solid);
    const nG = Math.round(n * comp.gas);
    const nL = Math.max(0, n - nS - nG);

    // Columns relax so a step in the model is a glide on screen.
    const target = columnHeights(substance, pressureAtm, s.tempC, comp);
    const h = heightsRef.current;
    h.solid = relaxTo(h.solid, target.solidH, 0.3, dt);
    h.liquid = relaxTo(h.liquid, target.liquidH, 0.3, dt);
    h.piston = relaxTo(h.piston, target.piston, 0.35, dt);

    const TK = Math.max(s.tempC + C_TO_K, 1);
    const spacing = LATTICE_BASE * Math.cbrt(sub.solidExpansion);
    const x0 = -((LATTICE_COLS - 1) / 2) * spacing;
    const layers = Math.ceil(nS / PER_LAYER);
    const blockTop = nS > 0 ? FLOOR_Y + radius + (layers - 1) * spacing + radius : FLOOR_Y;
    const poolBottom = blockTop + (nS > 0 ? 0.05 : 0);
    const poolTop = poolBottom + Math.max(h.liquid, nL > 0 ? radius * 2.2 : 0);
    const gasFloor = nL > 0 ? poolTop : blockTop;
    const pistonY = Math.max(h.piston + FLOOR_Y, gasFloor + radius * 2.5);
    const vibration = 0.02 + 0.075 * Math.sqrt(TK / 300);
    const gasSpeed = GAS_SPEED_AT_300K * Math.sqrt(TK / 300);
    const relax = 1 - Math.exp(-dt / 0.28);
    const heat = clamp((s.tempC - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C), 0, 1);

    const P = pop.position;
    const V = pop.velocity;
    const inner = HALF_W - WALL - radius;
    for (let i = 0; i < n; i += 1) {
      const o = i * 3;
      const sd = seeds[i];
      let kind;
      let tx;
      let ty;
      let tz;
      if (i < nS) {
        kind = 0;
        const layer = Math.floor(i / PER_LAYER);
        const ix = i % LATTICE_COLS;
        const iz = Math.floor(i / LATTICE_COLS) % LATTICE_COLS;
        const ph = elapsed * sd.freq + sd.phase;
        tx = x0 + ix * spacing + Math.sin(ph) * vibration;
        ty = FLOOR_Y + radius + layer * spacing + Math.sin(ph * 1.31 + 1.7) * vibration;
        tz = x0 + iz * spacing + Math.cos(ph * 0.87 + 0.6) * vibration;
      } else if (i < nS + nL) {
        kind = 1;
        const j = i - nS;
        // The home wanders — slowly, bounded — so the pool flows.
        sd.hx += (sd.dx * 0.35 + Math.sin(elapsed * 0.7 + sd.phase) * 0.25) * dt * Math.sqrt(TK / 300);
        sd.hz += (sd.dz * 0.35 + Math.cos(elapsed * 0.6 + sd.phase * 1.3) * 0.25) * dt * Math.sqrt(TK / 300);
        if (sd.hx > inner || sd.hx < -inner) sd.dx = -sd.dx;
        if (sd.hz > inner || sd.hz < -inner) sd.dz = -sd.dz;
        sd.hx = clamp(sd.hx, -inner, inner);
        sd.hz = clamp(sd.hz, -inner, inner);
        const span = Math.max(poolTop - poolBottom - radius * 2, 0);
        const jitter = vibration * 0.9;
        tx = sd.hx + Math.sin(elapsed * sd.freq * 1.6 + sd.phase) * jitter;
        ty = poolBottom + radius + ((j + 0.5) / Math.max(nL, 1)) * span + Math.sin(elapsed * sd.freq * 1.2 + sd.phase * 2.1) * jitter;
        tz = sd.hz + Math.cos(elapsed * sd.freq * 1.4 + sd.phase * 0.7) * jitter;
      } else {
        kind = 2;
      }

      const wasKind = pop.kind[i];
      if (kind !== wasKind) {
        pop.kind[i] = kind;
        if (kind === 2) {
          // Freshly evaporated: leave upward at the thermal speed.
          const a = sd.phase * 2;
          const up = 0.45 + hashRandom(i * 7.7 + elapsed) * 0.55;
          SCRATCH_V.set(Math.cos(a) * (1 - up), up, Math.sin(a) * (1 - up)).normalize().multiplyScalar(gasSpeed);
          V[o] = SCRATCH_V.x;
          V[o + 1] = SCRATCH_V.y;
          V[o + 2] = SCRATCH_V.z;
        }
      }

      if (kind === 2) {
        // Ballistic, speed pinned to √T, walls reflect.
        const vx = V[o];
        const vy = V[o + 1];
        const vz = V[o + 2];
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
        const k = gasSpeed / sp;
        V[o] = vx * k;
        V[o + 1] = vy * k;
        V[o + 2] = vz * k;
        let x = P[o] + V[o] * dt;
        let y = P[o + 1] + V[o + 1] * dt;
        let z = P[o + 2] + V[o + 2] * dt;
        if (x > inner) {
          x = inner;
          V[o] = -Math.abs(V[o]);
        } else if (x < -inner) {
          x = -inner;
          V[o] = Math.abs(V[o]);
        }
        if (z > inner) {
          z = inner;
          V[o + 2] = -Math.abs(V[o + 2]);
        } else if (z < -inner) {
          z = -inner;
          V[o + 2] = Math.abs(V[o + 2]);
        }
        const top = pistonY - PISTON_THICK / 2 - radius;
        const bottom = gasFloor + radius;
        if (y > top) {
          y = top;
          V[o + 1] = -Math.abs(V[o + 1]);
        } else if (y < bottom) {
          y = bottom;
          V[o + 1] = Math.abs(V[o + 1]);
        }
        P[o] = x;
        P[o + 1] = y;
        P[o + 2] = z;
        mixParticleColour(pop, i, sub.colour.gas, "#fb7185", heat * heat);
      } else {
        P[o] += (tx - P[o]) * relax;
        P[o + 1] += (ty - P[o + 1]) * relax;
        P[o + 2] += (tz - P[o + 2]) * relax;
        if (kind === 0) mixParticleColour(pop, i, sub.colour.solid, "#e0f2fe", heat * 0.5);
        else mixParticleColour(pop, i, sub.colour.liquid, "#bef264", heat * 0.6);
      }
      pop.scale[i] = radius;
    }
    pop.count = n;
    pop.dirtyMatrix = true;

    // The HUD.
    if (typeof setParam !== "function") return;
    pushed.current.sinceLast += dt / Math.max(animSpeed, 1e-6);
    if (pushed.current.sinceLast < PUSH_EVERY_S) return;
    pushed.current.sinceLast = 0;
    const next = {
      liveTempC: Math.round(s.tempC * 10) / 10,
      livePhase: s.phase,
      liveFraction: Math.round(s.fraction * 100) / 100,
      liveEnergyKJ: Math.round((s.energy / 1000) * 100) / 100,
      liveHeating: Math.round(s.heating),
      livePistonPct: Math.round((h.piston / CONTAINER.maxHeight) * 100),
    };
    for (const [key, value] of Object.entries(next)) {
      if (pushed.current.values[key] !== value) {
        pushed.current.values[key] = value;
        setParam(key, value);
      }
    }
  };

  return (
    <InstancedPopulation population={population} onFrame={onFrame} animSpeed={animSpeed}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.18} roughness={0.35} metalness={0.15} />
    </InstancedPopulation>
  );
}

// ─── The apparatus ──────────────────────────────────────────────────

/** The hotplate that is also a cryocooler: its top glows red-orange heating, ice-blue cooling. */
function HotPlate({ modelRef }) {
  const face = useRef(null);
  const rings = useRef([]);
  useFrame(() => {
    const s = modelRef.current.state;
    const drive = clamp((s.heating ?? 0) / 8000, -1, 1);
    const hot = drive > 0;
    const strength = Math.abs(drive);
    const colour = hot ? "#f97316" : "#38bdf8";
    if (face.current) {
      face.current.material.emissive.set(colour);
      face.current.material.emissiveIntensity = 0.05 + strength * 1.4;
    }
    for (const r of rings.current) {
      if (!r) continue;
      r.material.emissive.set(colour);
      r.material.emissiveIntensity = 0.1 + strength * 2.2;
    }
  });
  return (
    <group>
      <mesh position={[0, PLATE_TOP - 0.24, 0]} receiveShadow>
        <boxGeometry args={[4.6, 0.48, 4.6]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh ref={face} position={[0, PLATE_TOP - 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.2, 4.2]} />
        <meshStandardMaterial color="#1f2937" emissive="#f97316" emissiveIntensity={0.05} roughness={0.7} toneMapped={false} />
      </mesh>
      {[0.6, 1.1, 1.6].map((r, i) => (
        <mesh key={r} ref={(el) => (rings.current[i] = el)} position={[0, PLATE_TOP + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.045, 8, 48]} />
          <meshStandardMaterial color="#374151" emissive="#f97316" emissiveIntensity={0.1} roughness={0.6} toneMapped={false} />
        </mesh>
      ))}
      {/* The controller box at the front. */}
      <mesh position={[0, PLATE_TOP - 0.24, 2.55]}>
        <boxGeometry args={[1.6, 0.36, 0.5]} />
        <meshStandardMaterial color="#111827" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** The sealed column: thin glass walls, a thick base, and the piston on its rod. */
function Column({ heightsRef }) {
  const piston = useRef(null);
  const rod = useRef(null);
  useFrame(() => {
    const y = FLOOR_Y + heightsRef.current.piston;
    if (piston.current) piston.current.position.y = y;
    if (rod.current) {
      const top = FLOOR_Y + GLASS_HEIGHT + 0.9;
      rod.current.position.y = (y + top) / 2;
      rod.current.scale.y = Math.max(top - y, 0.01);
    }
  });
  const w = CONTAINER.width + WALL * 2;
  return (
    <group>
      {/* Base slab. */}
      <mesh position={[0, PLATE_TOP + 0.06, 0]}>
        <boxGeometry args={[w, 0.12, w]} />
        <meshPhysicalMaterial {...THICK_GLASS} />
      </mesh>
      {/* Four walls as one open box: drawn as a thin-walled box with the inside faces via DoubleSide. */}
      <mesh position={[0, FLOOR_Y + GLASS_HEIGHT / 2, 0]}>
        <boxGeometry args={[w, GLASS_HEIGHT, w]} />
        <meshPhysicalMaterial {...GLASS} />
      </mesh>
      {/* Edge frame so the glass reads as a box. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (w / 2), FLOOR_Y + GLASS_HEIGHT / 2, sz * (w / 2)]}>
            <boxGeometry args={[0.05, GLASS_HEIGHT, 0.05]} />
            <meshStandardMaterial color="#c3e6f2" emissive="#c3e6f2" emissiveIntensity={0.25} roughness={0.2} metalness={0.3} />
          </mesh>
        )),
      )}
      {/* Top cap the rod passes through. */}
      <mesh position={[0, FLOOR_Y + GLASS_HEIGHT + 0.05, 0]}>
        <boxGeometry args={[w + 0.2, 0.1, w + 0.2]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {/* The piston: a steel plate that seals the column. */}
      <group ref={piston} position={[0, FLOOR_Y + CONTAINER.maxHeight, 0]}>
        <mesh castShadow>
          <boxGeometry args={[CONTAINER.width - 0.02, PISTON_THICK, CONTAINER.depth - 0.02]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh position={[0, PISTON_THICK / 2 + 0.06, 0]}>
          <cylinderGeometry args={[0.4, 0.5, 0.12, 24]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      </group>
      <mesh ref={rod} position={[0, FLOOR_Y + CONTAINER.maxHeight + 0.5, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 1, 12]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {/* The crossbar the rod hangs from. */}
      <mesh position={[0, FLOOR_Y + GLASS_HEIGHT + 0.9, 0]}>
        <boxGeometry args={[1.6, 0.14, 0.3]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
    </group>
  );
}

/** A thermometer beside the column — the sample's temperature, with a tick for the hotplate's setpoint. */
function Thermometer({ modelRef, setpointC }) {
  const column = useRef(null);
  const tick = useRef(null);
  const bottom = FLOOR_Y + 0.4;
  const height = 5.6;
  const yOf = (c) => bottom + (clamp(c, TEMP_MIN_C, TEMP_MAX_C) - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C) * height;
  useFrame(() => {
    const s = modelRef.current.state;
    const y = yOf(s.tempC);
    if (column.current) {
      column.current.position.y = (bottom + y) / 2;
      column.current.scale.y = Math.max(y - bottom, 0.01);
      const t = clamp((s.tempC - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C), 0, 1);
      column.current.material.color.set(t < 0.4 ? "#38bdf8" : t < 0.7 ? "#fbbf24" : "#fb7185");
      column.current.material.emissive.copy(column.current.material.color);
    }
    if (tick.current) tick.current.position.y = yOf(setpointC);
  });
  const ticks = useMemo(() => [-100, 0, 100, 200, 250].map((c) => ({ c, y: yOf(c) })), []);
  return (
    <group position={[THERMO_X, 0, 0.6]}>
      <mesh position={[0, bottom + height / 2, 0]}>
        <cylinderGeometry args={[0.13, 0.13, height + 0.3, 16]} />
        <meshPhysicalMaterial {...GLASS} opacity={0.3} />
      </mesh>
      <mesh position={[0, bottom - 0.05, 0]}>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={0.6} />
      </mesh>
      <mesh ref={column} position={[0, bottom, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 1, 10]} />
        <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      {ticks.map((t) => (
        <group key={t.c}>
          <mesh position={[0.2, t.y, 0]}>
            <boxGeometry args={[0.14, 0.02, 0.02]} />
            <meshBasicMaterial color={PALETTE.bone} />
          </mesh>
          <SceneLabel position={[0.74, t.y, 0]} tone="text-ink-500">{`${t.c} °C`}</SceneLabel>
        </group>
      ))}
      {/* The setpoint tick: where the hotplate is trying to take the sample. */}
      <mesh ref={tick} position={[-0.22, bottom, 0]}>
        <coneGeometry args={[0.08, 0.16, 3]} />
        <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <SceneLabel position={[0, bottom + height + 0.85, 0]} tone="text-ink-300">sample thermometer</SceneLabel>
    </group>
  );
}

/** The kinetic-energy gauge: mean KE per particle, ∝ absolute temperature. */
function EnergyGauge({ modelRef }) {
  const bar = useRef(null);
  const bottom = FLOOR_Y + 0.4;
  const height = 5.6;
  useFrame(() => {
    const s = modelRef.current.state;
    const TK = Math.max(s.tempC + C_TO_K, 0);
    const t = clamp(TK / (TEMP_MAX_C + C_TO_K), 0, 1);
    if (bar.current) {
      bar.current.position.y = bottom + (t * height) / 2;
      bar.current.scale.y = Math.max(t * height, 0.01);
      bar.current.material.color.set(t < 0.45 ? "#60a5fa" : t < 0.7 ? "#fbbf24" : "#fb7185");
    }
  });
  return (
    <group position={[GAUGE_X, 0, 0.6]}>
      <mesh position={[0, bottom + height / 2, -0.02]}>
        <planeGeometry args={[0.36, height]} />
        <meshBasicMaterial color="#0d121c" transparent opacity={0.85} />
      </mesh>
      <mesh ref={bar} position={[0, bottom, 0]}>
        <planeGeometry args={[0.28, 1]} />
        <meshBasicMaterial color="#fbbf24" toneMapped={false} />
      </mesh>
      <SceneLabel position={[0, bottom - 0.32, 0]} tone="text-ink-500">0 K</SceneLabel>
      <SceneLabel position={[0, bottom + height + 0.25, 0]} tone="text-ink-300">mean KE · ³⁄₂ kT</SceneLabel>
    </group>
  );
}

// ─── The heating curve ──────────────────────────────────────────────

const PHASE_COLOUR = { solid: "#93c5fd", liquid: "#34d399", gas: "#fbbf24", melting: PALETTE.rose, boiling: PALETTE.rose, subliming: PALETTE.rose };

/**
 * Temperature against energy supplied, for this substance at this
 * pressure. The curve is rebuilt only when a control changes; the marker
 * that rides it is moved from the frame loop.
 */
function HeatingCurvePanel({ modelRef, substance, pressureAtm }) {
  const marker = useRef(null);
  const curve = useMemo(() => heatingCurve(substance, pressureAtm), [substance, pressureAtm]);
  const eMax = Math.max(curve.totalE, 1);
  const toWorld = (E, T) => [(clamp(E, 0, eMax) / eMax) * CHART_W, ((clamp(T, curve.fromC, curve.toC) - curve.fromC) / (curve.toC - curve.fromC)) * CHART_H, 0];

  const drawn = useMemo(() => {
    const segs = curve.segments.map((seg) => ({
      phase: seg.phase,
      flat: seg.dH !== undefined,
      points: [toWorld(seg.from.E, seg.from.T), toWorld(seg.to.E, seg.to.T)],
      label:
        seg.dH !== undefined
          ? `${seg.phase === "melting" ? "ΔH_fus" : seg.phase === "boiling" ? "ΔH_vap" : "ΔH_sub"} = ${(seg.dH / 1000).toFixed(1)} kJ/mol · ${seg.transitionC.toFixed(seg.transitionC % 1 === 0 ? 0 : 1)} °C`
          : null,
      mid: toWorld((seg.from.E + seg.to.E) / 2, (seg.from.T + seg.to.T) / 2),
    }));
    const grid = [];
    for (const T of [-100, 0, 100, 200]) {
      if (T < curve.fromC || T > curve.toC) continue;
      const y = toWorld(0, T)[1];
      grid.push({ T, points: [[0, y, 0], [CHART_W, y, 0]] });
    }
    const axes = [[0, CHART_H, 0], [0, 0, 0], [CHART_W, 0, 0]];
    return { segs, grid, axes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve]);

  useFrame(() => {
    const s = modelRef.current.state;
    if (!marker.current) return;
    const at = stateAtEnergy(curve, s.energy);
    const [x, y] = toWorld(s.energy, at.tempC);
    marker.current.position.set(x, y, 0.05);
  });

  return (
    <group position={CHART_POS}>
      <mesh position={[CHART_W / 2, CHART_H / 2, -0.06]}>
        <planeGeometry args={[CHART_W + 0.9, CHART_H + 1.5]} />
        <meshBasicMaterial color="#0d121c" transparent opacity={0.88} depthWrite={false} />
      </mesh>
      {drawn.grid.map((g) => (
        <group key={g.T}>
          <Line points={g.points} color={PALETTE.line} lineWidth={0.8} transparent opacity={0.45} dashed dashSize={0.1} gapSize={0.08} />
          <SceneLabel position={[-0.5, g.points[0][1], 0]} tone="text-ink-500">{`${g.T} °C`}</SceneLabel>
        </group>
      ))}
      <Line points={drawn.axes} color={PALETTE.slate} lineWidth={1.8} />
      {drawn.segs.map((seg, i) => (
        <group key={i}>
          <Line points={seg.points} color={PHASE_COLOUR[seg.phase] ?? PALETTE.bone} lineWidth={seg.flat ? 4 : 2.4} />
          {seg.label && (
            <SceneLabel position={[seg.mid[0] + (seg.phase === "melting" ? 1.1 : 0), seg.mid[1] + (seg.phase === "melting" ? -0.34 : 0.3), 0]} tone="text-rose-300">
              {seg.label}
            </SceneLabel>
          )}
        </group>
      ))}
      <mesh ref={marker} position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={PALETTE.bone} emissive={PALETTE.bone} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      <SceneLabel position={[CHART_W / 2, CHART_H + 0.55, 0]} accent>
        {`heating curve · ${curve.substance.label} at ${pressureAtm.toFixed(1)} atm`}
      </SceneLabel>
      <SceneLabel position={[CHART_W / 2, -0.42, 0]} tone="text-ink-400">
        {`energy supplied → (0 to ${(eMax / 1000).toFixed(0)} kJ/mol)`}
      </SceneLabel>
      <SceneLabel position={[-0.55, CHART_H + 0.2, 0]} tone="text-ink-400">T</SceneLabel>
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function ParticleModelMatterCanvas({ params = {}, setParam }) {
  const {
    temperature = 20,
    pressure = 1,
    substance = "water",
    speed = 1,
    liveTempC = null,
    livePhase = "liquid",
    liveFraction = 0,
    liveHeating = 0,
    livePistonPct = null,
  } = params || {};
  const pressureAtm = Number(pressure) || 1;
  const setpointC = Number(temperature) || 0;

  const modelRef = useRef(null);
  if (modelRef.current === null) {
    modelRef.current = { state: { ...createThermalState(substance, pressureAtm, setpointC), tempC: setpointC, phase: "liquid", fraction: 0 } };
  }
  const heightsRef = useRef({ solid: 0, liquid: CONTAINER.liquidHeight, piston: CONTAINER.liquidHeight + CONTAINER.minHeadspace });

  // One population for the life of the scene; the substance only changes how it is driven.
  const population = useMemo(() => createPopulation(PARTICLE_COUNT), []);
  const seeds = useMemo(() => {
    const inner = HALF_W - WALL - 0.15;
    const out = [];
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      out.push({
        phase: hashRandom(i * 3.7 + 1) * Math.PI * 2,
        freq: 6 + hashRandom(i * 5.1 + 2) * 6,
        hx: (hashRandom(i * 7.3 + 3) * 2 - 1) * inner,
        hz: (hashRandom(i * 9.9 + 4) * 2 - 1) * inner,
        dx: hashRandom(i * 11.1 + 5) * 2 - 1,
        dz: hashRandom(i * 13.3 + 6) * 2 - 1,
      });
    }
    // Start every particle in the pool so the first frame has somewhere to glide from.
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      spawnParticle(population, i, { x: out[i].hx, y: FLOOR_Y + 0.2 + (i / PARTICLE_COUNT) * 2.2, z: out[i].hz, scale: 0.11, kind: 1, colour: "#34d399" });
    }
    population.count = PARTICLE_COUNT;
    return out;
  }, [population]);

  const sub = substanceFor(substance);
  const tempC = liveTempC === null || liveTempC === undefined ? setpointC : liveTempC;
  const phaseInfo = describePhase({ substance, pressureAtm, tempC, phase: livePhase, fraction: liveFraction, heating: liveHeating });
  const ke = kineticReadout(substance, tempC);
  const heating = liveHeating > 50 ? "heating" : liveHeating < -50 ? "cooling" : "holding";
  const pistonPct = livePistonPct === null || livePistonPct === undefined ? Math.round((heightsRef.current.piston / CONTAINER.maxHeight) * 100) : livePistonPct;

  return (
    <SceneCanvas camera={{ position: [0.4, 5.6, 19.5], fov: 44 }} controls={{ minDistance: 5, maxDistance: 36, target: [0.6, 1.3, 0] }}>
      <LabBench y={BENCH_Y} width={18} depth={8} />
      <group position={[0, BENCH_Y, 0]}>
        <HotPlate modelRef={modelRef} />
        <Column heightsRef={heightsRef} />
        <ParticleDriver
          modelRef={modelRef}
          substance={substance}
          pressureAtm={pressureAtm}
          setpointC={setpointC}
          animSpeed={speed}
          setParam={setParam}
          population={population}
          seeds={seeds}
          heightsRef={heightsRef}
        />
        <Thermometer modelRef={modelRef} setpointC={setpointC} />
        <EnergyGauge modelRef={modelRef} />
        <HeatingCurvePanel modelRef={modelRef} substance={substance} pressureAtm={pressureAtm} />

        {/* Labels. */}
        <SceneLabel position={[0, FLOOR_Y + GLASS_HEIGHT + 1.52, 0]} accent>
          {`${sub.label} (${sub.formula}) · ${phaseInfo.label}`}
        </SceneLabel>
        <SceneLabel position={[0, FLOOR_Y + GLASS_HEIGHT + 1.1, 0]} tone={phaseInfo.key === "melting" || phaseInfo.key === "boiling" || phaseInfo.key === "subliming" || phaseInfo.key === "freezing" || phaseInfo.key === "condensing" || phaseInfo.key === "depositing" ? "text-rose-300" : "text-ink-300"}>
          {`${tempC.toFixed(1)} °C · ${phaseInfo.detail}`}
        </SceneLabel>
        <SceneLabel position={[0, PLATE_TOP - 0.55, 2.6]} tone={heating === "heating" ? "text-amber-300" : heating === "cooling" ? "text-sky-300" : "text-ink-400"}>
          {`${setpointC < tempC - 0.5 ? "cryocooler" : "hotplate"} set to ${setpointC.toFixed(0)} °C · ${heating}${heating !== "holding" ? ` at ${Math.abs(liveHeating).toLocaleString("en-GB")} J/mol·s` : ""}`}
        </SceneLabel>
        <SceneLabel position={[2.4, FLOOR_Y + GLASS_HEIGHT + 0.55, 1.2]} tone="text-ink-300">
          {`piston · ${pressureAtm.toFixed(1)} atm · ${pistonPct}% of travel`}
        </SceneLabel>
        {/* Under the gauge, not beside it: beside it sat on "0 K" and the thermometer's −100 °C tick. */}
        <SceneLabel position={[GAUGE_X + 0.3, FLOOR_Y - 0.45, 0.6]} tone="text-ink-400">
          {`${ke.meanKEzJ.toFixed(2)} ×10⁻²¹ J · v_rms ${ke.vRms.toFixed(0)} m/s`}
        </SceneLabel>
      </group>

    </SceneCanvas>
  );
}

