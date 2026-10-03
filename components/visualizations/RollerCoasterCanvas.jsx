"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import {
  FollowCamera,
  SceneCanvas,
  SceneLabel,
  clamp,
} from "@/components/visualizations/scene-kit";
import { COASTER_CAR, CoasterCarModel } from "@/components/visualizations/coaster-car-model";
import { ENERGY_COLOURS } from "@/components/visualizations/energy-bars";
import {
  LOOP_OFFSET_M,
  buildTrack,
  describeRun,
  lateralAt,
  loopVerdict,
  minimumReleaseHeight,
  minimumTopSpeed,
  positionAt,
  startRun,
  stepRun,
} from "@/lib/coasterEnergy";

// ─── Roller coaster · conservation of energy ────────────────────────
// A drop, a vertical loop and a braking straight, with the energy budget drawn
// in a monitor dock and the cart's speed taken from that budget.
//
// Two things the scene is built to make undeniable: that the three bars always
// add to the same total, and that whether the cart survives the loop depends on
// the release height and the loop radius alone — the cart mass slider moves
// every energy in the chart and changes nothing about whether it makes it.
//
// The track and the car are drawn in METRES and scaled to the scene by one
// factor, so a rail, a wheel and a rider keep their real proportions to a
// 16 m loop whatever the sliders are set to.
// ─────────────────────────────────────────────────────────────────────

/** Half the distance between the two rails, metres. */
const HALF_GAUGE = 0.7;
/** Radius of a running rail's tube, metres. */
const RAIL_R = 0.16;
/** Track laid before the release point and after the brakes, metres. */
const LEAD_IN = 6;
const LEAD_OUT = 3;
/** Where the buffer's pad faces the car's nose when it reaches the end of the track. */
const BUFFER_X = 2.45;
/** Half the distance between the car's front and rear bogies, metres. */
const BOGIE_HALF = 0.95;
/** Gap between cross-ties, metres of track. */
const TIE_SPACING = 1.5;
/** Where a strut meets the inner side of its rail (across, up), and how far it drops to the spine, metres. */
const STRUT_TOP_Z = 0.56;
const STRUT_TOP_Y = -0.06;
const STRUT_DROP = 0.36;

// ─── Track geometry ─────────────────────────────────────────────────

/**
 * The track as it is DRAWN, in metres: the physics centreline with a level
 * lead-in before the release point and a run-off after the brakes (so the car
 * has rail under it at both ends), and the sideways step of the loop
 * (lib/coasterEnergy.js `lateralAt`) applied.
 */
function displayPath(track) {
  const out = [];
  const h0 = track.height[0];
  for (let d = LEAD_IN; d >= 1; d -= 1) out.push({ x: -d, y: h0, z: 0 });
  for (let i = 0; i < track.points.length; i += 1) {
    out.push({ x: track.points[i][0], y: track.points[i][1], z: lateralAt(track, track.s[i]) });
  }
  const xEnd = track.points[track.points.length - 1][0];
  for (let d = 1; d <= LEAD_OUT; d += 1) out.push({ x: xEnd + d, y: 0, z: LOOP_OFFSET_M });
  return out;
}

/** Unit tangent in the plane of the ride at point i of a path. */
function tangentOf(path, i) {
  const a = path[Math.max(i - 1, 0)];
  const c = path[Math.min(i + 1, path.length - 1)];
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { tx: dx / len, ty: dy / len };
}

const _q = new THREE.Quaternion();
const _qx = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);

