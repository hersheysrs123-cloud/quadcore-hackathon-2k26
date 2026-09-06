# SocraticOS — Comprehensive Codebase Summary & Handover Guide

> **To any AI Assistant or Developer taking over**: 
> This document provides an exhaustive, authoritative technical overview of **SocraticOS** (`quadcore-hackathon-2k26`). It explains the architecture, local-first IndexedDB storage model, UI component hierarchy, 18-block note editor, 14-topic 3D scientific simulation studio, AI tutoring engine, multi-timer HUD system, export/import engine, design system tokens, and operational gotchas.

---

## 📌 1. Executive Summary & Tech Stack

**SocraticOS** is an intelligent, Notion-inspired learning operating system and 3D scientific visualization studio built on one fundamental principle: **rereading is not studying**. The application pairs rich block-based note-taking with interactive real-time 3D models, structured AI explanations, diagnostic quizzes, Socratic Rubber Duck dialogue, dynamic 3D concept widgets, multi-timer HUDs, website bookmarking with folder hierarchies, and an aggregate mastery heatmap tracking sub-topic confidence over time.

### Tech Stack:
- **Framework**: Next.js 15.0.0 (App Router, Turbopack / Webpack build engine)
- **UI & Logic**: React 19 (Server & Client Components), Tailwind CSS v4 (`@tailwindcss/postcss`, dynamic CSS variable design tokens)
- **Database & Storage**: Local-first IndexedDB via **Dexie.js** (`SocraticOS_LocalDB` v5) — 100% offline, private, zero-latency browser storage for notes, trash, calendar events, study sessions, alarms, folders, bookmarks, and graphics settings
- **AI Integration**: Direct **Google Gemini API** (`lib/gemini.js` with OpenAPI 3.0 schema enforcement) + Client-side Dexie API Key storage with fallback to `/api/` server routes (`app/api/explain`, `app/api/quiz/generate`, `app/api/quiz/grade`, `app/api/socratic/chat`, `app/api/socratic/widget`). `lib/aiService.js` provides isomorphic client/server AI orchestration
- **3D Engine**: Three.js (r185), `@react-three/fiber` (v9), `@react-three/drei` (v10), custom Canvas engines with OrbitControls, procedural geometry, and WebGL lifecycle memory management
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
│   │   ├── socratic/chat/route.js        # POST: Socratic Rubber Duck chat & diagnostic scoring
│   │   ├── socratic/widget/route.js      # POST: Interactive 3D WebGL widget generator
│   │   ├── tutor/chat/route.js           # POST: Interactive AI Tutor chat with space syllabus and academic pedagogy
│   │   └── visualizations/route.js       # Local-first 3D visualizations persistence route
│   ├── globals.css                       # Tailwind v4 tokens, light/dark themes, print stylesheet, KaTeX styles
│   ├── layout.js                         # Root layout, metadata & pre-paint theme bootstrap script
│   ├── page.js                           # Marketing landing page (Server Component, CSS-only animations)
│   ├── visualizations/
│   │   └── page.jsx                      # Standalone 3D visualizer page with topic selector & control HUD
│   └── workspace/
│       └── page.js                       # Main application page (renders <Workspace />)
├── components/
│   ├── AITutorPanel.jsx                  # Interactive AI Tutor drawer: real-time doubts, LaTeX math, quick prompts & space context
│   ├── AddBookmarkModal.jsx              # Quick add/edit bookmark modal with instant URL normalization & live favicon
│   ├── AlarmOverlay.jsx                  # Calming glassmorphic study break modal with gentle chime & snooze controls
│   ├── BlockNoteEditor.jsx               # 17-block Notion-style editor with slash menu, 6-dots handles, covers & stats
│   ├── CalendarView.jsx                  # Study schedule calendar, month navigation, agenda, Pomodoro integration & alarms
│   ├── CommandPalette.jsx                # Ctrl+K global fuzzy search modal for notes, bookmarks, views, and settings
│   ├── ConfidenceHeatmap.jsx             # Per-session sub-topic confidence heatmap (Solid / Shaky / Gap)
│   ├── CreateQuizModal.jsx               # Custom AI Quiz creator modal (difficulty, question type counts, note scope)
│   ├── Drawer.jsx                        # Non-blocking persistent side-by-side study sidebar container for Explain & Quiz
│   ├── ExplainPanel.jsx                  # Structured LLM explanation sidebar (TL;DR, mechanism, analogies, misconceptions)
│   ├── ExportImportModal.jsx             # Multi-format export/import modal (.socratic, HTML Bookmarks, PDF, DOCX, HTML, TXT, MD)
│   ├── ExportPreview.jsx                 # High-fidelity document export preview for Word (.docx), HTML (.html), Plain Text (.txt), and Markdown (.md)
│   ├── FeatureRequestModal.jsx           # User feedback & feature request submission modal
│   ├── GlobalTimerHUD.jsx                # Unified header multi-timer dropdown with Pomodoro, breaks & custom timers
│   ├── InstantNoteModal.jsx              # Ctrl+I 75% screen quick note capture window with space selection
│   ├── MarkdownRenderer.jsx              # Universal rich Markdown renderer (headings, syntax-highlighted code, KaTeX math, tables, lists)
│   ├── MasteryDashboard.jsx              # Space-scoped topic mastery analytics dashboard, interactive space switcher & study recommendations
│   ├── MathText.jsx                      # Universal KaTeX LaTeX & chemical formula renderer for quiz prompts, options & rubrics
│   ├── NoteMenu.jsx                      # Note action menu (Favorite ⭐, 3-Font Typography, Note Stats, Export/Import, Delete)
│   ├── QuizPanel.jsx                     # Dual-tab study sidebar: Graded Quiz + Socratic Rubber Duck dialogue
│   ├── QuizStudioView.jsx                # Dedicated Quizzes Studio tab: exam runner, review reports, trash management
│   ├── ScoreRing.jsx                     # Animated SVG score dial with status coloring
│   ├── Sidebar.jsx                       # Spaces selector, note list, 24h trash drawer, Settings modal & Typed RESET modal
│   ├── SpaceHubView.jsx                  # Dedicated Space Hub dashboard: per-space syllabus docs with active toggles & AI settings
│   ├── ThreeDView.jsx                    # 3D studio container with 14 interactive scientific simulations & HUD
│   ├── WebSaverView.jsx                  # Dual-pane Website Saver & Folder Manager with drag-and-drop tree & grid/list views
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
│   ├── backup.js                         # .socratic JSON workspace & space backup packager with folder/bookmark support
│   ├── blocks.js                         # Text extractors & concept mappers from blocks
│   ├── constants.js                      # Default SPACES definition (School, Personal, Misc, Journal)
│   ├── db.js                             # Dexie.js IndexedDB schema v5, auto-seeding & graphics detection
│   ├── demoNotes.js                      # 7 comprehensive seeded notes across all 4 spaces with full 17-block suites
│   ├── editorCaret.js                    # Notion-grade caret navigation, visual line calculations, inline math compilation & boundary traversal
│   ├── exportImport.js                   # Full export/import engine for Netscape HTML Bookmarks, PDF, DOCX, HTML, MD, TXT
│   ├── gemini.js                         # Direct REST Gemini client with structured outputs & usage tracking
│   ├── mastery.js                        # Mastery status vocabulary (Solid ● / Shaky ◐ / Gap ○) & rollup algorithms
│   ├── mathUtils.js                      # LaTeX delimiter parsing & regex segmentation for MathText
│   ├── schemas.js                        # OpenAPI 3.0 schemas for Gemini structured outputs
│   ├── storageService.js                 # Dexie CRUD service for notes, folders, bookmarks, trash, calendar, alarms, sessions & reset
│   ├── syntaxHighlighter.js              # Tokenizer & syntax highlighter for 10 programming languages
│   ├── timerStore.js                     # Reactive multi-timer store with localStorage sync & alarm events
│   └── urlUtils.js                       # URL normalization, domain extraction, Google favicon generator & title heuristics
├── tests/
│   ├── unit/
│   │   ├── inline-math-navigation.test.mjs # Milestone 1: Seamless block navigation, math pill boundary traversal & auto-compilation
│   │   ├── web-saver.test.mjs            # URL normalization, domain parsing, Netscape HTML export/import round-trips
│   │   ├── physics-solvers.test.mjs      # Refraction (Snell's law), thin lenses, gas laws, chemistry formulas
│   │   ├── avl-tree-3d.test.mjs          # 3D BST & AVL auto-balancing tree math & traversals
│   │   ├── export-import.test.mjs        # Markdown, HTML, DOCX, TXT lossless round-trips & blob generation
│   │   ├── mastery-analytics.test.mjs    # Mastery rollup algorithms, trends, and weakest-first sorting
│   │   ├── quiz-grading.test.mjs         # Deterministic integer MC grading & fallback heatmap normalizer
│   │   ├── timer-store.test.mjs          # Multi-timer countdown math, duration clamping, pause/resume
│   │   ├── syntax-highlighter.test.mjs   # 10-language tokenizer & syntax highlighting rules
│   │   ├── password-security.test.mjs    # Space UTF-8 base64 encoding & non-Latin1 DOMException protection
│   │   └── table-block.test.mjs          # Interactive Table block parsing, HTML/plain-text conversion & serialization
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
  6. `bullet`: Unordered list item with auto-continuation, unified Backspace un-listing to text before deletion/merging, and escape on empty Enter.
  7. `number`: Ordered list item with dynamic sequential counting (`1.`, `2.`, `3.`) and Backspace un-listing.
  8. `todo`: Interactive checkbox with task strikethrough, `[x]` / `[X]` checked markdown shortcuts, clean split marker stripping, and database synchronization.
  9. `toggle`: Collapsible container with toggle arrow (`▶`/`▼`), dual-zone editing with seamless vertical arrow navigation (summary header `ArrowDown` steps into open details `<textarea>`; details `ArrowUp` at offset 0 returns to summary header), multi-line details with boundary `ArrowLeft`/`ArrowRight`, and Backspace un-listing.
  10. `callout`: Highlighted frame with 8 icon presets (`💡`, `⚠️`, `📌`, `🔥`, `⭐`, `🎉`, `ℹ️`, `🦆`) and click-away dismissal.
  11. `table`: Interactive grid table block with streamlined Notion styling (no title input clutter; compact header with `▦ Table` label and dimension badge `Rows × Cols`), rich markdown & KaTeX cell rendering (`TableCell`), interactive inline LaTeX editing via click popover with presets and deletion, clean `$formula$` typing, dynamic cell editing, `+ Column` / `+ Row` controls, column and row deletion (`✕`) with complete Undo/Redo (`Ctrl+Z`/`Ctrl+Y`), header row toggle, vertical arrow navigation across all intermediate rows (`Header` ↔ `Row 0` ↔ `Row 1`... ↔ `Exit`), horizontal arrow cell hopping (`ArrowLeft`/`ArrowRight`), headerless table `ArrowUp` exit, bottom-right cell upward entry, container card `Backspace`/`Delete` removal, and `Tab` / `Shift+Tab` keyboard cell navigation.
  12. `quote`: Blockquote with thick accent border.
  13. `math`: Full-width LaTeX equation block with live KaTeX rendering, intelligent visibility check with comfortable font scaling floor (`MIN_SCALE = 0.75`), dynamic horizontal scroll container with mouse wheel horizontal panning (`overflow-x-auto`), direct viewport click-to-edit, streamlined single `✨ Presets ▾` toggle button with expandable template & symbol tray, multi-line LaTeX traversal (`Shift+Enter` with line-by-line arrow navigation before boundary exit), horizontal arrow exit (`ArrowLeft`/`ArrowRight`), container card `Backspace`/`Delete` removal, and auto-save on arrow navigation.
  14. `inlinemath`: In-sentence LaTeX formula (`$formula$`) with Notion-style clear rendering (transparent background, borderless, text-matching color, soft hover feedback, and no side handles or pill borders), click popover editor, 10 formula presets, and 20 math symbols.
  15. `divider`: Horizontal divider (`hr`) with keyboard navigation (`ArrowUp`/`ArrowDown`) and backspace/delete removal.
  16. `site`: Site bookmark card with live Google Favicon resolution and URL normalization.
  17. `media`: Visual media embed supporting direct URLs and local file uploads for Images (PNG, JPG, GIF, WebP, SVG) and **YouTube Video Embeds** (`https://www.youtube-nocookie.com/embed/...` responsive 16:9 aspect-ratio iframe player, timestamp support `?t=120`, automatic YouTube URL detection, editable captions, and **width resize presets** `25%` / `50%` / `100%` for compact text flow).
  18. `code`: Code snippet block with 10-language syntax highlighting (JS, TS, Python, HTML, CSS, C++, Java, Rust, SQL, JSON), synchronized line numbers gutter (`1, 2, 3...`), 2-space `Tab` and `Shift+Tab` indentation, auto-indent on `Enter`, 1-click Copy with feedback tooltip, seamless inline backtick code (`` `x` ``) boundary caret navigation, non-premature last line vertical exit (only exiting when caret reaches snippet end), horizontal arrow boundary exit (`ArrowLeft` at 0 / `ArrowRight` at end), card `Backspace`/`Delete` removal, and upward entry caret placement at snippet end.
  19. `columns`: Multi-column split layout block supporting 2 to 5 columns with borderless Notion styling, dedicated `/2 columns` - `/5 columns` slash menu items, responsive grid cards (`grid-cols-1 md:grid-cols-2` up to `grid-cols-5`), individual column header titles with `Enter` advancing to column content (avoiding newline breaks), bidirectional vertical traversal (`content` first-line `ArrowUp` ↔ `title`), cross-column `ArrowLeft`/`ArrowRight` and `Tab`/`Shift+Tab` navigation, container card `Backspace`/`Delete` removal, rich editable multi-line bodies with live KaTeX `$formula$` and `` `code` `` rendering, and `ArrowDown` boundary exit.
