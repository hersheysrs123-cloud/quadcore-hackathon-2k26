import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BICEPS_MAX_FORCE_N,
  BICEPS_TENDON_AREA_M2,
  FATIGUE_DONE,
  FATIGUE_MAX_LOSS,
  FATIGUE_ONSET_S,
  FATIGUE_PLATEAU_S,
  FOREARM_COM_M,
  FOREARM_LENGTH_M,
  FOREARM_MASS_KG,
  G,
  MAX_ANGLE_DEG,
  MAX_LOAD_KG,
  TENDON_MODULUS_PA,
  bicepsForceAvailable,
  bicepsForceRequired,
  bicepsLengthFraction,
  bicepsMomentArm,
  bulgeFactor,
  canHold,
  fatigueAt,
  lengthTension,
  loadLeverArm,
  loadTorque,
  maxHoldableLoad,
  settledAngle,
  solveMuscles,
  strengthFactor,
  tendonStateFor,
  tendonStrain,
  tricepsLengthFraction,
} from "../../lib/muscleMechanics.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("The elbow as a lever", () => {
  it("puts the load's torque at zero with the arm hanging and at its peak at 90°", () => {
    assert.ok(close(loadTorque(0, 10), 0));
    const at90 = loadTorque(90, 10);
    assert.ok(at90 > loadTorque(45, 10));
    assert.ok(at90 > loadTorque(145, 10));
    const expected = G * (10 * FOREARM_LENGTH_M + FOREARM_MASS_KG * FOREARM_COM_M);
    assert.ok(close(at90, expected, 1e-9), "τ = g(m·L + m_fa·L_com)·sin 90°");
  });

  it("gives the load a lever arm of L·sin θ", () => {
    assert.ok(close(loadLeverArm(90), FOREARM_LENGTH_M));
    assert.ok(close(loadLeverArm(30), FOREARM_LENGTH_M * 0.5, 1e-12));
    assert.ok(close(loadLeverArm(0), 0));
  });

  it("makes the biceps pull several times harder than the weight it holds", () => {
    const loadKg = 10;
    const force = bicepsForceRequired(90, loadKg);
    const weight = loadKg * G;
    assert.ok(force > 5 * weight && force < 10 * weight, `expected 5–10× the load, got ${(force / weight).toFixed(1)}×`);
    // τ = F·d: the muscle force times its moment arm reproduces the torque
    // (plus the antagonist's resting tone, which it also has to overcome).
    assert.ok(force * bicepsMomentArm(90) > loadTorque(90, loadKg));
  });

  it("clamps angle and load to the slider ranges", () => {
    assert.ok(close(loadTorque(400, 10), loadTorque(MAX_ANGLE_DEG, 10)));
    assert.ok(close(loadTorque(90, 900), loadTorque(90, MAX_LOAD_KG)));
    assert.ok(close(loadTorque(-30, 10), 0));
  });
});

describe("Muscle length and bulge", () => {
  it("shortens the biceps and lengthens the triceps as the elbow flexes", () => {
    assert.ok(close(bicepsLengthFraction(0), 1));
    assert.ok(bicepsLengthFraction(145) < 0.7);
    assert.ok(close(tricepsLengthFraction(145), 1));
    assert.ok(tricepsLengthFraction(0) < 0.75);
    for (let deg = 0; deg < 145; deg += 5) {
      assert.ok(bicepsLengthFraction(deg + 5) < bicepsLengthFraction(deg));
      assert.ok(tricepsLengthFraction(deg + 5) > tricepsLengthFraction(deg));
    }
  });

  it("preserves volume: r² · L is constant", () => {
    for (const f of [1, 0.85, 0.68, 0.5]) {
      const r = bulgeFactor(f);
      assert.ok(close(r * r * f, 1, 1e-12), `r²·L should stay 1 at length ${f}`);
    }
    assert.ok(close(bulgeFactor(0.68), Math.sqrt(1 / 0.68)));
  });

  it("has a length–tension curve that peaks mid-range and never drops below its floor", () => {
    const peak = lengthTension(95);
    assert.ok(close(peak, 1));
    assert.ok(lengthTension(0) < peak && lengthTension(145) < peak);
    assert.ok(lengthTension(0) >= 0.35);
  });
});

