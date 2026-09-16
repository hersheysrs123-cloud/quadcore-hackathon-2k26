import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AMBIENT_C,
  BASIN_HOLD_S,
  COLLAR_MAX,
  COLLAR_MIN,
  COMPLETE_ABOVE,
  EQUATIONS,
  FLAME_MAX_C,
  FLAME_MIN_C,
  HEAT_EXTINCTION,
  IGNITION_C,
  INNER_CONE_FROM,
  JAR_TRAVEL_S,
  O2_AIR,
  O2_EXTINCTION,
  ROARING_BLUE,
  SOOTY_YELLOW,
  airFraction,
  collarLabel,
  createCombustionState,
  describeFlame,
  flameColour,
  flameProfile,
  flameTemperature,
  jarOxygenPercent,
  mixHex,
  stepCombustion,
  triangleStatus,
} from "../../lib/combustion.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/** Step `seconds` of model time at 60 fps, firing `events` on the first frame only. */
function run(state, seconds, { collar = 15, events = {} } = {}) {
  let s = state;
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i += 1) s = stepCombustion(s, { collar, dt: 1 / 60, events: i === 0 ? events : {} });
  return s;
}

/** Step until the flame goes out (or `limit` seconds pass); returns [state, seconds]. */
function untilOut(state, { collar = 15, events = {}, limit = 30 } = {}) {
  let s = state;
  let t = 0;
  let first = true;
  while (s.lit && t < limit) {
    s = stepCombustion(s, { collar, dt: 1 / 60, events: first ? events : {} });
    first = false;
    t += 1 / 60;
  }
  return [s, t];
}

describe("The air collar", () => {
  it("maps the slider to an air fraction, clamped", () => {
    assert.equal(airFraction(COLLAR_MIN), 0);
    assert.equal(airFraction(COLLAR_MAX), 1);
    assert.equal(airFraction(50), 0.5);
    assert.equal(airFraction(-20), 0);
    assert.equal(airFraction(500), 1);
    assert.equal(airFraction("abc"), 0);
  });

  it("runs the flame temperature from 300 °C closed to 1 400 °C open", () => {
    assert.equal(FLAME_MIN_C, 300);
    assert.equal(FLAME_MAX_C, 1400);
    assert.equal(flameTemperature(0), 300);
    assert.equal(flameTemperature(100), 1400);
    assert.equal(flameTemperature(50), 850);
  });

  it("names the collar positions", () => {
    assert.equal(collarLabel(0), "closed");
    assert.equal(collarLabel(25), "quarter open");
    assert.equal(collarLabel(50), "half-open");
    assert.equal(collarLabel(75), "three-quarters open");
    assert.equal(collarLabel(100), "fully open");
  });

  it("colours the flame yellow closed and blue open, through orange", () => {
    assert.equal(flameColour(0), SOOTY_YELLOW);
    assert.equal(flameColour(70), ROARING_BLUE);
    const mid = flameColour(35);
    assert.notEqual(mid, SOOTY_YELLOW);
    assert.notEqual(mid, ROARING_BLUE);
    assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
  });

  it("switches the live equation from incomplete to complete at the threshold", () => {
    assert.equal(flameProfile(0).equation, EQUATIONS.incomplete);
    assert.equal(flameProfile(COMPLETE_ABOVE * 100 - 1).equation, EQUATIONS.incomplete);
    assert.equal(flameProfile(COMPLETE_ABOVE * 100).equation, EQUATIONS.complete);
    assert.equal(flameProfile(100).equation, EQUATIONS.complete);
    assert.equal(EQUATIONS.complete.text, "CH₄ + 2O₂ → CO₂ + 2H₂O");
    assert.equal(EQUATIONS.incomplete.text, "2CH₄ + 3O₂ → 2CO + 4H₂O");
    assert.ok(Math.abs(EQUATIONS.complete.enthalpyKJPerMol) > Math.abs(EQUATIONS.incomplete.enthalpyKJPerMol), "complete releases more");
  });

  it("makes soot and CO only when starved, and an inner cone only when fed", () => {
    const closed = flameProfile(0);
    const open = flameProfile(100);
    assert.equal(closed.sootRate, 1);
    assert.equal(open.sootRate, 0);
    assert.equal(closed.coFraction, 1);
    assert.equal(open.coFraction, 0);
    assert.ok(closed.coPpm > open.coPpm);
    assert.equal(closed.innerCone, 0);
    assert.equal(open.innerCone, 1);
    assert.equal(flameProfile(INNER_CONE_FROM * 100).innerCone, 0);
    assert.ok(flameProfile(60).innerCone > 0 && flameProfile(60).innerCone < 1);
    assert.ok(closed.height > open.height, "a lazy yellow flame stands taller");
    assert.ok(closed.luminous > open.luminous);
  });
});

