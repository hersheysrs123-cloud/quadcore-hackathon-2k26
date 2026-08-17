import Link from "next/link";
import { STATUS, STATUS_ORDER } from "@/lib/mastery";

export const metadata = {
  title: "SocraticOS — notes that quiz you back",
  description:
    "Block notes, a calendar, 3D visualisations, and an AI that explains your notes then quizzes you on them — scoring every sub-topic onto a mastery heatmap.",
};

/**
 * The landing page.
 *
 * Server component with no client JS: every effect here is CSS. The product
 * shot is hand-built markup rather than a screenshot, so it can never go stale
 * against the real palette and ships no image payload.
 *
 * Everything is written in ink/duck tokens, so it follows the reader's
 * light/dark choice the same way the workspace does (see the bootstrap script
 * in app/layout.js).
 */
export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Blooms />
      <Nav />
      <Hero />
      <Features />
      <HeatmapShowcase />
      <AlsoInside />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ── Ambient background ─────────────────────────────────────────── */
function Blooms() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] animate-drift rounded-full bg-duck-500/10 blur-[120px]" />
      <div
        className="absolute -right-32 top-1/4 h-[28rem] w-[28rem] animate-drift rounded-full bg-solid-500/[0.07] blur-[120px]"
        style={{ animationDelay: "-8s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] animate-drift rounded-full bg-duck-400/[0.06] blur-[120px]"
        style={{ animationDelay: "-15s" }}
      />
    </div>
  );
}

/* ── Nav ────────────────────────────────────────────────────────── */
function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-800/60 bg-ink-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg leading-none">🦆</span>
          <span className="text-sm font-semibold tracking-tight text-ink-100">
            SocraticOS
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <a
            href="#features"
            className="hidden rounded-lg px-3 py-1.5 text-xs text-ink-400 transition-colors hover:text-ink-100 sm:block"
          >
            Features
          </a>
          <a
            href="#how"
            className="hidden rounded-lg px-3 py-1.5 text-xs text-ink-400 transition-colors hover:text-ink-100 sm:block"
          >
            How it works
          </a>
          <Link
            href="/workspace?tour=true"
            className="ml-2 rounded-lg bg-duck-400 px-3.5 py-1.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-duck-300 shadow-sm"
          >
            Open workspace
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* ── Hero ───────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
      <div className="animate-fade-up">
        <span className="inline-flex items-center gap-2 rounded-full border border-duck-500/30 bg-duck-500/5 px-3 py-1 text-[11px] font-medium text-duck-300">
          <span className="h-1.5 w-1.5 rounded-full bg-duck-400" />
          Rereading is not studying
        </span>

        <h1 className="mt-6 max-w-3xl text-balance text-[40px] font-bold leading-[1.08] tracking-tight text-ink-100 sm:text-[60px]">
          Notes that{" "}
          <span className="bg-gradient-to-r from-duck-300 to-duck-500 bg-clip-text text-transparent">
            quiz you back
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-400">
          Write your notes. Have them explained properly. Then find out what you
          actually understood — sub-topic by sub-topic, on a heatmap that stops
          you revising what you already know.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/workspace?tour=true"
            className="rounded-xl bg-duck-400 px-5 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-duck-500/20 transition-all hover:bg-duck-300 hover:shadow-duck-500/30"
          >
            Start studying — it&rsquo;s loaded with demo notes
          </Link>
          <a
            href="#features"
            className="rounded-xl border border-ink-700 px-5 py-3 text-sm font-medium text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            See how it works
          </a>
        </div>

        <p className="mt-4 text-xs text-ink-600">
          No sign-up. Your notes stay in this browser.
        </p>
      </div>

      <div
        className="mt-14 animate-fade-up sm:mt-16"
        style={{ animationDelay: "120ms" }}
      >
        <AppPreview />
      </div>
    </section>
  );
}

