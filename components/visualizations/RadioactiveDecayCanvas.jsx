"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  VectorArrow,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import { DARK_STEEL, LabBench, PAPER, STEEL } from "@/components/visualizations/lab-bench";
import { InstancedPopulation, createPopulation, killParticle, makeRng, setParticleColour, spawnParticle } from "@/components/visualizations/particle-population";
import { LiveTrace } from "@/components/visualizations/live-trace";
import {
  CURVE_HALF_LIVES,
  DAUGHTER_COLOUR,
  MAX_ATOMS,
  PARENT_COLOUR,
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
// The beam runs this high above the bench, so the lower plate, the barrier
// and the tube all stand on stands rather than lying on the bench top.
const TRACK_Y = 2.2;
const SOURCE_X = -3.7;
const SLAB_W = 3.4;
const HOLDER_BACK_X = SOURCE_X - 2.05;
const HOLDER_HALF_Z = 2.15;
const HOLDER_H = 3.7;
/** Where the holder's walls start: just inside its base plate, never level with a face. */
const HOLDER_FLOOR = 0.18;
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
const CHART_POS = [-0.6, 5.7, -3.6];
const CHART_W = 6.6;
const CHART_H = 3.0;

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
    const j = L.spacing * 0.22;
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

/** The lowest point of the heap's bottom layer, jitter and all. */
function slabBottom(n) {
  const L = slabLayout(n);
  return TRACK_Y - ((L.rows - 1) / 2) * L.spacing - L.radius - L.spacing * 0.11;
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

      // The counter's total is the model's, not the drawn sample's: every
      // decay whose radiation gets through the barrier (and is not bent off
      // the window by the field) is one count — the same rule as the
      // counts/s readout, so the total is that rate added up over time.
      for (let k = 0; k < decayed.length; k += 1) {
        for (const em of md.emissions) {
          if (em.kind === "neutrino") continue;
          if (deflection(em.kind, fieldOn).direction !== 0) continue;
          if (rng() < transmission(em.kind, barrier)) m.clicks += 1;
        }
      }
    }

    // Fly the tracers.
    stepTracers(tracers, dt, {
      barrier,
      fieldOn,
      rng,
      // A drawn hit only flashes the LEDs; the count comes from the model above.
      onDetect: () => {},
      onAbsorb: () => (m.absorbed += 1),
      // A stopped positron meets an electron: two 511 keV photons, back to back.
      onAnnihilate: (x, y, z) => launchAnnihilation(tracers, x, y, z, rng),
      gmRef,
    });

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
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.16} roughness={0.35} metalness={0.15} />
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

/** Two gamma photons leaving a positron's end point in opposite directions. */
function launchAnnihilation(pop, x, y, z, rng) {
  const k = PARTICLE_KINDS.gamma;
  const th = rng() * Math.PI * 2;
  const dy = Math.sin(th) * 0.6;
  const dz = Math.cos(th);
  const n = Math.hypot(0.25, dy, dz);
  for (const sgn of [1, -1]) {
    const i = pop.next ?? 0;
    pop.next = (i + 1) % pop.capacity;
    spawnParticle(pop, i, {
      x: x - 0.02,
      y,
      z,
      vx: (-0.25 / n) * k.speed,
      vy: ((sgn * dy) / n) * k.speed,
      vz: ((sgn * dz) / n) * k.speed,
      scale: k.size,
      kind: KIND_INDEX.gamma,
      colour: k.colour,
    });
  }
}

