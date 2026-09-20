import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FRICTION_SURFACES,
  G,
  TRAVEL_LIMIT_M,
  advanceBlock,
  angleOfRepose,
  holdingRange,
  maxStaticFriction,
  niceCeil,
  normalForce,
  slideForecast,
  solveIncline,
  solveMotion,
  traceAxes,
  weightComponents,
} from "../../lib/inclineForces.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const RAMP_LENGTH_HALF = 2;

describe("resolving weight on a slope", () => {
  it("puts the whole weight into the normal on the flat and none into the slope", () => {
    const w = weightComponents(10, 0);
    assert.ok(close(w.parallel, 0, 1e-12), "nothing should pull a block along level ground");
    assert.ok(close(w.perpendicular, 10 * G, 1e-9));
  });

  it("puts the whole weight down the slope and none into it when vertical", () => {
    const w = weightComponents(10, 90);
    assert.ok(close(w.parallel, 10 * G, 1e-9));
    assert.ok(close(w.perpendicular, 0, 1e-9), "a vertical wall presses on nothing");
  });

  it("splits the weight evenly at 45°", () => {
    const w = weightComponents(10, 45);
    assert.ok(close(w.parallel, w.perpendicular, 1e-9));
  });

  it("keeps the two components as the sides of a right triangle on the weight", () => {
    for (const deg of [0, 12, 30, 47, 68, 90]) {
      const w = weightComponents(23, deg);
      assert.ok(close(Math.hypot(w.parallel, w.perpendicular), w.weight, 1e-9), `${deg}°`);
    }
  });

  it("gives sinθ to the slope and cosθ to the normal, not the other way round", () => {
    // The check that settles the one students write backwards: a shallow slope
    // must pull less, not more.
    const shallow = weightComponents(10, 5);
    const steep = weightComponents(10, 60);
    assert.ok(shallow.parallel < steep.parallel);
    assert.ok(shallow.perpendicular > steep.perpendicular);
  });
});

describe("static friction is a reaction, not a formula", () => {
  it("supplies exactly what is needed while the block is held", () => {
    const r = solveIncline({ massKg: 10, angleDeg: 15, surface: "wood" });
    assert.equal(r.state, "static");
    assert.ok(close(r.frictionMagnitude, r.weightParallel, 1e-9), "must balance mg sinθ exactly");
    assert.ok(r.frictionMagnitude < r.grip, "and must be below its own ceiling");
  });

  it("never exceeds μs·N anywhere it is still holding", () => {
    for (const surface of Object.keys(FRICTION_SURFACES)) {
      for (let deg = 0; deg <= 90; deg += 3) {
        const r = solveIncline({ massKg: 25, angleDeg: deg, surface });
        if (r.isStatic) {
          assert.ok(r.frictionMagnitude <= r.grip + 1e-9, `${surface} @ ${deg}°`);
        }
      }
    }
  });

  it("points up the slope when gravity is winning and down when the pull is", () => {
    const gravityWins = solveIncline({ massKg: 10, angleDeg: 15, surface: "wood" });
    assert.ok(gravityWins.friction > 0, "friction should oppose sliding down, so it acts up the slope");
    const pullWins = solveIncline({ massKg: 10, angleDeg: 15, surface: "wood", appliedForce: 40 });
    assert.ok(pullWins.friction < 0, "an over-strong pull is resisted by friction acting down the slope");
  });

  it("reports how much of the available grip is in use", () => {
    const r = solveIncline({ massKg: 10, angleDeg: 15, surface: "wood" });
    assert.ok(close(r.gripUsed, r.demand / r.grip, 1e-9));
    assert.ok(r.gripUsed > 0 && r.gripUsed < 1);
  });
});

