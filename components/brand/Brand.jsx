/**
 * Learnory brand marks. Plain SVG with no hooks, so they render in server
 * components (the landing page) as well as client ones.
 *
 * - <LearnoryMark />  the gold "L" monogram, drawn in theme tokens so it
 *   follows light/dark like the rest of the accent.
 * - <MalloIcon />     Mallo, the marshmallow who quizzes you. Fixed colours:
 *   a character keeps its own look in both themes, and the warm outline keeps
 *   the white body visible on white surfaces. Its gradients live once
 *   per page in <MalloDefs /> (rendered by the root layout) under fixed ids,
 *   so server and client markup always match.
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

/** Mallo's moods. `happy` is the default face on every quiz button. */
export const MALLO_MOODS = ["happy", "thinking", "proud", "encouraging", "sleepy", "dizzy"];

const INK = "#33251c";

/** An Archimedean spiral for the dizzy eyes, centred on (cx, cy). */
function spiral(cx, cy, turns = 1.6, rMax = 1.95) {
  const steps = 36;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * 2 * Math.PI;
    const r = 0.15 + t * (rMax - 0.15);
    d += `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return d;
}
const SPIRAL_L = spiral(12.7, 17.6);
const SPIRAL_R = spiral(19.3, 17.6);

/** A four-point sparkle centred on (x, y). */
const sparkle = (x, y, r) =>
  `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}` +
  `Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;

function OpenEye({ cx, lookX = 0, lookY = 0 }) {
  const x = cx + lookX;
  const y = 17.6 + lookY;
  return (
    <>
      <ellipse cx={x} cy={y} rx="1.75" ry="2.2" fill={INK} />
      <circle cx={x + 0.58} cy={y - 0.8} r="0.72" fill="#ffffff" />
      <circle cx={x - 0.48} cy={y + 0.9} r="0.32" fill="#ffffff" opacity="0.85" />
    </>
  );
}

