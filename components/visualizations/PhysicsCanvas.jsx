"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  AtomSphere,
  Bond,
  DEG,
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
  const critical = n1 > n2 ? Math.asin(n2 / n1) / DEG : null;
  const lateral = tir ? 0 : (thickness * Math.sin(i - r)) / Math.cos(r);
  const run = tir ? 0 : thickness * Math.tan(r); // sideways travel inside
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
function PhotonPulse({ path, speeds, color, running }) {
  const mesh = useRef(null);
  const light = useRef(null);
  const progress = useRef(0);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  const points = useMemo(() => path.map((p) => new THREE.Vector3(...p)), [path]);
  const legs = points.length - 1;

  useFrame((_, delta) => {
    if (!mesh.current || legs < 1) return;
    const step = Math.min(delta, 0.05);
    if (running) {
      const leg = Math.min(legs - 1, Math.floor(progress.current));
      progress.current = (progress.current + step * (speeds[leg] ?? 1)) % legs;
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

export function RefractionScene({ params }) {
  const {
    angle,
    n1,
    n2,
    thickness,
    wavelength,
    medium1,
    medium2,
    showReflection,
    showLabels,
    animate,
  } = params;

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

  return (
    <SceneCanvas camera={{ position: [1.5, 1.5, 13], fov: 45 }} fog={[22, 44]}>
     <group scale={fit}>
      {/* ── Medium 1: everything outside the block ───────────────── */}
      <mesh position={[0, halfT + 5, 0]} renderOrder={-3}>
        <boxGeometry args={[halfW * 2 + 8, 10, 9]} />
        <meshStandardMaterial
          color={outerColour}
          transparent
          opacity={clamp((n1 - 1) * 0.16, 0.012, 0.24)}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -halfT - 5, 0]} renderOrder={-3}>
        <boxGeometry args={[halfW * 2 + 8, 10, 9]} />
        <meshStandardMaterial
          color={outerColour}
          transparent
          opacity={clamp((n1 - 1) * 0.16, 0.012, 0.24)}
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
          opacity={clamp(0.1 + (n2 - 1) * 0.2, 0.06, 0.5)}
          roughness={0.05}
          metalness={0.05}
          emissive={blockColour}
          emissiveIntensity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Hard edges — the single clearest cue that this is a solid block. */}
      <lineSegments renderOrder={-1}>
        <edgesGeometry args={[new THREE.BoxGeometry(halfW * 2, thickness, 6)]} />
        <lineBasicMaterial color={blockColour} transparent opacity={0.85} />
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
          lineWidth={2.4}
          transparent
          opacity={0.9}
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

      <PhotonPulse path={photonPath} speeds={photonSpeeds} color={beam} running={animate} />

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

function MagnetPole({ position, pole }) {
  const isNorth = pole === "N";
  const color = isNorth ? PALETTE.rose : PALETTE.sky;
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.1, 2.6, 2.6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.45}
          metalness={0.3}
        />
      </mesh>
      <SceneLabel position={[0, 1.75, 0]} tone={isNorth ? "text-rose-300" : "text-sky-300"}>
        {isNorth ? "N pole" : "S pole"}
      </SceneLabel>
    </group>
  );
}

const SKIN = "#c08a6a";
const SKIN_DEEP = "#a8724f";
const UP_AXIS = new THREE.Vector3(0, 1, 0);

/** Blend a digit's tip toward the colour of the vector leaving that fingertip. */
function tintTip(hex, amount) {
  return `#${new THREE.Color(SKIN)
    .lerp(new THREE.Color(hex), amount)
    .getHexString()}`;
}

/** One bone: a cone-frustum, so fingers taper the way real ones do. */
function Phalanx({ from, to, rFrom, rTo, color }) {
  const placement = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = delta.length();
    if (length < 1e-5) return null;
    return {
      position: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        UP_AXIS,
        delta.clone().normalize(),
      ),
      length,
    };
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);

  if (!placement) return null;

  return (
    <mesh position={placement.position} quaternion={placement.quaternion}>
      {/* args are [radiusTop, radiusBottom, …] and +Y points at `to`. */}
      <cylinderGeometry args={[rTo, rFrom, placement.length, 16]} />
      <meshStandardMaterial color={color} roughness={0.72} metalness={0.02} />
    </mesh>
  );
}

