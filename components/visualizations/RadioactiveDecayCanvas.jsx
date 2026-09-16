"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  VectorArrow,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import { DARK_STEEL, LabBench, PAPER, STEEL } from "@/components/visualizations/lab-bench";
import { InstancedPopulation, createPopulation, killParticle, makeRng, setParticleColour, spawnParticle } from "@/components/visualizations/particle-population";
import { LiveTrace } from "@/components/visualizations/live-trace";
import {
  CURVE_HALF_LIVES,
  MAX_ATOMS,
  PARTICLE_KINDS,
  SIM_HALF_LIFE_S,
  activityBq,
  barrierFor,
  createDecayState,
  deflection,
  measuredRate,
  modeFor,
  nuclearEquation,
  stepDecay,
  theoreticalN,
  transmission,
} from "@/lib/radioactiveDecay";

// ─── Radioactive decay and half-life ────────────────────────────────
// A slab of up to ten thousand nuclei in a lead holder, open toward a
// test track: a pair of charged plates, a barrier, and a Geiger–Müller
// tube at the end. The model (`lib/radioactiveDecay.js`) rolls a die for
// every surviving nucleus every frame; this file draws what that does.
//
// Two populations, one engine:
//
//   nuclei    one instanced mesh at MAX_ATOMS capacity, allocated once.
//             The slider only changes `count` and re-places the slab, so
//             dragging it never reallocates. Nuclei never move — their
//             matrices are uploaded once — and a decay is a colour write
//             for one index, flushed as one buffer update per frame.
//   tracers   a ring buffer of a few hundred radiation particles. When
//             the activity is high (ten thousand atoms decay 700 times a
//             second at the start) only a sample of decays gets a tracer;
//             the Geiger rate in the readout is the model's, not a count
//             of what was drawn.
//
// The decay curve at the back is a preallocated live trace (`live-trace.jsx`)
// that gains a vertex every tenth of a sim second, against the dashed
// N₀e^(−λt) it is being compared to.
// ─────────────────────────────────────────────────────────────────────

const BENCH_Y = -2.9;
const TRACK_Y = 1.6;
const SOURCE_X = -3.7;
const SLAB_W = 3.4;
const HOLDER_BACK_X = SOURCE_X - 2.05;
const HOLDER_HALF_Z = 2.15;
const PLATE_X0 = 0.3;
const PLATE_X1 = 3.5;
const PLATE_GAP = 1.55;
const BARRIER_X = 5.3;
const GM_X = 7.8;
const GM_WINDOW_R = 0.4;
const TRACK_END_X = 9.7;
const TRACER_CAPACITY = 512;
/** Tracers launched per second at most — the readout carries the true rate. */
const TRACER_RATE = 36;
const PUSH_EVERY_S = 0.2;
const TRACE_EVERY_S = 0.1;
const CHART_POS = [-0.6, 5.1, -3.6];
const CHART_W = 6.6;
const CHART_H = 3.0;

const PARENT_COLOUR = "#fbbf24";
const DAUGHTER_COLOUR = "#3b4658";
const KIND_INDEX = { alpha: 1, beta_minus: 2, beta_plus: 3, gamma: 4, neutrino: 5 };
const KIND_BY_INDEX = ["", "alpha", "beta_minus", "beta_plus", "gamma", "neutrino"];

// ─── Slab layout ────────────────────────────────────────────────────

/** Columns, rows and depth for N nuclei — a 3 : 2 : 1.5 slab that always spans SLAB_W. */
export function slabLayout(n) {
  const k = Math.cbrt(Math.max(n, 1) / 9);
  const cols = Math.max(2, Math.ceil(3 * k));
  const rows = Math.max(1, Math.ceil(2 * k));
  const deep = Math.max(1, Math.ceil(1.5 * k));
  const spacing = SLAB_W / cols;
  return { cols, rows, deep, spacing, radius: spacing * 0.36 };
}

