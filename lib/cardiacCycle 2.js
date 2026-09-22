// ─── The cardiac cycle ──────────────────────────────────────────────
// The physiology behind the four-chamber heart scene, built so that one
// beat can be read three ways at once and they always agree:
//
//   the anatomy   which chambers are squeezing, which valve leaflets are
//                 open, how full the ventricle is
//   the traces    a Wiggers diagram — ventricular and aortic pressure,
//                 ventricular volume — an ECG, and the heart sounds
//   the wiring    where the impulse is: SA node → atria → AV node → bundle
//                 of His → Purkinje fibres → ventricles
//
// The beat is a cycle of five stages (`lib/stageCycle.js`) whose durations
// are FIXED FRACTIONS of one beat, so the stepper can park on "ejection"
// whatever the heart rate. Real time is layered on top: `beatTimeline(bpm)`
// says how many seconds each stage actually lasts at that rate (diastole
// shrinks far more than systole as the rate climbs), and `tempoFor(bpm)`
// turns that into the per-stage rate the stepper plays at. Every quantity
// below is a function of (stage, progress through it, rate, pathology) —
// nothing here knows about three.js or React.
// ─────────────────────────────────────────────────────────────────────

import { clamp, makeCycle, smoothstep } from "./stageCycle.js";

export const MIN_BPM = 40;
export const MAX_BPM = 180;
export const REST_BPM = 75;

/** Resting volumes, mL, and the pressures the aorta swings between, mmHg. */
export const EDV_REST = 120;
export const ESV_REST = 50;
export const AORTIC_DIASTOLIC = 80;
export const AORTIC_SYSTOLIC = 120;
/** Right-side pressures are about a fifth of the left's. */
export const RIGHT_SIDE_RATIO = 0.2;

export const PATHOLOGIES = {
  normal: {
    key: "normal",
    label: "Normal sinus rhythm",
    short: "Normal",
    summary: "SA node paces every beat; P–QRS–T in order, lub-dub on time.",
  },
  vfib: {
    key: "vfib",
    label: "Ventricular fibrillation",
    short: "V-fib",
    summary: "Chaotic ventricular electrical activity — the walls quiver, nothing is pumped, no valve closes cleanly, no heart sounds. A defibrillator emergency.",
  },
  stenosis: {
    key: "stenosis",
    label: "Aortic valve stenosis",
    short: "Aortic stenosis",
    summary: "Stiff, calcified aortic leaflets open only a third of the way. The left ventricle must generate far more pressure than reaches the aorta — a gradient you can hear as an ejection murmur.",
  },
};

export const pathologyFor = (key) => PATHOLOGIES[key] ?? PATHOLOGIES.normal;

// ─── Stages ─────────────────────────────────────────────────────────

/** Durations are fractions of one beat (they sum to 1); `hold` is the stepper's park point. */
export const CARDIAC_STAGES = [
  { key: "atrialSystole", label: "Atrial systole — atria squeeze, ventricles top up (P wave)", short: "Atrial systole", duration: 0.11, hold: 0.55 },
  { key: "isoContraction", label: "Isovolumetric contraction — AV valves snap shut: S1 'lub' (QRS)", short: "Isovol. contraction", duration: 0.06, hold: 0.55 },
  { key: "ejection", label: "Ventricular systole — semilunar valves open, blood ejected", short: "Ventricular systole", duration: 0.3, hold: 0.4 },
  { key: "isoRelaxation", label: "Isovolumetric relaxation — semilunar valves shut: S2 'dub' (end of T)", short: "Isovol. diastole", duration: 0.08, hold: 0.5 },
  { key: "filling", label: "Ventricular filling — AV valves open, passive diastole", short: "Ventricular filling", duration: 0.45, hold: 0.45 },
];

export const CARDIAC_CYCLE = makeCycle(CARDIAC_STAGES);

/** Which stages have the ventricle contracting — "mechanical systole". */
const SYSTOLIC = new Set(["isoContraction", "ejection"]);

