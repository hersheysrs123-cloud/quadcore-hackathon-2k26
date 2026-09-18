// ─── Conduction, convection and radiation, side by side ─────────────
// A Bunsen under a beaker of water, four rods dipping into it, and a blackened
// plate standing off to one side touching nothing.
//
// The topic is usually taught as three definitions to memorise, and the reason
// it does not stick is that a definition cannot be compared with anything. So
// every one of the three has a real equation here and a number on screen that
// moves when you change the flame:
//
//   conduction — the fin equation, T(x) = T∞ + ΔT·cosh(m(L−x))/cosh(mL), which
//     is why a copper tip reaches 77 °C and a wooden one never leaves the room
//     temperature it started at;
//   convection — Q = ṁcΔT closed against the buoyancy-driven flow speed
//     v ∝ √(gβΔT H), which gives ΔT ∝ Q^⅔ and a circulation the dye can trace;
//   radiation — Stefan–Boltzmann with an inverse-square spread, which puts a
//     measurable temperature on a plate that nothing is touching.
//
// The second decision worth stating is the time base. Real conduction along a
// 20 cm iron rod takes the better part of ten minutes, and a scene nobody
// waits for teaches nothing. Everything here is therefore scaled by ONE
// factor, `TIME_LAPSE` — the water heats, the rods warm, the plate warms and
// the dye circulates all at 8× — so every ratio a student compares is the real
// ratio even though no single duration is.
// ─────────────────────────────────────────────────────────────────────

/** Stefan–Boltzmann constant, W·m⁻²·K⁻⁴. */
export const STEFAN_BOLTZMANN = 5.67e-8;
/** Room temperature, °C. Everything cold on screen is at this. */
export const AMBIENT_C = 20;
export const BOILING_C = 100;
export const KELVIN = 273.15;

/** How much faster than reality the scene runs. Applied to every rate. */
export const TIME_LAPSE = 8;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const kelvin = (c) => c + KELVIN;

// ─── Materials ──────────────────────────────────────────────────────

/**
 * The four rods, with the thermal conductivities the syllabus quotes.
 *
 * `density` and `specificHeat` are not decoration: together with k they fix
 * the thermal diffusivity α = k/ρc, and α — not k — is what decides how fast
 * the warm front travels. Copper and iron differ by 4.8× in conductivity but
 * by 4.9× in diffusivity, so the front really does race up one and crawl up
 * the other, and the scene gets that from the material table rather than from
 * an animation speed someone chose.
 */
export const ROD_MATERIALS = {
  copper: {
    label: "Copper",
    k: 385,
    density: 8960,
    specificHeat: 385,
    colour: "#c2703b",
    title: "k = 385 W/m·K — a metal, so its free electrons carry heat too",
  },
  iron: {
    label: "Iron",
    k: 80,
    density: 7870,
    specificHeat: 450,
    colour: "#8996a8",
    title: "k = 80 W/m·K — still a metal, but nearly five times worse",
  },
  glass: {
    label: "Glass",
    k: 0.8,
    density: 2500,
    specificHeat: 840,
    colour: "#9fd6e8",
    title: "k = 0.8 W/m·K — no free electrons, so only lattice vibrations",
  },
  wood: {
    label: "Wood",
    k: 0.15,
    density: 700,
    specificHeat: 1700,
    colour: "#a9784a",
    title: "k = 0.15 W/m·K — an insulator, and mostly trapped air at that",
  },
};

export const rodMaterialFor = (key) => ROD_MATERIALS[key] ?? ROD_MATERIALS.copper;

/** Rod geometry, metres — a standard 20 cm × 10 mm lab rod. */
export const ROD_LENGTH = 0.2;
export const ROD_RADIUS = 0.005;
/** Natural-convection film coefficient for a rod losing heat to still air. */
export const AIR_FILM_H = 12;

/** Melting point of the paraffin wax the marker beads are stuck on with. */
export const WAX_MELTING_C = 58;

/** Thermal diffusivity α = k/ρc, m²/s. */
export const diffusivity = (material) => {
  const m = rodMaterialFor(material);
  return m.k / (m.density * m.specificHeat);
};

