// ─── The carbon cycle ───────────────────────────────────────────────
// The bookkeeping behind the carbon-cycle diorama: where the carbon is,
// how fast it moves between the pools, and what the atmosphere's share of
// it does to the planet's temperature. Everything is in gigatonnes of
// carbon per year (GtC/yr), the unit the Global Carbon Budget reports in,
// and the atmosphere is read in parts per million (1 ppm ≈ 2.13 GtC).
//
// Unlike the physiology scenes this one is NOT steady state: the atmosphere
// is a bucket, and every dial changes how fast it fills or drains. So the
// model is a pure `stepCarbon(state, controls, dt)` integrator that the
// scene runs on its own clock, plus `solveCarbon(state, controls)` for the
// instantaneous picture the HUD shows.
//
// The flows, calibrated so the defaults (100 % combustion, 60 % forest
// cover, mean solar activity, 420 ppm) reproduce the 2020s budget:
//
//   photosynthesis   ~120 GtC/yr out of the air into land plants (GPP);
//   respiration      ~117 GtC/yr back out of plants, animals and rotting
//                    matter — the cycle is nearly closed, and the small
//                    surplus is the LAND SINK, which exists because extra
//                    CO₂ fertilises growth (there was no sink at 280 ppm);
//   ocean            net uptake proportional to how far the air has run
//                    ahead of the surface water, ~2.8 GtC/yr today, and
//                    the surface slowly catches up — so the ocean gives
//                    carbon BACK if the atmosphere ever drops below it;
//   combustion       9.5 GtC/yr at 100 % — coal, oil, gas — carbon that was
//                    locked out of the cycle for 300 million years;
//   land use         clearing forest for pasture, and the cattle on it:
//                    1.2 GtC/yr at today's 40 % pasture, zero at full
//                    forest.
//
// Temperature: CO₂ forcing is logarithmic (ΔF = 5.35 ln C/C₀ W/m²), methane
// from pasture and the solar cycle add to it, and the equilibrium warming
// is 0.8 K per W/m² — 3 °C per doubling. The ocean's heat capacity means
// the realised anomaly lags the equilibrium by ~15 years, which is why the
// readout keeps climbing after you stop touching the dials.
// ─────────────────────────────────────────────────────────────────────

// ─── The atmosphere ─────────────────────────────────────────────────

/** Pre-industrial CO₂, when the land and ocean were in balance with the air. */
export const PREINDUSTRIAL_PPM = 280;

/** Where the sim starts — the early 2020s. */
export const PRESENT_PPM = 420;

/** Gigatonnes of carbon in one ppm of atmospheric CO₂. */
export const GTC_PER_PPM = 2.13;

/** Hard limits on the bucket so no combination of dials can run away. */
export const MIN_PPM = 150;
export const MAX_PPM = 5000;

// ─── Sources ────────────────────────────────────────────────────────

/** Fossil-fuel emissions at 100 % of today's rate, GtC/yr. */
export const FOSSIL_GTC_PER_YEAR = 9.5;
export const MAX_COMBUSTION_PCT = 500;

/**
 * Deforestation plus the livestock on cleared land, at today's pasture
 * share of the diorama (40 % — i.e. 60 % forest). Scales with pasture.
 */
export const LAND_USE_GTC_PER_YEAR = 1.2;

// ─── Land ───────────────────────────────────────────────────────────

/** Forest cover the calibration is for; the slider's default. */
export const BASELINE_FOREST_PCT = 60;
export const MIN_FOREST_PCT = 10;
export const MAX_FOREST_PCT = 100;

/** Gross primary production at baseline forest and 420 ppm, GtC/yr. */
export const GPP_BASELINE = 120;

/** How strongly extra CO₂ boosts photosynthesis (fraction per e-fold of ppm). */
export const CO2_FERTILISATION_BETA = 0.35;

/**
 * Net land sink per e-fold of CO₂ above pre-industrial, GtC/yr, at
 * baseline forest. 3 GtC/yr at 420 ppm (ln 1.5 ≈ 0.405 e-folds).
 */