/** Place the first `n` nuclei on the slab's sites — bottom layer first, back to front, left to right. */
function placeNuclei(pop, n, status) {
  const L = slabLayout(n);
  const x0 = SOURCE_X - ((L.cols - 1) / 2) * L.spacing;
  const z0 = -((L.deep - 1) / 2) * L.spacing;
  const y0 = TRACK_Y - ((L.rows - 1) / 2) * L.spacing;
  const perLayer = L.cols * L.deep;
  for (let i = 0; i < n; i += 1) {
    const layer = Math.floor(i / perLayer);
    const rem = i % perLayer;
    const iz = Math.floor(rem / L.cols);
    const ix = rem % L.cols;
    // A touch of jitter so the slab reads as a heap of atoms, not a grid.
    const j = L.spacing * 0.12;
    spawnParticle(pop, i, {
      x: x0 + ix * L.spacing + (hashRandom(i * 3.1 + 1) - 0.5) * j,
      y: y0 + layer * L.spacing + (hashRandom(i * 5.3 + 2) - 0.5) * j,
      z: z0 + iz * L.spacing + (hashRandom(i * 7.7 + 3) - 0.5) * j,
      scale: L.radius,
      kind: 0,
      colour: status && status[i] ? DAUGHTER_COLOUR : PARENT_COLOUR,
    });
  }
  pop.count = n;
  pop.dirtyMatrix = true;
  pop.dirtyColour = true;
  return L;
}

// ─── The driver ─────────────────────────────────────────────────────

/**
 * Steps the sample, recolours decayed nuclei, launches tracers, and keeps
 * the HUD and the decay trace in step. Renders both populations.
 */