/**
 * A finger as a chain of tapering bones with knuckles at the joints. The
 * knuckle spheres match the local bone radius, so they read as joints rather
 * than as beads on a stick.
 */
function Finger({ joints, radii, tipColor }) {
  const last = joints.length - 1;
  return (
    <group>
      {joints.slice(0, -1).map((p, i) => (
        <Phalanx
          key={`p${i}`}
          from={p}
          to={joints[i + 1]}
          rFrom={radii[i]}
          rTo={radii[i + 1]}
          color={i === last - 1 && tipColor ? tintTip(tipColor, 0.5) : SKIN}
        />
      ))}
      {joints.map((p, i) => (
        <mesh key={`j${i}`} position={p}>
          <sphereGeometry args={[radii[i] * 0.99, 16, 16]} />
          <meshStandardMaterial
            color={i === last && tipColor ? tintTip(tipColor, 0.62) : SKIN}
            emissive={i === last && tipColor ? tipColor : "#000000"}
            emissiveIntensity={i === last && tipColor ? 0.5 : 0}
            roughness={0.72}
            metalness={0.02}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The left hand in the Fleming pose — the centrepiece of this scene, not a
 * prop beside it.
 *
 * Built in a local frame where +X is the first finger (Field), +Z the second
 * finger (Current) and +Y the thumb (Force): the three axes the rule names,
 * held mutually perpendicular. Knuckles sit on an arc and the fingers taper
 * over three phalanges; only the fingertips are tinted, so the hand reads as
 * a hand while still mapping onto the three vectors leaving it.
 *
 * Reversing the current or the field turns the pose by a half turn rather
 * than mirroring it, because F = I L × B forces fSign = iSign · bSign — the
 * product of the three signs is always +1, so this stays a *left* hand in
 * all four combinations. That invariant is the rule, geometrically.
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
      {/* Palm — rounded, and slightly domed on the back. */}
      <RoundedBox args={[1.62, 0.48, 1.38]} radius={0.17} smoothness={4} position={[-0.6, 0, 0.06]}>
        <meshStandardMaterial color={SKIN} roughness={0.74} metalness={0.02} />
      </RoundedBox>

      {/* Thenar eminence — the muscle pad at the base of the thumb. */}
      <mesh position={[-0.72, 0.02, -0.36]} scale={[0.62, 0.34, 0.34]}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial color={SKIN} roughness={0.76} metalness={0.02} />
      </mesh>

      {/* Wrist and a stub of forearm, so the hand is attached to something. */}
      <RoundedBox args={[0.5, 0.42, 0.98]} radius={0.15} smoothness={4} position={[-1.6, 0, 0.06]}>
        <meshStandardMaterial color={SKIN_DEEP} roughness={0.76} metalness={0.02} />
      </RoundedBox>
      <mesh position={[-2.25, 0, 0.06]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.46, 0.95, 20]} />
        <meshStandardMaterial color={SKIN_DEEP} roughness={0.78} metalness={0.02} />
      </mesh>

      {/* Finger lengths are held to real hand ratios against palm length —
          index 0.72, middle 0.80, ring 0.74, little 0.58, thumb 0.62. Getting
          these wrong is what makes a modelled hand look spidery. */}

      {/* First finger — Field. Three phalanges straight out along +X. */}
      <Finger
        joints={[
          [0.22, 0.02, -0.4],
          [0.745, 0.03, -0.4],
          [1.106, 0.01, -0.4],
          [1.386, -0.01, -0.4],
        ]}
        radii={[0.135, 0.12, 0.105, 0.088]}
        tipColor={PALETTE.sky}
      />

      {/* Second finger — Current. Bent 90° at the knuckle to run along +Z. */}
      <Finger
        joints={[
          [0.24, 0.02, -0.06],
          [0.3, 0.0, 0.3],
          [0.32, -0.01, 0.72],
          [0.32, -0.02, 1.02],
          [0.32, -0.03, 1.222],
        ]}
        radii={[0.14, 0.128, 0.115, 0.1, 0.085]}
        tipColor={PALETTE.gold}
      />

      {/* Ring and little curled into the palm — proximal phalanx forward and
          down, then the rest tucking back toward the palm. */}
      <Finger
        joints={[
          [0.21, 0.0, 0.28],
          [0.55, -0.25, 0.28],
          [0.48, -0.68, 0.28],
          [0.17, -0.79, 0.28],
        ]}
        radii={[0.128, 0.115, 0.098, 0.082]}
      />
      <Finger
        joints={[
          [0.16, -0.01, 0.58],
          [0.46, -0.22, 0.58],
          [0.4, -0.56, 0.58],
          [0.17, -0.63, 0.58],
        ]}
        radii={[0.112, 0.1, 0.086, 0.072]}
      />

      {/* Thumb — Force. Two phalanges rising from the thenar pad. */}
      <Finger
        joints={[
          [-0.74, 0.1, -0.46],
          [-0.71, 0.65, -0.5],
          [-0.7, 1.1, -0.53],
        ]}
        radii={[0.165, 0.14, 0.115]}
        tipColor={PALETTE.emerald}
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
      // Fade in and out at the ends so pulses don't pop into existence.
      mesh.scale.setScalar(0.2 + Math.sin(t * Math.PI) * 0.8);
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
          <sphereGeometry args={[size, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * The conductor actually being pushed. A wire segment lying along the current
 * direction, sliding along the force direction with ghosted copies trailing
 * behind it — the "way of motion" the thumb is predicting.
 */
function MovingConductor({ start, wireDir, moveDir, travel, speed, running }) {
  const refs = useRef([]);
  const phase = useRef(0);
  const GHOSTS = [
    { lag: 0, opacity: 1 },
    { lag: 0.08, opacity: 0.34 },
    { lag: 0.16, opacity: 0.2 },
    { lag: 0.24, opacity: 0.1 },
  ];

  const quaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(...wireDir).normalize(),
      ),
    [wireDir[0], wireDir[1], wireDir[2]],
  );

  useFrame((_, delta) => {
    if (running) phase.current = (phase.current + Math.min(delta, 0.05) * speed) % 1;
    GHOSTS.forEach((ghost, g) => {
      const mesh = refs.current[g];
      if (!mesh) return;
      const t = phase.current - ghost.lag;
      // The wire itself is always there; only its motion trail comes and goes,
      // so a stationary conductor still shows as a conductor.
      mesh.visible = g === 0 || t > 0;
      const d = Math.max(0, t) * travel;
      mesh.position.set(
        start[0] + moveDir[0] * d,
        start[1] + moveDir[1] * d,
        start[2] + moveDir[2] * d,
      );
    });
  });

  return (
    <>
      {GHOSTS.map((ghost, g) => (
        <mesh
          key={g}
          ref={(el) => {
            refs.current[g] = el;
          }}
          quaternion={quaternion}
        >
          <cylinderGeometry args={[0.13, 0.13, 2.6, 16]} />
          <meshStandardMaterial
            color="#b45309"
            emissive={PALETTE.gold}
            emissiveIntensity={g === 0 ? 0.9 : 0.4}
            transparent={ghost.opacity < 1}
            opacity={ghost.opacity}
            roughness={0.35}
            metalness={0.6}
          />
        </mesh>
      ))}
    </>
  );
}

/** Flat pole plate at the end of the field axis. */
function PolePlate({ position, pole }) {
  const isNorth = pole === "N";
  const color = isNorth ? PALETTE.rose : PALETTE.sky;
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.55, 3.4, 3.4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.45}
          metalness={0.35}
        />
      </mesh>
      <SceneLabel
        position={[0, 2.3, 0]}
        tone={isNorth ? "text-rose-300" : "text-sky-300"}
      >
        {isNorth ? "N pole" : "S pole"}
      </SceneLabel>
    </group>
  );
}

// The conductor is taken to be one metre of wire inside the field, so the
// numbers in the readout are a real F = BIL and not I × B with a silent unit.
const WIRE_LENGTH = 1;

export function MotorEffectScene({ params }) {
  const { current, field, reverseCurrent, reverseField, showFieldLines, animate } = params;

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

  // Each vector leaves just beyond its fingertip, on the same line as the
  // finger (hand local coords × the 1.15 hand scale), so it reads as that
  // finger continuing outward rather than as a separate arrow nearby.
  const fieldStart = [bSign * 2.05, -0.01, -0.46];
  const currentStart = [0.37, -0.03, iSign * 1.95];
  const forceStart = [-0.8, fSign * 1.7, -0.61];

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
        speed={0.22 + field * 0.34}
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
        speed={0.24 + current * 0.42}
        count={5}
        running={animate}
      />

      {/* ── Force: thumb, plus the conductor it pushes ───────────── */}
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
            speed={0.2 + force * 0.4}
            count={3}
            running={animate}
          />
          <MovingConductor
            start={[2.6, fSign * 1.2, 0]}
            wireDir={currentDir}
            moveDir={forceDir}
            travel={2.8}
            speed={0.22 + force * 0.3}
            running={animate}
          />
          <SceneLabel position={[2.6, fSign * 4.6, 0]} tone="text-emerald-300">
            the wire moves this way
          </SceneLabel>
        </>
      ) : (
        <>
          <MovingConductor
            start={[2.6, 0, 0]}
            wireDir={currentDir}
            moveDir={forceDir}
            travel={0}
            speed={0}
            running={false}
          />
          <SceneLabel position={[2.6, 1.6, 0]} tone="text-rose-300">
            I = 0 A · no current, no force, no motion
          </SceneLabel>
        </>
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
                speed={0.1 + field * 0.16}
                count={3}
                size={0.09}
                running={animate}
              />
            </group>
          ))}
        </>
      )}

      <SceneReadout
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
// ═══ 3 · Ray optics — convex & concave lenses ════════════════════════

