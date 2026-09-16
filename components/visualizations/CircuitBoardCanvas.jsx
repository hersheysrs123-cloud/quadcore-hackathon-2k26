"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  Bond,
  Halo,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
} from "@/components/visualizations/scene-kit";
import {
  CHARGE_COLOURS,
  ChargeFlow,
  makeFlowPath,
} from "@/components/visualizations/charge-carriers";
import { buildConductors, driftSpeed, filamentHeat, solveCircuit } from "@/lib/circuits";

// ─── Series and parallel circuits on a 3D breadboard ────────────────
// Two bulbs, a pack of cells and a switch, laid out flat so the topology is
// readable from above and the components still stand up as objects.
//
// The scene's one real idea is in the electrons. Every conductor on the board
// is split into segments at the junctions, and each segment gets its own
// stream of carriers running at a speed set by ITS current — same spacing
// everywhere, only the speed changes. That is what a wire actually does, and
// it makes two things visible that a static diagram cannot: the supply rails
// run faster than either parallel branch because they carry the sum, and the
// segment past a junction slows down because some of the current turned off.
// Kirchhoff's junction rule stops being a rule and becomes something you watch.
// ─────────────────────────────────────────────────────────────────────

const BOARD = { x: 4.9, z: 3.3, thickness: 0.34 };
/** Height of the copper traces above the board face. */
const TRACE_Y = 0.05;
/** Height the drift electrons ride at, clear of the copper. */
const FLOW_Y = 0.12;

/** Left and right supply rails. */
const RAIL_X = 3.5;
/** The row the battery pack sits on. */
const BATTERY_Z = 2.5;
/** Where the pack's two terminals meet the rails. */
const TERMINAL_X = 0.9;
/** The row the shorting jumper drops onto — between the pack and the bulbs. */
const SHORT_Z = 1.35;

/** One carrier per this many world units of trace. Fixed, like copper's is. */
const CARRIER_SPACING = 0.46;

// ─── Colours ────────────────────────────────────────────────────────

const COPPER = CHARGE_COLOURS.copper;
const BOARD_TONE = "#4a5568";
const BRASS = "#b08d57";

/**
 * Filament colour against a 0–1 heat.
 *
 * Instances live at module scope and the result is lerped into a scratch
 * colour, because this is read once per bulb per render and allocating three
 * `THREE.Color`s each time was measurable in the other scenes.
 */
const FIL_COLD = new THREE.Color("#4a5160");
const FIL_RED = new THREE.Color("#c22a08");
const FIL_ORANGE = new THREE.Color("#ff8c1a");
const FIL_WHITE = new THREE.Color("#fff6d8");

function filamentColour(heat, out) {
  const h = clamp(heat, 0, 1);
  if (h < 0.35) return out.copy(FIL_COLD).lerp(FIL_RED, h / 0.35);
  if (h < 0.7) return out.copy(FIL_RED).lerp(FIL_ORANGE, (h - 0.35) / 0.35);
  return out.copy(FIL_ORANGE).lerp(FIL_WHITE, (h - 0.7) / 0.3);
}

/**
 * The four-band resistor colour code for a value in ohms.
 *
 * Drawn as rings on each bulb's socket collar. It is a real skill in this
 * syllabus band and the board is the natural place to practise it — and it
 * labels the bulb honestly, since the collar is showing the resistance of the
 * filament in the socket above it, not adding a component to the circuit.
 */
const BAND_COLOURS = [
  "#12161d", "#7a4a1e", "#c0392b", "#e07b1a", "#d8c832",
  "#3f9c46", "#2f6fd0", "#8e5bc4", "#8d97a5", "#eef2f7",
];

function resistorBands(ohms) {
  const value = Math.max(Math.round(ohms), 1);
  const digits = String(value);
  if (digits.length === 1) return [BAND_COLOURS[value], BAND_COLOURS[0], "#c9a227"];
  const first = Number(digits[0]);
  const second = Number(digits[1]);
  const multiplier = digits.length - 2;
  return [BAND_COLOURS[first], BAND_COLOURS[second], BAND_COLOURS[multiplier] ?? BAND_COLOURS[0]];
}

// ─── Board ──────────────────────────────────────────────────────────

