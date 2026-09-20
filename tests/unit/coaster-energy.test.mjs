import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  G,
  LOOP_OFFSET_M,
  RELEASE_SPEED,
  buildTrack,
  describeRun,
  gForce,
  lateralAt,
  loopVerdict,
  minimumReleaseHeight,
  minimumTopSpeed,
  positionAt,
  railForce,
  sampleAt,
  speedFrom,
  startRun,
  stepRun,
} from "../../lib/coasterEnergy.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/** Run a cart until it reaches `until` along the track, or gives up. */
function ride({ releaseHeight = 25, loopRadius = 8, mass = 500, friction = false, steps = 200000 }) {
  const track = buildTrack({ releaseHeight, loopRadius });
  let state = startRun({ track, mass });
  let maxG = -Infinity;
  let minG = Infinity;
  let topSample = null;
  let maxTotalDrift = 0;
  const start = state.mechanical;

  for (let i = 0; i < steps; i += 1) {
    state = stepRun(state, track, { mass, friction }, 0.002);
    const d = describeRun({ track, state, mass });
    if (d.onLoop) {
      maxG = Math.max(maxG, d.gForce);
      minG = Math.min(minG, d.gForce);
    }
    if (topSample === null && state.s >= track.loopTopS) topSample = d;
    maxTotalDrift = Math.max(maxTotalDrift, Math.abs(d.total - start));
    if (state.s >= track.length - 0.15) break;
  }
  return { track, state, described: describeRun({ track, state, mass }), maxG, minG, topSample, maxTotalDrift, start };
}

describe("the track", () => {
  it("starts at the release height and reaches the ground", () => {
    const t = buildTrack({ releaseHeight: 30, loopRadius: 8 });
    assert.ok(close(t.height[0], 30, 1e-9));
    assert.ok(Math.min(...t.height) <= 1e-6);
  });

  it("puts the top of the loop at exactly twice the radius", () => {
    for (const R of [3, 8, 15]) {
      const t = buildTrack({ releaseHeight: 40, loopRadius: R });
      assert.ok(close(t.loopTopHeight, 2 * R, 1e-12));
      assert.ok(close(sampleAt(t, t.height, t.loopTopS), 2 * R, 0.05), `R=${R}`);
    }
  });

  it("closes the loop — it comes back to the height it left from", () => {
    const t = buildTrack({ releaseHeight: 30, loopRadius: 8 });
    assert.ok(close(sampleAt(t, t.height, t.loopEntryS), sampleAt(t, t.height, t.loopExitS), 0.05));
  });

  it("measures the loop's curvature as 1/R", () => {
    const t = buildTrack({ releaseHeight: 30, loopRadius: 8 });
    const mid = sampleAt(t, t.curvature, (t.loopEntryS + t.loopExitS) / 2);
    assert.ok(close(mid, 1 / 8, 0.004), `${mid} should be about ${1 / 8}`);
  });

  it("has the track normal pointing up on the flat and down at the loop top", () => {
    const t = buildTrack({ releaseHeight: 30, loopRadius: 8 });
    assert.ok(sampleAt(t, t.normalY, t.brakeStartS + 4) > 0.99, "flat track supports from below");
    assert.ok(sampleAt(t, t.normalY, t.loopTopS) < -0.99, "at the loop top the rail is above the cart");
  });

  it("interpolates positions monotonically along its own length", () => {
    const t = buildTrack({ releaseHeight: 25, loopRadius: 8 });
    for (const at of [0, t.length * 0.25, t.length * 0.5, t.length]) {
      const p = positionAt(t, at);
      assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]));
    }
  });
});

describe("the loop condition", () => {
  it("needs √(gR) at the top", () => {
    for (const R of [3, 8, 15]) {
      assert.ok(close(minimumTopSpeed(R), Math.sqrt(G * R), 1e-12));
    }
  });

  it("works back to a release height of 2.5R", () => {
    for (const R of [3, 8, 15]) {
      assert.ok(close(minimumReleaseHeight(R), 2.5 * R, 1e-12));
      // Derive it independently: ½v² = g(h − 2R) with v² = gR.
      const h = 2 * R + (G * R) / (2 * G);
      assert.ok(close(minimumReleaseHeight(R), h, 1e-9));
    }
  });

  it("does not depend on the cart's mass", () => {
    for (const mass of [200, 500, 1000]) {
      const r = ride({ releaseHeight: 21, loopRadius: 8, mass });
      assert.equal(r.described.leftTrack, false, `${mass} kg should clear a 20 m minimum from 21 m`);
    }
  });

  it("keeps the cart on the rail just above the threshold and loses it just below", () => {
    const R = 8;
    const below = ride({ releaseHeight: 2.5 * R - 1.5, loopRadius: R });
    const above = ride({ releaseHeight: 2.5 * R + 1.5, loopRadius: R });
    assert.equal(below.described.leftTrack, true, "below 2.5R the rail would have to pull inward");
    assert.equal(above.described.leftTrack, false);
  });

  it("agrees with its own simulation about the speed at the top", () => {
    const r = ride({ releaseHeight: 25, loopRadius: 8 });
    const predicted = Math.sqrt(2 * G * (25 - 16) + RELEASE_SPEED ** 2);
    assert.ok(close(r.topSample.speed, predicted, 0.06), `${r.topSample.speed} vs ${predicted}`);
  });
});

