// ─── Radioactive decay modes and half-life ──────────────────────────
// A population of unstable nuclei, four ways for one to decay, and the
// two claims the scene exists to prove:
//
//   conservation   in every decay the nucleon number A and the charge Z
//                  add up on both sides. An alpha takes 4 and 2 with it;
//                  a β⁻ turns a neutron into a proton (Z up one, A the
//                  same) and a β⁺ does the reverse; a gamma takes only
//                  energy, so the nuclide does not change at all. The
//                  equation is built from the nuclide data and checked,
//                  not typed in.
//
//   randomness     no nucleus knows how old it is. Each undecayed atom
//                  has the SAME probability of decaying in the next
//                  instant, 1 − e^(−λ dt), and that is the whole model —
//                  every atom rolls its own die every frame. N(t) = N₀e^(−λt)
//                  is not put in; it comes out, and it comes out better
//                  the bigger the sample. A hundred atoms give a jagged
//                  curve whose "half-lives" scatter; ten thousand give the
//                  textbook exponential, which is the statistical point.
//
// Real half-lives run from minutes to billions of years, so the sample
// decays on a SIM clock — one half-life is ten seconds on screen — and
// the readout says what one on-screen second is worth for the isotope.
// `stepDecay` is the only integrator and takes its random source as an
// argument so a test can seed it.
// ─────────────────────────────────────────────────────────────────────

export const SIM_HALF_LIFE_S = 10;
export const LAMBDA = Math.LN2 / SIM_HALF_LIFE_S;
export const MIN_ATOMS = 100;
export const MAX_ATOMS = 10000;
export const DEFAULT_ATOMS = 2000;
/** The decay curve is drawn over this many half-lives; by then 1.6% is left. */
export const CURVE_HALF_LIVES = 6;
/** Count-rate window for the Geiger readout, sim seconds. */
export const RATE_WINDOW_S = 1;
const RATE_BINS = 10;

const YEAR_S = 365.25 * 86400;

// ─── The modes ──────────────────────────────────────────────────────

export const MODES = {
  alpha: {
    label: "Alpha (α)",
    short: "α",
    parent: { symbol: "U", name: "uranium-238", A: 238, Z: 92 },
    daughter: { symbol: "Th", name: "thorium-234", A: 234, Z: 90 },
    emissions: [{ kind: "alpha", symbol: "He", display: "α", name: "alpha particle", A: 4, Z: 2, charge: 2, massU: 4.0026 }],
    halfLife: { value: 4.468e9, unit: "years", seconds: 4.468e9 * YEAR_S },
    speedOfLight: 0.05,
    ionising: "very high",
    range: "a few cm of air; stopped by paper or skin",
    note: "A helium nucleus — two protons, two neutrons — thrown out of a heavy nucleus that has too many of both. Massive and doubly charged, it ionises everything it brushes past and is spent within centimetres.",
    colour: "#fb7185",
  },
  beta_minus: {
    label: "Beta-minus (β⁻)",
    short: "β⁻",
    parent: { symbol: "C", name: "carbon-14", A: 14, Z: 6 },
    daughter: { symbol: "N", name: "nitrogen-14", A: 14, Z: 7 },
    emissions: [
      { kind: "beta_minus", symbol: "e", display: "β⁻", name: "electron", A: 0, Z: -1, charge: -1, massU: 0.00055 },
      { kind: "neutrino", symbol: "ν̄ₑ", display: "ν̄ₑ", name: "electron antineutrino", A: 0, Z: 0, charge: 0, massU: 0 },
    ],
    halfLife: { value: 5730, unit: "years", seconds: 5730 * YEAR_S },
    // Carbon-14's betas are soft: 156 keV at most, 49 keV on average — about 0.41 c.
    speedOfLight: 0.41,
    ionising: "moderate",
    range: "up to about 20 cm of air (carbon-14's betas are soft); stopped by well under 1 mm of aluminium",
    note: "A neutron in the nucleus becomes a proton, and the electron that balances the charge leaves fast — about 40% of light speed on average for carbon-14 — with an antineutrino that shares the energy. Z goes up by one; A does not change — this is the decay behind radiocarbon dating.",
    colour: "#38bdf8",
  },
  beta_plus: {
    label: "Beta-plus (β⁺)",
    short: "β⁺",
    parent: { symbol: "F", name: "fluorine-18", A: 18, Z: 9 },
    daughter: { symbol: "O", name: "oxygen-18", A: 18, Z: 8 },
    emissions: [
      { kind: "beta_plus", symbol: "e", display: "β⁺", name: "positron", A: 0, Z: 1, charge: 1, massU: 0.00055 },
      { kind: "neutrino", symbol: "νₑ", display: "νₑ", name: "electron neutrino", A: 0, Z: 0, charge: 0, massU: 0 },
    ],
    halfLife: { value: 109.77, unit: "minutes", seconds: 109.77 * 60 },
    // 634 keV at most, 250 keV on average — about 0.74 c.
    speedOfLight: 0.74,
    ionising: "moderate",
    range: "up to about 2 m of air; stopped by 2 mm of aluminium — then meets an electron and annihilates into two 511 keV gamma photons",
    note: "A proton becomes a neutron and the nucleus emits a positron — the electron's antiparticle — with a neutrino. Z goes DOWN by one. Fluorine-18's positrons are what a PET scanner images, which is why its 110-minute half-life matters in a hospital.",
    colour: "#fb923c",
  },
  gamma: {
    label: "Gamma (γ)",
    short: "γ",
    parent: { symbol: "Tc", name: "technetium-99m", A: 99, Z: 43, metastable: true },
    daughter: { symbol: "Tc", name: "technetium-99", A: 99, Z: 43 },
    emissions: [{ kind: "gamma", symbol: "γ", display: "γ", name: "gamma photon", A: 0, Z: 0, charge: 0, massU: 0 }],
    halfLife: { value: 6.01, unit: "hours", seconds: 6.01 * 3600 },
    speedOfLight: 1,
    ionising: "low",
    range: "hundreds of metres of air; halved by every 0.3 mm of lead — reduced, never quite stopped",
    note: "The nucleus was left in an excited state by an earlier decay and sheds the surplus energy as a photon. No particle of matter leaves, so A and Z are unchanged: technetium-99m simply becomes technetium-99. It is the most used medical tracer for that reason.",
    colour: "#a78bfa",
  },
};