/** The hole grid, as one instanced mesh rather than four hundred meshes. */
function BoardHoles() {
  const ref = useRef(null);
  const holes = useMemo(() => {
    const out = [];
    for (let x = -BOARD.x + 0.35; x <= BOARD.x - 0.35; x += 0.34) {
      for (let z = -BOARD.z + 0.3; z <= BOARD.z - 0.3; z += 0.34) {
        out.push([x, z]);
      }
    }
    return out;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    holes.forEach(([x, z], i) => {
      dummy.position.set(x, 0.005, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [holes, dummy]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, holes.length]} frustumCulled={false}>
      <cylinderGeometry args={[0.045, 0.045, 0.02, 6]} />
      <meshStandardMaterial color="#0d1119" roughness={0.9} metalness={0.1} />
    </instancedMesh>
  );
}

function Breadboard() {
  return (
    <group>
      <mesh position={[0, -BOARD.thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[BOARD.x * 2, BOARD.thickness, BOARD.z * 2]} />
        <meshStandardMaterial color={BOARD_TONE} roughness={0.82} metalness={0.08} />
      </mesh>
      <BoardHoles />
      {/* Rail stripes down each edge, the way a real board is marked. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (BOARD.x - 0.12), 0.006, 0]}>
          <boxGeometry args={[0.05, 0.012, BOARD.z * 1.9]} />
          <meshStandardMaterial color={s > 0 ? "#7f1d2d" : "#1e3a5f"} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** A run of copper, drawn as cylinders between consecutive points. */
function Trace({ points, colour = COPPER, radius = 0.038, dim = false }) {
  return (
    <group>
      {points.slice(0, -1).map((p, i) => (
        <Bond
          key={i}
          from={p}
          to={points[i + 1]}
          radius={radius}
          color={colour}
          opacity={dim ? 0.35 : 1}
        />
      ))}
      {points.map((p, i) => (
        <mesh key={`j${i}`} position={p}>
          <sphereGeometry args={[radius * 1.15, 8, 8]} />
          <meshStandardMaterial color={colour} roughness={0.4} metalness={0.65} transparent={dim} opacity={dim ? 0.35 : 1} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Components ─────────────────────────────────────────────────────

/** The helix every filament is built from. Module scope — built once. */
const FILAMENT_CURVE = (() => {
  const pts = [];
  const turns = 5.5;
  const height = 0.24;
  const radius = 0.05;
  for (let i = 0; i <= 56; i += 1) {
    const t = i / 56;
    const a = t * Math.PI * 2 * turns;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, -height / 2 + t * height, Math.sin(a) * radius));
  }
  return new THREE.CatmullRomCurve3(pts);
})();

/**
 * An incandescent bulb in its socket.
 *
 * When unscrewed the envelope lifts clear and tilts, and the socket is left
 * visibly empty — the gap in the circuit has to be something you can see,
 * because in series it is the entire explanation for why the board went dark.
 */
function Bulb({ position, bulb, ohms, showBands = true }) {
  const heat = filamentHeat(bulb?.brightness ?? 0);
  const colour = useMemo(() => filamentColour(heat, new THREE.Color()), [heat]);
  const removed = Boolean(bulb?.removed);
  const bands = useMemo(() => resistorBands(ohms), [ohms]);

  const lift = removed ? 1.05 : 0;
  const tilt = removed ? 0.55 : 0;

  return (
    <group position={position}>
      {/* Socket, always on the board. */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.17, 0.2, 0.26, 18]} />
        <meshStandardMaterial color="#2c3442" roughness={0.6} metalness={0.35} />
      </mesh>
      {showBands &&
        bands.map((c, i) => (
          <mesh key={i} position={[0, 0.055 + i * 0.062, 0]}>
            <cylinderGeometry args={[0.185, 0.195, 0.038, 18]} />
            <meshStandardMaterial color={c} roughness={0.55} metalness={0.2} />
          </mesh>
        ))}

      {/* The bulb itself. */}
      <group position={[removed ? 0.5 : 0, 0.26 + lift, 0]} rotation={[0, 0, tilt]}>
        {/* Brass screw base. */}
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.14, 0.15, 0.18, 18]} />
          <meshStandardMaterial color={BRASS} roughness={0.42} metalness={0.85} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.04 + i * 0.05, 0]}>
            <torusGeometry args={[0.147, 0.012, 6, 18]} />
            <meshStandardMaterial color="#8a6c3f" roughness={0.5} metalness={0.9} />
          </mesh>
        ))}

        {/* Filament — visible through the glass, and the whole point. */}
        <mesh position={[0, 0.36, 0]}>
          <tubeGeometry args={[FILAMENT_CURVE, 60, 0.0095, 5, false]} />
          <meshStandardMaterial
            color={colour}
            emissive={colour}
            emissiveIntensity={removed ? 0 : 0.4 + heat * 4.2}
            toneMapped={false}
            roughness={0.4}
          />
        </mesh>
        {/* Support wires from the base up to the filament. */}
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.26, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.16, 6]} />
            <meshStandardMaterial color="#9aa3b2" roughness={0.4} metalness={0.8} />
          </mesh>
        ))}

        {/* Glass envelope. */}
        <mesh position={[0, 0.38, 0]}>
          <sphereGeometry args={[0.235, 22, 18]} />
          <meshStandardMaterial
            color="#cfe2f5"
            transparent
            opacity={0.16}
            roughness={0.06}
            metalness={0.02}
            depthWrite={false}
          />
        </mesh>

        {!removed && bulb?.lit && (
          <>
            <Halo position={[0, 0.38, 0]} radius={0.42 + heat * 0.3} color={colour.getStyle()} opacity={0.1 + heat * 0.22} />
            <pointLight
              position={[0, 0.38, 0]}
              color={colour}
              intensity={heat * 3.4}
              distance={3.2 + heat * 2}
              decay={2}
            />
          </>
        )}
      </group>

      <SceneLabel position={[0, removed ? 2.05 : 1.0, 0]} tone={bulb?.lit ? "text-duck-300" : "text-ink-400"}>
        {removed
          ? `bulb ${bulb?.id ?? "?"} — unscrewed`
          : `${bulb?.id ?? "?"} · ${((bulb?.brightness ?? 0) * 100).toFixed(0)}% brightness`}
      </SceneLabel>
    </group>
  );
}

