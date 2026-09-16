// ─── Separation techniques ──────────────────────────────────────────
// The chemistry behind the three-station bench: gravity filtration,
// evaporating crystallisation and paper chromatography, each run on the
// same three samples with the same two solvents.
//
// The point of putting three techniques on one bench is that the SAME
// sample gives a different answer at each station, and the reason is
// always a physical property:
//
//   filtration      particle size against the paper's pores — but only a
//                   solid that has NOT dissolved has a particle size worth
//                   talking about, so solubility in this solvent decides
//                   what is a "particle" at all;
//   crystallisation solubility against concentration — the solvent boils
//                   away, the solution passes saturation, and whatever the
//                   solvent can no longer hold comes out as crystals;
//   chromatography  affinity for the moving solvent against affinity for
//                   the paper — each pigment settles at its own Rf, the
//                   fraction of the solvent's journey it is carried along.
//
// Everything is closed-form in model time. The scene and the HUD both ask
// "what does station S look like after t seconds" and get the same answer,
// which is what makes the drawing testable and the readout trustworthy.
// Each station runs at its own time-lapse so that a run takes twenty to
// forty real seconds; every ratio inside a station is the real ratio.
// ─────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
/** "Copper(II) sulfate" → "copper(II) sulfate": mid-sentence, without wrecking the (II). */
const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);

export const AMBIENT_C = 20;

// ─── Solvents ───────────────────────────────────────────────────────

/**
 * The two mobile phases. `latentKJPerKg` and `specificHeat` are what fix
 * how fast the basin boils dry; `polarity` is the word the chromatography
 * verdict reaches for when a pigment that flew in water crawls in ethanol.
 */
export const SOLVENTS = {
  water: {
    label: "Water",
    formula: "H₂O",
    boilingC: 100,
    latentKJPerKg: 2260,
    specificHeat: 4.18,
    density: 1.0,
    polarity: "polar",
    colour: "#c9e3ec",
    flammable: false,
    title: "H₂O — boils at 100 °C, very polar, dissolves salts and most food dyes",
  },
  ethanol: {
    label: "Ethanol",
    formula: "C₂H₅OH",
    boilingC: 78,
    latentKJPerKg: 841,
    specificHeat: 2.44,
    density: 0.789,
    polarity: "less polar",
    colour: "#dcecee",
    flammable: true,
    title: "C₂H₅OH — boils at 78 °C, less polar, will not dissolve ionic salts",
  },
};
export const SOLVENT_ORDER = ["water", "ethanol"];

// ─── What the samples are made of ───────────────────────────────────

/** Whatman grade 1 filter paper retains particles down to about 11 µm. */
export const FILTER_PORE_UM = 11;

/**
 * Every component that can turn up in a sample. `solubility` is grams per
 * 100 mL of each solvent at room temperature and `hotSolubility` the same
 * at the boil — the gap between the two is why copper sulfate crystallises
 * so readily on cooling while salt barely notices. `rf` is the retention
 * factor on paper in each solvent; a component with no `rf` is one that
 * does not travel at all. `method` is how a solute is crystallised: one
 * whose solubility hardly changes with temperature (salt, 36 → 39 g) is
 * taken to dryness, one whose solubility climbs steeply (copper sulfate,
 * 32 → 114 g) is heated only to saturation and then left to cool.
 *
 * `particleUm` is the size of the thing the filter paper sees: a grain of
 * sand, or — for a solute that has dissolved — a hydrated ion or a single
 * dye molecule, thousands of times smaller than a pore.
 */
