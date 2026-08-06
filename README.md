# SocraticOS

> **quadcore-hackathon-2k26** — An intelligent, interactive study workspace, 3D scientific visualization studio & Socratic AI tutor.

A state-of-the-art learning environment built around one core premise: **rereading is not studying**. Take block-based notes, command your workspace with universal keyboard shortcuts, explore concepts in real-time 3D, receive structured explanations, test your understanding through interactive quizzes, interact with 3D Socratic widgets, and track sub-topic confidence over time on an aggregate mastery heatmap.

**Stack**: Next.js 15 (App Router) · React 19 · Three.js / React Three Fiber · Tailwind CSS · Google Gemini AI API · Supabase & IndexedDB (Dexie).

---

## ⚡ Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (Gemini API key)
cp .env.example .env.local   # fill in GOOGLE_API_KEY

# 3. Start local development server
npm run dev
```

Open [localhost:3000](http://localhost:3000) for the marketing landing page, or launch the app directly at [/workspace](http://localhost:3000/workspace).

> **Note**: `GOOGLE_API_KEY` is the only required key. Get one for free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it, the note editor, 3D simulations, multi-timer system, export/import, and local mastery heatmaps function normally offline; AI tutoring endpoints will gracefully report missing credentials.

---

## ✨ Key Features & Capabilities

### 📝 1. Notion-Style Block Note Editor
- **17 Block Types Supported**: Text, Heading 1 (`h1`), Heading 2 (`h2`), Heading 3 (`h3`), Heading 4 (`h4`), Bullet List, Numbered List (auto-indexing `1.`, `2.`), To-Do List (interactive checkboxes with strikethrough), Toggle List (collapsible arrow `▶`/`▼`), Callout Box (with 8 icon presets), Quote (thick accent border), Divider (`hr`), Note Link (workspace note picker popover), Site Bookmark Embed (clickable card with favicon), Media Embed (Image, Audio, Video player), Code Snippet (with syntax highlighting), and Action Button.
- **In-Context Slash Menu (`/`)**: Typing `/` triggers a block-type selector directly underneath the active line.
- **6-Dots Handles (`⠿`) & Context Formatting**: Hovering blocks displays aligned delete (`🗑️`) and `⠿` handles. Context popovers feature:
  - ✨ **Explain** / 🦆 **Quiz me** for that specific block.
  - **Inline Text Formatting**: Bold (`B`), Italic (`I`), Underline (`U`), Strikethrough (`S`).
  - 🔄 **Turn Into Submenu**: Convert block into any of the 17 block types.
- **Cover Banners**: Full horizontal width note headers with 5 gradient presets (*Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, *Socratic Gold*).
- **Custom Emoji Picker & Star Favorites (`⭐`)**: Assign note emojis and toggle star favorites to pin notes in the sidebar.
- **Real-Time Note Stats**: Character count, word count, total block count, and estimated reading time.
- **Auto-Note Instantiation**: Typing inside an empty space automatically instantiates, IDs, and saves a new note.

### 🔍 2. Universal Navigation & Instant Capture
- **Command Palette (`Ctrl+K` / `Cmd+K`)**: Fuzzy-search notes, open workspace tabs (Notes, Calendar, 3D Studio, Mastery Dashboard), switch spaces, or open settings.
- **Instant Note Capture (`Ctrl+I` / `Cmd+I`)**: 75% screen glassmorphic modal overlay for instant note drafting from anywhere in the app with `Ctrl+Enter` quick save into the **"Misc"** space.
- **Quick Save (`Ctrl+S`)**: Explicit keyboard shortcut to instantly save notes.

### 🧪 3. Interactive 3D Visualization Studio
A suite of real-time interactive 3D science simulations built using Three.js, `@react-three/fiber`, and Canvas engines:

- 🧪 **Chemistry Engine** ([`ChemistryCanvas.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/visualizations/ChemistryCanvas.jsx)):
  - **Organic Chemistry Builder**: 6 homologous series (Alkanes, Alkenes, Alkynes, Alcohols, Carboxylic Acids, Esters) across chain lengths **C1–C12** with tetrahedral ($109.5^\circ$), trigonal planar ($120^\circ$), and linear ($sp$) VSEPR geometries.
  - **3D Crystal Lattices**: Sodium Chloride ($\text{NaCl}$), Diamond, Graphite, Quartz ($\text{SiO}_2$), and Ice ($\text{H}_2\text{O}$).
  - **Electrolysis**: Glass beaker solution bath with cathode/anode electroplating dynamics and rising $\text{H}_2$ / $\text{O}_2$ bubble particle streams.
  - **Fractional Distillation**: Multi-stage column with translucent glass sheath, fraction boiling point gradient, and kinetic vapour particle flow.
  - **Bohr Atom**: Quantized electron shell model with orbital rings and photon absorption/emission transitions.