// ─── Real time ──────────────────────────────────────────────────────

/**
 * Seconds each stage lasts at a heart rate. Ventricular systole scales
 * roughly with the square root of the interval (Bazett); whatever is left
 * of the beat is filling, but never less than 12 % of it — at 180 bpm the
 * atria are contracting into ventricles that have barely relaxed.
 */
export function beatTimeline(bpm) {
  const rate = clamp(Number(bpm) || REST_BPM, MIN_BPM, MAX_BPM);
  const period = 60 / rate;
  const k = Math.sqrt(period / 0.8);
  const ideal = { atrialSystole: 0.1 * k, isoContraction: 0.05 * k, ejection: 0.26 * k, isoRelaxation: 0.07 * k };
  let sum = Object.values(ideal).reduce((a, b) => a + b, 0);
  const cap = 0.88 * period;
  const scale = sum > cap ? cap / sum : 1;
  const durations = {};
  for (const key of Object.keys(ideal)) durations[key] = ideal[key] * scale;
  sum *= scale;
  durations.filling = period - sum;
  let cursor = 0;
  const starts = {};
  for (const s of CARDIAC_STAGES) {
    starts[s.key] = cursor;
    cursor += durations[s.key];
  }
  const systole = durations.isoContraction + durations.ejection;
  return { bpm: rate, period, durations, starts, systole, diastole: period - systole, systoleFraction: systole / period };
}

/**
 * The per-stage rate for the stepper: cycle seconds per real second, so a
 * stage that is 30 % of the cycle but lasts 0.26 s plays at 0.3 / 0.26.
 */
export function tempoFor(bpm) {
  const tl = beatTimeline(bpm);
  return CARDIAC_STAGES.map((s) => s.duration / Math.max(1e-6, tl.durations[s.key]));
}

/** Real seconds into the beat for a cycle time (a fraction of one beat). */
export function beatTime(bpm, cycleT) {
  const tl = beatTimeline(bpm);
  const t = clamp(Number(cycleT) || 0, 0, 1);
  for (const s of CARDIAC_CYCLE.stages) {
    if (t < s.end || s.index === CARDIAC_CYCLE.stages.length - 1) {
      const p = s.duration > 0 ? clamp((t - s.start) / s.duration, 0, 1) : 1;
      return tl.starts[s.key] + p * tl.durations[s.key];
    }
  }
  return 0;
}

/** Cycle time (fraction of one beat) for a real time into the beat. */
export function cycleTimeAt(bpm, seconds) {
  const tl = beatTimeline(bpm);
  const t = ((seconds % tl.period) + tl.period) % tl.period;
  for (const s of CARDIAC_CYCLE.stages) {
    const start = tl.starts[s.key];
    const d = tl.durations[s.key];
    if (t < start + d || s.index === CARDIAC_CYCLE.stages.length - 1) return s.start + s.duration * clamp((t - start) / Math.max(1e-9, d), 0, 1);
  }
  return 0;
}

// ─── Volumes and output ─────────────────────────────────────────────

/**
 * How full the ventricle gets. Filling time falls with rate, so the
 * end-diastolic volume falls; sympathetic drive at high rates squeezes
 * harder, so the end-systolic volume falls too. Stenosis costs a little
 * stroke volume.
 */
export function beatSummary(bpm, pathology = "normal") {
  const p = pathologyFor(pathology);
  const tl = beatTimeline(bpm);
  const fill = Math.sqrt(clamp(tl.durations.filling / 0.32, 0, 1));
  const drive = clamp((tl.bpm - REST_BPM) / (MAX_BPM - REST_BPM), 0, 1);
  let edv = ESV_REST + (EDV_REST - ESV_REST) * fill;
  let esv = ESV_REST - 15 * drive;
  if (p.key === "stenosis") esv += 7;
  if (p.key === "vfib") {
    return { ...tl, pathology: p, edv, esv: edv, strokeVolume: 0, cardiacOutput: 0, ejectionFraction: 0, gradient: 0, meanAortic: 30 };
  }
  const strokeVolume = Math.max(0, edv - esv);
  const cardiacOutput = (strokeVolume * tl.bpm) / 1000;
  const peak = peakPressures(tl.bpm, p.key);
  return {
    ...tl,
    pathology: p,
    edv,
    esv,
    strokeVolume,
    cardiacOutput,
    ejectionFraction: edv > 0 ? strokeVolume / edv : 0,
    gradient: peak.lv - peak.aorta,
    peakLV: peak.lv,
    peakAorta: peak.aorta,
    diastolicAorta: peak.diastolic,
    meanAortic: peak.diastolic + (peak.aorta - peak.diastolic) / 3,
  };
}