export const COMPONENTS = {
  sand: {
    label: "Sand",
    formula: "SiO₂",
    kind: "solid",
    particleUm: 400,
    colour: "#c9a96e",
    solubility: { water: 0, ethanol: 0 },
    hotSolubility: { water: 0, ethanol: 0 },
    rf: { water: 0, ethanol: 0 },
    visible: true,
    crystal: null,
    title: "Insoluble grains, ~400 µm — 40× larger than a pore",
  },
  salt: {
    label: "Salt",
    formula: "NaCl",
    kind: "solute",
    particleUm: 0.0007,
    colour: "#f4f4f2",
    tint: null,
    solubility: { water: 36, ethanol: 0.065 },
    hotSolubility: { water: 39, ethanol: 0.1 },
    rf: { water: 0.9, ethanol: 0.02 },
    visible: false,
    crystal: "cube",
    method: "dryness",
    title: "Ionic — dissolves in water (36 g/100 mL) but barely in ethanol (0.065 g/100 mL)",
  },
  cuso4: {
    label: "Copper(II) sulfate",
    formula: "CuSO₄·5H₂O",
    kind: "solute",
    particleUm: 0.0008,
    colour: "#2f6fd6",
    tint: "#3b9ad1",
    solubility: { water: 32, ethanol: 0 },
    hotSolubility: { water: 114, ethanol: 0 },
    rf: { water: 0.78, ethanol: 0.04 },
    visible: true,
    crystal: "prism",
    method: "cool",
    title: "Ionic, blue — 32 g/100 mL in cold water, 114 g/100 mL at the boil, insoluble in ethanol",
  },
  yellow: {
    label: "Tartrazine (E102)",
    formula: "yellow dye",
    kind: "solute",
    particleUm: 0.0015,
    colour: "#f5c400",
    tint: "#f5c400",
    solubility: { water: 20, ethanol: 3 },
    hotSolubility: { water: 30, ethanol: 5 },
    rf: { water: 0.86, ethanol: 0.7 },
    visible: true,
    crystal: null,
    title: "Small, very polar — rides high with the water front",
  },
  red: {
    label: "Allura red (E129)",
    formula: "red dye",
    kind: "solute",
    particleUm: 0.0016,
    colour: "#e8342f",
    tint: "#e8342f",
    solubility: { water: 22, ethanol: 1.5 },
    hotSolubility: { water: 30, ethanol: 3 },
    rf: { water: 0.61, ethanol: 0.42 },
    visible: true,
    crystal: null,
    title: "Middling affinity for both phases",
  },
  blue: {
    label: "Brilliant blue (E133)",
    formula: "blue dye",
    kind: "solute",
    particleUm: 0.0018,
    colour: "#2457d6",
    tint: "#2457d6",
    solubility: { water: 20, ethanol: 4 },
    hotSolubility: { water: 30, ethanol: 6 },
    rf: { water: 0.38, ethanol: 0.56 },
    visible: true,
    crystal: null,
    title: "Large, clings to the paper in water — but ethanol carries it further than the red",
  },
};

/**
 * The three samples on the shelf. `gramsOf` is how much of each component
 * is in the 100 mL poured; `volumeMl` is that volume. The black marker is
 * exactly what the name says — three dyes mixed until no colour dominates.
 */
export const SAMPLE_VOLUME_ML = 100;

export const MIXTURES = {
  sand_salt: {
    label: "Sand + salt water",
    short: "Sand + salt",
    components: ["sand", "salt"],
    gramsOf: { sand: 6, salt: 12 },
    liquidColour: "#dfe6ea",
    liquidOpacity: 0.32,
    title: "A suspension of sand in a salt solution — one solid, one solute",
  },
  cuso4: {
    label: "Copper sulfate solution",
    short: "CuSO₄(aq)",
    components: ["cuso4"],
    gramsOf: { cuso4: 18 },
    liquidColour: "#3b9ad1",
    liquidOpacity: 0.55,
    title: "A single dissolved salt — nothing to filter, everything to crystallise",
  },
  dye: {
    label: "Black food dye markers",
    short: "Black dye",
    components: ["yellow", "red", "blue"],
    gramsOf: { yellow: 0.3, red: 0.3, blue: 0.3 },
    liquidColour: "#1f1a2e",
    liquidOpacity: 0.8,
    title: "Three dyes that look like one — only chromatography tells them apart",
  },
};
export const MIXTURE_ORDER = ["sand_salt", "cuso4", "dye"];

// ─── The stations ───────────────────────────────────────────────────

