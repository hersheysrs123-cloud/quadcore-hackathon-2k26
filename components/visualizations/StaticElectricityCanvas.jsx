"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  Halo,
  SceneCanvas,
  SceneLabel,
  VectorArrow,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import {
  CHARGE_COLOURS,
  ChargeFlow,
  ChargeSigns,
  makeFlowPath,
  patchMarkers,
  sphereMarkers,
} from "@/components/visualizations/charge-carriers";
import {
  DOME_MAX_MARKERS,
  DOME_RADIUS,
  MAX_MARKERS,
  formatForce,
  leak,
  rub,
  solveStatic,
} from "@/lib/electrostatics";

// ─── Static electricity ─────────────────────────────────────────────
// A balloon, a wool sweater, a wall and a Van de Graaff, with the charge on
// every surface drawn as countable + and − markers rather than as a number.
//
// The scene is built around one correction. Students arrive believing static
// electricity is a substance that "builds up"; it is electrons moving from
// one surface to another, and nothing is created. So every marker that appears
// on the balloon has a matching one appearing on the sweater, the two counts
// are always equal and opposite, and during a rub you watch the electrons
// physically cross. The sweater's + signs are not a decoration — they are the
// receipt for the balloon's − signs.
//
// The second correction is the wall. A neutral wall attracts a charged balloon,
// which sounds like it breaks the rules until you can see the wall's own
// charges shuffling: positives drawn to the near face, negatives pushed back.
// ─────────────────────────────────────────────────────────────────────

/** World units per metre. */
const S = 4;
const FLOOR_Y = -2.6;
const WALL_Z = -3.4;
const BALLOON_R = 0.55;
const BALLOON_Y = 0.55;

const SWEATER_X = -4.1;
const DOME_X = 4.0;
const DOME_Y = 1.5;
/** The dome as drawn, from the radius the voltage is worked out for. */
const DOME_R = DOME_RADIUS * S;

/** How many seconds a single rub takes on screen. */
const RUB_SECONDS = 1.5;
/** React re-samples the charge counts this often. The clock runs every frame. */
const SAMPLE_HZ = 12;

/** Latex, and the second balloon: bright enough to read against a light room. */
const LATEX = "#f0566f";
const LATEX_BLUE = "#4f96ee";

// ─── Room ───────────────────────────────────────────────────────────

function Room({ humidity = 40 }) {
  const safeHumidity = Number.isFinite(humidity) ? humidity : 40;
  return (
    <group>
      <Grid
        position={[0, FLOOR_Y, 0]}
        args={[40, 26]}
        cellSize={0.6}
        cellColor="#b4c0d4"
        sectionSize={3}
        sectionColor="#9aa9c2"
        fadeDistance={40}
        infiniteGrid={false}
      />
      {/* Back wall — the neutral surface the balloon is tested against. */}
      <mesh position={[0, 2.4, WALL_Z]} receiveShadow>
        <planeGeometry args={[34, 10]} />
        <meshStandardMaterial color="#e8eef7" roughness={0.94} metalness={0.02} />
      </mesh>
      {/* Skirting board, so the wall meets the floor at something. */}
      <mesh position={[0, FLOOR_Y + 0.17, WALL_Z + 0.05]} receiveShadow>
        <boxGeometry args={[34, 0.34, 0.1]} />
        <meshStandardMaterial color="#eef2f8" roughness={0.7} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 26]} />
        <meshStandardMaterial color="#b9c4d7" roughness={0.9} />
      </mesh>
      {/* A rug under the whole demonstration, so the objects stand on something. */}
      <RoundedBox args={[14.4, 0.04, 7.2]} radius={0.02} smoothness={2} position={[0, FLOOR_Y + 0.03, 0.4]} receiveShadow>
        <meshStandardMaterial color="#d9cbb8" roughness={1} />
      </RoundedBox>
      <RoundedBox args={[13.6, 0.05, 6.4]} radius={0.02} smoothness={2} position={[0, FLOOR_Y + 0.035, 0.4]} receiveShadow>
        <meshStandardMaterial color="#eee5d8" roughness={1} />
      </RoundedBox>

      <Hygrometer humidity={safeHumidity} />

      {/* A mains socket and a light switch: the wall is a plastered wall in a room. */}
      <group position={[-2.6, FLOOR_Y + 0.95, WALL_Z + 0.03]}>
        <RoundedBox args={[0.52, 0.52, 0.05]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color="#f7f9fc" roughness={0.5} />
        </RoundedBox>
        {[-0.11, 0.11].map((x) => (
          <mesh key={x} position={[x, 0.03, 0.03]}>
            <boxGeometry args={[0.035, 0.11, 0.02]} />
            <meshStandardMaterial color="#3b4252" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, -0.12, 0.03]}>
          <boxGeometry args={[0.05, 0.08, 0.02]} />
          <meshStandardMaterial color="#3b4252" roughness={0.6} />
        </mesh>
      </group>
      <group position={[-6.0, 1.1, WALL_Z + 0.03]}>
        <RoundedBox args={[0.38, 0.58, 0.05]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color="#f7f9fc" roughness={0.5} />
        </RoundedBox>
        <RoundedBox args={[0.2, 0.32, 0.04]} radius={0.02} smoothness={2} position={[0, 0, 0.035]} rotation={[0.18, 0, 0]}>
          <meshStandardMaterial color="#e6ebf3" roughness={0.4} />
        </RoundedBox>
      </group>

      <SceneLabel position={[-2.5, 3.35, WALL_Z + 0.05]} tone="text-ink-400">
        {`neutral wall · ${safeHumidity.toFixed(0)}% humidity`}
      </SceneLabel>
    </group>
  );
}

/**
 * A wall hygrometer, whose needle is the humidity slider.
 *
 * The bands are the ones the readout uses for the charge's time constant —
 * green below 45 %, amber to 70 %, red above — so the dial and the Details
 * panel agree about when the demonstration stops working.
 */
function Hygrometer({ humidity = 40 }) {
  const h = clamp(humidity, 0, 100);
  // 0 % is 120° left of straight up, 100 % is 120° right of it.
  const needle = ((120 - h * 2.4) * Math.PI) / 180;
  const arc = (from, to) => ({
    start: ((90 + 120 - to * 2.4) * Math.PI) / 180,
    length: ((to - from) * 2.4 * Math.PI) / 180,
  });
  const bands = [
    { from: 0, to: 45, colour: "#34d399" },
    { from: 45, to: 70, colour: "#fbbf24" },
    { from: 70, to: 100, colour: "#fb7185" },
  ];
  return (
    <group position={[-2.5, 2.6, WALL_Z + 0.05]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.03]}>
        <torusGeometry args={[0.47, 0.045, 10, 36]} />
        <meshStandardMaterial color="#8a97ab" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.45, 36]} />
        <meshStandardMaterial color="#fafbfd" roughness={0.5} />
      </mesh>
      {bands.map((b) => {
        const a = arc(b.from, b.to);
        return (
          <mesh key={b.colour} position={[0, 0, 0.025]}>
            <ringGeometry args={[0.31, 0.39, 24, 1, a.start, a.length]} />
            <meshBasicMaterial color={b.colour} />
          </mesh>
        );
      })}
      {Array.from({ length: 11 }, (_, i) => {
        const phi = ((120 - i * 24) * Math.PI) / 180;
        return (
          <mesh key={i} position={[-Math.sin(phi) * 0.27, Math.cos(phi) * 0.27, 0.03]} rotation={[0, 0, phi]}>
            <boxGeometry args={[0.014, i % 5 === 0 ? 0.06 : 0.035, 0.005]} />
            <meshBasicMaterial color="#475569" />
          </mesh>
        );
      })}
      <group rotation={[0, 0, needle]} position={[0, 0, 0.045]}>
        <mesh position={[0, 0.13, 0]}>
          <boxGeometry args={[0.024, 0.3, 0.008]} />
          <meshBasicMaterial color="#1e293b" />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

