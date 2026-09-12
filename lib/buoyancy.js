// ─── Archimedes' principle · density and buoyant force ──────────────
// The eureka can, the spring scale, and why a steel ship floats while a steel
// pebble sinks.
//
// The modelling decision the whole scene rests on: an object has TWO volumes,
// and confusing them is the misconception this topic exists to break. There is
// the volume of material it is made from — which fixes its mass — and the
// volume of fluid it pushes aside, which fixes the buoyant force. For a solid
// lump those are the same number, which is why students come away believing
// they always are. For a hull they differ by an order of magnitude, and the
// ship floats entirely because of the gap between them.
//
// So `volume` here always means the MATERIAL volume, the envelope is derived
// from the shape, and every force is computed from whichever of the two it
// actually depends on. Nothing in this file uses a fudge factor for shape:
// a hull floats because ρ_mean = m ÷ V_envelope comes out below the fluid's,
// and it sinks the moment it does not.
// ─────────────────────────────────────────────────────────────────────

/** Standard gravity, m/s². */
export const G = 9.81;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * The fluids the tank can be filled with, densities in g/cm³.
 *
 * Air is on the list for a reason that is easy to miss: it is a fluid, it does
 * exert an upthrust, and the reason nobody notices is that it is roughly a
 * thousandth of water's. Being able to select it and watch the buoyant force
 * fall to a fraction of a percent of the weight — rather than to zero — is the
 * cleanest way to say that weighing anything in air is already an
 * approximation.
 *
 * `opacity`, `roughness` and `metalness` are render hints. They live beside the
 * density because mercury has to LOOK like mercury for the scene to land; a
 * silvery liquid that a steel cube rests on top of is the memorable image.
 */
export const FLUIDS = {
  air: {
    label: "Air",
    density: 0.0012,
    colour: "#cbd5e1",
    opacity: 0.06,
    roughness: 1,
    metalness: 0,
    title: "0.0012 g/cm³ — a fluid too, just a very thin one",
  },
  gasoline: {
    label: "Gasoline",
    density: 0.75,
    colour: "#fef08a",
    opacity: 0.42,
    roughness: 0.1,
    metalness: 0,
    title: "0.75 g/cm³ — lighter than water, so water sinks in it",
  },
  freshwater: {
    label: "Fresh water",
    density: 1.0,
    colour: "#38bdf8",
    opacity: 0.38,
    roughness: 0.06,
    metalness: 0,
    title: "1.00 g/cm³ — the reference every other density is quoted against",
  },
  saltwater: {
    label: "Salt water",
    density: 1.03,
    colour: "#5eead4",
    opacity: 0.42,
    roughness: 0.06,
    metalness: 0,
    title: "1.03 g/cm³ — 3% denser, which is why you float higher in the sea",
  },
  honey: {
    label: "Honey",
    density: 1.42,
    colour: "#fbbf24",
    opacity: 0.58,
    roughness: 0.18,
    metalness: 0,
    title: "1.42 g/cm³ — dense, and nothing to do with how thick it is",
  },
  mercury: {
    label: "Mercury",
    density: 13.6,
    colour: "#e2e8f0",
    opacity: 0.98,
    roughness: 0.08,
    metalness: 0.98,
    title: "13.6 g/cm³ — a liquid metal that steel floats on",
  },
};

/**
 * Density presets for the hanging solid, g/cm³.
 *
 * Gold's 19.30 sits above the slider's nominal ceiling on purpose: mercury is
 * 13.6, and without something denser than mercury on the list the tank can
 * never show a solid sinking in it. Gold sinking where lead floats is the
 * whole reason mercury is interesting.
 */