function lensProfile(type, radius, thickness, segments = 26) {
  const pts = [];
  if (type === "convex") {
    for (let i = 0; i <= segments; i += 1) {
      const t = (i / segments) * Math.PI;
      pts.push(new THREE.Vector2(radius * Math.sin(t), thickness * Math.cos(t)));
    }
  } else {
    // Thin at the axis, thick at the rim.
    const centre = thickness * 0.2;
    for (let i = 0; i <= segments; i += 1) {
      const u = i / segments;
      pts.push(new THREE.Vector2(radius * u, centre + (thickness - centre) * u * u));
    }
    for (let i = segments; i >= 0; i -= 1) {
      const u = i / segments;
      pts.push(new THREE.Vector2(radius * u, -(centre + (thickness - centre) * u * u)));
    }
  }
  return pts;
}

function Lens({ type }) {
  const geometry = useMemo(() => {
    const profile = lensProfile(type, 1.65, 0.42);
    const geo = new THREE.LatheGeometry(profile, 48);
    geo.computeVertexNormals();
    return geo;
  }, [type]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    // The lathe spins about Y; a quarter turn puts its axis on the optical axis.
    <mesh geometry={geometry} rotation={[0, 0, -Math.PI / 2]}>
      <meshStandardMaterial
        color={PALETTE.sky}
        transparent
        opacity={0.26}
        roughness={0.05}
        metalness={0.1}
        emissive={PALETTE.sky}
        emissiveIntensity={0.22}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function LensOpticsScene({ params }) {
  const { lensType, focal, objectDistance, showConstruction } = params;

  const isConvex = lensType === "convex";
  const f = isConvex ? focal : -focal;
  const u = objectDistance;
  const h = 1.15;

  // Thin-lens equation, real-is-positive: 1/v = 1/f − 1/u.
  const invV = 1 / f - 1 / u;
  const atInfinity = Math.abs(invV) < 0.035;
  // v and m are the physics; they are reported as they come out of the
  // equation. Only the *drawing* is bounded — clamping v and then printing
  // the clamped number, as this used to, quietly reports a wrong image
  // distance for every object just outside the focal point.
  const v = atInfinity ? Infinity : 1 / invV;
  const magnification = atInfinity ? Infinity : Math.abs(v / u);
  const imageHeight = atInfinity ? 0 : -h * (v / u);
  const real = !atInfinity && v > 0;

  const objectTop = [-u, h, 0];

  // Everything is drawn at true scale, then the whole diagram is scaled to
  // fit the viewport — so pushing the object toward F walks the image out to
  // the edge of the frame instead of off the side of it.
  const span = atInfinity ? u + 2 * focal : Math.max(u, Math.abs(v), 2 * focal);
  const fit = clamp(9.5 / (span + 2.4), 0.22, 1);
  // Rays must outrun the image, or a distant real image sits past their ends.
  const FAR = span + 3;

  // Ray 1: parallel in, then along the line through the focal point.
  const hitParallel = [0, h, 0];
  const dirParallel = useMemo(() => {
    const d = new THREE.Vector3(f - 0, 0 - h, 0);
    if (f < 0) d.negate();
    return d.normalize();
  }, [f, h]);
  const parallelEnd = [
    hitParallel[0] + dirParallel.x * FAR,
    hitParallel[1] + dirParallel.y * FAR,
    0,
  ];

  // Ray 2: straight through the optical centre, undeviated.
  const dirCentre = useMemo(
    () => new THREE.Vector3(u, -h, 0).normalize(),
    [u, h],
  );
  const centreEnd = [dirCentre.x * FAR, dirCentre.y * FAR, 0];

  // Ray 3: the one aimed at the focal point, which emerges parallel to the
  // axis. Solving the line through the object tip and (f, 0) at the lens
  // plane gives the height it leaves at — and that height is exactly the
  // image height, which is the whole reason the construction works.
  const focalRayHeight = atInfinity ? 0 : (-h * f) / (u - f);
  const showThirdRay = !atInfinity && Math.abs(u - f) > 1e-3;

  const nature = atInfinity
    ? "No image — the rays leave parallel"
    : `${real ? "Real" : "Virtual"}, ${imageHeight < 0 ? "inverted" : "upright"}, ${
        magnification > 1.02 ? "magnified" : magnification < 0.98 ? "diminished" : "same size"
      }`;

  return (
    <SceneCanvas camera={{ position: [0.5, 3.5, 12], fov: 45 }}>
     <group scale={fit}>
      {/* Principal axis and the lens plane. */}
      <Line
        points={[
          [-(span + 2), 0, 0],
          [span + 2, 0, 0],
        ]}
        color={PALETTE.line}
        lineWidth={1.4}
      />
      <Line
        points={[
          [0, -2.6, 0],
          [0, 2.6, 0],
        ]}
        color="#5b6472"
        lineWidth={1}
        dashed
        dashSize={0.2}
        gapSize={0.16}
      />
      <Lens type={lensType} />

      {/* Focal and 2F markers. */}
      {[-2, -1, 1, 2].map((k) => (
        <group key={k} position={[k * focal, 0, 0]}>
          <AtomSphere
            position={[0, 0, 0]}
            radius={0.09}
            color={Math.abs(k) === 1 ? PALETTE.gold : "#5b6472"}
            emissiveIntensity={1.2}
          />
          <SceneLabel position={[0, -0.45, 0]} tone="text-ink-500">
            {Math.abs(k) === 1 ? "F" : "2F"}
          </SceneLabel>
        </group>
      ))}

      {/* Object. */}
      <VectorArrow
        from={[-u, 0, 0]}
        to={objectTop}
        color={PALETTE.gold}
        label="object"
        labelOffset={0.3}
      />

      {/* Ray 1 — parallel to the axis, then refracted. */}
      <Line points={[objectTop, hitParallel]} color={PALETTE.emerald} lineWidth={2.2} />
      <Line points={[hitParallel, parallelEnd]} color={PALETTE.emerald} lineWidth={2.2} />

      {/* Ray 2 — through the optical centre. */}
      <Line points={[objectTop, centreEnd]} color={PALETTE.violet} lineWidth={2.2} />

      {/* Ray 3 — aimed at F, emerges parallel to the axis. */}
      {showConstruction && showThirdRay && (
        <>
          <Line
            points={[objectTop, [0, focalRayHeight, 0]]}
            color={PALETTE.sky}
            lineWidth={2}
          />
          <Line
            points={[
              [0, focalRayHeight, 0],
              [FAR, focalRayHeight, 0],
            ]}
            color={PALETTE.sky}
            lineWidth={2}
          />
        </>
      )}

      {/* A real image can be caught on a screen — so show the screen. */}
      {real && (
        <group position={[v, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.09, Math.max(2.4, Math.abs(imageHeight) * 2.4), 2.6]} />
            <meshStandardMaterial
              color={PALETTE.bone}
              transparent
              opacity={0.13}
              roughness={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
          <SceneLabel position={[0, -Math.max(1.4, Math.abs(imageHeight) * 1.4) - 0.4, 0]} tone="text-ink-400">
            screen
          </SceneLabel>
        </group>
      )}

      {/* Back-extensions: how a virtual image is located. */}
      {showConstruction && !real && !atInfinity && (
        <>
          <Line
            points={[hitParallel, [v, imageHeight, 0]]}
            color={PALETTE.emerald}
            lineWidth={1.4}
            transparent
            opacity={0.5}
            dashed
            dashSize={0.22}
            gapSize={0.18}
          />
          <Line
            points={[
              [0, 0, 0],
              [v, imageHeight, 0],
            ]}
            color={PALETTE.violet}
            lineWidth={1.4}
            transparent
            opacity={0.5}
            dashed
            dashSize={0.22}
            gapSize={0.18}
          />
        </>
      )}

      {/* Image. */}
      {!atInfinity && (
        <VectorArrow
          from={[v, 0, 0]}
          to={[v, imageHeight, 0]}
          color={real ? PALETTE.emerald : PALETTE.violet}
          opacity={real ? 1 : 0.55}
          label={real ? "real image" : "virtual image"}
          labelOffset={imageHeight < 0 ? -0.32 : 0.32}
        />
      )}

      <SceneReadout
        title={isConvex ? "Converging lens" : "Diverging lens"}
        subtitle="1/v = 1/f − 1/u  ·  m = |v ÷ u|"
        rows={[
          ["Object u", `${u.toFixed(1)} cm`],
          ["Focal length f", `${f.toFixed(1)} cm`, "gold"],
          ["Image v", atInfinity ? "∞" : `${v.toFixed(1)} cm`, real ? "good" : "bad"],
          ["Magnification m", atInfinity ? "∞" : `${magnification.toFixed(2)}×`],
          ["Nature", real ? "real" : atInfinity ? "none" : "virtual", real ? "good" : "bad"],
          ["Orientation", atInfinity ? "—" : imageHeight < 0 ? "inverted" : "upright"],
          ["u compared with f", u > 2 * focal ? "beyond 2F" : u > focal ? "between F and 2F" : "inside F"],
        ]}
        note={
          atInfinity
            ? "The object is at the focal point, so the refracted rays leave exactly parallel. They never meet — this is the collimator arrangement used in a spotlight."
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
            note: "an upright arrow of fixed height",
          },
          {
            color: PALETTE.emerald,
            shape: "line",
            label: "Ray 1 — parallel in",
            note: isConvex ? "refracts through F" : "refracts as if from F",
          },
          {
            color: PALETTE.violet,
            shape: "line",
            label: "Ray 2 — through the centre",
            note: "passes straight on, undeviated",
          },
          {
            color: PALETTE.sky,
            shape: "line",
            label: "Ray 3 — aimed at F",
            note: showConstruction ? "emerges parallel to the axis" : "turn on construction rays",
          },
          {
            color: real ? PALETTE.emerald : PALETTE.violet,
            label: real ? "Real image" : "Virtual image",
            note: real
              ? "rays truly meet — it can be caught on a screen"
              : "only the dashed back-extensions meet",
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

function RotatingCoil({ speed, field, turns, showCurrent, angleRef, onSample }) {
  const coil = useRef(null);
  const needle = useRef(null);
  const sampleClock = useRef(0);

  const w = COIL_W;
  const hh = COIL_H;

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    const omega = omegaOf(speed);
    angleRef.current += step * omega;

    const emf = emfAt(field, omega, angleRef.current, turns);

    if (coil.current) coil.current.rotation.y = angleRef.current;
    if (needle.current) needle.current.rotation.z = clamp(-emf * 0.05, -1.1, 1.1);

    // Throttled so the numeric readout does not re-render every frame.
    sampleClock.current += step;
    if (sampleClock.current > 0.1) {
      sampleClock.current = 0;
      onSample(emf, angleRef.current);
    }
  });

  const corners = [
    [-w, hh, 0],
    [w, hh, 0],
    [w, -hh, 0],
    [-w, -hh, 0],
  ];

  // Real generator coils are wound many times round the same former. Drawing
  // the turns as a stack makes N a thing you can count rather than a number
  // in a panel.
  const windings = Array.from({ length: turns }, (_, k) => (k - (turns - 1) / 2) * 0.13);

  return (
    <>
      <group ref={coil}>
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
              color="#b45309"
              emissive={PALETTE.gold}
            />
          )),
        )}

        {/* Leads down the axle to the two slip rings. */}
        <Bond from={[w, -hh, 0]} to={[0.16, -1.45, 0]} radius={0.045} color="#b45309" />
        <Bond from={[-w, -hh, 0]} to={[-0.16, -1.95, 0]} radius={0.045} color="#b45309" />
        <mesh position={[0, -1.7, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 1.5, 12]} />
          <meshStandardMaterial color="#5b6472" metalness={0.7} roughness={0.4} />
        </mesh>

        {/* Slip rings — continuous, which is exactly why the output stays
            alternating. A d.c. motor's split ring would flip it every half
            turn instead. */}
        {[-1.45, -1.95].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.24, 0.06, 10, 28]} />
            <meshStandardMaterial
              color="#cbd5e1"
              metalness={0.85}
              roughness={0.25}
              emissive={PALETTE.gold}
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

      {/* Carbon brushes stay still while the rings turn under them. */}
      {[
        { y: -1.45, x: 0.42 },
        { y: -1.95, x: -0.42 },
      ].map(({ y, x }) => (
        <group key={y}>
          <mesh position={[x, y, 0]}>
            <boxGeometry args={[0.22, 0.16, 0.3]} />
            <meshStandardMaterial color="#2a2f38" roughness={0.85} />
          </mesh>
          <Line
            points={[
              [x, y, 0],
              [x * 2.6, y, 0],
              [x * 2.6, -2.35, 0],
              [x * 1.4, -2.35, 0],
            ]}
            color={PALETTE.gold}
            lineWidth={1.6}
            transparent
            opacity={0.7}
          />
        </group>
      ))}
      <SceneLabel position={[1.55, -1.7, 0]} tone="text-ink-400">
        slip rings & brushes
      </SceneLabel>

      {/* Galvanometer. */}
      <group position={[0, -2.9, 0]}>
        <mesh>
          <boxGeometry args={[1.9, 1.1, 0.25]} />
          <meshStandardMaterial color="#14171c" roughness={0.6} metalness={0.3} />
        </mesh>
        <group ref={needle} position={[0, -0.35, 0.16]}>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[0.05, 0.72, 0.05]} />
            <meshStandardMaterial
              color={PALETTE.gold}
              emissive={PALETTE.gold}
              emissiveIntensity={1.6}
              toneMapped={false}
            />
          </mesh>
        </group>
        <SceneLabel position={[0, -0.85, 0]} tone="text-ink-500">
          galvanometer
        </SceneLabel>
      </group>
    </>
  );
}

