import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BACKBONE_COLOURS,
  BASES,
  BASE_CLASS,
  BASE_COLOURS,
  BASE_NAMES,
  BASE_PAIRS_PER_TURN,
  COMPLEMENT,
  PAIR_BONDS,
  baseComposition,
  complementOf,
  describeHelix,
  sequenceFor,
} from "../../lib/dna.js";

/** The base-pair slider, over the range the scene can draw. */
const LENGTHS = Array.from({ length: 41 }, (_, i) => i + 4); // 4 → 44

describe("the four bases", () => {
  it("lists exactly A, T, C and G, each named", () => {
    assert.deepEqual(BASES, ["A", "T", "C", "G"]);
    for (const b of BASES) {
      assert.ok(BASE_NAMES[b], `${b} is unnamed`);
      assert.match(BASE_COLOURS[b], /^#[0-9a-f]{6}$/i, `${b} has no colour`);
      assert.ok(BASE_CLASS[b]);
      assert.ok(PAIR_BONDS[b]);
    }
  });

  it("gives every base a distinct colour, so the key can tell them apart", () => {
    const colours = BASES.map((b) => BASE_COLOURS[b]);
    assert.equal(new Set(colours).size, 4);
    assert.notEqual(BACKBONE_COLOURS.strandA, BACKBONE_COLOURS.strandB);
  });

  it("pairs A with T and C with G, and nothing else", () => {
    assert.equal(COMPLEMENT.A, "T");
    assert.equal(COMPLEMENT.T, "A");
    assert.equal(COMPLEMENT.C, "G");
    assert.equal(COMPLEMENT.G, "C");
    // Complementation is its own inverse.
    for (const b of BASES) assert.equal(COMPLEMENT[COMPLEMENT[b]], b);
  });

  it("always pairs a purine with a pyrimidine — that is what keeps the helix an even width", () => {
    for (const b of BASES) {
      assert.notEqual(BASE_CLASS[b], BASE_CLASS[COMPLEMENT[b]], `${b} pairs with its own class`);
    }
    assert.equal(BASE_CLASS.A, "purine");
    assert.equal(BASE_CLASS.G, "purine");
    assert.equal(BASE_CLASS.T, "pyrimidine");
    assert.equal(BASE_CLASS.C, "pyrimidine");
  });

  // The regression: the rungs were drawn as one cylinder each, so the 2-vs-3
  // hydrogen bonds — the reason G–C is the stronger pair — were invisible.
  it("holds A–T with two hydrogen bonds and C–G with three", () => {
    assert.equal(PAIR_BONDS.A, 2);
    assert.equal(PAIR_BONDS.T, 2);
    assert.equal(PAIR_BONDS.C, 3);
    assert.equal(PAIR_BONDS.G, 3);
    // A pair must agree with itself from either side.
    for (const b of BASES) assert.equal(PAIR_BONDS[b], PAIR_BONDS[COMPLEMENT[b]]);
  });
});

describe("the generated sequence", () => {
  it("produces exactly as many bases as the slider asks for", () => {
    for (const n of LENGTHS) assert.equal(sequenceFor(n).length, n);
    assert.equal(sequenceFor(0).length, 0);
    assert.equal(sequenceFor(-5).length, 0);
    assert.equal(sequenceFor(undefined).length, 0);
  });

  it("produces only real bases", () => {
    for (const n of LENGTHS) {
      for (const b of sequenceFor(n)) assert.ok(BASES.includes(b), `generated "${b}"`);
    }
  });

  it("is stable — the same slider position always draws the same helix", () => {
    assert.deepEqual(sequenceFor(16), sequenceFor(16));
    assert.deepEqual(sequenceFor(30), sequenceFor(30));
  });

  // Dragging the slider must LENGTHEN the helix, not reshuffle it.
  it("extends rather than regenerates as the slider grows", () => {
    for (let n = 4; n < 40; n += 1) {
      const shorter = sequenceFor(n);
      const longer = sequenceFor(n + 1);
      assert.deepEqual(longer.slice(0, n), shorter, `the helix reshuffled going from ${n} to ${n + 1}`);
    }
  });

  // The regression: the generator was `hashRandom(i + 5)`, a sin-based hash
  // fed consecutive small integers. It does not decorrelate at that stride —
  // the default 16-pair helix came out with NO THYMINE AT ALL, on a scene
  // whose whole subject is A–T and C–G pairing.
  it("contains all four bases in the default 16-pair helix", () => {
    const counts = baseComposition(sequenceFor(16));
    for (const b of BASES) {
      assert.ok(counts[b] > 0, `no ${BASE_NAMES[b]} in the default helix: ${sequenceFor(16).join("-")}`);
    }
  });

  it("contains all four bases at every length from 12 up", () => {
    for (let n = 12; n <= 44; n += 1) {
      const counts = baseComposition(sequenceFor(n));
      for (const b of BASES) {
        assert.ok(counts[b] > 0, `no ${b} at ${n} pairs`);
      }
    }
  });

  it("spreads the four bases roughly evenly over a long helix", () => {
    const n = 400;
    const counts = baseComposition(sequenceFor(n));
    for (const b of BASES) {
      const share = counts[b] / n;
      assert.ok(share > 0.15 && share < 0.35, `${b} took ${(share * 100).toFixed(1)} % of the strand`);
    }
  });
});

describe("the complementary strand", () => {
  it("is written base-for-base alongside strand 1, not reversed", () => {
    for (const n of [8, 16, 30]) {
      const s = sequenceFor(n);
      const c = complementOf(s);
      assert.equal(c.length, s.length);
      s.forEach((b, i) => assert.equal(c[i], COMPLEMENT[b], `mismatch at position ${i}`));
    }
  });

  it("obeys Chargaff — as many A as T, and as many C as G, across both strands", () => {
    for (const n of LENGTHS) {
      const s = sequenceFor(n);
      const both = baseComposition([...s, ...complementOf(s)]);
      assert.equal(both.A, both.T, `A ≠ T at ${n} pairs`);
      assert.equal(both.C, both.G, `C ≠ G at ${n} pairs`);
    }
  });
});

describe("describeHelix — what the readout prints", () => {
  // The regression: the panel printed a HARD-CODED sequence,
  // "A-T-G-C-C-A-T-G…", while the scene generated its own. Not one base
  // matched, on a readout headed "Strand 1 (5′→3′)".
  it("prints the sequence the scene actually draws", () => {
    for (const n of LENGTHS) {
      assert.deepEqual(describeHelix(n).sequence, sequenceFor(n), `strand 1 disagrees at ${n} pairs`);
      assert.deepEqual(describeHelix(n).complement, complementOf(sequenceFor(n)));
    }
  });

  it("counts the hydrogen bonds from the sequence rather than the pair count", () => {
    for (const n of LENGTHS) {
      const h = describeHelix(n);
      const want = h.sequence.reduce((sum, b) => sum + PAIR_BONDS[b], 0);
      assert.equal(h.hydrogenBonds, want, `bond count disagrees at ${n} pairs`);
      // Between two and three per pair, because every pair is A–T or C–G.
      assert.ok(h.hydrogenBonds >= 2 * n && h.hydrogenBonds <= 3 * n);
    }
  });

  it("derives the GC fraction and the turn count from the sequence", () => {
    for (const n of LENGTHS) {
      const h = describeHelix(n);
      assert.equal(h.pairs, n);
      assert.ok(Math.abs(h.gcFraction - (h.counts.G + h.counts.C) / n) < 1e-12);
      assert.ok(h.gcFraction >= 0 && h.gcFraction <= 1);
      assert.ok(Math.abs(h.turns - n / BASE_PAIRS_PER_TURN) < 1e-12);
    }
  });

  it("uses B-DNA's 10.5 base pairs per turn", () => {
    assert.equal(BASE_PAIRS_PER_TURN, 10.5);
    assert.ok(Math.abs(describeHelix(21).turns - 2) < 1e-12);
  });

  it("does not divide by zero on an empty helix", () => {
    const h = describeHelix(0);
    assert.equal(h.pairs, 0);
    assert.equal(h.gcFraction, 0);
    assert.equal(h.hydrogenBonds, 0);
  });
});
