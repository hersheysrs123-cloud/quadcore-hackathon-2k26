"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import {
  Bench,
  BubbleColumn,
  ElectronArrow,
  ElectronStream,
  TestTube,
  VesselRack,
  relaxTo,
  slotX,
} from "@/components/visualizations/vessel-rack";
import {
  ELECTROLYTES,
  IRON_POTENTIAL_V,
  MAX_DAYS,
  MIN_DAYS,
  PARTNERS,
  RUST_EQUATIONS,
  TUBES,
  dayLabel,
  mixHex,
  solveRusting,
} from "@/lib/redox";

// ─── Rusting, and how to stop it ────────────────────────────────────
// Four test tubes in a rack, an identical iron nail in each:
//
//   1  water and air              — the control; it rusts
//   2  boiled water under oil     — no oxygen; it does not
//   3  desiccant and a stopper    — no water; it does not
//   4  water and air, but wrapped — a second metal decides what happens
//
// Tubes 1–3 are the classic proof that rusting needs BOTH water and
// oxygen: take either away and the nail stays bright. Tube 4 is the
// sequel — wrap the nail in zinc or magnesium and the more reactive metal
// gives up its electrons instead, so the nail stays bright while the wrap
// wastes away (sacrificial protection); wrap it in copper and the nail is
// now the more reactive of the pair, and rusts faster than it did alone.
//
// The time-lapse slider is the clock. `lib/redox.js` says what each nail
// looks like after that many days; this file draws it — a rust crust
// thickening from the waterline down, the wrap thinning, electrons on the
// move between the two metals — and eases between days so dragging the
// slider is a film rather than a slideshow.
// ─────────────────────────────────────────────────────────────────────

const BENCH_Y = -2.4;
const COUNT = 4;
const SPACING = 2.7;
const RACK_HEIGHT = 2.0;
const TUBE = { radius: 0.52, height: 4.5 };
const TUBE_Y = BENCH_Y + 0.12;
/** Water depth from the top of the hemispherical bottom. */
const WATER_OPEN = 2.15;
const WATER_FULL = 3.05;
const OIL = 0.32;
const NAIL = { shank: 2.3, radius: 0.11, head: 0.22, tip: 0.3 };
/** The nail stands on the bottom of the tube, leaning on the wall. */
const NAIL_BASE_Y = TUBE.radius * 0.55;
const NAIL_LEAN = 0.1;
const FLAKES = 34;
const WRAP_RINGS = 5;
/** Days per real second while the time-lapse plays. */
const PLAY_RATE = 2.2;

const SCRATCH_OBJECT = new THREE.Object3D();
const SCRATCH_COLOUR = new THREE.Color();

/** y of the water surface inside a tube, relative to the tube group. */
const waterTop = (depth) => TUBE.radius + depth;
/** y along the nail (from the nail base) where a tube's waterline crosses it. */
const nailWaterline = (depth) => waterTop(depth) - NAIL_BASE_Y - NAIL.tip;

// ─── The clock ──────────────────────────────────────────────────────

/**
 * Keeps `shown.days` — the day the scene is drawing — moving. Parked, it
 * eases toward the slider; playing, it runs at `PLAY_RATE` days per second
 * and pushes each whole day back to the slider, switching itself off at
 * day 30. Also solves the whole rack once per frame into `m.result`, so
 * every nail reads the same numbers.
 *
 * Same contract as `timeline-kit`'s scrub: a slider value the driver did
 * not push is the user dragging, so the film jumps there and pauses rather
 * than snatching the slider back on its next tick.
 */
function RustDriver({ modelRef, days, electrolyte, partner, playing, animSpeed = 1, setParam }) {
  const seen = useRef({ days, playing });
  const push = (key, value) => {
    if (typeof setParam === "function") setParam(key, value);
  };

  useFrame((_, delta) => {
    const m = modelRef.current;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const dayChanged = days !== seen.current.days;
    seen.current.days = days;

    if (playing !== seen.current.playing) {
      seen.current.playing = playing;
      m.stopRequested = false;
      // Pressing play at the end starts the film again.
      if (playing && days >= MAX_DAYS) {
        m.shownDays = MIN_DAYS;
        m.pushedDay = MIN_DAYS;
        push("days", MIN_DAYS);
      }
    }

    if (playing && dayChanged && days !== m.pushedDay) {
      // Scrubbed mid-film: go there and stop.
      m.shownDays = days;
      m.pushedDay = days;
      m.stopRequested = true;
      push("playing", false);
    } else if (playing) {
      m.shownDays = Math.min(MAX_DAYS, m.shownDays + dt * PLAY_RATE);
      const whole = Math.floor(m.shownDays);
      if (whole !== m.pushedDay) {
        m.pushedDay = whole;
        push("days", whole);
      }
      if (m.shownDays >= MAX_DAYS && !m.stopRequested) {
        m.stopRequested = true;
        push("playing", false);
      }
    } else {
      if (dayChanged) m.pushedDay = days;
      m.shownDays = relaxTo(m.shownDays, days, 0.25, dt);
    }

    m.result = solveRusting({ days: m.shownDays, electrolyte, partner });
  });

  return null;
}

