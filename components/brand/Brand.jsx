/**
 * Learnory brand marks. Plain SVG with no hooks, so they render in server
 * components (the landing page) as well as client ones.
 *
 * - <LearnoryMark />  the gold "L" monogram, drawn in theme tokens so it
 *   follows light/dark like the rest of the accent.
 * - <MalloIcon />     Mallo, the marshmallow who quizzes you. Fixed colours:
 *   a character keeps its own look in both themes, and the warm outline keeps
 *   the white body visible on white surfaces.
 */

export function LearnoryMark({ className = "h-7 w-7", title }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <rect width="32" height="32" rx="8" className="fill-brand-400" />
      <path
        d="M11.5 8.5v14h10"
        fill="none"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-ink-950"
      />
      <circle cx="21.5" cy="10.5" r="2.1" className="fill-ink-950" />
    </svg>
  );
}

/** Mark + wordmark, for headers. */
export function LearnoryLogo({ markClassName = "h-7 w-7", textClassName = "text-sm font-semibold tracking-tight text-ink-100" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LearnoryMark className={`${markClassName} shrink-0`} />
      <span className={textClassName}>Learnory</span>
    </span>
  );
}

export function MalloIcon({ className = "h-5 w-5", title }) {
  return (
    <svg
      viewBox="3.6 6.4 24.8 21.4"
      className={`inline-block shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {/* Body: a squat cylinder, a touch toasted at the base. */}
      <rect x="4.5" y="7.5" width="23" height="19.5" rx="7.5" fill="#fffaf0" stroke="#a8875a" strokeWidth="1.4" />
      <path d="M5.6 21.5c1.6 3.6 5.6 5 10.4 5s8.8-1.4 10.4-5" fill="none" stroke="#efd9b4" strokeWidth="2.2" strokeLinecap="round" />
      {/* Top face. */}
      <ellipse cx="16" cy="11" rx="9.6" ry="3" fill="#ffffff" stroke="#d9c29c" strokeWidth="1" />
      {/* Eyes with a highlight each. */}
      <ellipse cx="12.4" cy="17.4" rx="1.55" ry="2" fill="#2a1f16" />
      <ellipse cx="19.6" cy="17.4" rx="1.55" ry="2" fill="#2a1f16" />
      <circle cx="12.95" cy="16.6" r="0.55" fill="#ffffff" />
      <circle cx="20.15" cy="16.6" r="0.55" fill="#ffffff" />
      {/* Cheeks and a small smile. */}
      <ellipse cx="9.2" cy="20.4" rx="1.7" ry="1" fill="#f6a8b8" opacity="0.75" />
      <ellipse cx="22.8" cy="20.4" rx="1.7" ry="1" fill="#f6a8b8" opacity="0.75" />
      <path d="M14.6 20.6q1.4 1.3 2.8 0" fill="none" stroke="#2a1f16" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
