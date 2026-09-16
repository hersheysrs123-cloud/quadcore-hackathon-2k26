// ─── The reflex arc ─────────────────────────────────────────────────
// The timing model behind the withdrawal-reflex scene: how long a nerve
// impulse takes to get from a burnt fingertip, up a sensory neuron, across
// the spinal cord, and back down a motor neuron to the biceps — and what a
// cut on either root does to it.
//
// Everything here is in milliseconds of PHYSIOLOGICAL time. The scene decides
// how many wall-clock milliseconds each of those is worth (real-time, or ten
// times slower so the stages can be watched), so nothing in this file knows
// about playback speed at all.
//
// The one number a student should take away is the total — about 30 ms from
// stimulus to the muscle being told to contract — and the shape of the
// breakdown: nearly all of it is the impulse travelling up the arm, and only
// a couple of milliseconds are spent inside the spinal cord itself.
// ─────────────────────────────────────────────────────────────────────

/** The two stimuli the candle can deliver. */
export const STIMULI = {
  warmth: {
    label: "Mild warmth",
    short: "Warmth",
    skinC: 40,
    /** Below the heat-pain threshold — warm receptors fire, nociceptors do not. */
    nociceptive: false,
    fibre: "C",
    /** Warm-receptor transduction is slow: the skin has to actually warm up. */
    receptorMs: 15,
  },
  flame: {
    label: "Painful burning flame (80 °C)",
    short: "80 °C flame",
    skinC: 80,
    nociceptive: true,
    fibre: "Adelta",
    /** Nociceptor transduction — the first impulse leaves within a few ms. */
    receptorMs: 2.5,
  },
};

/** The states of the arc's two spinal roots. */
export const PATHWAYS = {
  intact: { label: "Intact reflex", short: "Intact" },
  dorsal: { label: "Severed dorsal (sensory) root", short: "Dorsal root cut" },
  ventral: { label: "Severed ventral (motor) root", short: "Ventral root cut" },
};

/**
 * Nerve fibre classes and their conduction velocities, m/s.
 *
 * Myelination is the whole story here. Aδ fibres carry sharp "first pain"
 * and are what a withdrawal reflex runs on; C fibres are unmyelinated, an
 * order of magnitude slower, and carry warmth and the dull burning that
 * arrives well after the hand has already moved. Motor axons are the
 * thickest, fastest fibres in the body.
 */
export const FIBRES = {
  Adelta: { label: "Aδ (thin myelinated)", velocity: 33, myelinated: true, diameterUm: 3 },
  C: { label: "C (unmyelinated)", velocity: 2, myelinated: false, diameterUm: 1 },
  Aalpha: { label: "Aα motor (thick myelinated)", velocity: 90, myelinated: true, diameterUm: 15 },
};

/** Skin temperature above which heat nociceptors fire, °C. */
export const NOCICEPTOR_THRESHOLD_C = 43;

/** Fingertip to the cervical spinal cord along the arm, metres. */
export const SENSORY_PATH_M = 0.7;

/** Ventral root to the biceps motor end plates, metres. */
export const MOTOR_PATH_M = 0.35;

/**
 * Delay across one chemical synapse, ms — vesicle release, diffusion across
 * the cleft, and the post-synaptic membrane reaching threshold.
 */
export const SYNAPTIC_DELAY_MS = 0.6;

/** Time for the impulse to cross the short relay (inter)neuron, ms. */
export const INTERNEURON_MS = 0.4;

/** The neuromuscular junction is a synapse too, and a slightly slower one. */
export const NMJ_DELAY_MS = 0.8;

/**
 * Excitation–contraction coupling: from the muscle fibre depolarising to the
 * first measurable tension, ms. Calcium has to be released and cross-bridges
 * formed, which is why the arm visibly moves later than the impulse arrives.
 */
export const CONTRACTION_LATENT_MS = 8;

/** Rise time of the withdrawal contraction, ms. */
export const CONTRACTION_RISE_MS = 110;

