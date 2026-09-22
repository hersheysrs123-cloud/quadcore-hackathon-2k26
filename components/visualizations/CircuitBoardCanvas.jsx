"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  Bond,
  Halo,
  SceneCanvas,
  SceneLabel,
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
/**
 * Where the knife switch stands on the left rail. Its base runs ±0.35 along z,
 * so it has to keep clear of the jumper's junction at SHORT_Z as well as of the
 * battery row — the first version sat across both.
 */
const SWITCH_Z = BATTERY_Z - 0.6;

/** One carrier per this many world units of trace. Fixed, like copper's is. */
const CARRIER_SPACING = 0.46;

// ─── Colours ────────────────────────────────────────────────────────

const COPPER = CHARGE_COLOURS.copper;
/** A light, cool board — like a real solderless breadboard, and light enough for the copper to read. */
const BOARD_TONE = "#cfd6e1";
const BOARD_SKIRT = "#7f8b9e";
const HOLE_TONE = "#8e99aa";
const PORCELAIN = "#e8ebf1";
const HOUSING = "#dde2ea";
const BRASS = "#c9a25f";
const STEEL = "#cbd5e1";

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

/**
 * The hole grid, as one instanced mesh rather than four hundred meshes.
 *
 * Grouped in fives with a small gap between groups, the way a real board is
 * laid out, and kept inside the border so the corner screws and the edge rails
 * stay clear.
 */
