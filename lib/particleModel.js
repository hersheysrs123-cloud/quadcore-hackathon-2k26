// ─── The particle model of matter ───────────────────────────────────
// Three substances, one hotplate, one piston, and the one graph that
// carries the whole topic: temperature against energy supplied, with its
// two flat steps.
//
// The idea the scene is built to prove is that the steps are FLAT. While
// a substance melts or boils the energy going in is spent pulling
// particles apart — breaking the attractions between them — not making
// them move faster, so the thermometer stops. That is only convincing if
// the sample has a temperature of its own that the hotplate drives, so
// the model is not "T = the slider". It is:
//
//   energy     the state is E, the energy supplied per mole since the
//              sample was cold. Every frame the hotplate adds (or the
//              cryocooler removes) energy in proportion to the gap
//              between its setpoint and the sample's temperature —
//              Newton's law of heating — and nothing else changes.
//   T(E)       the sample's temperature is read off the heating curve:
//              piecewise linear, sloped through each phase (gradient
//              1/Cp) and flat across each transition (width ΔH). Which
//              phase, and how far through a transition, falls out of the
//              same lookup.
//   pressure   moves the steps. The boiling point follows Clausius–
//              Clapeyron (water boils at 180 °C at 10 atm, 81 °C at
//              0.5 atm); the melting point barely moves (and for water
//              moves DOWN — ice is the open, hydrogen-bonded structure,
//              so pressure favours the liquid); and for carbon dioxide
//              the pressure decides whether there is a liquid at all —
//              below 5.1 atm the solid goes straight to gas.
//
// Everything here is pure and closed-form except `stepThermal`, which is
// the one integrator, so a test can drive it from a loop and the scene
// from the frame loop and see the same plateau.
// ─────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const R = 8.314; // J / (mol K)
export const K_B = 1.380649e-23; // J / K
export const C_TO_K = 273.15;

export const TEMP_MIN_C = -100;
export const TEMP_MAX_C = 250;
export const PRESSURE_MIN_ATM = 0.5;
export const PRESSURE_MAX_ATM = 10;
export const PARTICLE_COUNT = 500;

/**
 * How fast the hotplate moves energy into the sample, J per mol per second
 * per kelvin of gap. Chosen so melting a mole of ice against a 50 K gap
 * takes about three seconds on screen and boiling a mole of water about
 * fifteen — long enough to watch the thermometer refuse to move.
 */
export const HEATING_CONDUCTANCE = 80;

// ─── The substances ─────────────────────────────────────────────────
// Thermal data at 1 atm unless the substance has no normal boiling point,
// in which case the triple point is the anchor. Sources: CRC Handbook /
// NIST WebBook, rounded to what a grade 6–9 syllabus would print.