// ─── Conduction ─────────────────────────────────────────────────────

/**
 * The fin parameter m = √(hP/kA), which for a circular rod is √(2h/kr).
 *
 * Its reciprocal is the distance over which the excess temperature decays, so
 * 1/m is the honest answer to "how far along does the heat get": 28 cm for
 * copper, 13 cm for iron, 1.3 cm for glass, 5.6 mm for wood. The rod is 20 cm
 * long, which is why two of them deliver heat to the far end and two do not.
 */
export const finParameter = (material, radius = ROD_RADIUS, h = AIR_FILM_H) =>
  Math.sqrt((2 * h) / (rodMaterialFor(material).k * radius));

/**
 * Steady-state excess temperature at `x` metres from the hot end, as a
 * fraction of the excess at the hot end.
 *
 * Algebraically cosh(m(L−x))/cosh(mL), but written in the exponential form
 * because wood's mL is 36 and cosh(36) is 1.7 × 10¹⁵ — a ratio of two enormous
 * numbers that loses most of its precision, and would overflow outright for a
 * material any worse. The form below has no large intermediate at all.
 */
export function steadyExcessFraction(material, x, length = ROD_LENGTH) {
  const m = finParameter(material);
  const pos = clamp(x, 0, length);
  const numerator = Math.exp(-m * pos) + Math.exp(-m * (2 * length - pos));
  const denominator = 1 + Math.exp(-2 * m * length);
  return numerator / denominator;
}

/**
 * How far along the transient has got at `x` after `seconds` of scene time.
 *
 * The diffusion time to a depth x is x²/4α — the standard result from the
 * error-function solution for a semi-infinite solid — and a first-order
 * approach to the steady profile with that time constant reproduces what a lab
 * demonstration looks like: a warm front visibly running up the copper while
 * the iron beside it is still cold beyond the first few centimetres.
 */
export function warmupFraction(material, x, seconds) {
  const alpha = diffusivity(material);
  const tau = (x * x) / (4 * alpha);
  if (!(tau > 1e-9)) return 1;
  const elapsed = Math.max(seconds, 0) * TIME_LAPSE;
  if (!Number.isFinite(elapsed)) return 1;
  return 1 - Math.exp(-elapsed / tau);
}

/**
 * Time constant for the warm front to reach `x`, seconds of REAL time.
 *
 * Exposed because the canvas integrates rather than evaluating the closed form:
 * a student who nudges the gas tap halfway through should see the rod respond
 * from where it currently is, not jump to wherever the closed-form curve for
 * the new flame happens to be at that moment.
 */
export const nodeTimeConstant = (material, x) => (x * x) / (4 * diffusivity(material));

/**
 * One first-order step of `current` toward `target`.
 *
 * Exact rather than an Euler approximation — the analytic solution of
 * dT/dt = (target − T)/τ over a step — so a slow frame cannot overshoot and
 * the result does not depend on the frame rate. With a constant target it
 * reproduces the closed forms above exactly, which is what makes it safe to
 * have both in the same codebase.
 */
export function relax(current, target, tau, dtSeconds) {
  if (!(tau > 1e-9)) return target;
  const f = 1 - Math.exp(-(Math.max(dtSeconds, 0) * TIME_LAPSE) / tau);
  return current + (target - current) * f;
}

/** Temperature at `x` metres along a rod whose hot end is held at `hotC`. */
export function rodTemperature({ material, x, hotC, ambientC = AMBIENT_C, seconds = Infinity }) {
  const excess = (hotC - ambientC) * steadyExcessFraction(material, x);
  return ambientC + excess * warmupFraction(material, x, seconds);
}

/** `count` evenly spaced samples along the rod, for colouring and for the wax. */
export function rodProfile({ material, hotC, ambientC = AMBIENT_C, seconds = Infinity, count = 24 }) {
  const nodes = [];
  for (let i = 0; i < count; i += 1) {
    const fraction = count > 1 ? i / (count - 1) : 0;
    const x = fraction * ROD_LENGTH;
    nodes.push({
      x,
      fraction,
      temperature: rodTemperature({ material, x, hotC, ambientC, seconds }),
    });
  }
  return nodes;
}

