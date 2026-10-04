"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { FitCamera, LabelsOn, NoLabel, SceneCanvas, SceneLabel, clamp, hashRandom } from "@/components/visualizations/scene-kit";
import { KitPart, LAB_KIT } from "@/components/visualizations/lab-kit-model";
import { ConicalFlask, FLASK, LabBench, RetortStand } from "@/components/visualizations/lab-bench";
import { TestTube, VesselRack, slotX } from "@/components/visualizations/vessel-rack";
import {
  ACIDS,
  BASES,
  BURETTE_VOLUME,
  CLEAR,
  DROP,
  FLASK_VOLUME,
  INDICATORS,
  SUBSTANCES,
  SUBSTANCE_KEYS,
  ACID_BASE_COLOURS,
  titrationSetup,
  equivalenceVolume,
  indicatorColour,
  particleCounts,
  titrationCurve,
  titrationPoint,
} from "@/lib/acidBase";

// ─── Acids, bases and titration ─────────────────────────────────────
// Two modes, one bench:
//
//   SCALE      eleven everyday solutions in a rack of test tubes, each
//              coloured by the chosen indicator, under a pH scale drawn in
//              that indicator's own colours, so it shows where each one
//              changes. The chosen solution is picked out and tied to its
//              place on the scale.
//
//   TITRATION  a 50 cm³ burette on a retort stand over a conical flask on a
//              magnetic stirrer, with a pH electrode in the flask on the
//              meter's electrode arm. Open the tap (dropwise or full) and
//              the alkali runs in: the meniscus falls down the graduations,
//              the flask takes the indicator's colour (near the end point
//              each drop flashes it for a moment before the stirring wipes
//              it out), the meter reads the pH, and the curve draws itself
//              beside the bench with its equivalence point, buffer region
//              and the indicator's colour-change band. A magnified view
//              shows the ions: OH⁻ meeting H⁺ to make water.
//
// The burette, its stopcock and clamp, the stirrer, the meter, the
// electrode and the dropper bottle are the lab kit's (modelled in Blender,
// scripts/labkit-model/titration.py). The chemistry is lib/acidBase.js,
// which the Details panel reads too.
// ─────────────────────────────────────────────────────────────────────

const BU = LAB_KIT.burette;
const ST = LAB_KIT.stirrer;
const PM = LAB_KIT.phMeter;

/** The burette is drawn at three-quarters size, so the stand fits one view. */
const BURETTE_SCALE = 0.75;
const FLASK_TOP = ST.top + FLASK.bodyHeight + FLASK.neckHeight + 0.05;
/** The burette's jet, a little way down inside the flask's neck. */
const BURETTE_AT = [-0.14, FLASK_TOP - 0.3, 0];
/** Scene y of a point `y` up the burette's own frame. */
const buretteY = (y) => BURETTE_AT[1] + y * BURETTE_SCALE;
/** Where the meniscus stands with `v` cm³ run out. */
const meniscusY = (v) => buretteY(BU.zeroY - v * BU.perCm3);

const STAND_AT = [-2.0, 0, -0.8];
const CLAMP_Y = buretteY(9.6);
/** The arm from the stand's rod to the burette clamp. */
const ARM = (() => {
  const dx = BURETTE_AT[0] - STAND_AT[0];
  const dz = BURETTE_AT[2] - STAND_AT[2];
  const len = Math.hypot(dx, dz);
  return { angle: -Math.atan2(dz, dx), reach: len - BU.clampAxisX * BURETTE_SCALE };
})();

/** The electrode: slimmed to a micro electrode, its bulb just off the flask's floor. */
const PROBE_SCALE = [0.45, 1, 0.45];
const PROBE_AT = [0.18, ST.top + 0.08, 0];
const PROBE_TOP = PROBE_AT[1] + LAB_KIT.phProbe.length;
const METER_AT = [2.45, 0, 0.35];
/** The meter's BNC socket, where the electrode's cable plugs in. */
const SOCKET = [METER_AT[0] + PM.socket[0], PM.socket[1], METER_AT[2] + PM.d / 2 + 0.06];
const DROPPER_AT = [-2.1, 0, 1.25];

/** The flask's inner radius at height h above its floor (scene units), as ConicalFlask draws it. */
const flaskRadius = (h) => {
  const r0 = FLASK.baseRadius - 0.05;
  const r1 = FLASK.neckRadius * 1.15 - 0.04;
  return r0 + (r1 - r0) * clamp(h / FLASK.bodyHeight, 0, 1);
};
/** Depth of `cm3` of liquid in the flask, scene units (1 cm = 0.2). */
function flaskDepth(cm3) {
  let h = 0;
  let vol = 0;
  const dh = 0.002;
  while (vol < cm3 && h < FLASK.bodyHeight) {
    const r = flaskRadius(h) / 0.2;
    vol += Math.PI * r * r * (dh / 0.2);
    h += dh;
  }
  return h;
}

const GRAPH = { x0: 4.1, y0: 2.0, w: 6.4, h: 5.0, z: -0.7 };
const gx = (v) => GRAPH.x0 + (v / BURETTE_VOLUME) * GRAPH.w;
const gy = (pH) => GRAPH.y0 + (clamp(pH, 0, 14) / 14) * GRAPH.h;