/** How far along the sensory neuron the dorsal root lies (from the fingertip). */
export const DORSAL_ROOT_FRACTION = 0.93;

/** How far along the motor neuron the ventral root lies (from the cord). */
export const VENTRAL_ROOT_FRACTION = 0.1;

/** The five milestones every reflex arc is taught as. */
export const STAGES = [
  { key: "receptor", label: "Receptor", detail: "Nociceptor in the fingertip skin" },
  { key: "sensory", label: "Sensory neuron", detail: "Impulse up the arm to the dorsal root ganglion" },
  { key: "relay", label: "Relay neuron", detail: "Across the grey matter of the spinal cord" },
  { key: "motor", label: "Motor neuron", detail: "Out of the ventral root, down to the arm" },
  { key: "effector", label: "Effector", detail: "Biceps brachii contracts" },
];

export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/** Physiological ms per wall-clock ms at each playback setting. */
export const PLAYBACK = {
  realtime: { label: "Real-time", rate: 1 },
  slow: { label: "Slow-motion (10× slowed)", rate: 0.1 },
};

export const playbackRate = (slowMotion) => (slowMotion ? PLAYBACK.slow.rate : PLAYBACK.realtime.rate);

/** Milliseconds for an impulse to cover `metres` at `velocity` m/s. */
export const conductionMs = (metres, velocity) => (velocity > 0 ? (metres / velocity) * 1000 : Infinity);

export const stimulusFor = (key) => STIMULI[key] ?? STIMULI.flame;
export const pathwayFor = (key) => (PATHWAYS[key] ? key : "intact");

/**
 * Solve the whole arc for one stimulus and one pathway state.
 *
 * Returns the five stages with start/end times, whether each is reached, and
 * where (if anywhere) the impulse is stopped. A stage that is reached but
 * cannot pass its signal on is `blocked`; stages after a block are simply
 * never reached, and their times are kept only so the scene can still lay
 * the milestones out.
 */
export function solveReflex({ stimulus = "flame", pathway = "intact" } = {}) {
  const stim = stimulusFor(stimulus);
  const path = pathwayFor(pathway);
  const sensoryFibre = FIBRES[stim.fibre];
  const motorFibre = FIBRES.Aalpha;

  const receptorMs = stim.receptorMs;
  const sensoryMs = conductionMs(SENSORY_PATH_M, sensoryFibre.velocity);
  const relayMs = SYNAPTIC_DELAY_MS + INTERNEURON_MS + SYNAPTIC_DELAY_MS;
  const motorMs = conductionMs(MOTOR_PATH_M, motorFibre.velocity);
  const effectorMs = NMJ_DELAY_MS;

  const durations = [receptorMs, sensoryMs, relayMs, motorMs, effectorMs];
  let cursor = 0;
  const stages = STAGES.map((s, i) => {
    const start = cursor;
    cursor += durations[i];
    return { ...s, start, end: cursor, duration: durations[i], reached: false, blocked: false, blockAt: null };
  });

  // Where does the impulse stop?
  //
  // Three distinct reasons, and the scene must tell them apart because they
  // teach three different things: a sub-threshold stimulus never recruits the
  // motor side at all (the relay still sends the sensation to the brain); a
  // dorsal cut stops the impulse before it ever enters the cord, so nothing
  // is felt either; a ventral cut lets the whole sensory side through — the
  // pain is felt — but the order to move never reaches the muscle.
  let blockedAt = null;
  let blockFraction = null;
  let reason = null;
  if (path === "dorsal") {
    blockedAt = "sensory";
    blockFraction = DORSAL_ROOT_FRACTION;
    reason = "dorsal";
  } else if (!stim.nociceptive) {
    blockedAt = "relay";
    blockFraction = 1;
    reason = "threshold";
  } else if (path === "ventral") {
    blockedAt = "motor";
    blockFraction = VENTRAL_ROOT_FRACTION;
    reason = "ventral";
  }

  const blockIndex = blockedAt === null ? stages.length : STAGE_INDEX[blockedAt];
  for (let i = 0; i < stages.length; i += 1) {
    if (i < blockIndex) stages[i].reached = true;
    else if (i === blockIndex) {
      stages[i].reached = true;
      stages[i].blocked = true;
      stages[i].blockAt = blockFraction;
      // The impulse only travels as far as the cut.
      stages[i].end = stages[i].start + stages[i].duration * blockFraction;
    }
  }

  const fires = blockedAt === null;
  const responseMs = fires ? stages[stages.length - 1].end : null;
  const contractionStartMs = fires ? responseMs + CONTRACTION_LATENT_MS : null;
  const contractionPeakMs = fires ? contractionStartMs + CONTRACTION_RISE_MS : null;

  // The sensation reaches the brain whenever the impulse gets into the cord.
  const sensationReachesBrain = reason !== "dorsal";
  // Time the impulse leaves the cord for the brain: once the relay has fired.
  const brainDepartsMs = sensationReachesBrain ? stages[STAGE_INDEX.relay].start + SYNAPTIC_DELAY_MS : null;

  // Where the animation should stop: when the arm has finished moving, or —
  // if it never moves — a beat after the impulse has stopped.
  const lastReached = stages.filter((s) => s.reached).pop();
  const eventEndMs = fires ? contractionPeakMs : lastReached.end;

  return {
    stimulus: stimulus in STIMULI ? stimulus : "flame",
    pathway: path,
    skinC: stim.skinC,
    nociceptive: stim.nociceptive,
    sensoryFibre: stim.fibre,
    sensoryVelocity: sensoryFibre.velocity,
    motorVelocity: motorFibre.velocity,
    stages,
    fires,
    blockedAt,
    reason,
    responseMs,
    contractionStartMs,
    contractionPeakMs,
    sensationReachesBrain,
    brainDepartsMs,
    eventEndMs,
    /** The intact, painful figure — the headline number, for comparison. */
    intactResponseMs: receptorMs + conductionMs(SENSORY_PATH_M, FIBRES.Adelta.velocity) + relayMs + motorMs + effectorMs,
  };
}