function DecayDriver({ modelRef, mode, atoms, barrier, fieldOn, restart, animSpeed, setParam, nuclei, tracers, traceRef, gmRef }) {
  const pushed = useRef({ sinceLast: 0, values: {} });
  const seen = useRef({ restart, mode, atoms });
  const traceClock = useRef(0);
  const rng = useMemo(() => makeRng(1234 + atoms), [atoms]);

  const reset = (why) => {
    const m = modelRef.current;
    m.state = createDecayState(atoms);
    m.layout = placeNuclei(nuclei, m.state.n0, m.state.status);
    m.clicks = 0;
    m.absorbed = 0;
    m.restarts += why === "press" ? 1 : 0;
    for (let i = 0; i < tracers.capacity; i += 1) killParticle(tracers, i);
    tracers.count = tracers.capacity;
    tracers.next = 0;
    traceClock.current = 0;
    traceRef.current?.reset();
    traceRef.current?.push(0, CHART_H);
  };

  // The first sample, and a new one whenever the sample size or the isotope changes.
  useEffect(() => {
    const s = seen.current;
    if (modelRef.current.state === null || s.mode !== mode || s.atoms !== atoms) reset("change");
    seen.current = { ...s, mode, atoms };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, atoms]);

  const onFrame = (pop, dt) => {
    const m = modelRef.current;
    // The restart button: a counter that only goes up — except when the
    // HUD resets every parameter, when it goes back to zero; both mean "new sample".
    if (restart !== seen.current.restart) {
      seen.current.restart = restart;
      reset("press");
    }
    if (!m.state) reset("init");

    m.state = stepDecay(m.state, { dt, rng });
    const s = m.state;

    // Decayed this frame: recolour, and launch tracers for a sample of them.
    // The budget refills at TRACER_RATE a second, so a hot sample draws a
    // steady beam rather than a wall; every decay still counts in the model.
    const decayed = s.decayedNow;
    m.budget = Math.min((m.budget ?? 0) + TRACER_RATE * dt, 4);
    if (decayed.length > 0) {
      for (let k = 0; k < decayed.length; k += 1) setParticleColour(nuclei, decayed[k], DAUGHTER_COLOUR);
      const md = modeFor(mode);
      const launches = Math.min(decayed.length, Math.floor(m.budget));
      const stride = decayed.length / Math.max(launches, 1);
      for (let k = 0; k < launches; k += 1) {
        const i = decayed[Math.floor(k * stride)];
        const o = i * 3;
        for (const em of md.emissions) launchTracer(tracers, nuclei.position[o], nuclei.position[o + 1], nuclei.position[o + 2], em.kind, rng);
      }
      m.budget -= launches;
    }

    // Fly the tracers.
    stepTracers(tracers, dt, { barrier, fieldOn, rng, onDetect: () => (m.clicks += 1), onAbsorb: () => (m.absorbed += 1), gmRef });

    // The decay trace: one vertex per tenth of a sim second, up to the chart's edge.
    traceClock.current += dt;
    if (traceClock.current >= TRACE_EVERY_S && traceRef.current) {
      traceClock.current = 0;
      if (traceRef.current.length === 0) traceRef.current.push(0, CHART_H);
      const x = clamp(s.t / SIM_HALF_LIFE_S / CURVE_HALF_LIVES, 0, 1) * CHART_W;
      const y = (s.alive / s.n0) * CHART_H;
      if (s.t / SIM_HALF_LIFE_S <= CURVE_HALF_LIVES) traceRef.current.push(x, y);
    }

    // The HUD.
    if (typeof setParam !== "function") return;
    pushed.current.sinceLast += dt / Math.max(animSpeed, 1e-6);
    if (pushed.current.sinceLast < PUSH_EVERY_S) return;
    pushed.current.sinceLast = 0;
    const marks = s.halfLifeMarks;
    const next = {
      liveAlive: s.alive,
      liveT: Math.round(s.t * 100) / 100,
      liveRate: Math.round(measuredRate(s) * 10) / 10,
      liveActivity: Math.round(activityBq(s.alive) * 10) / 10,
      liveClicks: m.clicks,
      liveAbsorbed: m.absorbed,
      liveMarks: marks.map((v) => Math.round(v * 100) / 100).join(","),
      liveFinished: s.finished,
    };
    for (const [key, value] of Object.entries(next)) {
      if (pushed.current.values[key] !== value) {
        pushed.current.values[key] = value;
        setParam(key, value);
      }
    }
  };

  return (
    <>
      <InstancedPopulation population={nuclei} animSpeed={animSpeed} onFrame={onFrame}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.14} roughness={0.45} metalness={0.1} />
      </InstancedPopulation>
      <InstancedPopulation population={tracers} animSpeed={animSpeed}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </InstancedPopulation>
    </>
  );
}

/** Put a tracer in the next ring slot, heading +x from the nucleus with a little spread. */
function launchTracer(pop, x, y, z, kind, rng) {
  const i = pop.next ?? 0;
  pop.next = (i + 1) % pop.capacity;
  const k = PARTICLE_KINDS[kind];
  const spread = kind === "neutrino" ? 0.2 : 0.03;
  const ay = (rng() - 0.5) * spread;
  const az = (rng() - 0.5) * spread;
  spawnParticle(pop, i, {
    x,
    y,
    z,
    vx: k.speed * Math.cos(ay) * Math.cos(az),
    vy: k.speed * Math.sin(ay),
    vz: k.speed * Math.sin(az),
    scale: k.size,
    kind: KIND_INDEX[kind],
    colour: k.colour,
  });
}