function BoardHoles() {
  const ref = useRef(null);
  const holes = useMemo(() => {
    const axis = (limit) => {
      const out = [];
      for (let i = 0, p = -limit; p <= limit + 1e-6; i += 1) {
        out.push(p);
        p += 0.34 + ((i + 1) % 5 === 0 ? 0.15 : 0);
      }
      // Centre the run on the board, whatever it came to.
      const mid = (out[0] + out[out.length - 1]) / 2;
      return out.map((v) => v - mid);
    };
    const xs = axis(BOARD.x - 0.7);
    const zs = axis(BOARD.z - 0.6);
    return xs.flatMap((x) => zs.map((z) => [x, z]));
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    holes.forEach(([x, z], i) => {
      dummy.position.set(x, 0.004, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [holes, dummy]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, holes.length]} frustumCulled={false}>
      <cylinderGeometry args={[0.05, 0.05, 0.016, 8]} />
      <meshStandardMaterial color={HOLE_TONE} roughness={0.85} metalness={0.05} />
    </instancedMesh>
  );
}

/** A plus or minus, as flat bars lying on the board. */
function PolarityMark({ position, plus, colour }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.26, 0.012, 0.05]} />
        <meshStandardMaterial color={colour} roughness={0.6} />
      </mesh>
      {plus && (
        <mesh>
          <boxGeometry args={[0.05, 0.012, 0.26]} />
          <meshStandardMaterial color={colour} roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

function Breadboard() {
  return (
    <group>
      {/* Body, with a darker base plate under it so the slab reads as a thing with thickness. */}
      <RoundedBox
        args={[BOARD.x * 2, BOARD.thickness, BOARD.z * 2]}
        radius={0.09}
        smoothness={3}
        position={[0, -BOARD.thickness / 2, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color={BOARD_TONE} roughness={0.68} metalness={0.04} />
      </RoundedBox>
      <mesh position={[0, -BOARD.thickness - 0.03, 0]} receiveShadow>
        <boxGeometry args={[BOARD.x * 2 - 0.3, 0.06, BOARD.z * 2 - 0.3]} />
        <meshStandardMaterial color={BOARD_SKIRT} roughness={0.8} />
      </mesh>
      <BoardHoles />

      {/* Corner screws. */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * (BOARD.x - 0.34), 0.01, sz * (BOARD.z - 0.34)]}>
            <mesh>
              <cylinderGeometry args={[0.1, 0.1, 0.03, 16]} />
              <meshStandardMaterial color="#9aa5b6" roughness={0.4} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0.018, 0]} rotation={[0, (sx * sz * Math.PI) / 4, 0]}>
              <boxGeometry args={[0.14, 0.012, 0.025]} />
              <meshStandardMaterial color="#5b6577" roughness={0.6} />
            </mesh>
          </group>
        ))
      )}

      {/* Rail stripes down each edge, the way a real board is marked: red for
          the + side, blue for the −. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (BOARD.x - 0.13), 0.006, 0]}>
          <boxGeometry args={[0.07, 0.012, BOARD.z * 1.72]} />
          <meshStandardMaterial color={s > 0 ? "#d9485f" : "#3b74d9"} roughness={0.6} />
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
          opacity={dim ? 0.4 : 1}
        />
      ))}
      {points.map((p, i) => (
        <mesh key={`j${i}`} position={p}>
          <sphereGeometry args={[radius * 1.15, 8, 8]} />
          <meshStandardMaterial color={colour} roughness={0.4} metalness={0.65} transparent={dim} opacity={dim ? 0.4 : 1} />
        </mesh>
      ))}
    </group>
  );
}

/** A brass pad where a conductor meets a rail, so the junctions read as junctions. */
function Pad({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.12, 0.04, 20]} />
        <meshStandardMaterial color={BRASS} roughness={0.32} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0.043, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.008, 12]} />
        <meshStandardMaterial color="#7a5f30" roughness={0.5} metalness={0.7} />
      </mesh>
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
      {/* Porcelain base plate, with its two mounting screws. */}
      <mesh position={[0, 0.016, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.31, 0.34, 0.032, 30]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.5} metalness={0.05} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.25, 0.036, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.012, 10]} />
          <meshStandardMaterial color="#7d8797" roughness={0.4} metalness={0.8} />
        </mesh>
      ))}

      {/* Socket, always on the board: a ceramic barrel the colour bands read against. */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.2, 0.26, 24]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.42} metalness={0.05} />
      </mesh>
      {showBands &&
        bands.map((c, i) => (
          <mesh key={i} position={[0, 0.075 + i * 0.062, 0]}>
            <cylinderGeometry args={[0.185, 0.195, 0.038, 24]} />
            <meshStandardMaterial color={c} roughness={0.5} metalness={0.15} />
          </mesh>
        ))}
      {/* The contact ring the bulb's screw thread sits in. */}
      <mesh position={[0, 0.285, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.022, 8, 24]} />
        <meshStandardMaterial color="#9aa3b2" roughness={0.35} metalness={0.9} />
      </mesh>

      {/* The bulb itself. */}
      <group position={[removed ? 0.5 : 0, 0.28 + lift, 0]} rotation={[0, 0, tilt]}>
        {/* Brass screw base. */}
        <mesh position={[0, 0.09, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.15, 0.18, 20]} />
          <meshStandardMaterial color={BRASS} roughness={0.36} metalness={0.9} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.04 + i * 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.147, 0.013, 6, 20]} />
            <meshStandardMaterial color="#8a6c3f" roughness={0.45} metalness={0.9} />
          </mesh>
        ))}
        {/* The dark tip of the base, where the bottom contact is. */}
        <mesh position={[0, -0.005, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.02, 12]} />
          <meshStandardMaterial color="#3a3f4a" roughness={0.5} metalness={0.6} />
        </mesh>

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
        {/* Glass stem and the support wires from the base up to the filament. */}
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.022, 0.03, 0.14, 8]} />
          <meshStandardMaterial color="#dfeaf5" transparent opacity={0.55} roughness={0.15} />
        </mesh>
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.26, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.16, 6]} />
            <meshStandardMaterial color="#9aa3b2" roughness={0.4} metalness={0.8} />
          </mesh>
        ))}

        {/* Glass envelope, with a small glint so it reads as glass on a light board. */}
        <mesh position={[0, 0.38, 0]}>
          <sphereGeometry args={[0.235, 26, 20]} />
          <meshStandardMaterial
            color="#d5e6f7"
            transparent
            opacity={0.2}
            roughness={0.05}
            metalness={0.05}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[-0.1, 0.5, 0.13]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
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

      {/* The unscrewed label sits on the side away from the floating bulb, and
          low, so it neither hides the bulb nor stacks up under the title. */}
      <SceneLabel position={[removed ? -0.62 : 0, 1.0, 0]} tone={bulb?.lit ? "text-duck-300" : "text-ink-400"}>
        {removed
          ? `bulb ${bulb?.id ?? "?"} — unscrewed`
          : `${bulb?.id ?? "?"} · ${((bulb?.brightness ?? 0) * 100).toFixed(0)}% brightness`}
      </SceneLabel>
    </group>
  );
}

