# SocraticOS — Comprehensive Codebase Summary & Handover Guide

> **To any AI Assistant or Developer taking over**: 
> This document provides an exhaustive, authoritative technical overview of **SocraticOS** (`quadcore-hackathon-2k26`). It explains the architecture, local-first IndexedDB storage model, UI component hierarchy, 19-block note editor, 27-topic 3D scientific simulation studio across 5 STEM domains, AI tutoring & diagnostic quiz engines, multi-timer HUD system, export/import engine, design system tokens, and operational gotchas.

---

## 📌 1. Executive Summary & Tech Stack

**SocraticOS** is an intelligent, Notion-inspired learning operating system and 3D scientific visualization studio built on one fundamental principle: **rereading is not studying**. The application pairs rich block-based note-taking with interactive real-time 3D models, structured AI explanations, diagnostic quizzes across 7 question types, an interactive space-grounded AI Tutor, multi-timer HUDs, website bookmarking with folder hierarchies, and an aggregate mastery heatmap tracking sub-topic confidence over time.

### Tech Stack:
- **Framework**: Next.js 15.0.0 (App Router, Turbopack / Webpack build engine)
- **UI & Logic**: React 19 (Server & Client Components), Tailwind CSS v4 (`@tailwindcss/postcss`, dynamic CSS variable design tokens)
- **Database & Storage**: Local-first IndexedDB via **Dexie.js** (`SocraticOS_LocalDB` v7) — 100% offline, private, zero-latency browser storage for notes, trash, calendar events, study sessions, alarms, folders, bookmarks, quizzes, quiz trash, space documents, and graphics settings
- **AI Integration**: Direct **Google Gemini API** (`lib/gemini.js` with OpenAPI 3.0 schema enforcement) + Client-side Dexie API Key storage with fallback to `/api/` server routes (`app/api/explain`, `app/api/quiz/generate`, `app/api/quiz/grade`, `app/api/reformat`, `app/api/tutor/chat`). `lib/aiService.js` provides isomorphic client/server AI orchestration
- **3D Engine**: Three.js (r185), `@react-three/fiber` (v9), `@react-three/drei` (v10), custom Canvas engines with OrbitControls, procedural & clinical CT geometry, and WebGL lifecycle memory management
- **Math & Equation Engine**: KaTeX (`katex`) for full block and in-sentence `$formula$` inline math rendering
- **Document & File Conversion**: `docx` + `mammoth` (MS Word generation & parsing), HTML/Markdown/Plain-Text lossless conversion, Netscape Bookmark standard HTML import/export, `.socratic` JSON workspace backup format
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
│   │   ├── reformat/route.js             # POST: Intelligent note reformatting & block structuring generator
│   │   ├── reset/route.js                # POST: Local-first factory reset signal route
│   │   ├── tutor/chat/route.js           # POST: Interactive AI Tutor chat with space syllabus and academic pedagogy
│   │   └── visualizations/route.js       # Local-first 3D visualizations persistence route
│   ├── error.jsx                         # App Router root error boundary
│   ├── global-error.jsx                  # App Router HTML/root error boundary
│   ├── globals.css                       # Tailwind v4 tokens, light/dark themes, print stylesheet, KaTeX styles
│   ├── layout.js                         # Root layout, metadata & pre-paint theme bootstrap script
│   ├── not-found.jsx                     # App Router 404 not found page
│   ├── page.js                           # Marketing landing page (Server Component, CSS-only animations)
│   ├── visualizations/
│   │   └── page.jsx                      # Standalone 3D visualizer page with TopicSelectorDropdown, clean single header, & control HUD
│   └── workspace/
│       └── page.js                       # Main application page (renders <Workspace />)
├── components/
│   ├── AITutorPanel.jsx                  # Interactive AI Tutor drawer: real-time doubts, LaTeX math, quick prompts & space context
│   ├── AddBookmarkModal.jsx              # Quick add/edit bookmark modal with instant URL normalization & live favicon
│   ├── AlarmOverlay.jsx                  # Calming glassmorphic study break modal with gentle chime & snooze controls
│   ├── BlockNoteEditor.jsx               # 19-block Notion-style editor with slash menu, 6-dots handles, covers & stats
│   ├── CalendarView.jsx                  # Study schedule calendar, month navigation, agenda, Pomodoro integration & alarms
│   ├── CommandPalette.jsx                # Ctrl+K global fuzzy search modal for notes, bookmarks, views, and settings
│   ├── ConfidenceHeatmap.jsx             # Per-session sub-topic confidence heatmap (Solid / Shaky / Gap)
│   ├── CreateQuizModal.jsx               # Custom AI Quiz creator modal (difficulty, 7 question types, multi-note scope)
│   ├── Drawer.jsx                        # Non-blocking persistent side-by-side study sidebar container for Explain, Quiz & AI Tutor
│   ├── ExplainPanel.jsx                  # Structured LLM explanation sidebar (TL;DR, mechanism, analogies, misconceptions)
│   ├── ExportImportModal.jsx             # Multi-format export/import modal (.socratic, HTML Bookmarks, PDF, DOCX, HTML, TXT, MD)
│   ├── ExportPreview.jsx                 # High-fidelity document export preview for Word (.docx), HTML (.html), Plain Text (.txt), and Markdown (.md)
│   ├── FeatureRequestModal.jsx           # User feedback & feature request submission modal
│   ├── GlobalTimerHUD.jsx                # Unified header multi-timer dropdown with Pomodoro, breaks & custom timers
│   ├── InstantNoteModal.jsx              # Ctrl+I 75% screen quick note capture window with space selection
│   ├── InteractiveTutorial.jsx           # 9-chapter interactive onboarding walkthrough modal with live sandboxes & shortcuts
│   ├── MarkdownRenderer.jsx              # Universal rich Markdown renderer (headings, syntax-highlighted code, KaTeX math, tables, lists)
│   ├── MasteryDashboard.jsx              # Space-scoped topic mastery analytics dashboard, interactive space switcher & study recommendations
│   ├── MathText.jsx                      # Universal KaTeX LaTeX & chemical formula renderer for quiz prompts, options & rubrics
│   ├── NoteMenu.jsx                      # Note action menu (Favorite ⭐, 5 Typography Fonts, Note Stats, Full Width, Lock Page, Export/Import, Delete)
│   ├── QuizPanel.jsx                     # Study sidebar drawer: Dynamic AI diagnostic quiz runner, assessment evaluator & mastery tracker
│   ├── QuizStudioView.jsx                # Dedicated Quizzes Studio tab: 2-column exam runner, review reports, draft auto-save, trash management
│   ├── ScoreRing.jsx                     # Animated SVG score dial with status coloring
│   ├── Sidebar.jsx                       # Spaces selector (Grid & Dropdown views with EditSpaceModal), note list, multi-note bulk toolbar, 24h trash drawer, Settings modal & Typed RESET modal
│   ├── SpaceHubView.jsx                  # Dedicated Space Hub dashboard: per-space curriculum docs with active toggles, space renaming, 26 emoji presets & AI pedagogy settings
│   ├── ThreeDView.jsx                    # 3D studio container with 35 interactive scientific simulations across 5 STEM domains, TopicSelectorDropdown & resizable HUD
│   ├── WebSaverView.jsx                  # Dual-pane Website Saver & Folder Manager with drag-and-drop tree & grid/list views
│   ├── Workspace.jsx                     # Central workspace layout, top HUD header, space state & global shortcuts
│   └── visualizations/
│       ├── BiologyCanvas.jsx             # Cell explorer with organelle cutaways & enzyme kinetics
│       ├── ChemistryCanvas.jsx           # Bohr atom, organic builder C1-C12, distillation, lattices, electrolysis
│       ├── PhysicsCanvas.jsx             # Wave refraction, motor effect, thin lenses, induction, kinetic gas laws, projectile motion (quadratic drag solver, forward upright cannon, zero-Z-fight runway), gravity wells & orbital motion (symplectic leapfrog orbits, banked perimeter retaining rim lip & high-speed satellite containment) + dispatcher for split-out physics scenes
│       ├── EyeCanvas.jsx                 # Cutaway human eye: accommodation, pupil reflex & anatomy mode with resizable controls HUD
│       ├── ShadowLabCanvas.jsx           # Torch/object/screen bench; shadow painted onto the screen as a canvas texture with resizable controls HUD
│       ├── InclineFrictionCanvas.jsx     # Ramp free-body diagram, static/kinetic friction & velocity trace (speed-scaled)
│       ├── HookesLawCanvas.jsx           # Spring, ruler & slotted masses with live force-extension graph & dynamic harmonic bounce (speed-scaled)
│       ├── SimpleMachinesCanvas.jsx      # Class 1/2/3 levers & block-and-tackle with precision balance beam (metric ruler graduations, balance needle, deflection scale), elevated fulcrum & workbench boundary clamping (preventing bar dipping under base), authentic slotted mass hanger, lightened workbench base, calibrated proportional work bar graph (scaleMax) & stroke cycle (speed-scaled)
│       ├── RollerCoasterCanvas.jsx       # Drop, vertical loop & brakes with GPE/KE/thermal bar chart & coaster physics (speed-scaled)
│       ├── CircuitBoardCanvas.jsx        # 3D breadboard circuits, bulbs, resistors, meters & electron drift flow (speed-scaled)
│       ├── StaticElectricityCanvas.jsx   # Balloon, wool sweater, wall induction & Van de Graaff charge transfers (speed-scaled)
│       ├── BuoyancyCanvas.jsx            # Overflow can, measuring cylinder, spring scale & floating hull bobbing (speed-scaled)
│       ├── HeatTransferCanvas.jsx        # Conduction rods, convection currents/dye, & radiation plate/beam (speed-scaled)
│       ├── TopicSelectorDropdown.jsx     # Custom styled subject-separated 3D model selector dropdown with instant search, discipline quick-filters & dark ink styling
│       ├── force-diagram.jsx             # SHARED: free-body arrows on one force scale, GraphPanel, rolling traces, slope frames & speed integration
│       ├── charge-carriers.jsx           # SHARED: electron & charge flow paths, carrier instancing, charge signs
│       ├── energy-bars.jsx               # SHARED: energy/work column charts with Y-axis line & horizontal scale grid divisions, calibrated scaleMax (grouped + stacked total) & needle DialGauge
│       ├── cell-organelles.jsx           # Procedural 3D organelle geometry (nucleus, mitochondria, chloroplast, etc.)
│       ├── CSCanvas.jsx                  # Computer Science canvas dispatcher (BST / AVL tree and 3D sorting visualizer)
│       ├── MathCanvas.jsx                # Gradient descent on loss surfaces (smooth 60fps direct-ref tangent vector & non-occluded surface-subdivided trail), solids of revolution (flush 1.0 thickness & high-contrast gold/bronze layers), unit circle & Fourier series (multi-waveform Fourier synthesis, tangent geometry & 3D phase helix)
│       ├── media.js                      # Refractive index presets (air, water, glass, diamond, perspex)
│       ├── topic-options.js              # Presets and options for VSEPR, 3D sorting, surface functions, and revolution curves
│       ├── topics.js                     # Topic registry: category, controls schema, concepts & quiz for all 35 scenes with speed: 1 defaults
│       ├── scene-kit.jsx                 # Shared Three.js lighting, camera, grid, bounding box & label helpers
│       └── VisualizationHUD.jsx          # Resizable HUD control overlays, universal animation speed slider (0.1×–3×), camera reset & quiz overlays
├── lib/
│   ├── aiService.js                      # Isomorphic client-side AI service coordinating Gemini API & user keys
│   ├── backup.js                         # .socratic JSON workspace & space backup packager with folder/bookmark support
│   ├── blocks.js                         # Text extractors & concept mappers from blocks
│   ├── constants.js                      # Default SPACES definition (School, Personal, Misc, Journal)
│   ├── db.js                             # Dexie.js IndexedDB schema v7 (11 stores), auto-seeding & graphics detection
│   ├── demoNotes.js                      # 7 comprehensive seeded notes across all 4 spaces with full 19-block suites
│   ├── editorCaret.js                    # Notion-grade caret navigation, visual line calculations, inline math compilation & boundary traversal
│   ├── coasterEnergy.js                  # PURE PHYSICS: coaster track builder, energy budget, rail force & g-force
│   ├── exportImport.js                   # Full export/import engine for Netscape HTML Bookmarks, PDF, DOCX, HTML, MD, TXT
│   ├── eyeOptics.js                      # PURE PHYSICS: Gullstrand schematic eye, accommodation & pupil reflex
│   ├── hookesLaw.js                      # PURE PHYSICS: Hooke's law, elastic limit, plastic branch & permanent set
│   ├── inclineForces.js                  # PURE PHYSICS: weight resolution, static/kinetic friction & angle of repose
│   ├── shadowOptics.js                   # PURE PHYSICS: shadow magnification, umbra/penumbra bands & scene framing
│   ├── simpleMachines.js                 # PURE PHYSICS: lever classes, block-and-tackle, distance ratio vs MA
│   ├── gemini.js                         # Direct REST Gemini client with structured outputs & usage tracking
│   ├── mastery.js                        # Mastery status vocabulary (Solid ● / Shaky ◐ / Gap ○) & rollup algorithms
│   ├── mathUtils.js                      # LaTeX delimiter parsing & regex segmentation for MathText
│   ├── schemas.js                        # OpenAPI 3.0 schemas for Gemini structured outputs
│   ├── shadowOptics.js                   # Geometric shadow formation solver, bench constraints, umbra/penumbra & materials
│   ├── storageService.js                 # Dexie CRUD service for notes, folders, bookmarks, trash, calendar, alarms, quizzes, space documents & reset
│   ├── syntaxHighlighter.js              # Tokenizer & syntax highlighter for 10 programming languages
│   ├── timerStore.js                     # Reactive multi-timer store with localStorage sync & alarm events
│   ├── tutorialData.js                   # Authoritative registry of 9 onboarding tutorial chapters & 19 editor blocks
│   └── urlUtils.js                       # URL normalization, domain extraction, Google favicon generator & title heuristics
├── tests/
│   ├── unit/
│   │   ├── ai-tutor.test.mjs             # AI Tutor curriculum injection, academic pedagogy & doubt starter validation
│   │   ├── avl-tree-3d.test.mjs          # 3D BST & AVL auto-balancing tree math & traversals
│   │   ├── bullet-list-undo-redo.test.mjs # Bullet and list undo/redo history state machine, deep cloning & smart focus
│   │   ├── bullet-number-heading-fixes.test.mjs # Bullet/number list indentation, hierarchical sub-bullets & heading enter flow
│   │   ├── editor-marquee-click.test.mjs # Marquee multi-block selection and click-to-append boundary guards
│   │   ├── export-import.test.mjs        # Markdown, HTML, DOCX, TXT lossless round-trips & blob generation
│   │   ├── export-preview.test.mjs       # Interactive pre-download export preview formatting and scroll mechanics
│   │   ├── eye-optics.test.mjs           # Eye optical model: Gullstrand equivalent power, accommodation, and retina focus
│   │   ├── inline-math-navigation.test.mjs # Seamless block navigation, math pill boundary traversal & auto-compilation
│   │   ├── interactive-tutorial.test.mjs # 9-step tutorial metadata, 19-block registry, and interactive state tests
│   │   ├── markdown-bullets-formatting.test.mjs # Markdown nested bold/italic compiler and bullet prefix preservation
│   │   ├── mastery-analytics.test.mjs    # Mastery rollup algorithms, trends, and weakest-first sorting
│   │   ├── math-question-types.test.mjs  # Value input, step ordering, and code input evaluation math
│   │   ├── math-text.test.mjs            # KaTeX math rendering, chemical formula parsing, and fallback safety
│   │   ├── multi-note-selection.test.mjs # Multi-note selection, bulk actions, and confirmation modals
│   │   ├── note-persistence-flow.test.mjs # Debounced save, unmount flush, and font/width persistence
│   │   ├── physics-solvers.test.mjs      # Refraction (Snell's law), thin lenses, gas laws, chemistry formulas
│   │   ├── quiz-grading.test.mjs         # Deterministic integer MC grading & fallback heatmap normalizer
│   │   ├── quiz-studio-flow.test.mjs     # 2-column exam runner layout, draft answer auto-saving, and question matrix
│   │   ├── reformat-note.test.mjs        # Multi-chunk note reformatting and hierarchical block structure generation
│   │   ├── respiratory-mechanics.test.mjs # CT thoracic skeleton kinematics, diaphragm morphing, and Boyle's Law physics
│   │   ├── shadow-optics.test.mjs        # Shadow geometry: bench bounds, point/broad lamp penumbra, and material transmission
│   │   ├── space-hub.test.mjs            # Space Hub document uploads, active AI toggles, and pedagogy presets
│   │   ├── syntax-highlighter.test.mjs   # 10-language tokenizer & syntax highlighting rules
│   │   ├── table-block.test.mjs          # Interactive Table block parsing, HTML/plain-text conversion & serialization
│   │   ├── timer-store.test.mjs          # Multi-timer countdown math, duration clamping, pause/resume
│   │   └── web-saver.test.mjs            # URL normalization, domain parsing, Netscape HTML export/import round-trips
│   ├── integration/
│   │   ├── 3d-topic-schemas.test.mjs     # 3D scene topics, slider boundary validations & optical media
│   │   ├── trash-24h-purge.test.mjs      # 24-hour auto-purge expiration calculations & time formatting
│   │   └── dexie-backup-restore.test.mjs # Full .socratic workspace export/import round-trips & validation
│   └── e2e/
│       ├── keyboard-shortcuts.spec.mjs   # Ctrl+K (Search), Ctrl+I (Instant Note), Ctrl+S (Save), Escape
│       ├── block-editor-flow.spec.mjs    # Slash menu (/), block reordering, undo/redo history snapshots
│       ├── theme-toggle.spec.mjs         # Dark Slate <-> Warm Stone Light pre-paint validation
│       └── export-print.spec.mjs         # PDF print emulation & multi-format export dispatcher
├── scripts/
│   ├── check-block-mapping.mjs           # Lossless DB <-> Editor block mapping validation script
│   └── test-inlinemath-roundtrip.mjs     # Unit test for in-sentence LaTeX math round-trips
├── DESIGN_SYSTEM.md                      # Official UI design system & CSS color tokens spec
├── ANTIGRAVITY_BUG_FIXES.md              # Exhaustive summary of architectural fixes & test suites
├── README.md                             # Repository overview, setup guide & feature documentation
└── CODEBASE_SUMMARY.md                   # (This document)
```

---

## 🧩 3. Key Features & Implementation Mechanics

### 📝 A. Notion-Style Block Editor (`components/BlockNoteEditor.jsx`)
- **19 Block Types Supported**:
  1. `text`: Plain text paragraph with inline formatting, smart paste, and backspace merge.
  2. `h1`: Large section heading (`text-3xl font-bold`).
  3. `h2`: Medium section heading (`text-xl font-semibold`).
  4. `h3`: Small section heading (`text-lg font-semibold`).
  5. `h4`: Sub-heading (`text-base font-semibold`).
  6. `bullet`: Unordered list item with auto-continuation, hierarchical multi-tier indent levels (Level 0 `●`, Level 1 `○`, Level 2 `■`, Level 3 `□`), `Tab`/`Shift+Tab` indentation, Backspace un-indentation & conversion to text with empty DOM fallback, and Enter-at-start prepending (specifically on the first bullet).
  7. `number`: Ordered list item with dynamic sequential & hierarchical counting (Level 0 `1.`, `2.`, `3.`; Level 1 `a.`, `b.`, `c.`; Level 2 `i.`, `ii.`, `iii.`; Level 3 `A.`, `B.`, `C.`), `Tab` / `Shift+Tab` indentation, level inheritance on Enter, hierarchical reset across block boundaries, Backspace un-indentation, and Enter-at-start prepending.
  8. `todo`: Interactive checkbox with task strikethrough, `[x]` / `[X]` checked markdown shortcuts, clean split marker stripping, and database synchronization.
  9. `toggle`: Collapsible container with toggle arrow (`▶`/`▼`), dual-zone editing with seamless vertical arrow navigation (summary header `ArrowDown` steps into open details `<textarea>`; details `ArrowUp` at offset 0 returns to summary header), multi-line details with boundary `ArrowLeft`/`ArrowRight`, and Backspace un-listing.
  10. `callout`: Highlighted frame with 8 icon presets (`💡`, `⚠️`, `📌`, `🔥`, `⭐`, `🎉`, `ℹ️`, `🦆`) and click-away dismissal.
  11. `columns`: Multi-column split layout block supporting 2 to 5 columns with borderless Notion styling, dedicated `/2 columns` - `/5 columns` slash menu items, responsive grid cards (`grid-cols-1 md:grid-cols-2` up to `grid-cols-5`), individual column header titles with `Enter` advancing to column content, bidirectional vertical traversal (`content` first-line `ArrowUp` ↔ `title`), cross-column `ArrowLeft`/`ArrowRight` and `Tab`/`Shift+Tab` navigation, container card `Backspace`/`Delete` removal, rich editable multi-line bodies with live KaTeX `$formula$` and `` `code` `` rendering, and `ArrowDown` boundary exit.
  12. `table`: Interactive grid table block with streamlined Notion styling (no title input clutter; compact header with `▦ Table` label and dimension badge `Rows × Cols`), rich markdown & KaTeX cell rendering (`TableCell`), interactive inline LaTeX editing via click popover with presets and deletion, clean `$formula$` typing, dynamic cell editing, focus-activated column & row drag handles (`⠿`) that smoothly appear when focusing cells in that column or row (with visual drop indicators `ring-2 ring-inset ring-duck-400/80` for drag-and-drop reordering), `+ Column` / `+ Row` controls, column and row deletion (`✕`) with complete Undo/Redo (`Ctrl+Z`/`Ctrl+Y`), header row toggle, vertical arrow navigation across all intermediate rows (`Header` ↔ `Row 0` ↔ `Row 1`... ↔ `Exit`), horizontal arrow cell hopping (`ArrowLeft`/`ArrowRight`), headerless table `ArrowUp` exit, bottom-right cell upward entry, container card `Backspace`/`Delete` removal, and `Tab` / `Shift+Tab` keyboard cell navigation.
  13. `quote`: Blockquote with thick accent border.
  14. `math`: Full-width LaTeX equation block with live KaTeX rendering, intelligent visibility check with comfortable font scaling floor (`MIN_SCALE = 0.75`), dynamic horizontal scroll container with mouse wheel horizontal panning (`overflow-x-auto`), direct viewport click-to-edit, streamlined single `✨ Presets ▾` toggle button with expandable template & symbol tray, multi-line LaTeX traversal (`Shift+Enter` with line-by-line arrow navigation before boundary exit), horizontal arrow exit (`ArrowLeft`/`ArrowRight`), container card `Backspace`/`Delete` removal, and auto-save on arrow navigation.
  15. `inlinemath`: In-sentence LaTeX formula (`$formula$`) with Notion-style clear rendering (transparent background, borderless, text-matching color, soft hover feedback, and no side handles or pill borders), click popover editor, 10 formula presets, and 20 math symbols.
  16. `divider`: Horizontal divider (`hr`) with keyboard navigation (`ArrowUp`/`ArrowDown`) and backspace/delete removal.
  17. `site`: Site bookmark card with live Google Favicon resolution and URL normalization.
  18. `media`: Visual media embed supporting direct URLs and local file uploads for Images (PNG, JPG, GIF, WebP, SVG) and **YouTube Video Embeds** (`https://www.youtube-nocookie.com/embed/...` responsive 16:9 aspect-ratio iframe player, timestamp support `?t=120`, automatic YouTube URL detection, editable captions, and **width resize presets** `25%` / `50%` / `100%` for compact text flow).
  19. `code`: Code snippet block with 10-language syntax highlighting (JS, TS, Python, HTML, CSS, C++, Java, Rust, SQL, JSON), synchronized line numbers gutter (`1, 2, 3...`), 2-space `Tab` and `Shift+Tab` indentation, auto-indent on `Enter`, 1-click Copy with feedback tooltip, seamless inline backtick code (`` `x` ``) boundary caret navigation, non-premature last line vertical exit (only exiting when caret reaches snippet end), horizontal arrow boundary exit (`ArrowLeft` at 0 / `ArrowRight` at end), card `Backspace`/`Delete` removal, and upward entry caret placement at snippet end.

