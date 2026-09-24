"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
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
import { Beaker, relaxTo } from "@/components/visualizations/vessel-rack";
import {
  TRIPOD_TOP_CLEARANCE,
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
  LabWall,
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
  stationFit,
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
// One apparatus at a time, standing in the middle of the bench.
const CRYST_X = 0;
const PUSH_EVERY_S = 0.2;

const SCRATCH_OBJECT = new THREE.Object3D();

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

/** The flask stands on the retort stand's base plate — a hair above it, never in its plane. */
const PLATE_Y = 0.123;
const FLASK_TOP = PLATE_Y + FLASK.bodyHeight + FLASK.neckHeight;
const FUNNEL_APEX_Y = FLASK_TOP + 0.55;
const RING_R = FUNNEL.radius * 0.86;
/**
 * The funnel rests IN the ring: the ring sits where the cone's radius equals
 * the ring's inner edge, so the steel meets the glass instead of passing
 * through the glass and the paper (it used to be centred on the cone's surface).
 */
const RING_TUBE = 0.04;
const RING_Y = FUNNEL_APEX_Y + (FUNNEL.height * (RING_R - RING_TUBE)) / FUNNEL.radius - RING_TUBE;
const STAND_X = -1.95;
/** The sample beaker hangs in a clamp on a second stand and tips about the jaws. */
const POUR_BEAKER = { radius: 0.55, height: 1.4, liquid: 1.05 };
const CLAMP_STAND_X = 2.35;
const CLAMP_REACH = 1.0;
const CLAMP_X = CLAMP_STAND_X - CLAMP_REACH;
const CLAMP_Y = FUNNEL_APEX_Y + FUNNEL.height + 1.55;
const BEAKER_DROP = 0.75;
/** The filtration rig stands at the bench's origin; world x equals station x. */
const BENCH_ORIGIN_X = 0;

/** How high the filtrate stands in the flask, from its fill fraction (world y within the station). */
const flaskSurfaceY = (fill) => PLATE_Y + 0.06 + clamp(fill, 0, 1) * (FLASK.bodyHeight - 0.1);

/**
 * The filtrate leaving the stem: separate drops when it is slow, a thin
 * unbroken trickle while it runs fast, and in both cases ending at the
 * liquid's surface — not falling through it to the bottom of the flask.
 */
function DripStream({ from, surfaceRef, rateRef, count = 6, colourRef, animSpeed = 1 }) {
  const meshes = useRef([]);
  const trickle = useRef(null);
  const state = useRef(null);
  if (!state.current) {
    state.current = Array.from({ length: count }, (_, i) => ({ phase: hashRandom(i * 3.3 + 2), x: (hashRandom(i * 5.1 + 7) - 0.5) * 0.02 }));
  }
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * animSpeed;
    const rate = clamp(rateRef.current ?? 0, 0, 1);
    const bottom = surfaceRef.current ?? PLATE_Y + 0.1;
    const fall = from[1] - bottom;
    const flowing = rate > 0.35;
    const live = flowing ? 0 : Math.round(count * Math.min(1, rate * 3));
    state.current.forEach((s, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.visible = i < live && rate > 0.02 && fall > 0.05;
      if (rate > 0.02) s.phase = (s.phase + dt * (0.8 + rate)) % 1;
      const t = s.phase * s.phase; // falling: accelerates
      mesh.position.set(from[0] + s.x, from[1] - fall * t, from[2]);
      mesh.scale.set(1, 1 + t * 1.4, 1);
      if (colourRef?.current) mesh.material.color.set(colourRef.current);
    });
    if (trickle.current) {
      trickle.current.visible = flowing && fall > 0.05;
      trickle.current.position.set(from[0], from[1] - fall / 2, from[2]);
      trickle.current.scale.set(0.6 + rate * 0.5, fall, 0.6 + rate * 0.5);
      if (colourRef?.current) trickle.current.material.color.set(colourRef.current);
    }
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
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#c9e3ec" roughness={0.1} transparent opacity={0.9} />
        </mesh>
      ))}
      <mesh ref={trickle} visible={false}>
        <cylinderGeometry args={[0.022, 0.03, 1, 8, 1, true]} />
        <meshStandardMaterial color="#c9e3ec" roughness={0.1} transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </>
  );
}

