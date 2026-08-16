# SocraticOS — Comprehensive Codebase Summary & Handover Guide

> **To any AI Assistant or Developer taking over**: 
> This document provides an exhaustive, authoritative technical overview of **SocraticOS** (`quadcore-hackathon-2k26`). It explains the architecture, local-first IndexedDB storage model, UI component hierarchy, 18-block note editor, 14-topic 3D scientific simulation studio, AI tutoring engine, multi-timer HUD system, export/import engine, design system tokens, and operational gotchas.

---

## 📌 1. Executive Summary & Tech Stack

**SocraticOS** is an intelligent, Notion-inspired learning operating system and 3D scientific visualization studio built on one fundamental principle: **rereading is not studying**. The application pairs rich block-based note-taking with interactive real-time 3D models, structured AI explanations, diagnostic quizzes, Socratic Rubber Duck dialogue, dynamic 3D concept widgets, multi-timer HUDs, and an aggregate mastery heatmap tracking sub-topic confidence over time.

### Tech Stack:
- **Framework**: Next.js 15.0.0 (App Router, Turbopack / Webpack build engine)
- **UI & Logic**: React 19 (Server & Client Components), Tailwind CSS v4 (`@tailwindcss/postcss`, dynamic CSS variable design tokens)
- **Database & Storage**: Local-first IndexedDB via **Dexie.js** (`SocraticOS_LocalDB` v4) — 100% offline, private, zero-latency browser storage for notes, trash, calendar events, study sessions, alarms, and graphics settings
- **AI Integration**: Direct **Google Gemini API** (`lib/gemini.js` with OpenAPI 3.0 schema enforcement) + Client-side Dexie API Key storage with fallback to `/api/` server routes (`app/api/explain`, `app/api/quiz/generate`, `app/api/quiz/grade`, `app/api/socratic/chat`, `app/api/socratic/widget`). `lib/aiService.js` provides isomorphic client/server AI orchestration
- **3D Engine**: Three.js (r185), `@react-three/fiber` (v9), `@react-three/drei` (v10), custom Canvas engines with OrbitControls, procedural geometry, and WebGL lifecycle memory management
- **Math & Equation Engine**: KaTeX (`katex`) for full block and in-sentence `$formula$` inline math rendering
- **Document & File Conversion**: `docx` + `mammoth` (MS Word generation & parsing), HTML/Markdown/Plain-Text lossless conversion, `.socratic` JSON workspace backup format
- **Timer & Audio Subsystem**: Reactive multi-timer store (`lib/timerStore.js`), Web Audio API chime synthesis for alarms, dynamic browser tab favicon (`🦆` $\leftrightarrow$ `❗️`) and title flashing

---

## 📂 2. Repository Structure & File Map

