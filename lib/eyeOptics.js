// ─── Human eye optics ───────────────────────────────────────────────
// The optical and physiological model behind the 3D eye scene.
//
// It lives in `lib/` rather than inside the canvas so the unit tests can
// import the very code that ships, instead of a copy that drifts from it.
// Nothing here touches React or three.js: it is arithmetic, and every number
// it produces is one the scene puts on screen.
// ─────────────────────────────────────────────────────────────────────

/**
 * Listing's reduced eye — the standard schematic the syllabus uses.
 *
 * A single refracting surface of 60 D separating air from a medium of index
 * 1.333, with the retina 22.2 mm behind it. That is not a coincidence: the
 * axial length IS n ÷ P, which is exactly what "relaxed and focused on
 * infinity" means.
 */
export const EYE = {
  /** Refractive index of the aqueous and vitreous humours. */
  n: 1.333,
  /** Total power of the unaccommodated eye, dioptres. */
  relaxedPower: 60,
  /** Fixed power of the cornea + tear film — the eye's biggest refractor. */
  corneaPower: 43,
  /** Corneal vertex to retina — the axial length a biometer measures. */
  globeLength: 0.024,
  /** Most extra power the young lens can add, dioptres. */
  accommodationAmplitude: 10,
  /** Refractive index of the crystalline lens substance. */
  lensIndex: 1.42,
  /** Semi-diameter of the lens, metres — 9 mm across, relaxed. */
  lensSemiDiameter: 0.0045,
  /** Blur circle a young retina still reads as sharp, metres. */
  blurTolerance: 3e-5,
};

/** Retina distance from the principal plane: n ÷ P, by construction 22.2 mm. */
export const axialLength = () => EYE.n / EYE.relaxedPower;

/**
 * Equivalent power of two separated refracting elements: Gullstrand's
 * relation, P = P₁ + P₂ − dP₁P₂/n.
 *
 * The eye is not a single thin lens, and the powers of its two elements do
 * NOT simply add — separating them costs the system real power. Ignoring that
 * put the drawn ray convergence several millimetres off the retina while the
 * readout insisted the eye was perfectly focused.
 */
export function equivalentPower(cornea, lens, separation = lensSeparation()) {
  return cornea + lens - (separation * cornea * lens) / EYE.n;
}

/**
 * Where the lens sits behind the cornea, metres.
 *
 * This is NOT a free parameter. Given a 24 mm globe, a 60 D eye and a 43 D
 * cornea, the separation is forced: it is the only one that puts the relaxed
 * eye's back focus exactly on the retina. Guessing it instead (5 mm looked
 * reasonable) left the traced rays crossing 0.4 mm short of the fovea while
 * the readout insisted the eye was in focus.
 *
 * It solves to 6.3 mm, which is where Gullstrand's schematic eye puts it.
 */
export const lensSeparation = () => {
  const f = EYE.n / EYE.relaxedPower;
  return (EYE.globeLength - f) / (1 - (f * EYE.corneaPower) / EYE.n);
};

/** How much of a dioptre added at the lens survives to the whole eye. */
const LENS_COUPLING = 1 - (lensSeparation() * EYE.corneaPower) / EYE.n;

/**
 * Lens power that, sitting where it does behind the cornea, gives the eye the
 * total power asked for. Inverting Gullstrand rather than subtracting.
 */
export function lensPowerForTotal(total) {
  return (total - EYE.corneaPower) / LENS_COUPLING;
}

/**
 * In-situ power of the relaxed crystalline lens — 21.3 D here, which is the
 * order biometry actually measures. The often-quoted "17 D" is what is left
 * after subtracting the cornea from 60 as though the two were in contact.
 */
export const lensRelaxedPower = () => lensPowerForTotal(EYE.relaxedPower);

/** The near point — closest distance the eye can still bring into focus. */
export const nearPoint = () => 1 / EYE.accommodationAmplitude;

/**
 * Total power needed to focus an object `u` metres away onto the retina.
 *
 * From n/v = P − 1/u with v pinned to the axial length. At u = ∞ the 1/u term
 * vanishes and the answer is the relaxed 60 D; every dioptre beyond that is
 * accommodation the lens has to supply.
 */
export function requiredPower(objectDistanceM) {
  return EYE.relaxedPower + 1 / Math.max(objectDistanceM, 1e-6);
}

/** Dioptres of accommodation an object at `u` demands: simply 1/u. */
export function accommodationDemand(objectDistanceM) {
  return 1 / Math.max(objectDistanceM, 1e-6);
}

