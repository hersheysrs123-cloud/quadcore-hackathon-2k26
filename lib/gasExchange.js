// ─── Gas exchange in the alveolus ───────────────────────────────────
// What happens to one red blood cell's worth of blood on its way past an
// alveolus: it arrives from the pulmonary artery short of oxygen and
// carrying extra carbon dioxide, and in under a second in the capillary it
// takes on oxygen and gives up carbon dioxide by diffusion across a
// barrier about half a micrometre thick.
//
// Three things set how well that works, and they are Fick's law:
//
//   rate ∝ area × (difference in partial pressure) ÷ thickness
//
//   area        about 70 m² of alveolar wall; emphysema destroys walls and
//               merges alveoli into fewer, bigger spaces
//   difference  the alveolar air's PO₂ minus the blood's. It shrinks as the
//               blood loads, so the uptake slows down along the capillary,
//               and it starts smaller at altitude, where the air is thinner
//   thickness   about 0.5 µm; fibrosis thickens it with scar tissue
//
// The blood is integrated along the capillary, not drawn as a plain
// exponential: haemoglobin soaks up oxygen without its partial pressure
// rising much on the steep part of the dissociation curve, so a given flux
// raises PO₂ slowly there and quickly near the top. That is why a healthy
// lung equilibrates in about a third of the transit time at sea level and
// at rest, and why, high up and running, a thickened barrier leaves the
// blood leaving the capillary short of the alveolar PO₂ (West, Respiratory
// Physiology, ch. 3).
// ─────────────────────────────────────────────────────────────────────

/** kPa per mmHg. */
export const KPA_PER_MMHG = 0.133322;

/** Fraction of oxygen in dry air, and the water vapour pressure of air warmed to 37 °C, kPa. */
export const O2_FRACTION = 0.2095;
export const WATER_VAPOUR_KPA = 6.3;
/** Respiratory exchange ratio: CO₂ given out per O₂ taken in. */
export const RESPIRATORY_QUOTIENT = 0.8;
/** Sea-level air pressure, kPa, and the height over which it falls by a factor e, metres. */
export const SEA_LEVEL_KPA = 101.3;
export const SCALE_HEIGHT_M = 8400;

/** Haemoglobin, g/dL; each gram binds 1.34 mL O₂. Dissolved O₂ is 0.0225 mL/dL per kPa. */
export const HAEMOGLOBIN_G_DL = 15;
export const HUFNER_ML_PER_G = 1.34;
export const DISSOLVED_ML_DL_PER_KPA = 0.0225;

/**
 * Oxygen moved per second into a decilitre of capillary blood per kPa of
 * difference, for a healthy barrier. Calibrated so that at sea level and at
 * rest the blood is within 1 mmHg of the alveolar PO₂ about a third of the
 * way along (0.25 s of 0.75 s); `tests/unit/gas-exchange.test.mjs` holds it there.
 */
export const O2_CONDUCTANCE = 5.0;
/** Time constant of the CO₂ unloading for a healthy barrier, s. CO₂ is ~20× more soluble, but its gradient is ~10× smaller. */
export const CO2_TAU_S = 0.05;

/** The healthy barrier and area, the reference for every "relative" figure. */
export const HEALTHY_THICKNESS_UM = 0.5;
export const HEALTHY_AREA_M2 = 70;

/** Within this of the alveolar PO₂ the blood counts as equilibrated, kPa (1 mmHg). */
export const EQUILIBRIUM_KPA = KPA_PER_MMHG;

export const ALTITUDES = {
  sea: { label: "Sea level", short: "sea level", metres: 0, paco2: 5.3 },
  high: { label: "3,000 m · mountain town", short: "3,000 m", metres: 3000, paco2: 4.6 },
  extreme: { label: "5,400 m · Everest base camp", short: "5,400 m", metres: 5400, paco2: 3.2 },
};

export const LUNG_CONDITIONS = {
  healthy: {
    label: "Healthy lung",
    short: "healthy",
    thicknessUm: HEALTHY_THICKNESS_UM,
    areaM2: HEALTHY_AREA_M2,
    note: "thin walls, a huge area",
  },
  fibrosis: {
    label: "Pulmonary fibrosis · thickened wall",
    short: "fibrosis",
    thicknessUm: 1.5,
    areaM2: HEALTHY_AREA_M2,
    note: "scar tissue thickens the barrier three-fold",
  },
  emphysema: {
    label: "Emphysema · walls destroyed",
    short: "emphysema",
    thicknessUm: HEALTHY_THICKNESS_UM,
    areaM2: 30,
    note: "alveoli merge into fewer, bigger spaces: a third of the area",
  },
};

/**
 * Rest and hard exercise: how long blood spends in the capillary, what it
 * arrives with, and how many more capillaries are open. In exercise the
 * heart pumps blood through three times faster, but capillaries that were
 * shut at rest open up and the ones already open widen, so the lung's
 * diffusing capacity roughly doubles (West, ch. 3).
 */