export const SUBSTANCES = {
  water: {
    label: "Water",
    formula: "H₂O",
    molarMassKg: 0.018015,
    bonding: "hydrogen bonds",
    bondingNote: "Strong, directional hydrogen bonds hold the molecules in an open hexagonal ice lattice — which is why ice is LESS dense than water and floats.",
    // Normal melting and boiling points, °C.
    meltC: 0.0,
    boilC: 100.0,
    /** Slope of the melting line, K per atm — negative: pressure melts ice. */
    meltSlopeKPerAtm: -0.0074,
    /** Triple point and critical point. */
    tripleC: 0.01,
    tripleAtm: 0.006,
    criticalC: 373.9,
    criticalAtm: 217.7,
    // Latent heats, J/mol.
    dHfus: 6010,
    dHvap: 40650,
    // Molar heat capacities, J/(mol K).
    cpSolid: 37.7,
    cpLiquid: 75.3,
    cpGas: 36.0,
    /** Volume of the solid relative to the same mass of liquid at the melting point. */
    solidExpansion: 1.09,
    colour: { solid: "#93c5fd", liquid: "#34d399", gas: "#fbbf24" },
  },
  neon: {
    label: "Neon",
    formula: "Ne",
    molarMassKg: 0.02018,
    bonding: "dispersion forces",
    bondingNote: "Only the weakest attractions — instantaneous dipoles between closed-shell atoms — so neon melts at −249 °C and boils at −246 °C: nothing on this hotplate can condense it.",
    meltC: -248.59,
    boilC: -246.05,
    meltSlopeKPerAtm: 0.012,
    tripleC: -248.59,
    tripleAtm: 0.4275,
    criticalC: -228.7,
    criticalAtm: 27.2,
    dHfus: 335,
    dHvap: 1710,
    cpSolid: 20.0,
    cpLiquid: 37.7,
    cpGas: 20.8,
    solidExpansion: 0.84,
    colour: { solid: "#c4b5fd", liquid: "#a78bfa", gas: "#fb7185" },
  },
  co2: {
    label: "Carbon dioxide",
    formula: "CO₂",
    molarMassKg: 0.04401,
    bonding: "dispersion forces",
    bondingNote: "Linear, non-polar molecules held only by dispersion forces. At 1 atm the solid (dry ice) never melts — it sublimes straight to gas at −78.5 °C. A liquid exists only above the triple-point pressure of 5.1 atm.",
    /** No normal melting or boiling point: the triple point is the anchor. */
    meltC: null,
    boilC: null,
    /** Sublimation at 1 atm, °C. */
    sublimeC: -78.5,
    meltSlopeKPerAtm: 0.05,
    tripleC: -56.6,
    tripleAtm: 5.11,
    criticalC: 31.0,
    criticalAtm: 72.8,
    dHfus: 9020,
    dHvap: 16500,
    dHsub: 25200,
    cpSolid: 55.0,
    cpLiquid: 85.0,
    cpGas: 37.1,
    solidExpansion: 0.78,
    colour: { solid: "#e2e8f0", liquid: "#38bdf8", gas: "#f59e0b" },
  },
};

export const SUBSTANCE_ORDER = ["water", "neon", "co2"];

export const substanceFor = (id) => SUBSTANCES[id] ?? SUBSTANCES.water;

// ─── Phase boundaries ───────────────────────────────────────────────

/** Clausius–Clapeyron: the temperature (K) at which a line with latent heat ΔH passing through (T₀, P₀) reaches pressure P. */
export function clausiusClapeyronK(T0K, P0Atm, dH, PAtm) {
  const inv = 1 / T0K - (R * Math.log(PAtm / P0Atm)) / dH;
  return 1 / Math.max(inv, 1e-6);
}

/** Boiling point at `PAtm`, °C — or null where no liquid exists (below the triple-point pressure). */
export function boilingPointC(substance, PAtm) {
  const s = substanceFor(substance);
  const P = clamp(PAtm, 1e-3, 1e4);
  if (P < s.tripleAtm) return null;
  if (s.boilC !== null && s.boilC !== undefined) {
    return clausiusClapeyronK(s.boilC + C_TO_K, 1, s.dHvap, P) - C_TO_K;
  }
  return clausiusClapeyronK(s.tripleC + C_TO_K, s.tripleAtm, s.dHvap, P) - C_TO_K;
}

/** Melting point at `PAtm`, °C — or null where no liquid exists. */
export function meltingPointC(substance, PAtm) {
  const s = substanceFor(substance);
  const P = clamp(PAtm, 1e-3, 1e4);
  if (P < s.tripleAtm) return null;
  if (s.meltC !== null && s.meltC !== undefined) return s.meltC + s.meltSlopeKPerAtm * (P - 1);
  return s.tripleC + s.meltSlopeKPerAtm * (P - s.tripleAtm);
}

/** Sublimation point at `PAtm`, °C — meaningful below the triple-point pressure. */
export function sublimationPointC(substance, PAtm) {
  const s = substanceFor(substance);
  const P = clamp(PAtm, 1e-3, 1e4);
  const dHsub = s.dHsub ?? s.dHfus + s.dHvap;
  if (s.sublimeC !== null && s.sublimeC !== undefined) {
    return clausiusClapeyronK(s.sublimeC + C_TO_K, 1, dHsub, P) - C_TO_K;
  }
  return clausiusClapeyronK(s.tripleC + C_TO_K, s.tripleAtm, dHsub, P) - C_TO_K;
}

