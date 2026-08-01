# SocraticOS

> quadcore-hackathon-2k26

A study workspace built around one idea: **rereading is not studying**. You take
block-based notes, have them explained properly, then get quizzed on them — and
every session grades each sub-topic separately so a heatmap can tell you what
you actually know rather than what you spent the most time reading.

Next.js (App Router) · Tailwind CSS v4 · Google AI Studio (Gemini) · Supabase (optional).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in GOOGLE_API_KEY
npm run dev
```

Open [localhost:3000](http://localhost:3000) for the landing page, or go
straight to [/workspace](http://localhost:3000/workspace).

**`GOOGLE_API_KEY` is the only key you need.** Get one at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it the
notes, editor and heatmap all still work; the three AI features return a 503
explaining what's missing.

Supabase is optional and currently unused by the running app — see
[Persistence](#persistence).

## The three features

### 1. Notes

A Notion-style block editor with 17 block types behind a `/` menu — headings,
to-dos, toggles, callouts, quotes, code, media embeds, bookmarks and note links.
Blocks reorder by dragging the `⠿` handle; clicking it opens a context menu with
formatting, "turn into", and per-block Explain / Quiz actions. Notes take cover
banners, emoji and a favourite star, live in spaces, and deleting one drops it
into a trash that holds it for 24 hours before purging.

Six demo notes ship with the app — eigenvectors, photosynthesis, Big-O,
elasticity, memory science and neural networks. They are written the way real
notes are, including the bits where the author admits to being stuck, because
that is what the AI features key off. They seed only on a genuinely empty
workspace, so a factory reset stays empty.

Alongside the notes tab there is a **calendar** with a Pomodoro timer and a
full-screen alarm, a **3D visualisation studio**, and an **instant-note capture
window** on `Ctrl+I`.

### 2. Explain — `POST /api/explain`

Reads the note and returns a structured explanation: a one-line summary, the
mechanism in the order you should meet it, an analogy **with its own limits
marked**, the misconceptions most likely to bite, a worked example, and
questions that hand straight over to the quiz.

It is pointed deliberately at the gaps: where the notes are thin, or where the
learner wrote down a result without a reason, or wrote "I can't explain why…".

### 3. Quiz, score and heatmap

Two modes, one output shape.

**Quick quiz** — `POST /api/quiz/generate` writes 5–6 questions from the note
(mixed multiple-choice and short answer), `POST /api/quiz/grade` marks them.
Multiple choice is graded **in the route, by comparing two integers**, and that
result is handed to the model as established fact; only short answers are graded
by the LLM, on the mechanism rather than the wording.

**Socratic** — the second tab of the same drawer. `POST /api/socratic/chat` is
the Rubber Duck: it never gives an answer, never says "correct", and keeps
probing until it finds the edge of what you understand. Ending the session
scores the transcript and builds an interactive playground from the gaps.

Both produce `{ score, summary, heatmap }` where heatmap is one
`{ subtopic, status, feedback }` per sub-topic probed. That shared shape is what
lets the dashboard treat both modes as one dataset.

### The mastery map

Every graded session lands on the **Mastery** tab in the workspace header: a topic heatmap
grouped by note, stat tiles, a weakest-first "what to study next" list where each
row can re-explain or re-test that exact sub-topic, and a session log. A topic
seen more than once keeps its history and shows whether it is improving, because
"was a gap twice, now shaky" is the interesting shape and an average would erase
it.

## Layout

Full technical detail lives in [`CODEBASE_SUMMARY.md`](CODEBASE_SUMMARY.md);
UI tokens and component rules in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

```
app/
  page.js                       Landing page (server component, no client JS)
  workspace/page.js             The app
  layout.js                     Root shell + pre-paint theme bootstrap
  globals.css                   Tailwind v4 @theme — dark & light ramps
  api/
    explain/route.js            POST  structured explanation from a note
    quiz/generate/route.js      POST  build a quiz from a note
    quiz/grade/route.js         POST  mark it, score it, build the heatmap
    socratic/chat|widget/       POST  the Socratic Duck + its playground
    notes/save|create|[id]/     Supabase note persistence
    calendar/events, visualizations, reset
