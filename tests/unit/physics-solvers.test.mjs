// ─── Physics & chemistry solvers, as they ship ───────────────────────
// This file used to open with nine private engines — solveRefraction,
// solveThinLens, solveRayOptics, solveGasLaw, solveInduction,
// solveSolenoidInduction, formatForce, solveProjectileFlight and a
// getHydrocarbonFormula that duplicated lib/organic.js — and assert
// against those. It proved nothing about the scenes, and the scenes had
// drifted: the HUD panel called an image "at infinity" within 0.03 of the
// focal point while the canvas used 0.035, and quoted a peak e.m.f. seven
// times smaller than the coil beside it generates.
//
// Each engine now lives in lib/ with exactly one copy, read by the scene,
// the HUD readout and this file.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AT_INFINITY_TOLERANCE,
  OPTICS_TITLES,
  OPTICS_TYPES,
  fresnelReflectance,
  imageNature,
  objectZone,
  opticsTypeOf,
  solveBlock,
  solveRayOptics,
} from "../../lib/rayOptics.js";
import {
  COIL_AREA,
  COIL_H,
  COIL_W,
  currentDirection,
  emfAt,
  fluxAt,
  inducedFieldOf,
  omegaOf,
  peakEmf,
  safeTurnsOf,
  solveInduction,
  solveSolenoidInduction,
} from "../../lib/induction.js";
import { SIM_DT, idealFlight, simulateFlight } from "../../lib/projectile.js";
import {
  ESCAPE_RATIO,
  G_SCENE,
  VIEW_MAX,
  VIEW_MIN,
  advanceOrbit,
  framing,
  muOf,
  solveOrbit,
  speedRegime,
  stepOrbit,
} from "../../lib/orbit.js";
import {
  FIELD_HALF_X,
  FIELD_NEAR_Z,
  SCREEN_CELLS,
  SCREEN_DISTANCE,
  SCREEN_Z,
  brightFringes,
  fringePosition,
  screenIntensity,
} from "../../lib/interference.js";
import { formatForce } from "../../lib/electrostatics.js";
import { GAS_REFERENCE, gasLawReadout } from "../../lib/particleModel.js";
import { atomCounts, formulaFor, MAX_CARBONS } from "../../lib/organic.js";

const deg = (rad) => (rad * 180) / Math.PI;

