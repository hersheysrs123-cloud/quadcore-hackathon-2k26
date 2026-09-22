# SocraticOS

> **quadcore-hackathon-2k26** — a study workspace where your notes quiz you back: block-based notes, 51 interactive 3D science simulations, and a Socratic AI tutor.

Built on one premise: **rereading is not studying**. Take notes, explore the concept in real-time 3D, ask the tutor, get quizzed on it, and watch a sub-topic mastery heatmap fill in over time.

**Stack**: Next.js 15 (App Router) · React 19 · Zustand · Three.js / React Three Fiber · Tailwind CSS v4 · Google Gemini API · IndexedDB (Dexie.js) · KaTeX · PrismJS

---

## ⚡ Quick Setup

```bash
npm install
cp .env.example .env.local   # fill in GOOGLE_API_KEY
npm run dev
```

Open [localhost:3000](http://localhost:3000) for the landing page or go straight to [/workspace](http://localhost:3000/workspace).

`GOOGLE_API_KEY` is the only required key (free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)); you can also paste a key into the in-app Settings modal, where it stays in your browser's IndexedDB. Without a key the notes editor, all 51 simulations, timers, export/import and the mastery heatmap work normally offline; only the AI features report a missing key.

---

## ✨ What's Inside

| Area | Highlights |
| :--- | :--- |
| 📝 **Notes** | Notion-style editor with 20 block types (headings, nested lists, to-do, toggle, callout, 2–5 columns, tables, quotes, LaTeX, code, media/YouTube, nested sub-pages), `/` slash menu, drag handles, undo/redo, smart paste from Google Docs, a floating outline, covers, emoji and stars |
| 🔍 **Navigation** | `Ctrl+K` command palette, `Alt+←/→` note history, `Ctrl+I` instant capture, `Ctrl+S` save, multi-note bulk actions, 24-hour trash |
| ⚙️ **Spaces** | Space Hub: per-space syllabus documents, academic level, examiner persona and question rigour, fed to every AI feature |
| 🧑‍🏫 **AI** | Tutor chat grounded in your syllabus and open note, structured Explain breakdowns, note reformatter |
| 🎯 **Quizzes** | Quizzes Studio with 7 question types (MCQ, multi-select, value input, code, step ordering, short answer, essay), resumable runs, review reports and a Solid / Shaky / Gap mastery heatmap |
| 🧪 **3D Studio** | 51 simulations across five subjects, each with live controls, a Details tab and a colour key (below) |
| ⏱️ **Focus** | Multi-timer HUD (Pomodoro, breaks, custom), study calendar, recurring alarms |
| 📖 **Literature** | Annotate poems with overlapping close-reading analysis (stacked underlines, numbered markers, one note across several phrases), a Normal/Test recall mode, a line editor that keeps annotations attached, per-poem intro and conclusion, JSON backups |
| 🔖 **Web Saver** | Bookmark folders per space with favicons; Netscape HTML import/export |
| 📦 **Export** | `.socratic` backups, `.docx`, `.html`, `.txt`, `.md`, PDF via print, drag-and-drop import |
| 🎓 **Tutorial** | 9-chapter interactive onboarding, replayable from Settings or the command palette |

The full tour is in [docs/FEATURES.md](docs/FEATURES.md).

### ⌨️ Shortcuts

| Keys | Action |
| :--- | :--- |
| `Ctrl/Cmd + K` | Command palette: search notes across spaces, jump to a tab, open settings |
| `Ctrl/Cmd + I` | Instant note capture (`Ctrl + Enter` quick-saves, by default to the Misc space) |
| `Ctrl/Cmd + S` | Save the current note |
| `Alt + ←` / `Alt + →` | Back / forward through recently visited notes |
| `/` | Open the block menu on any line |
| `Ctrl + Z` / `Ctrl + Y` | Undo / redo (`Ctrl + Shift + Z` also redoes) |
| `$formula$` | Type inline LaTeX; it compiles to a KaTeX pill when you close the `$` |
| `Ctrl/Cmd + E` | Literature: attach analysis to the words you have selected in a poem |
| `Alt + T` | Literature: switch between Normal and Test mode |

## 🧪 3D Studio — 51 Topics