- **Universal Cross-Block Focus Engine & Natural Arrow Navigation (`focusBlock`)**:
  - Centralized `focusBlock(targetBlock, position = "start" | "end")` dispatcher ensuring deterministic focus and caret placement across all 19 block types.
  - **Ref Registration Protection**: `EditorBlock` guards ref registration with `if (registerRef && contentRef.current)`, preventing child refs (e.g. `CodeBlock`'s `textareaRef`) from being overwritten by `null`.
  - **Bidirectional Vertical Traversal (`handleExitDown` / `handleExitUp`)**: Moving downward smoothly places caret at the logical start of any block (including `MathBlock`, `ColumnsBlock`, and embed cards). Moving upward lands at the true end of the previous block (bottom-right cell of `TableBlock`, end of snippet in `CodeBlock`, last column content in `ColumnsBlock`).
  - **Seamless Horizontal Transitions (`ArrowRight` at block end)**: Steps seamlessly from text blocks into complex and embed blocks without trapping the cursor.
  - **Safe Block Deletion & Slash Transformation**: Deleting empty blocks below complex blocks cleanly returns focus to the preceding block; converting blocks via `/math` or `/columns` smoothly retains focus without mouse interaction.
  - **Document Boundaries & Note Title Integration**: Pressing `ArrowDown` or `Enter` in the Note Title focuses Block 0 across any block type via `focusBlock(blocks[0], "start")`. Pressing `ArrowUp` or `ArrowLeft` from the top of Block 0 steps cleanly up into the Note Title input at the end of the title text (`noteTitleInputRef`).
  - **Native Keyboard Divider Navigation**: `divider` blocks are directly selectable with arrow keys, with `Backspace`/`Delete` removal and `ArrowUp`/`ArrowDown` traversal.
  - **Dynamic Multi-Scale Visual Line Calculations**: `isCaretOnFirstVisualLine` and `isCaretOnLastVisualLine` compare caret coordinates against rendered character start/end ranges backed by dynamic computed style line-height (`Math.max(28, padding + lineHeight * 0.6)`), ensuring accurate vertical line exits across all heading sizes (`h1`–`h4`) and zoomed viewports.
  - **Selective Insertion Dropzones**: Interactive insertion dropzones directly beneath complex/container blocks (`math`, `code`, `table`, `toggle`, `columns`, `site`, `media`, `divider`) allow single-click cursor placement right below the block without modifier keys. Omitted on linear blocks (`text`, `h1`–`h4`, `bullet`, `number`, `todo`, `inlinemath`, `callout`, `quote`) where standard `Enter` naturally appends new blocks.

- **Notion-Grade Line Splitting & Backspace Merging (`splitBlockDOMAtRange` & `getDOMCaretLength`)**:
  - **Heading & Bullet Enter Prepend (`onAddBefore`)**: Pressing `Enter` at offset 0 (start) of any heading (`h1`–`h4`) or bullet/number list item (`bullet`, `number`) with content prepends a new blank block above (a paragraph above headings; an empty bullet/number of matching `level` above lists, specifically the first bullet in a list) and shifts the target block and all downstream blocks downward, maintaining caret focus on the original item on the next line (matching Notion).
  - **Clean Enter Splitting**: Pressing `Enter` anywhere in a text, list, heading, quote, or callout block cleanly splits text into two blocks. Preserves inline math pills (`$formula$`) and code spans (`` `code` ``) without text corruption, strips redundant leading list markers (`- `, `1. `, `[ ]`), resets new todo block state (`checked: false`), and automatically spawns plain text paragraphs below headings and quotes.
  - **Exact Caret Placement on Backspace Merge**: Merging at offset 0 measures the true TreeWalker DOM offset via `getDOMCaretLength(prevEl)` (ignoring internal KaTeX rendered subtrees), synchronously applies merged content via `setBlockDOMFromText`, and places the cursor at the exact merge point via `setCaretAtOffset(targetEl, domCaretOffset)`.
  - **Whitespace Character Preservation on Backspace**: Distinguishes valid whitespace characters (`" "`, `\t`) from truly empty blocks. Typing space and pressing `Backspace` deletes the space character natively rather than deleting the entire block or un-listing. `isCaretAtLogicalStart` returns `false` when caret is after whitespace, and block deletion only triggers when DOM and state are strictly empty (`cleanDOM.length === 0`).
  - **Forward Delete Pull & Merge (`Delete` at block end)**: Pressing `Delete` at the end of a block cleanly pulls up and merges the next text block into the current block maintaining caret position, removes subsequent empty blocks or standalone embeds (divider, site, media), or steps into complex cards without dropping focus.
  - **Ghost-Free Empty Block Deletion**: Deleting empty blocks with `Backspace` between complex blocks reliably returns focus to the preceding block with double-tick rAF protection.
  - **Bottom Whitespace Focus**: Clicking empty whitespace below the document root focuses the last block at the end of text via `setCaretToEnd(el)` without spawning duplicate empty blocks.
  - **Clean Persistence & Zero-Width Sanitization (`cleanZeroWidth`)**: Strips zero-width unicode artifacts (`\u200B`, `\u200C`, `\u200D`, `\u2060`, `\uFEFF`, `\u0000`) across DOM deserialization (`getBlockTextFromDOM`), database persistence (`storageService.saveNote`), AI context extraction (`editorBlocksToText`, `extractHeadingsFromBlocks`), and document exports (`filterBlocksForExport`).

- **Notion-Style Right-Side Outline (Table of Contents)**:
  - Dynamically scans `h1`, `h2`, `h3`, `h4` headings across the document.
  - Sits on the right margin with a collapsible floating pill toggle `📑 Outline (N)` and expanded outline drawer.
  - Active scroll spy: Automatically highlights the heading currently in reading focus (`border-l-2 border-duck-400 bg-duck-500/15`) throttled via `requestAnimationFrame`.
  - Smooth in-page jumping: Clicking any outline item scrolls directly to that heading, focuses it, and triggers a pulse highlight ring.

- **Inline Image & Video Resize Presets (`25%` / `50%` / `100%`)**:
  - Segmented width toggle pills embedded directly in the media block header.
  - Automatically constraints Image, Video, and YouTube viewport widths (`w-1/4 min-w-[220px] mx-auto`, `w-1/2 min-w-[320px] mx-auto`, `w-full`) for balanced layout with text flow.
  - Sizing preferences persist per-block and export seamlessly to HTML and Markdown.

- **In-Memory Keyboard Navigation History (`Alt + ←` / `Alt + →`)**:
  - Centralized navigation history stack (`navHistoryRef`) in `components/Workspace.jsx` tracking note transitions across all spaces.
  - Global `Alt + ArrowLeft` and `Alt + ArrowRight` shortcuts for lightning-fast back-and-forth switching between recent notes.
  - Visual `◀` and `▶` breadcrumb controls in the top navigation bar with disabled state reflection and shortcut tooltips.

- **Google Docs & Web Rich HTML Smart Paste Sanitizer (`parseHtmlToBlocks` & `handleSmartPaste`)**:
  - Automatically parses clipboard `text/html` from Google Docs, Notion, Word, Canvas LMS, and web pages directly into structured, sanitized SocraticOS block trees.
  - Strips Google Docs boilerplate (`docs-internal-guid`, foreign inline font-family / font-size styles) preventing DOM corruption or theme leakage.
  - Converts semantic HTML elements (`<h1>`-`<h6>`, `<ul>`, `<ol>`, `<table>`, `<blockquote>`, `<pre>`, `<code>`, `<hr>`, `<iframe>`, `<video>`, `<img>`) into native blocks.
  - Converts inline tags and Google Docs span styling (`<b>`, `<strong>`, `font-weight: 700`, `<i>`, `<em>`, `font-style: italic`, `<code>`, `<a>`, `<mark>`, `<s>`) into clean inline Markdown tokens (`**bold**`, `*italic*`, `` `code` ``, `[link](url)`, `==highlight==`, `~~strike~~`).
  - **Bullet & List Formatting Preservation**: Safely strips list item bullet prefixes without stripping bold (`**`) or italic (`*`) delimiters.
  - **Bullet Type & Indent Level Retention**: Pasting text into active `bullet`, `number`, or `todo` blocks preserves the parent block type and indentation level (`level`).
  - **Robust Nested Bold & Italic Compiler (`formatMarkdownInline`)**: Supports nested bold and italic (`**bold with *italic* inside**`, `*italic with **bold** inside*`, `**_text_**`, `_**text**_`, `***text***`), promoting lines to `h3` only when explicitly ending with a colon (`* **Heading:**`).
  - Seamlessly falls back to `parseMarkdownToBlocks` when pasting pure Markdown, plain text, or Excel / Sheets TSV tables.

- **Floating Text Selection Popover Toolbar (`TextSelectionToolbar`)**:
  - Automatically appears above any highlighted text across any editable block, list, heading, quote, callout, or table cell.
  - Action buttons: **Bold** (`B`), **Italic** (`I`), **Underline** (`U`), **Cross / Strikethrough** (`S`), **Convert to Code** (`</>`), **Convert to Formula** (`$x$`), ✨ **Explain**, and 🦆 **Quiz me on Selection**.
  - **Focus & Caret Retention**: Converting text to math or code synchronously compiles into rich elements and re-focuses without losing document focus.
  - **Underline Persistence**: Underline `<u>` elements are preserved losslessly across DOM serialization, inline formatting, and editor state updates.
  - **Formatting Boundary Caret Escaping**: Setting the caret at the boundary end of formatted spans places the caret in a trailing text node outside the formatting element, preventing subsequent typing from being inadvertently styled.
  - **Punctuation-Aware Auto-Formatting**: Typing closing backticks (`` `code` ``) or dollar signs (`$formula$`) immediately before punctuation suppresses unwanted extraneous space insertion.

- **Hierarchical Sub-Bullets & Keyboard State Machine**:
  - Full multi-level nesting for bullet blocks (`level: 0` to `level: 4`) and numbered lists (`1.`, `a.`, `i.`, `A.`).
  - **Tab**: Indents active bullet (empty or with text) to a sub-bullet (`level = level + 1`).
  - **Shift+Tab**: Unindents active sub-bullet (`level = level - 1`). If unindented at `level: 0` while empty, converts the block to a plain text paragraph.
  - **Enter**: Pressing Enter on an empty sub-bullet unindents by 1 level before exiting to text; pressing Enter on a non-empty sub-bullet inherits the current level onto the newly created bullet below.
  - **Backspace**: Pressing Backspace at offset 0 of a sub-bullet unindents by 1 level before converting to plain text.
  - **Hierarchical Glyphs & Indentation**: Level 0 renders a solid filled circle (`●`), Level 1 renders a hollow ring (`○`) with `1.5rem` indent, Level 2 renders a solid square (`■`) with `3.0rem` indent, and Level 3+ renders a hollow square with `4.5rem+` indent.

- **Centralized Deeply-Cloned Undo/Redo Engine (`pushHistorySnapshot`)**:
  - Captures immutable deep JSON copies of `blocksRef.current` across all 19 editor mutation handlers, completely eliminating shared-reference memory leaks and historical state corruption.
  - Synchronously updates `pastBlocksRef.current`, `futureBlocksRef.current`, and `blocksRef.current` prior to React state batching, guaranteeing 100% reliable rapid sequential `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` keystrokes.
  - Atomic block splitting on Enter via `splitBeforeContent` eliminates double-snapshot races between `onChange` and `onAddAfter`.
  - Symmetrical smart target focus restoration across both Undo and Redo: focuses the surviving neighboring block if the target was removed, never dropping focus to `document.body` or jumping to block 0.

- **In-Context Slash Menu (`/`)**: Typing `/` triggers a floating block-type selector directly beneath the active line, supporting all 22 command items:
  - Text, Heading 1 (`h1`), Heading 2 (`h2`), Heading 3 (`h3`), Heading 4 (`h4`)
  - 2 Columns, 3 Columns, 4 Columns, 5 Columns
  - Bullet List, Numbered List, To-Do List, Toggle List, Callout Box
  - Table, Quote, Math Equation, Inline Equation, Divider
  - Site Bookmark Embed, Image / YouTube Video Embed, Code Snippet
  - Dismissing via `Escape` or outside click immediately returns focus to the host block.

- **Notion 6-Dots & Right-Click Context Menu**:
  - Accessible via hovering the `⠿` grip handle or **right-clicking anywhere on the block**.
  - Clean block-level actions: ✨ **Explain Block**, 🦆 **Quiz on Block**, Duplicate (📋), Move Up/Down (⬆️/⬇️), Copy Text (📄), and Turn Into Submenu. Dismissible via click-outside or `Escape`.

- **Cover Banners & Custom Icons**: 100% full-width cover banners with 5 gradient presets (*Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, *Socratic Gold*) and custom emoji picker with 24 academic presets (`NOTE_EMOJIS`).

- **5 Custom Typography Font Options & Note Menu Selector**:
  - 5 academic & creative font options: **Default Sans** (`font-note-sans`), **Classic Serif** (`font-note-serif`), **Developer Mono** (`font-note-mono`), **Script / Handwritten** (`font-note-handwriting`), and **Geometric Grotesk** (`font-note-geometric`).
  - Notion-style segmented font selector at the top of `NoteMenu` (`⋯`), allowing instant one-click switching with live preview glyphs (`Ag`).
  - **Per-Note Isolation & Persistence**: Font choices persist independently in IndexedDB via `saveNote({ ...note, fontStyle })`.

- **Full Width & Lock Page Toggles (`components/NoteMenu.jsx` & `components/BlockNoteEditor.jsx`)**:
  - **Full Width**: Notion-style toggle switch row under "Move to Space" in NoteMenu switching the document layout between standard reading column (`max-w-3xl px-10`) and edge-to-edge canvas (`w-full max-w-none px-6 md:px-12`). Persists per-note via `fullWidth: boolean`.
  - **Lock Page**: Notion-style toggle switch row under "Full width" making the document strictly read-only (`isLocked: boolean`). When active: renders a subtle top-right lock icon button (under top bar) with an instant "Unlock" action and tooltip, sets title input to `readOnly`, hides header action strips and banner controls, disables icon changes, sets `contentEditable={false}` across all blocks and table cells, hides gutter drag/delete buttons, and disables right-click and slash menus.

- **Real-Time Note Stats**: NoteMenu calculates total characters, total words, total blocks, and estimated reading time across all block contents, toggle details, and math formulas.

- **Auto-Instantiation & Click-to-Append**: Typing inside an empty space automatically instantiates a note. When `clickToAppend` is enabled, clicking blank space strictly below the last block in bottom whitespace appends a new block or focuses the last empty block; clicking in the outer sides of the screen or lateral padding beside blocks is strictly disabled from appending or focusing.

- **Debounced Auto-Save & Unmount Flush Engine**:
  - All block mutations automatically trigger a 400ms debounced save (`triggerDebouncedSave`).
  - `performSave` packages complete note payloads (`id`, `spaceId`, `title`, `blocks`, `banner`, `fontStyle`, `fullWidth`, `isLocked`, `isFavorite`, `emoji`).
  - `BlockNoteEditor` maintains an unmount cleanup effect that immediately flushes dirty state with explicit note and space IDs upon space switching or navigation, preventing data loss.
  - `Workspace.jsx` maintains an active `editorBlocksRef` to guarantee that manual saves (`Ctrl+S`, `NoteMenu`, favorite toggles) never overwrite live editor content with stale initial state.

- **High-Performance Lasso / Marquee Multi-Block Selection**:
  - Document-anchored selection box (`absolute` coordinate space) with 60/120fps `requestAnimationFrame` loop.
  - Continuous edge proximity auto-scrolling (up to 35px/frame) allowing seamless selection across long notes far beyond the viewport.
  - Batch intersection calculations and set equality state caching for zero-lag drag performance.
  - Re-entrance and marquee completion guards (`justFinishedMarquee` and `lastWhitespaceClickHandledTime`) preventing synthetic mouseup clicks on the side margin from clearing multi-block lasso selections.

---

### 🔍 B. Universal Navigation, Command Palette, Sidebar & Instant Capture
- **Streamlined Dual-Level Navigation Architecture** (`components/Workspace.jsx` & `components/Sidebar.jsx`):
  - **Top Header (Space-Specific Study Suite)**: Dedicated strictly to the space-filtered views: 📝 **Notes**, 🎯 **Quizzes Studio**, and 📊 **Mastery Dashboard** (with active gap count badge). Clean breadcrumb indicating current space and open note title (or `Space Hub · {activeSpace}`).
  - **Sidebar (Global Workspace Tools, Space Switcher & Space Hub)**: Houses system-wide tools in a compact 4-column icon grid (Instant Note `⚡`, 🌌 3D Simulations, 📅 Calendar with `GlobalTimerHUD`, and 🔖 Web Saver & Bookmarks), followed by the Spaces dropdown switcher and the prominent **Space Hub** button (`⚙️ Space Hub · Syllabus`) navigating to the full-page dashboard.
  - **Multi-Note Selection & Bulk Operations Suite (`components/Sidebar.jsx` & `components/Workspace.jsx`)**:
    - Inline **"Select" / "Done"** toggle button with `ListChecks` in the `{activeSpace} · Notes` header.
    - Click-to-toggle multi-selection: Clicking notes one-by-one toggles selection indicators without opening or switching notes in the editor.
    - Checkbox indicators: Rounded checkmark pill on selected rows with `bg-duck-500/15 ring-1 ring-duck-400/40 text-duck-200` highlight. Drag handles and single-note menus are neatly suppressed during selection.
    - Dynamic header counter (`{count} of {total} selected`) with 1-click **Select All / Deselect All** toggle.
    - **Bulk Actions Toolbar**:
      - ⭐ **Star / Unstar**: Bulk favorites or un-favorites all selected notes.
      - 📋 **Copy**: Duplicates all selected notes with `"Copy of [note name]"` titles and cloned block trees.
      - 📁 **Move**: Opens `BatchMoveModal` allowing fast reassignment into any destination space.
      - 🗑️ **Delete to Trash (Mandatory Confirmation)**: Opens `BatchDeleteConfirmModal` showing note count, previewing titles with emojis, and providing 24h recovery info before confirming move to Trash.
- **Command Palette (`Ctrl+K` / `Cmd+K`)** (`components/CommandPalette.jsx`): Global fuzzy search for notes across all spaces, navigation views (Notes, Calendar, 3D Studio, Mastery Dashboard), and settings. Lazy item indexing executes strictly when open.
- **Compact Instant Note Capture (`Ctrl+I` / `Cmd+I`)** (`components/InstantNoteModal.jsx` & `components/Sidebar.jsx`): Integrated directly into the Global Tools icon grid (`⚡`) for immediate drafting with `Ctrl+Enter` quick save to the **"Misc"** space (or user-selected space).
- **Quick Save (`Ctrl+S`)**: Explicit keyboard shortcut to instantly save the active note.

---

### 🧪 C. Interactive 3D Visualization Studio (`components/ThreeDView.jsx`, `topics.js`, `VisualizationHUD.jsx`, `TopicSelectorDropdown.jsx`)
A comprehensive suite of **35 real-time interactive 3D simulations** across 5 STEM domains with a unified, distraction-free single top header, custom subject-separated `TopicSelectorDropdown` (with live search, discipline filter chips, and category groupings), dual-tab HUD (Controls & live Details readout with complete Visual Color Keys), resizable HUD panels (10%–80% viewport), speed-scaled physics engines (0.1×–3.0×), robust crash isolation via `<WebGLErrorBoundary />`, studio-wide `ACESFilmicToneMapping` with 2048×2048 shadow maps, and strict GPU lifecycle memory disposal:

1. **Physics Engine** (`PhysicsCanvas.jsx` & `ShadowLabCanvas.jsx`):
   - **Wave Refraction & Snell's Law** (`refraction`): Multi-medium light ray refraction, critical angle calculation, total internal reflection, Fresnel reflection rays, and lateral displacement.
   - **The Motor Effect & Fleming's Left-Hand Rule** (`motor`): Magnetic field lines ($N \to S$), current flow wire, Lorentz force vector, and Fleming's left hand orientation.
   - **Ray Optics — Lenses & Curved Mirrors** (`lenses`): Convex and concave lenses (refraction) and concave and convex spherical mirrors (reflection), principal optical axis, focal points $F$ and centers of curvature $2F/C$, parallel/focal/pole rays, real/virtual image arrows with adaptive vector arrow scaling, object height slider ($0.5\text{ cm}–3.0\text{ cm}$), toggles for rays, construction extensions, and labels, detailed 3D optical bench rail with sliding carriages, and speed slider hidden via `hideSpeedSlider: true`.
   - **Electromagnetic Induction & Faraday's Law** (`induction`): Dual-apparatus interactive laboratory simulation featuring an AC Dynamo Generator (rotating rectangular copper coil, slip rings, brush contacts, live AC sinusoidal waveform trace) and Bar Magnet & Solenoid Coil (axial sliding bar magnet, transparent acrylic tube, multi-turn copper solenoid, 3D dipole field loops, Lenz's Law opposing field arrow, and stationary zero-EMF verification). Complete with a high-contrast Center-Zero Galvanometer (`LaboratoryGalvanometer`), an incandescent Demonstration Light Bulb (`DemonstrationBulb`) with power-proportional glow ($P \propto \mathcal{E}^2$), and animated charge flow particles.
   - **Static Electricity & Charge Transfer** (`static_electricity`): Triboelectric charge transfer, Countable $+/-$ electron carriers, Coulomb inverse-square forces ($F = k q_1 q_2 / r^2$), neutral wall polarisation via induction, Van de Graaff generator with repelling aluminum pie pan stack, air humidity leakage, and interactive 3D balloon raycast dragging (`DraggableBalloon`).
   - **Kinetic Gas Laws ($PV=nRT$)** (`gas`): Bounded cylinder with hot/cold kinetic gas particles, moveable piston, and wall collision impulses.
   - **2D Projectile Motion** (`projectile`): Ballistic flight with quadratic drag, ideal parabolic trajectory comparison, tangent velocity $\vec{v}$, and gravity weight $\vec{W}$.
   - **Wave Interference & Double Slits** (`interference`): Wave crests/troughs, coherent slit emitters, double-slit barrier, and screen intensity fringe maxima.
   - **Keplerian Orbits & Gravity Wells** (`orbits`): Gravitational spacetime potential well ($-GM/r$), central massive body, orbiting satellite, and elliptical/hyperbolic orbital trails.
   - **Light, Shadows & Straight Lines** (`shadows`): Primary optical bench simulation powered by `ShadowLabCanvas.jsx` and `lib/shadowOptics.js`. Features draggable bench elements (light source, stand, screen), pinpoint bulb vs wide lamp penumbra/umbra calculations, 3D solids (cube, sphere, cylinder, ring, cone, duck silhouette), material transmission (opaque, translucent, transparent), and a 10%–80% resizable sidebar HUD with edge drag bar and corner grip.

