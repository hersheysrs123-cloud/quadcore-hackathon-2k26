import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACTION_LATENT_MS,
  CONTRACTION_RISE_MS,
  DORSAL_ROOT_FRACTION,
  FIBRES,
  INTERNEURON_MS,
  MOTOR_PATH_M,
  NMJ_DELAY_MS,
  NOCICEPTOR_THRESHOLD_C,
  SENSORY_PATH_M,
  STAGES,
  STIMULI,
  SYNAPTIC_DELAY_MS,
  VENTRAL_ROOT_FRACTION,
  conductionMs,
  contractionAt,
  effectorFiredAt,
  formatMs,
  milestonesAt,
  playbackRate,
  solveReflex,
  stageAt,
} from "../../lib/reflexArc.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("Reflex arc timing model", () => {
  it("adds the five stages up to about 30 ms for a painful stimulus on an intact arc", () => {
    const s = solveReflex({ stimulus: "flame", pathway: "intact" });
    assert.ok(s.fires, "an intact arc with a painful stimulus fires");
    assert.equal(s.blockedAt, null);
    assert.ok(close(s.responseMs, 30, 0.5), `response should be ≈ 30 ms, got ${s.responseMs}`);
    assert.equal(s.stages.length, STAGES.length);
    assert.ok(s.stages.every((st) => st.reached && !st.blocked));
  });

  it("spends most of the delay on conduction up the arm, not in the cord", () => {
    const s = solveReflex({});
    const sensory = s.stages[1].duration;
    const relay = s.stages[2].duration;
    assert.ok(sensory > 0.6 * s.responseMs, "sensory conduction dominates");
    assert.ok(close(relay, 2 * SYNAPTIC_DELAY_MS + INTERNEURON_MS), "relay is two synapses plus the interneuron");
    assert.ok(close(sensory, conductionMs(SENSORY_PATH_M, FIBRES.Adelta.velocity)));
    assert.ok(close(s.stages[3].duration, conductionMs(MOTOR_PATH_M, FIBRES.Aalpha.velocity)));
    assert.ok(close(s.stages[4].duration, NMJ_DELAY_MS));
  });

  it("lays the stages end to end with no gaps", () => {
    const s = solveReflex({});
    for (let i = 1; i < s.stages.length; i += 1) {
      assert.ok(close(s.stages[i].start, s.stages[i - 1].end), `stage ${i} starts where ${i - 1} ends`);
    }
    assert.equal(s.stages[0].start, 0);
  });

  it("does not fire for warmth below the pain threshold, but still informs the brain", () => {
    assert.ok(STIMULI.warmth.skinC < NOCICEPTOR_THRESHOLD_C);
    assert.ok(STIMULI.flame.skinC > NOCICEPTOR_THRESHOLD_C);
    const s = solveReflex({ stimulus: "warmth", pathway: "intact" });
    assert.equal(s.fires, false);
    assert.equal(s.reason, "threshold");
    assert.equal(s.blockedAt, "relay");
    assert.equal(s.responseMs, null);
    assert.ok(s.sensationReachesBrain);
    assert.ok(s.stages[2].reached && s.stages[2].blocked);
    assert.ok(!s.stages[3].reached && !s.stages[4].reached);
  });

  it("carries warmth on slow unmyelinated C fibres — an order of magnitude slower", () => {
    const warm = solveReflex({ stimulus: "warmth" });
    const pain = solveReflex({ stimulus: "flame" });
    assert.equal(warm.sensoryFibre, "C");
    assert.equal(pain.sensoryFibre, "Adelta");
    assert.ok(!FIBRES.C.myelinated && FIBRES.Adelta.myelinated);
    assert.ok(warm.stages[1].duration > 10 * pain.stages[1].duration);
  });

  it("stops at the dorsal root when the sensory root is severed — nothing felt, nothing moves", () => {
    const s = solveReflex({ stimulus: "flame", pathway: "dorsal" });
    assert.equal(s.fires, false);
    assert.equal(s.blockedAt, "sensory");
    assert.equal(s.reason, "dorsal");
    assert.equal(s.sensationReachesBrain, false);
    assert.equal(s.brainDepartsMs, null);
    const sensory = s.stages[1];
    assert.ok(sensory.blocked);
    assert.ok(close(sensory.end, sensory.start + sensory.duration * DORSAL_ROOT_FRACTION), "the impulse only travels as far as the cut");
    assert.ok(!s.stages[2].reached);
  });

  it("lets the pain through but not the movement when the ventral root is severed", () => {
    const s = solveReflex({ stimulus: "flame", pathway: "ventral" });
    assert.equal(s.fires, false);
    assert.equal(s.blockedAt, "motor");
    assert.equal(s.reason, "ventral");
    assert.ok(s.sensationReachesBrain, "the sensory side is intact, so the pain is felt");
    assert.ok(s.stages[2].reached && !s.stages[2].blocked);
    const motor = s.stages[3];
    assert.ok(motor.blocked);
    assert.ok(close(motor.end, motor.start + motor.duration * VENTRAL_ROOT_FRACTION));
    assert.ok(!s.stages[4].reached);
  });

  it("falls back to the painful intact case for unknown inputs", () => {
    const s = solveReflex({ stimulus: "lava", pathway: "sideways" });
    assert.equal(s.stimulus, "flame");
    assert.equal(s.pathway, "intact");
    assert.ok(s.fires);
  });

  it("reports the intact response time for comparison whatever the pathway", () => {
    const cut = solveReflex({ pathway: "dorsal" });
    const intact = solveReflex({});
    assert.ok(close(cut.intactResponseMs, intact.responseMs));
  });
});

