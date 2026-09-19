"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Gauge,
  Zap,
} from "lucide-react";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
} from "@/components/visualizations/scene-kit";
import { ENERGY_COLOURS } from "@/components/visualizations/energy-bars";
import {
  buildTrack,
  describeRun,
  minimumReleaseHeight,
  minimumTopSpeed,
  positionAt,
  sampleAt,
  startRun,
  stepRun,
} from "@/lib/coasterEnergy";

// ─── Roller coaster · conservation of energy ────────────────────────
// A drop, a vertical loop and a braking straight, with the energy budget drawn
// in a high-contrast bottom bar HUD and the cart's speed taken from that budget.
//
// Two things the scene is built to make undeniable: that the three bars always
// add to the same total, and that whether the cart survives the loop depends on
// the release height and the loop radius alone — the cart mass slider moves
// every energy in the chart and changes nothing about whether it makes it.
// ─────────────────────────────────────────────────────────────────────

// ─── Rails & Track Structure ────────────────────────────────────────

/**
 * High-detail roller coaster track:
 * - Dual polished chrome running rails
 * - Central tubular spine / backbone pipe
 * - Welded triangular web cross-ties connecting rails and spine
 */
function Track({ track, scale, showDanger = false }) {
  const { rails, spine, sleepers, webStruts } = useMemo(() => {
    const pts = track.points.map(([x, y]) => new THREE.Vector3(x * scale, y * scale, 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    const gauge = 0.17;

    // Dual running rails
    const builtRails = [-1, 1].map((side) => {
      const offset = pts.map((p) => new THREE.Vector3(p.x, p.y, p.z + side * gauge));
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(offset), pts.length, 0.034, 8, false);
    });

    // Central tubular backbone spine (slightly beneath the rail plane)
    const spinePts = pts.map((p, i) => {
      const ahead = pts[Math.min(i + 1, pts.length - 1)];
      const behind = pts[Math.max(i - 1, 0)];
      const dir = new THREE.Vector3().subVectors(ahead, behind).normalize();
      const normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
      // Offset inward along track normal
      return new THREE.Vector3().addVectors(p, normal.clone().multiplyScalar(-0.08));
    });
    const builtSpine = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spinePts), pts.length, 0.048, 8, false);

    // Welded cross-ties and triangular web struts
    const ties = [];
    const struts = [];
    const stride = Math.max(Math.floor(track.points.length / 85), 1);

    for (let i = 0; i < track.points.length - 1; i += stride) {
      const a = track.points[i];
      const b = track.points[Math.min(i + 1, track.points.length - 1)];
      const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);

      ties.push({
        position: [a[0] * scale, a[1] * scale, 0],
        rotation: angle,
      });

      // Normal direction pointing down into track spine
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      struts.push({
        position: [a[0] * scale - nx * 0.04, a[1] * scale - ny * 0.04, 0],
        rotation: angle,
      });
    }

    return { rails: builtRails, spine: builtSpine, sleepers: ties, webStruts: struts, curve };
  }, [track, scale]);

  useEffect(() => {
    return () => {
      rails.forEach((g) => g.dispose());
      spine.dispose();
    };
  }, [rails, spine]);

  /** The stretch of loop the cart cannot hold, drawn in warning colour */
  const danger = useMemo(() => {
    if (!showDanger) return null;
    const pts = [];
    for (let i = 0; i <= 40; i += 1) {
      const at = track.loopEntryS + ((track.loopExitS - track.loopEntryS) * i) / 40;
      const [x, y] = positionAt(track, at);
      pts.push([x * scale, y * scale, 0]);
    }
    return pts;
  }, [showDanger, track, scale]);

  return (
    <group>
      {/* Running Rails (Bright Polished Chrome / Stainless Steel) */}
      {rails.map((g, i) => (
        <mesh key={`rail-${i}`} geometry={g} castShadow>
          <meshStandardMaterial color="#f8fafc" roughness={0.16} metalness={0.96} />
        </mesh>
      ))}

      {/* Central Backbone Spine Tube */}
      <mesh geometry={spine} castShadow>
        <meshStandardMaterial color="#94a3b8" roughness={0.28} metalness={0.85} />
      </mesh>

      {/* Cross-ties across rails */}
      {sleepers.map((tie, i) => (
        <mesh key={`tie-${i}`} position={tie.position} rotation={[0, 0, tie.rotation]}>
          <boxGeometry args={[0.048, 0.038, 0.42]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.7} />
        </mesh>
      ))}

      {/* Triangular web gusset struts connecting rails to central spine */}
      {webStruts.map((strut, i) => (
        <group key={`strut-${i}`} position={strut.position} rotation={[0, 0, strut.rotation]}>
          {[-0.14, 0.14].map((zOffset) => (
            <mesh key={`s-${zOffset}`} position={[0, -0.02, zOffset / 2]} rotation={[Math.PI / 4 * Math.sign(zOffset), 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {danger && <Line points={danger} color={ENERGY_COLOURS.thermal} lineWidth={5} transparent opacity={0.85} />}
    </group>
  );
}

/** Structural columns with engineered concrete footing piers anchored to ground */
function Supports({ track, scale }) {
  const columns = useMemo(() => {
    const out = [];
    const stride = Math.max(Math.floor(track.points.length / 26), 1);
    for (let i = 0; i < track.points.length; i += stride) {
      const [x, y] = track.points[i];
      if (track.s[i] > track.loopEntryS - 2 && track.s[i] < track.loopExitS + 2) continue;
      if (y < 0.4) continue;
      out.push({ x: x * scale, h: y * scale });
    }
    return out;
  }, [track, scale]);

  return (
    <group>
      {columns.map((c, i) => (
        <group key={i} position={[c.x, 0, 0]}>
          {/* Concrete Footing Pier at base */}
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[0.26, 0.14, 0.26]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0.15} />
          </mesh>
          {/* Steel anchor base plate */}
          <mesh position={[0, 0.145, 0]}>
            <boxGeometry args={[0.18, 0.02, 0.18]} />
            <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.85} />
          </mesh>
          {/* Corner foundation anchor bolts */}
          {[-0.07, 0.07].map((bx) =>
            [-0.07, 0.07].map((bz) => (
              <mesh key={`ab-${bx}-${bz}`} position={[bx, 0.16, bz]}>
                <cylinderGeometry args={[0.012, 0.012, 0.02, 8]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
              </mesh>
            )),
          )}

          {/* Upright Steel Column Column */}
          <mesh position={[0, c.h / 2 + 0.08, 0]}>
            <boxGeometry args={[0.075, c.h - 0.14, 0.075]} />
            <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.65} />
          </mesh>
          {/* Top connection flange collar */}
          <mesh position={[0, c.h + 0.01, 0]}>
            <boxGeometry args={[0.11, 0.03, 0.11]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── The Coaster Car ────────────────────────────────────────────────

/**
 * Aerodynamic roller coaster car with 3-wheel safety bogies
 * (running wheels, side friction wheels, and up-stop wheels),
 * twin LED headlights, passenger figurines, and safety restraint lap bars.
 */
function CartRunner({ track, mass, friction, running, speed = 1, resetKey, scale, onSample }) {
  const cart = useRef(null);
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
      for (let i = 0; i < 4; i += 1) {
        state.current = stepRun(state.current, track, { mass, friction }, dt / 4);
      }
    }

    const [x, y] = positionAt(track, state.current.s);
    if (cart.current) {
      const ahead = positionAt(track, Math.min(state.current.s + 0.6, track.length));
      const behind = positionAt(track, Math.max(state.current.s - 0.6, 0));
      const angle = Math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]);

      // Cart rides on track: normal points into car floor
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      cart.current.position.set(x * scale + nx * 0.16, y * scale + ny * 0.16, 0);
      cart.current.rotation.z = angle;
    }

    since.current += delta;
    if (since.current >= 1 / 15) {
      since.current = 0;
      if (running) onSample(describeRun({ track, state: state.current, mass }), state.current);
    }
  });

  return (
    <group ref={cart}>
      {/* ── 1. Aerodynamic Main Body Shell ── */}
      <RoundedBox args={[0.56, 0.19, 0.32]} radius={0.045} smoothness={3}>
        <meshStandardMaterial
          color="#f59e0b"
          roughness={0.22}
          metalness={0.6}
        />
      </RoundedBox>

      {/* Aerodynamic Sloped Nose Fairing */}
      <mesh position={[0.31, -0.01, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.13, 0.18, 16]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.2} metalness={0.65} />
      </mesh>

      {/* Front Sculpted Carbon-Composite Chin Splitter */}
      <RoundedBox position={[0.32, -0.09, 0]} args={[0.18, 0.015, 0.36]} radius={0.005} smoothness={2}>
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.5} />
      </RoundedBox>

      {/* Front Dual Radiator Air Scoops / Grille */}
      <mesh position={[0.29, -0.03, 0]}>
        <boxGeometry args={[0.03, 0.045, 0.22]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0.292, -0.03, 0]}>
        <boxGeometry args={[0.032, 0.047, 0.02]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.25} metalness={0.6} />
      </mesh>

      {/* Aerodynamic Flank Side-Skirts & Racing Accent Pinstripes */}
      {[-0.165, 0.165].map((fz) => (
        <group key={`skirt-${fz}`}>
          {/* Lower rocker panel skirt */}
          <mesh position={[0, -0.085, fz]}>
            <boxGeometry args={[0.54, 0.018, 0.014]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* Cyan metallic team livery stripe */}
          <mesh position={[0, 0.01, fz]}>
            <boxGeometry args={[0.50, 0.012, 0.008]} />
            <meshStandardMaterial color="#0284c7" roughness={0.25} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Tinted Aerodynamic Windshield Canopy */}
      <mesh position={[0.12, 0.13, 0]} rotation={[0, 0, -Math.PI / 8]}>
        <boxGeometry args={[0.18, 0.10, 0.28]} />
        <meshStandardMaterial color="#0284c7" transparent opacity={0.55} roughness={0.1} />
      </mesh>
      {/* Windshield upper cowl frame */}
      <mesh position={[0.18, 0.105, 0]} rotation={[0, 0, -Math.PI / 8]}>
        <boxGeometry args={[0.02, 0.015, 0.284]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* ── 2. Rear High-Downforce Airfoil Wing & Diffuser ── */}
      {/* Wing Vertical Endplate Pylons */}
      {[-0.13, 0.13].map((wz) => (
        <mesh key={`wing-pylon-${wz}`} position={[-0.27, 0.13, wz]}>
          <boxGeometry args={[0.06, 0.12, 0.014]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}
      {/* Inverted Aerodynamic Wing Element */}
      <mesh position={[-0.28, 0.195, 0]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.09, 0.016, 0.38]} />
        <meshStandardMaterial color="#d97706" roughness={0.22} metalness={0.65} />
      </mesh>
      {/* Wing Endplate Winglets */}
      {[-0.19, 0.19].map((wz) => (
        <mesh key={`winglet-${wz}`} position={[-0.28, 0.20, wz]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.11, 0.045, 0.008]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}

      {/* Underbody Venturi Diffuser Fins */}
      {[-0.08, 0, 0.08].map((dz) => (
        <mesh key={`diffuser-${dz}`} position={[-0.26, -0.085, dz]}>
          <boxGeometry args={[0.08, 0.025, 0.008]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} />
        </mesh>
      ))}

      {/* ── 3. Cockpit Tub, Bucket Seats & Roll Hoops ── */}
      {/* Cockpit Interior Well */}
      <mesh position={[-0.04, 0.07, 0]}>
        <boxGeometry args={[0.36, 0.06, 0.26]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>

      {/* Dashboard Console & Coaster Grab Rail */}
      <mesh position={[0.15, 0.09, 0]}>
        <boxGeometry args={[0.03, 0.04, 0.22]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
      <mesh position={[0.14, 0.115, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.20, 10]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.85} />
      </mesh>

      {/* Passenger Cockpit Setup */}
      {[-0.14, 0.06].map((dx, pIdx) => (
        <group key={`rider-${pIdx}`} position={[dx, 0.10, 0]}>
          {/* Contoured High-Back Racing Bucket Seat */}
          <mesh position={[-0.05, 0.08, 0]} rotation={[0, 0, 0.12]}>
            <boxGeometry args={[0.025, 0.15, 0.20]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
          <mesh position={[-0.065, 0.17, 0]}>
            <boxGeometry args={[0.03, 0.045, 0.12]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>

          {/* Chrome Tubular Safety Roll-Bar Hoop */}
          <mesh position={[-0.06, 0.13, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.075, 0.010, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.15} metalness={0.9} />
          </mesh>

          {/* Rider Torso */}
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.095, 0.10, 0.17]} />
            <meshStandardMaterial color={pIdx === 0 ? "#2563eb" : "#dc2626"} roughness={0.5} />
          </mesh>

          {/* 4-Point Safety Harness Straps */}
          {[-0.04, 0.04].map((sz) => (
            <mesh key={`harness-${sz}`} position={[0.048, 0.04, sz]}>
              <boxGeometry args={[0.004, 0.09, 0.022]} />
              <meshStandardMaterial color="#0f172a" roughness={0.8} />
            </mesh>
          ))}
          {/* Quick-Release Central Harness Buckle */}
          <mesh position={[0.05, 0.04, 0]}>
            <boxGeometry args={[0.006, 0.018, 0.018]} />
            <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.4} />
          </mesh>

          {/* Helmet with Tinted Visor Shield */}
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.052, 16, 16]} />
            <meshStandardMaterial color={pIdx === 0 ? "#f8fafc" : "#facc15"} roughness={0.25} metalness={0.3} />
          </mesh>
          {/* Aerodynamic dark tinted visor */}
          <mesh position={[0.036, 0.14, 0]}>
            <boxGeometry args={[0.022, 0.026, 0.062]} />
            <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} />
          </mesh>

          {/* Padded Lap Bar / Safety Restraint */}
          <mesh position={[0.055, 0.06, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.22, 12]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* ── 4. Chassis Frame & Underbody Magnetic Brake Fin ── */}
      {/* Longitudinal Structural Steel Chassis Keel */}
      <mesh position={[0, -0.095, 0]}>
        <boxGeometry args={[0.52, 0.025, 0.06]} />
        <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.85} />
      </mesh>

      {/* Copper Magnetic Eddy-Current Brake Fin Blade */}
      <mesh position={[-0.02, -0.135, 0]}>
        <boxGeometry args={[0.38, 0.045, 0.008]} />
        <meshStandardMaterial color="#d97706" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* ── 5. 3-Wheel Safety Bogie Assemblies with Suspension Dampers ── */}
      {[-0.18, 0.18].map((dx) =>
        [-0.17, 0.17].map((dz) => (
          <group key={`bogie-${dx}-${dz}`} position={[dx, -0.11, dz]}>
            {/* Bogie Carrier Plate */}
            <mesh>
              <boxGeometry args={[0.11, 0.07, 0.03]} />
              <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.8} />
            </mesh>

            {/* Hydraulic Shock Damper Strut */}
            <mesh position={[0, 0.045, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.04, 10]} />
              <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.7} />
            </mesh>

            {/* 1. Running Wheel (rides on top of rail) */}
            <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.044, 0.044, 0.024, 14]} />
              <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.7} />
            </mesh>
            {/* Chrome axle cap */}
            <mesh position={[0, 0.02, Math.sign(dz) * 0.014]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.006, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
            </mesh>

            {/* 2. Side Friction Wheel (rides on inside flange of rail) */}
            <mesh position={[0, -0.015, -Math.sign(dz) * 0.022]} rotation={[0, 0, 0]}>
              <cylinderGeometry args={[0.032, 0.032, 0.018, 12]} />
              <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.65} />
            </mesh>

            {/* 3. Up-Stop Safety Wheel (locks underneath rail to prevent derailment) */}
            <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.036, 0.036, 0.022, 12]} />
              <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.7} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

// ─── Solid Bottom Bar HUD (Monitors Overlay) ─────────────────────────

function RollerCoasterBottomBar({ live, total, clears, minHeight, friction }) {
  const gpePct = total > 0 ? Math.min(100, Math.max(0, (live.gpe / total) * 100)) : 0;
  const kePct = total > 0 ? Math.min(100, Math.max(0, (live.ke / total) * 100)) : 0;
  const thPct = total > 0 ? Math.min(100, Math.max(0, (live.thermal / total) * 100)) : 0;

  // Speedometer gauge normalization (0 to 45 m/s)
  const maxSpeed = Math.max(45, Math.ceil(live.speed * 1.15));
  const speedAngle = clamp((live.speed / maxSpeed) * 180, 0, 180);

  // G-Force gauge normalization (-2g to +8g, total span 10g)
  const gClamped = clamp(live.gForce, -2, 8);
  const gAngle = ((gClamped + 2) / 10) * 180;
  const gWarning = live.gForce > 5 || live.gForce < 0;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex max-w-[96vw] flex-wrap items-center justify-center gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/95 px-5 py-3 shadow-2xl backdrop-blur-md">
      {/* ── Energy Conservation Budget ── */}
      <div className="flex flex-col min-w-[240px] max-w-[320px]">
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-300">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-duck-400" />
            ENERGY BUDGET
          </span>
          <span className="font-mono text-xs font-bold text-duck-300">
            {(total / 1000).toFixed(1)} kJ
          </span>
        </div>

        {/* Segmented Energy Stack Bar */}
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full border border-slate-700/80 bg-slate-800">
          <div
            className="h-full bg-sky-400 transition-all duration-100"
            style={{ width: `${gpePct}%` }}
            title={`GPE: ${(live.gpe / 1000).toFixed(1)} kJ (${gpePct.toFixed(0)}%)`}
          />
          <div
            className="h-full bg-emerald-400 transition-all duration-100"
            style={{ width: `${kePct}%` }}
            title={`KE: ${(live.ke / 1000).toFixed(1)} kJ (${kePct.toFixed(0)}%)`}
          />
          <div
            className="h-full bg-rose-400 transition-all duration-100"
            style={{ width: `${thPct}%` }}
            title={`Thermal: ${(live.thermal / 1000).toFixed(1)} kJ (${thPct.toFixed(0)}%)`}
          />
        </div>

        {/* Readout Tokens */}
        <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1 text-sky-300">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span>GPE {(live.gpe / 1000).toFixed(1)}k</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>KE {(live.ke / 1000).toFixed(1)}k</span>
          </div>
          <div className="flex items-center gap-1 text-rose-300">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span>Heat {(live.thermal / 1000).toFixed(1)}k</span>
          </div>
        </div>
      </div>

      <div className="hidden h-10 w-px bg-slate-700/80 sm:block" />

      {/* ── Analog Speedometer Dial ── */}
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 flex items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="#334155"
              strokeWidth="3.5"
              strokeDasharray="100"
              strokeDashoffset="25"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="#10b981"
              strokeWidth="3.5"
              strokeDasharray="100"
              strokeDashoffset={100 - (speedAngle / 180) * 75}
              strokeLinecap="round"
              className="transition-all duration-100"
            />
          </svg>
          <div className="absolute text-center">
            <span className="block font-mono text-xs font-bold text-emerald-300">
              {live.speed.toFixed(0)}
            </span>
          </div>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Speed
          </span>
          <span className="font-mono text-xs font-bold text-slate-200">
            {live.speed.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">m/s</span>
          </span>
        </div>
      </div>

      <div className="hidden h-10 w-px bg-slate-700/80 sm:block" />

      {/* ── Passenger G-Force Gauge ── */}
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 flex items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="#334155"
              strokeWidth="3.5"
              strokeDasharray="100"
              strokeDashoffset="25"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke={gWarning ? "#f43f5e" : "#38bdf8"}
              strokeWidth="3.5"
              strokeDasharray="100"
              strokeDashoffset={100 - (gAngle / 180) * 75}
              strokeLinecap="round"
              className="transition-all duration-100"
            />
          </svg>
          <div className="absolute text-center">
            <span
              className={`block font-mono text-xs font-bold ${
                gWarning ? "text-rose-400" : "text-sky-300"
              }`}
            >
              {live.gForce.toFixed(1)}
            </span>
          </div>
        </div>
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            G-Force
          </span>
          <span
            className={`font-mono text-xs font-bold ${
              gWarning ? "text-rose-400" : "text-slate-200"
            }`}
          >
            {live.gForce.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">g</span>
          </span>
        </div>
      </div>

      <div className="hidden h-10 w-px bg-slate-700/80 md:block" />

      {/* ── Status & Clearance Verdict Badge ── */}
      <div className="flex flex-col items-start gap-1">
        {live.leftTrack ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span>Derailment: speed insufficient at loop apex (v &lt; √(g·R))</span>
          </div>
        ) : live.gForce > 5 ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>High G-Force ({live.gForce.toFixed(1)} g) — Blackout risk for riders</span>
          </div>
        ) : clears ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>
              Clears loop ({live.topSpeed.toFixed(1)} m/s at top, needed {live.neededTopSpeed.toFixed(1)} m/s)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>Release too low (min 2.5 R = {minHeight.toFixed(1)} m)</span>
          </div>
        )}
        <div className="text-[10px] text-slate-400">
          {friction ? "Steel-on-steel friction enabled" : "Frictionless theoretical model"}
        </div>
      </div>
    </div>
  );
}

// ─── The Scene ──────────────────────────────────────────────────────

export default function RollerCoasterCanvas({ params = {} }) {
  const {
    releaseHeight = 25,
    loopRadius = 8,
    cartMass = 500,
    friction = false,
    running = true,
    speed = 1,
    relaunch = 0,
  } = params || {};

  const track = useMemo(
    () => buildTrack({ releaseHeight, loopRadius }),
    [releaseHeight, loopRadius],
  );

  const [live, setLive] = useState(() =>
    describeRun({ track, state: startRun({ track, mass: cartMass }), mass: cartMass }),
  );
  const onSample = useCallback((described) => setLive(described), []);

  const scale = useMemo(() => {
    const width = track.points[track.points.length - 1][0];
    const tallest = Math.max(releaseHeight, 2 * loopRadius);
    return Math.min(15.5 / Math.max(width, 1), 6.4 / Math.max(tallest, 1));
  }, [track, releaseHeight, loopRadius]);

  const minHeight = minimumReleaseHeight(loopRadius);
  const clears = releaseHeight >= minHeight;

  const total = live.gpe + live.ke + live.thermal;
  const centreX = (track.points[track.points.length - 1][0] * scale) / 2;

  return (
    <div className="relative w-full h-full">
      <SceneCanvas
        camera={{ position: [1.8, 0.4, 19.5], fov: 46 }}
        controls={{ minDistance: 6, maxDistance: 48, target: [1.8, -0.3, 0] }}
        lights={{ ambient: 0.58, keyLight: 1.05 }}
      >
        <group position={[-centreX + 5, -0.4, 0]}>
          {/* Lightened industrial slate ground base with polished aluminum top plate */}
          <group position={[centreX, -0.06, 0]}>
            {/* Slate base block */}
            <mesh receiveShadow>
              <boxGeometry args={[centreX * 2 + 3.6, 0.12, 3.4]} />
              <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.35} />
            </mesh>
            {/* Polished aluminum top plate */}
            <mesh position={[0, 0.065, 0]} receiveShadow>
              <boxGeometry args={[centreX * 2 + 3.4, 0.01, 3.2]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.65} />
            </mesh>
            {/* Perimeter safety hazard stripe border */}
            <mesh position={[0, 0.072, 1.58]}>
              <boxGeometry args={[centreX * 2 + 3.4, 0.005, 0.04]} />
              <meshStandardMaterial color="#eab308" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.072, -1.58]}>
              <boxGeometry args={[centreX * 2 + 3.4, 0.005, 0.04]} />
              <meshStandardMaterial color="#eab308" roughness={0.4} />
            </mesh>
          </group>

          <Supports track={track} scale={scale} />
          <Track
            track={track}
            scale={scale}
            showDanger={Boolean(live.leftTrack)}
          />

          <CartRunner
            track={track}
            mass={cartMass}
            friction={friction}
            running={running}
            speed={speed}
            resetKey={relaunch}
            scale={scale}
            onSample={onSample}
          />

          {/* Theoretical minimum release height marker line */}
          <Line
            points={[
              [0, minHeight * scale, 0],
              [centreX * 2, minHeight * scale, 0],
            ]}
            color={clears ? ENERGY_COLOURS.workOut : ENERGY_COLOURS.thermal}
            lineWidth={1.8}
            transparent
            opacity={0.8}
            dashed
            dashSize={0.16}
            gapSize={0.12}
          />
          <SceneLabel position={[centreX * 2 + 0.9, minHeight * scale, 0]} tone={clears ? "text-emerald-300" : "text-rose-300"}>
            {`2.5 R = ${minHeight.toFixed(1)} m minimum`}
          </SceneLabel>

          {/* Release height marker */}
          <SceneLabel position={[-0.6, releaseHeight * scale, 0]} accent>
            {`${releaseHeight} m`}
          </SceneLabel>

          {/* Loop diameter callout */}
          <SceneLabel
            position={[
              (track.points[0][0] + 0) * scale + (track.loopEntryS + track.loopRadius) * 0 + centreX * 0.98,
              2 * loopRadius * scale + 0.55,
              0,
            ]}
            tone="text-ink-300"
          >
            {`loop R = ${loopRadius} m · needs ${minimumTopSpeed(loopRadius).toFixed(1)} m/s at the top`}
          </SceneLabel>
        </group>

      </SceneCanvas>

      {/* Solid Bottom Bar HUD for Monitors (G-force dial, speed dial, energy budget bars) */}
      <RollerCoasterBottomBar
        live={live}
        total={total}
        clears={clears}
        minHeight={minHeight}
        friction={friction}
      />
    </div>
  );
}
