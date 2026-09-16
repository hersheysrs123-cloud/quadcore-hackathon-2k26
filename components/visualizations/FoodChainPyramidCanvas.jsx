"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
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
import { DioramaSlab, FluxStream, PhotonShower, SunSource } from "@/components/visualizations/ecosystem-diorama";
import { LogTierBars } from "@/components/visualizations/flux-chart";
import {
  NEXT_LINK,
  TIERS,
  TOXIN_HARM_PPM,
  TOXIN_LETHAL_PPM,
  TRANSFER_EFFICIENCY,
  TRANSFER_LOSS,
  solveFoodChain,
} from "@/lib/foodChain";

// ─── Food chain & energy pyramid ────────────────────────────────────
// A stepped pyramid of four slabs on a patch of woodland floor, one per
// trophic level, with the organisms of each level standing on it: leaves,
// caterpillars, blue tits, one sparrowhawk. Slab WIDTH is on a log scale
// (it has to be — 10 000 : 10 cannot be drawn), and the honest numbers
// are on the chart to the left and on the slabs themselves.
//
// Two streams leave every level: a thin gold one climbing to the level
// above (the 10 %), and a thick rose one pouring off the side as heat,
// waste and the uneaten (the 90 %), nine times as many particles. That
// ratio, repeated at every step, is the whole lesson.
//
// `lib/foodChain.js` is steady state; the scene eases its slab widths and
// headcounts towards the model's equilibrium, so a spray or a removal
// plays out as a change rather than a cut.
// ─────────────────────────────────────────────────────────────────────

const TIER_H = 0.9;
const TIER_D = 3.2;
const PYRAMID_X = -0.4;
const SUN = { position: [3.4, 8.3, -3.6] };
const CHART = { position: [6.9, 0.35, -1.2], width: 4.4, height: 3.4 };
/** The toxin label hangs off the slab's right edge, but never closer than this to the centre — the apex slab is narrow. */
const LABEL_REACH = 3.4;

const COLOURS = {
  energy: PALETTE.gold,
  heat: PALETTE.rose,
  toxin: "#d946ef",
  toxinLethal: "#7e22ce",
  dead: "#64748b",
  floor: "#3d5a2e",
  soil: "#4a3627",
  leaf: "#a7f3d0",
  caterpillar: "#3f6212",
  titBody: "#0369a1",
  titBreast: "#fde047",
  hawkBody: "#78350f",
  hawkBar: "#e7d3b0",
  ghost: "#94a3b8",
  slabShade: "#1e293b",
};

/** Slab width from stored energy: log scale, so every tenth is one equal step in. */
const tierWidth = (kj) => (kj <= 0 ? 1.4 : 2.0 + 1.35 * Math.log10(kj + 1));
const tierTop = (i) => (i + 1) * TIER_H;

/** How many of a tier's headcount to actually draw. */
const VISUAL_COUNT = {
  producers: { per: 9000, max: 70 },
  primary: { per: 120, max: 48 },
  secondary: { per: 1, max: 48 },
  apex: { per: 1, max: 2 },
};
const visualCount = (tier) => {
  const v = VISUAL_COUNT[tier.key];
  return clamp(Math.round(tier.population / v.per), tier.population > 0 ? 1 : 0, v.max);
};

/** Particles per second up out of a tier (the 10 %); the heat stream runs at nine times this. */
const upRate = (kj) => (kj <= 0 ? 0 : 1.0 + 0.9 * Math.log10(kj + 1));

// ─── Organisms ──────────────────────────────────────────────────────

