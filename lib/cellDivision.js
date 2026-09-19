// ─── Mitosis and meiosis ────────────────────────────────────────────
// The biology behind the cell-division scene, built to keep apart two
// things students run together:
//
//   SISTER CHROMATIDS     the two identical copies of ONE chromosome, made in
//                         S phase and joined at the centromere. Same colour,
//                         same genes, same alleles. Mitosis and meiosis II
//                         pull THESE apart.
//   HOMOLOGOUS CHROMOSOMES  the two DIFFERENT chromosomes of a pair — one
//                         from each parent (red maternal, blue paternal here),
//                         same genes, possibly different alleles. Only
//                         meiosis I pairs them (synapsis), lets them swap arms
//                         (crossing over at chiasmata) and pulls THEM apart.
//
// The model cell is 2n = 4: two homologous pairs, one long and one short.
// Everything a scene or a readout wants — which stage, how many cells,
// chromosomes and chromatids there are, where the chiasmata sit, which
// parent a given stretch of a chromatid now comes from, and a continuous
// "pose" for the animation — is a pure function of the mode, the clock
// and the crossover count. Nothing here knows about three.js or React.
// ─────────────────────────────────────────────────────────────────────

import { clamp, describeCycle, makeCycle, smoothstep, stageBlend, wrapTime } from "./stageCycle.js";

/** Haploid number: n = 2, so the diploid cell has 2n = 4 chromosomes. */
export const HAPLOID_N = 2;
export const DIPLOID_2N = HAPLOID_N * 2;

/** Crossover events the slider can ask for across the two bivalents. */
export const MAX_CHIASMATA = 4;

export const PARENTS = {
  maternal: { key: "maternal", label: "Maternal", colour: "#f43f5e" },
  paternal: { key: "paternal", label: "Paternal", colour: "#3b82f6" },
};

/** The two homologous pairs; `length` is relative arm length, `centromere` the p:q split. */
export const PAIRS = [
  { key: "one", label: "Chromosome 1", length: 1.0, centromere: 0.42 },
  { key: "two", label: "Chromosome 2", length: 0.62, centromere: 0.5 },
];

export const MODES = {
  mitosis: {
    key: "mitosis",
    label: "Mitosis — equational, somatic",
    short: "Mitosis",
    divisions: 1,
    product: "2 genetically identical diploid cells (2n = 4)",
    separates: "sister chromatids",
    purpose: "growth, repair, asexual reproduction",
  },
  meiosis: {
    key: "meiosis",
    label: "Meiosis I & II — reductional, gamete-forming",
    short: "Meiosis I & II",
    divisions: 2,
    product: "4 genetically different haploid gametes (n = 2)",
    separates: "homologous chromosomes (I), then sister chromatids (II)",
    purpose: "gamete formation — halves the chromosome number",
  },
};

export const modeFor = (key) => MODES[key] ?? MODES.mitosis;

// ─── Stages ─────────────────────────────────────────────────────────

/**
 * Durations are sim seconds at 1× speed; `hold` is where in the stage the
 * stepper parks — the textbook picture of that stage.
 */
const stage = (key, label, short, phase, division, duration, hold) => ({ key, label, short, phase, division, duration, hold });

export const MITOSIS_STAGES = [
  stage("interphase", "Interphase (G2) — chromosomes already replicated", "Interphase G2", "interphase", 1, 3.0, 0.55),
  stage("prophase", "Prophase — chromatin condenses, spindle forms", "Prophase", "prophase", 1, 3.2, 0.82),
  stage("metaphase", "Metaphase — chromosomes on the equatorial plate", "Metaphase", "metaphase", 1, 2.6, 0.85),
  stage("anaphase", "Anaphase — sister chromatids pulled to opposite poles", "Anaphase", "anaphase", 1, 2.6, 0.6),
  stage("telophase", "Telophase — two nuclei re-form", "Telophase", "telophase", 1, 2.4, 0.75),
  stage("cytokinesis", "Cytokinesis — the cell pinches in two", "Cytokinesis", "cytokinesis", 1, 2.6, 0.8),
];