/** Draws `matrices` as one instanced mesh, so a few hundred ties cost one draw call. */
function InstancedParts({ matrices, geometry, material, castShadow = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (matrices.length === 0) return null;
  return (
    <instancedMesh
      key={matrices.length}
      ref={ref}
      args={[geometry, material, matrices.length]}
      frustumCulled={false}
      castShadow={castShadow}
    />
  );
}

/**
 * The rails, the spine beneath them, and the cross-ties and V-struts that
 * join the three.
 */
function Track({ track, scale, showDanger = false }) {
  const k = scale;

  const built = useMemo(() => {
    const path = displayPath(track);
    const P = path.map((p) => new THREE.Vector3(p.x * k, p.y * k, p.z * k));
    const g = HALF_GAUGE * k;

    const rails = [-1, 1].map(
      (side) =>
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(P.map((p) => new THREE.Vector3(p.x, p.y, p.z + side * g))),
          P.length,
          RAIL_R * k,
          8,
          false,
        ),
    );

    // The spine runs below the ties, on the far side of the track from the car.
    const spinePts = P.map((p, i) => {
      const { tx, ty } = tangentOf(path, i);
      return new THREE.Vector3(p.x + ty * 0.52 * k, p.y - tx * 0.52 * k, p.z);
    });
    const spine = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spinePts), P.length, 0.2 * k, 8, false);

    // Cross-ties and struts, one set every TIE_SPACING metres of track.
    const ties = [];
    const struts = [];
    let travelled = TIE_SPACING;
    for (let i = 1; i < path.length; i += 1) {
      travelled += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      if (travelled < TIE_SPACING) continue;
      travelled = 0;
      const { tx, ty } = tangentOf(path, i);
      const angle = Math.atan2(ty, tx);
      _q.setFromAxisAngle(_v.set(0, 0, 1), angle);
      const nx = -ty;
      const ny = tx;
      const drop = 0.24 * k;
      ties.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(P[i].x - nx * drop, P[i].y - ny * drop, P[i].z),
          _q.clone(),
          _one,
        ),
      );
      // V-struts from the inner side of each rail down to the spine: the
      // outer side and the underside are left clear for the car's guide and
      // upstop wheels.
      const tilt = Math.atan2(STRUT_TOP_Z, STRUT_DROP);
      for (const side of [-1, 1]) {
        _qx.setFromAxisAngle(_v.set(1, 0, 0), side * tilt);
        const q = _q.clone().multiply(_qx);
        const local = new THREE.Vector3(0, (STRUT_TOP_Y - STRUT_DROP / 2) * k, (side * STRUT_TOP_Z * k) / 2);
        local.applyQuaternion(_q);
        struts.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(P[i].x + local.x, P[i].y + local.y, P[i].z + local.z),
            q,
            _one,
          ),
        );
      }
    }

    // Ties run between the rails, not under them, for the same reason.
    const tieGeo = new THREE.BoxGeometry(0.22 * k, 0.16 * k, 2 * (HALF_GAUGE - 0.08) * k);
    const strutGeo = new THREE.CylinderGeometry(0.035 * k, 0.035 * k, Math.hypot(STRUT_TOP_Z, STRUT_DROP) * k, 6);

    return { rails, spine, ties, struts, tieGeo, strutGeo };
  }, [track, k]);

  useEffect(
    () => () => {
      built.rails.forEach((g) => g.dispose());
      built.spine.dispose();
    },
    [built],
  );

  const materials = useMemo(
    () => ({
      rail: new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.16, metalness: 0.96 }),
      spine: new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.28, metalness: 0.85 }),
      tie: new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.4, metalness: 0.7 }),
      strut: new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.3, metalness: 0.8 }),
    }),
    [],
  );

  useEffect(() => () => Object.values(materials).forEach((mat) => mat.dispose()), [materials]);

  /** The stretch of loop the cart cannot hold, drawn in warning colour. */
  const danger = useMemo(() => {
    if (!showDanger) return null;
    const pts = [];
    for (let i = 0; i <= 60; i += 1) {
      const at = track.loopEntryS + ((track.loopExitS - track.loopEntryS) * i) / 60;
      const [x, y] = positionAt(track, at);
      pts.push([x * k, y * k, lateralAt(track, at) * k]);
    }
    return pts;
  }, [showDanger, track, k]);

  return (
    <group>
      {built.rails.map((g, i) => (
        <mesh key={`rail-${i}`} geometry={g} material={materials.rail} castShadow />
      ))}
      <mesh geometry={built.spine} material={materials.spine} castShadow />
      <InstancedParts matrices={built.ties} geometry={built.tieGeo} material={materials.tie} />
      <InstancedParts matrices={built.struts} geometry={built.strutGeo} material={materials.strut} />

      {danger && <Line points={danger} color={ENERGY_COLOURS.thermal} lineWidth={5} transparent opacity={0.85} />}
    </group>
  );
}

