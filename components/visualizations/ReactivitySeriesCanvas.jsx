"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import {
  Beaker,
  Bench,
  BubbleColumn,
  ElectronArrow,
  ElectronStream,
  VesselRack,
  relaxTo,
  slotX,
} from "@/components/visualizations/vessel-rack";
import {
  COLOURLESS,
  ION_APPEARANCE,
  METALS,
  SOLUTIONS,
  SOLUTION_ORDER,
  describeOutcome,
  formatModelTime,
  ionSymbol,
  solveDisplacement,
} from "@/lib/redox";

// ─── The reactivity series, one metal against four solutions ────────
// Four beakers on a rack — copper(II) sulfate, iron(II) sulfate, silver
// nitrate, magnesium sulfate — and a gantry above them carrying four strips
// of the same metal. Pick a metal and the arm lifts, swaps the strips, and
// lowers them into all four beakers at once, so the question "which of
// these does zinc displace" is answered by looking along the rack rather
// than by running four experiments in turn.
//
// What happens in each beaker is decided entirely by `lib/redox.js`: the
// strip is above the ion's metal in the series or it is not, and if it is,
// the standard potentials fix how fast. This file owns the arm, the clock
// and the drawing — the solution recolouring, the deposit growing on the
// strip, ions arriving and leaving, and electrons on the move inside the
// metal from where it dissolves to where the newcomer plates out.
//
// Time runs at the time-lapse factor the slider sets: magnesium's minute in
// copper sulfate takes one real second at 50×, and iron's ten minutes take
// twelve. The clock only runs while the strips are actually in the liquid.
// ─────────────────────────────────────────────────────────────────────

const BENCH_Y = -2.4;
const COUNT = 4;
const SPACING = 3.1;
const BEAKER = { radius: 0.95, height: 2.7, liquid: 1.95 };
const BEAKER_Y = BENCH_Y + 0.12;
const LIQUID_BOTTOM = BEAKER_Y + 0.12;
const LIQUID_TOP = LIQUID_BOTTOM + BEAKER.liquid;

const STRIP = { length: 2.3, width: 0.5, thickness: 0.09 };
const RAIL_Y = 3.3;
/** Posts stand clear of the rack board (it reaches x = ±6.8), foot plates included. */
const POST_X = 7.3;
const BAR_RAISED_Y = 2.75;
const BAR_DIPPED_Y = 1.1;
/** How far below the liquid surface the bottom of a dipped strip reaches. */
const SUBMERGED = LIQUID_TOP - (BAR_DIPPED_Y - STRIP.length);
/** …and where the waterline sits on the strip, measured down from the bar. */
const WATERLINE = BAR_DIPPED_Y - LIQUID_TOP;
const PUSH_EVERY_S = 0.2;
const NODULES = 26;

const SCRATCH_OBJECT = new THREE.Object3D();
const SCRATCH_COLOUR = new THREE.Color();

// ─── The arm and the clock ──────────────────────────────────────────

/**
 * Drives the gantry and the model clock. Renders nothing.
 *
 * The arm has three states — dipped, lifting, lowering. A new metal or a
 * press of "dip fresh strips" lifts the bar out, swaps the strips at the top
 * (that is when `stripMetal` changes and the clock resets), and lowers it
 * again. The clock advances only while the strips are in the liquid, at
 * `timeLapse` model seconds per real second, on top of the HUD's animation
 * speed.
 */
function ArmDriver({ modelRef, metal, dipToken, timeLapse, animSpeed, setStripMetal, setArmPhase, setParam }) {
  const wanted = useRef({ metal, dipToken });
  const pushed = useRef({ seconds: -1, dipped: null, sinceLast: 0 });

  useFrame((_, delta) => {
    const m = modelRef.current;
    const dt = Math.min(delta, 0.05) * animSpeed;

    if (wanted.current.metal !== metal || wanted.current.dipToken !== dipToken) {
      wanted.current = { metal, dipToken };
      m.pendingMetal = metal;
      if (m.phase === "dipped" || m.phase === "lowering") {
        m.phase = "lifting";
        setArmPhase("lifting");
      }
    }

    if (m.phase === "lifting") {
      m.barY = relaxTo(m.barY, BAR_RAISED_Y, 0.22, dt);
      if (m.barY > BAR_RAISED_Y - 0.03) {
        m.barY = BAR_RAISED_Y;
        m.seconds = 0;
        m.stripMetal = m.pendingMetal;
        setStripMetal(m.pendingMetal);
        m.phase = "lowering";
        setArmPhase("lowering");
      }
    } else if (m.phase === "lowering") {
      m.barY = relaxTo(m.barY, BAR_DIPPED_Y, 0.22, dt);
      if (m.barY < BAR_DIPPED_Y + 0.03) {
        m.barY = BAR_DIPPED_Y;
        m.phase = "dipped";
        setArmPhase("dipped");
      }
    } else {
      m.seconds += dt * timeLapse;
    }

    if (typeof setParam !== "function") return;
    pushed.current.sinceLast += delta;
    if (pushed.current.sinceLast < PUSH_EVERY_S) return;
    pushed.current.sinceLast = 0;
    const seconds = Math.round(m.seconds * 10) / 10;
    const dipped = m.phase === "dipped";
    if (pushed.current.seconds !== seconds) {
      pushed.current.seconds = seconds;
      setParam("liveSeconds", seconds);
    }
    if (pushed.current.dipped !== dipped) {
      pushed.current.dipped = dipped;
      setParam("liveDipped", dipped);
    }
  });

  return null;
}

