"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  FitCamera,
  LabelsOn,
  PALETTE,
  SceneCanvas,
  ToggleLabel,
  VectorArrow,
  clamp,
} from "@/components/visualizations/scene-kit";
import { TubeFlow } from "@/components/visualizations/tube-transit";
import { GUT, GUT_GLB, GUT_STEP, GUT_STATIONS, makeGutUniforms, makeOesophagusMaterial, useGutModel } from "@/components/visualizations/gut-model";
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
// Our own oesophagus and stomach (scripts/gut-model, in Blender), the tube
// with a window cut down its front so the lumen, the bolus and every layer
// of the wall show: the folded mucosa, the pale submucosa, the INNER
// circular and OUTER longitudinal muscle. Press "swallow" and a wave runs
// down it into the stomach.
//
// The wave is a clock in `lib/peristalsis.js`; the scene reads the clock
// every frame, samples the lumen profile and both layers' activation every
// quarter centimetre, and hands that to the oesophagus's vertex shader
// (gut-model.jsx), which moves the stored-at-rest wall: shut and thickened
// behind the bolus, open and thinned ahead of it, the folds crowding where it
// closes, the segment ahead shortening. The circular layer flushes rose
// where it contracts, the longitudinal layer amber. Nothing allocates per
// frame.
//
// Gravity is a separate group. Flip it and the whole gut turns over while
// the wave carries on regardless — which is the demonstration.
// ─────────────────────────────────────────────────────────────────────

/** World units per centimetre of gut. */
const SCALE = 0.3;
/** The gut spans the mouth end (0) to the bottom of the stomach (~38 cm); this centres it. */
const GUT_MID_CM = 19;
/** The ring never quite shuts: the lumen keeps this much radius, cm. */
const LUMEN_FLOOR_CM = 0.12;

/** How often the scene reports to the HUD, seconds. */
const PUSH_EVERY_S = 0.1;

const COLOURS = {
  liquid: "#7dd3fc",
  gravity: PALETTE.slate,
};

const easeInOut = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

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
// Everything below is in centimetres, in the gut's own frame: the mouth end
// of the oesophagus at the origin, the tube running down -y.

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

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
    g.position.set(offset[0], -clamp(s, 0, TUBE_LENGTH_CM) + offset[1], offset[2]);
  });
  return <group ref={ref}>{children}</group>;
}

/**
 * The bolus: our chewed-food or dry-lump model (a liquid is a smooth
 * slug), squeezed into the lumen where it is. A liquid slug also stretches
 * back to the ring that is pushing it.
 */
function Bolus({ consistency, live }) {
  const parts = useGutModel();
  const c = consistencyFor(consistency);
  const ref = useRef(null);
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
    const r = profileRadius(st.bolus, LUMEN_RADIUS_CM, lumenFeatures(st, consistency), LUMEN_FLOOR_CM);
    const body = squeezeBody(c.restRadius, c.restHalf, r, c.compliance);
    const stretch = consistency === "liquid" ? st.ahead : consistency === "soft" ? st.ahead * 0.4 : 0;
    const length = body.length + stretch;
    const centre = st.bolus - stretch / 2;
    const wobble = consistency === "liquid" ? 0.04 * Math.sin(clock.elapsedTime * 9) : 0;
    // the food models are about a unit sphere, lumps included
    const k = consistency === "liquid" ? 1 : 0.86;
    m.position.set(0, -centre, 0);
    m.scale.set((body.radius + wobble) * k * l.presence, (length / 2) * k * l.presence, (body.radius - wobble) * k * l.presence);
  });
  if (consistency === "liquid") {
    return (
      <mesh ref={ref}>
        <sphereGeometry args={[1, 40, 28]} />
        <meshStandardMaterial color={COLOURS.liquid} emissive={COLOURS.liquid} emissiveIntensity={0.15} roughness={0.08} metalness={0.1} transparent opacity={0.72} />
      </mesh>
    );
  }
  const geometry = consistency === "dry" ? parts.bolusDry.geometry : parts.bolusSoft.geometry;
  return (
    <mesh ref={ref} geometry={geometry}>
      {/* chewed food glistens with saliva; the dry lump does not */}
      <meshStandardMaterial vertexColors roughness={consistency === "dry" ? 0.92 : 0.38} metalness={0} />
    </mesh>
  );
}