/** Move every live tracer: plates bend the charged ones, the barrier takes its share, the tube counts the rest. */
function stepTracers(pop, dt, { barrier, fieldOn, rng, onDetect, onAbsorb, onAnnihilate, gmRef }) {
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
      if (kind === "beta_plus") onAnnihilate(x, y - Math.sign(y - TRACK_Y) * 0.05, P[o + 2]);
      continue;
    }
    // The barrier.
    if (xBefore < BARRIER_X && x >= BARRIER_X) {
      if (rng() > transmission(kind, barrier)) {
        killParticle(pop, i);
        if (kind !== "neutrino") onAbsorb();
        if (kind === "beta_plus") onAnnihilate(BARRIER_X, y, P[o + 2]);
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
// Everything stands ON the bench: each foot starts a hundredth below the
// bench top and every stacked part overlaps the one under it by a little,
// so no two faces ever share a plane (the lower plate used to lie 5 mm
// above the bench top and flickered against it). Nothing casts a shadow.

const LEAD = { color: "#454c58", roughness: 0.62, metalness: 0.45, emissive: "#454c58", emissiveIntensity: 0.16 };
const PTFE = { color: "#e9ecef", roughness: 0.5, metalness: 0.02, emissive: "#e9ecef", emissiveIntensity: 0.08 };
const CASE = { color: "#2b3340", roughness: 0.55, metalness: 0.3, emissive: "#2b3340", emissiveIntensity: 0.18 };
/** The scaler's light grey instrument case. */
const COUNTER_CASE = { color: "#b9c2cf", roughness: 0.5, metalness: 0.2, emissive: "#b9c2cf", emissiveIntensity: 0.12 };
const BRASS_LIKE = { color: "#c9a24a", roughness: 0.32, metalness: 0.6, emissive: "#c9a24a", emissiveIntensity: 0.3 };

/** The yellow trefoil warning sign: three blades a sixth of a turn wide round a hub. */
function Trefoil({ position, r = 0.2 }) {
  return (
    <group position={position}>
      <mesh>
        <circleGeometry args={[r, 32]} />
        <meshBasicMaterial color="#facc15" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <circleGeometry args={[r * 0.16, 20]} />
        <meshBasicMaterial color="#111318" />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[0, 0, 0.012]}>
          <ringGeometry args={[r * 0.26, r * 0.8, 20, 1, Math.PI / 2 - Math.PI / 6 + (k * 2 * Math.PI) / 3, Math.PI / 3]} />
          <meshBasicMaterial color="#111318" />
        </mesh>
      ))}
    </group>
  );
}

/** The lead castle the sample sits in, open toward the track and the camera. */
function SourceHolder({ Label, parentName, trayTop }) {
  const floor = HOLDER_FLOOR;
  const x0 = HOLDER_BACK_X;
  const x1 = SOURCE_X + 1.95;
  const sideLen = x1 - x0;
  const sideMid = (x0 + x1) / 2;
  return (
    <group>
      {/* Base plate, its underside a hundredth into the bench. */}
      <mesh position={[SOURCE_X - 0.2, (floor + 0.01) / 2 - 0.01, 0]}>
        <boxGeometry args={[4.7, floor + 0.01, HOLDER_HALF_Z * 2 + 0.9]} />
        <meshStandardMaterial {...LEAD} />
      </mesh>
      {/* Back wall — a touch taller and narrower than the side walls, so their faces never meet in one plane. */}
      <mesh position={[x0, floor + HOLDER_H / 2 - 0.01, 0]}>
        <boxGeometry args={[0.5, HOLDER_H + 0.04, HOLDER_HALF_Z * 2 + 0.56]} />
        <meshStandardMaterial {...LEAD} />
      </mesh>
      <mesh position={[sideMid, floor + HOLDER_H / 2 - 0.02, -(HOLDER_HALF_Z + 0.25)]}>
        <boxGeometry args={[sideLen, HOLDER_H, 0.5]} />
        <meshStandardMaterial {...LEAD} />
      </mesh>
      {/* The near wall is a lip, so the sample is in view. */}
      <mesh position={[sideMid, floor + 0.22, HOLDER_HALF_Z + 0.25]}>
        <boxGeometry args={[sideLen, 0.46, 0.5]} />
        <meshStandardMaterial {...LEAD} />
      </mesh>
      <Trefoil position={[SOURCE_X + 1.1, floor + 0.22, HOLDER_HALF_Z + 0.53]} r={0.19} />
      {/* A brass tray on a steel pedestal, raised to just under the heap's bottom layer. */}
      <mesh position={[SOURCE_X, trayTop - 0.03, 0]}>
        <boxGeometry args={[SLAB_W + 0.3, 0.06, 2.3]} />
        <meshStandardMaterial color="#b08d45" roughness={0.35} metalness={0.6} emissive="#b08d45" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[SOURCE_X, (floor - 0.01 + trayTop - 0.05) / 2, 0]}>
        <boxGeometry args={[SLAB_W - 0.6, trayTop - 0.05 - floor + 0.01, 1.6]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <Label position={[x0, floor + HOLDER_H + 0.35, 0]} tone="text-ink-400">{`lead castle · ${parentName}`}</Label>
    </group>
  );
}

