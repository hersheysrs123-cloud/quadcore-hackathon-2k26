"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE, SceneCanvas, SceneLabel } from "@/components/visualizations/scene-kit";
import { DARK_STEEL, GLASS, LabBench, PORCELAIN, RUBBER, STEEL } from "@/components/visualizations/lab-bench";
import { InstancedPopulation, createPopulation, setParticleColour } from "@/components/visualizations/particle-population";
import {
  AMMONIUM_CHLORIDE,
  BOX,
  GASES,
  PARTICLE_R,
  SPECIES,
  TUBE,
  concentrationProfile,
  createDiffusion,
  experimentFor,
  mixingPercent,
  releaseDiffusion,
  ringFraction,
  stepDiffusion,
} from "@/lib/diffusion";

// ─── Diffusion lab ──────────────────────────────────────────────────
// The particle-model topic's diffusion mode. `lib/diffusion.js` owns the
// random walk; this file draws it:
//
//   mixing  a glass box on the bench, bromine vapour in the left half and
//           air in the right, a glass partition between them that lifts on
//           Release. A concentration profile stands over the box, one bar
//           pair per slice, directly above the slice it counts — so "from
//           high concentration to low" is the bars levelling out. The
//           optional smoke particle draws the trail of its random walk.
//   tube    a long glass tube held in two clamps. Release pushes the soaked
//           cotton wool into each end; NH₃ and HCl creep along it and a
//           white ring of NH₄Cl grows on the glass where they meet.
//
// The gases are one instanced mesh, as in the phase scene.
// ─────────────────────────────────────────────────────────────────────

const BENCH_Y = -2.6;
const BOX_Y = BOX.halfH + 0.16;
const TUBE_Y = 1.5;
const PROFILE_BINS = 24;
const PROFILE_H = 1.5;
const PUSH_EVERY_S = 0.2;
const CAPACITY = 560;
const TRAIL_MAX = 240;

const FOV = 40;
const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180));
const VIEW_DIRECTION = new THREE.Vector3(0, 0.3, 1).normalize();

/** What the camera keeps in view, per experiment, in bench-local units. */
const VIEW = {
  mixing: { width: 10.8, top: BOX_Y + BOX.halfH + 0.5 + PROFILE_H + 1.0, bottom: -0.9 },
  tube: { width: 12.6, top: TUBE_Y + TUBE.r + 0.5 + PROFILE_H + 1.0, bottom: -0.9 },
};

function FitCamera({ experiment }) {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls);
  const aspect = useThree((st) => st.size.width / Math.max(st.size.height, 1));
  useEffect(() => {
    if (!(aspect > 0.05)) return;
    const v = VIEW[experiment];
    const target = new THREE.Vector3(0, BENCH_Y + (v.top + v.bottom) / 2, 0);
    const fit = Math.max((v.top - v.bottom) / 2 / TAN_HALF_FOV, v.width / 2 / (TAN_HALF_FOV * aspect)) * 1.06;
    camera.position.copy(target).addScaledVector(VIEW_DIRECTION, fit);
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [camera, controls, aspect, experiment]);
  return null;
}

// ─── Apparatus ──────────────────────────────────────────────────────

/** The mixing box, its feet, and the partition that lifts out on release. */
function MixingBox({ runRef }) {
  const partition = useRef(null);
  useFrame((_, delta) => {
    if (!partition.current) return;
    // Lifted straight out through the top, then gone — left standing above
    // the box it sat in front of the concentration profile.
    const released = runRef.current?.released;
    const goal = released ? BOX.halfH * 2 + 0.4 : 0;
    const y = partition.current.position.y;
    partition.current.position.y = released ? y + (goal - y) * Math.min(1, delta * 2.5) : 0;
    partition.current.visible = partition.current.position.y < BOX.halfH * 2;
  });
  return (
    <group position={[0, BOX_Y, 0]}>
      <mesh>
        <boxGeometry args={[BOX.halfL * 2 + 0.04, BOX.halfH * 2 + 0.04, BOX.halfD * 2 + 0.04]} />
        <meshPhysicalMaterial {...GLASS} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (BOX.halfL - 0.3), -BOX.halfH - 0.09, sz * (BOX.halfD - 0.3)]}>
            <boxGeometry args={[0.3, 0.14, 0.3]} />
            <meshStandardMaterial {...RUBBER} />
          </mesh>
        )),
      )}
      {/* The partition: a glass slide in a slot, with a handle to lift it by. */}
      <group ref={partition}>
        <mesh>
          <boxGeometry args={[0.05, BOX.halfH * 2 - 0.02, BOX.halfD * 2 - 0.02]} />
          <meshPhysicalMaterial {...GLASS} color="#9fd8ea" opacity={0.55} />
        </mesh>
        <mesh position={[0, BOX.halfH + 0.12, 0]}>
          <boxGeometry args={[0.12, 0.22, 0.5]} />
          <meshStandardMaterial {...DARK_STEEL} />
        </mesh>
      </group>
    </group>
  );
}

