"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  AtomSphere,
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";

// ─── IGCSE Biology · three scenes ───────────────────────────────────
// Enzyme action, DNA base pairing, and the plant/animal cell explorer.
// ─────────────────────────────────────────────────────────────────────

// ═══ 11 · Enzyme action & denaturation ═══════════════════════════════

const OPTIMUM_TEMP = 37;
const OPTIMUM_PH = 7;

/**
 * Rate peaks at 37 °C and pH 7 and collapses either side. Above ~50 °C the
 * protein is denatured, which is permanent — so the rate floor is zero, not
 * a symmetric falloff.
 */
function enzymeRate(temperature, ph) {
  const denatured = temperature > 50;
  if (denatured) return { rate: Math.max(0, 1 - (temperature - 50) / 8) * 0.12, denatured };
  const tempTerm = Math.exp(-Math.pow((temperature - OPTIMUM_TEMP) / 17, 2));
  const phTerm = Math.exp(-Math.pow((ph - OPTIMUM_PH) / 2.4, 2));
  return { rate: clamp(tempTerm * phTerm, 0, 1), denatured };
}

/** Icosahedron whose vertices are pushed off their normals as it denatures. */
function EnzymeBody({ denature, wobble }) {
  const mesh = useRef(null);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.5, 4), []);
  const original = useMemo(
    () => Float32Array.from(geometry.attributes.position.array),
    [geometry],
  );
  const time = useRef(0);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    time.current += delta;
    const attr = geometry.attributes.position;
    const amount = denature * 0.55;
    for (let i = 0; i < attr.count; i += 1) {
      const o = i * 3;
      const x = original[o];
      const y = original[o + 1];
      const z = original[o + 2];
      // Cheap 3-axis noise — enough to read as an unravelling protein.
      const n =
        Math.sin(x * 3.1 + time.current * 2.2) *
        Math.sin(y * 2.7 - time.current * 1.7) *
        Math.sin(z * 3.5 + time.current * 1.3);
      const scale = 1 + n * amount + Math.sin(time.current * 1.4 + i) * wobble * 0.01;
      attr.setXYZ(i, x * scale, y * scale, z * scale);
    }
    attr.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  const colour = new THREE.Color(PALETTE.emerald).lerp(new THREE.Color(PALETTE.rose), denature);

  return (
    <mesh ref={mesh} geometry={geometry}>
      <meshStandardMaterial
        color={colour}
        emissive={colour}
        emissiveIntensity={0.3}
        roughness={0.45}
        metalness={0.15}
        flatShading
      />
    </mesh>
  );
}

/** Substrate runs approach → bound → split → products drift away → repeat. */
function Substrate({ rate, denatured, siteOpen }) {
  const left = useRef(null);
  const right = useRef(null);
  const phase = useRef(0);

  useFrame((_, delta) => {
    if (!left.current || !right.current) return;
    const speed = denatured ? 0.18 : 0.22 + rate * 0.5;
    phase.current = (phase.current + delta * speed) % 1;
    const p = phase.current;

    // A denatured active site no longer fits, so the substrate bounces off.
    const approach = clamp(p / 0.4, 0, 1);
    const bound = p > 0.4 && p < 0.62;
    const leaving = p >= 0.62;

    const startX = 5.4;
    const siteX = 1.85;
    let x = lerp(startX, siteX, approach);
    let separation = 0.34;

    if (denatured && approach > 0.82) {
      // Rejected: drift back out without ever binding.
      x = lerp(siteX, startX, (approach - 0.82) / 0.18);
    } else if (bound) {
      x = siteX;
    } else if (leaving) {
      const t = (p - 0.62) / 0.38;
      x = siteX + t * 3.6;
      separation = 0.34 + t * 1.5; // products separate after the reaction
    }

    const y = siteOpen * 0.5;
    left.current.position.set(x, y + separation, 0);
    right.current.position.set(x, y - separation, 0);
    const visible = !(denatured && leaving);
    left.current.visible = visible;
    right.current.visible = visible;
  });

  return (
    <>
      {/* Substrate "key" — wide head + narrower neck that fits the groove */}
      <mesh ref={left}>
        <boxGeometry args={[0.78, 0.44, 0.72]} />
        <meshStandardMaterial
          color={PALETTE.gold}
          emissive={PALETTE.gold}
          emissiveIntensity={0.65}
          roughness={0.3}
          metalness={0.12}
        />
      </mesh>
      {/* Substrate neck / tongue (narrower bit that slots into the active-site groove) */}
      <mesh ref={right}>
        <boxGeometry args={[0.46, 0.32, 0.44]} />
        <meshStandardMaterial
          color={PALETTE.goldDim}
          emissive={PALETTE.goldDim}
          emissiveIntensity={0.55}
          roughness={0.35}
        />
      </mesh>
    </>
  );
}