describe("Physics & Chemistry Mathematical Solvers", () => {
  describe("Wave Refraction & Snell's Law", () => {
    it("handles normal incidence (0 degrees) with 0 refraction and 0 displacement", () => {
      const res = solveBlock(0, 1.0, 1.5, 3);
      assert.strictEqual(res.tir, false);
      assert.strictEqual(res.r, 0);
      assert.strictEqual(res.lateral, 0);
      assert.strictEqual(res.run, 0);
      // About 4% comes straight back off glass even head-on.
      assert.ok(Math.abs(res.reflectance - 0.04) < 0.005, `reflectance ${res.reflectance}`);
    });

    it("correctly calculates air -> glass refraction (n1=1.0, n2=1.5, angle=30deg)", () => {
      const res = solveBlock(30, 1.0, 1.5, 3);
      assert.strictEqual(res.tir, false);
      // sin(r) = (1/1.5) * sin(30) = (1/1.5) * 0.5 = 0.333333 -> r ≈ 19.47°
      assert.ok(Math.abs(deg(res.r) - 19.47) < 0.1);
      assert.ok(res.lateral > 0);
      assert.strictEqual(res.critical, null, "no critical angle entering a denser medium");
    });

    it("emerges parallel to how it arrived, because the faces are parallel", () => {
      const res = solveBlock(42, 1.0, 1.52, 3);
      assert.strictEqual(res.e, res.i, "emergent angle equals the angle of incidence");
      assert.ok(deg(res.r) < 42, "and it travels inside the block bent toward the normal");
    });

    it("shifts further sideways through a thicker block, in proportion", () => {
      const thin = solveBlock(40, 1.0, 1.5, 2);
      const thick = solveBlock(40, 1.0, 1.5, 6);
      assert.ok(Math.abs(thick.lateral - thin.lateral * 3) < 1e-9);
    });

    it("detects Total Internal Reflection when entering rarer medium beyond critical angle", () => {
      // Glass (1.5) to Air (1.0). Critical angle is asin(1/1.5) ≈ 41.81°
      const subCritical = solveBlock(30, 1.5, 1.0, 3);
      assert.strictEqual(subCritical.tir, false);

      const superCritical = solveBlock(60, 1.5, 1.0, 3);
      assert.strictEqual(superCritical.tir, true);
      assert.strictEqual(superCritical.r, null);
      assert.strictEqual(superCritical.e, null);
      assert.strictEqual(superCritical.lateral, 0);
      assert.strictEqual(superCritical.reflectance, 1, "past the critical angle, all of it comes back");
      assert.ok(Math.abs(superCritical.critical - 41.81) < 0.1);
    });

    it("guards against division by zero at extreme 89.9 degree grazing incidence", () => {
      const res = solveBlock(89.9, 1.0, 1.5, 3);
      assert.strictEqual(res.tir, false);
      assert.ok(Number.isFinite(res.lateral));
      assert.ok(!Number.isNaN(res.lateral));
      assert.ok(Number.isFinite(res.run), "and the travel inside the block stays finite");
    });

    it("reflects nearly everything at grazing incidence — a window is a mirror edge-on", () => {
      const headOn = solveBlock(0, 1.0, 1.5, 3);
      const grazing = solveBlock(88, 1.0, 1.5, 3);
      assert.ok(grazing.reflectance > 0.7, `grazing reflectance ${grazing.reflectance}`);
      assert.ok(grazing.reflectance > headOn.reflectance * 10);
    });

    it("averages the two polarisations rather than taking one of them", () => {
      // The s-polarisation alone is larger than the unpolarised average at
      // every angle off the normal; the readout used to print that alone.
      const i = 60 * (Math.PI / 180);
      const r = Math.asin(Math.sin(i) / 1.5);
      const rs = (Math.cos(i) - 1.5 * Math.cos(r)) / (Math.cos(i) + 1.5 * Math.cos(r));
      const averaged = fresnelReflectance(i, r, 1.0, 1.5);
      assert.ok(averaged < rs * rs, `${averaged} is below the s-only ${rs * rs}`);
      assert.ok(averaged > 0 && averaged < 1);
    });

    it("clamps to total reflection when r is null, whatever the indices", () => {
      assert.strictEqual(fresnelReflectance(1.2, null, 1.5, 1.0), 1);
    });
  });

  describe("Ray Optics Solver — Lenses & Mirrors", () => {
    it("reads the element off params, honouring the older lensType", () => {
      assert.strictEqual(opticsTypeOf({ opticsType: "concave_mirror" }), "concave_mirror");
      assert.strictEqual(opticsTypeOf({ lensType: "concave" }), "concave_lens");
      assert.strictEqual(opticsTypeOf({ lensType: "convex" }), "convex_lens");
      assert.strictEqual(opticsTypeOf({}), "convex_lens", "defaults to the converging lens");
      assert.strictEqual(opticsTypeOf({ opticsType: "banana" }), "convex_lens", "an unknown type is not trusted");
      for (const t of OPTICS_TYPES) assert.ok(OPTICS_TITLES[t], `${t} has a title`);
    });

    it("calculates a real inverted image when the object is beyond 2f (convex lens)", () => {
      // f = 10, u = 30 -> v = (10*30)/(30-10) = 300/20 = 15
      const res = solveRayOptics({ type: "convex_lens", focal: 10, objectDistance: 30, objectHeight: 2 });
      assert.strictEqual(res.v, 15);
      assert.strictEqual(res.magnification, 0.5);
      assert.strictEqual(res.real, true);
      assert.strictEqual(res.inverted, true);
      assert.strictEqual(res.imageHeight, -1, "h' = −m·h: the scene draws it upside down");
      assert.strictEqual(res.imgX, 15, "a real lens image forms behind the lens");
      assert.strictEqual(imageNature(res), "Real, inverted, diminished");
    });

    it("calculates a virtual upright magnified image inside the focal length (u < f)", () => {
      // f = 10, u = 5 -> v = (10*5)/(10-5) = 50/5 = 10
      const res = solveRayOptics({ type: "convex_lens", focal: 10, objectDistance: 5, objectHeight: 2 });
      assert.strictEqual(res.v, 10);
      assert.strictEqual(res.magnification, 2);
      assert.strictEqual(res.real, false);
      assert.strictEqual(res.virtual, true);
      assert.strictEqual(res.upright, true);
      assert.strictEqual(res.imageHeight, 4);
      assert.strictEqual(res.imgX, -10, "a virtual lens image sits on the object's side");
      assert.strictEqual(imageNature(res), "Virtual, upright, magnified");
    });

    it("handles the object placed exactly at the focal point (u = f) gracefully", () => {
      const res = solveRayOptics({ type: "convex_lens", focal: 10, objectDistance: 10 });
      assert.strictEqual(res.atInfinity, true);
      assert.strictEqual(res.virtual, false, "no image at all, not a virtual one");
      assert.strictEqual(res.imageHeight, 0);
      assert.strictEqual(imageNature(res), "No image — rays leave parallel (spotlight)");
    });

    it("uses one tolerance for 'at infinity', not one per caller", () => {
      // The scene used 0.035 and the HUD readout 0.03, so between those two
      // numbers the panel printed "∞" over a scene still drawing an image.
      const f = 2.5;
      const inside = solveRayOptics({ type: "convex_lens", focal: f, objectDistance: f + AT_INFINITY_TOLERANCE * 0.9 });
      const outside = solveRayOptics({ type: "convex_lens", focal: f, objectDistance: f + AT_INFINITY_TOLERANCE * 1.1 });
      assert.strictEqual(inside.atInfinity, true);
      assert.strictEqual(outside.atInfinity, false);
      assert.ok(AT_INFINITY_TOLERANCE > 0 && AT_INFINITY_TOLERANCE < 0.1);
    });

    it("never reports a diverging element as being at infinity", () => {
      for (const type of ["concave_lens", "convex_mirror"]) {
        const res = solveRayOptics({ type, focal: 2.5, objectDistance: 2.5 });
        assert.strictEqual(res.atInfinity, false, type);
        assert.strictEqual(res.virtual, true, type);
      }
    });

    it("solves concave lens edge case without arrow disappearing", () => {
      // User bug case: f = 2.0, u = 5.1, h = 1.15
      const res = solveRayOptics({
        type: "concave_lens",
        focal: 2.0,
        objectDistance: 5.1,
        objectHeight: 1.15,
      });

      // v = (2 * 5.1) / (5.1 + 2) = 10.2 / 7.1 ≈ 1.4366
      assert.ok(Math.abs(res.v - 1.4366) < 0.001);
      assert.strictEqual(res.real, false);
      assert.strictEqual(res.virtual, true);
      assert.strictEqual(res.upright, true);

      // Image height ≈ 0.3239
      assert.ok(Math.abs(res.imageHeight - 0.3239) < 0.001);

      // Verify adaptive vector arrow logic:
      // Previously, length < 0.34 * 1.1 = 0.374 returned null!
      // With adaptive scaling:
      const length = Math.abs(res.imageHeight);
      const headLength = 0.34;
      const effHeadLength = Math.min(headLength, length * 0.45);
      const shaft = Math.max(0.001, length - effHeadLength);
      assert.ok(effHeadLength > 0 && effHeadLength < length);
      assert.ok(shaft > 0);
    });

    it("solves concave mirror real image formation (u > f)", () => {
      // Concave mirror, f = 2, u = 6, h = 1.5 -> v = (2*6)/(6-2) = 3
      const res = solveRayOptics({
        type: "concave_mirror",
        focal: 2.0,
        objectDistance: 6.0,
        objectHeight: 1.5,
      });

      assert.strictEqual(res.v, 3.0);
      assert.strictEqual(res.imgX, -3.0); // Real image forms in front of mirror
      assert.strictEqual(res.real, true);
      assert.strictEqual(res.inverted, true);
      assert.strictEqual(res.magnification, 0.5);
      assert.strictEqual(res.imageHeight, -0.75);
      assert.strictEqual(res.isMirror, true);
      assert.strictEqual(res.isConverging, true);
    });

    it("solves concave mirror virtual magnifier image (u < f)", () => {
      // Concave mirror, f = 2, u = 1, h = 1.5 -> v = (2*1)/(2-1) = 2
      const res = solveRayOptics({
        type: "concave_mirror",
        focal: 2.0,
        objectDistance: 1.0,
        objectHeight: 1.5,
      });

      assert.strictEqual(res.v, 2.0);
      assert.strictEqual(res.imgX, 2.0); // Virtual image forms behind mirror
      assert.strictEqual(res.virtual, true);
      assert.strictEqual(res.upright, true);
      assert.strictEqual(res.magnification, 2.0);
      assert.strictEqual(res.imageHeight, 3.0);
    });

    it("solves convex mirror always producing virtual diminished image", () => {
      // Convex mirror, f = 2, u = 6, h = 2.0 -> v = (2*6)/(6+2) = 12/8 = 1.5
      const res = solveRayOptics({
        type: "convex_mirror",
        focal: 2.0,
        objectDistance: 6.0,
        objectHeight: 2.0,
      });

      assert.strictEqual(res.v, 1.5);
      assert.strictEqual(res.imgX, 1.5); // Behind mirror
      assert.strictEqual(res.virtual, true);
      assert.strictEqual(res.upright, true);
      assert.strictEqual(res.magnification, 0.25);
      assert.strictEqual(res.imageHeight, 0.5);
      assert.strictEqual(imageNature(res), "Virtual, upright, diminished");
    });

    it("agrees with the textbook zone the object is standing in", () => {
      assert.strictEqual(objectZone(10, 30), "Beyond 2F (C)");
      assert.strictEqual(objectZone(10, 15), "Between F & 2F");
      assert.strictEqual(objectZone(10, 5), "Inside F");
      // A real image is diminished beyond 2F and magnified inside it — the
      // zone label and the magnification cannot disagree.
      assert.ok(solveRayOptics({ type: "convex_lens", focal: 10, objectDistance: 30 }).magnification < 1);
      assert.ok(solveRayOptics({ type: "convex_lens", focal: 10, objectDistance: 15 }).magnification > 1);
    });

    it("calls an image at exactly 2f the same size", () => {
      const res = solveRayOptics({ type: "convex_lens", focal: 10, objectDistance: 20, objectHeight: 1.5 });
      assert.strictEqual(res.magnification, 1);
      assert.strictEqual(res.v, 20);
      assert.strictEqual(imageNature(res), "Real, inverted, same size");
    });
  });

  describe("Motor Effect Flow Speeds & Animation Scaling", () => {
    it("scales all flow pulse speeds linearly with animation speed", () => {
      const field = 1.2;
      const current = 1.5;
      const force = field * current * 1.0;
      const baseFieldSpeed = (0.22 + field * 0.34);
      const baseCurrentSpeed = (0.24 + current * 0.42);
      const baseForceSpeed = (0.2 + force * 0.4);
      const baseLinesSpeed = (0.1 + field * 0.16);

      for (const animSpeed of [0.5, 1.0, 2.0, 3.0]) {
        assert.strictEqual(baseFieldSpeed * animSpeed, (0.22 + field * 0.34) * animSpeed);
        assert.strictEqual(baseCurrentSpeed * animSpeed, (0.24 + current * 0.42) * animSpeed);
        assert.strictEqual(baseForceSpeed * animSpeed, (0.2 + force * 0.4) * animSpeed);
        assert.strictEqual(baseLinesSpeed * animSpeed, (0.1 + field * 0.16) * animSpeed);
      }
    });
  });

  describe("Kinetic Gas Laws (p ∝ NT/V)", () => {
    it("pins the pressure scale to one atmosphere at the reference point", () => {
      const ref = gasLawReadout({
        temperature: GAS_REFERENCE.tempK,
        volume: 1,
        particles: GAS_REFERENCE.particles,
      });
      assert.strictEqual(ref.pressureKPa, GAS_REFERENCE.pressureKPa);
      assert.strictEqual(ref.pV, GAS_REFERENCE.pressureKPa);
    });

    it("increases pressure when temperature increases at constant volume", () => {
      const cold = gasLawReadout({ temperature: 300, volume: 10 });
      const hot = gasLawReadout({ temperature: 600, volume: 10 });
      assert.strictEqual(hot.pressureKPa, cold.pressureKPa * 2);
      // The pressure law: p ÷ T is what holds still, not pV.
      assert.ok(Math.abs(hot.pOverT - cold.pOverT) < 1e-12);
    });

    it("increases pressure when volume decreases at constant temperature (Boyle's Law)", () => {
      const largeVol = gasLawReadout({ temperature: 300, volume: 20 });
      const smallVol = gasLawReadout({ temperature: 300, volume: 10 });
      assert.strictEqual(smallVol.pressureKPa, largeVol.pressureKPa * 2);
      // And pV is the constant that refuses to move while both of them do.
      assert.ok(Math.abs(smallVol.pV - largeVol.pV) < 1e-9);
    });

    it("doubles the pressure when twice as many particles are in there", () => {
      const few = gasLawReadout({ particles: 30, temperature: 300, volume: 1 });
      const many = gasLawReadout({ particles: 60, temperature: 300, volume: 1 });
      assert.strictEqual(many.pressureKPa, few.pressureKPa * 2);
    });

    it("clamps minimum volume and temperature to prevent negative values or division by zero", () => {
      const zero = gasLawReadout({ temperature: 0, volume: 0, particles: 0 });
      assert.ok(zero.pressureKPa > 0);
      assert.ok(Number.isFinite(zero.pressureKPa));
      assert.ok(zero.volume > 0 && zero.temperatureK > 0 && zero.particles > 0);

      const nonsense = gasLawReadout({ temperature: -400, volume: -3, particles: -10 });
      assert.ok(Number.isFinite(nonsense.pressureKPa) && nonsense.pressureKPa > 0);
    });
  });

  describe("Organic Chemistry Homologous Series Formulas", () => {
    // These read lib/organic.js, which the scene and the HUD both use. The
    // private copy here spelled the acid series "carboxylic" and wrote plain
    // digits where the shipped formatter writes unicode subscripts, so the
    // two could never have agreed about what appears on screen.
    it("generates correct Alkane counts (CnH2n+2) from C1 to C12", () => {
      assert.deepStrictEqual(atomCounts("alkane", 1), { c: 1, h: 4, o: 0 });
      assert.deepStrictEqual(atomCounts("alkane", 8), { c: 8, h: 18, o: 0 });
      assert.deepStrictEqual(atomCounts("alkane", 12), { c: 12, h: 26, o: 0 });
      assert.strictEqual(MAX_CARBONS, 12, "the chain-name table is what caps the slider");
    });

    it("generates correct Alkene and Alkyne counts", () => {
      assert.deepStrictEqual(atomCounts("alkene", 2), { c: 2, h: 4, o: 0 });
      assert.deepStrictEqual(atomCounts("alkyne", 2), { c: 2, h: 2, o: 0 });
      assert.deepStrictEqual(atomCounts("alkyne", 4), { c: 4, h: 6, o: 0 });
    });

    it("generates correct Alcohols and Carboxylic Acids", () => {
      assert.deepStrictEqual(atomCounts("alcohol", 2), { c: 2, h: 6, o: 1 });
      assert.deepStrictEqual(atomCounts("acid", 2), { c: 2, h: 4, o: 2 });
    });

    it("formats formulae the way the scene prints them", () => {
      assert.strictEqual(formulaFor("alkane", 8), "C₈H₁₈");
      assert.strictEqual(formulaFor("alkene", 2), "C₂H₄");
      assert.strictEqual(formulaFor("alkyne", 2), "C₂H₂");
      // Alcohols are conventionally written with the –OH spelled out.
      assert.strictEqual(formulaFor("alcohol", 2), "C₂H₅OH");
      assert.strictEqual(formulaFor("acid", 2), "C₂H₄O₂");
      assert.strictEqual(formulaFor("alkane", 1), "CH₄", "no subscript on a single atom");
    });

    it("refuses a chain too short for its series instead of inventing one", () => {
      // There is no one-carbon alkene, and the scene says so rather than
      // falling through to the alkane formula.
      assert.strictEqual(formulaFor("alkene", 1), "—");
      assert.strictEqual(formulaFor("alkyne", 1), "—");
    });
  });

  describe("Electromagnetic Induction & Faraday's Law", () => {
    it("derives the coil area from the geometry the scene is built from", () => {
      assert.strictEqual(COIL_AREA, 2 * COIL_W * 2 * COIL_H);
      assert.strictEqual(COIL_AREA, 6.0, "6.0 m² is the number the readout prints");
      assert.strictEqual(solveInduction({}).coilArea, COIL_AREA);
    });

    it("computes zero induced EMF and zero omega when stationary (speed = 0)", () => {
      // Edge-on is where a turning coil would be at its best, so a zero here
      // is the coil not turning, not the coil being at a quiet angle.
      const res = solveInduction({ speed: 0, field: 1.5, turns: 5, angle: Math.PI / 2 });
      assert.strictEqual(res.omega, 0);
      assert.strictEqual(res.peakEmf, 0);
      assert.strictEqual(res.emf, 0);
      assert.strictEqual(res.direction, "none");
    });

    it("doubles peak EMF when turns N or speed or field B is doubled", () => {
      const base = solveInduction({ speed: 1.0, field: 1.0, turns: 2 });
      const doubleTurns = solveInduction({ speed: 1.0, field: 1.0, turns: 4 });
      const doubleSpeed = solveInduction({ speed: 2.0, field: 1.0, turns: 2 });
      const doubleField = solveInduction({ speed: 1.0, field: 2.0, turns: 2 });

      assert.strictEqual(doubleTurns.peakEmf, base.peakEmf * 2);
      assert.strictEqual(doubleSpeed.peakEmf, base.peakEmf * 2);
      assert.strictEqual(doubleField.peakEmf, base.peakEmf * 2);
    });

    it("builds the peak from N·B·A·ω, and nothing smaller", () => {
      // The HUD panel printed speed·B·N·1.5 here, which is COIL_AREA·1.7
      // — seven times — short of what the coil generates.
      const res = solveInduction({ speed: 1.0, field: 1.0, turns: 3 });
      assert.strictEqual(res.omega, omegaOf(1.0));
      assert.strictEqual(res.peakEmf, peakEmf(1.0, res.omega, 3));
      assert.strictEqual(res.peakEmf, 3 * 1.0 * COIL_AREA * 1.7);
      assert.ok(res.peakEmf > 1.0 * 3 * 1.5 * 6, "and it is far more than the old estimate");
    });

    it("follows the textbook: Φ = BA cos θ, ε = NBAω sin θ, with θ = 0 face-on", () => {
      // Face-on the coil's normal lies along B: flux is greatest and is not
      // changing, so there is no e.m.f.
      const faceOn = solveInduction({ speed: 1.0, field: 1.0, turns: 3, angle: 0 });
      assert.strictEqual(faceOn.cuttingRate, 0);
      assert.strictEqual(faceOn.emf, 0);
      assert.strictEqual(faceOn.flux, 6.0); // 1.0 T · 6.0 m² · cos 0
      assert.strictEqual(faceOn.flux, fluxAt(1.0, 0));

      // Edge-on the coil sweeps across the field lines as fast as it ever
      // does: no flux through it, and the e.m.f. at its peak.
      const edgeOn = solveInduction({ speed: 1.0, field: 1.0, turns: 3, angle: Math.PI / 2 });
      assert.strictEqual(edgeOn.cuttingRate, 1);
      assert.ok(Math.abs(edgeOn.flux) < 1e-9);
      assert.strictEqual(Math.abs(edgeOn.emf), edgeOn.peakEmf);
    });

    it("reverses the induced current over half a turn", () => {
      const a = solveInduction({ speed: 1.0, field: 1.0, turns: 3, angle: Math.PI / 2 });
      const b = solveInduction({ speed: 1.0, field: 1.0, turns: 3, angle: (3 * Math.PI) / 2 });
      assert.strictEqual(a.emf, -b.emf);
      assert.notStrictEqual(a.direction, b.direction);
      assert.strictEqual(a.emf, emfAt(1.0, a.omega, Math.PI / 2, 3));
    });

    it("takes its sign from Lenz's law: ε = −N dΦ/dt, checked against the flux itself", () => {
      // Differentiate the flux numerically and compare — if the sign of emfAt
      // ever drifts from −N dΦ/dt this fails, whatever the convention says.
      const omega = omegaOf(1.0);
      const N = 3;
      const e = 1e-5;
      for (const theta of [0.3, 1.2, 2.5, 3.6, 5.0]) {
        const dPhi_dtheta = (fluxAt(1.0, theta + e) - fluxAt(1.0, theta - e)) / (2 * e);
        const expected = -N * dPhi_dtheta * omega;
        assert.ok(Math.abs(emfAt(1.0, omega, theta, N) - expected) < 1e-6, `θ = ${theta}`);
      }
      // Just after face-on the flux is falling, so the current opposes that
      // by making a field along the normal: anticlockwise, from the normal's tip.
      assert.strictEqual(solveInduction({ speed: 1.0, turns: 3, angle: 0.4 }).direction, "anticlockwise");
      assert.strictEqual(solveInduction({ speed: 1.0, turns: 3, angle: 3.6 }).direction, "clockwise");
    });

    it("quotes the frequency as ω/2π, not the slider value", () => {
      // One slider unit is 1.7 rad/s, i.e. 0.27 Hz — the readout used to
      // print "1.0 Hz" for it.
      const res = solveInduction({ speed: 1.0 });
      assert.ok(Math.abs(res.frequencyHz - 1.7 / (2 * Math.PI)) < 1e-12);
      assert.ok(Math.abs(res.period * res.frequencyHz - 1) < 1e-12);
      assert.strictEqual(solveInduction({ speed: 0 }).period, Infinity);
    });

    it("rests the needle rather than flickering a direction at near-zero emf", () => {
      assert.strictEqual(currentDirection(0), "none");
      assert.strictEqual(currentDirection(-0), "none");
      assert.strictEqual(currentDirection(0.049), "none");
      assert.strictEqual(currentDirection(0.051), "anticlockwise");
      assert.strictEqual(currentDirection(-0.051), "clockwise");
      assert.strictEqual(inducedFieldOf(0.049), 0);
      assert.strictEqual(inducedFieldOf(0.051), 1);
      assert.strictEqual(inducedFieldOf(-0.051), -1);
    });

    it("clamps safe turns to minimum 1 for undefined or zero inputs", () => {
      const res1 = solveInduction({ speed: 1.0, field: 1.0, turns: 0, angle: 1 });
      const res2 = solveInduction({ speed: 1.0, field: 1.0, turns: undefined, angle: 1 });
      assert.ok(res1.peakEmf > 0);
      assert.ok(res2.peakEmf > 0);
      assert.strictEqual(res1.peakEmf, res2.peakEmf);
      assert.strictEqual(res1.turns, 1);
      assert.strictEqual(safeTurnsOf(2.6), 3, "half a winding is not a coil");
      assert.strictEqual(safeTurnsOf(-4), 1);
    });

    it("computes zero EMF for a stationary bar magnet (velocity = 0), wherever it is", () => {
      const centred = solveSolenoidInduction({ x: 0, velocity: 0, turns: 10 });
      assert.strictEqual(centred.emf, 0);
      assert.strictEqual(centred.direction, "none");
      assert.ok(centred.flux > 0);
      assert.strictEqual(centred.dPhi_dx, 0, "flux is at its peak, so its gradient is zero");
      // Held with a pole in the coil the flux is changing with position, but
      // not with time — still nothing.
      const held = solveSolenoidInduction({ x: 1.3, velocity: 0, turns: 10 });
      assert.ok(held.flux > 0);
      assert.strictEqual(held.emf, 0);
    });

    it("reverses EMF direction when moving inward vs outward along solenoid axis", () => {
      const movingIn = solveSolenoidInduction({ x: -1.35, velocity: 2.0, turns: 10 });
      const movingOut = solveSolenoidInduction({ x: 1.35, velocity: 2.0, turns: 10 });
      assert.ok(movingIn.emf < 0);
      assert.ok(movingOut.emf > 0);
      assert.notStrictEqual(movingIn.direction, movingOut.direction);
    });

    it("makes an induced field that opposes the change in flux (Lenz), by finite difference", () => {
      // Flux linkage is measured along +x, so the induced field must point
      // against dλ/dt: −1 while it is growing, +1 while it is shrinking.
      const flux = (x) => solveSolenoidInduction({ x, velocity: 0, turns: 5 }).linkage;
      for (const [x, v] of [[-1.35, 1], [-0.6, 1], [0.6, 1], [1.35, 1], [1.35, -1], [-1.35, -1]]) {
        const dLambda_dt = ((flux(x + 1e-4) - flux(x - 1e-4)) / 2e-4) * v;
        const res = solveSolenoidInduction({ x, velocity: v, turns: 5 });
        assert.ok(Math.abs(res.emf + dLambda_dt) < 1e-6, `ε = −dλ/dt at x=${x}, v=${v}`);
        assert.strictEqual(res.inducedField, dLambda_dt > 0 ? -1 : 1, `Lenz at x=${x}, v=${v}`);
      }
    });

    it("peaks as a pole passes the coil, not with the magnet centred in it", () => {
      // A 2.7-long bar: the flux changes fastest when an end reaches the
      // coil, i.e. with the magnet's centre about half a length (1.35) away.
      // A point-dipole model put the peak at ±0.46, with the magnet mostly inside.
      const at = (x) => Math.abs(solveSolenoidInduction({ x, velocity: 1.0, turns: 4 }).emf);
      let bestX = 0;
      let best = 0;
      for (let x = 0; x <= 3; x += 0.05) {
        if (at(x) > best) {
          best = at(x);
          bestX = x;
        }
      }
      assert.ok(bestX > 1.1 && bestX < 1.6, `peak at x = ${bestX.toFixed(2)}, expected near 1.35`);
      assert.ok(at(0) < 1e-9, "and nothing at all with the magnet centred");
      assert.ok(at(0.46) < 0.4 * best, "the old peak position is now well below the maximum");
    });

    it("reverses EMF sign when magnet poles are flipped (flipPoles = true)", () => {
      const normal = solveSolenoidInduction({ x: -1.5, velocity: 2.0, turns: 10, flipPoles: false });
      const flipped = solveSolenoidInduction({ x: -1.5, velocity: 2.0, turns: 10, flipPoles: true });
      assert.strictEqual(flipped.emf, -normal.emf);
      assert.strictEqual(flipped.flux, -normal.flux);
      assert.strictEqual(flipped.inducedField, -normal.inducedField);
    });

    it("scales EMF with coil turns and exactly with magnet velocity", () => {
      const base = solveSolenoidInduction({ x: -1.0, velocity: 1.0, turns: 4 });
      const doubleTurns = solveSolenoidInduction({ x: -1.0, velocity: 1.0, turns: 8 });
      const doubleSpeed = solveSolenoidInduction({ x: -1.0, velocity: 2.0, turns: 4 });
      // The turns sit side by side on a compact bobbin, so each links very
      // nearly the same flux and ε ∝ N holds to within a few percent.
      const ratio = doubleTurns.emf / base.emf;
      assert.ok(ratio > 1.9 && ratio < 2.1, `doubling N gave ×${ratio.toFixed(3)}`);
      assert.ok(Math.abs(doubleSpeed.emf - base.emf * 2) < 1e-9);
      // And it is linear in the magnet strength.
      const strong = solveSolenoidInduction({ x: -1.0, velocity: 1.0, turns: 4, magnetStrength: 2.4 });
      const weak = solveSolenoidInduction({ x: -1.0, velocity: 1.0, turns: 4, magnetStrength: 1.2 });
      assert.ok(Math.abs(strong.emf - weak.emf * 2) < 1e-9);
    });

    it("falls off with distance, so the magnet matters most near the coil", () => {
      const near = solveSolenoidInduction({ x: 0.2, velocity: 1.0, turns: 10 });
      const far = solveSolenoidInduction({ x: 6.0, velocity: 1.0, turns: 10 });
      assert.ok(Math.abs(near.flux) > Math.abs(far.flux) * 50, "flux falls off steeply");
      assert.ok(
        Math.abs(solveSolenoidInduction({ x: 8, velocity: 1, turns: 10 }).emf) <
          0.05 * Math.abs(solveSolenoidInduction({ x: 1.35, velocity: 1, turns: 10 }).emf),
        "a magnet well clear of the coil hardly moves the needle",
      );
      const offTheBench = solveSolenoidInduction({ x: 40, velocity: 1.0, turns: 10 });
      assert.strictEqual(offTheBench.direction, "none", "too far out to move the needle");
    });
  });

  describe("Two-Source Interference & the Screen", () => {
    const pair = (d) => [-d / 2, d / 2];

    it("measures the screen distance from the sources, the L every fringe formula needs", () => {
      assert.strictEqual(SCREEN_DISTANCE, SCREEN_Z - FIELD_NEAR_Z);
      assert.ok(Math.abs(SCREEN_DISTANCE - 10.7) < 1e-12, "the HUD used to print 10.2 for this");
    });

    it("samples the whole screen finely and evenly", () => {
      const cells = screenIntensity(pair(2.2), 1.2, 0.62);
      assert.strictEqual(cells.length, SCREEN_CELLS);
      assert.ok(SCREEN_CELLS >= 200, "fine enough that a fringe is many cells wide");
      assert.strictEqual(cells[0].x, -FIELD_HALF_X);
      assert.ok(Math.abs(cells.at(-1).x - FIELD_HALF_X) < 1e-9);
      const step = cells[1].x - cells[0].x;
      for (let i = 2; i < cells.length; i += 1) assert.ok(Math.abs(cells[i].x - cells[i - 1].x - step) < 1e-9);
      assert.ok(cells.every((c) => c.level >= 0 && c.level <= 1 + 1e-12), "levels are fractions of the peak");
      assert.ok(Math.max(...cells.map((c) => c.level)) === 1, "and the brightest cell is exactly 1");
    });

    it("puts each bright fringe on an intensity maximum, and each half-order on a minimum", () => {
      // The closed form and the phasor sum are independent routes to the same
      // pattern, so agreement to within a cell means the labels are in the
      // right place — not merely near it.
      for (const [d, lambda] of [[4.5, 0.5], [3.0, 0.8], [3.6, 0.6]]) {
        const cells = screenIntensity(pair(d), lambda, 0.62);
        const cell = cells[1].x - cells[0].x;
        const near = (x, r) => cells.filter((c) => Math.abs(c.x - x) <= r);
        for (const { order, x } of brightFringes(d, lambda)) {
          const peak = near(x, 0.5).reduce((a, b) => (b.level > a.level ? b : a));
          assert.ok(Math.abs(peak.x - x) <= 1.5 * cell, `d=${d} λ=${lambda} m=${order}: peak at ${peak.x.toFixed(3)}, predicted ${x.toFixed(3)}`);
          assert.ok(peak.level > 0.85, `m=${order} is a bright fringe (level ${peak.level.toFixed(2)})`);
        }
        const dark = fringePosition(0.5, d, lambda);
        const trough = near(dark, 0.5).reduce((a, b) => (b.level < a.level ? b : a));
        assert.ok(Math.abs(trough.x - dark) <= 1.5 * cell && trough.level < 0.02, `d=${d}: dark fringe at ${dark.toFixed(3)}`);
      }
    });

    it("beats the far-field L·tan θ, which is only good when L is much larger than d", () => {
      const d = 4.5;
      const lambda = 0.5;
      const farField = (m) => SCREEN_DISTANCE * Math.tan(Math.asin((m * lambda) / d));
      // In this tank the far-field estimate is measurably off at high order...
      assert.ok(Math.abs(fringePosition(4, d, lambda) - farField(4)) > 0.05);
      // ...and the exact formula turns into it as the screen recedes.
      const far = 1e5;
      const exact = fringePosition(3, d, lambda, far);
      const approx = far * Math.tan(Math.asin((3 * lambda) / d));
      assert.ok(Math.abs(exact - approx) / approx < 1e-4, `${exact} vs ${approx}`);
    });

    it("mirrors about the centre line and has no fringe beyond the slit separation", () => {
      assert.strictEqual(fringePosition(-2, 4.5, 0.5), -fringePosition(2, 4.5, 0.5));
      assert.strictEqual(fringePosition(0, 4.5, 0.5), 0);
      // The path difference can never exceed d, so mλ ≥ d has nowhere to land.
      assert.strictEqual(fringePosition(1, 1.0, 1.2), null);
      assert.strictEqual(fringePosition(2, 2.2, 1.2), null);
      assert.strictEqual(fringePosition(1, 0, 1.2), null);
    });

    it("lists the bright fringes that land on the screen, left to right, centre included", () => {
      const list = brightFringes(4.5, 0.5);
      assert.deepStrictEqual(list.map((f) => f.order), [-4, -3, -2, -1, 0, 1, 2, 3, 4]);
      for (let i = 1; i < list.length; i += 1) assert.ok(list[i].x > list[i - 1].x, "ascending");
      assert.ok(list.every((f) => Math.abs(f.x) <= FIELD_HALF_X), "and all on the screen");
      // With these slits the first order is off the screen, so only the centre is left.
      assert.deepStrictEqual(brightFringes(2.2, 1.2).map((f) => f.order), [0]);
      // A wavelength as long as the separation gives one fringe and no others.
      assert.deepStrictEqual(brightFringes(1.0, 1.0).map((f) => f.order), [0]);
    });

    it("gives a single source a smooth falling profile with no fringes", () => {
      const cells = screenIntensity([0], 1.2, 0.62);
      const mid = cells[(cells.length - 1) / 2];
      assert.strictEqual(mid.x, 0);
      assert.strictEqual(mid.level, 1);
      for (let i = (cells.length - 1) / 2 + 1; i < cells.length; i += 1) {
        assert.ok(cells[i].level < cells[i - 1].level, "falls steadily away from the axis");
      }
    });
  });

  describe("Gravity Wells & Orbital Motion", () => {
    /** Flies a launch with the scene's own integrator and reports what it did. */
    const fly = (launch, seconds, h = 0.002) => {
      const o = solveOrbit(launch);
      const s = { x: launch.launchRadius, z: 0, vx: 0, vz: launch.launchSpeed };
      const e0 = o.energy;
      const L0 = s.x * s.vz - s.z * s.vx;
      let rmin = Infinity;
      let rmax = 0;
      let drift = 0;
      let lDrift = 0;
      for (let t = 0; t < seconds; t += h) {
        stepOrbit(s, o.mu, h);
        const r = Math.hypot(s.x, s.z);
        rmin = Math.min(rmin, r);
        rmax = Math.max(rmax, r);
        drift = Math.max(drift, Math.abs((s.vx * s.vx + s.vz * s.vz) / 2 - o.mu / r - e0));
        lDrift = Math.max(lDrift, Math.abs(s.x * s.vz - s.z * s.vx - L0));
      }
      return { o, s, rmin, rmax, drift, lDrift, r: Math.hypot(s.x, s.z), v: Math.hypot(s.vx, s.vz) };
    };

    it("takes μ from one place: G·M, with G fixed for the scene", () => {
      assert.strictEqual(G_SCENE, 6);
      assert.strictEqual(muOf(1), 6);
      assert.strictEqual(muOf(2.5), 15);
      assert.strictEqual(solveOrbit({ mass: 3 }).mu, 18);
    });

    it("makes a circle at exactly √(μ/r), and an escape at exactly √2 times that", () => {
      const r = 3.4;
      const circ = solveOrbit({ mass: 1, launchRadius: r, launchSpeed: Math.sqrt(6 / r) });
      assert.ok(circ.eccentricity < 1e-9);
      assert.strictEqual(circ.kind, "circular");
      assert.ok(Math.abs(circ.periapsis - r) < 1e-9 && Math.abs(circ.apoapsis - r) < 1e-9);
      assert.ok(Math.abs(circ.period - (2 * Math.PI * r) / circ.circularSpeed) < 1e-9);

      const esc = solveOrbit({ mass: 1, launchRadius: r, launchSpeed: Math.sqrt(12 / r) });
      assert.ok(Math.abs(esc.energy) < 1e-12, "ε = 0 at the escape speed");
      assert.ok(Math.abs(esc.eccentricity - 1) < 1e-9, "a parabola, e = 1");
      assert.ok(Math.abs(esc.escapeSpeed / esc.circularSpeed - Math.SQRT2) < 1e-12);
    });

    it("obeys Kepler's third law, T² = 4π²a³/μ, whatever the launch", () => {
      for (const launch of [
        { mass: 1, launchRadius: 3.4, launchSpeed: 1.7 },
        { mass: 2, launchRadius: 2.0, launchSpeed: 3.0 },
        { mass: 0.5, launchRadius: 5.0, launchSpeed: 0.9 },
        { mass: 3, launchRadius: 6.0, launchSpeed: 2.0 },
      ]) {
        const o = solveOrbit(launch);
        assert.ok(o.bound, JSON.stringify(launch));
        const k = (o.period * o.period) / (o.semiMajor ** 3);
        assert.ok(Math.abs(k - (4 * Math.PI * Math.PI) / o.mu) < 1e-9, JSON.stringify(launch));
      }
    });

    it("has the launch point as the closest point above circular speed and the farthest below it", () => {
      const fast = solveOrbit({ mass: 1, launchRadius: 3.4, launchSpeed: 1.7 });
      const slow = solveOrbit({ mass: 1, launchRadius: 3.4, launchSpeed: 0.9 });
      assert.ok(Math.abs(fast.periapsis - 3.4) < 1e-9 && fast.apoapsis > 3.4);
      assert.ok(Math.abs(slow.apoapsis - 3.4) < 1e-9 && slow.periapsis < 3.4);
      // Energy and angular momentum fix both, and the two ends average to a.
      assert.ok(Math.abs((fast.periapsis + fast.apoapsis) / 2 - fast.semiMajor) < 1e-9);
    });

    it("leaves a satellite that has escape speed with the speed left over at infinity, ½v∞² = ε", () => {
      const o = solveOrbit({ mass: 1, launchRadius: 3.4, launchSpeed: 2.5 });
      assert.strictEqual(o.bound, false);
      assert.strictEqual(o.kind, "hyperbolic");
      assert.strictEqual(o.apoapsis, null);
      assert.strictEqual(o.period, null);
      assert.ok(Math.abs(o.speedAtInfinity - Math.sqrt(2.5 * 2.5 - o.escapeSpeed ** 2)) < 1e-12);
    });

    it("flies the orbit the formulae promise: a closed circle, and an ellipse between periapsis and apoapsis", () => {
      // A circle comes back to where it started after exactly one period.
      const c = solveOrbit({ mass: 1, launchRadius: 3.4, launchSpeed: Math.sqrt(6 / 3.4) });
      const lap = fly({ mass: 1, launchRadius: 3.4, launchSpeed: Math.sqrt(6 / 3.4) }, c.period);
      assert.ok(Math.hypot(lap.s.x - 3.4, lap.s.z) < 0.01, `back to (${lap.s.x.toFixed(4)}, ${lap.s.z.toFixed(4)})`);
      assert.ok(lap.rmax - lap.rmin < 1e-5, "and never leaves radius 3.4");

      // An ellipse sweeps out exactly the radii the conic says.
      const launch = { mass: 1, launchRadius: 3.4, launchSpeed: 1.7 };
      const o = solveOrbit(launch);
      const run = fly(launch, o.period * 1.02);
      assert.ok(Math.abs(run.rmin - o.periapsis) < 1e-3, `rmin ${run.rmin} vs ${o.periapsis}`);
      assert.ok(Math.abs(run.rmax - o.apoapsis) < 2e-3, `rmax ${run.rmax} vs ${o.apoapsis}`);
    });

    it("conserves energy and angular momentum over many orbits — it never spirals in", () => {
      const run = fly({ mass: 1, launchRadius: 3.4, launchSpeed: 1.7 }, 300);
      assert.ok(run.drift < 1e-5, `energy wandered by ${run.drift}`);
      assert.ok(run.lDrift < 1e-9, `angular momentum drifted by ${run.lDrift}`);
    });

    it("never stops a satellite that is leaving: the maxed-out launch flies on, out past 100 units", () => {
      // Light central mass, biggest radius, fastest launch — the corner of the
      // sliders. This used to be frozen at the edge of a sheet 7 units wide.
      const launch = { mass: 0.3, launchRadius: 6, launchSpeed: 3.5 };
      const o = solveOrbit(launch);
      assert.strictEqual(o.bound, false);
      const run = fly(launch, 40, 0.004);
      assert.ok(run.r > 100, `only reached r = ${run.r.toFixed(1)}`);
      // Still moving at essentially the speed the energy says it has left.
      assert.ok(run.v > o.speedAtInfinity && run.v < o.speedAtInfinity * 1.02, `v = ${run.v} vs v∞ ${o.speedAtInfinity}`);
      // And the strongest pull the sliders allow, at the other end of the range.
      const heavy = fly({ mass: 3, launchRadius: 6, launchSpeed: 3.5 }, 40, 0.004);
      assert.ok(heavy.r > 80 && heavy.drift < 1e-4);
    });

    it("sizes every launch the sliders allow, so the camera can be told how much room to leave", () => {
      // The widest bound orbit the controls can make: still finite, still closed.
      const wide = solveOrbit({ mass: 3, launchRadius: 6, launchSpeed: 2.4 });
      assert.ok(wide.bound && wide.apoapsis > 100 && Number.isFinite(wide.period));
      for (const mass of [0.3, 1, 3]) {
        for (const launchRadius of [1.6, 3.4, 6]) {
          for (const launchSpeed of [0.2, 1.35, 3.5]) {
            const o = solveOrbit({ mass, launchRadius, launchSpeed });
            assert.ok(o.periapsis > 0 && o.periapsis <= launchRadius + 1e-9, "the closest point is never beyond the launch point");
            assert.ok(o.bound === (o.energy < 0));
            if (o.bound) assert.ok(o.apoapsis >= launchRadius - 1e-9 && Number.isFinite(o.period));
          }
        }
      }
    });
    it("reads the launch speed as a multiple of circular speed, meaning the same at any radius and mass", () => {
      // e = |ratio² − 1| whatever the radius and the central mass, so the
      // slider says the same thing wherever the others are set: 1 is a circle,
      // √2 is escape.
      for (const ratio of [0.5, 0.8, 1, 1.2, 1.35]) {
        for (const [mass, launchRadius] of [[0.3, 6], [1, 3.4], [3, 1.6]]) {
          const o = solveOrbit({ mass, launchRadius, launchRatio: ratio });
          assert.ok(Math.abs(o.eccentricity - Math.abs(ratio * ratio - 1)) < 1e-9, `ratio ${ratio}, M=${mass}, r=${launchRadius}`);
          assert.ok(Math.abs(o.launchSpeed - ratio * o.circularSpeed) < 1e-12);
          assert.ok(Math.abs(o.speedRatio - ratio) < 1e-12);
        }
      }
      assert.strictEqual(solveOrbit({ launchRatio: 1 }).kind, "circular");
      assert.strictEqual(solveOrbit({ launchRatio: 1 }).bound, true);
      assert.ok(Math.abs(solveOrbit({ launchRatio: ESCAPE_RATIO }).energy) < 1e-12, "√2 is exactly escape");
      assert.strictEqual(solveOrbit({ launchRatio: 1.42 }).bound, false);
      assert.strictEqual(solveOrbit({ launchRatio: 1.41 }).bound, true);
      // Defaults to a circle, and an outright speed still wins if one is given.
      assert.strictEqual(solveOrbit({}).kind, "circular");
      assert.strictEqual(solveOrbit({ launchSpeed: 2, launchRatio: 1 }).launchSpeed, 2);
    });

    it("names what each launch does, so the slider can say it beside its number", () => {
      const say = (launchRatio, extra = {}) => speedRegime({ launchRatio, ...extra });
      assert.strictEqual(say(1), "circular");
      assert.strictEqual(say(1.004), "circular");
      assert.strictEqual(say(0.6), "falls inward");
      assert.strictEqual(say(1.1), "ellipse");
      assert.strictEqual(say(1.3), "near escape");
      assert.strictEqual(say(1.42), "escapes");
      assert.strictEqual(say(1.7), "escapes");
    });

    it("never calls a launch 'near escape' when the satellite leaves the view anyway", () => {
      // Just under √2 the ellipse is bound but far wider than the view: it is
      // shown leaving, so the word says that instead of 'near escape'.
      const almost = speedRegime({ mass: 1, launchRadius: 3.4, launchRatio: 1.4 });
      assert.strictEqual(almost, "bound, leaves view");
      assert.strictEqual(solveOrbit({ launchRatio: 1.4 }).bound, true);
      // The word follows the physics AND the picture at every setting of the sliders.
      for (const mass of [0.3, 1, 3]) {
        for (const launchRadius of [1.6, 3.4, 6]) {
          for (let r = 0.3; r <= 1.7001; r += 0.01) {
            const o = solveOrbit({ mass, launchRadius, launchRatio: r });
            const word = speedRegime({ mass, launchRadius, launchRatio: r });
            const where = `${mass}/${launchRadius}/${r.toFixed(2)}: ${word}`;
            assert.strictEqual(word === "escapes", !o.bound && Math.abs(r - 1) >= 0.005, where);
            if (word === "near escape" || word === "ellipse") assert.ok(framing(o, launchRadius).fits, where);
            if (word === "bound, leaves view") assert.ok(o.bound && !framing(o, launchRadius).fits, where);
          }
        }
      }
    });

    it("frames every launch inside the drawn sheet, so nothing leaves it by a wide margin", () => {
      // The sheet is 60 units across in radius; the frame never asks for more than VIEW_MAX.
      assert.ok(VIEW_MAX < 60);
      for (const mass of [0.3, 1, 3]) {
        for (const launchRadius of [1.6, 3.4, 6]) {
          for (let ratio = 0.3; ratio <= 1.7001; ratio += 0.1) {
            const o = solveOrbit({ mass, launchRadius, launchRatio: ratio });
            const f = framing(o, launchRadius);
            assert.ok(f.viewRadius >= VIEW_MIN && f.viewRadius <= VIEW_MAX, `${mass}/${launchRadius}/${ratio}: ${f.viewRadius}`);
            assert.ok(f.viewRadius >= launchRadius, "the launch point is always in view");
            if (f.fits) assert.ok(o.apoapsis * 1.1 <= f.viewRadius + 1e-9, "and a orbit that fits, fits whole");
          }
        }
      }
      // The default circle is framed as tightly as the camera allows; a barely-bound
      // ellipse and an escape are cut off at the frame.
      const circle = framing(solveOrbit({ launchRatio: 1 }), 3.4);
      assert.strictEqual(circle.viewRadius, VIEW_MIN);
      assert.strictEqual(circle.fits, true);
      const wide = framing(solveOrbit({ launchRatio: 1.4 }), 3.4);
      assert.strictEqual(wide.viewRadius, VIEW_MAX);
      assert.strictEqual(wide.fits, false);
      const away = framing(solveOrbit({ launchRatio: 1.6 }), 3.4);
      assert.strictEqual(away.fits, false);
      assert.ok(away.viewRadius > 3.4 && away.viewRadius <= VIEW_MAX);
    });

    it("flies accurately at any time-scale: a lap in a few huge frames is still a lap", () => {
      const launch = { mass: 1, launchRadius: 3.4, launchRatio: 1 };
      const o = solveOrbit(launch);
      for (const frame of [0.033, 0.33, 3.3]) {
        // one period of simulated time, cut into frames of `frame` seconds each
        const s = { x: 3.4, z: 0, vx: 0, vz: o.launchSpeed };
        let t = 0;
        while (t < o.period - 1e-9) {
          const dt = Math.min(frame, o.period - t);
          advanceOrbit(s, o.mu, dt);
          t += dt;
        }
        assert.ok(Math.hypot(s.x - 3.4, s.z) < 0.02, `frame ${frame}s: ended ${Math.hypot(s.x - 3.4, s.z).toFixed(4)} from the start`);
      }
    });

    it("conserves energy in an eccentric orbit across many orbits, at 1× and at 100×", () => {
      for (const frame of [0.033, 3.3]) {
        const o = solveOrbit({ mass: 1, launchRadius: 3.4, launchRatio: 0.6 });
        const s = { x: 3.4, z: 0, vx: 0, vz: o.launchSpeed };
        const e0 = o.energy;
        let worst = 0;
        for (let t = 0; t < o.period * 20; t += frame) {
          advanceOrbit(s, o.mu, frame);
          const r = Math.hypot(s.x, s.z);
          worst = Math.max(worst, Math.abs((s.vx * s.vx + s.vz * s.vz) / 2 - o.mu / r - e0));
        }
        assert.ok(worst < 2e-3, `frame ${frame}s: energy wandered by ${worst}`);
      }
    });

    it("bounds the work per frame and can be stopped part-way", () => {
      const o = solveOrbit({ mass: 3, launchRadius: 1.6, launchRatio: 1 });
      const s = { x: 1.6, z: 0, vx: 0, vz: o.launchSpeed };
      // A frame of ten minutes cannot be flown in ten thousand steps: it is cut off, not frozen.
      const steps = advanceOrbit(s, o.mu, 600, undefined, 1500);
      assert.strictEqual(steps, 1500);
      // The callback can end the frame early, as when the satellite has left the view.
      const t = { x: 6, z: 0, vx: 0, vz: 3 };
      let seen = 0;
      advanceOrbit(t, 6, 5, () => {
        seen += 1;
        return seen < 10;
      });
      assert.strictEqual(seen, 10);
    });

  });

  describe("Electrostatic Force Formatting & Safety", () => {
    it("formats newtons, millinewtons, and micronewtons appropriately", () => {
      assert.strictEqual(formatForce(2.45), "2.45 N");
      assert.strictEqual(formatForce(0.015), "15.0 mN");
      assert.strictEqual(formatForce(0.000045), "45 µN");
      assert.strictEqual(formatForce(0), "0 µN");
    });

    it("safely handles undefined, null, NaN, and negative force inputs", () => {
      assert.strictEqual(formatForce(undefined), "0 µN");
      assert.strictEqual(formatForce(null), "0 µN");
      assert.strictEqual(formatForce(NaN), "0 µN");
      assert.strictEqual(formatForce(-0.025), "25.0 mN");
      assert.strictEqual(formatForce(Infinity), "0 µN");
    });

    it("switches unit exactly at the boundaries", () => {
      assert.strictEqual(formatForce(1), "1.00 N");
      assert.strictEqual(formatForce(0.999), "999.0 mN");
      assert.strictEqual(formatForce(1e-3), "1.0 mN");
      assert.strictEqual(formatForce(0.9999e-3), "1000 µN");
    });
  });

  describe("Projectile Motion & Air Resistance Solver", () => {
    it("matches analytical SUVAT range and apex in ideal vacuum (drag = 0)", () => {
      const u = 20;
      const angle = 45;
      const g = 9.81;
      const res = simulateFlight(u, angle, g, 0, 1);
      const expected = idealFlight(u, angle, g);

      // The step is second order and a vacuum's acceleration is constant, so
      // the numerical flight IS the closed-form one — not merely close to it.
      // (A first-order step ran 0.06–0.14 m short, and the drawn "(vac)" range
      // then disagreed with the readout's ideal range in the first decimal.)
      assert.ok(Math.abs(res.range - expected.range) < 0.005, `Range ${res.range} matches analytical ${expected.range}`);
      assert.ok(Math.abs(res.apex - expected.apex) < 0.005, `Apex ${res.apex} matches analytical ${expected.apex}`);
      assert.ok(Math.abs(res.flightTime - expected.flightTime) < 0.001, `Flight time matches analytical`);
      // In vacuum, trajectory is perfectly symmetric: apex horizontal position occurs at 50% of range
      assert.ok(Math.abs(res.apexX / res.range - 0.5) < 0.002, `Apex occurs at 50% of range`);
      // Impact speed matches launch speed
      assert.ok(Math.abs(res.impactSpeed - u) < 0.01, `Impact speed matches launch speed`);
    });

    it("agrees with the closed form across launches, planets and angles", () => {
      for (const [u, a, g] of [[22, 45, 9.81], [40, 45, 9.81], [40, 85, 1.62], [40, 30, 24.79], [5, 5, 9.81]]) {
        const n = simulateFlight(u, a, g, 0, 1);
        const c = idealFlight(u, a, g);
        const tag = `u=${u} θ=${a} g=${g}`;
        assert.ok(Math.abs(n.range - c.range) < 0.005, `${tag}: range ${n.range} vs ${c.range}`);
        assert.ok(Math.abs(n.apex - c.apex) < 0.005, `${tag}: apex`);
        assert.ok(Math.abs(n.flightTime - c.flightTime) < 0.001, `${tag}: time`);
        // Landing at launch height, so the ball comes back down at the launch speed.
        assert.ok(Math.abs(n.impactSpeed - u) < 0.01, `${tag}: impact speed ${n.impactSpeed}`);
        // ... with the vertical component exactly reversed and the horizontal untouched.
        assert.ok(Math.abs(n.svx[n.count - 1] - u * Math.cos((a * Math.PI) / 180)) < 0.01, `${tag}: vx`);
        assert.ok(Math.abs(n.svy[n.count - 1] + u * Math.sin((a * Math.PI) / 180)) < 0.01, `${tag}: vy`);
      }
    });

    it("stays accurate with drag, checked against an independent fine-step RK4", () => {
      // A reference written here, with a step eight times smaller and a
      // fourth-order scheme, so agreement means the drag term is integrated
      // right — not just that the vacuum case is.
      const reference = (u, angleDeg, g, drag, mass, dt = 0.0005) => {
        const kk = drag / mass;
        const acc = (vx, vy) => [-kk * Math.hypot(vx, vy) * vx, -g - kk * Math.hypot(vx, vy) * vy];
        const a = (angleDeg * Math.PI) / 180;
        let [x, y, vx, vy, t] = [0, 0, u * Math.cos(a), u * Math.sin(a), 0];
        for (;;) {
          const k1 = acc(vx, vy);
          const k2 = acc(vx + 0.5 * dt * k1[0], vy + 0.5 * dt * k1[1]);
          const k3 = acc(vx + 0.5 * dt * k2[0], vy + 0.5 * dt * k2[1]);
          const k4 = acc(vx + dt * k3[0], vy + dt * k3[1]);
          const nvx = vx + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
          const nvy = vy + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
          const nx = x + (dt / 2) * (vx + nvx);
          const ny = y + (dt / 2) * (vy + nvy);
          if (ny < 0) {
            const f = y / (y - ny);
            return { range: x + (nx - x) * f, time: t + f * dt, impact: Math.hypot(vx + (nvx - vx) * f, vy + (nvy - vy) * f) };
          }
          [x, y, vx, vy, t] = [nx, ny, nvx, nvy, t + dt];
        }
      };
      for (const [u, a, g, k, m] of [[25, 45, 9.81, 0.06, 1], [40, 30, 9.81, 0.25, 0.5], [22, 60, 3.72, 0.1, 2], [30, 80, 9.81, 0.15, 1]]) {
        const n = simulateFlight(u, a, g, k, m);
        const r = reference(u, a, g, k, m);
        const tag = `u=${u} θ=${a} g=${g} k=${k} m=${m}`;
        assert.ok(Math.abs(n.range - r.range) < 0.01, `${tag}: range ${n.range} vs ${r.range}`);
        assert.ok(Math.abs(n.flightTime - r.time) < 0.003, `${tag}: time ${n.flightTime} vs ${r.time}`);
        assert.ok(Math.abs(n.impactSpeed - r.impact) < 0.02, `${tag}: impact ${n.impactSpeed} vs ${r.impact}`);
      }
    });

    it("demonstrates asymmetric flight path with air resistance (descent is steeper than climb, apex > 50% of range)", () => {
      const res = simulateFlight(25, 50, 9.81, 0.06, 1);
      const vac = simulateFlight(25, 50, 9.81, 0, 1);

      // Drag strictly reduces range and apex
      assert.ok(res.range < vac.range, "Drag reduces range");
      assert.ok(res.apex < vac.apex, "Drag reduces maximum apex height");
      assert.ok(res.impactSpeed < 25, "Impact speed is lower than launch speed due to dissipated energy");

      // Asymmetry: because horizontal speed is lost throughout flight, the projectile travels further
      // horizontally during the climb than during the descent, making the descent steeper (apex > 50% of range)
      const apexFraction = res.apexX / res.range;
      assert.ok(apexFraction > 0.53, `Apex fraction ${apexFraction.toFixed(3)} is strictly greater than 0.5 (descent is steeper)`);
    });

    it("loses far more range to drag than the old estimate allowed for", () => {
      // The readout used to cap the loss at 65% of the vacuum range and cap
      // the coefficient's effect at k = 0.065. A blunt, light projectile
      // goes well past that.
      const vac = simulateFlight(40, 45, 9.81, 0, 1);
      const draggy = simulateFlight(40, 45, 9.81, 0.35, 0.4);
      const loss = 1 - draggy.range / vac.range;
      assert.ok(loss > 0.65, `drag took ${(loss * 100).toFixed(0)}% of the range`);
    });

    it("verifies heavier projectile travels further under identical quadratic drag (a = -k v² / m)", () => {
      const light = simulateFlight(22, 45, 9.81, 0.05, 0.5);
      const heavy = simulateFlight(22, 45, 9.81, 0.05, 3.0);

      assert.ok(heavy.range > light.range, "Heavier mass suffers less drag deceleration and achieves greater range");
      assert.ok(heavy.apex > light.apex, "Heavier mass achieves greater apex height");
    });

    it("verifies monotonic decrease in range with increasing drag coefficient k", () => {
      const r = (drag) => simulateFlight(20, 45, 9.81, drag, 1).range;
      const [r0, r1, r2, r3] = [r(0), r(0.02), r(0.05), r(0.15)];

      assert.ok(r0 > r1, "r0 > r1");
      assert.ok(r1 > r2, "r1 > r2");
      assert.ok(r2 > r3, "r2 > r3");
    });

    it("lands exactly on the ground rather than a step below it", () => {
      const res = simulateFlight(22, 45, 9.81, 0.04, 1);
      assert.strictEqual(res.sy[res.count - 1], 0, "the last sample is at ground level");
      assert.strictEqual(res.range, res.sx[res.count - 1]);
      // The drawn path keeps full precision where the sample arrays are
      // Float32, so these agree to the float32 step, not exactly.
      const [lastX, lastY] = res.points.at(-1);
      assert.strictEqual(lastY, 0);
      assert.ok(Math.abs(lastX - res.range) < 1e-4, `${lastX} vs ${res.range}`);
    });

    it("samples the path the scene draws on the same clock as the flight time", () => {
      const res = simulateFlight(22, 45, 9.81, 0.04, 1);
      // Sample i is at t = i·SIM_DT; the last is the landing, at the moment it
      // crosses the ground — inside the final step, not on the sample grid.
      assert.ok(res.flightTime <= (res.count - 1) * SIM_DT + 1e-12);
      assert.ok(res.flightTime > (res.count - 2) * SIM_DT);
      assert.ok(res.count > 100, `${res.count} samples for a ~3 s flight`);
      assert.strictEqual(res.svx.length, res.svy.length);
      // Every sample up to the landing index is on the ground or above it.
      for (let i = 0; i < res.count; i += 1) assert.ok(res.sy[i] >= 0, `sample ${i} is above ground`);
    });

    it("gives up on a flight that never lands rather than looping forever", () => {
      // Straight up on a world with no gravity: it simply leaves.
      const res = simulateFlight(30, 90, 0, 0, 1);
      assert.ok(Number.isFinite(res.range));
      assert.ok(res.flightTime <= 60 + SIM_DT);
    });

    it("quotes the closed-form vacuum flight for the comparison curve", () => {
      const ideal = idealFlight(20, 45, 9.81);
      assert.ok(Math.abs(ideal.range - 40.7747) < 0.001);
      assert.ok(Math.abs(ideal.apex - 10.1937) < 0.001);
      assert.ok(Math.abs(ideal.flightTime - 2.8831) < 0.001);
      // 45° is the maximum-range angle in a vacuum.
      assert.ok(idealFlight(20, 45, 9.81).range > idealFlight(20, 30, 9.81).range);
      assert.ok(idealFlight(20, 45, 9.81).range > idealFlight(20, 60, 9.81).range);
    });
  });
});
