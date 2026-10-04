"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp, lerp } from "@/components/visualizations/scene-kit";
import { ElectronMark, Kernel, ShellRing } from "@/components/visualizations/electron-shells";
import { BONDING_COLOURS, COVALENT_ROLE_COLOURS, covalentDiagram } from "@/lib/bonding";

// ─── Covalent dot and cross, in 3D ──────────────────────────────────
// The VSEPR topic's "Dot & cross" view: the same molecule as the shape view,
// drawn as its atoms' outer shells. Each atom's shell is a ring that always
// faces you; the bonded atoms sit along the VSEPR bond directions, close
// enough that their shells overlap, and every shared pair sits in an
// overlap — one dot from the central atom, one cross from the outer atom.
// The central atom's lone pairs point exactly where the shape view's lone
// pair lobes do, because they come from the same geometry.
//
// "Bring the atoms together" plays the bond forming: the outer atoms start
// well apart, each with its bonding electron unpaired and pointing at its
// partner; they close in until the shells overlap, and the two unpaired
// electrons in each overlap become a pair.
// ─────────────────────────────────────────────────────────────────────

const ASSEMBLE_SECONDS = 9;
const T = { show: 0.12, approach: 0.55, pair: 0.8 };
const START_STRETCH = 1.9;
const ELECTRON = 0.085;
/** Half the gap between the two electrons of a pair. */
const PAIR_HALF = 0.1;
/** How far the scene can reach before the group is scaled down to fit. */
const FIT_RADIUS = 2.75;

const PERIOD = { H: 1, Be: 2, B: 2, C: 2, N: 2, O: 2, F: 2, P: 3, S: 3, Cl: 3, Br: 4, Xe: 5 };
/** Outer-shell radius drawn for an element: hydrogen's K shell is small, heavier atoms' outer shells bigger. */
export const covalentShellRadius = (symbol) => (symbol === "H" ? 0.6 : [0, 0.6, 0.95, 1.1, 1.22, 1.3][PERIOD[symbol] ?? 2]);

const smooth = (t) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const span = (p, a, b) => smooth((p - a) / (b - a));

function perpendicularTo(dir) {
  const helper = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(dir, helper).normalize();
}

/**
 * Directions for an outer atom's lone pairs: spread round the axis pointing
 * back at the central atom, at the tetrahedral 109.5° for three pairs and
 * the trigonal 120° for two (a doubly bonded oxygen).
 */
function ligandLonePairDirections(towardCentre, count) {
  if (count === 0) return [];
  const p = perpendicularTo(towardCentre);
  const q = new THREE.Vector3().crossVectors(towardCentre, p).normalize();
  const theta = count === 3 ? (109.47 * Math.PI) / 180 : count === 2 ? (120 * Math.PI) / 180 : Math.PI;
  return Array.from({ length: count }, (_, k) => {
    const phi = count === 2 ? (k === 0 ? 0 : Math.PI) : (k / count) * Math.PI * 2;
    return towardCentre
      .clone()
      .multiplyScalar(Math.cos(theta))
      .addScaledVector(p, Math.sin(theta) * Math.cos(phi))
      .addScaledVector(q, Math.sin(theta) * Math.sin(phi))
      .normalize();
  });
}

/**
 * Every electron of the molecule, as a function of the assembly progress.
 *
 * Each electron is a point on an axis (`at(d, pair)`: where its group sits,
 * given the bond length at that moment and how far the shared electrons
 * have paired) plus a sideways offset `side` across that axis. The sideways
 * direction is worked out every frame from the camera — across the axis AS
 * SEEN ON SCREEN — so the two electrons of a pair, and the four of a double
 * bond, never line up one behind the other however the molecule is turned.
 */
function buildLayout(diagram, geometry) {
  const { centre, ligand, order } = diagram;
  const Rc = covalentShellRadius(centre.symbol);
  const Rl = covalentShellRadius(ligand.symbol);
  const overlap = 0.45 * Math.min(Rc, Rl);
  const bondLength = Rc + Rl - overlap;
  const electrons = [];

  geometry.bonds.forEach((dir, b) => {
    for (let k = 0; k < order; k += 1) {
      const shift = (k - (order - 1) / 2) * 0.42;
      // In the overlap: halfway across the lens the two shells share.
      const mid = (d) => (Rc + (d - Rl)) / 2;
      // Before the bond each sits on its own atom's shell, facing its partner.
      electrons.push({
        kind: "dot",
        owner: "centre",
        axis: dir,
        at: (d, pair) => dir.clone().multiplyScalar(lerp(Rc, mid(d), pair)),
        side: (pair) => lerp(shift * 0.8, shift - PAIR_HALF, pair),
      });
      electrons.push({
        kind: "cross",
        owner: "ligand",
        axis: dir,
        at: (d, pair) => dir.clone().multiplyScalar(lerp(d - Rl, mid(d), pair)),
        side: (pair) => lerp(shift * 0.8, shift + PAIR_HALF, pair),
      });
    }
    // The outer atom's own lone pairs ride along with it.
    ligandLonePairDirections(dir.clone().negate(), ligand.lonePairs).forEach((lp) => {
      for (const sign of [-1, 1]) {
        electrons.push({
          kind: "cross",
          owner: "ligand",
          axis: lp,
          at: (d) => dir.clone().multiplyScalar(d).addScaledVector(lp, Rl),
          side: () => sign * PAIR_HALF,
        });
      }
    });
  });

  geometry.lonePairs.forEach((dir) => {
    for (const sign of [-1, 1]) {
      electrons.push({ kind: "dot", owner: "centre", axis: dir, at: () => dir.clone().multiplyScalar(Rc), side: () => sign * PAIR_HALF });
    }
  });

  return { Rc, Rl, bondLength, electrons };
}