const INSET = { at: [-5.0, 5.3, 0], r: 1.55 };

const TAP_RATE = { closed: 0, dropwise: 2.5 * DROP, open: 0.8 };

// ─── The burette ────────────────────────────────────────────────────

/** The alkali inside the burette: the jet, and the column up to the meniscus. */
function BuretteLiquid({ volumeRef }) {
  const column = useRef(null);
  const meniscus = useRef(null);
  const bore = BU.bore * BURETTE_SCALE * 0.96;
  useFrame(() => {
    const v = volumeRef.current;
    const top = meniscusY(v);
    const bottom = buretteY(2.3);
    const h = Math.max(top - bottom, 0.001);
    if (column.current) {
      column.current.position.y = (top + bottom) / 2;
      column.current.scale.y = h;
      column.current.visible = v < BURETTE_VOLUME - 0.01;
    }
    if (meniscus.current) {
      meniscus.current.position.y = top;
      meniscus.current.visible = v < BURETTE_VOLUME - 0.01;
    }
  });
  return (
    <group position={[BURETTE_AT[0], 0, BURETTE_AT[2]]}>
      <mesh ref={column}>
        <cylinderGeometry args={[bore, bore, 1, 20, 1, true]} />
        <meshStandardMaterial color={CLEAR} transparent opacity={0.4} roughness={0.1} depthWrite={false} />
      </mesh>
      {/* the meniscus: the bottom of the curve is what is read */}
      <mesh ref={meniscus}>
        <sphereGeometry args={[bore, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.55} roughness={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* the jet below the stopcock stays full */}
      <mesh position={[0, buretteY(0.6), 0]}>
        <cylinderGeometry args={[0.018, 0.012, 1.15 * BURETTE_SCALE, 10]} />
        <meshStandardMaterial color={CLEAR} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh position={[0, buretteY(1.9), 0]}>
        <cylinderGeometry args={[0.03, 0.025, 1.1 * BURETTE_SCALE, 10]} />
        <meshStandardMaterial color={CLEAR} transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Burette({ volumeRef, tap, showLabels }) {
  const key = useRef(null);
  useFrame((_, raw) => {
    if (!key.current) return;
    // the key's grip is vertical when open, across when shut, half-way for drops
    const goal = tap === "open" ? 0 : tap === "dropwise" ? 1.15 : Math.PI / 2;
    key.current.rotation.x += (goal - key.current.rotation.x) * Math.min(1, raw * 8);
  });
  const Label = showLabels ? SceneLabel : NoLabel;
  return (
    <>
      <group position={BURETTE_AT} scale={BURETTE_SCALE}>
        <Suspense fallback={null}>
          <KitPart name="buretteMarks" />
          <KitPart name="buretteGlass" />
          <group ref={key} position={[0, BU.stopcockY, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <KitPart name="stopcockKey" />
          </group>
        </Suspense>
      </group>
      <BuretteLiquid volumeRef={volumeRef} />
      <Label position={[BURETTE_AT[0] - 0.75, buretteY(BU.stopcockY), 0]} tone="text-ink-300">
        {tap === "open" ? "tap open" : tap === "dropwise" ? "tap: drop by drop" : "tap closed"}
      </Label>
    </>
  );
}

/** Drops (or a stream) from the jet to the surface, and the flashes they make. */
function Delivery({ tap, speed, surfaceRef, flashRef }) {
  const COUNT = 6;
  const drops = useRef(null);
  const stream = useRef(null);
  const state = useMemo(() => Array.from({ length: COUNT }, () => ({ live: false, y: 0, v: 0 })), []);
  const clock = useRef(0);
  const o = useMemo(() => new THREE.Object3D(), []);
  const flash = useRef(null);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05) * speed;
    const top = BURETTE_AT[1] - 0.01;
    const surface = surfaceRef.current;
    if (tap === "dropwise") {
      clock.current += dt;
      if (clock.current > DROP / TAP_RATE.dropwise) {
        clock.current = 0;
        const s = state.find((x) => !x.live);
        if (s) Object.assign(s, { live: true, y: top, v: 0 });
      }
    }
    state.forEach((s, i) => {
      if (s.live) {
        s.v += 9.8 * 0.5 * dt;
        s.y -= s.v * dt;
        if (s.y <= surface) {
          s.live = false;
          flashRef.current.splash = 1;
        }
      }
      o.position.set(BURETTE_AT[0], s.y, BURETTE_AT[2]);
      o.scale.set(1, 1.3, 1);
      o.scale.multiplyScalar(s.live ? 1 : 0);
      o.updateMatrix();
      drops.current?.setMatrixAt(i, o.matrix);
    });
    if (drops.current) drops.current.instanceMatrix.needsUpdate = true;
    if (stream.current) {
      stream.current.visible = tap === "open";
      const h = Math.max(top - surface, 0.01);
      stream.current.position.y = (top + surface) / 2;
      stream.current.scale.y = h;
      if (tap === "open") flashRef.current.splash = 1;
    }
    // the splash: the colour the drop makes where it lands, fading as it stirs in
    const f = flashRef.current;
    f.splash = Math.max(0, f.splash - dt * 1.2);
    if (flash.current) {
      flash.current.position.y = surface + 0.004;
      flash.current.material.color.set(f.colour);
      flash.current.material.opacity = f.splash * f.strength * 0.85;
      flash.current.visible = f.splash > 0.02 && f.strength > 0.02;
    }
  });
  return (
    <>
      <instancedMesh ref={drops} args={[null, null, COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshStandardMaterial color={CLEAR} transparent opacity={0.7} roughness={0.05} />
      </instancedMesh>
      <mesh ref={stream} position={[BURETTE_AT[0], 0, BURETTE_AT[2]]} visible={false}>
        <cylinderGeometry args={[0.012, 0.016, 1, 8]} />
        <meshStandardMaterial color={CLEAR} transparent opacity={0.55} />
      </mesh>
      <mesh ref={flash} position={[BURETTE_AT[0] + 0.05, 0, BURETTE_AT[2]]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[0.28, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

// ─── The stirrer, the meter and the electrode ───────────────────────

function Stirrer({ speed, running }) {
  const bar = useRef(null);
  useFrame((_, raw) => {
    if (bar.current && running) bar.current.rotation.y += Math.min(raw, 0.05) * 9 * speed;
  });
  return (
    <group>
      <Suspense fallback={null}>
        <KitPart name="stirrerCase" />
        <KitPart name="stirrerTop" />
        <group ref={bar} position={[0, ST.top + 0.08, 0]} scale={0.4}>
          <KitPart name="stirBar" />
        </group>
      </Suspense>
      {running && (
        <mesh position={[0.55, 0.3, ST.d / 2 + 0.05]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function PHMeter({ pHRef, showLabels }) {
  const [shown, setShown] = useState(null);
  const clock = useRef(0);
  useFrame((_, raw) => {
    clock.current += raw;
    if (clock.current < 0.15) return;
    clock.current = 0;
    const v = Math.round(pHRef.current * 100) / 100;
    if (v !== shown) setShown(v);
  });
  const [dx, dy] = PM.display;
  const front = PM.d / 2;
  const socket = SOCKET;
  const cable = useMemo(() => {
    const top = [PROBE_AT[0], PROBE_TOP + 0.02, PROBE_AT[2]];
    const c = new THREE.CatmullRomCurve3([top, [top[0] + 0.15, top[1] + 0.45, top[2]], [1.4, 3.2, 0.35], [socket[0] - 0.1, 1.1, socket[2] + 0.35], [socket[0], socket[1], socket[2] + 0.05]].map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(c, 60, 0.02, 6, false);
  }, [socket]);
  useEffect(() => () => cable.dispose(), [cable]);
  const Label = showLabels ? SceneLabel : NoLabel;
  return (
    <>
      <group position={METER_AT}>
        <Suspense fallback={null}>
          <KitPart name="phMeter" />
        </Suspense>
        <mesh position={[dx, dy, front + 0.03]}>
          <planeGeometry args={[PM.display[2], PM.display[3]]} />
          <meshStandardMaterial color="#0c1a14" emissive="#16a34a" emissiveIntensity={0.3} roughness={0.2} />
        </mesh>
        <SceneLabel position={[dx, dy, front + 0.06]} tone="text-emerald-300">
          {shown === null ? "—" : `pH ${shown.toFixed(2)}`}
        </SceneLabel>
        {/* the electrode arm: a post at the meter's back corner and an arm out over the flask */}
        <mesh position={[-PM.w / 2 + 0.1, 1.8, -0.35]}>
          <cylinderGeometry args={[0.035, 0.035, 3.3, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />
        </mesh>
        <Label position={[0, -0.25, front + 0.2]} tone="text-ink-400">
          pH meter
        </Label>
      </group>
      {(() => {
        const a = [METER_AT[0] - PM.w / 2 + 0.1, PROBE_TOP - 0.18, METER_AT[2] - 0.35];
        const b = [PROBE_AT[0] + 0.07, PROBE_TOP - 0.18, PROBE_AT[2]];
        const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
        return (
          <group position={[(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2]} rotation={[0, -Math.atan2(b[2] - a[2], b[0] - a[0]), 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, len, 10]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />
            </mesh>
            <mesh position={[-len / 2 - 0.05, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.075, 0.018, 8, 20]} />
              <meshStandardMaterial color="#334155" roughness={0.5} />
            </mesh>
          </group>
        );
      })()}
      <group position={PROBE_AT} scale={PROBE_SCALE}>
        <Suspense fallback={null}>
          <KitPart name="phProbe" />
          <KitPart name="phProbeBulb" />
        </Suspense>
      </group>
      <mesh geometry={cable}>
        <meshStandardMaterial color="#1f2937" roughness={0.6} />
      </mesh>
    </>
  );
}

// ─── The magnified view of the flask ────────────────────────────────

const ION_STYLE = {
  hydrogen: { colour: ACID_BASE_COLOURS.hydrogen, r: 0.085 },
  hydroxide: { colour: ACID_BASE_COLOURS.hydroxide, r: 0.085 },
  cation: { colour: ACID_BASE_COLOURS.cation, r: 0.065 },
  anion: { colour: ACID_BASE_COLOURS.anion, r: 0.08 },
  partAnion: { colour: ACID_BASE_COLOURS.partAnion, r: 0.08 },
  acidMolecule: { colour: ACID_BASE_COLOURS.acidMolecule, r: 0.1 },
  freeBase: { colour: ACID_BASE_COLOURS.freeBase, r: 0.09 },
  water: { colour: ACID_BASE_COLOURS.water, r: 0.045 },
};
const ION_KINDS = Object.keys(ION_STYLE);
const MAX_PARTICLES = 160;

/**
 * The particles in a drop of the flask, in proportion to the moles there.
 * When the counts change, they change as reactions: an OH⁻ (or NH₃) comes
 * in from the top, finds an H⁺ (or a weak acid molecule, or an HSO₄⁻) and
 * the two become water (and the acid's ion, or NH₄⁺). Anything else that
 * should appear fades in, and anything that should go fades out.
 */
function IonView({ countsRef, baseKey, speed }) {
  const ref = useRef(null);
  const pool = useMemo(() => [], []);
  const seed = useRef(1);
  const rnd = () => hashRandom((seed.current += 1) * 1.731);
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color("#ffffff"), []);
  const R = INSET.r - 0.12;
  const reactClock = useRef(0);
  const spawn = (kind, at) => {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * R * 0.9;
    const p = { kind, x: at ? at[0] : r * Math.cos(a), y: at ? at[1] : r * Math.sin(a), vx: (rnd() - 0.5) * 0.4, vy: (rnd() - 0.5) * 0.4, alpha: 0, dying: false, partner: null, reagent: false };
    pool.push(p);
    return p;
  };
  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(raw, 0.05) * speed;
    const want = countsRef.current;
    if (!want) return;
    const live = (k) => pool.filter((p) => p.kind === k && !p.dying && !p.reagent);
    reactClock.current += dt;
    // reactions first: what has to be used up by the alkali
    const target = (k) => want[k] ?? 0;
    const busy = (k) => pool.filter((p) => p.kind === k && p.partner && !p.dying).length;
    if (reactClock.current > 0.12) {
      for (const [from, to] of [
        ["hydrogen", null],
        ["acidMolecule", "anion"],
        ["partAnion", "anion"],
      ]) {
        const have = live(from).length - busy(from);
        if (have > target(from) && (to === null || live(to).length < target(to) + 2 || from === "hydrogen")) {
          const victim = live(from).find((p) => !p.partner);
          if (victim) {
            const g = spawn(baseKey === "ammonia" ? "freeBase" : "hydroxide", [(rnd() - 0.5) * 0.6, R]);
            g.reagent = true;
            g.alpha = 1;
            g.partner = victim;
            victim.partner = g;
            g.turnsInto = to;
            reactClock.current = 0;
            break;
          }
        }
      }
    }
    // then the bookkeeping: fade in what is missing, out what is extra
    for (const k of ION_KINDS) {
      const have = live(k).filter((p) => !p.partner);
      const extra = live(k).length - target(k);
      if (extra < 0 && pool.length < MAX_PARTICLES) for (let i = 0; i < Math.min(-extra, 2); i += 1) spawn(k);
      else if (extra > 0 && !["hydrogen", "acidMolecule", "partAnion"].includes(k)) {
        for (let i = 0; i < Math.min(extra, 2) && i < have.length; i += 1) have[i].dying = true;
      } else if (extra > 0 && reactClock.current > 1.5) {
        for (let i = 0; i < Math.min(extra, 2) && i < have.length; i += 1) have[i].dying = true;
      }
    }
    // motion
    for (const p of pool) {
      if (p.reagent && p.partner) {
        const q = p.partner;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.1) {
          // they meet: water, and the acid's partner becomes its ion
          p.dying = true;
          p.alpha = 0;
          if (p.turnsInto) {
            q.kind = p.turnsInto;
            q.partner = null;
          } else {
            q.dying = true;
            q.alpha = 0;
          }
          if (p.kind === "freeBase") {
            const nh4 = spawn("cation", [q.x, q.y]);
            nh4.alpha = 1;
          }
          const w = spawn("water", [q.x, q.y]);
          w.alpha = 1;
          w.flash = 1;
          p.partner = null;
        } else {
          p.x += (dx / d) * Math.min(d, 1.6 * dt);
          p.y += (dy / d) * Math.min(d, 1.6 * dt);
        }
      } else {
        p.vx += (rnd() - 0.5) * 2.4 * dt;
        p.vy += (rnd() - 0.5) * 2.4 * dt;
        p.vx *= 1 - 0.8 * dt;
        p.vy *= 1 - 0.8 * dt;
        p.x += p.vx * dt * 0.6;
        p.y += p.vy * dt * 0.6;
        const r = Math.hypot(p.x, p.y);
        if (r > R) {
          p.x *= R / r;
          p.y *= R / r;
          p.vx = -p.vx;
          p.vy = -p.vy;
        }
      }
      p.alpha = p.dying ? p.alpha - dt * 2.5 : Math.min(1, p.alpha + dt * 2);
      if (p.flash) p.flash = Math.max(0, p.flash - dt);
    }
    for (let i = pool.length - 1; i >= 0; i -= 1) if (pool[i].dying && pool[i].alpha <= 0) pool.splice(i, 1);
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = pool[i];
      if (!p) {
        o.scale.setScalar(0);
      } else {
        const st = ION_STYLE[p.kind];
        o.position.set(p.x, p.y, 0.05);
        o.scale.setScalar(st.r * Math.max(p.alpha, 0.001) * (1 + (p.flash ?? 0) * 1.2));
        col.set(st.colour);
        if (p.flash) col.lerp(white, p.flash * 0.7);
        m.setColorAt(i, col);
      }
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <group position={INSET.at}>
      <mesh>
        <circleGeometry args={[INSET.r, 64]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.88} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[INSET.r, INSET.r + 0.06, 64]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
      <instancedMesh ref={ref} args={[null, null, MAX_PARTICLES]} frustumCulled={false}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial roughness={0.35} emissive="#ffffff" emissiveIntensity={0.12} />
      </instancedMesh>
    </group>
  );
}

// ─── The curve ──────────────────────────────────────────────────────

/** Longest trace the graph's buffer holds: the curve's points plus the live tip. */
const TRACE_MAX = 640;

function TitrationGraph({ curve, veq, halfPKa, indicator, volumeRef, pHRef, showPredicted, showLabels }) {
  const dot = useRef(null);
  // One buffer for the whole run, drawn up to the current point. A new
  // attribute every frame would leave the old GPU buffers behind.
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRACE_MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const traced = useMemo(() => new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: ACID_BASE_COLOURS.curve })), [geometry]);
  useEffect(
    () => () => {
      geometry.dispose();
      traced.material.dispose();
    },
    [geometry, traced],
  );
  // the whole curve, for "show the whole curve in advance"
  const full = useMemo(() => curve.map((p) => [gx(p.v), gy(p.pH), GRAPH.z + 0.02]), [curve]);
  // the curve's points, written once per curve; each frame only moves the tip
  const written = useRef({ curve: null, upto: -1 });
  useFrame(() => {
    const v = volumeRef.current;
    const attr = geometry.attributes.position;
    const arr = attr.array;
    const w = written.current;
    if (w.curve !== curve) {
      w.curve = curve;
      w.upto = -1;
      const n = Math.min(curve.length, TRACE_MAX - 1);
      for (let i = 0; i < n; i += 1) {
        arr[i * 3] = gx(curve[i].v);
        arr[i * 3 + 1] = gy(curve[i].pH);
        arr[i * 3 + 2] = GRAPH.z + 0.02;
      }
    }
    const n = Math.max(2, curve.findIndex((p) => p.v > v));
    const upto = Math.min(n < 2 ? curve.length : n, TRACE_MAX - 1);
    // the live tip goes after the last curve point; whatever it overwrote comes back when the trace grows
    if (upto !== w.upto) {
      const back = Math.min(w.upto, curve.length - 1);
      if (back >= 0) {
        arr[back * 3] = gx(curve[back].v);
        arr[back * 3 + 1] = gy(curve[back].pH);
        arr[back * 3 + 2] = GRAPH.z + 0.02;
      }
      w.upto = upto;
    }
    arr[upto * 3] = gx(v);
    arr[upto * 3 + 1] = gy(pHRef.current);
    arr[upto * 3 + 2] = GRAPH.z + 0.03;
    geometry.setDrawRange(0, upto + 1);
    attr.needsUpdate = true;
    if (dot.current) dot.current.position.set(gx(v), gy(pHRef.current), GRAPH.z + 0.05);
  });
  const ind = INDICATORS[indicator];
  const band = !ind.chart ? ind.range : null;
  const bandColours = band ? [indicatorColour(indicator, band[0] - 0.4).colour, indicatorColour(indicator, band[1] + 0.4).colour] : null;
  const Label = showLabels ? SceneLabel : NoLabel;
  return (
    <group>
      <mesh position={[GRAPH.x0 + GRAPH.w / 2, GRAPH.y0 + GRAPH.h / 2, GRAPH.z - 0.02]}>
        <planeGeometry args={[GRAPH.w + 1.1, GRAPH.h + 1.2]} />
        <meshStandardMaterial color="#0d121c" transparent opacity={0.9} roughness={0.9} />
      </mesh>
      {band && (
        <mesh position={[GRAPH.x0 + GRAPH.w / 2, (gy(band[0]) + gy(band[1])) / 2, GRAPH.z]}>
          <planeGeometry args={[GRAPH.w, gy(band[1]) - gy(band[0])]} />
          <meshBasicMaterial color={bandColours[1]} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      {[0, 7, 14].map((p) => (
        <Line key={p} points={[[gx(0), gy(p), GRAPH.z + 0.01], [gx(BURETTE_VOLUME), gy(p), GRAPH.z + 0.01]]} color={p === 7 ? "#64748b" : "#334155"} lineWidth={1} dashed={p === 7} dashSize={0.12} gapSize={0.08} />
      ))}
      <Line points={[[gx(0), gy(0), GRAPH.z + 0.01], [gx(0), gy(14), GRAPH.z + 0.01]]} color="#94a3b8" lineWidth={1.4} />
      <Line points={[[gx(0), gy(0), GRAPH.z + 0.01], [gx(BURETTE_VOLUME), gy(0), GRAPH.z + 0.01]]} color="#94a3b8" lineWidth={1.4} />
      {[10, 20, 30, 40, 50].map((v) => (
        <Line key={v} points={[[gx(v), gy(0), GRAPH.z + 0.01], [gx(v), gy(0) - 0.1, GRAPH.z + 0.01]]} color="#94a3b8" lineWidth={1} />
      ))}
      {showPredicted && <Line points={full} color="#475569" lineWidth={1.4} dashed dashSize={0.1} gapSize={0.07} />}
      {veq <= BURETTE_VOLUME && <Line points={[[gx(veq), gy(0), GRAPH.z + 0.015], [gx(veq), gy(14), GRAPH.z + 0.015]]} color="#fbbf24" lineWidth={1} dashed dashSize={0.1} gapSize={0.08} transparent opacity={0.7} />}
      {halfPKa !== null && (
        <mesh position={[gx(veq / 2), gy(halfPKa), GRAPH.z + 0.04]}>
          <circleGeometry args={[0.07, 20]} />
          <meshBasicMaterial color="#a78bfa" />
        </mesh>
      )}
      <primitive object={traced} frustumCulled={false} />
      <mesh ref={dot}>
        <circleGeometry args={[0.09, 20]} />
        <meshBasicMaterial color={ACID_BASE_COLOURS.curve} />
      </mesh>
      <Label position={[GRAPH.x0 + GRAPH.w / 2, GRAPH.y0 + GRAPH.h + 0.38, GRAPH.z]} tone="text-ink-200">
        titration curve · pH against volume of alkali
      </Label>
      {[0, 7, 14].map((p) => (
        <Label key={p} position={[GRAPH.x0 - 0.3, gy(p), GRAPH.z]} tone="text-ink-400">
          {p}
        </Label>
      ))}
      {[0, 10, 20, 30, 40, 50].map((v) => (
        <Label key={v} position={[gx(v), GRAPH.y0 - 0.3, GRAPH.z]} tone="text-ink-400">
          {v}
        </Label>
      ))}
      <Label position={[GRAPH.x0 + GRAPH.w - 0.6, GRAPH.y0 - 0.62, GRAPH.z]} tone="text-ink-500">
        cm³ added
      </Label>
      {veq <= BURETTE_VOLUME && (
        <Label position={[gx(veq) + 0.05, gy(14) + 0.02, GRAPH.z]} tone="text-amber-300">
          {`equivalence · ${veq.toFixed(2)} cm³`}
        </Label>
      )}
      {halfPKa !== null && (
        <Label position={[gx(veq / 2) - 0.1, gy(halfPKa) + 0.35, GRAPH.z]} tone="text-violet-300">
          {`buffer · pH = pKa = ${halfPKa.toFixed(2)}`}
        </Label>
      )}
      {band && (
        <Label position={[GRAPH.x0 + GRAPH.w - 0.1, gy((band[0] + band[1]) / 2), GRAPH.z]} tone="text-ink-300">
          {`${ind.short} changes`}
        </Label>
      )}
    </group>
  );
}

// ─── Titration: the driver and the bench ────────────────────────────

function TitrationBench({ params, setParam }) {
  const {
    speed = 1,
    acid,
    acidConc,
    sulfuricConc,
    base,
    baseConc,
    indicator = "universal",
    tap = "closed",
    addDrop = 0,
    refill = 0,
    showIons = true,
    showPredicted = false,
    showLabels = true,
  } = params;
  const indKey = INDICATORS[indicator] ? indicator : "universal";
  const opts = useMemo(() => titrationSetup({ acid, acidConc, sulfuricConc, base, baseConc }), [acid, acidConc, sulfuricConc, base, baseConc]);
  const { acid: acidKey, base: baseKey } = opts;
  const curve = useMemo(() => titrationCurve(opts, 500), [opts]);
  const veq = equivalenceVolume(opts);
  const halfPKa = !ACIDS[acidKey].strong ? titrationPoint({ ...opts, volume: veq / 2 }).pH : null;

  const volume = useRef(0);
  const pH = useRef(titrationPoint({ ...opts, volume: 0 }).pH);
  const counts = useRef(null);
  const liquid = useRef({ fill: 0, colour: CLEAR, opacity: 0.3 });
  const surface = useRef(0);
  const flash = useRef({ splash: 0, colour: CLEAR, strength: 0 });
  const tapShown = TAP_RATE[tap] !== undefined ? tap : "closed";
  const pushed = useRef({ clock: 0, v: -1 });

  // a refill empties nothing into the flask: it is a fresh titration
  useEffect(() => {
    volume.current = 0;
  }, [refill, opts]);
  const lastDrop = useRef(addDrop);
  useEffect(() => {
    if (addDrop !== lastDrop.current) {
      lastDrop.current = addDrop;
      volume.current = Math.min(BURETTE_VOLUME, volume.current + DROP);
      flash.current.splash = 1;
    }
  }, [addDrop]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05) * speed;
    let v = volume.current;
    v = Math.min(BURETTE_VOLUME, v + TAP_RATE[tapShown] * dt);
    // an empty burette shuts itself off
    if (v >= BURETTE_VOLUME && tapShown !== "closed") setParam?.("tap", "closed");
    volume.current = v;
    const pt = titrationPoint({ ...opts, volume: v });
    pH.current = pt.pH;
    counts.current = particleCounts(pt, opts);
    const c = indicatorColour(indKey, pt.pH);
    liquid.current.colour = c.colour;
    liquid.current.opacity = 0.32 + 0.4 * c.strength;
    const depth = flaskDepth(FLASK_VOLUME + v);
    liquid.current.fill = depth / (FLASK.bodyHeight - 0.1);
    surface.current = ST.top + 0.06 + depth;
    // where a drop lands, the alkali is briefly in excess: its colour flashes
    const local = indicatorColour(indKey, titrationPoint({ ...opts, volume: v + 0.6 }).pH);
    flash.current.colour = local.colour;
    flash.current.strength = local.colour === c.colour ? 0 : local.strength;
    // the Details panel
    pushed.current.clock += raw;
    if (pushed.current.clock > 0.1) {
      pushed.current.clock = 0;
      const r = Math.round(v * 100) / 100;
      if (r !== pushed.current.v) {
        pushed.current.v = r;
        setParam?.("liveVolume", r);
      }
    }
  });

  const Label = showLabels ? SceneLabel : NoLabel;
  const running = tapShown !== "closed";
  const ind = INDICATORS[indKey];
  return (
    <>
      <LabBench y={0} width={18} depth={6.4} />
      <RetortStand position={STAND_AT} height={CLAMP_Y + 0.6} baseAngle={ARM.angle} fittings={[{ y: CLAMP_Y, reach: ARM.reach, angle: ARM.angle }]}>
        <group position={[0, CLAMP_Y, 0]} rotation={[0, ARM.angle, 0]}>
          <group position={[ARM.reach, 0, 0]} scale={BURETTE_SCALE}>
            <Suspense fallback={null}>
              <KitPart name="buretteClamp" />
              <KitPart name="buretteClampPads" />
            </Suspense>
          </group>
        </group>
      </RetortStand>
      <Burette volumeRef={volume} tap={tapShown} showLabels={showLabels} />
      <Stirrer speed={speed} running />
      <group position={[0, ST.top, 0]}>
        <ConicalFlask liquidRef={liquid} liquidColour={CLEAR} liquidOpacity={0.32} />
      </group>
      <Delivery tap={tapShown} speed={speed} surfaceRef={surface} flashRef={flash} />
      <PHMeter pHRef={pH} showLabels={showLabels} />
      <group position={DROPPER_AT}>
        <Suspense fallback={null}>
          <KitPart name="dropperGlass" />
          <KitPart name="dropperCap" />
        </Suspense>
        <Label position={[0, -0.25, 0.4]} tone="text-ink-300">
          {ind.label.toLowerCase()}
        </Label>
      </group>
      <TitrationGraph curve={curve} veq={veq} halfPKa={halfPKa} indicator={indKey} volumeRef={volume} pHRef={pH} showPredicted={showPredicted} showLabels={showLabels} />
      {showIons && (
        <>
          <IonView countsRef={counts} baseKey={baseKey} speed={speed} />
          <Label position={[INSET.at[0], INSET.at[1] + INSET.r + 0.32, 0]} tone="text-ink-200">
            in the flask · magnified
          </Label>
        </>
      )}
      <Label position={[0.9, FLASK_TOP + 0.35, 0.6]} tone="text-ink-300">
        {`${FLASK_VOLUME.toFixed(1)} cm³ ${ACIDS[acidKey].formula} · ${opts.acidConc.toFixed(acidKey === "sulfuric" ? 3 : 2)} mol/dm³`}
      </Label>
      <Label position={[BURETTE_AT[0] - 0.95, buretteY(BU.zeroY - 10 * BU.perCm3), 0]} tone="text-ink-300">
        {`${BASES[baseKey].formula} · ${opts.baseConc.toFixed(2)} mol/dm³`}
      </Label>
      <Label position={[0, -0.45, ST.d / 2 + 0.3]} tone="text-ink-400">
        {running ? "magnetic stirrer · mixing" : "magnetic stirrer"}
      </Label>
    </>
  );
}

// ─── The pH scale ───────────────────────────────────────────────────

const SCALE_SPACING = 1.32;
const SCALE_BAR = { y: 5.4, z: -1.1, x0: -7.0, w: 14 };
const scaleX = (pH) => SCALE_BAR.x0 + (pH / 14) * SCALE_BAR.w;
const TUBE = { radius: 0.3, height: 2.5, liquid: 1.25 };

function PHScaleBar({ indicator, showLabels }) {
  const Label = showLabels ? SceneLabel : NoLabel;
  const segments = useMemo(() => Array.from({ length: 56 }, (_, i) => ({ p: (i + 0.5) / 4, ...indicatorColour(indicator, (i + 0.5) / 4) })), [indicator]);
  return (
    <group position={[0, SCALE_BAR.y, SCALE_BAR.z]}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[SCALE_BAR.w + 0.5, 1.15, 0.06]} />
        <meshStandardMaterial color="#0d121c" roughness={0.8} />
      </mesh>
      {segments.map((s) => (
        <mesh key={s.p} position={[scaleX(s.p) + 0.0, 0.05, 0]}>
          <planeGeometry args={[SCALE_BAR.w / 56 + 0.002, 0.55]} />
          <meshBasicMaterial color={s.strength < 0.05 ? "#e2e8f0" : s.colour} transparent opacity={s.strength < 0.05 ? 0.25 : 0.4 + 0.6 * s.strength} />
        </mesh>
      ))}
      {Array.from({ length: 15 }, (_, p) => (
        <Label key={p} position={[scaleX(p), -0.42, 0.02]} tone={p === 7 ? "text-emerald-300" : "text-ink-300"}>
          {p}
        </Label>
      ))}
      <Label position={[scaleX(2.5), 0.62, 0]} tone="text-rose-300">
        ← more acidic
      </Label>
      <Label position={[scaleX(7), 0.62, 0]} tone="text-emerald-300">
        neutral
      </Label>
      <Label position={[scaleX(11.5), 0.62, 0]} tone="text-sky-300">
        more alkaline →
      </Label>
    </group>
  );
}

function ScaleBench({ params }) {
  const { indicator = "universal", focus = "lemon", showLabels = true } = params;
  const indKey = INDICATORS[indicator] ? indicator : "universal";
  const focusKey = SUBSTANCES[focus] ? focus : "lemon";
  const n = SUBSTANCE_KEYS.length;
  const Label = showLabels ? SceneLabel : NoLabel;
  const fi = SUBSTANCE_KEYS.indexOf(focusKey);
  const fs = SUBSTANCES[focusKey];
  const fx = slotX(fi, n, SCALE_SPACING);
  return (
    <>
      <LabBench y={0} width={19} depth={5.6} />
      <VesselRack count={n} spacing={SCALE_SPACING} holder="ring" holderRadius={TUBE.radius + 0.04} holderHeight={1.4} focus={fi} labels={SUBSTANCE_KEYS.map((k) => SUBSTANCES[k].short)} showLabels={showLabels}>
        {SUBSTANCE_KEYS.map((k, i) => {
          const c = indicatorColour(indKey, SUBSTANCES[k].pH);
          return (
            <group key={k} position={[slotX(i, n, SCALE_SPACING), 0.12, 0]}>
              <TestTube radius={TUBE.radius} height={TUBE.height} liquid={TUBE.liquid} liquidColour={c.colour} liquidOpacity={0.25 + 0.5 * c.strength} />
            </group>
          );
        })}
      </VesselRack>
      <PHScaleBar indicator={indKey} showLabels={showLabels} />
      {/* each solution's place on the scale, and the chosen one tied to its tube */}
      {SUBSTANCE_KEYS.map((k) => (
        <mesh key={k} position={[scaleX(SUBSTANCES[k].pH), SCALE_BAR.y - 0.33, SCALE_BAR.z + 0.03]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.07, 0.14, 3]} />
          <meshBasicMaterial color={k === focusKey ? "#fbbf24" : "#94a3b8"} />
        </mesh>
      ))}
      <Line
        points={[
          [fx, TUBE.height + 0.25, 0],
          [fx, SCALE_BAR.y - 1.4, (SCALE_BAR.z + 0.03) / 2],
          [scaleX(fs.pH), SCALE_BAR.y - 0.42, SCALE_BAR.z + 0.03],
        ]}
        color="#fbbf24"
        lineWidth={1.6}
        dashed
        dashSize={0.12}
        gapSize={0.07}
      />
      <Label position={[scaleX(fs.pH), SCALE_BAR.y + 1.05, SCALE_BAR.z]} tone="text-amber-300">
        {`${fs.label} · pH ${fs.pH.toFixed(1)}`}
      </Label>
      <group position={[-8.2, 0, 1.2]}>
        <Suspense fallback={null}>
          <KitPart name="dropperGlass" />
          <KitPart name="dropperCap" />
        </Suspense>
        <Label position={[0, -0.25, 0.45]} tone="text-ink-300">
          {INDICATORS[indKey].label.toLowerCase()}
        </Label>
      </group>
    </>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

const VIEWS = {
  scale: { cx: 0, cy: 3.2, cz: 0, width: 19.5, height: 7.6, depth: 4 },
  titration: { cx: 2.2, cy: 5.3, cz: 0, width: 17.6, height: 11.4, depth: 4 },
};

export default function AcidBaseCanvas({ params = {}, setParam }) {
  const mode = params.mode === "titration" ? "titration" : "scale";
  const { showLabels = true } = params;
  return (
    <SceneCanvas key={mode} environment camera={{ position: [0, 6, 22], fov: 45 }}>
      <FitCamera view={VIEWS[mode]} direction={[0, 0.18, 1]} />
      <LabelsOn.Provider value={showLabels}>
        {mode === "titration" ? <TitrationBench params={params} setParam={setParam} /> : <ScaleBench params={params} />}
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}