/**
 * Heat flowing into the cold end of the rod, watts — Fourier's law at x = 0.
 *
 * For a fin this is √(hPkA)·ΔT, and it is the number that says copper is not
 * merely faster but is moving twenty-two times as much energy per second as
 * the glass rod beside it at the same temperature difference — the rate goes
 * as √k, so a 480× spread in conductivity is a 22× spread in watts.
 */
export function conductionRate({ material, hotC, ambientC = AMBIENT_C }) {
  const spec = rodMaterialFor(material);
  const area = Math.PI * ROD_RADIUS * ROD_RADIUS;
  const perimeter = 2 * Math.PI * ROD_RADIUS;
  return Math.sqrt(AIR_FILM_H * perimeter * spec.k * area) * Math.max(hotC - ambientC, 0);
}

// ─── The burner ─────────────────────────────────────────────────────

/** Below this the gas tap is effectively shut and the flame is out. */
export const FLAME_OUT_BELOW = 2;
/** A luminous yellow safety flame, °C. */
export const FLAME_MIN_C = 300;
/** A roaring blue flame with the air hole fully open, °C. */
export const FLAME_MAX_C = 1500;
/** Thermal output of a laboratory Bunsen at full gas, watts. */
export const FLAME_MAX_POWER = 1400;

export const flameIsLit = (intensity) => Number(intensity) >= FLAME_OUT_BELOW;

export function flameTemperature(intensity) {
  if (!flameIsLit(intensity)) return AMBIENT_C;
  return FLAME_MIN_C + (FLAME_MAX_C - FLAME_MIN_C) * clamp(intensity / 100, 0, 1);
}

export const flamePower = (intensity) =>
  flameIsLit(intensity) ? FLAME_MAX_POWER * clamp(intensity / 100, 0, 1) : 0;

// ─── Colour ramps ───────────────────────────────────────────────────
//
// These live here rather than in the canvas because the HUD's colour key and
// the scene have to agree on what a given temperature looks like, and because
// a ramp is pure arithmetic that is worth a test.

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const rgbToHex = (rgb) =>
  `#${rgb.map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0")).join("")}`;

/** Straight linear blend between two hex colours. */
export function mixHex(a, b, t) {
  const f = clamp(t, 0, 1);
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  return rgbToHex(from.map((c, i) => c + (to[i] - c) * f));
}

/**
 * The ironbow ramp a thermal imager uses: cold is black, then violet, red,
 * orange, and finally white-hot.
 *
 * Not the rainbow ramp. A rainbow has no perceptual ordering — nobody can say
 * whether green is hotter than yellow without consulting the key — whereas
 * ironbow is monotonic in brightness, so a FLIR image reads correctly even to
 * someone who never looks at the scale.
 */
const IRONBOW = ["#05061a", "#2c1a6b", "#7c1d6f", "#c2354b", "#ee6c1c", "#f9b117", "#fff6d4"];

export function flirColour(temperatureC, minC = AMBIENT_C, maxC = 120) {
  const span = Math.max(maxC - minC, 1e-6);
  const t = clamp((temperatureC - minC) / span, 0, 1);
  const scaled = t * (IRONBOW.length - 1);
  const i = Math.min(Math.floor(scaled), IRONBOW.length - 2);
  return mixHex(IRONBOW[i], IRONBOW[i + 1], scaled - i);
}

export const FLIR_STOPS = IRONBOW;

/** Luminous yellow at a whisper of gas, roaring blue wide open. */
export function flameColour(intensity) {
  if (!flameIsLit(intensity)) return "#334155";
  const t = clamp(intensity / 100, 0, 1);
  return t < 0.5 ? mixHex("#f97316", "#fbbf24", t * 2) : mixHex("#fbbf24", "#60a5fa", (t - 0.5) * 2);
}

// ─── Convection ─────────────────────────────────────────────────────

