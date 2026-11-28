/**
 * Learnory brand constants.
 *
 * One place for the product name, tagline and favicon so page titles, the
 * timer tab title and the alarm favicon swap can't drift apart again.
 *
 * Storage keys (`socratic_*`), the IndexedDB name (`SocraticOS_LocalDB`) and
 * the `socratic-backup-*` import check deliberately keep the old name: they
 * hold people's saved notes, and renaming them would orphan that data.
 */

export const BRAND_NAME = "Learnory";
export const BRAND_TAGLINE = "where learning lives";
export const BRAND_TITLE = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

/** The AI character that quizzes and grades the learner. */
export const AI_NAME = "Mallo";

/**
 * The gold "L" monogram as a data URI, for code that swaps the favicon at
 * runtime (AlarmOverlay). Fixed colours: a favicon can't read theme tokens.
 * Mirrors `app/icon.svg` and `<LearnoryMark />`.
 */
export const LOGO_FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>" +
      "<rect width='32' height='32' rx='8' fill='#f2c14e'/>" +
      "<path d='M11.5 8.5v14h10' fill='none' stroke='#0b0d12' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round'/>" +
      "<circle cx='21.5' cy='10.5' r='2.1' fill='#0b0d12'/>" +
      "</svg>",
  );

/**
 * Mallo's reaction to a quiz score (0-100): proud at 80+, happy at 50+,
 * otherwise a pep talk. A low score is framed as useful, never as failure.
 */
export function malloReaction(score) {
  const s = Number(score) || 0;
  if (s >= 80) return { mood: "proud", line: "Nailed it. Mallo is proud of you." };
  if (s >= 50) return { mood: "happy", line: "Good base. A couple of gaps to patch." };
  return { mood: "encouraging", line: "Rough round, and that's useful: now you know exactly what to revise." };
}
