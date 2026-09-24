// ─── Combustion and the fire triangle ───────────────────────────────
// A Bunsen burner on methane, with the one control that matters — the
// air collar — and the three ways of putting it out.
//
// Two ideas, and the scene is built so each one has a number on it:
//
//   completeness   the collar sets how much air is mixed with the gas
//                  BEFORE it burns. Closed, the gas meets oxygen only at
//                  the edge of the flame, burns slowly, cool and yellow
//                  (the yellow is soot glowing), and leaves carbon
//                  monoxide and carbon behind. Open, the pre-mixed flame
//                  burns fast, blue and hot with a sharp inner cone, and
//                  the carbon goes all the way to carbon dioxide. The
//                  flame temperature runs from 300 °C to 1 400 °C along
//                  that one slider, and the equation on screen switches
//                  from the incomplete form to the complete one.
//
//   the triangle   a flame needs fuel, oxygen and heat at once. Each
//                  interrupter removes exactly one — the gas tap, a bell
//                  jar the flame empties of oxygen, a water mist that
//                  takes the heat away — and the flame goes out for a
//                  different reason each time, which the readout names.
//
// The state is integrated, not closed-form, because the interrupters can
// arrive in any order at any time. `stepCombustion` is pure: it takes the
// state and the inputs for one time step and returns the next state, so
// the scene can drive it from the frame loop and a test can drive it from
// a for-loop and get the same answer.
// ─────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

export const AMBIENT_C = 20;

// ─── The collar ─────────────────────────────────────────────────────

export const COLLAR_MIN = 0;
export const COLLAR_MAX = 100;
/** Flame core temperature with the collar closed and fully open, °C. */
export const FLAME_MIN_C = 300;
export const FLAME_MAX_C = 1400;
/** Above this air fraction the equation on screen is the complete one. */
export const COMPLETE_ABOVE = 0.6;
/** The inner cone appears from here and is fully drawn a little later. */
export const INNER_CONE_FROM = 0.45;
export const INNER_CONE_FULL = 0.75;

/** The fraction of the air holes the collar exposes, 0..1. */
export const airFraction = (collar) => clamp((Number(collar) || 0) / COLLAR_MAX, 0, 1);

/** "closed", "quarter open", "half-open", "three-quarters open", "fully open". */
export function collarLabel(collar) {
  const a = airFraction(collar);
  if (a < 0.1) return "closed";
  if (a < 0.4) return "quarter open";
  if (a < 0.6) return "half-open";
  if (a < 0.9) return "three-quarters open";
  return "fully open";
}

export const flameTemperature = (collar) => lerp(FLAME_MIN_C, FLAME_MAX_C, airFraction(collar));

// Hex helpers — the scene and the HUD's colour key must agree on what a
// half-open flame looks like, so the ramp lives here.
const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgbToHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
export const mixHex = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
};

export const SOOTY_YELLOW = "#f5b731";
export const TRANSITION_ORANGE = "#f08a3c";
export const ROARING_BLUE = "#4f8ff7";
export const INNER_CONE_BLUE = "#7dd3fc";

/** Flame envelope colour along the collar. */
export function flameColour(collar) {
  const a = airFraction(collar);
  if (a < 0.35) return mixHex(SOOTY_YELLOW, TRANSITION_ORANGE, a / 0.35);
  if (a < 0.7) return mixHex(TRANSITION_ORANGE, ROARING_BLUE, (a - 0.35) / 0.35);
  return mixHex(ROARING_BLUE, "#3b6ff0", (a - 0.7) / 0.3);
}