/** Water in the beaker — a 250 mL pour, which is what a 400 mL beaker gets. */
export const WATER_MASS_KG = 0.25;
export const WATER_SPECIFIC_HEAT = 4186;
export const WATER_DENSITY = 1000;
/** Volumetric expansion coefficient of water around 40 °C, per kelvin. */
export const THERMAL_EXPANSION = 3.0e-4;
/** Depth of the water column, metres — the height the buoyant plume rises. */
export const WATER_DEPTH = 0.09;
/** Cross-section of the rising plume, m² — a 3 cm core in a 6 cm beaker. */
export const PLUME_AREA = 7.0e-4;
/**
 * Fraction of the flame's output that actually reaches the water.
 *
 * Most of a Bunsen's heat goes straight past the beaker as hot exhaust, which
 * is why a tripod-and-gauze setup is so much slower than an electric hotplate
 * of the same rating.
 */
export const BEAKER_ABSORPTION = 0.3;
/** How fast the beaker loses heat to the room, W/K. */
export const BEAKER_LOSS = 3.6;
/** Discharge coefficient of the convection loop — it is not a frictionless pipe. */
export const LOOP_EFFICIENCY = 0.25;
/** Path length of one complete circulation, metres. */
export const LOOP_LENGTH = 0.26;

export const beakerPower = (intensity) => flamePower(intensity) * BEAKER_ABSORPTION;

/**
 * Temperature difference between the bottom of the beaker and the top, K.
 *
 * Closed from two statements that are each independently true and are usually
 * taught separately: the loop carries the heat, Q = ṁcΔT; and the loop is
 * driven by its own density difference, v = C√(gβΔT·H). Eliminating v gives
 * ΔT ∝ Q^⅔, so doubling the flame does NOT double the gradient — the current
 * speeds up instead and carries the extra heat away. That is the part of
 * convection worth showing, and it falls straight out of the algebra.
 */
export function convectionDeltaT(powerW) {
  if (!(powerW > 0)) return 0;
  const denominator =
    WATER_DENSITY *
    PLUME_AREA *
    WATER_SPECIFIC_HEAT *
    LOOP_EFFICIENCY *
    Math.sqrt(9.81 * THERMAL_EXPANSION * WATER_DEPTH);
  return Math.pow(powerW / denominator, 2 / 3);
}

/** Speed of the circulating water, m/s — what the dye tracers actually move at. */
export function convectionSpeed(deltaT) {
  if (!(deltaT > 0)) return 0;
  return LOOP_EFFICIENCY * Math.sqrt(9.81 * THERMAL_EXPANSION * deltaT * WATER_DEPTH);
}

/** Density of water at `temperatureC`, kg/m³ — the reason any of this moves. */
export const waterDensity = (temperatureC) =>
  WATER_DENSITY * (1 - THERMAL_EXPANSION * (temperatureC - AMBIENT_C));

/** Where the water would settle at this flame, ignoring the boil. */
export const waterAsymptote = (intensity, ambientC = AMBIENT_C) =>
  ambientC + beakerPower(intensity) / BEAKER_LOSS;

/** How long the beaker takes to respond, seconds of real time. */
export const WATER_TIME_CONSTANT = (WATER_MASS_KG * WATER_SPECIFIC_HEAT) / BEAKER_LOSS;

/**
 * Everything about the convecting water, given the bulk temperature it has
 * actually reached.
 *
 * Two details matter. The beaker is capped at boiling, because past that the
 * energy goes into latent heat and the thermometer stops rising — the one
 * moment in the whole scene where pouring in more heat changes no temperature
 * at all. And the top-to-bottom gradient collapses as it approaches the boil,
 * because a rolling boil stirs the beaker far harder than gentle convection
 * ever did.
 */
