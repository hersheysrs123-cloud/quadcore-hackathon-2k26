// ─── Redox & metal reactivity ───────────────────────────────────────
// The chemistry behind two scenes: a rack of beakers with metal strips
// dipped into metal-salt solutions (single displacement), and a rack of
// test tubes with iron nails rusting — or not — under different conditions
// (corrosion and sacrificial protection).
//
// Both are the same idea seen twice: the metal higher in the reactivity
// series gives its electrons up more readily, so wherever two metals (or a
// metal and a metal ion) meet, the more reactive one is oxidised and the
// less reactive one is reduced. The reactivity series is written here as
// standard electrode potentials rather than as a bare ordering, because a
// number lets the scenes say HOW MUCH more readily — which is why magnesium
// coats itself in copper in a minute while iron takes ten, and why a
// magnesium anode protects a nail harder than a zinc one does.
//
// Everything below is closed-form in time. The scenes integrate nothing;
// they ask "what does the beaker look like after t seconds" and "what does
// the nail look like after d days", which is also what makes the model
// straightforward to test.
// ─────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const lcm = (a, b) => (a * b) / gcd(a, b);

const SUPERSCRIPT = { 1: "⁺", 2: "²⁺", 3: "³⁺" };
/** "Cu²⁺", "Ag⁺" — the ion a metal forms, in the notation the syllabus uses. */
export const ionSymbol = (symbol, charge) => `${symbol}${SUPERSCRIPT[charge] ?? `${charge}+`}`;
/** "2e⁻" — but "e⁻" for one, since "1e⁻" reads as a typo. */
export const electronsText = (n) => (n === 1 ? "e⁻" : `${n}e⁻`);

// ─── The reactivity series ──────────────────────────────────────────

/**
 * The seven metals on the dipping arm, in series order (most reactive
 * first). `potential` is the standard electrode potential E° of Mⁿ⁺/M in
 * volts against the standard hydrogen electrode — the more negative, the
 * more readily the metal loses electrons.
 *
 * `waterRate` is how fast the metal attacks the WATER it is standing in,
 * independent of any ions dissolved there: potassium fizzes to hydrogen in
 * seconds, magnesium raises the odd bubble, the rest do nothing. A metal with
 * `reactsWithWater` never gets as far as displacing anything — the solvent
 * gets to it first, which is exactly why it is not on the displacement
 * grid in a real lab.
 */
export const METALS = {
  K: { symbol: "K", label: "Potassium", charge: 1, potential: -2.93, molarMass: 39.1, colour: "#c8ccd4", deposit: "#c8ccd4", reactsWithWater: true, waterRate: 1, title: "E° = −2.93 V — so reactive it attacks the water itself" },
  Mg: { symbol: "Mg", label: "Magnesium", charge: 2, potential: -2.37, molarMass: 24.3, colour: "#d0d5dd", deposit: "#d0d5dd", reactsWithWater: false, waterRate: 0.06, title: "E° = −2.37 V — displaces everything below it, bubbles a little in water" },
  Zn: { symbol: "Zn", label: "Zinc", charge: 2, potential: -0.76, molarMass: 65.4, colour: "#9ea7b3", deposit: "#9ea7b3", reactsWithWater: false, waterRate: 0, title: "E° = −0.76 V — displaces iron, copper and silver" },
  Fe: { symbol: "Fe", label: "Iron", charge: 2, potential: -0.44, molarMass: 55.8, colour: "#7b8494", deposit: "#5d6673", reactsWithWater: false, waterRate: 0, title: "E° = −0.44 V — displaces copper and silver, not zinc" },
  Cu: { symbol: "Cu", label: "Copper", charge: 2, potential: 0.34, molarMass: 63.5, colour: "#c2703b", deposit: "#b5633a", reactsWithWater: false, waterRate: 0, title: "E° = +0.34 V — displaces only silver" },
  Ag: { symbol: "Ag", label: "Silver", charge: 1, potential: 0.8, molarMass: 107.9, colour: "#dfe3e8", deposit: "#e6e9ee", reactsWithWater: false, waterRate: 0, title: "E° = +0.80 V — displaces nothing on this rack" },
  Au: { symbol: "Au", label: "Gold", charge: 3, potential: 1.5, molarMass: 197.0, colour: "#e5b83c", deposit: "#e5b83c", reactsWithWater: false, waterRate: 0, title: "E° = +1.50 V — the least reactive, so it stays gold" },
};

