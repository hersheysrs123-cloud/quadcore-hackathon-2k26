"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  Bond,
  Callout,
  DEG,
  FitCamera,
  NoLabel,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";
import { STRUCTURE_META } from "@/components/visualizations/topic-options";
import { DENATURE_TEMP, ENZYME_COLOURS, OPTIMUM_TEMP, enzymeRate, solveEnzyme } from "@/lib/enzymes";
import { meshSdf, sdExtrudedPolygon, smax } from "@/components/visualizations/sdf-mesh";
import {
  BACKBONE_COLOURS,
  BASE_CLASS,
  BASE_COLOURS,
  BASE_PAIRS_PER_TURN,
  COMPLEMENT,
  HYDROGEN_BOND_COLOUR,
  PAIR_BONDS,
  sequenceFor,
} from "@/lib/dna";
import { CRENATION_AT, LYSIS_BELOW, PLASMOLYSIS_AT, organelleFor, solveOsmosis } from "@/lib/cellBiology";
import { BONDS_FORM_ABOVE, STRUCTURE_COLOURS, solveFolding } from "@/lib/proteinFolding";
import {
  BilayerPatch,
  CellWall,
  Centrioles,
  Chloroplast,
  CutawayProvider,
  Cytoplasm,
  Cytoskeleton,
  FreeRibosomes,
  Golgi,
  Lysosome,
  MembraneMaterial,
  Mitochondrion,
  Nucleus,
  Pickable,
  RoughER,
  SmoothER,
  Vacuole,
  fbm3,
  makeBlobGeometry,
  makeRoundedBoxGeometry,
} from "@/components/visualizations/cell-organelles";
import RespiratoryCanvas from "@/components/visualizations/RespiratoryCanvas";
import EyeCanvas from "@/components/visualizations/EyeCanvas";
import ReflexArcCanvas from "@/components/visualizations/ReflexArcCanvas";
import AntagonisticMusclesCanvas from "@/components/visualizations/AntagonisticMusclesCanvas";
import TranspirationCanvas from "@/components/visualizations/TranspirationCanvas";
import PeristalsisCanvas from "@/components/visualizations/PeristalsisCanvas";
import CarbonCycleCanvas from "@/components/visualizations/CarbonCycleCanvas";
import FoodChainPyramidCanvas from "@/components/visualizations/FoodChainPyramidCanvas";
import FlowerPollinationCanvas from "@/components/visualizations/FlowerPollinationCanvas";
import BacteriaVsVirusCanvas from "@/components/visualizations/BacteriaVsVirusCanvas";
import MitosisMeiosisCanvas from "@/components/visualizations/MitosisMeiosisCanvas";
import CardiacCycleCanvas from "@/components/visualizations/CardiacCycleCanvas";

// ─── IGCSE Biology · three scenes ───────────────────────────────────
// Enzyme action, DNA base pairing, and the plant/animal cell explorer.
// ─────────────────────────────────────────────────────────────────────

// ═══ 11 · Enzyme action & denaturation ═══════════════════════════════

// OPTIMUM_TEMP, OPTIMUM_PH and enzymeRate now live in lib/enzymes.js, so the
// Details panel reports the rate this scene's curve actually draws.

const ENZYME_R = 1.6;

/**
 * The substrate, in its own frame: the tongue's tip at the origin, the head
 * out along +x, 0.84 deep in z. It is drawn as its two halves, split along
 * y = 0 — the bond the enzyme breaks — so the products are exactly the two
 * pieces that went in. The lower edge has a step, so the key only fits one
 * way up, which is the point of a lock.
 */
const SUBSTRATE_UPPER = [[0, 0], [0.95, 0.42], [0.95, 0.62], [1.75, 0.62], [1.75, 0]];
const SUBSTRATE_LOWER = [[0, 0], [1.75, 0], [1.75, -0.62], [0.95, -0.62], [0.95, -0.36], [0.5, -0.36]];
const SUBSTRATE_HALF_DEPTH = 0.42;
const TONGUE = 0.95;
/**
 * The pocket: the tongue, continued straight out through the surface. In z it
 * has a floor behind the substrate and is open to the front, so it is a cleft
 * you can see into — carved as a closed slot it faced sideways and the
 * globule's own front hid it completely.
 */
const POCKET = [[0, 0], [0.5, -0.36], [3, -0.36], [3, 0.42], [0.95, 0.42]];
const POCKET_FRONT = 3;
const POCKET_CLEARANCE = 0.05;
/** The tongue's tip, in the enzyme's frame, when bound; the head clears the surface. */
const POCKET_TIP = ENZYME_R + 0.08 - TONGUE;

function enzymeBodySdf(x, y, z) {
  const r = Math.hypot(x, y, z);
  // A lumpy globule, then a fine bumpy skin, the way a space-filling model of
  // a protein reads: many atoms, no flat faces.
  const lump = ENZYME_R * (1 + 0.05 * fbm3(x * 1.1 + 3.1, y * 1.1 + 1.7, z * 1.1 + 0.4));
  const skin = 0.02 * Math.sin(x * 7.3) * Math.sin(y * 6.1 + 1.3) * Math.sin(z * 6.7 + 0.6);
  return r - lump - skin;
}

function pocketSdf(x, y, z) {
  const back = -SUBSTRATE_HALF_DEPTH;
  return sdExtrudedPolygon(x - POCKET_TIP, y, z - (POCKET_FRONT + back) / 2, POCKET, (POCKET_FRONT - back) / 2) - POCKET_CLEARANCE;
}

const ENZYME_BASE = new THREE.Color("#8fe3c3");
const ENZYME_PATCH = new THREE.Color("#c7f2df");
const ENZYME_SITE = new THREE.Color("#2fbf8f");
const ENZYME_DENATURED = new THREE.Color(ENZYME_COLOURS.denatured);

/**
 * The enzyme and its carved active site, built once. `site` is how close
 * each vertex is to the pocket (1 lining it, 0 far away), which both tints
 * the lining and says how much of the denaturation squeeze it takes.
 */
let enzymeBuild = null;
function buildEnzyme() {
  if (enzymeBuild) return enzymeBuild;
  const geometry = meshSdf((x, y, z) => smax(enzymeBodySdf(x, y, z), -pocketSdf(x, y, z), 0.09), {
    half: 1.95,
    resolution: 76,
    maxPolys: 90000,
  });
  const pos = geometry.attributes.position;
  const site = new Float32Array(pos.count);
  const base = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const near = clamp(1 - pocketSdf(x, y, z) / 0.35, 0, 1);
    site[i] = near * near * (3 - 2 * near);
    const patch = clamp(0.5 + fbm3(x * 2.2 + 9, y * 2.2 + 4, z * 2.2 + 1) * 1.4, 0, 1);
    c.copy(ENZYME_BASE).lerp(ENZYME_PATCH, patch * 0.7).lerp(ENZYME_SITE, site[i] * 0.85);
    base[i * 3] = c.r;
    base[i * 3 + 1] = c.g;
    base[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(Float32Array.from(base), 3));
  enzymeBuild = { geometry, original: Float32Array.from(pos.array), site, base };
  return enzymeBuild;
}

/**
 * The protein, deformed by `distortion` (0 intact, 1 fully denatured).
 *
 * The deformation is a smooth function of position, never of vertex index —
 * the old icosahedron wobbled each vertex by its index, so the copies of a
 * vertex along every seam drifted apart and the surface cracked open. On top
 * of a slow writhe, the active site's lining is squeezed towards its axis:
 * the groove narrows and warps, which is what "the substrate no longer fits"
 * looks like.
 */
function EnzymeBody({ distortion, animSpeed = 1.0 }) {
  const build = useMemo(buildEnzyme, []);
  const geometry = useMemo(() => build.geometry.clone(), [build]);
  const time = useRef(0);
  const shown = useRef(-1);
  const colour = useRef(new THREE.Color());

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, rawDelta) => {
    const amount = distortion;
    // An intact enzyme is static; only redraw while it is unfolding.
    if (amount < 0.005 && shown.current === 0) return;
    time.current += Math.min(rawDelta, 1 / 30) * animSpeed;
    const t = time.current;
    const pos = geometry.attributes.position;
    const col = geometry.attributes.color;
    const { original, site, base } = build;
    for (let i = 0; i < pos.count; i += 1) {
      const o = i * 3;
      const x = original[o];
      const y = original[o + 1];
      const z = original[o + 2];
      const n = Math.sin(x * 1.9 + t * 0.9) * Math.sin(y * 1.7 - t * 0.7) * Math.sin(z * 2.1 + t * 0.5);
      const grow = 1 + n * amount * 0.2;
      const squeeze = 1 - site[i] * amount * 0.6;
      pos.setXYZ(i, x * grow + site[i] * amount * 0.12, y * grow * squeeze, z * grow);
      colour.current.setRGB(base[o], base[o + 1], base[o + 2]).lerp(ENZYME_DENATURED, amount * 0.85);
      col.setXYZ(i, colour.current.r, colour.current.g, colour.current.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geometry.computeVertexNormals();
    shown.current = amount < 0.005 ? 0 : amount;
  });

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.62} metalness={0.02} emissive="#0b3b2c" emissiveIntensity={0.18} />
    </mesh>
  );
}