/** A scatter of tiny water beads condensed on a surface: the film the charge creeps away along. */
function WaterBeads({ humidity = 40, radius, squash = 1, size = 0.03, seed = 0 }) {
  const ref = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = Math.round(clamp((humidity - 45) / 50, 0, 1) * 34);
  const beads = useMemo(
    () =>
      sphereMarkers(count, radius * 1.015).map((m) => ({
        // Rotated a quarter turn from the charge markers' lattice, so beads and
        // signs do not land on the same points.
        p: [m.position[2], m.position[1] * squash, -m.position[0]],
        k: 0.7 + hashRandom(seed + count * 0.3 + m.position[0] * 9) * 0.7,
      })),
    [count, radius, squash, seed],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    beads.forEach((b, i) => {
      dummy.position.set(b.p[0], b.p[1], b.p[2]);
      dummy.scale.setScalar(b.k);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [beads, dummy]);

  if (count === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[size, 10, 8]} />
      <meshStandardMaterial color="#14b8a6" transparent opacity={0.85} roughness={0.05} metalness={0.1} />
    </instancedMesh>
  );
}

/** Short crackling arcs off the dome once it is charged hard: corona discharge into the air. */
function Corona({ centre, radius, level }) {
  const ARCS = 7;
  const SEGS = 4;
  const last = useRef(-1);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ARCS * SEGS * 2 * 3), 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (level < 0.45) return;
    const bucket = Math.floor(state.clock.elapsedTime * 11);
    if (bucket === last.current) return;
    last.current = bucket;
    const arr = geometry.attributes.position.array;
    let k = 0;
    for (let a = 0; a < ARCS; a += 1) {
      const u = hashRandom(bucket * 7.13 + a * 13.3) * 2 - 1;
      const th = hashRandom(bucket * 3.71 + a * 5.9) * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const dx = r * Math.cos(th);
      const dy = u;
      const dz = r * Math.sin(th);
      const len = 0.28 + hashRandom(bucket * 1.9 + a * 2.7) * 0.5 * level;
      let x = centre[0] + dx * radius;
      let y = centre[1] + dy * radius;
      let z = centre[2] + dz * radius;
      for (let sgm = 0; sgm < SEGS; sgm += 1) {
        const nx = x + dx * (len / SEGS) + (hashRandom(bucket * 5.3 + a * 11 + sgm) - 0.5) * 0.14;
        const ny = y + dy * (len / SEGS) + (hashRandom(bucket * 8.1 + a * 17 + sgm) - 0.5) * 0.14;
        const nz = z + dz * (len / SEGS) + (hashRandom(bucket * 2.9 + a * 23 + sgm) - 0.5) * 0.14;
        arr[k++] = x; arr[k++] = y; arr[k++] = z;
        arr[k++] = nx; arr[k++] = ny; arr[k++] = nz;
        x = nx; y = ny; z = nz;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  });

  if (level < 0.45) return null;
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#0ea5e9" transparent opacity={0.45 + level * 0.5} />
    </lineSegments>
  );
}

