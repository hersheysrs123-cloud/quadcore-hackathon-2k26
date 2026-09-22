import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AORTIC_DIASTOLIC,
  CARDIAC_CYCLE,
  CARDIAC_STAGES,
  EDV_REST,
  ESV_REST,
  MAX_BPM,
  MIN_BPM,
  beatSummary,
  beatTime,
  beatTimeline,
  conductionAt,
  cycleTimeAt,
  ecgAt,
  hemodynamicsAt,
  hemodynamicsAtCycle,
  soundMarkers,
  soundsAt,
  tempoFor,
  wiggersSamples,
} from "../../lib/cardiacCycle.js";

const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const KEYS = CARDIAC_STAGES.map((s) => s.key);

describe("Stages", () => {
  it("are five fixed fractions of one beat that sum to 1", () => {
    assert.deepEqual(KEYS, ["atrialSystole", "isoContraction", "ejection", "isoRelaxation", "filling"]);
    assert.ok(close(CARDIAC_CYCLE.total, 1));
  });
});

describe("Real time", () => {
  it("shortens diastole far more than systole as the rate climbs", () => {
    const slow = beatTimeline(40);
    const rest = beatTimeline(75);
    const fast = beatTimeline(180);
    assert.ok(close(rest.period, 0.8));
    assert.ok(rest.systoleFraction > 0.35 && rest.systoleFraction < 0.45, `rest systole ${rest.systoleFraction}`);
    assert.ok(slow.systoleFraction < rest.systoleFraction);
    assert.ok(fast.systoleFraction > 0.5, "at 180 bpm systole is more than half the beat");
    assert.ok(fast.durations.filling >= 0.12 * fast.period - 1e-9, "filling never drops below 12 % of the beat");
    assert.ok(fast.systole < rest.systole && rest.systole < slow.systole, "systole itself still shortens");
    for (const tl of [slow, rest, fast]) {
      const sum = Object.values(tl.durations).reduce((a, b) => a + b, 0);
      assert.ok(close(sum, tl.period, 1e-9));
    }
  });

  it("clamps the rate to the slider's range", () => {
    assert.equal(beatTimeline(10).bpm, MIN_BPM);
    assert.equal(beatTimeline(500).bpm, MAX_BPM);
  });

  it("gives the stepper a tempo that makes each stage last its real duration", () => {
    const tl = beatTimeline(120);
    const tempo = tempoFor(120);
    CARDIAC_STAGES.forEach((s, i) => {
      assert.ok(close(s.duration / tempo[i], tl.durations[s.key], 1e-9), `${s.key}: ${s.duration} cycle-s at tempo ${tempo[i]} lasts ${s.duration / tempo[i]} s`);
    });
    assert.ok(tempo[4] > tempo[2], "filling is squeezed harder than ejection");
  });

  it("maps cycle time to seconds and back", () => {
    assert.ok(close(beatTime(75, 0), 0));
    assert.ok(close(beatTime(75, 1), 0.8, 1e-6));
    for (const t of [0.05, 0.14, 0.3, 0.5, 0.9]) assert.ok(close(cycleTimeAt(75, beatTime(75, t)), t, 1e-6), `round trip ${t}`);
    assert.ok(close(cycleTimeAt(75, 0.8 + 0.1), cycleTimeAt(75, 0.1)), "wraps at the period");
  });
});

describe("Volumes and output", () => {
  it("rests at 120 / 50 mL, 70 mL stroke, 5.25 L/min, EF 58 %", () => {
    const s = beatSummary(75);
    assert.ok(close(s.edv, EDV_REST, 1e-6));
    assert.ok(close(s.esv, ESV_REST, 1e-6));
    assert.ok(close(s.strokeVolume, 70, 1e-6));
    assert.ok(close(s.cardiacOutput, 5.25, 1e-6));
    assert.ok(close(s.ejectionFraction, 70 / 120, 1e-6));
  });

  it("raises output with rate, but less than proportionally, because filling suffers", () => {
    const rest = beatSummary(75);
    const fast = beatSummary(180);
    assert.ok(fast.edv < rest.edv, "less time to fill");
    assert.ok(fast.strokeVolume < rest.strokeVolume);
    assert.ok(fast.cardiacOutput > rest.cardiacOutput);
    assert.ok(fast.cardiacOutput < rest.cardiacOutput * (180 / 75), "not 2.4×");
    const slow = beatSummary(40);
    assert.ok(close(slow.strokeVolume, 70, 1e-6), "a slow heart still fills fully");
    assert.ok(close(slow.cardiacOutput, 2.8, 1e-6));
  });

  it("pumps nothing in fibrillation and works against a gradient in stenosis", () => {
    const vf = beatSummary(75, "vfib");
    assert.equal(vf.strokeVolume, 0);
    assert.equal(vf.cardiacOutput, 0);
    const st = beatSummary(75, "stenosis");
    assert.ok(st.gradient > 60, `gradient ${st.gradient}`);
    assert.ok(st.peakLV > 180);
    assert.ok(st.peakAorta < beatSummary(75).peakAorta);
    assert.ok(st.strokeVolume < beatSummary(75).strokeVolume);
  });
});