/** A retort-stand clamp holding the tube at height. */
function Clamp({ x }) {
  return (
    <group position={[x, 0, -0.9]}>
      <mesh position={[0, 0.04, 0.2]}>
        <boxGeometry args={[0.9, 0.08, 1.3]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh position={[0, TUBE_Y / 2 + 0.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, TUBE_Y + 0.8, 12]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, TUBE_Y, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 10]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, TUBE_Y, 0.9]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[TUBE.r + 0.06, 0.05, 10, 28]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
    </group>
  );
}

/** Cotton wool soaked in each solution: a puff of white spheres at the end of the tube. */
function CottonPlug({ side, runRef }) {
  const group = useRef(null);
  const puffs = useMemo(
    () =>
      Array.from({ length: 9 }, (_, k) => {
        const a = (k / 9) * Math.PI * 2;
        return [Math.cos(k * 2.3) * 0.12, Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.13 + (k % 3) * 0.02];
      }),
    [],
  );
  const inX = side * (TUBE.halfL - 0.18);
  const outX = side * (TUBE.halfL + 0.9);
  useFrame((_, delta) => {
    if (!group.current) return;
    const goal = runRef.current?.released ? inX : outX;
    group.current.position.x += (goal - group.current.position.x) * Math.min(1, delta * 3);
  });
  return (
    <group ref={group} position={[outX, 0, 0]}>
      {puffs.map(([x, y, z, r], k) => (
        <mesh key={k} position={[x, y, z]}>
          <sphereGeometry args={[r, 12, 10]} />
          <meshStandardMaterial {...PORCELAIN} color="#f1f5f9" roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[side * 0.28, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[TUBE.r + 0.02, TUBE.r - 0.02, 0.22, 20]} />
        <meshStandardMaterial {...RUBBER} />
      </mesh>
    </group>
  );
}

function Tube({ runRef }) {
  return (
    <group>
      <Clamp x={-TUBE.halfL + 1.2} />
      <Clamp x={TUBE.halfL - 1.2} />
      <group position={[0, TUBE_Y, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[TUBE.r + 0.03, TUBE.r + 0.03, TUBE.halfL * 2, 32, 1, true]} />
          <meshPhysicalMaterial {...GLASS} side={THREE.DoubleSide} />
        </mesh>
        <CottonPlug side={-1} runRef={runRef} />
        <CottonPlug side={1} runRef={runRef} />
      </group>
    </group>
  );
}

/**
 * The concentration profile: a bar pair per slice of the vessel, drawn
 * straight above the slice it counts. Heights are counts scaled to the
 * fullest a slice starts (or, in the tube, to a fixed share of each gas).
 */
function Profile({ runRef, experiment, baseY, halfL }) {
  const bars = useRef([]);
  const exp = experimentFor(experiment);
  const colours = [GASES[exp.left].colour, GASES[exp.right].colour];
  const slice = (halfL * 2) / PROFILE_BINS;
  const full = experiment === "tube" ? exp.perGas / 8 : exp.perGas / (PROFILE_BINS / 2);
  useFrame(() => {
    const s = runRef.current;
    if (!s) return;
    const prof = concentrationProfile(s, PROFILE_BINS);
    [prof.left, prof.right].forEach((counts, g) => {
      counts.forEach((c, b) => {
        const mesh = bars.current[g * PROFILE_BINS + b];
        if (!mesh) return;
        const h = Math.max(0.001, Math.min(1.25, c / full) * PROFILE_H);
        mesh.scale.y = h;
        mesh.position.y = h / 2;
      });
    });
  });
  return (
    <group position={[0, baseY, 0]}>
      <mesh position={[0, PROFILE_H / 2, -0.06]}>
        <planeGeometry args={[halfL * 2 + 0.3, PROFILE_H * 1.3]} />
        <meshBasicMaterial color="#0d121c" transparent opacity={0.82} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[halfL * 2 + 0.3, 0.015, 0.01]} />
        <meshBasicMaterial color={PALETTE.slate} />
      </mesh>
      {[0, 1].map((g) =>
        Array.from({ length: PROFILE_BINS }, (_, b) => (
          <mesh
            key={`${g}-${b}`}
            position={[-halfL + (b + 0.5) * slice + (g === 0 ? -1 : 1) * slice * 0.2, 0, 0]}
            ref={(el) => {
              bars.current[g * PROFILE_BINS + b] = el;
            }}
          >
            <boxGeometry args={[slice * 0.38, 1, 0.04]} />
            <meshBasicMaterial color={colours[g]} toneMapped={false} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** The smoke particle and the path it has wandered. */
function Tracer({ runRef }) {
  const ball = useRef(null);
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.85 });
    return new THREE.Line(geometry, material);
  }, []);
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );
  useFrame(() => {
    const t = runRef.current?.tracer;
    if (ball.current) ball.current.visible = Boolean(t);
    line.visible = Boolean(t);
    if (!t) return;
    ball.current?.position.set(t.pos[0], t.pos[1], t.pos[2]);
    const arr = line.geometry.attributes.position.array;
    t.trail.forEach((p, k) => {
      arr[k * 3] = p[0];
      arr[k * 3 + 1] = p[1];
      arr[k * 3 + 2] = p[2];
    });
    line.geometry.setDrawRange(0, t.trail.length);
    line.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <group position={[0, BOX_Y, 0]}>
      <mesh ref={ball}>
        <sphereGeometry args={[0.16, 20, 16]} />
        <meshStandardMaterial color="#57534e" emissive="#a8a29e" emissiveIntensity={0.35} roughness={0.85} />
      </mesh>
      <primitive object={line} />
    </group>
  );
}

// ─── The driver ─────────────────────────────────────────────────────

/** Steps the random walk, writes the particles, and pushes the readout five times a second. */
function DiffusionDriver({ runRef, experiment, tempC, animSpeed, setParam }) {
  const population = useMemo(() => createPopulation(CAPACITY), []);
  const pushed = useRef({ sinceLast: 0, values: {} });
  const exp = experimentFor(experiment);
  const colours = [GASES[exp.left].colour, GASES[exp.right].colour, AMMONIUM_CHLORIDE.colour];
  const tube = experiment === "tube";
  const offsetY = tube ? TUBE_Y : BOX_Y;

  const onFrame = (pop, dt) => {
    const s = runRef.current;
    if (!s) return;
    stepDiffusion(s, dt, tempC);
    for (let i = 0; i < s.n; i += 1) {
      const sp = s.species[i];
      const o = i * 3;
      pop.position[o] = s.pos[o];
      pop.position[o + 1] = s.pos[o + 1] + offsetY;
      pop.position[o + 2] = s.pos[o + 2];
      if (sp === SPECIES.unborn) {
        pop.scale[i] = 0;
      } else {
        pop.scale[i] = sp === SPECIES.product ? PARTICLE_R * 1.35 : PARTICLE_R;
        if (pop.kind[i] !== sp + 1) {
          pop.kind[i] = sp + 1;
          setParticleColour(pop, i, colours[sp]);
        }
      }
    }
    pop.count = s.n;
    pop.dirtyMatrix = true;

    if (typeof setParam !== "function") return;
    pushed.current.sinceLast += dt / Math.max(animSpeed, 1e-6);
    if (pushed.current.sinceLast < PUSH_EVERY_S) return;
    pushed.current.sinceLast = 0;
    const ring = tube ? ringFraction(s) : null;
    const next = {
      liveDiffTime: Math.round(s.time * 10) / 10,
      liveMixPct: tube ? 0 : Math.round(mixingPercent(s)),
      liveRingFrac: ring === null ? -1 : Math.round(ring * 1000) / 1000,
      liveDeposits: s.reacted,
      liveReleased: s.released,
    };
    for (const [key, value] of Object.entries(next)) {
      if (pushed.current.values[key] !== value) {
        pushed.current.values[key] = value;
        setParam(key, value);
      }
    }
  };

  // A different experiment is a different population; recolour from scratch.
  useEffect(() => {
    population.kind.fill(0);
    population.dirtyColour = true;
  }, [experiment, population]);

  return (
    <InstancedPopulation population={population} onFrame={onFrame} animSpeed={animSpeed}>
      <sphereGeometry args={[1, 14, 10]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.08} roughness={0.45} metalness={0.05} />
    </InstancedPopulation>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

const NoLabel = () => null;

export default function DiffusionLab({ params = {}, setParam }) {
  const { experiment = "mixing", gasTemp = 20, release = 0, tracer = false, speed = 1, showLabels = true, liveRingFrac = -1, liveMixPct = 0, liveReleased = false } = params || {};
  const exp = experimentFor(experiment);
  const tempC = Number(gasTemp) || 0;
  const Label = showLabels ? SceneLabel : NoLabel;

  // The run. A new experiment starts fresh, unreleased; each press of
  // Release starts a fresh run already released; the smoke particle is
  // added or removed in place.
  const runRef = useRef(null);
  const seenRelease = useRef(release);
  const seed = useRef(1);
  if (runRef.current === null || runRef.current.experiment !== exp.key) {
    runRef.current = createDiffusion(exp.key, { tempC, seed: seed.current, tracer });
  }
  useEffect(() => {
    if (release === seenRelease.current) return;
    seenRelease.current = release;
    seed.current += 1;
    runRef.current = releaseDiffusion(createDiffusion(exp.key, { tempC, seed: seed.current, tracer }));
    // Only a press restarts; the temperature and smoke toggle change a run in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release, exp.key]);
  useEffect(() => {
    const s = runRef.current;
    if (!s || exp.key !== "mixing") return;
    if (tracer && !s.tracer) s.tracer = { pos: [0.6, 0, 0], vel: [0, 0, 0], trail: [], sinceTrail: 0, radius: 0.16 };
    if (!tracer) s.tracer = null;
  }, [tracer, exp.key]);

  const tube = exp.key === "tube";
  const A = GASES[exp.left];
  const B = GASES[exp.right];
  const vesselTop = tube ? TUBE_Y + TUBE.r : BOX_Y + BOX.halfH;
  const halfL = tube ? TUBE.halfL : BOX.halfL;
  const ringX = liveRingFrac >= 0 ? -TUBE.halfL + liveRingFrac * TUBE.halfL * 2 : null;

  return (
    <SceneCanvas environment camera={{ position: [0, 4, 16], fov: FOV }} controls={{ minDistance: 4, maxDistance: 30 }}>
      <FitCamera experiment={exp.key} />
      <LabBench y={BENCH_Y} width={16} depth={7} />
      <group position={[0, BENCH_Y, 0]}>
        {tube ? <Tube runRef={runRef} /> : <MixingBox runRef={runRef} />}
        <DiffusionDriver runRef={runRef} experiment={exp.key} tempC={tempC} animSpeed={speed} setParam={setParam} />
        {!tube && <Tracer runRef={runRef} />}
        <Profile runRef={runRef} experiment={exp.key} baseY={vesselTop + 0.5} halfL={halfL} />

        <Label position={[0, vesselTop + 0.5 + PROFILE_H * 1.3 + 0.25, 0]} accent>
          {tube ? `${A.formula}(g) + ${B.formula}(g) → NH₄Cl(s) · ${tempC.toFixed(0)} °C` : `${A.label} vapour diffusing into air · ${tempC.toFixed(0)} °C`}
        </Label>
        <Label position={[-halfL + 1.4, vesselTop + 0.5 + PROFILE_H * 1.3 - 0.05, 0]} tone="text-ink-300">
          concentration along the vessel
        </Label>
        <Label position={[-halfL + 0.8, -0.45, 1.6]} tone="text-ink-200">
          {`${A.formula} · M = ${A.M.toFixed(A.M < 100 ? 1 : 0)}`}
        </Label>
        <Label position={[halfL - 0.8, -0.45, 1.6]} tone="text-ink-200">
          {`${B.formula} · M = ${B.M.toFixed(B.M < 100 ? 1 : 0)}`}
        </Label>
        {tube && ringX !== null && (
          <Label position={[ringX, TUBE_Y - TUBE.r - 0.45, 0.6]} tone="text-emerald-300">
            {`white NH₄Cl ring · ${Math.round(liveRingFrac * 100)}% along from the NH₃ end`}
          </Label>
        )}
        {!tube && (
          <Label position={[0, -0.45, 1.6]} tone={liveMixPct > 60 ? "text-emerald-300" : "text-ink-400"}>
            {liveReleased ? `${liveMixPct}% mixed` : "partition in — press Release"}
          </Label>
        )}
      </group>
    </SceneCanvas>
  );
}
