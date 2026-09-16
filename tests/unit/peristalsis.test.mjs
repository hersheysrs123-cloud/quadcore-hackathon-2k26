import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_WAVE_SPEED_CM_S,
  BOLUS_START_CM,
  CONSISTENCIES,
  CONSTRICTION_DEPTH,
  CONSTRICTION_LAG_CM,
  LUMEN_RADIUS_CM,
  ORIENTATIONS,
  RELAXATION_LEAD_CM,
  TRANSIT_DISTANCE_CM,
  TUBE_LENGTH_CM,
  bolusFeature,
  bolusSpeed,
  formatCm,
  formatCmS,
  layerActivation,
  lumenFeatures,
  solvePeristalsis,
  transitAt,
  transitTime,
  waveFeatures,
  waveSpeed,
} from "../../lib/peristalsis.js";
import { profileRadius } from "../../lib/tubeTransit.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("Wave and bolus speeds", () => {
  it("runs the wave at a speed set by consistency alone — gravity never enters it", () => {
    assert.ok(close(waveSpeed("liquid"), BASE_WAVE_SPEED_CM_S));
    assert.ok(waveSpeed("dry") < waveSpeed("soft") && waveSpeed("soft") < waveSpeed("liquid"));
    for (const c of Object.keys(CONSISTENCIES)) {
      assert.ok(close(bolusSpeed(c, "inverted"), waveSpeed(c)), `${c}: upside-down, the bolus goes at exactly the wave's speed`);
    }
  });

  it("lets a liquid pour ahead of the wave when gravity helps, and only then", () => {
    assert.ok(bolusSpeed("liquid", "upright") > waveSpeed("liquid"));
    assert.ok(close(bolusSpeed("liquid", "upright") - waveSpeed("liquid"), CONSISTENCIES.liquid.gravitySlip));
    assert.ok(close(bolusSpeed("dry", "upright"), waveSpeed("dry")), "a dry bolus does not move until pushed");
  });

  it("still delivers upside-down, just no faster than the wave", () => {
    const up = transitTime("liquid", "upright");
    const down = transitTime("liquid", "inverted");
    assert.ok(up < down, "gravity's help shows up as a shorter transit");
    assert.ok(Number.isFinite(down) && down > 0, "…but transit upside-down is finite");
    assert.ok(close(down, TRANSIT_DISTANCE_CM / waveSpeed("liquid")));
  });
});

describe("Where everything is", () => {
  it("starts the bolus just inside the mouth with the ring on its tail", () => {
    const st = transitAt("soft", "upright", 0);
    assert.ok(close(st.bolus, BOLUS_START_CM));
    assert.ok(close(st.constriction, BOLUS_START_CM - CONSTRICTION_LAG_CM));
    assert.ok(close(st.relaxation, BOLUS_START_CM + RELAXATION_LEAD_CM));
    assert.equal(st.ahead, 0);
    assert.ok(!st.delivered && !st.complete);
  });

  it("keeps the ring behind the bolus and the relaxation ahead of it throughout", () => {
    for (const c of Object.keys(CONSISTENCIES)) {
      for (const o of Object.keys(ORIENTATIONS)) {
        for (let t = 0; t < 15; t += 0.25) {
          const st = transitAt(c, o, t);
          assert.ok(st.constriction <= st.bolus - CONSTRICTION_LAG_CM + 1e-9, `${c}/${o} t=${t}: ring behind`);
          assert.ok(st.relaxation > st.bolus, `${c}/${o} t=${t}: relaxation ahead`);
        }
      }
    }
  });

  it("only shows run-ahead for a helped liquid, and closes the gap once delivered", () => {
    const mid = transitAt("liquid", "upright", 2);
    assert.ok(mid.ahead > 0, "the liquid has run ahead of the ring");
    assert.equal(transitAt("liquid", "inverted", 2).ahead, 0);
    assert.equal(transitAt("dry", "upright", 2).ahead, 0);
    const late = transitAt("liquid", "upright", 60);
    assert.ok(late.delivered && late.complete);
    assert.equal(late.ahead, 0, "the ring runs the last of its distance after delivery");
    assert.equal(late.bolusSpeed, 0);
    assert.equal(late.waveSpeed, 0);
  });

  it("delivers at the tube's end and completes once the ring catches up", () => {
    const tt = transitTime("soft", "inverted");
    const just = transitAt("soft", "inverted", tt + 1e-6);
    assert.ok(just.delivered);
    assert.ok(close(just.bolus, TUBE_LENGTH_CM));
    assert.ok(just.complete, "when the bolus rides the wave exactly, the ring arrives with it");
    const liquid = transitAt("liquid", "upright", transitTime("liquid", "upright") + 1e-6);
    assert.ok(liquid.delivered && !liquid.complete, "a bolus that outran the wave is delivered before the wave is done");
  });

  it("never runs the clock backwards", () => {
    assert.deepEqual(transitAt("soft", "upright", -5).bolus, transitAt("soft", "upright", 0).bolus);
  });
});

