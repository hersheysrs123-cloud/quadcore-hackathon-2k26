"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  AtomSphere,
  Bond,
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  VectorArrow,
  circlePoints,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";
import { ATOM_COLOURS, ELEMENTS, SHELL_CAPACITY, SHELL_NAMES } from "@/lib/atomicStructure";
import { FRACTIONS, furnaceTemperature, rises } from "@/lib/distillation";
import { BOND_COLOUR, latticeFactsFor } from "@/lib/lattices";
import { diamondFragment, iceFragment, quartzFragment } from "@/lib/latticeGeometry";
import { CELL_COLOURS, electrodeFor, solveElectrolysis } from "@/lib/electrolysis";
import { ELEMENT_STYLE, VSEPR_BOND_COLOUR, solveVsepr } from "@/lib/vsepr";
import { crackProducts, describeMolecule, esterification, formulaFor, isCrackable, isValid, nameFor, sub } from "@/lib/organic";
import { solveEnergetics } from "@/lib/energetics";
import ReactivitySeriesCanvas from "@/components/visualizations/ReactivitySeriesCanvas";
import RustingGalvanicCanvas from "@/components/visualizations/RustingGalvanicCanvas";
import SeparationTechniquesCanvas from "@/components/visualizations/SeparationTechniquesCanvas";
import CombustionFireTriangleCanvas from "@/components/visualizations/CombustionFireTriangleCanvas";
import ParticleModelMatterCanvas from "@/components/visualizations/ParticleModelMatterCanvas";
import RadioactiveDecayCanvas from "@/components/visualizations/RadioactiveDecayCanvas";

// Chemistry is written in subscripts everywhere except, until now, here —
// "C3H8" on screen next to CₙH₂ₙ₊₂ in the same panel reads as a typo.
// ─── IGCSE Chemistry · five scenes ──────────────────────────────────
// Atomic structure, organic molecules, fractional distillation, giant
// lattices and electrolysis.
// ─────────────────────────────────────────────────────────────────────

// ═══ 6 · Bohr atom & electron shells ═════════════════════════════════

// SHELL_NAMES, SHELL_CAPACITY and ELEMENTS now live in lib/atomicStructure.js,
// so the Details panel reads the same table this scene draws from.

/** Reused when writing instanced-mesh matrices, so no per-frame allocation. */
const SCRATCH_OBJECT = new THREE.Object3D();

const shellRadius = (i) => 1.7 + i * 1.15;
const shellTilt = (i) => [i * 0.5 + 0.18, i * 0.95, i * 0.3];

function Nucleus({ protons, neutrons, spin, speed = 1.0 }) {
  const group = useRef(null);
  const total = protons + neutrons;

  const size = total === 1 ? 0.32 : 0.24;

  const nucleons = useMemo(() => {
    const golden = Math.PI * (3 - Math.sqrt(5));

    // Alternate the two colours, then let whichever is left fill the tail.
    let protonsLeft = protons;
    let neutronsLeft = neutrons;
    const kinds = Array.from({ length: total }, (_, i) => {
      const wantsProton = i % 2 === 0;
      if (wantsProton ? protonsLeft > 0 : neutronsLeft === 0) {
        protonsLeft -= 1;
        return true;
      }
      neutronsLeft -= 1;
      return false;
    });

    if (total === 1) return [{ position: [0, 0, 0], proton: kinds[0] }];

    // Seed on a golden-angle spiral through a ball, then pack it. The seed
    // alone left visible holes — neighbours in index are neighbours in y
    // only, so spacing ran from overlapping to half a sphere apart. Packing
    // squeezes everything towards the centre, then pushes overlapping pairs
    // apart; a few dozen rounds settles into a touching, gap-free cluster.
    // Deterministic, so the nucleus looks the same every time.
    const seedRadius = 0.3 * Math.cbrt(total);
    const pts = kinds.map((_, i) => {
      const y = 1 - (i / (total - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const r = seedRadius * Math.cbrt((i + 0.5) / total);
      return [Math.cos(theta) * ring * r, y * r, Math.sin(theta) * ring * r];
    });
    const contact = size * 2 * 0.94; // a hair of overlap reads as "packed"
    for (let round = 0; round < 80; round += 1) {
      for (const p of pts) {
        p[0] *= 0.96;
        p[1] *= 0.96;
        p[2] *= 0.96;
      }
      for (let pass = 0; pass < 4; pass += 1) {
        for (let a = 0; a < total; a += 1) {
          for (let b = a + 1; b < total; b += 1) {
            const pa = pts[a];
            const pb = pts[b];
            const dx = pb[0] - pa[0];
            const dy = pb[1] - pa[1];
            const dz = pb[2] - pa[2];
            const d = Math.hypot(dx, dy, dz) || 1e-6;
            if (d >= contact) continue;
            const push = (contact - d) / (2 * d);
            pa[0] -= dx * push;
            pa[1] -= dy * push;
            pa[2] -= dz * push;
            pb[0] += dx * push;
            pb[1] += dy * push;
            pb[2] += dz * push;
          }
        }
      }
    }
    return kinds.map((proton, i) => ({ position: pts[i], proton }));
  }, [protons, neutrons, total, size]);

  const extent = useMemo(
    () => nucleons.reduce((m, n) => Math.max(m, Math.hypot(...n.position)), 0) + size,
    [nucleons, size],
  );

  useFrame((_, delta) => {
    if (spin && group.current) {
      group.current.rotation.y += delta * 0.28 * speed;
      group.current.rotation.x += delta * 0.11 * speed;
    }
  });

  return (
    <group ref={group}>
      {nucleons.map((n, i) => (
        <AtomSphere
          key={i}
          position={n.position}
          radius={size}
          color={n.proton ? ATOM_COLOURS.proton : ATOM_COLOURS.neutron}
          emissiveIntensity={n.proton ? 0.5 : 0.25}
        />
      ))}
      <Halo radius={extent + 0.35} color={ATOM_COLOURS.proton} />
    </group>
  );
}

function Shell({
  index,
  electrons,
  speed,
  isValence,
  highlightValence,
  showRing,
  showLabel,
  dimmed,
  onSelect,
}) {
  const angle = useRef(index * 0.7);
  const meshes = useRef([]);
  const radius = shellRadius(index);
  const ring = useMemo(() => circlePoints(radius), [radius]);

  const rate = 0.9 / Math.pow(index + 1, 1.25); // inner shells sweep faster
  const glow = isValence && highlightValence;
  const colour = glow ? ATOM_COLOURS.valence : ATOM_COLOURS.electron;

  useFrame((_, delta) => {
    angle.current += delta * speed * rate;
    for (let i = 0; i < electrons; i += 1) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const a = angle.current + (i * Math.PI * 2) / electrons;
      mesh.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      mesh.scale.setScalar(glow ? 1 + Math.sin(angle.current * 4 + i) * 0.12 : 1);
    }
  });

  return (
    <group rotation={shellTilt(index)}>
      {showRing && (
        <Line
          points={ring}
          color={glow ? ATOM_COLOURS.valence : ATOM_COLOURS.electron}
          lineWidth={glow ? 2.8 : 2.2}
          transparent
          opacity={dimmed ? 0.2 : glow ? 0.95 : 0.85}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(index);
          }}
        />
      )}

      {Array.from({ length: electrons }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(index);
          }}
        >
          <sphereGeometry args={[0.15, 20, 20]} />
          <meshStandardMaterial
            color={colour}
            emissive={colour}
            emissiveIntensity={glow ? 2.4 : 1.2}
            transparent
            opacity={dimmed ? 0.16 : 1}
            toneMapped={false}
          />
        </mesh>
      ))}

      {showLabel && (
        <SceneLabel position={[radius + 0.28, 0.34, 0]} accent={glow}>
          {SHELL_NAMES[index]} · {electrons}e⁻{isValence ? " · valence" : ""}
        </SceneLabel>
      )}
    </group>
  );
}

/**
 * Backs the camera off (or in) along its current view line whenever the
 * outermost shell changes, so a four-shell atom (K, Ca) is not cropped and
 * the summary label under it stays clear of the viewport hint. Only runs on
 * a change of shell count, so a user's own zoom survives picking another
 * element of the same period.
 */
function BohrCameraFit({ outerRadius }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    // 12 frames the three-shell atoms (outer radius 4.0) with room for labels.
    // Each extra unit of radius needs ~4 of distance: the summary label hangs
    // below the ring and the camera looks down on it, so it runs out first.
    const distance = Math.max(12, 12 + (outerRadius - 4) * 4);
    camera.position.setLength(distance);
    camera.updateProjectionMatrix();
  }, [camera, outerRadius]);
  return null;
}

export function BohrAtomScene({ params = {} }) {
  const { element: symbol = "C", speed = 1.0, showShells = true, showLabels = true, highlightValence = false, spinNucleus = true } =
    params || {};
  const [focused, setFocused] = useState(null);

  const element = ELEMENTS[symbol] ?? ELEMENTS.Na;
  const outer = element.shells.length - 1;
  const valence = element.shells[outer];

  useEffect(() => setFocused(null), [symbol]);

  return (
    <SceneCanvas
      camera={{ position: [0, 3.2, 12], fov: 45 }}
      controls={{ autoRotate: params.spin !== false, autoRotateSpeed: 0.45 * speed, minDistance: 3.5 }}
      onPointerMissed={() => setFocused(null)}
    >
      <BohrCameraFit outerRadius={shellRadius(outer)} />
      <pointLight position={[0, 0, 0]} color={PALETTE.rose} intensity={12} distance={4} />
      <Nucleus protons={element.protons} neutrons={element.neutrons} spin={spinNucleus} speed={speed} />

      {element.shells.map((count, i) => (
        <Shell
          key={`${symbol}-${i}`}
          index={i}
          electrons={count}
          speed={speed}
          isValence={i === outer}
          highlightValence={highlightValence}
          showRing={showShells}
          showLabel={showLabels}
          dimmed={focused !== null && focused !== i}
          onSelect={(idx) => setFocused((cur) => (cur === idx ? null : idx))}
        />
      ))}

      <SceneLabel position={[0, -(shellRadius(outer) + 0.9), 0]} accent>
        {element.symbol} · {element.shells.join(",")}
      </SceneLabel>

    </SceneCanvas>
  );
}

// ═══ 7 · Organic chemistry & isomer builder ══════════════════════════

const ATOM_STYLE = {
  // Carbon is conventionally dark grey, but slate-600 all but vanished into
  // the navy canvas; this is the lightest grey that still reads as carbon
  // beside the bone-white hydrogens.
  C: { radius: 0.34, color: "#7b8799" },
  H: { radius: 0.2, color: PALETTE.bone },
  O: { radius: 0.32, color: PALETTE.rose },
};

// CHAIN_NAMES and the per-series name tables now live in lib/organic.js.

// ─── Geometry constants ──────────────────────────────────────────────
// Real geometry, not a plausible-looking zig-zag.
//
// A saturated carbon is tetrahedral: 109.47° between any two of its bonds.
// For a chain zig-zagging in a plane with bond length L, that fixes the
// step and rise — solving cos θ = (b² − a²)/(b² + a²) with a² + b² = L² at
// θ = 109.47° gives a = 0.8167 L along the chain and b = 0.5772 L across it.
// The old values gave 121.5°, which is visibly too open.
const CC_BOND   = 1.54; // C–C bond
const CC_DOUBLE = 1.34; // C=C bond
const CC_TRIPLE = 1.20; // C≡C bond (linear, sp)
const CO_BOND   = 1.43; // C–O single
const CD_BOND   = 1.22; // C=O double (carbonyl)
const CH_BOND   = 1.09;
const CHAIN_X   = 0.8167;
const CHAIN_Y   = 0.5772;

// tan(54.74°) and tan(70.53°): how far off the "away" axis the remaining
// hydrogens sit for two and three of them on a tetrahedral carbon.
const SPREAD_TETRA_2 = Math.SQRT2;
const SPREAD_TETRA_3 = 2 * Math.SQRT2;
// tan(60°): a carbon carrying a double bond is trigonal planar, 120° apart.
const SPREAD_TRIGONAL = Math.sqrt(3);

/**
 * Builds a chain molecule from its family and length. Carbons zig-zag in the
 * XY plane at true tetrahedral angles; each carbon's remaining bonds are then
 * placed at the directions VSEPR actually predicts.
 */
function buildMolecule(family, carbons) {
  const n = clamp(carbons, 1, 12);
  // The ester is built FROM its reactants, so the esterification animation's
  // last frame and the static ester are the same molecule — see buildEsterification.
  if (family === "ester") return buildEsterification(n).product;

  const atoms = [];
  const bonds = [];
  const chain = [];

  const isAlkyne       = family === "alkyne"        && n >= 2;
  const isAlkeneChain  = family === "alkene"        && n >= 2;
  const isAcid         = family === "acid";

  /** Length of the bond arriving at carbon `i`. */
  const bondLengthAt = (i) => {
    if (isAlkeneChain && i === 1) return CC_DOUBLE;
    if (isAlkyne && i === 1) return CC_TRIPLE;
    return CC_BOND;
  };

  /**
   * Interior bond angle at carbon `i`, degrees — set by its hybridisation.
   *
   * sp (on a triple bond) is linear, sp² (on a double bond) is trigonal
   * planar, and everything else is tetrahedral. Walking the chain by turning
   * through 180° − this at each carbon is what makes the drawn angle the angle
   * VSEPR predicts, rather than a single zig-zag applied to every family.
   */
  const angleAt = (i) => {
    if (isAlkyne && i <= 1) return 180;
    if (isAlkeneChain && i <= 1) return 120;
    return 109.47;
  };
  const turnAt = (i) => ((180 - angleAt(i)) * Math.PI) / 180;

  // The chain is walked bond by bond: each bond takes ITS OWN length, and each
  // turn takes the angle its carbon's hybridisation dictates.
  //
  // Scaling only the x-step by the bond length while holding the rise at the
  // C–C value does not shorten a bond, it tilts it: a C=C asked to be 1.34 Å
  // came out at 1.41, on the one topic where that bond is the entire point.
  // The alkyne had the mirror-image problem — with C0..C2 pinned to y = 0 for
  // the sp region, resuming the zig-zag gave the C2–C3 bond one rise of travel
  // instead of two, drawing it at 1.33 Å and bending C2 to 144.7°.
  let heading = turnAt(1) / 2; // start half a turn up, so the chain straddles x
  let up = false;
  let x = 0;
  let y = 0;
  chain.push(new THREE.Vector3(0, 0, 0));
  for (let i = 1; i < n; i += 1) {
    if (i > 1) {
      heading += (up ? 1 : -1) * turnAt(i - 1);
      up = !up;
    }
    const L = bondLengthAt(i);
    x += Math.cos(heading) * L;
    y += Math.sin(heading) * L;
    chain.push(new THREE.Vector3(x, y, 0));
  }

  // Centre the finished chain on both axes — with per-bond rises the walk no
  // longer ends where it started vertically.
  const xs = chain.map((p) => p.x);
  const ys = chain.map((p) => p.y);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  chain.forEach((p, i) => {
    p.x -= midX;
    p.y -= midY;
    atoms.push({ el: "C", position: p.toArray(), index: i, role: i === 0 ? "c1" : undefined });
  });

  const isAlkene = family === "alkene" && n >= 2;
  const isAlcohol = family === "alcohol";

  for (let i = 0; i < n - 1; i += 1) {
    bonds.push({
      from: chain[i].toArray(),
      to: chain[i + 1].toArray(),
      double: isAlkene && i === 0,
      triple: isAlkyne && i === 0,
    });
  }

  // ─── Functional group geometry ────────────────────────────────────

  // Oxygen of the –OH group hangs off carbon 1 (for alcohol).
  let oxygen = null;
  if (isAlcohol) {
    const dir = new THREE.Vector3(-0.62, chain[0].y > 0 ? 0.78 : -0.78, 0).normalize();
    oxygen = chain[0].clone().addScaledVector(dir, 1.35);
    atoms.push({ el: "O", position: oxygen.toArray(), role: "alcO" });
    bonds.push({ from: chain[0].toArray(), to: oxygen.toArray() });

    const hDir = new THREE.Vector3(-0.9, 0, 0.42).normalize();
    const hPos = oxygen.clone().addScaledVector(hDir, 0.98);
    atoms.push({ el: "H", position: hPos.toArray(), role: "alcH" });
    bonds.push({ from: oxygen.toArray(), to: hPos.toArray(), role: "alcOH" });
  }

  // –COOH group: terminal carbon already in chain; add =O (carbonyl) and –OH.
  let acidCarbonyl = null;
  if (isAcid) {
    const end = chain[0]; // attach to first carbon
    // Carbonyl oxygen — double bond, in-plane, pointing left-up
    const coDir = new THREE.Vector3(-0.62, end.y > 0 ? 0.95 : -0.95, 0).normalize();
    acidCarbonyl = end.clone().addScaledVector(coDir, CD_BOND);
    atoms.push({ el: "O", position: acidCarbonyl.toArray() });
    bonds.push({ from: end.toArray(), to: acidCarbonyl.toArray(), double: true });

    // Hydroxyl oxygen — single bond, opposite side
    const ohDir = new THREE.Vector3(-0.62, end.y > 0 ? -0.95 : 0.95, 0).normalize();
    const ohOxy = end.clone().addScaledVector(ohDir, CO_BOND);
    atoms.push({ el: "O", position: ohOxy.toArray(), role: "acidO" });
    bonds.push({ from: end.toArray(), to: ohOxy.toArray(), role: "acidCO" });

    const hDir = new THREE.Vector3(-0.9, 0, 0.42).normalize();
    const hPos = ohOxy.clone().addScaledVector(hDir, 0.96);
    atoms.push({ el: "H", position: hPos.toArray(), role: "acidH" });
    bonds.push({ from: ohOxy.toArray(), to: hPos.toArray(), role: "acidOH" });

    // Methanoic acid (n=1) has a formyl C-H bond attached to C1
    if (n === 1) {
      const formylHPos = end.clone().addScaledVector(new THREE.Vector3(1, 0, 0), CH_BOND);
      atoms.push({ el: "H", position: formylHPos.toArray() });
      bonds.push({ from: end.toArray(), to: formylHPos.toArray() });
    }
  }

  // Hydrogens fill whatever bonding capacity each carbon has left.
  for (let i = 0; i < n; i += 1) {
    const centre = chain[i];
    const neighbours = [];
    if (i > 0) neighbours.push(chain[i - 1]);
    if (i < n - 1) neighbours.push(chain[i + 1]);
    if (isAlcohol && i === 0 && oxygen) neighbours.push(oxygen);
    if (isAcid    && i === 0) continue; // –COOH carbon handled in group above

    // A double bond uses two of the carbon's four bonds.
    const doubleHere = isAlkene && (i === 0 || i === 1);
    // A triple bond uses three bonds — only one H possible on each sp carbon.
    const tripleHere = isAlkyne && (i === 0 || i === 1);
    const used = neighbours.length + (doubleHere ? 1 : 0) + (tripleHere ? 2 : 0);
    const hydrogens = Math.max(0, 4 - used);
    if (hydrogens === 0) continue;

    // Bisector of the directions pointing away from every existing neighbour.
    const away = new THREE.Vector3();
    neighbours.forEach((nb) => away.add(centre.clone().sub(nb).normalize()));
    if (away.lengthSq() < 1e-4) away.set(0, 1, 0);
    away.normalize();

    // Which plane the remaining bonds open into.
    let side;
    if (doubleHere || tripleHere) {
      side = new THREE.Vector3(0, 0, 1).cross(away);
    } else if (neighbours.length >= 2) {
      side = new THREE.Vector3()
        .subVectors(neighbours[0], centre)
        .cross(new THREE.Vector3().subVectors(neighbours[1], centre));
    } else {
      side = new THREE.Vector3(0, 0, 1).cross(away);
    }
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(away, side).normalize();

    const spread =
      hydrogens === 1
        ? 0
        : doubleHere
          ? SPREAD_TRIGONAL
          : hydrogens === 3
            ? SPREAD_TETRA_3
            : SPREAD_TETRA_2;

    for (let k = 0; k < hydrogens; k += 1) {
      const phi = hydrogens === 1 ? 0 : (k / hydrogens) * Math.PI * 2;
      const dir = away
        .clone()
        .addScaledVector(side, Math.cos(phi) * spread)
        .addScaledVector(up, Math.sin(phi) * spread)
        .normalize();
      const hPos = centre.clone().addScaledVector(dir, CH_BOND);
      atoms.push({ el: "H", position: hPos.toArray() });
      bonds.push({ from: centre.toArray(), to: hPos.toArray() });
    }
  }

  // Name and formula come from lib/organic.js, which the Details panel reads
  // too. They are closed-form rather than counted off `atoms`, and the module
  // asserts in its tests that the two agree — which is how the ester's missing
  // formyl hydrogen showed up.
  const valid = isValid(family, n);
  const formula = formulaFor(family, n);
  const name = nameFor(family, n);

  return { atoms, bonds, formula, name, valid };
}