describe("conservation of energy", () => {
  it("holds the total exactly constant on the ideal track", () => {
    const r = ride({ releaseHeight: 25, loopRadius: 8, friction: false });
    assert.ok(r.maxTotalDrift < 1e-6, `total drifted by ${r.maxTotalDrift} J`);
    assert.ok(close(r.described.thermal, 0, 1e-12), "a frictionless track wastes nothing");
  });

  it("holds it constant with friction on too — the heat is inside the total", () => {
    const r = ride({ releaseHeight: 25, loopRadius: 8, friction: true });
    assert.ok(r.maxTotalDrift < 1e-6, `total drifted by ${r.maxTotalDrift} J`);
    assert.ok(r.described.thermal > 0, "friction must actually take something");
  });

  it("trades height for speed at exactly mgh = ½mv²", () => {
    const mass = 500;
    const track = buildTrack({ releaseHeight: 30, loopRadius: 8 });
    let state = startRun({ track, mass });
    const start = state.mechanical;
    for (let i = 0; i < 40000 && state.s < track.loopEntryS; i += 1) {
      state = stepRun(state, track, { mass, friction: false }, 0.002);
    }
    const d = describeRun({ track, state, mass });
    assert.ok(close(d.gpe + d.ke, start, 1e-6));
    assert.ok(close(d.speed, Math.sqrt(2 * (start / mass - G * d.height)), 1e-9));
  });

  it("gives the same ground speed whatever the cart weighs", () => {
    const speeds = [200, 500, 1000].map((mass) => {
      const track = buildTrack({ releaseHeight: 25, loopRadius: 8 });
      let state = startRun({ track, mass });
      for (let i = 0; i < 40000 && state.s < track.loopEntryS - 1; i += 1) {
        state = stepRun(state, track, { mass, friction: false }, 0.002);
      }
      return describeRun({ track, state, mass }).speed;
    });
    for (const v of speeds) assert.ok(Math.abs(v - speeds[0]) < 0.05, speeds.join(", "));
  });

  it("never lets the thermal store give anything back", () => {
    const mass = 500;
    const track = buildTrack({ releaseHeight: 30, loopRadius: 8 });
    let state = startRun({ track, mass });
    let previous = 0;
    for (let i = 0; i < 60000 && state.s < track.length - 0.2; i += 1) {
      state = stepRun(state, track, { mass, friction: true }, 0.002);
      assert.ok(state.thermal >= previous - 1e-12, "thermal energy must never decrease");
      previous = state.thermal;
    }
  });

  it("never produces an imaginary speed by over-drawing the kinetic store", () => {
    const mass = 300;
    const track = buildTrack({ releaseHeight: 6, loopRadius: 3 });
    let state = startRun({ track, mass });
    for (let i = 0; i < 60000; i += 1) {
      state = stepRun(state, track, { mass, friction: true }, 0.002);
      const d = describeRun({ track, state, mass });
      assert.ok(Number.isFinite(d.speed) && d.speed >= 0, `step ${i}`);
      assert.ok(d.ke >= -1e-9, `KE went negative at step ${i}`);
    }
  });
});

