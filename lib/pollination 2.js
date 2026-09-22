// ─── Pollination and fertilisation ──────────────────────────────────
// The biology behind the flower-dissection scene, built to keep two words
// apart that students run together:
//
//   POLLINATION   pollen lands on a stigma. A physical delivery — by wind
//                 or by an insect — and over in a moment. Nothing has
//                 fused; the flower is pollinated, not fertilised.
//   FERTILISATION the fusion of nuclei, hours later and a centimetre away,
//                 inside the ovule. The grain grows a tube down the style,
//                 the generative nucleus divides into two sperm on the way,
//                 the tube enters the ovule through the micropyle, and two
//                 fusions happen: sperm + egg → zygote (2n), and sperm +
//                 the two polar nuclei → endosperm (3n). That pair is
//                 "double fertilisation", and it is unique to flowering
//                 plants.
//
// The whole event is one timeline (`lib/timeline.js`), in sim seconds; the
// tube's growth is scaled so the readout can say how many hours it has
// been since the grain landed. The vector — wind or insect — changes what
// the pollen and the flower look like, not what happens after landing.
// ─────────────────────────────────────────────────────────────────────

import { makeTimeline, describeTimeline, stageProgress, stageDone, ramp, smoothstep, clamp } from "./timeline.js";

/** Length of the style the tube must grow down, mm. */
export const STYLE_LENGTH_MM = 12;

/** Pollen-tube growth rate, mm per hour — a typical angiosperm figure. */
export const TUBE_GROWTH_MM_PER_H = 1.5;

/** Playback: hours of tube growth per sim second. */
export const HOURS_PER_SECOND = 2;

/** How far down the style the generative nucleus divides into two sperm. */
export const GENERATIVE_DIVISION_FRACTION = 0.45;

/** Tube tip's overshoot into the ovule during entry, as a fraction of the style. */
export const MICROPYLE_OVERSHOOT = 0.09;

export const VECTORS = {
  wind: {
    key: "wind",
    label: "Wind-pollinated",
    short: "Wind",
    pollen: { surface: "smooth and dry", size: "small · 20–30 µm", sticky: false, spiky: false, amount: "millions of grains per anther" },
    stigma: "feathery, hanging outside the flower to sieve the air",
    anthers: "large, dangling on long filaments, outside the petals",
    petals: "small, green or absent — nothing to advertise",
    nectar: false,
    scent: false,
    examples: "grasses, hazel, oak, birch",
    note: "Cheap grains, made by the million, because almost all of them miss.",
  },
  insect: {
    key: "insect",
    label: "Insect-pollinated",
    short: "Insect",
    pollen: { surface: "spiky and sticky", size: "larger · 40–100 µm", sticky: true, spiky: true, amount: "fewer, heavier grains" },
    stigma: "sticky, held inside the flower where the insect brushes past",
    anthers: "inside the flower, positioned to dust the visitor",
    petals: "large, bright, often with nectar guides",
    nectar: true,
    scent: true,
    examples: "buttercup, cherry, foxglove, honeysuckle",
    note: "A reward (nectar) pays the courier, so each grain has a good chance of arriving.",
  },
};

export const vectorFor = (key) => VECTORS[key] ?? VECTORS.insect;

/** The event, in order. Durations are sim seconds at 1× speed. */
export const STAGES = [
  { key: "arrival", label: "Pollen carried to the flower", duration: 2.5 },
  { key: "landing", label: "Pollination — a grain lands on the stigma", duration: 1.0 },
  { key: "germination", label: "The grain germinates — a tube emerges", duration: 1.5 },
  { key: "growth", label: "The pollen tube grows down the style", duration: STYLE_LENGTH_MM / (TUBE_GROWTH_MM_PER_H * HOURS_PER_SECOND) },
  { key: "entry", label: "The tube enters the ovule through the micropyle", duration: 1.2 },
  { key: "fertilisation", label: "Double fertilisation", duration: 2.0 },
];

export const POLLINATION_TIMELINE = makeTimeline(STAGES);
export const TIMELINE_SECONDS = POLLINATION_TIMELINE.total;

export const PLOIDY = {
  egg: "n",
  sperm: "n",
  polarNuclei: "n + n",
  zygote: "2n",
  endosperm: "3n",
};

