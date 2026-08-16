"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  AtomSphere,
  Bond,
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  circlePoints,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";

// Chemistry is written in subscripts everywhere except, until now, here —
// "C3H8" on screen next to CₙH₂ₙ₊₂ in the same panel reads as a typo.
const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n) => (n <= 1 ? "" : String(n).replace(/\d/g, (d) => SUBSCRIPTS[Number(d)]));

// ─── IGCSE Chemistry · five scenes ──────────────────────────────────
// Atomic structure, organic molecules, fractional distillation, giant
// lattices and electrolysis.
// ─────────────────────────────────────────────────────────────────────

// ═══ 6 · Bohr atom & electron shells ═════════════════════════════════

const SHELL_NAMES = ["K", "L", "M", "N"];
// The 2, 8, 8 rule taught for the first twenty elements — not full 2n².
const SHELL_CAPACITY = [2, 8, 8, 2];

export const ELEMENTS = {
  H: {
    symbol: "H",
    name: "Hydrogen",
    protons: 1,
    neutrons: 0,
    shells: [1],
    group: "1",
    bonding: "One electron short of a full K shell — shares a pair to form H₂ or HCl.",
  },
  C: {
    symbol: "C",
    name: "Carbon",
    protons: 6,
    neutrons: 6,
    shells: [2, 4],
    group: "4",
    bonding: "Four valence electrons, so it shares all four in covalent bonds (CH₄, CO₂).",
  },
  Na: {
    symbol: "Na",
    name: "Sodium",
    protons: 11,
    neutrons: 12,
    shells: [2, 8, 1],
    group: "1",
    bonding: "Loses its single outer electron to form Na⁺, exposing a full shell beneath.",
  },
  Cl: {
    symbol: "Cl",
    name: "Chlorine",
    protons: 17,
    neutrons: 18,
    shells: [2, 8, 7],
    group: "7",
    bonding: "Gains one electron to complete its outer shell, forming Cl⁻.",
  },
};

const shellRadius = (i) => 1.7 + i * 1.15;
const shellTilt = (i) => [i * 0.5 + 0.18, i * 0.95, i * 0.3];