/**
 * The transitions the substance goes through at this pressure, in order
 * of rising temperature: either melt-then-boil, or a single sublimation.
 */
export function transitionsAt(substance, PAtm) {
  const s = substanceFor(substance);
  if (PAtm < s.tripleAtm) {
    return { kind: "sublime", sublimeC: sublimationPointC(substance, PAtm), dHsub: s.dHsub ?? s.dHfus + s.dHvap };
  }
  const meltC = meltingPointC(substance, PAtm);
  const boilC = boilingPointC(substance, PAtm);
  // A boiling point below the melting point cannot happen for these three
  // in range, but guard it: the liquid would have no width.
  return { kind: "three", meltC, boilC: Math.max(boilC, meltC + 0.01), dHfus: s.dHfus, dHvap: s.dHvap };
}

// ─── The heating curve ──────────────────────────────────────────────

/**
 * The curve as a list of straight segments in (E, T), E in J/mol from 0
 * at `fromC`. Each carries the phase it draws:
 *
 *   solid · melting · liquid · boiling · gas · subliming
 *
 * The domain runs from `fromC` to `toC`, whatever phase those fall in, so
 * a substance whose transitions are off the bottom of the slider (neon)
 * still gets a curve — its steps are just drawn low down.
 */
export function heatingCurve(substance, PAtm, fromC = TEMP_MIN_C, toC = TEMP_MAX_C) {
  const s = substanceFor(substance);
  const tr = transitionsAt(substance, PAtm);
  const lo = Math.min(fromC, toC);
  const hi = Math.max(fromC, toC);

  // The full curve from far below to far above, then clipped to the domain.
  const stops = [];
  if (tr.kind === "sublime") {
    stops.push({ T: tr.sublimeC, dH: tr.dHsub, phaseBefore: "solid", transition: "subliming", phaseAfter: "gas", cpBefore: s.cpSolid, cpAfter: s.cpGas });
  } else {
    stops.push({ T: tr.meltC, dH: tr.dHfus, phaseBefore: "solid", transition: "melting", phaseAfter: "liquid", cpBefore: s.cpSolid, cpAfter: s.cpLiquid });
    stops.push({ T: tr.boilC, dH: tr.dHvap, phaseBefore: "liquid", transition: "boiling", phaseAfter: "gas", cpBefore: s.cpLiquid, cpAfter: s.cpGas });
  }

  const segments = [];
  let E = 0;
  let T = lo;
  let phase = stops[0].phaseBefore;
  let cp = stops[0].cpBefore;
  for (const stop of stops) {
    if (stop.T <= lo) {
      // Transition is below the domain: we start in the later phase.
      phase = stop.phaseAfter;
      cp = stop.cpAfter;
      continue;
    }
    if (stop.T >= hi) break;
    // Heat the current phase up to the transition.
    if (stop.T > T) {
      const dE = cp * (stop.T - T);
      segments.push({ phase, from: { E, T }, to: { E: E + dE, T: stop.T }, cp });
      E += dE;
      T = stop.T;
    }
    // The flat step.
    segments.push({ phase: stop.transition, from: { E, T }, to: { E: E + stop.dH, T }, dH: stop.dH, transitionC: stop.T });
    E += stop.dH;
    phase = stop.phaseAfter;
    cp = stop.cpAfter;
  }
  if (hi > T) {
    const dE = cp * (hi - T);
    segments.push({ phase, from: { E, T }, to: { E: E + dE, T: hi }, cp });
    E += dE;
  }
  return { substance: s, pressureAtm: PAtm, fromC: lo, toC: hi, totalE: E, segments, transitions: tr };
}

const PHASE_ORDER = { solid: 0, melting: 1, subliming: 1, liquid: 2, boiling: 3, gas: 4 };