export const STATIONS = {
  filtration: {
    label: "Filtration",
    short: "Filter",
    property: "particle size · solubility",
    timeLapse: 15,
    title: "Gravity filtration — insoluble solids stay on the paper, the solution runs through",
  },
  crystallization: {
    label: "Crystallization",
    short: "Crystallise",
    property: "solubility · boiling point",
    timeLapse: 40,
    title: "Evaporate the solvent until the solution is saturated and the solute comes out",
  },
  chromatography: {
    label: "Chromatography",
    short: "Chromatograph",
    property: "phase affinity · Rf",
    timeLapse: 30,
    title: "The solvent climbs the paper and carries each pigment its own fraction of the way",
  },
};
export const STATION_ORDER = ["filtration", "crystallization", "chromatography"];

// ─── Dissolution ────────────────────────────────────────────────────

/**
 * How much of a component is actually in solution when its `grams` are put
 * into `volumeMl` of `solvent` at `tempC`. Solubility is interpolated between
 * the cold and hot values, so a hot solution holds more — the whole basis of
 * crystallisation on cooling.
 */
export function solubilityAt(key, solvent, tempC = AMBIENT_C) {
  const c = COMPONENTS[key];
  const S = SOLVENTS[solvent];
  const t = clamp((tempC - AMBIENT_C) / Math.max(S.boilingC - AMBIENT_C, 1), 0, 1);
  return lerp(c.solubility[solvent], c.hotSolubility[solvent], t);
}

export function dissolvedFraction(key, solvent, grams, volumeMl = SAMPLE_VOLUME_ML, tempC = AMBIENT_C) {
  if (grams <= 0) return 0;
  const capacity = (solubilityAt(key, solvent, tempC) * volumeMl) / 100;
  return clamp(capacity / grams, 0, 1);
}

/** The words the scene uses for a component's state in this solvent. */
export function phaseOf(key, solvent) {
  const c = COMPONENTS[key];
  if (c.kind === "solid") return "insoluble solid";
  const f = dissolvedFraction(key, solvent, mixtureGrams(key), SAMPLE_VOLUME_ML);
  if (f >= 0.999) return "dissolved";
  if (f <= 0.01) return "undissolved (insoluble here)";
  return "partly dissolved";
}

function mixtureGrams(key) {
  for (const m of Object.values(MIXTURES)) if (m.gramsOf[key] !== undefined) return m.gramsOf[key];
  return 1;
}

/** Hex helpers, kept here so the HUD legend and the scene agree on tints. */
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

/**
 * What a liquid containing these dissolved components looks like: the
 * tints of the dissolved parts, blended; colourless if nothing tinted is
 * in solution. Undissolved solids do not colour the liquid — they cloud it.
 */
export function liquidAppearance(mixtureKey, solvent, { tempC = AMBIENT_C, concentrationScale = 1 } = {}) {
  const m = MIXTURES[mixtureKey];
  const S = SOLVENTS[solvent];
  let colour = S.colour;
  let opacity = 0.14;
  let cloudy = 0;
  let tintWeight = 0;
  for (const key of m.components) {
    const c = COMPONENTS[key];
    const f = c.kind === "solid" ? 0 : dissolvedFraction(key, solvent, m.gramsOf[key], SAMPLE_VOLUME_ML, tempC);
    if (c.kind === "solid" || f < 0.999) cloudy += 1;
    if (c.tint && f > 0) {
      const w = clamp(f * concentrationScale, 0, 1);
      colour = tintWeight === 0 ? mixHex(colour, c.tint, w) : mixHex(colour, c.tint, w / (tintWeight + 1));
      tintWeight += w;
      opacity = Math.max(opacity, 0.18 + 0.5 * w);
    }
  }
  if (tintWeight > 1.5) {
    // Three dyes together read as black, not as their average.
    colour = mixHex(colour, "#1f1a2e", clamp((tintWeight - 1) / 2, 0, 1));
    opacity = Math.max(opacity, 0.75);
  }
  if (cloudy > 0) {
    colour = mixHex(colour, "#e6ebee", 0.35);
    opacity = Math.max(opacity, 0.3);
  }
  return { colour, opacity, cloudy: cloudy > 0 };
}

// ─── Filtration ─────────────────────────────────────────────────────

