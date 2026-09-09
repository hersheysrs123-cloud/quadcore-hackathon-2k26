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
- **19 Block Types Supported**: Text, Heading 1 (`h1`), Heading 2 (`h2`), Heading 3 (`h3`), Heading 4 (`h4`), Bullet List (with multi-level sub-bullet nesting), Numbered List (dynamic sequential & hierarchical indexing `1.`, `2.` with sub-bullets `a.`, `b.`, `c.`, etc.), To-Do List (interactive checkboxes with strikethrough), Toggle List (collapsible arrow `▶`/`▼` with auto-expanding details textarea and interactive status toggle badge), Callout Box (with 8 icon presets), Multi-Column Layout Block (`columns` 2 to 5 columns split layout with dynamic column count selector pills), Table (interactive grid table with streamlined Notion header, dynamic cell editing, `+ Column`/`+ Row`, delete row/col, and `Tab` navigation), Quote (thick accent border), LaTeX Math Equation block (live KaTeX rendering, quick Presets toggle & symbols tray), Inline LaTeX Equation (`inlinemath` clear Notion-style `$formula$`), Divider (`hr`), Site Bookmark Embed (clickable card with live favicon), Media & YouTube Video Embed (Images and YouTube video players with 16:9 responsive embeds, timestamp support & **`25%` / `50%` / `100%` width resize presets**), and Code Snippet (10-language syntax highlighting).
- **Hierarchical Sub-Bullets & Multi-Level Lists (Bullets & Numbers)**:
  - `Tab`: Indent active bullet or numbered item (empty or with content) to a sub-bullet (`level = level + 1`, up to level 4).
  - `Shift+Tab`: Outdent item (`level = level - 1`). If unindented at level 0 while empty, converts into a normal paragraph text block.
  - `Enter`: Pressing Enter on an empty sub-bullet unindents by 1 level before exiting; pressing Enter on a populated item inherits the current level.
  - `Backspace`: Pressing Backspace at offset 0 (or on an empty item) unindents by 1 level or converts to plain text.
  - **Hierarchical Numbering Sequence**: Level 0 renders decimal numbers (`1.`, `2.`), Level 1 renders lowercase letters (`a.`, `b.`) with `1.5rem` indent, Level 2 renders lowercase Roman numerals (`i.`, `ii.`) with `3.0rem` indent, and Level 3+ renders uppercase letters (`A.`, `B.`) with `4.5rem+` indent.
  - **Hierarchical Bullet Glyphs**: Level 0 renders a solid filled circle (`●`), Level 1 renders a hollow ring (`○`) with `1.5rem` indent, Level 2 renders a solid square (`■`) with `3.0rem` indent, and Level 3+ renders a hollow square with `4.5rem+` indent.
- **Notion-Grade Heading & Bullet Downward Flow**:
  - Pressing `Enter` at the start of any heading (`h1`–`h4`) creates a new blank paragraph above and shifts the heading and all following blocks downward, maintaining caret focus on the heading (Notion behavior).
  - Pressing `Enter` at the start of any bullet (`bullet`) or numbered item (`number`) with content (specifically the first bullet in a list) prepends an empty list item above and shifts the current item and downstream blocks down, maintaining caret focus at the start of the item on the next line.
