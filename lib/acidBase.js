// ─── Acids, bases and titration ─────────────────────────────────────
// The chemistry behind the acids-and-bases topic, in two parts.
//
//   • The pH scale and indicators: everyday solutions at their typical pH,
//     and what colour each indicator turns at a given pH. A two-colour
//     indicator is a weak acid HIn ⇌ H⁺ + In⁻ whose two forms differ in
//     colour: the share in the In⁻ form is 1 / (1 + 10^(pKa − pH)), so it
//     changes over about pKa ± 1. Universal indicator is a mixture, read off
//     its chart.
//
//   • Titration: an acid in the flask (25.0 cm³ from a pipette), an alkali
//     run in from the burette. The pH at every volume comes from the
//     solution's charge balance, solved exactly:
//
//         [H⁺] + (cations from the base) = [OH⁻] + (anion charge from the acid)
//
//     with each weak acid or base split between its forms by its Ka. One
//     equation covers strong and weak acids, ammonia, sulfuric acid's
//     second proton, the buffer region (pH = pKa half-way to the
//     equivalence point) and the excess alkali after it.
//
// Everything is at 25 °C (Kw = 1.0 × 10⁻¹⁴). Nothing here touches React
// or three.js.
// ─────────────────────────────────────────────────────────────────────

export const KW = 1e-14;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ─── The pH scale ───────────────────────────────────────────────────

/** Everyday solutions at their typical pH. */
export const SUBSTANCES = {
  stomach: { short: "stomach acid", label: "Stomach acid", pH: 1.5, note: "Hydrochloric acid, made by the stomach lining" },
  lemon: { short: "lemon", label: "Lemon juice", pH: 2.4, note: "Citric acid, a weak acid" },
  vinegar: { short: "vinegar", label: "Vinegar", pH: 2.9, note: "About 5 % ethanoic acid, a weak acid" },
  coffee: { short: "coffee", label: "Black coffee", pH: 5.0, note: "Weakly acidic" },
  rain: { short: "rain", label: "Rainwater", pH: 5.6, note: "Carbon dioxide dissolved from the air makes it slightly acidic" },
  water: { short: "water", label: "Pure water", pH: 7.0, note: "Neutral: [H⁺] = [OH⁻] = 1 × 10⁻⁷ mol/dm³" },
  blood: { short: "blood", label: "Blood", pH: 7.4, note: "Buffered to stay between 7.35 and 7.45" },
  sea: { short: "sea water", label: "Sea water", pH: 8.1, note: "Slightly alkaline, from dissolved carbonates" },
  magnesia: { short: "magnesia", label: "Milk of magnesia", pH: 10.5, note: "Magnesium hydroxide, an antacid" },
  ammonia: { short: "ammonia", label: "Household ammonia", pH: 11.6, note: "Ammonia solution, a weak alkali" },
  oven: { short: "oven cleaner", label: "Oven cleaner", pH: 13.5, note: "Sodium hydroxide, a strong alkali" },
};
export const SUBSTANCE_KEYS = Object.keys(SUBSTANCES);

/** Universal indicator's chart, pH 0 to 14. */
export const UNIVERSAL_CHART = [
  "#c8102e", "#e3262f", "#ef4b26", "#f37021", "#f99d1c", "#fdc70f", "#d7df23", "#4db848",
  "#0f9d58", "#139fa6", "#2a7ab9", "#334c9e", "#4b2f8d", "#5c2483", "#4a1a6b",
];

/** The colours the titration scene draws with, which the Details panel's key names. */
export const ACID_BASE_COLOURS = {
  hydrogen: "#f43f5e",
  hydroxide: "#3b82f6",
  cation: "#a78bfa",
  anion: "#34d399",
  partAnion: "#5eead4",
  acidMolecule: "#fbbf24",
  freeBase: "#e9d5ff",
  water: "#cbd5e1",
  curve: "#38bdf8",
  equivalence: "#fbbf24",
  buffer: "#a78bfa",
};

/** What a clear, colourless solution looks like. */
export const CLEAR = "#dbe9ef";

/**
 * Indicators. A two-colour one changes from `acid` to `alkali` about its
 * pKa; `range` is the pH over which the eye sees the change. A colourless
 * form is null.
 */