/** Two charged plates on PTFE posts, fed by a high-voltage supply at the back. */
function FieldPlates({ on, Label }) {
  const mid = (PLATE_X0 + PLATE_X1) / 2;
  const len = PLATE_X1 - PLATE_X0;
  const topY = TRACK_Y + PLATE_GAP;
  const lowY = TRACK_Y - PLATE_GAP;
  const postZ = -1.15;
  const arrows = useMemo(() => [-0.9, 0, 0.9].map((dx) => ({ from: [mid + dx, topY - 0.25, 0], to: [mid + dx, lowY + 0.25, 0] })), [mid, topY, lowY]);
  const leads = useMemo(() => {
    const curve = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))).getPoints(24);
    return {
      red: curve([[mid - 0.3, 0.86, -2.6], [mid - 0.5, 1.9, -2.2], [mid - 0.9, topY + 0.3, -1.6], [mid - 1.0, topY + 0.04, -1.25]]),
      black: curve([[mid + 0.3, 0.86, -2.6], [mid + 0.5, 1.0, -2.2], [mid + 0.9, lowY - 0.25, -1.6], [mid + 1.0, lowY - 0.04, -1.25]]),
    };
  }, [mid, topY, lowY]);
  const plate = (y, colour) => (
    <mesh position={[mid, y, 0]}>
      <boxGeometry args={[len, 0.08, 2.6]} />
      <meshStandardMaterial color={on ? colour : "#747c89"} emissive={on ? colour : "#747c89"} emissiveIntensity={on ? 0.75 : 0.18} metalness={0.55} roughness={0.32} />
    </mesh>
  );
  return (
    <group>
      {plate(topY, "#fb7185")}
      {plate(lowY, "#38bdf8")}
      {/* A rail and two PTFE posts at the back edge: the posts run up to the top plate, through the lower one. */}
      <mesh position={[mid, 0.05, postZ]}>
        <boxGeometry args={[len + 0.3, 0.12, 0.46]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      {[PLATE_X0 + 0.3, PLATE_X1 - 0.3].map((x) => (
        <mesh key={x} position={[x, (0.1 + topY - 0.03) / 2, postZ]}>
          <cylinderGeometry args={[0.07, 0.07, topY - 0.13, 12]} />
          <meshStandardMaterial {...PTFE} />
        </mesh>
      ))}
      {/* The supply: case, meter window, knob, two terminals. */}
      <group position={[mid, 0, -3.05]}>
        <mesh position={[0, 0.39, 0]}>
          <boxGeometry args={[1.5, 0.8, 0.9]} />
          <meshStandardMaterial {...CASE} />
        </mesh>
        <mesh position={[-0.2, 0.44, 0.47]}>
          <planeGeometry args={[0.7, 0.3]} />
          <meshBasicMaterial color={on ? "#7f1d1d" : "#1f2530"} toneMapped={false} />
        </mesh>
        <mesh position={[0.45, 0.44, 0.49]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.08, 18]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        {[[-0.3, "#ef4444"], [0.3, "#111827"]].map(([x, c]) => (
          <mesh key={x} position={[x, 0.82, 0.45]}>
            <cylinderGeometry args={[0.06, 0.06, 0.08, 12]} />
            <meshStandardMaterial color={c} roughness={0.4} />
          </mesh>
        ))}
        <Label position={[-0.2, 0.44, 0.5]} tone={on ? "text-rose-300" : "text-ink-500"}>{on ? "2.0 kV" : "0 kV"}</Label>
      </group>
      <Line points={leads.red} color="#ef4444" lineWidth={2} />
      <Line points={leads.black} color="#1f2937" lineWidth={2} />
      {on && arrows.map((a, i) => <VectorArrow key={i} from={a.from} to={a.to} color="#94a3b8" radius={0.02} headLength={0.2} headRadius={0.07} opacity={0.5} />)}
      <Label position={[mid, topY + 0.38, 0]} tone={on ? "text-rose-300" : "text-ink-500"}>{on ? "+ plate · field ON" : "+ plate · field off"}</Label>
      <Label position={[mid + 1.3, lowY - 0.3, 1.4]} tone={on ? "text-sky-300" : "text-ink-500"}>− plate</Label>
    </group>
  );
}

