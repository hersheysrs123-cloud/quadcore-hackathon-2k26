# SocraticOS

> **quadcore-hackathon-2k26** — An intelligent, interactive study workspace & 3D scientific visualization studio.

A study workspace built around one idea: **rereading is not studying**. You take block-based notes, have concepts explained through structured mechanisms, test your understanding through interactive quizzes, and explore concepts through real-time 3D simulations. Every session grades sub-topics independently to build an actionable mastery heatmap.

**Stack**: Next.js 15 (App Router) · React 19 · Three.js / React Three Fiber · Tailwind CSS v4 · Google AI Studio (Gemini) · Supabase (optional).

---

## Quick Setup

```bash
npm install
cp .env.example .env.local   # fill in GOOGLE_API_KEY
npm run dev
```

Open [localhost:3000](http://localhost:3000) for the landing page, or go straight to [/workspace](http://localhost:3000/workspace).

> **Note**: `GOOGLE_API_KEY` is the only required key. Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it, the note editor, 3D simulations, and local mastery heatmaps function normally; AI tutoring endpoints will report missing credentials cleanly.

---

## Key Features

### 1. Block Note Editor & Workspace
- **Notion-Style Block Editor**: Supports 17 block types behind a `/` menu — headings, to-dos, toggles, callouts, quotes, code blocks, media embeds, bookmarks, and internal note links.
- **Drag Reordering**: Drag blocks with the `⠿` handle or click to access context formatting, "turn into", and per-block AI Explain / Quiz actions.
- **Organization & Capture**: Note cover banners, emojis, space organization, 24-hour soft-delete trash recovery, and an instant note capture modal accessible via `Ctrl+I`.
- **Seeded Notes**: Ships with demo notes for eigenvectors, photosynthesis, Big-O notation, elasticity, memory science, and neural networks.

### 2. Interactive 3D Visualization Studio
A full suite of real-time 3D interactive science simulations built using Three.js and `@react-three/fiber`:

- 🧪 **Chemistry Engine** ([`ChemistryCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/ChemistryCanvas.jsx)):
  - **Organic Chemistry Builder**: Supports 6 homologous series (Alkanes, Alkenes, Alkynes, Alcohols, Carboxylic Acids, Esters) with chain lengths **C1–C12** and VSEPR tetrahedral ($109.5^\circ$), trigonal planar ($120^\circ$), and linear ($sp$) geometries.
  - **Crystal Lattices**: 3D lattice visualizers for Sodium Chloride (NaCl), Diamond, Graphite, Quartz ($SiO_2$), and Ice ($H_2O$).
  - **Electrolysis**: Glass beaker solution bath with cathode/anode electroplating dynamics and rising $H_2$ / $O_2$ bubble particle streams.
  - **Fractional Distillation**: Multi-stage column with translucent glass sheath, fraction boiling point gradient, and kinetic vapour flow.
  - **Bohr Atom**: Quantized electron shell model with orbital rings and photon absorption/emission transitions.

- ⚡ **Physics Engine** ([`PhysicsCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/PhysicsCanvas.jsx)):
  - **Kinetic Gas Laws ($PV=nRT$)**: Interactive gas particle container with dynamic collision vectors, temperature/volume controls, and Z-fighting offset geometry.
  - **Optics & Refraction**: Real-time ray tracing through convex/concave lenses and prisms.
  - **Electromagnetic Induction**: Moving magnet field lines, coil flux, and galvanometer deflection.

- 🌿 **Biology Engine** ([`BiologyCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/BiologyCanvas.jsx)):
  - **Cell Explorer**: High-detail plant and animal cells featuring a double-layer nuclear envelope with 4 nuclear pores, mitochondrial cristae rings, chloroplast thylakoid grana stacks, and turgor pressure vacuoles.
  - **Enzyme Dynamics**: Lock-and-key substrate binding with complementary active-site ridges, wobble animations, denaturation temperature cliffs, and pH stress response.

- 💻 **Computer Science 3D** ([`BinaryTree3D.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/BinaryTree3D.jsx)):
  - Interactive 3D Binary Search Tree / AVL tree with node insertion, deletion, balancing rotations, and traversal step-throughs.

### 3. AI Explain — `POST /api/explain`
Analyzes note content to return structured explanations: a one-line summary, ordered mechanism breakdowns, analogies with explicit limitations, common misconceptions, worked examples, and follow-up quiz prompts.

### 4. Quizzes, Socratic Tutoring & Mastery Heatmap
- **Quick Quiz**: `POST /api/quiz/generate` generates 5–6 mixed multiple-choice and short-answer questions. `POST /api/quiz/grade` performs deterministic integer grading for multiple choice and LLM mechanism grading for short answers.
- **Socratic Rubber Duck**: `POST /api/socratic/chat` provides guided questioning that never spoils answers directly, probing edges of understanding and generating interactive gap-repair widgets.
- **Mastery Dashboard**: Consolidates session scores into topic heatmaps grouped by note, tracking progress over time (Solid / Shaky / Gap) with weakest-first revision suggestions.

---

## Codebase Architecture

```
app/
  page.js                       Landing page & feature showcase
  workspace/page.js             Primary workspace application page
  visualizations/page.js        Standalone 3D visualizer page
  layout.js                     Root shell & pre-paint theme bootstrap
  globals.css                   Tailwind CSS v4 theme design tokens & animations
  api/
    explain/route.js            POST  Structured explanation generation
    quiz/generate/route.js      POST  Interactive quiz builder
    quiz/grade/route.js         POST  Quiz grading & heatmap calculation
    socratic/chat|widget/       POST  Socratic assistant & interactive widgets
    notes/save|create|[id]/     Supabase note persistence routes
    calendar/events, visualizations, reset
components/
  Workspace.jsx                 Application container shell & header
  Sidebar.jsx                   Space navigation, 24h trash, settings modal
  BlockNoteEditor.jsx           17 block types, covers, drag-reorder handles
  CalendarView.jsx              Month study calendar & Pomodoro timer
  ThreeDView.jsx                3D visualization engine container & HUD controls
  InstantNoteModal.jsx          Ctrl+I quick capture window
  AlarmOverlay.jsx              Global alarm overlay & tab favicon manager
  visualizations/
    PhysicsCanvas.jsx           Gas laws, optics, induction 3D engines
    ChemistryCanvas.jsx         Bohr atom, organic builder, lattices, electrolysis
    BiologyCanvas.jsx           Cell explorer & enzyme lock-and-key engines
    BinaryTree3D.jsx            3D binary search tree / AVL engine
    VisualizationHUD.jsx        3D controls overlay & quiz dialogs
    scene-kit.jsx               Shared Three.js lighting, camera & label components
  ConfidenceHeatmap.jsx         Per-session topic heatmap
  MasteryDashboard.jsx          Aggregate mastery analytics dashboard
lib/
  demoNotes.js                  Seeded demonstration study notes
  mastery.js                    Mastery scoring & spaced repetition algorithms
  gemini.js                     Gemini REST API client
  schemas.js                    OpenAPI 3.0 structured output schemas
  blocks.js, blockMapping.js    BlockNote document transformation utilities
supabase/
  schema.sql                    PostgreSQL schema, indexes, RLS policies, & triggers
```

---

## Design & Architecture Highlights

- **Direct REST Gemini Client**: [`lib/gemini.js`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/lib/gemini.js) communicates directly with Gemini REST endpoints via `fetch` using structured JSON schemas (`OpenAPI 3.0` compliant), eliminating unnecessary wrapper overhead.
- **Modal Layering & Stacking Context**: Modal dialogs (Settings, Quiz, Space Creation, Trash) utilize elevated z-index tiers (`z-[200/210]`), ensuring React Three Drei 3D canvas labels never bleed through overlay panels.
- **Deterministic Grading**: Multiple-choice quiz options are evaluated deterministically in code via integer comparison before passing facts to the LLM, preventing grading hallucination.
- **Offline-First Storage**: Primary data resides in `localStorage` (`socratic_notes_by_space`, `socratic_trash_notes`, `socratic_study_sessions`, `socratic_calendar_events`, `socratic_theme`). Optional Supabase connectivity seamlessly syncs notes when configured without interrupting offline workflows.

---

## Known Advisories

`npm audit` may report high-severity advisories in `postcss` and `sharp`. These are transitive dependencies contained within Next.js. **Do not run `npm audit fix --force`**, as it will attempt to resolve dependencies by downgrading to legacy Next.js versions that lack App Router support.
