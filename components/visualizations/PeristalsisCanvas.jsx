"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  VectorArrow,
  clamp,
} from "@/components/visualizations/scene-kit";
import { makeBlobGeometry } from "@/components/visualizations/cell-organelles";
import { ProfiledTube, TubeFlow, TubeRings } from "@/components/visualizations/tube-transit";
import { profileRadius, squeezeBody } from "@/lib/tubeTransit";
import {
  CONSISTENCIES,
  DELIVERED_HOLD_S,
  LUMEN_RADIUS_CM,
  ORIENTATIONS,
  SWALLOW_DELAY_S,
  TUBE_LENGTH_CM,
  consistencyFor,
  layerActivation,
  lumenFeatures,
  orientationFor,
  transitAt,
} from "@/lib/peristalsis";

// ─── Peristalsis ────────────────────────────────────────────────────
// A length of gut stood on end: a glassy lumen you can see the bolus
// through, a ring of circular muscle every centimetre, and longitudinal
// fibres running down the outside. Press "swallow" and a wave runs down it.
//
// The wave is a clock in `lib/peristalsis.js`; the scene reads the clock
// every frame and writes the answer straight into the geometry — the lumen
// narrows where the circular layer is contracting, the rings there fatten
// and flush, the fibres AHEAD of the bolus brighten and the rings there
// bunch up as the segment shortens and opens. All of it is the shared
// tube kit from `tube-transit.jsx`, rewritten in place; nothing allocates
// per frame.
//
// Gravity is a separate group. Flip it and the whole tube turns over while
// the wave carries on regardless — which is the demonstration.
// ─────────────────────────────────────────────────────────────────────

/** World units per centimetre of gut. */
const SCALE = 0.3;
const TUBE_LENGTH = TUBE_LENGTH_CM * SCALE;
const LUMEN_RADIUS = LUMEN_RADIUS_CM * SCALE;
const WALL_THICKNESS = 0.07;
const RING_COUNT = 30;
const FIBRE_COUNT = 10;
const FIBRE_RADIUS = 0.032;
/** The ring never quite shuts: the lumen keeps this much radius, cm. */
const LUMEN_FLOOR_CM = 0.12;

/** How often the scene reports to the HUD, seconds. */
const PUSH_EVERY_S = 0.1;

const COLOURS = {
  mucosa: "#f4b8c1",
  wall: "#d98a94",
  circularRelaxed: "#8e3a48",
  circularContracted: "#ff5a6e",
  longitudinalRelaxed: "#8a5a2a",
  longitudinalContracted: "#fbbf24",
  liquid: "#7dd3fc",
  soft: "#c9a26b",
  dry: "#8b6b3e",
  stomach: "#c97b8c",
  gravity: PALETTE.slate,
};

const RELAXED_C = new THREE.Color(COLOURS.circularRelaxed);
const CONTRACTED_C = new THREE.Color(COLOURS.circularContracted);
const RELAXED_L = new THREE.Color(COLOURS.longitudinalRelaxed);
const CONTRACTED_L = new THREE.Color(COLOURS.longitudinalContracted);

const easeInOut = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

// ─── Bolus textures ─────────────────────────────────────────────────