- **Deeply Cloned History & Smart Focus Undo/Redo Engine**: Centralized immutable snapshot pipeline (`pushHistorySnapshot`) across all 19 block mutations, atomic block splitting on `Enter`, and intelligent neighboring focus resolution on both Undo and Redo (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`), completely preventing cursor loss or jumps to block 0.
- **Multi-Column Layout Block (`/2 columns` - `/5 columns`, `/split`, `/compare`)**: Dynamic 2 to 5 column split container for side-by-side concept comparisons (e.g. Mitosis vs Meiosis, Conductors vs Insulators, Cornell notes) with segmented column switcher pills (`[ 2 Cols ]` - `[ 5 Cols ]`), responsive grid cards, header titles, and auto-growing multi-line body.
- **Notion-Style Right-Side Outline (Minimap Ticks & Floating Card)**: Floating right-side outline panel with live `h1`–`h4` heading scanning, minimap dash strip with real-time scroll spy active-section tracking, and one-click smooth jumping with highlight ring pulse.
- **Inline Image & Video Resize Presets**: Width toggle pills (`25%`, `50%`, `100%`) for balanced diagram and video embedding into text flow.
- **External Smart Paste & Google Docs Sanitizer**: Automatically converts pasted rich HTML from lecture slides, Google Docs, Notion, and web pages into structured blocks (preserving bold, italics, headings, lists, tables, and embeds) without DOM corruption or foreign style pollution.
- **In-Context Slash Menu (`/`)**: Typing `/` triggers a block-type selector directly underneath the active line, supporting quick filters like `/columns`, `/2 columns`, `/3 columns`, `/4 columns`, `/5 columns`, `/split`, `/compare`, `/youtube`, `/video`, `/math`, `/table`.
- **Draggable 6-Dots Handles (`⠿`) & Context Formatting**: Hovering blocks displays aligned delete (`🗑️`) and draggable `⠿` handles. Context popovers feature:
  - ✨ **Explain** / 🦆 **Quiz me** for that specific block.
  - **Inline Text Formatting**: Bold (`B`), Italic (`I`), Underline (`U`), Strikethrough (`S`), LaTeX Math ($x$).
  - 🔄 **Turn Into Submenu**: Convert block into any of the 20 block types.
  - 📋 **Duplicate Block**, ⬆️/⬇️ **Move Up/Down**, 📄 **Copy Content**.
- **Cover Banners**: Full horizontal width note headers with 5 gradient presets (*Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, *Socratic Gold*).
- **Custom Emoji Picker & Star Favorites (`⭐`)**: Assign note emojis and toggle star favorites to pin notes in the sidebar.
- **Real-Time Note Stats**: Live character count, word count, total block count, and estimated reading time aggregated across block text, toggle details, and LaTeX formulas.
- **Auto-Note Instantiation & Click-to-Append**: Typing inside an empty space automatically instantiates a new note; clicking blank space below blocks appends a new paragraph.


### 🔍 2. Universal Navigation, History & Instant Capture
- **In-Memory Keyboard Navigation History (`Alt + ←` / `Alt + →`)**: Instant back-and-forth traversal between recently visited notes across spaces, with visual `◀` / `▶` breadcrumb controls in the top bar.
- **Command Palette (`Ctrl+K` / `Cmd+K`)**: Fuzzy-search notes across all spaces, open workspace tabs (Notes, Calendar, 3D Studio, Mastery Dashboard), or open settings.
- **Multi-Note Selection & Bulk Operations Suite**: Select multiple notes one-by-one with an inline "Select" toggle in the notes list header. Provides live count badges, Select All / Deselect All, and a 4-action bulk toolbar: **Star/Unstar** in bulk, **Duplicate** all selected notes (titled "Copy of [note name]"), **Move** all to any destination space, and **Delete to Trash** with a mandatory safety confirmation modal.
- **Quick Save (`Ctrl+S`)**: Explicit keyboard shortcut to instantly save notes.

### ⚙️ 3. Space Hub & Per-Space Curriculum Management
- **Dedicated Full-Page Dashboard**: Accessible via the prominent `⚙️ Space Hub` button directly below the Spaces selector in the sidebar.
- **Multiple Documents per Space**: Upload multiple curriculum documents (`.pdf`, `.docx`, `.txt`, `.md`) such as official syllabus specifications, exam boundaries, lecture schedules, and formula sheets.
- **Active for AI Toggles**: Toggle switches per document control exactly which curriculum files are active and injected into the AI context for quiz generation, grading, and Socratic dialogues.
- **Per-Space AI Pedagogy Settings**:
  - **Academic Standard / Grade Level**: General, IGCSE / O-Level, IB Diploma (HL/SL), AP / College Board, University, Olympiad.
  - **AI Examiner Persona**: Standard Examiner, Strict Examiner, Socratic Guide, Friendly Coach, Olympiad Mentor.
  - **Distractor Toughness & Rigor**: Relaxed, Standard, High Rigor.
  - **Custom Space Identity**: Space icon emoji and descriptive tagline.
- **1-Click Subject Presets**: Rapidly load Cambridge IGCSE Gr.10, IB Diploma HL, AP College Board, or Foundational mastery presets.

### 🧑‍🏫 4. Interactive AI Tutor Doubt-Clearing Suite
- **Omnipresent Doubt Clearing**: Access anytime via the `🧑‍🏫 AI Tutor` top header button in the workspace HUD.
- **Full Space Curriculum Feeding**: Fed with all active curriculum documents (`Fed to AI`) from the active space.
- **Syllabus & Standard Calibrated**: Injects the active space's academic standard (IGCSE, IB HL, AP, College, Olympiad) and selected persona (Strict, Socratic, Coach, Mentor).
- **Active Note Context Awareness**: Grounds answers in the active note's text to explain what the student is currently writing or reading.
- **Rich Markdown, Tables & Syntax Highlighting**: Full Markdown decomposition (`MarkdownRenderer.jsx`) supporting structured headings, numbered/bullet lists, markdown tables, blockquotes, and fenced code blocks with 10-language syntax highlighting and 1-click code copying.
- **Native LaTeX Math Formatting**: Real-time KaTeX rendering for complex chemical formulas, physics integrals, and step-by-step mathematical derivations.
- **Quick Doubt Starters**: 1-click query pills for step-by-step derivations, common exam traps, and real-world intuition.

### 🧪 5. Interactive 3D Visualization Studio
A comprehensive suite of 25 real-time interactive 3D STEM simulations built using Three.js, `@react-three/fiber`, and custom WebGL Canvas engines with live calculated Details and complete Visual Color Keys:

- ⚛️ **Physics Engine** ([`PhysicsCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/PhysicsCanvas.jsx)):
  - **Wave Refraction & Snell's Law**: Multi-medium ray tracing (Air, Water, Glass, Diamond, Perspex), critical angle, total internal reflection, and Fresnel reflection rays.
  - **Motor Effect & Fleming's Left-Hand Rule**: Magnetic flux lines, current conductors, Lorentz force vectors, and Fleming's left-hand rule.
  - **Thin Lens Optics & Ray Diagrams**: Convex/concave lenses, focal length controls, real/virtual images, and principal ray tracing.
  - **Electromagnetic Induction**: Faraday/Lenz's law, rotating copper coils, magnetic pole blocks, induced AC current pulses, and real-time EMF waveform trace.
  - **Kinetic Gas Laws ($PV=nRT$)**: Kinetic particle container with collision vectors, temperature/volume controls, and pressure gauge readouts.
  - **2D Projectile Motion**: Ballistic trajectory with quadratic air resistance, ideal parabola comparison, and velocity/weight vectors.
  - **Wave Interference & Double Slits**: Two-source wave interference ripples, coherent slit emitters, double-slit barrier, and screen intensity fringe maxima.
  - **Keplerian Orbits & Gravity Wells**: Gravitational spacetime potential well ($-GM/r$), central massive body, and orbiting satellites.