```
c:\Users\Sivabalan\Documents\GitHub\quadcore-hackathon-2k26\
├── app/
│   ├── api/
│   │   ├── calendar/events/route.js      # Local-first calendar events route fallback
│   │   ├── explain/route.js              # POST: Structured note explanation generator
│   │   ├── quiz/generate/route.js        # POST: Diagnostic quiz generator with distractors
│   │   ├── quiz/grade/route.js           # POST: Objective integer MC + LLM short answer grading
│   │   ├── reset/route.js                # POST: Local-first factory reset signal route
│   │   ├── socratic/chat/route.js        # POST: Socratic Rubber Duck chat & diagnostic scoring
│   │   ├── socratic/widget/route.js      # POST: Interactive 3D WebGL widget generator
│   │   └── visualizations/route.js       # Local-first 3D visualizations persistence route
│   ├── globals.css                       # Tailwind v4 tokens, light/dark themes, print stylesheet, KaTeX styles
│   ├── layout.js                         # Root layout, metadata & pre-paint theme bootstrap script
│   ├── page.js                           # Marketing landing page (Server Component, CSS-only animations)
│   ├── visualizations/
│   │   └── page.jsx                      # Standalone 3D visualizer page with topic selector & control HUD
│   └── workspace/
│       └── page.js                       # Main application page (renders <Workspace />)
├── components/
│   ├── AlarmOverlay.jsx                  # Global visual/audio alarm overlay & dynamic favicon swap (🦆 <-> ❗️)
│   ├── BlockNoteEditor.jsx               # 18-block Notion-style editor with slash menu, 6-dots handles, covers & stats
│   ├── CalendarView.jsx                  # Study schedule calendar, month navigation, agenda, Pomodoro integration & alarms
│   ├── CommandPalette.jsx                # Ctrl+K global fuzzy search modal for notes, views, and settings
│   ├── ConfidenceHeatmap.jsx             # Per-session sub-topic confidence heatmap (Solid / Shaky / Gap)
│   ├── Drawer.jsx                        # Shared slide-over drawer container for Explain & Quiz
│   ├── EnterPasswordModal.jsx            # Space unlock password verification modal
│   ├── ExplainPanel.jsx                  # Structured LLM explanation drawer
│   ├── ExportImportModal.jsx             # Multi-format export/import modal (.socratic, PDF, DOCX, HTML, TXT, MD)
│   ├── FeatureRequestModal.jsx           # User feedback & feature request submission modal
│   ├── GlobalTimerHUD.jsx                # Unified header multi-timer dropdown with Pomodoro, breaks & custom timers
│   ├── InstantNoteModal.jsx              # Ctrl+I 75% screen quick note capture window with space selection
│   ├── MasteryDashboard.jsx              # Aggregate topic mastery analytics dashboard & study recommendations
│   ├── NoteMenu.jsx                      # Note action menu (Save, Favorite ⭐, Note Stats, Export/Import, Delete)
│   ├── PinnedTimersOverlay.jsx           # Floating picture-in-picture draggable multi-timer widgets overlay
│   ├── QuizPanel.jsx                     # Dual-tab drawer: Graded Quiz + Socratic Rubber Duck dialogue
│   ├── ScoreRing.jsx                     # Animated SVG score dial with status coloring
│   ├── SetPasswordModal.jsx              # Space lock password configuration modal
│   ├── Sidebar.jsx                       # Spaces selector, note list, 24h trash drawer, Settings modal & Reset captcha
│   ├── ThreeDView.jsx                    # 3D studio container with 14 interactive scientific simulations & HUD
│   ├── WidgetCanvas.jsx                  # Interactive 3D Socratic Canvas widget renderer
│   ├── Workspace.jsx                     # Central workspace layout, top HUD header, space state & global shortcuts
│   └── visualizations/
│       ├── BinaryTree3D.jsx              # 3D Binary Search Tree / AVL tree with animated operations
│       ├── BiologyCanvas.jsx             # Cell explorer with organelle cutaways & enzyme kinetics
│       ├── ChemistryCanvas.jsx           # Bohr atom, organic builder C1-C12, distillation, lattices, electrolysis
│       ├── PhysicsCanvas.jsx             # Wave refraction, motor effect, thin lenses, induction, kinetic gas laws
│       ├── cell-organelles.jsx           # Procedural 3D organelle geometry (nucleus, mitochondria, chloroplast, etc.)
│       ├── media.js                      # Refractive index presets (air, water, glass, diamond, perspex)
│       ├── scene-kit.jsx                 # Shared Three.js lighting, camera, grid, bounding box & label helpers
│       └── VisualizationHUD.jsx          # HUD control overlays, parameter sliders, camera reset & quiz overlays
├── lib/
│   ├── aiService.js                      # Isomorphic client-side AI service coordinating Gemini API & user keys
│   ├── backup.js                         # .socratic JSON workspace & space backup packager
│   ├── blockMapping.js                   # Block type mapping & transformation bridge
│   ├── blocks.js                         # Text extractors & concept mappers from blocks
│   ├── constants.js                      # Default SPACES definition (School, Personal, Misc)
│   ├── db.js                             # Dexie.js IndexedDB schema v4, auto-seeding & graphics detection
│   ├── demoNotes.js                      # Six seeded demo notes (Eigenvectors, Photosynthesis, Big-O, etc.)
│   ├── exportImport.js                   # Full export/import engine for PDF, DOCX, HTML, Markdown, Plain Text
│   ├── gemini.js                         # Direct REST Gemini client with structured outputs & usage tracking
│   ├── mastery.js                        # Mastery status vocabulary (Solid ● / Shaky ◐ / Gap ○) & rollup algorithms
│   ├── schemas.js                        # OpenAPI 3.0 schemas for Gemini structured outputs
│   ├── storageService.js                 # Dexie CRUD service for notes, trash, calendar, alarms, sessions & reset
│   ├── syntaxHighlighter.js              # Tokenizer & syntax highlighter for 10 programming languages
│   └── timerStore.js                     # Reactive multi-timer store with localStorage sync & alarm events
├── hooks/
│   └── useVoice.js                       # Web Speech API voice recognition hook
├── tests/
│   ├── unit/
│   │   ├── physics-solvers.test.mjs      # Refraction (Snell's law), thin lenses, gas laws, chemistry formulas
│   │   ├── avl-tree-3d.test.mjs          # 3D BST & AVL auto-balancing tree math & traversals
│   │   ├── export-import.test.mjs        # Markdown, HTML, DOCX, TXT lossless round-trips & blob generation
│   │   ├── mastery-analytics.test.mjs    # Mastery rollup algorithms, trends, and weakest-first sorting
│   │   ├── quiz-grading.test.mjs         # Deterministic integer MC grading & fallback heatmap normalizer
│   │   ├── timer-store.test.mjs          # Multi-timer countdown math, duration clamping, pause/resume
│   │   ├── syntax-highlighter.test.mjs   # 10-language tokenizer & syntax highlighting rules
│   │   └── password-security.test.mjs    # Space UTF-8 base64 encoding & non-Latin1 DOMException protection
│   ├── integration/
│   │   ├── 3d-topic-schemas.test.mjs     # 14 3D scene topics, slider boundary validations & optical media
│   │   ├── ai-widget-resilience.test.mjs # Socratic 3D AI widget normalizer & WebGL shielding
│   │   ├── trash-24h-purge.test.mjs      # 24-hour auto-purge expiration calculations & time formatting
│   │   └── dexie-backup-restore.test.mjs # Full .socratic workspace export/import round-trips & validation
│   └── e2e/
│       ├── keyboard-shortcuts.spec.mjs   # Ctrl+K (Search), Ctrl+I (Instant Note), Ctrl+S (Save), Escape
│       ├── block-editor-flow.spec.mjs    # Slash menu (/), block reordering, undo/redo history snapshots
│       ├── theme-toggle.spec.mjs         # Dark Slate <-> Warm Stone Light pre-paint validation
│       └── export-print.spec.mjs         # PDF print emulation & multi-format export dispatcher
├── scripts/
│   ├── check-block-mapping.mjs           # Unit test for DB <-> Editor block transformations
│   └── test-inlinemath-roundtrip.mjs     # Unit test for in-sentence LaTeX math round-trips
├── DESIGN_SYSTEM.md                      # Official UI design system & CSS color tokens spec
├── ANTIGRAVITY_BUG_FIXES.md              # Exhaustive summary of architectural fixes & test suites
├── README.md                             # Repository overview, setup guide & feature documentation
└── CODEBASE_SUMMARY.md                   # (This document)
```