/** Series order, most reactive first. */
export const SERIES = ["K", "Mg", "Zn", "Fe", "Cu", "Ag", "Au"];

/** The rank of a metal in the series — 0 is the most reactive. */
export const seriesRank = (symbol) => SERIES.indexOf(symbol);

/** A colourless solution is not invisible; it is a faint glass-and-water tint. */
export const COLOURLESS = { colour: "#c9e3ec", opacity: 0.12 };

/** What each aqueous ion looks like at the rack's 0.20 mol/dm³. */
export const ION_APPEARANCE = {
  K: COLOURLESS,
  Mg: COLOURLESS,
  Zn: COLOURLESS,
  Fe: { colour: "#a3d18c", opacity: 0.34 },
  Cu: { colour: "#1e8fe0", opacity: 0.56 },
  Ag: COLOURLESS,
  Au: { colour: "#e8c25a", opacity: 0.3 },
};

/**
 * The four beakers, in rack order. Each holds `SOLUTION_VOLUME_CM3` of a
 * `SOLUTION_MOLARITY` solution of the salt named.
 */
export const SOLUTIONS = {
  cuso4: { key: "cuso4", label: "CuSO₄(aq)", short: "CuSO₄", metal: "Cu", anion: "sulfate", title: "Copper(II) sulfate — bright blue from Cu²⁺" },
  feso4: { key: "feso4", label: "FeSO₄(aq)", short: "FeSO₄", metal: "Fe", anion: "sulfate", title: "Iron(II) sulfate — pale green from Fe²⁺" },
  agno3: { key: "agno3", label: "AgNO₃(aq)", short: "AgNO₃", metal: "Ag", anion: "nitrate", title: "Silver nitrate — colourless, Ag⁺" },
  mgso4: { key: "mgso4", label: "MgSO₄(aq)", short: "MgSO₄", metal: "Mg", anion: "sulfate", title: "Magnesium sulfate — colourless, Mg²⁺" },
};
export const SOLUTION_ORDER = ["cuso4", "feso4", "agno3", "mgso4"];

/** Each beaker: 100 cm³ at 0.200 mol/dm³ — 0.0200 mol of metal ion. */
export const SOLUTION_VOLUME_CM3 = 100;
export const SOLUTION_MOLARITY = 0.2;
export const SOLUTION_MOL = (SOLUTION_VOLUME_CM3 / 1000) * SOLUTION_MOLARITY;
/** Every strip on the arm has the same mass, so mass loss is comparable. */
export const STRIP_MASS_G = 2.0;

/**
 * Rate. A displacement is first-order in the ions left, with a time constant
 * set by how hard the cell is driven: τ = TAU_REF·exp(−E°cell / E_SCALE).
 * Magnesium in copper sulfate (2.71 V) is done in about a minute; zinc in
 * the same beaker (1.10 V) takes five; copper in silver nitrate (0.46 V)
 * grows its silver tree over ten. Those are lab timescales, and the ratios
 * between them are what the time-lapse slider preserves.
 */
export const TAU_REF_S = 900;
export const E_SCALE_V = 1.0;
/** A metal that attacks the solvent is not diffusion-limited: seconds, not minutes. */
export const WATER_TAU_S = 20;
/** 2H₂O + 2e⁻ → H₂ + 2OH⁻, standard. Only potassium gets this far. */
export const WATER_POTENTIAL_V = -0.83;

export const reactionTimeConstant = (ecell) => TAU_REF_S * Math.exp(-ecell / E_SCALE_V);
export const displacementProgress = (seconds, tau) => (seconds <= 0 ? 0 : 1 - Math.exp(-seconds / tau));

const SUB = { 2: "₂", 3: "₃" };
/** "CuSO₄", "K₂SO₄", "AgNO₃", "Cu(NO₃)₂" — the salt a metal of this charge forms. */
export function saltFormula(symbol, charge, anion) {
  if (anion === "nitrate") return charge === 1 ? `${symbol}NO₃` : `${symbol}(NO₃)${SUB[charge]}`;
  if (charge === 1) return `${symbol}₂SO₄`;
  if (charge === 2) return `${symbol}SO₄`;
  return `${symbol}₂(SO₄)₃`;
}

