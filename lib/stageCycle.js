// ─── Cyclical stage machines ────────────────────────────────────────
// The pure half of the "step through a cycle, or let it run" kit that the
// cell-division and cardiac-cycle scenes share (the React half, which runs
// the clock in `useFrame`, is `components/visualizations/stage-stepper.jsx`).
//
// `lib/timeline.js` answers "how far into a one-shot event are we". A cycle
// is different in two ways that matter to a stepper:
//
//   it wraps     cytokinesis is followed by interphase, ventricular filling
//                by the next atrial systole. Time is taken modulo the total,
//                and a lap counter says how many times round we have been.
//   it parks     each stage names a HOLD point — the moment inside it that
//                is the textbook picture of that stage (metaphase is the
//                plate, not the moment the last chromosome arrives). Stepping
//                tweens the clock to the hold point and stays there, so a
//                stage the student picks is a settled, distinct tableau
//                rather than a frame grabbed from a moving film.
//
// The stepper state itself is a plain object with a pure `tick`, so the whole
// machine — play, pause, next, prev, jump, arrest — is testable with no
// React or three.js in sight.
// ─────────────────────────────────────────────────────────────────────

import { clamp, smoothstep } from "./timeline.js";

export { clamp, smoothstep };

/** Wall seconds for a step-mode tween: a short hop and a long sweep. */
export const TWEEN_MIN_S = 0.45;
export const TWEEN_MAX_S = 1.6;
/** A tween covering the whole cycle takes this long; shorter hops scale down. */
export const TWEEN_FULL_CYCLE_S = 2.6;

/**
 * Lay the stages end to end. Each gets `start`, `end`, `hold` (absolute time
 * of its park point) and its index; the result carries the total length and
 * a lookup by key. `hold` on a stage is a fraction of its own duration and
 * defaults to the midpoint.
 */
export function makeCycle(stages) {
  let cursor = 0;
  const laid = stages.map((stage, index) => {
    const duration = Math.max(0, stage.duration ?? 0);
    const holdFraction = clamp(stage.hold ?? 0.5, 0, 1);
    const entry = {
      ...stage,
      index,
      duration,
      holdFraction,
      start: cursor,
      end: cursor + duration,
      hold: cursor + duration * holdFraction,
      short: stage.short ?? stage.label,
    };
    cursor += duration;
    return entry;
  });
  return { stages: laid, total: cursor, byKey: Object.fromEntries(laid.map((s) => [s.key, s])) };
}

/** Time taken modulo the cycle, always in [0, total). */
export function wrapTime(cycle, t) {
  const total = cycle.total;
  if (!(total > 0)) return 0;
  const v = Number.isFinite(t) ? t : 0;
  const m = v % total;
  return m < 0 ? m + total : m;
}

export const clampIndex = (cycle, index) => clamp(Math.round(Number(index) || 0), 0, Math.max(0, cycle.stages.length - 1));

/** The next (dir = +1) or previous (dir = −1) stage index, wrapping round. */
export function stepIndex(cycle, index, dir = 1) {
  const n = cycle.stages.length;
  if (n === 0) return 0;
  return (((clampIndex(cycle, index) + Math.sign(dir || 1)) % n) + n) % n;
}

export const stageAt = (cycle, ref) => (typeof ref === "number" ? cycle.stages[clampIndex(cycle, ref)] : cycle.byKey[ref]);

/** Absolute clock time at which a stage's tableau is parked. */
export const holdTime = (cycle, ref) => stageAt(cycle, ref)?.hold ?? 0;
export const startTime = (cycle, ref) => stageAt(cycle, ref)?.start ?? 0;

/**
 * Where a cycle is at (unwrapped) time `t`. `lap` counts completed cycles;
 * everything else is about the position within the current one.
 */
export function describeCycle(cycle, t) {
  const stages = cycle.stages;
  const raw = Number.isFinite(t) ? t : 0;
  const time = wrapTime(cycle, raw);
  if (stages.length === 0 || !(cycle.total > 0)) {
    return { t: 0, raw, index: -1, stage: null, label: "", short: "", stageT: 0, progress: 0, fraction: 0, lap: 0, count: 0 };
  }
  let current = stages[stages.length - 1];
  for (const s of stages) {
    if (s.duration > 0 && time < s.end) {
      current = s;
      break;
    }
  }
  const stageT = clamp(time - current.start, 0, current.duration);
  return {
    t: time,
    raw,
    index: current.index,
    stage: current.key,
    label: current.label,
    short: current.short,
    stageT,
    progress: current.duration > 0 ? stageT / current.duration : 1,
    fraction: time / cycle.total,
    lap: Math.floor(raw / cycle.total),
    count: stages.length,
  };
}

/**
 * Eased 0 → 1 through one stage at cycle time `t`: 0 before it starts, 1 once
 * it is over, `ease`d in between. Scenes hang their animation off this.
 */