describe("Hemodynamics through the beat", () => {
  it("is continuous across every stage boundary", () => {
    for (let i = 0; i < KEYS.length; i += 1) {
      const a = hemodynamicsAt(KEYS[i], 1, 75);
      const b = hemodynamicsAt(KEYS[(i + 1) % KEYS.length], 0, 75);
      assert.ok(Math.abs(a.vLV - b.vLV) < 0.5, `${KEYS[i]} → volume jumps ${a.vLV} → ${b.vLV}`);
      assert.ok(Math.abs(a.pLV - b.pLV) < 4, `${KEYS[i]} → LV pressure jumps ${a.pLV} → ${b.pLV}`);
      assert.ok(Math.abs(a.pAo - b.pAo) < 5, `${KEYS[i]} → aortic pressure jumps ${a.pAo} → ${b.pAo}`);
      assert.ok(Math.abs(a.valves.mitral - b.valves.mitral) < 0.2, `${KEYS[i]} → mitral jumps`);
      assert.ok(Math.abs(a.valves.aortic - b.valves.aortic) < 0.2, `${KEYS[i]} → aortic valve jumps`);
    }
  });

  it("holds the volume fixed while all four valves are shut", () => {
    for (const key of ["isoContraction", "isoRelaxation"]) {
      const v0 = hemodynamicsAt(key, 0.05, 75).vLV;
      const v1 = hemodynamicsAt(key, 0.95, 75).vLV;
      assert.ok(close(v0, v1, 1e-9), `${key} volume ${v0} → ${v1}`);
      const h = hemodynamicsAt(key, 0.7, 75);
      assert.ok(h.valves.mitral < 0.05 && h.valves.aortic < 0.05, `${key}: valves not all shut`);
    }
    assert.ok(close(hemodynamicsAt("isoContraction", 0.5, 75).vLV, EDV_REST, 1e-6));
    assert.ok(close(hemodynamicsAt("isoRelaxation", 0.5, 75).vLV, ESV_REST, 1e-6));
  });

  it("opens the semilunar valves only when ventricular pressure exceeds aortic, and the AV valves only in diastole", () => {
    const e = hemodynamicsAt("ejection", 0.4, 75);
    assert.ok(e.valves.aortic > 0.9 && e.valves.mitral === 0);
    assert.ok(e.pLV >= e.pAo, "the ventricle drives the aorta");
    assert.ok(e.pLV > 100 && e.pAo > 100);
    const f = hemodynamicsAt("filling", 0.5, 75);
    assert.ok(f.valves.mitral > 0.9 && f.valves.aortic === 0);
    assert.ok(f.pLV < f.pAo, "diastolic ventricle is far below the aorta");
    assert.ok(f.pAo >= AORTIC_DIASTOLIC - 1e-9);
    const a = hemodynamicsAt("atrialSystole", 0.5, 75);
    assert.ok(a.atrialSqueeze > 0.9, "the atria squeeze in atrial systole");
    assert.ok(a.vLV > f.vLV, "the atrial kick tops the ventricle up");
  });

  it("ejects the stroke volume and swings the aorta between 80 and 120", () => {
    const w = wiggersSamples(75, "normal", 200);
    const vols = w.samples.map((s) => s.vLV);
    const ao = w.samples.map((s) => s.pAo);
    const lv = w.samples.map((s) => s.pLV);
    assert.ok(close(Math.max(...vols), EDV_REST, 0.5));
    assert.ok(close(Math.min(...vols), ESV_REST, 0.5));
    assert.ok(Math.min(...ao) >= AORTIC_DIASTOLIC - 0.5 && Math.min(...ao) < 84);
    assert.ok(Math.max(...ao) >= 118 && Math.max(...ao) <= 122);
    assert.ok(Math.max(...lv) > Math.max(...ao));
    assert.ok(Math.min(...lv) < 10);
  });

  it("puts the S1 and S2 markers where the valves shut", () => {
    const m = soundMarkers(75);
    const tl = beatTimeline(75);
    assert.ok(m.s1 * tl.period > tl.starts.isoContraction && m.s1 * tl.period < tl.starts.ejection, "S1 inside isovolumetric contraction");
    assert.ok(m.s2 * tl.period > tl.starts.isoRelaxation && m.s2 * tl.period < tl.starts.filling, "S2 inside isovolumetric relaxation");
    assert.ok(soundsAt("isoContraction", 0.22).s1 > 0.95);
    assert.ok(soundsAt("isoRelaxation", 0.12).s2 > 0.95);
    assert.equal(soundsAt("ejection", 0.5, "normal").murmur, 0);
    assert.ok(soundsAt("ejection", 0.5, "stenosis").murmur > 0.9, "the stenotic murmur peaks mid-ejection");
    assert.equal(soundsAt("isoContraction", 0.22, "vfib").s1, 0, "no sounds in fibrillation");
  });
});