/** The balanced equations for metal M (charge n) displacing ion Nᵐ⁺ from its `anion` salt. */
export function balancedDisplacement(metal, ionMetal, anion = "sulfate") {
  const M = METALS[metal];
  const N = METALS[ionMetal];
  const l = lcm(M.charge, N.charge);
  const a = l / M.charge;
  const b = l / N.charge;
  // A sulfate of a charge-1 or charge-3 metal packs two metal ions per
  // formula unit (K₂SO₄, Fe₂(SO₄)₃); everything else packs one. If that makes
  // a salt coefficient fractional, the whole equation is doubled.
  const metalsPerSalt = (charge) => (anion === "nitrate" || charge === 2 ? 1 : 2);
  let scale = 1;
  if ((a / metalsPerSalt(M.charge)) % 1 !== 0 || (b / metalsPerSalt(N.charge)) % 1 !== 0) scale = 2;
  const productSalts = (a * scale) / metalsPerSalt(M.charge);
  const reactantSalts = (b * scale) / metalsPerSalt(N.charge);
  const co = (k) => (k === 1 ? "" : String(k));
  return {
    electrons: l,
    metalCoefficient: a,
    ionCoefficient: b,
    oxidation: `${M.symbol} → ${ionSymbol(M.symbol, M.charge)} + ${electronsText(M.charge)}`,
    reduction: `${ionSymbol(N.symbol, N.charge)} + ${electronsText(N.charge)} → ${N.symbol}`,
    ionic: `${co(a)}${M.symbol} + ${co(b)}${ionSymbol(N.symbol, N.charge)} → ${co(a)}${ionSymbol(M.symbol, M.charge)} + ${co(b)}${N.symbol}`,
    molecular: `${co(a * scale)}${M.symbol} + ${co(reactantSalts)}${saltFormula(N.symbol, N.charge, anion)} → ${co(productSalts)}${saltFormula(M.symbol, M.charge, anion)} + ${co(b * scale)}${N.symbol}`,
  };
}

/**
 * Whether — and why — a strip reacts in a beaker. Four outcomes:
 *   displaces          the strip is above the ion's metal in the series
 *   less_reactive      it is below, so nothing happens however long you wait
 *   same_metal         copper in copper sulfate: no driving force at all
 *   reacts_with_water  potassium: the water wins before the ions get a look in
 */
export function displacementOutcome(metal, solutionKey) {
  const M = METALS[metal];
  const solution = SOLUTIONS[solutionKey];
  const N = METALS[solution.metal];
  const base = { metal, solution: solutionKey, ionMetal: solution.metal };

  if (M.reactsWithWater) {
    const ecell = WATER_POTENTIAL_V - M.potential;
    return {
      ...base,
      reacts: true,
      reason: "reacts_with_water",
      ecell,
      tau: WATER_TAU_S,
      oxidation: `${M.symbol} → ${ionSymbol(M.symbol, M.charge)} + ${electronsText(M.charge)}`,
      reduction: "2H₂O + 2e⁻ → H₂ + 2OH⁻",
      ionic: `2${M.symbol} + 2H₂O → 2${M.symbol}⁺ + 2OH⁻ + H₂`,
      molecular: `2${M.symbol} + 2H₂O → 2${M.symbol}OH + H₂`,
      electrons: 2,
      metalCoefficient: 2,
      ionCoefficient: 0,
      depositMetal: null,
    };
  }

  const ecell = N.potential - M.potential;
  if (metal === solution.metal) {
    return { ...base, reacts: false, reason: "same_metal", ecell: 0, tau: Infinity, oxidation: "—", reduction: "—", ionic: "no reaction", molecular: "no reaction", electrons: 0, metalCoefficient: 0, ionCoefficient: 0, depositMetal: null };
  }
  if (ecell <= 0) {
    return { ...base, reacts: false, reason: "less_reactive", ecell, tau: Infinity, oxidation: "—", reduction: "—", ionic: "no reaction", molecular: "no reaction", electrons: 0, metalCoefficient: 0, ionCoefficient: 0, depositMetal: null };
  }
  const eq = balancedDisplacement(metal, solution.metal, solution.anion);
  return { ...base, reacts: true, reason: "displaces", ecell, tau: reactionTimeConstant(ecell), ...eq, depositMetal: solution.metal };
}

