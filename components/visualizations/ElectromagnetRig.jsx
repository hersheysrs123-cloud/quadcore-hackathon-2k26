"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { SceneLabel, hashRandom } from "@/components/visualizations/scene-kit";
import { KitPart } from "@/components/visualizations/lab-kit-model";
import {
  COIL,
  CORE,
  CORES,
  CURRENT_RANGE,
  EARTH_FIELD_T,
  EM_COLOURS,
  FILING_THRESHOLD_T,
  MAX_CLIPS,
  TURN_RANGE,
  coreField,
  airField,
  fieldAt,
  inFootprint,
  solveElectromagnet,
  traceFieldLine,
} from "@/lib/electromagnet";

// ─── The induction topic's third apparatus: an electromagnet ────────
// The bar-magnet rig's coil and bobbin, now driven by a bench supply, with a
// rod of soft iron or steel through it. The coil passes through a sheet of
// frosted acrylic at the height of its axis, the classic way to see a
// solenoid's field:
//
//   • iron filings on the sheet line up with the field where it is strong
//     enough (and drift loose again when it goes);
//   • plotting compasses follow it, and swing back to the Earth's north
//     when it is gone;
//   • field lines traced through it, out of the north end and round to the
//     south.
//
// Under the right-hand end a lab jack dips a dish of small steel clips up
// to the pole every few seconds; the chain it can hold hangs from it, and
// clips fall off the moment the field drops. A magnified inset shows the
// core's domains lining up, and, in steel, staying lined up.
//
// The numbers come from lib/electromagnet.js, which the Details panel reads.
// ─────────────────────────────────────────────────────────────────────

const AXIS_Y = 0.2;
const BENCH_TOP = -3.3;
/**
 * The acrylic sheet: its half-width in x, and its back and front edges in z.
 * It stops just in front of the coil, so it does not hide the clip test
 * hanging under the pole; the field's pattern is the same either side of the
 * axis, so the deeper back half shows all of it. It overhangs the back of the
 * bench, so its back posts stand in from its corners.
 */
const CARD = { x: 3.6, back: -2.8, front: 1.4 };

// The bobbin the coil is wound on, shared with the bar-magnet rig.
export const BOBBIN_HALF = COIL.half;
export const BOBBIN_BORE = 0.9;
export const BOBBIN_FLANGE = 1.18;

/**
 * The bobbin: a clear tube between two flanges, each on a post down to the
 * bench. Drawn in the coil's frame (axis along x at the origin).
 */
