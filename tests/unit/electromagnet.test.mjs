import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CORES,
  CORE_KEYS,
  CURRENT_RANGE,
  MAX_CLIPS,
  TURN_RANGE,
  airField,
  ellipticKE,
  fieldAt,
  inFootprint,
  loopField,
  solveElectromagnet,
  traceFieldLine,
} from "../../lib/electromagnet.js";

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

describe("the coil's own field", () => {
  it("is proportional to the current and to the turns", () => {
    close(airField(200, 2), 2 * airField(200, 1), 1e-15);
    close(airField(400, 1), 2 * airField(200, 1), 1e-15);
  });

  it("is a few tens of millitesla at most, as a bench coil is", () => {
    const b = airField(TURN_RANGE[1], CURRENT_RANGE[1]);
    assert.ok(b > 0.01 && b < 0.05, `${b} T`);
  });
});

describe("solveElectromagnet", () => {
  it("multiplies the field with a core, soft iron more than steel", () => {
    const air = solveElectromagnet({ turns: 300, current: 2, core: "air" });
    const iron = solveElectromagnet({ turns: 300, current: 2, core: "softIron" });
    const steel = solveElectromagnet({ turns: 300, current: 2, core: "steel" });
    close(air.centreT, air.airT);
    assert.ok(iron.centreT > steel.centreT && steel.centreT > air.centreT);
    assert.ok(iron.gain > 7 && iron.gain <= CORES.softIron.gain);
  });

  it("holds more clips with more current, and none with the coil alone", () => {
    const counts = [0.5, 1, 2, 3].map((current) => solveElectromagnet({ turns: 500, current, core: "softIron" }).clips);
    for (let i = 1; i < counts.length; i += 1) assert.ok(counts[i] >= counts[i - 1], counts.join(","));
    assert.equal(counts[3], MAX_CLIPS);
    assert.equal(solveElectromagnet({ turns: 500, current: 3, core: "air" }).clips, 0);
  });

  it("swaps the poles when the current is reversed (right-hand grip)", () => {
    assert.equal(solveElectromagnet({ reverse: false }).north, "right");
    assert.equal(solveElectromagnet({ reverse: true }).north, "left");
    assert.equal(solveElectromagnet({ current: 0 }).north, null);
  });

  it("leaves soft iron all but unmagnetised when the current stops, and steel a permanent magnet", () => {
    for (const [core, keeps] of [
      ["softIron", false],
      ["steel", true],
    ]) {
      const on = solveElectromagnet({ turns: 500, current: 3, core });
      const off = solveElectromagnet({ turns: 500, current: 3, core, on: false, retained: on.retainedNext });
      assert.equal(off.current, 0);
      close(off.centreT, on.retainedNext);
      assert.equal(off.clips > 0, keeps, `${core} holds ${off.clips} with the current off`);
    }
  });

  it("keeps what steel held under a field too weak to rewrite it, and rewrites it under a strong one", () => {
    const strong = solveElectromagnet({ turns: 500, current: 3, core: "steel" });
    const weak = solveElectromagnet({ turns: 100, current: 0.1, reverse: true, core: "steel", retained: strong.retainedNext });
    close(weak.retainedNext, strong.retainedNext);
    const rewrite = solveElectromagnet({ turns: 500, current: 3, reverse: true, core: "steel", retained: strong.retainedNext });
    assert.ok(rewrite.retainedNext < 0);
  });

  it("is finite over every control setting", () => {
    for (const core of CORE_KEYS) {
      for (const turns of [TURN_RANGE[0], 300, TURN_RANGE[1]]) {
        for (const current of [0, 1.5, 3]) {
          for (const on of [true, false]) {
            const s = solveElectromagnet({ turns, current, core, on, retained: 0.02 });
            for (const k of ["airT", "centreT", "poleT", "retainedNext", "clips"]) assert.ok(Number.isFinite(s[k]), `${core} ${k}`);
          }
        }
      }
    }
  });
});

describe("the field on the card", () => {
  it("has the right elliptic integrals", () => {
    const { K, E } = ellipticKE(0);
    close(K, Math.PI / 2);
    close(E, Math.PI / 2);
    const half = ellipticKE(0.5);
    close(half.K, 1.854074677301372, 1e-12);
    close(half.E, 1.350643881047675, 1e-12);
  });

  it("matches a loop's field on its axis as it approaches it", () => {
    const near = loopField(1, 0, 0.4, 1e-5);
    const on = loopField(1, 0, 0.4, 0);
    close(near.bx, on.bx, 1e-6);
  });

  it("is the given centre field at the centre, along the axis", () => {
    const s = solveElectromagnet({ turns: 300, current: 2, core: "softIron" });
    const b = fieldAt(0, 0, { airT: s.airT, centreT: s.centreT, core: "softIron" });
    close(b.bx, s.centreT, 1e-12);
    close(b.bz, 0, 1e-15);
  });

  it("is mirror-symmetric about the axis and returns outside the coil", () => {
    const s = solveElectromagnet({ turns: 300, current: 2, core: "steel" });
    const f = { airT: s.airT, centreT: s.centreT, core: "steel" };
    const up = fieldAt(2.5, 1.2, f);
    const down = fieldAt(2.5, -1.2, f);
    close(up.bx, down.bx, 1e-15);
    close(up.bz, -down.bz, 1e-15);
    // beside the middle of the coil the field runs back, against the inside
    assert.ok(fieldAt(0, 1.8, f).bx < 0);
  });

  it("traces a field line from the north end round to the south", () => {
    const s = solveElectromagnet({ turns: 300, current: 1.5, core: "softIron" });
    const line = traceFieldLine(1.3, -0.68, { airT: s.airT, centreT: s.centreT, core: "softIron" }, { bounds: [3.6, -2.8, 2.8] });
    const [x, z] = line[line.length - 1];
    assert.ok(x < 0 && inFootprint(x, z), `ends at ${x}, ${z}`);
  });
});