export const MODE_ORDER = ["alpha", "beta_minus", "beta_plus", "gamma"];
export const modeFor = (id) => MODES[id] ?? MODES.alpha;

/** How the emitted particles are drawn — one entry per emission kind. */
export const PARTICLE_KINDS = {
  alpha: { colour: "#fb7185", size: 0.075, speed: 3.4, charge: 2, massU: 4.0026, label: "α" },
  beta_minus: { colour: "#38bdf8", size: 0.045, speed: 6.2, charge: -1, massU: 0.00055, label: "β⁻" },
  beta_plus: { colour: "#fb923c", size: 0.045, speed: 7.5, charge: 1, massU: 0.00055, label: "β⁺" },
  gamma: { colour: "#a78bfa", size: 0.055, speed: 9.5, charge: 0, massU: 0, label: "γ" },
  neutrino: { colour: "#64748b", size: 0.028, speed: 9.5, charge: 0, massU: 0, label: "ν" },
};

/** How the sample's nuclei are drawn: gold before, slate once decayed (the HUD key uses the same two). */
export const PARENT_COLOUR = "#fbbf24";
export const DAUGHTER_COLOUR = "#3b4658";

// ─── Barriers and plates ────────────────────────────────────────────

export const BARRIERS = {
  paper: { label: "Paper", thickness: "a sheet", thicknessMm: 0.1, stops: ["alpha"], colour: "#f4f1e6" },
  aluminium: { label: "Aluminium", thickness: "5 mm", thicknessMm: 5, stops: ["alpha", "beta_minus", "beta_plus"], colour: "#b8c0cc" },
  lead: { label: "Lead", thickness: "3 mm", thicknessMm: 3, stops: ["alpha", "beta_minus", "beta_plus", "gamma"], colour: "#4b5563" },
};
export const BARRIER_ORDER = ["paper", "aluminium", "lead"];
export const barrierFor = (id) => BARRIERS[id] ?? BARRIERS.paper;

/**
 * The fraction of particles of this kind that get through the barrier.
 * Alpha and beta are stopped outright by anything on their list — a
 * sheet of paper is many times an alpha's range, 5 mm of aluminium many
 * times a beta's. Gamma is never stopped, only attenuated, so it is a
 * fraction, e^(−μx) at technetium-99m's 140 keV: nearly all through
 * paper, 83% through 5 mm of aluminium (μ ≈ 0.37 /cm), one in a thousand
 * through 3 mm of lead (μ ≈ 23 /cm, ten half-value layers). Thicker lead
 * would leave nothing to see. Neutrinos get through everything.
 */
export function transmission(kind, barrierId) {
  if (kind === "neutrino") return 1;
  const b = barrierFor(barrierId);
  if (kind === "gamma") return { paper: 1, aluminium: 0.83, lead: 0.001 }[barrierId] ?? 1;
  return b.stops.includes(kind) ? 0 : 1;
}