components/
  Workspace.jsx                 Shell: HUD tabs, drawers, session recording
  Sidebar.jsx                   Spaces, notes, 24h trash, settings, reset
  BlockNoteEditor.jsx           17 block types, covers, drag-reorder
  CalendarView.jsx              Month view + Pomodoro
  ThreeDView.jsx                3D visualisation studio
  InstantNoteModal.jsx          Ctrl+I capture window
  AlarmOverlay.jsx              Global alarm + tab-favicon swap
  Drawer.jsx                    Shared right-panel chrome
  ExplainPanel.jsx              Feature 2
  QuizPanel.jsx                 Feature 3 — graded quiz + Socratic
  ConfidenceHeatmap.jsx         Per-session heatmap
  MasteryDashboard.jsx          Aggregate heatmap
  ScoreRing.jsx                 The score dial
lib/
  demoNotes.js                  The six seeded notes
  mastery.js                    Status vocabulary + session -> topic rollup
  gemini.js                     Gemini REST client
  schemas.js                    Structured-output schemas for every AI route
  blocks.js, blockMapping.js    Block helpers + editor <-> database mapping
scripts/
  check-block-mapping.mjs       Round-trip guard (npm run check:blocks)
supabase/
  schema.sql                    Tables, enums, indexes, RLS, triggers
```

## Persistence

Everything works offline in `localStorage` (`socratic_notes_by_space`,
`socratic_trash_notes`, `socratic_study_sessions`, `socratic_calendar_events`,
`socratic_visualizations`, `socratic_theme`). Point
`NEXT_PUBLIC_SUPABASE_URL` at a real project and run `supabase/schema.sql`, and
notes, calendar events and visualisations sync there too.

`GET /api/notes/save` deliberately answers `200 { offline: true }` rather than
500 when Supabase is unreachable — the workspace calls it on every mount, and an
unconfigured database is an expected state, not an error.

## Design notes

- **`lib/gemini.js` talks to the REST API with `fetch`**, not `@google/genai` —
  one fewer dependency, and `generate()` is the only function touching the
  network if you want to swap providers.
- **Every AI route uses structured output** (`responseMimeType: "application/json"`
  plus a `responseSchema`), so heatmaps and quizzes arrive schema-valid rather
  than parsed out of prose. Gemini's schema dialect is OpenAPI 3.0, not JSON
  Schema — see the header comment in `lib/schemas.js` before editing one.
- **Multiple choice is never graded by the LLM.** It is a comparison of two
  integers; routing it through a model only adds a way to be wrong, and a
  learner told a right answer was wrong stops trusting every other number.
- **Status colour is never the only channel.** Each of Solid / Shaky / Gap
  carries a colour, a glyph forming an ordinal ramp (`●` `◐` `○`), and a word.
  The palette's yellow "warning" step is deliberately unused: it measures 1.08
  contrast against the brand yellow, so a yellow status cell would read as a
  button. Orange carries "shaky" instead.
- **`blocks.order_index` is `double precision`.** Inserting between two blocks
  is `(prev + next) / 2`, not a renumber of everything below.
- **RLS is on and keyed to `auth.uid()`**, so it denies everything until
  Supabase Auth is wired up. The DEV MODE block at the bottom of `schema.sql`
  opens it up; delete those policies before anything ships.

## Known warnings

`npm audit` reports high-severity advisories in `postcss` and `sharp`. Both are
transitive dependencies *inside* Next.js, the vulnerable range covers every
current Next version, and neither is reachable here. **Do not run
`npm audit fix --force`** — it "fixes" them by downgrading to `next@9.3.3`,
which would delete the App Router.