/**
 * What the ciliary muscle actually delivers.
 *
 * Auto-accommodation supplies the demand up to the amplitude and no further —
 * which is why an object closer than the near point cannot be focused however
 * hard you try.
 */
export function appliedAccommodation(objectDistanceM, { auto = true, manual = 0 } = {}) {
  const demand = accommodationDemand(objectDistanceM);
  const supplied = auto ? demand : manual;
  return Math.min(Math.max(supplied, 0), EYE.accommodationAmplitude);
}

/** Total eye power once the lens has added its accommodation. */
export const totalPower = (accommodation) => EYE.relaxedPower + accommodation;

/**
 * Power of the crystalline lens alone — the only part that changes.
 *
 * One dioptre of accommodation at the eye needs rather more than one dioptre
 * at the lens, because the lens sits behind the cornea and only ~80% of what
 * it adds reaches the eye's equivalent power.
 */
export const lensPower = (accommodation) => lensPowerForTotal(totalPower(accommodation));

/**
 * Radius of curvature of each lens face, metres.
 *
 * Thin-lens-in-a-medium form of the lensmaker's equation, P = (n_l − n_m)(1/R₁ − 1/R₂),
 * with equal and opposite radii so 1/R₁ − 1/R₂ = 2/R. The relaxed lens comes
 * out near 8.2 mm and the fully accommodated one near 5.1 mm, the same order
 * as the anatomy books measure — the model is not fitted to them.
 */
export function lensRadiusOfCurvature(accommodation) {
  const deltaN = EYE.lensIndex - EYE.n;
  return (2 * deltaN) / lensPower(accommodation);
}

/**
 * Axial thickness of the lens, metres.
 *
 * Two spherical caps back to back: each contributes a sagitta
 * s = R − √(R² − h²), and the equator carries a little extra substance. The
 * lens narrows slightly as it rounds up, so the semi-diameter shrinks with
 * accommodation too.
 */
export function lensThickness(accommodation) {
  const R = lensRadiusOfCurvature(accommodation);
  const h = lensSemiDiameter(accommodation);
  const sagitta = R - Math.sqrt(Math.max(R * R - h * h, 0));
  const edge = 0.0010 - 0.000075 * accommodation;
  return 2 * sagitta + edge;
}

/** The lens pulls in as it rounds up: 9.0 mm across relaxed, ~8.5 mm at full effort. */
export function lensSemiDiameter(accommodation) {
  return EYE.lensSemiDiameter - 0.000025 * accommodation;
}

/**
 * Where the image actually forms, measured back from the principal plane.
 *
 * v = n ÷ (P − 1/u). Compare it with the axial length and the sign of the
 * difference is the whole diagnosis: larger means the rays are still
 * converging when they hit the retina, smaller means they crossed early.
 */
export function imageDistance(power, objectDistanceM) {
  const denominator = power - 1 / Math.max(objectDistanceM, 1e-6);
  if (denominator <= 0) return Infinity;
  return EYE.n / denominator;
}

/** Signed focus error, metres. Positive = focal point behind the retina. */
export function focusError(power, objectDistanceM) {
  const v = imageDistance(power, objectDistanceM);
  if (!Number.isFinite(v)) return Infinity;
  return v - axialLength();
}

/**
 * Diameter of the blur circle the image casts on the retina, metres.
 *
 * Measured off the marginal ray itself rather than from a·|v − L| ÷ v. That
 * shortcut treats the cone as starting at the principal plane, but the eye's
 * aperture stop is the pupil, which sits nearly two millimetres in front of
 * it — and the ray is bent again by the lens after passing through. Taking
 * the shortcut made the blur ring drawn on the retina 12% smaller than the
 * spread of the rays drawn arriving at it.
 */
export function blurCircleDiameter(power, objectDistanceM, pupilDiameterM) {
  const v = imageDistance(power, objectDistanceM);
  if (!Number.isFinite(v)) return pupilDiameterM;
  const marginal = traceRayHeights(pupilDiameterM / 2, objectDistanceM, v);
  return Math.abs(marginal.hR) * 2;
}

/** Blur expressed as an angle in the visual field, arcminutes. */
export function blurAngleArcmin(power, objectDistanceM, pupilDiameterM) {
  const blur = blurCircleDiameter(power, objectDistanceM, pupilDiameterM);
  return (blur / axialLength()) * (180 / Math.PI) * 60;
}

/**
 * Half-width of the in-focus zone, dioptres.
 *
 * Solved from the blur function rather than from a closed form, so it cannot
 * drift away from what `isInFocus` decides. Still inversely proportional to
 * pupil diameter — a constricted pupil forgives several times more focus
 * error, which is the pinhole effect — and lands near the textbook ±0.5 D for
 * a 3 mm pupil.
 */