/** Model seconds the filtrate takes to reach 63% through a clean paper. */
export const FILTRATION_TAU_S = 90;
/** The residue mass that doubles the time constant — cake resistance. */
export const CAKE_G = 10;
/** …but a cake never slows the paper by more than this factor. */
export const CAKE_MAX_FACTOR = 2;
/** Wetting the paper and filling the funnel takes this long before drips start. */
export const FILTRATION_LAG_S = 6;
/** Pouring the sample in takes this long, model seconds. */
export const POUR_S = 30;

/**
 * Gravity filtration of `mixture` in `solvent` after `seconds` of model time.
 *
 * A component is retained if it is not dissolved: its undissolved fraction
 * stays on the paper as residue, its dissolved fraction runs through as
 * filtrate. Salt water in water is all filtrate; the same salt in ethanol
 * is nearly all residue, because ethanol never dissolved it.
 */
export function solveFiltration({ mixture, solvent, seconds = 0 }) {
  const m = MIXTURES[mixture] ?? MIXTURES.sand_salt;
  const S = SOLVENTS[solvent] ? solvent : "water";
  const t = Math.max(0, Number(seconds) || 0);

  const components = m.components.map((key) => {
    const c = COMPONENTS[key];
    const grams = m.gramsOf[key];
    const dissolved = c.kind === "solid" ? 0 : dissolvedFraction(key, S, grams, SAMPLE_VOLUME_ML);
    const retainedG = grams * (1 - dissolved);
    const passedG = grams * dissolved;
    const retained = retainedG > 1e-6;
    let reason;
    if (c.kind === "solid") reason = `${c.particleUm} µm grains cannot pass ${FILTER_PORE_UM} µm pores`;
    else if (dissolved >= 0.999) reason = `dissolved — ${c.crystal ? "ions" : "molecules"} ${(c.particleUm * 1000).toFixed(1)} nm wide slip through ${FILTER_PORE_UM} µm pores`;
    else if (dissolved <= 0.01) reason = `not dissolved in ${SOLVENTS[S].label.toLowerCase()} — stays as solid on the paper`;
    else reason = `${(dissolved * 100).toFixed(0)}% dissolved — the rest is solid`;
    return { key, label: c.label, formula: c.formula, dissolvedFraction: dissolved, retained, retainedG, passedG, reason, colour: c.colour };
  });

  const residueG = components.reduce((s, c) => s + c.retainedG, 0);
  const passedG = components.reduce((s, c) => s + c.passedG, 0);
  const tau = FILTRATION_TAU_S * Math.min(CAKE_MAX_FACTOR, 1 + residueG / CAKE_G);
  const pouredFraction = clamp(t / POUR_S, 0, 1);
  const filtrateFraction = clamp(1 - Math.exp(-Math.max(0, t - FILTRATION_LAG_S) / tau), 0, 1);
  // Filtrate cannot get ahead of what has been poured; a tiny fraction
  // wets the paper and never arrives.
  const filtrateMl = Math.min(pouredFraction, filtrateFraction) * SAMPLE_VOLUME_ML * 0.97;
  const residueNowG = residueG * pouredFraction;
  const dripRate = t < FILTRATION_LAG_S ? 0 : Math.min(pouredFraction, 1) * Math.exp(-Math.max(0, t - FILTRATION_LAG_S) / tau);

  const retainedList = components.filter((c) => c.retained);
  // Salt in ethanol is 0.5% dissolved — a trace, not "salt in the flask".
  const passedList = components.filter((c) => c.dissolvedFraction > 0.05);
  const separates = retainedList.length > 0 && passedList.length > 0;
  const nothingRetained = retainedList.length === 0;
  const nothingPassed = passedList.length === 0;

  const residueColour = retainedList.length
    ? retainedList.reduce((acc, c, i) => (i === 0 ? c.colour : mixHex(acc, c.colour, 0.5)), retainedList[0].colour)
    : "#e6ebee";
  const filtrate = liquidAppearance(mixture, S);
  // The filtrate is the liquid with every undissolved solid removed.
  const filtrateColour = nothingPassed || passedList.every((c) => !COMPONENTS[c.key].tint) ? SOLVENTS[S].colour : filtrate.colour;
  const filtrateOpacity = nothingPassed || passedList.every((c) => !COMPONENTS[c.key].tint) ? 0.16 : Math.max(0.3, filtrate.opacity);

  let verdict;
  if (separates) verdict = `separates — ${retainedList.map((c) => lower(c.label)).join(" + ")} on the paper, ${passedList.map((c) => lower(c.label)).join(" + ")} in the flask`;
  else if (nothingRetained) verdict = "wrong tool — everything is dissolved, so everything runs through";
  else verdict = "nothing runs through but solvent — the solute never dissolved";

  return {
    station: "filtration",
    mixture,
    solvent: S,
    seconds: t,
    timeLapse: STATIONS.filtration.timeLapse,
    components,
    residueG,
    residueNowG,
    residueColour,
    passedG,
    filtrateMl,
    filtrateFraction: filtrateMl / (SAMPLE_VOLUME_ML * 0.97),
    filtrateColour,
    filtrateOpacity,
    pouredFraction,
    dripRate,
    tau,
    complete: pouredFraction >= 1 && filtrateFraction > 0.985,
    separates,
    nothingRetained,
    nothingPassed,
    verdict,
  };
}

