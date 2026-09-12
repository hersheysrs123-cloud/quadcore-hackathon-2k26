"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid, Html, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  AtomSphere,
  Bond,
  DEG,
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  VectorArrow,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";
import { mediumColour, mediumName } from "@/components/visualizations/media";
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

/**
 * The full parallel-sided block, not just the first surface.
 *
 * The ray refracts on the way in (i → r), crosses the block, then refracts
 * on the way out. Because the two faces are parallel, the second refraction
 * undoes the first exactly: the emergent angle equals the angle of
 * incidence, so the ray leaves parallel to how it arrived, shifted sideways
 * by the lateral displacement d = t·sin(i − r) ÷ cos r.
 */
/**
 * Fraction of the light reflected at the surface, from the Fresnel equations
 * averaged over the two polarisations (unpolarised light).
 *
 * Refraction is never all-or-nothing: about 4% comes straight back off a
 * glass surface at normal incidence, and the share climbs steeply toward 100%
 * as the ray flattens out — which is why a window is a mirror when you look
 * along it. Drawing the reflected ray at a fixed faintness hid that entirely.
 */
function fresnelReflectance(i, r, n1, n2) {
  if (r === null) return 1; // past the critical angle: everything comes back
  const cosI = Math.cos(i);
  const cosR = Math.cos(r);
  const rs = (n1 * cosI - n2 * cosR) / (n1 * cosI + n2 * cosR);
  const rp = (n1 * cosR - n2 * cosI) / (n1 * cosR + n2 * cosI);
  return clamp((rs * rs + rp * rp) / 2, 0, 1);
}