- 🧪 **Chemistry Engine** ([`ChemistryCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/ChemistryCanvas.jsx)):
  - **Bohr Atom & Emission Spectra**: Quantized electron shells, core/valence electrons, and photon emission spectral wave packets.
  - **Organic Chemistry Builder**: 6 homologous series (Alkanes, Alkenes, Alkynes, Alcohols) with carbon backbone, hydrogen, oxygen, single sigma, and double/triple pi bonds.
  - **Fractional Distillation**: Multi-stage fractionating column, crude oil boiling point gradient, and color-coded petroleum fractions.
  - **3D Crystal Lattices**: Giant lattices: Sodium Chloride ($\text{NaCl}$), Diamond ($sp^3$), Graphite ($sp^2$ layers with delocalised electrons), Quartz ($\text{SiO}_2$), and Ice ($\text{H}_2\text{O}$).
  - **Electrolysis**: Beaker electrolyte bath, cathode reduction plating, anode oxidation dissolution, and rising gas bubble particle streams.
  - **VSEPR Molecular Geometry**: Steric numbers 2–6, central atom, bonded ligands, non-bonding lone pair electron clouds, and bond angle arcs.
  - **Reaction Energetics & Catalysis**: Exothermic/endothermic energy profile curves, transition states, forward/reverse activation energy $E_a$, enthalpy change $\Delta H$, and catalysed pathways.

- 🧬 **Biology Engine** ([`BiologyCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/BiologyCanvas.jsx) & [`RespiratoryCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/RespiratoryCanvas.jsx)):
  - **Respiratory Mechanics & Thoracic Physics**: Genuine clinical CT-derived thoracic skeleton (`skeleton_ct.glb`; isolated 24 ribs, T1–T12 vertebrae, L1–L3 crura anchors, sternum, and clavicles) with bucket-handle and pump-handle breathing kinematics, photorealistic medical lungs scan (`lung.glb`), multi-layer antagonistic intercostal muscle bands spanning all 11 intercostal spaces (superficial external $+35^\circ$ vs deep internal $-45^\circ$ layers with layer isolation) with active scarlet vs relaxed deep crimson tension shaders, muscular diaphragm dome flattening dynamically ($Y = 1.05 \to 0.63$) with trifoliate central tendon (*centrum tendineum*), 3 anatomical apertures (Caval T8, Esophageal T10, Aortic T12), bilateral vertebral crura, Boyle's Law pressure gradients, dynamic airway particle vectors, 3-state phase selector, collapsible HUD, live SVG gauges, and an interactive **Open-Source Model Credits Suite** (`RESPIRATORY_MODEL_CREDITS`) detailing upstream MIT/AGPL licenses and direct links to upstream repositories.
  - **Plant & Animal Cell Explorer**: High-detail organelles (nucleus, mitochondria, chloroplasts, ER, Golgi, vacuoles, membrane, cell wall) with osmotic tonicity states.
  - **Enzyme Kinetics & Lock-and-Key Model**: Substrate binding, active catalytic cleft, thermal denaturation cliffs, and pH stress curves.
  - **DNA Double Helix**: Antiparallel sugar-phosphate backbones, major/minor grooves, and A-T / G-C complementary base pairing.
  - **Protein Secondary Structure & Folding**: $\alpha$-Helix (3.6 res/turn), $\beta$-Pleated Sheet, random coils, hydrophobic core packing vs hydrophilic surface residues, and thermal denaturation.

- 💻 **Computer Science 3D Engine** ([`CSCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/CSCanvas.jsx) & [`BinaryTree3D.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/BinaryTree3D.jsx)):
  - **3D Binary Search Tree / AVL Tree**: Interactive node insertion, searching, depth planes, traversal animations, and complete Visual Tree Keys.
  - **3D Sorting Algorithm Visualizer**: Bubble, Insertion, Selection, Quicksort, and Merge Sort with unsorted bars, comparison highlights, swap transitions, and sorted states.

- 📐 **Mathematics 3D Engine** ([`MathCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/MathCanvas.jsx)):
  - **3D Gradient Descent Optimization**: Topographic loss surfaces (Bowl, Saddle, Rosenbrock Valley, 4-Well Landscape), negative gradient $-\nabla f$ descent vectors, and optimization trails.
  - **Solids of Revolution & Integral Calculus**: 2D generating curves $r(y)$, Riemann approximating cylindrical discs $\pi r^2 \Delta y$, true solid shells, and rotation axes.
  - **Trigonometric Unit Circle & Wave Synthesis**: Unit circle orbital motion $(x, y) = (\cos\theta, \sin\theta)$, projected sinusoidal time traces, and Fourier square wave harmonic synthesis with Gibbs overshoot.

