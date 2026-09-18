// ─── Respiratory model credits ───────────────────────────────────
// Attribution and licensing for the 3D assets the respiratory scene loads.
//
// Pure data, in lib/, so the attribution test can import the table that
// actually ships rather than keeping a copy of it.
// ───────────────────────────────────────────────────────

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