/** Hex → [r,g,b] in 0..1, and back. Tiny, so the module stays dependency-free. */
export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const k = clamp(t, 0, 1);
  return rgbToHex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
}

/**
 * What the solution looks like part-way through. The ions that are left keep
 * their colour at their remaining concentration; the ions that have been
 * made add theirs at the concentration they have reached. Zinc into copper
 * sulfate fades blue to colourless; copper into silver nitrate goes the
 * other way, colourless to blue, and only half as strongly, because each
 * Cu²⁺ took two Ag⁺ to make.
 */
export function solutionAppearance(progress, ionMetal, productMetal, productPerIon = 1) {
  const initial = ION_APPEARANCE[ionMetal] ?? COLOURLESS;
  const product = (productMetal && ION_APPEARANCE[productMetal]) || COLOURLESS;
  const p = clamp(progress, 0, 1);
  const wI = (1 - p) * initial.opacity;
  const wP = p * productPerIon * product.opacity;
  const total = wI + wP;
  if (total < 1e-6) return { ...COLOURLESS };
  return {
    colour: mixHex(initial.colour, product.colour, wP / total),
    opacity: clamp(Math.max(COLOURLESS.opacity, total), COLOURLESS.opacity, 0.6),
  };
}

/**
 * One beaker, `seconds` of reaction time after the strip went in.
 * `seconds` is MODEL time — the scene multiplies wall time by the time-lapse
 * factor before asking.
 */
export function solveDisplacement({ metal = "Zn", solution = "cuso4", seconds = 0 } = {}) {
  const outcome = displacementOutcome(metal, solution);
  const M = METALS[metal];
  const N = METALS[SOLUTIONS[solution].metal];
  const t = Math.max(0, Number(seconds) || 0);
  const progress = outcome.reacts ? displacementProgress(t, outcome.tau) : 0;

  if (outcome.reason === "reacts_with_water") {
    // 2K + 2H₂O → 2KOH + H₂: the strip is what runs out, not the solution.
    const stripMol = STRIP_MASS_G / M.molarMass;
    const consumedMol = progress * stripMol;
    const hydrogenMol = consumedMol / 2;
    return {
      ...outcome,
      seconds: t,
      progress,
      rate: (1 - progress) / outcome.tau,
      ionsRemainingMol: SOLUTION_MOL,
      ionsRemainingFraction: 1,
      electronsMol: consumedMol * M.charge,
      metalLostG: consumedMol * M.molarMass,
      stripRemainingFraction: 1 - progress,
      depositG: 0,
      depositMol: 0,
      hydrogenMol,
      hydrogenCm3: hydrogenMol * 24000,
      bubbleRate: M.waterRate * (1 - progress),
      appearance: solutionAppearance(0, N.symbol, null),
      depositColour: null,
      complete: progress > 0.995,
    };
  }

  const ionsConsumedMol = progress * SOLUTION_MOL;
  const electronsMol = ionsConsumedMol * N.charge;
  const metalLostMol = electronsMol / M.charge;
  const metalLostG = metalLostMol * M.molarMass;
  const productPerIon = N.charge / M.charge;
  return {
    ...outcome,
    seconds: t,
    progress,
    rate: outcome.reacts ? (1 - progress) / outcome.tau : 0,
    ionsRemainingMol: SOLUTION_MOL - ionsConsumedMol,
    ionsRemainingFraction: 1 - progress,
    electronsMol,
    metalLostG,
    stripRemainingFraction: 1 - metalLostG / STRIP_MASS_G,
    depositG: ionsConsumedMol * N.molarMass,
    depositMol: ionsConsumedMol,
    hydrogenMol: 0,
    hydrogenCm3: 0,
    bubbleRate: M.waterRate,
    appearance: solutionAppearance(progress, N.symbol, outcome.reacts ? M.symbol : null, productPerIon),
    depositColour: outcome.reacts ? N.deposit : null,
    complete: outcome.reacts && progress > 0.995,
  };
}