/**
 * Read the sample off the curve at energy E: its temperature, the phase
 * (a transition counts as its own phase), and, on a step, how far across
 * it is (0 → 1). Off either end the curve is extended along its last
 * gradient, so an over-driven sample still has a temperature.
 */
export function stateAtEnergy(curve, E) {
  const segs = curve.segments;
  if (segs.length === 0) return { tempC: curve.fromC, phase: "solid", fraction: 0, segment: null };
  const first = segs[0];
  if (E <= first.from.E) {
    const cp = first.cp ?? curve.substance.cpSolid;
    return { tempC: first.from.T + (E - first.from.E) / cp, phase: first.phase === "melting" || first.phase === "subliming" ? "solid" : first.phase, fraction: 0, segment: first };
  }
  for (const seg of segs) {
    if (E <= seg.to.E) {
      const span = seg.to.E - seg.from.E;
      const t = span > 1e-9 ? (E - seg.from.E) / span : 1;
      if (seg.dH !== undefined) return { tempC: seg.from.T, phase: seg.phase, fraction: clamp(t, 0, 1), segment: seg };
      return { tempC: seg.from.T + (seg.to.T - seg.from.T) * t, phase: seg.phase, fraction: 0, segment: seg };
    }
  }
  const last = segs[segs.length - 1];
  const cp = last.cp ?? curve.substance.cpGas;
  return { tempC: last.to.T + (E - last.to.E) / cp, phase: last.dH !== undefined ? "gas" : last.phase, fraction: 0, segment: last };
}

/**
 * The energy at which the curve first reaches temperature `tempC` — the
 * START of a step if `tempC` is exactly a transition, so a sample created
 * "at 0 °C" is ice about to melt, not water about to freeze. Above the
 * domain, extrapolate along the last gradient.
 */
export function energyAtTemperature(curve, tempC) {
  const segs = curve.segments;
  if (segs.length === 0) return 0;
  const first = segs[0];
  if (tempC <= first.from.T) return first.from.E + (tempC - first.from.T) * (first.cp ?? curve.substance.cpSolid);
  for (const seg of segs) {
    if (seg.dH !== undefined) {
      if (Math.abs(tempC - seg.from.T) < 1e-9) return seg.from.E;
      continue;
    }
    if (tempC <= seg.to.T + 1e-9) {
      const t = (tempC - seg.from.T) / Math.max(seg.to.T - seg.from.T, 1e-9);
      return seg.from.E + t * (seg.to.E - seg.from.E);
    }
  }
  const last = segs[segs.length - 1];
  return last.to.E + (tempC - last.to.T) * (last.cp ?? curve.substance.cpGas);
}

// ─── The state and its integrator ───────────────────────────────────

export function createThermalState(substance, PAtm, tempC) {
  const curve = heatingCurve(substance, PAtm);
  const energy = energyAtTemperature(curve, clamp(tempC, TEMP_MIN_C, TEMP_MAX_C));
  return { substance: SUBSTANCES[substance] ? substance : "water", pressureAtm: PAtm, energy, heating: 0 };
}

/**
 * One step. The hotplate at `setpointC` pushes energy into the sample at
 * a rate proportional to the temperature gap; the sample's temperature is
 * whatever the curve says for its energy. Nothing here knows about
 * particles — that is the scene's job.
 */
export function stepThermal(state, { substance, pressureAtm, setpointC, dt, conductance = HEATING_CONDUCTANCE }) {
  const step = Math.max(0, dt);
  const curve = heatingCurve(substance, pressureAtm);
  // A different substance is a different sample: start it at the setpoint.
  let energy = state.substance === substance ? state.energy : energyAtTemperature(curve, setpointC);
  const before = stateAtEnergy(curve, energy);
  const gap = setpointC - before.tempC;
  const heating = conductance * gap; // J / (mol s)
  energy += heating * step;
  const after = stateAtEnergy(curve, energy);
  return {
    substance,
    pressureAtm,
    energy,
    heating,
    tempC: after.tempC,
    phase: after.phase,
    fraction: after.fraction,
    gap,
  };
}