function Nucleus({ protons, neutrons, spin }) {
  const group = useRef(null);
  const total = protons + neutrons;

  const nucleons = useMemo(() => {
    const radius = 0.3 * Math.cbrt(total);
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

    return kinds.map((proton, i) => {
      if (total === 1) return { position: [0, 0, 0], proton };
      const y = 1 - (i / (total - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const shrink = Math.cbrt((i + 0.5) / total); // solid packing, not a shell
      return {
        position: [
          Math.cos(theta) * ring * radius * shrink,
          y * radius * shrink,
          Math.sin(theta) * ring * radius * shrink,
        ],
        proton,
      };
    });
  }, [protons, neutrons, total]);

  useFrame((_, delta) => {
    if (spin && group.current) {
      group.current.rotation.y += delta * 0.28;
      group.current.rotation.x += delta * 0.11;
    }
  });

  const size = total === 1 ? 0.32 : 0.24;

  return (
    <group ref={group}>
      {nucleons.map((n, i) => (
        <AtomSphere
          key={i}
          position={n.position}
          radius={size}
          color={n.proton ? PALETTE.rose : "#8a92a0"}
          emissiveIntensity={n.proton ? 0.5 : 0.25}
        />
      ))}
      <Halo radius={0.3 * Math.cbrt(total) + 0.5} color={PALETTE.rose} />
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
  const colour = glow ? PALETTE.gold : PALETTE.sky;

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
          color={glow ? PALETTE.gold : "#38bdf8"}
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
      camera={{ position: [0, 3.2, 10.5], fov: 45 }}
      controls={{ autoRotate: params.spin !== false, autoRotateSpeed: 0.45, minDistance: 3.5 }}
      onPointerMissed={() => setFocused(null)}
    >
      <pointLight position={[0, 0, 0]} color={PALETTE.rose} intensity={12} distance={4} />
      <Nucleus protons={element.protons} neutrons={element.neutrons} spin={spinNucleus} />

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

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title={element.name}
        subtitle={`Shells fill 2, then 8, then 8 — ${element.shells.join(",")}`}
        rows={[
          ["Proton number Z", element.protons, "gold"],
          ["Neutrons", element.neutrons],
          ["Mass number A", element.protons + element.neutrons],
          ["Electrons", element.protons],
          ["Configuration", element.shells.join(", "), "gold"],
          [
            "Outer shell",
            `${valence} of ${SHELL_CAPACITY[outer]}`,
            valence === SHELL_CAPACITY[outer] ? "good" : "bad",
          ],
          ["Group / Period", `${element.group} / ${element.shells.length}`],
        ]}
        note={element.bonding}
        noteTone={valence === SHELL_CAPACITY[outer] ? "good" : "neutral"}
      />

      <SceneLegend
        title="Key"
        items={[
          { color: PALETTE.rose, label: "Proton", note: `positive · ${element.protons} of them` },
          { color: "#8a92a0", label: "Neutron", note: `neutral · ${element.neutrons} of them` },
          { color: PALETTE.sky, label: "Electron in an inner shell", note: "full, and unreactive" },
          {
            color: highlightValence ? PALETTE.gold : PALETTE.sky,
            label: "Valence electron",
            note: highlightValence
              ? "the outer shell — where all the chemistry happens"
              : "turn on “Highlight valence shell” to pick these out",
          },
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 7 · Organic chemistry & isomer builder ══════════════════════════

const ATOM_STYLE = {
  C: { radius: 0.34, color: "#475569" },
  H: { radius: 0.2, color: PALETTE.bone },
  O: { radius: 0.32, color: PALETTE.rose },
};

const CHAIN_NAMES = [
  "meth", "eth", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec", "undec", "dodec",
];
const ALKANE_NAMES = CHAIN_NAMES.map((p) => `${p}ane`);
const ALKENE_NAMES = ["—", ...CHAIN_NAMES.slice(1).map((p) => `${p}ene`)];
const ALKYNE_NAMES = ["—", ...CHAIN_NAMES.slice(1).map((p) => `${p}yne`)];
const ALCOHOL_NAMES = CHAIN_NAMES.map((p) => `${p}anol`);
const ACID_NAMES   = CHAIN_NAMES.map((p) => `${p}anoic acid`);
const ESTER_NAMES  = [
  "methyl methanoate", "methyl ethanoate", "ethyl methanoate",
  "ethyl ethanoate", "propyl methanoate", "methyl propanoate",
  "propyl ethanoate", "butyl methanoate", "ethyl propanoate",
  "methyl butanoate", "propyl propanoate", "butyl ethanoate",
];

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

  const atoms = [];
  const bonds = [];
  const chain = [];

  const isAlkyne       = family === "alkyne"        && n >= 2;
  const isAlkeneChain  = family === "alkene"        && n >= 2;
  const isAcid         = family === "acid";
  const isEster        = family === "ester";

  // Alkynes are linear (sp hybridisation) at the triple bond: place C1 and C2
  // along X, then zig-zag the rest normally.
  const rise = CC_BOND * CHAIN_Y * 0.5;

  let x = 0;
  for (let i = 0; i < n; i += 1) {
    if (i > 0) {
      const L =
        isAlkeneChain && i === 1 ? CC_DOUBLE :
        isAlkyne       && i === 1 ? CC_TRIPLE :
        CC_BOND;
      x += L * CHAIN_X;
    }
    // Alkynes: first two carbons are on the same y because sp is linear.
    const y = (isAlkyne && i < 2) ? 0 : (i % 2 === 0 ? rise : -rise);
    chain.push(new THREE.Vector3(x, y, 0));
  }
  // Centre the finished chain.
  const midX = (chain[0].x + chain[n - 1].x) / 2;
  chain.forEach((p, i) => {
    p.x -= midX;
    atoms.push({ el: "C", position: p.toArray(), index: i });
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
    atoms.push({ el: "O", position: oxygen.toArray() });
    bonds.push({ from: chain[0].toArray(), to: oxygen.toArray() });

    const hDir = new THREE.Vector3(-0.9, 0, 0.42).normalize();
    const hPos = oxygen.clone().addScaledVector(hDir, 0.98);
    atoms.push({ el: "H", position: hPos.toArray() });
    bonds.push({ from: oxygen.toArray(), to: hPos.toArray() });
  }

  // –COOH group: terminal carbon already in chain; add =O (carbonyl) and –OH.
  let acidCarbonyl = null;
  let acidHydroxyl = null;
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
    acidHydroxyl = ohOxy;
    atoms.push({ el: "O", position: ohOxy.toArray() });
    bonds.push({ from: end.toArray(), to: ohOxy.toArray() });

    const hDir = new THREE.Vector3(-0.9, 0, 0.42).normalize();
    const hPos = ohOxy.clone().addScaledVector(hDir, 0.96);
    atoms.push({ el: "H", position: hPos.toArray() });
    bonds.push({ from: ohOxy.toArray(), to: hPos.toArray() });
  }

  // Ester: –COO– bridge — place an extra oxygen between C1 and a separate
  // methyl/ethyl group to the left of the chain.
  if (isEster) {
    const end = chain[0];
    // Carbonyl =O
    const coDir = new THREE.Vector3(-0.5, end.y > 0 ? 1.1 : -1.1, 0).normalize();
    const carbonyl = end.clone().addScaledVector(coDir, CD_BOND);
    atoms.push({ el: "O", position: carbonyl.toArray() });
    bonds.push({ from: end.toArray(), to: carbonyl.toArray(), double: true });
    // Ester bridge –O–
    const bDir = new THREE.Vector3(-1, 0, 0).normalize();
    const bridgeO = end.clone().addScaledVector(bDir, CO_BOND * 1.05);
    atoms.push({ el: "O", position: bridgeO.toArray() });
    bonds.push({ from: end.toArray(), to: bridgeO.toArray() });
    // Methyl / ethyl R-group hanging off the bridge oxygen
    const rC1 = bridgeO.clone().addScaledVector(bDir, CC_BOND);
    atoms.push({ el: "C", position: rC1.toArray() });
    bonds.push({ from: bridgeO.toArray(), to: rC1.toArray() });
    // 3 hydrogens on the R-methyl
    const rAway = bDir.clone();
    const rSide = new THREE.Vector3(0, 1, 0);
    const rUp   = new THREE.Vector3(0, 0, 1);
    [0, 1, 2].forEach((k) => {
      const phi = (k / 3) * Math.PI * 2;
      const hd = rAway.clone()
        .addScaledVector(rSide, Math.cos(phi) * SPREAD_TETRA_3)
        .addScaledVector(rUp,   Math.sin(phi) * SPREAD_TETRA_3)
        .normalize();
      const hp = rC1.clone().addScaledVector(hd, CH_BOND);
      atoms.push({ el: "H", position: hp.toArray() });
      bonds.push({ from: rC1.toArray(), to: hp.toArray() });
    });
  }

  // Hydrogens fill whatever bonding capacity each carbon has left.
  for (let i = 0; i < n; i += 1) {
    const centre = chain[i];
    const neighbours = [];
    if (i > 0) neighbours.push(chain[i - 1]);
    if (i < n - 1) neighbours.push(chain[i + 1]);
    if (isAlcohol && i === 0 && oxygen) neighbours.push(oxygen);
    if (isAcid    && i === 0) continue; // –COOH carbon handled in group above
    if (isEster   && i === 0) continue; // ester terminal carbon handled above

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

  const valid = !(family === "alkene" && n < 2) && !(family === "alkyne" && n < 2);
  const hCount = atoms.filter((a) => a.el === "H").length;
  const oCount = atoms.filter((a) => a.el === "O").length;
  const cCount = atoms.filter((a) => a.el === "C").length;

  let formula = "—";
  let name = "—";
  if (valid) {
    if (isAlcohol)       { formula = `C${sub(n)}H${sub(hCount - 1)}OH`; }
    else if (isAcid)     { formula = `C${sub(cCount)}H${sub(hCount)}O${sub(oCount)}`; }
    else if (isEster)    { formula = `C${sub(cCount)}H${sub(hCount)}O${sub(oCount)}`; }
    else                 { formula = `C${sub(n)}H${sub(hCount)}`; }

    if      (family === "alkene")  name = ALKENE_NAMES[n - 1]  || `C${n} alkene`;
    else if (family === "alkyne")  name = ALKYNE_NAMES[n - 1]  || `C${n} alkyne`;
    else if (family === "alcohol") name = ALCOHOL_NAMES[n - 1] || `C${n} alcohol`;
    else if (family === "acid")    name = ACID_NAMES[n - 1]    || `C${n} acid`;
    else if (family === "ester")   name = ESTER_NAMES[n - 1]   || `C${n} ester`;
    else                           name = ALKANE_NAMES[n - 1]  || `C${n} alkane`;
  } else {
    name = "needs 2+ carbons for this series";
  }

  return { atoms, bonds, formula, name, valid };
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

function Molecule({ family, carbons, crackToken, spin }) {
  const group = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const breakingRef = useRef(null);
  const split = useRef(0);
  const target = useRef(0);

  const molecule = useMemo(() => buildMolecule(family, carbons), [family, carbons]);

  // Cracking only makes sense for an alkane long enough to break in two.
  const crackable = family === "alkane" && carbons >= 3;

  /**
   * Split the molecule after the first carbon and pre-partition it, so the
   * animation is two group transforms per frame rather than a re-render.
   */
  const fragments = useMemo(() => {
    const pivot = molecule.atoms.find((a) => a.el === "C" && a.index === 0);
    const cut = pivot ? pivot.position[0] + 0.75 : 0;
    const sideOf = (p) => (p[0] < cut ? "left" : "right");
    return {
      left: {
        atoms: molecule.atoms.filter((a) => sideOf(a.position) === "left"),
        bonds: molecule.bonds.filter(
          (b) => sideOf(b.from) === "left" && sideOf(b.to) === "left",
        ),
      },
      right: {
        atoms: molecule.atoms.filter((a) => sideOf(a.position) === "right"),
        bonds: molecule.bonds.filter(
          (b) => sideOf(b.from) === "right" && sideOf(b.to) === "right",
        ),
      },
      breaking: molecule.bonds.filter((b) => sideOf(b.from) !== sideOf(b.to)),
    };
  }, [molecule]);

  useEffect(() => {
    if (!crackToken || !crackable) return undefined;
    target.current = 1;
    const id = setTimeout(() => {
      target.current = 0;
    }, 2600);
    return () => clearTimeout(id);
  }, [crackToken, crackable]);

  useFrame((_, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.35;
    split.current = lerp(split.current, target.current, Math.min(1, delta * 2.4));
    const offset = crackable ? split.current * 1.7 : 0;
    if (leftRef.current) leftRef.current.position.x = -offset;
    if (rightRef.current) rightRef.current.position.x = offset;
    if (breakingRef.current) breakingRef.current.visible = split.current < 0.05;
  });

  return (
    <group ref={group}>
      <group ref={leftRef}>
        <AtomsAndBonds atoms={fragments.left.atoms} bonds={fragments.left.bonds} />
      </group>
      <group ref={rightRef}>
        <AtomsAndBonds atoms={fragments.right.atoms} bonds={fragments.right.bonds} />
      </group>
      <group ref={breakingRef}>
        <AtomsAndBonds atoms={[]} bonds={fragments.breaking} />
      </group>
    </group>
  );
}

export function OrganicBuilderScene({ params = {} }) {
  const { family = "alkane", carbons = 3, crack = 0, spin = true } = params || {};
  const molecule = useMemo(() => buildMolecule(family, carbons), [family, carbons]);
  const crackable = family === "alkane" && carbons >= 3;

  const generalFormula = {
    alkane:  "CₙH₂ₙ₊₂",
    alkene:  "CₙH₂ₙ",
    alkyne:  "CₙH₂ₙ₋₂",
    alcohol: "CₙH₂ₙ₊₁OH",
    acid:    "CₙH₂ₙO₂ (RCOOH)",
    ester:   "RCOO–R′",
  }[family] ?? "";

  const saturated = ["alkane", "alcohol", "acid", "ester"].includes(family);
  const hasBondFeature = ["alkene", "alkyne"].includes(family);

  const readoutNote = !molecule.valid
    ? "This series needs at least 2 carbons. Increase the chain length."
    : crackable
      ? `Press "Trigger cracking": this alkane breaks into a shorter alkane plus a useful alkene.`
      : family === "alkene"
        ? "The C=C double bond decolourises bromine water — the standard test for unsaturation."
        : family === "alkyne"
          ? "The C≡C triple bond makes alkynes very reactive; ethyne (acetylene) is used in welding torches."
          : family === "acid"
            ? "Carboxylic acids have –COOH: a carbonyl C=O and a hydroxyl –OH on the same carbon. They are weak acids."
            : family === "ester"
              ? "Esters form from an acid + alcohol (condensation). The –COO– linkage gives fruits their characteristic smells."
              : "Each member of the series differs by CH₂, so properties change gradually down the series.";

  return (
    <SceneCanvas camera={{ position: [0, 2.4, carbons > 6 ? 12 : 8.5], fov: 45 }}>
      <Molecule family={family} carbons={carbons} crackToken={crack} spin={spin} />

      <SceneLabel position={[0, -2.6, 0]} accent>
        {molecule.formula} · {molecule.name}
      </SceneLabel>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title={molecule.valid ? molecule.name : "No such molecule"}
        subtitle={`${family} · homologous series`}
        rows={[
          ["Formula", molecule.formula, "gold"],
          ["General formula", generalFormula],
          ["Carbons n", carbons],
          [
            "Saturated",
            saturated ? "yes — only single bonds" : hasBondFeature ? `no — has ${family === "alkyne" ? "C≡C" : "C=C"}` : "—",
            saturated ? "good" : "bad",
          ],
          ...(family === "acid"  ? [["Functional group", "–COOH (carboxyl)"]] : []),
          ...(family === "ester" ? [["Functional group", "–COO– (ester linkage)"]] : []),
          ...(family === "alkene" || family === "alkyne"
            ? [["Bromine water", family === "alkene" ? "decolourised" : "decolourised (very fast)"]]
            : []),
        ]}
        note={readoutNote}
        noteTone={!molecule.valid ? "bad" : "neutral"}
      />

      <SceneLegend
        title="Ball and stick"
        items={[
          { color: ATOM_STYLE.C.color, label: "Carbon", note: "always forms four bonds" },
          { color: ATOM_STYLE.H.color, label: "Hydrogen", note: "always forms one" },
          { color: ATOM_STYLE.O.color, label: "Oxygen", note: "two bonds — in –OH, C=O, –COO–" },
          ...(family === "alkyne"
            ? [{ color: PALETTE.sky, shape: "line", label: "C≡C triple bond", note: "three shared pairs — very reactive, sp linear" }]
            : family === "alkene"
              ? [{ color: PALETTE.gold, shape: "line", label: "C=C double bond", note: "two shared pairs — the reactive site" }]
              : [{ color: "#3f4854", shape: "line", label: "Single C–C bond", note: "one shared pair — saturated" }]),
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 8 · Fractional distillation ═════════════════════════════════════

// Ordered top (coolest, shortest chains) to bottom (hottest, longest).
const FRACTIONS = [
  { name: "Refinery gases", top: 25, use: "bottled gas", colour: "#7dd3fc", chain: "C₁–C₄" },
  { name: "Petrol", top: 75, use: "car fuel", colour: "#a5b4fc", chain: "C₅–C₁₀" },
  { name: "Naphtha", top: 150, use: "chemical feedstock", colour: "#c4b5fd", chain: "C₈–C₁₂" },
  { name: "Kerosene", top: 240, use: "aircraft fuel", colour: "#fcd34d", chain: "C₁₁–C₁₆" },
  { name: "Diesel oil", top: 320, use: "lorries, trains", colour: "#fb923c", chain: "C₁₅–C₂₀" },
  {
    name: "Bitumen",
    top: 400,
    use: "road surfacing",
    colour: "#f87171",
    chain: "C₃₀+",
    // Too heavy to vaporise at all — it is drained off, not condensed out.
    residue: true,
  },
];

const COLUMN_HEIGHT = 7.6;
const levelY = (i) => COLUMN_HEIGHT / 2 - 0.6 - i * 1.25;

function Vapours({ heat, flowing }) {
  const group = useRef(null);
  const particles = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        fraction: i % FRACTIONS.length,
        phase: hashRandom(i + 3),
        wobble: hashRandom(i + 51) * Math.PI * 2,
        radius: 0.25 + hashRandom(i + 17) * 0.75,
      })),
    [],
  );
  const t = useRef(0);
  const meshes = useRef([]);

  useFrame((_, delta) => {
    if (flowing) t.current += delta * 0.34;
    particles.forEach((p, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      // Furnace heat decides how far up the column a fraction can climb.
      const reach = clamp((heat - p.fraction * 0.14) * 1.35, 0, 1);
      const ceiling = levelY(p.fraction);
      const bottom = -COLUMN_HEIGHT / 2 + 0.4;
      const travel = (ceiling - bottom) * reach;
      const local = (t.current + p.phase) % 1;
      const y = bottom + travel * local;
      const a = p.wobble + local * 4;
      mesh.position.set(Math.cos(a) * p.radius, y, Math.sin(a) * p.radius);
      const fade = reach < 0.05 ? 0 : 1 - Math.pow(local, 6);
      mesh.scale.setScalar(0.001 + fade * 0.13);
    });
  });

  return (
    <group ref={group}>
      {particles.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial
            color={FRACTIONS[p.fraction].colour}
            emissive={FRACTIONS[p.fraction].colour}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function DistillationScene({ params = {} }) {
  const { heat = 0.7, showLabels = true, flow = true } = params || {};
  const furnace = Math.round(lerp(250, 450, heat));
  const rising = FRACTIONS.filter((_, i) => heat - i * 0.14 > 0.05).length;

  return (
    <SceneCanvas camera={{ position: [7, 1.5, 9], fov: 45 }}>
      {/* Cutaway tower — a partial cylinder, so the trays stay visible. */}
      <mesh>
        <cylinderGeometry
          args={[1.75, 1.75, COLUMN_HEIGHT, 48, 1, true, Math.PI * 0.22, Math.PI * 1.56]}
        />
        <meshStandardMaterial
          color="#64748b"
          roughness={0.3}
          metalness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Translucent Outer Glass Column Sheath */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1.78, 1.78, COLUMN_HEIGHT, 48, 1, true]} />
        <meshStandardMaterial
          color="#38bdf8"
          transparent
          opacity={0.18}
          roughness={0.1}
          metalness={0.2}
          emissive="#38bdf8"
          emissiveIntensity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {FRACTIONS.map((fraction, i) => {
        const y = levelY(i);
        // Temperature falls as you climb; the tray glows if vapour reaches it.
        const reached = heat - i * 0.14 > 0.05;
        return (
          <group key={fraction.name} position={[0, y, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.35, 1.72, 40]} />
              <meshStandardMaterial
                color={fraction.colour}
                emissive={fraction.colour}
                emissiveIntensity={reached ? 0.75 : 0.12}
                transparent
                opacity={reached ? 0.5 : 0.16}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Take-off pipe. */}
            <mesh position={[2.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.11, 0.11, 1.1, 12]} />
              <meshStandardMaterial
                color={fraction.colour}
                emissive={fraction.colour}
                emissiveIntensity={reached ? 1.1 : 0.15}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>

            {showLabels && (
              <SceneLabel position={[4.3, 0, 0]} accent={reached}>
                {fraction.name}
                {fraction.residue ? " (residue)" : ""} · ≤{fraction.top}°C · {fraction.chain} ·{" "}
                {fraction.use}
              </SceneLabel>
            )}
          </group>
        );
      })}

      {/* The temperature gradient is the mechanism, so it gets drawn rather
          than merely implied by which tray happens to be glowing. */}
      <group position={[-5.0, 0, 0]}>
        <Line
          points={[
            [0, COLUMN_HEIGHT / 2, 0],
            [0, -COLUMN_HEIGHT / 2, 0],
          ]}
          color={PALETTE.rose}
          lineWidth={2}
          transparent
          opacity={0.4}
        />
        <SceneLabel position={[0, COLUMN_HEIGHT / 2 + 0.5, 0]} tone="text-sky-300">
          coolest at the top · ~25°C
        </SceneLabel>
        <SceneLabel position={[0, -COLUMN_HEIGHT / 2 - 0.5, 0]} tone="text-rose-300">
          hottest at the bottom · {furnace}°C
        </SceneLabel>
      </group>

      <Vapours heat={heat} flowing={flow} />

      {/* Base of the column */}
      <group position={[0, -COLUMN_HEIGHT / 2 - 0.425, 0]}>
        <mesh>
          <boxGeometry args={[3.8, 0.85, 3.8]} />
          <meshStandardMaterial
            color="#2563eb"
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      </group>

      {/* External Furnace to the left */}
      <group position={[-3.2, -COLUMN_HEIGHT / 2 + 0.25, 0]}>
        {/* Main Furnace Body */}
        <mesh>
          <boxGeometry args={[1.8, 2.2, 1.8]} />
          <meshStandardMaterial
            color="#334155"
            emissive={PALETTE.rose}
            emissiveIntensity={0.1 + heat * 0.4}
            roughness={0.6}
            metalness={0.6}
          />
        </mesh>
        {/* Glowing Fire Grate on front face */}
        <group position={[0, -0.3, 0.91]}>
          <mesh>
            <planeGeometry args={[1.0, 1.0]} />
            <meshStandardMaterial
              color="#000000"
              emissive="#f97316"
              emissiveIntensity={1.0 + heat * 3.0}
            />
          </mesh>
          {/* Iron Grate Bars */}
          {[-0.3, -0.1, 0.1, 0.3].map((xOffset) => (
            <mesh key={xOffset} position={[xOffset, 0, 0.02]}>
              <boxGeometry args={[0.08, 1.05, 0.05]} />
              <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.1} />
            </mesh>
          ))}
        </group>
        {/* Exhaust Chimney Stack */}
        <group position={[0, 1.5, 0]}>
          <mesh>
            <cylinderGeometry args={[0.25, 0.35, 1.0, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.28, 0.06, 8, 16]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
        </group>
        {/* Pipe connecting furnace to column */}
        <mesh position={[1.175, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.55, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.5} />
        </mesh>
        <SceneLabel position={[0, -1.6, 0]} tone="text-rose-300">
          furnace · {furnace}°C · crude oil in
        </SceneLabel>
      </group>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Fractionating column"
        subtitle="A physical separation, not a reaction"
        rows={[
          ["Furnace", `${furnace}°C`, "gold"],
          ["Top of column", "~25°C"],
          ["Separated by", "boiling point"],
          ["Fractions vaporised", `${rising} of ${FRACTIONS.length}`, rising > 3 ? "good" : "warn"],
          ["Highest riser", FRACTIONS[0].name],
          ["Left at the base", "bitumen"],
        ]}
        note={
          rising <= 2
            ? "The furnace is too cool for most of the crude oil to vaporise, so the heavier fractions never leave the base. Turn the heat up."
            : "Short chains have weaker forces between their molecules, so they boil at low temperatures and climb highest before condensing. Long chains condense low down; bitumen never boils at all."
        }
        noteTone={rising <= 2 ? "warn" : "neutral"}
      />

      <SceneLegend
        title="Fractions, top to bottom"
        items={FRACTIONS.map((fraction, i) => ({
          color: fraction.colour,
          label: `${fraction.name} · ${fraction.chain}`,
          note: fraction.residue
            ? `never vaporises — drained off at the base · ${fraction.use}`
            : heat - i * 0.14 > 0.05
              ? `≤${fraction.top}°C · ${fraction.use}`
              : `needs more heat than ${furnace}°C`,
        }))}
      />
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

function buildDiamond() {
  // Diamond cubic: an FCC basis plus the same lattice shifted by ¼,¼,¼.
  const a = 2.4;
  const basis = [
    [0, 0, 0],
    [0, 0.5, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0.5, 0],
  ];
  const points = [];
  for (let cx = 0; cx < 2; cx += 1) {
    for (let cy = 0; cy < 2; cy += 1) {
      for (let cz = 0; cz < 2; cz += 1) {
        basis.forEach(([bx, by, bz]) => {
          points.push([(cx + bx) * a, (cy + by) * a, (cz + bz) * a]);
          points.push([(cx + bx + 0.25) * a, (cy + by + 0.25) * a, (cz + bz + 0.25) * a]);
        });
      }
    }
  }

  const centre = a; // recentre the 2×2×2 block on the origin
  const atoms = points
    .map((p) => [p[0] - centre, p[1] - centre, p[2] - centre])
    .filter((p) => p.every((c) => c >= -centre - 0.01 && c <= centre + 0.01))
    .map((position) => ({ position, radius: 0.26, color: "#94a3b8" }));

  const bondLength = (Math.sqrt(3) / 4) * a;
  const bonds = [];
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const p = atoms[i].position;
      const q = atoms[j].position;
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (Math.abs(d - bondLength) < 0.06) bonds.push({ from: p, to: q });
    }
  }
  return { atoms, bonds, layers: null };
}

function buildGraphite(slide) {
  const acc = 0.82;
  const atoms = [];
  const bonds = [];
  // 335 pm between layers against 142 pm within one — a ratio of 2.36. That
  // gap is the whole story: covalent bonds in the sheet, weak forces across
  // it, so the layers shear while the sheets themselves never break.
  const gap = acc * 2.36;
  const layerY = [-gap, 0, gap];

  layerY.forEach((y, layerIndex) => {
    // Alternate layers slide in opposite directions so the shear is obvious.
    const dx = slide * 1.4 * (layerIndex - 1);
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
  });

  return { atoms, bonds, layers: layerY };
}

function buildQuartz() {
  const atoms = [];
  const bonds = [];
  const siPos = [];
  const spacing = 1.6;
  for (let i = -1; i <= 1; i += 1) {
    for (let j = -1; j <= 1; j += 1) {
      for (let k = -1; k <= 1; k += 1) {
        const pos = [i * spacing, j * spacing, k * spacing];
        siPos.push(pos);
        atoms.push({ position: pos, radius: 0.28, color: PALETTE.gold });
      }
    }
  }
  for (let i = 0; i < siPos.length; i += 1) {
    for (let j = i + 1; j < siPos.length; j += 1) {
      const p = siPos[i];
      const q = siPos[j];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (Math.abs(d - spacing) < 0.05) {
        const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 0.15, (p[2] + q[2]) / 2];
        atoms.push({ position: mid, radius: 0.18, color: PALETTE.rose });
        bonds.push({ from: p, to: mid });
        bonds.push({ from: mid, to: q });
      }
    }
  }
  return { atoms, bonds, layers: null };
}

function buildIce() {
  const atoms = [];
  const bonds = [];
  const levels = [-1.4, 0, 1.4];
  const r = 1.3;
  levels.forEach((y, l) => {
    for (let i = 0; i < 6; i += 1) {
      const a = (i * Math.PI) / 3 + (l % 2 ? Math.PI / 6 : 0);
      const ox = Math.cos(a) * r;
      const oz = Math.sin(a) * r;
      const oPos = [ox, y, oz];
      atoms.push({ position: oPos, radius: 0.26, color: PALETTE.rose });
      const hPos1 = [ox + 0.35, y + 0.2, oz + 0.2];
      const hPos2 = [ox - 0.35, y - 0.2, oz - 0.2];
      atoms.push({ position: hPos1, radius: 0.14, color: PALETTE.bone });
      atoms.push({ position: hPos2, radius: 0.14, color: PALETTE.bone });
      bonds.push({ from: oPos, to: hPos1 });
      bonds.push({ from: oPos, to: hPos2 });
    }
  });
  return { atoms, bonds, layers: null };
}

const LATTICE_FACTS = {
  nacl: {
    title: "Sodium chloride",
    rows: [
      ["Structure", "giant ionic"],
      ["Bonding", "electrostatic"],
      ["Melting point", "801°C"],
      ["Conducts", "molten / aqueous"],
    ],
    note: "Na⁺ and Cl⁻ alternate in every direction. Strong attraction in all directions means a high melting point, and it only conducts once the ions are free to move.",
  },
  diamond: {
    title: "Diamond",
    rows: [
      ["Structure", "giant covalent"],
      ["Bonds per carbon", "4"],
      ["Melting point", "3550°C"],
      ["Conducts", "no"],
    ],
    note: "Every carbon is covalently bonded to four others in a rigid tetrahedral network — extremely hard, and no free electrons, so it does not conduct.",
  },
  graphite: {
    title: "Graphite",
    rows: [
      ["Structure", "giant covalent"],
      ["Bonds per carbon", "3"],
      ["Between layers", "weak forces"],
      ["Conducts", "yes"],
    ],
    note: "Three bonds per carbon leaves one delocalised electron, so graphite conducts. Weak forces between layers let them slide, which is why it lubricates.",
  },
  quartz: {
    title: "Quartz (Silicon Dioxide)",
    rows: [
      ["Structure", "giant covalent"],
      ["Formula", "SiO₂"],
      ["Melting point", "1710°C"],
      ["Conducts", "no"],
    ],
    note: "Silicon atoms linked tetrahedrally by bridging oxygen atoms. Extremely hard mineral with high thermal resistance.",
  },
  ice: {
    title: "Hexagonal Ice (H₂O)",
    rows: [
      ["Structure", "molecular crystal"],
      ["Bonding", "hydrogen bonds"],
      ["Melting point", "0°C"],
      ["Density", "less than liquid water"],
    ],
    note: "Open hexagonal crystal cage held together by hydrogen bonds between water molecules — why ice floats on liquid water.",
  },
};

const LATTICE_KEYS = {
  nacl: [
    { color: PALETTE.gold, label: "Na⁺ ion", note: "smaller — it lost an electron" },
    { color: PALETTE.emerald, label: "Cl⁻ ion", note: "larger — it gained one" },
    {
      color: "#3f4854",
      shape: "line",
      label: "Electrostatic attraction",
      note: "strong, and pulling in every direction",
    },
  ],
  diamond: [
    { color: "#94a3b8", label: "Carbon atom", note: "bonded to four others, tetrahedrally" },
    {
      color: "#3f4854",
      shape: "line",
      label: "Covalent bond",
      note: "all four outer electrons used — none left to conduct",
    },
  ],
  graphite: [
    { color: PALETTE.gold, label: "Carbon in the middle layer", note: "picked out so the slide shows" },
    { color: "#94a3b8", label: "Carbon in the outer layers" },
    {
      color: "#3f4854",
      shape: "line",
      label: "Covalent bond within a layer",
      note: "three per carbon — the fourth electron is delocalised",
    },
    {
      color: PALETTE.sky,
      shape: "dash",
      label: "Between the layers",
      note: "weak forces only — drag the slider and they shear",
    },
  ],
  quartz: [
    { color: PALETTE.gold, label: "Silicon atom (Si)", note: "tetrahedral coordination" },
    { color: PALETTE.rose, label: "Oxygen atom (O)", note: "bridges two silicon atoms" },
    { color: "#3f4854", shape: "line", label: "Si–O Covalent bond" },
  ],
  ice: [
    { color: PALETTE.rose, label: "Oxygen atom (O)" },
    { color: PALETTE.bone, label: "Hydrogen atom (H)" },
    { color: PALETTE.sky, shape: "dash", label: "Hydrogen bond cage" },
  ],
};

/** Lives inside the Canvas — useFrame is only legal below <Canvas>. */
function SpinningLattice({ lattice, showBonds, spin }) {
  const group = useRef(null);

  useFrame((_, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.25;
  });

  return (
    <group ref={group}>
      {showBonds &&
        lattice.bonds.map((b, i) => (
          <Bond key={i} from={b.from} to={b.to} radius={0.045} color="#3f4854" />
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
    </group>
  );
}

export function CrystalLatticeScene({ params = {} }) {
  const { structure = "nacl", slide = 0, showBonds = true, spin = true } = params || {};

  const lattice = useMemo(() => {
    if (structure === "diamond") return buildDiamond();
    if (structure === "graphite") return buildGraphite(slide);
    if (structure === "quartz") return buildQuartz();
    if (structure === "ice") return buildIce();
    return buildNaCl();
  }, [structure, slide]);

  const facts = LATTICE_FACTS[structure] ?? LATTICE_FACTS.nacl;

  return (
    <SceneCanvas camera={{ position: [6, 4.5, 8], fov: 45 }}>
      <SpinningLattice lattice={lattice} showBonds={showBonds} spin={spin} />

      {structure === "nacl" && (
        <>
          <SceneLabel position={[0, 3.4, 0]} accent>
            Na⁺ small · Cl⁻ large
          </SceneLabel>
        </>
      )}
      {structure === "graphite" && slide > 0.05 && (
        <SceneLabel position={[0, 3.4, 0]} tone="text-emerald-300">
          layers sliding — weak forces between sheets
        </SceneLabel>
      )}

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title={facts.title}
        subtitle={structure === "nacl" ? "Giant ionic lattice" : structure === "ice" ? "Molecular crystal" : "Giant covalent lattice"}
        rows={facts.rows}
        note={facts.note}
      />

      <SceneLegend
        title="Key"
        items={LATTICE_KEYS[structure] ?? LATTICE_KEYS.nacl}
      />
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
        <meshStandardMaterial color="#eab308" emissive="#ca8a04" emissiveIntensity={0.8} />
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
            <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.6} />
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
        <meshStandardMaterial color="#0284c7" emissive="#38bdf8" emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      {/* Hydration halo ring */}
      <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <torusGeometry args={[0.55, 0.04, 12, 24]} />
        <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.2} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function Ions({ current, running, resetToken, onDeposit }) {
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

  if (!state.current) {
    state.current = ions.map((ion) => ({
      x: (hashRandom(ion.seed + 1) - 0.5) * TANK.w * 0.7,
      y: (hashRandom(ion.seed + 31) - 0.5) * (TANK.h - 1.2),
      z: (hashRandom(ion.seed + 61) - 0.5) * (TANK.d - 0.8),
    }));
  }

  useEffect(() => {
    if (!resetToken) return;
    state.current.forEach((s, i) => {
      s.x = (hashRandom(i + 1) - 0.5) * TANK.w * 0.7;
    });
  }, [resetToken]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    const speed = running ? current * 1.15 : 0;
    const edge = TANK.w / 2 - 1.15;

    ions.forEach((ion, i) => {
      const el = refs.current[i];
      const s = state.current[i];
      if (!el || !s) return;

      s.x += (ion.cation ? -1 : 1) * speed * step;
      s.y += Math.sin((s.x + ion.seed) * 2) * step * 0.24;

      if (ion.cation && s.x <= -edge) {
        if (running) arrivals.current += 1;
        s.x = (hashRandom(i + Math.floor(performance.now() / 97)) - 0.5) * TANK.w * 0.55;
      }
      if (!ion.cation && s.x >= edge) {
        s.x = (hashRandom(i + 7 + Math.floor(performance.now() / 89)) - 0.5) * TANK.w * 0.55;
      }
      s.y = clamp(s.y, -TANK.h / 2 + 0.4, TANK.h / 2 - 0.5);
      el.position.set(s.x, s.y, s.z);
    });

    clock.current += step;
    if (clock.current >= 0.25) {
      if (arrivals.current > 0) onDeposit(arrivals.current);
      arrivals.current = 0;
      clock.current = 0;
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

function ElectronFlow({ path, speed, running, count = 8 }) {
  const meshes = useRef([]);
  const phase = useRef(0);

  const points = useMemo(() => path.map((p) => new THREE.Vector3(...p)), [path]);
  const legs = points.length - 1;
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (running) phase.current = (phase.current + Math.min(delta, 0.05) * speed) % 1;
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
          <sphereGeometry args={[0.09, 12, 12]} />
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

function ElectrodeBubbles({ x, running, speed, color }) {
  const meshes = useRef([]);
  const state = useRef(null);
  const COUNT = 14;

  if (!state.current) {
    state.current = Array.from({ length: COUNT }, (_, i) => ({
      phase: i / COUNT,
      rx: (hashRandom(i + 11) - 0.5) * 0.4,
      rz: (hashRandom(i + 22) - 0.5) * 0.4,
    }));
  }

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    state.current.forEach((s, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      if (running) s.phase = (s.phase + step * speed) % 1;
      const p = s.phase;
      const y = lerp(-TANK.h / 2 + 0.2, TANK.h / 2 + 0.1, p);
      const scale = 0.04 + Math.sin(p * Math.PI) * 0.14;
      mesh.position.set(x + s.rx, y, s.rz);
      mesh.scale.setScalar(scale);
    });
  });

  return (
    <>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
        >
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2.2}
            transparent
            opacity={0.75}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

export function ElectrolysisScene({ params = {} }) {
  const { current = 1.0, showLabels = true, run = true, reset = 0 } = params || {};
  const [deposit, setDeposit] = useState(0);

  useEffect(() => {
    if (reset) setDeposit(0);
  }, [reset]);

  const plating = clamp(0.18 + deposit * 0.0016, 0.18, 0.52);
  const anodeRadius = clamp(0.44 - (plating - 0.18), 0.14, 0.44);
  const tank = useMemo(() => new THREE.BoxGeometry(TANK.w, TANK.h, TANK.d), []);
  useEffect(() => () => tank.dispose(), [tank]);

  const circuit = useMemo(
    () => [
      [-TANK.w / 2 + 1, TANK.h / 2 + 1.1, 0],
      [-TANK.w / 2 + 1, TANK.h / 2 + 2.2, 0],
      [TANK.w / 2 - 1, TANK.h / 2 + 2.2, 0],
      [TANK.w / 2 - 1, TANK.h / 2 + 1.1, 0],
    ],
    [],
  );

  return (
    <SceneCanvas camera={{ position: [0, 3, 10], fov: 45 }}>
      {/* Wooden Lab Bench Surface Base */}
      <mesh position={[0, -TANK.h / 2 - 0.205, 0]}>
        <boxGeometry args={[TANK.w + 4, 0.4, TANK.d + 3]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Glass Beaker Walls */}
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
            opacity={0.15}
            roughness={0.05}
            metalness={0.2}
            emissive="#7dd3fc"
            emissiveIntensity={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Beaker Bottom */}
      <mesh position={[0, -TANK.h / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TANK.w + 0.04, TANK.d + 0.04]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.22} roughness={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>



      {/* Graduation Volume Marks on Front Glass (100ml to 500ml) */}
      {[-1.0, -0.5, 0, 0.5, 1.0].map((yMark, idx) => (
        <group key={idx} position={[-TANK.w / 2 + 0.05, yMark, TANK.d / 2 + 0.03]}>
          <mesh>
            <boxGeometry args={[0.4, 0.03, 0.01]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Electrolyte solution (Blue CuSO₄ Solution) */}
      <mesh>
        <boxGeometry args={[TANK.w, TANK.h, TANK.d]} />
        <meshStandardMaterial
          color="#0284c7"
          transparent
          opacity={0.22}
          depthWrite={false}
          roughness={0.04}
          emissive="#0ea5e9"
          emissiveIntensity={0.15}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[tank]} />
        <lineBasicMaterial color="#38bdf8" opacity={0.65} transparent />
      </lineSegments>

      {/* Heavy Brass Terminal Clamps on Top Rim */}
      {[-TANK.w / 2 + 1, TANK.w / 2 - 1].map((xPos, idx) => (
        <group key={idx} position={[xPos, TANK.h / 2 + 0.5, 0]}>
          <mesh>
            <cylinderGeometry args={[0.25, 0.28, 0.4, 16]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color={idx === 0 ? PALETTE.sky : PALETTE.gold} emissive={idx === 0 ? PALETTE.sky : PALETTE.gold} emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Cathode (−) on left, thickening with electroplated copper crystal clusters */}
      <group position={[-TANK.w / 2 + 1, 0.45, 0]}>
        <mesh>
          <cylinderGeometry args={[plating, plating, TANK.h + 0.7, 24]} />
          <meshStandardMaterial color="#b45309" emissive="#b45309" emissiveIntensity={0.45} metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Plated copper crystal nodule clusters */}
        {deposit > 0 &&
          Array.from({ length: Math.min(12, Math.floor(deposit / 2) + 2) }).map((_, i) => (
            <mesh
              key={i}
              position={[
                (hashRandom(i + 3) - 0.5) * plating * 1.8,
                (hashRandom(i + 13) - 0.5) * TANK.h * 0.7,
                (hashRandom(i + 23) - 0.5) * plating * 1.8,
              ]}
              scale={[0.12, 0.12, 0.12]}
            >
              <dodecahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#d97706" emissive="#b45309" emissiveIntensity={0.6} metalness={0.9} roughness={0.15} />
            </mesh>
          ))}
      </group>

      {/* Anode (+) on right, dissolving away with eroded pitting texture */}
      <mesh position={[TANK.w / 2 - 1, 0.45, 0]}>
        <cylinderGeometry args={[anodeRadius, anodeRadius, TANK.h + 0.7, 24]} />
        <meshStandardMaterial color="#7c3f12" emissive={PALETTE.gold} emissiveIntensity={0.35} metalness={0.75} roughness={0.45} />
      </mesh>

      {/* Rising H₂ gas bubbles at cathode (−), O₂ at anode (+) */}
      <ElectrodeBubbles x={-TANK.w / 2 + 1} running={run} speed={0.35 + current * 0.15} color={PALETTE.sky} />
      <ElectrodeBubbles x={TANK.w / 2 - 1} running={run} speed={0.25 + current * 0.1} color={PALETTE.gold} />

      {showLabels && (
        <>
          <SceneLabel position={[-TANK.w / 2 + 1, TANK.h / 2 + 1.5, 0]} tone="text-sky-300">
            cathode (−) · gains Cu · Cu²⁺ + 2e⁻ → Cu
          </SceneLabel>
          <SceneLabel position={[TANK.w / 2 - 1, TANK.h / 2 + 1.5, 0]} accent>
            anode (+) · wastes away · Cu → Cu²⁺ + 2e⁻
          </SceneLabel>
        </>
      )}

      {/* DC Power Supply Equipment Box */}
      <group position={[0, TANK.h / 2 + 3.0, -1.0]}>
        <mesh>
          <boxGeometry args={[4.2, 1.2, 1.2]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Digital LED Display */}
        <mesh position={[0, 0.1, 0.61]}>
          <planeGeometry args={[1.8, 0.5]} />
          <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={1.2} />
        </mesh>
        <SceneLabel position={[0, 0.1, 0.62]} tone="text-cyan-200">
          {run ? `DC SUPPLY: ${current.toFixed(1)} A` : "DC SUPPLY: OFF"}
        </SceneLabel>
      </group>

      {/* External circuit wires */}
      <Line
        points={circuit}
        color={PALETTE.gold}
        lineWidth={2.5}
        transparent
        opacity={0.7 + current * 0.2}
      />
      <ElectronFlow path={circuit} speed={0.14 + current * 0.18} running={run} />

      <Ions
        current={current}
        running={run}
        resetToken={reset}
        onDeposit={(n) => setDeposit((d) => d + n)}
      />

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Electrolysis of CuSO₄"
        subtitle="Copper electrodes · OIL RIG"
        rows={[
          ["Supply", run ? `${current.toFixed(1)} A` : "off", run ? "gold" : "bad"],
          ["Cu²⁺ reaching cathode", `${deposit}`, deposit > 0 ? "good" : undefined],
          ["Cathode (−)", "gains copper", "good"],
          ["…by reduction", "Cu²⁺ + 2e⁻ → Cu", "good"],
          ["Anode (+)", "loses copper", "bad"],
          ["…by oxidation", "Cu → Cu²⁺ + 2e⁻", "bad"],
          ["Charge carried by", "ions in solution"],
        ]}
        note={
          run
            ? "Copper leaves the anode, crosses as Cu²⁺, and plates onto the cathode — so the anode thins as the cathode thickens. That is electroplating, and how copper is purified."
            : "The supply is off, so nothing migrates. Electrolysis needs both a potential difference and ions that are free to move — molten or in solution."
        }
        noteTone={run ? "neutral" : "bad"}
      />

      <SceneLegend
        title="Key"
        items={[
          {
            color: "#38bdf8",
            label: "Cu²⁺ cation (Hydrated)",
            note: "positive → travels to the negative cathode",
          },
          {
            color: PALETTE.gold,
            label: "SO₄²⁻ anion (Tetrahedral)",
            note: "negative → travels to the positive anode",
          },
          {
            color: PALETTE.bone,
            label: "Electron",
            note: "only ever in the wire, never in the solution",
          },
          {
            color: "#b45309",
            shape: "square",
            label: "Copper electrode",
            note: "left grows crystal nodes, right dissolves",
          },
        ]}
      />
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
};

export default function ChemistryCanvas({ topicId, params }) {
  const Scene = SCENES[topicId];
  if (!Scene) return null;
  return <Scene params={params} />;
}