export const INDICATORS = {
  universal: { label: "Universal indicator", short: "universal", chart: true, range: [0, 14] },
  litmus: { label: "Litmus", short: "litmus", pKa: 6.5, range: [4.5, 8.3], acid: "#d0312d", alkali: "#3d5fc9" },
  methylOrange: { label: "Methyl orange", short: "methyl orange", pKa: 3.7, range: [3.1, 4.4], acid: "#d7261e", alkali: "#f2c12e" },
  bromothymol: { label: "Bromothymol blue", short: "bromothymol blue", pKa: 7.1, range: [6.0, 7.6], acid: "#e6d32a", alkali: "#2b5fb0" },
  phenolphthalein: { label: "Phenolphthalein", short: "phenolphthalein", pKa: 9.4, range: [8.2, 10.0], acid: null, alkali: "#e0338b" },
};
export const INDICATOR_KEYS = Object.keys(INDICATORS);

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
const mixHex = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
};

/** The share of an indicator in its alkaline form at a pH. */
export const alkalineShare = (pKa, pH) => 1 / (1 + Math.pow(10, pKa - pH));

/**
 * The colour of a solution at `pH` with `indicator` in it: { colour,
 * strength }, strength 0 for colourless (phenolphthalein in acid) up to 1.
 */
export function indicatorColour(indicator, pH) {
  const ind = INDICATORS[indicator] ?? INDICATORS.universal;
  const p = clamp(Number.isFinite(pH) ? pH : 7, 0, 14);
  if (ind.chart) {
    const i = Math.min(13, Math.floor(p));
    return { colour: mixHex(UNIVERSAL_CHART[i], UNIVERSAL_CHART[i + 1], p - i), strength: 1 };
  }
  const f = alkalineShare(ind.pKa, p);
  if (ind.acid === null) return { colour: mixHex(CLEAR, ind.alkali, Math.min(1, f * 1.15)), strength: f };
  return { colour: mixHex(ind.acid, ind.alkali, f), strength: 1 };
}

/** The colour an indicator shows on each side of its change, in words. */
export const INDICATOR_WORDS = {
  universal: { acid: "red / orange", neutral: "green", alkali: "blue / purple" },
  litmus: { acid: "red", neutral: "purple", alkali: "blue" },
  methylOrange: { acid: "red", neutral: "yellow", alkali: "yellow" },
  bromothymol: { acid: "yellow", neutral: "green", alkali: "blue" },
  phenolphthalein: { acid: "colourless", neutral: "colourless", alkali: "pink" },
};

/** Hydrogen-ion concentration at a pH, and how many times pure water's it is. */
export function hydrogenIons(pH) {
  const h = Math.pow(10, -pH);
  return { h, oh: KW / h, timesWater: h / 1e-7 };
}

/** acidic / neutral / alkaline, and strongly or weakly. */
export function describePH(pH) {
  if (Math.abs(pH - 7) < 0.25) return "neutral";
  if (pH < 7) return pH < 3 ? "strongly acidic" : "weakly acidic";
  return pH > 11 ? "strongly alkaline" : "weakly alkaline";
}

// ─── Titration ──────────────────────────────────────────────────────

/**
 * Acids for the flask. `Ka` lists each proton's dissociation constant; a
 * strong acid's first is set huge (it is fully dissociated in water).
 */
export const ACIDS = {
  hcl: { label: "Hydrochloric acid", formula: "HCl", Ka: [1e7], strong: true, anion: "Cl⁻" },
  ethanoic: { label: "Ethanoic acid", formula: "CH₃COOH", Ka: [1.75e-5], strong: false, anion: "CH₃COO⁻" },
  sulfuric: { label: "Sulfuric acid", formula: "H₂SO₄", Ka: [1e3, 1.2e-2], strong: true, anion: "SO₄²⁻" },
};
export const ACID_KEYS = Object.keys(ACIDS);

/** Alkalis for the burette. `KaConj` is the Ka of a weak base's conjugate acid (NH₄⁺). */
export const BASES = {
  naoh: { label: "Sodium hydroxide", formula: "NaOH", strong: true, cation: "Na⁺" },
  ammonia: { label: "Ammonia solution", formula: "NH₃", strong: false, KaConj: KW / 1.8e-5, cation: "NH₄⁺" },
};
export const BASE_KEYS = Object.keys(BASES);

/** Pipetted into the flask, cm³. */
export const FLASK_VOLUME = 25.0;
/** What the burette holds, cm³. */
export const BURETTE_VOLUME = 50.0;
/** One drop from a burette, cm³. */
export const DROP = 0.05;