export const SOLIDS = {
  wood: { label: "Oak", density: 0.6, colour: "#d4a373", title: "Seasoned oak — 0.60 g/cm³" },
  ice: { label: "Ice", density: 0.92, colour: "#e0f2fe", title: "Ice — 0.92 g/cm³, and that is why it floats" },
  aluminium: { label: "Aluminium", density: 2.7, colour: "#e2e8f0", title: "Aluminium — 2.70 g/cm³" },
  steel: { label: "Steel", density: 7.85, colour: "#b8c5d6", title: "Steel — 7.85 g/cm³" },
  gold: { label: "Gold", density: 19.3, colour: "#fde047", title: "Gold — 19.30 g/cm³, denser than mercury" },
};

/** Slider range for the density control, g/cm³. */
export const MIN_DENSITY = 0.2;
export const MAX_DENSITY = 19.3;
/** Slider range for the material volume, cm³. */
export const MIN_VOLUME = 50;
export const MAX_VOLUME = 500;

/**
 * How many times its own material volume each solid can push aside.
 *
 * One for anything solid — a cube of steel displaces a cube of steel. Twelve
 * for the hull, because a hull is a thin steel skin around a large box of air,
 * and twelve is roughly the ratio for a real ship's plating. That single
 * number is what turns 7.85 g/cm³ of steel into a mean density of 0.65 and
 * floats it.
 */
export const HULL_ENVELOPE = 12;

export const SHAPES = {
  cube: {
    label: "Cube",
    envelope: 1,
    prism: true,
    title: "A solid block — it displaces exactly its own volume",
  },
  sphere: {
    label: "Sphere",
    envelope: 1,
    prism: false,
    title: "A solid ball — same rule, but the waterline is a circle",
  },
  rock: {
    label: "Rock",
    envelope: 1,
    prism: true,
    title: "An irregular lump — shape is irrelevant, only volume counts",
  },
  hull: {
    label: "Boat hull",
    envelope: HULL_ENVELOPE,
    prism: true,
    title: `An open hull enclosing ${HULL_ENVELOPE}× its own steel in air`,
  },
};

export const fluidFor = (key) => FLUIDS[key] ?? FLUIDS.freshwater;
export const shapeFor = (key) => SHAPES[key] ?? SHAPES.cube;

/** Which named solid this density is, or "custom" if the slider is between them. */
export function solidPresetFor(density) {
  const hit = Object.entries(SOLIDS).find(([, s]) => Math.abs(s.density - density) < 0.005);
  return hit ? hit[0] : "custom";
}

// ─── Unit-carrying primitives ───────────────────────────────────────
//
// Densities arrive in g/cm³ and volumes in cm³ because those are the units the
// syllabus, the slider labels and the graduated cylinder all use. Newtons need
// SI, and 1 g/cm³ × 1 cm³ = 1 g, so the single conversion is a division by a
// thousand. Doing it in one place is what stops a stray factor of 1000
// appearing in one readout and not another.

/** Mass of `volumeCC` of material at `densityGCC`, in kilograms. */
export const massKg = (densityGCC, volumeCC) =>
  (Math.max(densityGCC, 0) * Math.max(volumeCC, 0)) / 1000;

/** Weight of that mass, in newtons. */
export const weightN = (densityGCC, volumeCC, g = G) => massKg(densityGCC, volumeCC) * g;

/**
 * Archimedes' principle itself: the upthrust equals the weight of the fluid
 * pushed aside.
 *
 * Deliberately the same function as `weightN` under a different name, because
 * that identity IS the principle — the buoyant force is not merely equal to
 * the weight of displaced fluid, it is that weight, computed the same way.
 */
export const buoyantForce = (fluidDensityGCC, displacedCC, g = G) =>
  weightN(fluidDensityGCC, displacedCC, g);

/** Density of a fluid in kg/m³ — the form the pressure equation wants. */
export const toSiDensity = (gcc) => gcc * 1000;

/** Gauge pressure at `depthCm` below the surface, in pascals. */
export const gaugePressure = (fluidDensityGCC, depthCm, g = G) =>
  toSiDensity(fluidDensityGCC) * g * (Math.max(depthCm, 0) / 100);