describe("The fire triangle — steady state", () => {
  it("starts lit with all three sides present", () => {
    const s = createCombustionState(15);
    assert.equal(s.lit, true);
    assert.deepEqual(triangleStatus(s), { fuel: true, oxygen: true, heat: true });
    assert.equal(s.jarO2, O2_AIR);
    assert.equal(jarOxygenPercent(s), 20.9);
  });

  it("stays lit indefinitely with nothing removed, and follows the collar's temperature", () => {
    let s = createCombustionState(15);
    s = run(s, 5, { collar: 100 });
    assert.equal(s.lit, true);
    assert.ok(close(s.tempC, 1400, 2));
    s = run(s, 5, { collar: 0 });
    assert.equal(s.lit, true);
    assert.ok(close(s.tempC, 300, 2));
    assert.ok(close(s.heat, 1, 1e-6));
  });

  it("is pure: the input state is not mutated", () => {
    const s = createCombustionState(15);
    const copy = { ...s };
    stepCombustion(s, { collar: 100, dt: 1 / 60, events: { cutFuel: true } });
    assert.deepEqual(s, copy);
  });

  it("clamps a wild dt", () => {
    const s = stepCombustion(createCombustionState(15), { collar: 15, dt: 100 });
    assert.ok(s.seconds <= 0.1);
  });
});

describe("The fire triangle — removing one side", () => {
  it("cut the fuel: out within a second, for want of fuel", () => {
    const [s, t] = untilOut(createCombustionState(15), { collar: 100, events: { cutFuel: true } });
    assert.equal(s.lit, false);
    assert.equal(s.extinguishedBy, "fuel");
    assert.ok(t < 1);
    assert.deepEqual(triangleStatus(s), { fuel: false, oxygen: true, heat: true });
    assert.match(describeFlame(s, 100), /tap is closed/);
  });

  it("bell jar: the oxygen falls until the flame cannot survive, with fuel and heat still there", () => {
    const [s, t] = untilOut(createCombustionState(15), { collar: 100, events: { bellJar: true } });
    assert.equal(s.lit, false);
    assert.equal(s.extinguishedBy, "oxygen");
    assert.ok(s.jarO2 < O2_EXTINCTION);
    assert.ok(t > JAR_TRAVEL_S, "nothing happens until the jar is down");
    assert.ok(t < 12);
    assert.equal(s.jarTravel, 1);
    const status = triangleStatus(s);
    assert.equal(status.fuel, true);
    assert.equal(status.oxygen, false);
    assert.match(describeFlame(s, 100), /bell jar/);
  });

  it("bell jar: the oxygen stops falling once the flame is out, and comes back when the jar lifts", () => {
    let [s] = untilOut(createCombustionState(15), { collar: 100, events: { bellJar: true } });
    const o2 = s.jarO2;
    s = run(s, 2, { collar: 100 });
    assert.ok(close(s.jarO2, o2), "no flame, no consumption");
    s = run(s, 4, { collar: 100, events: { relight: true } });
    assert.ok(s.jarO2 > O2_AIR - 0.002);
    assert.equal(s.jarTravel, 0);
    assert.equal(s.lit, true);
  });

  it("water mist: takes the heat, flame out in under two seconds, fuel and oxygen untouched", () => {
    const [s, t] = untilOut(createCombustionState(15), { collar: 100, events: { waterMist: true } });
    assert.equal(s.lit, false);
    assert.equal(s.extinguishedBy, "heat");
    assert.ok(t < 2);
    assert.ok(s.heat < HEAT_EXTINCTION);
    assert.equal(s.fuelOpen, true);
    assert.ok(s.jarO2 >= O2_EXTINCTION);
    assert.match(describeFlame(s, 100), /mist took the heat/);
    assert.match(describeFlame(s, 100), new RegExp(String(IGNITION_C)));
  });

  it("water mist: the displayed temperature sags, then falls to the room once the flame is out", () => {
    let s = run(createCombustionState(15), 3, { collar: 100 });
    const hot = s.tempC;
    s = run(s, 0.3, { collar: 100, events: { waterMist: true } });
    assert.ok(s.tempC < hot);
    s = run(s, 8, { collar: 100 });
    assert.equal(s.lit, false);
    assert.ok(close(s.tempC, AMBIENT_C, 2));
    assert.equal(s.mist, 0, "the mist has evaporated");
  });

  it("each interrupter leaves exactly one side missing, even after the burner has cooled", () => {
    const [fuel] = untilOut(createCombustionState(15), { collar: 100, events: { cutFuel: true } });
    assert.deepEqual(triangleStatus(run(fuel, 10, { collar: 100 })), { fuel: false, oxygen: true, heat: true });
    const [oxygen] = untilOut(createCombustionState(15), { collar: 100, events: { bellJar: true } });
    assert.deepEqual(triangleStatus(run(oxygen, 10, { collar: 100 })), { fuel: true, oxygen: false, heat: true });
    const [heat] = untilOut(createCombustionState(15), { collar: 100, events: { waterMist: true } });
    assert.deepEqual(triangleStatus(run(heat, 10, { collar: 100 })), { fuel: true, oxygen: true, heat: false });
  });

  it("the flame does not relight by itself once it is out", () => {
    let [s] = untilOut(createCombustionState(15), { collar: 100, events: { waterMist: true } });
    s = run(s, 10, { collar: 100 });
    assert.equal(s.lit, false);
  });
});