function extrudeHalf(poly) {
  const bevel = 0.06;
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: SUBSTRATE_HALF_DEPTH * 2 - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    // Inset by the bevel so the rounded solid keeps the outline the pocket was carved to.
    bevelOffset: -bevel,
    bevelSegments: 3,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -(SUBSTRATE_HALF_DEPTH - bevel));
  return geometry;
}

const SUBSTRATE_START = POCKET_TIP + 4.4;
const smooth = (t) => t * t * (3 - 2 * t);

const ENZYME_STAGES = [
  "substrate approaching the active site",
  "enzyme–substrate complex · the bond breaks",
  "products released · the enzyme is unchanged",
  "the active site has changed shape · the substrate does not fit",
];

/**
 * One substrate at a time: approach → bound → split → products drift away →
 * the next one. A wrecked active site turns it away at the mouth.
 */
function SubstrateCycle({ rate, blocked, animSpeed = 1, onStage, children }) {
  const upper = useRef(null);
  const lower = useRef(null);
  const upperMat = useRef(null);
  const lowerMat = useRef(null);
  const phase = useRef(0);
  const stage = useRef(-1);
  const geometries = useMemo(() => [extrudeHalf(SUBSTRATE_UPPER), extrudeHalf(SUBSTRATE_LOWER)], []);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  const gold = useMemo(() => new THREE.Color(ENZYME_COLOURS.substrate), []);
  const amber = useMemo(() => new THREE.Color(ENZYME_COLOURS.product), []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const u = upper.current;
    const l = lower.current;
    if (!u || !l) return;
    // A slow enzyme is a slow cycle; the floor keeps a cold one visibly alive.
    const speed = (blocked ? 0.2 : 0.1 + rate * 0.32) * animSpeed;
    phase.current = (phase.current + delta * speed) % 1;
    const p = phase.current;

    let x = SUBSTRATE_START;
    let lift = 0;
    let spin = 0;
    let scale = 1;
    let glow = 0;
    let split = 0;
    let next;

    if (blocked) {
      // In to the mouth, where the warped groove stops the tongue, then back out.
      const k = p < 0.5 ? smooth(p / 0.5) : smooth((1 - p) / 0.5);
      x = lerp(SUBSTRATE_START, POCKET_TIP + TONGUE * 0.72, k);
      lift = Math.sin(p * Math.PI * 2) * 0.12;
      spin = p > 0.42 && p < 0.58 ? Math.sin((p - 0.42) * 40) * 0.12 : 0;
      next = 3;
    } else if (p < 0.4) {
      const k = smooth(p / 0.4);
      x = lerp(SUBSTRATE_START, POCKET_TIP, k);
      lift = (1 - k) * Math.sin(p * 18) * 0.1;
      spin = (1 - k) * 0.35;
      next = 0;
    } else if (p < 0.62) {
      x = POCKET_TIP;
      glow = Math.sin(((p - 0.4) / 0.22) * Math.PI);
      next = 1;
    } else {
      const k = smooth((p - 0.62) / 0.38);
      x = POCKET_TIP + k * 2.9;
      split = k;
      scale = p > 0.9 ? 1 - (p - 0.9) / 0.1 : 1;
      next = 2;
    }

    u.position.set(x + split * 0.2, lift + split * 0.95, 0);
    l.position.set(x + split * 0.2, lift - split * 0.95, 0);
    u.rotation.set(split * 0.5, 0, spin + split * 0.7);
    l.rotation.set(-split * 0.4, 0, spin - split * 0.6);
    u.scale.setScalar(Math.max(scale, 0.001));
    l.scale.setScalar(Math.max(scale, 0.001));
    for (const mat of [upperMat.current, lowerMat.current]) {
      if (!mat) continue;
      mat.color.copy(split > 0 ? amber : gold);
      mat.emissive.copy(mat.color);
      mat.emissiveIntensity = 0.12 + glow * 0.55;
    }

    if (next !== stage.current) {
      stage.current = next;
      onStage?.(next);
    }
  });

  return (
    <>
      <mesh ref={upper} geometry={geometries[0]}>
        {/* The name rides on the molecule, whatever it is called at the moment. */}
        {children}
        <meshStandardMaterial ref={upperMat} color={ENZYME_COLOURS.substrate} emissive={ENZYME_COLOURS.substrate} emissiveIntensity={0.12} roughness={0.36} metalness={0.05} />
      </mesh>
      <mesh ref={lower} geometry={geometries[1]}>
        <meshStandardMaterial ref={lowerMat} color={ENZYME_COLOURS.substrate} emissive={ENZYME_COLOURS.substrate} emissiveIntensity={0.12} roughness={0.36} metalness={0.05} />
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
 * climb that speeds up to the optimum (Q10 ≈ 2), then a much steeper fall as
 * the molecules unfold — and a single frame cannot carry
 * a shape. The marker is the temperature you have dialled in.
 */
const CURVE = { width: 6.4, height: 1.7, maxTemp: 80 };
const CURVE_TICKS = [0, 20, 40, 60, 80];

function RateCurve({ temperature, ph, position, Label }) {
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
    <group position={position}>
      {/* A card behind the chart, a hair back so nothing on it is coplanar. */}
      <mesh position={[0.1, CURVE.height / 2 + 0.05, -0.04]}>
        <planeGeometry args={[CURVE.width + 1.3, CURVE.height + 1.25]} />
        <meshBasicMaterial color="#334059" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <Line points={[[-CURVE.width / 2, 0, 0], [CURVE.width / 2 + 0.3, 0, 0]]} color="#8a96b0" lineWidth={1.4} />
      <Line points={[[-CURVE.width / 2, 0, 0], [-CURVE.width / 2, CURVE.height + 0.3, 0]]} color="#8a96b0" lineWidth={1.4} />
      {CURVE_TICKS.map((t) => (
        <group key={t}>
          <Line points={[[xOf(t), 0, 0], [xOf(t), -0.08, 0]]} color="#8a96b0" lineWidth={1.2} />
          <Label position={[xOf(t), -0.3, 0]} tone="text-ink-400">{`${t}°`}</Label>
        </group>
      ))}

      {/* The two temperatures worth naming, labelled at different heights so they never collide. */}
      {[
        { t: OPTIMUM_TEMP, colour: PALETTE.emerald, text: `optimum ${OPTIMUM_TEMP}°C`, lift: 0.3, tone: "text-emerald-300" },
        { t: DENATURE_TEMP, colour: PALETTE.rose, text: `fully denatured by ${DENATURE_TEMP}°C`, lift: 0.72, tone: "text-rose-300" },
      ].map(({ t, colour, text, lift, tone }) => (
        <group key={t}>
          <Line
            points={[[xOf(t), 0, 0], [xOf(t), CURVE.height + lift - 0.12, 0]]}
            color={colour}
            lineWidth={1.2}
            transparent
            opacity={0.55}
            dashed
            dashSize={0.14}
            gapSize={0.12}
          />
          <Label position={[xOf(t), CURVE.height + lift, 0]} tone={tone}>
            {text}
          </Label>
        </group>
      ))}

      {/* Between the optimum and full denaturation the enzyme is denaturing: a band, not a line. */}
      <mesh position={[(xOf(OPTIMUM_TEMP) + xOf(DENATURE_TEMP)) / 2, CURVE.height / 2, -0.02]}>
        <planeGeometry args={[xOf(DENATURE_TEMP) - xOf(OPTIMUM_TEMP), CURVE.height]} />
        <meshBasicMaterial color={ENZYME_COLOURS.denatured} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <Label position={[(xOf(OPTIMUM_TEMP) + xOf(DENATURE_TEMP)) / 2 + 0.3, CURVE.height * 0.5, 0]} tone="text-rose-300">
        denaturing
      </Label>

      <Line points={curve} color={ENZYME_COLOURS.curve} lineWidth={2.8} />

      {/* Where you are on it. */}
      <mesh position={[xOf(temperature), yOf(here), 0.01]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color={ENZYME_COLOURS.marker} emissive={ENZYME_COLOURS.marker} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <Line points={[[xOf(temperature), 0, 0], [xOf(temperature), yOf(here), 0]]} color={ENZYME_COLOURS.marker} lineWidth={1.2} transparent opacity={0.45} />

      <Label position={[-CURVE.width / 2 - 0.55, CURVE.height / 2, 0]} tone="text-ink-400">
        rate
      </Label>
      <Label position={[CURVE.width / 2 + 0.95, -0.3, 0]} tone="text-ink-400">
        temperature
      </Label>
    </group>
  );
}

const ENZYME_AT = [-1.7, 1.25, 0];
const ENZYME_VIEW = { cx: 0.55, cy: 0.05, width: 10.2, height: 7.6, depth: 3.4 };

export function EnzymeScene({ params = {} }) {
  const { temperature = 37, ph = 7.0, speed = 1.0, showLabels = true } = params || {};
  const Label = showLabels ? SceneLabel : NoLabel;
  // One solve, shared with the Details panel.
  const e = solveEnzyme({ temperature, ph });
  const { rate, denatured, distortion } = e;
  const blocked = denatured || e.extremePh;
  const [stage, setStage] = useState(0);

  return (
    <SceneCanvas camera={{ position: [0.55, 1.2, 13], fov: 45 }} lights={{ ambient: 0.75, keyLight: 1.35 }}>
      <FitCamera view={ENZYME_VIEW} direction={[0.16, 0.2, 1]} />
      {/* A soft fill from the front, so the inside of the pocket is not a black hole. */}
      <pointLight position={[2.5, 2.5, 5]} intensity={18} distance={14} decay={2} color="#fff7e6" />

      <group position={ENZYME_AT}>
        <EnzymeBody distortion={distortion} animSpeed={speed} />
        <SubstrateCycle rate={rate} blocked={blocked} animSpeed={speed} onStage={setStage}>
          <Label position={[1.2, 1.0, 0]} tone="text-amber-300">
            {stage === 2 ? "products" : stage === 1 ? "enzyme–substrate complex" : "substrate"}
          </Label>
        </SubstrateCycle>
        <Label position={[-1.2, 1.75, 0]} tone={blocked ? "text-rose-300" : e.denaturing ? "text-amber-300" : "text-emerald-300"}>
          {blocked ? "denatured enzyme" : e.denaturing ? "enzyme · denaturing" : "enzyme"}
        </Label>
        <Label position={[POCKET_TIP + 0.5, -1.05, 0.9]} tone={blocked ? "text-rose-300" : e.denaturing ? "text-amber-300" : "text-emerald-300"}>
          {blocked ? "active site · wrong shape" : e.denaturing ? "active site · losing shape" : "active site"}
        </Label>
      </group>

      <Label position={[ENZYME_VIEW.cx, 3.55, 0]} accent>
        {ENZYME_STAGES[blocked ? 3 : Math.min(stage, 2)]}
      </Label>

      <RateCurve temperature={temperature} ph={ph} position={[0.75, -3.05, 0]} Label={Label} />
    </SceneCanvas>
  );
}

// ═══ 12 · DNA double helix & base pairing ════════════════════════════

// The base tables and the sequence generator now live in lib/dna.js.

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

/** 1 nm of real helix is 1.5 world units: phosphates at ~1 nm, sugars nearer the axis. */
const PHOSPHATE_R = 1.5;
const SUGAR_R = 1.0;
// B-DNA rises 0.34 nm per base pair and makes a full turn every 10.5 pairs.
const RISE = 1.5 * 0.34;
const TWIST = (Math.PI * 2) / BASE_PAIRS_PER_TURN;

/**
 * Where a backbone point sits. B-DNA is RIGHT-handed: rising along +y it
 * turns anticlockwise seen from above, so z = −sin. The old helix used
 * z = +sin and was left-handed — the one form of the molecule that is not
 * what cells carry.
 */
function helixPoint(out, angle, radius, y) {
  return out.set(Math.cos(angle) * radius, y, -Math.sin(angle) * radius);
}

/** Ring size (circumradius) for the bases; a purine is two fused rings, a pyrimidine one. */
const RING = 0.26;
/** Short glycosidic link from the sugar to its base. */
const STUB = 0.12;

/**
 * Outline of a base in the pair plane: u runs from the sugar towards the
 * partner, v across. Both put a flat edge towards the partner, so the
 * hydrogen bonds run straight across the gap between them.
 */
function baseOutline(kind) {
  const a = RING;
  const hex = (du) => [
    [du + 0.866 * a, 0.5 * a],
    [du, a],
    [du - 0.866 * a, 0.5 * a],
    [du - 0.866 * a, -0.5 * a],
    [du, -a],
    [du + 0.866 * a, -0.5 * a],
  ];
  if (kind === "pyrimidine") return hex(0.866 * a);
  // Purine: the five-membered ring bonds to the sugar (N9), the six-membered
  // ring faces the partner. Pentagon fused on the hexagon's sugar-side edge.
  const s = 2.405 * a;
  return [
    [s + 0.866 * a, 0.5 * a],
    [s, a],
    [s - 0.866 * a, 0.5 * a],
    [s - 1.817 * a, 0.809 * a],
    [0, 0],
    [s - 1.817 * a, -0.809 * a],
    [s - 0.866 * a, -0.5 * a],
    [s, -a],
    [s + 0.866 * a, -0.5 * a],
  ];
}

const BASE_LENGTH = { purine: 3.271 * RING, pyrimidine: 1.732 * RING };

/** A flat ring plate lying in the xz plane, u along +x, 0.08 thick. */
function makePlate(outline, thickness = 0.08) {
  const shape = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelOffset: -0.015,
    bevelSegments: 2,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness / 2, 0);
  return geometry;
}