/** The DC pack: two cells in a holder, terminals meeting the two rails. */
function BatteryPack({ volts, current, overCurrent }) {
  return (
    <group position={[0, 0, BATTERY_Z]}>
      {/* Holder. */}
      <RoundedBox args={[2.05, 0.34, 0.72]} radius={0.05} smoothness={3} position={[0, 0.17, 0]}>
        <meshStandardMaterial color="#232b38" roughness={0.7} metalness={0.2} />
      </RoundedBox>

      {/* Cells. */}
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x, 0.34, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.78, 20]} />
            <meshStandardMaterial color="#2f3a4c" roughness={0.35} metalness={0.7} />
          </mesh>
          <mesh position={[0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 14]} />
            <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Terminals — red for +, dark for −, and the traces meet them here. */}
      <mesh position={[TERMINAL_X, 0.2, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.4, 14]} />
        <meshStandardMaterial color="#c0392b" emissive="#c0392b" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[-TERMINAL_X, 0.2, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.4, 14]} />
        <meshStandardMaterial color="#1b2230" roughness={0.5} metalness={0.5} />
      </mesh>
      <SceneLabel position={[TERMINAL_X, 0.62, 0]} tone="text-rose-300">+</SceneLabel>
      <SceneLabel position={[-TERMINAL_X, 0.62, 0]} tone="text-sky-300">−</SceneLabel>

      <SceneLabel position={[0, 0.78, 0]} accent>
        {`${volts.toFixed(1)} V pack${overCurrent ? " · overloaded" : ""}`}
      </SceneLabel>
      <SceneLabel position={[0, 0.5, 0.62]} tone="text-ink-400">
        {`electrons leave the − terminal · ${current.toFixed(2)} A`}
      </SceneLabel>
    </group>
  );
}

/** A closed knife switch sitting in the left rail. */
function KnifeSwitch({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.34, 0.08, 0.7]} />
        <meshStandardMaterial color="#2a3240" roughness={0.7} />
      </mesh>
      {[-0.26, 0.26].map((z) => (
        <mesh key={z} position={[0, 0.13, z]}>
          <cylinderGeometry args={[0.06, 0.06, 0.16, 12]} />
          <meshStandardMaterial color={BRASS} roughness={0.35} metalness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.07, 0.045, 0.56]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.9} />
      </mesh>
      <SceneLabel position={[0, 0.46, 0]} tone="text-ink-400">switch · closed</SceneLabel>
    </group>
  );
}