/** A steel column on a concrete footing, from the ground up to height `h`. */
function Column({ x, z = 0, h, k }) {
  const w = 0.4 * k;
  return (
    <group position={[x * k, 0, z * k]}>
      <mesh position={[0, 0.3 * k, 0]}>
        <boxGeometry args={[1.3 * k, 0.6 * k, 1.3 * k]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, (h * k) / 2 + 0.3 * k, 0]}>
        <boxGeometry args={[w, Math.max(h * k - 0.6 * k, 0.05), w]} />
        <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.65} />
      </mesh>
      <mesh position={[0, h * k - 0.35 * k, 0]}>
        <boxGeometry args={[0.7 * k, 0.16 * k, 0.7 * k]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

/**
 * Steel columns under the drop and the station, and one at each side of the
 * loop, where its rail is running straight up or down and a column can meet it.
 */
function Supports({ track, scale }) {
  const columns = useMemo(() => {
    const out = [];
    const path = displayPath(track);
    let arc = 0;
    let since = 0;
    for (let i = 1; i < path.length; i += 1) {
      const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      arc += d;
      since += d;
      // The physics' arc position: the lead-in comes first, then the track.
      const s = arc - LEAD_IN;
      const inLoop = s > track.loopEntryS - 3 && s < track.loopExitS + 3;
      if (since < 4 || inLoop || path[i].y < 0.8) continue;
      since = 0;
      out.push({ x: path[i].x, z: path[i].z, h: path[i].y });
    }
    // The loop's two extreme points (rail vertical there), on the ground.
    const R = track.loopRadius;
    const xLoop = positionAt(track, track.loopEntryS)[0];
    for (const [frac, extreme] of [[0.25, R], [0.75, -R]]) {
      const at = track.loopEntryS + (track.loopExitS - track.loopEntryS) * frac;
      out.push({ x: xLoop + extreme, z: lateralAt(track, at), h: R });
    }
    return out;
  }, [track]);

  return (
    <group>
      {columns.map((c, i) => (
        <Column key={i} x={c.x} z={c.z} h={c.h} k={scale} />
      ))}
    </group>
  );
}

/** The station deck under the release point and the buffer stop at the far end. */
function Furniture({ track, scale }) {
  const k = scale;
  const h0 = track.height[0];
  const xEnd = track.points[track.points.length - 1][0] + BUFFER_X;
  return (
    <group>
      <mesh position={[(-LEAD_IN * k) / 2, (h0 - 1.1) * k, 0]}>
        <boxGeometry args={[LEAD_IN * k + 1.2 * k, 0.3 * k, 3 * k]} />
        <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Buffer stop */}
      <group position={[xEnd * k, 0.5 * k, LOOP_OFFSET_M * k]}>
        <mesh>
          <boxGeometry args={[0.5 * k, 1.0 * k, 2.2 * k]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[-0.28 * k, 0, 0]}>
          <boxGeometry args={[0.1 * k, 0.4 * k, 2.0 * k]} />
          <meshStandardMaterial color="#fde68a" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// ─── The coaster car ────────────────────────────────────────────────
// Our own model (scripts/coaster-model → coaster-car-model.jsx), drawn in
// metres with x forward, y up and z across, on rails at z = ±HALF_GAUGE.

/**
 * Where the car is: each bogie sits on the rail at its own point, and the body
 * takes the position and angle of the line between them — as a real car does,
 * and the reason it stays on a small loop that a car placed by one point and
 * one tangent would not.
 */
function pathPoint(track, s) {
  if (s < 0) return [s, track.height[0]];
  if (s > track.length) return [track.points[track.points.length - 1][0] + (s - track.length), 0];
  return positionAt(track, s);
}

function CartRunner({ track, mass, friction, running, speed = 1, resetKey, scale, onSample, anchorRef }) {
  const cart = useRef(null);
  // the distance run, for the wheels to roll by
  const travel = useRef(0);
  const state = useRef(startRun({ track, mass }));
  const since = useRef(0);

  useEffect(() => {
    state.current = startRun({ track, mass });
    onSample(describeRun({ track, state: state.current, mass }), state.current);
  }, [track, mass, resetKey, onSample]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const dt = delta * speed;
    if (running && speed > 0) {
      // Small fixed steps, so a fast cart on a fast-forward still meets every
      // stretch of the loop (the derailment check samples where it is).
      const steps = clamp(Math.ceil(dt / 0.004), 1, 40);
      for (let i = 0; i < steps; i += 1) {
        state.current = stepRun(state.current, track, { mass, friction }, dt / steps);
      }
    }

    travel.current = state.current.s;
    if (cart.current) {
      const s = state.current.s;
      const [fx, fy] = pathPoint(track, s + BOGIE_HALF);
      const [rx, ry] = pathPoint(track, s - BOGIE_HALF);
      const angle = Math.atan2(fy - ry, fx - rx);
      const z = lateralAt(track, clamp(s, 0, track.length));
      cart.current.position.set(((fx + rx) / 2) * scale, ((fy + ry) / 2) * scale, z * scale);
      cart.current.rotation.z = angle;
    }

    since.current += delta;
    if (since.current >= 1 / 15) {
      since.current = 0;
      if (running) onSample(describeRun({ track, state: state.current, mass }), state.current);
    }
  });

  return (
    <group ref={cart} scale={[scale, scale, scale]}>
      <Suspense fallback={null}>
        <CoasterCarModel travelRef={travel} />
      </Suspense>
      {/* What the follow camera chases and rides on: the car's middle, at seat height */}
      <group ref={anchorRef} position={[0, COASTER_CAR.floor + 0.3, 0]} />
    </group>
  );
}

// ─── Monitor dock ───────────────────────────────────────────────────

/** A 270° dial: `frac` of the way round, with the reading in the middle. */
function Dial({ frac, colour, children }) {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#334155" strokeWidth="3.5" strokeDasharray="100" strokeDashoffset="25" />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke={colour}
          strokeWidth="3.5"
          strokeDasharray="100"
          strokeDashoffset={100 - clamp(frac, 0, 1) * 75}
          strokeLinecap="round"
          className="transition-all duration-100"
        />
      </svg>
      <div className="absolute text-center">{children}</div>
    </div>
  );
}