/** Reflect a built molecule in x, so its right-hand end becomes its left. */
function mirrorX({ atoms, bonds, ...rest }) {
  const flip = (p) => [-p[0], p[1], p[2]];
  return {
    ...rest,
    atoms: atoms.map((a) => ({ ...a, position: flip(a.position) })),
    bonds: bonds.map((b) => ({ ...b, from: flip(b.from), to: flip(b.to) })),
  };
}

/** Radians between the angles of 2D vectors — for a rotation about z. */
const angleOf = (v) => Math.atan2(v[1], v[0]);

/** C–O–C at an ester oxygen is about 115°. */
const ESTER_COC = (115 * Math.PI) / 180;

/**
 * Esterification as geometry: the n-carbon acid and methanol, and the methyl
 * ester made from exactly their atoms.
 *
 * The acid is mirrored so its –COOH faces +x, towards the methanol. The
 * product keeps the acid's acyl part where it is and turns methanol about z
 * so its oxygen lands on the spot the acid's –OH oxygen left, with its methyl
 * swung out to a 115° C–O–C. The acid's –OH and methanol's hydroxyl H are the
 * three atoms that leave as water — the labelling experiments' answer, so
 * the ester's bridging oxygen really is the alcohol's.
 *
 * Everything is in the product's own frame, centred on its bounding box, so
 * the reaction's final frame is the static ester to the pixel.
 */
function buildEsterification(n) {
  const acid = mirrorX(buildMolecule("acid", n));
  const meth = buildMolecule("alcohol", 1);
  const find = (mol, role) => mol.atoms.find((a) => a.role === role).position;

  const c1 = find(acid, "c1");
  const acidO = find(acid, "acidO");
  const mO = find(meth, "alcO");
  const mC = find(meth, "c1");

  // Where the methyl carbon must point from the bridging oxygen: 115° off the
  // O→C(acyl) direction, on whichever side heads away from the acyl chain.
  const back = [c1[0] - acidO[0], c1[1] - acidO[1]];
  const candidates = [ESTER_COC, -ESTER_COC].map((t) => angleOf(back) + t);
  const want = candidates.reduce((best, t) => (Math.cos(t) > Math.cos(best) ? t : best));
  const turn = want - angleOf([mC[0] - mO[0], mC[1] - mO[1]]);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const place = (p) => {
    const x = p[0] - mO[0];
    const y = p[1] - mO[1];
    return [acidO[0] + x * cos - y * sin, acidO[1] + x * sin + y * cos, p[2] - mO[2] + acidO[2]];
  };
  const methPlaced = {
    atoms: meth.atoms.map((a) => ({ ...a, position: place(a.position) })),
    bonds: meth.bonds.map((b) => ({ ...b, from: place(b.from), to: place(b.to) })),
  };

  const leavingRoles = new Set(["acidO", "acidH", "alcH"]);
  const acyl = {
    atoms: acid.atoms.filter((a) => !leavingRoles.has(a.role)),
    bonds: acid.bonds.filter((b) => b.role !== "acidCO" && b.role !== "acidOH"),
  };
  const methoxy = {
    atoms: methPlaced.atoms.filter((a) => a.role !== "alcH"),
    bonds: methPlaced.bonds.filter((b) => b.role !== "alcOH"),
  };
  const bridgeO = find(methPlaced, "alcO");
  const productAtoms = [...acyl.atoms, ...methoxy.atoms];

  // Centre on the product's bounding box and shift every piece with it.
  const xs = productAtoms.map((a) => a.position[0]);
  const ys = productAtoms.map((a) => a.position[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const shift = (p) => [p[0] - cx, p[1] - cy, p[2]];
  const shiftMol = (mol) => ({
    atoms: mol.atoms.map((a) => ({ ...a, position: shift(a.position) })),
    bonds: mol.bonds.map((b) => ({ ...b, from: shift(b.from), to: shift(b.to) })),
  });

  const acylC = shiftMol(acyl);
  const methoxyC = shiftMol(methoxy);
  const c1C = shift(c1);
  const bridgeC = shift(bridgeO);
  const newBond = { from: c1C, to: bridgeC, role: "esterCO" };

  return {
    acyl: acylC,
    methoxy: methoxyC,
    /** The acyl carbon and the alcohol's oxygen: the new bond joins them. */
    c1: c1C,
    bridgeO: bridgeC,
    /** Where the three leaving atoms sat on their parents, in the product frame. */
    leaving: {
      acidO: shift(acidO),
      acidH: shift(find(acid, "acidH")),
      alcH: shift(find(methPlaced, "alcH")),
    },
    product: {
      atoms: [...acylC.atoms, ...methoxyC.atoms],
      bonds: [...acylC.bonds, ...methoxyC.bonds, newBond],
      formula: formulaFor("ester", n),
      name: nameFor("ester", n),
      valid: isValid("ester", n),
    },
  };
}

function DoubleBond({ from, to }) {
  const offsets = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const axis = b.clone().sub(a).normalize();
    const perp = new THREE.Vector3(0, 0, 1).cross(axis).normalize();
    if (!Number.isFinite(perp.x)) perp.set(0, 1, 0);
    return [perp.clone().multiplyScalar(0.14), perp.clone().multiplyScalar(-0.14)];
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);

  return offsets.map((o, i) => (
    <Bond
      key={i}
      from={[from[0] + o.x, from[1] + o.y, from[2] + o.z]}
      to={[to[0] + o.x, to[1] + o.y, to[2] + o.z]}
      radius={0.055}
      color={PALETTE.gold}
      emissive={PALETTE.gold}
    />
  ));
}

function TripleBond({ from, to }) {
  const offsets = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const axis = b.clone().sub(a).normalize();
    const perp = new THREE.Vector3(0, 0, 1).cross(axis).normalize();
    if (!Number.isFinite(perp.x)) perp.set(0, 1, 0);
    return [
      new THREE.Vector3(0, 0, 0),
      perp.clone().multiplyScalar(0.22),
      perp.clone().multiplyScalar(-0.22),
    ];
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);

  return offsets.map((o, i) => (
    <Bond
      key={i}
      from={[from[0] + o.x, from[1] + o.y, from[2] + o.z]}
      to={[to[0] + o.x, to[1] + o.y, to[2] + o.z]}
      radius={i === 0 ? 0.06 : 0.045}
      color={PALETTE.sky}
      emissive={PALETTE.sky}
    />
  ));
}

function AtomsAndBonds({ atoms, bonds }) {
  return (
    <>
      {bonds.map((b, i) =>
        b.triple ? (
          <TripleBond key={`b${i}`} from={b.from} to={b.to} />
        ) : b.double ? (
          <DoubleBond key={`b${i}`} from={b.from} to={b.to} />
        ) : (
          <Bond key={`b${i}`} from={b.from} to={b.to} radius={0.075} color="#3f4854" />
        ),
      )}
      {atoms.map((a, i) => {
        const style = ATOM_STYLE[a.el] ?? ATOM_STYLE.C;
        return (
          <AtomSphere
            key={`a${i}`}
            position={a.position}
            radius={style.radius}
            color={style.color}
            emissiveIntensity={a.el === "C" ? 0.25 : 0.4}
          />
        );
      })}
    </>
  );
}

// ─── Framing ─────────────────────────────────────────────────────────

/** Radius of the circle a molecule sweeps spinning about y, atoms included. */
function spinRadius(mol) {
  return mol.atoms.reduce(
    (m, a) => Math.max(m, Math.hypot(a.position[0], a.position[2]) + (ATOM_STYLE[a.el] ?? ATOM_STYLE.C).radius),
    0,
  );
}

/** Half the molecule's height, atoms included. */
function halfHeight(mol) {
  return mol.atoms.reduce(
    (m, a) => Math.max(m, Math.abs(a.position[1]) + (ATOM_STYLE[a.el] ?? ATOM_STYLE.C).radius),
    0,
  );
}

/** Half the molecule's width in x, atoms included — for the unspun reaction. */
function halfWidth(mol) {
  return mol.atoms.reduce(
    (m, a) => Math.max(m, Math.abs(a.position[0]) + (ATOM_STYLE[a.el] ?? ATOM_STYLE.C).radius),
    0,
  );
}

const TAN_HALF_FOV = Math.tan((45 / 2) * (Math.PI / 180));

/**
 * Eases the camera along its view line until a `width` × `height` box around
 * the origin fits the canvas. Runs only when the box changes — a new molecule,
 * a crack, a reaction — so a user's own zoom is left alone otherwise.
 *
 * `depth` is how far the content comes towards the camera. A spinning
 * molecule swings its ends through that depth, and the near end is drawn
 * larger, so fitting the flat width alone let long chains clip at the edge.
 */
function CameraDolly({ width, height, depth = 0 }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1));
  const goal = useRef(null);
  useEffect(() => {
    const fit = Math.max(height / 2 / TAN_HALF_FOV, width / 2 / (TAN_HALF_FOV * aspect));
    goal.current = Math.max(6.5, fit * 1.05 + depth);
  }, [width, height, depth, aspect]);
  useFrame((_, delta) => {
    if (goal.current === null) return;
    const next = lerp(camera.position.length(), goal.current, Math.min(1, delta * 3));
    camera.position.setLength(next);
    if (Math.abs(next - goal.current) < 0.01) goal.current = null;
  });
  return null;
}

// ─── Cracking ────────────────────────────────────────────────────────

/** Gap between the cracked products' swept circles, at full separation. */
const CRACK_GAP = 1.2;

/**
 * Where the two products sit for a separation `s` in [0, 1].
 *
 * Each product spins about its OWN centre, so it sweeps a circle of its spin
 * radius; spacing the centres by those radii plus a gap means the two can
 * never interpenetrate at any angle. The pair is centred on the origin.
 */
function crackLayout(rAlkane, rAlkene, s) {
  const gap = 0.25 + s * (CRACK_GAP - 0.25);
  const centre = rAlkane - rAlkene;
  return {
    alkaneX: -(rAlkane + gap / 2) + centre,
    alkeneX: rAlkene + gap / 2 + centre,
  };
}

/**
 * The molecule, and what happens to it when you crack it.
 *
 * Cracking used to be a lie told with a transform: the component partitioned
 * the ONE molecule geometrically and slid the two halves apart. Now the
 * products are built as real molecules — an alkane two carbons shorter and an
 * ethene, CₙH₂ₙ₊₂ → C₍ₙ₋₂₎H₂₍ₙ₋₂₎₊₂ + C₂H₄ — and `lib/organic.js` owns the
 * arithmetic and tests that it balances.
 *
 * The products also used to slide apart along the SPINNING group's x-axis and
 * by a fixed ±2.4, so at some angles they slid towards the camera instead and
 * sat inside each other, and a long alkane overlapped its ethene at any angle.
 * Now the products live outside the spinning parent, each spins about its own
 * centre, and their spacing comes from their swept radii (`crackLayout`).
 */
function Molecule({ family, carbons, crackToken, spin, speed = 1.0, hidden = false, cracked, onCrackedChange }) {
  const group = useRef(null);
  const intactRef = useRef(null);
  const productsRef = useRef(null);
  const alkaneRef = useRef(null);
  const alkeneRef = useRef(null);
  const alkaneSpin = useRef(null);
  const alkeneSpin = useRef(null);
  const split = useRef(0);
  const target = useRef(0);
  const wasCracked = useRef(false);

  const molecule = useMemo(() => buildMolecule(family, carbons), [family, carbons]);
  const crackable = isCrackable(family, carbons);

  const products = useMemo(() => {
    if (!crackable) return null;
    const spec = crackProducts(carbons);
    if (!spec) return null;
    const alkane = buildMolecule("alkane", spec.alkane.carbons);
    const alkene = buildMolecule("alkene", spec.alkene.carbons);
    return {
      spec,
      alkane,
      alkene,
      rAlkane: spinRadius(alkane),
      rAlkene: spinRadius(alkene),
      top: Math.max(halfHeight(alkane), halfHeight(alkene)) + 0.75,
    };
  }, [crackable, carbons]);

  useEffect(() => {
    if (!crackToken || !crackable) return undefined;
    target.current = 1;
    const id = setTimeout(() => {
      target.current = 0;
      // See the note on the DNA unzip timer: a zero speed must not collapse
      // the hold to an immediate re-join.
    }, Math.max(1600, 4200 / Math.max(speed, 0.05)));
    return () => clearTimeout(id);
  }, [crackToken, crackable, speed]);

  // A new family or chain length abandons any crack in progress, so the scene
  // never shows the products of a molecule that is no longer on screen.
  useEffect(() => {
    target.current = 0;
    split.current = 0;
  }, [family, carbons]);

  useFrame((_, delta) => {
    if (group.current) {
      // Held square while a reaction plays over it, so the reaction's last
      // frame hands back to this molecule without a jump.
      if (hidden) group.current.rotation.y = 0;
      else if (spin) group.current.rotation.y += delta * 0.35 * speed;
      group.current.visible = !hidden;
    }
    split.current = lerp(split.current, target.current, Math.min(1, delta * 2.0 * speed));
    const s = crackable ? split.current : 0;

    // Below the threshold the parent alkane is on screen; above it, the two
    // products are, drifting apart.
    const isCracked = s > 0.02;
    if (intactRef.current) intactRef.current.visible = !isCracked;
    if (productsRef.current) productsRef.current.visible = isCracked && !hidden;
    if (products) {
      const { alkaneX, alkeneX } = crackLayout(products.rAlkane, products.rAlkene, s);
      if (alkaneRef.current) alkaneRef.current.position.x = alkaneX;
      if (alkeneRef.current) alkeneRef.current.position.x = alkeneX;
      // Both products carry on the parent's spin, each about its own centre.
      const angle = group.current ? group.current.rotation.y : 0;
      if (alkaneSpin.current) alkaneSpin.current.rotation.y = angle;
      if (alkeneSpin.current) alkeneSpin.current.rotation.y = angle;
    }

    if (isCracked !== wasCracked.current) {
      wasCracked.current = isCracked;
      // Fires on the transition only — never per frame.
      if (typeof onCrackedChange === "function") onCrackedChange(isCracked);
    }
  });

  return (
    <>
      <group ref={group}>
        <group ref={intactRef}>
          <AtomsAndBonds atoms={molecule.atoms} bonds={molecule.bonds} />
        </group>
      </group>
      {products && (
        <group ref={productsRef} visible={false}>
          <group ref={alkaneRef}>
            <group ref={alkaneSpin}>
              <AtomsAndBonds atoms={products.alkane.atoms} bonds={products.alkane.bonds} />
            </group>
            {cracked && (
              <SceneLabel position={[0, products.top, 0]} tone="text-ink-300">
                {`${products.spec.alkane.formula} · ${products.spec.alkane.name}`}
              </SceneLabel>
            )}
          </group>
          <group ref={alkeneRef}>
            <group ref={alkeneSpin}>
              <AtomsAndBonds atoms={products.alkene.atoms} bonds={products.alkene.bonds} />
            </group>
            {cracked && (
              <>
                <SceneLabel position={[0, products.top + 0.42, 0]} tone="text-emerald-300">
                  {`${products.spec.alkene.formula} · ${products.spec.alkene.name}`}
                </SceneLabel>
                <SceneLabel position={[0, products.top, 0]} tone="text-emerald-300">
                  decolourises bromine water
                </SceneLabel>
              </>
            )}
          </group>
        </group>
      )}
    </>
  );
}