- 🧭 **Dual-Tab HUD, Speed Control & Authoritative Visual Keys** ([`VisualizationHUD.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/visualizations/VisualizationHUD.jsx)):
  - **Universal Animation Speed Slider**: Placed prominently directly below the Controls vs Details tab switcher on all 24 scenes (including Binary Search Trees) for instant $0.1\times$ to $3.0\times$ pacing control.
  - Parameter controls, camera resets, category filters, and Socratic Quiz drawer.
  - Live **Details** tab with live calculated scientific state metrics, formula subtitles, and complete **Visual Keys** (color legends) documenting every line, ray, vector, and object in the scene.

### ⏱️ 4. Unified Multi-Timer HUD & Calming Study Break Alerts
- **Unified Global Timer HUD** ([`GlobalTimerHUD.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/GlobalTimerHUD.jsx)): Header dropdown managing Pomodoro Focus (25m), Short Break (5m), Long Break (15m), and custom duration timers simultaneously with live countdown rings and play/pause controls.
- **Study Calendar & Schedule** ([`CalendarView.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/CalendarView.jsx)): Event scheduling, month navigation, space tagging, 24-hour time picker, and custom recurring alarm integration.
- **Calming Study Break & Timer Alert** ([`AlarmOverlay.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/AlarmOverlay.jsx)): Glassmorphic modal alert (`✨ ☕ 🌱`) with harmonic C-major triad chime synthesis, dynamic browser tab indicator (`🦆` $\leftrightarrow$ `☕`), and friendly snooze/extend controls.