export const ACTIVITY = {
  rest: { label: "At rest", transitS: 0.75, pvo2: 5.3, pvco2: 6.1, recruitment: 1 },
  exercise: { label: "Hard exercise", transitS: 0.25, pvo2: 3.0, pvco2: 7.0, recruitment: 2.2 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Air pressure at a height, kPa. */
export function barometricKPa(metres) {
  return SEA_LEVEL_KPA * Math.exp(-Math.max(0, metres) / SCALE_HEIGHT_M);
}

/** The alveolar gas equation: PAO₂ = FiO₂ (Pb − PH₂O) − PACO₂ / R, kPa. */
export function alveolarPO2(pb, paco2) {
  return O2_FRACTION * (pb - WATER_VAPOUR_KPA) - paco2 / RESPIRATORY_QUOTIENT;
}

/** Haemoglobin's oxygen saturation (0–1) at a PO₂ in kPa: Severinghaus's fit to the dissociation curve. */
export function saturation(po2) {
  const p = Math.max(po2, 0) / KPA_PER_MMHG;
  if (p <= 0) return 0;
  return 1 / (23400 / (p * p * p + 150 * p) + 1);
}

/** Oxygen content of blood at a PO₂, mL O₂ per dL. */
export function o2Content(po2) {
  return HAEMOGLOBIN_G_DL * HUFNER_ML_PER_G * saturation(po2) + DISSOLVED_ML_DL_PER_KPA * Math.max(po2, 0);
}

/** The PO₂ whose content is `c`, by bisection (content rises monotonically with PO₂). */
export function po2ForContent(c) {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (o2Content(mid) < c) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Fick's law factor relative to a healthy lung: area ÷ thickness. */
export function diffusingFactor(condition) {
  const c = LUNG_CONDITIONS[condition] ?? LUNG_CONDITIONS.healthy;
  return c.areaM2 / HEALTHY_AREA_M2 / (c.thicknessUm / HEALTHY_THICKNESS_UM);
}

const SAMPLES = 120;

/**
 * Everything the alveolus scene and its readout need for one setting.
 *
 * `profile` has SAMPLES + 1 points along the capillary, from where the blood
 * arrives (f = 0) to where it leaves (f = 1): PO₂, saturation and PCO₂.
 */
export function solveGasExchange({ altitude = "sea", condition = "healthy", exercise = false } = {}) {
  const alt = ALTITUDES[altitude] ?? ALTITUDES.sea;
  const cond = LUNG_CONDITIONS[condition] ?? LUNG_CONDITIONS.healthy;
  const act = exercise ? ACTIVITY.exercise : ACTIVITY.rest;
  const pb = barometricKPa(alt.metres);
  const pio2 = O2_FRACTION * (pb - WATER_VAPOUR_KPA);
  const pao2 = alveolarPO2(pb, alt.paco2);
  const paco2 = alt.paco2;
  // Mixed venous blood can't arrive richer than the air it is about to meet.
  const pvo2 = Math.min(act.pvo2, pao2 * 0.85);
  const pvco2 = act.pvco2;
  const factor = diffusingFactor(condition);
  const k = O2_CONDUCTANCE * factor * act.recruitment;
  const tauCo2 = CO2_TAU_S / (factor * act.recruitment);

  const dt = act.transitS / SAMPLES;
  const profile = [];
  let c = o2Content(pvo2);
  let p = pvo2;
  let equilibratedAt = null;
  // Sub-steps keep the explicit integration stable for the fastest barrier.
  const SUB = 8;
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = i * dt;
    const pco2 = paco2 + (pvco2 - paco2) * Math.exp(-t / tauCo2);
    profile.push({ f: i / SAMPLES, t, po2: p, sat: saturation(p), pco2 });
    if (equilibratedAt === null && pao2 - p <= EQUILIBRIUM_KPA) equilibratedAt = t;
    if (i === SAMPLES) break;
    for (let s = 0; s < SUB; s += 1) {
      c += k * (pao2 - p) * (dt / SUB);
      c = Math.min(c, o2Content(pao2));
      p = po2ForContent(c);
    }
  }
  const end = profile[profile.length - 1];
  const contentIn = o2Content(pvo2);
  const contentOut = o2Content(end.po2);
  return {
    altitude: alt,
    condition: cond,
    activity: act,
    exercise: Boolean(exercise),
    pb,
    pio2,
    pao2,
    paco2,
    pvo2,
    pvco2,
    transitS: act.transitS,
    thicknessUm: cond.thicknessUm,
    areaM2: cond.areaM2,
    factor,
    profile,
    endPo2: end.po2,
    endSat: end.sat,
    endPco2: end.pco2,
    venousSat: saturation(pvo2),
    shortfall: Math.max(0, pao2 - end.po2),
    equilibratedAt,
    /** Fraction of the transit spent equilibrated: the lung's reserve. */
    reserve: equilibratedAt === null ? 0 : 1 - equilibratedAt / act.transitS,
    o2PerLitre: (contentOut - contentIn) * 10,
    diffusionLimited: equilibratedAt === null,
  };
}

/** The point of a solved profile at a fraction `f` (0–1) along the capillary, interpolated. */
export function profileAt(solved, f) {
  const pr = solved.profile;
  const x = clamp(f, 0, 1) * (pr.length - 1);
  const i = Math.min(Math.floor(x), pr.length - 2);
  const u = x - i;
  const a = pr[i];
  const b = pr[i + 1];
  return { po2: a.po2 + (b.po2 - a.po2) * u, sat: a.sat + (b.sat - a.sat) * u, pco2: a.pco2 + (b.pco2 - a.pco2) * u };
}

/** kPa with its mmHg, as the readout writes it. */
export const kpa = (v) => `${v.toFixed(1)} kPa (${Math.round(v / KPA_PER_MMHG)} mmHg)`;