---

## 🧩 3. Key Features & Implementation Mechanics

### 📝 A. Notion-Style Block Editor (`components/BlockNoteEditor.jsx`)
- **18 Block Types Supported**:
  1. `text`: Plain text paragraph with inline formatting, smart paste, and backspace merge.
  2. `h1`: Large section heading (`text-3xl font-bold`).
  3. `h2`: Medium section heading (`text-xl font-semibold`).
  4. `h3`: Small section heading (`text-lg font-semibold`).
  5. `h4`: Sub-heading (`text-base font-semibold`).
  6. `bullet`: Unordered list item with auto-continuation and escape on empty Enter.
  7. `number`: Ordered list item with dynamic sequential counting (`1.`, `2.`, `3.`).
  8. `todo`: Interactive checkbox with task strikethrough and database synchronization.
  9. `toggle`: Collapsible container with toggle arrow (`▶`/`▼`) and multi-line details.
  10. `callout`: Highlighted frame with 8 icon presets (`💡`, `⚠️`, `📌`, `🔥`, `⭐`, `🎉`, `ℹ️`, `🦆`) and click-away dismissal.
  11. `quote`: Blockquote with thick accent border.
  12. `math`: Full-width LaTeX equation block with live KaTeX rendering, direct viewport click-to-edit, multi-line support (`Shift+Enter`), and auto-delete when emptied.
  13. `inlinemath`: In-sentence LaTeX formula pill (`$formula$`) with click popover, 10 formula presets, and 20 math symbols.
  14. `divider`: Horizontal divider (`hr`) with keyboard navigation (`ArrowUp`/`ArrowDown`) and backspace/delete removal.
  15. `site`: Site bookmark card with live Google Favicon resolution and URL normalization.
  16. `media`: Dual-mode media embed supporting direct URLs and local file uploads for Images, Audio (`<audio controls>`), and Video (`<video controls>`).
  17. `code`: Code snippet block with 10-language syntax highlighting (JS, TS, Python, HTML, CSS, C++, Java, Rust, SQL, JSON), 2-space tab indentation, and synchronized overlay scrolling.
  18. `canvas`: Interactive 70% whiteboard studio with 5 drawing tools (Gel Pen, Felt Marker, Chisel Highlighter, Eraser, Ruler Line Tool), 10-color palette, stroke width presets, and undo/redo (`Ctrl+Z`/`Ctrl+Y`).