/**
 * Live e.m.f.–time trace. A generator's whole point is that its output
 * *alternates*, and that is invisible in a single frozen frame — you can see
 * the needle twitch but not the shape it is tracing. The curve is the exact
 * ε = −ε₀ cos θ the coil is producing, drawn over two full turns, with a
 * marker riding the same angle the coil is at.
 */
const TRACE = { width: 5.6, height: 0.82, turns: 2 };

function EmfTrace({ speed, field, turns, angleRef }) {
  const marker = useRef(null);
  const omega = omegaOf(speed);
  const peak = peakEmf(field, omega, turns);

  // Height tracks ε₀ linearly — a weak field really should draw a shallow
  // wave — and is capped so the strongest setting still fits the frame.
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
    <group position={[0, -5.5, 0]}>
      {/* Zero line — the axis the output swings either side of. */}
      <Line
        points={[
          [-TRACE.width / 2 - 0.3, 0, 0],
          [TRACE.width / 2 + 0.3, 0, 0],
        ]}
        color={PALETTE.line}
        lineWidth={1.4}
      />
      {/* Half-turn gridlines: one whole cycle per revolution of the coil. */}
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
      <SceneLabel position={[0, -TRACE.height - 0.55, 0]} accent>
        induced e.m.f. against time · two full turns
      </SceneLabel>
    </group>
  );
}