/** Geometry for one of each organism, built once and disposed with the scene. */
function useOrganismParts() {
  const parts = useMemo(() => {
    const leaf = new THREE.SphereGeometry(1, 10, 6).scale(0.19, 0.035, 0.11);
    const caterpillar = new THREE.CapsuleGeometry(0.035, 0.17, 3, 8).rotateZ(Math.PI / 2).translate(0, 0.035, 0);
    const titBody = new THREE.SphereGeometry(1, 12, 9).scale(0.13, 0.11, 0.1).translate(0, 0.11, 0);
    const titBreast = new THREE.SphereGeometry(1, 10, 7).scale(0.09, 0.07, 0.085).translate(0.05, 0.08, 0);
    const hawkBody = new THREE.SphereGeometry(1, 14, 10).scale(0.32, 0.17, 0.15).translate(0, 0.2, 0);
    const hawkWings = new THREE.BoxGeometry(0.16, 0.025, 0.95).translate(0, 0.28, 0);
    return { leaf, caterpillar, titBody, titBreast, hawkBody, hawkWings };
  }, []);
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose()), [parts]);
  return parts;
}

/**
 * The individuals of one level, instanced, seated on the slab and eased
 * towards `count`. Each seat holds a u ∈ [−½, ½] across the slab, so the
 * organisms spread out as the slab widens (a cascade) and bunch as it
 * narrows. `parts` is a list of { geometry, colour } drawn at every seat.
 */
function Population({ count, maxCount, y, widthRef, parts, seed, dead = false, easing = 2.5 }) {
  const refs = useRef([]);
  const state = useRef({ shown: 0, dirty: true, dummy: new THREE.Object3D() });
  const seats = useMemo(
    () =>
      Array.from({ length: maxCount }, (_, i) => ({
        u: (hashRandom(seed + i * 1.9) - 0.5) * 0.9,
        v: (hashRandom(seed * 3 + i * 2.7) - 0.5) * 0.8,
        heading: hashRandom(seed * 7 + i * 0.7) * Math.PI * 2,
        scale: 0.85 + 0.3 * hashRandom(seed * 11 + i * 1.3),
      })),
    [maxCount, seed],
  );

  useFrame((_, rawDelta) => {
    const s = state.current;
    const dt = Math.min(rawDelta, 1 / 30);
    const target = clamp(count, 0, seats.length);
    const before = s.shown;
    s.shown += (target - s.shown) * (1 - Math.exp(-dt * easing));
    if (Math.abs(target - s.shown) < 0.02) s.shown = target;
    const width = widthRef.current;
    if (s.shown === before && !s.dirty && s.lastWidth === width) return;
    if (refs.current.some((m) => !m)) return;
    s.dirty = false;
    s.lastWidth = width;
    const d = s.dummy;
    for (let i = 0; i < seats.length; i += 1) {
      const seat = seats[i];
      const sc = clamp(s.shown - i, 0, 1) * seat.scale;
      d.position.set(PYRAMID_X + seat.u * width, y, seat.v * TIER_D);
      d.rotation.set(0, seat.heading, 0);
      d.scale.setScalar(sc);
      d.updateMatrix();
      for (const mesh of refs.current) mesh.setMatrixAt(i, d.matrix);
    }
    for (const mesh of refs.current) mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {parts.map((part, k) => (
        <instancedMesh
          key={k}
          ref={(m) => {
            refs.current[k] = m;
          }}
          args={[part.geometry, undefined, maxCount]}
          frustumCulled={false}
          castShadow
        >
          <meshStandardMaterial color={dead ? COLOURS.dead : part.colour} roughness={0.6} emissive={dead ? "#000000" : part.colour} emissiveIntensity={dead ? 0 : 0.12} />
        </instancedMesh>
      ))}
    </group>
  );
}

// ─── The pyramid ────────────────────────────────────────────────────

/** Eases a slab's width towards the model's and publishes it for the organisms on top. */
function TierSlab({ tier, widthRef }) {
  const meshRef = useRef(null);
  const target = tierWidth(tier.energyKJ);
  const toxic = tier.toxinStatus === "harmed" || tier.toxinStatus === "lethal";
  const colour = useMemo(() => {
    const base = new THREE.Color(tier.colour).lerp(new THREE.Color(COLOURS.slabShade), 0.42);
    if (tier.toxinStatus === "lethal") return `#${base.lerp(new THREE.Color(COLOURS.toxinLethal), 0.65).getHexString()}`;
    if (tier.toxinStatus === "harmed") return `#${base.lerp(new THREE.Color(COLOURS.toxin), 0.4).getHexString()}`;
    if (tier.toxinStatus === "trace") return `#${base.lerp(new THREE.Color(COLOURS.toxin), 0.12).getHexString()}`;
    return `#${base.getHexString()}`;
  }, [tier.colour, tier.toxinStatus]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    widthRef.current += (target - widthRef.current) * (1 - Math.exp(-dt * 3));
    if (Math.abs(target - widthRef.current) < 0.005) widthRef.current = target;
    if (meshRef.current) meshRef.current.scale.x = widthRef.current;
  });

  const y = tierTop(tier.level) - TIER_H / 2;
  const empty = tier.energyKJ <= 0;
  return (
    <group>
      <mesh ref={meshRef} position={[PYRAMID_X, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, TIER_H - 0.06, TIER_D]} />
        <meshStandardMaterial color={empty ? COLOURS.ghost : colour} roughness={0.55} metalness={0.05} transparent={empty} opacity={empty ? 0.18 : 1} emissive={toxic ? COLOURS.toxin : colour} emissiveIntensity={toxic ? 0.35 : 0.08} />
      </mesh>
      {toxic && <Halo position={[PYRAMID_X, y, 0]} radius={Math.max(widthRef.current, target) * 0.55} color={COLOURS.toxin} opacity={tier.toxinStatus === "lethal" ? 0.12 : 0.06} />}
    </group>
  );
}