/** A binding post: brass foot, coloured cap, knurled ring — where a wire clamps on. */
function BindingPost({ position, colour, glow = 0 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.16, 0.06, 20]} />
        <meshStandardMaterial color={BRASS} roughness={0.32} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.19, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.095, 0.26, 18]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={glow} roughness={0.35} metalness={0.1} />
      </mesh>
      {[0.11, 0.15, 0.19].map((y) => (
        <mesh key={y} position={[0, y + 0.1, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.018, 18]} />
          <meshStandardMaterial color="#1f2733" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 14]} />
        <meshStandardMaterial color={STEEL} roughness={0.25} metalness={0.95} />
      </mesh>
    </group>
  );
}

/** One AA cell lying along x: a foil wrapper with a dark band, a raised + nub and a flat − end. */
function Cell({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.76, 28]} />
        <meshStandardMaterial color="#e7b84a" roughness={0.32} metalness={0.55} />
      </mesh>
      {/* Label band. */}
      <mesh position={[-0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1615, 0.1615, 0.3, 28]} />
        <meshStandardMaterial color="#2a303c" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Steel end caps; the + one is raised. */}
      <mesh position={[-0.385, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.16, 0.03, 24]} />
        <meshStandardMaterial color={STEEL} roughness={0.25} metalness={0.95} />
      </mesh>
      <mesh position={[0.385, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.15, 0.03, 24]} />
        <meshStandardMaterial color={STEEL} roughness={0.25} metalness={0.95} />
      </mesh>
      <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.065, 0.065, 0.05, 14]} />
        <meshStandardMaterial color={STEEL} roughness={0.2} metalness={0.95} />
      </mesh>
    </group>
  );
}

/** The DC pack: two cells in a holder, terminals meeting the two rails. */
function BatteryPack({ volts, current, overCurrent }) {
  return (
    <group position={[0, 0, BATTERY_Z]}>
      {/* Holder: a light body with a recessed tray the cells lie in. */}
      <RoundedBox args={[2.3, 0.3, 0.9]} radius={0.06} smoothness={3} position={[0, 0.15, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={HOUSING} roughness={0.55} metalness={0.05} />
      </RoundedBox>
      <mesh position={[0, 0.305, 0]}>
        <boxGeometry args={[1.9, 0.014, 0.62]} />
        <meshStandardMaterial color="#c3cad6" roughness={0.7} />
      </mesh>
      {/* Retaining lip along the front of the tray. */}
      <mesh position={[0, 0.34, 0.36]}>
        <boxGeometry args={[1.9, 0.07, 0.04]} />
        <meshStandardMaterial color={HOUSING} roughness={0.55} />
      </mesh>

      {/* Cells, wired end to end: one cell's + nub meets the next one's − end. */}
      {[-0.42, 0.42].map((x) => (
        <Cell key={x} position={[x, 0.42, 0]} />
      ))}
      {/* The strip that carries the current from the first cell across to the second. */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.1, 0.05, 0.05]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Polarity moulded into the holder beside each terminal. */}
      <PolarityMark position={[TERMINAL_X, 0.32, -0.34]} plus colour="#c0392b" />
      <PolarityMark position={[-TERMINAL_X, 0.32, -0.34]} plus={false} colour="#2b5fb4" />

      {/* Terminals — red for +, dark for −, and the traces meet them here. */}
      <BindingPost position={[TERMINAL_X, 0.3, 0.02]} colour="#d9483a" glow={0.3} />
      <BindingPost position={[-TERMINAL_X, 0.3, 0.02]} colour="#1f2733" />
      <SceneLabel position={[TERMINAL_X, 0.86, 0]} tone="text-rose-300">+</SceneLabel>
      <SceneLabel position={[-TERMINAL_X, 0.86, 0]} tone="text-sky-300">−</SceneLabel>

      <SceneLabel position={[0, 1.06, 0]} accent>
        {`${volts.toFixed(1)} V pack${overCurrent ? " · overloaded" : ""}`}
      </SceneLabel>
      <SceneLabel position={[0, 0.5, 0.7]} tone="text-ink-400">
        {`electrons leave the − terminal · ${current.toFixed(2)} A`}
      </SceneLabel>
    </group>
  );
}

/** A closed knife switch sitting in the left rail: a porcelain base, two brass jaws and a blade with an insulated handle. */
function KnifeSwitch({ position }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.44, 0.09, 0.86]} radius={0.03} smoothness={2} position={[0, 0.045, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#efe6d2" roughness={0.5} />
      </RoundedBox>
      {/* Hinge jaw and contact jaw, and the copper each is fed by. */}
      {[-0.3, 0.3].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 0.13, 0]} castShadow>
            <boxGeometry args={[0.13, 0.15, 0.1]} />
            <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 0.15, 10]} />
            <meshStandardMaterial color="#8a6c3f" roughness={0.4} metalness={0.9} />
          </mesh>
        </group>
      ))}
      {/* The blade, closed across both jaws, and its handle. */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.62]} />
        <meshStandardMaterial color={STEEL} roughness={0.25} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0.3, -0.24]}>
        <cylinderGeometry args={[0.04, 0.05, 0.16, 12]} />
        <meshStandardMaterial color="#1b2230" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.39, -0.24]}>
        <sphereGeometry args={[0.065, 14, 12]} />
        <meshStandardMaterial color="#1b2230" roughness={0.45} />
      </mesh>
      <SceneLabel position={[0, 0.62, 0]} tone="text-ink-400">switch · closed</SceneLabel>
    </group>
  );
}