// ─── The gantry ─────────────────────────────────────────────────────

// A bench-top linear actuator in anodised aluminium: two slotted extrusion
// posts on foot plates, a top beam carrying a stepper motor over each lead
// screw, and a carriage bar that rides guide rods up and down with a clamp
// for each strip. Light metal throughout — a black frame vanished into the
// background.
const ALU = "#d4dae3";
const ALU_DARK = "#9aa5b4";
const CHROME = "#eef2f7";
const PLASTIC = "#6b7686";
const FRAME_Z = -0.6;
const POST = 0.3;
const BEAM = { height: 0.3, depth: 0.38 };
const ROD_X = 4.0;
const SCREW_X = ROD_X + 0.36;
const ROD_BOTTOM = BAR_DIPPED_Y - 0.55;
const THREAD_PITCH = 0.09;

// Moderate metalness: with no environment map to reflect, a high value renders
// the aluminium dark grey instead of bright.
function Alu({ colour = ALU, metalness = 0.3, roughness = 0.4 }) {
  return <meshStandardMaterial color={colour} metalness={metalness} roughness={roughness} />;
}

/** A slotted extrusion post: a light bar with a darker T-slot down each face. */
function ExtrusionPost({ x }) {
  const height = RAIL_Y - BENCH_Y - 0.08;
  const y = BENCH_Y + 0.08 + height / 2;
  return (
    <group position={[x, y, FRAME_Z]}>
      <mesh>
        <boxGeometry args={[POST, height, POST]} />
        <Alu />
      </mesh>
      {/* Slots stand a hair proud of each face, so they never share its plane. */}
      <mesh>
        <boxGeometry args={[0.06, height - 0.02, POST + 0.008]} />
        <Alu colour={ALU_DARK} roughness={0.6} />
      </mesh>
      <mesh>
        <boxGeometry args={[POST + 0.008, height - 0.02, 0.06]} />
        <Alu colour={ALU_DARK} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** The foot plate a post is bolted to, with four cap screws. */
function FootPlate({ x }) {
  return (
    <group position={[x, BENCH_Y + 0.041, FRAME_Z]}>
      <mesh>
        <boxGeometry args={[0.8, 0.08, 1.3]} />
        <Alu colour={ALU_DARK} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.28, 0.055, sz * 0.48]}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 12]} />
            <Alu colour={CHROME} metalness={0.45} roughness={0.25} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** A triangular corner gusset where a post meets the beam. */
function Gusset({ x, side }) {
  return (
    <mesh position={[x - side * (POST / 2 + 0.16), RAIL_Y - BEAM.height / 2 - 0.16, FRAME_Z]} rotation={[0, 0, (side * Math.PI) / 4]}>
      <boxGeometry args={[0.05, 0.46, 0.2]} />
      <Alu colour={ALU_DARK} />
    </mesh>
  );
}

/** A NEMA-17-style stepper: dark stack between light end plates, on the beam. */
function Stepper({ x }) {
  const base = RAIL_Y + BEAM.height / 2;
  return (
    <group position={[x, base, FRAME_Z]}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.46, 0.1, 0.46]} />
        <Alu colour={ALU} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.42, 0.4, 0.42]} />
        <meshStandardMaterial color={PLASTIC} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.46, 0.1, 0.46]} />
        <Alu colour={ALU} />
      </mesh>
      {/* Connector on the back. */}
      <mesh position={[0, 0.3, -0.25]}>
        <boxGeometry args={[0.18, 0.1, 0.08]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** A threaded lead screw: a chrome core ringed with thread crests. */
function LeadScrew({ x }) {
  const top = RAIL_Y - BEAM.height / 2;
  const length = top - ROD_BOTTOM;
  const rings = Math.floor(length / THREAD_PITCH);
  const threads = useRef(null);
  useEffect(() => {
    const mesh = threads.current;
    if (!mesh) return;
    for (let i = 0; i < rings; i += 1) {
      SCRATCH_OBJECT.position.set(0, ROD_BOTTOM + 0.05 + i * THREAD_PITCH, 0);
      SCRATCH_OBJECT.rotation.set(Math.PI / 2, 0.12, 0);
      SCRATCH_OBJECT.scale.setScalar(1);
      SCRATCH_OBJECT.updateMatrix();
      mesh.setMatrixAt(i, SCRATCH_OBJECT.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [rings]);

  return (
    <group position={[x, 0, FRAME_Z]}>
      <mesh position={[0, ROD_BOTTOM + length / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, length, 12]} />
        <Alu colour={CHROME} metalness={0.45} roughness={0.25} />
      </mesh>
      <instancedMesh ref={threads} args={[undefined, undefined, rings]}>
        <torusGeometry args={[0.042, 0.012, 6, 14]} />
        <Alu colour={CHROME} metalness={0.45} roughness={0.25} />
      </instancedMesh>
      {/* Shaft coupler up to the motor, and a bearing block at the foot. */}
      <mesh position={[0, top - 0.09, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.18, 14]} />
        <Alu colour={ALU_DARK} />
      </mesh>
      <mesh position={[0, ROD_BOTTOM - 0.02, 0]}>
        <boxGeometry args={[0.2, 0.12, 0.2]} />
        <Alu colour={ALU_DARK} />
      </mesh>
    </group>
  );
}

/** One strip clamp on the carriage bar: an arm out from the bar, two jaws and a thumbscrew. */
function StripClamp({ x }) {
  const jawZ = STRIP.thickness / 2 + 0.03;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.02, -0.33]}>
        <boxGeometry args={[0.18, 0.12, 0.5]} />
        <Alu />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, -0.04, side * jawZ]}>
          <boxGeometry args={[0.66, 0.26, 0.05]} />
          <Alu colour={side > 0 ? ALU : ALU_DARK} />
        </mesh>
      ))}
      {/* Thumbscrew through the front jaw. */}
      <mesh position={[0, -0.04, jawZ + 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.1, 10]} />
        <Alu colour={CHROME} metalness={0.45} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.04, jawZ + 0.13]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.05, 14]} />
        <meshStandardMaterial color={PLASTIC} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** The controller on the right-hand post: a panel with a display, a status lamp and two buttons. */