- **In-Context Slash Menu (`/`)**: Typing `/` triggers a floating block-type selector directly beneath the active line.
- **Draggable 6-Dots Handles (`⠿`) & Context Formatting**:
  - Drag-and-drop block reordering with animated drop indicator and undo history tracking.
  - Context menu featuring ✨ **Explain**, 🦆 **Quiz me**, text formatting (Bold, Italic, Underline, Strikethrough, Math $x$), Duplicate (📋), Move Up/Down (⬆️/⬇️), Copy Text (📄), and Turn Into Submenu.
- **Cover Banners & Custom Icons**: 100% full-width cover banners with 5 gradient presets (*Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, *Socratic Gold*) and custom emoji picker (`NOTE_EMOJIS`).
- **Real-Time Note Stats**: NoteMenu calculates total characters, total words, total blocks, and estimated reading time across all block contents, toggle details, and math formulas.
- **Auto-Instantiation & Click-to-Append**: Typing inside an empty space automatically instantiates a note. Clicking blank space below the editor appends a new block.

---

### 🔍 B. Universal Navigation, Command Palette & Instant Capture
- **Command Palette (`Ctrl+K` / `Cmd+K`)** (`components/CommandPalette.jsx`): Global fuzzy search for notes across all spaces, navigation views (Notes, Calendar, 3D Studio, Mastery Dashboard), and settings.
- **Instant Note Capture (`Ctrl+I` / `Cmd+I`)** (`components/InstantNoteModal.jsx`): 75% screen glassmorphic modal overlay for immediate drafting with `Ctrl+Enter` quick save to the **"Misc"** space (or user-selected space).
- **Quick Save (`Ctrl+S`)**: Explicit keyboard shortcut to instantly save the active note.

---

### 🧪 C. Interactive 3D Visualization Studio (`components/ThreeDView.jsx`)
A comprehensive suite of 14 real-time interactive 3D simulations across 4 scientific domains:

1. **Physics Engine** (`PhysicsCanvas.jsx`):
   - **Wave Refraction & Snell's Law** (`refraction`): Multi-medium light ray refraction, critical angle calculation, total internal reflection, and lateral displacement through air, water, glass, diamond, and perspex.
   - **The Motor Effect & Fleming's Left-Hand Rule** (`motor`): Magnetic field vectors, current flow, Lorentz force vectors, and interactive current/flux controls.
   - **Thin Lens Optics & Ray Diagrams** (`lenses`): Convex/concave lenses, focal point adjustments, real/virtual image formation, and real-time principal ray tracing.
   - **Electromagnetic Induction** (`induction`): Faraday/Lenz's law, moving magnet dipole field lines, coil turns, and galvanometer deflection.
   - **Kinetic Gas Laws ($PV=nRT$)** (`gas`): Bounded 3D container with kinetic gas particle collisions, pressure gauges, temperature sliders, and volume adjustments.