2. **Chemistry Engine** (`ChemistryCanvas.jsx`):
   - **Bohr Atom & Emission Spectra** (`bohr`): Quantized electron shells, core/valence electrons, and photon emission spectral wave packets.
   - **Organic Chemistry Builder** (`organic`): Homologous series (Alkanes, Alkenes, Alkynes, Alcohols) with carbon backbone, hydrogen, oxygen, single sigma, and double/triple pi bonds.
   - **Fractional Distillation Column** (`distillation`): Multi-stage fractionating column, boiling point gradient, and color-coded petroleum fractions (Refinery gases to Bitumen).
   - **3D Crystal Lattices** (`lattice`): Giant ionic and covalent lattices: $\text{NaCl}$ (FCC), Diamond ($sp^3$), Graphite ($sp^2$ layers with delocalised electrons and van der Waals forces), Quartz ($\text{SiO}_2$), and Ice ($\text{H}_2\text{O}$ hydrogen-bonded cages).
   - **Electrolysis of Aqueous $\text{CuSO}_4$** (`electrolysis`): $\text{Cu}^{2+}$ cations, $\text{SO}_4^{2-}$ anions, cathode reduction plating, anode oxidation dissolution, and circuit current flow.
   - **VSEPR Molecular Geometry** (`vsepr`): Steric numbers 2–6, central atom, bonded ligands, non-bonding lone pair electron clouds, covalent bonds, and bond angle arcs.
   - **Reaction Energetics & Catalysis** (`energetics`): Exothermic/endothermic reaction profile curves, transition states, forward/reverse activation energy $E_a$, enthalpy change $\Delta H$, and catalysed pathway curves.

