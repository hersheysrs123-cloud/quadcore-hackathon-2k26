"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  Halo,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
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
  MAX_MARKERS,
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
const DOME_R = 0.62;

/** How many seconds a single rub takes on screen. */
const RUB_SECONDS = 1.5;
/** React re-samples the charge counts this often. The clock runs every frame. */
const SAMPLE_HZ = 12;

const LATEX = "#d9455a";

// ─── Room ───────────────────────────────────────────────────────────

function Room({ humidity = 40 }) {
  const safeHumidity = Number.isFinite(humidity) ? humidity : 40;
  return (
    <group>
      <Grid
        position={[0, FLOOR_Y, 0]}
        args={[30, 20]}
        cellSize={0.6}
        cellColor="#3f4d66"
        sectionSize={3}
        sectionColor="#46536e"
        fadeDistance={40}
        infiniteGrid={false}
      />
      {/* Back wall — the neutral surface the balloon is tested against. */}
      <mesh position={[0, 1.4, WALL_Z]} receiveShadow>
        <planeGeometry args={[16, 8.2]} />
        <meshStandardMaterial color="#42506a" roughness={0.94} metalness={0.02} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 12]} />
        <meshStandardMaterial color="#141a24" roughness={0.95} />
      </mesh>
      <SceneLabel position={[-5.4, 3.3, WALL_Z + 0.05]} tone="text-ink-400">
        {`neutral wall · ${safeHumidity.toFixed(0)}% humidity`}
      </SceneLabel>
    </group>
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
  const ref = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = Math.round(clamp((safeHumidity - 10) / 85, 0, 1) * 70);

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (hashRandom(i * 1.7 + 3) - 0.5) * 15,
        y: hashRandom(i * 3.1 + 11) * 5.2 - 2.2,
        z: (hashRandom(i * 5.3 + 7) - 0.5) * 5.5,
        phase: hashRandom(i * 7.9 + 19) * Math.PI * 2,
      })),
    [count],
  );

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh || count === 0) return;
    const t = state.clock.elapsedTime * animSpeed;
    for (let i = 0; i < count; i += 1) {
      const s = seeds[i];
      dummy.position.set(s.x, s.y + Math.sin(t * 0.35 + s.phase) * 0.22, s.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.035, 6, 6]} />
      <meshBasicMaterial color="#5eead4" transparent opacity={0.3} depthWrite={false} />
    </instancedMesh>
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
      {/* Stand. */}
      <mesh position={[SWEATER_X, FLOOR_Y + 0.05, 0]}>
        <cylinderGeometry args={[0.55, 0.62, 0.1, 20]} />
        <meshStandardMaterial color="#5b6472" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[SWEATER_X, FLOOR_Y + 1.1, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 2.1, 12]} />
        <meshStandardMaterial color="#4f5d71" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Torso and sleeves. */}
      <RoundedBox args={[1.25, 1.7, 0.62]} radius={0.16} smoothness={4} position={[SWEATER_X, 0.35, 0]}>
        <meshStandardMaterial color="#8d7358" roughness={0.98} metalness={0.0} />
      </RoundedBox>
      {[-0.85, 0.85].map((x) => (
        <RoundedBox
          key={x}
          args={[0.52, 1.15, 0.5]}
          radius={0.14}
          smoothness={4}
          position={[SWEATER_X + x, 0.25, 0]}
          rotation={[0, 0, x > 0 ? -0.22 : 0.22]}
        >
          <meshStandardMaterial color="#7f6750" roughness={0.98} />
        </RoundedBox>
      ))}
      {/* Collar. */}
      <mesh position={[SWEATER_X, 1.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.33, 0.1, 8, 22]} />
        <meshStandardMaterial color="#6f5942" roughness={0.98} />
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
function Balloon({ markers, tint = LATEX, showLabel = true, label, tone = "text-ink-300" }) {
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
      {/* Knot. */}
      <mesh position={[0, -BALLOON_R * 1.24, 0]}>
        <coneGeometry args={[0.1, 0.2, 10]} />
        <meshStandardMaterial color={tint} roughness={0.4} />
      </mesh>
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
        <SceneLabel position={[0, BALLOON_R * 1.55, 0]} tone={tone}>
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
function VanDeGraaff({ on, markers, pans, animSpeed = 1 }) {
  const beltPath = useMemo(
    () =>
      makeFlowPath(
        [
          [DOME_X - 0.16, FLOOR_Y + 0.35, 0.1],
          [DOME_X - 0.16, DOME_Y - 0.1, 0.1],
          [DOME_X + 0.16, DOME_Y - 0.1, -0.1],
          [DOME_X + 0.16, FLOOR_Y + 0.35, -0.1],
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
      {/* Base and column. */}
      <RoundedBox args={[1.3, 0.42, 1.0]} radius={0.06} smoothness={3} position={[DOME_X, FLOOR_Y + 0.21, 0]}>
        <meshStandardMaterial color="#5b6472" roughness={0.6} metalness={0.4} />
      </RoundedBox>
      <mesh position={[DOME_X, (FLOOR_Y + 0.42 + DOME_Y) / 2, 0]}>
        <cylinderGeometry args={[0.26, 0.3, DOME_Y - FLOOR_Y - 0.42, 18]} />
        <meshStandardMaterial color="#526076" roughness={0.55} metalness={0.35} />
      </mesh>

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
        <meshStandardMaterial color="#aab4c2" roughness={0.22} metalness={0.95} />
      </mesh>
      <group position={[DOME_X, DOME_Y, 0]}>
        <ChargeSigns signs={domeSigns} size={0.2} />
      </group>
      {markers > 1 && (
        <Halo
          position={[DOME_X, DOME_Y, 0]}
          radius={DOME_R * (1.35 + (markers / DOME_MAX_MARKERS) * 0.5)}
          color={CHARGE_COLOURS.electron}
          opacity={0.04 + (markers / DOME_MAX_MARKERS) * 0.1}
        />
      )}

      <PieStack launched={pans} animSpeed={animSpeed} />

      <SceneLabel position={[DOME_X, DOME_Y + 1.9, 0]} tone={on ? "text-sky-300" : "text-ink-500"}>
        {on ? `Van de Graaff running · ${Math.round(markers)} charges on the dome` : "Van de Graaff · off"}
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
            <meshStandardMaterial color="#c8d0da" roughness={0.28} metalness={0.92} />
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
    const start = from.clone().addScaledVector(dir, BALLOON_R + 0.12);
    return { from: start.toArray(), to: start.clone().addScaledVector(dir, len).toArray() };
  }, [solved.force, solved.attracts, solved.balloonMarkers, geometry]);

  return (
    <SceneCanvas
      camera={{ position: [0.5, 2.2, 11.5], fov: 46 }}
      controls={{ minDistance: 4, maxDistance: 26, target: [0, 0.3, -0.6], maxPolarAngle: Math.PI / 2.02 }}
      lights={{ ambient: 0.5, keyLight: 0.9 }}
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
      <Line
        points={[geometry.anchor, [geometry.rest[0], geometry.rest[1] + BALLOON_R * 1.2, geometry.rest[2]]]}
        color="#4b5563"
        lineWidth={1.2}
      />
      <DraggableBalloon
        geometry={geometry}
        onSeparation={onSeparation}
        balloonRef={balloonRef}
        balloonMarkers={solved.balloonMarkers}
        balloonCharge={solved.balloonCharge}
      />

      {/* The second balloon, charged the same way and therefore repelled. */}
      {target === "balloon" && geometry.partner && (
        <>
          <Line
            points={[
              [geometry.partner[0], 4.4, geometry.partner[2]],
              [geometry.partner[0], geometry.partner[1] + BALLOON_R * 1.2, geometry.partner[2]],
            ]}
            color="#4b5563"
            lineWidth={1.2}
          />
          <group position={geometry.partner}>
            <Balloon markers={solved.otherMarkers} tint="#3f7fd0" label="also rubbed — same charge" />
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
        <SceneLabel position={[1.9, BALLOON_Y + 1.15, WALL_Z + 0.1]} tone="text-rose-300">
          {`wall polarised · ${Math.round(solved.otherMarkers)} + drawn to the surface, ${Math.round(solved.otherMarkers)} − pushed back`}
        </SceneLabel>
      )}

      <VanDeGraaff on={Boolean(vdg)} markers={solved.domeMarkers} pans={solved.pans} animSpeed={speed} />

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

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Static electricity"
        subtitle={`balloon near the ${solved.spec.label.toLowerCase()}`}
        rows={[
          ["On the balloon", `${Math.round(solved.balloonMarkers)} −`],
          ["On the wool", `${Math.round(solved.sweaterMarkers)} +`],
          [target === "wall" ? "Induced on the wall" : "On the other object", `${Math.round(solved.otherMarkers)}`],
          ["Gap", `${(solved.separation * 100).toFixed(1)} cm`],
          ["Coulomb force", formatForce(solved.force), solved.attracts ? "good" : "bad"],
        ]}
      />

      <SceneLegend
        title="Charge key"
        items={[
          { color: CHARGE_COLOURS.electron, label: "− electron", note: "the only thing that moves" },
          { color: CHARGE_COLOURS.positive, label: "+ unpaired", note: "left behind where an electron used to be" },
          { color: "#34d399", label: "Attraction", note: "charged to neutral, by induction" },
          { color: "#5eead4", label: "Water in the air", note: "leaks the charge away" },
        ]}
      />
    </SceneCanvas>
  );
}

/** Newtons, in whichever unit keeps the number readable. */
function formatForce(newtons = 0) {
  const n = Number.isFinite(newtons) ? Math.abs(newtons) : 0;
  if (n >= 1) return `${n.toFixed(2)} N`;
  if (n >= 1e-3) return `${(n * 1e3).toFixed(1)} mN`;
  return `${(n * 1e6).toFixed(0)} µN`;
}