export const LAND_SINK_GAIN = 3 / Math.log(PRESENT_PPM / PREINDUSTRIAL_PPM);

/** Respiration and decomposition speed up with warmth: rate doubles per +10 °C. */
export const RESPIRATION_Q10 = 2;

// ─── Ocean ──────────────────────────────────────────────────────────

/** Net air→sea flux per ppm the air is above the surface water, GtC/yr/ppm. */
export const OCEAN_EXCHANGE_GTC_PER_PPM = 0.07;

/** The surface ocean's own CO₂ level today — it lags the air, hence the uptake. */
export const OCEAN_BASELINE_PPM = 380;

/** GtC the surface ocean must gain to rise 1 ppm; sets how slowly it catches up. */
export const OCEAN_BUFFER_GTC_PER_PPM = 5;

/** Warm water holds less CO₂: uptake shrinks by this fraction per °C of warming. */
export const OCEAN_SOLUBILITY_LOSS_PER_C = 0.04;

/** Gross air↔sea exchange, GtC/yr each way — the churn the visual shows. */
export const GROSS_OCEAN_EXCHANGE = 90;

// ─── Radiation ──────────────────────────────────────────────────────

/** ΔF = 5.35 ln(C/C₀) W/m² — the logarithmic CO₂ forcing (Myhre et al.). */
export const CO2_FORCING_COEFF = 5.35;

/** Methane forcing from today's livestock and pasture, W/m². */
export const METHANE_FORCING_BASELINE = 0.2;

/** Total solar irradiance, W/m², and how far the cycle swings it either side. */
export const SOLAR_CONSTANT = 1361;
export const SOLAR_CYCLE_AMPLITUDE = 0.0015;
export const PLANETARY_ALBEDO = 0.3;

/** Equilibrium warming per W/m² of forcing; 3 °C per doubling of CO₂. */
export const CLIMATE_SENSITIVITY = 0.8;

/** Years for the surface to close most of the gap to its equilibrium temperature. */
export const OCEAN_THERMAL_LAG_YEARS = 15;

/** Realised warming at the start, °C above pre-industrial. */
export const PRESENT_ANOMALY_C = 1.2;

/** Largest single step the integrator takes, years — keeps Euler well inside stability. */
export const MAX_STEP_YEARS = 0.25;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ─── Flows ──────────────────────────────────────────────────────────

/** Share of the land that is pasture rather than forest, 0–1. */
export function pastureFraction(forestPct) {
  return clamp(1 - forestPct / 100, 0, 1);
}

/** Pasture relative to today's, so the baseline is 1. */
const pastureRatio = (forestPct) => pastureFraction(forestPct) / pastureFraction(BASELINE_FOREST_PCT);

/** Deforestation and livestock emissions, GtC/yr. Zero at full forest. */
export function landUseEmission(forestPct) {
  return LAND_USE_GTC_PER_YEAR * pastureRatio(forestPct);
}

/** Fossil combustion, GtC/yr. */
export function combustionEmission(combustionPct) {
  return FOSSIL_GTC_PER_YEAR * clamp(combustionPct, 0, MAX_COMBUSTION_PCT) / 100;
}

/**
 * CO₂ fertilisation: photosynthesis relative to its rate at 420 ppm. More
 * CO₂ means faster growth, with diminishing returns; starved of CO₂ it
 * stops altogether.
 */
export function co2Fertilisation(ppm) {
  return Math.max(0, 1 + CO2_FERTILISATION_BETA * Math.log(Math.max(ppm, 1) / PRESENT_PPM));
}

/** Gross photosynthesis by land plants, GtC/yr. */
export function photosynthesis(ppm, forestPct) {
  return GPP_BASELINE * (forestPct / BASELINE_FOREST_PCT) * co2Fertilisation(ppm);
}

/** Q10 factor: how much faster things rot and respire at `anomalyC` than at the start. */
export function respirationBoost(anomalyC) {
  return Math.pow(RESPIRATION_Q10, (anomalyC - PRESENT_ANOMALY_C) / 10);
}