describe("the angle of repose", () => {
  it("is arctan of the static coefficient", () => {
    for (const [, s] of Object.entries(FRICTION_SURFACES)) {
      assert.ok(close(angleOfRepose(s.muS), (Math.atan(s.muS) * 180) / Math.PI, 1e-9));
    }
  });

  it("does not depend on the mass at all", () => {
    // The scene's mass slider exists partly to let a student discover this.
    const angles = [1, 7, 25, 50].map((m) => {
      for (let deg = 0; deg <= 90; deg += 0.1) {
        if (!solveIncline({ massKg: m, angleDeg: deg, surface: "wood" }).isStatic) return deg;
      }
      return 90;
    });
    for (const a of angles) assert.ok(Math.abs(a - angles[0]) < 0.15, `${angles.join(", ")}`);
  });

  it("matches where the solver actually lets go", () => {
    for (const surface of Object.keys(FRICTION_SURFACES)) {
      const repose = angleOfRepose(FRICTION_SURFACES[surface].muS);
      const below = solveIncline({ massKg: 10, angleDeg: repose - 0.5, surface });
      const above = solveIncline({ massKg: 10, angleDeg: repose + 0.5, surface });
      assert.equal(below.isStatic, true, `${surface} should hold below repose`);
      assert.equal(above.isStatic, false, `${surface} should slip above repose`);
    }
  });

  it("puts teflon barely off the flat and rubber past 40°", () => {
    assert.ok(angleOfRepose(FRICTION_SURFACES.teflon.muS) < 3);
    assert.ok(angleOfRepose(FRICTION_SURFACES.rubber.muS) > 40);
  });
});

describe("breaking away and sliding", () => {
  it("keeps kinetic friction below static for every surface that is not teflon", () => {
    assert.ok(FRICTION_SURFACES.wood.muK < FRICTION_SURFACES.wood.muS);
    assert.ok(FRICTION_SURFACES.rubber.muK < FRICTION_SURFACES.rubber.muS);
  });

  it("drops the friction the instant it starts moving, which is the lurch", () => {
    const angle = angleOfRepose(FRICTION_SURFACES.wood.muS) + 0.2;
    const held = solveIncline({ massKg: 10, angleDeg: angle, surface: "wood", velocity: 0 });
    const moving = solveIncline({ massKg: 10, angleDeg: angle, surface: "wood", velocity: -0.5 });
    assert.ok(moving.frictionMagnitude < held.grip);
    assert.ok(Math.abs(moving.acceleration) > 0);
  });

  it("opposes MOTION rather than the applied force once sliding", () => {
    // Dragged uphill, friction acts downhill even though the pull is uphill.
    const r = solveIncline({ massKg: 10, angleDeg: 20, surface: "wood", appliedForce: 200, velocity: 1.5 });
    assert.ok(r.friction < 0, "friction must oppose the upward motion");
  });

  it("falls freely down a vertical face, with no normal force to grip on", () => {
    const r = solveIncline({ massKg: 10, angleDeg: 90, surface: "rubber" });
    assert.ok(close(r.normal, 0, 1e-9));
    assert.ok(close(r.frictionMagnitude, 0, 1e-9), "no normal force means no friction, however grippy");
    assert.ok(close(r.acceleration, -G, 1e-9));
  });
});

describe("the applied pull", () => {
  it("does not change the normal force, because it acts along the ramp", () => {
    const none = solveIncline({ massKg: 10, angleDeg: 25, surface: "wood" });
    const pulled = solveIncline({ massKg: 10, angleDeg: 25, surface: "wood", appliedForce: 300 });
    assert.ok(close(none.normal, pulled.normal, 1e-9));
  });

  it("has a whole window of values that hold the block, not one exact answer", () => {
    const w = holdingRange({ massKg: 10, angleDeg: 30, surface: "wood" });
    assert.ok(close(w.max - w.min, 2 * maxStaticFriction(0.5, normalForce(10, 30)), 1e-9));
    for (const f of [w.min + 0.01, w.ideal, w.max - 0.01]) {
      assert.equal(solveIncline({ massKg: 10, angleDeg: 30, surface: "wood", appliedForce: f }).isStatic, true);
    }
    for (const f of [w.min - 1, w.max + 1]) {
      assert.equal(solveIncline({ massKg: 10, angleDeg: 30, surface: "wood", appliedForce: f }).isStatic, false);
    }
  });

  it("shuts that window completely on a frictionless surface", () => {
    const w = holdingRange({ massKg: 10, angleDeg: 30, surface: "teflon" });
    assert.ok(w.max - w.min < 0.15 * 10 * G, "teflon leaves almost no margin for error");
  });
});