/** Peak systolic pressures. Stenosis: the ventricle works against the valve, the aorta sees less. */
export function peakPressures(bpm, pathology = "normal") {
  const drive = clamp((clamp(Number(bpm) || REST_BPM, MIN_BPM, MAX_BPM) - REST_BPM) / (MAX_BPM - REST_BPM), 0, 1);
  const diastolic = AORTIC_DIASTOLIC + 12 * drive;
  if (pathology === "stenosis") return { lv: 190 + 15 * drive, aorta: 108 + 8 * drive, diastolic: diastolic - 4 };
  return { lv: AORTIC_SYSTOLIC + 4 + 15 * drive, aorta: AORTIC_SYSTOLIC + 15 * drive, diastolic };
}

// ─── Waveforms ──────────────────────────────────────────────────────

const bump = (x, centre, width) => Math.exp(-((x - centre) * (x - centre)) / (2 * width * width));

/** The stage-local ECG, mV: P in atrial systole, QRS at the start of contraction, T through late ejection. */
export function ecgAt(stage, p, pathology = "normal") {
  if (pathology === "vfib") return 0;
  const tallR = pathology === "stenosis" ? 1.55 : 1.15;
  switch (stage) {
    case "atrialSystole":
      return 0.16 * bump(p, 0.3, 0.13);
    case "isoContraction":
      return -0.16 * bump(p, 0.14, 0.05) + tallR * bump(p, 0.36, 0.06) - 0.28 * bump(p, 0.6, 0.06);
    case "ejection":
      return 0.32 * bump(p, 0.78, 0.13) + 0.02;
    case "isoRelaxation":
      return 0.32 * bump(p, -0.1, 0.35) * 0.35;
    default:
      return 0;
  }
}

/** Fibrillation: a chaotic sum of sines, a function of real time since onset. */
export function fibrillationEcg(t) {
  const s = Number(t) || 0;
  return 0.22 * Math.sin(s * 2 * Math.PI * 4.7) + 0.16 * Math.sin(s * 2 * Math.PI * 6.3 + 1.2) + 0.12 * Math.sin(s * 2 * Math.PI * 8.9 + 0.4) + 0.08 * Math.sin(s * 2 * Math.PI * 2.1 + 2.0);
}

/** Heart sounds: S1 as the AV valves shut, S2 as the semilunar valves shut, and a stenotic murmur between them. */
export function soundsAt(stage, p, pathology = "normal") {
  if (pathology === "vfib") return { s1: 0, s2: 0, murmur: 0, level: 0, label: "silent — no coordinated valve closure" };
  const s1 = stage === "isoContraction" ? bump(p, 0.22, 0.1) : 0;
  const s2 = stage === "isoRelaxation" ? bump(p, 0.12, 0.08) : 0;
  const murmur = pathology === "stenosis" && stage === "ejection" ? Math.sin(Math.PI * clamp((p - 0.12) / 0.78, 0, 1)) ** 1.4 : 0;
  const level = Math.max(s1, s2 * 0.8, murmur * 0.55);
  const label = s1 > 0.5 ? "S1 — 'lub' (mitral & tricuspid close)" : s2 > 0.5 ? "S2 — 'dub' (aortic & pulmonary close)" : murmur > 0.3 ? "crescendo–decrescendo ejection murmur" : "quiet";
  return { s1, s2, murmur, level, label };
}

