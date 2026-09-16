"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
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
const POST_X = 6.2;
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

function Gantry({ modelRef, armPhase, animSpeed = 1 }) {
  const bar = useRef(null);
  const slides = useRef([]);
  const led = useRef(null);
  const blink = useRef(0);

  useFrame((_, delta) => {
    const y = modelRef.current.barY;
    if (bar.current) bar.current.position.y = y;
    slides.current.forEach((s) => {
      if (!s) return;
      const len = RAIL_Y - y;
      s.position.y = y + len / 2;
      s.scale.y = len;
    });
    if (led.current) {
      blink.current += Math.min(delta, 0.05) * animSpeed * 6;
      const moving = armPhase !== "dipped";
      led.current.material.emissiveIntensity = moving ? 1.5 + Math.sin(blink.current) * 1.4 : 0.6;
      led.current.material.color.set(moving ? PALETTE.gold : PALETTE.emerald);
      led.current.material.emissive.set(moving ? PALETTE.gold : PALETTE.emerald);
    }
  });

  return (
    <group>
      {/* Posts and rail. */}
      {[-POST_X, POST_X].map((x) => (
        <mesh key={x} position={[x, (BENCH_Y + RAIL_Y) / 2, -0.6]}>
          <boxGeometry args={[0.22, RAIL_Y - BENCH_Y, 0.22]} />
          <meshStandardMaterial color="#3a4150" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, RAIL_Y, -0.6]}>
        <boxGeometry args={[POST_X * 2 + 0.22, 0.26, 0.3]} />
        <meshStandardMaterial color="#3a4150" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Motor housing with its status LED. */}
      <group position={[POST_X - 1.4, RAIL_Y + 0.45, -0.6]}>
        <mesh>
          <boxGeometry args={[1.4, 0.64, 0.64]} />
          <meshStandardMaterial color="#1e2432" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh ref={led} position={[0.45, 0.1, 0.34]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color={PALETTE.emerald} emissive={PALETTE.emerald} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      </group>

      {/* Two vertical slides carrying the crossbar — scaled to the bar's height each frame. */}
      {[-1, 1].map((side, i) => (
        <mesh
          key={side}
          ref={(el) => {
            slides.current[i] = el;
          }}
          position={[side * (POST_X - 2.2), (RAIL_Y + BAR_RAISED_Y) / 2, -0.6]}
        >
          <boxGeometry args={[0.1, 1, 0.1]} />
          <meshStandardMaterial color="#8b93a3" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      {/* The crossbar: a rail with a clip at each slot. Strips hang from it separately. */}
      <group ref={bar} position={[0, BAR_RAISED_Y, 0]}>
        <mesh position={[0, 0, -0.6]}>
          <boxGeometry args={[POST_X * 2 - 4.2, 0.16, 0.16]} />
          <meshStandardMaterial color="#8b93a3" metalness={0.85} roughness={0.25} />
        </mesh>
        {Array.from({ length: COUNT }, (_, i) => (
          <group key={i} position={[slotX(i, COUNT, SPACING), 0, 0]}>
            <mesh position={[0, 0, -0.3]}>
              <boxGeometry args={[0.2, 0.14, 0.6]} />
              <meshStandardMaterial color="#8b93a3" metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, -0.02, 0]}>
              <boxGeometry args={[0.62, 0.22, 0.2]} />
              <meshStandardMaterial color="#2f3644" metalness={0.5} roughness={0.5} />
            </mesh>
          </group>
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
  const nodules = useRef(null);
  const halo = useRef(null);
  const shown = useRef({ thickness: 1, length: 1, glow: 0 });
  const x = slotX(index, COUNT, SPACING);
  const M = METALS[stripMetal];

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

    if (body.current) {
      body.current.scale.set(1, s.length, s.thickness);
      // Shrinking a strip that hangs from its top means keeping the top put.
      body.current.position.y = -(STRIP.length * s.length) / 2;
    }
    if (halo.current) {
      halo.current.material.opacity = s.glow * 0.35;
      halo.current.position.y = -STRIP.length * s.length;
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
      <mesh ref={body} position={[0, -STRIP.length / 2, 0]} castShadow>
        <boxGeometry args={[STRIP.width, STRIP.length, STRIP.thickness]} />
        {/* Emissive, not just metalness: a metalness of 0.9 with no environment
            map has nothing to reflect and renders almost black. */}
        <meshStandardMaterial
          color={M.colour}
          metalness={stripMetal === "K" ? 0.35 : 0.6}
          roughness={stripMetal === "K" ? 0.6 : 0.32}
          emissive={M.colour}
          emissiveIntensity={focus ? 0.42 : 0.3}
        />
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
      [x + STRIP.width * 0.3, LIQUID_TOP - SUBMERGED + 0.15, STRIP.thickness / 2 + 0.05],
      [x - STRIP.width * 0.3, LIQUID_TOP - 0.2, STRIP.thickness / 2 + 0.05],
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

export default function ReactivitySeriesCanvas({ params = {}, setParam }) {
  const { metal = "Zn", solution = "cuso4", timeLapse = 10, dip = 0, speed = 1, liveSeconds = 0 } = params || {};
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

  const verdict = (r) => {
    if (armPhase !== "dipped") return "…";
    if (r.reason === "reacts_with_water") return r.complete ? "fizzed away — reacted with the water" : "fizzing — reacts with the water";
    if (!r.reacts) return "no reaction";
    if (r.complete) return `done · ${METALS[r.ionMetal].label.toLowerCase()} plated out`;
    return `${r.metal} displaces ${ionSymbol(METALS[r.ionMetal].symbol, METALS[r.ionMetal].charge)} · ${(r.progress * 100).toFixed(0)}%`;
  };

  return (
    <SceneCanvas camera={{ position: [0, 2.4, 13.8], fov: 46 }} controls={{ minDistance: 5, maxDistance: 30, target: [0, 0.4, 0] }}>
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

      <Bench y={BENCH_Y} width={18} depth={6.5} />
      <VesselRack
        count={COUNT}
        spacing={SPACING}
        y={BENCH_Y}
        holder="pad"
        holderRadius={BEAKER.radius}
        labels={SOLUTION_ORDER.map((k) => SOLUTIONS[k].label)}
        focus={focusIndex}
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
          <SceneLabel position={[slotX(i, COUNT, SPACING), BENCH_Y + BEAKER.height + 0.55, 0]} tone={rack[i].reacts ? "text-emerald-300" : "text-ink-400"}>
            {verdict(rack[i])}
          </SceneLabel>
        </group>
      ))}

      {/* The focus beaker's half-equations, hung above it. */}
      {focusResult.reacts && armPhase === "dipped" && (
        <>
          <SceneLabel position={[slotX(focusIndex, COUNT, SPACING), BENCH_Y + BEAKER.height + 1.25, 0]} tone="text-rose-300">
            {`oxidation · ${focusResult.oxidation}`}
          </SceneLabel>
          <SceneLabel position={[slotX(focusIndex, COUNT, SPACING), BENCH_Y + BEAKER.height + 0.9, 0]} tone="text-sky-300">
            {`reduction · ${focusResult.reduction}`}
          </SceneLabel>
        </>
      )}
      {focusResult.reacts && focusResult.reason === "displaces" && armPhase === "dipped" && (
        <ElectronArrow
          from={[slotX(focusIndex, COUNT, SPACING) + 0.55, LIQUID_TOP - SUBMERGED + 0.2, 0.3]}
          to={[slotX(focusIndex, COUNT, SPACING) + 0.55, LIQUID_TOP - 0.25, 0.3]}
          opacity={0.4 + 0.6 * clamp(focusResult.rate * focusResult.tau, 0, 1)}
        />
      )}
      {focusResult.reason === "reacts_with_water" && armPhase === "dipped" && !focusResult.complete && (
        <Halo position={[slotX(focusIndex, COUNT, SPACING), LIQUID_TOP - 0.4, 0]} radius={0.9} color="#c084fc" opacity={0.06} />
      )}

      <SceneLabel position={[0, RAIL_Y + 0.95, -0.6]} accent>
        {`automated dipping arm · ${M.label.toLowerCase()} strips · ${timeLapse}× time-lapse`}
      </SceneLabel>
      <SceneLabel position={[0, BENCH_Y - 0.6, 2.6]} tone="text-ink-400">
        {armPhase === "dipped"
          ? `${formatModelTime(liveSeconds)} in the liquid · ${M.label} E° = ${M.potential > 0 ? "+" : ""}${M.potential.toFixed(2)} V`
          : armPhase === "lifting"
            ? "lifting the strips out…"
            : `lowering fresh ${M.label.toLowerCase()} strips…`}
      </SceneLabel>
      <SceneLabel position={[0, BENCH_Y - 1.0, 2.6]} tone="text-ink-500">
        {describeOutcome(focusResult)}
      </SceneLabel>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Reactivity series"
        subtitle={`${M.label} in four solutions`}
        rows={rack.map((r) => [SOLUTIONS[r.solution].short, r.reacts ? r.ionic : "no reaction", r.reacts ? "good" : undefined])}
      />
      <SceneLegend
        title="Key"
        items={[
          { color: M.colour, label: `${M.label} strip`, note: "the same metal in every beaker" },
          { color: ION_APPEARANCE.Cu.colour, label: "Cu²⁺(aq)", note: "the blue that fades when copper plates out" },
          { color: ION_APPEARANCE.Fe.colour, label: "Fe²⁺(aq)", note: "pale green" },
          { color: PALETTE.bone, label: "Electron", note: "moves inside the metal, never through the solution" },
        ]}
      />
    </SceneCanvas>
  );
}