export function Bobbin({ postLength = 3.5 }) {
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
  return (
    <>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[BOBBIN_BORE, BOBBIN_BORE, BOBBIN_HALF * 2, 40, 1, true]} />
        <meshPhysicalMaterial color="#e2e8f0" transparent opacity={0.2} roughness={0.1} transmission={0.85} side={THREE.DoubleSide} />
      </mesh>
      {[-BOBBIN_HALF, BOBBIN_HALF].map((fx) => (
        <group key={fx}>
          <mesh geometry={flange} position={[fx, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh position={[fx, -(BOBBIN_FLANGE + postLength) / 2, 0]}>
            <cylinderGeometry args={[0.09, 0.09, postLength - BOBBIN_FLANGE, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ─── The winding ────────────────────────────────────────────────────

/** Loops drawn for N turns: each drawn loop stands for 25 turns. */
const TURNS_PER_LOOP = 25;
const loopsFor = (turns) => Math.max(4, Math.round(turns / TURNS_PER_LOOP));

/** A point on the drawn winding at angle `a`, anticlockwise seen from +x, starting at the bottom. */
function windingPoint(a, loops) {
  const length = 2 * (COIL.half - 0.08);
  const pitch = length / loops;
  return [-length / 2 + (a / (2 * Math.PI)) * pitch, -COIL.radius * Math.cos(a), -COIL.radius * Math.sin(a)];
}

function Winding({ loops, showCurrent, rate }) {
  const span = 2 * Math.PI * loops;
  const geometry = useMemo(() => {
    const steps = loops * 36;
    const pts = Array.from({ length: steps + 1 }, (_, i) => new THREE.Vector3(...windingPoint((i / steps) * span, loops)));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, 0.045, 8, false);
  }, [loops, span]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const dots = useRef(null);
  const count = Math.min(80, loops * 4);
  const phase = useRef(0);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, delta) => {
    const m = dots.current;
    if (!m) return;
    phase.current += Math.min(delta, 0.05) * rate;
    for (let i = 0; i < count; i += 1) {
      const a = ((((i / count) * span + phase.current) % span) + span) % span;
      o.position.set(...windingPoint(a, loops));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={EM_COLOURS.copper} emissive="#fb923c" emissiveIntensity={0.2} metalness={0.8} roughness={0.25} />
      </mesh>
      {showCurrent && (
        <instancedMesh ref={dots} args={[null, null, count]} key={count} frustumCulled={false}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color={EM_COLOURS.charge} emissive={EM_COLOURS.charge} emissiveIntensity={2.2} toneMapped={false} />
        </instancedMesh>
      )}
    </>
  );
}

// ─── The acrylic sheet, its filings and compasses ───────────────────

/** The sheet, with the coil's and the core's footprint cut out of it. */
function Card() {
  const geometry = useMemo(() => {
    // in the shape's own xy, which lies flat as (x, −y): its y is −z
    const { x: w, back, front } = CARD;
    const s = new THREE.Shape();
    s.moveTo(-w, -front);
    s.lineTo(w, -front);
    s.lineTo(w, -back);
    s.lineTo(-w, -back);
    s.lineTo(-w, -front);
    // the cut-out: the coil's rectangle and the core's, as one cross
    const cx = COIL.half + 0.06;
    const cz = 1.2;
    const rx = CORE.half + 0.03;
    const rz = CORE.radius + 0.03;
    const h = new THREE.Path();
    h.moveTo(-cx, -cz);
    h.lineTo(cx, -cz);
    h.lineTo(cx, -rz);
    h.lineTo(rx, -rz);
    h.lineTo(rx, rz);
    h.lineTo(cx, rz);
    h.lineTo(cx, cz);
    h.lineTo(-cx, cz);
    h.lineTo(-cx, rz);
    h.lineTo(-rx, rz);
    h.lineTo(-rx, -rz);
    h.lineTo(-cx, -rz);
    h.lineTo(-cx, -cz);
    s.holes.push(h);
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const { x: w, back, front } = CARD;
  return (
    <group>
      <mesh geometry={geometry} position={[0, -0.006, 0]} renderOrder={1}>
        <meshStandardMaterial color={EM_COLOURS.card} transparent opacity={0.24} roughness={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line
        points={[
          [-w, 0, back],
          [w, 0, back],
          [w, 0, front],
          [-w, 0, front],
          [-w, 0, back],
        ]}
        color="#e2e8f0"
        lineWidth={1.2}
        transparent
        opacity={0.6}
      />
      {/* clear posts at the corners hold the sheet up off the bench */}
      {[
        [-w + 0.2, -2.0],
        [w - 0.2, -2.0],
        [-w + 0.2, front - 0.2],
        [w - 0.2, front - 0.2],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, (BENCH_TOP - AXIS_Y) / 2 - 0.01, z]}>
          <cylinderGeometry args={[0.05, 0.05, AXIS_Y - BENCH_TOP - 0.02, 10]} />
          <meshStandardMaterial color="#e2e8f0" transparent opacity={0.35} roughness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

const SPRINGY = (raw) => Math.min(Math.max(raw, 1 / 120), 1 / 20);

/** Iron filings scattered over the sheet. Each lines up with the field where it is strong enough. */
function Filings({ field, speed }) {
  const ref = useRef(null);
  const filings = useMemo(() => {
    const out = [];
    const step = 0.125;
    const { x: w, back, front } = CARD;
    let i = 0;
    for (let x = -w + 0.08; x < w - 0.06; x += step) {
      for (let z = back + 0.08; z < front - 0.06; z += step) {
        i += 1;
        const px = x + (hashRandom(i * 1.3) - 0.5) * step;
        const pz = z + (hashRandom(i * 2.7 + 0.3) - 0.5) * step;
        if (inFootprint(px, pz, 0.05)) continue;
        const rest = hashRandom(i * 4.1 + 0.7) * Math.PI;
        out.push({ x: px, z: pz, rest, angle: rest, len: 0.75 + 0.5 * hashRandom(i * 5.9) });
      }
    }
    return out;
  }, []);
  // The field at each filing: its direction and how firmly it holds there.
  const targets = useMemo(
    () =>
      filings.map((f) => {
        const b = fieldAt(f.x, f.z, field);
        const m = Math.hypot(b.bx, b.bz);
        const t = Math.min(1, Math.max(0, (m - FILING_THRESHOLD_T * 0.5) / FILING_THRESHOLD_T));
        return { angle: Math.atan2(b.bz, b.bx), hold: t * t * (3 - 2 * t) };
      }),
    [filings, field],
  );
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    const dt = SPRINGY(raw) * speed;
    filings.forEach((f, i) => {
      const t = targets[i];
      // a filing has no head: it turns the short way to the field's line
      const goal = t.hold > 0.02 ? t.angle : f.rest;
      let diff = goal - f.angle;
      diff -= Math.PI * Math.round(diff / Math.PI);
      f.angle += diff * Math.min(1, dt * (t.hold > 0.02 ? 6 * t.hold : 0.8));
      o.position.set(f.x, 0.012, f.z);
      o.rotation.set(0, -f.angle, 0);
      o.scale.set(f.len, 1, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, filings.length]} frustumCulled={false}>
      <boxGeometry args={[0.1, 0.012, 0.014]} />
      <meshStandardMaterial color={EM_COLOURS.filing} roughness={0.55} metalness={0.5} />
    </instancedMesh>
  );
}

const COMPASS_SPOTS = [
  [-2.7, 0],
  [2.75, 0],
  [-2.55, 0.95],
  [2.55, 0.95],
  [-2.6, -1.5],
  [-1.3, -1.75],
  [0, -1.85],
  [1.3, -1.75],
  [2.6, -1.5],
  [-1.6, -2.45],
  [1.6, -2.45],
];

/** A plotting compass: its needle's north end follows the field (the Earth's north is −z). */
function Compass({ x, z, field, speed }) {
  const needle = useRef(null);
  const state = useRef({ angle: -Math.PI / 2, w: 0 });
  const goal = useMemo(() => {
    const b = fieldAt(x, z, field);
    return Math.atan2(b.bz - EARTH_FIELD_T, b.bx);
  }, [x, z, field]);
  useFrame((_, raw) => {
    const g = needle.current;
    if (!g) return;
    const dt = SPRINGY(raw) * speed;
    const s = state.current;
    // a damped needle: it overshoots a little and settles
    s.w += (40 * Math.sin(goal - s.angle) - 5 * s.w) * dt;
    s.angle += s.w * dt;
    g.rotation.y = -s.angle;
  });
  return (
    <group position={[x, 0.01, z]}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.06, 28]} />
        <meshStandardMaterial color="#b45309" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.19, 28]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </mesh>
      <group ref={needle} position={[0, 0.085, 0]}>
        {/* the north-seeking half, red, along +x of the needle */}
        <mesh position={[0.08, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.035, 0.16, 4]} />
          <meshStandardMaterial color={EM_COLOURS.needleN} emissive={EM_COLOURS.needleN} emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[-0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.035, 0.16, 4]} />
          <meshStandardMaterial color={EM_COLOURS.needleS} />
        </mesh>
      </group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.01, 28]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.12} roughness={0} />
      </mesh>
    </group>
  );
}

/**
 * Field lines on the sheet: out of the north end, round to the south.
 *
 * Traced from seeds round the north end on the back half, then mirrored:
 * the field is symmetric about the axis (z → −z) and, reversed, about the
 * middle of the coil (x → −x), so every mirror image is a true field line
 * too. Each is cut off where it leaves the sheet.
 */
const LINE_SEEDS = [
  [0.1, -0.1],
  [0.1, -0.3],
  [0.1, -0.48],
  [-0.05, -0.68],
  [-0.3, -0.68],
  [-0.65, -0.68],
  [-0.75, -1.3],
];

/** The first run of a polyline that stays on the sheet. */
function onSheet(pts) {
  const out = [];
  for (const p of pts) {
    if (p[1] > CARD.front || p[1] < CARD.back) break;
    out.push(p);
  }
  return out;
}

function FieldLines({ field, north }) {
  const lines = useMemo(() => {
    if (!north) return [];
    const sgn = north === "right" ? 1 : -1;
    const end = CORE.half;
    const traced = LINE_SEEDS.map(([dx, z]) => traceFieldLine(sgn * (end + dx), z, field, { bounds: [CARD.x, CARD.back, -CARD.back] }));
    const out = [];
    for (const pts of traced) {
      if (pts.length < 6) continue;
      const mz = pts.map(([x, z]) => [x, -z]);
      out.push(pts, mz, [...pts].reverse().map(([x, z]) => [-x, z]), [...mz].reverse().map(([x, z]) => [-x, z]));
    }
    return out
      .map(onSheet)
      .filter((pts) => pts.length > 5)
      .map((pts) => {
        const mid = Math.floor(pts.length * 0.5);
        const [ax, az] = pts[mid];
        const [bx, bz] = pts[Math.min(mid + 1, pts.length - 1)];
        return { points: pts.map(([x, z]) => [x, 0.02, z]), at: [ax, 0.03, az], angle: Math.atan2(bz - az, bx - ax) };
      });
  }, [field, north]);
  return lines.map((l, i) => (
    <group key={i}>
      <Line points={l.points} color={EM_COLOURS.fieldLine} lineWidth={1.6} transparent opacity={0.75} />
      <mesh position={l.at} rotation={[0, -l.angle, -Math.PI / 2]}>
        <coneGeometry args={[0.06, 0.18, 10]} />
        <meshStandardMaterial color={EM_COLOURS.fieldLine} emissive={EM_COLOURS.fieldLine} emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
    </group>
  ));
}

// ─── The clip test ──────────────────────────────────────────────────

/** A small steel paper clip, 0.56 long, in its own xy plane, hanging from its top. */
function useClipGeometry() {
  const geometry = useMemo(() => {
    const p = [
      [0.025, -0.06],
      [0.025, 0.15],
      [0.0, 0.18],
      [-0.025, 0.15],
      [-0.025, -0.17],
      [0.0, -0.2],
      [0.045, -0.17],
      [0.045, 0.19],
      [0.0, 0.23],
      [-0.048, 0.19],
      [-0.048, 0.02],
    ].map(([x, y]) => new THREE.Vector3(x * CLIP_SCALE, (y - 0.23) * CLIP_SCALE, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p, false, "catmullrom", 0.3), 96, 0.016, 6, false);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

const CLIP_SCALE = 1.3;
const CLIP_LENGTH = 0.43 * CLIP_SCALE;
const CLIP_PITCH = 0.44;
const DISH_R = 0.5;
const JACK_LOW = 0.32;
const JACK_HIGH = 2.72;
// the jack's cycle, in seconds at speed 1
const CYCLE = { rest: 3.2, rise: 1.4, hold: 0.7, lower: 1.6 };
const CYCLE_T = CYCLE.rest + CYCLE.rise + CYCLE.hold + CYCLE.lower;

/** The jack's height at time t into its cycle. */
function jackHeight(t) {
  const ease = (u) => u * u * (3 - 2 * u);
  if (t < CYCLE.rest) return JACK_LOW;
  t -= CYCLE.rest;
  if (t < CYCLE.rise) return JACK_LOW + (JACK_HIGH - JACK_LOW) * ease(t / CYCLE.rise);
  t -= CYCLE.rise;
  if (t < CYCLE.hold) return JACK_HIGH;
  t -= CYCLE.hold;
  return JACK_HIGH - (JACK_HIGH - JACK_LOW) * ease(Math.min(1, t / CYCLE.lower));
}

/** A three-stage scissor jack whose top plate is `h` above the bench. */
function ScissorJack({ heightRef }) {
  const top = useRef(null);
  const arms = useRef([]);
  const L = 1.0;
  useFrame(() => {
    const h = heightRef.current;
    if (top.current) top.current.position.y = h;
    const stage = (h - 0.12) / 3;
    const ang = Math.asin(Math.min(0.99, stage / L));
    arms.current.forEach((a, j) => {
      if (!a) return;
      // six arms a side: two crossed per stage
      const i = Math.floor(j / 2);
      a.position.y = 0.08 + stage * (Math.floor(i / 2) + 0.5);
      a.rotation.z = i % 2 ? ang : -ang;
    });
  });
  return (
    <group>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.3, 0.08, 0.9]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.35} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) =>
        [-0.38, 0.38].map((z, side) => (
          <mesh
            key={`${i}-${z}`}
            ref={(el) => {
              arms.current[i * 2 + side] = el;
            }}
            position={[0, 0.5, z]}
          >
            <boxGeometry args={[L, 0.05, 0.04]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          </mesh>
        )),
      )}
      <group ref={top}>
        <mesh position={[0, -0.04, 0]}>
          <boxGeometry args={[1.3, 0.08, 0.9]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The jack, its dish of clips and the chain hanging from the pole. `target`
 * is how many the pole can hold; a dip to the pole tops the chain up to it,
 * and clips fall off at once when it drops.
 */
function ClipTest({ target, poleX, speed }) {
  const clip = useClipGeometry();
  const height = useRef(JACK_LOW);
  const clock = useRef(0);
  const [held, setHeld] = useState(target);
  const heldRef = useRef(target);
  const slots = useRef([]);
  const falling = useRef([]);
  const pile = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const r = Math.sqrt(hashRandom(i * 3.1 + 0.2)) * (DISH_R - 0.15);
        const a = hashRandom(i * 7.7) * Math.PI * 2;
        return { x: r * Math.cos(a), z: r * Math.sin(a), turn: hashRandom(i * 1.9) * Math.PI * 2, y: 0.03 + (i % 3) * 0.014 };
      }),
    [],
  );
  const dish = useRef(null);
  const topY = AXIS_Y - CORE.radius;

  // fewer than it holds: the extra clips drop off now
  useEffect(() => {
    if (target < heldRef.current) {
      for (let k = target; k < heldRef.current; k += 1) falling.current[k] = { y: topY - CLIP_PITCH * k, v: 0 };
      heldRef.current = target;
      setHeld(target);
    }
  }, [target, topY]);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05) * speed;
    clock.current = (clock.current + dt) % CYCLE_T;
    const h = jackHeight(clock.current);
    height.current = h;
    const floor = BENCH_TOP + h + 0.05;
    if (dish.current) dish.current.position.y = floor - 0.05;
    // at the top of the dip the chain is topped up from the dish
    const atTop = clock.current > CYCLE.rest + CYCLE.rise && clock.current < CYCLE.rest + CYCLE.rise + CYCLE.hold;
    if (atTop && heldRef.current < target) {
      heldRef.current = target;
      setHeld(target);
    }
    const sway = Math.sin(state.clock.elapsedTime * 1.3) * 0.05;
    slots.current.forEach((m, k) => {
      if (!m) return;
      const f = falling.current[k];
      if (k < heldRef.current) {
        const y = topY - CLIP_PITCH * k;
        // a clip that the risen dish reaches lies in it instead
        const inDish = y - CLIP_LENGTH < floor + 0.04;
        m.visible = true;
        if (inDish) {
          m.position.set(poleX + (hashRandom(k * 2.3) - 0.5) * 0.4, floor + 0.04 + k * 0.012, (hashRandom(k * 4.4) - 0.5) * 0.4);
          m.rotation.set(-Math.PI / 2, 0, hashRandom(k * 6.1) * 6);
        } else {
          m.position.set(poleX + sway * k * 0.3, y, 0);
          m.rotation.set(0, k % 2 ? Math.PI / 2 : 0, sway * 0.4);
        }
      } else if (f) {
        f.v -= 9.8 * dt;
        f.y += f.v * dt;
        if (f.y - CLIP_LENGTH < floor) {
          falling.current[k] = null;
          m.visible = false;
        } else {
          m.visible = true;
          m.position.set(poleX, f.y, 0);
          m.rotation.z += dt * 4;
        }
      } else m.visible = false;
    });
  });

  return (
    <group>
      <group position={[poleX, BENCH_TOP, 0]}>
        <ScissorJack heightRef={height} />
      </group>
      <group ref={dish} position={[poleX, BENCH_TOP + JACK_LOW, 0]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[DISH_R, DISH_R, 0.03, 36]} />
          <meshPhysicalMaterial color="#e2e8f0" transparent opacity={0.35} roughness={0.05} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[DISH_R, DISH_R, 0.16, 36, 1, true]} />
          <meshPhysicalMaterial color="#e2e8f0" transparent opacity={0.22} roughness={0.05} side={THREE.DoubleSide} />
        </mesh>
        {pile.map((p, i) => (
          <mesh key={i} geometry={clip} position={[p.x, p.y, p.z]} rotation={[-Math.PI / 2, 0, p.turn]}>
            <meshStandardMaterial color={EM_COLOURS.clip} metalness={0.55} roughness={0.3} />
          </mesh>
        ))}
      </group>
      {Array.from({ length: MAX_CLIPS }, (_, k) => (
        <mesh
          key={k}
          geometry={clip}
          ref={(el) => {
            slots.current[k] = el;
          }}
          visible={false}
        >
          <meshStandardMaterial color={EM_COLOURS.clip} metalness={0.55} roughness={0.3} />
        </mesh>
      ))}
      <SceneLabel position={[poleX + 0.95, -1.4, 0.3]} tone={held > 0 ? "text-ink-200" : "text-ink-500"}>
        {held > 0 ? `holds ${held} clip${held === 1 ? "" : "s"}` : "holds none"}
      </SceneLabel>
    </group>
  );
}

// ─── The core and its domains ───────────────────────────────────────

function CoreRod({ core, north }) {
  const c = CORES[core];
  if (!c?.colour) return null;
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[CORE.radius, CORE.radius, CORE.half * 2, 36]} />
        <meshStandardMaterial color={c.colour} metalness={0.75} roughness={core === "steel" ? 0.22 : 0.45} />
      </mesh>
      {[-1, 1].map((s) => {
        const isN = north && (north === "right") === s > 0;
        const isS = north && !isN;
        return (
          <mesh key={s} position={[s * (CORE.half + 0.003), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[CORE.radius * 0.98, 36]} />
            <meshStandardMaterial
              color={c.colour}
              emissive={isN ? EM_COLOURS.north : isS ? EM_COLOURS.south : "#000000"}
              emissiveIntensity={isN || isS ? 0.35 : 0}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** A magnified block of the core: its domains, random until a field lines them up. */
function DomainInset({ fraction, sign, core, speed }) {
  const COLS = 7;
  const ROWS = 4;
  const ref = useRef(null);
  const arrows = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => ({
        x: (i % COLS) - (COLS - 1) / 2,
        y: Math.floor(i / COLS) - (ROWS - 1) / 2,
        rest: hashRandom(i * 3.7 + 1.1) * Math.PI * 2,
        rank: hashRandom(i * 9.1 + 0.5),
        angle: hashRandom(i * 3.7 + 1.1) * Math.PI * 2,
      })),
    [],
  );
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(raw, 0.05) * speed;
    arrows.forEach((a, i) => {
      // the share that has turned is the core's magnetisation
      const along = a.rank < fraction;
      const goal = along ? (sign >= 0 ? 0 : Math.PI) : a.rest;
      let diff = goal - a.angle;
      diff -= 2 * Math.PI * Math.round(diff / (2 * Math.PI));
      a.angle += diff * Math.min(1, dt * 3);
      o.position.set(a.x * 0.24, a.y * 0.24, 0.02);
      o.rotation.set(0, 0, a.angle - Math.PI / 2);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  const geometry = useMemo(() => {
    const shaft = new THREE.BoxGeometry(0.03, 0.12, 0.02);
    shaft.translate(0, -0.03, 0);
    const head = new THREE.ConeGeometry(0.05, 0.08, 3);
    head.translate(0, 0.07, 0);
    const merged = mergeTwo(shaft, head);
    shaft.dispose();
    head.dispose();
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh>
        <planeGeometry args={[COLS * 0.24 + 0.16, ROWS * 0.24 + 0.16]} />
        <meshStandardMaterial color={CORES[core].colour} metalness={0.4} roughness={0.6} />
      </mesh>
      <instancedMesh ref={ref} args={[geometry, null, arrows.length]} frustumCulled={false}>
        <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={0.5} />
      </instancedMesh>
      <SceneLabel position={[0, ROWS * 0.12 + 0.28, 0]} tone="text-ink-300">
        {`inside the ${CORES[core].label.toLowerCase()} · domains, magnified`}
      </SceneLabel>
    </group>
  );
}

/** Two non-indexed or indexed geometries as one (position and normal only). */
function mergeTwo(a, b) {
  const A = a.index ? a.toNonIndexed() : a;
  const B = b.index ? b.toNonIndexed() : b;
  const g = new THREE.BufferGeometry();
  for (const name of ["position", "normal"]) {
    const x = A.getAttribute(name);
    const y = B.getAttribute(name);
    const arr = new Float32Array(x.array.length + y.array.length);
    arr.set(x.array, 0);
    arr.set(y.array, x.array.length);
    g.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  if (A !== a) A.dispose();
  if (B !== b) B.dispose();
  return g;
}

// ─── The supply ─────────────────────────────────────────────────────

const SUPPLY = { x: -4.45, z: 0.95, h: 1.45, d: 1.7, turn: 0.3 };
const SUPPLY_Y = BENCH_TOP + SUPPLY.h / 2 + 0.06;
const POSTS = { neg: [-0.55, -0.42], pos: [-0.1, -0.42] };

/** Where a supply post is in the scene. */
function postWorld([px, py]) {
  const v = new THREE.Vector3(px, py, SUPPLY.d / 2 + 0.12).applyEuler(new THREE.Euler(0, SUPPLY.turn, 0));
  return [SUPPLY.x + v.x, SUPPLY_Y + v.y, SUPPLY.z + v.z];
}

function BenchSupply({ current, on }) {
  const turn = -2.3 + ((current - CURRENT_RANGE[0]) / (CURRENT_RANGE[1] - CURRENT_RANGE[0])) * 4.6;
  const front = SUPPLY.d / 2;
  return (
    <group position={[SUPPLY.x, SUPPLY_Y, SUPPLY.z]} rotation={[0, SUPPLY.turn, 0]}>
      <Suspense fallback={null}>
        <KitPart name="psuCase" />
        <KitPart name="psuTrim" />
        <KitPart name="psuPostBrass" />
        <KitPart name="psuPostCaps" />
        <group position={[0.72, 0.28, front + 0.03]} rotation={[0, 0, -turn]}>
          <KitPart name="psuKnob" />
        </group>
      </Suspense>
      <mesh position={[-0.3, 0.3, front + 0.012]}>
        <planeGeometry args={[1.22, 0.46]} />
        <meshStandardMaterial color="#0b1a12" emissive={on ? "#16a34a" : "#0b1a12"} emissiveIntensity={on ? 0.35 : 0} roughness={0.2} />
      </mesh>
      <SceneLabel position={[-0.3, 0.3, front + 0.04]} tone={on ? "text-emerald-300" : "text-ink-500"}>
        {on ? `${current.toFixed(2)} A` : "OFF"}
      </SceneLabel>
      <mesh position={[0.72, -0.12, front + 0.02]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color={on ? "#22c55e" : "#3f1d1d"} emissive={on ? "#22c55e" : "#000000"} emissiveIntensity={on ? 2 : 0} toneMapped={false} />
      </mesh>
      <SceneLabel position={[0, -1.0, front]} tone="text-ink-400">
        DC supply
      </SceneLabel>
    </group>
  );
}

// ─── The rig ────────────────────────────────────────────────────────

/**
 * Field strength at max settings for a core, used to say how far its
 * domains have turned: the share of its full magnetisation it has now.
 */
const fullMagnetisation = (core) => {
  const air = airField(TURN_RANGE[1], CURRENT_RANGE[1]);
  return Math.abs(coreField(air, core) - air) || 1;
};

export function ElectromagnetRig({ params = {}, setParam }) {
  const {
    speed = 1,
    emTurns = 300,
    coilCurrent = 1.5,
    core = "softIron",
    reverseCurrent = false,
    supplyOn = true,
    showFieldLines = true,
    showCurrent = true,
  } = params || {};
  const coreKey = CORES[core] ? core : "softIron";

  // What the core kept the last time the current changed: history, so the
  // scene holds it, and hands it to the Details panel as liveRetained.
  // It belongs to one rod: a fresh rod of another material starts unmagnetised.
  const [memory, setMemory] = useState({ core: coreKey, value: 0 });
  const retained = memory.core === coreKey ? memory.value : 0;
  const solved = useMemo(
    () => solveElectromagnet({ turns: emTurns, current: coilCurrent, reverse: reverseCurrent, core: coreKey, on: supplyOn, retained }),
    [emTurns, coilCurrent, reverseCurrent, coreKey, supplyOn, retained],
  );
  useEffect(() => {
    if (memory.core !== coreKey || Math.abs(solved.retainedNext - memory.value) > 1e-9) setMemory({ core: coreKey, value: solved.retainedNext });
  }, [solved.retainedNext, memory, coreKey]);
  useEffect(() => {
    setParam?.("liveRetained", Math.round(retained * 1e6) / 1e6);
  }, [retained, setParam]);

  const field = useMemo(() => ({ airT: solved.airT, centreT: solved.centreT, core: coreKey }), [solved.airT, solved.centreT, coreKey]);

  // Conventional current round the winding: + runs the way it is wound.
  const rate = supplyOn ? (reverseCurrent ? -1 : 1) * (0.6 + 1.6 * solved.current) * speed : 0;

  const loops = loopsFor(solved.turns);
  const span = 2 * Math.PI * loops;
  const start = windingPoint(0, loops);
  const finish = windingPoint(span, loops);
  // The leads: + to the winding's start makes current run the way it is wound.
  const plus = postWorld(POSTS.pos);
  const minus = postWorld(POSTS.neg);
  const lead = (from, end, side) => [
    [from[0], AXIS_Y + from[1], from[2]],
    [from[0], -1.2, 0.05],
    [side * 0.45, -1.6, 0.6],
    [side * 0.45, BENCH_TOP + 0.02, 1.35],
    [end[0] + 0.3, BENCH_TOP + 0.02, end[2] + 0.2],
    end,
  ];
  const toStart = reverseCurrent ? minus : plus;
  const toFinish = reverseCurrent ? plus : minus;

  // The clips hang from the core's end (with no core the coil is too weak to hold one).
  const poleX = CORE.half - 0.14;
  const magnetisation = solved.centreT - solved.airT;
  const domainShare = Math.min(1, Math.abs(magnetisation) / fullMagnetisation(coreKey));
  const end = CORES[coreKey].colour ? CORE.half : COIL.half + 0.1;

  return (
    <>
      <group position={[0, AXIS_Y, 0]}>
        <Bobbin postLength={AXIS_Y - BENCH_TOP} />
        <CoreRod core={coreKey} north={solved.north} />
        <Winding loops={loops} showCurrent={showCurrent && supplyOn && solved.current > 0} rate={rate} />
        <Card />
        <Filings field={field} speed={speed} />
        {COMPASS_SPOTS.map(([x, z]) => (
          <Compass key={`${x},${z}`} x={x} z={z} field={field} speed={speed} />
        ))}
        {showFieldLines && <FieldLines field={field} north={solved.north} />}

        {solved.north && (
          <>
            <SceneLabel position={[(solved.north === "right" ? 1 : -1) * (end + 0.35), 0.55, 0]} tone="text-rose-300">
              N
            </SceneLabel>
            <SceneLabel position={[(solved.north === "right" ? -1 : 1) * (end + 0.35), 0.55, 0]} tone="text-sky-300">
              S
            </SceneLabel>
          </>
        )}
        <SceneLabel position={[0, 1.55, 0]} tone="text-ink-300">
          {`${solved.turns} turns${CORES[coreKey].colour ? ` · ${CORES[coreKey].label.toLowerCase()} core` : " · no core"}`}
        </SceneLabel>
        <SceneLabel position={[0, 0.05, CARD.back - 0.25]} tone="text-ink-500">
          Earth&apos;s north ↑ · compasses point here with no current
        </SceneLabel>
        <SceneLabel position={[-CARD.x + 1.1, 0.05, CARD.front + 0.2]} tone="text-ink-500">
          acrylic sheet · iron filings
        </SceneLabel>
      </group>

      <ClipTest target={solved.clips} poleX={poleX} speed={speed} />

      {CORES[coreKey].colour && (
        <group position={[-2.1, 2.05, -1.7]} rotation={[-0.3, 0.12, 0]}>
          <DomainInset fraction={domainShare} sign={Math.sign(magnetisation)} core={coreKey} speed={speed} />
        </group>
      )}

      <Line points={lead(start, toStart, -1)} color={reverseCurrent ? EM_COLOURS.leadNeg : EM_COLOURS.leadPos} lineWidth={2.2} />
      <Line points={lead(finish, toFinish, 1)} color={reverseCurrent ? EM_COLOURS.leadPos : EM_COLOURS.leadNeg} lineWidth={2.2} />
      <BenchSupply current={solved.current} on={supplyOn} />

      {solved.permanent && (
        <SceneLabel position={[0, 3.5, 0]} tone="text-amber-300">
          {coreKey === "steel" && solved.clips > 0
            ? "current off · the steel stays magnetised: a permanent magnet"
            : "current off · the core keeps only a trace of magnetism"}
        </SceneLabel>
      )}
      {!supplyOn && !solved.permanent && (
        <SceneLabel position={[0, 3.5, 0]} tone="text-ink-300">
          current off · no field: the compasses swing back to north
        </SceneLabel>
      )}
    </>
  );
}