function Gut({ live, consistency, showLabels }) {
  const parts = useGutModel();
  const uniforms = useMemo(() => makeGutUniforms(), []);
  const material = useMemo(() => makeOesophagusMaterial(uniforms), [uniforms]);
  useEffect(() => () => material.dispose(), [material]);

  // Sample the wave every GUT_STEP cm for the wall's vertex shader.
  useFrame(({ clock }) => {
    const st = live.current.state;
    const feats = lumenFeatures(st, consistency);
    const prof = uniforms.uProf.value;
    for (let i = 0; i < GUT_STATIONS; i += 1) {
      const s = i * GUT_STEP;
      const L = profileRadius(s, LUMEN_RADIUS_CM, feats, LUMEN_FLOOR_CM);
      const a = layerActivation(s, st);
      // the segment ahead shortens: its stations slide towards the middle of it
      const shift = st ? 0.22 * a.longitudinal * (st.relaxation - s) : 0;
      prof[i].set(L, a.circular, a.longitudinal, shift);
    }
    uniforms.uTime.value = clock.elapsedTime;
  });

  // Chyme: with a liquid bolus, fine droplets run on ahead down the lumen.
  const chymeSpeed = useRef(0);
  const chymeFront = useRef(0);
  useFrame(() => {
    const st = live.current.state;
    chymeSpeed.current = consistency === "liquid" && st && !st.delivered ? st.bolusSpeed * 0.9 : 0;
    chymeFront.current = st ? st.bolus + 1.5 : -1;
  });
  const chymeRadius = useMemo(() => (s) => profileRadius(s, LUMEN_RADIUS_CM, lumenFeatures(live.current.state, consistency), LUMEN_FLOOR_CM) * 0.6, [live, consistency]);

  // Where a layer shows on the right-hand cut face, for its label.
  const face = (w, s) => {
    const r = GUT.lumen + w * GUT.wall;
    return [r * Math.sin(GUT.window), -s, r * Math.cos(GUT.window)];
  };

  return (
    <group>
      <mesh geometry={parts.oesophagus.geometry} material={material} frustumCulled={false} />
      <mesh geometry={parts.stomach.geometry}>
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0} />
      </mesh>
      <Bolus consistency={consistency} live={live} />
      {consistency === "liquid" && (
        <group rotation={[Math.PI, 0, 0]}>
          <TubeFlow length={TUBE_LENGTH_CM} count={18} speedRef={chymeSpeed} radiusAt={chymeRadius} fill={1} frontRef={chymeFront} colour={COLOURS.liquid} size={0.1} opacity={0.8} seed={5} />
        </group>
      )}

      <ToggleLabel position={[0, 1.6, 0.5]} tone="text-ink-300">
        from the pharynx · mouth end
      </ToggleLabel>
      <ToggleLabel position={[7.2, -27.5, 1.5]} tone="text-ink-300">
        stomach · fundus
      </ToggleLabel>
      <ToggleLabel position={[-3.8, -24.6, 1.5]} tone="text-ink-300">
        cardiac sphincter
      </ToggleLabel>
      {showLabels && (
        <group>
          <ToggleLabel position={add(face(0.02, 3.2), [4.4, 0, 0])} tone="text-rose-200">
            mucosa · folds
          </ToggleLabel>
          <ToggleLabel position={add(face(0.3, 5.0), [4.2, 0, 0])} tone="text-ink-300">
            submucosa
          </ToggleLabel>
          <ToggleLabel position={add(face(0.58, 6.8), [4.0, 0, 0])} tone="text-rose-300">
            circular muscle · inner
          </ToggleLabel>
          <ToggleLabel position={add(face(0.85, 8.6), [3.8, 0, 0])} tone="text-amber-300">
            longitudinal muscle · outer
          </ToggleLabel>
        </group>
      )}

      {/* Labels that ride the wave. The one behind the bolus hangs off the
          left of the tube, with the bolus, and the one ahead of it off the
          right, each edge-aligned to the tube. */}
      <Follower live={live} pick={(l) => (l.state && l.presence > 0.05 && !l.state.complete ? l.state.constriction : null)} offset={[-2.4, 0, 1]}>
        <ToggleLabel position={[0, 0, 0]} tone="text-rose-300" className="inline-block -translate-x-1/2">
          circular muscle contracting · behind
        </ToggleLabel>
      </Follower>
      <Follower live={live} pick={(l) => (l.state && l.presence > 0.05 && !l.state.delivered ? Math.min(TUBE_LENGTH_CM - 0.5, l.state.relaxation) : null)} offset={[2.4, 0, 1]}>
        <ToggleLabel position={[0, 0, 0]} tone="text-amber-300" className="inline-block translate-x-1/2">
          longitudinal contracting · lumen opens ahead
        </ToggleLabel>
      </Follower>
      <Follower live={live} pick={(l) => (l.state && l.presence > 0.3 && !l.state.delivered ? l.state.bolus : null)} offset={[-2.4, 0, 1]}>
        <ToggleLabel position={[0, 0, 0]} tone="text-ink-100" className="inline-block -translate-x-1/2">
          bolus
        </ToggleLabel>
      </Follower>
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

/** The whole tube, pharynx to stomach, with the gravity arrow beside it. */
const PERISTALSIS_VIEW = { cx: 0.7, cy: 0, width: 8.8, height: 12.6, depth: 2.5 };

export default function PeristalsisCanvas({ params = {}, setParam }) {
  const { swallow = 0, consistency = "soft", orientation = "upright", speed = 1, showLabels = true } = params || {};
  const cKey = CONSISTENCIES[consistency] ? consistency : "soft";
  const oKey = ORIENTATIONS[orientation] ? orientation : "upright";

  // Everything the frame loop shares, in one mutable bag.
  const live = useRef({ phase: "idle", state: null, presence: 0, arrival: 0, flip: 0 });

  return (
    <SceneCanvas
      camera={{ position: [0.8, 0.4, 12.5], fov: 46 }}
      controls={{ minDistance: 5, maxDistance: 28 }}
      lights={{ ambient: 0.68, keyLight: 1.25, rim: PALETTE.rose }}
    >
      <FitCamera view={PERISTALSIS_VIEW} direction={[0.06, 0.05, 1]} fov={46} />
      <LabelsOn.Provider value={showLabels !== false}>
      <PeristalsisDriver trigger={swallow} consistency={cKey} orientation={oKey} speed={speed} live={live} setParam={setParam} />

      <FlipGroup live={live}>
        {/* The gut is modelled in cm with the mouth end at the origin; centre it. */}
        <group position={[0, GUT_MID_CM * SCALE, 0]} scale={SCALE}>
          <Suspense fallback={null}>
            <Gut live={live} consistency={cKey} showLabels={showLabels !== false} />
          </Suspense>
        </group>
      </FlipGroup>

      {/* Gravity, fixed to the world: always straight down. */}
      <VectorArrow from={[3.4, 1.4, 0]} to={[3.4, -0.4, 0]} color={COLOURS.gravity} radius={0.05} headLength={0.32} headRadius={0.14} label={showLabels ? "g" : undefined} labelOffset={0.35} />
      <ToggleLabel position={[3.4, 2.0, 0]} tone={oKey === "inverted" ? "text-amber-300" : "text-ink-400"}>
        {oKey === "inverted" ? "upside-down · the wave still delivers" : "right-side up"}
      </ToggleLabel>
      </LabelsOn.Provider>

    </SceneCanvas>
  );
}

useGLTF.preload(GUT_GLB);

/** Rotates its children about z by the live flip angle. */
function FlipGroup({ live, children }) {
  const ref = useRef(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = live.current.flip;
  });
  return <group ref={ref}>{children}</group>;
}
