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
  omegaOf,
  peakEmf,
  safeTurnsOf,
  solveInduction,
  solveSolenoidInduction,
} from "../../lib/induction.js";
import { SIM_DT, idealFlight, simulateFlight } from "../../lib/projectile.js";
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
      const res = solveInduction({ speed: 0, field: 1.5, turns: 5, angle: 0 });
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

    it("shows peak EMF occurs at edge-on rotation (cos θ = ±1) and zero flux", () => {
      // At angle = 0, coil lies in XY, normal along Z, cutting lines fastest
      const edgeOn = solveInduction({ speed: 1.0, field: 1.0, turns: 3, angle: 0 });
      assert.strictEqual(edgeOn.cuttingRate, 1);
      assert.strictEqual(edgeOn.flux, 0);
      assert.strictEqual(Math.abs(edgeOn.emf), edgeOn.peakEmf);

      // At angle = π/2, coil faces field: maximum flux, zero EMF
      const faceOn = solveInduction({ speed: 1.0, field: 1.0, turns: 3, angle: Math.PI / 2 });
      assert.ok(Math.abs(faceOn.cuttingRate) < 1e-6);
      assert.ok(Math.abs(faceOn.emf) < 1e-6);
      assert.ok(Math.abs(faceOn.flux - 6.0) < 1e-6); // 1.0 * 6.0 m² * sin(π/2) = 6.0 Wb
      assert.strictEqual(faceOn.flux, fluxAt(1.0, Math.PI / 2));
    });

    it("reverses the induced current over half a turn", () => {
      const a = solveInduction({ speed: 1.0, field: 1.0, turns: 3, angle: 0 });
      const b = solveInduction({ speed: 1.0, field: 1.0, turns: 3, angle: Math.PI });
      assert.strictEqual(a.emf, -b.emf);
      assert.notStrictEqual(a.direction, b.direction);
      assert.strictEqual(a.emf, emfAt(1.0, a.omega, 0, 3));
    });

    it("rests the needle rather than flickering a direction at near-zero emf", () => {
      assert.strictEqual(currentDirection(0), "none");
      assert.strictEqual(currentDirection(-0), "none");
      assert.strictEqual(currentDirection(0.049), "none");
      assert.strictEqual(currentDirection(0.051), "clockwise");
      assert.strictEqual(currentDirection(-0.051), "anticlockwise");
    });

    it("clamps safe turns to minimum 1 for undefined or zero inputs", () => {
      const res1 = solveInduction({ speed: 1.0, field: 1.0, turns: 0 });
      const res2 = solveInduction({ speed: 1.0, field: 1.0, turns: undefined });
      assert.ok(res1.peakEmf > 0);
      assert.ok(res2.peakEmf > 0);
      assert.strictEqual(res1.peakEmf, res2.peakEmf);
      assert.strictEqual(res1.turns, 1);
      assert.strictEqual(safeTurnsOf(2.6), 3, "half a winding is not a coil");
      assert.strictEqual(safeTurnsOf(-4), 1);
    });

    it("computes zero EMF for stationary bar magnet (velocity = 0) even at peak flux position (x = 0)", () => {
      const res = solveSolenoidInduction({ x: 0, velocity: 0, turns: 10 });
      assert.strictEqual(res.emf, 0);
      assert.strictEqual(res.direction, "none");
      assert.ok(res.flux > 0);
      assert.strictEqual(res.dPhi_dx, 0, "flux is at its peak, so its gradient is zero");
    });

    it("reverses EMF direction when moving inward vs outward along solenoid axis", () => {
      const movingIn = solveSolenoidInduction({ x: -1.5, velocity: 2.0, turns: 10 });
      const movingOut = solveSolenoidInduction({ x: 1.5, velocity: 2.0, turns: 10 });
      assert.ok(movingIn.emf < 0);
      assert.ok(movingOut.emf > 0);
      assert.notStrictEqual(movingIn.direction, movingOut.direction);
    });

    it("reverses EMF sign when magnet poles are flipped (flipPoles = true)", () => {
      const normal = solveSolenoidInduction({ x: -1.5, velocity: 2.0, turns: 10, flipPoles: false });
      const flipped = solveSolenoidInduction({ x: -1.5, velocity: 2.0, turns: 10, flipPoles: true });
      assert.strictEqual(flipped.emf, -normal.emf);
      assert.strictEqual(flipped.flux, -normal.flux);
    });

    it("scales EMF linearly with coil turns and magnet velocity", () => {
      const base = solveSolenoidInduction({ x: -1.0, velocity: 1.0, turns: 5 });
      const doubleTurns = solveSolenoidInduction({ x: -1.0, velocity: 1.0, turns: 10 });
      const doubleSpeed = solveSolenoidInduction({ x: -1.0, velocity: 2.0, turns: 5 });
      assert.ok(Math.abs(doubleTurns.emf - base.emf * 2) < 1e-9);
      assert.ok(Math.abs(doubleSpeed.emf - base.emf * 2) < 1e-9);
    });

    it("falls off with distance, so the magnet matters most near the coil", () => {
      const near = solveSolenoidInduction({ x: 0.2, velocity: 1.0, turns: 10 });
      const far = solveSolenoidInduction({ x: 4.0, velocity: 1.0, turns: 10 });
      // Φ ∝ (x² + R²)^−1.5, so twenty times the offset is ~90 times the flux.
      assert.ok(Math.abs(near.flux) > Math.abs(far.flux) * 50, "flux falls off steeply");
      assert.ok(Math.abs(near.emf) > Math.abs(far.emf) * 50);
      const offTheBench = solveSolenoidInduction({ x: 40, velocity: 1.0, turns: 10 });
      assert.strictEqual(offTheBench.direction, "none", "too far out to move the needle");
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

      assert.ok(Math.abs(res.range - expected.range) < 0.15, `Range ${res.range} matches analytical ${expected.range}`);
      assert.ok(Math.abs(res.apex - expected.apex) < 0.1, `Apex ${res.apex} matches analytical ${expected.apex}`);
      assert.ok(Math.abs(res.flightTime - expected.flightTime) < 0.05, `Flight time matches analytical`);
      // In vacuum, trajectory is perfectly symmetric: apex horizontal position occurs at 50% of range
      assert.ok(Math.abs(res.apexX / res.range - 0.5) < 0.02, `Apex occurs at 50% of range`);
      // Impact speed matches launch speed
      assert.ok(Math.abs(res.impactSpeed - u) < 0.1, `Impact speed matches launch speed`);
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
      assert.strictEqual(res.flightTime, (res.count - 1) * SIM_DT);
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