- **Universal Cross-Block Focus Engine & Natural Arrow Navigation (`focusBlock`)**:
  - Centralized `focusBlock(targetBlock, position = "start" | "end")` dispatcher ensuring deterministic focus and caret placement across all 19 block types (`text`, `h1`–`h4`, `bullet`, `number`, `todo`, `toggle`, `quote`, `callout`, `divider`, `code`, `math`, `inlinemath`, `table`, `columns`, `site`, `media`).
  - **Ref Registration Protection**: `EditorBlock` guards ref registration with `if (registerRef && contentRef.current)`, preventing child refs (e.g. `CodeBlock`'s `textareaRef`) from being overwritten by `null`.
  - **Bidirectional Vertical Traversal (`handleExitDown` / `handleExitUp`)**: Moving downward smoothly places caret at the logical start of any block (including `MathBlock`, `ColumnsBlock`, and embed cards). Moving upward lands at the true end of the previous block (bottom-right cell of `TableBlock`, end of snippet in `CodeBlock`, last column content in `ColumnsBlock`).
  - **Seamless Horizontal Transitions (`ArrowRight` at block end)**: Steps seamlessly from text blocks into complex and embed blocks without trapping the cursor.
  - **Safe Block Deletion & Slash Transformation**: Deleting empty blocks below complex blocks cleanly returns focus to the preceding block; converting blocks via `/math` or `/columns` smoothly retains focus without mouse interaction.
  - **Document Boundaries & Note Title Integration**: Pressing `ArrowDown` or `Enter` in the Note Title focuses Block 0 across any complex block type via `focusBlock(blocks[0], "start")`. Pressing `ArrowUp` or `ArrowLeft` from the top of Block 0 steps cleanly up into the Note Title input at the end of the title text (`noteTitleInputRef`).
  - **Native Keyboard Divider Navigation**: Removed divider bypass loops; `divider` blocks are directly selectable with arrow keys, with `Backspace`/`Delete` removal and `ArrowUp`/`ArrowDown` traversal.
  - **Dynamic Multi-Scale Visual Line Calculations**: `isCaretOnFirstVisualLine` and `isCaretOnLastVisualLine` compare caret coordinates against rendered character start/end ranges backed by dynamic computed style line-height (`Math.max(28, padding + lineHeight * 0.6)`), ensuring accurate vertical line exits across all heading sizes (`h1`–`h4`) and zoomed viewports.
  - **Selective Insertion Dropzones**: Interactive insertion dropzones directly beneath complex/container blocks (`math`, `code`, `table`, `toggle`, `columns`, `site`, `media`, `divider`) allow single-click cursor placement right below the block without modifier keys. Omitted on linear blocks (`text`, `h1`–`h4`, `bullet`, `number`, `todo`, `inlinemath`, `callout`, `quote`) where standard `Enter` naturally appends new blocks.
- **Notion-Grade Line Splitting & Backspace Merging (`splitBlockDOMAtRange` & `getDOMCaretLength`)**:
  - **Clean Enter Splitting**: Pressing `Enter` anywhere in a text, list, heading, quote, or callout block cleanly splits text into two blocks. Preserves inline math pills (`$formula$`) and code spans (`` `code` ``) without text corruption, strips redundant leading list markers (`- `, `1. `, `[ ]`), resets new todo block state (`checked: false`), and automatically spawns plain text paragraphs below headings and quotes.
  - **Exact Caret Placement on Backspace Merge**: Merging at offset 0 measures the true TreeWalker DOM offset via `getDOMCaretLength(prevEl)` (ignoring internal KaTeX rendered subtrees), synchronously applies merged content via `setBlockDOMFromText`, and places the cursor at the exact merge point via `setCaretAtOffset(targetEl, domCaretOffset)`.
  - **Forward Delete Pull & Merge (`Delete` at block end)**: Pressing `Delete` at the end of a block cleanly pulls up and merges the next text block into the current block maintaining caret position, removes subsequent empty blocks or standalone embeds (divider, site, media, canvas), or steps into complex cards without dropping focus.
  - **Ghost-Free Empty Block Deletion**: Deleting empty blocks with `Backspace` between complex blocks reliably returns focus to the preceding block with double-tick rAF protection.
  - **Bottom Whitespace Focus**: Clicking empty whitespace below the document root focuses the last block at the end of text via `setCaretToEnd(el)` without spawning duplicate empty blocks.
  - **Clean Persistence & Zero-Width Sanitization (`cleanZeroWidth`)**: Strips zero-width unicode artifacts (`\u200B`, `\u200C`, `\u200D`, `\u2060`, `\uFEFF`, `\u0000`) across DOM deserialization (`getBlockTextFromDOM`), database persistence (`storageService.saveNote`), AI context extraction (`editorBlocksToText`, `extractHeadingsFromBlocks`), and document exports (`filterBlocksForExport`).

- **Notion-Style Right-Side Outline (Table of Contents)**:
  - Dynamically scans `h1`, `h2`, `h3`, `h4` headings across the document.
  - Sits on the right margin with a collapsible floating pill toggle `📑 Outline (N)` and expanded outline drawer.
  - Active scroll spy: Automatically highlights the heading currently in reading focus (`border-l-2 border-duck-400 bg-duck-500/15`).
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
  - **Bullet & List Formatting Preservation (`BUG-PASTE-02`)**: Safely strips list item bullet prefixes without stripping bold (`**`) or italic (`*`) delimiters, preserving bold, italic, and bold-italic styling at the beginning and within bullet items.
  - **Bullet Type & Indent Level Retention**: Pasting text into active `bullet`, `number`, or `todo` blocks preserves the parent block type and indentation level (`level`) rather than converting to plain text paragraphs.
  - **Robust Nested Bold & Italic Compiler (`formatMarkdownInline`)**: Supports nested bold and italic (`**bold with *italic* inside**`, `*italic with **bold** inside*`, `**_text_**`, `_**text**_`, `***text***`), and only promotes lines to `h3` category subheadings when explicitly ending with a colon (`* **Heading:**`).
  - Seamlessly falls back to `parseMarkdownToBlocks` when pasting pure Markdown, plain text, or Excel / Sheets TSV tables.
- **Floating Text Selection Popover Toolbar (`TextSelectionToolbar`)**:
  - Automatically appears above any highlighted text across any editable block, list, heading, quote, callout, or table cell.
  - Action buttons: **Bold** (`B`), **Italic** (`I`), **Underline** (`U`), **Cross / Strikethrough** (`S`), **Convert to Code** (`</>`), **Convert to Formula** (`$x$`), ✨ **Explain with Socratic AI**, and 🦆 **Quiz me on Selection**.
  - **Focus & Caret Retention**: Converting text to math or code synchronously compiles into rich elements, re-focuses `contentEditable`, and advances the caret without losing document focus (`BUG-FMT-18`).
  - **Underline Persistence (`BUG-FMT-29`)**: Underline `<u>` elements are preserved losslessly across DOM serialization (`getBlockTextFromDOM`), markdown inline formatting (`formatMarkdownInline`), and editor state updates.
  - **Formatting Boundary Caret Escaping (`BUG-FMT-02`)**: Setting the caret at the boundary end of formatted spans (`**bold**`, `*italic*`, `<u>underline</u>`) places the caret in a trailing text node outside the formatting element, preventing subsequent typing from being inadvertently styled.
  - **Punctuation-Aware Auto-Formatting (`BUG-AUTO-25`)**: Typing closing backticks (`` `code` ``) or dollar signs (`$formula$`) immediately before punctuation marks (`.`, `,`, `!`, `?`, `:`, `;`, `)`, `]`, `}`) suppresses unwanted extraneous space insertion.
  - **Popover & Slash Menu Blur Focus Restoration (`BUG-MATH-28` & `BUG-SLASH-19`)**: Saving, deleting, or closing `InlineEquationPopover` and `SlashMenu` cleanly returns active focus to the host block's `contentRef` or table cell without dropping to `document.body`.
  - **Soft Tab Indentation & Outdent (`BUG-TAB-01`)**: Pressing `Tab` inside paragraphs, lists, quotes, and callouts inserts 2 soft spaces at cursor position rather than losing focus to the browser window; `Shift+Tab` cleanly outdents leading indentation.
  - **Pasting Caret Landing Position (`BUG-PASTE-01`)**: Pasting multi-block markdown or HTML places the caret at the true end of the pasted content across all block targets.
  - **Undo/Redo & Multi-Block Selection Focus Retention (`BUG-UNDO-01` & `BUG-SEL-01`)**: Global undo/redo and deleting multi-block marquee selections seamlessly retains focus on the target or adjacent remaining block instead of dropping focus to `document.body`.
  - **Code Snippet Multi-Line Boundary Traversal (`BUG-CODE-07`)**: Full isolation of textarea arrow navigation from parent container listeners via event bubbling guards and `stopPropagation`, ensuring natural multi-line editing, left/right character hopping, and clean boundary exits on first/last lines.
  - **Title-to-Block Seamless Arrow Navigation (`BUG-TITLE-20`, `21`, `22`, `23`)**: Bi-directional vertical and horizontal arrow keys step seamlessly between Note Title and Block 0.
  - **Document Boundary Caret Safety (`BUG-DOWN-01`)**: Pressing `ArrowDown` on the final block (empty or filled) stays gracefully at document boundary without creating unwanted ghost blocks.
  - **Special Block Backspace Caret Transfer (`BUG-DEL-26`)**: Pressing `Backspace` on an empty line following special blocks (`code`, `table`, `math`, `columns`, `divider`, `site`, `media`, `canvas`) removes the empty line and places caret cleanly in the special block above, rather than deleting the preceding block.
  - **Columns Split Block Deletion & Keyboard Navigation (`BUG-COL-14`)**: Unconditional deletion of multi-column blocks on `Backspace` or `Delete` when selected via marquee, 6-dots grip handle, card margin click, or `Escape` key, plus clean deletion when empty, bidirectional caret hopping between column titles and contents, and activeElement blur coordination.
  - **Table Enter Key Behavior (`BUG-TBL-15`)**: Pressing `Enter` inside a table cell never automatically adds new rows or columns; pressing `Enter` at the last row and last column smoothly advances to the next block (or appends a text block at the document bottom) and places the caret there.
  - **Window Keydown Isolation (`BUG-DEL-27`)**: Global multi-block keydown listeners immediately yield when any text input or contentEditable element is active, ensuring Backspace on empty lines never inadvertently deletes preceding special blocks.
  - **Container Backspace Isolation & Editable Child Focus (`BUG-DEL-28`)**: Special block card containers (`table`, `math`, `code`, `columns`, `divider`, `site`, `media`, `canvas`) strictly ignore `Backspace` and only accept `Delete` (Forward Delete), preventing accidental deletion of special blocks when caret steps backward from below. Math blocks focus their editable title inputs on reverse step.
  - **Math Block Title Bidirectional Navigation (`BUG-MATH-08`)**: Math equation titles support comprehensive keyboard traversal: `ArrowUp` exits upward to previous block, `ArrowDown` steps into formula editor (or exits downward), `ArrowLeft` at start exits upward, `ArrowRight` at end steps downward, and `Enter` smoothly toggles formula editing.
  - **Multi-Selection Isolation & Divider Reverse Step (`BUG-DEL-29`)**: Window multi-block keydown handler strictly activates when `selectedBlockIds.size > 0`, completely preventing single active blocks (`selectedId`) like dividers, media, sites, or canvases from accidental deletion on Backspace. Divider blocks now step upward to the preceding block on Backspace.
  - Non-blurring action triggers via `onMouseDown` event prevention and auto-adjusting viewport boundary positioning.
  - **Instant Markdown & KaTeX Compilation**: Formula and code conversions compile synchronously into interactive KaTeX pills and styled code tags on click without requiring Enter/blur.
  - **Hierarchical Sub-Bullets & Keyboard State Machine**:
    - Full multi-level nesting for bullet blocks (`level: 0` to `level: 4`).
    - **Tab**: Indents active bullet (empty or with text) to a sub-bullet (`level = level + 1`).
    - **Shift+Tab**: Unindents active sub-bullet (`level = level - 1`). If unindented at `level: 0` while empty, converts the block to a plain text paragraph.
    - **Enter**: Pressing Enter on an empty sub-bullet unindents by 1 level before exiting to text; pressing Enter on a non-empty sub-bullet inherits the current level onto the newly created bullet below.
    - **Backspace**: Pressing Backspace at offset 0 of a sub-bullet unindents by 1 level before converting to plain text.
    - **Hierarchical Glyphs & Indentation**: Level 0 renders a solid filled circle (`●`), Level 1 renders a hollow ring (`○`) with `1.5rem` indent, Level 2 renders a solid square (`■`) with `3.0rem` indent, and Level 3+ renders a hollow square with `4.5rem+` indent.
  - **Complete Table & Block Undo/Redo Integration**: Captures immutable pre-format state snapshots (`recordHistorySnapshot`), allowing seamless `Ctrl+Z` / `Ctrl+Y` across all block types, sub-bullet indentations, and matrix cells.
- **In-Context Slash Menu (`/`)**: Typing `/` triggers a floating block-type selector directly beneath the active line, supporting quick filters for `/columns`, `/2 columns`, `/3 columns`, `/4 columns`, `/5 columns`, `/split`, `/compare`, `/youtube`, `/video`, `/media`, `/table`, `/math`, etc. Dismissing via `Escape` or outside click immediately returns focus to the block.
- **Notion 6-Dots & Right-Click Context Menu**:
  - Accessible via hovering the `⠿` grip handle or **right-clicking anywhere on the block**.
  - Clean block-level actions: ✨ **Explain Block**, 🦆 **Quiz on Block**, Duplicate (📋), Move Up/Down (⬆️/⬇️), Copy Text (📄), and Turn Into Submenu. Dismissible via click-outside or `Escape`.
- **Cover Banners & Custom Icons**: 100% full-width cover banners with 5 gradient presets (*Cyberpunk*, *Sunset Amber*, *Ocean Teal*, *Midnight Blue*, *Socratic Gold*) and custom emoji picker (`NOTE_EMOJIS`).
- **5 Custom Typography Font Options & Note Menu Selector**:
  - 5 academic & creative font options: **Default Sans** (`font-note-sans`), **Classic Serif** (`font-note-serif`), **Developer Mono** (`font-note-mono`), **Script / Handwritten** (`font-note-handwriting`), and **Geometric Grotesk** (`font-note-geometric`).
  - Notion-style segmented font selector at the top of `NoteMenu` (`⋯`), allowing instant one-click switching with live preview glyphs (`Ag`).
  - **Per-Note Isolation & Persistence**: Font choices persist independently in IndexedDB via `saveNote({ ...note, fontStyle })` without altering other notes in the workspace.
- **Full Width & Lock Page Toggles (`components/NoteMenu.jsx` & `components/BlockNoteEditor.jsx`)**:
  - **Full Width**: Notion-style toggle switch row under "Move to Space" in NoteMenu switching the document layout between standard reading column (`max-w-3xl px-10`) and edge-to-edge canvas (`w-full max-w-none px-6 md:px-12`). Persists per-note via `fullWidth: boolean`.
  - **Lock Page**: Notion-style toggle switch row under "Full width" making the document strictly read-only (`isLocked: boolean`). When active: renders a subtle top-right lock icon button (under top bar) with an instant "Unlock" action and tooltip, sets title input to `readOnly`, hides header action strips and banner controls, disables icon changes, sets `contentEditable={false}` across all blocks and table cells, hides gutter drag/delete buttons, and disables right-click and slash menus.
- **Real-Time Note Stats**: NoteMenu calculates total characters, total words, total blocks, and estimated reading time across all block contents, toggle details, and math formulas.
- **Auto-Instantiation & Click-to-Append**: Typing inside an empty space automatically instantiates a note. Clicking blank space below the editor appends a new block.
- **Debounced Auto-Save & Unmount Flush Engine**:
  - All block mutations (`handleChange`, `handleSmartPaste`, `handleAddAfter`, `handleDeleteBlock`, `handleMoveBlock`, `handleDuplicateBlock`, `handleChangeType`, table cell edits, math updates, banner, font style, fullWidth, isLocked, and emoji adjustments) automatically trigger a 400ms debounced save (`triggerDebouncedSave`).
  - `performSave` packages complete note payloads (`id`, `spaceId`, `title`, `blocks`, `banner`, `fontStyle`, `fullWidth`, `isLocked`, `isFavorite`, `emoji`).
  - `BlockNoteEditor` maintains an unmount cleanup effect that immediately flushes dirty state with explicit note and space IDs upon space switching or navigation, preventing data loss.
  - `Workspace.jsx` maintains an active `editorBlocksRef` to guarantee that manual saves (`Ctrl+S`, `NoteMenu`, favorite toggles) never overwrite live editor content with stale initial state.
- **High-Performance Lasso / Marquee Multi-Block Selection**:
  - Document-anchored selection box (`absolute` coordinate space) with 60/120fps `requestAnimationFrame` loop.
  - Continuous edge proximity auto-scrolling (up to 35px/frame) allowing seamless selection across long notes far beyond the viewport.
  - Batch intersection calculations and set equality state caching for zero-lag drag performance.

---

### 🔍 B. Universal Navigation, Command Palette, Sidebar & Instant Capture
- **Streamlined Dual-Level Navigation Architecture** (`components/Workspace.jsx` & `components/Sidebar.jsx`):
  - **Top Header (Space-Specific Study Suite)**: Dedicated strictly to the space-filtered views: 📝 **Notes**, 🎯 **Quizzes Studio**, and 📊 **Mastery Dashboard** (with active gap count badge). Clean breadcrumb indicating current space and open note title (or `Space Hub · {activeSpace}`).
  - **Sidebar (Global Workspace Tools, Space Switcher & Space Hub)**: Houses system-wide tools in a compact 4-column icon grid (Instant Note `⚡`, 🌌 3D Simulations, 📅 Calendar with `GlobalTimerHUD`, and 🔖 Web Saver & Bookmarks), followed by the Spaces dropdown switcher and the prominent **Space Hub** button (`⚙️ Space Hub · Syllabus`) navigating to the full-page dashboard.
- **Space Hub Dashboard & Curriculum Management Engine (`components/SpaceHubView.jsx`)**:
  - Full-page dedicated hub for managing per-space curriculum boundaries and AI examiner behaviors.
  - **Multiple Documents per Space**: Upload and store multiple syllabus documents (`.pdf`, `.docx`, `.txt`, `.md`) directly within each space.
  - **Active AI Toggles**: Each document features an instant toggle switch (`active` / `inactive`), controlling exactly which curriculum files are concatenated and fed into the AI during quiz generation, grading, and Socratic dialogues.
  - **AI Pedagogy & Examiner Settings**:
    - **Academic Standard / Grade Level**: General, IGCSE / O-Level, IB Diploma (HL/SL), AP / College Board, University, Olympiad / Competition.
    - **AI Persona & Tone**: Standard Examiner, Strict Examiner, Socratic Guide, Friendly Coach, Olympiad Mentor.
    - **Distractor Toughness & Rigor**: Relaxed, Standard, High Rigor.
  - **Space Customization**: Custom icon emoji, descriptive tagline/blurb, and space accent color tint.
  - **Quick 1-Click Presets**: Instant load presets for Cambridge IGCSE, IB Diploma HL, AP Prep, and Foundational mastery.
- **Interactive AI Tutor Doubt-Clearing Suite (`components/AITutorPanel.jsx` & `app/api/tutor/chat/route.js`)**:
  - Accessible via the **🧑‍🏫 AI Tutor** button in the top HUD action bar.
  - **Full Space Curriculum Feeding**: Dynamically resolves and feeds all uploaded documents marked as *"Fed to AI"* for the active space.
  - **Pedagogy Alignment**: Injects the active space's Academic Standard / Grade Level (IGCSE, IB HL, AP, College, Olympiad), AI Persona & Tone, and Strictness / Rigor level into the tutor prompt.
  - **Active Note Context**: Injects the active note's full text content so the learner can highlight doubts directly from their notes.
  - **KaTeX & LaTeX Math**: Real-time rendering of mathematical formulas, equations, matrices, and chemical notations using `MathText`.
  - **Quick Doubt Starters**: 1-click query pills (*"Explain this step-by-step with intuition"*, *"What are common exam traps here?"*, *"Give me a concrete real-world example"*, *"Derive the formula"*).
  - Clear history, copy responses, and unconstrained doubt dialogue.
- **Command Palette (`Ctrl+K` / `Cmd+K`)** (`components/CommandPalette.jsx`): Global fuzzy search for notes across all spaces, navigation views (Notes, Calendar, 3D Studio, Mastery Dashboard), and settings.
- **Compact Instant Note Capture (`Ctrl+I` / `Cmd+I`)** (`components/InstantNoteModal.jsx` & `components/Sidebar.jsx`): Integrated directly into the Global Tools icon grid (`⚡`) for immediate drafting with `Ctrl+Enter` quick save to the **"Misc"** space (or user-selected space).
- **Quick Save (`Ctrl+S`)**: Explicit keyboard shortcut to instantly save the active note.

---

### 🧪 C. Interactive 3D Visualization Studio (`components/ThreeDView.jsx`, `topics.js`, `VisualizationHUD.jsx`)
A comprehensive suite of 25 real-time interactive 3D simulations across 5 STEM domains with dual-tab HUD (Controls & live Details readout with complete Visual Color Keys):

1. **Physics Engine** (`PhysicsCanvas.jsx`):
   - **Wave Refraction & Snell's Law** (`refraction`): Multi-medium light ray refraction, critical angle calculation, total internal reflection, Fresnel reflection rays, and lateral displacement.
   - **The Motor Effect & Fleming's Left-Hand Rule** (`motor`): Magnetic field lines ($N \to S$), current flow wire, Lorentz force vector, and Fleming's left hand orientation.
   - **Thin Lens Optics & Ray Diagrams** (`lenses`): Convex/concave lenses, principal axis, focal points, parallel/center rays, real/virtual images, and virtual ray back-extensions.
   - **Electromagnetic Induction** (`induction`): Faraday/Lenz's law, rotating copper coil, magnetic pole blocks, induced AC current pulses, and real-time EMF waveform trace.
   - **Kinetic Gas Laws ($PV=nRT$)** (`gas`): Bounded cylinder with hot/cold kinetic gas particles, moveable piston, and wall collision impulses.
   - **2D Projectile Motion** (`projectile`): Ballistic flight with quadratic drag, ideal parabolic trajectory comparison, tangent velocity $\vec{v}$, and gravity weight $\vec{W}$.
   - **Wave Interference & Double Slits** (`interference`): Wave crests/troughs, coherent slit emitters, double-slit barrier, and screen intensity fringe maxima.
   - **Keplerian Orbits & Gravity Wells** (`orbits`): Gravitational spacetime potential well ($-GM/r$), central massive body, orbiting satellite, and elliptical/hyperbolic orbital trails.

2. **Chemistry Engine** (`ChemistryCanvas.jsx`):
   - **Bohr Atom & Emission Spectra** (`bohr`): Quantized electron shells, core/valence electrons, and photon emission spectral wave packets.
   - **Organic Chemistry Builder** (`organic`): Homologous series (Alkanes, Alkenes, Alkynes, Alcohols) with carbon backbone, hydrogen, oxygen, single sigma, and double/triple pi bonds.
   - **Fractional Distillation Column** (`distillation`): Multi-stage fractionating column, boiling point gradient, and color-coded petroleum fractions (Refinery gases to Bitumen).
   - **3D Crystal Lattices** (`lattice`): Giant ionic and covalent lattices: $\text{NaCl}$ (FCC), Diamond ($sp^3$), Graphite ($sp^2$ layers with delocalised electrons and van der Waals forces), Quartz ($\text{SiO}_2$), and Ice ($\text{H}_2\text{O}$ hydrogen-bonded cages).
   - **Electrolysis of Aqueous $\text{CuSO}_4$** (`electrolysis`): $\text{Cu}^{2+}$ cations, $\text{SO}_4^{2-}$ anions, cathode reduction plating, anode oxidation dissolution, and circuit current flow.
   - **VSEPR Molecular Geometry** (`vsepr`): Steric numbers 2–6, central atom, bonded ligands, non-bonding lone pair electron clouds, covalent bonds, and bond angle arcs.
   - **Reaction Energetics & Catalysis** (`energetics`): Exothermic/endothermic reaction profile curves, transition states, forward/reverse activation energy $E_a$, enthalpy change $\Delta H$, and catalysed pathway curves.

3. **Biology Engine** (`BiologyCanvas.jsx`, `RespiratoryCanvas.jsx` & `cell-organelles.jsx`):
   - **Plant & Animal Cell Explorer** (`cell`): Nucleus, mitochondria, chloroplasts, endoplasmic reticulum, Golgi apparatus, permanent vacuole, cell membrane, and cellulose cell wall with osmotic tonicity states.
   - **Enzyme Kinetics & Denaturation** (`enzyme`): Lock-and-key substrate binding, active catalytic cleft, thermal/pH denaturation, and released product molecules.
   - **DNA Double Helix Structure** (`dna`): Antiparallel sugar-phosphate backbones, complementary base pairs (Adenine, Thymine, Guanine, Cytosine), and hydrogen bond rungs.
   - **Protein Secondary Structure & Folding** (`protein`): $\alpha$-Helix ($i \to i+4$ H-bonds, 3.6 residues/turn), $\beta$-Pleated Sheet, random coils, hydrophobic core packing vs hydrophilic surface residues, and thermal denaturation.
   - **Respiratory Mechanics & Thoracic Physics** (`respiratory`): Photorealistic 3D anatomical and physiological thoracic simulation completely devoid of legacy procedural placeholders, powered purely by genuine clinical CT-derived thoracic skeleton (`skeleton_ct.glb`, 16.3 MB; isolated 24 ribs, T1–T12 thoracic vertebrae, L1–L3 lumbar crura anchors, sternum, xiphoid, and clavicles) with active bucket-handle lateral elevation and pump-handle AP sternal elevation, photorealistic medical lungs scan (`lung.glb`, 17.1 MB; scale 11.2, upright orientation, volume-scaled), multi-layer antagonistic intercostal muscle bands spanning all 11 intercostal spaces with 6 discrete fascicle pairs per side for both superficial external $+35^\circ$ (inspiratory) and deep internal $-45^\circ$ (forced expiratory) layers with rich crimson (`#881337`) resting state and scarlet emissive glow (`#ef4444`) with layer isolation selectors, muscular diaphragm dome morphing (parametric 32-segment radial dome dynamically flattening on contraction $Y = 1.05 \to 0.63$ vs high-dome elastic recoil) with trifoliate pearly central tendon (*centrum tendineum*), 3 anatomical apertures (Caval T8, Esophageal T10, Aortic T12), liver asymmetry elevation, and bilateral vertebral crura, dynamic airway particle stream vectors driven by Boyle's Law pressure gradients ($P_1 V_1 = P_2 V_2$), 3-state phase selector (`[Inspiration]`, `[Quiet Expiration]`, `[Forced Expiration]`), auto-loop breathing cycle with adjustable BPM, cross-section cutaway slider, 3D kinematic motion arrows, eye-level camera framing, collapsible HUD panel with maximize/minimize toggle, live SVG physics gauges (Thorax Volume L, Intra-thoracic Pressure $\Delta P$ kPa, Air Flow Rate $\dot{V}$ L/s), and an interactive **Open-Source Model Attribution & Credits Suite** (`RESPIRATORY_MODEL_CREDITS`) with multi-point triggers (HUD header button, viewport floating pill, in-HUD deep link) expanding into a glassmorphic attribution modal detailing license terms (MIT & AGPL v3/Educational) and direct links to upstream GitHub repositories.

4. **Computer Science Engine** (`CSCanvas.jsx` & `BinaryTree3D.jsx`):
   - **3D Binary Search Tree / AVL Tree** (`binary_tree`): Interactive node insertion, searching, depth planes, and animated in-order, pre-order, and post-order traversals with complete Visual Tree Keys (Idle, Comparison, Found, Missing, Selected, Branch Edges).
   - **3D Sorting Algorithm Visualizer** (`sorting`): Bubble, Insertion, Selection, Quicksort, and Merge Sort with unsorted bars, comparison highlights, swap transitions, and sorted states.

5. **Mathematics Engine** (`MathCanvas.jsx`):
   - **3D Gradient Descent Optimization** (`gradient`): Topographic loss surfaces (Bowl, Saddle, Rosenbrock Valley, 4-Well Landscape), negative gradient $-\nabla f$ descent vectors, and optimization trails.
   - **Solids of Revolution & Integral Calculus** (`revolution`): 2D generating curves $r(y)$, Riemann approximating cylindrical discs $\pi r^2 \Delta y$, true solid shells, and rotation axes.
   - **Trigonometric Unit Circle & Wave Synthesis** (`unitcircle`): Unit circle orbital motion $(x, y) = (\cos\theta, \sin\theta)$, projected sinusoidal time traces, and Fourier square wave harmonic synthesis with Gibbs overshoot.

6. **HUD Controls, Live Details Readout & Authoritative Visual Keys (`VisualizationHUD.jsx`)**:
   - Universal HUD header with category filters (Physics, Chemistry, Biology, CS, Math), parameter sliders, toggles, resets, and AI Explain & Quiz drawer integrations.
   - **Direct AI Explain, Quiz & Mastery Pipeline**: The "AI Concept Breakdown & Quiz" button in the HUD Details tab (and BST panel) triggers `formatTopicStudyContext(topic, params)` to synthesize rich 3D topic details (title, syllabus, summary, structured key concepts, and active simulation parameters) directly into the `ExplainPanel` drawer. Handover to `QuizPanel` ("🦆 Test me on this") generates dynamic AI questions and automatically logs completed study sessions, scores, and confidence heatmaps directly to the **Mastery Dashboard** (`MasteryDashboard.jsx`).
   - **Draggable Resizable HUD Panel**: The main Controls & Details tab container is fully draggable to resize horizontally (from a compact 10% / 180px minimum up to 75%–80% maximum screen width) via an interactive right-edge grab bar and bottom-right corner grip, with persistent `localStorage` (`socratic_hud_panel_width`) across all 24 scenes. SSR hydration safe via post-mount state synchronization.
   - **Universal Animation Speed Slider**: Prominently mounted directly below the Controls vs Details tab switcher across every 3D scene (including `BinaryTree3D.jsx` and shared `VisualizationHUD.jsx`), providing fine-grained $0.1\times$ to $3.0\times$ speed control (with paused/frozen states) across all particle simulations, wave propagation solvers, orbit integrations, step runners, `OrbitControls` camera auto-rotation, and biological organelle micro-animations (`Golgi` budding vesicles, `Cytoplasm` granules drift, and `FreeRibosomes` jitter). All canvas scenes feature standardized parameter signatures with safe fallback destructuring (`speed = 1.0`).
   - **Safe Value Fallback & Parameter Forwarding**: Implemented `num(val, fallback)` preventing truthy short-circuiting of valid `0` parameters across all 24 topic readouts. All canvas dispatchers (`PhysicsCanvas`, `ChemistryCanvas`, `BiologyCanvas`, `CSCanvas`, `MathCanvas`) accept and forward `{ topicId, params, setParam, onOpenQuiz }`.
   - **Details Tab**: Comprehensive live mathematical/scientific state readout, formula subtitles, instructional notes, and authoritative **Visual Keys** documenting every colored line, arrow, vector, orbital, particle, wave crest/trough, and object across all 24 3D scenes.
   - **Hardware Graphics Adaptation**: Device capability detection (`detectHardwareGraphics`) managing DPR (1.0–2.0), shadows, antialiasing, and dynamic `"demand"` vs `"always"` frameloops.
   - **Zen Focus Mode & Minimalist View**: 1-click toggle button (`Maximize2` / `Minimize2` icon, shortcut `Ctrl+Shift+F`) collapses the sidebar and hides top bars, leaving only an edge-to-edge canvas with a floating glassmorphic exit pill (`Esc` or `Ctrl+Shift+F`).
   - **Unified Single Top Bar (52px / `h-13`)**: Eliminated redundant stacked headers into a single modern navbar with breadcrumbs, space study tabs (`Notes`, `Quizzes`, `Mastery`), save status feedback, `Explain`, `Quiz me`, and a textless 3-dots (`...`) Note Menu.

---

### ⏱️ D. Multi-Timer HUD & Calming Study Break Alerts
- **Unified Global Timer HUD** (`components/GlobalTimerHUD.jsx`): Header dropdown managing concurrent timers: Pomodoro Focus (25m), Short Break (5m), Long Break (15m), and custom timers with live countdown rings and play/pause controls.
- **Study Calendar & Schedule** (`components/CalendarView.jsx`): Month navigation, agenda lists, space tagging, 24-hour time pickers, and custom recurring alarm scheduling.
- **Calming Study Break & Timer Alert** (`components/AlarmOverlay.jsx`): Glassmorphic break modal alert (`✨ ☕ 🌱`) with harmonic C-major triad chime synthesis, dynamic browser tab indicator (`🦆` $\leftrightarrow$ `☕`), calming title notices, and friendly snooze/extend buttons.

---

### 🦆 E. Socratic AI Tutor, Explain, Reformat & 3D Interactive Widgets
- **Structured Concept Explainer (`app/api/explain/route.js`, `lib/aiService.js` & `components/ExplainPanel.jsx`)**: Generates structured breakdowns containing TL;DR summaries, mechanism steps, analogies with explicit breakdown boundaries, common misconceptions, worked examples, and check-yourself questions, now rendered with rich inline Markdown (**bold**, *italic*, `code`) and live KaTeX LaTeX mathematical/scientific equations.
- **Intelligent Note Reformatting (`app/api/reformat/route.js` & `lib/aiService.js`)**: Analyzes notes and restructures them into high-yield SocraticOS blocks (headings, callout cards with emoji icons, hierarchical sub-bullets with multi-level nesting via `level` schema, LaTeX display/inline math, collapsible toggles, code snippets, checklists, tables, and dividers) with automatic multi-chunk segmentation for long notes (`chunkNoteBlocks`), live progress updates (`Part X/Y...`), strict LaTeX formula enforcement across all equations (never plain text, routing equations like `f(x) = 0` and `y = mx + c` into `math` or `$..$` inline math), markdown preservation inside bullets and all blocks (never stripping bold `**`, italic `*`, strikethrough `~~`, code, or inline math), strict colon requirements before heading promotions, LaTeX/KaTeX formula syntax repair, strict underlying knowledge fidelity, instantaneous `Ctrl+Z` undo stack tracking, offline heuristic fallback recognizing indented markdown sub-bullets, active visual feedback on trigger buttons (`components/NoteMenu.jsx`), and a top-center floating glassmorphic status banner (`components/BlockNoteEditor.jsx`) with animated sparkles and live progress indicator.


- **Socratic Rubber Duck Assistant (`app/api/socratic/chat/route.js`)**: Probes understanding using the Feynman technique without providing direct answers. Evaluates sessions upon completion and emits a 0–100 score and sub-topic confidence heatmap.
- **3D Socratic Canvas Widgets (`app/api/socratic/widget/route.js` & `components/WidgetCanvas.jsx`)**: Translates sub-topic misconceptions into interactive 3D WebGL scenes with vector arrows, camera controls, parameter sliders, and real-time gap repair guidance.
- **Client-Side AI Orchestration (`lib/aiService.js`)**: Allows users to provide their own Gemini API key stored privately in IndexedDB, calling Gemini directly from the client or falling back to server routes.


---

### 🎯 F. Dedicated Quizzes Studio, AI Generator & Mastery Rollup
- **Quizzes Studio Tab (`components/QuizStudioView.jsx`)**:
  - Full diagnostic quiz hub organizing quizzes across spaces with pending, completed, and trash sub-tabs.
  - **Redesigned Decluttered Exam Runner Layout**: Split-screen 2-column workspace removing all navigation, submission, question jumper, and auxiliary buttons from the question canvas into a dedicated, high-productivity right-hand Control & Navigation Sidebar.
    - **Spacious Left/Center Q&A Canvas (`max-w-4xl`)**: Generous, distraction-free reading area featuring question metadata pills (number, subtopic with LaTeX MathText, question type), an open prompt card with rich KaTeX math typography, and expansive answer options (full-width MCQ cards with hover key hints, or spacious short/long answer textareas with mechanistic tips and live word counts).
    - **Dedicated Right-Hand Navigation & Control Station (`w-80 lg:w-88`)**:
      - Primary Action: Prominent "Next Question" / "Skip Question" button, transitioning automatically to "Finish & Submit Exam" on the last question.
      - Secondary Actions: "Previous Question" and instantaneous "Clear Answer" button (resetting selection without manual backspacing).
      - Interactive Questions Matrix: 5-column numbered matrix showing real-time question states (Current glowing ring, Answered emerald pill with dot, Unanswered subtle badge) with single-click jumping to any question.
      - Progress & Real-Time Auto-Save: Continuous progress percentage bar, answered question counter, and local storage auto-save indicator.
      - Standalone Submit & Exit: Instant "Submit Exam" button accessible at any point without cycling through questions, plus "Save Progress & Exit" to safely pause and return.
    - **Keyboard Hotkey Engine**: Global keyboard listeners for lightning-fast test taking: `ArrowRight` (next/skip), `ArrowLeft` (previous), and `A`/`B`/`C`/`D` or `1`/`2`/`3`/`4` to select multiple choice options (safely ignored when typing in textareas).
  - **Progress Auto-Saving**: Real-time auto-saving of answers (`draftAnswers`) and active question position (`draftIndex`) to IndexedDB on option clicks, debounced textarea inputs, and question navigation. Includes header auto-save indicator (`✓ Progress saved` / `Saving...`) and `<ArrowLeft>` auto-save exit.
  - **Full LaTeX & Chemical Formula Rendering (`components/MathText.jsx` & `lib/mathUtils.js`)**: All quiz prompts, subtopics, multiple choice options, diagnostic rubrics, student answers, and feedback render formatted mathematical equations (`$E = mc^2$`, `\frac{a}{b}`) and chemical formulas (`\text{H}_2\text{SO}_4`, reaction arrows `\rightarrow`) via memoized KaTeX compilation with safe crash-proof fallbacks.
  - **Resume & In-Progress Flows**: In-progress quizzes display a `⏳ In Progress (X/Y)` card badge and `"Resume Quiz"` button restoring answers and current question index; retake cleanly resets draft state.
  - **Delete Confirmation Modal (`DeleteQuizConfirmModal`)**: Modal dialog with accessible semantics, metadata preview, and escape/backdrop dismiss preventing accidental loss when trashing quizzes, permanently deleting items, or emptying the 24-hour trash bin.
  - **Diagnostic Review Report**: High-contrast question breakdown cards (emerald for correct, rose for incorrect) with dedicated icon boxes, status badges, answer chips, and model corrections, accompanied by overall score (`ScoreRing.jsx`), subtopic confidence heatmap breakdown (`ConfidenceHeatmap.jsx`), and rubric feedback.
  - **Decluttered Multi-Note Quiz Cards & SourceNotesModal**: Multi-note quizzes render a single-line compact pill (`📚 X notes • View notes →`) preventing wrapping clutter and uniformizing card grid heights. Clicking opens `SourceNotesModal` with live search and 1-click note navigation into the editor.
  - 24-hour auto-purge trash management for deleted quizzes.
  - **Multi-Source Note Grading**: `handleSubmitQuiz` dynamically resolves full text across all source notes (`noteIds`) with structured boundaries, providing the AI grading model complete cross-note rubric context.
  - **Syllabus-Aware Grading**: `handleSubmitQuiz` reads the active `getSyllabusStatement()` from IndexedDB and injects it into the grading payload, preventing the AI from penalizing students for missing higher-grade or out-of-syllabus content.
- **Custom AI Quiz Generator Modal (`components/CreateQuizModal.jsx`)**:
  - **Multi-Note Selection**: Interactive source note combobox with live search filtering, "Select All" / "Clear" buttons, per-note checkboxes, selection count badge (`X of Y selected`), and removable chip badges for rapid note curation.
  - **Multi-Source AI Prompt Feeding**: Formats all selected notes with clear section delimiters (`=== Source Note: "<Title>" ===`), prompting the AI model to synthesize cross-topic connections, comparisons, and mechanisms across all selected notes.
  - **Cross-Note Heading Aggregation**: When selecting specific sections (`scope === "heading"`), headings (H1–H4) from all selected notes are compiled with note source attribution (`[Note Title] Heading Text`) preventing heading name collisions.
  - Configurable difficulty tiers (Easy, Medium, Hard, Mastery) and custom note scoping (All Selected Notes, H1–H4 Heading Checkboxes, or Custom Prompt).
  - **Question Types (7 Supported)**:
    1. `multiple_choice`: 4 options (A-D / 1-4) with deterministic integer grading and hotkey selection.
    2. `multi_select`: Checkbox-style ("Select all that apply", 2+ correct options) with objective array set matching.
    3. `value_input`: Exact numerical or algebraic formula input with virtual math symbol keyboard (`\frac{a}{b}`, `\sqrt{x}`, `x^2`, `x^n`, `\pi`, `\pm`, `\theta`, `\le`, `\ge`, `\approx`, `\infty`, `\times`, `\div`, `^\circ`) and live KaTeX preview card. Deterministic match with numerical tolerance ($\pm \delta$), falling back to LLM for algebraic equivalence.
    4. `step_ordering`: Parsons problem scrambled derivations/proofs where students arrange mathematical or algorithmic steps into logical order using ▲/▼ controls. Scrambled automatically if generated in solved order.
    5. `code_input`: Algorithm/programming task with built-in code editor featuring 2-space `Tab` key indentation interception, monospace styling, language tags, and optional starter code.
    6. `short_answer`: Concise mechanistic free response graded via LLM rubric.
    7. `long_answer`: In-depth essay/derivation evaluated across structured criteria.
  - **Custom AI Quiz Generator Modal (`components/CreateQuizModal.jsx`)**:
    - **1-Click STEM Presets**:
      - 🎓 **IGCSE Gr.10 STEM**: Balanced distribution (3 MCQ, 1 Multi-Select, 2 Value Input, 1 Step Order, 1 Code, 2 Short Answer).
      - 🧮 **Pure Math & Derivations**: Focused on mathematical rigor (2 MCQ, 3 Value Input, 2 Step Order, 1 Multi-Select).
      - 💻 **Computer Science**: Algorithm design & logic (2 MCQ, 3 Code Input, 1 Step Order, 1 Multi-Select).
      - ⚡ **Quick 5 MCQ**: Rapid 5-question multiple choice diagnostic.
    - **Categorized Question Sliders**: Grouped cleanly into *Mathematics & Science Reasoning* (Value Input, Step Ordering, Code Input), *Objective Assessment* (Multiple Choice, Multi-Select), and *Applied Analysis* (Short Answer, Long Essay).
    - **Multi-Note Selection**: Interactive source note combobox with live search filtering, "Select All" / "Clear" buttons, per-note checkboxes, selection count badge (`X of Y selected`), and removable chip badges for rapid note curation.
    - **Multi-Source AI Prompt Feeding**: Formats all selected notes with clear section delimiters (`=== Source Note: "<Title>" ===`), prompting the AI model to synthesize cross-topic connections, comparisons, and mechanisms across all selected notes.
    - **Cross-Note Heading Aggregation**: When selecting specific sections (`scope === "heading"`), headings (H1–H4) from all selected notes are compiled with note source attribution (`[Note Title] Heading Text`) preventing heading name collisions.
    - Configurable difficulty tiers (Easy, Medium, Hard, Mastery) and custom note scoping (All Selected Notes, H1–H4 Heading Checkboxes, or Custom Prompt).
    - Proportional question type sliders with custom gold gradient track fills and direct number inputs.
    - Full context serialization (`editorBlocksToText`) including tables, collapsible toggles, and LaTeX math formulas.
    - **Active Syllabus Badge**: Displays a green badge when a syllabus boundary is active, and injects the syllabus into the generation payload to scope questions to the student's curriculum level.
    - **Zero-Lag Question Sliders & Component Memoization**: Range sliders (`QuestionCountSlider`) and heading items (`HeadingCheckboxItem`) are isolated with `React.memo` and `useCallback`. CSS transitions on `quiz-slider` are restricted to `opacity`, eliminating 150ms gradient transition jank during continuous pointer drags.
    - **O(1) Heading Selection Index**: Heading selections are indexed in a memoized `Set` (`selectedHeadingsSet`), reducing per-render lookups from $O(N \times M)$ linear scans to $O(1)$ constant time.
    - **Conditional Mounting & Closed-State Guards**: `QuizStudioView` mounts `CreateQuizModal` strictly when `isCreateOpen === true`, and all internal memoized hooks exit immediately if closed, preventing background block extraction or list filtering.
    - **Spacious Wide Modal Architecture**: Upgraded modal shell to `w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh]` with expanded padding (`px-6 sm:px-8 py-5 sm:py-6`) and a 2-column responsive grid for section headings (`grid grid-cols-1 md:grid-cols-2 gap-2`), providing generous horizontal room for multi-note chips, 4 STEM presets, and 7 question type sliders.
    - **Outline Scroll Spy RAF Throttle (`BlockNoteEditor.jsx`)**: Table of contents heading scroll spy throttles `getBoundingClientRect()` via `requestAnimationFrame` (`ticking` flag) and guards active heading state updates, eliminating layout thrashing during document scrolling.
    - **Lazy Command Palette Evaluation (`CommandPalette.jsx`)**: Search item compilation across all spaces and bookmarks is bypassed with early return when `isOpen === false`, eliminating background indexing while editing notes.
  - **Objective & Semantic Hybrid Grading (`lib/aiService.js` & `app/api/quiz/grade/route.js`)**:
    - Deterministic evaluation:
      - `multiple_choice`: integer index comparison with strict blank guards.
      - `multi_select`: exact set equality across selected index arrays.
      - `step_ordering`: exact string sequence comparison against expected step order.
      - `value_input`: string normalization (stripping `$`), direct text equality, or float comparison within `tolerance` ($\pm \delta$). If non-matching float, passes `objective = null` to model for algebraic evaluation.
    - LLM semantic evaluation for short answers, essays, code solutions, and algebraic derivations with positional fallback resilience and subtopic heatmap fallback synthesis (`fallbackHeatmap`).
    - **Curriculum Boundary Enforcement**: When a syllabus is active, grading routes inject strict instructions to award full marks for correct IGCSE/GCSE/MYP answers without requiring higher-grade knowledge.
  - **Diagnostic Review Reports (`QuizStudioView.jsx` & `QuizPanel.jsx`)**:
    - Tailored diagnostic diff cards for all question types:
      - `multiple_choice`: student answer vs correct option.
      - `multi_select`: student tags vs expected correct selections chip list.
      - `step_ordering`: student sequence vs numbered correct logical sequence.
      - `value_input`: student expression in `<MathText>` vs expected value with tolerance badge.
      - `code_input`: student code in formatted `<pre><code>` alongside model solution / rubric code.
      - `short_answer` / `long_answer`: student text alongside model rubric and examiner feedback.
  - **Space-Specific Reactive Mastery Dashboard Sync (`components/Workspace.jsx`, `MasteryDashboard.jsx`, & `lib/mastery.js`)**:
    - `useLiveQuery` reactive binding synchronizing study sessions from both drawer quizzes and Quizzes Studio directly into `MasteryDashboard.jsx` and header `gapCount` badge without requiring page reload.
    - Full space-specific isolation: sessions, topics, averages, and the header `gapCount` badge are scoped to the active space by default.
    - Quick Space Switcher Dropdown in the Mastery header enabling instant toggling between spaces or viewing a combined `🌐 All Spaces` aggregate view.
    - Non-destructive backwards compatibility: historical sessions lacking an explicit space property automatically resolve to their associated note's space or default to `"School"`, ensuring zero data loss.
    - Isolated history clearing: "Clear history" removes only sessions within the selected space, safeguarding other spaces from accidental purging.
    - Sub-topic confidence matrix (Solid ● / Shaky ◐ / Gap ○) with weakest-first study queues and progress trends.
  - **Quick Quiz Panel (`components/QuizPanel.jsx`)**:
    - Dual-tab study sidebar with Graded Quiz + Socratic Rubber Duck modes.
    - Full runner and review support for all 7 question types including math symbol keyboard and code editor.
    - Syllabus injected into both `generate` (question creation) and `submit` (grading), plus Socratic Duck `askDuck` and `endSession` calls.

---

### 🔐 I. Academic Syllabus & Curriculum Boundaries (Settings > General)
- **Settings Modal > General Tab (`components/Sidebar.jsx`)**:
  - **Syllabus Toggle**: Enable/disable the curriculum boundary system with a live toggle switch (`socratic_syllabus_enabled`).
  - **Quick Preset Chips**: One-click curriculum preset buttons — *🎓 IGCSE Gr.10 (Cambridge)*, *📚 GCSE / O-Level*, *🏛️ IB MYP 4-5*, *🧬 AP / A-Level Gr.11-12*, *🔬 Middle School Gr.6-8*, *🔄 Clear*.
  - **Syllabus Textarea**: Multi-line text editor (max 8000 chars) for custom syllabus statements with live character counter.
  - **File Upload**: Upload `.txt`, `.md`, or `.docx` files to auto-populate the textarea (DOCX parsed via Mammoth).
  - **Active Status Banner**: Green success badge when syllabus is active; grey muted badge when disabled.
  - Persisted to `db.settings` via `saveSyllabusStatement(statement, enabled)` (`socratic_syllabus_statement` + `socratic_syllabus_enabled` keys).
- **Storage Layer (`lib/storageService.js`)**: `getSyllabusStatement()` and `saveSyllabusStatement()` using Dexie IndexedDB `db.settings`.
- **AI Prompt Injection (`lib/aiService.js`)**: `getEffectiveSyllabus()` reads from IndexedDB; `quizGenerate`, `quizGrade`, and `explainConcept` enforce syllabus constraints.
- **Server Route Enforcement**:
  - `app/api/quiz/generate/route.js` — injects `<syllabus_statement>` into generation prompts; restricts questions to stated curriculum scope.
  - `app/api/quiz/grade/route.js` — instructs grader to award full marks for correct syllabus-level answers; never penalises omission of higher-grade content.
  - `app/api/explain/route.js` — calibrates explanation vocabulary and depth to the stated syllabus level.
  - `app/api/socratic/chat/route.js` — calibrates Socratic probing questions to the student's curriculum level.

---

### 📦 G. Multi-Format Export, Import & Workspace Backup Engine
- **Interactive Pre-Download Document Export Preview (`components/ExportPreview.jsx` & `components/ExportImportModal.jsx`)**:
  - Automatically presents a high-fidelity visual and structural preview for all 4 document formats (**Word Document `.docx`**, **HTML Web Page `.html`**, **Plain Text `.txt`**, and **Markdown `.md`**) *before* initiating file download, eliminating blind exports.
  - **PDF & Browser Bookmarks Exclusion**: PDF continues to utilize the browser's native print preview dialog (`window.print()`), while Socratic Workspace Backups (`.socratic`) and Browser Bookmarks (`.html`) remain direct space-level export operations as designed.
  - **Wide Modal & Dedicated Scroll Container**: Dialog smoothly expands to `max-w-5xl h-[calc(100vh-2.5rem)] sm:h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] max-h-[920px]` with `overflow-hidden` backdrop locking. The preview canvas uses `flex-1 min-h-0 overflow-y-auto overscroll-contain` and custom slim scrollbars (`scrollbar-thin scrollbar-thumb-ink-700/80 hover:scrollbar-thumb-duck-500/50`) with keyboard navigation (`tabIndex={0}`) and automatic scroll-to-top on format or view mode toggles.
  - **Universal Format Quick-Tabs**: In-preview header tabs allow seamless, instant toggling between all 4 document formats without returning to the picker (`[📝 Word (.docx)] [🌐 HTML (.html)] [📑 Plain Text (.txt)] [⬇️ Markdown (.md)]`).
  - **Authentic Microsoft Word View (`.docx`)**: Simulates an 8.5" x 11" white document sheet with subtle page shadows, Word-blue ribbon titlebar, authentic Word heading hierarchy (`#1f4e79` H1/H3, `#2e74b5` H2/H4), 1.15 line spacing, clean borders, shaded table headers, callout frames, and page footer ("Page 1 of 1"). Includes a secondary Document Outline view mode and generous bottom breathing room (`pb-8`).
  - **Rendered HTML Web Page View (`.html`)**: Sandboxed `iframe` executing the exact self-contained HTML document generated by `blocksToHTMLLossy`, rendering full dark theme styling, KaTeX math expressions, and interactive components in a faux browser mockup window with URL address pill. Employs dynamic height calculation via `handleIframeLoad` and `ResizeObserver` on `doc.body` to match content scrollHeight, plus iframe wheel scroll forwarding to the canvas container. Includes toggleable raw HTML source view with line numbering.
  - **Plain Text Editor View (`.txt`)**: Monospace text editor layout with line numbers, structured ASCII headers, and indentation matching `blocksToPlainText`.
  - **Markdown Reader View (`.md`)**: Rich rendered view powered by `MarkdownRenderer` displaying headings, LaTeX formulas, interactive task lists, syntax-highlighted code fences, and tables, alongside a raw Markdown code view.
  - **File Metrics & Actions**: Real-time calculated file size (KB), block count, word count, character count, live "Scrollable Preview" indicator, instant clipboard copy ("Copy Content"), and prominent Duck-yellow "Download [filename]" confirmation button.
- **Workspace & Space Backups (.socratic)** (`lib/backup.js`): Exports entire spaces or all spaces into structured JSON `.socratic` backup packages; supports drag-and-drop restoration with space reassignment, overwrite options, and direct note records return.
  - **Netscape HTML Bookmarks (`.html`)**: Standard browser bookmark format (`<!DOCTYPE NETSCAPE-Bookmark-file-1>`) preserving folder hierarchies, `<A HREF="..." ICON="..." TAGS="...">` links, and `<DD>` personal notes for import into Chrome, Firefox, Safari, Edge, Arc, and Brave.
  - **PDF & Print Engine**: High-fidelity A4 document print engine via `@media print` featuring compact sleek cover banner (`print:block height: 60pt`), universal solid dark text enforcement across all blocks, elements, and utility classes (`color: #0f172a !important`), complete elimination of pitch-black containers on light paper (`group/codeblk`, `group/colcard`, `group/siteblk`, `group/mediablk`), atomic page-break avoidance preventing awkward multi-page splits on code blocks and atomic cards, restored callout and document header emojis with native color emoji font fallback (`Segoe UI Emoji`), full-width code blocks with 12 high-contrast syntax highlighting tokens in code snippets on light `#f8fafc` card backgrounds with pixel-perfect gutter line numbers, clean standalone full-width rounded tables (`border-collapse: separate` with 8px radius) with bold dark headers, clear cell typography, and hidden interactive toolbars/delete buttons, single-line toggle block headers with amber `▼` disclosure arrows, cleanly indented 14pt left border accents, hidden collapse badges, dynamic auto-expanding details textareas on screen without internal scrollbars, and comfortably readable 10.5pt expanded details in print, proportional media image scaling (`max-height: 180pt`), normalized white-backed square task checkboxes with vivid blue checkmark indicators, clean plain white callout cards with subtle neutral borders and crisp `#0f172a` text, auto-wrapping headers, zero-void page starts, auto-scaling KaTeX formulas without scrollbars, side-by-side multi-column layouts, and trailing blank page elimination.
  - **Word Document (`.docx`)**: Native headings, callout boxes with emojis, toggle headers with `▼ ` and multi-paragraph indented italic details `↳ `, styled code containers with Consolas, formatted lists, blue hyperlink runs with 🌐 icons, media badges (🖼️/🎵/🎬), normalized quotes without duplicate double quotes, normalized math formulas stripping raw dollar delimiters with bold `Formula:` and `Inline:` badges, and multi-column tables.
  - **HTML (`.html`)**: Clean standalone HTML5 web page with grouped lists, `<details>` toggles, dark theme styling matching SocraticOS aesthetic, embedded KaTeX CDN with auto-render script, interactive 🌐 bookmark cards, responsive media tags (images, audio, video), and responsive multi-column grid layouts.
  - **Markdown (`.md`)**: GitHub/Obsidian-flavored markdown with automatic top `# Title` inclusion, KaTeX `$formula$` preservation, `<details>` toggles, standard interactive task list `- [ ]` / `- [x]` checkboxes, `[title](url)` bookmark links, `![caption](url)` images, multi-column subheadings, and Obsidian/Unicode callouts.
  - **Plain Text (`.txt`)**: Clean structured text formatting with `--- CODE (lang) ---` delimiters, `▶ ` toggle headers with `↳ ` details, sequential numbering, `[LINK: title] url`, `[IMAGE]`, `[COLUMN: title]` multi-column sections, and normalized quotes without doubled quotation marks.
- **Automated DevTools Protocol (CDP) Visual Accuracy Suite** (`scripts/cdp_visual_tester.mjs` & `scripts/test_exports_visual.mjs`): Generates and parses all 6 export formats for a 29-block comprehensive demo note across all 19 block types, and uses headless Chrome over WebSocket CDP to capture full-page high-resolution visual screenshots (`html_visual_render.png`) and print PDFs (`quantum_note.pdf`), validating KaTeX math rendering, syntax highlighting, and table layouts.
- **Drag-and-Drop File Import**: Automatically imports `.socratic`, `.json` (workspace packages or raw note objects), `.docx` (via Mammoth with Buffer/ArrayBuffer environment normalization), `.html` (notes and browser bookmarks), `.txt`, and `.md` files into the active space.
- **Real-Time Workspace Sync**: `handleImportSuccess` in `Workspace.jsx` reloads all notes and custom spaces dynamically from IndexedDB (`getAllNotes()`).

---

### 🔖 H. Website Saver & Folder Manager (`components/WebSaverView.jsx` & `components/AddBookmarkModal.jsx`)
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
  - Importing browser Netscape HTML bookmarks triggers a confirmation dialog warning that existing folders/bookmarks in the target space will be cleanly replaced to prevent duplicate links and folders (with optional merge mode).
- **URL & Favicon Utilities (`lib/urlUtils.js`)**:
  - `normalizeUrl(url)`: Protocol normalization and dangerous scheme protection (`javascript:`, `data:`).
  - `extractDomain(url)`: Clean hostname extraction.
  - `getFaviconUrl(url, size=64)`: High-resolution Google favicon resolution.
  - `generateFallbackTitle(url)`: Human-readable title generator from URL path segments and domain names.

---

### 🗄️ I. 24-Hour Auto-Purge Trash, Factory Reset & Settings
- **24-Hour Auto-Purging Trash**: Deleted notes are placed in the Trash drawer with a `deletedAt` timestamp; a 1-minute interval background task automatically purges items older than 24 hours. Supports individual and batch recovery.
- **Factory Reset Safety Verification**: Targeted table purging in Settings featuring typed `"RESET"` double-confirmation safety checks instead of arbitrary math captchas.

---

### ⚡ J. Performance & Runtime Optimization Architecture
- **$O(1)$ Block-Level Re-render Isolation**: `EditorBlock` and heavy child containers are wrapped in `React.memo` with custom comparator guards, ensuring single-character edits in one block never cause full-document re-renders across other blocks.
- **KaTeX LRU String Memoization**: Math pills and block equations use an in-memory LRU Map cache (`renderKatexToStringMemoized`) to avoid redundant KaTeX lexing/AST rebuilds on identical LaTeX formulas.
- **Singleton Timer Store Clock & Auto-Sleep**: Multi-timer polling is consolidated into a single external store ticker (`multiTimerStore`), running only 1 shared timer interval when active and automatically clearing intervals when all timers are idle (0% idle background CPU usage).
- **IndexedDB Query Batching**: Settings and bulk database lookups use `db.settings.bulkGet(...)` instead of sequential single-key round-trips.
- **Calendar & UI Memoization**: Month cell grids and timer sub-widgets in `CalendarView.jsx` are wrapped in `useMemo` and `memo` to prevent recalculations on unrelated state updates.
- **Search Catalog & Socratic Transcript Memoization**: `CommandPalette.jsx` and `QuizPanel.jsx` wrap item catalogs and transcript filters in `useMemo` to eliminate object churn during search/dialogue.
- **$O(1)$ Static Syntax Language Map**: `lib/syntaxHighlighter.js` normalizes code languages in constant time via static lookup Maps.
- **Single-Pass Document Metrics**: `BlockNoteEditor.jsx` computes word and character statistics in a single linear pass.
- **3D WebGL & Canvas Render Loop Optimizations**:
  - `WidgetCanvas.jsx` pre-caches slider control lookups and avoids per-frame array allocations in painter's sorting.
  - `PhysicsCanvas.jsx` and `BiologyCanvas.jsx` memoize `THREE.Color` lerp interpolations to eliminate 60 FPS object churn.
  - `ThreeDView.jsx` debounces 3D topic switching history and localStorage persistence.

---

## 🗄️ 4. Local-First Database Architecture (`lib/db.js` & `lib/storageService.js`)

SocraticOS operates entirely local-first using **Dexie.js** (IndexedDB database name: `SocraticOS_LocalDB`, version 5).

### IndexedDB Object Stores:
1. `notes`: Primary note documents.
   - *Index*: `id, spaceId, title, isFavorite, emoji, updatedAt`
   - *Fields*: `id`, `spaceId`, `title`, `blocks` (Array of 18 block objects), `banner`, `emoji`, `isFavorite`, `createdAt`, `updatedAt`
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
6. `studySessions`: Graded quiz and Socratic diagnostic session records.
   - *Index*: `id, noteId, timestamp, score`
   - *Fields*: `id`, `noteId`, `noteTitle`, `space`, `concept`, `mode`, `score`, `summary`, `heatmap` (Array of `{ subtopic, status, feedback }`), `createdAt`
7. `alarms`: Custom scheduled recurring study alarms.
   - *Index*: `id, time, enabled`
   - *Fields*: `id`, `title`, `time` (24h "HH:MM"), `days` (Array of weekday numbers 0-6), `enabled`, `sound`, `createdAt`, `updatedAt`
8. `settings`: Key-value application settings.
   - *Index*: `key, value`
   - *Keys*: `apiKey`, `gfx_graphicsPreset`, `gfx_targetFps`, `gfx_pixelRatio`, `gfx_enableShadows`, `gfx_enableAntialias`, `gfx_autoPauseHidden`, `editor_click_to_append`, `space_switcher_layout`

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
3. **Demo Note Seeding Flag & Non-Destructive Notes-Only Scope**:
   - Seeding is gated by `DEMO_SEED_KEY = "socratic_demo_seeded_v13"` in `lib/db.js`. Both `resetNotesData()` and `factoryResetWorkspace()` write this exact key to prevent demo notes from re-seeding immediately after a deliberate user reset.
   - `initAndSeedDatabase()` and `seedDemoContent()` operate non-destructively and strictly on notes: they never seed or modify Web Saver folders/bookmarks, and never call `db.notes.clear()` or delete existing user notes. For existing notes, user custom notes are 100% preserved. Missing demo notes are inserted, and `note_quantum` is upgraded to the full all-blocks suite (20 block types: h1, h2, h3, h4, text, callout, quote, site, toggle, math, inlinemath, code, number, media, bullet, table, canvas, columns split, divider, todo) while preserving user space and favorite assignments.
   - In `components/Sidebar.jsx`, "🌱 Restore Seed Notes" calls `seedDemoContent({ overwrite: false })`, ensuring existing user notes, custom edits, and Web Saver bookmarks are never overwritten or touched.
4. **URL Protocol Normalization**:
   - Always wrap external URLs with `formatUrl(url)` before passing to `href` or `src` attributes to prevent relative path redirection (`http://localhost:3000/google.com`).
5. **Next.js Dev Cache Corruption**:
   - If running `npm run build` concurrently while `npm run dev` is active, Next.js chunk cache can become corrupted (`MODULE_NOT_FOUND`). Resolve with `Remove-Item -Recurse -Force .next` in PowerShell and restart the dev server.
6. **WebGL Cleanup & Frameloop**:
   - Always clean up Three.js materials and geometries on component unmount across all object types (`isMesh || isLine || isPoints`) and restore `document.body.style.cursor = "auto"`.
7. **Test Suites**:
   - Run `npm test` to execute both `scripts/check-block-mapping.mjs` (lossless DB $\leftrightarrow$ Editor block mapping) and `scripts/test-inlinemath-roundtrip.mjs` (in-sentence LaTeX math export/import round-trips).
8. **PDF Export & Chromium Print Canvas Dark Mode Reset**:
   - In Chromium/Blink, when printing while the web app is in dark mode, the `@page` margin box (`margin: 1.2cm 1.5cm`) is painted using the root canvas background color (`--color-ink-950`: `#12151e`), creating an unsightly black border framing the printed sheet.
   - Always guarantee pure white pages edge-to-edge by keeping `color-scheme: light !important; background-color: #ffffff !important;` on `:root, html, body` and `@page` in `@media print` (`app/globals.css`), overriding `--color-ink-950` to `#ffffff !important`, and having `exportToPdf()` (`lib/exportImport.js`) temporarily set `document.documentElement.style.colorScheme = "light"` before invoking `window.print()`.
9. **Print / PDF Block Specificity & Toggle Disclosure Alignment**:
   - In `@media print` (`app/globals.css`), avoid generic `input[type="text"]:first-of-type` selectors inside `[data-editor-root]` because they accidentally match nested `<input>` children such as media block captions (`data-media-caption="true"`), causing them to explode to 22pt title sizes. Use explicit attribute selectors (`input[data-note-title="true"]`).
   - In toggle collapsible blocks, the print disclosure chevron (`▼`) is centered directly over the 3px vertical accent line of the expanded details container (`border-left: 3px solid #cbd5e1` at `margin-left: 14pt`) by setting `margin-left: 10.5pt !important;` on `[class*="group/toggleblk"] > div:first-child span:first-child`, achieving 0.16px centered alignment.

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