const BARRIER_THICKNESS = { paper: 0.03, aluminium: 0.2, lead: 0.13 };
const BARRIER_H = 3.2;

/** The barrier across the track — a sheet or a plate — gripped in a clamp on a stand. */
function Barrier({ barrier, Label }) {
  const b = barrierFor(barrier);
  const t = BARRIER_THICKNESS[barrier] ?? 0.2;
  const mat = barrier === "paper" ? PAPER : barrier === "aluminium" ? { color: "#c7cfd9", roughness: 0.3, metalness: 0.65, emissive: "#c7cfd9", emissiveIntensity: 0.3 } : { ...LEAD, color: "#59616e", emissive: "#59616e" };
  const cy = TRACK_Y + 0.15;
  const bottom = cy - BARRIER_H / 2;
  const rodTop = bottom - 0.05;
  return (
    <group position={[BARRIER_X + t / 2, 0, 0]}>
      <mesh position={[0, cy, 0]}>
        <boxGeometry args={[t, BARRIER_H, 3.0]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Clamp jaws grip the bottom edge; a rod takes them down to a foot. */}
      <mesh position={[0, bottom + 0.06, 0]}>
        <boxGeometry args={[t + 0.18, 0.26, 0.9]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh position={[0, (rodTop + 0.1) / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, rodTop - 0.1, 10]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.9, 0.12, 1.3]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <Label position={[0, cy + BARRIER_H / 2 + 0.3, 1.2]} tone="text-ink-200">{`${b.label} · ${b.thickness}`}</Label>
    </group>
  );
}

/**
 * The counter's LCD: the count is painted onto a canvas texture on the
 * display face, so it is part of the box, not a label, and it stays when
 * labels are off. Repainted only when the count changes.
 */
function CounterDisplay({ position, clicks }) {
  const { canvas, texture } = useMemo(() => {
    if (typeof document === "undefined") return {};
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 92;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas: c, texture: t };
  }, []);
  useEffect(() => {
    if (!canvas) return;
    const g = canvas.getContext("2d");
    g.fillStyle = "#0f2a1e";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.font = "bold 64px ui-monospace, Consolas, monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    // Unlit segments behind the digits, as on a real LCD.
    g.fillStyle = "rgba(110, 231, 183, 0.12)";
    g.fillText("88888", canvas.width / 2, canvas.height / 2 + 3);
    g.fillStyle = "#6ee7b7";
    g.fillText(String(Math.min(clicks, 99999)).padStart(5, "0"), canvas.width / 2, canvas.height / 2 + 3);
    texture.needsUpdate = true;
  }, [canvas, texture, clicks]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <mesh position={position}>
      <planeGeometry args={[0.95, 0.34]} />
      <meshBasicMaterial map={texture ?? null} color={texture ? "#ffffff" : "#0f2a1e"} toneMapped={false} />
    </mesh>
  );
}

