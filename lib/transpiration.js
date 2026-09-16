// ─── Transpiration ──────────────────────────────────────────────────
// The physiology behind the plant-transpiration scene: how a tree lifts
// water with no pump. Three things happen in series and every one of them
// is a number here —
//
//   root:  soil water enters the root hair by OSMOSIS, down a water-potential
//          gradient (so dry soil, with a very negative Ψ, gives less to pull);
//   stem:  the column is dragged up the xylem by COHESION–TENSION — the
//          water molecules hold on to each other (cohesion) and the vessel
//          wall (adhesion), so evaporation at the top puts the whole column
//          under tension, measured here in megapascals;
//   leaf:  water evaporates from the spongy mesophyll and diffuses out of the
//          stomata, at a rate set by how open the pore is (guard-cell turgor,
//          which light drives through K⁺ uptake) and how dry and how windy
//          the air outside is (vapour-pressure deficit, boundary layer).
//
// The model is steady state — turn a dial and the plant is already there —
// which is what lets the HUD compute everything from the controls alone.
// ─────────────────────────────────────────────────────────────────────

/** Leaf temperature assumed throughout, °C. */
export const LEAF_TEMPERATURE_C = 25;

/** Saturation vapour pressure at the leaf temperature, kPa (Tetens). */
export const saturationVapourPressure = (tC) => 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3));

/** Atmospheric pressure, kPa. */
export const ATMOSPHERE_KPA = 101.3;

/** Total leaf area of the sapling the readouts are for, m². */
export const LEAF_AREA_M2 = 0.5;

/** Height the column is lifted, root hair to leaf, metres. */
export const TREE_HEIGHT_M = 4;

/** Molar mass of water, g/mol. */
export const WATER_G_PER_MOL = 18.015;

/** ρ·g for water, MPa per metre of height. */
export const GRAVITY_MPA_PER_M = 0.0098;

/**
 * Stomatal conductance with the pores wide open, mol m⁻² s⁻¹. A typical
 * well-watered broadleaf figure; conductance scales with aperture below it.
 */
export const MAX_STOMATAL_CONDUCTANCE = 0.4;

/**
 * Boundary-layer conductance in still air and in a 10 m/s wind, mol m⁻² s⁻¹.
 * Still air leaves a skin of saturated vapour on the leaf that the water
 * has to diffuse across; wind strips it, so the leaf's own pores become the
 * only thing in the way.
 */
export const BOUNDARY_CONDUCTANCE_STILL = 0.3;
export const BOUNDARY_CONDUCTANCE_WINDY = 3.0;

export const MAX_WIND_MS = 10;

/** The two soils. Water potentials in MPa. */
export const SOILS = {
  hydrated: { label: "Hydrated", short: "Hydrated", psiMPa: -0.05, aba: 0, note: "Soil water freely available" },
  drought: { label: "Drought stress", short: "Drought", psiMPa: -2.0, aba: 1, note: "Dry soil · abscisic acid closes stomata" },
};

/**
 * Fraction of full aperture the stomata still leak at under abscisic acid
 * (ABA) closure. Guard cells shut hard, but never perfectly.
 */
export const DROUGHT_RESIDUAL_APERTURE = 0.12;

/** Aperture fraction above which the pore counts as OPEN. */
export const OPEN_PORE_THRESHOLD = 0.3;

/** Guard-cell turgor pressure, MPa, flaccid → fully turgid. */
export const GUARD_CELL_TURGOR_FLACCID = 0.6;
export const GUARD_CELL_TURGOR_TURGID = 4.5;

/** Pore width at full aperture, µm (a broadleaf stoma, 6–12 µm is typical). */
export const MAX_PORE_WIDTH_UM = 10;

/**
 * Hydraulic resistance of the root-to-leaf path, MPa per (mol m⁻² s⁻¹) of
 * transpiration. Sets how much extra tension each unit of flow costs the
 * column. Chosen so a well-watered sapling flat out sits near −1.9 MPa —
 * a normal midday value.
 */
export const HYDRAULIC_RESISTANCE = 160;

/** Xylem tension beyond which vessels start to cavitate (embolise), MPa. */
export const CAVITATION_TENSION_MPA = 2.2;

/** Tension at which the column is called "strained", MPa. */
export const STRAINED_TENSION_MPA = 1.4;

/** Conducting xylem cross-section of the stem, cm². */
export const XYLEM_AREA_CM2 = 1.0;

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const soilFor = (key) => SOILS[key] ?? SOILS.hydrated;

/**
 * Potassium uptake into the guard cells as a fraction of maximum, driven by
 * light. Blue-light receptors switch on the proton pump, K⁺ follows, the
 * osmotic potential falls, water enters. Saturates: half-light is already
 * most of the way there, which is why stomata are open by mid-morning.
 */
export function potassiumUptake(lightPct) {
  const l = clamp01(lightPct / 100);
  const k = 1 - Math.exp(-l * 3.2);
  return k / (1 - Math.exp(-3.2));
}

/** Guard-cell turgor pressure, MPa, from its K⁺ load. */
export function guardCellTurgor(kFraction) {
  return GUARD_CELL_TURGOR_FLACCID + (GUARD_CELL_TURGOR_TURGID - GUARD_CELL_TURGOR_FLACCID) * clamp01(kFraction);
}

