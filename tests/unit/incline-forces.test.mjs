import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FRICTION_SURFACES,
  G,
  RAMP_LENGTH_M,
  advanceBlock,
  angleOfRepose,
  holdingRange,
  maxStaticFriction,
  normalForce,
  solveIncline,
  weightComponents,
} from "../../lib/inclineForces.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

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
    for (let i = 0; i < 60; i += 1) m = advanceBlock(m, opts(), 0.016);
    assert.ok(m.velocity < 0, "should be heading down the slope");
    assert.ok(m.position < 0);
  });

  it("stops at the bottom of the ramp instead of sailing off it", () => {
    let m = { position: 0, velocity: 0 };
    for (let i = 0; i < 4000; i += 1) m = advanceBlock(m, opts(), 0.016);
    assert.ok(close(m.position, -RAMP_LENGTH_M / 2, 1e-9));
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
});
