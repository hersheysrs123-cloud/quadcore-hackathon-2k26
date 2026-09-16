"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";
import { Beaker, relaxTo } from "@/components/visualizations/vessel-rack";
import {
  BASIN,
  BunsenBurner,
  ConicalFlask,
  EvaporatingBasin,
  FLASK,
  FUNNEL,
  Funnel,
  GlassJar,
  HeatMat,
  LabBench,
  PAPER,
  RetortStand,
  STEEL,
  Tripod,
  basinRimRadius,
  cm,
} from "@/components/visualizations/lab-bench";
import {
  BASELINE_MM,
  COMPONENTS,
  FRONT_MAX_MM,
  MIXTURES,
  PAPER_LENGTH_MM,
  SAMPLE_VOLUME_ML,
  SOLVENTS,
  SOLVENT_DEPTH_MM,
  STATIONS,
  STATION_ORDER,
  formatSeconds,
  liquidAppearance,
  rfText,
  solveChromatography,
  solveCrystallization,
  solveFiltration,
} from "@/lib/separation";
import { flameProfile } from "@/lib/combustion";

// ─── Separation techniques studio ───────────────────────────────────
// Three stations on one bench — a funnel over a flask, a basin over a
// burner, a paper strip in a tank — and one sample that goes to whichever
// station is selected. The bench is built from `lab-bench.jsx` and the
// chemistry from `lib/separation.js`; this file owns the clock, the
// pouring, the dripping, the steam, the crystals and the chromatogram.
//
// One station runs at a time. Selecting a station (or a new sample or
// solvent, or pressing restart) puts its clock back to zero and the other
// two stand idle at their starting state, so the eye is always on the one
// thing that is happening. The clock runs at each station's own time-lapse
// and is pushed to the HUD as `liveSeconds`, from which the Details panel
// re-solves the same closed-form model the scene is drawing.
// ─────────────────────────────────────────────────────────────────────

const BENCH_Y = -2.4;
const FILTER_X = -6.2;
const CRYST_X = 0;
const CHROM_X = 5.6;
const STATION_X = { filtration: FILTER_X, crystallization: CRYST_X, chromatography: CHROM_X };
const PUSH_EVERY_S = 0.2;

const SCRATCH_OBJECT = new THREE.Object3D();
const UP = new THREE.Vector3(0, 1, 0);

// ─── The clock ──────────────────────────────────────────────────────

/**
 * Runs the active station's clock. Renders nothing. Any change of station,
 * sample or solvent — or a press of restart — starts that station over.
 */
function StationClock({ modelRef, station, mixture, solvent, restartToken, animSpeed, setParam }) {
  const pushed = useRef({ seconds: -1, sinceLast: 0 });

  useEffect(() => {
    modelRef.current.seconds = 0;
    modelRef.current.station = station;
    modelRef.current.mixture = mixture;
    modelRef.current.solvent = solvent;
    if (typeof setParam === "function") setParam("liveSeconds", 0);
    pushed.current.seconds = 0;
  }, [modelRef, station, mixture, solvent, restartToken, setParam]);

  useFrame((_, delta) => {
    const m = modelRef.current;
    const dt = Math.min(delta, 0.05) * animSpeed;
    m.seconds += dt * (STATIONS[m.station]?.timeLapse ?? 10);

    if (typeof setParam !== "function") return;
    pushed.current.sinceLast += delta;
    if (pushed.current.sinceLast < PUSH_EVERY_S) return;
    pushed.current.sinceLast = 0;
    const seconds = Math.round(m.seconds * 10) / 10;
    if (pushed.current.seconds !== seconds) {
      pushed.current.seconds = seconds;
      setParam("liveSeconds", seconds);
    }
  });

  return null;
}

/** The active station's model seconds; an idle station is always at zero. */
const secondsFor = (m, station) => (m.station === station ? m.seconds : 0);

// ─── Filtration ─────────────────────────────────────────────────────

/** The flask stands on the retort stand's base plate. */
const PLATE_Y = 0.12;
const FLASK_TOP = PLATE_Y + FLASK.bodyHeight + FLASK.neckHeight;
const FUNNEL_APEX_Y = FLASK_TOP + 0.55;
const RING_Y = FUNNEL_APEX_Y + FUNNEL.height * 0.86;
const RING_R = FUNNEL.radius * 0.86;
const STAND_X = -1.95;
/** The sample beaker hangs in a clamp on a second stand and tips about the jaws. */
const POUR_BEAKER = { radius: 0.55, height: 1.4, liquid: 1.05 };
const CLAMP_STAND_X = 2.35;
const CLAMP_REACH = 1.0;
const CLAMP_X = CLAMP_STAND_X - CLAMP_REACH;
const CLAMP_Y = FUNNEL_APEX_Y + FUNNEL.height + 1.55;
const BEAKER_DROP = 0.75;