// ─── Esterification ──────────────────────────────────────────────────

/** Seconds for one run at 1× speed. */
const ESTER_SECONDS = 9;
/** Stage boundaries, as fractions of the run. */
const ESTER_T = { approach: 0.2, strain: 0.34, leave: 0.56, join: 0.8 };
/** How far each reactant starts from its place in the product, and pauses at. */
const ESTER_START_GAP = 3.0;
const ESTER_HOLD_GAP = 1.35;

/** What is happening, in the order it happens — the scene's caption. */
const ESTER_STAGES = [
  "An acid and an alcohol, warmed with a few drops of conc. H₂SO₄ as catalyst",
  "The acid's C–OH bond and the alcohol's O–H bond are the ones that break",
  "…and the –OH and H leave together as water: a condensation reaction",
  "The alcohol's oxygen bonds to the acid's carbon — the –COO– ester link",
  "Ester formed. It is reversible (⇌): water can hydrolyse it back",
];

const smooth = (t) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const span = (p, a, b) => smooth((p - a) / (b - a));

/** Water's own geometry: O–H 0.96 Å at 104.5°, opening upwards. */
const WATER_HALF_ANGLE = (104.5 / 2) * (Math.PI / 180);
const WATER_H = [
  [-0.96 * Math.sin(WATER_HALF_ANGLE), 0.96 * Math.cos(WATER_HALF_ANGLE), 0],
  [0.96 * Math.sin(WATER_HALF_ANGLE), 0.96 * Math.cos(WATER_HALF_ANGLE), 0],
];

const BOND_GREY = "#3f4854";
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Stretches a unit, y-aligned cylinder between two points. */
function placeBond(mesh, a, b, scratch) {
  if (!mesh) return;
  scratch.subVectors(b, a);
  const length = scratch.length();
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.set(1, Math.max(length, 1e-4), 1);
  if (length > 1e-6) mesh.quaternion.setFromUnitVectors(Y_AXIS, scratch.normalize());
}

/**
 * Carboxylic acid + methanol → methyl ester + water, played through once per
 * press of the button.
 *
 * Every atom on screen is one of the reactants' atoms, and every change is a
 * bond breaking or forming: the acid (its –COOH facing right) and methanol
 * close in; the acid's C–OH and methanol's O–H bonds glow; the –OH and the H
 * leave and meet as a bent water molecule; then the acyl part and the
 * methoxy part close the gap and the new C–O bond appears. The frame it ends
 * on is the static ester (`buildEsterification` builds both), so handing back
 * to the spinning molecule shows no jump.
 *
 * Only the stage index is React state; positions are written per frame.
 */
function Esterification({ carbons, token, speed = 1, info, onStage }) {
  const asm = useMemo(() => buildEsterification(carbons), [carbons]);
  const progress = useRef(-1);
  const seenToken = useRef(token);
  const [stage, setStage] = useState(-1);
  const stageRef = useRef(-1);

  const acylRef = useRef(null);
  const methRef = useRef(null);
  const leaveO = useRef(null);
  const leaveH1 = useRef(null);
  const leaveH2 = useRef(null);
  const bonds = useRef({});

  const geo = useMemo(() => {
    const v = (p) => new THREE.Vector3(...p);
    const top = (mol) => mol.atoms.reduce((m, a) => Math.max(m, a.position[1]), -Infinity);
    const bottom = asm.product.atoms.reduce((m, a) => Math.min(m, a.position[1]), Infinity);
    const xMid = (mol) => {
      const xs = mol.atoms.map((a) => a.position[0]);
      return (Math.min(...xs) + Math.max(...xs)) / 2;
    };
    const water = v([asm.bridgeO[0], bottom - 1.5, 0.6]);
    return {
      c1: v(asm.c1),
      bridgeO: v(asm.bridgeO),
      acidO: v(asm.leaving.acidO),
      acidH: v(asm.leaving.acidH),
      alcH: v(asm.leaving.alcH),
      water,
      waterH1: water.clone().add(v(WATER_H[0])),
      waterH2: water.clone().add(v(WATER_H[1])),
      acylLabel: [xMid(asm.acyl), top(asm.acyl) + 0.8, 0],
      methLabel: [xMid(asm.methoxy), top(asm.methoxy) + 0.8, 0],
      // Beside the water, not under it: under it sat on the scene's caption.
      waterLabel: [water.x + 1.55, water.y + 0.35, water.z],
      productLabel: [0, Math.max(top(asm.acyl), top(asm.methoxy)) + 0.8, 0],
    };
  }, [asm]);

  const scratch = useMemo(
    () => ({
      dir: new THREE.Vector3(),
      c1: new THREE.Vector3(),
      bridge: new THREE.Vector3(),
      o: new THREE.Vector3(),
      h1: new THREE.Vector3(),
      h2: new THREE.Vector3(),
      from: new THREE.Vector3(),
    }),
    [],
  );

  const report = useCallback(
    (next) => {
      if (next === stageRef.current) return;
      stageRef.current = next;
      setStage(next);
      if (typeof onStage === "function") onStage(next);
    },
    [onStage],
  );

  // A press starts a run. The token seen at mount is ignored, so coming back
  // to the Ester series does not replay the last press.
  useEffect(() => {
    if (token === seenToken.current) return;
    seenToken.current = token;
    progress.current = 0;
    report(0);
  }, [token, report]);

  // A new chain length abandons a run in progress.
  useEffect(() => {
    progress.current = -1;
    report(-1);
  }, [carbons, report]);

  useFrame((_, delta) => {
    const p0 = progress.current;
    if (p0 < 0) return;
    const p = Math.min(1, p0 + (delta * Math.max(speed, 0)) / ESTER_SECONDS);
    progress.current = p;
    if (p >= 1) {
      progress.current = -1;
      report(-1);
      return;
    }

    const gap =
      p < ESTER_T.approach
        ? lerp(ESTER_START_GAP, ESTER_HOLD_GAP, span(p, 0, ESTER_T.approach))
        : p < ESTER_T.leave
          ? ESTER_HOLD_GAP
          : lerp(ESTER_HOLD_GAP, 0, span(p, ESTER_T.leave, ESTER_T.join));
    if (acylRef.current) acylRef.current.position.x = -gap;
    if (methRef.current) methRef.current.position.x = gap;

    const { c1, bridge, o, h1, h2, from, dir } = scratch;
    c1.copy(geo.c1).x -= gap;
    bridge.copy(geo.bridgeO).x += gap;

    // The leaving atoms ride on their parents until the bonds break, then
    // travel to the water's place.
    const leave = span(p, ESTER_T.strain, ESTER_T.leave);
    from.copy(geo.acidO).x -= gap;
    o.lerpVectors(from, geo.water, leave);
    from.copy(geo.acidH).x -= gap;
    h1.lerpVectors(from, geo.waterH1, leave);
    from.copy(geo.alcH).x += gap;
    h2.lerpVectors(from, geo.waterH2, leave);
    leaveO.current?.position.copy(o);
    leaveH1.current?.position.copy(h1);
    leaveH2.current?.position.copy(h2);

    const b = bonds.current;
    const breaking = p < ESTER_T.strain;
    const strained = p >= ESTER_T.approach && breaking;
    const pulse = strained ? 0.6 + 0.6 * Math.sin(p * ESTER_SECONDS * 14) : 0.12;
    for (const key of ["acylC", "alcOH"]) {
      if (!b[key]) continue;
      b[key].visible = breaking;
      b[key].material.color.set(strained ? PALETTE.rose : BOND_GREY);
      b[key].material.emissive.set(strained ? PALETTE.rose : BOND_GREY);
      b[key].material.emissiveIntensity = pulse;
    }
    placeBond(b.acylC, c1, o, dir);
    placeBond(b.alcOH, bridge, h2, dir);
    placeBond(b.waterOH1, o, h1, dir);
    // Water's second O–H forms as the H arrives.
    if (b.waterOH2) b.waterOH2.visible = leave > 0.85;
    placeBond(b.waterOH2, o, h2, dir);
    // The new ester bond, gold while it is news.
    if (b.ester) {
      b.ester.visible = p >= ESTER_T.join - 0.02;
      const fresh = p < 0.93;
      b.ester.material.color.set(fresh ? PALETTE.gold : BOND_GREY);
      b.ester.material.emissive.set(fresh ? PALETTE.gold : BOND_GREY);
      b.ester.material.emissiveIntensity = fresh ? 0.9 : 0.12;
    }
    placeBond(b.ester, c1, bridge, dir);

    report(p < ESTER_T.approach ? 0 : p < ESTER_T.strain ? 1 : p < ESTER_T.leave ? 2 : p < ESTER_T.join ? 3 : 4);
  });

  if (stage < 0) return null;

  const bondMesh = (key) => (
    <mesh
      key={key}
      visible={key !== "ester" && key !== "waterOH2"}
      ref={(el) => {
        bonds.current[key] = el;
      }}
    >
      <cylinderGeometry args={[0.075, 0.075, 1, 14]} />
      <meshStandardMaterial color={BOND_GREY} emissive={BOND_GREY} emissiveIntensity={0.12} roughness={0.4} metalness={0.2} />
    </mesh>
  );
  const atomMesh = (ref, el, position) => (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[ATOM_STYLE[el].radius, 28, 28]} />
      <meshStandardMaterial
        color={ATOM_STYLE[el].color}
        emissive={ATOM_STYLE[el].color}
        emissiveIntensity={stage === 1 || stage === 2 ? 0.9 : 0.4}
        roughness={0.28}
        metalness={0.2}
      />
    </mesh>
  );
  const joined = stage >= 4;
  const startAcid = (p) => [p[0] - ESTER_START_GAP, p[1], p[2]];
  const startMeth = (p) => [p[0] + ESTER_START_GAP, p[1], p[2]];

  return (
    <group>
      <group ref={acylRef} position={[-ESTER_START_GAP, 0, 0]}>
        <AtomsAndBonds atoms={asm.acyl.atoms} bonds={asm.acyl.bonds} />
        {!joined && (
          <ChemLabel position={geo.acylLabel} tone="text-ink-200">
            {`${info.acid.formula} · ${info.acid.name}`}
          </ChemLabel>
        )}
      </group>
      <group ref={methRef} position={[ESTER_START_GAP, 0, 0]}>
        <AtomsAndBonds atoms={asm.methoxy.atoms} bonds={asm.methoxy.bonds} />
        {!joined && (
          <ChemLabel position={geo.methLabel} tone="text-ink-200">
            {`${info.alcohol.formula} · ${info.alcohol.name}`}
          </ChemLabel>
        )}
      </group>
      {atomMesh(leaveO, "O", startAcid(asm.leaving.acidO))}
      {atomMesh(leaveH1, "H", startAcid(asm.leaving.acidH))}
      {atomMesh(leaveH2, "H", startMeth(asm.leaving.alcH))}
      {["acylC", "alcOH", "waterOH1", "waterOH2", "ester"].map(bondMesh)}
      {stage >= 2 && (
        <ChemLabel position={geo.waterLabel} tone="text-sky-300">
          {`${info.water.formula} · ${info.water.name}`}
        </ChemLabel>
      )}
      {joined && (
        <ChemLabel position={geo.productLabel} tone="text-emerald-300">
          {`${info.ester.formula} · ${info.ester.name}`}
        </ChemLabel>
      )}
    </group>
  );
}

// The "Show labels" toggle for the scenes in this file: each scene provides
// its switch inside its canvas (context does not cross the R3F boundary),
// and ChemLabel renders nothing when it is off.
const LabelsOn = createContext(true);
function ChemLabel(props) {
  return useContext(LabelsOn) ? <SceneLabel {...props} /> : null;
}

export function OrganicBuilderScene({ params = {} }) {
  const { family = "alkane", carbons = 3, crack = 0, esterify = 0, spin = true, speed = 1.0, showLabels = true } = params || {};
  const molecule = useMemo(() => buildMolecule(family, carbons), [family, carbons]);
  // The same description the Details panel prints.
  const info = useMemo(() => describeMolecule(family, carbons), [family, carbons]);
  const { crackable } = info;

  // Whether the two products are the thing currently on screen. The Molecule
  // reports the transition, so this is a state change per crack, not per frame.
  const [cracked, setCracked] = useState(false);
  const cracking = useMemo(() => (crackable ? crackProducts(carbons) : null), [crackable, carbons]);
  useEffect(() => setCracked(false), [family, carbons]);

  const isEster = family === "ester" && info.valid;
  const ester = useMemo(() => (isEster ? esterification(carbons) : null), [isEster, carbons]);
  const [stage, setStage] = useState(-1);
  useEffect(() => setStage(-1), [family, carbons]);
  const reacting = isEster && stage >= 0;

  // The box the camera keeps in view: the reactants spread out, the two
  // cracked products side by side, or the molecule's swept circle.
  const frame = useMemo(() => {
    const labelRoom = 1.8;
    if (reacting) {
      return {
        width: 2 * halfWidth(molecule) + 2 * ESTER_START_GAP + 0.6,
        height: 2 * (halfHeight(molecule) + 2.9) + labelRoom,
        depth: 1,
      };
    }
    if (cracked && cracking) {
      const alkane = buildMolecule("alkane", cracking.alkane.carbons);
      const alkene = buildMolecule("alkene", cracking.alkene.carbons);
      return {
        width: 2 * (spinRadius(alkane) + spinRadius(alkene)) + CRACK_GAP,
        height: 2 * Math.max(halfHeight(alkane), halfHeight(alkene)) + 2 * labelRoom,
        depth: spin ? 0.6 * spinRadius(alkane) : 1,
      };
    }
    const r = spin ? spinRadius(molecule) : halfWidth(molecule);
    return { width: 2 * r, height: 2 * halfHeight(molecule) + 2 * labelRoom, depth: spin ? 0.35 * r : 1 };
  }, [reacting, cracked, cracking, molecule, spin]);

  const bottom = -(frame.height / 2 - 0.9);

  return (
    <SceneCanvas camera={{ position: [0, 2.4, 10], fov: 45 }}>
      <LabelsOn.Provider value={showLabels !== false}>
      <CameraDolly width={frame.width} height={frame.height} depth={frame.depth} />
      <Molecule
        family={family}
        carbons={carbons}
        crackToken={crack}
        spin={spin}
        speed={speed}
        hidden={reacting}
        cracked={cracked}
        onCrackedChange={setCracked}
      />
      {isEster && (
        <Esterification carbons={carbons} token={esterify} speed={speed} info={ester} onStage={setStage} />
      )}

      <ChemLabel position={[0, bottom, 0]} accent>
        {reacting
          ? ester.equation
          : cracked && cracking
            ? cracking.equation
            : `${molecule.formula} · ${molecule.name}`}
      </ChemLabel>
      {reacting && (
        <ChemLabel
          position={[0, bottom - 0.45, 0]}
          tone={stage === 1 ? "text-rose-300" : stage >= 3 ? "text-emerald-300" : "text-ink-300"}
        >
          {`${stage + 1}/5 · ${ESTER_STAGES[stage]}`}
        </ChemLabel>
      )}
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}

// ═══ 8 · Fractional distillation ═════════════════════════════════════

// FRACTIONS and the rise predicate live in lib/distillation.js; everything
// below is drawing.

const COLUMN_HEIGHT = 7.6;
const COLUMN_R = 1.7;
const levelY = (i) => COLUMN_HEIGHT / 2 - 0.6 - i * 1.25;
const COLUMN_BOTTOM = -COLUMN_HEIGHT / 2;
/** The fractions that boil — everything but the residue at the base. */
const VAPOURISING = FRACTIONS.filter((f) => !f.residue);

/** Camera, and the direction the cutaway opens towards (its azimuth). */
const DISTIL_CAMERA = [6.2, 2.6, 15.8];
const CUTAWAY_FACING = Math.atan2(DISTIL_CAMERA[0], DISTIL_CAMERA[2]);
/**
 * The shell is a partial cylinder: a 0.72π wedge is left open, centred on
 * local +Z, and the whole shell is turned to face the camera. Left square on
 * the camera's edge, the column read as half open and half shut.
 */
const CUT_START = Math.PI * 0.36;
const CUT_LENGTH = Math.PI * 1.28;

/** Where a take-off pipe leaves the shell and where its receiver sits. */
const PIPE_OUT_X = COLUMN_R + 0.05;
const RECEIVER_X = 3.55;
const LABEL_X = 5.75;
/** The temperature scale, left of the column. */
const SCALE_X = -2.35;
const FURNACE_POS = [-5.0, 0, 0];

// Light enough to stand clear of the #273043 canvas; metalness kept low, as
// high metalness goes dark with nothing bright to reflect.
const STEEL_MAT = { color: "#c5d0de", roughness: 0.32, metalness: 0.35, emissive: "#c5d0de", emissiveIntensity: 0.12 };
const DARK_MAT = { color: "#8492a6", roughness: 0.5, metalness: 0.3, emissive: "#8492a6", emissiveIntensity: 0.1 };

const COOL = new THREE.Color("#38bdf8");
const WARM = new THREE.Color("#fbbf24");
const HOT = new THREE.Color("#f97316");

/** Colour for a height in the column, hottest at the base. */
function gradientAt(t, heat) {
  // t = 0 at the base, 1 at the top. A cooler furnace pulls the warm band down.
  const hotness = clamp(1 - t / (0.35 + heat * 0.65), 0, 1);
  const c = COOL.clone();
  if (hotness < 0.5) c.lerp(WARM, hotness * 2);
  else c.copy(WARM).lerp(HOT, (hotness - 0.5) * 2);
  return c;
}

/**
 * The shell's inner liner, vertex-coloured from hot orange at the base to
 * cool blue at the top. The gradient IS the mechanism — each fraction
 * condenses where the column has cooled to its boiling range — so it is
 * painted on the column rather than implied by which tray glows.
 */
function GradientLiner({ heat }) {
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(COLUMN_R - 0.03, COLUMN_R - 0.03, COLUMN_HEIGHT, 64, 24, true, CUT_START, CUT_LENGTH);
    const pos = g.attributes.position;
    const colours = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      const t = (pos.getY(i) + COLUMN_HEIGHT / 2) / COLUMN_HEIGHT;
      const c = gradientAt(t, heat);
      colours.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return g;
  }, [heat]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors side={THREE.BackSide} roughness={0.6} metalness={0} transparent opacity={0.8} />
    </mesh>
  );
}

