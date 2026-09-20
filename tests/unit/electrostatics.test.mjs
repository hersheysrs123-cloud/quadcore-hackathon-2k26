import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BALLOON_MASS_KG,
  CHARGE_PER_MARKER,
  COULOMB_K,
  DOME_MAX_MARKERS,
  DOME_RADIUS,
  ELEMENTARY_CHARGE,
  MAX_MARKERS,
  TARGETS,
  TRIBOELECTRIC,
  chargeOf,
  coulombForce,
  domeVoltage,
  electronCount,
  inductionForce,
  inducedMarkers,
  leak,
  leakTimeConstant,
  pansLaunched,
  rub,
  solveStatic,
  sticksToWall,
} from "../../lib/electrostatics.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const TARGET_KEYS = Object.keys(TARGETS);

describe("charge is conserved, not created", () => {
  it("leaves exactly as many + on the wool as there are − on the balloon", () => {
    for (const markers of [0, 1, 7.4, MAX_MARKERS]) {
      for (const target of TARGET_KEYS) {
        const s = solveStatic({ markers, target, separation: 0.1 });
        assert.equal(s.sweaterMarkers, s.balloonMarkers, `${markers} on ${target}`);
      }
    }
  });

  it("counts a sensible number of real electrons", () => {
    // A party balloon carries a few hundred nanocoulombs, which is of order
    // 10¹² electrons. Anything far from that means the quantum is wrong.
    const n = electronCount(MAX_MARKERS);
    assert.ok(n > 1e11 && n < 1e14, `got ${n.toExponential(2)}`);
    assert.ok(close(chargeOf(1), CHARGE_PER_MARKER, 1e-18));
    assert.ok(close(electronCount(1) * ELEMENTARY_CHARGE, CHARGE_PER_MARKER, 1e-18));
  });
});

describe("rubbing saturates", () => {
  it("moves charge towards the ceiling and never past it", () => {
    let q = 0;
    for (let i = 0; i < 60; i += 1) {
      const next = rub(q);
      assert.ok(next >= q, "a rub never removes charge");
      assert.ok(next <= MAX_MARKERS + 1e-9, "never exceeds the equilibrium");
      q = next;
    }
    assert.ok(close(q, MAX_MARKERS, 1e-6), "converges on the ceiling");
  });

  it("gives diminishing returns — the first rub does the most", () => {
    const first = rub(0) - 0;
    const q = rub(rub(rub(0)));
    const later = rub(q) - q;
    assert.ok(first > later);
  });
});

describe("humidity leaks the charge away", () => {
  it("drains faster in damper air", () => {
    let previous = Infinity;
    for (const h of [10, 30, 50, 70, 95]) {
      const tau = leakTimeConstant(h);
      assert.ok(tau < previous, `τ must fall as humidity rises (${h}%)`);
      previous = tau;
    }
  });

  it("clamps outside the slider's range rather than going negative or absurd", () => {
    assert.equal(leakTimeConstant(-40), leakTimeConstant(10));
    assert.equal(leakTimeConstant(400), leakTimeConstant(95));
    assert.ok(leakTimeConstant(95) > 0);
  });

  it("decays exponentially, losing half the charge in τ·ln2", () => {
    const tau = leakTimeConstant(40);
    const left = leak(MAX_MARKERS, Math.LN2 * tau, 40);
    assert.ok(close(left, MAX_MARKERS / 2, 1e-9), `${left}`);
  });

  it("never returns a negative charge, and leaves nothing at zero", () => {
    assert.equal(leak(0, 10, 50), 0);
    assert.ok(leak(MAX_MARKERS, 1e6, 95) >= 0);
  });
});

describe("Coulomb's law", () => {
  it("quadruples the force when the gap halves", () => {
    const q = chargeOf(MAX_MARKERS);
    for (const r of [0.4, 0.2, 0.05]) {
      assert.ok(close(coulombForce(q, q, r / 2), 4 * coulombForce(q, q, r), 1e-6));
    }
  });

  it("matches k·q₁q₂/r² directly", () => {
    const q1 = chargeOf(10);
    const q2 = chargeOf(6);
    assert.ok(close(coulombForce(q1, q2, 0.25), (COULOMB_K * q1 * q2) / 0.0625, 1e-12));
  });

  it("is symmetric in the two charges, and never negative", () => {
    const a = chargeOf(3);
    const b = chargeOf(19);
    assert.ok(close(coulombForce(a, b, 0.1), coulombForce(b, a, 0.1)));
    assert.ok(coulombForce(-a, b, 0.1) > 0);
  });

  it("does not divide by zero at touching distance", () => {
    assert.ok(Number.isFinite(coulombForce(chargeOf(24), chargeOf(24), 0)));
  });
});