describe("Relighting", () => {
  it("restores every side and strikes the flame", () => {
    let s = run(createCombustionState(15), 2, { collar: 50, events: { cutFuel: true } });
    s = run(s, 1, { collar: 50, events: { bellJar: true } });
    s = run(s, 1, { collar: 50, events: { waterMist: true } });
    assert.equal(s.lit, false);
    s = run(s, 3, { collar: 50, events: { relight: true } });
    assert.equal(s.lit, true);
    assert.equal(s.fuelOpen, true);
    assert.equal(s.jarDown, false);
    assert.equal(s.extinguishedBy, null);
    assert.deepEqual(triangleStatus(s), { fuel: true, oxygen: true, heat: true });
  });

  it("after a bell jar, the striker waits for the jar to clear and the air to come back", () => {
    let [s] = untilOut(createCombustionState(15), { collar: 100, events: { bellJar: true } });
    const first = stepCombustion(s, { collar: 100, dt: 1 / 60, events: { relight: true } });
    assert.equal(first.lit, false, "the jar has only just started lifting");
    assert.ok(first.striker > 0, "but the striker is waiting");
    s = run(first, 0.3, { collar: 100 });
    assert.equal(s.lit, false, "still lifting, no fresh air yet");
    s = run(s, 2, { collar: 100 });
    assert.equal(s.lit, true, "clear of the burner, air back, it catches");
    assert.equal(s.striker, 0);
  });

  it("gives up striking after a while if the tap is shut again", () => {
    let s = run(createCombustionState(15), 1, { collar: 100, events: { cutFuel: true } });
    s = stepCombustion(s, { collar: 100, dt: 1 / 60, events: { relight: true } });
    s = stepCombustion(s, { collar: 100, dt: 1 / 60, events: { cutFuel: true } });
    // The relight lit it and the tap shut it again in the same breath.
    s = run(s, 8, { collar: 100 });
    assert.equal(s.lit, false);
    assert.equal(s.striker, 0);
  });
});

describe("The cold basin", () => {
  it("collects soot from a closed-collar flame and none from an open one", () => {
    let sooty = run(createCombustionState(0), 1, { collar: 0 });
    sooty = run(sooty, BASIN_HOLD_S + 1, { collar: 0, events: { holdBasin: true } });
    assert.equal(sooty.basin, "showing");
    assert.ok(sooty.sootOnBasin > 0.9);
    let clean = run(createCombustionState(100), 1, { collar: 100 });
    clean = run(clean, BASIN_HOLD_S + 1, { collar: 100, events: { holdBasin: true } });
    assert.equal(clean.basin, "showing");
    assert.equal(clean.sootOnBasin, 0);
  });

  it("collects less at half-open, nothing from a flame that is out, and is wiped by a relight", () => {
    let half = run(createCombustionState(50), 1, { collar: 50 });
    half = run(half, BASIN_HOLD_S + 1, { collar: 50, events: { holdBasin: true } });
    assert.ok(half.sootOnBasin > 0.2 && half.sootOnBasin < 0.7);
    let out = run(createCombustionState(0), 1, { collar: 0, events: { cutFuel: true } });
    out = run(out, BASIN_HOLD_S + 1, { collar: 0, events: { holdBasin: true } });
    assert.equal(out.sootOnBasin, 0);
    const wiped = run(half, 0.5, { collar: 50, events: { relight: true } });
    assert.equal(wiped.sootOnBasin, 0);
    assert.equal(wiped.basin, "rest");
  });

  it("holds for the hold time and ignores a second press while held", () => {
    let s = run(createCombustionState(0), 1, { collar: 0 });
    s = run(s, 1, { collar: 0, events: { holdBasin: true } });
    assert.equal(s.basin, "held");
    const again = stepCombustion(s, { collar: 0, dt: 1 / 60, events: { holdBasin: true } });
    assert.ok(again.basinTimer > 0.9, "the timer was not restarted");
    s = run(s, BASIN_HOLD_S, { collar: 0 });
    assert.equal(s.basin, "showing");
  });
});