/** Droplets falling from `from` to `to` — the filtrate leaving the stem. */
function DripStream({ from, to, rateRef, count = 6, colourRef, animSpeed = 1 }) {
  const meshes = useRef([]);
  const state = useRef(null);
  if (!state.current) {
    state.current = Array.from({ length: count }, (_, i) => ({ phase: hashRandom(i * 3.3 + 2), x: (hashRandom(i * 5.1 + 7) - 0.5) * 0.04 }));
  }
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const rate = clamp(rateRef.current ?? 0, 0, 1);
    const live = Math.round(count * Math.min(1, rate * 1.6));
    state.current.forEach((s, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.visible = i < live && rate > 0.02;
      if (rate > 0.02) s.phase = (s.phase + dt * (0.9 + rate * 0.8)) % 1;
      const t = s.phase * s.phase; // falling: accelerates
      mesh.position.set(lerp(from[0], to[0], t) + s.x, lerp(from[1], to[1], t), lerp(from[2], to[2], t));
      mesh.scale.set(1, 1 + t * 1.2, 1);
      if (colourRef?.current) {
        mesh.material.color.set(colourRef.current);
        mesh.material.emissive.set(colourRef.current);
      }
    });
  });
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#c9e3ec" emissive="#c9e3ec" emissiveIntensity={0.4} transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  );
}