export function waterFrom(meanC, intensity = 0, ambientC = AMBIENT_C) {
  const power = beakerPower(intensity);
  const mean = Math.min(meanC, BOILING_C);
  const rawDelta = convectionDeltaT(power);
  const boilFraction = clamp((mean - 95) / 5, 0, 1);
  // Violent mixing at the boil wipes out the gradient it took to get there.
  const delta = rawDelta * (1 - boilFraction);

  const bottom = Math.min(mean + delta / 2, BOILING_C + 2);
  const top = Math.max(mean - delta / 2, ambientC);

  // The FLOW is driven by the buoyancy the heat input generates, so it is
  // computed from the natural gradient and not from the flattened one the
  // thermometers read. Getting this the wrong way round would have the
  // circulation grind to a halt at a rolling boil — the one moment a beaker is
  // most obviously churning — because the measured top-to-bottom difference
  // has gone to zero. Bubbles then stir it harder still, hence the boost.
  const speed = convectionSpeed(rawDelta) * (1 + 0.8 * boilFraction);

  return {
    power,
    mean,
    bottom,
    top,
    delta,
    /** What the gradient would be if the boil were not stirring it flat. */
    naturalDelta: rawDelta,
    boiling: boilFraction >= 1,
    boilFraction,
    speed,
    /** Seconds for one complete circuit of the convection loop, at 1× time. */
    loopSeconds: speed > 1e-9 ? LOOP_LENGTH / speed : Infinity,
    densityBottom: waterDensity(bottom),
    densityTop: waterDensity(top),
    densityDifference: waterDensity(top) - waterDensity(bottom),
    asymptote: waterAsymptote(intensity, ambientC),
  };
}

/** The same, reached by letting the burner run for `seconds` from cold. */
export function waterState({ intensity = 0, seconds = Infinity, ambientC = AMBIENT_C } = {}) {
  const asymptote = waterAsymptote(intensity, ambientC);
  const elapsed = Math.max(seconds, 0) * TIME_LAPSE;
  const approach = Number.isFinite(elapsed) ? 1 - Math.exp(-elapsed / WATER_TIME_CONSTANT) : 1;
  return waterFrom(ambientC + (asymptote - ambientC) * approach, intensity, ambientC);
}

// ─── Radiation ──────────────────────────────────────────────────────

/** Radiating surface of the flame at full gas, m². */
export const FLAME_AREA = 0.0022;
/** A flame is a poor emitter — mostly transparent gas, not a hot solid. */
export const FLAME_EMISSIVITY = 0.3;
/** Where the blackened plate stands, metres from the flame. */
export const PLATE_DISTANCE = 0.15;
/** One face of the plate, m². */
export const PLATE_AREA = 0.0025;
export const PLATE_EMISSIVITY = 0.95;
/** Heat capacity of the plate, J/K — 5 cm × 5 cm × 1.5 mm of aluminium. */
export const PLATE_HEAT_CAPACITY = 9.1;
/** Convective loss from the plate to the room, W/m²K. */
export const PLATE_FILM_H = 10;

/**
 * Power the flame radiates away, watts — Stefan–Boltzmann.
 *
 * The fourth power is the point. Going from a 300 °C safety flame to a 1500 °C
 * roaring one is a factor of 3.1 in absolute temperature and very nearly a
 * factor of 90 in radiated power, which is why the plate barely notices a
 * small flame and warms sharply under a big one.
 */
export function radiatedPower(intensity) {
  if (!flameIsLit(intensity)) return 0;
  const area = FLAME_AREA * clamp(intensity / 100, 0, 1);
  const hot = Math.pow(kelvin(flameTemperature(intensity)), 4);
  const cold = Math.pow(kelvin(AMBIENT_C), 4);
  return FLAME_EMISSIVITY * STEFAN_BOLTZMANN * area * (hot - cold);
}

/**
 * Irradiance at `distance`, W/m².
 *
 * The flame throws its energy over a sphere, so what arrives falls as 1/r² —
 * the same inverse square as gravity, light and Coulomb's law, and for the
 * same purely geometric reason.
 */
export function irradianceAt(intensity, distance = PLATE_DISTANCE) {
  const r = Math.max(distance, 0.01);
  return radiatedPower(intensity) / (4 * Math.PI * r * r);
}

/** Net power the plate is absorbing on its facing side, watts. */
export const absorbedPower = (intensity, distance = PLATE_DISTANCE) =>
  PLATE_EMISSIVITY * irradianceAt(intensity, distance) * PLATE_AREA;

/**
 * The temperature the plate settles at, °C.
 *
 * Absorbed radiation in, re-radiation plus convection out from both faces. The
 * balance is a quartic, so it is bisected rather than solved — forty halvings
 * is exact to well under a millikelvin and cannot be tripped up by the way the
 * quartic's other roots behave.
 */