/** The whole rack: one strip of `metal` in each of the four beakers. */
export function solveReactivityRack({ metal = "Zn", seconds = 0 } = {}) {
  return SOLUTION_ORDER.map((solution) => solveDisplacement({ metal, solution, seconds }));
}

/** Plain-English verdict for a beaker, for labels and the Details panel. */
export function describeOutcome(result) {
  const M = METALS[result.metal];
  const N = METALS[result.ionMetal];
  switch (result.reason) {
    case "displaces":
      return `${M.label} is above ${N.label.toLowerCase()} in the series, so it pushes ${ionSymbol(N.symbol, N.charge)} out of solution as ${N.label.toLowerCase()} metal.`;
    case "less_reactive":
      return `${M.label} is below ${N.label.toLowerCase()} in the series — it holds its electrons more tightly than ${N.label.toLowerCase()} does, so nothing happens.`;
    case "same_metal":
      return `${M.label} in a ${M.label.toLowerCase()} salt: no difference in reactivity, so no driving force and no reaction.`;
    case "reacts_with_water":
      return `${M.label} is so reactive it reduces the water itself, fizzing off hydrogen — it never gets the chance to displace anything.`;
    default:
      return "";
  }
}

/** Seconds → "1 min 40 s", "0.8 s", "2 h 05 min". */
export function formatModelTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 10) return `${s.toFixed(1)} s`;
  if (s < 60) return `${s.toFixed(0)} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m} min ${Math.floor(s - m * 60).toString().padStart(2, "0")} s`;
  }
  const h = Math.floor(s / 3600);
  return `${h} h ${Math.floor((s - h * 3600) / 60).toString().padStart(2, "0")} min`;
}

// ─── Rusting and sacrificial protection ─────────────────────────────

/** A 50 mm × 2.5 mm mild-steel nail. Everything per-nail comes from this. */
export const NAIL = { lengthMm: 50, diameterMm: 2.5 };
export const IRON_DENSITY_G_PER_MM3 = 7.87e-3;
export const IRON_MOLAR_MASS = 55.85;
export const NAIL_AREA_MM2 = Math.PI * NAIL.diameterMm * NAIL.lengthMm + 2 * Math.PI * (NAIL.diameterMm / 2) ** 2;
export const NAIL_MASS_G = IRON_DENSITY_G_PER_MM3 * Math.PI * (NAIL.diameterMm / 2) ** 2 * NAIL.lengthMm;

/**
 * Mild steel in aerated water loses about 0.13 mm a year off its surface.
 * The hydrated oxide it becomes is loose and far bulkier than the metal it
 * came from — a rust crust stands roughly four times taller than the iron
 * it replaced — and Fe₂O₃·H₂O weighs 1.59× the iron in it.
 */
export const BASE_PENETRATION_MM_PER_DAY = 0.00035;
export const RUST_EXPANSION = 4;
export const RUST_MASS_RATIO = (2 * IRON_MOLAR_MASS + 3 * 16 + 18) / (2 * IRON_MOLAR_MASS);
/** Surface loss at which the nail reads as covered (63%), µm of iron. */
export const COVER_SCALE_UM = 4;

export const ELECTROLYTES = {
  distilled: { key: "distilled", label: "Distilled water", short: "Pure H₂O", factor: 1, conductivity: "≈ 1 µS/cm", title: "Almost no ions, so the corrosion cell is starved of a conductor" },
  saltwater: { key: "saltwater", label: "3% NaCl", short: "Salt water", factor: 3.5, conductivity: "≈ 48 000 µS/cm", title: "Sea-strength brine — a good conductor, so the corrosion cell runs 3.5× faster" },
};

/**
 * The metal wrapped around the nail in the fourth tube, with the same E° the
 * reactivity series uses. `ironFactor` is how much iron corrodes relative to
 * a bare nail, `partnerFactor` how many electrons the partner gives up per
 * electron the bare nail would have — the more reactive anode is driven
 * harder by the larger iron cathode it is protecting.
 *
 * `wrapMassG` is the mass of the SAME ribbon in each metal, so the three
 * tubes differ only in what the wrap is made of: identical dimensions at
 * 7.14 g/cm³ for zinc and 1.74 for magnesium means the magnesium ribbon
 * weighs about a quarter of the zinc one. That is why magnesium, which also
 * drives the harder current, is the first to be used up — exactly the
 * trade-off that decides how often a real anode has to be replaced.
 */