describe("the block's motion", () => {
  const opts = (over) => ({ massKg: 10, angleDeg: 40, surface: "wood", appliedForce: 0, ...over });

  it("stays exactly where it is put when the slope cannot beat static friction", () => {
    let m = { position: 0, velocity: 0 };
    for (let i = 0; i < 400; i += 1) m = advanceBlock(m, opts({ angleDeg: 10 }), 0.016);
    assert.equal(m.position, 0);
    assert.equal(m.velocity, 0);
  });

  it("accelerates down a slope past the angle of repose", () => {
    let m = { position: 0, velocity: 0 };
    for (let i = 0; i < 30; i += 1) m = advanceBlock(m, opts(), 0.016);
    assert.ok(m.velocity < 0, "should be heading down the slope");
    assert.ok(m.position < 0);
  });

  it("stops at the bottom of the ramp instead of sailing off it", () => {
    let m = { position: 0, velocity: 0 };
    for (let i = 0; i < 4000; i += 1) m = advanceBlock(m, opts(), 0.016);
    assert.ok(close(m.position, -TRAVEL_LIMIT_M, 1e-9));
    assert.equal(m.velocity, 0);
  });

  it("settles rather than chattering when a pull brings it back to rest", () => {
    // Sent up the slope, then released: it must stop dead once static friction
    // can hold it, not oscillate across zero for ever.
    let m = { position: 0, velocity: 1.2 };
    for (let i = 0; i < 2000; i += 1) m = advanceBlock(m, opts({ angleDeg: 10 }), 0.016);
    assert.equal(m.velocity, 0, "should come to a genuine stop");
  });

  it("never lets the block accelerate uphill under gravity alone", () => {
    let m = { position: 0, velocity: 0 };
    for (let i = 0; i < 500; i += 1) {
      m = advanceBlock(m, opts(), 0.016);
      assert.ok(m.velocity <= 1e-9, "gravity cannot push a block up a ramp");
    }
  });

  it("prevents chattering and velocity spikes when force is max and mass is low against barriers", () => {
    // Extreme condition: 500 N pull with 1 kg mass up a 10° ramp
    let m = { position: 0, velocity: 0 };
    const extremeOpts = { massKg: 1, angleDeg: 10, surface: "wood", appliedForce: 500 };
    // Accelerates rapidly to the top barrier
    for (let i = 0; i < 50; i += 1) {
      m = advanceBlock(m, extremeOpts, 0.016);
    }
    assert.ok(close(m.position, TRAVEL_LIMIT_M, 1e-4), "must be at top barrier");
    assert.equal(m.velocity, 0, "velocity must be exactly 0 at the barrier");

    // Hold under max force for 200 more frames: must remain at 0 velocity with zero chatter
    for (let i = 0; i < 200; i += 1) {
      m = advanceBlock(m, extremeOpts, 0.016);
      assert.equal(m.velocity, 0, "velocity must not oscillate or chatter against barrier");
      assert.equal(m.solved.acceleration, 0, "acceleration must be 0 while resting against barrier");
    }
  });

  it("handles 90 degrees with maximum force without errors or NaN", () => {
    let m = { position: 0, velocity: 0 };
    const opts90 = { massKg: 1, angleDeg: 90, surface: "wood", appliedForce: 500 };
    for (let i = 0; i < 50; i += 1) {
      m = advanceBlock(m, opts90, 0.016);
    }
    assert.ok(close(m.position, TRAVEL_LIMIT_M, 1e-4), "must be at top barrier");
    assert.equal(m.velocity, 0, "velocity must be exactly 0 at the barrier");
    assert.equal(m.solved.acceleration, 0, "acceleration must be 0 while resting against barrier");
  });
});

