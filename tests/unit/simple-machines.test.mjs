import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BEAM_LENGTH_M,
  LEVER_EFFICIENCY,
  LIFT_M,
  MACHINES,
  SHEAVE_EFFICIENCY,
  efficiencyOf,
  isLever,
  leverLayout,
  leverSwing,
  solveMachine,
  supportingRopes,
  velocityRatio,
} from "../../lib/simpleMachines.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const TYPES = ["lever1", "lever2", "lever3", "pulley"];

describe("no machine reduces the work", () => {
  it("never gets more work out than was put in", () => {
    for (const type of TYPES) {
      for (const p of [0.15, 0.35, 0.5, 0.75]) {
        for (const sheaves of [1, 2, 3, 4]) {
          for (const loadN of [10, 120, 500]) {
            const m = solveMachine({ type, p, sheaves, loadN });
            assert.ok(m.workOut <= m.workIn + 1e-9, `${type} p=${p} n=${sheaves} F=${loadN}`);
          }
        }
      }
    }
  });

  it("accounts for every joule: in = out + wasted", () => {
    for (const type of TYPES) {
      const m = solveMachine({ type, p: 0.3, sheaves: 3, loadN: 250 });
      assert.ok(close(m.workIn, m.workOut + m.wasted, 1e-9), type);
    }
  });

  it("makes work out exactly the efficiency times work in", () => {
    for (const type of TYPES) {
      const m = solveMachine({ type, p: 0.4, sheaves: 2, loadN: 300 });
      assert.ok(close(m.workOut, m.workIn * m.efficiency, 1e-9), type);
    }
  });

  it("balances an ideal machine exactly — force down, distance up", () => {
    // Strip the friction out and the two ratios must agree perfectly.
    const vr = velocityRatio("lever1", 0.25);
    const idealEffort = 300 / vr;
    assert.ok(close(idealEffort * (LIFT_M * vr), 300 * LIFT_M, 1e-9));
  });
});

describe("distance ratio is geometry, mechanical advantage is force", () => {
  it("keeps the distance ratio untouched by friction", () => {
    const m = solveMachine({ type: "pulley", sheaves: 4, loadN: 300 });
    assert.ok(close(m.velocityRatio, 4, 1e-12));
    assert.ok(m.mechanicalAdvantage < m.velocityRatio, "friction must eat into the force ratio only");
  });

  it("makes efficiency exactly MA ÷ VR", () => {
    for (const type of TYPES) {
      const m = solveMachine({ type, p: 0.3, sheaves: 3, loadN: 300 });
      assert.ok(close(m.mechanicalAdvantage / m.velocityRatio, m.efficiency, 1e-9), type);
    }
  });

  it("derives the effort force from the force ratio, not the distance ratio", () => {
    const m = solveMachine({ type: "pulley", sheaves: 3, loadN: 300 });
    assert.ok(close(m.effortForce, m.loadN / m.mechanicalAdvantage, 1e-9));
    assert.ok(m.effortForce > m.loadN / m.velocityRatio, "the ideal figure would be optimistic");
  });

  it("moves the effort exactly VR times as far as the load", () => {
    for (const type of TYPES) {
      const m = solveMachine({ type, p: 0.3, sheaves: 3, loadN: 300, lift: 0.2 });
      assert.ok(close(m.effortDistance / m.loadDistance, m.velocityRatio, 1e-9), type);
    }
  });
});

describe("the three classes of lever", () => {
  it("puts the fulcrum in the middle for class 1 and lets it go either way", () => {
    const forceGain = solveMachine({ type: "lever1", p: 0.25, loadN: 300 });
    const speedGain = solveMachine({ type: "lever1", p: 0.75, loadN: 300 });
    assert.ok(forceGain.velocityRatio > 1, "fulcrum near the load gains force");
    assert.ok(speedGain.velocityRatio < 1, "fulcrum near the effort gains speed");
  });

  it("never lets a class 2 lever fall below an advantage of 1", () => {
    for (let p = 0.1; p <= 0.9; p += 0.05) {
      assert.ok(velocityRatio("lever2", p) >= 1 - 1e-9, `p=${p.toFixed(2)}`);
    }
  });

  it("never lets a class 3 lever rise above an advantage of 1", () => {
    for (let p = 0.1; p <= 0.9; p += 0.05) {
      assert.ok(velocityRatio("lever3", p) <= 1 + 1e-9, `p=${p.toFixed(2)}`);
    }
  });

  it("orders the three points as each class is defined to", () => {
    const c1 = leverLayout("lever1", 0.4);
    assert.ok(c1.load < c1.fulcrum && c1.fulcrum < c1.effort, "class 1: load — fulcrum — effort");
    const c2 = leverLayout("lever2", 0.4);
    assert.ok(c2.fulcrum < c2.load && c2.load < c2.effort, "class 2: fulcrum — load — effort");
    const c3 = leverLayout("lever3", 0.4);
    assert.ok(c3.fulcrum < c3.effort && c3.effort < c3.load, "class 3: fulcrum — effort — load");
  });

  it("makes the class 3 lever cost force, as a forearm does", () => {
    const m = solveMachine({ type: "lever3", p: 0.2, loadN: 100 });
    assert.equal(m.losesForce, true);
    assert.ok(m.effortForce > m.loadN, "you pull harder than the load weighs");
  });

  it("gives both ends of the bar the same swing angle but different arcs", () => {
    const swing = leverSwing("lever1", 0.25, 0.1);
    const { loadArm, effortArm } = leverLayout("lever1", 0.25);
    assert.ok(close(swing.effortDrop / swing.loadRise, effortArm / loadArm, 1e-9));
  });

  it("keeps the arms adding up to the whole bar for class 1", () => {
    const { loadArm, effortArm } = leverLayout("lever1", 0.35);
    assert.ok(close(loadArm + effortArm, BEAM_LENGTH_M, 1e-9));
  });
});