function pentagonOutline(r) {
  return Array.from({ length: 5 }, (_, k) => {
    const t = (k / 5) * Math.PI * 2;
    return [r + Math.cos(t) * r, Math.sin(t) * r];
  });
}

const HELIX_UP = new THREE.Vector3(0, 1, 0);
const linkDelta = new THREE.Vector3();
const SUGAR_A = new THREE.Vector3();
const SUGAR_B = new THREE.Vector3();
const ACROSS = new THREE.Vector3();
const SIDEWAYS = new THREE.Vector3();
const TIP_A = new THREE.Vector3();
const TIP_B = new THREE.Vector3();
const BOND_A = new THREE.Vector3();
const BOND_B = new THREE.Vector3();

/**
 * Point a unit-height cylinder from `a` to `b`. Everything joins two things
 * that move while the helix unzips, so it is placed per frame rather than
 * baked into static geometry.
 */
function stretchBetween(mesh, a, b) {
  if (!mesh) return;
  linkDelta.subVectors(b, a);
  const length = linkDelta.length();
  if (length < 1e-5) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(HELIX_UP, linkDelta.normalize());
  mesh.scale.set(1, length, 1);
}

/** Lay a plate whose local +x is `dir` (horizontal) with its origin at `at`. */
function layPlate(mesh, at, dir) {
  if (!mesh) return;
  mesh.position.copy(at);
  mesh.rotation.set(0, Math.atan2(-dir.z, dir.x), 0);
}

function useDnaKit() {
  const kit = useMemo(() => {
    const standard = (colour, extra = {}) =>
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.42, metalness: 0.04, emissive: colour, emissiveIntensity: 0.14, ...extra });
    return {
      purine: makePlate(baseOutline("purine")),
      pyrimidine: makePlate(baseOutline("pyrimidine")),
      sugar: makePlate(pentagonOutline(0.13), 0.07),
      phosphate: new THREE.SphereGeometry(0.15, 20, 14),
      rail: new THREE.CylinderGeometry(0.06, 0.06, 1, 10),
      link: new THREE.CylinderGeometry(0.04, 0.04, 1, 8),
      bond: new THREE.CylinderGeometry(0.018, 0.018, 1, 6),
      bases: Object.fromEntries(Object.entries(BASE_COLOURS).map(([b, c]) => [b, standard(c)])),
      strand: [standard(BACKBONE_COLOURS.strandA), standard(BACKBONE_COLOURS.strandB)],
      phosphateMat: standard(BACKBONE_COLOURS.phosphate, { roughness: 0.3 }),
    };
  }, []);
  useEffect(
    () => () => {
      for (const v of Object.values(kit)) {
        if (v?.dispose) v.dispose();
        else if (v && typeof v === "object") for (const m of Object.values(v)) m?.dispose?.();
      }
    },
    [kit],
  );
  return kit;
}