/** A digital panel meter standing on the board. */
function Meter({ position, value, unit, label, tone = "amber", warn = false }) {
  const face = warn ? "#fb7185" : tone === "sky" ? "#7dd3fc" : "#fcd34d";
  return (
    <group position={position}>
      <RoundedBox args={[0.78, 0.2, 0.5]} radius={0.035} smoothness={3} position={[0, 0.1, 0]}>
        <meshStandardMaterial color="#161c27" roughness={0.6} metalness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.62, 0.34]} />
        <meshStandardMaterial color="#07100c" roughness={0.9} />
      </mesh>
      <Html position={[0, 0.24, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[40, 0]}>
        <div className="flex flex-col items-center">
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums"
            style={{ color: face, background: "rgba(6,12,10,0.92)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {value}
            <span className="ml-0.5 text-[9px] opacity-70">{unit}</span>
          </span>
          <span className="mt-0.5 whitespace-nowrap text-[9px] text-ink-500">{label}</span>
        </div>
      </Html>
    </group>
  );
}

/** One conductor's worth of drift electrons. */
function FlowSegment({ segment, running, animSpeed = 1 }) {
  const path = useMemo(() => makeFlowPath(segment.points), [segment.points]);
  const speed = driftSpeed(segment.current) * animSpeed;
  const count = Math.max(2, Math.round(path.length / CARRIER_SPACING));

  if (segment.open || speed <= 0) return null;

  return (
    <ChargeFlow
      path={path}
      count={count}
      speed={speed}
      running={running}
      colour={segment.kind === "short" ? "#fb7185" : CHARGE_COLOURS.electron}
      radius={0.058}
      emissiveIntensity={2.6}
      seed={segment.key.length + segment.points.length}
    />
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function CircuitBoardCanvas({ params = {} }) {
  const {
    topology = "series",
    voltage = 6,
    bulbR = 10,
    unscrewA = 0,
    shortCircuit = 0,
    running = true,
    speed = 1,
  } = params || {};

  // The two action buttons are latches: pressing again puts the bulb back or
  // pulls the jumper off, so a student can compare the two states directly
  // rather than having to reset the whole topic.
  const unscrewed = Math.round(Number(unscrewA) || 0) % 2 === 1;
  const shorted = Math.round(Number(shortCircuit) || 0) % 2 === 1;

  const solved = useMemo(
    () => solveCircuit({ topology, voltage, bulbR, unscrewed, shorted }),
    [topology, voltage, bulbR, unscrewed, shorted],
  );

  // Geometry the board is drawn on is handed to the solver's conductor
  // splitter, so the copper, the meters and the electron streams are all
  // derived from one description of where the circuit runs.
  const { segments, rows } = useMemo(
    () =>
      buildConductors(solved, {
        railX: RAIL_X,
        batteryZ: BATTERY_Z,
        terminalX: TERMINAL_X,
        shortZ: SHORT_Z,
        y: FLOW_Y,
      }),
    [solved],
  );

  const bulbById = useMemo(() => {
    const map = {};
    for (const b of solved.bulbs) map[b.id] = b;
    return map;
  }, [solved.bulbs]);

  // Traces are drawn from the same segment list the electrons ride, so copper
  // and carriers can never disagree about where the circuit goes.
  const traces = useMemo(() => segments.filter((s) => s.kind !== "short"), [segments]);
  const shortTrace = useMemo(() => segments.find((s) => s.kind === "short"), [segments]);

  return (
    <SceneCanvas
      camera={{ position: [0.4, 8.6, 8.4], fov: 46 }}
      controls={{ minDistance: 5, maxDistance: 30, target: [0, 0, -0.2], maxPolarAngle: Math.PI / 2.05 }}
      lights={{ ambient: 0.4, keyLight: 0.85 }}
      fog={[16, 40]}
    >
      <Breadboard />

      {/* Copper. A branch whose bulb has been unscrewed is drawn dimmed, so
          the dead run is distinguishable from one that is simply unlit. */}
      {traces.map((seg) => (
        <Trace key={seg.key} points={seg.points.map((p) => [p[0], TRACE_Y, p[2]])} dim={seg.open} />
      ))}
      {shortTrace && (
        <Trace
          points={shortTrace.points.map((p) => [p[0], TRACE_Y, p[2]])}
          colour="#fb7185"
          radius={0.05}
        />
      )}
      {shortTrace && (
        <SceneLabel position={[0, 0.62, SHORT_Z]} tone="text-rose-300">
          shorting jumper · {solved.shortCurrent.toFixed(1)} A through 0.01 Ω
        </SceneLabel>
      )}

      {/* Drift electrons, one stream per conductor. */}
      {segments.map((seg) => (
        <FlowSegment key={seg.key} segment={seg} running={running} animSpeed={speed} />
      ))}

      <BatteryPack volts={solved.emf} current={solved.totalCurrent} overCurrent={solved.overCurrent} />
      <KnifeSwitch position={[-RAIL_X, 0, BATTERY_Z - 0.85]} />

      {/* Bulbs. */}
      {rows.map((row) =>
        row.bulbs.map((slot) => (
          <Bulb
            key={slot.id}
            position={[slot.x, 0, row.z]}
            bulb={bulbById[slot.id]}
            ohms={solved.bulbR}
          />
        )),
      )}

      {/* Instruments. One ammeter in the supply, one per branch, and a
          voltmeter across the whole bulb network. */}
      <Meter
        position={[RAIL_X + 0.85, 0, BATTERY_Z - 0.9]}
        value={solved.totalCurrent.toFixed(2)}
        unit="A"
        label="total current"
        warn={solved.overCurrent}
      />
      <Meter
        position={[-RAIL_X - 0.85, 0, BATTERY_Z - 1.9]}
        value={solved.terminalVoltage.toFixed(2)}
        unit="V"
        label="terminal volts"
        tone="sky"
      />
      {rows.map((row, i) => (
        <Meter
          key={`m${i}`}
          position={[RAIL_X + 0.85, 0, row.z]}
          value={(solved.branches[i]?.current ?? 0).toFixed(2)}
          unit="A"
          label={`I${i + 1} · branch ${solved.branches[i]?.id ?? i + 1}`}
        />
      ))}

      {/* Row labels down the left, so each branch's resistance is legible. */}
      {rows.map((row, i) => (
        <SceneLabel key={`r${i}`} position={[-RAIL_X - 0.9, 0.35, row.z]} tone="text-ink-400">
          {solved.branches[i]?.open
            ? "branch open"
            : `${Number.isFinite(solved.branches[i]?.resistance) ? solved.branches[i].resistance.toFixed(0) : "∞"} Ω`}
        </SceneLabel>
      ))}

      <SceneLabel position={[0, 1.5, -BOARD.z - 0.5]} accent>
        {`${solved.spec.label} · ${solved.formula} → ${solved.worked}`}
      </SceneLabel>

      {solved.overCurrent && (
        <SceneLabel position={[0, 1.05, -BOARD.z - 0.5]} tone="text-rose-300">
          {`${solved.totalCurrent.toFixed(1)} A — the pack is dumping ${solved.internalLoss.toFixed(1)} W into its own internal resistance`}
        </SceneLabel>
      )}

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title={`${solved.spec.label} circuit`}
        subtitle={solved.spec.summary}
        rows={[
          ["R_eq", solved.worked],
          ["Total current", `${solved.totalCurrent.toFixed(3)} A`, solved.overCurrent ? "bad" : "good"],
          ...solved.branches.map((b, i) => [
            `I${i + 1}`,
            b.open ? "0 A — open" : `${b.current.toFixed(3)} A`,
            b.open ? "bad" : "good",
          ]),
          ["Terminal voltage", `${solved.terminalVoltage.toFixed(2)} V`],
        ]}
      />

      <SceneLegend
        title="Circuit key"
        items={[
          { color: CHARGE_COLOURS.electron, label: "Drift electrons", note: "same spacing everywhere — only the speed tracks the current" },
          { color: COPPER, label: "Copper trace", note: "cut at every junction, each piece with its own current" },
          { color: "#fbbf24", label: "Filament", note: "brightness follows P = I²R" },
          { color: "#fb7185", label: "Short circuit", note: "a near-zero path in parallel with the bulbs" },
        ]}
      />
    </SceneCanvas>
  );
}
