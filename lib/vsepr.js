// ─── VSEPR ──────────────────────────────────────────────────────────
// Electron-domain geometry: where the bonds and lone pairs point for a
// given AXₙEₘ, and what the resulting bond angles actually are.
//
// The scene and the Details panel both call this, so the panel always names
// the shape and the angles the scene draws. The angles are each molecule's
// MEASURED ones: a flat 2.5° per lone pair lands on NH₃ and H₂O and misses
// nearly everything else — H₂S is 92.1°, not 104.5°, and a seesaw has three
// different angles, not one.
// ─────────────────────────────────────────────────────────────────────

import * as THREE from "three";
import { moleculeFor } from "./vseprMolecules.js";

export { ELEMENT_STYLE, MOLECULES, VSEPR_BOND_COLOUR, moleculeFor } from "./vseprMolecules.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const SQ3 = Math.sqrt(3) / 2;
const rad = (d) => (d * Math.PI) / 180;

/**
 * Electron-domain directions, one set per steric number.
 *
 * Order matters and is not cosmetic: lone pairs are taken from the END of
 * each list, which is what makes the model reproduce the real shapes. In a
 * trigonal bipyramid the equatorial sites are last, because lone pairs always
 * take equatorial positions; in an octahedron the ±y pair is last, because a
 * second lone pair always goes trans to the first.
 */
export const DOMAIN_DIRECTIONS = {
  2: [V3(0, 1, 0), V3(0, -1, 0)],
  3: [V3(1, 0, 0), V3(-0.5, 0, SQ3), V3(-0.5, 0, -SQ3)],
  4: [V3(1, 1, 1), V3(1, -1, -1), V3(-1, 1, -1), V3(-1, -1, 1)],
  5: [V3(0, 1, 0), V3(0, -1, 0), V3(1, 0, 0), V3(-0.5, 0, SQ3), V3(-0.5, 0, -SQ3)],
  6: [V3(1, 0, 0), V3(-1, 0, 0), V3(0, 0, 1), V3(0, 0, -1), V3(0, 1, 0), V3(0, -1, 0)],
};

export const ELECTRON_GEOMETRY = {
  2: "Linear",
  3: "Trigonal planar",
  4: "Tetrahedral",
  5: "Trigonal bipyramidal",
  6: "Octahedral",
};

export const IDEAL_ANGLE = { 2: 180, 3: 120, 4: 109.5, 5: 90, 6: 90 };
/** Trigonal bipyramidal has two distinct ideal angles; the rest have one. */
export const IDEAL_ANGLE_LABEL = { 2: "180°", 3: "120°", 4: "109.5°", 5: "90° & 120°", 6: "90°" };

/**
 * Keyed by `${bonding}-${lone}` — the AXₙEₘ notation, spelled out.
 *
 * Every combination the sliders can reach has an entry. `bonding` runs 1–6
 * and `lone` 0–3, constrained to a steric number of at most 6. Where a real
 * molecule exists, the example is the first one in MOLECULES with those
 * counts, and the sliders draw its measured angles.
 */
export const SHAPES = {
  // One bonding pair is a diatomic — linear by definition, however many lone
  // pairs sit behind it. Counted on the first atom: N in N≡N keeps one lone
  // pair, O in O=O two, Cl in H–Cl three.
  "1-0": { name: "Linear (diatomic)", example: "H₂", polar: false },
  "1-1": { name: "Linear (diatomic)", example: "N₂", polar: false },
  "1-2": { name: "Linear (diatomic)", example: "O₂", polar: false },
  "1-3": { name: "Linear (diatomic)", example: "HCl", polar: true },
  "2-0": { name: "Linear", example: "CO₂", polar: false },
  "3-0": { name: "Trigonal planar", example: "BF₃", polar: false },
  "2-1": { name: "Bent", example: "SO₂", polar: true },
  "4-0": { name: "Tetrahedral", example: "CH₄", polar: false },
  "3-1": { name: "Trigonal pyramidal", example: "NH₃", polar: true },
  "2-2": { name: "Bent", example: "H₂O", polar: true },
  "5-0": { name: "Trigonal bipyramidal", example: "PCl₅", polar: false },
  "4-1": { name: "Seesaw", example: "SF₄", polar: true },
  "3-2": { name: "T-shaped", example: "ClF₃", polar: true },
  "2-3": { name: "Linear", example: "XeF₂", polar: false },
  "3-3": { name: "T-shaped", example: "—", polar: true },
  "6-0": { name: "Octahedral", example: "SF₆", polar: false },
  "5-1": { name: "Square pyramidal", example: "BrF₅", polar: true },
  "4-2": { name: "Square planar", example: "XeF₄", polar: false },
};