/** Steel shell, dome, skirt and the flanges that mark each tray from outside. */
function ColumnShell() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[COLUMN_R + 0.08, COLUMN_R + 0.08, COLUMN_HEIGHT, 64, 1, true, CUT_START, CUT_LENGTH]} />
        <meshStandardMaterial {...STEEL_MAT} side={THREE.FrontSide} />
      </mesh>
      {/* The cut edges, so the wall reads as having thickness. */}
      {[CUT_START, CUT_START + CUT_LENGTH].map((a) => (
        <mesh key={a} position={[Math.sin(a) * (COLUMN_R + 0.03), 0, Math.cos(a) * (COLUMN_R + 0.03)]} rotation={[0, a, 0]}>
          <boxGeometry args={[0.14, COLUMN_HEIGHT, 0.02]} />
          <meshStandardMaterial {...DARK_MAT} />
        </mesh>
      ))}
      {/* Flange rings at each tray. */}
      {FRACTIONS.map((f, i) => (
        <mesh key={f.key} position={[0, levelY(i) - 0.04, 0]}>
          <cylinderGeometry args={[COLUMN_R + 0.14, COLUMN_R + 0.14, 0.09, 64, 1, true, CUT_START, CUT_LENGTH]} />
          <meshStandardMaterial {...DARK_MAT} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Dome top, cut the same way, and the gas outlet. */}
      <mesh position={[0, COLUMN_HEIGHT / 2, 0]} scale={[1, 0.45, 1]}>
        {/* A sphere measures its angle from −x where a cylinder starts at +z, hence the +π/2. */}
        <sphereGeometry args={[COLUMN_R + 0.08, 48, 16, CUT_START + Math.PI / 2, CUT_LENGTH, 0, Math.PI / 2]} />
        <meshStandardMaterial {...STEEL_MAT} side={THREE.DoubleSide} />
      </mesh>
      {/* Skirt the column stands on. */}
      <mesh position={[0, COLUMN_BOTTOM - 0.45, 0]}>
        <cylinderGeometry args={[COLUMN_R + 0.12, COLUMN_R + 0.3, 0.9, 64]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
    </group>
  );
}

/** A tray: a perforated plate with bubble caps and, once reached, its pool. */
function Tray({ fraction, y, reached }) {
  const caps = useMemo(
    () =>
      [-0.55, 0, 0.55].flatMap((dx, k) => [
        [dx, -0.55 + (k % 2) * 0.25],
        [dx, 0.35 - (k % 2) * 0.25],
      ]),
    [],
  );
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry args={[COLUMN_R - 0.02, COLUMN_R - 0.02, 0.07, 64, 1, false, CUT_START, CUT_LENGTH]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
      {/* Condensed liquid standing on the tray — this fraction's colour. */}
      <mesh position={[0, 0.07, 0]} visible={reached}>
        <cylinderGeometry args={[COLUMN_R - 0.06, COLUMN_R - 0.06, 0.07, 64, 1, false, CUT_START, CUT_LENGTH]} />
        <meshStandardMaterial
          color={fraction.colour}
          emissive={fraction.colour}
          emissiveIntensity={0.55}
          transparent
          opacity={0.85}
          roughness={0.15}
        />
      </mesh>
      {/* Bubble caps: vapour climbs each riser, is turned down by the cap,
          and bubbles out through the liquid standing on the tray. */}
      {caps.map(([x, z], k) => (
        <group key={k} position={[x, 0, z]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.2, 12]} />
            <meshStandardMaterial {...DARK_MAT} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial {...STEEL_MAT} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Take-off pipe, a drop-leg, and a glass receiver filling with the fraction. */
function Receiver({ fraction, y, reached, filled }) {
  const drop = 0.55;
  const jarH = 0.6;
  const fill = filled ? 0.78 : reached ? 0.45 : 0.06;
  return (
    <group>
      {/* Horizontal run out of the shell. */}
      <mesh position={[(PIPE_OUT_X + RECEIVER_X) / 2, y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, RECEIVER_X - PIPE_OUT_X, 12]} />
        <meshStandardMaterial {...STEEL_MAT} />
      </mesh>
      {/* Elbow and drop into the receiver. */}
      <mesh position={[RECEIVER_X, y, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial {...STEEL_MAT} />
      </mesh>
      <mesh position={[RECEIVER_X, y - drop / 2, 0]}>
        <cylinderGeometry args={[0.07, 0.07, drop, 12]} />
        <meshStandardMaterial {...STEEL_MAT} />
      </mesh>
      <group position={[RECEIVER_X, y - drop - jarH / 2 - 0.02, 0]}>
        <mesh>
          <cylinderGeometry args={[0.3, 0.3, jarH, 24, 1, true]} />
          <meshStandardMaterial color="#cfe8f5" transparent opacity={0.22} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0, -jarH / 2 + (jarH * fill) / 2, 0]}>
          <cylinderGeometry args={[0.27, 0.27, jarH * fill, 24]} />
          <meshStandardMaterial
            color={fraction.colour}
            emissive={fraction.colour}
            emissiveIntensity={reached || filled ? 0.6 : 0.1}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, -jarH / 2 - 0.03, 0]}>
          <cylinderGeometry args={[0.33, 0.33, 0.05, 24]} />
          <meshStandardMaterial {...DARK_MAT} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Vapour rising from the feed and condensing at its own tray. Each particle
 * climbs only as far as the furnace heat carries its fraction, slows as it
 * nears its tray, and shrinks to nothing there — it has condensed.
 */
function Vapours({ heat, flowing, speed = 1.0 }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        // Residues never vaporise, so they get no vapour — index only into
        // the fractions that can actually climb.
        fraction: i % VAPOURISING.length,
        phase: hashRandom(i + 3),
        wobble: hashRandom(i + 51) * Math.PI * 2,
        radius: 0.2 + hashRandom(i + 17) * 1.0,
      })),
    [],
  );
  const t = useRef(0);
  const meshes = useRef([]);

  useFrame((_, delta) => {
    if (flowing) t.current += delta * 0.28 * speed;
    particles.forEach((p, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const reach = rises(heat, p.fraction) ? 1 : 0;
      const bottom = levelY(FRACTIONS.length - 1) + 0.25;
      const ceiling = levelY(p.fraction) - 0.12;
      const local = (t.current + p.phase) % 1;
      // Ease-out: fast off the feed, slowing as it reaches its tray.
      const rise = 1 - Math.pow(1 - local, 2);
      const y = bottom + (ceiling - bottom) * rise;
      const a = p.wobble + local * 5;
      mesh.position.set(Math.cos(a) * p.radius, y, Math.sin(a) * p.radius);
      const fade = reach ? Math.min(1, local * 8) * (1 - Math.pow(local, 8)) : 0;
      mesh.scale.setScalar(0.001 + fade * 0.075);
    });
  });

  return (
    <group rotation={[0, CUTAWAY_FACING, 0]}>
      {particles.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial
            color={VAPOURISING[p.fraction].colour}
            emissive={VAPOURISING[p.fraction].colour}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Radiant-section box of the pipe still, and the pieces hung off it. */
const HEATER = { w: 1.9, h: 2.0, d: 1.5, legs: 0.45, wall: 0.08 };
const CASING_MAT = { color: "#b8c2cf", roughness: 0.45, metalness: 0.35, emissive: "#b8c2cf", emissiveIntensity: 0.1 };
const REFRACTORY = "#e0a37a";

/**
 * The pipe still: a refinery furnace, drawn cut open at the front.
 *
 * Crude from the tank enters the convection section at the top, runs down a
 * serpentine coil through the radiant firebox — heated by the burners on the
 * floor, the refractory lining glowing behind the tubes — and leaves as a hot
 * vapour-liquid mix along the transfer line into the column's base. Flame
 * height, lining glow and the coil's own glow all follow the heat slider.
 */
function Furnace({ heat, furnaceC, speed, flowing }) {
  const flames = useRef([]);
  const lining = useRef(null);
  const light = useRef(null);
  const [fx, , fz] = FURNACE_POS;
  const floor = COLUMN_BOTTOM - 0.95 + 0.1; // top of the concrete pad
  const boxBottom = floor + HEATER.legs;
  const boxMid = boxBottom + HEATER.h / 2;
  const boxTop = boxBottom + HEATER.h;
  const convH = 0.8;
  const convTop = boxTop + convH;
  const stackH = 1.9;
  const feedY = levelY(FRACTIONS.length - 1) + 0.45;
  const coilRows = 6;
  const coilY = (k) => boxBottom + 0.55 + k * ((HEATER.h - 0.85) / (coilRows - 1));
  const coilZ = HEATER.d / 2 - 0.42;
  const bendReach = (HEATER.h - 0.85) / (coilRows - 1) / 2 + 0.075; // U-bend radius + tube
  // The straight runs stop short enough that the bends clear the side walls'
  // inner faces; at w/2 − 0.22 they poked out through the casing.
  const coilHalf = HEATER.w / 2 - HEATER.wall - bendReach - 0.04;
  const hotColour = useMemo(() => new THREE.Color("#7c5a4a").lerp(HOT, 0.25 + heat * 0.6), [heat]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed;
    const base = 0.35 + heat * 0.9;
    flames.current.forEach((m, i) => {
      if (!m) return;
      const flicker = flowing ? 1 + 0.12 * Math.sin(t * 11 + i * 2.1) + 0.07 * Math.sin(t * 23 + i) : 1;
      m.scale.set(1, base * flicker, 1);
      m.position.y = boxBottom + 0.1 + (0.55 * base * flicker) / 2;
    });
    const glow = (0.35 + heat * 1.1) * (flowing ? 0.94 + 0.06 * Math.sin(t * 7) : 1);
    if (lining.current) lining.current.emissiveIntensity = glow;
    if (light.current) light.current.intensity = 6 + heat * 18 * (flowing ? 0.9 + 0.1 * Math.sin(t * 9) : 1);
  });

  const pipe = (key, from, to, radius = 0.07, mat = STEEL_MAT) => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return (
      <mesh key={key} position={mid} quaternion={q}>
        <cylinderGeometry args={[radius, radius, dir.length(), 14]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    );
  };

  const tankPos = [fx - 0.1, floor, fz - 2.3];
  const tankH = 1.5;

  return (
    <group>
      <group position={[fx, 0, fz]}>
        {/* Legs: burners fire upward from underneath, so the box stands clear. */}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * (HEATER.w / 2 - 0.1), floor + HEATER.legs / 2, sz * (HEATER.d / 2 - 0.1)]}>
              <boxGeometry args={[0.12, HEATER.legs, 0.12]} />
              <meshStandardMaterial {...DARK_MAT} />
            </mesh>
          )),
        )}

        {/* Casing: floor, back, sides and roof — the front is cut away. */}
        {/* Floor and roof overhang the walls by a hair and the walls stop
            short of them, so no two faces are coplanar (it z-fought). */}
        <mesh position={[0, boxBottom + HEATER.wall / 2, 0]}>
          <boxGeometry args={[HEATER.w + 0.04, HEATER.wall, HEATER.d + 0.04]} />
          <meshStandardMaterial {...CASING_MAT} />
        </mesh>
        <mesh position={[0, boxTop - HEATER.wall / 2, 0]}>
          <boxGeometry args={[HEATER.w + 0.04, HEATER.wall, HEATER.d + 0.04]} />
          <meshStandardMaterial {...CASING_MAT} />
        </mesh>
        <mesh position={[0, boxMid, -HEATER.d / 2 + HEATER.wall / 2]}>
          <boxGeometry args={[HEATER.w - 0.01, HEATER.h - 2 * HEATER.wall - 0.01, HEATER.wall]} />
          <meshStandardMaterial {...CASING_MAT} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (HEATER.w / 2 - HEATER.wall / 2), boxMid, 0]}>
            <boxGeometry args={[HEATER.wall, HEATER.h - 2 * HEATER.wall - 0.01, HEATER.d - 0.01]} />
            <meshStandardMaterial {...CASING_MAT} />
          </mesh>
        ))}
        {/* Front frame around the cutaway, and vertical stiffeners down the sides. */}
        {[-1, 1].map((sx) => (
          <mesh key={`post${sx}`} position={[sx * (HEATER.w / 2 - 0.05), boxMid, HEATER.d / 2 - 0.05]}>
            <boxGeometry args={[0.12, HEATER.h - 2 * HEATER.wall - 0.01, 0.12]} />
            <meshStandardMaterial {...DARK_MAT} />
          </mesh>
        ))}
        {[boxBottom + HEATER.wall / 2, boxTop - HEATER.wall / 2].map((y) => (
          <mesh key={`rail${y}`} position={[0, y, HEATER.d / 2 + 0.03]}>
            <boxGeometry args={[HEATER.w + 0.08, 0.12, 0.06]} />
            <meshStandardMaterial {...DARK_MAT} />
          </mesh>
        ))}
        {[-1, 1].flatMap((sx) =>
          [-0.35, 0.1].map((z) => (
            // Between the slabs and just outside their overhang: full height,
            // the rib tops sat on the roof's top face and z-fought.
            <mesh key={`rib${sx}${z}`} position={[sx * (HEATER.w / 2 + 0.05), boxMid, z]}>
              <boxGeometry args={[0.05, HEATER.h - 2 * HEATER.wall - 0.01, 0.08]} />
              <meshStandardMaterial {...DARK_MAT} />
            </mesh>
          )),
        )}

        {/* Refractory lining on the back wall, glowing with the fire. */}
        <mesh position={[0, boxMid, -HEATER.d / 2 + HEATER.wall + 0.01]}>
          <planeGeometry args={[HEATER.w - 2 * HEATER.wall, HEATER.h - 2 * HEATER.wall]} />
          <meshStandardMaterial ref={lining} color={REFRACTORY} emissive="#f97316" emissiveIntensity={1} roughness={0.9} />
        </mesh>
        <pointLight ref={light} position={[0, boxBottom + 0.7, 0.1]} color="#ff8a3d" intensity={12} distance={3.2} decay={2} />

        {/* The coil: crude runs back and forth through the fire. */}
        {Array.from({ length: coilRows }, (_, k) => (
          <group key={k}>
            <mesh position={[0, coilY(k), coilZ]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.075, 0.075, coilHalf * 2, 14]} />
              <meshStandardMaterial color={hotColour} emissive={HOT} emissiveIntensity={0.15 + heat * 0.5} roughness={0.4} metalness={0.5} />
            </mesh>
            {k < coilRows - 1 && (
              // U-bend joining this row to the next, alternating ends.
              <mesh
                position={[(k % 2 === 0 ? -1 : 1) * coilHalf, (coilY(k) + coilY(k + 1)) / 2, coilZ]}
                rotation={[0, 0, k % 2 === 0 ? Math.PI / 2 : -Math.PI / 2]}
              >
                <torusGeometry args={[(coilY(k + 1) - coilY(k)) / 2, 0.075, 10, 16, Math.PI]} />
                <meshStandardMaterial color={hotColour} emissive={HOT} emissiveIntensity={0.15 + heat * 0.5} roughness={0.4} metalness={0.5} />
              </mesh>
            )}
          </group>
        ))}

        {/* Burners on the floor, each with a flickering flame. */}
        {[-0.55, 0, 0.55].map((x, i) => (
          <group key={x}>
            <mesh position={[x, boxBottom + 0.1, -0.1]}>
              <cylinderGeometry args={[0.14, 0.17, 0.12, 16]} />
              <meshStandardMaterial {...DARK_MAT} />
            </mesh>
            <mesh
              ref={(el) => {
                flames.current[i] = el;
              }}
              position={[x, boxBottom + 0.35, -0.1]}
            >
              <coneGeometry args={[0.12, 0.55, 16, 1, true]} />
              <meshBasicMaterial color="#ffb347" transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}

        {/* Sight ports: small glass windows in a bolted bezel, so they read
            as inspection ports and not as tube ends poking through. */}
        {[boxBottom + 0.6, boxBottom + 1.35].map((y) => (
          <group key={y} position={[HEATER.w / 2 + 0.02, y, -0.58]} rotation={[0, Math.PI / 2, 0]}>
            <mesh position={[0, 0, 0.02]}>
              <torusGeometry args={[0.085, 0.03, 10, 24]} />
              <meshStandardMaterial {...DARK_MAT} />
            </mesh>
            <mesh position={[0, 0, 0.012]}>
              <circleGeometry args={[0.07, 20]} />
              <meshStandardMaterial color="#2a1206" emissive="#f97316" emissiveIntensity={0.35 + heat * 0.9} toneMapped={false} />
            </mesh>
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} position={[Math.cos((k * Math.PI) / 2 + Math.PI / 4) * 0.13, Math.sin((k * Math.PI) / 2 + Math.PI / 4) * 0.13, 0.02]}>
                <sphereGeometry args={[0.018, 8, 8]} />
                <meshStandardMaterial {...DARK_MAT} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Convection section and a tapered stack. */}
        <mesh position={[0, boxTop + 0.004 + convH / 2, -0.1]}>
          <boxGeometry args={[HEATER.w * 0.62, convH, HEATER.d * 0.7]} />
          <meshStandardMaterial {...CASING_MAT} />
        </mesh>
        <mesh position={[0, convTop + 0.08, -0.1]}>
          <cylinderGeometry args={[0.34, 0.45, 0.16, 20]} />
          <meshStandardMaterial {...DARK_MAT} />
        </mesh>
        <mesh position={[0, convTop + 0.16 + stackH / 2, -0.1]}>
          <cylinderGeometry args={[0.2, 0.28, stackH, 20]} />
          <meshStandardMaterial {...CASING_MAT} />
        </mesh>
        {[0.45, 1.25].map((h) => (
          <mesh key={h} position={[0, convTop + 0.16 + h, -0.1]}>
            <cylinderGeometry args={[0.27 - h * 0.03, 0.27 - h * 0.03, 0.06, 20]} />
            <meshStandardMaterial {...DARK_MAT} />
          </mesh>
        ))}
      </group>

      {/* Crude-oil storage tank behind the furnace. */}
      <group position={tankPos}>
        <mesh position={[0, tankH / 2, 0]}>
          <cylinderGeometry args={[0.8, 0.8, tankH, 36]} />
          <meshStandardMaterial color="#9aa6b6" roughness={0.5} metalness={0.3} emissive="#9aa6b6" emissiveIntensity={0.08} />
        </mesh>
        {/* Roof dome sits right on the shell's rim, lapping it a hair. */}
        <mesh position={[0, tankH - 0.005, 0]} scale={[1, 0.22, 1]}>
          <sphereGeometry args={[0.8, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial {...CASING_MAT} />
        </mesh>
        {[0.35, 0.8, 1.25].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[0.815, 0.815, 0.04, 36]} />
            <meshStandardMaterial {...DARK_MAT} />
          </mesh>
        ))}
        {/* Black band: this is crude oil. */}
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.812, 0.812, 0.3, 36]} />
          <meshStandardMaterial color="#1f2229" roughness={0.6} />
        </mesh>
      </group>
      {/* Feed: tank → up → into the convection section's back. */}
      {pipe("feedUp", [tankPos[0] + 0.5, floor + tankH - 0.1, tankPos[2] + 0.45], [tankPos[0] + 0.5, boxTop + convH * 0.5, tankPos[2] + 0.45])}
      {pipe("feedOver", [tankPos[0] + 0.5, boxTop + convH * 0.5, tankPos[2] + 0.45], [tankPos[0] + 0.5, boxTop + convH * 0.5, fz - 0.4])}
      {/* Elbows, so the bends are closed rather than two cut ends meeting. */}
      {[
        [tankPos[0] + 0.5, floor + tankH - 0.1, tankPos[2] + 0.45],
        [tankPos[0] + 0.5, boxTop + convH * 0.5, tankPos[2] + 0.45],
      ].map((p) => (
        <mesh key={p.join()} position={p}>
          <sphereGeometry args={[0.07, 14, 14]} />
          <meshStandardMaterial {...STEEL_MAT} />
        </mesh>
      ))}
      <mesh position={[tankPos[0] + 0.5, boxTop + convH * 0.5, fz - 0.1 - HEATER.d * 0.35 - 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.05, 18]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
      {/* Transfer line: coil outlet → column base, glowing with the heat. */}
      {pipe(
        "transfer",
        [fx + HEATER.w / 2, feedY, fz],
        [-COLUMN_R + 0.05, feedY, 0],
        0.13,
        { color: "#b07a5c", roughness: 0.45, metalness: 0.4, emissive: HOT, emissiveIntensity: 0.15 + heat * 0.45 },
      )}
      <mesh position={[fx + HEATER.w / 2 + 0.05, feedY, fz]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 18]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>

      <SceneLabel position={[fx, convTop + stackH + 0.55, fz]} tone="text-orange-300">
        {`furnace · crude oil heated to ${furnaceC}°C`}
      </SceneLabel>
    </group>
  );
}