2. **Chemistry Engine** (`ChemistryCanvas.jsx`):
   - **Bohr Atom & Emission Spectra** (`bohr`): Quantized electron shells (C1-C12, Hydrogen to Calcium), electron transitions, photon absorption/emission, and spectral line readouts.
   - **Organic Chemistry Builder** (`organic`): 6 homologous series (Alkanes, Alkenes, Alkynes, Alcohols, Carboxylic Acids, Esters) across carbon chain lengths **C1–C12** with tetrahedral ($109.5^\circ$), trigonal planar ($120^\circ$), and linear ($sp$) VSEPR geometries.
   - **Fractional Distillation** (`distillation`): Multi-stage fractionating column, crude oil boiling point gradient, bubble cap trays, and kinetic hydrocarbon particle streams.
   - **3D Crystal Lattices** (`lattice`): Giant ionic and covalent lattices: $\text{NaCl}$, Diamond ($sp^3$), Graphite ($sp^2$ layers with van der Waals bonds), Quartz ($\text{SiO}_2$), and Ice ($\text{H}_2\text{O}$ hydrogen-bonded hexagonal rings).
   - **Electrolysis** (`electrolysis`): Beaker electrolyte bath, cathode reduction, anode oxidation, and rising $\text{H}_2$/$\text{O}_2$ gas bubble particle systems.

3. **Biology Engine** (`BiologyCanvas.jsx` & `cell-organelles.jsx`):
   - **Plant & Animal Cell Explorer** (`cell`): Double-layer nuclear envelope with nuclear pores, chromatin, mitochondrial cristae rings, thylakoid grana stacks, vacuoles, ER, Golgi apparatus, and cutaway cross-section modes.
   - **Enzyme Kinetics & Lock-and-Key Model** (`enzyme`): Enzyme-substrate binding, active site conformation, thermal denaturation cliffs, and pH stress curves.
   - **DNA Double Helix Structure** (`dna`): Major/minor grooves, antiparallel sugar-phosphate backbones, and complementary base pairing (A-T double hydrogen bonds, G-C triple hydrogen bonds).

4. **Computer Science Engine** (`BinaryTree3D.jsx`):
   - **3D Binary Search Tree / AVL Tree** (`binary_tree`): Interactive node insertion, deletion, AVL auto-balancing rotations (LL, RR, LR, RL), depth glow shading, and animated in-order, pre-order, and post-order traversals.

5. **Hardware Graphics Adaptation & WebGL Management**:
   - Hardware detection (`detectHardwareGraphics`) selects optimal target FPS (30/60/120), DPR pixel ratio (1.0–2.0), shadows, and antialiasing based on GPU/CPU capabilities.
   - WebGL resource cleanup safely traverses and disposes geometries and materials across `Mesh`, `Line`, `LineSegments`, and `Points` to prevent VRAM memory leaks.
   - frameloop dynamically switches to `"demand"` when backgrounded and `"always"` during active viewing.

---

### ⏱️ D. Multi-Timer HUD, Pinned Floating Widgets & Alarms
- **Unified Global Timer HUD** (`components/GlobalTimerHUD.jsx`): Header dropdown managing concurrent timers: Pomodoro Focus (25m), Short Break (5m), Long Break (15m), and custom timers with live progress rings.
- **Pinned Picture-in-Picture Floating Timers** (`components/PinnedTimersOverlay.jsx`): Float active timers as draggable, translucent HUD widgets anywhere across the application.
- **Study Calendar & Schedule** (`components/CalendarView.jsx`): Month navigation, agenda lists, space tagging, 24-hour time pickers, and custom recurring alarm scheduling.
- **Global Visual & Audio Alarm** (`components/AlarmOverlay.jsx`): Full-screen flashing modal alert (`🚨 ⏰ ❗️`) at `z-[9999]`, Web Audio chime synthesis, dynamic browser tab swap (`🦆` $\leftrightarrow$ `❗️`), and document title alerts.

---

### 🦆 E. Socratic AI Tutor, Explain & 3D Interactive Widgets
- **Structured Concept Explainer (`app/api/explain/route.js`)**: Generates structured breakdowns containing TL;DR summaries, mechanism steps, analogies with explicit breakdown boundaries, common misconceptions, worked examples, and check-yourself questions.
- **Socratic Rubber Duck Assistant (`app/api/socratic/chat/route.js`)**: Probes understanding using the Feynman technique without providing direct answers. Evaluates sessions upon completion and emits a 0–100 score and sub-topic confidence heatmap.
- **3D Socratic Canvas Widgets (`app/api/socratic/widget/route.js` & `components/WidgetCanvas.jsx`)**: Translates sub-topic misconceptions into interactive 3D WebGL scenes with vector arrows, camera controls, parameter sliders, and real-time gap repair guidance.
- **Client-Side AI Orchestration (`lib/aiService.js`)**: Allows users to provide their own Gemini API key stored privately in IndexedDB, calling Gemini directly from the client or falling back to server routes.

