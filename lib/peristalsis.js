// ─── Peristalsis ────────────────────────────────────────────────────
// The model behind the digestive-transit scene: a bolus pushed along a
// muscular tube by a travelling wave of smooth-muscle contraction.
//
// Two muscle layers do it between them, and the scene lives or dies on the
// student seeing that they act in DIFFERENT places at the same moment:
//
//   circular muscle     contracts BEHIND the bolus — the ring closes and the
//                       lumen narrows, so there is nowhere to go but forward;
//   longitudinal muscle contracts AHEAD of the bolus — the segment shortens
//                       and widens, the circular layer there relaxes, and the
//                       tube opens to receive the bolus.
//
// Everything is in centimetres and seconds of gut time. The wave is a clock:
// once a swallow is triggered the constriction moves down the tube at a
// speed the bolus consistency sets, and the bolus is wherever the wave has
// pushed it. Gravity never enters the wave equation, which is the whole
// point — hold the tube upside-down and the food still arrives.
// ─────────────────────────────────────────────────────────────────────

import { profileRadius, squeezeBody } from "./tubeTransit.js";

/** Length of the tube on show — an adult oesophagus, cm. */
export const TUBE_LENGTH_CM = 25;

/** Resting inner radius of the lumen, cm. */
export const LUMEN_RADIUS_CM = 1.0;

/** Speed of a primary oesophageal peristaltic wave, cm/s. */
export const BASE_WAVE_SPEED_CM_S = 3.5;

/**
 * The constriction sits this far BEHIND the bolus centre, and the receptive
 * relaxation this far AHEAD of it, cm. Textbook diagrams put the ring right
 * on the tail of the bolus and the widening just past its nose.
 */
export const CONSTRICTION_LAG_CM = 2.4;
export const RELAXATION_LEAD_CM = 2.6;

/** Half-widths of the two zones, cm (see `bump` in tubeTransit). */
export const CONSTRICTION_WIDTH_CM = 1.4;
export const RELAXATION_WIDTH_CM = 2.2;

/** How far the circular ring closes, and how far the segment ahead opens. */
export const CONSTRICTION_DEPTH = 0.78;
export const RELAXATION_DILATION = 0.28;

/**
 * The three things a student can swallow. `waveFactor` scales the wave
 * speed — a hard dry lump needs stronger, slower contractions (and often a
 * second wave). `gravitySlip` is how fast, in cm/s, the material runs AHEAD
 * of the wave when gravity helps: water pours, mush sags a little, a dry
 * bolus does not move until it is pushed. `restRadius`/`restHalf` give the
 * bolus's shape at rest, cm; `compliance` how completely it takes the shape
 * of the tube (see `squeezeBody`).
 */
export const CONSISTENCIES = {
  liquid: {
    label: "Water · liquid",
    short: "Liquid",
    waveFactor: 1.0,
    gravitySlip: 2.2,
    restRadius: 0.75,
    restHalf: 1.6,
    compliance: 1.0,
    note: "Pours ahead of the wave when gravity helps; pooled against the ring when it does not",
  },
  soft: {
    label: "Soft masticated food",
    short: "Soft food",
    waveFactor: 0.85,
    gravitySlip: 0.5,
    restRadius: 0.95,
    restHalf: 1.3,
    compliance: 0.8,
    note: "Moulds to the lumen and rides the wave",
  },
  dry: {
    label: "Dry bolus",
    short: "Dry bolus",
    waveFactor: 0.6,
    gravitySlip: 0,
    restRadius: 1.15,
    restHalf: 1.1,
    compliance: 0.35,
    note: "Wider than the lumen — the wall has to stretch round it and the wave slows",
  },
};

/** Which way is up. `gravitySign` is +1 when gravity helps transit. */
export const ORIENTATIONS = {
  upright: { label: "Right-side up", short: "Upright", gravitySign: 1 },
  inverted: { label: "Upside-down", short: "Inverted", gravitySign: -1 },
};

/** Wall-clock pauses around a swallow, seconds. */
export const SWALLOW_DELAY_S = 0.6;
export const DELIVERED_HOLD_S = 1.4;

export const consistencyFor = (key) => CONSISTENCIES[key] ?? CONSISTENCIES.soft;
export const orientationFor = (key) => ORIENTATIONS[key] ?? ORIENTATIONS.upright;

/** Wave speed for a consistency, cm/s. Gravity is deliberately absent. */
export function waveSpeed(consistencyKey) {
  return BASE_WAVE_SPEED_CM_S * consistencyFor(consistencyKey).waveFactor;
}

/**
 * Speed the bolus actually moves at, cm/s. It rides the wave; if gravity is
 * helping, a runny bolus can also pour ahead of it. If gravity opposes, it
 * cannot fall back — the closed ring behind it is in the way — so it goes at
 * exactly the wave's speed. That asymmetry IS the lesson.
 */
export function bolusSpeed(consistencyKey, orientationKey) {
  const c = consistencyFor(consistencyKey);
  const o = orientationFor(orientationKey);
  return waveSpeed(consistencyKey) + Math.max(0, o.gravitySign * c.gravitySlip);
}

/** Where the bolus centre starts — just inside the mouth end, cm. */
export const BOLUS_START_CM = 2.0;

