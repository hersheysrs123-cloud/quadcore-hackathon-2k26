# SocraticOS

> **quadcore-hackathon-2k26** — An intelligent, interactive study workspace, 3D scientific visualization studio & Socratic AI tutor.

A state-of-the-art learning environment built around one core premise: **rereading is not studying**. Take block-based notes, command your workspace with universal keyboard shortcuts, explore concepts in real-time 3D, receive structured explanations, test your understanding through interactive quizzes, interact with 3D Socratic widgets, and track sub-topic confidence over time on an aggregate mastery heatmap.

**Stack**: Next.js 15 (App Router) · React 19 · Three.js / React Three Fiber · Tailwind CSS · Google Gemini AI API · IndexedDB (Dexie.js).

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

> **Note**: `GOOGLE_API_KEY` is the only required key. Get one for free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). You can also provide your key directly inside the in-app Settings modal, where it is stored 100% privately in your browser's IndexedDB. Without an API key, the note editor, 14 3D simulations, multi-timer HUD system, export/import, and local mastery heatmaps function normally offline; AI tutoring endpoints will gracefully report missing credentials.

---

## ✨ Key Features & Capabilities

### 📝 1. Notion-Style Block Note Editor
- **18 Block Types Supported**: Text, Heading 1 (`h1`), Heading 2 (`h2`), Heading 3 (`h3`), Heading 4 (`h4`), Bullet List, Numbered List (dynamic sequential indexing `1.`, `2.`), To-Do List (interactive checkboxes with strikethrough), Toggle List (collapsible arrow `▶`/`▼`), Callout Box (with 8 icon presets), Quote (thick accent border), LaTeX Math Equation block (live KaTeX rendering), Inline LaTeX Equation (`inlinemath` pills `$formula$`), Divider (`hr`), Site Bookmark Embed (clickable card with live favicon), Media Embed (Image, Audio `<audio controls>`, Video `<video controls>` with local file upload & URL support), Code Snippet (10-language syntax highlighting), and Canvas Whiteboard (`canvas` with 5 drawing tools & undo/redo).
- **In-Context Slash Menu (`/`)**: Typing `/` triggers a block-type selector directly underneath the active line.
- **Draggable 6-Dots Handles (`⠿`) & Context Formatting**: Hovering blocks displays aligned delete (`🗑️`) and draggable `⠿` handles. Context popovers feature:
  - ✨ **Explain** / 🦆 **Quiz me** for that specific block.
  - **Inline Text Formatting**: Bold (`B`), Italic (`I`), Underline (`U`), Strikethrough (`S`), LaTeX Math ($x$).
  - 🔄 **Turn Into Submenu**: Convert block into any of the 18 block types.
  - 📋 **Duplicate Block**, ⬆️/⬇️ **Move Up/Down**, 📄 **Copy Content**.
- **Cover Banners**: Full horizontal width note headers with 5 gradient presets (*Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, *Socratic Gold*).
- **Custom Emoji Picker & Star Favorites (`⭐`)**: Assign note emojis and toggle star favorites to pin notes in the sidebar.
- **Real-Time Note Stats**: Live character count, word count, total block count, and estimated reading time aggregated across block text, toggle details, and LaTeX formulas.
- **Auto-Note Instantiation & Click-to-Append**: Typing inside an empty space automatically instantiates a new note; clicking blank space below blocks appends a new paragraph.

### 🔍 2. Universal Navigation & Instant Capture
- **Command Palette (`Ctrl+K` / `Cmd+K`)**: Fuzzy-search notes across all spaces, open workspace tabs (Notes, Calendar, 3D Studio, Mastery Dashboard), or open settings.
- **Instant Note Capture (`Ctrl+I` / `Cmd+I`)**: 75% screen glassmorphic modal overlay for instant note drafting from anywhere in the app with `Ctrl+Enter` quick save into the **"Misc"** space.
- **Quick Save (`Ctrl+S`)**: Explicit keyboard shortcut to instantly save notes.

### 🧪 3. Interactive 3D Visualization Studio
A suite of 14 real-time interactive 3D science simulations built using Three.js, `@react-three/fiber`, and custom WebGL Canvas engines:

- ⚡ **Physics Engine** ([`PhysicsCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/PhysicsCanvas.jsx)):
  - **Wave Refraction & Snell's Law**: Multi-medium ray tracing (Air, Water, Glass, Diamond, Perspex), critical angle calculations, and total internal reflection.
  - **Motor Effect & Fleming's Left-Hand Rule**: Magnetic field flux lines, current conductors, and Lorentz force vectors.
  - **Thin Lens Optics & Ray Diagrams**: Convex/concave lenses, focal length controls, real/virtual images, and principal ray tracing.
  - **Electromagnetic Induction**: Faraday/Lenz's law, moving dipole magnets, field lines, and galvanometer deflection.
  - **Kinetic Gas Laws ($PV=nRT$)**: Kinetic particle container with collision vectors, temperature/volume controls, and pressure gauge readouts.

- 🧪 **Chemistry Engine** ([`ChemistryCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/ChemistryCanvas.jsx)):
  - **Bohr Atom & Emission Spectra**: Quantized electron shells (C1–C12, H to Ca), orbital transitions, and photon emission spectral lines.
  - **Organic Chemistry Builder**: 6 homologous series (Alkanes, Alkenes, Alkynes, Alcohols, Carboxylic Acids, Esters) across carbon chain lengths **C1–C12** with VSEPR 3D geometries.
  - **Fractional Distillation**: Multi-stage column with translucent glass sheath, fraction boiling point gradient, and kinetic vapour particle flow.
  - **3D Crystal Lattices**: Giant lattices: Sodium Chloride ($\text{NaCl}$), Diamond ($sp^3$), Graphite ($sp^2$), Quartz ($\text{SiO}_2$), and Ice ($\text{H}_2\text{O}$).
  - **Electrolysis**: Beaker electrolyte bath, cathode reduction, anode oxidation, and rising $\text{H}_2$ / $\text{O}_2$ gas bubble particle streams.

- 🌿 **Biology Engine** ([`BiologyCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/BiologyCanvas.jsx)):
  - **Cell Explorer**: High-detail plant and animal cells featuring nuclear pores, mitochondrial cristae rings, thylakoid grana stacks, vacuoles, ER, Golgi, and cutaway cross-section modes.
  - **Enzyme Dynamics & Lock-and-Key Model**: Substrate binding, active site conformation, wobble animations, thermal denaturation cliffs, and pH stress curves.
  - **DNA Double Helix**: Antiparallel sugar-phosphate backbones, major/minor grooves, and A-T / G-C complementary base pairing.

- 💻 **Computer Science 3D** ([`BinaryTree3D.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/BinaryTree3D.jsx)):
  - Interactive 3D Binary Search Tree / AVL tree with node insertion, deletion, AVL balancing rotations, depth glow shading, and traversal animations.

### ⏱️ 4. Unified Multi-Timer HUD, Floating Overlay & Alarms
- **Unified Global Timer HUD** ([`GlobalTimerHUD.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/GlobalTimerHUD.jsx)): Header dropdown managing Pomodoro Focus (25m), Short Break (5m), Long Break (15m), and custom duration timers simultaneously.
- **Pinned Floating Timers Overlay** ([`PinnedTimersOverlay.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/PinnedTimersOverlay.jsx)): Pin any timer to float as a picture-in-picture draggable widget anywhere across the application.
- **Study Calendar & Schedule** ([`CalendarView.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/CalendarView.jsx)): Event scheduling, month navigation, space tagging, 24-hour time picker, and custom recurring alarm integration.
- **Global Visual & Audio Alarm** ([`AlarmOverlay.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/AlarmOverlay.jsx)): Full-screen flashing modal alert (`🚨 ⏰ ❗️`) at `z-[9999]` with Web Audio chime synthesis and dynamic browser tab favicon/title swap (`🦆` $\leftrightarrow$ `❗️`).