export function plateEquilibrium(intensity, distance = PLATE_DISTANCE, ambientC = AMBIENT_C) {
  const gain = absorbedPower(intensity, distance);
  if (!(gain > 0)) return ambientC;

  const bothFaces = 2 * PLATE_AREA;
  const ambientK = kelvin(ambientC);
  const loss = (tC) => {
    const tK = kelvin(tC);
    return (
      PLATE_EMISSIVITY * STEFAN_BOLTZMANN * bothFaces * (Math.pow(tK, 4) - Math.pow(ambientK, 4)) +
      PLATE_FILM_H * bothFaces * (tC - ambientC)
    );
  };

  let lo = ambientC;
  let hi = ambientC + 1200;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (loss(mid) < gain) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * How long the plate takes to respond, seconds of real time.
 *
 * From the linearised loss slope at the working point: a hotter plate sheds
 * heat faster, so it also settles faster.
 */
export function plateTimeConstant(workingC = AMBIENT_C) {
  const tK = kelvin(workingC);
  const slope =
    4 * PLATE_EMISSIVITY * STEFAN_BOLTZMANN * 2 * PLATE_AREA * Math.pow(tK, 3) +
    PLATE_FILM_H * 2 * PLATE_AREA;
  return PLATE_HEAT_CAPACITY / Math.max(slope, 1e-9);
}

/** Plate temperature after `seconds`, warming toward equilibrium. */
export function plateTemperature({
  intensity = 0,
  distance = PLATE_DISTANCE,
  seconds = Infinity,
  ambientC = AMBIENT_C,
} = {}) {
  const target = plateEquilibrium(intensity, distance, ambientC);
  if (target <= ambientC + 1e-9) return ambientC;
  const elapsed = Math.max(seconds, 0) * TIME_LAPSE;
  const approach = Number.isFinite(elapsed)
    ? 1 - Math.exp(-elapsed / plateTimeConstant(target))
    : 1;
  return ambientC + (target - ambientC) * approach;
}

// ─── The whole bench, solved once ───────────────────────────────────

/**
 * Everything the scene and the HUD both need, from one call.
 *
 * `seconds` defaults to Infinity so the Details panel — which has no clock of
 * its own — reports where the apparatus SETTLES, while the canvas passes its
 * own elapsed time and watches it get there.
 */
export function solveHeatTransfer({
  intensity = 55,
  material = "copper",
  seconds = Infinity,
  ambientC = AMBIENT_C,
} = {}) {
  const water = waterState({ intensity, seconds, ambientC });
  /** The rods dip into the water, so the hot end sits at the water's bottom. */
  const hotC = water.bottom;

  const rods = Object.keys(ROD_MATERIALS).map((key) => {
    const spec = ROD_MATERIALS[key];
    const nodes = rodProfile({ material: key, hotC, ambientC, seconds });
    const tip = nodes[nodes.length - 1].temperature;
    const melted = nodes.filter((n) => n.temperature >= WAX_MELTING_C).length;
    return {
      key,
      spec,
      nodes,
      tipC: tip,
      hotC,
      /** How far along the wax has let go, 0–1 — the visible race. */
      waxFront: nodes.length > 1 ? melted / nodes.length : 0,
      decayLength: 1 / finParameter(key),
      rate: conductionRate({ material: key, hotC, ambientC }),
      selected: key === material,
    };
  });

  const selected = rods.find((r) => r.selected) ?? rods[0];
  const plateC = plateTemperature({ intensity, seconds, ambientC });

  return {
    intensity,
    lit: flameIsLit(intensity),
    flameC: flameTemperature(intensity),
    flamePower: flamePower(intensity),
    flameColour: flameColour(intensity),
    ambientC,

    water,
    rods,
    selected,

    radiatedPower: radiatedPower(intensity),
    irradiance: irradianceAt(intensity),
    absorbedPower: absorbedPower(intensity),
    plateC,
    plateEquilibriumC: plateEquilibrium(intensity),

    /** Ceiling for the FLIR ramp, so the false colour spans what is on screen. */
    hottestC: Math.max(water.bottom, selected.tipC, plateC, ambientC + 1),
  };
}
