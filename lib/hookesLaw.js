// ─── Hooke's law and the elastic limit ──────────────────────────────
// The mechanics behind the spring scene: the linear region, the elastic
// limit, what happens past it, and the permanent set the spring is left with
// afterwards.
//
// The point the whole scene exists to make is that F = kx is not a law of
// springs, it is a description of springs BELOW a threshold — so the model
// here has to keep working above that threshold rather than stopping at it.
// ─────────────────────────────────────────────────────────────────────

/** Standard gravity, m/s². */
export const G = 9.81;

/** Unstretched length of the coil, metres. */
export const NATURAL_LENGTH = 0.12;

/**
 * Extension at which any of these springs reaches its elastic limit, metres.
 *
 * A fixed EXTENSION rather than a fixed force, because what gives way is the
 * coil geometry: the wire is twisted past its yield point once the helix has
 * opened by about this much, whatever the wire's stiffness. It follows that a
 * stiffer spring holds a proportionally larger load before yielding —
 * F_limit = k·x_limit — which is what the graph panel shows as the limit point
 * sliding up the line while staying over the same extension.
 */
export const ELASTIC_LIMIT_EXTENSION = 0.14;

/** Extension at which the coils have pulled straight and the spring is scrap. */
export const FAILURE_EXTENSION = 0.3;

/**
 * How much more load the coil takes between yielding and pulling straight.
 *
 * Fixing this ratio rather than the plastic gradient is what keeps the plastic
 * branch reachable for every spring on the slider: a stiff spring and a soft
 * one both survive 60% past their own limit, so the shape of the graph is the
 * same story at 10 N/m as at 150 N/m even though the numbers on the axes are
 * fifteen times apart.
 */
export const FAILURE_FORCE_RATIO = 1.6;

/**
 * Gradient of the plastic branch, N/m — always well below k.
 *
 * Derived from the two ends of that branch rather than picked, so the curve
 * cannot be drawn through points the solver disagrees with.
 */
export const plasticStiffness = (k) =>
  ((FAILURE_FORCE_RATIO - 1) * elasticLimitForce(k)) / (FAILURE_EXTENSION - ELASTIC_LIMIT_EXTENSION);

/** The load that pulls this spring straight, newtons. */
export const failureForce = (k) => FAILURE_FORCE_RATIO * elasticLimitForce(k);

/** The slotted masses on the hanger, in kilograms. */
export const MASS_STEP = 0.05;
export const MIN_MASS = 0.05;
export const MAX_MASS = 2.5;

/** Weight of a hung mass — the force actually stretching the spring. */
export const loadForce = (massKg, g = G) => Math.max(massKg, 0) * g;

/** The load at which this spring reaches its elastic limit, newtons. */
export const elasticLimitForce = (k) => k * ELASTIC_LIMIT_EXTENSION;

/**
 * Extension while the load is being INCREASED, metres.
 *
 * Two straight segments: Hooke's law up to the limit, then a shallower plastic
 * branch. Their meeting point is the elastic limit itself.
 */
export function loadingExtension(force, k) {
  if (k <= 0) return 0;
  const limit = elasticLimitForce(k);
  if (force <= limit) return force / k;
  const beyond = Math.min(force, failureForce(k)) - limit;
  return ELASTIC_LIMIT_EXTENSION + beyond / plasticStiffness(k);
}

/**
 * The extension the spring keeps once every weight is taken off, metres.
 *
 * Unloading runs back down a line of the ORIGINAL gradient k — plastic flow
 * does not soften the spring, it just moves where it starts from. The offset
 * between that line and the origin is the permanent set.
 */
export function permanentSet(peakForce, k) {
  if (k <= 0 || peakForce <= elasticLimitForce(k)) return 0;
  // Once the coils are straight the spring cannot take any more load, so the
  // set stops growing too — without this cap an absurd overload leaves a
  // "permanent set" longer than the stretched spring it came from.
  const capped = Math.min(peakForce, failureForce(k));
  return Math.max(loadingExtension(capped, k) - capped / k, 0);
}

/**
 * Extension now, given the load now and the worst load this spring has ever
 * carried.
 *
 * A spring remembers its peak and nothing else, which is why `peakForce` is
 * the only history the model needs. Below it the spring behaves elastically
 * again, just about a new origin; above it, it is yielding further.
 */