/**
 * The rate-against-temperature curve, drawn from the same `enzymeRate` the
 * animation runs on.
 *
 * The 3D model shows you one temperature at a time, which is exactly what
 * makes denaturation hard to see: the interesting fact is the *shape* — a
 * gentle climb to the optimum, then a cliff — and a single frame cannot carry
 * a shape. The marker is the temperature you have dialled in.
 */
const CURVE = { width: 6, height: 1.55, maxTemp: 80 };

function RateCurve({ temperature, ph }) {
  const xOf = (t) => -CURVE.width / 2 + (t / CURVE.maxTemp) * CURVE.width;
  const yOf = (r) => r * CURVE.height;

  const curve = useMemo(() => {
    const pts = [];
    for (let k = 0; k <= 160; k += 1) {
      const t = (k / 160) * CURVE.maxTemp;
      pts.push([xOf(t), yOf(enzymeRate(t, ph).rate), 0]);
    }
    return pts;
  }, [ph]);

  const here = enzymeRate(temperature, ph).rate;

  return (
    <group position={[0, -4.1, 0]}>
      {/* Axes. */}
      <Line
        points={[
          [-CURVE.width / 2, 0, 0],
          [CURVE.width / 2 + 0.3, 0, 0],
        ]}
        color={PALETTE.line}
        lineWidth={1.4}
      />
      <Line
        points={[
          [-CURVE.width / 2, 0, 0],
          [-CURVE.width / 2, CURVE.height + 0.3, 0],
        ]}
        color={PALETTE.line}
        lineWidth={1.4}
      />

      {/* The two temperatures worth naming. */}
      {[
        { t: OPTIMUM_TEMP, colour: PALETTE.emerald, text: "optimum 37°C" },
        { t: 50, colour: PALETTE.rose, text: "denatures above ~50°C" },
      ].map(({ t, colour, text }) => (
        <group key={t}>
          <Line
            points={[
              [xOf(t), 0, 0],
              [xOf(t), CURVE.height + 0.1, 0],
            ]}
            color={colour}
            lineWidth={1.2}
            transparent
            opacity={0.45}
            dashed
            dashSize={0.14}
            gapSize={0.12}
          />
          <SceneLabel
            position={[xOf(t), CURVE.height + 0.45, 0]}
            tone={colour === PALETTE.emerald ? "text-emerald-300" : "text-rose-300"}
          >
            {text}
          </SceneLabel>
        </group>
      ))}

      <Line points={curve} color={PALETTE.gold} lineWidth={2.6} />

      {/* Where you are on it. */}
      <mesh position={[xOf(temperature), yOf(here), 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial
          color={PALETTE.bone}
          emissive={PALETTE.bone}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      <Line
        points={[
          [xOf(temperature), 0, 0],
          [xOf(temperature), yOf(here), 0],
        ]}
        color={PALETTE.bone}
        lineWidth={1.2}
        transparent
        opacity={0.4}
      />

      <SceneLabel position={[-CURVE.width / 2 - 0.75, CURVE.height / 2, 0]} tone="text-ink-400">
        rate
      </SceneLabel>
      <SceneLabel position={[CURVE.width / 2 + 0.9, 0, 0]} tone="text-ink-400">
        temperature
      </SceneLabel>
    </group>
  );
}

export function EnzymeScene({ params }) {
  const { temperature, ph, speed } = params;
  const { rate, denatured } = enzymeRate(temperature, ph);

  // The active site gapes open as the protein loses its shape.
  const denature = denatured ? clamp((temperature - 50) / 26, 0, 1) : 0;
  const phStress = clamp(Math.abs(ph - OPTIMUM_PH) / 7, 0, 1);
  const distortion = clamp(denature + phStress * 0.45, 0, 1);
  const siteOpen = distortion;

  return (
    <SceneCanvas
      camera={{ position: [1.5, 2.4, 12], fov: 45 }}
      controls={{ target: [0, -1.1, 0] }}
    >
      <group position={[-1.2, 0, 0]}>
        <EnzymeBody denature={distortion} wobble={speed} />
        <Halo radius={2.4} color={distortion > 0.4 ? PALETTE.rose : PALETTE.emerald} opacity={0.06} />

        {/* Active site: upper and lower ridges forming a complementary pocket.
            The ridges have an inner lip that narrows toward the centre, giving
            a convincing lock-and-key groove for the substrate to slot into. */}
        {/* Upper jaw — outer ridge */}
        <mesh position={[1.56, 0.66 + siteOpen * 0.55, 0]} rotation={[0, 0, -0.38 - siteOpen * 0.5]}>
          <boxGeometry args={[1.55, 0.28, 1.15]} />
          <meshStandardMaterial
            color="#0f766e"
            emissive={PALETTE.emerald}
            emissiveIntensity={0.38}
            roughness={0.35}
            metalness={0.08}
          />
        </mesh>
        {/* Upper jaw — inner lip */}
        <mesh position={[1.9 + siteOpen * 0.3, 0.38 + siteOpen * 0.4, 0]} rotation={[0, 0, -0.9 - siteOpen * 0.4]}>
          <boxGeometry args={[0.65, 0.18, 1.05]} />
          <meshStandardMaterial color="#0d9488" emissive={PALETTE.emerald} emissiveIntensity={0.5} roughness={0.3} />
        </mesh>

        {/* Lower jaw — outer ridge */}
        <mesh position={[1.56, -0.66 - siteOpen * 0.55, 0]} rotation={[0, 0, 0.38 + siteOpen * 0.5]}>
          <boxGeometry args={[1.55, 0.28, 1.15]} />
          <meshStandardMaterial
            color="#0f766e"
            emissive={PALETTE.emerald}
            emissiveIntensity={0.38}
            roughness={0.35}
            metalness={0.08}
          />
        </mesh>
        {/* Lower jaw — inner lip */}
        <mesh position={[1.9 + siteOpen * 0.3, -0.38 - siteOpen * 0.4, 0]} rotation={[0, 0, 0.9 + siteOpen * 0.4]}>
          <boxGeometry args={[0.65, 0.18, 1.05]} />
          <meshStandardMaterial color="#0d9488" emissive={PALETTE.emerald} emissiveIntensity={0.5} roughness={0.3} />
        </mesh>

        <SceneLabel position={[0, -2.5, 0]} tone={distortion > 0.5 ? "text-rose-300" : "text-emerald-300"}>
          {distortion > 0.5 ? "denatured enzyme" : "enzyme · active site"}
        </SceneLabel>
      </group>

      <Substrate rate={rate} denatured={denature > 0.25} siteOpen={siteOpen} />

      <RateCurve temperature={temperature} ph={ph} />

      <SceneReadout
        title="Reaction"
        subtitle="Lock and key · one enzyme, one substrate"
        rows={[
          ["Rate", `${Math.round(rate * 100)}%`, rate > 0.6 ? "good" : rate < 0.2 ? "bad" : "gold"],
          ["Temperature", `${temperature.toFixed(0)}°C`, temperature > 50 ? "bad" : undefined],
          ["pH", ph.toFixed(1), Math.abs(ph - 7) > 3 ? "bad" : undefined],
          ["Optimum", "37°C, pH 7"],
          ["Active site", denatured ? "wrong shape" : "fits the substrate", denatured ? "bad" : "good"],
          ["Reversible?", denatured ? "no — permanent" : "yes — just slower", denatured ? "bad" : "good"],
        ]}
        note={
          denatured
            ? "Above ~50 °C the active site has permanently changed shape — the substrate no longer fits, and cooling will not bring the rate back. Look at the cliff on the curve."
            : Math.abs(ph - OPTIMUM_PH) > 3
              ? "Extreme pH distorts the active site too, so the substrate binds poorly. Move pH back toward 7 and the whole curve lifts."
              : temperature < 20
                ? "Cold: the particles collide less often and with less energy, so the rate is low — but the enzyme is unharmed and warming it up recovers the rate."
                : "Near the optimum: frequent, energetic collisions and a perfectly shaped active site."
        }
        noteTone={denatured ? "bad" : Math.abs(ph - OPTIMUM_PH) > 3 ? "warn" : "good"}
      />

      <SceneLegend
        title="Key"
        items={[
          {
            color: denatured ? PALETTE.rose : PALETTE.emerald,
            label: denatured ? "Denatured enzyme" : "Enzyme",
            note: "a protein catalyst — not used up",
          },
          {
            color: PALETTE.gold,
            shape: "square",
            label: "Substrate → products",
            note: "splits in two once it has bound",
          },
          {
            color: PALETTE.gold,
            shape: "line",
            label: "Rate against temperature",
            note: "climbs to the optimum, then falls off a cliff",
          },
          {
            color: PALETTE.bone,
            label: "Where you are on that curve",
          },
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 12 · DNA double helix & base pairing ════════════════════════════

const BASE_COLOURS = { A: "#4ade80", T: "#fb7185", C: "#38bdf8", G: "#fbbf24" };
const BASE_NAMES = { A: "Adenine", T: "Thymine", C: "Cytosine", G: "Guanine" };
const COMPLEMENT = { A: "T", T: "A", C: "G", G: "C" };
const BASES = ["A", "T", "C", "G"];

const HELIX_UP = new THREE.Vector3(0, 1, 0);
const linkDelta = new THREE.Vector3();

/**
 * Angle between the two backbones around the helix axis.
 *
 * Not π. If the strands sat exactly opposite each other the two grooves would
 * be identical, and real DNA's most recognisable feature — one wide major
 * groove and one narrow minor groove, which is how proteins tell which way
 * round they are binding — would not exist. The base pairs attach about 135°
 * apart, leaving 135° of minor groove and 225° of major.
 */
const STRAND_OFFSET = (Math.PI * 135) / 180;

const RADIUS = 1.5;
// B-DNA rises 0.34 nm per base pair against a 1.0 nm radius, and makes a
// full turn every 10.5 pairs.
const RISE = RADIUS * 0.34;
const TWIST = (Math.PI * 2) / 10.5;

/**
 * Point a unit-height cylinder from `a` to `b`. Backbone and rungs both join
 * two things that are moving, so they are placed per frame rather than baked
 * into static geometry — otherwise unzipping leaves the strands floating free
 * of the sugar-phosphate chain that is supposed to hold them together.
 */
function stretchBetween(mesh, a, b) {
  if (!mesh) return;
  linkDelta.subVectors(b, a);
  const length = linkDelta.length();
  if (length < 1e-5) {
    mesh.visible = false;
    return;
  }
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(HELIX_UP, linkDelta.normalize());
  mesh.scale.set(1, length, 1);
}

function Helix({ pairs, spin, unzipToken }) {
  const group = useRef(null);
  const rungRefs = useRef([]);
  const strandA = useRef([]);
  const strandB = useRef([]);
  const backboneA = useRef([]);
  const backboneB = useRef([]);
  const unzip = useRef(0);
  const target = useRef(0);

  const sequence = useMemo(
    () =>
      Array.from({ length: pairs }, (_, i) => BASES[Math.floor(hashRandom(i + 5) * 4) % 4]),
    [pairs],
  );

  useEffect(() => {
    if (!unzipToken) return undefined;
    target.current = 1;
    const id = setTimeout(() => {
      target.current = 0;
    }, 3400);
    return () => clearTimeout(id);
  }, [unzipToken]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * spin * 0.5;
    unzip.current = lerp(unzip.current, target.current, Math.min(1, delta * 1.1));

    for (let i = 0; i < pairs; i += 1) {
      // Unzipping runs from the top down, like a replication fork.
      const front = unzip.current * pairs;
      const open = clamp(front - (pairs - 1 - i), 0, 1);
      const spread = open * 1.5;

      const angle = i * TWIST;
      const y = i * RISE - ((pairs - 1) * RISE) / 2;

      const a = strandA.current[i];
      const b = strandB.current[i];
      const rung = rungRefs.current[i];

      if (a) a.position.set(Math.cos(angle) * (RADIUS + spread), y, Math.sin(angle) * (RADIUS + spread));
      if (b)
        b.position.set(
          Math.cos(angle + STRAND_OFFSET) * (RADIUS + spread),
          y,
          Math.sin(angle + STRAND_OFFSET) * (RADIUS + spread),
        );

      // The rung is the hydrogen bonding: it stretches as the fork opens and
      // is gone once the pair has separated.
      if (rung && a && b) {
        stretchBetween(rung, a.position, b.position);
        rung.visible = open < 0.55;
        rung.material.opacity = clamp(1 - open / 0.55, 0, 1);
      }
    }

    // Backbone runs between consecutive bases along each strand, so it
    // follows them apart instead of snapping.
    for (let i = 0; i < pairs - 1; i += 1) {
      const a0 = strandA.current[i];
      const a1 = strandA.current[i + 1];
      const b0 = strandB.current[i];
      const b1 = strandB.current[i + 1];
      if (a0 && a1) stretchBetween(backboneA.current[i], a0.position, a1.position);
      if (b0 && b1) stretchBetween(backboneB.current[i], b0.position, b1.position);
    }
  });

  return (
    <group ref={group}>
      {sequence.map((base, i) => {
        const angle = i * TWIST;
        const y = i * RISE - ((pairs - 1) * RISE) / 2;
        const pa = [Math.cos(angle) * RADIUS, y, Math.sin(angle) * RADIUS];
        const pb = [Math.cos(angle + STRAND_OFFSET) * RADIUS, y, Math.sin(angle + STRAND_OFFSET) * RADIUS];
        return (
          <group key={i}>
            {/* Rung — the hydrogen bonds holding one base pair together. */}
            <mesh
              ref={(el) => {
                rungRefs.current[i] = el;
              }}
            >
              <cylinderGeometry args={[0.055, 0.055, 1, 10]} />
              <meshStandardMaterial
                color={BASE_COLOURS[base]}
                emissive={BASE_COLOURS[base]}
                emissiveIntensity={0.75}
                transparent
                roughness={0.4}
              />
            </mesh>

            {/* Sugar–phosphate backbone: the two rails of the ladder. */}
            {i < pairs - 1 && (
              <>
                <mesh
                  ref={(el) => {
                    backboneA.current[i] = el;
                  }}
                >
                  <cylinderGeometry args={[0.1, 0.1, 1, 10]} />
                  <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.2} />
                </mesh>
                <mesh
                  ref={(el) => {
                    backboneB.current[i] = el;
                  }}
                >
                  <cylinderGeometry args={[0.1, 0.1, 1, 10]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.5} metalness={0.2} />
                </mesh>
              </>
            )}

            <mesh
              ref={(el) => {
                strandA.current[i] = el;
              }}
              position={pa}
            >
              <sphereGeometry args={[0.22, 18, 18]} />
              <meshStandardMaterial
                color={BASE_COLOURS[base]}
                emissive={BASE_COLOURS[base]}
                emissiveIntensity={1.1}
                toneMapped={false}
              />
            </mesh>
            <mesh
              ref={(el) => {
                strandB.current[i] = el;
              }}
              position={pb}
            >
              <sphereGeometry args={[0.22, 18, 18]} />
              <meshStandardMaterial
                color={BASE_COLOURS[COMPLEMENT[base]]}
                emissive={BASE_COLOURS[COMPLEMENT[base]]}
                emissiveIntensity={1.1}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function DNAScene({ params }) {
  const { spin, pairs, unzip } = params;
  const count = Math.round(pairs);

  const preview = useMemo(
    () =>
      Array.from({ length: Math.min(6, count) }, (_, i) => BASES[Math.floor(hashRandom(i + 5) * 4) % 4]),
    [count],
  );

  // A long strand used to run straight out of the top and bottom of the
  // frame; scaling to fit keeps every setting of the slider fully visible.
  const fit = clamp(8.8 / (count * RISE), 0.4, 1);

  return (
    <SceneCanvas camera={{ position: [0, 0, 12], fov: 45 }} controls={{ minDistance: 4 }}>
      <group scale={fit}>
        <Helix pairs={count} spin={spin} unzipToken={unzip} />
      </group>

      <SceneReadout
        title="Double helix"
        subtitle="Two complementary strands"
        rows={[
          ["Base pairs shown", count, "gold"],
          ["Strand 1 (5′→3′)", preview.join("-")],
          ["Strand 2 (3′→5′)", preview.map((b) => COMPLEMENT[b]).join("-")],
          ["Pairing rule", "A–T, C–G", "good"],
          ["Held together by", "hydrogen bonds"],
          ["Backbone", "sugar + phosphate"],
          ["Turn every", "10.5 pairs"],
          ["Grooves", "one major, one minor"],
        ]}
        note="Because the strands are complementary, each one carries the full instructions on its own. Press “Unzip DNA”: the weak hydrogen bonds break, and both old strands become templates for new ones. That is replication."
      />

      <SceneLegend
        title="Bases and backbone"
        items={[
          ...Object.entries(BASE_COLOURS).map(([base, colour]) => ({
            color: colour,
            label: `${BASE_NAMES[base]} (${base})`,
            note: `always pairs with ${BASE_NAMES[COMPLEMENT[base]]} (${COMPLEMENT[base]})`,
          })),
          {
            color: "#94a3b8",
            shape: "line",
            label: "Sugar–phosphate backbone",
            note: "the two rails — strong, and never broken by unzipping",
          },
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 13 · Cell organelle explorer ════════════════════════════════════

const ORGANELLES = {
  nucleus: {
    label: "Nucleus",
    info: "Holds the DNA and controls all the cell's activities.",
    both: true,
  },
  mitochondrion: {
    label: "Mitochondrion",
    info: "Site of aerobic respiration — releases energy from glucose.",
    both: true,
  },
  chloroplast: {
    label: "Chloroplast",
    info: "Contains chlorophyll and traps light energy for photosynthesis. Plant cells only.",
    both: false,
  },
  vacuole: {
    label: "Permanent vacuole",
    info: "Filled with cell sap; its pressure against the wall keeps the plant cell turgid. Plant cells only.",
    both: false,
  },
  wall: {
    label: "Cell wall",
    info: "Rigid cellulose layer that stops the cell bursting. Plant cells only.",
    both: false,
  },
  membrane: {
    label: "Cell membrane",
    info: "Partially permeable — controls what enters and leaves, and lets water through by osmosis.",
    both: true,
  },
  ribosome: {
    label: "Ribosomes",
    info: "Where proteins are made.",
    both: true,
  },
};

function WaterFlow({ direction, active }) {
  const meshes = useRef([]);
  const drops = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        angle: hashRandom(i + 2) * Math.PI * 2,
        tilt: (hashRandom(i + 40) - 0.5) * 2,
        phase: hashRandom(i + 80),
      })),
    [],
  );
  const t = useRef(0);

  useFrame((_, delta) => {
    if (active) t.current += delta * 0.4;
    drops.forEach((d, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const local = (t.current + d.phase) % 1;
      // direction > 0 → water entering the cell.
      const r = direction > 0 ? lerp(4.6, 1.2, local) : lerp(1.2, 4.6, local);
      mesh.position.set(
        Math.cos(d.angle) * r,
        d.tilt * r * 0.32,
        Math.sin(d.angle) * r,
      );
      const fade = Math.sin(local * Math.PI);
      mesh.scale.setScalar(0.001 + fade * 0.11);
    });
  });

  if (!active) return null;

  return (
    <>
      {drops.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial
            color={PALETTE.sky}
            emissive={PALETTE.sky}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

function Organelle({ id, position, geometry, colour, scale = 1, selected, onSelect, label }) {
  return (
    <group position={position} scale={scale}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        {geometry}
        <meshStandardMaterial
          color={colour}
          emissive={colour}
          emissiveIntensity={selected ? 1.5 : 0.35}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      {label && selected && <SceneLabel position={[0, 1.1, 0]} accent>{label}</SceneLabel>}
    </group>
  );
}

export function CellExplorerScene({ params }) {
  const { cellType, tonicity, showLabels, water } = params;
  const [selected, setSelected] = useState(null);
  const isPlant = cellType === "plant";

  // Negative tonicity = dilute outside = water enters = the cell swells.
  const swell = clamp(1 - tonicity * 0.22, 0.72, 1.2);
  const membraneScale = isPlant ? clamp(1 - Math.max(0, tonicity) * 0.3, 0.66, 1) : swell;

  const status = isPlant
    ? tonicity > 0.45
      ? { text: "Plasmolysed", tone: "bad" }
      : tonicity < -0.3
        ? { text: "Turgid", tone: "good" }
        : { text: "Flaccid", tone: "warn" }
    : tonicity > 0.45
      ? { text: "Crenated (shrivelled)", tone: "bad" }
      : tonicity < -0.45
        ? { text: "Lysed (burst)", tone: "bad" }
        : { text: "Normal", tone: "good" };

  const mitochondria = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => [
        Math.cos(i * 1.9 + 0.6) * 2.1,
        Math.sin(i * 2.6) * 1.2,
        Math.sin(i * 1.7) * 1.3,
      ]),
    [],
  );
  const chloroplasts = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => [
        Math.cos(i * 1.05) * 2.7,
        Math.sin(i * 1.9) * 1.5,
        Math.sin(i * 1.3) * 1.5,
      ]),
    [],
  );
  const ribosomes = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => [
        (hashRandom(i + 3) - 0.5) * 5.4,
        (hashRandom(i + 33) - 0.5) * 3.4,
        (hashRandom(i + 63) - 0.5) * 3.4,
      ]),
    [],
  );

  const detail = selected ? ORGANELLES[selected] : null;

  return (
    <SceneCanvas
      camera={{ position: [0, 3, 12], fov: 45 }}
      onPointerMissed={() => setSelected(null)}
    >
      {/* Plant cells get a rigid wall the membrane can pull away from. */}
      {isPlant && (
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            setSelected("wall");
          }}
        >
          <boxGeometry args={[7.4, 5, 5]} />
          <meshStandardMaterial
            color={selected === "wall" ? PALETTE.emerald : "#3f6212"}
            emissive={selected === "wall" ? PALETTE.emerald : "#3f6212"}
            emissiveIntensity={selected === "wall" ? 0.8 : 0.2}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Membrane. */}
      <mesh
        scale={membraneScale}
        onClick={(e) => {
          e.stopPropagation();
          setSelected("membrane");
        }}
      >
        {isPlant ? <boxGeometry args={[7, 4.7, 4.7]} /> : <sphereGeometry args={[3.3, 40, 40]} />}
        <meshStandardMaterial
          color={selected === "membrane" ? PALETTE.gold : PALETTE.sky}
          emissive={selected === "membrane" ? PALETTE.gold : PALETTE.sky}
          emissiveIntensity={selected === "membrane" ? 0.9 : 0.25}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <group scale={membraneScale}>
        <Organelle
          id="nucleus"
          position={isPlant ? [-2, 0.9, 0] : [0, 0, 0]}
          geometry={<sphereGeometry args={[1, 32, 32]} />}
          colour={PALETTE.violet}
          selected={selected === "nucleus"}
          onSelect={setSelected}
          label={showLabels ? "Nucleus" : null}
        />
        {/* Nuclear envelope — outer double membrane ring */}
        <mesh position={isPlant ? [-2, 0.9, 0] : [0, 0, 0]}>
          <sphereGeometry args={[1.12, 28, 28]} />
          <meshStandardMaterial
            color={PALETTE.violet}
            transparent
            opacity={0.12}
            roughness={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Nuclear pore rings (4 rings around equator) */}
        {Array.from({ length: 4 }, (_, i) => {
          const angle = (i / 4) * Math.PI * 2;
          const nx = isPlant ? -2 : 0;
          const ny = 0.9;
          return (
            <mesh key={i} position={[nx + Math.cos(angle) * 1.12, ny + Math.sin(angle) * 0.5, 0.3]} rotation={[0.4, angle, 0]}>
              <torusGeometry args={[0.14, 0.04, 8, 16]} />
              <meshStandardMaterial color={PALETTE.violet} emissive={PALETTE.violet} emissiveIntensity={0.9} />
            </mesh>
          );
        })}

        {isPlant && (
          <Organelle
            id="vacuole"
            position={[1.1, 0, 0]}
            geometry={<sphereGeometry args={[1.7, 32, 32]} />}
            colour="#0ea5e9"
            scale={clamp(1 - Math.max(0, tonicity) * 0.45, 0.5, 1.15)}
            selected={selected === "vacuole"}
            onSelect={setSelected}
            label={showLabels ? "Vacuole" : null}
          />
        )}

        {mitochondria.map((p, i) => (
          <group key={i} position={p} rotation={[0, i * 0.8, 0.5]}>
            <Organelle
              id="mitochondrion"
              position={[0, 0, 0]}
              geometry={<capsuleGeometry args={[0.26, 0.68, 6, 16]} />}
              colour={PALETTE.rose}
              selected={selected === "mitochondrion"}
              onSelect={setSelected}
              label={showLabels && i === 0 ? "Mitochondria" : null}
            />
            {/* Inner membrane cristae — 3 horizontal rings */}
            {[0, -0.24, 0.24].map((dy, ci) => (
              <mesh key={ci} position={[0, dy, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.22, 0.04, 6, 14]} />
                <meshStandardMaterial color={PALETTE.rose} emissive={PALETTE.rose} emissiveIntensity={0.55} transparent opacity={0.65} />
              </mesh>
            ))}
          </group>
        ))}

        {isPlant &&
          chloroplasts.map((p, i) => (
            <group key={i} position={p} rotation={[0.4, i * 0.9, 0]}>
              <Organelle
                id="chloroplast"
                position={[0, 0, 0]}
                geometry={<sphereGeometry args={[0.38, 20, 20]} />}
                colour={PALETTE.emerald}
                scale={[1, 0.55, 1]}
                selected={selected === "chloroplast"}
                onSelect={setSelected}
                label={showLabels && i === 0 ? "Chloroplasts" : null}
              />
              {/* Thylakoid grana disc stack */}
              {[0, 0.15, -0.15].map((dy, ti) => (
                <mesh key={ti} position={[0, dy * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.18, 0.18, 0.06, 12]} />
                  <meshStandardMaterial color="#15803d" emissive={PALETTE.emerald} emissiveIntensity={0.7} transparent opacity={0.7} />
                </mesh>
              ))}
            </group>
          ))}

        {ribosomes.map((p, i) => (
          <AtomSphere
            key={i}
            position={p}
            radius={0.09}
            color={PALETTE.bone}
            emissiveIntensity={0.7}
            onClick={(e) => {
              e.stopPropagation();
              setSelected("ribosome");
            }}
          />
        ))}
      </group>

      <WaterFlow direction={-tonicity} active={water && Math.abs(tonicity) > 0.05} />

      <SceneReadout
        title={isPlant ? "Plant cell" : "Animal cell"}
        subtitle="Osmosis: water moves dilute → concentrated"
        rows={[
          ["Outside the cell", tonicity > 0.05 ? "concentrated" : tonicity < -0.05 ? "dilute" : "same as inside"],
          ["Net water flow", tonicity > 0.05 ? "out of the cell" : tonicity < -0.05 ? "into the cell" : "none"],
          ["State", status.text, status.tone === "good" ? "good" : status.tone === "warn" ? "warn" : "bad"],
          ["Cell wall", isPlant ? "yes — cellulose" : "no", isPlant ? "good" : "bad"],
          ["Chloroplasts", isPlant ? "yes" : "no", isPlant ? "good" : "bad"],
          ["Permanent vacuole", isPlant ? "yes" : "no", isPlant ? "good" : "bad"],
        ]}
        note={
          detail
            ? `${detail.label}: ${detail.info}`
            : isPlant
              ? "Click any organelle to identify it. The rigid wall is what saves a plant cell: water can push the membrane against it until the cell is turgid, without it bursting."
              : "Click any organelle to identify it. With no cell wall, an animal cell has nothing to resist the pressure — too much water in and it bursts."
        }
        noteTone={detail ? "good" : "neutral"}
      />

      <SceneLegend
        title={isPlant ? "Organelles · plant" : "Organelles · animal"}
        items={[
          { color: PALETTE.violet, label: "Nucleus", note: "holds the DNA, controls the cell" },
          { color: PALETTE.rose, label: "Mitochondria", note: "aerobic respiration — releases energy" },
          { color: PALETTE.bone, label: "Ribosomes", note: "where proteins are made" },
          ...(isPlant
            ? [
                { color: PALETTE.emerald, label: "Chloroplasts", note: "trap light for photosynthesis" },
                { color: "#0ea5e9", label: "Permanent vacuole", note: "cell sap — its pressure keeps the cell turgid" },
              ]
            : [{ color: PALETTE.sky, label: "Cell membrane", note: "partially permeable — and the only barrier there is" }]),
          ...(water && Math.abs(tonicity) > 0.05
            ? [{ color: PALETTE.sky, label: "Water molecules", note: tonicity > 0 ? "leaving by osmosis" : "entering by osmosis" }]
            : []),
        ]}
      />
    </SceneCanvas>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────

const SCENES = {
  enzyme: EnzymeScene,
  dna: DNAScene,
  cell: CellExplorerScene,
};

export default function BiologyCanvas({ topicId, params }) {
  const Scene = SCENES[topicId];
  if (!Scene) return null;
  return <Scene params={params} />;
}