/** The Geiger–Müller tube on its stand, cabled to a counter whose LED flashes per count. */
function GeigerTube({ gmRef, Label, clicks }) {
  const led = useRef(null);
  const counterLed = useRef(null);
  useFrame((_, delta) => {
    const g = gmRef.current;
    g.flash = Math.max(0, g.flash - delta * 6);
    const k = 0.2 + g.flash * 3;
    if (led.current) led.current.material.emissiveIntensity = k;
    if (counterLed.current) counterLed.current.material.emissiveIntensity = k;
  });
  const counter = [GM_X + 0.3, 0, 2.1];
  const cable = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          [GM_X + 1.04, TRACK_Y, 0],
          [GM_X + 1.45, TRACK_Y - 0.4, 0.3],
          [GM_X + 1.35, 0.6, 1.2],
          [GM_X + 0.9, 0.55, 1.64],
        ].map((p) => new THREE.Vector3(...p)),
      ).getPoints(28),
    [],
  );
  return (
    <group>
      <group position={[GM_X, TRACK_Y, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.42, 0.42, 1.7, 28]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        {/* The thin mica window, set back inside an open collar. */}
        <mesh position={[-0.88, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.46, 0.46, 0.08, 28, 1, true]} />
          <meshStandardMaterial {...DARK_STEEL} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.89, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.36, 28]} />
          <meshStandardMaterial color="#e2e8f0" emissive="#e2e8f0" emissiveIntensity={0.3} roughness={0.25} />
        </mesh>
        {/* Clamp ring and the connector at the back. */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.44, 0.04, 8, 28]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
        <mesh position={[0.94, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.2, 14]} />
          <meshStandardMaterial {...BRASS_LIKE} />
        </mesh>
        <mesh ref={led} position={[0.3, 0.46, 0]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.2} toneMapped={false} />
        </mesh>
      </group>
      {/* Stand: rod from the foot up to the clamp ring. */}
      <mesh position={[GM_X, (0.1 + TRACK_Y - 0.4) / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, TRACK_Y - 0.5, 10]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh position={[GM_X, 0.05, 0]}>
        <cylinderGeometry args={[0.45, 0.5, 0.12, 24]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      {/* The counter. */}
      <group position={counter}>
        <mesh position={[0, 0.39, 0]}>
          <boxGeometry args={[1.6, 0.8, 0.9]} />
          <meshStandardMaterial {...COUNTER_CASE} />
        </mesh>
        <CounterDisplay position={[-0.15, 0.44, 0.47]} clicks={clicks} />
        <mesh ref={counterLed} position={[0.6, 0.44, 0.47]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.2} toneMapped={false} />
        </mesh>
              </group>
      <Line points={cable} color="#1f2937" lineWidth={2.2} />
    </group>
  );
}

// ─── The decay curve ────────────────────────────────────────────────