### 🦆 5. Socratic AI Tutor, Explain, Reformat & 3D Interactive Widgets
- **AI Explain (`POST /api/explain`)**: Returns structured note breakdowns containing TL;DR summaries, ordered mechanism steps, analogies with explicit limitations, common misconceptions, worked examples, and check-yourself questions.
- **Diagnostic Quiz Drawer (`components/QuizPanel.jsx`)**: Dedicated quiz assessment sidebar for active notes and selections, evaluating understanding through dynamic questions and recording session scores directly into the mastery analytics store.
- **3D Socratic Canvas Widgets (`POST /api/socratic/widget` & [`WidgetCanvas.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/WidgetCanvas.jsx)): Generates interactive 3D concept widgets with drag-orbit controls, custom sliders, camera zoom, and sub-topic gap repair hints.


### 📊 6. Graded Quizzes, Quizzes Studio & Sub-Topic Mastery Heatmap
- **Dedicated Quizzes Studio & Custom AI Quiz Creator** ([`QuizStudioView.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/QuizStudioView.jsx) & [`CreateQuizModal.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/CreateQuizModal.jsx)):
  - **Multi-Note Selection**: Interactive combobox with live search filtering, "Select All" / "Clear" buttons, per-note checkboxes, selection count badges, and removable chips.
  - **Multi-Source AI Synthesis**: Feeds multiple notes into Gemini with structured section demarcations (`=== Source Note: "<Title>" ===`), creating diagnostic exams that synthesize cross-note relationships, comparisons, and mechanisms.
  - **Cross-Note Heading Scope**: Automatically extracts and scopes questions to specific headings (H1–H4) across multiple selected notes with note source attribution.
  - **Multi-Note Quiz Cards & Interactive Navigation**: Interactive quiz cards show multi-source badge indicators (`📚 X notes`) with quick-jump navigation links into each source note.
  - **Deletion Confirmation Modal**: Accessible confirmation dialog (`DeleteQuizConfirmModal`) guarding against accidental deletion when trashing quizzes, permanently deleting items, or emptying the 24-hour trash bin.
  - **Cambridge IGCSE Grade 10 Math & STEM Question Suite**:
    - **7 Supported Question Types**: Multiple Choice, Multi-Select ("Select all that apply"), Value Input (exact numerical/algebraic formula with virtual math symbol keyboard and live KaTeX preview), Code Input (inbuilt editor with Tab 2-space indentation and language tags), Step Ordering (Parsons problem scrambled proofs & derivations), Short Answer, and Long Essay.
    - **Virtual Math Symbol Keyboard & Live KaTeX Preview**: Real-time formula entry with quick symbol insertion (`\frac{a}{b}`, `\sqrt{x}`, `x^2`, `\pi`, `\pm`, `\theta`, `\le`, `\ge`, `\approx`, `\infty`, `\times`, `\div`, `^\circ`) for students unfamiliar with raw LaTeX.
    - **Inbuilt Code Editor**: Interactive code writing environment with Tab key 2-space indentation interception, language badging, and starter code.
    - **Parsons Problem Step Ordering**: Interactive proof/derivation cards with ▲/▼ reordering controls and auto-scrambling.
    - **1-Click STEM Presets**: Instant configuration presets: 🎓 *IGCSE Gr.10 STEM*, 🧮 *Pure Math & Derivations*, 💻 *Computer Science*, and ⚡ *Quick 5 MCQ*.
  - **Redesigned Decluttered Quiz Runner**: Split-screen 2-column layout offering an expansive, distraction-free Q&A canvas (`max-w-4xl`) on the left and a dedicated Control & Navigation Station on the right (`w-80 lg:w-88`), equipped with an interactive 5-column question palette matrix, prominent next/skip/submit buttons, instant answer clearing (`Eraser`), and keyboard hotkey navigation (`ArrowLeft`/`ArrowRight`, `A`-`D`/`1`-`4`).
  - **Live Quiz Progress Auto-Saving & Resumption**: Continuous real-time auto-saving of answers and question index to IndexedDB on every option click, debounced text answer, and question navigation. In-progress quizzes display a `⏳ In Progress (X/Y)` badge and one-click "Resume Quiz" action, while the runner header features a live `✓ Progress saved` indicator.
  - **Zero-Lag Quiz Creator Interface**: Isolated slider components (`React.memo`), throttled pointer event tracking, $O(1)$ heading selection index, and non-blocking background evaluation ensure fluid 60/120fps quiz configuration even with hundreds of notes and section headings.
  - **LaTeX & Chemical Formula Typesetting**: Full inline and block KaTeX rendering (`MathText.jsx`) for physics/chemistry equations (`$E = mc^2$`, `\frac{a}{b}`) and chemical formulas (`\text{H}_2\text{SO}_4`, `\rightarrow`) across question prompts, options, rubrics, and review diagnostics.
- **Diagnostic Quiz Builder & Hybrid Grading Engine (`POST /api/quiz/generate` & `/grade`)**: Builds customizable quizzes from notes across all 7 types. Performs deterministic objective grading for multiple choice, multi-select set equality, step ordering sequences, and numerical value inputs within tolerance ($\pm \delta$), alongside LLM mechanism evaluation for code solutions and short answers with full multi-note rubric context and custom diagnostic review diffs.
- **AI Note Reformatter Visual Feedback**: Triggering "Reformat Note (AI)" displays active button loading states and a prominent top-center floating glassmorphic status banner with animated sparkles and live progress text.
- **Space-Scoped Mastery Analytics Dashboard** ([`MasteryDashboard.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/MasteryDashboard.jsx)): Consolidates session scores into topic heatmaps grouped by note, tracking sub-topic mastery over time (**Solid** `●` / **Shaky** `◐` / **Gap** `○`) with weakest-first study recommendations. Features an integrated Space Switcher dropdown to isolate progress per subject space or inspect an aggregated `All Spaces` view, with non-destructive session retention and space-safe history clearing.

