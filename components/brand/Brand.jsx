import { useId } from "react";

/**
 * Learnory brand marks. Plain SVG, safe in server components (the landing
 * page) as well as client ones: the only hook is `useId`, which React allows
 * on the server.
 *
 * - <LearnoryMark />  the gold "L" monogram, drawn in theme tokens so it
 *   follows light/dark like the rest of the accent.
 * - <MalloIcon />     Mallo, the marshmallow who quizzes you. Fixed colours:
 *   a character keeps its own look in both themes, and the warm outline keeps
 *   the white body visible on white surfaces. Its gradients are soft
 *   shading, not decoration; each instance gets its own ids via `useId`, so
 *   a hidden copy elsewhere on the page can't blank out the visible one.
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
  // React 19 ids look like "_r_1_"; keep only characters safe in url(#...).
  const u = `mallo${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      viewBox="4 6.9 24 21.1"
      className={`inline-block shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <defs>
        {/* Body: bright at the top, warming toward a lightly toasted base. */}
        <linearGradient id={`${u}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.62" stopColor="#fdf8ef" />
          <stop offset="1" stopColor="#f6e6cb" />
        </linearGradient>
        {/* Curved sides: a little shade at both edges, more on the right. */}
        <linearGradient id={`${u}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9d3ae" stopOpacity="0.45" />
          <stop offset="0.22" stopColor="#e9d3ae" stopOpacity="0" />
          <stop offset="0.72" stopColor="#e9d3ae" stopOpacity="0" />
          <stop offset="1" stopColor="#dcc196" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`${u}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f8f0e2" />
        </linearGradient>
        <radialGradient id={`${u}-blush`}>
          <stop offset="0" stopColor="#ff8fa8" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff8fa8" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${u}-clip`}>
          <rect x="5" y="7.6" width="22" height="19.6" rx="8.2" />
        </clipPath>
      </defs>

      <rect x="5" y="7.6" width="22" height="19.6" rx="8.2" fill={`url(#${u}-body)`} />
      <g clipPath={`url(#${u}-clip)`}>
        <rect x="5" y="7.6" width="22" height="19.6" fill={`url(#${u}-side)`} />
        <path d="M4 22.4c3 2.1 7 3 12 3s9-.9 12-3V28H4z" fill="#efd5a8" opacity="0.55" />
      </g>
      <ellipse cx="16" cy="11.3" rx="9.3" ry="3.1" fill={`url(#${u}-top)`} stroke="#e6d4b4" strokeWidth="0.65" />
      <rect x="5" y="7.6" width="22" height="19.6" rx="8.2" fill="none" stroke="#c4a57a" strokeWidth="0.85" />
      {/* Gloss on the left side. */}
      <rect x="7.1" y="14.2" width="1.5" height="6.2" rx="0.75" fill="#ffffff" opacity="0.9" />

      <ellipse cx="9.8" cy="20.7" rx="2.4" ry="1.55" fill={`url(#${u}-blush)`} />
      <ellipse cx="22.2" cy="20.7" rx="2.4" ry="1.55" fill={`url(#${u}-blush)`} />
      {/* Eyes, each with a large and a small catch-light. */}
      <ellipse cx="12.7" cy="17.6" rx="1.75" ry="2.2" fill="#33251c" />
      <ellipse cx="19.3" cy="17.6" rx="1.75" ry="2.2" fill="#33251c" />
      <circle cx="13.28" cy="16.8" r="0.72" fill="#ffffff" />
      <circle cx="19.88" cy="16.8" r="0.72" fill="#ffffff" />
      <circle cx="12.22" cy="18.5" r="0.32" fill="#ffffff" opacity="0.85" />
      <circle cx="18.82" cy="18.5" r="0.32" fill="#ffffff" opacity="0.85" />
      <path d="M14.8 20.45q1.2 1.1 2.4 0" fill="none" stroke="#33251c" strokeWidth="0.95" strokeLinecap="round" />
    </svg>
  );
}