---

### 📊 F. Graded Quizzes & Aggregate Mastery Analytics
- **Diagnostic Quiz Builder (`app/api/quiz/generate/route.js`)**: Generates 5–6 questions from notes with realistic distractors, balancing multiple choice and short answer.
- **Objective & LLM Hybrid Grading (`app/api/quiz/grade/route.js`)**: Performs deterministic integer comparison for multiple-choice options and LLM semantic evaluation for short answers, emitting `{ score, summary, gradedAnswers, heatmap }`.
- **Mastery Dashboard (`components/MasteryDashboard.jsx` & `lib/mastery.js`)**: Aggregates all study sessions into a sub-topic confidence matrix:
  - **Solid** (`●` `text-solid-500` / `#0ca30c`): Mechanism explained unprompted.
  - **Shaky** (`◐` `text-shaky-500` / `#ec835a`): Correct but recited or required prompting.
  - **Gap** (`○` `text-gap-500` / `#d03b3b`): Incorrect, missing, or failed follow-up.
  - Features weakest-first study queues, topic trend tracking (improving vs degrading), and history management.

---

### 📦 G. Multi-Format Export, Import & Workspace Backup Engine
- **Workspace & Space Backups (.socratic)** (`lib/backup.js`): Exports entire spaces or all spaces into structured JSON `.socratic` backup packages; supports drag-and-drop restoration with space reassignment and overwrite options.
- **Multi-Format Note Export** (`lib/exportImport.js`):
  - **PDF**: Formatted print layout via `@media print` with `.print-content` preservation for titles, emoji, and syntax-highlighted code.
  - **Word Document (`.docx`)**: Native headings, callout boxes, styled code containers, and formatted lists.
  - **HTML (`.html`)**: Clean standalone HTML5 web page with grouped lists and inline styling.
  - **Markdown (`.md`)**: GitHub-flavored markdown with KaTeX `$formula$` preservation, `<details>` toggles, and callouts.
  - **Plain Text (`.txt`)**: Clean structured text formatting.
- **Drag-and-Drop File Import**: Automatically imports `.socratic`, `.json`, `.docx`, `.html`, `.txt`, and `.md` files into the active space.

---

### 🔒 H. Space Security, 24-Hour Auto-Purge Trash & Settings
- **Password-Protected Spaces**: Set base64 UTF-8 encrypted passwords on any space; protected spaces require verification before opening.
- **24-Hour Auto-Purging Trash**: Deleted notes are placed in the Trash drawer with a `deletedAt` timestamp; a 1-minute interval background task automatically purges items older than 24 hours. Supports individual and batch recovery.
- **Settings Modal & Factory Reset Captcha**: Manage graphics performance presets, personal Gemini API keys, keyboard shortcuts, and table-targeted factory resets protected by random math human captcha verification (`What is X + Y?`).

---

## 🗄️ 4. Local-First Database Architecture (`lib/db.js` & `lib/storageService.js`)

SocraticOS operates entirely local-first using **Dexie.js** (IndexedDB database name: `SocraticOS_LocalDB`, version 4).

### IndexedDB Object Stores:
1. `notes`: Primary note documents.
   - *Index*: `id, spaceId, title, isFavorite, emoji, updatedAt`
   - *Fields*: `id`, `spaceId`, `title`, `blocks` (Array of 18 block objects), `banner`, `emoji`, `isFavorite`, `createdAt`, `updatedAt`
2. `trash`: Soft-deleted notes pending 24-hour auto-purge.
   - *Index*: `id, deletedAt`
   - *Fields*: Complete note document + `deletedAt` ISO timestamp
3. `calendarEvents`: Scheduled study events.
   - *Index*: `id, date, time`
   - *Fields*: `id`, `title`, `date`, `time`, `type`, `space`, `updatedAt`
4. `studySessions`: Graded quiz and Socratic diagnostic session records.
   - *Index*: `id, noteId, timestamp, score`
   - *Fields*: `id`, `noteId`, `noteTitle`, `space`, `concept`, `mode`, `score`, `summary`, `heatmap` (Array of `{ subtopic, status, feedback }`), `createdAt`