export const EQUATIONS = {
  complete: {
    key: "complete",
    label: "Complete combustion",
    text: "CH₄ + 2O₂ → CO₂ + 2H₂O",
    products: "carbon dioxide + water",
    enthalpyKJPerMol: -890,
    note: "Enough oxygen mixed in for every carbon atom to reach CO₂ — the hottest, cleanest flame.",
  },
  incomplete: {
    key: "incomplete",
    label: "Incomplete combustion",
    text: "2CH₄ + 3O₂ → 2CO + 4H₂O",
    products: "carbon monoxide + water",
    enthalpyKJPerMol: -607,
    note: "Too little oxygen: carbon stops at CO — colourless, odourless, poisonous — and some never leaves the flame at all, glowing yellow as soot.",
  },
  soot: {
    key: "soot",
    label: "Soot-forming combustion",
    text: "CH₄ + O₂ → C + 2H₂O",
    products: "carbon (soot) + water",
    // Liquid water, like -890 (complete) and -607 (incomplete) beside it.
    // -409 was the gaseous-water figure, so the three could not be compared
    // with each other -- which is the only reason they are shown together.
    enthalpyKJPerMol: -497,
    note: "Starved of oxygen, some of the carbon is left as solid particles — the black deposit on a cold surface.",
  },
};

/**
 * Everything the collar position decides, in one object. `sootRate`,
 * `coFraction` and `innerCone` are 0..1; `luminous` is how much of the
 * flame's light is glowing soot rather than gas emission (what makes the
 * yellow flame bright and the blue one almost invisible in daylight).
 */
export function flameProfile(collar) {
  const a = airFraction(collar);
  const sootRate = Math.pow(1 - a, 2);
  const coFraction = Math.pow(1 - a, 1.5);
  const complete = a >= COMPLETE_ABOVE;
  return {
    collar: clamp(Number(collar) || 0, COLLAR_MIN, COLLAR_MAX),
    air: a,
    label: collarLabel(collar),
    temperatureC: flameTemperature(collar),
    colour: flameColour(collar),
    mode: complete ? "complete" : "incomplete",
    equation: complete ? EQUATIONS.complete : EQUATIONS.incomplete,
    sootRate,
    coFraction,
    coPpm: Math.round(1800 * coFraction),
    innerCone: clamp((a - INNER_CONE_FROM) / (INNER_CONE_FULL - INNER_CONE_FROM), 0, 1),
    luminous: Math.pow(1 - a, 1.2),
    // A lazy yellow flame stands taller than a stiff blue one at the same gas.
    height: lerp(1, 0.68, a),
    roar: a,
    completeness: a,
  };
}

// ─── The triangle ───────────────────────────────────────────────────

/**
 * Methane's autoignition temperature, °C. The flame's own core runs far
 * hotter than this, but the syllabus figure of 300 °C for a closed collar
 * describes the cool luminous tip, not the reaction zone — so the "heat"
 * side of the triangle is tracked as a reserve, 0..1, rather than by
 * comparing the displayed temperature with this number.
 */
export const IGNITION_C = 537;
/** The flame goes out when its heat reserve falls below this fraction. */
export const HEAT_EXTINCTION = 0.35;
/** How fast a lit flame re-heats its own zone, and how fast a dead one cools, seconds. */
export const HEAT_RECOVER_TAU_S = 0.9;
export const HEAT_DECAY_TAU_S = 2.0;
/** Oxygen in room air, and the fraction below which a methane flame goes out. */
export const O2_AIR = 0.209;
export const O2_EXTINCTION = 0.16;
/** How fast the flame uses up the oxygen in a 2 L bell jar, fraction per second. */
export const JAR_O2_BURN_PER_S = 0.011;
/** How fast fresh air gets back in once the jar lifts. */
export const JAR_REFILL_TAU_S = 0.8;
/** How long the jar takes to travel down (or up). */
export const JAR_TRAVEL_S = 1.2;
/** Fresh air only gets in once the jar has lifted this far. */
export const JAR_CLEAR_TRAVEL = 0.6;
/** A relight holds the striker at the barrel for this long, waiting for a mix that will catch. */
export const STRIKER_S = 6;
/** Water mist: the burst decays with this time constant… */
export const MIST_TAU_S = 1.6;
/** …and while it lasts it drains the heat reserve at this rate per second at full mist. */
export const MIST_COOLING_PER_S = 1.7;
/** How fast the flame's temperature follows the collar, seconds. */
export const FLAME_TAU_S = 0.45;
/** Seconds the gas takes to purge from the barrel after the tap closes. */
export const FUEL_PURGE_S = 0.35;
/** How long the cold basin is held in the flame, and how fast soot builds on it at full soot. */
export const BASIN_HOLD_S = 4;
export const BASIN_SOOT_PER_S = 0.42;