// ─── Readouts ───────────────────────────────────────────────────────

export const PHASE_LABELS = {
  solid: "Solid Lattice",
  melting: "Melting",
  freezing: "Freezing",
  liquid: "Liquid Flow",
  boiling: "Boiling",
  condensing: "Condensing",
  subliming: "Subliming",
  depositing: "Depositing",
  gas: "Gas Chaos",
  supercritical: "Supercritical Fluid",
};

/**
 * The phase indicator text. Transitions are named by the direction the
 * energy is going — the same flat step is "melting" on the way up and
 * "freezing" on the way down — and a gas above its critical point AND
 * pressure is supercritical.
 */
export function describePhase({ substance, pressureAtm, tempC, phase, fraction, heating }) {
  const s = substanceFor(substance);
  const supercritical = tempC > s.criticalC && pressureAtm > s.criticalAtm;
  if (supercritical) return { key: "supercritical", label: PHASE_LABELS.supercritical, detail: `above ${s.criticalC} °C and ${s.criticalAtm} atm — no boundary between liquid and gas` };
  const cooling = heating < 0;
  if (phase === "melting") {
    const key = cooling ? "freezing" : "melting";
    return { key, label: PHASE_LABELS[key], detail: `${Math.round((cooling ? 1 - fraction : fraction) * 100)}% ${cooling ? "frozen" : "melted"} — temperature held` };
  }
  if (phase === "boiling") {
    const key = cooling ? "condensing" : "boiling";
    return { key, label: PHASE_LABELS[key], detail: `${Math.round((cooling ? 1 - fraction : fraction) * 100)}% ${cooling ? "condensed" : "vaporised"} — temperature held` };
  }
  if (phase === "subliming") {
    const key = cooling ? "depositing" : "subliming";
    return { key, label: PHASE_LABELS[key], detail: `${Math.round((cooling ? 1 - fraction : fraction) * 100)}% ${cooling ? "deposited" : "sublimed"} — no liquid at this pressure` };
  }
  if (phase === "gas" && tempC > s.criticalC) {
    return { key: "gas", label: PHASE_LABELS.gas, detail: `above T꜀ = ${s.criticalC} °C — cannot be liquefied by pressure alone` };
  }
  return { key: phase, label: PHASE_LABELS[phase] ?? phase, detail: phase === "solid" ? "particles vibrate about fixed lattice sites" : phase === "liquid" ? "particles slide past one another, still touching" : "particles fly freely, colliding with the walls" };
}

/** Mean translational kinetic energy per particle, J, and the rms speed, m/s. */
export function kineticReadout(substance, tempC) {
  const s = substanceFor(substance);
  const TK = Math.max(tempC + C_TO_K, 0);
  const meanKE = 1.5 * K_B * TK;
  const vRms = Math.sqrt((3 * R * TK) / s.molarMassKg);
  return { tempK: TK, meanKE, meanKEzJ: meanKE * 1e21, vRms };
}

/**
 * How the particles are split between the three states at this point on
 * the curve. During a step, `fraction` of the sample has crossed it.
 */
export function phaseComposition(phase, fraction) {
  switch (phase) {
    case "solid":
      return { solid: 1, liquid: 0, gas: 0 };
    case "melting":
      return { solid: 1 - fraction, liquid: fraction, gas: 0 };
    case "liquid":
      return { solid: 0, liquid: 1, gas: 0 };
    case "boiling":
      return { solid: 0, liquid: 1 - fraction, gas: fraction };
    case "subliming":
      return { solid: 1 - fraction, liquid: 0, gas: fraction };
    default:
      return { solid: 0, liquid: 0, gas: 1 };
  }
}

// ─── The container ──────────────────────────────────────────────────
// Scene units. The container's cross-section is fixed, so height is
// volume. A mole of steam is 1 600 times the volume of a mole of water,
// which no drawing can show to scale; the gas column is a compressed map
// of PV = nRT — taller when hot, shorter when the piston presses — and
// the readout quotes the real ratio.