function FiltrationStation({ modelRef, mixture, solvent, animSpeed = 1 }) {
  const beaker = useRef(null);
  const beakerLiquid = useRef(null);
  const stream = useRef(null);
  const residue = useRef(null);
  const flaskLiquid = useRef({ fill: 0, colour: "#c9e3ec", opacity: 0.2 });
  const dripRate = useRef(0);
  const dripColour = useRef("#c9e3ec");
  const shown = useRef({ tilt: 0, residue: 0 });
  // The sample as prepared in THIS solvent — copper sulfate is a blue
  // solution in water and a cloudy suspension in ethanol.
  const sample = useMemo(() => liquidAppearance(mixture, solvent), [mixture, solvent]);
  const scratch = useMemo(
    () => ({ lip: new THREE.Vector3(), target: new THREE.Vector3(), dir: new THREE.Vector3(), q: new THREE.Quaternion(), zAxis: new THREE.Vector3(0, 0, 1), pivot: new THREE.Vector3(CLAMP_X, CLAMP_Y, 0) }),
    [],
  );

  useFrame((_, delta) => {
    const m = modelRef.current;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const active = m.station === "filtration";
    const r = solveFiltration({ mixture, solvent, seconds: secondsFor(m, "filtration") });
    m.results.filtration = r;

    // The beaker tips to pour and straightens when it is empty.
    const pouring = active && r.pouredFraction > 0 && r.pouredFraction < 1;
    const s = shown.current;
    s.tilt = relaxTo(s.tilt, pouring ? 1.15 : active && r.pouredFraction >= 1 ? 0.35 : 0, 0.35, dt);
    if (beaker.current) beaker.current.rotation.z = s.tilt;
    if (beakerLiquid.current) {
      const left = 1 - (active ? r.pouredFraction : 0);
      beakerLiquid.current.scale.y = Math.max(0.02, left);
      beakerLiquid.current.visible = left > 0.02;
    }
    // The stream from the lip to the funnel.
    if (stream.current) {
      stream.current.visible = pouring;
      if (pouring) {
        scratch.lip.set(-POUR_BEAKER.radius, POUR_BEAKER.height - BEAKER_DROP, 0).applyAxisAngle(scratch.zAxis, s.tilt).add(scratch.pivot);
        scratch.target.set(0.25, RING_Y - 0.1, 0);
        scratch.dir.subVectors(scratch.target, scratch.lip);
        const len = scratch.dir.length();
        scratch.dir.normalize();
        scratch.q.setFromUnitVectors(UP, scratch.dir);
        stream.current.position.copy(scratch.lip).addScaledVector(scratch.dir, len / 2);
        stream.current.quaternion.copy(scratch.q);
        stream.current.scale.set(1, len, 1);
        stream.current.material.color.set(sample.colour);
        stream.current.material.opacity = Math.max(0.35, sample.opacity);
      }
    }
    // Residue mound on the paper.
    s.residue = relaxTo(s.residue, active ? clamp(r.residueNowG / 18, 0, 1) : 0, 0.4, dt);
    if (residue.current) {
      const k = s.residue > 0.01 ? 0.35 + 0.75 * s.residue : 0;
      residue.current.scale.set(k, k * 0.8, k);
      residue.current.material.color.set(r.residueColour);
    }
    // Filtrate in the flask.
    const l = flaskLiquid.current;
    l.fill = relaxTo(l.fill, active ? r.filtrateFraction * 0.62 : 0, 0.3, dt);
    l.colour = r.filtrateColour;
    l.opacity = r.filtrateOpacity;
    dripRate.current = active ? r.dripRate : 0;
    dripColour.current = r.filtrateColour;
  });

  return (
    <group position={[FILTER_X, BENCH_Y, 0]}>
      <RetortStand position={[STAND_X, 0, 0]} height={FUNNEL_APEX_Y + FUNNEL.height + 1.2} fittings={[{ y: RING_Y, type: "ring", reach: -STAND_X - RING_R, radius: RING_R }]} />
      <RetortStand position={[CLAMP_STAND_X, 0, 0]} height={CLAMP_Y + 0.6} baseAngle={Math.PI} fittings={[{ y: CLAMP_Y, type: "clamp", reach: CLAMP_REACH, angle: Math.PI }]} />
      <group position={[0, PLATE_Y, 0]}>
        <ConicalFlask liquidRef={flaskLiquid} liquidColour="#c9e3ec" liquidOpacity={0.2} />
      </group>
      <group position={[0, FUNNEL_APEX_Y, 0]}>
        <Funnel residueRef={residue} />
      </group>
      <DripStream from={[0, FUNNEL_APEX_Y - FUNNEL.stemLength, 0]} to={[0, PLATE_Y + 0.3, 0]} rateRef={dripRate} colourRef={dripColour} animSpeed={animSpeed} />

      {/* The sample beaker in its clamp, tipping about the jaws to pour over the funnel. */}
      <group ref={beaker} position={[CLAMP_X, CLAMP_Y, 0]}>
        <group position={[0, -BEAKER_DROP, 0]}>
          <Beaker radius={POUR_BEAKER.radius} height={POUR_BEAKER.height} liquidHeight={POUR_BEAKER.liquid} liquidColour={sample.colour} liquidOpacity={sample.opacity} liquidRef={beakerLiquid} />
        </group>
      </group>
      <mesh ref={stream} visible={false}>
        <cylinderGeometry args={[0.035, 0.05, 1, 8]} />
        <meshStandardMaterial color={sample.colour} transparent opacity={0.5} roughness={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Crystallisation ────────────────────────────────────────────────

const TRIPOD_H = 3.3;
const BASIN_Y = TRIPOD_H + 0.08;
const BASIN_RIM = basinRimRadius(BASIN);
const BASIN_LIQUID_H = BASIN.depth - 0.036 - 0.04;
/** The volume of a spherical cap of height h in a sphere of radius R. */
const capVolume = (h, R) => (Math.PI * h * h * (3 * R - h)) / 3;
/** The cap height holding fraction `f` of the full basin's volume. */
function capHeightFor(f, R, full) {
  const target = f * capVolume(full, R);
  let lo = 0;
  let hi = full;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    if (capVolume(mid, R) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const CRYSTALS = 44;
const STEAM = 22;

/** Steam off the basin — instanced puffs that rise, spread and thin. */
function SteamWisps({ rateRef, radiusRef, animSpeed = 1 }) {
  const mesh = useRef(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: STEAM }, (_, i) => ({
        phase: hashRandom(i * 2.7 + 3),
        angle: hashRandom(i * 4.3 + 5) * Math.PI * 2,
        r: 0.2 + hashRandom(i * 6.1 + 9) * 0.8,
        drift: (hashRandom(i * 8.3 + 13) - 0.5) * 0.5,
        size: 0.1 + hashRandom(i * 9.7 + 17) * 0.12,
      })),
    [],
  );
  useFrame((_, delta) => {
    const inst = mesh.current;
    if (!inst) return;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const rate = clamp(rateRef.current ?? 0, 0, 1);
    const radius = radiusRef.current ?? 1;
    const live = Math.round(STEAM * rate);
    for (let i = 0; i < STEAM; i += 1) {
      const s = seeds[i];
      if (rate > 0.02) s.phase = (s.phase + dt * (0.35 + rate * 0.3)) % 1;
      const t = s.phase;
      const on = i < live;
      const spread = s.r * radius * (0.4 + t * 1.2);
      SCRATCH_OBJECT.position.set(Math.cos(s.angle + t * s.drift * 3) * spread, t * 2.2, Math.sin(s.angle + t * s.drift * 3) * spread);
      const scale = on ? s.size * (0.6 + t * 2.4) * (1 - t * 0.55) : 0;
      SCRATCH_OBJECT.scale.setScalar(scale);
      SCRATCH_OBJECT.updateMatrix();
      inst.setMatrixAt(i, SCRATCH_OBJECT.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.material.opacity = 0.16 + 0.1 * rate;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, STEAM]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial color="#e8eef5" transparent opacity={0.2} depthWrite={false} />
    </instancedMesh>
  );
}

/**
 * The crystals on the basin floor, instanced. Each has its own threshold
 * so they appear one at a time as the crystal fraction climbs — the first
 * at the rim where the liquid is thinnest, the rest filling in. Cubes for
 * salt, blue prisms for copper sulfate.
 */
function CrystalBed({ modelRef, animSpeed = 1 }) {
  const mesh = useRef(null);
  const shown = useRef(new Float32Array(CRYSTALS));
  const seeds = useMemo(
    () =>
      Array.from({ length: CRYSTALS }, (_, i) => {
        const a = hashRandom(i * 3.1 + 11) * Math.PI * 2;
        // Earliest crystals at the edge — the threshold rises toward the centre.
        const rr = Math.sqrt(hashRandom(i * 5.3 + 13));
        const r = BASIN_RIM * 0.86 * rr;
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          threshold: clamp(0.02 + (1 - rr) * 0.75 + (hashRandom(i * 7.7 + 17) - 0.5) * 0.2, 0.01, 0.92),
          size: 0.05 + hashRandom(i * 9.1 + 19) * 0.06,
          spin: hashRandom(i * 11.3 + 23) * Math.PI,
          tilt: (hashRandom(i * 13.1 + 29) - 0.5) * 0.5,
        };
      }),
    [],
  );
  useFrame((_, delta) => {
    const inst = mesh.current;
    if (!inst) return;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const r = modelRef.current.results.crystallization;
    const active = modelRef.current.station === "crystallization";
    const lead = r?.crystallisers?.length ? r.crystallisers.reduce((a, b) => (a.crystalFraction >= b.crystalFraction ? a : b)) : null;
    const fraction = active && lead ? lead.crystalFraction : 0;
    const prism = lead?.crystal === "prism";
    // Floor height where each crystal sits, from the bowl's curve.
    for (let i = 0; i < CRYSTALS; i += 1) {
      const s = seeds[i];
      const want = clamp((fraction - s.threshold) / 0.12, 0, 1);
      shown.current[i] = relaxTo(shown.current[i], want, 0.25, dt);
      const grow = shown.current[i];
      const rad = Math.hypot(s.x, s.z);
      const floorY = BASIN.sphereRadius - Math.sqrt(Math.max(0, BASIN.sphereRadius * BASIN.sphereRadius - rad * rad)) + 0.036;
      SCRATCH_OBJECT.position.set(s.x, floorY + s.size * grow * 0.5, s.z);
      SCRATCH_OBJECT.rotation.set(prism ? s.tilt : 0, s.spin, prism ? 0.3 : 0);
      const k = s.size * grow;
      SCRATCH_OBJECT.scale.set(k, prism ? k * 0.7 : k, prism ? k * 2.1 : k);
      SCRATCH_OBJECT.updateMatrix();
      inst.setMatrixAt(i, SCRATCH_OBJECT.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (lead) {
      inst.material.color.set(lead.colour);
      inst.material.emissive.set(lead.colour);
    }
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CRYSTALS]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#f4f4f2" emissive="#f4f4f2" emissiveIntensity={0.35} roughness={0.25} metalness={0.05} />
    </instancedMesh>
  );
}

function CrystallizationStation({ modelRef, mixture, solvent, animSpeed = 1 }) {
  const flame = useRef({ height: 0, colour: "#4f8ff7", inner: 0, roar: 0.7, luminous: 0.3 });
  const liquid = useRef({ fill: 1, colour: "#c9e3ec", opacity: 0.3 });
  const steamRate = useRef(0);
  const steamRadius = useRef(1);
  const film = useRef(null);
  const precipitate = useRef(null);
  const shown = useRef({ fill: 1, film: 0, precip: 0 });
  const burnerProfile = useMemo(() => flameProfile(70), []);

  useFrame((_, delta) => {
    const m = modelRef.current;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const active = m.station === "crystallization";
    const r = solveCrystallization({ mixture, solvent, seconds: secondsFor(m, "crystallization") });
    m.results.crystallization = r;

    const f = flame.current;
    f.height = active && r.flameOn ? 0.72 : 0;
    f.colour = burnerProfile.colour;
    f.inner = burnerProfile.innerCone;
    f.roar = burnerProfile.roar;
    f.luminous = burnerProfile.luminous;

    const s = shown.current;
    const volumeFraction = active ? r.volumeMl / SAMPLE_VOLUME_ML : 1;
    s.fill = relaxTo(s.fill, volumeFraction, 0.25, dt);
    const l = liquid.current;
    l.fill = s.fill > 0.005 ? capHeightFor(s.fill, BASIN.sphereRadius, BASIN_LIQUID_H) / BASIN_LIQUID_H : 0;
    l.colour = r.liquidColour;
    l.opacity = r.liquidOpacity;
    steamRate.current = active ? r.steamRate : 0;
    const h = l.fill * BASIN_LIQUID_H;
    steamRadius.current = Math.sqrt(Math.max(0.05, BASIN.sphereRadius * BASIN.sphereRadius - Math.pow(BASIN.sphereRadius - h, 2)));

    s.film = relaxTo(s.film, active ? clamp(r.filmG / 0.9, 0, 1) : 0, 0.3, dt);
    if (film.current) {
      film.current.visible = s.film > 0.01;
      film.current.material.opacity = 0.15 + 0.7 * s.film;
      const k = 0.25 + 0.75 * s.film;
      film.current.scale.set(k, 1, k);
    }
    s.precip = relaxTo(s.precip, clamp(r.precipitateG / 18, 0, 1), 0.3, dt);
    if (precipitate.current) {
      precipitate.current.visible = s.precip > 0.01;
      const k = 0.3 + 0.7 * s.precip;
      precipitate.current.scale.set(k, k * 0.55, k);
      const solid = r.components.find((c) => c.undissolvedG > 0.3);
      if (solid) precipitate.current.material.color.set(solid.colour);
    }
  });

  return (
    <group position={[CRYST_X, BENCH_Y, 0]}>
      <HeatMat position={[0, 0, 0]} size={[4.4, 3.4]} />
      <BunsenBurner position={[0, 0.04, 0]} collar={0.7} flameRef={flame} animSpeed={animSpeed} />
      <Tripod position={[0, 0.04, 0]} height={TRIPOD_H} />
      <group position={[0, BASIN_Y, 0]}>
        <EvaporatingBasin liquidRef={liquid} liquidColour="#c9e3ec" liquidOpacity={0.3}>
          <CrystalBed modelRef={modelRef} animSpeed={animSpeed} />
          {/* A dye dries to a film; an undissolved solid sits as a mound from the start. */}
          <mesh ref={film} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <circleGeometry args={[BASIN_RIM * 0.7, 32]} />
            <meshStandardMaterial color="#1f1a2e" transparent opacity={0.4} roughness={0.5} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh ref={precipitate} position={[0, 0.05, 0]} visible={false}>
            <sphereGeometry args={[BASIN_RIM * 0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#a9c8e8" roughness={0.95} />
          </mesh>
          <group position={[0, BASIN.depth, 0]}>
            <SteamWisps rateRef={steamRate} radiusRef={steamRadius} animSpeed={animSpeed} />
          </group>
        </EvaporatingBasin>
      </group>
    </group>
  );
}

// ─── Chromatography ─────────────────────────────────────────────────

const MM = 0.036;
const TANK = { radius: cm(7), height: cm(20) };
const PAPER_W = cm(3.2);
const PAPER_H = PAPER_LENGTH_MM * MM;
const PAPER_BOTTOM = 0.12;
const BASELINE_Y = PAPER_BOTTOM + BASELINE_MM * MM;
const POOL_TOP = 0.03 + SOLVENT_DEPTH_MM * MM;

/** One pigment spot on the strip (and on the chart): rises with its Rf. */
function Spot({ index, modelRef, mixture, solvent, scale = 1, chart = false, animSpeed = 1 }) {
  const mesh = useRef(null);
  const shown = useRef({ y: 0 });
  const component = MIXTURES[mixture].components[index];
  const c = COMPONENTS[component];
  const solid = c.kind === "solid";

  useFrame((_, delta) => {
    const r = modelRef.current.results.chromatography;
    const m = mesh.current;
    if (!m || !r) return;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const spot = r.spots[index];
    const active = modelRef.current.station === "chromatography";
    const want = active ? spot.distanceMm * MM * scale : 0;
    shown.current.y = relaxTo(shown.current.y, want, 0.2, dt);
    m.position.y = shown.current.y;
    const travel = want / (FRONT_MAX_MM * MM * scale);
    if (!solid) m.scale.set(1, 1 + travel * 0.7, 1);
    m.material.opacity = c.visible ? (spot.moves || spot.rf === 0 ? 0.92 : 0.5) : 0.14;
  });

  const radius = (solid ? 0.06 : 0.085) * scale * (chart ? 1.7 : 1);
  return (
    <mesh ref={mesh} position={[0, 0, 0]}>
      {solid ? <dodecahedronGeometry args={[radius, 0]} /> : <circleGeometry args={[radius, 20]} />}
      <meshStandardMaterial
        color={c.colour}
        emissive={c.colour}
        emissiveIntensity={chart ? 0.4 : 0.25}
        transparent
        opacity={c.visible ? 0.92 : 0.14}
        side={THREE.DoubleSide}
        depthWrite={false}
        wireframe={!c.visible && !solid}
      />
    </mesh>
  );
}

function ChromatographyStation({ modelRef, mixture, solvent, animSpeed = 1 }) {
  const wet = useRef(null);
  const front = useRef(null);
  const shown = useRef({ front: 0 });
  const S = SOLVENTS[solvent];
  const M = MIXTURES[mixture];
  const n = M.components.length;

  useFrame((_, delta) => {
    const m = modelRef.current;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const r = solveChromatography({ mixture, solvent, seconds: secondsFor(m, "chromatography") });
    m.results.chromatography = r;
    const active = m.station === "chromatography";
    shown.current.front = relaxTo(shown.current.front, active ? r.frontMm : 0, 0.2, dt);
    const frontY = BASELINE_Y + shown.current.front * MM;
    // The wet part of the paper, from the pool up to the front.
    if (wet.current) {
      const h = frontY - PAPER_BOTTOM;
      wet.current.scale.set(1, Math.max(h, 0.001), 1);
      wet.current.position.y = PAPER_BOTTOM + h / 2;
    }
    if (front.current) {
      front.current.visible = shown.current.front > 0.6;
      front.current.position.y = frontY;
    }
  });

  return (
    <group position={[CHROM_X, BENCH_Y, 0]}>
      <GlassJar radius={TANK.radius} height={TANK.height} lid>
        {/* The solvent pool, below the baseline. */}
        <mesh position={[0, 0.03 + (SOLVENT_DEPTH_MM * MM) / 2, 0]}>
          <cylinderGeometry args={[TANK.radius - 0.04, TANK.radius - 0.04, SOLVENT_DEPTH_MM * MM, 36]} />
          <meshStandardMaterial color={S.colour} transparent opacity={0.4} roughness={0.1} depthWrite={false} />
        </mesh>
        <mesh position={[0, POOL_TOP, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[TANK.radius - 0.04, 36]} />
          <meshStandardMaterial color="#e8f4ff" transparent opacity={0.45} roughness={0.08} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {/* A glass rod across the lid with the strip clipped to it. */}
        <mesh position={[0, TANK.height - 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, TANK.radius * 2 - 0.2, 10]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh position={[0, TANK.height - 0.2, 0]}>
          <boxGeometry args={[0.14, 0.16, 0.06]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        {/* The paper. */}
        <mesh position={[0, PAPER_BOTTOM + PAPER_H / 2, 0]}>
          <planeGeometry args={[PAPER_W, PAPER_H]} />
          <meshStandardMaterial {...PAPER} />
        </mesh>
        <mesh ref={wet} position={[0, PAPER_BOTTOM, 0.004]}>
          <planeGeometry args={[PAPER_W, 1]} />
          <meshStandardMaterial color="#b9cdd6" transparent opacity={0.55} roughness={0.6} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {/* Pencil baseline — pencil, because ink would run. */}
        <mesh position={[0, BASELINE_Y, 0.008]}>
          <boxGeometry args={[PAPER_W * 0.92, 0.012, 0.002]} />
          <meshBasicMaterial color="#4b5563" />
        </mesh>
        <mesh ref={front} position={[0, BASELINE_Y, 0.009]} visible={false}>
          <boxGeometry args={[PAPER_W, 0.01, 0.002]} />
          <meshBasicMaterial color="#64748b" transparent opacity={0.8} />
        </mesh>
        {/* The spots start on the baseline, side by side. */}
        <group position={[0, BASELINE_Y, 0.012]}>
          {M.components.map((key, i) => (
            <group key={key} position={[(i - (n - 1) / 2) * (PAPER_W / Math.max(n, 2)) * 0.75, 0, 0]}>
              <Spot index={i} modelRef={modelRef} mixture={mixture} solvent={solvent} animSpeed={animSpeed} />
            </group>
          ))}
        </group>
      </GlassJar>
    </group>
  );
}

// ─── The chromatogram board ─────────────────────────────────────────

const CHART = { x: CHROM_X + 2.6, y: BENCH_Y + 0.55, z: 0.3, scale: 1.25, width: 1.5 };
const CHART_H = FRONT_MAX_MM * MM * CHART.scale;

/**
 * The live chromatogram beside the tank: the same strip drawn as a chart —
 * distance up the paper on the vertical axis with ticks every 25 mm, the
 * front as a moving bar, each pigment as a disc at its own distance, and
 * the Rf arithmetic written beside it. Points are memoised; only positions
 * move, so nothing is rebuilt at 10 Hz.
 */
function Chromatogram({ modelRef, mixture, solvent, result, animSpeed = 1 }) {
  const front = useRef(null);
  const shown = useRef({ front: 0 });
  const M = MIXTURES[mixture];
  const n = M.components.length;
  const axis = useMemo(() => [[0, 0, 0], [0, CHART_H + 0.15, 0]], []);
  const ticks = useMemo(() => [0, 25, 50, 75].map((mm) => ({ mm, y: mm * MM * CHART.scale })), []);
  const tickLines = useMemo(() => ticks.map((t) => [[-0.08, t.y, 0], [CHART.width, t.y, 0]]), [ticks]);

  useFrame((_, delta) => {
    const r = modelRef.current.results.chromatography;
    if (!r || !front.current) return;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const active = modelRef.current.station === "chromatography";
    shown.current.front = relaxTo(shown.current.front, active ? r.frontMm : 0, 0.2, dt);
    front.current.position.y = shown.current.front * MM * CHART.scale;
    front.current.visible = shown.current.front > 0.3;
  });

  const active = result?.station === "chromatography";
  const frontY = active ? Math.max(result.frontMm * MM * CHART.scale, 0) : 0;
  return (
    <group position={[CHART.x, CHART.y, CHART.z]} rotation={[0, -0.38, 0]}>
      {/* Board. */}
      <mesh position={[CHART.width / 2 - 0.1, CHART_H / 2 + 0.05, -0.03]}>
        <planeGeometry args={[CHART.width + 0.7, CHART_H + 1.0]} />
        <meshBasicMaterial color="#0d121c" transparent opacity={0.86} depthWrite={false} />
      </mesh>
      <Line points={axis} color={PALETTE.line} lineWidth={1.4} />
      {tickLines.map((pts, i) => (
        <Line key={i} points={pts} color={PALETTE.line} lineWidth={0.8} transparent opacity={0.45} />
      ))}
      {ticks.map((t) => (
        <SceneLabel key={t.mm} position={[-0.32, t.y, 0]} tone="text-ink-500">
          {`${t.mm} mm`}
        </SceneLabel>
      ))}
      {/* Baseline and front. */}
      <mesh position={[CHART.width / 2 - 0.1, 0, 0.002]}>
        <boxGeometry args={[CHART.width + 0.2, 0.014, 0.002]} />
        <meshBasicMaterial color="#9ca3af" />
      </mesh>
      <mesh ref={front} position={[CHART.width / 2 - 0.1, 0, 0.003]} visible={false}>
        <boxGeometry args={[CHART.width + 0.2, 0.012, 0.002]} />
        <meshBasicMaterial color={PALETTE.sky} />
      </mesh>
      <group position={[0.1, 0, 0.01]}>
        {M.components.map((key, i) => (
          <group key={key} position={[0.2 + i * ((CHART.width - 0.5) / Math.max(n - 1, 1)), 0, 0]}>
            <Spot index={i} modelRef={modelRef} mixture={mixture} solvent={solvent} scale={CHART.scale} chart animSpeed={animSpeed} />
          </group>
        ))}
      </group>
      {/* The arithmetic. */}
      <SceneLabel position={[CHART.width / 2 - 0.1, CHART_H + 0.55, 0]} accent>
        {"Rf = d(pigment) ÷ d(solvent front)"}
      </SceneLabel>
      {/* The front's own label rides on the front line; the Rf list stacks beside the top of the board. */}
      <SceneLabel position={[CHART.width / 2 - 0.1, frontY + 0.16, 0.02]} tone="text-sky-300">
        {active ? `solvent front ${result.frontMm.toFixed(1)} mm${result.finished ? " · done" : ""}` : "solvent front 0 mm"}
      </SceneLabel>
      {active &&
        result.spots.map((spot, i) => (
          <SceneLabel key={spot.key} position={[CHART.width + 0.35, CHART_H + 0.1 - i * 0.3, 0]} tone={spot.moves && spot.visible ? "text-ink-200" : "text-ink-500"}>
            {`${COMPONENTS[spot.key].formula}: ${spot.moves ? `Rf ${rfText(spot, result.frontMm)}` : spot.visible ? "stays on the baseline" : "colourless"}`}
          </SceneLabel>
        ))}
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

function createModel(station, mixture, solvent) {
  return { seconds: 0, station, mixture, solvent, results: {} };
}

export default function SeparationTechniquesCanvas({ params = {}, setParam }) {
  const { mixture = "sand_salt", solvent = "water", station = "filtration", restart = 0, speed = 1, liveSeconds = 0 } = params || {};
  const mixKey = MIXTURES[mixture] ? mixture : "sand_salt";
  const solKey = SOLVENTS[solvent] ? solvent : "water";
  const stationKey = STATIONS[station] ? station : "filtration";
  const modelRef = useRef(null);
  if (modelRef.current === null) modelRef.current = createModel(stationKey, mixKey, solKey);

  // What the labels say — the same solve the HUD does from `liveSeconds`.
  const result = useMemo(() => {
    const args = { mixture: mixKey, solvent: solKey, seconds: liveSeconds };
    if (stationKey === "crystallization") return solveCrystallization(args);
    if (stationKey === "chromatography") return solveChromatography(args);
    return solveFiltration(args);
  }, [stationKey, mixKey, solKey, liveSeconds]);
  const M = MIXTURES[mixKey];
  const S = SOLVENTS[solKey];

  const headline = (() => {
    if (result.station === "filtration") return `${result.filtrateMl.toFixed(0)} mL through · ${result.residueNowG.toFixed(1)} g on the paper`;
    if (result.station === "crystallization") return `${result.temperatureC.toFixed(0)} °C · ${result.volumeMl.toFixed(0)} mL left · ${result.crystalsG > 0.05 ? `${result.crystalsG.toFixed(1)} g crystals` : result.phase}`;
    return `front ${result.frontMm.toFixed(1)} mm · ${result.distinct} visible spot${result.distinct === 1 ? "" : "s"}`;
  })();

  return (
    <SceneCanvas camera={{ position: [-0.8, 3.4, 19.5], fov: 44 }} controls={{ minDistance: 5, maxDistance: 34, target: [-0.8, 0.5, 0] }}>
      <StationClock modelRef={modelRef} station={stationKey} mixture={mixKey} solvent={solKey} restartToken={restart} animSpeed={speed} setParam={setParam} />

      <LabBench y={BENCH_Y} width={20} depth={7} />

      <FiltrationStation modelRef={modelRef} mixture={mixKey} solvent={solKey} animSpeed={speed} />
      <CrystallizationStation modelRef={modelRef} mixture={mixKey} solvent={solKey} animSpeed={speed} />
      <ChromatographyStation modelRef={modelRef} mixture={mixKey} solvent={solKey} animSpeed={speed} />
      <Chromatogram modelRef={modelRef} mixture={mixKey} solvent={solKey} result={result} animSpeed={speed} />

      {/* Station tags along the front of the bench; the active one glows. */}
      {STATION_ORDER.map((key) => {
        const active = key === stationKey;
        const x = STATION_X[key];
        return (
          <group key={key} position={[x, BENCH_Y, 2.6]}>
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[3.6, 0.12]} />
              <meshStandardMaterial color={active ? PALETTE.gold : "#4a4038"} emissive={active ? PALETTE.gold : "#000000"} emissiveIntensity={active ? 0.6 : 0} roughness={0.8} />
            </mesh>
            <SceneLabel position={[0, 0.4, 0.2]} accent={active} tone={active ? "text-duck-300" : "text-ink-400"}>
              {`${STATIONS[key].label} · ${STATIONS[key].property}`}
            </SceneLabel>
          </group>
        );
      })}

      {/* What is happening at the active station. */}
      <SceneLabel position={[STATION_X[stationKey], BENCH_Y + 7.5, 0]} accent>
        {`${STATIONS[stationKey].label} · ${M.label} · ${S.label} · ${STATIONS[stationKey].timeLapse}× time-lapse`}
      </SceneLabel>
      <SceneLabel position={[STATION_X[stationKey], BENCH_Y + 7.1, 0]} tone="text-ink-300">
        {`${formatSeconds(liveSeconds)} · ${headline}`}
      </SceneLabel>
      <SceneLabel position={[STATION_X[stationKey], BENCH_Y + 6.75, 0]} tone={result.separates || result.nucleated || result.distinct >= 2 ? "text-emerald-300" : "text-ink-400"}>
        {result.verdict}
      </SceneLabel>
      {result.station === "crystallization" && result.flammableWarning && (
        <SceneLabel position={[CRYST_X, BENCH_Y - 0.7, 2.6]} tone="text-amber-300">
          {"ethanol is flammable — in a real lab this basin sits in a water bath, never over a naked flame"}
        </SceneLabel>
      )}

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Separation techniques"
        subtitle={`${STATIONS[stationKey].label} · ${M.label}`}
        rows={[["Verdict", result.verdict]]}
      />
      <SceneLegend
        title="Key"
        items={[
          { color: M.liquidColour, label: M.label, note: M.title },
          { color: S.colour, label: `${S.label} (${S.formula})`, note: S.title },
        ]}
      />
    </SceneCanvas>
  );
}