function Controller({ led }) {
  return (
    <group position={[POST_X, BENCH_Y + 2.0, FRAME_Z + POST / 2 + 0.18]}>
      <mesh>
        <boxGeometry args={[0.78, 1.0, 0.34]} />
        <meshStandardMaterial color="#e2e7ee" metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.2, 0.175]}>
        <boxGeometry args={[0.56, 0.3, 0.012]} />
        <meshStandardMaterial color="#1f3a2c" emissive="#1f7a4a" emissiveIntensity={0.35} roughness={0.3} />
      </mesh>
      <mesh ref={led} position={[-0.2, -0.16, 0.185]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color={PALETTE.emerald} emissive={PALETTE.emerald} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {[0.02, 0.2].map((bx, i) => (
        <mesh key={bx} position={[bx, -0.16, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 14]} />
          <meshStandardMaterial color={i === 0 ? "#f97316" : "#64748b"} roughness={0.5} />
        </mesh>
      ))}
      {/* Vent slots under the buttons. */}
      {[-0.34, -0.4].map((vy) => (
        <mesh key={vy} position={[0, vy, 0.172]}>
          <boxGeometry args={[0.46, 0.022, 0.01]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** The loom from the controller up the post and along the beam to both motors. */
function Loom() {
  const geometry = useMemo(() => {
    const z = FRAME_Z - POST / 2 - 0.06;
    const top = RAIL_Y + BEAM.height / 2 + 0.08;
    const curve = new THREE.CatmullRomCurve3(
      [
        [POST_X - 0.1, BENCH_Y + 2.4, FRAME_Z + POST / 2 + 0.05],
        [POST_X - 0.1, BENCH_Y + 2.6, z],
        [POST_X - 0.1, RAIL_Y - 0.4, z],
        [POST_X - 0.4, top, z],
        [SCREW_X, top, z - 0.02],
        [0, top + 0.05, z],
        [-SCREW_X, top, z - 0.02],
      ].map((p) => new THREE.Vector3(...p)),
    );
    return new THREE.TubeGeometry(curve, 120, 0.035, 8, false);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#475569" roughness={0.7} />
    </mesh>
  );
}

function Gantry({ modelRef, armPhase, animSpeed = 1 }) {
  const bar = useRef(null);
  const led = useRef(null);
  const blink = useRef(0);

  useFrame((_, delta) => {
    if (bar.current) bar.current.position.y = modelRef.current.barY;
    if (led.current) {
      blink.current += Math.min(delta, 0.05) * animSpeed * 6;
      const moving = armPhase !== "dipped";
      led.current.material.emissiveIntensity = moving ? 1.5 + Math.sin(blink.current) * 1.4 : 0.8;
      led.current.material.color.set(moving ? PALETTE.gold : PALETTE.emerald);
      led.current.material.emissive.set(moving ? PALETTE.gold : PALETTE.emerald);
    }
  });

  // The beam overhangs the posts' outer faces, so its ends never sit flush with them.
  const beamLength = POST_X * 2 + POST + 0.24;

  return (
    <group>
      {[-POST_X, POST_X].map((x) => (
        <group key={x}>
          <FootPlate x={x} />
          <ExtrusionPost x={x} />
          <Gusset x={x} side={Math.sign(x)} />
        </group>
      ))}

      <mesh position={[0, RAIL_Y, FRAME_Z]}>
        <boxGeometry args={[beamLength, BEAM.height, BEAM.depth]} />
        <Alu />
      </mesh>
      {/* A slot along the beam's front, proud of the face. */}
      <mesh position={[0, RAIL_Y, FRAME_Z + BEAM.depth / 2 + 0.004]}>
        <boxGeometry args={[beamLength - 0.1, 0.06, 0.01]} />
        <Alu colour={ALU_DARK} roughness={0.6} />
      </mesh>
      {/* Plastic end caps, a little larger than the beam's section. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (beamLength / 2 + 0.02), RAIL_Y, FRAME_Z]}>
          <boxGeometry args={[0.04, BEAM.height + 0.02, BEAM.depth + 0.02]} />
          <meshStandardMaterial color={PLASTIC} roughness={0.6} />
        </mesh>
      ))}

      {/* Each side: a guide rod the carriage slides on, and a motor-driven lead screw. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * ROD_X, (RAIL_Y - BEAM.height / 2 + ROD_BOTTOM) / 2, FRAME_Z]}>
            <cylinderGeometry args={[0.045, 0.045, RAIL_Y - BEAM.height / 2 - ROD_BOTTOM, 14]} />
            <Alu colour={CHROME} metalness={0.45} roughness={0.25} />
          </mesh>
          <mesh position={[side * ROD_X, ROD_BOTTOM - 0.02, FRAME_Z]}>
            <cylinderGeometry args={[0.09, 0.09, 0.08, 14]} />
            <Alu colour={ALU_DARK} />
          </mesh>
          <LeadScrew x={side * SCREW_X} />
          <Stepper x={side * SCREW_X} />
        </group>
      ))}

      <Controller led={led} />
      <Loom />

      {/* The carriage: a bar between two linear-bearing blocks, with a clamp per slot. */}
      <group ref={bar} position={[0, BAR_RAISED_Y, 0]}>
        <mesh position={[0, 0, FRAME_Z]}>
          <boxGeometry args={[ROD_X * 2 + 0.2, 0.2, 0.2]} />
          <Alu />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * (ROD_X + 0.18), 0, FRAME_Z]}>
            <mesh>
              <boxGeometry args={[0.62, 0.46, 0.34]} />
              <Alu colour={ALU} />
            </mesh>
            {/* Screw nut and grease nipple. */}
            <mesh position={[side * 0.18, -0.29, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.12, 14]} />
              <Alu colour="#c9a24a" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.1, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.04, 8]} />
              <Alu colour={CHROME} />
            </mesh>
          </group>
        ))}
        {Array.from({ length: COUNT }, (_, i) => (
          <StripClamp key={i} x={slotX(i, COUNT, SPACING)} />
        ))}
      </group>
    </group>
  );
}