export const PARTNERS = {
  zinc: { key: "zinc", label: "Zinc", symbol: "Zn", charge: 2, molarMass: 65.4, potential: -0.76, ironFactor: 0.02, partnerFactor: 1.6, wrapMassG: 0.5, colour: "#9ea7b3", corroded: "#e6e9ec", protects: true, title: "E° = −0.76 V — more reactive than iron, so it corrodes instead" },
  magnesium: { key: "magnesium", label: "Magnesium", symbol: "Mg", charge: 2, molarMass: 24.3, potential: -2.37, ironFactor: 0.005, partnerFactor: 2.4, wrapMassG: 0.12, colour: "#d0d5dd", corroded: "#f1f3f5", protects: true, title: "E° = −2.37 V — far more reactive; protects harder and is used up faster" },
  copper: { key: "copper", label: "Copper", symbol: "Cu", charge: 2, molarMass: 63.5, potential: 0.34, ironFactor: 2.2, partnerFactor: 0, wrapMassG: 0.5, colour: "#c2703b", corroded: "#c2703b", protects: false, title: "E° = +0.34 V — LESS reactive than iron, so the nail becomes the anode" },
};
export const IRON_POTENTIAL_V = METALS.Fe.potential;

export const TUBES = [
  { key: "open", label: "Water + air", short: "open", o2: true, h2o: true, note: "the control — an ordinary wet nail" },
  { key: "deoxygenated", label: "Boiled water under oil", short: "no O₂", o2: false, h2o: true, note: "boiled to drive the oxygen out, sealed under paraffin so none gets back in" },
  { key: "dry", label: "Desiccant, stoppered", short: "no H₂O", o2: true, h2o: false, note: "anhydrous calcium chloride keeps the air bone dry" },
  { key: "coupled", label: "Nail wrapped in a second metal", short: "coupled", o2: true, h2o: true, note: "water and air like the first tube — but touching another metal" },
];

export const MIN_DAYS = 1;
export const MAX_DAYS = 30;

export const RUST_EQUATIONS = {
  oxidation: "Fe → Fe²⁺ + 2e⁻",
  reduction: "O₂ + 2H₂O + 4e⁻ → 4OH⁻",
  overall: "2Fe + 3⁄2 O₂ + xH₂O → Fe₂O₃·xH₂O",
};

/**
 * Corrosion of one nail. `rateFactor` bundles everything that scales the
 * rate — electrolyte, the coupled partner, and whether both water and
 * oxygen are present at all (if either is missing it is 0, and that is the
 * whole point of tubes 2 and 3).
 */
export function corrodeIron(days, rateFactor) {
  const d = clamp(Number(days) || 0, 0, MAX_DAYS);
  const penetrationMm = BASE_PENETRATION_MM_PER_DAY * rateFactor * d;
  const rustThicknessUm = penetrationMm * 1000 * RUST_EXPANSION;
  const coverage = 1 - Math.exp(-(penetrationMm * 1000) / COVER_SCALE_UM);
  const ironLostG = penetrationMm * NAIL_AREA_MM2 * IRON_DENSITY_G_PER_MM3;
  return {
    penetrationMm,
    rustThicknessUm,
    coverage,
    ironLostMg: ironLostG * 1000,
    ironLostFraction: ironLostG / NAIL_MASS_G,
    rustFormedMg: ironLostG * RUST_MASS_RATIO * 1000,
    electronsMol: (ironLostG / IRON_MOLAR_MASS) * 2,
  };
}