- ⚡ **Physics Engine** ([`PhysicsCanvas.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/visualizations/PhysicsCanvas.jsx)):
  - **Kinetic Gas Laws ($PV=nRT$)**: Interactive gas particle container with collision vectors, temperature/volume controls, and Z-fighting offset geometry.
  - **Optics & Refraction**: Real-time ray tracing through convex/concave lenses and prisms.
  - **Electromagnetic Induction**: Moving magnet field lines, coil flux, and galvanometer deflection.

- 🌿 **Biology Engine** ([`BiologyCanvas.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/visualizations/BiologyCanvas.jsx)):
  - **Cell Explorer**: High-detail plant and animal cells featuring a double-layer nuclear envelope with nuclear pores, mitochondrial cristae rings, thylakoid grana stacks, and turgor pressure vacuoles.
  - **Enzyme Dynamics**: Lock-and-key substrate binding with active-site ridges, wobble animations, denaturation thermal cliffs, and pH stress response.

- 💻 **Computer Science 3D** ([`BinaryTree3D.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/visualizations/BinaryTree3D.jsx)):
  - Interactive 3D Binary Search Tree / AVL tree with node insertion, deletion, balancing rotations, and traversal animations.

### ⏱️ 4. Unified Multi-Timer HUD, Floating Overlay & Alarms
- **Unified Global Timer HUD** ([`GlobalTimerHUD.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/GlobalTimerHUD.jsx)): Header dropdown managing Pomodoro Focus (25m), Short Break (5m), Long Break (15m), and custom duration timers simultaneously.
- **Pinned Floating Timers Overlay** ([`PinnedTimersOverlay.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/PinnedTimersOverlay.jsx)): Pin any timer to float as a picture-in-picture widget anywhere across the application.
- **Study Calendar & Schedule** ([`CalendarView.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/CalendarView.jsx)): Event scheduling, month navigation, space tagging, and Pomodoro timer integration.
- **Global Visual & Audio Alarm** ([`AlarmOverlay.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/AlarmOverlay.jsx)): Full-screen flashing modal alert (`🚨 ⏰ ❗️`) with Web Audio chime synthesis and dynamic browser tab favicon/title swap (`🦆` $\leftrightarrow$ `❗️`).

### 🦆 5. Socratic AI Tutor, Explain & 3D Interactive Widgets
- **AI Explain (`POST /api/explain`)**: Returns structured note breakdowns containing TL;DR summaries, ordered mechanism steps, analogies with explicit limitations, common misconceptions, worked examples, and check-yourself questions.
- **Socratic Rubber Duck Assistant (`POST /api/socratic/chat`)**: Guided dialogue tutor that probes understanding without spoiling answers.
- **3D Socratic Canvas Widgets (`POST /api/socratic/widget` & [`WidgetCanvas.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/WidgetCanvas.jsx)): Generates interactive 3D concept widgets with drag-orbit controls, custom sliders, camera zoom, and sub-topic gap repair hints.