function makeBolusTexture(kind) {
  if (typeof document === "undefined") return null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const base = kind === "liquid" ? "#93c5fd" : kind === "dry" ? "#7a5a30" : "#c9a26b";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const seeded = (i) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  if (kind === "liquid") {
    for (let i = 0; i < 40; i += 1) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.08 + 0.2 * seeded(i)).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(seeded(i * 3) * size, seeded(i * 5) * size, 4 + seeded(i * 7) * 10, 2 + seeded(i * 11) * 5, seeded(i) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Mottled chewed food: dark and light flecks, coarser and drier for the dry bolus.
    const flecks = kind === "dry" ? 140 : 90;
    for (let i = 0; i < flecks; i += 1) {
      const light = seeded(i * 13) > 0.5;
      ctx.fillStyle = light ? `rgba(245, 222, 179, ${(0.25 + 0.4 * seeded(i)).toFixed(3)})` : `rgba(60, 35, 15, ${(0.2 + 0.4 * seeded(i * 2)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(seeded(i * 3) * size, seeded(i * 5) * size, 2 + seeded(i * 7) * (kind === "dry" ? 7 : 5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ─── The clock ──────────────────────────────────────────────────────

/**
 * Drives the swallow. Phases: `idle` (nothing in the tube), `swallow` (the
 * bolus arrives at the top), `transit` (the wave runs, gut seconds at
 * `speed` × wall seconds), `delivered` (a beat, then idle). A press of the
 * button restarts from `swallow` whatever is happening; the first swallow
 * plays on its own so the scene is never found empty.
 */
function PeristalsisDriver({ trigger, consistency, orientation, speed, live, setParam }) {
  const clock = useRef({
    phase: "swallow",
    phaseT: 0,
    gutT: 0,
    trigger,
    lastPush: -1,
    pushed: { phase: null, wave: null, bolus: null, speed: null, ahead: null },
  });

  useFrame((_, rawDelta) => {
    const c = clock.current;
    const dt = Math.min(rawDelta, 1 / 30) * speed;
    c.phaseT += dt;

    if (trigger !== c.trigger) {
      c.trigger = trigger;
      c.phase = "swallow";
      c.phaseT = 0;
      c.gutT = 0;
    }

    if (c.phase === "swallow" && c.phaseT >= SWALLOW_DELAY_S) {
      c.phase = "transit";
      c.phaseT = 0;
      c.gutT = 0;
    } else if (c.phase === "transit") {
      c.gutT += dt;
      const st = transitAt(consistency, orientation, c.gutT);
      if (st.complete) {
        c.phase = "delivered";
        c.phaseT = 0;
      }
    } else if (c.phase === "delivered" && c.phaseT >= DELIVERED_HOLD_S) {
      c.phase = "idle";
      c.phaseT = 0;
    }

    // What the geometry reads this frame.
    const l = live.current;
    l.phase = c.phase;
    if (c.phase === "transit" || c.phase === "delivered") {
      l.state = transitAt(consistency, orientation, c.gutT);
      l.arrival = 1;
    } else if (c.phase === "swallow") {
      l.state = transitAt(consistency, orientation, 0);
      l.arrival = easeInOut(c.phaseT / SWALLOW_DELAY_S);
    } else {
      l.state = null;
      l.arrival = 0;
    }
    // The bolus fades out into the stomach once delivered, and in at the top on a swallow.
    l.presence = c.phase === "idle" ? 0 : c.phase === "delivered" ? 1 - easeInOut(c.phaseT / DELIVERED_HOLD_S) : c.phase === "swallow" ? l.arrival : 1;
    // Flip smoothly between orientations; the wave does not care.
    const targetFlip = orientationFor(orientation).gravitySign < 0 ? Math.PI : 0;
    l.flip += (targetFlip - l.flip) * (1 - Math.exp(-Math.min(rawDelta, 1 / 30) * 5));

    // Report to the HUD, ten times a second, only what changed.
    if (typeof setParam !== "function") return;
    const due = c.phaseT - c.lastPush >= PUSH_EVERY_S || c.lastPush < 0 || c.phaseT < c.lastPush;
    if (!due) return;
    c.lastPush = c.phaseT;
    const st = l.state;
    const wave = st ? Math.round(clamp(st.constriction, 0, TUBE_LENGTH_CM) * 10) / 10 : null;
    const bolus = st ? Math.round(st.bolus * 10) / 10 : null;
    const spd = st && c.phase === "transit" ? Math.round(st.bolusSpeed * 100) / 100 : 0;
    const ahead = st ? Math.round(st.ahead * 10) / 10 : 0;
    const p = c.pushed;
    if (p.phase !== c.phase) setParam("livePhase", c.phase);
    if (p.wave !== wave) setParam("liveWave", wave);
    if (p.bolus !== bolus) setParam("liveBolus", bolus);
    if (p.speed !== spd) setParam("liveSpeed", spd);
    if (p.ahead !== ahead) setParam("liveAhead", ahead);
    p.phase = c.phase;
    p.wave = wave;
    p.bolus = bolus;
    p.speed = spd;
    p.ahead = ahead;
  });

  return null;
}

// ─── The gut ────────────────────────────────────────────────────────

/** Follows a station along the tube so an Html label can ride the wave. */
function Follower({ live, pick, children, offset = [0, 0, 0] }) {
  const ref = useRef(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const s = pick(live.current);
    if (s === null) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(offset[0], clamp(s, 0, TUBE_LENGTH_CM) * SCALE + offset[1], offset[2]);
  });
  return <group ref={ref}>{children}</group>;
}

function Bolus({ consistency, live, texture }) {
  const c = consistencyFor(consistency);
  const geometry = useMemo(
    () =>
      makeBlobGeometry({
        radius: 1,
        amp: consistency === "dry" ? 0.2 : consistency === "soft" ? 0.07 : 0.02,
        freq: consistency === "dry" ? 2.6 : 1.6,
        seed: consistency === "dry" ? 7 : 3,
        segments: 36,
        rings: 24,
      }),
    [consistency],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const ref = useRef(null);
  const wallRadius = useMemo(() => (s) => profileRadius(s, LUMEN_RADIUS_CM, lumenFeatures(live.current.state, consistency), LUMEN_FLOOR_CM), [live, consistency]);

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const l = live.current;
    const st = l.state;
    if (!st || l.presence <= 0.001) {
      m.visible = false;
      return;
    }
    m.visible = true;
    // Squeeze into the lumen where the bolus is; a liquid slug also stretches
    // back to the ring that is pushing it.
    const r = wallRadius(st.bolus);
    const body = squeezeBody(c.restRadius, c.restHalf, r, c.compliance);
    const stretch = consistency === "liquid" ? st.ahead : consistency === "soft" ? st.ahead * 0.4 : 0;
    const length = body.length + stretch;
    const centre = st.bolus - stretch / 2;
    const wobble = consistency === "liquid" ? 0.04 * Math.sin(clock.elapsedTime * 9) : 0;
    m.position.set(0, centre * SCALE, 0);
    m.scale.set((body.radius + wobble) * SCALE * l.presence, (length / 2) * SCALE * l.presence, (body.radius - wobble) * SCALE * l.presence);
  });

  const colour = consistency === "liquid" ? COLOURS.liquid : consistency === "dry" ? COLOURS.dry : COLOURS.soft;
  return (
    <mesh ref={ref} geometry={geometry} castShadow>
      <meshStandardMaterial
        color={colour}
        map={texture ?? undefined}
        emissive={colour}
        emissiveIntensity={0.18}
        roughness={consistency === "liquid" ? 0.15 : consistency === "dry" ? 0.9 : 0.6}
        metalness={consistency === "liquid" ? 0.1 : 0}
        transparent={consistency === "liquid"}
        opacity={consistency === "liquid" ? 0.85 : 1}
      />
    </mesh>
  );
}

/** A longitudinal muscle fibre lying on the outside of the wall, thickening where it contracts. */
function LongitudinalFibre({ index, live, outerRadius }) {
  const angle = (index / FIBRE_COUNT) * Math.PI * 2;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const centreAt = useMemo(
    () => (s, out) => {
      const R = outerRadius(s) + FIBRE_RADIUS * 0.8;
      out[0] = R * cosA;
      out[1] = R * sinA;
    },
    [outerRadius, cosA, sinA],
  );
  const radiusAt = useMemo(
    () => (s) => {
      const a = layerActivation(s / SCALE, live.current.state).longitudinal;
      return FIBRE_RADIUS * (1 + 0.9 * a);
    },
    [live],
  );
  const colourAt = useMemo(() => {
    const tmp = new THREE.Color();
    return (s, out) => {
      const a = layerActivation(s / SCALE, live.current.state).longitudinal;
      tmp.copy(RELAXED_L).lerp(CONTRACTED_L, a);
      out[0] = tmp.r;
      out[1] = tmp.g;
      out[2] = tmp.b;
    };
  }, [live]);
  return (
    <ProfiledTube length={TUBE_LENGTH} rings={72} segments={7} radiusAt={radiusAt} centreAt={centreAt} colourAt={colourAt} dynamic>
      <meshStandardMaterial vertexColors roughness={0.55} emissive="#ffffff" emissiveIntensity={0.08} />
    </ProfiledTube>
  );
}

function Gut({ live, consistency, texture }) {
  // Lumen radius in world units at world station s; the wall sits outside it.
  const lumenRadius = useMemo(
    () => (s) => profileRadius(s / SCALE, LUMEN_RADIUS_CM, lumenFeatures(live.current.state, consistency), LUMEN_FLOOR_CM) * SCALE,
    [live, consistency],
  );
  const wallRadius = useMemo(() => (s) => lumenRadius(s) + WALL_THICKNESS, [lumenRadius]);
  const ringRadius = useMemo(() => (s) => wallRadius(s) + 0.01, [wallRadius]);
  const ringThickness = useMemo(
    () => (s) => {
      const a = layerActivation(s / SCALE, live.current.state).circular;
      return 0.045 * (1 + 1.3 * a);
    },
    [live],
  );
  // Rings bunch towards the longitudinal zone as that segment shortens.
  const ringStation = useMemo(
    () => (i) => {
      const s0 = ((i + 0.5) / RING_COUNT) * TUBE_LENGTH;
      const st = live.current.state;
      if (!st) return s0;
      const a = layerActivation(s0 / SCALE, st).longitudinal;
      return s0 + 0.22 * a * (st.relaxation * SCALE - s0);
    },
    [live],
  );
  const ringColour = useMemo(() => {
    const tmp = new THREE.Color();
    return (s, out) => {
      const a = layerActivation(s / SCALE, live.current.state).circular;
      tmp.copy(RELAXED_C).lerp(CONTRACTED_C, a);
      out[0] = tmp.r;
      out[1] = tmp.g;
      out[2] = tmp.b;
    };
  }, [live]);

  // Chyme: with a liquid bolus, fine droplets run on ahead down the lumen.
  const chymeSpeed = useRef(0);
  useFrame(() => {
    const st = live.current.state;
    chymeSpeed.current = consistency === "liquid" && st && !st.delivered ? st.bolusSpeed * SCALE * 0.9 : 0;
  });
  const chymeFront = useRef(0);
  useFrame(() => {
    const st = live.current.state;
    chymeFront.current = st ? (st.bolus + 1.5) * SCALE : -1;
  });

  return (
    <group>
      {/* Mucosal lining: the glassy inside of the tube. */}
      <ProfiledTube length={TUBE_LENGTH} rings={96} segments={28} radiusAt={lumenRadius} dynamic>
        <meshStandardMaterial color={COLOURS.mucosa} roughness={0.25} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </ProfiledTube>
      {/* Muscular wall. */}
      <ProfiledTube length={TUBE_LENGTH} rings={96} segments={28} radiusAt={wallRadius} dynamic>
        <meshStandardMaterial color={COLOURS.wall} roughness={0.6} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </ProfiledTube>
      {/* Circular muscle: one ring per station, fattening and flushing as it contracts. */}
      <TubeRings length={TUBE_LENGTH} count={RING_COUNT} radiusAt={ringRadius} thicknessAt={ringThickness} stationAt={ringStation} colourAt={ringColour} tubular={30} radial={8} dynamic castShadow>
        <meshStandardMaterial vertexColors roughness={0.5} emissive="#ffffff" emissiveIntensity={0.1} />
      </TubeRings>
      {/* Longitudinal muscle: fibres down the outside. */}
      {Array.from({ length: FIBRE_COUNT }, (_, i) => (
        <LongitudinalFibre key={i} index={i} live={live} outerRadius={ringRadius} />
      ))}
      <Bolus consistency={consistency} live={live} texture={texture} />
      {consistency === "liquid" && (
        <TubeFlow length={TUBE_LENGTH} count={18} speedRef={chymeSpeed} radiusAt={(s) => lumenRadius(s) * 0.7} fill={1} frontRef={chymeFront} colour={COLOURS.liquid} size={0.03} opacity={0.8} seed={5} />
      )}

      {/* Ends: pharynx above, stomach below. */}
      <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[LUMEN_RADIUS + WALL_THICKNESS + 0.02, 0.06, 10, 32]} />
        <meshStandardMaterial color={COLOURS.wall} roughness={0.6} />
      </mesh>
      <mesh position={[0, TUBE_LENGTH + 0.55, 0]} scale={[1.6, 1.0, 1.2]}>
        <sphereGeometry args={[0.6, 24, 18]} />
        <meshStandardMaterial color={COLOURS.stomach} roughness={0.65} transparent opacity={0.75} />
      </mesh>
      <SceneLabel position={[0, -0.5, 0.4]} tone="text-ink-300">
        from the pharynx · mouth end
      </SceneLabel>
      <SceneLabel position={[0, TUBE_LENGTH + 1.25, 0.4]} tone="text-ink-300">
        stomach · cardiac sphincter
      </SceneLabel>

      {/* Labels that ride the wave. */}
      <Follower live={live} pick={(l) => (l.state && l.presence > 0.05 && !l.state.complete ? l.state.constriction : null)} offset={[1.25, 0, 0.3]}>
        <SceneLabel position={[0, 0, 0]} tone="text-rose-300">
          circular muscle contracting · behind
        </SceneLabel>
      </Follower>
      <Follower live={live} pick={(l) => (l.state && l.presence > 0.05 && !l.state.delivered ? Math.min(TUBE_LENGTH_CM - 0.5, l.state.relaxation) : null)} offset={[1.25, 0, 0.3]}>
        <SceneLabel position={[0, 0, 0]} tone="text-amber-300">
          longitudinal contracting · lumen opens ahead
        </SceneLabel>
      </Follower>
      <Follower live={live} pick={(l) => (l.state && l.presence > 0.3 && !l.state.delivered ? l.state.bolus : null)} offset={[-1.3, 0, 0.3]}>
        <SceneLabel position={[0, 0, 0]} tone="text-ink-100">
          bolus
        </SceneLabel>
      </Follower>
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function PeristalsisCanvas({ params = {}, setParam }) {
  const { swallow = 0, consistency = "soft", orientation = "upright", speed = 1 } = params || {};
  const cKey = CONSISTENCIES[consistency] ? consistency : "soft";
  const oKey = ORIENTATIONS[orientation] ? orientation : "upright";

  // Everything the frame loop shares, in one mutable bag.
  const live = useRef({ phase: "idle", state: null, presence: 0, arrival: 0, flip: 0 });

  const texture = useMemo(() => makeBolusTexture(cKey), [cKey]);
  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <SceneCanvas
      camera={{ position: [0.8, 0.4, 12.5], fov: 46 }}
      controls={{ minDistance: 5, maxDistance: 28, target: [0.4, 0, 0] }}
      lights={{ ambient: 0.55, keyLight: 1.2, rim: PALETTE.rose }}
    >
      <PeristalsisDriver trigger={swallow} consistency={cKey} orientation={oKey} speed={speed} live={live} setParam={setParam} />

      <FlipGroup live={live}>
        {/* The tube is built along +y with s = 0 at y = 0; turn it so the mouth is at the top. */}
        <group position={[0, TUBE_LENGTH / 2, 0]} rotation={[Math.PI, 0, 0]}>
          <Gut live={live} consistency={cKey} texture={texture} />
        </group>
      </FlipGroup>

      {/* Gravity, fixed to the world: always straight down. */}
      <VectorArrow from={[3.4, 1.4, 0]} to={[3.4, -0.4, 0]} color={COLOURS.gravity} radius={0.05} headLength={0.32} headRadius={0.14} label="g" labelOffset={0.35} />
      <SceneLabel position={[3.4, 2.0, 0]} tone={oKey === "inverted" ? "text-amber-300" : "text-ink-400"}>
        {oKey === "inverted" ? "upside-down · the wave still delivers" : "right-side up"}
      </SceneLabel>

      <SceneReadout title="Peristalsis" subtitle={`${consistencyFor(cKey).label} · ${orientationFor(oKey).label}`} rows={[]} />
      <SceneLegend
        title="Muscle layers"
        items={[
          { color: COLOURS.circularContracted, label: "Circular muscle", note: "contracts behind the bolus" },
          { color: COLOURS.longitudinalContracted, label: "Longitudinal muscle", note: "contracts ahead of it" },
        ]}
      />
    </SceneCanvas>
  );
}

/** Rotates its children about z by the live flip angle. */
function FlipGroup({ live, children }) {
  const ref = useRef(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = live.current.flip;
  });
  return <group ref={ref}>{children}</group>;
}