/**
 * Stomatal aperture, 0–1. Light opens the pore through turgor; drought
 * overrides it — the root sends abscisic acid up the xylem and the guard
 * cells dump their K⁺ whatever the light is doing.
 */
export function stomatalAperture(lightPct, soilKey) {
  const soil = soilFor(soilKey);
  const fromLight = potassiumUptake(lightPct);
  return fromLight * (1 - soil.aba * (1 - DROUGHT_RESIDUAL_APERTURE));
}

/** Vapour-pressure deficit of the air, kPa. */
export function vapourPressureDeficit(humidityPct, tC = LEAF_TEMPERATURE_C) {
  const rh = clamp01(humidityPct / 100);
  return saturationVapourPressure(tC) * (1 - rh);
}

/** Boundary-layer conductance for a wind speed, mol m⁻² s⁻¹. */
export function boundaryConductance(windMs) {
  const w = clamp01(windMs / MAX_WIND_MS);
  return BOUNDARY_CONDUCTANCE_STILL + (BOUNDARY_CONDUCTANCE_WINDY - BOUNDARY_CONDUCTANCE_STILL) * Math.sqrt(w);
}

/** Two conductances in series. */
export function seriesConductance(a, b) {
  if (!(a > 0) || !(b > 0)) return 0;
  return 1 / (1 / a + 1 / b);
}

/** mol m⁻² s⁻¹ of water → mL/hr for the whole plant. */
export function molFluxToMlPerHour(flux, leafAreaM2 = LEAF_AREA_M2) {
  return flux * WATER_G_PER_MOL * 3600 * leafAreaM2;
}

/**
 * Tension the water column is under, MPa (a positive number: the size of
 * the negative pressure). The leaf has to be more negative than the soil by
 * the height lifted plus the friction of the flow — so dry soil starts the
 * column off already strained, before a drop has moved.
 */
export function xylemTension(fluxMol, soilKey, heightM = TREE_HEIGHT_M) {
  const soil = soilFor(soilKey);
  return -soil.psiMPa + GRAVITY_MPA_PER_M * heightM + HYDRAULIC_RESISTANCE * Math.max(0, fluxMol);
}

export function columnStateFor(tensionMPa) {
  if (tensionMPa >= CAVITATION_TENSION_MPA) return "cavitation";
  if (tensionMPa >= STRAINED_TENSION_MPA) return "strained";
  return "safe";
}

/**
 * Solve the whole pathway for one set of controls.
 *
 * `light` 0–100 %, `humidity` 10–95 %, `wind` 0–10 m/s, `soil` a key of
 * SOILS. Returns every intermediate a readout might want, in the units it
 * is taught in.
 */
export function solveTranspiration({ light = 70, humidity = 50, wind = 2, soil = "hydrated" } = {}) {
  const soilKey = SOILS[soil] ? soil : "hydrated";
  const soilInfo = SOILS[soilKey];

  const kFraction = potassiumUptake(light);
  const aperture = stomatalAperture(light, soilKey);
  // Turgor follows the K⁺ the cell actually holds — under ABA that is what
  // is left after the efflux, i.e. the aperture itself.
  const turgorMPa = guardCellTurgor(aperture);
  const poreOpen = aperture >= OPEN_PORE_THRESHOLD;
  const poreWidthUm = MAX_PORE_WIDTH_UM * aperture;

  const vpdKPa = vapourPressureDeficit(humidity);
  const stomatal = MAX_STOMATAL_CONDUCTANCE * aperture;
  const boundary = boundaryConductance(wind);
  const conductance = seriesConductance(stomatal, boundary);

  const fluxMol = conductance * (vpdKPa / ATMOSPHERE_KPA);
  const rateMlPerHour = molFluxToMlPerHour(fluxMol);

  const tensionMPa = xylemTension(fluxMol, soilKey);
  const columnState = columnStateFor(tensionMPa);

  // Sap velocity through the stem: volume flow over the conducting area.
  const sapCmPerHour = rateMlPerHour / XYLEM_AREA_CM2;

  // Which of the two resistances is the bottleneck — the pore or the air?
  const limitedBy = stomatal <= 1e-9 ? "stomata" : stomatal < boundary ? "stomata" : "boundary layer";

  // Root uptake balances leaf loss at steady state; the gradient that drives
  // it is the root's own Ψ against the soil's.
  const rootGradientMPa = tensionMPa - (-soilInfo.psiMPa);

  return {
    light,
    humidity,
    wind,
    soil: soilKey,
    soilLabel: soilInfo.label,
    soilPsiMPa: soilInfo.psiMPa,
    kFraction,
    turgorMPa,
    aperture,
    poreOpen,
    poreStatus: poreOpen ? "Open pore" : "Closed pore",
    poreWidthUm,
    vpdKPa,
    stomatalConductance: stomatal,
    boundaryConductance: boundary,
    conductance,
    limitedBy,
    fluxMol,
    rateMlPerHour,
    tensionMPa,
    columnState,
    sapCmPerHour,
    rootGradientMPa,
    droughtClosed: soilInfo.aba > 0,
  };
}

/** Human-readable mL/hr. */
export const formatMl = (ml) => (ml < 10 ? `${ml.toFixed(1)} mL/hr` : `${Math.round(ml)} mL/hr`);