export const ACID_CONC_RANGE = [0.05, 0.1];
export const BASE_CONC_RANGE = [0.1, 0.2];
/**
 * Sulfuric acid gives two H⁺ per molecule, so it needs twice the alkali:
 * its range is half the others', which keeps its end point inside the
 * burette at every setting (at most 25 cm³).
 */
export const SULFURIC_CONC_RANGE = [0.025, 0.05];

const inRange = (v, [lo, hi], fallback) => clamp(typeof v === "number" && Number.isFinite(v) ? v : fallback, lo, hi);

/**
 * The titration a topic's params describe: which acid and alkali, and the
 * acid's concentration from the slider that applies to it (sulfuric acid
 * has its own). The scene and the Details panel both build from this.
 */
export function titrationSetup({ acid, acidConc, sulfuricConc, base, baseConc } = {}) {
  const acidKey = ACIDS[acid] ? acid : "hcl";
  const baseKey = BASES[base] ? base : "naoh";
  return {
    acid: acidKey,
    acidConc: acidKey === "sulfuric" ? inRange(sulfuricConc, SULFURIC_CONC_RANGE, 0.05) : inRange(acidConc, ACID_CONC_RANGE, 0.1),
    base: baseKey,
    baseConc: inRange(baseConc, BASE_CONC_RANGE, 0.1),
  };
}

/** Mean negative charge on one molecule of a polyprotic acid at [H⁺] = h, and the share in each form. */
export function acidForms(Ka, h) {
  // terms[i] ∝ the share that has lost i protons: Ka1…Kai · h^(n−i)
  const n = Ka.length;
  const logs = [n * Math.log(h)];
  for (let i = 1; i <= n; i += 1) logs.push(logs[i - 1] + Math.log(Ka[i - 1]) - Math.log(h));
  const top = Math.max(...logs);
  const w = logs.map((l) => Math.exp(l - top));
  const sum = w.reduce((a, b) => a + b, 0);
  const shares = w.map((x) => x / sum);
  return { shares, charge: shares.reduce((s, a, i) => s + i * a, 0) };
}

/** Positive charge per mole of base at [H⁺] = h. */
const baseCharge = (base, h) => (base.strong ? 1 : h / (h + base.KaConj));

/**
 * pH of a solution holding acid at `Ca` and base at `Cb` (mol/dm³ after
 * mixing), from the charge balance, by bisection on log[H⁺].
 */
export function solvePH(acidKey, Ca, baseKey, Cb) {
  const acid = ACIDS[acidKey] ?? ACIDS.hcl;
  const base = BASES[baseKey] ?? BASES.naoh;
  const f = (lh) => {
    const h = Math.pow(10, lh);
    return h + Cb * baseCharge(base, h) - KW / h - Ca * acidForms(acid.Ka, h).charge;
  };
  let lo = -15;
  let hi = 1;
  // f rises with h: negative means too little H⁺
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return -(lo + hi) / 2;
}

/** Volume of alkali that exactly neutralises the acid, cm³. */
export function equivalenceVolume({ acid = "hcl", acidConc = 0.1, baseConc = 0.1 } = {}) {
  const a = ACIDS[acid] ?? ACIDS.hcl;
  return (a.Ka.length * acidConc * FLASK_VOLUME) / baseConc;
}

/**
 * The flask after `volume` cm³ of alkali: pH, the concentration of each
 * species, and the moles of acid and alkali.
 */
export function titrationPoint({ acid = "hcl", acidConc = 0.1, base = "naoh", baseConc = 0.1, volume = 0 } = {}) {
  const a = ACIDS[acid] ?? ACIDS.hcl;
  const b = BASES[base] ?? BASES.naoh;
  const vb = clamp(Number(volume) || 0, 0, BURETTE_VOLUME);
  const total = FLASK_VOLUME + vb;
  const Ca = (acidConc * FLASK_VOLUME) / total;
  const Cb = (baseConc * vb) / total;
  const pH = solvePH(acid, Ca, base, Cb);
  const h = Math.pow(10, -pH);
  const forms = acidForms(a.Ka, h);
  const bonded = b.strong ? 1 : baseCharge(b, h);
  return {
    volume: vb,
    totalVolume: total,
    pH,
    h,
    oh: KW / h,
    // shares of the acid that have lost 0, 1, 2 protons
    acidShares: forms.shares,
    acidConc: Ca,
    baseConc: Cb,
    // the base: as its cation (Na⁺ or NH₄⁺) and, for ammonia, as NH₃
    cation: Cb * bonded,
    freeBase: Cb * (1 - bonded),
    molesAcid: (acidConc * FLASK_VOLUME) / 1000,
    molesBase: (baseConc * vb) / 1000,
  };
}