const STREAM_SEGMENTS = 24;
const STREAM_SIDES = 12;
/** The stream's radius at the lip and where it lands: it thins as it speeds up. */
const STREAM_R = [0.05, 0.026];

/** Index buffer for a tube of `STREAM_SEGMENTS + 1` rings of `STREAM_SIDES + 1` vertices. */
function streamGeometry() {
  const cols = STREAM_SIDES + 1;
  const rows = STREAM_SEGMENTS + 1;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
  const index = [];
  for (let i = 0; i < STREAM_SEGMENTS; i += 1) {
    for (let j = 0; j < STREAM_SIDES; j += 1) {
      const a = i * cols + j;
      const b = a + cols;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  g.setIndex(index);
  return g;
}

/**
 * Wraps the stream's tube round its centre line (which lies in the z = 0
 * plane): each ring is spanned by the in-plane normal and world z. `width`
 * scales the whole stream, for the thin last trickle.
 */
function shapeStream(geometry, points, width = 1) {
  const pos = geometry.attributes.position.array;
  const nrm = geometry.attributes.normal.array;
  const cols = STREAM_SIDES + 1;
  for (let i = 0; i <= STREAM_SEGMENTS; i += 1) {
    const p = points[i];
    const q = points[Math.min(i + 1, STREAM_SEGMENTS)];
    const o = points[Math.max(i - 1, 0)];
    let tx = q.x - o.x;
    let ty = q.y - o.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const u = i / STREAM_SEGMENTS;
    const r = lerp(STREAM_R[0], STREAM_R[1], Math.sqrt(u)) * width;
    for (let j = 0; j < cols; j += 1) {
      const a = (j / STREAM_SIDES) * Math.PI * 2;
      const nx = -ty * Math.cos(a);
      const ny = tx * Math.cos(a);
      const nz = Math.sin(a);
      const k = (i * cols + j) * 3;
      pos[k] = p.x + nx * r;
      pos[k + 1] = p.y + ny * r;
      pos[k + 2] = p.z + nz * r;
      nrm[k] = nx;
      nrm[k + 1] = ny;
      nrm[k + 2] = nz;
    }
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.normal.needsUpdate = true;
  geometry.computeBoundingSphere();
}

// ─── How much a tipped beaker holds ──────────────────────────────────
// The beaker's inside is a cylinder of radius POUR_RI from its floor
// (POUR_FLOOR) to the inner rim, POUR_DEPTH above it. Tipped by θ towards
// the funnel (local −x), a level surface stands h0 − x·tanθ above the floor
// at x. The volume under it is summed over strips across the circle.
const POUR_RI = POUR_BEAKER.radius - 0.035;
const POUR_FLOOR = 0.12;
const POUR_DEPTH = POUR_BEAKER.height - 0.14;
const POUR_STRIPS = 48;
const POUR_X = Array.from({ length: POUR_STRIPS }, (_, i) => -POUR_RI + ((i + 0.5) * 2 * POUR_RI) / POUR_STRIPS);
const POUR_W = POUR_X.map((x) => 2 * Math.sqrt(POUR_RI * POUR_RI - x * x) * ((2 * POUR_RI) / POUR_STRIPS));
const beakerVolume = (h0, tan) => POUR_X.reduce((v, x, i) => v + POUR_W[i] * clamp(h0 - x * tan, 0, POUR_DEPTH), 0);
/** The sample, standing POUR_BEAKER.liquid deep in the upright beaker. */
const POUR_FULL_V = beakerVolume(POUR_BEAKER.liquid, 0);
/** The most the beaker holds at this tilt: the surface just touching the low lip. */
const spillVolume = (tan) => beakerVolume(POUR_DEPTH - POUR_RI * tan, tan);
/** The tilt at which `volume` just reaches the lip — any further and it pours. */
function spillAngle(volume) {
  let lo = 0;
  let hi = 1.5;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (spillVolume(Math.tan(mid)) > volume) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Where the surface crosses the beaker's axis, above the floor, for `volume` at this tilt. */
function surfaceHeight(volume, tan) {
  let lo = -POUR_RI * tan;
  let hi = POUR_DEPTH + POUR_RI * tan;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (beakerVolume(mid, tan) < volume) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Seconds (animated) for the front of the stream to fall from the lip to the paper. */
const STREAM_FALL_S = 0.22;

/**
 * The sample in the tipped beaker. Liquid finds its own level, so it is
 * drawn as the beaker's full inner cylinder CLIPPED by a horizontal plane
 * at the liquid's surface: tip the beaker and the surface stays flat while
 * the glass turns round it, instead of the whole column tilting through the
 * wall. A disc in that plane, trimmed by the base and rim planes, is the
 * surface itself.
 */
function TippedLiquid({ surfacePlane, colour, opacity }) {
  const inner = POUR_BEAKER.radius - 0.035;
  const bodyH = POUR_BEAKER.height - 0.14;
  return (
    <>
      <mesh position={[0, 0.12 + bodyH / 2, 0]}>
        <cylinderGeometry args={[inner, inner, bodyH, 32]} />
        {/* Front faces only: with both sides, the far wall showed through the near one as a darker second layer. */}
        <meshStandardMaterial color={colour} transparent opacity={opacity} roughness={0.15} depthWrite={false} clippingPlanes={[surfacePlane]} />
      </mesh>
    </>
  );
}

function FiltrationStation({ modelRef, mixture, solvent, animSpeed = 1 }) {
  const beaker = useRef(null);
  const beakerLiquid = useRef(null);
  const residue = useRef(null);
  const flaskLiquid = useRef({ fill: 0, colour: "#c9e3ec", opacity: 0.2 });
  const dripRate = useRef(0);
  const dripColour = useRef("#c9e3ec");
  // `vol` is what the beaker still holds; `head`/`tail` are how far along its
  // path the stream's front and back have fallen (tail 1: no stream).
  const shown = useRef({ tilt: 0, residue: 0, vol: POUR_FULL_V, head: 0, tail: 1 });
  // The sample as prepared in THIS solvent — copper sulfate is a blue
  // solution in water and a cloudy suspension in ethanol.
  const sample = useMemo(() => liquidAppearance(mixture, solvent), [mixture, solvent]);
  // Samples read clearly: even salt water is visibly a liquid in the beaker.
  const sampleOpacity = Math.max(0.42, Math.min(0.85, sample.opacity * 1.3));
  const gl = useThree((st) => st.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  // World-space planes: the liquid surface (keep below), and the beaker's base
  // and rim (keep between) for the surface disc.
  const planes = useMemo(
    () => ({ surface: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), base: new THREE.Plane(), rim: new THREE.Plane() }),
    [],
  );
  const surfaceDisc = useRef(null);
  const flaskSurface = useRef(flaskSurfaceY(0));
  const streamPoints = useMemo(() => Array.from({ length: STREAM_SEGMENTS + 1 }, () => new THREE.Vector3()), []);
  const stream = useRef(null);
  const streamGeo = useMemo(() => streamGeometry(), []);
  useEffect(() => () => streamGeo.dispose(), [streamGeo]);
  const scratch = useMemo(
    () => ({ lip: new THREE.Vector3(), target: new THREE.Vector3(), dir: new THREE.Vector3(), benchOffset: new THREE.Vector3(0, BENCH_Y, 0) }),
    [],
  );

  useFrame((_, delta) => {
    const m = modelRef.current;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const active = m.station === "filtration";
    const r = solveFiltration({ mixture, solvent, seconds: secondsFor(m, "filtration") });
    m.results.filtration = r;

    // The beaker tips just past the angle at which what is left in it reaches
    // the lip — so it pours from the first moment, and tips further as it
    // empties, the way a hand pours. Once it is empty it is set back.
    const s = shown.current;
    const modelLeft = active ? 1 - r.pouredFraction : 1;
    const wantV = modelLeft * POUR_FULL_V;
    // A restart refills it, stood no further over than the new sample can take.
    if (wantV > s.vol + 1e-4) {
      s.vol = wantV;
      s.tilt = Math.min(s.tilt, spillAngle(wantV));
    }
    const emptied = active && modelLeft <= 0.002;
    const tiltTarget = !active ? 0 : emptied ? 0.3 : Math.min(1.45, spillAngle(wantV) + 0.06);
    s.tilt = relaxTo(s.tilt, tiltTarget, emptied ? 0.5 : 0.12, dt);
    if (beaker.current) beaker.current.rotation.z = s.tilt;
    const tan = Math.tan(s.tilt);
    // Whatever the tilt cannot hold goes over the lip; that is the stream.
    const vMax = spillVolume(tan);
    const before = s.vol;
    s.vol = Math.min(s.vol, vMax);
    // The last film drains out once the pour is done.
    if (emptied) s.vol = relaxTo(s.vol, 0, 0.15, dt);
    const spilling = before - s.vol > 1e-6 && s.vol > 0.004 * POUR_FULL_V;
    const left = s.vol / POUR_FULL_V;
    const cos = Math.cos(s.tilt);
    const sin = Math.sin(s.tilt);
    const toWorld = (lx, ly) => [CLAMP_X + lx * cos - (ly - BEAKER_DROP) * sin + BENCH_ORIGIN_X, CLAMP_Y + lx * sin + (ly - BEAKER_DROP) * cos];
    // The level, in world space, from where the surface crosses the beaker's axis.
    const h0 = surfaceHeight(s.vol, tan);
    const levelY = left <= 0.004 ? toWorld(0, 0)[1] - 1 : toWorld(0, POUR_FLOOR + h0)[1];
    planes.surface.constant = BENCH_Y + levelY;
    // Base and rim planes follow the beaker's axis.
    const axis = scratch.dir.set(-sin, cos, 0);
    const basePoint = scratch.target.set(...toWorld(0, 0.12), 0).add(scratch.benchOffset);
    planes.base.setFromNormalAndCoplanarPoint(axis, basePoint);
    const rimPoint = scratch.lip.set(...toWorld(0, POUR_BEAKER.height - 0.02), 0).add(scratch.benchOffset);
    planes.rim.setFromNormalAndCoplanarPoint(axis.clone().negate(), rimPoint);
    if (surfaceDisc.current) {
      surfaceDisc.current.visible = left > 0.004;
      // The disc lies in the surface plane, centred where the beaker's axis
      // crosses it; a horizontal cut through a tilted cylinder is an ellipse
      // 1/cos θ long. The base and rim planes trim it to the glass.
      const [cx, cy] = toWorld(0, POUR_FLOOR + h0);
      surfaceDisc.current.position.set(cx, cy, 0);
      surfaceDisc.current.scale.set(1 / Math.max(cos, 0.08), 1, 1);
    }
    // The stream: it leaves the lip moving sideways and falls on a parabola,
    // narrowing as it speeds up, into the paper cone. Its front falls from the
    // lip when the pour starts and its tail falls away when it stops, rather
    // than the whole column appearing or vanishing at once.
    if (spilling) {
      if (s.tail >= 1) {
        s.head = 0;
        s.tail = 0;
      }
      s.head = Math.min(1, s.head + dt / STREAM_FALL_S);
    } else if (s.head > 0) {
      s.tail = Math.min(1, s.tail + dt / STREAM_FALL_S);
    }
    const streamOn = s.head > 0 && s.tail < 1;
    if (stream.current) {
      stream.current.visible = streamOn;
      if (streamOn) {
        const [lx, ly] = toWorld(-POUR_BEAKER.radius - 0.01, POUR_BEAKER.height);
        const tx = 0.3;
        const ty = FUNNEL_APEX_Y + FUNNEL.height * 0.55;
        for (let i = 0; i <= STREAM_SEGMENTS; i += 1) {
          // Distance fallen goes as t², so spacing the rings by u keeps them even along the drop.
          const u = lerp(s.tail, s.head, i / STREAM_SEGMENTS);
          streamPoints[i].set(lerp(lx, tx, Math.sqrt(u)), lerp(ly, ty, u), 0);
        }
        // The last trickle as the beaker empties is thinner than the full pour.
        shapeStream(streamGeo, streamPoints, clamp(left / 0.12, 0.35, 1));
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
    // Even clear filtrate should read as liquid in the flask.
    l.opacity = Math.max(0.34, r.filtrateOpacity);
    flaskSurface.current = flaskSurfaceY(l.fill);
    dripRate.current = active ? r.dripRate : 0;
    dripColour.current = r.filtrateColour;
  });

  return (
    <group position={[0, BENCH_Y, 0]}>
      <RetortStand position={[STAND_X, 0, 0]} height={FUNNEL_APEX_Y + FUNNEL.height + 1.2} fittings={[{ y: RING_Y, type: "ring", reach: -STAND_X - RING_R, radius: RING_R }]} />
      <RetortStand position={[CLAMP_STAND_X, 0, 0]} height={CLAMP_Y + 0.6} baseAngle={Math.PI} fittings={[{ y: CLAMP_Y, type: "clamp", reach: CLAMP_REACH, angle: Math.PI }]} />
      <group position={[0, PLATE_Y, 0]}>
        <ConicalFlask liquidRef={flaskLiquid} liquidColour="#c9e3ec" liquidOpacity={0.2} />
      </group>
      <group position={[0, FUNNEL_APEX_Y, 0]}>
        <Funnel residueRef={residue} />
      </group>
      <DripStream from={[0, FUNNEL_APEX_Y - FUNNEL.stemLength, 0]} surfaceRef={flaskSurface} rateRef={dripRate} colourRef={dripColour} animSpeed={animSpeed} />

      {/* The sample beaker in its clamp, tipping about the jaws to pour over the funnel. */}
      <group ref={beaker} position={[CLAMP_X, CLAMP_Y, 0]}>
        <group position={[0, -BEAKER_DROP, 0]}>
          {/* The glass only; the liquid is drawn level below. */}
          <Beaker radius={POUR_BEAKER.radius} height={POUR_BEAKER.height} liquidHeight={0.001} liquidOpacity={0} liquidRef={beakerLiquid} />
          <TippedLiquid surfacePlane={planes.surface} colour={sample.colour} opacity={sampleOpacity} />
        </group>
      </group>
      <mesh ref={surfaceDisc} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[POUR_BEAKER.radius - 0.035, 32]} />
        <meshStandardMaterial color={sample.colour} transparent opacity={Math.min(0.9, sampleOpacity + 0.15)} roughness={0.08} side={THREE.DoubleSide} depthWrite={false} clippingPlanes={[planes.base, planes.rim]} />
      </mesh>
      <mesh ref={stream} geometry={streamGeo} visible={false}>
        <meshStandardMaterial color={sample.colour} transparent opacity={Math.min(0.9, sampleOpacity + 0.1)} roughness={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Crystallisation ────────────────────────────────────────────────

const TRIPOD_H = 3.3;
/** The tripod's foot (0.04), the gauze and its ceramic centre, and the basin's foot ring, so it rests on the ceramic rather than in it. */
const BASIN_Y = TRIPOD_H + 0.04 + TRIPOD_TOP_CLEARANCE + 0.016;
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
    <group position={[0, BENCH_Y, 0]}>
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

const CHART = { x: 2.2, y: BENCH_Y + 0.55, z: 0.3, scale: 1.25, width: 1.5 };
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
        <meshBasicMaterial color="#1a2436" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <Line points={axis} color={PALETTE.line} lineWidth={1.4} />
      {tickLines.map((pts, i) => (
        <Line key={i} points={pts} color={PALETTE.line} lineWidth={0.8} transparent opacity={0.45} />
      ))}
      {ticks.map((t) => (
        <SepLabel key={t.mm} position={[-0.32, t.y, 0]} tone="text-ink-500">
          {`${t.mm} mm`}
        </SepLabel>
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
      {/* The formula heads the stack of Rf lines above the board. */}
      <SepLabel position={[CHART.width / 2 - 0.1, CHART_H + 0.55 + n * 0.34, 0]} accent>
        {"Rf = d(pigment) ÷ d(solvent front)"}
      </SepLabel>
      {/* The front's own label rides on the front line; the Rf list stacks beside the top of the board. */}
      {/* Only once the front is moving: parked on the baseline it sat on the "0 mm" tick. */}
      {/* Once clear of the "0 mm" tick — near the baseline the two sat on each other. */}
      {active && result.frontMm > 9 && (
        <SepLabel position={[CHART.width / 2 - 0.1, frontY + 0.16, 0.02]} tone="text-sky-300">
          {`solvent front ${result.frontMm.toFixed(1)} mm${result.finished ? " · done" : ""}`}
        </SepLabel>
      )}
      {active &&
        result.spots.map((spot, i) => (
          // Stacked above the board, centred on it: beside it, a leaf's four
          // long pigment names ran off the right of the frame.
          <SepLabel key={spot.key} position={[CHART.width / 2 - 0.1, CHART_H + 0.45 + (n - 1 - i) * 0.34, 0]} tone={spot.moves && spot.visible ? "text-ink-200" : "text-ink-500"}>
            {`${COMPONENTS[spot.key].label}: ${spot.moves ? `Rf ${rfText(spot, result.frontMm)}` : spot.visible ? "stays on the baseline" : "colourless"}`}
          </SepLabel>
        ))}
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

function createModel(station, mixture, solvent) {
  return { seconds: 0, station, mixture, solvent, results: {} };
}

/**
 * Where the camera frames each station: its centre and the width and top of
 * what must stay in view, labels included. Each apparatus has a very
 * different shape — a tall two-stand filtration rig, a burner and tripod, a
 * tank beside its chart — so each gets its own.
 */
const STATION_VIEW = {
  filtration: { cx: 0.35, width: 8.6, top: BENCH_Y + 8.35 },
  crystallization: { cx: 0, width: 7.2, top: BENCH_Y + 7.95 },
  chromatography: { cx: 1.4, width: 9.4, top: BENCH_Y + 8.65 },
};
const VIEW_BOTTOM = BENCH_Y - 2.2;
const FOV = 44;
const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180));
const VIEW_DIRECTION = new THREE.Vector3(0, 0.16, 1).normalize();

/** Frames the active station at the canvas aspect whenever the station or the canvas changes. */
function FitCamera({ station }) {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls);
  const aspect = useThree((st) => st.size.width / Math.max(st.size.height, 1));
  useEffect(() => {
    // A canvas measured before layout is 0 wide; fitting to it sends the camera to NaN.
    if (!(aspect > 0.05)) return;
    const v = STATION_VIEW[station];
    const height = v.top - VIEW_BOTTOM;
    const target = new THREE.Vector3(v.cx, (v.top + VIEW_BOTTOM) / 2, 0);
    const fit = Math.max(height / 2 / TAN_HALF_FOV, v.width / 2 / (TAN_HALF_FOV * aspect)) * 1.04;
    camera.position.copy(target).addScaledVector(VIEW_DIRECTION, fit);
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [camera, controls, aspect, station]);
  return null;
}

/** A label texture with the sample's name, for the reagent bottle. */
function useLabelTexture(text) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 160;
    const g = canvas.getContext("2d");
    g.fillStyle = "#fbfaf5";
    g.fillRect(0, 0, 256, 160);
    g.strokeStyle = "#c2410c";
    g.lineWidth = 6;
    g.strokeRect(8, 8, 240, 144);
    g.fillStyle = "#1f2937";
    g.textAlign = "center";
    g.font = "bold 30px sans-serif";
    const words = text.split(" ");
    const lines = [];
    let line = "";
    words.forEach((w) => {
      const next = line ? `${line} ${w}` : w;
      if (g.measureText(next).width > 220 && line) {
        lines.push(line);
        line = w;
      } else line = next;
    });
    lines.push(line);
    lines.slice(0, 3).forEach((l, i) => g.fillText(l, 128, 80 + (i - (Math.min(lines.length, 3) - 1) / 2) * 36));
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** The sample's stock bottle on the bench beside the apparatus: glass, a cap, a named label. */
function SampleBottle({ position, mixture, solvent }) {
  const M = MIXTURES[mixture];
  const look = useMemo(() => liquidAppearance(mixture, solvent), [mixture, solvent]);
  const label = useLabelTexture(M.short);
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 1.1, 24]} />
        <meshPhysicalMaterial color="#dbeaf2" transparent opacity={0.28} roughness={0.08} transmission={0.4} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.8, 24]} />
        <meshStandardMaterial color={look.colour} transparent opacity={Math.max(0.35, look.opacity)} roughness={0.2} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 0.22, 20]} />
        <meshPhysicalMaterial color="#dbeaf2" transparent opacity={0.3} roughness={0.08} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.2, 20]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.5} />
      </mesh>
      {/* The label wraps the front of the bottle, a whisker proud of the glass. */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.386, 0.386, 0.5, 24, 1, true, -0.9, 1.8]} />
        <meshStandardMaterial map={label ?? undefined} color="#ffffff" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Where the sample bottle stands at each station, clear of the apparatus. */
const BOTTLE_AT = {
  filtration: [3.6, BENCH_Y, 1.3],
  crystallization: [-2.9, BENCH_Y, 1.1],
  chromatography: [-2.3, BENCH_Y, 1.0],
};

const FIT_STYLE = {
  right: { mark: "✓", title: "Right tool", box: "border-emerald-400/60 bg-emerald-950/85", head: "text-emerald-300" },
  partly: { mark: "≈", title: "Only partly works", box: "border-amber-400/60 bg-amber-950/85", head: "text-amber-300" },
  wrong: { mark: "✗", title: "Wrong tool", box: "border-rose-400/60 bg-rose-950/85", head: "text-rose-300" },
};

/**
 * The first line above the station, bigger than the rest: whether this
 * station suits this sample, and where to take it if not. It judges the job,
 * so it is the same from the first second. (The reason is in the verdict
 * line below it and in the Details panel.)
 */
function FitBadge({ position, fit }) {
  const style = FIT_STYLE[fit.fit];
  const tryNext = fit.betterSolvent
    ? `try ${SOLVENTS[fit.betterSolvent].label.toLowerCase()} as the solvent`
    : fit.better.length
      ? `try ${fit.better.map((s) => STATIONS[s].label.toLowerCase()).join(" or ")}`
      : null;
  return (
    <Html position={position} center style={{ pointerEvents: "none" }} zIndexRange={[45, 0]}>
      <span className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold shadow-lg ${style.box} ${style.head}`}>
        <span aria-hidden>{style.mark}</span>
        <span>{`${style.title} for this sample`}</span>
        {tryNext && <span className="font-medium text-ink-200">{`· ${tryNext}`}</span>}
      </span>
    </Html>
  );
}

// "Show labels": provided inside the canvas (context does not cross the R3F
// boundary). The right/wrong-tool FitBadge is not a label and always shows.
const LabelsOn = createContext(true);
function SepLabel(props) {
  return useContext(LabelsOn) ? <SceneLabel {...props} /> : null;
}

export default function SeparationTechniquesCanvas({ params = {}, setParam }) {
  const { mixture = "sand_salt", solvent = "water", station = "filtration", restart = 0, speed = 1, liveSeconds = 0, showLabels = true } = params || {};
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

  const view = STATION_VIEW[stationKey];
  const titleX = view.cx;
  // Handed to the orbit controls too: SceneCanvas re-applies its target on
  // every render, and a fixed one kept dragging the fitted view off-centre.
  const orbitTarget = useMemo(() => [view.cx, (view.top + VIEW_BOTTOM) / 2, 0], [view]);

  const fit = useMemo(() => stationFit({ station: stationKey, mixture: mixKey, solvent: solKey }), [stationKey, mixKey, solKey]);

  return (
    <SceneCanvas camera={{ position: [0, 3.4, 16], fov: FOV }} controls={{ minDistance: 4, maxDistance: 30, target: orbitTarget }}>
      <LabelsOn.Provider value={showLabels !== false}>
      <FitCamera station={stationKey} />
      <StationClock modelRef={modelRef} station={stationKey} mixture={mixKey} solvent={solKey} restartToken={restart} animSpeed={speed} setParam={setParam} />

      <LabWall benchY={BENCH_Y} />
      <LabBench y={BENCH_Y} width={14} depth={7} colour="#a9b6c8" />
      <SampleBottle position={BOTTLE_AT[stationKey]} mixture={mixKey} solvent={solKey} />

      {/* One apparatus at a time: only the selected station is on the bench. */}
      {stationKey === "filtration" && <FiltrationStation modelRef={modelRef} mixture={mixKey} solvent={solKey} animSpeed={speed} />}
      {stationKey === "crystallization" && <CrystallizationStation modelRef={modelRef} mixture={mixKey} solvent={solKey} animSpeed={speed} />}
      {stationKey === "chromatography" && (
        <>
          <ChromatographyStation modelRef={modelRef} mixture={mixKey} solvent={solKey} animSpeed={speed} />
          <Chromatogram modelRef={modelRef} mixture={mixKey} solvent={solKey} result={result} animSpeed={speed} />
        </>
      )}

      {/* What is happening at the station, above it: first whether it is the right station at all. */}
      <FitBadge position={[titleX, view.top - 0.2, 0]} fit={fit} />
      <SepLabel position={[titleX, view.top - 0.64, 0]} accent>
        {`${STATIONS[stationKey].label} · ${M.label} · ${S.label} · ${STATIONS[stationKey].timeLapse}× time-lapse`}
      </SepLabel>
      <SepLabel position={[titleX, view.top - 1.04, 0]} tone="text-ink-300">
        {`${formatSeconds(liveSeconds)} · ${headline}`}
      </SepLabel>
      <SepLabel position={[titleX, view.top - 1.44, 0]} tone={FIT_STYLE[fit.fit].head}>
        {result.verdict}
      </SepLabel>
      <SepLabel position={[titleX, BENCH_Y - 0.5, 1.2]} tone="text-ink-400">
        {`separates by ${STATIONS[stationKey].property}`}
      </SepLabel>
      {result.station === "crystallization" && result.flammableWarning && (
        <SepLabel position={[CRYST_X, BENCH_Y - 1.1, 1.2]} tone="text-amber-300">
          {"ethanol is flammable — in a real lab this basin sits in a water bath, never over a naked flame"}
        </SepLabel>
      )}
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}