export function createCombustionState(collar = 15) {
  return {
    lit: true,
    fuelOpen: true,
    fuelPurge: 0,
    jarDown: false,
    /** 0 = raised, 1 = down over the burner. */
    jarTravel: 0,
    jarO2: O2_AIR,
    mist: 0,
    /** The heat side of the triangle: 1 with the flame zone fully hot, 0 stone cold. */
    heat: 1,
    tempC: flameTemperature(collar),
    /** Why the flame last went out: "fuel" | "oxygen" | "heat" | null. */
    extinguishedBy: null,
    /** Seconds of striker left after a relight — it catches the moment the triangle is whole. */
    striker: 0,
    basin: "rest",
    basinTimer: 0,
    sootOnBasin: 0,
    steam: 0,
    seconds: 0,
  };
}

/**
 * Advance the burner by `dt` seconds. `events` flags which buttons were
 * pressed since the last step; `collar` is the slider now.
 *
 * Each interrupter removes one side of the triangle, and the flame goes
 * out the moment any side is missing. `relight` restores all three — tap
 * on, jar up, mist gone — and holds a striker at the barrel, which catches
 * the moment gas and air are both there again (so a jar that is still
 * lifting delays the light by the time it takes to clear the burner).
 */
export function stepCombustion(state, { collar = 15, dt = 1 / 60, events = {} } = {}) {
  const s = { ...state };
  const step = clamp(Number(dt) || 0, 0, 0.1);
  const profile = flameProfile(collar);
  s.seconds += step;

  // ── Buttons ──
  if (events.relight) {
    s.fuelOpen = true;
    s.fuelPurge = 0;
    s.jarDown = false;
    s.mist = 0;
    s.extinguishedBy = null;
    s.basin = "rest";
    s.basinTimer = 0;
    s.sootOnBasin = 0;
    s.striker = STRIKER_S;
  }
  if (events.cutFuel) s.fuelOpen = false;
  if (events.bellJar) s.jarDown = true;
  if (events.waterMist) {
    s.mist = 1;
    s.steam = s.lit ? 1 : 0.2;
  }
  if (events.holdBasin && s.basin !== "held") {
    s.basin = "held";
    s.basinTimer = 0;
  }

  // ── The jar ──
  s.jarTravel = clamp(s.jarTravel + ((s.jarDown ? 1 : -1) * step) / JAR_TRAVEL_S, 0, 1);
  if (s.jarDown && s.jarTravel >= 1) {
    if (s.lit) s.jarO2 = Math.max(0, s.jarO2 - JAR_O2_BURN_PER_S * step);
  } else if (!s.jarDown && s.jarTravel <= JAR_CLEAR_TRAVEL) {
    s.jarO2 += (O2_AIR - s.jarO2) * (1 - Math.exp(-step / JAR_REFILL_TAU_S));
  }

  // ── Fuel ──
  if (!s.fuelOpen) s.fuelPurge += step;
  else s.fuelPurge = 0;

  // ── Heat ──
  // A lit flame keeps its own zone hot; the mist takes that heat away as
  // the water evaporates, faster than the flame can put it back.
  if (s.lit) s.heat += (1 - s.heat) * (1 - Math.exp(-step / HEAT_RECOVER_TAU_S));
  else s.heat *= Math.exp(-step / HEAT_DECAY_TAU_S);
  if (s.mist > 0) {
    s.heat = clamp(s.heat - MIST_COOLING_PER_S * s.mist * step, 0, 1);
    s.mist *= Math.exp(-step / MIST_TAU_S);
    if (s.mist < 0.01) s.mist = 0;
  }
  s.steam = s.steam > 0.01 ? s.steam * Math.exp(-step / 1.4) : 0;
  // The displayed core temperature follows the collar, sagging with the reserve.
  const target = s.lit ? AMBIENT_C + (profile.temperatureC - AMBIENT_C) * (0.25 + 0.75 * s.heat) : AMBIENT_C;
  s.tempC += (target - s.tempC) * (1 - Math.exp(-step / FLAME_TAU_S));

  // ── Does the flame survive this step? ──
  if (s.lit) {
    if (!s.fuelOpen && s.fuelPurge >= FUEL_PURGE_S) {
      s.lit = false;
      s.extinguishedBy = "fuel";
    } else if (s.jarO2 < O2_EXTINCTION) {
      s.lit = false;
      s.extinguishedBy = "oxygen";
    } else if (s.heat < HEAT_EXTINCTION) {
      s.lit = false;
      s.extinguishedBy = "heat";
    }
  } else if (s.striker > 0) {
    // The striker waits for the triangle: gas flowing and enough air.
    if (s.fuelOpen && s.jarO2 >= O2_EXTINCTION) {
      s.lit = true;
      s.heat = 1;
      s.striker = 0;
    } else {
      s.striker = Math.max(0, s.striker - step);
    }
  }
  if (s.lit) s.striker = 0;

  // ── The basin ──
  if (s.basin === "held") {
    s.basinTimer += step;
    if (s.lit) s.sootOnBasin = clamp(s.sootOnBasin + profile.sootRate * BASIN_SOOT_PER_S * step, 0, 1);
    if (s.basinTimer >= BASIN_HOLD_S) {
      s.basin = "showing";
      s.basinTimer = 0;
    }
  }

  return s;
}