/**
 * Net carbon the land takes up, GtC/yr: photosynthesis minus respiration.
 * Driven by CO₂ above pre-industrial (fertilisation), scaled by forest
 * cover, and eaten into by warming, which speeds respiration. Negative
 * below 280 ppm — plants starve — and zero at pre-industrial balance.
 */
export function landNetUptake(ppm, forestPct, anomalyC) {
  return (LAND_SINK_GAIN * (forestPct / BASELINE_FOREST_PCT) * Math.log(Math.max(ppm, 1) / PREINDUSTRIAL_PPM)) / respirationBoost(anomalyC);
}

/** Respiration and decomposition, GtC/yr — whatever photosynthesis fixed that the land did not keep. */
export function respiration(ppm, forestPct, anomalyC) {
  return photosynthesis(ppm, forestPct) - landNetUptake(ppm, forestPct, anomalyC);
}

/**
 * Net flux from the air into the ocean, GtC/yr. Proportional to how far the
 * air has run ahead of the surface water; a warmer ocean holds less, and an
 * atmosphere BELOW the surface water pulls carbon back out.
 */
export function oceanNetUptake(ppm, oceanPpm, anomalyC) {
  const solubility = clamp(1 - OCEAN_SOLUBILITY_LOSS_PER_C * (anomalyC - PRESENT_ANOMALY_C), 0.2, 1.5);
  return OCEAN_EXCHANGE_GTC_PER_PPM * (ppm - oceanPpm) * solubility;
}

/** Surface-ocean pH from atmospheric CO₂ — about −0.1 per 50 % rise. */
export function oceanPH(ppm) {
  return 8.2 - 0.45 * Math.log10(Math.max(ppm, 1) / PREINDUSTRIAL_PPM);
}

/**
 * Every flow at once. Positive `net` means the atmosphere is gaining
 * carbon; `ppmPerYear` is the same thing in the units the readout uses.
 */
export function carbonFluxes(state, controls) {
  const ppm = clamp(state.ppm, MIN_PPM, MAX_PPM);
  const anomaly = state.anomaly;
  const forest = clamp(controls.forest, MIN_FOREST_PCT, MAX_FOREST_PCT);
  const photo = photosynthesis(ppm, forest);
  const landNet = landNetUptake(ppm, forest, anomaly);
  const resp = photo - landNet;
  const combustion = combustionEmission(controls.combustion);
  const landUse = landUseEmission(forest);
  const ocean = oceanNetUptake(ppm, state.oceanPpm, anomaly);
  const sources = combustion + landUse + resp;
  const sinks = photo + ocean;
  const net = sources - sinks;
  return {
    photosynthesis: photo,
    respiration: resp,
    landNet,
    combustion,
    landUse,
    oceanUptake: ocean,
    sources,
    sinks,
    net,
    ppmPerYear: net / GTC_PER_PPM,
  };
}

// ─── Radiation ──────────────────────────────────────────────────────

/** Solar irradiance offset from the mean for a slider position 0 (minimum) – 100 (maximum), W/m². */
export function solarIrradianceDelta(solarPct) {
  return SOLAR_CONSTANT * SOLAR_CYCLE_AMPLITUDE * clamp((solarPct - 50) / 50, -1, 1);
}

/** Forcings in W/m²: CO₂ (logarithmic), methane from pasture, the solar cycle. */
export function radiativeForcing(ppm, forestPct, solarPct) {
  const co2 = CO2_FORCING_COEFF * Math.log(clamp(ppm, MIN_PPM, MAX_PPM) / PREINDUSTRIAL_PPM);
  const methane = METHANE_FORCING_BASELINE * pastureRatio(forestPct);
  // Spread over the whole sphere (÷4) and less the 30 % the planet reflects.
  const solar = (solarIrradianceDelta(solarPct) * (1 - PLANETARY_ALBEDO)) / 4;
  return { co2, methane, solar, total: co2 + methane + solar };
}

/** Where the temperature would settle if the forcing held, °C above pre-industrial. */
export function equilibriumAnomaly(totalForcingWm2) {
  return CLIMATE_SENSITIVITY * totalForcingWm2;
}