describe("Muscle layers", () => {
  it("peak in different places: circular at the ring, longitudinal in the relaxation zone", () => {
    const st = transitAt("soft", "upright", 2);
    const atRing = layerActivation(st.constriction, st);
    const atRelax = layerActivation(st.relaxation, st);
    assert.ok(close(atRing.circular, 1) && atRing.longitudinal < 0.2);
    assert.ok(close(atRelax.longitudinal, 1) && atRelax.circular < 0.05);
    assert.deepEqual(layerActivation(5, null), { circular: 0, longitudinal: 0 });
  });

  it("narrow the lumen at the ring and widen it ahead of the bolus", () => {
    const st = transitAt("soft", "upright", 2);
    const features = waveFeatures(st);
    const rRing = profileRadius(st.constriction, LUMEN_RADIUS_CM, features);
    const rRelax = profileRadius(st.relaxation, LUMEN_RADIUS_CM, features);
    const rFar = profileRadius(st.relaxation + 12, LUMEN_RADIUS_CM, features);
    assert.ok(close(rRing, LUMEN_RADIUS_CM * (1 - CONSTRICTION_DEPTH), 1e-3), "the ring closes most of the lumen");
    assert.ok(rRelax > LUMEN_RADIUS_CM, "the segment ahead opens");
    assert.ok(close(rFar, LUMEN_RADIUS_CM, 1e-6), "the rest of the tube is at rest");
    assert.deepEqual(waveFeatures(null), []);
  });

  it("stretch the wall round a dry bolus but not a soft or liquid one", () => {
    const st = transitAt("dry", "upright", 2);
    assert.ok(bolusFeature(st, "dry") !== null && bolusFeature(st, "dry").depth < 0, "a dilation at the bolus");
    assert.equal(bolusFeature(transitAt("soft", "upright", 2), "soft"), null);
    assert.equal(bolusFeature(transitAt("liquid", "upright", 2), "liquid"), null);
    assert.equal(bolusFeature(null, "dry"), null);
    assert.equal(lumenFeatures(st, "dry").length, 3);
    assert.equal(lumenFeatures(st, "soft").length, 2);
  });
});

describe("solvePeristalsis", () => {
  it("summarises a swallow and falls back to defaults for unknown keys", () => {
    const s = solvePeristalsis({ consistency: "liquid", orientation: "inverted" });
    assert.equal(s.consistency, "liquid");
    assert.equal(s.orientation, "inverted");
    assert.ok(!s.gravityHelps);
    assert.ok(close(s.gravitySlip, 0));
    assert.ok(close(s.transitTime, s.transitTimeNoGravity));
    assert.equal(s.lumenFit, "fits");
    const d = solvePeristalsis({ consistency: "dry" });
    assert.equal(d.lumenFit, "distends");
    const fallback = solvePeristalsis({ consistency: "rock", orientation: "sideways" });
    assert.equal(fallback.consistency, "soft");
    assert.equal(fallback.orientation, "upright");
  });

  it("formats centimetres and speeds", () => {
    assert.equal(formatCm(12.345), "12.3 cm");
    assert.equal(formatCmS(3.5), "3.50 cm/s");
  });
});