/**
 * Which stage the impulse is in at physiological time `tMs`, and how far
 * through it. `index` is -1 before the stimulus and `stages.length` once the
 * whole chain is done; `stalled` is true once the impulse has hit a block.
 */
export function stageAt(solved, tMs) {
  if (!(tMs >= 0)) return { index: -1, key: null, progress: 0, stalled: false, done: false };
  const { stages } = solved;
  for (let i = 0; i < stages.length; i += 1) {
    const s = stages[i];
    if (!s.reached) break;
    if (tMs < s.end) {
      const span = s.end - s.start;
      const progress = span > 1e-9 ? (tMs - s.start) / span : 1;
      return { index: i, key: s.key, progress, stalled: false, done: false };
    }
    if (s.blocked) {
      return { index: i, key: s.key, progress: 1, stalled: true, done: false };
    }
  }
  return { index: stages.length, key: null, progress: 1, stalled: false, done: true };
}

/**
 * Milestones reached by time `tMs`, as a list of booleans in STAGES order.
 * A blocked stage counts as reached — the impulse did get there — which is
 * what lets the milestone row show exactly where the chain broke.
 */
export function milestonesAt(solved, tMs) {
  return solved.stages.map((s) => s.reached && tMs >= s.start);
}

/**
 * Biceps activation, 0–1, at physiological time `tMs`: nothing until the
 * latent period has passed, then a smooth rise to full contraction.
 */
export function contractionAt(solved, tMs) {
  if (!solved.fires || !(tMs >= solved.contractionStartMs)) return 0;
  const t = (tMs - solved.contractionStartMs) / CONTRACTION_RISE_MS;
  if (t >= 1) return 1;
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

/** Has the effector been triggered yet? */
export const effectorFiredAt = (solved, tMs) => solved.fires && tMs >= solved.responseMs;

/** Human-readable ms, to one decimal below 100 and none above. */
export const formatMs = (ms) => (ms === null || ms === undefined || !isFinite(ms) ? "—" : ms < 100 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`);