/**
 * Water in the air, as motes.
 *
 * Not decoration: humidity is the control that decides how long the charge
 * survives, and a slider whose effect is invisible until you read a number is
 * a slider students do not connect to anything. A visibly damp room that
 * drains the balloon in seconds makes the mechanism obvious.
 */
function HumidityHaze({ humidity = 40, animSpeed = 1 }) {
  const safeHumidity = Number.isFinite(humidity) ? humidity : 40;
  const core = useRef(null);
  const halo = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // Up to 150 motes at saturation: the old 70 tiny ones were easy to miss.
  const count = Math.round(clamp((safeHumidity - 10) / 85, 0, 1) * 150);

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (hashRandom(i * 1.7 + 3) - 0.5) * 16,
        y: hashRandom(i * 3.1 + 11) * 7 - 2.3,
        z: hashRandom(i * 5.3 + 7) * 6.2 - 3.0,
        phase: hashRandom(i * 7.9 + 19) * Math.PI * 2,
        size: 0.75 + hashRandom(i * 2.3 + 41) * 0.75,
      })),
    [count],
  );

  useFrame((state) => {
    if (count === 0) return;
    const t = state.clock.elapsedTime * animSpeed;
    for (let i = 0; i < count; i += 1) {
      const s = seeds[i];
      // A slow wander in all three axes, and a pulse in size so the motes shimmer.
      dummy.position.set(
        s.x + Math.sin(t * 0.21 + s.phase) * 0.5,
        s.y + Math.sin(t * 0.35 + s.phase * 1.3) * 0.32,
        s.z + Math.cos(t * 0.18 + s.phase) * 0.4,
      );
      dummy.scale.setScalar(s.size * (0.88 + 0.22 * Math.sin(t * 1.3 + s.phase * 2)));
      dummy.updateMatrix();
      core.current?.setMatrixAt(i, dummy.matrix);
      halo.current?.setMatrixAt(i, dummy.matrix);
    }
    if (core.current) core.current.instanceMatrix.needsUpdate = true;
    if (halo.current) halo.current.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;
  return (
    <group>
      <instancedMesh ref={halo} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.24} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={core} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.062, 12, 12]} />
        <meshBasicMaterial color="#14b8a6" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ─── Objects ────────────────────────────────────────────────────────

/** The wool sweater on its stand — the electron donor. */
function Sweater({ markers }) {
  const signs = useMemo(
    () =>
      // Just clear of the torso's front face (z = +0.31), or the box hides them.
      patchMarkers(Math.round(markers), {
        centre: [SWEATER_X, 0.35, 0.34],
        width: 0.95,
        height: 1.45,
        seed: 13,
        plane: "xy",
      }).map((m) => ({ ...m, sign: +1 })),
    [markers],
  );

  return (
    <group>
      {/* Stand: a weighted base, a pole and a shaped support plate under the hem. */}
      <mesh position={[SWEATER_X, FLOOR_Y + 0.05, 0]}>
        <cylinderGeometry args={[0.55, 0.62, 0.1, 20]} />
        <meshStandardMaterial color="#b3bdcb" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[SWEATER_X, FLOOR_Y + 1.1, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 2.1, 12]} />
        <meshStandardMaterial color="#95a3b8" roughness={0.45} metalness={0.4} />
      </mesh>

      {/* Torso and sleeves. */}
      <RoundedBox args={[1.25, 1.7, 0.62]} radius={0.16} smoothness={4} position={[SWEATER_X, 0.35, 0]}>
        <meshStandardMaterial color="#dcbb85" roughness={0.98} metalness={0.0} />
      </RoundedBox>
      {/* Ribbed hem, and the pole's support plate beneath it. */}
      <RoundedBox args={[1.29, 0.2, 0.66]} radius={0.07} smoothness={3} position={[SWEATER_X, -0.42, 0]}>
        <meshStandardMaterial color="#c9a468" roughness={0.99} />
      </RoundedBox>
      <mesh position={[SWEATER_X, -0.56, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.04, 20]} />
        <meshStandardMaterial color="#95a3b8" roughness={0.45} metalness={0.4} />
      </mesh>
      {/* Cable-knit ridges down the front. */}
      {[-0.42, -0.21, 0, 0.21, 0.42].map((x) => (
        <mesh key={x} position={[SWEATER_X + x, 0.42, 0.315]}>
          <boxGeometry args={[0.055, 1.28, 0.02]} />
          <meshStandardMaterial color="#ceac72" roughness={0.99} />
        </mesh>
      ))}
      {[-0.85, 0.85].map((x) => (
        <group key={x} position={[SWEATER_X + x, 0.25, 0]} rotation={[0, 0, x > 0 ? -0.22 : 0.22]}>
          <RoundedBox args={[0.52, 1.15, 0.5]} radius={0.14} smoothness={4}>
            <meshStandardMaterial color="#d1ae76" roughness={0.98} />
          </RoundedBox>
          {/* Ribbed cuff. */}
          <RoundedBox args={[0.56, 0.18, 0.54]} radius={0.06} smoothness={3} position={[0, -0.56, 0]}>
            <meshStandardMaterial color="#c9a468" roughness={0.99} />
          </RoundedBox>
        </group>
      ))}
      {/* Collar, and the dark neck opening inside it. */}
      <mesh position={[SWEATER_X, 1.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.33, 0.1, 8, 22]} />
        <meshStandardMaterial color="#c29d63" roughness={0.98} />
      </mesh>
      <mesh position={[SWEATER_X, 1.235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 22]} />
        <meshStandardMaterial color="#6b5335" roughness={1} />
      </mesh>

      <ChargeSigns signs={signs} size={0.2} />

      <SceneLabel position={[SWEATER_X, 1.85, 0]} tone={markers > 0.5 ? "text-rose-300" : "text-ink-400"}>
        {markers > 0.5
          ? `wool · ${Math.round(markers)} unpaired + left behind`
          : "wool sweater · neutral"}
      </SceneLabel>
    </group>
  );
}