export function depthOfFocus(pupilDiameterM, objectDistanceM = 1) {
  const base = requiredPower(objectDistanceM);
  let lo = 0;
  let hi = 8;
  for (let i = 0; i < 44; i += 1) {
    const mid = (lo + hi) / 2;
    if (blurCircleDiameter(base + mid, objectDistanceM, pupilDiameterM) < EYE.blurTolerance) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Is the retinal image sharp? True when the blur circle is inside tolerance. */
export function isInFocus(power, objectDistanceM, pupilDiameterM) {
  return blurCircleDiameter(power, objectDistanceM, pupilDiameterM) <= EYE.blurTolerance;
}

// ─── Pupil reflex ───────────────────────────────────────────────────

/**
 * Scene luminance from illuminance, cd/m².
 *
 * L = Eρ ÷ π for a diffuse surface. The 18% reflectance is the standard grey
 * card, so the lux on the slider maps to what the eye actually sees rather
 * than to the lamp's own output.
 */
export function luminanceFromLux(lux, reflectance = 0.18) {
  return (Math.max(lux, 0) * reflectance) / Math.PI;
}

/**
 * Pupil diameter for a given scene luminance, metres.
 *
 * Moon & Spencer's tanh fit. It saturates at both ends, which is the point:
 * between starlight and full sun the light changes by a factor of 10⁹ and the
 * pupil manages barely 4× in diameter — the reflex is a coarse trim, and the
 * heavy lifting is done by photochemical adaptation.
 */
export function pupilDiameterFromLuminance(luminanceCdM2) {
  const L = Math.max(luminanceCdM2, 1e-9);
  const mm = 4.9 - 3 * Math.tanh(0.4 * (Math.log10(L) + 1));
  return Math.min(Math.max(mm, 1.5), 8) / 1000;
}

/** Pupil diameter straight from the lux slider, metres. */
export const pupilDiameterFromLux = (lux) => pupilDiameterFromLuminance(luminanceFromLux(lux));

/** Pupil area, m². */
export const pupilArea = (diameterM) => (Math.PI * diameterM * diameterM) / 4;

/**
 * Retinal illuminance in trolands — luminance × pupil area in mm².
 *
 * This is the number the reflex is really regulating, and it shows how little
 * of the work the pupil does on its own.
 */
export function retinalIlluminanceTd(luminanceCdM2, pupilDiameterM) {
  const areaMm2 = pupilArea(pupilDiameterM * 1000);
  return luminanceCdM2 * areaMm2;
}

// ─── Muscle states ──────────────────────────────────────────────────

/**
 * The counter-intuitive bit of accommodation, and the one students most often
 * get backwards: focusing on something NEAR is the active state. The ciliary
 * ring contracts, which *slackens* the zonules it is pulling on, and the lens
 * is then free to spring back to the fat shape it wants to be.
 */
export function ciliaryState(accommodation) {
  const effort = accommodation / EYE.accommodationAmplitude;
  // Thresholds set from viewing distance, not from round numbers: the eye is
  // effectively relaxed beyond a metre (< 1 D), and anything inside about
  // 33 cm — all ordinary reading and close work — is genuinely contracted.
  const contracted = effort > 0.3;
  const partly = effort > 0.1;
  return {
    effort,
    muscle: contracted ? "contracted" : partly ? "partly contracted" : "relaxed",
    zonules: contracted ? "slack" : partly ? "easing" : "taut",
    lens: contracted ? "thick and spherical" : partly ? "rounding up" : "thin and flat",
    /** Ring radius shrinks as the muscle contracts inward toward the lens. */
    ciliaryRingRadius: 0.0060 - 0.0005 * effort,
  };
}

/**
 * Iris muscles are antagonists. Bright light drives the circular sphincter;
 * dim light drives the radial dilator. Naming both states stops the scene
 * implying one muscle does everything.
 */
export function irisState(pupilDiameterM) {
  const mm = pupilDiameterM * 1000;
  // Normalised across the 1.5–8 mm physiological span.
  const openness = (mm - 1.5) / (8 - 1.5);
  return {
    openness,
    diameterMm: mm,
    sphincter: openness < 0.35 ? "contracted" : openness < 0.7 ? "partly contracted" : "relaxed",
    dilator: openness < 0.35 ? "relaxed" : openness < 0.7 ? "partly contracted" : "contracted",
    response: openness < 0.35 ? "constricted" : openness < 0.7 ? "mid-dilated" : "dilated",
  };
}

/** Normalised 0–1 index of how strongly the lens is curved, for the readout. */
export function curvatureIndex(accommodation) {
  const flat = lensRadiusOfCurvature(0);
  const round = lensRadiusOfCurvature(EYE.accommodationAmplitude);
  const R = lensRadiusOfCurvature(accommodation);
  return (flat - R) / (flat - round);
}

/**
 * Everything the scene and its readout need, from the two things the user
 * controls. Deriving it in one place is what keeps the 3D model, the status
 * pills and the blur preview from ever disagreeing with each other.
 */
export function solveEye({ objectDistanceM, lux, auto = true, manualAccommodation = 0 }) {
  const accommodation = appliedAccommodation(objectDistanceM, { auto, manual: manualAccommodation });
  const power = totalPower(accommodation);
  const pupil = pupilDiameterFromLux(lux);
  const luminance = luminanceFromLux(lux);
  const demand = accommodationDemand(objectDistanceM);
  const v = imageDistance(power, objectDistanceM);

  return {
    accommodation,
    demand,
    /** Beyond the near point the eye simply runs out of lens. */
    beyondNearPoint: demand > EYE.accommodationAmplitude + 1e-9,
    power,
    lensPower: lensPower(accommodation),
    lensRadius: lensRadiusOfCurvature(accommodation),
    lensThickness: lensThickness(accommodation),
    lensSemiDiameter: lensSemiDiameter(accommodation),
    curvatureIndex: curvatureIndex(accommodation),
    imageDistance: v,
    focusError: focusError(power, objectDistanceM),
    blur: blurCircleDiameter(power, objectDistanceM, pupil),
    blurArcmin: blurAngleArcmin(power, objectDistanceM, pupil),
    depthOfFocus: depthOfFocus(pupil, objectDistanceM),
    inFocus: isInFocus(power, objectDistanceM, pupil),
    pupil,
    luminance,
    trolands: retinalIlluminanceTd(luminance, pupil),
    ciliary: ciliaryState(accommodation),
    iris: irisState(pupil),
    axialLength: axialLength(),
  };
}

// ─── Scene geometry ─────────────────────────────────────────────────

/**
 * Where each structure sits along the optical axis, in millimetres from the
 * centre of a 24 mm globe.
 *
 * Kept here beside the optics rather than in the canvas because the lens
 * plane is not a decorative choice — it is forced by the optics, and the
 * drawn rays are only right if the picture uses the same number the maths does.
 */
export const EYE_GEOMETRY = {
  corneaVertex: -12,
  pupilPlane: -8.4,
  get lensPlane() {
    return this.corneaVertex + lensSeparation() * 1000;
  },
  retina: 12,
  /** The equivalent principal plane: one focal length in front of the retina. */
  get principalPlane() {
    return this.retina - axialLength() * 1000;
  },
};

/**
 * Heights of one ray at the cornea, the lens and the retina, in metres.
 *
 * The cornea's refraction is exact — a ray entering at h_C heads for the
 * cornea's own focus at n ÷ (P_cornea − 1/u), which fixes its height
 * everywhere between there and the lens. The lens then supplies whatever
 * remains to reach the image point `solveEye` reported, so the ray crosses
 * the axis exactly where the readout says it does.
 */
export function traceRayHeights(heightAtPupil, objectDistanceM, imageDistanceM) {
  const yC = EYE_GEOMETRY.corneaVertex / 1000;
  const yP = EYE_GEOMETRY.pupilPlane / 1000;
  const yL = EYE_GEOMETRY.lensPlane / 1000;
  const yR = EYE_GEOMETRY.retina / 1000;

  const corneaFocus = EYE.n / (EYE.corneaPower - 1 / Math.max(objectDistanceM, 1e-6));
  const shrinkAt = (depth) => 1 - depth / corneaFocus;

  const atPupil = shrinkAt(yP - yC);
  const hC = Math.abs(atPupil) < 1e-6 ? heightAtPupil : heightAtPupil / atPupil;
  const hL = hC * shrinkAt(yL - yC);

  const yFocus = Number.isFinite(imageDistanceM)
    ? EYE_GEOMETRY.principalPlane / 1000 + imageDistanceM
    : Infinity;
  const m2 = Number.isFinite(yFocus) && Math.abs(yFocus - yL) > 1e-9 ? -hL / (yFocus - yL) : 0;

  return { hC, hL, hR: hL + m2 * (yR - yL), yFocus, yC, yP, yL, yR };
}