export const MEIOSIS_STAGES = [
  stage("interphase", "Interphase (G2) — chromosomes already replicated", "Interphase G2", "interphase", 1, 3.0, 0.55),
  stage("prophase1", "Prophase I — homologues pair (synapsis), crossing over at chiasmata", "Prophase I", "prophase", 1, 4.0, 0.85),
  stage("metaphase1", "Metaphase I — bivalents line up, homologues on either side of the plate", "Metaphase I", "metaphase", 1, 2.6, 0.85),
  stage("anaphase1", "Anaphase I — HOMOLOGUES separate; sister chromatids stay together", "Anaphase I", "anaphase", 1, 2.6, 0.6),
  stage("telophase1", "Telophase I — two haploid nuclei, each chromosome still two chromatids", "Telophase I", "telophase", 1, 2.2, 0.75),
  stage("cytokinesis1", "Cytokinesis I — two haploid cells (n = 2)", "Cytokinesis I", "cytokinesis", 1, 2.4, 0.8),
  stage("prophase2", "Prophase II — no replication, no pairing; spindles form again", "Prophase II", "prophase", 2, 2.4, 0.82),
  stage("metaphase2", "Metaphase II — chromosomes line up singly on each plate", "Metaphase II", "metaphase", 2, 2.4, 0.85),
  stage("anaphase2", "Anaphase II — SISTER CHROMATIDS separate at last", "Anaphase II", "anaphase", 2, 2.6, 0.6),
  stage("telophase2", "Telophase II — four haploid nuclei", "Telophase II", "telophase", 2, 2.2, 0.75),
  stage("cytokinesis2", "Cytokinesis II — four genetically different gametes", "Cytokinesis II", "cytokinesis", 2, 2.6, 0.8),
];

export const MITOSIS_CYCLE = makeCycle(MITOSIS_STAGES);
export const MEIOSIS_CYCLE = makeCycle(MEIOSIS_STAGES);

export const cycleFor = (mode) => (modeFor(mode).key === "meiosis" ? MEIOSIS_CYCLE : MITOSIS_CYCLE);
export const stagesFor = (mode) => cycleFor(mode).stages;

/** Colchicine arrests at (the first) metaphase: the spindle checkpoint can never be satisfied without a spindle. */
export const arrestIndexFor = (mode) => cycleFor(mode).byKey[modeFor(mode).key === "meiosis" ? "metaphase1" : "metaphase"].index;

/** The colchicine button is a counter; odd presses apply the drug, even ones wash it out. */
export const colchicineApplied = (count) => (Math.max(0, Math.round(Number(count) || 0)) % 2) === 1;

// ─── Census ─────────────────────────────────────────────────────────

/**
 * How many cells, and what each holds, at a stage. The number that trips
 * students up is chromatids: a chromosome is ONE chromosome whether it is
 * one chromatid or two joined at a centromere. Counting centromeres counts
 * chromosomes; counting arms-pairs counts chromatids.
 */