/**
 * The three sides of the triangle right now, each true if present.
 *
 * Heat counts as present while the flame is lit, and stays "present" after
 * the tap is shut or the jar starves the flame — the barrel is hot and the
 * striker is to hand; only the mist takes the heat side away. That keeps
 * the lesson honest: each interrupter removes exactly one side. During a
 * relight the striker IS the heat, so heat stays present while it waits
 * for the jar to clear — it used to read the cooled reserve and flash
 * "heat ✗" at exactly the moment a flame was being struck.
 */
export function triangleStatus(state) {
  return {
    fuel: state.fuelOpen,
    oxygen: state.extinguishedBy === "oxygen" ? false : state.jarO2 >= O2_EXTINCTION,
    heat: state.lit || state.extinguishedBy !== "heat",
  };
}

/** What the readout says about why the flame is out — or that it is lit. */
export function describeFlame(state, collar) {
  const p = flameProfile(collar);
  if (state.lit) {
    return p.mode === "complete"
      ? `Lit — ${p.label} collar, a ${Math.round(p.temperatureC)} °C blue flame burning cleanly to carbon dioxide and water.`
      : `Lit — ${p.label} collar, a ${Math.round(p.temperatureC)} °C ${p.air < 0.35 ? "yellow, sooty" : "orange"} flame short of oxygen: carbon monoxide and soot in the exhaust.`;
  }
  switch (state.extinguishedBy) {
    case "fuel":
      return "Out — the tap is closed. No fuel, no flame: the oxygen and the heat are still there, but there is nothing for them to burn.";
    case "oxygen":
      return `Out — the bell jar starved it. The flame burnt the jar's oxygen down to ${(state.jarO2 * 100).toFixed(2)}%, below the ${(O2_EXTINCTION * 100).toFixed(0)}% a methane flame needs, with gas still flowing and everything still hot.`;
    case "heat":
      return `Out — the mist took the heat. Water evaporating at 2 260 kJ/kg dragged the flame zone below the ${IGNITION_C} °C the methane–air mix needs to keep igniting, with fuel and oxygen both still there.`;
    default:
      return "Out — strike the burner to light it.";
  }
}

/** Fraction of a full bell jar's oxygen still there, for gauges. */
export const jarOxygenPercent = (state) => Math.round(state.jarO2 * 1000) / 10;
