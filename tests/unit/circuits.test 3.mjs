import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BATTERY_INTERNAL_R,
  FUSE_A,
  SHORT_R,
  TOPOLOGIES,
  branchesFor,
  buildConductors,
  driftSpeed,
  filamentHeat,
  parallelAll,
  parallelPair,
  solveCircuit,
} from "../../lib/circuits.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const TOPOS = Object.keys(TOPOLOGIES);

describe("equivalent resistance", () => {
  it("adds resistances in series", () => {
    for (const R of [2, 10, 27, 50]) {
      const c = solveCircuit({ topology: "series", voltage: 12, bulbR: R });
      assert.ok(close(c.networkR, 2 * R), `R=${R}`);
    }
  });

  it("takes the reciprocal sum in parallel", () => {
    for (const R of [2, 10, 27, 50]) {
      const c = solveCircuit({ topology: "parallel", voltage: 12, bulbR: R });
      assert.ok(close(1 / c.networkR, 1 / R + 1 / R, 1e-12), `R=${R}`);
    }
  });

  it("reduces the combination in stages: (R+R) in parallel with R", () => {
    const R = 10;
    const c = solveCircuit({ topology: "combination", voltage: 12, bulbR: R });
    assert.ok(close(c.networkR, (2 * R * R) / (2 * R + R), 1e-12));
  });

  it("always gives a parallel network less resistance than either branch", () => {
    for (const R of [2, 10, 50]) {
      const c = solveCircuit({ topology: "parallel", voltage: 9, bulbR: R });
      assert.ok(c.networkR < R, `R=${R}`);
    }
  });

  it("treats an open branch as infinite rather than as an error", () => {
    assert.equal(parallelPair(Infinity, 10), 10);
    assert.equal(parallelAll([Infinity, Infinity]), Infinity);
    assert.ok(close(parallelAll([10, 10]), 5));
  });
});

describe("parallel draws more, not less", () => {
  it("pulls more total current than the same bulbs in series", () => {
    for (const V of [1.5, 6, 12, 24]) {
      for (const R of [2, 10, 50]) {
        const s = solveCircuit({ topology: "series", voltage: V, bulbR: R });
        const p = solveCircuit({ topology: "parallel", voltage: V, bulbR: R });
        assert.ok(p.totalCurrent > s.totalCurrent, `V=${V} R=${R}`);
      }
    }
  });

  it("runs each parallel bulb brighter than each series bulb", () => {
    const s = solveCircuit({ topology: "series", voltage: 12, bulbR: 10 });
    const p = solveCircuit({ topology: "parallel", voltage: 12, bulbR: 10 });
    assert.ok(p.bulbs[0].brightness > s.bulbs[0].brightness);
  });

  it("approaches the ideal quarter-power result when the pack's own resistance is negligible", () => {
    // Internal resistance is what stops this being exactly 4; with a large
    // bulb resistance it becomes irrelevant and the textbook ratio appears.
    const s = solveCircuit({ topology: "series", voltage: 12, bulbR: 5000 });
    const p = solveCircuit({ topology: "parallel", voltage: 12, bulbR: 5000 });
    assert.ok(close(s.bulbs[0].brightness, 0.25, 1e-3));
    assert.ok(close(p.bulbs[0].brightness, 1, 1e-3));
  });
});

describe("removing a bulb", () => {
  it("kills the whole series circuit", () => {
    const c = solveCircuit({ topology: "series", voltage: 12, bulbR: 10, unscrewed: true });
    assert.equal(c.dead, true);
    assert.equal(c.totalCurrent, 0);
    assert.ok(c.bulbs.every((b) => !b.lit));
  });

  it("leaves the other parallel branch untouched", () => {
    const before = solveCircuit({ topology: "parallel", voltage: 12, bulbR: 10 });
    const after = solveCircuit({ topology: "parallel", voltage: 12, bulbR: 10, unscrewed: true });
    const b = after.bulbs.find((x) => x.id === "B");
    assert.equal(b.lit, true);
    assert.equal(after.dead, false);
    // Its own branch current RISES slightly: with one branch gone the pack
    // sags less, so the surviving bulb sees a little more voltage.
    assert.ok(b.current >= before.bulbs.find((x) => x.id === "B").current);
    // But the total falls — one fewer path is more resistance, not less.
    assert.ok(after.totalCurrent < before.totalCurrent);
  });

  it("keeps bulb C lit in the combination when A's series branch opens", () => {
    const c = solveCircuit({ topology: "combination", voltage: 12, bulbR: 10, unscrewed: true });
    assert.equal(c.bulbs.find((b) => b.id === "C").lit, true);
    assert.equal(c.bulbs.find((b) => b.id === "B").lit, false);
  });

  it("puts an unscrewed bulb's socket at infinite resistance", () => {
    const branches = branchesFor("series", 10, true);
    assert.equal(branches[0].bulbs[0].resistance, Infinity);
    assert.equal(branches[0].bulbs[1].resistance, 10);
  });
});

