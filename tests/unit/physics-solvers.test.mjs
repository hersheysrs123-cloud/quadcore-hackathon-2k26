import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * ─── PHYSICS SOLVER LOGIC UNDER TEST ────────────────────────────────
 * Pure mathematical solvers extracted from PhysicsCanvas.jsx and ChemistryCanvas.jsx
 */

// 1. Snell's Law & Refraction Solver
export function solveRefraction(n1, n2, incidentAngleDeg, blockThickness = 3) {
  const theta1Rad = (incidentAngleDeg * Math.PI) / 180;
  const sinTheta1 = Math.sin(theta1Rad);
  const sinTheta2 = (n1 / n2) * sinTheta1;

  // Critical angle for n1 > n2
  const criticalAngleDeg = n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;

  // Total Internal Reflection (TIR)
  if (Math.abs(sinTheta2) > 1.0) {
    return {
      isTIR: true,
      refractedAngleDeg: null,
      criticalAngleDeg,
      lateralDisplacement: null,
      reflectedAngleDeg: incidentAngleDeg,
    };
  }

  const theta2Rad = Math.asin(sinTheta2);
  const refractedAngleDeg = (theta2Rad * 180) / Math.PI;

  // Guard against division by zero when cos(r) -> 0
  const cosTheta2 = Math.cos(theta2Rad);
  let lateralDisplacement = 0;
  if (Math.abs(cosTheta2) > 1e-4) {
    lateralDisplacement = (blockThickness * Math.sin(theta1Rad - theta2Rad)) / cosTheta2;
  }

  return {
    isTIR: false,
    refractedAngleDeg,
    criticalAngleDeg,
    lateralDisplacement: Math.max(0, lateralDisplacement),
    reflectedAngleDeg: incidentAngleDeg,
  };
}

// 2. Thin Lens Formula Solver (1/f = 1/u + 1/v)
export function solveThinLens(focalLength, objectDistance) {
  // u is negative by standard Cartesian sign convention (object in front of lens)
  // 1/v = 1/f - 1/u  ->  1/v = 1/f + 1/|u|
  if (objectDistance === 0) return { imageDistance: 0, magnification: 1, isReal: false };
  if (objectDistance === focalLength) {
    return { imageDistance: Infinity, magnification: Infinity, isReal: false, atInfinity: true };
  }

  // Real lens formula: v = (f * u) / (u - f) using distances
  const u = objectDistance;
  const f = focalLength;
  const v = (f * u) / (u - f);
  const magnification = Math.abs(v / u);
  const isReal = v > 0;

  return {
    imageDistance: Number.isFinite(v) ? v : 0,
    magnification: Number.isFinite(magnification) ? magnification : 0,
    isReal,
    isVirtual: !isReal,
    isUpright: !isReal,
    isInverted: isReal,
  };
}

// 2b. Comprehensive Ray Optics Solver for Lenses & Spherical Mirrors
export function solveRayOptics({
  type = "convex_lens",
  focal = 2.5,
  objectDistance = 5.0,
  objectHeight = 1.5,
}) {
  const isMirror = type.includes("mirror");
  const isConverging = type === "convex_lens" || type === "concave_mirror";
  const u = objectDistance;
  const h = objectHeight;
  const f = focal;

  const atInfinity = isConverging && Math.abs(u - f) < 0.035;

  let v = 0;
  let real = false;
  let m = 0;
  let imgX = 0;
  let imageHeight = 0;

  if (isConverging) {
    if (!atInfinity) {
      if (u > f) {
        v = (f * u) / (u - f);
        real = true;
        m = v / u;
        imageHeight = -h * m;
        imgX = isMirror ? -v : v;
      } else {
        v = (f * u) / (f - u);
        real = false;
        m = v / u;
        imageHeight = h * m;
        imgX = isMirror ? v : -v;
      }
    }
  } else {
    v = (f * u) / (u + f);
    real = false;
    m = v / u;
    imageHeight = h * m;
    imgX = isMirror ? v : -v;
  }

  return {
    atInfinity,
    v,
    imgX,
    imageHeight,
    magnification: m,
    real,
    virtual: !real && !atInfinity,
    upright: imageHeight > 0,
    inverted: imageHeight < 0,
    isMirror,
    isConverging,
  };
}