function Helix({ pairs, unzipToken, speed = 1.0, Label }) {
  const kit = useDnaKit();
  const group = useRef(null);
  const parts = useRef([]);
  const unzip = useRef(0);
  const target = useRef(0);

  const sequence = useMemo(() => sequenceFor(pairs), [pairs]);
  // Hydrogen-bond materials fade individually as their pair parts.
  const bondMats = useMemo(
    () => sequence.map(() => new THREE.MeshBasicMaterial({ color: HYDROGEN_BOND_COLOUR, transparent: true, opacity: 0.9 })),
    [sequence],
  );
  useEffect(() => () => bondMats.forEach((m) => m.dispose()), [bondMats]);

  useEffect(() => {
    if (!unzipToken) return undefined;
    target.current = 1;
    const id = setTimeout(() => {
      target.current = 0;
      // Floor the divisor: a speed of 0 would give Infinity, which setTimeout
      // coerces to 0 and fires immediately — re-zipping the helix the instant
      // the button is pressed.
    }, Math.max(900, 3400 / Math.max(speed, 0.05)));
    return () => clearTimeout(id);
  }, [unzipToken, speed]);

  const height = (pairs - 1) * RISE;

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    // The turn is paced by Animation Speed alone (0 stops it).
    if (group.current) group.current.rotation.y += delta * 0.5 * speed;
    unzip.current = lerp(unzip.current, target.current, Math.min(1, delta * 1.1 * speed));

    for (let i = 0; i < pairs; i += 1) {
      const p = parts.current[i];
      if (!p) continue;
      // Unzipping runs from the top down, like a replication fork.
      const open = clamp(unzip.current * pairs - (pairs - 1 - i), 0, 1);
      const spread = open * 1.5;
      const angle = i * TWIST;
      const y = i * RISE - height / 2;

      helixPoint(SUGAR_A, angle, SUGAR_R + spread, y);
      helixPoint(SUGAR_B, angle + STRAND_OFFSET, SUGAR_R + spread, y);
      ACROSS.subVectors(SUGAR_B, SUGAR_A).normalize();
      SIDEWAYS.set(-ACROSS.z, 0, ACROSS.x);

      layPlate(p.sugarA, SUGAR_A, ACROSS);
      layPlate(p.sugarB, SUGAR_B, ACROSS.clone().negate());
      if (p.sugarA) p.sugarA.position.addScaledVector(ACROSS, -0.26);
      if (p.sugarB) p.sugarB.position.addScaledVector(ACROSS, 0.26);

      // Each base on a short glycosidic link, pointing across at its partner.
      TIP_A.copy(SUGAR_A).addScaledVector(ACROSS, STUB);
      TIP_B.copy(SUGAR_B).addScaledVector(ACROSS, -STUB);
      stretchBetween(p.linkA, SUGAR_A, TIP_A);
      stretchBetween(p.linkB, SUGAR_B, TIP_B);
      layPlate(p.baseA, TIP_A, ACROSS);
      layPlate(p.baseB, TIP_B, ACROSS.clone().negate());
      TIP_A.addScaledVector(ACROSS, p.lengthA);
      TIP_B.addScaledVector(ACROSS, -p.lengthB);

      // Two hydrogen bonds for A–T, three for C–G, spread along the facing edges.
      // They stretch as the fork opens and are gone once the pair has parted.
      const count = p.bonds.length;
      for (let k = 0; k < count; k += 1) {
        const v = count === 1 ? 0 : (k / (count - 1) - 0.5) * RING * (count === 3 ? 0.9 : 0.6);
        BOND_A.copy(TIP_A).addScaledVector(SIDEWAYS, v);
        BOND_B.copy(TIP_B).addScaledVector(SIDEWAYS, v);
        stretchBetween(p.bonds[k], BOND_A, BOND_B);
        if (p.bonds[k]) p.bonds[k].visible = open < 0.55;
      }
      bondMats[i].opacity = 0.9 * clamp(1 - open / 0.55, 0, 1);

      p.sugarPosA = p.sugarPosA || new THREE.Vector3();
      p.sugarPosB = p.sugarPosB || new THREE.Vector3();
      p.sugarPosA.copy(SUGAR_A);
      p.sugarPosB.copy(SUGAR_B);
      p.spread = spread;
    }

    // Backbone: sugar → phosphate → next sugar, on each strand. The phosphate
    // sits further out than the sugars, which is why the backbone is the
    // outside of the helix and the bases the inside.
    for (let i = 0; i < pairs - 1; i += 1) {
      const p = parts.current[i];
      const q = parts.current[i + 1];
      if (!p || !q || !p.sugarPosA || !q.sugarPosA) continue;
      const spread = (p.spread + q.spread) / 2;
      const angle = (i + 0.5) * TWIST;
      const y = (i + 0.5) * RISE - height / 2;
      helixPoint(TIP_A, angle, PHOSPHATE_R + spread, y);
      helixPoint(TIP_B, angle + STRAND_OFFSET, PHOSPHATE_R + spread, y);
      p.phosphateA?.position.copy(TIP_A);
      p.phosphateB?.position.copy(TIP_B);
      stretchBetween(p.railA0, p.sugarPosA, TIP_A);
      stretchBetween(p.railA1, TIP_A, q.sugarPosA);
      stretchBetween(p.railB0, p.sugarPosB, TIP_B);
      stretchBetween(p.railB1, TIP_B, q.sugarPosB);
    }
  });

  const slot = (i) => {
    if (!parts.current[i]) parts.current[i] = { bonds: [] };
    return parts.current[i];
  };

  const top = height / 2;

  return (
    <group ref={group}>
      {sequence.map((base, i) => {
        const partner = COMPLEMENT[base];
        const p = slot(i);
        p.lengthA = BASE_LENGTH[BASE_CLASS[base]];
        p.lengthB = BASE_LENGTH[BASE_CLASS[partner]];
        p.bonds.length = PAIR_BONDS[base];
        return (
          <group key={`${i}-${base}`}>
            <mesh ref={(el) => (slot(i).baseA = el)} geometry={kit[BASE_CLASS[base]]} material={kit.bases[base]} />
            <mesh ref={(el) => (slot(i).baseB = el)} geometry={kit[BASE_CLASS[partner]]} material={kit.bases[partner]} />
            <mesh ref={(el) => (slot(i).sugarA = el)} geometry={kit.sugar} material={kit.strand[0]} />
            <mesh ref={(el) => (slot(i).sugarB = el)} geometry={kit.sugar} material={kit.strand[1]} />
            <mesh ref={(el) => (slot(i).linkA = el)} geometry={kit.link} material={kit.strand[0]} />
            <mesh ref={(el) => (slot(i).linkB = el)} geometry={kit.link} material={kit.strand[1]} />
            {Array.from({ length: PAIR_BONDS[base] }, (_, k) => (
              <mesh key={k} ref={(el) => (slot(i).bonds[k] = el)} geometry={kit.bond} material={bondMats[i]} />
            ))}
            {i < pairs - 1 && (
              <>
                <mesh ref={(el) => (slot(i).phosphateA = el)} geometry={kit.phosphate} material={kit.phosphateMat} />
                <mesh ref={(el) => (slot(i).phosphateB = el)} geometry={kit.phosphate} material={kit.phosphateMat} />
                <mesh ref={(el) => (slot(i).railA0 = el)} geometry={kit.rail} material={kit.strand[0]} />
                <mesh ref={(el) => (slot(i).railA1 = el)} geometry={kit.rail} material={kit.strand[0]} />
                <mesh ref={(el) => (slot(i).railB0 = el)} geometry={kit.rail} material={kit.strand[1]} />
                <mesh ref={(el) => (slot(i).railB1 = el)} geometry={kit.rail} material={kit.strand[1]} />
              </>
            )}
          </group>
        );
      })}

      {/* Strand 1 is read 5′→3′ upwards; strand 2 runs the other way. */}
      <Label position={helixPoint(new THREE.Vector3(), 0, PHOSPHATE_R + 0.45, -top - 0.35).toArray()} tone="text-ink-300">5′ strand 1</Label>
      <Label position={helixPoint(new THREE.Vector3(), (pairs - 1) * TWIST, PHOSPHATE_R + 0.45, top + 0.35).toArray()} tone="text-ink-300">3′</Label>
      <Label position={helixPoint(new THREE.Vector3(), STRAND_OFFSET, PHOSPHATE_R + 0.45, -top - 0.35).toArray()} tone="text-ink-300">3′ strand 2</Label>
      <Label position={helixPoint(new THREE.Vector3(), (pairs - 1) * TWIST + STRAND_OFFSET, PHOSPHATE_R + 0.45, top + 0.35).toArray()} tone="text-ink-300">5′</Label>
    </group>
  );
}

const DNA_VIEW = { cx: 0, cy: -0.55, width: 7.4, height: 11.6, depth: 3.4 };

