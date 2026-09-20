"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  AtomSphere,
  Bond,
  CANVAS_BG,
  DEG,
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  VectorArrow,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";
import { mediumColour, mediumName } from "@/components/visualizations/media";
import {
  OPTICS_TITLES,
  imageNature,
  opticsTypeOf,
  solveBlock,
  solveRayOptics,
} from "@/lib/rayOptics";
import {
  COIL_H,
  COIL_W,
  MAGNET_OMEGA,
  SOLENOID_RADIUS,
  TURN_PITCH,
  emfAt,
  omegaOf,
  peakEmf,
  safeTurnsOf,
  solveSolenoidInduction,
} from "@/lib/induction";
import { SIM_DT, simulateFlight } from "@/lib/projectile";
import { advanceOrbit, framing, muOf, solveOrbit } from "@/lib/orbit";
import {
  FIELD_FAR_Z,
  FIELD_HALF_X,
  FIELD_NEAR_Z,
  SCREEN_Z,
  brightFringes,
  screenIntensity,
} from "@/lib/interference";
import { gasLawReadout } from "@/lib/particleModel";
import ShadowLabCanvas from "@/components/visualizations/ShadowLabCanvas";
import InclineFrictionCanvas from "@/components/visualizations/InclineFrictionCanvas";
import HookesLawCanvas from "@/components/visualizations/HookesLawCanvas";
import SimpleMachinesCanvas from "@/components/visualizations/SimpleMachinesCanvas";
import RollerCoasterCanvas from "@/components/visualizations/RollerCoasterCanvas";
import CircuitBoardCanvas from "@/components/visualizations/CircuitBoardCanvas";
import StaticElectricityCanvas from "@/components/visualizations/StaticElectricityCanvas";
import BuoyancyCanvas from "@/components/visualizations/BuoyancyCanvas";
import HeatTransferCanvas from "@/components/visualizations/HeatTransferCanvas";

// ─── IGCSE Physics · five scenes ────────────────────────────────────
// Refraction, the motor effect, thin lenses, electromagnetic induction
// and the kinetic particle model. Each scene is a pure function of the
// `params` object the HUD owns.
// ─────────────────────────────────────────────────────────────────────

// ═══ 1 · Wave refraction & Snell's law ═══════════════════════════════

const RAY_LENGTH = 4.4;
const ARC_RADIUS = 1.1;

/** Approximate visible-spectrum colour for a wavelength in nm. */
function wavelengthToHex(nm) {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / 65;
  } else {
    r = 1;
  }
  // Keep the deep violets and reds bright enough to still read as a beam.
  const falloff =
    nm < 420 ? 0.6 + (0.4 * (nm - 380)) / 40 : nm > 680 ? 0.6 + (0.4 * (700 - nm)) / 20 : 1;
  const channel = (c) =>
    Math.round(255 * Math.pow(clamp(c * falloff, 0, 1), 0.75))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function arcSweep(centre, from, to, radius, segments = 36) {
  const pts = [];
  for (let k = 0; k <= segments; k += 1) {
    const a = from + (to - from) * (k / segments);
    pts.push([centre[0] + Math.cos(a) * radius, centre[1] + Math.sin(a) * radius, 0]);
  }
  return pts;
}

const arcMid = (centre, from, to, radius) => {
  const a = (from + to) / 2;
  return [centre[0] + Math.cos(a) * radius, centre[1] + Math.sin(a) * radius, 0];
};

/** Point a distance `d` along `dir` from `origin`, all in the ray plane. */
const along = (origin, dir, d) => [origin[0] + dir[0] * d, origin[1] + dir[1] * d, 0];

/**
 * Photon following the whole polyline. Its speed on each leg is c/n, so it
 * visibly slows inside the block and speeds back up on the way out.
 */
function PhotonPulse({ path, speeds, color, running, animSpeed = 1 }) {
  const mesh = useRef(null);
  const light = useRef(null);
  const progress = useRef(0);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  const points = useMemo(() => path.map((p) => new THREE.Vector3(...p)), [path]);
  const legs = points.length - 1;
  const legLengths = useMemo(() => {
    const lens = [];
    for (let i = 0; i < points.length - 1; i++) {
      lens.push(Math.max(0.01, points[i].distanceTo(points[i + 1])));
    }
    return lens;
  }, [points]);

  useFrame((_, delta) => {
    if (!mesh.current || legs < 1) return;
    const step = Math.min(delta, 0.05);
    if (running) {
      const leg = Math.min(legs - 1, Math.floor(progress.current));
      const legLen = legLengths[leg] || 1;
      const speedUnitsPerSec = 4.2 * (speeds[leg] ?? 1) * animSpeed;
      const fracDelta = (step * speedUnitsPerSec) / legLen;
      progress.current = (progress.current + fracDelta) % legs;
    }
    const leg = Math.min(legs - 1, Math.floor(progress.current));
    scratch.lerpVectors(points[leg], points[leg + 1], progress.current - leg);
    mesh.current.position.copy(scratch);
    if (light.current) light.current.position.copy(scratch);
  });

  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[0.11, 20, 20]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={light} color={color} intensity={6} distance={3} />
    </group>
  );
}

/** A labelled ray: solid line plus an arrowhead partway along it. */
function Ray({ from, to, color, label, labelSide = 1, width = 3.4, dashed = false, opacity = 1 }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return null;
  const dir = [dx / len, dy / len];
  const head = along(from, dir, len * 0.58);
  // Offset the caption perpendicular to the ray so it never sits on the line.
  const captionAt = along(along(from, dir, len * 0.74), [-dir[1] * labelSide, dir[0] * labelSide], 0.52);

  return (
    <group>
      <Line
        points={[from, to]}
        color={color}
        lineWidth={width}
        transparent={opacity < 1 || dashed}
        opacity={opacity}
        dashed={dashed}
        dashSize={0.2}
        gapSize={0.16}
      />
      {!dashed && (
        <VectorArrow
          from={along(from, dir, len * 0.58 - 0.34)}
          to={head}
          color={color}
          radius={0.001}
          headLength={0.3}
          headRadius={0.12}
          opacity={opacity}
        />
      )}
      {label && (
        <SceneLabel position={captionAt} tone="text-ink-100">
          {label}
        </SceneLabel>
      )}
    </group>
  );
}

export function RefractionScene({ params = {} }) {
  const {
    angle = 30,
    n1 = 1.0,
    n2 = 1.5,
    thickness = 3.0,
    wavelength = 550,
    medium1 = "air",
    medium2 = "glass",
    showReflection = true,
    showLabels = true,
    animate = true,
    speed = 1.0,
  } = params || {};

  const { i, r, e, tir, critical, lateral, run, reflectance } = solveBlock(
    angle,
    n1,
    n2,
    thickness,
  );
  const beam = wavelengthToHex(wavelength);
  // What actually gets through the first surface. Kept off zero so a nearly
  // grazing ray still reads as a ray rather than disappearing.
  const transmitted = clamp(1 - reflectance, 0.16, 1);

  const halfT = thickness / 2;
  // A shallow refraction (r near 90°, just short of the critical angle) can
  // run a long way sideways before reaching the far face. The block has to be
  // wide enough to still contain it, so it grows and the whole scene scales
  // down to stay framed rather than the ray leaving the glass mid-flight.
  const halfW = Math.max(4.2, run + 2.2);
  const fit = clamp(13 / (halfW + 3.6), 0.3, 1);

  const entry = [0, halfT, 0];
  const exit = [run, -halfT, 0];

  const incidentDir = [Math.sin(i), -Math.cos(i)];
  const incidentStart = [-RAY_LENGTH * Math.sin(i), halfT + RAY_LENGTH * Math.cos(i), 0];
  const reflectedEnd = along(entry, [Math.sin(i), Math.cos(i)], RAY_LENGTH * 0.72);
  const emergentEnd = tir ? null : along(exit, incidentDir, RAY_LENGTH);
  // Where the ray would have gone if the block were not there.
  const undeviatedEnd = along(entry, incidentDir, RAY_LENGTH + thickness);
  const internalReflectEnd = tir
    ? null
    : along(exit, [Math.sin(r), Math.cos(r)], 1.5);

  // Lateral displacement, drawn perpendicular between the two parallel rays.
  const displacement = useMemo(() => {
    // d goes negative when the block is the less dense medium — the ray shifts
    // the other way. Magnitude is what gets measured, so compare on abs.
    if (tir || Math.abs(lateral) < 0.05) return null;
    const dir = new THREE.Vector3(incidentDir[0], incidentDir[1], 0);
    const q = new THREE.Vector3(...along(exit, incidentDir, RAY_LENGTH * 0.62));
    const u = q.clone().sub(new THREE.Vector3(...entry));
    const foot = q.clone().sub(u.clone().sub(dir.clone().multiplyScalar(u.dot(dir))));
    return { from: foot.toArray(), to: q.toArray() };
  }, [tir, lateral, exit[0], exit[1], incidentDir[0], incidentDir[1], entry[1]]);

  const photonPath = tir
    ? [incidentStart, entry, reflectedEnd]
    : [incidentStart, entry, exit, emergentEnd];
  const photonSpeeds = tir ? [1.6 / n1, 1.6 / n1] : [1.6 / n1, 1.6 / n2, 1.6 / n1];

  const outerColour = mediumColour(medium1);
  const blockColour = mediumColour(medium2);
  const name1 = mediumName(medium1, n1);
  const name2 = mediumName(medium2, n2);

  const boxEdgesGeo = useMemo(() => {
    const box = new THREE.BoxGeometry(halfW * 2, thickness, 6);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [halfW, thickness]);

  useEffect(() => {
    return () => {
      boxEdgesGeo.dispose();
    };
  }, [boxEdgesGeo]);

  return (
    <SceneCanvas camera={{ position: [1.5, 1.5, 13], fov: 45 }} controls={{ autoRotate: params.spin !== false, autoRotateSpeed: 0.45 * speed }} fog={[22, 44]}>
     <group scale={fit}>
      {/* ── Medium 1: everything outside the block ───────────────── */}
      <mesh position={[0, halfT + 5, 0]} renderOrder={-3}>
        <boxGeometry args={[halfW * 2 + 8, 10, 9]} />
        <meshStandardMaterial
          color={outerColour}
          transparent
          opacity={clamp(0.12 + (n1 - 1) * 0.16, 0.12, 0.35)}
          roughness={0.1}
          metalness={0.02}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -halfT - 5, 0]} renderOrder={-3}>
        <boxGeometry args={[halfW * 2 + 8, 10, 9]} />
        <meshStandardMaterial
          color={outerColour}
          transparent
          opacity={clamp(0.12 + (n1 - 1) * 0.16, 0.12, 0.35)}
          roughness={0.1}
          metalness={0.02}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Medium 2: the parallel-sided block ───────────────────── */}
      <mesh renderOrder={-2}>
        <boxGeometry args={[halfW * 2, thickness, 6]} />
        <meshStandardMaterial
          color={blockColour}
          transparent
          opacity={clamp(0.16 + (n2 - 1) * 0.22, 0.16, 0.58)}
          roughness={0.05}
          metalness={0.05}
          emissive={blockColour}
          emissiveIntensity={0.16}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Hard edges — the single clearest cue that this is a solid block. */}
      <lineSegments geometry={boxEdgesGeo} renderOrder={-1}>
        <lineBasicMaterial color={blockColour} transparent opacity={0.92} />
      </lineSegments>

      {/* The two refracting surfaces. */}
      {[halfT, -halfT].map((y) => (
        <Line
          key={y}
          points={[
            [-halfW, y, 0],
            [halfW, y, 0],
          ]}
          color={blockColour}
          lineWidth={2.8}
          transparent
          opacity={0.95}
        />
      ))}

      {/* ── Normals at both surfaces ─────────────────────────────── */}
      {[entry, exit].map((p, idx) => (
        <group key={idx}>
          <Line
            points={[
              [p[0], p[1] - 2.5, 0],
              [p[0], p[1] + 2.5, 0],
            ]}
            color="#8a92a0"
            lineWidth={1.4}
            dashed
            dashSize={0.2}
            gapSize={0.16}
          />
          {showLabels && (
            <SceneLabel
              position={[p[0] + 0.62, p[1] + (idx === 0 ? 2.5 : -2.5), 0]}
              tone="text-ink-400"
            >
              normal
            </SceneLabel>
          )}
        </group>
      ))}

      {/* ── The four rays ────────────────────────────────────────── */}
      <Ray
        from={incidentStart}
        to={entry}
        color={beam}
        label={showLabels ? "incident ray" : null}
        labelSide={-1}
      />

      {!tir && (
        <Ray
          from={entry}
          to={exit}
          color={beam}
          opacity={transmitted}
          label={showLabels ? "refracted ray" : null}
          labelSide={-1}
        />
      )}

      {!tir && emergentEnd && (
        <Ray
          from={exit}
          to={emergentEnd}
          color={beam}
          opacity={transmitted}
          label={showLabels ? "emergent ray" : null}
          labelSide={-1}
        />
      )}

      {/* Brightness follows the Fresnel share, so the reflected ray really
          does take over as the angle flattens. */}
      {(showReflection || tir) && (
        <Ray
          from={entry}
          to={reflectedEnd}
          color={tir ? beam : lerp(0.35, 1, reflectance) > 0.6 ? beam : "#8a92a0"}
          width={tir ? 3.4 : 1.4 + reflectance * 2}
          opacity={tir ? 1 : clamp(0.2 + reflectance * 1.6, 0.2, 1)}
          dashed={!tir && reflectance < 0.35}
          label={
            showLabels
              ? tir
                ? "totally internally reflected — 100%"
                : `partially reflected ray — ${(reflectance * 100).toFixed(0)}%`
              : null
          }
        />
      )}

      {showReflection && !tir && internalReflectEnd && (
        <Line
          points={[exit, internalReflectEnd]}
          color="#8a92a0"
          lineWidth={1.4}
          transparent
          opacity={0.35}
          dashed
          dashSize={0.16}
          gapSize={0.14}
        />
      )}

      {/* Original path, for comparison with the emergent ray. */}
      {!tir && (
        <Line
          points={[entry, undeviatedEnd]}
          color="#5b6472"
          lineWidth={1.2}
          transparent
          opacity={0.4}
          dashed
          dashSize={0.24}
          gapSize={0.2}
        />
      )}

      {/* Lateral displacement between incident path and emergent ray. */}
      {displacement && (
        <>
          <Line
            points={[displacement.from, displacement.to]}
            color={PALETTE.emerald}
            lineWidth={2.4}
          />
          {showLabels && (
            <SceneLabel
              position={[
                (displacement.from[0] + displacement.to[0]) / 2 + 0.1,
                (displacement.from[1] + displacement.to[1]) / 2 - 0.5,
                0,
              ]}
              tone="text-emerald-300"
            >
              lateral displacement d = {Math.abs(lateral).toFixed(2)}
            </SceneLabel>
          )}
        </>
      )}

      {/* ── Angle arcs, all measured from the normal ─────────────── */}
      {i > 0.02 && (
        <>
          <Line
            points={arcSweep(entry, Math.PI / 2, Math.PI / 2 + i, ARC_RADIUS)}
            color={PALETTE.gold}
            lineWidth={1.8}
          />
          <SceneLabel position={arcMid(entry, Math.PI / 2, Math.PI / 2 + i, ARC_RADIUS + 0.4)} accent>
            i = {angle.toFixed(0)}°
          </SceneLabel>
        </>
      )}

      {!tir && r > 0.02 && (
        <>
          <Line
            points={arcSweep(entry, -Math.PI / 2, -Math.PI / 2 + r, ARC_RADIUS)}
            color={PALETTE.emerald}
            lineWidth={1.8}
          />
          <SceneLabel
            position={arcMid(entry, -Math.PI / 2, -Math.PI / 2 + r, ARC_RADIUS + 0.4)}
            tone="text-emerald-300"
          >
            r = {(r / DEG).toFixed(1)}°
          </SceneLabel>

          <Line
            points={arcSweep(exit, Math.PI / 2, Math.PI / 2 + r, ARC_RADIUS)}
            color={PALETTE.emerald}
            lineWidth={1.8}
          />
          <SceneLabel
            position={arcMid(exit, Math.PI / 2, Math.PI / 2 + r, ARC_RADIUS + 0.4)}
            tone="text-emerald-300"
          >
            r = {(r / DEG).toFixed(1)}°
          </SceneLabel>
        </>
      )}

      {!tir && e > 0.02 && (
        <>
          <Line
            points={arcSweep(exit, -Math.PI / 2, -Math.PI / 2 + e, ARC_RADIUS)}
            color={PALETTE.gold}
            lineWidth={1.8}
          />
          <SceneLabel position={arcMid(exit, -Math.PI / 2, -Math.PI / 2 + e, ARC_RADIUS + 0.4)} accent>
            e = {(e / DEG).toFixed(0)}°
          </SceneLabel>
        </>
      )}

      {/* Contact points. */}
      {[entry, ...(tir ? [] : [exit])].map((p, idx) => (
        <AtomSphere
          key={idx}
          position={p}
          radius={0.085}
          color={PALETTE.gold}
          emissiveIntensity={2}
        />
      ))}

      <PhotonPulse
        path={photonPath}
        speeds={photonSpeeds}
        color={beam}
        running={animate}
        animSpeed={params.speed ?? 1}
      />

      {/* ── Medium captions ──────────────────────────────────────── */}
      <SceneLabel position={[-halfW + 1.4, halfT + 1.5, 0]} tone="text-ink-200">
        Medium 1 · {name1} · n₁ = {n1.toFixed(2)}
      </SceneLabel>
      <SceneLabel position={[-halfW + 1.4, 0, 0]} accent>
        Medium 2 · {name2} · n₂ = {n2.toFixed(2)}
      </SceneLabel>
      <SceneLabel position={[-halfW + 1.4, -halfT - 1.5, 0]} tone="text-ink-200">
        Medium 1 · {name1} · n₁ = {n1.toFixed(2)}
      </SceneLabel>

     </group>
    </SceneCanvas>
  );
}

// ═══ 2 · Fleming's left-hand rule & the motor effect ══════════════════

// ═══ 2 · Fleming's left-hand rule & the motor effect ══════════════════

const ROBO_PRIMARY = "#f8fafc";
const ROBO_SECONDARY = "#cbd5e1";
const ROBO_DARK = "#334155";
const ROBO_GOLD = "#fbbf24";
const ROBO_RED = "#ef4444";
const ROBO_GLOW = "#0ea5e9";
const ROBO_PURPLE = "#d946ef";
const ROBO_GREEN = "#10b981";