### 📊 6. Graded Quizzes & Sub-Topic Mastery Heatmap
- **Quick Quiz Builder (`POST /api/quiz/generate` & `/grade`)**: Builds 5–6 questions from notes (mixed multiple choice and short answer). Performs deterministic integer grading for multiple choice options and LLM mechanism evaluation for short answers.
- **Mastery Analytics Dashboard** ([`MasteryDashboard.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/MasteryDashboard.jsx)): Consolidates session scores into topic heatmaps grouped by note, tracking sub-topic mastery over time (**Solid** / **Shaky** / **Gap**) with weakest-first study recommendations.

### 📦 7. Multi-Format Export, Import & Backup Engine
- **Workspace & Space Backups (.socratic)** ([`ExportImportModal.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/ExportImportModal.jsx)): Export entire spaces or individual notes into portable JSON `.socratic` packages.
- **Multi-Format Note Export**: Export notes to styled **PDF** (with KaTeX math equation rendering), **Word Document** (`.docx`), **HTML Web Page** (`.html`), **Plain Text** (`.txt`), or **Markdown** (`.md`).
- **Drag-and-Drop Import**: Drag and drop `.socratic`, `.json`, `.docx`, `.html`, `.txt`, or `.md` files directly into target spaces.

### 🗑️ 8. 24-Hour Soft-Delete Trash, Custom Spaces & Privacy Settings
- **24-Hour Auto-Purge Trash** ([`Sidebar.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/Sidebar.jsx)): Soft-delete notes into a Trash drawer with automatic 1-minute interval background purging for notes older than 24 hours. Features individual and batch recovery controls.
- **Spaces Organization**: Organize notes across default spaces (*School*, *Personal*, *Misc*) or create custom user spaces.
- **Graphics & Privacy Settings** ([`SettingsModal.jsx`](file:///workspaces/quadcore-hackathon-2k26/components/SettingsModal.jsx)): Personal Gemini API Key management (100% private IndexedDB storage), 3D graphics quality presets (*Auto*, *High*, *Medium*, *Low/Battery Saver*), target FPS (30/60/120), DPR pixel ratio scaling, and auto-pause when hidden.
- **Factory Reset Captcha**: Targeted table purging with randomized human math captcha verification.
- **First-Run Demo Content** ([`demoNotes.js`](file:///workspaces/quadcore-hackathon-2k26/lib/demoNotes.js)): Ships with seeded notes covering eigenvectors, photosynthesis, Big-O notation, elasticity, memory science, and neural networks.

---

## 📂 Codebase Architecture

```
app/
  page.js                       Landing page (Server Component, CSS-only animations)
  workspace/page.js             Main SocraticOS application page (<Workspace />)
  visualizations/page.js        Standalone 3D visualizer page
  layout.js                     Root shell & pre-paint theme bootstrap
  globals.css                   Site-wide CSS variables for Dark & Light themes
  api/
    explain/route.js            POST  Structured note explanation generator
    quiz/generate/route.js      POST  Interactive quiz builder
    quiz/grade/route.js         POST  Quiz grading & sub-topic heatmap emitter
    socratic/chat|widget/       POST  Socratic assistant & interactive 3D widgets
    notes/save|create|[id]/     Supabase note persistence & hydration APIs
    calendar/events, reset      Calendar event persistence & database factory reset

components/
  Workspace.jsx                 Primary workspace layout container & HUD header
  Sidebar.jsx                   Spaces selector, 24h trash drawer, factory reset modal
  BlockNoteEditor.jsx           17 block types, slash menu (/), 6-dots handles, covers
  NoteMenu.jsx                  Note options dropdown (Save, Favorite, Stats, Export)
  CommandPalette.jsx            Ctrl+K global fuzzy search modal
  InstantNoteModal.jsx          Ctrl+I 75% screen quick note capture window
  CalendarView.jsx              Study schedule calendar & Pomodoro timer
  GlobalTimerHUD.jsx            Unified top HUD multi-timer manager
  PinnedTimersOverlay.jsx       Floating picture-in-picture timers overlay
  AlarmOverlay.jsx              Fullscreen alarm modal & dynamic browser tab favicon/title swap
  ThreeDView.jsx                3D visualization studio container & control HUD
  WidgetCanvas.jsx              Interactive Socratic 3D canvas widget renderer
  ExplainPanel.jsx              Structured LLM explanation drawer
  QuizPanel.jsx                 Graded quiz & Socratic mode drawer
  ConfidenceHeatmap.jsx         Per-session sub-topic confidence heatmap
  MasteryDashboard.jsx          Aggregate topic mastery analytics dashboard
  ExportImportModal.jsx         .socratic, PDF, DOCX, HTML, TXT & MD export/import modal
  SettingsModal.jsx             Graphics performance presets & API key management modal
  visualizations/
    PhysicsCanvas.jsx           Gas laws, optics, induction 3D physics engines
    ChemistryCanvas.jsx         Organic builder, lattices, electrolysis, Bohr atom engines
    BiologyCanvas.jsx           Cell explorer & enzyme lock-and-key engines
    BinaryTree3D.jsx            3D binary search tree / AVL tree engine
    VisualizationHUD.jsx        3D controls overlay & quiz dialogs
    scene-kit.jsx               Shared Three.js lighting, camera & label helpers

lib/
  demoNotes.js                  Seeded demonstration study notes
  mastery.js                    Mastery scoring & sub-topic rollup algorithms
  gemini.js                     Direct REST Gemini client with OpenAPI 3.0 schemas
  schemas.js                    Structured Gemini JSON response schemas
  exportImport.js               PDF, Word, HTML, TXT & Markdown converters
  backup.js                     .socratic JSON workspace & space backup packager
  timerStore.js                 Zustand global multi-timer store
  db.js                         IndexedDB (Dexie) storage client for settings
  blocks.js, blockMapping.js    BlockNote document transformation utilities

supabase/
  schema.sql                    PostgreSQL table schemas, RLS policies & triggers
```

---

## 🎨 Design System & Aesthetics

- **Theme Tokens**: Dark Mode (*Sleek Slate* `#12151e`) and Light Mode (*Warm Stone* `#eef2f6`) configured via dynamic CSS variables on `data-theme`.
- **Surfaces & Accents**: Primary background (`bg-ink-950`), cards (`bg-ink-900`), inputs (`bg-ink-850`), primary accent duck gold (`text-duck-300`, `bg-duck-500/20`), delete controls (`text-rose-400`, `bg-rose-500/15`).
- **Modal Layering & Stacking Context**: Stacking tiers (`z-[100]`, `z-[9999]`) prevent 3D canvas labels from bleeding into modal dialogs.

---

## 🛡️ Offline-First & Privacy Architecture

- **IndexedDB & localStorage**: Primary user data resides locally in the browser (`socratic_notes_by_space`, `socratic_trash_notes`, `socratic_study_sessions`, `socratic_calendar_events`, `socratic_theme`).
- **Graceful Cloud Sync**: When configured, Supabase seamlessly syncs notes via `POST /api/notes/save`. If Supabase is unreachable, `GET /api/notes/save` soft-fails (`200 { success: false, offline: true }`), enabling uninterrupted offline editing.
- **Client-Side API Key Storage**: Personal Gemini API keys are saved exclusively in IndexedDB (Dexie) and never transmitted to external servers.

---

## ⚠️ Developer Notes & Advisories

1. **Next.js Dev Cache Corruption**:
   - If running `npm run build` concurrently while `npm run dev` is running, Next.js chunk cache can become corrupted (`MODULE_NOT_FOUND` error).
   - **Fix**: Remove `.next` directory (`rm -rf .next`) and restart the dev server.
2. **SSR Hydration Guard**:
   - `localStorage` read operations use a `mounted` guard (`useState(false)` with `useEffect`) to prevent Next.js SSR hydration mismatches.
3. **Dependency Advisories**:
   - `npm audit` may highlight transitive advisories inside Next.js (`postcss`, `sharp`). **Do not run `npm audit fix --force`**, as it downgrades Next.js to legacy non-App Router versions.