### 🔖 8. Local-First Website Saver & Folder Manager
- **Website Bookmarking & Folder Trees** ([`WebSaverView.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/WebSaverView.jsx)): Save study links, lecture slides, research papers, and developer tools organized into collapsible folder hierarchies per space.
- **Dual-Pane UI**:
  - **Left Sidebar**: Expandable folder tree with parent/child folders, "All Bookmarks" & "Unorganized" filters, inline new folder modal, rename/delete context triggers, and drag-and-drop target support.
  - **Main Viewport**: Search bar with real-time matching across titles, URLs, domains, tags, and personal notes; tag filter chips; sorting options (Newest, Oldest, Title A-Z, Domain); and view toggles (Grid Cards vs Compact List).
- **Favicon & URL Normalization** ([`urlUtils.js`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/lib/urlUtils.js)): Automated protocol normalization (`https://`), domain extraction, high-resolution Google favicon resolution, and title heuristic extraction.
- **Netscape HTML Bookmarks Import & Export** ([`exportImport.js`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/lib/exportImport.js)): One-click import and export of standard Netscape HTML bookmarks files (`<!DOCTYPE NETSCAPE-Bookmark-file-1>`), compatible with Chrome, Firefox, Safari, Edge, Arc, and Brave.
- **Quick Add Bookmark Modal** ([`AddBookmarkModal.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/AddBookmarkModal.jsx)): Instant URL paste, live favicon preview, folder selector, tag management with chip badges, and keyboard shortcuts (`Escape` closes, `Ctrl+Enter` saves).

### 📦 9. Multi-Format Export, Import & Backup Engine
- **Workspace & Space Backups (.socratic)** ([`ExportImportModal.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/ExportImportModal.jsx)): Export entire spaces, folders, bookmarks, and individual notes into portable JSON `.socratic` packages.
- **Netscape HTML Bookmarks (`.html`)**: Export space-filtered or complete bookmarks into browser-compliant HTML bookmark collections with tags and notes.
- **Multi-Format Note Export with Pre-Download Preview** ([`ExportPreview.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/ExportPreview.jsx)): Preview files before downloading for **Word Document** (`.docx`), **HTML Web Page** (`.html`), **Plain Text** (`.txt`), and **Markdown** (`.md`). Features authentic Microsoft Word sheet layouts with heading colors, browser mockup frames with dynamic auto-height sandbox iframes & embedded KaTeX math formulas, monospace text editors, dedicated full-document scroll container with wheel forwarding, and rendered/source code view toggles. **PDF** directly launches the native browser print preview dialog (`window.print()`).
- **Drag-and-Drop Import**: Drag and drop `.socratic`, `.json`, `.docx`, `.html` (notes and browser bookmarks), `.txt`, or `.md` files directly into target spaces.

### 🗑️ 10. 24-Hour Soft-Delete Trash, Custom Spaces & Privacy Settings
- **24-Hour Auto-Purge Trash** ([`Sidebar.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/Sidebar.jsx)): Soft-delete notes into a Trash drawer with automatic 1-minute interval background purging for notes older than 24 hours. Features individual and batch recovery controls.
- **Graphics & Privacy Settings** ([`SettingsModal.jsx`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/components/Sidebar.jsx)): Personal Gemini API Key management (100% private IndexedDB storage), 3D graphics quality presets (*Auto*, *High*, *Medium*, *Low/Battery Saver*), target FPS (30/60/120), DPR pixel ratio scaling, and auto-pause when hidden.
- **Factory Reset Verification**: Targeted table purging with typed `RESET` double-confirmation safety verification.
- **First-Run Demo Content** ([`demoNotes.js`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/lib/demoNotes.js)): Ships with seeded notes and curated study resource bookmarks (3Blue1Brown, Desmos, MDN, MIT OCW, arXiv).

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
  BlockNoteEditor.jsx           19 block types, slash menu (/), 6-dots handles, covers & stats
  WebSaverView.jsx              Dual-pane Web Saver & Bookmark folder manager with Netscape HTML support
  AddBookmarkModal.jsx          Instant bookmark capture modal with live favicon preview
  NoteMenu.jsx                  Note options dropdown (Favorite ⭐, 3-Font Typography, Stats, Export, Delete)
  CommandPalette.jsx            Ctrl+K global fuzzy search modal
  InstantNoteModal.jsx          Ctrl+I 75% screen quick note capture window
  CalendarView.jsx              Study schedule calendar & recurring alarm scheduler
  GlobalTimerHUD.jsx            Unified top HUD multi-timer manager
  AlarmOverlay.jsx              Calming study break alert modal with gentle chime
  ThreeDView.jsx                3D visualization studio container & control HUD
  WidgetCanvas.jsx              Interactive Socratic 3D canvas widget renderer
  ExplainPanel.jsx              Structured LLM explanation drawer
  QuizPanel.jsx                 Graded quiz drawer & knowledge assessment runner
  ConfidenceHeatmap.jsx         Per-session sub-topic confidence heatmap
  MasteryDashboard.jsx          Aggregate topic mastery analytics dashboard
  ExportImportModal.jsx         .socratic, HTML Bookmarks, PDF, DOCX, HTML, TXT & MD export/import modal
  ExportPreview.jsx             Pre-download document preview for Word (.docx), HTML, Plain text & Markdown
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
  db.js                         Dexie.js IndexedDB storage client (v5) & hardware graphics detection
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
  blocks.js                     BlockNote document transformation & extraction utilities

tests/
  unit/                         Physics solvers, AVL tree, export/import, mastery rollup, quiz grading, timers, syntax, tables
  integration/                  3D topic schemas, AI widget normalizer, 24h trash purge, Dexie backup/restore
  e2e/                          Keyboard shortcuts (Ctrl+K/I/S), block editor flow, theme toggle, export & print

scripts/
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