3. **Biology Engine** (`BiologyCanvas.jsx`, `EyeCanvas.jsx`, `RespiratoryCanvas.jsx` & `cell-organelles.jsx`):
   - **Plant & Animal Cell Explorer** (`cell`): Nucleus, mitochondria, chloroplasts, endoplasmic reticulum, Golgi apparatus, permanent vacuole, cell membrane, and cellulose cell wall with osmotic tonicity states.
   - **Enzyme Kinetics & Denaturation** (`enzyme`): Lock-and-key substrate binding, active catalytic cleft, thermal/pH denaturation, and released product molecules.
   - **DNA Double Helix Structure** (`dna`): Antiparallel sugar-phosphate backbones, complementary base pairs (Adenine, Thymine, Guanine, Cytosine), and hydrogen bond rungs.
   - **Protein Secondary Structure & Folding** (`protein`): $\alpha$-Helix ($i \to i+4$ H-bonds, 3.6 residues/turn), $\beta$-Pleated Sheet, random coils, hydrophobic core packing vs hydrophilic surface residues, and thermal denaturation.
   - **The Human Eye — Accommodation & Pupil Reflex** (`eye`): Anatomical and physiological cutaway eyeball simulation powered by `EyeCanvas.jsx` and `lib/eyeOptics.js`. Features dynamic ciliary accommodation, crystalline lens curvature morphing, pupil light reflex, Gullstrand equivalent power calculations, refractive error corrections, and a 10%–80% resizable sidebar HUD with edge drag bar and corner grip.
   - **Respiratory Mechanics & Thoracic Physics** (`respiratory`): Photorealistic 3D anatomical and physiological thoracic simulation powered by genuine clinical CT-derived thoracic skeleton (`skeleton_ct.glb`, 16.3 MB; isolated 24 ribs, T1–T12 thoracic vertebrae, L1–L3 lumbar crura anchors, sternum, xiphoid, and clavicles) with active bucket-handle lateral elevation and pump-handle AP sternal elevation, photorealistic medical lungs scan (`lung.glb`, 17.1 MB), multi-layer antagonistic intercostal muscle bands (superficial external $+35^\circ$ inspiratory and deep internal $-45^\circ$ forced expiratory), muscular diaphragm dome morphing, dynamic airway particle stream vectors driven by Boyle's Law pressure gradients ($P_1 V_1 = P_2 V_2$), 3-state phase selector, live SVG physics gauges, and open-source model attribution modal.

4. **Computer Science Engine** (`CSCanvas.jsx` & `BinaryTree3D.jsx`):
   - **3D Binary Search Tree / AVL Tree** (`binary_tree`): Interactive node insertion, searching, depth planes, and animated in-order, pre-order, and post-order traversals with complete Visual Tree Keys (Idle, Comparison, Found, Missing, Selected, Branch Edges).
   - **3D Sorting Algorithm Visualizer** (`sorting`): Bubble, Insertion, Selection, Quicksort, and Merge Sort with unsorted bars, comparison highlights, swap transitions, and sorted states.