/** A thermometer scale beside the column: one tick per tray, coloured to match. */
function TemperatureScale({ heat, furnaceC, showLabels }) {
  const top = COLUMN_HEIGHT / 2;
  const bottom = COLUMN_BOTTOM;
  const points = useMemo(() => {
    const n = 24;
    return Array.from({ length: n + 1 }, (_, i) => [0, bottom + ((top - bottom) * i) / n, 0]);
  }, [top, bottom]);
  const colours = useMemo(
    () => points.map((p) => gradientAt((p[1] - bottom) / (top - bottom), heat).toArray()),
    [points, heat, top, bottom],
  );
  return (
    <group position={[SCALE_X, 0, 0.3]}>
      <Line points={points} vertexColors={colours} lineWidth={5} />
      {FRACTIONS.map((f, i) => (
        <group key={f.key} position={[0, levelY(i), 0]}>
          <mesh position={[0.12, 0, 0]}>
            <boxGeometry args={[0.24, 0.025, 0.025]} />
            <meshBasicMaterial color={PALETTE.bone} />
          </mesh>
          {showLabels && (
            <SceneLabel position={[-0.55, 0, 0]} tone="text-ink-300">
              {f.residue ? `>${FRACTIONS[i - 1].top}°C` : `≤${f.top}°C`}
            </SceneLabel>
          )}
        </group>
      ))}
      <SceneLabel position={[0, top + 0.45, 0]} tone="text-sky-300">
        cool · 25°C
      </SceneLabel>
      <SceneLabel position={[0, bottom - 0.4, 0]} tone="text-orange-300">
        {`hot · ${furnaceC}°C`}
      </SceneLabel>
    </group>
  );
}

export function DistillationScene({ params = {} }) {
  const { heat = 0.7, showLabels = true, flow = true, speed = 1.0 } = params || {};
  const furnace = furnaceTemperature(heat);

  return (
    <SceneCanvas camera={{ position: DISTIL_CAMERA, fov: 45 }} controls={{ target: [0.1, -0.4, 0] }}>
      {/* Concrete pad. */}
      <mesh position={[-0.3, COLUMN_BOTTOM - 0.95, -0.4]}>
        <boxGeometry args={[13.8, 0.2, 6.5]} />
        <meshStandardMaterial color="#6b778a" roughness={0.9} metalness={0.05} />
      </mesh>

      <group rotation={[0, CUTAWAY_FACING, 0]}>
        <ColumnShell />
        <GradientLiner heat={heat} />
        {FRACTIONS.map((fraction, i) => (
          <Tray key={fraction.key} fraction={fraction} y={levelY(i)} reached={fraction.residue || rises(heat, i)} />
        ))}
      </group>

      <Vapours heat={heat} flowing={flow} speed={speed} />

      {FRACTIONS.map((fraction, i) => {
        const reached = rises(heat, i);
        return (
          <group key={fraction.key}>
            <Receiver fraction={fraction} y={levelY(i)} reached={reached} filled={Boolean(fraction.residue)} />
            {showLabels && (
              <SceneLabel position={[LABEL_X, levelY(i) - 0.55, 0]} accent={reached || fraction.residue}>
                {`${fraction.name}${fraction.residue ? " (residue)" : ""} · ${fraction.chain} · ${fraction.use}`}
              </SceneLabel>
            )}
          </group>
        );
      })}

      <TemperatureScale heat={heat} furnaceC={furnace} showLabels={showLabels} />
      <Furnace heat={heat} furnaceC={furnace} speed={speed} flowing={flow} />
    </SceneCanvas>
  );
}

// ═══ 9 · Giant lattices — NaCl, diamond, graphite ════════════════════

function buildNaCl() {
  const atoms = [];
  const bonds = [];
  const n = 3;
  const a = 1.5;
  const at = (i, j, k) => [(i - 1) * a, (j - 1) * a, (k - 1) * a];

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      for (let k = 0; k < n; k += 1) {
        const sodium = (i + j + k) % 2 === 0;
        atoms.push({
          position: at(i, j, k),
          // Drawn under-size so the structure stays legible, but at the true
          // ionic radius ratio: Na⁺ is 102 pm against Cl⁻ at 181 pm. Sodium
          // is the smaller one precisely because it *lost* an electron.
          radius: sodium ? 0.248 : 0.44,
          color: sodium ? PALETTE.gold : PALETTE.emerald,
        });
        if (i < n - 1) bonds.push({ from: at(i, j, k), to: at(i + 1, j, k) });
        if (j < n - 1) bonds.push({ from: at(i, j, k), to: at(i, j + 1, k) });
        if (k < n - 1) bonds.push({ from: at(i, j, k), to: at(i, j, k + 1) });
      }
    }
  }
  return { atoms, bonds, layers: null };
}

/**
 * Draw a network from lib/latticeGeometry.js: colour and size by element,
 * and style covalent and hydrogen bonds apart. The geometry itself — and the
 * tests that hold it to real crystallography — live in the lib.
 */
// Sized against each network's own bond length (C–C 1.04, Si–O 0.68 world
// units) so the bonds, and so the tetrahedra, stay visible between atoms.
const LATTICE_ATOM = {
  C: { radius: 0.19, color: "#94a3b8" },
  Si: { radius: 0.2, color: PALETTE.gold },
  O: { radius: 0.13, color: PALETTE.rose },
  H: { radius: 0.13, color: PALETTE.bone },
};
function drawNetwork({ atoms, bonds }, { oxygenRadius } = {}) {
  return {
    atoms: atoms.map((a) => ({
      position: a.position,
      ...LATTICE_ATOM[a.el],
      ...(a.el === "O" && oxygenRadius ? { radius: oxygenRadius } : {}),
    })),
    bonds: bonds.map((b) =>
      b.kind === "hydrogen"
        ? { from: atoms[b.i].position, to: atoms[b.j].position, color: PALETTE.sky, radius: 0.024, opacity: 0.75 }
        : { from: atoms[b.i].position, to: atoms[b.j].position },
    ),
    layers: null,
  };
}

const buildDiamond = () => drawNetwork(diamondFragment());

function buildGraphite(slide) {
  const acc = 0.82;
  const atoms = [];
  const bonds = [];
  const sheets = [];
  const interlayer = [];
  // 335 pm between layers against 142 pm within one — a ratio of 2.36. That
  // gap is the whole story: covalent bonds in the sheet, weak forces across
  // it, so the layers shear while the sheets themselves never break.
  const gap = acc * 2.36;
  const layerY = [-gap, 0, gap];

  layerY.forEach((y, layerIndex) => {
    // Alternate layers slide in opposite directions so the shear is obvious.
    // The middle sheet also sits one bond length along: graphite stacks
    // ABAB, with half of each sheet's atoms over the hexagon centres of the
    // sheets either side. Stacked straight on top of each other (AA), as it
    // used to be, is not graphite.
    const dx = slide * 1.4 * (layerIndex - 1) + (layerIndex === 1 ? acc : 0);
    // Graphene lattice: a₁ = (3/2, √3/2)·a, a₂ = (3/2, −√3/2)·a, two atoms
    // per cell — which puts every carbon exactly `acc` from three others.
    const sheet = [];
    for (let i = -2; i <= 2; i += 1) {
      for (let j = -2; j <= 2; j += 1) {
        const ox = 1.5 * acc * (i + j) + dx;
        const oz = Math.sqrt(3) * 0.5 * acc * (i - j);
        sheet.push([ox, y, oz]);
        sheet.push([ox + acc, y, oz]);
      }
    }
    sheet.forEach((position) =>
      atoms.push({ position, radius: 0.22, color: layerIndex === 1 ? PALETTE.gold : "#94a3b8" }),
    );
    for (let i = 0; i < sheet.length; i += 1) {
      for (let j = i + 1; j < sheet.length; j += 1) {
        const d = Math.hypot(
          sheet[i][0] - sheet[j][0],
          sheet[i][2] - sheet[j][2],
        );
        if (Math.abs(d - acc) < 0.05) bonds.push({ from: sheet[i], to: sheet[j] });
      }
    }
    sheets.push(sheet);
  });

  // The weak forces ACROSS the layers, drawn between carbons that sit
  // directly on top of one another. With ABAB stacking only half of each
  // sheet's atoms have a partner straight above or below — the other half sit
  // over a hexagon's centre — so only those pairs get a line.
  //
  // The pairs are chosen with the sheets unslid and then KEPT as the slider
  // shears them, so the lines lean over and stretch as the layers slide. They
  // used to be re-picked every time as "the horizontally nearest carbon",
  // which with AB stacking joined atoms diagonally, piled several lines onto
  // one atom, and made them hop about as the slider moved.
  const shift = (layerIndex) => slide * 1.4 * (layerIndex - 1);
  for (let l = 0; l + 1 < sheets.length; l += 1) {
    const lower = sheets[l];
    const upper = sheets[l + 1];
    let drawn = 0;
    lower.forEach((p, i) => {
      const px = p[0] - shift(l);
      const j = upper.findIndex(
        (q) => Math.hypot(q[0] - shift(l + 1) - px, q[2] - p[2]) < 0.01,
      );
      // Every other eclipsed pair, so the forces read as a sparse field
      // rather than a wall of lines.
      if (j >= 0 && drawn++ % 2 === 0) interlayer.push({ from: p, to: upper[j], weak: true });
    });
  }

  // One delocalised electron per carbon is the reason graphite conducts, and
  // it was the one thing the key promised that had no counterpart on screen.
  // Drawn as a sparse drift of sprites between the sheets rather than one per
  // atom, which would bury the lattice.
  const electrons = [];
  sheets.forEach((sheet, layerIndex) => {
    for (let i = 1; i < sheet.length; i += 7) {
      electrons.push({
        position: [sheet[i][0], sheet[i][1] + 0.34, sheet[i][2]],
        layer: layerIndex,
        seed: i,
      });
    }
  });

  return { atoms, bonds, layers: layerY, interlayer, electrons };
}

/** α-quartz — see quartzFragment for the crystallography. */
const buildQuartz = () => drawNetwork(quartzFragment());

/** Hexagonal ice with the ice rules obeyed — see iceFragment. */
const buildIce = () => drawNetwork(iceFragment(), { oxygenRadius: 0.26 });

// LATTICE_FACTS and LATTICE_KEYS now live in lib/lattices.js.

/** Lives inside the Canvas — useFrame is only legal below <Canvas>. */
/**
 * The delocalised electrons in graphite, drifting within their own sheet.
 *
 * Instanced and animated on refs, so adding them costs one draw call rather
 * than one component per electron.
 */