### 🦆 5. Socratic AI Tutor, Explain & 3D Interactive Widgets
- **AI Explain (`POST /api/explain`)**: Returns structured note breakdowns containing TL;DR summaries, ordered mechanism steps, analogies with explicit limitations, common misconceptions, worked examples, and check-yourself questions.
- **Socratic Rubber Duck Assistant (`POST /api/socratic/chat`)**: Guided dialogue tutor that probes understanding using the Feynman technique without spoiling answers.
- **3D Socratic Canvas Widgets (`POST /api/socratic/widget` & [`WidgetCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/WidgetCanvas.jsx)): Generates interactive 3D concept widgets with drag-orbit controls, custom sliders, camera zoom, and sub-topic gap repair hints.

### 📊 6. Graded Quizzes & Sub-Topic Mastery Heatmap
- **Diagnostic Quiz Builder (`POST /api/quiz/generate` & `/grade`)**: Builds 5–6 questions from notes (mixed multiple choice and short answer). Performs deterministic integer grading for multiple choice options and LLM mechanism evaluation for short answers.
- **Mastery Analytics Dashboard** ([`MasteryDashboard.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/MasteryDashboard.jsx)): Consolidates session scores into topic heatmaps grouped by note, tracking sub-topic mastery over time (**Solid** `●` / **Shaky** `◐` / **Gap** `○`) with weakest-first study recommendations.