/**
 * Fraction of outgoing longwave photons the atmosphere absorbs before they
 * escape — what the photon visual shows. Saturating in CO₂ (that is why the
 * forcing is logarithmic), with a little from pasture methane.
 */
export function greenhouseOpacity(ppm, forestPct) {
  const optical = 0.7 * (clamp(ppm, MIN_PPM, MAX_PPM) / PREINDUSTRIAL_PPM) + 0.15 * pastureRatio(forestPct);
  return 1 - Math.exp(-optical);
}

// ─── The clock ──────────────────────────────────────────────────────

export function initialCarbonState() {
  return {
    year: 0,
    ppm: PRESENT_PPM,
    oceanPpm: OCEAN_BASELINE_PPM,
    anomaly: PRESENT_ANOMALY_C,
    fossilBurned: 0,
    landStored: 0,
    oceanStored: 0,
  };
}

function eulerStep(state, controls, dt) {
  const f = carbonFluxes(state, controls);
  const forest = clamp(controls.forest, MIN_FOREST_PCT, MAX_FOREST_PCT);
  const target = equilibriumAnomaly(radiativeForcing(state.ppm, forest, controls.solar).total);
  const relax = 1 - Math.exp(-dt / OCEAN_THERMAL_LAG_YEARS);
  return {
    year: state.year + dt,
    ppm: clamp(state.ppm + f.ppmPerYear * dt, MIN_PPM, MAX_PPM),
    oceanPpm: state.oceanPpm + (f.oceanUptake / OCEAN_BUFFER_GTC_PER_PPM) * dt,
    anomaly: state.anomaly + (target - state.anomaly) * relax,
    fossilBurned: state.fossilBurned + f.combustion * dt,
    landStored: state.landStored + f.landNet * dt,
    oceanStored: state.oceanStored + f.oceanUptake * dt,
  };
}

/** Advance the world by `dtYears`, sub-stepping so a slow frame stays stable. Pure. */
export function stepCarbon(state, controls, dtYears) {
  if (!(dtYears > 0)) return state;
  let s = state;
  let remaining = dtYears;
  while (remaining > 1e-9) {
    const dt = Math.min(remaining, MAX_STEP_YEARS);
    s = eulerStep(s, controls, dt);
    remaining -= dt;
  }
  return s;
}

// ─── The picture ────────────────────────────────────────────────────

export function solarLabel(solarPct) {
  const d = solarIrradianceDelta(solarPct);
  if (Math.abs(d) < 0.05) return "mean";
  const pct = ((d / SOLAR_CONSTANT) * 100).toFixed(2);
  return `${d > 0 ? "+" : "−"}${Math.abs(pct)} % TSI · ${d > 0 ? "solar maximum" : "solar minimum"}`;
}

export function co2Band(ppm) {
  if (ppm < 350) return "safe";
  if (ppm < 450) return "present";
  if (ppm < 600) return "elevated";
  return "extreme";
}

/** Everything the HUD reports, from the scene's state and the dials. */
export function solveCarbon(state, controls) {
  const forest = clamp(controls.forest, MIN_FOREST_PCT, MAX_FOREST_PCT);
  const fluxes = carbonFluxes(state, controls);
  const forcing = radiativeForcing(state.ppm, forest, controls.solar);
  const target = equilibriumAnomaly(forcing.total);
  const trend = Math.abs(fluxes.ppmPerYear) < 0.2 ? "steady" : fluxes.ppmPerYear > 0 ? "rising" : "falling";
  return {
    ...fluxes,
    year: state.year,
    ppm: state.ppm,
    oceanPpm: state.oceanPpm,
    anomaly: state.anomaly,
    equilibriumAnomaly: target,
    committedWarming: target - state.anomaly,
    forcing,
    opacity: greenhouseOpacity(state.ppm, forest),
    pH: oceanPH(state.ppm),
    band: co2Band(state.ppm),
    trend,
    doublings: Math.log2(state.ppm / PREINDUSTRIAL_PPM),
    fossilBurned: state.fossilBurned,
    landStored: state.landStored,
    oceanStored: state.oceanStored,
    pasture: pastureFraction(forest),
  };
}