function solveBlock(angleDeg, n1, n2, thickness) {
  const i = angleDeg * DEG;
  const sinR = (n1 * Math.sin(i)) / n2;
  const tir = sinR > 1; // only possible when the block is less dense
  const r = tir ? null : Math.asin(clamp(sinR, -1, 1));
  const e = tir ? null : i; // parallel faces ⇒ emergent angle = incident angle
  const critical = n1 > n2 ? Math.asin(clamp(n2 / n1, -1, 1)) / DEG : null;
  const cosR = r !== null ? Math.cos(r) : 0;
  const lateral = tir ? 0 : Math.abs(cosR) < 1e-4 ? 0 : (thickness * Math.sin(i - (r ?? 0))) / cosR;
  const run = tir ? 0 : clamp(thickness * Math.tan(r ?? 0), -25, 25); // sideways travel inside
  const reflectance = fresnelReflectance(i, r, n1, n2);
  return { i, r, e, tir, critical, lateral, run, reflectance };
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

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Snell's law"
        subtitle={`${name1} → ${name2} → ${name1}`}
        rows={[
          ["Incidence i", `${angle.toFixed(1)}°`, "gold"],
          ["Refraction r", tir ? "—" : `${(r / DEG).toFixed(1)}°`, tir ? "bad" : "good"],
          ["Emergence e", tir ? "—" : `${(e / DEG).toFixed(1)}°`, tir ? "bad" : "gold"],
          ["n₁ sin i", (n1 * Math.sin(i)).toFixed(3), "good"],
          ["n₂ sin r", tir ? "—" : (n2 * Math.sin(r)).toFixed(3), tir ? "bad" : "good"],
          ["Lateral shift d", tir ? "—" : Math.abs(lateral).toFixed(2)],
          ["Critical angle", critical === null ? "none (n₂ ≥ n₁)" : `${critical.toFixed(1)}°`],
          ["Reflected here", `${(reflectance * 100).toFixed(0)}%`, reflectance > 0.5 ? "bad" : undefined],
          ["Transmitted", `${((1 - reflectance) * 100).toFixed(0)}%`, reflectance > 0.5 ? "bad" : "good"],
          ["Speed in medium 2", `${(3 / n2).toFixed(2)}×10⁸ m/s`],
        ]}
        note={
          tir
            ? `Total internal reflection: i is past the critical angle of ${critical?.toFixed(1)}°, so sin r would have to exceed 1. No light enters medium 2 at all.`
            : n2 > n1
              ? "The two middle rows are equal — that is Snell's law. Bends toward the normal and slows on the way in, bends back by the same amount on the way out, so the emergent ray runs parallel to the incident one."
              : n2 < n1
                ? "The two middle rows are equal — that is Snell's law. Medium 2 is less dense, so the ray bends away from the normal on entry and back toward it on exit."
                : "Both media have the same optical density, so there is nothing to bend the ray — it passes straight through."
        }
        noteTone={tir ? "bad" : n2 > n1 ? "good" : "neutral"}
      />

      <SceneLegend
        title="What you are looking at"
        items={[
          {
            color: beam,
            shape: "line",
            label: tir ? "Incident & reflected ray" : "Incident, refracted, emergent ray",
            note: `${wavelength} nm beam`,
          },
          {
            color: "#8a92a0",
            shape: "dash",
            label: "Normal",
            note: "every angle is measured from this, never from the surface",
          },
          {
            color: "#5b6472",
            shape: "dash",
            label: "Undeviated path",
            note: "where the ray would have gone with no block",
          },
          {
            color: PALETTE.gold,
            shape: "line",
            label: "Angles in medium 1",
            note: "i and e — always equal here",
          },
          {
            color: PALETTE.emerald,
            shape: "line",
            label: "Angle in medium 2 · shift d",
          },
        ]}
      />
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
      
      {/* Armor plating over the arm */}
      {[-1.3, -1.9, -2.5, -3.1].map((x) => (
        <group key={x} position={[x, -0.02, 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.38, 0.38, 0.3, 32]} />
          <meshStandardMaterial color={ROBO_PRIMARY} roughness={0.1} metalness={1.0} />
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

        {/* Internal Palm Data Streams (particles) */}
        {[-0.8, -0.6, -0.4].map((x, i) => (
           <mesh key={`stream-${i}`} position={[x, -0.45, 0.06]} rotation={[0, 0, 0]}>
             <cylinderGeometry args={[0.02, 0.02, 1.1, 8]} />
             <meshStandardMaterial color={ROBO_GREEN} emissive={ROBO_GREEN} emissiveIntensity={4.0} />
           </mesh>
        ))}

        {/* Segmented Armor Plates on Back of Hand */}
        {[-0.3, 0.3].map((offsetZ, i) => (
          <group key={offsetZ} position={[-0.6, 0.48, 0.06 + offsetZ]}>
            <mesh scale={[0.8, 0.1, 0.35]}>
              <boxGeometry args={[1.9, 1.0, 1.4]} />
              <meshStandardMaterial color={ROBO_PRIMARY} roughness={0.1} metalness={1.0} />
            </mesh>
            {/* Edge highlights */}
            <mesh scale={[0.82, 0.11, 0.37]}>
              <boxGeometry args={[1.9, 1.0, 1.4]} />
              <meshStandardMaterial color={ROBO_GOLD} metalness={1.0} roughness={0.2} wireframe />
            </mesh>
          </group>
        ))}

        {/* Warning Stripes on Armor Plates */}
        <mesh position={[-0.6, 0.54, -0.24]} rotation={[0, 0, Math.PI/4]}>
           <planeGeometry args={[0.8, 0.1]} />
           <meshStandardMaterial color={ROBO_RED} emissive={ROBO_RED} emissiveIntensity={2.5} />
        </mesh>
        
        {/* Central Power Core on Back of Hand */}
        <mesh position={[-0.6, 0.52, 0.06]} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[0.3, 0.08, 16, 32]} />
          <meshStandardMaterial color={ROBO_DARK} roughness={0.6} metalness={0.9} />
        </mesh>
        <mesh position={[-0.6, 0.52, 0.06]} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[0.22, 0.05, 16, 32]} />
          <meshStandardMaterial color={ROBO_PRIMARY} roughness={0.1} metalness={1.0} />
        </mesh>
        <mesh position={[-0.6, 0.5, 0.06]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.06, 32]} />
          <meshStandardMaterial color={ROBO_PURPLE} emissive={ROBO_PURPLE} emissiveIntensity={5.0} />
        </mesh>
        {/* Wireframe Hex Grid overlaying the core */}
        <mesh position={[-0.6, 0.55, 0.06]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.02, 6]} />
          <meshStandardMaterial color="#ffffff" wireframe emissive="#ffffff" emissiveIntensity={3.0} />
        </mesh>
        
        {/* Complex Floating Holographic UI System above Core */}
        <group position={[-0.6, 0.65, 0.06]} rotation={[Math.PI/2, 0, 0]}>
          <mesh position={[0,0,0]}>
            <torusGeometry args={[0.35, 0.005, 16, 64]} />
            <meshStandardMaterial color={ROBO_GLOW} emissive={ROBO_GLOW} emissiveIntensity={5.0} />
          </mesh>
          <mesh position={[0,0,-0.08]} rotation={[0, 0, Math.PI/4]}>
            <torusGeometry args={[0.45, 0.003, 16, 6] /* Hexagon ring */} />
            <meshStandardMaterial color={ROBO_GREEN} emissive={ROBO_GREEN} emissiveIntensity={4.0} />
          </mesh>
          <mesh position={[0,0,-0.16]}>
            <torusGeometry args={[0.55, 0.002, 16, 64]} />
            <meshStandardMaterial color={ROBO_RED} emissive={ROBO_RED} emissiveIntensity={5.0} />
          </mesh>
        </group>
        
        {/* Holographic Datapad floating next to wrist */}
        <group position={[-1.2, 0.8, -0.6]} rotation={[Math.PI/6, Math.PI/4, 0]}>
          <mesh>
             <planeGeometry args={[1.2, 0.8]} />
             <meshStandardMaterial color={ROBO_GLOW} emissive={ROBO_GLOW} emissiveIntensity={1.0} transparent opacity={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
             <planeGeometry args={[1.2, 0.8]} />
             <meshStandardMaterial color={ROBO_GLOW} emissive={ROBO_GLOW} emissiveIntensity={4.0} wireframe />
          </mesh>
          {/* Data bars */}
          {[-0.3, -0.1, 0.1, 0.3].map((y, i) => (
             <mesh key={`bar-${i}`} position={[-0.2, y, 0.02]}>
               <planeGeometry args={[Math.random() * 0.6 + 0.1, 0.05]} />
               <meshStandardMaterial color={ROBO_GREEN} emissive={ROBO_GREEN} emissiveIntensity={5.0} />
             </mesh>
          ))}
        </group>

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

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Motor effect"
        subtitle="F = B I L, all three at right angles"
        rows={[
          ["Field B", `${field.toFixed(2)} T`, "gold"],
          ["Current I", `${current.toFixed(2)} A`, "gold"],
          ["Wire in field L", `${WIRE_LENGTH.toFixed(1)} m`],
          ["Force F", hasForce ? `${force.toFixed(2)} N` : "0 N", hasForce ? "good" : "bad"],
          ["First finger", `Field → ${bSign > 0 ? "+x (right)" : "−x (left)"}`],
          ["Second finger", `Current → ${iSign > 0 ? "+z (front)" : "−z (back)"}`],
          [
            "Thumb",
            hasForce ? `Force → ${fSign > 0 ? "up" : "down"}` : "no motion",
            hasForce ? "good" : "bad",
          ],
        ]}
        note={
          !hasForce
            ? "Turn the current up. With I = 0 there is no second field around the wire for the magnet's field to push against, so F = BIL = 0."
            : reverseCurrent !== reverseField
              ? "One input reversed, so the force flipped. That is exactly why a d.c. motor needs a split-ring commutator — it reverses the current every half turn to keep the push going the same way round."
              : reverseCurrent && reverseField
                ? "Both inputs reversed, so the force is unchanged — the two flips cancel."
                : "Hold your left hand this way: First finger Field, seCond finger Current, thuMb Motion."
        }
        noteTone={!hasForce ? "bad" : reverseCurrent !== reverseField ? "warn" : "neutral"}
      />

      <SceneLegend
        title="Fleming's left hand"
        items={[
          {
            color: PALETTE.sky,
            label: "First finger — Field B",
            note: "N pole → S pole",
          },
          {
            color: PALETTE.gold,
            label: "seCond finger — Current I",
            note: "conventional current, + to −",
          },
          {
            color: PALETTE.emerald,
            label: "thuMb — Force / Motion",
            note: hasForce ? "the way the wire is pushed" : "zero while I = 0",
          },
          {
            color: PALETTE.rose,
            shape: "square",
            label: "North pole",
          },
        ]}
      />
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
  const type = params.opticsType || (params.lensType === "concave" ? "concave_lens" : params.lensType === "convex" ? "convex_lens" : "convex_lens");
  const isMirror = type.includes("mirror");
  const isConverging = type === "convex_lens" || type === "concave_mirror";
  const focal = typeof params.focal === "number" ? params.focal : 2.5;
  const objectDistance = typeof params.objectDistance === "number" ? params.objectDistance : 5.0;
  const objectHeight = typeof params.objectHeight === "number" ? params.objectHeight : 1.5;
  const showConstruction = params.showConstruction !== false;
  const showRays = params.showRays !== false;
  const showLabels = params.showLabels !== false;

  const u = objectDistance;
  const h = objectHeight;
  const f = focal;

  // Thin optics equations (real-is-positive convention):
  // Lenses: 1/v - 1/u = 1/f (converging: f > 0, diverging: f < 0)
  // Mirrors: 1/v + 1/u = 1/f (converging: f > 0, diverging: f < 0)
  const atInfinity = isConverging && Math.abs(u - f) < 0.035;

  let v = 0;
  let real = false;
  let m = 0;
  let imgX = 0;
  let imageHeight = 0;

  if (isConverging) {
    if (!atInfinity) {
      if (u > f) {
        v = (f * u) / (u - f);
        real = true;
        m = v / u;
        imageHeight = -h * m; // Inverted
        imgX = isMirror ? -v : v; // Real mirror image is in front (x < 0); real lens image is behind (x > 0)
      } else {
        v = (f * u) / (f - u);
        real = false;
        m = v / u;
        imageHeight = h * m; // Upright
        imgX = isMirror ? v : -v; // Virtual mirror image is behind (x > 0); virtual lens image is on object side (x < 0)
      }
    }
  } else {
    // Diverging optical element: Concave Lens or Convex Mirror
    v = (f * u) / (u + f);
    real = false;
    m = v / u;
    imageHeight = h * m; // Upright
    imgX = isMirror ? v : -v; // Virtual mirror image behind (x > 0); virtual lens image on object side (x < 0)
  }

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

  const nature = atInfinity
    ? "No image — rays leave parallel (spotlight)"
    : `${real ? "Real" : "Virtual"}, ${imageHeight < 0 ? "inverted" : "upright"}, ${
        m > 1.02 ? "magnified" : m < 0.98 ? "diminished" : "same size"
      }`;

  const titleMap = {
    convex_lens: "Convex Lens (Converging)",
    concave_lens: "Concave Lens (Diverging)",
    concave_mirror: "Concave Mirror (Converging)",
    convex_mirror: "Convex Mirror (Diverging)",
  };

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

        <SceneReadout
          hidden={params?.hideOverlayReadout}
          title={titleMap[type] || "Ray Optics"}
          subtitle={isMirror ? "1/v + 1/u = 1/f  ·  m = |v ÷ u|" : "1/v − 1/u = 1/f  ·  m = |v ÷ u|"}
          rows={[
            ["Object distance u", `${u.toFixed(1)} cm`],
            ["Object height h", `${h.toFixed(1)} cm`],
            ["Focal length f", `${f.toFixed(1)} cm`, "gold"],
            ["Image distance v", atInfinity ? "∞" : `${Math.abs(v).toFixed(1)} cm`, real ? "good" : "bad"],
            ["Image height h'", atInfinity ? "—" : `${Math.abs(imageHeight).toFixed(2)} cm`],
            ["Magnification m", atInfinity ? "∞" : `${m.toFixed(2)}×`],
            ["Nature", real ? "real" : atInfinity ? "none" : "virtual", real ? "good" : "bad"],
            ["Orientation", atInfinity ? "—" : imageHeight < 0 ? "inverted" : "upright"],
            ["Object position", u > 2 * f ? "beyond 2F (C)" : u > f ? "between F & 2F" : "inside F"],
          ]}
          note={
            atInfinity
              ? "Object is at focal point F: rays leave exactly parallel and never intersect (collimator spotlight)."
              : nature
          }
          noteTone={atInfinity ? "warn" : real ? "good" : "neutral"}
        />

        <SceneLegend
          title="Ray construction"
          items={[
            {
              color: PALETTE.gold,
              label: "Object",
              note: `upright arrow (h = ${h.toFixed(1)} cm)`,
            },
            {
              color: PALETTE.emerald,
              shape: "line",
              label: "Ray 1 — parallel",
              note: isMirror
                ? (isConverging ? "reflects through focus F" : "reflects diverging from virtual F")
                : (isConverging ? "refracts through focus F" : "refracts diverging from virtual F"),
            },
            {
              color: PALETTE.sky,
              shape: "line",
              label: isMirror ? "Ray 2 — pole reflection" : "Ray 2 — optical center",
              note: isMirror
                ? "reflects at equal angle from mirror vertex"
                : "passes straight through undeviated",
            },
            ...(showConstruction && showThirdRay
              ? [
                  {
                    color: PALETTE.violet,
                    shape: "line",
                    label: "Ray 3 — focal ray",
                    note: "passes through F, emerges parallel to axis",
                  },
                ]
              : []),
            {
              color: real ? PALETTE.emerald : PALETTE.rose,
              label: real ? "Real image" : "Virtual image",
              note: real
                ? "rays physically converge — caught on a screen"
                : "rays diverge — backward projections meet",
            },
          ]}
        />
      </group>
    </SceneCanvas>
  );
}