/** Conduction: where the impulse is, each 0–1. `atria` and `purkinje` are sweeps across their tissue. */
export function conductionAt(stage, p, pathology = "normal") {
  if (pathology === "vfib") return { sa: 0, atria: 0, av: 0, his: 0, purkinje: 0, chaos: 1, label: "ventricular myocardium firing chaotically — no pathway" };
  const sa = stage === "atrialSystole" ? bump(p, 0.05, 0.08) : 0;
  const atria = stage === "atrialSystole" ? clamp(p / 0.5, 0, 1) : 0;
  const av = stage === "atrialSystole" ? bump(p, 0.75, 0.16) : stage === "isoContraction" ? bump(p, -0.05, 0.1) : 0;
  const his = stage === "isoContraction" ? bump(p, 0.12, 0.1) : 0;
  const purkinje = stage === "isoContraction" ? clamp((p - 0.1) / 0.5, 0, 1) : 0;
  const label =
    stage === "atrialSystole"
      ? p < 0.5
        ? "SA node fires → atria depolarise (P wave)"
        : "AV node delay — the ventricles wait for the atria to finish"
      : stage === "isoContraction"
        ? "bundle of His → bundle branches → Purkinje fibres (QRS)"
        : stage === "ejection"
          ? "ventricles depolarised · repolarising (T wave)"
          : "diastole — myocardium at rest";
  return { sa, atria, av, his, purkinje, chaos: 0, label };
}

/**
 * The hemodynamic state at a point in the beat. `vfTime` is real seconds
 * since fibrillation began (the aortic pressure decays away over it).
 *
 * Pressures in mmHg, volumes in mL; valves 0 (shut) → 1 (fully open);
 * `atrialSqueeze` and `ventricularSqueeze` are contraction amounts 0–1;
 * `wallTension` is the isovolumetric strain that thickens the wall with
 * no change in cavity volume.
 */