export function stageBlend(cycle, t, ref, ease = smoothstep) {
  const s = stageAt(cycle, ref);
  if (!s) return 0;
  const time = wrapTime(cycle, t);
  if (s.duration <= 0) return time >= s.start ? 1 : 0;
  return ease(clamp((time - s.start) / s.duration, 0, 1));
}

/** 1 while inside the stage, 0 outside (with optional eased shoulders, in cycle seconds). */
export function stageWindow(cycle, t, ref, shoulder = 0) {
  const s = stageAt(cycle, ref);
  if (!s) return 0;
  const time = wrapTime(cycle, t);
  if (shoulder <= 0) return time >= s.start && time < s.end ? 1 : 0;
  const rise = smoothstep(clamp((time - (s.start - shoulder)) / shoulder, 0, 1));
  const fall = 1 - smoothstep(clamp((time - (s.end - shoulder)) / shoulder, 0, 1));
  return Math.min(rise, fall);
}

/**
 * Signed displacement from cycle time `from` to `to`. By default the shorter
 * way round (so stepping back one stage rewinds rather than laps the whole
 * cycle); `forwardOnly` never rewinds, which is what an arrest wants — a cell
 * poisoned in anaphase cannot un-separate its chromatids; it runs on and is
 * caught at the NEXT metaphase.
 */
export function cycleDelta(cycle, from, to, { forwardOnly = false } = {}) {
  const total = cycle.total;
  if (!(total > 0)) return 0;
  const forward = wrapTime(cycle, wrapTime(cycle, to) - wrapTime(cycle, from));
  if (forwardOnly) return forward;
  return forward > total / 2 ? forward - total : forward;
}

/** Wall seconds a tween of `delta` cycle seconds should take. */
export function tweenDuration(cycle, delta) {
  if (!(cycle.total > 0)) return TWEEN_MIN_S;
  return clamp((Math.abs(delta) / cycle.total) * TWEEN_FULL_CYCLE_S, TWEEN_MIN_S, TWEEN_MAX_S);
}

// ─── The stepper ────────────────────────────────────────────────────

/**
 * A stepper is:
 *   t          the unwrapped clock (so laps can be counted)
 *   index      the discrete stage the HUD shows — the target in step mode,
 *              the stage under the playhead in play mode
 *   playing    running continuously (true) or parked at a hold point (false)
 *   lock       a stage index the clock may not pass (an arrest), or null
 *   tween      { from, to, elapsed, duration } while easing to a hold point
 *   arrested   true when the clock is sitting on the lock
 */
export function createStepper(cycle, { index = 0, playing = false, lock = null } = {}) {
  const i = clampIndex(cycle, index);
  return { t: holdTime(cycle, i), index: i, playing, lock: lock === null || lock === undefined ? null : clampIndex(cycle, lock), tween: null, arrested: false };
}

/** Where the clock should park for `index`, honouring the lock. */
function targetFor(cycle, state, index) {
  const i = clampIndex(cycle, index);
  return state.lock !== null && i > state.lock ? state.lock : i;
}

/** Begin (or restart, from wherever we are) a tween to a stage's hold point. */
function startTween(cycle, state, index, { forwardOnly = false } = {}) {
  const to = holdTime(cycle, index);
  const delta = cycleDelta(cycle, state.t, to, { forwardOnly });
  if (Math.abs(delta) < 1e-6) return { ...state, index, t: state.t, tween: null };
  return { ...state, index, tween: { from: state.t, to: state.t + delta, elapsed: 0, duration: tweenDuration(cycle, delta) } };
}

/** Jump to a stage. Stepping tweens there; playing cuts to its start and keeps running. */
export function stepperJump(cycle, state, index) {
  const i = targetFor(cycle, state, index);
  if (state.playing) {
    return { ...state, index: i, t: startTime(cycle, i), tween: null, arrested: false };
  }
  return { ...startTween(cycle, state, i, { forwardOnly: false }), arrested: false };
}

export const stepperNext = (cycle, state) => stepperJump(cycle, state, stepIndex(cycle, state.index, 1));
export const stepperPrev = (cycle, state) => stepperJump(cycle, state, stepIndex(cycle, state.index, -1));

/** Play from wherever the clock is (a parked stage resumes mid-stage, which is what a film does). */
export function stepperPlay(cycle, state) {
  return { ...state, playing: true, tween: null };
}

/** Pause: the discrete index becomes whatever is under the playhead; no tween — the picture just stops. */
export function stepperPause(cycle, state) {
  const d = describeCycle(cycle, state.t);
  return { ...state, playing: false, index: d.index, tween: null };
}

/**
 * Arrest the cycle at a stage (or release it with `null`). Whatever is
 * happening, the clock may not pass that stage's hold point — playing, it
 * runs on to the NEXT one and stops there; stepping, the target is clamped.
 */