function Face({ mood }) {
  const line = { fill: "none", stroke: INK, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (mood) {
    case "thinking":
      return (
        <>
          <g className="mallo-eyes">
            <OpenEye cx={12.7} lookX={0.45} lookY={-0.55} />
            <OpenEye cx={19.3} lookX={0.45} lookY={-0.55} />
          </g>
          <ellipse cx="16.4" cy="21" rx="0.75" ry="0.85" fill={INK} />
        </>
      );
    case "proud":
      return (
        <>
          {/* Left eye winks, right eye stays open. */}
          <path d="M11 17.9q1.7-1.7 3.4 0" {...line} strokeWidth="1.1" />
          <g className="mallo-eyes">
            <OpenEye cx={19.3} />
          </g>
          <path d="M14.1 19.9q1.9 2.9 3.8 0z" fill={INK} stroke={INK} strokeWidth="0.5" strokeLinejoin="round" />
          <path d="M15.25 21.25q.75-.55 1.5 0q-.75.5-1.5 0z" fill="#ff8fa8" />
        </>
      );
    case "encouraging":
      return (
        <>
          {/* Raised, rounded brows and an open grin: "you've got this", not a frown. */}
          <path d="M11.1 14.3q1.6-.95 3.2-.1M17.7 14.2q1.6-.85 3.2.1" {...line} strokeWidth="0.9" />
          <g className="mallo-eyes">
            <OpenEye cx={12.7} />
            <OpenEye cx={19.3} />
          </g>
          <path d="M14.5 20q1.5 2.2 3 0z" fill={INK} stroke={INK} strokeWidth="0.45" strokeLinejoin="round" />
        </>
      );
    case "sleepy":
      return (
        <>
          <path d="M11 17.4q1.7 1.4 3.4 0M17.6 17.4q1.7 1.4 3.4 0" {...line} strokeWidth="1" />
          <ellipse cx="16" cy="21" rx="0.65" ry="0.75" fill={INK} />
        </>
      );
    case "dizzy":
      return (
        <>
          <path className="mallo-swirl" d={SPIRAL_L} {...line} strokeWidth="0.62" />
          <path className="mallo-swirl" d={SPIRAL_R} {...line} strokeWidth="0.62" />
          <path d="M14.2 21q.6-.65 1.2 0t1.2 0t1.2 0" {...line} strokeWidth="0.9" />
        </>
      );
    default:
      return (
        <>
          <g className="mallo-eyes">
            <OpenEye cx={12.7} />
            <OpenEye cx={19.3} />
          </g>
          <path d="M14.8 20.45q1.2 1.1 2.4 0" {...line} strokeWidth="0.95" />
        </>
      );
  }
}

/** Things that float around Mallo: thought dots, sparkles, Zzz. */
function Extras({ mood }) {
  if (mood === "thinking") {
    return (
      <g fill="#ffffff" stroke="#c4a57a" strokeWidth="0.45">
        <circle className="mallo-dot mallo-dot-1" cx="25.6" cy="6.6" r="0.8" />
        <circle className="mallo-dot mallo-dot-2" cx="27.7" cy="4.4" r="1.05" />
        <circle className="mallo-dot mallo-dot-3" cx="30.3" cy="1.9" r="1.35" />
      </g>
    );
  }
  if (mood === "proud") {
    return (
      <g fill="#f2c14e" stroke="#b9862a" strokeWidth="0.3" strokeLinejoin="round">
        <path className="mallo-sparkle mallo-sparkle-1" d={sparkle(27.6, 6, 2)} />
        <path className="mallo-sparkle mallo-sparkle-2" d={sparkle(3.6, 9.4, 1.4)} />
        <path className="mallo-sparkle mallo-sparkle-3" d={sparkle(29.4, 13.2, 1.1)} />
      </g>
    );
  }
  if (mood === "sleepy") {
    return (
      <g fill="#8f97a6" fontFamily="var(--font-ui), sans-serif" fontWeight="700">
        <text className="mallo-z mallo-z-1" x="24.6" y="7.6" fontSize="3.6">z</text>
        <text className="mallo-z mallo-z-2" x="27" y="4.4" fontSize="4.6">Z</text>
      </g>
    );
  }
  return null;
}

/**
 * Mallo, in one of `MALLO_MOODS`. With `animate` (the default) each mood has
 * its own motion: happy blinks and squishes when its button is hovered,
 * thinking bobs with pulsing thought dots, proud hops among sparkles,
 * encouraging bounces, sleepy breathes under drifting Zzz, dizzy wobbles
 * with spinning eyes. All motion stops under prefers-reduced-motion (see
 * the "Mallo" block in app/globals.css). Thought dots, sparkles and Zzz draw
 * outside the box on purpose, so every mood keeps the same footprint.
 */
export function MalloIcon({ className = "h-5 w-5", title, mood = "happy", animate = true }) {
  const m = MALLO_MOODS.includes(mood) ? mood : "happy";
  // Spread blinks out so different Mallos don't blink in unison. Derived
  // from props, not an id, so server and client render the same delay.
  let hash = 0;
  for (const ch of `${m}${className}`) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const style = { "--mallo-delay": `${-(hash % 40) / 10}s` };

  return (
    <svg
      viewBox="4 6.9 24 21.1"
      overflow="visible"
      style={style}
      className={`mallo inline-block shrink-0 overflow-visible ${animate ? `mallo-animate mallo-${m}` : ""} ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >

      <g className="mallo-body">
        <rect x="5" y="7.6" width="22" height="19.6" rx="8.2" fill="url(#mallo-body)" />
        <g clipPath="url(#mallo-clip)">
          <rect x="5" y="7.6" width="22" height="19.6" fill="url(#mallo-side)" />
          <path d="M4 22.4c3 2.1 7 3 12 3s9-.9 12-3V28H4z" fill="#efd5a8" opacity="0.55" />
        </g>
        <ellipse cx="16" cy="11.3" rx="9.3" ry="3.1" fill="url(#mallo-top)" stroke="#e6d4b4" strokeWidth="0.65" />
        <rect x="5" y="7.6" width="22" height="19.6" rx="8.2" fill="none" stroke="#c4a57a" strokeWidth="0.85" />
        {/* Gloss on the left side. */}
        <rect x="7.1" y="14.2" width="1.5" height="6.2" rx="0.75" fill="#ffffff" opacity="0.9" />
        <ellipse cx="9.8" cy="20.7" rx="2.4" ry="1.55" fill="url(#mallo-blush)" />
        <ellipse cx="22.2" cy="20.7" rx="2.4" ry="1.55" fill="url(#mallo-blush)" />
        <Face mood={m} />
      </g>
      <Extras mood={m} />
    </svg>
  );
}

/**
 * Mallo's shared gradients and clip path, rendered once per document by the
 * root layout (and by global-error, which replaces it). Zero-sized rather
 * than display:none: Chrome won't paint gradients defined in a hidden SVG.
 */
export function MalloDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {/* Body: bright at the top, warming toward a lightly toasted base. */}
        <linearGradient id="mallo-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.62" stopColor="#fdf8ef" />
          <stop offset="1" stopColor="#f6e6cb" />
        </linearGradient>
        {/* Curved sides: a little shade at both edges, more on the right. */}
        <linearGradient id="mallo-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9d3ae" stopOpacity="0.45" />
          <stop offset="0.22" stopColor="#e9d3ae" stopOpacity="0" />
          <stop offset="0.72" stopColor="#e9d3ae" stopOpacity="0" />
          <stop offset="1" stopColor="#dcc196" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="mallo-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f8f0e2" />
        </linearGradient>
        <radialGradient id="mallo-blush">
          <stop offset="0" stopColor="#ff8fa8" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff8fa8" stopOpacity="0" />
        </radialGradient>
        <clipPath id="mallo-clip">
          <rect x="5" y="7.6" width="22" height="19.6" rx="8.2" />
        </clipPath>
      </defs>
    </svg>
  );
}