describe("Holding, giving way, and fatigue", () => {
  it("lets a fresh arm hold the heaviest dumbbell at any angle", () => {
    for (const deg of [10, 45, 90, 120, 145]) {
      assert.ok(canHold(deg, MAX_LOAD_KG, 0), `fresh arm should hold ${MAX_LOAD_KG} kg at ${deg}°`);
      assert.equal(settledAngle(deg, MAX_LOAD_KG, 0), deg);
    }
  });

  it("reduces available force by the fatigue loss and lets the arm sag to a holdable angle", () => {
    assert.ok(close(strengthFactor(1), 1 - FATIGUE_MAX_LOSS));
    assert.ok(close(bicepsForceAvailable(90, 1), BICEPS_MAX_FORCE_N * lengthTension(90) * (1 - FATIGUE_MAX_LOSS)));
    const target = 90;
    const load = 10;
    assert.ok(canHold(target, load, 0));
    assert.ok(!canHold(target, load, 1), "the default load cannot be held when fully fatigued");
    const sag = settledAngle(target, load, 1);
    assert.ok(sag < target, "the arm gives way");
    assert.ok(canHold(sag, load, 1), "…to an angle it can hold");
    if (sag > 0) assert.ok(!canHold(sag + 1, load, 1), "…and no higher");
  });

  it("always settles at 0° at worst, where the torque is zero", () => {
    assert.equal(settledAngle(0, 25, 1), 0);
    assert.ok(canHold(0, 25, 1));
  });

  it("recovers strength as the fatigue clock runs", () => {
    assert.equal(fatigueAt(-1), 0, "not triggered");
    assert.equal(fatigueAt(0), 0);
    assert.ok(close(fatigueAt(FATIGUE_ONSET_S), 1, 1e-9), "peaks at the end of the onset");
    assert.equal(fatigueAt(FATIGUE_ONSET_S + FATIGUE_PLATEAU_S / 2), 1, "holds at the peak through the plateau");
    const afterPlateau = FATIGUE_ONSET_S + FATIGUE_PLATEAU_S;
    assert.ok(fatigueAt(afterPlateau + 10) < fatigueAt(afterPlateau + 5), "then recovers");
    assert.ok(fatigueAt(120) < FATIGUE_DONE, "long gone after two minutes");
  });

  it("reports the heaviest holdable load falling with fatigue", () => {
    const fresh = maxHoldableLoad(90, 0);
    const tired = maxHoldableLoad(90, 1);
    assert.ok(fresh > tired);
    assert.ok(tired > 3 && tired < 10, `a fully fatigued arm should manage a few kg, got ${tired.toFixed(1)}`);
    assert.ok(canHold(90, tired - 0.05, 1));
    assert.ok(!canHold(90, tired + 0.2, 1));
  });
});

describe("Tendons", () => {
  it("computes strain as stress over modulus", () => {
    const strain = tendonStrain(1000, BICEPS_TENDON_AREA_M2);
    assert.ok(close(strain, 1000 / (TENDON_MODULUS_PA * BICEPS_TENDON_AREA_M2)));
    assert.equal(tendonStrain(-5, BICEPS_TENDON_AREA_M2), 0, "tendons do not carry compression");
  });

  it("grades strain from safe through micro-tears to rupture", () => {
    assert.equal(tendonStateFor(0.01), "safe");
    assert.equal(tendonStateFor(0.03), "high");
    assert.equal(tendonStateFor(0.05), "micro-tears");
    assert.equal(tendonStateFor(0.09), "rupture");
  });

  it("keeps a full curl within the safe range for a healthy tendon", () => {
    const m = solveMuscles({ elbowAngle: 90, loadKg: 25, fatigue: 0 });
    assert.ok(m.biceps.tendonStrain < 0.08, "no rupture on the heaviest curl");
  });
});

describe("The antagonistic pair", () => {
  it("makes the biceps the agonist when flexing or holding a load, and the triceps when extending", () => {
    const hold = solveMuscles({ elbowAngle: 90, loadKg: 8, motion: "holding" });
    assert.equal(hold.biceps.state, "contracted");
    assert.equal(hold.triceps.state, "relaxed");
    const flex = solveMuscles({ elbowAngle: 90, loadKg: 8, motion: "flexing" });
    assert.equal(flex.biceps.state, "contracted");
    const extend = solveMuscles({ elbowAngle: 90, loadKg: 8, motion: "extending" });
    assert.equal(extend.biceps.state, "relaxed");
    assert.equal(extend.triceps.state, "contracted");
    assert.ok(extend.triceps.force > hold.triceps.force, "the active triceps pulls harder than its resting tone");
  });

  it("relaxes both muscles with the arm hanging and nothing to hold", () => {
    const m = solveMuscles({ elbowAngle: 0, loadKg: 0 });
    assert.equal(m.biceps.state, "relaxed");
    assert.equal(m.triceps.state, "relaxed");
    assert.ok(close(m.torque, 0));
  });

  it("reports the settled angle and flags sagging under fatigue", () => {
    const fresh = solveMuscles({ elbowAngle: 90, loadKg: 8, fatigue: 0 });
    assert.equal(fresh.angle, 90);
    assert.equal(fresh.sagging, false);
    const tired = solveMuscles({ elbowAngle: 90, loadKg: 8, fatigue: 1 });
    assert.ok(tired.angle < 90);
    assert.equal(tired.sagging, true);
    assert.ok(tired.biceps.force <= tired.biceps.available + 1e-9, "a failing muscle gives what it has");
  });

  it("caps the biceps at what it can supply, and reports utilisation", () => {
    const m = solveMuscles({ elbowAngle: 90, loadKg: 25 });
    assert.ok(m.biceps.utilisation > 0.8 && m.biceps.utilisation <= 1);
    assert.ok(close(m.biceps.force, Math.min(m.biceps.required, m.biceps.available)));
  });

  it("tolerates junk input", () => {
    const m = solveMuscles({ elbowAngle: "x", loadKg: undefined, fatigue: "?", motion: "sideways" });
    assert.equal(m.motion, "holding");
    assert.ok(Number.isFinite(m.torque));
    assert.ok(Number.isFinite(m.biceps.force));
  });
});