/** Move every live tracer: plates bend the charged ones, the barrier takes its share, the tube counts the rest. */
function stepTracers(pop, dt, { barrier, fieldOn, rng, onDetect, onAbsorb, gmRef }) {
  const P = pop.position;
  const V = pop.velocity;
  const plateLen = PLATE_X1 - PLATE_X0;
  for (let i = 0; i < pop.capacity; i += 1) {
    const kindIndex = pop.kind[i];
    if (kindIndex === 0) continue;
    const kind = KIND_BY_INDEX[kindIndex];
    const o = i * 3;
    const xBefore = P[o];
    // Between the plates a charged particle accelerates across; the drawn
    // deflection over the plate span is the model's `magnitude`.
    if (fieldOn && xBefore > PLATE_X0 && xBefore < PLATE_X1) {
      const d = deflection(kind, true);
      if (d.direction !== 0) {
        const vx = Math.max(Math.abs(V[o]), 0.1);
        const a = (2 * d.magnitude * vx * vx) / (plateLen * plateLen);
        V[o + 1] += d.direction * a * dt;
      }
    }
    P[o] += V[o] * dt;
    P[o + 1] += V[o + 1] * dt;
    P[o + 2] += V[o + 2] * dt;
    pop.age[i] += dt;
    const x = P[o];
    const y = P[o + 1];
    // Hit a plate.
    if (x > PLATE_X0 && x < PLATE_X1 && Math.abs(y - TRACK_Y) > PLATE_GAP - 0.05) {
      killParticle(pop, i);
      continue;
    }
    // The barrier.
    if (xBefore < BARRIER_X && x >= BARRIER_X) {
      if (rng() > transmission(kind, barrier)) {
        killParticle(pop, i);
        if (kind !== "neutrino") onAbsorb();
        continue;
      }
    }
    // The tube window.
    if (xBefore < GM_X - 0.8 && x >= GM_X - 0.8 && kind !== "neutrino" && Math.abs(y - TRACK_Y) < GM_WINDOW_R) {
      killParticle(pop, i);
      onDetect();
      if (gmRef.current) gmRef.current.flash = 1;
      continue;
    }
    if (x > TRACK_END_X || Math.abs(y - TRACK_Y) > 3.4 || Math.abs(P[o + 2]) > 3.2 || pop.age[i] > 6) killParticle(pop, i);
  }
  pop.dirtyMatrix = true;
}

// ─── The apparatus ──────────────────────────────────────────────────

/** The lead holder the sample sits in, open toward the track and the camera. */
function SourceHolder() {
  const h = 3.4;
  return (
    <group>
      <mesh position={[HOLDER_BACK_X, TRACK_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, h, HOLDER_HALF_Z * 2 + 0.5]} />
        <meshStandardMaterial color="#3f4652" roughness={0.6} metalness={0.5} emissive="#3f4652" emissiveIntensity={0.15} />
      </mesh>
      {/* The far wall is full height; the near one is a lip, so the sample is in view. */}
      <mesh position={[SOURCE_X - 0.2, TRACK_Y, -(HOLDER_HALF_Z + 0.25)]} castShadow>
        <boxGeometry args={[4.2, h, 0.5]} />
        <meshStandardMaterial color="#3f4652" roughness={0.6} metalness={0.5} emissive="#3f4652" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[SOURCE_X - 0.2, TRACK_Y - h / 2 + 0.2, HOLDER_HALF_Z + 0.25]} castShadow>
        <boxGeometry args={[4.2, 0.4, 0.5]} />
        <meshStandardMaterial color="#3f4652" roughness={0.6} metalness={0.5} emissive="#3f4652" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[SOURCE_X - 0.2, TRACK_Y - h / 2 - 0.12, 0]} receiveShadow>
        <boxGeometry args={[4.6, 0.24, HOLDER_HALF_Z * 2 + 0.5]} />
        <meshStandardMaterial color="#3f4652" roughness={0.6} metalness={0.5} emissive="#3f4652" emissiveIntensity={0.15} />
      </mesh>
      <SceneLabel position={[HOLDER_BACK_X, TRACK_Y + h / 2 + 0.35, 0]} tone="text-ink-400">lead source holder</SceneLabel>
    </group>
  );
}

