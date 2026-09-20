import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { carrierFraction } from "../../lib/carriers.js";

/** Where the carriers of an open path actually END UP: an open path clamps to [0, 1]. */
const placed = (phase, n, wrap) =>
  Array.from({ length: n }, (_, i) => Math.min(Math.max(carrierFraction(phase, 0, i, n, 1, wrap), 0), 1));

const gaps = (positions) => {
  const sorted = [...positions].sort((a, b) => a - b);
  return sorted.slice(1).map((v, i) => v - sorted[i]);
};

describe("drift carriers on an open wire", () => {
  it("piles carriers up on the last point of the wire without wrapping", () => {
    // The bug: at phase 0.6, 60% of the carriers have run past the end and
    // been clamped onto it, leaving the first stretch of the wire empty.
    const at = placed(0.6, 20, false);
    const stacked = at.filter((p) => p === 1).length;
    assert.ok(stacked >= 10, `${stacked} carriers stacked on the end`);
    assert.ok(Math.min(...at) >= 0.6 - 1e-9, "and none is left on the first 60% of the wire");
  });

  it("keeps the spacing even at every phase when wrapped", () => {
    const n = 24;
    for (const phase of [0, 0.05, 0.3, 0.5, 0.77, 0.999]) {
      const at = placed(phase, n, true);
      // No two carriers on the same point, and no gap bigger than one step.
      assert.equal(new Set(at.map((p) => p.toFixed(9))).size, n, `phase ${phase}: carriers overlap`);
      for (const g of gaps(at)) assert.ok(Math.abs(g - 1 / n) < 1e-9, `phase ${phase}: gap ${g}`);
    }
  });

  it("covers the start of the wire as well as the end", () => {
    for (const phase of [0.2, 0.5, 0.9]) {
      const at = placed(phase, 30, true);
      assert.ok(Math.min(...at) < 1 / 30 + 1e-9, `phase ${phase}: nothing near the start`);
      assert.ok(Math.max(...at) > 1 - 2 / 30, `phase ${phase}: nothing near the end`);
    }
  });

  it("leaves the unwrapped burst behaviour alone", () => {
    // Static electricity bunches carriers into the leading part of a path
    // (spread < 1) and relies on them stopping at its end.
    assert.equal(carrierFraction(0.5, 0, 9, 10, 0.4, false), 0.5 + 0.9 * 0.4);
    assert.equal(carrierFraction(0.9, 0, 9, 10, 1, false), 0.9 + 0.9, "past 1: the caller clamps it");
  });

  it("wraps negative fractions too (a reversed stream)", () => {
    const f = carrierFraction(-0.1, 0, 0, 10, 1, true);
    assert.ok(close(f, 0.9), `${f}`);
  });
});

function close(a, b, tol = 1e-9) {
  return Math.abs(a - b) <= tol;
}