export function hemodynamicsAt(stage, progress, bpm, pathology = "normal", { vfTime = 0 } = {}) {
  const p = clamp(Number(progress) || 0, 0, 1);
  const path = pathologyFor(pathology).key;
  const sum = beatSummary(bpm, path);
  const s = CARDIAC_CYCLE.byKey[stage] ? stage : "filling";

  if (path === "vfib") {
    const t = Math.max(0, Number(vfTime) || 0);
    const quiver = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 7.3) * Math.sin(t * 2 * Math.PI * 2.9);
    const pAo = 30 + 55 * Math.exp(-t / 5);
    return {
      stage: s,
      progress: p,
      pLV: 12 + 6 * quiver,
      pAo,
      pLA: 10,
      pRV: (12 + 6 * quiver) * RIGHT_SIDE_RATIO,
      pPA: pAo * RIGHT_SIDE_RATIO,
      vLV: sum.edv * (0.98 + 0.02 * quiver),
      valves: { mitral: 0.35, tricuspid: 0.35, aortic: 0, pulmonary: 0 },
      atrialSqueeze: 0,
      ventricularSqueeze: 0,
      wallTension: 0.2 * quiver,
      quiver,
      ecg: fibrillationEcg(t),
      sounds: soundsAt(s, p, path),
      conduction: conductionAt(s, p, path),
      summary: sum,
      flow: { av: 0, semilunar: 0 },
    };
  }

  const { edv, esv, strokeVolume: sv } = sum;
  const peak = peakPressures(bpm, path);
  const stenosis = path === "stenosis";
  const aorticMax = stenosis ? 0.32 : 1;
  const closeAo = peak.aorta * 0.9;
  const edp = 10;
  let pLV;
  let pAo;
  let pLA;
  let vLV;
  let mitral;
  let aortic;
  let atrialSqueeze = 0;
  let ventricularSqueeze = 0;
  let wallTension = 0;
  let flowAV = 0;
  let flowSemi = 0;

  // The aorta decays from its closing pressure to its diastolic floor across everything but ejection.
  const diastolicDecay = (d) => peak.diastolic + (closeAo - peak.diastolic) * Math.pow(1 - clamp(d, 0, 1), 1.7);
  // Diastole (aortic valve shut) runs isoRelaxation → filling → atrialSystole → isoContraction.
  const relaxD = CARDIAC_CYCLE.byKey.isoRelaxation.duration;
  const fillD = CARDIAC_CYCLE.byKey.filling.duration;
  const atrialD = CARDIAC_CYCLE.byKey.atrialSystole.duration;
  const contractD = CARDIAC_CYCLE.byKey.isoContraction.duration;
  const diastoleTotal = relaxD + fillD + atrialD + contractD;
  const dFrac = (offset, d) => (offset + p * d) / diastoleTotal;

  switch (s) {
    case "atrialSystole": {
      atrialSqueeze = Math.sin(Math.PI * p) ** 0.9;
      pLA = 8 + 6 * atrialSqueeze;
      pLV = 7 + (edp - 7) * smoothstep(p);
      pAo = diastolicDecay(dFrac(relaxD + fillD, atrialD));
      vLV = esv + sv * (0.8 + 0.2 * smoothstep(p));
      mitral = 1 - 0.15 * smoothstep(clamp((p - 0.7) / 0.3, 0, 1));
      aortic = 0;
      flowAV = atrialSqueeze;
      break;
    }
    case "isoContraction": {
      mitral = 0.85 * (1 - smoothstep(clamp(p / 0.35, 0, 1)));
      aortic = 0;
      wallTension = smoothstep(p);
      ventricularSqueeze = 0.12 * wallTension;
      pLV = edp + (peak.diastolic + 1 - edp) * Math.pow(p, 1.6);
      pAo = diastolicDecay(dFrac(relaxD + fillD + atrialD, contractD));
      pLA = 8 + 3 * bump(p, 0.4, 0.2);
      vLV = edv;
      break;
    }
    case "ejection": {
      const ramp = smoothstep(clamp(p / 0.15, 0, 1));
      const closing = smoothstep(clamp((p - 0.85) / 0.15, 0, 1));
      aortic = aorticMax * ramp * (1 - closing);
      mitral = 0;
      // Both pressures start where the valve opened (aortic diastolic) and end
      // where it closes (closeAo); the humps ride on that baseline. The
      // ventricle peaks early; a stenotic aorta peaks late and low.
      const base = peak.diastolic + 1 + (closeAo - peak.diastolic - 1) * p;
      const lvHump = Math.sin(Math.PI * Math.pow(p, 0.75));
      pLV = base + (peak.lv - (peak.diastolic + 1 + (closeAo - peak.diastolic - 1) * 0.4)) * lvHump;
      const aoExp = stenosis ? 1.15 : 0.75;
      const aoPeakAt = Math.pow(0.5, 1 / aoExp);
      const aoHump = Math.sin(Math.PI * Math.pow(p, aoExp));
      pAo = base + (peak.aorta - (peak.diastolic + 1 + (closeAo - peak.diastolic - 1) * aoPeakAt)) * aoHump;
      pAo = Math.min(pAo, pLV - 1);
      pLA = 6 + 6 * smoothstep(p);
      vLV = esv + sv * Math.pow(1 - p, 1.8);
      ventricularSqueeze = 0.12 + 0.88 * (1 - Math.pow(1 - p, 1.8));
      wallTension = 1;
      flowSemi = aortic * (1 - p * 0.6);
      break;
    }
    case "isoRelaxation": {
      aortic = 0;
      mitral = 0;
      pLV = 6 + (closeAo - 2 - 6) * Math.pow(1 - p, 2.4);
      // The dicrotic notch: a small rebound as the leaflets snap shut.
      pAo = diastolicDecay(dFrac(0, relaxD)) + 4 * bump(p, 0.15, 0.1);
      pLA = 12 - 2 * p;
      vLV = esv;
      ventricularSqueeze = 1 - 0.1 * smoothstep(p);
      wallTension = 1 - smoothstep(p);
      break;
    }
    default: {
      // Filling: rapid at first (E), then diastasis.
      const rapid = smoothstep(clamp(p / 0.4, 0, 1));
      const slow = clamp((p - 0.4) / 0.6, 0, 1);
      mitral = smoothstep(clamp(p / 0.2, 0, 1));
      aortic = 0;
      vLV = esv + sv * (0.65 * rapid + 0.15 * slow);
      pLV = 6 - rapid + 2 * slow;
      pAo = diastolicDecay(dFrac(relaxD, fillD));
      pLA = 10 - 4 * rapid + 1 * slow;
      ventricularSqueeze = 0.9 * (1 - rapid) * 0.15;
      flowAV = mitral * (1 - rapid) * 0.9 + 0.15 * mitral;
      break;
    }
  }

  return {
    stage: s,
    progress: p,
    pLV,
    pAo,
    pLA,
    pRV: pLV * RIGHT_SIDE_RATIO,
    pPA: pAo * RIGHT_SIDE_RATIO,
    vLV,
    valves: { mitral, tricuspid: mitral, aortic, pulmonary: aortic / Math.max(aorticMax, 1e-6) },
    atrialSqueeze,
    ventricularSqueeze,
    wallTension,
    quiver: 0,
    ecg: ecgAt(s, p, path),
    sounds: soundsAt(s, p, path),
    conduction: conductionAt(s, p, path),
    summary: sum,
    flow: { av: flowAV, semilunar: flowSemi },
    gradient: Math.max(0, pLV - pAo),
    systolic: SYSTOLIC.has(s),
  };
}

