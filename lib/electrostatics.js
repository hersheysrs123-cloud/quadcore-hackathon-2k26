// ─── Static electricity · charge transfer and Coulomb forces ────────
// Rubbing a balloon on wool, and what the charge does afterwards.
//
// The modelling decision worth stating: charge is carried here as a count of
// DRAWN markers, not as a raw coulomb figure, and every force is computed
// from that count times a fixed quantum. A scene that shows twelve minus signs
// on the balloon and then quotes a force from some hidden continuous variable
// is asking to be disbelieved. Here the twelve signs on screen ARE the q in
// the formula, so a student can count them and check the arithmetic.
//
// The second decision is that a neutral wall attracts a charged balloon by
// induction, and that is modelled as an image charge rather than fudged with
// an "attraction factor". Induction is the part of electrostatics students
// actually find surprising, and it deserves its real equation.
// ─────────────────────────────────────────────────────────────────────

/** Coulomb's constant, N·m²·C⁻². */
export const COULOMB_K = 8.99e9;
/** Elementary charge, coulombs. */
export const ELEMENTARY_CHARGE = 1.602e-19;

/** Charge represented by one drawn + or − marker, coulombs. */
export const CHARGE_PER_MARKER = 20e-9;
/** Markers a balloon can hold once the surfaces reach equilibrium. */
export const MAX_MARKERS = 24;
/** Fraction of the remaining capacity one rub transfers. */
export const RUB_EFFICIENCY = 0.45;

/** Mass of a party balloon, kilograms. */
export const BALLOON_MASS_KG = 0.0022;
export const G = 9.81;

/** Relative permittivity of painted plasterboard. */
export const WALL_PERMITTIVITY = 3.5;
/** Rubber against a painted wall. */
export const WALL_FRICTION = 0.6;

/**
 * Radius of the Van de Graaff dome, metres.
 *
 * The scene draws its dome at exactly this size (0.155 m × 4 world units per
 * metre = 0.62), so the kilovolts in the readout are those of the dome on
 * screen. It was 0.09 m while the drawn dome was 0.155 m — the voltage was for
 * a smaller sphere than the one being shown.
 */
export const DOME_RADIUS = 0.155;
/** Markers the dome holds before it breaks down into the air around it. */
export const DOME_MAX_MARKERS = 60;
/** Mass of one aluminium pie pan, kilograms. */
export const PAN_MASS_KG = 0.0009;

/**
 * The triboelectric series, ordered from the most electron-losing to the most
 * electron-gaining. Rubbing any two together sends electrons DOWN this list.
 */
export const TRIBOELECTRIC = [
  { key: "skin", label: "skin", rank: 1, sign: +1 },
  { key: "wool", label: "wool sweater", rank: 2, sign: +1 },
  { key: "hair", label: "human hair", rank: 3, sign: +1 },
  { key: "latex", label: "latex balloon", rank: 8, sign: -1 },
  { key: "ptfe", label: "PTFE rod", rank: 10, sign: -1 },
];

/**
 * Charge leakage time constant, seconds.
 *
 * Humid air does not conduct meaningfully on its own; what happens is that a
 * molecular film of water condenses on both surfaces and gives the charge a
 * conducting path to creep away along. That is why the effect is dramatic and
 * strongly non-linear — hence the exponential interpolation rather than a
 * straight line between the two ends.
 */
export function leakTimeConstant(humidityPercent) {
  const h = Math.min(Math.max(humidityPercent, 10), 95);
  const DRY = 150; // seconds at 10% RH — a winter room, charge lingers
  const WET = 2.5; // seconds at 95% RH — a bathroom, it is gone at once
  const t = (h - 10) / 85;
  return DRY * Math.pow(WET / DRY, t);
}

/** Markers remaining after `dt` seconds of leaking into the air. */
export function leak(markers, dt, humidityPercent) {
  if (markers <= 0) return 0;
  const tau = leakTimeConstant(humidityPercent);
  return markers * Math.exp(-dt / tau);
}

/**
 * One rub, as an asymptotic approach to saturation.
 *
 * Rubbing harder and longer does not keep piling charge on indefinitely: the
 * surfaces reach an equilibrium where as much charge leaks back across the
 * contact as is being transferred. Each rub therefore closes a fixed fraction
 * of the gap to that ceiling rather than adding a fixed amount.
 */
export function rub(markers, ceiling = MAX_MARKERS) {
  return markers + (ceiling - markers) * RUB_EFFICIENCY;
}

/** Marker count as a real charge in coulombs. */
export const chargeOf = (markers) => markers * CHARGE_PER_MARKER;

/** How many electrons that actually is. */
export const electronCount = (markers) => chargeOf(markers) / ELEMENTARY_CHARGE;

/**
 * Newtons, in whichever unit keeps the number readable.
 *
 * A charged balloon on a wall pulls with tens of micronewtons, so a plain
 * `.toFixed(2)} N` prints every interesting force in this scene as "0.00 N".
 * The scene label and the HUD row each had their own copy of this.
 */
export function formatForce(newtons = 0) {
  const n = Number.isFinite(newtons) ? Math.abs(newtons) : 0;
  if (n >= 1) return `${n.toFixed(2)} N`;
  if (n >= 1e-3) return `${(n * 1e3).toFixed(1)} mN`;
  return `${(n * 1e6).toFixed(0)} µN`;
}

/** F = k·|q₁q₂|/r². Positive is a magnitude; direction is the caller's job. */
export function coulombForce(q1, q2, metres) {
  const r = Math.max(metres, 0.005);
  return (COULOMB_K * Math.abs(q1 * q2)) / (r * r);
}