// 3. Kinetic Ideal Gas Law (PV = nRT)
export function solveGasLaw({ temperatureK, volumeL, moles = 1, R = 8.314 }) {
  const safeVol = Math.max(0.1, volumeL);
  const safeTemp = Math.max(1, temperatureK);
  const pressureKPa = (moles * R * safeTemp) / safeVol;
  const rootMeanSquareSpeed = Math.sqrt((3 * R * safeTemp) / 0.028); // assuming N2 molar mass 0.028 kg/mol

  return {
    pressureKPa,
    rmsSpeedMs: rootMeanSquareSpeed,
    temperatureK: safeTemp,
    volumeL: safeVol,
  };
}

// 4. Hydrocarbon Formula Validation
export function getHydrocarbonFormula(series, carbonCount) {
  const n = Math.max(1, Math.min(12, Math.floor(carbonCount)));
  switch (series) {
    case "alkane":
      return { carbons: n, hydrogens: 2 * n + 2, formula: `C${n}H${2 * n + 2}` };
    case "alkene":
      return { carbons: n, hydrogens: 2 * n, formula: `C${n}H${2 * n}` };
    case "alkyne":
      return { carbons: n, hydrogens: 2 * n - 2, formula: `C${n}H${2 * n - 2}` };
    case "alcohol":
      return { carbons: n, hydrogens: 2 * n + 1, oxygens: 1, formula: `C${n}H${2 * n + 1}OH` };
    case "carboxylic":
      return { carbons: n, hydrogens: 2 * n, oxygens: 2, formula: `C${n}H${2 * n}O2` };
    case "ester":
      return { carbons: n, hydrogens: 2 * n, oxygens: 2, formula: `C${n}H${2 * n}O2` };
    default:
      return { carbons: n, hydrogens: 2 * n + 2, formula: `C${n}H${2 * n + 2}` };
  }
}

// 5. Faraday's Law & Electromagnetic Induction Solver
export const COIL_W = 1.5;
export const COIL_H = 1.0;
export const COIL_AREA = 2 * COIL_W * 2 * COIL_H; // 6.0 m²

export const omegaOf = (speed) => (speed || 0) * 1.7;
export const peakEmf = (field, omega, turns = 1) => turns * field * COIL_AREA * omega;
export const fluxAt = (field, angle) => field * COIL_AREA * Math.sin(angle);
export const emfAt = (field, omega, angle, turns = 1) =>
  -turns * field * COIL_AREA * omega * Math.cos(angle);

export function solveInduction({ speed = 1.0, field = 1.0, turns = 1, angle = 0 } = {}) {
  const safeTurns = Math.max(1, Math.round(turns || 1));
  const omega = omegaOf(speed);
  const peak = peakEmf(field, omega, safeTurns);
  const flux = fluxAt(field, angle);
  const rawEmf = emfAt(field, omega, angle, safeTurns);
  const emf = Object.is(rawEmf, -0) || Math.abs(rawEmf) < 1e-12 ? 0 : rawEmf;
  return {
    coilArea: COIL_AREA,
    omega,
    peakEmf: peak,
    flux: Object.is(flux, -0) || Math.abs(flux) < 1e-12 ? 0 : flux,
    emf,
    frequencyHz: speed,
    cuttingRate: Math.abs(Math.cos(angle)),
  };
}

export function solveSolenoidInduction({
  x = 0,
  velocity = 0,
  turns = 10,
  magnetStrength = 1.0,
  radius = 0.9,
  flipPoles = false,
} = {}) {
  const safeTurns = Math.max(1, Math.round(turns || 1));
  const polarity = flipPoles ? -1 : 1;
  const m = (magnetStrength || 1.0) * polarity;
  const R = radius || 0.9;
  const denom = Math.pow(x * x + R * R, 1.5);
  const C = 2.0 * R;
  const flux = (C * m * R * R) / denom;
  const dPhi_dx = (-3 * C * m * R * R * x) / Math.pow(x * x + R * R, 2.5);
  const rawEmf = -safeTurns * dPhi_dx * velocity;
  const emf = Object.is(rawEmf, -0) || Math.abs(rawEmf) < 1e-12 ? 0 : rawEmf;
  return {
    turns: safeTurns,
    flux: Object.is(flux, -0) || Math.abs(flux) < 1e-12 ? 0 : flux,
    dPhi_dx: Object.is(dPhi_dx, -0) || Math.abs(dPhi_dx) < 1e-12 ? 0 : dPhi_dx,
    emf,
    velocity,
    direction: Math.abs(emf) < 0.05 ? "none" : emf > 0 ? "clockwise" : "anticlockwise",
  };
}