| Subject | Topics |
| :--- | :--- |
| ⚛️ **Physics** (17) | Refraction · Motor effect · Lenses & mirrors · Induction · Static electricity · Gas laws · Projectile motion · Wave interference · Orbits · Shadows · Incline & friction · Hooke's law · Simple machines · Energy conservation (loop-the-loop) · Circuits · Buoyancy · Heat transfer |
| 🧪 **Chemistry** (13) | Bohr atom · Organic builder · Fractional distillation · Crystal lattices · Electrolysis · VSEPR · Reaction energetics · Separation techniques · Combustion & fire triangle · Particle model · Radioactive decay · Reactivity series · Rusting & galvanic protection |
| 🧬 **Biology** (16) | Cell explorer · DNA · Enzymes · Protein folding · Human eye · Respiratory mechanics · Reflex arc · Antagonistic muscles · Transpiration · Peristalsis · Carbon cycle · Food chains · Flower pollination · Bacteria vs virus · Mitosis & meiosis · Cardiac cycle |
| 💻 **Computer Science** (2) | Binary search / AVL tree · Sorting algorithms |
| 📐 **Mathematics** (3) | Gradient descent · Solids of revolution · Unit circle & Fourier synthesis |

Every topic has a **Controls** tab and a live **Details** tab with calculated readouts and a colour key. The panel resizes from 10% to 80% of the screen and most scenes have a 0.1×–3× animation-speed slider. The physics, chemistry and biology numbers come from pure engines in `lib/`, so what the scene draws and what the panel reports cannot drift apart.

---

## 📚 Documentation

| Document | What it is |
| :--- | :--- |
| [docs/FEATURES.md](docs/FEATURES.md) | The full user-facing feature guide |
| [CODEBASE_SUMMARY.md](CODEBASE_SUMMARY.md) | Technical reference index: architecture, file map, features, database, gotchas (details in [`docs/codebase/`](docs/codebase)) |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Colour tokens and typography; component specs and conventions in [`docs/design/`](docs/design) |
| [docs/BIO_CHEM_3D_AUDIT.md](docs/BIO_CHEM_3D_AUDIT.md) | The biology and chemistry 3D audit: 87 defects, all fixed, and the guardrails that stop them returning |
| [docs/TEST_INFRA.md](docs/TEST_INFRA.md) · [docs/TEST_READY.md](docs/TEST_READY.md) | Plan and results for the 82-case caret-navigation suite |
| [ANTIGRAVITY_BUG_FIXES.md](ANTIGRAVITY_BUG_FIXES.md) | Log of bugs fixed, with root causes |
| [AGENTS.md](AGENTS.md) · [GEMINI.md](GEMINI.md) | Rules for AI assistants, including which docs to update after which change |

## 📂 Architecture at a Glance

```
app/            Pages (landing, /workspace, /visualizations) and the five AI routes under api/
components/     App UI: Workspace, BlockNoteEditor, quiz and space views, timers, export
  redesign/         The application shell: NavRail, NotesPanel, TopBar, HomeView
  literature/       The Literature section: poem canvas, analysis panel, popovers, line editor
  visualizations/   Every 3D scene, the shared kits, the topic registry (topics.js) and the HUD
lib/            Pure engines (one per 3D topic) plus storage, AI, export and editor services
tests/          Unit, integration, e2e, the caret-navigation suite and four guardrail tests
docs/           Feature guide, technical reference, design specs, audits
```

## 🛡️ Offline-First & Privacy

- **All your data stays in the browser**: notes, quizzes, bookmarks and settings live in IndexedDB (`SocraticOS_LocalDB`, v9, 13 stores). There is no server database and no account.
- **Only the AI features use the network**: calls go from your browser to Google's Gemini API with your saved key, or through the five `/api/*` routes, which use `GOOGLE_API_KEY` from `.env.local` and return `503` with a clear message if it is missing.

## 🎨 Design

Dark ("Sleek Slate") and light themes are CSS variables in `app/globals.css`, switched with the `data-theme` attribute. The mastery scale is Solid `●` / Shaky `◐` / Gap `○` — always a colour, a glyph and a word, never colour alone. Full tokens are in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 🧪 Tests

```bash
npm test        # unit, integration, e2e, caret-navigation and stress suites (Node's built-in runner; no browser or API key needed)
npm run build   # production build check
```
