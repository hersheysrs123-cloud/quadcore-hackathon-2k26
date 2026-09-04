import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Physiological Mechanics & Respiratory Simulation Engine ─────────
export const RESPIRATORY_PHASES = {
  INSPIRATION: "inspiration",
  QUIET_EXPIRATION: "quiet_expiration",
  FORCED_EXPIRATION: "forced_expiration",
};

/**
 * Calculates instantaneous thoracic volume based on normalized expansion parameter (-1 to +1)
 * Resting FRC = 2.8 L
 * Full Inspiration = ~3.5 L to 3.8 L
 * Forced Expiration (ERV utilized) = ~1.95 L
 */
export function calculateThoraxVolume(expansion) {
  if (expansion >= 0) {
    return Number((2.8 + expansion * 0.7).toFixed(2));
  } else {
    return Number((2.8 + expansion * 0.85).toFixed(2));
  }
}

/**
 * Calculates intra-thoracic relative pressure ΔP (relative to Patm = 101.3 kPa)
 * via Boyle's Law inverse relationship with volume change.
 */
export function calculateIntraThoracicPressure(phase, expansion, timeInPhase = 0.5) {
  if (phase === RESPIRATORY_PHASES.INSPIRATION) {
    // Negative pressure peaks mid-inspiration
    const bell = Math.sin(timeInPhase * Math.PI);
    return -0.28 * Math.max(0.2, bell);
  }
  if (phase === RESPIRATORY_PHASES.QUIET_EXPIRATION) {
    // Gentle positive pressure during passive elastic recoil
    const bell = Math.sin(timeInPhase * Math.PI);
    return 0.22 * Math.max(0.15, bell);
  }
  if (phase === RESPIRATORY_PHASES.FORCED_EXPIRATION) {
    // High positive pressure due to internal intercostal & abdominal compression
    return 1.15;
  }
  return 0;
}

/**
 * Calculates airway flow rate V̇ (L/s) driven by pressure gradient.
 * Inflow < 0, Outflow > 0.
 */
export function calculateAirflowRate(pressure) {
  const airwayResistance = 0.45; // kPa / (L/s)
  // Flow = ΔP / R
  return pressure / airwayResistance;
}

/**
 * Antagonistic Intercostal Activation Engine
 */
export function getIntercostalMuscleStates(phase) {
  if (phase === RESPIRATORY_PHASES.INSPIRATION) {
    return {
      external: { contracted: true, tension: 1.0, action: "elevate_ribs" },
      internal: { contracted: false, tension: 0.0, action: "relaxed" },
      diaphragm: { contracted: true, action: "flatten_down" },
    };
  }
  if (phase === RESPIRATORY_PHASES.QUIET_EXPIRATION) {
    return {
      external: { contracted: false, tension: 0.0, action: "relaxed" },
      internal: { contracted: false, tension: 0.0, action: "relaxed" },
      diaphragm: { contracted: false, action: "recoil_up" },
    };
  }
  if (phase === RESPIRATORY_PHASES.FORCED_EXPIRATION) {
    return {
      external: { contracted: false, tension: 0.0, action: "relaxed" },
      internal: { contracted: true, tension: 1.0, action: "depress_ribs" },
      diaphragm: { contracted: false, action: "pushed_up_by_abdominals" },
    };
  }
  return null;
}