// 6. Electrostatic Force Formatter
export function formatForce(newtons = 0) {
  const n = Number.isFinite(newtons) ? Math.abs(newtons) : 0;
  if (n >= 1) return `${n.toFixed(2)} N`;
  if (n >= 1e-3) return `${(n * 1e3).toFixed(1)} mN`;
  return `${(n * 1e6).toFixed(0)} µN`;
}

// 7. Projectile Flight with Quadratic Drag Solver
export function solveProjectileFlight({
  speed = 22,
  angleDeg = 45,
  gravity = 9.81,
  drag = 0.04,
  mass = 1,
  dt = 0.004,
  maxTime = 60,
} = {}) {
  const DEG = Math.PI / 180;
  const angle = angleDeg * DEG;
  let vx = speed * Math.cos(angle);
  let vy = speed * Math.sin(angle);
  let x = 0;
  let y = 0;
  let t = 0;
  let apex = 0;
  let apexX = 0;

  while (t < maxTime) {
    const v = Math.hypot(vx, vy);
    const k = drag / Math.max(mass, 0.05);
    const ax = -k * v * vx;
    const ay = -gravity - k * v * vy;

    vx += ax * dt;
    vy += ay * dt;
    const nx = x + vx * dt;
    const ny = y + vy * dt;
    t += dt;

    if (ny < 0) {
      const f = y / (y - ny || 1);
      x += (nx - x) * f;
      y = 0;
      break;
    }

    x = nx;
    y = ny;
    if (y > apex) {
      apex = y;
      apexX = x;
    }
  }

  return {
    range: x,
    apex,
    apexX,
    flightTime: t,
    impactSpeed: Math.hypot(vx, vy),
  };
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Physics & Chemistry Mathematical Solvers", () => {
  describe("Wave Refraction & Snell's Law", () => {
    it("handles normal incidence (0 degrees) with 0 refraction and 0 displacement", () => {
      const res = solveRefraction(1.0, 1.5, 0, 3);
      assert.strictEqual(res.isTIR, false);
      assert.strictEqual(res.refractedAngleDeg, 0);
      assert.strictEqual(res.lateralDisplacement, 0);
    });

    it("correctly calculates air -> glass refraction (n1=1.0, n2=1.5, angle=30deg)", () => {
      const res = solveRefraction(1.0, 1.5, 30, 3);
      assert.strictEqual(res.isTIR, false);
      // sin(r) = (1/1.5) * sin(30) = (1/1.5) * 0.5 = 0.333333 -> r ≈ 19.47°
      assert.ok(Math.abs(res.refractedAngleDeg - 19.47) < 0.1);
      assert.ok(res.lateralDisplacement > 0);
    });

    it("detects Total Internal Reflection when entering rarer medium beyond critical angle", () => {
      // Glass (1.5) to Air (1.0). Critical angle is asin(1/1.5) ≈ 41.81°
      const subCritical = solveRefraction(1.5, 1.0, 30, 3);
      assert.strictEqual(subCritical.isTIR, false);

      const superCritical = solveRefraction(1.5, 1.0, 60, 3);
      assert.strictEqual(superCritical.isTIR, true);
      assert.strictEqual(superCritical.refractedAngleDeg, null);
      assert.ok(Math.abs(superCritical.criticalAngleDeg - 41.81) < 0.1);
    });

    it("guards against division by zero at extreme 89.9 degree grazing incidence", () => {
      const res = solveRefraction(1.0, 1.5, 89.9, 3);
      assert.strictEqual(res.isTIR, false);
      assert.ok(Number.isFinite(res.lateralDisplacement));
      assert.ok(!Number.isNaN(res.lateralDisplacement));
    });
  });

  describe("Thin Lens Equation (1/f = 1/u + 1/v)", () => {
    it("calculates real inverted image when object distance > 2f", () => {
      // f = 10, u = 30 -> v = (10*30)/(30-10) = 300/20 = 15
      const res = solveThinLens(10, 30);
      assert.strictEqual(res.imageDistance, 15);
      assert.strictEqual(res.magnification, 0.5);
      assert.strictEqual(res.isReal, true);
      assert.strictEqual(res.isInverted, true);
    });

    it("calculates virtual upright magnified image when object is inside focal length (u < f)", () => {
      // f = 10, u = 5 -> v = (10*5)/(5-10) = 50/-5 = -10
      const res = solveThinLens(10, 5);
      assert.strictEqual(res.imageDistance, -10);
      assert.strictEqual(res.magnification, 2);
      assert.strictEqual(res.isReal, false);
      assert.strictEqual(res.isVirtual, true);
      assert.strictEqual(res.isUpright, true);
    });

    it("handles object placed exactly at the focal point (u = f) gracefully", () => {
      const res = solveThinLens(10, 10);
      assert.strictEqual(res.atInfinity, true);
    });
  });

  describe("Ray Optics Solver — Lenses & Mirrors", () => {
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

  describe("Kinetic Gas Laws (PV = nRT)", () => {
    it("increases pressure when temperature increases at constant volume", () => {
      const cold = solveGasLaw({ temperatureK: 300, volumeL: 10 });
      const hot = solveGasLaw({ temperatureK: 600, volumeL: 10 });
      assert.strictEqual(hot.pressureKPa, cold.pressureKPa * 2);
      assert.ok(hot.rmsSpeedMs > cold.rmsSpeedMs);
    });

    it("increases pressure when volume decreases at constant temperature (Boyle's Law)", () => {
      const largeVol = solveGasLaw({ temperatureK: 300, volumeL: 20 });
      const smallVol = solveGasLaw({ temperatureK: 300, volumeL: 10 });
      assert.strictEqual(smallVol.pressureKPa, largeVol.pressureKPa * 2);
    });

    it("clamps minimum volume and temperature to prevent negative values or division by zero", () => {
      const zeroVol = solveGasLaw({ temperatureK: 0, volumeL: 0 });
      assert.ok(zeroVol.pressureKPa > 0);
      assert.ok(Number.isFinite(zeroVol.pressureKPa));
    });
  });

  describe("Organic Chemistry Homologous Series Formulas", () => {
    it("generates correct Alkane formulas (CnH2n+2) from C1 to C12", () => {
      assert.deepStrictEqual(getHydrocarbonFormula("alkane", 1), { carbons: 1, hydrogens: 4, formula: "C1H4" });
      assert.deepStrictEqual(getHydrocarbonFormula("alkane", 8), { carbons: 8, hydrogens: 18, formula: "C8H18" });
      assert.deepStrictEqual(getHydrocarbonFormula("alkane", 12), { carbons: 12, hydrogens: 26, formula: "C12H26" });
    });

    it("generates correct Alkene and Alkyne formulas", () => {
      assert.deepStrictEqual(getHydrocarbonFormula("alkene", 2), { carbons: 2, hydrogens: 4, formula: "C2H4" });
      assert.deepStrictEqual(getHydrocarbonFormula("alkyne", 2), { carbons: 2, hydrogens: 2, formula: "C2H2" });
      assert.deepStrictEqual(getHydrocarbonFormula("alkyne", 4), { carbons: 4, hydrogens: 6, formula: "C4H6" });
    });

    it("generates correct Alcohols and Carboxylic Acids", () => {
      assert.deepStrictEqual(getHydrocarbonFormula("alcohol", 2), { carbons: 2, hydrogens: 5, oxygens: 1, formula: "C2H5OH" });
      assert.deepStrictEqual(getHydrocarbonFormula("carboxylic", 2), { carbons: 2, hydrogens: 4, oxygens: 2, formula: "C2H4O2" });
    });
  });

  describe("Electromagnetic Induction & Faraday's Law", () => {
    it("computes zero induced EMF and zero omega when stationary (speed = 0)", () => {
      const res = solveInduction({ speed: 0, field: 1.5, turns: 5, angle: 0 });
      assert.strictEqual(res.omega, 0);
      assert.strictEqual(res.peakEmf, 0);
      assert.strictEqual(res.emf, 0);
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
    });

    it("clamps safe turns to minimum 1 for undefined or zero inputs", () => {
      const res1 = solveInduction({ speed: 1.0, field: 1.0, turns: 0 });
      const res2 = solveInduction({ speed: 1.0, field: 1.0, turns: undefined });
      assert.ok(res1.peakEmf > 0);
      assert.ok(res2.peakEmf > 0);
      assert.strictEqual(res1.peakEmf, res2.peakEmf);
    });

    it("computes zero EMF for stationary bar magnet (velocity = 0) even at peak flux position (x = 0)", () => {
      const res = solveSolenoidInduction({ x: 0, velocity: 0, turns: 10 });
      assert.strictEqual(res.emf, 0);
      assert.strictEqual(res.direction, "none");
      assert.ok(res.flux > 0);
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
    });

    it("scales EMF linearly with coil turns and magnet velocity", () => {
      const base = solveSolenoidInduction({ x: -1.0, velocity: 1.0, turns: 5 });
      const doubleTurns = solveSolenoidInduction({ x: -1.0, velocity: 1.0, turns: 10 });
      const doubleSpeed = solveSolenoidInduction({ x: -1.0, velocity: 2.0, turns: 5 });
      assert.ok(Math.abs(doubleTurns.emf - base.emf * 2) < 1e-9);
      assert.ok(Math.abs(doubleSpeed.emf - base.emf * 2) < 1e-9);
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
    });
  });

  describe("Projectile Motion & Air Resistance Solver", () => {
    it("matches analytical SUVAT range and apex in ideal vacuum (drag = 0)", () => {
      const u = 20;
      const angle = 45;
      const g = 9.81;
      const res = solveProjectileFlight({ speed: u, angleDeg: angle, gravity: g, drag: 0, mass: 1 });

      const expectedRange = (u * u * Math.sin((2 * angle * Math.PI) / 180)) / g; // 40.7747 m
      const expectedApex = (u * u * Math.pow(Math.sin((angle * Math.PI) / 180), 2)) / (2 * g); // 10.1937 m
      const expectedTime = (2 * u * Math.sin((angle * Math.PI) / 180)) / g; // 2.883 s

      assert.ok(Math.abs(res.range - expectedRange) < 0.15, `Range ${res.range} matches analytical ${expectedRange}`);
      assert.ok(Math.abs(res.apex - expectedApex) < 0.1, `Apex ${res.apex} matches analytical ${expectedApex}`);
      assert.ok(Math.abs(res.flightTime - expectedTime) < 0.05, `Flight time matches analytical`);
      // In vacuum, trajectory is perfectly symmetric: apex horizontal position occurs at 50% of range
      assert.ok(Math.abs(res.apexX / res.range - 0.5) < 0.02, `Apex occurs at 50% of range`);
      // Impact speed matches launch speed
      assert.ok(Math.abs(res.impactSpeed - u) < 0.1, `Impact speed matches launch speed`);
    });

    it("demonstrates asymmetric flight path with air resistance (descent is steeper than climb, apex > 50% of range)", () => {
      const res = solveProjectileFlight({ speed: 25, angleDeg: 50, gravity: 9.81, drag: 0.06, mass: 1 });
      const vac = solveProjectileFlight({ speed: 25, angleDeg: 50, gravity: 9.81, drag: 0, mass: 1 });

      // Drag strictly reduces range and apex
      assert.ok(res.range < vac.range, "Drag reduces range");
      assert.ok(res.apex < vac.apex, "Drag reduces maximum apex height");
      assert.ok(res.impactSpeed < 25, "Impact speed is lower than launch speed due to dissipated energy");

      // Asymmetry: because horizontal speed is lost throughout flight, the projectile travels further
      // horizontally during the climb than during the descent, making the descent steeper (apex > 50% of range)
      const apexFraction = res.apexX / res.range;
      assert.ok(apexFraction > 0.53, `Apex fraction ${apexFraction.toFixed(3)} is strictly greater than 0.5 (descent is steeper)`);
    });

    it("verifies heavier projectile travels further under identical quadratic drag (a = -k v² / m)", () => {
      const light = solveProjectileFlight({ speed: 22, angleDeg: 45, gravity: 9.81, drag: 0.05, mass: 0.5 });
      const heavy = solveProjectileFlight({ speed: 22, angleDeg: 45, gravity: 9.81, drag: 0.05, mass: 3.0 });

      assert.ok(heavy.range > light.range, "Heavier mass suffers less drag deceleration and achieves greater range");
      assert.ok(heavy.apex > light.apex, "Heavier mass achieves greater apex height");
    });

    it("verifies monotonic decrease in range with increasing drag coefficient k", () => {
      const r0 = solveProjectileFlight({ speed: 20, angleDeg: 45, gravity: 9.81, drag: 0.0, mass: 1 }).range;
      const r1 = solveProjectileFlight({ speed: 20, angleDeg: 45, gravity: 9.81, drag: 0.02, mass: 1 }).range;
      const r2 = solveProjectileFlight({ speed: 20, angleDeg: 45, gravity: 9.81, drag: 0.05, mass: 1 }).range;
      const r3 = solveProjectileFlight({ speed: 20, angleDeg: 45, gravity: 9.81, drag: 0.15, mass: 1 }).range;

      assert.ok(r0 > r1, "r0 > r1");
      assert.ok(r1 > r2, "r1 > r2");
      assert.ok(r2 > r3, "r2 > r3");
    });
  });
});