// ─── Geometry ───────────────────────────────────────────────────────

/**
 * The outside dimensions of each shape, in centimetres.
 *
 * `height` is what the waterline is measured against and `footprint` is the
 * area it cuts, so the two together turn a displaced volume into a draft the
 * scene can draw. The hull is modelled as a 3 : 1 : 1 box, which is both a
 * fair caricature of a barge and the reason its draft is shallow.
 */
export function shapeMetrics(shape, volumeCC) {
  const spec = shapeFor(shape);
  const material = Math.max(volumeCC, 1e-6);
  const envelope = material * spec.envelope;

  if (spec.envelope > 1) {
    // Proportioned vessel hull: 2.0 long × 1.2 wide × 1.0 deep (envelope = 2.4 a³).
    // Proportioned as a realistic marine craft that comfortably fits inside the overflow tank.
    const a = Math.cbrt(envelope / 2.4);
    const length = 2.0 * a;
    const width = 1.2 * a;
    const height = a;
    const footprint = length * width;
    return { spec, key: shape, materialCC: material, envelopeCC: envelope, height, length, width, footprint };
  }
  if (shape === "sphere") {
    const radius = Math.cbrt((3 * envelope) / (4 * Math.PI));
    return {
      spec,
      key: shape,
      materialCC: material,
      envelopeCC: envelope,
      height: 2 * radius,
      length: 2 * radius,
      width: 2 * radius,
      radius,
      footprint: Math.PI * radius * radius,
    };
  }
  // Cube, and the rock as a slightly taller lump of the same volume.
  const a = Math.cbrt(envelope);
  const stretch = shape === "rock" ? 1.18 : 1;
  const height = a * stretch;
  return {
    spec,
    key: shape,
    materialCC: material,
    envelopeCC: envelope,
    height,
    length: a / Math.sqrt(stretch),
    width: a / Math.sqrt(stretch),
    footprint: envelope / height,
  };
}

/**
 * How far down the object the waterline sits, as a fraction of its height,
 * given the fraction of its VOLUME that is under.
 *
 * The two are the same number for anything with vertical sides, and are not
 * for a sphere — a ball floating with half its volume under is half its
 * diameter under, but one with 92% of its volume under is only 83% of its
 * diameter under, because the widest part is in the middle. Drawing the
 * waterline at the volume fraction would put ice visibly too low in the water,
 * which is the one figure students are most likely to already know.
 */