// ─── Crystallisation ────────────────────────────────────────────────

/** Heat delivered to the basin by a medium Bunsen flame through the gauze, W. */
export const BASIN_POWER_W = 200;
/** Model seconds for the basin to get within 63% of the boil, for 100 mL of water. */
export const HEAT_TAU_S = 45;
/** Evaporation starts this many degrees short of the boil. */
export const BOIL_MARGIN_C = 4;
/** Below this volume the basin is dry. */
export const DRY_ML = 2;
/** Once the flame is off, the basin cools toward the room with this time constant. */
export const COOL_TAU_S = 300;
/** A solute with less than this dissolved is not worth crystallising. */
export const MIN_CRYSTALLISABLE_G = 0.5;

/** How fast this solvent boils off under the burner, mL per model second. */
export const evaporationRate = (solvent) => {
  const S = SOLVENTS[solvent];
  return ((BASIN_POWER_W / (S.latentKJPerKg * 1000)) / S.density) * 1000;
};

/** When the basin reaches the boil, model seconds. */
export function boilTime(solvent) {
  const S = SOLVENTS[solvent];
  const tauHeat = HEAT_TAU_S * (S.specificHeat / SOLVENTS.water.specificHeat);
  return -tauHeat * Math.log(BOIL_MARGIN_C / (S.boilingC - AMBIENT_C));
}

/**
 * The model time at which `grams` of `component` dissolved in the sample
 * volume of `solvent` first passes saturation at the boil — where the first
 * crystal appears. Infinity if it never will (nothing dissolved).
 */
export function crystallisationTime(component, solvent, grams) {
  if (grams < MIN_CRYSTALLISABLE_G) return Infinity;
  const S = SOLVENTS[solvent];
  const hot = solubilityAt(component, solvent, S.boilingC);
  if (hot <= 0) return 0;
  const holdMl = (grams / hot) * 100; // the volume that can just hold it
  if (holdMl >= SAMPLE_VOLUME_ML) return 0;
  return boilTime(solvent) + (SAMPLE_VOLUME_ML - holdMl) / evaporationRate(solvent);
}

/**
 * Evaporating `mixture` in `solvent` over a burner after `seconds` of model
 * time, done the way the method sheet says: heat until the solution is
 * saturated and the first crystals show, then take the flame away and let
 * it cool. The temperature climbs to the boil, the volume falls at the rate
 * the latent heat allows, and once the flame is off the falling temperature
 * drags the solubility down with it — which is where most of the copper
 * sulfate actually comes out. A sample with nothing to crystallise (a dye,
 * or a salt that never dissolved) is simply taken to dryness.
 */
