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
});
