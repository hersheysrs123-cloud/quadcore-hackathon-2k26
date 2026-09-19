"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import { FORCE_COLOURS, ForceVector, useForceScale } from "@/components/visualizations/force-diagram";
import {
  FLUIDS,
  MAX_VOLUME,
  SOLIDS,
  solveBuoyancy,
} from "@/lib/buoyancy";

// ─── Archimedes' principle ──────────────────────────────────────────
// An overflow can with a spout, a graduated cylinder catching what comes out,
// and a spring scale on a gantry lowering solids into it.
//
// The apparatus is the argument. A student who is told F_b = ρVg has been told
// a formula; a student who watches 200 mL pour into the cylinder, reads 1.96 N
// off the scale as the weight the object appears to have lost, and notices
// that 200 mL of water weighs 1.96 N, has been shown that the buoyant force IS
// the weight of the displaced fluid. So the overflow is not decoration — it is
// the measurement, and the two numbers are printed side by side because the
// whole point is that they agree.
//
// The second thing the scene exists for is the steel ship. Nothing about the
// material changes between the pebble that sinks and the hull that floats;
// what changes is the volume of water pushed aside, and switching between them
// with the density slider untouched is the fastest way to make that land.
// ─────────────────────────────────────────────────────────────────────

/** World units per centimetre of apparatus. */
const S = 0.22;
const cm = (v) => v * S;

/** The bench top. */
const FLOOR_Y = -3.2;

/** Inside dimensions of the overflow can, centimetres. */
const TANK = { width: 34, depth: 20, height: 24, wall: 0.55 };
/** Height of the spout lip — the water can never stand higher than this. */
const WATER_CM = 18;
const TANK_X = -1.9;

/** The measuring cylinder that catches the overflow. */
const CYL = { x: 3.8, radius: 3.2, height: 18, capacity: MAX_VOLUME };

const SURFACE_Y = FLOOR_Y + cm(WATER_CM);
const GANTRY_Y = 6.5;
/** How far below the surface a fully immersed object is held. */
const IMMERSION_DEPTH_CM = 4;

const ACRYLIC = "#b8c9dc";

// ─── The overflow can ───────────────────────────────────────────────

/**
 * The tank, drawn as five transparent acrylic panels rather than one box.
 *
 * A single transparent cube renders its own back faces through its front ones
 * and the object inside ends up behind a double layer of tint. Separate thin
 * panels put exactly one sheet of acrylic between the camera and the specimen,
 * which is also what the real apparatus is.
 */