describe("short circuit", () => {
  it("steals the current and leaves the bulbs dark", () => {
    for (const topology of TOPOS) {
      const c = solveCircuit({ topology, voltage: 12, bulbR: 10, shorted: true });
      assert.ok(c.shortCurrent > 0.99 * c.totalCurrent, topology);
      assert.ok(c.allDark, topology);
      assert.ok(c.totalCurrent > FUSE_A, topology);
      assert.equal(c.overCurrent, true, topology);
    }
  });

  it("is limited by the pack's internal resistance, not by nothing", () => {
    const c = solveCircuit({ topology: "series", voltage: 12, bulbR: 10, shorted: true });
    assert.ok(Number.isFinite(c.totalCurrent));
    assert.ok(c.totalCurrent < 12 / BATTERY_INTERNAL_R);
    // Most of the power is now being dumped inside the battery.
    assert.ok(c.internalLoss > 0.5 * c.batteryPower);
  });

  it("still conducts through the jumper even when every bulb branch is open", () => {
    const c = solveCircuit({ topology: "series", voltage: 12, bulbR: 10, unscrewed: true, shorted: true });
    assert.equal(c.networkR, Infinity);
    assert.ok(close(c.externalR, SHORT_R, 1e-12));
    assert.ok(c.totalCurrent > 0);
    assert.ok(c.allDark);
  });
});

describe("the books balance", () => {
  it("makes the branch currents add up to the total", () => {
    for (const topology of TOPOS) {
      for (const shorted of [false, true]) {
        const c = solveCircuit({ topology, voltage: 9, bulbR: 12, shorted });
        const sum = c.branches.reduce((t, b) => t + b.current, 0) + c.shortCurrent;
        assert.ok(close(sum, c.totalCurrent, 1e-9), `${topology} shorted=${shorted}`);
      }
    }
  });

  it("accounts for every watt: emf × I = delivered + internal loss", () => {
    for (const topology of TOPOS) {
      const c = solveCircuit({ topology, voltage: 12, bulbR: 8 });
      const delivered = c.terminalVoltage * c.totalCurrent;
      assert.ok(close(c.batteryPower, delivered + c.internalLoss, 1e-9), topology);
    }
  });

  it("never lets a bulb exceed the power it would take at the full supply", () => {
    for (const topology of TOPOS) {
      for (const V of [1.5, 12, 24]) {
        const c = solveCircuit({ topology, voltage: V, bulbR: 6 });
        for (const b of c.bulbs) assert.ok(b.brightness <= 1 + 1e-12, `${topology} V=${V}`);
      }
    }
  });

  it("sags the terminal voltage below the emf whenever current flows", () => {
    const c = solveCircuit({ topology: "parallel", voltage: 12, bulbR: 4 });
    assert.ok(c.terminalVoltage < 12);
    assert.ok(close(c.terminalVoltage, 12 - c.totalCurrent * BATTERY_INTERNAL_R, 1e-9));
  });
});

describe("conductors on the board", () => {
  it("obeys the junction rule on every rail segment", () => {
    for (const topology of TOPOS) {
      for (const shorted of [false, true]) {
        const c = solveCircuit({ topology, voltage: 12, bulbR: 10, shorted });
        const { segments } = buildConductors(c);
        // The two pieces leaving the battery must both carry the full total.
        const first = segments.filter((s) => s.key.startsWith("left-") || s.key.startsWith("right-"));
        const maxRail = Math.max(...first.map((s) => s.current));
        assert.ok(close(maxRail, c.totalCurrent, 1e-9), `${topology} shorted=${shorted}`);
        // No piece may carry more than the supply does.
        for (const s of segments) {
          assert.ok(s.current <= c.totalCurrent + 1e-9, `${s.key} on ${topology}`);
        }
      }
    }
  });

  it("makes the crossing pieces add up to the supply current", () => {
    const c = solveCircuit({ topology: "parallel", voltage: 12, bulbR: 10, shorted: true });
    const { segments } = buildConductors(c);
    const across = segments.filter((s) => s.key.startsWith("across-"));
    const sum = across.reduce((t, s) => t + s.current, 0);
    assert.ok(close(sum, c.totalCurrent, 1e-9));
  });

  it("taps the rows in the order the rails reach them", () => {
    const c = solveCircuit({ topology: "combination", voltage: 12, bulbR: 10, shorted: true });
    const { taps } = buildConductors(c);
    for (let i = 1; i < taps.length; i += 1) {
      assert.ok(taps[i - 1].z > taps[i].z, "taps must run away from the battery");
    }
    assert.equal(taps[0].kind, "short", "the jumper sits nearest the pack");
  });

  it("lines each layout row up with its own solved branch", () => {
    for (const topology of TOPOS) {
      const c = solveCircuit({ topology, voltage: 12, bulbR: 10, unscrewed: true });
      const { rows } = buildConductors(c);
      assert.equal(rows.length, c.branches.length, topology);
      // Row 0 must be the branch bulb A is on — that is what the unscrew
      // button acts on, and a mismatch would dim the wrong bulb on screen.
      assert.ok(rows[0].bulbs.some((b) => b.id === "A"), topology);
      assert.equal(c.branches[0].open, true, topology);
    }
  });
});

describe("drawing helpers", () => {
  it("scales drift speed with current and clamps it", () => {
    assert.equal(driftSpeed(0), 0);
    assert.equal(driftSpeed(-1), 0);
    assert.ok(driftSpeed(2) > driftSpeed(1));
    assert.ok(driftSpeed(500) <= 4.5);
  });

  it("keeps filament heat inside 0–1 and rising", () => {
    assert.equal(filamentHeat(0), 0);
    assert.ok(close(filamentHeat(1), 1, 1e-12));
    assert.ok(filamentHeat(0.6) > filamentHeat(0.2));
    // A dim filament still glows visibly — the curve is deliberately not linear.
    assert.ok(filamentHeat(0.25) > 0.25);
  });
});