export function DNAScene({ params = {} }) {
  const { pairs = 16, unzip = 0, speed = 1.0, showLabels = true } = params || {};
  const Label = showLabels ? SceneLabel : NoLabel;
  const count = Math.round(pairs);

  // A long strand used to run straight out of the top and bottom of the
  // frame; scaling to fit keeps every setting of the slider fully visible.
  const fit = clamp(8.4 / (count * RISE), 0.4, 1);
  const height = (count - 1) * RISE * fit;

  return (
    <SceneCanvas camera={{ position: [0, 0.8, 13], fov: 45 }} controls={{ minDistance: 4 }} lights={{ ambient: 0.8, keyLight: 1.3 }}>
      {/* From a little above, so the base rings are seen as rings rather than edge-on sticks. */}
      <FitCamera view={DNA_VIEW} direction={[0, 0.55, 1]} />
      <pointLight position={[0, 2, 6]} intensity={14} distance={16} decay={2} color="#fff8ee" />
      <group scale={fit}>
        <Helix pairs={count} unzipToken={unzip} speed={speed} Label={Label} />
      </group>

      {/* Fixed callouts, outside the spinning group so they stay readable. */}
      <Label position={[-3.0, height / 4, 0]} tone="text-ink-300">sugar–phosphate backbone</Label>
      {/* Low enough to clear the strand-end labels under the helix. */}
      <Label position={[0, -height / 2 - 2.05, 0]} tone="text-ink-200">
        <span className="inline-block text-center">
          hydrogen bonds · 2 across A=T, 3 across C≡G
          <br />
          <span className="text-ink-400">a purine (two rings) always pairs with a pyrimidine (one)</span>
        </span>
      </Label>
    </SceneCanvas>
  );
}

// ═══ 13 · Cell organelle explorer ════════════════════════════════════

// The organelle table now lives in lib/cellBiology.js, which also records
// which cell type each organelle belongs to.

/**
 * Cytoplasm leaving a burst animal cell.
 *
 * Fragments start on the membrane and drift outward, fading as they go — the
 * visible consequence of there being no cell wall to resist the pressure.
 */
function LysisSpill({ radius, speed = 1.0 }) {
  const meshes = useRef([]);
  const bits = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        // An even-ish scatter over the sphere, so the spill is not one-sided.
        theta: hashRandom(i * 3.1 + 5) * Math.PI * 2,
        phi: Math.acos(2 * hashRandom(i * 5.7 + 11) - 1),
        phase: hashRandom(i * 7.3 + 17),
        size: 0.06 + hashRandom(i * 9.1 + 23) * 0.09,
      })),
    [],
  );
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += Math.min(delta, 1 / 30) * 0.35 * speed;
    bits.forEach((b, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const local = (t.current + b.phase) % 1;
      const r = radius * (0.9 + local * 0.9);
      const sinPhi = Math.sin(b.phi);
      mesh.position.set(
        Math.cos(b.theta) * sinPhi * r,
        Math.cos(b.phi) * r,
        Math.sin(b.theta) * sinPhi * r,
      );
      // Fade out as they get away from the cell.
      mesh.scale.setScalar(b.size * Math.max(0, 1 - local));
    });
  });

  return (
    <>
      {bits.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial
            color={PALETTE.rose}
            emissive={PALETTE.rose}
            emissiveIntensity={0.9}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </>
  );
}

