// ─── Where each drift carrier sits along its path ───────────────────
// Kept out of the React component so the rule can be tested: a bug here is
// invisible in a unit test of anything else, and shows up on screen as a wire
// with electrons piled up at one end and none at the other.
// ─────────────────────────────────────────────────────────────────────

/**
 * Fraction of the way along the path for carrier `i` of `n`, `phase` into the
 * stream's cycle.
 *
 * Carrier `i` is `i/n` (times `spread`) ahead of the front of the stream. For
 * a stream that runs the whole path that sum passes 1 for every carrier past
 * the first `n − phase·n`, and what happens next is the whole question: an open
 * path clamps at its end, so those carriers stack up on the last point and the
 * start of the wire empties. With `wrap` they re-enter at the start, which is
 * what one link of a loop does, and the spacing stays even at every phase.
 */
export function carrierFraction(phase, offset, i, n, spread = 1, wrap = false) {
  const t = phase + offset + (i / Math.max(n, 1)) * spread;
  return wrap ? ((t % 1) + 1) % 1 : t;
}