export function InductionScene({ params }) {
  const { speed, field, turns, showFieldLines, showCurrent } = params;
  // Seeded from the equation rather than from zero: on the very first render
  // the coil is at θ = 0, which is peak e.m.f., and a panel reading "0.00 V"
  // beside a note saying "the e.m.f. is at its peak" reads as a broken model.
  const [sample, setSample] = useState(() => ({
    emf: emfAt(field, omegaOf(speed), 0, turns),
    angle: 0,
  }));
  // Shared between the coil (which advances it) and the trace (which reads
  // it), so the marker sits at the coil's true angle every frame rather than
  // stepping along at the 10 Hz the readout is throttled to.
  const angleRef = useRef(0);

  const fieldLines = useMemo(() => {
    const lines = [];
    for (let y = -1.2; y <= 1.21; y += 0.8) {
      for (let z = -1.2; z <= 1.21; z += 1.2) lines.push({ y, z });
    }
    return lines;
  }, []);

  const omega = omegaOf(speed);
  const flux = fluxAt(field, sample.angle);
  const peak = peakEmf(field, omega, turns);
  const direction =
    Math.abs(sample.emf) < 0.05 ? "none" : sample.emf > 0 ? "clockwise" : "anticlockwise";
  // |cos θ| is 1 when the coil lies edge-on to the field and is slicing
  // across the lines fastest — that is where the e.m.f. peaks.
  const cutting = Math.abs(Math.cos(sample.angle));

  return (
    <SceneCanvas
      camera={{ position: [6.5, 3.5, 12.5], fov: 45 }}
      controls={{ target: [0, -1.6, 0] }}
    >
      <MagnetPole position={[-3.4, 0, 0]} pole="N" />
      <MagnetPole position={[3.4, 0, 0]} pole="S" />

      {showFieldLines &&
        fieldLines.map(({ y, z }, i) => (
          <Line
            key={i}
            points={[
              [-2.8, y, z],
              [2.8, y, z],
            ]}
            color={PALETTE.sky}
            lineWidth={1}
            transparent
            opacity={0.14 + field * 0.13}
            dashed
            dashSize={0.26}
            gapSize={0.2}
          />
        ))}

      <RotatingCoil
        speed={speed}
        field={field}
        turns={turns}
        showCurrent={showCurrent}
        angleRef={angleRef}
        onSample={(emf, angle) => setSample({ emf, angle })}
      />

      <EmfTrace speed={speed} field={field} turns={turns} angleRef={angleRef} />

      <SceneReadout
        title="Faraday's law"
        subtitle="Φ = B A sin θ  ·  ε = −N ΔΦ/Δt"
        rows={[
          ["Turns N", turns, "gold"],
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
          { color: PALETTE.sky, shape: "dash", label: "Magnetic field lines B" },
          { color: PALETTE.gold, shape: "line", label: "Coil, induced current & e.m.f. trace" },
          {
            color: "#cbd5e1",
            label: "Slip rings",
            note: "continuous, so the output stays a.c. — a motor's split ring would flip it",
          },
          {
            color: PALETTE.emerald,
            label: "Doubling N, B or the speed",
            note: "doubles ε₀; speed doubles the frequency too",
          },
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 5 · Kinetic particle theory & gas laws ═══════════════════════════

const MAX_PARTICLES = 140;
// Fixed cross-section; only the piston travel changes, so volume ∝ length.
const BORE = 2.1;

function GasParticles({ count, temperature, halfLength, onCollisionRate }) {
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
    const step = Math.min(delta, 0.04);
    // Mean speed rises with √T — the kinetic-theory result behind Charles's law.
    const target = 1.35 * Math.sqrt(temperature / 300);
    const radius = 0.13;
    // The piston face is the only wall that moves; the bore is fixed.
    const wallX = halfLength - radius;
    const wallYZ = BORE - radius;
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
  const colour = new THREE.Color(PALETTE.sky).lerp(new THREE.Color(PALETTE.rose), t);

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

export function GasLawsScene({ params }) {
  const { temperature, volume, particles } = params;
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
    <SceneCanvas camera={{ position: [4, 3.5, 11], fov: 45 }}>
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
      />

      <SceneReadout
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

// ─── Dispatcher ─────────────────────────────────────────────────────

const SCENES = {
  refraction: RefractionScene,
  motor: MotorEffectScene,
  lenses: LensOpticsScene,
  induction: InductionScene,
  gas: GasLawsScene,
};

export default function PhysicsCanvas({ topicId, params }) {
  const Scene = SCENES[topicId];
  if (!Scene) return null;
  return <Scene params={params} />;
}