5. `alarms`: Custom scheduled recurring study alarms.
   - *Index*: `id, time, enabled`
   - *Fields*: `id`, `title`, `time` (24h "HH:MM"), `days` (Array of weekday numbers 0-6), `enabled`, `sound`, `createdAt`, `updatedAt`
6. `settings`: Key-value application settings.
   - *Index*: `key, value`
   - *Keys*: `apiKey`, `gfx_graphicsPreset`, `gfx_targetFps`, `gfx_pixelRatio`, `gfx_enableShadows`, `gfx_enableAntialias`, `gfx_autoPauseHidden`, `editor_click_to_append`

### Offline Route Resiliency:
All `/api/*` routes (`calendar/events`, `visualizations`, `reset`) respond with `{ success: true, localFirst: true, offline: true }`, ensuring zero console errors or network failures when working fully offline.

---

## 🎨 5. Design System Quick Reference

Refer to **[`DESIGN_SYSTEM.md`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/DESIGN_SYSTEM.md)** for exhaustive design token specifications:

### Color Palette:
- **Backgrounds**: Main Viewport `bg-ink-950` (`#12151e` Dark / `#eef2f6` Light), Card/Sidebar/HUD `bg-ink-900` (`#181c27` / `#f7fafc`), Inputs/Blocks `bg-ink-850` (`#1f2332` / `#e2e8f0`).
- **Borders & Dividers**: Primary `border-ink-800` (`#282d3f` / `#cbd5e1`), Secondary `border-ink-700` (`#363d54` / `#94a3b8`).
- **Text Ramps**: High-contrast `text-ink-100` (`#f1f3fa` / `#0f172a`), Body `text-ink-200` (`#d6dbed` / `#1e293b`), Muted `text-ink-400` / `text-ink-500`.
- **Accents**: Duck Gold Primary `text-duck-300` (`#f7d67c`), `bg-duck-500/20`, `border-duck-500/40`.
- **Mastery Status Scale**:
  - Solid: `●` `text-solid-500` (`#0ca30c` Dark / `#0a7d0a` Light)
  - Shaky: `◐` `text-shaky-500` (`#ec835a` Dark / `#ea580c` Light)
  - Gap: `○` `text-gap-500` (`#d03b3b` Dark / `#b02a2a` Light)
- **Destructive Controls**: Light Red `text-rose-400`, `bg-rose-500/15`, `border-rose-500/30`.

---

## ⚙️ 6. Critical Developer Gotchas & Best Practices

1. **Pre-Paint Theme Flash Prevention**:
   - `app/layout.js` executes an inline synchronous `<script>` in `<head>` reading `localStorage.getItem("socratic_theme")` and setting `data-theme="light"` before initial paint, preventing theme flashing.
2. **SSR Hydration Guard**:
   - Always wrap client-only browser storage access (`localStorage`, `window`) inside a mounted state guard (`const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);`).
3. **Demo Note Seeding Flag**:
   - Seeding is gated by `DEMO_SEED_KEY = "socratic_demo_seeded_v7"` in `lib/db.js`. Both `resetNotesData()` and `factoryResetWorkspace()` write this exact key to prevent demo notes from re-seeding immediately after a deliberate user reset.
4. **URL Protocol Normalization**:
   - Always wrap external URLs with `formatUrl(url)` before passing to `href` or `src` attributes to prevent relative path redirection (`http://localhost:3000/google.com`).
5. **Next.js Dev Cache Corruption**:
   - If running `npm run build` concurrently while `npm run dev` is active, Next.js chunk cache can become corrupted (`MODULE_NOT_FOUND`). Resolve with `Remove-Item -Recurse -Force .next` in PowerShell and restart the dev server.
6. **WebGL Cleanup & Frameloop**:
   - Always clean up Three.js materials and geometries on component unmount across all object types (`isMesh || isLine || isPoints`) and restore `document.body.style.cursor = "auto"`.
7. **Test Suites**:
   - Run `npm test` to execute both `scripts/check-block-mapping.mjs` (lossless DB $\leftrightarrow$ Editor block mapping) and `scripts/test-inlinemath-roundtrip.mjs` (in-sentence LaTeX math export/import round-trips).

---

## 🧪 7. Test Suites & Verification Commands

```bash
# Run unit tests (Block mapping + Inline math round-trips)
npm test

# Run block mapping validation specifically
npm run check:blocks

# Run production build
npm run build
```