/**
 * Attraction between a charge and a neutral dielectric wall.
 *
 * The wall polarises: its molecules stretch so their positive ends face the
 * balloon, which is the same field as a mirrored charge of opposite sign at
 * the same depth behind the surface. Separation is therefore 2d, and β scales
 * the mirrored charge down because plasterboard is a dielectric rather than a
 * perfect conductor.
 *
 * The sign never comes out repulsive, which is the point — an induced charge
 * is always arranged to attract, so a charged object attracts EVERYTHING
 * neutral, whichever way round its own charge is.
 */
export function inductionForce(markers, metres, permittivity = WALL_PERMITTIVITY) {
  const q = chargeOf(markers);
  const beta = (permittivity - 1) / (permittivity + 1);
  const d = Math.max(metres, 0.003);
  return (COULOMB_K * beta * q * q) / (4 * d * d);
}

/** Magnitude of the induced surface charge, in markers, for drawing. */
export function inducedMarkers(markers, metres, permittivity = WALL_PERMITTIVITY) {
  const beta = (permittivity - 1) / (permittivity + 1);
  // Falls off with distance: a distant balloon barely polarises the surface.
  const reach = 1 / (1 + Math.pow(Math.max(metres, 0.005) / 0.08, 2));
  return markers * beta * reach;
}

/**
 * Does the balloon stay stuck to the wall?
 *
 * Electrostatic attraction presses it against the surface but acts horizontally
 * — it is friction against that normal force that has to hold the weight up.
 * This is the step most explanations skip, and it is why a weakly charged
 * balloon slides slowly down instead of simply falling off.
 */
export function sticksToWall(markers, metres, { mass = BALLOON_MASS_KG, mu = WALL_FRICTION } = {}) {
  const normal = inductionForce(markers, metres);
  const weight = mass * G;
  return { normal, weight, grip: mu * normal, sticks: mu * normal >= weight };
}

/** Potential at the surface of an isolated charged sphere, volts. */
export function domeVoltage(markers, radius = DOME_RADIUS) {
  return (COULOMB_K * chargeOf(markers)) / Math.max(radius, 1e-3);
}

/**
 * How many pie pans have flown off the dome.
 *
 * Each pan sits on the dome, takes its share of the charge, and is repelled by
 * everything below it. This counts how many pans the dome can push off at all,
 * by asking the question of each height in the stack; the scene then launches
 * that many, and they leave from the top because those are the ones with no
 * weight resting on them. It is a count, not an ordering.
 */
export function pansLaunched(markers, pans = 4) {
  const q = chargeOf(markers);
  const weight = PAN_MASS_KG * G;
  let launched = 0;
  for (let i = 0; i < pans; i += 1) {
    // Each pan carries roughly a pan's-worth of the dome's surface charge.
    const share = q / (pans + 2);
    const gap = DOME_RADIUS + 0.012 * (i + 1);
    const push = (COULOMB_K * share * q) / (gap * gap);
    if (push > weight) launched += 1;
  }
  return Math.min(launched, pans);
}

/** What the balloon is being held near. */
export const TARGETS = {
  wall: {
    label: "Neutral wall",
    title: "Induction — the wall polarises and always attracts",
    kind: "induction",
    attracts: true,
  },
  balloon: {
    label: "2nd balloon",
    title: "Two like charges — repulsion",
    kind: "coulomb",
    attracts: false,
  },
  dome: {
    label: "Van de Graaff",
    title: "A charged dome — repels a like-charged balloon hard",
    kind: "coulomb",
    attracts: false,
  },
};

/**
 * Everything the scene and the readout need, from the live marker counts.
 *
 * `separation` is in metres, measured surface to surface — the number the
 * inverse square law actually wants, not centre to centre, because a student
 * dragging the balloon is watching the gap.
 */
export function solveStatic({
  markers = 0,
  domeMarkers = 0,
  separation = 0.12,
  target = "wall",
  humidity = 40,
} = {}) {
  const spec = TARGETS[target] ?? TARGETS.wall;
  const balloonMarkers = Math.max(markers, 0);
  const q1 = chargeOf(balloonMarkers);
  const r = Math.max(separation, 0.005);

  let force = 0;
  let otherMarkers = 0;
  let attracts = spec.attracts;

  if (spec.kind === "induction") {
    otherMarkers = inducedMarkers(balloonMarkers, r);
    force = inductionForce(balloonMarkers, r);
    attracts = true;
  } else if (target === "dome") {
    otherMarkers = domeMarkers;
    force = coulombForce(q1, chargeOf(domeMarkers), r);
    attracts = false;
  } else {
    // A second balloon rubbed on the same sweater carries the same charge.
    otherMarkers = balloonMarkers;
    force = coulombForce(q1, q1, r);
    attracts = false;
  }

  const weight = BALLOON_MASS_KG * G;
  const wall = sticksToWall(balloonMarkers, r);

  return {
    target,
    spec,
    humidity,
    tau: leakTimeConstant(humidity),
    /** Unpaired negatives sitting on the latex. */
    balloonMarkers,
    /** Unpaired positives left behind on the wool — always the same number. */
    sweaterMarkers: balloonMarkers,
    /** Induced on the wall, or carried by the other object. */
    otherMarkers,
    domeMarkers,
    balloonCharge: q1,
    otherCharge: chargeOf(otherMarkers),
    electrons: electronCount(balloonMarkers),
    separation: r,
    force,
    attracts,
    weight,
    /** Force as a multiple of the balloon's own weight — the honest scale. */
    forceInWeights: weight > 0 ? force / weight : 0,
    sticks: target === "wall" && wall.sticks && balloonMarkers > 0.5,
    grip: wall.grip,
    domeVolts: domeVoltage(domeMarkers),
    pans: pansLaunched(domeMarkers),
    saturation: balloonMarkers / MAX_MARKERS,
  };
}