function OverflowCan() {
  const w = cm(TANK.width);
  const d = cm(TANK.depth);
  const h = cm(TANK.height);
  const t = cm(TANK.wall);

  const panel = (
    <meshPhysicalMaterial
      color={ACRYLIC}
      transparent
      opacity={0.13}
      roughness={0.04}
      metalness={0.05}
      transmission={0.78}
      thickness={0.3}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  );

  return (
    <group position={[TANK_X, FLOOR_Y, 0]}>
      <mesh position={[0, t / 2, 0]} receiveShadow>
        <boxGeometry args={[w, t, d]} />
        {panel}
      </mesh>
      <mesh position={[-w / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        {panel}
      </mesh>
      <mesh position={[w / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        {panel}
      </mesh>
      <mesh position={[0, h / 2, -d / 2]}>
        <boxGeometry args={[w, h, t]} />
        {panel}
      </mesh>
      <mesh position={[0, h / 2, d / 2]}>
        <boxGeometry args={[w, h, t]} />
        {panel}
      </mesh>

      {/* The spout, set into the right-hand wall exactly at the water line.
          Its lip is what fixes the level: pour anything in and the surplus
          leaves rather than raising the surface. */}
      <mesh position={[w / 2 + cm(2.6), cm(WATER_CM) - cm(0.4), 0]} rotation={[0, 0, -Math.PI / 2 - 0.24]}>
        <cylinderGeometry args={[cm(0.85), cm(0.85), cm(6.2), 16, 1, true]} />
        <meshStandardMaterial
          color={ACRYLIC}
          transparent
          opacity={0.24}
          roughness={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * The body of fluid, plus its meniscus.
 *
 * Height is fixed at the spout lip and never animates, because in an overflow
 * can it genuinely does not move — that is the entire reason the apparatus has
 * a spout. What the eye should follow instead is the cylinder filling.
 */
function Fluid({ spec }) {
  if (spec.density < 0.01) return null; // Air: the can is empty.
  const w = cm(TANK.width) - cm(TANK.wall) * 2;
  const d = cm(TANK.depth) - cm(TANK.wall) * 2;
  const h = cm(WATER_CM);

  return (
    <group position={[TANK_X, FLOOR_Y, 0]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshPhysicalMaterial
          color={spec.colour}
          transparent
          opacity={spec.opacity}
          roughness={spec.roughness}
          metalness={spec.metalness}
          depthWrite={false}
        />
      </mesh>
      {/* Surface, drawn separately and brighter so the waterline against the
          specimen is unambiguous. */}
      <mesh position={[0, h + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={spec.colour}
          transparent
          opacity={Math.min(spec.opacity + 0.25, 0.95)}
          roughness={spec.roughness}
          metalness={spec.metalness}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── The measuring cylinder ─────────────────────────────────────────

/**
 * Graduations every 25 mL, numbered every 100.
 *
 * The cylinder's bore is chosen so its full 500 mL matches the largest object
 * the volume slider can make — so a fully immersed maximum object fills it to
 * the brim, and no reading ever runs off the top of the glass.
 */
function CylinderGraduations() {
  const fillHeight = cm(CYL.height) * 0.86;

  const ticks = useMemo(() => {
    const positions = [];
    for (let ml = 0; ml <= CYL.capacity; ml += 25) {
      const y = (ml / CYL.capacity) * fillHeight;
      const long = ml % 100 === 0;
      const len = long ? cm(2.4) : cm(1.2);
      positions.push(0, y, cm(CYL.radius), 0, y, cm(CYL.radius) - len);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [fillHeight]);

  // Built once, but released explicitly all the same — the scene is mounted
  // and unmounted every time a student switches topic.
  useEffect(() => () => ticks.dispose(), [ticks]);

  return (
    <group>
      <lineSegments geometry={ticks} rotation={[0, 0.35, 0]}>
        <lineBasicMaterial color="#f1f5f9" transparent opacity={0.85} />
      </lineSegments>
      {[100, 200, 300, 400, 500].map((ml) => (
        <SceneLabel
          key={ml}
          position={[cm(CYL.radius) + 0.45, (ml / CYL.capacity) * fillHeight, 0.3]}
          tone="text-ink-500"
        >
          {ml}
        </SceneLabel>
      ))}
    </group>
  );
}

/**
 * The catch cylinder and the column of fluid in it.
 *
 * The column eases toward its target rather than jumping, because the overflow
 * is an event: move the volume slider and water runs down the spout for a
 * second or two before the reading settles. Animating it in a ref keeps that
 * at sixty frames a second without re-rendering the scene for each one.
 */
function MeasuringCylinder({ targetML, spec, onLevel, animSpeed = 1 }) {
  const columnRef = useRef(null);
  const shown = useRef(0);
  const fillHeight = cm(CYL.height) * 0.86;
  const empty = spec.density < 0.01;

  useFrame((_, rawDelta) => {
    const mesh = columnRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 1 / 30) * animSpeed;
    const target = empty ? 0 : clamp(targetML, 0, CYL.capacity);
    // Exponential settle: fast while the gap is large, gentle as it arrives.
    shown.current += (target - shown.current) * Math.min(dt * 3.2, 1);
    if (Math.abs(target - shown.current) < 0.05) shown.current = target;

    const h = (shown.current / CYL.capacity) * fillHeight;
    mesh.scale.y = Math.max(h, 1e-4);
    mesh.position.y = h / 2;
    mesh.visible = h > 1e-3;
    onLevel?.(shown.current, target);
  });

  return (
    <group position={[CYL.x, FLOOR_Y, 0]}>
      {/* Foot and body. */}
      <mesh position={[0, cm(0.5), 0]}>
        <cylinderGeometry args={[cm(CYL.radius + 1.4), cm(CYL.radius + 1.6), cm(1), 28]} />
        <meshPhysicalMaterial color="#94a3b8" transparent opacity={0.25} roughness={0.1} />
      </mesh>
      <mesh position={[0, cm(CYL.height) / 2, 0]}>
        <cylinderGeometry args={[cm(CYL.radius), cm(CYL.radius), cm(CYL.height), 32, 1, true]} />
        <meshPhysicalMaterial
          color={ACRYLIC}
          transparent
          opacity={0.14}
          roughness={0.04}
          transmission={0.75}
          thickness={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* The collected overflow. Unit height, scaled in the frame loop. */}
      <mesh ref={columnRef} position={[0, 0, 0]}>
        <cylinderGeometry args={[cm(CYL.radius) * 0.94, cm(CYL.radius) * 0.94, 1, 28]} />
        <meshPhysicalMaterial
          color={spec.colour}
          transparent
          opacity={Math.min(spec.opacity + 0.3, 0.97)}
          roughness={spec.roughness}
          metalness={spec.metalness}
        />
      </mesh>

      <CylinderGraduations />
    </group>
  );
}

/**
 * The stream running from the spout to the cylinder while the level is still
 * catching up.
 *
 * Shown only when fluid is actually moving. A permanently pouring spout would
 * be a scene quietly asserting that an object goes on displacing water for as
 * long as it sits there, which is the opposite of what settles.
 */
function OverflowStream({ spec, activeRef, animSpeed = 1 }) {
  const group = useRef(null);
  const count = 14;

  const from = useMemo(
    () => new THREE.Vector3(TANK_X + cm(TANK.width / 2) + cm(5.2), SURFACE_Y - cm(1.6), 0),
    [],
  );
  const to = useMemo(() => new THREE.Vector3(CYL.x, FLOOR_Y + cm(CYL.height) * 0.55, 0), []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    g.visible = Boolean(activeRef?.current);
    if (!g.visible) return;
    const t = state.clock.elapsedTime * animSpeed;
    for (let i = 0; i < count; i += 1) {
      const child = g.children[i];
      if (!child) continue;
      const phase = (t * 1.6 + i / count) % 1;
      // A short fall: linear across, quadratic down.
      child.position.set(
        from.x + (to.x - from.x) * phase,
        from.y + (to.y - from.y) * phase * phase,
        Math.sin(i * 2.3) * 0.06,
      );
      child.scale.setScalar(0.75 + 0.35 * Math.sin(phase * Math.PI));
    }
  });

  return (
    <group ref={group} visible={false}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.075, 8, 8]} />
          <meshStandardMaterial
            color={spec.colour}
            transparent
            opacity={0.85}
            roughness={spec.roughness}
            metalness={spec.metalness}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── The specimens ──────────────────────────────────────────────────

/** An irregular lump: an icosahedron with its vertices pushed about. */
function useRockGeometry() {
  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.5, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const jitter = 0.78 + hashRandom(i * 3.7 + 1.3) * 0.46;
      pos.setXYZ(i, pos.getX(i) * jitter, pos.getY(i) * jitter * 0.92, pos.getZ(i) * jitter);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * A realistic, authentic marine vessel for Archimedes' buoyancy demonstration.
 *
 * Designed to showcase why ships float:
 * 1. Contoured hull featuring flared deadrise topsides, pointed bow with cutwater stem,
 *    transom stern, and centerline keel.
 * 2. Deep open cockpit/cargo well that visibly encloses a large volume of air, making the
 *    mean density lower than fluid and explaining why steel floats.
 * 3. Gunwale rub-rail capping, foredeck with bow mooring cleat, and aft quarterdeck.
 * 4. Center thwart bench with a polished lifting eyelet ring directly aligned with the
 *    suspension line from the spring scale.
 * 5. Transverse floor ribs and an external centerline keel skeg.
 * 6. Swamped state filling the interior cavity with fluid if submerged/flooded.
 */
function RealisticBoat({ l, w, h, colour, swamped, fluidSpec }) {
  const Nx = 24;
  const t = Math.max(h * 0.055, 0.025);

  const { outerGeom, innerGeom, deckGeom, swampedGeom } = useMemo(() => {
    const getBTop = (u) => {
      let b;
      if (u <= 0.45) {
        b = (w / 2) * (0.86 + 0.14 * Math.sin((u / 0.45) * (Math.PI / 2)));
      } else {
        b = (w / 2) * Math.cos(((u - 0.45) / 0.55) * (Math.PI / 2));
      }
      return Math.max(b, 0.02 * w);
    };
    const getBBot = (u) => getBTop(u) * 0.64;
    const getYKeel = (u) => {
      let y = -h / 2;
      if (u > 0.8) {
        const frac = (u - 0.8) / 0.2;
        y += h * 0.35 * frac * frac;
      }
      return y;
    };
    const getYSheer = (u) => h / 2 + (h * 0.07) * Math.pow((u - 0.45) / 0.55, 2);

    // 1. Outer Hull
    const outerGeom = new THREE.BufferGeometry();
    const outerVerts = [];
    const outerIndices = [];
    const outerRingVerts = 9;

    for (let i = 0; i <= Nx; i++) {
      const u = i / Nx;
      const x = -l / 2 + u * l;
      const bTop = getBTop(u);
      const bBot = getBBot(u);
      const yKeel = getYKeel(u);
      const ySheer = getYSheer(u);
      const yMid = (ySheer + yKeel) * 0.5;

      outerVerts.push(x, ySheer, bTop);
      outerVerts.push(x, yMid, bTop * 0.84);
      outerVerts.push(x, yKeel + h * 0.14, bBot);
      outerVerts.push(x, yKeel + h * 0.03, bBot * 0.4);
      outerVerts.push(x, yKeel, 0);
      outerVerts.push(x, yKeel + h * 0.03, -bBot * 0.4);
      outerVerts.push(x, yKeel + h * 0.14, -bBot);
      outerVerts.push(x, yMid, -bTop * 0.84);
      outerVerts.push(x, ySheer, -bTop);
    }

    for (let i = 0; i < Nx; i++) {
      for (let j = 0; j < outerRingVerts - 1; j++) {
        const v00 = i * outerRingVerts + j;
        const v01 = i * outerRingVerts + j + 1;
        const v10 = (i + 1) * outerRingVerts + j;
        const v11 = (i + 1) * outerRingVerts + j + 1;
        outerIndices.push(v00, v10, v01);
        outerIndices.push(v01, v10, v11);
      }
    }

    // Transom plate
    const t0 = 0, t1 = 1, t2 = 2, t3 = 3, t4 = 4, t5 = 5, t6 = 6, t7 = 7, t8 = 8;
    outerIndices.push(t0, t1, t8);
    outerIndices.push(t8, t1, t7);
    outerIndices.push(t1, t2, t7);
    outerIndices.push(t7, t2, t6);
    outerIndices.push(t2, t3, t6);
    outerIndices.push(t6, t3, t5);
    outerIndices.push(t3, t4, t5);

    // Bow stem
    const bBase = Nx * outerRingVerts;
    for (let j = 0; j < 4; j++) {
      const pPort = bBase + j;
      const pPortNext = bBase + j + 1;
      const pStbd = bBase + (outerRingVerts - 1 - j);
      const pStbdNext = bBase + (outerRingVerts - 2 - j);
      outerIndices.push(pPort, pStbd, pPortNext);
      outerIndices.push(pPortNext, pStbd, pStbdNext);
    }

    outerGeom.setAttribute("position", new THREE.Float32BufferAttribute(outerVerts, 3));
    outerGeom.setIndex(outerIndices);
    outerGeom.computeVertexNormals();

    // 2. Inner Cockpit (hollow hold)
    const innerGeom = new THREE.BufferGeometry();
    const iStart = Math.max(1, Math.floor(Nx * 0.08));
    const iEnd = Math.min(Nx - 1, Math.floor(Nx * 0.82));
    const innerRingVerts = 7;
    const innerVerts = [];
    const innerIndices = [];

    for (let i = iStart; i <= iEnd; i++) {
      const u = i / Nx;
      const x = -l / 2 + u * l;
      const bTopIn = Math.max(getBTop(u) - t, 0.02);
      const bBotIn = Math.max(getBBot(u) - t, 0.01);
      const yFloor = getYKeel(u) + t;
      const ySheer = getYSheer(u);
      const yMid = (ySheer + yFloor) * 0.5;

      innerVerts.push(x, ySheer, bTopIn);
      innerVerts.push(x, yMid, bTopIn * 0.85);
      innerVerts.push(x, yFloor, bBotIn);
      innerVerts.push(x, yFloor, 0);
      innerVerts.push(x, yFloor, -bBotIn);
      innerVerts.push(x, yMid, -bTopIn * 0.85);
      innerVerts.push(x, ySheer, -bTopIn);
    }

    const numInnerSlices = iEnd - iStart;
    for (let i = 0; i < numInnerSlices; i++) {
      for (let j = 0; j < innerRingVerts - 1; j++) {
        const v00 = i * innerRingVerts + j;
        const v01 = i * innerRingVerts + j + 1;
        const v10 = (i + 1) * innerRingVerts + j;
        const v11 = (i + 1) * innerRingVerts + j + 1;
        innerIndices.push(v00, v01, v10);
        innerIndices.push(v01, v11, v10);
      }
    }

    // Aft bulkhead
    for (let j = 0; j < 3; j++) {
      innerIndices.push(j, j + 1, innerRingVerts - 1 - j);
      innerIndices.push(innerRingVerts - 1 - j, j + 1, innerRingVerts - 2 - j);
    }
    // Forward bulkhead
    const lastBase = numInnerSlices * innerRingVerts;
    for (let j = 0; j < 3; j++) {
      innerIndices.push(lastBase + j, lastBase + innerRingVerts - 1 - j, lastBase + j + 1);
      innerIndices.push(lastBase + innerRingVerts - 1 - j, lastBase + innerRingVerts - 2 - j, lastBase + j + 1);
    }

    innerGeom.setAttribute("position", new THREE.Float32BufferAttribute(innerVerts, 3));
    innerGeom.setIndex(innerIndices);
    innerGeom.computeVertexNormals();

    // 3. Deck Gunwales, Foredeck & Aftdeck
    const deckGeom = new THREE.BufferGeometry();
    const gunwaleVerts = [];
    const gunwaleIndices = [];

    // Port gunwale
    for (let i = iStart; i <= iEnd; i++) {
      const u = i / Nx;
      const x = -l / 2 + u * l;
      const y = getYSheer(u) + 0.005;
      gunwaleVerts.push(x, y, getBTop(u));
      gunwaleVerts.push(x, y, Math.max(getBTop(u) - t, 0.02));
    }
    for (let i = 0; i < numInnerSlices; i++) {
      gunwaleIndices.push(i * 2, (i + 1) * 2, i * 2 + 1);
      gunwaleIndices.push(i * 2 + 1, (i + 1) * 2, (i + 1) * 2 + 1);
    }

    // Stbd gunwale
    const stbdBase = gunwaleVerts.length / 3;
    for (let i = iStart; i <= iEnd; i++) {
      const u = i / Nx;
      const x = -l / 2 + u * l;
      const y = getYSheer(u) + 0.005;
      gunwaleVerts.push(x, y, -getBTop(u));
      gunwaleVerts.push(x, y, -(Math.max(getBTop(u) - t, 0.02)));
    }
    for (let i = 0; i < numInnerSlices; i++) {
      gunwaleIndices.push(stbdBase + i * 2, stbdBase + i * 2 + 1, stbdBase + (i + 1) * 2);
      gunwaleIndices.push(stbdBase + i * 2 + 1, stbdBase + (i + 1) * 2 + 1, stbdBase + (i + 1) * 2);
    }

    // Foredeck
    const fBase = gunwaleVerts.length / 3;
    const numFore = Nx - iEnd;
    for (let i = iEnd; i <= Nx; i++) {
      const u = i / Nx;
      const x = -l / 2 + u * l;
      const y = getYSheer(u) + 0.005;
      const b = getBTop(u);
      gunwaleVerts.push(x, y, b);
      gunwaleVerts.push(x, y, -b);
    }
    for (let i = 0; i < numFore; i++) {
      gunwaleIndices.push(fBase + i * 2, fBase + (i + 1) * 2, fBase + i * 2 + 1);
      gunwaleIndices.push(fBase + i * 2 + 1, fBase + (i + 1) * 2, fBase + (i + 1) * 2 + 1);
    }

    // Aftdeck
    const aBase = gunwaleVerts.length / 3;
    for (let i = 0; i <= iStart; i++) {
      const u = i / Nx;
      const x = -l / 2 + u * l;
      const y = getYSheer(u) + 0.005;
      const b = getBTop(u);
      gunwaleVerts.push(x, y, b);
      gunwaleVerts.push(x, y, -b);
    }
    for (let i = 0; i < iStart; i++) {
      gunwaleIndices.push(aBase + i * 2, aBase + (i + 1) * 2, aBase + i * 2 + 1);
      gunwaleIndices.push(aBase + i * 2 + 1, aBase + (i + 1) * 2, aBase + (i + 1) * 2 + 1);
    }

    deckGeom.setAttribute("position", new THREE.Float32BufferAttribute(gunwaleVerts, 3));
    deckGeom.setIndex(gunwaleIndices);
    deckGeom.computeVertexNormals();

    // 4. Swamped Fluid Geometry
    let swampedGeom = null;
    if (swamped) {
      swampedGeom = new THREE.BufferGeometry();
      const fVerts = [];
      const fIndices = [];
      for (let i = iStart; i <= iEnd; i++) {
        const u = i / Nx;
        const x = -l / 2 + u * l;
        const bTopIn = Math.max(getBTop(u) - t * 1.1, 0.015);
        const bBotIn = Math.max(getBBot(u) - t * 1.1, 0.01);
        const yFloor = getYKeel(u) + t * 1.05;
        const yWater = getYSheer(u) - h * 0.04;
        fVerts.push(x, yWater, bTopIn);
        fVerts.push(x, yWater, -bTopIn);
        fVerts.push(x, yFloor, -bBotIn);
        fVerts.push(x, yFloor, bBotIn);
      }
      for (let i = 0; i < numInnerSlices; i++) {
        const b0 = i * 4;
        const b1 = (i + 1) * 4;
        fIndices.push(b0 + 0, b1 + 0, b0 + 1);
        fIndices.push(b0 + 1, b1 + 0, b1 + 1);
        fIndices.push(b0 + 1, b1 + 1, b0 + 2);
        fIndices.push(b0 + 2, b1 + 1, b1 + 2);
        fIndices.push(b0 + 2, b1 + 2, b0 + 3);
        fIndices.push(b0 + 3, b1 + 2, b1 + 3);
        fIndices.push(b0 + 3, b1 + 3, b0 + 0);
        fIndices.push(b0 + 0, b1 + 3, b1 + 0);
      }
      fIndices.push(0, 1, 3);
      fIndices.push(1, 2, 3);
      const last = numInnerSlices * 4;
      fIndices.push(last + 0, last + 3, last + 1);
      fIndices.push(last + 1, last + 3, last + 2);

      swampedGeom.setAttribute("position", new THREE.Float32BufferAttribute(fVerts, 3));
      swampedGeom.setIndex(fIndices);
      swampedGeom.computeVertexNormals();
    }

    return { outerGeom, innerGeom, deckGeom, swampedGeom };
  }, [l, w, h, swamped]);

  useEffect(() => {
    return () => {
      outerGeom.dispose();
      innerGeom.dispose();
      deckGeom.dispose();
      swampedGeom?.dispose();
    };
  }, [outerGeom, innerGeom, deckGeom, swampedGeom]);

  const hullMat = <meshStandardMaterial color={colour} roughness={0.35} metalness={0.6} side={THREE.DoubleSide} />;
  const trimMat = <meshStandardMaterial color="#5b6b80" roughness={0.35} metalness={0.5} />;
  const hwMat = <meshStandardMaterial color="#f1f5f9" roughness={0.15} metalness={0.92} />;
  const woodMat = <meshStandardMaterial color="#d4a373" roughness={0.5} metalness={0.1} />;

  const thwartY = h / 2 - h * 0.05;
  const thwartW = w * 0.94;
  const thwartL = l * 0.09;
  const thwartT = h * 0.055;

  return (
    <group>
      {/* Outer sculpted hull shell */}
      <mesh geometry={outerGeom} castShadow receiveShadow>
        {hullMat}
      </mesh>

      {/* Inner cockpit liner */}
      <mesh geometry={innerGeom} castShadow receiveShadow>
        {hullMat}
      </mesh>

      {/* Gunwales, foredeck & aftdeck */}
      <mesh geometry={deckGeom} castShadow>
        {trimMat}
      </mesh>

      {/* Center thwart bench across the middle */}
      <mesh position={[0, thwartY, 0]} castShadow>
        <boxGeometry args={[thwartL, thwartT, thwartW]} />
        {woodMat}
      </mesh>

      {/* Center lifting eyelet ring (where suspension line hooks onto boat) */}
      <group position={[0, h / 2, 0]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <torusGeometry args={[0.08, 0.022, 10, 20]} />
          {hwMat}
        </mesh>
        <mesh position={[0, -0.015, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.04, 12]} />
          {hwMat}
        </mesh>
      </group>

      {/* Bow mooring cleat on foredeck */}
      <group position={[l * 0.42, h / 2 + 0.025, 0]}>
        <mesh position={[0, 0.035, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.16, 12]} />
          {hwMat}
        </mesh>
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.03, 12]} />
          {hwMat}
        </mesh>
      </group>

      {/* Transverse internal floor ribs/frames */}
      {[-l * 0.22, 0, l * 0.22].map((rx, idx) => (
        <mesh key={`rib-${idx}`} position={[rx, -h / 2 + t * 1.3, 0]}>
          <boxGeometry args={[l * 0.025, h * 0.04, w * 0.55]} />
          {trimMat}
        </mesh>
      ))}

      {/* Keel skeg on underside */}
      <mesh position={[-l * 0.08, -h / 2 - h * 0.025, 0]} castShadow>
        <boxGeometry args={[l * 0.72, h * 0.05, 0.035]} />
        {trimMat}
      </mesh>

      {/* Swamped interior fluid */}
      {swamped && swampedGeom && (
        <mesh geometry={swampedGeom}>
          <meshPhysicalMaterial
            color={fluidSpec.colour}
            transparent
            opacity={0.65}
            roughness={fluidSpec.roughness}
            metalness={fluidSpec.metalness}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * Whichever solid is on the hook.
 */
function Specimen({ metrics, colour, swamped, fluidSpec }) {
  const rock = useRockGeometry();
  const h = cm(metrics.height);
  const l = cm(metrics.length);
  const w = cm(metrics.width);

  const material = <meshStandardMaterial color={colour} roughness={0.4} metalness={0.55} />;

  if (metrics.spec.envelope > 1) {
    return (
      <RealisticBoat
        l={l}
        w={w}
        h={h}
        colour={colour}
        swamped={swamped}
        fluidSpec={fluidSpec}
      />
    );
  }

  if (metrics.key === "sphere") {
    return (
      <mesh castShadow>
        <sphereGeometry args={[cm(metrics.radius ?? metrics.height / 2), 32, 24]} />
        {material}
      </mesh>
    );
  }

  if (metrics.key === "rock") {
    return (
      <mesh geometry={rock} scale={[l * 1.6, h * 1.15, w * 1.6]} castShadow>
        {material}
      </mesh>
    );
  }

  return (
    <mesh castShadow>
      <boxGeometry args={[l, h, w]} />
      {material}
    </mesh>
  );
}

// ─── The gantry and its spring scale ────────────────────────────────

/**
 * The scale, with a pointer that moves against a printed face.
 *
 * `reading` is the apparent weight and `full` is the true weight, so the
 * pointer's travel is literally the weight the fluid has taken off — the
 * measurement the whole experiment turns on.
 */
function SpringScale({ reading, full, hookY }) {
  const bodyTop = GANTRY_Y - 0.35;
  const bodyHeight = 1.7;
  const bodyBottom = bodyTop - bodyHeight;
  const fraction = full > 1e-9 ? clamp(reading / full, 0, 1) : 0;
  const pointerY = bodyTop - 0.22 - fraction * (bodyHeight - 0.44);

  return (
    <group position={[TANK_X, 0, 0]}>
      <mesh position={[0, bodyTop - bodyHeight / 2, 0]}>
        <boxGeometry args={[0.62, bodyHeight, 0.3]} />
        <meshStandardMaterial color="#64748b" roughness={0.35} metalness={0.65} />
      </mesh>
      {/* Face and the graduation the pointer runs against. */}
      <mesh position={[0, bodyTop - bodyHeight / 2, 0.16]}>
        <planeGeometry args={[0.4, bodyHeight - 0.3]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </mesh>
      <mesh position={[0, pointerY, 0.19]}>
        <boxGeometry args={[0.44, 0.055, 0.02]} />
        <meshStandardMaterial
          color={FORCE_COLOURS.applied}
          emissive={FORCE_COLOURS.applied}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      {/* Where the pointer sat before the specimen went in. */}
      <Line
        points={[
          [-0.34, bodyTop - 0.22 - (bodyHeight - 0.44), 0.2],
          [0.34, bodyTop - 0.22 - (bodyHeight - 0.44), 0.2],
        ]}
        color={FORCE_COLOURS.weight}
        lineWidth={1.6}
        transparent
        opacity={0.8}
        dashed
        dashSize={0.07}
        gapSize={0.06}
      />

      {/* Stem down to the hook. */}
      <mesh position={[0, (bodyBottom + hookY) / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, Math.max(bodyBottom - hookY, 0.01), 10]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.85} />
      </mesh>
      <mesh position={[0, hookY, 0]}>
        <torusGeometry args={[0.09, 0.025, 8, 18, Math.PI * 1.4]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.2} metalness={0.9} />
      </mesh>

      <SceneLabel position={[0.95, bodyTop - 0.55, 0]} accent>
        {`scale reads ${reading.toFixed(2)} N`}
      </SceneLabel>
      <SceneLabel position={[1.02, bodyTop - bodyHeight + 0.2, 0]} tone="text-rose-300">
        {`in vacuo ${full.toFixed(2)} N`}
      </SceneLabel>
    </group>
  );
}

function Gantry() {
  const left = TANK_X - cm(TANK.width / 2) - 0.8;
  const right = CYL.x + 1.2;
  const cx = (left + right) / 2;
  const span = right - left;
  return (
    <group>
      <mesh position={[cx, GANTRY_Y, 0]}>
        <boxGeometry args={[span, 0.18, 0.22]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.8} />
      </mesh>
      {[left, right].map((x) => (
        <mesh key={x} position={[x, (GANTRY_Y + FLOOR_Y) / 2, 0]}>
          <cylinderGeometry args={[0.09, 0.09, GANTRY_Y - FLOOR_Y, 16]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.8} />
        </mesh>
      ))}
      {/* Light modern laboratory workbench base */}
      <mesh position={[cx, FLOOR_Y - 0.14, 0]} receiveShadow>
        <boxGeometry args={[span + 2.4, 0.28, 5]} />
        <meshStandardMaterial color="#64748b" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Luminous brushed aluminum table top inlay */}
      <mesh position={[cx, FLOOR_Y + 0.005, 0]} receiveShadow>
        <boxGeometry args={[span + 2.2, 0.015, 4.8]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
}

// ─── The density number line ────────────────────────────────────────

/**
 * Every fluid and the specimen, laid out on one axis of g/cm³.
 *
 * This is the whole topic in one picture: the object floats if and only if its
 * marker sits to the LEFT of the fluid's. It also does the job the tank cannot
 * — showing at a glance that the hull's mean density is a completely different
 * number from the steel's, and that the gap between the two markers is where
 * the ship comes from.
 */
function DensityScale({ solved }) {
  const width = 8.8;
  const y = FLOOR_Y - 1.6;
  const x0 = TANK_X - cm(TANK.width / 2) - 0.2;
  const max = 20;

  /**
   * A square-root axis, not a linear one.
   *
   * Everything the scene is actually about happens between 0.6 and 1.5 g/cm³ —
   * wood, ice, water, sea water, honey — and on a linear 0–20 axis that entire
   * range is four per cent of the width, with fresh water and salt water
   * landing on the same pixel. Stretching the low end is what lets a student
   * see the ordering that decides every case, while still fitting mercury and
   * gold on the same line.
   */
  const at = (d) => x0 + Math.sqrt(clamp(d, 0, max) / max) * width;
  const TICKS = [0, 0.5, 1, 2, 5, 10, 20];

  const fluidKeys = Object.keys(FLUIDS);
  const hull = solved.shape.envelope > 1;

  return (
    <group>
      <Line
        points={[
          [x0, y, 0],
          [x0 + width, y, 0],
        ]}
        color="#94a3b8"
        lineWidth={1.8}
      />
      {TICKS.map((d) => (
        <group key={d}>
          <Line
            points={[
              [at(d), y - 0.1, 0],
              [at(d), y + 0.1, 0],
            ]}
            color="#94a3b8"
            lineWidth={1.2}
          />
          <SceneLabel position={[at(d), y - 0.38, 0]} tone="text-ink-500">
            {d}
          </SceneLabel>
        </group>
      ))}

      {/* Fluids below the axis. The selected one is lit. */}
      {fluidKeys.map((key) => {
        const f = FLUIDS[key];
        const selected = f.label === solved.fluid.label;
        return (
          <mesh key={key} position={[at(f.density), y - 0.16, 0]}>
            <sphereGeometry args={[selected ? 0.13 : 0.075, 14, 14]} />
            <meshStandardMaterial
              color={f.colour}
              emissive={f.colour}
              emissiveIntensity={selected ? 2.2 : 0.6}
              toneMapped={false}
            />
          </mesh>
        );
      })}
      <SceneLabel position={[at(solved.fluidDensity), y - 0.78, 0]} tone="text-sky-300">
        {`${solved.fluid.label} ${solved.fluidDensity} g/cm³`}
      </SceneLabel>

      {/* The specimen above it. Two markers when they differ. */}
      <mesh position={[at(solved.objectDensity), y + 0.2, 0]}>
        <boxGeometry args={[0.09, 0.3, 0.09]} />
        <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <SceneLabel position={[at(solved.objectDensity), y + 0.62, 0]} tone="text-ink-300">
        {`material ${solved.objectDensity.toFixed(2)}`}
      </SceneLabel>

      {hull && (
        <>
          <Line
            points={[
              [at(solved.meanDensity), y + 0.2, 0],
              [at(solved.objectDensity), y + 0.2, 0],
            ]}
            color={FORCE_COLOURS.net}
            lineWidth={1.6}
            transparent
            opacity={0.75}
            dashed
            dashSize={0.09}
            gapSize={0.07}
          />
          <mesh position={[at(solved.meanDensity), y + 0.2, 0]}>
            <boxGeometry args={[0.11, 0.36, 0.11]} />
            <meshStandardMaterial
              color={FORCE_COLOURS.net}
              emissive={FORCE_COLOURS.net}
              emissiveIntensity={1.8}
              toneMapped={false}
            />
          </mesh>
          <SceneLabel position={[at(solved.meanDensity), y + 1.0, 0]} accent>
            {`hull mean ${solved.meanDensity.toFixed(2)} — this is what floats`}
          </SceneLabel>
        </>
      )}

      <SceneLabel position={[x0 + width + 0.95, y, 0]} tone="text-ink-400">
        density g/cm³ · √ scale
      </SceneLabel>
    </group>
  );
}

function FloatingSpecimenRig({ position, floats, speed = 1, children }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    if (floats && speed > 0) {
      const t = state.clock.elapsedTime * speed;
      ref.current.position.y = position[1] + Math.sin(t * 2.4) * cm(0.25);
      ref.current.rotation.z = Math.sin(t * 1.6) * 0.015;
    } else {
      ref.current.position.y = position[1];
      ref.current.rotation.z = 0;
    }
  });
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function BuoyancyCanvas({ params = {} }) {
  const {
    objectDensity = 2.7,
    objectVolume = 200,
    fluid = "freshwater",
    solidShape = "cube",
    showForces = true,
    speed = 1,
  } = params || {};

  const solved = useMemo(
    () =>
      solveBuoyancy({
        density: objectDensity,
        volume: objectVolume,
        fluid,
        shape: solidShape,
        topDepthCm: IMMERSION_DEPTH_CM,
      }),
    [objectDensity, objectVolume, fluid, solidShape],
  );

  const { metrics } = solved;
  const colour =
    Object.values(SOLIDS).find((s) => Math.abs(s.density - objectDensity) < 0.35)?.colour ?? "#cbd5e1";

  // Where the specimen sits. Floating: its waterline is the fluid surface.
  // Sinking: held clear of the bottom at a fixed depth, which is also the
  // depth the pressure readings are quoted at.
  const centreY = solved.floats
    ? SURFACE_Y + cm(metrics.height / 2 - solved.draftCm)
    : SURFACE_Y - cm(IMMERSION_DEPTH_CM + metrics.height / 2);

  const topY = centreY + cm(metrics.height / 2);
  const hookY = 4.35;

  /** Centroid of the DISPLACED fluid — where the upthrust actually acts. */
  const buoyancyY = solved.floats ? SURFACE_Y - cm(solved.draftCm / 2) : centreY;

  const scale = useForceScale([solved.weight, solved.upthrust], 1.9);

  // Written by the cylinder every frame, read by the stream on the same frame.
  // The stream only animates when fluid is overflowing into the cylinder
  // (targetML > shownML). When the block volume is lowered or lifted out,
  // the cylinder level recedes without phantom water pouring from the spout.
  const pouring = useRef(false);
  const handleLevel = (shownML, targetML) => {
    pouring.current = targetML - shownML > 0.6;
  };

  /** The suspension line — taut while the scale is carrying something. */
  const linePoints = useMemo(() => {
    const top = [TANK_X, hookY, 0];
    const bottom = [TANK_X, topY, 0];
    if (solved.apparentWeight > 0.02) return [top, bottom];
    // Slack: the fluid is holding the whole weight and the string is not.
    const mid = (hookY + topY) / 2;
    return [
      top,
      [TANK_X - 0.34, mid + 0.1, 0.12],
      [TANK_X - 0.2, mid - 0.32, -0.08],
      bottom,
    ];
  }, [topY, solved.apparentWeight]);

  return (
    <SceneCanvas
      camera={{ position: [0.3, 1.8, 17.2], fov: 45 }}
      controls={{ minDistance: 6, maxDistance: 36, target: [0.3, 0.8, 0] }}
      lights={{ ambient: 0.88, keyLight: 1.45 }}
    >
      <Gantry />
      <OverflowCan />
      <Fluid spec={solved.fluid} />
      <MeasuringCylinder targetML={solved.overflowML} spec={solved.fluid} onLevel={handleLevel} animSpeed={speed} />
      <OverflowStream spec={solved.fluid} activeRef={pouring} animSpeed={speed} />

      <SpringScale reading={solved.apparentWeight} full={solved.weight} hookY={hookY} />
      <Line points={linePoints} color="#f1f5f9" lineWidth={1.6} transparent opacity={0.95} />

      <FloatingSpecimenRig position={[TANK_X, centreY, 0]} floats={solved.floats} speed={speed}>
        <Specimen
          metrics={metrics}
          colour={colour}
          swamped={solved.swamped}
          fluidSpec={solved.fluid}
        />
      </FloatingSpecimenRig>

      {/* The waterline, called out on the specimen itself. */}
      {solved.fluid.density > 0.01 && (
        <>
          <Line
            points={[
              [TANK_X - cm(TANK.width / 2) - 0.3, SURFACE_Y, cm(TANK.depth / 2) + 0.05],
              [TANK_X + cm(TANK.width / 2) + 0.3, SURFACE_Y, cm(TANK.depth / 2) + 0.05],
            ]}
            color={solved.fluid.colour}
            lineWidth={1.5}
            transparent
            opacity={0.8}
            dashed
            dashSize={0.12}
            gapSize={0.1}
          />
          <SceneLabel position={[TANK_X - cm(TANK.width / 2) - 1.35, SURFACE_Y, 0]} tone="text-sky-300">
            {solved.floats
              ? `${(solved.submergedFraction * 100).toFixed(0)}% under`
              : "fully immersed"}
          </SceneLabel>
        </>
      )}

      {showForces && (
        <group>
          <ForceVector
            at={[TANK_X, centreY, 0]}
            direction={[0, -1, 0]}
            newtons={solved.weight}
            scale={scale}
            colour={FORCE_COLOURS.weight}
            symbol="F_g = mg"
          />
          <ForceVector
            at={[TANK_X + 0.02, buoyancyY, 0]}
            direction={[0, 1, 0]}
            newtons={solved.upthrust}
            scale={scale}
            colour={FORCE_COLOURS.normal}
            symbol="F_b = ρVg"
          />
          {solved.apparentWeight > 0.02 && (
            <ForceVector
              at={[TANK_X - 0.26, topY, 0]}
              direction={[0, 1, 0]}
              newtons={solved.apparentWeight}
              scale={scale}
              colour={FORCE_COLOURS.applied}
              symbol="T"
              labelOffset={0.3}
            />
          )}
        </group>
      )}

      <DensityScale solved={solved} />

      {/* The measurement, stated as the equality it is. */}
      <SceneLabel position={[CYL.x, FLOOR_Y + cm(CYL.height) + 0.75, 0]} accent>
        {`${solved.overflowML.toFixed(0)} mL displaced`}
      </SceneLabel>
      <SceneLabel position={[CYL.x, FLOOR_Y + cm(CYL.height) + 0.3, 0]} tone="text-sky-300">
        {`weighs ${solved.upthrust.toFixed(2)} N — and that is F_b`}
      </SceneLabel>
      <SceneLabel position={[TANK_X, FLOOR_Y - 0.62, 0]} tone="text-ink-400">
        {solved.swamped
          ? "hull flooded — it now displaces only its own steel"
          : solved.floats
            ? `floating · ρ_mean ${solved.meanDensity.toFixed(2)} < ρ_fluid ${solved.fluidDensity}`
            : `sinking · ρ_mean ${solved.meanDensity.toFixed(2)} > ρ_fluid ${solved.fluidDensity}`}
      </SceneLabel>

    </SceneCanvas>
  );
}