/** Two charged plates: positive above, negative below, lit when the field is on. */
function FieldPlates({ on }) {
  const mid = (PLATE_X0 + PLATE_X1) / 2;
  const len = PLATE_X1 - PLATE_X0;
  const arrows = useMemo(() => [-0.9, 0, 0.9].map((dx) => ({ from: [mid + dx, TRACK_Y + PLATE_GAP - 0.25, 0], to: [mid + dx, TRACK_Y - PLATE_GAP + 0.25, 0] })), [mid]);
  return (
    <group>
      <mesh position={[mid, TRACK_Y + PLATE_GAP, 0]} castShadow>
        <boxGeometry args={[len, 0.09, 2.8]} />
        <meshStandardMaterial color={on ? "#fb7185" : "#6b7280"} emissive={on ? "#fb7185" : "#6b7280"} emissiveIntensity={on ? 0.9 : 0.15} metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[mid, TRACK_Y - PLATE_GAP, 0]} castShadow>
        <boxGeometry args={[len, 0.09, 2.8]} />
        <meshStandardMaterial color={on ? "#38bdf8" : "#6b7280"} emissive={on ? "#38bdf8" : "#6b7280"} emissiveIntensity={on ? 0.9 : 0.15} metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Posts. */}
      {[PLATE_X0 + 0.2, PLATE_X1 - 0.2].map((x) => (
        <mesh key={x} position={[x, TRACK_Y - PLATE_GAP - 0.55 - (TRACK_Y - PLATE_GAP - 1.1) / 2 + 0.05, -1.2]}>
          <cylinderGeometry args={[0.05, 0.05, TRACK_Y - PLATE_GAP + 1.1, 8]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      ))}
      {on && arrows.map((a, i) => <VectorArrow key={i} from={a.from} to={a.to} color="#94a3b8" radius={0.02} headLength={0.2} headRadius={0.07} opacity={0.5} />)}
      <SceneLabel position={[mid, TRACK_Y + PLATE_GAP + 0.38, 0]} tone={on ? "text-rose-300" : "text-ink-500"}>{on ? "+ plate · field ON" : "+ plate · field off"}</SceneLabel>
      <SceneLabel position={[mid, TRACK_Y - PLATE_GAP - 0.38, 0]} tone={on ? "text-sky-300" : "text-ink-500"}>{on ? "− plate" : "− plate"}</SceneLabel>
    </group>
  );
}

const BARRIER_THICKNESS = { paper: 0.04, aluminium: 0.2, lead: 0.75 };