/** Hours since the grain landed, for the readout. Zero before landing. */
export function hoursAfterPollination(t) {
  const landed = POLLINATION_TIMELINE.byKey.landing.end;
  return Math.max(0, t - landed) * HOURS_PER_SECOND;
}

/**
 * How far the tube tip has got, as a fraction of the style (0 at the
 * stigma, 1 at the base of the style, up to 1 + MICROPYLE_OVERSHOOT once
 * it is inside the ovule).
 */
export function tubeFraction(t) {
  const growth = stageProgress(POLLINATION_TIMELINE, "growth", t);
  const entry = stageProgress(POLLINATION_TIMELINE, "entry", t);
  // A little of the tube already shows during germination.
  const germ = stageProgress(POLLINATION_TIMELINE, "germination", t) * 0.03;
  return growth < 1 ? growth * (1 - 0.03) + germ : 1 + smoothstep(entry) * MICROPYLE_OVERSHOOT;
}

/** Where each nucleus is, as a fraction of the path (null = not present yet / already fused). */
export function nucleiPositions(t) {
  const tip = tubeFraction(t);
  const germinated = stageProgress(POLLINATION_TIMELINE, "germination", t) > 0.5;
  if (!germinated) return { tube: null, generative: null, sperm1: null, sperm2: null, divided: false };
  // The tube nucleus leads, just behind the tip; the sperm follow it.
  const lead = Math.max(0, tip - 0.03);
  const divided = tip >= GENERATIVE_DIVISION_FRACTION;
  const fert = stageProgress(POLLINATION_TIMELINE, "fertilisation", t);
  return {
    tube: fert > 0.2 ? null : lead,
    generative: divided ? null : Math.max(0, lead - 0.05),
    sperm1: divided ? (fert >= 0.5 ? null : Math.max(0, lead - 0.04)) : null,
    sperm2: divided ? (fert >= 0.85 ? null : Math.max(0, lead - 0.08)) : null,
    divided,
  };
}

/** The whole picture at time `t` for a given vector. */
export function describePollination(t, vectorKey = "insect") {
  const tl = POLLINATION_TIMELINE;
  const time = clamp(Number.isFinite(t) ? t : 0, 0, tl.total);
  const state = describeTimeline(tl, time);
  const vector = vectorFor(vectorKey);
  const fert = stageProgress(tl, "fertilisation", time);
  const tip = tubeFraction(time);
  const nuclei = nucleiPositions(time);
  const pollinated = stageDone(tl, "landing", time);
  const zygoteFormed = fert >= 0.5;
  const endospermFormed = fert >= 0.85;
  return {
    t: time,
    started: time > 0,
    stage: state.stage,
    label: state.label,
    progress: state.progress,
    complete: state.complete,
    fraction: state.fraction,
    vector,
    arrival: stageProgress(tl, "arrival", time),
    landing: stageProgress(tl, "landing", time),
    pollinated,
    germination: stageProgress(tl, "germination", time),
    germinated: stageProgress(tl, "germination", time) >= 1,
    growth: stageProgress(tl, "growth", time),
    tubeFraction: tip,
    tubeMm: Math.min(STYLE_LENGTH_MM, tip * STYLE_LENGTH_MM),
    growthRateMmPerH: state.stage === "growth" && !state.complete ? TUBE_GROWTH_MM_PER_H : 0,
    hoursAfterPollination: hoursAfterPollination(time),
    entry: stageProgress(tl, "entry", time),
    entered: stageDone(tl, "entry", time),
    nuclei,
    fertilisation: fert,
    zygoteFormed,
    endospermFormed,
    fertilised: zygoteFormed && endospermFormed,
    ploidy: PLOIDY,
    // What the student should be able to say at this moment.
    status: !pollinated ? "not yet pollinated" : !zygoteFormed ? "pollinated — not yet fertilised" : endospermFormed ? "pollinated and fertilised" : "first fusion done — zygote formed",
  };
}

/** Caption for the time slider. */
export function timeLabel(t) {
  const d = describePollination(t);
  if (!d.started) return "0 · before pollination";
  if (!d.pollinated) return `${t.toFixed(1)} s · ${d.stage}`;
  const h = d.hoursAfterPollination;
  return `${h < 10 ? h.toFixed(1) : Math.round(h)} h after pollination`;
}

export const ramp01 = ramp;