### 📦 7. Multi-Format Export, Import & Backup Engine
- **Workspace & Space Backups (.socratic)** ([`ExportImportModal.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/ExportImportModal.jsx)): Export entire spaces or individual notes into portable JSON `.socratic` packages.
- **Multi-Format Note Export**: Export notes to styled **PDF** (with KaTeX math equation rendering and code block preservation), **Word Document** (`.docx`), **HTML Web Page** (`.html`), **Plain Text** (`.txt`), or **Markdown** (`.md`).
- **Drag-and-Drop Import**: Drag and drop `.socratic`, `.json`, `.docx`, `.html`, `.txt`, or `.md` files directly into target spaces.

### 🗑️ 8. 24-Hour Soft-Delete Trash, Custom Spaces & Privacy Settings
- **24-Hour Auto-Purge Trash** ([`Sidebar.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/Sidebar.jsx)): Soft-delete notes into a Trash drawer with automatic 1-minute interval background purging for notes older than 24 hours. Features individual and batch recovery controls.
- **Password-Protected Spaces**: Encrypt spaces with custom passwords to lock private study materials.
- **Graphics & Privacy Settings** ([`SettingsModal.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/Sidebar.jsx)): Personal Gemini API Key management (100% private IndexedDB storage), 3D graphics quality presets (*Auto*, *High*, *Medium*, *Low/Battery Saver*), target FPS (30/60/120), DPR pixel ratio scaling, and auto-pause when hidden.
- **Factory Reset Captcha**: Targeted table purging with randomized human math captcha verification.
- **First-Run Demo Content** ([`demoNotes.js`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/lib/demoNotes.js)): Ships with seeded notes covering eigenvectors, photosynthesis, Big-O notation, elasticity, memory science, and neural networks.

---

## 📂 Codebase Architecture

```
app/
  page.js                       Landing page (Server Component, CSS-only animations)
  workspace/page.js             Main SocraticOS application page (<Workspace />)
  visualizations/page.jsx       Standalone 3D visualizer studio page
  layout.js                     Root shell & pre-paint theme bootstrap script
  globals.css                   Site-wide CSS variables for Dark & Light themes, print rules
  api/
    explain/route.js            POST  Structured note explanation generator
    quiz/generate/route.js      POST  Diagnostic quiz builder
    quiz/grade/route.js         POST  Quiz grading & sub-topic heatmap emitter
    socratic/chat/route.js      POST  Socratic assistant chat dialogue & diagnostic
    socratic/widget/route.js    POST  Interactive 3D WebGL widget generator
    calendar/events/route.js    Local-first calendar events route fallback
    visualizations/route.js     Local-first 3D visualization persistence route
    reset/route.js              Local-first database factory reset route

components/
  Workspace.jsx                 Primary workspace layout container, HUD header & shortcuts
  Sidebar.jsx                   Spaces selector, note list, 24h trash drawer, Settings modal
  BlockNoteEditor.jsx           18 block types, slash menu (/), 6-dots handles, covers & stats
  NoteMenu.jsx                  Note options dropdown (Save, Favorite ⭐, Stats, Export, Delete)
  CommandPalette.jsx            Ctrl+K global fuzzy search modal
  InstantNoteModal.jsx          Ctrl+I 75% screen quick note capture window
  CalendarView.jsx              Study schedule calendar & recurring alarm scheduler
  GlobalTimerHUD.jsx            Unified top HUD multi-timer manager
  PinnedTimersOverlay.jsx       Floating picture-in-picture timers overlay
  AlarmOverlay.jsx              Fullscreen alarm modal & dynamic browser tab favicon/title swap
  ThreeDView.jsx                3D visualization studio container & control HUD
  WidgetCanvas.jsx              Interactive Socratic 3D canvas widget renderer
  ExplainPanel.jsx              Structured LLM explanation drawer
  QuizPanel.jsx                 Graded quiz & Socratic Rubber Duck dialogue drawer
  ConfidenceHeatmap.jsx         Per-session sub-topic confidence heatmap
  MasteryDashboard.jsx          Aggregate topic mastery analytics dashboard
  ExportImportModal.jsx         .socratic, PDF, DOCX, HTML, TXT & MD export/import modal
  SetPasswordModal.jsx          Space password lock configuration modal
  EnterPasswordModal.jsx        Space password unlock challenge modal
  FeatureRequestModal.jsx       User feedback & feature request submission modal
  visualizations/
    PhysicsCanvas.jsx           Gas laws, optics, induction, refraction, motor effect engines
    ChemistryCanvas.jsx         Organic builder, lattices, electrolysis, distillation, Bohr atom
    BiologyCanvas.jsx           Cell explorer, DNA double helix, enzyme lock-and-key engines
    BinaryTree3D.jsx            3D binary search tree / AVL tree engine
    cell-organelles.jsx         Procedural 3D organelle geometry models
    VisualizationHUD.jsx        3D controls overlay & quiz dialogs
    scene-kit.jsx               Shared Three.js lighting, camera, grid & label helpers
    media.js                    Refractive index presets and optical material properties

lib/
  db.js                         Dexie.js IndexedDB storage client (v4) & hardware graphics detection
  storageService.js             Dexie CRUD service for notes, trash, calendar, alarms, sessions
  aiService.js                  Client-side AI orchestrator for Gemini API & personal API keys
  gemini.js                     Direct REST Gemini client with OpenAPI 3.0 schemas
  schemas.js                    Structured Gemini JSON response schemas
  exportImport.js               PDF, Word (.docx), HTML, TXT & Markdown converters
  backup.js                     .socratic JSON workspace & space backup packager
  timerStore.js                 Reactive global multi-timer store
  mastery.js                    Mastery scoring & sub-topic rollup algorithms
  syntaxHighlighter.js          Tokenization & syntax highlighting for 10 programming languages
  demoNotes.js                  Seeded demonstration study notes
  blocks.js, blockMapping.js    BlockNote document transformation & extraction utilities

scripts/
  check-block-mapping.mjs       Unit test for DB <-> Editor block transformations
  test-inlinemath-roundtrip.mjs Unit test for in-sentence LaTeX math export/import round-trips
```

---

## 🎨 Design System & Aesthetics

- **Theme Tokens**: Dark Mode (*Sleek Slate* `#12151e`) and Light Mode (*Warm Stone* `#eef2f6`) configured via dynamic CSS variables on `data-theme`.
- **Surfaces & Accents**: Primary background (`bg-ink-950`), cards (`bg-ink-900`), inputs (`bg-ink-850`), primary accent duck gold (`text-duck-300`, `bg-duck-500/20`), delete controls (`text-rose-400`, `bg-rose-500/15`).
- **Modal Layering & Stacking Context**: Stacking tiers (`z-[100]`, `z-[9999]`) prevent 3D canvas labels from bleeding into modal dialogs.

---

## 🛡️ Offline-First & Privacy Architecture

- **IndexedDB via Dexie.js**: Primary user data resides locally in the browser (`SocraticOS_LocalDB`).
- **Graceful Cloud Route Resiliency**: All API endpoints support local-first operation (`200 { success: true, offline: true, localFirst: true }`), enabling uninterrupted offline editing.
- **Client-Side API Key Storage**: Personal Gemini API keys are saved exclusively in IndexedDB (Dexie) and never transmitted to external servers.

---

## 🧪 Test Suite & Verification

```bash
# Run all unit test suites
npm test
```