export function waterlineFraction(shape, volumeFraction) {
  const f = clamp(volumeFraction, 0, 1);
  if (shapeFor(shape).prism) return f;
  // Spherical cap: f = 3u² − 2u³ for depth fraction u. Monotonic on [0,1], so
  // bisection inverts it in a handful of steps and never needs a cubic solve.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (3 * mid * mid - 2 * mid * mid * mid < f) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ─── The whole apparatus, solved once ───────────────────────────────

/**
 * One solve for the tank, the scale and the graduated cylinder.
 *
 * `topDepthCm` is how far the top of a fully submerged object sits below the
 * surface. It exists only to make the pressure figures concrete: the upthrust
 * itself does NOT depend on it, and the readout says so by printing the two
 * face pressures — which do grow with depth — beside a difference that does
 * not.
 */
export function solveBuoyancy({
  density = 2.7,
  volume = 200,
  fluid = "freshwater",
  shape = "cube",
  topDepthCm = 4,
  g = G,
} = {}) {
  const fluidSpec = fluidFor(fluid);
  const rhoF = fluidSpec.density;
  const rhoObj = clamp(density, 0.001, 100);
  const metrics = shapeMetrics(shape, volume);

  const mass = massKg(rhoObj, metrics.materialCC);
  const weight = mass * g;

  /** Mass ÷ the volume it can push aside. This, not ρ_obj, decides floating. */
  const meanDensity = (mass * 1000) / metrics.envelopeCC;

  // What it would take to hold the whole envelope under.
  const fullyImmersedUpthrust = buoyantForce(rhoF, metrics.envelopeCC, g);
  const floats = meanDensity < rhoF;
  /** A hull that goes under floods, and then displaces only its own steel. */
  const swamped = !floats && metrics.spec.envelope > 1;

  const displacedCC = floats
    ? (mass * 1000) / rhoF
    : swamped
      ? metrics.materialCC
      : metrics.envelopeCC;

  const upthrust = buoyantForce(rhoF, displacedCC, g);
  const displacedMassG = rhoF * displacedCC;

  const submergedFraction = clamp(displacedCC / metrics.envelopeCC, 0, 1);
  const draftFraction = floats ? waterlineFraction(shape, submergedFraction) : 1;
  const draftCm = metrics.height * draftFraction;
  const freeboardCm = Math.max(metrics.height - draftCm, 0);

  // The spring scale carries whatever the fluid does not. A floating object
  // needs no help at all, so the line goes slack and the scale reads zero.
  const apparentWeight = Math.max(weight - upthrust, 0);
  const netForce = upthrust - weight;

  // Pressure on the top and bottom faces of a fully immersed object. Their
  // difference times the horizontal area is the upthrust — the same number by
  // a completely different route, which is why both are worth printing.
  const submergedHeight = metrics.height * (floats ? draftFraction : 1);
  const topDepth = floats ? 0 : Math.max(topDepthCm, 0);
  const bottomDepth = topDepth + submergedHeight;
  const pressureTop = gaugePressure(rhoF, topDepth, g);
  const pressureBottom = gaugePressure(rhoF, bottomDepth, g);
  const crossSection = submergedHeight > 1e-9 ? displacedCC / submergedHeight : metrics.footprint;
  const pressureUpthrust = ((pressureBottom - pressureTop) * crossSection) / 10000;

  return {
    fluid: fluidSpec,
    shape: metrics.spec,
    metrics,

    objectDensity: rhoObj,
    fluidDensity: rhoF,
    meanDensity,
    /** Below 1 it floats, above 1 it sinks. The single number that decides. */
    densityRatio: meanDensity / rhoF,

    massKg: mass,
    massG: mass * 1000,
    weight,
    upthrust,
    fullyImmersedUpthrust,
    apparentWeight,
    /** What a scale calibrated in grams would show while it hangs. */
    apparentMassG: (apparentWeight / g) * 1000,
    netForce,
    /** If the line were cut: up is positive. */
    acceleration: mass > 1e-12 ? netForce / mass : 0,
    weightLostFraction: weight > 1e-12 ? upthrust / weight : 0,

    displacedCC,
    displacedMassG,
    /** The overflow that ends up in the graduated cylinder, in mL. */
    overflowML: displacedCC,

    floats,
    swamped,
    neutral: Math.abs(meanDensity - rhoF) < 1e-6,
    submergedFraction,
    draftFraction,
    draftCm,
    freeboardCm,

    topDepth,
    bottomDepth,
    pressureTop,
    pressureBottom,
    pressureDifference: pressureBottom - pressureTop,
    /** Upthrust recomputed from the pressure difference. Must match `upthrust`. */
    pressureUpthrust,
  };
}

/**
 * The same object dropped into every fluid on the list.
 *
 * The comparison is the lesson — an aluminium cube sinks in five of the six
 * and rests on top of the sixth — so the scene draws it as a strip rather than
 * making a student work the slider round and remember.
 */
export function fluidComparison({ density, volume, shape } = {}) {
  return Object.keys(FLUIDS).map((key) => {
    const solved = solveBuoyancy({ density, volume, shape, fluid: key });
    return {
      key,
      label: FLUIDS[key].label,
      fluidDensity: FLUIDS[key].density,
      floats: solved.floats,
      submergedFraction: solved.submergedFraction,
      upthrust: solved.upthrust,
      apparentWeight: solved.apparentWeight,
    };
  });
}
