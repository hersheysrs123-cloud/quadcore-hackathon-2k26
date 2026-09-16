// ─── Triggered timelines ────────────────────────────────────────────
// The pure half of the "press a button and an event plays out" kit that
// the pollination and lytic-cycle scenes share (the React half, which
// runs the clock in `useFrame`, is `components/visualizations/timeline-kit.jsx`).
//
// A timeline is an ordered list of stages, each with a duration in sim
// seconds. Everything a scene wants to know about "where are we" is a
// function of one number — the time since the trigger — and these
// helpers answer it: which stage, how far through it, whether a given
// stage has started or finished, and eased ramps for the animation to
// hang off. Nothing here knows about three.js or React.
// ─────────────────────────────────────────────────────────────────────

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 0 → 1 across [a, b], clamped either side. */
export const ramp = (t, a, b) => (b > a ? clamp((t - a) / (b - a), 0, 1) : t >= b ? 1 : 0);

/** Hermite ease of a 0–1 value. */
export const smoothstep = (x) => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};

/** A hump: rises over the first `peak` of [0,1] and falls back over the rest. */
export const pulse = (x, peak = 0.5) => {
  const k = clamp(x, 0, 1);
  return k < peak ? smoothstep(k / peak) : 1 - smoothstep((k - peak) / (1 - peak));
};

/**
 * Lay the stages end to end. Each gets `start`, `end` and its index; the
 * result carries the total length and a lookup by key.
 */
export function makeTimeline(stages) {
  let cursor = 0;
  const laid = stages.map((stage, index) => {
    const duration = Math.max(0, stage.duration ?? 0);
    const entry = { ...stage, index, duration, start: cursor, end: cursor + duration };
    cursor += duration;
    return entry;
  });
  return { stages: laid, total: cursor, byKey: Object.fromEntries(laid.map((s) => [s.key, s])) };
}

export function stageWindow(timeline, key) {
  const s = timeline.byKey[key];
  if (!s) throw new Error(`timeline: no stage "${key}"`);
  return s;
}

/** Progress through one stage at time `t`: 0 before it, 1 after it. */
export function stageProgress(timeline, key, t) {
  const s = stageWindow(timeline, key);
  return ramp(t, s.start, s.end);
}

export const stageStarted = (timeline, key, t) => t >= stageWindow(timeline, key).start;
export const stageDone = (timeline, key, t) => t >= stageWindow(timeline, key).end;

/**
 * Where a timeline is at time `t`. Before the first stage (t ≤ 0 with no
 * stages started) `stage` is `null`; after the last it is the last stage
 * with `complete: true` and `progress: 1`.
 */
export function describeTimeline(timeline, t) {
  const time = clamp(Number.isFinite(t) ? t : 0, 0, timeline.total);
  const stages = timeline.stages;
  if (stages.length === 0) return { t: time, index: -1, stage: null, label: "", stageT: 0, progress: 0, fraction: 0, complete: true, started: false };
  let current = stages[stages.length - 1];
  for (const s of stages) {
    if (time < s.end || s.duration === 0) {
      current = s;
      if (time < s.end) break;
    }
  }
  const complete = time >= timeline.total;
  if (complete) current = stages[stages.length - 1];
  const stageT = clamp(time - current.start, 0, current.duration);
  const progress = current.duration > 0 ? stageT / current.duration : 1;
  return {
    t: time,
    index: current.index,
    stage: current.key,
    label: current.label,
    stageT,
    progress: complete ? 1 : progress,
    fraction: timeline.total > 0 ? time / timeline.total : 1,
    complete,
    started: time > 0,
    remaining: timeline.total - time,
  };
}

/** Step the clock: advance by `dt` (seconds × speed), holding at the end. */
export function advanceTimeline(timeline, t, dt) {
  return clamp(t + Math.max(0, dt), 0, timeline.total);
}