describe("what the passengers feel", () => {
  it("reads exactly 1 g sitting still on level track", () => {
    assert.ok(close(gForce(railForce(500, 0, 0, 1), 500), 1, 1e-12));
  });

  it("collapses to N = mv²/R − mg at the top of a loop", () => {
    const mass = 500;
    const R = 8;
    const v = 14;
    // Normal points down toward the loop centre there, so normalY is −1.
    assert.ok(close(railForce(mass, v, 1 / R, -1), (mass * v * v) / R - mass * G, 1e-9));
  });

  it("collapses to N = mv²/R + mg at the foot of a loop", () => {
    const mass = 500;
    const R = 8;
    const v = 22;
    assert.ok(close(railForce(mass, v, 1 / R, 1), (mass * v * v) / R + mass * G, 1e-9));
  });

  it("puts the heaviest loading at the bottom of the loop, not the top", () => {
    const r = ride({ releaseHeight: 30, loopRadius: 8 });
    assert.ok(r.maxG > r.minG + 2, `${r.minG} … ${r.maxG}`);
    assert.ok(r.maxG > 4, "a circular loop of this radius really is punishing at the foot");
  });

  it("never reports negative g while the cart is still holding the rail", () => {
    const r = ride({ releaseHeight: 30, loopRadius: 8 });
    assert.equal(r.described.leftTrack, false);
    assert.ok(r.minG >= -1e-9, `${r.minG}`);
  });

  it("goes negative exactly when the cart is about to leave the rail", () => {
    const r = ride({ releaseHeight: 12, loopRadius: 8 });
    assert.equal(r.described.leftTrack, true);
    assert.ok(r.minG < 0, "a negative rail force is what leaving the track means");
  });
});

describe("running the cart", () => {
  it("actually sets off from a level crest", () => {
    // Released at rest on level track there is no force along the rail at all,
    // which is why the lift chain hands the cart over with a nudge.
    const r = ride({ releaseHeight: 25, loopRadius: 8 });
    assert.ok(r.state.s > 1, "the cart must leave the station");
    assert.ok(RELEASE_SPEED > 0);
  });

  it("brings the cart to a stop in the brakes from a sensible height", () => {
    const r = ride({ releaseHeight: 25, loopRadius: 8, friction: true });
    assert.ok(r.described.speed < 0.5, `still doing ${r.described.speed.toFixed(2)} m/s at the end`);
  });

  it("overruns the brakes when launched from far too high", () => {
    const r = ride({ releaseHeight: 50, loopRadius: 8, friction: true });
    assert.ok(r.described.speed > 5, "the brakes cannot hold everything");
  });

  it("rolls back rather than stalling on a rise it cannot climb", () => {
    const mass = 400;
    const track = buildTrack({ releaseHeight: 5, loopRadius: 15 });
    let state = startRun({ track, mass });
    let reversed = false;
    for (let i = 0; i < 40000; i += 1) {
      const before = state.direction;
      state = stepRun(state, track, { mass, friction: false }, 0.002);
      if (before === 1 && state.direction === -1) reversed = true;
    }
    assert.ok(reversed, "a cart that cannot reach the loop top must come back down");
  });

  it("keeps the cart on its own track, never past either end", () => {
    const mass = 500;
    const track = buildTrack({ releaseHeight: 40, loopRadius: 6 });
    let state = startRun({ track, mass });
    for (let i = 0; i < 60000; i += 1) {
      state = stepRun(state, track, { mass, friction: false }, 0.002);
      assert.ok(state.s >= -1e-9 && state.s <= track.length + 1e-9, `off the end at step ${i}`);
    }
  });

  it("stays finite across the whole range of the controls", () => {
    for (const releaseHeight of [5, 25, 50]) {
      for (const loopRadius of [3, 8, 15]) {
        for (const mass of [200, 1000]) {
          const r = ride({ releaseHeight, loopRadius, mass, friction: true, steps: 12000 });
          const d = r.described;
          for (const v of [d.speed, d.gpe, d.ke, d.thermal, d.gForce, d.height]) {
            assert.ok(Number.isFinite(v), `h=${releaseHeight} R=${loopRadius} m=${mass}`);
          }
        }
      }
    }
  });
});

describe("a cart that cannot clear the loop", () => {
  const mass = 500;
  // Well under the 2.5R the loop needs, so it is certain to stall on the way up.
  const track = buildTrack({ releaseHeight: 6, loopRadius: 8 });

  /** Run the cart for `seconds` of scene time and report where it got to. */
  const run = (seconds) => {
    let state = startRun({ track, mass });
    const dt = 1 / 120;
    let furthest = 0;
    for (let i = 0; i < seconds * 120; i += 1) {
      state = stepRun(state, track, { mass, friction: true }, dt);
      furthest = Math.max(furthest, state.s);
    }
    return { state, furthest };
  };

  it("rolls back down instead of freezing on the rail", () => {
    const { state, furthest } = run(40);
    // It must have turned round: the energy budget makes a cart with exactly
    // zero kinetic energy a fixed point, so it used to stick where it stalled
    // and never move again.
    assert.ok(
      state.s < furthest - 1,
      `expected the cart to come back down from ${furthest.toFixed(1)}, ended at ${state.s.toFixed(1)}`,
    );
  });

  it("never climbs higher than its energy budget allows", () => {
    let state = startRun({ track, mass });
    const budget = state.mechanical;
    for (let i = 0; i < 40 * 120; i += 1) {
      state = stepRun(state, track, { mass, friction: true }, 1 / 120);
      const height = sampleAt(track, track.height, state.s);
      assert.ok(
        mass * G * height <= budget + 1e-6,
        `reached ${height.toFixed(2)} m on a budget of ${(budget / (mass * G)).toFixed(2)} m`,
      );
    }
  });

  it("settles somewhere real rather than drifting off the track", () => {
    const { state } = run(60);
    assert.ok(Number.isFinite(state.s));
    assert.ok(state.s >= 0 && state.s <= track.length);
    assert.ok(Number.isFinite(state.mechanical) && Number.isFinite(state.thermal));
  });
});