/** Across `axis` as seen from `view` (a unit vector towards the camera); the camera's right if they line up. */
function screenAcross(axis, view, right, out) {
  out.crossVectors(axis, view);
  if (out.lengthSq() < 1e-4) return out.copy(right);
  return out.normalize();
}

export function CovalentShells({ moleculeId, geometry, token, speed = 1, Label, onStage }) {
  const diagram = useMemo(() => covalentDiagram(moleculeId), [moleculeId]);
  const layout = useMemo(() => (diagram?.supported ? buildLayout(diagram, geometry) : null), [diagram, geometry]);
  const progress = useRef(-1);
  const seen = useRef(token);
  const [stage, setStage] = useState(-1);
  const stageRef = useRef(-1);
  const group = useRef(null);
  const ligandRefs = useRef([]);
  const electronRefs = useRef([]);

  const report = (next) => {
    if (next === stageRef.current) return;
    stageRef.current = next;
    setStage(next);
    onStage?.(next);
  };

  useEffect(() => {
    if (token === seen.current) return;
    seen.current = token;
    progress.current = 0;
    report(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => {
    progress.current = -1;
    report(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moleculeId]);

  const scratch = useMemo(() => ({ view: new THREE.Vector3(), right: new THREE.Vector3(), across: new THREE.Vector3() }), []);

  useFrame(({ camera }, delta) => {
    if (!layout) return;
    let p = progress.current;
    if (p >= 0 && p < 1) {
      p = Math.min(1, p + (delta * Math.max(speed, 0)) / ASSEMBLE_SECONDS);
      progress.current = p;
    }
    // At rest (never assembled, or finished) the molecule is whole.
    const t = p < 0 ? 1 : p;
    const d = lerp(layout.bondLength * START_STRETCH, layout.bondLength, span(t, T.show, T.approach));
    const pair = span(t, T.approach - 0.05, T.pair);

    geometry.bonds.forEach((dir, b) => {
      ligandRefs.current[b]?.position.copy(dir).multiplyScalar(d);
    });
    const { view, right, across } = scratch;
    view.copy(camera.position).normalize();
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    layout.electrons.forEach((e, i) => {
      const ref = electronRefs.current[i];
      if (!ref) return;
      screenAcross(e.axis, view, right, across);
      ref.position.copy(e.at(d, pair)).addScaledVector(across, e.side(pair));
    });
    // Scaled down, never up, so a big molecule mid-assembly stays in view.
    if (group.current) group.current.scale.setScalar(Math.min(1, FIT_RADIUS / (d + layout.Rl)));

    if (p >= 0) report(p < T.show ? 0 : p < T.approach ? 1 : p < T.pair ? 2 : 3);
  });

  if (!diagram) return null;
  if (!layout) {
    return (
      <Label position={[0, -2.4, 0]} tone="text-amber-300">
        {diagram.reason ?? "This molecule has no single dot-and-cross diagram."}
      </Label>
    );
  }

  const { centre, ligand } = diagram;
  // Nuclei in their element colours; shells and electrons in role colours, so
  // "whose electron is it" reads at a glance even where two elements are both
  // pale (C and H).
  const cColour = COVALENT_ROLE_COLOURS.centre;
  const lColour = COVALENT_ROLE_COLOURS.outer;
  const captions = [
    `${centre.symbol} brings ${centre.valence} outer electrons (●), each ${ligand.symbol} brings ${ligand.valence} (✕)`,
    "The atoms close in until their outer shells overlap",
    `In each overlap one ● and one ✕ pair up — a shared pair is a covalent bond${diagram.order > 1 ? `; ${diagram.order} pairs make a double bond` : ""}`,
    `${centre.electronsAround} electrons around ${centre.symbol}, ${ligand.electronsAround} around each ${ligand.symbol}${diagram.octet === "full" ? " — every shell full" : diagram.octet === "incomplete" ? ` — an incomplete octet on ${centre.symbol}` : ` — an expanded octet on ${centre.symbol}`}`,
  ];

  return (
    <group>
      <group ref={group}>
        <Kernel colour={BONDING_COLOURS[centre.symbol]} radius={0.14} halo={false} />
        <ShellRing billboard radius={layout.Rc} colour={cColour} lineWidth={2} opacity={0.75} />
        <Label position={[0, -0.36, 0]} accent>
          {centre.symbol}
        </Label>
        {geometry.bonds.map((dir, b) => (
          <group
            key={`lig-${b}`}
            ref={(el) => {
              ligandRefs.current[b] = el;
            }}
            position={dir.clone().multiplyScalar(layout.bondLength).toArray()}
          >
            <Kernel colour={BONDING_COLOURS[ligand.symbol]} radius={ligand.symbol === "H" ? 0.08 : 0.11} halo={false} />
            <ShellRing billboard radius={layout.Rl} colour={lColour} lineWidth={1.6} opacity={0.6} />
          </group>
        ))}
        {layout.electrons.map((e, i) => (
          <ElectronMark
            key={`e-${i}`}
            ref={(el) => {
              electronRefs.current[i] = el;
            }}
            kind={e.kind}
            colour={e.owner === "centre" ? cColour : lColour}
            size={ELECTRON}
            emissiveIntensity={1.5}
          />
        ))}
      </group>
      <Label position={[0, -2.75, 0]} tone={stage === 2 ? "text-amber-300" : stage === 3 || stage < 0 ? "text-emerald-300" : "text-ink-300"}>
        {stage >= 0 ? `${stage + 1}/4 · ${captions[stage]}` : captions[3]}
      </Label>
    </group>
  );
}