describe("Electrical", () => {
  it("draws P, QRS and T in the right stages", () => {
    assert.ok(ecgAt("atrialSystole", 0.3) > 0.1, "P wave");
    assert.ok(ecgAt("isoContraction", 0.36) > 1, "R spike");
    assert.ok(ecgAt("isoContraction", 0.6) < 0, "S dip");
    assert.ok(ecgAt("ejection", 0.78) > 0.25, "T wave");
    assert.ok(Math.abs(ecgAt("filling", 0.5)) < 0.01, "isoelectric in diastole");
    assert.ok(ecgAt("isoContraction", 0.36, "stenosis") > ecgAt("isoContraction", 0.36, "normal"), "LVH: taller R");
  });

  it("walks the impulse SA → atria → AV → His → Purkinje", () => {
    assert.ok(conductionAt("atrialSystole", 0.05).sa > 0.9);
    assert.ok(conductionAt("atrialSystole", 0.5).atria === 1);
    assert.ok(conductionAt("atrialSystole", 0.75).av > 0.9);
    assert.ok(conductionAt("isoContraction", 0.12).his > 0.9);
    assert.ok(conductionAt("isoContraction", 0.6).purkinje === 1);
    assert.equal(conductionAt("filling", 0.5).purkinje, 0);
  });

  it("fibrillation has no pathway, a chaotic trace, flat pressures and a draining aorta", () => {
    const c = conductionAt("ejection", 0.5, "vfib");
    assert.equal(c.chaos, 1);
    assert.equal(c.sa + c.av + c.his + c.purkinje, 0);
    const early = hemodynamicsAt("ejection", 0.5, 75, "vfib", { vfTime: 0 });
    const late = hemodynamicsAt("ejection", 0.5, 75, "vfib", { vfTime: 20 });
    assert.ok(late.pAo < early.pAo, "aortic pressure decays");
    assert.ok(early.pLV < 25 && late.pLV < 25, "no ventricular pressure");
    assert.equal(early.valves.aortic, 0);
    const trace = wiggersSamples(75, "vfib", 100).samples.map((s) => s.ecg);
    assert.ok(Math.max(...trace) > 0.2 && Math.min(...trace) < -0.2, "wobbles both ways");
    assert.ok(!trace.some((v) => v > 1), "no R spikes");
  });
});

describe("hemodynamicsAtCycle", () => {
  it("resolves a cycle time to its stage and progress", () => {
    const h = hemodynamicsAtCycle(0.17 + 0.15, 75);
    assert.equal(h.stage, "ejection");
    assert.ok(close(h.progress, 0.5, 1e-6));
    assert.equal(hemodynamicsAtCycle(1.05, 75).stage, "atrialSystole", "wraps");
  });
});