function TierLabels({ tier, width, doses }) {
  const y = tierTop(tier.level);
  const zFront = TIER_D / 2 + 0.05;
  const status = tier.toxinStatus;
  const energyText = tier.energyKJ <= 0 ? "0 kJ" : tier.energyKJ >= 100 ? `${Math.round(tier.energyKJ).toLocaleString()} kJ` : `${tier.energyKJ.toFixed(0)} kJ`;
  const pop = tier.population;
  const popText = pop === 0 ? (tier.removed ? "removed" : `none — needs ${tier.kjPerIndividual} kJ each`) : `${pop.toLocaleString()} ${pop === 1 ? tier.singular : tier.plural}`;
  const reach = Math.max(width / 2 + 0.35, LABEL_REACH);
  return (
    <group>
      {/* Name and numbers stacked on the front face, so nothing hangs off the left into the HUD. */}
      <SceneLabel position={[PYRAMID_X, y - TIER_H * 0.27, zFront]} tone="text-ink-300">
        {`${tier.label} · ${tier.organism}`}
      </SceneLabel>
      <SceneLabel position={[PYRAMID_X, y - TIER_H * 0.72, zFront]} accent={pop > 0} tone={pop > 0 ? undefined : "text-rose-300"}>
        {`${energyText} · ${popText}`}
      </SceneLabel>
      {doses > 0 && (
        <SceneLabel position={[PYRAMID_X + reach, y - TIER_H / 2, zFront]} tone={status === "lethal" || status === "harmed" ? "text-fuchsia-300" : "text-ink-400"}>
          {`${tier.toxinPpm < 1 ? tier.toxinPpm.toFixed(2) : tier.toxinPpm.toFixed(1)} ppm · ${tier.toxinLabel}`}
        </SceneLabel>
      )}
      {tier.removed && (
        <SceneLabel position={[PYRAMID_X, y + 0.15, 0]} tone="text-rose-300">
          {tier.toxinStatus === "lethal" ? "sparrowhawk poisoned · population 0" : "sparrowhawk removed · trophic cascade"}
        </SceneLabel>
      )}
    </group>
  );
}