function DelocalisedElectrons({ electrons, speed = 1.0 }) {
  const mesh = useRef(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!mesh.current || electrons.length === 0) return;
    t.current += Math.min(delta, 0.05) * speed;
    electrons.forEach((e, i) => {
      // A slow wander in the plane of the sheet — free to move along the
      // layer, never across the gap. That is exactly what makes graphite
      // conduct in one direction and not the other.
      const a = t.current * 0.6 + e.seed * 1.7;
      SCRATCH_OBJECT.position.set(
        e.position[0] + Math.cos(a) * 0.5,
        e.position[1] + Math.sin(a * 0.7) * 0.05,
        e.position[2] + Math.sin(a) * 0.5,
      );
      SCRATCH_OBJECT.scale.setScalar(0.075 + Math.sin(a * 2.3) * 0.015);
      SCRATCH_OBJECT.updateMatrix();
      mesh.current.setMatrixAt(i, SCRATCH_OBJECT.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  if (electrons.length === 0) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, electrons.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={PALETTE.gold}
        emissive={PALETTE.gold}
        emissiveIntensity={2.2}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function SpinningLattice({ lattice, showBonds, spin, speed = 1.0 }) {
  const group = useRef(null);

  useFrame((_, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.25 * speed;
  });

  return (
    <group ref={group}>
      {showBonds &&
        lattice.bonds.map((b, i) => (
          <Bond
            key={i}
            from={b.from}
            to={b.to}
            radius={b.radius ?? 0.045}
            color={b.color ?? BOND_COLOUR}
            opacity={b.opacity ?? 1}
          />
        ))}
      {/* Weak forces between the layers — thin and faint against the covalent
          bonds within a sheet, because that contrast IS the topic. */}
      {(lattice.interlayer ?? []).map((b, i) => (
        <Bond key={`w${i}`} from={b.from} to={b.to} radius={0.012} color={PALETTE.sky} opacity={0.4} />
      ))}
      {lattice.atoms.map((a, i) => (
        <AtomSphere
          key={i}
          position={a.position}
          radius={a.radius}
          color={a.color}
          emissiveIntensity={0.35}
        />
      ))}
      <DelocalisedElectrons electrons={lattice.electrons ?? []} speed={speed} />
    </group>
  );
}

export function CrystalLatticeScene({ params = {} }) {
  const { structure = "nacl", slide = 0, showBonds = true, spin = true, speed = 1.0, showLabels = true } = params || {};

  const lattice = useMemo(() => {
    if (structure === "diamond") return buildDiamond();
    if (structure === "graphite") return buildGraphite(slide);
    if (structure === "quartz") return buildQuartz();
    if (structure === "ice") return buildIce();
    return buildNaCl();
  }, [structure, slide]);

  const facts = latticeFactsFor(structure);

  return (
    <SceneCanvas camera={{ position: [6, 4.5, 8], fov: 45 }}>
      <LabelsOn.Provider value={showLabels !== false}>
      <SpinningLattice lattice={lattice} showBonds={showBonds} spin={spin} speed={speed} />

      {structure === "nacl" && (
        <>
          <ChemLabel position={[0, 3.4, 0]} accent>
            Na⁺ small · Cl⁻ large
          </ChemLabel>
        </>
      )}
      {structure === "graphite" && slide > 0.05 && (
        <ChemLabel position={[0, 3.4, 0]} tone="text-emerald-300">
          layers sliding — weak forces between sheets
        </ChemLabel>
      )}

      </LabelsOn.Provider>
    </SceneCanvas>
  );
}

// ═══ 10 · Electrolysis of copper(II) sulfate ═════════════════════════

const TANK = { w: 6, h: 3.4, d: 3 };

/**
 * 3D Tetrahedral Sulfate Anion (SO₄²⁻) — Central S (yellow) + 4 O (red) atoms
 */
function SulfateIon({ position, scale = 0.28 }) {
  return (
    <group position={position} scale={scale}>
      {/* Central Sulfur Atom */}
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={CELL_COLOURS.sulfur} emissive="#ca8a04" emissiveIntensity={0.8} />
      </mesh>
      {/* 4 Oxygen Atoms in Tetrahedral geometry */}
      {[
        [0.35, 0.35, 0.35],
        [-0.35, -0.35, 0.35],
        [-0.35, 0.35, -0.35],
        [0.35, -0.35, -0.35],
      ].map((pos, idx) => (
        <group key={idx}>
          <mesh position={pos}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color={CELL_COLOURS.oxygen} emissive="#dc2626" emissiveIntensity={0.6} />
          </mesh>
          <lineSegments>
            <bufferGeometry
              attach="geometry"
              onUpdate={(geo) =>
                geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(...pos)])
              }
            />
            <lineBasicMaterial color="#fef08a" lineWidth={2} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/**
 * 3D Copper Cation (Cu²⁺) — Central Cu (cyan) + Hydration shell ring
 */
function CopperIon({ position, scale = 0.26 }) {
  return (
    <group position={position} scale={scale}>
      <mesh>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshStandardMaterial color="#0284c7" emissive={CELL_COLOURS.cation} emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      {/* Hydration halo ring */}
      <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <torusGeometry args={[0.55, 0.04, 12, 24]} />
        <meshStandardMaterial color="#7dd3fc" emissive={CELL_COLOURS.cation} emissiveIntensity={1.2} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/**
 * Oxygen coming off an INERT anode.
 *
 * Deliberately absent from the copper cell: a copper anode dissolves in
 * preference to oxidising water, so nothing gases off there. Graphite cannot
 * dissolve, so water is oxidised instead and this is what you see.
 */
function AnodeGasBubbles({ x, rate = 1, active = true, animSpeed = 1, count = 14 }) {
  const refs = useRef([]);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        phase: hashRandom(i * 3.1 + 7),
        radius: 0.035 + hashRandom(i * 5.3 + 13) * 0.045,
        driftZ: (hashRandom(i * 7.7 + 19) - 0.5) * 0.5,
        driftX: (hashRandom(i * 9.1 + 23) - 0.5) * 0.28,
      })),
    [count],
  );
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.05) * animSpeed * (0.35 + rate * 0.5);
    seeds.forEach((seed, i) => {
      const el = refs.current[i];
      if (!el) return;
      if (!active) {
        el.visible = false;
        return;
      }
      const u = (clock.current + seed.phase) % 1;
      el.visible = true;
      el.position.set(x + seed.driftX * u, -TANK.h / 2 + 0.3 + u * (TANK.h - 1.05), seed.driftZ * u);
      // Bubbles grow as the pressure drops on the way up, and fade at the surface.
      const scale = 0.6 + u * 0.7;
      el.scale.setScalar(scale);
    });
  });

  return (
    <group>
      {seeds.map((seed, i) => (
        <mesh
          key={i}
          ref={(el) => (refs.current[i] = el)}
          // Placed up the anode from the start, so the very first frame -- and
          // any environment where useFrame has not run yet -- shows a column
          // of bubbles rather than a clump at the origin.
          position={[
            x + seed.driftX * seed.phase,
            -TANK.h / 2 + seed.phase * (TANK.h - 0.2),
            seed.driftZ * seed.phase,
          ]}
        >
          <sphereGeometry args={[seed.radius, 10, 10]} />
          <meshStandardMaterial
            color={CELL_COLOURS.bubble}
            emissive={CELL_COLOURS.bubble}
            emissiveIntensity={0.35}
            transparent
            opacity={0.55}
            roughness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

function Ions({ current, running, resetToken, onDeposit, onClock, animSpeed = 1, anodeX = 2, fromAnode = true, cationFraction = 1 }) {
  const ions = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        cation: i % 2 === 0, // Cu²⁺ heads for cathode, SO₄²⁻ for anode
        seed: i,
      })),
    [],
  );
  const refs = useRef([]);
  const state = useRef(null);
  const arrivals = useRef(0);
  const clock = useRef(0);
  const elapsed = useRef(0);

  if (!state.current) {
    state.current = ions.map((ion) => ({
      x: (hashRandom(ion.seed + 1) - 0.5) * TANK.w * 0.7,
      y: (hashRandom(ion.seed + 31) - 0.5) * (TANK.h - 1.2),
      z: (hashRandom(ion.seed + 61) - 0.5) * (TANK.d - 0.8),
    }));
  }

  useEffect(() => {
    if (!resetToken) return;
    elapsed.current = 0;
    state.current.forEach((s, i) => {
      s.x = (hashRandom(i + 1) - 0.5) * TANK.w * 0.7;
    });
  }, [resetToken]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    const speed = running ? current * 1.15 * animSpeed : 0;
    const edge = TANK.w / 2 - 1.15;

    ions.forEach((ion, i) => {
      const el = refs.current[i];
      const s = state.current[i];
      if (!el || !s) return;

      s.x += (ion.cation ? -1 : 1) * speed * step;
      s.y += Math.sin((s.x + ion.seed) * 2) * step * 0.24;

      if (ion.cation && s.x <= -edge) {
        if (running) arrivals.current += 1;
        // A copper anode makes a fresh Cu²⁺ for every one that plates out —
        // Cu → Cu²⁺ + 2e⁻ — so the replacement leaves the anode's face. With
        // graphite nothing replaces it; it re-enters from wherever the ions
        // still are, and `cationFraction` below thins them out.
        s.x = fromAnode
          ? anodeX - 0.3 - hashRandom(i + Math.floor(performance.now() / 97)) * 0.35
          : (hashRandom(i + Math.floor(performance.now() / 97)) - 0.5) * TANK.w * 0.55;
      }
      if (!ion.cation && s.x >= edge) {
        s.x = (hashRandom(i + 7 + Math.floor(performance.now() / 89)) - 0.5) * TANK.w * 0.55;
      }
      s.y = clamp(s.y, -TANK.h / 2 + 0.4, TANK.h / 2 - 0.85);
      el.position.set(s.x, s.y, s.z);
      // In the inert cell the Cu²⁺ is used up: draw only the share still in
      // solution, so the ions thin out as the blue fades.
      el.visible = !ion.cation || (i / 2 + 0.5) / (ions.length / 2) <= cationFraction + 1e-6;
    });

    // Run time only advances while the supply is on — that is what makes it
    // the quantity Faraday's laws want.
    if (running) elapsed.current += step * animSpeed;

    clock.current += step;
    if (clock.current >= 0.25) {
      if (arrivals.current > 0) onDeposit(arrivals.current);
      arrivals.current = 0;
      clock.current = 0;
      // Push on the same cadence the rack scenes use, so the HUD re-renders
      // four times a second rather than sixty.
      if (typeof onClock === "function") onClock(Math.round(elapsed.current * 10) / 10);
    }
  });

  return (
    <>
      {ions.map((ion, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          {ion.cation ? <CopperIon position={[0, 0, 0]} /> : <SulfateIon position={[0, 0, 0]} />}
        </group>
      ))}
    </>
  );
}

function ElectronFlow({ path, speed, running, count = 8, animSpeed = 1.0, size = 0.09 }) {
  const meshes = useRef([]);
  const phase = useRef(0);

  const points = useMemo(() => path.map((p) => new THREE.Vector3(...p)), [path]);
  const legs = points.length - 1;
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (running) phase.current = (phase.current + Math.min(delta, 0.05) * speed * animSpeed) % 1;
    for (let i = 0; i < count; i += 1) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const t = (1 - ((phase.current + i / count) % 1)) * legs;
      const leg = Math.min(legs - 1, Math.floor(t));
      scratch.lerpVectors(points[leg], points[leg + 1], t - leg);
      mesh.position.copy(scratch);
    }
  });

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[size, 12, 12]} />
          <meshStandardMaterial
            color={PALETTE.bone}
            emissive={PALETTE.bone}
            emissiveIntensity={2.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

// ─── The apparatus ──────────────────────────────────────────────────

const BENCH_TOP = -TANK.h / 2;
/** Thickness of the tank's glass floor, so it and the liquid sit above the bench top. */
const TANK_BASE = 0.05;
/** The electrolyte fills the tank to a little below its rim. */
const LIQUID_TOP = TANK.h / 2 - 0.45;
const CATHODE_X = -TANK.w / 2 + 1;
const ANODE_X = TANK.w / 2 - 1;
/** Electrode plates: bottom just off the floor, top standing proud of the holder bar. */
const PLATE = { width: 1.1, bottom: BENCH_TOP + 0.35, top: TANK.h / 2 + 0.75 };
const PLATE_H = PLATE.top - PLATE.bottom;
const PLATE_Y = (PLATE.top + PLATE.bottom) / 2;
const HOLDER_Y = TANK.h / 2 + 0.2;
/** Where the crocodile clips bite. */
const CLIP_Y = PLATE.top - 0.12;

/** The bench power supply: a box on the bench beside the tank, turned to face the room. */
const SUPPLY = { w: 2.5, h: 1.45, d: 1.7, x: TANK.w / 2 + 2.4, z: 0.4, turn: -0.42 };
const SUPPLY_Y = BENCH_TOP + SUPPLY.h / 2 + 0.06;
const CURRENT_RANGE = [0.2, 2];
const CASE_MAT = { color: "#d9dee6", roughness: 0.5, metalness: 0.15, emissive: "#d9dee6", emissiveIntensity: 0.08 };
const PANEL_MAT = { color: "#2b3240", roughness: 0.6, metalness: 0.2 };

/** A point on the supply's front panel, in world space. */
function supplyPoint(localX, localY, localZ = SUPPLY.d / 2) {
  const c = Math.cos(SUPPLY.turn);
  const s = Math.sin(SUPPLY.turn);
  return [SUPPLY.x + localX * c + localZ * s, SUPPLY_Y + localY, SUPPLY.z - localX * s + localZ * c];
}
/** Binding posts: black (−) left, red (+) right, as on every bench supply. */
const NEG_POST = [-0.55, -0.42];
const POS_POST = [-0.1, -0.42];

/** A lead from a binding post to a clip, as a smooth sagging curve. */
function leadCurve(post, clipX) {
  const start = supplyPoint(post[0], post[1], SUPPLY.d / 2 + 0.16);
  const out = supplyPoint(post[0], post[1] - 0.05, SUPPLY.d / 2 + 0.55);
  const clip = [clipX, CLIP_Y + 0.28, 0.12];
  const rise = [clipX + (clipX < 0 ? 0.6 : 0.35), CLIP_Y + 1.25, 0.3];
  const mid = [(out[0] + rise[0]) / 2, CLIP_Y + (clipX < 0 ? 1.55 : 0.9), (out[2] + rise[2]) / 2 + 0.3];
  return new THREE.CatmullRomCurve3([start, out, mid, rise, clip].map((p) => new THREE.Vector3(...p)));
}

function Lead({ curve, colour }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.045, 10, false), [curve]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={colour} roughness={0.55} metalness={0.05} emissive={colour} emissiveIntensity={0.12} />
    </mesh>
  );
}