function WaterFlow({ direction, active, reach = 4.9, speed = 1.0 }) {
  const meshes = useRef([]);
  const drops = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        angle: hashRandom(i + 2) * Math.PI * 2,
        tilt: (hashRandom(i + 40) - 0.5) * 2,
        phase: hashRandom(i + 80),
      })),
    [],
  );
  const t = useRef(0);

  useFrame((_, delta) => {
    if (active) t.current += delta * 0.4 * speed;
    drops.forEach((d, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const local = (t.current + d.phase) % 1;
      // direction > 0 → water entering the cell.
      const r = direction > 0 ? lerp(reach, 1.2, local) : lerp(1.2, reach, local);
      mesh.position.set(Math.cos(d.angle) * r, d.tilt * r * 0.32, Math.sin(d.angle) * r);
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

const PLANT_SIZE = [7.6, 5.1, 5.1];
const ANIMAL_RADIUS = 3.15;

/**
 * Where each organelle sits.
 *
 * Hand-placed rather than scattered, because the arrangement is itself
 * examinable: in a plant cell the vacuole takes the middle and everything
 * else is squeezed into a thin layer of cytoplasm against the wall, which is
 * exactly why chloroplasts end up near the surface where the light is.
 */
const PLANT_LAYOUT = {
  nucleus: [-2.1, 0.5, 0.15],
  // On the cut, so the Golgi shows in the cutaway (it used to sit wholly in front of it).
  golgi: [-1.15, -1.4, -0.15],
  smoothEr: [-0.9, 1.45, -0.55],
  mitochondria: [
    [-0.25, 1.6, 0.85],
    [1.8, 1.35, -0.75],
    [2.6, -0.55, 0.65],
    [0.35, -1.6, -0.85],
    [-2.35, -1.05, -0.75],
    [2.0, 0.8, 1.05],
  ],
  chloroplasts: [
    [-2.75, 1.35, 0.35],
    [-1.3, 1.8, -1.0],
    [0.95, 1.75, 0.95],
    [2.7, 1.05, -0.45],
    [2.75, -1.15, 0.3],
    [1.15, -1.75, 0.85],
    [-1.5, -1.7, -0.85],
    [-2.6, -1.55, 0.85],
  ],
  lysosomes: [],
};

const ANIMAL_LAYOUT = {
  nucleus: [0, 0, 0],
  // Golgi, centrioles and the first lysosome sit on the cut so the cutaway keeps them.
  golgi: [1.55, -1.15, -0.15],
  smoothEr: [1.5, 1.15, -0.6],
  centrioles: [-1.75, 1.05, -0.2],
  mitochondria: [
    [-1.9, -1.0, 0.8],
    [1.0, 1.75, -0.7],
    [2.3, 0.35, 0.9],
    [-0.6, -2.0, -0.8],
    [-2.4, 0.5, -0.9],
    [0.7, -1.5, 1.5],
  ],
  lysosomes: [
    [-1.2, 1.8, -0.1],
    [2.0, -1.3, -0.7],
    [-2.3, -1.3, 0.2],
    [1.3, 1.2, 1.4],
  ],
};

/**
 * Lights placed *inside* the cell.
 *
 * The shared StudioLights rig lights an object from outside, which is right
 * for a molecule and wrong for a cell — everything past the membrane fell
 * into flat shadow. Two dim point lights in the cytoplasm give the interior
 * its own falloff, so depth reads through the translucent envelope.
 */
function InteriorLights() {
  return (
    <>
      <pointLight position={[0, 0, 0]} intensity={9} distance={9} decay={2} color="#bfdbfe" />
      <pointLight position={[-2.4, 1.6, 1.8]} intensity={5} distance={7} decay={2} color="#fef3c7" />
      <pointLight position={[2.2, -1.4, -1.6]} intensity={4} distance={7} decay={2} color="#a7f3d0" />
    </>
  );
}

/**
 * The organelle names, as callouts in two columns either side of the cell.
 *
 * Each organelle used to float its own label just above itself, and in a cell
 * that is thirty things in a small box: Chloroplast, Nucleus, Rough ER, Smooth
 * ER, Mitochondrion and Permanent vacuole piled up in one corner, most of them
 * unreadable. Anchors are in the cell's own (scaled) frame, so they follow the
 * membrane as it shrinks or swells.
 */
// Every anchor is on something drawn both with and without the cutaway (which
// removes z > 0): the outline of whatever crosses the cut (wall, membrane,
// nucleus, rough ER, vacuole) at z = 0, or the near face of an organelle that
// sits behind it. Anchors in front of the cut pointed at empty space once it
// was sliced away.
const PLANT_CALLOUTS = [
  { id: "wall", text: "Cell wall", anchor: [-3.75, 2.0, 0], at: [-4.6, 2.55, 0], side: "left" },
  { id: "chloroplast", text: "Chloroplast", anchor: [-1.3, 1.8, -0.75], at: [-4.6, 1.6, 0], side: "left" },
  { id: "nucleus", text: "Nucleus", anchor: [-2.9, 0.6, 0], at: [-4.6, 0.6, 0], side: "left" },
  { id: "er", text: "Rough ER", anchor: [-2.95, -0.4, 0], at: [-4.6, -0.4, 0], side: "left" },
  { id: "golgi", text: "Golgi apparatus", anchor: [-1.15, -1.4, 0], at: [-4.6, -1.4, 0], side: "left" },
  { id: "membrane", text: "Cell membrane", anchor: [-3.45, -1.2, 0], at: [-4.6, -2.4, 0], side: "left" },
  { id: "smoothEr", text: "Smooth ER", anchor: [-0.9, 1.6, -0.2], at: [4.6, 2.55, 0], side: "right" },
  { id: "mitochondrion", text: "Mitochondrion", anchor: [1.8, 1.35, -0.45], at: [4.6, 1.6, 0], side: "right" },
  { id: "vacuole", text: "Permanent vacuole", anchor: [1.3, -0.1, 0], at: [4.6, 0.6, 0], side: "right", scaled: true },
  { id: "ribosome", text: "Ribosomes", anchor: [1.6, -1.0, -0.3], at: [4.6, -0.4, 0], side: "right" },
  { id: "cytoplasm", text: "Cytoplasm", anchor: [3.1, 0.35, -0.2], at: [4.6, -1.4, 0], side: "right" },
];

const ANIMAL_CALLOUTS = [
  { id: "lysosome", text: "Lysosome", anchor: [-1.2, 1.8, 0], at: [-4.3, 2.4, 0], side: "left" },
  { id: "centriole", text: "Centrioles", anchor: [-1.75, 1.05, 0], at: [-4.3, 1.4, 0], side: "left" },
  { id: "nucleus", text: "Nucleus", anchor: [-1.1, 0.25, 0], at: [-4.3, 0.3, 0], side: "left" },
  { id: "mitochondrion", text: "Mitochondrion", anchor: [-2.4, 0.5, -0.6], at: [-4.3, -0.9, 0], side: "left" },
  { id: "membrane", text: "Cell membrane", anchor: [-2.6, -1.75, 0], at: [-4.3, -2.0, 0], side: "left" },
  { id: "smoothEr", text: "Smooth ER", anchor: [1.5, 1.15, -0.2], at: [4.3, 2.4, 0], side: "right" },
  { id: "er", text: "Rough ER", anchor: [1.42, 0.45, 0], at: [4.3, 1.4, 0], side: "right" },
  { id: "ribosome", text: "Ribosomes", anchor: [1.75, -0.35, -0.3], at: [4.3, 0.3, 0], side: "right" },
  { id: "golgi", text: "Golgi apparatus", anchor: [1.55, -1.15, 0], at: [4.3, -0.9, 0], side: "right" },
  { id: "cytoplasm", text: "Cytoplasm", anchor: [2.05, -2.0, -0.2], at: [4.3, -2.0, 0], side: "right" },
];

const PLANT_VIEW = { cx: 0, cy: 0.1, width: 13.4, height: 7.2, depth: 5 };
const ANIMAL_VIEW = { cx: 0, cy: 0.1, width: 12.6, height: 7.6, depth: 5 };

function CellCallouts({ isPlant, selected, vacuoleScale }) {
  const list = isPlant ? PLANT_CALLOUTS : ANIMAL_CALLOUTS;
  return list.map(({ id, text, anchor, at, side, scaled }) => (
    <Callout
      key={id}
      anchor={scaled ? [anchor[0] * vacuoleScale + 0.6 * (1 - vacuoleScale), anchor[1] * vacuoleScale, anchor[2] * vacuoleScale] : anchor}
      at={at}
      side={side}
      accent={selected === id}
    >
      {text}
    </Callout>
  ));
}

export function CellExplorerScene({ params = {} }) {
  const { cellType = "plant", tonicity = 0, showLabels = true, water = true, cutaway = true, speed = 1.0 } = params || {};
  const [selected, setSelected] = useState(null);
  const isPlant = cellType === "plant";

  // Negative tonicity = dilute outside = water enters = the cell swells.
  const swell = clamp(1 - tonicity * 0.22, 0.72, 1.2);
  // A flaccid plant cell's membrane still lines the wall; it only pulls away
  // once the cell plasmolyses. It used to shrink from the first hint of a
  // concentrated solution, so the scene showed a detached membrane while the
  // panel (rightly) said "Flaccid".
  const pullAway = Math.max(0, tonicity - PLASMOLYSIS_AT * 0.85);
  const membraneScale = isPlant ? clamp(1 - pullAway * 0.55, 0.66, 1) : swell;

  // One solve, shared with the Details panel — which used to switch states at
  // ±0.05 against the scene's ±0.45, and never said "Flaccid" at all.
  const osmosis = solveOsmosis({ cellType, tonicity });
  const status = { text: osmosis.state, tone: osmosis.tone };

  const layout = isPlant ? PLANT_LAYOUT : ANIMAL_LAYOUT;

  /**
   * The animal cell's membrane changes SHAPE, not just size.
   *
   * Its only response to tonicity used to be a uniform scale, so a cell the
   * readout called "Lysed (burst)" was drawn 20 % larger than normal and
   * perfectly intact, and a "Crenated (shrivelled)" one was drawn 10 % smaller
   * and perfectly smooth. Both are states the topic exists to teach.
   *
   * Hypotonic: the surface tension smooths the blob towards a sphere as it
   * swells, and past the lysis threshold the membrane ruptures.
   * Hypertonic: the noise amplitude climbs sharply, so the surface crenates
   * into spicules instead of shrinking smoothly.
   */
  const shapeAmp = isPlant
    ? 0.014
    : tonicity > 0
      ? 0.055 + Math.min(1, tonicity / CRENATION_AT) * 0.22
      : 0.055 * (1 - Math.min(1, -tonicity / Math.abs(LYSIS_BELOW)) * 0.75);
  // Quantised so dragging the slider does not rebuild the mesh every frame.
  const ampStep = Math.round(shapeAmp * 60) / 60;

  const membraneGeometry = useMemo(
    () =>
      isPlant
        ? makeRoundedBoxGeometry({ size: [7.0, 4.7, 4.7], exponent: 6, amp: 0.014, seed: 9 })
        : makeBlobGeometry({
            radius: ANIMAL_RADIUS,
            amp: ampStep,
            // Tighter noise as it crenates: spicules, not gentle lobes.
            freq: ampStep > 0.1 ? 3.4 : 1.5,
            seed: 17,
            segments: 76,
            rings: 52,
          }),
    [isPlant, ampStep],
  );

  const lysed = !isPlant && osmosis.state.startsWith("Lysed");
  useEffect(() => () => membraneGeometry.dispose(), [membraneGeometry]);

  const bounds = isPlant ? [3.0, 2.0, 2.0] : [2.4, 2.0, 2.0];
  const vacuoleScale = clamp(1 - Math.max(0, tonicity) * 0.45, 0.5, 1.15);
  const detail = selected ? organelleFor(selected) : null;

  return (
    <SceneCanvas
      camera={{ position: [0, 3, 12], fov: 45 }}
      controls={{ minDistance: 1.1, maxDistance: 34 }}
      lights={{ ambient: 0.62, keyLight: 1.2 }}
      onPointerMissed={() => setSelected(null)}
    >
      <FitCamera view={isPlant ? PLANT_VIEW : ANIMAL_VIEW} direction={[0, 0.3, 1]} />
      <CutawayProvider enabled={Boolean(cutaway)}>
        <InteriorLights />

        {/* The wall is outside the protoplast, so it does not move when the
            membrane pulls away during plasmolysis — that gap is the point. */}
        {isPlant && (
          <CellWall
            size={PLANT_SIZE}
            selected={selected === "wall"}
            onSelect={setSelected}
            showLabel={false}
          />
        )}

        <group scale={membraneScale}>
          <Pickable id="membrane" onSelect={setSelected}>
            <mesh geometry={membraneGeometry}>
              <MembraneMaterial
                // A ruptured membrane is no longer holding anything in, so it
                // stops being the calm blue envelope and reads as damaged.
                color={selected === "membrane" ? PALETTE.gold : lysed ? PALETTE.rose : PALETTE.sky}
                // MembraneMaterial already lifts opacity when selected, so the
                // base drops here — otherwise picking the membrane draws a
                // gold film over every organelle you were trying to look at.
                opacity={selected === "membrane" ? 0.09 : lysed ? 0.2 : 0.13}
                selected={selected === "membrane"}
              />
            </mesh>
          </Pickable>

          <Cytoskeleton bounds={bounds} />
          <Cytoplasm bounds={bounds} tint={isPlant ? PALETTE.emerald : PALETTE.sky} speed={speed} />
          <FreeRibosomes
            bounds={[bounds[0] * 0.92, bounds[1] * 0.85, bounds[2] * 0.85]}
            selected={selected === "ribosome"}
            onSelect={setSelected}
            speed={speed}
          />

          <group position={layout.nucleus}>
            <Nucleus
              radius={isPlant ? 0.95 : 1.15}
              selected={selected === "nucleus"}
              onSelect={setSelected}
              showLabel={false}
            />
            <RoughER
              radius={isPlant ? 1.24 : 1.5}
              selected={selected === "er"}
              onSelect={setSelected}
              showLabel={false}
            />
          </group>

          <group position={layout.golgi}>
            <Golgi selected={selected === "golgi"} onSelect={setSelected} showLabel={false} speed={speed} />
          </group>

          <SmoothER
            position={layout.smoothEr}
            selected={selected === "smoothEr"}
            onSelect={setSelected}
            showLabel={false}
          />

          {isPlant && (
            <group position={[0.6, 0, 0]}>
              <Vacuole
                scale={vacuoleScale}
                selected={selected === "vacuole"}
                onSelect={setSelected}
                showLabel={false}
              />
            </group>
          )}

          {layout.mitochondria.map((position, i) => (
            <group key={i} position={position} rotation={[hashRandom(i) * 1.2, i * 0.9, hashRandom(i + 9) * 1.4 - 0.7]}>
              <Mitochondrion
                seed={i}
                selected={selected === "mitochondrion"}
                onSelect={setSelected}
                showLabel={false}
              />
            </group>
          ))}

          {isPlant &&
            layout.chloroplasts.map((position, i) => (
              <group key={i} position={position} rotation={[hashRandom(i + 20) * 0.9 - 0.45, i * 0.8, hashRandom(i + 40) * 0.7 - 0.35]}>
                <Chloroplast
                  seed={i}
                  selected={selected === "chloroplast"}
                  onSelect={setSelected}
                  showLabel={false}
                />
              </group>
            ))}

          {!isPlant &&
            layout.lysosomes &&
            layout.lysosomes.map((position, i) => (
              <group key={i} position={position}>
                <Lysosome seed={i} selected={selected === "lysosome"} onSelect={setSelected} />
              </group>
            ))}

          {!isPlant && (
            <group position={layout.centrioles} rotation={[0.5, 0.7, 0]}>
              <Centrioles
                selected={selected === "centriole"}
                onSelect={setSelected}
                showLabel={false}
              />
            </group>
          )}

          {/* Molecular-scale inset, only while the membrane is the subject. */}
          <BilayerPatch
            visible={selected === "membrane"}
            position={isPlant ? [0, 2.9, 0] : [0, ANIMAL_RADIUS + 0.75, 0]}
            normal={[0, 0, 1]}
            showLabel={showLabels}
          />

          {showLabels && <CellCallouts isPlant={isPlant} selected={selected} vacuoleScale={vacuoleScale} />}
        </group>

        {/* Cytoplasm escaping through the tear. Without this, "burst" was a
            word in the readout with nothing on screen behind it. */}
        {lysed && <LysisSpill radius={ANIMAL_RADIUS} speed={speed} />}

        <WaterFlow
          direction={-tonicity}
          active={water && Math.abs(tonicity) > 0.05}
          reach={isPlant ? 5.6 : 4.9}
          speed={speed}
        />
      </CutawayProvider>

    </SceneCanvas>
  );
}

// ═══ 4 · Protein folding & secondary structure ═══════════════════════

const MAX_RESIDUES = 64;
/**
 * α-helix geometry at real proportions: 1 nm is 4.13 world units, so the Cα
 * radius (0.23 nm) is 0.95 and the rise (0.15 nm per residue) is 0.62, which
 * puts consecutive Cα atoms the true 0.38 nm apart. The rise used to be 0.42,
 * which squashed the helix into a flat zig-zag.
 */
const HELIX_RADIUS = 0.95;
const HELIX_RISE = 0.62;
const HELIX_TURN = 100 * DEG;

/**
 * Which residues are hydrophobic, patterned to match the structure.
 *
 * A random assignment scattered them evenly and the legend's claim that they
 * "pack into the core" was then visible nowhere. Real secondary structure is
 * periodic, so the pattern is too: an α-helix is amphipathic, with the
 * hydrophobic residues falling on one face because 100° per residue brings
 * them back round every 3–4; a β-strand alternates faces residue by residue.
 */
function residueIsHydrophobic(i, structure) {
  if (structure === "helix") return Math.cos(i * HELIX_TURN - 0.6) > 0.12;
  if (structure === "sheet") return i % 2 === 0;
  return hashRandom(i * 2.7 + 11) > 0.55;
}

/**
 * The unfolded state: a random walk with some persistence, one Cα–Cα bond
 * (1.57) per step, stable across renders. The old walk marched steadily along
 * +x, so a long chain ran off the side of the view instead of balling up the
 * way a real random coil does.
 */
function coilPositions(count) {
  const pts = [];
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3(1, 0, 0);
  const kick = new THREE.Vector3();
  for (let i = 0; i < count; i += 1) {
    pts.push([pos.x, pos.y, pos.z]);
    // A random unit kick each step; the wide seed stride keeps the sin hash
    // decorrelated between neighbours.
    const t = hashRandom(i * 91.7 + 13.3) * Math.PI * 2;
    const u = hashRandom(i * 57.3 + 71.9) * 2 - 1;
    const r = Math.sqrt(1 - u * u);
    kick.set(Math.cos(t) * r, u, Math.sin(t) * r);
    dir.multiplyScalar(0.55).add(kick).normalize();
    pos.addScaledVector(dir, 1.57);
  }
  // Centred, so folding pulls the chain in rather than sliding it sideways.
  const centre = pts.reduce((c, p) => [c[0] + p[0] / count, c[1] + p[1] / count, c[2] + p[2] / count], [0, 0, 0]);
  return pts.map(([a, b, c]) => [a - centre[0], b - centre[1], c - centre[2]]);
}

/**
 * The α-helix is RIGHT-handed: rising along +y it turns anticlockwise seen
 * from above, so z = −sin (as in the DNA helix). It used to be +sin, a
 * left-handed helix, which proteins essentially never form.
 */
function helixPositions(count) {
  const height = (count - 1) * HELIX_RISE;
  return Array.from({ length: count }, (_, i) => [
    Math.cos(i * HELIX_TURN) * HELIX_RADIUS,
    i * HELIX_RISE - height / 2,
    -Math.sin(i * HELIX_TURN) * HELIX_RADIUS,
  ]);
}

/**
 * Antiparallel β-sheet: strands laid side by side running in opposite
 * directions, with the backbone pleated so the classic zig-zag is visible
 * end-on. Real proportions: 0.33 nm per residue along a strand, 0.48 nm
 * between strands, which is 1.4 and 2.0 here.
 */
const SHEET_STRANDS = 3;
const SHEET_STEP = 1.4;
const SHEET_GAP = 2.0;
const SHEET_PLEAT = 0.3;

/** Where residue i sits in the sheet: which strand, and how far along it. */
function sheetIndex(i, perStrand) {
  const strand = Math.floor(i / perStrand);
  const withinRaw = i % perStrand;
  // Every other strand runs backwards — that is what "antiparallel" means.
  return { strand, within: strand % 2 === 0 ? withinRaw : perStrand - 1 - withinRaw };
}

function sheetPositions(count) {
  const perStrand = Math.ceil(count / SHEET_STRANDS);
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    const { strand, within } = sheetIndex(i, perStrand);
    pts.push([
      (within - (perStrand - 1) / 2) * SHEET_STEP,
      within % 2 === 0 ? SHEET_PLEAT : -SHEET_PLEAT,
      strand * SHEET_GAP - ((SHEET_STRANDS - 1) * SHEET_GAP) / 2,
    ]);
  }
  return pts;
}

/**
 * Which way each side chain points. On a helix they stick straight out from
 * the axis; on a sheet they alternate above and below it, following the
 * pleat — which is why one face of a sheet can be all hydrophobic.
 */
function sideChainDirection(i, structure, target) {
  if (structure === "helix") return [Math.cos(i * HELIX_TURN), 0, -Math.sin(i * HELIX_TURN)];
  if (structure === "sheet") return [0, Math.sign(target[i][1]) || 1, 0];
  return null;
}

function coilDirection(i) {
  const t = hashRandom(i * 4.3 + 2) * Math.PI * 2;
  const u = hashRandom(i * 6.1 + 9) * 2 - 1;
  const r = Math.sqrt(1 - u * u);
  return [Math.cos(t) * r, u, Math.sin(t) * r];
}

const STRUCTURES = {
  helix: { ...STRUCTURE_META.helix, build: helixPositions, colour: STRUCTURE_COLOURS.helix, bondStep: 4 },
  sheet: { ...STRUCTURE_META.sheet, build: sheetPositions, colour: STRUCTURE_COLOURS.sheet, bondStep: 0 },
  coil: { ...STRUCTURE_META.coil, build: coilPositions, colour: STRUCTURE_COLOURS.coil, bondStep: 0 },
};

const SIDE_CHAIN = 0.62;
const PROTEIN_VIEW = { cx: 0, cy: 0, width: 12.4, height: 7.6, depth: 4 };
/**
 * The largest the chain may be drawn along its long axis and across it, so
 * every length and shape fits the view. The helix is laid on its side (N to C,
 * left to right): standing up, a 30-residue helix is 18 units tall and a
 * landscape canvas could only show it tiny.
 */
const PROTEIN_FIT = { long: 11, across: 5.6 };

function BackboneTube({ points, colour }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
    return new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), 0.11, 10, false);
  }, [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={colour} roughness={0.45} metalness={0.05} emissive={colour} emissiveIntensity={0.1} />
    </mesh>
  );
}