/* ── The product shot, built out of divs ────────────────────────── */
function AppPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl shadow-ink-950">
      {/* Title bar */}
      <div className="flex items-center gap-1.5 border-b border-ink-800 bg-ink-900 px-4 py-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-ink-700" />
        ))}
        <span className="ml-3 text-[10px] text-ink-600">
          SocraticOS — Eigenvectors &amp; Eigenvalues
        </span>
      </div>

      <div className="flex min-h-[22rem]">
        {/* Sidebar */}
        <div className="hidden w-44 shrink-0 flex-col border-r border-ink-800 p-3 sm:flex">
          <p className="px-1 pb-2 text-[9px] font-medium uppercase tracking-wider text-ink-600">
            Spaces
          </p>
          {[
            ["🎓", "School", true],
            ["🌱", "Personal", false],
            ["📦", "Misc", false],
          ].map(([icon, name, active]) => (
            <div
              key={name}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                active ? "bg-ink-800 text-ink-100" : "text-ink-500"
              }`}
            >
              <span>{icon}</span>
              {name}
            </div>
          ))}

          <p className="px-1 pb-2 pt-4 text-[9px] font-medium uppercase tracking-wider text-ink-600">
            School · Notes
          </p>
          {[
            ["📐", "Eigenvectors", true],
            ["🌿", "Photosynthesis", false],
            ["⚡", "Big-O", false],
            ["📊", "Elasticity", false],
          ].map(([icon, name, active]) => (
            <div
              key={name}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                active ? "bg-ink-800 text-ink-100" : "text-ink-500"
              }`}
            >
              <span>{icon}</span>
              <span className="truncate">{name}</span>
            </div>
          ))}

          <div className="mt-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-ink-500">
            <span>🗑️</span> Trash (24h)
          </div>
        </div>

        {/* Note */}
        <div className="min-w-0 flex-1">
          {/* HUD tab bar */}
          <div className="flex items-center gap-1 border-b border-ink-800 px-4 py-2">
            {[
              ["📝", "Notes", true],
              ["📅", "Calendar", false],
              ["🧊", "3D", false],
              ["📊", "Mastery", false],
            ].map(([icon, label, active]) => (
              <span
                key={label}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] ${
                  active ? "bg-ink-800 text-ink-100" : "text-ink-500"
                }`}
              >
                {icon} {label}
              </span>
            ))}
          </div>

          <div className="p-5">
            <h3 className="flex items-center gap-2 text-lg font-bold text-ink-100">
              <span>📐</span> Eigenvectors &amp; Eigenvalues
            </h3>

            <div className="mt-4 space-y-2.5">
              <p className="text-[11px] leading-relaxed text-ink-300">
                An eigenvector is a direction a transformation doesn&rsquo;t
                rotate — it only stretches or squashes it.
              </p>
              <div className="rounded-lg border border-ink-800 bg-ink-850 px-3 py-2 font-mono text-[10px] text-duck-300">
                A v = λ v
              </div>
              {["λ > 1 — stretches", "λ < 0 — flips across the origin"].map(
                (line) => (
                  <p
                    key={line}
                    className="flex gap-2 text-[11px] leading-relaxed text-ink-300"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-500" />
                    {line}
                  </p>
                ),
              )}

              <div className="relative flex items-start gap-2">
                <span className="mt-1 text-[10px] text-ink-600">⠿</span>
                <p className="flex-1 rounded-lg bg-ink-850/70 px-2 py-1.5 text-[11px] leading-relaxed text-ink-200 ring-1 ring-duck-500/25">
                  I can&rsquo;t explain why a shear matrix has only one
                  eigenvector direction.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer */}
        <div className="hidden w-60 shrink-0 flex-col border-l border-ink-800 bg-ink-900 p-4 lg:flex">
          <div className="flex items-center gap-2 border-b border-ink-800 pb-3">
            <span>🦆</span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-ink-100">Quiz me</p>
              <p className="truncate text-[9px] text-ink-600">Shear matrices</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <MiniRing score={62} />
            <div>
              <p className="text-[10px] font-semibold text-ink-100">
                3 of 5 correct
              </p>
              <p className="text-[9px] leading-snug text-ink-500">
                Definitions held. The geometry didn&rsquo;t.
              </p>
            </div>
          </div>

          <p className="mt-4 text-[9px] font-medium uppercase tracking-wider text-ink-600">
            Confidence heatmap
          </p>
          <div className="mt-2 space-y-1.5">
            {[
              ["Definition of λ", "green"],
              ["Diagonalisation", "yellow"],
              ["Shear geometry", "red"],
              ["Complex eigenvalues", "red"],
            ].map(([topic, key]) => (
              <div
                key={topic}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] ${STATUS[key].chip}`}
              >
                <span>{STATUS[key].shape}</span>
                <span className="truncate">{topic}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniRing({ score }) {
  const r = 16;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg width="40" height="40" className="-rotate-90">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-ink-800"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="stroke-shaky-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-shaky-500">
        {score}
      </span>
    </div>
  );
}