export function extensionFor(force, k, peakForce = 0) {
  if (k <= 0) return 0;
  if (force >= peakForce) return loadingExtension(force, k);
  return permanentSet(peakForce, k) + force / k;
}

/**
 * Gradient of the graph at this instant, N/m — the ΔF/Δx a student would
 * measure off the plot.
 *
 * It is k everywhere except on the plastic branch, and watching it collapse is
 * how the scene shows that the spring has stopped obeying Hooke's law without
 * having to assert it.
 */
export function tangentStiffness(force, k, peakForce = 0) {
  if (k <= 0) return 0;
  if (force >= peakForce && force > elasticLimitForce(k)) {
    // Straight coils take no more load at all: the graph has gone flat.
    return force >= failureForce(k) ? 0 : plasticStiffness(k);
  }
  return k;
}

/** Energy stored elastically, ½kx² — the syllabus formula. */
export const elasticEnergy = (k, extension) => 0.5 * k * extension * extension;

/**
 * The energy the spring would actually give back, joules.
 *
 * Identical to ½kx² while the spring is elastic. Once it has yielded they part
 * company: only the elastic part of the extension is recoverable, and the work
 * that went into the permanent set was spent deforming metal, not stored.
 */
export function recoverableEnergy(force, k) {
  if (k <= 0) return 0;
  return (force * force) / (2 * k);
}

/**
 * One solve for the whole apparatus.
 *
 * `peakForce` is the spring's memory and belongs to the scene, which is what
 * lets taking the masses back off reveal a set that was not there before.
 */
export function solveSpring({ massKg = 0.2, k = 40, peakForce = 0, g = G }) {
  const force = loadForce(massKg, g);
  const peak = Math.max(peakForce, force);
  const limitForce = elasticLimitForce(k);

  const extension = Math.min(extensionFor(force, k, peak), FAILURE_EXTENSION);
  const failed = peak >= failureForce(k) - 1e-9;
  const set = permanentSet(peak, k);

  return {
    force,
    peakForce: peak,
    limitForce,
    limitExtension: ELASTIC_LIMIT_EXTENSION,
    extension,
    /** Where the spring now sits with no load at all. */
    permanentSet: set,
    restLength: NATURAL_LENGTH + set,
    length: NATURAL_LENGTH + extension,
    naturalLength: NATURAL_LENGTH,
    /** Still on the straight part of its own graph? */
    elastic: force <= limitForce && set === 0,
    /** Has this spring ever been taken past its limit? */
    yielded: set > 1e-9,
    /** Being taken further past the limit right now. */
    yielding: force > limitForce && force >= peakForce - 1e-9,
    failed,
    stiffness: tangentStiffness(force, k, peak),
    nominalStiffness: k,
    plasticStiffness: plasticStiffness(k),
    failureForce: failureForce(k),
    /** The heaviest slotted mass this spring can carry and still spring back. */
    safeMassKg: elasticLimitForce(k) / g,
    elasticEnergy: elasticEnergy(k, extension),
    recoverableEnergy: recoverableEnergy(force, k),
    /** Fraction of the way to the elastic limit — drives the warning colour. */
    limitUsed: limitForce > 0 ? Math.min(force / limitForce, 1) : 0,
  };
}

/**
 * The force–extension curve to plot, as [extension, force] pairs.
 *
 * Three pieces, and a real experiment draws all three: the Hooke's law line,
 * the plastic branch it bends into, and — once the spring has been overloaded
 * — the unloading line running back to the permanent set rather than to zero.
 */
export function loadCurve(k, peakForce = 0) {
  const limitForce = elasticLimitForce(k);
  const peak = Math.min(Math.max(peakForce, 0), failureForce(k));

  const elastic = [
    [0, 0],
    [ELASTIC_LIMIT_EXTENSION, limitForce],
  ];

  const plastic =
    peak > limitForce
      ? [
          [ELASTIC_LIMIT_EXTENSION, limitForce],
          [Math.min(loadingExtension(peak, k), FAILURE_EXTENSION), peak],
        ]
      : [];

  const unload =
    peak > limitForce
      ? [
          [Math.min(loadingExtension(peak, k), FAILURE_EXTENSION), peak],
          [permanentSet(peak, k), 0],
        ]
      : [];

  return { elastic, plastic, unload, limitPoint: [ELASTIC_LIMIT_EXTENSION, limitForce] };
}