describe("induction on a neutral wall", () => {
  it("always attracts, whichever sign the balloon carries", () => {
    for (const markers of [1, 12, MAX_MARKERS]) {
      const s = solveStatic({ markers, target: "wall", separation: 0.05 });
      assert.equal(s.attracts, true);
      assert.ok(s.force > 0);
    }
  });

  it("induces less charge than the balloon carries, and less as it retreats", () => {
    let previous = Infinity;
    for (const r of [0.01, 0.05, 0.15, 0.4]) {
      const induced = inducedMarkers(MAX_MARKERS, r);
      assert.ok(induced < MAX_MARKERS, "a dielectric never mirrors the charge fully");
      assert.ok(induced < previous, `induced charge must fall with distance (r=${r})`);
      previous = induced;
    }
  });

  it("goes as the square of the charge — doubling the rubbing quadruples the pull", () => {
    const a = inductionForce(6, 0.05);
    const b = inductionForce(12, 0.05);
    assert.ok(close(b, 4 * a, 1e-9));
  });

  it("is zero for a neutral balloon", () => {
    assert.equal(inductionForce(0, 0.05), 0);
    assert.equal(solveStatic({ markers: 0, target: "wall", separation: 0.05 }).force, 0);
  });

  it("sticks only when friction against the induced pull can carry the weight", () => {
    const near = sticksToWall(MAX_MARKERS, 0.01);
    const far = sticksToWall(MAX_MARKERS, 0.35);
    assert.equal(near.sticks, true);
    assert.equal(far.sticks, false);
    assert.ok(close(near.weight, BALLOON_MASS_KG * 9.81, 1e-9));
  });
});

describe("like charges repel", () => {
  it("repels a second identical balloon and the dome", () => {
    for (const target of ["balloon", "dome"]) {
      const s = solveStatic({ markers: MAX_MARKERS, domeMarkers: 40, target, separation: 0.08 });
      assert.equal(s.attracts, false);
      assert.ok(s.force > 0, target);
    }
  });

  it("gives the second balloon the same charge it gave the first", () => {
    const s = solveStatic({ markers: 15, target: "balloon", separation: 0.1 });
    assert.equal(s.otherMarkers, 15);
  });

  it("reports the force as a believable multiple of the balloon's weight", () => {
    const s = solveStatic({ markers: MAX_MARKERS, target: "balloon", separation: 0.05 });
    assert.ok(s.forceInWeights > 1, "a rubbed balloon plainly overcomes its own weight");
    assert.ok(s.forceInWeights < 1e4, "but not by a preposterous factor");
  });
});

describe("Van de Graaff", () => {
  it("reaches a voltage in the tens of kilovolts", () => {
    const v = domeVoltage(DOME_MAX_MARKERS);
    assert.ok(v > 2e4 && v < 5e5, `${v.toExponential(2)} V is not a desktop generator`);
  });

  it("is the voltage of the dome that is drawn: 0.155 m, which is 0.62 world units at 4 per metre", () => {
    // The scene derives its dome from DOME_RADIUS. Pin the number so a change
    // here is a decision about the picture as well as the physics.
    assert.equal(DOME_RADIUS, 0.155);
    assert.ok(close(DOME_RADIUS * 4, 0.62, 1e-12));
  });

  it("scales the potential linearly with the charge on it", () => {
    assert.ok(close(domeVoltage(40), 2 * domeVoltage(20), 1e-6));
    assert.equal(domeVoltage(0), 0);
  });

  it("launches the pans one at a time as the charge builds", () => {
    let previous = -1;
    for (const q of [0, 5, 15, 30, 60]) {
      const n = pansLaunched(q);
      assert.ok(n >= previous, "pans never come back down as charge rises");
      assert.ok(n >= 0 && n <= 4);
      previous = n;
    }
    assert.equal(pansLaunched(0), 0);
    assert.equal(pansLaunched(DOME_MAX_MARKERS), 4);
  });
});

describe("the solved scene", () => {
  it("survives every target with no charge on anything", () => {
    for (const target of TARGET_KEYS) {
      const s = solveStatic({ markers: 0, domeMarkers: 0, target, separation: 0.12 });
      assert.ok(Number.isFinite(s.force), target);
      assert.equal(s.sticks, false, target);
      assert.equal(s.saturation, 0, target);
    }
  });

  it("clamps a zero gap rather than returning infinity", () => {
    for (const target of TARGET_KEYS) {
      const s = solveStatic({ markers: MAX_MARKERS, domeMarkers: 50, target, separation: 0 });
      assert.ok(Number.isFinite(s.force), target);
    }
  });

  it("falls back to the wall for an unknown target instead of throwing", () => {
    const s = solveStatic({ markers: 10, target: "nonsense", separation: 0.1 });
    assert.ok(Number.isFinite(s.force));
    assert.equal(s.attracts, true);
  });

  it("reports saturation as the fraction of the ceiling reached", () => {
    assert.ok(close(solveStatic({ markers: MAX_MARKERS / 2 }).saturation, 0.5, 1e-12));
  });
});

describe("the triboelectric series", () => {
  it("is listed from the most electron-losing to the most electron-gaining", () => {
    const ranks = TRIBOELECTRIC.map((m) => m.rank);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
    // Electron losers are positive, gainers negative, with the split in the right place.
    const signs = TRIBOELECTRIC.map((m) => m.sign);
    assert.deepEqual(signs, [...signs].sort((a, b) => b - a));
  });

  it("puts the wool the balloon is rubbed on above the latex", () => {
    const rank = (k) => TRIBOELECTRIC.find((m) => m.key === k).rank;
    assert.ok(rank("wool") < rank("latex"), "electrons go from wool to latex");
  });
});