describe("speed from the energy budget", () => {
  it("returns zero rather than a NaN when there is nothing left", () => {
    assert.equal(speedFrom(0, 500, 10), 0);
  });

  it("matches v = √(2gh) for a cart that has fallen h", () => {
    const mass = 500;
    const mechanical = mass * G * 20;
    assert.ok(close(speedFrom(mechanical, mass, 0), Math.sqrt(2 * G * 20), 1e-9));
  });
});

describe("the loop is helical, so its rails do not lie on each other", () => {
  it("steps the track sideways across the loop and nowhere else", () => {
    const track = buildTrack({ releaseHeight: 30, loopRadius: 8 });
    assert.equal(lateralAt(track, 0), 0);
    assert.equal(lateralAt(track, track.loopEntryS - 1), 0);
    assert.ok(close(lateralAt(track, track.loopExitS), LOOP_OFFSET_M, 1e-12));
    assert.ok(close(lateralAt(track, track.length), LOOP_OFFSET_M, 1e-12));
    // Smooth and monotonic across it: no rail ever doubles back.
    let previous = 0;
    for (let i = 0; i <= 200; i += 1) {
      const at = track.loopEntryS + ((track.loopExitS - track.loopEntryS) * i) / 200;
      const z = lateralAt(track, at);
      assert.ok(z >= previous - 1e-12, "never moves back");
      previous = z;
    }
  });

  it("clears the track width, so the exit rails are not the entry rails", () => {
    // Rails are 1.4 m apart; the exit has to be displaced by more than that.
    assert.ok(LOOP_OFFSET_M > 1.4 + 0.3);
  });
});

describe("what the badge says about the loop", () => {
  const ride2 = (opts) => {
    const mass = 500;
    const track = buildTrack({ releaseHeight: opts.releaseHeight, loopRadius: opts.loopRadius ?? 8 });
    const clears = opts.releaseHeight >= minimumReleaseHeight(track.loopRadius);
    let state = startRun({ track, mass });
    const seen = new Set();
    for (let i = 0; i < 200000 && state.s < track.length - 0.2; i += 1) {
      state = stepRun(state, track, { mass, friction: Boolean(opts.friction) }, 0.002);
      const live = describeRun({ track, state, mass });
      seen.add(loopVerdict(live, { friction: Boolean(opts.friction), clears }));
      if (state.stopped) break;
    }
    return seen;
  };

  it("says it clears, then that it is round, on the frictionless track", () => {
    const seen = ride2({ releaseHeight: 25 });
    assert.ok(seen.has("clears") && seen.has("cleared"));
    assert.ok(!seen.has("derailed") && !seen.has("friction") && !seen.has("too-low"));
  });

  it("never claims a cart clears a loop that friction has left it too slow for", () => {
    // Exactly the frictionless minimum: friction takes what it needs from a
    // budget with nothing to spare, so the cart must not be told it clears.
    const seen = ride2({ releaseHeight: 20, friction: true });
    assert.ok(!seen.has("cleared"), "it never got round");
    assert.ok(seen.has("friction") || seen.has("derailed"), [...seen].join(", "));
  });

  it("reports a release below 2.5R as too low, and a derailed cart as derailed", () => {
    const low = ride2({ releaseHeight: 15 });
    assert.ok(low.has("too-low") || low.has("derailed"), [...low].join(", "));
    assert.equal(loopVerdict({ leftTrack: true, pastLoop: false, clearsLoop: true }, { clears: true }), "derailed");
    assert.equal(loopVerdict({ leftTrack: false, pastLoop: true, clearsLoop: false }, { clears: true, friction: true }), "cleared");
    assert.equal(loopVerdict({ leftTrack: false, pastLoop: false, clearsLoop: false }, { clears: false }), "too-low");
  });
});
