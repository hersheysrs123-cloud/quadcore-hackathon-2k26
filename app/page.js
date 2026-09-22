import Link from "next/link";
import { STATUS } from "@/lib/mastery";

export const metadata = {
  title: "SocraticOS — notes that quiz you back",
  description:
    "Block notes, a calendar, 3D visualisations, and an AI that explains your notes then quizzes you on them — scoring every sub-topic onto a mastery heatmap.",
};

/**
 * Landing page (redesign).
 *
 * Server component, no client JS. One idea per screen: the loop
 * (write → explain → quiz → mastery), a product shot built from markup so it
 * always matches the live palette, then the supporting tools and a single CTA.
 */
export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Nav />
      <Hero />
      <Loop />
      <Tools />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-800/70 bg-ink-950/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-duck-400 text-sm">🦆</span>
          <span className="text-sm font-semibold tracking-tight text-ink-100">SocraticOS</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <a href="#loop" className="hidden rounded-lg px-3 py-1.5 text-[13px] text-ink-400 transition-colors hover:text-ink-100 sm:block">
            How it works
          </a>
          <a href="#tools" className="hidden rounded-lg px-3 py-1.5 text-[13px] text-ink-400 transition-colors hover:text-ink-100 sm:block">
            Tools
          </a>
          <Link
            href="/workspace"
            className="ml-2 rounded-lg bg-duck-400 px-3.5 py-1.5 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-duck-300"
          >
            Open workspace
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-12 pt-20 sm:pt-28">
      <div className="mx-auto max-w-3xl text-center animate-fade-up">
        <p className="text-[13px] font-medium text-duck-400">Rereading is not studying</p>
        <h1 className="mt-4 text-balance text-[42px] font-bold leading-[1.05] tracking-tight text-ink-100 sm:text-[64px]">
          Notes that quiz you back
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ink-400">
          Write your notes, have them explained, then find out what you actually understood. Sub-topic by
          sub-topic, on a map that tells you what to revise next.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/workspace?tour=true"
            className="rounded-xl bg-duck-400 px-5 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-duck-500/20 transition-colors hover:bg-duck-300"
          >
            Start studying
          </Link>
          <a
            href="#loop"
            className="rounded-xl border border-ink-700 px-5 py-3 text-sm font-medium text-ink-200 transition-colors hover:border-ink-600 hover:bg-ink-900"
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 text-xs text-ink-500">No sign-up. Loaded with demo notes. Everything stays in your browser.</p>
      </div>

      <div className="mt-16 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <AppPreview />
      </div>
    </section>
  );
}