/** A section of the dock with its own fold-away header. */
function DockSection({ title, icon, summary, open, onToggle, children }) {
  return (
    <div className="min-w-[230px] flex-1 rounded-xl border border-slate-700/70 bg-slate-800/60 px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          {icon}
          {title}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
          {!open && summary}
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

const VERDICTS = {
  derailed: { tone: "rose", icon: AlertTriangle },
  "too-low": { tone: "amber", icon: AlertTriangle },
  friction: { tone: "amber", icon: AlertTriangle },
  clears: { tone: "emerald", icon: CheckCircle2 },
  cleared: { tone: "emerald", icon: CheckCircle2 },
};
const TONES = {
  rose: "border-rose-500/40 bg-rose-500/20 text-rose-300",
  amber: "border-amber-500/40 bg-amber-500/20 text-amber-300",
  emerald: "border-emerald-500/40 bg-emerald-500/20 text-emerald-300",
};

function verdictText(code, live, minHeight) {
  switch (code) {
    case "derailed":
      return "Derailed: too slow at the top of the loop (v < √(g·R))";
    case "too-low":
      return `Release too low (minimum 2.5 R = ${minHeight.toFixed(1)} m)`;
    case "friction":
      return `Friction has drained it: ${live.topSpeed.toFixed(1)} m/s at the top, needs ${live.neededTopSpeed.toFixed(1)} m/s`;
    case "clears":
      return `Clears the loop (${live.topSpeed.toFixed(1)} m/s at the top, needs ${live.neededTopSpeed.toFixed(1)} m/s)`;
    default:
      return "Round the loop";
  }
}

/**
 * The live readouts, docked at the bottom of the scene.
 *
 * It folds away — as a whole into one line, or a section at a time — because
 * on a narrow window it wraps to a card that covers most of the track.
 */
function MonitorDock({ live, total, verdict, minHeight, friction, maxSpeed }) {
  const [open, setOpen] = useState(true);
  const [energyOpen, setEnergyOpen] = useState(true);
  const [motionOpen, setMotionOpen] = useState(true);

  const pct = (v) => (total > 0 ? clamp((v / total) * 100, 0, 100) : 0);
  const gpePct = pct(live.gpe);
  const kePct = pct(live.ke);
  const thPct = pct(live.thermal);

  // −2 g to +8 g across the dial.
  const gWarning = live.gForce > 5 || live.gForce < 0;
  const v = VERDICTS[verdict] ?? VERDICTS.clears;
  const VerdictIcon = v.icon;
  const text = verdictText(verdict, live, minHeight);

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex w-[min(94%,760px)] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-2.5 shadow-2xl backdrop-blur-md">
      {/* Header: always visible, and the whole dock in one line when folded */}
      <div className="flex items-center gap-2">
        <div className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${TONES[v.tone]}`}>
          <VerdictIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{text}</span>
        </div>
        {!open && (
          <span className="hidden shrink-0 font-mono text-[11px] text-slate-300 sm:inline">
            {live.speed.toFixed(1)} m/s · {live.gForce.toFixed(1)} g
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-slate-700"
          title={open ? "Fold the monitor away" : "Open the monitor"}
          aria-expanded={open}
        >
          Monitor
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open && (
        <>
          <div className="flex flex-wrap gap-2">
            {/* ── Energy budget: three stores that always sum to the total ── */}
            <DockSection
              title="Energy budget"
              icon={<Zap className="h-3.5 w-3.5 text-duck-400" />}
              summary={`${(total / 1000).toFixed(1)} kJ`}
              open={energyOpen}
              onToggle={() => setEnergyOpen((o) => !o)}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Total</span>
                <span className="font-mono font-bold text-duck-300">{(total / 1000).toFixed(1)} kJ</span>
              </div>
              <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full border border-slate-700/80 bg-slate-800">
                <div className="h-full transition-all duration-100" style={{ width: `${gpePct}%`, backgroundColor: ENERGY_COLOURS.gpe }} title={`GPE ${(live.gpe / 1000).toFixed(1)} kJ`} />
                <div className="h-full transition-all duration-100" style={{ width: `${kePct}%`, backgroundColor: ENERGY_COLOURS.kinetic }} title={`KE ${(live.ke / 1000).toFixed(1)} kJ`} />
                <div className="h-full transition-all duration-100" style={{ width: `${thPct}%`, backgroundColor: ENERGY_COLOURS.thermal }} title={`Thermal ${(live.thermal / 1000).toFixed(1)} kJ`} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                <span className="flex items-center gap-1" style={{ color: ENERGY_COLOURS.gpe }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ENERGY_COLOURS.gpe }} />
                  GPE {(live.gpe / 1000).toFixed(1)}k
                </span>
                <span className="flex items-center gap-1" style={{ color: ENERGY_COLOURS.kinetic }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ENERGY_COLOURS.kinetic }} />
                  KE {(live.ke / 1000).toFixed(1)}k
                </span>
                <span className="flex items-center gap-1" style={{ color: ENERGY_COLOURS.thermal }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ENERGY_COLOURS.thermal }} />
                  Heat {(live.thermal / 1000).toFixed(1)}k
                </span>
              </div>
            </DockSection>

            {/* ── Speed and g-force ── */}
            <DockSection
              title="Speed · g-force"
              summary={`${live.speed.toFixed(0)} m/s · ${live.gForce.toFixed(1)} g`}
              open={motionOpen}
              onToggle={() => setMotionOpen((o) => !o)}
            >
              <div className="flex items-center justify-around gap-3">
                <div className="flex items-center gap-2">
                  <Dial frac={live.speed / maxSpeed} colour="#10b981">
                    <span className="block font-mono text-xs font-bold text-emerald-300">{live.speed.toFixed(0)}</span>
                  </Dial>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Speed</span>
                    <span className="font-mono text-xs font-bold text-slate-200">
                      {live.speed.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">m/s</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Dial frac={(clamp(live.gForce, -2, 8) + 2) / 10} colour={gWarning ? "#f43f5e" : "#38bdf8"}>
                    <span className={`block font-mono text-xs font-bold ${gWarning ? "text-rose-400" : "text-sky-300"}`}>
                      {live.gForce.toFixed(1)}
                    </span>
                  </Dial>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">g-force</span>
                    <span className={`font-mono text-xs font-bold ${gWarning ? "text-rose-400" : "text-slate-200"}`}>
                      {live.gForce.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">g</span>
                    </span>
                  </div>
                </div>
              </div>
              {live.gForce > 5 && (
                <div className="mt-2 text-[10px] leading-snug text-amber-300">
                  {live.gForce.toFixed(1)} g is far more than real coasters allow (about 4–5 g, and only briefly) —
                  the circular loop is what does it.
                </div>
              )}
            </DockSection>
          </div>
          <div className="px-1 text-[10px] text-slate-400">
            {friction ? "Steel-on-steel friction on: energy leaks into the heat bar and never returns" : "Frictionless theoretical model"}
          </div>
        </>
      )}
    </div>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

/** The overview framing, which the camera glides back to from the car. */
const COASTER_HOME = { position: [1.8, 0.4, 19.5], target: [1.8, -0.3, 0] };

export default function RollerCoasterCanvas({ params = {} }) {
  const {
    releaseHeight = 25,
    loopRadius = 8,
    cartMass = 500,
    friction = false,
    running = true,
    speed = 1,
    relaunch = 0,
    camera = "overview",
  } = params || {};
  const anchorRef = useRef(null);

  const track = useMemo(
    () => buildTrack({ releaseHeight, loopRadius }),
    [releaseHeight, loopRadius],
  );

  const [live, setLive] = useState(() =>
    describeRun({ track, state: startRun({ track, mass: cartMass }), mass: cartMass }),
  );
  const onSample = useCallback((described) => setLive(described), []);

  const xEnd = track.points[track.points.length - 1][0];
  // Metres to scene units: the whole drawn track, lead-in and run-off included,
  // fits the view, and so does the tallest thing on it.
  const scale = useMemo(() => {
    const width = xEnd + LEAD_IN + LEAD_OUT;
    const tallest = Math.max(releaseHeight, 2 * loopRadius);
    return Math.min(15.5 / Math.max(width, 1), 6.4 / Math.max(tallest, 1));
  }, [xEnd, releaseHeight, loopRadius]);

  const minHeight = minimumReleaseHeight(loopRadius);
  const clears = releaseHeight >= minHeight;
  const verdict = loopVerdict(live, { friction, clears });

  const total = live.gpe + live.ke + live.thermal;
  // Centre the drawn track (lead-in to run-off, and its 2.2 m sideways step) on
  // the point the camera looks at.
  const centreX = ((xEnd + LEAD_OUT - LEAD_IN) * scale) / 2;
  const xLoop = positionAt(track, track.loopEntryS)[0];
  const maxSpeed = Math.max(10, Math.ceil(Math.sqrt(2 * 9.81 * releaseHeight) / 5) * 5);

  const left = -LEAD_IN * scale;
  const right = (xEnd + LEAD_OUT) * scale;

  return (
    <div className="relative h-full w-full">
      <SceneCanvas
        environment
        camera={{ position: COASTER_HOME.position, fov: 46 }}
        // Following the car needs to come in closer than the overview allows.
        controls={{ minDistance: camera === "overview" ? 6 : 0.5, maxDistance: 48 }}
        lights={{ ambient: 0.58, keyLight: 1.05 }}
      >
        <group position={[-centreX + 1.8, -0.4, 0]}>
          {/* Ground: a slate base with a polished aluminium top plate */}
          <group position={[(left + right) / 2, -0.06, LOOP_OFFSET_M * scale * 0.5]}>
            <mesh receiveShadow>
              <boxGeometry args={[right - left + 3.6, 0.12, 3.6]} />
              <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.35} />
            </mesh>
            <mesh position={[0, 0.065, 0]} receiveShadow>
              <boxGeometry args={[right - left + 3.4, 0.01, 3.4]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.65} />
            </mesh>
            {[1, -1].map((side) => (
              <mesh key={side} position={[0, 0.072, side * 1.68]}>
                <boxGeometry args={[right - left + 3.4, 0.005, 0.04]} />
                <meshStandardMaterial color="#eab308" roughness={0.4} />
              </mesh>
            ))}
          </group>

          <Supports track={track} scale={scale} />
          <Track track={track} scale={scale} showDanger={Boolean(live.leftTrack)} />
          <Furniture track={track} scale={scale} />

          <CartRunner
            track={track}
            mass={cartMass}
            friction={friction}
            running={running}
            speed={speed}
            resetKey={relaunch}
            scale={scale}
            onSample={onSample}
            anchorRef={anchorRef}
          />

          {/* Theoretical minimum release height */}
          <Line
            points={[
              [left, minHeight * scale, 0],
              [right, minHeight * scale, 0],
            ]}
            color={clears ? ENERGY_COLOURS.workOut : ENERGY_COLOURS.thermal}
            lineWidth={1.8}
            transparent
            opacity={0.8}
            dashed
            dashSize={0.16}
            gapSize={0.12}
          />
          {/* Over the brakes, where the sky is empty — not off the end of the line */}
          <SceneLabel
            position={[(xEnd - 4) * scale, minHeight * scale + 0.32, 0]}
            tone={clears ? "text-emerald-300" : "text-rose-300"}
          >
            {`2.5 R = ${minHeight.toFixed(1)} m minimum`}
          </SceneLabel>

          {/* Release height, beside the station */}
          <SceneLabel position={[left - 0.5, releaseHeight * scale, 0]} accent>
            {`${releaseHeight} m`}
          </SceneLabel>

          {/* Loop callout, centred over the loop itself */}
          <SceneLabel position={[xLoop * scale, 2 * loopRadius * scale + 0.6, LOOP_OFFSET_M * scale * 0.5]} tone="text-ink-300">
            {`loop R = ${loopRadius} m · needs ${minimumTopSpeed(loopRadius).toFixed(1)} m/s at the top`}
          </SceneLabel>
        </group>
        {/* Overview, chasing the car, or riding in its front row: eye and gaze
            are in the car's own frame (metres), so they hold at any scale. Mounted
            after the car, so it reads where the car is this frame, not last frame */}
        <FollowCamera
          mode={camera}
          targetRef={anchorRef}
          distance={9 * scale}
          home={COASTER_HOME}
          eye={[COASTER_CAR.eye[0], COASTER_CAR.eye[1] - COASTER_CAR.floor - 0.3, COASTER_CAR.eye[2]]}
          look={[COASTER_CAR.eye[0] + 6, COASTER_CAR.eye[1] - COASTER_CAR.floor - 1.5, COASTER_CAR.eye[2]]}
          near={0.05 * scale}
          resetKey={relaunch}
        />
      </SceneCanvas>

      <MonitorDock
        live={live}
        total={total}
        verdict={verdict}
        minHeight={minHeight}
        friction={friction}
        maxSpeed={maxSpeed}
      />
    </div>
  );
}