/** The whole curve, pH against volume, from 0 to the burette's 50 cm³. */
export function titrationCurve(opts, steps = 400) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const v = (i / steps) * BURETTE_VOLUME;
    return { v, pH: titrationPoint({ ...opts, volume: v }).pH };
  });
}

/**
 * Where an indicator changes colour (its pKa reached), cm³, and how far
 * that is from the equivalence point. Universal indicator has no single
 * end point.
 */
export function endPoint(opts, indicator) {
  const ind = INDICATORS[indicator];
  const veq = equivalenceVolume(opts);
  if (!ind || ind.chart) return { volume: null, error: null, suitable: false, reason: "changes gradually across the whole range, so it shows no sharp end point" };
  const pHat = (v) => titrationPoint({ ...opts, volume: v }).pH;
  if (pHat(0) >= ind.pKa) return { volume: 0, error: -veq, suitable: false, reason: "has changed before any alkali goes in" };
  if (pHat(BURETTE_VOLUME) < ind.pKa) return { volume: null, error: null, suitable: false, reason: "never reaches its colour change within the burette" };
  let lo = 0;
  let hi = BURETTE_VOLUME;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (pHat(mid) < ind.pKa) lo = mid;
    else hi = mid;
  }
  const v = (lo + hi) / 2;
  const error = v - veq;
  // within two drops of the true equivalence point
  const suitable = Math.abs(error) <= 2 * DROP;
  let reason;
  if (suitable) reason = "changes within the steep jump, at the equivalence point";
  else if (error < 0) reason = `changes ${Math.abs(error).toFixed(2)} cm³ too early, before the equivalence point`;
  else reason = `changes ${error.toFixed(2)} cm³ too late, after the equivalence point`;
  return { volume: v, error, suitable, reason };
}

/**
 * The pH jump at the equivalence point: pH one drop before and one drop
 * after. Strong-with-strong jumps several units; a weak acid with a weak
 * base barely moves.
 */
export function equivalenceJump(opts) {
  const veq = equivalenceVolume(opts);
  const before = titrationPoint({ ...opts, volume: Math.max(0, veq - DROP) }).pH;
  const after = titrationPoint({ ...opts, volume: Math.min(BURETTE_VOLUME, veq + DROP) }).pH;
  return { before, after, size: after - before, atEquivalence: titrationPoint({ ...opts, volume: veq }).pH };
}

/**
 * The particles the magnified view shows: counts in proportion to the
 * moles in the flask, `per` dots for the acid's protons at the start.
 */
export function particleCounts(point, { acid = "hcl", base = "naoh" } = {}, per = 24) {
  const a = ACIDS[acid] ?? ACIDS.hcl;
  const b = BASES[base] ?? BASES.naoh;
  const nProtons = point.molesAcid * a.Ka.length;
  const k = per / nProtons;
  const litres = point.totalVolume / 1000;
  const mol = (c) => c * litres;
  const r = (x) => Math.max(0, Math.round(x));
  const sh = point.acidShares;
  const molAcid = point.molesAcid;
  const counts = {
    hydrogen: r(mol(point.h) * k),
    hydroxide: r(mol(point.oh) * k),
    cation: r(mol(point.cation) * k),
    freeBase: r(mol(point.freeBase) * k),
    acidMolecule: a.strong ? 0 : r(molAcid * sh[0] * k),
    // for sulfuric acid, HSO₄⁻ and SO₄²⁻; otherwise the one anion
    anion: r(molAcid * sh[sh.length - 1] * k),
    partAnion: sh.length > 2 ? r(molAcid * sh[1] * k) : 0,
  };
  counts.water = Math.max(0, Math.round(Math.min(point.molesBase, nProtons) * k));
  counts.labels = { cation: b.cation, anion: a.anion, acidMolecule: a.formula, partAnion: "HSO₄⁻", freeBase: "NH₃" };
  return counts;
}