/** Hemodynamics at a cycle time (fraction of one beat), for scenes reading the stepper clock. */
export function hemodynamicsAtCycle(cycleT, bpm, pathology = "normal", opts) {
  const t = ((Number(cycleT) % 1) + 1) % 1;
  let s = CARDIAC_CYCLE.stages[CARDIAC_CYCLE.stages.length - 1];
  for (const st of CARDIAC_CYCLE.stages) {
    if (t < st.end) {
      s = st;
      break;
    }
  }
  return hemodynamicsAt(s.key, s.duration > 0 ? (t - s.start) / s.duration : 1, bpm, pathology, opts);
}

/**
 * One beat sampled for a Wiggers diagram: `n` points across the real
 * beat duration, each with the traces that diagram stacks. Fibrillation
 * samples the chaotic ECG across the same window with flat pressures.
 */
export function wiggersSamples(bpm, pathology = "normal", n = 240) {
  const tl = beatTimeline(bpm);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const seconds = (i / (n - 1)) * tl.period;
    const ct = cycleTimeAt(bpm, seconds);
    const h = hemodynamicsAtCycle(ct, bpm, pathology, { vfTime: seconds + 4 });
    out.push({ t: seconds, fraction: i / (n - 1), cycleT: ct, pLV: h.pLV, pAo: h.pAo, pLA: h.pLA, vLV: h.vLV, ecg: h.ecg, sound: h.sounds.level, s1: h.sounds.s1, s2: h.sounds.s2, murmur: h.sounds.murmur });
  }
  return { samples: out, timeline: tl, summary: beatSummary(bpm, pathology) };
}

/** Where on the diagram the S1 and S2 markers go, as fractions of the beat. */
export function soundMarkers(bpm) {
  const tl = beatTimeline(bpm);
  const s1 = (tl.starts.isoContraction + 0.22 * tl.durations.isoContraction) / tl.period;
  const s2 = (tl.starts.isoRelaxation + 0.12 * tl.durations.isoRelaxation) / tl.period;
  return { s1, s2 };
}

/** The stage list the HUD's stepper renders. */
export const CARDIAC_STAGE_OPTIONS = CARDIAC_STAGES.map((s) => ({ key: s.key, label: s.label, short: s.short }));

export const formatBpm = (v) => `${Math.round(v)} bpm · ${(60 / clamp(Number(v) || REST_BPM, MIN_BPM, MAX_BPM)).toFixed(2)} s/beat`;