describe("the block against its stop, and the graph that records the slide", () => {
  const opts = (over) => ({ massKg: 10, angleDeg: 40, surface: "wood", appliedForce: 0, ...over });

  it("travels a distance the crate can actually cover: half the ramp less half the crate and the stop", () => {
    assert.ok(TRAVEL_LIMIT_M < RAMP_LENGTH_HALF, "the centre never reaches the end of the ramp");
    assert.ok(RAMP_LENGTH_HALF - TRAVEL_LIMIT_M > 0.3, "and leaves room for half a crate");
  });

  it("moves the block exactly, however long the frames are: x = ½at², v = at", () => {
    const o = opts();
    const a = solveIncline({ ...o, velocity: 0 }).acceleration; // negative: down the slope
    for (const dt of [0.004, 0.016, 0.05, 0.15]) {
      let m = { position: 0, velocity: 0 };
      let t = 0;
      while (t < 0.6 - 1e-9) {
        m = advanceBlock(m, o, dt);
        t += dt;
      }
      assert.ok(close(m.velocity, a * t, 1e-9), `v at dt=${dt}`);
      assert.ok(close(m.position, 0.5 * a * t * t, 1e-9), `x at dt=${dt}`);
    }
  });

  it("arrives at the stop at exactly √(2|a|d), and says when it got there", () => {
    const o = opts();
    const f = slideForecast(o);
    // A big step that overshoots the stop: the answer must not depend on it.
    for (const dt of [0.004, 0.016, 0.15]) {
      let m = { position: 0, velocity: 0 };
      let elapsed = 0;
      let hit = null;
      for (let i = 0; i < 2000 && !hit; i += 1) {
        m = advanceBlock(m, o, dt);
        if (m.hitBarrier) {
          hit = m;
          elapsed += m.hitTime;
        } else {
          elapsed += dt;
        }
      }
      assert.ok(hit, "it reaches the stop");
      assert.ok(close(Math.abs(hit.arrivalVelocity), f.impactSpeed, 1e-9), `impact speed at dt=${dt}`);
      assert.ok(close(elapsed, f.timeToStop, 1e-9), `time at dt=${dt}`);
      assert.equal(hit.velocity, 0);
      assert.ok(close(hit.position, -TRAVEL_LIMIT_M, 1e-12));
    }
  });

  it("checks the impact against the textbook: v² = 2as with a = g(sinθ − μk cosθ)", () => {
    const f = slideForecast(opts());
    const a = 9.81 * (Math.sin((40 * Math.PI) / 180) - 0.3 * Math.cos((40 * Math.PI) / 180));
    assert.ok(close(Math.abs(f.acceleration), a, 1e-9));
    assert.ok(close(f.impactSpeed, Math.sqrt(2 * a * TRAVEL_LIMIT_M), 1e-9));
    assert.equal(f.direction, -1, "down the slope");
  });

  it("forecasts nothing for a block the slope cannot move, and an upward slide for a strong pull", () => {
    const still = slideForecast(opts({ angleDeg: 10 }));
    assert.equal(still.slides, false);
    assert.equal(still.timeToStop, null);
    const up = slideForecast(opts({ angleDeg: 10, appliedForce: 300 }));
    assert.equal(up.slides, true);
    assert.equal(up.direction, 1);
  });

  it("draws the stop's push, so a block pinned against it balances on the diagram", () => {
    const o = opts();
    const pinned = solveMotion(o, { position: -TRAVEL_LIMIT_M, velocity: 0 });
    assert.equal(pinned.atBarrier, "bottom");
    assert.equal(pinned.netForce, 0);
    // Weight along the slope (down), friction and the stop's push (both up) sum to zero.
    const along = -pinned.weightParallel + pinned.friction + pinned.stopForce;
    assert.ok(close(along, 0, 1e-9), `unbalanced by ${along}`);
    assert.ok(pinned.stopForce > 0, "the bottom stop pushes up the slope");
    // Away from a stop there is no such force.
    assert.equal(solveMotion(o, { position: 0, velocity: 0 }).stopForce, undefined);
    // Pulled hard against the top stop, the stop pushes back down the slope.
    const top = solveMotion(opts({ angleDeg: 10, appliedForce: 300 }), { position: TRAVEL_LIMIT_M, velocity: 0 });
    assert.equal(top.atBarrier, "top");
    assert.ok(top.stopForce < 0);
    assert.ok(close(300 - top.weightParallel + top.friction + top.stopForce, 0, 1e-9));
  });

  it("picks round axis limits, at or just above the value they have to hold", () => {
    assert.equal(niceCeil(4.06), 4.5);
    assert.equal(niceCeil(1.01), 1.2);
    assert.equal(niceCeil(0.083), 0.09);
    assert.equal(niceCeil(41), 45);
    for (const x of [0.013, 0.7, 1, 3.98, 9.99, 12, 250]) {
      const n = niceCeil(x);
      assert.ok(n >= x && n < x * 1.34, `${x} → ${n}`);
    }
  });

  it("fixes the velocity graph's axes from the physics, so they never rescale mid-run", () => {
    // Slides down: the run ends inside the window, the speed inside the range, zero at the top.
    for (const o of [opts(), opts({ angleDeg: 60 }), opts({ surface: "teflon", angleDeg: 5 }), opts({ angleDeg: 80, massKg: 1 })]) {
      const f = slideForecast(o);
      const ax = traceAxes(f);
      assert.ok(f.slides);
      assert.ok(ax.tMax >= f.timeToStop && ax.tMax <= f.timeToStop * 1.6, "window fits the run");
      assert.equal(ax.vMax, 0);
      assert.ok(-ax.vMin >= f.impactSpeed, "range holds the impact speed");
    }
    // Pulled up: zero at the bottom.
    const up = traceAxes(slideForecast(opts({ angleDeg: 10, appliedForce: 300 })));
    assert.equal(up.vMin, 0);
    assert.ok(up.vMax > 0);
    // Holds still: a symmetric window with the zero line in the middle.
    const still = traceAxes(slideForecast(opts({ angleDeg: 10 })));
    assert.deepEqual(still, { tMax: 4, vMin: -2, vMax: 2 });
  });

  it("never lets the plotted curve leave its axes, whatever the settings", () => {
    for (const surface of ["teflon", "wood", "rubber"]) {
      for (const angleDeg of [3, 15, 30, 45, 70, 90]) {
        for (const appliedForce of [-500, -120, 0, 80, 500]) {
          for (const massKg of [1, 10, 50]) {
            const o = { massKg, angleDeg, surface, appliedForce };
            const ax = traceAxes(slideForecast(o));
            let m = { position: 0, velocity: 0 };
            let t = 0;
            for (let i = 0; i < 4000 && t <= ax.tMax; i += 1) {
              m = advanceBlock(m, o, 0.016);
              t += m.hitBarrier ? m.hitTime : 0.016;
              const v = m.hitBarrier ? m.arrivalVelocity : m.velocity;
              assert.ok(v >= ax.vMin - 1e-9 && v <= ax.vMax + 1e-9, `${JSON.stringify(o)} v=${v} outside [${ax.vMin}, ${ax.vMax}]`);
              if (m.hitBarrier) {
                assert.ok(t <= ax.tMax + 1e-9, `${JSON.stringify(o)} stops at ${t} after the window ${ax.tMax}`);
                break;
              }
            }
          }
        }
      }
    }
  });
});