export function census(mode, stageRef) {
  const m = modeFor(mode);
  const cycle = cycleFor(m.key);
  const s = typeof stageRef === "number" ? cycle.stages[clamp(Math.round(stageRef), 0, cycle.stages.length - 1)] : cycle.byKey[stageRef];
  if (!s) throw new Error(`cellDivision: unknown stage ${stageRef}`);
  const replicated = { chromosomes: DIPLOID_2N, chromatids: DIPLOID_2N * 2 };

  if (m.key === "mitosis") {
    switch (s.phase) {
      case "interphase":
      case "prophase":
      case "metaphase":
        return { cells: 1, nuclei: 1, ploidy: "2n", perCell: { ...replicated, setLabel: `2n = ${DIPLOID_2N}` }, chromatidsPerChromosome: 2, separating: null, cellLabel: "one diploid cell" };
      case "anaphase":
        return { cells: 1, nuclei: 0, ploidy: "2n → 2n", perCell: { chromosomes: DIPLOID_2N * 2, chromatids: DIPLOID_2N * 2, setLabel: `${DIPLOID_2N} + ${DIPLOID_2N} daughter chromosomes` }, chromatidsPerChromosome: 1, separating: "sister chromatids", cellLabel: "one cell, two sets moving apart" };
      case "telophase":
        return { cells: 1, nuclei: 2, ploidy: "2n", perCell: { chromosomes: DIPLOID_2N, chromatids: DIPLOID_2N, setLabel: `2n = ${DIPLOID_2N} in each nucleus` }, chromatidsPerChromosome: 1, separating: null, cellLabel: "one cell, two nuclei" };
      default:
        return { cells: 2, nuclei: 2, ploidy: "2n", perCell: { chromosomes: DIPLOID_2N, chromatids: DIPLOID_2N, setLabel: `2n = ${DIPLOID_2N} in each cell` }, chromatidsPerChromosome: 1, separating: null, cellLabel: "two identical diploid cells" };
    }
  }

  // Meiosis.
  if (s.division === 1) {
    switch (s.phase) {
      case "interphase":
        return { cells: 1, nuclei: 1, ploidy: "2n", perCell: { ...replicated, setLabel: `2n = ${DIPLOID_2N}` }, chromatidsPerChromosome: 2, separating: null, cellLabel: "one diploid cell" };
      case "prophase":
      case "metaphase":
        return { cells: 1, nuclei: s.phase === "prophase" ? 1 : 0, ploidy: "2n", perCell: { ...replicated, bivalents: HAPLOID_N, setLabel: `2n = ${DIPLOID_2N} as ${HAPLOID_N} bivalents` }, chromatidsPerChromosome: 2, separating: null, cellLabel: "one diploid cell" };
      case "anaphase":
        return { cells: 1, nuclei: 0, ploidy: "2n → n + n", perCell: { chromosomes: DIPLOID_2N, chromatids: DIPLOID_2N * 2, setLabel: `${HAPLOID_N} + ${HAPLOID_N} chromosomes, each still 2 chromatids` }, chromatidsPerChromosome: 2, separating: "homologous chromosomes", cellLabel: "one cell, homologues moving apart" };
      case "telophase":
        return { cells: 1, nuclei: 2, ploidy: "n", perCell: { chromosomes: HAPLOID_N, chromatids: HAPLOID_N * 2, setLabel: `n = ${HAPLOID_N} in each nucleus` }, chromatidsPerChromosome: 2, separating: null, cellLabel: "one cell, two haploid nuclei" };
      default:
        return { cells: 2, nuclei: 2, ploidy: "n", perCell: { chromosomes: HAPLOID_N, chromatids: HAPLOID_N * 2, setLabel: `n = ${HAPLOID_N} in each cell` }, chromatidsPerChromosome: 2, separating: null, cellLabel: "two haploid cells" };
    }
  }
  switch (s.phase) {
    case "prophase":
    case "metaphase":
      return { cells: 2, nuclei: s.phase === "prophase" ? 2 : 0, ploidy: "n", perCell: { chromosomes: HAPLOID_N, chromatids: HAPLOID_N * 2, setLabel: `n = ${HAPLOID_N} in each cell` }, chromatidsPerChromosome: 2, separating: null, cellLabel: "two haploid cells" };
    case "anaphase":
      return { cells: 2, nuclei: 0, ploidy: "n → n", perCell: { chromosomes: HAPLOID_N * 2, chromatids: HAPLOID_N * 2, setLabel: `${HAPLOID_N} + ${HAPLOID_N} daughter chromosomes per cell` }, chromatidsPerChromosome: 1, separating: "sister chromatids", cellLabel: "two cells, chromatids moving apart" };
    case "telophase":
      return { cells: 2, nuclei: 4, ploidy: "n", perCell: { chromosomes: HAPLOID_N, chromatids: HAPLOID_N, setLabel: `n = ${HAPLOID_N} in each nucleus` }, chromatidsPerChromosome: 1, separating: null, cellLabel: "two cells, four haploid nuclei" };
    default:
      return { cells: 4, nuclei: 4, ploidy: "n", perCell: { chromosomes: HAPLOID_N, chromatids: HAPLOID_N, setLabel: `n = ${HAPLOID_N} in each gamete` }, chromatidsPerChromosome: 1, separating: null, cellLabel: "four haploid gametes" };
  }
}

// ─── Crossing over ──────────────────────────────────────────────────