/** Distance the bolus travels before it is delivered into the stomach, cm. */
export const TRANSIT_DISTANCE_CM = TUBE_LENGTH_CM - BOLUS_START_CM;

/** Seconds for the bolus to travel the whole tube. */
export function transitTime(consistencyKey, orientationKey) {
  return TRANSIT_DISTANCE_CM / bolusSpeed(consistencyKey, orientationKey);
}

/**
 * Where everything is `t` seconds after the wave starts. Positions are cm
 * from the mouth end. The ring starts on the tail of the bolus and follows
 * it down at the wave speed; a bolus that outruns the wave (liquid, gravity
 * helping) gets ahead of it, and the readouts say so. Once the bolus has
 * been delivered the ring runs the last of its distance and the wave is
 * complete.
 */
export function transitAt(consistencyKey, orientationKey, t) {
  const v = waveSpeed(consistencyKey);
  const vb = bolusSpeed(consistencyKey, orientationKey);
  const clock = Math.max(0, t);
  const bolus = Math.min(TUBE_LENGTH_CM, BOLUS_START_CM + vb * clock);
  const constriction = Math.min(BOLUS_START_CM - CONSTRICTION_LAG_CM + v * clock, bolus - CONSTRICTION_LAG_CM);
  const relaxation = bolus + RELAXATION_LEAD_CM;
  const delivered = bolus >= TUBE_LENGTH_CM - 1e-9;
  const complete = delivered && constriction >= bolus - CONSTRICTION_LAG_CM - 1e-9;
  return {
    t: clock,
    bolus,
    constriction,
    relaxation,
    bolusSpeed: delivered ? 0 : vb,
    waveSpeed: complete ? 0 : v,
    ahead: Math.max(0, bolus - (constriction + CONSTRICTION_LAG_CM)),
    delivered,
    complete,
  };
}

/**
 * The muscle "features" for the tube profile at one instant — what the
 * shared tube geometry narrows and widens by. Constriction behind the
 * bolus, dilation ahead. Both are gone when there is no wave.
 */
export function waveFeatures(state) {
  if (!state) return [];
  return [
    { centre: state.constriction, width: CONSTRICTION_WIDTH_CM, depth: CONSTRICTION_DEPTH },
    { centre: state.relaxation, width: RELAXATION_WIDTH_CM, depth: -RELAXATION_DILATION },
  ];
}

/**
 * The wall stretched round a bolus that is wider than the lumen it is in:
 * a dilation feature at the bolus, or null if it fits. A dry bolus is the
 * case — it will not take the tube's shape, so the tube takes its.
 */
export function bolusFeature(state, consistencyKey) {
  if (!state) return null;
  const c = consistencyFor(consistencyKey);
  const lumen = profileRadius(state.bolus, LUMEN_RADIUS_CM, waveFeatures(state));
  const body = squeezeBody(c.restRadius, c.restHalf, lumen, c.compliance);
  if (body.radius <= lumen + 1e-9) return null;
  return { centre: state.bolus, width: c.restHalf * 0.85, depth: -(body.radius - lumen) / LUMEN_RADIUS_CM };
}

/** Everything the lumen profile is made of at one instant. */
export function lumenFeatures(state, consistencyKey) {
  const wave = waveFeatures(state);
  const bolus = bolusFeature(state, consistencyKey);
  return bolus ? [...wave, bolus] : wave;
}

/**
 * Activation of each muscle layer at a station `s` along the tube, 0–1.
 * Circular peaks at the constriction; longitudinal peaks in the relaxation
 * zone ahead — it is the LONGITUDINAL layer contracting there that shortens
 * and widens the segment, while the circular layer there lets go.
 */
export function layerActivation(s, state) {
  if (!state) return { circular: 0, longitudinal: 0 };
  const dc = (s - state.constriction) / CONSTRICTION_WIDTH_CM;
  const dr = (s - state.relaxation) / RELAXATION_WIDTH_CM;
  return {
    circular: Math.exp(-dc * dc),
    longitudinal: Math.exp(-dr * dr),
  };
}

/**
 * Solve the fixed facts of one swallow: speeds, transit time, and the
 * one-line verdict on gravity.
 */
export function solvePeristalsis({ consistency = "soft", orientation = "upright" } = {}) {
  const cKey = CONSISTENCIES[consistency] ? consistency : "soft";
  const oKey = ORIENTATIONS[orientation] ? orientation : "upright";
  const c = CONSISTENCIES[cKey];
  const o = ORIENTATIONS[oKey];
  const wave = waveSpeed(cKey);
  const bolus = bolusSpeed(cKey, oKey);
  const slip = bolus - wave;
  return {
    consistency: cKey,
    consistencyLabel: c.label,
    orientation: oKey,
    orientationLabel: o.label,
    gravityHelps: o.gravitySign > 0,
    waveSpeed: wave,
    bolusSpeed: bolus,
    gravitySlip: slip,
    transitTime: TRANSIT_DISTANCE_CM / bolus,
    /** Transit if the wave alone did the work — the upside-down figure. */
    transitTimeNoGravity: TRANSIT_DISTANCE_CM / wave,
    lumenFit: c.restRadius <= LUMEN_RADIUS_CM ? "fits" : "distends",
  };
}

export const formatCm = (cm) => `${cm.toFixed(1)} cm`;
export const formatCmS = (v) => `${v.toFixed(2)} cm/s`;