/** A digital panel meter standing on the board. */
function Meter({ position, value, unit, label, tone = "amber", warn = false }) {
  const face = warn ? "#fb7185" : tone === "sky" ? "#7dd3fc" : "#fcd34d";
  return (
    <group position={position}>
      <RoundedBox args={[0.8, 0.2, 0.52]} radius={0.035} smoothness={3} position={[0, 0.1, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={HOUSING} roughness={0.5} metalness={0.1} />
      </RoundedBox>
      {/* Bezel, then the dark LCD sunk into it. */}
      <mesh position={[0, 0.203, 0]}>
        <boxGeometry args={[0.68, 0.012, 0.4]} />
        <meshStandardMaterial color="#2b3444" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.32]} />
        <meshStandardMaterial color="#07100c" roughness={0.9} />
      </mesh>
      {/* Two input sockets along the back edge. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.22, 0.2, -0.235]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 12]} />
          <meshStandardMaterial color={s > 0 ? "#d9483a" : "#1f2733"} roughness={0.4} />
        </mesh>
      ))}
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
      wrap
      colour={segment.kind === "short" ? "#fb7185" : CHARGE_COLOURS.electron}
      radius={0.058}
      // Toned down from the dark-board value: at 2.6 the bloom-free emissive
      // saturated to near-white and the carriers vanished against a light board.
      emissiveIntensity={1.5}
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
  const { segments, rows, taps } = useMemo(
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
      controls={{ minDistance: 2.4, maxDistance: 30, target: [0, 0, -0.2], maxPolarAngle: Math.PI / 2.05 }}
      lights={{ ambient: 0.42, keyLight: 0.95 }}
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

      {/* Pads where each conductor meets a rail, and where the rails turn at the pack. */}
      {taps.flatMap((tap) =>
        [-RAIL_X, RAIL_X].map((x) => <Pad key={`${tap.key}${x}`} position={[x, 0, tap.z]} />),
      )}
      {[-RAIL_X, RAIL_X].map((x) => (
        <Pad key={`pack${x}`} position={[x, 0, BATTERY_Z]} />
      ))}

      {/* Drift electrons, one stream per conductor. */}
      {segments.map((seg) => (
        <FlowSegment key={seg.key} segment={seg} running={running} animSpeed={speed} />
      ))}

      <BatteryPack volts={solved.emf} current={solved.totalCurrent} overCurrent={solved.overCurrent} />
      <KnifeSwitch position={[-RAIL_X, 0, SWITCH_Z]} />

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

      {/* Above the title, not below it: underneath, it ran into the far row's
          bulb labels as soon as the camera came in. */}
      {solved.overCurrent && (
        <SceneLabel position={[0, 2.05, -BOARD.z - 0.5]} tone="text-rose-300">
          {`${solved.totalCurrent.toFixed(1)} A — the pack is dumping ${solved.internalLoss.toFixed(1)} W into its own internal resistance`}
        </SceneLabel>
      )}

    </SceneCanvas>
  );
}
