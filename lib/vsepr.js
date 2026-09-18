// ─── VSEPR ──────────────────────────────────────────────────────────
// Electron-domain geometry: where the bonds and lone pairs point for a
// given AXₙEₘ, and what the resulting bond angle actually is.
//
// The scene has always solved this properly — bisecting on the lone-pair
// tilt until the smallest bond angle lands on the observed value, so water
// comes out at 104.5° and XeF₄ correctly stays at 90° because its two lone
// pairs cancel. The Details panel then threw all of that away: it looked
// the shape up in a table that stopped at 6-0, so seesaw, T-shaped, square
// pyramidal, square planar and linear XeF₂ all printed as
// "<electron geometry> (n bonds, m lone)" — and it reported a flat
// `lone × 2.5°` squeeze even for the cases where the repulsions cancel.
// AX₄E₂ read "Octahedral" with a "5.0° squeeze", contradicting both the
// scene beside it and the correct answer to the topic's own quiz.
//
// So the solver lives here and both sides call it.
// ─────────────────────────────────────────────────────────────────────

import * as THREE from "three";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const SQ3 = Math.sqrt(3) / 2;

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
 * and `lone` 0–3, constrained to a steric number of at most 6.
 */
export const SHAPES = {
  // One bonding pair is a diatomic — linear by definition, however many lone
  // pairs sit behind it. The sliders reach these, so they need naming.
  "1-0": { name: "Linear (diatomic)", example: "H₂", polar: false },
  "1-1": { name: "Linear (diatomic)", example: "HF", polar: true },
  "1-2": { name: "Linear (diatomic)", example: "HCl", polar: true },
  "1-3": { name: "Linear (diatomic)", example: "CO", polar: true },
  "2-0": { name: "Linear", example: "BeCl₂", polar: false },
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

/** Observed closing of the bond angle per lone pair: 109.5° → 107° → 104.5°. */
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

/** Tilts every bond away from the resultant lone-pair direction. */
function tiltBonds(directions, bonding, push, strength) {
  const bonds = directions.slice(0, bonding).map((d) => d.clone());
  if (push && strength > 0) {
    bonds.forEach((b) => b.addScaledVector(push, -strength).normalize());
  }
  return bonds;
}

/**
 * Lone pairs sit closer to the nucleus and so repel harder than bonding
 * pairs, closing the bond angles by roughly 2.5° each.
 *
 * Rather than tilt the bonds by a fixed amount — which overshot badly on two
 * lone pairs, putting water at 99.8° instead of its real 104.5° — the tilt is
 * solved for: bisect on the push strength until the smallest bond angle lands
 * on the observed value. Where the lone pairs cancel each other (the trans
 * pair in XeF₄, the three equatorial ones in XeF₂) the resultant is zero, no
 * tilt is possible, and the ideal angles correctly survive untouched.
 */
export function vseprGeometry(bonding, lone) {
  const steric = clamp(bonding + lone, 2, 6);
  const directions = DOMAIN_DIRECTIONS[steric];
  const lonePairs = directions.slice(bonding, bonding + lone).map((d) => d.clone());

  let push = null;
  if (lonePairs.length > 0) {
    const resultantLone = lonePairs.reduce((acc, d) => acc.add(d), new THREE.Vector3());
    if (resultantLone.lengthSq() > 1e-6) push = resultantLone.normalize();
  }

  let bonds = tiltBonds(directions, bonding, push, 0);
  if (push && bonds.length > 1) {
    const target = smallestAngleOf(bonds) - LONE_PAIR_COMPRESSION * lone;
    let lo = 0;
    let hi = 0.35;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (smallestAngleOf(tiltBonds(directions, bonding, push, mid)) > target) lo = mid;
      else hi = mid;
    }
    bonds = tiltBonds(directions, bonding, push, lo);
  }

  // Reported from the geometry actually drawn, so the number in the panel and
  // the shape on screen cannot drift apart.
  const smallest = smallestAngleOf(bonds);
  const resultant = bonds.reduce((acc, d) => acc.add(d.clone()), new THREE.Vector3());
  const shapeInfo = SHAPES[`${bonding}-${lone}`];
  const symmetric = shapeInfo ? !shapeInfo.polar : resultant.length() < 0.08 && lone === 0;

  return {
    steric,
    bonds,
    lonePairs,
    smallestAngle: bonds.length > 1 ? smallest : 0,
    /** A shape is non-polar when bond and lone-pair dipoles cancel (XeF₄, XeF₂). */
    symmetric,
  };
}

/**
 * Everything a readout wants from the two pair counts.
 *
 * `compression` is the angle the lone pairs have ACTUALLY closed, measured
 * off the solved geometry — not `lone × 2.5°`. For XeF₄ and XeF₂ it is zero,
 * because the lone pairs sit opposite each other and cancel.
 */
export function solveVsepr(bonding, lone) {
  const nBonding = clamp(Math.round(Number(bonding) || 0), 1, 6);
  const nLone = clamp(Math.round(Number(lone) || 0), 0, Math.max(0, 6 - nBonding));
  const geometry = vseprGeometry(nBonding, nLone);
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
    example: shape.example,
    polar: !geometry.symmetric,
    symmetric: geometry.symmetric,
    ideal,
    idealLabel: IDEAL_ANGLE_LABEL[geometry.steric],
    angle: geometry.smallestAngle,
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