/**
 * The textbook squeeze of 2.5° per lone pair (109.5° → 107° → 104.5°). Only
 * the fallback for AX₃E₃, which has no real molecule to measure.
 */
export const LONE_PAIR_COMPRESSION = 2.5;

export function smallestAngleOf(bonds) {
  let smallest = 180;
  for (let i = 0; i < bonds.length; i += 1) {
    for (let j = i + 1; j < bonds.length; j += 1) {
      smallest = Math.min(smallest, (bonds[i].angleTo(bonds[j]) * 180) / Math.PI);
    }
  }
  return smallest;
}

/**
 * The distinct bond angles in a geometry, smallest first, each with one pair
 * of bonds (i, j) that makes it. The scene draws an arc for each. Straight
 * 180° pairs are dropped whenever there is a bent angle to show.
 */
export function distinctAngles(bonds, max = 3) {
  const pairs = [];
  for (let i = 0; i < bonds.length; i += 1) {
    for (let j = i + 1; j < bonds.length; j += 1) {
      pairs.push({ value: (bonds[i].angleTo(bonds[j]) * 180) / Math.PI, i, j });
    }
  }
  pairs.sort((a, b) => a.value - b.value);
  const out = [];
  pairs.forEach((p) => {
    if (!out.some((o) => Math.abs(o.value - p.value) < 0.15)) out.push(p);
  });
  const bent = out.filter((p) => p.value < 179.5);
  return (bent.length ? bent : out).slice(0, max);
}

/** Tilts every bond away from the resultant lone-pair direction. */
function tiltBonds(directions, bonding, push, strength) {
  const bonds = directions.slice(0, bonding).map((d) => d.clone());
  if (push && strength > 0) {
    bonds.forEach((b) => b.addScaledVector(push, -strength).normalize());
  }
  return bonds;
}

// The three shapes with more than one independent angle, built straight from
// their measured angles. The lone pairs stay equatorial (seesaw, T-shaped) or
// opposite the apex (square pyramidal), and the bonds lean away from them.
function seesaw(axial, equatorial) {
  const t = rad((180 - axial) / 2);
  const h = rad(equatorial / 2);
  return {
    bonds: [
      V3(Math.sin(t), Math.cos(t), 0),
      V3(Math.sin(t), -Math.cos(t), 0),
      V3(Math.cos(h), 0, Math.sin(h)),
      V3(Math.cos(h), 0, -Math.sin(h)),
    ],
    lonePairs: [V3(-1, 0, 0)],
  };
}

function tShaped(axial) {
  const a = rad(axial);
  return {
    bonds: [V3(Math.cos(a), Math.sin(a), 0), V3(Math.cos(a), -Math.sin(a), 0), V3(1, 0, 0)],
    lonePairs: [V3(-0.5, 0, SQ3), V3(-0.5, 0, -SQ3)],
  };
}

function squarePyramid(axial) {
  const s = Math.sin(rad(axial));
  const c = Math.cos(rad(axial));
  return {
    bonds: [V3(0, 1, 0), V3(s, c, 0), V3(-s, c, 0), V3(0, c, s), V3(0, c, -s)],
    lonePairs: [V3(0, -1, 0)],
  };
}

/**
 * Lone pairs sit closer to the nucleus and repel harder than bonding pairs,
 * closing the bond angles. By how much depends on the molecule.
 *
 * Bent and pyramidal molecules have one angle, so the tilt away from the lone
 * pairs is found by bisection until the angle matches the measured value.
 * Seesaw, T-shaped and square pyramidal molecules have more than one angle
 * and are built directly. Where the lone pairs cancel (the trans pair in XeF₄,
 * the three equatorial ones in XeF₂) the resultant is zero and the ideal
 * angles are left exactly as they are.
 */