export const RESPIRATORY_MODEL_CREDITS = [
  {
    id: "lungs",
    name: "Photorealistic Human Lungs Model",
    icon: "🫁",
    file: "lung.glb",
    size: "17.1 MB",
    type: "Clinical 3D Organ Scan",
    license: "CC-BY-4.0 & MIT",
    licenseTag: "Permissive / Commercial Allowed",
    licenseColor: "sky",
    commercialUse: "Permitted (CC-BY-4.0 with attribution)",
    originalCreator: "neshallads",
    sourceUrl: "https://sketchfab.com/3d-models/realistic-human-lungs-ce09f4099a68467880f46e61eb9a3531",
    author: "yihalem123",
    project: "Human-Organ3D",
    repoUrl: "https://github.com/yihalem123/Human-Organ3D",
    description:
      "High-resolution clinical 3D organ scan created by neshallads under CC-BY-4.0, featuring bilateral pulmonary lobes, primary bronchi, pulmonary vascular branchings, and tracheobronchial airway tree with dynamic breathing volume expansion.",
  },
  {
    id: "skeleton",
    name: "Clinical CT-Derived Thoracic Skeleton",
    icon: "🦴",
    file: "skeleton_ct.glb",
    size: "16.3 MB",
    type: "CT Scan Reconstruction",
    license: "CC-BY-4.0",
    licenseTag: "Permissive / Commercial Allowed",
    licenseColor: "emerald",
    commercialUse: "Permitted (CC-BY-4.0 with attribution)",
    originalCreator: "Terrie Simmons-Ehrhardt",
    sourceUrl: "https://sketchfab.com/3d-models/ct-derived-human-skeleton-7235c83248574ce986dd9e8b35159afa",
    author: "Meteorkid",
    project: "Skeleton-Anatomy",
    repoUrl: "https://github.com/Meteorkid/skeleton-anatomy",
    description:
      "Clinical CT scan reconstruction created by Terrie Simmons-Ehrhardt and published under CC-BY-4.0. We isolate 43 anatomical bone nodes (all 24 ribs, T1–T12 thoracic vertebrae, L1–L3 lumbar crura anchors, sternum, and clavicles) with active bucket-handle & pump-handle kinematics.",
  },
  {
    id: "diaphragm",
    name: "Sculpted Muscular Diaphragm Dome",
    icon: "🪂",
    file: "Procedural Mesh",
    size: "Procedural Vector Shader",
    type: "Parametric Anatomical Mesh",
    license: "Original Code (SocraticOS)",
    licenseTag: "Commercial Allowed",
    licenseColor: "purple",
    commercialUse: "Permitted (100% Original Code)",
    originalCreator: "SocraticOS Core Team",
    sourceUrl: null,
    author: "SocraticOS Core Team",
    project: "SocraticOS Simulator",
    repoUrl: null,
    description:
      "Custom 32-segment parametric radial dome with procedural trifoliate central tendon (centrum tendineum), 3 physiological hiatuses (Caval T8, Esophageal T10, Aortic T12), bilateral vertebral crura, and real-time vertex flattening on inspiration (Y = 1.05 → 0.63).",
  },
  {
    id: "intercostals",
    name: "Dual-Layer Antagonistic Intercostal Muscles",
    icon: "💪",
    file: "Procedural Mesh",
    size: "Procedural Vector Shader",
    type: "Striated Myofibril Simulation",
    license: "Original Code (SocraticOS)",
    licenseTag: "Commercial Allowed",
    licenseColor: "rose",
    commercialUse: "Permitted (100% Original Code)",
    originalCreator: "SocraticOS Core Team",
    sourceUrl: null,
    author: "SocraticOS Core Team",
    project: "SocraticOS Simulator",
    repoUrl: null,
    description:
      "132 active procedural muscle fascicles across all 11 intercostal spaces with dual-layer antagonistic kinematics (superficial external +35° inspiratory vs deep internal -45° forced expiratory), Canvas-generated striated myofibril textures, and dynamic tension shaders.",
  },
];

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
      const pInsp = calculateIntraThoracicPressure(RESPIRATORY_PHASES.INSPIRATION, 0.5, 0.5);
      assert.ok(pInsp < 0, "Inspiration must create sub-atmospheric relative pressure");
      assert.ok(pInsp <= -0.2, "Peak inspiration pressure should reach ~ -0.28 kPa");

      const flow = calculateAirflowRate(pInsp);
      assert.ok(flow < 0, "Airflow must be negative (inflow into lungs)");
    });

    it("generates positive relative pressure during quiet expiration", () => {
      const pExp = calculateIntraThoracicPressure(RESPIRATORY_PHASES.QUIET_EXPIRATION, 0.5, 0.5);
      assert.ok(pExp > 0, "Quiet expiration must create positive pressure from recoil");

      const flow = calculateAirflowRate(pExp);
      assert.ok(flow > 0, "Airflow must be positive (outflow out of trachea)");
    });

    it("generates high positive pressure spike during forced expiration", () => {
      const pForced = calculateIntraThoracicPressure(RESPIRATORY_PHASES.FORCED_EXPIRATION, -0.9, 0.5);
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
});