function RoboFinger({ points, rStart, rEnd, tipColor }) {
  const tipQuat = useMemo(() => {
    const pPrev = new THREE.Vector3(...points[points.length - 2]);
    const pLast = new THREE.Vector3(...points[points.length - 1]);
    const dir = pLast.clone().sub(pPrev).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }, [points]);

  return (
    <group>
      {points.map((p, i) => {
        const next = points[i + 1];
        const r = rStart + (rEnd - rStart) * (i / (points.length - 1));
        const rNext = next ? rStart + (rEnd - rStart) * ((i + 1) / (points.length - 1)) : r;
        
        return (
          <group key={i}>
            <mesh position={p}>
              <sphereGeometry args={[r * 1.25, 24, 24]} />
              <meshStandardMaterial color={ROBO_DARK} metalness={0.9} roughness={0.4} />
            </mesh>
            {/* Floating Armor Shield over knuckle */}
            <mesh position={p} rotation={[Math.PI/4, 0, 0]}>
              <sphereGeometry args={[r * 1.35, 16, 16, 0, Math.PI, 0, Math.PI/2]} />
              <meshStandardMaterial color={ROBO_PRIMARY} metalness={1.0} roughness={0.1} />
            </mesh>
            {/* Joint Groove/Rings (gyroscope style) */}
            <mesh position={p} rotation={[Math.PI/2, 0, 0]}>
              <torusGeometry args={[r * 1.28, r * 0.1, 16, 32]} />
              <meshStandardMaterial color={ROBO_GOLD} metalness={1.0} roughness={0.2} />
            </mesh>
            <mesh position={p} rotation={[0, Math.PI/2, 0]}>
              <torusGeometry args={[r * 1.28, r * 0.08, 16, 32]} />
              <meshStandardMaterial color={ROBO_SECONDARY} metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Side Hinges / Bolts */}
            <mesh position={p} rotation={[0, 0, Math.PI/2]}>
              <cylinderGeometry args={[r * 0.5, r * 0.5, r * 2.8, 16]} />
              <meshStandardMaterial color={ROBO_DARK} metalness={0.9} roughness={0.3} />
            </mesh>
            {/* Glowing Bolt Caps */}
            <mesh position={p} rotation={[0, 0, Math.PI/2]}>
              <cylinderGeometry args={[r * 0.3, r * 0.3, r * 2.85, 16]} />
              <meshStandardMaterial color={ROBO_RED} emissive={ROBO_RED} emissiveIntensity={3.0} />
            </mesh>
            {/* Status indicator LED on knuckles */}
            <mesh position={p} rotation={[0, 0, Math.PI/2]}>
              <cylinderGeometry args={[r * 0.15, r * 0.15, r * 2.88, 16]} />
              <meshStandardMaterial color={ROBO_GREEN} emissive={ROBO_GREEN} emissiveIntensity={4.0} />
            </mesh>
            <mesh position={p}>
              <sphereGeometry args={[r * 0.95, 16, 16]} />
              <meshStandardMaterial color={tipColor || ROBO_GLOW} emissive={tipColor || ROBO_GLOW} emissiveIntensity={2.5} />
            </mesh>
            {/* Energy halo around joint */}
            <mesh position={p} rotation={[Math.PI/4, Math.PI/4, 0]}>
              <torusGeometry args={[r * 1.5, r * 0.02, 16, 32]} />
              <meshStandardMaterial color={ROBO_PURPLE} emissive={ROBO_PURPLE} emissiveIntensity={3.0} transparent opacity={0.6} />
            </mesh>
            {next && <Segment p1={p} p2={next} r1={r} r2={rNext} tipColor={tipColor} />}
          </group>
        );
      })}
      
      <mesh position={points[points.length - 1]} quaternion={tipQuat}>
        <cylinderGeometry args={[rEnd * 0.7, rEnd * 1.1, 0.15, 24]} />
        <meshStandardMaterial color={tipColor || ROBO_GLOW} emissive={tipColor || ROBO_GLOW} emissiveIntensity={4.0} />
      </mesh>
      <mesh position={points[points.length - 1]} quaternion={tipQuat}>
        <cylinderGeometry args={[rEnd * 0.8, rEnd * 0.8, 0.25, 24]} />
        <meshStandardMaterial color={ROBO_PRIMARY} metalness={1.0} roughness={0.05} />
      </mesh>
      {/* Laser targeting dot on tip */}
      {(() => {
        const pLast = new THREE.Vector3(...points[points.length - 1]);
        const pPrev = new THREE.Vector3(...points[points.length - 2]);
        const tipDir = pLast.clone().sub(pPrev).normalize();
        const laserPos = pLast.clone().add(tipDir.multiplyScalar(rEnd * 0.8));
        return (
          <mesh position={laserPos.toArray()} quaternion={tipQuat}>
            <sphereGeometry args={[rEnd * 0.2, 16, 16]} />
            <meshStandardMaterial color={ROBO_RED} emissive={ROBO_RED} emissiveIntensity={6.0} />
          </mesh>
        );
      })()}
    </group>
  );
}

