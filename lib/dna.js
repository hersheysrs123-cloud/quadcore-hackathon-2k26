// ─── DNA ────────────────────────────────────────────────────────────
// Bases, their colours, and the sequence the helix is built from.
//
// Two bugs made this worth extracting.
//
// The Details panel printed a HARD-CODED sequence — "A-T-G-C-C-A-T-G…" —
// while the scene generated its own. Not one base matched, on a readout
// headed "Strand 1 (5′→3′)".
//
// And the scene's generator was `hashRandom(i + 5)`, a sin-based hash fed
// consecutive small integers. It does not decorrelate at that stride: the
// default 16-pair helix came out C-G-G-G-G-C-C-A-G-A-G-A-A-G-A-C, which
// contains no thymine at all. On a scene whose whole subject is A–T and
// C–G pairing, and whose key lists Thymine as one of four colours, T did
// not appear on the primary strand until the slider passed 19.
// ─────────────────────────────────────────────────────────────────────

export const BASES = ["A", "T", "C", "G"];

export const BASE_NAMES = { A: "Adenine", T: "Thymine", C: "Cytosine", G: "Guanine" };

/** The colours the scene actually draws each base with. */
export const BASE_COLOURS = { A: "#4ade80", T: "#fb7185", C: "#38bdf8", G: "#fbbf24" };

export const COMPLEMENT = { A: "T", T: "A", C: "G", G: "C" };

/** Purine or pyrimidine — a purine always pairs with a pyrimidine. */
export const BASE_CLASS = { A: "purine", G: "purine", T: "pyrimidine", C: "pyrimidine" };

/** Hydrogen bonds holding each pair together. G–C's third is why it is stronger. */
export const PAIR_BONDS = { A: 2, T: 2, C: 3, G: 3 };

export const BACKBONE_COLOURS = { strandA: "#64748b", strandB: "#94a3b8" };

/** B-DNA makes a full turn every 10.5 base pairs. */
export const BASE_PAIRS_PER_TURN = 10.5;

/**
 * mulberry32 — a small, well-mixed PRNG.
 *
 * The point of replacing the sin hash is the mixing, not the randomness:
 * consecutive seeds have to produce an even spread of all four bases, or
 * the helix stops demonstrating the thing it exists to demonstrate.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sequence seed — fixed, so the same slider position always draws the same helix. */
export const SEQUENCE_SEED = 20260918;

/**
 * `pairs` bases for strand 1, stable for a given length.
 *
 * Generated as one stream rather than per-index so the distribution is the
 * generator's, and extended rather than regenerated as the slider grows —
 * dragging the base-pair slider lengthens the helix instead of reshuffling it.
 */
export function sequenceFor(pairs) {
  const n = Math.max(0, Math.round(Number(pairs) || 0));
  const next = mulberry32(SEQUENCE_SEED);
  return Array.from({ length: n }, () => BASES[Math.floor(next() * BASES.length) % BASES.length]);
}

/** The complementary strand, written alongside strand 1 rather than reversed. */
export const complementOf = (sequence) => sequence.map((b) => COMPLEMENT[b]);

/** How many of each base a sequence holds — what the no-thymine bug was hiding. */
export function baseComposition(sequence) {
  const counts = { A: 0, T: 0, C: 0, G: 0 };
  for (const b of sequence) if (counts[b] !== undefined) counts[b] += 1;
  return counts;
}

/** Everything a readout wants about the helix at this slider position. */
export function describeHelix(pairs) {
  const sequence = sequenceFor(pairs);
  const complement = complementOf(sequence);
  const counts = baseComposition(sequence);
  const bonds = sequence.reduce((sum, b) => sum + PAIR_BONDS[b], 0);
  return {
    pairs: sequence.length,
    sequence,
    complement,
    counts,
    /** Total hydrogen bonds holding the two strands together. */
    hydrogenBonds: bonds,
    turns: sequence.length / BASE_PAIRS_PER_TURN,
    gcFraction: sequence.length > 0 ? (counts.G + counts.C) / sequence.length : 0,
  };
}