describe("Reading the clock", () => {
  it("locates the impulse in the right stage with the right progress", () => {
    const s = solveReflex({});
    assert.equal(stageAt(s, -1).index, -1, "before the stimulus");
    const early = stageAt(s, 1);
    assert.equal(early.key, "receptor");
    const mid = stageAt(s, s.stages[1].start + s.stages[1].duration / 2);
    assert.equal(mid.key, "sensory");
    assert.ok(close(mid.progress, 0.5));
    const done = stageAt(s, s.responseMs + 1);
    assert.ok(done.done);
    assert.equal(done.index, STAGES.length);
  });

  it("stalls at a blocked stage instead of moving on", () => {
    const s = solveReflex({ pathway: "dorsal" });
    const at = stageAt(s, 1000);
    assert.equal(at.key, "sensory");
    assert.ok(at.stalled);
    assert.equal(at.progress, 1);
    assert.ok(!at.done);
  });

  it("ticks milestones off in order, counting a blocked stage as reached", () => {
    const s = solveReflex({ pathway: "ventral" });
    assert.deepEqual(milestonesAt(s, -1), [false, false, false, false, false]);
    assert.deepEqual(milestonesAt(s, s.stages[2].start + 0.1), [true, true, true, false, false]);
    assert.deepEqual(milestonesAt(s, 1000), [true, true, true, true, false], "the motor neuron was reached — and cut");
  });

  it("only starts the contraction after the latent period, then rises smoothly to full", () => {
    const s = solveReflex({});
    assert.equal(contractionAt(s, s.responseMs), 0);
    assert.equal(contractionAt(s, s.responseMs + CONTRACTION_LATENT_MS - 0.01), 0);
    const half = contractionAt(s, s.contractionStartMs + CONTRACTION_RISE_MS / 2);
    assert.ok(close(half, 0.5, 1e-9));
    assert.equal(contractionAt(s, s.contractionPeakMs + 100), 1);
    assert.ok(close(s.eventEndMs, s.contractionPeakMs));
  });

  it("never contracts when the arc does not fire", () => {
    for (const args of [{ stimulus: "warmth" }, { pathway: "dorsal" }, { pathway: "ventral" }]) {
      const s = solveReflex(args);
      assert.equal(contractionAt(s, 1e6), 0);
      assert.equal(effectorFiredAt(s, 1e6), false);
    }
    assert.ok(effectorFiredAt(solveReflex({}), 31));
  });

  it("slows physiological time tenfold in slow motion", () => {
    assert.equal(playbackRate(false), 1);
    assert.ok(close(playbackRate(true), 0.1));
  });

  it("formats milliseconds sensibly", () => {
    assert.equal(formatMs(23.71), "23.7 ms");
    assert.equal(formatMs(365.2), "365 ms");
    assert.equal(formatMs(null), "—");
  });
});