/** N/N₀ against time in half-lives — the dashed prediction and the live measured trace. */
function DecayCurvePanel({ modelRef, traceRef, marks, Label }) {
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
        points: [[0, Math.pow(0.5, k) * CHART_H, 0], [(k / CURVE_HALF_LIVES) * CHART_W, Math.pow(0.5, k) * CHART_H, 0], [(k / CURVE_HALF_LIVES) * CHART_W, 0, 0]],
      })),
    [],
  );
  const axes = useMemo(() => [[0, CHART_H, 0], [0, 0, 0], [CHART_W, 0, 0]], []);
  // Only the stamps that land on the chart: later ones used to pile up at its right edge.
  const markLines = useMemo(
    () =>
      marks
        .map((t, i) => ({ t, i, x: (t / SIM_HALF_LIFE_S / CURVE_HALF_LIVES) * CHART_W }))
        .filter((m) => m.x <= CHART_W)
        .map((m) => ({ ...m, points: [[m.x, 0, 0.01], [m.x, CHART_H, 0.01]] })),
    [marks],
  );

  useFrame(() => {
    const s = modelRef.current.state;
    if (!s || !marker.current) return;
    marker.current.position.set(clamp(s.t / SIM_HALF_LIFE_S / CURVE_HALF_LIVES, 0, 1) * CHART_W, (s.alive / s.n0) * CHART_H, 0.05);
  });

  return (
    <group position={CHART_POS}>
      {/* A framed board: the frame stands behind the face, the face behind the lines. */}
      <mesh position={[CHART_W / 2, CHART_H / 2 + 0.05, -0.14]}>
        <boxGeometry args={[CHART_W + 1.5, CHART_H + 2.1, 0.08]} />
        <meshStandardMaterial {...CASE} />
      </mesh>
      <mesh position={[CHART_W / 2, CHART_H / 2 + 0.05, -0.08]}>
        <planeGeometry args={[CHART_W + 1.3, CHART_H + 1.9]} />
        <meshBasicMaterial color="#0d121c" />
      </mesh>
      <Line points={axes} color={PALETTE.slate} lineWidth={1.8} />
      {guides.map((g) => (
        <group key={g.k}>
          <Line points={g.points} color={PALETTE.line} lineWidth={0.8} transparent opacity={0.5} dashed dashSize={0.1} gapSize={0.08} />
          {/* N₀/8 sits only CHART_H/8 under N₀/4 — too close for two tags; its dashed line speaks for itself. */}
          {g.k < 3 && <Label position={[-0.5, g.y, 0]} tone="text-ink-500">{`N₀/${Math.pow(2, g.k)}`}</Label>}
        </group>
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((k) => (
        <Label key={k} position={[(k / CURVE_HALF_LIVES) * CHART_W, -0.3, 0]} tone="text-ink-500">{k === 0 ? "0" : `${k} t½`}</Label>
      ))}
      <Line points={theory} color={PALETTE.violet} lineWidth={1.6} dashed dashSize={0.14} gapSize={0.1} transparent opacity={0.85} />
      {/* The measured curve: grows in place, never rebuilt. */}
      <LiveTrace traceRef={traceRef} capacity={CURVE_HALF_LIVES * SIM_HALF_LIFE_S * 12} colour={PALETTE.gold} />
      {markLines.map((ml) => (
        <group key={ml.i}>
          <Line points={ml.points} color={PALETTE.emerald} lineWidth={1.2} transparent opacity={0.8} dashed dashSize={0.08} gapSize={0.06} />
          <Label position={[ml.x, CHART_H + 0.2 + (ml.i % 2) * 0.3, 0]} tone="text-emerald-300">{`${ml.t.toFixed(1)} s`}</Label>
        </group>
      ))}
      <mesh ref={marker} position={[0, CHART_H, 0.05]}>
        <sphereGeometry args={[0.1, 14, 14]} />
        <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      <Label position={[CHART_W / 2, CHART_H + 1.0, 0]} accent>
        {`N(t) = N₀ e^(−λt) · dashed = prediction · gold = this sample`}
      </Label>
      <Label position={[CHART_W / 2, -0.75, 0]} tone="text-ink-400">{`time · one half-life = ${SIM_HALF_LIFE_S} s on screen`}</Label>
      <Label position={[-0.55, CHART_H + 0.25, 0]} tone="text-ink-400">N/N₀</Label>
    </group>
  );
}

// ─── Framing ────────────────────────────────────────────────────────

const FOV = 44;
const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
/** The box the camera keeps in view at any aspect, in world units. */
const VIEW = { cx: 1.7, width: 20.5, top: BENCH_Y + CHART_POS[1] + CHART_H + 0.9, bottom: BENCH_Y - 2.2 };
const VIEW_DIRECTION = new THREE.Vector3(0, 0.3, 1).normalize();

/** Frames VIEW whenever the canvas changes shape. */
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

// ─── The scene ──────────────────────────────────────────────────────

export default function RadioactiveDecayCanvas({ params = {}, setParam }) {
  const {
    mode = "alpha",
    atoms = 2000,
    barrier = "paper",
    fieldOn = false,
    restart = 0,
    speed = 1,
    showLabels = true,
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
  const Label = showLabels ? SceneLabel : NoLabel;

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
    <SceneCanvas camera={{ position: [1.9, 6, 20], fov: FOV }} controls={{ minDistance: 5, maxDistance: 36, target: [VIEW.cx, (VIEW.top + VIEW.bottom) / 2, 0] }}>
      <FitCamera />
      <LabBench y={BENCH_Y} width={21} depth={9} />
      <group position={[0, BENCH_Y, 0]}>
        <SourceHolder Label={Label} parentName={md.parent.name} trayTop={slabBottom(n0) - 0.02} />
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
        <FieldPlates on={Boolean(fieldOn)} Label={Label} />
        <Barrier barrier={barrier} Label={Label} />
        <GeigerTube gmRef={gmRef} Label={Label} clicks={liveClicks} />
        <DecayCurvePanel modelRef={modelRef} traceRef={traceRef} marks={marks} Label={Label} />

        {/* The equation, hung over the source. */}
        <Label position={[SOURCE_X, HOLDER_FLOOR + HOLDER_H + 1.5, 0.4]} accent>
          {eq.text}
        </Label>
        <Label position={[SOURCE_X, HOLDER_FLOOR + HOLDER_H + 0.9, 0.4]} tone={eq.conservedA && eq.conservedZ ? "text-emerald-300" : "text-rose-300"}>
          {`A: ${eq.left.A} = ${eq.right.A} ${eq.conservedA ? "✓" : "✗"} · Z: ${eq.left.Z} = ${eq.right.Z} ${eq.conservedZ ? "✓" : "✗"}`}
        </Label>
        {/* The readouts sit along the bench's front edge, clear of the apparatus. */}
        <Label position={[SOURCE_X + 0.6, -0.3, 4.6]} tone={liveFinished ? "text-ink-500" : "text-amber-300"}>
          {liveFinished
            ? `all ${n0.toLocaleString("en-GB")} decayed · ${halves.toFixed(1)} half-lives`
            : `${alive.toLocaleString("en-GB")} of ${n0.toLocaleString("en-GB")} ${md.parent.name} left · ${halves.toFixed(2)} t½ · predicted ${Math.round(expected).toLocaleString("en-GB")}`}
        </Label>
        <Label position={[SOURCE_X + 0.6, -0.8, 4.6]} tone="text-ink-400">
          {`activity λN = ${activity.toFixed(1)} Bq · counted ${liveRate.toFixed(1)} /s`}
        </Label>
        <Label position={[GM_X, TRACK_Y + 0.95, 0]} tone={detectorRate > 0.05 ? "text-emerald-300" : "text-ink-500"}>
          {`GM tube · ${detectorRate.toFixed(1)} counts/s`}
        </Label>
        <Label position={[GM_X - 0.2, -0.3, 4.6]} tone="text-ink-400">
          {defl.direction !== 0
            ? `${primary.display} bent off the window by the field`
            : throughFraction >= 0.5
              ? `${primary.display} gets through ${b.label.toLowerCase()}`
              : throughFraction > 0.005
                ? `${primary.display} mostly stopped by ${b.label.toLowerCase()}`
                : `${primary.display} stopped by ${b.label.toLowerCase()}`}
        </Label>
        <Label position={[(PLATE_X0 + PLATE_X1) / 2 + 0.8, -0.8, 4.6]} tone={fieldOn ? (defl.direction === 0 ? "text-violet-300" : "text-ink-200") : "text-ink-500"}>
          {fieldOn ? `${primary.display}: ${defl.reason}` : "plates off — every path is straight"}
        </Label>
      </group>
    </SceneCanvas>
  );
}