/** The galvanic couple in tube 4. */
export function solveCouple({ days = 7, electrolyte = "distilled", partner = "zinc" } = {}) {
  const P = PARTNERS[partner] ?? PARTNERS.zinc;
  const E = ELECTROLYTES[electrolyte] ?? ELECTROLYTES.distilled;
  const d = clamp(Number(days) || 0, 0, MAX_DAYS);
  const bare = corrodeIron(d, E.factor);
  const deltaE = IRON_POTENTIAL_V - P.potential;

  // The anode is used up at a steady rate, so it lasts a fixed number of
  // days — after which the nail is bare again and corrodes at the full rate.
  // Nothing protects for ever; it protects until the anode is gone.
  const partnerPerDayG = (corrodeIron(1, E.factor).electronsMol * P.partnerFactor / P.charge) * P.molarMass;
  const lifetimeDays = partnerPerDayG > 0 ? P.wrapMassG / partnerPerDayG : Infinity;
  const protectedDays = Math.min(d, lifetimeDays);
  const unprotectedDays = Math.max(0, d - lifetimeDays);
  const partnerLostG = Math.min(P.wrapMassG, partnerPerDayG * d);
  const partnerRemaining = clamp(1 - partnerLostG / P.wrapMassG, 0, 1);
  // `corrodeIron` is linear in days × rate, so the two regimes fold into one
  // mean rate factor over the whole run (a bare nail's is exactly 1).
  const meanFactor = d > 0 ? (P.ironFactor * protectedDays + unprotectedDays) / d : P.ironFactor;
  const iron = corrodeIron(d, E.factor * meanFactor);

  return {
    partner: P,
    protects: P.protects,
    deltaE,
    // Electrons leave whichever metal is higher in the series.
    direction: P.potential < IRON_POTENTIAL_V ? "partner_to_iron" : "iron_to_partner",
    anode: P.potential < IRON_POTENTIAL_V ? P.symbol : "Fe",
    cathode: P.potential < IRON_POTENTIAL_V ? "Fe" : P.symbol,
    iron,
    bare,
    partnerLostMg: partnerLostG * 1000,
    partnerRemainingFraction: partnerRemaining,
    partnerExhausted: partnerRemaining <= 0,
    partnerLifetimeDays: lifetimeDays,
    oxidation: P.protects ? `${P.symbol} → ${ionSymbol(P.symbol, P.charge)} + ${electronsText(P.charge)}` : RUST_EQUATIONS.oxidation,
    reduction: RUST_EQUATIONS.reduction,
    // Magnesium also reduces the water directly; the bubbles are hydrogen.
    bubbleRate: partner === "magnesium" && partnerRemaining > 0 ? 0.5 : 0,
  };
}

/**
 * The whole rack after `days`. Tubes 1–3 answer "does iron need both water
 * and oxygen"; tube 4 answers "what does a second metal do about it".
 */
export function solveRusting({ days = 7, electrolyte = "distilled", partner = "zinc" } = {}) {
  const d = clamp(Number(days) || MIN_DAYS, 0, MAX_DAYS);
  const E = ELECTROLYTES[electrolyte] ?? ELECTROLYTES.distilled;
  const couple = solveCouple({ days: d, electrolyte, partner });

  const tubes = TUBES.map((tube) => {
    const rusts = tube.o2 && tube.h2o;
    let rateFactor = rusts ? E.factor : 0;
    if (tube.key === "coupled") rateFactor *= couple.partnerExhausted ? 1 : couple.partner.ironFactor;
    // Tube 4's nail is the couple's, anode lifetime included.
    const iron = tube.key === "coupled" ? couple.iron : corrodeIron(d, rateFactor);
    return {
      ...tube,
      rusts,
      rateFactor,
      ...iron,
      verdict: !tube.h2o
        ? "no water → no rust"
        : !tube.o2
          ? "no oxygen → no rust"
          : tube.key === "coupled"
            ? couple.protects
              ? couple.partnerExhausted
                ? "anode used up — rusting again"
                : "protected — the partner corrodes instead"
              : "accelerated — the nail is the anode"
            : "rusting",
    };
  });

  const alternatives = Object.fromEntries(
    Object.keys(PARTNERS).map((key) => [key, solveCouple({ days: d, electrolyte, partner: key }).iron.ironLostMg]),
  );

  return {
    days: d,
    electrolyte: E,
    tubes,
    couple,
    alternatives,
    bareIronLostMg: tubes[0].ironLostMg,
    equations: RUST_EQUATIONS,
  };
}

/** "day 12", "day 1". */
export const dayLabel = (days) => `day ${Math.round(Number(days) || MIN_DAYS)}`;