/** The barrier across the track: a sheet, a plate, or a brick. */
function Barrier({ barrier }) {
  const b = barrierFor(barrier);
  const t = BARRIER_THICKNESS[barrier] ?? 0.2;
  const mat = barrier === "paper" ? PAPER : barrier === "aluminium" ? { color: "#c7cfd9", roughness: 0.3, metalness: 0.65, emissive: "#c7cfd9", emissiveIntensity: 0.3 } : { color: "#3f4652", roughness: 0.6, metalness: 0.5, emissive: "#3f4652", emissiveIntensity: 0.15 };
  return (
    <group position={[BARRIER_X + t / 2, TRACK_Y, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[t, 4.4, 3.2]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* A clamp stand holding it. */}
      <mesh position={[0, -2.2 - (TRACK_Y - 2.2) / 2 - 0.1, 0]}>
        <cylinderGeometry args={[0.06, 0.06, Math.max(TRACK_Y - 2.2, 0.01) + 0.2, 8]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <SceneLabel position={[0, 2.45, 1.7]} tone="text-ink-200">{`${b.label} · ${b.thickness}`}</SceneLabel>
    </group>
  );
}

/** The Geiger–Müller tube: a window facing the source, an LED that flashes per count. */
function GeigerTube({ gmRef }) {
  const led = useRef(null);
  useFrame((_, delta) => {
    const g = gmRef.current;
    g.flash = Math.max(0, g.flash - delta * 6);
    if (led.current) led.current.material.emissiveIntensity = 0.2 + g.flash * 3;
  });
  return (
    <group position={[GM_X, TRACK_Y, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 1.7, 24]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {/* The thin mica window. */}
      <mesh position={[-0.86, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 24]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#e2e8f0" emissiveIntensity={0.3} roughness={0.3} />
      </mesh>
      <mesh ref={led} position={[0.2, 0.52, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.2} toneMapped={false} />
      </mesh>
      {/* Stand. */}
      <mesh position={[0, -0.42 - (TRACK_Y - 0.42) / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, TRACK_Y - 0.42, 8]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh position={[0, -TRACK_Y + 0.05, 0]}>
        <cylinderGeometry args={[0.45, 0.5, 0.1, 20]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
    </group>
  );
}

// ─── The decay curve ────────────────────────────────────────────────

/** N/N₀ against time in half-lives — the dashed prediction and the live measured trace. */
function DecayCurvePanel({ modelRef, traceRef, marks }) {
  const marker = useRef(null);
  const theory = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 60; i += 1) {
      const halves = (i / 60) * CURVE_HALF_LIVES;
      pts.push([(i / 60) * CHART_W, Math.pow(0.5, halves) * CHART_H, 0]);
    }
    return pts;
  }, []);
  const guides = useMemo(
    () =>
      [1, 2, 3].map((k) => ({
        k,
        y: Math.pow(0.5, k) * CHART_H,
        x: (k / CURVE_HALF_LIVES) * CHART_W,
        points: [[0, Math.pow(0.5, k) * CHART_H, 0], [(k / CURVE_HALF_LIVES) * CHART_W, Math.pow(0.5, k) * CHART_H, 0], [(k / CURVE_HALF_LIVES) * CHART_W, 0, 0]],
      })),
    [],
  );
  const axes = useMemo(() => [[0, CHART_H, 0], [0, 0, 0], [CHART_W, 0, 0]], []);
  const markLines = useMemo(
    () => marks.map((t, i) => ({ t, i, points: [[clamp(t / SIM_HALF_LIFE_S / CURVE_HALF_LIVES, 0, 1) * CHART_W, 0, 0.01], [clamp(t / SIM_HALF_LIFE_S / CURVE_HALF_LIVES, 0, 1) * CHART_W, CHART_H, 0.01]] })),
    [marks],
  );

  useFrame(() => {
    const s = modelRef.current.state;
    if (!s || !marker.current) return;
    marker.current.position.set(clamp(s.t / SIM_HALF_LIFE_S / CURVE_HALF_LIVES, 0, 1) * CHART_W, (s.alive / s.n0) * CHART_H, 0.05);
  });

  return (
    <group position={CHART_POS}>
      <mesh position={[CHART_W / 2, CHART_H / 2, -0.06]}>
        <planeGeometry args={[CHART_W + 1.1, CHART_H + 1.6]} />
        <meshBasicMaterial color="#0d121c" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <Line points={axes} color={PALETTE.slate} lineWidth={1.8} />
      {guides.map((g) => (
        <group key={g.k}>
          <Line points={g.points} color={PALETTE.line} lineWidth={0.8} transparent opacity={0.5} dashed dashSize={0.1} gapSize={0.08} />
          <SceneLabel position={[-0.5, g.y, 0]} tone="text-ink-500">{`N₀/${Math.pow(2, g.k)}`}</SceneLabel>
        </group>
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((k) => (
        <SceneLabel key={k} position={[(k / CURVE_HALF_LIVES) * CHART_W, -0.3, 0]} tone="text-ink-500">{k === 0 ? "0" : `${k} t½`}</SceneLabel>
      ))}
      <Line points={theory} color={PALETTE.violet} lineWidth={1.6} dashed dashSize={0.14} gapSize={0.1} transparent opacity={0.85} />
      {/* The measured curve: grows in place, never rebuilt. */}
      <LiveTrace traceRef={traceRef} capacity={CURVE_HALF_LIVES * SIM_HALF_LIFE_S * 12} colour={PALETTE.gold} />
      {markLines.map((ml) => (
        <group key={ml.i}>
          <Line points={ml.points} color={PALETTE.emerald} lineWidth={1.2} transparent opacity={0.8} dashed dashSize={0.08} gapSize={0.06} />
          <SceneLabel position={[ml.points[0][0], CHART_H + 0.22 + (ml.i % 2) * 0.28, 0]} tone="text-emerald-300">{`${ml.t.toFixed(1)} s`}</SceneLabel>
        </group>
      ))}
      <mesh ref={marker} position={[0, CHART_H, 0.05]}>
        <sphereGeometry args={[0.1, 14, 14]} />
        <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      <SceneLabel position={[CHART_W / 2, CHART_H + 0.85, 0]} accent>
        {`N(t) = N₀ e^(−λt) · dashed = prediction · gold = this sample`}
      </SceneLabel>
      <SceneLabel position={[CHART_W / 2, -0.62, 0]} tone="text-ink-400">{`time · one half-life = ${SIM_HALF_LIFE_S} s on screen`}</SceneLabel>
      <SceneLabel position={[-0.55, CHART_H + 0.25, 0]} tone="text-ink-400">N/N₀</SceneLabel>
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function RadioactiveDecayCanvas({ params = {}, setParam }) {
  const {
    mode = "alpha",
    atoms = 2000,
    barrier = "paper",
    fieldOn = false,
    restart = 0,
    speed = 1,
    liveAlive = null,
    liveT = 0,
    liveRate = 0,
    liveActivity = null,
    liveClicks = 0,
    liveMarks = "",
    liveFinished = false,
  } = params || {};
  const n0 = clamp(Math.round(Number(atoms) || 2000), 1, MAX_ATOMS);
  const modelRef = useRef(null);
  if (modelRef.current === null) modelRef.current = { state: null, layout: null, clicks: 0, absorbed: 0, restarts: 0 };
  const gmRef = useRef({ flash: 0 });
  const traceRef = useRef(null);

  // Both populations allocated once, at capacity — the atoms slider changes `count`, not the buffers.
  const nuclei = useMemo(() => createPopulation(MAX_ATOMS), []);
  const tracers = useMemo(() => {
    const pop = createPopulation(TRACER_CAPACITY);
    pop.count = TRACER_CAPACITY;
    pop.next = 0;
    return pop;
  }, []);

  const md = modeFor(mode);
  const eq = nuclearEquation(mode);
  const b = barrierFor(barrier);
  const alive = liveAlive === null || liveAlive === undefined ? n0 : liveAlive;
  const activity = liveActivity === null || liveActivity === undefined ? activityBq(n0) : liveActivity;
  const marks = useMemo(() => (liveMarks ? String(liveMarks).split(",").map(Number).filter((v) => Number.isFinite(v)) : []), [liveMarks]);
  const halves = liveT / SIM_HALF_LIFE_S;
  const expected = theoreticalN(n0, liveT);
  const throughFraction = md.emissions.filter((e) => e.kind !== "neutrino").reduce((s, e) => s + transmission(e.kind, barrier), 0) / Math.max(md.emissions.filter((e) => e.kind !== "neutrino").length, 1);
  const primary = md.emissions[0];
  const defl = deflection(primary.kind, Boolean(fieldOn));
  // A bent beam misses the window: with the field on, only the neutral kinds still count.
  const detectorRate = defl.direction !== 0 ? 0 : liveRate * throughFraction;

  return (
    <SceneCanvas camera={{ position: [0.9, 5.4, 17.5], fov: 44 }} controls={{ minDistance: 5, maxDistance: 36, target: [1.1, 1.9, 0] }}>
      <LabBench y={BENCH_Y} width={20} depth={9} />
      <group position={[0, BENCH_Y, 0]}>
        <SourceHolder />
        <DecayDriver
          modelRef={modelRef}
          mode={mode}
          atoms={n0}
          barrier={barrier}
          fieldOn={Boolean(fieldOn)}
          restart={Number(restart) || 0}
          animSpeed={speed}
          setParam={setParam}
          nuclei={nuclei}
          tracers={tracers}
          traceRef={traceRef}
          gmRef={gmRef}
        />
        <FieldPlates on={Boolean(fieldOn)} />
        <Barrier barrier={barrier} />
        <GeigerTube gmRef={gmRef} />
        <DecayCurvePanel modelRef={modelRef} traceRef={traceRef} marks={marks} />

        {/* The equation, hung over the source. */}
        <SceneLabel position={[SOURCE_X, TRACK_Y + 2.75, 0.4]} accent>
          {eq.text}
        </SceneLabel>
        <SceneLabel position={[SOURCE_X, TRACK_Y + 2.4, 0.4]} tone={eq.conservedA && eq.conservedZ ? "text-emerald-300" : "text-rose-300"}>
          {`A: ${eq.left.A} = ${eq.right.A} ${eq.conservedA ? "✓" : "✗"} · Z: ${eq.left.Z} = ${eq.right.Z} ${eq.conservedZ ? "✓" : "✗"}`}
        </SceneLabel>
        <SceneLabel position={[SOURCE_X, TRACK_Y - 2.3, 1.2]} tone={liveFinished ? "text-ink-500" : "text-amber-300"}>
          {liveFinished
            ? `all ${n0.toLocaleString("en-GB")} decayed · ${halves.toFixed(1)} half-lives`
            : `${alive.toLocaleString("en-GB")} of ${n0.toLocaleString("en-GB")} ${md.parent.name} left · ${halves.toFixed(2)} t½ · predicted ${Math.round(expected).toLocaleString("en-GB")}`}
        </SceneLabel>
        <SceneLabel position={[SOURCE_X + 1.6, TRACK_Y - 2.65, 1.2]} tone="text-ink-400">
          {`activity λN = ${activity.toFixed(1)} Bq · counted ${liveRate.toFixed(1)} /s`}
        </SceneLabel>
        <SceneLabel position={[GM_X, TRACK_Y + 1.05, 0]} tone={detectorRate > 0.05 ? "text-emerald-300" : "text-ink-500"}>
          {`GM tube · ${detectorRate.toFixed(1)} counts/s · ${liveClicks} drawn hits`}
        </SceneLabel>
        <SceneLabel position={[GM_X, TRACK_Y - 1.0, 0]} tone="text-ink-400">
          {defl.direction !== 0
            ? `${primary.display} bent off the window by the field`
            : throughFraction >= 0.5
              ? `${primary.display} gets through ${b.label.toLowerCase()}`
              : throughFraction > 0.005
                ? `${primary.display} mostly stopped by ${b.label.toLowerCase()}`
                : `${primary.display} stopped by ${b.label.toLowerCase()}`}
        </SceneLabel>
        <SceneLabel position={[(PLATE_X0 + PLATE_X1) / 2, TRACK_Y - PLATE_GAP - 0.75, 0]} tone={fieldOn ? (defl.direction === 0 ? "text-violet-300" : "text-ink-200") : "text-ink-500"}>
          {fieldOn ? `${primary.display}: ${defl.reason}` : "plates off — every path is straight"}
        </SceneLabel>
      </group>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Radioactive decay"
        subtitle={md.label}
        rows={[
          ["Equation", eq.text],
          ["Activity", `${activity.toFixed(1)} Bq`],
        ]}
      />
      <SceneLegend
        title="Key"
        items={[
          { color: PARENT_COLOUR, label: `${md.parent.name} (parent)`, note: "undecayed — same chance every second" },
          { color: DAUGHTER_COLOUR, label: `${md.daughter.name} (daughter)`, note: "decayed — stable, or the next link in a chain" },
          { color: PARTICLE_KINDS[primary.kind].colour, label: primary.name, note: md.range },
          ...(md.emissions.length > 1 ? [{ color: PARTICLE_KINDS.neutrino.colour, label: "neutrino", note: "no charge, no barrier, no click" }] : []),
        ]}
      />
    </SceneCanvas>
  );
}