/**
 * Where the chiasmata go. Crossovers are dealt out alternately to the two
 * bivalents, and within a bivalent to alternate arms, so four events give
 * every chromatid in the cell one recombinant stretch. `u` is the position
 * along the arm as a fraction of that arm (0 centromere, 1 tip); segments
 * DISTAL to it — from `u` to the tip — are the ones that swap.
 *
 * Each event joins one maternal and one paternal chromatid (never sisters:
 * sisters are identical, so swapping between them changes nothing). The
 * `which` index says which of the two sisters on each side takes part.
 */
export function chiasmaPlan(chiasmata) {
  const c = clamp(Math.round(Number(chiasmata) || 0), 0, MAX_CHIASMATA);
  const plan = [];
  const table = [
    { pair: 0, arm: "q", u: 0.58, which: 0 },
    { pair: 1, arm: "q", u: 0.62, which: 0 },
    { pair: 0, arm: "p", u: 0.6, which: 1 },
    { pair: 1, arm: "p", u: 0.55, which: 1 },
  ];
  for (let i = 0; i < c; i += 1) plan.push({ ...table[i], index: i });
  return plan;
}

/**
 * Which parent a stretch of a chromatid comes from after crossing over.
 * `chromatid` is { pair, parent, which }; `u` runs −1 (p-arm tip) → 0
 * (centromere) → +1 (q-arm tip). With `reveal` < 1 the swap is only partly
 * done (prophase I in progress) and the answer is a blend, 0 = own parent,
 * 1 = the other.
 */
export function originAt(chromatid, u, plan, reveal = 1) {
  const arm = u < 0 ? "p" : "q";
  const distance = Math.abs(u);
  let flips = 0;
  for (const x of plan) {
    if (x.pair !== chromatid.pair || x.arm !== arm || x.which !== chromatid.which) continue;
    if (distance > x.u) flips += 1;
  }
  const swapped = flips % 2 === 1;
  const other = chromatid.parent === "maternal" ? "paternal" : "maternal";
  return { parent: swapped ? other : chromatid.parent, blend: swapped ? clamp(reveal, 0, 1) : 0, own: chromatid.parent, other };
}

/** The eight chromatids of the replicated 2n = 4 cell. */
export function chromatids() {
  const out = [];
  PAIRS.forEach((pair, p) => {
    for (const parent of ["maternal", "paternal"]) {
      for (let which = 0; which < 2; which += 1) out.push({ key: `${pair.key}-${parent}-${which}`, pair: p, parent, which, length: pair.length });
    }
  });
  return out;
}

/** True if any stretch of the chromatid now comes from the other parent. */
export function isRecombinant(chromatid, plan) {
  return plan.some((x) => x.pair === chromatid.pair && x.which === chromatid.which);
}

/**
 * How much genetic variety the division makes. Mitosis: none — clones.
 * Meiosis: independent assortment alone gives 2ⁿ = 4 different gametes for
 * n = 2 pairs; each crossover adds two recombinant chromatid types to its
 * bivalent, so the distinct types per bivalent are 2 + 2c and the gamete
 * count is their product — 4, 8, 16, 24, 36 for 0–4 events. `index` is that
 * count on a log scale against the maximum, so it runs 0.39 → 1 across the
 * slider, NOT 0 → 1: with no crossovers at all, independent assortment has
 * still produced four distinct gametes, and a gauge reading zero there would
 * say the opposite of what meiosis does.
 */
export function diversity(mode, chiasmata) {
  const m = modeFor(mode);
  const c = clamp(Math.round(Number(chiasmata) || 0), 0, MAX_CHIASMATA);
  if (m.key === "mitosis") {
    return { combinations: 1, recombinantChromatids: 0, crossovers: 0, index: 0, percent: 0, assortment: 1, label: "none — daughter cells are identical clones", mode: m.key };
  }
  const plan = chiasmaPlan(c);
  const perPair = PAIRS.map((_, p) => 2 + 2 * plan.filter((x) => x.pair === p).length);
  const combinations = perPair.reduce((a, b) => a * b, 1);
  const max = (2 + 2 * Math.ceil(MAX_CHIASMATA / 2)) * (2 + 2 * Math.floor(MAX_CHIASMATA / 2));
  const index = Math.log2(combinations) / Math.log2(max);
  return {
    combinations,
    recombinantChromatids: 2 * c,
    crossovers: c,
    index,
    percent: Math.round(index * 100),
    assortment: 2 ** HAPLOID_N,
    perPair,
    label: c === 0 ? `${combinations} gamete genotypes from independent assortment alone` : `${combinations} possible gamete genotypes · ${2 * c} of 8 chromatids recombinant`,
    mode: m.key,
  };
}

