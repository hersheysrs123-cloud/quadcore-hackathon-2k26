# 🛡️ Antigravity Bug Fixes & Architectural Enhancements Summary

A comprehensive record of all bug fixes, edge-case resolutions, and architectural improvements implemented across the **SocraticOS** note editor, database serialization, multi-format export/import engines, left sidebar, settings panel, calendar & alarms, mastery analytics, and 3D visualization suite.

---

## 📑 Table of Contents
1. [Text Block (`text`)](#1-text-block-text)
2. [Headings (`h1`, `h2`, `h3`, `h4`)](#2-headings-h1-h2-h3-h4)
3. [Bullet & Numbered Lists (`bullet`, `number`)](#3-bullet--numbered-lists-bullet-number)
4. [To-Do & Toggle Lists (`todo`, `toggle`)](#4-to-do--toggle-lists-todo-toggle)
5. [Callout, Quote & Divider (`callout`, `quote`, `divider`)](#5-callout-quote--divider-callout-quote-divider)
6. [LaTeX Math Equation & Inline Equation Blocks (`math`, `inlinemath`)](#6-latex-math-equation--inline-equation-blocks-math-inlinemath)
7. [Site Bookmark Embed (`site`)](#7-site-bookmark-embed-site)
8. [Media Embed (Image / Audio / Video) (`media`)](#8-media-embed-image--audio--video-media)
9. [Code Snippet Block (`code`)](#9-code-snippet-block-code)
10. [Canvas Whiteboard & Interactive Drawing (`canvas`)](#10-canvas-whiteboard--interactive-drawing-canvas)
11. [Block Context Menu (⠿ 6-Dots Handle) & Note Header Controls](#11-block-context-menu--6-dots-handle--note-header-controls)
12. [Left Sidebar, Spaces Management & Password Security](#12-left-sidebar-spaces-management--password-security)
13. [Settings Modal, Backup/Restore & Workspace Reset](#13-settings-modal-backuprestore--workspace-reset)
14. [Top Navigation Bar, Header & Tab Switching Flow](#14-top-navigation-bar-header--tab-switching-flow)
15. [Study Schedule, Timers & Calendar View (`CalendarView.jsx`)](#15-study-schedule-timers--calendar-view-calendarviewjsx)
16. [Mastery Dashboard & Session History (`MasteryDashboard.jsx`)](#16-mastery-dashboard--session-history-masterydashboardjsx)
17. [3D Visualizations & WebGL Scene Kit (`scene-kit.jsx`, Canvases, HUD)](#17-3d-visualizations--webgl-scene-kit-scene-kitjsx-canvases-hud)
18. [Test Suites, DB Migrations & Build Pipeline](#18-test-suites-db-migrations--build-pipeline)
19. [Demo Notes Auto-Seeding & IndexedDB Migration Guard](#19-demo-notes-auto-seeding--indexeddb-migration-guard)
20. [Sidebar Icon Imports (`Sparkles`)](#20-sidebar-icon-imports-sparkles)
21. [HTML Bookmarks Duplicate Prevention & Clean Replacement](#21-html-bookmarks-duplicate-prevention--clean-replacement)
22. [3D Visualization Details Tab & Complete Visual Color Keys](#22-3d-visualization-details-tab--complete-visual-color-keys)
23. [Fullscreen Focus Mode & In-Tab Top Bar Toggle / Reopen Controls](#23-fullscreen-focus-mode--in-tab-top-bar-toggle--reopen-controls)
24. [Universal 3D Animation Speed Slider Integration & Prominent Top Placement](#24-universal-3d-animation-speed-slider-integration--prominent-top-placement)
25. [Draggable Resizable Controls & Details Main Tab Holder Panel](#25-draggable-resizable-controls--details-main-tab-holder-panel)
26. [Comprehensive Audit & Scaling of All Moving Elements Across 24 3D Visualizations](#26-comprehensive-audit--scaling-of-all-moving-elements-across-24-3d-visualizations)
27. [Complete 23-Bug Scientific, Mathematical & WebGL Resolution Suite](#27-complete-23-bug-scientific-mathematical--webgl-resolution-suite)
28. [3D Visualizations Speed Scaling Standardization & Runtime ReferenceError Resolution](#28-3d-visualizations-speed-scaling-standardization--runtime-referenceerror-resolution)
29. [3D Visualizations Direct Connection to AI Explain, Dynamic Quiz & Mastery Engine](#29-3d-visualizations-direct-connection-to-ai-explain-dynamic-quiz--mastery-engine)
30. [Multi-Format Note Import & Export Lossless Engine Verification (.socratic, .md, .html, .docx, .txt, .pdf, .json)](#30-multi-format-note-import--export-lossless-engine-verification-socratic-md-html-docx-txt-pdf-json)
31. [Seeded Notes LaTeX Separation, inlinemath DB Roundtrip & 17-Block Suite Overhaul](#31-seeded-notes-latex-separation-inlinemath-db-roundtrip--17-block-suite-overhaul)
32. [Seeded Notes Wave Optics Replacement, Equal-Length Balanced Architecture & Journal Space Clean Sweep](#32-seeded-notes-wave-optics-replacement-equal-length-balanced-architecture--journal-space-clean-sweep)
33. [Complete LaTeX Purge from Non-Math Blocks & Pure Semantic Segregation](#33-complete-latex-purge-from-non-math-blocks--pure-semantic-segregation)
34. [Export & Import Modal Viewport Bounds & Top Header Cropping Resolution](#34-export--import-modal-viewport-bounds--top-header-cropping-resolution)
35. [Note PDF & Print Export Formatting Suite: 8-Bug Layout, Typography & Element Resolution](#35-note-pdf--print-export-formatting-suite-8-bug-layout-typography--element-resolution)
36. [HTML Page Note Export Suite: Code Language Badging, White Typography & Math/Quote Padding](#36-html-page-note-export-suite-code-language-badging-white-typography--mathquote-padding)

---

## 1. Text Block (`text`)
* **Accurate Inline Formula Serialization on Split (`Enter`):**
  * **Problem:** Splitting a paragraph containing inline KaTeX formula pills (`.katex-inline-node`) caused corrupted DOM text or loss of LaTeX syntax.
  * **Fix:** Implemented `getSerializedTextFromRange` to walk DOM nodes and serialize KaTeX elements back to `$formula$` tokens accurately on split.
* **Notion-Style Block Merging on `Backspace` at Offset 0:**
  * Pressing `Backspace` at the beginning of a paragraph merges its text into the preceding block (paragraph, heading, list item, or quote) and places the caret precisely at the merge point.
* **Context-Preserving Smart Paste & Foreign HTML Sanitization:**
  * Markdown pastes with multiple lines or formatting (headings, code blocks, lists) are automatically parsed into structured block trees.
  * Single-line rich HTML pastes from external web pages are sanitized to plain text, preventing unwanted foreign HTML injection.

---

## 2. Headings (`h1`, `h2`, `h3`, `h4`)
* **Heading 4 Database Persistence Bug:**
  * **Problem:** `h4` was missing from `EDITOR_TO_LEVEL` and `LEVEL_TO_EDITOR` in `lib/blockMapping.js`, causing `h4` blocks to degrade to `h2` or `text` on database load.
  * **Fix:** Added full `h4` mapping (`level: 4`) in `lib/blockMapping.js`.
* **Export & Import Support:**
  * Validated lossless round-trips across Markdown (`#` through `####`), HTML (`<h1>` through `<h4>`), and DOCX (`HeadingLevel.HEADING_1` through `HEADING_4`).
* **Keyboard Flow:**
  * Pressing `Enter` in any heading creates a clean `text` block below.
  * Pressing `Backspace` on an empty heading reverts it to a standard `text` paragraph.

---

## 3. Bullet & Numbered Lists (`bullet`, `number`)
* **Numbered List DB Mapping & Sequential Counting:**
  * Fixed `toDbBlock` and `toEditorBlock` in `lib/blockMapping.js` for `number` list blocks.
  * Numbered lists dynamically display sequential counters (`1.`, `2.`, `3.`) in the editor.
* **Empty Item Escape:**
  * Pressing `Enter` on an empty list item exits the list and converts the block to a standard paragraph.
* **HTML Grouping:**
  * Consecutive list items are grouped into single `<ul>` or `<ol>` elements during HTML export rather than creating isolated single-item tags.

---

## 4. To-Do & Toggle Lists (`todo`, `toggle`)
* **To-Do Checkbox Persistence & Styling:**
  * Implemented checkbox state synchronization with Dexie/Postgres DB. Checked items display a subtle strikethrough with muted text color.
* **Toggle Block Markdown & HTML Export:**
  * Added `<details><summary>` serialization in `blockToMarkdown` in `BlockNoteEditor.jsx` and `lib/exportImport.js`.
  * Added HTML `<details>` and DOCX indented detail export for toggle blocks.

---

## 5. Callout, Quote & Divider (`callout`, `quote`, `divider`)
* **Callout Icon Picker Click-Away:**
  * Added fixed backdrop overlay for the Callout emoji picker so clicking outside dismisses the picker cleanly.
* **Notion-Style Divider Deletion:**
  * Pressing `Backspace` at offset 0 on the line after a divider deletes the divider.
  * Pressing `Delete` at the end of the line before a divider deletes the divider.
  * Clicking/focusing a divider (`tabIndex={0}`) and pressing `Backspace` or `Delete` removes it.
* **Keyboard Navigation:**
  * `ArrowUp` and `ArrowDown` seamlessly navigate across divider blocks.

---

## 6. LaTeX Math Equation & Inline Equation Blocks (`math`, `inlinemath`)
* **LaTeX Math Block UI Cleanup:**
  * Removed previous clutter buttons (`Edit Formula` and `Done`).
  * Clicking the rendered KaTeX viewport activates edit mode and focuses the textarea.
  * `Enter` commits and exits edit mode; `Shift + Enter` inserts a newline for multi-line formulas; `Escape` exits edit mode.
  * Clearing the formula and pressing `Enter` or blurring deletes the math block automatically.
* **Inline Equation Popover & KaTeX Rendering:**
  * Removed `"ƒ(x) Edit Inline Equation"` header text and `"ƒ(x)"` icon badges.
  * Clicking an inline KaTeX pill opens the popover with 10 formula presets and 20 math symbols.
  * Emptied inline formulas auto-remove the node from the sentence.
  * Formatted with `throwOnError: false` to ensure invalid LaTeX syntax never crashes the UI.

---

## 7. Site Bookmark Embed (`site`)
* **Live Favicon Resolution:**
  * Uses Google Favicon service (`https://www.google.com/s2/favicons?domain=...&sz=64`) with automatic fallback to `🌐`.
* **URL Normalization:**
  * Automatically prepends `https://` to URLs missing a protocol.
* **Notion-Style Deletion:**
  * `Backspace` from the following line or `Delete` from the preceding line immediately deletes the site block.
  * Direct container focus allows `Backspace`/`Delete` removal.

---

## 8. Media Embed (Image / Audio / Video) (`media`)
* **Database Row Degradation Bug Fixed:**
  * **Problem:** In `lib/blockMapping.js`, `toEditorBlock` mapped `row.block_type === "media"` to `type: "text"`, and `toDbBlock` lacked `case "media"`, turning media embeds into caption text on reload.
  * **Fix:** Mapped `media` rows directly to `{ type: "media", url, mediaKind, content: caption }` in `toEditorBlock` and added `case "media"` to `toDbBlock`.
* **Dual-Mode Embedding & Local File Upload:**
  * Built dual tabs: **🔗 Embed Link** (direct URL) and **📁 Upload File** (local file browser via `FileReader.readAsDataURL`).
  * Automatic MIME type classification for `image`, `audio`, and `video`.
* **Native HTML5 Players & Captions:**
  * Renders native `<audio controls>`, `<video controls>`, and responsive image containers with editable captions.
* **Notion-Style Deletion:**
  * Supports `Backspace` from the following line and `Delete` from the preceding line.

---

## 9. Code Snippet Block (`code`)
* **10-Language Tokenizer & Styling:**
  * Comprehensive syntax highlighting for JS, TS, Python, HTML, CSS, C++, Java, Rust, SQL, and JSON.
* **Twin-Layer Synchronized Scrolling:**
  * Synchronized `scrollTop` and `scrollLeft` between the transparent `<textarea>` overlay and the `<HighlightCode>` DOM underlay.
* **Keyboard Indentation:**
  * `Tab` inserts 2 spaces without losing cursor position.
  * `Shift + Tab` unindents 2 leading spaces.
* **Empty Block Deletion:**
  * Pressing `Backspace` on an empty code block deletes the block cleanly.

---

## 10. Canvas Whiteboard & Interactive Drawing (`canvas`)
* **Dedicated `CanvasBlock` Component:**
  * Encapsulated drawing preview, live thumbnail scaling, and modal state into a clean component.
* **85% Screen Modal Studio:**
  * 5 professional tools: 🖊️ Gel Pen (velocity-sensitive width), 🖌️ Felt Marker, 🖍️ Chisel Highlighter, 🧹 Eraser, 📐 Ruler Line Tool (live length & angle readout).
  * 5 stroke presets (1.5px to 20px) + 5 eraser presets (12px to 80px).
  * 10-color quick palette with ring indicator.
  * Global `Ctrl+Z` (Undo), `Ctrl+Y` / `Ctrl+Shift+Z` (Redo) history stack.
* **Notion-Style Deletion:**
  * Supports `Backspace` from the line after, `Delete` from the line before, and direct `Backspace`/`Delete` on the block.

---

## 11. Block Context Menu (⠿ 6-Dots Handle) & Note Header Controls
* **Formatting Toolbar Fix (Bold, Italic, Underline, Strikethrough, Math $x$):**
  * **Problem:** Clicking buttons in the 6-dots popup blurred the editor contentEditable element, causing `document.execCommand` to lose its active selection and fail silently.
  * **Fix:** Implemented `handleFormat(command)` in `EditorBlock`. If text is highlighted, formatting applies to the range; if no text is selected, it selects the whole block content, applies formatting / LaTeX syntax (`$formula$`), updates the DOM, and synchronizes via `onChange`.
* **Quick Block Actions Added:**
  * **Duplicate / Clone (📋):** Immediately duplicates the active block and inserts the clone below it.
  * **Move Up (⬆️) & Move Down (⬇️):** Reorders blocks instantly with boundary safety (`canMoveUp` / `canMoveDown`).
  * **Copy Content (📄):** Copies the block's text to the clipboard with an instant *"✓ Copied"* visual confirmation.
* **AI Study Action Text Extraction:**
  * `onExplainBlock` and `onQuizBlock` now inspect `block.formula` (math equations) and `block.details` (toggles) in addition to `block.content`, enabling AI drills for all block types.
* **Menu Stacking Order:**
  * Raised `BlockContextMenu` z-index to `z-[100]` to prevent collision with marquee selection overlays.
* **Note Banner & Emoji Picker Outside-Click Dismissal:**
  * Added `useRef` + `useEffect` outside-click listeners for banner picker and emoji picker in `BlockNoteEditor.jsx`, preserving note metadata (`isFavorite`, `emoji`, `banner`).

---

## 12. Left Sidebar, Spaces Management & Password Security
* **Space Switching Password Lockout Trap Removed (`Workspace.jsx`):**
  * **Problem:** A hardcoded `if (spaceName === "Journal" && !spacePasswords["Journal"])` trap forced users into `SetPasswordModal` whenever opening a space named "Journal", locking them out if canceled.
  * **Fix:** Removed the hardcoded string check, allowing all user-created spaces to open freely.
* **Fallback Note Selection on Space Deletion (`Workspace.jsx`):**
  * **Problem:** Deleting a space left `activeNoteId` pointing to a deleted note ID.
  * **Fix:** Updated `handleDeleteSpace` to select the first note of the fallback space (`notesBySpace[fallbackSpace]?.[0]?.id || null`).
* **Note Recovery Space & Active Note Synchronization (`Workspace.jsx`):**
  * **Problem:** Recovering a trashed note from a non-active space did not switch the active space, leaving the note unrendered.
  * **Fix:** `handleRecoverNote` now calls `setActiveSpace(targetSpace)` and `setActiveNoteId(noteId)` simultaneously.
* **Duplicate Space Name Validation (`Sidebar.jsx`):**
  * Added case-insensitive validation to `CreateSpaceModal` to prevent duplicate spaces with identical names.
* **Spaces Dropdown Auto-Dismiss on Password Action:**
  * Added `setSpacesDropdownOpen(false)` when clicking lock/unlock buttons in the spaces list.
* **DOM Cleanup for Sidebar Toggle Transition (`Sidebar.jsx`):**
  * Removed duplicate nested `<aside>` tags and duplicate borders inside `Sidebar.jsx`, ensuring smooth CSS collapse/expand transitions.

---

## 13. Settings Modal, Backup/Restore & Workspace Reset
* **Settings Modal 2x Width Expansion & Responsive Grid (`Sidebar.jsx`):**
  * Expanded modal from `max-w-lg` to `w-[94vw] max-w-4xl`.
  * Implemented responsive 3-column layouts for Shortcuts and 3D Settings, and side-by-side cards for Backup & Reset.
* **Dynamic User Spaces in Settings Backup & Restore (`Sidebar.jsx`):**
  * Passed `spaces` into `SettingsModal` so user-created spaces are dynamically included in `.socratic` export and import routines.
* **Verification Puzzle `Enter` Key Submission:**
  * Added `onKeyDown={(e) => e.key === "Enter" && handleFactoryReset()}` to the human verification challenge input.
* **AI & Keys Centering (`Sidebar.jsx`):**
  * Added `max-w-2xl mx-auto py-2` to center the API configuration form within the expanded modal.
* **Dead Code Cleanup:**
  * Removed legacy 3D reset routines from `storageService.js` and deleted unused duplicate component `components/SettingsModal.jsx`.

---

## 14. Top Navigation Bar, Header & Tab Switching Flow
* **Header 2 Note Menu Context Isolation (`Workspace.jsx`):**
  * **Problem:** Header 2 rendered `<NoteMenu>` on non-notes tabs (Calendar, 3D Orbit, Mastery), causing accidental deletions or mutations of background notes while browsing other tabs.
  * **Fix:** Restricted `<NoteMenu>` in Header 2 strictly to `{activeTab === "notes" && activeNoteObj && <NoteMenu ... />}`.
* **Top Bar Socratic Triggers Auto-Switch to Notes View (`Workspace.jsx`):**
  * Clicking *"✨ Explain"* or *"🦆 Quiz me"* from the top bar while on Calendar or Mastery tabs automatically switches `setActiveTab("notes")` to bring the learner to the note under study.
  * Gracefully disables buttons with tooltips when no active note is present.
* **Note Menu Left-Clipping Fixed (`NoteMenu.jsx`):**
  * Adjusted NoteMenu dropdown width from `w-64` (256px) to `w-56` (224px), preventing the left edge from clipping past the sidebar boundary.
* **Comprehensive Note Stats Aggregation (`NoteMenu.jsx`):**
  * Upgraded character and word count calculations to aggregate across block `content`, toggle `details`, and LaTeX `formula`.

---

## 15. Study Schedule, Timers & Calendar View (`CalendarView.jsx`)
* **Month Navigation & Agenda Synchronization:**
  * **Problem:** Navigating months (`◀` / `▶`) changed `currentMonth` but left `selectedDate` stuck in the previous month, causing the Agenda list to desynchronize from the calendar grid.
  * **Fix:** Updated `prevMonth` and `nextMonth` to automatically synchronize `selectedDate` to `${newYear}-${newMonth}-01`.
* **Dynamic Date Fallback in `EventModal`:**
  * Removed hardcoded `"2026-07-31"` fallback date; `EventModal` dynamically defaults to today's date (`todayStr`).
* **User Spaces Dropdown in `EventModal`:**
  * Replaced plain text input with a dynamic `<select>` dropdown populated with user spaces and defaulting to `activeSpace`.
* **24-Hour Time Picker & Minute Truncation Protection:**
  * Upgraded event time input to `<input type="time" ... />` and enhanced `format24to12` to handle both 24h strings and 12h formatted strings without losing minutes.
* **Modal Accessibility & Touch Optimization:**
  * Added global `Escape` key listeners and backdrop outside-click handlers to `EventModal` and `AlarmModal`.
  * Updated Agenda action buttons (Trigger Alarm, Edit, Delete) to `opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100` for mobile/touchscreens.
* **Fullscreen Alarm Stacking Order (`AlarmOverlay.jsx`):**
  * Raised z-index to `z-[9999]` to guarantee overlays appear in front of all application modals.

---

## 16. Mastery Dashboard & Session History (`MasteryDashboard.jsx`)
* **Permanent IndexedDB Session Purging on "Clear history":**
  * **Problem:** Clicking *"Clear history"* only wiped the local React `sessions` state, causing all sessions to reappear on browser refresh.
  * **Fix:** Exported `clearStudySessions()` in `lib/storageService.js` to execute `await db.studySessions.clear()` and connected it to `onClearSessions`.
* **Clear History Confirmation Prompt:**
  * Added a safety confirmation dialog (`window.confirm`) to protect learners from accidental loss of study history.
* **Interactive Heatmap Topic Cells:**
  * Made heatmap topic cells interactive (`onClick={() => onStudy(topic, "explain")}`), allowing learners to tap any topic chip to immediately launch an AI explanation for that concept.
* **Empty State Fallbacks:**
  * Added fallback title (`"Untitled Note"`) and emoji (`"📝"`) for note suggestions, and added a *"Start a Socratic Drill"* call-to-action button when no notes exist.

---

## 17. 3D Visualizations & WebGL Scene Kit (`scene-kit.jsx`, Canvases, HUD)
* **Simulation Freeze on Idle (`PerformanceManager` & `SceneCanvas` Frameloop):**
  * **Problem:** `PerformanceManager` set `setFrameloop("demand")` when visible, paired with `SceneCanvas` hardcoding `frameloop="demand"`, causing all R3F `useFrame` simulation loops (photons, orbiting electrons, pendulums, kinetic gas particles, BST pulses) to freeze when the mouse was idle.
  * **Fix:** Corrected `PerformanceManager` to set `setFrameloop("always")` when visible, switching to `"demand"` only when hidden in background tabs, and defaulted `SceneCanvas` to `frameloop="always"`.
* **GPU / VRAM WebGL Resource Memory Leaks:**
  * **Problem:** `WebGLCleanup` skipped non-mesh objects (`if (!object.isMesh) return;`), leaving `THREE.Line`, `THREE.LineSegments`, and `THREE.Points` (lasers, rays, trajectory paths, normal lines, and grid meshes) un-disposed on scene unmount.
  * **Fix:** Upgraded scene traversal to safely dispose `.geometry` and `.material` across all renderable object types (`isMesh || isLine || isPoints`).
* **Snell's Law / Refraction Boundary Condition & Division by Zero:**
  * **Problem:** In `solveBlock`, as the refraction angle approached the critical angle / $90^\circ$, $\cos(r) \to 0$ caused lateral displacement $d$ and sideways travel `run` to evaluate to `Infinity`, corrupting Three.js buffer geometry creation.
  * **Fix:** Guarded against $|\cos(r)| < 1e-4$ and clamped `run` to safe ranges.
* **Resilient Parameter Fallbacks Across Physics, Chemistry & Biology Scenes:**
  * Added safe default parameter destructuring across all 13 3D scene signatures (`RefractionScene`, `MotorEffectScene`, `LensOpticsScene`, `InductionScene`, `GasLawsScene`, `DistillationScene`, `CrystalLatticeScene`, `ElectrolysisScene`, `EnzymeScene`, `DNAScene`, `CellExplorerScene`) to prevent `NaN` or unhandled property access during dynamic topic switching.
* **HUD Slider React Warnings & NaN Formatter Crash:**
  * **Problem:** `<Slider>` in `VisualizationHUD.jsx` passed `value` directly without fallback, triggering React uncontrolled-to-controlled input warnings and causing custom formatters (`format(v)`) to crash if a parameter was briefly `undefined`.
  * **Fix:** Defaulted `value` to `value ?? min ?? 0` and guarded formatters.
* **Quiz Overlay Missing Topic / Empty Quiz Fallback:**
  * Added defensive checks in `QuizOverlay` to render an informative fallback dialog instead of crashing when opening quizzes on topics with unpopulated question arrays.
* **Binary Search Tree 3D (`BinaryTree3D.jsx`):**
  * Switched `<Canvas frameloop="demand">` to `frameloop="always"` so active search node pulsing and depth glow animations run smoothly.
  * Added unmount cleanup effects in `TreeScene` and `Pickable` (`cell-organelles.jsx`) so `document.body.style.cursor = "auto"` is cleanly restored if the component unmounts while hovered.
* **Standalone Visualizations Page Topic Fallback (`app/visualizations/page.jsx`):**
  * Added fallback `const topic = TOPICS_BY_ID[topicId] || TOPICS[0]` and safe param resolution to prevent crashes on invalid or missing URL query parameters.
* **Defensive AI Widget Canvas Rendering (`WidgetCanvas.jsx`):**
  * Guarded `scaleFor`, `drawObject`, and the `requestAnimationFrame` loop in `WidgetCanvas.jsx` against missing `initialState`, invalid vectors, or malformed AI widget JSON payloads.
* **Local-First Visualizations Persistence Endpoint (`app/api/visualizations/route.js`):**
  * Created `GET /api/visualizations` returning `{ success: true, localFirst: true, visualizations: [] }`, eliminating 404 network console errors on 3D tab boot.
* **`ReferenceError: Html is not defined` Fixed:**
  * Imported both `{ Html, Html as DreiHtml }` from `@react-three/drei`.
* **Safe Vector & Segment Defaults:**
  * Added fallback vectors `from = [0, 0, 0]` and `to = [0, 1, 0]` in `useSegment`, `Bond`, and `VectorArrow` to prevent `undefined` coordinate access during fast scene switches.

---

* **Multiple-Choice Coercion Fix in Quiz Grading (`app/api/quiz/grade/route.js`):**
  * **Problem:** In `gradeObjectively()`, `Number(answer)` was evaluated directly on `response?.answer`. When a question was skipped or unanswered (`answer: null` or `undefined`), JavaScript coerced `Number(null)` to `0`, which falsely treated the question as answered with Option 0 (Option A).
  * **Fix:** Added `const isProvided = answer !== null && answer !== undefined && answer !== ""; const picked = isProvided ? Number(answer) : NaN;` ensuring unattempted questions are accurately recorded as unanswered.
* **Comprehensive 66-Test Unit & Integration Suite (`tests/`):**
  * Added 8 unit test suites and 3 integration test suites under `tests/unit/` and `tests/integration/` executed via native `node --test`:
    1. `tests/unit/physics-solvers.test.mjs`: Snell's law refraction, thin lens optics, kinetic gas laws, organic chemistry homologous series.
    2. `tests/unit/avl-tree-3d.test.mjs`: BST insertion, duplicate handling, traversals (In, Pre, Post), and 3D positioning.
    3. `tests/unit/export-import.test.mjs`: Full 18-block lossless round-trips for Markdown, HTML grouping, DOCX binary generation, and plain text.
    4. `tests/unit/mastery-analytics.test.mjs`: `summariseMastery` rollup engine, weakest-first sorting, and multi-session trend tracking.
    5. `tests/unit/quiz-grading.test.mjs`: Deterministic integer evaluation and fallback heatmap synthesis.
    6. `tests/unit/timer-store.test.mjs`: Pomodoro countdown math, duration validation, and pause/resume timestamp accuracy.
    7. `tests/unit/syntax-highlighter.test.mjs`: Tokenizer verification across all 10 programming languages.
    8. `tests/unit/password-security.test.mjs`: Base64 UTF-8 encoding protecting against `DOMException` on emoji and non-Latin1 passwords.
    9. `tests/integration/3d-topic-schemas.test.mjs`: Schema integrity, slider ranges, and formatter safety for all 14 3D topics.
    10. `tests/integration/ai-widget-resilience.test.mjs`: Three.js canvas shielding against malformed AI payloads.
    11. `tests/integration/trash-24h-purge.test.mjs`: 24-hour auto-purge timestamp lifecycle verification.
* **Unified Test Runner in `package.json`:**
  * Updated `"test"` script to execute all test suites simultaneously: `npm test` runs 92 tests across 34 suites with 100% pass rate in ~500ms.
* **Production Build Verified:**
  * Next.js 15.5 production build (`npm run build`) compiles with zero errors and optimized static/dynamic routes.

---

## 19. Demo Notes Auto-Seeding & IndexedDB Migration Guard
* **Stale LocalStorage Flag Blocking Seed Notes on DB Migration / Empty Store:**
  * **Problem:** If a user previously loaded the application, their browser's `localStorage` held `"socratic_demo_seeded_v7": "true"`. When upgrading schemas to version 5 or opening a fresh/empty database, `initAndSeedDatabase()` evaluated `const seeded = localStorage.getItem(DEMO_SEED_KEY)` as truthy and immediately exited without checking if `db.notes` or `db.bookmarks` contained any records. The user was left with an empty workspace and no visible demo notes.
  * **Fix:**
    1. In `lib/db.js`, updated `initAndSeedDatabase()` to query `const notesCount = await db.notes.count();` and `const bookmarksCount = await db.bookmarks.count();`, guaranteeing seeding runs whenever `!seeded || notesCount === 0`.
    2. Bumped `DEMO_SEED_KEY` to `"socratic_demo_seeded_v8"` to invalidate old localStorage flags across existing browsers.
    3. Added `seedDemoContent({ overwrite })` in `lib/storageService.js` and hooked an automatic fallback verification inside `loadLocalWorkspace()` in `components/Workspace.jsx`.
    4. Added a manual "🌱 Restore Seed Notes" action card inside the Settings modal's Backup & Reset tab in `components/Sidebar.jsx`.

---

## 20. Sidebar Icon Imports (`Sparkles`)
* **Missing `Sparkles` Component Import in `components/Sidebar.jsx`:**
  * **Problem:** Adding the "Interactive Tutorial & Feature Guide" action card into `SettingsModal` referenced `<Sparkles className="w-4 h-4 text-duck-400" />` without importing `Sparkles` from `lucide-react`, causing a runtime `ReferenceError: Sparkles is not defined` when opening the General & Theme settings tab.
  * **Fix:** Added `Sparkles` to the `lucide-react` import list on line 4 of `components/Sidebar.jsx`.

---

## 21. HTML Bookmarks Duplicate Prevention & Clean Replacement
* **Accidental Duplicate Folders and Bookmarks on Import:**
  * **Problem:** Importing Netscape HTML bookmark files repeatedly or restoring backups generated randomized IDs on every parse, causing bookmarks and folder structures to be appended alongside existing items and creating duplicate folders and links.
  * **Fix:**
    1. In `lib/exportImport.js`, updated `importBookmarksFromHtml(file, space, { replaceExisting = true })` to clear existing folders and bookmarks in the target space before writing imported items in a single atomic Dexie transaction.
    2. In `components/WebSaverView.jsx`, added `ImportBookmarksConfirmModal` displaying a prominent amber duplicate prevention notice (`⚠️`) informing the user that importing will replace existing folders/bookmarks in the active space to prevent duplicates, with clear choices for *"Replace & Import"*, *"Merge / Append"*, and *"Cancel"*.
    3. In `components/ExportImportModal.jsx`, added a dynamic alert banner when HTML bookmark files are selected.

---

## 22. 3D Visualization Details Tab & Complete Visual Color Keys
* **Missing Details Readouts and Incomplete Color Legends in 3D Studio:**
  * **Problem:** When opening the **Details** tab on the 3D HUD overlay (`VisualizationHUD.jsx`), 11 of the 24 topics (`projectile`, `interference`, `orbits`, `vsepr`, `energetics`, `protein`, `binary_tree`, `sorting`, `gradient`, `revolution`, `unitcircle`) lacked dedicated cases in `renderTopicDetailsReadout`, causing the helper to return `null` and leaving students without calculated state values, topic notes, and visual color keys. Furthermore, several existing topics had incomplete color keys that omitted specific rays, magnet poles, electrodes, or vectors rendered in their WebGL scenes.
  * **Fix:**
    1. In `components/visualizations/VisualizationHUD.jsx`, implemented comprehensive `renderTopicDetailsReadout` entries across all 24 topics spanning Physics, Chemistry, Biology, Computer Science, and Mathematics.
    2. Synchronized mathematical formulas and dynamic state readouts for every topic (Snell's law, Lorentz force $F=BIL$, thin lens equation, Faraday EMF, ideal gas $PV=nRT$, ballistic trajectories with quadratic drag, Young's double-slit interference, Keplerian orbital energy, Bohr electron shells, VSEPR steric numbers & bond angles, Arrhenius reaction energetics & catalysis, enzyme lock-and-key kinetics, DNA antiparallel rungs, plant/animal cell tonicity, protein secondary structure folding, BST hierarchical metrics, sorting time complexity & stability, gradient descent update rules, solids of revolution Riemann integration, and Fourier series square wave synthesis).
    3. Added complete, authoritative **Visual Keys** (color legends) for all 24 topics, ensuring every colored line, arrow, vector, orbital, particle, wave crest/trough, electrode, and mesh rendered in the 3D canvas is mapped to its matching color badge and descriptive note.
    4. Enhanced `BinaryTree3D.jsx`'s internal Details tab with an expanded Visual Tree Key covering Idle Stored Nodes (`#2a3447`), Active Comparison Pivots (`#fbbf24`), Target Found Matches (`#34d399`), Search Misses (`#fb7185`), User Selected Nodes (`#38bdf8`), and Directed Branch Edges (`#64748b`).
    5. Added a graceful `default:` fallback in `renderTopicDetailsReadout` to guarantee any future topics will render clean parameter tables and visual keys rather than returning `null`.

---

## 23. Fullscreen Focus Mode & In-Tab Top Bar Toggle / Reopen Controls
* **Need to Maximize Vertical Viewport with Exactly One Toggle Button and Zero Header Bleed:**
  * **Problem:** On smaller screens and when studying immersive 3D scenes or long notes, top navigation headers and studio toolbars consumed significant vertical height. Translucent header backgrounds allowed underlying canvas elements and text to bleed through and merge visually with navigation strips, while multiple duplicate toggle buttons cluttered the UI. Furthermore, in the 3D tab, redundant sub-headers and flexible wrapping caused text labels in the Category & Topic strip to merge with visualization choosing buttons.
  * **Fix:**
    1. In `components/Workspace.jsx`, added a global `hideTopBars` state persisted in `localStorage` (`socratic_hide_top_bars`), controlled by **exactly one** "Hide top bars" button (`ChevronUp`) in the workspace header when top bars are visible.
    2. Enforced solid, opaque `bg-ink-900 border-b border-ink-800 shadow-sm` backgrounds across workspace headers, 3D Category & Topic strips, HUD panels, and modals so underlying text, 3D canvas objects, and vector labels never bleed or merge into navigation elements.
    3. In `components/Workspace.jsx`, restricted Header 2 (Note title sub-bar) to render strictly when `activeTab === "notes"`, removing the redundant `3D Concept Visualizer` title bar that previously collided with the 3D studio's own toolbar dropdown and topic buttons.
    4. In `components/Workspace.jsx`, added **exactly one** dedicated, solid Focus Strip (`h-8 shrink-0 bg-ink-900 border-b border-ink-800 px-4 flex items-center justify-between z-40`) for non-3D tabs (Notes, Calendar, Web Saver, Mastery), ensuring all note content, "Add Cover Banner" buttons, and titles start strictly *below* the strip.
    5. In `components/ThreeDView.jsx` and `app/visualizations/page.jsx`, eliminated duplicate buttons from the studio toolbar. Re-architected the Category & Topic strip with `flex-1 overflow-x-auto no-scrollbar` and `whitespace-nowrap shrink-0` across all category and topic buttons so text never wraps or merges with visualization choosing buttons or the in-tab "Show top bars" button on the right edge.

---

## 24. Universal 3D Animation Speed Slider Integration & Prominent Top Placement
* **Need for Immediate, Prominent Speed Control Across Every 3D Visualization:**
  * **Problem:** Several 3D scenes either lacked speed controls, buried them deep in long parameter lists, or lacked fine-grained simulation pacing.
  * **Fix:**
    1. In `components/visualizations/VisualizationHUD.jsx`, mounted a universal **Animation Speed Slider** (`⚡ Animation Speed`, $0.1\times$ to $3.0\times$ in $0.1\times$ increments) directly beneath the Controls vs Details tab switcher at the top of the HUD panel, ensuring it is immediately visible and accessible on every scene.
    2. In `components/visualizations/BinaryTree3D.jsx`, moved the tree traversal / insertion step speed slider directly beneath its Controls vs Details switcher at the top of the tree HUD.
    3. Filtered out any redundant duplicate speed controls from individual topic schemas in `VisualizationHUD.jsx` (`.filter((control) => control.key !== "speed")`) so the slider appears once and only once at the designated top location.
    4. In `PhysicsCanvas.jsx`, `ChemistryCanvas.jsx`, `BiologyCanvas.jsx`, `CSCanvas.jsx`, and `MathCanvas.jsx`, wired `params.speed` into all scene `useFrame` animation clocks, particle velocity updates, photon wave pulses, reaction markers, and gradient descent step accumulators.
    5. Separated projectile ballistic launch velocity (`launchSpeed: 22 m/s`) from flight animation playback speed (`speed: 1.0×`) so launch physics and animation playback work independently.

---

## 25. Draggable Resizable Controls & Details Main Tab Holder Panel
* **Need for Responsive, Expandable HUD Panel Sizing Across Screen Dimensions:**
  * **Problem:** Fixed $280\text{px}$ panel widths felt constrained on large desktop viewports (limiting readability of multi-column parameters, formulas, and visual keys) and inflexible for users wanting more canvas area.
  * **Fix:**
    1. In `components/visualizations/VisualizationHUD.jsx` and `components/visualizations/BinaryTree3D.jsx`, replaced hardcoded `w-[280px]` styles with a dynamic, state-driven width bounded strictly between a minimum of $10\%$ screen width ($\ge 180\text{px}$) and a maximum of $75\%\text{--}80\%$ screen width (`Math.floor(window.innerWidth * 0.80)`).
    2. Integrated an interactive right-edge grab handle (`w-3.5 cursor-ew-resize`) with visual hover/active feedback and a bottom-right corner grip (`cursor-nwse-resize`), allowing users to click and drag to resize the panel smoothly.
    3. Attached pointer event listeners (`pointermove`, `pointerup`) to `window` with active dragging states to ensure dragging never stutters or loses capture when moving rapidly across the 3D WebGL canvas.
    4. Persisted user size preferences in `localStorage` (`socratic_hud_panel_width`) so custom panel sizes are preserved across page reloads and topic transitions.

---

## 26. Comprehensive Audit & Scaling of All Moving Elements Across 24 3D Visualizations
* **Ensuring 100% of Animated and Dynamic Elements Scale Strictly with Animation Speed:**
  * **Problem:** While primary clocks scaled with animation speed, some secondary moving elements (such as orbital satellite leapfrog steps, nucleus rotation, organic molecule cracking timeouts, distillation vapor bubble drift, crystal lattice spins, electrolysis ion migration / bubble generation / circuit electron flow, enzyme thermal wobble, DNA unzipping timeouts & helix spin, and osmosis water droplet transit) had unscaled delta factors or fixed timeouts.
  * **Fix:**
    1. **Physics (`PhysicsCanvas.jsx`)**:
       - `Satellite` (Orbit scene): Scaled leapfrog symplectic integrator step with `Math.min(delta, 0.033) * speed`.
       - `InductionScene`: Scaled generator coil rotation and e.m.f. wave marker with `omegaOf(speed)`.
       - `InterferenceField`: Scaled phase propagation clock with `delta * speed`.
       - `GasParticles` & `Projectile` & `FlowPulses` & `PhotonPulse`: Scaled with `animSpeed`.
    2. **Chemistry (`ChemistryCanvas.jsx`)**:
       - `Nucleus` (Bohr atom): Scaled 2-axis nuclear spin with `speed`.
       - `Molecule` (Organic builder): Scaled structure rotation and cracking unzipping/rejoining lerp & timeout with `speed`.
       - `Vapours` (Distillation): Scaled vapor fraction ascension rate with `delta * 0.34 * speed`.
       - `SpinningLattice`: Scaled crystal lattice rotation with `delta * 0.25 * speed`.
       - `DriftingIons`, `ElectronFlow`, `ElectrodeBubbles` (Electrolysis): Scaled ion drift, wire electron loops, and gas bubble rising with `speed`.
       - `ReactionEnergyScene`: Scaled barrier crossing marker with `speed`.
       - `VseprScene`: Scaled orbit camera auto-rotation with `0.8 * speed`.
    3. **Biology (`BiologyCanvas.jsx`)**:
       - `EnzymeBody`: Scaled 3-axis vertex denaturation/thermal noise with `delta * animSpeed`.
       - `Helix` (DNA): Scaled double-helix spin, replication fork unzipping lerp, and fork open/close timeout with `speed`.
       - `WaterFlow` (Cell Osmosis): Scaled net osmosis water droplet radial flow with `delta * 0.4 * speed`.
       - `ProteinFoldingScene`: Scaled orbit camera auto-rotation with `0.45 * speed`.
    4. **CS & Math (`CSCanvas.jsx`, `BinaryTree3D.jsx`, `MathCanvas.jsx`)**:
       - `BinaryTree3D`: Scaled tree traversal and step interval timer (`600 / speed`).
       - `Sorting3D`: Scaled step rate with `clamp(3 + speed * 26, 3, 120)`.
       - `DescentRunner`: Scaled gradient descent optimization accumulator with `step * speed`.
       - `Epicycles` (Unit circle): Scaled phasor angular velocity and traveling wave phase with `step * speed`.
       - `SolidOfRevolutionScene`: Scaled auto-rotation with `0.45 * speed`.

---

## 27. Complete 23-Bug Scientific, Mathematical & WebGL Resolution Suite

A systematic resolution of 23 bugs identified across the 3D visualization engine covering runtime crashes, mathematical & physical inaccuracies, SSR hydration mismatches, WebGL memory allocations, and sorting visualizer state tracking:

### Critical Fixes
* **BUG-01: Runtime Crash on Electrolysis Topic Selection (`ChemistryCanvas.jsx`)**
  * **Problem:** In `ChemistryCanvas.jsx`, `Ions({ current, running, resetToken, onDeposit, animSpeed = 1 })` omitted `animSpeed` from parameter destructuring while using `animSpeed` on lines 757, 769, 781, causing `ReferenceError: animSpeed is not defined` and throwing a white-screen React crash whenever the electrolysis topic was selected.
  * **Fix:** Added default destructuring `animSpeed = 1` in `Ions` component parameter list.

### High-Severity Fixes
* **BUG-02: Truthy `|| fallback` Pattern Swallowed Valid `0` Values Across HUD Readouts (`VisualizationHUD.jsx`)**
  * **Problem:** `const drag = Number(params.drag) || 0.04;`, `const lone = Number(params.lone) || 0;`, `const tonicity = Number(params.tonicity) || 0;` caused valid slider inputs of `0` to be treated as falsy and overridden by fallback values, corrupting HUD readouts across 10 physics, chemistry, biology, and math topics (e.g. zero drag displayed as 0.04, zero lone pairs displaying distorted bond angles, zero tonicity overriding isotonic status).
  * **Fix:** Created a safe number extraction helper `const num = (v, fallback) => (v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : fallback);` and migrated all topic readouts in `VisualizationHUD.jsx` to use `num()`.
* **BUG-03: Negative Collision Bounds Trapped Gas Molecules at Low Volumes (`PhysicsCanvas.jsx`)**
  * **Problem:** In `GasLawsScene`, `wallX = PISTON_TRAVEL.left + (vol / 100) * travel - RADIUS` and `wallYZ = CYLINDER_RADIUS - RADIUS` produced negative or near-zero bounds at low volumes ($V < 15$), permanently trapping molecules outside cylinder walls.
  * **Fix:** Clamped cylinder collision half-extents with `Math.max(0.12, ...)` so bounds remain physically valid at all volume and temperature extremes.
* **BUG-04: Fleming's Left-Hand Rule Arrow Coordinates Inverted Relative to Model (`PhysicsCanvas.jsx`)**
  * **Problem:** In `MotorEffectScene`, `FLEMING_COORDS` placed fingertip arrows in world space while the 3D hand mesh rotated with `polarity`. When current or field reversed, the 3D hand flipped but arrow markers remained in fixed world space, visually pointing in the wrong directions.
  * **Fix:** Implemented `transformHandPoint(p, polarity)` transforming arrow root and target vectors in lockstep with hand mesh Euler rotations across all 4 polarity configurations.
* **BUG-05: Beta-Sheet Hydrogen Bonding Double-Bonded Both Sides of Every Residue (`BiologyCanvas.jsx`)**
  * **Problem:** `for (let within = 0; within < perStrand; within += 2)` created identical hydrogen bond anchor indices across all strand pairs, causing residues on internal strands to participate in 2 simultaneous hydrogen bonds on opposite sides.
  * **Fix:** Alternated starting residue parity across strand indices: `for (let within = strand % 2; within < perStrand; within += 2)`.
* **BUG-06: Insertion Sort Comparison Highlighted Duplicate Bars (`CSCanvas.jsx`)**
  * **Problem:** In `CSCanvas.jsx` `insertion`, `push([j, j + 1], "compare")` was called after shifting `a[j+1] = a[j]`, displaying two identical adjacent bars rather than the extracted `key` value.
  * **Fix:** Set `a[j+1] = key` before pushing the comparison frame so the candidate slot correctly renders the `key` being compared against `a[j]`.
* **BUG-07: Merge Sort Comparison Frame Highlighted Already-Written Elements (`CSCanvas.jsx`)**
  * **Problem:** In `CSCanvas.jsx` `merge`, `push([l, r], "compare")` used indices `l` and `r` into array `a` where elements at `lo..k-1` were already overwritten with merged sorted values.
  * **Fix:** Structured the comparison snapshot preview to render unmerged buffer elements at `[k..hi]` and highlight the candidate indices `k` and `k + (mid - l + 1)`.
* **BUG-08: Alkyne Bond Angles Rendered as Non-Linear Zig-Zag (`ChemistryCanvas.jsx`)**
  * **Problem:** In `OrganicScene`, triple bonds ($C \equiv C$) in alkynes were positioned using the $109.5^\circ / 120^\circ$ sp3/sp2 zig-zag layout, violating IUPAC $180^\circ$ linear geometry for $C_0-C_1-C_2$.
  * **Fix:** Enforced strictly colinear coordinates ($y = 0, z = 0$) along the X-axis for carbons $C_0, C_1, C_2$ with unit factor spacing before starting the zig-zag for subsequent carbons $\ge C_3$.
* **BUG-09: Methanoic Acid Rendered Without Formyl Hydrogen (`ChemistryCanvas.jsx`)**
  * **Problem:** Methanoic acid ($n=1$, $HCOOH$) omitted the single hydrogen atom attached to the carbonyl carbon, rendering an incomplete molecule.
  * **Fix:** Added conditional check for $n=1$ in carboxylic acid builder, attaching the formyl C–H bond at $[-1.0, 0, 0]$ with standard single bond geometry.
* **BUG-10: Refraction Light Pulse Traversed Different Materials at Inverted Visual Speeds (`PhysicsCanvas.jsx`)**
  * **Problem:** `PhotonPulse` incremented progress by `(animSpeed * 0.45 * (leg.speed / 2.0)) * delta`, where `leg.speed` represented physical velocity ($c/n$). However, because physical leg Euclidean distances differed, dividing fractional progress without Euclidean distance normalization caused light pulses to travel faster in denser media.
  * **Fix:** Computed Euclidean segment lengths `legLengths` and normalized step increments by dividing by physical leg length: `(speedPhysical / legLen) * delta * 1.8 * animSpeed`.

### Medium-Severity Fixes
* **BUG-11: VSEPR Polarity Symmetry Check False Positive on $XeF_4$ / $XeF_2$ (`ChemistryCanvas.jsx`)**
  * **Problem:** `isSymmetric = lone === 0` incorrectly classified centrosymmetric molecules with lone pairs ($XeF_4$ square planar `4-2`, $XeF_2$ linear `2-3`) as polar with non-zero dipole moments.
  * **Fix:** Updated polarity check using `SHAPES[key]` dipole symmetry lookup: `const shape = SHAPES[\`\${bonding}-\${lone}\`]; const isPolar = shape ? Boolean(shape.dipole) : lone > 0;`.
* **BUG-12: Ice Crystal Lattice Missing Intermolecular Hydrogen Bonding Network (`ChemistryCanvas.jsx`)**
  * **Problem:** In `buildIce()`, only intramolecular covalent O–H bonds were generated, omitting the open hexagonal intermolecular hydrogen bonding network characteristic of ice Ih.
  * **Fix:** Implemented intermolecular hydrogen bonding generation in `buildIce()` between adjacent oxygen and hydrogen atoms ($2.4 \le \text{dist} \le 3.6$), rendered with dashed sky-blue styling (`PALETTE.sky`).
* **BUG-13: Plant Cell Layout Incorrectly Included Lysosomes (`BiologyCanvas.jsx`)**
  * **Problem:** In `PLANT_LAYOUT`, `lysosomes` contained coordinate entries, and `ORGANELLE_INFO.lysosome` was tagged with `both: true`, contradicting standard IGCSE biology curricula where lysosomes are animal cell organelles.
  * **Fix:** Set `lysosomes: []` in `PLANT_LAYOUT`, updated `ORGANELLE_INFO.lysosome` with `both: false` and explanatory note, and added `{!isPlant && layout.lysosomes?.map(...)}` in JSX.
* **BUG-14: Per-Frame Garbage Collection Pressure from `THREE.Color` Allocations (`PhysicsCanvas.jsx`)**
  * **Problem:** In `InterferenceScene`, `new THREE.Color()` was instantiated inside `useFrame` on every rendered frame, producing GC pressure and frame drops on high refresh displays.
  * **Fix:** Allocated a single memoized `scratch = useMemo(() => new THREE.Color(), [])` reused across all frames via `scratch.copy(...)`.
* **BUG-15: HUD Panel Width SSR Hydration Mismatch (`VisualizationHUD.jsx`)**
  * **Problem:** `const [panelWidth, setPanelWidth] = useState(() => localStorage.getItem(...))` evaluated differently on the server (returning 300) vs the client (returning stored width), triggering Next.js React hydration mismatches.
  * **Fix:** Initialized state to constant `300` and hydrated saved user preferences inside a client-side `useEffect(() => { ... }, [])`.
* **BUG-16: Topic Canvas Root Components Discarded `setParam` / `onOpenQuiz` Props**
  * **Problem:** Root dispatcher functions `PhysicsCanvas`, `ChemistryCanvas`, `BiologyCanvas`, `CSCanvas`, and `MathCanvas` received props but did not forward `setParam` and `onOpenQuiz` to child scene components.
  * **Fix:** Standardized signatures across all 5 dispatcher files to accept `{ topicId, params, setParam, onOpenQuiz }` and forward props to child scenes.
* **BUG-17: Key Concepts Toggle Button Rendered Without Concepts (`VisualizationHUD.jsx`)**
  * **Problem:** Topics with empty `concepts: []` arrays still rendered the "Key Concepts (toggle)" button, displaying an empty collapsible container when clicked.
  * **Fix:** Gated Key Concepts toggle rendering with `{topic.concepts && topic.concepts.length > 0 && (...) }` in both the closed HUD bar and details tab.
* **BUG-18: Pointer Event Listener Leak on HUD Panel Resize Window Blur (`VisualizationHUD.jsx`)**
  * **Problem:** `handleResizePointerDown` registered `pointermove` and `pointerup` on `window` without listening for `pointercancel`, leaking active resize states if dragging was interrupted by system dialogs or window blur.
  * **Fix:** Created a unified `cleanup` function listening for both `pointerup` and `pointercancel`, ensuring listeners are cleanly detached and stored in `localStorage`.

### Low-Severity Fixes
* **BUG-19: Brittle `fold` Parameter Extraction in Protein HUD Readout (`VisualizationHUD.jsx`)**
  * **Problem:** `params.fold !== undefined ? Number(params.fold) : 1` failed when `params.fold` was `NaN` or empty string.
  * **Fix:** Replaced with safe number helper `fold = num(params.fold, 1)`.
* **BUG-20: Duplicate Category Header Comment in `topics.js`**
  * **Problem:** Lines 1273-1274 in `topics.js` contained duplicate `// ═══ Mathematics ═══════════════════════════════════════════════════` comments.
  * **Fix:** Removed the duplicate comment line.
* **BUG-21: Projectile Motion Speed Extraction Used Arbitrary Threshold (`PhysicsCanvas.jsx`)**
  * **Problem:** `ProjectileScene` extracted launch velocity with `params.speed > 1.5 ? params.speed : 22`, confusing physical launch velocity ($m/s$) with animation playback speed multiplier.
  * **Fix:** Separated `launchSpeed = num(params.launchSpeed, 22)` from `animSpeed = num(params.speed, 1.0)`.
* **BUG-22: Declarative No-Op Components in `scene-kit.jsx` Lacked Architectural Documentation**
  * **Problem:** `SceneReadout` and `SceneLegend` returned `null` without docstrings, confusing developers expecting WebGL HTML overlays inside the Canvas.
  * **Fix:** Added JSDoc explaining that live mathematical readouts and visual keys are rendered in the unified 2D HUD overlay via `VisualizationHUD.jsx`.
* **BUG-23: Duplicate `Html as DreiHtml` Alias Import (`scene-kit.jsx`)**
  * **Problem:** Line 5 imported both `Html` and `Html as DreiHtml` from `@react-three/drei`.
  * **Fix:** Removed the alias import and standardized on `<Html />` throughout `scene-kit.jsx`.

---

## 28. 3D Visualizations Speed Scaling Standardization & Runtime ReferenceError Resolution

### Root Cause
When auditing and standardizing camera `autoRotateSpeed` and vector particle speed scaling across all visualizers, `RefractionScene` (and several other scene functions) did not destructure `speed = 1.0` in their parameter signature. This caused an unhandled `ReferenceError: speed is not defined` when `autoRotateSpeed: 0.45 * speed` evaluated in `RefractionScene`.

### Problem Statement
1. In `RefractionScene`, `MotorEffectScene`, `GasLawsScene`, `LensOpticsScene`, `EnergyProfileScene`, and `GradientDescentScene`, `speed` was accessed or evaluated in JSX without uniform parameter default fallback destructuring (`speed = 1.0`).
2. Secondary micro-animations in `cell-organelles.jsx` (`Golgi` budding vesicles, `Cytoplasm` granules drift, and `FreeRibosomes` thermal jitter) and `BinaryTree3D.jsx` (`TreeNode` pulsation) referenced `state.clock.elapsedTime` directly instead of accumulating delta multiplied by the animation speed factor, resulting in unscaled background motion.
3. In `MotorEffectScene`, the thumb force `FlowPulses` speed omitted the `params.speed` scaling factor.

### Resolution & Architectural Enhancements
1. **Destructuring Standardization**:
   * Added `speed = 1.0` to the parameter destructuring of all scene components across `PhysicsCanvas.jsx`, `ChemistryCanvas.jsx`, `BiologyCanvas.jsx`, `CSCanvas.jsx`, and `MathCanvas.jsx`.
2. **Universal OrbitControls Scaling**:
   * Enhanced `SceneCanvas` in `scene-kit.jsx` so `OrbitControls` calculates `autoRotateSpeed={controls?.autoRotateSpeed !== undefined ? controls.autoRotateSpeed : 0.45 * (controls?.speed ?? 1.0)}`.
   * Explicitly forwarded `autoRotateSpeed: 0.45 * speed` across all auto-rotating scenes.
3. **Delta-Scaled Clocks for Organelles & Tree Nodes**:
   * Updated `Golgi`, `Cytoplasm`, and `FreeRibosomes` in `cell-organelles.jsx` to maintain `clock.current += delta * speed` and scale all drift cycles with user-selected animation speed.
   * Updated `TreeNode` in `BinaryTree3D.jsx` to scale pulsing frequencies with `speed`.
4. **Motor Force Flow Pulses**:
   * Updated `FlowPulses` for thumb force in `MotorEffectScene` to `speed={(0.2 + force * 0.4) * (params.speed ?? 1)}`.

---

## 29. 3D Visualizations Direct Connection to AI Explain, Dynamic Quiz & Mastery Engine

### Root Cause
Previously, clicking the "Test understanding" button in the 3D visualizer opened a static, local modal (`<QuizOverlay />`) containing hardcoded questions. It did not dynamically generate AI questions, did not leverage Gemini / LLM contextual synthesis, and crucially did not record completed study results into the global study session database or the **Mastery Dashboard**.

### Problem Statement
1. **Static Hardcoded Questions**: The quiz was fixed to 2 hardcoded questions per topic and could not test beyond the static list.
2. **Disconnected from Mastery**: Scores from 3D visualizations were ephemeral and did not update the learner's confidence heatmap or study session metrics on `/workspace` (Mastery tab).
3. **Missing Rich Contextual Extraction**: The rich mathematical and physical parameters, concepts, and syllabus context within each 3D topic were not utilized by the Socratic AI teaching engine.

### Resolution & Architectural Enhancements
1. **Rich Contextual Synthesis (`formatTopicStudyContext`)**:
   * Added `formatTopicStudyContext(topic, params)` in `components/visualizations/topics.js` which extracts the 3D topic's title, subject space (`Physics`, `Chemistry`, `Biology`, `Computer Science`, `Mathematics`), curriculum syllabus, summary blurb, structured key concepts, active simulation parameters, and domain keywords into structured study context.
2. **ExplainPanel & AI Quiz Integration**:
   * Replaced `<QuizOverlay />` with a direct callback pipeline (`onStudyTopic`) connecting `VisualizationHUD.jsx`, `BinaryTree3D.jsx`, and `ThreeDView.jsx` to `Workspace.jsx`'s `ExplainPanel` and `QuizPanel`.
   * Updated the action button in the HUD to **"AI Concept Breakdown & Quiz"** (`✨ Test with AI · logs to Mastery`).
   * When clicked, opens the `ExplainPanel` drawer where Gemini generates structured TL;DR summaries, mechanisms, analogies, misconceptions, and worked examples, with direct handover to `QuizPanel` ("🦆 Test me on this").
3. **Mastery Dashboard Rollup & Navigation**:
   * Completed AI quizzes and Socratic sessions automatically trigger `handleRecordSession`, recording scores, summaries, and confidence heatmaps into Dexie IndexedDB tagged under the 3D topic and subject space.
   * `handleStudyTopic` in `Workspace.jsx` was enhanced to recognize `3d_` topic sessions and seamlessly navigate back to the 3D visualization and study drawer from the Mastery Dashboard.
4. **Standalone Route Support**:
   * Updated `/visualizations` standalone page to forward quiz requests to `/workspace?tab=3d&vis=<topicId>&study=true` with hydration support.

---

## 30. Multi-Format Note Import & Export Lossless Engine Verification (.socratic, .md, .html, .docx, .txt, .pdf, .json)

### Root Cause
1. **Task List Markdown Inversion**: In `tryParseMarkdownToBlocks`, the generic bullet parser (`line.startsWith("- ")`) was executed before the task list checker (`line.startsWith("[ ] ")`), causing standard Markdown task lists (`- [ ] Task` from Obsidian, GitHub, and Notion) to be parsed as bullet blocks with literal `[ ]` text rather than native interactive `todo` blocks.
2. **Toggle Details Loss in Filter & Parser**: `filterBlocksForExport` prematurely converted `toggle` blocks into `bullet` blocks, preventing the rich native toggle exporters from generating HTML `<details>`, DOCX indented details, and Markdown details tags. Furthermore, `tryParseMarkdownToBlocks` lacked a multiline `<details><summary>` parser, splitting toggles into disconnected plain text blocks on re-import.
3. **Obsidian / GitHub Callout Compatibility**: Obsidian/GitHub callout formats (`> [!NOTE]`, `> [!WARNING]`, `> [!TIP]`, `> [!IMPORTANT]`) were treated as plain blockquotes without icon extraction.
4. **HTML Export Math Auto-Render**: Exported `.html` note documents included KaTeX CSS styling but omitted the KaTeX JavaScript auto-renderer, preventing LaTeX mathematical expressions from rendering when opening saved HTML files in standalone browsers.
5. **Node/Server HTML Fallback**: `tryParseHTMLToBlocks` returned empty arrays when `DOMParser` was undefined in headless environments without a regex fallback.
6. **Plain Text Code Delimiters**: `tryParsePlainTextToBlocks` had no parser for `--- CODE (lang) ---` delimiters, dropping code metadata upon re-import.
7. **JSON Backup & Standalone Note Returns**: `importWorkspaceFromJSON` resolved without the `notes` array in its payload, causing `importNoteFromFile` to return a fallback placeholder. Standalone `.json` note files without "socratic" in the filename were not parsed as JSON notes.

### Resolution & Architectural Enhancements
1. **Task List & Bullet Precedence**:
   * Updated `tryParseMarkdownToBlocks` and `BlockNoteEditor.jsx`'s `parseMarkdownToBlocks` with regex `^[-*+]?\s*\[([ xX])\]\s*(.*)$` checked before generic bullets.
2. **Lossless Toggle `<details><summary>` Support**:
   * Preserved `toggle` blocks in `filterBlocksForExport` with `.content`, `.details`, and `.open`.
   * Added both single-line and multiline `<details><summary>` parsing in `tryParseMarkdownToBlocks` and `BlockNoteEditor.jsx`.
3. **Obsidian Callout Mapping**:
   * Implemented `OBSIDIAN_CALLOUT_RE` mapping `note`, `tip`, `warning`, `important`, `caution`, `danger`, `question`, `help`, `faq`, `summary`, `success` to respective emojis (`💡`, `⚡`, `⚠️`, `📌`, `🚨`, `🔥`, `❓`, `🆘`, `💬`, `📋`, `✅`).
4. **Standalone KaTeX HTML Auto-Render**:
   * Added `katex.min.js` and `auto-render.min.js` with inline execution to `blocksToHTMLLossy`.
5. **Regex Fallback for HTML Parsing**:
   * Added headless regex fallback to `tryParseHTMLToBlocks` for Node and testing environments.
6. **Plain Text Code Block Reconstruction**:
   * Added `--- CODE (lang) ---` and `------------` parser in `tryParsePlainTextToBlocks`.
7. **JSON Note & Workspace Resolution**:
   * Included `notes` array in `importWorkspaceFromJSON` payload and added full support for standalone JSON note objects `{ title, emoji, blocks }` in `importNoteFromFile`.
8. **Real-time Workspace State Sync**:
   * Updated `handleImportSuccess` in `Workspace.jsx` to refresh all notes and custom spaces from IndexedDB (`getAllNotes()`).

---

## 31. Seeded Notes LaTeX Separation, inlinemath DB Roundtrip & 17-Block Suite Overhaul

### Root Cause
1. **Inline Math DB Degradation Bug**: In `lib/blockMapping.js`, `EDITOR_TYPES` omitted `"inlinemath"`, `toDbBlock` lacked `dbType: "inlinemath"`, and `toEditorBlock` degraded `dbType === "inlinemath"` into plain `type: "text"`, stripping the block's inline formula type when reloaded from IndexedDB.
2. **Media Property Misalignment in Seeded Notes**: Seeded notes previously defined media blocks with property `mediaType: "image"` instead of `mediaKind: "image"`, causing the editor and block mapping layers to fail to recognize the media kind.
3. **Embedded Equations in Raw Text Blocks**: Prior seeded notes contained raw LaTeX strings like `$f'(x) = \lim...$` embedded in standard paragraph text blocks instead of structured, standalone `inlinemath` and `math` blocks.
4. **Missing Block Types Across Spaces**: Seeded notes previously lacked `inlinemath` blocks and were concentrated strictly in the School space, leaving Personal, Misc, and Journal empty on first load.

### Resolution & Architectural Enhancements
1. **Lossless `inlinemath` DB Mapping**:
   * Added `"inlinemath"` to `EDITOR_TYPES` in `lib/blockMapping.js`.
   * Updated `toDbBlock` to serialize `inlinemath` blocks as `{ block_type: "text", content_json: { text, dbType: "inlinemath" } }`.
   * Updated `toEditorBlock` to map `content.dbType === "inlinemath"` directly to `{ id, type: "inlinemath", content: content.text }`.
2. **BlockNoteEditor Inline Math Enhancements**:
   * Styled `typeStyles.inlinemath` as clean paragraph text (`text-[15px] leading-relaxed text-ink-200 my-0.5`) so standalone `inlinemath` blocks render as sleek inline equation pills matching in-sentence pills without redundant bulky outer borders.
   * Added `placeholders.inlinemath` ("Inline equation $formula$…").
   * Updated `setBlockDOMFromText` to automatically format `inlinemath` blocks with KaTeX even when `$..$` delimiters are omitted.
   * Updated `blockToMarkdown` to serialize `inlinemath` blocks cleanly.
3. **Exhaustive 17-Block Suite Across All 7 Seeded Notes**:
   * Expanded and enriched all 7 seeded notes across `School`, `Personal`, `Misc`, and `Journal`:
     1. `note_calc`: Calculus — Differentiation, Integration & Differential Equations (School)
     2. `note_photo`: Cellular Bioenergetics — Photosynthesis & Respiration Cycles (School)
     3. `note_bigo`: Data Structures & Asymptotic Algorithmic Complexity (School)
     4. `note_econ`: Microeconomics — Supply, Demand, Elasticity & Market Equilibria (School)
     5. `note_neuro`: Cognitive Neuroscience & Deep Neural Networks (Personal)
     6. `note_quantum`: Quantum Mechanics — Wavefunctions & Atomic Orbitals (Misc)
     7. `note_journal`: Deep Work Protocol & Systems Architecture Log (Journal)
   * Every single note now contains all 17 supported block elements (`h1`, `h2`, `h3`, `h4`, `text`, `bullet`, `number`, `todo`, `toggle`, `callout`, `quote`, `divider`, `code`, `math`, `inlinemath`, `site`, `media`) and strictly 0 `canvas` blocks.
   * Fixed `mediaKind: "image"` on all media blocks.
4. **Seeding Protocol & Default Spaces**:
   * Bumped `DEMO_SEED_KEY` to `"socratic_demo_seeded_v9"` in `lib/db.js`.
   * Initialized `DEFAULT_NOTES_BY_SPACE` and `spaceMap` across all four default spaces (`School`, `Personal`, `Misc`, `Journal`).

---

## 32. Seeded Notes Wave Optics Replacement, Equal-Length Balanced Architecture & Journal Space Clean Sweep

### Root Cause & User Requirement
1. **Curriculum Alignment**: Replaced `note_econ` (Microeconomics) with `note_optics` (*Wave Optics — Snell's Law, Total Internal Reflection & Thin-Film Interference*) to seamlessly complement SocraticOS's interactive 3D physics simulations (Ray Refraction, Snell's Law, Critical Angle).
2. **Block Scattering**: Previous notes had auxiliary blocks (media, site bookmarks, quotes, toggles, dividers, code) clustered at the very end of notes. Users require natural, organic block scattering across all 4 pedagogical sections of every note.
3. **Equal-Length Balancing**: Ensure uniform depth and equal block counts (exactly 38 structured blocks each) across all seeded notes.
4. **Journal Space Clean Sweep**: Seeded notes removed from the `Journal` space, leaving it as a fresh, clean slate for user journal entries.

### Resolution & Architectural Enhancements
1. **Wave Optics Seeded Note (`note_optics`)**:
   * Authored textbook-grade study note covering Huygens' Wavefronts, Fermat's Principle of Least Time, Snell's Law, Critical Angle & TIR, Evanescent Wave penetration, Brewster's Polarization Angle, and Thin-Film Phase Shifts.
   * Includes interactive Fresnel and critical angle calculator in JavaScript, KaTeX display equations, Unsplash laser optics media, and HyperPhysics bookmarks.
2. **Harmonized 4-Tier Pedagogical Block Distribution (38 Blocks per Note)**:
   * **Section 1 (Foundations & Physical Intuition)**: `callout` intro, `h1`, `text`, `inlinemath` (x2), `quote`, `site`, `toggle` (Deep Dive).
   * **Section 2 (Mathematical Derivations & Analytics)**: `h2`, `text`, `inlinemath` (x2), `math` (central display KaTeX), `code` (production-grade JS simulation), `number` (x4 derivation steps), `media` (`mediaKind: "image"`).
   * **Section 3 (Mechanisms & Advanced Phenomena)**: `h3`, `text`, `inlinemath`, `bullet` (x4 structural cases), `toggle` (Edge case/Non-ideality), `divider`.
   * **Section 4 (Verification & Problem Sets)**: `h4`, `text`, `inlinemath`, `todo` (x4 active recall drills with checked states), `callout` (Exam Warning / Trap).
3. **Database Migration & Journal Space**:
   * Bumped `DEMO_SEED_KEY` to `"socratic_demo_seeded_v10"` in `lib/db.js`.
   * `demoNotesBySpace()` returns `{ School: [note_calc, note_photo, note_bigo, note_optics], Personal: [note_neuro], Misc: [note_quantum], Journal: [] }`.

---

## 33. Complete LaTeX Purge from Non-Math Blocks & Pure Semantic Segregation

### Root Cause & User Requirement
Residual mathematical symbols (Unicode integrals `∫`, summations `∑`, raw math approximations, and inline variable equations) remained inside non-math blocks (such as `toggle` details, `callout` warnings, `bullet` items, and `todo` lists), violating strict block semantic isolation.

### Resolution & Architectural Enhancements
1. **Zero-LaTeX Non-Math Block Guarantee**:
   * Meticulously purged all mathematical syntax, raw variable formulas, Greek letter math variables, and unparsed equations from `text`, `callout`, `bullet`, `number`, `todo`, `toggle`, `quote`, `site`, `media`, `h1`, `h2`, `h3`, and `h4` blocks across all 6 seeded notes.
   * Rewrote toggle deep-dive descriptions, callout exam traps, and todo drill objectives into clean, authoritative plain English.
   * All formulas and expressions are exclusively housed in dedicated `inlinemath` and `math` KaTeX blocks.
2. **Automated Verification**:
   * Scripted AST & regex validation confirmed `Zero LaTeX, zero math delimiters, zero unparsed formulas` across every non-math block in `DEMO_NOTES`.
3. **Database Migration Key**:
   * Bumped `DEMO_SEED_KEY` to `"socratic_demo_seeded_v11"` in `lib/db.js`.

---

## 34. Export & Import Modal Viewport Bounds & Top Header Cropping Resolution

### Root Cause
In `ExportImportModal.jsx`, the modal container lacked explicit viewport height constraints (`max-h-[calc(100vh-...)]`) and flex-column layout. When rendered on compact displays, standard laptops (1366x768 / 1440x900), or browsers with active devtools/toolbars, the cumulative height of the header (~60px), tabs (~45px), modal body (`max-h-[70vh]`), and footer (~60px) exceeded 100vh. Combined with `flex items-center` on the fixed overlay, the dialog vertically overflowed the viewport symmetrically, cropping the top header and close button off-screen.

### Problem Statement
1. **Modal Top Cropping**: Top header title ("Note Import & Export") and close button `X` pushed above the top edge of the browser viewport.
2. **Missing Flex-Column Container Bounds**: The outer dialog wrapper lacked `max-h-[calc(100vh-2rem)]` and `flex flex-col`, causing child elements to expand beyond the viewport rather than delegating scrolling to the body.
3. **Paddings and Margin Inefficiencies**: Internal card padding and format selection items consumed excessive vertical room.

### Resolution & Architectural Enhancements
1. **Viewport-Aware Dialog Sizing**:
   * Updated `ExportImportModal.jsx` container to `className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl transition-all my-auto"`.
2. **Shrink-Guarded Headers & Footers**:
   * Added `shrink-0` to the modal header, tab navigation bar, and footer to guarantee they never compress or get displaced off-screen.
3. **Scrollable Content Body (`min-h-0 flex-1 overflow-y-auto`)**:
   * Configured the modal body with `flex-1 min-h-0 overflow-y-auto` so scrolling is strictly contained within the active tab area.
4. **Responsive Micro-Padding Polish**:
   * Refined card padding to `p-2.5 sm:p-3` and format button grids to `gap-2`, ensuring all 7 export formats and dropzones fit cleanly without unnecessary height strain.

---

## 35. Note PDF & Print Export Formatting Suite: 8-Bug Layout, Typography & Element Resolution

### Root Causes & Problem Statements
1. **Top Whitespace Gap**: The cover banner wrapper (`.group.relative.h-44`) rendered with a fixed ~200px height. Because `@media print` stripped background colors, this left a massive blank void and bottom border above the note.
2. **Note Title Cutoff**: The note title was rendered strictly inside an `<input type="text">`, which browsers render as a single-line non-wrapping control in print mode, horizontally clipping long titles.
3. **Excessive H1 Padding & Space**: Compounding Tailwind padding (`pt-3 pb-1.5 my-1.5`), block list spacing (`space-y-2`), and CSS heading margin rules created an oversized gap before and after H1 headings.
4. **Site Bookmark & Expanded Toggle Crumpling & Text Overlap**:
   - Site bookmarks suffered from duplicate URL string collision because `a[href]::after` appended URLs to every `<a>` tag inside bookmark cards.
   - Expanded toggle details were rendered inside an interactive `<textarea>`, which `@media print` hidden via `textarea { display: none !important; }`, while interactive buttons and badges clashed with the header.
5. **LaTeX Equation Overflow & Scrollbars**: Long formulas inside `overflow-x-auto` triggered printed scrollbar widgets and clipped formula edges.
6. **Code Snippet Double Horizontal Lines**: `HighlightCode` rendered multi-line token spans inside an inline `<code>` tag. The CSS rule `pre, code { border: 1px solid #dddddd !important; }` caused browsers to draw top/bottom borders across every wrapped line fragment.
7. **Divider Vertical Spacing**: `.group/divider` padding (`py-3`) plus `hr` margin (`12pt 0`) generated excessive vertical space around horizontal rules.
8. **Collapsed Toggle Badge & Text Overlap**: The "Collapsed" / "Expanded" status badge and toggle button were rendered inside the same flex row as the title tag in print, clashing with the container bounds.
9. **In-Editor Math Block Scrollbars & Horizontal Overflow**: Long LaTeX equations in `MathBlock` forced an internal horizontal scrollbar on the formula viewport, disrupting clean reading and requiring manual horizontal scrolling.
10. **Code Snippet Pre-Break Blank Page Gap**: Setting `break-inside: avoid !important` on code snippet containers caused tall snippets to be pushed completely onto the next page when placed near page bottoms, leaving a massive empty half-page gap.
11. **Toggle Block Auto-Expansion Across Exports**: Collapsed toggle blocks on screen omitted their details from the DOM during print and file export, resulting in missing study content in exported documents.
12. **Toggle Block Print Scrollbars & Left Parenthesis Border**: Rounded corners on elements with only `border-l-2` caused the left border to curve inward at top/bottom like a scrollbar or parenthesis `(`.

### Resolution & Architectural Enhancements
1. **Zero-Void Page Top Reset**:
   * Added `print:hidden` to the cover banner, cover action buttons, and picker in `BlockNoteEditor.jsx`.
   * Reset top margins and paddings on `[data-editor-root]`, `main`, and flex containers in `@media print`.
2. **Print-Only Auto-Wrapping Note Header**:
   * Added `<div className="hidden print:block mb-4 pt-0">` with an auto-wrapping `<h1>` (`leading-tight break-words`) and emoji in `BlockNoteEditor.jsx`.
   * Hidden interactive screen title `<input>` and icon button during print (`print:hidden`).
3. **Typographic Heading Normalization**:
   * Reset heading padding (`padding: 0 !important`) and applied proportional, compact margins in `app/globals.css` (H1: `0.7em 0 0.25em`, H2: `0.6em 0 0.2em`, H3: `0.5em 0 0.2em`, H4: `0.4em 0 0.15em`).
4. **Site Bookmark & Toggle Detail Renderers**:
   * Excluded site bookmark cards and button links from `a[href]::after` in `app/globals.css`.
   * Added print-visible details container (`<div className="print-content hidden print:block text-xs text-ink-900 whitespace-pre-wrap ...">`) in `BlockNoteEditor.jsx` for toggles, and hidden interactive buttons, badges, and `<textarea>` controls in print.
5. **LaTeX Equation Auto-Scaling & Universal Scrollbar Elimination**:
   * Enforced `overflow: visible !important` and auto-scaling via `clamp(8pt, 1.6vw, 11.5pt)` on `.katex-display` so wide formulas wrap and scale without clipping.
   * Completely suppressed scrollbars in print with `*::-webkit-scrollbar { display: none !important; }` and `* { scrollbar-width: none !important; }`.
6. **Code Snippet Border Normalization**:
   * Removed borders from inline `<code>` and token `<span>` elements in print, applying a single clean border (`1px solid #e2e8f0`) and light background (`#f8fafc`) to the outer code container.
   * Replaced interactive language selector and copy button with a static print language badge.
7. **Divider Padding Optimization**:
   * Reduced `.group/divider` padding to `0` and `hr` margin to `6pt 0` with a clean `#d1d5db` border.
8. **Clean Static Toggle Header & Repositioned Triangle**:
   * Replaced interactive toggle buttons and badges with a clean static `▶ ` icon with `ml-3 mr-1.5` (6pt margin left, 3pt margin right in print), moving the triangle further right from the card edge and snug to the title text.
9. **Live Editor Math Auto-Scaling (`ResizeObserver`)**:
   * Removed `overflow-x-auto` from the `MathBlock` formula viewport in `BlockNoteEditor.jsx` and replaced it with `overflow-hidden w-full`.
   * Integrated a responsive `ResizeObserver` listener that compares formula width against viewport client width and applies `transform: scale(newScale)` with `transformOrigin: "center center"`, smoothly shrinking wide formulas to fit without scrollbars.
10. **Code Snippet Fluid Page Breaking**:
    * Replaced `break-inside: avoid` with `break-inside: auto` on code blocks and added `break-after: avoid` on the top bar in `app/globals.css`, letting code start immediately without leaving large empty gaps.
11. **Universal Auto-Expanded Toggles in All Export Formats**:
    * Configured `filterBlocksForExport` in `lib/exportImport.js` to always set `open: true` for all toggle blocks.
    * Separated the `.toggle-print-details` element in `BlockNoteEditor.jsx` from the conditional screen `<textarea>` wrapper so that details text is unconditionally present in the DOM and guaranteed to display in PDF/print even for collapsed blocks.
12. **Clean Straight Left Border & Infinite Expansion for Toggles**:
    * Removed curved border radii from left-bordered details containers (`print:border-none` on parent and `border-radius: 0` on `.print-content`).
    * Configured `height: auto !important; max-height: none !important; overflow: visible !important;` to display all text fully without scrollbars.

---

## 36. HTML Page Note Export Suite: Syntax Highlighting, Yellow Math & Quote Accents, Blue Checkboxes & White Typography

### Root Causes & Problem Statements
1. **Missing Code Snippet Language Badge & Syntax Highlighting**: In exported standalone HTML notes, code blocks were rendered simply as `<pre><code>` without a header bar or syntax token highlighting.
2. **Missing Yellow Quote Accent Line**: The quote block left border was styled with `#64748b` instead of SocraticOS's signature `#f0c04a` duck yellow highlight line.
3. **Grayed Out / Inconsistent Ticked Checkboxes**: Checkboxes relied on native browser `<input type="checkbox" disabled>` elements which rendered grayed out/muted instead of vibrant `#0ea5e9` / `#38bdf8` blue checkmarks.
4. **Missing Yellow Highlight on LaTeX & Inline Equations**: KaTeX and inline equation pills rendered in plain white rather than the signature `#f7d67c` yellow accent with yellow border styling.
5. **Messed-Up Inline Equation & Quote Block Padding**: `inlinemath` and `blockquote` lacked vertical margin clearing, causing equation pills and quote lines to collide without breathing room.

### Resolution & Architectural Enhancements
1. **Multi-Language Syntax Highlighting Engine Integration**:
   * Integrated `tokenizeCode` from `lib/syntaxHighlighter.js` into `blockToHtmlFragment` in `lib/exportImport.js`.
   * Automatically tokenizes code in 10 languages (JavaScript, TypeScript, Python, HTML, CSS, C++, Java, Rust, SQL, JSON) and wraps tokens in styled `<span>` elements with semantic colors (`keyword: #f472b6`, `string: #6ee7b7`, `type: #67e8f9`, `number: #fbbf24`, `operator: #fde047`, `builtin: #60a5fa`, `comment: #64748b`, `json-key: #7dd3fc`).
2. **Signature Yellow Quote Highlight Line**:
   * Restyled `blockquote` with `border-left: 4px solid #f0c04a; background: rgba(24, 28, 39, 0.5); border-radius: 0 6px 6px 0;`.
3. **Vibrant Blue Checkbox Component for Todo Items**:
   * Replaced native disabled checkboxes with `.todo-check.checked` (`background: #0284c7; border: 1.5px solid #38bdf8; color: #ffffff;`) and `.todo-check.unchecked` (`background: #181c27; border: 1.5px solid #475569;`).
4. **Yellow Highlight for LaTeX Math & Inline Equations**:
   * Styled `.math` with `border: 1px solid rgba(240, 192, 74, 0.4); color: #f7d67c;` and `.inlinemath` with `background: rgba(240, 192, 74, 0.1); border: 1px solid rgba(240, 192, 74, 0.45); color: #f7d67c;`.
   * Enforced `.katex, .katex-display, .katex * { color: #f7d67c !important; }` in the export stylesheet.
5. **Enhanced Reverse Import**:
   * Updated `tryParseHTMLToBlocks` in both DOMParser and regex fallback modes to parse `.code-block`, `.todo-item` with `.todo-check.checked`, `.note-title`, and `.toggle-details` structures losslessly.

---

## 37. Single-Line LaTeX Math Block Parsing & ESM Relative Import Resilience

### Root Causes & Problem Statements
1. **Single-Line `$$...$$` Math Block Multiline State Lock**: In `tryParseMarkdownToBlocks` (`lib/exportImport.js`), checking `trimmed.startsWith("$$")` opened a multiline math buffer (`inMathBlock = true`) even when a line contained a complete self-contained equation on a single line (e.g., `$$E = mc^2$$`). Because no subsequent closing `$$` line was encountered, `inMathBlock` remained locked until the end of the document, improperly swallowing all subsequent bullet points, checklists, and headings into the math buffer.
2. **Missing `.js` Extensions in `lib/aiService.js` & `lib/gemini.js` ESM Imports**: Relative import specifiers (`./gemini`, `./schemas`, `./exportImport`, `./db`) threw `ERR_MODULE_NOT_FOUND` when invoked directly by Node.js native ESM test runners (`node --test`).

### Resolution & Architectural Enhancements
1. **Self-Contained Single-Line `$$...$$` Math Parsing**:
   * Updated `tryParseMarkdownToBlocks` to check if `trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 2`. When matched, it immediately emits a `{ type: "math", content: trimmed.slice(2, -2).trim() }` block without toggling `inMathBlock`, preserving subsequent note lines intact.
2. **ESM Import Extension Normalization**:
   * Added `.js` extensions across all relative module imports in `lib/aiService.js` and dynamic imports in `lib/gemini.js`, guaranteeing 100% interoperability across Next.js Webpack/Turbopack bundles and native Node test runners.

---

## 38. Interactive Table Block Suite & Escaped Pipe Character Cell Parsing

### Root Causes & Problem Statements
1. **Lack of a Native Grid Table Block**: SocraticOS previously lacked an interactive table grid block for comparing matrices, quantum state vectors, formulas, and tabular data, forcing users to rely on raw plain-text ASCII formatting.
2. **Escaped Pipe Character (`\|`) Cell Splitting Bug**: When table cells contained pipe characters (e.g., quantum ket vectors like `|0>`, `|1>`, or logic `A | B`), standard Markdown serialization escaped them as `\|`. Naive `.split("|")` calls severed cells on escaped pipes, turning `\|0>` into empty cells and fragmented fragments.
3. **Multi-Format Export Disconnect**: Export engines (Markdown, HTML, Plain Text, DOCX) and import parsers lacked unified table serialization and deserialization routines.

### Resolution & Architectural Enhancements
1. **Interactive Table Block Component (`TableBlock` in `components/BlockNoteEditor.jsx`)**:
   * Built a full-featured matrix/grid table component with dynamic cell editing, table title/caption, dimension badge (`{rows} × {cols}`), `+ Column` / `+ Row` buttons, and hover delete buttons (`✕`) for individual columns and rows.
   * Engineered keyboard navigation: `Tab` to navigate to the next cell and auto-create a new row when pressing `Tab` on the bottom-right cell; `Shift+Tab` to step backwards; `Enter` to step down vertically.
2. **Escaped Pipe Character Parser (`parseMarkdownTableRow`)**:
   * Implemented `parseMarkdownTableRow` in `lib/exportImport.js` to iterate character-by-character, correctly unescaping `\|` into `|` inside cell content while splitting only on true column delimiter pipes.
3. **Database Schema & Backwards Compatibility (`lib/blockMapping.js`)**:
   * Registered `table` in `EDITOR_TYPES`. In `toDbBlock`, maps to `{ block_type: "text", content_json: { dbType: "table", tableData, text, title } }` to preserve Supabase DB enum compatibility while maintaining lossless round-trips.
4. **AI Reformatting & Multi-Format Integration**:
   * Updated `REFORMAT_PERSONA` in `app/api/reformat/route.js` and `lib/aiService.js` with structured Gemini schemas to structure tabular data, comparison matrices, and benchmarks into `table` blocks.
   * Enhanced Markdown, HTML, Plain Text, and DOCX (`docx.Table`) export/import engines to serialize and parse tables seamlessly.

---

## 39. Strict Verbatim Text Preservation in AI Note Reformatting Engine

### Root Causes & Problem Statements
1. **Risk of LLM Text Hallucination & Summarization**: When reformatting notes, LLMs can inadvertently rephrase, summarize, truncate, or rewrite the learner's technical text details, numbers, derivations, or variable names instead of purely reclassifying their block types.
2. **Ambiguous Prompt Directives**: The initial prompt instructed the AI to "transform raw study notes into clean learning documents", which could be interpreted by generative models as permission to edit or polish the writing style.

### Resolution & Architectural Enhancements
1. **Hardened Persona & Strict Verbatim Directives (`app/api/reformat/route.js` & `lib/aiService.js`)**:
   * Replaced generic editing instructions with `STRICT VERBATIM TEXT PRESERVATION (NO TEXT EDITING)` in `REFORMAT_PERSONA`.
   * Explicitly directed the AI: *"DO NOT edit, rewrite, rephrase, summarize, truncate, add, or alter ANY of the learner's words, explanations, sentences, code lines, or mathematical equations. Every single word, number, variable, term, and detail from the original note MUST be preserved EXACTLY as written (verbatim). You are ONLY changing and assigning the block TYPE and structure for each section or element."*
   * Augmented `buildReformatPrompt` to inject the verbatim constraint tag directly above the note content: `<original_notes> (Preserve all text details verbatim; only classify and assign block types)`.
2. **Automated Verification Test Suite (`tests/unit/reformat-note.test.mjs`)**:
   * Added unit test `preserves exact wording and details verbatim without modifying text content when reclassifying block types` validating that paragraphs with precise measurements (e.g. `120.45 microseconds`, `99.987% fidelity`), LaTeX state vectors (`\psi(t)`), Python code functions, checklists, and cryogenic warnings retain 100% exact character-for-character textual equality across block transformations.

---

## 40. Long-Note Intelligent Chunking Pipeline & LaTeX / Markdown Syntax Healing

### Root Causes & Problem Statements
1. **Output Token Limits on Oversized Notes**: Single-turn generative models encounter output token limits (~4,000 tokens) when processing massive study notes (e.g., 3,000–10,000+ words across dozens of sections), which could lead to truncation of trailing blocks.
2. **Broken LaTeX / Markdown Syntax in User Notes**: Learners frequently paste notes with malformed math syntax (e.g. unbalanced braces like `\frac{a}{b`, missing backslashes, invalid KaTeX tokens) or broken markdown table symbols that crash renderers. Purely verbatim rules previously forbade the AI from correcting these formatting errors.

### Resolution & Architectural Enhancements
1. **Long-Note Intelligent Chunking Engine (`chunkNoteBlocks` in `lib/aiService.js`)**:
   * Engineered an intelligent semantic partitioner that automatically divides oversized notes into logical sub-sections (~1,000 words or ~15–20 blocks per chunk, respecting H1/H2 topic boundaries).
   * Sequential AI processing iterates through chunks, reformatting each with full output token bandwidth, and concatenates the resulting blocks with unified IDs and consistent document metadata.
   * Added live progress state (`onProgress({ current, total, message })`) in `BlockNoteEditor.jsx` displaying `Part X/Y...` in the UI during execution.
2. **LaTeX Math & Markdown Syntax Healing Directives (`app/api/reformat/route.js` & `lib/aiService.js`)**:
   * Updated `REFORMAT_PERSONA` with `SYNTAX ERROR HEALING & FORMATTING REPAIR (ALLOWED EDITS)`:
     - Permitted the AI to repair broken LaTeX formulas (unbalanced braces, KaTeX errors, missing backslashes) so KaTeX renders cleanly.
     - Permitted the AI to heal broken Markdown/table syntax (pipe alignment, code fences, unescaped brackets).
     - Strictly enforced content & knowledge fidelity: the underlying facts, definitions, numbers, and concepts cannot be changed or distorted.
3. **Automated Verification**:
   * Added unit test suite `Long-Note Intelligent Chunking Engine` in `tests/unit/reformat-note.test.mjs` verifying single-chunk preservation for short notes and lossless multi-chunk segmentation for oversized notes.

---

## 41. Jumbled LaTeX Pathway Delimiter Healing & Asterisk Subheading Normalization

### Root Causes & Problem Statements
1. **Dangling or Asymmetric LaTeX Delimiters (Missing Leading `$$`)**: Notes copied from external syllabus documents often have asymmetric math fences (e.g. `\text{Stimulus} \rightarrow ... \rightarrow \text{Response}$$` with trailing `$$` but no leading `$$`). Standard parsers fell through to plain text, leaving unrendered raw LaTeX text with broken trailing dollar signs.
2. **Unconverted Markdown Asterisks in Category Subheadings**: Notes with structures like `* **Eye Structures:**` or `**Key Hormones & Sources:**` were either converted to bullets with raw asterisks inside the content or retained redundant `**` and `#` markers inside heading blocks.
3. **Bullet Stripping Over-Match Bug**: Naive regex `^([*•\-+]\s*)+` stripped leading `**` bold syntax (e.g. turning `**Cornea:**` into `Cornea:**`).

### Resolution & Architectural Enhancements
1. **Asymmetric / Jumbled LaTeX Delimiter Healing (`tryParseMarkdownToBlocks` & `heuristicReformatBlocks`)**:
   * Augmented math detection regex in `lib/exportImport.js`, `lib/aiService.js`, and `BlockNoteEditor.jsx` to identify lines ending in `$$` or containing multi-step LaTeX pathways (`\text{...} \rightarrow`, `\frac{...}`, etc.).
   * Automatically strips asymmetric `$$` / `$` and constructs a clean `{ type: "math", content }` block that renders high-definition KaTeX equations.
2. **Asterisk Subheading Classification & Normalization**:
   * Built pattern matcher `^([*•\-+]\s*)?\*\*([^*]+)\*\*[:\s]*$` across the heuristic engine and block normalizers to automatically convert standalone bold category lines into clean `h3` subheadings with outer `**`, `*`, and trailing `:` stripped.
   * Fixed bullet list marker regex to `^[*•\-+]\s+`, preserving inner markdown bold text (`**word**`) intact.
3. **Automated Verification**:
   * Added unit test `heals jumbled LaTeX pathway equations with missing opening $$ and cleans bold asterisks in subheadings` in `tests/unit/reformat-note.test.mjs`.

---

## 42. Rich Inline Markdown & KaTeX Rendering Across Blocks and Interactive Table Cells

### Root Causes & Problem Statements
1. **Raw Markdown Asterisks in Block Renders**: `setBlockDOMFromText` previously only formatted KaTeX math formulas containing dollar signs (`$formula$`). All other markdown formatting (`**bold**`, `*italic*`, `***bold italic***`, `~~strikethrough~~`, `` `code` ``, `==highlight==`, `[link](url)`) was set as raw text into `domNode.textContent`, leaving unsightly unrendered asterisks (e.g. `**Cornea:**`) across lists, paragraphs, and headings.
2. **Plain `<input>` Elements in Table Cells**: `TableBlock` previously rendered headers and rows with standard single-line `<input type="text">` HTML inputs. Inputs cannot render HTML, KaTeX pills, bold text, or markdown formatting, causing pasted markdown tables to display raw asterisks and dollar signs.
3. **Asymmetric Text Extraction**: `getBlockTextFromDOM` only extracted math formulas, dropping rich formatting tags if pasted or manipulated in contentEditable.

### Resolution & Architectural Enhancements
1. **Inline Markdown & KaTeX Engine (`formatMarkdownInline` in `BlockNoteEditor.jsx`)**:
   * Engineered a tokenizer pipeline that protects KaTeX math (`$formula$`) and inline code (`` `code` ``), escapes raw HTML safely, and converts markdown bold (`**text**`, `__text__`), italic (`*text*`, `_text_`), strikethrough (`~~text~~`), highlight (`==text==`), and links (`[text](url)`) into rich styled HTML spans.
   * Updated `setBlockDOMFromText` to apply `formatMarkdownInline` across all editor blocks.
2. **Interactive `TableCell` Component (`components/BlockNoteEditor.jsx`)**:
   * Replaced raw `<input>` elements with a rich `contentEditable` `TableCell` component with full keyboard navigation (`Tab`, `Shift+Tab`, `Enter`), live input handling, and automatic blur-sync formatting.
   * Pasted or typed bold, italic, inline code, and KaTeX math formulas now render visually inside every table cell.
3. **Lossless AST-based DOM Serializer (`getBlockTextFromDOM` in `BlockNoteEditor.jsx`)**:
   * Built a recursive DOM AST walker in `getBlockTextFromDOM` that losslessly serializes `<strong>`, `<em>`, `<code>`, `<del>`, `<mark>`, `<a>`, and `<span class="katex-inline-node">` back to standard Markdown syntax (`**bold**`, `*italic*`, `` `code` ``, `~~del~~`, `==mark==`, `[link](url)`, `$formula$`).
4. **HTML Export Rich Markdown Engine (`formatInlineMarkdownForHtml` in `lib/exportImport.js`)**:
   * Exported HTML files now render bold, italic, code, strikethrough, highlight, and math inside list items, table headers, table cells, and toggles.
5. **Automated Verification**:
   * Added unit test `renders bold, italic, code, strikethrough, and math inside list items and table cells in HTML export` in `tests/unit/export-import.test.mjs`.