/** The 10 % climbing to the next slab, and the 90 % pouring off the side. */
function TierFlows({ tier, upRef, heatRef, nextWidth, width }) {
  const y = tierTop(tier.level);
  const zFront = TIER_D / 2 + 0.25;
  const isTop = tier.level === TIERS.length - 1;
  const rightEdge = PYRAMID_X + width / 2;
  return (
    <group>
      {/* Up: from this slab's front face to the next slab's front face. */}
      <FluxStream
        from={[PYRAMID_X + (isTop ? 0 : nextWidth / 2 + 0.05), y - TIER_H * 0.5, zFront]}
        to={[PYRAMID_X + (isTop ? 0 : nextWidth / 2 - 0.35), y + TIER_H * 0.5, zFront]}
        rateRef={upRef}
        colour={COLOURS.energy}
        count={36}
        travel={1.4}
        lift={0.1}
        spread={0.16}
        size={0.055}
        seed={100 + tier.level}
      />
      {/* Out: heat, waste and the uneaten, off the right-hand side. */}
      <FluxStream
        from={[rightEdge + 0.05, y - TIER_H * 0.55, 0]}
        to={[rightEdge + 2.1, y + 0.55, 0]}
        rateRef={heatRef}
        colour={COLOURS.heat}
        count={120}
        travel={1.7}
        lift={0.25}
        spread={1.1}
        size={0.045}
        opacity={0.7}
        seed={200 + tier.level}
      />
    </group>
  );
}

/** A spray of toxin falling on the leaves, for a couple of seconds after each press. */
function ToxinSpray({ doses, sprayRef }) {
  const last = useRef(doses);
  useFrame((_, rawDelta) => {
    if (doses !== last.current) {
      last.current = doses;
      if (doses > 0) sprayRef.current = 60;
    }
    sprayRef.current = Math.max(0, sprayRef.current - Math.min(rawDelta, 1 / 30) * 28);
  });
  return (
    <FluxStream from={[PYRAMID_X, tierTop(0) + 3.4, 0.3]} to={[PYRAMID_X, tierTop(0) + 0.05, 0.3]} rateRef={sprayRef} colour={COLOURS.toxin} count={120} travel={1.1} lift={0} spread={3.2} size={0.04} seed={300} />
  );
}

function FifthLink({ pyramid, apexWidth }) {
  const y = tierTop(TIERS.length);
  const w = 1.6;
  const hw = w / 2;
  const hh = (TIER_H - 0.06) / 2;
  const hd = TIER_D / 2;
  const cy = y + TIER_H / 2;
  const box = [
    [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd], [-hw, -hh, hd]],
    [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, hh, -hd], [-hw, hh, -hd], [-hw, -hh, -hd]],
  ];
  return (
    <group position={[PYRAMID_X, cy, 0]}>
      {box.map((pts, i) => (
        <Line key={i} points={pts} color={COLOURS.ghost} lineWidth={1} dashed dashSize={0.12} gapSize={0.09} transparent opacity={0.6} />
      ))}
      <SceneLabel position={[0, hh + 0.3, hd]} tone="text-ink-400">
        {`5th link? ${NEXT_LINK.organism} · would receive ${pyramid.nextLink.energyKJ.toFixed(1)} kJ · needs ${NEXT_LINK.kjPerIndividual} kJ · not viable`}
      </SceneLabel>
      <Line points={[[-apexWidth / 2, -hh - TIER_H + 0.03, hd + 0.02], [-hw, -hh, hd + 0.02]]} color={COLOURS.ghost} lineWidth={0.8} dashed dashSize={0.08} gapSize={0.08} transparent opacity={0.4} />
      <Line points={[[apexWidth / 2, -hh - TIER_H + 0.03, hd + 0.02], [hw, -hh, hd + 0.02]]} color={COLOURS.ghost} lineWidth={0.8} dashed dashSize={0.08} gapSize={0.08} transparent opacity={0.4} />
    </group>
  );
}