export function solveCrystallization({ mixture, solvent, seconds = 0 }) {
  const m = MIXTURES[mixture] ?? MIXTURES.sand_salt;
  const key = SOLVENTS[solvent] ? solvent : "water";
  const S = SOLVENTS[key];
  const t = Math.max(0, Number(seconds) || 0);

  const tauHeat = HEAT_TAU_S * (S.specificHeat / SOLVENTS.water.specificHeat);
  const boilAt = boilTime(key);
  const evapMlPerS = evaporationRate(key);
  const dryAt = boilAt + (SAMPLE_VOLUME_ML - DRY_ML) / evapMlPerS;

  // What each solute has in solution at the start decides the plan.
  const initial = m.components.map((ck) => {
    const c = COMPONENTS[ck];
    const grams = m.gramsOf[ck];
    const f = c.kind === "solid" ? 0 : dissolvedFraction(ck, key, grams, SAMPLE_VOLUME_ML);
    return { ck, c, grams, dissolvedG: grams * f, undissolvedG: grams * (1 - f) };
  });
  const crystalliserKeys = initial.filter((x) => x.c.crystal && x.dissolvedG >= MIN_CRYSTALLISABLE_G).map((x) => x.ck);
  const nucleationAt = crystalliserKeys.length
    ? Math.min(...initial.filter((x) => crystalliserKeys.includes(x.ck)).map((x) => crystallisationTime(x.ck, key, x.dissolvedG)))
    : null;
  // The flame comes off at the first crystals if cooling will do the rest
  // (a steep solubility curve) — otherwise the basin is taken to dryness.
  const coolMethod = crystalliserKeys.length > 0 && crystalliserKeys.every((ck) => COMPONENTS[ck].method === "cool");
  const stopAt = coolMethod && nucleationAt !== null && nucleationAt < dryAt ? Math.max(nucleationAt, boilAt) : dryAt;

  let phase;
  let temperatureC;
  if (t < boilAt) {
    phase = "heating";
    temperatureC = AMBIENT_C + (S.boilingC - AMBIENT_C) * (1 - Math.exp(-t / tauHeat));
  } else if (t < stopAt) {
    phase = "evaporating";
    temperatureC = S.boilingC;
  } else {
    temperatureC = AMBIENT_C + (S.boilingC - AMBIENT_C) * Math.exp(-(t - stopAt) / COOL_TAU_S);
    phase = temperatureC - AMBIENT_C < 3 ? "done" : "cooling";
  }
  const flameOn = t < stopAt;
  const evaporatedMl = t > boilAt ? clamp(evapMlPerS * (Math.min(t, stopAt) - boilAt), 0, SAMPLE_VOLUME_ML - DRY_ML) : 0;
  const volumeMl = Math.max(0, SAMPLE_VOLUME_ML - evaporatedMl);
  const dry = volumeMl <= DRY_ML + 1e-9;
  if (dry) phase = "dry";
  const evaporatedFraction = evaporatedMl / SAMPLE_VOLUME_ML;

  const components = initial.map(({ ck, c, grams, dissolvedG, undissolvedG }) => {
    const holdG = c.kind === "solid" ? 0 : (solubilityAt(ck, key, temperatureC) * Math.max(volumeMl, 0)) / 100;
    const crystalsG = c.crystal ? clamp(dissolvedG - holdG, 0, dissolvedG) : 0;
    const filmG = !c.crystal && c.kind !== "solid" ? dissolvedG * evaporatedFraction : 0;
    const inSolutionG = Math.max(0, dissolvedG - crystalsG);
    const concentration = volumeMl > 0 ? (inSolutionG / volumeMl) * 100 : Infinity;
    const solubility = solubilityAt(ck, key, temperatureC);
    const saturation = volumeMl > 0 && solubility > 0 ? clamp(concentration / solubility, 0, 1) : dissolvedG > 0 ? 1 : 0;
    return {
      key: ck,
      label: c.label,
      formula: c.formula,
      colour: c.colour,
      crystal: c.crystal,
      grams,
      dissolvedG,
      undissolvedG,
      holdG,
      crystalsG,
      crystalFraction: dissolvedG > 0 ? crystalsG / dissolvedG : 0,
      filmG,
      concentration,
      solubility,
      saturation,
      nucleated: crystalsG > 0.01,
      crystalliser: crystalliserKeys.includes(ck),
    };
  });

  const crystallisers = components.filter((c) => c.crystalliser);
  const nucleated = crystallisers.some((c) => c.nucleated);
  const crystalsG = components.reduce((s, c) => s + c.crystalsG, 0);
  const filmG = components.reduce((s, c) => s + c.filmG, 0);
  const precipitateG = components.reduce((s, c) => s + c.undissolvedG, 0);
  const liquid = liquidAppearance(mixture, key, { tempC: temperatureC, concentrationScale: SAMPLE_VOLUME_ML / Math.max(volumeMl, 15) });
  const undissolvedSolutes = components.filter((c) => c.crystal && c.dissolvedG < MIN_CRYSTALLISABLE_G && c.grams >= MIN_CRYSTALLISABLE_G);

  const names = (list) => list.map((c) => lower(c.label)).join(" + ");
  let verdict;
  if (crystallisers.length && dry) verdict = `taken to dryness — ${crystalsG.toFixed(1)} g of ${names(crystallisers)} crystals; its solubility barely changes with temperature, so cooling would not have brought it out`;
  else if (crystallisers.length && phase === "done") verdict = `cooled — ${crystalsG.toFixed(1)} g of ${names(crystallisers)} crystals out of ${crystallisers.reduce((s, c) => s + c.dissolvedG, 0).toFixed(1)} g dissolved; the rest stays in the cold liquor`;
  else if (crystallisers.length && phase === "cooling") verdict = `flame off — cooling drags the solubility down and the ${names(crystallisers)} crystals keep growing`;
  else if (nucleated && coolMethod) verdict = `saturated — first ${names(crystallisers.filter((c) => c.nucleated))} crystals; the flame comes off now`;
  else if (nucleated) verdict = `saturated — ${names(crystallisers.filter((c) => c.nucleated))} crystallising as the last solvent leaves`;
  else if (crystallisers.length) verdict = `${phase} — ${names(crystallisers)} still below saturation, keep the solvent leaving`;
  else if (undissolvedSolutes.length && dry) verdict = `dried out — the ${names(undissolvedSolutes)} never dissolved in ${S.label.toLowerCase()}, so it was a solid all along`;
  else if (undissolvedSolutes.length) verdict = `nothing to crystallise — the ${names(undissolvedSolutes)} never dissolved in ${S.label.toLowerCase()}`;
  else if (dry) verdict = "dried to a film — dyes do not form crystals, they leave a smear";
  else verdict = `${phase} — a dye mixture leaves a film, not crystals`;

  return {
    station: "crystallization",
    mixture,
    solvent: key,
    seconds: t,
    timeLapse: STATIONS.crystallization.timeLapse,
    phase,
    flameOn,
    temperatureC,
    boiling: phase === "evaporating",
    boilAt,
    stopAt,
    dryAt,
    evapMlPerS,
    evaporatedMl,
    evaporatedFraction,
    volumeMl,
    dry,
    components,
    crystallisers,
    coolMethod,
    nucleated,
    nucleationAt,
    crystalsG,
    filmG,
    precipitateG,
    liquidColour: liquid.colour,
    liquidOpacity: liquid.opacity,
    steamRate: phase === "evaporating" ? 1 : phase === "heating" ? clamp((temperatureC - (S.boilingC - 25)) / 25, 0, 0.35) : phase === "cooling" ? clamp((temperatureC - (S.boilingC - 25)) / 25, 0, 0.3) : 0,
    flammableWarning: S.flammable,
    verdict,
  };
}