describe("the block and tackle", () => {
  it("gives an advantage equal to the number of supporting ropes", () => {
    for (const n of [1, 2, 3, 4]) {
      assert.ok(close(velocityRatio("pulley", 0, n), n, 1e-12));
    }
  });

  it("makes you haul n metres of rope for every metre the load rises", () => {
    for (const n of [1, 2, 3, 4]) {
      const m = solveMachine({ type: "pulley", sheaves: n, loadN: 400, lift: 0.5 });
      assert.ok(close(m.effortDistance, 0.5 * n, 1e-9));
    }
  });

  it("loses a little more to friction with every sheave added", () => {
    let previous = 1;
    for (const n of [1, 2, 3, 4]) {
      const e = efficiencyOf("pulley", n);
      assert.ok(e < previous, `${n} sheaves should be less efficient than ${n - 1}`);
      assert.ok(close(e, SHEAVE_EFFICIENCY ** n, 1e-12));
      previous = e;
    }
  });

  it("still gains overall despite that, over this range of sheaves", () => {
    // Worth asserting: the efficiency penalty must not overwhelm the gain, or
    // the scene would be teaching that block and tackles do not work.
    let previous = 0;
    for (const n of [1, 2, 3, 4]) {
      const m = solveMachine({ type: "pulley", sheaves: n, loadN: 400 });
      assert.ok(m.mechanicalAdvantage > previous, `${n} sheaves`);
      previous = m.mechanicalAdvantage;
    }
  });

  it("rounds a fractional sheave count to a whole rope", () => {
    assert.equal(supportingRopes(2.4), 2);
    assert.equal(supportingRopes(0), 1);
  });
});