5. **Mathematics Engine** (`MathCanvas.jsx`):
   - **3D Gradient Descent Optimization** (`gradient`): Topographic loss surfaces (Bowl, Saddle, Rosenbrock Valley, 4-Well Landscape), negative gradient $-\nabla f$ descent vectors, and optimization trails.
   - **Solids of Revolution & Integral Calculus** (`revolution`): 2D generating curves $r(y)$, Riemann approximating cylindrical discs $\pi r^2 \Delta y$, true solid shells, and rotation axes.
   - **Trigonometric Unit Circle & Wave Synthesis** (`unitcircle`): Unit circle orbital motion $(x, y) = (\cos\theta, \sin\theta)$, projected sinusoidal time traces, and Fourier square wave harmonic synthesis with Gibbs overshoot.

6. **HUD Controls, Live Details Readout & Authoritative Visual Keys (`VisualizationHUD.jsx`)**:
   - Universal HUD header with category filters (Physics, Chemistry, Biology, CS, Math), parameter sliders, toggles, resets, and AI Explain & Quiz drawer integrations.
   - **Direct AI Explain, Quiz & Mastery Pipeline**: The "AI Concept Breakdown & Quiz" button in the HUD Details tab triggers `formatTopicStudyContext(topic, params)` to synthesize rich 3D topic details directly into the `ExplainPanel` drawer. Handover to `QuizPanel` ("🦆 Test me on this") generates dynamic AI questions and logs scores to the **Mastery Dashboard**.
   - **Universal Draggable Resizable HUD Panels**: 100% of all 36 3D visualisations support horizontal drag-to-resize sidebar controls from 10% (180px) to 80% screen width via grab bar and bottom-right corner grip, with persistent `localStorage` (`socratic_hud_panel_width`).
   - **Universal Animation Speed Slider**: Mounted directly below the tab switcher across animated 3D scenes (selectively hidden on static optical diagrams via `topic.hideSpeedSlider`), providing fine-grained $0.1\times$ to $3.0\times$ speed control (with paused/frozen states).
   - **Hardware Graphics Adaptation**: Device capability detection (`detectHardwareGraphics`) managing DPR (1.0–2.0), shadows, antialiasing, and dynamic `"demand"` vs `"always"` frameloops.
   - **Zen Focus Mode & Minimalist View**: 1-click toggle button (`Ctrl+Shift+F`) collapses the sidebar and hides top bars, leaving only an edge-to-edge canvas with a floating glassmorphic exit pill.

---

### ⏱️ D. Multi-Timer HUD & Calming Study Break Alerts
- **Unified Global Timer HUD** (`components/GlobalTimerHUD.jsx`): Header dropdown managing concurrent timers: Pomodoro Focus (25m), Short Break (5m), Long Break (15m), and custom timers with live countdown rings and play/pause controls.
- **Study Calendar & Schedule** (`components/CalendarView.jsx`): Month navigation, agenda lists, space tagging, 24-hour time pickers, and custom recurring alarm scheduling.
- **Calming Study Break & Timer Alert** (`components/AlarmOverlay.jsx`): Glassmorphic break modal alert (`✨ ☕ 🌱`) with harmonic C-major triad chime synthesis, dynamic browser tab indicator (`🦆` $\leftrightarrow$ `☕`), calming title notices, and friendly snooze/extend buttons.

---

### 🤖 E. AI Tutoring, Structured Explanations & Reformatting
- **Interactive AI Tutor Doubt-Clearing Suite (`components/AITutorPanel.jsx` & `app/api/tutor/chat/route.js`)**:
  - Accessible via the **🧑‍🏫 AI Tutor** button in the top HUD action bar.
  - **Full Space Curriculum Feeding**: Dynamically resolves and feeds all uploaded documents marked as *"Fed to AI"* from `SpaceHubView.jsx` for the active space.
  - **Pedagogy Alignment**: Injects the active space's Academic Standard / Grade Level (IGCSE, IB HL, AP, College, Olympiad), AI Persona & Tone (Standard Examiner, Strict Examiner, Socratic Guide, Friendly Coach, Olympiad Mentor), and Strictness / Rigor level into the tutor prompt.
  - **Active Note Context**: Injects the active note's full text content so the learner can highlight doubts directly from their notes.
  - **KaTeX & LaTeX Math**: Real-time rendering of mathematical formulas, equations, matrices, and chemical notations using `MathText`.
  - **Quick Doubt Starters**: 1-click query pills (*"Explain this step-by-step with intuition"*, *"What are common exam traps here?"*, *"Give me a concrete real-world example"*, *"Derive the formula"*).
  - Clear history, copy responses, and unconstrained doubt dialogue.
- **Structured Concept Explainer (`app/api/explain/route.js`, `lib/aiService.js` & `components/ExplainPanel.jsx`)**: Generates structured breakdowns containing TL;DR summaries, mechanism steps, analogies with explicit breakdown boundaries, common misconceptions, worked examples, and check-yourself questions, rendered with rich inline Markdown (**bold**, *italic*, `code`) and live KaTeX LaTeX mathematical/scientific equations. Features robust mathematical healing including JSON wire single-backslash escape repair (`repairJsonLatexEscapes`), control character healing (`sanitizeMathText` repairing `\f` form-feed `\frac` and `\t` tab `\text` corruptions), discrete bare LaTeX extraction in prose without delimiters (`BARE_INLINE_LATEX_REGEX`), and global KaTeX macro registration (`"\\ext": "\\text{#1}"`).
- **Intelligent Note Reformatting (`app/api/reformat/route.js` & `lib/aiService.js`)**: Analyzes notes and restructures them into high-yield SocraticOS blocks (headings, callout cards with emoji icons, hierarchical sub-bullets with multi-level nesting via `level` schema, LaTeX display/inline math, collapsible toggles, code snippets, checklists, tables, and dividers) with automatic multi-chunk segmentation for long notes (`chunkNoteBlocks`), live progress updates (`Part X/Y...`), strict LaTeX formula enforcement across all equations, markdown preservation inside bullets and all blocks, instantaneous `Ctrl+Z` undo stack tracking, offline heuristic fallback recognizing indented markdown sub-bullets, and a top-center floating glassmorphic status banner with live progress indicator.
- **Quiz Drawer Assessment Engine (`components/QuizPanel.jsx`)**: Dedicated quiz assessment sidebar for active notes and selections, evaluating understanding through dynamic questions (5 multiple-choice, 3 short-answers; math block / value_input questions excluded from quick quizzes) and recording session scores directly into the mastery analytics store.
- **Client-Side AI Orchestration (`lib/aiService.js`)**: Allows users to provide their own Gemini API key stored privately in IndexedDB, calling Gemini directly from the client or falling back to server routes.

---

### 🎯 F. Dedicated Quizzes Studio, AI Generator & Mastery Rollup
- **Quizzes Studio Tab (`components/QuizStudioView.jsx`)**:
  - Full diagnostic quiz hub organizing quizzes across spaces with pending, completed, and trash sub-tabs.
  - **Redesigned Decluttered Exam Runner Layout**: Split-screen 2-column workspace removing all navigation, submission, question jumper, and auxiliary buttons from the question canvas into a dedicated, high-productivity right-hand Control & Navigation Sidebar.
    - **Spacious Left/Center Q&A Canvas (`max-w-4xl`)**: Generous, distraction-free reading area featuring question metadata pills (number, subtopic with LaTeX MathText, question type), an open prompt card with rich KaTeX math typography, and expansive answer options (full-width MCQ cards with hover key hints, or spacious short/long answer textareas with mechanistic tips and live word counts).
    - **Dedicated Right-Hand Navigation & Control Station (`w-80 lg:w-88`)**:
      - Primary Action: Prominent "Next Question" / "Skip Question" button, transitioning automatically to "Finish & Submit Exam" on the last question.
      - Secondary Actions: "Previous Question" and instantaneous "Clear Answer" button.
      - Interactive Questions Matrix: 5-column numbered matrix showing real-time question states (Current glowing ring, Answered emerald pill with dot, Unanswered subtle badge) with single-click jumping to any question.
      - Progress & Real-Time Auto-Save: Continuous progress percentage bar, answered question counter, and local storage auto-save indicator.
      - Standalone Submit & Exit: Instant "Submit Exam" button accessible at any point, plus "Save Progress & Exit" to safely pause and return.
    - **Keyboard Hotkey Engine**: Global keyboard listeners: `ArrowRight` (next/skip), `ArrowLeft` (previous), and `A`/`B`/`C`/`D` or `1`/`2`/`3`/`4` to select multiple choice options.
  - **Progress Auto-Saving**: Real-time auto-saving of answers (`draftAnswers`) and active question position (`draftIndex`) to IndexedDB on option clicks, debounced textarea inputs, and question navigation.
  - **Full LaTeX & Chemical Formula Rendering (`components/MathText.jsx` & `lib/mathUtils.js`)**: All quiz prompts, subtopics, multiple choice options, diagnostic rubrics, student answers, and feedback render formatted mathematical equations and chemical formulas via memoized KaTeX compilation.
  - **Resume & In-Progress Flows**: In-progress quizzes display a `⏳ In Progress (X/Y)` card badge and `"Resume Quiz"` button restoring answers and current question index; retake cleanly resets draft state.
  - **Delete Confirmation Modal (`DeleteQuizConfirmModal`)**: Modal dialog with accessible semantics, metadata preview, and escape/backdrop dismiss preventing accidental loss when trashing quizzes, permanently deleting items, or emptying the 24-hour trash bin.
  - **Diagnostic Review Report**: High-contrast question breakdown cards (emerald for correct, rose for incorrect) with overall score (`ScoreRing.jsx`), subtopic confidence heatmap breakdown (`ConfidenceHeatmap.jsx`), and rubric feedback.
  - **Decluttered Multi-Note Quiz Cards & SourceNotesModal**: Multi-note quizzes render a single-line compact pill (`📚 X notes • View notes →`). Clicking opens `SourceNotesModal` with live search and 1-click note navigation into the editor.
  - 24-hour auto-purge trash management for deleted quizzes (`quizTrash`).
  - **Multi-Source Note Grading**: `handleSubmitQuiz` dynamically resolves full text across all source notes (`noteIds`) with structured boundaries, providing the AI grading model complete cross-note rubric context.
  - **Syllabus-Aware Grading**: `handleSubmitQuiz` reads the active syllabus statement and injects it into the grading payload.

- **Custom AI Quiz Generator Modal (`components/CreateQuizModal.jsx`)**:
  - **Multi-Note Selection**: Interactive source note combobox with live search filtering, "Select All" / "Clear" buttons, per-note checkboxes, selection count badge (`X of Y selected`), and removable chip badges.
  - **Multi-Source AI Prompt Feeding**: Formats all selected notes with clear section delimiters (`=== Source Note: "<Title>" ===`), prompting the AI model to synthesize cross-topic connections.
  - **Cross-Note Heading Aggregation**: When selecting specific sections (`scope === "heading"`), headings (H1–H4) from all selected notes are compiled with note source attribution (`[Note Title] Heading Text`).
  - Configurable difficulty tiers (Easy, Medium, Hard, Mastery) and custom note scoping (All Selected Notes, H1–H4 Heading Checkboxes, or Custom Prompt).
  - **Question Types (7 Supported)**:
    1. `multiple_choice`: 4 options (A-D / 1-4) with deterministic integer grading and hotkey selection.
    2. `multi_select`: Checkbox-style ("Select all that apply", 2+ correct options) with objective array set matching.
    3. `value_input`: Exact numerical or algebraic formula input with virtual math symbol keyboard (`\frac{a}{b}`, `\sqrt{x}`, `x^2`, `x^n`, `\pi`, `\pm`, `\theta`, `\le`, `\ge`, `\approx`, `\infty`, `\times`, `\div`, `^\circ`) and live KaTeX preview card. Deterministic match with numerical tolerance ($\pm \delta$), falling back to LLM for algebraic equivalence.
    4. `step_ordering`: Parsons problem scrambled derivations/proofs where students arrange mathematical or algorithmic steps into logical order using ▲/▼ controls.
    5. `code_input`: Algorithm/programming task with built-in code editor featuring 2-space `Tab` key indentation interception, monospace styling, language tags, and optional starter code.
    6. `short_answer`: Concise mechanistic free response graded via LLM rubric.
    7. `long_answer`: In-depth essay/derivation evaluated across structured criteria.
  - **1-Click STEM Presets**:
    - 🎓 **IGCSE Gr.10 STEM**: Balanced distribution (3 MCQ, 1 Multi-Select, 2 Value Input, 1 Step Order, 1 Code, 2 Short Answer).
    - 🧮 **Pure Math & Derivations**: Focused on mathematical rigor (2 MCQ, 3 Value Input, 2 Step Order, 1 Multi-Select).
    - 💻 **Computer Science**: Algorithm design & logic (2 MCQ, 3 Code Input, 1 Step Order, 1 Multi-Select).
    - ⚡ **Quick 5 MCQ**: Rapid 5-question multiple choice diagnostic.
  - **Categorized Question Sliders**: Grouped cleanly into *Mathematics & Science Reasoning* (Value Input, Step Ordering, Code Input), *Objective Assessment* (Multiple Choice, Multi-Select), and *Applied Analysis* (Short Answer, Long Essay).
  - Proportional question type sliders with custom gold gradient track fills and direct number inputs.
  - **Active Syllabus Badge**: Displays a green badge when a syllabus boundary is active and injects the syllabus into generation payloads.
  - **Spacious Wide Modal Architecture**: Upgraded modal shell (`w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh]`) with responsive 2-column grid for section headings.

