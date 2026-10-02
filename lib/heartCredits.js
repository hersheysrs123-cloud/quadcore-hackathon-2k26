// ─── 3D model credits ───────────────────────────────────────────────
// Attribution and licensing for the scanned model the cardiac scene loads:
// the heart, from BodyParts3D. (The reflex arc's arm is our own model, built
// by scripts/arm-model, and needs no credit.)
//
// Pure data, in lib/, so the attribution test can import the table that
// actually ships. The scene shows it in its Credits panel.
//
// Licence: BodyParts3D is distributed under Creative Commons Attribution
// 4.0 International (CC BY 4.0), which permits commercial use, adaptation
// and redistribution provided the credit below is given and changes are
// indicated. (The 2013 OBJ files still carry an older "CC BY-SA 2.1 Japan"
// header; the database's current licence page states CC BY 4.0, and that
// is the licence this credit follows.)
// ─────────────────────────────────────────────────────────────────────

export const HEART_MODEL_CREDIT = {
  id: "heart",
  name: "Sectioned human heart",
  file: "public/models/heart.glb",
  source: "BodyParts3D",
  sourceUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html",
  licenseUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
  license: "CC BY 4.0",
  licenseUrlCc: "https://creativecommons.org/licenses/by/4.0/",
  commercialUse: true,
  /** The credit line the licensor asks for, verbatim. */
  attribution: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International",
  /** CC BY 4.0 requires saying what was changed. */
  changes:
    "Adapted: heart parts (cavities, valve leaflets and cusps, papillary muscles, atrial walls, coronary vessels, great vessels) re-oriented to the four-chamber plane and sectioned; ventricular walls modelled around the scanned cavities at textbook thicknesses; epicardial fat added; recoloured, remeshed and animated.",
  parts: [
    "Cavities of the four chambers (FJ2422–FJ2425)",
    "Walls of the left and right atria (FJ2438, FJ2439)",
    "Tricuspid, mitral, aortic and pulmonary leaflets and cusps",
    "Papillary muscles of both ventricles",
    "Coronary arteries, coronary sinus and cardiac veins",
    "Aorta, pulmonary trunk and arteries, venae cavae, pulmonary veins, arch branches",
  ],
};