/** Does this kind get through the barrier, for the words — "most of it" counts as yes. */
export function penetrates(kind, barrierId) {
  return transmission(kind, barrierId) >= 0.5;
}

/**
 * The transverse push the field plates give a particle, in scene units of
 * sideways travel across the plate span. Positive plate on top, negative
 * below — so a positive alpha is pulled DOWN, a negative beta pushed UP,
 * and a positive positron down like the alpha but, at 1/7000 of the mass,
 * far further. Gamma and neutrinos carry no charge and go straight.
 */
export function deflection(kind, fieldOn) {
  if (!fieldOn) return { direction: 0, magnitude: 0, reason: "field off" };
  const k = PARTICLE_KINDS[kind];
  if (!k || k.charge === 0) return { direction: 0, magnitude: 0, reason: "no charge — the field cannot touch it" };
  // Force ∝ charge, acceleration ∝ charge/mass; the numbers here are the
  // drawn deflections, not the physical ones (a real beta would leave the
  // plates entirely).
  const magnitude = kind === "alpha" ? 0.42 : 1.35;
  const direction = k.charge > 0 ? -1 : 1;
  return { direction, magnitude, reason: k.charge > 0 ? "positive — pulled toward the negative plate below" : "negative — pulled toward the positive plate above" };
}

// ─── Nuclear equations ──────────────────────────────────────────────

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻", "+": "⁺" };
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "-": "₋", "+": "₊" };
const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");
const subs = (n) => String(n).split("").map((c) => SUB[c] ?? c).join("");

/** "²³⁸₉₂U" — mass number up (with an ᵐ for a metastable state), atomic number down, then the symbol. */
export function nuclideSymbol({ symbol, A, Z, metastable }) {
  return `${sup(A)}${metastable ? "ᵐ" : ""}${subs(Z)}${symbol}`;
}

/** The balanced equation and its conservation check, both computed from the nuclide data. */
export function nuclearEquation(modeId) {
  const m = modeFor(modeId);
  const right = [m.daughter, ...m.emissions];
  const text = `${nuclideSymbol(m.parent)} → ${right.map((n) => (n.kind === "neutrino" ? n.display : n.kind === "gamma" ? "γ" : nuclideSymbol(n))).join(" + ")}`;
  const sumA = right.reduce((s, n) => s + n.A, 0);
  const sumZ = right.reduce((s, n) => s + n.Z, 0);
  return {
    text,
    left: { A: m.parent.A, Z: m.parent.Z },
    right: { A: sumA, Z: sumZ },
    conservedA: sumA === m.parent.A,
    conservedZ: sumZ === m.parent.Z,
    deltaZ: m.daughter.Z - m.parent.Z,
    deltaA: m.daughter.A - m.parent.A,
  };
}

// ─── The sample ─────────────────────────────────────────────────────

export function createDecayState(n0) {
  const n = Math.max(1, Math.min(MAX_ATOMS, Math.round(n0)));
  return {
    n0: n,
    alive: n,
    t: 0,
    /** 0 = parent, 1 = decayed. Shared with the scene, which colours by it. */
    status: new Uint8Array(n),
    /** Sim time at which N first fell to N₀/2, N₀/4, N₀/8 … */
    halfLifeMarks: [],
    /** Indices that decayed in the LAST step — the scene emits a tracer for each. */
    decayedNow: [],
    totalDecays: 0,
    rateBins: new Float32Array(RATE_BINS),
    rateBinT: 0,
    finished: false,
  };
}

/**
 * One step of sim time `dt`. Every surviving atom decays with probability
 * 1 − e^(−λ dt), independently. `rng` is any () → [0,1).
 *
 * The status array is mutated in place — it is the size of the sample and
 * copying ten thousand bytes a frame would be silly — but every scalar is
 * returned fresh, so the caller's old state object is never changed.
 */