- **Objective & Semantic Hybrid Grading (`lib/aiService.js` & `app/api/quiz/grade/route.js`)**:
  - Deterministic evaluation:
    - `multiple_choice`: integer index comparison with strict blank guards.
    - `multi_select`: exact set equality across selected index arrays.
    - `step_ordering`: exact string sequence comparison against expected step order.
    - `value_input`: string normalization (stripping `$`), direct text equality, or float comparison within `tolerance` ($\pm \delta$).
  - LLM semantic evaluation for short answers, essays, code solutions, and algebraic derivations with positional fallback resilience and subtopic heatmap fallback synthesis (`fallbackHeatmap`).

- **Space-Specific Reactive Mastery Dashboard Sync (`components/Workspace.jsx`, `MasteryDashboard.jsx`, & `lib/mastery.js`)**:
  - `useLiveQuery` reactive binding synchronizing study sessions from both drawer quizzes and Quizzes Studio directly into `MasteryDashboard.jsx` and header `gapCount` badge without requiring page reload.
  - Full space-specific isolation: sessions, topics, averages, and the header `gapCount` badge are scoped to the active space by default.
  - Quick Space Switcher Dropdown in the Mastery header enabling instant toggling between spaces or viewing a combined `🌐 All Spaces` aggregate view.
  - Non-destructive backwards compatibility: historical sessions lacking an explicit space property automatically resolve to their associated note's space or default to `"School"`.
  - Isolated history clearing: "Clear history" removes only sessions within the selected space.
  - Sub-topic confidence matrix (Solid ● / Shaky ◐ / Gap ○) with weakest-first study queues and progress trends.

---

### ⚙️ G. Space Hub & Per-Space Curriculum Management (`components/SpaceHubView.jsx`)
- **Full-Page Dedicated Curriculum Hub**: Accessible via the `⚙️ Space Hub · Syllabus` button in the sidebar.
- **Space Editing, Renaming & Emoji Customization**:
  - **Full Space Identity Editing**: Rename any space, choose from 26 curated emoji presets (`SPACE_ICON_OPTIONS`) or input custom emojis, and edit descriptive taglines.
  - **Dual Edit Affordances**: Edit spaces directly from the Sidebar (`EditSpaceModal` triggered via hover `Pencil` icon on space items in both Grid and Dropdown views) or from the `SpaceHubView` identity section.
  - **Cascading Space Renames (`renameSpace` in `lib/storageService.js`)**: Atomically updates space references across 8 IndexedDB stores (`notes`, `trash`, `spaceDocuments`, `spaceSettings`, `folders`, `bookmarks`, `quizzes`, `studySessions`) and `localStorage`.
  - **Permanent Emoji Persistence (`saveAllSpaces` & `getSavedSpaces`)**: Default spaces (`School`, `Personal`, `Misc`, `Journal`) permanently preserve custom emojis and blurbs across page reloads and note imports without reverting to initial defaults.
  - **Permanent Space Deletion (`deleteSpace`)**: Deleting any space (including defaults) persists permanently across reloads, cleaning Dexie `spaceSettings`, `spaceDocuments`, `folders`, `bookmarks`, `quizzes`, and `studySessions`, and registering deletion tombstones in `socratic_deleted_spaces`. `Workspace.jsx` initializes `spaces` and `activeSpace` via synchronous lazy initializers filtering against `socratic_deleted_spaces` so unhydrated defaults never flash or mount. Auto-save effects are strictly gated on `isHydrated`, and any orphaned notes referencing deleted spaces are automatically remapped to the primary remaining space.
- **Multiple Documents per Space**: Upload and store multiple syllabus documents (`.pdf`, `.docx`, `.txt`, `.md`) directly within each space. Stored in Dexie `spaceDocuments` store.
- **Active AI Toggles**: Each document features an instant toggle switch (`active` / `inactive`), controlling exactly which curriculum files are concatenated and fed into the AI during quiz generation, grading, and AI Tutor dialogues (`getActiveSyllabusForSpace()`).
- **AI Pedagogy & Examiner Settings**:
  - **Academic Standard / Grade Level**: General, IGCSE / O-Level, IB Diploma (HL/SL), AP / College Board, University, Olympiad / Competition.
  - **AI Persona & Tone**: Standard Examiner, Strict Examiner, Socratic Guide, Friendly Coach, Olympiad Mentor.
  - **Distractor Toughness & Rigor**: Relaxed, Standard, High Rigor.
- **Quick 1-Click Presets**: Instant load presets for Cambridge IGCSE, IB Diploma HL, AP Prep, and Foundational mastery.
- **General Settings Integration (`components/Sidebar.jsx`)**: Legacy / workspace-wide curriculum statement toggle (`socratic_syllabus_enabled`, `socratic_syllabus_statement`) with presets (*🎓 IGCSE Gr.10*, *📚 GCSE / O-Level*, *🏛️ IB MYP 4-5*, *🧬 AP / A-Level Gr.11-12*, *🔬 Middle School Gr.6-8*).

---

### 📦 H. Multi-Format Export, Import & Workspace Backup Engine
- **Interactive Pre-Download Document Export Preview (`components/ExportPreview.jsx` & `components/ExportImportModal.jsx`)**:
  - Automatically presents a high-fidelity visual and structural preview for all 4 document formats (**Word Document `.docx`**, **HTML Web Page `.html`**, **Plain Text `.txt`**, and **Markdown `.md`**) *before* initiating file download, eliminating blind exports.
  - **PDF & Browser Bookmarks Exclusion**: PDF continues to utilize the browser's native print preview dialog (`window.print()`), while Socratic Workspace Backups (`.socratic`) and Browser Bookmarks (`.html`) remain direct space-level export operations as designed.
  - **Universal Format Quick-Tabs**: In-preview header tabs allow seamless, instant toggling between all 4 document formats (`[📝 Word (.docx)] [🌐 HTML (.html)] [📑 Plain Text (.txt)] [⬇️ Markdown (.md)]`).
  - **Authentic Microsoft Word View (`.docx`)**: Simulates an 8.5" x 11" white document sheet with subtle page shadows, Word heading hierarchy, shaded table headers, callout frames, and page footer ("Page 1 of 1").
  - **Rendered HTML Web Page View (`.html`)**: Sandboxed `iframe` executing the exact self-contained HTML document generated by `blocksToHTMLLossy`, rendering full dark theme styling, KaTeX math expressions, and interactive components. Includes toggleable raw HTML source view with line numbering.
  - **Plain Text Editor View (`.txt`)**: Monospace text editor layout with line numbers, structured ASCII headers, and indentation matching `blocksToPlainText`.
  - **Markdown Reader View (`.md`)**: Rich rendered view powered by `MarkdownRenderer` displaying headings, LaTeX formulas, interactive task lists, syntax-highlighted code fences, and tables, alongside a raw Markdown code view.
  - **File Metrics & Actions**: Real-time calculated file size (KB), block count, word count, character count, instant clipboard copy ("Copy Content"), and prominent Duck-yellow "Download [filename]" confirmation button.
- **Workspace & Space Backups (.socratic)** (`lib/backup.js`): Exports entire spaces or all spaces into structured JSON `.socratic` backup packages; supports drag-and-drop restoration with space reassignment, overwrite options, and direct note records return.
- **Netscape HTML Bookmarks (`.html`)**: Standard browser bookmark format (`<!DOCTYPE NETSCAPE-Bookmark-file-1>`) preserving folder hierarchies, links, and personal notes for import into Chrome, Firefox, Safari, Edge, Arc, and Brave.
- **PDF & Print Engine**: High-fidelity A4 document print engine via `@media print` featuring compact cover banner, universal dark text enforcement (`color: #0f172a !important`), atomic page-break avoidance, restored callout and document header emojis, full-width code blocks with syntax highlighting, rounded tables with dark headers, single-line toggle block headers with amber `▼` disclosure arrows, normalized checkboxes, and trailing blank page elimination.
- **Word Document (`.docx`)**: Native headings, callout boxes with emojis, toggle headers with `▼ ` and indented italic details `↳ `, styled code containers with Consolas, formatted lists, blue hyperlink runs with 🌐 icons, media badges, normalized quotes, and multi-column tables.
- **HTML (`.html`)**: Clean standalone HTML5 web page with grouped lists, `<details>` toggles, dark theme styling matching SocraticOS aesthetic, embedded KaTeX CDN with auto-render script, interactive bookmark cards, and responsive multi-column layouts.
- **Markdown (`.md`)**: GitHub/Obsidian-flavored markdown with automatic top `# Title` inclusion, KaTeX `$formula$` preservation, `<details>` toggles, standard task list `- [ ]` / `- [x]` checkboxes, `[title](url)` bookmark links, and `![caption](url)` images.
- **Plain Text (`.txt`)**: Clean structured text formatting with `--- CODE (lang) ---` delimiters, `▶ ` toggle headers with `↳ ` details, sequential numbering, and multi-column sections.
- **Drag-and-Drop File Import**: Automatically imports `.socratic`, `.json`, `.docx` (via Mammoth), `.html` (notes and browser bookmarks), `.txt`, and `.md` files into the active space.

---

### 🔖 I. Website Saver & Folder Manager (`components/WebSaverView.jsx` & `components/AddBookmarkModal.jsx`)
- **Dual-Pane Folder Navigation**:
  - **Left Sidebar**: Collapsible folder tree with parent-child nesting, quick "All Bookmarks" and "Unorganized" filters, inline new folder modal, rename/delete context triggers, and drag-and-drop target support.
  - **Main Viewport**: Live search (matches title, URL, domain, tags, notes), sorting (Newest, Oldest, Title A-Z, Domain), and view toggles (Grid Cards vs Compact List).
- **Bookmark Card & List Controls**:
  - Automated high-res Favicon badge with fallback globe.
  - Direct external link launch (`target="_blank" rel="noopener noreferrer"`).
  - Quick "Copy Link" button with instant checkmark feedback.
  - Folder move dropdown selector & drag-and-drop folder sorting.
  - Aesthetic hashtag badges (`#tag`) and expandable personal study annotations.
- **Instant Bookmark Capture Modal (`components/AddBookmarkModal.jsx`)**:
  - Automatic URL normalization (`https://`), domain extraction, live favicon preview, and heuristic title parsing.
  - Keyboard accessible: `Escape` closes modal, `Ctrl+Enter` / `Enter` saves bookmark.
- **Duplicate Prevention & Clean Replacement (`ImportBookmarksConfirmModal`)**:
  - Importing browser Netscape HTML bookmarks triggers a confirmation dialog warning that existing folders/bookmarks in the target space will be cleanly replaced (with optional merge mode).
- **URL & Favicon Utilities (`lib/urlUtils.js`)**:
  - `normalizeUrl(url)`: Protocol normalization and dangerous scheme protection (`javascript:`, `data:`).
  - `extractDomain(url)`: Clean hostname extraction.
  - `getFaviconUrl(url, size=64)`: High-resolution Google favicon resolution.
  - `generateFallbackTitle(url)`: Human-readable title generator from URL path segments and domain names.

---

### 🗄️ J. 24-Hour Auto-Purge Trash, Factory Reset & Settings
- **24-Hour Auto-Purging Trash (`trash` & `quizTrash`)**: Deleted notes and quizzes are placed in their respective Trash drawers with a `deletedAt` timestamp; a 1-minute interval background task automatically purges items older than 24 hours. Supports individual and batch recovery, permanent deletion, and empty trash.
- **Factory Reset Safety Verification**: Targeted table purging in Settings featuring typed `"RESET"` double-confirmation safety checks instead of arbitrary math captchas.
- **Feature Request Submission Modal (`components/FeatureRequestModal.jsx`)**: User feedback modal accessible from the sidebar footer supporting category selection, user email, and detailed description.

---

### 🎓 K. Interactive Onboarding Tutorial Subsystem (`components/InteractiveTutorial.jsx` & `lib/tutorialData.js`)
- **9 Interactive Chapters Covering 100+ Features**:
  1. `philosophy`: Active Retrieval vs rereading illusion, 100% local-first IndexedDB (Dexie.js v7), and Spaces architecture with interactive concept selector.
  2. `editor`: 19-block Notion-grade studio, 22-item slash menu (`/`), 6-dots handle (`⠿`), KaTeX LaTeX equations, table row/col drag handles, and interactive 3-font typography switcher (`sans`, `serif`, `mono`).
  3. `ai_suite`: Persistent side-by-side study drawers with tabbed preview of the Explain Panel (4-part breakdown) and an **interactive live mini-quiz** with real-time answer checking, feedback, and mastery heatmap explanation.
  4. `quizzes`: Dedicated Quizzes Studio 2-column exam runner, question matrix, draft auto-save, comprehensive review reports, 7 question types, and an **interactive step-ordering puzzle**.
  5. `spacehub`: Space Hub per-space syllabus doc uploads (.pdf, .docx, .txt, .md), active AI toggles, and an **interactive curriculum standard selector** (IGCSE, IB, AP, University) previewing AI personas and distractor strictness in real time.
  6. `visualizations`: 27 interactive 3D simulations across 5 STEM domains (Physics, Chemistry, Biology, CS, Math) with interactive domain filters, parameter sliders, and OrbitControls.
  7. `timers`: Multi-Timer HUD, study calendar agenda, and an **interactive Pomodoro Cycle & Study Rhythm Simulator** with clickable 4-phase cycle states (25m Focus, 5m Short Break, 15m Long Break, Custom Timer), animated timer progress display, and tab notification preview (`🦆` ↔ `❗️`).
  8. `websaver`: Dual-pane Web Saver, drag-and-drop folder tree, live Google favicons, and Netscape HTML import/export.
  9. `shortcuts`: Multi-note bulk toolbar (Star, Copy, Move, 24h Trash with confirmation), interactive power shortcuts grid (clicking `Ctrl+K` launches Command Palette, `Ctrl+I` launches Instant Note, others copy with feedback), and `.socratic` complete workspace backups.