// ─── One strip, one beaker ──────────────────────────────────────────

/**
 * The strip hanging at slot `index`, and everything that happens on it.
 *
 * Reads the model clock every frame and asks `solveDisplacement` where the
 * beaker has got to. From that: the strip's thickness (it is being eaten),
 * the deposit nodules on its submerged part (instanced, each with its own
 * threshold so they appear one by one), and the glow of potassium going up.
 */
function Strip({ index, solutionKey, modelRef, stripMetal, focus, animSpeed = 1 }) {
  const group = useRef(null);
  const body = useRef(null);
  const coat = useRef(null);
  const nodules = useRef(null);
  const halo = useRef(null);
  const shown = useRef({ thickness: 1, length: 1, glow: 0 });
  const x = slotX(index, COUNT, SPACING);
  const M = METALS[stripMetal];
  // Emissive, not just metalness: a metalness of 0.9 with no environment map
  // has nothing to reflect and renders almost black.
  const stripMaterial = (
    <meshStandardMaterial
      color={M.colour}
      metalness={stripMetal === "K" ? 0.35 : 0.6}
      roughness={stripMetal === "K" ? 0.6 : 0.3}
      emissive={M.colour}
      emissiveIntensity={focus ? 0.42 : 0.32}
    />
  );

  /**
   * Where each nodule sits on the submerged faces, and when it appears.
   * Positions are relative to the bar, so the deposit rides up with the
   * strip when the arm lifts instead of staying behind in the liquid.
   */
  const seeds = useMemo(
    () =>
      Array.from({ length: NODULES }, (_, i) => {
        const face = i % 2 === 0 ? 1 : -1;
        return {
          x: (hashRandom(i * 3.7 + 1) - 0.5) * STRIP.width * 0.85,
          y: -WATERLINE - SUBMERGED * (0.08 + hashRandom(i * 5.3 + 2) * 0.86),
          z: face * (STRIP.thickness / 2 + 0.02),
          threshold: hashRandom(i * 7.9 + 3) * 0.85,
          size: 0.05 + hashRandom(i * 9.1 + 4) * 0.07,
          spin: hashRandom(i * 11.3 + 5) * Math.PI,
        };
      }),
    [],
  );

  useFrame((_, delta) => {
    const m = modelRef.current;
    const dt = Math.min(delta, 0.05) * animSpeed;
    if (group.current) group.current.position.y = m.barY;

    const r = solveDisplacement({ metal: stripMetal, solution: solutionKey, seconds: m.seconds });
    m.results[index] = r;

    const s = shown.current;
    const consumed = r.reason === "reacts_with_water";
    s.thickness = relaxTo(s.thickness, consumed ? 1 : 0.3 + 0.7 * r.stripRemainingFraction, 0.3, dt);
    s.length = relaxTo(s.length, consumed ? Math.max(0.05, 1 - r.progress * (SUBMERGED / STRIP.length)) : 1, 0.3, dt);
    s.glow = relaxTo(s.glow, consumed ? r.bubbleRate : 0, 0.25, dt);

    // Only the submerged end reacts: it thins as it dissolves (or, for
    // potassium, is eaten away from the bottom up); the dry top stays whole.
    const wetLength = SUBMERGED * s.length;
    if (body.current) {
      body.current.scale.set(1, s.length, s.thickness);
      body.current.position.y = -WATERLINE - wetLength / 2;
    }
    if (coat.current) {
      // A film of the displaced metal over the wet end, before the nodules show.
      coat.current.material.opacity = r.depositColour ? clamp(r.progress * 1.6, 0, 0.85) : 0;
      if (r.depositColour) coat.current.material.color.set(r.depositColour);
    }
    if (halo.current) {
      halo.current.material.opacity = s.glow * 0.35;
      halo.current.position.y = -WATERLINE - wetLength;
    }

    const mesh = nodules.current;
    if (mesh) {
      for (let i = 0; i < NODULES; i += 1) {
        const seed = seeds[i];
        const grow = r.depositColour ? clamp((r.progress - seed.threshold) / 0.18, 0, 1) : 0;
        const scale = seed.size * grow;
        SCRATCH_OBJECT.position.set(seed.x, seed.y, seed.z);
        SCRATCH_OBJECT.rotation.set(seed.spin, seed.spin * 0.7, 0);
        SCRATCH_OBJECT.scale.setScalar(scale);
        SCRATCH_OBJECT.updateMatrix();
        mesh.setMatrixAt(i, SCRATCH_OBJECT.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (r.depositColour) {
        SCRATCH_COLOUR.set(r.depositColour);
        mesh.material.color.copy(SCRATCH_COLOUR);
        mesh.material.emissive.copy(SCRATCH_COLOUR);
      }
    }
  });

  return (
    <group ref={group} position={[x, BAR_RAISED_Y, 0]}>
      {/* The dry top, held in the clamp. */}
      <mesh position={[0, -WATERLINE / 2, 0]}>
        <boxGeometry args={[STRIP.width, WATERLINE, STRIP.thickness]} />
        {stripMaterial}
      </mesh>
      {/* The wet end, scaled as it reacts; its film sits just proud of it and
          a touch shorter, so no face is shared. */}
      <mesh ref={body} position={[0, -WATERLINE - SUBMERGED / 2, 0]}>
        <boxGeometry args={[STRIP.width, SUBMERGED, STRIP.thickness]} />
        {stripMaterial}
        <mesh ref={coat}>
          <boxGeometry args={[STRIP.width + 0.012, SUBMERGED * 0.985, STRIP.thickness + 0.012]} />
          <meshStandardMaterial color="#b5633a" emissive="#3a1d10" transparent opacity={0} metalness={0.4} roughness={0.6} depthWrite={false} />
        </mesh>
      </mesh>

      <instancedMesh ref={nodules} args={[undefined, undefined, NODULES]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#b5633a" emissive="#b5633a" emissiveIntensity={0.5} metalness={0.55} roughness={0.25} />
      </instancedMesh>
      {/* Potassium's lilac flame — opacity follows how hard it is fizzing. */}
      <mesh ref={halo} position={[0, -STRIP.length, 0]}>
        <sphereGeometry args={[0.55, 20, 20]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * The traffic across the strip's surface: ions of the solution arriving to
 * be reduced, ions of the strip's metal leaving after being oxidised, and
 * electrons moving inside the metal between the two sites. All three scale
 * with the reaction's current rate, so a beaker that has finished goes
 * quiet and a beaker with nothing to do never starts.
 */
function IonExchange({ index, modelRef, animSpeed = 1 }) {
  const x = slotX(index, COUNT, SPACING);
  const arriving = useRef([]);
  const leaving = useRef([]);
  const ARRIVE = 9;
  const LEAVE = 7;
  const state = useRef(null);
  const activity = useRef(0);
  const colours = useRef({ ion: "", product: "" });

  if (!state.current) {
    const spawn = (i, out) => ({
      t: hashRandom(i * 3.1 + 7 + (out ? 50 : 0)),
      angle: hashRandom(i * 5.9 + 13 + (out ? 50 : 0)) * Math.PI * 2,
      y: -0.15 - hashRandom(i * 7.7 + 19 + (out ? 50 : 0)) * (SUBMERGED - 0.3),
      radius: 0.35 + hashRandom(i * 9.3 + 23 + (out ? 50 : 0)) * 0.45,
      speed: 0.45 + hashRandom(i * 11.1 + 29 + (out ? 50 : 0)) * 0.5,
    });
    state.current = {
      arriving: Array.from({ length: ARRIVE }, (_, i) => spawn(i, false)),
      leaving: Array.from({ length: LEAVE }, (_, i) => spawn(i, true)),
    };
  }

  const electronPath = useMemo(
    () => [
      // Just inside the face, not floating clear of it. The key says the
      // electron "travels inside the metal only -- ions carry the charge in
      // solution", and at +0.05 it was drawn out in the solution instead.
      [x + STRIP.width * 0.3, LIQUID_TOP - SUBMERGED + 0.15, STRIP.thickness / 2 - 0.02],
      [x - STRIP.width * 0.3, LIQUID_TOP - 0.2, STRIP.thickness / 2 - 0.02],
    ],
    [x],
  );

  useFrame((_, delta) => {
    const m = modelRef.current;
    const r = m.results[index];
    const dt = Math.min(delta, 0.05) * animSpeed;
    // Activity is the reaction's rate relative to its own starting rate.
    const target = r && r.reacts && r.reason === "displaces" && m.phase === "dipped" ? clamp((r.rate * r.tau) * 1.0, 0, 1) : 0;
    activity.current = relaxTo(activity.current, target, 0.3, dt);
    const a = activity.current;

    if (r && r.reason === "displaces") {
      const ion = ION_APPEARANCE[r.ionMetal] ?? COLOURLESS;
      const ionColour = ion === COLOURLESS ? "#f1f5f9" : ion.colour;
      const prod = ION_APPEARANCE[r.metal] ?? COLOURLESS;
      const productColour = prod === COLOURLESS ? "#f1f5f9" : prod.colour;
      if (colours.current.ion !== ionColour || colours.current.product !== productColour) {
        colours.current = { ion: ionColour, product: productColour };
        arriving.current.forEach((mesh) => {
          if (!mesh) return;
          mesh.material.color.set(ionColour);
          mesh.material.emissive.set(ionColour);
        });
        leaving.current.forEach((mesh) => {
          if (!mesh) return;
          mesh.material.color.set(productColour);
          mesh.material.emissive.set(productColour);
        });
      }
    }

    const top = LIQUID_TOP;
    const liveArrive = Math.round(ARRIVE * Math.min(1, a * 1.4));
    state.current.arriving.forEach((s, i) => {
      const mesh = arriving.current[i];
      if (!mesh) return;
      mesh.visible = i < liveArrive;
      if (a > 0.01) s.t = (s.t + dt * s.speed * (0.4 + a)) % 1;
      // From out in the liquid to the strip face, then start again.
      const rad = s.radius * (1 - s.t) + STRIP.thickness / 2 + 0.06;
      mesh.position.set(x + Math.cos(s.angle) * rad * 0.9, top + s.y, Math.sin(s.angle) * rad);
      mesh.scale.setScalar(0.06 + 0.02 * Math.sin(s.t * Math.PI));
    });
    const liveLeave = Math.round(LEAVE * Math.min(1, a * 1.4));
    state.current.leaving.forEach((s, i) => {
      const mesh = leaving.current[i];
      if (!mesh) return;
      mesh.visible = i < liveLeave;
      if (a > 0.01) s.t = (s.t + dt * s.speed * (0.4 + a)) % 1;
      const rad = STRIP.thickness / 2 + 0.06 + s.radius * s.t;
      mesh.position.set(x + Math.cos(s.angle + Math.PI / 3) * rad * 0.9, top + s.y + s.t * 0.25, Math.sin(s.angle + Math.PI / 3) * rad);
      mesh.scale.setScalar(0.055 * (1 - s.t * 0.5));
    });
  });

  return (
    <group>
      {Array.from({ length: ARRIVE }, (_, i) => (
        <mesh
          key={`a${i}`}
          ref={(el) => {
            arriving.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial color="#1e8fe0" emissive="#1e8fe0" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: LEAVE }, (_, i) => (
        <mesh
          key={`l${i}`}
          ref={(el) => {
            leaving.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial color="#f1f5f9" emissive="#f1f5f9" emissiveIntensity={0.9} transparent opacity={0.75} toneMapped={false} />
        </mesh>
      ))}
      <ElectronStreamGate index={index} modelRef={modelRef} path={electronPath} animSpeed={animSpeed} />
    </group>
  );
}

/** The electron stream on a strip, gated on that beaker's activity. */
function ElectronStreamGate({ index, modelRef, path, animSpeed }) {
  const [intensity, setIntensity] = useState(0);
  const last = useRef(0);
  useFrame((_, delta) => {
    last.current += delta;
    if (last.current < 0.25) return;
    last.current = 0;
    const r = modelRef.current.results[index];
    const next = r && r.reacts && r.reason === "displaces" && modelRef.current.phase === "dipped" ? Math.round(clamp(r.rate * r.tau, 0, 1) * 10) / 10 : 0;
    if (next !== intensity) setIntensity(next);
  });
  return <ElectronStream path={path} count={6} rate={0.55} running={intensity > 0} intensity={intensity} colour={PALETTE.bone} size={0.05} animSpeed={animSpeed} />;
}

/** The solution, recoloured every frame from the model — no re-render. */
function Solution({ index, solutionKey, modelRef, animSpeed = 1 }) {
  const liquid = useRef(null);
  const shown = useRef({ colour: new THREE.Color(ION_APPEARANCE[SOLUTIONS[solutionKey].metal].colour), opacity: ION_APPEARANCE[SOLUTIONS[solutionKey].metal].opacity });
  const initial = ION_APPEARANCE[SOLUTIONS[solutionKey].metal] ?? COLOURLESS;
  const x = slotX(index, COUNT, SPACING);

  useFrame((_, delta) => {
    const group = liquid.current;
    const r = modelRef.current.results[index];
    if (!group || !r) return;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const k = 1 - Math.exp(-dt / 0.3);
    SCRATCH_COLOUR.set(r.appearance.colour);
    shown.current.colour.lerp(SCRATCH_COLOUR, k);
    shown.current.opacity += (r.appearance.opacity - shown.current.opacity) * k;
    // Body and meniscus both: the surface carries the stronger opacity so the
    // liquid level stays visible even when the solution has gone colourless.
    group.traverse((o) => {
      if (!o.material) return;
      o.material.color.copy(shown.current.colour);
      o.material.opacity = o.geometry?.type === "CircleGeometry" ? Math.min(0.72, shown.current.opacity * 1.8) : shown.current.opacity;
    });
  });

  return (
    <group position={[x, BEAKER_Y - BENCH_Y, 0]}>
      <Beaker radius={BEAKER.radius} height={BEAKER.height} liquidHeight={BEAKER.liquid} liquidColour={initial.colour} liquidOpacity={initial.opacity} liquidRef={liquid} />
    </group>
  );
}

/** Hydrogen off a strip that is attacking the water — potassium, faintly magnesium. */
function WaterFizz({ index, modelRef, animSpeed = 1 }) {
  const [rate, setRate] = useState(0);
  const last = useRef(0);
  const x = slotX(index, COUNT, SPACING);
  useFrame((_, delta) => {
    last.current += delta;
    if (last.current < 0.25) return;
    last.current = 0;
    const m = modelRef.current;
    const r = m.results[index];
    const next = r && m.phase === "dipped" ? Math.round(clamp(r.bubbleRate, 0, 1) * 20) / 20 : 0;
    if (next !== rate) setRate(next);
  });
  return <BubbleColumn origin={[x, LIQUID_TOP - SUBMERGED + 0.1, 0]} top={LIQUID_TOP + 0.05} rate={rate} spread={0.5} count={16} animSpeed={animSpeed} />;
}

// ─── The scene ──────────────────────────────────────────────────────

const CAMERA_TARGET = [0, 0.3, 0];
const TAN_HALF_FOV = Math.tan((46 / 2) * (Math.PI / 180));
/** Everything that must stay in frame: both posts' foot plates, the motors and the captions. */
const FRAME = { width: 17, height: 10 };

/**
 * Backs the camera off far enough to frame the whole rig at the canvas's
 * aspect — on a narrow canvas the posts and the outer beakers were cut off.
 * Runs when the canvas resizes, not every frame, so zooming still works.
 */
function FitCamera() {
  const camera = useThree((st) => st.camera);
  const aspect = useThree((st) => st.size.width / Math.max(st.size.height, 1));
  useEffect(() => {
    const fit = Math.max(FRAME.height / 2 / TAN_HALF_FOV, FRAME.width / 2 / (TAN_HALF_FOV * aspect));
    const target = new THREE.Vector3(...CAMERA_TARGET);
    const offset = camera.position.clone().sub(target).setLength(fit);
    camera.position.copy(target).add(offset);
  }, [camera, aspect]);
  return null;
}

function createModel(metal) {
  return {
    phase: "lowering",
    barY: BAR_RAISED_Y,
    seconds: 0,
    stripMetal: metal,
    pendingMetal: metal,
    results: [],
  };
}

/** Stands in for SceneLabel when labels are switched off. */
const NoLabel = () => null;

export default function ReactivitySeriesCanvas({ params = {}, setParam }) {
  const { metal = "Zn", solution = "cuso4", timeLapse = 10, dip = 0, speed = 1, liveSeconds = 0, showLabels = true } = params || {};
  // Every label in the scene goes through this, so one toggle clears them all.
  const Label = showLabels ? SceneLabel : NoLabel;
  const modelRef = useRef(null);
  if (modelRef.current === null) modelRef.current = createModel(metal);

  const [stripMetal, setStripMetal] = useState(metal);
  const [armPhase, setArmPhase] = useState("lowering");
  const focusIndex = Math.max(0, SOLUTION_ORDER.indexOf(solution));

  // What the labels say — sampled from the same model the HUD reads.
  const rack = useMemo(
    () => SOLUTION_ORDER.map((key) => solveDisplacement({ metal: stripMetal, solution: key, seconds: liveSeconds })),
    [stripMetal, liveSeconds],
  );
  const focusResult = rack[focusIndex];
  const M = METALS[stripMetal];

  useEffect(() => {
    modelRef.current.results = [];
  }, [stripMetal]);

  // Short, and on two lines: four of these share the width of the rack.
  const verdict = (r) => {
    if (armPhase !== "dipped") return ["…", null];
    if (r.reason === "reacts_with_water") return [r.complete ? "fizzed away" : "fizzing", "reacts with water"];
    if (!r.reacts) return ["no reaction", null];
    const ion = ionSymbol(METALS[r.ionMetal].symbol, METALS[r.ionMetal].charge);
    if (r.complete) return [`${METALS[r.ionMetal].label.toLowerCase()} plated out`, "done"];
    return [`displaces ${ion}`, `${(r.progress * 100).toFixed(0)}%`];
  };

  return (
    <SceneCanvas camera={{ position: [0, 2.4, 15.5], fov: 46 }} controls={{ minDistance: 5, maxDistance: 34, target: CAMERA_TARGET }}>
      <FitCamera />
      <ArmDriver
        modelRef={modelRef}
        metal={metal}
        dipToken={dip}
        timeLapse={timeLapse}
        animSpeed={speed}
        setStripMetal={setStripMetal}
        setArmPhase={setArmPhase}
        setParam={setParam}
      />

      <Bench y={BENCH_Y} width={18} depth={6.5} colour="#a9b6c8" />
      <VesselRack
        count={COUNT}
        spacing={SPACING}
        y={BENCH_Y}
        holder="pad"
        holderRadius={BEAKER.radius}
        labels={SOLUTION_ORDER.map((k) => SOLUTIONS[k].label)}
        focus={focusIndex}
        showLabels={showLabels}
        colour="#a88b68"
      >
        {SOLUTION_ORDER.map((key, i) => (
          <Solution key={key} index={i} solutionKey={key} modelRef={modelRef} animSpeed={speed} />
        ))}
      </VesselRack>

      <Gantry modelRef={modelRef} armPhase={armPhase} animSpeed={speed} />

      {SOLUTION_ORDER.map((key, i) => (
        <group key={key}>
          <Strip index={i} solutionKey={key} modelRef={modelRef} stripMetal={stripMetal} focus={i === focusIndex} animSpeed={speed} />
          <IonExchange index={i} modelRef={modelRef} animSpeed={speed} />
          <WaterFizz index={i} modelRef={modelRef} animSpeed={speed} />
          {/* In the empty liquid under the strip, on the beaker's front. */}
          <Label position={[slotX(i, COUNT, SPACING), BENCH_Y + 0.95, BEAKER.radius + 0.1]} tone={rack[i].reacts ? "text-emerald-300" : "text-ink-400"}>
            <span className="inline-block text-center align-middle">
              {verdict(rack[i])[0]}
              {verdict(rack[i])[1] && (
                <>
                  <br />
                  <span className="opacity-80">{verdict(rack[i])[1]}</span>
                </>
              )}
            </span>
          </Label>
        </group>
      ))}

      {/* The focus beaker's half-equations, hung above it. */}
      {/* The focus beaker's half-equations, in the caption rows under the bench. */}
      {focusResult.reacts && armPhase === "dipped" && (
        <>
          <Label position={[-2.6, BENCH_Y - 1.7, 2.6]} tone="text-rose-300">
            {`oxidation · ${focusResult.oxidation}`}
          </Label>
          <Label position={[2.6, BENCH_Y - 1.7, 2.6]} tone="text-sky-300">
            {`reduction · ${focusResult.reduction}`}
          </Label>
        </>
      )}
      {focusResult.reacts && focusResult.reason === "displaces" && armPhase === "dipped" && (
        <ElectronArrow
          from={[slotX(focusIndex, COUNT, SPACING) + 0.55, LIQUID_TOP - SUBMERGED + 0.2, 0.3]}
          to={[slotX(focusIndex, COUNT, SPACING) + 0.55, LIQUID_TOP - 0.25, 0.3]}
          label={showLabels ? "e⁻" : null}
          opacity={0.4 + 0.6 * clamp(focusResult.rate * focusResult.tau, 0, 1)}
        />
      )}
      {focusResult.reason === "reacts_with_water" && armPhase === "dipped" && !focusResult.complete && (
        <Halo position={[slotX(focusIndex, COUNT, SPACING), LIQUID_TOP - 0.4, 0]} radius={0.9} color="#c084fc" opacity={0.06} />
      )}

      <Label position={[0, RAIL_Y + 0.95, -0.6]} accent>
        {`automated dipping arm · ${M.label.toLowerCase()} strips · ${timeLapse}× time-lapse`}
      </Label>
      <Label position={[0, BENCH_Y - 0.6, 2.6]} tone="text-ink-400">
        {armPhase === "dipped"
          ? `${formatModelTime(liveSeconds)} in the liquid · ${M.label} E° = ${M.potential > 0 ? "+" : ""}${M.potential.toFixed(2)} V`
          : armPhase === "lifting"
            ? "lifting the strips out…"
            : `lowering fresh ${M.label.toLowerCase()} strips…`}
      </Label>
      <Label position={[0, BENCH_Y - 1.15, 2.6]} tone="text-ink-500">
        {describeOutcome(focusResult)}
      </Label>

    </SceneCanvas>
  );
}
