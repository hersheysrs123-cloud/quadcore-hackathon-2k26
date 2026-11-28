import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BRAND_NAME, BRAND_TITLE, malloReaction } from "../../lib/brand.js";

describe("brand", () => {
  it("names the product Learnory with its tagline", () => {
    assert.equal(BRAND_NAME, "Learnory");
    assert.equal(BRAND_TITLE, "Learnory — where learning lives");
  });
});

describe("malloReaction", () => {
  it("is proud at 80 and above", () => {
    assert.equal(malloReaction(80).mood, "proud");
    assert.equal(malloReaction(100).mood, "proud");
  });

  it("is happy from 50 to 79", () => {
    assert.equal(malloReaction(50).mood, "happy");
    assert.equal(malloReaction(79).mood, "happy");
  });

  it("gives a pep talk below 50, never a scolding", () => {
    for (const score of [0, 20, 49]) {
      const r = malloReaction(score);
      assert.equal(r.mood, "encouraging");
      assert.match(r.line, /revise/);
    }
  });

  it("treats a missing or non-numeric score as zero", () => {
    assert.equal(malloReaction(undefined).mood, "encouraging");
    assert.equal(malloReaction("not a number").mood, "encouraging");
  });

  it("always returns a line to show", () => {
    for (const score of [0, 50, 90]) assert.ok(malloReaction(score).line.length > 0);
  });
});
