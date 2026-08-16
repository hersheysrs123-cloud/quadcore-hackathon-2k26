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

## 18. Test Suites, DB Migrations & Build Pipeline
* **Added `npm test` Script in `package.json`:**
  * `scripts/check-block-mapping.mjs`: Validates all DB ↔ Editor block types losslessly.
  * `scripts/test-inlinemath-roundtrip.mjs`: Validates in-sentence inline math across Markdown, Plain Text, HTML, and DOCX.
* **Production Build Verified:**
  * Next.js 15.5 production build (`npm run build`) compiles with zero errors and optimized static/dynamic routes.