export function stepDecay(state, { dt, rng = Math.random }) {
  const step = Math.max(0, dt);
  const p = 1 - Math.exp(-LAMBDA * step);
  const status = state.status;
  const decayedNow = [];
  let alive = state.alive;
  if (step > 0 && alive > 0) {
    for (let i = 0; i < status.length; i += 1) {
      if (status[i] === 0 && rng() < p) {
        status[i] = 1;
        alive -= 1;
        decayedNow.push(i);
      }
    }
  }
  const t = state.t + step;

  // Half-life stamps: the first time N drops to each successive half.
  const halfLifeMarks = state.halfLifeMarks.slice();
  while (halfLifeMarks.length < 14 && alive <= state.n0 / Math.pow(2, halfLifeMarks.length + 1) && alive >= 0) {
    if (state.n0 / Math.pow(2, halfLifeMarks.length + 1) < 0.5) break;
    halfLifeMarks.push(t);
  }

  // The count-rate window: ten bins of a tenth of a second.
  const rateBins = state.rateBins;
  let rateBinT = state.rateBinT + step;
  rateBins[0] += decayedNow.length;
  const binWidth = RATE_WINDOW_S / RATE_BINS;
  while (rateBinT >= binWidth) {
    for (let b = RATE_BINS - 1; b > 0; b -= 1) rateBins[b] = rateBins[b - 1];
    rateBins[0] = 0;
    rateBinT -= binWidth;
  }

  return {
    ...state,
    alive,
    t,
    decayedNow,
    totalDecays: state.totalDecays + decayedNow.length,
    halfLifeMarks,
    rateBins,
    rateBinT,
    finished: alive === 0,
  };
}

/** The textbook curve, for the dashed line the measured one is judged against. */
export const theoreticalN = (n0, t) => n0 * Math.exp(-LAMBDA * t);

/** Activity from the survivors: A = λN, decays per sim second. */
export const activityBq = (alive) => LAMBDA * alive;

/** Decays counted in the last second of sim time. */
export function measuredRate(state) {
  let sum = 0;
  for (let b = 0; b < RATE_BINS; b += 1) sum += state.rateBins[b];
  return sum / RATE_WINDOW_S;
}

/** The gaps between successive half-life stamps — every one should be about SIM_HALF_LIFE_S. */
export function halfLifeIntervals(marks) {
  const out = [];
  for (let i = 0; i < marks.length; i += 1) out.push(marks[i] - (i === 0 ? 0 : marks[i - 1]));
  return out;
}

// ─── Time scale ─────────────────────────────────────────────────────

/** Seconds of real time that one second of sim time stands for, for this isotope. */
export const realSecondsPerSimSecond = (modeId) => modeFor(modeId).halfLife.seconds / SIM_HALF_LIFE_S;

/** "4.47 billion years", "5 730 years", "110 minutes", "6.0 hours", "36 seconds". */
export function formatDuration(seconds) {
  const s = Math.abs(seconds);
  const fmt = (v, unit) => {
    const n = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
    return `${n.toLocaleString("en-GB")} ${unit}`;
  };
  if (s >= 1e9 * YEAR_S) return fmt(s / (1e9 * YEAR_S), "billion years");
  if (s >= 1e6 * YEAR_S) return fmt(s / (1e6 * YEAR_S), "million years");
  if (s >= 2 * YEAR_S) return fmt(s / YEAR_S, "years");
  if (s >= 2 * 86400) return fmt(s / 86400, "days");
  if (s >= 2 * 3600) return fmt(s / 3600, "hours");
  if (s >= 120) return fmt(s / 60, "minutes");
  return fmt(s, "seconds");
}

/** The half-life as the syllabus prints it. */
export function halfLifeLabel(modeId) {
  const m = modeFor(modeId);
  return formatDuration(m.halfLife.seconds);
}

/** The words for the readout: where the sample is in its decay. */
export function describeSample(state, modeId) {
  const m = modeFor(modeId);
  const frac = state.n0 > 0 ? state.alive / state.n0 : 0;
  const halves = state.t / SIM_HALF_LIFE_S;
  if (state.alive === 0) return `Every ${m.parent.name} nucleus has decayed after ${halves.toFixed(1)} half-lives. The last few went at random moments — the curve never quite reaches zero on paper, but a finite sample does.`;
  if (halves < 0.05) return `A fresh sample of ${state.n0.toLocaleString("en-GB")} ${m.parent.name} nuclei. Each one has the same chance of decaying in the next second, whatever its neighbours do.`;
  const expected = theoreticalN(state.n0, state.t);
  const dev = state.n0 > 0 ? ((state.alive - expected) / state.n0) * 100 : 0;
  const scatter = Math.abs(dev) < 1 ? "within 1% of" : Math.abs(dev) < 3 ? `${Math.abs(dev).toFixed(1)}% ${dev > 0 ? "above" : "below"}` : `${Math.abs(dev).toFixed(1)}% ${dev > 0 ? "above" : "below"} — small samples scatter more —`;
  return `${(frac * 100).toFixed(1)}% of the ${m.parent.name} remains after ${halves.toFixed(2)} half-lives, ${scatter} the N₀e^(−λt) prediction of ${Math.round(expected).toLocaleString("en-GB")}. Activity has fallen with it: fewer nuclei, fewer decays per second.`;
}