export function stepperLock(cycle, state, lock) {
  if (lock === null || lock === undefined) return { ...state, lock: null, arrested: false };
  const l = clampIndex(cycle, lock);
  const next = { ...state, lock: l };
  const hold = holdTime(cycle, l);
  if (state.playing) return { ...next, arrested: Math.abs(wrapTime(cycle, state.t) - hold) < 1e-6 };
  // Stepping: if we are parked beyond the lock, run forward round to it.
  const here = describeCycle(cycle, state.t);
  if (here.index > l || (here.index === l && wrapTime(cycle, state.t) > hold + 1e-6)) {
    return { ...startTween(cycle, next, l, { forwardOnly: true }), arrested: false };
  }
  if (next.index > l) return { ...startTween(cycle, next, l, { forwardOnly: false }), arrested: false };
  return next;
}

/**
 * Advance the clock by `dt` seconds while playing. `tempo`, if given, is a
 * per-stage rate — cycle seconds per second — as a function of the stage
 * index (or an array indexed by it); a stage with tempo 2 passes twice as
 * fast. The step is split at stage boundaries so each stretch runs at its
 * own tempo. A lock stops the clock at the lock's hold point. Returns the
 * new unwrapped time and whether the lock was hit.
 */
export function advanceCycle(cycle, t, dt, lock = null, tempo = null) {
  let remaining = Math.max(0, dt);
  if (!(cycle.total > 0)) return { t: t + remaining, hit: false };
  const rateOf = (index) => {
    if (tempo === null || tempo === undefined) return 1;
    const r = typeof tempo === "function" ? tempo(index) : tempo[index];
    return Number.isFinite(r) && r > 0 ? r : 1;
  };
  const hold = lock === null || lock === undefined ? null : holdTime(cycle, lock);
  let ahead = hold === null ? Infinity : cycleDelta(cycle, t, hold, { forwardOnly: true });
  if (hold !== null && ahead <= 1e-9) return { t, hit: true };
  let time = t;
  // Split at stage boundaries so each stretch runs at its own tempo.
  for (let guard = 0; guard < 64 && remaining > 1e-9; guard += 1) {
    const w = wrapTime(cycle, time);
    let index = cycle.stages.length - 1;
    for (const s of cycle.stages) {
      if (s.duration > 0 && w < s.end) {
        index = s.index;
        break;
      }
    }
    const stage = cycle.stages[index];
    const toEnd = Math.max(1e-9, stage.end - w);
    const rate = rateOf(index);
    const cover = Math.min(remaining * rate, toEnd, ahead);
    time += cover;
    ahead -= cover;
    remaining -= cover / rate;
    if (hold !== null && ahead <= 1e-9) return { t: time, hit: true };
  }
  return { t: time, hit: false };
}

/**
 * One frame. `dt` is wall seconds; `speed` and the per-stage `tempo` scale
 * the playing clock only — a step-mode tween keeps its wall-clock feel
 * whatever the speed slider says.
 */
export function stepperTick(cycle, state, dt, speed = 1, tempo = null) {
  const wall = Math.max(0, Number.isFinite(dt) ? dt : 0);
  if (state.playing) {
    const { t, hit } = advanceCycle(cycle, state.t, wall * Math.max(0, speed), state.lock, tempo);
    const index = describeCycle(cycle, t).index;
    return { ...state, t, index, tween: null, arrested: hit };
  }
  if (!state.tween) {
    const hold = state.lock === null ? null : holdTime(cycle, state.lock);
    const arrested = hold !== null && Math.abs(wrapTime(cycle, state.t) - hold) < 1e-6;
    return state.arrested === arrested ? state : { ...state, arrested };
  }
  const tw = state.tween;
  const elapsed = tw.elapsed + wall;
  if (elapsed >= tw.duration) {
    const hold = state.lock === null ? null : holdTime(cycle, state.lock);
    return { ...state, t: tw.to, tween: null, arrested: hold !== null && Math.abs(wrapTime(cycle, tw.to) - hold) < 1e-6 };
  }
  const k = smoothstep(elapsed / tw.duration);
  return { ...state, t: tw.from + (tw.to - tw.from) * k, tween: { ...tw, elapsed } };
}

/** What a scene reads every frame: the cycle description plus the machine's flags. */
export function stepperSnapshot(cycle, state) {
  const d = describeCycle(cycle, state.t);
  return {
    ...d,
    playing: state.playing,
    transitioning: state.tween !== null,
    arrested: state.arrested,
    lock: state.lock,
    /** How settled the tableau is: 1 parked or playing, dipping to 0 in the middle of a tween. */
    settled: state.tween ? 1 - Math.sin(Math.PI * clamp(state.tween.elapsed / state.tween.duration, 0, 1)) : 1,
    targetIndex: state.index,
  };
}