export const CONTAINER = { width: 3.6, depth: 3.6, liquidHeight: 2.6, gasHeightRef: 6.4, maxHeight: 7.2, minHeadspace: 0.55 };

/**
 * Heights of the condensed column and the piston for the current state.
 * `solidExpansion` makes the solid column taller or shorter than the same
 * substance as liquid — the ice-floats number, drawn.
 */
export function columnHeights(substance, pressureAtm, tempC, composition) {
  const s = substanceFor(substance);
  const C = CONTAINER;
  const solidH = C.liquidHeight * s.solidExpansion * composition.solid;
  const liquidH = C.liquidHeight * composition.liquid;
  const condensed = solidH + liquidH;
  const TK = Math.max(tempC + C_TO_K, 1);
  // The gas column — the compressed map of nRT/P.
  const gasFull = clamp((C.gasHeightRef * (TK / 300)) / Math.max(pressureAtm, 0.05), C.minHeadspace, C.maxHeight);
  const gasH = composition.gas * Math.max(gasFull - condensed, C.minHeadspace) + (1 - composition.gas) * C.minHeadspace;
  const piston = clamp(condensed + gasH, C.minHeadspace, C.maxHeight);
  return { solidH, liquidH, condensed, piston, gasFull };
}

/** Real molar volumes, for the readout's honest ratio. */
export function molarVolumes(substance, pressureAtm, tempC) {
  const s = substanceFor(substance);
  const TK = Math.max(tempC + C_TO_K, 1);
  // Liquid densities near the transition, kg/m³ — rough, for the ratio.
  const liquidDensity = { water: 958, neon: 1207, co2: 1180 }[substance] ?? 1000;
  const liquidM3 = s.molarMassKg / liquidDensity;
  const gasM3 = (R * TK) / (pressureAtm * 101325);
  return { liquidL: liquidM3 * 1000, gasL: gasM3 * 1000, ratio: gasM3 / liquidM3 };
}

// ─── The gas cylinder ───────────────────────────────────────────────
// A separate scene from the heating curve above: a fixed-bore cylinder
// with a sliding piston, where the sliders are temperature, the piston
// position and how many particles are in there.

/** The reference point the pressure scale is pinned to: 60 particles at 300 K in unit volume. */
export const GAS_REFERENCE = { particles: 60, tempK: 300, pressureKPa: 101 };

/**
 * Pressure in the cylinder, and the pV product that Boyle and Charles say
 * must not move when only one of p, V and T does.
 *
 * p ∝ NT/V, normalised so the reference point above reads one atmosphere.
 * This is deliberately NOT nRT/V in SI: 60 particles is not a mole, and the
 * scene's volume slider is a fraction of the bore rather than litres, so an
 * absolute ideal-gas pressure would be a meaningless number. What has to be
 * true is the proportionality, and that is what this shows.
 *
 * `volume` is clamped away from zero because the piston slider reaches it.
 */
export function gasLawReadout({ temperature = 300, volume = 1, particles = 60 } = {}) {
  const safeVolume = Math.max(0.05, Number(volume) || 0);
  const safeTempK = Math.max(1, Number(temperature) || 0);
  const safeParticles = Math.max(1, Math.round(Number(particles) || 0));
  const { particles: n0, tempK: T0, pressureKPa: p0 } = GAS_REFERENCE;
  const pressureKPa = (p0 * (safeParticles / n0) * (safeTempK / T0)) / safeVolume;
  return {
    particles: safeParticles,
    temperatureK: safeTempK,
    volume: safeVolume,
    pressureKPa,
    /** p·V — constant along an isotherm, which is Boyle's law as a number. */
    pV: pressureKPa * safeVolume,
    /** p ÷ T — constant at fixed volume, which is the pressure law. */
    pOverT: pressureKPa / safeTempK,
  };
}