/* ── Features ───────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: "✍️",
    kicker: "Write",
    title: "A block editor that stays out of the way",
    body: "Seventeen block types behind a slash menu — headings, to-dos, toggles, callouts, code, embeds. Drag blocks by the ⠿ handle, add a cover, pick an emoji, star what matters.",
    bullets: [
      "Slash menu, covers, emoji and favourites",
      "Drag the ⠿ handle to reorder",
      "Spaces, and a trash that keeps deletions for 24h",
    ],
  },
  {
    icon: "✨",
    kicker: "Understand",
    title: "An explanation built from your own notes",
    body: "The Explainer reads what you wrote and pitches to it — spending its effort where your notes are thin or where you admitted being stuck, instead of repeating what you already have.",
    bullets: [
      "The mechanism, in the order you should meet it",
      "An analogy, with where it breaks marked",
      "The misconceptions most likely to bite you",
    ],
  },
  {
    icon: "🦆",
    kicker: "Prove it",
    title: "Two ways to be found out",
    body: "A quick quiz writes questions from your note and grades them. Or explain the idea to the Socratic Duck, which never gives you the answer and keeps asking until it finds the edge of what you know.",
    bullets: [
      "Multiple choice, marked exactly — no LLM guesswork",
      "Short answers graded on the mechanism, not wording",
      "Distractors built from real mistakes",
    ],
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
      <SectionHead
        kicker="What it does"
        title="Three things, done properly"
        blurb="Note-taking apps store what you wrote. This one checks whether any of it stuck."
      />

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <article
            key={feature.kicker}
            className="group rounded-2xl border border-ink-800 bg-ink-900/60 p-6 backdrop-blur transition-colors hover:border-ink-700"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-800 bg-ink-850 text-xl transition-transform group-hover:scale-105">
              {feature.icon}
            </span>

            <p className="mt-5 text-[11px] font-medium uppercase tracking-wider text-duck-400">
              {feature.kicker}
            </p>
            <h3 className="mt-1.5 text-[17px] font-semibold leading-snug text-ink-100">
              {feature.title}
            </h3>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-400">
              {feature.body}
            </p>

            <ul className="mt-4 space-y-1.5 border-t border-ink-800 pt-4">
              {feature.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-2 text-[12px] leading-relaxed text-ink-500"
                >
                  <span aria-hidden="true" className="text-duck-500">
                    ✓
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── Heatmap showcase ───────────────────────────────────────────── */
const SHOWCASE_TOPICS = [
  ["Definition of λ", "green"],
  ["Stretch vs flip", "green"],
  ["Characteristic polynomial", "yellow"],
  ["Diagonalisation", "yellow"],
  ["Shear geometry", "red"],
  ["Complex eigenvalues", "red"],
  ["Light reactions", "green"],
  ["Calvin cycle turns", "yellow"],
  ["Photorespiration", "red"],
  ["Amortised vs average", "red"],
  ["Comparison-sort floor", "green"],
  ["Space complexity", "yellow"],
];

function HeatmapShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="overflow-hidden rounded-3xl border border-ink-800 bg-ink-900/60 backdrop-blur">
        <div className="grid gap-10 p-8 lg:grid-cols-2 lg:p-12">
          <div className="flex flex-col justify-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-duck-400">
              The part that changes how you study
            </p>
            <h2 className="mt-2 text-balance text-[30px] font-bold leading-tight tracking-tight text-ink-100">
              A heatmap of what you actually know
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-400">
              Every session grades each sub-topic on its own and files the result
              here. Not a single score for &ldquo;Linear Algebra&rdquo; — a
              separate verdict on the definition, the geometry, and the thing you
              have quietly avoided since week three.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                [
                  "Sorted weakest first",
                  "The top of the list is where the next hour should go.",
                ],
                [
                  "Tracks whether you're improving",
                  "A topic that was red twice and is now amber says something an average would hide.",
                ],
                [
                  "One click back to the gap",
                  "Every row can re-explain or re-test that exact sub-topic.",
                ],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-duck-400"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-ink-200">
                      {title}
                    </span>
                    <span className="block text-[13px] leading-relaxed text-ink-500">
                      {body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* The heatmap itself */}
          <div className="rounded-2xl border border-ink-800 bg-ink-950/60 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
                Topic heatmap
              </p>
              <ul className="flex gap-3">
                {STATUS_ORDER.map((key) => (
                  <li
                    key={key}
                    className="flex items-center gap-1.5 text-[10px] text-ink-500"
                  >
                    <span aria-hidden="true" className={STATUS[key].text}>
                      {STATUS[key].shape}
                    </span>
                    {STATUS[key].label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SHOWCASE_TOPICS.map(([topic, key]) => (
                <span
                  key={topic}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${STATUS[key].chip}`}
                >
                  <span aria-hidden="true">{STATUS[key].shape}</span>
                  {topic}
                </span>
              ))}
            </div>

            <div className="mt-5 border-t border-ink-800 pt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-500">
                What to study next
              </p>
              <div className="space-y-1.5">
                {[
                  [
                    "Shear geometry",
                    "red",
                    "You restated the definition instead of the geometry.",
                  ],
                  [
                    "Amortised vs average",
                    "red",
                    "You treated a worst-case guarantee as a probability.",
                  ],
                  [
                    "Photorespiration",
                    "red",
                    "You named C4 and CAM but not what separates them.",
                  ],
                ].map(([topic, key, note]) => (
                  <div
                    key={topic}
                    className="flex gap-2.5 rounded-lg border border-ink-800 bg-ink-900 px-3 py-2"
                  >
                    <span
                      aria-hidden="true"
                      className={`text-[11px] ${STATUS[key].text}`}
                    >
                      {STATUS[key].shape}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-medium text-ink-200">
                        {topic}
                      </span>
                      <span className="block text-[10px] leading-relaxed text-ink-500">
                        {note}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── The rest of the workspace ──────────────────────────────────── */
const EXTRAS = [
  {
    icon: "📅",
    title: "Calendar & Pomodoro",
    body: "Plan study sessions against a month view, then run the countdown timer. When it finishes, a full-screen alarm and a tab-title swap make sure you notice.",
  },
  {
    icon: "🧊",
    title: "3D visualisation studio",
    body: "Build and orbit interactive 3D models, saved alongside your notes — for the concepts a paragraph was never going to carry.",
  },
  {
    icon: "⚡",
    title: "Instant notes on Ctrl+I",
    body: "A three-quarter-screen capture window from anywhere in the app. Ctrl+Enter saves it straight to Misc so the thought does not get lost.",
  },
  {
    icon: "🗑️",
    title: "A trash that waits 24 hours",
    body: "Deleted notes sit recoverable for a day with a live countdown, then purge themselves. Recover one, or all of them, in a click.",
  },
  {
    icon: "🌗",
    title: "Light and dark, properly",
    body: "Two hand-picked palettes rather than an inverted filter — including the mastery colours, which are re-stepped so they stay legible on a light surface.",
  },
  {
    icon: "💾",
    title: "Saves locally, syncs when it can",
    body: "Everything works offline in your browser. Point it at a Supabase project and notes, events and visualisations sync there too.",
  },
];

function AlsoInside() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <SectionHead
        kicker="Also inside"
        title="A workspace, not just a quiz app"
        blurb="The study loop sits inside a tool you would use for the rest of the work too."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXTRAS.map((extra) => (
          <article
            key={extra.title}
            className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 backdrop-blur transition-colors hover:border-ink-700"
          >
            <span className="text-xl">{extra.icon}</span>
            <h3 className="mt-3 text-[15px] font-semibold text-ink-100">
              {extra.title}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-400">
              {extra.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── How it works ───────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Write the note",
      body: "Or open one of the six that ship with the app — real notes on eigenvectors, photosynthesis, Big-O, elasticity, memory and neural networks.",
    },
    {
      n: "02",
      title: "Ask for the explanation",
      body: "Take the whole note, or one block from its ⠿ menu. You get the mechanism, an analogy, the traps, and a worked example pitched at what you already wrote.",
    },
    {
      n: "03",
      title: "Get quizzed and scored",
      body: "Five questions, or a Socratic interrogation. Either way you end up with a score, per-question feedback, and a sub-topic breakdown.",
    },
    {
      n: "04",
      title: "Follow the heatmap",
      body: "Every result lands on your mastery map. Study the red, re-test it, and watch whether it actually moves.",
    },
  ];

  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
      <SectionHead
        kicker="How it works"
        title="Four steps, one loop"
        blurb="The loop is the point: writing, understanding and testing feed each other."
      />

      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <li
            key={step.n}
            className="relative rounded-2xl border border-ink-800 bg-ink-900/60 p-6 backdrop-blur"
          >
            <span className="font-mono text-[11px] tabular-nums text-duck-500">
              {step.n}
            </span>
            <h3 className="mt-2 text-[15px] font-semibold text-ink-100">
              {step.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── CTA + footer ───────────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl border border-duck-500/25 bg-gradient-to-br from-duck-500/[0.12] via-ink-900 to-ink-900 px-8 py-14 text-center">
        <h2 className="text-balance text-[32px] font-bold leading-tight tracking-tight text-ink-100">
          Find out what you actually know
        </h2>
        <p className="mx-auto mt-3 max-w-md text-balance text-[15px] leading-relaxed text-ink-400">
          The workspace opens on six real notes. Pick one and let the Duck take
          it apart.
        </p>
        <Link
          href="/workspace?tour=true"
          className="mt-7 inline-block rounded-xl bg-duck-400 px-6 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-duck-500/20 transition-all hover:bg-duck-300"
        >
          Open the workspace →
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-800/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-6 text-[11px] text-ink-600">
        <span className="flex items-center gap-1.5">
          <span>🦆</span> SocraticOS
        </span>
        <span className="ml-auto">
          Next.js · Tailwind v4 · Gemini · Supabase · quadcore-hackathon-2k26
        </span>
      </div>
    </footer>
  );
}

function SectionHead({ kicker, title, blurb }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-medium uppercase tracking-wider text-duck-400">
        {kicker}
      </p>
      <h2 className="mt-2 text-balance text-[32px] font-bold leading-tight tracking-tight text-ink-100">
        {title}
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-400">{blurb}</p>
    </div>
  );
}