/** A latex balloon with its charge drawn on the skin. */
function Balloon({ markers, tint = LATEX, showLabel = true, label, tone = "text-ink-300", labelDx = 0, labelDy = 0, humidity = 40 }) {
  const signs = useMemo(
    () =>
      sphereMarkers(Math.round(markers), BALLOON_R * 1.06, { centre: [0, 0, 0] }).map((m) => ({
        ...m,
        // The mesh is scaled 1.22 in y; the markers ride the same ovoid.
        position: [m.position[0], m.position[1] * 1.22, m.position[2]],
        sign: -1,
      })),
    [markers],
  );

  return (
    <group>
      <mesh scale={[1, 1.22, 1]} castShadow>
        <sphereGeometry args={[BALLOON_R, 30, 24]} />
        <meshStandardMaterial color={tint} roughness={0.32} metalness={0.05} />
      </mesh>
      {/* Neck, the tied knot, and the string tail. */}
      <mesh position={[0, -BALLOON_R * 1.24, 0]}>
        <coneGeometry args={[0.1, 0.2, 12]} />
        <meshStandardMaterial color={tint} roughness={0.4} />
      </mesh>
      <mesh position={[0, -BALLOON_R * 1.24 - 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.045, 0.028, 8, 14]} />
        <meshStandardMaterial color={tint} roughness={0.4} />
      </mesh>
      <Line
        points={[
          [0, -BALLOON_R * 1.24 - 0.15, 0],
          [0.05, -BALLOON_R * 1.24 - 0.5, 0.03],
          [-0.04, -BALLOON_R * 1.24 - 0.85, -0.02],
          [0.03, -BALLOON_R * 1.24 - 1.2, 0.02],
        ]}
        color="#94a3b8"
        lineWidth={1.2}
      />
      {/* Condensation: the wetter the air, the more of a film there is to leak along. */}
      <group scale={[1, 1.22, 1]}>
        <WaterBeads humidity={humidity} radius={BALLOON_R} seed={3} />
      </group>
      {/* Highlight, so the latex reads as rubber rather than plastic. */}
      <mesh position={[-0.18, 0.28, BALLOON_R * 0.72]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      <ChargeSigns signs={signs} size={0.21} />
      {markers > 0.5 && (
        <Halo radius={BALLOON_R * 1.5} color={CHARGE_COLOURS.electron} opacity={0.035 + (markers / MAX_MARKERS) * 0.06} />
      )}

      {showLabel && (
        <SceneLabel position={[labelDx, BALLOON_R * 1.55 + labelDy, 0]} tone={tone}>
          {label ?? (markers > 0.5 ? `${Math.round(markers)} extra electrons` : "neutral balloon")}
        </SceneLabel>
      )}
    </group>
  );
}

/**
 * The desktop Van de Graaff.
 *
 * The belt runs whenever the generator is on, and it is drawn with the same
 * carriers as the circuit board's wires — because it is the same thing. A
 * Van de Graaff is a mechanical current: a rubber belt physically carrying
 * charge up to the dome, at a few microamps, instead of a wire conducting it.
 */
function VanDeGraaff({ on, markers, pans, animSpeed = 1, humidity = 40 }) {
  const beltPath = useMemo(
    () =>
      makeFlowPath(
        [
          [DOME_X - 0.16, FLOOR_Y + 0.5, 0],
          [DOME_X - 0.16, DOME_Y - 0.1, 0],
          [DOME_X + 0.16, DOME_Y - 0.1, 0],
          [DOME_X + 0.16, FLOOR_Y + 0.5, 0],
        ],
        { closed: true },
      ),
    [],
  );

  const domeSigns = useMemo(
    () =>
      sphereMarkers(Math.round(clamp(markers / 2, 0, 30)), DOME_R * 1.08, { centre: [0, 0, 0] }).map(
        (m) => ({ ...m, sign: -1 }),
      ),
    [markers],
  );

  return (
    <group>
      {/* Base: motor housing with vents, a rocker switch and a status lamp. */}
      <RoundedBox args={[1.3, 0.42, 1.0]} radius={0.06} smoothness={3} position={[DOME_X, FLOOR_Y + 0.21, 0]} castShadow>
        <meshStandardMaterial color="#b9c4d3" roughness={0.55} metalness={0.25} />
      </RoundedBox>
      {[-0.3, -0.18, -0.06].map((x) => (
        <mesh key={x} position={[DOME_X + x - 0.1, FLOOR_Y + 0.22, 0.503]}>
          <boxGeometry args={[0.08, 0.2, 0.01]} />
          <meshStandardMaterial color="#5b6577" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[DOME_X + 0.36, FLOOR_Y + 0.17, 0.51]} rotation={[on ? -0.35 : 0.35, 0, 0]}>
        <boxGeometry args={[0.16, 0.12, 0.05]} />
        <meshStandardMaterial color={on ? "#f4f6fa" : "#dfe4ec"} roughness={0.4} />
      </mesh>
      <mesh position={[DOME_X + 0.36, FLOOR_Y + 0.31, 0.505]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={on ? "#22c55e" : "#9ca3af"} emissive={on ? "#22c55e" : "#000000"} emissiveIntensity={on ? 1.8 : 0} toneMapped={false} />
      </mesh>

      {/* Column: clear acrylic, so the belt and its carriers can actually be seen inside it. */}
      <mesh position={[DOME_X, (FLOOR_Y + 0.42 + DOME_Y) / 2, 0]}>
        <cylinderGeometry args={[0.26, 0.3, DOME_Y - FLOOR_Y - 0.42, 24, 1, true]} />
        <meshStandardMaterial color="#c9dcf2" transparent opacity={0.3} roughness={0.1} metalness={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* The rubber belt's two runs, and the rollers it turns on. */}
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[DOME_X + x, (FLOOR_Y + 0.5 + DOME_Y - 0.1) / 2, 0]}>
          <boxGeometry args={[0.02, DOME_Y - 0.1 - FLOOR_Y - 0.5, 0.2]} />
          <meshStandardMaterial color="#4a5263" roughness={0.8} transparent opacity={0.8} />
        </mesh>
      ))}
      {[
        [DOME_Y - 0.1, "#cbd5e1", 0.2],
        [FLOOR_Y + 0.5, "#6b7385", 0.18],
      ].map(([y, colour, r]) => (
        <mesh key={y} position={[DOME_X, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.8, r * 0.8, 0.26, 16]} />
          <meshStandardMaterial color={colour} roughness={0.35} metalness={0.7} />
        </mesh>
      ))}
      {/* Metal collars where the column meets the base and the dome. */}
      {[FLOOR_Y + 0.46, DOME_Y - DOME_R + 0.02].map((y) => (
        <mesh key={y} position={[DOME_X, y, 0]}>
          <cylinderGeometry args={[0.33, 0.33, 0.09, 24]} />
          <meshStandardMaterial color="#aeb9c9" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}

      {/* Belt carriers — the mechanical current. */}
      <ChargeFlow
        path={beltPath}
        count={14}
        speed={on ? 3.2 * animSpeed : 0}
        running={on}
        colour={CHARGE_COLOURS.electron}
        radius={0.052}
        seed={5}
      />

      {/* Dome. */}
      <mesh position={[DOME_X, DOME_Y, 0]} castShadow>
        <sphereGeometry args={[DOME_R, 30, 24]} />
        <meshStandardMaterial color="#eef2f8" roughness={0.28} metalness={0.45} />
      </mesh>
      <group position={[DOME_X, DOME_Y, 0]}>
        <ChargeSigns signs={domeSigns} size={0.2} />
        <WaterBeads humidity={humidity} radius={DOME_R} seed={9} size={0.034} />
      </group>
      <Corona centre={[DOME_X, DOME_Y, 0]} radius={DOME_R} level={markers / DOME_MAX_MARKERS} />
      {markers > 1 && (
        <Halo
          position={[DOME_X, DOME_Y, 0]}
          radius={DOME_R * (1.35 + (markers / DOME_MAX_MARKERS) * 0.5)}
          color={CHARGE_COLOURS.electron}
          opacity={0.04 + (markers / DOME_MAX_MARKERS) * 0.1}
        />
      )}

      <PieStack launched={pans} animSpeed={animSpeed} />

      {/* Pulled in from the right edge: centred on the dome, the running text ran off the canvas. */}
      <SceneLabel position={[DOME_X - 0.55, DOME_Y + 1.9, 0]} tone={on ? "text-sky-300" : "text-ink-400"}>
        {on ? `Van de Graaff · ${Math.round(markers)} charges on the dome` : "Van de Graaff · off"}
      </SceneLabel>
    </group>
  );
}

/**
 * Aluminium pie pans stacked on the dome.
 *
 * They leave one at a time from the top, because the topmost pan is the one
 * with the least holding it down and the most charge below it pushing.
 */
function PieStack({ launched, animSpeed = 1 }) {
  const refs = useRef([]);
  const PANS = 4;

  useFrame((state, delta) => {
    for (let i = 0; i < PANS; i += 1) {
      const g = refs.current[i];
      if (!g) continue;
      const isLaunched = i >= PANS - launched;
      const rest = DOME_Y + DOME_R + 0.06 + i * 0.09;
      const flying = rest + 1.5 + i * 0.55 + Math.sin(state.clock.elapsedTime * animSpeed * 1.6 + i) * 0.28;
      const target = isLaunched ? flying : rest;
      g.position.y += (target - g.position.y) * Math.min(delta * 3.2 * animSpeed, 1);
      g.rotation.z = isLaunched ? Math.sin(state.clock.elapsedTime * animSpeed * 2.1 + i) * 0.32 : 0;
    }
  });

  return (
    <group>
      {Array.from({ length: PANS }, (_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={[DOME_X, DOME_Y + DOME_R + 0.06 + i * 0.09, 0]}>
          <mesh>
            <cylinderGeometry args={[0.34, 0.28, 0.05, 22]} />
            <meshStandardMaterial color="#f4f6fa" roughness={0.3} metalness={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── The charge clock ───────────────────────────────────────────────

/** Frame scratch — the clock runs every frame and must not allocate. */
const REST = new THREE.Vector3();
const RUBBING_AT = new THREE.Vector3(SWEATER_X + 1.15, 0.4, 0.05);

/**
 * Charge transfer, leakage and the rub animation, all in one place.
 *
 * The counts live in refs and advance every frame; React only sees them at
 * `SAMPLE_HZ`, because the marker clouds rebuild their instance matrices when
 * the count changes and doing that sixty times a second to animate a number
 * that moves slowly would be waste. The balloon's own motion during a rub is
 * written straight to the group's transform and never goes through React
 * at all.
 */
function ChargeClock({ humidity = 40, rubs = 0, discharge = 0, vdgOn = false, restPosition = [0, 0, 0], balloonRef, onSample, onRubPhase, animSpeed = 1 }) {
  const safeHumidity = Number.isFinite(humidity) ? humidity : 40;
  const markers = useRef(0);
  const dome = useRef(0);
  const rubPhase = useRef(0);
  const lastRub = useRef(rubs);
  const lastDischarge = useRef(discharge);
  const sampleAt = useRef(0);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05) * animSpeed;

    // A press of the rub button starts a stroke; the transfer itself lands
    // at the moment the balloon is actually against the wool.
    //
    // Only an INCREASE counts as a press. Resetting the topic sets both action
    // counters back to zero, and treating that as a press would have made
    // "reset" charge the balloon up instead of clearing it — so a decrease is
    // read as what it is, a reset, and earths everything.
    if (rubs > lastRub.current) {
      rubPhase.current = 1;
    } else if (rubs < lastRub.current || discharge < lastDischarge.current) {
      markers.current = 0;
      dome.current = 0;
      rubPhase.current = 0;
    }
    if (discharge > lastDischarge.current) {
      markers.current = 0;
      dome.current = 0;
    }
    lastRub.current = rubs;
    lastDischarge.current = discharge;

    if (rubPhase.current > 0) {
      const before = rubPhase.current;
      rubPhase.current = Math.max(0, rubPhase.current - delta / RUB_SECONDS);
      // Mid-stroke, when the surfaces are in contact.
      if (before > 0.5 && rubPhase.current <= 0.5) {
        markers.current = rub(markers.current);
      }
    }

    // Leakage never stops, which is the point of the humidity control.
    markers.current = leak(markers.current, delta, safeHumidity);
    if (markers.current < 0.05) markers.current = 0;

    if (vdgOn) {
      // The belt delivers at a steady rate; the dome loses to the air at the
      // same time, so it settles at whatever the humidity allows.
      dome.current += (DOME_MAX_MARKERS - dome.current) * Math.min(delta * 0.55, 1);
    }
    dome.current = leak(dome.current, delta, safeHumidity);
    if (dome.current < 0.05) dome.current = 0;

    // Balloon transform: at the sweater during a stroke, at its rest place
    // otherwise. A raised sine so it presses in and comes back smoothly.
    const g = balloonRef.current;
    if (g) {
      const toward = rubPhase.current > 0 ? Math.sin(rubPhase.current * Math.PI) : 0;
      const rest = restPosition || [0, 0, 0];
      REST.set(rest[0] ?? 0, rest[1] ?? 0, rest[2] ?? 0);
      g.position.lerpVectors(REST, RUBBING_AT, toward);
      // The scrub itself.
      if (toward > 0.05) {
        g.position.y += Math.sin(state.clock.elapsedTime * animSpeed * 22) * 0.09 * toward;
        g.rotation.z = Math.sin(state.clock.elapsedTime * animSpeed * 22) * 0.13 * toward;
      } else {
        g.rotation.z *= 0.9;
      }
    }

    sampleAt.current += delta;
    if (sampleAt.current >= 1 / SAMPLE_HZ) {
      sampleAt.current = 0;
      onSample(markers.current, dome.current);
      onRubPhase(rubPhase.current);
    }
  });

  return null;
}

// ─── Drag ───────────────────────────────────────────────────────────

const DRAG_PLANE = new THREE.Plane();
const HIT = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Pointer dragging for the balloon.
 *
 * Casts against a horizontal plane through the balloon rather than using the
 * pointer's screen delta, so the balloon lands under the cursor at any camera
 * angle instead of drifting away as the view is orbited. Orbit control is
 * suspended for the duration or the camera swings with the drag.
 *
 * The gap is affine in one coordinate: `gap = (coord − restCoord) × factor`,
 * where `restCoord` is the coordinate at which the surfaces touch. `factor`
 * is −2 for the two-balloon case, where both balloons hang symmetrically and
 * moving one by a centimetre opens the gap by two.
 */
function useBalloonDrag({ axis, restCoord, factor, balloonCoord, planeY, onSeparation }) {
  const controls = useThree((state) => state.controls);
  const dragging = useRef(false);
  const grab = useRef(0);
  // Read inside the pointer handlers, which outlive the render that made them.
  const live = useRef(balloonCoord);
  live.current = balloonCoord;

  useEffect(() => {
    return () => {
      if (controls && dragging.current) {
        controls.enabled = true;
      }
    };
  }, [controls]);

  const coordOf = useCallback(
    (ray) => {
      if (!ray) return null;
      DRAG_PLANE.set(UP, -planeY);
      if (!ray.intersectPlane(DRAG_PLANE, HIT)) return null;
      return axis === "x" ? HIT.x : HIT.z;
    },
    [axis, planeY],
  );

  const onPointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      const c = coordOf(e.ray);
      if (c === null) return;
      dragging.current = true;
      // Where on the balloon it was grabbed, so it does not snap to the cursor.
      grab.current = c - live.current;
      if (controls) controls.enabled = false;
      try {
        e.target?.setPointerCapture?.(e.pointerId);
      } catch (_) {}
    },
    [coordOf, controls],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      e.stopPropagation();
      const c = coordOf(e.ray);
      if (c === null) return;
      onSeparation?.((c - grab.current - restCoord) * factor);
    },
    [coordOf, onSeparation, restCoord, factor],
  );

  const end = useCallback(
    (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      if (controls) controls.enabled = true;
      try {
        e.target?.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    },
    [controls],
  );

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}

function DraggableBalloon({
  geometry,
  onSeparation,
  balloonRef,
  balloonMarkers,
  balloonCharge,
  labelDx = 0,
  labelDy = 0,
  humidity = 40,
}) {
  const drag = useBalloonDrag({
    axis: geometry.axis,
    factor: geometry.factor,
    restCoord: geometry.restCoord,
    balloonCoord: geometry.balloonCoord,
    planeY: geometry.rest[1],
    onSeparation,
  });

  return (
    <group ref={balloonRef} position={geometry.rest} {...drag}>
      <Balloon
        markers={balloonMarkers}
        label={
          balloonMarkers > 0.5
            ? `${Math.round(balloonMarkers)} extra electrons · ${(balloonCharge * 1e9).toFixed(0)} nC`
            : "neutral — rub it on the wool"
        }
        tone={balloonMarkers > 0.5 ? "text-sky-300" : "text-ink-400"}
        labelDx={labelDx}
        labelDy={labelDy}
        humidity={humidity}
      />
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function StaticElectricityCanvas({ params = {}, setParam }) {
  const {
    target = "wall",
    separation = 0.12,
    humidity = 40,
    rubs = 0,
    discharge = 0,
    vdg = false,
    speed = 1,
  } = params || {};

  const [charge, setCharge] = useState({ markers: 0, dome: 0 });
  const [rubPhase, setRubPhase] = useState(0);
  const balloonRef = useRef(null);

  const onSample = useCallback((markers, dome) => {
    setCharge((prev) =>
      Math.abs(prev.markers - markers) < 0.02 && Math.abs(prev.dome - dome) < 0.02
        ? prev
        : { markers, dome },
    );
  }, []);

  const solved = useMemo(
    () =>
      solveStatic({
        markers: charge.markers,
        domeMarkers: charge.dome,
        separation,
        target,
        humidity,
      }),
    [charge.markers, charge.dome, separation, target, humidity],
  );

  // Where the balloon hangs, and along which axis the gap is measured.
  const gap = separation * S;
  const geometry = useMemo(() => {
    if (target === "wall") {
      // Approaches the wall along +z → −z. `restCoord` is the z at which the
      // latex touches the plaster, so the gap is surface to surface.
      const z = WALL_Z + BALLOON_R + gap;
      return {
        axis: "z",
        factor: 1,
        restCoord: WALL_Z + BALLOON_R,
        balloonCoord: z,
        rest: [0, BALLOON_Y, z],
        anchor: [0, 4.4, z],
        towards: [0, BALLOON_Y, WALL_Z],
      };
    }
    if (target === "dome") {
      const x = DOME_X - DOME_R - BALLOON_R - gap;
      return {
        axis: "x",
        factor: -1,
        restCoord: DOME_X - DOME_R - BALLOON_R,
        balloonCoord: x,
        rest: [x, DOME_Y, 0],
        anchor: [x, 4.4, 0],
        towards: [DOME_X, DOME_Y, 0],
      };
    }
    // Two balloons hung symmetrically about the middle of the room, so each
    // carries half the gap — hence the factor of −2.
    const half = BALLOON_R + gap / 2;
    return {
      axis: "x",
      factor: -2,
      restCoord: -BALLOON_R,
      balloonCoord: -half,
      rest: [-half, BALLOON_Y, 0],
      anchor: [-half, 4.4, 0],
      towards: [half, BALLOON_Y, 0],
      partner: [half, BALLOON_Y, 0],
    };
  }, [target, gap]);

  const onSeparation = useCallback(
    (worldGap) => {
      const metres = clamp(worldGap / S, 0.01, 0.4);
      setParam?.("separation", Number(metres.toFixed(3)));
    },
    [setParam],
  );

  // Induced charge on the wall: positives pulled to the near face, negatives
  // pushed to the back of the same patch. Equal counts — the wall stays neutral.
  const wallSigns = useMemo(() => {
    if (target !== "wall") return { near: [], far: [] };
    const n = Math.round(solved.otherMarkers);
    return {
      near: patchMarkers(n, {
        centre: [0, BALLOON_Y, WALL_Z + 0.07],
        width: 1.7,
        height: 1.7,
        seed: 29,
        plane: "xy",
      }).map((m) => ({ ...m, sign: +1 })),
      far: patchMarkers(n, {
        centre: [0, BALLOON_Y, WALL_Z + 0.03],
        width: 3.4,
        height: 3.0,
        seed: 41,
        plane: "xy",
      }).map((m) => ({ ...m, sign: -1 })),
    };
  }, [target, solved.otherMarkers]);

  // The electrons crossing during a rub.
  const rubPath = useMemo(
    () =>
      makeFlowPath([
        [SWEATER_X + 0.5, 0.5, 0.15],
        [SWEATER_X + 0.85, 0.42, 0.12],
        [SWEATER_X + 1.15, 0.36, 0.08],
      ]),
    [],
  );

  // Force arrow: attraction points at the target, repulsion points away. The
  // length is logarithmic because an inverse square law dragged across a whole
  // room spans four orders of magnitude and a linear arrow is off-screen or
  // invisible at every setting but one.
  const arrow = useMemo(() => {
    if (solved.force < 1e-6 || solved.balloonMarkers < 0.5) return null;
    const from = new THREE.Vector3(...geometry.rest);
    const to = new THREE.Vector3(...geometry.towards);
    const dir = to.clone().sub(from).normalize();
    if (!solved.attracts) dir.negate();
    const len = clamp(0.55 + Math.log10(1 + solved.force * 400) * 0.85, 0.5, 3.2);
    if (target === "wall") {
      // The wall is only a gap away, and an arrow that starts at the balloon and
      // runs its full length is buried in the plaster. Draw it beside the
      // balloon, and stop it at the wall.
      const start = from.clone().add(new THREE.Vector3(BALLOON_R * 1.35, 0, 0));
      const room = Math.max(from.z - WALL_Z - 0.08, 0.2);
      return { from: start.toArray(), to: start.clone().addScaledVector(dir, Math.min(len, room)).toArray() };
    }
    const start = from.clone().addScaledVector(dir, BALLOON_R + 0.12);
    return { from: start.toArray(), to: start.clone().addScaledVector(dir, len).toArray() };
  }, [solved.force, solved.attracts, solved.balloonMarkers, geometry, target]);

  return (
    <SceneCanvas
      // Off the middle: from dead centre the force on a balloon held to the wall
      // points straight down the line of sight and its arrow is a dot.
      camera={{ position: [3.6, 2.5, 10.8], fov: 46 }}
      controls={{ minDistance: 4, maxDistance: 26, target: [0, 0.3, -0.6], maxPolarAngle: Math.PI / 2.02 }}
      lights={{ ambient: 0.75, keyLight: 0.9 }}
      fog={[18, 44]}
    >
      <Room humidity={humidity} />
      <HumidityHaze humidity={humidity} animSpeed={speed} />

      <ChargeClock
        humidity={humidity}
        rubs={rubs}
        discharge={discharge}
        vdgOn={Boolean(vdg)}
        restPosition={geometry.rest}
        balloonRef={balloonRef}
        onSample={onSample}
        onRubPhase={setRubPhase}
        animSpeed={speed}
      />

      <Sweater markers={solved.sweaterMarkers} />

      {/* Electrons visibly crossing from wool to latex. */}
      {rubPhase > 0.02 && (
        <ChargeFlow
          path={rubPath}
          count={9}
          speed={2.4 * speed}
          spread={0.85}
          colour={CHARGE_COLOURS.electron}
          radius={0.06}
          jitter={0.07}
          seed={3}
        />
      )}

      {/* Thread and the balloon itself. */}
      {/* Hidden mid-rub: the balloon is carried to the wool, and a thread left
          hanging at its resting place would be tied to nothing. */}
      {rubPhase < 0.02 && (
        <>
          <Line
            points={[geometry.anchor, [geometry.rest[0], geometry.rest[1] + BALLOON_R * 1.2, geometry.rest[2]]]}
            color="#64748b"
            lineWidth={1.3}
          />
          {/* Where the thread is tied off. */}
          <mesh position={geometry.anchor}>
            <torusGeometry args={[0.07, 0.018, 8, 16]} />
            <meshStandardMaterial color="#8a97ab" roughness={0.3} metalness={0.7} />
          </mesh>
        </>
      )}
      <DraggableBalloon
        geometry={geometry}
        onSeparation={onSeparation}
        balloonRef={balloonRef}
        balloonMarkers={solved.balloonMarkers}
        balloonCharge={solved.balloonCharge}
        labelDx={target === "balloon" ? -0.6 : 0}
        humidity={humidity}
      />

      {/* The second balloon, charged the same way and therefore repelled. */}
      {target === "balloon" && geometry.partner && (
        <>
          <Line
            points={[
              [geometry.partner[0], 4.4, geometry.partner[2]],
              [geometry.partner[0], geometry.partner[1] + BALLOON_R * 1.2, geometry.partner[2]],
            ]}
            color="#64748b"
            lineWidth={1.3}
          />
          <group position={geometry.partner}>
            <Balloon markers={solved.otherMarkers} tint={LATEX_BLUE} label="also rubbed — same charge" labelDx={0.6} labelDy={0.62} humidity={humidity} />
          </group>
        </>
      )}

      {target === "wall" && (
        <>
          <ChargeSigns signs={wallSigns.near} size={0.2} />
          <ChargeSigns signs={wallSigns.far} size={0.17} opacity={0.5} />
        </>
      )}
      {target === "wall" && solved.otherMarkers > 0.5 && (
        <SceneLabel position={[2.4, BALLOON_Y + 1.75, WALL_Z + 0.1]} tone="text-rose-300">
          {`wall polarised · ${Math.round(solved.otherMarkers)} + drawn to the surface, ${Math.round(solved.otherMarkers)} − pushed back`}
        </SceneLabel>
      )}

      <VanDeGraaff on={Boolean(vdg)} markers={solved.domeMarkers} pans={solved.pans} animSpeed={speed} humidity={humidity} />

      {/* The Coulomb force. */}
      {arrow && rubPhase < 0.02 && (
        <VectorArrow
          from={arrow.from}
          to={arrow.to}
          color={solved.attracts ? "#34d399" : "#fb7185"}
          radius={0.05}
          headRadius={0.15}
          label={`F = ${formatForce(solved.force)} · ${solved.attracts ? "attraction" : "repulsion"}`}
        />
      )}

      <SceneLabel position={[0, 3.9, 0.6]} accent>
        {solved.balloonMarkers > 0.5
          ? `gap ${(solved.separation * 100).toFixed(1)} cm · F = k·q₁q₂/r² = ${formatForce(solved.force)}`
          : "rub the balloon on the sweater, then drag it near something"}
      </SceneLabel>

      {solved.sticks && (
        <SceneLabel position={[0, 3.4, 0.6]} tone="text-emerald-300">
          {`it sticks — friction can hold ${(solved.grip * 1000).toFixed(0)} mN against a ${(solved.weight * 1000).toFixed(0)} mN weight`}
        </SceneLabel>
      )}

    </SceneCanvas>
  );
}