// ─── The nail ───────────────────────────────────────────────────────

/**
 * One nail and the rust on it. The rust is two things: a crust (a shell
 * round the shank whose radius is the rust thickness and whose opacity is
 * the coverage) and flakes (instanced, each with its own threshold so the
 * nail speckles before it browns). Flakes near the waterline come first,
 * because that is where water and oxygen are both plentiful — the reason a
 * real nail rusts worst at the surface of the water.
 */
function Nail({ tubeIndex, modelRef, waterline, animSpeed = 1, children }) {
  const crust = useRef(null);
  const flakes = useRef(null);
  const shown = useRef({ coverage: 0, thickness: 0 });

  const seeds = useMemo(
    () =>
      Array.from({ length: FLAKES }, (_, i) => {
        const y = 0.1 + hashRandom(i * 3.3 + 1) * (NAIL.shank - 0.2);
        const a = hashRandom(i * 5.1 + 2) * Math.PI * 2;
        // Distance from the waterline pushes a flake's threshold up; a
        // waterline off the nail (tube 3) leaves the thresholds uniform.
        const bias = waterline === null ? 0 : clamp(Math.abs(y - waterline) / NAIL.shank, 0, 1) * 0.45;
        return {
          y,
          a,
          threshold: hashRandom(i * 7.7 + 3) * 0.6 + bias,
          size: 0.05 + hashRandom(i * 9.9 + 4) * 0.06,
          tint: hashRandom(i * 11.1 + 5),
        };
      }),
    [waterline],
  );

  useFrame((_, delta) => {
    const m = modelRef.current;
    const tube = m.result?.tubes[tubeIndex];
    if (!tube) return;
    const dt = Math.min(delta, 0.05) * animSpeed;
    const s = shown.current;
    s.coverage = relaxTo(s.coverage, tube.coverage, 0.35, dt);
    // 150 µm of rust is drawn as a crust 0.06 world units proud of the shank,
    // capped so the thickest crust still sits inside the wrap's rings.
    s.thickness = relaxTo(s.thickness, clamp(tube.rustThicknessUm / 150, 0, 1.2) * 0.06, 0.35, dt);

    if (crust.current) {
      const r = (NAIL.radius + 0.004 + s.thickness) / NAIL.radius;
      crust.current.scale.set(r, 1, r);
      crust.current.material.opacity = s.coverage * 0.92;
      SCRATCH_COLOUR.set(mixHex("#c2410c", "#6b2a12", clamp(s.thickness / 0.06, 0, 1)));
      crust.current.material.color.copy(SCRATCH_COLOUR);
    }

    const mesh = flakes.current;
    if (mesh) {
      for (let i = 0; i < FLAKES; i += 1) {
        const seed = seeds[i];
        const grow = clamp((s.coverage - seed.threshold) / 0.2, 0, 1);
        const scale = seed.size * grow * (1 + s.thickness * 6);
        const rad = NAIL.radius + s.thickness + 0.01;
        SCRATCH_OBJECT.position.set(Math.cos(seed.a) * rad, seed.y, Math.sin(seed.a) * rad);
        SCRATCH_OBJECT.rotation.set(seed.a, seed.y, 0);
        SCRATCH_OBJECT.scale.set(scale, scale * 0.6, scale);
        SCRATCH_OBJECT.updateMatrix();
        mesh.setMatrixAt(i, SCRATCH_OBJECT.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={[NAIL_LEAN * 0.4, NAIL_BASE_Y, 0]} rotation={[0, 0, -NAIL_LEAN]}>
      {/* Tip, shank, head. */}
      <mesh position={[0, NAIL.tip / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[NAIL.radius, NAIL.tip, 16]} />
        <meshStandardMaterial color="#8e97a6" emissive="#8e97a6" emissiveIntensity={0.3} metalness={0.6} roughness={0.38} />
      </mesh>
      <group position={[0, NAIL.tip, 0]}>
        <mesh position={[0, NAIL.shank / 2, 0]} castShadow>
          <cylinderGeometry args={[NAIL.radius, NAIL.radius, NAIL.shank, 20]} />
          <meshStandardMaterial color="#8e97a6" emissive="#8e97a6" emissiveIntensity={0.3} metalness={0.6} roughness={0.38} />
        </mesh>
        <mesh position={[0, NAIL.shank + 0.04, 0]}>
          <cylinderGeometry args={[NAIL.head, NAIL.head * 0.9, 0.08, 20]} />
          <meshStandardMaterial color="#8e97a6" emissive="#8e97a6" emissiveIntensity={0.3} metalness={0.6} roughness={0.38} />
        </mesh>
        {/* The rust crust — scaled out from the shank as it thickens. */}
        <mesh ref={crust} position={[0, NAIL.shank / 2, 0]}>
          <cylinderGeometry args={[NAIL.radius, NAIL.radius, NAIL.shank + 0.02, 20]} />
          <meshStandardMaterial color="#c2410c" transparent opacity={0} roughness={1} metalness={0} depthWrite={false} />
        </mesh>
        <instancedMesh ref={flakes} args={[undefined, undefined, FLAKES]} frustumCulled={false}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#b45309" roughness={1} metalness={0} />
        </instancedMesh>
        {children}
      </group>
    </group>
  );
}

/**
 * The ribbon wrapped round the nail in tube 4: rings that thin as the
 * metal is used up, whitening as zinc or magnesium turn to their hydroxides.
 * Copper neither thins nor whitens — it is the cathode, and nothing happens
 * to a cathode.
 */
function Wrap({ modelRef, partner, animSpeed = 1 }) {
  const rings = useRef([]);
  const shown = useRef({ remaining: 1 });
  const P = PARTNERS[partner] ?? PARTNERS.zinc;

  useFrame((_, delta) => {
    const couple = modelRef.current.result?.couple;
    if (!couple) return;
    const dt = Math.min(delta, 0.05) * animSpeed;
    shown.current.remaining = relaxTo(shown.current.remaining, couple.partnerRemainingFraction, 0.35, dt);
    const rem = shown.current.remaining;
    const thickness = 0.35 + 0.65 * Math.sqrt(Math.max(rem, 0.02));
    SCRATCH_COLOUR.set(mixHex(P.colour, P.corroded, P.protects ? 1 - rem : 0));
    rings.current.forEach((ring) => {
      if (!ring) return;
      ring.scale.set(1, 1, thickness);
      ring.material.color.copy(SCRATCH_COLOUR);
      ring.visible = rem > 0.01;
    });
  });

  return (
    <group>
      {Array.from({ length: WRAP_RINGS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            rings.current[i] = el;
          }}
          position={[0, 0.55 + i * 0.16, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[NAIL.radius + 0.1, 0.045, 10, 28]} />
          <meshStandardMaterial color={P.colour} emissive={P.colour} emissiveIntensity={0.32} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/** Salt crystals on the floor of a tube, drawn only for the brine. */
function SaltCrystals({ visible }) {
  const crystals = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = hashRandom(i * 4.3 + 31) * Math.PI * 2;
        const r = hashRandom(i * 6.7 + 37) * (TUBE.radius - 0.2);
        return { position: [Math.cos(a) * r, TUBE.radius * 0.45 + hashRandom(i * 8.1 + 41) * 0.08, Math.sin(a) * r], scale: 0.04 + hashRandom(i * 9.7 + 43) * 0.04, spin: hashRandom(i * 2.9 + 47) * Math.PI };
      }),
    [],
  );
  if (!visible) return null;
  return (
    <group>
      {crystals.map((c, i) => (
        <mesh key={i} position={c.position} scale={c.scale} rotation={[0, c.spin, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** One tube, its contents, and its label. */
function Tube({ index, modelRef, electrolyte, partner, animSpeed = 1 }) {
  const spec = TUBES[index];
  const x = slotX(index, COUNT, SPACING);
  const liquid = useRef(null);
  const tint = useRef(0);
  const depth = spec.key === "deoxygenated" ? WATER_FULL : spec.h2o ? WATER_OPEN : 0;
  const waterline = spec.h2o ? clamp(nailWaterline(depth), 0, NAIL.shank) : null;

  useFrame((_, delta) => {
    const tube = modelRef.current.result?.tubes[index];
    const group = liquid.current;
    if (!tube || !group) return;
    const dt = Math.min(delta, 0.05) * animSpeed;
    tint.current = relaxTo(tint.current, clamp(tube.rustFormedMg / 120, 0, 1), 0.4, dt);
    SCRATCH_COLOUR.set(mixHex("#c9e3ec", "#b4562a", tint.current * 0.75));
    group.traverse((o) => {
      if (o.material) {
        o.material.color.copy(SCRATCH_COLOUR);
        o.material.opacity = 0.14 + tint.current * 0.3;
      }
    });
  });

  const coupled = spec.key === "coupled";
  const P = PARTNERS[partner] ?? PARTNERS.zinc;
  // Electrons leave whichever metal is higher in the series.
  const toIron = P.potential < IRON_POTENTIAL_V;
  // World-space path for the electrons: between the wrap and the nail head.
  const wrapY = TUBE_Y + NAIL_BASE_Y + NAIL.tip + 0.55 + (WRAP_RINGS * 0.16) / 2;
  const headY = TUBE_Y + NAIL_BASE_Y + NAIL.tip + NAIL.shank - 0.1;
  const electronPath = useMemo(() => {
    const a = [x + NAIL.radius + 0.15, wrapY, 0.12];
    const b = [x + NAIL.radius + 0.03, headY, 0.12];
    return toIron ? [a, b] : [b, a];
  }, [x, wrapY, headY, toIron]);

  return (
    <group position={[x, TUBE_Y, 0]}>
      <TestTube
        radius={TUBE.radius}
        height={TUBE.height}
        liquid={depth}
        liquidRef={liquid}
        oil={spec.key === "deoxygenated" ? OIL : 0}
        stopper={spec.key === "dry"}
        desiccant={spec.key === "dry"}
      >
        <SaltCrystals visible={spec.h2o && electrolyte === "saltwater"} />
        <Nail tubeIndex={index} modelRef={modelRef} waterline={waterline} animSpeed={animSpeed}>
          {coupled && <Wrap modelRef={modelRef} partner={partner} animSpeed={animSpeed} />}
        </Nail>
        {coupled && partner === "magnesium" && (
          <BubbleColumn origin={[NAIL.radius + 0.12, NAIL_BASE_Y + NAIL.tip + 0.7, 0]} top={waterTop(depth) - 0.02} rate={0.5} spread={0.18} count={10} animSpeed={animSpeed} />
        )}
      </TestTube>

      {coupled && (
        <group position={[-x, -TUBE_Y, 0]}>
          <ElectronStream path={electronPath} count={7} rate={0.5} running intensity={1} colour={PALETTE.bone} size={0.045} animSpeed={animSpeed} />
          <ElectronArrow
            from={[x + TUBE.radius + 0.35, toIron ? wrapY : headY, 0]}
            to={[x + TUBE.radius + 0.35, toIron ? headY : wrapY, 0]}
            label={toIron ? `e⁻ ${P.symbol} → Fe` : `e⁻ Fe → ${P.symbol}`}
            colour={toIron ? PALETTE.emerald : PALETTE.rose}
          />
        </group>
      )}
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function RustingGalvanicCanvas({ params = {}, setParam }) {
  const { days = 7, electrolyte = "distilled", partner = "zinc", playing = false, speed = 1 } = params || {};
  const modelRef = useRef(null);
  if (modelRef.current === null) {
    modelRef.current = { shownDays: days, pushedDay: days, stopRequested: false, result: solveRusting({ days, electrolyte, partner }) };
  }

  const result = useMemo(() => solveRusting({ days, electrolyte, partner }), [days, electrolyte, partner]);
  const E = ELECTROLYTES[electrolyte] ?? ELECTROLYTES.distilled;
  const P = PARTNERS[partner] ?? PARTNERS.zinc;
  const couple = result.couple;

  const tubeLabel = (tube) => {
    if (!tube.rusts) return tube.verdict;
    if (tube.key === "coupled") {
      if (!couple.protects) return `accelerated · ${tube.rustThicknessUm.toFixed(0)} µm rust`;
      if (couple.partnerExhausted) return `${P.label.toLowerCase()} used up · ${tube.rustThicknessUm.toFixed(1)} µm rust`;
      return `protected · ${tube.rustThicknessUm.toFixed(1)} µm`;
    }
    return `${tube.rustThicknessUm.toFixed(0)} µm rust · ${(tube.coverage * 100).toFixed(0)}% covered`;
  };

  return (
    <SceneCanvas camera={{ position: [0, 1.8, 12.4], fov: 46 }} controls={{ minDistance: 4, maxDistance: 28, target: [0, 0.5, 0] }}>
      <RustDriver modelRef={modelRef} days={days} electrolyte={electrolyte} partner={partner} playing={playing} animSpeed={speed} setParam={setParam} />

      <Bench y={BENCH_Y} width={16} depth={6} />
      <VesselRack
        count={COUNT}
        spacing={SPACING}
        y={BENCH_Y}
        holder="ring"
        holderRadius={TUBE.radius}
        holderHeight={RACK_HEIGHT}
        labels={TUBES.map((t, i) => `${i + 1} · ${t.short}`)}
        focus={3}
      />

      {TUBES.map((tube, i) => (
        <group key={tube.key}>
          <Tube index={i} modelRef={modelRef} electrolyte={electrolyte} partner={partner} animSpeed={speed} />
          <SceneLabel position={[slotX(i, COUNT, SPACING), TUBE_Y + TUBE.height + 0.55, 0]} tone={tube.rusts ? (tube.key === "coupled" && couple.protects && !couple.partnerExhausted ? "text-emerald-300" : "text-orange-300") : "text-sky-300"}>
            {tubeLabel(result.tubes[i])}
          </SceneLabel>
          <SceneLabel position={[slotX(i, COUNT, SPACING), TUBE_Y + TUBE.height + 0.9, 0]} tone="text-ink-400">
            {tube.label}
          </SceneLabel>
        </group>
      ))}

      {/* The coupled tube's half-equations. */}
      <SceneLabel position={[slotX(3, COUNT, SPACING) + 0.2, BENCH_Y - 0.6, 2.2]} tone="text-rose-300">
        {`anode (${couple.anode}) · ${couple.oxidation}`}
      </SceneLabel>
      <SceneLabel position={[slotX(3, COUNT, SPACING) + 0.2, BENCH_Y - 0.95, 2.2]} tone="text-sky-300">
        {`cathode (${couple.cathode}) · ${couple.reduction}`}
      </SceneLabel>

      {/* Tube 1's overall equation. */}
      <SceneLabel position={[slotX(0, COUNT, SPACING) + 0.6, BENCH_Y - 0.6, 2.2]} tone="text-orange-300">
        {RUST_EQUATIONS.overall}
      </SceneLabel>
      <SceneLabel position={[slotX(0, COUNT, SPACING) + 0.6, BENCH_Y - 0.95, 2.2]} tone="text-ink-400">
        {`${result.tubes[0].ironLostMg.toFixed(1)} mg of iron lost · ${result.tubes[0].rustFormedMg.toFixed(1)} mg of rust`}
      </SceneLabel>

      <SceneLabel position={[0, TUBE_Y + TUBE.height + 1.5, 0]} accent>
        {`${dayLabel(days)} of ${MAX_DAYS} · ${E.label} · nail 4 wrapped in ${P.label.toLowerCase()}${playing ? " · playing" : ""}`}
      </SceneLabel>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Rusting & sacrificial protection"
        subtitle={`${dayLabel(days)} · ${E.label}`}
        rows={result.tubes.map((t) => [`${t.short}`, t.rusts ? `${t.rustThicknessUm.toFixed(1)} µm` : "no rust", t.rusts ? (t.key === "coupled" && couple.protects ? "good" : "bad") : "good"])}
      />
      <SceneLegend
        title="Key"
        items={[
          { color: "#c2410c", label: "Rust, Fe₂O₃·xH₂O", note: "needs water AND oxygen" },
          { color: "#f4d35e", label: "Paraffin oil", note: "seals the boiled water from the air" },
          { color: "#eef2f6", label: "Desiccant", note: "keeps tube 3 dry" },
          { color: P.colour, label: `${P.label} wrap`, note: P.protects ? "the sacrificial anode" : "the cathode — the nail corrodes for it" },
          { color: PALETTE.bone, label: "Electron", note: "flows from the more reactive metal to the less" },
        ]}
      />
    </SceneCanvas>
  );
}