- **First-Visit Auto-Launch**: Automatically checks `localStorage.getItem("socratic_tutorial_completed")` and URL parameter `?tour=true` on initial site visit to guide new students through the application.
- **Settings & Command Palette Replay**: Re-triggerable anytime via the "Restart Tutorial" action card in `SettingsModal` (General tab) or via Command Palette (`Ctrl+K` → "Open Onboarding Tutorial & Guide").
- **Keyboard Navigation**: Fully accessible with `ArrowLeft`/`ArrowRight` step navigation, `Escape` dismissal, progress bar, and clickable step dots.

---

### ⚡ L. Performance & Runtime Optimization Architecture
- **$O(1)$ Block-Level Re-render Isolation**: `EditorBlock` and heavy child containers are wrapped in `React.memo` with custom comparator guards, ensuring single-character edits in one block never cause full-document re-renders across other blocks.
- **KaTeX LRU String Memoization**: Math pills and block equations use an in-memory LRU Map cache (`renderKatexToStringMemoized`) to avoid redundant KaTeX lexing/AST rebuilds on identical LaTeX formulas.
- **Singleton Timer Store Clock & Auto-Sleep**: Multi-timer polling is consolidated into a single external store ticker (`multiTimerStore`), running only 1 shared timer interval when active and automatically clearing intervals when all timers are idle (0% idle background CPU usage).
- **IndexedDB Query Batching**: Settings and bulk database lookups use `db.settings.bulkGet(...)` instead of sequential single-key round-trips.
- **Calendar & UI Memoization**: Month cell grids and timer sub-widgets in `CalendarView.jsx` are wrapped in `useMemo` and `memo` to prevent recalculations on unrelated state updates.
- **Search Catalog Memoization**: `CommandPalette.jsx` wraps item catalogs and search filters in `useMemo` with lazy evaluation when closed to eliminate object churn during editing.
- **$O(1)$ Static Syntax Language Map**: `lib/syntaxHighlighter.js` normalizes code languages in constant time via static lookup Maps.
- **Single-Pass Document Metrics**: `BlockNoteEditor.jsx` computes word and character statistics in a single linear pass.
- **3D WebGL & Canvas Render Loop Optimizations**:
  - `PhysicsCanvas.jsx` and `BiologyCanvas.jsx` memoize `THREE.Color` lerp interpolations to eliminate 60 FPS object churn.
  - `ThreeDView.jsx` debounces 3D topic switching history and localStorage persistence.

---

## 🗄️ 4. Local-First Database Architecture (`lib/db.js` & `lib/storageService.js`)

SocraticOS operates entirely local-first using **Dexie.js** (IndexedDB database name: `SocraticOS_LocalDB`, version 7).

### IndexedDB Object Stores (11 Total):
1. `notes`: Primary note documents.
   - *Index*: `id, spaceId, title, isFavorite, emoji, updatedAt`
   - *Fields*: `id`, `spaceId`, `title`, `blocks` (Array of 19 block objects), `banner`, `emoji`, `fontStyle`, `fullWidth`, `isLocked`, `isFavorite`, `createdAt`, `updatedAt`
2. `folders`: Web Saver folder hierarchies.
   - *Index*: `id, parentId, spaceId, name, createdAt`
   - *Fields*: `id`, `parentId`, `spaceId`, `name`, `createdAt`
3. `bookmarks`: Web Saver bookmark records.
   - *Index*: `id, folderId, spaceId, url, title, favicon, notes, tags, createdAt`
   - *Fields*: `id`, `folderId`, `spaceId`, `url`, `title`, `favicon`, `notes`, `tags` (Array of strings), `createdAt`
4. `trash`: Soft-deleted notes pending 24-hour auto-purge.
   - *Index*: `id, deletedAt`
   - *Fields*: Complete note document + `deletedAt` ISO timestamp
5. `calendarEvents`: Scheduled study events.
   - *Index*: `id, date, time`
   - *Fields*: `id`, `title`, `date`, `time`, `type`, `space`, `updatedAt`
6. `studySessions`: Graded quiz session records.
   - *Index*: `id, noteId, timestamp, score`
   - *Fields*: `id`, `noteId`, `noteTitle`, `space`, `concept`, `mode`, `score`, `summary`, `heatmap` (Array of `{ subtopic, status, feedback }`), `createdAt`
7. `alarms`: Custom scheduled recurring study alarms.
   - *Index*: `id, time, enabled`
   - *Fields*: `id`, `title`, `time` (24h "HH:MM"), `days` (Array of weekday numbers 0-6), `enabled`, `sound`, `createdAt`, `updatedAt`
8. `settings`: Key-value application settings.
   - *Index*: `key, value`
   - *Keys*: `apiKey`, `gfx_graphicsPreset`, `gfx_targetFps`, `gfx_pixelRatio`, `gfx_enableShadows`, `gfx_enableAntialias`, `gfx_autoPauseHidden`, `editor_click_to_append`, `space_switcher_layout`, `socratic_syllabus_statement`, `socratic_syllabus_enabled`, `socratic_theme`
9. `quizzes`: Saved exam and quiz objects.
   - *Index*: `id, spaceId, noteId, title, difficulty, status, createdAt, updatedAt`
   - *Fields*: `id`, `spaceId`, `noteId`, `noteIds` (Array of string note IDs), `title`, `difficulty`, `questions` (Array of 7 question objects), `status` ("in_progress" | "completed"), `draftAnswers` (Object map of answer states), `draftIndex` (Integer current question index), `score`, `diagnostic`, `createdAt`, `updatedAt`
10. `quizTrash`: Soft-deleted quizzes pending 24-hour auto-purge.
    - *Index*: `id, deletedAt`
    - *Fields*: Complete quiz document + `deletedAt` ISO timestamp
11. `spaceDocuments`: Per-space uploaded syllabus and curriculum documents for AI feeding.
    - *Index*: `id, spaceId, name, active, createdAt, updatedAt`
    - *Fields*: `id`, `spaceId`, `name`, `content`, `size`, `type`, `active` (boolean toggle), `createdAt`, `updatedAt`

### Offline Route Resiliency:
All `/api/*` fallback routes (`calendar/events`, `visualizations`, `reset`) respond with `{ success: true, localFirst: true, offline: true }`, ensuring zero console errors or network failures when working fully offline.

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
3. **Demo Note Seeding Flag, Non-Destructive Scope & Deletion Persistence**:
   - Seeding is gated by `DEMO_SEED_KEY = "socratic_demo_seeded_v14"` in `lib/db.js` and user deletion tombstones in `socratic_deleted_notes`. Both `resetNotesData()` and `factoryResetWorkspace()` write this exact key and clear tombstones to prevent demo notes from re-seeding immediately after a deliberate user reset.
   - `initAndSeedDatabase()` and `seedDemoContent()` operate non-destructively and strictly on notes: they never seed or modify Web Saver folders/bookmarks, and never call `db.notes.clear()` or delete existing user notes. User custom notes are 100% preserved. Missing demo notes are inserted, while any note ID recorded in `socratic_deleted_notes` is strictly skipped to prevent deleted demo notes from resurrecting on browser reload.
   - `Workspace.jsx` guards automatic fallback seeding so that deliberate note deletions or an intentionally empty workspace will never trigger unwanted re-seeding.
   - In `components/Sidebar.jsx`, "🌱 Restore Seed Notes" calls `seedDemoContent({ overwrite: false })`, which clears `socratic_deleted_notes` to allow users to explicitly restore sample notes on demand without touching custom notes or bookmarks.
4. **URL Protocol Normalization**:
   - Always wrap external URLs with `formatUrl(url)` before passing to `href` or `src` attributes to prevent relative path redirection (`http://localhost:3000/google.com`).
5. **Next.js Dev Cache Corruption**:
   - If running `npm run build` concurrently while a server is active on port 3000, Next.js chunk cache can become corrupted (`MODULE_NOT_FOUND`). Always terminate active port 3000 processes before running `npm run build`.
6. **WebGL Cleanup, Deep Material Cloning & Frameloop**:
   - Always clean up Three.js materials, procedural canvas textures (`.dispose()`), and geometries on component unmount across all object types (`isMesh || isLine || isPoints`) and restore `document.body.style.cursor = "auto"`.
   - In `scene-kit.jsx`, `WebGLCleanup` traverses materials and unbinds and disposes all texture properties (`map`, `normalMap`, `roughnessMap`, `envMap`, etc.).
   - When customizing materials on cloned GLTF models (`scene.clone(true)`), Three.js does NOT clone materials by default. Always clone `child.material` on traversal before mutating `.opacity` or `.transparent` to avoid corrupting shared cached GLTF assets.
   - Guard `useFrame` callbacks with `Math.min(rawDelta, 1 / 30)` to avoid delta explosion and object teleportation when returning from a backgrounded browser tab.
   - Throttled state updates (such as `StrokeClock` or motion samplers) should be throttled to 24–30 Hz with threshold checks to prevent 60–144 Hz React state thrashing and geometry rebuilds.
7. **Test Suites**:
   - Run `npm test` to execute all unit tests across the entire test suite.
8. **PDF Export & Chromium Print Canvas Dark Mode Reset**:
   - In Chromium/Blink, when printing while the web app is in dark mode, the `@page` margin box (`margin: 1.2cm 1.5cm`) is painted using the root canvas background color (`--color-ink-950`: `#12151e`), creating an unsightly black border framing the printed sheet.
   - Always guarantee pure white pages edge-to-edge by keeping `color-scheme: light !important; background-color: #ffffff !important;` on `:root, html, body` and `@page` in `@media print` (`app/globals.css`), overriding `--color-ink-950` to `#ffffff !important`, and having `exportToPdf()` (`lib/exportImport.js`) temporarily set `document.documentElement.style.colorScheme = "light"` before invoking `window.print()`.
9. **Print / PDF Block Specificity & Toggle Disclosure Alignment**:
   - In `@media print` (`app/globals.css`), avoid generic `input[type="text"]:first-of-type` selectors inside `[data-editor-root]` because they match nested `<input>` children such as media block captions (`data-media-caption="true"`), causing them to explode to 22pt title sizes. Use explicit attribute selectors (`input[data-note-title="true"]`).
   - In toggle collapsible blocks, the print disclosure chevron (`▼`) is centered directly over the 3px vertical accent line of the expanded details container (`border-left: 3px solid #cbd5e1` at `margin-left: 14pt`) by setting `margin-left: 10.5pt !important;` on `[class*="group/toggleblk"] > div:first-child span:first-child`, achieving 0.16px centered alignment.
10. **3D Visualization Studio Canvas Clear Colour (`CANVAS_BG = "#273043"`, `PALETTE.line = "#525e76"`)**:
    - WebGL scenes cannot read dynamic CSS variables in shader pipelines. The clear color in `scene-kit.jsx` is calibrated to `#273043` (mid-tone studio slate) to provide rich contrast and depth for 3D meshes, atoms, and rays in Dark Mode without harsh glare, while avoiding a stark pitch-black void in Light Mode. Applied uniformly across `ThreeDView.jsx`, `app/visualizations/page.jsx`, and `BinaryTree3D.jsx`.
11. **Editor Lasso Marquee & Side Margin Click Boundary Safety**:
    - When clicking on side margins or dragging marquee selection boxes, `data-editor-root` and `handleGlobalMouseUp` check `justFinishedMarquee.current` and verify whether clicks are vertically below `lastRect.bottom` before appending or focusing blocks. Clicks on side margins or following lasso selections never jump to the last block, strictly honoring the `clickToAppend` setting.
12. **React Dynamic Component Hook Rules (`InteractiveTutorial.jsx`)**:
    - When rendering dynamically selected components containing React hooks (such as tutorial chapters or step renderers in `TUTORIAL_STEPS`), NEVER execute them as plain function calls (`{step.render({...})}`). Calling functions with hooks executes them in the outer component's fiber, causing hook count mismatches (React Error #310) when switching between steps with different hook counts. Always render as a JSX element (`<StepComponent key={step.id} {...props} />`), which allocates an isolated child fiber and cleanly unmounts and remounts state on step transitions.