export function vseprGeometry(bonding, lone, molecule = moleculeFor(bonding, lone)) {
  const steric = clamp(bonding + lone, 2, 6);
  const directions = DOMAIN_DIRECTIONS[steric];
  const key = `${bonding}-${lone}`;
  const mol = molecule && molecule.bonding === bonding && molecule.lone === lone ? molecule : null;

  let built = null;
  if (key === "4-1" && mol?.axial) built = seesaw(mol.axial, mol.equatorial);
  if (key === "3-2" && mol?.axial) built = tShaped(mol.axial);
  if (key === "5-1" && mol?.axial) built = squarePyramid(mol.axial);

  let bonds;
  let lonePairs;
  if (built) {
    ({ bonds, lonePairs } = built);
  } else {
    lonePairs = directions.slice(bonding, bonding + lone).map((d) => d.clone());
    let push = null;
    if (lonePairs.length > 0) {
      const resultantLone = lonePairs.reduce((acc, d) => acc.clone().add(d), new THREE.Vector3());
      if (resultantLone.lengthSq() > 1e-6) push = resultantLone.normalize();
    }
    bonds = tiltBonds(directions, bonding, push, 0);
    if (push && bonds.length > 1) {
      const target = mol?.angle ?? smallestAngleOf(bonds) - LONE_PAIR_COMPRESSION * lone;
      let lo = 0;
      let hi = 0.8;
      for (let i = 0; i < 50; i += 1) {
        const mid = (lo + hi) / 2;
        if (smallestAngleOf(tiltBonds(directions, bonding, push, mid)) > target) lo = mid;
        else hi = mid;
      }
      bonds = tiltBonds(directions, bonding, push, lo);
    }
  }

  // Reported from the geometry actually drawn, so the number in the panel and
  // the shape on screen cannot drift apart.
  const smallest = smallestAngleOf(bonds);
  const resultant = bonds.reduce((acc, d) => acc.add(d.clone()), new THREE.Vector3());
  const shapeInfo = SHAPES[key];
  const symmetric = shapeInfo ? !shapeInfo.polar : resultant.length() < 0.08 && lone === 0;

  return {
    steric,
    bonds,
    lonePairs,
    smallestAngle: bonds.length > 1 ? smallest : 0,
    /** Each distinct bond angle with a pair of bonds that makes it, smallest first. */
    angles: bonds.length > 1 ? distinctAngles(bonds) : [],
    /** A shape is non-polar when bond and lone-pair dipoles cancel (XeF₄, XeF₂). */
    symmetric,
  };
}

/**
 * Everything a readout wants from the two pair counts, and the preset if one
 * is picked (it only counts when it fits the counts).
 *
 * `compression` is the angle the lone pairs have ACTUALLY closed, measured
 * off the solved geometry. For XeF₄ and XeF₂ it is zero, because the lone
 * pairs sit opposite each other and cancel.
 */
export function solveVsepr(bonding, lone, preset) {
  const nBonding = clamp(Math.round(Number(bonding) || 0), 1, 6);
  const nLone = clamp(Math.round(Number(lone) || 0), 0, Math.max(0, 6 - nBonding));
  const molecule = moleculeFor(nBonding, nLone, preset);
  const geometry = vseprGeometry(nBonding, nLone, molecule);
  const shape = SHAPES[`${nBonding}-${nLone}`] ?? { name: "—", example: "—", polar: false };
  const ideal = IDEAL_ANGLE[geometry.steric];
  // No lone pairs, no compression — by definition. Measuring it as
  // `ideal - smallestAngle` reported 0.03° for a plain tetrahedron, because
  // IDEAL_ANGLE carries the rounded 109.5° the syllabus prints rather than
  // the true 109.4712° the geometry is built from.
  const compression =
    nLone > 0 && nBonding > 1 ? Math.max(0, ideal - geometry.smallestAngle) : 0;

  return {
    bonding: nBonding,
    lone: nLone,
    steric: geometry.steric,
    electronGeometry: ELECTRON_GEOMETRY[geometry.steric],
    shape: shape.name,
    example: molecule?.label ?? shape.example,
    /** The real molecule drawn, if there is one: its name, atoms and bond order. */
    molecule,
    polar: !geometry.symmetric,
    symmetric: geometry.symmetric,
    ideal,
    idealLabel: IDEAL_ANGLE_LABEL[geometry.steric],
    angle: geometry.smallestAngle,
    /** Every distinct bond angle, smallest first (a seesaw has three). */
    angles: geometry.angles.map((a) => a.value),
    compression,
    /**
     * True when lone pairs are present but their repulsions cancel out, as
     * in XeF₄ and XeF₂. Needs two bonds: a diatomic has no angle to close,
     * so "the repulsions cancelled" would be the wrong thing to say about it.
     */
    cancels: nLone > 0 && nBonding > 1 && compression < 0.05,
    /** A diatomic has one bond and therefore no bond angle at all. */
    hasAngle: nBonding > 1,
    geometry,
    notation: `AX${nBonding}${nLone > 0 ? `E${nLone}` : ""}`,
  };
}