function Segment({ p1, p2, r1, r2, tipColor }) {
  const position = useMemo(() => {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    return v1.clone().lerp(v2, 0.5);
  }, [p1, p2]);

  const quaternion = useMemo(() => {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      v2.sub(v1).normalize()
    );
  }, [p1, p2]);

  const distance = useMemo(() => {
    return new THREE.Vector3(...p1).distanceTo(new THREE.Vector3(...p2));
  }, [p1, p2]);

  return (
    <group position={position} quaternion={quaternion}>
      {/* Central Bone (Glass outer shell + Glowing inner core) */}
      <mesh>
        <cylinderGeometry args={[r2 * 0.85, r1 * 0.85, distance, 24]} />
        <meshStandardMaterial color="#ffffff" metalness={0.9} roughness={0.1} transparent opacity={0.3} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[r2 * 0.4, r1 * 0.4, distance, 24]} />
        <meshStandardMaterial color={ROBO_PURPLE} emissive={ROBO_PURPLE} emissiveIntensity={3.0} />
      </mesh>
      {/* Carbon fiber struts inside the glass */}
      {[0, Math.PI/2, Math.PI, Math.PI*1.5].map(angle => (
        <mesh key={`strut-${angle}`} position={[Math.cos(angle) * r1 * 0.6, 0, Math.sin(angle) * r1 * 0.6]}>
          <cylinderGeometry args={[0.04, 0.04, distance, 8]} />
          <meshStandardMaterial color={ROBO_DARK} metalness={0.9} roughness={0.6} />
        </mesh>
      ))}

      {/* Exoskeleton Cage (4 rods) */}
      {[0, Math.PI/2, Math.PI, Math.PI*1.5].map(angle => (
        <mesh key={angle} position={[Math.cos(angle) * r1 * 0.95, 0, Math.sin(angle) * r1 * 0.95]}>
          <cylinderGeometry args={[0.04, 0.04, distance * 0.9, 8]} />
          <meshStandardMaterial color={ROBO_GOLD} metalness={1.0} roughness={0.1} />
        </mesh>
      ))}
      <mesh position={[0, distance/2 - r2*0.2, 0]}>
        <cylinderGeometry args={[r2 * 1.15, r2 * 1.15, r2*0.4, 24]} />
        <meshStandardMaterial color={ROBO_PRIMARY} metalness={1.0} roughness={0.15} />
      </mesh>
      <mesh position={[0, -distance/2 + r1*0.2, 0]}>
        <cylinderGeometry args={[r1 * 1.15, r1 * 1.15, r1*0.4, 24]} />
        <meshStandardMaterial color={ROBO_PRIMARY} metalness={1.0} roughness={0.15} />
      </mesh>
      
      {/* Side energy cables with dual colors */}
      <mesh position={[r1 * 0.85, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, distance, 8]} />
        <meshStandardMaterial color={tipColor || ROBO_GLOW} emissive={tipColor || ROBO_GLOW} emissiveIntensity={3.0} />
      </mesh>
      <mesh position={[-r1 * 0.85, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, distance, 8]} />
        <meshStandardMaterial color={ROBO_GREEN} emissive={ROBO_GREEN} emissiveIntensity={3.0} />
      </mesh>
      
      {/* Intense Ribbed texture / piston rings on the bone */}
      {[-0.35, -0.15, 0.0, 0.15, 0.35].map(offset => (
        <mesh key={offset} position={[0, distance * offset, 0]}>
          <torusGeometry args={[r1 * 0.9, 0.04, 16, 32]} />
          <meshStandardMaterial color={ROBO_GOLD} metalness={1.0} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Ultra-detailed Cybernetic Robotic Left Hand for Fleming's Left-Hand Rule.
 */
function FlemingLeftHand({ bSign, iSign }) {
  const rotation =
    bSign > 0 && iSign > 0
      ? [0, 0, 0]
      : bSign < 0 && iSign > 0
        ? [0, 0, Math.PI]
        : bSign > 0 && iSign < 0
          ? [Math.PI, 0, 0]
          : [0, Math.PI, 0];

  return (
    <group rotation={rotation} scale={1.15}>
      <ambientLight intensity={2.0} />
      <directionalLight position={[5, 10, 5]} intensity={2.0} />
      <directionalLight position={[-5, -10, -5]} intensity={1.0} />
      {/* ── Hydraulic Arm Tube (Horizontal cylinder from Pole N) ── */}
      <mesh position={[-2.4, -0.02, 0.06]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 2.8, 32]} />
        <meshStandardMaterial color={ROBO_DARK} roughness={0.6} metalness={0.8} />
      </mesh>
      
      {/* Vent strips along the arm */}
      {[-1.3, -1.9, -2.5, -3.1].map((x) => (
        <group key={x} position={[x, -0.02, 0.06]} rotation={[0, 0, Math.PI / 2]}>
          {/* Neon Green Vent strips */}
          {[0, Math.PI/2, Math.PI, Math.PI*1.5].map(angle => (
            <mesh key={`vent-${angle}`} position={[Math.cos(angle)*0.38, 0, Math.sin(angle)*0.38]} rotation={[0, Math.PI/2, 0]}>
               <planeGeometry args={[0.2, 0.05]} />
               <meshStandardMaterial color={ROBO_GREEN} emissive={ROBO_GREEN} emissiveIntensity={5.0} />
            </mesh>
          ))}
        </group>
      ))}
      
      {/* Heavy Hydraulic cables running along the arm */}
      {[0, Math.PI*2/3, Math.PI*4/3].map((angle, i) => (
        <group key={`cable-${i}`}>
          <mesh position={[-2.4, -0.02 + 0.38 * Math.sin(angle), 0.06 + 0.38 * Math.cos(angle)]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 2.8, 16]} />
            <meshStandardMaterial color={ROBO_GOLD} metalness={1.0} roughness={0.1} />
          </mesh>
          <mesh position={[-2.4, -0.02 + 0.38 * Math.sin(angle), 0.06 + 0.38 * Math.cos(angle)]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 2.82, 16]} />
            <meshStandardMaterial color={ROBO_RED} emissive={ROBO_RED} emissiveIntensity={4.0} />
          </mesh>
        </group>
      ))}
      
      {/* Hydraulic piston glowing rings on the arm */}
      {[-1.6, -2.2, -2.8].map((x) => (
        <mesh key={x} position={[x, -0.02, 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.42, 0.05, 32, 32]} />
          <meshStandardMaterial color={ROBO_GLOW} emissive={ROBO_GLOW} emissiveIntensity={3.5} />
        </mesh>
      ))}

      {/* ── Main Palm Body and Curled Fingers (Rotated to face FRONT) ──────── */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {/* Main Palm Body */}
        <RoundedBox
          args={[1.72, 1.0, 1.4]}
          radius={0.08}
          smoothness={4}
          position={[-0.6, -0.02, 0.06]}
        >
          <meshStandardMaterial color={ROBO_PRIMARY} roughness={0.15} metalness={0.9} />
        </RoundedBox>

        {/* Dark inner layer for depth */}
        <RoundedBox
          args={[1.74, 0.98, 1.38]}
          radius={0.05}
          smoothness={4}
          position={[-0.6, -0.02, 0.06]}
        >
          <meshStandardMaterial color={ROBO_DARK} roughness={0.7} metalness={0.9} />
        </RoundedBox>

        {/* Cyber Grip Pad */}
        <RoundedBox
          args={[1.48, 0.36, 1.28]}
          radius={0.05}
          smoothness={2}
          position={[-0.55, -0.42, 0.06]}
        >
          <meshStandardMaterial color={ROBO_PURPLE} roughness={0.2} metalness={1.0} wireframe />
        </RoundedBox>
        <RoundedBox
          args={[1.46, 0.35, 1.26]}
          radius={0.05}
          smoothness={2}
          position={[-0.55, -0.4, 0.06]}
        >
          <meshStandardMaterial color={ROBO_DARK} roughness={0.7} metalness={0.9} />
        </RoundedBox>
        {/* Grip Pad Glowing nodes */}
        {[-1.0, -0.1].map(x => 
          [-0.4, 0.5].map(z => (
            <mesh key={`${x}-${z}`} position={[x, -0.55, z]}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color={ROBO_GLOW} emissive={ROBO_GLOW} emissiveIntensity={4.0} />
            </mesh>
          ))
        )}

        {/* ── Ring finger: Curled into palm ──────── */}
        <RoboFinger
          points={[
            [0.2, 0.0, -0.2],
            [0.52, -0.22, -0.2],
            [0.46, -0.62, -0.2],
            [0.18, -0.74, -0.2],
          ]}
          rStart={0.128}
          rEnd={0.082}
        />

        {/* ── Little finger: Curled into palm ─────── */}
        <RoboFinger
          points={[
            [0.15, -0.01, -0.5],
            [0.44, -0.2, -0.5],
            [0.38, -0.52, -0.5],
            [0.16, -0.6, -0.5],
          ]}
          rStart={0.112}
          rEnd={0.072}
        />
      </group>

      {/* Servo Motor Housing (Thumb Joint) - Left unrotated to connect Thumb */}
      <mesh position={[-0.75, 0.04, -0.38]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={ROBO_SECONDARY} roughness={0.3} metalness={0.9} />
      </mesh>

      {/* ── Thumb — Force F (+Y) ── */}
      {/* Chronologically next: Thumb above the base */}
      <RoboFinger
        points={[
          [-0.75, 0.1, -0.46],
          [-0.72, 0.75, -0.5],
          [-0.7, 1.46, -0.52],
        ]}
        rStart={0.165}
        rEnd={0.115}
        tipColor={PALETTE.emerald}
      />

      {/* ── Second finger — Current I (+Z) ── */}
      {/* Chronologically next: Middle finger facing front */}
      <RoboFinger
        points={[
          [0.22, 0.12, -0.06],
          [0.32, 0.11, 0.45],
          [0.32, 0.1, 1.05],
          [0.32, 0.09, 1.68],
        ]}
        rStart={0.14}
        rEnd={0.086}
        tipColor={PALETTE.gold}
      />

      {/* ── First finger — Field B (+X) ── */}
      {/* Chronologically last: Index finger facing S pole (+X) */}
      <RoboFinger
        points={[
          [0.2, 0.4, -0.4],
          [0.72, 0.4, -0.4],
          [1.26, 0.39, -0.4],
          [1.76, 0.38, -0.4],
        ]}
        rStart={0.135}
        rEnd={0.088}
        tipColor={PALETTE.sky}
      />
    </group>
  );
}

function FlowPulses({
  origin,
  dir,
  length,
  color,
  speed,
  count = 4,
  size = 0.13,
  running,
}) {
  const meshes = useRef([]);
  const phase = useRef(0);

  useFrame((_, delta) => {
    if (running) phase.current = (phase.current + Math.min(delta, 0.05) * speed) % 1;
    for (let i = 0; i < count; i += 1) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const t = (phase.current + i / count) % 1;
      mesh.position.set(
        origin[0] + dir[0] * t * length,
        origin[1] + dir[1] * t * length,
        origin[2] + dir[2] * t * length,
      );
      mesh.scale.setScalar(0.25 + Math.sin(t * Math.PI) * 0.75);
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
          <sphereGeometry args={[size, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2.8}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

/** Realistic Magnet Pole Assembly with Steel Yoke (coils removed for clarity). */
function PolePlate({ position, pole }) {
  const isNorth = pole === "N";
  const color = isNorth ? PALETTE.rose : PALETTE.sky;
  return (
    <group position={position}>
      {/* Metallic Pole Block */}
      <mesh>
        <boxGeometry args={[0.7, 3.6, 3.6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.45}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      {/* Polished Bevel Cap */}
      <mesh position={[isNorth ? 0.38 : -0.38, 0, 0]}>
        <boxGeometry args={[0.06, 3.64, 3.64]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
      </mesh>

      <SceneLabel
        position={[0, 2.4, 0]}
        tone={isNorth ? "text-rose-300" : "text-sky-300"}
      >
        {isNorth ? "N pole" : "S pole"}
      </SceneLabel>
    </group>
  );
}

export const MagnetPole = PolePlate;

// The conductor is taken to be one metre of wire inside the field, so the
// numbers in the readout are a real F = BIL and not I × B with a silent unit.
const WIRE_LENGTH = 1;

export function MotorEffectScene({ params = {} }) {
  const {
    current = 1.0,
    field = 1.0,
    reverseCurrent = false,
    reverseField = false,
    showFieldLines = true,
    animate = true,
    speed = 1.0,
  } = params || {};
  const animSpeed = typeof speed === "number" && !isNaN(speed) ? speed : 1.0;

  // B runs from the N pole to the S pole; I runs along the second finger.
  const bSign = reverseField ? -1 : 1;
  const iSign = reverseCurrent ? -1 : 1;
  // F = I L × B, so ẑ × x̂ = ŷ. Reversing either input flips the force.
  const fSign = iSign * bSign;

  const force = field * current * WIRE_LENGTH;
  // No current means no force — the wire simply sits there. Drawing a stub
  // arrow and sliding the conductor anyway would teach the wrong thing.
  const hasForce = force > 1e-6;

  // Each vector leaves from just past its fingertip, so the hand stays clear.
  const fieldDir = [bSign, 0, 0];
  const currentDir = [0, 0, iSign];
  const forceDir = [0, fSign, 0];

  // Apply robotic hand rotation matrix to base fingertip local positions so vector arrows
  // remain firmly anchored to the fingers under all polarity configurations.
  const transformHandPoint = ([x, y, z], b, i) => {
    if (b > 0 && i > 0) return [x, y, z];
    if (b < 0 && i > 0) return [-x, -y, z];  // rot [0, 0, PI]
    if (b > 0 && i < 0) return [x, -y, -z];  // rot [PI, 0, 0]
    return [-x, y, -z];                      // rot [0, PI, 0]
  };

  const fieldStart = useMemo(
    () => transformHandPoint([2.05, 0.38, -0.4], bSign, iSign),
    [bSign, iSign],
  );
  const currentStart = useMemo(
    () => transformHandPoint([0.37, 0.09, 1.95], bSign, iSign),
    [bSign, iSign],
  );
  const forceStart = useMemo(
    () => transformHandPoint([-0.8, 1.7, -0.61], bSign, iSign),
    [bSign, iSign],
  );

  const AXIS = 4.2;
  const end = (start, dir, len) => [
    start[0] + dir[0] * len,
    start[1] + dir[1] * len,
    start[2] + dir[2] * len,
  ];

  const fieldLines = useMemo(() => {
    const lines = [];
    for (const y of [-2.2, 2.8]) {
      for (const z of [-2.4, 2.8]) lines.push({ y, z });
    }
    return lines;
  }, []);

  return (
    <SceneCanvas camera={{ position: [8, 5, 13], fov: 45 }}>
      {/* ── The hand is the diagram ──────────────────────────────── */}
      <FlemingLeftHand bSign={bSign} iSign={iSign} />

      {/* ── Field: first finger ──────────────────────────────────── */}
      <VectorArrow
        from={fieldStart}
        to={end(fieldStart, fieldDir, AXIS)}
        color={PALETTE.sky}
        radius={0.055}
        headRadius={0.17}
        label="B — Field"
      />
      <FlowPulses
        origin={fieldStart}
        dir={fieldDir}
        length={AXIS}
        color={PALETTE.sky}
        speed={(0.22 + field * 0.34) * animSpeed}
        count={4}
        running={animate}
      />

      {/* ── Current: second finger. The shaft is the conductor. ──── */}
      <VectorArrow
        from={currentStart}
        to={end(currentStart, currentDir, AXIS)}
        color={PALETTE.gold}
        radius={0.055}
        headRadius={0.17}
        label="I — Current"
      />
      <FlowPulses
        origin={currentStart}
        dir={currentDir}
        length={AXIS}
        color={PALETTE.gold}
        speed={(0.24 + current * 0.42) * animSpeed}
        count={5}
        running={animate}
      />

      {/* ── Force: thumb (moving conductor and rails removed) ──────── */}
      {hasForce ? (
        <>
          <VectorArrow
            from={forceStart}
            to={end(forceStart, forceDir, clamp(1.6 + force * 1.3, 1.6, AXIS))}
            color={PALETTE.emerald}
            radius={0.062}
            headRadius={0.19}
            label={`F = BIL = ${force.toFixed(2)} N`}
          />
          <FlowPulses
            origin={forceStart}
            dir={forceDir}
            length={clamp(1.6 + force * 1.3, 1.6, AXIS)}
            color={PALETTE.emerald}
            speed={(0.2 + force * 0.4) * animSpeed}
            count={3}
            running={animate}
          />
        </>
      ) : (
        <SceneLabel position={[0, 2.5, 0]} tone="text-rose-300">
          I = 0 A · no current, no force, no motion
        </SceneLabel>
      )}

      {/* ── Field lines and poles, framing the whole thing ───────── */}
      {showFieldLines && (
        <>
          <PolePlate position={[bSign * -7.4, 0, 0]} pole="N" />
          <PolePlate position={[bSign * 7.4, 0, 0]} pole="S" />
          {fieldLines.map(({ y, z }, i) => (
            <group key={i}>
              <Line
                points={[
                  [bSign * -7, y, z],
                  [bSign * 7, y, z],
                ]}
                color={PALETTE.sky}
                lineWidth={1}
                transparent
                opacity={0.14 + field * 0.12}
                dashed
                dashSize={0.26}
                gapSize={0.2}
              />
              <FlowPulses
                origin={[bSign * -7, y, z]}
                dir={fieldDir}
                length={14}
                color={PALETTE.sky}
                speed={(0.1 + field * 0.16) * animSpeed}
                count={3}
                size={0.09}
                running={animate}
              />
            </group>
          ))}
        </>
      )}

    </SceneCanvas>
  );
}
// ═══ 3 · Ray optics — lenses & curved mirrors ═════════════════════════

function lensProfile(type, radius = 1.65, thickness = 0.38, segments = 32) {
  const pts = [];
  if (type === "convex") {
    for (let i = 0; i <= segments; i += 1) {
      const t = (i / segments) * Math.PI;
      pts.push(new THREE.Vector2(radius * Math.sin(t), (thickness / 2) * Math.cos(t)));
    }
  } else {
    // Thin at the axis, thick at the rim.
    const centre = thickness * 0.25;
    for (let i = 0; i <= segments; i += 1) {
      const u = i / segments;
      pts.push(new THREE.Vector2(radius * u, (centre + (thickness - centre) * u * u) / 2));
    }
    for (let i = segments; i >= 0; i -= 1) {
      const u = i / segments;
      pts.push(new THREE.Vector2(radius * u, -(centre + (thickness - centre) * u * u) / 2));
    }
  }
  return pts;
}

function mirrorProfile(type, radius = 1.65, sagitta = 0.16, thickness = 0.05, segments = 36) {
  const pts = [];
  const isConcave = type.includes("concave");
  if (isConcave) {
    // Concave mirror: bowl curves away from light source into +x
    // Rim at r = radius is at axial = 0; center at r = 0 is at axial = sagitta (0.16)
    for (let i = 0; i <= segments; i += 1) {
      const u = i / segments;
      const r = radius * u;
      const axial = sagitta * (1 - u * u);
      pts.push(new THREE.Vector2(r, axial));
    }
    // Back face
    for (let i = segments; i >= 0; i -= 1) {
      const u = i / segments;
      const r = radius * u;
      const axial = sagitta * (1 - u * u) + thickness;
      pts.push(new THREE.Vector2(r, axial));
    }
  } else {
    // Convex mirror: dome bulges toward light source into -x
    // Apex at r = 0 is at axial = -0.04; rim at r = radius is at axial = +0.12
    for (let i = 0; i <= segments; i += 1) {
      const u = i / segments;
      const r = radius * u;
      const axial = -0.04 + sagitta * u * u;
      pts.push(new THREE.Vector2(r, axial));
    }
    // Back face
    for (let i = segments; i >= 0; i -= 1) {
      const u = i / segments;
      const r = radius * u;
      const axial = -0.04 + sagitta * u * u + thickness;
      pts.push(new THREE.Vector2(r, axial));
    }
  }
  return pts;
}

function OpticalRail({ span = 10 }) {
  const railLength = Math.max(14, (span + 2.5) * 2);
  return (
    <group position={[0, -2.65, 0]}>
      {/* Bench base track — bright anodized aluminum */}
      <mesh position={[0, -0.09, 0]}>
        <boxGeometry args={[railLength, 0.16, 0.6]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.55} />
      </mesh>
      {/* Center channel inlay */}
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[railLength, 0.02, 0.22]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.7} />
      </mesh>
      {/* Dual chrome guide rails */}
      <mesh position={[0, 0.04, -0.16]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, railLength, 16]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.1} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0.04, 0.16]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, railLength, 16]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.1} metalness={0.95} />
      </mesh>
      {/* Central zero reference mark */}
      <mesh position={[0, 0.02, 0.32]}>
        <boxGeometry args={[0.06, 0.12, 0.02]} />
        <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function OpticalCarrier({ x = 0, color = "#cbd5e1" }) {
  return (
    <group position={[x, -2.65, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.42, 0.2, 0.64]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.1, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.1, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.08, 0.09, 0.22, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.8} />
      </mesh>
    </group>
  );
}

function DetailedOptic({ type }) {
  const isMirror = type.includes("mirror");
  const isConvex = type.startsWith("convex");
  const isConcave = type.startsWith("concave");

  const lensGeo = useMemo(() => {
    if (isMirror) return null;
    const profile = lensProfile(isConvex ? "convex" : "concave", 1.65, 0.38);
    const geo = new THREE.LatheGeometry(profile, 48);
    geo.computeVertexNormals();
    return geo;
  }, [isMirror, isConvex]);

  const mirrorGeo = useMemo(() => {
    if (!isMirror) return null;
    const profile = mirrorProfile(type, 1.65, 0.16, 0.05, 48);
    const geo = new THREE.LatheGeometry(profile, 48);
    geo.computeVertexNormals();
    return geo;
  }, [isMirror, type]);

  useEffect(() => () => {
    lensGeo?.dispose();
    mirrorGeo?.dispose();
  }, [lensGeo, mirrorGeo]);

  // Casing geometry dimensions calibrated for exact flush seating:
  const bezelLength = !isMirror
    ? (isConvex ? 0.28 : 0.40)
    : (isConcave ? 0.24 : 0.14);
  const bezelCenter = !isMirror
    ? 0
    : (isConcave ? 0.10 : 0.12);
  const backplateX = isMirror
    ? (isConcave ? 0.215 : 0.185)
    : null;

  return (
    <group>
      {/* 3D Optical Glass Element (Lenses) */}
      {!isMirror && lensGeo && (
        <mesh geometry={lensGeo} rotation={[0, 0, -Math.PI / 2]}>
          <meshStandardMaterial
            color="#a5f3fc"
            transparent
            opacity={0.34}
            roughness={0.05}
            metalness={0.12}
            emissive="#38bdf8"
            emissiveIntensity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 3D Curved Mirror (Reflective Face) */}
      {isMirror && mirrorGeo && (
        <group rotation={[0, 0, -Math.PI / 2]}>
          <mesh geometry={mirrorGeo}>
            <meshStandardMaterial
              color="#ffffff"
              roughness={0.02}
              metalness={0.98}
              emissive="#e0f2fe"
              emissiveIntensity={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* Mirror Rear Protective Backplate (snugly covers back of casing) */}
      {isMirror && backplateX !== null && (
        <mesh position={[backplateX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[1.68, 48]} />
          <meshStandardMaterial color="#64748b" roughness={0.35} metalness={0.65} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Bright Precision Retaining Rim Bezel Ring */}
      <mesh position={[bezelCenter, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.70, 1.70, bezelLength, 48, 1, true]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.75} side={THREE.DoubleSide} />
      </mesh>

      {/* Front Bezel Lip Holding Rim */}
      <mesh position={[bezelCenter - bezelLength / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[1.62, 1.70, 48]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Back Bezel Lip */}
      <mesh position={[bezelCenter + bezelLength / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[1.62, 1.70, 48]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Knurled Top Set Screw */}
      <mesh position={[bezelCenter, 1.78, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 16]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.9} emissive="#f59e0b" emissiveIntensity={0.2} />
      </mesh>

      {/* Stainless Steel Vertical Optical Post */}
      <mesh position={[bezelCenter, -1.95, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 1.2, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
      </mesh>

      {/* Bench saddle carriage */}
      <OpticalCarrier x={bezelCenter} color="#cbd5e1" />
    </group>
  );
}

export function LensOpticsScene({ params = {} }) {
  const type = opticsTypeOf(params);
  const focal = typeof params.focal === "number" ? params.focal : 2.5;
  const objectDistance = typeof params.objectDistance === "number" ? params.objectDistance : 5.0;
  const objectHeight = typeof params.objectHeight === "number" ? params.objectHeight : 1.5;
  const showConstruction = params.showConstruction !== false;
  const showRays = params.showRays !== false;
  const showLabels = params.showLabels !== false;

  const u = objectDistance;
  const h = objectHeight;
  const f = focal;

  // Where the image is, from lib/rayOptics.js — the same call the HUD makes,
  // so the panel cannot claim an image the scene is not drawing.
  const solved = solveRayOptics({ type, focal, objectDistance, objectHeight });
  const { atInfinity, v, imgX, imageHeight, magnification: m, real, isMirror, isConverging } = solved;

  const objectTop = [-u, h, 0];
  const span = atInfinity ? u + 2 * f : Math.max(u, Math.abs(v), 2 * f);
  const fit = clamp(9.5 / (span + 2.5), 0.2, 1);
  const FAR = span + 3.5;

  // Ray 1: Parallel in from object tip to optical surface at [0, h, 0]
  const hitParallel = [0, h, 0];
  let parallelRayEnd = [FAR, h, 0];
  let parallelVirtualPoints = null;

  if (isMirror) {
    if (isConverging) {
      // Concave Mirror: reflects through focus [-f, 0, 0] into x < 0
      parallelRayEnd = [-FAR, h - (h / f) * FAR, 0];
      if (!real && !atInfinity) {
        parallelVirtualPoints = [hitParallel, [imgX, imageHeight, 0]];
      }
    } else {
      // Convex Mirror: reflects outward away from virtual focus [+f, 0, 0] into x < 0
      parallelRayEnd = [-FAR, h + (h / f) * FAR, 0];
      parallelVirtualPoints = [hitParallel, [f, 0, 0]];
    }
  } else {
    // Lenses
    if (isConverging) {
      // Convex Lens: refracts through focus [+f, 0, 0] into x > 0
      parallelRayEnd = [FAR, h - (h / f) * FAR, 0];
      if (!real && !atInfinity) {
        parallelVirtualPoints = [hitParallel, [imgX, imageHeight, 0]];
      }
    } else {
      // Concave Lens: refracts diverging away from [-f, 0, 0] into x > 0
      parallelRayEnd = [FAR, h + (h / f) * FAR, 0];
      parallelVirtualPoints = [hitParallel, [-f, 0, 0]];
    }
  }

  // Ray 2: Central / Pole Ray
  let ray2End = [FAR, 0, 0];
  let ray2VirtualPoints = null;

  if (isMirror) {
    // Mirror: reflects symmetrically at vertex [0, 0, 0]
    ray2End = [-FAR, -(h / u) * FAR, 0];
    if (!real && !atInfinity) {
      ray2VirtualPoints = [[0, 0, 0], [imgX, imageHeight, 0]];
    }
  } else {
    // Lens: straight through optical centre [0, 0, 0] undeviated
    ray2End = [FAR, -(h / u) * FAR, 0];
    if (!real && !atInfinity) {
      ray2VirtualPoints = [[0, 0, 0], [imgX, imageHeight, 0]];
    }
  }

  // Ray 3: Focal Ray
  const ray3HitY = atInfinity ? 0 : imageHeight;
  const ray3ReflectedEnd = isMirror ? [-FAR, ray3HitY, 0] : [FAR, ray3HitY, 0];
  const ray3VirtualPoints = (!real && !atInfinity) ? [[0, ray3HitY, 0], [imgX, ray3HitY, 0]] : null;
  const showThirdRay = !atInfinity && Math.abs(u - f) > 1e-3;

  const nature = imageNature(solved);
  const titleMap = OPTICS_TITLES;

  return (
    <SceneCanvas camera={{ position: [0.5, 3.5, 12], fov: 45 }} lights={{ ambient: 0.85, keyLight: 1.8, rim: "#93c5fd" }}>
      <group scale={fit}>
        {/* Optical Bench Base & Guide Rails */}
        <OpticalRail span={span} />

        {/* Principal optical axis */}
        <Line
          points={[
            [-(span + 2.5), 0, 0],
            [span + 2.5, 0, 0],
          ]}
          color={PALETTE.line}
          lineWidth={1.4}
        />

        {/* Optical plane dashed line */}
        <Line
          points={[
            [0, -2.5, 0],
            [0, 2.5, 0],
          ]}
          color="#5b6472"
          lineWidth={1}
          dashed
          dashSize={0.2}
          gapSize={0.16}
        />

        {/* 3D Optical Element (Detailed Lens or Mirror Assembly) */}
        <DetailedOptic type={type} />

        {/* Focal and Center of Curvature (2F) markers */}
        {[-2, -1, 1, 2].map((k) => {
          let labelText = Math.abs(k) === 1 ? "F" : "2F";
          if (isMirror) {
            if (isConverging) {
              // Concave mirror: F is at -f, C is at -2f
              labelText = k === -1 ? "F" : k === -2 ? "C" : k === 1 ? "F'" : "C'";
            } else {
              // Convex mirror: F is behind at +f, C is at +2f
              labelText = k === 1 ? "F" : k === 2 ? "C" : k === -1 ? "F'" : "C'";
            }
          } else {
            labelText = k < 0 ? (k === -1 ? "F" : "2F") : (k === 1 ? "F'" : "2F'");
          }

          return (
            <group key={k} position={[k * f, 0, 0]}>
              <AtomSphere
                position={[0, 0, 0]}
                radius={0.08}
                color={Math.abs(k) === 1 ? PALETTE.gold : "#64748b"}
                emissiveIntensity={1.2}
              />
              {showLabels && (
                <SceneLabel position={[0, -0.42, 0]} tone="text-ink-500">
                  {labelText}
                </SceneLabel>
              )}
            </group>
          );
        })}

        {/* Object Stand & Carrier */}
        <mesh position={[-u, -1.35, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 2.6, 16]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
        </mesh>
        <OpticalCarrier x={-u} color="#cbd5e1" />

        {/* Object Arrow */}
        <VectorArrow
          from={[-u, 0, 0]}
          to={objectTop}
          color={PALETTE.gold}
          label={showLabels ? "object" : undefined}
          labelOffset={0.3}
        />

        {/* ─── Principal Rays ─── */}
        {showRays && (
          <>
            {/* Ray 1: Parallel to axis, then focus refraction/reflection */}
            <Line points={[objectTop, hitParallel]} color={PALETTE.emerald} lineWidth={2.4} />
            <Line points={[hitParallel, parallelRayEnd]} color={PALETTE.emerald} lineWidth={2.4} />

            {/* Ray 2: Optical Center (Lens) / Vertex Pole Reflection (Mirror) */}
            {isMirror ? (
              <>
                <Line points={[objectTop, [0, 0, 0]]} color={PALETTE.sky} lineWidth={2.4} />
                <Line points={[[0, 0, 0], ray2End]} color={PALETTE.sky} lineWidth={2.4} />
              </>
            ) : (
              <Line points={[objectTop, ray2End]} color={PALETTE.sky} lineWidth={2.4} />
            )}

            {/* Ray 3: Focal Ray */}
            {showConstruction && showThirdRay && (
              <>
                <Line points={[objectTop, [0, ray3HitY, 0]]} color={PALETTE.violet} lineWidth={2.2} />
                <Line points={[[0, ray3HitY, 0], ray3ReflectedEnd]} color={PALETTE.violet} lineWidth={2.2} />
              </>
            )}

            {/* Virtual ray back-extensions */}
            {showConstruction && !real && !atInfinity && (
              <>
                {parallelVirtualPoints && (
                  <Line
                    points={parallelVirtualPoints}
                    color={PALETTE.emerald}
                    lineWidth={1.5}
                    transparent
                    opacity={0.6}
                    dashed
                    dashSize={0.22}
                    gapSize={0.16}
                  />
                )}
                {ray2VirtualPoints && (
                  <Line
                    points={ray2VirtualPoints}
                    color={PALETTE.sky}
                    lineWidth={1.5}
                    transparent
                    opacity={0.6}
                    dashed
                    dashSize={0.22}
                    gapSize={0.16}
                  />
                )}
                {ray3VirtualPoints && (
                  <Line
                    points={ray3VirtualPoints}
                    color={PALETTE.violet}
                    lineWidth={1.5}
                    transparent
                    opacity={0.6}
                    dashed
                    dashSize={0.22}
                    gapSize={0.16}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* Real image projection screen */}
        {real && (
          <group position={[imgX, 0, 0]}>
            <mesh position={[0, -1.8, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 1.7, 16]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.15} metalness={0.95} />
            </mesh>
            <OpticalCarrier x={0} color="#cbd5e1" />
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.08, Math.max(2.4, Math.abs(imageHeight) * 2.2), 2.2]} />
              <meshStandardMaterial
                color="#f8fafc"
                transparent
                opacity={0.25}
                roughness={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
            {showLabels && (
              <SceneLabel position={[0, -Math.max(1.4, Math.abs(imageHeight) * 1.2) - 0.35, 0]} tone="text-ink-400">
                screen
              </SceneLabel>
            )}
          </group>
        )}

        {/* Image Arrow */}
        {!atInfinity && (
          <VectorArrow
            from={[imgX, 0, 0]}
            to={[imgX, imageHeight, 0]}
            color={real ? PALETTE.emerald : PALETTE.rose}
            opacity={real ? 1 : 0.7}
            label={showLabels ? (real ? "real image" : "virtual image") : undefined}
            labelOffset={imageHeight < 0 ? -0.32 : 0.32}
          />
        )}

      </group>
    </SceneCanvas>
  );
}

// ═══ 4 · Electromagnetic induction & Faraday's law ════════════════════
// The coil geometry and Faraday's law itself live in lib/induction.js, so
// the HUD readout beside this scene reads the same numbers it does.

/**
 * Universal Laboratory Table / Workbench Base
 * Sits below all apparatus at y = -2.98 so top surface is at y = -2.80.
 * Meters and bulbs rest firmly on top of this surface.
 */
function LaboratoryBench() {
  return (
    <group position={[0, -3.48, 0]}>
      {/* Tabletop slab: top face at y = -3.30 */}
      <mesh>
        <boxGeometry args={[11.6, 0.36, 4.4]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* Front edge satin beveled trim */}
      <mesh position={[0, 0, 2.21]}>
        <boxGeometry args={[11.64, 0.38, 0.04]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Four rubber vibration-damping feet */}
      {[
        [-5.3, -0.24, -1.8],
        [5.3, -0.24, -1.8],
        [-5.3, -0.24, 1.8],
        [5.3, -0.24, 1.8],
      ].map(([fx, fy, fz], idx) => (
        <mesh key={idx} position={[fx, fy, fz]}>
          <cylinderGeometry args={[0.22, 0.26, 0.16, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Modern Laboratory Center-Zero Galvanometer
 * Base sits on table (y = -3.30), standing upright into clear view.
 *
 * The scale is an arc about the needle's own pivot, so the tip sweeps along
 * it. It used to be drawn about a different centre and the needle fell short
 * of the scale at full deflection.
 */
const METER = { pivotY: 0.33, arcR: 0.72, needle: 0.66, sweep: 1.05 };

const meterPoint = (angle, r) => [
  r * Math.sin(angle),
  METER.pivotY + r * Math.cos(angle),
  0.21,
];

function LaboratoryGalvanometer({ position = [-1.3, -3.3, 1.35], needleRef }) {
  const arc = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) =>
        meterPoint(-METER.sweep + (2 * METER.sweep * i) / 24, METER.arcR),
      ),
    [],
  );
  const ticks = useMemo(
    () =>
      [-1, -0.5, 0, 0.5, 1].map((f) => {
        const long = f === 0 ? 0.11 : 0.07;
        return [
          meterPoint(f * METER.sweep, METER.arcR),
          meterPoint(f * METER.sweep, METER.arcR + long),
        ];
      }),
    [],
  );

  return (
    <group position={position}>
      {/* Slate chassis box: base at y=0, height 1.3 */}
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[2.2, 1.3, 0.35]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Polished chrome front bezel */}
      <mesh position={[0, 0.65, 0.18]}>
        <boxGeometry args={[2.08, 1.18, 0.04]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Porcelain white dial face */}
      <mesh position={[0, 0.65, 0.205]}>
        <planeGeometry args={[1.96, 1.06]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.8} />
      </mesh>
      {/* Scale arc, concentric with the needle pivot, and its ticks */}
      <Line points={arc} color="#64748b" lineWidth={1.5} />
      {ticks.map((pts, idx) => (
        <Line key={idx} points={pts} color="#475569" lineWidth={1.8} />
      ))}

      {/* Needle pivot */}
      <mesh position={[0, METER.pivotY, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Pivoted high-visibility red needle */}
      <group ref={needleRef} position={[0, METER.pivotY, 0.23]}>
        <mesh position={[0, METER.needle / 2, 0]}>
          <boxGeometry args={[0.035, METER.needle, 0.02]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Terminal binding posts */}
      <mesh position={[-0.85, 0.2, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
        <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0.85, 0.2, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Centre-zero, with the two senses of deflection labelled outside the arc */}
      <SceneLabel position={[0, 1.2, 0.22]} tone="text-ink-400">
        0
      </SceneLabel>
      <SceneLabel position={[-0.82, 0.58, 0.22]} tone="text-ink-500">
        −
      </SceneLabel>
      <SceneLabel position={[0.82, 0.58, 0.22]} tone="text-ink-500">
        +
      </SceneLabel>
      <SceneLabel position={[0, -0.28, 0]} tone="text-ink-400">
        galvanometer
      </SceneLabel>
    </group>
  );
}

/**
 * Laboratory Demonstration Incandescent Light Bulb
 * Base sits on table (y = -3.30), standing upright with filament and light shining up and out.
 */
function DemonstrationBulb({ position = [1.8, -3.3, 1.35], powerRef, showBulb = true }) {
  if (!showBulb) return null;
  return (
    <group position={position}>
      {/* Porcelain Ceramic Socket Base */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.42, 0.48, 0.3, 24]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Brass Threaded Screw Collar */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.22, 24]} />
        <meshStandardMaterial color="#d97706" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Blown Glass Envelope */}
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.44, 24, 24]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.88}
          roughness={0.12}
          transparent={true}
          opacity={0.38}
          ior={1.5}
        />
      </mesh>
      {/* Tungsten Filament Hairpin Loop */}
      <mesh
        ref={(el) => {
          if (powerRef) powerRef.filament = el;
        }}
        position={[0, 0.78, 0]}
      >
        <torusGeometry args={[0.13, 0.022, 12, 24, Math.PI * 1.6]} />
        <meshStandardMaterial
          color="#64748b"
          emissive="#fef08a"
          emissiveIntensity={0}
          toneMapped={false}
        />
      </mesh>
      {/* Filament Support Leads */}
      <mesh position={[-0.08, 0.56, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.24, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.08, 0.56, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.24, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Dynamic Incandescent Light Source */}
      <pointLight
        ref={(el) => {
          if (powerRef) powerRef.light = el;
        }}
        position={[0, 0.82, 0.15]}
        color="#fef08a"
        intensity={0}
        distance={5.5}
        decay={2}
      />

      {/* Terminals on socket */}
      <mesh position={[-0.34, 0.15, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.34, 0.15, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
      </mesh>

      <SceneLabel position={[0, -0.28, 0]} tone="text-ink-400">
        demonstration bulb (P ∝ ε²)
      </SceneLabel>
    </group>
  );
}

/** Cumulative arc length at each vertex of a polyline. */
function polylineLengths(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(
      cum[i - 1] +
        Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]),
    );
  }
  return cum;
}

/** The point a distance `s` along a polyline, wrapping round at the ends. */
function pointAlong(pts, cum, s) {
  const total = cum[cum.length - 1];
  const d = ((s % total) + total) % total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i += 1;
  const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  const a = pts[i - 1];
  const b = pts[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A wire drawn as straight lengths with a rounded joint at every bend. */
function Wire({ pts, radius = 0.05, color = "#ea580c", emissive = "#fb923c" }) {
  return (
    <>
      {pts.slice(1).map((p, i) => (
        <Bond key={i} from={pts[i]} to={p} radius={radius} color={color} emissive={emissive} />
      ))}
      {pts.slice(1, -1).map((p, i) => (
        <mesh key={`joint-${i}`} position={p}>
          <sphereGeometry args={[radius, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={0.7}
            roughness={0.4}
            metalness={0.2}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * Live e.m.f.–time trace for AC Generator over two periods.
 *
 * The vertical scale steps through round voltages (5, 10, 20, 50 …) and the
 * ends of it are labelled, so the height of the wave is a real reading. It
 * used to be clamped to a fixed height, which flattened every setting above
 * a modest N·B·speed onto the same wave.
 */
const TRACE = { width: 5.6, height: 0.82, periods: 2 };
const VOLT_STEPS = [5, 10, 20, 50, 100, 200, 500, 1000];
const voltScale = (peak) =>
  VOLT_STEPS.find((v) => v >= peak) ?? Math.ceil(peak / 1000) * 1000;

function EmfTrace({ speed, field, turns, angleRef }) {
  const marker = useRef(null);
  const omega = omegaOf(speed);
  const safeTurns = safeTurnsOf(turns);
  const peak = peakEmf(field, omega, safeTurns);
  const fullScale = voltScale(peak);

  const amp = (peak / fullScale) * TRACE.height;
  const sweep = TRACE.periods * Math.PI * 2;
  const xOf = (angle) => -TRACE.width / 2 + (((angle % sweep) + sweep) % sweep) / sweep * TRACE.width;
  // ε = N B A ω sin ωt: zero at t = 0, rising, back to zero at T/2.
  const yOf = (angle) => amp * Math.sin(angle);

  const curve = useMemo(() => {
    const pts = [];
    for (let k = 0; k <= 200; k += 1) {
      const angle = (k / 200) * sweep;
      pts.push([-TRACE.width / 2 + (k / 200) * TRACE.width, amp * Math.sin(angle), 0]);
    }
    return pts;
  }, [amp, sweep]);

  useFrame(() => {
    if (!marker.current) return;
    marker.current.position.set(xOf(angleRef.current), yOf(angleRef.current), 0);
  });

  const left = -TRACE.width / 2;
  return (
    <group position={[0, 4.0, 0]}>
      {/* Time axis (ε = 0) */}
      <Line
        points={[
          [left - 0.3, 0, 0],
          [TRACE.width / 2 + 0.3, 0, 0],
        ]}
        color={PALETTE.line}
        lineWidth={1.4}
      />
      {/* Full-scale limits, so the wave's height can be read off */}
      {[TRACE.height, -TRACE.height].map((y) => (
        <Line
          key={y}
          points={[
            [left, y, 0],
            [TRACE.width / 2, y, 0],
          ]}
          color={PALETTE.line}
          lineWidth={1}
          transparent
          opacity={0.3}
          dashed
          dashSize={0.1}
          gapSize={0.14}
        />
      ))}
      {/* Half-period gridlines: T/2, T and 3T/2 */}
      {[0.25, 0.5, 0.75].map((t) => (
        <Line
          key={t}
          points={[
            [left + t * TRACE.width, -TRACE.height, 0],
            [left + t * TRACE.width, TRACE.height, 0],
          ]}
          color={PALETTE.line}
          lineWidth={1}
          transparent
          opacity={0.35}
          dashed
          dashSize={0.12}
          gapSize={0.12}
        />
      ))}
      <Line points={curve} color={PALETTE.gold} lineWidth={2.4} />

      <mesh ref={marker}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial
          color={PALETTE.gold}
          emissive={PALETTE.gold}
          emissiveIntensity={2.6}
          toneMapped={false}
        />
      </mesh>

      <SceneLabel position={[left - 0.75, TRACE.height, 0]} tone="text-ink-400">
        {`+${fullScale} V`}
      </SceneLabel>
      <SceneLabel position={[left - 0.75, 0, 0]} tone="text-ink-400">
        0
      </SceneLabel>
      <SceneLabel position={[left - 0.75, -TRACE.height, 0]} tone="text-ink-400">
        {`−${fullScale} V`}
      </SceneLabel>
      <SceneLabel position={[0, -TRACE.height - 0.28, 0]} tone="text-ink-400">
        T
      </SceneLabel>
      <SceneLabel position={[TRACE.width / 2, -TRACE.height - 0.28, 0]} tone="text-ink-400">
        2T
      </SceneLabel>
      <SceneLabel position={[TRACE.width / 2 + 0.6, 0, 0]} tone="text-ink-400">
        t
      </SceneLabel>
      <SceneLabel position={[0, TRACE.height + 0.35, 0]} accent>
        induced e.m.f. ε = NBAω sin ωt · two periods
      </SceneLabel>
    </group>
  );
}

// The two coil ends sit either side of the axle, and each goes down to its
// own slip ring.
const GEN_LEAD_X = 0.13;
// Spacing between successive turns of the winding, along the coil's normal.
const GEN_WIRE_PITCH = 0.13;
const GEN_DOTS = 20;

/**
 * Generator Assembly Sub-Rig (Inside Canvas)
 */
function GeneratorRig({ params = {} }) {
  const {
    speed = 1.0,
    field = 1.0,
    turns = 3,
    showFieldLines = true,
    showCurrent = true,
    showBulb = true,
  } = params || {};

  const safeTurns = safeTurnsOf(turns);
  const [emfNow, setEmfNow] = useState(0);
  const angleRef = useRef(0);

  const coil = useRef(null);
  const needle = useRef(null);
  const bulbRef = useRef({});
  const fluxPlane = useRef(null);
  const currentPhase = useRef(0);
  const currentDots = useRef([]);
  const sampleClock = useRef(0);

  const w = COIL_W;
  const hh = COIL_H;

  const fieldLines = useMemo(() => {
    const lines = [];
    for (let y = -1.0; y <= 1.41; y += 0.8) {
      for (let z = -1.2; z <= 1.21; z += 1.2) lines.push({ y, z });
    }
    return lines;
  }, []);

  const omega = omegaOf(speed);
  const peak = peakEmf(field, omega, safeTurns);

  // One continuous wire wound `safeTurns` times, open at the bottom: it starts
  // on one side of the axle and finishes on the other, and those two ends are
  // all that reach the slip rings. (It used to be a closed rectangle with both
  // leads on the bottom edge, which shorted the output through the coil.)
  // The path runs up the right-hand side, so it is anticlockwise seen from the
  // coil's normal — the way a positive e.m.f. drives the current.
  const winding = useMemo(() => {
    const flat = [[GEN_LEAD_X, -hh]];
    for (let k = 0; k < safeTurns; k += 1) flat.push([w, -hh], [w, hh], [-w, hh], [-w, -hh]);
    flat.push([-GEN_LEAD_X, -hh]);
    const zSpan = GEN_WIRE_PITCH * (safeTurns - 1);
    const pts = flat.map(([x, y], i) => [x, y, -zSpan / 2 + (zSpan * i) / (flat.length - 1)]);
    return { pts, cum: polylineLengths(pts), zSpan };
  }, [safeTurns, w, hh]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    angleRef.current += step * omega;

    const emf = emfAt(field, omega, angleRef.current, safeTurns);

    // θ = 0 is the coil face-on to the field (its normal along +x), which is
    // where the flux is greatest and the e.m.f. zero.
    if (coil.current) coil.current.rotation.y = Math.PI / 2 + angleRef.current;
    if (needle.current) needle.current.rotation.z = clamp(-emf * 0.015, -1.05, 1.05);

    // Physical power dissipation: P = V^2 / R
    // Calibrated rated reference: V_rated = 115 V so N=1..8 and B=0.2..2.0 smoothly ramp across full incandescence
    const vRated = 115.0;
    const ratio = Math.abs(emf) / vRated;
    const power = clamp(Math.pow(ratio, 1.6), 0, 2.8);

    if (bulbRef.current?.filament) {
      if (speed < 0.05 || power < 0.02) {
        bulbRef.current.filament.material.emissiveIntensity = 0;
        bulbRef.current.filament.material.color.set("#64748b");
      } else {
        const r = 1.0;
        const g = clamp(0.35 + power * 0.45, 0.35, 1.0);
        const b = clamp(0.04 + power * 0.76, 0.04, 0.96);
        bulbRef.current.filament.material.color.setRGB(r, g, b);
        bulbRef.current.filament.material.emissive.setRGB(r, g, b);
        bulbRef.current.filament.material.emissiveIntensity = clamp(power * 2.8, 0.3, 7.5);
      }
    }
    if (bulbRef.current?.light) {
      bulbRef.current.light.intensity = speed < 0.05 ? 0 : clamp(power * 3.6, 0, 9.0);
      bulbRef.current.light.distance = clamp(3.0 + power * 2.5, 3.0, 9.0);
    }

    // The flux sheet shows |Φ| = B A |cos θ|: full when face-on, gone edge-on.
    if (fluxPlane.current) {
      const face = Math.abs(Math.cos(angleRef.current));
      fluxPlane.current.material.opacity = 0.04 + face * 0.38 * Math.min(field, 1.5);
    }

    // Conventional current, carried round the actual wire. Positive e.m.f.
    // runs the way the path is drawn; negative runs it backwards.
    if (showCurrent) {
      currentPhase.current += step * emf * 0.2;
      const total = winding.cum[winding.cum.length - 1];
      currentDots.current.forEach((dot, idx) => {
        if (!dot) return;
        const p = pointAlong(winding.pts, winding.cum, (idx / GEN_DOTS) * total + currentPhase.current);
        dot.position.set(p[0], p[1], p[2]);
      });
    }

    sampleClock.current += step;
    if (sampleClock.current > 0.1) {
      sampleClock.current = 0;
      setEmfNow(emf);
    }
  });

  // Steady arrows would be right for half a turn and wrong for the other half:
  // these follow the sign of the e.m.f. and go out while it passes through zero.
  const arrow =
    Math.abs(emfNow) < Math.max(0.05, 0.04 * peak) ? 0 : Math.sign(emfNow);
  const arrowZ = winding.zSpan / 2 + 0.2;

  return (
    <>
      {/* Bench Baseplate (y = -2.98, top surface at y = -2.80) */}
      <LaboratoryBench />

      {/* Magnet Pole Riser Pedestals (bench y = -3.30 to pole bottom y = -1.60, zero Z-fighting) */}
      <mesh position={[-3.4, -2.45, 0]}>
        <boxGeometry args={[0.85, 1.7, 3.4]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[3.4, -2.45, 0]}>
        <boxGeometry args={[0.85, 1.7, 3.4]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Magnet Poles at y = 0.2 */}
      <MagnetPole position={[-3.4, 0.2, 0]} pole="N" />
      <MagnetPole position={[3.4, 0.2, 0]} pole="S" />

      {/* Lower Pillow Bearing Block on Bench (rests on tabletop y = -3.30) */}
      <mesh position={[0, -3.2, 0]}>
        <boxGeometry args={[0.5, 0.2, 0.5]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Magnetic Field Lines, N to S, running from face to face of the poles */}
      {showFieldLines &&
        fieldLines.map(({ y, z }, i) => (
          <group key={i}>
            <Line
              points={[
                [-3.05, y, z],
                [3.05, y, z],
              ]}
              color={PALETTE.sky}
              lineWidth={1.2}
              transparent
              opacity={0.25 + field * 0.25}
              dashed
              dashSize={0.26}
              gapSize={0.2}
            />
            <VectorArrow
              from={[-0.2, y, z]}
              to={[0.2, y, z]}
              color={PALETTE.sky}
              radius={0.02}
              headLength={0.16}
              headRadius={0.06}
            />
          </group>
        ))}

      {/* Rotating Coil Assembly at y = 0.2 */}
      <group position={[0, 0.2, 0]}>
        <group ref={coil}>
          {/* Semi-transparent magnetic flux sheet */}
          <mesh ref={fluxPlane} position={[0, 0, 0]}>
            <planeGeometry args={[2 * w - 0.08, 2 * hh - 0.08]} />
            <meshStandardMaterial
              color="#38bdf8"
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
              roughness={0.2}
            />
          </mesh>

          {/* The winding: one wire, N turns, both ends free */}
          <Wire pts={winding.pts} radius={0.055} />

          {/* Insulating mount joining the winding to the axle */}
          <mesh position={[0, -1.13, 0]}>
            <boxGeometry args={[0.16, 0.12, winding.zSpan + 0.3]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.3} />
          </mesh>

          {/* Dynamic charge flow particles */}
          {showCurrent &&
            Array.from({ length: GEN_DOTS }, (_, idx) => (
              <mesh
                key={idx}
                ref={(el) => {
                  currentDots.current[idx] = el;
                }}
                position={[0, 0, 0]}
              >
                <sphereGeometry args={[0.065, 12, 12]} />
                <meshStandardMaterial
                  color="#fef08a"
                  emissive="#fef08a"
                  emissiveIntensity={2.5}
                  toneMapped={false}
                />
              </mesh>
            ))}

          {/* Coil ends, one to each slip ring */}
          <Wire
            pts={[
              winding.pts[0],
              [GEN_LEAD_X, -1.14, 0],
              [GEN_LEAD_X, -1.45, 0],
              [0.2, -1.45, 0],
            ]}
            radius={0.04}
          />
          <Wire
            pts={[
              winding.pts[winding.pts.length - 1],
              [-GEN_LEAD_X, -1.14, 0],
              [-GEN_LEAD_X, -1.85, 0],
              [-0.2, -1.85, 0],
            ]}
            radius={0.04}
          />

          {/* Drive shaft, carrying the mount and the two rings */}
          <mesh position={[0, -2.295, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 2.21, 16]} />
            <meshStandardMaterial color="#f1f5f9" metalness={0.9} roughness={0.15} />
          </mesh>

          {/* Polished Brass Slip Rings, each held off the shaft by a spoke */}
          {[-1.45, -1.85].map((y) => (
            <group key={y}>
              <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.24, 0.06, 12, 32]} />
                <meshStandardMaterial
                  color="#fbbf24"
                  metalness={0.88}
                  roughness={0.18}
                  emissive="#f59e0b"
                  emissiveIntensity={0.15}
                />
              </mesh>
              <Bond from={[0, y, -0.24]} to={[0, y, 0.24]} radius={0.028} color="#475569" />
            </group>
          ))}

          {/* Induced current: right side up, left side down is anticlockwise
              seen from the normal — the direction of a positive e.m.f. */}
          {showCurrent && arrow !== 0 && (
            <>
              <VectorArrow
                from={[w, arrow > 0 ? -0.5 : 0.6, arrowZ]}
                to={[w, arrow > 0 ? 0.6 : -0.5, arrowZ]}
                color={PALETTE.gold}
                radius={0.04}
                headLength={0.26}
                headRadius={0.11}
              />
              <VectorArrow
                from={[-w, arrow > 0 ? 0.5 : -0.6, arrowZ]}
                to={[-w, arrow > 0 ? -0.6 : 0.5, arrowZ]}
                color={PALETTE.gold}
                radius={0.04}
                headLength={0.26}
                headRadius={0.11}
              />
            </>
          )}
        </group>

        {/* Brush Carriers */}
        {[
          { y: -1.45, x: 0.42 },
          { y: -1.85, x: -0.42 },
        ].map(({ y, x }) => (
          <group key={y}>
            <mesh position={[x, y, 0]}>
              <boxGeometry args={[0.22, 0.16, 0.28]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[x > 0 ? x - 0.12 : x + 0.12, y, 0]}>
              <boxGeometry args={[0.06, 0.14, 0.24]} />
              <meshStandardMaterial color="#475569" roughness={0.7} />
            </mesh>
          </group>
        ))}

        <SceneLabel position={[1.55, -1.65, 0]} tone="text-ink-400">
          slip rings & brushes
        </SceneLabel>
      </group>

      {/* Insulated wiring from the brushes down to the galvanometer & bulb.
          The brushes sit in a group raised 0.2, so their world height is
          their local height + 0.2 — the wires begin on the underside of each. */}
      <Line
        points={[
          [-0.42, -1.73, 0],
          [-0.42, -3.25, 0],
          [-2.15, -3.25, 1.15],
          [-2.15, -3.10, 1.35],
        ]}
        color="#ea580c"
        lineWidth={2.2}
      />
      <Line
        points={[
          [0.42, -1.33, 0],
          [0.42, -3.25, 0],
          [-0.45, -3.25, 1.15],
          [-0.45, -3.10, 1.35],
        ]}
        color="#38bdf8"
        lineWidth={2.2}
      />
      {showBulb && (
        <>
          <Line
            points={[
              [-0.42, -1.73, 0],
              [-0.42, -3.25, 0],
              [1.46, -3.25, 1.15],
              [1.46, -3.15, 1.35],
            ]}
            color="#ea580c"
            lineWidth={2.2}
          />
          <Line
            points={[
              [0.42, -1.33, 0],
              [0.42, -3.25, 0],
              [2.14, -3.25, 1.15],
              [2.14, -3.15, 1.35],
            ]}
            color="#38bdf8"
            lineWidth={2.2}
          />
        </>
      )}

      {/* Bench-Mounted Instruments (Sitting ON Table at y = -3.30, foreground at z = 1.35) */}
      <LaboratoryGalvanometer
        position={[-1.3, -3.3, 1.35]}
        needleRef={needle}
      />
      <DemonstrationBulb
        position={[1.8, -3.3, 1.35]}
        powerRef={bulbRef.current}
        showBulb={showBulb}
      />

      <EmfTrace speed={speed} field={field} turns={turns} angleRef={angleRef} />

    </>
  );
}

// ─── Bar magnet & solenoid ───────────────────────────────────────────

/** Where the wire is at angle `a` round a helix of `turns` turns (in the coil's own frame). */
function helixPoint(a, turns) {
  // Anticlockwise seen from +x as `a` grows — the direction of a positive
  // e.m.f. — advancing one TURN_PITCH per turn. It starts and finishes at the
  // bottom of the coil, where the leads go down.
  return [
    -(turns * TURN_PITCH) / 2 + (a / (2 * Math.PI)) * TURN_PITCH,
    -SOLENOID_RADIUS * Math.cos(a),
    -SOLENOID_RADIUS * Math.sin(a),
  ];
}

// Half the length of the bobbin the coil is wound on, and the flange radius.
const BOBBIN_HALF = 0.75;
const BOBBIN_BORE = 0.9;
const BOBBIN_FLANGE = 1.18;

/**
 * Solenoid Assembly Sub-Rig (Inside Canvas)
 */
function SolenoidRig({ params = {} }) {
  const {
    speed = 1.0,
    turns = 4,
    magnetStrength = 1.2,
    magnetPos = 0,
    autoOscillate = true,
    flipPoles = false,
    showFieldLines = true,
    showCurrent = true,
    showBulb = true,
  } = params || {};

  const safeTurns = safeTurnsOf(turns);
  const safePos = typeof magnetPos === "number" && !isNaN(magnetPos) ? magnetPos : 0;

  const magnetRef = useRef(null);
  const needleRef = useRef(null);
  const bulbRef = useRef({});
  const chargesRef = useRef([]);
  const magnetX = useRef(safePos);
  const oscPhase = useRef(0);
  const currentPhase = useRef(0);
  const sampleClock = useRef(0);

  const [sample, setSample] = useState(() => ({ emf: 0, inducedField: 0 }));

  // Picking the auto-shaker up where the magnet is, not where it last left off.
  useEffect(() => {
    if (autoOscillate) oscPhase.current = Math.asin(clamp(magnetX.current / 3.2, -1, 1));
  }, [autoOscillate]);

  const chargeCount = clamp(safeTurns * 6, 12, 36);

  // A real helix, wound anticlockwise from +x, starting and ending at the bottom.
  const span = 2 * Math.PI * safeTurns;
  const helix = useMemo(() => {
    const steps = safeTurns * 40;
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
      pts.push(new THREE.Vector3(...helixPoint((i / steps) * span, safeTurns)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, 0.05, 10, false);
  }, [safeTurns, span]);
  useEffect(() => () => helix.dispose(), [helix]);

  const flange = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(BOBBIN_BORE, -0.04),
          new THREE.Vector2(BOBBIN_FLANGE, -0.04),
          new THREE.Vector2(BOBBIN_FLANGE, 0.04),
          new THREE.Vector2(BOBBIN_BORE, 0.04),
          new THREE.Vector2(BOBBIN_BORE, -0.04),
        ],
        48,
      ),
    [],
  );
  useEffect(() => () => flange.dispose(), [flange]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    let x = magnetX.current;
    let v = 0;

    if (autoOscillate) {
      const rate = speed * MAGNET_OMEGA;
      oscPhase.current += step * rate;
      x = 3.2 * Math.sin(oscPhase.current);
      v = 3.2 * Math.cos(oscPhase.current) * rate;
    } else {
      const targetX = typeof magnetPos === "number" && !isNaN(magnetPos) ? magnetPos : 0;
      const diff = targetX - x;
      const move = diff * (1 - Math.exp(-9.0 * step));
      v = move / Math.max(step, 0.001);
      x += move;
    }
    magnetX.current = x;
    if (magnetRef.current) magnetRef.current.position.x = x;

    const induction = solveSolenoidInduction({
      x,
      velocity: v,
      turns: safeTurns,
      magnetStrength,
      flipPoles,
    });

    if (needleRef.current) {
      needleRef.current.rotation.z = clamp(-induction.emf * 0.018, -1.05, 1.05);
    }

    // Physical power dissipation: P = V^2 / R
    // Calibrated rated reference: V_rated = 85 V so N=1..8 and strength=0.5..2.5 smoothly ramp across full incandescence
    const vRated = 85.0;
    const ratio = Math.abs(induction.emf) / vRated;
    const power = clamp(Math.pow(ratio, 1.6), 0, 2.8);

    if (bulbRef.current?.filament) {
      if (power < 0.02) {
        bulbRef.current.filament.material.emissiveIntensity = 0;
        bulbRef.current.filament.material.color.set("#64748b");
      } else {
        const r = 1.0;
        const g = clamp(0.35 + power * 0.45, 0.35, 1.0);
        const b = clamp(0.04 + power * 0.76, 0.04, 0.96);
        bulbRef.current.filament.material.color.setRGB(r, g, b);
        bulbRef.current.filament.material.emissive.setRGB(r, g, b);
        bulbRef.current.filament.material.emissiveIntensity = clamp(power * 2.8, 0.3, 7.5);
      }
    }
    if (bulbRef.current?.light) {
      bulbRef.current.light.intensity = clamp(power * 3.6, 0, 9.0);
      bulbRef.current.light.distance = clamp(3.0 + power * 2.5, 3.0, 9.0);
    }

    // Conventional current round the actual turns: positive e.m.f. runs the
    // way the helix is wound, negative the other way, and nothing at rest.
    if (showCurrent) {
      currentPhase.current += step * 0.1 * clamp(induction.emf, -60, 60);
      chargesRef.current.forEach((dot, idx) => {
        if (!dot) return;
        const a = (((idx / chargeCount) * span + currentPhase.current) % span + span) % span;
        const p = helixPoint(a, safeTurns);
        dot.position.set(p[0], p[1], p[2]);
      });
    }

    sampleClock.current += step;
    if (sampleClock.current > 0.1) {
      sampleClock.current = 0;
      setSample({ emf: induction.emf, inducedField: induction.inducedField });
    }
  });

  // Field lines leave the north pole and re-enter at the south, so the arrow on
  // each outer loop points from N to S.
  const dipoleLoops = useMemo(() => {
    const loops = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const pts = [];
      const steps = 36;
      for (let s = 0; s <= steps; s++) {
        const t = (s / steps) * Math.PI;
        const lx = 1.35 * Math.cos(t);
        const lr = 1.75 * Math.sin(t);
        pts.push([lx, lr * ca, lr * sa]);
      }
      loops.push({ pts, top: [0, 1.75 * ca, 1.75 * sa] });
    }
    return loops;
  }, []);

  // The bar's field inside the coil is what Lenz's law answers: the induced
  // field points along the axis, and the end it leaves from is a north pole.
  const north = sample.inducedField;
  const startPt = helixPoint(0, safeTurns);
  const endPt = helixPoint(span, safeTurns);
  // The coil ends go straight down to the bench, then along it to the two
  // instruments. Each wire starts at its own end of the helix: the group the
  // coil sits in is raised 0.2, hence the + 0.2.
  const circuitWire = (from, side, terminal) => [
    [from[0], 0.2 + from[1], 0],
    [from[0], -1.1, 0],
    [side * 0.55, -1.4, 0],
    [side * 0.55, -3.25, 0],
    [terminal[0], -3.25, 1.15],
    terminal,
  ];

  return (
    <>
      {/* Bench Baseplate (y = -3.48, top surface at y = -3.30) */}
      <LaboratoryBench />

      {/* Non-magnetic guide rod along the axis, held at both ends well clear of
          the magnet's travel. The magnet slides on it; nothing else has to pass
          through the coil. */}
      <group position={[0, 0.2, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 11.2, 16]} />
          <meshStandardMaterial color="#f1f5f9" metalness={0.92} roughness={0.1} />
        </mesh>
        {[-5.5, 5.5].map((px) => (
          <group key={px}>
            <mesh position={[px, -1.75, 0]}>
              <cylinderGeometry args={[0.07, 0.09, 3.5, 14]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[px, 0, 0]}>
              <sphereGeometry args={[0.13, 16, 16]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        ))}

        {/* Bobbin: a clear tube between two flanges, standing on a post under each */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[BOBBIN_BORE, BOBBIN_BORE, BOBBIN_HALF * 2, 40, 1, true]} />
          <meshPhysicalMaterial
            color="#e2e8f0"
            transparent
            opacity={0.2}
            roughness={0.1}
            transmission={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
        {[-BOBBIN_HALF, BOBBIN_HALF].map((fx) => (
          <group key={fx}>
            <mesh geometry={flange} position={[fx, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[fx, -(BOBBIN_FLANGE + 3.5) / 2, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 3.5 - BOBBIN_FLANGE, 16]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {/* The winding */}
        <mesh geometry={helix}>
          <meshStandardMaterial
            color="#ea580c"
            emissive="#fb923c"
            emissiveIntensity={0.2}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Circulating charge dots visualizing induced current flow */}
        {showCurrent &&
          Array.from({ length: chargeCount }, (_, idx) => (
            <mesh
              key={`charge-${idx}`}
              ref={(el) => {
                chargesRef.current[idx] = el;
              }}
              position={[0, 0, 0]}
            >
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#fef08a"
                emissiveIntensity={2.5}
                toneMapped={false}
              />
            </mesh>
          ))}

        {/* Lenz's law: the induced field opposes the change in flux, and the
            end of the coil it leaves from is a north pole. */}
        {north !== 0 && (
          <group>
            <VectorArrow
              from={[-0.6 * north, 0, 0]}
              to={[0.6 * north, 0, 0]}
              color={PALETTE.emerald}
              radius={0.06}
              headLength={0.32}
              headRadius={0.14}
            />
            <SceneLabel position={[0, 1.45, 0]} tone="text-emerald-400">
              B_induced opposes ΔΦ
            </SceneLabel>
            <SceneLabel position={[1.85 * north, -1.2, 0]} tone="text-rose-300">
              induced N
            </SceneLabel>
            <SceneLabel position={[-1.85 * north, -1.2, 0]} tone="text-sky-300">
              induced S
            </SceneLabel>
          </group>
        )}

        <SceneLabel position={[0, -1.2, 0]} tone="text-ink-400">
          copper solenoid ({safeTurns} turns)
        </SceneLabel>
      </group>

      {/* Movable Bar Magnet, threaded on the guide rod */}
      <group ref={magnetRef} position={[magnetX.current, 0.2, 0]}>
        {/* North Pole Half */}
        <mesh
          position={[flipPoles ? -0.7 : 0.7, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.62, 0.62, 1.35, 32]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={0.25}
            roughness={0.25}
            metalness={0.65}
          />
        </mesh>

        {/* South Pole Half */}
        <mesh
          position={[flipPoles ? 0.7 : -0.7, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.62, 0.62, 1.35, 32]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={0.25}
            roughness={0.25}
            metalness={0.65}
          />
        </mesh>

        {/* Chrome Center Divider */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.63, 0.63, 0.1, 32]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.1} />
        </mesh>

        {/* Pole Labels */}
        <SceneLabel
          position={[flipPoles ? -0.7 : 0.7, 0.85, 0]}
          tone="text-rose-300"
        >
          N
        </SceneLabel>
        <SceneLabel
          position={[flipPoles ? 0.7 : -0.7, 0.85, 0]}
          tone="text-sky-300"
        >
          S
        </SceneLabel>

        {/* Dipole Field Lines moving with the magnet, arrowed from N to S */}
        {showFieldLines &&
          dipoleLoops.map(({ pts, top }, idx) => (
            <group key={`loop-${idx}`}>
              <Line
                points={pts}
                color="#38bdf8"
                lineWidth={1.4}
                transparent
                opacity={0.35}
                dashed
                dashSize={0.24}
                gapSize={0.16}
              />
              <mesh position={top} rotation={[0, 0, flipPoles ? -Math.PI / 2 : Math.PI / 2]}>
                <coneGeometry args={[0.07, 0.22, 12]} />
                <meshStandardMaterial
                  color="#38bdf8"
                  emissive="#38bdf8"
                  emissiveIntensity={0.9}
                  toneMapped={false}
                />
              </mesh>
            </group>
          ))}
      </group>

      {/* Circuit wiring from the two ends of the coil to the galvanometer & bulb */}
      <Line points={circuitWire(startPt, -1, [-2.15, -3.1, 1.35])} color="#ea580c" lineWidth={2.2} />
      <Line points={circuitWire(endPt, 1, [-0.45, -3.1, 1.35])} color="#38bdf8" lineWidth={2.2} />
      {showBulb && (
        <>
          <Line points={circuitWire(startPt, -1, [1.46, -3.15, 1.35])} color="#ea580c" lineWidth={2.2} />
          <Line points={circuitWire(endPt, 1, [2.14, -3.15, 1.35])} color="#38bdf8" lineWidth={2.2} />
        </>
      )}

      {/* Meter and Bulb on bench (foreground z = 1.35) */}
      <LaboratoryGalvanometer
        position={[-1.3, -3.3, 1.35]}
        needleRef={needleRef}
      />
      <DemonstrationBulb
        position={[1.8, -3.3, 1.35]}
        powerRef={bulbRef.current}
        showBulb={showBulb}
      />

    </>
  );
}

export function InductionScene({ params = {} }) {
  const isSolenoid = params?.apparatus === "solenoid";

  return (
    <SceneCanvas
      camera={
        isSolenoid
          ? { position: [0, 1.8, 13.5], fov: 45 }
          : { position: [4.8, 1.5, 14.0], fov: 45 }
      }
      controls={{ target: isSolenoid ? [0, -0.4, 0.4] : [0, -0.2, 0.4] }}
    >
      {isSolenoid ? (
        <SolenoidRig params={params} />
      ) : (
        <GeneratorRig params={params} />
      )}
    </SceneCanvas>
  );
}

// ═══ 5 · Kinetic particle theory & gas laws ═══════════════════════════

const MAX_PARTICLES = 140;
// Fixed cross-section; only the piston travel changes, so volume ∝ length.
const BORE = 2.1;

function GasParticles({ count, temperature, halfLength, onCollisionRate, animSpeed = 1 }) {
  const mesh = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const collisions = useRef(0);
  const clock = useRef(0);

  const bodies = useMemo(() => {
    const pos = new Float32Array(MAX_PARTICLES * 3);
    const vel = new Float32Array(MAX_PARTICLES * 3);
    // Particles do not all move at the mean speed — they carry a spread of
    // speeds about it, which is the whole reason evaporation and diffusion
    // work. Each one keeps its own fixed fraction of the mean.
    const share = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      for (let a = 0; a < 3; a += 1) {
        pos[i * 3 + a] = (hashRandom(i * 3 + a + 1) - 0.5) * 3;
        vel[i * 3 + a] = hashRandom(i * 7 + a + 91) - 0.5;
      }
      share[i] = 0.45 + hashRandom(i + 401) * 1.1;
    }
    return { pos, vel, share };
  }, []);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const step = Math.min(delta, 0.04) * animSpeed;
    // Mean speed rises with √T — the kinetic-theory result behind Charles's law.
    const target = 1.35 * Math.sqrt(temperature / 300);
    const radius = 0.13;
    // The piston face is the only wall that moves; the bore is fixed.
    const wallX = Math.max(0.12, halfLength - radius);
    const wallYZ = Math.max(0.12, BORE - radius);
    const { pos, vel, share } = bodies;

    for (let i = 0; i < count; i += 1) {
      const o = i * 3;
      let vx = vel[o];
      let vy = vel[o + 1];
      let vz = vel[o + 2];
      const speed = Math.hypot(vx, vy, vz) || 1;
      const k = (target * share[i]) / speed;
      vx *= k;
      vy *= k;
      vz *= k;

      let x = pos[o] + vx * step;
      let y = pos[o + 1] + vy * step;
      let z = pos[o + 2] + vz * step;

      if (x > wallX || x < -wallX) {
        x = clamp(x, -wallX, wallX);
        vx = -vx;
        collisions.current += 1;
      }
      if (y > wallYZ || y < -wallYZ) {
        y = clamp(y, -wallYZ, wallYZ);
        vy = -vy;
        collisions.current += 1;
      }
      if (z > wallYZ || z < -wallYZ) {
        z = clamp(z, -wallYZ, wallYZ);
        vz = -vz;
        collisions.current += 1;
      }

      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
      vel[o] = vx;
      vel[o + 1] = vy;
      vel[o + 2] = vz;

      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }

    mesh.current.count = count;
    mesh.current.instanceMatrix.needsUpdate = true;

    clock.current += step;
    if (clock.current >= 0.5) {
      onCollisionRate(Math.round(collisions.current / clock.current));
      collisions.current = 0;
      clock.current = 0;
    }
  });

  // Cold gas reads blue, hot gas reads amber-red.
  const t = clamp((temperature - 100) / 700, 0, 1);
  const colour = useMemo(
    () => new THREE.Color(PALETTE.sky).lerp(new THREE.Color(PALETTE.rose), t),
    [t]
  );

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, MAX_PARTICLES]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.13, 12, 12]} />
      <meshStandardMaterial
        color={colour}
        emissive={colour}
        emissiveIntensity={0.6 + t * 1.4}
        roughness={0.3}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

export function GasLawsScene({ params = {} }) {
  const {
    temperature = 300,
    volume = 1.0,
    particles = 60,
    speed = 1.0,
  } = params || {};
  const [rate, setRate] = useState(0);

  // A cylinder with a sliding piston, not a cube shrinking in every
  // direction: real gases are compressed by moving one wall, and with a fixed
  // bore the volume is simply proportional to how far along the piston sits.
  const halfLength = BORE * volume;
  const bodyLength = halfLength * 2;

  // Rebuilt only when the piston moves — this component re-renders twice a
  // second to refresh the collision rate.
  const edges = useMemo(
    () => new THREE.BoxGeometry(bodyLength, BORE * 2, BORE * 2),
    [bodyLength],
  );
  useEffect(() => () => edges.dispose(), [edges]);

  // p ∝ NT/V, from lib/particleModel.js. These three numbers were computed
  // here and then dropped on the floor: the scene showed a piston moving and
  // particles speeding up with nothing to read them against, which is the
  // whole of Boyle's and Charles's laws left as an exercise. The strip below
  // is where they go — pV is the one that refuses to move while p and V both do.
  const gas = gasLawReadout({ temperature, volume, particles });

  return (
    <SceneCanvas camera={{ position: [4, 3.5, 11], fov: 45 }} controls={{ autoRotate: params.spin !== false, autoRotateSpeed: 0.45 * speed }}>
      {/* Translucent glass container chamber */}
      <mesh>
        <boxGeometry args={[bodyLength, BORE * 2, BORE * 2]} />
        <meshStandardMaterial
          color={PALETTE.sky}
          transparent
          opacity={0.16}
          roughness={0.1}
          metalness={0.2}
          emissive={PALETTE.sky}
          emissiveIntensity={0.15}
          depthWrite={false}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[edges]} />
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.75} />
      </lineSegments>

      {/* Closed end of the cylinder. */}
      <mesh position={[-halfLength - 0.12, 0, 0]}>
        <boxGeometry args={[0.24, BORE * 2.2, BORE * 2.2]} />
        <meshStandardMaterial color="#2a2f38" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Piston: the wall you are actually moving with the volume slider. */}
      <group position={[halfLength + 0.18, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.36, BORE * 2.05, BORE * 2.05]} />
          <meshStandardMaterial
            color="#5b6472"
            roughness={0.42}
            metalness={0.65}
            emissive={PALETTE.gold}
            emissiveIntensity={volume < 0.7 ? 0.3 : 0.08}
          />
        </mesh>
        <mesh position={[1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 2.4, 16]} />
          <meshStandardMaterial color="#5b6472" roughness={0.4} metalness={0.7} />
        </mesh>
        <SceneLabel position={[1.4, BORE + 0.5, 0]} accent>
          piston · push in to compress
        </SceneLabel>
      </group>

      <GasParticles
        count={Math.round(particles)}
        temperature={temperature}
        halfLength={halfLength}
        onCollisionRate={setRate}
        animSpeed={params.speed ?? 1}
      />

      {/* The numbers the sliders are actually changing. */}
      <SceneLabel position={[0, BORE + 1.35, 0]} accent>
        {`p = ${gas.pressureKPa.toFixed(0)} kPa · V = ${gas.volume.toFixed(2)} · T = ${gas.temperatureK.toFixed(0)} K`}
      </SceneLabel>
      <SceneLabel position={[0, BORE + 0.95, 0]}>
        {`pV = ${gas.pV.toFixed(0)} — unchanged while p and V trade off · ${rate} wall hits/s`}
      </SceneLabel>

    </SceneCanvas>
  );
}

// ═══ 6 · Projectile motion with air resistance ═══════════════════════

/** Roughly how many world units wide the drawn trajectory should be. */
const PROJECTILE_SPAN = 9;
/** Runway deck top surface height in world units. */
const RUNWAY_TOP_Y = 0.28;
/** Ball radius in world units. */
const BALL_RADIUS = 0.13;
/** Launch and landing origin height: runway deck surface plus ball radius so ball rests perfectly on deck. */
const LAUNCH_Y = RUNWAY_TOP_Y + BALL_RADIUS;

// simulateFlight — the quadratic-drag integrator — lives in
// lib/projectile.js, so the HUD can quote the flight it draws rather than
// estimating it.

/** Precision laboratory cannon launcher with bright satin platinum, champagne brass fittings, and protractor scale. */
function LaboratoryCannon({ angleDeg = 45, showLabels = true }) {
  const rad = angleDeg * DEG;
  const BARREL_LEN = 0.52;
  const BORE_R = 0.14;
  const OUTER_R = 0.18;

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Ground Carriage & Rails - Sits on ground at X <= 0 behind the runway */}
      <group position={[-0.24, 0.04, 0]}>
        {/* Baseplate bed: light brushed platinum */}
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[0.54, 0.08, 0.58]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.75} />
        </mesh>
        {/* Chrome longitudinal guide rails */}
        <mesh position={[0, 0.048, -0.22]}>
          <boxGeometry args={[0.52, 0.016, 0.04]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.95} />
        </mesh>
        <mesh position={[0, 0.048, 0.22]}>
          <boxGeometry args={[0.52, 0.016, 0.04]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.95} />
        </mesh>
        {/* Leveling feet */}
        {[-0.22, 0.22].map((x) =>
          [-0.24, 0.24].map((z) => (
            <mesh key={`foot-${x}-${z}`} position={[x, -0.035, z]}>
              <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.7} />
            </mesh>
          ))
        )}
      </group>

      {/* 2. Side Stanchion Cheeks - Rising from ground to trunnion pivot at LAUNCH_Y */}
      <group position={[0, 0, 0]}>
        {[-0.24, 0.24].map((z) => (
          <group key={`cheek-${z}`} position={[0, 0, z]}>
            {/* Stanchion upright cheek */}
            <mesh position={[-0.10, LAUNCH_Y / 2, 0]}>
              <boxGeometry args={[0.24, LAUNCH_Y, 0.04]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
            </mesh>
            {/* Trunnion bearing collar at [0, LAUNCH_Y, 0] */}
            <mesh position={[0, LAUNCH_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.065, 0.065, 0.05, 20]} />
              <meshStandardMaterial color="#fde047" roughness={0.15} metalness={0.94} />
            </mesh>
          </group>
        ))}

        {/* Laser-engraved Protractor Degree Quadrant Arc on front cheek (facing camera) */}
        <group position={[0, LAUNCH_Y, 0.266]}>
          <mesh>
            <ringGeometry args={[0.16, 0.23, 32, 1, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.25} side={THREE.DoubleSide} />
          </mesh>
          {/* Degree scale ticks */}
          {[0, 15, 30, 45, 60, 75, 90].map((deg) => {
            const r = deg * DEG;
            return (
              <mesh
                key={`tick-${deg}`}
                position={[Math.cos(r) * 0.195, Math.sin(r) * 0.195, 0.001]}
                rotation={[0, 0, r]}
              >
                <boxGeometry args={[0.035, 0.004, 0.002]} />
                <meshBasicMaterial color={deg % 45 === 0 ? "#ef4444" : "#334155"} />
              </mesh>
            );
          })}
        </group>
      </group>

      {/* 3. Elevating Barrel Assembly (Pivots at [0, LAUNCH_Y, 0] and aims FORWARD & UPWARDS along +X) */}
      <group position={[0, LAUNCH_Y, 0]} rotation={[0, 0, rad]}>
        {/* Main barrel tube: extends FORWARD from X=0 to X=+BARREL_LEN (aiming towards target!) */}
        <mesh position={[BARREL_LEN / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[BORE_R + 0.025, OUTER_R + 0.015, BARREL_LEN, 28, 1, true]} />
          <meshStandardMaterial
            color="#f8fafc"
            roughness={0.12}
            metalness={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Dark bore interior liner: open at the front muzzle (X=+BARREL_LEN) */}
        <mesh position={[BARREL_LEN / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[BORE_R, BORE_R, BARREL_LEN, 24, 1, true]} />
          <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.4} side={THREE.BackSide} />
        </mesh>

        {/* Champagne brass muzzle crown ring at the FRONT (X=+BARREL_LEN) */}
        <mesh position={[BARREL_LEN - 0.025, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[BORE_R + 0.045, BORE_R + 0.045, 0.05, 28]} />
          <meshStandardMaterial color="#fde047" roughness={0.15} metalness={0.95} />
        </mesh>

        {/* Front muzzle bevel lip opening at X=+BARREL_LEN */}
        <mesh position={[BARREL_LEN, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <ringGeometry args={[BORE_R, BORE_R + 0.045, 28]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.98} side={THREE.DoubleSide} />
        </mesh>

        {/* Champagne brass reinforcement band near middle */}
        <mesh position={[BARREL_LEN * 0.45, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[OUTER_R + 0.02, OUTER_R + 0.02, 0.04, 24]} />
          <meshStandardMaterial color="#fde047" roughness={0.16} metalness={0.94} />
        </mesh>

        {/* Breech block hemisphere closing the rear at X=0 */}
        <mesh position={[0, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <sphereGeometry args={[OUTER_R + 0.015, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.14} metalness={0.92} />
        </mesh>

        {/* Mirror chrome cascabel knob behind the breech at X=-0.07 */}
        <mesh position={[-0.07, 0, 0]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.08} metalness={0.98} />
        </mesh>

        {/* Trunnion axle pins passing through pivot at [0, 0, 0] */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.048, 0.048, 0.54, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.98} />
        </mesh>

        {/* Red angle pointer needle pointing along the barrel over the degree scale */}
        <mesh position={[0.10, 0, 0.285]}>
          <boxGeometry args={[0.16, 0.016, 0.01]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Angle readout badge */}
      {showLabels && (
        <SceneLabel position={[-0.24, -0.15, 0]} accent>
          {angleDeg}° launch
        </SceneLabel>
      )}
    </group>
  );
}

/** Single reusable high-performance dynamic vector arrow with shaft, cone head, and HTML label pill. */
function VectorMesh({ color, groupRef, shaftRef, headRef, labelRef, label, showLabels = true }) {
  return (
    <group ref={groupRef}>
      <mesh ref={shaftRef} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.034, 0.034, 1, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          toneMapped={false}
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>
      <mesh ref={headRef} position={[0, 1.1, 0]}>
        <coneGeometry args={[0.09, 0.22, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.3}
          toneMapped={false}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>
      {showLabels && label && (
        <group ref={labelRef} position={[0, 1.3, 0]}>
          <Html center style={{ pointerEvents: "none" }} zIndexRange={[60, 45]}>
            <div
              className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md whitespace-nowrap select-none"
              style={{ backgroundColor: color, opacity: 0.95 }}
            >
              {label}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

/** 60 FPS WebGL vector transform updater with zero React state latency. */
function updateVector(groupRef, shaftRef, headRef, labelRef, dirX, dirY, length) {
  if (!groupRef.current) return;
  if (length < 0.05) {
    groupRef.current.visible = false;
    return;
  }
  groupRef.current.visible = true;
  groupRef.current.rotation.z = Math.atan2(dirY, dirX) - Math.PI / 2;

  const effHeadLen = Math.min(0.22, length * 0.38);
  const headScale = effHeadLen / 0.22;
  const shaftLen = Math.max(0.001, length - effHeadLen);

  if (shaftRef.current) {
    shaftRef.current.scale.set(1, shaftLen, 1);
    shaftRef.current.position.set(0, shaftLen / 2, 0);
  }
  if (headRef.current) {
    headRef.current.scale.set(headScale, headScale, headScale);
    headRef.current.position.set(0, shaftLen + effHeadLen / 2, 0);
  }
  if (labelRef.current) {
    labelRef.current.position.set(0, shaftLen + effHeadLen + 0.16, 0);
  }
}

/** Muzzle blast shockwave ring displayed upon firing. */
function MuzzleBlast({ position, angleDeg, replayKey }) {
  const blastRef = useRef(null);
  const time = useRef(0);

  // Trigger blast ONLY upon firing/replayKey, not continuously when rotating angle
  useEffect(() => {
    time.current = 0;
  }, [replayKey]);

  useFrame((_, delta) => {
    time.current += delta;
    if (blastRef.current) {
      if (time.current < 0.22) {
        blastRef.current.visible = true;
        const progress = time.current / 0.22;
        const s = 0.6 + progress * 1.8;
        blastRef.current.scale.set(s, s, s);
        if (blastRef.current.material) {
          blastRef.current.material.opacity = Math.max(0, 0.85 * (1 - progress));
        }
      } else {
        blastRef.current.visible = false;
      }
    }
  });

  return (
    <mesh ref={blastRef} position={position} rotation={[0, 0, angleDeg * DEG]}>
      <ringGeometry args={[0.08, 0.24, 24]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

/** Calibrated ground metric runway with clean light surface and zero Z-fighting. */
function DistanceRunway({ maxDist, scale, showLabels = true }) {
  const runwayLength = Math.max(maxDist * scale + 1.2, 5);
  const step = maxDist <= 35 ? 5 : maxDist <= 90 ? 10 : 20;
  const marks = useMemo(() => {
    const arr = [];
    for (let d = step; d <= maxDist * 1.05; d += step) {
      arr.push(d);
    }
    return arr;
  }, [maxDist, step]);

  return (
    <group position={[0, 0, 0]}>
      {/* Single solid runway slab - zero Z-fighting */}
      <mesh position={[runwayLength / 2, RUNWAY_TOP_Y / 2, 0]} receiveShadow>
        <boxGeometry args={[runwayLength, RUNWAY_TOP_Y, 0.72]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.28} metalness={0.18} />
      </mesh>
      {/* Satin aluminum side guide curbs */}
      <mesh position={[runwayLength / 2, RUNWAY_TOP_Y + 0.015, -0.35]}>
        <boxGeometry args={[runwayLength, 0.03, 0.024]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.75} />
      </mesh>
      <mesh position={[runwayLength / 2, RUNWAY_TOP_Y + 0.015, 0.35]}>
        <boxGeometry args={[runwayLength, 0.03, 0.024]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.75} />
      </mesh>

      {/* Metric tick marks along the runway with clean elevation offset to eliminate Z-fighting */}
      {marks.map((d) => (
        <group key={`mark-${d}`} position={[d * scale, RUNWAY_TOP_Y + 0.002, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.035, 0.44]} />
            <meshBasicMaterial
              color="#334155"
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
          {showLabels && (
            <SceneLabel
              position={[0, 0.02, 0.38]}
              tone="text-slate-700"
              zIndexRange={[14, 5]}
              className="text-[9px] font-mono font-semibold border-slate-300 bg-slate-100/90 shadow-sm"
            >
              {d}m
            </SceneLabel>
          )}
        </group>
      ))}
    </group>
  );
}

/** Apex maximum height indicator with vertical dashed plumb line. */
function ApexMarker({ apexX, apexY, apexMeters, color = PALETTE.emerald, showLabels = true }) {
  return (
    <group position={[apexX, apexY, 0]}>
      {/* Glowing diamond apex marker */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.075]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
      {/* Vertical dashed drop line down to runway deck */}
      <Line
        points={[
          [0, -0.08, 0],
          [0, -(apexY - RUNWAY_TOP_Y), 0],
        ]}
        color={color}
        lineWidth={1.2}
        dashed
        dashSize={0.12}
        gapSize={0.08}
        transparent
        opacity={0.65}
      />
      {/* Apex label */}
      {showLabels && (
        <SceneLabel position={[0, 0.28, 0]} accent zIndexRange={[40, 30]}>
          Apex {apexMeters.toFixed(1)}m
        </SceneLabel>
      )}
    </group>
  );
}

/** Concentric landing bullseye on runway with distance badge. */
function LandingTarget({ x, label, color = PALETTE.emerald, showLabels = true, isIdeal = false }) {
  const yElev = isIdeal ? RUNWAY_TOP_Y + 0.005 : RUNWAY_TOP_Y + 0.008;
  const polyFactor = isIdeal ? -2 : -3;
  return (
    <group position={[x, yElev, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.24, 32]} />
        <meshBasicMaterial
          color={color}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={polyFactor}
          polygonOffsetUnits={polyFactor}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.065, 24]} />
        <meshBasicMaterial
          color={color}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={polyFactor}
          polygonOffsetUnits={polyFactor}
        />
      </mesh>
      {showLabels && (
        <SceneLabel
          position={[0, 0.02, isIdeal ? -0.42 : -0.38]}
          accent={!isIdeal}
          tone={isIdeal ? "text-slate-300" : undefined}
          zIndexRange={[25, 15]}
        >
          {label}
        </SceneLabel>
      )}
    </group>
  );
}

/** Walks the recorded samples in real time and drives the ball + 60fps lag-free vectors. */
function Projectile({
  flight,
  scale,
  running,
  replayKey,
  showVectors,
  showLabels = true,
  onSample,
  animSpeed = 1,
  drag = 0.04,
  mass = 1,
  gravity = 9.81,
}) {
  const ball = useRef(null);
  const clock = useRef(0);
  const sampleAcc = useRef(0);

  // Vector group & component refs for 60 FPS lag-free transform updates
  const vectorsGroup = useRef(null);

  const vArrowRef = useRef(null);
  const vShaftRef = useRef(null);
  const vHeadRef = useRef(null);
  const vLabelRef = useRef(null);

  const wArrowRef = useRef(null);
  const wShaftRef = useRef(null);
  const wHeadRef = useRef(null);
  const wLabelRef = useRef(null);

  const dArrowRef = useRef(null);
  const dShaftRef = useRef(null);
  const dHeadRef = useRef(null);
  const dLabelRef = useRef(null);

  const netArrowRef = useRef(null);
  const netShaftRef = useRef(null);
  const netHeadRef = useRef(null);
  const netLabelRef = useRef(null);

  const wakeGroup = useRef(null);

  // Weight, drag and the net force are all forces, so they are drawn on ONE
  // scale — that is what makes F_net the visible vector sum of the other two.
  // They each used their own scale and their own minimum length, so the net
  // arrow was not the sum of the others and a light ball's weight was drawn
  // four times too long. The scale is set by the strongest force anywhere in
  // the flight, so the biggest arrow is always 2 units and none clips.
  const forceScale = useMemo(() => {
    const weight = mass * gravity;
    let strongest = weight;
    const stride = Math.max(1, Math.floor(flight.count / 400));
    for (let i = 0; i < flight.count; i += stride) {
      const vx = flight.svx[i];
      const vy = flight.svy[i];
      const sp = Math.hypot(vx, vy);
      const fx = -drag * sp * vx;
      const fy = -drag * sp * vy;
      strongest = Math.max(strongest, Math.hypot(fx, fy), Math.hypot(fx, fy - weight));
    }
    return 2.0 / Math.max(strongest, 1e-6);
  }, [flight, mass, gravity, drag]);

  // Reset flight clock only upon debounced replayKey trigger, preserving smooth continuity during slider drags
  useEffect(() => {
    clock.current = 0;
  }, [replayKey]);

  useFrame((_, delta) => {
    if (running) clock.current += Math.min(delta, 0.05) * animSpeed;
    const t = Math.min(clock.current, flight.flightTime);
    const i = clamp(Math.round(t / SIM_DT), 0, flight.count - 1);
    const px = flight.sx[i];
    const py = flight.sy[i];
    const pvx = flight.svx[i];
    const pvy = flight.svy[i];

    const ballX = px * scale;
    const ballY = LAUNCH_Y + py * scale;

    if (ball.current) {
      ball.current.position.set(ballX, ballY, 0);
    }

    // Vectors are only visible in active flight, hiding upon landing so markers remain uncluttered
    const isFlying = running && t < flight.flightTime - 0.02;

    if (vectorsGroup.current) {
      vectorsGroup.current.position.set(ballX, ballY, 0);
      vectorsGroup.current.visible = Boolean(showVectors && isFlying);
    }

    if (showVectors && isFlying) {
      const speed = Math.hypot(pvx, pvy);
      const safeSpeed = Math.max(speed, 1e-4);
      const dirVx = pvx / safeSpeed;
      const dirVy = pvy / safeSpeed;

      // 1. Velocity vector v (sky blue)
      const vLen = clamp(speed * 0.075, 0.22, 2.2);
      updateVector(vArrowRef, vShaftRef, vHeadRef, vLabelRef, dirVx, dirVy, vLen);

      // 2. Weight force W = mg (rose) - constant downward
      const wMag = mass * gravity;
      const wLen = wMag * forceScale;
      updateVector(wArrowRef, wShaftRef, wHeadRef, wLabelRef, 0, -1, wLen);

      // 3. Drag force F_drag = -k|v|v (amber) - opposes velocity
      const fDrag = drag * (pvx * pvx + pvy * pvy);
      const dLen = fDrag * forceScale;
      updateVector(dArrowRef, dShaftRef, dHeadRef, dLabelRef, -dirVx, -dirVy, dLen);

      // 4. Net resultant force F_net = W + F_drag (emerald)
      const fNetX = -drag * speed * pvx;
      const fNetY = -mass * gravity - drag * speed * pvy;
      const fNetMag = Math.hypot(fNetX, fNetY);
      const netLen = fNetMag * forceScale;
      const dirNetX = fNetMag > 1e-4 ? fNetX / fNetMag : 0;
      const dirNetY = fNetMag > 1e-4 ? fNetY / fNetMag : -1;
      updateVector(netArrowRef, netShaftRef, netHeadRef, netLabelRef, dirNetX, dirNetY, netLen);
    }

    if (wakeGroup.current) {
      wakeGroup.current.position.set(ballX, ballY, 0);
      wakeGroup.current.rotation.z = Math.atan2(pvy, pvx) + Math.PI;
      wakeGroup.current.visible = Boolean(running && drag > 0.002 && t > 0.02 && t < flight.flightTime);
    }

    sampleAcc.current += delta;
    if (sampleAcc.current >= 0.08) {
      sampleAcc.current = 0;
      onSample({
        t: i * SIM_DT,
        x: px,
        y: py,
        speed: Math.hypot(pvx, pvy),
        vx: pvx,
        vy: pvy,
        dragForce: drag * (pvx * pvx + pvy * pvy),
      });
    }
  });

  return (
    <group>
      {/* Machined polished brass cannonball */}
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 28, 28]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#fbbf24"
          emissiveIntensity={0.8}
          roughness={0.22}
          metalness={0.82}
        />
      </mesh>

      {/* Trailing aerodynamic wake eddies when drag > 0 */}
      {drag > 0.002 && (
        <group ref={wakeGroup}>
          {[0.18, 0.36, 0.54].map((dist, idx) => (
            <mesh key={`wake-${idx}`} position={[-dist, 0, 0]}>
              <sphereGeometry args={[0.045 * (1 - idx * 0.25), 12, 12]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.55 * (1 - idx * 0.28)} />
            </mesh>
          ))}
        </group>
      )}

      {/* 60 FPS zero-latency vector group */}
      <group ref={vectorsGroup}>
        <VectorMesh
          color={PALETTE.sky}
          groupRef={vArrowRef}
          shaftRef={vShaftRef}
          headRef={vHeadRef}
          labelRef={vLabelRef}
          label="v"
          showLabels={showLabels}
        />
        <VectorMesh
          color={PALETTE.rose}
          groupRef={wArrowRef}
          shaftRef={wShaftRef}
          headRef={wHeadRef}
          labelRef={wLabelRef}
          label="W = mg"
          showLabels={showLabels}
        />
        <VectorMesh
          color={PALETTE.gold}
          groupRef={dArrowRef}
          shaftRef={dShaftRef}
          headRef={dHeadRef}
          labelRef={dLabelRef}
          label="F_drag"
          showLabels={showLabels}
        />
        <VectorMesh
          color={PALETTE.emerald}
          groupRef={netArrowRef}
          shaftRef={netShaftRef}
          headRef={netHeadRef}
          labelRef={netLabelRef}
          label="F_net"
          showLabels={showLabels}
        />
      </group>
    </group>
  );
}

export function ProjectileScene({ params = {} }) {
  const launchSpeed = params.launchSpeed ?? 22;
  const animSpeed = params.speed ?? 1.0;
  const speed = launchSpeed;
  const {
    angle = 45,
    gravity = 9.81,
    drag = 0.04,
    mass = 1,
    showIdeal = true,
    showVectors = true,
    showLabels = true,
    running = true,
    replay = 0,
    spin = false,
  } = params || {};

  const [live, setLive] = useState({ t: 0, x: 0, y: 0, speed, vx: 0, vy: 0, dragForce: 0 });
  const [activeReplay, setActiveReplay] = useState(0);
  const debounceTimer = useRef(null);
  const isFirstMount = useRef(true);

  // Debounce launch restart during slider dragging to eliminate stuttering & continuous glitchy restarts
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setActiveReplay((r) => r + 1);
    }, 320);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [speed, angle, gravity, drag, mass]);

  // Immediate launch on explicit replay action button
  useEffect(() => {
    if (replay > 0) {
      setActiveReplay((r) => r + 1);
    }
  }, [replay]);

  const flight = useMemo(
    () => simulateFlight(speed, angle, gravity, drag, mass),
    [speed, angle, gravity, drag, mass],
  );
  // The same launch with the drag term switched off — the gap between the two
  // curves is the entire lesson.
  const ideal = useMemo(
    () => simulateFlight(speed, angle, gravity, 0, mass),
    [speed, angle, gravity, mass],
  );

  // Fit whichever is the binding dimension: a near-vertical lob is limited by
  // its apex, a flat one by its range.
  const scale = clamp(
    PROJECTILE_SPAN / Math.max(flight.range, ideal.range, flight.apex * 2.2, 1),
    0.01,
    0.6,
  );
  const path = useMemo(
    () => flight.points.map(([x, y]) => [x * scale, LAUNCH_Y + y * scale, 0]),
    [flight, scale],
  );
  const idealPath = useMemo(
    () => ideal.points.map(([x, y]) => [x * scale, LAUNCH_Y + y * scale, 0]),
    [ideal, scale],
  );

  return (
    <SceneCanvas
      camera={{ position: [4.2, 3.2, 13], fov: 46 }}
      controls={{ autoRotate: spin, autoRotateSpeed: 0.45 * animSpeed, target: [4.2, 1.8, 0] }}
    >
      <Grid
        args={[28, 16]}
        cellSize={0.5}
        cellColor="#1e2531"
        sectionSize={2.5}
        sectionColor="#2b3442"
        fadeDistance={36}
        infiniteGrid={false}
      />

      {/* Metric runway track with light colors & ground distance markers */}
      <DistanceRunway maxDist={Math.max(flight.range, ideal.range)} scale={scale} showLabels={showLabels} />

      {/* Precision laboratory cannon with aligned muzzle & light platinum finish */}
      <LaboratoryCannon angleDeg={angle} showLabels={showLabels} />

      {/* Muzzle blast impulse shockwave upon firing */}
      <MuzzleBlast position={[0, LAUNCH_Y, 0]} angleDeg={angle} replayKey={activeReplay} />

      {/* Trajectory lines */}
      {showIdeal && (
        <Line points={idealPath} color={PALETTE.slate} lineWidth={1.8} dashed dashSize={0.16} gapSize={0.12} />
      )}
      <Line points={path} color={PALETTE.emerald} lineWidth={3} />

      {/* Apex markers */}
      <ApexMarker
        apexX={flight.apexX * scale}
        apexY={LAUNCH_Y + flight.apex * scale}
        apexMeters={flight.apex}
        color={PALETTE.emerald}
        showLabels={showLabels}
      />
      {showIdeal && (
        <ApexMarker
          apexX={ideal.apexX * scale}
          apexY={LAUNCH_Y + ideal.apex * scale}
          apexMeters={ideal.apex}
          color={PALETTE.slate}
          showLabels={showLabels}
        />
      )}

      {/* 60 FPS projectile ball & zero-lag force vectors (without unmounting glitch on slider drags) */}
      <Projectile
        flight={flight}
        scale={scale}
        running={running}
        replayKey={activeReplay}
        showVectors={showVectors}
        showLabels={showLabels}
        onSample={setLive}
        animSpeed={animSpeed}
        drag={drag}
        mass={mass}
        gravity={gravity}
      />

      {/* Calibrated landing target rings on runway */}
      <LandingTarget x={flight.range * scale} label={`${flight.range.toFixed(1)}m`} color={PALETTE.emerald} showLabels={showLabels} />
      {showIdeal && Math.abs(ideal.range - flight.range) * scale > 0.35 && (
        <LandingTarget
          x={ideal.range * scale}
          label={`${ideal.range.toFixed(1)}m (vac)`}
          color={PALETTE.slate}
          showLabels={showLabels}
          isIdeal
        />
      )}

    </SceneCanvas>
  );
}

// ═══ 7 · Two-source wave interference ════════════════════════════════

// The tank's geometry, and the screen pattern on it, live in lib/interference.js
// so the HUD quotes the same distances and fringe positions the scene draws.
const FIELD_SEGMENTS = 60;

/** Live sum of the source waves, displaced into the mesh each frame. */
function InterferenceField({ sources, wavelength, amplitude, speed }) {
  const meshRef = useRef(null);
  const clock = useRef(0);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(
      FIELD_HALF_X * 2,
      FIELD_FAR_Z - FIELD_NEAR_Z,
      FIELD_SEGMENTS,
      FIELD_SEGMENTS,
    );
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, (FIELD_NEAR_Z + FIELD_FAR_Z) / 2);
    const colours = new Float32Array(g.attributes.position.count * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return g;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const crest = useMemo(() => new THREE.Color(PALETTE.gold), []);
  const trough = useMemo(() => new THREE.Color(PALETTE.violet), []);
  const flat = useMemo(() => new THREE.Color("#16202e"), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.05) * speed;
    const t = clock.current;
    const k = (Math.PI * 2) / wavelength;
    const omega = k * 2.2;
    const pos = geometry.attributes.position;
    const col = geometry.attributes.color;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let sum = 0;
      for (let s = 0; s < sources.length; s += 1) {
        const dx = x - sources[s];
        const dz = z - FIELD_NEAR_Z;
        // Guarded so the 1/√r spreading term cannot blow up at the slit itself.
        const r = Math.max(Math.hypot(dx, dz), 0.35);
        sum += (amplitude / Math.sqrt(r)) * Math.cos(k * r - omega * t);
      }
      pos.setY(i, sum);

      const norm = clamp(sum / (amplitude * 1.4), -1, 1);
      scratch.copy(flat).lerp(norm > 0 ? crest : trough, Math.abs(norm));
      col.setXYZ(i, scratch.r, scratch.g, scratch.b);
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.5} metalness={0.15} side={THREE.DoubleSide} />
    </mesh>
  );
}

// The screen, top to bottom: the intensity graph, the fringe strip in its open
// frame, and beneath it a ruler and the order of each bright fringe.
const SCREEN_H = 0.9;
const SCREEN_Y = 0.5;
const PLOT_BASE = 1.3;
const PLOT_H = 1.0;

/** A minus sign that is a minus sign, for the order labels. */
const orderText = (m) => (m < 0 ? `−${-m}` : `${m}`);

/**
 * The fringe pattern on the screen: one cell per sample, drawn as a single
 * instanced strip so a fine sampling costs nothing, with the same pattern
 * plotted above it as an intensity curve and every bright fringe named by
 * its order m (path difference = mλ) at the position it really lands.
 */
function FringeScreen({ cells, fringes }) {
  const strip = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);
  const dark = useMemo(() => new THREE.Color("#0d141d"), []);
  const bright = useMemo(() => new THREE.Color(PALETTE.gold), []);
  const cellWidth = (2 * FIELD_HALF_X) / (cells.length - 1);

  useLayoutEffect(() => {
    const mesh = strip.current;
    if (!mesh) return;
    cells.forEach((cell, i) => {
      dummy.position.set(cell.x, SCREEN_Y, SCREEN_Z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // A little gamma, so the dim skirts of a fringe still read as light.
      colour.copy(dark).lerp(bright, Math.pow(cell.level, 0.8));
      mesh.setColorAt(i, colour);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cells, dummy, colour, dark, bright]);

  const plot = useMemo(
    () => cells.map((c) => [c.x, PLOT_BASE + PLOT_H * c.level, SCREEN_Z]),
    [cells],
  );

  // A ruler along the lower edge (a tick per metre), and a faint guide from
  // each bright fringe up through the graph.
  const ruler = useMemo(() => {
    const v = [];
    for (let x = -FIELD_HALF_X; x <= FIELD_HALF_X; x += 1) {
      const long = x % 2 === 0 ? 0.13 : 0.07;
      v.push(x, SCREEN_Y - SCREEN_H / 2 - 0.02, SCREEN_Z, x, SCREEN_Y - SCREEN_H / 2 - 0.02 - long, SCREEN_Z);
    }
    return new Float32Array(v);
  }, []);
  const guides = useMemo(() => {
    const v = [];
    for (const f of fringes) {
      v.push(f.x, SCREEN_Y - SCREEN_H / 2, SCREEN_Z, f.x, PLOT_BASE + PLOT_H, SCREEN_Z);
    }
    return new Float32Array(v);
  }, [fringes]);

  return (
    <group>
      {/* An open frame, not a plate: the screen is lit on the side the waves
          arrive from, so nothing solid may sit between that side and the strip.
          (A backing plate there hid the whole pattern from anyone looking at
          the screen from the tank.) The strip's own dark colour is what makes
          a dark fringe dark. */}
      {[-1, 1].map((side) => (
        <mesh key={`rail-${side}`} position={[0, SCREEN_Y + side * (SCREEN_H / 2 + 0.06), SCREEN_Z]}>
          <boxGeometry args={[2 * FIELD_HALF_X + cellWidth + 0.24, 0.07, 0.16]} />
          <meshStandardMaterial color="#39424f" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`post-${side}`} position={[side * (FIELD_HALF_X + cellWidth / 2 + 0.09), SCREEN_Y, SCREEN_Z]}>
          <boxGeometry args={[0.07, SCREEN_H + 0.19, 0.16]} />
          <meshStandardMaterial color="#39424f" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      <instancedMesh
        ref={strip}
        args={[undefined, undefined, cells.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[cellWidth, SCREEN_H, 0.12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ruler, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#64748b" />
      </lineSegments>
      {fringes.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[guides, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={PALETTE.gold} transparent opacity={0.16} />
        </lineSegments>
      )}

      {/* Intensity against position, on the same axis as the strip */}
      <Line
        points={[
          [-FIELD_HALF_X, PLOT_BASE, SCREEN_Z],
          [FIELD_HALF_X, PLOT_BASE, SCREEN_Z],
        ]}
        color={PALETTE.line}
        lineWidth={1}
      />
      <Line
        points={[
          [-FIELD_HALF_X, PLOT_BASE + PLOT_H, SCREEN_Z],
          [FIELD_HALF_X, PLOT_BASE + PLOT_H, SCREEN_Z],
        ]}
        color={PALETTE.line}
        lineWidth={1}
        transparent
        opacity={0.3}
        dashed
        dashSize={0.12}
        gapSize={0.12}
      />
      <Line points={plot} color={PALETTE.gold} lineWidth={1.8} />

      <SceneLabel position={[-FIELD_HALF_X - 0.55, PLOT_BASE + PLOT_H, SCREEN_Z]} tone="text-ink-400">
        1
      </SceneLabel>
      <SceneLabel position={[-FIELD_HALF_X - 0.55, PLOT_BASE, SCREEN_Z]} tone="text-ink-400">
        0
      </SceneLabel>
      <SceneLabel position={[0, PLOT_BASE + PLOT_H + 0.32, SCREEN_Z]} tone="text-ink-400">
        relative intensity I
      </SceneLabel>
      <SceneLabel position={[-FIELD_HALF_X - 0.95, SCREEN_Y, SCREEN_Z]} tone="text-ink-400">
        screen
      </SceneLabel>

      {/* Which bright fringe is which: the order m, where path difference = mλ */}
      {fringes.length > 0 && (
        <SceneLabel position={[-FIELD_HALF_X - 0.95, SCREEN_Y - SCREEN_H / 2 - 0.4, SCREEN_Z]} tone="text-ink-400">
          order m
        </SceneLabel>
      )}
      {fringes.map((f) => (
        <SceneLabel
          key={f.order}
          position={[f.x, SCREEN_Y - SCREEN_H / 2 - 0.4, SCREEN_Z]}
          accent={f.order === 0}
          tone={f.order === 0 ? undefined : "text-ink-300"}
        >
          {orderText(f.order)}
        </SceneLabel>
      ))}
    </group>
  );
}

export function InterferenceScene({ params = {} }) {
  const {
    slits = 2,
    separation = 2.2,
    wavelength = 1.2,
    amplitude = 0.62,
    speed = 1,
    showScreen = true,
    spin = false,
  } = params || {};

  const sources = useMemo(
    () => (slits === 1 ? [0] : [-separation / 2, separation / 2]),
    [slits, separation],
  );
  const cells = useMemo(
    () => screenIntensity(sources, wavelength, amplitude),
    [sources, wavelength, amplitude],
  );

  // Bright fringes by order, at the positions they really land (exact for this
  // tank, not the far-field L·tan θ). A single source has no such series.
  const fringes = useMemo(
    () => (slits === 2 ? brightFringes(separation, wavelength) : []),
    [slits, separation, wavelength],
  );

  return (
    <SceneCanvas camera={{ position: [0, 9.2, 12.8], fov: 46 }} controls={{ autoRotate: spin, autoRotateSpeed: 0.45 * speed, target: [0, 0.3, 1.6] }}>
      <InterferenceField sources={sources} wavelength={wavelength} amplitude={amplitude} speed={speed} />

      {/* The barrier, with a gap at each slit. */}
      {[-1, 1].map((side) => {
        const inner = slits === 1 ? 0.28 : separation / 2 + 0.22;
        const outer = FIELD_HALF_X;
        const width = Math.max(outer - inner, 0.05);
        return (
          <mesh key={side} position={[side * (inner + width / 2), 0.25, FIELD_NEAR_Z]}>
            <boxGeometry args={[width, 0.6, 0.28]} />
            <meshStandardMaterial color="#39424f" roughness={0.6} metalness={0.35} />
          </mesh>
        );
      })}
      {slits === 2 && (
        <mesh position={[0, 0.25, FIELD_NEAR_Z]}>
          <boxGeometry args={[Math.max(separation - 0.44, 0.05), 0.6, 0.28]} />
          <meshStandardMaterial color="#39424f" roughness={0.6} metalness={0.35} />
        </mesh>
      )}

      {sources.map((x, i) => (
        <mesh key={i} position={[x, 0.15, FIELD_NEAR_Z]}>
          <sphereGeometry args={[0.13, 18, 18]} />
          <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}

      {showScreen && <FringeScreen cells={cells} fringes={fringes} />}

      <SceneLabel position={[0, 1.4, FIELD_NEAR_Z - 0.7]} accent>
        {slits === 1 ? "single source" : `two sources · d = ${separation.toFixed(1)}`}
      </SceneLabel>

    </SceneCanvas>
  );
}

// ═══ 8 · Gravity wells & orbital motion ══════════════════════════════

// The sheet is 60 units in radius. It used to be 7, ringed by a raised lip, and
// a satellite launched hard enough to leave was frozen at the edge of it — so
// turning the sliders up simply stopped the demonstration. Nothing here is a
// wall any more: the sheet is a picture of the potential that fades out with
// distance, and a satellite that is leaving just keeps going.
const WELL_RADIUS = 60;
/** Inside this the sheet stops deepening: the funnel has a floor. */
const WELL_CORE = 0.9;
const WELL_DEPTH_CAP = 9;
const WELL_RING_SEGMENTS = 128;
const WELL_SPOKES = 36;
const WELL_SPOKE_SAMPLES = 160;
/** Room for many orbits of a close ellipse, or the whole of a long flight out. */
const ORBIT_TRAIL_MAX = 12000;
/** The default camera's distance from the origin, and how far it will follow. */
const FOLLOW_DISTANCE = 14.5;
const FOLLOW_MAX_REACH = 160;
/**
 * Only a numerical backstop: a body this far out is beyond anything the camera
 * will follow, and the coordinates are heading somewhere float precision
 * would begin to matter. It is not a boundary of the scene.
 */
const ORBIT_GIVE_UP = 5000;
/** Real seconds the path is left on show after the satellite leaves the view. */
const RELAUNCH_DELAY = 0.9;

/** Rubber-sheet analogy: depth = −μ/r, exactly, down to a floor at the core. */
function wellDepth(r, mu) {
  return Math.max(-mu / Math.max(r, WELL_CORE), -WELL_DEPTH_CAP);
}

/** Radii of the drawn rings: every unit near the centre, sparser further out. */
const WELL_RING_RADII = (() => {
  const radii = [];
  for (let r = 1; r <= WELL_RADIUS; r += r < 10 ? 1 : r < 24 ? 2 : 4) radii.push(r);
  return radii;
})();

/** Ring and spoke vertices of the sheet, with the colour each fades to at range. */
function buildWell() {
  const pos = [];
  const radii = [];
  const col = [];
  const near = new THREE.Color(PALETTE.sky);
  const far = new THREE.Color(CANVAS_BG);
  const tint = new THREE.Color();

  const vertex = (r, angle) => {
    pos.push(r * Math.cos(angle), 0, r * Math.sin(angle));
    radii.push(r);
    // Fade into the background over the outer half, so the sheet has no edge.
    const t = THREE.MathUtils.smoothstep(r / WELL_RADIUS, 0.45, 1);
    tint.copy(near).lerp(far, t);
    col.push(tint.r, tint.g, tint.b);
  };

  for (const r of WELL_RING_RADII) {
    for (let j = 0; j < WELL_RING_SEGMENTS; j += 1) {
      vertex(r, (j / WELL_RING_SEGMENTS) * Math.PI * 2);
      vertex(r, ((j + 1) / WELL_RING_SEGMENTS) * Math.PI * 2);
    }
  }
  // Spokes are sampled geometrically, closely near the centre where the funnel
  // is steep and coarsely out on the flat, so the silhouette stays smooth.
  for (let k = 0; k < WELL_SPOKES; k += 1) {
    const angle = (k / WELL_SPOKES) * Math.PI * 2;
    const at = (i) => WELL_CORE * Math.pow(WELL_RADIUS / WELL_CORE, i / WELL_SPOKE_SAMPLES);
    for (let i = 0; i < WELL_SPOKE_SAMPLES; i += 1) {
      vertex(at(i), angle);
      vertex(at(i + 1), angle);
    }
  }
  return {
    positions: new Float32Array(pos),
    radii: new Float32Array(radii),
    colours: new Float32Array(col),
  };
}

function GravityWell({ mass }) {
  const geo = useRef(null);
  const well = useMemo(buildWell, []);
  const mu = muOf(mass);

  // Depth is the only thing the mass changes, so the vertices are rewritten
  // in place rather than rebuilding the web.
  useEffect(() => {
    const { positions, radii } = well;
    for (let i = 0; i < radii.length; i += 1) positions[i * 3 + 1] = wellDepth(radii[i], mu);
    if (geo.current) geo.current.attributes.position.needsUpdate = true;
  }, [well, mu]);

  return (
    <group>
      <lineSegments frustumCulled={false}>
        <bufferGeometry ref={geo}>
          <bufferAttribute attach="attributes-position" args={[well.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[well.colours, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.55} />
      </lineSegments>
      {/* A sense of scale, since there is a lot more sheet than there is orbit */}
      {[10, 20, 40].map((r) => (
        <SceneLabel key={r} position={[r, wellDepth(r, mu) + 0.2, 0]} tone="text-ink-500">
          r = {r}
        </SceneLabel>
      ))}
    </group>
  );
}

/** The satellite's state at launch: at (r, 0), moving sideways at the launch speed. */
const launchState = (launchRadius, launchSpeed) => ({
  x: launchRadius,
  z: 0,
  vx: 0,
  vz: launchSpeed,
  count: 0,
  lastX: Infinity,
  lastZ: 0,
  // Seconds since it left the view, or null while it is still in it.
  leftFor: null,
  gone: false,
});

const _ndc = new THREE.Vector3();

/**
 * Flies the satellite (lib/orbit.js) and draws its path.
 *
 * It is never frozen against a wall. What it does when it leaves the view is
 * the user's choice: with `loopEscape` it is shown leaving, then relaunched
 * from the start, so the picture never ends up a speck in an empty sheet; with
 * it off it simply keeps going and the camera follows it out.
 */
function Satellite({
  mass,
  launchRadius,
  launchSpeed,
  running,
  resetKey,
  showTrail,
  speed = 1,
  reachRef,
  viewRadius,
  loopEscape,
  leavingNote,
}) {
  const body = useRef(null);
  const trailLine = useRef(null);
  const trailGeo = useRef(null);
  const trail = useMemo(() => new Float32Array(ORBIT_TRAIL_MAX * 3), []);
  const state = useRef(launchState(launchRadius, launchSpeed));
  const [leaving, setLeaving] = useState(false);
  const camera = useThree((s) => s.camera);

  const mu = muOf(mass);

  useEffect(() => {
    state.current = launchState(launchRadius, launchSpeed);
    reachRef.current = launchRadius;
    setLeaving(false);
  }, [launchRadius, launchSpeed, mass, resetKey, reachRef]);

  useFrame((_, delta) => {
    const s = state.current;
    const real = Math.min(delta, 0.033);

    if (s.leftFor !== null) {
      // Out of view: let the path be seen, then start again.
      s.leftFor += real;
      if (loopEscape && s.leftFor >= RELAUNCH_DELAY) {
        state.current = launchState(launchRadius, launchSpeed);
        reachRef.current = launchRadius;
        setLeaving(false);
      }
    } else if (running && !s.gone) {
      advanceOrbit(s, mu, real * speed, (st) => {
        const r = Math.hypot(st.x, st.z);
        if (r > reachRef.current) reachRef.current = r;

        // It has left when it crosses the edge of the picture — the camera's
        // own frame, not a radius, which sat well inside the edge and made the
        // path stop with the satellite still plainly on screen. It has to be
        // out past the launch point too, so a camera turned to hide the launch
        // does not relaunch it in a loop.
        let out = false;
        if (loopEscape) {
          if (r > 2.5 * viewRadius) out = true;
          else if (r > Math.max(0.6 * viewRadius, 1.05 * launchRadius)) {
            _ndc.set(st.x, wellDepth(r, mu) + 0.22, st.z).project(camera);
            out = Math.abs(_ndc.x) > 1 || Math.abs(_ndc.y) > 1;
          }
        }

        // A point on the path whenever it has moved a little, a little more the
        // further out it is — so the path is smooth close in and still covers a
        // whole flight, not just the last few seconds of it, far out. The
        // crossing itself always gets one, so the path runs right to the edge.
        if (out || Math.hypot(st.x - st.lastX, st.z - st.lastZ) >= 0.03 + 0.006 * r) {
          // Once full the trail slides back by one point rather than wrapping:
          // a wrapping buffer is drawn in index order, so the seam joined the
          // newest point to the oldest with a chord straight across the orbit.
          if (st.count >= ORBIT_TRAIL_MAX) trail.copyWithin(0, 3);
          else st.count += 1;
          const o = (st.count - 1) * 3;
          trail[o] = st.x;
          trail[o + 1] = wellDepth(r, mu) + 0.12;
          trail[o + 2] = st.z;
          st.lastX = st.x;
          st.lastZ = st.z;
        }

        if (out) {
          st.leftFor = 0;
          return false;
        }
        if (r > ORBIT_GIVE_UP) {
          st.gone = true;
          return false;
        }
        return true;
      });
      if (s.leftFor !== null) setLeaving(true);
    }

    const r = Math.max(Math.hypot(s.x, s.z), 0.001);
    if (body.current) body.current.position.set(s.x, wellDepth(r, mu) + 0.22, s.z);
    if (trailGeo.current) {
      trailGeo.current.setDrawRange(0, s.count);
      trailGeo.current.attributes.position.needsUpdate = true;
      if (trailLine.current) trailLine.current.visible = showTrail && s.count > 1;
    }
  });

  return (
    <group>
      <mesh ref={body} castShadow>
        <sphereGeometry args={[0.19, 22, 22]} />
        <meshStandardMaterial color={PALETTE.emerald} emissive={PALETTE.emerald} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <line ref={trailLine} frustumCulled={false}>
        <bufferGeometry ref={trailGeo}>
          <bufferAttribute attach="attributes-position" args={[trail, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={PALETTE.emerald} transparent opacity={0.7} />
      </line>
      {leaving && (
        <SceneLabel position={[0, 3.1, 0]} tone="text-rose-300">
          {leavingNote}
        </SceneLabel>
      )}
    </group>
  );
}

const _followOffset = new THREE.Vector3();

/**
 * Frames the orbit: the camera sits back far enough to see out to
 * `viewRadius` (lib/orbit.js sizes that for the launch) and stays there, so
 * the picture does not zoom around while the satellite moves.
 *
 * With `follow` — the relaunch loop switched off — it instead keeps backing
 * off as the satellite goes further, up to a limit. It lets go the moment the
 * user takes the camera themselves, and takes over again on a fresh launch.
 */
function FollowZoom({ viewRadius, follow, reachRef, resetKey }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  // The distance this last set; null means adopt whatever the camera has now.
  const applied = useRef(null);

  useEffect(() => {
    applied.current = null;
  }, [viewRadius, resetKey, follow]);

  useFrame(() => {
    if (!controls) return;
    const reach = follow
      ? Math.min(Math.max(viewRadius, reachRef.current), FOLLOW_MAX_REACH)
      : viewRadius;
    const want = Math.max(FOLLOW_DISTANCE, 3.0 * reach);

    _followOffset.copy(camera.position).sub(controls.target);
    const dist = _followOffset.length();
    if (applied.current !== null && Math.abs(dist - applied.current) > 0.02 * applied.current) return;
    if (Math.abs(want - dist) < 0.05) {
      applied.current = dist;
      return;
    }
    const next = dist + (want - dist) * 0.06;
    camera.position.copy(controls.target).addScaledVector(_followOffset, next / dist);
    applied.current = next;
  });

  return null;
}

export function OrbitScene({ params = {} }) {
  const {
    mass = 1,
    launchRadius = 3.4,
    launchRatio = 1,
    timeScale = 1,
    running = true,
    reset = 0,
    showTrail = true,
    showWell = true,
    loopEscape = true,
    spin = false,
  } = params || {};

  // The launch speed is a multiple of the circular speed at that radius, so the
  // slider means the same thing whatever the radius and mass: 1 a circle, √2
  // an escape.
  const orbit = solveOrbit({ mass, launchRadius, launchRatio });
  const mu = orbit.mu;
  const { viewRadius } = framing(orbit, launchRadius);
  const reach = useRef(launchRadius);

  return (
    <SceneCanvas
      camera={{ position: [0, 9.5, 11], fov: 46, far: 2000 }}
      // The camera turns at a gentle fixed pace: the time-scale can run to 100×,
      // and a camera spinning 100× as fast is no use to anyone.
      controls={{ autoRotate: spin, autoRotateSpeed: 0.45, maxDistance: 500 }}
    >
      {showWell && <GravityWell mass={mass} />}

      {/* Central body, sunk to the bottom of its own well. */}
      <group position={[0, clamp(wellDepth(0.9, mu), -9, 0), 0]}>
        <mesh>
          <sphereGeometry args={[0.34 + mass * 0.12, 28, 28]} />
          <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
        <Halo radius={0.9 + mass * 0.3} color={PALETTE.gold} opacity={0.1} />
      </group>

      <Satellite
        mass={mass}
        launchRadius={launchRadius}
        launchSpeed={orbit.launchSpeed}
        running={running}
        resetKey={reset}
        showTrail={showTrail}
        speed={timeScale}
        reachRef={reach}
        viewRadius={viewRadius}
        loopEscape={loopEscape}
        leavingNote={orbit.bound ? "beyond the view — relaunching" : "escaped the well — relaunching"}
      />

      <FollowZoom viewRadius={viewRadius} follow={!loopEscape} reachRef={reach} resetKey={reset} />

      <SceneLabel position={[0, 1.5, 0]} accent>
        μ = GM = {mu.toFixed(1)}
      </SceneLabel>

    </SceneCanvas>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────

const SCENES = {
  refraction: RefractionScene,
  motor: MotorEffectScene,
  lenses: LensOpticsScene,
  induction: InductionScene,
  gas: GasLawsScene,
  projectile: ProjectileScene,
  interference: InterferenceScene,
  orbits: OrbitScene,
  shadows: ShadowLabCanvas,
  incline_friction: InclineFrictionCanvas,
  hookes_law: HookesLawCanvas,
  simple_machines: SimpleMachinesCanvas,
  roller_coaster_energy: RollerCoasterCanvas,
  circuits_breadboard: CircuitBoardCanvas,
  static_electricity: StaticElectricityCanvas,
  buoyancy: BuoyancyCanvas,
  heat_transfer: HeatTransferCanvas,
};

export default function PhysicsCanvas({ topicId, params, setParam, onOpenQuiz }) {
  const Scene = SCENES[topicId];
  if (!Scene) return null;
  return <Scene params={params} setParam={setParam} onOpenQuiz={onOpenQuiz} />;
}