13. **App Router Error Boundaries & Build Artifact Integrity (`app/error.jsx`, `app/global-error.jsx`, `app/not-found.jsx`)**:
    - In Next.js 15 projects using exclusively the App Router, always provide explicit App Router error boundaries (`app/not-found.jsx`, `app/error.jsx`, `app/global-error.jsx`). Without explicit App Router error files, Next.js defaults to Pages Router fallback static generation, which triggers an `ENOENT: rename export/500.html -> server/pages/500.html` error on Windows platforms where the `server/pages/` directory does not exist.
14. **3D Studio Analytical Fourier Discontinuities & Camera View Rig (`MathCanvas.jsx`)**:
    - When drawing discontinuous target wave functions (Square, Sawtooth) in Three.js line strips, never sample $\operatorname{sgn}(\sin(\dots))$ or modulo across fixed spatial grid vertices. Fixed sampling causes vertical edges to render as slanted ramps that snap discretely across grid intervals, resulting in severe vibration and jitter at low speed. Instead, compute the exact floating-point discontinuity coordinates $x_m = \text{CIRCLE\_X} + (\theta - \text{offset}) / \text{WAVE\_K}$ and emit exact vertical step pairs $(x_m, y_{\text{prev}}) \to (x_m, y_{\text{next}})$.
    - For 1-click orthogonal camera view transitions (Front, Top, Barrel, Iso), use an in-canvas `<CameraRig>` that lerps both `camera.position` and `controls.target` smoothly with exponential damping (`1 - Math.exp(-delta * 6.5)`), syncing `controls.update()` each frame to allow seamless orbital takeover by the user.
15. **Simple Machines Kinematics, Rotational Inertia, Class Direction Conventions & Block-and-Tackle Rigging (`SimpleMachinesCanvas.jsx`)**:
    - Levers must respect class-specific Newton vector conventions: Class 1 fulcrum sits between load and effort with downward effort press `[0, -1, 0]`, while Class 2 and Class 3 have the fulcrum at $x = 0$ with load and effort lifting upward `[0, 1, 0]`.
    - Dynamic stroke cadence scales with load mass inertia (`speed / Math.pow(Math.max(loadN, 20) / 200, 0.22)`), giving realistic rotational resistance rather than invariant oscillation.
    - Bench boundary clamping strictly protects downward stroke travel for Class 1 seesaws, while allowing unhindered stroke travel proportional to load arm for Class 2 and 3 upward lifts.
    - Absolute force vector scaling (`1.6 / Math.max(650, loadN, effortForce)`) ensures arrows visibly expand and contract with slider adjustments instead of auto-normalizing to constant sizes.
    - Block and tackle pulley mode features a structural laboratory gantry frame (workbench base footings, dual upright columns, and overhead I-beam crosshead) with upper fixed and lower moving steel cheek housings, axle pins, becket tie-offs, and a forged crane hook.
    - Continuous rope wrapping uses arc tangency interpolation around sheave grooves ($R=0.22\text{ m}$) rather than piercing pulley hubs, correctly anchoring the dead-end to the lower block (odd $n$) or upper block (even $n$).
    - Free hauling lead drops through an exit guide sheave with an ergonomic knurled aluminum handle traveling exactly $n \times \text{loadDistance} \times \text{phase}$ with co-located travel markers. Load safe maintains positive clearance $\ge 0.15\text{ m}$ above workbench.
16. **Archimedes Buoyancy Vessel Realism, Tank Containment & Laboratory Aesthetics (`BuoyancyCanvas.jsx`, `lib/buoyancy.js`)**:
    - Boat hull envelope uses a calibrated 2.0 : 1.2 : 1.0 marine craft aspect ratio ($L = 2.0a, W = 1.2a, H = a$, $a = \sqrt[3]{V_{\text{envelope}} / 2.4}$), strictly preserving $V_{\text{envelope}} = 12 \times V_{\text{material}}$ and $\text{footprint} \times \text{height} \equiv V_{\text{envelope}}$.
    - Overflow tank dimensions are scaled to $34\text{ cm} \times 20\text{ cm} \times 24\text{ cm}$ ($32.9\text{ cm} \times 18.9\text{ cm}$ inner clearance) with water level at $18\text{ cm}$, guaranteeing the vessel remains strictly bounded inside the tank across all volume slider settings ($50 - 500\text{ cm}^3$) with generous clearance on all sides.
    - Procedural `RealisticBoat` component features a 24-station lofted outer hull with flared deadrise topsides, tapered bow with cutwater stem, transom stern plate, centerline keel skeg, open cockpit liner demonstrating trapped air void, titanium marine slate rub-rails (`#5b6b80`), foredeck with polished chrome mooring cleat (`#f1f5f9`), aft quarterdeck, transverse bilge ribs, and a bright blonde teak center thwart bench (`#d4a373`) with chrome marine lifting eyelet aligned with the spring scale suspension line.
    - Color palette and materials elevated to modern luminous laboratory grade: ambient light $0.88$, key light $1.45$, workbench slab `#64748b` with brushed aluminum inlay `#e2e8f0`, gantry frame `#94a3b8`, pure white spring scale face `#f8fafc`, crystalline tank acrylic (`#b8c9dc`, opacity 0.13, transmission 0.78), and radiant, translucent fluid/solid hues (honey `#fbbf24` at 0.58 opacity, freshwater `#38bdf8` at 0.38 opacity, saltwater `#5eead4`, gold `#fde047`, steel `#b8c5d6`).
    - Overflow stream animation is directionally gated (`targetML - shownML > 0.6`): fluid droplets only pour from the spout during positive overflow accumulation, and are immediately suppressed when the specimen volume is reduced or lifted out.
17. **Wave Refraction Optical Media Differentiation & Surrounding Atmospheric Boundary (`PhysicsCanvas.jsx`, `media.js`)**:
    - Outer atmospheric medium (Medium 1) possesses a minimum baseline opacity floor of $0.12$ (`clamp(0.12 + (n1 - 1) * 0.16, 0.12, 0.35)`), ensuring that Air ($n_1 = 1.0$) is prominently visible and differentiated from empty space rather than collapsing to near-zero opacity.
    - Optical media palette provides high-contrast distinct chromatic hues: Air (`#e0f2fe`), Ice (`#67e8f9`), Water (`#0284c7`), Perspex (`#c084fc`), Glass (`#60a5fa`), and Diamond (`#fef08a`), ensuring crisp visual differentiation between inner block and surrounding medium in all combinations.
    - Refracting block features elevated surface boundary lines ($2.8\text{ px}$ at $0.95$ opacity), high-contrast edge caging ($0.92$ opacity), and $0.16$ emissive intensity for clear geometric clarity.
18. **Fleming's Left-Hand Rule & Motor Effect Speed Scaling (`PhysicsCanvas.jsx`)**:
    - `MotorEffectScene` extracts `speed` from its parameters and scales all `<FlowPulses>` instances uniformly: First finger Field (`(0.22 + field * 0.34) * animSpeed`), Second finger Current (`(0.24 + current * 0.42) * animSpeed`), Thumb Force (`(0.2 + force * 0.4) * animSpeed`), and the 4 horizontal dashed magnetic field lines between poles (`(0.1 + field * 0.16) * animSpeed`), ensuring all flowing particles in the scene respond in lockstep to the universal animation speed slider.
19. **Ray Optics Bench, Curved Mirrors & Vector Arrow Scaling (`PhysicsCanvas.jsx`, `scene-kit.jsx`)**:
    - Lathe profiles for spherical mirrors must be calibrated to the bezel casing bounds: concave rim sits flush at $X = 0$ with bezel spanning $X \in [-0.02, +0.22]$, while convex dome crests at $X = -0.04$ with bezel spanning $X \in [0.05, 0.19]$.
    - In `DetailedOptic`, horizontal torus rings across the XZ plane are eliminated to avoid visual bisecting of lenses.
    - `VectorArrow` in `scene-kit.jsx` implements dynamic head length clamping (`Math.min(headLength, length * 0.45)`) and radius scaling, preventing diminutive vectors (such as small focal images) from collapsing or vanishing.
20. **Faraday's Law & Electromagnetic Induction R3F Architecture (`PhysicsCanvas.jsx`)**:
    - **R3F Hook Context Safety**: Components utilizing `@react-three/fiber` hooks (`useFrame`, `useThree`) must never return `<SceneCanvas>` or wrap `<Canvas>`. `InductionScene` renders a single persistent top-level `<SceneCanvas>` and delegates inner animation loops to pure child rigs (`SolenoidRig` and `GeneratorRig`).
    - **Lowered Laboratory Bench & Fixed Meter Anchoring**: `LaboratoryBench` is lowered to $Y = -3.48$ (tabletop surface flush at $Y = -3.30$, thickness $0.36$), with rubber feet extending down to $Y = -3.70$. `LaboratoryGalvanometer` ($X = -1.3, Y = -3.30, Z = 1.35$) and `DemonstrationBulb` ($X = 1.8, Y = -3.30, Z = 1.35$) sit in the clear foreground of the bench ($Z = 1.35$). Crucially, both instrument coordinates are permanent and non-conditional: toggling `showBulb` mounts or unmounts the bulb and branch leads cleanly without shifting the galvanometer or breaking wiring connections. Riser pedestals extend to height $1.70$ (`args={[0.85, 1.7, 3.4]}` at $Y = -2.45$), meeting `MagnetPole` at $Y = -1.60$ flush with zero GPU Z-fighting.
    - **Top Live AC E.M.F. Sine Graph (`EmfTrace`)**: Mounted directly on top of the apparatus at `position={[0, 4.0, 0]}` with title and peak voltage labels at $Y = 5.25$, providing $0.8$ units of clear air above the magnet poles and enabling simultaneous inspection of coil rotation and induced alternating waveform without vertical scrolling.
    - **Perceptual Non-Linear Voltage Power Scaling ($P \propto \mathcal{E}^{1.6}$)**: Avoid low nominal reference voltages that peg power against the ceiling clamp across all slider ranges. Scaled against calibrated ratings ($V_{\text{rated}} = 115\text{ V}$ for generator, $85\text{ V}$ for solenoid) using $\text{power} = \operatorname{clamp}((|\mathcal{E}| / V_{\text{rated}})^{1.6}, 0, 2.8)$. Every step of coil turns $N$, flux density $B$, and magnet strength visibly alters filament temperature and illumination ($0$ to $9.0\text{ lm}$).
    - **Smooth Manual Magnet Kinematics**: In manual mode (`autoOscillate: false`), single-frame discrete position jumps are replaced with exponential velocity smoothing $\Delta x = (\text{targetX} - x)(1 - e^{-9.0 \Delta t})$, ensuring continuous measurable velocity $v$, smooth galvanometer needle deflections, and prolonged bulb glow during manual movement.

21. **Projectile Motion & Air Resistance Kinematics and 60 FPS Vector Architecture (`PhysicsCanvas.jsx`)**:
    - **Upright Forward-Aiming Cannon & Single-Slab Zero-Z-Fighting Runway**: Pinned launch origin at $[0, \text{LAUNCH\_Y}, 0]$ where $\text{LAUNCH\_Y} = RUNWAY\_TOP\_Y + BALL\_RADIUS = 0.41$ ($RUNWAY\_TOP\_Y = 0.28$, $BALL\_RADIUS = 0.13$). The cannon barrel extends forward along $+X$ ($X = 0$ to $X = +0.52\text{ m}$), aiming naturally up into the sky towards the flight path with open muzzle bore at the tip, while the closed breech dome and cascabel knob rest in the carriage cradle at $X \le 0$. The runway slab is a single solid block (`args={[runwayLength, RUNWAY_TOP_Y, 0.72]}`) with $+0.003\text{ m}$ elevated metric ticks and landing rings, completely eliminating duplicate coplanar layers and GPU depth buffer Z-fighting.
    - **Lightened Scientific Instrument Palette**: Upgraded runway to a light porcelain slate bed (`#f8fafc`) with satin aluminum curbs (`#cbd5e1`) and dark graphite graduation ticks (`#334155`). Cannon upgraded to ultra-light polished platinum (`#f8fafc`), champagne brass muzzle crown & bands (`#fde047`), mirror chrome cascabel & trunnions (`#ffffff`), and white protractor quadrant (`#ffffff`).
    - **3D Label Visibility Toggle (`showLabels`)**: Global parameter toggle in `topics.js` allows students and educators to toggle all 3D floating labels on/off with 1 click (cannon angle, force vectors, apex altitude, runway metre graduations, landing targets).
    - **Debounced Slider Interaction & Zero-Latency WebGL Vectors**: Removed component remount `key` and decoupled `MuzzleBlast` from `angleDeg`. Parameter updates feature a 320ms settle debounce, enabling real-time 60 FPS slider trajectory morphing without stuttering or strobe flashes. Direct mesh property mutations (`rotation.z`, `scale.set`, `position.set`) inside `useFrame` eliminate React re-render overhead, updating vectors ($\vec{v}$, $\vec{W}$, $\vec{F}_{\text{drag}}$, and $\vec{F}_{\text{net}}$) at native 60/120/144 FPS with 0ms latency.


---

## 🧪 7. Test Suites & Verification Commands

```bash
# Run all automated test suites
npm test

# Run block mapping validation specifically
npm run check:blocks

# Run production build
npm run build
```