// ═══ 4 · Electromagnetic induction & Faraday's law ════════════════════

// Half-width and half-height of the coil, and the area they enclose. The
// scene and the coil both need these, and the flux is wrong if they drift.
const COIL_W = 1.5;
const COIL_H = 1.0;
const COIL_AREA = 2 * COIL_W * 2 * COIL_H;

/**
 * Peak e.m.f. of an N-turn coil of area A turning at ω in a field B.
 * Each turn cuts the same flux, so they add: ε₀ = N B A ω.
 */
const peakEmf = (field, omega, turns = 1) => turns * field * COIL_AREA * omega;

const omegaOf = (speed) => speed * 1.7;

/**
 * Flux through the coil at rotation angle θ.
 *
 * The coil is built in the XY plane, so its normal starts along +z, and it
 * turns about y — which puts the normal at (sin θ, 0, cos θ). B lies along
 * +x, so Φ = B·A·sin θ, *not* cos θ. Getting this backwards (as this scene
 * did) puts the readout a quarter turn out of step with the model: it
 * announced "cutting no field lines" at the exact moment the coil was drawn
 * edge-on to the field, sweeping across the lines as fast as it ever does.
 */
const fluxAt = (field, angle) => field * COIL_AREA * Math.sin(angle);

/** ε = −N·dΦ/dt = −N·B·A·ω·cos θ. */
const emfAt = (field, omega, angle, turns = 1) =>
  -turns * field * COIL_AREA * omega * Math.cos(angle);

function solveSolenoidInduction({
  x = 0,
  velocity = 0,
  turns = 10,
  magnetStrength = 1.0,
  radius = 0.9,
  flipPoles = false,
} = {}) {
  const safeTurns = Math.max(1, Math.round(turns || 1));
  const polarity = flipPoles ? -1 : 1;
  const m = (magnetStrength || 1.0) * polarity;
  const R = radius || 0.9;
  const denom = Math.pow(x * x + R * R, 1.5);
  const C = 2.0 * R;
  const flux = (C * m * R * R) / denom;
  const dPhi_dx = (-3 * C * m * R * R * x) / Math.pow(x * x + R * R, 2.5);
  const rawEmf = -safeTurns * dPhi_dx * velocity;
  const emf = Object.is(rawEmf, -0) || Math.abs(rawEmf) < 1e-12 ? 0 : rawEmf;
  return {
    turns: safeTurns,
    flux: Object.is(flux, -0) || Math.abs(flux) < 1e-12 ? 0 : flux,
    dPhi_dx: Object.is(dPhi_dx, -0) || Math.abs(dPhi_dx) < 1e-12 ? 0 : dPhi_dx,
    emf,
    velocity,
    direction: Math.abs(emf) < 0.05 ? "none" : emf > 0 ? "clockwise" : "anticlockwise",
  };
}

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
 */
function LaboratoryGalvanometer({ position = [-1.3, -3.3, 1.35], needleRef }) {
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
      {/* Scale arc */}
      <Line
        points={[
          [-0.75, 0.83, 0.21],
          [-0.38, 1.01, 0.21],
          [0, 1.07, 0.21],
          [0.38, 1.01, 0.21],
          [0.75, 0.83, 0.21],
        ]}
        color="#64748b"
        lineWidth={1.5}
      />
      {[
        { x: -0.65, y1: 0.87, y2: 0.95 },
        { x: -0.35, y1: 1.0, y2: 1.08 },
        { x: 0, y1: 1.07, y2: 1.15 },
        { x: 0.35, y1: 1.0, y2: 1.08 },
        { x: 0.65, y1: 0.87, y2: 0.95 },
      ].map((t, idx) => (
        <Line
          key={idx}
          points={[
            [t.x, t.y1, 0.21],
            [t.x * 0.95, t.y2, 0.21],
          ]}
          color="#475569"
          lineWidth={1.8}
        />
      ))}

      {/* Needle pivot center at y = 0.33 */}
      <mesh position={[0, 0.33, 0.22]}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Pivoted high-visibility red needle */}
      <group ref={needleRef} position={[0, 0.33, 0.23]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.035, 0.8, 0.02]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Terminal binding posts */}
      <mesh position={[-0.85, 0.2, 0.22]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0.85, 0.2, 0.22]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.5} />
      </mesh>

      <SceneLabel position={[0, 0.8, 0.22]} tone="text-ink-400">
        0
      </SceneLabel>
      <SceneLabel position={[-0.65, 0.7, 0.22]} tone="text-ink-500">
        −
      </SceneLabel>
      <SceneLabel position={[0.65, 0.7, 0.22]} tone="text-ink-500">
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

/**
 * Live e.m.f.–time trace for AC Generator over two full turns.
 */
const TRACE = { width: 5.6, height: 0.82, turns: 2 };