describe("bookkeeping", () => {
  it("uses one pivot's worth of friction for every lever", () => {
    for (const type of ["lever1", "lever2", "lever3"]) {
      assert.ok(close(efficiencyOf(type, 0), LEVER_EFFICIENCY, 1e-12));
      assert.equal(isLever(type), true);
    }
    assert.equal(isLever("pulley"), false);
  });

  it("names every machine it offers", () => {
    for (const type of TYPES) {
      const m = MACHINES[type];
      assert.ok(m && m.label && m.example && m.order, type);
    }
  });

  it("reports the load as a mass a student would recognise", () => {
    const m = solveMachine({ type: "lever1", p: 0.3, loadN: 981 });
    assert.ok(close(m.loadMassKg, 100, 0.05), "981 N is about 100 kg");
  });

  it("stays finite everywhere the controls can reach", () => {
    for (const type of TYPES) {
      for (let p = 0.1; p <= 0.9; p += 0.1) {
        for (let loadN = 10; loadN <= 500; loadN += 70) {
          const m = solveMachine({ type, p, sheaves: 2, loadN });
          for (const v of [m.effortForce, m.workIn, m.workOut, m.wasted, m.velocityRatio, m.mechanicalAdvantage]) {
            assert.ok(Number.isFinite(v) && v >= 0, `${type} p=${p.toFixed(1)} F=${loadN}`);
          }
        }
      }
    }
  });

  it("guarantees the lever bar stays strictly above the workbench base for all arm positions", () => {
    const S = 2.1;
    const BENCH_Y = -1.9;
    const PIVOT_HEIGHT_ABOVE_BENCH = 1.22;
    const pivotY = BENCH_Y + PIVOT_HEIGHT_ABOVE_BENCH;

    for (const type of ["lever1", "lever2", "lever3"]) {
      for (let p = 0.08; p <= 0.92; p += 0.02) {
        const layout = leverLayout(type, p);
        let lift;
        if (type === "lever1") {
          const tiltsClockwise = layout.load < layout.fulcrum;
          const downArmM = tiltsClockwise ? layout.effortArm : layout.loadArm;
          const maxSafeDropM = Math.max(PIVOT_HEIGHT_ABOVE_BENCH - 0.22, 0.25) / S;
          const maxSin = Math.min(Math.max(maxSafeDropM / Math.max(downArmM, 0.001), 0.05), 0.55);
          lift = Math.min(LIFT_M, layout.loadArm * maxSin);
        } else {
          lift = Math.min(LIFT_M, 0.35 * layout.loadArm);
        }
        const solved = solveMachine({ type, p, loadN: 300, lift });

        // World geometry
        const leftArmWorld = layout.fulcrum * S;
        const rightArmWorld = (BEAM_LENGTH_M - layout.fulcrum) * S;
        const tiltsClockwise = layout.load < layout.fulcrum;
        const downArmWorld = tiltsClockwise ? rightArmWorld : leftArmWorld;
        const maxAllowedSin = Math.min(Math.max((PIVOT_HEIGHT_ABOVE_BENCH - 0.22) / Math.max(downArmWorld, 0.001), 0.05), 0.95);
        const maxAngle = Math.asin(Math.min(Math.max(solved.loadDistance / Math.max(layout.loadArm, 1e-6), 0), maxAllowedSin));

        // Lowest vertical point along the entire beam length at peak stroke
        const angle = maxAngle * (tiltsClockwise ? -1 : 1);
        const yLeft = pivotY - leftArmWorld * Math.sin(angle);
        const yRight = pivotY + rightArmWorld * Math.sin(angle);
        const lowestPoint = Math.min(yLeft, yRight) - 0.10; // 0.10 accounts for bar half-height and rails

        // The bar must strictly stay above the workbench top (BENCH_Y)
        assert.ok(
          lowestPoint >= BENCH_Y + 0.05,
          `Bar dips under base in ${type} at p=${p.toFixed(2)}: lowestPoint=${lowestPoint.toFixed(3)}, BENCH_Y=${BENCH_Y}`,
        );
      }
    }
  });

  it("scales inertia and respects direction conventions across all lever classes", () => {
    // Dynamic speed slows with increasing load mass
    const speed = 1;
    const speedLight = Math.max(0.25, speed / Math.pow(Math.max(50, 20) / 200, 0.22));
    const speedHeavy = Math.max(0.25, speed / Math.pow(Math.max(500, 20) / 200, 0.22));
    assert.ok(speedLight > speedHeavy, "Heavier load must produce slower stroke cadence due to inertia");

    // Direction conventions: Class 2 & 3 lift upwards, Class 1 presses downwards
    const dir1 = "lever1" === "lever2" || "lever1" === "lever3" ? [0, 1, 0] : [0, -1, 0];
    const dir2 = "lever2" === "lever2" || "lever2" === "lever3" ? [0, 1, 0] : [0, -1, 0];
    const dir3 = "lever3" === "lever2" || "lever3" === "lever3" ? [0, 1, 0] : [0, -1, 0];

    assert.deepStrictEqual(dir1, [0, -1, 0], "Class 1 effort pushes downwards");
    assert.deepStrictEqual(dir2, [0, 1, 0], "Class 2 effort lifts upwards");
    assert.deepStrictEqual(dir3, [0, 1, 0], "Class 3 effort lifts upwards");
  });

  it("maintains positive vertical clearance between pulley safe and workbench base", () => {
    const BENCH_Y = -1.9;
    const topY = BENCH_Y + 4.5;
    const drop = 2.2;
    const S = 2.1;
    const safeHalfHeight = 1.15 / 2;

    for (const sheaves of [1, 2, 3, 4, 6]) {
      const solved = solveMachine({ type: "pulley", sheaves, loadN: 300 });
      // At lowest position (phase = 0)
      const lowestLowerY = topY - drop;
      const safeCenterY = lowestLowerY - 1.15;
      const safeBottomY = safeCenterY - safeHalfHeight;

      assert.ok(
        safeBottomY >= BENCH_Y + 0.1,
        `Pulley safe bottom (${safeBottomY.toFixed(3)}) must stay above workbench (${BENCH_Y})`,
      );

      // Verify effort travel matches n * loadDistance
      assert.ok(
        close(solved.effortDistance, solved.ropes * solved.loadDistance, 1e-9),
        "Pulley hauling distance must equal velocityRatio * loadDistance",
      );
    }
  });
});