/** A crocodile clip biting the top of an electrode plate, in the lead's colour. */
function CrocClip({ x, colour }) {
  return (
    <group position={[x, CLIP_Y, 0]}>
      {[0.09, -0.09].map((z) => (
        <mesh key={z} position={[0, 0.12, z]} rotation={[z > 0 ? -0.18 : 0.18, 0, 0]}>
          <boxGeometry args={[0.2, 0.34, 0.06]} />
          <meshStandardMaterial color="#c8ced8" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* Insulating boot, coloured to match the lead. */}
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[0.26, 0.2, 0.3]} />
        <meshStandardMaterial color={colour} roughness={0.6} emissive={colour} emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}

/**
 * A bench DC power supply, drawn as one: a light case with a carry handle
 * and vent slots, a dark front panel with a lit current display, a current
 * knob whose pointer follows the slider, a power switch whose lamp shows
 * whether the supply is on, and black (−) and red (+) binding posts.
 */
function PowerSupply({ current, run }) {
  const knob = useRef(null);
  const turn = -2.3 + ((current - CURRENT_RANGE[0]) / (CURRENT_RANGE[1] - CURRENT_RANGE[0])) * 4.6;
  const front = SUPPLY.d / 2;
  return (
    <group position={[SUPPLY.x, SUPPLY_Y, SUPPLY.z]} rotation={[0, SUPPLY.turn, 0]}>
      {/* Case, with rubber feet. */}
      <mesh>
        <boxGeometry args={[SUPPLY.w, SUPPLY.h, SUPPLY.d]} />
        <meshStandardMaterial {...CASE_MAT} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (SUPPLY.w / 2 - 0.22), -SUPPLY.h / 2 - 0.03, sz * (SUPPLY.d / 2 - 0.22)]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
            <meshStandardMaterial color="#1f2731" roughness={0.9} />
          </mesh>
        )),
      )}
      {/* Vent slots on the top and the side. */}
      {Array.from({ length: 7 }, (_, k) => (
        <mesh key={`v${k}`} position={[-0.6 + k * 0.2, SUPPLY.h / 2 + 0.003, -0.25]}>
          <boxGeometry args={[0.08, 0.004, 0.8]} />
          <meshStandardMaterial color="#5b6472" roughness={0.8} />
        </mesh>
      ))}
      {Array.from({ length: 5 }, (_, k) => (
        <mesh key={`s${k}`} position={[SUPPLY.w / 2 + 0.003, 0.25 - k * 0.14, -0.1]}>
          <boxGeometry args={[0.004, 0.05, 0.9]} />
          <meshStandardMaterial color="#5b6472" roughness={0.8} />
        </mesh>
      ))}
      {/* Carry handle. */}
      {[-1, 1].map((sx) => (
        <mesh key={`h${sx}`} position={[sx * 0.75, SUPPLY.h / 2 + 0.14, 0.35]}>
          <boxGeometry args={[0.08, 0.28, 0.08]} />
          <meshStandardMaterial color="#39414d" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, SUPPLY.h / 2 + 0.28, 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, 1.58, 14]} />
        <meshStandardMaterial color="#39414d" roughness={0.5} />
      </mesh>

      {/* Front panel. */}
      <mesh position={[0, 0, front + 0.005]}>
        <boxGeometry args={[SUPPLY.w - 0.16, SUPPLY.h - 0.16, 0.01]} />
        <meshStandardMaterial {...PANEL_MAT} />
      </mesh>
      {/* Current display. */}
      <mesh position={[-0.3, 0.3, front + 0.02]}>
        <boxGeometry args={[1.2, 0.44, 0.02]} />
        <meshStandardMaterial color="#0b1a12" emissive={run ? "#16a34a" : "#0b1a12"} emissiveIntensity={run ? 0.35 : 0} roughness={0.2} />
      </mesh>
      <SceneLabel position={[-0.3, 0.3, front + 0.04]} tone={run ? "text-emerald-300" : "text-ink-500"}>
        {run ? `${current.toFixed(2)} A` : "OFF"}
      </SceneLabel>
      {/* Current knob — its pointer follows the slider. */}
      <group position={[0.72, 0.28, front + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.22, 0.14, 24]} />
          <meshStandardMaterial color="#1f2731" roughness={0.45} metalness={0.3} />
        </mesh>
        <group ref={knob} rotation={[0, turn, 0]}>
          <mesh position={[0, 0.075, 0.12]}>
            <boxGeometry args={[0.035, 0.01, 0.13]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
        </group>
      </group>
      {/* Power switch and its lamp. */}
      <mesh position={[0.72, -0.38, front + 0.03]}>
        <boxGeometry args={[0.24, 0.3, 0.05]} />
        <meshStandardMaterial color="#1f2731" roughness={0.5} />
      </mesh>
      <mesh position={[0.72, -0.12, front + 0.03]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color={run ? "#22c55e" : "#3f1d1d"} emissive={run ? "#22c55e" : "#000000"} emissiveIntensity={run ? 2 : 0} toneMapped={false} />
      </mesh>
      {/* Binding posts. */}
      {[
        { at: NEG_POST, colour: "#1f2229" },
        { at: POS_POST, colour: "#dc2626" },
      ].map(({ at, colour }) => (
        <group key={at[0]} position={[at[0], at[1], front + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.11, 0.12, 0.1, 18]} />
            <meshStandardMaterial color="#c9a24a" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.12, 18]} />
            <meshStandardMaterial color={colour} roughness={0.5} emissive={colour} emissiveIntensity={0.15} />
          </mesh>
        </group>
      ))}
      <SceneLabel position={[NEG_POST[0], NEG_POST[1] - 0.26, front + 0.05]} tone="text-ink-300">
        −
      </SceneLabel>
      <SceneLabel position={[POS_POST[0], POS_POST[1] - 0.26, front + 0.05]} tone="text-rose-300">
        +
      </SceneLabel>
    </group>
  );
}

/** A plate electrode: its core, and whatever copper has plated onto it. */
function ElectrodePlate({ x, thickness, core, coat, coatOpacity = 1 }) {
  return (
    <group position={[x, PLATE_Y, 0]}>
      <mesh>
        <boxGeometry args={[thickness, PLATE_H, PLATE.width]} />
        <meshStandardMaterial {...core} />
      </mesh>
      {coat && coatOpacity > 0.01 && (
        // Plating, on the submerged part only — nothing plates above the surface.
        <mesh position={[0, (PLATE.bottom + LIQUID_TOP) / 2 - PLATE_Y, 0]}>
          <boxGeometry args={[thickness + coat, LIQUID_TOP - PLATE.bottom, PLATE.width + coat]} />
          <meshStandardMaterial
            color={CELL_COLOURS.cathode}
            emissive={CELL_COLOURS.cathode}
            emissiveIntensity={0.35}
            metalness={0.8}
            roughness={0.28}
            transparent={coatOpacity < 1}
            opacity={coatOpacity}
          />
        </mesh>
      )}
    </group>
  );
}

export function ElectrolysisScene({ params = {}, setParam }) {
  const {
    current = 1.0,
    electrode = "copper",
    showLabels = true,
    run = true,
    reset = 0,
    speed = 1.0,
    liveSeconds = 0,
  } = params || {};
  const [deposit, setDeposit] = useState(0);

  // The electrode material decides the ANODE reaction, and everything the
  // scene draws differently follows from that one fact: whether the anode
  // wastes away, whether gas comes off it, and whether the blue survives.
  const material = electrodeFor(electrode);
  const cell = useMemo(
    () => solveElectrolysis({ current, seconds: liveSeconds, running: run, electrode }),
    [current, liveSeconds, run, electrode],
  );

  // Copper cell: the solution is never consumed, so it stays full blue.
  // Inert cell: Cu²⁺ plates out with nothing to replace it, and what is left
  // behind is sulfuric acid — so the blue drains away.
  const solutionColour = useMemo(
    () => new THREE.Color("#0284c7").lerp(new THREE.Color("#cbd5e1"), 1 - cell.blueFraction),
    [cell.blueFraction],
  );
  const pushedSeconds = useRef(-1);

  useEffect(() => {
    if (reset) setDeposit(0);
  }, [reset]);
  // A different pair of electrodes starts clean.
  useEffect(() => setDeposit(0), [electrode]);

  // The scene owns the run clock; the Details panel reads it back out of
  // params and turns it into charge and mass.
  const pushClock = useCallback(
    (seconds) => {
      if (typeof setParam !== "function" || pushedSeconds.current === seconds) return;
      pushedSeconds.current = seconds;
      setParam("liveSeconds", seconds);
    },
    [setParam],
  );

  // How much copper has moved, drawn as thickness: the cathode gains what a
  // copper anode loses. A graphite anode loses nothing.
  const grown = clamp(deposit * 0.0012, 0, 0.26);
  const tank = useMemo(() => new THREE.BoxGeometry(TANK.w, TANK.h, TANK.d), []);
  useEffect(() => () => tank.dispose(), [tank]);

  const negLead = useMemo(() => leadCurve(NEG_POST, CATHODE_X), []);
  const posLead = useMemo(() => leadCurve(POS_POST, ANODE_X), []);
  // Electrons leave the anode, run up the red lead into the supply's + post,
  // are pumped round to its − post, and go down the black lead to the
  // cathode. ElectronFlow walks its path backwards, so the path is written
  // cathode-first. None of them ever cross the solution — ions carry the
  // current there.
  const circuit = useMemo(
    () => [
      ...negLead.getSpacedPoints(26).reverse().map((p) => p.toArray()),
      ...posLead.getSpacedPoints(26).map((p) => p.toArray()),
    ],
    [negLead, posLead],
  );

  const liquidH = LIQUID_TOP - BENCH_TOP - TANK_BASE;
  const graphiteMat = { color: CELL_COLOURS.graphite, emissive: CELL_COLOURS.graphite, emissiveIntensity: 0.12, metalness: 0.15, roughness: 0.85 };
  // Both copper electrodes are the same metal, so they are drawn alike; the
  // anode's darker, duller face is the one being eaten away.
  const copperMat = (colour) => ({ color: colour, emissive: CELL_COLOURS.cathode, emissiveIntensity: 0.35, metalness: 0.8, roughness: 0.3 });

  return (
    <SceneCanvas camera={{ position: [1.7, 3.4, 13.8], fov: 45 }} controls={{ target: [1.7, 0.5, 0] }}>
      {/* Bench. */}
      <mesh position={[1.7, BENCH_TOP - 0.2, 0.2]}>
        <boxGeometry args={[TANK.w + 8.5, 0.4, TANK.d + 3.2]} />
        <meshStandardMaterial color="#8c99ad" roughness={0.75} metalness={0.05} />
      </mesh>

      {/* Glass tank: faint walls, a bright edge, and a thicker lip round the top. */}
      {[
        { pos: [0, 0, TANK.d / 2 + 0.02], rot: [0, 0, 0], w: TANK.w + 0.1, h: TANK.h + 0.05 },
        { pos: [0, 0, -TANK.d / 2 - 0.02], rot: [0, Math.PI, 0], w: TANK.w + 0.1, h: TANK.h + 0.05 },
        { pos: [TANK.w / 2 + 0.02, 0, 0], rot: [0, -Math.PI / 2, 0], w: TANK.d, h: TANK.h + 0.05 },
        { pos: [-TANK.w / 2 - 0.02, 0, 0], rot: [0, Math.PI / 2, 0], w: TANK.d, h: TANK.h + 0.05 },
      ].map((panel, idx) => (
        <mesh key={idx} position={panel.pos} rotation={panel.rot}>
          <planeGeometry args={[panel.w, panel.h]} />
          <meshStandardMaterial
            color="#e0f2fe"
            transparent
            opacity={0.14}
            roughness={0.05}
            metalness={0.2}
            emissive="#7dd3fc"
            emissiveIntensity={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Glass base: a slab resting on the bench, not a plane in it (that z-fought). */}
      <mesh position={[0, BENCH_TOP + TANK_BASE / 2, 0]}>
        <boxGeometry args={[TANK.w + 0.04, TANK_BASE, TANK.d + 0.04]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.22} roughness={0.1} depthWrite={false} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[tank]} />
        <lineBasicMaterial color="#bae6fd" opacity={0.7} transparent />
      </lineSegments>
      {[
        [0, TANK.d / 2 + 0.02, TANK.w + 0.16, 0.06],
        [0, -TANK.d / 2 - 0.02, TANK.w + 0.16, 0.06],
      ].map(([x, z, w, d]) => (
        <mesh key={z} position={[x, TANK.h / 2, z]}>
          <boxGeometry args={[w, 0.07, d]} />
          <meshStandardMaterial color="#e0f2fe" transparent opacity={0.5} roughness={0.1} depthWrite={false} />
        </mesh>
      ))}
      {[TANK.w / 2 + 0.02, -TANK.w / 2 - 0.02].map((x) => (
        <mesh key={x} position={[x, TANK.h / 2, 0]}>
          <boxGeometry args={[0.06, 0.07, TANK.d + 0.1]} />
          <meshStandardMaterial color="#e0f2fe" transparent opacity={0.5} roughness={0.1} depthWrite={false} />
        </mesh>
      ))}
      {/* Graduations up the front-left corner. */}
      {[-1.2, -0.7, -0.2, 0.3, 0.8].map((y, k) => (
        <mesh key={y} position={[-TANK.w / 2 + 0.25 + (k % 2 ? 0 : 0.08), y, TANK.d / 2 + 0.03]}>
          <boxGeometry args={[k % 2 ? 0.25 : 0.4, 0.025, 0.01]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* Electrolyte, filled to below the rim — blue CuSO₄, fading to acid on an inert anode. */}
      <mesh position={[0, BENCH_TOP + TANK_BASE + liquidH / 2, 0]}>
        <boxGeometry args={[TANK.w - 0.02, liquidH, TANK.d - 0.02]} />
        <meshStandardMaterial
          color={solutionColour}
          transparent
          opacity={0.12 + 0.14 * cell.blueFraction}
          depthWrite={false}
          roughness={0.04}
          emissive="#0ea5e9"
          emissiveIntensity={0.15 * cell.blueFraction}
        />
      </mesh>
      <mesh position={[0, LIQUID_TOP, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TANK.w - 0.02, TANK.d - 0.02]} />
        <meshStandardMaterial color={solutionColour} transparent opacity={0.28} roughness={0.02} metalness={0.3} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Electrode holder across the top. */}
      <mesh position={[0, HOLDER_Y, 0]}>
        <boxGeometry args={[TANK.w - 0.6, 0.16, 0.34]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.6} emissive="#e7e5e4" emissiveIntensity={0.06} />
      </mesh>

      {/* Cathode (−). Copper plates onto it either way — onto copper, or as a
          growing coat on graphite. */}
      <ElectrodePlate
        x={CATHODE_X}
        thickness={material.anodeDissolves ? 0.14 + grown : 0.18}
        core={material.anodeDissolves ? copperMat(CELL_COLOURS.cathode) : graphiteMat}
        coat={material.anodeDissolves ? null : 0.02 + grown}
        coatOpacity={material.anodeDissolves ? 0 : clamp(deposit / 12, 0, 1)}
      />
      {/* Copper crystals on the cathode face, more as the run goes on. */}
      {deposit > 0 &&
        Array.from({ length: Math.min(16, Math.floor(deposit / 2) + 2) }).map((_, i) => (
          <mesh
            key={i}
            position={[
              CATHODE_X + 0.1 + grown / 2 + hashRandom(i + 3) * 0.05,
              PLATE.bottom + 0.2 + hashRandom(i + 13) * (LIQUID_TOP - PLATE.bottom - 0.4),
              (hashRandom(i + 23) - 0.5) * PLATE.width * 0.9,
            ]}
            scale={0.06 + hashRandom(i + 31) * 0.05}
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#d97706" emissive="#b45309" emissiveIntensity={0.5} metalness={0.9} roughness={0.15} />
          </mesh>
        ))}

      {/* Anode (+). A copper one wastes away; a graphite one cannot. */}
      <ElectrodePlate
        x={ANODE_X}
        thickness={material.anodeDissolves ? Math.max(0.04, 0.3 - grown) : 0.18}
        core={material.anodeDissolves ? copperMat(CELL_COLOURS.anode) : graphiteMat}
      />

      {/* Oxygen off the inert anode: 2H₂O → O₂ + 4H⁺ + 4e⁻ */}
      {cell.inert && <AnodeGasBubbles x={ANODE_X - 0.16} rate={current} active={run} animSpeed={speed} />}

      {/* Leads, clips and the supply. */}
      <Lead curve={negLead} colour="#1f2229" />
      <Lead curve={posLead} colour="#dc2626" />
      <CrocClip x={CATHODE_X} colour="#1f2229" />
      <CrocClip x={ANODE_X} colour="#dc2626" />
      <PowerSupply current={current} run={run} />
      <ElectronFlow path={circuit} speed={0.1 + current * 0.12} animSpeed={speed} running={run} count={12} size={0.06} />

      <Ions
        current={current}
        running={run}
        resetToken={reset}
        animSpeed={speed}
        anodeX={ANODE_X}
        fromAnode={material.anodeDissolves}
        cationFraction={cell.blueFraction}
        onDeposit={(n) => setDeposit((d) => d + n)}
        onClock={pushClock}
      />

      {showLabels && (
        <>
          {/* Hung under the tank's front edge, clear of the leads above. */}
          <SceneLabel position={[CATHODE_X, BENCH_TOP - 0.45, TANK.d / 2]} tone="text-sky-300">
            {`cathode (−) · gains Cu · ${material.cathode}`}
          </SceneLabel>
          <SceneLabel position={[ANODE_X, BENCH_TOP - 0.45, TANK.d / 2]} accent>
            {`anode (+) · ${material.anodeDissolves ? "wastes away" : "unchanged · gives O₂"} · ${material.anode}`}
          </SceneLabel>
          <SceneLabel position={[SUPPLY.x, SUPPLY_Y + SUPPLY.h / 2 + 0.7, SUPPLY.z]} tone="text-ink-300">
            DC power supply
          </SceneLabel>
        </>
      )}
    </SceneCanvas>
  );
}

// ═══ 6 · VSEPR molecular geometry ════════════════════════════════════

// The domain directions, the measured angles and the solver live in
// lib/vsepr.js, so the Details panel names the same shape this scene draws.

/** One colour per distinct angle, so a seesaw's three read apart. */
const ANGLE_COLOURS = [PALETTE.gold, PALETTE.sky, PALETTE.rose];

/** Any unit vector at right angles to `dir`. */
function perpendicularTo(dir) {
  const helper = Math.abs(dir.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(dir, helper).normalize();
}

/**
 * A lone pair as the orbital it is: a teardrop lobe, pinched at the nucleus
 * and fattest out where the pair spends its time, with its two electrons
 * circling inside. Its bulk close to the atom is why it squeezes the bonds.
 */
function LonePairLobe({ dir, length }) {
  const lobe = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 32; i += 1) {
      const t = i / 32;
      pts.push(new THREE.Vector2(0.44 * Math.sin(Math.PI * t ** 1.6), t * length));
    }
    return new THREE.LatheGeometry(pts, 40);
  }, [length]);
  useEffect(() => () => lobe.dispose(), [lobe]);
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir), [dir]);
  const pair = useRef();
  useFrame((_, dt) => {
    if (pair.current) pair.current.rotation.y += dt * 1.4;
  });

  return (
    <group quaternion={quaternion}>
      <mesh geometry={lobe}>
        <meshStandardMaterial
          color={PALETTE.violet}
          emissive={PALETTE.violet}
          emissiveIntensity={0.45}
          transparent
          opacity={0.3}
          roughness={0.2}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* A brighter core, so the lobe reads as a cloud densest at its middle. */}
      <mesh geometry={lobe} scale={[0.55, 0.9, 0.55]} position={[0, length * 0.05, 0]}>
        <meshBasicMaterial color={PALETTE.violet} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group ref={pair} position={[0, length * 0.64, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.15, 0, 0]}>
            <sphereGeometry args={[0.065, 14, 14]} />
            <meshStandardMaterial color="#ede9fe" emissive={PALETTE.violet} emissiveIntensity={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** An arc between two bonds, at radius r from the centre, labelled with its angle. */
function AngleArc({ a, b, value, colour, radius, labelRadius }) {
  const { points, labelAt } = useMemo(() => {
    let axis = new THREE.Vector3().crossVectors(a, b);
    // A straight 180° pair has no plane of its own; any perpendicular will do.
    axis = axis.lengthSq() < 1e-8 ? perpendicularTo(a) : axis.normalize();
    const total = (value * Math.PI) / 180;
    const pts = [];
    for (let i = 0; i <= 40; i += 1) {
      pts.push(a.clone().applyAxisAngle(axis, (total * i) / 40).multiplyScalar(radius));
    }
    const mid = a.clone().applyAxisAngle(axis, total / 2);
    return { points: pts, labelAt: mid.multiplyScalar(labelRadius).toArray() };
  }, [a, b, value, radius, labelRadius]);

  return (
    <group>
      <Line points={points} color={colour} lineWidth={2.2} transparent opacity={0.95} />
      <ChemLabel position={labelAt} tone="text-ink-100">
        <span style={{ color: colour }}>{value.toFixed(1)}°</span>
      </ChemLabel>
    </group>
  );
}

/** A bond drawn with its order: one rod, two for a double, a solid and a faint one for 1.5. */
function OrderedBond({ end, order, colour }) {
  if (order < 1.5) return <Bond from={[0, 0, 0]} to={end.toArray()} radius={0.085} color={colour} />;
  const side = perpendicularTo(end.clone().normalize()).multiplyScalar(0.1);
  return (
    <>
      <Bond from={side.toArray()} to={end.clone().add(side).toArray()} radius={0.055} color={colour} />
      <Bond
        from={side.clone().negate().toArray()}
        to={end.clone().sub(side).toArray()}
        radius={0.055}
        color={colour}
        opacity={order < 2 ? 0.4 : 1}
      />
    </>
  );
}

export function VseprScene({ params = {} }) {
  const {
    preset,
    bonding = 4,
    lone = 0,
    bondLength = 1.9,
    showLonePairs = true,
    showAngles = true,
    spin = true,
    speed = 1.0,
    showLabels = true,
  } = params || {};

  // One solve, shared with the Details panel.
  const solved = useMemo(() => solveVsepr(bonding, lone, preset), [bonding, lone, preset]);
  const { geometry, molecule } = solved;

  // A real molecule is drawn in its elements' colours; the bare AXₙEₘ shapes
  // with no molecule behind them keep the generic gold centre and sky atoms.
  const centreStyle = molecule ? ELEMENT_STYLE[molecule.centre] : { colour: PALETTE.gold, radius: 0.52 };
  const ligandStyle = molecule ? ELEMENT_STYLE[molecule.ligand] : { colour: PALETTE.sky, radius: 0.34 };
  const order = molecule?.order ?? 1;
  const arcRadius = centreStyle.radius + 0.32;
  // The central atom's name goes in the emptiest direction, clear of every
  // bond and lone pair (straight down lands inside BrF₅'s lone pair).
  const nameAt = useMemo(() => {
    const domains = [...geometry.bonds, ...geometry.lonePairs];
    const candidates = [[0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, -0.7, 0.7], [0.7, -0.7, 0], [-0.7, -0.7, 0]].map(
      (c) => new THREE.Vector3(...c).normalize(),
    );
    const clearance = (c) => Math.min(...domains.map((d) => c.angleTo(d)), Math.PI);
    const best = candidates.reduce((pick, c) => (clearance(c) > clearance(pick) + 1e-3 ? c : pick));
    return best.multiplyScalar(centreStyle.radius + 0.4).toArray();
  }, [geometry, centreStyle.radius]);

  return (
    <SceneCanvas camera={{ position: [0, 1.8, 7.4], fov: 45 }} controls={{ autoRotate: spin, autoRotateSpeed: 0.8 * speed }}>
      <LabelsOn.Provider value={showLabels !== false}>
      <AtomSphere position={[0, 0, 0]} radius={centreStyle.radius} color={centreStyle.colour} emissiveIntensity={0.5} />
      <Halo position={[0, 0, 0]} radius={centreStyle.radius + 0.38} color={centreStyle.colour} opacity={0.08} />
      <ChemLabel position={nameAt} accent>
        {molecule ? `${molecule.centre} · central atom` : "central atom"}
      </ChemLabel>

      {geometry.bonds.map((dir, i) => {
        const end = dir.clone().multiplyScalar(bondLength);
        return (
          <group key={`b${i}`}>
            <OrderedBond end={end} order={order} colour={VSEPR_BOND_COLOUR} />
            <AtomSphere position={end.toArray()} radius={ligandStyle.radius} color={ligandStyle.colour} emissiveIntensity={0.35} />
          </group>
        );
      })}

      {showLonePairs &&
        geometry.lonePairs.map((dir, i) => <LonePairLobe key={`l${i}`} dir={dir} length={bondLength * 0.95} />)}

      {showAngles &&
        geometry.angles.map((angle, k) => (
          <AngleArc
            key={`a${k}`}
            a={geometry.bonds[angle.i]}
            b={geometry.bonds[angle.j]}
            value={angle.value}
            colour={ANGLE_COLOURS[k % ANGLE_COLOURS.length]}
            radius={arcRadius + k * 0.12}
            // Staggered outwards: a seesaw's 101.6° and 173.1° share a bisector.
            labelRadius={arcRadius + 0.45 + k * 0.55}
          />
        ))}
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}

// ═══ 7 · Reaction energy profile ═════════════════════════════════════

const PROFILE_SAMPLES = 160;
const PROFILE_HALF = 5;
/**
 * kJ/mol → world units.
 *
 * Sized from the worst case the sliders can reach, not from a comfortable
 * one. B34: at 0.028 an Ea of 160 kJ/mol put the summit at y = 4.48 with its
 * label at 4.98, and the usable top of the frustum at the z = 0 plane is
 * about 4.3 — the camera sits at y = 1.2 looking at the origin, so it is
 * pitched down and the top edge reaches lower than the half-height alone
 * suggests. The transition state, which is the whole subject of the diagram,
 * was drawn off the top of the screen.
 *
 * 160 × 0.023 = 3.68, and the label clears at 4.18. The scale stays CONSTANT
 * across every slider position on purpose: two profiles are only worth
 * comparing if a centimetre means the same number of kJ in both.
 */
const ENERGY_SCALE = 0.023;

/**
 * Energy against reaction coordinate: a sigmoid step from reactants to
 * products, plus a Gaussian hump of height `bump` for the transition state.
 */
function energyAt(x, bump, deltaH) {
  const step = 0.5 * (1 + Math.tanh(3 * x));
  return deltaH * step + bump * Math.exp(-Math.pow(x / 0.42, 2));
}

/**
 * Height of the Gaussian needed for the curve's true summit to sit exactly Ea
 * above the reactants.
 *
 * Setting it to Ea − ΔH/2 only makes E(0) equal Ea, and E(0) is not the
 * maximum: the sigmoid is still climbing there, so the real summit sits off
 * to one side and overshot the Ea arrow by a visible few percent. Bisecting on
 * the bump height puts the drawn peak where the panel says it is.
 */
function barrierAmplitude(activation, deltaH) {
  const summit = (bump) => {
    let peak = -Infinity;
    for (let i = 0; i <= 240; i += 1) {
      const x = -1.2 + (2.4 * i) / 240;
      peak = Math.max(peak, energyAt(x, bump, deltaH));
    }
    return peak;
  };
  let lo = 0;
  let hi = Math.max(activation * 2 + Math.abs(deltaH) + 20, 40);
  for (let i = 0; i < 44; i += 1) {
    const mid = (lo + hi) / 2;
    if (summit(mid) < activation) lo = mid;
    else hi = mid;
  }
  return lo;
}

function profilePoints(bump, deltaH, z = 0) {
  const pts = [];
  for (let i = 0; i <= PROFILE_SAMPLES; i += 1) {
    const t = i / PROFILE_SAMPLES;
    const x = -1 + 2 * t;
    pts.push([x * PROFILE_HALF, energyAt(x, bump, deltaH) * ENERGY_SCALE, z]);
  }
  return pts;
}

/** Rolls a marker along the profile so the barrier reads as something to climb. */
function ReactionMarker({ bump, deltaH, crosses, speed }) {
  const marker = useRef(null);
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.05) * speed;
    let x;
    if (crosses) {
      // A full pass, then a pause on the product side before resetting.
      const cycle = clock.current % 5;
      x = cycle < 3.4 ? -1 + (2 * cycle) / 3.4 : 1;
    } else {
      // Not enough energy: it rattles in the reactant well and falls back.
      x = -0.72 + 0.28 * Math.sin(clock.current * 1.6);
    }
    if (marker.current) {
      marker.current.position.set(
        x * PROFILE_HALF,
        energyAt(x, bump, deltaH) * ENERGY_SCALE + 0.17,
        0,
      );
    }
  });

  return (
    <mesh ref={marker}>
      <sphereGeometry args={[0.17, 22, 22]} />
      <meshStandardMaterial
        color={crosses ? PALETTE.emerald : PALETTE.rose}
        emissive={crosses ? PALETTE.emerald : PALETTE.rose}
        emissiveIntensity={1.5}
        toneMapped={false}
      />
    </mesh>
  );
}