// ─── The pose ───────────────────────────────────────────────────────

const rampIn = (x, a, b) => smoothstep(clamp((x - a) / Math.max(1e-6, b - a), 0, 1));

/**
 * Continuous animation channels, all 0–1, at cycle time `t`. The scene
 * draws from these and nothing else, which is what makes "each stage looks
 * different" a testable claim: the hold-point poses of neighbouring stages
 * must differ in at least one channel.
 *
 *   condense   chromatin → condensed chromosomes (prophase), back again (telophase)
 *   envelope   nuclear envelope intact
 *   poles      centrosomes migrated to opposite poles
 *   spindle    microtubules assembled
 *   align      chromosomes congressed onto the metaphase plate
 *   separate   the anaphase pull, 0 at the plate → 1 at the poles
 *   elongate   anaphase B — the cell stretches along the spindle axis
 *   furrow     the cleavage furrow, 1 = two cells
 *   pair       homologues synapsed into bivalents (meiosis I only)
 *   crossover  chiasmata formed and arms swapped (meiosis I only)
 *   fade       crossfade over the wrap, when daughters become one cell again
 */
export function divisionPose(mode, t) {
  const m = modeFor(mode);
  const cycle = cycleFor(m.key);
  const d = describeCycle(cycle, t);
  const time = wrapTime(cycle, t);
  const s = cycle.stages[d.index];
  const p = d.progress;
  const phase = s.phase;
  const division = s.division;
  const meiosis = m.key === "meiosis";

  // Where in THIS division we are, as a phase ladder, so channels can be
  // written once for either division.
  const ladder = ["interphase", "prophase", "metaphase", "anaphase", "telophase", "cytokinesis"];
  const rung = ladder.indexOf(phase);
  const after = (name) => rung > ladder.indexOf(name);
  const before = (name) => rung < ladder.indexOf(name);
  const inPhase = (name) => phase === name;

  // Interkinesis: between meiosis I and II chromosomes only partly decondense.
  const restCondense = meiosis && division === 1 && after("anaphase") ? 0.35 : 0;

  const condense = inPhase("prophase")
    ? restCondense + (1 - restCondense) * rampIn(p, 0.05, 0.75)
    : inPhase("telophase")
      ? 1 - (1 - restCondense) * rampIn(p, 0.25, 0.95)
      : inPhase("cytokinesis") || inPhase("interphase")
        ? (inPhase("interphase") && division === 1 ? 0 : restCondense)
        : 1;

  const envelope = inPhase("interphase")
    ? 1
    : inPhase("prophase")
      ? 1 - rampIn(p, 0.6, 1.0)
      : inPhase("telophase")
        ? rampIn(p, 0.35, 0.95)
        : inPhase("cytokinesis")
          ? 1
          : 0;

  const poles = inPhase("interphase") ? 0 : inPhase("prophase") ? rampIn(p, 0.0, 0.7) : inPhase("cytokinesis") ? 1 : 1;

  const spindle = inPhase("prophase")
    ? rampIn(p, 0.35, 1.0)
    : inPhase("metaphase") || inPhase("anaphase")
      ? 1
      : inPhase("telophase")
        ? 1 - rampIn(p, 0.2, 0.8)
        : 0;

  const align = inPhase("metaphase") ? rampIn(p, 0.0, 0.62) : after("metaphase") ? 1 : 0;
  const separate = inPhase("anaphase") ? rampIn(p, 0.05, 0.95) : after("anaphase") ? 1 : 0;
  const elongate = inPhase("anaphase") ? rampIn(p, 0.35, 1.0) : after("anaphase") ? 1 : 0;
  const furrow = inPhase("cytokinesis") ? rampIn(p, 0.0, 0.85) : 0;

  // Meiosis I only: synapsis in prophase I, held through metaphase I, undone by anaphase I.
  const pair = !meiosis || division !== 1
    ? 0
    : inPhase("prophase")
      ? rampIn(p, 0.1, 0.55)
      : inPhase("metaphase")
        ? 1
        : inPhase("anaphase")
          ? 1 - rampIn(p, 0.0, 0.5)
          : 0;
  // Chiasmata: formed late in prophase I and visible until the homologues part; the swapped colours persist.
  const crossover = !meiosis
    ? 0
    : division === 1
      ? inPhase("prophase")
        ? rampIn(p, 0.5, 0.92)
        : inPhase("interphase")
          ? 0
          : 1
      : 1;
  const chiasmaVisible = !meiosis || division !== 1 ? 0 : inPhase("prophase") ? crossover : inPhase("metaphase") ? 1 : inPhase("anaphase") ? 1 - rampIn(p, 0.0, 0.35) : 0;

  // Crossfade across the wrap: the tail of the last cytokinesis and the head of interphase.
  const fadeSpan = 0.35;
  const fadeOut = d.index === cycle.stages.length - 1 ? clamp((cycle.total - time) / fadeSpan, 0, 1) : 1;
  const fadeIn = d.index === 0 ? rampIn(time, 0, fadeSpan) : 1;
  const fade = Math.min(fadeOut, fadeIn);

  // Daughter geometry: how many cells exist. The furrow is "closed" once the
  // contractile ring has done 95 % of its work — the tableau the stepper parks on.
  const divided = furrow >= 0.95;
  const cells = meiosis ? (division === 1 ? (divided ? 2 : 1) : divided ? 4 : 2) : divided ? 2 : 1;

  return {
    stage: s.key,
    index: d.index,
    label: s.label,
    short: s.short,
    phase,
    division,
    progress: p,
    condense,
    envelope,
    poles,
    spindle,
    align,
    separate,
    elongate,
    furrow,
    pair,
    crossover,
    chiasmaVisible,
    fade,
    cells,
    // What the anaphase pull is separating, for labels.
    separating: inPhase("anaphase") || inPhase("telophase") ? (meiosis && division === 1 ? "homologues" : "sister chromatids") : null,
    before,
    after,
  };
}