function EmfTrace({ speed, field, turns, angleRef }) {
  const marker = useRef(null);
  const omega = omegaOf(speed);
  const safeTurns = Math.max(1, Math.round(turns || 1));
  const peak = peakEmf(field, omega, safeTurns);

  const amp = clamp(peak * 0.016, 0, 1) * TRACE.height;
  const sweep = TRACE.turns * Math.PI * 2;
  const xOf = (angle) => -TRACE.width / 2 + (((angle % sweep) + sweep) % sweep) / sweep * TRACE.width;
  const yOf = (angle) => -amp * Math.cos(angle);

  const curve = useMemo(() => {
    const pts = [];
    for (let k = 0; k <= 200; k += 1) {
      const angle = (k / 200) * sweep;
      pts.push([-TRACE.width / 2 + (k / 200) * TRACE.width, yOf(angle), 0]);
    }
    return pts;
  }, [amp, sweep]);

  useFrame(() => {
    if (!marker.current) return;
    marker.current.position.set(xOf(angleRef.current), yOf(angleRef.current), 0);
  });

  return (
    <group position={[0, 4.0, 0]}>
      {/* Zero line */}
      <Line
        points={[
          [-TRACE.width / 2 - 0.3, 0, 0],
          [TRACE.width / 2 + 0.3, 0, 0],
        ]}
        color={PALETTE.line}
        lineWidth={1.4}
      />
      {/* Half-turn gridlines */}
      {[0.25, 0.5, 0.75].map((t) => (
        <Line
          key={t}
          points={[
            [-TRACE.width / 2 + t * TRACE.width, -TRACE.height, 0],
            [-TRACE.width / 2 + t * TRACE.width, TRACE.height, 0],
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

      <SceneLabel position={[-TRACE.width / 2 - 0.75, 0, 0]} tone="text-ink-400">
        0 V
      </SceneLabel>
      <SceneLabel position={[0, TRACE.height + 0.35, 0]} accent>
        induced e.m.f. against time · two full turns
      </SceneLabel>
    </group>
  );
}

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

  const safeTurns = Math.max(1, Math.round(turns || 1));
  const [sample, setSample] = useState(() => ({
    emf: emfAt(field, omegaOf(speed), 0, safeTurns),
    angle: 0,
  }));
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
  const flux = fluxAt(field, sample.angle);
  const peak = peakEmf(field, omega, safeTurns);
  const direction =
    Math.abs(sample.emf) < 0.05 ? "none" : sample.emf > 0 ? "clockwise" : "anticlockwise";
  const cutting = Math.abs(Math.cos(sample.angle));

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    angleRef.current += step * omega;

    const emf = emfAt(field, omega, angleRef.current, safeTurns);

    if (coil.current) coil.current.rotation.y = angleRef.current;
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

    // Dynamic magnetic flux sheet inside coil aperture
    if (fluxPlane.current) {
      const sinAngle = Math.abs(Math.sin(angleRef.current));
      fluxPlane.current.material.opacity = 0.04 + sinAngle * 0.38 * Math.min(field, 1.5);
    }

    // Circulating charge flow particles along coil perimeter
    if (showCurrent) {
      currentPhase.current += step * emf * 1.6;
      const perim = 2 * (2 * w + 2 * hh);
      currentDots.current.forEach((dot, idx) => {
        if (!dot) return;
        const s = (((idx / 16) * perim + currentPhase.current) % perim + perim) % perim;
        let px = 0;
        let py = 0;
        if (s < 2 * w) {
          px = -w + s;
          py = hh;
        } else if (s < 2 * w + 2 * hh) {
          px = w;
          py = hh - (s - 2 * w);
        } else if (s < 4 * w + 2 * hh) {
          px = w - (s - (2 * w + 2 * hh));
          py = -hh;
        } else {
          px = -w;
          py = -hh + (s - (4 * w + 2 * hh));
        }
        dot.position.set(px, py, 0);
      });
    }

    sampleClock.current += step;
    if (sampleClock.current > 0.1) {
      sampleClock.current = 0;
      setSample({ emf, angle: angleRef.current });
    }
  });

  const corners = [
    [-w, hh, 0],
    [w, hh, 0],
    [w, -hh, 0],
    [-w, -hh, 0],
  ];
  const windings = Array.from({ length: safeTurns }, (_, k) => (k - (safeTurns - 1) / 2) * 0.13);

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

      {/* Magnetic Field Lines */}
      {showFieldLines &&
        fieldLines.map(({ y, z }, i) => (
          <group key={i}>
            <Line
              points={[
                [-2.8, y, z],
                [2.8, y, z],
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

          {/* Stacked Copper Turns */}
          {windings.map((dz, k) =>
            corners.map((c, i) => (
              <Bond
                key={`${k}-${i}`}
                from={[c[0], c[1], c[2] + dz]}
                to={[
                  corners[(i + 1) % corners.length][0],
                  corners[(i + 1) % corners.length][1],
                  corners[(i + 1) % corners.length][2] + dz,
                ]}
                radius={0.06}
                color="#ea580c"
                emissive="#fb923c"
              />
            )),
          )}

          {/* Dynamic charge flow particles */}
          {showCurrent &&
            Array.from({ length: 16 }, (_, idx) => (
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

          {/* Leads down to slip rings */}
          <Bond from={[w, -hh, 0]} to={[0.16, -1.45, 0]} radius={0.045} color="#ea580c" />
          <Bond from={[-w, -hh, 0]} to={[-0.16, -1.85, 0]} radius={0.045} color="#ea580c" />

          {/* Central Drive Shaft */}
          <mesh position={[0, -2.1, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 2.6, 16]} />
            <meshStandardMaterial color="#f1f5f9" metalness={0.9} roughness={0.15} />
          </mesh>

          {/* Polished Brass Slip Rings */}
          {[-1.45, -1.85].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.24, 0.06, 12, 32]} />
              <meshStandardMaterial
                color="#fbbf24"
                metalness={0.88}
                roughness={0.18}
                emissive="#f59e0b"
                emissiveIntensity={0.15}
              />
            </mesh>
          ))}

          {showCurrent && (
            <>
              <VectorArrow
                from={[w, -0.5, 0]}
                to={[w, 0.6, 0]}
                color={PALETTE.gold}
                radius={0.04}
                headLength={0.26}
                headRadius={0.11}
              />
              <VectorArrow
                from={[-w, 0.5, 0]}
                to={[-w, -0.6, 0]}
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

      {/* Insulated Wiring Down to Galvanometer & Bulb */}
      <Line
        points={[
          [-0.42, -1.85, 0],
          [-0.42, -3.25, 0],
          [-2.15, -3.25, 1.15],
          [-2.15, -3.10, 1.35],
        ]}
        color="#ea580c"
        lineWidth={2.2}
      />
      <Line
        points={[
          [0.42, -1.45, 0],
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
              [-0.42, -1.85, 0],
              [-0.42, -3.25, 0],
              [1.46, -3.25, 1.15],
              [1.46, -3.15, 1.35],
            ]}
            color="#ea580c"
            lineWidth={2.2}
          />
          <Line
            points={[
              [0.42, -1.45, 0],
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

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Faraday's law · Dynamo"
        subtitle="Φ = B A sin θ  ·  ε = −N ΔΦ/Δt"
        rows={[
          ["Turns N", safeTurns, "gold"],
          ["Coil area A", `${COIL_AREA.toFixed(1)} m²`],
          ["Flux Φ per turn", `${flux.toFixed(2)} Wb`],
          [
            "e.m.f. now",
            `${sample.emf.toFixed(2)} V`,
            Math.abs(sample.emf) > 0.5 * peak ? "gold" : undefined,
          ],
          ["Peak e.m.f. ε₀", `${peak.toFixed(2)} V`, peak > 0.05 ? "good" : "bad"],
          ["Rotation", speed < 0.05 ? "stopped" : `${speed.toFixed(1)} rev/s`],
          ["Current", direction, direction === "none" ? "bad" : "good"],
        ]}
        note={
          speed < 0.05
            ? "Stationary coil: the flux through it never changes, so no e.m.f. is induced at all. Motion — or any change of flux — is the whole requirement."
            : cutting > 0.9
              ? "The coil is edge-on to the field right now, slicing across the lines as fast as it ever does. Flux is momentarily zero but changing fastest, so the e.m.f. is at its peak."
              : cutting < 0.15
                ? "The coil is face-on to the field. Flux is at its maximum but momentarily not changing, so the e.m.f. is zero — maximum flux and maximum e.m.f. never happen together."
                : "The e.m.f. reverses every half turn, which is exactly what makes the output alternating."
        }
        noteTone={speed < 0.05 ? "bad" : cutting > 0.9 ? "good" : "neutral"}
      />

      <SceneLegend
        title="Generator"
        items={[
          { color: PALETTE.rose, shape: "square", label: "N pole", note: "field runs N → S" },
          { color: PALETTE.sky, shape: "dash", label: "Magnetic field lines B", note: "density ∝ B" },
          { color: "#ea580c", shape: "line", label: "Copper coil", note: "cuts field lines" },
          { color: PALETTE.gold, shape: "line", label: "e.m.f. trace & bulb", note: "alternating AC waveform" },
          {
            color: "#fbbf24",
            label: "Slip rings",
            note: "continuous rings maintain alternating AC",
          },
        ]}
      />
    </>
  );
}

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

  const safeTurns = Math.max(1, Math.round(turns || 1));
  const safePos = typeof magnetPos === "number" && !isNaN(magnetPos) ? magnetPos : 0;

  const magnetRef = useRef(null);
  const needleRef = useRef(null);
  const bulbRef = useRef({});
  const chargesRef = useRef([]);
  const magnetX = useRef(safePos);
  const oscPhase = useRef(0);
  const currentPhase = useRef(0);
  const sampleClock = useRef(0);

  const [sample, setSample] = useState(() => ({
    emf: 0,
    flux: 0,
    dPhi_dx: 0,
    velocity: 0,
    x: safePos,
  }));

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    let x = magnetX.current;
    let v = 0;

    if (autoOscillate) {
      oscPhase.current += step * speed * 2.2;
      const targetX = 3.2 * Math.sin(oscPhase.current);
      v = (targetX - x) / Math.max(step, 0.001);
      x = targetX;
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
      radius: 0.92,
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

    // Circulating charges in the solenoid windings
    if (showCurrent) {
      currentPhase.current += step * induction.emf * 3.0;
      chargesRef.current.forEach((dot, idx) => {
        if (!dot) return;
        const angle = (idx / 12) * Math.PI * 2 + currentPhase.current;
        dot.position.y = 0.96 * Math.sin(angle);
        dot.position.z = 0.96 * Math.cos(angle);
      });
    }

    sampleClock.current += step;
    if (sampleClock.current > 0.1) {
      sampleClock.current = 0;
      setSample({
        emf: induction.emf,
        flux: induction.flux,
        dPhi_dx: induction.dPhi_dx,
        velocity: v,
        x,
      });
    }
  });

  const turnSpacing = safeTurns > 1 ? 2.6 / (safeTurns - 1) : 0;
  const turnPositions = Array.from({ length: safeTurns }, (_, k) =>
    safeTurns > 1 ? -1.3 + k * turnSpacing : 0,
  );

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
      loops.push(pts);
    }
    return loops;
  }, []);

  const isMoving = Math.abs(sample.velocity) > 0.08;
  const isApproaching = sample.x * sample.velocity < 0;

  // Real-time instantaneous power for readout
  const vRated = 85.0;
  const readoutRatio = Math.abs(sample.emf) / vRated;
  const readoutPower = clamp(Math.pow(readoutRatio, 1.6), 0, 2.8);

  return (
    <>
      {/* Bench Baseplate (y = -3.48, top surface at y = -3.30) */}
      <LaboratoryBench />

      {/* Guide Rail Bench Stanchions (4 pillars from bench y = -3.30 to rails y = -0.70) */}
      {[-3.6, 3.6].map((gx) =>
        [-0.6, 0.6].map((gz) => (
          <mesh key={`${gx}-${gz}`} position={[gx, -2.0, gz]}>
            <cylinderGeometry args={[0.04, 0.06, 2.6, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          </mesh>
        )),
      )}

      {/* Polished Guide Rails on Bench */}
      <mesh position={[0, -0.7, -0.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 11, 16]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.92} roughness={0.1} />
      </mesh>
      <mesh position={[0, -0.7, 0.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 11, 16]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.92} roughness={0.1} />
      </mesh>

      {/* Solenoid Assembly at y = 0.2 */}
      <group position={[0, 0.2, 0]}>
        {/* Transparent acrylic support tube */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.92, 0.92, 3.8, 32, 1, true]} />
          <meshPhysicalMaterial
            color="#e2e8f0"
            transparent
            opacity={0.22}
            roughness={0.1}
            transmission={0.85}
          />
        </mesh>

        {/* Aluminum Stanchions from bench (-3.30) to tube (+0.20) */}
        {[-1.5, 1.5].map((sx) => (
          <mesh key={sx} position={[sx, -1.55, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 3.5, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}

        {/* Helical copper coil turns */}
        {turnPositions.map((tx, idx) => (
          <group key={idx} position={[tx, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <mesh>
              <torusGeometry args={[0.96, 0.055, 12, 40]} />
              <meshStandardMaterial
                color="#ea580c"
                emissive="#fb923c"
                emissiveIntensity={0.2}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}

        {/* Pitch segments linking coil turns */}
        {turnPositions.slice(0, -1).map((tx, idx) => (
          <Line
            key={`link-${idx}`}
            points={[
              [tx, 0.96, 0],
              [turnPositions[idx + 1], 0.96, 0],
            ]}
            color="#ea580c"
            lineWidth={3.0}
          />
        ))}

        {/* Circulating charge dots visualizing induced current flow */}
        {showCurrent &&
          Array.from({ length: 12 }, (_, idx) => (
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

        {/* Lenz's Law opposing magnetic field indicator */}
        {isMoving && (
          <group position={[0, 0, 0]}>
            <VectorArrow
              from={[sample.velocity > 0 ? 0.6 : -0.6, 0, 0]}
              to={[sample.velocity > 0 ? -0.6 : 0.6, 0, 0]}
              color={PALETTE.emerald}
              radius={0.06}
              headLength={0.32}
              headRadius={0.14}
            />
            <SceneLabel position={[0, 1.45, 0]} tone="text-emerald-400">
              B_induced opposes ΔΦ
            </SceneLabel>
          </group>
        )}

        <SceneLabel position={[0, -1.2, 0]} tone="text-ink-400">
          copper solenoid ({safeTurns} turns)
        </SceneLabel>
      </group>

      {/* Movable Bar Magnet */}
      <group ref={magnetRef} position={[magnetX.current, 0.2, 0]}>
        {/* Sliding Sled on Guide Rails */}
        <mesh position={[0, -0.9, 0]}>
          <boxGeometry args={[1.8, 0.25, 1.4]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.8, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>

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

        {/* Dipole Field Lines moving with the magnet */}
        {showFieldLines &&
          dipoleLoops.map((pts, idx) => (
            <Line
              key={`loop-${idx}`}
              points={pts}
              color="#38bdf8"
              lineWidth={1.4}
              transparent
              opacity={0.35}
              dashed
              dashSize={0.24}
              gapSize={0.16}
            />
          ))}
      </group>

      {/* Circuit wiring from Solenoid down along bench to Galvanometer & Bulb */}
      <Line
        points={[
          [-1.5, -1.55, 0],
          [-1.5, -3.25, 0],
          [-2.15, -3.25, 1.15],
          [-2.15, -3.10, 1.35],
        ]}
        color="#ea580c"
        lineWidth={2.2}
      />
      <Line
        points={[
          [1.5, -1.55, 0],
          [1.5, -3.25, 0],
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
              [-1.5, -1.55, 0],
              [-1.5, -3.25, 0],
              [1.46, -3.25, 1.15],
              [1.46, -3.15, 1.35],
            ]}
            color="#ea580c"
            lineWidth={2.2}
          />
          <Line
            points={[
              [1.5, -1.55, 0],
              [1.5, -3.25, 0],
              [2.14, -3.25, 1.15],
              [2.14, -3.15, 1.35],
            ]}
            color="#38bdf8"
            lineWidth={2.2}
          />
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

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Faraday's Law · Solenoid"
        subtitle="ε = −N (dΦ/dt) = −N (dΦ/dx) · v"
        rows={[
          ["Coil turns N", safeTurns, "gold"],
          ["Magnet position x", `${sample.x > 0 ? "+" : ""}${sample.x.toFixed(2)} cm`],
          ["Velocity v", `${sample.velocity > 0 ? "+" : ""}${sample.velocity.toFixed(2)} cm/s`],
          ["Flux Φ per turn", `${sample.flux.toFixed(2)} Wb`],
          [
            "Induced e.m.f. ε",
            `${sample.emf.toFixed(2)} V`,
            Math.abs(sample.emf) > 0.1 ? "gold" : undefined,
          ],
          [
            "Bulb state",
            readoutPower > 1.2
              ? "Glowing brilliant white"
              : readoutPower > 0.4
                ? "Glowing bright yellow"
                : readoutPower > 0.08
                  ? "Dim amber glow"
                  : "Off (unpowered)",
            readoutPower > 0.08 ? "gold" : "neutral",
          ],
          [
            "Current",
            Math.abs(sample.emf) < 0.05 ? "none" : sample.emf > 0 ? "clockwise" : "anticlockwise",
            Math.abs(sample.emf) < 0.05 ? "bad" : "good",
          ],
        ]}
        note={
          !isMoving
            ? "Stationary magnet: flux is constant (dΦ/dt = 0), so induced e.m.f. is strictly zero. Relative motion is the sole requirement."
            : isApproaching
              ? "Approaching coil: flux is rapidly increasing. By Lenz's law, the coil induces a matching pole to repel the incoming magnet."
              : "Departing coil: flux is decreasing. By Lenz's law, the coil induces an opposite pole to attract the receding magnet."
        }
        noteTone={!isMoving ? "bad" : "good"}
      />

      <SceneLegend
        title="Solenoid Apparatus"
        items={[
          { color: PALETTE.rose, shape: "square", label: "N pole", note: "Red magnetic pole half" },
          { color: PALETTE.sky, shape: "square", label: "S pole", note: "Blue magnetic pole half" },
          { color: "#ea580c", shape: "line", label: "Copper Solenoid", note: `${safeTurns}-turn helical winding` },
          { color: PALETTE.emerald, shape: "line", label: "Lenz's Law B_induced", note: "Opposes rate of change" },
          { color: PALETTE.gold, shape: "dot", label: "Demonstration bulb", note: "Incandescent filament glow" },
        ]}
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

  // p ∝ NT/V, normalised so 60 particles at 300 K in unit volume ≈ 101 kPa.
  const pressure = 101 * (particles / 60) * (temperature / 300) / volume;
  // Printed so the constant behind Boyle's and Charles's laws is visible as a
  // number that refuses to move while p, V and T all do.
  const pV = pressure * volume;

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

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Gas state"
        subtitle="p ∝ N T ÷ V"
        rows={[
          ["Pressure p", `${pressure.toFixed(0)} kPa`, "gold"],
          ["Temperature T", `${temperature.toFixed(0)} K`, temperature > 600 ? "warn" : undefined],
          ["…in celsius", `${(temperature - 273).toFixed(0)} °C`],
          ["Volume V", `${volume.toFixed(2)} V₀`, volume < 0.7 ? "warn" : undefined],
          ["Particles N", particles],
          ["Mean speed", `${Math.sqrt(temperature / 300).toFixed(2)}× (300 K)`],
          ["Wall hits/s", rate],
          ["pV ÷ T", (pV / temperature).toFixed(2), "good"],
        ]}
        note={
          temperature > 600
            ? "Hot: the particles carry more kinetic energy, so they hit the walls harder and more often. At fixed V that means p ∝ T — watch pV ÷ T stay put."
            : volume < 0.7
              ? "Compressed: the same collisions are spread over less wall area, so the pressure rises. At fixed T, pV stays constant — Boyle's law."
              : "Pressure is the total force of the particle collisions per unit area of wall. pV ÷ T holds constant however you move the sliders — that is the gas law."
        }
        noteTone={temperature > 600 || volume < 0.7 ? "warn" : "neutral"}
      />

      <SceneLegend
        title="Kinetic particle model"
        items={[
          {
            color: PALETTE.sky,
            label: "Cold particle",
            note: "slower, less kinetic energy",
          },
          {
            color: PALETTE.rose,
            label: "Hot particle",
            note: "faster, hits the wall harder",
          },
          {
            color: "#5b6472",
            shape: "square",
            label: "Piston",
            note: "the movable wall — volume is how far along it sits",
          },
          {
            color: PALETTE.gold,
            label: "Speeds vary",
            note: "particles share a mean, not a single speed",
          },
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 6 · Projectile motion with air resistance ═══════════════════════

/** Roughly how many world units wide the drawn trajectory should be. */
const PROJECTILE_SPAN = 9;
const SIM_DT = 0.004;
const SIM_MAX_TIME = 60;
/** Runway deck top surface height in world units. */
const RUNWAY_TOP_Y = 0.28;
/** Ball radius in world units. */
const BALL_RADIUS = 0.13;
/** Launch and landing origin height: runway deck surface plus ball radius so ball rests perfectly on deck. */
const LAUNCH_Y = RUNWAY_TOP_Y + BALL_RADIUS;

/**
 * Integrates the flight until it returns to the ground.
 *
 * Drag is quadratic (F = −k|v|v), not linear: at the speeds a thrown or
 * launched object actually reaches, that is the regime that applies, and it
 * is what makes the trajectory visibly asymmetric — the fall is steeper than
 * the climb, which no textbook parabola ever shows.
 */
function simulateFlight(speed, angleDeg, gravity, drag, mass) {
  const angle = angleDeg * DEG;
  let vx = speed * Math.cos(angle);
  let vy = speed * Math.sin(angle);
  let x = 0;
  let y = 0;
  let t = 0;
  const points = [[0, 0, 0]];
  // Flat typed arrays rather than one object per step: a long lunar flight is
  // 15 000 steps, this runs twice (with drag and without), and it re-runs on
  // every frame of a slider drag. Sample i is simply t = i·SIM_DT.
  const cap = Math.round(SIM_MAX_TIME / SIM_DT) + 2;
  const sx = new Float32Array(cap);
  const sy = new Float32Array(cap);
  const svx = new Float32Array(cap);
  const svy = new Float32Array(cap);
  svx[0] = vx;
  svy[0] = vy;
  let n = 1;
  let apex = 0;
  let apexX = 0;

  while (t < SIM_MAX_TIME && n < cap) {
    const v = Math.hypot(vx, vy);
    const k = drag / Math.max(mass, 0.05);
    const ax = -k * v * vx;
    const ay = -gravity - k * v * vy;

    vx += ax * SIM_DT;
    vy += ay * SIM_DT;
    const nx = x + vx * SIM_DT;
    const ny = y + vy * SIM_DT;
    t += SIM_DT;

    if (ny < 0) {
      // Land exactly on the ground rather than a step below it, so the range
      // readout does not jitter with the integrator's step size.
      const f = y / (y - ny || 1);
      x += (nx - x) * f;
      y = 0;
      points.push([x, 0, 0]);
      sx[n] = x;
      sy[n] = 0;
      svx[n] = vx;
      svy[n] = vy;
      n += 1;
      break;
    }

    x = nx;
    y = ny;
    if (y > apex) {
      apex = y;
      apexX = x;
    }
    // Every step would be 15 000 points for a long flight; every eighth is
    // still smooth at this scale.
    if (n % 8 === 0) points.push([x, y, 0]);
    sx[n] = x;
    sy[n] = y;
    svx[n] = vx;
    svy[n] = vy;
    n += 1;
  }

  const last = n - 1;
  return {
    points,
    sx,
    sy,
    svx,
    svy,
    count: n,
    range: sx[last],
    apex,
    apexX,
    // The landing step is interpolated, so the true flight time sits a
    // fraction of a step before the last recorded index.
    flightTime: last * SIM_DT,
    impactSpeed: Math.hypot(svx[last], svy[last]),
  };
}

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
          <Html center style={{ pointerEvents: "none" }} zIndexRange={[40, 0]}>
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
        <group key={`mark-${d}`} position={[d * scale, RUNWAY_TOP_Y + 0.003, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.035, 0.44]} />
            <meshBasicMaterial color="#334155" />
          </mesh>
          {showLabels && (
            <SceneLabel position={[0, -0.28, 0.28]} className="text-[9px] font-mono font-semibold text-slate-700">
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
        <SceneLabel position={[0, 0.28, 0]} accent>
          Apex {apexMeters.toFixed(1)}m
        </SceneLabel>
      )}
    </group>
  );
}

/** Concentric landing bullseye on runway with distance badge. */
function LandingTarget({ x, label, color = PALETTE.emerald, showLabels = true }) {
  return (
    <group position={[x, RUNWAY_TOP_Y + 0.003, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.24, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.065, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {showLabels && (
        <SceneLabel position={[0, -0.32, -0.25]}>
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

    if (vectorsGroup.current) {
      vectorsGroup.current.position.set(ballX, ballY, 0);
      vectorsGroup.current.visible = Boolean(showVectors);
    }

    if (showVectors) {
      const speed = Math.hypot(pvx, pvy);
      const safeSpeed = Math.max(speed, 1e-4);
      const dirVx = pvx / safeSpeed;
      const dirVy = pvy / safeSpeed;

      // 1. Velocity vector v (sky blue)
      const vLen = clamp(speed * 0.075, 0.22, 2.2);
      updateVector(vArrowRef, vShaftRef, vHeadRef, vLabelRef, dirVx, dirVy, vLen);

      // 2. Weight force W = mg (rose) - constant downward
      const wMag = mass * gravity;
      const wLen = clamp(wMag * 0.045, 0.35, 1.8);
      updateVector(wArrowRef, wShaftRef, wHeadRef, wLabelRef, 0, -1, wLen);

      // 3. Drag force F_drag = -k|v|v (amber) - opposes velocity
      const fDrag = drag * (pvx * pvx + pvy * pvy);
      const dLen = drag > 0.001 ? clamp(fDrag * 0.05, 0.12, 2.0) : 0;
      updateVector(dArrowRef, dShaftRef, dHeadRef, dLabelRef, -dirVx, -dirVy, dLen);

      // 4. Net resultant force F_net = W + F_drag (emerald)
      const fNetX = -drag * speed * pvx;
      const fNetY = -mass * gravity - drag * speed * pvy;
      const fNetMag = Math.hypot(fNetX, fNetY);
      const netLen = clamp(fNetMag * 0.042, 0.22, 2.2);
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

  const lost = ideal.range > 0 ? 1 - flight.range / ideal.range : 0;

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
      {showIdeal && (
        <LandingTarget x={ideal.range * scale} label={`${ideal.range.toFixed(1)}m (vac)`} color={PALETTE.slate} showLabels={showLabels} />
      )}

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Flight"
        subtitle="quadratic drag · F = −k|v|v"
        rows={[
          ["Time t", `${live.t.toFixed(2)} s`],
          ["Distance x", `${live.x.toFixed(1)} m`],
          ["Height y", `${live.y.toFixed(1)} m`],
          ["Speed |v|", `${live.speed.toFixed(1)} m/s`, "gold"],
          ["Drag force", `${(live.dragForce ?? 0).toFixed(1)} N`, drag > 0.005 ? "warn" : undefined],
          ["Range", `${flight.range.toFixed(1)} m`, "good"],
          ["…without drag", `${ideal.range.toFixed(1)} m`],
          ["Range lost", `${(lost * 100).toFixed(0)}%`, lost > 0.3 ? "bad" : lost > 0.1 ? "warn" : undefined],
          ["Max height", `${flight.apex.toFixed(1)} m (at ${(flight.apexX ?? 0).toFixed(1)}m)`],
          ["Flight time", `${flight.flightTime.toFixed(2)} s`],
          ["Impact speed", `${flight.impactSpeed.toFixed(1)} m/s`],
        ]}
        note={
          drag < 0.005
            ? "With zero atmospheric drag, the flight path is a perfect symmetrical parabola with apex at exactly 50% range, and 45° yields maximum range."
            : `Quadratic drag removes momentum throughout flight, causing an asymmetric path with steeper descent and shifting the apex backwards to ${((flight.apexX / (flight.range || 1)) * 100).toFixed(0)}% of range.`
        }
        noteTone={lost > 0.3 ? "warn" : "neutral"}
      />

      <SceneLegend
        title="Projectile"
        items={[
          { color: PALETTE.emerald, shape: "line", label: "With drag", note: "Asymmetric path — steep descent" },
          { color: PALETTE.slate, shape: "dash", label: "No drag", note: "Ideal symmetric parabola" },
          { color: PALETTE.sky, shape: "line", label: "Velocity v", note: "Tangential to trajectory path" },
          { color: PALETTE.rose, shape: "line", label: "Weight W", note: "Constant downward force (m·g)" },
          { color: PALETTE.gold, shape: "line", label: "Drag Force F_drag", note: "Quadratic atmospheric drag (−k|v|v)" },
          { color: PALETTE.emerald, shape: "line", label: "Resultant Force F_net", note: "Vector sum (W + F_drag)" },
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 7 · Two-source wave interference ════════════════════════════════

const FIELD_HALF_X = 6;
const FIELD_NEAR_Z = -4.2;
const FIELD_FAR_Z = 6;
const FIELD_SEGMENTS = 60;
const SCREEN_CELLS = 61;
/** Where the screen strip is drawn — and so the distance the paths must use. */
const SCREEN_Z = FIELD_FAR_Z + 0.5;

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

/**
 * Time-averaged intensity along the screen. Summing the complex phasors and
 * squaring is what produces fringes; summing the instantaneous heights would
 * just show the wave sloshing.
 */
function screenIntensity(sources, wavelength, amplitude) {
  const k = (Math.PI * 2) / wavelength;
  const cells = [];
  let peak = 1e-9;
  for (let c = 0; c < SCREEN_CELLS; c += 1) {
    const x = -FIELD_HALF_X + (2 * FIELD_HALF_X * c) / (SCREEN_CELLS - 1);
    let re = 0;
    let im = 0;
    for (let s = 0; s < sources.length; s += 1) {
      const r = Math.max(Math.hypot(x - sources[s], SCREEN_Z - FIELD_NEAR_Z), 0.35);
      const a = amplitude / Math.sqrt(r);
      re += a * Math.cos(k * r);
      im += a * Math.sin(k * r);
    }
    const intensity = re * re + im * im;
    peak = Math.max(peak, intensity);
    cells.push({ x, intensity });
  }
  return cells.map((c) => ({ ...c, level: c.intensity / peak }));
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

  const L = SCREEN_Z - FIELD_NEAR_Z;
  // Young's λL/d is a small-angle approximation, and at the separations this
  // scene allows the angles are not small — so the exact first-order position
  // from d sin θ = mλ is shown beside it. Printing only the approximation put
  // a number on screen that visibly disagreed with the fringes next to it.
  const ratio = wavelength / separation;
  const fringeSpacing = slits === 2 ? wavelength * L / separation : null;
  const firstOrderX = slits === 2 && ratio <= 1 ? L * Math.tan(Math.asin(ratio)) : null;
  const approxError = firstOrderX ? Math.abs(fringeSpacing - firstOrderX) / firstOrderX : 0;
  const highestOrder = slits === 2 ? Math.floor(separation / wavelength) : 0;

  return (
    <SceneCanvas camera={{ position: [0, 8.5, 11.5], fov: 46 }} controls={{ autoRotate: spin, autoRotateSpeed: 0.45 * speed }}>
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

      {showScreen &&
        cells.map((cell, i) => (
          <mesh key={i} position={[cell.x, 0.5, SCREEN_Z]}>
            <boxGeometry args={[(2 * FIELD_HALF_X) / SCREEN_CELLS, 0.9, 0.12]} />
            <meshStandardMaterial
              color={PALETTE.gold}
              emissive={PALETTE.gold}
              emissiveIntensity={cell.level * 2.4}
              // Dark fringes must read as genuinely dark, so opacity tracks
              // intensity as well as glow.
              transparent
              opacity={0.22 + cell.level * 0.78}
              toneMapped={false}
            />
          </mesh>
        ))}

      <SceneLabel position={[0, 1.4, FIELD_NEAR_Z - 0.7]} accent>
        {slits === 1 ? "single source" : `two sources · d = ${separation.toFixed(1)}`}
      </SceneLabel>
      {showScreen && (
        <SceneLabel position={[0, 1.4, SCREEN_Z]} tone="text-ink-400">
          screen
        </SceneLabel>
      )}

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Interference"
        subtitle={slits === 2 ? "path difference decides it" : "one source — no fringes"}
        rows={[
          ["Sources", slits],
          ["Wavelength λ", wavelength.toFixed(2)],
          ["Separation d", slits === 2 ? separation.toFixed(2) : "—"],
          ["Screen distance L", L.toFixed(1)],
          ["1st max at x", firstOrderX ? firstOrderX.toFixed(2) : "—", "gold"],
          ["…from d sin θ = λ", firstOrderX ? `${((Math.asin(ratio) * 180) / Math.PI).toFixed(0)}°` : "—"],
          ["λL ÷ d estimate", fringeSpacing ? fringeSpacing.toFixed(2) : "—", approxError > 0.1 ? "warn" : undefined],
          ["Highest order m", slits === 2 ? highestOrder : "—"],
          ["d ÷ λ", slits === 2 ? (separation / wavelength).toFixed(2) : "—"],
        ]}
        note={
          slits === 1
            ? "One source spreads out as circular wavefronts and the screen is simply brightest opposite it. Switch to two sources to get fringes."
            : approxError > 0.1
              ? `Where the path difference is a whole number of wavelengths the crests reinforce; a half-odd number cancels. Note λL÷d is ${(approxError * 100).toFixed(0)}% out here — it assumes small angles, and with d only ${(separation / wavelength).toFixed(1)}λ wide the first order sits at ${((Math.asin(ratio) * 180) / Math.PI).toFixed(0)}°. Narrow λ or widen d to bring the two into line.`
              : "Where the path difference is a whole number of wavelengths the crests arrive together and reinforce — a bright fringe. Where it is a half-odd number they cancel. Widening d packs the fringes closer; a longer λ spreads them out."
        }
        noteTone={slits === 2 && approxError > 0.1 ? "warn" : "neutral"}
      />

      <SceneLegend
        title="Wave field"
        items={[
          { color: PALETTE.gold, shape: "square", label: "Crest", note: "displacement upward" },
          { color: PALETTE.violet, shape: "square", label: "Trough", note: "displacement downward" },
          { color: PALETTE.gold, label: "Source", note: "coherent — same λ and phase" },
          { color: "#39424f", shape: "square", label: "Barrier", note: "the slits are the gaps in it" },
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 8 · Gravity wells & orbital motion ══════════════════════════════

const WELL_HALF = 7;
const WELL_SEGMENTS = 64;
const ORBIT_TRAIL_MAX = 1400;
/** Gravitational constant in scene units — chosen so a 1.0 mass looks right. */
const G_SCENE = 6;

/** Rubber-sheet analogy: depth ∝ −μ/r, floored so the singularity is finite. */
function wellDepth(r, mu) {
  return -mu / Math.max(r, 0.9) + mu / WELL_HALF;
}

function GravityWell({ mass }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(WELL_HALF * 2, WELL_HALF * 2, WELL_SEGMENTS, WELL_SEGMENTS);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Depth is the only thing the mass changes, so the vertices are rewritten
  // in place rather than rebuilding the whole grid.
  useEffect(() => {
    const mu = G_SCENE * mass;
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      pos.setY(i, clamp(wellDepth(r, mu), -9, 0));
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }, [geometry, mass]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial wireframe color={PALETTE.sky} transparent opacity={0.2} />
    </mesh>
  );
}

/**
 * Leapfrog (kick–drift–kick) integration. A naive Euler step bleeds energy
 * every orbit and the ellipse visibly spirals in — leapfrog is symplectic, so
 * a closed orbit stays closed for as long as you leave it running.
 */
function Satellite({ mass, launchRadius, launchSpeed, running, resetKey, showTrail, onSample, speed = 1 }) {
  const body = useRef(null);
  const trailLine = useRef(null);
  const trailGeo = useRef(null);
  const trail = useMemo(() => new Float32Array(ORBIT_TRAIL_MAX * 3), []);
  const state = useRef({ x: 0, z: 0, vx: 0, vz: 0, count: 0, sampleAcc: 0, escaped: false });

  const mu = G_SCENE * mass;

  useEffect(() => {
    state.current = {
      x: launchRadius,
      z: 0,
      vx: 0,
      vz: launchSpeed,
      count: 0,
      sampleAcc: 0,
      escaped: false,
    };
  }, [launchRadius, launchSpeed, mass, resetKey]);

  useFrame((_, delta) => {
    const s = state.current;
    const step = Math.min(delta, 0.033) * speed;

    if (running && !s.escaped) {
      const substeps = 4;
      const h = step / substeps;
      for (let n = 0; n < substeps; n += 1) {
        let r = Math.max(Math.hypot(s.x, s.z), 0.55);
        let a = -mu / (r * r * r);
        s.vx += 0.5 * h * a * s.x;
        s.vz += 0.5 * h * a * s.z;
        s.x += h * s.vx;
        s.z += h * s.vz;
        r = Math.max(Math.hypot(s.x, s.z), 0.55);
        a = -mu / (r * r * r);
        s.vx += 0.5 * h * a * s.x;
        s.vz += 0.5 * h * a * s.z;
      }
      // Classify by energy, never by distance. A bound ellipse with a wide
      // apoapsis leaves the sheet and comes back; freezing it as "escaped"
      // then printed "total energy is non-negative" over a plainly negative
      // energy. Only an unbound orbit that has genuinely left is stopped.
      const far = Math.hypot(s.x, s.z);
      const rNow = Math.max(far, 0.55);
      const specificEnergy = (s.vx * s.vx + s.vz * s.vz) / 2 - mu / rNow;
      if (specificEnergy >= 0 && far > WELL_HALF * 1.6) s.escaped = true;

      const r = Math.hypot(s.x, s.z);
      // Once full the trail slides back by one point rather than wrapping:
      // a wrapping buffer is drawn in index order, so the seam joined the
      // newest point to the oldest with a chord straight across the orbit.
      if (s.count >= ORBIT_TRAIL_MAX) trail.copyWithin(0, 3);
      else s.count += 1;
      const o = (s.count - 1) * 3;
      trail[o] = s.x;
      trail[o + 1] = clamp(wellDepth(r, mu), -9, 0) + 0.12;
      trail[o + 2] = s.z;
    }

    const r = Math.max(Math.hypot(s.x, s.z), 0.001);
    if (body.current) body.current.position.set(s.x, clamp(wellDepth(r, mu), -9, 0) + 0.22, s.z);
    if (trailGeo.current) {
      trailGeo.current.setDrawRange(0, s.count);
      trailGeo.current.attributes.position.needsUpdate = true;
      if (trailLine.current) trailLine.current.visible = showTrail && s.count > 1;
    }

    s.sampleAcc += step;
    if (s.sampleAcc >= 0.15) {
      s.sampleAcc = 0;
      const v = Math.hypot(s.vx, s.vz);
      const energy = (v * v) / 2 - mu / r;
      // Specific angular momentum in the orbital plane; with the eccentricity
      // formula it classifies the conic without having to fit the path.
      const L = s.x * s.vz - s.z * s.vx;
      const e = Math.sqrt(Math.max(0, 1 + (2 * energy * L * L) / (mu * mu)));
      const a = energy < 0 ? -mu / (2 * energy) : null;
      onSample({
        r,
        v,
        energy,
        e,
        period: a ? 2 * Math.PI * Math.sqrt((a * a * a) / mu) : null,
        escaped: s.escaped,
        // Bound but off the edge of the sheet — worth saying, because the
        // satellite simply vanishes from view until it swings back.
        beyondView: energy < 0 && r > WELL_HALF,
      });
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
    </group>
  );
}

export function OrbitScene({ params = {} }) {
  const {
    mass = 1,
    launchRadius = 3.4,
    launchSpeed = 1.35,
    speed = 1.0,
    running = true,
    reset = 0,
    showTrail = true,
    showWell = true,
    spin = false,
  } = params || {};

  const mu = G_SCENE * mass;
  // The speed that would make this exact radius a circle — the reference the
  // launch slider is really being compared against.
  const circular = Math.sqrt(mu / launchRadius);
  const escapeSpeed = Math.sqrt((2 * mu) / launchRadius);

  // Seeded from the launch conditions rather than zero, so the panel does not
  // read "hyperbolic" for the first fraction of a second of every orbit.
  const [live, setLive] = useState(() => ({
    r: launchRadius,
    v: launchSpeed,
    energy: (launchSpeed * launchSpeed) / 2 - mu / launchRadius,
    e: 0,
    period: null,
    escaped: false,
    beyondView: false,
  }));

  const unbound = live.energy >= 0;
  const shape = unbound
    ? live.e > 1.02
      ? "hyperbolic"
      : "escape"
    : live.e < 0.04
      ? "circular"
      : "elliptical";

  return (
    <SceneCanvas camera={{ position: [0, 9.5, 11], fov: 46 }} controls={{ autoRotate: spin, autoRotateSpeed: 0.45 * speed }}>
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
        launchSpeed={launchSpeed}
        running={running}
        resetKey={reset}
        showTrail={showTrail}
        onSample={setLive}
        speed={speed}
      />

      <SceneLabel position={[0, 1.5, 0]} accent>
        μ = GM = {mu.toFixed(1)}
      </SceneLabel>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Orbit"
        subtitle="v² = GM (2÷r − 1÷a)"
        rows={[
          ["Radius r", live.r.toFixed(2)],
          ["Speed v", live.v.toFixed(2), "gold"],
          ["Circular v at r₀", circular.toFixed(2)],
          ["Escape v at r₀", escapeSpeed.toFixed(2)],
          ["Eccentricity e", live.e.toFixed(3)],
          ["Energy ε", live.energy.toFixed(2), unbound ? "bad" : "good"],
          ["Period T", live.period ? live.period.toFixed(1) : "—"],
          ["Orbit", shape, shape === "circular" ? "good" : unbound ? "bad" : "warn"],
          ...(live.beyondView ? [["Note", "past the sheet edge", "warn"]] : []),
        ]}
        note={
          unbound
            ? "Total energy is non-negative, so the orbit is unbound — the satellite is on an escape trajectory and will not come back."
            : live.beyondView
              ? `Still bound — energy is negative, so this is a closed ellipse. It has just swung out past the edge of the sheet and will fall back in. Period is ${live.period ? live.period.toFixed(0) : "—"}.`
              : shape === "circular"
                ? "Launch speed matches the circular value at this radius, so gravity supplies exactly the centripetal force needed and r never changes."
                : `Elliptical: ${launchSpeed < circular ? "too slow" : "too fast"} for a circle here, so the satellite ${launchSpeed < circular ? "falls inward, speeds up, and swings back out" : "climbs away, slows down, and falls back"}. Match the circular speed of ${circular.toFixed(2)} to round it off.`
        }
        noteTone={unbound ? "bad" : live.beyondView ? "warn" : shape === "circular" ? "good" : "neutral"}
      />

      <SceneLegend
        title="Gravity well"
        items={[
          { color: PALETTE.gold, label: "Central mass", note: "depth of the well ∝ its mass" },
          { color: PALETTE.emerald, label: "Satellite", note: "in free fall the whole time" },
          { color: PALETTE.emerald, shape: "line", label: "Path", note: "an ellipse when bound" },
          { color: PALETTE.sky, shape: "line", label: "Potential", note: "the sheet is −GM ÷ r, not real space" },
        ]}
      />
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