export function EnergyProfileScene({ params = {} }) {
  const {
    activation = 90,
    deltaH = -60,
    catalyst = false,
    catalystDrop = 35,
    temperature = 350,
    spin = false,
    speed = 1.0,
    showLabels = true,
  } = params || {};

  // One solve, shared with the Details panel.
  const e = useMemo(
    () => solveEnergetics({ activation, deltaH, catalyst, catalystDrop, temperature }),
    [activation, deltaH, catalyst, catalystDrop, temperature],
  );
  const { exothermic, uncatalysed, effectiveEa, reverseEa, clampedByDeltaH } = e;

  const bump = useMemo(() => barrierAmplitude(effectiveEa, deltaH), [effectiveEa, deltaH]);
  const baseBump = useMemo(
    () => (catalyst ? barrierAmplitude(uncatalysed, deltaH) : null),
    [catalyst, uncatalysed, deltaH],
  );

  const main = useMemo(() => profilePoints(bump, deltaH), [bump, deltaH]);
  const original = useMemo(
    () => (baseBump === null ? null : profilePoints(baseBump, deltaH, -0.01)),
    [baseBump, deltaH],
  );

  const { fraction, speedUp, rateConstant, proceeds } = e;

  const peakY = effectiveEa * ENERGY_SCALE;
  const productY = deltaH * ENERGY_SCALE;
  // The summit slides toward whichever side sits higher (endothermic peaks lie
  // late, exothermic early), so the labels follow the drawn peak, not x = 0.
  const peakX = main.reduce((best, p) => (p[1] > best[1] ? p : best), main[0])[0];

  // Axes framing everything the sliders can reach at this ΔH.
  const top = Math.max(peakY, uncatalysed * ENERGY_SCALE) + 0.9;
  const bottom = Math.min(0, productY) - 0.7;
  const axisX = -PROFILE_HALF - 0.9;
  const axisEnd = PROFILE_HALF + 1.1;
  const eaX = peakX - 1.35;
  const reverseX = peakX + 1.35;
  const deltaX = PROFILE_HALF - 0.6;

  return (
    <SceneCanvas camera={{ position: [0, 1.2, 10.5], fov: 45 }} controls={{ autoRotate: spin, autoRotateSpeed: 0.45 * speed }}>
      <LabelsOn.Provider value={showLabels !== false}>
      <CameraDolly width={axisEnd - axisX + 2.4} height={2 * Math.max(top, -bottom) + 0.6} />

      {/* Axes: energy up the side, progress of the reaction along the bottom. */}
      <VectorArrow from={[axisX, bottom, 0]} to={[axisX, top, 0]} color={PALETTE.bone} radius={0.022} headLength={0.24} headRadius={0.09} />
      <VectorArrow from={[axisX, bottom, 0]} to={[axisEnd, bottom, 0]} color={PALETTE.bone} radius={0.022} headLength={0.24} headRadius={0.09} />
      <ChemLabel position={[axisX, top + 0.4, 0]} tone="text-ink-200">
        energy (kJ/mol)
      </ChemLabel>
      <ChemLabel position={[0, bottom - 0.4, 0]} tone="text-ink-200">
        progress of reaction →
      </ChemLabel>

      {/* Reactant and product levels, extended as guides for reading ΔH off. */}
      <Line points={[[axisX, 0, 0], [PROFILE_HALF + 0.6, 0, 0]]} color={PALETTE.line} lineWidth={1.2} dashed dashSize={0.14} gapSize={0.12} />
      <Line
        points={[[-PROFILE_HALF, productY, 0], [PROFILE_HALF + 0.6, productY, 0]]}
        color={PALETTE.line}
        lineWidth={1.2}
        dashed
        dashSize={0.14}
        gapSize={0.12}
      />
      {/* The summit's level, carried across to both activation arrows. */}
      <Line points={[[eaX, peakY, 0], [reverseX, peakY, 0]]} color={PALETTE.line} lineWidth={1} dashed dashSize={0.1} gapSize={0.1} />

      {original && <Line points={original} color={PALETTE.slate} lineWidth={2} dashed dashSize={0.18} gapSize={0.14} />}
      <Line points={main} color={catalyst ? PALETTE.emerald : PALETTE.gold} lineWidth={3.4} />

      <ReactionMarker bump={bump} deltaH={deltaH} crosses={proceeds} speed={params.speed ?? 1} />

      {/* Activation energy, measured from the reactant level to the peak. */}
      <VectorArrow
        from={[eaX, 0, 0]}
        to={[eaX, peakY, 0]}
        color={PALETTE.rose}
        radius={0.035}
        headLength={0.22}
        headRadius={0.1}
      />
      {/* …and the reverse reaction's, from the product level to the same peak. */}
      <VectorArrow
        from={[reverseX, productY, 0]}
        to={[reverseX, peakY, 0]}
        color={PALETTE.rose}
        radius={0.025}
        headLength={0.2}
        headRadius={0.08}
        opacity={0.55}
      />
      <VectorArrow
        from={[deltaX, 0, 0]}
        to={[deltaX, productY, 0]}
        color={exothermic ? PALETTE.emerald : PALETTE.violet}
        radius={0.035}
        headLength={0.22}
        headRadius={0.1}
      />
      {/* Arrow values sit beside each arrow's middle, clear of the summit label;
          an arrow too short to hold one gets it just under the reactant line. */}
      <ChemLabel position={[eaX - 0.62, peakY < 0.8 ? -0.35 : peakY / 2, 0]} tone="text-rose-300">
        Ea {effectiveEa.toFixed(0)}
      </ChemLabel>
      <ChemLabel position={[reverseX + 0.85, (peakY + productY) / 2, 0]} tone="text-rose-300">
        Ea rev {reverseEa.toFixed(0)}
      </ChemLabel>
      <ChemLabel position={[deltaX + 0.75, Math.abs(productY) < 0.8 ? Math.min(0, productY) - 0.35 : productY / 2, 0]} tone={exothermic ? "text-emerald-300" : "text-violet-300"}>
        ΔH {deltaH > 0 ? "+" : ""}{deltaH.toFixed(0)}
      </ChemLabel>

      <ChemLabel position={[-PROFILE_HALF + 0.4, 0.42, 0]} tone="text-ink-300">
        reactants
      </ChemLabel>
      {/* Below the level when it drops, above and further out when it rises, clear of Ea rev. */}
      <ChemLabel position={deltaH <= 0 ? [PROFILE_HALF - 2.2, productY - 0.36, 0] : [PROFILE_HALF + 0.35, productY + 0.4, 0]} tone="text-ink-300">
        products
      </ChemLabel>
      <ChemLabel position={[peakX, peakY + 0.5, 0]} accent>
        transition state
      </ChemLabel>
      <ChemLabel position={[axisEnd - 1.2, top + 0.4, 0]} tone={exothermic ? "text-emerald-300" : "text-violet-300"}>
        {exothermic ? "exothermic · energy released" : deltaH > 0 ? "endothermic · energy absorbed" : "thermoneutral"}
      </ChemLabel>
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────

const SCENES = {
  bohr: BohrAtomScene,
  organic: OrganicBuilderScene,
  distillation: DistillationScene,
  lattice: CrystalLatticeScene,
  electrolysis: ElectrolysisScene,
  vsepr: VseprScene,
  energetics: EnergyProfileScene,
  reactivity_series: ReactivitySeriesCanvas,
  rusting_galvanic: RustingGalvanicCanvas,
  separation_techniques: SeparationTechniquesCanvas,
  combustion_fire_triangle: CombustionFireTriangleCanvas,
  particle_model_matter: ParticleModelMatterCanvas,
  radioactive_decay: RadioactiveDecayCanvas,
};

export default function ChemistryCanvas({ topicId, params, setParam, onOpenQuiz }) {
  const Scene = SCENES[topicId];
  if (!Scene) return null;
  return <Scene params={params} setParam={setParam} onOpenQuiz={onOpenQuiz} />;
}