export function ProteinFoldingScene({ params = {} }) {
  const {
    structure = "helix",
    residues = 30,
    fold = 1,
    temperature = 300,
    showBonds = true,
    colourByType = true,
    spin = true,
    speed = 1.0,
    showLabels = true,
  } = params || {};
  const Label = showLabels ? SceneLabel : NoLabel;

  const info = STRUCTURES[structure] ?? STRUCTURES.helix;
  // One solve, shared with the Details panel. `folded` is the fold slider
  // scaled by what the heat has left of it — the number actually drawn.
  const f = solveFolding({ structure, residues, fold, temperature });
  const { residues: count, folded, denatured } = f;

  const coil = useMemo(() => coilPositions(count), [count]);
  const target = useMemo(() => info.build(count), [info, count]);

  // Each conformation's own fit, blended by how folded the chain is. An
  // unfolded chain is as long as the helix it becomes but sprawls in every
  // direction, so one fixed scale for both drew the folded helix tiny.
  const longAxis = structure === "helix" ? 1 : 0;
  const fitOf = (set, long) => {
    let scale = 1;
    for (let axis = 0; axis < 3; axis += 1) {
      const values = set.map((p) => p[axis]);
      const extent = Math.max(...values) - Math.min(...values) + 1.2;
      scale = Math.min(scale, (axis === long ? PROTEIN_FIT.long : PROTEIN_FIT.across) / extent);
    }
    return scale;
  };
  const coilFit = useMemo(() => fitOf(coil, -1), [coil]);
  const targetFit = useMemo(() => fitOf(target, longAxis), [target, longAxis]);

  // Folding is a straight interpolation between the two conformations, which
  // is what lets the slider be scrubbed both ways.
  const positions = useMemo(
    () =>
      target.map((t, i) => [
        lerp(coil[i][0], t[0], folded),
        lerp(coil[i][1], t[1], folded),
        lerp(coil[i][2], t[2], folded),
      ]),
    [coil, target, folded],
  );

  const sideChains = useMemo(
    () =>
      positions.map((p, i) => {
        const from = coilDirection(i);
        const to = sideChainDirection(i, structure, target) ?? from;
        const d = new THREE.Vector3(lerp(from[0], to[0], folded), lerp(from[1], to[1], folded), lerp(from[2], to[2], folded));
        if (d.lengthSq() < 1e-6) d.set(0, 1, 0);
        d.normalize().multiplyScalar(SIDE_CHAIN);
        return [p[0] + d.x, p[1] + d.y, p[2] + d.z];
      }),
    [positions, structure, target, folded],
  );

  // The i → i+4 hydrogen bond is what defines an α-helix; they only appear
  // once the chain is folded enough for the partners to be in reach.
  const hydrogenBonds = useMemo(() => {
    if (!showBonds || info.bondStep === 0 || folded < BONDS_FORM_ABOVE) return [];
    const bonds = [];
    for (let i = 0; i + info.bondStep < count; i += 1) {
      bonds.push([positions[i], positions[i + info.bondStep]]);
    }
    return bonds;
  }, [showBonds, info.bondStep, folded, count, positions]);

  // β-sheets are held by bonds between neighbouring strands, not along one.
  //
  // Pairing residue i with i+perStrand looked right but was not: because
  // alternate strands run backwards, i+perStrand sits at the *opposite end*
  // of the next strand, so every bond was drawn as a long diagonal across the
  // sheet. Partners have to be matched on how far along the strand they sit.
  const sheetBonds = useMemo(() => {
    if (!showBonds || structure !== "sheet" || folded < BONDS_FORM_ABOVE) return [];
    const perStrand = Math.ceil(count / SHEET_STRANDS);
    const byPlace = new Map();
    for (let i = 0; i < count; i += 1) {
      const { strand, within } = sheetIndex(i, perStrand);
      byPlace.set(`${strand}:${within}`, i);
    }
    const bonds = [];
    for (let strand = 0; strand + 1 < SHEET_STRANDS; strand += 1) {
      for (let within = strand % 2; within < perStrand; within += 2) {
        const a = byPlace.get(`${strand}:${within}`);
        const b = byPlace.get(`${strand + 1}:${within}`);
        if (a !== undefined && b !== undefined) bonds.push([positions[a], positions[b]]);
      }
    }
    return bonds;
  }, [showBonds, structure, folded, count, positions]);

  const ends = [positions[0], positions[count - 1]];
  const fit = lerp(coilFit, targetFit, folded);

  return (
    <SceneCanvas camera={{ position: [0, 1.5, 13], fov: 45 }} controls={{ autoRotate: spin, autoRotateSpeed: 0.45 * speed }} lights={{ ambient: 0.72, keyLight: 1.35 }}>
      <FitCamera view={PROTEIN_VIEW} direction={[0, 0.25, 1]} />
      <group scale={fit} rotation={[0, 0, longAxis === 1 ? -Math.PI / 2 : 0]}>
        <BackboneTube points={positions} colour={denatured ? STRUCTURE_COLOURS.denatured : STRUCTURE_COLOURS.backbone} />

        {positions.map((p, i) => {
          const hydrophobic = residueIsHydrophobic(i, structure);
          const colour = denatured
            ? STRUCTURE_COLOURS.denatured
            : colourByType
              ? hydrophobic
                ? STRUCTURE_COLOURS.hydrophobic
                : STRUCTURE_COLOURS.hydrophilic
              : info.colour;
          return (
            <group key={i}>
              {/* Cα on the backbone, the side chain (R group) off it. */}
              <mesh position={p}>
                <sphereGeometry args={[0.17, 16, 12]} />
                <meshStandardMaterial color={STRUCTURE_COLOURS.backbone} roughness={0.4} />
              </mesh>
              <Bond from={p} to={sideChains[i]} radius={0.05} color={STRUCTURE_COLOURS.backbone} />
              <mesh position={sideChains[i]}>
                <sphereGeometry args={[0.24, 18, 14]} />
                <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.18} roughness={0.35} metalness={0.05} />
              </mesh>
            </group>
          );
        })}

        {[...hydrogenBonds, ...sheetBonds].map(([a, b], i) => (
          <Line
            key={i}
            points={[a, b]}
            color={STRUCTURE_COLOURS.bond}
            lineWidth={1.6}
            dashed
            dashSize={0.14}
            gapSize={0.1}
            transparent
            opacity={0.85}
          />
        ))}

        {/* A protein is read from its amino end to its carboxyl end. */}
        <Label position={[ends[0][0], ends[0][1] - 1.1, ends[0][2]]} tone="text-ink-300">N-terminus</Label>
        <Label position={[ends[1][0], ends[1][1] + 1.1, ends[1][2]]} tone="text-ink-300">C-terminus</Label>
      </group>

      <Label position={[0, -PROTEIN_VIEW.height / 2 + 0.1, 0]} accent>
        {denatured
          ? "denatured — structure lost"
          : structure === "coil"
            ? "random coil — no regular structure to fold into"
            : `${info.label} · ${Math.round(folded * 100)}% folded`}
      </Label>
    </SceneCanvas>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────

const SCENES = {
  enzyme: EnzymeScene,
  dna: DNAScene,
  cell: CellExplorerScene,
  protein: ProteinFoldingScene,
  respiratory: RespiratoryCanvas,
  eye: EyeCanvas,
  reflex_arc: ReflexArcCanvas,
  antagonistic_muscles: AntagonisticMusclesCanvas,
  transpiration: TranspirationCanvas,
  peristalsis: PeristalsisCanvas,
  carbon_cycle: CarbonCycleCanvas,
  food_chain_pyramid: FoodChainPyramidCanvas,
  flower_pollination: FlowerPollinationCanvas,
  bacteria_vs_virus: BacteriaVsVirusCanvas,
  mitosis_meiosis: MitosisMeiosisCanvas,
  cardiac_cycle: CardiacCycleCanvas,
};

export default function BiologyCanvas({ topicId, params, setParam, onOpenQuiz }) {
  const Scene = SCENES[topicId];
  if (!Scene) return null;
  return <Scene params={params} setParam={setParam} onOpenQuiz={onOpenQuiz} />;
}
