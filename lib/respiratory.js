// ─── Respiratory mechanics ──────────────────────────────────────────
// Thoracic volume, intra-thoracic pressure and air flow through one
// breathing cycle, from Boyle's law.
//
// These numbers existed in three places and no two agreed. The auto-loop
// peaked at 3.50 L, the manual path lerped to 3.65 L, and the HUD's
// fallback string said 3.50 L; pressures diverged the same way
// (−0.28 / −0.32 / −0.28 kPa). A fourth copy lived in
// tests/unit/respiratory-mechanics.test.mjs, which imported nothing from
// the application and asserted against its own private implementation —
// so it passed regardless of what the scene did.
// ─────────────────────────────────────────────────────────────────────

/** How often the scene pushes the breath into React — 10 Hz, like the other drivers. */
export const PUSH_EVERY_S = 0.1;

export const RESPIRATORY_PHASES = {
  INSPIRATION: "inspiration",
  QUIET_EXPIRATION: "quiet_expiration",
  FORCED_EXPIRATION: "forced_expiration",
};

/** Atmospheric pressure, kPa. Every pressure below is relative to it. */
export const ATMOSPHERIC_KPA = 101.3;

/** Functional residual capacity — the volume the lungs rest at, litres. */
export const FRC_L = 2.8;

/** Tidal volume: what a quiet breath adds on top of FRC, litres. */
export const TIDAL_L = 0.7;

/** Expiratory reserve: what a forced breath drives out below FRC, litres. */
export const RESERVE_L = 0.85;

/**
 * Peak values for each phase, as one table.
 *
 * `expansion` is the normalised drive, −1 (fully forced out) to +1 (fully
 * in). Volume follows from it; pressure and flow are the peak magnitudes
 * reached mid-phase, and are zero at both ends of the breath.
 */
export const PHASE_PEAKS = {
  [RESPIRATORY_PHASES.INSPIRATION]: { expansion: 1, pressureKPa: -0.28, flowLps: -0.65, external: 0.85, internal: 0 },
  [RESPIRATORY_PHASES.QUIET_EXPIRATION]: { expansion: 0, pressureKPa: 0.22, flowLps: 0.52, external: 0, internal: 0 },
  [RESPIRATORY_PHASES.FORCED_EXPIRATION]: { expansion: -1, pressureKPa: 1.15, flowLps: 3.85, external: 0, internal: 1 },
};

/**
 * Thoracic volume for a normalised expansion, litres.
 *
 * Above FRC a breath adds tidal volume; below it, the larger expiratory
 * reserve comes out — which is why the curve is not symmetric about FRC.
 */
export function thoraxVolume(expansion) {
  const e = Math.max(-1, Math.min(1, Number(expansion) || 0));
  return Number((FRC_L + e * (e >= 0 ? TIDAL_L : RESERVE_L)).toFixed(2));
}

/** Fraction of the way through the inspiratory part of the cycle. */
export const INSPIRATION_FRACTION = 0.4;

/**
 * The whole cycle at normalised time `t` in [0, 1).
 *
 * Inspiration is an S-curve whose derivative starts at zero and matches the
 * mid-breath flow sine, so volume and flow stay consistent with each other
 * rather than being two independently drawn shapes.
 */
export function breathAt(t, { forced = false } = {}) {
  const u = ((Number(t) || 0) % 1 + 1) % 1;
  const inspiring = u < INSPIRATION_FRACTION;

  if (inspiring) {
    const k = u / INSPIRATION_FRACTION;
    const peak = PHASE_PEAKS[RESPIRATORY_PHASES.INSPIRATION];
    const swing = Math.sin(k * Math.PI);
    const expansion = 0.5 * (1 - Math.cos(k * Math.PI));
    return {
      phase: RESPIRATORY_PHASES.INSPIRATION,
      expansion,
      volumeL: thoraxVolume(expansion),
      pressureKPa: peak.pressureKPa * swing,
      flowLps: peak.flowLps * swing,
      external: peak.external * expansion,
      internal: 0,
    };
  }

  const k = (u - INSPIRATION_FRACTION) / (1 - INSPIRATION_FRACTION);
  const swing = Math.sin(k * Math.PI);
  const phase = forced ? RESPIRATORY_PHASES.FORCED_EXPIRATION : RESPIRATORY_PHASES.QUIET_EXPIRATION;
  const peak = PHASE_PEAKS[phase];
  // Quiet expiration relaxes from peak inspiration back to FRC and stops
  // there; a forced one carries straight on through FRC and drives the
  // expiratory reserve out below it, ending at −1.
  const expansion = forced ? Math.cos(k * Math.PI) : 0.5 * (1 + Math.cos(k * Math.PI));
  return {
    phase,
    expansion,
    volumeL: thoraxVolume(expansion),
    pressureKPa: peak.pressureKPa * swing,
    flowLps: peak.flowLps * swing,
    external: 0,
    internal: forced ? peak.internal * swing : 0,
  };
}

/** The resting tableau for a phase, for the manual (non-looping) mode. */
export function restingState(phase) {
  const key = PHASE_PEAKS[phase] ? phase : RESPIRATORY_PHASES.INSPIRATION;
  const peak = PHASE_PEAKS[key];
  return {
    phase: key,
    expansion: peak.expansion,
    volumeL: thoraxVolume(peak.expansion),
    pressureKPa: peak.pressureKPa,
    flowLps: peak.flowLps,
    external: peak.external,
    internal: peak.internal,
  };
}

export const phaseLabel = (phase) =>
  phase === RESPIRATORY_PHASES.INSPIRATION
    ? "Inspiration (active)"
    : phase === RESPIRATORY_PHASES.FORCED_EXPIRATION
      ? "Forced expiration (active)"
      : "Quiet expiration (passive)";

// ─── Muscles ────────────────────────────────────────────────────────

/**
 * Which muscles are doing the work in each phase.
 *
 * The antagonistic pair is the examinable bit: external intercostals raise
 * the ribs to breathe IN, internal intercostals pull them down to force air
 * OUT, and quiet expiration uses neither — it is elastic recoil, which is why
 * it costs nothing.
 */
export function muscleStates(phase) {
  switch (phase) {
    case RESPIRATORY_PHASES.INSPIRATION:
      return {
        external: { contracted: true, tension: 1.0, action: "elevate_ribs" },
        internal: { contracted: false, tension: 0.0, action: "relaxed" },
        diaphragm: { contracted: true, action: "flatten_down" },
      };
    case RESPIRATORY_PHASES.FORCED_EXPIRATION:
      return {
        external: { contracted: false, tension: 0.0, action: "relaxed" },
        internal: { contracted: true, tension: 1.0, action: "depress_ribs" },
        diaphragm: { contracted: false, action: "pushed_up_by_abdominals" },
      };
    default:
      // Quiet expiration is entirely passive.
      return {
        external: { contracted: false, tension: 0.0, action: "relaxed" },
        internal: { contracted: false, tension: 0.0, action: "relaxed" },
        diaphragm: { contracted: false, action: "recoil_up" },
      };
  }
}

/** Airflow from the pressure gradient: out when the thorax is above ambient. */
export const airflowFromPressure = (pressureKPa) => (Number(pressureKPa) || 0) * 3.35;