// ─── Chromatography ─────────────────────────────────────────────────

/** The paper strip, mm. The solvent front is measured from the pencil baseline. */
export const PAPER_LENGTH_MM = 100;
export const BASELINE_MM = 15;
export const SOLVENT_DEPTH_MM = 8;
export const FRONT_MAX_MM = PAPER_LENGTH_MM - BASELINE_MM - 10;
/** Capillary rise follows √t (Lucas–Washburn); this puts the front at the top in 15 min. */
export const RISE_MM_PER_SQRT_S = FRONT_MAX_MM / Math.sqrt(900);

export const retentionFactor = (component, solvent) => COMPONENTS[component].rf[solvent] ?? 0;

/**
 * Paper chromatography of `mixture` in `solvent` after `seconds`. The front
 * climbs as √t and each component sits at Rf × front. The Rf never changes
 * during the run — that is precisely why it is the number that identifies
 * a substance — but the distances it is calculated from do.
 */
export function solveChromatography({ mixture, solvent, seconds = 0 }) {
  const m = MIXTURES[mixture] ?? MIXTURES.sand_salt;
  const key = SOLVENTS[solvent] ? solvent : "water";
  const t = Math.max(0, Number(seconds) || 0);
  const frontMm = Math.min(FRONT_MAX_MM, RISE_MM_PER_SQRT_S * Math.sqrt(t));
  const finished = frontMm >= FRONT_MAX_MM - 1e-9;
  const finishAt = Math.pow(FRONT_MAX_MM / RISE_MM_PER_SQRT_S, 2);

  const spots = m.components.map((ck) => {
    const c = COMPONENTS[ck];
    const rf = retentionFactor(ck, key);
    const dissolved = c.kind === "solid" ? 0 : dissolvedFraction(ck, key, m.gramsOf[ck], SAMPLE_VOLUME_ML);
    const moves = rf > 0.05 && dissolved > 0.05;
    const distanceMm = moves ? rf * frontMm : 0;
    let note;
    if (c.kind === "solid") note = "insoluble grains — stay on the baseline";
    else if (!c.visible) note = "colourless — travels but cannot be seen without a locating agent";
    else if (!moves) note = `insoluble in ${lower(SOLVENTS[key].label)} — stays put`;
    else if (rf > 0.7) note = "more attracted to the moving solvent than to the paper";
    else if (rf < 0.45) note = "clings to the paper more than the solvent";
    else note = "balanced between paper and solvent";
    return { key: ck, label: c.label, colour: c.colour, visible: c.visible, rf, distanceMm, moves, note };
  });

  const visibleSpots = spots.filter((s) => s.visible && (s.moves || s.rf === 0));
  const movingVisible = spots.filter((s) => s.visible && s.moves);
  const distinct = movingVisible.length;
  let verdict;
  if (distinct >= 2) verdict = `separates — ${distinct} pigments at ${movingVisible.map((s) => `Rf ${s.rf.toFixed(2)}`).join(", ")}`;
  else if (distinct === 1) verdict = `one spot — ${lower(movingVisible[0].label)} is a single substance`;
  else if (spots.some((s) => !s.visible && s.rf > 0.05)) verdict = "nothing to see — a colourless solute needs a locating agent, and a single salt gives one spot anyway";
  else verdict = "nothing moves — no component dissolves in this solvent";

  return {
    station: "chromatography",
    mixture,
    solvent: key,
    seconds: t,
    timeLapse: STATIONS.chromatography.timeLapse,
    frontMm,
    finished,
    finishAt,
    spots,
    visibleSpots,
    movingVisible,
    distinct,
    verdict,
  };
}

// ─── Dispatch ───────────────────────────────────────────────────────

export function solveSeparation({ station, mixture, solvent, seconds = 0 }) {
  const args = { mixture: MIXTURES[mixture] ? mixture : "sand_salt", solvent: SOLVENTS[solvent] ? solvent : "water", seconds };
  if (station === "crystallization") return solveCrystallization(args);
  if (station === "chromatography") return solveChromatography(args);
  return solveFiltration(args);
}

/** "1 min 30 s", "45 s", "12 min" — the model clock in the readout. */
export function formatSeconds(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m} min` : `${m} min ${String(rest).padStart(2, "0")} s`;
}

/** The Rf line the readout prints: "Rf = 23.1 mm / 60.2 mm = 0.38". */
export function rfText(spot, frontMm) {
  if (!spot.moves || frontMm <= 0) return "—";
  return `${spot.distanceMm.toFixed(1)} mm / ${frontMm.toFixed(1)} mm = ${spot.rf.toFixed(2)}`;
}