/** The pose at a stage's hold point — the tableau the stepper parks on. */
export const holdPose = (mode, stageRef) => {
  const cycle = cycleFor(mode);
  const s = typeof stageRef === "number" ? cycle.stages[clamp(Math.round(stageRef), 0, cycle.stages.length - 1)] : cycle.byKey[stageRef];
  return divisionPose(mode, s.hold);
};

/** The channels a hold-point comparison should look at. */
export const POSE_CHANNELS = ["condense", "envelope", "poles", "spindle", "align", "separate", "elongate", "furrow", "pair", "chiasmaVisible"];

/** Largest channel difference between two poses — how visually distinct they are. */
export function poseDistance(a, b) {
  let best = 0;
  for (const k of POSE_CHANNELS) best = Math.max(best, Math.abs((a[k] ?? 0) - (b[k] ?? 0)));
  if (a.cells !== b.cells) best = Math.max(best, 1);
  return best;
}

// ─── Readout ────────────────────────────────────────────────────────

/** Everything the HUD prints for a stage index, mode, crossover count and colchicine state. */
export function describeDivision({ mode = "mitosis", stage = 0, chiasmata = 0, colchicine = 0 } = {}) {
  const m = modeFor(mode);
  const cycle = cycleFor(m.key);
  const index = clamp(Math.round(Number(stage) || 0), 0, cycle.stages.length - 1);
  const s = cycle.stages[index];
  const arrested = colchicineApplied(colchicine);
  const arrestIndex = arrestIndexFor(m.key);
  return {
    mode: m,
    cycle,
    stage: s,
    index,
    census: census(m.key, index),
    diversity: diversity(m.key, chiasmata),
    plan: m.key === "meiosis" ? chiasmaPlan(chiasmata) : [],
    colchicine: {
      applied: arrested,
      arrestIndex,
      arrestStage: cycle.stages[arrestIndex],
      held: arrested && index === arrestIndex,
    },
  };
}

export { stageBlend };
