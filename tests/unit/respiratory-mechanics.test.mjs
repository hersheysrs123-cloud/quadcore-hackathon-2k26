import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Respiratory mechanics ──────────────────────────────────────────
// This file used to DEFINE the engine it then asserted against: it imported
// nothing from the application, so every assertion below passed regardless of
// what RespiratoryCanvas actually did — and RespiratoryCanvas implemented
// different arithmetic inline, with three different tidal volumes for the
// same phase. Exactly the failure mode 8bb971b fixed for the binary tree.
//
// It now imports the shipping engine.
// ─────────────────────────────────────────────────────────────────────

import {
  RESPIRATORY_PHASES,
  airflowFromPressure,
  breathAt,
  muscleStates,
  restingState,
  thoraxVolume,
} from "../../lib/respiratory.js";
import { RESPIRATORY_MODEL_CREDITS } from "../../lib/respiratoryCredits.js";

const calculateThoraxVolume = thoraxVolume;
const calculateIntraThoracicPressure = (phase) => restingState(phase).pressureKPa;
const calculateAirflowRate = airflowFromPressure;
const getIntercostalMuscleStates = muscleStates;

describe("3D Respiratory Mechanics & Thoracic Physics Engine", () => {
  describe("Volume Dynamics Across Respiratory Phases", () => {
    it("expands volume during inspiration above resting FRC", () => {
      const frc = calculateThoraxVolume(0);
      assert.strictEqual(frc, 2.8, "Resting FRC must be exactly 2.8 L");

      const inspVol = calculateThoraxVolume(1.0);
      assert.strictEqual(inspVol, 3.5, "Peak quiet inspiration must reach 3.5 L");
      assert.ok(inspVol > frc, "Inspiration volume must be greater than FRC");
    });

    it("compresses volume during forced expiration below resting FRC", () => {
      const frc = calculateThoraxVolume(0);
      const forcedVol = calculateThoraxVolume(-1.0);
      assert.strictEqual(forcedVol, 1.95, "Forced expiration volume must reach 1.95 L");
      assert.ok(forcedVol < frc, "Forced expiration must drop below resting FRC");
    });
  });

  describe("Boyle's Law & Intra-Thoracic Pressure Gradients", () => {
    it("generates negative relative pressure (vacuum) during inspiration", () => {
      const pInsp = calculateIntraThoracicPressure(RESPIRATORY_PHASES.INSPIRATION);
      assert.ok(pInsp < 0, "Inspiration must create sub-atmospheric relative pressure");
      assert.ok(pInsp <= -0.2, "Peak inspiration pressure should reach ~ -0.28 kPa");

      const flow = calculateAirflowRate(pInsp);
      assert.ok(flow < 0, "Airflow must be negative (inflow into lungs)");
    });

    it("generates positive relative pressure during quiet expiration", () => {
      const pExp = calculateIntraThoracicPressure(RESPIRATORY_PHASES.QUIET_EXPIRATION);
      assert.ok(pExp > 0, "Quiet expiration must create positive pressure from recoil");

      const flow = calculateAirflowRate(pExp);
      assert.ok(flow > 0, "Airflow must be positive (outflow out of trachea)");
    });

    it("generates high positive pressure spike during forced expiration", () => {
      const pForced = calculateIntraThoracicPressure(RESPIRATORY_PHASES.FORCED_EXPIRATION);
      assert.ok(pForced >= 1.0, "Forced expiration must spike above +1.0 kPa");

      const flow = calculateAirflowRate(pForced);
      assert.ok(flow > 2.0, "Forced expiration must drive rapid high-velocity airflow (> 2.0 L/s)");
    });
  });

  describe("Antagonistic Intercostal Reciprocal Inhibition", () => {
    it("contracts external intercostals and relaxes internal during inspiration", () => {
      const muscles = getIntercostalMuscleStates(RESPIRATORY_PHASES.INSPIRATION);
      assert.strictEqual(muscles.external.contracted, true);
      assert.strictEqual(muscles.external.tension, 1.0);
      assert.strictEqual(muscles.internal.contracted, false);
      assert.strictEqual(muscles.internal.tension, 0.0);
      assert.strictEqual(muscles.diaphragm.contracted, true);
      assert.strictEqual(muscles.diaphragm.action, "flatten_down");
    });

    it("relaxes both intercostal layers during quiet expiration", () => {
      const muscles = getIntercostalMuscleStates(RESPIRATORY_PHASES.QUIET_EXPIRATION);
      assert.strictEqual(muscles.external.contracted, false);
      assert.strictEqual(muscles.internal.contracted, false);
      assert.strictEqual(muscles.diaphragm.contracted, false);
      assert.strictEqual(muscles.diaphragm.action, "recoil_up");
    });

    it("contracts internal intercostals and relaxes external during forced expiration", () => {
      const muscles = getIntercostalMuscleStates(RESPIRATORY_PHASES.FORCED_EXPIRATION);
      assert.strictEqual(muscles.external.contracted, false);
      assert.strictEqual(muscles.internal.contracted, true);
      assert.strictEqual(muscles.internal.tension, 1.0);
      assert.strictEqual(muscles.internal.action, "depress_ribs");
      assert.strictEqual(muscles.diaphragm.action, "pushed_up_by_abdominals");
    });
  });

  describe("Open-Source 3D Model Credits & Attribution", () => {
    it("provides accurate metadata for all 4 key anatomical components", () => {
      assert.strictEqual(RESPIRATORY_MODEL_CREDITS.length, 4);
      const ids = RESPIRATORY_MODEL_CREDITS.map((c) => c.id);
      assert.ok(ids.includes("lungs"));
      assert.ok(ids.includes("skeleton"));
      assert.ok(ids.includes("diaphragm"));
      assert.ok(ids.includes("intercostals"));
    });

    it("verifies upstream scanned models have valid GitHub repos and CC-BY-4.0 commercial rights", () => {
      const lungs = RESPIRATORY_MODEL_CREDITS.find((c) => c.id === "lungs");
      assert.ok(lungs.repoUrl.startsWith("https://github.com/"));
      assert.ok(lungs.license.includes("CC-BY-4.0"));
      assert.strictEqual(lungs.file, "lung.glb");
      assert.strictEqual(lungs.originalCreator, "neshallads");
      assert.ok(lungs.commercialUse.includes("Permitted"));

      const skeleton = RESPIRATORY_MODEL_CREDITS.find((c) => c.id === "skeleton");
      assert.ok(skeleton.repoUrl.startsWith("https://github.com/"));
      assert.ok(skeleton.license.includes("CC-BY-4.0"));
      assert.strictEqual(skeleton.file, "skeleton_ct.glb");
      assert.strictEqual(skeleton.originalCreator, "Terrie Simmons-Ehrhardt");
      assert.ok(skeleton.commercialUse.includes("Permitted"));
    });

    it("identifies custom procedural components as original SocraticOS contributions with commercial rights", () => {
      const diaphragm = RESPIRATORY_MODEL_CREDITS.find((c) => c.id === "diaphragm");
      assert.strictEqual(diaphragm.author, "SocraticOS Core Team");
      assert.strictEqual(diaphragm.file, "Procedural Mesh");
      assert.ok(diaphragm.commercialUse.includes("Permitted"));

      const intercostals = RESPIRATORY_MODEL_CREDITS.find((c) => c.id === "intercostals");
      assert.strictEqual(intercostals.author, "SocraticOS Core Team");
      assert.strictEqual(intercostals.file, "Procedural Mesh");
      assert.ok(intercostals.commercialUse.includes("Permitted"));
    });
  });

  describe("The breathing cycle the scene actually animates", () => {
    it("completes a quiet breath between FRC and peak tidal volume", () => {
      let min = Infinity;
      let max = -Infinity;
      for (let t = 0; t < 1; t += 0.001) {
        const v = breathAt(t).volumeL;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      assert.strictEqual(min, 2.8, "A quiet breath must bottom out at FRC");
      assert.strictEqual(max, 3.5, "A quiet breath must peak at 3.5 L");
    });

    it("keeps volume continuous across the whole cycle", () => {
      let biggestStep = 0;
      let prev = breathAt(0).volumeL;
      for (let t = 0.001; t < 1; t += 0.001) {
        const v = breathAt(t).volumeL;
        biggestStep = Math.max(biggestStep, Math.abs(v - prev));
        prev = v;
      }
      assert.ok(biggestStep < 0.05, `Volume jumped by ${biggestStep} L in one step`);
    });

    it("drives air IN while inspiring and OUT while expiring", () => {
      assert.ok(breathAt(0.2).flowLps < 0, "Mid-inspiration flow must be inward");
      assert.ok(breathAt(0.7).flowLps > 0, "Mid-expiration flow must be outward");
    });

    it("carries a forced breath through FRC and into the expiratory reserve", () => {
      const mid = breathAt(0.7, { forced: true });
      assert.strictEqual(mid.phase, RESPIRATORY_PHASES.FORCED_EXPIRATION);
      // Halfway through expiration the lungs are passing THROUGH FRC; the
      // reserve comes out in the second half, which is what distinguishes a
      // forced breath from a quiet one.
      assert.ok(Math.abs(mid.volumeL - 2.8) < 0.05, "Mid-expiration should be passing through FRC");

      let min = Infinity;
      for (let t = 0.4; t < 1; t += 0.001) min = Math.min(min, breathAt(t, { forced: true }).volumeL);
      assert.strictEqual(min, 1.95, "A forced breath must bottom out at 1.95 L");

      let quietMin = Infinity;
      for (let t = 0.4; t < 1; t += 0.001) quietMin = Math.min(quietMin, breathAt(t).volumeL);
      assert.strictEqual(quietMin, 2.8, "A quiet breath must stop at FRC");
    });

    it("recruits the internal intercostals only when forcing", () => {
      assert.ok(breathAt(0.7, { forced: true }).internal > 0, "Forced expiration is active");
      assert.strictEqual(breathAt(0.7).internal, 0, "Quiet expiration is elastic recoil only");
    });
  });
});