/* The product shot, built out of divs so it never drifts from the palette. */
function AppPreview() {
  const rail = [
    ["⌂", "Home", false],
    ["≡", "Notes", true],
    ["◎", "Quizzes", false],
    ["▤", "Mastery", false],
    ["▦", "Calendar", false],
    ["◫", "3D Lab", false],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl shadow-ink-950">
      <div className="flex min-h-[24rem]">
        <div className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-ink-800 py-3 sm:flex">
          <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-duck-400 text-xs">🦆</span>
          {rail.map(([glyph, label, active]) => (
            <span
              key={label}
              className={`flex w-11 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[8px] ${
                active ? "bg-ink-800 text-ink-100" : "text-ink-500"
              }`}
            >
              <span className="text-sm leading-none">{glyph}</span>
              {label}
            </span>
          ))}
        </div>

        <div className="hidden w-44 shrink-0 flex-col border-r border-ink-800 p-3 sm:flex">
          <div className="flex items-center gap-2 rounded-lg px-1 py-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-800 text-xs">🎓</span>
            <span className="text-[11px] font-semibold text-ink-100">School</span>
          </div>
          <div className="mt-2 rounded-md bg-ink-850 px-2 py-1 text-[9px] text-ink-500">Find a note</div>
          <p className="px-1 pb-1 pt-3 text-[9px] font-medium uppercase tracking-wider text-ink-500">Notes</p>
          {[
            ["📐", "Eigenvectors", true],
            ["🌿", "Photosynthesis", false],
            ["⚡", "Big-O", false],
            ["📊", "Elasticity", false],
          ].map(([icon, name, active]) => (
            <div
              key={name}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                active ? "bg-ink-800 text-ink-100" : "text-ink-400"
              }`}
            >
              <span>{icon}</span>
              <span className="truncate">{name}</span>
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-ink-800 px-4 py-2">
            <span className="text-[10px] text-ink-400">
              School <span className="text-ink-600">/</span> <span className="text-ink-100">📐 Eigenvectors</span>
            </span>
            <span className="flex items-center gap-1 rounded-lg border border-ink-800 bg-ink-850 p-0.5 text-[9px]">
              <span className="rounded-md px-2 py-1 text-ink-300">Explain</span>
              <span className="rounded-md bg-duck-400 px-2 py-1 font-semibold text-ink-950">🦆 Quiz me</span>
              <span className="rounded-md px-2 py-1 text-ink-300">Tutor</span>
            </span>
          </div>
          <div className="p-5">
            <h3 className="text-lg font-bold text-ink-100">Eigenvectors &amp; Eigenvalues</h3>
            <div className="mt-4 space-y-2.5">
              <p className="text-[11px] leading-relaxed text-ink-300">
                An eigenvector is a direction a transformation doesn&rsquo;t rotate — it only stretches or squashes it.
              </p>
              <div className="rounded-lg border border-ink-800 bg-ink-850 px-3 py-2 font-mono text-[10px] text-duck-300">
                A v = λ v
              </div>
              {["λ > 1 — stretches", "λ < 0 — flips across the origin"].map((line) => (
                <p key={line} className="flex gap-2 text-[11px] leading-relaxed text-ink-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-500" />
                  {line}
                </p>
              ))}
              <p className="rounded-lg bg-ink-850 px-3 py-2 text-[11px] leading-relaxed text-ink-200 ring-1 ring-duck-500/30">
                I can&rsquo;t explain why a shear matrix has only one eigenvector direction.
              </p>
            </div>
          </div>
        </div>

        <div className="hidden w-60 shrink-0 flex-col border-l border-ink-800 bg-ink-900 p-4 lg:flex">
          <p className="text-[11px] font-semibold text-ink-100">Quiz me</p>
          <p className="text-[9px] text-ink-500">Shear matrices</p>
          <div className="mt-3 flex items-center gap-3">
            <MiniRing score={62} />
            <div>
              <p className="text-[10px] font-semibold text-ink-100">3 of 5 correct</p>
              <p className="text-[9px] leading-snug text-ink-500">Definitions held. The geometry didn&rsquo;t.</p>
            </div>
          </div>
          <p className="mt-4 text-[9px] font-medium uppercase tracking-wider text-ink-500">Confidence</p>
          <div className="mt-2 space-y-1.5">
            {[
              ["Definition of λ", "green"],
              ["Diagonalisation", "yellow"],
              ["Shear geometry", "red"],
              ["Complex eigenvalues", "red"],
            ].map(([topic, key]) => (
              <div key={topic} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] ${STATUS[key].chip}`}>
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
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-ink-800" />
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
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-shaky-500">{score}</span>
    </div>
  );
}

const LOOP = [
  {
    step: "01",
    title: "Write",
    body: "A block editor with maths, code, tables, drawings and Notion-style sub-pages. Import PDFs and Word files, export to anything.",
  },
  {
    step: "02",
    title: "Get it explained",
    body: "Ask for any note, or any single block, to be explained properly, scoped to your syllabus if you upload one.",
  },
  {
    step: "03",
    title: "Get quizzed",
    body: "Graded questions or a Socratic interrogation that keeps asking “why?” until it finds where your understanding stops.",
  },
  {
    step: "04",
    title: "See what stuck",
    body: "Every sub-topic is scored solid, shaky or gap. The mastery map tells you what to revise next instead of what you read most.",
  },
];

function Loop() {
  return (
    <section id="loop" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
      <p className="text-[13px] font-medium text-duck-400">How it works</p>
      <h2 className="mt-2 max-w-2xl text-balance text-[30px] font-bold leading-tight tracking-tight text-ink-100 sm:text-[38px]">
        One loop, from notes to mastery
      </h2>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {LOOP.map((f) => (
          <div key={f.step} className="rounded-2xl border border-ink-800 bg-ink-900 p-6">
            <span className="font-mono text-[11px] text-ink-500">{f.step}</span>
            <h3 className="mt-3 text-[17px] font-semibold text-ink-100">{f.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-400">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const TOOLS = [
  { icon: "◫", title: "3D Lab", body: "51 interactive models across physics, chemistry, biology, CS and maths. Every one can be explained and quizzed." },
  { icon: "▦", title: "Calendar & timers", body: "Study schedule, Pomodoro sprints and alarms, all stored locally." },
  { icon: "◎", title: "Quiz Studio", body: "Build custom quizzes from one note or many, then track your results." },
  { icon: "▤", title: "Saved links", body: "Bookmarks with folders and notes, importable from your browser." },
];

function Tools() {
  return (
    <section id="tools" className="border-y border-ink-800/70 bg-ink-900/40">
      <div className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <p className="text-[13px] font-medium text-duck-400">Also inside</p>
        <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-tight text-ink-100 sm:text-[38px]">Everything else a study day needs</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <div key={t.title} className="flex gap-4 rounded-2xl border border-ink-800 bg-ink-900 p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-850 text-lg text-duck-400">{t.icon}</span>
              <div>
                <h3 className="text-[15px] font-semibold text-ink-100">{t.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-400">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 text-center">
      <h2 className="text-balance text-[30px] font-bold tracking-tight text-ink-100 sm:text-[38px]">Find out what you actually know</h2>
      <p className="mx-auto mt-3 max-w-lg text-[15px] text-ink-400">
        Open the workspace, pick a demo note, press Quiz me. That is the whole product.
      </p>
      <Link
        href="/workspace?tour=true"
        className="mt-8 inline-block rounded-xl bg-duck-400 px-6 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-duck-500/20 transition-colors hover:bg-duck-300"
      >
        Open the workspace
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-800/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-ink-500">
        <span>🦆 SocraticOS</span>
        <span>Local-first. Your notes never leave this browser unless you export them.</span>
      </div>
    </footer>
  );
}