function EnergyChart({ pyramid }) {
  const bars = pyramid.tiers.map((t) => ({
    key: t.key,
    label: t.organism.toLowerCase(),
    caption: t.population > 0 ? `${t.population.toLocaleString()}` : "—",
    value: t.energyKJ,
    ghost: t.level === 0 ? undefined : t.receivedKJ,
    ghostColour: COLOURS.heat,
    colour: t.energyKJ > 0 ? t.colour : COLOURS.ghost,
  }));
  return (
    <LogTierBars
      position={CHART.position}
      width={CHART.width}
      height={CHART.height}
      bars={bars}
      unit="kJ"
      floor={1}
      scaleMax={20000}
      lossLabel={(bar) => (bar.ghost > 0 ? `−${Math.round(TRANSFER_LOSS * 100)} %` : null)}
      format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v >= 10 ? Math.round(v).toString() : v.toFixed(1))}
      title="Energy stored per level · log scale · ghost = energy received"
      footnote={`${Math.round(TRANSFER_EFFICIENCY * 100)} % passed on at each link · ${pyramid.totalLostKJ.toLocaleString(undefined, { maximumFractionDigits: 0 })} kJ lost as heat & waste`}
    />
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function FoodChainPyramidCanvas({ params = {} }) {
  const { insolation = 100, toxin = 0, cascade = 0, speed = 1 } = params || {};
  const pyramid = useMemo(() => solveFoodChain({ insolation: Number(insolation) || 100, toxinDoses: Number(toxin) || 0, cascadePresses: Number(cascade) || 0 }), [insolation, toxin, cascade]);
  const parts = useOrganismParts();

  // Slab widths are eased in the scene, so the organisms need them each frame.
  const widthRefs = useMemo(() => TIERS.map((_, i) => ({ current: tierWidth(pyramid.tiers[i].energyKJ) })), []); // eslint-disable-line react-hooks/exhaustive-deps
  const upRefs = useMemo(() => TIERS.map(() => ({ current: 0 })), []);
  const heatRefs = useMemo(() => TIERS.map(() => ({ current: 0 })), []);
  const sunRef = useRef(0);
  const sprayRef = useRef(0);

  const sunK = clamp(insolation / 100, 0.5, 1.5);
  useEffect(() => {
    pyramid.tiers.forEach((t, i) => {
      const next = pyramid.tiers[i + 1];
      // What climbs is what the level above receives (for the hawk, the
      // trickle a fifth link would get); what pours off is nine times that.
      const climbs = next ? next.intactKJ : pyramid.nextLink.energyKJ;
      const alive = t.energyKJ > 0 ? 1 : 0;
      const up = upRate(climbs) * alive * (next && (!next.viable || next.removed) ? 0.4 : 1);
      upRefs[i].current = up * speed;
      heatRefs[i].current = up * 9 * speed;
    });
    sunRef.current = (16 + 20 * sunK) * speed;
  }, [pyramid, speed, sunK, upRefs, heatRefs]);

  const organismParts = useMemo(
    () => ({
      producers: [{ geometry: parts.leaf, colour: COLOURS.leaf }],
      primary: [{ geometry: parts.caterpillar, colour: COLOURS.caterpillar }],
      secondary: [
        { geometry: parts.titBody, colour: COLOURS.titBody },
        { geometry: parts.titBreast, colour: COLOURS.titBreast },
      ],
      apex: [
        { geometry: parts.hawkBody, colour: COLOURS.hawkBody },
        { geometry: parts.hawkWings, colour: COLOURS.hawkBar },
      ],
    }),
    [parts],
  );

  const apex = pyramid.tiers[TIERS.length - 1];
  const producers = pyramid.tiers[0];

  return (
    <SceneCanvas
      camera={{ position: [1.8, 5.4, 16.2], fov: 46 }}
      controls={{ minDistance: 5, maxDistance: 34, target: [1.6, 2.2, 0], maxPolarAngle: Math.PI * 0.49 }}
      lights={{ ambient: 0.35 + 0.3 * sunK, keyLight: 0.5 + 0.8 * sunK, rim: PALETTE.emerald }}
    >
      <SunSource position={SUN.position} intensity={sunK} radius={0.75} label={`sun · ${Math.round(insolation)} % insolation · ${pyramid.producerKJ.toLocaleString()} kJ fixed by the leaves`} />
      <DioramaSlab size={[16, 1.0, 7]} top={COLOURS.floor} side={COLOURS.soil} />

      {/* Sunlight onto the leaves. */}
      <PhotonShower mode="shortwave" origin={SUN.position} ground={{ x: PYRAMID_X, z: 0, w: tierWidth(producers.energyKJ) * 0.9, d: TIER_D * 0.8, y: tierTop(0) }} envelopeY={99} escapeY={12} rateRef={sunRef} albedo={0.12} count={110} velocity={5} size={0.05} seed={7} />

      {pyramid.tiers.map((tier, i) => (
        <group key={tier.key}>
          <TierSlab tier={tier} widthRef={widthRefs[i]} />
          <Population
            count={visualCount(tier)}
            maxCount={VISUAL_COUNT[tier.key].max}
            y={tierTop(i) - 0.03}
            widthRef={widthRefs[i]}
            parts={organismParts[tier.key]}
            seed={11 + i * 7}
            dead={tier.toxinStatus === "lethal"}
          />
          <TierLabels tier={tier} width={tierWidth(tier.energyKJ)} doses={pyramid.doses} />
          <TierFlows tier={tier} upRef={upRefs[i]} heatRef={heatRefs[i]} width={tierWidth(tier.energyKJ)} nextWidth={i + 1 < TIERS.length ? tierWidth(pyramid.tiers[i + 1].energyKJ) : 0} />
        </group>
      ))}

      <FifthLink pyramid={pyramid} apexWidth={tierWidth(apex.energyKJ)} />
      <ToxinSpray doses={pyramid.doses} sprayRef={sprayRef} />
      <EnergyChart pyramid={pyramid} />

      {/* The heat streams' destination, named. */}
      <SceneLabel position={[PYRAMID_X + tierWidth(producers.energyKJ) / 2 + 1.1, 3.9, 0]} tone="text-rose-300">
        90 % lost at each link · heat · waste · uneaten
      </SceneLabel>
      <SceneLabel position={[PYRAMID_X, -0.35, TIER_D / 2 + 0.6]} tone="text-ink-400">
        {`chain length ${pyramid.chainLength} of ${TIERS.length} · the sparrowhawk gets ${(pyramid.apexShare * 100).toFixed(1)} % of what the leaves stored`}
      </SceneLabel>
      {pyramid.doses > 0 && (
        <SceneLabel position={[PYRAMID_X - 1.6, tierTop(0) + 4.25, 0.3]} tone="text-fuchsia-300">
          {`persistent toxin · ${pyramid.doses} ${pyramid.doses === 1 ? "spray" : "sprays"} · ×10 per link · birds harmed above ${TOXIN_HARM_PPM} ppm, killed above ${TOXIN_LETHAL_PPM} ppm`}
        </SceneLabel>
      )}

      <SceneReadout
        title="Energy pyramid"
        subtitle={`insolation ${insolation} % · ${pyramid.doses} toxin dose${pyramid.doses === 1 ? "" : "s"} · apex ${pyramid.apexRemoved ? "removed" : "present"}`}
        rows={pyramid.tiers.map((t) => [t.organism, `${Math.round(t.energyKJ)} kJ · ${t.population.toLocaleString()}`])}
      />
      <SceneLegend
        title="Flows"
        items={[
          { color: COLOURS.energy, label: "Energy passed on", note: "10 % — climbs to the next level" },
          { color: COLOURS.heat, label: "Energy lost", note: "90 % — heat, waste, uneaten" },
          { color: COLOURS.toxin, label: "Toxin", note: "×10 concentration per link" },
        ]}
      />
    </SceneCanvas>
  );
}
